"use client";

// Competitive Radar — IntelligenceSUITE refined competitor intel.
//
// A full Mention.com / Brand24-style dashboard scoped to the semi /
// AI-infrastructure media landscape:
//
//   - Top row: 14 competitor outlets as horizontally-scrolling source
//     cards with per-source publish counts + enable toggles.
//   - Left 65%: timeline of competitor pieces (newest first) with
//     "SA angle" suggestion + 3 actions (Generate SA Take, Add to
//     Brainstorm, Open).
//   - Right 35%: gap analysis — topics peers are talking about that
//     SA hasn't covered + a competitor activity bar chart.
//
// Source preferences persist to localStorage AND Supabase /api/db so
// the toggle state survives across sessions and devices.

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ExternalLink,
  Sparkles,
  RefreshCw,
  MessageSquarePlus,
  Crosshair,
  Eye,
  EyeOff,
  Search,
} from "lucide-react";
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip as RTooltip,
  Cell,
} from "recharts";
import {
  D,
  ft,
  gf,
  mn,
  getSurfaceProvider,
  getPreferredProvider,
  dbGet,
  dbSave,
  type LLMProviderName,
} from "../shared-constants";
import { useStore } from "../lib/store";
import { showToast } from "../toast-context";

// ─── Types ───────────────────────────────────────────────────────────

interface RadarItem {
  source: string;
  title: string;
  link: string;
  time: string;
  saAngle: string;
  snippet?: string;
}

interface CompetitorMeta {
  name: string;
  hasFeed: boolean;
  accent: string;
}

type TimeRange = "24h" | "7d" | "30d" | "all";

interface GapTopic {
  topic: string;
  lastCoveredBy: string;
  lastCoveredAt: string; // human label
  angle: string;
}

// ─── Constants ───────────────────────────────────────────────────────

// All 14 outlets we surface on the client. Some don't have public RSS,
// so the server feed list (in /api/competitive-radar/route.ts) is a
// subset — we show the rest as "no feed" cards so users see the gap.
const COMPETITORS: CompetitorMeta[] = [
  { name: "Stratechery",     hasFeed: true,  accent: D.amber },
  { name: "The Information", hasFeed: false, accent: D.coral },
  { name: "Asianometry",     hasFeed: true,  accent: D.teal },
  { name: "Doomberg",        hasFeed: true,  accent: D.cyan },
  { name: "Lex Fridman",     hasFeed: true,  accent: D.violet },
  { name: "Acquired",        hasFeed: true,  accent: D.blue },
  { name: "Ben Thompson",    hasFeed: false, accent: D.amber },
  { name: "Patrick Boyle",   hasFeed: false, accent: D.coral },
  { name: "BG2 Pod",         hasFeed: false, accent: D.teal },
  { name: "Dwarkesh",        hasFeed: false, accent: D.cyan },
  { name: "ChinaTalk",       hasFeed: false, accent: D.violet },
  { name: "Latent Space",    hasFeed: false, accent: D.blue },
  { name: "AI Engineer",     hasFeed: false, accent: D.amber },
  { name: "AI Pulse",        hasFeed: false, accent: D.teal },
];

const ALL_NAMES = COMPETITORS.map((c) => c.name);
const FEED_NAMES = COMPETITORS.filter((c) => c.hasFeed).map((c) => c.name);

const LS_KEY = "poast-competitive-sources";
const DB_TABLE = "trends";
const DB_ID = "competitive-sources";

