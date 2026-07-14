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
  listCalendars, listEvents, insertEvent, patchEvent, getEvent,
} from "@/lib/google-cal";
import { ownerFromRequest } from "@/lib/session-owner";

export const dynamic = "force-dynamic";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = ReturnType<typeof neon>;
function sql(): Db { return neon(process.env.DATABASE_URL || process.env.POSTGRES_URL || ""); }
function iso(v: unknown): string | null { if (!v) return null; const d = new Date(v as string); return isNaN(+d) ? null : d.toISOString(); }
const HOUR = 3600_000;

// Google "calendar-status" events — working location ("Office"/"Home"), out of
// office, and focus time — are personal status, not calendar work items. They
// recur (daily working location especially) and would carpet every day in the
// suite, so we never mirror them into the spine. See google-cal calendar-status.
const STATUS_EVENT_TYPES = new Set(["workingLocation", "outOfOffice", "focusTime"]);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;
// A single change surfaced to the Sync-now summary popup.
interface SyncChange { gcalId: string; calendarId: string; title: string; start: string | null; organizer?: string | null; myResponse?: string | null; }
interface SyncCounts {
  pushed: number; updated: number; pulled: number; errors: string[];
  added: SyncChange[];       // events newly pulled into the spine this run
  updatedList: SyncChange[]; // pulled events whose title/time actually changed
  invites: SyncChange[];     // events where the user's RSVP is still needsAction
}
function emptyCounts(): SyncCounts { return { pushed: 0, updated: 0, pulled: 0, errors: [], added: [], updatedList: [], invites: [] }; }

// A calendar is selected (feeds the suite) unless explicitly turned off.
function selectedMap(prefs: Record<string, unknown> | null | undefined): Record<string, boolean> {
  const sel = (prefs as { selected?: Record<string, boolean> } | null)?.selected;
  return sel && typeof sel === "object" ? sel : {};
}
function isOn(sel: Record<string, boolean>, calId: string): boolean { return sel[calId] !== false; }
// Personal status events (working location / OOO / focus) are hidden unless the
// user explicitly opts in via Settings → "Calendar status events".
function showStatusPref(prefs: Record<string, unknown> | null | undefined): boolean {
  return (prefs as { showStatusEvents?: boolean } | null)?.showStatusEvents === true;
}

