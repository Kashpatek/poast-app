"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import {
  Zap,
  LayoutGrid,
  Layers,
  Captions,
  Radio,
  Headphones,
  GanttChart,
  Newspaper,
  Brain,
  Clapperboard,
  Film,
  Type,
  Library,
  Star,
  History,
  Wand2,
  SatelliteDish,
  Scissors,
  Table2,
  Bot,
  SquareCheckBig,
  Shield,
  Settings,
  Send,
  Rocket,
  ShieldCheck,
  Plus,
  PenLine,
  Megaphone,
  TrendingUp,
  Calendar,
  ChevronDown,
  Heart,
  X,
  AppWindow,
  type LucideIcon,
} from "lucide-react";
import { D, ft, gf, mn } from "./shared-constants";
import { useHomePrefs, togglePin, removePin, isPinned } from "./home-prefs";

// ─── Stat + shelf model (ambient "Today's shelves") ──────────────────────────
// The ambient home shows contextual workspace stats in the hero, then a row of
// horizontally-scrollable shelves below — a faithful port of the mockup
// ambient.html (~/poast-welcome-3.0 concepts/ambient.html "Today's shelves").
interface Stat { Icon: LucideIcon; value: string; label: string; accent: string; }
const STATS: Stat[] = [
  { Icon: PenLine,    value: "3",    label: "drafts",              accent: D.violet },
  { Icon: Calendar,   value: "12",   label: "scheduled this week", accent: D.blue },
  { Icon: Megaphone,  value: "2",    label: "live flights",        accent: D.coral },
  { Icon: TrendingUp, value: "+18%", label: "reach",               accent: D.cyan },
];

interface ShelfTile { name: string; sub: string; Icon: LucideIcon; status: string; badge?: "new" | "akash"; nav?: string; href?: string; akashOnly?: boolean; }
interface Shelf { key: string; label: string; ring: string; Icon: LucideIcon; count: string; desc: string; tiles: ShelfTile[]; ghost?: boolean; }

// NOTE: the "Recently used" + "Favorites" shelves are NOT in this array — they
// are rendered dynamically from the per-user home-prefs store (see below), so
// they reflect real usage/pins rather than a static demo list. SHELVES holds
// only the fixed system categories that follow them.
const SHELVES: Shelf[] = [
  { key: "produce", label: "Produce", ring: D.amber, Icon: Wand2, count: "9 tools", desc: "Make the content", tiles: [
    { name: "Slop Top", sub: "Brief gen", Icon: Zap, status: "Most used", nav: "sloptop" },
    { name: "Carousel", sub: "Carousels", Icon: LayoutGrid, status: "3 templates", nav: "carousel" },
    { name: "CarouselNEU", sub: "Foundry wizard", Icon: Layers, status: "New", href: "/carousel-2", badge: "akash", akashOnly: true },
    { name: "Capper", sub: "Captions", Icon: Captions, status: "Auto-fit", nav: "captions" },
    { name: "Chart Maker", sub: "Quick charts", Icon: GanttChart, status: "12 saved", href: "/charts" },
    { name: "POAST Studio", sub: "Charts · tables", Icon: Table2, status: "Pro", href: "/charts" },
    { name: "CopySTUDIO", sub: "Draft · voice", Icon: Type, status: "Brand voice", href: "/copy-studio" },
    { name: "Assets", sub: "Brand library", Icon: Library, status: "248 files", nav: "assets" },
    { name: "DesignStudio", sub: "Docs · graphics", Icon: Wand2, status: "New", href: "/design-studio" },
    { name: "B-Roll", sub: "B-roll library", Icon: Film, status: "Library", nav: "broll" },
  ]},
  { key: "podcast", label: "Podcast", ring: D.coral, Icon: Radio, count: "4 tools", desc: "SA Weekly + FK", tiles: [
    { name: "Fab Knowledge", sub: "Interview brain", Icon: Headphones, status: "Indexed", nav: "fk" },
    { name: "SA Weekly", sub: "Episode pipeline", Icon: Radio, status: "EP18", nav: "weekly" },
    { name: "Clip Engine", sub: "Cut & caption", Icon: Scissors, status: "6 ready", nav: "production-studio" },
    { name: "Production Studio", sub: "Full post suite", Icon: Clapperboard, status: "3 stages left", nav: "production-studio" },
  ]},
  { key: "prepare", label: "Prepare", ring: D.teal, Icon: Brain, count: "3 tools", desc: "Research & signals", tiles: [
    { name: "Intelligence", sub: "Signals", Icon: Brain, status: "Live", href: "/intelligence-suite" },
    { name: "Trends", sub: "What's rising", Icon: TrendingUp, status: "7 hot topics", href: "/intelligence-suite" },
    { name: "Daily Brief", sub: "Standup digest", Icon: Newspaper, status: "Updated 6:00", nav: "news" },
  ]},
  { key: "premier", label: "Premier", ring: D.violet, Icon: Rocket, count: "2 tools", desc: "Launch & rollout", tiles: [
    { name: "Press to Premier", sub: "Launch rollouts", Icon: Clapperboard, status: "Live in 2d", nav: "p2p" },
    { name: "Outreach", sub: "Cold email + lists", Icon: Send, status: "Drafts", nav: "outreach" },
  ]},
  { key: "admin", label: "Admin", ring: D.blue, Icon: ShieldCheck, count: "5 tools", desc: "Workspace", tiles: [
    { name: "MarketingSUITE", sub: "The cockpit", Icon: SatelliteDish, status: "All systems ok", badge: "new", href: "/marketing-suite" },
    { name: "AI Training", sub: "Brand voice", Icon: Bot, status: "Trained", href: "/ai-training" },
    { name: "Task Board", sub: "Master queue", Icon: SquareCheckBig, status: "9 open", nav: "tasks", akashOnly: true },
    { name: "Admin Dashboard", sub: "Files · users", Icon: Shield, status: "62% of plan", badge: "akash", href: "/marketing-suite" },
    { name: "Settings", sub: "Workspace config", Icon: Settings, status: "Brand defaults", nav: "settings" },
  ]},
];

