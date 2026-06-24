// /api/auth/google/callback · Google sign-in redirect target.
// Verifies the CSRF nonce, exchanges the code, confirms the email is verified
// and on the allowed domain, then mints the signed `poast_session` cookie.
// NEVER writes to the calendar `google_tokens` table — sign-in identity lives
// only in the cookie. Only ever redirects to LITERAL paths (no open-redirect).
import { NextRequest, NextResponse } from "next/server";
import {
  isConfigured, exchangeCode, fetchUserInfo, emailAllowed, mintSession,
  sessionCookieOptions, clearedCookieOptions, SESSION_COOKIE, NONCE_COOKIE,
} from "@/lib/auth-session";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;
  // Every exit clears the one-time nonce cookie.
  const to = (path: string) => {
    const res = NextResponse.redirect(`${origin}${path}`);
    res.cookies.set(NONCE_COOKIE, "", clearedCookieOptions());
    return res;
  };
  if (!isConfigured()) return to("/?auth=unconfigured");

  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const nonce = req.cookies.get(NONCE_COOKIE)?.value;
  // CSRF double-submit: the state echoed back by Google must equal our nonce.
  if (!code || !state || !nonce || state !== nonce) return to("/?auth=denied");

  try {
    const t = await exchangeCode(code, `${origin}/api/auth/google/callback`);
    const info = await fetchUserInfo(t.access_token);
    if (!info || !info.verified_email || !emailAllowed(info.email)) return to("/?auth=denied");
    const res = to("/?signed_in=1");
    res.cookies.set(SESSION_COOKIE, await mintSession(info.email, info.name), sessionCookieOptions());
    return res;
  } catch {
    return to("/?auth=error");
  }
}
