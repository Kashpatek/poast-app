// Canonical @semianalysis.com email → POAST user key. SERVER-SAFE: pure data +
// pure functions, no React / no "use client", so it can be imported by both the
// client UI (user-context.tsx re-exports these) AND server routes that need to
// resolve a verified session email to the same `owner` string the app keys
// per-user data on (Google tokens, marketing events, per-owner prefs).
//
// Any verified address that isn't a named teammate maps to the shared Analyst
// seat — the single source of truth used by onboarding, the session gate, and
// the server-side owner binding, so a Google identity always resolves the same
// way everywhere.
export const EMAIL_TO_USER: Record<string, string> = {
  "akash@semianalysis.com": "Akash",
  "michelle@semianalysis.com": "Michelle",
  "vansh@semianalysis.com": "Vansh",
  "daksh@semianalysis.com": "Daksh",
};

export const ADMIN_USER = "Akash";

export function emailToUserName(email: string): string {
  return EMAIL_TO_USER[(email || "").trim().toLowerCase()] || "Analyst";
}

// The task board is per-user: each owner gets its own `projects` row. Akash keeps
// the pre-existing shared row id verbatim (`akash-todo-master`) so his board is
// byte-preserved with ZERO migration; everyone else gets `todo-<owner>`. Owner is
// always one of the emailToUserName values above, so lowercasing is safe and
// unmapped users share the single `todo-analyst` seat (same as google_tokens).
// Both the API routes and the client import THIS function — never two copies.
export function boardIdFor(owner: string): string {
  return owner === ADMIN_USER ? "akash-todo-master" : `todo-${(owner || "").toLowerCase()}`;
}
// Guard the invariant: a typo that stops Akash resolving to the legacy row would
// silently orphan his real board behind a fresh empty one.
if (boardIdFor(ADMIN_USER) !== "akash-todo-master") {
  throw new Error("boardIdFor invariant broken: Akash must map to akash-todo-master");
}
