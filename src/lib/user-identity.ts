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
