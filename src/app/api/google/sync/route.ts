// /api/google/sync · two-way sync between the marketing event spine and a
// Google calendar, for one user.
//   POST { owner, prefs }                 → save calendar visibility/target prefs
//   POST { owner, calendarId }            → push owner's events targeting that
//                                           calendar to Google, then pull that
//                                           calendar's events back in (±window).
// Push/pull are idempotent via marketing_events.gcal_event_id.
import { NextRequest, NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import {
  isConfigured, getValidAccessToken, saveCalendarPrefs,
  listEvents, insertEvent, patchEvent,
} from "@/lib/google-cal";

export const dynamic = "force-dynamic";

function sql() { return neon(process.env.DATABASE_URL || process.env.POSTGRES_URL || ""); }
function iso(v: unknown): string | null { if (!v) return null; const d = new Date(v as string); return isNaN(+d) ? null : d.toISOString(); }
const HOUR = 3600_000;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

export async function POST(req: NextRequest) {
  if (!isConfigured()) return NextResponse.json({ error: "Google Calendar not configured" }, { status: 503 });
  let body: { owner?: string; calendarId?: string; prefs?: Record<string, unknown> };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const owner = body.owner || "shared";

  // Mode 1 — just persist calendar prefs.
  if (body.prefs && !body.calendarId) {
    await saveCalendarPrefs(owner, body.prefs);
    return NextResponse.json({ ok: true });
  }

  const calendarId = body.calendarId;
  if (!calendarId) return NextResponse.json({ error: "calendarId required" }, { status: 400 });

  const token = await getValidAccessToken(owner);
  if (!token) return NextResponse.json({ error: "Not connected" }, { status: 401 });

  const db = sql();
  let pushed = 0, updated = 0, pulled = 0;
  const errors: string[] = [];

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
          updated++;
        } else {
          const g = await insertEvent(token, calendarId, resource);
          await db.query("update marketing_events set gcal_event_id=$1, updated_at=now() where id=$2 and owner=$3", [g.id, e.id, owner]);
          pushed++;
        }
      } catch (err) { errors.push(`push ${e.id}: ${String(err).slice(0, 120)}`); }
    }
  } catch (err) { errors.push("push query: " + String(err).slice(0, 160)); }

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
      const payload = JSON.stringify({ calendarId, scheduleKind: "booking", gcalHtmlLink: g.htmlLink || null });
      if (existing.length) {
        await db.query(
          "update marketing_events set title=$1, starts_at=$2, ends_at=$3, updated_at=now() where owner=$4 and gcal_event_id=$5",
          [g.summary || "(untitled)", startISO, endISO, owner, g.id]
        );
      } else {
        await db.query(
          `insert into marketing_events (id, owner, title, event_type, status, starts_at, ends_at, source, gcal_event_id, payload, updated_at)
           values ($1,$2,$3,'manual','scheduled',$4,$5,'gcal',$6,$7::jsonb, now())
           on conflict (id) do nothing`,
          ["g-" + g.id, owner, g.summary || "(untitled)", startISO, endISO, g.id, payload]
        );
        pulled++;
      }
    }
  } catch (err) { errors.push("pull: " + String(err).slice(0, 160)); }

  return NextResponse.json({ ok: errors.length === 0, pushed, updated, pulled, errors });
}
