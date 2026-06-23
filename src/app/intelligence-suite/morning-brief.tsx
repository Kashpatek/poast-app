"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Sparkles, Copy as CopyIcon, Mail, Bookmark, History as HistoryIcon, X as XIcon, ExternalLink, Send, Brain, Zap, ArrowRight } from "lucide-react";
import {
  D, ft, gf, mn,
  copyText, uid,
  getSurfaceProvider, getPreferredProvider,
  type LLMProviderName,
} from "../shared-constants";
import { showToast } from "../toast-context";
import { useStore } from "../lib/store";

// ─── Newspaper-style daily briefing ─────────────────────────────────
// Full page brief — masthead + 2-column editorial layout + deeper reads.
// The /intelligence-suite/brief page wraps this component inside the
// CommandCenterShell, so MorningBrief itself stays free of the auth /
// shell concerns — it just renders the brief.

interface StorySeed {
  title: string;
  angle: string;
}

interface LeadStory {
  headline: string;
  body: string;
  whyItMatters: string;
  sourceUrl?: string;
}

interface DeeperRead {
  headline: string;
  source: string;
  url?: string;
}

interface Brief {
  topSignals: string[];
  storyIdeas: StorySeed[];
  moveFastAlert: string | null;
  competitorSummary: string;
  leadStory?: LeadStory | null;
  deeperReads?: DeeperRead[];
  provider?: string;
  sourcedFrom?: { news: number; trends: number };
}

interface HistoryEntry {
  id: string;
  generatedAt: number;
  edition: string;
  leadHeadline: string;
  topSignals: string[];
  brief: Brief;
}

const LS_LAST = "poast-is-last-brief";
const LS_HISTORY = "poast-is-brief-history";
const MAX_HISTORY = 30;

function pickProvider(): LLMProviderName {
  return getSurfaceProvider("morning-brief") || getPreferredProvider();
}

function editionLabel(d: Date): string {
  const h = d.getHours();
  if (h < 12) return "Morning Edition";
  if (h >= 14) return "Afternoon Edition";
  return "Daily Edition";
}

function fullDate(d: Date): string {
  return d.toLocaleDateString(undefined, {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });
}

function briefToText(b: Brief): string {
  const lines: string[] = [];
  lines.push("SemiAnalysis " + editionLabel(new Date()));
  lines.push("=".repeat(40));
  lines.push("");
  if (b.leadStory) {
    lines.push("TOP STORY: " + b.leadStory.headline);
    lines.push("");
    lines.push(b.leadStory.body);
    lines.push("");
    if (b.leadStory.whyItMatters) {
      lines.push("Why it matters: " + b.leadStory.whyItMatters);
      lines.push("");
    }
    if (b.leadStory.sourceUrl) {
      lines.push("Source: " + b.leadStory.sourceUrl);
      lines.push("");
    }
  }
  lines.push("Today's top signals:");
  b.topSignals.forEach((s, i) => lines.push((i + 1) + ". " + s));
  lines.push("");
  lines.push("Story ideas:");
  b.storyIdeas.forEach((s, i) => lines.push((i + 1) + ". " + s.title + "\n   " + s.angle));
  lines.push("");
  if (b.moveFastAlert) {
    lines.push("ACT TODAY: " + b.moveFastAlert);
    lines.push("");
  }
  lines.push("Competitor activity:");
  lines.push(b.competitorSummary);
  if (b.deeperReads && b.deeperReads.length) {
    lines.push("");
    lines.push("Deeper reads:");
    b.deeperReads.forEach((d, i) => lines.push((i + 1) + ". " + d.headline + " (" + d.source + ")"));
  }
  return lines.join("\n");
}

function loadHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(LS_HISTORY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as HistoryEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveHistory(list: HistoryEntry[]): void {
  try {
    localStorage.setItem(LS_HISTORY, JSON.stringify(list.slice(0, MAX_HISTORY)));
  } catch { /* quota — silently drop */ }
}

export default function MorningBrief() {
  const [loading, setLoading] = useState(false);
  const [brief, setBrief] = useState<Brief | null>(null);
  const [generatedAt, setGeneratedAt] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [now, setNow] = useState<Date>(new Date());

  const pushOutput = useStore((s) => s.pushOutput);

  // The masthead date/edition has to track real time — clock tick once
  // a minute is enough; we don't need to re-render more aggressively.
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  // Hydrate last brief + history on mount.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_LAST);
      if (raw) {
        const parsed = JSON.parse(raw) as { brief: Brief; generatedAt: number };
        if (parsed && parsed.brief) {
          setBrief(parsed.brief);
          setGeneratedAt(parsed.generatedAt || null);
        }
      }
    } catch { /* corrupted — ignore */ }
    setHistory(loadHistory());
  }, []);

  const edition = useMemo(() => editionLabel(now), [now]);
  const dateText = useMemo(() => fullDate(now), [now]);

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
        setErr(data?.error || "Request failed (" + res.status + ")");
        return;
      }
      const fresh = data as Brief;
      const ts = Date.now();
      setBrief(fresh);
      setGeneratedAt(ts);
      try { localStorage.setItem(LS_LAST, JSON.stringify({ brief: fresh, generatedAt: ts })); } catch { /* ignore */ }

      const entry: HistoryEntry = {
        id: uid("brief"),
        generatedAt: ts,
        edition: editionLabel(new Date(ts)),
        leadHeadline: fresh.leadStory?.headline || fresh.topSignals[0] || "Untitled brief",
        topSignals: fresh.topSignals.slice(0, 3),
        brief: fresh,
      };
      const next = [entry, ...history].slice(0, MAX_HISTORY);
      setHistory(next);
      saveHistory(next);
      showToast("Brief refreshed", "success");
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
    const subject = encodeURIComponent("SemiAnalysis " + edition + " — " + dateText);
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
      preview: brief.leadStory?.headline || brief.topSignals[0] || "Morning brief",
      provider,
    });
    showToast("Saved to Notes", "success");
  }

  function sendIdea(seed: StorySeed, target: "brainstorm" | "capper") {
    const provider = brief?.provider as LLMProviderName | undefined;
    pushOutput({
      sourceTool: "morning-brief",
      kind: "idea",
      payload: { ...seed, target },
      preview: seed.title,
      provider,
    });
    showToast("Sent to " + (target === "brainstorm" ? "Brainstorm" : "Capper"), "success");
  }

  function loadFromHistory(entry: HistoryEntry) {
    setBrief(entry.brief);
    setGeneratedAt(entry.generatedAt);
    try { localStorage.setItem(LS_LAST, JSON.stringify({ brief: entry.brief, generatedAt: entry.generatedAt })); } catch { /* ignore */ }
    setHistoryOpen(false);
    showToast("Loaded past brief", "success");
  }

  function clearHistory() {
    setHistory([]);
    try { localStorage.removeItem(LS_HISTORY); } catch { /* ignore */ }
  }

  return (
    <div style={{ padding: "32px 32px 80px", maxWidth: 1320, margin: "0 auto" }}>
      {/* ─── Masthead ─────────────────────────────────────────── */}
      <header
        style={{
          paddingBottom: 20,
          borderBottom: "2px solid " + D.tx,
          marginBottom: 28,
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          gap: 24,
          flexWrap: "wrap",
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontFamily: mn, fontSize: 10, fontWeight: 800,
              color: D.amber, letterSpacing: 2.6, textTransform: "uppercase",
              marginBottom: 8,
            }}
          >
            Vol. {now.getFullYear()} · {edition}
          </div>
          <h1
            style={{
              margin: 0,
              fontFamily: gf, fontSize: 36, fontWeight: 900,
              letterSpacing: -0.6, color: D.tx, lineHeight: 1.02,
            }}
          >
            THE SEMIANALYSIS BRIEF
          </h1>
          <div
            style={{
              marginTop: 10,
              display: "flex", alignItems: "center", gap: 12,
              fontFamily: ft, fontSize: 14, color: D.txm,
            }}
          >
            <span>{dateText}</span>
            <span style={{ color: D.txd }}>·</span>
            <span>{edition}</span>
            {generatedAt ? (
              <>
                <span style={{ color: D.txd }}>·</span>
                <span style={{ fontFamily: mn, fontSize: 11, color: D.txd }}>
                  refreshed {new Date(generatedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                </span>
              </>
            ) : null}
            {brief?.sourcedFrom ? (
              <>
                <span style={{ color: D.txd }}>·</span>
                <span style={{ fontFamily: mn, fontSize: 11, color: D.txd }}>
                  {brief.sourcedFrom.news} news // {brief.sourcedFrom.trends} trends
                </span>
              </>
            ) : null}
            {brief?.provider ? (
              <>
                <span style={{ color: D.txd }}>·</span>
                <span style={{ fontFamily: mn, fontSize: 11, color: D.txd }}>{brief.provider}</span>
              </>
            ) : null}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <MastheadAction onClick={() => setHistoryOpen(true)} icon={<HistoryIcon size={13} strokeWidth={2.2} />} label="View past briefs" />
          <MastheadAction onClick={onSaveNote} icon={<Bookmark size={13} strokeWidth={2.2} />} label="Save" disabled={!brief} />
          <MastheadAction onClick={onEmail} icon={<Mail size={13} strokeWidth={2.2} />} label="Email" disabled={!brief} />
          <MastheadAction onClick={onCopy} icon={<CopyIcon size={13} strokeWidth={2.2} />} label="Copy" disabled={!brief} />
          <button
            onClick={run}
            disabled={loading}
            style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              padding: "10px 18px",
              borderRadius: 999,
              background: D.amber,
              border: "1px solid " + D.amber,
              color: "#0A0A0E",
              fontFamily: mn, fontSize: 11, fontWeight: 800, letterSpacing: 0.6,
              textTransform: "uppercase",
              cursor: loading ? "wait" : "pointer",
              opacity: loading ? 0.7 : 1,
              boxShadow: "0 0 16px " + D.amber + "33",
            }}
          >
            <Sparkles size={13} strokeWidth={2.4} />
            {loading ? "Brewing…" : (brief ? "Regenerate" : "Generate Brief")}
          </button>
        </div>
      </header>

      {/* ─── Loading / error / empty ───────────────────────────── */}
      {loading && !brief ? (
        <LoadingState />
      ) : null}

      {err && !loading ? (
        <div
          style={{
            background: D.crimson + "12",
            border: "1px solid " + D.crimson + "44",
            borderRadius: 10,
            padding: 14,
            fontFamily: mn, fontSize: 11, color: D.crimson,
            marginBottom: 20,
          }}
        >
          {err}
        </div>
      ) : null}

      {!brief && !loading && !err ? (
        <EmptyState onGenerate={run} />
      ) : null}

      {/* ─── Newspaper layout ─────────────────────────────────── */}
      {brief ? (
        <div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 1.5fr) minmax(0, 1fr)",
              gap: 28,
              alignItems: "start",
            }}
          >
            {/* LEFT — lead story + top 3 signals */}
            <div style={{ display: "flex", flexDirection: "column", gap: 22, minWidth: 0 }}>
              <LeadStoryCard
                leadStory={brief.leadStory || null}
                onDraftPost={() => {
                  if (!brief.leadStory) return;
                  pushOutput({
                    sourceTool: "morning-brief",
                    kind: "headline",
                    payload: { headline: brief.leadStory.headline, body: brief.leadStory.body },
                    preview: brief.leadStory.headline,
                    provider: brief.provider as LLMProviderName | undefined,
                  });
                  showToast("Sent to Drafts", "success");
                }}
                onSave={onSaveNote}
              />
              <TopSignalsList signals={brief.topSignals} />
            </div>

            {/* RIGHT — alert + ideas + competitor */}
            <div style={{ display: "flex", flexDirection: "column", gap: 22, minWidth: 0 }}>
              {brief.moveFastAlert ? (
                <MoveFastCard
                  alert={brief.moveFastAlert}
                  onDraft={() => {
                    pushOutput({
                      sourceTool: "morning-brief",
                      kind: "headline",
                      payload: { headline: brief.moveFastAlert, body: brief.moveFastAlert },
                      preview: brief.moveFastAlert!,
                      provider: brief.provider as LLMProviderName | undefined,
                    });
                    showToast("Sent to Drafts", "success");
                  }}
                />
              ) : null}

              <StoryIdeasList ideas={brief.storyIdeas} onSend={sendIdea} />

              <CompetitorPanel summary={brief.competitorSummary} />
            </div>
          </div>

          {/* DEEPER READS row */}
          {brief.deeperReads && brief.deeperReads.length ? (
            <DeeperReadsRow reads={brief.deeperReads} />
          ) : null}
        </div>
      ) : null}

      {/* ─── History modal ────────────────────────────────────── */}
      {historyOpen ? (
        <HistoryModal
          history={history}
          onClose={() => setHistoryOpen(false)}
          onLoad={loadFromHistory}
          onClear={clearHistory}
        />
      ) : null}
    </div>
  );
}

