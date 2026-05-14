"use client";

// Headline Doctor — paste a working headline, get 10 ranked alternates
// across different hook patterns (number-led, provocative, question,
// comparison, etc). Copy the one that works.

import React, { useState } from "react";
import { D, ft, gf, mn } from "./shared-constants";

interface Alternate {
  text: string;
  score: number;
  pattern: string;
  whyItWorks: string;
}

interface Result {
  alternates: Alternate[];
  diagnosis?: string;
}

const PLATFORMS = [
  { id: "any",       label: "Any" },
  { id: "x",         label: "X" },
  { id: "linkedin",  label: "LinkedIn" },
  { id: "youtube",   label: "YouTube" },
  { id: "blog",      label: "Blog" },
  { id: "newsletter",label: "Newsletter" },
];

export default function HeadlineDoctor() {
  const [headline, setHeadline] = useState("");
  const [context, setContext] = useState("");
  const [platform, setPlatform] = useState("any");
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<number | null>(null);

  async function run() {
    if (!headline.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/headline-doctor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ headline: headline.trim(), context: context.trim() || undefined, platform }),
      });
      const j = await res.json();
      if (!res.ok) {
        setError(j.error || "Doctor failed");
        return;
      }
      setResult(j as Result);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  async function copy(text: string, i: number) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(i);
      setTimeout(() => setCopied(null), 1500);
    } catch { /* ignore */ }
  }

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "40px 32px" }}>
      <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "4px 10px", borderRadius: 999, background: "rgba(46,173,142,0.10)", border: `1px solid ${D.teal}55`, marginBottom: 14 }}>
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: D.teal, boxShadow: `0 0 8px ${D.teal}` }} />
        <span style={{ fontFamily: mn, fontSize: 10, letterSpacing: 1.4, color: D.teal, textTransform: "uppercase" }}>Headline Lab</span>
      </div>
      <h1 style={{ fontFamily: gf, fontSize: 38, fontWeight: 900, letterSpacing: -1, margin: 0, marginBottom: 8, color: D.tx }}>Headline Doctor</h1>
      <div style={{ fontFamily: ft, fontSize: 15, color: D.txm, maxWidth: 720, lineHeight: 1.5, marginBottom: 28 }}>
        Paste a working headline. Get 10 alternates ranked by hook strength, across patterns you can actually use.
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, marginBottom: 24 }}>
        <div>
          <div style={lbl}>Working headline</div>
          <input
            value={headline}
            onChange={(e) => setHeadline(e.target.value)}
            placeholder="TSMC Capex Cut Signals Tighter GPU Supply"
            style={inputStyle}
          />
          <div style={{ marginTop: 14 }}>
            <div style={lbl}>Platform context</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
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
          </div>
        </div>

        <div>
          <div style={lbl}>Article context (optional)</div>
          <textarea
            value={context}
            onChange={(e) => setContext(e.target.value)}
            placeholder="Paste the article or a paragraph so Claude can pull specific numbers / claims into the alternates."
            style={{ ...inputStyle, minHeight: 100, resize: "vertical" }}
          />
          <button
            type="button"
            onClick={run}
            disabled={loading || !headline.trim()}
            style={{
              marginTop: 12,
              width: "100%",
              background: D.amber,
              color: "#060608",
              border: "none",
              padding: "12px 22px",
              borderRadius: 8,
              fontFamily: ft,
              fontSize: 13,
              fontWeight: 800,
              cursor: loading || !headline.trim() ? "not-allowed" : "pointer",
              opacity: loading || !headline.trim() ? 0.5 : 1,
            }}
          >
            {loading ? "Drafting 10 alternates…" : "Doctor it"}
          </button>
          {error ? <div style={{ marginTop: 10, fontFamily: mn, fontSize: 11, color: D.coral }}>{error}</div> : null}
        </div>
      </div>

      {result?.diagnosis ? (
        <div style={{ fontFamily: ft, fontSize: 13, color: D.tx, padding: "10px 14px", background: D.amber + "10", border: `1px solid ${D.amber}40`, borderRadius: 8, marginBottom: 18, lineHeight: 1.5 }}>
          <strong style={{ fontFamily: mn, fontSize: 10, letterSpacing: 1.2, color: D.amber, textTransform: "uppercase", marginRight: 8 }}>Diagnosis</strong>
          {result.diagnosis}
        </div>
      ) : null}

      {result?.alternates && result.alternates.length > 0 ? (
        <div>
          <div style={lbl}>Ranked alternates</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {result.alternates.map((a, i) => {
              const scoreColor = a.score >= 8 ? D.teal : a.score >= 6 ? D.amber : D.coral;
              return (
                <div key={i} style={{ background: D.surface, border: `1px solid ${D.border}`, borderRadius: 10, padding: "14px 16px" }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 14, marginBottom: 6 }}>
                    <div style={{ fontFamily: mn, fontSize: 22, fontWeight: 900, color: scoreColor, letterSpacing: -0.6, minWidth: 32 }}>
                      {a.score}
                    </div>
                    <div style={{ flex: 1, fontFamily: gf, fontSize: 17, fontWeight: 700, color: D.tx, letterSpacing: -0.5, lineHeight: 1.25 }}>
                      {a.text}
                    </div>
                    <button
                      type="button"
                      onClick={() => copy(a.text, i)}
                      style={{
                        background: copied === i ? D.teal : "transparent",
                        color: copied === i ? "#060608" : D.tx,
                        border: `1px solid ${copied === i ? D.teal : D.border}`,
                        padding: "5px 12px",
                        borderRadius: 6,
                        fontFamily: mn,
                        fontSize: 10,
                        letterSpacing: 0.6,
                        cursor: "pointer",
                      }}
                    >
                      {copied === i ? "COPIED" : "COPY"}
                    </button>
                  </div>
                  <div style={{ display: "flex", gap: 14, alignItems: "baseline", marginLeft: 46 }}>
                    <span style={{ fontFamily: mn, fontSize: 10, color: D.amber, letterSpacing: 1.2, textTransform: "uppercase" }}>{a.pattern}</span>
                    <span style={{ fontFamily: ft, fontSize: 12, color: D.txm, lineHeight: 1.4 }}>{a.whyItWorks}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
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

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 14px",
  background: D.surface,
  border: `1px solid ${D.border}`,
  borderRadius: 8,
  color: D.tx,
  fontFamily: ft,
  fontSize: 14,
  outline: "none",
  boxSizing: "border-box",
};
