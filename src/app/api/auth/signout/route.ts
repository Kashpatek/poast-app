// /api/auth/signout · clear the sign-in session cookie so the next entry
// re-verifies through Google. Paired with the client's "Switch user".
import { NextResponse } from "next/server";
import { clearedCookieOptions, SESSION_COOKIE } from "@/lib/auth-session";

export const dynamic = "force-dynamic";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, "", clearedCookieOptions());
  return res;
}
