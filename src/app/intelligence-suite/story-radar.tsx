"use client";

// IntelligenceSUITE · Story Radar panel.
//
// Absorbs the standalone Trends tool into a tabbed surface:
//   - "Heating Up"  trends gaining traction
//   - "Dominant"    trends saturating the conversation
//   - "Cooling"     trends fading from the cycle
//
// v1 wraps src/app/trends.tsx whole — the tab pills are visual-only
// filters for now (no-op). Mock card decks per tab demonstrate the
// target card shape (sparkline + sources + SA coverage + angle +
// Generate Idea CTA). Generate Idea pushes to the output bus and
// fires a window CustomEvent the IdeationBoard panel listens for.

import { useState } from "react";
import { LineChart, Line, ResponsiveContainer } from "recharts";
import { D, ft, gf, mn } from "../shared-constants";
import { useStore } from "../lib/store";
import { showToast } from "../toast-context";
import Trends from "../trends";

// ─── Tab definitions ─────────────────────────────────────────────────

type RadarTab = "heating" | "dominant" | "cooling";

const TABS: { key: RadarTab; label: string; color: string }[] = [
  { key: "heating", label: "Heating Up", color: D.coral },
  { key: "dominant", label: "Dominant", color: D.amber },
  { key: "cooling", label: "Cooling", color: D.blue },
];

// ─── Mock card shape ─────────────────────────────────────────────────

interface RadarCard {
  topic: string;
  volume: number[];          // sparkline series, last N days
  sources: string[];         // top 3 sources covering this
  saLastCovered?: string;    // url to SemiAnalysis coverage, optional
  angle: string;             // recommended SA angle, one line
}

// TODO(phase-7C): swap MOCK_CARDS for real trend signals once the
// /api/trends-feed shape grows volume sparklines + SA coverage links.
const MOCK_CARDS: Record<RadarTab, RadarCard[]> = {
  heating: [
    { topic: "HBM4 yield ramp", volume: [4, 6, 9, 12, 18, 24, 31], sources: ["X / Patel", "DigiTimes", "Reuters"], angle: "Frame the SK Hynix vs Micron HBM4 yield gap as the H2 capex tell" },
    { topic: "TSMC A16 backside power", volume: [2, 3, 5, 7, 11, 14, 19], sources: ["Anandtech", "EE Times", "X / SemiVision"], angle: "Map A16 BSPDN adopters and what it does to N2 demand curves" },
    { topic: "Blackwell Ultra delays", volume: [3, 4, 8, 11, 15, 18, 22], sources: ["The Information", "X / Nanos", "Reuters"], saLastCovered: "https://semianalysis.com/blackwell-ultra-supply", angle: "Quantify hyperscaler reshuffling around the Ultra slip" },
  ],
  dominant: [
    { topic: "AI capex 2026 outlook", volume: [38, 41, 39, 42, 40, 41, 43], sources: ["WSJ", "Bloomberg", "FT"], saLastCovered: "https://semianalysis.com/ai-capex-2026", angle: "Cut through consensus with a bottoms-up tokenomics framing" },
    { topic: "Networking optics", volume: [29, 31, 30, 32, 31, 33, 32], sources: ["X / Quilici", "LightCounting", "SDxCentral"], angle: "1.6T optics inflection — link to copper-vs-optical inflection in Rubin racks" },
  ],
  cooling: [
    { topic: "On-device LLM hype", volume: [22, 19, 16, 13, 11, 9, 7], sources: ["The Verge", "Ars Technica", "X / random"], angle: "Post-mortem the on-device wave — what actually shipped vs promised" },
    { topic: "Crypto mining ASIC swing", volume: [14, 12, 10, 8, 7, 6, 5], sources: ["CoinDesk", "X / minerwatch", "Reuters"], angle: "Reframe ASIC overhang as latent AI inference capacity" },
  ],
};

// ─── Sparkline ───────────────────────────────────────────────────────

