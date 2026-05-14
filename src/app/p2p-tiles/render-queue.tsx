"use client";

// Render Queue — live status of every Press to Premier project that has a
// recorded renderId. Polls /api/render-video?id= every 6s for in-flight
// jobs and surfaces download links when they finish.

import React, { useCallback, useEffect, useState } from "react";
import { D, ft, gf, mn } from "../shared-constants";
import { TileShell, type TileProps } from "./index";

interface RenderRow {
  projectId: string;
  projectTitle: string;
  aspect: string;
  renderId?: string;
  status?: "queued" | "rendering" | "complete" | "failure" | "unknown";
  progressPct?: number;
  assets?: Array<{ name: string; url: string }>;
  runUrl?: string;
}

interface ProjectShape {
  id: string;
  title?: string;
  data?: { format?: string; aspect?: string; renderId?: string };
}

export function RenderQueueView({ onBack }: TileProps) {
  const [rows, setRows] = useState<RenderRow[]>([]);
  const [loading, setLoading] = useState(true);

  const loadProjects = useCallback(async () => {
    try {
      const res = await fetch("/api/db?table=projects");
      const j = await res.json();
      const row = (j.data || []).find((r: { id: string; type: string }) => r.type === "p2p" && r.id === "p2p-master");
      const projects: ProjectShape[] = row?.data?.projects || [];
      const queued = projects
        .filter((p) => p.data?.renderId)
        .slice(0, 30)
        .map((p): RenderRow => ({
          projectId: p.id,
          projectTitle: p.title || "Untitled",
          aspect: p.data?.format || p.data?.aspect || "16:9",
          renderId: p.data?.renderId,
          status: "unknown",
        }));
      setRows(queued);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  const pollOne = useCallback(async (row: RenderRow): Promise<RenderRow> => {
    if (!row.renderId) return row;
    try {
      const res = await fetch("/api/render-video?id=" + encodeURIComponent(row.renderId));
      const j = await res.json();
      return {
        ...row,
        status: j.status as RenderRow["status"],
        progressPct: j.progressPct,
        assets: j.assets,
        runUrl: j.runUrl,
      };
    } catch {
      return { ...row, status: "unknown" };
    }
  }, []);

  // Initial load + poll on a 6s tick.
  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  useEffect(() => {
    let cancelled = false;
    if (!rows.length) return;
    async function tick() {
      const updated = await Promise.all(rows.map(pollOne));
      if (!cancelled) setRows(updated);
    }
    tick();
    const id = setInterval(tick, 6000);
    return () => { cancelled = true; clearInterval(id); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows.length]);

  return (
    <TileShell
      title="Render Queue"
      badge="QUEUE"
      sub="Every render across the suite. Polls every 6s while jobs are in flight. Click a finished job to download."
      onBack={onBack}
    >
      <div style={{ marginBottom: 14, display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <div style={lbl}>{loading ? "Loading…" : `${rows.length} job${rows.length === 1 ? "" : "s"}`}</div>
        <button
          type="button"
          onClick={loadProjects}
          style={{ background: "transparent", border: `1px solid ${D.border}`, color: D.tx, padding: "6px 12px", borderRadius: 6, fontFamily: mn, fontSize: 11, cursor: "pointer" }}
        >
          Refresh list
        </button>
      </div>

      {rows.length === 0 && !loading ? (
        <div style={emptyBox}>
          No renders in flight. Produce a project and a render row will appear here automatically.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {rows.map((r) => {
            const dot = r.status === "complete" ? D.teal
                      : r.status === "rendering" ? D.amber
                      : r.status === "failure" ? D.coral
                      : D.txd;
            return (
              <div key={r.renderId || r.projectId} style={{ background: D.surface, border: `1px solid ${D.border}`, borderRadius: 10, padding: "12px 14px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: dot, boxShadow: r.status === "rendering" ? `0 0 8px ${dot}` : "none" }} />
                    <div style={{ fontFamily: gf, fontSize: 14, color: D.tx }}>{r.projectTitle}</div>
                    <div style={{ fontFamily: mn, fontSize: 10, color: D.txd, letterSpacing: 0.4 }}>{r.aspect}</div>
                  </div>
                  <div style={{ fontFamily: mn, fontSize: 10, color: D.txd, letterSpacing: 0.6, textTransform: "uppercase" }}>
                    {r.status || "unknown"}{typeof r.progressPct === "number" ? ` · ${Math.round(r.progressPct)}%` : ""}
                  </div>
                </div>
                {typeof r.progressPct === "number" && r.status === "rendering" ? (
                  <div style={{ height: 3, background: D.border, borderRadius: 2, overflow: "hidden", marginBottom: 8 }}>
                    <div style={{ height: "100%", width: `${Math.max(2, r.progressPct)}%`, background: D.amber, transition: "width 0.4s ease" }} />
                  </div>
                ) : null}
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                  {r.assets?.map((a) => (
                    <a key={a.url} href={a.url} target="_blank" rel="noopener noreferrer" style={{ fontFamily: mn, fontSize: 11, color: D.amber, textDecoration: "underline", letterSpacing: 0.4 }}>
                      ↓ {a.name}
                    </a>
                  ))}
                  {r.runUrl ? <a href={r.runUrl} target="_blank" rel="noopener noreferrer" style={{ fontFamily: mn, fontSize: 11, color: D.txm, letterSpacing: 0.4 }}>Logs ↗</a> : null}
                  <div style={{ marginLeft: "auto", fontFamily: mn, fontSize: 10, color: D.txd, letterSpacing: 0.4 }}>{r.renderId}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </TileShell>
  );
}

const lbl: React.CSSProperties = {
  fontFamily: mn,
  fontSize: 10,
  letterSpacing: 1.4,
  textTransform: "uppercase",
  color: D.txd,
};

const emptyBox: React.CSSProperties = {
  border: `1px dashed ${D.border}`,
  borderRadius: 12,
  padding: 28,
  background: D.surface,
  color: D.txm,
  fontFamily: ft,
  fontSize: 14,
  lineHeight: 1.5,
};
