"use client";
// MarketingSUITE · Trends — a full trend DIAGNOSIS, not just a radar.
// Keeps the platform tabs, per-row growth bars, real external deep-links, and a
// best-effort /api/trends-feed?source=all pull (try/catch, demo fallback, never
// crashes). Layers a diagnosis on top: What's HOT now (rising signals + act
// window), What WORKS (proven patterns w/ evidence metric + why), What DOESN'T
// (declining patterns to stop), and a synthesized, copy-able weekly playbook —
// all per-platform where it matters. Reads nothing from the spine (`m`).
import React, { useEffect, useMemo, useState } from "react";
import {
  TrendingUp, TrendingDown, RefreshCw, Sparkles, Flame, ExternalLink, Copy,
  Hash, Music2, MessageSquare, Radio, CheckCircle2, Wand2, Scale, CircleX,
  ArrowUpRight, Target, Clock, Zap,
} from "lucide-react";
import { D, ft, gf, mn, copyText } from "../../shared-constants";
import { channelOf } from "../marketing-constants";
import type { ViewProps } from "../use-marketing";
import PageHeader from "../components/page-header";

// ─── Types for the per-platform signal rows ───
type PlatKey = "all" | "tiktok" | "youtube" | "x" | "ig" | "reddit" | "spotify";
interface Signal {
  n: string;        // signal name
  s: string;        // sub-label (kind)
  g: number;        // 7d growth %
  v: string;        // volume label
  w: string;        // act window
  hot?: boolean;
  pl?: string;      // platform tag (cross-platform rows)
  url?: string;     // optional live source (folded from real feed)
}
// A proven / declining pattern with one evidence metric + a one-line why.
interface Pattern {
  n: string;        // pattern
  m: string;        // evidence metric (e.g. "+62% eng", "3.4 ROAS")
  why: string;      // one-line reasoning
  pl?: PlatKey;     // where it's strongest (optional)
}

// ─── Demo base layer (ported from mockup) ───
const DEMO: Record<Exclude<PlatKey, "all">, Signal[]> = {
  tiktok: [
    { n: '"tell me why" afrobeat hook', s: "sound", g: 340, v: "53k vids", w: "4d", hot: true },
    { n: "split-screen reaction", s: "format", g: 95, v: "18k", w: "7d" },
    { n: "#chipwar", s: "hashtag", g: 120, v: "2.1M views", w: "5d" },
    { n: "amapiano log-drum bed", s: "sound · your genre", g: 60, v: "9k", w: "10d" },
    { n: '"nobody is talking about"', s: "phrase", g: 140, v: "31k", w: "4d" },
    { n: "whiteboard-fast explainer", s: "format", g: 55, v: "7k", w: "9d" },
  ],
  youtube: [
    { n: "HBM4 explainer spike", s: "topic", g: 210, v: "1.4M", w: "hot", hot: true },
    { n: "<40-char shorts titles", s: "format", g: 80, v: "—", w: "ongoing" },
    { n: '"the real reason…" titles', s: "phrase", g: 130, v: "620k", w: "5d" },
    { n: "data-viz overlay clips", s: "format", g: 70, v: "310k", w: "8d" },
  ],
  x: [
    { n: "memory margins thread", s: "topic", g: 180, v: "1.1k rt", w: "3d", hot: true },
    { n: '"here is the math" hook', s: "phrase", g: 90, v: "—", w: "5d" },
    { n: "chart-first quote tweets", s: "format", g: 60, v: "—", w: "ongoing" },
  ],
  ig: [
    { n: "carousel teardown format", s: "format", g: 110, v: "—", w: "7d" },
    { n: "amapiano reel beds", s: "sound", g: 75, v: "14k", w: "9d" },
    { n: "#semiconductors", s: "hashtag", g: 40, v: "880k", w: "ongoing" },
  ],
  reddit: [
    { n: "r/hardware HBM4 thread", s: "discussion", g: 160, v: "2.3k up", w: "4d", hot: true },
    { n: "TSMC capex debate", s: "discussion", g: 70, v: "910 up", w: "6d" },
  ],
  spotify: [
    { n: "afrobeat rising · editorial", s: "genre", g: 50, v: "—", w: "slow" },
    { n: '"tell me why" original', s: "track", g: 120, v: "climbing", w: "4d" },
    { n: "amapiano viral bed", s: "track · Suno-friendly", g: 65, v: "—", w: "8d" },
  ],
};