// Push our events targeting `calendarId` up to Google, then pull that calendar's
// events (now → +60d) back into the spine. Idempotent via gcal_event_id.
async function syncOne(db: Db, token: string, owner: string, calendarId: string, showStatus = false): Promise<SyncCounts> {
  const c: SyncCounts = emptyCounts();

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
      // Personal status events (working location / OOO / focus time). Hidden by
      // default: skip them and delete any mirror row we pulled before — so they
      // stop populating the calendar (self-healing on the next sync). When the
      // user opts in (showStatus), they fall through and are pulled + tagged.
      const isStatus = STATUS_EVENT_TYPES.has(g.eventType);
      if (isStatus && !showStatus) {
        await db.query("delete from marketing_events where owner=$1 and gcal_event_id=$2 and source='gcal'", [owner, g.id]);
        continue;
      }
      const startISO = iso(g.start?.dateTime || g.start?.date); if (!startISO) continue;
      const endISO = iso(g.end?.dateTime || g.end?.date);
      const existing = (await db.query("select id, title, starts_at, ends_at from marketing_events where owner=$1 and gcal_event_id=$2 limit 1", [owner, g.id])) as Row[];
      const allDay = !!(g.start?.date && !g.start?.dateTime);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const attendees = (g.attendees || []).map((a: any) => a.email).filter(Boolean);
      // The signed-in user's own RSVP on this event — Google marks their attendee
      // row with self:true. "needsAction" ⇒ an invite still awaiting a reply.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const meAtt = (g.attendees || []).find((a: any) => a.self);
      const myResponse: string | null = meAtt?.responseStatus || null;
      const needsRsvp = myResponse === "needsAction";
      const organizer: string | null = g.organizer?.displayName || g.organizer?.email || null;
      const meetLink = g.hangoutLink || g.conferenceData?.entryPoints?.find((e: { entryPointType?: string; uri?: string }) => e.entryPointType === "video")?.uri || null;
      const payload = JSON.stringify({
        calendarId, scheduleKind: isStatus ? "status" : "booking", gcalHtmlLink: g.htmlLink || null,
        allDay, location: g.location || null, attendees, meetLink,
        eventType: g.eventType || "default", myResponse, organizer,
      });
      const notes = g.description || null;
      const title = g.summary || "(untitled)";
      const chg: SyncChange = { gcalId: g.id, calendarId, title, start: startISO, organizer, myResponse };
      if (existing.length) {
        const prev = existing[0];
        const changed = (prev.title || "") !== title || iso(prev.starts_at) !== startISO || iso(prev.ends_at) !== (endISO || null);
        await db.query(
          "update marketing_events set title=$1, starts_at=$2, ends_at=$3, notes=$4, payload=$5::jsonb, updated_at=now() where owner=$6 and gcal_event_id=$7",
          [title, startISO, endISO, notes, payload, owner, g.id]
        );
        if (changed) c.updatedList.push(chg);
      } else {
        await db.query(
          `insert into marketing_events (id, owner, title, event_type, status, starts_at, ends_at, source, gcal_event_id, notes, payload, updated_at)
           values ($1,$2,$3,'manual','scheduled',$4,$5,'gcal',$6,$7,$8::jsonb, now())
           on conflict (id) do nothing`,
          ["g-" + g.id, owner, title, startISO, endISO, g.id, notes, payload]
        );
        c.pulled++; c.added.push(chg);
      }
      if (needsRsvp) c.invites.push(chg);
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

// Remove every mirrored status event (working location / OOO / focus) regardless
// of when it was pulled. Two passes: (1) rows we tagged with payload.eventType,
// (2) legacy rows pulled before tagging existed — found by asking Google which
// event-ids on the primary calendar are status events (wide window) and deleting
// exactly those. Used when the user turns status events off.
async function purgeStatusEverywhere(db: Db, token: string, owner: string): Promise<number> {
  const types = [...STATUS_EVENT_TYPES];
  // (1) Rows we explicitly tagged with a status eventType (pulled after tagging).
  const tagged = (await db.query(
    `delete from marketing_events
      where owner=$1 and source='gcal' and (payload->>'eventType') = ANY($2::text[])
      returning id`,
    [owner, types]
  )) as Row[];
  // (2) Legacy rows pulled before tagging existed have NO status marker to match
  // on, so ask Google which event-ids on the primary calendar are status events
  // and delete exactly those. Query EACH type on its own: the Calendar API rejects
  // a request that mixes `workingLocation` with other eventTypes (the old combined
  // call 400'd and was silently swallowed, so legacy "Office" rows never cleared).
  // Per-type also dodges the 250-result cap when a daily working location expands
  // into many single-event instances.
  const now = new Date();
  const tMin = new Date(now.getTime() - 30 * 24 * HOUR).toISOString();
  const tMax = new Date(now.getTime() + 90 * 24 * HOUR).toISOString();
  const ids = new Set<string>();
  for (const t of types) {
    try {
      const evs = await listEvents(token, "primary", tMin, tMax, [t]);
      for (const e of evs as Row[]) { if (e.id) ids.add(String(e.id)); }
    } catch { /* this event type may be unsupported on the calendar — skip it */ }
  }
  let byId: Row[] = [];
  if (ids.size) {
    byId = (await db.query(
      `delete from marketing_events
        where owner=$1 and source='gcal' and gcal_event_id = ANY($2::text[])
        returning id`,
      [owner, [...ids]]
    )) as Row[];
  }
  return tagged.length + byId.length;
}

export async function POST(req: NextRequest) {
  if (!isConfigured()) return NextResponse.json({ error: "Google Calendar not configured" }, { status: 503 });
  // Owner from the verified session — every mode below (prefs, RSVP, calendar
  // select, sync, purge) reads/writes marketing_events and the Google token for
  // this owner, so trusting a client-supplied `body.owner` would expose and
  // mutate another user's calendar spine and tokens.
  const sess = await ownerFromRequest(req);
  if (!sess) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  let body: {
    calendarId?: string; prefs?: Record<string, unknown>;
    setCalendar?: { id: string; on: boolean }; syncSelected?: boolean;
    setShowStatus?: boolean;
    rsvp?: { calendarId: string; eventId: string; response: "accepted" | "declined" | "tentative" };
  };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const owner = sess.owner;
  const db = sql();

  // Mode: persist prefs verbatim (no side effects).
  if (body.prefs && !body.calendarId && !body.setCalendar && !body.syncSelected) {
    await saveCalendarPrefs(owner, body.prefs);
    return NextResponse.json({ ok: true });
  }

  // Mode: RSVP to an invite — flip the signed-in user's responseStatus on the
  // Google event (accept/decline/maybe), then mirror it onto our row so the UI
  // updates without a full re-pull.
  if (body.rsvp && body.rsvp.eventId && body.rsvp.calendarId) {
    const token = await getValidAccessToken(owner);
    if (!token) return NextResponse.json({ error: "Not connected" }, { status: 401 });
    const { calendarId, eventId, response } = body.rsvp;
    try {
      const ev = await getEvent(token, calendarId, eventId);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const attendees = (ev.attendees || []).map((a: any) => (a.self ? { ...a, responseStatus: response } : a));
      await patchEvent(token, calendarId, eventId, { attendees }, { sendUpdates: "all" });
      await db.query(
        "update marketing_events set payload = jsonb_set(coalesce(payload,'{}'::jsonb), '{myResponse}', to_jsonb($1::text)), updated_at=now() where owner=$2 and gcal_event_id=$3",
        [response, owner, eventId]
      );
      return NextResponse.json({ ok: true, response });
    } catch (e) {
      return NextResponse.json({ ok: false, error: String(e).slice(0, 160) }, { status: 502 });
    }
  }

  // Mode: show/hide personal status events (working location / OOO / focus),
  // applied live — on pulls + tags them onto the spine, off purges every mirror.
  if (typeof body.setShowStatus === "boolean") {
    const token = await getValidAccessToken(owner);
    if (!token) return NextResponse.json({ error: "Not connected" }, { status: 401 });
    const row = await getTokenRow(owner);
    await saveCalendarPrefs(owner, { ...(row?.calendar_prefs || {}), showStatusEvents: body.setShowStatus });
    if (body.setShowStatus) {
      let primaryId = "primary";
      try { const cals = await listCalendars(token); primaryId = cals.find((x) => x.primary)?.id || "primary"; } catch { /* fall back to the alias */ }
      const c = await syncOne(db, token, owner, primaryId, true);
      return NextResponse.json({ ok: c.errors.length === 0, showStatus: true, ...c });
    }
    const purged = await purgeStatusEverywhere(db, token, owner);
    return NextResponse.json({ ok: true, showStatus: false, purged });
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
      const c = await syncOne(db, token, owner, id, showStatusPref(row?.calendar_prefs));
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
    const showStatus = showStatusPref(row?.calendar_prefs);
    const total: SyncCounts = emptyCounts();
    for (const calId of onIds) {
      const c = await syncOne(db, token, owner, calId, showStatus);
      total.pushed += c.pushed; total.updated += c.updated; total.pulled += c.pulled;
      total.errors.push(...c.errors);
      total.added.push(...c.added); total.updatedList.push(...c.updatedList); total.invites.push(...c.invites);
    }
    const purged = await purgeCalendars(db, owner, offIds);
    // When status events are off, make sure none linger (out-of-window / legacy).
    if (!showStatus) { try { await purgeStatusEverywhere(db, token, owner); } catch { /* best-effort */ } }
    return NextResponse.json({
      ok: total.errors.length === 0, calendars: onIds.length, purged,
      pushed: total.pushed, updated: total.updated, pulled: total.pulled, errors: total.errors,
      changes: { added: total.added, updated: total.updatedList, invites: total.invites, removed: purged },
    });
  }

  // Mode: manual single-calendar sync.
  const calendarId = body.calendarId;
  if (!calendarId) return NextResponse.json({ error: "calendarId required" }, { status: 400 });
  const token = await getValidAccessToken(owner);
  if (!token) return NextResponse.json({ error: "Not connected" }, { status: 401 });
  const manualRow = await getTokenRow(owner);
  const c = await syncOne(db, token, owner, calendarId, showStatusPref(manualRow?.calendar_prefs));
  return NextResponse.json({ ok: c.errors.length === 0, ...c });
}
