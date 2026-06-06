"use client";

// Instant Analysis — a deterministic, retext-backed sibling to the LLM
// Voice Scorer. Renders as a stand-alone card with its own textarea so it
// can sit alongside the existing scorer without modifying its behavior.
// The same rubric axes (Voice / Specificity / Directness / Platform fit)
// are surfaced so a user can compare the two scores at a glance.

import React, { useEffect, useRef, useState } from "react";
import { D, ft, gf, mn } from "../shared-constants";
import { retextAnalyze, type RetextAnalysis } from "./retext-voice";

const DEBOUNCE_MS = 600;

const RUBRIC_LABELS: { key: keyof RetextAnalysis["rubric"]; label: string; max: number }[] = [
  { key: "voice",       label: "Voice",        max: 3 },
  { key: "specificity", label: "Specificity",  max: 3 },
  { key: "directness",  label: "Directness",   max: 2 },
  { key: "platformFit", label: "Platform fit", max: 2 },
];

export default function InstantAnalysisPanel() {
  const [text, setText] = useState("");
  const [analysis, setAnalysis] = useState<RetextAnalysis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seqRef = useRef(0);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    const trimmed = text.trim();
    if (!trimmed) { setAnalysis(null); setAnalyzing(false); return; }
    setAnalyzing(true);
    const mySeq = ++seqRef.current;
    timerRef.current = setTimeout(async () => {
      try {
        const a = await retextAnalyze(text);
        // Drop stale results if the user kept typing.
        if (mySeq === seqRef.current) setAnalysis(a);
      } finally {
        if (mySeq === seqRef.current) setAnalyzing(false);
      }
    }, DEBOUNCE_MS);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [text]);

  return (
    <div style={{ maxWidth: 1100, margin: "32px auto 0", padding: "0 32px 40px" }}>
      <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "4px 10px", borderRadius: 999, background: "rgba(46,173,142,0.10)", border: `1px solid ${D.teal}55`, marginBottom: 14 }}>
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: D.teal, boxShadow: `0 0 8px ${D.teal}` }} />
        <span style={{ fontFamily: mn, fontSize: 10, letterSpacing: 1.4, color: D.teal, textTransform: "uppercase" }}>Instant analysis</span>
      </div>
      <h2 style={{ fontFamily: gf, fontSize: 26, fontWeight: 900, letterSpacing: -0.6, margin: 0, marginBottom: 6, color: D.tx }}>Live grammar</h2>
      <div style={{ fontFamily: ft, fontSize: 13, color: D.txm, maxWidth: 720, lineHeight: 1.5, marginBottom: 20 }}>
        Deterministic, client-side retext layer. Updates as you type — no API call. Use it for fast iteration; the SA voice score above is the source of truth.
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: 18 }}>
        <div>
          <div style={lbl}>Draft to lint</div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type or paste here for instant retext analysis…"
            style={{
              width: "100%",
              minHeight: 180,
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
            <div style={{ fontFamily: mn, fontSize: 10, color: analyzing ? D.amber : D.txd, letterSpacing: 0.4 }}>
              {analyzing ? "ANALYZING…" : analysis ? "READY" : "IDLE"}
            </div>
          </div>

          {analysis && analysis.inlineFlags.length > 0 ? (
            <div style={{ marginTop: 14 }}>
              <div style={lbl}>Inline flags</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 220, overflowY: "auto" }}>
                {analysis.inlineFlags.slice(0, 40).map((f, i) => {
                  const color = f.kind === "passive" ? D.violet
                    : f.kind === "hype" ? D.coral
                    : f.kind === "equality" ? D.amber
                    : D.cyan;
                  const snippet = text.slice(f.start, f.end).slice(0, 40);
                  return (
                    <div
                      key={i}
                      style={{
                        display: "flex",
                        gap: 8,
                        alignItems: "baseline",
                        padding: "6px 10px",
                        background: color + "10",
                        border: `1px solid ${color}44`,
                        borderRadius: 6,
                      }}
                    >
                      <span style={{ fontFamily: mn, fontSize: 9, letterSpacing: 1, textTransform: "uppercase", color, fontWeight: 800, minWidth: 60 }}>
                        {f.kind}
                      </span>
                      <span style={{ fontFamily: ft, fontSize: 12, color: D.tx, flex: 1, lineHeight: 1.45 }}>
                        {snippet ? <code style={{ fontFamily: mn, fontSize: 11, color: D.txm }}>{snippet}</code> : null}
                        {snippet ? " — " : ""}{f.message}
                      </span>
                    </div>
                  );
                })}
                {analysis.inlineFlags.length > 40 ? (
                  <div style={{ fontFamily: mn, fontSize: 10, color: D.txd, padding: "4px 6px" }}>
                    + {analysis.inlineFlags.length - 40} more…
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>

        <div style={{ background: D.surface, border: `1px solid ${D.border}`, borderRadius: 14, padding: 20, alignSelf: "start" }}>
          <div style={lbl}>Rubric (retext)</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 0, marginBottom: 16 }}>
            {RUBRIC_LABELS.map((r) => (
              <Bar key={r.key} label={r.label} value={analysis ? analysis.rubric[r.key] : 0} max={r.max} />
            ))}
          </div>

          <div style={lbl}>Readability</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 18 }}>
            <div style={{ fontFamily: gf, fontSize: 32, fontWeight: 900, color: D.tx, letterSpacing: -0.6, lineHeight: 1 }}>
              {analysis ? analysis.readability.grade : "—"}
            </div>
            <div style={{ fontFamily: mn, fontSize: 11, color: D.txm, letterSpacing: 0.4 }}>
              grade · FK ease {analysis ? analysis.readability.fleschKincaid : "—"}
            </div>
          </div>

          <div style={lbl}>Flag counts</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            <Chip label="passive"  value={analysis ? analysis.passiveCount     : 0} color={D.violet} />
            <Chip label="weak/hype" value={analysis ? analysis.weakHypeCount    : 0} color={D.coral} />
            <Chip label="equality"  value={analysis ? analysis.equalityWarnings : 0} color={D.amber} />
          </div>
        </div>
      </div>
    </div>
  );
}

function Bar({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
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

function Chip({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "4px 10px",
        borderRadius: 999,
        background: color + "14",
        border: `1px solid ${color}44`,
        fontFamily: mn,
        fontSize: 10,
        letterSpacing: 1,
        textTransform: "uppercase",
        color,
        fontWeight: 800,
      }}
    >
      <span>{label}</span>
      <span style={{ color: D.tx }}>{value}</span>
    </span>
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
