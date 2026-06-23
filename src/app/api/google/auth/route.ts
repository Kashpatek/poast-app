// /api/google/auth · kick off the Google OAuth consent flow.
import { NextRequest, NextResponse } from "next/server";
import { isConfigured, buildAuthUrl } from "@/lib/google-cal";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!isConfigured()) return NextResponse.json({ error: "Google Calendar not configured" }, { status: 503 });
  const owner = req.nextUrl.searchParams.get("owner") || "shared";
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || `${req.nextUrl.origin}/api/google/callback`;
  return NextResponse.redirect(buildAuthUrl(redirectUri, owner));
}
