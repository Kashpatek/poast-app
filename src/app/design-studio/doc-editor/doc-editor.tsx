"use client";

// DocuDesign · Tiptap document editor.
// Long-form prose editor for kind="doc" projects. Persists into the unified
// design-studio projects-store under pages[0].payload = { json, html } —
// docs share the same table as Fabric canvases so the landing page lists
// them side-by-side.
//
// Patterned after src/app/copy-studio/draft/draft-editor.tsx for the Tiptap
// config / toolbar shape, but persistence flows through the design-studio
// projects-store instead of the copy-studio draft-store. Export reuses
// src/app/copy-studio/export.ts (docx/md/html/txt).

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import LinkExt from "@tiptap/extension-link";
import { Markdown } from "tiptap-markdown";
import {
  Bold, Italic, Heading1, Heading2, List, ListOrdered, Quote,
  Link as LinkIcon, Undo2, Redo2, Save, Download, Sparkles, FileText,
  Hash,
} from "lucide-react";
import { D, ft, gf, mn, uid } from "../../shared-constants";
import { saveProject, snapshotProject, useAutosave, type ProjectRecord } from "../projects-store";
import { exportDraft, htmlToMarkdown, stripHtml } from "../../copy-studio/export";
import { showToast } from "../../toast-context";

// DESIGN accent — the green called out in the brief.
const DOC_ACCENT = "#2EAD8E";
const DOC_GLOW = "rgba(46,173,142,0.16)";

interface DocPayload {
  json: unknown | null;
  html: string;
}

interface Props {
  project: ProjectRecord;
  onUpdatePages: (pages: ProjectRecord["pages"]) => void;
  onUpdateTitle: (title: string) => void;
}

