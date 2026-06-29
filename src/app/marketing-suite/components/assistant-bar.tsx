"use client";
// Assistant omnibox — click it and it expands, Apple-smooth, from the top-bar
// pill into a centered frosted-glass composer that greys out everything behind
// it. Type or paste anything, attach images (ad screenshots, photos of a
// to-do list, etc.) and extra context; Claude reads it all and proposes a
// task / schedule / campaign / ad — which you review, confirm, or edit before
// it opens the matching pre-filled modal. "help" questions are answered inline.
import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Sparkles, CornerDownLeft, Loader2, X, ImagePlus, Plus, ArrowLeft,
  CheckCircle2, ListTodo, CalendarClock, Megaphone, Rocket, MessageCircle,
} from "lucide-react";
import { D, ft, mn } from "../../shared-constants";
import { useCreate } from "../create-context";
import type { CreateKind } from "../marketing-constants";

interface ParseResult {
  kind: CreateKind | "help";
  summary?: string;
  answer?: string;
  fields?: Record<string, unknown>;
}

interface Attached { id: number; dataUrl: string; name: string; mediaType: string; }

const IMG_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp"];
const MAX_IMAGES = 4;
const MAX_BYTES = 3_300_000; // ~ keeps base64 under Anthropic's 5MB/image cap

const KIND_META: Record<string, { label: string; color: string; Icon: typeof ListTodo }> = {
  task: { label: "Task", color: D.blue, Icon: ListTodo },
  schedule: { label: "Schedule", color: D.teal, Icon: CalendarClock },
  campaign: { label: "Campaign", color: D.violet, Icon: Rocket },
  ad: { label: "Ad", color: D.amber, Icon: Megaphone },
  help: { label: "Answer", color: D.cyan, Icon: MessageCircle },
};

const EASE = "cubic-bezier(0.32,0.72,0,1)"; // iOS sheet curve
const prefersReduced = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

