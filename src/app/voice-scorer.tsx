"use client";

// Voice Scorer — paste any draft, get a 0-10 SA-on-brand score with a
// breakdown, list of violations, and concrete rewrite suggestions. The
// fastest way to catch boomer/AI captions before they ship.

import React, { useState, useRef, useMemo } from "react";
import DiffMatchPatch from "diff-match-patch";
import { D, ft, gf, mn } from "./shared-constants";
import { useShortcuts } from "./keyboard-shortcuts";

interface ScoreResult {
  score: number;
  breakdown?: { voice?: number; specificity?: number; directness?: number; platformFit?: number };
  violations?: string[];
  suggestions?: string[];
  topLine?: string;
}

const PLATFORMS = [
  { id: "any",       label: "Any" },
  { id: "x",         label: "X / Twitter" },
  { id: "linkedin",  label: "LinkedIn" },
  { id: "instagram", label: "Instagram" },
  { id: "tiktok",    label: "TikTok" },
  { id: "youtube",   label: "YouTube" },
  { id: "blog",      label: "Blog / Article" },
];

const RUBRIC: { name: string; max: number; measures: string; pass: string; fail: string }[] = [
  {
    name: "Voice",
    max: 3,
    measures: "No em dashes, emojis, hype words, or rhetorical throat-clearing.",
    pass: "TSMC N2 yields are tracking 6 months ahead of N3.",
    fail: "Let's dive into how AI is unleashing a revolutionary new era —",
  },
  {
    name: "Specificity",
    max: 3,
    measures: "Real numbers, named sources, and technical detail over vague claims.",
    pass: "H100 spot pricing fell 38% QoQ to $2.10/hr on CoreWeave.",
    fail: "GPU prices are coming down a lot lately.",
  },
  {
    name: "Directness",
    max: 2,
    measures: "Active voice, no filler adjectives, gets to the point in the first line.",
    pass: "Nvidia cut Blackwell allocations to two hyperscalers.",
    fail: "It's really worth noting that allocations may have been adjusted.",
  },
  {
    name: "Platform fit",
    max: 2,
    measures: "Follows platform-specific rules (no hashtags on X, link-in-comments on LinkedIn, etc.).",
    pass: "LinkedIn post ending with \"Link in comments.\"",
    fail: "X post stuffed with #AI #GPU #semiconductors.",
  },
];

