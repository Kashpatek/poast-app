// ─── Appearance / admin role map (server-usable, no secrets) ───
// Coarse role axis (admin | marketing | analyst), DERIVED from identity —
// never chosen by the user. Admin-editable later; hardcoded for now.
//   admin     → Akash (owner of this workspace)
//   marketing → Daksh, Michelle, Vansh
//   analyst   → everyone else (default)
//
// Keyed by both the email (for future Google SSO) and the app's first-name
// identity (poast-current-user today). Kept separate from user-context's
// feature-role strings ("Brand and Creative Director", etc.).
export type AppRole = "admin" | "marketing" | "analyst";

const EMAIL_ROLE: Record<string, AppRole> = {
  "akash@semianalysis.com": "admin",
  "daksh@semianalysis.com": "marketing",
  "michelle@semianalysis.com": "marketing",
  "vansh@semianalysis.com": "marketing",
};

const NAME_ROLE: Record<string, AppRole> = {
  akash: "admin",
  daksh: "marketing",
  michelle: "marketing",
  vansh: "marketing",
};

export function roleForEmail(email: string | null | undefined): AppRole {
  const e = (email || "").trim().toLowerCase();
  return EMAIL_ROLE[e] || "analyst";
}

// `owner` is whatever poast-current-user holds — today a first name.
export function roleForOwner(owner: string | null | undefined): AppRole {
  const o = (owner || "").trim().toLowerCase();
  if (o.includes("@")) return roleForEmail(o);
  return NAME_ROLE[o] || "analyst";
}

export function isAdmin(owner: string | null | undefined): boolean {
  return roleForOwner(owner) === "admin";
}
