// Lightweight password gate for the POAST user picker. The user picks
// a name (Akash / Michelle / etc.), enters a password, and we check it
// against per-user env vars (or a shared fallback) before letting the
// client switch user. No JWT, no cookie — the client decides whether
// to keep the session in localStorage or sessionStorage based on the
// "Stay logged in on this computer" checkbox.
//
// Env vars (configure in Vercel project settings):
//   POAST_PASSWORD_AKASH=...
//   POAST_PASSWORD_MICHELLE=...
//   POAST_PASSWORD_VANSH=...
//   POAST_PASSWORD_DAKSH=...
//   POAST_PASSWORD_ANALYST=...
//   POAST_PASSWORD=...        (shared fallback if a per-user value isn't set)
//
// If neither a per-user nor shared password is configured, we accept any
// input (dev mode) so local testing never gets blocked.

import { NextRequest, NextResponse } from "next/server";

const VALID_USERS = ["Akash", "Michelle", "Vansh", "Daksh", "Analyst"] as const;

export async function POST(req: NextRequest) {
  let body: { user?: string; password?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 }); }

  const user = (body.user || "").trim();
  const password = body.password || "";

  if (!user || !(VALID_USERS as readonly string[]).includes(user)) {
    return NextResponse.json({ ok: false, error: "Unknown user" }, { status: 400 });
  }

  const perUser = process.env["POAST_PASSWORD_" + user.toUpperCase()];
  const shared = process.env.POAST_PASSWORD;
  const expected = perUser || shared || null;

  // Dev mode: no password configured anywhere → allow any input.
  if (!expected) return NextResponse.json({ ok: true, user, devMode: true });

  // Constant-time-ish comparison (we're not protecting against
  // sophisticated timing attacks for an internal tool; this is a basic
  // guard against typos / casual access).
  if (password !== expected) {
    return NextResponse.json({ ok: false, error: "Wrong password" }, { status: 401 });
  }

  return NextResponse.json({ ok: true, user });
}