// ─── Home-organization resolver (Recently used + Favorites) ──────────────────
// The shared store keeps per-user `recent` + `pins` as plain string ids. To turn
// an id into a renderable tile we first look it up in the existing SHELVES (so it
// reuses the real label/icon/ring/nav target), and otherwise fall back to a small
// label map + titleized id with a generic icon. The id stored in the store is the
// tile's nav target (`nav`) when present, else its href — so a tile's pin id and
// its navigation are the same value (see tileId).

/** Stable id used both as the store key and the nav/href target for a tile. */
function tileId(t: ShelfTile): string {
  return t.nav ?? t.href ?? t.name;
}

// First matching SHELVES tile for each id (skips the dynamic shelves, which are
// added at render time and not part of SHELVES).
const TILE_BY_ID: Record<string, ShelfTile> = (() => {
  const m: Record<string, ShelfTile> = {};
  for (const s of SHELVES) for (const t of s.tiles) {
    const id = tileId(t);
    if (!(id in m)) m[id] = t;
  }
  return m;
})();

// Friendly names for ids that have no SHELVES tile (e.g. tools reachable only via
// nav elsewhere in the app). Unknown ids fall through to titleize().
const SEC_LABELS: Record<string, string> = {
  sloptop: "Slop Top",
  captions: "Capper",
  news: "News Flow",
  chart2: "POAST Studio",
  p2p: "Press to Premier",
  broll: "B-Roll",
  trends: "Trends",
  ideation: "Ideation Nation",
  voice: "Voice Scorer",
  headline: "Headline Doctor",
};

function titleize(id: string): string {
  return id
    .replace(/[-_/]+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase()) || id;
}

interface ResolvedTile { id: string; name: string; sub: string; Icon: LucideIcon; status: string; nav?: string; href?: string; }

/** Resolve a store id (recent/pinned) into a tile descriptor for rendering. */
function resolveTile(id: string): ResolvedTile {
  const hit = TILE_BY_ID[id];
  if (hit) {
    return { id, name: hit.name, sub: hit.sub, Icon: hit.Icon, status: hit.status, nav: hit.nav, href: hit.href };
  }
  const name = SEC_LABELS[id] ?? titleize(id);
  // An id that looks like a path is treated as an href; otherwise a nav target.
  const isHref = id.startsWith("/") || id.startsWith("http");
  return { id, name, sub: "Open", Icon: AppWindow, status: "Saved", nav: isHref ? undefined : id, href: isHref ? id : undefined };
}

const DAYS = [
  "SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY",
];
const MONTHS = [
  "JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE",
  "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER",
];

// Shared glass-material strings. Blur + dark-fill alpha are driven by CSS vars
// so the global appearance sliders (--frost / --glass-op) can retune the look
// later without touching this file. Each reads a sensible fallback.
const GLASS_BG =
  "linear-gradient(140deg, rgba(24,22,38,var(--glass-op,0.20)), rgba(8,6,16,calc(var(--glass-op,0.20) * 0.8)))";
const GLASS_BLUR = "blur(var(--frost,2px)) saturate(150%) brightness(1.04)";
const GLASS_BORDER = "1px solid rgba(255,255,255,0.14)";
const GLASS_INSET =
  "inset 1.4px 1.4px 0 rgba(255,255,255,0.30), inset -1px -2px 4px rgba(255,255,255,0.06)";