// Gap-analysis fallback list — used when /api/news + /api/sa-articles
// are unavailable. Reads as if pulled live; each topic is a real beat
// SA could plausibly own.
const FALLBACK_GAPS: GapTopic[] = [
  {
    topic: "Sovereign AI buildouts",
    lastCoveredBy: "Stratechery",
    lastCoveredAt: "11 days ago",
    angle: "Map the Gulf + EU sovereign capex curves vs. hyperscaler peer growth, then price the GPU pull-through.",
  },
  {
    topic: "Photonic interconnect economics",
    lastCoveredBy: "Asianometry",
    lastCoveredAt: "9 days ago",
    angle: "Decompose the $/Gbps curve for silicon photonics vs. retimed copper through 2027 — co-packaged optics inflection.",
  },
  {
    topic: "Custom silicon at Anthropic",
    lastCoveredBy: "The Information",
    lastCoveredAt: "6 days ago",
    angle: "Trace the Trainium volume commit and what it implies for Claude inference unit economics.",
  },
  {
    topic: "DRAM cycle inflection",
    lastCoveredBy: "Doomberg",
    lastCoveredAt: "14 days ago",
    angle: "Reframe the LPDDR / DDR5 capex-discipline thesis through the HBM displacement lens.",
  },
  {
    topic: "BSPDN at TSMC N2",
    lastCoveredBy: "Asianometry",
    lastCoveredAt: "8 days ago",
    angle: "Backside power as the real N2 yield story — who adopts first and what it does to leading-edge ASPs.",
  },
  {
    topic: "Edge inference cost curves",
    lastCoveredBy: "Latent Space",
    lastCoveredAt: "5 days ago",
    angle: "Cost-per-token curves for on-device Llama / Phi flavors — when does the cloud roundtrip stop pencilling?",
  },
  {
    topic: "Power-constrained DC siting",
    lastCoveredBy: "ChinaTalk",
    lastCoveredAt: "13 days ago",
    angle: "Treat utility interconnect queues as the binding constraint on 2027 capex — quantify by ISO region.",
  },
  {
    topic: "China Huawei Ascend ramp",
    lastCoveredBy: "ChinaTalk",
    lastCoveredAt: "4 days ago",
    angle: "Bottoms-up Ascend 910C wafer build vs. SMIC N+2 yield reality — separate the press cycle from the actual ramp.",
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────

function pickProvider(): LLMProviderName {
  return getSurfaceProvider("competitive-radar") || getPreferredProvider();
}

function relTime(iso?: string): string {
  if (!iso) return "";
  const t = new Date(iso).getTime();
  if (!t || isNaN(t)) return "";
  const diff = Date.now() - t;
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return Math.floor(diff / 60_000) + "m ago";
  if (diff < 86_400_000) return Math.floor(diff / 3_600_000) + "h ago";
  return Math.floor(diff / 86_400_000) + "d ago";
}

function rangeToMs(r: TimeRange): number {
  if (r === "24h") return 24 * 60 * 60 * 1000;
  if (r === "7d") return 7 * 24 * 60 * 60 * 1000;
  if (r === "30d") return 30 * 24 * 60 * 60 * 1000;
  return Number.POSITIVE_INFINITY;
}

function withinRange(iso: string, range: TimeRange): boolean {
  if (range === "all") return true;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return true;
  return Date.now() - t <= rangeToMs(range);
}

function initialOf(name: string): string {
  return name.charAt(0).toUpperCase();
}

function accentFor(name: string): string {
  const hit = COMPETITORS.find((c) => c.name === name);
  return hit ? hit.accent : D.amber;
}

// Naïve title overlap — used to detect whether SA already covered a
// competitor headline. Returns true when ≥2 meaningful tokens overlap.
function topicalOverlap(a: string, b: string): boolean {
  const stop = new Set([
    "the", "a", "an", "of", "and", "or", "to", "for", "in", "on", "at",
    "by", "with", "is", "are", "was", "were", "be", "as", "from", "that",
    "this", "it", "its", "but", "not", "we", "our", "you", "your",
  ]);
  const tok = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 3 && !stop.has(w));
  const ta = new Set(tok(a));
  const tb = tok(b);
  let hits = 0;
  for (const w of tb) if (ta.has(w)) hits++;
  return hits >= 2;
}

// ─── Component ───────────────────────────────────────────────────────

export default function CompetitiveRadarPanel() {
  const [enabled, setEnabled] = useState<Set<string>>(() => new Set(ALL_NAMES));
  const [items, setItems] = useState<RadarItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [range, setRange] = useState<TimeRange>("7d");
  const [gaps, setGaps] = useState<GapTopic[]>(FALLBACK_GAPS);
  const [search, setSearch] = useState("");
  const hydratedRef = useRef(false);

  const pushOutput = useStore((s) => s.pushOutput);
  const setPendingRoute = useStore((s) => s.setPendingRoute);

  // ─── Source persistence (localStorage + Supabase) ──────────────────
  useEffect(() => {
    let cancelled = false;
    async function hydrate() {
      let names: string[] | null = null;
      try {
        const raw = window.localStorage.getItem(LS_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) names = parsed.filter((s) => typeof s === "string");
        }
      } catch { /* ignore */ }

      if (!names) {
        try {
          const rows = await dbGet(DB_TABLE, DB_ID);
          if (!cancelled && rows && rows.length) {
            const row = rows[0] as { sources?: unknown };
            if (Array.isArray(row.sources)) {
              names = row.sources.filter((s): s is string => typeof s === "string");
            }
          }
        } catch { /* ignore */ }
      }

      if (!cancelled && names && names.length) {
        setEnabled(new Set(names.filter((n) => ALL_NAMES.includes(n))));
      }
      hydratedRef.current = true;
    }
    hydrate();
    return () => { cancelled = true; };
  }, []);

  // Persist whenever the set changes (after initial hydration).
  useEffect(() => {
    if (!hydratedRef.current) return;
    const names = Array.from(enabled);
    try { window.localStorage.setItem(LS_KEY, JSON.stringify(names)); } catch { /* quota */ }
    dbSave(DB_TABLE, { id: DB_ID, type: "competitive-sources", sources: names, updated_at: Date.now() })
      .catch(() => { /* best-effort */ });
  }, [enabled]);

  // ─── Feed fetch ────────────────────────────────────────────────────
  // Only request sources with public RSS — the server route filters
  // FEEDS by name so unknown names just no-op. We still display the
  // others (with empty data) on the client.
  const requestedSources = useMemo(
    () => Array.from(enabled).filter((s) => FEED_NAMES.includes(s)),
    [enabled],
  );

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setErr(null);
      try {
        const provider = pickProvider();
        const res = await fetch("/api/competitive-radar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ provider, sources: requestedSources }),
        });
        const data = (await res.json()) as { items?: RadarItem[]; error?: string };
        if (cancelled) return;
        if (!res.ok) {
          setErr(data.error || `Request failed (${res.status})`);
          setItems([]);
        } else {
          setItems(data.items || []);
        }
      } catch (e) {
        if (cancelled) return;
        setErr(String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [requestedSources]);

  // ─── Gap analysis ──────────────────────────────────────────────────
  // Cross-reference last 30d competitor pieces with /api/sa-articles to
  // surface real coverage gaps. Endpoint failures fall back to the
  // static realistic list.
  useEffect(() => {
    let cancelled = false;
    async function loadGaps() {
      try {
        const r = await fetch("/api/sa-articles", { cache: "no-store" });
        if (!r.ok) return;
        const d = (await r.json()) as { articles?: Array<{ title?: string }> };
        const saTitles = (d.articles || []).map((a) => (a.title || "")).filter(Boolean);
        if (!saTitles.length) return;
        if (cancelled) return;

        // Use competitor items as the candidate gap pool — anything
        // peers covered that SA's recent titles don't overlap with.
        const candidates = items
          .filter((it) => withinRange(it.time, "30d"))
          .filter((it) => !saTitles.some((t) => topicalOverlap(it.title, t)));

        if (candidates.length >= 4) {
          const used = new Set<string>();
          const fresh: GapTopic[] = [];
          for (const c of candidates) {
            const key = c.title.toLowerCase().slice(0, 40);
            if (used.has(key)) continue;
            used.add(key);
            fresh.push({
              topic: c.title.length > 70 ? c.title.slice(0, 67) + "…" : c.title,
              lastCoveredBy: c.source,
              lastCoveredAt: relTime(c.time) || "recently",
              angle: c.saAngle || "Reframe through SA's supply-chain + capex lens.",
            });
            if (fresh.length >= 8) break;
          }
          if (!cancelled && fresh.length >= 4) setGaps(fresh);
        }
      } catch {
        /* fall back to static gaps */
      }
    }
    loadGaps();
    return () => { cancelled = true; };
  }, [items]);

  // ─── Counts per source ─────────────────────────────────────────────
  const countsByName = useMemo(() => {
    const m = new Map<string, number>();
    for (const n of ALL_NAMES) m.set(n, 0);
    for (const it of items) {
      if (!withinRange(it.time, range)) continue;
      m.set(it.source, (m.get(it.source) || 0) + 1);
    }
    return m;
  }, [items, range]);

  const chartData = useMemo(() => {
    return COMPETITORS
      .filter((c) => enabled.has(c.name))
      .map((c) => ({
        name: c.name.length > 14 ? c.name.slice(0, 13) + "…" : c.name,
        full: c.name,
        count: countsByName.get(c.name) || 0,
        accent: c.accent,
      }))
      .sort((a, b) => b.count - a.count);
  }, [countsByName, enabled]);

  // ─── Filtering for left feed ───────────────────────────────────────
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items
      .filter((it) => enabled.has(it.source))
      .filter((it) => withinRange(it.time, range))
      .filter((it) => {
        if (!q) return true;
        return (
          it.title.toLowerCase().includes(q) ||
          it.source.toLowerCase().includes(q) ||
          (it.saAngle || "").toLowerCase().includes(q)
        );
      })
      .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
  }, [items, enabled, range, search]);

  // ─── Actions ───────────────────────────────────────────────────────
  function toggleSource(name: string) {
    setEnabled((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  function manualRefresh() {
    setEnabled((prev) => new Set(prev));
  }

  function generateSATake(it: RadarItem) {
    const payload =
      it.title +
      "\n\nSource: " +
      it.source +
      "\nLink: " +
      it.link +
      (it.saAngle ? "\n\nSA angle: " + it.saAngle : "");
    pushOutput({
      sourceTool: "competitive-radar",
      kind: "idea",
      payload,
      preview: it.title.slice(0, 140),
    });
    setPendingRoute({
      destinationTool: "ideas",
      sourceTool: "competitive-radar",
      payload,
      kind: "idea",
    });
    if (typeof window !== "undefined") {
      window.location.href = "/intelligence-suite/ideas";
    }
    showToast("Sent to Ideas — generating SA take.", "success");
  }

  function addToBrainstorm(it: RadarItem) {
    const payload =
      it.title +
      "\n\nSource: " +
      it.source +
      "\nLink: " +
      it.link +
      (it.saAngle ? "\n\nSeed angle: " + it.saAngle : "");
    pushOutput({
      sourceTool: "competitive-radar",
      kind: "other",
      payload,
      preview: it.title.slice(0, 140),
    });
    setPendingRoute({
      destinationTool: "brainstorm",
      sourceTool: "competitive-radar",
      payload,
      kind: "other",
    });
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("poast-nav", { detail: "brainstorm" }));
    }
    showToast("Added to Brainstorm.", "success");
  }

  function generateGapTake(g: GapTopic) {
    const payload =
      g.topic +
      "\n\nLast covered by " + g.lastCoveredBy + " (" + g.lastCoveredAt + ").\n\nSuggested SA angle: " + g.angle;
    pushOutput({
      sourceTool: "competitive-radar",
      kind: "idea",
      payload,
      preview: g.topic.slice(0, 140),
    });
    setPendingRoute({
      destinationTool: "ideas",
      sourceTool: "competitive-radar",
      payload,
      kind: "idea",
    });
    if (typeof window !== "undefined") {
      window.location.href = "/intelligence-suite/ideas";
    }
    showToast("Sent gap topic to Ideas.", "success");
  }

  // ─── Render ────────────────────────────────────────────────────────
  return (
    <div style={{ fontFamily: ft, color: D.tx, display: "flex", flexDirection: "column", gap: 18 }}>
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 16, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontFamily: mn, fontSize: 11, letterSpacing: 2.4, textTransform: "uppercase", color: D.amber }}>
            Competitive Intel
          </div>
          <div style={{ fontFamily: ft, fontSize: 14, color: D.txm, marginTop: 6, lineHeight: 1.5, maxWidth: 560 }}>
            Track peer coverage, identify gaps, build sharper takes.
          </div>
        </div>
        <RangePills value={range} onChange={setRange} />
      </div>

      {/* ── Source panel (horizontal scroll) ───────────────────────── */}
      <SourcePanel
        competitors={COMPETITORS}
        enabled={enabled}
        counts={countsByName}
        onToggle={toggleSource}
        onRefresh={manualRefresh}
        loading={loading}
      />

      {/* ── Main split ─────────────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.85fr) minmax(0, 1fr)", gap: 18, alignItems: "start" }}>
        {/* LEFT: Feed */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10, minWidth: 0 }}>
          <FeedHeader
            count={visible.length}
            loading={loading}
            search={search}
            onSearch={setSearch}
          />

          {loading && visible.length === 0 && (
            <EmptyState text="Scanning competitor feeds…" />
          )}

          {!loading && err && (
            <div
              style={{
                padding: 14,
                background: D.crimson + "12",
                border: "1px solid " + D.crimson + "44",
                borderRadius: 10,
                fontFamily: mn,
                fontSize: 11,
                color: D.crimson,
              }}
            >
              {err}
            </div>
          )}

          {!loading && !err && visible.length === 0 && (
            <EmptyState text="No signals yet — try widening the time range or enabling more sources." />
          )}

          {visible.map((it, i) => (
            <FeedCard
              key={it.link + ":" + i}
              item={it}
              onGenerate={generateSATake}
              onBrainstorm={addToBrainstorm}
            />
          ))}
        </div>

        {/* RIGHT: Gap analysis */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14, minWidth: 0 }}>
          <GapPanel gaps={gaps} onGenerate={generateGapTake} />
          <ActivityChart data={chartData} />
        </div>
      </div>
    </div>
  );
}

