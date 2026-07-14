// /api/google/status · is Google configured / connected for this user, and what
// calendars can they target. Drives the Connect button + calendar toggles.
import { NextRequest, NextResponse } from "next/server";
import { isConfigured, getTokenRow, getValidAccessToken, listCalendars } from "@/lib/google-cal";
import { ownerFromRequest } from "@/lib/session-owner";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!isConfigured()) return NextResponse.json({ configured: false, connected: false });
  // Owner from the verified session, not ?owner — otherwise any teammate could
  // read another user's connection state, email, and calendar list.
  const sess = await ownerFromRequest(req);
  if (!sess) return NextResponse.json({ configured: true, connected: false }, { status: 401 });
  const owner = sess.owner;
  try {
    const row = await getTokenRow(owner);
    if (!row || !row.access_token) return NextResponse.json({ configured: true, connected: false });
    const token = await getValidAccessToken(owner);
    if (!token) return NextResponse.json({ configured: true, connected: false });
    const calendars = await listCalendars(token);
    return NextResponse.json({
      configured: true, connected: true, email: row.email,
      calendars, prefs: row.calendar_prefs || {},
    });
  } catch (e) {
    return NextResponse.json({ configured: true, connected: false, error: String(e) });
  }
}