function Sparkline({ data, color }: { data: number[]; color: string }) {
  const series = data.map((v, i) => ({ i, v }));
  return (
    <div style={{ width: 120, height: 36, flexShrink: 0 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={series} margin={{ top: 4, right: 2, left: 2, bottom: 4 }}>
          <Line type="monotone" dataKey="v" stroke={color} strokeWidth={1.6} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Card ────────────────────────────────────────────────────────────

function RadarCardView({ card, accent }: { card: RadarCard; accent: string }) {
  const [hov, setHov] = useState(false);
  const pushOutput = useStore((s) => s.pushOutput);

  function generateIdea() {
    pushOutput({
      sourceTool: "story-radar",
      kind: "caption",
      payload: { topic: card.topic, angle: card.angle, sources: card.sources },
      preview: card.topic + " — " + card.angle,
    });
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("is-radar-to-ideation", { detail: { topic: card.topic, angle: card.angle, sources: card.sources } }));
    }
    showToast("Sent \"" + card.topic + "\" to Ideation Board", "success");
  }

  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: hov ? D.hover : D.card,
        border: "1px solid " + (hov ? accent + "40" : D.border),
        borderRadius: 12,
        padding: 16,
        display: "flex",
        flexDirection: "column",
        gap: 12,
        transition: "all 0.15s ease",
        transform: hov ? "translateY(-1px)" : "translateY(0)",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <div style={{ fontFamily: gf, fontSize: 16, fontWeight: 700, color: D.tx, lineHeight: 1.3 }}>{card.topic}</div>
        <Sparkline data={card.volume} color={accent} />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <div style={{ fontFamily: mn, fontSize: 9, color: D.txd, textTransform: "uppercase", letterSpacing: 1 }}>Top sources</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {card.sources.slice(0, 3).map((s, i) => (
            <span key={i} style={{ fontFamily: mn, fontSize: 10, color: D.txm, padding: "2px 8px", borderRadius: 8, background: D.surface, border: "1px solid " + D.border }}>{s}</span>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <span style={{ fontFamily: mn, fontSize: 9, color: D.txd, textTransform: "uppercase", letterSpacing: 1 }}>SA last covered</span>
        {card.saLastCovered ? (
          <a href={card.saLastCovered} target="_blank" rel="noopener noreferrer" style={{ fontFamily: mn, fontSize: 10, color: D.blue, textDecoration: "none" }}>view article</a>
        ) : (
          <span style={{ fontFamily: mn, fontSize: 10, color: D.txd }}>—</span>
        )}
      </div>

      <div style={{ fontFamily: ft, fontSize: 12, color: D.txm, lineHeight: 1.5, fontStyle: "italic" }}>{card.angle}</div>

      <button
        onClick={generateIdea}
        style={{
          fontFamily: mn,
          fontSize: 10,
          fontWeight: 700,
          color: accent,
          padding: "8px 14px",
          borderRadius: 8,
          border: "1px solid " + accent + "40",
          background: accent + "12",
          cursor: "pointer",
          textTransform: "uppercase",
          letterSpacing: 1,
          alignSelf: "flex-start",
        }}
      >
        Generate Idea
      </button>
    </div>
  );
}

// ─── Panel ───────────────────────────────────────────────────────────

export default function StoryRadarPanel() {
  const [tab, setTab] = useState<RadarTab>("heating");
  const activeMeta = TABS.find((t) => t.key === tab) || TABS[0];
  const cards = MOCK_CARDS[tab];

  return (
    <div style={{ minHeight: "100vh", background: D.bg, color: D.tx, fontFamily: ft }}>
      <div style={{ padding: "32px 24px 24px 24px" }}>
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontFamily: gf, fontSize: 28, fontWeight: 900, color: D.tx, letterSpacing: -0.5 }}>Story Radar</div>
          <div style={{ fontFamily: mn, fontSize: 10, color: D.txm, marginTop: 4 }}>
            IntelligenceSUITE // Topic momentum across the SemiAnalysis beat
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
          {TABS.map((t) => {
            const active = tab === t.key;
            return (
              <span
                key={t.key}
                onClick={() => setTab(t.key)}
                style={{
                  fontFamily: mn,
                  fontSize: 11,
                  fontWeight: active ? 700 : 500,
                  color: active ? t.color : D.txm,
                  padding: "6px 14px",
                  borderRadius: 20,
                  border: "1px solid " + (active ? t.color + "60" : D.border),
                  background: active ? t.color + "15" : "transparent",
                  cursor: "pointer",
                  userSelect: "none",
                  textTransform: "uppercase",
                  letterSpacing: 1,
                  transition: "all 0.15s ease",
                }}
              >
                {t.label}
              </span>
            );
          })}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 14 }}>
          {cards.map((c, i) => (
            <RadarCardView key={tab + "-" + i} card={c} accent={activeMeta.color} />
          ))}
        </div>

        {/* TODO(phase-7C): replace the wrapped <Trends /> view below once
            real per-tab data drives the Heating/Dominant/Cooling
            classifier — for now the legacy tool is embedded whole and
            the radar pills are no-op visual filters above it. */}
        <div style={{ marginTop: 36, paddingTop: 20, borderTop: "1px solid " + D.border }}>
          <div style={{ fontFamily: mn, fontSize: 10, color: D.txd, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>
            Raw signal feed
          </div>
          <Trends />
        </div>
      </div>
    </div>
  );
}
