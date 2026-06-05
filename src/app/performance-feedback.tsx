"use client";

// Performance Feedback Tracker — manual entry of post URLs + engagement
// data so we can correlate generated drafts with real-world performance.
// Over time, the best performers seed prompt exemplars.
//
// Phase 9A (POAST 4.0):
//   • Auto-ingest from Buffer on mount — merge sent posts into the local
//     log (de-duped by URL when the post text exposes one).
//   • Surface Buffer engagement metrics on row cards when available.
//     Buffer's current schema doesn't return impressions/likes/etc, so
//     the manual 4-point rating system stays as the canonical fallback.
//   • Recharts time series above the log: posts/week (12 weeks),
//     top-5 performers, engagement trend (30 days).
//   • Output bus subscription — captions from Slop Top / Capper / etc.
//     can be one-click logged via a banner ("1 new caption to track").

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { D, ft, gf, mn } from "./shared-constants";
import { confirmDialog } from "./dialog-context";
import { useStore, type ToolOutput } from "./lib/store";

// ─── Types ────────────────────────────────────────────────────────────

interface BufferEngagement {
  impressions?: number;
  clicks?: number;
  likes?: number;
  shares?: number;
  comments?: number;
}

interface PerfRow {
  id: string;
  postUrl: string;
  platform: string;
  source?: string;          // free-form: "sloptop draft", "carousel #4", etc.
  sourceDraftId?: string;
  publishedAt?: string;
  metric: number;           // primary metric — likes / views / etc.
  metricLabel: string;
  reach?: number;
  comments?: number;
  shares?: number;
  notes?: string;
  rating: "performer" | "mid" | "dud" | "unrated";
  addedAt: string;
  addedBy?: string;
  // Phase 9A additions — populated only when Buffer reports them.
  bufferId?: string;
  bufferEngagement?: BufferEngagement;
  ingestedFromBuffer?: boolean;
}

interface BufferPost {
  id: string;
  text?: string;
  sentAt?: string;
  dueAt?: string;
  channel?: { id?: string; name?: string; service?: string };
  channelService?: string;
  // The current Buffer route doesn't surface engagement fields, but if
  // it ever does we read them defensively here.
  engagement?: BufferEngagement;
  impressions?: number;
  clicks?: number;
  likes?: number;
  shares?: number;
  commentsCount?: number;
}

type IngestStatus =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ok"; count: number; at: number }
  | { kind: "unconfigured" }
  | { kind: "error"; message: string };

const PLATFORMS = ["X", "LinkedIn", "Instagram", "TikTok", "YouTube", "Threads", "Other"];

// SA palette (per plan): D.amber, D.cobalt (blue), D.teal, D.coral.
const PALETTE = { amber: D.amber, cobalt: D.blue, teal: D.teal, coral: D.coral };

// ─── Helpers ──────────────────────────────────────────────────────────

function extractFirstUrl(text?: string): string | null {
  if (!text) return null;
  const m = text.match(/https?:\/\/[^\s)]+/);
  return m ? m[0].replace(/[.,;:!?)]+$/, "") : null;
}

function platformFromService(svc?: string): string {
  if (!svc) return "Other";
  const s = svc.toLowerCase();
  if (s.includes("twitter") || s === "x") return "X";
  if (s.includes("linkedin")) return "LinkedIn";
  if (s.includes("instagram")) return "Instagram";
  if (s.includes("tiktok")) return "TikTok";
  if (s.includes("youtube")) return "YouTube";
  if (s.includes("threads")) return "Threads";
  return svc.charAt(0).toUpperCase() + svc.slice(1);
}

function readEngagement(p: BufferPost): BufferEngagement | undefined {
  // Buffer's public schema exposed via /api/buffer doesn't ship
  // engagement today. We still merge any fields we can find — direct
  // top-level numbers OR a nested .engagement object — so when the API
  // surface grows the UI lights up with no extra wiring.
  const e: BufferEngagement = {};
  if (p.engagement && typeof p.engagement === "object") {
    Object.assign(e, p.engagement);
  }
  if (typeof p.impressions === "number") e.impressions = p.impressions;
  if (typeof p.clicks === "number") e.clicks = p.clicks;
  if (typeof p.likes === "number") e.likes = p.likes;
  if (typeof p.shares === "number") e.shares = p.shares;
  if (typeof p.commentsCount === "number") e.comments = p.commentsCount;
  return Object.keys(e).length > 0 ? e : undefined;
}

