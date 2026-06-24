"use client";

// Distribution Pack — POAST's article-launch hub.
//
// New flow (matches the actual SA distribution format from the team):
//   1. Latest articles are auto-fetched from the SemiAnalysis Substack RSS
//      and shown as clickable cards at the top.
//   2. Click an article → pre-fills the unified launch post in SA's exact
//      template: title + subtitle + "READ NOW: <url>".
//   3. Same post copy goes to X / FB / Threads / LinkedIn. User can tweak
//      the text inline and pick which Buffer channels to push to.
//   4. "Send to Buffer" creates a Buffer draft per selected channel via
//      the existing /api/buffer createPost mutation.
//
// Legacy flow (paste an arbitrary article and get full multi-platform
// variants) is preserved under "Advanced pack" expander.

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { D, ft, gf, mn } from "./shared-constants";
import HeadlineDoctor from "./headline-doctor";
import VoiceScorer from "./voice-scorer";

interface Article {
  title: string;
  subtitle?: string;
  url: string;
  pubDate: string;
  authors?: string[];
  coverImage?: string;
  isPaid?: boolean;
}

interface BufferChannel {
  id: string;
  name: string;
  service: string;     // "twitter" | "linkedin" | "facebook" | "threads" | "instagram"
  avatar?: string;
  isDisconnected?: boolean;
}

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

// The launch-post services SA fires on every article publish.
const LAUNCH_SERVICES = ["twitter", "linkedin", "facebook", "threads"];

