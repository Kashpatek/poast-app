"use client";

import { useState } from "react";
import { D, ft, mn, copyText, getSurfaceProvider, getPreferredProvider, type LLMProviderName } from "../shared-constants";
import { showToast } from "../toast-context";
import { useStore } from "../lib/store";

interface StorySeed {
  title: string;
  angle: string;
}

interface Brief {
  topSignals: string[];
  storyIdeas: StorySeed[];
  moveFastAlert: string | null;
  competitorSummary: string;
  provider?: string;
  sourcedFrom?: { news: number; trends: number };
}

function pickProvider(): LLMProviderName {
  return getSurfaceProvider("morning-brief") || getPreferredProvider();
}

function briefToText(b: Brief): string {
  const lines: string[] = [];
  lines.push("SemiAnalysis Morning Brief");
  lines.push("=".repeat(28));
  lines.push("");
  lines.push("Top 5 signals (last 24h):");
  b.topSignals.forEach((s, i) => lines.push(`${i + 1}. ${s}`));
  lines.push("");
  lines.push("Recommended story ideas:");
  b.storyIdeas.forEach((s, i) => lines.push(`${i + 1}. ${s.title}\n   ${s.angle}`));
  lines.push("");
  if (b.moveFastAlert) {
    lines.push("Move fast:");
    lines.push(b.moveFastAlert);
    lines.push("");
  }
  lines.push("Competitor activity:");
  lines.push(b.competitorSummary);
  return lines.join("\n");
}

