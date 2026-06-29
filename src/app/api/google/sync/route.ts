// /api/google/sync · two-way sync between the marketing event spine and the
// user's Google calendars, plus per-calendar selection (which calendars feed
// MarketingSUITE).
//   POST { owner, prefs }                  → persist calendar prefs verbatim
//   POST { owner, setCalendar:{id,on} }    → select/deselect one calendar AND
//                                            apply it live: on → pull it now,
//                                            off → purge its pulled events.
//   POST { owner, syncSelected:true }      → push+pull every selected calendar,
//                                            purge every de-selected one.
//   POST { owner, calendarId }             → sync that one calendar (manual).
// A calendar feeds the suite unless its pref is explicitly false (default-on).
// Push/pull are idempotent via marketing_events.gcal_event_id.
import { NextRequest, NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import {
  isConfigured, getValidAccessToken, getTokenRow, saveCalendarPrefs,
  listCalendars, listEvents, insertEvent, patchEvent,
} from "@/lib/google-cal";

export const dynamic = "force-dynamic";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = ReturnType<typeof neon>;
function sql(): Db { return neon(process.env.DATABASE_URL || process.env.POSTGRES_URL || ""); }
function iso(v: unknown): string | null { if (!v) return null; const d = new Date(v as string); return isNaN(+d) ? null : d.toISOString(); }
const HOUR = 3600_000;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;
interface SyncCounts { pushed: number; updated: number; pulled: number; errors: string[]; }

// A calendar is selected (feeds the suite) unless explicitly turned off.
function selectedMap(prefs: Record<string, unknown> | null | undefined): Record<string, boolean> {
  const sel = (prefs as { selected?: Record<string, boolean> } | null)?.selected;
  return sel && typeof sel === "object" ? sel : {};
}
function isOn(sel: Record<string, boolean>, calId: string): boolean { return sel[calId] !== false; }

// Push our events targeting `calendarId` up to Google, then pull that calendar's
// events (now → +60d) back into the spine. Idempotent via gcal_event_id.
async function syncOne(db: Db, token: string, owner: string, calendarId: string): Promise<SyncCounts> {
  const c: SyncCounts = { pushed: 0, updated: 0, pulled: 0, errors: [] };

  // ── PUSH: our events targeting this calendar → Google ──
  try {
    const rows = (await db.query(
      `select * from marketing_events
        where owner=$1 and coalesce(source,'') <> 'gcal'
          and starts_at is not null
          and (payload->>'calendarId') = $2`,
      [owner, calendarId]
    )) as Row[];
    for (const e of rows) {
      const startISO = iso(e.starts_at); if (!startISO) continue;
      const endISO = iso(e.ends_at) || new Date(new Date(startISO).getTime() + HOUR).toISOString();
      const resource = {
        summary: e.title || "(untitled)",
        description: e.notes || "",
        start: { dateTime: startISO },
        end: { dateTime: endISO },
      };
      try {
        if (e.gcal_event_id) {
          await patchEvent(token, calendarId, e.gcal_event_id, resource);
          c.updated++;
        } else {
          const g = await insertEvent(token, calendarId, resource);
          await db.query("update marketing_events set gcal_event_id=$1, updated_at=now() where id=$2 and owner=$3", [g.id, e.id, owner]);
          c.pushed++;
        }
      } catch (err) { c.errors.push(`push ${e.id}: ${String(err).slice(0, 120)}`); }
    }
  } catch (err) { c.errors.push("push query: " + String(err).slice(0, 160)); }

  // ── PULL: this calendar's events (now → +60d) → our spine ──
  try {
    const now = new Date();
    const timeMin = now.toISOString();
    const timeMax = new Date(now.getTime() + 60 * 24 * HOUR).toISOString();
    const events = await listEvents(token, calendarId, timeMin, timeMax);
    for (const g of events) {
      if (g.status === "cancelled") continue;
      const startISO = iso(g.start?.dateTime || g.start?.date); if (!startISO) continue;
      const endISO = iso(g.end?.dateTime || g.end?.date);
      const existing = (await db.query("select id from marketing_events where owner=$1 and gcal_event_id=$2 limit 1", [owner, g.id])) as Row[];
      const allDay = !!(g.start?.date && !g.start?.dateTime);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const attendees = (g.attendees || []).map((a: any) => a.email).filter(Boolean);
      const meetLink = g.hangoutLink || g.conferenceData?.entryPoints?.find((e: { entryPointType?: string; uri?: string }) => e.entryPointType === "video")?.uri || null;
      const payload = JSON.stringify({
        calendarId, scheduleKind: "booking", gcalHtmlLink: g.htmlLink || null,
        allDay, location: g.location || null, attendees, meetLink,
      });
      const notes = g.description || null;
      if (existing.length) {
        await db.query(
          "update marketing_events set title=$1, starts_at=$2, ends_at=$3, notes=$4, payload=$5::jsonb, updated_at=now() where owner=$6 and gcal_event_id=$7",
          [g.summary || "(untitled)", startISO, endISO, notes, payload, owner, g.id]
        );
      } else {
        await db.query(
          `insert into marketing_events (id, owner, title, event_type, status, starts_at, ends_at, source, gcal_event_id, notes, payload, updated_at)
           values ($1,$2,$3,'manual','scheduled',$4,$5,'gcal',$6,$7,$8::jsonb, now())
           on conflict (id) do nothing`,
          ["g-" + g.id, owner, g.summary || "(untitled)", startISO, endISO, g.id, notes, payload]
        );
        c.pulled++;
      }
    }
  } catch (err) { c.errors.push("pull: " + String(err).slice(0, 160)); }

  return c;
}

// Drop the pulled (source='gcal') mirror of de-selected calendars so their
// events vanish from every view. Local-origin events (manual/poast) that merely
// target the calendar are preserved. Returns how many rows were removed.
async function purgeCalendars(db: Db, owner: string, calIds: string[]): Promise<number> {
  if (!calIds.length) return 0;
  const removed = (await db.query(
    `delete from marketing_events
      where owner=$1 and source='gcal' and (payload->>'calendarId') = ANY($2::text[])
      returning id`,
    [owner, calIds]
  )) as Row[];
  return removed.length;
}

export async function POST(req: NextRequest) {
  if (!isConfigured()) return NextResponse.json({ error: "Google Calendar not configured" }, { status: 503 });
  let body: {
    owner?: string; calendarId?: string; prefs?: Record<string, unknown>;
    setCalendar?: { id: string; on: boolean }; syncSelected?: boolean;
  };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const owner = body.owner || "shared";
  const db = sql();

  // Mode: persist prefs verbatim (no side effects).
  if (body.prefs && !body.calendarId && !body.setCalendar && !body.syncSelected) {
    await saveCalendarPrefs(owner, body.prefs);
    return NextResponse.json({ ok: true });
  }

  // Mode: select/deselect one calendar, applied live.
  if (body.setCalendar && body.setCalendar.id) {
    const { id, on } = body.setCalendar;
    const row = await getTokenRow(owner);
    const sel = selectedMap(row?.calendar_prefs);
    sel[id] = on;
    await saveCalendarPrefs(owner, { ...(row?.calendar_prefs || {}), selected: sel });
    if (on) {
      const token = await getValidAccessToken(owner);
      if (!token) return NextResponse.json({ error: "Not connected" }, { status: 401 });
      const c = await syncOne(db, token, owner, id);
      return NextResponse.json({ ok: c.errors.length === 0, on: true, ...c });
    }
    const purged = await purgeCalendars(db, owner, [id]);
    return NextResponse.json({ ok: true, on: false, purged });
  }

  // Mode: sync every selected calendar; purge every de-selected one.
  if (body.syncSelected) {
    const token = await getValidAccessToken(owner);
    if (!token) return NextResponse.json({ error: "Not connected" }, { status: 401 });
    const row = await getTokenRow(owner);
    const sel = selectedMap(row?.calendar_prefs);
    let cals;
    try { cals = await listCalendars(token); }
    catch (e) { return NextResponse.json({ ok: false, error: String(e).slice(0, 160) }, { status: 502 }); }
    const onIds = cals.filter((c) => isOn(sel, c.id)).map((c) => c.id);
    const offIds = cals.filter((c) => !isOn(sel, c.id)).map((c) => c.id);
    const total: SyncCounts = { pushed: 0, updated: 0, pulled: 0, errors: [] };
    for (const calId of onIds) {
      const c = await syncOne(db, token, owner, calId);
      total.pushed += c.pushed; total.updated += c.updated; total.pulled += c.pulled;
      total.errors.push(...c.errors);
    }
    const purged = await purgeCalendars(db, owner, offIds);
    return NextResponse.json({ ok: total.errors.length === 0, calendars: onIds.length, purged, ...total });
  }

  // Mode: manual single-calendar sync.
  const calendarId = body.calendarId;
  if (!calendarId) return NextResponse.json({ error: "calendarId required" }, { status: 400 });
  const token = await getValidAccessToken(owner);
  if (!token) return NextResponse.json({ error: "Not connected" }, { status: 401 });
  const c = await syncOne(db, token, owner, calendarId);
  return NextResponse.json({ ok: c.errors.length === 0, ...c });
}
