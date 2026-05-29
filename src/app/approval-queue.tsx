"use client";

// Approval Queue — interns / writers tag their drafts as pending_review,
// the queue surfaces them to reviewers (Akash / Michelle) who can
// approve, request changes, or reject. Once approved, the draft is
// marked ready_to_publish (or auto-routes to Buffer in a follow-up).

import React, { useCallback, useEffect, useState } from "react";
import { D, ft, gf, mn } from "./shared-constants";
import { useUser } from "./user-context";
import { confirmDialog } from "./dialog-context";

interface ReviewItem {
  id: string;
  title: string;
  content: string;
  platform?: string;
  tool: string;            // "sloptop", "carousel", "sa-weekly", etc.
  author: string;
  status: "pending_review" | "changes_requested" | "approved" | "rejected";
  reviewerNotes?: string;
  reviewer?: string;
  createdAt: string;
  updatedAt?: string;
  externalRef?: { url?: string; assetId?: string };
}

const PLATFORMS = ["X", "LinkedIn", "Instagram", "TikTok", "YouTube", "Newsletter", "Other"];

export default function ApprovalQueue() {
  const userCtx = useUser();
  const me = userCtx.user?.name || "Anonymous";
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<ReviewItem["status"] | "all" | "mine">("pending_review");
  const [submitOpen, setSubmitOpen] = useState(false);
  const [reviewing, setReviewing] = useState<ReviewItem | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/db?table=projects");
      const j = await res.json();
      const row = (j.data || []).find((r: { id: string; type: string }) => r.id === "approval-queue-master" && r.type === "approval-queue");
      setItems(row?.data?.items || []);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function persist(next: ReviewItem[]) {
    setItems(next);
    try {
      await fetch("/api/db", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ table: "projects", id: "approval-queue-master", type: "approval-queue", data: { items: next } }),
      });
    } catch { /* ignore */ }
  }

  async function submit(item: ReviewItem) {
    await persist([item, ...items]);
    setSubmitOpen(false);
  }

  async function review(id: string, status: ReviewItem["status"], reviewerNotes?: string) {
    await persist(items.map((it) =>
      it.id === id
        ? { ...it, status, reviewer: me, reviewerNotes, updatedAt: new Date().toISOString() }
        : it
    ));
    setReviewing(null);
  }

  async function remove(id: string) {
    const target = items.find((i) => i.id === id);
    const ok = await confirmDialog({
      title: "Remove from queue?",
      body: target ? `"${target.title}" will be removed for everyone.` : "This will be removed for everyone.",
      cta: "Remove",
      variant: "danger",
    });
    if (!ok) return;
    await persist(items.filter((i) => i.id !== id));
  }

  const filtered = items.filter((it) => {
    if (filter === "all") return true;
    if (filter === "mine") return it.author === me;
    return it.status === filter;
  });

  const counts = {
    pending_review: items.filter((i) => i.status === "pending_review").length,
    changes_requested: items.filter((i) => i.status === "changes_requested").length,
    approved: items.filter((i) => i.status === "approved").length,
    rejected: items.filter((i) => i.status === "rejected").length,
    mine: items.filter((i) => i.author === me).length,
  };

  return (
    <div style={{ maxWidth: 1180, margin: "0 auto", padding: "40px 32px" }}>
      <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "4px 10px", borderRadius: 999, background: "rgba(144,92,203,0.10)", border: `1px solid ${D.violet}55`, marginBottom: 14 }}>
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: D.violet, boxShadow: `0 0 8px ${D.violet}` }} />
        <span style={{ fontFamily: mn, fontSize: 10, letterSpacing: 1.4, color: D.violet, textTransform: "uppercase" }}>Workflow</span>
      </div>
      <h1 style={{ fontFamily: gf, fontSize: 38, fontWeight: 900, letterSpacing: -1, margin: 0, marginBottom: 8, color: D.tx }}>Approval Queue</h1>
      <div style={{ fontFamily: ft, fontSize: 15, color: D.txm, maxWidth: 720, lineHeight: 1.5, marginBottom: 28 }}>
        Submit a draft for review. Reviewers approve, request changes, or reject. Nothing ships without sign-off.
      </div>

      {/* Counter row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8, marginBottom: 18 }}>
        <StatCard label="Pending"   count={counts.pending_review}    color={D.amber} active={filter === "pending_review"}    onClick={() => setFilter("pending_review")} />
        <StatCard label="Changes"   count={counts.changes_requested} color={D.coral} active={filter === "changes_requested"} onClick={() => setFilter("changes_requested")} />
        <StatCard label="Approved"  count={counts.approved}          color={D.teal}  active={filter === "approved"}          onClick={() => setFilter("approved")} />
        <StatCard label="Rejected"  count={counts.rejected}          color={D.txd}   active={filter === "rejected"}          onClick={() => setFilter("rejected")} />
        <StatCard label="Mine"      count={counts.mine}              color={D.blue}  active={filter === "mine"}              onClick={() => setFilter("mine")} />
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <span style={{ fontFamily: mn, fontSize: 11, color: D.txm, letterSpacing: 0.4 }}>
          {loading ? "Loading…" : `${filtered.length} of ${items.length} items`}
        </span>
        <button
          type="button"
          onClick={() => setSubmitOpen(true)}
          style={{ background: D.amber, color: "#060608", border: "none", padding: "8px 16px", borderRadius: 8, fontFamily: ft, fontSize: 12, fontWeight: 800, cursor: "pointer" }}
        >
          + Submit for review
        </button>
      </div>

      {filtered.length === 0 && !loading ? (
        <div style={emptyBox}>
          {items.length === 0
            ? "No items in the queue yet. Click '+ Submit for review' to send your first draft."
            : "Nothing matches this filter."}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {filtered.map((it) => <ReviewCard key={it.id} item={it} me={me} onOpen={() => setReviewing(it)} onRemove={() => remove(it.id)} />)}
        </div>
      )}

      {submitOpen ? <SubmitModal me={me} onCancel={() => setSubmitOpen(false)} onSubmit={submit} /> : null}
      {reviewing ? <ReviewModal item={reviewing} me={me} onCancel={() => setReviewing(null)} onAction={review} /> : null}
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
        padding: "12px 14px",
        textAlign: "left",
        cursor: "pointer",
        fontFamily: ft,
      }}
    >
      <div style={{ fontFamily: mn, fontSize: 10, letterSpacing: 1.2, color: D.txd, textTransform: "uppercase", marginBottom: 6 }}>{label}</div>
      <div style={{ fontFamily: gf, fontSize: 26, fontWeight: 900, color: color, letterSpacing: -0.6, lineHeight: 1 }}>{count}</div>
    </button>
  );
}

function ReviewCard({ item, me, onOpen, onRemove }: { item: ReviewItem; me: string; onOpen: () => void; onRemove: () => void }) {
  const statusColor = item.status === "approved" ? D.teal : item.status === "rejected" ? D.txd : item.status === "changes_requested" ? D.coral : D.amber;
  const statusLabel = item.status === "pending_review" ? "PENDING" : item.status === "changes_requested" ? "CHANGES" : item.status.toUpperCase();
  return (
    <div style={{ background: D.surface, border: `1px solid ${D.border}`, borderRadius: 10, padding: "14px 16px", cursor: "pointer" }} onClick={onOpen}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
        <div style={{ fontFamily: gf, fontSize: 16, fontWeight: 700, color: D.tx, letterSpacing: -0.3 }}>{item.title}</div>
        <span style={{ fontFamily: mn, fontSize: 10, padding: "2px 8px", background: statusColor + "1c", color: statusColor, border: `1px solid ${statusColor}55`, borderRadius: 4, letterSpacing: 0.8 }}>
          {statusLabel}
        </span>
      </div>
      <div style={{ fontFamily: ft, fontSize: 12.5, color: D.txm, lineHeight: 1.5, marginBottom: 8, maxHeight: 60, overflow: "hidden" }}>
        {item.content.slice(0, 240)}{item.content.length > 240 ? "…" : ""}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", fontFamily: mn, fontSize: 10, color: D.txd, letterSpacing: 0.4 }}>
        <span>{item.author} · {item.tool} · {item.platform || "any"}</span>
        <span>
          {item.author === me ? <span style={{ color: D.blue, marginRight: 8 }}>YOU</span> : null}
          <button type="button" onClick={(e) => { e.stopPropagation(); onRemove(); }} style={{ background: "transparent", border: "none", color: D.coral, fontFamily: mn, fontSize: 10, cursor: "pointer" }}>Remove</button>
        </span>
      </div>
    </div>
  );
}

function SubmitModal({ me, onCancel, onSubmit }: { me: string; onCancel: () => void; onSubmit: (i: ReviewItem) => void }) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [platform, setPlatform] = useState("X");
  const [tool, setTool] = useState("sloptop");
  const valid = title.trim().length > 0 && content.trim().length > 0;
  return (
    <div style={overlay} onClick={onCancel}>
      <div style={panel} onClick={(e) => e.stopPropagation()}>
        <div style={{ fontFamily: mn, fontSize: 10, letterSpacing: 1.4, color: D.amber, textTransform: "uppercase", marginBottom: 12 }}>Submit for review</div>
        <Field label="Title" value={title} onChange={setTitle} placeholder="Short label so reviewers know what they're looking at" />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
          <div>
            <div style={lbl}>Platform</div>
            <select value={platform} onChange={(e) => setPlatform(e.target.value)} style={inputStyle}>
              {PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <Field label="Source tool" value={tool} onChange={setTool} placeholder="sloptop, carousel, sa-weekly..." />
        </div>
        <Field label="Draft content" value={content} onChange={setContent} multi placeholder="Paste the draft text the reviewer should see" />
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
          <button type="button" onClick={onCancel} style={ghostBtn}>Cancel</button>
          <button
            type="button"
            disabled={!valid}
            onClick={() => onSubmit({
              id: "rv-" + Date.now(),
              title: title.trim(),
              content: content.trim(),
              platform,
              tool,
              author: me,
              status: "pending_review",
              createdAt: new Date().toISOString(),
            })}
            style={{ ...primaryBtn, opacity: valid ? 1 : 0.5 }}
          >
            Send to queue
          </button>
        </div>
      </div>
    </div>
  );
}

function ReviewModal({ item, me, onCancel, onAction }: { item: ReviewItem; me: string; onCancel: () => void; onAction: (id: string, s: ReviewItem["status"], notes?: string) => void }) {
  const [notes, setNotes] = useState(item.reviewerNotes || "");
  const isAuthor = item.author === me;
  return (
    <div style={overlay} onClick={onCancel}>
      <div style={panel} onClick={(e) => e.stopPropagation()}>
        <div style={{ fontFamily: mn, fontSize: 10, letterSpacing: 1.4, color: D.amber, textTransform: "uppercase", marginBottom: 12 }}>
          {isAuthor ? "Your submission" : "Review"}
        </div>
        <div style={{ fontFamily: gf, fontSize: 22, fontWeight: 800, color: D.tx, letterSpacing: -0.5, marginBottom: 6 }}>{item.title}</div>
        <div style={{ fontFamily: mn, fontSize: 11, color: D.txd, letterSpacing: 0.4, marginBottom: 18 }}>
          {item.author} · {item.tool} · {item.platform || "any"} · {new Date(item.createdAt).toLocaleString()}
        </div>
        <div style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${D.border}`, borderRadius: 8, padding: "14px 16px", fontFamily: ft, fontSize: 13, color: D.tx, whiteSpace: "pre-wrap", lineHeight: 1.6, marginBottom: 18, maxHeight: 320, overflowY: "auto" }}>
          {item.content}
        </div>

        {item.reviewerNotes ? (
          <div style={{ marginBottom: 14 }}>
            <div style={lbl}>{item.reviewer || "Reviewer"}&apos;s notes</div>
            <div style={{ fontFamily: ft, fontSize: 12.5, color: D.tx, padding: "8px 12px", background: D.amber + "10", border: `1px solid ${D.amber}40`, borderRadius: 6, lineHeight: 1.5 }}>
              {item.reviewerNotes}
            </div>
          </div>
        ) : null}

        {!isAuthor ? (
          <>
            <div style={lbl}>Notes to author</div>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="What's working / what needs to change…"
              style={{ ...inputStyle, minHeight: 80, resize: "vertical", marginBottom: 14 }}
            />
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button type="button" onClick={() => onAction(item.id, "approved", notes.trim() || undefined)} style={{ ...primaryBtn, background: D.teal }}>Approve</button>
              <button type="button" onClick={() => onAction(item.id, "changes_requested", notes.trim() || undefined)} style={{ ...primaryBtn, background: D.coral }}>Request changes</button>
              <button type="button" onClick={() => onAction(item.id, "rejected", notes.trim() || undefined)} style={{ ...primaryBtn, background: D.txd, color: D.tx }}>Reject</button>
              <button type="button" onClick={onCancel} style={{ ...ghostBtn, marginLeft: "auto" }}>Close</button>
            </div>
          </>
        ) : (
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button type="button" onClick={onCancel} style={ghostBtn}>Close</button>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, multi }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; multi?: boolean }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={lbl}>{label}</div>
      {multi ? (
        <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} style={{ ...inputStyle, minHeight: 110, resize: "vertical", fontFamily: ft }} />
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
const panel: React.CSSProperties = { width: "min(700px, 96vw)", background: "#0A0A14", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: "26px 28px 22px", maxHeight: "calc(100vh - 48px)", overflowY: "auto" };