// ─── Subcomponents ──────────────────────────────────────────────────

function MastheadAction({
  onClick, icon, label, disabled,
}: { onClick: () => void; icon: React.ReactNode; label: string; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        padding: "8px 12px",
        borderRadius: 999,
        background: D.surface,
        border: "1px solid " + D.border,
        color: disabled ? D.txd : D.tx,
        fontFamily: mn, fontSize: 10, fontWeight: 700, letterSpacing: 0.6,
        textTransform: "uppercase",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {icon}
      {label}
    </button>
  );
}

function LoadingState() {
  return (
    <div
      style={{
        padding: "72px 0",
        textAlign: "center",
        fontFamily: mn, fontSize: 11, color: D.txm,
        letterSpacing: 1.2,
      }}
    >
      <div
        style={{
          display: "inline-flex", alignItems: "center", gap: 10,
          padding: "12px 18px",
          borderRadius: 999,
          background: D.surface,
          border: "1px solid " + D.border,
        }}
      >
        <span
          style={{
            width: 8, height: 8, borderRadius: "50%",
            background: D.amber,
            boxShadow: "0 0 12px " + D.amber + "88",
            animation: "pulse 1.4s ease-in-out infinite",
          }}
        />
        Aggregating last 24h signals…
      </div>
      <style>{"@keyframes pulse { 0%,100% { opacity: 0.4; } 50% { opacity: 1; } }"}</style>
    </div>
  );
}