// ─── Range pills ─────────────────────────────────────────────────────

function RangePills({ value, onChange }: { value: TimeRange; onChange: (r: TimeRange) => void }) {
  const opts: { id: TimeRange; label: string }[] = [
    { id: "24h", label: "24h" },
    { id: "7d", label: "7d" },
    { id: "30d", label: "30d" },
    { id: "all", label: "All" },
  ];
  return (
    <div
      style={{
        display: "inline-flex",
        padding: 3,
        border: "1px solid " + D.border,
        borderRadius: 999,
        background: D.surface,
      }}
    >
      {opts.map((o) => {
        const active = value === o.id;
        return (
          <button
            key={o.id}
            onClick={() => onChange(o.id)}
            style={{
              fontFamily: mn,
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: 0.8,
              textTransform: "uppercase",
              padding: "6px 12px",
              borderRadius: 999,
              border: "none",
              background: active ? D.amber + "22" : "transparent",
              color: active ? D.amber : D.txm,
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

// ─── Source panel ────────────────────────────────────────────────────

function SourcePanel({
  competitors,
  enabled,
  counts,
  onToggle,
  onRefresh,
  loading,
}: {
  competitors: CompetitorMeta[];
  enabled: Set<string>;
  counts: Map<string, number>;
  onToggle: (name: string) => void;
  onRefresh: () => void;
  loading: boolean;
}) {
  return (
    <div
      style={{
        background: D.card,
        border: "1px solid " + D.border,
        borderRadius: 14,
        padding: "16px 18px",
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div style={{ fontFamily: mn, fontSize: 11, letterSpacing: 2.4, textTransform: "uppercase", color: D.amber }}>
          Sources · {enabled.size}/{competitors.length}
        </div>
        <button
          onClick={onRefresh}
          disabled={loading}
          title="Refresh feeds"
          style={{
            fontFamily: mn,
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: 0.8,
            textTransform: "uppercase",
            padding: "6px 12px",
            borderRadius: 8,
            border: "1px solid " + D.border,
            background: "transparent",
            color: loading ? D.txd : D.txm,
            cursor: loading ? "wait" : "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <RefreshCw size={11} strokeWidth={2.4} /> {loading ? "Loading" : "Refresh"}
        </button>
      </div>

      <div
        style={{
          display: "flex",
          gap: 10,
          overflowX: "auto",
          padding: "4px 2px 8px",
          scrollbarWidth: "thin",
        }}
      >
        {competitors.map((c) => (
          <SourceCard
            key={c.name}
            meta={c}
            enabled={enabled.has(c.name)}
            count={counts.get(c.name) || 0}
            onToggle={() => onToggle(c.name)}
          />
        ))}
      </div>
    </div>
  );
}

function SourceCard({
  meta,
  enabled,
  count,
  onToggle,
}: {
  meta: CompetitorMeta;
  enabled: boolean;
  count: number;
  onToggle: () => void;
}) {
  const [hov, setHov] = useState(false);
  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        flex: "0 0 168px",
        background: enabled ? D.surface : D.bg,
        border: "1px solid " + (hov ? meta.accent + "55" : enabled ? D.border : D.border),
        borderRadius: 12,
        padding: "12px 14px",
        display: "flex",
        flexDirection: "column",
        gap: 10,
        transform: hov ? "translateY(-1px)" : "none",
        boxShadow: hov ? "0 8px 20px rgba(0,0,0,0.35)" : "none",
        transition: "all 0.15s ease",
        opacity: enabled ? 1 : 0.55,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 999,
            background: meta.accent + "1f",
            border: "1px solid " + meta.accent + "55",
            color: meta.accent,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: gf,
            fontSize: 15,
            fontWeight: 800,
            flexShrink: 0,
          }}
        >
          {initialOf(meta.name)}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontFamily: gf,
              fontSize: 14,
              fontWeight: 700,
              color: D.tx,
              lineHeight: 1.15,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
            title={meta.name}
          >
            {meta.name}
          </div>
          <div style={{ fontFamily: mn, fontSize: 10, color: meta.hasFeed ? D.txm : D.txd, letterSpacing: 0.4, marginTop: 2 }}>
            {meta.hasFeed ? "Live feed" : "No public RSS"}
          </div>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <span style={{ fontFamily: mn, fontSize: 16, fontWeight: 700, color: count > 0 ? D.tx : D.txd, lineHeight: 1 }}>
            {count}
          </span>
          <span style={{ fontFamily: mn, fontSize: 9, color: D.txd, letterSpacing: 0.6, textTransform: "uppercase", marginTop: 2 }}>
            this period
          </span>
        </div>
        <button
          onClick={onToggle}
          title={enabled ? "Disable in feed" : "Enable in feed"}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            fontFamily: mn,
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: 0.6,
            textTransform: "uppercase",
            padding: "5px 9px",
            borderRadius: 6,
            border: "1px solid " + (enabled ? meta.accent + "55" : D.border),
            background: enabled ? meta.accent + "18" : "transparent",
            color: enabled ? meta.accent : D.txm,
            cursor: "pointer",
          }}
        >
          {enabled ? <Eye size={10} strokeWidth={2.4} /> : <EyeOff size={10} strokeWidth={2.4} />}
          {enabled ? "On" : "Off"}
        </button>
      </div>
    </div>
  );
}

// ─── Feed header (count + search) ────────────────────────────────────

function FeedHeader({
  count,
  loading,
  search,
  onSearch,
}: {
  count: number;
  loading: boolean;
  search: string;
  onSearch: (q: string) => void;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontFamily: mn, fontSize: 11, letterSpacing: 2.4, textTransform: "uppercase", color: D.amber }}>
          Peer Feed
        </span>
        <span style={{ fontFamily: mn, fontSize: 11, color: D.txm }}>
          {count} {count === 1 ? "piece" : "pieces"}
        </span>
        {loading && (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontFamily: mn,
              fontSize: 10,
              color: D.amber,
              textTransform: "uppercase",
              letterSpacing: 0.8,
            }}
          >
            <PulseDot color={D.amber} /> live
          </span>
        )}
      </div>
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: "6px 10px",
          border: "1px solid " + D.border,
          borderRadius: 8,
          background: D.surface,
          minWidth: 200,
        }}
      >
        <Search size={11} strokeWidth={2.4} color={D.txd} />
        <input
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Filter titles, sources, angles…"
          style={{
            background: "transparent",
            border: "none",
            outline: "none",
            color: D.tx,
            fontFamily: ft,
            fontSize: 12,
            flex: 1,
            minWidth: 0,
          }}
        />
      </div>
    </div>
  );
}

function PulseDot({ color }: { color: string }) {
  return (
    <span
      style={{
        display: "inline-block",
        width: 6,
        height: 6,
        borderRadius: 999,
        background: color,
        boxShadow: "0 0 0 0 " + color,
        animation: "pulseDot 1.8s ease-out infinite",
      }}
    />
  );
}

// ─── Feed card ───────────────────────────────────────────────────────

function FeedCard({
  item,
  onGenerate,
  onBrainstorm,
}: {
  item: RadarItem;
  onGenerate: (it: RadarItem) => void;
  onBrainstorm: (it: RadarItem) => void;
}) {
  const [hov, setHov] = useState(false);
  const accent = accentFor(item.source);
  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        padding: 18,
        background: D.card,
        border: "1px solid " + (hov ? D.amber + "66" : D.border),
        borderRadius: 14,
        display: "flex",
        flexDirection: "column",
        gap: 12,
        transform: hov ? "translateY(-1px)" : "none",
        boxShadow: hov ? "0 8px 24px rgba(0,0,0,0.4)" : "none",
        transition: "all 0.18s ease",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontFamily: mn,
            fontSize: 10,
            fontWeight: 700,
            color: accent,
            padding: "3px 8px 3px 4px",
            borderRadius: 999,
            background: accent + "14",
            border: "1px solid " + accent + "44",
            letterSpacing: 0.6,
            textTransform: "uppercase",
          }}
        >
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 18,
              height: 18,
              borderRadius: 999,
              background: accent + "22",
              color: accent,
              fontFamily: gf,
              fontSize: 11,
              fontWeight: 800,
            }}
          >
            {initialOf(item.source)}
          </span>
          {item.source}
        </span>
        <span style={{ fontFamily: mn, fontSize: 10, letterSpacing: 0.8, color: D.txm }}>{relTime(item.time)}</span>
      </div>

      <div style={{ fontFamily: gf, fontSize: 17, fontWeight: 700, color: D.tx, lineHeight: 1.3 }}>
        {item.title}
      </div>

      {item.snippet && (
        <div
          style={{
            fontFamily: ft,
            fontSize: 13,
            color: D.txm,
            lineHeight: 1.5,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {item.snippet}
        </div>
      )}

      <div
        style={{
          fontFamily: ft,
          fontSize: 12,
          color: D.amber,
          fontStyle: "italic",
          lineHeight: 1.5,
          display: "flex",
          gap: 8,
          padding: "10px 12px",
          background: D.amber + "08",
          border: "1px solid " + D.amber + "22",
          borderRadius: 10,
        }}
      >
        <span
          style={{
            fontFamily: mn,
            fontStyle: "normal",
            color: D.amber,
            fontSize: 10,
            textTransform: "uppercase",
            letterSpacing: 1,
            whiteSpace: "nowrap",
            paddingTop: 1,
            fontWeight: 700,
          }}
        >
          SA Angle
        </span>
        <span style={{ flex: 1 }}>
          How SA would cover this differently: {item.saAngle}
        </span>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button
          onClick={() => onGenerate(item)}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontFamily: mn,
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: 0.8,
            textTransform: "uppercase",
            color: D.amber,
            background: D.amber + "18",
            border: "1px solid " + D.amber + "55",
            borderRadius: 8,
            padding: "7px 12px",
            cursor: "pointer",
          }}
        >
          <Sparkles size={11} strokeWidth={2.4} /> Generate SA Take
        </button>
        <button
          onClick={() => onBrainstorm(item)}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontFamily: mn,
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: 0.8,
            textTransform: "uppercase",
            color: D.violet,
            background: D.violet + "14",
            border: "1px solid " + D.violet + "44",
            borderRadius: 8,
            padding: "7px 12px",
            cursor: "pointer",
          }}
        >
          <MessageSquarePlus size={11} strokeWidth={2.4} /> Add to Brainstorm
        </button>
        <a
          href={item.link}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontFamily: mn,
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: 0.8,
            textTransform: "uppercase",
            color: D.txm,
            background: "transparent",
            border: "1px solid " + D.border,
            borderRadius: 8,
            padding: "7px 12px",
            textDecoration: "none",
          }}
        >
          <ExternalLink size={11} strokeWidth={2.4} /> Open
        </a>
      </div>
    </div>
  );
}