function humanize(key: string) {
  return key
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/^./, (c) => c.toUpperCase());
}
function fmtVal(v: unknown): string | null {
  if (v == null || v === "") return null;
  if (Array.isArray(v)) return v.length ? v.map((x) => String(x)).join(", ") : null;
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

export default function AssistantBar() {
  const { openCreate } = useCreate();
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [text, setText] = useState("");
  const [extra, setExtra] = useState("");
  const [showExtra, setShowExtra] = useState(false);
  const [images, setImages] = useState<Attached[]>([]);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ParseResult | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const scrimRef = useRef<HTMLDivElement | null>(null);
  const taRef = useRef<HTMLTextAreaElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const originRect = useRef<DOMRect | null>(null);
  const idc = useRef(0);
  const closeTimer = useRef<number | undefined>(undefined);

  // ⌘K / Ctrl-K opens the composer from anywhere.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        doOpen();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => () => window.clearTimeout(closeTimer.current), []);

  function doOpen() {
    if (open) return;
    originRect.current =
      triggerRef.current?.getBoundingClientRect() ??
      ({ left: window.innerWidth / 2 - 230, top: 20, width: 460, height: 34 } as DOMRect);
    window.clearTimeout(closeTimer.current);
    setClosing(false);
    setOpen(true);
    setTimeout(() => taRef.current?.focus(), 60);
  }

  function reset() {
    setText(""); setExtra(""); setShowExtra(false); setImages([]);
    setResult(null); setErr(null); setBusy(false);
  }

  function doClose() {
    const card = cardRef.current, scrim = scrimRef.current, from = originRect.current;
    if (!card || prefersReduced() || !from) { setOpen(false); setClosing(false); reset(); return; }
    setClosing(true);
    const to = card.getBoundingClientRect();
    const dx = from.left + from.width / 2 - (to.left + to.width / 2);
    const dy = from.top + from.height / 2 - (to.top + to.height / 2);
    card.style.transition = `transform 0.34s ${EASE}, opacity 0.26s ease-in`;
    card.style.transform = `translate(${dx}px, ${dy}px) scale(0.86)`;
    card.style.opacity = "0";
    if (scrim) { scrim.style.transition = "opacity 0.3s ease-in"; scrim.style.opacity = "0"; }
    closeTimer.current = window.setTimeout(() => { setOpen(false); setClosing(false); reset(); }, 320);
  }

  // FLIP grow-from-the-bar animation on open.
  useLayoutEffect(() => {
    if (!open || closing) return;
    const card = cardRef.current, scrim = scrimRef.current, from = originRect.current;
    if (!card) return;
    if (prefersReduced() || !from) {
      card.style.opacity = "1";
      if (scrim) scrim.style.opacity = "1";
      return;
    }
    const to = card.getBoundingClientRect();
    const dx = from.left + from.width / 2 - (to.left + to.width / 2);
    const dy = from.top + from.height / 2 - (to.top + to.height / 2);
    card.style.transformOrigin = "center center";
    card.style.transform = `translate(${dx}px, ${dy}px) scale(0.86)`;
    card.style.opacity = "0";
    if (scrim) scrim.style.opacity = "0";
    // force reflow so the start state is committed before we transition
    void card.offsetWidth;
    card.style.transition = `transform 0.5s ${EASE}, opacity 0.36s ease-out`;
    card.style.transform = "translate(0,0) scale(1)";
    card.style.opacity = "1";
    if (scrim) { scrim.style.transition = "opacity 0.4s ease-out"; scrim.style.opacity = "1"; }
  }, [open, closing]);

  function addFiles(files: FileList | null) {
    if (!files) return;
    const slots = MAX_IMAGES - images.length;
    Array.from(files).slice(0, Math.max(0, slots)).forEach((f) => {
      if (!IMG_TYPES.includes(f.type)) { setErr(`Unsupported image type: ${f.type || "unknown"}`); return; }
      if (f.size > MAX_BYTES) { setErr(`"${f.name}" is too large (max ~3MB).`); return; }
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = String(reader.result || "");
        if (!dataUrl.startsWith("data:")) return;
        setErr(null);
        setImages((prev) => prev.length >= MAX_IMAGES ? prev
          : [...prev, { id: idc.current++, dataUrl, name: f.name, mediaType: f.type }]);
      };
      reader.readAsDataURL(f);
    });
  }

  async function parse() {
    const t = text.trim();
    if ((!t && images.length === 0) || busy) return;
    setBusy(true); setErr(null);
    try {
      const res = await fetch("/api/assistant/parse", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: t, extra: extra.trim(),
          images: images.map((i) => i.dataUrl),
          today: new Date().toISOString().slice(0, 10),
        }),
      });
      const j: ParseResult & { error?: string } = await res.json();
      if (!res.ok) throw new Error(j.error || "Assistant unavailable");
      setResult(j);
    } catch (e) {
      setErr(String(e instanceof Error ? e.message : e));
    } finally {
      setBusy(false);
    }
  }

  function confirmResult() {
    if (!result || result.kind === "help") return;
    openCreate(result.kind, result.fields || {});
    doClose();
  }

  const canParse = (text.trim().length > 0 || images.length > 0) && !busy;

  // ── collapsed trigger (lives in the top bar) ──────────────────────────
  const trigger = (
    <button
      ref={triggerRef}
      onClick={doOpen}
      title="Ask or add anything (⌘K)"
      style={{
        display: "flex", alignItems: "center", gap: 8, height: 34, width: "100%",
        padding: "0 10px", borderRadius: 10, border: `1px solid ${D.border}`,
        background: D.card, cursor: "text", textAlign: "left",
        transition: "border-color 0.15s, background 0.15s",
      }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = D.amber + "55"; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = D.border; }}
    >
      <Sparkles size={14} color={D.amber} />
      <span style={{ flex: 1, fontFamily: ft, fontSize: 12.5, color: D.txm, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        Ask or add anything…
      </span>
      <span style={{ fontFamily: mn, fontSize: 10, color: D.txd, border: `1px solid ${D.border}`, borderRadius: 5, padding: "1px 5px" }}>⌘K</span>
    </button>
  );

  return (
    <div style={{ position: "relative", flex: 1, maxWidth: 460, minWidth: 180 }}>
      {trigger}
      {open && typeof document !== "undefined" && createPortal(
        <div
          ref={scrimRef}
          onMouseDown={doClose}
          style={{
            position: "fixed", inset: 0, zIndex: 16000, opacity: 0,
            display: "flex", alignItems: "flex-start", justifyContent: "center",
            paddingTop: "11vh",
            background: "rgba(6,6,10,0.58)",
            WebkitBackdropFilter: "blur(7px) saturate(1.05)",
            backdropFilter: "blur(7px) saturate(1.05)",
          }}
        >
          <div
            ref={cardRef}
            onMouseDown={(e) => e.stopPropagation()}
            style={{
              width: "min(680px, 94vw)", maxHeight: "78vh", overflow: "auto", opacity: 0,
              borderRadius: 18, border: `1px solid ${D.amber}33`,
              background: "linear-gradient(180deg, rgba(20,20,28,0.86), rgba(11,11,16,0.92))",
              WebkitBackdropFilter: "blur(26px) saturate(1.5)",
              backdropFilter: "blur(26px) saturate(1.5)",
              boxShadow: "0 40px 120px rgba(0,0,0,0.6), 0 2px 0 rgba(255,255,255,0.04) inset",
            }}
          >
            {!result ? (
              // ── compose ──────────────────────────────────────────────
              <div style={{ padding: 18 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 12 }}>
                  <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 30, height: 30, borderRadius: 9, background: D.amber + "1c", border: `1px solid ${D.amber}44` }}>
                    <Sparkles size={15} color={D.amber} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: ft, fontSize: 14.5, fontWeight: 600, color: D.tx }}>Ask or add anything</div>
                    <div style={{ fontFamily: mn, fontSize: 9.5, letterSpacing: 0.4, color: D.txd, textTransform: "uppercase" }}>task · schedule · campaign · ad · or just ask</div>
                  </div>
                  <button onClick={doClose} title="Close (Esc)" style={iconBtn}><X size={16} /></button>
                </div>

                <textarea
                  ref={taRef}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") { e.preventDefault(); doClose(); }
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); parse(); }
                  }}
                  placeholder="e.g. “Film EP18 Thursday 2pm”, paste a brief, or drop an ad screenshot and let me read it…"
                  style={{
                    width: "100%", minHeight: 92, resize: "vertical", boxSizing: "border-box",
                    border: `1px solid ${D.border}`, borderRadius: 11, background: "rgba(0,0,0,0.28)",
                    padding: "11px 12px", fontFamily: ft, fontSize: 14.5, lineHeight: 1.5, color: D.tx, outline: "none",
                  }}
                />

                {images.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 11 }}>
                    {images.map((im) => (
                      <div key={im.id} style={{ position: "relative", width: 60, height: 60, borderRadius: 9, overflow: "hidden", border: `1px solid ${D.border}` }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={im.dataUrl} alt={im.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        <button onClick={() => setImages((p) => p.filter((x) => x.id !== im.id))} title="Remove"
                          style={{ position: "absolute", top: 2, right: 2, width: 18, height: 18, borderRadius: 999, border: "none", cursor: "pointer", background: "rgba(0,0,0,0.65)", color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                          <X size={11} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {showExtra && (
                  <textarea
                    value={extra}
                    onChange={(e) => setExtra(e.target.value)}
                    placeholder="Additional context — anything I should factor in (deadlines, who it's for, which campaign)…"
                    style={{
                      width: "100%", minHeight: 56, resize: "vertical", boxSizing: "border-box", marginTop: 11,
                      border: `1px dashed ${D.border}`, borderRadius: 11, background: "rgba(0,0,0,0.18)",
                      padding: "9px 11px", fontFamily: ft, fontSize: 13, lineHeight: 1.5, color: D.txm, outline: "none",
                    }}
                  />
                )}

                {err && <div style={{ marginTop: 10, fontFamily: ft, fontSize: 12.5, color: D.coral }}>{err}</div>}

                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 14 }}>
                  <input ref={fileRef} type="file" accept={IMG_TYPES.join(",")} multiple hidden
                    onChange={(e) => { addFiles(e.target.files); if (fileRef.current) fileRef.current.value = ""; }} />
                  <button onClick={() => fileRef.current?.click()} disabled={images.length >= MAX_IMAGES} style={chipBtn(images.length >= MAX_IMAGES)}>
                    <ImagePlus size={14} /> Add image
                  </button>
                  <button onClick={() => setShowExtra((s) => !s)} style={chipBtn(false, showExtra)}>
                    <Plus size={14} /> Add details
                  </button>
                  <div style={{ flex: 1 }} />
                  <span style={{ fontFamily: mn, fontSize: 9.5, color: D.txd }}>⌘↵</span>
                  <button onClick={parse} disabled={!canParse} style={primaryBtn(!canParse)}>
                    {busy ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <CornerDownLeft size={14} />}
                    {busy ? "Reading…" : "Parse"}
                  </button>
                </div>
              </div>
            ) : result.kind === "help" ? (
              // ── help answer ──────────────────────────────────────────
              <div style={{ padding: 18 }}>
                <ReviewHeader meta={KIND_META.help} onClose={doClose} />
                <div style={{ marginTop: 12, fontFamily: ft, fontSize: 14, lineHeight: 1.6, color: D.tx, whiteSpace: "pre-wrap" }}>
                  {result.answer || "I'm not sure how to help with that yet."}
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                  <button onClick={() => setResult(null)} style={chipBtn(false)}><ArrowLeft size={14} /> Back</button>
                  <div style={{ flex: 1 }} />
                  <button onClick={doClose} style={primaryBtn(false)}><CheckCircle2 size={14} /> Done</button>
                </div>
              </div>
            ) : (
              // ── review before send ───────────────────────────────────
              <div style={{ padding: 18 }}>
                <ReviewHeader meta={KIND_META[result.kind]} onClose={doClose} />
                {result.summary && (
                  <div style={{ marginTop: 12, fontFamily: ft, fontSize: 15, fontWeight: 600, color: D.tx }}>{result.summary}</div>
                )}
                <FieldList fields={result.fields} />
                <div style={{ marginTop: 14, fontFamily: ft, fontSize: 12, color: D.txm }}>
                  Review this, then open the editor to confirm or tweak before saving.
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                  <button onClick={() => setResult(null)} style={chipBtn(false)}><ArrowLeft size={14} /> Edit request</button>
                  <div style={{ flex: 1 }} />
                  <button onClick={confirmResult} style={primaryBtn(false, KIND_META[result.kind].color)}>
                    <CheckCircle2 size={14} /> Open &amp; confirm
                  </button>
                </div>
              </div>
            )}
          </div>
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>,
        document.body
      )}
    </div>
  );
}