// ─── Night-sky starfields (two parallax/twinkle layers) ──────────────────────
// Tiled SVG dots; the layers twinkle at different rates so individual stars
// appear to fade in and out independently. Pure CSS, no JS per-frame cost.
const STAR_S =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='420' height='420'><g fill='%23ffffff'><circle cx='30' cy='44' r='0.9' opacity='0.85'/><circle cx='98' cy='20' r='0.6' opacity='0.6'/><circle cx='154' cy='88' r='1' opacity='0.9'/><circle cx='214' cy='38' r='0.7' opacity='0.7'/><circle cx='276' cy='112' r='0.8' opacity='0.75'/><circle cx='338' cy='58' r='0.6' opacity='0.55'/><circle cx='398' cy='128' r='1' opacity='0.85'/><circle cx='62' cy='142' r='0.7' opacity='0.65'/><circle cx='122' cy='182' r='0.9' opacity='0.8'/><circle cx='192' cy='150' r='0.6' opacity='0.5'/><circle cx='252' cy='202' r='1' opacity='0.85'/><circle cx='312' cy='172' r='0.7' opacity='0.6'/><circle cx='366' cy='232' r='0.8' opacity='0.7'/><circle cx='42' cy='250' r='1' opacity='0.8'/><circle cx='104' cy='300' r='0.7' opacity='0.6'/><circle cx='172' cy='272' r='0.9' opacity='0.75'/><circle cx='234' cy='332' r='0.6' opacity='0.55'/><circle cx='292' cy='292' r='1' opacity='0.85'/><circle cx='352' cy='342' r='0.8' opacity='0.7'/><circle cx='30' cy='362' r='0.7' opacity='0.6'/><circle cx='142' cy='366' r='0.9' opacity='0.8'/><circle cx='208' cy='396' r='0.6' opacity='0.5'/><circle cx='392' cy='384' r='0.9' opacity='0.75'/><circle cx='72' cy='208' r='0.5' opacity='0.45'/></g></svg>\")";
const STAR_L =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='720' height='720'><circle cx='80' cy='120' r='1.4' fill='%23ffffff' opacity='0.85'/><circle cx='300' cy='80' r='1.2' fill='%23cdbdf2' opacity='0.7'/><circle cx='520' cy='200' r='1.5' fill='%23ffffff' opacity='0.9'/><circle cx='640' cy='110' r='1.1' fill='%23ffffff' opacity='0.6'/><circle cx='180' cy='300' r='1.3' fill='%23bcd6f2' opacity='0.75'/><circle cx='430' cy='350' r='1.4' fill='%23ffffff' opacity='0.8'/><circle cx='600' cy='420' r='1.2' fill='%23ffffff' opacity='0.65'/><circle cx='120' cy='510' r='1.5' fill='%23cdbdf2' opacity='0.85'/><circle cx='350' cy='560' r='1.2' fill='%23ffffff' opacity='0.7'/><circle cx='560' cy='600' r='1.4' fill='%23ffffff' opacity='0.8'/><circle cx='680' cy='650' r='1.1' fill='%23bcd6f2' opacity='0.6'/><circle cx='250' cy='680' r='1.3' fill='%23ffffff' opacity='0.75'/></svg>\")";

// ─── Night-sky backdrop (full-viewport, fixed) ───────────────────────────────
// Mounted as a viewport sibling (next to the Clarity GlassBackdrop) so the sky +
// stars stretch edge-to-edge behind the whole window, not just the padded
// content column. Deep base + crown color-bleed, two twinkling/drifting star
// layers, two staggered shooting stars, and a bottom vignette.
const SKY_CSS = `
@keyframes gdSkyDrift { 0% { transform: translate3d(0,0,0) scale(1); } 50% { transform: translate3d(2.5%,-2%,0) scale(1.06); } 100% { transform: translate3d(-2%,2.5%,0) scale(1.03); } }
@keyframes gdSkySwirl { to { transform: rotate(360deg); } }
@keyframes gdTwinkle { 0%,100% { opacity: .32; } 50% { opacity: .85; } }
@keyframes gdTwinkle2 { 0%,100% { opacity: .6; } 50% { opacity: .24; } }
@keyframes gdStarDrift { 0% { transform: translate3d(0,0,0); } 100% { transform: translate3d(-2%,1.6%,0); } }
@keyframes gdShoot {
  0%, 4% { opacity: 0; transform: translate3d(-12vw,-8vh,0) rotate(20deg) scaleX(.7); }
  6% { opacity: 1; }
  11% { opacity: 1; transform: translate3d(34vw,18vh,0) rotate(20deg) scaleX(1); }
  14%, 100% { opacity: 0; transform: translate3d(40vw,21vh,0) rotate(20deg) scaleX(1); }
}
@keyframes gdShoot2 {
  0%, 3% { opacity: 0; transform: translate3d(8vw,-10vh,0) rotate(28deg) scaleX(.7); }
  5% { opacity: 1; }
  10% { opacity: 1; transform: translate3d(44vw,12vh,0) rotate(28deg) scaleX(1); }
  13%, 100% { opacity: 0; transform: translate3d(50vw,15vh,0) rotate(28deg) scaleX(1); }
}
.gd-stars { background-repeat: repeat; background-size: 420px 420px; animation: gdTwinkle 5s ease-in-out infinite, gdStarDrift 90s linear infinite alternate; }
.gd-stars2 { background-repeat: repeat; background-size: 720px 720px; animation: gdTwinkle2 7.5s ease-in-out infinite, gdStarDrift 130s linear infinite alternate-reverse; }
.gd-shoot { position: absolute; top: 9%; left: 6%; width: 170px; height: 2px; border-radius: 2px; background: linear-gradient(90deg, transparent, rgba(255,255,255,.85) 88%, #fff 100%); filter: drop-shadow(0 0 6px rgba(255,255,255,.85)) drop-shadow(0 0 14px rgba(170,200,255,.5)); opacity: 0; transform: rotate(20deg); animation: gdShoot 11s ease-in 2.5s infinite; }
.gd-shoot2 { top: 5%; left: 36%; width: 130px; animation: gdShoot2 14s ease-in 8s infinite; }
@media (prefers-reduced-motion: reduce) { .gd-stars, .gd-stars2 { animation: none !important; } .gd-shoot, .gd-shoot2 { animation: none !important; opacity: 0 !important; } }
`;