function EmptyState({ onGenerate }: { onGenerate: () => void }) {
  return (
    <div
      style={{
        padding: "72px 24px",
        textAlign: "center",
        border: "1px dashed " + D.border,
        borderRadius: 14,
        background: D.card,
      }}
    >
      <div
        style={{
          fontFamily: gf, fontSize: 22, fontWeight: 800,
          color: D.tx, marginBottom: 10,
        }}
      >
        No edition published yet today
      </div>
      <div
        style={{
          fontFamily: ft, fontSize: 14, color: D.txm,
          maxWidth: 460, margin: "0 auto 22px",
        }}
      >
        Press generate to brew today&apos;s brief — top story, signals, story ideas, and competitor moves in five minutes of reading.
      </div>
      <button
        onClick={onGenerate}
        style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          padding: "12px 22px",
          borderRadius: 999,
          background: D.amber,
          border: "1px solid " + D.amber,
          color: "#0A0A0E",
          fontFamily: mn, fontSize: 11, fontWeight: 800, letterSpacing: 0.8,
          textTransform: "uppercase",
          cursor: "pointer",
          boxShadow: "0 0 24px " + D.amber + "33",
        }}
      >
        <Sparkles size={14} strokeWidth={2.4} />
        Generate today&apos;s brief
      </button>
    </div>
  );
}

