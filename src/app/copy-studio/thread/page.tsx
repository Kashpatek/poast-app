"use client";

import React, { useEffect, useMemo, useState } from "react";
import CopyShell, { COPY_SOLID, COPY_GLOW } from "../shell";
import { D, ft, gf, mn, copyText } from "../../shared-constants";
import { MessageSquareQuote, Sparkles, Loader2, GripVertical, Copy as CopyIcon, Trash2, Plus } from "lucide-react";
import { showToast } from "../../toast-context";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { uid } from "../../shared-constants";

interface Tweet { id: string; body: string; }

const X_LIMIT = 280;

export default function ThreadPage() {
  const [ok, setOk] = useState(false);
  const [source, setSource] = useState("");
  const [tweets, setTweets] = useState<Tweet[]>([]);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("poast-current-user");
      if (stored) { setOk(true); return; }
    } catch {}
    if (typeof window !== "undefined") window.location.href = "/";
  }, []);

  const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

  if (!ok) return null;

  function segment() {
    if (!source.trim()) { showToast("Paste a draft first.", "info"); return; }
    // Greedy split by sentence, fitting under X_LIMIT.
    const sentences = source.replace(/\s+/g, " ").split(/(?<=[.!?])\s+/);
    const out: Tweet[] = [];
    let buf = "";
    for (const s of sentences) {
      const next = buf ? buf + " " + s : s;
      if (next.length <= X_LIMIT) { buf = next; continue; }
      if (buf) out.push({ id: uid("tw"), body: buf });
      if (s.length <= X_LIMIT) { buf = s; continue; }
      // Hard split overlong sentences on word boundaries.
      let chunk = s;
      while (chunk.length > X_LIMIT) {
        const cut = chunk.lastIndexOf(" ", X_LIMIT);
        const at = cut > 100 ? cut : X_LIMIT;
        out.push({ id: uid("tw"), body: chunk.slice(0, at).trim() });
        chunk = chunk.slice(at).trim();
      }
      buf = chunk;
    }
    if (buf) out.push({ id: uid("tw"), body: buf });
    setTweets(out);
  }

  async function aiSegment() {
    if (!source.trim()) { showToast("Paste a draft first.", "info"); return; }
    setRunning(true);
    try {
      const r = await fetch("/api/generate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system: "You are SemiAnalysis's X-thread editor. Turn a draft into a thread — each tweet ≤ 280 chars, hook FIRST, link in reply. Brand voice: direct, technical, no em dashes, no emojis, no hashtags. Reply ONLY with JSON: { tweets: string[] }. No markdown wrapper.",
          user: source.slice(0, 8000),
        }),
      });
      const j = await r.json();
      const text = String(j.text || j.completion || "").trim().replace(/^```(?:json)?\n?/, "").replace(/```$/, "");
      const parsed = JSON.parse(text);
      const list: string[] = Array.isArray(parsed?.tweets) ? parsed.tweets.filter((x: unknown) => typeof x === "string") : [];
      setTweets(list.map(b => ({ id: uid("tw"), body: b })));
    } catch (e) {
      showToast("Generate failed: " + String(e).slice(0, 80), "error");
    } finally {
      setRunning(false);
    }
  }

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (over && active.id !== over.id) {
      setTweets(items => {
        const o = items.findIndex(i => i.id === active.id);
        const n = items.findIndex(i => i.id === over.id);
        return arrayMove(items, o, n);
      });
    }
  }

  function update(id: string, body: string) { setTweets(items => items.map(t => t.id === id ? { ...t, body } : t)); }
  function remove(id: string) { setTweets(items => items.filter(t => t.id !== id)); }
  function addAfter(id: string) {
    setTweets(items => {
      const idx = items.findIndex(t => t.id === id);
      const next = items.slice();
      next.splice(idx + 1, 0, { id: uid("tw"), body: "" });
      return next;
    });
  }

  const fullThread = useMemo(() => tweets.map((t, i) => (i + 1) + "/ " + t.body).join("\n\n"), [tweets]);

  return (
    <CopyShell title="Thread Builder" subtitle="Segment, reorder, refine. Each card stays under 280 — drag the handle to shuffle.">
      <div style={{ display: "grid", gridTemplateColumns: "380px 1fr", gap: 18, padding: "20px 28px 40px", maxWidth: 1320, margin: "0 auto" }}>
        <aside style={{ background: "#0D0D12", border: "1px solid " + D.border, borderRadius: 14, padding: 18, display: "flex", flexDirection: "column", gap: 12, height: "fit-content", position: "sticky", top: 76 }}>
          <SmallLabel>Source draft</SmallLabel>
          <textarea value={source} onChange={e => setSource(e.target.value)} placeholder="Paste the source draft, article, or transcript…" style={{
            width: "100%", minHeight: 220, padding: "10px 12px", background: "rgba(255,255,255,0.03)", border: "1px solid " + D.border, borderRadius: 8,
            color: D.tx, fontFamily: ft, fontSize: 13, outline: "none", resize: "vertical", lineHeight: 1.55, boxSizing: "border-box",
          }} />
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={segment} disabled={!source.trim()} style={{
              flex: 1, padding: "10px 12px", background: "transparent", color: D.tx, border: "1px solid " + D.border, borderRadius: 8,
              fontFamily: mn, fontSize: 10, fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase", cursor: !source.trim() ? "not-allowed" : "pointer", opacity: !source.trim() ? 0.5 : 1,
            }}>Split locally</button>
            <button onClick={aiSegment} disabled={!source.trim() || running} style={{
              flex: 1, padding: "10px 12px", background: running ? COPY_SOLID + "22" : COPY_SOLID, color: running ? COPY_SOLID : "#060608", border: "none", borderRadius: 8,
              fontFamily: mn, fontSize: 10, fontWeight: 800, letterSpacing: 1.2, textTransform: "uppercase", cursor: !source.trim() || running ? "not-allowed" : "pointer", opacity: !source.trim() && !running ? 0.5 : 1,
              display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
            }}>{running ? <Loader2 size={12} style={{ animation: "spin 1.2s linear infinite" }} /> : <Sparkles size={12} strokeWidth={2.2} />}{running ? "AI…" : "AI segment"}</button>
          </div>
          <style>{`@keyframes spin { 0% { transform: rotate(0); } 100% { transform: rotate(360deg); } }`}</style>
          {tweets.length > 0 && (
            <button onClick={() => { copyText(fullThread); showToast("Thread copied.", "success"); }} style={{
              padding: "9px 12px", background: "transparent", color: D.tx, border: "1px solid " + D.border, borderRadius: 8,
              fontFamily: mn, fontSize: 10, fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase", cursor: "pointer",
              display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
            }}><CopyIcon size={12} strokeWidth={2} /> Copy thread ({tweets.length})</button>
          )}
        </aside>

        <main style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {tweets.length === 0 ? (
            <div style={{ background: "#0D0D12", border: "1px solid " + D.border, borderRadius: 14, padding: "60px 28px", textAlign: "center", boxShadow: "0 0 18px " + COPY_GLOW }}>
              <MessageSquareQuote size={42} color={COPY_SOLID} strokeWidth={1.4} style={{ opacity: 0.5, marginBottom: 14 }} />
              <div style={{ fontFamily: gf, fontSize: 22, fontWeight: 900, color: D.tx, letterSpacing: -0.3, marginBottom: 8 }}>Build the thread.</div>
              <div style={{ fontFamily: ft, fontSize: 13.5, color: D.txm, maxWidth: 420, margin: "0 auto", lineHeight: 1.5 }}>Paste a draft, hit AI segment or Split locally. Drag handles to reorder, edit any tweet inline, copy the whole thing.</div>
            </div>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
              <SortableContext items={tweets.map(t => t.id)} strategy={verticalListSortingStrategy}>
                {tweets.map((t, i) => (
                  <TweetCard key={t.id} t={t} index={i + 1} onChange={(b) => update(t.id, b)} onRemove={() => remove(t.id)} onAddAfter={() => addAfter(t.id)} />
                ))}
              </SortableContext>
            </DndContext>
          )}
        </main>
      </div>
    </CopyShell>
  );
}

