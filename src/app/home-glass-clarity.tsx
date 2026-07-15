"use client";

import React from "react";
import {
  LayoutGrid,
  Layers,
  Radio,
  Headphones,
  GanttChart,
  Brain,
  Clapperboard,
  Type,
  Library,
  Sparkles,
  Compass,
  ArrowDown,
  Star,
  History,
  Wand2,
  Wand,
  Lightbulb,
  Send,
  Activity,
  Calendar,
  Rocket,
  CheckSquare,
  Settings,
  ShieldCheck,
  Plus,
  Heart,
  X,
  type LucideIcon,
} from "lucide-react";
import { D, ft, gf, mn } from "./shared-constants";
import { useHomePrefs, togglePin, removePin, isPinned } from "./home-prefs";

// ─── Tool catalog ───────────────────────────────────────────────────────────
// id · label · lucide Icon · subtitle · optional href (opens a new tab)
interface Tool {
  id: string;
  label: string;
  Icon: LucideIcon;
  sub: string;
  href?: string;
}

// Every id below matches a SidebarCat item id in poast-client.tsx so onNavigate
// (in-hub) and href (new tab) routing line up with the real workspace.
const TOOLS: Record<string, Tool> = {
  // ── Produce ──
  "production-studio": { id: "production-studio", label: "ProductionSTUDIO", Icon: Clapperboard, sub: "Full post suite", href: "/production-studio" },
  brainstorm: { id: "brainstorm", label: "Brainstorm", Icon: Lightbulb, sub: "Ideas & angles" },
  carousel: { id: "carousel", label: "Carousel", Icon: LayoutGrid, sub: "Instagram carousels" },
  "carousel-neu": { id: "carousel-neu", label: "CarouselNEU", Icon: Layers, sub: "Foundry wizard · 4 modes", href: "/carousel-2" },
  chart: { id: "chart", label: "ChartMAKER", Icon: GanttChart, sub: "Quick charts", href: "/charts" },
  docu: { id: "docu", label: "DesignSTUDIO", Icon: Wand, sub: "Docs · graphics · motion", href: "/design-studio" },
  "copy-studio": { id: "copy-studio", label: "CopySTUDIO", Icon: Type, sub: "Draft · voice · headline", href: "/copy-studio" },
  assets: { id: "assets", label: "Asset Library", Icon: Library, sub: "Brand library" },
  // ── Podcast ──
  fk: { id: "fk", label: "Fab Knowledge", Icon: Headphones, sub: "Deep interview brain" },
  weekly: { id: "weekly", label: "SA Weekly", Icon: Radio, sub: "Episode pipeline" },
  outreach: { id: "outreach", label: "Outreach", Icon: Send, sub: "Cold email + lists" },
  // ── Prepare ──
  "intelligence-suite": { id: "intelligence-suite", label: "IntelligenceSUITE", Icon: Brain, sub: "Signals & research", href: "/intelligence-suite" },
  gtc: { id: "gtc", label: "GTC Flow", Icon: Activity, sub: "Conference ops" },
  // ── Premier ──
  schedule: { id: "schedule", label: "Schedule", Icon: Calendar, sub: "Launch calendar", href: "https://brianna-bhakta.vercel.app/" },
  // ── Admin ──
  "marketing-suite": { id: "marketing-suite", label: "MarketingSUITE", Icon: Rocket, sub: "The cockpit", href: "/marketing-suite" },
  training: { id: "training", label: "AI Training", Icon: Brain, sub: "Brand voice", href: "/ai-training" },
  tasks: { id: "tasks", label: "Task Board", Icon: CheckSquare, sub: "Master queue" },
  settings: { id: "settings", label: "POAST Settings", Icon: Settings, sub: "Workspace config" },
};

// ─── Section grouping (mirrors the mockup's .thead + .tgrid sections) ────────
interface Section {
  cap: string;
  subcap: string;
  cc: string; // section accent (the colored .dot)
  HeadIcon: LucideIcon;
  ids: string[];
}

