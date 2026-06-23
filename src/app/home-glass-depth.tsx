"use client";

import { useEffect, useState } from "react";
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
  type LucideIcon,
} from "lucide-react";
import { D, ft, gf, mn } from "./shared-constants";

// ─── Tool model ──────────────────────────────────────────────────────────────
// The full roster lives here; the ambient home surfaces a focused row of the
// most-used five (those without an href open in-app via onNavigate; the rest
// open in a new tab). Each carries its own accent so the glass pills read
// "cosmic" rather than monochrome.
interface Tool {
  id: string;
  label: string;
  Icon: LucideIcon;
  accent: string;
  href?: string;
}

const ALL_TOOLS: Tool[] = [
  { id: "sloptop", label: "Slop Top", Icon: Zap, accent: D.amber },
  { id: "carousel", label: "Carousel", Icon: LayoutGrid, accent: D.violet },
  { id: "captions", label: "Capper", Icon: Captions, accent: D.cyan },
  { id: "weekly", label: "SA Weekly", Icon: Radio, accent: D.coral },
  { id: "fk", label: "Fab Knowledge", Icon: Headphones, accent: D.teal },
  { id: "chart2", label: "POAST Studio", Icon: GanttChart, accent: D.amber, href: "/charts" },
  { id: "news", label: "News Flow", Icon: Newspaper, accent: D.blue },
  { id: "intelligence-suite", label: "Intelligence", Icon: Brain, accent: D.teal, href: "/intelligence-suite" },
  { id: "p2p", label: "Press to Premier", Icon: Clapperboard, accent: D.violet },
  { id: "broll", label: "B-Roll", Icon: Film, accent: D.coral },
  { id: "copy-studio", label: "CopySTUDIO", Icon: Type, accent: D.cyan, href: "/copy-studio" },
  { id: "assets", label: "Asset Library", Icon: Library, accent: D.blue },
];

// The five quick-access tiles shown in the ambient row.
const QUICK_IDS = ["sloptop", "carousel", "captions", "weekly", "intelligence-suite"];
const QUICK_TOOLS: Tool[] = QUICK_IDS
  .map((id) => ALL_TOOLS.find((t) => t.id === id))
  .filter((t): t is Tool => Boolean(t));

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