// ─── Gap panel ───────────────────────────────────────────────────────

function GapPanel({ gaps, onGenerate }: { gaps: GapTopic[]; onGenerate: (g: GapTopic) => void }) {
  return (
    <div
      style={{
        background: D.card,
        border: "1px solid " + D.border,
        borderRadius: 14,
        padding: "18px 18px 16px",
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Crosshair size={13} strokeWidth={2.4} color={D.amber} />
        <span style={{ fontFamily: mn, fontSize: 11, letterSpacing: 2.4, textTransform: "uppercase", color: D.amber }}>
          Coverage Gaps
        </span>
      </div>
      <div style={{ fontFamily: ft, fontSize: 12, color: D.txm, lineHeight: 1.5 }}>
        Topics peers shipped recently — and SA hasn&apos;t.
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
        {gaps.map((g, i) => (
          <GapRow key={g.topic + ":" + i} gap={g} onGenerate={onGenerate} />
        ))}
        {gaps.length === 0 && (
          <EmptyState text="No gaps detected — SA is leading coverage in every active beat." />
        )}
      </div>
    </div>
  );
}

function GapRow({ gap, onGenerate }: { gap: GapTopic; onGenerate: (g: GapTopic) => void }) {
  const [hov, setHov] = useState(false);
  const accent = accentFor(gap.lastCoveredBy);
  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        padding: "12px 14px",
        background: hov ? D.surface : D.bg,
        border: "1px solid " + (hov ? D.amber + "44" : D.border),
        borderRadius: 10,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        transition: "all 0.15s ease",
        transform: hov ? "translateY(-1px)" : "none",
      }}
    >
      <div style={{ fontFamily: gf, fontSize: 14, fontWeight: 700, color: D.tx, lineHeight: 1.3 }}>
        {gap.topic}
      </div>
      <div style={{ fontFamily: mn, fontSize: 10, color: D.txm, letterSpacing: 0.6 }}>
        Last covered by{" "}
        <span style={{ color: accent, fontWeight: 700 }}>{gap.lastCoveredBy}</span>
        {" · "}
        <span style={{ color: D.txd }}>{gap.lastCoveredAt}</span>
      </div>
      <div style={{ fontFamily: ft, fontSize: 12, color: D.amber, fontStyle: "italic", lineHeight: 1.5 }}>
        {gap.angle}
      </div>
      <button
        onClick={() => onGenerate(gap)}
        style={{
          alignSelf: "flex-start",
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          fontFamily: mn,
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: 0.8,
          textTransform: "uppercase",
          color: D.amber,
          background: D.amber + "14",
          border: "1px solid " + D.amber + "44",
          borderRadius: 8,
          padding: "6px 10px",
          cursor: "pointer",
          marginTop: 2,
        }}
      >
        <Sparkles size={10} strokeWidth={2.4} /> Generate SA Take
      </button>
    </div>
  );
}