// System sections only. "Favorites" and "Recently used" are now derived live
// from the per-user pins/recent store (see useHomePrefs) and prepended at render.
const SECTIONS: Section[] = [
  {
    cap: "Produce",
    subcap: "Make the content",
    cc: D.amber,
    HeadIcon: Wand2,
    ids: ["production-studio", "brainstorm", "carousel", "carousel-neu", "chart", "docu", "copy-studio", "assets"],
  },
  {
    cap: "Podcast",
    subcap: "SA Weekly + FK",
    cc: D.coral,
    HeadIcon: Radio,
    ids: ["fk", "weekly", "outreach"],
  },
  {
    cap: "Prepare",
    subcap: "Research & signals",
    cc: D.blue,
    HeadIcon: Brain,
    ids: ["intelligence-suite", "gtc"],
  },
  {
    cap: "Premier",
    subcap: "Launch & rollout",
    cc: D.violet,
    HeadIcon: Rocket,
    ids: ["schedule", "outreach"],
  },
  {
    cap: "Admin",
    subcap: "Workspace",
    cc: D.teal,
    HeadIcon: ShieldCheck,
    ids: ["marketing-suite", "training", "tasks", "settings"],
  },
];

// Sentinel id for the mockup's "Pin an app" ghost placeholder tile (Favorites).
const GHOST_ID = "__ghost__";

// ─── Fallback labels for hub-only ids (not in TOOLS) ─────────────────────────
// recent/pins can reference sections that live only inside the hub sidebar and
// have no catalog tile. We render a graceful fallback tile for those, using a
// friendly label when known and a titleized id otherwise.
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
  distpack: "Distribution Pack",
  perf: "Performance",
  approval: "Approvals",
  prompts: "Saved Prompts",
};

