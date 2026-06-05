"use client";

import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { D, ft, gf, mn, copyText, getSurfaceProvider, getPreferredProvider, type LLMProviderName } from "../../shared-constants";
import { showToast } from "../../toast-context";
import { useStore } from "../../lib/store";
import { CommandCenterShell, apps } from "../shell";

// /intelligence-suite/brief — full-page Morning Brief.
// The hub still uses the modal trigger from ../morning-brief; this page
// renders the same result inline and persists the last brief in
// localStorage("poast-is-last-brief") so reload restores it.

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

const LS_KEY = "poast-is-last-brief";

function pickProvider(): LLMProviderName {
  return getSurfaceProvider("morning-brief") || getPreferredProvider();
}

function briefToText(b: Brief): string {
  const lines: string[] = [];
  lines.push("SemiAnalysis Morning Brief");
  lines.push("=".repeat(28));
  lines.push("");
  lines.push("Top 5 signals (last 24h):");
  b.topSignals.forEach((s, i) => lines.push((i + 1) + ". " + s));
  lines.push("");
  lines.push("Recommended story ideas:");
  b.storyIdeas.forEach((s, i) => lines.push((i + 1) + ". " + s.title + "\n   " + s.angle));
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

export default function BriefPage() {
  var _ok = useState(false), ok = _ok[0], setOk = _ok[1];
  const [loading, setLoading] = useState(false);
  const [brief, setBrief] = useState<Brief | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [generatedAt, setGeneratedAt] = useState<number | null>(null);
  const pushOutput = useStore((s) => s.pushOutput);

  useEffect(function () {
    try {
      var stored = localStorage.getItem("poast-current-user");
      if (stored) { setOk(true); return; }
    } catch (e) {}
    window.location.href = "/";
  }, []);

  // Restore last brief from localStorage so a reload doesn't lose state.
  useEffect(function () {
    if (!ok) return;
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { brief: Brief; generatedAt: number };
      if (parsed && parsed.brief) {
        setBrief(parsed.brief);
        setGeneratedAt(parsed.generatedAt || null);
      }
    } catch (e) {}
  }, [ok]);

  async function run() {
    setLoading(true);
    setErr(null);
    try {
      const provider = pickProvider();
      const res = await fetch("/api/morning-brief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data?.error || ("Request failed (" + res.status + ")"));
      } else {
        const fresh = data as Brief;
        const ts = Date.now();
        setBrief(fresh);
        setGeneratedAt(ts);
        try { localStorage.setItem(LS_KEY, JSON.stringify({ brief: fresh, generatedAt: ts })); } catch (e) {}
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
    window.location.href = "mailto:?subject=" + subject + "&body=" + body;
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

  if (!ok) return null;

  var app = apps.find(function (a) { return a.id === "brief"; }) || apps[6];

  return (
    <CommandCenterShell activeId="brief">
      <div style={{ padding: "32px 32px 64px", maxWidth: 1280, margin: "0 auto" }}>
        <div style={{ marginBottom: 22 }}>
          <div style={{ fontFamily: gf, fontSize: 38, fontWeight: 900, color: D.tx, letterSpacing: -0.6 }}>{app.label}</div>
          <div style={{ fontFamily: ft, fontSize: 14, color: D.txm, marginTop: 6 }}>
            Last 24h, distilled — top signals, story ideas, urgency alert, and what the field is publishing.
          </div>
        </div>

        <div style={{ background: D.card, border: "1px solid " + D.border, borderRadius: 14, padding: "22px 24px" }}>
          {/* Generate CTA + last-generated meta */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            gap: 14, flexWrap: "wrap",
            paddingBottom: 18,
            borderBottom: "1px solid " + D.border,
            marginBottom: 22,
          }}>
            <div>
              <div style={{ fontFamily: mn, fontSize: 9, color: D.amber, letterSpacing: 1.5, textTransform: "uppercase" }}>
                Morning Brief
              </div>
              <div style={{ fontFamily: ft, fontSize: 13, color: D.txm, marginTop: 4 }}>
                {generatedAt
                  ? "Last generated " + new Date(generatedAt).toLocaleString()
                  : "No brief yet — generate one to seed today's plan."}
                {brief?.provider ? " · " + brief.provider : ""}
              </div>
            </div>
            <button
              onClick={run}
              disabled={loading}
              style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                padding: "12px 22px",
                borderRadius: 10,
                background: "linear-gradient(135deg, " + D.amber + "26, " + D.violet + "22)",
                border: "1px solid " + D.amber + "66",
                color: D.amber,
                fontFamily: mn, fontSize: 12, fontWeight: 800, letterSpacing: 0.8,
                textTransform: "uppercase",
                cursor: loading ? "wait" : "pointer",
                opacity: loading ? 0.6 : 1,
                boxShadow: "0 0 24px " + D.amber + "1a",
              }}
            >
              <Sparkles size={14} strokeWidth={2.4} />
              {loading ? "Brewing…" : (brief ? "Regenerate" : "Generate Morning Brief")}
            </button>
          </div>

          {loading && (
            <div style={{ fontFamily: mn, fontSize: 11, color: D.txm, padding: "48px 0", textAlign: "center" }}>
              Aggregating last 24h signals…
            </div>
          )}

          {err && !loading && (
            <div style={{
              background: D.crimson + "12",
              border: "1px solid " + D.crimson + "44",
              borderRadius: 8,
              padding: 12,
              fontFamily: mn,
              fontSize: 11,
              color: D.crimson,
              marginBottom: 16,
            }}>
              {err}
            </div>
          )}

          {brief && !loading && (
            <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
              {brief.sourcedFrom ? (
                <div style={{ fontFamily: mn, fontSize: 10, color: D.txd }}>
                  Sourced from {brief.sourcedFrom.news} news · {brief.sourcedFrom.trends} trends
                </div>
              ) : null}

              <Section eyebrow="Top 5 signals">
                <ol style={{ margin: 0, paddingLeft: 22, fontFamily: ft, fontSize: 15, color: D.tx, lineHeight: 1.65 }}>
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
                        borderRadius: 10,
                        padding: 14,
                      }}
                    >
                      <div style={{ fontFamily: ft, fontSize: 15, fontWeight: 600, color: D.tx, marginBottom: 4 }}>
                        {s.title}
                      </div>
                      <div style={{ fontFamily: ft, fontSize: 13.5, color: D.txm, lineHeight: 1.55 }}>
                        {s.angle}
                      </div>
                    </div>
                  ))}
                </div>
              </Section>

              <Section eyebrow="Move fast alert">
                {brief.moveFastAlert ? (
                  <div style={{
                    background: D.amber + "10",
                    border: "1px solid " + D.amber + "44",
                    borderRadius: 10,
                    padding: 14,
                    fontFamily: ft,
                    fontSize: 14.5,
                    color: D.tx,
                    lineHeight: 1.55,
                  }}>
                    {brief.moveFastAlert}
                  </div>
                ) : (
                  <div style={{ fontFamily: mn, fontSize: 11, color: D.txd }}>
                    Nothing urgent in the last 24h.
                  </div>
                )}
              </Section>

              <Section eyebrow="Competitor activity">
                <div style={{ fontFamily: ft, fontSize: 14.5, color: D.tx, lineHeight: 1.65 }}>
                  {brief.competitorSummary}
                </div>
              </Section>

              <div style={{ display: "flex", gap: 8, paddingTop: 14, borderTop: "1px solid " + D.border }}>
                <ActionBtn onClick={onCopy} label="Copy" />
                <ActionBtn onClick={onEmail} label="Email to team" />
                <ActionBtn onClick={onSaveNote} label="Save to Notes" />
                <div style={{ flex: 1 }} />
                <ActionBtn onClick={run} label="Regenerate" tone="amber" />
              </div>
            </div>
          )}

          {!brief && !loading && !err && (
            <div style={{
              fontFamily: ft, fontSize: 14, color: D.txm,
              padding: "48px 0", textAlign: "center",
              border: "1px dashed " + D.border,
              borderRadius: 10,
            }}>
              Press <span style={{ color: D.amber, fontWeight: 700 }}>Generate Morning Brief</span> to brew today's plan.
            </div>
          )}
        </div>
      </div>
    </CommandCenterShell>
  );
}

function Section({ eyebrow, children }: { eyebrow: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{
        fontFamily: mn, fontSize: 10, color: D.amber, letterSpacing: 1.5,
        textTransform: "uppercase", marginBottom: 10,
      }}>
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
        padding: "8px 16px",
        background: isAmber ? D.amber + "18" : D.surface,
        border: "1px solid " + (isAmber ? D.amber + "55" : D.border),
        borderRadius: 8,
        fontFamily: mn,
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: 0.6,
        color: isAmber ? D.amber : D.tx,
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );
}
