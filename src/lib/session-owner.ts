// Server-side owner binding — the missing authorization half of the auth gate.
//
// proxy.ts proves a request carries a valid @semianalysis.com session ("who
// walked through the door"), but the per-user API routes historically trusted a
// client-supplied `owner` body/query param to decide WHOSE data to touch. That
// let any signed-in teammate operate on another user's Google tokens / calendar
// simply by passing a different name. This resolves `owner` from the VERIFIED
// session cookie instead, so the client value can no longer choose the victim.
//
// The resolved `owner` is `emailToUserName(session.email)` — the exact same
// string the client keys per-user rows on (poast-current-user), so no data
// migration is needed: named teammates resolve to their name, everyone else to
// the shared "Analyst" seat, identically to before.
import type { NextRequest } from "next/server";
import { verifySession, SESSION_COOKIE } from "./auth-session";
import { emailToUserName } from "./user-identity";

export interface SessionOwner {
  email: string;
  name: string;   // display name from the Google session
  owner: string;  // POAST user key used for per-user data (emailToUserName)
}

// Resolve the verified session on a request to its owner key. Returns null when
// there is no valid session (proxy.ts should already have blocked those, but the
// routes verify independently — defense in depth, and callback rides here too).
export async function ownerFromRequest(req: NextRequest): Promise<SessionOwner | null> {
  const payload = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (!payload) return null;
  return { email: payload.email, name: payload.name, owner: emailToUserName(payload.email) };
}
