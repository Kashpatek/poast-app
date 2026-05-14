"use client";

// Distribution Pack — paste one article, get every platform variant in
// one shot. Each section has a copy button. The whole pack persists as
// a single draft so you can come back to it later.

import React, { useState } from "react";
import { D, ft, gf, mn } from "./shared-constants";

interface Pack {
  summary?: { hook?: string; keyClaim?: string; audienceTakeaway?: string };
  saWeekly?: { title?: string; description?: string; talkingPoints?: string[] };
  linkedinArticle?: { headline?: string; subhead?: string; body?: string };
  xThread?: string[];
  linkedinPost?: string;
  igCarousel?: { slides?: Array<{ headline: string; body: string }>; caption?: string };
  igStory?: string;
  tiktok?: string;
  quoteCard?: { quote?: string; attribution?: string; source?: string };
  newsletter?: { tldr?: string; body?: string };
}

export default function DistributionPack() {
  const [mode, setMode] = useState<"url" | "text">("text");
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(false);
  const [pack, setPack] = useState<Pack | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  async function generate() {
    setLoading(true);
    setError(null);
    setPack(null);
    try {
      const res = await fetch("/api/distribution-pack", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: mode === "url" ? url.trim() : undefined,
          text: mode === "text" ? text.trim() : undefined,
          title: title.trim() || undefined,
        }),
      });
      const j = await res.json();
      if (!res.ok) {
        setError(j.error || "Generation failed");
        return;
      }
      setPack(j.pack as Pack);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  async function copy(key: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(null), 1500);
    } catch { /* ignore */ }
  }

  return (
    <div style={{ maxWidth: 1180, margin: "0 auto", padding: "40px 32px" }}>
      <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "4px 10px", borderRadius: 999, background: "rgba(247,176,65,0.10)", border: `1px solid ${D.amber}55`, marginBottom: 14 }}>
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: D.amber, boxShadow: `0 0 8px ${D.amber}` }} />
        <span style={{ fontFamily: mn, fontSize: 10, letterSpacing: 1.4, color: D.amber, textTransform: "uppercase" }}>Orchestrator</span>
      </div>
      <h1 style={{ fontFamily: gf, fontSize: 38, fontWeight: 900, letterSpacing: -1, margin: 0, marginBottom: 8, color: D.tx }}>Distribution Pack</h1>
      <div style={{ fontFamily: ft, fontSize: 15, color: D.txm, maxWidth: 720, lineHeight: 1.5, marginBottom: 28 }}>
        One article in. SA Weekly script, LinkedIn article, X thread, IG carousel, quote card, newsletter, and per-platform captions out. Copy each section as-is.
      </div>

      {!pack ? (
        <div style={{ background: D.surface, border: `1px solid ${D.border}`, borderRadius: 14, padding: 22 }}>
          <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
            {(["text", "url"] as const).map((m) => {
              const active = mode === m;
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  style={{
                    padding: "8px 16px",
                    background: active ? D.amber : "transparent",
                    color: active ? "#060608" : D.tx,
                    border: `1px solid ${active ? D.amber : D.border}`,
                    borderRadius: 8,
                    fontFamily: ft,
                    fontSize: 13,
                    fontWeight: active ? 800 : 500,
                    cursor: "pointer",
                  }}
                >
                  {m === "text" ? "Paste article" : "Paste URL"}
                </button>
              );
            })}
          </div>

          <div style={{ marginBottom: 14 }}>
            <div style={lbl}>Title (optional, helps with naming)</div>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Source article title"
              style={inputStyle}
            />
          </div>

          {mode === "url" ? (
            <div>
              <div style={lbl}>Article URL</div>
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://semianalysis.com/..."
                style={inputStyle}
              />
            </div>
          ) : (
            <div>
              <div style={lbl}>Article text</div>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Paste the full article body…"
                style={{ ...inputStyle, minHeight: 260, resize: "vertical" }}
              />
            </div>
          )}

          <button
            type="button"
            onClick={generate}
            disabled={loading || (mode === "url" ? !url.trim() : text.trim().length < 200)}
            style={{
              marginTop: 16,
              width: "100%",
              background: D.amber,
              color: "#060608",
              border: "none",
              padding: "14px 22px",
              borderRadius: 10,
              fontFamily: ft,
              fontSize: 14,
              fontWeight: 800,
              cursor: loading ? "wait" : "pointer",
              opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? "Drafting the full pack…" : "Generate distribution pack"}
          </button>
          {error ? <div style={{ marginTop: 10, fontFamily: mn, fontSize: 11, color: D.coral }}>{error}</div> : null}
        </div>
      ) : (
        <div>
          <div style={{ marginBottom: 14 }}>
            <button
              type="button"
              onClick={() => setPack(null)}
              style={{ background: "transparent", border: `1px solid ${D.border}`, color: D.tx, padding: "8px 14px", borderRadius: 6, fontFamily: mn, fontSize: 11, cursor: "pointer" }}
            >
              ← Start over
            </button>
          </div>

          {/* Summary band */}
          {pack.summary ? (
            <div style={{ background: D.amber + "12", border: `1px solid ${D.amber}44`, borderRadius: 12, padding: "16px 18px", marginBottom: 18 }}>
              {pack.summary.hook ? <div style={{ fontFamily: gf, fontSize: 22, fontWeight: 800, color: D.tx, letterSpacing: -0.6, marginBottom: 8, lineHeight: 1.25 }}>{pack.summary.hook}</div> : null}
              <div style={{ display: "flex", gap: 18, flexWrap: "wrap", fontFamily: ft, fontSize: 12, color: D.txm }}>
                {pack.summary.keyClaim ? <span><strong style={{ color: D.amber, fontFamily: mn, letterSpacing: 1, marginRight: 6 }}>CLAIM</strong>{pack.summary.keyClaim}</span> : null}
                {pack.summary.audienceTakeaway ? <span><strong style={{ color: D.amber, fontFamily: mn, letterSpacing: 1, marginRight: 6 }}>SO WHAT</strong>{pack.summary.audienceTakeaway}</span> : null}
              </div>
            </div>
          ) : null}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            {pack.saWeekly ? (
              <PackCard title="SA Weekly" copyKey="sa-weekly" pack={pack.saWeekly.title + "\n\n" + (pack.saWeekly.description || "") + "\n\nTalking points:\n" + (pack.saWeekly.talkingPoints || []).map((p) => "- " + p).join("\n")} copied={copied} onCopy={copy}>
                <div style={{ fontFamily: gf, fontSize: 14, fontWeight: 700, color: D.tx, marginBottom: 6 }}>{pack.saWeekly.title}</div>
                <div style={{ fontFamily: ft, fontSize: 12, color: D.txm, lineHeight: 1.5, marginBottom: 8, whiteSpace: "pre-wrap" }}>{pack.saWeekly.description}</div>
                {pack.saWeekly.talkingPoints ? (
                  <ul style={{ paddingLeft: 18, margin: 0 }}>
                    {pack.saWeekly.talkingPoints.map((p, i) => <li key={i} style={{ fontFamily: ft, fontSize: 12, color: D.tx, marginBottom: 4 }}>{p}</li>)}
                  </ul>
                ) : null}
              </PackCard>
            ) : null}

            {pack.linkedinArticle ? (
              <PackCard title="LinkedIn Article" copyKey="li-article" pack={[pack.linkedinArticle.headline, pack.linkedinArticle.subhead, "", pack.linkedinArticle.body].filter(Boolean).join("\n\n")} copied={copied} onCopy={copy}>
                <div style={{ fontFamily: gf, fontSize: 14, fontWeight: 700, color: D.tx, marginBottom: 4 }}>{pack.linkedinArticle.headline}</div>
                {pack.linkedinArticle.subhead ? <div style={{ fontFamily: ft, fontSize: 11, color: D.txm, fontStyle: "italic", marginBottom: 8 }}>{pack.linkedinArticle.subhead}</div> : null}
                <div style={{ fontFamily: ft, fontSize: 12, color: D.txm, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{pack.linkedinArticle.body}</div>
              </PackCard>
            ) : null}

            {pack.xThread ? (
              <PackCard title="X Thread" copyKey="x-thread" pack={pack.xThread.map((t, i) => (i + 1) + "/ " + t).join("\n\n")} copied={copied} onCopy={copy}>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {pack.xThread.map((t, i) => (
                    <div key={i} style={{ fontFamily: ft, fontSize: 12, color: D.tx, padding: "6px 10px", background: "rgba(255,255,255,0.02)", borderRadius: 6, lineHeight: 1.5 }}>
                      <span style={{ fontFamily: mn, fontSize: 10, color: D.amber, marginRight: 6 }}>{i + 1}/</span>
                      {t}
                    </div>
                  ))}
                </div>
              </PackCard>
            ) : null}

            {pack.linkedinPost ? (
              <PackCard title="LinkedIn Post" copyKey="li-post" pack={pack.linkedinPost} copied={copied} onCopy={copy}>
                <div style={{ fontFamily: ft, fontSize: 12, color: D.tx, whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{pack.linkedinPost}</div>
              </PackCard>
            ) : null}

            {pack.igCarousel ? (
              <PackCard title="IG Carousel" copyKey="ig-carousel" pack={(pack.igCarousel.slides || []).map((s, i) => `Slide ${i + 1}: ${s.headline}\n${s.body}`).join("\n\n") + "\n\n--- Caption ---\n" + (pack.igCarousel.caption || "")} copied={copied} onCopy={copy}>
                <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 8 }}>
                  {(pack.igCarousel.slides || []).map((s, i) => (
                    <div key={i} style={{ fontFamily: ft, fontSize: 11, color: D.tx, padding: "4px 8px", background: "rgba(255,255,255,0.02)", borderRadius: 4, borderLeft: `2px solid ${D.amber}` }}>
                      <strong style={{ marginRight: 6, color: D.amber, fontFamily: mn, fontSize: 9 }}>{i + 1}</strong>
                      {s.headline}
                      {s.body ? <div style={{ color: D.txm, fontSize: 10, marginTop: 2 }}>{s.body}</div> : null}
                    </div>
                  ))}
                </div>
                {pack.igCarousel.caption ? <div style={{ fontFamily: ft, fontSize: 11, color: D.txm, lineHeight: 1.5, padding: "6px 8px", background: "rgba(255,255,255,0.02)", borderRadius: 4 }}>{pack.igCarousel.caption}</div> : null}
              </PackCard>
            ) : null}

            {pack.tiktok ? (
              <PackCard title="TikTok" copyKey="tiktok" pack={pack.tiktok} copied={copied} onCopy={copy}>
                <div style={{ fontFamily: ft, fontSize: 12, color: D.tx, lineHeight: 1.6 }}>{pack.tiktok}</div>
              </PackCard>
            ) : null}

            {pack.igStory ? (
              <PackCard title="IG Story" copyKey="ig-story" pack={pack.igStory} copied={copied} onCopy={copy}>
                <div style={{ fontFamily: gf, fontSize: 14, color: D.tx, fontWeight: 700 }}>{pack.igStory}</div>
              </PackCard>
            ) : null}

            {pack.quoteCard ? (
              <PackCard title="Quote Card" copyKey="quote" pack={`"${pack.quoteCard.quote}"\n— ${pack.quoteCard.attribution} (${pack.quoteCard.source})`} copied={copied} onCopy={copy}>
                <div style={{ fontFamily: gf, fontSize: 13, fontStyle: "italic", color: D.tx, lineHeight: 1.5, marginBottom: 6 }}>&quot;{pack.quoteCard.quote}&quot;</div>
                <div style={{ fontFamily: mn, fontSize: 10, color: D.amber, letterSpacing: 0.6, textTransform: "uppercase" }}>— {pack.quoteCard.attribution} · {pack.quoteCard.source}</div>
              </PackCard>
            ) : null}

            {pack.newsletter ? (
              <PackCard title="Newsletter" copyKey="newsletter" pack={(pack.newsletter.tldr ? "TL;DR: " + pack.newsletter.tldr + "\n\n" : "") + (pack.newsletter.body || "")} copied={copied} onCopy={copy}>
                {pack.newsletter.tldr ? <div style={{ fontFamily: ft, fontSize: 12, color: D.amber, fontWeight: 700, marginBottom: 8 }}><strong>TL;DR:</strong> {pack.newsletter.tldr}</div> : null}
                <div style={{ fontFamily: ft, fontSize: 12, color: D.tx, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{pack.newsletter.body}</div>
              </PackCard>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}

function PackCard({ title, copyKey, pack, copied, onCopy, children }: { title: string; copyKey: string; pack: string; copied: string | null; onCopy: (key: string, text: string) => void; children: React.ReactNode }) {
  return (
    <div style={{ background: D.surface, border: `1px solid ${D.border}`, borderRadius: 12, padding: "14px 16px", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
        <div style={{ fontFamily: mn, fontSize: 10, letterSpacing: 1.4, color: D.amber, textTransform: "uppercase" }}>{title}</div>
        <button
          type="button"
          onClick={() => onCopy(copyKey, pack)}
          style={{
            padding: "4px 10px",
            background: copied === copyKey ? D.teal : "transparent",
            color: copied === copyKey ? "#060608" : D.tx,
            border: `1px solid ${copied === copyKey ? D.teal : D.border}`,
            borderRadius: 4,
            fontFamily: mn,
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: 0.8,
            cursor: "pointer",
          }}
        >
          {copied === copyKey ? "COPIED" : "COPY"}
        </button>
      </div>
      <div>{children}</div>
    </div>
  );
}

const lbl: React.CSSProperties = { fontFamily: mn, fontSize: 10, letterSpacing: 1.2, textTransform: "uppercase", color: D.txd, marginBottom: 4 };
const inputStyle: React.CSSProperties = { width: "100%", padding: "10px 12px", background: D.bg, border: `1px solid ${D.border}`, borderRadius: 6, color: D.tx, fontFamily: ft, fontSize: 13, outline: "none", boxSizing: "border-box" };
