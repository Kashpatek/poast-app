"use client";

// Performance Feedback Tracker — manual entry of post URLs + engagement
// data so we can correlate generated drafts with real-world performance.
// Over time, the best performers seed prompt exemplars.

import React, { useCallback, useEffect, useState } from "react";
import { D, ft, gf, mn } from "./shared-constants";
import { confirmDialog } from "./dialog-context";

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
}

const PLATFORMS = ["X", "LinkedIn", "Instagram", "TikTok", "YouTube", "Threads", "Other"];

export default function PerformanceFeedback() {
  const [rows, setRows] = useState<PerfRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [filter, setFilter] = useState<"all" | "performer" | "mid" | "dud" | "unrated">("all");

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

  const filtered = rows.filter((r) => filter === "all" || r.rating === filter);

  // Summary stats
  const counts = {
    performer: rows.filter((r) => r.rating === "performer").length,
    mid: rows.filter((r) => r.rating === "mid").length,
    dud: rows.filter((r) => r.rating === "dud").length,
    unrated: rows.filter((r) => r.rating === "unrated").length,
  };

  return (
    <div style={{ maxWidth: 1180, margin: "0 auto", padding: "40px 32px" }}>
      <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "4px 10px", borderRadius: 999, background: "rgba(38,201,216,0.10)", border: `1px solid ${D.cyan}55`, marginBottom: 14 }}>
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: D.cyan, boxShadow: `0 0 8px ${D.cyan}` }} />
        <span style={{ fontFamily: mn, fontSize: 10, letterSpacing: 1.4, color: D.cyan, textTransform: "uppercase" }}>Feedback loop</span>
      </div>
      <h1 style={{ fontFamily: gf, fontSize: 38, fontWeight: 900, letterSpacing: -1, margin: 0, marginBottom: 8, color: D.tx }}>Performance Tracker</h1>
      <div style={{ fontFamily: ft, fontSize: 15, color: D.txm, maxWidth: 720, lineHeight: 1.5, marginBottom: 28 }}>
        Log post URLs + engagement after they ship. Tag winners and duds. Over time, the best performers can seed future generations.
      </div>

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
          onClick={() => setAdding(true)}
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
      {adding ? <AddPerfModal onCancel={() => setAdding(false)} onAdd={addRow} /> : null}
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
  return (
    <div style={{ background: D.surface, border: `1px solid ${D.border}`, borderRadius: 10, padding: "12px 16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, marginBottom: 8, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
          <span style={{ fontFamily: mn, fontSize: 10, color: D.amber, letterSpacing: 1.2, textTransform: "uppercase" }}>{row.platform}</span>
          <a href={row.postUrl} target="_blank" rel="noopener noreferrer" style={{ fontFamily: ft, fontSize: 13, color: D.tx, textDecoration: "underline", maxWidth: 480, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {row.postUrl}
          </a>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, fontFamily: mn, fontSize: 11, color: D.txm }}>
          <span><strong style={{ color: D.tx }}>{row.metric.toLocaleString()}</strong> {row.metricLabel}</span>
          {row.reach ? <span>{row.reach.toLocaleString()} reach</span> : null}
          {row.comments ? <span>{row.comments} comments</span> : null}
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

function AddPerfModal({ onCancel, onAdd }: { onCancel: () => void; onAdd: (r: PerfRow) => void }) {
  const [postUrl, setPostUrl] = useState("");
  const [platform, setPlatform] = useState("X");
  const [metric, setMetric] = useState("");
  const [metricLabel, setMetricLabel] = useState("views");
  const [reach, setReach] = useState("");
  const [comments, setComments] = useState("");
  const [source, setSource] = useState("");
  const [notes, setNotes] = useState("");

  const valid = !!postUrl.trim() && !!metric.trim();

  function save() {
    if (!valid) return;
    onAdd({
      id: "pf-" + Date.now(),
      postUrl: postUrl.trim(),
      platform,
      source: source.trim() || undefined,
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
        <div style={{ fontFamily: mn, fontSize: 10, letterSpacing: 1.4, color: D.amber, textTransform: "uppercase", marginBottom: 12 }}>Log a post</div>
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