function LeadStoryCard({
  leadStory, onDraftPost, onSave,
}: {
  leadStory: LeadStory | null;
  onDraftPost: () => void;
  onSave: () => void;
}) {
  if (!leadStory) {
    return (
      <div
        style={{
          background: D.card,
          borderLeft: "2px solid " + D.amber,
          border: "1px solid " + D.border,
          borderRadius: 14,
          padding: "22px 24px",
        }}
      >
        <Eyebrow>Top Story</Eyebrow>
        <div style={{ fontFamily: ft, fontSize: 14, color: D.txm, marginTop: 12, lineHeight: 1.55 }}>
          The lead is still developing — regenerate after more news lands.
        </div>
      </div>
    );
  }
  const paragraphs = leadStory.body.split(/\n\n+/).filter((p) => p.trim().length > 0);
  return (
    <article
      style={{
        background: D.card,
        borderLeft: "2px solid " + D.amber,
        border: "1px solid " + D.border,
        borderRadius: 14,
        padding: "24px 26px 22px",
      }}
    >
      <Eyebrow>Top Story</Eyebrow>
      <h2
        style={{
          margin: "10px 0 14px",
          fontFamily: gf, fontSize: 26, fontWeight: 900,
          letterSpacing: -0.4, color: D.tx, lineHeight: 1.12,
        }}
      >
        {leadStory.headline}
      </h2>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {paragraphs.length ? paragraphs.map((p, i) => (
          <p
            key={i}
            style={{
              margin: 0,
              fontFamily: ft, fontSize: 14, lineHeight: 1.65, color: D.tx,
            }}
          >
            {p}
          </p>
        )) : (
          <p style={{ margin: 0, fontFamily: ft, fontSize: 14, color: D.txm }}>
            (No body copy returned — try regenerating.)
          </p>
        )}
      </div>

      {leadStory.whyItMatters ? (
        <div
          style={{
            marginTop: 18,
            background: D.amber + "12",
            border: "1px solid " + D.amber + "33",
            borderLeft: "3px solid " + D.amber,
            borderRadius: 8,
            padding: 14,
          }}
        >
          <div
            style={{
              fontFamily: mn, fontSize: 9, fontWeight: 800,
              color: D.amber, letterSpacing: 1.6, textTransform: "uppercase",
              marginBottom: 6,
            }}
          >
            Why it matters
          </div>
          <div
            style={{
              fontFamily: ft, fontSize: 13, fontStyle: "italic",
              color: D.tx, lineHeight: 1.55,
            }}
          >
            {leadStory.whyItMatters}
          </div>
        </div>
      ) : null}

      <div
        style={{
          marginTop: 20,
          paddingTop: 16,
          borderTop: "1px solid " + D.border,
          display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap",
        }}
      >
        <InlineAction onClick={onDraftPost} icon={<Sparkles size={12} strokeWidth={2.4} />} label="Draft Post" tone="amber" />
        <InlineAction onClick={onSave} icon={<Bookmark size={12} strokeWidth={2.4} />} label="Save" />
        {leadStory.sourceUrl ? (
          <a
            href={leadStory.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "7px 12px",
              borderRadius: 999,
              background: D.surface,
              border: "1px solid " + D.border,
              color: D.tx,
              fontFamily: mn, fontSize: 10, fontWeight: 700, letterSpacing: 0.6,
              textTransform: "uppercase",
              textDecoration: "none",
            }}
          >
            <ExternalLink size={12} strokeWidth={2.4} />
            Open source
          </a>
        ) : null}
      </div>
    </article>
  );
}

function TopSignalsList({ signals }: { signals: string[] }) {
  if (!signals.length) return null;
  const top3 = signals.slice(0, 3);
  return (
    <section>
      <Eyebrow>Today&apos;s Top 3 Signals</Eyebrow>
      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 10 }}>
        {top3.map((s, i) => {
          // Most signals returned are one sentence — split on the first
          // sentence boundary so the rest reads as a sub-summary.
          const dot = s.indexOf(". ");
          const head = dot > 0 ? s.slice(0, dot) : s;
          const tail = dot > 0 ? s.slice(dot + 2) : "";
          return (
            <article
              key={i}
              style={{
                background: D.card,
                border: "1px solid " + D.border,
                borderRadius: 12,
                padding: "16px 18px",
                display: "flex",
                gap: 14,
                alignItems: "flex-start",
              }}
            >
              <div
                style={{
                  flexShrink: 0,
                  width: 28, height: 28, borderRadius: 8,
                  background: D.amber + "18",
                  border: "1px solid " + D.amber + "55",
                  color: D.amber,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontFamily: mn, fontSize: 12, fontWeight: 800,
                }}
              >
                {i + 1}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontFamily: gf, fontSize: 16, fontWeight: 700, color: D.tx, lineHeight: 1.3 }}>
                  {head}
                </div>
                {tail ? (
                  <div
                    style={{
                      marginTop: 6,
                      fontFamily: ft, fontSize: 13, color: D.txm, lineHeight: 1.55,
                    }}
                  >
                    {tail}
                  </div>
                ) : null}
              </div>
            </article>
          );
        })}
        {signals.length > 3 ? (
          <div
            style={{
              fontFamily: mn, fontSize: 10, color: D.txd, letterSpacing: 1.2,
              textTransform: "uppercase", textAlign: "right",
            }}
          >
            +{signals.length - 3} more in the full feed
          </div>
        ) : null}
      </div>
    </section>
  );
}

