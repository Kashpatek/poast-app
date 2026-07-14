// /api/google/disconnect · forget this user's Google tokens.
import { NextRequest, NextResponse } from "next/server";
import { isConfigured, disconnect } from "@/lib/google-cal";
import { ownerFromRequest } from "@/lib/session-owner";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!isConfigured()) return NextResponse.json({ error: "Google Calendar not configured" }, { status: 503 });
  // Owner from the verified session — otherwise any teammate could force-forget
  // another user's Google connection by posting their name.
  const sess = await ownerFromRequest(req);
  if (!sess) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  await disconnect(sess.owner);
  return NextResponse.json({ ok: true });
}