// ─── Shared gd-tile with pin + long-hold-remove ─────────────────────────────
// One tile renderer used by every shelf (system + the dynamic Recently/Favorites
// shelves) so the pin affordance behaves identically everywhere:
//   • heart top-right — visible on hover or when pinned; filled accent = pinned.
//     click toggles the pin and never navigates.
//   • long-hold 2000ms — enters a per-tile "remove" state (red ✕ badge); ✕ removes
//     the pin. a quick tap still navigates (longFired ref suppresses the click).
function GdTile({
  id, name, sub, Icon, status, ring, badge, isHref, pinned, owner, onActivate,
}: {
  id: string;
  name: string;
  sub: string;
  Icon: LucideIcon;
  status: string;
  ring: string;
  badge?: "new" | "akash";
  isHref?: boolean;
  pinned: boolean;
  owner: string;
  onActivate: () => void;
}) {
  const [removing, setRemoving] = useState(false);
  const holdTimer = useRef<number | null>(null);
  const longFired = useRef(false);

  function clearHold() {
    if (holdTimer.current !== null) {
      window.clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
  }
  function onPointerDown() {
    longFired.current = false;
    clearHold();
    holdTimer.current = window.setTimeout(() => {
      longFired.current = true;
      setRemoving(true);
    }, 2000);
  }
  function onClick() {
    // Suppress the click that follows a long-press (it already entered remove mode).
    if (longFired.current) {
      longFired.current = false;
      return;
    }
    onActivate();
  }

  return (
    <div
      className="gd-tile lglass glow gd-pinhost"
      onClick={onClick}
      onPointerDown={onPointerDown}
      onPointerUp={clearHold}
      onPointerCancel={clearHold}
      onPointerLeave={() => { clearHold(); setRemoving(false); }}
      title={isHref ? name + " — opens in a new tab" : name}
      style={{ background: GLASS_BG, border: GLASS_BORDER, boxShadow: GLASS_INSET + ", 0 18px 44px rgba(0,0,0,0.42)", ["--lgac" as string]: ring } as CSSProperties}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = ring + "66"; e.currentTarget.style.boxShadow = GLASS_INSET + `, 0 24px 44px -16px ${ring}55, 0 18px 44px rgba(0,0,0,0.5)`; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.14)"; e.currentTarget.style.boxShadow = GLASS_INSET + ", 0 18px 44px rgba(0,0,0,0.42)"; }}
    >
      <span style={{ position: "absolute", top: 0, left: 14, right: 14, height: 2, borderRadius: 2, background: `linear-gradient(90deg, transparent, ${ring}, transparent)`, opacity: 0.55 }} />

      {/* Pin heart (top-right) — hidden until hover unless pinned. */}
      <button
        type="button"
        className="gd-heart"
        aria-label={pinned ? "Unpin" : "Pin"}
        aria-pressed={pinned}
        onClick={(e) => { e.stopPropagation(); longFired.current = false; togglePin(owner, id); }}
        onPointerDown={(e) => e.stopPropagation()}
        style={{
          position: "absolute", top: 8, right: 8, width: 26, height: 26, borderRadius: 8,
          display: "grid", placeItems: "center", flex: "none", cursor: "pointer", padding: 0, zIndex: 3,
          border: pinned ? `1px solid ${ring}66` : "1px solid rgba(255,255,255,0.12)",
          background: pinned ? `color-mix(in srgb, ${ring} 22%, transparent)` : "rgba(10,8,18,0.45)",
          color: pinned ? ring : D.txm,
          opacity: pinned ? 1 : 0,
          transition: "opacity .2s, background .2s, border-color .2s",
        }}
      >
        <Heart size={14} strokeWidth={2} fill={pinned ? ring : "none"} />
      </button>

      {/* Long-hold remove badge (red ✕) — appears once the 2s hold fires. */}
      {removing && (
        <button
          type="button"
          aria-label="Remove pin"
          onClick={(e) => { e.stopPropagation(); removePin(owner, id); setRemoving(false); }}
          onPointerDown={(e) => e.stopPropagation()}
          style={{
            position: "absolute", top: 8, right: 8, width: 26, height: 26, borderRadius: 8,
            display: "grid", placeItems: "center", flex: "none", cursor: "pointer", padding: 0, zIndex: 4,
            border: `1px solid ${D.crimson}88`, background: `color-mix(in srgb, ${D.crimson} 30%, rgba(10,8,18,0.7))`,
            color: "#fff", boxShadow: `0 0 0 3px ${D.crimson}33`,
          }}
        >
          <X size={14} strokeWidth={2.6} />
        </button>
      )}

      <div style={{ display: "flex", alignItems: "flex-start", gap: 11 }}>
        <span style={{ width: 34, height: 34, borderRadius: 10, display: "grid", placeItems: "center", flex: "none", background: `radial-gradient(70% 70% at 50% 28%, ${ring}33, rgba(255,255,255,0.04) 72%)`, border: `1px solid ${ring}44`, color: ring }}>
          <Icon size={17} strokeWidth={1.8} />
        </span>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, paddingRight: 24 }}>
            <span style={{ fontFamily: gf, fontWeight: 600, fontSize: 15, color: D.tx, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{name}</span>
            {badge === "new" && <span style={{ fontFamily: mn, fontSize: 7.5, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: "#fff", background: ring, borderRadius: 5, padding: "2px 5px" }}>new</span>}
            {badge === "akash" && <span style={{ fontFamily: mn, fontSize: 7.5, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: ring, border: `1px solid ${ring}66`, borderRadius: 5, padding: "2px 5px" }}>akash</span>}
          </div>
          <div style={{ fontFamily: ft, fontSize: 12, color: D.txm, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{sub}</div>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 13 }}>
        <span style={{ width: 6, height: 6, borderRadius: "50%", flex: "none", background: ring, boxShadow: `0 0 6px ${ring}` }} />
        <span style={{ fontFamily: mn, fontSize: 10, letterSpacing: "0.04em", color: D.txm }}>{status}</span>
      </div>
    </div>
  );
}