export default function DistributionPack() {
  // ── Article list ────────────────────────────────────────────────────
  const [articles, setArticles] = useState<Article[]>([]);
  const [articlesLoading, setArticlesLoading] = useState(true);
  const [articlesError, setArticlesError] = useState<string | null>(null);

  // ── Composed post ───────────────────────────────────────────────────
  const [activeArticle, setActiveArticle] = useState<Article | null>(null);
  const [postText, setPostText] = useState("");

  // ── Buffer ──────────────────────────────────────────────────────────
  const [channels, setChannels] = useState<BufferChannel[]>([]);
  const [channelsLoading, setChannelsLoading] = useState(true);
  const [channelsError, setChannelsError] = useState<string | null>(null);
  const [selectedChannels, setSelectedChannels] = useState<Record<string, boolean>>({});
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<{ ok: number; failed: Array<{ name: string; error: string }> } | null>(null);

  // ── Advanced pack (legacy) ──────────────────────────────────────────
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [advancedMode, setAdvancedMode] = useState<"text" | "url">("text");
  const [advancedUrl, setAdvancedUrl] = useState("");
  const [advancedText, setAdvancedText] = useState("");
  const [advancedTitle, setAdvancedTitle] = useState("");
  const [advancedLoading, setAdvancedLoading] = useState(false);
  const [pack, setPack] = useState<Pack | null>(null);
  const [advancedError, setAdvancedError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const loadArticles = useCallback(async () => {
    setArticlesLoading(true);
    try {
      const res = await fetch("/api/sa-articles?limit=10");
      const j = await res.json();
      if (!res.ok) {
        setArticlesError(j.error || "Couldn't load articles");
      } else {
        setArticles(j.articles || []);
        setArticlesError(null);
      }
    } catch (e) {
      setArticlesError(String(e));
    } finally {
      setArticlesLoading(false);
    }
  }, []);

  const loadChannels = useCallback(async () => {
    setChannelsLoading(true);
    try {
      const res = await fetch("/api/buffer?type=channels");
      const j = await res.json();
      if (!res.ok) {
        setChannelsError(j.error || "Couldn't load Buffer channels");
      } else {
        const chans: BufferChannel[] = (j.channels || []).filter((c: BufferChannel) => !c.isDisconnected);
        setChannels(chans);
        // Pre-select the four launch services if available.
        const preselect: Record<string, boolean> = {};
        chans.forEach((c) => {
          if (LAUNCH_SERVICES.includes((c.service || "").toLowerCase())) preselect[c.id] = true;
        });
        setSelectedChannels(preselect);
        setChannelsError(null);
      }
    } catch (e) {
      setChannelsError(String(e));
    } finally {
      setChannelsLoading(false);
    }
  }, []);

  useEffect(() => { loadArticles(); loadChannels(); }, [loadArticles, loadChannels]);

  // ── Compose: turn an article into SA's launch-post template ─────────
  function pickArticle(a: Article) {
    setActiveArticle(a);
    setPostText(composeLaunchPost(a));
    setSendResult(null);
  }

  const charCounts = useMemo(() => {
    return {
      x: postText.length,
      linkedin: postText.length,
      facebook: postText.length,
      threads: postText.length,
    };
  }, [postText]);

  // ── Send to Buffer ──────────────────────────────────────────────────
  async function sendToBuffer() {
    if (!postText.trim() || sending) return;
    const channelIds = Object.entries(selectedChannels).filter(([, v]) => v).map(([k]) => k);
    if (!channelIds.length) return;

    setSending(true);
    setSendResult(null);
    let ok = 0;
    const failed: Array<{ name: string; error: string }> = [];

    // Buffer's createPost accepts channelIds as an array but per-channel
    // text customization needs separate calls. We fire one per channel so
    // each draft is independently editable in Buffer.
    for (const channelId of channelIds) {
      const chan = channels.find((c) => c.id === channelId);
      try {
        const res = await fetch("/api/buffer", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "createPost",
            input: {
              channelIds: [channelId],
              text: postText.trim(),
              schedulingType: "draft",
              // Buffer's new AssetInput schema (May 2026) — discriminated
              // union per asset. Empty array if there's no media.
              assets: activeArticle?.coverImage
                ? [{ image: { url: activeArticle.coverImage } }]
                : [],
            },
          }),
        });
        const j = await res.json();
        // Sprint fix #15: previous check used `(j.post || !j.error)` which
        // counted a 200-with-no-post-and-no-error as success — Threads has
        // returned exactly that shape, which is why the user saw silent
        // failures. Require a real post object back from Buffer to count
        // it as ok. Anything else surfaces with its full error.
        const svc = (chan?.service || "").toLowerCase();
        if (res.ok && j.post && j.post.id) {
          ok++;
        } else if (res.ok && !j.post) {
          failed.push({
            name: chan?.name || channelId,
            error: (svc === "threads" ? "Threads draft: " : "") + (j.error || `Buffer accepted the call but returned no post object (likely a per-service rejection — for Threads this usually means the channel needs reconnect in Buffer settings, or the post copy violates Threads policy).`),
          });
        } else {
          failed.push({ name: chan?.name || channelId, error: j.error || ("HTTP " + res.status) });
        }
      } catch (e) {
        failed.push({ name: chan?.name || channelId, error: String(e) });
      }
    }
    setSendResult({ ok, failed });
    setSending(false);
  }

  // ── Advanced pack: legacy multi-platform variant generator ──────────
  async function generateAdvancedPack() {
    setAdvancedLoading(true);
    setAdvancedError(null);
    setPack(null);
    try {
      const res = await fetch("/api/distribution-pack", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: advancedMode === "url" ? advancedUrl.trim() : (activeArticle?.url || undefined),
          text: advancedMode === "text" ? advancedText.trim() : undefined,
          title: advancedTitle.trim() || activeArticle?.title,
        }),
      });
      const j = await res.json();
      if (!res.ok) {
        setAdvancedError(j.error || "Generation failed");
        return;
      }
      setPack(j.pack as Pack);
    } catch (e) {
      setAdvancedError(String(e));
    } finally {
      setAdvancedLoading(false);
    }
  }

  async function copy(key: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(null), 1500);
    } catch { /* ignore */ }
  }

  const channelCount = Object.values(selectedChannels).filter(Boolean).length;

  return (
    <div style={{ maxWidth: 1180, margin: "0 auto", padding: "40px 32px" }}>
      <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "4px 10px", borderRadius: 999, background: "rgba(247,176,65,0.10)", border: `1px solid ${D.amber}55`, marginBottom: 14 }}>
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: D.amber, boxShadow: `0 0 8px ${D.amber}` }} />
        <span style={{ fontFamily: mn, fontSize: 10, letterSpacing: 1.4, color: D.amber, textTransform: "uppercase" }}>Launch hub</span>
      </div>
      <h1 style={{ fontFamily: gf, fontSize: 38, fontWeight: 900, letterSpacing: -1, margin: 0, marginBottom: 8, color: D.tx }}>Distribution Pack</h1>
      <div style={{ fontFamily: ft, fontSize: 15, color: D.txm, maxWidth: 720, lineHeight: 1.5, marginBottom: 24 }}>
        Pick a freshly-published SA article. Same launch post for X, Facebook, Threads, and LinkedIn. Push straight to Buffer as drafts.
      </div>

      {/* Article list */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
          <div style={lbl}>Latest articles</div>
          <button type="button" onClick={loadArticles} style={{ background: "transparent", border: "none", color: D.amber, fontFamily: mn, fontSize: 11, cursor: "pointer", textDecoration: "underline", letterSpacing: 0.4 }}>
            {articlesLoading ? "Loading…" : "Refresh"}
          </button>
        </div>
        {articlesError ? <div style={{ fontFamily: mn, fontSize: 11, color: D.coral, marginBottom: 10 }}>{articlesError}</div> : null}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 10 }}>
          {articles.map((a) => {
            const active = activeArticle?.url === a.url;
            return (
              <button
                data-glass=""
                type="button"
                key={a.url}
                onClick={() => pickArticle(a)}
                style={{
                  background: active ? "rgba(247,176,65,0.10)" : D.surface,
                  border: `1px solid ${active ? D.amber : D.border}`,
                  borderRadius: 10,
                  padding: 0,
                  cursor: "pointer",
                  fontFamily: ft,
                  color: D.tx,
                  textAlign: "left",
                  display: "flex",
                  flexDirection: "column",
                  overflow: "hidden",
                }}
              >
                {a.coverImage ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={a.coverImage} alt="" style={{ width: "100%", aspectRatio: "16/9", objectFit: "cover", display: "block" }} />
                ) : null}
                <div style={{ padding: "10px 12px" }}>
                  <div style={{ fontFamily: gf, fontSize: 13.5, fontWeight: 700, color: D.tx, letterSpacing: -0.3, lineHeight: 1.3, marginBottom: 4 }}>
                    {a.title}
                  </div>
                  {a.subtitle ? (
                    <div style={{ fontFamily: ft, fontSize: 11.5, color: D.txm, lineHeight: 1.4, marginBottom: 6, maxHeight: 50, overflow: "hidden" }}>
                      {a.subtitle.length > 140 ? a.subtitle.slice(0, 140) + "…" : a.subtitle}
                    </div>
                  ) : null}
                  <div style={{ display: "flex", gap: 6, alignItems: "center", fontFamily: mn, fontSize: 9, color: D.txd, letterSpacing: 0.4 }}>
                    <span>{a.pubDate ? new Date(a.pubDate).toLocaleDateString() : ""}</span>
                    {a.isPaid ? <span style={{ padding: "1px 5px", border: `1px solid ${D.amber}55`, color: D.amber, borderRadius: 3 }}>PAID</span> : null}
                  </div>
                </div>
              </button>
            );
          })}
          {articlesLoading && articles.length === 0 ? <div style={{ fontFamily: mn, fontSize: 11, color: D.txd, gridColumn: "1 / -1", padding: 20 }}>Loading…</div> : null}
        </div>
      </div>

      {/* Composer */}
      {activeArticle ? (
        <div data-glass="" style={{ background: D.surface, border: `1px solid ${D.border}`, borderRadius: 14, padding: 22, marginBottom: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 14 }}>
            <div>
              <div style={lbl}>Launch post · same copy across all 4 platforms</div>
              <div style={{ fontFamily: gf, fontSize: 18, fontWeight: 800, color: D.tx, letterSpacing: -0.5, marginTop: 4 }}>
                {activeArticle.title}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setPostText(composeLaunchPost(activeArticle))}
              style={{ background: "transparent", border: `1px solid ${D.border}`, color: D.tx, padding: "6px 12px", borderRadius: 6, fontFamily: mn, fontSize: 11, cursor: "pointer", letterSpacing: 0.4 }}
            >
              Reset to template
            </button>
          </div>
          <textarea
            value={postText}
            onChange={(e) => setPostText(e.target.value)}
            style={{
              width: "100%",
              minHeight: 200,
              padding: "14px 16px",
              background: D.bg,
              border: `1px solid ${D.border}`,
              borderRadius: 10,
              color: D.tx,
              fontFamily: ft,
              fontSize: 14,
              outline: "none",
              boxSizing: "border-box",
              resize: "vertical",
              lineHeight: 1.6,
            }}
          />
          <div style={{ display: "flex", gap: 14, marginTop: 8, fontFamily: mn, fontSize: 10, color: D.txd, letterSpacing: 0.4, flexWrap: "wrap" }}>
            <span>X: <strong style={{ color: charCounts.x > 280 ? D.coral : D.tx }}>{charCounts.x}</strong>/280</span>
            <span>LinkedIn: <strong style={{ color: charCounts.linkedin > 3000 ? D.coral : D.tx }}>{charCounts.linkedin}</strong>/3000</span>
            <span>FB: <strong style={{ color: D.tx }}>{charCounts.facebook}</strong></span>
            <span>Threads: <strong style={{ color: charCounts.threads > 500 ? D.coral : D.tx }}>{charCounts.threads}</strong>/500</span>
            <span style={{ marginLeft: "auto" }}>
              <button type="button" onClick={() => copy("post", postText)} style={{ background: copied === "post" ? D.teal : "transparent", color: copied === "post" ? "#060608" : D.amber, border: `1px solid ${copied === "post" ? D.teal : D.amber}`, padding: "3px 10px", borderRadius: 4, fontFamily: mn, fontSize: 9, fontWeight: 700, letterSpacing: 0.6, cursor: "pointer" }}>
                {copied === "post" ? "COPIED" : "COPY POST"}
              </button>
            </span>
          </div>

          {/* Buffer channels + Send */}
          <div style={{ marginTop: 20, borderTop: `1px solid ${D.border}`, paddingTop: 16 }}>
            <div style={lbl}>Buffer channels</div>
            {channelsLoading ? (
              <div style={{ fontFamily: mn, fontSize: 11, color: D.txd }}>Loading channels…</div>
            ) : channelsError ? (
              <div style={{ fontFamily: mn, fontSize: 11, color: D.coral }}>{channelsError}. Configure BUFFER_API_KEY to enable direct send.</div>
            ) : channels.length === 0 ? (
              <div style={{ fontFamily: mn, fontSize: 11, color: D.txd }}>No connected channels.</div>
            ) : (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
                {channels.map((c) => {
                  const on = !!selectedChannels[c.id];
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setSelectedChannels((p) => ({ ...p, [c.id]: !p[c.id] }))}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "6px 12px",
                        background: on ? "rgba(247,176,65,0.10)" : "transparent",
                        border: `1px solid ${on ? D.amber : D.border}`,
                        borderRadius: 6,
                        color: D.tx,
                        cursor: "pointer",
                        fontFamily: ft,
                        fontSize: 12,
                      }}
                    >
                      <span style={{ fontFamily: mn, fontSize: 9, color: on ? D.amber : D.txd, letterSpacing: 0.6, textTransform: "uppercase" }}>{c.service}</span>
                      {c.name}
                    </button>
                  );
                })}
              </div>
            )}

            <button
              type="button"
              onClick={sendToBuffer}
              disabled={sending || !postText.trim() || channelCount === 0}
              style={{
                background: D.amber,
                color: "#060608",
                border: "none",
                padding: "12px 22px",
                borderRadius: 10,
                fontFamily: ft,
                fontSize: 14,
                fontWeight: 800,
                cursor: sending || !postText.trim() || channelCount === 0 ? "not-allowed" : "pointer",
                opacity: sending || !postText.trim() || channelCount === 0 ? 0.5 : 1,
              }}
            >
              {sending ? "Sending to Buffer…" : channelCount === 0 ? "Pick at least one channel" : `Send to Buffer as drafts (${channelCount})`}
            </button>

            {sendResult ? (
              <div style={{ marginTop: 14, padding: "10px 14px", background: D.bg, borderRadius: 8, border: `1px solid ${D.border}` }}>
                <div style={{ fontFamily: mn, fontSize: 11, color: D.teal, letterSpacing: 0.4, marginBottom: 4 }}>
                  {sendResult.ok} draft{sendResult.ok === 1 ? "" : "s"} created in Buffer.
                </div>
                {sendResult.failed.length > 0 ? (
                  <div style={{ marginTop: 6 }}>
                    <div style={{ fontFamily: mn, fontSize: 10, color: D.coral, fontWeight: 700, letterSpacing: 0.4, marginBottom: 4 }}>
                      {sendResult.failed.length} channel{sendResult.failed.length === 1 ? "" : "s"} failed:
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      {sendResult.failed.map((f, i) => (
                        <div key={i} style={{ fontFamily: mn, fontSize: 10.5, color: D.coral, padding: "5px 8px", background: D.coral + "12", border: `1px solid ${D.coral}40`, borderRadius: 6, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>
                          <strong>{f.name}</strong>: {f.error}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
                <a href="https://publish.buffer.com" target="_blank" rel="noopener noreferrer" style={{ fontFamily: mn, fontSize: 10, color: D.amber, textDecoration: "underline", letterSpacing: 0.4 }}>Open Buffer →</a>
              </div>
            ) : null}
          </div>
        </div>
      ) : (
        <div data-glass="" style={{ ...emptyBox, marginBottom: 24 }}>
          Pick an article above to compose the launch post. The template fills in title, subtitle, and the READ NOW link automatically.
        </div>
      )}

      {/* Advanced (legacy) */}
      <div data-glass="" style={{ background: D.surface, border: `1px solid ${D.border}`, borderRadius: 12, marginBottom: 24 }}>
        <button
          type="button"
          onClick={() => setAdvancedOpen((v) => !v)}
          style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 18px", background: "transparent", border: "none", color: D.tx, fontFamily: ft, fontSize: 13, fontWeight: 700, cursor: "pointer" }}
        >
          <span>Advanced pack · multi-platform variants from any article</span>
          <span style={{ fontFamily: mn, fontSize: 11, color: D.txm }}>{advancedOpen ? "−" : "+"}</span>
        </button>

        {advancedOpen ? (
          <div style={{ padding: "0 18px 18px", borderTop: `1px solid ${D.border}` }}>
            <div style={{ display: "flex", gap: 8, marginTop: 14, marginBottom: 14 }}>
              {(["text", "url"] as const).map((m) => {
                const active = advancedMode === m;
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setAdvancedMode(m)}
                    style={{ padding: "6px 14px", background: active ? D.amber : "transparent", color: active ? "#060608" : D.tx, border: `1px solid ${active ? D.amber : D.border}`, borderRadius: 6, fontFamily: mn, fontSize: 11, cursor: "pointer", letterSpacing: 0.4 }}
                  >
                    {m === "text" ? "Paste article" : "Paste URL"}
                  </button>
                );
              })}
            </div>

            <input
              value={advancedTitle}
              onChange={(e) => setAdvancedTitle(e.target.value)}
              placeholder="Article title (optional — auto-filled from picked article)"
              style={{ ...inputStyle, marginBottom: 10 }}
            />

            {advancedMode === "url" ? (
              <input
                value={advancedUrl}
                onChange={(e) => setAdvancedUrl(e.target.value)}
                placeholder="https://newsletter.semianalysis.com/p/..."
                style={inputStyle}
              />
            ) : (
              <textarea
                value={advancedText}
                onChange={(e) => setAdvancedText(e.target.value)}
                placeholder="Paste full article text…"
                style={{ ...inputStyle, minHeight: 180, resize: "vertical" }}
              />
            )}

            <button
              type="button"
              onClick={generateAdvancedPack}
              disabled={advancedLoading || (advancedMode === "url" ? !advancedUrl.trim() && !activeArticle : advancedText.trim().length < 200)}
              style={{ marginTop: 12, background: D.amber, color: "#060608", border: "none", padding: "10px 20px", borderRadius: 8, fontFamily: ft, fontSize: 13, fontWeight: 800, cursor: advancedLoading ? "wait" : "pointer", opacity: advancedLoading ? 0.6 : 1 }}
            >
              {advancedLoading ? "Drafting multi-platform pack…" : "Generate full pack"}
            </button>
            {advancedError ? <div style={{ marginTop: 10, fontFamily: mn, fontSize: 11, color: D.coral }}>{advancedError}</div> : null}

            {pack ? <AdvancedPackView pack={pack} copied={copied} onCopy={copy} /> : null}
          </div>
        ) : null}
      </div>

      {/* ── POAST Suite ──────────────────────────────────────────────
          Headline Doctor + Voice Scorer wedged in as collapsible
          panels so the launch flow can sanity-check the headline and
          voice before pushing drafts to Buffer, without leaving the
          page or context-switching to the sidebar tools. */}
      <PoastSuite />
    </div>
  );
}

function PoastSuite() {
  const [openTool, setOpenTool] = useState<null | "headline" | "voice">(null);
  return (
    <div style={{ marginTop: 36 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 10 }}>
        <div style={{ fontFamily: gf, fontSize: 18, fontWeight: 800, color: D.tx, letterSpacing: -0.4 }}>POAST suite</div>
        <div style={{ fontFamily: mn, fontSize: 10, color: D.txd, letterSpacing: 0.6 }}>
          Headline + voice sanity-checks. Click to expand. Tune your post before it hits the queue.
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 8 }}>
        <SuiteCard
          open={openTool === "headline"}
          onToggle={() => setOpenTool((cur) => cur === "headline" ? null : "headline")}
          title="Headline Doctor"
          sub="Diagnose and rewrite the article headline before launch"
        />
        <SuiteCard
          open={openTool === "voice"}
          onToggle={() => setOpenTool((cur) => cur === "voice" ? null : "voice")}
          title="Voice Scorer"
          sub="Score the launch post against the SA voice profile"
        />
      </div>
      {openTool === "headline" ? (
        <div data-glass="" style={{ background: D.surface, border: `1px solid ${D.border}`, borderRadius: 12, padding: "20px 24px" }}>
          <HeadlineDoctor />
        </div>
      ) : null}
      {openTool === "voice" ? (
        <div data-glass="" style={{ background: D.surface, border: `1px solid ${D.border}`, borderRadius: 12, padding: "20px 24px" }}>
          <VoiceScorer />
        </div>
      ) : null}
    </div>
  );
}