function engagementPrimary(e?: BufferEngagement): { value: number; label: string } | null {
  if (!e) return null;
  if (typeof e.impressions === "number") return { value: e.impressions, label: "impressions" };
  if (typeof e.likes === "number") return { value: e.likes, label: "likes" };
  if (typeof e.clicks === "number") return { value: e.clicks, label: "clicks" };
  if (typeof e.shares === "number") return { value: e.shares, label: "shares" };
  return null;
}

function previewFromCaptionPayload(payload: unknown, fallback?: string): string {
  if (typeof payload === "string") return payload.slice(0, 140);
  if (payload && typeof payload === "object") {
    const p = payload as Record<string, unknown>;
    for (const key of ["text", "caption", "body", "content", "draft"]) {
      const v = p[key];
      if (typeof v === "string" && v.trim()) return v.slice(0, 140);
    }
  }
  return fallback || "";
}

// ─── Component ────────────────────────────────────────────────────────

export default function PerformanceFeedback() {
  const [rows, setRows] = useState<PerfRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [filter, setFilter] = useState<"all" | "performer" | "mid" | "dud" | "unrated">("all");
  const [ingestStatus, setIngestStatus] = useState<IngestStatus>({ kind: "idle" });
  const [seedFromBus, setSeedFromBus] = useState<Partial<PerfRow> | null>(null);

  // Subscribe to the output bus — captions pushed by Slop Top, Capper,
  // etc. surface here as a one-click "track this post" banner.
  // Select the raw outputs (stable reference under Zustand's Object.is
  // equality); apply the kind filter inside useMemo so we don't return
  // a new array reference on every store change unrelated to caption
  // outputs.
  const allOutputs = useStore((s) => s.outputs);
  const captionOutputs = useMemo(
    () => allOutputs.filter((o) => o.kind === "caption"),
    [allOutputs]
  );
  const [dismissedOutputIds, setDismissedOutputIds] = useState<string[]>([]);
  const pendingCaption = useMemo(
    () => captionOutputs.find((o) => !dismissedOutputIds.includes(o.id)) || null,
    [captionOutputs, dismissedOutputIds]
  );

  // ─── Load existing log ──────────────────────────────────────────────

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/db?table=projects");
      const j = await res.json();
      const row = (j.data || []).find((r: { id: string; type: string }) => r.id === "perf-feedback-master" && r.type === "perf-feedback");
      setRows(row?.data?.rows || []);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // ─── Buffer ingest on mount ─────────────────────────────────────────

  const ingestFromBuffer = useCallback(async (existing: PerfRow[]): Promise<{ status: IngestStatus; merged: PerfRow[] }> => {
    try {
      const r = await fetch("/api/buffer?type=sent");
      if (r.status === 500) {
        const j = await r.json().catch(() => ({}));
        const msg = String(j?.error || "");
        if (msg.includes("BUFFER_API_KEY")) {
          return { status: { kind: "unconfigured" }, merged: existing };
        }
        return { status: { kind: "error", message: msg || "Buffer error" }, merged: existing };
      }
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        return { status: { kind: "error", message: String(j?.error || r.statusText) }, merged: existing };
      }
      const j = await r.json();
      const posts: BufferPost[] = j?.posts || [];
      const knownUrls = new Set(existing.map((row) => row.postUrl));
      const knownBufferIds = new Set(existing.map((row) => row.bufferId).filter(Boolean));
      const added: PerfRow[] = [];
      for (const p of posts) {
        if (knownBufferIds.has(p.id)) continue;
        const url = extractFirstUrl(p.text);
        if (!url) continue;
        if (knownUrls.has(url)) continue;
        const eng = readEngagement(p);
        const primary = engagementPrimary(eng);
        added.push({
          id: "pf-buf-" + p.id,
          bufferId: p.id,
          postUrl: url,
          platform: platformFromService(p.channelService || p.channel?.service),
          source: "buffer · " + (p.channel?.name || p.channel?.service || "post"),
          publishedAt: p.sentAt || p.dueAt,
          metric: primary?.value ?? 0,
          metricLabel: primary?.label ?? "impressions",
          notes: p.text?.slice(0, 280),
          rating: "unrated",
          addedAt: p.sentAt || p.dueAt || new Date().toISOString(),
          bufferEngagement: eng,
          ingestedFromBuffer: true,
        });
        knownUrls.add(url);
      }
      const merged = [...added, ...existing];
      return { status: { kind: "ok", count: added.length, at: Date.now() }, merged };
    } catch (e) {
      return { status: { kind: "error", message: String(e) }, merged: existing };
    }
  }, []);

  // Run at most once per browser session, throttled to 1h between attempts —
  // a navigation back to this tool should not re-hammer the Buffer API or
  // re-persist the projects row when nothing new is on the queue.
  const [bufferTried, setBufferTried] = useState(false);
  useEffect(() => {
    if (loading || bufferTried) return;
    setBufferTried(true);
    var lastAt = 0;
    try {
      var raw = sessionStorage.getItem("poast-perf-buffer-ingest-at");
      if (raw) lastAt = parseInt(raw, 10) || 0;
    } catch { /* ignore */ }
    var now = Date.now();
    if (lastAt && now - lastAt < 60 * 60 * 1000) return;
    setIngestStatus({ kind: "loading" });
    (async () => {
      const { status, merged } = await ingestFromBuffer(rows);
      setIngestStatus(status);
      if (status.kind === "ok") {
        try { sessionStorage.setItem("poast-perf-buffer-ingest-at", String(Date.now())); } catch { /* ignore */ }
        if (status.count > 0) await persist(merged);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, bufferTried, ingestFromBuffer]);

  async function persist(next: PerfRow[]) {
    setRows(next);
    try {
      await fetch("/api/db", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ table: "projects", id: "perf-feedback-master", type: "perf-feedback", data: { rows: next } }),
      });
    } catch { /* ignore */ }
  }

  async function addRow(r: PerfRow) {
    await persist([r, ...rows]);
    setAdding(false);
    setSeedFromBus(null);
  }

  async function rate(id: string, rating: PerfRow["rating"]) {
    await persist(rows.map((r) => r.id === id ? { ...r, rating } : r));
  }

  async function remove(id: string) {
    const ok = await confirmDialog({
      title: "Remove entry?",
      body: "This deletes the performance row — the post itself is untouched.",
      cta: "Remove",
      variant: "danger",
    });
    if (!ok) return;
    await persist(rows.filter((r) => r.id !== id));
  }

  function trackFromBus(out: ToolOutput) {
    const preview = previewFromCaptionPayload(out.payload, out.preview);
    setSeedFromBus({
      source: out.sourceTool + (out.provider ? " · " + out.provider : ""),
      notes: preview,
      sourceDraftId: out.id,
    });
    setAdding(true);
    setDismissedOutputIds((prev) => [...prev, out.id].slice(-50));
  }

  // ─── Derived stats ──────────────────────────────────────────────────

  const filtered = rows.filter((r) => filter === "all" || r.rating === filter);

  const counts = {
    performer: rows.filter((r) => r.rating === "performer").length,
    mid: rows.filter((r) => r.rating === "mid").length,
    dud: rows.filter((r) => r.rating === "dud").length,
    unrated: rows.filter((r) => r.rating === "unrated").length,
  };

  const charts = useMemo(() => buildChartSeries(rows), [rows]);

  // ─── Render ─────────────────────────────────────────────────────────

  return (
    <div style={{ maxWidth: 1180, margin: "0 auto", padding: "40px 32px" }}>
      <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "4px 10px", borderRadius: 999, background: "rgba(38,201,216,0.10)", border: `1px solid ${D.cyan}55`, marginBottom: 14 }}>
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: D.cyan, boxShadow: `0 0 8px ${D.cyan}` }} />
        <span style={{ fontFamily: mn, fontSize: 10, letterSpacing: 1.4, color: D.cyan, textTransform: "uppercase" }}>Feedback loop</span>
      </div>
      <h1 style={{ fontFamily: gf, fontSize: 38, fontWeight: 900, letterSpacing: -1, margin: 0, marginBottom: 8, color: D.tx }}>Performance Tracker</h1>
      <div style={{ fontFamily: ft, fontSize: 15, color: D.txm, maxWidth: 720, lineHeight: 1.5, marginBottom: 18 }}>
        Log post URLs + engagement after they ship. Tag winners and duds. Over time, the best performers can seed future generations.
      </div>

      {/* Buffer ingest status chip */}
      <IngestChip status={ingestStatus} />

      {/* Output bus banner — captions pending for tracking */}
      {pendingCaption ? (
        <BusBanner output={pendingCaption} onTrack={() => trackFromBus(pendingCaption)} onDismiss={() => setDismissedOutputIds((p) => [...p, pendingCaption.id].slice(-50))} />
      ) : null}

      {/* Charts row */}
      {rows.length > 0 ? (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 18 }}>
          <ChartCard title="Posts / week (12w)">
            <ResponsiveContainer width="100%" height={140}>
              <BarChart data={charts.postsPerWeek} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid stroke={D.border} vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 9, fill: D.txd }} axisLine={{ stroke: D.border }} tickLine={false} />
                <YAxis tick={{ fontSize: 9, fill: D.txd }} axisLine={false} tickLine={false} width={32} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
                <Bar dataKey="count" fill={PALETTE.amber} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
          <ChartCard title="Top 5 performers">
            <ResponsiveContainer width="100%" height={140}>
              <BarChart data={charts.topPerformers} layout="vertical" margin={{ top: 4, right: 12, left: 4, bottom: 0 }}>
                <CartesianGrid stroke={D.border} horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 9, fill: D.txd }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="label" tick={{ fontSize: 9, fill: D.txd }} axisLine={false} tickLine={false} width={62} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
                <Bar dataKey="value" fill={PALETTE.teal} radius={[0, 3, 3, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
          <ChartCard title="Engagement (30d)">
            <ResponsiveContainer width="100%" height={140}>
              <LineChart data={charts.engagementTrend} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid stroke={D.border} vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 9, fill: D.txd }} axisLine={{ stroke: D.border }} tickLine={false} />
                <YAxis tick={{ fontSize: 9, fill: D.txd }} axisLine={false} tickLine={false} width={32} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ stroke: D.border }} />
                <Line type="monotone" dataKey="value" stroke={PALETTE.cobalt} strokeWidth={2} dot={{ r: 2, fill: PALETTE.cobalt }} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      ) : null}

      {/* Stats row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 18 }}>
        <StatCard label="Performers" count={counts.performer} color={D.teal} active={filter === "performer"} onClick={() => setFilter(filter === "performer" ? "all" : "performer")} />
        <StatCard label="Mid"        count={counts.mid}       color={D.amber}  active={filter === "mid"}      onClick={() => setFilter(filter === "mid" ? "all" : "mid")} />
        <StatCard label="Duds"       count={counts.dud}       color={D.coral}  active={filter === "dud"}      onClick={() => setFilter(filter === "dud" ? "all" : "dud")} />
        <StatCard label="Unrated"    count={counts.unrated}   color={D.txm}    active={filter === "unrated"}  onClick={() => setFilter(filter === "unrated" ? "all" : "unrated")} />
      </div>

      {/* Toolbar */}
      <div style={{ display: "flex", gap: 8, marginBottom: 14, alignItems: "center" }}>
        <span style={{ fontFamily: mn, fontSize: 11, color: D.txm, letterSpacing: 0.4, flex: 1 }}>
          {loading ? "Loading…" : `${filtered.length} of ${rows.length} entries`}
        </span>
        <button
          type="button"
          onClick={() => { setSeedFromBus(null); setAdding(true); }}
          style={{ background: D.amber, color: "#060608", border: "none", padding: "8px 16px", borderRadius: 8, fontFamily: ft, fontSize: 12, fontWeight: 800, cursor: "pointer" }}
        >
          + Log a post
        </button>
      </div>

      {/* Rows */}
      {filtered.length === 0 && !loading ? (
        <div style={emptyBox}>
          {rows.length === 0
            ? "No posts logged yet. Click '+ Log a post' to start tracking what's working."
            : "No entries match this filter."}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {filtered.map((r) => (
            <PerfRowCard key={r.id} row={r} onRate={(rating) => rate(r.id, rating)} onRemove={() => remove(r.id)} />
          ))}
        </div>
      )}

      {/* Add modal */}
      {adding ? <AddPerfModal seed={seedFromBus} onCancel={() => { setAdding(false); setSeedFromBus(null); }} onAdd={addRow} /> : null}
    </div>
  );
}