export default function MorningBrief() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [brief, setBrief] = useState<Brief | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const pushOutput = useStore((s) => s.pushOutput);

  async function run() {
    setLoading(true);
    setErr(null);
    setBrief(null);
    setOpen(true);
    try {
      const provider = pickProvider();
      const res = await fetch("/api/morning-brief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data?.error || `Request failed (${res.status})`);
      } else {
        setBrief(data as Brief);
      }
    } catch (e) {
      setErr(String(e));
    } finally {
      setLoading(false);
    }
  }

  function onCopy() {
    if (!brief) return;
    if (copyText(briefToText(brief))) showToast("Brief copied", "success");
    else showToast("Copy failed", "error");
  }

  function onEmail() {
    if (!brief) return;
    const subject = encodeURIComponent("SemiAnalysis Morning Brief");
    const body = encodeURIComponent(briefToText(brief));
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  }

  function onSaveNote() {
    if (!brief) return;
    const provider = brief.provider as LLMProviderName | undefined;
    pushOutput({
      sourceTool: "morning-brief",
      kind: "brief",
      payload: brief,
      preview: brief.topSignals[0] || "Morning brief",
      provider,
    });
    showToast("Saved to Notes", "success");
  }

  return (
    <>
      <button
        onClick={run}
        disabled={loading}
        style={{
          padding: "6px 14px",
          borderRadius: 999,
          background: D.amber + "18",
          border: "1px solid " + D.amber + "55",
          color: D.amber,
          fontFamily: mn,
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: 0.5,
          textTransform: "uppercase",
          cursor: loading ? "wait" : "pointer",
          opacity: loading ? 0.6 : 1,
          whiteSpace: "nowrap",
        }}
      >
        {loading ? "Brewing..." : "Generate Morning Brief"}
      </button>

      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: D.bg + "F0",
            zIndex: 10000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(720px, 96vw)",
              maxHeight: "88vh",
              overflowY: "auto",
              background: D.cardGrad,
              border: "1px solid " + D.border,
              borderRadius: 14,
              boxShadow: D.glowHover,
              padding: 22,
              color: D.tx,
            }}
          >
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 18 }}>
              <div>
                <div style={{ fontFamily: mn, fontSize: 9, color: D.amber, letterSpacing: 1.5, textTransform: "uppercase" }}>
                  Intelligence Suite
                </div>
                <div style={{ fontFamily: ft, fontSize: 22, fontWeight: 700, color: D.tx, marginTop: 4 }}>
                  Morning Brief
                </div>
                {brief?.sourcedFrom && (
                  <div style={{ fontFamily: mn, fontSize: 9, color: D.txm, marginTop: 6 }}>
                    {brief.sourcedFrom.news} news // {brief.sourcedFrom.trends} trends // {brief.provider || "claude"}
                  </div>
                )}
              </div>
              <button
                onClick={() => setOpen(false)}
                style={{ background: "transparent", border: "none", color: D.txm, fontFamily: mn, fontSize: 11, cursor: "pointer" }}
              >
                close
              </button>
            </div>

            {loading && (
              <div style={{ fontFamily: mn, fontSize: 11, color: D.txm, padding: "32px 0", textAlign: "center" }}>
                Aggregating last 24h signals...
              </div>
            )}

            {err && !loading && (
              <div
                style={{
                  background: D.crimson + "12",
                  border: "1px solid " + D.crimson + "44",
                  borderRadius: 8,
                  padding: 12,
                  fontFamily: mn,
                  fontSize: 11,
                  color: D.crimson,
                }}
              >
                {err}
              </div>
            )}

            {brief && !loading && (
              <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                <Section eyebrow="Top 5 signals">
                  <ol style={{ margin: 0, paddingLeft: 20, fontFamily: ft, fontSize: 14, color: D.tx, lineHeight: 1.6 }}>
                    {brief.topSignals.map((s, i) => (
                      <li key={i} style={{ marginBottom: 6 }}>{s}</li>
                    ))}
                  </ol>
                </Section>

                <Section eyebrow="Recommended story ideas">
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {brief.storyIdeas.map((s, i) => (
                      <div
                        key={i}
                        style={{
                          background: D.surface,
                          border: "1px solid " + D.border,
                          borderRadius: 8,
                          padding: 12,
                        }}
                      >
                        <div style={{ fontFamily: ft, fontSize: 14, fontWeight: 600, color: D.tx, marginBottom: 4 }}>
                          {s.title}
                        </div>
                        <div style={{ fontFamily: ft, fontSize: 13, color: D.txm, lineHeight: 1.5 }}>
                          {s.angle}
                        </div>
                      </div>
                    ))}
                  </div>
                </Section>

                <Section eyebrow="Move fast alert">
                  {brief.moveFastAlert ? (
                    <div
                      style={{
                        background: D.amber + "10",
                        border: "1px solid " + D.amber + "44",
                        borderRadius: 8,
                        padding: 12,
                        fontFamily: ft,
                        fontSize: 14,
                        color: D.tx,
                        lineHeight: 1.5,
                      }}
                    >
                      {brief.moveFastAlert}
                    </div>
                  ) : (
                    <div style={{ fontFamily: mn, fontSize: 11, color: D.txd }}>
                      Nothing urgent in the last 24h.
                    </div>
                  )}
                </Section>

                <Section eyebrow="Competitor activity">
                  <div style={{ fontFamily: ft, fontSize: 14, color: D.tx, lineHeight: 1.6 }}>
                    {brief.competitorSummary}
                  </div>
                </Section>

                <div style={{ display: "flex", gap: 8, paddingTop: 8, borderTop: "1px solid " + D.border, marginTop: 4 }}>
                  <ActionBtn onClick={onCopy} label="Copy" />
                  <ActionBtn onClick={onEmail} label="Email to team" />
                  <ActionBtn onClick={onSaveNote} label="Save to Notes" />
                  <div style={{ flex: 1 }} />
                  <ActionBtn onClick={run} label="Regenerate" tone="amber" />
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function Section({ eyebrow, children }: { eyebrow: string; children: React.ReactNode }) {
  return (
    <div>
      <div
        style={{
          fontFamily: mn,
          fontSize: 9,
          color: D.amber,
          letterSpacing: 1.4,
          textTransform: "uppercase",
          marginBottom: 8,
        }}
      >
        {eyebrow}
      </div>
      {children}
    </div>
  );
}

function ActionBtn({ onClick, label, tone }: { onClick: () => void; label: string; tone?: "amber" }) {
  const isAmber = tone === "amber";
  return (
    <button
      onClick={onClick}
      style={{
        padding: "7px 14px",
        background: isAmber ? D.amber + "18" : D.surface,
        border: "1px solid " + (isAmber ? D.amber + "55" : D.border),
        borderRadius: 8,
        fontFamily: mn,
        fontSize: 10,
        fontWeight: 600,
        letterSpacing: 0.5,
        color: isAmber ? D.amber : D.tx,
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );
}