export default function VoiceScorer() {
  const [text, setText] = useState("");
  const [platform, setPlatform] = useState("any");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ScoreResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [diffOpen, setDiffOpen] = useState(false);

  async function score() {
    if (!text.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/voice-scorer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: text.trim(), platform }),
      });
      const j = await res.json();
      if (!res.ok) {
        setError(j.error || "Score failed");
        return;
      }
      setResult(j as ScoreResult);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  // Tinykeys captures the handler at registration time; route through a ref
  // so the shortcut always calls the latest `score` closure.
  const scoreRef = useRef<(() => void) | undefined>(undefined);
  scoreRef.current = () => { score(); };
  useShortcuts({
    "$mod+Enter": { description: "Score draft", handler: () => { if (scoreRef.current) scoreRef.current(); } },
  }, { scope: "Voice Scorer" });

  const scoreColor = !result ? D.txm
    : result.score >= 8 ? D.teal
    : result.score >= 5 ? D.amber
    : D.coral;

  const topRewrite = result?.suggestions && result.suggestions[0] && result.suggestions[0].trim() ? result.suggestions[0] : "";
  const diffSegments = useMemo(() => {
    if (!topRewrite || !text.trim()) return null;
    const dmp = new DiffMatchPatch.diff_match_patch();
    const diffs = dmp.diff_main(text, topRewrite);
    dmp.diff_cleanupSemantic(diffs);
    return diffs;
  }, [text, topRewrite]);

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "40px 32px" }}>
      <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "4px 10px", borderRadius: 999, background: "rgba(247,176,65,0.10)", border: `1px solid ${D.amber}55`, marginBottom: 14 }}>
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: D.amber, boxShadow: `0 0 8px ${D.amber}` }} />
        <span style={{ fontFamily: mn, fontSize: 10, letterSpacing: 1.4, color: D.amber, textTransform: "uppercase" }}>Brand voice</span>
      </div>
      <h1 style={{ fontFamily: gf, fontSize: 38, fontWeight: 900, letterSpacing: -1, margin: 0, marginBottom: 8, color: D.tx }}>Voice Scorer</h1>
      <div style={{ fontFamily: ft, fontSize: 15, color: D.txm, maxWidth: 720, lineHeight: 1.5, marginBottom: 28 }}>
        Paste any draft. Get a 0-10 SA-on-brand score, what broke voice, and a concrete rewrite of the worst lines.
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: 18 }}>
        {/* Input */}
        <div>
          <div style={lbl}>Platform context</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
            {PLATFORMS.map((p) => {
              const active = platform === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPlatform(p.id)}
                  style={{
                    padding: "6px 12px",
                    background: active ? "rgba(247,176,65,0.10)" : "transparent",
                    border: `1px solid ${active ? D.amber : D.border}`,
                    borderRadius: 6,
                    color: D.tx,
                    cursor: "pointer",
                    fontFamily: mn,
                    fontSize: 11,
                    letterSpacing: 0.4,
                  }}
                >
                  {p.label}
                </button>
              );
            })}
          </div>

          <div style={lbl}>Draft</div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Paste a caption, headline, paragraph, or full post…"
            style={{
              width: "100%",
              minHeight: 260,
              padding: "14px 16px",
              background: D.surface,
              border: `1px solid ${D.border}`,
              borderRadius: 12,
              color: D.tx,
              fontFamily: ft,
              fontSize: 14,
              outline: "none",
              boxSizing: "border-box",
              resize: "vertical",
              lineHeight: 1.6,
            }}
          />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
            <div style={{ fontFamily: mn, fontSize: 10, color: D.txd, letterSpacing: 0.4 }}>
              {text.length.toLocaleString()} chars
            </div>
            <button
              type="button"
              onClick={score}
              disabled={loading || !text.trim()}
              style={{
                background: D.amber,
                color: "#060608",
                border: "none",
                padding: "10px 22px",
                borderRadius: 8,
                fontFamily: ft,
                fontSize: 13,
                fontWeight: 800,
                cursor: loading || !text.trim() ? "not-allowed" : "pointer",
                opacity: loading || !text.trim() ? 0.5 : 1,
              }}
            >
              {loading ? "Scoring…" : "Score it"}
            </button>
          </div>
          {error ? <div style={{ marginTop: 12, fontFamily: mn, fontSize: 11, color: D.coral }}>{error}</div> : null}
        </div>

        {/* Result */}
        <div style={{ background: D.surface, border: `1px solid ${D.border}`, borderRadius: 14, padding: 20, alignSelf: "start" }}>
          <div style={lbl}>SA voice score</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 14 }}>
            <div style={{ fontFamily: gf, fontSize: 64, fontWeight: 900, color: scoreColor, letterSpacing: -2, lineHeight: 1 }}>
              {result ? result.score : "—"}
            </div>
            <div style={{ fontFamily: mn, fontSize: 16, color: D.txm }}>/ 10</div>
          </div>

          {result?.topLine ? (
            <div style={{ fontFamily: ft, fontSize: 13, color: D.tx, lineHeight: 1.5, marginBottom: 18, padding: "10px 12px", background: scoreColor + "1c", border: `1px solid ${scoreColor}55`, borderRadius: 8 }}>
              {result.topLine}
            </div>
          ) : null}

          {result?.breakdown ? (
            <div style={{ marginBottom: 18 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <div style={{ ...lbl, marginBottom: 0 }}>Breakdown</div>
                <span
                  title={RUBRIC.map((r) => `${r.name} (/${r.max}) — ${r.measures}`).join(" · ")}
                  style={{ fontFamily: mn, fontSize: 10, letterSpacing: 0.4, color: D.txd, cursor: "help", border: `1px solid ${D.border}`, borderRadius: 999, padding: "2px 8px" }}
                >
                  ⓘ rubric
                </span>
              </div>
              <Bar label="Voice" value={result.breakdown.voice || 0} max={3} />
              <Bar label="Specificity" value={result.breakdown.specificity || 0} max={3} />
              <Bar label="Directness" value={result.breakdown.directness || 0} max={2} />
              <Bar label="Platform fit" value={result.breakdown.platformFit || 0} max={2} />
            </div>
          ) : null}

          {result?.violations && result.violations.length > 0 ? (
            <div style={{ marginBottom: 16 }}>
              <div style={lbl}>What broke voice</div>
              {result.violations.map((v, i) => (
                <div key={i} style={{ fontFamily: ft, fontSize: 12.5, color: D.tx, padding: "6px 10px", background: D.coral + "10", border: `1px solid ${D.coral}40`, borderRadius: 6, marginBottom: 4, lineHeight: 1.5 }}>
                  {v}
                </div>
              ))}
            </div>
          ) : null}

          {diffSegments && diffSegments.length > 0 ? (
            <div style={{ marginBottom: 16 }}>
              <button
                type="button"
                onClick={() => setDiffOpen((o) => !o)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  width: "100%",
                  padding: "8px 10px",
                  background: "transparent",
                  border: `1px solid ${D.border}`,
                  borderRadius: 6,
                  cursor: "pointer",
                  marginBottom: diffOpen ? 8 : 0,
                }}
              >
                <span style={{ ...lbl, marginBottom: 0 }}>Diff view · draft vs top suggestion</span>
                <span style={{ fontFamily: mn, fontSize: 10, color: D.txd }}>{diffOpen ? "−" : "+"}</span>
              </button>
              {diffOpen ? (
                <pre
                  style={{
                    margin: 0,
                    padding: "10px 12px",
                    background: D.bg,
                    border: `1px solid ${D.border}`,
                    borderRadius: 6,
                    fontFamily: ft,
                    fontSize: 14,
                    color: D.tx,
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                    lineHeight: 1.6,
                  }}
                >
                  {diffSegments.map((seg, i) => {
                    const op = seg[0];
                    const value = seg[1];
                    if (op === 0) {
                      return <span key={i} style={{ color: D.tx }}>{value}</span>;
                    }
                    if (op === -1) {
                      return (
                        <span key={i} style={{ color: D.coral, textDecoration: "line-through", opacity: 0.7 }}>
                          {value}
                        </span>
                      );
                    }
                    return (
                      <span key={i} style={{ color: D.teal, textDecoration: "underline", fontWeight: 600 }}>
                        {value}
                      </span>
                    );
                  })}
                </pre>
              ) : null}
            </div>
          ) : null}

          {result?.suggestions && result.suggestions.length > 0 ? (
            <div>
              <div style={lbl}>Rewrite suggestions</div>
              {result.suggestions.map((s, i) => (
                <div key={i} style={{ fontFamily: ft, fontSize: 12.5, color: D.tx, padding: "8px 10px", background: D.teal + "10", border: `1px solid ${D.teal}40`, borderRadius: 6, marginBottom: 4, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
                  {s}
                </div>
              ))}
            </div>
          ) : null}

          {!result && !loading ? (
            <div>
              <div style={lbl}>Rubric</div>
              <div style={{ fontFamily: ft, fontSize: 12, color: D.txd, lineHeight: 1.5, marginBottom: 12 }}>
                Score appears here. Try a recent caption you're unsure about.
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {RUBRIC.map((r) => (
                  <div
                    key={r.name}
                    style={{
                      padding: "10px 12px",
                      background: D.bg,
                      border: `1px solid ${D.border}`,
                      borderRadius: 8,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 4 }}>
                      <span style={{ fontFamily: ft, fontSize: 12, fontWeight: 700, color: D.tx }}>{r.name}</span>
                      <span style={{ fontFamily: mn, fontSize: 10, color: D.txd, letterSpacing: 0.4 }}>/ {r.max}</span>
                    </div>
                    <div style={{ fontFamily: ft, fontSize: 11.5, color: D.txm, lineHeight: 1.45, marginBottom: 6 }}>
                      {r.measures}
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                      <div style={{ fontFamily: mn, fontSize: 10.5, color: D.teal, lineHeight: 1.4 }}>
                        <span style={{ opacity: 0.7 }}>pass · </span>{r.pass}
                      </div>
                      <div style={{ fontFamily: mn, fontSize: 10.5, color: D.coral, lineHeight: 1.4 }}>
                        <span style={{ opacity: 0.7 }}>fail · </span>{r.fail}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Bar({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = (value / max) * 100;
  const color = pct >= 80 ? D.teal : pct >= 50 ? D.amber : D.coral;
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ fontFamily: ft, fontSize: 11, color: D.tx }}>{label}</span>
        <span style={{ fontFamily: mn, fontSize: 11, color: D.txm }}>{value} / {max}</span>
      </div>
      <div style={{ height: 4, background: D.border, borderRadius: 2, overflow: "hidden" }}>
        <div style={{ height: "100%", width: pct + "%", background: color, transition: "width 0.3s ease" }} />
      </div>
    </div>
  );
}

const lbl: React.CSSProperties = {
  fontFamily: mn,
  fontSize: 10,
  letterSpacing: 1.4,
  textTransform: "uppercase",
  color: D.txd,
  marginBottom: 8,
};
