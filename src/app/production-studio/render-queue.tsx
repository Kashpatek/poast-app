"use client";

// ProductionSTUDIO · Render Queue panel.
//
// Phase 6D hub absorption: rather than rebuild the queue, this view
// reuses the same persistence the Premier Suite tile reads from —
// the p2p-master projects row (`/api/db?table=projects&id=p2p-master`)
// — and the same /api/render-video poll endpoint. A small companion
// row at id="render-queue" stores per-row UI overrides (cancellations)
// so we don't have to mutate the canonical p2p-master payload.
//
// The original p2p-tiles/render-queue.tsx view is left untouched so
// Premier Suite keeps working at its current import paths.

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ProductionStudioShell } from "./shell";
import { D, ft, gf, mn, dbGet, dbSave } from "../shared-constants";
import { useToast } from "../toast-context";
import { Bar, BarChart, ResponsiveContainer } from "recharts";

type QueueStatus = "queued" | "running" | "done" | "failed" | "cancelled";

interface QueueRow {
  id: string;
  projectId: string;
  projectTitle: string;
  sourceTool: string;
  aspect: string;
  renderId?: string;
  status: QueueStatus;
  progressPct: number;
  startedAt?: string;
  assets?: Array<{ name: string; url: string }>;
  runUrl?: string;
}

interface QueueOverrides {
  cancelled: Record<string, true>;
  startedAt: Record<string, string>;
}

interface ProjectShape {
  id: string;
  title?: string;
  data?: {
    format?: string;
    aspect?: string;
    renderId?: string;
    sourceTool?: string;
    createdAt?: string;
    updatedAt?: string;
  };
}

interface ProjectsRow {
  id: string;
  type: string;
  data?: { projects?: ProjectShape[]; cancelled?: Record<string, true>; startedAt?: Record<string, string> };
}

interface RenderPollResp {
  status?: QueueStatus | "rendering" | "complete" | "failure" | "unknown";
  progressPct?: number;
  assets?: Array<{ name: string; url: string }>;
  runUrl?: string;
}

const OVERRIDE_ID = "render-queue";
const OVERRIDE_TYPE = "render-queue";

function normalizeStatus(raw: RenderPollResp["status"]): QueueStatus {
  if (raw === "complete" || raw === "done") return "done";
  if (raw === "rendering" || raw === "running") return "running";
  if (raw === "failure" || raw === "failed") return "failed";
  if (raw === "cancelled") return "cancelled";
  return "queued";
}

function statusColor(s: QueueStatus): string {
  if (s === "done") return D.teal;
  if (s === "running") return D.amber;
  if (s === "failed") return D.coral;
  if (s === "cancelled") return D.txd;
  return D.txm;
}