function SmallLabel({ children }: { children: React.ReactNode }) {
  return <div style={{ fontFamily: mn, fontSize: 9, color: D.txd, letterSpacing: 1.6, textTransform: "uppercase" }}>{children}</div>;
}

function TweetCard({ t, index, onChange, onRemove, onAddAfter }: { t: Tweet; index: number; onChange: (b: string) => void; onRemove: () => void; onAddAfter: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: t.id });
  const over = t.body.length > X_LIMIT;
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform), transition,
    background: "#0D0D12", border: "1px solid " + (isDragging ? COPY_SOLID + "66" : over ? D.coral + "55" : D.border),
    borderRadius: 12, padding: 14, opacity: isDragging ? 0.85 : 1,
  };
  return (
    <div ref={setNodeRef} style={style}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <button {...attributes} {...listeners} title="Drag" style={{ background: "transparent", border: "none", color: D.txd, cursor: "grab", display: "inline-flex" }}>
          <GripVertical size={14} strokeWidth={1.8} />
        </button>
        <span style={{ fontFamily: mn, fontSize: 11, color: COPY_SOLID, padding: "2px 8px", borderRadius: 999, background: COPY_SOLID + "12", border: "1px solid " + COPY_SOLID + "44", letterSpacing: 0.6, fontWeight: 700 }}>{index}/</span>
        <span style={{ fontFamily: mn, fontSize: 10, color: over ? D.coral : D.txd, marginLeft: "auto" }}>{t.body.length} / {X_LIMIT}</span>
        <button onClick={onAddAfter} title="Add tweet below" style={{ background: "transparent", border: "1px solid " + D.border, borderRadius: 6, padding: "3px 6px", color: D.txm, cursor: "pointer", display: "inline-flex" }}>
          <Plus size={11} strokeWidth={2} />
        </button>
        <button onClick={onRemove} title="Delete tweet" style={{ background: "transparent", border: "1px solid " + D.border, borderRadius: 6, padding: "3px 6px", color: D.coral, cursor: "pointer", display: "inline-flex" }}>
          <Trash2 size={11} strokeWidth={1.8} />
        </button>
      </div>
      <textarea value={t.body} onChange={e => onChange(e.target.value)} style={{
        width: "100%", minHeight: 70, background: "transparent", border: "none", outline: "none",
        color: D.tx, fontFamily: ft, fontSize: 14, lineHeight: 1.55, resize: "vertical", boxSizing: "border-box", padding: 0,
      }} />
    </div>
  );
}