// ─── Chart series ─────────────────────────────────────────────────────

function buildChartSeries(rows: PerfRow[]) {
  // Posts per week — 12 ISO weeks ending today, oldest first.
  const now = Date.now();
  const WEEK = 7 * 24 * 60 * 60 * 1000;
  const buckets: { label: string; count: number; start: number; end: number }[] = [];
  for (let i = 11; i >= 0; i--) {
    const end = now - i * WEEK;
    const start = end - WEEK;
    const d = new Date(end);
    buckets.push({
      label: `${d.getMonth() + 1}/${d.getDate()}`,
      count: 0,
      start, end,
    });
  }
  for (const r of rows) {
    const t = new Date(r.publishedAt || r.addedAt).getTime();
    if (!Number.isFinite(t)) continue;
    for (const b of buckets) {
      if (t >= b.start && t < b.end) { b.count++; break; }
    }
  }
  const postsPerWeek = buckets.map(({ label, count }) => ({ label, count }));

  // Top 5 performers — sort by Buffer engagement primary if available,
  // else by manual rating tier + metric value.
  const ratingScore: Record<PerfRow["rating"], number> = { performer: 3, mid: 2, unrated: 1, dud: 0 };
  const scored = rows.map((r) => {
    const engPrimary = engagementPrimary(r.bufferEngagement);
    const value = engPrimary?.value ?? r.metric ?? 0;
    return { row: r, value, rating: ratingScore[r.rating] };
  });
  scored.sort((a, b) => (b.rating - a.rating) || (b.value - a.value));
  const topPerformers = scored.slice(0, 5).map(({ row, value }) => ({
    label: shortLabel(row),
    value: value || 0,
  }));

  // Engagement trend — last 30 days, daily totals of Buffer primary or
  // manual metric for rows on that day. Empty days = 0.
  const DAY = 24 * 60 * 60 * 1000;
  const daily: { label: string; value: number; start: number; end: number }[] = [];
  for (let i = 29; i >= 0; i--) {
    const end = now - i * DAY;
    const start = end - DAY;
    const d = new Date(end);
    daily.push({
      label: `${d.getMonth() + 1}/${d.getDate()}`,
      value: 0,
      start, end,
    });
  }
  for (const r of rows) {
    const t = new Date(r.publishedAt || r.addedAt).getTime();
    if (!Number.isFinite(t)) continue;
    const engPrimary = engagementPrimary(r.bufferEngagement);
    const v = engPrimary?.value ?? r.metric ?? 0;
    for (const b of daily) {
      if (t >= b.start && t < b.end) { b.value += v; break; }
    }
  }
  const engagementTrend = daily.map(({ label, value }) => ({ label, value }));

  return { postsPerWeek, topPerformers, engagementTrend };
}

