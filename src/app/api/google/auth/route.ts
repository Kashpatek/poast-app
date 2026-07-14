// /api/google/auth · kick off the Google OAuth consent flow.
import { NextRequest, NextResponse } from "next/server";
import { isConfigured, buildAuthUrl } from "@/lib/google-cal";
import { ownerFromRequest } from "@/lib/session-owner";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!isConfigured()) return NextResponse.json({ error: "Google Calendar not configured" }, { status: 503 });
  // Owner comes from the verified session, NOT a client-supplied ?owner — the
  // OAuth `state` (owner) is round-tripped through Google and used by the
  // callback to key the stored tokens, so a spoofable value here would let a
  // teammate connect their calendar under someone else's identity.
  const sess = await ownerFromRequest(req);
  if (!sess) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || `${req.nextUrl.origin}/api/google/callback`;
  return NextResponse.redirect(buildAuthUrl(redirectUri, sess.owner));
}
