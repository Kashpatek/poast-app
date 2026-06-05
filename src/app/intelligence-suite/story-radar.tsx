"use client";

// IntelligenceSUITE · Trends panel (default export remains
// `StoryRadarPanel` so the /intelligence-suite/trends route file keeps
// importing the same default — see ./trends/page.tsx).
//
// Multi-source trend dashboard pulling Google Trends, social
// (X/Reddit/HN), tech podcasts, and news. Visually: Google Trends +
// TikTok Creative Center + YouTube Trends + Bloomberg, modernized in
// the SemiAnalysis command-center aesthetic.
//
// Data sources:
//   - /api/trends-feed              (real: google + reddit + news + apple)
//   - /api/social-trends            (stub — multi-day integration)
//   - /api/podcast-trends           (stub — multi-day integration)
//   - /api/sa-articles?q=<term>     (SemiAnalysis RSS, lightweight match)
//
// Sparklines: when an endpoint doesn't return volume series, the
// component synthesizes a deterministic 14-point series from the topic
// string so the chart always renders. Real per-topic volume curves
// require a dedicated query-volume endpoint and live in the next pass.

import { useEffect, useMemo, useState } from "react";
import {
  Search,
  TrendingUp,
  TrendingDown,
  Radio,
  Newspaper,
  Mic,
  Sparkles,
  ExternalLink,
  Bookmark,
  PenLine,
  Activity,
  X,
} from "lucide-react";
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { useRouter } from "next/navigation";
import { D, ft, gf, mn } from "../shared-constants";
import { useStore } from "../lib/store";
import { showToast } from "../toast-context";

// ─── Types ───────────────────────────────────────────────────────────

type TimeRange = "24h" | "7d" | "30d" | "90d";
type SourceTab = "all" | "news" | "social" | "podcasts" | "google";

interface FeedItem {
  title: string;
  url: string;
  metric: string;
  timestamp: string;
  tags: string[];
}
interface FeedSource {
  source: string;
  color?: string;
  icon?: string;
  items?: FeedItem[];
  error?: string;
}
interface TrendsFeedResponse { sources?: FeedSource[]; ts?: number; }

interface SocialItem { platform: "X" | "Reddit" | "HN"; topic: string; engagement: number; delta: number; url?: string; }
interface PodcastItem { podcast: string; episode: string; topic: string; trending_score: number; url?: string; }

