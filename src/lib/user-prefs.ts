// Per-user appearance prefs (theme + background + first-run tour flag),
// stored in the Neon `user_prefs` table. Owner-keyed, mirrors google-cal.ts.
import { neon } from "@neondatabase/serverless";

export interface Prefs {
  theme: string;
  bg: string;
  tour_seen: boolean;
}

const DEFAULTS: Prefs = { theme: "classic", bg: "aurora", tour_seen: false };

function sql() {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!url) throw new Error("DATABASE_URL not set");
  return neon(url);
}

// null = no stored row (caller must NOT treat the defaults as the user's choice).
export async function getPrefs(owner: string): Promise<Prefs | null> {
  const rows = (await sql().query(
    "select theme, bg, tour_seen from user_prefs where owner=$1",
    [owner]
  )) as Prefs[];
  return rows[0] || null;
}

export async function savePrefs(owner: string, patch: Partial<Prefs>): Promise<Prefs> {
  const cur = (await getPrefs(owner)) || { ...DEFAULTS };
  const next: Prefs = {
    theme: patch.theme ?? cur.theme,
    bg: patch.bg ?? cur.bg,
    tour_seen: patch.tour_seen ?? cur.tour_seen,
  };
  await sql().query(
    `insert into user_prefs (owner, theme, bg, tour_seen, updated_at)
     values ($1,$2,$3,$4, now())
     on conflict (owner) do update set
       theme=excluded.theme, bg=excluded.bg, tour_seen=excluded.tour_seen, updated_at=now()`,
    [owner, next.theme, next.bg, next.tour_seen]
  );
  return next;
}
