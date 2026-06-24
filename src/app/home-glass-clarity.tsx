"use client";

import React from "react";
import {
  Zap,
  LayoutGrid,
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
  Sparkles,
  Compass,
  ArrowDown,
  Star,
  History,
  Wand2,
  type LucideIcon,
} from "lucide-react";
import { D, ft, gf, mn } from "./shared-constants";

// ─── Tool catalog ───────────────────────────────────────────────────────────
// id · label · lucide Icon · subtitle · optional href (opens a new tab)
interface Tool {
  id: string;
  label: string;
  Icon: LucideIcon;
  sub: string;
  href?: string;
}

const TOOLS: Record<string, Tool> = {
  sloptop: { id: "sloptop", label: "Slop Top", Icon: Zap, sub: "Brief gen + arxiv.lol" },
  carousel: { id: "carousel", label: "Carousel", Icon: LayoutGrid, sub: "Instagram carousels" },
  captions: { id: "captions", label: "Capper", Icon: Captions, sub: "Captions per platform" },
  weekly: { id: "weekly", label: "SA Weekly", Icon: Radio, sub: "Episode pipeline" },
  fk: { id: "fk", label: "Fab Knowledge", Icon: Headphones, sub: "Deep interview brain" },
  chart2: { id: "chart2", label: "POAST Studio", Icon: GanttChart, sub: "Charts · tables · diagrams", href: "/charts" },
  news: { id: "news", label: "News Flow", Icon: Newspaper, sub: "Standup digest" },
  "intelligence-suite": { id: "intelligence-suite", label: "Intelligence", Icon: Brain, sub: "Signals & research", href: "/intelligence-suite" },
  p2p: { id: "p2p", label: "Press to Premier", Icon: Clapperboard, sub: "Launch rollouts" },
  broll: { id: "broll", label: "B-Roll", Icon: Film, sub: "Generated b-roll library" },
  "copy-studio": { id: "copy-studio", label: "CopySTUDIO", Icon: Type, sub: "Draft · voice · headline", href: "/copy-studio" },
  assets: { id: "assets", label: "Asset Library", Icon: Library, sub: "Brand library" },
};

// ─── Section grouping (mirrors the mockup's .thead + .tgrid sections) ────────
interface Section {
  cap: string;
  subcap: string;
  cc: string; // section accent (the colored .dot)
  HeadIcon: LucideIcon;
  ids: string[];
}

const SECTIONS: Section[] = [
  {
    cap: "Favorites",
    subcap: "Set from your home",
    cc: D.amber,
    HeadIcon: Star,
    ids: ["sloptop", "weekly", "chart2", "carousel"],
  },
  {
    cap: "Recently used",
    subcap: "This week · on this device",
    cc: D.violet,
    HeadIcon: History,
    ids: ["captions", "intelligence-suite", "p2p", "news"],
  },
  {
    cap: "All tools",
    subcap: "Everything in the workspace",
    cc: D.teal,
    HeadIcon: Wand2,
    ids: ["sloptop", "carousel", "captions", "weekly", "fk", "chart2", "news", "intelligence-suite", "p2p", "broll", "copy-studio", "assets"],
  },
];

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

function Tile({ tool, onNavigate }: { tool: Tool; onNavigate: (id: string) => void }): React.ReactElement {
  const { Icon } = tool;
  const [hover, setHover] = React.useState(false);
  const click = (): void => {
    if (tool.href) window.open(tool.href, "_blank");
    else onNavigate(tool.id);
  };
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
      onMouseLeave={() => setHover(false)}
      style={{
        ...glassSurface,
        backdropFilter: undefined,
        WebkitBackdropFilter: undefined,
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

function SectionHead({ section }: { section: Section }): React.ReactElement {
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
}: {
  onNavigate: (id: string) => void;
  userName: string;
}): React.ReactElement {
  const firstName = (userName || "").trim().split(/\s+/)[0] || "there";

  return (
    <div style={{ position: "relative", maxWidth: 1180, margin: "0 auto", padding: "8px 0 70px", color: D.tx }}>
      <style
        dangerouslySetInnerHTML={{
          __html: `
@keyframes gcShine { to { background-position: 220% center; } }
@keyframes gcBob { 50% { transform: translateY(5px); } }
.gc-tile:focus-visible { outline: 2px solid rgba(255,255,255,0.5); outline-offset: 2px; }
@media (prefers-reduced-motion: reduce) {
  .gc-welcome, .gc-bob { animation: none !important; }
}
`,
        }}
      />

      {/* ── Hero ── */}
      <section
        style={{
          minHeight: "calc(100vh - 160px)",
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

      {/* ── Tool sections ── */}
      <div id="gc-tools">
        {SECTIONS.map((section, i) => (
          <section key={section.cap} style={{ marginTop: i === 0 ? 6 : 30 }}>
            <SectionHead section={section} />
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))",
                gap: 16,
              }}
            >
              {section.ids.map((id, j) => {
                const tool = TOOLS[id];
                if (!tool) return null;
                return <Tile key={`${id}-${j}`} tool={tool} onNavigate={onNavigate} />;
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