export default function GlassDepthHome({
  onNavigate,
  userName,
}: {
  onNavigate: (id: string) => void;
  userName: string;
}) {
  const [now, setNow] = useState<Date>(() => new Date());

  // Live clock — re-render every second, tearing the interval down on unmount.
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(t);
  }, []);

  let hours = now.getHours();
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12;
  if (hours === 0) hours = 12;
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const dateLine = `${DAYS[now.getDay()]} · ${MONTHS[now.getMonth()]} ${now.getDate()} · ${now.getFullYear()}`;

  const firstName = (userName || "").trim().split(/\s+/)[0] || "there";

  function openTool(tool: Tool) {
    if (tool.href) {
      window.open(tool.href, "_blank");
    } else {
      onNavigate(tool.id);
    }
  }

  return (
    <div
      style={{
        position: "relative",
        minHeight: "calc(100vh - 96px)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        padding: "72px 0 80px",
        isolation: "isolate",
        overflow: "hidden",
      }}
    >
      <style
        dangerouslySetInnerHTML={{
          __html: `
@keyframes gdHomeRise { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
@keyframes gdHomeBlink { 0%, 49% { opacity: 1; } 50%, 100% { opacity: 0.32; } }
@keyframes gdHomeDrift { 0% { transform: translate3d(0,0,0) scale(1); } 50% { transform: translate3d(2.5%,-2%,0) scale(1.06); } 100% { transform: translate3d(-2%,2.5%,0) scale(1.03); } }
@keyframes gdHomeSwirl { to { transform: rotate(360deg); } }
`,
        }}
      />

      {/* ── Ambient cosmic background ───────────────────────────────────────
          Rendered by the component but kept translucent so the page backdrop
          still shows through. Reads darker / deeper than the clarity home. */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: "-20%",
          zIndex: -3,
          background:
            "radial-gradient(48% 55% at 18% 6%, rgba(144,92,203,0.40), transparent 70%)," +
            "radial-gradient(44% 52% at 88% 12%, rgba(11,134,209,0.32), transparent 72%)," +
            "radial-gradient(52% 58% at 72% 96%, rgba(38,201,216,0.20), transparent 70%)," +
            "radial-gradient(40% 45% at 6% 90%, rgba(209,51,74,0.18), transparent 72%)",
          filter: "saturate(1.06)",
          animation: "gdHomeDrift 28s ease-in-out infinite alternate",
          pointerEvents: "none",
        }}
      />
      {/* swirling aurora accent */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: "-20%",
          zIndex: -2,
          mixBlendMode: "screen",
          opacity: 0.45,
          background:
            "conic-gradient(from 200deg at 30% 28%, rgba(38,201,216,0), rgba(38,201,216,0.16), rgba(144,92,203,0) 45%)",
          filter: "blur(46px)",
          animation: "gdHomeSwirl 36s linear infinite",
          pointerEvents: "none",
        }}
      />
      {/* warm crown + bottom vignette toward deep space */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          zIndex: -1,
          background:
            "radial-gradient(60% 42% at 50% -10%, rgba(247,176,65,0.08), transparent 60%)," +
            "linear-gradient(180deg, rgba(6,6,12,0) 30%, rgba(6,6,12,0.34) 72%, rgba(6,6,12,0.72) 100%)",
          pointerEvents: "none",
        }}
      />

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
        Your command center is ready — a calm glance at everything in motion.
      </p>

      {/* ── Quick-access glass pills ────────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          gap: 14,
          marginTop: 38,
          flexWrap: "wrap",
          justifyContent: "center",
          opacity: 0,
          animation: "gdHomeRise 1s cubic-bezier(.2,.7,.3,1) 0.62s forwards",
        }}
      >
        {QUICK_TOOLS.map((tool) => {
          const Icon = tool.Icon;
          return (
            <button
              key={tool.id}
              type="button"
              onClick={() => openTool(tool)}
              title={tool.label}
              style={{
                position: "relative",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 11,
                width: 124,
                padding: "18px 14px 16px",
                borderRadius: 18,
                cursor: "pointer",
                background: GLASS_BG,
                backdropFilter: GLASS_BLUR,
                WebkitBackdropFilter: GLASS_BLUR,
                border: GLASS_BORDER,
                boxShadow: GLASS_INSET + ", 0 22px 52px rgba(0,0,0,0.45)",
                color: D.tx,
                transition:
                  "transform .26s cubic-bezier(.2,.7,.3,1), border-color .26s, box-shadow .26s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-6px)";
                e.currentTarget.style.borderColor = "rgba(255,255,255,0.26)";
                e.currentTarget.style.boxShadow =
                  GLASS_INSET +
                  `, 0 26px 46px -18px ${tool.accent}55, 0 22px 52px rgba(0,0,0,0.5)`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.borderColor = "rgba(255,255,255,0.14)";
                e.currentTarget.style.boxShadow =
                  GLASS_INSET + ", 0 22px 52px rgba(0,0,0,0.45)";
              }}
            >
              <span
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 13,
                  display: "grid",
                  placeItems: "center",
                  background: `radial-gradient(70% 70% at 50% 28%, ${tool.accent}33, rgba(255,255,255,0.04) 72%)`,
                  border: `1px solid ${tool.accent}40`,
                  color: tool.accent,
                }}
              >
                <Icon size={21} strokeWidth={1.7} />
              </span>
              <span
                style={{
                  fontFamily: gf,
                  fontWeight: 600,
                  fontSize: 12.5,
                  letterSpacing: "0.005em",
                  lineHeight: 1.15,
                  color: D.tx,
                }}
              >
                {tool.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