// dashes → spaces, capitalize each word (used when an id has no SEC_LABELS entry)
function titleize(id: string): string {
  return id
    .split(/[-_]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

// Resolve any id to a Tool: the catalog entry if present, else a Sparkles
// fallback so dynamic Recently-used / Favorites lists never break.
function toolFor(id: string): Tool {
  return (
    TOOLS[id] ?? {
      id,
      label: SEC_LABELS[id] ?? titleize(id),
      Icon: Sparkles,
      sub: "",
    }
  );
}

// A rendered section: head meta + a resolved list of tools to grid.
interface RenderSection {
  cap: string;
  subcap: string;
  cc: string;
  HeadIcon: LucideIcon;
  tools: Tool[];
  ghost?: boolean; // Favorites appends the "Pin an app" ghost tile
}

// ─── Glass material (CSS-only — backdrop blur + white top-inset highlight) ───
// Blur reads --frost, dark fill alpha reads --glass-op so the global appearance
// sliders can drive both later via the page-level CSS vars.
const glassSurface: React.CSSProperties = {
  background:
    "linear-gradient(140deg, rgba(24,22,38,var(--glass-op,0.18)), rgba(8,6,16,calc(var(--glass-op,0.18) * 0.8)))",
  backdropFilter: "blur(var(--frost,2px)) saturate(150%) brightness(1.04)",
  WebkitBackdropFilter: "blur(var(--frost,2px)) saturate(150%) brightness(1.04)",
  border: "1px solid rgba(255,255,255,0.14)",
  boxShadow:
    "inset 1.4px 1.4px 0 rgba(255,255,255,0.29), inset -1px -2px 4px rgba(255,255,255,0.058), 0 22px 52px rgba(0,0,0,0.45)",
};

function scrollToTools(): void {
  if (typeof document === "undefined") return;
  const el = document.getElementById("gc-tools");
  if (el) el.scrollIntoView({ behavior: "smooth" });
}

function Tile({
  tool,
  owner,
  onNavigate,
}: {
  tool: Tool;
  owner: string;
  onNavigate: (id: string) => void;
}): React.ReactElement {
  const { Icon } = tool;
  const [hover, setHover] = React.useState(false);
  const [removing, setRemoving] = React.useState(false);
  // isPinned reads the store directly; useHomePrefs in the parent re-renders the
  // whole home on any pin change, so this stays in sync without local state.
  const pinned = isPinned(owner, tool.id);

  // Long-hold-to-remove: a 2s pointer hold enters "remove" mode (red ✕ badge).
  // longFired suppresses the click that fires after a long press so the hold
  // never navigates; a quick tap still navigates normally.
  const holdTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const longFired = React.useRef(false);

  const clearHold = (): void => {
    if (holdTimer.current) {
      clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
  };

  const click = (): void => {
    // Swallow the click that trails a long-press, then reset the flag.
    if (longFired.current) {
      longFired.current = false;
      return;
    }
    if (tool.href) window.open(tool.href, "_blank");
    else onNavigate(tool.id);
  };

  const onPointerDown = (): void => {
    longFired.current = false;
    clearHold();
    holdTimer.current = setTimeout(() => {
      longFired.current = true;
      setRemoving(true);
    }, 2000);
  };

  const togglePinClick = (e: React.MouseEvent): void => {
    e.stopPropagation();
    e.preventDefault();
    togglePin(owner, tool.id);
  };

  const removeClick = (e: React.MouseEvent): void => {
    e.stopPropagation();
    e.preventDefault();
    removePin(owner, tool.id);
    setRemoving(false);
  };

  const heartShown = hover || pinned;

  return (
    <div
      className="gc-tile lglass glow"
      role="button"
      tabIndex={0}
      onClick={click}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          click();
        }
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => {
        setHover(false);
        clearHold();
        setRemoving(false);
      }}
      onFocus={() => setHover(true)}
      onBlur={() => setHover(false)}
      onPointerDown={onPointerDown}
      onPointerUp={clearHold}
      onPointerCancel={clearHold}
      style={{
        ...glassSurface,
        backdropFilter: undefined,
        WebkitBackdropFilter: undefined,
        position: "relative",
        borderRadius: 26,
        padding: 20,
        cursor: "pointer",
        minHeight: 150,
        display: "flex",
        flexDirection: "column",
        transition: "transform .24s cubic-bezier(.2,.85,.25,1), box-shadow .24s",
        transform: hover ? "translateY(-5px) scale(1.013)" : "none",
      }}
    >
      {/* Heart pin toggle — top-right. Shown on hover/focus or when pinned. */}
      {heartShown && !removing && (
        <button
          type="button"
          aria-label={pinned ? "Unpin from Favorites" : "Pin to Favorites"}
          aria-pressed={pinned}
          onClick={togglePinClick}
          onPointerDown={(e) => e.stopPropagation()}
          style={{
            position: "absolute",
            top: 12,
            right: 12,
            width: 30,
            height: 30,
            borderRadius: 999,
            display: "grid",
            placeItems: "center",
            cursor: "pointer",
            border: pinned
              ? `1px solid color-mix(in srgb, ${D.amber} 55%, transparent)`
              : "1px solid rgba(255,255,255,0.22)",
            background: pinned
              ? `color-mix(in srgb, ${D.amber} 22%, rgba(255,255,255,0.05))`
              : "rgba(255,255,255,0.06)",
            color: pinned ? D.amber : "rgba(244,241,236,0.7)",
            boxShadow: pinned
              ? `0 0 14px color-mix(in srgb, ${D.amber} 32%, transparent)`
              : "none",
            transition: "transform .18s, background .18s, color .18s",
          }}
        >
          <Heart
            size={15}
            strokeWidth={pinned ? 2 : 1.7}
            fill={pinned ? D.amber : "none"}
          />
        </button>
      )}

      {/* Long-hold remove badge — red circular ✕ over the tile. */}
      {removing && (
        <button
          type="button"
          aria-label="Remove pin"
          onClick={removeClick}
          onPointerDown={(e) => e.stopPropagation()}
          className="gc-removebadge"
          style={{
            position: "absolute",
            top: 12,
            right: 12,
            width: 32,
            height: 32,
            borderRadius: 999,
            display: "grid",
            placeItems: "center",
            cursor: "pointer",
            border: `1px solid color-mix(in srgb, ${D.crimson} 60%, transparent)`,
            background: `color-mix(in srgb, ${D.crimson} 82%, rgba(0,0,0,0.2))`,
            color: "#fff",
            boxShadow: `0 0 18px color-mix(in srgb, ${D.crimson} 50%, transparent)`,
          }}
        >
          <X size={17} strokeWidth={2.4} />
        </button>
      )}

      <div
        style={{
          width: 50,
          height: 50,
          borderRadius: 15,
          display: "grid",
          placeItems: "center",
          color: "#fff",
          marginBottom: "auto",
          background: "rgba(255,255,255,0.14)",
          border: "1px solid rgba(255,255,255,0.22)",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.4)",
        }}
      >
        <Icon size={24} strokeWidth={1.7} />
      </div>
      <div style={{ fontFamily: gf, fontWeight: 700, fontSize: 17, letterSpacing: "-0.2px", marginTop: 18, color: D.tx }}>
        {tool.label}
      </div>
      <div style={{ fontFamily: ft, fontSize: 12.5, color: "rgba(244,241,236,0.66)", marginTop: 4, lineHeight: 1.4 }}>
        {tool.sub}
      </div>
    </div>
  );
}