function shortLabel(r: PerfRow): string {
  if (r.source) return r.source.replace(/^buffer · /, "").slice(0, 16);
  try {
    const u = new URL(r.postUrl);
    return (u.hostname.replace(/^www\./, "") + u.pathname).slice(0, 16);
  } catch {
    return r.postUrl.slice(0, 16);
  }
}

// ─── Sub-components ───────────────────────────────────────────────────

function IngestChip({ status }: { status: IngestStatus }) {
  let bg = "rgba(255,255,255,0.03)";
  let border = D.border;
  let dot = D.txd;
  let text = "";
  if (status.kind === "loading") { text = "Checking Buffer…"; dot = D.amber; }
  else if (status.kind === "ok" && status.count > 0) { text = `${status.count} post${status.count === 1 ? "" : "s"} ingested from Buffer just now`; dot = D.teal; bg = "rgba(46,173,142,0.08)"; border = D.teal + "55"; }
  else if (status.kind === "ok" && status.count === 0) { text = "Buffer in sync — no new posts to ingest"; dot = D.teal; }
  else if (status.kind === "unconfigured") { text = "Buffer not configured — manual logging only"; dot = D.amber; bg = "rgba(247,176,65,0.08)"; border = D.amber + "55"; }
  else if (status.kind === "error") { text = `Buffer ingest failed: ${status.message.slice(0, 80)}`; dot = D.coral; bg = "rgba(224,99,71,0.08)"; border = D.coral + "55"; }
  else return null;
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "5px 12px", borderRadius: 999, background: bg, border: `1px solid ${border}`, marginBottom: 14 }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: dot }} />
      <span style={{ fontFamily: mn, fontSize: 10, letterSpacing: 0.6, color: D.tx, textTransform: "uppercase" }}>{text}</span>
    </div>
  );
}