function MoveFastCard({ alert, onDraft }: { alert: string; onDraft: () => void }) {
  return (
    <article
      style={{
        background: D.coral + "14",
        border: "1px solid " + D.coral + "55",
        borderRadius: 14,
        padding: "18px 20px",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "flex", alignItems: "center", gap: 8, marginBottom: 10,
        }}
      >
        <span
          style={{
            width: 8, height: 8, borderRadius: "50%",
            background: D.coral,
            boxShadow: "0 0 10px " + D.coral + "AA",
            animation: "pulse 1.4s ease-in-out infinite",
          }}
        />
        <div
          style={{
            fontFamily: mn, fontSize: 10, fontWeight: 800,
            color: D.coral, letterSpacing: 1.8, textTransform: "uppercase",
          }}
        >
          Act Today
        </div>
      </div>
      <div
        style={{
          fontFamily: gf, fontSize: 17, fontWeight: 700, color: D.tx,
          lineHeight: 1.35, marginBottom: 12,
        }}
      >
        {alert}
      </div>
      <button
        onClick={onDraft}
        style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          padding: "8px 14px",
          borderRadius: 999,
          background: D.coral,
          border: "1px solid " + D.coral,
          color: "#0A0A0E",
          fontFamily: mn, fontSize: 10, fontWeight: 800, letterSpacing: 0.8,
          textTransform: "uppercase",
          cursor: "pointer",
        }}
      >
        <Zap size={12} strokeWidth={2.6} />
        Draft now
      </button>
      <style>{"@keyframes pulse { 0%,100% { opacity: 0.4; } 50% { opacity: 1; } }"}</style>
    </article>
  );
}

function StoryIdeasList({
  ideas, onSend,
}: { ideas: StorySeed[]; onSend: (seed: StorySeed, target: "brainstorm" | "capper") => void }) {
  const shown = ideas.slice(0, 5);
  return (
    <section>
      <Eyebrow>5 Story Ideas</Eyebrow>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 10 }}>
        {shown.length ? shown.map((s, i) => (
          <div
            key={i}
            style={{
              background: D.card,
              border: "1px solid " + D.border,
              borderRadius: 10,
              padding: "12px 14px",
            }}
          >
            <div style={{ fontFamily: gf, fontSize: 14, fontWeight: 700, color: D.tx, lineHeight: 1.3 }}>
              {s.title}
            </div>
            <div
              style={{
                marginTop: 4,
                fontFamily: ft, fontSize: 12, color: D.txm, lineHeight: 1.5,
              }}
            >
              {s.angle}
            </div>
            <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
              <MiniChip onClick={() => onSend(s, "brainstorm")} icon={<Brain size={10} strokeWidth={2.4} />} label="Send to Brainstorm" tone="violet" />
              <MiniChip onClick={() => onSend(s, "capper")} icon={<Send size={10} strokeWidth={2.4} />} label="Send to Capper" tone="cyan" />
            </div>
          </div>
        )) : (
          <div style={{ fontFamily: mn, fontSize: 11, color: D.txd, padding: "12px 0" }}>
            No fresh angles surfaced — try regenerating.
          </div>
        )}
      </div>
    </section>
  );
}

