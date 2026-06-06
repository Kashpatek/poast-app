"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import { Markdown } from "tiptap-markdown";
import { Bold, Italic, Heading1, Heading2, List, ListOrdered, Quote, Link as LinkIcon, Undo2, Redo2, Save, Download, Copy as CopyIcon, ShieldCheck, Sparkles, FileText } from "lucide-react";
import { D, ft, gf, mn } from "../../shared-constants";
import { COPY_SOLID, COPY_GLOW, COPY_GRADIENT } from "../shell";
import { saveDraft, getDraft, snapshotDraft, type DraftRecord, type DraftPlatform } from "../draft-store";
import { exportDraft, copyAsRichText, htmlToMarkdown, stripHtml } from "../export";
import { showToast } from "../../toast-context";
import { retextAnalyze, type RetextAnalysis } from "../retext-voice";

interface Props {
  draftId: string | null;
  seed: string | null;
}

const AUTOSAVE_MS = 1200;

export default function DraftEditor({ draftId, seed }: Props) {
  const [title, setTitle] = useState("Untitled draft");
  const [platform, setPlatform] = useState<DraftPlatform>("essay");
  const [loaded, setLoaded] = useState(false);
  const [currentId, setCurrentId] = useState<string | null>(draftId);
  const [statusMsg, setStatusMsg] = useState("Ready.");
  const [voicePanelOpen, setVoicePanelOpen] = useState(false);
  const [voiceResult, setVoiceResult] = useState<{ score: number; topLine?: string; violations?: string[]; suggestions?: string[] } | null>(null);
  const [voiceLoading, setVoiceLoading] = useState(false);
  const [retext, setRetext] = useState<RetextAnalysis | null>(null);
  const [retextExpanded, setRetextExpanded] = useState(false);

  const lastSerialRef = useRef<string>("");
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retextTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retextSeqRef = useRef(0);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({}),
      Link.configure({ openOnClick: false, autolink: true }),
      Markdown.configure({ html: true, transformPastedText: true }),
    ],
    content: "",
    immediatelyRender: false,
    editorProps: {
      attributes: {
        spellcheck: "true",
        style: "min-height: 380px; outline: none;",
      },
    },
  });

  // Hydrate.
  useEffect(() => {
    if (!editor) return;
    (async () => {
      if (draftId) {
        const rec = await getDraft(draftId);
        if (rec) {
          setTitle(rec.title);
          setPlatform(rec.platform);
          setCurrentId(rec.id);
          editor.commands.setContent((rec.bodyJSON as object) || rec.bodyHTML || "<p></p>");
          setStatusMsg("Loaded.");
        }
      } else if (seed) {
        const safe = seed.slice(0, 200);
        setTitle(safe.split("\n")[0].slice(0, 80) || "Untitled draft");
        editor.commands.setContent("<p>" + safe + "</p>");
      }
      setLoaded(true);
    })();
  }, [editor, draftId, seed]);

  // Autosave.
  const persist = useCallback(async (markVersion = false) => {
    if (!editor) return;
    const html = editor.getHTML();
    const json = editor.getJSON();
    const serial = JSON.stringify({ title, html, platform });
    if (serial === lastSerialRef.current) return;
    lastSerialRef.current = serial;
    const next: DraftRecord = await saveDraft({
      id: currentId || undefined, title, platform, module: "draft",
      bodyJSON: json, bodyHTML: html,
    });
    if (!currentId) setCurrentId(next.id);
    if (markVersion) await snapshotDraft(next.id);
    setStatusMsg("Saved " + new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
  }, [editor, title, platform, currentId]);

  useEffect(() => {
    if (!loaded || !editor) return;
    const handler = () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => { persist(); }, AUTOSAVE_MS);
    };
    editor.on("update", handler);
    return () => { editor.off("update", handler); };
  }, [editor, persist, loaded]);

  useEffect(() => {
    if (!loaded) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => { persist(); }, AUTOSAVE_MS);
  }, [title, platform, persist, loaded]);

  // Deterministic retext layer — runs client-side on every edit, debounced.
  // Surfaces a tiny "PASSIVE n · HYPE n · READABILITY n" counter under the
  // toolbar that the user can click to expand into the full rubric panel.
  useEffect(() => {
    if (!loaded || !editor) return;
    const trigger = () => {
      if (retextTimerRef.current) clearTimeout(retextTimerRef.current);
      retextTimerRef.current = setTimeout(async () => {
        const plain = stripHtml(editor.getHTML()).trim();
        const mySeq = ++retextSeqRef.current;
        if (!plain) { setRetext(null); return; }
        try {
          const a = await retextAnalyze(plain);
          if (mySeq === retextSeqRef.current) setRetext(a);
        } catch { /* swallow — the LLM gate is the source of truth */ }
      }, 600);
    };
    trigger();
    editor.on("update", trigger);
    return () => {
      editor.off("update", trigger);
      if (retextTimerRef.current) clearTimeout(retextTimerRef.current);
    };
  }, [editor, loaded]);

  // Voice gate.
  async function voiceCheck() {
    if (!editor) return;
    const txt = stripHtml(editor.getHTML()).trim();
    if (!txt) { showToast("Add some text first.", "info"); return; }
    setVoicePanelOpen(true); setVoiceLoading(true); setVoiceResult(null);
    try {
      const r = await fetch("/api/voice-scorer", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: txt.slice(0, 6000), platform: "blog" }),
      });
      const j = await r.json();
      setVoiceResult(j);
      if (currentId && j?.score != null) {
        await saveDraft({ id: currentId, title, platform, module: "draft",
          bodyJSON: editor.getJSON(), bodyHTML: editor.getHTML(),
          voiceScore: { score: j.score, topLine: j.topLine, capturedAt: Date.now() } });
      }
    } catch (e) {
      showToast("Voice check failed: " + String(e).slice(0, 80), "error");
    } finally {
      setVoiceLoading(false);
    }
  }

  // AI continue.
  async function aiContinue() {
    if (!editor) return;
    const html = editor.getHTML();
    const plain = stripHtml(html).trim();
    if (!plain) { showToast("Write something first — even a sentence.", "info"); return; }
    setStatusMsg("Asking the model…");
    try {
      const r = await fetch("/api/generate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system: "You are a SemiAnalysis editor continuing a draft in the author's voice. Write the next paragraph (or 2-3 sentences). Direct, technical, no em dashes, no emojis. No preamble — output prose only.",
          user: "Draft so far:\n\n" + plain.slice(-2400),
        }),
      });
      const j = await r.json();
      const next = String(j.text || j.completion || "").trim();
      if (next) {
        editor.commands.focus("end");
        editor.commands.insertContent("<p>" + next.replace(/\n+/g, "</p><p>") + "</p>");
        setStatusMsg("Continued.");
      }
    } catch (e) {
      showToast("Continue failed: " + String(e).slice(0, 80), "error");
      setStatusMsg("Ready.");
    }
  }

  // Export.
  async function doExport(format: "docx" | "md" | "html" | "txt") {
    if (!editor) return;
    const html = editor.getHTML();
    const md = htmlToMarkdown(html);
    await exportDraft({ title, html, markdown: md, plain: stripHtml(html) }, { format, filename: title });
    setStatusMsg("Exported ." + format);
  }

  async function copyRich() {
    if (!editor) return;
    const ok = await copyAsRichText(editor.getHTML());
    showToast(ok ? "Copied rich text." : "Copy failed.", ok ? "success" : "error");
  }

  const wordCount = useMemo(() => {
    if (!editor) return 0;
    return stripHtml(editor.getHTML()).split(/\s+/).filter(Boolean).length;
  }, [editor, statusMsg]);

  if (!editor) return <div style={{ padding: 40, fontFamily: mn, color: D.txd }}>Booting editor…</div>;

  const platforms: { id: DraftPlatform; label: string }[] = [
    { id: "essay", label: "Essay" }, { id: "thread", label: "Thread" }, { id: "newsletter", label: "Newsletter" },
    { id: "post", label: "Post" }, { id: "pack", label: "Pack" }, { id: "carousel", label: "Carousel" },
    { id: "seo", label: "SEO" }, { id: "other", label: "Other" },
  ];

  return (
    <div style={{ display: "grid", gridTemplateColumns: voicePanelOpen ? "1fr 360px" : "1fr", gap: 14, padding: "20px 28px 40px", maxWidth: 1320, margin: "0 auto" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Untitled draft" style={{
          width: "100%", padding: "4px 0", border: "none", outline: "none",
          background: "transparent", color: D.tx, fontFamily: gf, fontSize: 32, fontWeight: 900, letterSpacing: -0.6,
        }} />

        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", paddingBottom: 12, borderBottom: "1px solid " + D.border }}>
          <select value={platform} onChange={e => setPlatform(e.target.value as DraftPlatform)} style={{
            background: "rgba(255,255,255,0.04)", border: "1px solid " + D.border, borderRadius: 6,
            color: D.tx, fontFamily: mn, fontSize: 10, padding: "5px 8px", cursor: "pointer", outline: "none",
          }}>
            {platforms.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
          <span style={{ fontFamily: mn, fontSize: 10, color: D.txd, letterSpacing: 1 }}>{wordCount} words</span>
          <span style={{ fontFamily: mn, fontSize: 10, color: D.txd, letterSpacing: 1, marginLeft: "auto" }}>{statusMsg}</span>
        </div>

        <Toolbar editor={editor} onSave={() => { persist(true); showToast("Snapshot saved.", "success"); }} onVoiceCheck={voiceCheck} onAIContinue={aiContinue} onCopy={copyRich} onExport={doExport} />

        <RetextStrip analysis={retext} expanded={retextExpanded} onToggle={() => setRetextExpanded(o => !o)} />

        <div style={{
          background: "#0D0D12", border: "1px solid " + D.border, borderRadius: 14, padding: "22px 26px",
          minHeight: 480, boxShadow: "0 0 36px " + COPY_GLOW,
        }}>
          <style>{`
            .ProseMirror { color: ${D.tx}; font-family: ${ft}; font-size: 16px; line-height: 1.65; }
            .ProseMirror h1 { font-family: ${gf}; font-size: 32px; font-weight: 900; letter-spacing: -0.8px; margin: 14px 0 8px; color: ${D.tx}; }
            .ProseMirror h2 { font-family: ${gf}; font-size: 24px; font-weight: 800; letter-spacing: -0.4px; margin: 12px 0 6px; color: ${D.tx}; }
            .ProseMirror h3 { font-family: ${gf}; font-size: 18px; font-weight: 700; margin: 10px 0 4px; color: ${D.tx}; }
            .ProseMirror p { margin: 8px 0; }
            .ProseMirror a { color: ${COPY_SOLID}; text-decoration: underline; text-decoration-style: dotted; }
            .ProseMirror ul, .ProseMirror ol { padding-left: 22px; margin: 8px 0; }
            .ProseMirror li { margin: 2px 0; }
            .ProseMirror blockquote { border-left: 3px solid ${COPY_SOLID}55; padding: 4px 0 4px 12px; margin: 10px 0; color: ${D.txm}; font-style: italic; }
            .ProseMirror code { font-family: ${mn}; font-size: 13.5px; background: rgba(255,255,255,0.05); padding: 2px 6px; border-radius: 4px; color: ${COPY_SOLID}; }
            .ProseMirror pre { background: rgba(255,255,255,0.04); border: 1px solid ${D.border}; border-radius: 8px; padding: 12px 14px; overflow: auto; }
            .ProseMirror p.is-editor-empty:first-child::before { content: 'Start writing — type / for slash commands (coming soon), or paste / drag in a draft.'; color: ${D.txd}; pointer-events: none; height: 0; float: left; }
          `}</style>
          <EditorContent editor={editor} />
        </div>
      </div>

      {voicePanelOpen && (
        <VoicePanel result={voiceResult} loading={voiceLoading} onClose={() => setVoicePanelOpen(false)} />
      )}
    </div>
  );
}

