// /api/google/event · write ONE event back to the user's Google Calendar.
//   POST { owner, calendarId, fromCalendarId?, gcalEventId?, title, description?,
//          location?, attendees?: string[], start, end?, allDay? }
//   - gcalEventId present → patch it (and move first if calendarId changed)
//   - else → insert a new event on that calendar
// Returns { ok, gcalEventId, htmlLink, meetLink }. Google-calendar targets only
// (the in-app "sa-marketing" calendar is local and never written to Google).
import { NextRequest, NextResponse } from "next/server";
import { isConfigured, getValidAccessToken, insertEvent, patchEvent, moveCalendarEvent } from "@/lib/google-cal";
import { ownerFromRequest } from "@/lib/session-owner";

export const dynamic = "force-dynamic";

function ymd(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function addDay(ymdStr: string): string {
  const d = new Date(ymdStr + "T00:00:00");
  d.setDate(d.getDate() + 1);
  return ymd(d.toISOString());
}

export async function POST(req: NextRequest) {
  if (!isConfigured()) return NextResponse.json({ error: "Google Calendar not configured" }, { status: 503 });
  // Owner from the verified session — using the client-supplied `body.owner`
  // would let a teammate write/patch/move events using another user's token.
  const sess = await ownerFromRequest(req);
  if (!sess) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  let body: {
    calendarId?: string; fromCalendarId?: string; gcalEventId?: string;
    title?: string; description?: string; location?: string; attendees?: string[];
    start?: string; end?: string | null; allDay?: boolean;
  };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const owner = sess.owner;
  const calendarId = body.calendarId;
  if (!calendarId || calendarId === "sa-marketing") {
    return NextResponse.json({ error: "Pick a Google calendar to sync to" }, { status: 400 });
  }
  if (!body.start) return NextResponse.json({ error: "start required" }, { status: 400 });

  const token = await getValidAccessToken(owner);
  if (!token) return NextResponse.json({ error: "Not connected" }, { status: 401 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const resource: any = {
    summary: body.title || "(untitled)",
  };
  // Only touch description/location when the caller actually sent them. A time-only
  // drag/resize omits both → patch leaves Google's existing values untouched. The
  // editor always sends them (even "" to deliberately clear).
  if (body.description !== undefined) resource.description = body.description;
  if (body.location !== undefined) resource.location = body.location;
  if (Array.isArray(body.attendees)) {
    resource.attendees = body.attendees.filter((e) => e && e.includes("@")).map((email) => ({ email }));
  }
  if (body.allDay) {
    const sd = ymd(body.start);
    resource.start = { date: sd };
    resource.end = { date: body.end ? addDay(ymd(body.end)) : addDay(sd) };
  } else {
    const startISO = new Date(body.start).toISOString();
    const endISO = new Date(body.end || new Date(new Date(body.start).getTime() + 3600_000)).toISOString();
    resource.start = { dateTime: startISO };
    resource.end = { dateTime: endISO };
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let g: any;
    if (body.gcalEventId) {
      if (body.fromCalendarId && body.fromCalendarId !== calendarId && body.fromCalendarId !== "sa-marketing") {
        await moveCalendarEvent(token, body.fromCalendarId, body.gcalEventId, calendarId);
      }
      g = await patchEvent(token, calendarId, body.gcalEventId, resource);
    } else {
      g = await insertEvent(token, calendarId, resource);
    }
    return NextResponse.json({
      ok: true,
      gcalEventId: g.id,
      htmlLink: g.htmlLink || null,
      meetLink: g.hangoutLink || null,
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e).slice(0, 200) }, { status: 502 });
  }
}
