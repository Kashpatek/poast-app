"use client";

import React, { useEffect, useState } from "react";
import CopyShell, { COPY_SOLID, COPY_GLOW } from "../shell";
import { D, ft, gf, mn, copyText } from "../../shared-constants";
import { Recycle, Sparkles, Copy as CopyIcon, GripVertical, Loader2 } from "lucide-react";
import { showToast } from "../../toast-context";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface Variant {
  id: string;
  platform: string;
  body: string;
  notes?: string;
}

const PLATFORMS = [
  { id: "x",         label: "X Thread",       accent: "#1DA1F2" },
  { id: "linkedin",  label: "LinkedIn Post",  accent: "#0A66C2" },
  { id: "instagram", label: "IG Caption",     accent: "#E4405F" },
  { id: "newsletter", label: "Newsletter Blurb", accent: "#F7B041" },
  { id: "quote",     label: "Quote Card",     accent: "#A24BC9" },
  { id: "tiktok",    label: "TikTok Caption", accent: "#69C9D0" },
];

export default function RepurposePage() {
  const [ok, setOk] = useState(false);
  const [source, setSource] = useState("");
  const [selected, setSelected] = useState<string[]>(["x", "linkedin", "instagram", "newsletter"]);
  const [variants, setVariants] = useState<Variant[]>([]);
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

  function toggle(id: string) { setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]); }

  async function generate() {
    if (!source.trim()) { showToast("Paste a draft first.", "info"); return; }
    if (selected.length === 0) { showToast("Pick at least one platform.", "info"); return; }
    setRunning(true);
    try {
      const r = await fetch("/api/generate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system: "You are SemiAnalysis's repurposing brain. Given a draft, produce one variant per requested platform. Each variant respects platform constraints (X ≤ 280 per tweet for threads / LinkedIn 1500 / IG caption 2200 / newsletter 600 / quote ≤ 150 / TikTok 300). Brand voice: direct, technical, no em dashes, no emojis except platform-native (IG/TikTok ok), no hashtags on X. Reply ONLY with JSON: { variants: Array<{ platform: string, body: string, notes?: string }> }. No markdown wrapper.",
          user: "Platforms: " + selected.join(", ") + "\n\nDraft:\n" + source.slice(0, 8000),
        }),
      });
      const j = await r.json();
      const text = String(j.text || j.completion || "").trim().replace(/^```(?:json)?\n?/, "").replace(/```$/, "");
      const parsed = JSON.parse(text);
      const list = Array.isArray(parsed?.variants) ? parsed.variants : [];
      const next: Variant[] = list.map((raw: unknown, i: number) => {
        const o = raw as Record<string, unknown>;
        return {
          id: "v-" + Date.now() + "-" + i,
          platform: typeof o.platform === "string" ? o.platform : selected[i] || "x",
          body: typeof o.body === "string" ? o.body : "",
          notes: typeof o.notes === "string" ? o.notes : undefined,
        };
      });
      setVariants(next);
    } catch (e) {
      showToast("Generate failed: " + String(e).slice(0, 80), "error");
    } finally {
      setRunning(false);
    }
  }

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (over && active.id !== over.id) {
      setVariants(items => {
        const oldIndex = items.findIndex(i => i.id === active.id);
        const newIndex = items.findIndex(i => i.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  }

  return (
    <CopyShell title="Repurpose Engine" subtitle="One draft → many platforms. Drag to reorder. Each variant scores independently.">
      <div style={{ display: "grid", gridTemplateColumns: "380px 1fr", gap: 18, padding: "20px 28px 40px", maxWidth: 1320, margin: "0 auto" }}>
        {/* LEFT — source + platforms + generate */}
        <aside style={{ background: "#0D0D12", border: "1px solid " + D.border, borderRadius: 14, padding: 18, display: "flex", flexDirection: "column", gap: 14, height: "fit-content", position: "sticky", top: 76 }}>
          <SmallLabel>Source draft</SmallLabel>
          <textarea value={source} onChange={e => setSource(e.target.value)} placeholder="Paste the long-form draft, transcript, or article body…" style={{
            width: "100%", minHeight: 240, padding: "10px 12px", background: "rgba(255,255,255,0.03)", border: "1px solid " + D.border, borderRadius: 8,
            color: D.tx, fontFamily: ft, fontSize: 13, outline: "none", resize: "vertical", lineHeight: 1.55, boxSizing: "border-box",
          }} />
          <SmallLabel>Platforms</SmallLabel>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
            {PLATFORMS.map(p => {
              const on = selected.includes(p.id);
              return (
                <button key={p.id} onClick={() => toggle(p.id)} style={{
                  padding: "5px 10px", borderRadius: 999, cursor: "pointer",
                  background: on ? p.accent + "1F" : "rgba(255,255,255,0.04)",
                  border: "1px solid " + (on ? p.accent + "66" : D.border),
                  color: on ? p.accent : D.txm,
                  fontFamily: mn, fontSize: 10, fontWeight: 700, letterSpacing: 0.4,
                }}>{p.label}</button>
              );
            })}
          </div>
          <button onClick={generate} disabled={running || !source.trim()} style={{
            padding: "11px 16px", background: running ? COPY_SOLID + "22" : COPY_SOLID, color: running ? COPY_SOLID : "#060608",
            border: "none", borderRadius: 8, fontFamily: mn, fontSize: 11, fontWeight: 800, letterSpacing: 1.4, textTransform: "uppercase",
            cursor: running || !source.trim() ? "not-allowed" : "pointer", opacity: !source.trim() && !running ? 0.5 : 1,
            display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
          }}>{running ? <Loader2 size={13} style={{ animation: "spin 1.2s linear infinite" }} /> : <Sparkles size={13} strokeWidth={2.2} />}{running ? "Generating…" : "Repurpose"}</button>
          <style>{`@keyframes spin { 0% { transform: rotate(0); } 100% { transform: rotate(360deg); } }`}</style>
        </aside>

        {/* RIGHT — generated variants */}
        <main style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {variants.length === 0 ? (
            <div style={{ background: "#0D0D12", border: "1px solid " + D.border, borderRadius: 14, padding: "60px 28px", textAlign: "center", boxShadow: "0 0 18px " + COPY_GLOW }}>
              <Recycle size={42} color={COPY_SOLID} strokeWidth={1.4} style={{ opacity: 0.5, marginBottom: 14 }} />
              <div style={{ fontFamily: gf, fontSize: 22, fontWeight: 900, color: D.tx, letterSpacing: -0.3, marginBottom: 8 }}>One draft, every shape.</div>
              <div style={{ fontFamily: ft, fontSize: 13.5, color: D.txm, maxWidth: 420, margin: "0 auto", lineHeight: 1.5 }}>Paste a draft on the left, pick where you&apos;re shipping, hit Repurpose. Each variant comes back voice-aware and platform-shaped — drag to reorder, copy or send onward.</div>
            </div>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
              <SortableContext items={variants.map(v => v.id)} strategy={verticalListSortingStrategy}>
                {variants.map(v => <VariantCard key={v.id} v={v} />)}
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

function VariantCard({ v }: { v: Variant }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: v.id });
  const meta = PLATFORMS.find(p => p.id === v.platform) || { label: v.platform, accent: COPY_SOLID };
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform), transition,
    background: "#0D0D12", border: "1px solid " + (isDragging ? meta.accent + "66" : D.border),
    borderRadius: 12, padding: 16, opacity: isDragging ? 0.85 : 1,
    boxShadow: isDragging ? "0 14px 28px rgba(0,0,0,0.5)" : "none",
  };
  return (
    <div ref={setNodeRef} style={style}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <button {...attributes} {...listeners} title="Drag to reorder" style={{ background: "transparent", border: "none", color: D.txd, cursor: "grab", display: "inline-flex" }}>
          <GripVertical size={14} strokeWidth={1.8} />
        </button>
        <span style={{ fontFamily: mn, fontSize: 10, color: meta.accent, padding: "2px 8px", borderRadius: 999, background: meta.accent + "12", border: "1px solid " + meta.accent + "44", letterSpacing: 1, textTransform: "uppercase", fontWeight: 700 }}>{meta.label}</span>
        <span style={{ fontFamily: mn, fontSize: 10, color: D.txd, marginLeft: "auto" }}>{v.body.length} chars</span>
        <button onClick={() => { copyText(v.body); showToast("Copied.", "success"); }} title="Copy" style={{ background: "transparent", border: "1px solid " + D.border, borderRadius: 6, padding: "4px 8px", color: D.txm, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4, fontFamily: mn, fontSize: 9.5, letterSpacing: 0.8 }}>
          <CopyIcon size={11} strokeWidth={1.8} /> Copy
        </button>
      </div>
      <div style={{ fontFamily: ft, fontSize: 13.5, color: D.tx, lineHeight: 1.55, whiteSpace: "pre-wrap" }}>{v.body}</div>
      {v.notes && <div style={{ fontFamily: mn, fontSize: 10, color: D.txd, marginTop: 8, letterSpacing: 0.4 }}>// {v.notes}</div>}
    </div>
  );
}