function SuiteCard({ open, onToggle, title, sub }: { open: boolean; onToggle: () => void; title: string; sub: string }) {
  return (
    <button
      data-glass=""
      type="button"
      onClick={onToggle}
      style={{
        textAlign: "left",
        padding: "14px 16px",
        background: open ? "rgba(247,176,65,0.08)" : D.surface,
        border: `1px solid ${open ? D.amber + "55" : D.border}`,
        borderRadius: 10,
        color: D.tx,
        cursor: "pointer",
        fontFamily: ft,
        transition: "background 0.15s ease, border-color 0.15s ease",
        display: "flex",
        alignItems: "center",
        gap: 12,
      }}
    >
      <span style={{ flex: 1 }}>
        <span style={{ display: "block", fontFamily: gf, fontSize: 15, fontWeight: 700, color: open ? D.amber : D.tx, marginBottom: 2, letterSpacing: -0.3 }}>{title}</span>
        <span style={{ display: "block", fontFamily: ft, fontSize: 12, color: D.txm, lineHeight: 1.4 }}>{sub}</span>
      </span>
      <span style={{ fontFamily: mn, fontSize: 11, color: open ? D.amber : D.txd, letterSpacing: 0.6 }}>
        {open ? "▾ hide" : "▸ open"}
      </span>
    </button>
  );
}