// Mirrors the mockup's .ghosttile — a dashed "Pin an app" placeholder. Inert
// (no navigation); kept deliberately minimal so it never competes with a Tile.
function GhostTile(): React.ReactElement {
  return (
    <div
      style={{
        borderRadius: 26,
        padding: 20,
        minHeight: 150,
        display: "grid",
        placeItems: "center",
        gap: 8,
        border: "1.5px dashed rgba(255,255,255,0.22)",
        background: "rgba(255,255,255,0.02)",
        color: "rgba(244,241,236,0.5)",
      }}
    >
      <Plus size={22} strokeWidth={1.8} />
      <span style={{ fontFamily: ft, fontSize: 13, fontWeight: 500 }}>Pin an app</span>
    </div>
  );
}

function SectionHead({
  section,
}: {
  section: { cap: string; subcap: string; cc: string; HeadIcon: LucideIcon };
}): React.ReactElement {
  const { HeadIcon } = section;
  const cc = section.cc;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "0 4px 18px" }}>
      <span
        style={{
          width: 30,
          height: 30,
          borderRadius: 9,
          display: "grid",
          placeItems: "center",
          flex: "none",
          color: cc,
          background: `color-mix(in srgb, ${cc} 18%, rgba(255,255,255,0.05))`,
          border: `1px solid color-mix(in srgb, ${cc} 42%, transparent)`,
          boxShadow: `0 0 16px color-mix(in srgb, ${cc} 28%, transparent), inset 0 1px 0 rgba(255,255,255,0.28)`,
        }}
      >
        <HeadIcon size={16} strokeWidth={1.9} />
      </span>
      <span
        style={{
          fontFamily: gf,
          fontWeight: 700,
          fontSize: 19,
          letterSpacing: "-0.3px",
          color: `color-mix(in srgb, ${cc} 64%, #fff)`,
          textShadow: `0 0 18px color-mix(in srgb, ${cc} 42%, transparent)`,
        }}
      >
        {section.cap}
      </span>
      <span
        style={{
          fontFamily: mn,
          fontSize: 10,
          letterSpacing: "1.8px",
          textTransform: "uppercase",
          color: "rgba(244,241,236,0.42)",
        }}
      >
        {section.subcap}
      </span>
      <span style={{ flex: 1, height: 1, background: "linear-gradient(90deg,rgba(255,255,255,0.18),transparent)" }} />
    </div>
  );
}