function ReviewHeader({ meta, onClose }: { meta: { label: string; color: string; Icon: typeof ListTodo }; onClose: () => void }) {
  const { Icon, color, label } = meta;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
      <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 30, height: 30, borderRadius: 9, background: color + "1c", border: `1px solid ${color}44` }}>
        <Icon size={15} color={color} />
      </div>
      <div style={{ flex: 1 }}>
        <span style={{ fontFamily: mn, fontSize: 9.5, letterSpacing: 0.5, textTransform: "uppercase", color }}>{label}</span>
      </div>
      <button onClick={onClose} title="Close (Esc)" style={iconBtn}><X size={16} /></button>
    </div>
  );
}

function FieldList({ fields }: { fields?: Record<string, unknown> }) {
  if (!fields) return null;
  const rows = Object.entries(fields)
    .map(([k, v]) => [humanize(k), fmtVal(v)] as const)
    .filter((r): r is readonly [string, string] => r[1] != null);
  if (!rows.length) return null;
  return (
    <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "auto 1fr", gap: "7px 14px", alignItems: "baseline" }}>
      {rows.map(([k, v]) => (
        <React.Fragment key={k}>
          <div style={{ fontFamily: mn, fontSize: 10, letterSpacing: 0.3, textTransform: "uppercase", color: D.txd, whiteSpace: "nowrap" }}>{k}</div>
          <div style={{ fontFamily: ft, fontSize: 13.5, color: D.tx, lineHeight: 1.45 }}>{v}</div>
        </React.Fragment>
      ))}
    </div>
  );
}