function BusBanner({ output, onTrack, onDismiss }: { output: ToolOutput; onTrack: () => void; onDismiss: () => void }) {
  const preview = previewFromCaptionPayload(output.payload, output.preview);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 10, background: "rgba(11,134,209,0.08)", border: `1px solid ${D.blue}55`, marginBottom: 14 }}>
      <span style={{ fontFamily: mn, fontSize: 10, color: D.blue, letterSpacing: 1.2, textTransform: "uppercase" }}>1 new caption from {output.sourceTool}</span>
      <span style={{ fontFamily: ft, fontSize: 12, color: D.txm, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        “{preview}”
      </span>
      <button type="button" onClick={onTrack} style={{ background: D.blue, color: "#06060C", border: "none", padding: "6px 12px", borderRadius: 6, fontFamily: ft, fontSize: 11, fontWeight: 800, cursor: "pointer" }}>
        Track this post
      </button>
      <button type="button" onClick={onDismiss} style={{ background: "transparent", border: "none", color: D.txd, fontFamily: mn, fontSize: 14, cursor: "pointer", lineHeight: 1 }} aria-label="Dismiss">×</button>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: D.surface, border: `1px solid ${D.border}`, borderRadius: 10, padding: "10px 12px 6px" }}>
      <div style={{ fontFamily: mn, fontSize: 9, letterSpacing: 1.2, color: D.txd, textTransform: "uppercase", marginBottom: 4 }}>{title}</div>
      {children}
    </div>
  );
}