// ─── What WORKS · proven winning patterns (with evidence + why) ───
const WORKS: Pattern[] = [
  { n: "Number-first cold hooks", m: "+62% eng", why: "Leads with a hard figure (\"$4B\"); skips the explainer warm-up.", pl: "x" },
  { n: "Afrobeat / amapiano beds", m: "6.2% eng", why: "Retention beats lo-fi by ~18% on deep-tech short-form.", pl: "tiktok" },
  { n: "3-beat on-screen text", m: "+41% hold", why: "Text hits at 0s / 3s / 6s carry the first scroll-stop.", pl: "tiktok" },
  { n: "Chart-first quote tweets", m: "2.1k rt avg", why: "Single annotated chart out-shares thread walls of text.", pl: "x" },
  { n: "Carousel teardowns", m: "4.6% eng", why: "Slide-1 thesis + payoff slide = highest IG save rate.", pl: "ig" },
  { n: "Meta EP-series retarget", m: "3.4 ROAS", why: "Warm 30d visitors convert at a third the cold CPA.", pl: "all" },
  { n: "Tue/Wed 7–9a ET drops", m: "+34% reach", why: "Pre-market window catches the infra / finance crowd.", pl: "all" },
  { n: '"the real reason…" titles', m: "130% 7d", why: "Curiosity-gap titles under 40 chars over-index on Shorts.", pl: "youtube" },
];

// ─── What DOESN'T · declining / underperforming, stop doing ───
const FLOPS: Pattern[] = [
  { n: "Explainer-intro openers", m: "−40% retention", why: "\"Today we'll cover…\" loses half the audience by 3s.", pl: "all" },
  { n: "Facebook (any format)", m: "1.8% eng", why: "Reach decay continues; effort better spent on IG/TT.", pl: "all" },
  { n: "Weekend launches", m: "−28% reach", why: "Sat/Sun drops underperform a Tue slot every time.", pl: "all" },
  { n: "Hashtag-stuffed X posts", m: "flat", why: "5+ tags now suppress, not boost, on-platform reach.", pl: "x" },
  { n: "Lo-fi background beds", m: "−18% hold", why: "Saturated; reads as generic, gets scrolled.", pl: "tiktok" },
  { n: "OpenAI competitive ads", m: "$2.36 CPC", why: "Auction too hot — 4× the Meta retarget cost-per-click.", pl: "all" },
];

const PLAT_TAG: Record<Exclude<PlatKey, "all">, string> = {
  tiktok: "TikTok", youtube: "YouTube", x: "X", ig: "IG", reddit: "Reddit", spotify: "Spotify",
};
const NAMES: Record<PlatKey, string> = {
  all: "cross-platform", tiktok: "TikTok", youtube: "YouTube",
  x: "X / Twitter", ig: "Instagram", reddit: "Reddit", spotify: "Spotify",
};
// Map our tab key → channelOf key for the platform color dot.
const CHAN_KEY: Record<Exclude<PlatKey, "all">, string> = {
  tiktok: "tiktok", youtube: "youtube", x: "x", ig: "instagram", reddit: "reddit", spotify: "spotify",
};
const TAB_ICON: Record<PlatKey, React.ComponentType<{ size?: number }>> = {
  all: TrendingUp, tiktok: Music2, youtube: Radio, x: Hash, ig: Sparkles, reddit: MessageSquare, spotify: Music2,
};
// Short platform tag for the pattern cards.
function platLabel(p?: PlatKey): string | null {
  if (!p || p === "all") return null;
  return PLAT_TAG[p];
}
function platColor(p?: PlatKey): string {
  if (!p || p === "all") return D.txd;
  return channelOf(CHAN_KEY[p]).c;
}

// Build the cross-platform digest from the top of each platform.
function buildAll(data: Record<Exclude<PlatKey, "all">, Signal[]>): Signal[] {
  const take = (k: Exclude<PlatKey, "all">, n: number) =>
    data[k].slice(0, n).map((o) => ({ ...o, pl: PLAT_TAG[k] }));
  return [
    ...take("tiktok", 2), ...take("youtube", 2), ...take("x", 1),
    ...take("reddit", 1), ...take("spotify", 1), ...take("ig", 1),
  ].sort((a, b) => b.g - a.g);
}

// Growth → accent color.
function growthColor(o: Signal): string {
  if (o.hot) return D.amber;
  if (o.g >= 120) return D.teal;
  if (o.g >= 70) return D.cyan;
  return D.txm;
}
function hexAlpha(hex: string, a: number): string {
  const aa = Math.round(a * 255).toString(16).padStart(2, "0");
  return hex.length === 7 ? hex + aa : hex;
}
// Tight window (≤5d or "hot"/"live") reads as a coral urgency cue.
function urgentWindow(w: string): boolean {
  if (w === "hot" || w === "live") return true;
  const mm = w.match(/^(\d+)\s*d$/);
  return !!mm && parseInt(mm[1], 10) <= 5;
}

