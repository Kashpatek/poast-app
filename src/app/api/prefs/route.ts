// /api/prefs · per-user appearance (theme + background) + first-run tour flag.
// GET ?owner=<id>            → { theme, bg, tour_seen, role }
// POST { owner, theme?, bg?, tour_seen? } → upsert that owner's row.
//
// Theme prefs are self-service (a client only ever sends its own owner). The
// role is derived server-side from identity and returned for the client to
// gate tools; changing ANOTHER user's row is reserved for admins (write-guard).
import { NextRequest, NextResponse } from "next/server";
import { getPrefs, savePrefs } from "@/lib/user-prefs";
import { roleForOwner, isAdmin } from "@/app/lib/roles";

export const dynamic = "force-dynamic";

const THEMES = ["classic", "stock", "glass"];
const BGS = ["aurora", "cockpit", "iridescent"];

export async function GET(req: NextRequest) {
  const owner = (req.nextUrl.searchParams.get("owner") || "shared").trim();
  try {
    const p = await getPrefs(owner);
    // stored:false ⇒ no row yet; client must keep its local choice, not adopt defaults.
    if (!p) return NextResponse.json({ theme: "classic", bg: "aurora", tour_seen: false, role: roleForOwner(owner), stored: false });
    return NextResponse.json({ ...p, role: roleForOwner(owner), stored: true });
  } catch (e) {
    // DB not configured / unreachable → safe defaults so the client just uses local.
    return NextResponse.json({ theme: "classic", bg: "aurora", tour_seen: false, role: roleForOwner(owner), stored: false });
  }
}

export async function POST(req: NextRequest) {
  let body: { owner?: string; theme?: string; bg?: string; tour_seen?: boolean; actor?: string } = {};
  try { body = await req.json(); } catch { /* empty body */ }
  const owner = (body.owner || "shared").trim();
  // write-guard: editing someone else's row requires an admin actor.
  const actor = (body.actor || owner).trim();
  if (actor !== owner && !isAdmin(actor)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const patch: { theme?: string; bg?: string; tour_seen?: boolean } = {};
  if (body.theme && THEMES.includes(body.theme)) patch.theme = body.theme;
  if (body.bg && BGS.includes(body.bg)) patch.bg = body.bg;
  if (typeof body.tour_seen === "boolean") patch.tour_seen = body.tour_seen;
  try {
    const saved = await savePrefs(owner, patch);
    return NextResponse.json({ ...saved, role: roleForOwner(owner) });
  } catch (e) {
    return NextResponse.json({ error: "db" }, { status: 200 }); // soft-fail; client keeps localStorage
  }
}
