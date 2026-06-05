// Placeholder push-to-platform endpoint for the RSS Manager. Real
// integrations (Spotify Open Access, Apple Podcasts Connect, YouTube
// Data API) are multi-day work, so for v1 we just acknowledge the
// request and let the client toast "Coming soon".

import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  let body: { platform?: string; feedUrl?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }
  const platform = (body.platform || "").toLowerCase();
  if (!platform) {
    return NextResponse.json({ ok: false, error: "Missing platform" }, { status: 400 });
  }
  return NextResponse.json({
    ok: true,
    pending: true,
    platform,
    message: `Push to ${platform} coming soon — feed will sync via direct API once OAuth is wired.`,
    ts: Date.now(),
  });
}