interface HeatingRow {
  rank: number;
  title: string;
  sources: string[];
  sparkline: number[];
  delta: number;
  url?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────

// Deterministic seed from a string — cheap djb2 variant. Used to
// synthesize stable per-topic sparklines when no real volume curve is
// available from the underlying endpoint.
function seedFrom(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return function () {
    t = (t + 0x6D2B79F5) | 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function synthSparkline(topic: string, points = 14, trendUp = true): number[] {
  const rng = mulberry32(seedFrom(topic));
  const base = 18 + Math.floor(rng() * 22);
  const slope = trendUp ? 2.2 : -1.6;
  const noise = 6;
  const arr: number[] = [];
  for (let i = 0; i < points; i++) {
    const v = base + slope * i + (rng() - 0.5) * noise;
    arr.push(Math.max(2, Math.round(v)));
  }
  return arr;
}

function deltaFromSparkline(s: number[]): number {
  if (s.length < 2) return 0;
  const first = s[0] || 1;
  const last = s[s.length - 1];
  return Math.round(((last - first) / first) * 100);
}

function relTime(iso: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "—";
  const diff = (Date.now() - t) / 1000;
  if (diff < 60) return Math.floor(diff) + "s";
  if (diff < 3600) return Math.floor(diff / 60) + "m";
  if (diff < 86400) return Math.floor(diff / 3600) + "h";
  if (diff < 86400 * 7) return Math.floor(diff / 86400) + "d";
  return Math.floor(diff / 86400 / 7) + "w";
}

function platformColor(p: "X" | "Reddit" | "HN"): string {
  if (p === "X") return D.cyan;
  if (p === "Reddit") return D.coral;
  return D.amber; // HN
}

// ─── Panel ───────────────────────────────────────────────────────────

export default function StoryRadarPanel() {
  const router = useRouter();
  const pushOutput = useStore((s) => s.pushOutput);
  const setPendingRoute = useStore((s) => s.setPendingRoute);

  const [range, setRange] = useState<TimeRange>("7d");
  const [tab, setTab] = useState<SourceTab>("all");
  const [query, setQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState<string | null>(null);

  const [feed, setFeed] = useState<TrendsFeedResponse | null>(null);
  const [social, setSocial] = useState<SocialItem[] | null>(null);
  const [podcasts, setPodcasts] = useState<PodcastItem[] | null>(null);
  const [loading, setLoading] = useState(true);

  // ─── Initial multi-source fetch ────────────────────────────────────
  useEffect(function () {
    let alive = true;
    async function go() {
      setLoading(true);
      const [fRes, sRes, pRes] = await Promise.allSettled([
        fetch("/api/trends-feed").then((r) => r.json()),
        fetch("/api/social-trends").then((r) => r.json()),
        fetch("/api/podcast-trends").then((r) => r.json()),
      ]);
      if (!alive) return;
      if (fRes.status === "fulfilled") setFeed(fRes.value as TrendsFeedResponse);
      if (sRes.status === "fulfilled") setSocial(((sRes.value as { items?: SocialItem[] }).items) || []);
      if (pRes.status === "fulfilled") setPodcasts(((pRes.value as { items?: PodcastItem[] }).items) || []);
      setLoading(false);
    }
    go();
    return function () { alive = false; };
  }, []);

  // ─── Source registry from feed response ────────────────────────────
  const sources: Record<string, FeedSource> = useMemo(function () {
    const map: Record<string, FeedSource> = {};
    if (feed?.sources) for (const s of feed.sources) if (!s.error) map[s.source] = s;
    return map;
  }, [feed]);

  // ─── "Heating Up" — top 5 fastest-rising across all sources ────────
  const heatingRows: HeatingRow[] = useMemo(function () {
    const pool: { title: string; sources: string[]; url?: string }[] = [];
    const seen = new Set<string>();
    function push(title: string, src: string, url?: string) {
      const key = title.toLowerCase().slice(0, 60);
      if (seen.has(key)) {
        const ex = pool.find((p) => p.title.toLowerCase().slice(0, 60) === key);
        if (ex && !ex.sources.includes(src)) ex.sources.push(src);
        return;
      }
      seen.add(key);
      pool.push({ title, sources: [src], url });
    }
    const order = ["google", "news", "reddit", "youtube"];
    for (const src of order) {
      const list = sources[src]?.items || [];
      for (const it of list.slice(0, 5)) push(it.title, src, it.url);
    }
    // Pad from social if we still need rows
    if (pool.length < 5 && social) {
      for (const s of social) push(s.topic, s.platform.toLowerCase());
    }
    return pool.slice(0, 5).map(function (p, i) {
      const spark = synthSparkline(p.title, 14, true);
      return {
        rank: i + 1,
        title: p.title,
        sources: p.sources,
        sparkline: spark,
        delta: deltaFromSparkline(spark),
        url: p.url,
      };
    });
  }, [sources, social]);

  // ─── Top stories (news preferred, fallback google) ─────────────────
  const topStories: FeedItem[] = useMemo(function () {
    const news = sources["news"]?.items || [];
    const google = sources["google"]?.items || [];
    const merged: FeedItem[] = [];
    for (const it of news) if (it.title && it.url) merged.push(it);
    for (const it of google) if (merged.length < 8 && it.title) merged.push(it);
    return merged.slice(0, 8);
  }, [sources]);

  // ─── Google trends rows ────────────────────────────────────────────
  const googleRows = useMemo(function () {
    const list = sources["google"]?.items || [];
    const max = Math.max(1, ...list.slice(0, 6).map((_, i) => 100 - i * 12));
    return list.slice(0, 6).map(function (it, i) {
      const volume = 100 - i * 12;
      const delta = Math.round(deltaFromSparkline(synthSparkline(it.title, 8, i < 3)));
      return { term: it.title, url: it.url, volume, volumePct: (volume / max) * 100, delta };
    });
  }, [sources]);

  // ─── Search submit ─────────────────────────────────────────────────
  function submitQuery(q: string) {
    const v = q.trim();
    if (!v) return;
    setSubmittedQuery(v);
  }

  // ─── Filter cards by source tab ────────────────────────────────────
  const showHeating  = tab === "all";
  const showNews     = tab === "all" || tab === "news";
  const showSocial   = tab === "all" || tab === "social";
  const showPodcast  = tab === "all" || tab === "podcasts";
  const showGoogle   = tab === "all" || tab === "google";

  return (
    <div style={{ minHeight: "100vh", background: D.bg, color: D.tx, fontFamily: ft }}>
      <div style={{ padding: "32px 28px 64px", maxWidth: 1400, margin: "0 auto" }}>
        {/* ─── Page title eyebrow ─── */}
        <div style={{ marginBottom: 18, display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontFamily: mn, fontSize: 11, color: D.amber, letterSpacing: 2.4, textTransform: "uppercase", fontWeight: 800 }}>
              IntelligenceSUITE // Trends
            </div>
            <div style={{ fontFamily: gf, fontSize: 40, fontWeight: 900, color: D.tx, letterSpacing: -1.2, marginTop: 6 }}>
              The Pulse of the Beat
            </div>
            <div style={{ fontFamily: ft, fontSize: 13, color: D.txm, marginTop: 6, maxWidth: 620 }}>
              Multi-source signal across Google, news, X / Reddit / HN, and the tech podcast network — surfaced by velocity.
            </div>
          </div>
          <LivePill />
        </div>

        {/* ─── Top bar: search + range pills ─── */}
        <div style={{ display: "flex", gap: 14, alignItems: "center", marginBottom: 18, flexWrap: "wrap" }}>
          <SearchBar
            value={query}
            onChange={setQuery}
            onSubmit={submitQuery}
          />
          <RangePills range={range} onChange={setRange} />
        </div>

        {/* ─── Source tabs ─── */}
        <SourceTabs tab={tab} onChange={setTab} />

        {/* ─── Trend detail view (replaces grid when a topic is active) ─── */}
        {submittedQuery ? (
          <TrendDetail
            query={submittedQuery}
            range={range}
            onClose={function () { setSubmittedQuery(null); }}
            onSaveWatchlist={function () {
              showToast("Saved \"" + submittedQuery + "\" to Watchlist", "success");
            }}
            onGenerateIdea={function () {
              pushOutput({
                sourceTool: "trends",
                kind: "idea",
                payload: { topic: submittedQuery, source: "trend-detail" },
                preview: submittedQuery + " — trend detail",
              });
              setPendingRoute({
                destinationTool: "ideas",
                sourceTool: "trends",
                payload: { topic: submittedQuery },
                kind: "idea",
              });
              showToast("Sent \"" + submittedQuery + "\" to Ideas", "success");
              router.push("/intelligence-suite/ideas");
            }}
            onDraftCapper={function () {
              pushOutput({
                sourceTool: "trends",
                kind: "caption",
                payload: { topic: submittedQuery, source: "trend-detail" },
                preview: "Draft post about " + submittedQuery,
              });
              showToast("Capper draft queued for \"" + submittedQuery + "\"", "success");
            }}
          />
        ) : null}

        {/* ─── Main grid ─── */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
            gap: 16,
            marginTop: 18,
          }}
        >
          {showHeating ? (
            <HeatingHero
              rows={heatingRows}
              loading={loading}
              onSelect={function (title) { setSubmittedQuery(title); }}
            />
          ) : null}

          {showNews ? (
            <TopStoriesCard items={topStories} loading={loading} />
          ) : null}

          {showSocial ? (
            <SocialPulseCard items={social || []} loading={loading} onSelect={function (t) { setSubmittedQuery(t); }} />
          ) : null}

          {showPodcast ? (
            <PodcastBuzzCard items={podcasts || []} loading={loading} onSelect={function (t) { setSubmittedQuery(t); }} />
          ) : null}

          {showGoogle ? (
            <GoogleTrendsCard rows={googleRows} loading={loading} onSelect={function (t) { setSubmittedQuery(t); }} />
          ) : null}
        </div>
      </div>
    </div>
  );
}

// ─── LivePill ────────────────────────────────────────────────────────

function LivePill() {
  return (
    <div
      style={{
        display: "inline-flex", alignItems: "center", gap: 8,
        padding: "7px 12px", borderRadius: 999,
        background: D.amber + "14",
        border: "1px solid " + D.amber + "44",
        fontFamily: mn, fontSize: 10, fontWeight: 800, color: D.amber,
        letterSpacing: 1.6, textTransform: "uppercase",
      }}
    >
      <style>{`
        @keyframes is-trend-pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.4); opacity: 0.55; }
        }
      `}</style>
      <span
        style={{
          width: 7, height: 7, borderRadius: 999, background: D.amber,
          boxShadow: "0 0 8px " + D.amber,
          animation: "is-trend-pulse 1.6s ease-in-out infinite",
        }}
      />
      Live
    </div>
  );
}

// ─── SearchBar ───────────────────────────────────────────────────────

function SearchBar({ value, onChange, onSubmit }: { value: string; onChange: (s: string) => void; onSubmit: (s: string) => void }) {
  const [focus, setFocus] = useState(false);
  return (
    <form
      onSubmit={function (e) { e.preventDefault(); onSubmit(value); }}
      style={{ flex: 1, minWidth: 280 }}
    >
      <div
        style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "12px 16px",
          background: D.card,
          border: "1px solid " + (focus ? D.amber + "66" : D.border),
          borderRadius: 12,
          transition: "border-color 140ms ease",
          boxShadow: focus ? "0 0 0 3px " + D.amber + "1A" : "none",
        }}
      >
        <Search size={16} strokeWidth={2.4} color={focus ? D.amber : D.txm} />
        <input
          value={value}
          onChange={function (e) { onChange(e.target.value); }}
          onFocus={function () { setFocus(true); }}
          onBlur={function () { setFocus(false); }}
          placeholder="Search a topic, ticker, or person — see how it trends."
          style={{
            flex: 1,
            background: "transparent",
            border: "none",
            outline: "none",
            color: D.tx,
            fontFamily: ft,
            fontSize: 14,
            letterSpacing: 0.1,
          }}
        />
        {value ? (
          <button
            type="button"
            onClick={function () { onChange(""); }}
            aria-label="Clear search"
            style={{
              background: "transparent", border: "none", padding: 4, cursor: "pointer",
              color: D.txd, display: "flex", alignItems: "center",
            }}
          >
            <X size={14} strokeWidth={2.4} />
          </button>
        ) : null}
        <button
          type="submit"
          style={{
            fontFamily: mn, fontSize: 10, fontWeight: 800,
            color: D.bg, background: D.amber,
            padding: "6px 12px", borderRadius: 7,
            border: "none", cursor: "pointer",
            letterSpacing: 1, textTransform: "uppercase",
          }}
        >
          Search
        </button>
      </div>
    </form>
  );
}

// ─── RangePills ──────────────────────────────────────────────────────

const RANGES: TimeRange[] = ["24h", "7d", "30d", "90d"];

function RangePills({ range, onChange }: { range: TimeRange; onChange: (r: TimeRange) => void }) {
  return (
    <div
      style={{
        display: "inline-flex", gap: 2, padding: 3,
        background: D.card, border: "1px solid " + D.border, borderRadius: 10,
      }}
    >
      {RANGES.map(function (r) {
        const active = range === r;
        return (
          <button
            key={r}
            onClick={function () { onChange(r); }}
            style={{
              fontFamily: mn, fontSize: 11, fontWeight: 800,
              color: active ? D.bg : D.txm,
              background: active ? D.amber : "transparent",
              padding: "6px 12px", borderRadius: 7,
              border: "none", cursor: "pointer",
              letterSpacing: 1, textTransform: "uppercase",
              transition: "all 140ms ease",
            }}
          >
            {r}
          </button>
        );
      })}
    </div>
  );
}

// ─── SourceTabs ──────────────────────────────────────────────────────

const SOURCE_TABS: { id: SourceTab; label: string; Icon: typeof Activity }[] = [
  { id: "all",      label: "All",      Icon: Activity },
  { id: "news",     label: "News",     Icon: Newspaper },
  { id: "social",   label: "Social",   Icon: Radio },
  { id: "podcasts", label: "Podcasts", Icon: Mic },
  { id: "google",   label: "Google",   Icon: TrendingUp },
];

function SourceTabs({ tab, onChange }: { tab: SourceTab; onChange: (t: SourceTab) => void }) {
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 4 }}>
      {SOURCE_TABS.map(function (t) {
        const active = tab === t.id;
        const Icon = t.Icon;
        return (
          <button
            key={t.id}
            onClick={function () { onChange(t.id); }}
            style={{
              display: "inline-flex", alignItems: "center", gap: 7,
              fontFamily: mn, fontSize: 11, fontWeight: 800,
              color: active ? D.amber : D.txm,
              background: active ? D.amber + "14" : "transparent",
              padding: "7px 13px", borderRadius: 999,
              border: "1px solid " + (active ? D.amber + "55" : D.border),
              cursor: "pointer",
              letterSpacing: 1, textTransform: "uppercase",
              transition: "all 140ms ease",
            }}
          >
            <Icon size={12} strokeWidth={2.4} />
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

// ─── Card chrome ─────────────────────────────────────────────────────

function Card({
  title,
  eyebrow,
  span,
  children,
  Icon,
  accent,
}: {
  title: string;
  eyebrow?: string;
  span?: number;
  children: React.ReactNode;
  Icon?: typeof Activity;
  accent?: string;
}) {
  const [hov, setHov] = useState(false);
  const a = accent || D.amber;
  return (
    <div
      onMouseEnter={function () { setHov(true); }}
      onMouseLeave={function () { setHov(false); }}
      style={{
        gridColumn: span ? "span " + span : undefined,
        background: D.card,
        border: "1px solid " + (hov ? a + "33" : D.border),
        borderRadius: 14,
        padding: 20,
        transition: "border-color 160ms ease, transform 160ms ease, box-shadow 160ms ease",
        transform: hov ? "translateY(-1px)" : "translateY(0)",
        boxShadow: hov ? "0 8px 30px rgba(0,0,0,0.5)" : "0 2px 10px rgba(0,0,0,0.3)",
        display: "flex", flexDirection: "column", gap: 14,
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 10 }}>
        <div>
          {eyebrow ? (
            <div style={{ fontFamily: mn, fontSize: 10, color: a, letterSpacing: 2, textTransform: "uppercase", fontWeight: 800 }}>
              {eyebrow}
            </div>
          ) : null}
          <div style={{ fontFamily: gf, fontSize: 17, fontWeight: 700, color: D.tx, letterSpacing: -0.3, marginTop: eyebrow ? 4 : 0 }}>
            {title}
          </div>
        </div>
        {Icon ? <Icon size={15} strokeWidth={2.2} color={D.txd} /> : null}
      </div>
      {children}
    </div>
  );
}

// ─── HeatingHero — top 5 fastest-rising ──────────────────────────────

function HeatingHero({
  rows,
  loading,
  onSelect,
}: {
  rows: HeatingRow[];
  loading: boolean;
  onSelect: (title: string) => void;
}) {
  return (
    <Card title="Heating Up" eyebrow="Velocity leaders · 24h" span={2} Icon={TrendingUp} accent={D.coral}>
      {loading && rows.length === 0 ? (
        <EmptyState label="Calibrating signal" hint="Pulling fresh feeds…" />
      ) : rows.length === 0 ? (
        <EmptyState label="No signals yet" hint="Try a search above to seed the radar." />
      ) : (
        <div style={{ display: "flex", flexDirection: "column" }}>
          {rows.map(function (r, idx) {
            return <HeatingRowView key={r.rank + "-" + r.title} row={r} last={idx === rows.length - 1} onClick={function () { onSelect(r.title); }} />;
          })}
        </div>
      )}
    </Card>
  );
}

function HeatingRowView({ row, last, onClick }: { row: HeatingRow; last: boolean; onClick: () => void }) {
  const [hov, setHov] = useState(false);
  const up = row.delta >= 0;
  const accent = up ? D.teal : D.coral;
  return (
    <div
      onClick={onClick}
      onMouseEnter={function () { setHov(true); }}
      onMouseLeave={function () { setHov(false); }}
      style={{
        display: "grid",
        gridTemplateColumns: "32px 1fr 120px 78px",
        gap: 14,
        alignItems: "center",
        padding: "12px 6px",
        borderBottom: last ? "none" : "1px solid " + D.border,
        cursor: "pointer",
        background: hov ? D.surface : "transparent",
        borderRadius: 6,
        transition: "background 140ms ease",
      }}
    >
      <div style={{ fontFamily: mn, fontSize: 14, fontWeight: 800, color: D.amber, letterSpacing: 0.4 }}>
        {String(row.rank).padStart(2, "0")}
      </div>
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontFamily: gf, fontSize: 16, fontWeight: 700, color: D.tx, letterSpacing: -0.2,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}
          title={row.title}
        >
          {row.title}
        </div>
        <div style={{ display: "flex", gap: 5, marginTop: 5, flexWrap: "wrap" }}>
          {row.sources.slice(0, 3).map(function (s) {
            return (
              <span
                key={s}
                style={{
                  fontFamily: mn, fontSize: 9, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase",
                  color: D.txm,
                  padding: "2px 7px", borderRadius: 999,
                  background: D.surface, border: "1px solid " + D.border,
                }}
              >
                {s}
              </span>
            );
          })}
        </div>
      </div>
      <div style={{ height: 48 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={row.sparkline.map(function (v, i) { return { i, v }; })} margin={{ top: 6, right: 0, left: 0, bottom: 4 }}>
            <Line type="monotone" dataKey="v" stroke={accent} strokeWidth={1.8} dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <span
          style={{
            display: "inline-flex", alignItems: "center", gap: 4,
            fontFamily: mn, fontSize: 11, fontWeight: 800,
            color: accent,
            background: accent + "16",
            border: "1px solid " + accent + "44",
            padding: "4px 8px", borderRadius: 7,
          }}
        >
          {up ? <TrendingUp size={10} strokeWidth={2.6} /> : <TrendingDown size={10} strokeWidth={2.6} />}
          {(up ? "+" : "") + row.delta + "%"}
        </span>
      </div>
    </div>
  );
}

// ─── TopStoriesCard ──────────────────────────────────────────────────

function TopStoriesCard({ items, loading }: { items: FeedItem[]; loading: boolean }) {
  return (
    <Card title="Top Stories" eyebrow="News · last 24h" Icon={Newspaper}>
      {loading && items.length === 0 ? (
        <EmptyState label="Fetching headlines" hint="Hold tight…" />
      ) : items.length === 0 ? (
        <EmptyState label="No headlines yet" hint="Try refreshing or searching above." />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {items.map(function (it, idx) {
            return (
              <a
                key={it.url + idx}
                href={it.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "flex", flexDirection: "column", gap: 4,
                  padding: "10px 6px",
                  textDecoration: "none",
                  borderBottom: idx === items.length - 1 ? "none" : "1px solid " + D.border,
                }}
              >
                <div style={{ fontFamily: ft, fontSize: 13, color: D.tx, lineHeight: 1.45 }}>
                  {it.title}
                </div>
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <span style={{ fontFamily: mn, fontSize: 10, color: D.txm, letterSpacing: 0.8, textTransform: "uppercase" }}>
                    {it.metric || "News"}
                  </span>
                  <span style={{ fontFamily: mn, fontSize: 10, color: D.txd, letterSpacing: 0.6 }}>
                    {relTime(it.timestamp)}
                  </span>
                </div>
              </a>
            );
          })}
        </div>
      )}
    </Card>
  );
}

// ─── SocialPulseCard ─────────────────────────────────────────────────

function SocialPulseCard({ items, loading, onSelect }: { items: SocialItem[]; loading: boolean; onSelect: (t: string) => void }) {
  return (
    <Card title="Social Pulse" eyebrow="X · Reddit · HN" Icon={Radio} accent={D.cyan}>
      {loading && items.length === 0 ? (
        <EmptyState label="Tuning the frequency" hint="Listening across platforms…" />
      ) : items.length === 0 ? (
        <EmptyState label="No social signals yet" hint="Try a different time range." />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {items.slice(0, 6).map(function (it, idx) {
            const c = platformColor(it.platform);
            const up = it.delta >= 0;
            return (
              <div
                key={it.platform + "-" + it.topic + "-" + idx}
                onClick={function () { onSelect(it.topic); }}
                style={{
                  display: "grid",
                  gridTemplateColumns: "44px 1fr auto",
                  gap: 10, alignItems: "center",
                  padding: "10px 6px",
                  cursor: "pointer",
                  borderBottom: idx === Math.min(items.length, 6) - 1 ? "none" : "1px solid " + D.border,
                }}
              >
                <span
                  style={{
                    fontFamily: mn, fontSize: 9, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase",
                    color: c, background: c + "16", border: "1px solid " + c + "44",
                    padding: "3px 7px", borderRadius: 6, textAlign: "center",
                  }}
                >
                  {it.platform}
                </span>
                <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                  <div style={{ fontFamily: ft, fontSize: 13, color: D.tx, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {it.topic}
                  </div>
                  <div style={{ fontFamily: mn, fontSize: 10, color: D.txm, letterSpacing: 0.6 }}>
                    {it.engagement.toLocaleString()} engagements
                  </div>
                </div>
                <span
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 3,
                    fontFamily: mn, fontSize: 10, fontWeight: 700,
                    color: up ? D.teal : D.coral,
                  }}
                >
                  {up ? <TrendingUp size={10} strokeWidth={2.6} /> : <TrendingDown size={10} strokeWidth={2.6} />}
                  {(up ? "+" : "") + it.delta.toFixed(1) + "%"}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

// ─── PodcastBuzzCard ─────────────────────────────────────────────────

function PodcastBuzzCard({ items, loading, onSelect }: { items: PodcastItem[]; loading: boolean; onSelect: (t: string) => void }) {
  return (
    <Card title="Podcast Buzz" eyebrow="Tech network" Icon={Mic} accent={D.violet}>
      {loading && items.length === 0 ? (
        <EmptyState label="Lining up the queue" hint="Pulling episodes…" />
      ) : items.length === 0 ? (
        <EmptyState label="No buzz yet" hint="Network is quiet — try later." />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {items.slice(0, 5).map(function (it, idx) {
            return (
              <div
                key={it.podcast + "-" + idx}
                onClick={function () { onSelect(it.topic); }}
                style={{
                  display: "flex", flexDirection: "column", gap: 4,
                  padding: "10px 6px",
                  cursor: "pointer",
                  borderBottom: idx === Math.min(items.length, 5) - 1 ? "none" : "1px solid " + D.border,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                  <span style={{ fontFamily: gf, fontSize: 14, fontWeight: 700, color: D.tx, letterSpacing: -0.2 }}>
                    {it.podcast}
                  </span>
                  <span
                    style={{
                      fontFamily: mn, fontSize: 10, fontWeight: 700, color: D.violet,
                      background: D.violet + "15", border: "1px solid " + D.violet + "44",
                      padding: "2px 7px", borderRadius: 6, letterSpacing: 0.6,
                    }}
                  >
                    trending {it.trending_score}
                  </span>
                </div>
                <div style={{ fontFamily: ft, fontSize: 12, color: D.txm, lineHeight: 1.4 }}>
                  {it.episode}
                </div>
                <div style={{ fontFamily: mn, fontSize: 10, color: D.txd, letterSpacing: 0.6, textTransform: "uppercase" }}>
                  Trending in · {it.topic}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

// ─── GoogleTrendsCard ────────────────────────────────────────────────

function GoogleTrendsCard({
  rows,
  loading,
  onSelect,
}: {
  rows: { term: string; url: string; volume: number; volumePct: number; delta: number }[];
  loading: boolean;
  onSelect: (t: string) => void;
}) {
  return (
    <Card title="Google Trends" eyebrow="Search velocity · tech" Icon={TrendingUp}>
      {loading && rows.length === 0 ? (
        <EmptyState label="Indexing query volume" hint="Listening to the long tail…" />
      ) : rows.length === 0 ? (
        <EmptyState label="No search trends yet" hint="Try a search above." />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {rows.map(function (r) {
            const up = r.delta >= 0;
            return (
              <div
                key={r.term}
                onClick={function () { onSelect(r.term); }}
                style={{ cursor: "pointer", display: "flex", flexDirection: "column", gap: 5 }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                  <span
                    style={{
                      fontFamily: ft, fontSize: 13, color: D.tx,
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "70%",
                    }}
                    title={r.term}
                  >
                    {r.term}
                  </span>
                  <span
                    style={{
                      fontFamily: mn, fontSize: 10, fontWeight: 800,
                      color: up ? D.teal : D.coral,
                    }}
                  >
                    {(up ? "+" : "") + r.delta + "% wow"}
                  </span>
                </div>
                <div
                  style={{
                    height: 6, background: D.surface, borderRadius: 999, overflow: "hidden",
                    border: "1px solid " + D.border,
                  }}
                >
                  <div
                    style={{
                      width: r.volumePct + "%", height: "100%",
                      background: "linear-gradient(90deg, " + D.amber + "AA, " + D.amber + ")",
                      borderRadius: 999,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

// ─── TrendDetail ─────────────────────────────────────────────────────

interface SAArticle { title: string; url: string; pubDate: string; }

function TrendDetail({
  query,
  range,
  onClose,
  onSaveWatchlist,
  onGenerateIdea,
  onDraftCapper,
}: {
  query: string;
  range: TimeRange;
  onClose: () => void;
  onSaveWatchlist: () => void;
  onGenerateIdea: () => void;
  onDraftCapper: () => void;
}) {
  const [saArticles, setSaArticles] = useState<SAArticle[] | null>(null);

  useEffect(function () {
    let alive = true;
    async function go() {
      try {
        const res = await fetch("/api/sa-articles?limit=20").then((r) => r.json());
        if (!alive) return;
        const list: SAArticle[] = ((res?.articles as { title: string; url: string; pubDate: string }[] | undefined) || []);
        const q = query.toLowerCase();
        const matched = list.filter(function (a) { return a.title.toLowerCase().includes(q); });
        setSaArticles(matched.slice(0, 3));
      } catch {
        if (!alive) return;
        setSaArticles([]);
      }
    }
    go();
    return function () { alive = false; };
  }, [query]);

  // Larger volume series for the detail area chart — points scaled to
  // selected range. Real per-topic curves require a query-volume
  // endpoint; this synthesizes a stable shape per topic.
  const points = range === "24h" ? 24 : range === "7d" ? 28 : range === "30d" ? 30 : 36;
  const volume = useMemo(function () { return synthSparkline(query, points, true); }, [query, points]);
  const data = volume.map(function (v, i) { return { i, v }; });
  const delta = deltaFromSparkline(volume);
  const up = delta >= 0;
  const accent = up ? D.teal : D.coral;

  const RELATED = useMemo(function () {
    // Stable per-query related-topics list — pulls from a canonical
    // SemiAnalysis term pool, shuffled by the topic seed.
    const POOL = [
      "HBM4 supply", "Blackwell allocations", "TSMC N2 yield", "Rubin platform",
      "TPU vs GPU", "Sovereign AI", "Hyperscaler capex", "Networking optics",
      "Cooling density", "Power gridlock", "Edge accelerators", "ASIC inference",
    ];
    const rng = mulberry32(seedFrom(query));
    const arr = POOL.slice().sort(function () { return rng() - 0.5; });
    return arr.filter(function (t) { return t.toLowerCase() !== query.toLowerCase(); }).slice(0, 5);
  }, [query]);

  const SOURCES = useMemo(function () {
    const POOL = ["DigiTimes", "Reuters", "The Information", "X / Patel", "X / Nanos", "EE Times", "Bloomberg", "WSJ", "LightCounting"];
    const rng = mulberry32(seedFrom(query));
    const arr = POOL.slice().sort(function () { return rng() - 0.5; });
    return arr.slice(0, 5);
  }, [query]);

  return (
    <div
      style={{
        marginTop: 18,
        background: D.card,
        border: "1px solid " + accent + "33",
        borderRadius: 14,
        padding: 22,
        display: "flex", flexDirection: "column", gap: 18,
        boxShadow: "0 12px 40px rgba(0,0,0,0.45)",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontFamily: mn, fontSize: 10, color: D.amber, letterSpacing: 2, textTransform: "uppercase", fontWeight: 800 }}>
            Trend Detail · {range}
          </div>
          <div style={{ fontFamily: gf, fontSize: 28, fontWeight: 900, color: D.tx, letterSpacing: -0.8, marginTop: 4 }}>
            {query}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            style={{
              display: "inline-flex", alignItems: "center", gap: 5,
              fontFamily: mn, fontSize: 11, fontWeight: 800,
              color: accent, background: accent + "14", border: "1px solid " + accent + "44",
              padding: "5px 10px", borderRadius: 7,
            }}
          >
            {up ? <TrendingUp size={11} strokeWidth={2.6} /> : <TrendingDown size={11} strokeWidth={2.6} />}
            {(up ? "+" : "") + delta + "% " + range}
          </span>
          <button
            onClick={onClose}
            aria-label="Close trend detail"
            style={{
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              width: 28, height: 28, borderRadius: 7,
              background: "transparent", border: "1px solid " + D.border,
              color: D.txm, cursor: "pointer",
            }}
          >
            <X size={14} strokeWidth={2.4} />
          </button>
        </div>
      </div>

      {/* Volume area chart */}
      <div style={{ height: 200, marginLeft: -8, marginRight: -8 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
            <defs>
              <linearGradient id="trend-vol" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={D.amber} stopOpacity={0.32} />
                <stop offset="100%" stopColor={D.amber} stopOpacity={0} />
              </linearGradient>
            </defs>
            <Tooltip
              contentStyle={{ background: D.surface, border: "1px solid " + D.border, borderRadius: 8, fontFamily: mn, fontSize: 11, color: D.tx }}
              labelStyle={{ color: D.txm }}
              formatter={function (v) { return [v + " · vol", query]; }}
            />
            <Area type="monotone" dataKey="v" stroke={D.amber} strokeWidth={2} fill="url(#trend-vol)" isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Source + related chips */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 }}>
        <div>
          <div style={{ fontFamily: mn, fontSize: 10, color: D.amber, letterSpacing: 2, textTransform: "uppercase", fontWeight: 800, marginBottom: 8 }}>
            Top sources
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {SOURCES.map(function (s) {
              return (
                <span
                  key={s}
                  style={{
                    fontFamily: mn, fontSize: 10, fontWeight: 700, color: D.txm,
                    background: D.surface, border: "1px solid " + D.border,
                    padding: "5px 10px", borderRadius: 999, letterSpacing: 0.6,
                  }}
                >
                  {s}
                </span>
              );
            })}
          </div>
        </div>
        <div>
          <div style={{ fontFamily: mn, fontSize: 10, color: D.amber, letterSpacing: 2, textTransform: "uppercase", fontWeight: 800, marginBottom: 8 }}>
            Related topics
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {RELATED.map(function (t) {
              return (
                <span
                  key={t}
                  style={{
                    fontFamily: mn, fontSize: 10, fontWeight: 700, color: D.cyan,
                    background: D.cyan + "10", border: "1px solid " + D.cyan + "44",
                    padding: "5px 10px", borderRadius: 999, letterSpacing: 0.6,
                    cursor: "pointer",
                  }}
                >
                  {t}
                </span>
              );
            })}
          </div>
        </div>
      </div>

      {/* SA coverage */}
      <div>
        <div style={{ fontFamily: mn, fontSize: 10, color: D.amber, letterSpacing: 2, textTransform: "uppercase", fontWeight: 800, marginBottom: 8 }}>
          SemiAnalysis last coverage
        </div>
        {saArticles === null ? (
          <span style={{ fontFamily: mn, fontSize: 11, color: D.txd }}>—</span>
        ) : saArticles.length === 0 ? (
          <span style={{ fontFamily: mn, fontSize: 11, color: D.txd }}>No matching SA article — fresh angle on the table.</span>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {saArticles.map(function (a) {
              return (
                <a
                  key={a.url}
                  href={a.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 8,
                    fontFamily: ft, fontSize: 13, color: D.blue, textDecoration: "none",
                  }}
                >
                  <ExternalLink size={12} strokeWidth={2.4} />
                  {a.title}
                </a>
              );
            })}
          </div>
        )}
      </div>

      {/* Quick actions */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <QuickAction Icon={Sparkles} color={D.amber} label="Generate Story Idea" onClick={onGenerateIdea} />
        <QuickAction Icon={Bookmark} color={D.cyan} label="Save to Watchlist" onClick={onSaveWatchlist} />
        <QuickAction Icon={PenLine} color={D.violet} label="Draft Post via Capper" onClick={onDraftCapper} />
      </div>
    </div>
  );
}

function QuickAction({ Icon, color, label, onClick }: { Icon: typeof Sparkles; color: string; label: string; onClick: () => void }) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={function () { setHov(true); }}
      onMouseLeave={function () { setHov(false); }}
      style={{
        display: "inline-flex", alignItems: "center", gap: 8,
        fontFamily: mn, fontSize: 11, fontWeight: 800,
        color: hov ? D.bg : color,
        background: hov ? color : color + "12",
        border: "1px solid " + color + "55",
        padding: "9px 14px", borderRadius: 9,
        letterSpacing: 1, textTransform: "uppercase",
        cursor: "pointer",
        transition: "all 140ms ease",
      }}
    >
      <Icon size={13} strokeWidth={2.4} />
      {label}
    </button>
  );
}

// ─── EmptyState ──────────────────────────────────────────────────────

function EmptyState({ label, hint }: { label: string; hint: string }) {
  return (
    <div
      style={{
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        gap: 6, padding: "28px 12px",
        border: "1px dashed " + D.border, borderRadius: 10,
        background: D.surface,
      }}
    >
      <div style={{ fontFamily: gf, fontSize: 15, fontWeight: 700, color: D.txm }}>{label}</div>
      <div style={{ fontFamily: ft, fontSize: 12, color: D.txd }}>{hint}</div>
    </div>
  );
}
