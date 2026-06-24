// /api/auth/google/start · begin the Google sign-in flow.
//
// • Dev sign-in (local, opt-in via POAST_DEV_AUTH=1, never in prod): skip Google
//   entirely and mint a session for a domain-checked email — lets the whole
//   post-sign-in UX be walked locally before the real callback redirect URI is
//   registered in the Google Cloud Console. ?dev=<email> picks who; default = akash.
// • Real flow: set a CSRF nonce cookie + redirect to Google's consent screen.
import { NextRequest, NextResponse } from "next/server";
import {
  isConfigured, devAuthEnabled, allowedDomain, emailAllowed, mintSession, newNonce,
  buildSignInAuthUrl, sessionCookieOptions, nonceCookieOptions, SESSION_COOKIE, NONCE_COOKIE,
} from "@/lib/auth-session";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;
  const to = (path: string) => NextResponse.redirect(`${origin}${path}`);

  if (devAuthEnabled()) {
    const dev = (req.nextUrl.searchParams.get("dev") || `akash@${allowedDomain()}`).trim().toLowerCase();
    if (!emailAllowed(dev)) return to("/?auth=denied");
    const res = to("/?signed_in=1");
    res.cookies.set(SESSION_COOKIE, await mintSession(dev, dev.split("@")[0]), sessionCookieOptions());
    return res;
  }

  if (!isConfigured()) return to("/?auth=unconfigured");

  const nonce = newNonce();
  // Compute the redirect URI inline — do NOT read GOOGLE_REDIRECT_URI (that env
  // var is the calendar callback's override; reusing it would break calendar).
  const res = NextResponse.redirect(buildSignInAuthUrl(`${origin}/api/auth/google/callback`, nonce));
  res.cookies.set(NONCE_COOKIE, nonce, nonceCookieOptions());
  return res;
}