function CompetitorPanel({ summary }: { summary: string }) {
  return (
    <section>
      <Eyebrow>Competitor Activity</Eyebrow>
      <div
        style={{
          marginTop: 10,
          background: D.card,
          border: "1px solid " + D.border,
          borderRadius: 12,
          padding: "16px 18px",
        }}
      >
        <div style={{ fontFamily: ft, fontSize: 13, color: D.tx, lineHeight: 1.6 }}>
          {summary || "Quiet morning across the field — no notable competitor moves."}
        </div>
        <Link
          href="/intelligence-suite/competitive"
          style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            marginTop: 12,
            fontFamily: mn, fontSize: 10, fontWeight: 700,
            color: D.blue, letterSpacing: 0.6, textTransform: "uppercase",
            textDecoration: "none",
          }}
        >
          See full competitive view
          <ArrowRight size={11} strokeWidth={2.4} />
        </Link>
      </div>
    </section>
  );
}

function DeeperReadsRow({ reads }: { reads: DeeperRead[] }) {
  return (
    <section style={{ marginTop: 32 }}>
      <div
        style={{
          paddingBottom: 12,
          borderBottom: "1px solid " + D.border,
          marginBottom: 16,
          display: "flex", alignItems: "baseline", justifyContent: "space-between",
        }}
      >
        <Eyebrow>Deeper Reads</Eyebrow>
        <div style={{ fontFamily: mn, fontSize: 10, color: D.txd, letterSpacing: 0.8 }}>
          Long-form picks surfaced by today&apos;s brief
        </div>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 14,
        }}
      >
        {reads.map((r, i) => {
          const inner = (
            <>
              <div
                style={{
                  fontFamily: mn, fontSize: 9, fontWeight: 800,
                  color: D.txm, letterSpacing: 1.5, textTransform: "uppercase",
                  marginBottom: 8,
                }}
              >
                {r.source || "Source"}
              </div>
              <div
                style={{
                  fontFamily: gf, fontSize: 14, fontWeight: 700,
                  color: D.tx, lineHeight: 1.35,
                }}
              >
                {r.headline}
              </div>
              {r.url ? (
                <div
                  style={{
                    marginTop: 10,
                    display: "inline-flex", alignItems: "center", gap: 5,
                    fontFamily: mn, fontSize: 9, fontWeight: 700,
                    color: D.blue, letterSpacing: 0.6, textTransform: "uppercase",
                  }}
                >
                  <ExternalLink size={10} strokeWidth={2.4} />
                  Open
                </div>
              ) : null}
            </>
          );
          const baseStyle: React.CSSProperties = {
            background: D.card,
            border: "1px solid " + D.border,
            borderRadius: 12,
            padding: "14px 16px",
            color: D.tx,
            textDecoration: "none",
            display: "block",
            minHeight: 0,
          };
          return r.url ? (
            <a key={i} href={r.url} target="_blank" rel="noopener noreferrer" style={baseStyle}>
              {inner}
            </a>
          ) : (
            <div key={i} style={baseStyle}>
              {inner}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function HistoryModal({
  history, onClose, onLoad, onClear,
}: {
  history: HistoryEntry[];
  onClose: () => void;
  onLoad: (entry: HistoryEntry) => void;
  onClear: () => void;
}) {
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0,
        background: "color-mix(in srgb,var(--bg) 90%,transparent)",
        zIndex: 10000,
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(640px, 96vw)",
          maxHeight: "82vh",
          overflow: "hidden",
          display: "flex", flexDirection: "column",
          background: D.card,
          border: "1px solid " + D.border,
          borderRadius: 14,
          boxShadow: D.glowHover,
        }}
      >
        <div
          style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "16px 20px",
            borderBottom: "1px solid " + D.border,
          }}
        >
          <div>
            <div
              style={{
                fontFamily: mn, fontSize: 10, fontWeight: 800,
                color: D.amber, letterSpacing: 1.8, textTransform: "uppercase",
              }}
            >
              Past Briefs
            </div>
            <div style={{ fontFamily: gf, fontSize: 18, fontWeight: 800, color: D.tx, marginTop: 2 }}>
              Last {Math.min(history.length, MAX_HISTORY)} editions
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "transparent", border: "none",
              color: D.txm, cursor: "pointer", padding: 6,
            }}
            aria-label="Close"
          >
            <XIcon size={16} strokeWidth={2.4} />
          </button>
        </div>

        <div style={{ overflowY: "auto", padding: 12 }}>
          {history.length === 0 ? (
            <div
              style={{
                padding: "36px 20px", textAlign: "center",
                fontFamily: ft, fontSize: 13, color: D.txm,
              }}
            >
              No briefs in history yet — generate one to start the archive.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {history.map((h) => (
                <button
                  key={h.id}
                  onClick={() => onLoad(h)}
                  style={{
                    textAlign: "left",
                    background: D.surface,
                    border: "1px solid " + D.border,
                    borderRadius: 10,
                    padding: "12px 14px",
                    cursor: "pointer",
                    color: D.tx,
                  }}
                >
                  <div
                    style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      gap: 8, marginBottom: 6,
                    }}
                  >
                    <div
                      style={{
                        fontFamily: mn, fontSize: 9, fontWeight: 800,
                        color: D.amber, letterSpacing: 1.5, textTransform: "uppercase",
                      }}
                    >
                      {h.edition}
                    </div>
                    <div style={{ fontFamily: mn, fontSize: 10, color: D.txd }}>
                      {new Date(h.generatedAt).toLocaleString()}
                    </div>
                  </div>
                  <div style={{ fontFamily: gf, fontSize: 14, fontWeight: 700, color: D.tx, lineHeight: 1.3 }}>
                    {h.leadHeadline}
                  </div>
                  {h.topSignals.length ? (
                    <div
                      style={{
                        marginTop: 6,
                        fontFamily: ft, fontSize: 12, color: D.txm,
                        lineHeight: 1.5,
                      }}
                    >
                      {h.topSignals.slice(0, 2).join(" · ")}
                    </div>
                  ) : null}
                </button>
              ))}
            </div>
          )}
        </div>

        {history.length > 0 ? (
          <div
            style={{
              padding: "12px 20px",
              borderTop: "1px solid " + D.border,
              display: "flex", justifyContent: "flex-end",
            }}
          >
            <button
              onClick={onClear}
              style={{
                background: "transparent",
                border: "1px solid " + D.border,
                borderRadius: 999,
                padding: "6px 12px",
                color: D.txm,
                fontFamily: mn, fontSize: 10, fontWeight: 700, letterSpacing: 0.6,
                textTransform: "uppercase",
                cursor: "pointer",
              }}
            >
              Clear history
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontFamily: mn, fontSize: 11, fontWeight: 800,
        color: D.amber, letterSpacing: 2.4, textTransform: "uppercase",
      }}
    >
      {children}
    </div>
  );
}