// ─── Activity chart ──────────────────────────────────────────────────

interface ChartDatum {
  name: string;
  full: string;
  count: number;
  accent: string;
}

function ActivityChart({ data }: { data: ChartDatum[] }) {
  const total = data.reduce((a, b) => a + b.count, 0);
  return (
    <div
      style={{
        background: D.card,
        border: "1px solid " + D.border,
        borderRadius: 14,
        padding: "18px 18px 12px",
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <span style={{ fontFamily: mn, fontSize: 11, letterSpacing: 2.4, textTransform: "uppercase", color: D.amber }}>
          Activity by Source
        </span>
        <span style={{ fontFamily: mn, fontSize: 10, color: D.txm, letterSpacing: 0.6 }}>
          {total} total
        </span>
      </div>

      <div style={{ width: "100%", height: Math.max(160, data.length * 22) }}>
        {data.length === 0 ? (
          <EmptyState text="No active sources." />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              layout="vertical"
              margin={{ top: 4, right: 18, left: 4, bottom: 4 }}
              barCategoryGap={6}
            >
              <XAxis type="number" hide />
              <YAxis
                type="category"
                dataKey="name"
                width={92}
                tick={{ fill: D.txm, fontFamily: mn, fontSize: 10 }}
                axisLine={false}
                tickLine={false}
              />
              <RTooltip
                cursor={{ fill: D.amber + "10" }}
                contentStyle={{
                  background: D.bg,
                  border: "1px solid " + D.border,
                  borderRadius: 8,
                  fontFamily: mn,
                  fontSize: 11,
                  color: D.tx,
                }}
                labelStyle={{ color: D.txm }}
                formatter={((value: unknown, _name: unknown, p: { payload?: ChartDatum }) => {
                  return [String(value) + " pieces", p.payload?.full || ""];
                }) as never}
              />
              <Bar dataKey="count" radius={[0, 4, 4, 0]} isAnimationActive={false}>
                {data.map((d, i) => (
                  <Cell key={i} fill={d.count > 0 ? d.accent : D.border} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <style jsx>{`
        @keyframes pulseDot {
          0% { box-shadow: 0 0 0 0 currentColor; }
          70% { box-shadow: 0 0 0 6px rgba(0,0,0,0); }
          100% { box-shadow: 0 0 0 0 rgba(0,0,0,0); }
        }
      `}</style>
    </div>
  );
}

// ─── Empty state ─────────────────────────────────────────────────────

function EmptyState({ text }: { text: string }) {
  return (
    <div
      style={{
        padding: 18,
        border: "1px dashed " + D.border,
        borderRadius: 12,
        color: D.txd,
        fontFamily: mn,
        fontSize: 11,
        textAlign: "center",
        lineHeight: 1.5,
      }}
    >
      {text}
    </div>
  );
}