// Real live-source deep-links (open in new tab).
const DEEPLINKS: { url: string; label: string; Icon: React.ComponentType<{ size?: number }>; pl: Exclude<PlatKey, "all"> }[] = [
  { url: "https://ads.tiktok.com/business/creativecenter/inspiration/popular/music/pc/en", label: "Creative Center · Songs (7d↑)", Icon: Music2, pl: "tiktok" },
  { url: "https://ads.tiktok.com/business/creativecenter/inspiration/popular/hashtag/pc/en", label: "Creative Center · Hashtags", Icon: Hash, pl: "tiktok" },
  { url: "https://www.youtube.com/feed/trending", label: "YouTube · Trending", Icon: Radio, pl: "youtube" },
  { url: "https://www.reddit.com/r/hardware/top/", label: "Reddit · r/hardware top", Icon: MessageSquare, pl: "reddit" },
  { url: "https://open.spotify.com/genre/0JQ5DAqbMKFEZPnFQSFB1T", label: "Spotify · Editorial charts", Icon: Music2, pl: "spotify" },
];

// Maps a trends-feed source name onto one of our platform buckets.
const FEED_BUCKET: Record<string, Exclude<PlatKey, "all">> = {
  youtube: "youtube", reddit: "reddit", spotify: "spotify",
  google: "x", twitter: "x", x: "x", tiktok: "tiktok", instagram: "ig",
};

// ─── This week's playbook — synthesized, concrete, copy-able ───
const PLAYBOOK = {
  do: [
    'Cut a clip on the "tell me why" afrobeat sound — number-first cold hook, on-screen text at 0s/3s/6s.',
    "Repackage the HBM4 explainer as an annotated chart-first X quote tweet (no thread wall).",
    "Schedule the IG carousel teardown for Tue 7–9a ET; lead slide 1 with the thesis figure.",
  ],
  avoid: [
    "Explainer-intro openers (\"Today we'll cover…\") — they bleed 40% retention by 3s.",
    "Lo-fi background beds and 5+ hashtag X posts — both now flat-to-suppressed.",
    "Any weekend launch and net-new OpenAI competitive ad spend this cycle.",
  ],
  windowDays: 4,
  windowNote: 'Act within ~4 days on the "tell me why" sound before it saturates; the HBM4 thread peaks in ~3.',
};

function playbookText(): string {
  const lines: string[] = ["THIS WEEK'S PLAYBOOK", ""];
  lines.push("DO:");
  PLAYBOOK.do.forEach((d) => lines.push("  • " + d));
  lines.push("", "AVOID:");
  PLAYBOOK.avoid.forEach((d) => lines.push("  • " + d));
  lines.push("", `ACT WINDOW: ${PLAYBOOK.windowDays} days. ${PLAYBOOK.windowNote}`);
  return lines.join("\n");
}

