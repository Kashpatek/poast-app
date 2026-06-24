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

// ─── Night-sky starfields (two parallax/twinkle layers) ──────────────────────
// Tiled SVG dots; the layers twinkle at different rates so individual stars
// appear to fade in and out independently. Pure CSS, no JS per-frame cost.
const STAR_S =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='420' height='420'><g fill='%23ffffff'><circle cx='30' cy='44' r='0.9' opacity='0.85'/><circle cx='98' cy='20' r='0.6' opacity='0.6'/><circle cx='154' cy='88' r='1' opacity='0.9'/><circle cx='214' cy='38' r='0.7' opacity='0.7'/><circle cx='276' cy='112' r='0.8' opacity='0.75'/><circle cx='338' cy='58' r='0.6' opacity='0.55'/><circle cx='398' cy='128' r='1' opacity='0.85'/><circle cx='62' cy='142' r='0.7' opacity='0.65'/><circle cx='122' cy='182' r='0.9' opacity='0.8'/><circle cx='192' cy='150' r='0.6' opacity='0.5'/><circle cx='252' cy='202' r='1' opacity='0.85'/><circle cx='312' cy='172' r='0.7' opacity='0.6'/><circle cx='366' cy='232' r='0.8' opacity='0.7'/><circle cx='42' cy='250' r='1' opacity='0.8'/><circle cx='104' cy='300' r='0.7' opacity='0.6'/><circle cx='172' cy='272' r='0.9' opacity='0.75'/><circle cx='234' cy='332' r='0.6' opacity='0.55'/><circle cx='292' cy='292' r='1' opacity='0.85'/><circle cx='352' cy='342' r='0.8' opacity='0.7'/><circle cx='30' cy='362' r='0.7' opacity='0.6'/><circle cx='142' cy='366' r='0.9' opacity='0.8'/><circle cx='208' cy='396' r='0.6' opacity='0.5'/><circle cx='392' cy='384' r='0.9' opacity='0.75'/><circle cx='72' cy='208' r='0.5' opacity='0.45'/></g></svg>\")";
const STAR_L =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='720' height='720'><circle cx='80' cy='120' r='1.4' fill='%23ffffff' opacity='0.85'/><circle cx='300' cy='80' r='1.2' fill='%23cdbdf2' opacity='0.7'/><circle cx='520' cy='200' r='1.5' fill='%23ffffff' opacity='0.9'/><circle cx='640' cy='110' r='1.1' fill='%23ffffff' opacity='0.6'/><circle cx='180' cy='300' r='1.3' fill='%23bcd6f2' opacity='0.75'/><circle cx='430' cy='350' r='1.4' fill='%23ffffff' opacity='0.8'/><circle cx='600' cy='420' r='1.2' fill='%23ffffff' opacity='0.65'/><circle cx='120' cy='510' r='1.5' fill='%23cdbdf2' opacity='0.85'/><circle cx='350' cy='560' r='1.2' fill='%23ffffff' opacity='0.7'/><circle cx='560' cy='600' r='1.4' fill='%23ffffff' opacity='0.8'/><circle cx='680' cy='650' r='1.1' fill='%23bcd6f2' opacity='0.6'/><circle cx='250' cy='680' r='1.3' fill='%23ffffff' opacity='0.75'/></svg>\")";

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
@media (prefers-reduced-motion: reduce) { .gd-shoot, .gd-shoot2 { animation: none !important; opacity: 0 !important; } }
`,
        }}
      />

      {/* ── Night sky ───────────────────────────────────────────────────────
          Deep dark base with the color bleed concentrated toward the TOP
          (violet crown + blue/teal corners), darkening to near-black below.
          Stars twinkle in/out via two layers; shooting stars streak past. */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: "-20%",
          zIndex: -3,
          background:
            "radial-gradient(72% 42% at 50% -10%, rgba(144,92,203,0.34), transparent 62%)," +
            "radial-gradient(50% 30% at 16% -2%, rgba(11,134,209,0.22), transparent 64%)," +
            "radial-gradient(52% 32% at 86% 2%, rgba(38,201,216,0.18), transparent 66%)," +
            "radial-gradient(40% 26% at 50% 4%, rgba(209,51,74,0.10), transparent 62%)," +
            "linear-gradient(180deg, #0a0818 0%, #08060f 46%, #050409 78%, #030208 100%)",
          filter: "saturate(1.05)",
          animation: "gdHomeDrift 40s ease-in-out infinite alternate",
          pointerEvents: "none",
        }}
      />
      {/* slow swirl of faint aurora near the crown */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: "-20%",
          zIndex: -2,
          mixBlendMode: "screen",
          opacity: 0.32,
          background:
            "conic-gradient(from 200deg at 38% 14%, rgba(38,201,216,0), rgba(144,92,203,0.14), rgba(38,201,216,0) 48%)",
          filter: "blur(54px)",
          animation: "gdHomeSwirl 48s linear infinite",
          pointerEvents: "none",
        }}
      />
      {/* starfields */}
      <div className="gd-stars" aria-hidden style={{ position: "absolute", inset: 0, zIndex: -2, backgroundImage: STAR_S, pointerEvents: "none" }} />
      <div className="gd-stars2" aria-hidden style={{ position: "absolute", inset: 0, zIndex: -2, backgroundImage: STAR_L, pointerEvents: "none" }} />
      {/* shooting stars — staggered cycles read as "random every ~10s" */}
      <div className="gd-shoot" aria-hidden />
      <div className="gd-shoot gd-shoot2" aria-hidden />
      {/* bottom vignette toward deep space */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          zIndex: -1,
          background:
            "linear-gradient(180deg, rgba(5,4,9,0) 38%, rgba(5,4,9,0.42) 76%, rgba(3,2,8,0.8) 100%)",
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