// ─── Toolbar ──────────────────────────────────────────────────────
import type { Editor } from "@tiptap/react";
function Toolbar({ editor, onSave, onVoiceCheck, onAIContinue, onCopy, onExport }: {
  editor: Editor;
  onSave: () => void;
  onVoiceCheck: () => void;
  onAIContinue: () => void;
  onCopy: () => void;
  onExport: (f: "docx" | "md" | "html" | "txt") => void;
}) {
  const [exportOpen, setExportOpen] = useState(false);
  function btn(active: boolean, onClick: () => void, Icon: typeof Bold, title: string) {
    return (
      <button onClick={onClick} title={title} style={{
        background: active ? COPY_SOLID + "1F" : "transparent",
        border: "1px solid " + (active ? COPY_SOLID + "55" : D.border),
        borderRadius: 6, padding: "6px 8px", color: active ? COPY_SOLID : D.txm,
        cursor: "pointer", display: "inline-flex", alignItems: "center",
      }}><Icon size={13} strokeWidth={1.8} /></button>
    );
  }
  function setLink() {
    const prev = editor.getAttributes("link").href || "";
    const href = window.prompt("Link URL", prev) || "";
    if (href === "") { editor.chain().focus().extendMarkRange("link").unsetLink().run(); return; }
    editor.chain().focus().extendMarkRange("link").setLink({ href }).run();
  }
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 5, alignItems: "center", padding: "8px 10px", background: "rgba(13,13,18,0.6)", border: "1px solid " + D.border, borderRadius: 10 }}>
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
      <button onClick={onAIContinue} style={pillStyle(COPY_SOLID)} title="AI Continue"><Sparkles size={12} strokeWidth={2} /> Continue</button>
      <button onClick={onVoiceCheck} style={pillStyle(D.teal)} title="Brand voice gate"><ShieldCheck size={12} strokeWidth={2} /> Voice</button>
      <button onClick={onSave} style={pillStyle(D.amber)} title="Snapshot version"><Save size={12} strokeWidth={2} /> Snapshot</button>
      <button onClick={onCopy} style={pillStyle(D.cyan)} title="Copy as rich text"><CopyIcon size={12} strokeWidth={2} /> Copy</button>
      <div style={{ position: "relative" }}>
        <button onClick={() => setExportOpen(o => !o)} style={pillStyle(D.violet)} title="Export"><Download size={12} strokeWidth={2} /> Export</button>
        {exportOpen && (
          <div style={{ position: "absolute", top: "100%", right: 0, marginTop: 6, background: "#0D0D12", border: "1px solid " + D.border, borderRadius: 8, padding: 6, minWidth: 140, zIndex: 10, boxShadow: "0 12px 28px rgba(0,0,0,0.5)" }}>
            {(["docx", "md", "html", "txt"] as const).map(f => (
              <button key={f} onClick={() => { setExportOpen(false); onExport(f); }} style={{
                width: "100%", textAlign: "left", padding: "8px 10px", background: "transparent", border: "none",
                color: D.tx, fontFamily: mn, fontSize: 11, cursor: "pointer", borderRadius: 6, display: "inline-flex", gap: 7, alignItems: "center",
              }}><FileText size={11} strokeWidth={1.8} color={D.txd} /> .{f}</button>
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
    display: "inline-flex", alignItems: "center", gap: 5, padding: "6px 10px", borderRadius: 6,
    background: accent + "16", border: "1px solid " + accent + "44", color: accent,
    fontFamily: mn, fontSize: 10, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase", cursor: "pointer",
  };
}

// ─── Voice panel ──────────────────────────────────────────────────
function VoicePanel({ result, loading, onClose }: { result: { score: number; topLine?: string; violations?: string[]; suggestions?: string[] } | null; loading: boolean; onClose: () => void }) {
  return (
    <aside style={{ background: "#0D0D12", border: "1px solid " + D.border, borderRadius: 14, padding: 18, height: "fit-content" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
        <ShieldCheck size={14} color={D.teal} strokeWidth={2} />
        <span style={{ fontFamily: mn, fontSize: 11, color: D.teal, letterSpacing: 1.4, textTransform: "uppercase", fontWeight: 800 }}>Voice Gate</span>
        <button onClick={onClose} style={{ marginLeft: "auto", background: "transparent", border: "none", color: D.txd, cursor: "pointer", fontFamily: mn, fontSize: 14 }}>×</button>
      </div>
      {loading && <div style={{ fontFamily: mn, fontSize: 11, color: D.txd, padding: "12px 0" }}>SCORING…</div>}
      {!loading && result && (
        <>
          <div style={{ fontFamily: gf, fontSize: 36, fontWeight: 900, color: result.score >= 8 ? D.teal : result.score >= 5 ? D.amber : D.coral, letterSpacing: -1, marginBottom: 4 }}>
            {result.score}<span style={{ fontSize: 16, color: D.txd, letterSpacing: 0 }}>/10</span>
          </div>
          {result.topLine && <div style={{ fontFamily: ft, fontSize: 13, color: D.tx, lineHeight: 1.5, marginBottom: 14 }}>{result.topLine}</div>}
          {result.violations && result.violations.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontFamily: mn, fontSize: 9, color: D.txd, letterSpacing: 1.6, textTransform: "uppercase", marginBottom: 6 }}>What broke voice</div>
              <ul style={{ margin: 0, paddingLeft: 16, color: D.tx, fontFamily: ft, fontSize: 12.5, lineHeight: 1.55 }}>
                {result.violations.map((v, i) => <li key={i} style={{ color: D.coral, marginBottom: 3 }}>{v}</li>)}
              </ul>
            </div>
          )}
          {result.suggestions && result.suggestions.length > 0 && (
            <div>
              <div style={{ fontFamily: mn, fontSize: 9, color: D.txd, letterSpacing: 1.6, textTransform: "uppercase", marginBottom: 6 }}>Rewrites</div>
              <ul style={{ margin: 0, paddingLeft: 16, color: D.tx, fontFamily: ft, fontSize: 12.5, lineHeight: 1.55 }}>
                {result.suggestions.map((s, i) => <li key={i} style={{ color: D.teal, marginBottom: 4 }}>{s}</li>)}
              </ul>
            </div>
          )}
        </>
      )}
      {!loading && !result && (
        <div style={{ fontFamily: mn, fontSize: 11, color: D.txd, padding: "12px 0" }}>NO SCORE YET.</div>
      )}
    </aside>
  );
}

// ─── Retext strip ─────────────────────────────────────────────────
// Tiny inline strip wired to the deterministic retext layer. Always
// renders so the user knows the analysis is running; clicks expand into a
// full rubric panel with the live grade and inline-flag detail.
function RetextStrip({ analysis, expanded, onToggle }: { analysis: RetextAnalysis | null; expanded: boolean; onToggle: () => void }) {
  const passive  = analysis ? analysis.passiveCount     : 0;
  const hype     = analysis ? analysis.weakHypeCount    : 0;
  const equality = analysis ? analysis.equalityWarnings : 0;
  const grade    = analysis ? analysis.readability.grade : null;
  return (
    <div style={{ background: "rgba(13,13,18,0.6)", border: "1px solid " + D.border, borderRadius: 10 }}>
      <button
        type="button"
        onClick={onToggle}
        title="Click to expand retext rubric"
        style={{
          width: "100%", display: "flex", alignItems: "center", gap: 12,
          padding: "6px 12px", background: "transparent", border: "none", cursor: "pointer",
        }}
      >
        <span style={{ fontFamily: mn, fontSize: 9, letterSpacing: 1.6, textTransform: "uppercase", color: D.teal, fontWeight: 800 }}>
          Live · retext
        </span>
        <StripChip label="passive" value={passive} color={D.violet} />
        <StripChip label="hype" value={hype} color={D.coral} />
        <StripChip label="readability" value={grade == null ? "—" : grade} color={D.cyan} />
        {equality > 0 ? <StripChip label="equality" value={equality} color={D.amber} /> : null}
        <span style={{ marginLeft: "auto", fontFamily: mn, fontSize: 10, color: D.txd, letterSpacing: 0.6 }}>
          {expanded ? "− collapse" : "+ rubric"}
        </span>
      </button>
      {expanded && (
        <div style={{ padding: "10px 14px 14px", borderTop: "1px solid " + D.border }}>
          {analysis ? (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
              <div>
                <RetextBar label="Voice"        value={analysis.rubric.voice}       max={3} />
                <RetextBar label="Specificity"  value={analysis.rubric.specificity} max={3} />
                <RetextBar label="Directness"   value={analysis.rubric.directness}  max={2} />
                <RetextBar label="Platform fit" value={analysis.rubric.platformFit} max={2} />
              </div>
              <div>
                <div style={{ fontFamily: mn, fontSize: 10, color: D.txd, letterSpacing: 1.4, textTransform: "uppercase", marginBottom: 6 }}>Readability</div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 10 }}>
                  <span style={{ fontFamily: gf, fontSize: 28, fontWeight: 900, color: D.tx, letterSpacing: -0.6 }}>{analysis.readability.grade}</span>
                  <span style={{ fontFamily: mn, fontSize: 10, color: D.txm }}>grade · FK ease {analysis.readability.fleschKincaid}</span>
                </div>
                <div style={{ fontFamily: ft, fontSize: 11.5, color: D.txm, lineHeight: 1.5 }}>
                  {analysis.inlineFlags.length === 0
                    ? "No inline flags. The LLM gate above is still the source of truth."
                    : `${analysis.inlineFlags.length} inline flag${analysis.inlineFlags.length === 1 ? "" : "s"}. Click the Voice button to run the full SA scorer.`}
                </div>
              </div>
            </div>
          ) : (
            <div style={{ fontFamily: mn, fontSize: 10, color: D.txd }}>Type something to see the rubric.</div>
          )}
        </div>
      )}
    </div>
  );
}

function StripChip({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontFamily: mn, fontSize: 10, letterSpacing: 1, textTransform: "uppercase" }}>
      <span style={{ color, fontWeight: 800 }}>{label}</span>
      <span style={{ color: D.tx, fontWeight: 700 }}>{value}</span>
    </span>
  );
}

function RetextBar({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  const color = pct >= 80 ? D.teal : pct >= 50 ? D.amber : D.coral;
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ fontFamily: ft, fontSize: 11, color: D.tx }}>{label}</span>
        <span style={{ fontFamily: mn, fontSize: 11, color: D.txm }}>{value} / {max}</span>
      </div>
      <div style={{ height: 4, background: D.border, borderRadius: 2, overflow: "hidden" }}>
        <div style={{ height: "100%", width: pct + "%", background: color, transition: "width 0.3s ease" }} />
      </div>
    </div>
  );
}