function InlineAction({
  onClick, icon, label, tone,
}: { onClick: () => void; icon: React.ReactNode; label: string; tone?: "amber" }) {
  const isAmber = tone === "amber";
  return (
    <button
      onClick={onClick}
      style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        padding: "7px 12px",
        borderRadius: 999,
        background: isAmber ? D.amber : D.surface,
        border: "1px solid " + (isAmber ? D.amber : D.border),
        color: isAmber ? "#0A0A0E" : D.tx,
        fontFamily: mn, fontSize: 10, fontWeight: 800, letterSpacing: 0.6,
        textTransform: "uppercase",
        cursor: "pointer",
      }}
    >
      {icon}
      {label}
    </button>
  );
}

function MiniChip({
  onClick, icon, label, tone,
}: { onClick: () => void; icon: React.ReactNode; label: string; tone: "violet" | "cyan" }) {
  const color = tone === "violet" ? D.violet : D.cyan;
  return (
    <button
      onClick={onClick}
      style={{
        display: "inline-flex", alignItems: "center", gap: 5,
        padding: "5px 9px",
        borderRadius: 999,
        background: color + "16",
        border: "1px solid " + color + "55",
        color,
        fontFamily: mn, fontSize: 9, fontWeight: 800, letterSpacing: 0.6,
        textTransform: "uppercase",
        cursor: "pointer",
      }}
    >
      {icon}
      {label}
    </button>
  );
}
