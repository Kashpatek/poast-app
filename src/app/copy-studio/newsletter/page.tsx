"use client";

import React, { useEffect, useMemo, useState } from "react";
import CopyShell, { COPY_SOLID, COPY_GLOW } from "../shell";
import { D, ft, gf, mn, uid, copyText } from "../../shared-constants";
import { Newspaper, Plus, Trash2, GripVertical, Download, Eye, EyeOff, Copy as CopyIcon } from "lucide-react";
import { showToast } from "../../toast-context";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { exportDraft, copyAsRichText } from "../export";

type SectionKind = "header" | "lead" | "body" | "callout" | "divider";
interface Section { id: string; kind: SectionKind; body: string; }

const KIND_LABELS: Record<SectionKind, string> = {
  header: "Header", lead: "Lead", body: "Body", callout: "Callout", divider: "Divider",
};

export default function NewsletterPage() {
  const [ok, setOk] = useState(false);
  const [title, setTitle] = useState("Untitled Brief");
  const [byline, setByline] = useState("");
  const [sections, setSections] = useState<Section[]>([
    { id: uid("s"), kind: "lead", body: "Today's most important signal — in two sentences." },
    { id: uid("s"), kind: "body", body: "Write the through-line of the issue here. Use **bold** for emphasis, *italics* for asides, [links](https://example.com) where it matters." },
  ]);
  const [preview, setPreview] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("poast-current-user");
      if (stored) { setOk(true); return; }
    } catch {}
    if (typeof window !== "undefined") window.location.href = "/";
  }, []);

  const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

  if (!ok) return null;

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (over && active.id !== over.id) {
      setSections(items => {
        const o = items.findIndex(i => i.id === active.id);
        const n = items.findIndex(i => i.id === over.id);
        return arrayMove(items, o, n);
      });
    }
  }
  function update(id: string, body: string) { setSections(items => items.map(s => s.id === id ? { ...s, body } : s)); }
  function remove(id: string) { setSections(items => items.filter(s => s.id !== id)); }
  function addSection(kind: SectionKind) {
    setSections(items => [...items, { id: uid("s"), kind, body: defaultBody(kind) }]);
  }

  const markdown = useMemo(() => buildMarkdown(title, byline, sections), [title, byline, sections]);
  const html = useMemo(() => buildHtml(title, byline, sections), [title, byline, sections]);

  return (
    <CopyShell title="Newsletter Composer" subtitle="Sectioned editor → MDX → docx / html / md. Drag to reorder.">
      <div style={{ display: "grid", gridTemplateColumns: preview ? "1fr 1fr" : "1fr", gap: 18, padding: "20px 28px 40px", maxWidth: 1320, margin: "0 auto" }}>
        {/* EDITOR */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Title" style={{
              flex: 1, minWidth: 240, padding: "8px 10px", background: "rgba(255,255,255,0.03)", border: "1px solid " + D.border, borderRadius: 8,
              color: D.tx, fontFamily: gf, fontSize: 20, fontWeight: 900, letterSpacing: -0.3, outline: "none", boxSizing: "border-box",
            }} />
            <input value={byline} onChange={e => setByline(e.target.value)} placeholder="Byline (optional)" style={{
              width: 200, padding: "8px 10px", background: "rgba(255,255,255,0.03)", border: "1px solid " + D.border, borderRadius: 8,
              color: D.tx, fontFamily: ft, fontSize: 13, outline: "none", boxSizing: "border-box",
            }} />
            <button onClick={() => setPreview(p => !p)} style={pillStyle()}>{preview ? <EyeOff size={11} /> : <Eye size={11} />} {preview ? "Hide preview" : "Preview"}</button>
          </div>

          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={sections.map(s => s.id)} strategy={verticalListSortingStrategy}>
              {sections.map(s => <SectionCard key={s.id} s={s} onChange={(b) => update(s.id, b)} onRemove={() => remove(s.id)} />)}
            </SortableContext>
          </DndContext>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
            {(Object.keys(KIND_LABELS) as SectionKind[]).map(k => (
              <button key={k} onClick={() => addSection(k)} style={pillStyle()}><Plus size={11} /> {KIND_LABELS[k]}</button>
            ))}
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12, paddingTop: 14, borderTop: "1px solid " + D.border }}>
            <button onClick={() => exportDraft({ title, html, markdown }, { format: "docx" })} style={solidPillStyle(D.violet)}><Download size={12} /> .docx</button>
            <button onClick={() => exportDraft({ title, html, markdown }, { format: "md" })} style={solidPillStyle(D.amber)}><Download size={12} /> .md</button>
            <button onClick={() => exportDraft({ title, html, markdown }, { format: "html" })} style={solidPillStyle(D.cyan)}><Download size={12} /> .html</button>
            <button onClick={async () => { const ok = await copyAsRichText(html); showToast(ok ? "Copied rich text." : "Copy failed.", ok ? "success" : "error"); }} style={solidPillStyle(D.teal)}><CopyIcon size={12} /> Copy rich</button>
            <button onClick={() => { copyText(markdown); showToast("Markdown copied.", "success"); }} style={solidPillStyle(D.blue)}><CopyIcon size={12} /> Copy MD</button>
          </div>
        </div>

        {/* PREVIEW */}
        {preview && (
          <aside style={{ background: "#0D0D12", border: "1px solid " + D.border, borderRadius: 14, padding: "22px 26px", boxShadow: "0 0 18px " + COPY_GLOW, alignSelf: "flex-start", maxHeight: "calc(100vh - 140px)", overflow: "auto" }}>
            <style>{`
              .nl-preview { color: ${D.tx}; font-family: ${ft}; font-size: 15px; line-height: 1.65; }
              .nl-preview h1 { font-family: ${gf}; font-size: 28px; font-weight: 900; letter-spacing: -0.6px; margin: 0 0 6px; }
              .nl-preview .byline { font-family: ${mn}; font-size: 10.5px; color: ${D.txd}; letter-spacing: 1.4px; text-transform: uppercase; margin-bottom: 16px; }
              .nl-preview h2 { font-family: ${gf}; font-size: 20px; font-weight: 800; letter-spacing: -0.3px; margin: 18px 0 6px; }
              .nl-preview p { margin: 8px 0; }
              .nl-preview blockquote { border-left: 3px solid ${COPY_SOLID}55; padding: 6px 12px; margin: 10px 0; color: ${D.txm}; font-style: italic; background: ${COPY_SOLID}08; border-radius: 0 8px 8px 0; }
              .nl-preview hr { border: none; border-top: 1px solid ${D.border}; margin: 20px 0; }
              .nl-preview a { color: ${COPY_SOLID}; }
            `}</style>
            <div className="nl-preview">
              <h1>{title}</h1>
              {byline && <div className="byline">{byline}</div>}
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{sectionsToMarkdown(sections)}</ReactMarkdown>
            </div>
          </aside>
        )}
      </div>
    </CopyShell>
  );
}