export function RenderQueueView() {
  const { showToast } = useToast();
  const [rows, setRows] = useState<QueueRow[]>([]);
  const [overrides, setOverrides] = useState<QueueOverrides>({ cancelled: {}, startedAt: {} });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load the canonical project list + the override doc.
  const loadProjects = useCallback(async () => {
    setLoading(true);
    try {
      const allProjects = await dbGet("projects") as unknown as ProjectsRow[];
      const master = (allProjects || []).find((r) => r.type === "p2p" && r.id === "p2p-master");
      const projects: ProjectShape[] = master?.data?.projects || [];

      const overrideRow = (allProjects || []).find((r) => r.id === OVERRIDE_ID);
      const cancelled = overrideRow?.data?.cancelled || {};
      const startedAt = overrideRow?.data?.startedAt || {};
      setOverrides({ cancelled, startedAt });

      const queue: QueueRow[] = projects
        .filter((p) => !!p.data?.renderId)
        .slice(0, 50)
        .map((p) => {
          const renderId = p.data!.renderId!;
          const isCancelled = cancelled[renderId] === true;
          return {
            id: renderId,
            projectId: p.id,
            projectTitle: p.title || "Untitled",
            sourceTool: p.data?.sourceTool || "press-to-premier",
            aspect: p.data?.format || p.data?.aspect || "16:9",
            renderId,
            status: isCancelled ? "cancelled" : "queued",
            progressPct: 0,
            startedAt: startedAt[renderId] || p.data?.createdAt || p.data?.updatedAt,
          };
        });
      setRows(queue);
      setError(null);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadProjects(); }, [loadProjects]);

  // Poll any non-terminal job.
  const pollOne = useCallback(async (row: QueueRow): Promise<QueueRow> => {
    if (!row.renderId) return row;
    if (row.status === "cancelled" || row.status === "done" || row.status === "failed") return row;
    try {
      const res = await fetch("/api/render-video?id=" + encodeURIComponent(row.renderId));
      const j: RenderPollResp = await res.json();
      const next: QueueRow = {
        ...row,
        status: normalizeStatus(j.status),
        progressPct: typeof j.progressPct === "number" ? Math.max(0, Math.min(100, j.progressPct)) : row.progressPct,
        assets: j.assets,
        runUrl: j.runUrl,
      };
      // Stamp startedAt the first time we see the job leave "queued".
      if (!row.startedAt && next.status === "running") {
        const stamp = new Date().toISOString();
        next.startedAt = stamp;
        const updated = { ...overrides, startedAt: { ...overrides.startedAt, [row.renderId]: stamp } };
        setOverrides(updated);
        void dbSave("projects", {
          id: OVERRIDE_ID,
          name: "Render Queue Overrides",
          type: OVERRIDE_TYPE,
          data: { cancelled: updated.cancelled, startedAt: updated.startedAt },
          updated_at: new Date().toISOString(),
        });
      }
      return next;
    } catch {
      return row;
    }
  }, [overrides]);

  useEffect(() => {
    if (!rows.length) return;
    let cancelled = false;
    async function tick() {
      const updated = await Promise.all(rows.map(pollOne));
      if (!cancelled) setRows(updated);
    }
    tick();
    const id = setInterval(tick, 6000);
    return () => { cancelled = true; clearInterval(id); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows.length]);

  const persistOverrides = useCallback(async (next: QueueOverrides) => {
    setOverrides(next);
    await dbSave("projects", {
      id: OVERRIDE_ID,
      name: "Render Queue Overrides",
      type: OVERRIDE_TYPE,
      data: { cancelled: next.cancelled, startedAt: next.startedAt },
      updated_at: new Date().toISOString(),
    });
  }, []);

  const cancel = useCallback(async (row: QueueRow) => {
    if (!row.renderId) return;
    const next: QueueOverrides = {
      cancelled: { ...overrides.cancelled, [row.renderId]: true },
      startedAt: overrides.startedAt,
    };
    setRows((cur) => cur.map((r) => (r.id === row.id ? { ...r, status: "cancelled" as const, progressPct: 0 } : r)));
    await persistOverrides(next);
    showToast("Render marked cancelled. The dispatch will run to completion but won't appear in queue.", "info");
  }, [overrides, persistOverrides, showToast]);

  const retry = useCallback((row: QueueRow) => {
    // We don't store the full render payload here, so retry routes the
    // user back to the source project where they can re-dispatch.
    showToast("Opening source project to re-dispatch render.", "info");
    window.location.href = "/?project=" + encodeURIComponent(row.projectId);
  }, [showToast]);

  const stats = useMemo(() => {
    const counts: Record<QueueStatus, number> = { queued: 0, running: 0, done: 0, failed: 0, cancelled: 0 };
    rows.forEach((r) => { counts[r.status] += 1; });
    return counts;
  }, [rows]);

  return (
    <ProductionStudioShell title="Render Queue">
      <div style={{ padding: "24px 28px", maxWidth: 1200, margin: "0 auto" }}>
        <header style={{ marginBottom: 24, display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div>
            <h1 style={{ fontFamily: gf, fontSize: 32, fontWeight: 900, letterSpacing: -0.6, margin: 0, color: D.tx }}>
              Render Queue
            </h1>
            <p style={{ fontFamily: ft, fontSize: 14, color: D.txm, margin: "6px 0 0", maxWidth: 640, lineHeight: 1.5 }}>
              Every background render across ProductionSTUDIO. Polls /api/render-video every 6 s while jobs are in flight. Cancel pins a row out of the queue; Retry re-opens the source project so you can re-dispatch.
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <StatChip label="QUEUED" value={stats.queued} dot={D.txm} />
            <StatChip label="RUNNING" value={stats.running} dot={D.amber} />
            <StatChip label="DONE" value={stats.done} dot={D.teal} />
            <StatChip label="FAILED" value={stats.failed} dot={D.coral} />
            <button
              type="button"
              onClick={loadProjects}
              style={{
                background: "transparent",
                border: `1px solid ${D.border}`,
                color: D.tx,
                padding: "6px 12px",
                borderRadius: 6,
                fontFamily: mn,
                fontSize: 11,
                cursor: "pointer",
                letterSpacing: 0.6,
              }}
            >
              Refresh
            </button>
          </div>
        </header>

        {error ? (
          <div style={{ ...emptyBox, color: D.coral, borderColor: D.coral + "55" }}>
            Failed to load: {error}
          </div>
        ) : loading ? (
          <div style={{ ...emptyBox, color: D.txm }}>
            Loading queue…
          </div>
        ) : rows.length === 0 ? (
          <div style={emptyBox}>
            No render jobs in queue.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <RowHeader />
            {rows.map((r) => (
              <Row key={r.id} row={r} onCancel={cancel} onRetry={retry} />
            ))}
          </div>
        )}
      </div>
    </ProductionStudioShell>
  );
}

function StatChip({ label, value, dot }: { label: string; value: number; dot: string }) {
  return (
    <div style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      padding: "5px 10px", borderRadius: 6,
      background: D.surface, border: `1px solid ${D.border}`,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: dot }} />
      <span style={{ fontFamily: mn, fontSize: 10, color: D.txd, letterSpacing: 0.8 }}>{label}</span>
      <span style={{ fontFamily: mn, fontSize: 11, color: D.tx, fontWeight: 700 }}>{value}</span>
    </div>
  );
}

function RowHeader() {
  const cell: React.CSSProperties = { fontFamily: mn, fontSize: 9, letterSpacing: 1.2, color: D.txd, textTransform: "uppercase" };
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr 0.8fr 1.4fr 0.9fr 0.8fr", gap: 12, padding: "6px 14px" }}>
      <div style={cell}>Job</div>
      <div style={cell}>Source</div>
      <div style={cell}>Status</div>
      <div style={cell}>Progress</div>
      <div style={cell}>Started</div>
      <div style={{ ...cell, textAlign: "right" }}>Actions</div>
    </div>
  );
}

function Row({ row, onCancel, onRetry }: { row: QueueRow; onCancel: (r: QueueRow) => void; onRetry: (r: QueueRow) => void }) {
  const color = statusColor(row.status);
  const startedLabel = row.startedAt ? formatTime(row.startedAt) : "—";
  const pct = Math.max(0, Math.min(100, row.progressPct || 0));

  // Tiny sparkline: render the progress as a single-bar chart so it
  // reads as a clean horizontal bar even in narrow row layout.
  const sparkData = [{ pct }];

  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "1.5fr 1fr 0.8fr 1.4fr 0.9fr 0.8fr",
      gap: 12,
      alignItems: "center",
      padding: "12px 14px",
      background: D.surface,
      border: `1px solid ${D.border}`,
      borderRadius: 10,
    }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontFamily: gf, fontSize: 14, color: D.tx, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {row.projectTitle}
        </div>
        <div style={{ fontFamily: mn, fontSize: 9.5, color: D.txd, letterSpacing: 0.4, marginTop: 2 }}>
          {row.aspect} · {row.id}
        </div>
      </div>

      <div style={{ fontFamily: mn, fontSize: 11, color: D.txm, letterSpacing: 0.3 }}>
        {row.sourceTool}
      </div>

      <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
        <span style={{
          width: 7, height: 7, borderRadius: "50%", background: color,
          boxShadow: row.status === "running" ? `0 0 8px ${color}` : "none",
        }} />
        <span style={{
          fontFamily: mn, fontSize: 10, color, letterSpacing: 0.8, textTransform: "uppercase", fontWeight: 700,
        }}>
          {row.status}
        </span>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ flex: 1, height: 6, background: D.bg, borderRadius: 3, overflow: "hidden", border: `1px solid ${D.border}` }}>
          <div style={{
            height: "100%",
            width: `${pct}%`,
            background: color,
            transition: "width 0.4s ease",
          }} />
        </div>
        <div style={{ width: 38, height: 18 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={sparkData}>
              <Bar dataKey="pct" fill={color} radius={[2, 2, 2, 2]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div style={{ fontFamily: mn, fontSize: 10, color: D.txm, width: 32, textAlign: "right" }}>
          {Math.round(pct)}%
        </div>
      </div>

      <div style={{ fontFamily: mn, fontSize: 10, color: D.txm, letterSpacing: 0.4 }}>
        {startedLabel}
      </div>

      <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
        {(row.status === "queued" || row.status === "running") ? (
          <button type="button" onClick={() => onCancel(row)} style={btn(D.coral)}>Cancel</button>
        ) : null}
        {(row.status === "failed" || row.status === "cancelled") ? (
          <button type="button" onClick={() => onRetry(row)} style={btn(D.amber)}>Retry</button>
        ) : null}
        {row.runUrl ? (
          <a href={row.runUrl} target="_blank" rel="noopener noreferrer" style={btn(D.txm)}>Logs</a>
        ) : null}
      </div>
    </div>
  );
}

function btn(color: string): React.CSSProperties {
  return {
    background: "transparent",
    border: `1px solid ${color}55`,
    color,
    padding: "4px 10px",
    borderRadius: 5,
    fontFamily: mn,
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    cursor: "pointer",
    textDecoration: "none",
    display: "inline-flex",
    alignItems: "center",
  };
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    const now = Date.now();
    const diff = Math.floor((now - d.getTime()) / 1000);
    if (diff < 60) return diff + "s ago";
    if (diff < 3600) return Math.floor(diff / 60) + "m ago";
    if (diff < 86400) return Math.floor(diff / 3600) + "h ago";
    return Math.floor(diff / 86400) + "d ago";
  } catch {
    return iso;
  }
}

const emptyBox: React.CSSProperties = {
  border: `1px dashed ${D.border}`,
  borderRadius: 12,
  padding: 36,
  background: D.surface,
  color: D.txm,
  fontFamily: ft,
  fontSize: 14,
  lineHeight: 1.5,
  textAlign: "center",
};
