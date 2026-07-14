// ─── Access gate (Next 16 "proxy", formerly "middleware") ───────────────────
// The server-side enforcement that makes Google sign-in a REAL gate: every
// request except the root onboarding page, the sign-in machinery, and static
// assets must carry a valid @semianalysis.com `poast_session` cookie.
//   • /api/*  without a valid session → 401
//   • any other page without one      → bounced to the root sign-in (/)
// The client's localStorage identity is only a cache; this is the boundary that
// can't be bypassed from devtools.
//
// Next 16 notes: this file is `proxy` (the renamed `middleware`) and runs on the
// Node.js runtime by default — the `runtime` config option is not allowed here —
// so verifySession's Buffer + crypto.subtle usage works. We fail CLOSED: if
// verifySession throws (e.g. POAST_SESSION_SECRET unset in prod) we treat the
// request as unauthenticated and funnel to sign-in rather than 500 every route.
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifySession, SESSION_COOKIE } from "@/lib/auth-session";
import { roleForEmail } from "@/app/lib/roles";

// Open without a POAST session:
//   • the sign-in machinery (prefix — it has sub-paths: start/callback/me/signout)
//   • the transcription worker callback, which authenticates itself with an
//     HMAC over the body (WORKER_SECRET) and is hit server-to-server (no cookie).
// The provider OAuth *return* redirects (/api/google/callback, /api/buffer/callback)
// are NOT exempt: the user who started the connect is already signed in, so their
// session cookie rides the top-level (SameSite=Lax) redirect back and passes the
// gate — while an unauthenticated party can no longer reach them to write tokens
// under an attacker-chosen owner or harvest a provider token. Exact-match the
// worker callback (not startsWith) so a future sibling route can't inherit it.
const PUBLIC_PREFIX = "/api/auth/";
const PUBLIC_EXACT = new Set(["/api/clip/callback"]);

// ─── Route-level role gating (the authorization layer above authentication) ───
// The session cookie answers "who walked through the door"; these answer "is
// this seat allowed here." Enforced server-side because the app's other role
// checks are client-side React keyed on the spoofable `poast-current-user`.
// Keep this deliberately small — only genuinely role-restricted surfaces. Most
// tools are open to the whole team by design (e.g. the SHARED /board studio).
//   admin-only     → Akash's personal task board
//   non-analyst    → marketing tooling not meant for the default Analyst seat
const ADMIN_ONLY_PREFIXES = ["/board/original"];
const NON_ANALYST_PREFIXES = ["/ai-training"];
function matchesPrefix(pathname: string, prefixes: string[]): boolean {
  return prefixes.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Root (onboarding self-gates + is the OAuth return target) and the
  // self-authenticated endpoints must be reachable before a session exists.
  if (pathname === "/" || pathname.startsWith(PUBLIC_PREFIX) || PUBLIC_EXACT.has(pathname)) {
    return NextResponse.next();
  }

  let session = null;
  try {
    session = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  } catch {
    session = null; // fail closed (e.g. missing session secret) → sign-in funnel
  }

  if (!session) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/", req.url));
  }

  // Authenticated — now authorize by role for the few restricted surfaces.
  const needsAdmin = matchesPrefix(pathname, ADMIN_ONLY_PREFIXES);
  const needsNonAnalyst = matchesPrefix(pathname, NON_ANALYST_PREFIXES);
  if (needsAdmin || needsNonAnalyst) {
    const role = roleForEmail(session.email);
    const allowed = needsAdmin ? role === "admin" : role === "admin" || role === "marketing";
    if (!allowed) {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      return NextResponse.redirect(new URL("/", req.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  // Run on everything except Next internals + static assets. /api/* IS matched
  // (so it can be 401'd); /api/auth/* is allowed in-code above. Static files and
  // common asset extensions are excluded so they serve without a session.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|robots.txt|sitemap.xml|manifest.webmanifest|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|woff|woff2|ttf|otf|map)$).*)",
  ],
};