function defaultBody(k: SectionKind): string {
  if (k === "header") return "## Section heading";
  if (k === "lead") return "Lead paragraph — the hook.";
  if (k === "callout") return "> Pull quote or callout note.";
  if (k === "divider") return "---";
  return "New paragraph.";
}

function sectionsToMarkdown(sections: Section[]): string {
  return sections.map(s => s.body).join("\n\n");
}

function buildMarkdown(title: string, byline: string, sections: Section[]): string {
  let md = "# " + title + "\n\n";
  if (byline) md += "_" + byline + "_\n\n";
  md += sectionsToMarkdown(sections);
  return md;
}

function buildHtml(title: string, byline: string, sections: Section[]): string {
  const body = sectionsToMarkdown(sections);
  const escaped = body
    .replace(/^### (.*$)/gm, "<h3>$1</h3>")
    .replace(/^## (.*$)/gm, "<h2>$1</h2>")
    .replace(/^# (.*$)/gm, "<h1>$1</h1>")
    .replace(/^> (.*$)/gm, "<blockquote>$1</blockquote>")
    .replace(/^---$/gm, "<hr/>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    .split(/\n{2,}/)
    .map(p => p.startsWith("<h") || p.startsWith("<blockquote") || p.startsWith("<hr") ? p : "<p>" + p.replace(/\n/g, "<br/>") + "</p>")
    .join("\n");
  return `<h1>${title}</h1>` + (byline ? `<p class="byline"><em>${byline}</em></p>` : "") + escaped;
}

function pillStyle(): React.CSSProperties {
  return {
    display: "inline-flex", alignItems: "center", gap: 5, padding: "6px 10px",
    background: "rgba(255,255,255,0.04)", border: "1px solid " + D.border, borderRadius: 6,
    color: D.txm, fontFamily: mn, fontSize: 10, letterSpacing: 0.6, cursor: "pointer", fontWeight: 700,
  };
}
function solidPillStyle(accent: string): React.CSSProperties {
  return {
    display: "inline-flex", alignItems: "center", gap: 5, padding: "7px 12px",
    background: accent + "16", border: "1px solid " + accent + "44", borderRadius: 6,
    color: accent, fontFamily: mn, fontSize: 10, letterSpacing: 1, cursor: "pointer", fontWeight: 800, textTransform: "uppercase",
  };
}

function SectionCard({ s, onChange, onRemove }: { s: Section; onChange: (b: string) => void; onRemove: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: s.id });
  const accent = s.kind === "header" ? D.amber : s.kind === "lead" ? COPY_SOLID : s.kind === "callout" ? D.violet : s.kind === "divider" ? D.txd : D.cyan;
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform), transition,
    background: "#0D0D12", border: "1px solid " + (isDragging ? COPY_SOLID + "66" : D.border),
    borderRadius: 12, padding: 14, opacity: isDragging ? 0.85 : 1,
  };
  return (
    <div ref={setNodeRef} style={style}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <button {...attributes} {...listeners} title="Drag" style={{ background: "transparent", border: "none", color: D.txd, cursor: "grab", display: "inline-flex" }}>
          <GripVertical size={14} strokeWidth={1.8} />
        </button>
        <span style={{ fontFamily: mn, fontSize: 10, color: accent, padding: "2px 8px", borderRadius: 999, background: accent + "12", border: "1px solid " + accent + "44", letterSpacing: 1, textTransform: "uppercase", fontWeight: 700 }}>{KIND_LABELS[s.kind]}</span>
        <button onClick={onRemove} title="Delete" style={{ background: "transparent", border: "1px solid " + D.border, borderRadius: 6, padding: "3px 6px", color: D.coral, cursor: "pointer", display: "inline-flex", marginLeft: "auto" }}>
          <Trash2 size={11} strokeWidth={1.8} />
        </button>
      </div>
      <textarea value={s.body} onChange={e => onChange(e.target.value)} placeholder={defaultBody(s.kind)} style={{
        width: "100%", minHeight: s.kind === "lead" || s.kind === "body" ? 80 : 50, background: "transparent", border: "none", outline: "none",
        color: D.tx, fontFamily: ft, fontSize: 14, lineHeight: 1.55, resize: "vertical", boxSizing: "border-box", padding: 0,
      }} />
    </div>
  );
}