export function DocEditor({ project, onUpdatePages, onUpdateTitle }: Props) {
  const initialPayload = (project.pages?.[0]?.payload as DocPayload | null) || { json: null, html: "" };
  const [title, setTitle] = useState<string>(project.title || "Untitled document");
  const [html, setHtml] = useState<string>(initialPayload.html || "");
  const [json, setJson] = useState<unknown | null>(initialPayload.json ?? null);
  const [loaded, setLoaded] = useState(false);
  const [outline, setOutline] = useState<Array<{ id: string; level: number; text: string }>>([]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({}),
      LinkExt.configure({ openOnClick: false, autolink: true }),
      Markdown.configure({ html: true, transformPastedText: true }),
    ],
    content: "",
    immediatelyRender: false,
    editorProps: {
      attributes: {
        spellcheck: "true",
        style: "min-height: 520px; outline: none;",
      },
    },
  });

  // Hydrate editor with the project's saved content once.
  useEffect(() => {
    if (!editor) return;
    if (loaded) return;
    const seed = initialPayload.json ?? initialPayload.html ?? "<p></p>";
    try {
      editor.commands.setContent(seed as object | string);
    } catch {
      editor.commands.setContent("<p></p>");
    }
    setLoaded(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor]);

  // Track editor updates → local state.
  useEffect(() => {
    if (!editor || !loaded) return;
    const handler = () => {
      setHtml(editor.getHTML());
      setJson(editor.getJSON());
    };
    editor.on("update", handler);
    return () => { editor.off("update", handler); };
  }, [editor, loaded]);

  // Outline — extract H1/H2 from current doc. Recomputes on html change.
  useEffect(() => {
    if (!editor || !loaded) return;
    const heads: Array<{ id: string; level: number; text: string }> = [];
    editor.state.doc.descendants((node) => {
      if (node.type.name === "heading" && (node.attrs.level === 1 || node.attrs.level === 2)) {
        heads.push({ id: uid("h"), level: node.attrs.level, text: node.textContent || "" });
      }
      return true;
    });
    setOutline(heads);
  }, [editor, html, loaded]);

  // Autosave — same shape as canvas-editor. Pages array stays — single page
  // for docs — payload carries the Tiptap json + html.
  const save = useCallback(async () => {
    const pageId = project.pages?.[0]?.id || uid("page");
    const nextPages: ProjectRecord["pages"] = [{ id: pageId, payload: { json, html } }];
    await saveProject({
      id: project.id,
      title,
      kind: "doc",
      category: project.category,
      preset: project.preset,
      pages: nextPages,
      templateId: project.templateId,
      meta: project.meta,
    });
    onUpdatePages(nextPages);
    onUpdateTitle(title);
  }, [project.id, project.pages, project.category, project.preset, project.templateId, project.meta, title, json, html, onUpdatePages, onUpdateTitle]);

  const autosave = useAutosave(save, [title, json, html], 1200);

  // Word count from current html.
  const wordCount = useMemo(() => {
    if (!html) return 0;
    const txt = stripHtml(html).trim();
    if (!txt) return 0;
    return txt.split(/\s+/).filter(Boolean).length;
  }, [html]);

  // Jump to an outline heading. We re-walk the doc each click — cheap and
  // resilient to inserts that would invalidate cached positions.
  function jumpToHeading(index: number) {
    if (!editor) return;
    let seen = 0;
    let targetPos: number | null = null;
    editor.state.doc.descendants((node, pos) => {
      if (targetPos !== null) return false;
      if (node.type.name === "heading" && (node.attrs.level === 1 || node.attrs.level === 2)) {
        if (seen === index) targetPos = pos;
        seen++;
      }
      return true;
    });
    if (targetPos !== null) {
      editor.commands.setTextSelection(targetPos);
      editor.commands.focus();
      // Focus alone scrolls the caret into view in modern browsers.
    }
  }

  // AI continue — same /api/generate contract used by copy-studio.
  async function aiContinue() {
    if (!editor) return;
    const plain = stripHtml(editor.getHTML()).trim();
    if (!plain) { showToast("Write something first — even a sentence.", "info"); return; }
    try {
      const r = await fetch("/api/generate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system: "You are continuing a SemiAnalysis document in the author's voice. Write the next paragraph (or 2-3 sentences). Direct, technical, no em dashes, no emojis. No preamble — output prose only.",
          user: "Document so far:\n\n" + plain.slice(-2400),
        }),
      });
      const j = await r.json();
      const next = String(j.text || j.completion || "").trim();
      if (next) {
        editor.commands.focus("end");
        editor.commands.insertContent("<p>" + next.replace(/\n+/g, "</p><p>") + "</p>");
      }
    } catch (e) {
      showToast("Continue failed: " + String(e).slice(0, 80), "error");
    }
  }

  // Export via the shared copy-studio text exporter.
  async function doExport(format: "docx" | "md" | "html" | "txt") {
    if (!editor) return;
    const h = editor.getHTML();
    const md = htmlToMarkdown(h);
    await exportDraft({ title, html: h, markdown: md, plain: stripHtml(h) }, { format, filename: title });
    showToast("Exported ." + format, "success");
  }

  async function takeSnapshot() {
    await autosave.saveNow();
    await snapshotProject(project.id);
    showToast("Snapshot saved.", "success");
  }

  const created = new Date(project.createdAt).toLocaleString();
  const updated = new Date(project.updatedAt).toLocaleString();

  if (!editor) {
    return <div style={{ padding: 40, fontFamily: mn, color: D.txd }}>Booting editor…</div>;
  }

  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "1fr 260px",
      gap: 20,
      padding: "20px 28px 40px",
      maxWidth: 1320,
      margin: "0 auto",
    }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
        {/* Sticky top bar */}
        <div style={{
          position: "sticky", top: 0, zIndex: 4,
          background: "rgba(6,6,12,0.92)", backdropFilter: "blur(10px)",
          WebkitBackdropFilter: "blur(10px)",
          paddingBottom: 10,
          marginBottom: -2,
        }}>
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Untitled document"
            style={{
              width: "100%", padding: "4px 0", border: "none", outline: "none",
              background: "transparent", color: D.tx, fontFamily: gf,
              fontSize: 22, fontWeight: 900, letterSpacing: -0.4,
            }}
          />
          <div style={{
            display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
            padding: "8px 0", borderBottom: "1px solid " + D.border, marginBottom: 10,
          }}>
            <span style={{ fontFamily: mn, fontSize: 10, color: D.txd, letterSpacing: 1, textTransform: "uppercase" }}>
              {wordCount} words
            </span>
            <span style={{ fontFamily: mn, fontSize: 10, color: D.txd, letterSpacing: 1 }}>
              · {autosaveLabel(autosave.status, autosave.lastSavedAt)}
            </span>
          </div>

          <Toolbar
            editor={editor}
            onAIContinue={aiContinue}
            onSnapshot={takeSnapshot}
            onExport={doExport}
          />
        </div>

        {/* Editor surface */}
        <div style={{
          background: "#0D0D12",
          border: "1px solid " + D.border,
          borderRadius: 14,
          padding: "26px 32px",
          minHeight: 560,
          boxShadow: "0 0 36px " + DOC_GLOW,
        }}>
          <style>{`
            .doc-prose .ProseMirror { color: ${D.tx}; font-family: ${ft}; font-size: 16px; line-height: 1.65; }
            .doc-prose .ProseMirror h1 { font-family: ${gf}; font-size: 32px; font-weight: 900; letter-spacing: -0.8px; margin: 18px 0 10px; color: ${D.tx}; }
            .doc-prose .ProseMirror h2 { font-family: ${gf}; font-size: 24px; font-weight: 800; letter-spacing: -0.4px; margin: 14px 0 8px; color: ${D.tx}; }
            .doc-prose .ProseMirror h3 { font-family: ${gf}; font-size: 18px; font-weight: 700; margin: 10px 0 4px; color: ${D.tx}; }
            .doc-prose .ProseMirror p { margin: 8px 0; }
            .doc-prose .ProseMirror a { color: ${DOC_ACCENT}; text-decoration: underline; text-decoration-style: dotted; }
            .doc-prose .ProseMirror ul, .doc-prose .ProseMirror ol { padding-left: 22px; margin: 8px 0; }
            .doc-prose .ProseMirror li { margin: 2px 0; }
            .doc-prose .ProseMirror blockquote { border-left: 3px solid ${DOC_ACCENT}55; padding: 4px 0 4px 12px; margin: 10px 0; color: ${D.txm}; font-style: italic; }
            .doc-prose .ProseMirror code { font-family: ${mn}; font-size: 13.5px; background: rgba(255,255,255,0.05); padding: 2px 6px; border-radius: 4px; color: ${DOC_ACCENT}; }
            .doc-prose .ProseMirror pre { background: rgba(255,255,255,0.04); border: 1px solid ${D.border}; border-radius: 8px; padding: 12px 14px; overflow: auto; }
            .doc-prose .ProseMirror p.is-editor-empty:first-child::before { content: 'Start writing — your document autosaves.'; color: ${D.txd}; pointer-events: none; height: 0; float: left; }
          `}</style>
          <div className="doc-prose">
            <EditorContent editor={editor} />
          </div>
        </div>
      </div>

      {/* Right sidebar */}
      <aside style={{
        background: "#0D0D12",
        border: "1px solid " + D.border,
        borderRadius: 14,
        padding: 16,
        height: "fit-content",
        position: "sticky",
        top: 20,
        display: "flex",
        flexDirection: "column",
        gap: 18,
      }}>
        {/* Outline */}
        <div>
          <div style={sidebarHeader}>
            <Hash size={11} color={DOC_ACCENT} strokeWidth={2} />
            <span>Outline</span>
          </div>
          {outline.length === 0 ? (
            <div style={{ fontFamily: mn, fontSize: 10.5, color: D.txd, lineHeight: 1.5 }}>
              Add an H1 or H2 heading to see it here.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {outline.map((h, i) => (
                <button
                  key={h.id}
                  type="button"
                  onClick={() => jumpToHeading(i)}
                  style={{
                    textAlign: "left",
                    background: "transparent",
                    border: "none",
                    color: h.level === 1 ? D.tx : D.txm,
                    fontFamily: ft,
                    fontSize: h.level === 1 ? 12.5 : 11.5,
                    padding: "4px 6px",
                    paddingLeft: h.level === 1 ? 6 : 16,
                    borderRadius: 5,
                    cursor: "pointer",
                    lineHeight: 1.35,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.04)"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
                  title={h.text}
                >
                  {h.text || "(untitled)"}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Linked notes — placeholder */}
        <div>
          <div style={sidebarHeader}>
            <FileText size={11} color={D.txd} strokeWidth={2} />
            <span>Linked notes</span>
          </div>
          <div style={{
            fontFamily: mn, fontSize: 10.5, color: D.txd, lineHeight: 1.5,
            padding: "8px 10px", background: "rgba(255,255,255,0.02)",
            border: "1px dashed " + D.border, borderRadius: 8,
          }}>
            Linked notes coming soon — attach research, drafts, or briefs from CopySTUDIO.
          </div>
        </div>

        {/* Metadata */}
        <div>
          <div style={sidebarHeader}>
            <span>Document</span>
          </div>
          <div style={metaRow}>
            <span style={metaKey}>Created</span>
            <span style={metaVal}>{created}</span>
          </div>
          <div style={metaRow}>
            <span style={metaKey}>Updated</span>
            <span style={metaVal}>{updated}</span>
          </div>
          <div style={metaRow}>
            <span style={metaKey}>Words</span>
            <span style={metaVal}>{wordCount}</span>
          </div>
          {project.category ? (
            <div style={metaRow}>
              <span style={metaKey}>Category</span>
              <span style={metaVal}>{project.category}</span>
            </div>
          ) : null}
        </div>
      </aside>
    </div>
  );
}

// ─── Autosave label ────────────────────────────────────────────────
function autosaveLabel(status: "idle" | "saving" | "saved" | "error", at: number | null): string {
  if (status === "saving") return "Saving…";
  if (status === "error") return "Save failed";
  if (status === "saved" && at) {
    return "Saved " + new Date(at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  return "Autosave on";
}

// ─── Toolbar ──────────────────────────────────────────────────────
import type { Editor } from "@tiptap/react";

function Toolbar({
  editor, onAIContinue, onSnapshot, onExport,
}: {
  editor: Editor;
  onAIContinue: () => void;
  onSnapshot: () => void;
  onExport: (f: "docx" | "md" | "html" | "txt") => void;
}) {
  const [exportOpen, setExportOpen] = useState(false);

  function btn(active: boolean, onClick: () => void, Icon: typeof Bold, title: string) {
    return (
      <button
        type="button"
        onClick={onClick}
        title={title}
        style={{
          background: active ? DOC_ACCENT + "1F" : "transparent",
          border: "1px solid " + (active ? DOC_ACCENT + "55" : D.border),
          borderRadius: 6,
          padding: "6px 8px",
          color: active ? DOC_ACCENT : D.txm,
          cursor: "pointer",
          display: "inline-flex",
          alignItems: "center",
        }}
      >
        <Icon size={13} strokeWidth={1.8} />
      </button>
    );
  }

  function setLink() {
    const prev = editor.getAttributes("link").href || "";
    const href = window.prompt("Link URL", prev) || "";
    if (href === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href }).run();
  }

  return (
    <div style={{
      display: "flex", flexWrap: "wrap", gap: 5, alignItems: "center",
      padding: "8px 10px",
      background: "rgba(13,13,18,0.6)",
      border: "1px solid " + D.border,
      borderRadius: 10,
    }}>
      {btn(editor.isActive("bold"), () => editor.chain().focus().toggleBold().run(), Bold, "Bold")}
      {btn(editor.isActive("italic"), () => editor.chain().focus().toggleItalic().run(), Italic, "Italic")}
      <Sep />
      {btn(editor.isActive("heading", { level: 1 }), () => editor.chain().focus().toggleHeading({ level: 1 }).run(), Heading1, "Heading 1")}
      {btn(editor.isActive("heading", { level: 2 }), () => editor.chain().focus().toggleHeading({ level: 2 }).run(), Heading2, "Heading 2")}
      <Sep />
      {btn(editor.isActive("bulletList"), () => editor.chain().focus().toggleBulletList().run(), List, "Bulleted list")}
      {btn(editor.isActive("orderedList"), () => editor.chain().focus().toggleOrderedList().run(), ListOrdered, "Numbered list")}
      {btn(editor.isActive("blockquote"), () => editor.chain().focus().toggleBlockquote().run(), Quote, "Quote")}
      {btn(editor.isActive("link"), setLink, LinkIcon, "Link")}
      <Sep />
      {btn(false, () => editor.chain().focus().undo().run(), Undo2, "Undo")}
      {btn(false, () => editor.chain().focus().redo().run(), Redo2, "Redo")}
      <Sep />
      <button type="button" onClick={onAIContinue} style={pillStyle(DOC_ACCENT)} title="AI Continue">
        <Sparkles size={12} strokeWidth={2} /> Continue
      </button>
      <button type="button" onClick={onSnapshot} style={pillStyle(D.amber)} title="Snapshot version">
        <Save size={12} strokeWidth={2} /> Snapshot
      </button>
      <div style={{ position: "relative" }}>
        <button type="button" onClick={() => setExportOpen(o => !o)} style={pillStyle(D.violet)} title="Export">
          <Download size={12} strokeWidth={2} /> Export
        </button>
        {exportOpen && (
          <div style={{
            position: "absolute", top: "100%", right: 0, marginTop: 6,
            background: "#0D0D12", border: "1px solid " + D.border, borderRadius: 8,
            padding: 6, minWidth: 140, zIndex: 20,
            boxShadow: "0 12px 28px rgba(0,0,0,0.5)",
          }}>
            {(["docx", "md", "html", "txt"] as const).map(f => (
              <button
                key={f}
                type="button"
                onClick={() => { setExportOpen(false); onExport(f); }}
                style={{
                  width: "100%", textAlign: "left", padding: "8px 10px",
                  background: "transparent", border: "none",
                  color: D.tx, fontFamily: mn, fontSize: 11, cursor: "pointer",
                  borderRadius: 6, display: "inline-flex", gap: 7, alignItems: "center",
                }}
              >
                <FileText size={11} strokeWidth={1.8} color={D.txd} /> .{f}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Sep() {
  return <span style={{ width: 1, height: 22, background: D.border, margin: "0 2px" }} />;
}

function pillStyle(accent: string): React.CSSProperties {
  return {
    display: "inline-flex", alignItems: "center", gap: 5,
    padding: "6px 10px", borderRadius: 6,
    background: accent + "16",
    border: "1px solid " + accent + "44",
    color: accent,
    fontFamily: mn, fontSize: 10, fontWeight: 800,
    letterSpacing: 1, textTransform: "uppercase", cursor: "pointer",
  };
}

const sidebarHeader: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  fontFamily: mn,
  fontSize: 10,
  color: D.txd,
  letterSpacing: 1.4,
  textTransform: "uppercase",
  fontWeight: 800,
  marginBottom: 8,
};

const metaRow: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 8,
  padding: "4px 0",
  fontFamily: mn,
  fontSize: 10.5,
};

const metaKey: React.CSSProperties = {
  color: D.txd,
  letterSpacing: 0.6,
};

const metaVal: React.CSSProperties = {
  color: D.txm,
  textAlign: "right",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  maxWidth: 160,
};