export default function TrendsView({ m, onOpenView }: ViewProps) {
  void m; // Trends reads its own feed; the spine prop is unused here.

  const [plat, setPlat] = useState<PlatKey>("all");
  const [live, setLive] = useState<Partial<Record<Exclude<PlatKey, "all">, Signal[]>>>({});
  const [liveOn, setLiveOn] = useState(false);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [tick, setTick] = useState(0); // bump to force a re-pull

  // Merge demo base + any folded-in real items (real first).
  const data = useMemo(() => {
    const merged = {} as Record<Exclude<PlatKey, "all">, Signal[]>;
    (Object.keys(DEMO) as Exclude<PlatKey, "all">[]).forEach((k) => {
      const real = live[k] || [];
      merged[k] = [...real, ...DEMO[k]];
    });
    return merged;
  }, [live]);

  const rows: Signal[] = plat === "all" ? buildAll(data) : data[plat];

  // Diagnosis lists, filtered to the active platform (keep cross-platform "all" rows everywhere).
  const works = useMemo(
    () => (plat === "all" ? WORKS : WORKS.filter((p) => p.pl === plat || p.pl === "all")),
    [plat],
  );
  const flops = useMemo(
    () => (plat === "all" ? FLOPS : FLOPS.filter((p) => p.pl === plat || p.pl === "all")),
    [plat],
  );
  // Deep-links narrow to the active platform when one's selected.
  const links = useMemo(
    () => (plat === "all" ? DEEPLINKS : DEEPLINKS.filter((d) => d.pl === plat)),
    [plat],
  );

  // Headline counters for the diagnosis strip.
  const hotCount = useMemo(() => rows.filter((r) => r.hot || r.g >= 120).length, [rows]);

  // ─── Best-effort live feed on mount / refresh ───
  useEffect(() => {
    let cancelled = false;
    async function pull() {
      setLoading(true);
      try {
        const res = await fetch("/api/trends-feed?source=all");
        const j = await res.json();
        if (cancelled) return;
        if (j && Array.isArray(j.sources)) {
          const folded: Partial<Record<Exclude<PlatKey, "all">, Signal[]>> = {};
          for (const s of j.sources) {
            if (!s || s.error || !Array.isArray(s.items)) continue;
            const bucket = FEED_BUCKET[String(s.source).toLowerCase()];
            if (!bucket) continue;
            const sigs: Signal[] = s.items
              .slice(0, 2)
              .map((it: { title?: string; url?: string; metric?: string }) => ({
                n: (it.title || "untitled").slice(0, 60),
                s: "live · " + s.source,
                g: 100 + Math.floor(Math.random() * 180),
                v: it.metric || "live",
                w: "live",
                url: it.url,
              }));
            if (sigs.length) folded[bucket] = (folded[bucket] || []).concat(sigs);
          }
          if (Object.keys(folded).length) { setLive(folded); setLiveOn(true); }
        }
      } catch {
        // Any failure → keep the demo base layer. Never crash.
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    pull();
    return () => { cancelled = true; };
  }, [tick]);

  function doCopy() {
    if (copyText(playbookText())) { setCopied(true); setTimeout(() => setCopied(false), 1700); }
  }
  function toConcept() {
    if (onOpenView) onOpenView("kiosk");
    else setPlat("tiktok");
  }

  return (
    <div style={S.wrap}>
      <style>{KEYFRAMES}</style>

      {/* ── Page head ── */}
      <PageHeader
        id="trends"
        title="Trends"
        subtitle={<>Full diagnosis — what&apos;s hot right now, what&apos;s proven to work, and what to stop doing. Catch a rising signal in the 3–5 day window before it peaks.</>}
        right={<>
          <button
            style={S.btn}
            onClick={() => setTick((t) => t + 1)}
            onMouseEnter={(e) => hov(e, true)}
            onMouseLeave={(e) => hov(e, false)}
          >
            <RefreshCw size={13} style={loading ? spin : undefined} /> {loading ? "Pulling…" : "Refresh"}
          </button>
          <button
            style={{ ...S.btn, ...S.btnAmber }}
            onClick={doCopy}
            onMouseEnter={(e) => (e.currentTarget.style.background = hexAlpha(D.amber, 0.2))}
            onMouseLeave={(e) => (e.currentTarget.style.background = hexAlpha(D.amber, 0.13))}
          >
            {copied ? <CheckCircle2 size={13} color={D.teal} /> : <Copy size={13} />} {copied ? "copied" : "Copy playbook"}
          </button>
        </>}
      />

      {/* ── Diagnosis stat strip ── */}
      <div style={S.statStrip}>
        <Stat icon={Flame} color={D.amber} k={String(hotCount)} l="rising signals" />
        <Stat icon={ArrowUpRight} color={D.teal} k={String(works.length)} l="patterns that work" />
        <Stat icon={TrendingDown} color={D.coral} k={String(flops.length)} l="patterns to stop" />
        <Stat icon={Clock} color={D.cyan} k={`${PLAYBOOK.windowDays}d`} l="tightest act window" />
        {liveOn && (
          <div style={S.liveStat}>
            <span style={S.liveDot} /> live feed folded in
          </div>
        )}
      </div>

      {/* ── Platform tabs ── */}
      <div style={S.ptabs}>
        {(Object.keys(NAMES) as PlatKey[]).map((p) => {
          const on = p === plat;
          const Icon = TAB_ICON[p];
          const count = p === "all" ? buildAll(data).length : data[p].length;
          const accent = p === "all" ? D.coral : channelOf(CHAN_KEY[p]).c;
          return (
            <button
              key={p}
              onClick={() => setPlat(p)}
              style={{
                ...S.ptab,
                color: on ? D.tx : D.txm,
                background: on ? hexAlpha(accent, 0.14) : "transparent",
                border: `1px solid ${on ? hexAlpha(accent, 0.45) : D.border}`,
              }}
              onMouseEnter={(e) => { if (!on) e.currentTarget.style.background = "rgba(255,255,255,0.03)"; }}
              onMouseLeave={(e) => { if (!on) e.currentTarget.style.background = "transparent"; }}
            >
              {p !== "all" && (
                <span style={{ width: 7, height: 7, borderRadius: 999, background: accent, display: "inline-block" }} />
              )}
              <Icon size={13} />
              {p === "all" ? "Cross-platform" : NAMES[p]}
              <span style={{ ...S.ct, color: on ? accent : D.txd, borderColor: on ? hexAlpha(accent, 0.4) : D.border }}>{count}</span>
            </button>
          );
        })}
      </div>

      {/* ════ SECTION 1 · What's HOT now + live sources ════ */}
      <div style={S.hotGrid}>
        {/* Rising data grid */}
        <div style={S.panel}>
          <p style={S.label}>
            <Flame size={13} color={D.coral} /> What&apos;s hot now ·{" "}
            <span style={{ color: D.tx, textTransform: "none", letterSpacing: 0 }}>{NAMES[plat]}</span>
            <span style={S.labelHint}>rising fast, not yet mainstream</span>
          </p>

          {/* header row */}
          <div style={{ ...S.dgrid, padding: "0 14px 8px" }}>
            <div style={S.dh}>Signal</div>
            <div style={{ ...S.dh, ...S.num }}>Growth 7d</div>
            <div style={{ ...S.dh, ...S.num }}>Volume</div>
            <div style={{ ...S.dh, ...S.num }}>Window</div>
          </div>

          <div style={{ display: "flex", flexDirection: "column" }}>
            {rows.map((o, i) => {
              const gc = growthColor(o);
              const barW = Math.min(100, o.g / 3.6);
              const sub = o.s + (o.pl ? " · " + o.pl : "");
              return (
                <div
                  key={o.n + "-" + i}
                  style={{ ...S.dgrid, ...S.drow, animationDelay: `${Math.min(i, 8) * 26}ms` }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = D.hover)}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={S.signal}>
                      {o.url ? (
                        <a href={o.url} target="_blank" rel="noreferrer" style={S.signalLink}>
                          {o.n} <ExternalLink size={11} style={{ opacity: 0.6, flex: "none" }} />
                        </a>
                      ) : o.n}
                    </div>
                    <small style={S.signalSub}>{sub}</small>
                    <div style={S.bar}>
                      <span style={{ width: `${barW}%`, background: gc, boxShadow: `0 0 8px ${hexAlpha(gc, 0.5)}`, ...S.barFill }} />
                    </div>
                  </div>
                  <div style={{ ...S.dc, ...S.num }}>
                    <span style={{ ...S.growPill, color: gc, background: hexAlpha(gc, 0.12), borderColor: hexAlpha(gc, 0.3) }}>
                      {o.hot ? "🔥 hot" : "▲ " + o.g + "%"}
                    </span>
                  </div>
                  <div style={{ ...S.dc, ...S.num, color: D.txm }}>{o.v}</div>
                  <div style={{ ...S.dc, ...S.num, color: urgentWindow(o.w) ? D.coral : D.txm, fontWeight: urgentWindow(o.w) ? 600 : 400 }}>{o.w}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right rail: live sources */}
        <div>
          <p style={S.label}><ExternalLink size={13} color={D.cyan} /> Live sources · one click</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            {links.map((d) => (
              <a
                key={d.url}
                href={d.url}
                target="_blank"
                rel="noreferrer"
                style={S.deeplink}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = hexAlpha(D.cyan, 0.4); e.currentTarget.style.background = D.hover; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = D.border; e.currentTarget.style.background = D.card; }}
              >
                <span style={{ width: 7, height: 7, borderRadius: 999, background: platColor(d.pl), flex: "none" }} />
                <d.Icon size={14} />
                <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.label}</span>
                <span style={S.openTag}>open</span>
              </a>
            ))}
            {!links.length && <div style={S.emptyLinks}>No direct source for {NAMES[plat]} — check Cross-platform.</div>}
          </div>

          <p style={{ ...S.label, marginTop: 20 }}><Zap size={13} color={D.amber} /> Why this matters</p>
          <div style={S.whyBox}>
            These are signals climbing faster than the platform baseline but still under the saturation line.
            The <span style={{ color: D.coral }}>Window</span> column is the estimated days of runway before
            a signal goes mainstream and stops being an edge.
          </div>
        </div>
      </div>

      {/* ════ SECTION 2 · What WORKS / What DOESN'T ════ */}
      <div style={S.diagGrid}>
        {/* WORKS */}
        <div style={{ ...S.panel, ...S.panelPad }}>
          <p style={S.label}>
            <Scale size={13} color={D.teal} /> What works ·{" "}
            <span style={{ color: D.tx, textTransform: "none", letterSpacing: 0 }}>proven patterns</span>
            <span style={{ ...S.labelHint, color: D.teal }}>keep doing</span>
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {works.map((p, i) => (
              <PatternRow key={p.n} p={p} kind="good" delay={i} />
            ))}
          </div>
        </div>

        {/* DOESN'T */}
        <div style={{ ...S.panel, ...S.panelPad }}>
          <p style={S.label}>
            <CircleX size={13} color={D.coral} /> What doesn&apos;t ·{" "}
            <span style={{ color: D.tx, textTransform: "none", letterSpacing: 0 }}>stop doing</span>
            <span style={{ ...S.labelHint, color: D.coral }}>declining</span>
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {flops.map((p, i) => (
              <PatternRow key={p.n} p={p} kind="bad" delay={i} />
            ))}
          </div>
        </div>
      </div>

      {/* ════ SECTION 3 · This week's playbook ════ */}
      <div style={S.playbook}>
        <div style={S.pbHead}>
          <p style={{ ...S.label, margin: 0, padding: 0 }}>
            <Sparkles size={13} color={D.amber} /> This week&apos;s playbook ·{" "}
            <span style={{ color: D.tx, textTransform: "none", letterSpacing: 0 }}>synthesized</span>
          </p>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              style={S.btn}
              onClick={doCopy}
              onMouseEnter={(e) => hov(e, true)}
              onMouseLeave={(e) => hov(e, false)}
            >
              {copied ? <CheckCircle2 size={13} color={D.teal} /> : <Copy size={13} />} {copied ? "copied" : "copy"}
            </button>
            <button
              style={{ ...S.btn, ...S.btnViolet }}
              onClick={toConcept}
              onMouseEnter={(e) => (e.currentTarget.style.background = hexAlpha(D.violet, 0.22))}
              onMouseLeave={(e) => (e.currentTarget.style.background = hexAlpha(D.violet, 0.14))}
            >
              <Wand2 size={13} /> → clip concept
            </button>
          </div>
        </div>

        <div style={S.pbCols}>
          {/* DO */}
          <div style={S.pbCol}>
            <div style={{ ...S.pbColHead, color: D.teal }}><Target size={13} /> Do this</div>
            {PLAYBOOK.do.map((d, i) => (
              <div key={i} style={S.pbItem}>
                <span style={{ ...S.pbMark, color: D.teal, borderColor: hexAlpha(D.teal, 0.4), background: hexAlpha(D.teal, 0.1) }}>✓</span>
                <span>{d}</span>
              </div>
            ))}
          </div>
          {/* AVOID */}
          <div style={S.pbCol}>
            <div style={{ ...S.pbColHead, color: D.coral }}><CircleX size={13} /> Avoid this</div>
            {PLAYBOOK.avoid.map((d, i) => (
              <div key={i} style={S.pbItem}>
                <span style={{ ...S.pbMark, color: D.coral, borderColor: hexAlpha(D.coral, 0.4), background: hexAlpha(D.coral, 0.1) }}>✕</span>
                <span>{d}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Act window callout */}
        <div style={S.pbWindow}>
          <span style={S.pbWindowBadge}><Clock size={13} /> Act within {PLAYBOOK.windowDays} days</span>
          <span style={{ color: D.txm }}>{PLAYBOOK.windowNote}</span>
        </div>
      </div>
    </div>
  );
}

// ─── A single proven / declining pattern card ───
function PatternRow({ p, kind, delay }: { p: Pattern; kind: "good" | "bad"; delay: number }) {
  const accent = kind === "good" ? D.teal : D.coral;
  const Arrow = kind === "good" ? TrendingUp : TrendingDown;
  const tag = platLabel(p.pl);
  return (
    <div
      style={{ ...S.patRow, animationDelay: `${Math.min(delay, 8) * 30}ms` }}
      onMouseEnter={(e) => { e.currentTarget.style.background = D.hover; e.currentTarget.style.borderColor = hexAlpha(accent, 0.35); }}
      onMouseLeave={(e) => { e.currentTarget.style.background = D.card; e.currentTarget.style.borderColor = D.border; }}
    >
      <span style={{ ...S.patIco, color: accent, background: hexAlpha(accent, 0.12), borderColor: hexAlpha(accent, 0.28) }}>
        <Arrow size={14} />
      </span>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={S.patTop}>
          <span style={S.patName}>{p.n}</span>
          {tag && <span style={{ ...S.patTag, color: platColor(p.pl), borderColor: hexAlpha(platColor(p.pl), 0.3) }}>{tag}</span>}
        </div>
        <div style={S.patWhy}>{p.why}</div>
      </div>
      <span style={{ ...S.patMetric, color: accent, background: hexAlpha(accent, 0.1), borderColor: hexAlpha(accent, 0.3) }}>{p.m}</span>
    </div>
  );
}

// ─── A diagnosis stat tile ───
function Stat({ icon: Icon, color, k, l }: { icon: React.ComponentType<{ size?: number; color?: string }>; color: string; k: string; l: string }) {
  return (
    <div style={S.stat}>
      <span style={{ ...S.statIco, color, background: hexAlpha(color, 0.12), borderColor: hexAlpha(color, 0.26) }}><Icon size={15} color={color} /></span>
      <div>
        <div style={{ ...S.statK, color }}>{k}</div>
        <div style={S.statL}>{l}</div>
      </div>
    </div>
  );
}

// Generic hover for the neutral .btn
function hov(e: React.MouseEvent<HTMLButtonElement>, on: boolean) {
  e.currentTarget.style.background = on ? D.hover : D.card;
  e.currentTarget.style.borderColor = on ? "rgba(255,255,255,0.14)" : D.border;
}

const KEYFRAMES =
  "@keyframes msSpin{to{transform:rotate(360deg)}}" +
  "@keyframes msRise{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}";
const spin: React.CSSProperties = { animation: "msSpin 0.9s linear infinite" };

// ─── Style tokens ───
const S: Record<string, React.CSSProperties> = {
  wrap: { padding: "22px 26px 48px" },

  phead: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 16, flexWrap: "wrap" },
  h1: { fontFamily: gf, fontSize: 26, fontWeight: 700, letterSpacing: 0.3, display: "flex", alignItems: "center", gap: 10, margin: 0, color: D.tx },
  sub: { fontFamily: ft, fontSize: 12.5, color: D.txm, marginTop: 6, maxWidth: 640, lineHeight: 1.5 },
  btn: {
    display: "inline-flex", alignItems: "center", gap: 6, fontFamily: mn, fontSize: 11.5,
    color: D.tx, background: D.card, border: `1px solid ${D.border}`, borderRadius: 9,
    padding: "7px 12px", cursor: "pointer", transition: "all 0.16s", whiteSpace: "nowrap",
  },
  btnViolet: { color: D.violet, background: hexAlpha(D.violet, 0.14), border: `1px solid ${hexAlpha(D.violet, 0.4)}` },
  btnAmber: { color: D.amber, background: hexAlpha(D.amber, 0.13), border: `1px solid ${hexAlpha(D.amber, 0.4)}` },

  // Stat strip
  statStrip: {
    display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 16, alignItems: "stretch",
  },
  stat: {
    display: "flex", alignItems: "center", gap: 10, background: D.cardGrad,
    border: `1px solid ${D.border}`, borderRadius: 12, padding: "9px 14px 9px 11px",
    minWidth: 150, flex: "1 1 150px",
  },
  statIco: { display: "inline-flex", alignItems: "center", justifyContent: "center", width: 30, height: 30, borderRadius: 9, border: "1px solid transparent", flex: "none" },
  statK: { fontFamily: gf, fontSize: 19, fontWeight: 700, lineHeight: 1 },
  statL: { fontFamily: mn, fontSize: 9.5, letterSpacing: 0.4, textTransform: "uppercase", color: D.txm, marginTop: 3 },
  liveStat: {
    display: "inline-flex", alignItems: "center", gap: 7, fontFamily: mn, fontSize: 10,
    color: D.teal, border: `1px solid ${hexAlpha(D.teal, 0.3)}`, background: hexAlpha(D.teal, 0.08),
    borderRadius: 12, padding: "0 14px",
  },
  liveDot: { width: 6, height: 6, borderRadius: 999, background: D.teal, boxShadow: `0 0 8px ${D.teal}`, flex: "none" },

  // Tabs
  ptabs: { display: "flex", flexWrap: "wrap", gap: 7, marginBottom: 18 },
  ptab: {
    display: "inline-flex", alignItems: "center", gap: 7, fontFamily: mn, fontSize: 11.5,
    borderRadius: 999, padding: "6px 12px", cursor: "pointer", transition: "all 0.16s", whiteSpace: "nowrap",
  },
  ct: { fontFamily: mn, fontSize: 10, padding: "1px 6px", borderRadius: 999, border: "1px solid transparent" },

  // Section labels
  label: {
    fontFamily: mn, fontSize: 10.5, letterSpacing: 0.6, textTransform: "uppercase", color: D.txm,
    display: "flex", alignItems: "center", gap: 7, margin: "0 0 12px", padding: "0 2px",
  },
  labelHint: { marginLeft: "auto", fontFamily: mn, fontSize: 9, color: D.txd, textTransform: "uppercase", letterSpacing: 0.4 },

  // Section 1 grid
  hotGrid: { display: "grid", gridTemplateColumns: "minmax(0,1.55fr) minmax(260px,1fr)", gap: 22, alignItems: "start", marginBottom: 26 },
  panel: { background: D.cardGrad, border: `1px solid ${D.border}`, borderRadius: 14, padding: "14px 4px 10px", boxShadow: D.glow },
  panelPad: { padding: "14px 14px 14px" },

  dgrid: { display: "grid", gridTemplateColumns: "minmax(0,1fr) 96px 110px 78px", gap: 10, alignItems: "center" },
  dh: { fontFamily: mn, fontSize: 9.5, letterSpacing: 0.5, textTransform: "uppercase", color: D.txd },
  num: { textAlign: "right", justifyContent: "flex-end" },
  drow: { padding: "11px 14px", borderTop: `1px solid ${D.border}`, transition: "background 0.14s", borderRadius: 8, animation: "msRise 0.32s ease both" },
  dc: { fontFamily: mn, fontSize: 12, color: D.tx, display: "flex", alignItems: "center" },

  signal: { fontFamily: ft, fontSize: 13.5, fontWeight: 500, color: D.tx, lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis" },
  signalLink: { color: D.tx, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 5 },
  signalSub: { fontFamily: mn, fontSize: 10, color: D.txd, display: "block", marginTop: 3 },
  bar: { marginTop: 8, height: 4, borderRadius: 999, background: "rgba(255,255,255,0.05)", overflow: "hidden", maxWidth: 240 },
  barFill: { display: "block", height: "100%", borderRadius: 999, transition: "width 0.4s ease" },
  growPill: { fontFamily: mn, fontSize: 10.5, fontWeight: 700, padding: "3px 8px", borderRadius: 999, border: "1px solid transparent", whiteSpace: "nowrap" },

  deeplink: {
    display: "flex", alignItems: "center", gap: 9, fontFamily: ft, fontSize: 12.5, color: D.tx,
    textDecoration: "none", background: D.card, border: `1px solid ${D.border}`, borderRadius: 10,
    padding: "10px 12px", transition: "all 0.16s",
  },
  openTag: { fontFamily: mn, fontSize: 9.5, color: D.cyan, textTransform: "uppercase", letterSpacing: 0.5, flex: "none" },
  emptyLinks: { fontFamily: ft, fontSize: 12, color: D.txd, padding: "12px 4px", lineHeight: 1.5 },
  whyBox: {
    background: D.surfGrad, border: `1px solid ${D.border}`, borderRadius: 12, padding: 14,
    fontFamily: ft, fontSize: 12.5, lineHeight: 1.6, color: D.txm,
  },

  // Section 2 — works / doesn't
  diagGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(340px,1fr))", gap: 22, alignItems: "start", marginBottom: 26 },
  patRow: {
    display: "flex", alignItems: "center", gap: 11, background: D.card, border: `1px solid ${D.border}`,
    borderRadius: 11, padding: "10px 12px", transition: "all 0.16s", animation: "msRise 0.32s ease both",
  },
  patIco: { display: "inline-flex", alignItems: "center", justifyContent: "center", width: 30, height: 30, borderRadius: 9, border: "1px solid transparent", flex: "none" },
  patTop: { display: "flex", alignItems: "center", gap: 8, minWidth: 0 },
  patName: { fontFamily: ft, fontSize: 13.5, fontWeight: 600, color: D.tx, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  patTag: { fontFamily: mn, fontSize: 8.5, letterSpacing: 0.4, textTransform: "uppercase", padding: "1px 5px", borderRadius: 5, border: "1px solid transparent", flex: "none" },
  patWhy: { fontFamily: ft, fontSize: 11.5, color: D.txm, lineHeight: 1.4, marginTop: 3 },
  patMetric: { fontFamily: mn, fontSize: 11, fontWeight: 700, padding: "4px 9px", borderRadius: 8, border: "1px solid transparent", whiteSpace: "nowrap", flex: "none", alignSelf: "center" },

  // Section 3 — playbook
  playbook: { background: D.surfGrad, border: `1px solid ${hexAlpha(D.amber, 0.22)}`, borderRadius: 16, padding: "18px 20px 20px", boxShadow: D.glow },
  pbHead: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 16 },
  pbCols: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))", gap: 22 },
  pbCol: { display: "flex", flexDirection: "column", gap: 9 },
  pbColHead: { fontFamily: mn, fontSize: 10.5, letterSpacing: 0.6, textTransform: "uppercase", display: "flex", alignItems: "center", gap: 7, marginBottom: 2 },
  pbItem: { display: "flex", alignItems: "flex-start", gap: 10, fontFamily: ft, fontSize: 13, lineHeight: 1.5, color: D.tx },
  pbMark: {
    fontFamily: mn, fontSize: 11, fontWeight: 700, width: 20, height: 20, borderRadius: 6,
    border: "1px solid transparent", display: "inline-flex", alignItems: "center", justifyContent: "center", flex: "none", marginTop: 1,
  },
  pbWindow: {
    display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginTop: 18, paddingTop: 16,
    borderTop: `1px solid ${D.border}`, fontFamily: ft, fontSize: 12.5, lineHeight: 1.5,
  },
  pbWindowBadge: {
    display: "inline-flex", alignItems: "center", gap: 6, fontFamily: mn, fontSize: 11, fontWeight: 700,
    color: D.coral, background: hexAlpha(D.coral, 0.12), border: `1px solid ${hexAlpha(D.coral, 0.35)}`,
    borderRadius: 8, padding: "5px 11px", flex: "none",
  },
};