function StatCard({ label, count, color, active, onClick }: { label: string; count: number; color: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        background: active ? color + "1c" : D.surface,
        border: `1px solid ${active ? color : D.border}`,
        borderRadius: 10,
        padding: "14px 16px",
        textAlign: "left",
        cursor: "pointer",
        fontFamily: ft,
      }}
    >
      <div style={{ fontFamily: mn, fontSize: 10, letterSpacing: 1.2, color: D.txd, textTransform: "uppercase", marginBottom: 6 }}>{label}</div>
      <div style={{ fontFamily: gf, fontSize: 28, fontWeight: 900, color: color, letterSpacing: -0.8, lineHeight: 1 }}>{count}</div>
    </button>
  );
}

function PerfRowCard({ row, onRate, onRemove }: { row: PerfRow; onRate: (r: PerfRow["rating"]) => void; onRemove: () => void }) {
  const ratingColor = row.rating === "performer" ? D.teal : row.rating === "mid" ? D.amber : row.rating === "dud" ? D.coral : D.txd;
  const eng = row.bufferEngagement;
  return (
    <div style={{ background: D.surface, border: `1px solid ${D.border}`, borderRadius: 10, padding: "12px 16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, marginBottom: 8, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
          <span style={{ fontFamily: mn, fontSize: 10, color: D.amber, letterSpacing: 1.2, textTransform: "uppercase" }}>{row.platform}</span>
          {row.ingestedFromBuffer ? (
            <span style={{ fontFamily: mn, fontSize: 9, color: D.blue, letterSpacing: 0.8, padding: "1px 6px", borderRadius: 4, background: D.blue + "1c", border: `1px solid ${D.blue}55`, textTransform: "uppercase" }}>Buffer</span>
          ) : null}
          <a href={row.postUrl} target="_blank" rel="noopener noreferrer" style={{ fontFamily: ft, fontSize: 13, color: D.tx, textDecoration: "underline", maxWidth: 480, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {row.postUrl}
          </a>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, fontFamily: mn, fontSize: 11, color: D.txm }}>
          {eng ? (
            <>
              {typeof eng.impressions === "number" ? <span><strong style={{ color: D.tx }}>{eng.impressions.toLocaleString()}</strong> impressions</span> : null}
              {typeof eng.likes === "number" ? <span><strong style={{ color: D.tx }}>{eng.likes.toLocaleString()}</strong> likes</span> : null}
              {typeof eng.clicks === "number" ? <span>{eng.clicks.toLocaleString()} clicks</span> : null}
              {typeof eng.shares === "number" ? <span>{eng.shares.toLocaleString()} shares</span> : null}
              {typeof eng.comments === "number" ? <span>{eng.comments.toLocaleString()} comments</span> : null}
            </>
          ) : (
            <>
              <span><strong style={{ color: D.tx }}>{row.metric.toLocaleString()}</strong> {row.metricLabel}</span>
              {row.reach ? <span>{row.reach.toLocaleString()} reach</span> : null}
              {row.comments ? <span>{row.comments} comments</span> : null}
            </>
          )}
        </div>
      </div>
      {row.source ? (
        <div style={{ fontFamily: mn, fontSize: 10, color: D.txd, letterSpacing: 0.4, marginBottom: 8 }}>
          source: {row.source}
        </div>
      ) : null}
      {row.notes ? (
        <div style={{ fontFamily: ft, fontSize: 12, color: D.txm, lineHeight: 1.5, marginBottom: 10, padding: "6px 10px", background: "rgba(255,255,255,0.02)", borderRadius: 6 }}>
          {row.notes}
        </div>
      ) : null}
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        {(["performer", "mid", "dud"] as const).map((r) => {
          const active = row.rating === r;
          const color = r === "performer" ? D.teal : r === "mid" ? D.amber : D.coral;
          return (
            <button
              key={r}
              type="button"
              onClick={() => onRate(r)}
              style={{
                padding: "4px 10px",
                background: active ? color : "transparent",
                color: active ? "#060608" : color,
                border: `1px solid ${color}`,
                borderRadius: 4,
                fontFamily: mn,
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: 0.6,
                cursor: "pointer",
                textTransform: "uppercase",
              }}
            >
              {r}
            </button>
          );
        })}
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>
          {row.rating !== "unrated" ? <span style={{ width: 6, height: 6, borderRadius: "50%", background: ratingColor }} /> : null}
          <span style={{ fontFamily: mn, fontSize: 9, color: D.txd, letterSpacing: 0.4 }}>
            {new Date(row.addedAt).toLocaleDateString()}
          </span>
          <button type="button" onClick={onRemove} style={{ background: "transparent", border: "none", color: D.coral, fontFamily: mn, fontSize: 10, cursor: "pointer" }}>
            Remove
          </button>
        </div>
      </div>
    </div>
  );
}

function AddPerfModal({ onCancel, onAdd, seed }: { onCancel: () => void; onAdd: (r: PerfRow) => void; seed: Partial<PerfRow> | null }) {
  const [postUrl, setPostUrl] = useState(seed?.postUrl || "");
  const [platform, setPlatform] = useState(seed?.platform || "X");
  const [metric, setMetric] = useState(seed?.metric != null ? String(seed.metric) : "");
  const [metricLabel, setMetricLabel] = useState(seed?.metricLabel || "views");
  const [reach, setReach] = useState(seed?.reach != null ? String(seed.reach) : "");
  const [comments, setComments] = useState(seed?.comments != null ? String(seed.comments) : "");
  const [source, setSource] = useState(seed?.source || "");
  const [notes, setNotes] = useState(seed?.notes || "");

  const valid = !!postUrl.trim() && !!metric.trim();

  function save() {
    if (!valid) return;
    onAdd({
      id: "pf-" + Date.now(),
      postUrl: postUrl.trim(),
      platform,
      source: source.trim() || undefined,
      sourceDraftId: seed?.sourceDraftId,
      metric: Number(metric) || 0,
      metricLabel: metricLabel || "views",
      reach: reach ? Number(reach) : undefined,
      comments: comments ? Number(comments) : undefined,
      notes: notes.trim() || undefined,
      rating: "unrated",
      addedAt: new Date().toISOString(),
    });
  }

  return (
    <div style={overlay} onClick={onCancel}>
      <div style={panel} onClick={(e) => e.stopPropagation()}>
        <div style={{ fontFamily: mn, fontSize: 10, letterSpacing: 1.4, color: D.amber, textTransform: "uppercase", marginBottom: 12 }}>
          {seed?.sourceDraftId ? "Track this post (from bus)" : "Log a post"}
        </div>
        <Field label="Post URL"        value={postUrl}      onChange={setPostUrl}      placeholder="https://x.com/..." />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
          <div>
            <div style={lbl}>Platform</div>
            <select value={platform} onChange={(e) => setPlatform(e.target.value)} style={inputStyle}>
              {PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <Field label="Source / draft (optional)" value={source} onChange={setSource} placeholder="sloptop draft #4" />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 12 }}>
          <Field label="Metric value" value={metric}     onChange={setMetric}     placeholder="12500" />
          <Field label="Metric label" value={metricLabel} onChange={setMetricLabel} placeholder="views" />
          <Field label="Reach"        value={reach}      onChange={setReach}      placeholder="35000" />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
          <Field label="Comments" value={comments} onChange={setComments} placeholder="42" />
        </div>
        <Field label="Notes (optional)" value={notes} onChange={setNotes} placeholder="What worked / didn't" multi />
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
          <button type="button" onClick={onCancel} style={ghostBtn}>Cancel</button>
          <button type="button" onClick={save} disabled={!valid} style={{ ...primaryBtn, opacity: valid ? 1 : 0.5 }}>Log it</button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, multi }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; multi?: boolean }) {
  return (
    <div>
      <div style={lbl}>{label}</div>
      {multi ? (
        <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} style={{ ...inputStyle, minHeight: 60, resize: "vertical" }} />
      ) : (
        <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} style={inputStyle} />
      )}
    </div>
  );
}