export function DepthBackdrop() {
  return (
    <div aria-hidden style={{ position: "fixed", inset: 0, zIndex: 0, overflow: "hidden", pointerEvents: "none" }}>
      <style dangerouslySetInnerHTML={{ __html: SKY_CSS }} />
      {/* deep base + crown color bleed */}
      <div
        style={{
          position: "absolute",
          inset: "-20%",
          background:
            "radial-gradient(72% 42% at 50% -10%, rgba(144,92,203,0.34), transparent 62%)," +
            "radial-gradient(50% 30% at 16% -2%, rgba(11,134,209,0.22), transparent 64%)," +
            "radial-gradient(52% 32% at 86% 2%, rgba(38,201,216,0.18), transparent 66%)," +
            "radial-gradient(40% 26% at 50% 4%, rgba(209,51,74,0.10), transparent 62%)," +
            "linear-gradient(180deg, #0a0818 0%, #08060f 46%, #050409 78%, #030208 100%)",
          filter: "saturate(1.05)",
          animation: "gdSkyDrift 40s ease-in-out infinite alternate",
        }}
      />
      {/* faint aurora swirl near the crown */}
      <div
        style={{
          position: "absolute",
          inset: "-20%",
          mixBlendMode: "screen",
          opacity: 0.32,
          background:
            "conic-gradient(from 200deg at 38% 14%, rgba(38,201,216,0), rgba(144,92,203,0.14), rgba(38,201,216,0) 48%)",
          filter: "blur(54px)",
          animation: "gdSkySwirl 48s linear infinite",
        }}
      />
      {/* twinkling starfields (slightly oversized so the drift never bares an edge) */}
      <div className="gd-stars" style={{ position: "absolute", inset: "-8%", backgroundImage: STAR_S }} />
      <div className="gd-stars2" style={{ position: "absolute", inset: "-8%", backgroundImage: STAR_L }} />
      {/* shooting stars */}
      <div className="gd-shoot" />
      <div className="gd-shoot gd-shoot2" />
      {/* bottom vignette toward deep space */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "linear-gradient(180deg, rgba(5,4,9,0) 38%, rgba(5,4,9,0.42) 76%, rgba(3,2,8,0.8) 100%)",
        }}
      />
    </div>
  );
}