const iconBtn: React.CSSProperties = {
  border: "none", background: "transparent", color: D.txm, cursor: "pointer",
  display: "inline-flex", alignItems: "center", justifyContent: "center", padding: 4, borderRadius: 7,
};
function chipBtn(disabled: boolean, active = false): React.CSSProperties {
  return {
    display: "inline-flex", alignItems: "center", gap: 6, height: 32, padding: "0 12px",
    borderRadius: 9, cursor: disabled ? "default" : "pointer",
    border: `1px solid ${active ? D.amber + "66" : D.border}`,
    background: active ? D.amber + "14" : "transparent",
    color: disabled ? D.txd : active ? D.amber : D.txm,
    fontFamily: ft, fontSize: 12.5, fontWeight: 500, opacity: disabled ? 0.5 : 1,
  };
}
function primaryBtn(disabled: boolean, color = D.amber): React.CSSProperties {
  return {
    display: "inline-flex", alignItems: "center", gap: 7, height: 34, padding: "0 16px",
    borderRadius: 9, cursor: disabled ? "default" : "pointer", border: `1px solid ${color}`,
    background: disabled ? D.card : color + "1f", color: disabled ? D.txd : color,
    fontFamily: ft, fontSize: 13, fontWeight: 600, opacity: disabled ? 0.6 : 1,
  };
}