const lbl: React.CSSProperties = { fontFamily: mn, fontSize: 10, letterSpacing: 1.2, textTransform: "uppercase", color: D.txd, marginBottom: 4 };
const inputStyle: React.CSSProperties = { width: "100%", padding: "8px 10px", background: "rgba(255,255,255,0.03)", border: `1px solid ${D.border}`, borderRadius: 6, color: D.tx, fontFamily: ft, fontSize: 13, outline: "none", boxSizing: "border-box" };
const primaryBtn: React.CSSProperties = { background: D.amber, color: "#060608", border: "none", padding: "8px 18px", borderRadius: 6, fontFamily: ft, fontSize: 12, fontWeight: 800, cursor: "pointer" };
const ghostBtn: React.CSSProperties = { background: "transparent", color: D.tx, border: `1px solid ${D.border}`, padding: "8px 14px", borderRadius: 6, fontFamily: ft, fontSize: 12, cursor: "pointer" };
const emptyBox: React.CSSProperties = { border: `1px dashed ${D.border}`, borderRadius: 12, padding: 28, background: D.surface, color: D.txm, fontFamily: ft, fontSize: 14, lineHeight: 1.5 };
const overlay: React.CSSProperties = { position: "fixed", inset: 0, background: "rgba(6,6,12,0.78)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)", zIndex: 12000, display: "flex", alignItems: "safe center", justifyContent: "center", overflowY: "auto", padding: 24 };
const panel: React.CSSProperties = { width: "min(640px, 96vw)", background: "#0A0A14", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: "26px 28px 22px", maxHeight: "calc(100vh - 48px)", overflowY: "auto" };
const tooltipStyle: React.CSSProperties = { background: "#0A0A14", border: `1px solid ${D.border}`, borderRadius: 6, fontFamily: mn, fontSize: 11, color: D.tx, padding: "6px 10px" };