export default function GlassDepthHome({
  onNavigate,
  userName,
  allow,
  akash,
}: {
  onNavigate: (id: string) => void;
  userName: string;
  // When set (analyst), restrict every shelf + pins/recent to these ids.
  allow?: string[];
  // Akash-only tools (e.g. the in-progress Carousel 2.0 studio) show only when true.
  akash?: boolean;
}) {
  const permits = (id: string): boolean => !allow || allow.includes(id);
  const [now, setNow] = useState<Date>(() => new Date());

  // Live clock — re-render every second, tearing the interval down on unmount.
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(t);
  }, []);

  // Site-wide home organization: this user's recent + pinned ids, live-updating.
  // Analyst gate (allow) trims both lists to permitted tools.
  const hp = useHomePrefs(userName);
  const pins = hp.pins.filter(permits);
  const recent = hp.recent.filter(permits);

  let hours = now.getHours();
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12;
  if (hours === 0) hours = 12;
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const dateLine = `${DAYS[now.getDay()]} · ${MONTHS[now.getMonth()]} ${now.getDate()} · ${now.getFullYear()}`;

  const firstName = (userName || "").trim().split(/\s+/)[0] || "there";

  const shelvesRef = useRef<HTMLDivElement | null>(null);
  function toShelves() {
    if (shelvesRef.current) shelvesRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  function goTile(t: ShelfTile) {
    if (t.href) window.open(t.href, "_blank");
    else if (t.nav) onNavigate(t.nav);
  }
  function goResolved(r: ResolvedTile) {
    if (r.href) window.open(r.href, "_blank");
    else if (r.nav) onNavigate(r.nav);
  }

  // ── Dynamic shelves (Recently used → Favorites), built from the store ──
  // "Recently used" renders only when non-empty; "Favorites" always renders.
  const recentTiles = recent.map(resolveTile);
  const favoriteTiles = pins.map(resolveTile);
  const RECENT_RING = "#E8E6EE";
  const FAV_RING = D.amber;

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        isolation: "isolate",
        overflow: "hidden",
      }}
    >
      <style
        dangerouslySetInnerHTML={{
          __html: `
@keyframes gdHomeRise { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
/* Cue rise — preserves the translateX(-50%) centering the generic gdHomeRise would clobber. */
@keyframes gdCueRise { from { opacity: 0; transform: translate(-50%, 16px); } to { opacity: 1; transform: translate(-50%, 0); } }
@keyframes gdHomeBlink { 0%, 49% { opacity: 1; } 50%, 100% { opacity: 0.32; } }
.gd-track { display: flex; gap: 14px; overflow-x: auto; overflow-y: hidden; padding: 6px 2px 12px; scroll-behavior: smooth; scrollbar-width: none; -webkit-mask-image: linear-gradient(90deg, transparent, #000 2.5%, #000 97.5%, transparent); mask-image: linear-gradient(90deg, transparent, #000 2.5%, #000 97.5%, transparent); }
.gd-track::-webkit-scrollbar { display: none; }
.gd-tile { position: relative; flex: 0 0 auto; width: 236px; min-height: 120px; border-radius: 18px; padding: 15px 16px 14px; text-align: left; cursor: pointer; overflow: hidden; transition: transform .26s cubic-bezier(.2,.7,.3,1), border-color .26s, box-shadow .26s; }
.gd-tile:hover { transform: translateY(-5px); }
/* Pin heart: hidden until hover; stays visible when pinned (inline opacity:1 wins). */
.gd-pinhost:hover .gd-heart { opacity: 1 !important; }
.gd-heart:hover { filter: brightness(1.18); }
.gd-cue { display: flex; flex-direction: column; align-items: center; gap: 8px; cursor: pointer; }
.gd-mouse { width: 22px; height: 34px; border-radius: 12px; border: 1.5px solid rgba(255,255,255,.32); position: relative; }
.gd-mouse::before { content: ''; position: absolute; top: 6px; left: 50%; width: 3px; height: 6px; border-radius: 2px; background: #B98BE6; transform: translateX(-50%); animation: gdMouse 1.7s ease-in-out infinite; }
@keyframes gdMouse { 0% { opacity: 0; transform: translate(-50%, 0); } 30% { opacity: 1; } 65% { opacity: 1; transform: translate(-50%, 9px); } 100% { opacity: 0; transform: translate(-50%, 11px); } }
.gd-chev { animation: gdBob 1.7s ease-in-out infinite; }
@keyframes gdBob { 0%,100% { transform: translateY(0); } 50% { transform: translateY(5px); } }
@media (prefers-reduced-motion: reduce) { .gd-mouse::before, .gd-chev { animation: none !important; } }
`,
        }}
      />

      {/* ════ HERO ════ */}
      <section
        style={{
          position: "relative",
          zIndex: 0,
          // Fill the viewport exactly (84px contentTop sits above the hero) so on
          // first paint only the hero text shows; "Today's shelves" sits below the fold.
          minHeight: "calc(100vh - 84px)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          padding: "44px 16px 78px",
        }}
      >

      {/* ── Eyebrow ─────────────────────────────────────────────────────── */}
      <div
        style={{
          fontFamily: mn,
          fontSize: 12,
          letterSpacing: "0.32em",
          textTransform: "uppercase",
          color: D.txd,
          marginBottom: 22,
          opacity: 0,
          animation: "gdHomeRise 0.9s cubic-bezier(.2,.7,.3,1) 0.1s forwards",
        }}
      >
        POAST
      </div>

      {/* ── Live clock ──────────────────────────────────────────────────── */}
      <div
        style={{
          fontFamily: gf,
          fontWeight: 300,
          fontSize: "clamp(88px, 14vw, 200px)",
          lineHeight: 0.9,
          letterSpacing: "-0.04em",
          display: "flex",
          alignItems: "baseline",
          justifyContent: "center",
          gap: "0.02em",
          background: "linear-gradient(180deg, #FFFDF8, #C9C4BC 80%)",
          WebkitBackgroundClip: "text",
          backgroundClip: "text",
          color: "transparent",
          opacity: 0,
          animation: "gdHomeRise 1s cubic-bezier(.2,.7,.3,1) 0.16s forwards",
        }}
      >
        {hours}
        <span style={{ animation: "gdHomeBlink 2s steps(1) infinite" }}>:</span>
        {minutes}
        <span
          style={{
            fontSize: "0.26em",
            fontWeight: 400,
            letterSpacing: "0.06em",
            color: D.txm,
            WebkitTextFillColor: D.txm,
            marginLeft: "0.18em",
            transform: "translateY(-0.55em)",
          }}
        >
          {ampm}
        </span>
      </div>

      {/* ── Date line ───────────────────────────────────────────────────── */}
      <div
        style={{
          fontFamily: mn,
          fontSize: 13,
          color: D.txm,
          letterSpacing: "0.2em",
          textTransform: "uppercase",
          marginTop: 18,
          opacity: 0,
          animation: "gdHomeRise 1s cubic-bezier(.2,.7,.3,1) 0.3s forwards",
        }}
      >
        {dateLine}
      </div>

      {/* ── Greeting ────────────────────────────────────────────────────── */}
      <h1
        style={{
          fontFamily: gf,
          fontWeight: 400,
          fontSize: "clamp(30px, 4vw, 46px)",
          lineHeight: 1.05,
          letterSpacing: "-0.02em",
          margin: "36px 0 0",
          color: D.tx,
          opacity: 0,
          animation: "gdHomeRise 1s cubic-bezier(.2,.7,.3,1) 0.42s forwards",
        }}
      >
        Welcome back, <b style={{ color: D.violet, fontWeight: 500 }}>{firstName}.</b>
      </h1>
      <p
        style={{
          marginTop: 14,
          fontFamily: ft,
          fontWeight: 300,
          fontSize: "clamp(15px, 1.4vw, 18px)",
          color: D.txm,
          letterSpacing: "0.01em",
          maxWidth: "44ch",
          lineHeight: 1.6,
          opacity: 0,
          animation: "gdHomeRise 1s cubic-bezier(.2,.7,.3,1) 0.52s forwards",
        }}
      >
        Your command center is ready — a calm glance at everything in motion, just below.
      </p>

      {/* ── Contextual stat pills ───────────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          gap: 12,
          marginTop: 34,
          flexWrap: "wrap",
          justifyContent: "center",
          opacity: 0,
          animation: "gdHomeRise 1s cubic-bezier(.2,.7,.3,1) 0.62s forwards",
        }}
      >
        {STATS.map((s) => {
          const SIcon = s.Icon;
          return (
            <div
              key={s.label}
              className="lglass"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 11,
                padding: "11px 17px 11px 13px",
                borderRadius: 14,
                background: GLASS_BG,
                border: GLASS_BORDER,
                boxShadow: GLASS_INSET + ", 0 16px 40px rgba(0,0,0,0.4)",
              }}
            >
              <span
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 9,
                  display: "grid",
                  placeItems: "center",
                  flex: "none",
                  background: `radial-gradient(70% 70% at 50% 28%, ${s.accent}33, rgba(255,255,255,0.04) 72%)`,
                  border: `1px solid ${s.accent}44`,
                  color: s.accent,
                }}
              >
                <SIcon size={16} strokeWidth={1.9} />
              </span>
              <span style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                <span style={{ fontFamily: gf, fontWeight: 700, fontSize: 19, color: D.tx, lineHeight: 1 }}>{s.value}</span>
                <span style={{ fontFamily: ft, fontSize: 12.5, color: D.txm }}>{s.label}</span>
              </span>
            </div>
          );
        })}
      </div>

      {/* ── Scroll cue ──────────────────────────────────────────────────── */}
      <div
        className="gd-cue"
        onClick={toShelves}
        style={{ position: "absolute", left: "50%", bottom: 18, transform: "translateX(-50%)", opacity: 0, animation: "gdCueRise 1s ease 1.1s forwards" }}
      >
        <div className="gd-mouse" />
        <ChevronDown className="gd-chev" size={16} color={D.txd} />
        <span style={{ fontFamily: mn, fontSize: 9.5, letterSpacing: "0.22em", textTransform: "uppercase", color: D.txd }}>
          Scroll for your shelves
        </span>
      </div>
      </section>

      {/* ════ TODAY'S SHELVES ════ */}
      <section
        ref={shelvesRef}
        style={{ position: "relative", zIndex: 0, width: "100%", maxWidth: 1320, margin: "0 auto", padding: "6px clamp(16px,5vw,64px) 52px" }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 22 }}>
          <span style={{ fontFamily: mn, fontSize: 11, letterSpacing: "0.26em", textTransform: "uppercase", color: D.txm }}>Today&apos;s shelves</span>
          <span style={{ flex: 1, height: 1, background: "linear-gradient(90deg, rgba(255,255,255,.14), transparent)" }} />
        </div>

        {/* ── Recently used (dynamic) — only when non-empty ── */}
        {recentTiles.length > 0 && (
          <div style={{ marginBottom: 30 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 13, padding: "0 2px", flexWrap: "wrap" }}>
              <span style={{ width: 30, height: 30, borderRadius: 9, display: "grid", placeItems: "center", flex: "none", background: `color-mix(in srgb, ${RECENT_RING} 18%, transparent)`, border: `1px solid ${RECENT_RING}55`, color: RECENT_RING }}>
                <History size={15} strokeWidth={1.9} />
              </span>
              <span style={{ fontFamily: gf, fontWeight: 700, fontSize: 16, color: D.tx }}>Recently used</span>
              <span style={{ fontFamily: mn, fontSize: 8.5, letterSpacing: "0.12em", textTransform: "uppercase", color: RECENT_RING, border: `1px solid ${RECENT_RING}44`, borderRadius: 6, padding: "3px 7px" }}>this device</span>
              <span style={{ fontFamily: ft, fontSize: 12.5, color: D.txd, marginLeft: 2 }}>Your latest, most-recent first</span>
            </div>
            <div className="gd-track">
              {recentTiles.map((r) => (
                <GdTile
                  key={"recent-" + r.id}
                  id={r.id} name={r.name} sub={r.sub} Icon={r.Icon} status={r.status}
                  ring={RECENT_RING} isHref={!!r.href} owner={userName}
                  pinned={isPinned(userName, r.id)}
                  onActivate={() => goResolved(r)}
                />
              ))}
            </div>
          </div>
        )}

        {/* ── Favorites (dynamic) — always shown, with empty hint ── */}
        <div style={{ marginBottom: 30 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 13, padding: "0 2px", flexWrap: "wrap" }}>
            <span style={{ width: 30, height: 30, borderRadius: 9, display: "grid", placeItems: "center", flex: "none", background: `color-mix(in srgb, ${FAV_RING} 18%, transparent)`, border: `1px solid ${FAV_RING}55`, color: FAV_RING }}>
              <Star size={15} strokeWidth={1.9} />
            </span>
            <span style={{ fontFamily: gf, fontWeight: 700, fontSize: 16, color: D.tx }}>Favorites</span>
            <span style={{ fontFamily: mn, fontSize: 8.5, letterSpacing: "0.12em", textTransform: "uppercase", color: FAV_RING, border: `1px solid ${FAV_RING}44`, borderRadius: 6, padding: "3px 7px" }}>pinned</span>
            <span style={{ fontFamily: ft, fontSize: 12.5, color: D.txd, marginLeft: 2 }}>Set from your home · unique to you</span>
          </div>
          {favoriteTiles.length > 0 ? (
            <div className="gd-track">
              {favoriteTiles.map((r) => (
                <GdTile
                  key={"fav-" + r.id}
                  id={r.id} name={r.name} sub={r.sub} Icon={r.Icon} status={r.status}
                  ring={FAV_RING} isHref={!!r.href} owner={userName}
                  pinned
                  onActivate={() => goResolved(r)}
                />
              ))}
            </div>
          ) : (
            <div className="gd-track">
              <div
                className="gd-tile"
                title="Pin apps from any shelf"
                style={{ display: "grid", placeItems: "center", cursor: "default", border: "1px dashed rgba(255,255,255,0.2)", background: "rgba(255,255,255,0.02)" }}
              >
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, color: D.txm, textAlign: "center", padding: "0 10px" }}>
                  <Heart size={20} strokeWidth={1.8} />
                  <span style={{ fontFamily: mn, fontSize: 9.5, letterSpacing: "0.16em", textTransform: "uppercase" }}>Pin apps from any shelf</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {SHELVES.map((shelf) => {
          const SIcon = shelf.Icon;
          const tiles = shelf.tiles.filter((t) => permits(tileId(t)) && (!t.akashOnly || akash));
          if (tiles.length === 0) return null; // drop a category emptied by the gate
          return (
            <div key={shelf.key} style={{ marginBottom: 30 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 13, padding: "0 2px", flexWrap: "wrap" }}>
                <span style={{ width: 30, height: 30, borderRadius: 9, display: "grid", placeItems: "center", flex: "none", background: `color-mix(in srgb, ${shelf.ring} 18%, transparent)`, border: `1px solid ${shelf.ring}55`, color: shelf.ring }}>
                  <SIcon size={15} strokeWidth={1.9} />
                </span>
                <span style={{ fontFamily: gf, fontWeight: 700, fontSize: 16, color: D.tx }}>{shelf.label}</span>
                <span style={{ fontFamily: mn, fontSize: 8.5, letterSpacing: "0.12em", textTransform: "uppercase", color: shelf.ring, border: `1px solid ${shelf.ring}44`, borderRadius: 6, padding: "3px 7px" }}>{shelf.count}</span>
                <span style={{ fontFamily: ft, fontSize: 12.5, color: D.txd, marginLeft: 2 }}>{shelf.desc}</span>
              </div>

              <div className="gd-track">
                {tiles.map((t) => {
                  const id = tileId(t);
                  return (
                    <GdTile
                      key={t.name}
                      id={id} name={t.name} sub={t.sub} Icon={t.Icon} status={t.status}
                      ring={shelf.ring} badge={t.badge} isHref={!!t.href} owner={userName}
                      pinned={isPinned(userName, id)}
                      onActivate={() => goTile(t)}
                    />
                  );
                })}

                {shelf.ghost && (
                  <div
                    className="gd-tile"
                    onClick={() => onNavigate("assets")}
                    title="Pin an app"
                    style={{ display: "grid", placeItems: "center", border: "1px dashed rgba(255,255,255,0.2)", background: "rgba(255,255,255,0.02)" }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.42)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.2)"; }}
                  >
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, color: D.txm }}>
                      <Plus size={20} strokeWidth={1.8} />
                      <span style={{ fontFamily: mn, fontSize: 9.5, letterSpacing: "0.18em", textTransform: "uppercase" }}>Pin an app</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        <div style={{ textAlign: "center", marginTop: 6, fontFamily: ft, fontSize: 12.5, color: D.txd }}>
          Swipe a shelf to glance across each category
        </div>
      </section>
    </div>
  );
}
