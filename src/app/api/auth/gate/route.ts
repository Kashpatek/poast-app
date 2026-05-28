// Outer-gate password check for the team picker (NOT the per-user gate
// in /api/auth/login). The client used to compare against a hardcoded
// "marketing" string in the bundle; this route moves the secret to an
// env var so it isn't shipped to anyone who opens devtools.
//
// Env vars:
//   POAST_GATE_PASSWORD=...     (production secret)
//
// Dev mode: when POAST_GATE_PASSWORD is unset we accept "marketing"
// (and only "marketing") so local development doesn't need any setup.

import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  let body: { password?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 }); }

  const password = (body.password || "").trim().toLowerCase();
  const expected = (process.env.POAST_GATE_PASSWORD || "marketing").trim().toLowerCase();

  if (password !== expected) {
    return NextResponse.json({ ok: false, error: "Wrong password" }, { status: 401 });
  }
  return NextResponse.json({ ok: true });
}