// SA's exact launch post template (matches the screenshots from the team).
//   Line 1: title
//   Line 2: subtitle (full)
//   blank
//   "READ NOW: <url>"
// X is 280 chars — most SA subtitles fit. Long ones get truncated by
// the user with the inline counter as a guide.
function composeLaunchPost(a: Article): string {
  const lines: string[] = [];
  lines.push(a.title);
  if (a.subtitle) lines.push(a.subtitle);
  lines.push("");
  lines.push("READ NOW: " + a.url);
  return lines.join("\n");
}

function AdvancedPackView({ pack, copied, onCopy }: { pack: Pack; copied: string | null; onCopy: (key: string, text: string) => void }) {
  return (
    <div style={{ marginTop: 18 }}>
      {pack.summary ? (
        <div style={{ background: D.amber + "10", border: `1px solid ${D.amber}40`, borderRadius: 10, padding: "12px 16px", marginBottom: 14 }}>
          {pack.summary.hook ? <div style={{ fontFamily: gf, fontSize: 18, fontWeight: 800, color: D.tx, marginBottom: 6 }}>{pack.summary.hook}</div> : null}
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", fontFamily: ft, fontSize: 12, color: D.txm }}>
            {pack.summary.keyClaim ? <span><strong style={{ color: D.amber, fontFamily: mn, fontSize: 9, marginRight: 6 }}>CLAIM</strong>{pack.summary.keyClaim}</span> : null}
            {pack.summary.audienceTakeaway ? <span><strong style={{ color: D.amber, fontFamily: mn, fontSize: 9, marginRight: 6 }}>SO WHAT</strong>{pack.summary.audienceTakeaway}</span> : null}
          </div>
        </div>
      ) : null}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        {pack.xThread ? (
          <PackCard title="X Thread" copyKey="x-thread" text={pack.xThread.map((t, i) => (i + 1) + "/ " + t).join("\n\n")} copied={copied} onCopy={onCopy} charCount={pack.xThread.length ? Math.max(...pack.xThread.map((t) => t.length)) : 0} charLimit={PLATFORM_LIMITS.x} platformLabel="X" chipNote="longest tweet">
            {pack.xThread.map((t, i) => (
              <div key={i} style={{ fontFamily: ft, fontSize: 12, color: D.tx, padding: "6px 10px", background: "rgba(255,255,255,0.02)", borderRadius: 6, marginBottom: 4, lineHeight: 1.5 }}>
                <span style={{ fontFamily: mn, fontSize: 10, color: D.amber, marginRight: 6 }}>{i + 1}/</span>{t}
              </div>
            ))}
          </PackCard>
        ) : null}
        {pack.linkedinArticle ? (
          <PackCard title="LinkedIn Article" copyKey="li-article" text={[pack.linkedinArticle.headline, pack.linkedinArticle.subhead, "", pack.linkedinArticle.body].filter(Boolean).join("\n\n")} copied={copied} onCopy={onCopy} charCount={[pack.linkedinArticle.headline, pack.linkedinArticle.subhead, "", pack.linkedinArticle.body].filter(Boolean).join("\n\n").length} charLimit={PLATFORM_LIMITS.linkedin} platformLabel="in">
            <div style={{ fontFamily: gf, fontSize: 14, fontWeight: 700, color: D.tx, marginBottom: 4 }}>{pack.linkedinArticle.headline}</div>
            <div style={{ fontFamily: ft, fontSize: 12, color: D.txm, whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{pack.linkedinArticle.body}</div>
          </PackCard>
        ) : null}
        {pack.igCarousel ? (
          <PackCard title="IG Carousel" copyKey="ig-carousel" text={(pack.igCarousel.slides || []).map((s, i) => `Slide ${i + 1}: ${s.headline}\n${s.body}`).join("\n\n") + "\n\n" + (pack.igCarousel.caption || "")} copied={copied} onCopy={onCopy} charCount={(pack.igCarousel.caption || "").length} charLimit={PLATFORM_LIMITS.instagram} platformLabel="IG" chipNote="caption">
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {(pack.igCarousel.slides || []).map((s, i) => (
                <div key={i} style={{ fontFamily: ft, fontSize: 11, color: D.tx, padding: "4px 8px", background: "rgba(255,255,255,0.02)", borderRadius: 4, borderLeft: `2px solid ${D.amber}` }}>
                  <strong style={{ color: D.amber, fontFamily: mn, fontSize: 9, marginRight: 6 }}>{i + 1}</strong>{s.headline}
                </div>
              ))}
            </div>
          </PackCard>
        ) : null}
        {pack.tiktok ? (
          <PackCard title="TikTok" copyKey="tiktok" text={pack.tiktok} copied={copied} onCopy={onCopy} charCount={pack.tiktok.length} charLimit={PLATFORM_LIMITS.tiktok} platformLabel="TT">
            <div style={{ fontFamily: ft, fontSize: 12, color: D.tx, lineHeight: 1.6 }}>{pack.tiktok}</div>
          </PackCard>
        ) : null}
        {pack.quoteCard ? (
          <PackCard title="Quote Card" copyKey="quote" text={`"${pack.quoteCard.quote}"\n— ${pack.quoteCard.attribution} (${pack.quoteCard.source})`} copied={copied} onCopy={onCopy}>
            <div style={{ fontFamily: gf, fontSize: 13, fontStyle: "italic", color: D.tx, lineHeight: 1.5 }}>&quot;{pack.quoteCard.quote}&quot;</div>
            <div style={{ fontFamily: mn, fontSize: 10, color: D.amber, marginTop: 4 }}>— {pack.quoteCard.attribution} · {pack.quoteCard.source}</div>
          </PackCard>
        ) : null}
        {pack.newsletter ? (
          <PackCard title="Newsletter" copyKey="newsletter" text={(pack.newsletter.tldr ? "TL;DR: " + pack.newsletter.tldr + "\n\n" : "") + (pack.newsletter.body || "")} copied={copied} onCopy={onCopy}>
            {pack.newsletter.tldr ? <div style={{ fontFamily: ft, fontSize: 12, color: D.amber, fontWeight: 700, marginBottom: 6 }}>TL;DR: {pack.newsletter.tldr}</div> : null}
            <div style={{ fontFamily: ft, fontSize: 12, color: D.tx, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{pack.newsletter.body}</div>
          </PackCard>
        ) : null}
      </div>
    </div>
  );
}

function PackCard({ title, copyKey, text, copied, onCopy, children, charCount, charLimit, platformLabel, chipNote }: { title: string; copyKey: string; text: string; copied: string | null; onCopy: (k: string, t: string) => void; children: React.ReactNode; charCount?: number; charLimit?: number; platformLabel?: string; chipNote?: string }) {
  return (
    <div style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${D.border}`, borderRadius: 10, padding: "12px 14px", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8, gap: 8 }}>
        <div style={{ fontFamily: mn, fontSize: 10, letterSpacing: 1.4, color: D.amber, textTransform: "uppercase" }}>{title}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {typeof charCount === "number" && typeof charLimit === "number" && platformLabel ? (
            <CharChip count={charCount} limit={charLimit} label={platformLabel} note={chipNote} />
          ) : null}
          <button
            type="button"
            onClick={() => onCopy(copyKey, text)}
            style={{ padding: "3px 10px", background: copied === copyKey ? D.teal : "transparent", color: copied === copyKey ? "#060608" : D.tx, border: `1px solid ${copied === copyKey ? D.teal : D.border}`, borderRadius: 4, fontFamily: mn, fontSize: 9, fontWeight: 700, letterSpacing: 0.8, cursor: "pointer" }}
          >
            {copied === copyKey ? "COPIED" : "COPY"}
          </button>
        </div>
      </div>
      <div>{children}</div>
    </div>
  );
}

// Per-platform character limits used by the chip on each PackCard.
const PLATFORM_LIMITS = {
  x: 280,
  linkedin: 3000,
  facebook: 5000,
  instagram: 2200,
  tiktok: 2200,
  youtubeShortsTitle: 100,
  youtubeShortsDescription: 5000,
} as const;

function CharChip({ count, limit, label, note }: { count: number; limit: number; label: string; note?: string }) {
  const ratio = count / limit;
  // Over the limit is red regardless of how far; 80%+ is yellow; below is green.
  const color = count > limit ? D.coral : ratio >= 0.8 ? D.amber : D.teal;
  return (
    <span
      title={note ? `${note} — ${count} / ${limit}` : `${count} / ${limit}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "2px 7px",
        borderRadius: 999,
        border: `1px solid ${color}55`,
        background: color + "12",
        color: color,
        fontFamily: mn,
        fontSize: 9.5,
        letterSpacing: 0.8,
        fontWeight: 700,
        whiteSpace: "nowrap",
      }}
    >
      {count} / {limit} {label}
    </span>
  );
}

const lbl: React.CSSProperties = { fontFamily: mn, fontSize: 10, letterSpacing: 1.4, textTransform: "uppercase", color: D.txd, marginBottom: 6 };
const inputStyle: React.CSSProperties = { width: "100%", padding: "10px 12px", background: D.bg, border: `1px solid ${D.border}`, borderRadius: 6, color: D.tx, fontFamily: ft, fontSize: 13, outline: "none", boxSizing: "border-box" };
const emptyBox: React.CSSProperties = { border: `1px dashed ${D.border}`, borderRadius: 12, padding: 28, background: D.surface, color: D.txm, fontFamily: ft, fontSize: 14, lineHeight: 1.5 };