export default function GlassClarityHome({
  onNavigate,
  userName,
  allow,
  akash,
}: {
  onNavigate: (id: string) => void;
  userName: string;
  // When set (analyst), restrict every shelf + pins/recent to these ids so a
  // locked-down role never sees a tool it can't open. Undefined = no limit.
  allow?: string[];
  // Akash-only tools (e.g. the in-progress Carousel 2.0 studio) show only when true.
  akash?: boolean;
}): React.ReactElement {
  const firstName = (userName || "").trim().split(/\s+/)[0] || "there";
  const AKASH_ONLY = new Set(["carousel-neu", "tasks"]);
  const permits = (id: string): boolean => (!allow || allow.includes(id)) && (!AKASH_ONLY.has(id) || !!akash);

  // Live per-user organization. Any pin/recent change re-renders this home,
  // so Favorites + Recently used update in place.
  const owner = userName;
  const hp = useHomePrefs(owner);
  const pins = hp.pins.filter(permits);
  const recent = hp.recent.filter(permits);

  // Build the ordered section list:
  //   (a) Recently used — most-recent first; only if non-empty
  //   (b) Favorites      — pin order; always shown, ends with the ghost tile
  //   (c) the 5 system sections, in their declared order (analyst-filtered)
  const ordered: RenderSection[] = [];

  if (recent.length > 0) {
    ordered.push({
      cap: "Recently used",
      subcap: "Most recent first",
      cc: D.violet,
      HeadIcon: History,
      tools: recent.map(toolFor),
    });
  }

  ordered.push({
    cap: "Favorites",
    subcap: "Pin the tools you live in",
    cc: D.amber,
    HeadIcon: Star,
    tools: pins.map(toolFor),
    ghost: true,
  });

  for (const s of SECTIONS) {
    const tools = s.ids.filter((id) => id !== GHOST_ID && permits(id)).map(toolFor);
    if (tools.length === 0) continue; // drop a category that empties under the gate
    ordered.push({
      cap: s.cap,
      subcap: s.subcap,
      cc: s.cc,
      HeadIcon: s.HeadIcon,
      tools,
    });
  }

  return (
    <div style={{ position: "relative", maxWidth: 1180, margin: "0 auto", padding: "8px 0 70px", color: D.tx }}>
      <style
        dangerouslySetInnerHTML={{
          __html: `
@keyframes gcShine { to { background-position: 220% center; } }
@keyframes gcBob { 50% { transform: translateY(5px); } }
@keyframes gcShake {
  0% { transform: scale(1) rotate(0deg); }
  20% { transform: scale(1.12) rotate(-9deg); }
  40% { transform: scale(1.12) rotate(7deg); }
  60% { transform: scale(1.1) rotate(-5deg); }
  80% { transform: scale(1.1) rotate(4deg); }
  100% { transform: scale(1.1) rotate(0deg); }
}
.gc-removebadge { animation: gcShake .45s cubic-bezier(.36,.07,.19,.97) both; }
.gc-tile:focus-visible { outline: 2px solid rgba(255,255,255,0.5); outline-offset: 2px; }
@media (prefers-reduced-motion: reduce) {
  .gc-welcome, .gc-bob, .gc-removebadge { animation: none !important; }
}
`,
        }}
      />

      {/* ── Hero ── */}
      <section
        style={{
          // Fill the viewport exactly (84px contentTop + 8px container pad = 92px
          // above the hero) so on first paint only the hero + "Your tools" cue show;
          // the tool shelves sit just below the fold.
          minHeight: "calc(100vh - 92px)",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          position: "relative",
        }}
      >
        <span
          style={{
            fontFamily: mn,
            fontSize: 11,
            letterSpacing: "2.4px",
            textTransform: "uppercase",
            color: "#fff",
            opacity: 0.8,
            display: "inline-flex",
            alignItems: "center",
            gap: 11,
            marginBottom: 22,
          }}
        >
          <span style={{ width: 26, height: 1, background: "rgba(255,255,255,0.7)" }} />
          Admin workspace · SemiAnalysis
        </span>

        <h1
          className="gc-welcome"
          style={{
            fontFamily: gf,
            fontWeight: 700,
            fontSize: "clamp(52px,9.2vw,116px)",
            lineHeight: 0.9,
            letterSpacing: "-3.5px",
            margin: 0,
            background: "linear-gradient(108deg, #ffffff 14%, #e7c8ff 42%, #ffd0c4 64%, #ffffff 88%)",
            backgroundSize: "220% auto",
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            WebkitTextFillColor: "transparent",
            textShadow: "0 1px 40px rgba(160,107,224,0.25)",
            animation: "gcShine 8s linear infinite",
          }}
        >
          Welcome back,
          <br />
          {firstName}.
        </h1>

        <p
          style={{
            color: D.tx,
            opacity: 0.82,
            fontSize: "clamp(15px,1.7vw,19px)",
            lineHeight: 1.5,
            maxWidth: 540,
            margin: "26px 0 0",
          }}
        >
          Your command center is ready — light bends through every surface, your whole workspace floating a glance away.
        </p>

        <div style={{ display: "flex", gap: 13, alignItems: "center", marginTop: 34, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={scrollToTools}
            className="lglass glow"
            style={{
              ...glassSurface,
              backdropFilter: undefined,
              WebkitBackdropFilter: undefined,
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              fontFamily: ft,
              fontWeight: 600,
              fontSize: 15,
              color: "#fff",
              padding: "14px 22px",
              borderRadius: 15,
              cursor: "pointer",
              background: `linear-gradient(140deg, color-mix(in srgb, ${D.violet} 46%, rgba(255,255,255,0.10)), color-mix(in srgb, ${D.violet} 24%, rgba(255,255,255,0.04)))`,
              boxShadow: `inset 1.4px 1.4px 0 rgba(255,255,255,0.5), 0 18px 46px color-mix(in srgb, ${D.violet} 36%, transparent), 0 22px 52px rgba(0,0,0,0.4)`,
            }}
          >
            <Sparkles size={15} strokeWidth={2.2} /> Enter POAST 3.0
          </button>
          <a
            href="#gc-tools"
            onClick={(e) => {
              e.preventDefault();
              scrollToTools();
            }}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              fontFamily: ft,
              fontWeight: 500,
              fontSize: 14,
              color: "#fff",
              padding: "13px 20px",
              borderRadius: 14,
              cursor: "pointer",
              textDecoration: "none",
              border: "1px solid rgba(255,255,255,0.22)",
              background: "rgba(255,255,255,0.05)",
            }}
          >
            <Compass size={16} /> Take the tour
          </a>
        </div>

        <button
          type="button"
          onClick={scrollToTools}
          style={{
            position: "absolute",
            bottom: 6,
            left: 0,
            display: "inline-flex",
            alignItems: "center",
            gap: 11,
            background: "none",
            border: "none",
            cursor: "pointer",
            fontFamily: mn,
            fontSize: 10.5,
            letterSpacing: "1.6px",
            textTransform: "uppercase",
            color: "rgba(244,241,236,0.66)",
          }}
        >
          Your tools
          <span
            className="gc-bob"
            style={{
              display: "inline-grid",
              placeItems: "center",
              width: 30,
              height: 30,
              border: "1px solid rgba(255,255,255,0.25)",
              borderRadius: 999,
              animation: "gcBob 1.9s ease-in-out infinite",
            }}
          >
            <ArrowDown size={14} />
          </span>
        </button>
      </section>

      {/* ── Tool sections (dynamic: Recently used → Favorites → system) ── */}
      <div id="gc-tools">
        {ordered.map((section, i) => (
          <section key={section.cap} style={{ marginTop: i === 0 ? 6 : 30 }}>
            <SectionHead section={section} />
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))",
                gap: 16,
              }}
            >
              {section.tools.map((tool, j) => (
                <Tile key={`${tool.id}-${j}`} tool={tool} owner={owner} onNavigate={onNavigate} />
              ))}
              {section.ghost && <GhostTile key="ghost" />}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
