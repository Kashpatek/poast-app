"use client";

// NotesPanel — IntelligenceSUITE / Notes (slot 8).
// Three-pane research notebook. Notion-meets-Bear vibe.
// LEFT  · sections + tag chips + pinned shortcuts.
// MIDDLE · note list (search + selected highlight).
// RIGHT · editor (markdown preview + bidirectional [[link]] resolution).
// Persisted to localStorage immediately so reloads are instant, then
// mirrored to Supabase via /api/db (id="is-notes-master") for cross-
// session sync. Legacy single-field notes are migrated on first read.

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Pin, PinOff, Trash2, Copy, Search, StickyNote, Plus, Archive, Eye, EyeOff, FileText, Hash, Inbox, BookOpen, Lightbulb, Microscope } from "lucide-react";
import { D, ft, gf, mn, copyText, uid } from "../shared-constants";
import { showToast } from "../toast-context";
import { SendToChip } from "../components/send-to-chip";
import { useShortcuts } from "../keyboard-shortcuts";

// ─── types ──────────────────────────────────────────────────────────
type Section = "inbox" | "reading" | "ideas" | "research" | "archive";

interface Note {
  id: string;
  title: string;
  body: string;
  section: Section;
  tags: string[];
  pinned: boolean;
  archived: boolean;
  createdAt: number;
  updatedAt: number;
}

interface NotesEnvelope {
  notes: Note[];
  updatedAt: number;
}

const LS_KEY = "poast-is-notes";
const DB_TABLE = "projects";
const DB_ID = "is-notes-master";
const DB_TYPE = "is-notes";

const SECTIONS: { id: Section; label: string; Icon: typeof Inbox }[] = [
  { id: "inbox",    label: "Inbox",    Icon: Inbox },
  { id: "reading",  label: "Reading",  Icon: BookOpen },
  { id: "ideas",    label: "Ideas",    Icon: Lightbulb },
  { id: "research", label: "Research", Icon: Microscope },
  { id: "archive",  label: "Archive",  Icon: Archive },
];

// ─── helpers ────────────────────────────────────────────────────────
function extractTags(body: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const re = /(^|[^\w#])#([A-Za-z0-9_\-]{1,40})/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) {
    const t = m[2].toLowerCase();
    if (!seen.has(t)) {
      seen.add(t);
      out.push(t);
    }
  }
  return out;
}

function extractTitle(body: string): string {
  const first = (body.split(/\r?\n/)[0] || "").trim();
  if (!first) return "Untitled";
  const cleaned = first.replace(/^#+\s*/, "").replace(/\*\*/g, "").replace(/\*/g, "");
  return cleaned.slice(0, 60) || "Untitled";
}

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 0) return "just now";
  const s = Math.floor(diff / 1000);
  if (s < 60) return s + "s ago";
  const m = Math.floor(s / 60);
  if (m < 60) return m + "m ago";
  const h = Math.floor(m / 60);
  if (h < 24) return h + "h ago";
  const d = Math.floor(h / 24);
  if (d < 7) return d + "d ago";
  const w = Math.floor(d / 7);
  if (w < 5) return w + "w ago";
  const mo = Math.floor(d / 30);
  if (mo < 12) return mo + "mo ago";
  return Math.floor(d / 365) + "y ago";
}

function migrate(raw: unknown): Note {
  const r = raw as Record<string, unknown>;
  const id = typeof r.id === "string" ? r.id : uid("note");
  const body = typeof r.body === "string" ? r.body : "";
  const tags = Array.isArray(r.tags) ? (r.tags as string[]).filter(t => typeof t === "string") : extractTags(body);
  const pinned = r.pinned === true;
  const archived = r.archived === true;
  const createdAt = typeof r.createdAt === "number" ? r.createdAt : Date.now();
  const updatedAt = typeof r.updatedAt === "number" ? r.updatedAt : createdAt;
  const title = typeof r.title === "string" && r.title ? r.title : extractTitle(body);
  const section: Section = (typeof r.section === "string" && SECTIONS.some(s => s.id === r.section)) ? (r.section as Section) : "inbox";
  return { id, title, body, section, tags, pinned, archived, createdAt, updatedAt };
}

function readLS(): NotesEnvelope | null {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as NotesEnvelope;
    if (!parsed || !Array.isArray(parsed.notes)) return null;
    return { notes: parsed.notes.map(migrate), updatedAt: parsed.updatedAt || Date.now() };
  } catch {
    return null;
  }
}

function writeLS(env: NotesEnvelope): void {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(env));
  } catch {
    /* quota — drop silently, remote mirror is the source of truth */
  }
}

// Minimal homemade markdown → JSX. Covers # heading, **bold**, *italic*,
// `code`, > quote, - bullet, [text](url), [[wikilink]]. No new dep.
function renderMarkdown(body: string, onLink: (target: string) => void): React.ReactNode {
  const lines = body.split(/\r?\n/);
  const blocks: React.ReactNode[] = [];
  let bulletBuf: string[] = [];

  function flushBullet() {
    if (bulletBuf.length === 0) return;
    blocks.push(
      <ul key={"ul-" + blocks.length} style={{ paddingLeft: 22, margin: "6px 0", color: D.tx, fontFamily: ft, fontSize: 14, lineHeight: 1.6 }}>
        {bulletBuf.map((b, i) => <li key={i} style={{ marginBottom: 4 }}>{inline(b)}</li>)}
      </ul>
    );
    bulletBuf = [];
  }

  function inline(text: string): React.ReactNode {
    // Bidirectional [[wikilink]] first — they may contain spaces.
    const parts: React.ReactNode[] = [];
    const re = /(\[\[[^\]]+\]\]|\[[^\]]+\]\([^)]+\)|\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;
    let last = 0;
    let m: RegExpExecArray | null;
    let idx = 0;
    while ((m = re.exec(text)) !== null) {
      if (m.index > last) parts.push(<span key={"t" + idx++}>{text.slice(last, m.index)}</span>);
      const tok = m[0];
      if (tok.startsWith("[[")) {
        const target = tok.slice(2, -2).trim();
        parts.push(<a key={"w" + idx++} onClick={() => onLink(target)} style={{ color: D.blue, cursor: "pointer", textDecoration: "underline", textDecorationStyle: "dotted" }}>{target}</a>);
      } else if (tok.startsWith("[")) {
        const linkMatch = tok.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
        if (linkMatch) {
          parts.push(<a key={"l" + idx++} href={linkMatch[2]} target="_blank" rel="noopener noreferrer" style={{ color: D.blue, textDecoration: "underline" }}>{linkMatch[1]}</a>);
        } else {
          parts.push(<span key={"l" + idx++}>{tok}</span>);
        }
      } else if (tok.startsWith("**")) {
        parts.push(<strong key={"b" + idx++} style={{ color: D.tx }}>{tok.slice(2, -2)}</strong>);
      } else if (tok.startsWith("*")) {
        parts.push(<em key={"i" + idx++}>{tok.slice(1, -1)}</em>);
      } else if (tok.startsWith("`")) {
        parts.push(<code key={"c" + idx++} style={{ fontFamily: mn, fontSize: 12.5, padding: "1px 5px", borderRadius: 4, background: "rgba(255,255,255,0.06)", border: "1px solid " + D.border, color: D.amber }}>{tok.slice(1, -1)}</code>);
      }
      last = m.index + tok.length;
    }
    if (last < text.length) parts.push(<span key={"t" + idx++}>{text.slice(last)}</span>);
    return <>{parts}</>;
  }

  lines.forEach((raw, i) => {
    if (raw.startsWith("- ") || raw.startsWith("* ")) {
      bulletBuf.push(raw.slice(2));
      return;
    }
    flushBullet();
    if (raw.startsWith("# ")) {
      blocks.push(<h2 key={i} style={{ fontFamily: gf, fontSize: 24, fontWeight: 800, color: D.tx, margin: "14px 0 6px", letterSpacing: -0.4 }}>{inline(raw.slice(2))}</h2>);
    } else if (raw.startsWith("## ")) {
      blocks.push(<h3 key={i} style={{ fontFamily: gf, fontSize: 18, fontWeight: 700, color: D.tx, margin: "12px 0 4px" }}>{inline(raw.slice(3))}</h3>);
    } else if (raw.startsWith("> ")) {
      blocks.push(
        <blockquote key={i} style={{ borderLeft: "3px solid " + D.amber + "55", padding: "4px 12px", color: D.txm, fontFamily: ft, fontSize: 14, margin: "6px 0", fontStyle: "italic" }}>
          {inline(raw.slice(2))}
        </blockquote>
      );
    } else if (raw.trim() === "") {
      blocks.push(<div key={i} style={{ height: 8 }} />);
    } else {
      blocks.push(<p key={i} style={{ fontFamily: ft, fontSize: 14, color: D.tx, margin: "4px 0", lineHeight: 1.6 }}>{inline(raw)}</p>);
    }
  });
  flushBullet();
  return <>{blocks}</>;
}

// Find notes that reference the given title via [[...]].
function findBacklinks(notes: Note[], title: string, selfId: string): Note[] {
  if (!title) return [];
  const needle = title.toLowerCase();
  return notes.filter(n => {
    if (n.id === selfId) return false;
    const re = /\[\[([^\]]+)\]\]/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(n.body)) !== null) {
      if (m[1].trim().toLowerCase() === needle) return true;
    }
    return false;
  });
}

// ─── component ──────────────────────────────────────────────────────
export default function NotesPanel() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [section, setSection] = useState<Section>("inbox");
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [preview, setPreview] = useState(false);

  const searchRef = useRef<HTMLInputElement | null>(null);
  const bodyRef = useRef<HTMLTextAreaElement | null>(null);
  const titleRef = useRef<HTMLInputElement | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedRef = useRef<string>("");

  // Hydrate: LS first, then merge with remote if remote is newer.
  useEffect(() => {
    const local = readLS();
    if (local) {
      setNotes(local.notes);
      setHydrated(true);
    }
    (async () => {
      try {
        const r = await fetch("/api/db?table=" + DB_TABLE + "&id=" + DB_ID);
        const res = await r.json();
        const remote: NotesEnvelope | null = res?.data?.data || null;
        if (remote && Array.isArray(remote.notes)) {
          const remoteEnv: NotesEnvelope = { notes: remote.notes.map(migrate), updatedAt: remote.updatedAt || 0 };
          if (!local || remoteEnv.updatedAt > local.updatedAt) {
            setNotes(remoteEnv.notes);
            writeLS(remoteEnv);
          }
        }
      } catch { /* offline */ }
      setHydrated(true);
    })();
  }, []);

  // Debounced sync to LS + remote whenever notes change after hydration.
  useEffect(() => {
    if (!hydrated) return;
    const env: NotesEnvelope = { notes, updatedAt: Date.now() };
    writeLS(env);
    const serial = JSON.stringify(notes);
    if (serial === lastSavedRef.current) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      lastSavedRef.current = serial;
      fetch("/api/db", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          table: DB_TABLE,
          data: { id: DB_ID, name: "IntelligenceSUITE Notes", type: DB_TYPE, data: env, updated_at: new Date(env.updatedAt).toISOString() },
        }),
      }).catch(() => { /* fail-quiet */ });
    }, 900);
  }, [notes, hydrated]);

  // Derived view.
  const tagCloud = useMemo(() => {
    const map = new Map<string, number>();
    notes.forEach(n => n.tags.forEach(t => map.set(t, (map.get(t) || 0) + 1)));
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]).slice(0, 24);
  }, [notes]);

  const sectionCounts = useMemo(() => {
    const c: Record<Section, number> = { inbox: 0, reading: 0, ideas: 0, research: 0, archive: 0 };
    notes.forEach(n => { c[n.section] = (c[n.section] || 0) + 1; });
    return c;
  }, [notes]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return notes
      .filter(n => n.section === section)
      .filter(n => !activeTag || n.tags.includes(activeTag))
      .filter(n => !q || n.title.toLowerCase().includes(q) || n.body.toLowerCase().includes(q) || n.tags.some(t => t.includes(q)))
      .sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        return b.updatedAt - a.updatedAt;
      });
  }, [notes, section, activeTag, query]);

  const pinned = useMemo(() => notes.filter(n => n.pinned && !n.archived).slice(0, 6), [notes]);

  const active = useMemo(() => notes.find(n => n.id === activeId) || null, [notes, activeId]);
  const backlinks = useMemo(() => active ? findBacklinks(notes, active.title, active.id) : [], [notes, active]);

  // ── actions ──────────────────────────────────────────────────────
  function newNote() {
    const now = Date.now();
    const note: Note = {
      id: uid("note"),
      title: "Untitled",
      body: "",
      section,
      tags: [],
      pinned: false,
      archived: false,
      createdAt: now,
      updatedAt: now,
    };
    setNotes(prev => [note, ...prev]);
    setActiveId(note.id);
    setPreview(false);
    setTimeout(() => { titleRef.current?.focus(); titleRef.current?.select(); }, 30);
  }

  function updateNote(id: string, patch: Partial<Note>) {
    setNotes(prev => prev.map(n => {
      if (n.id !== id) return n;
      const merged = { ...n, ...patch, updatedAt: Date.now() };
      if ("body" in patch && typeof patch.body === "string") {
        merged.tags = extractTags(patch.body);
        if (!patch.title && (n.title === "Untitled" || !n.title)) merged.title = extractTitle(patch.body);
      }
      return merged;
    }));
  }

  function setActiveBody(body: string) {
    if (!active) return;
    updateNote(active.id, { body });
  }

  function setActiveTitle(title: string) {
    if (!active) return;
    updateNote(active.id, { title });
  }

  function togglePin(id: string) {
    setNotes(prev => prev.map(n => n.id === id ? { ...n, pinned: !n.pinned, updatedAt: Date.now() } : n));
  }

  function archive(id: string) {
    setNotes(prev => prev.map(n => n.id === id ? { ...n, section: "archive", archived: true, updatedAt: Date.now() } : n));
    showToast("Archived.", "info");
  }

  function deleteNote(id: string) {
    setNotes(prev => prev.filter(n => n.id !== id));
    if (activeId === id) setActiveId(null);
    showToast("Deleted.", "info");
  }

  function setActiveSection(id: string, next: Section) {
    setNotes(prev => prev.map(n => n.id === id ? { ...n, section: next, archived: next === "archive", updatedAt: Date.now() } : n));
  }

  function wrapSelection(marker: string) {
    if (!active || !bodyRef.current) return;
    const ta = bodyRef.current;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const before = active.body.slice(0, start);
    const middle = active.body.slice(start, end);
    const after = active.body.slice(end);
    const next = before + marker + middle + marker + after;
    setActiveBody(next);
    setTimeout(() => {
      ta.focus();
      ta.selectionStart = start + marker.length;
      ta.selectionEnd = end + marker.length;
    }, 0);
  }

  function jumpToTitle(target: string) {
    const t = target.trim().toLowerCase();
    const hit = notes.find(n => n.title.toLowerCase() === t);
    if (hit) {
      setSection(hit.section);
      setActiveTag(null);
      setActiveId(hit.id);
      return;
    }
    // Create a new note with that title.
    const now = Date.now();
    const note: Note = {
      id: uid("note"),
      title: target.trim(),
      body: "",
      section: "inbox",
      tags: [],
      pinned: false,
      archived: false,
      createdAt: now,
      updatedAt: now,
    };
    setNotes(prev => [note, ...prev]);
    setSection("inbox");
    setActiveId(note.id);
    setPreview(false);
    showToast("Created \"" + target.trim() + "\".", "success");
  }

  // ── shortcuts ────────────────────────────────────────────────────
  const newNoteRef = useRef(newNote);
  const focusSearchRef = useRef(() => { searchRef.current?.focus(); });
  const wrapBoldRef = useRef(() => wrapSelection("**"));
  const wrapItalicRef = useRef(() => wrapSelection("*"));
  const togglePinRef = useRef(() => { if (active) togglePin(active.id); });
  newNoteRef.current = newNote;
  focusSearchRef.current = () => { searchRef.current?.focus(); };
  wrapBoldRef.current = () => wrapSelection("**");
  wrapItalicRef.current = () => wrapSelection("*");
  togglePinRef.current = () => { if (active) togglePin(active.id); };

  useShortcuts({
    "$mod+n": { description: "New note", handler: () => newNoteRef.current() },
    "$mod+f": { description: "Focus search", handler: () => focusSearchRef.current() },
    "$mod+b": { description: "Bold selection", handler: () => wrapBoldRef.current() },
    "$mod+i": { description: "Italic selection", handler: () => wrapItalicRef.current() },
    "$mod+p": { description: "Toggle pin on current note", handler: () => togglePinRef.current() },
  }, { scope: "Notes" });

  // ── render ───────────────────────────────────────────────────────
  return (
    <div style={{ display: "grid", gridTemplateColumns: "240px 360px 1fr", gap: 14, height: "calc(100vh - 220px)", minHeight: 520, fontFamily: ft, color: D.tx }}>
      {/* LEFT · sidebar */}
      <aside style={{
        background: D.card, border: "1px solid " + D.border, borderRadius: 14,
        padding: 14, overflow: "auto", display: "flex", flexDirection: "column", gap: 14,
      }}>
        <button onClick={newNote} style={{
          padding: "10px 12px", background: D.amber, color: "#060608", border: "none", borderRadius: 8,
          fontFamily: mn, fontSize: 11, fontWeight: 800, letterSpacing: 1.4, textTransform: "uppercase", cursor: "pointer",
          display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
        }}><Plus size={13} strokeWidth={2.2} /> New note</button>

        <div>
          <div style={{ fontFamily: mn, fontSize: 9, color: D.txd, letterSpacing: 2, marginBottom: 6, textTransform: "uppercase" }}>Sections</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {SECTIONS.map(s => {
              const isActive = section === s.id;
              return (
                <button key={s.id} onClick={() => { setSection(s.id); setActiveTag(null); }} style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "8px 10px", borderRadius: 6,
                  background: isActive ? D.amber + "14" : "transparent",
                  border: "1px solid " + (isActive ? D.amber + "55" : "transparent"),
                  color: isActive ? D.amber : D.tx,
                  fontFamily: ft, fontSize: 13, cursor: "pointer", textAlign: "left",
                }}>
                  <s.Icon size={13} strokeWidth={1.8} color={isActive ? D.amber : D.txm} />
                  <span style={{ flex: 1 }}>{s.label}</span>
                  <span style={{ fontFamily: mn, fontSize: 10, color: D.txd }}>{sectionCounts[s.id] || 0}</span>
                </button>
              );
            })}
          </div>
        </div>

        {tagCloud.length > 0 && (
          <div>
            <div style={{ fontFamily: mn, fontSize: 9, color: D.txd, letterSpacing: 2, marginBottom: 6, textTransform: "uppercase" }}>Tags</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
              {tagCloud.map(([t, count]) => {
                const isActive = activeTag === t;
                return (
                  <button key={t} onClick={() => setActiveTag(isActive ? null : t)} style={{
                    padding: "3px 8px", borderRadius: 999,
                    background: isActive ? D.violet + "22" : "rgba(255,255,255,0.04)",
                    border: "1px solid " + (isActive ? D.violet + "55" : D.border),
                    color: isActive ? D.violet : D.txm,
                    fontFamily: mn, fontSize: 10, fontWeight: 600, cursor: "pointer",
                  }}>#{t} <span style={{ opacity: 0.55 }}>{count}</span></button>
                );
              })}
            </div>
          </div>
        )}

        {pinned.length > 0 && (
          <div>
            <div style={{ fontFamily: mn, fontSize: 9, color: D.txd, letterSpacing: 2, marginBottom: 6, textTransform: "uppercase" }}>Pinned</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {pinned.map(n => (
                <button key={n.id} onClick={() => { setSection(n.section); setActiveTag(null); setActiveId(n.id); }} style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "6px 8px", borderRadius: 6,
                  background: activeId === n.id ? D.amber + "10" : "transparent",
                  border: "1px solid transparent",
                  color: D.tx, fontFamily: ft, fontSize: 12.5, cursor: "pointer", textAlign: "left",
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>
                  <Pin size={11} strokeWidth={1.8} color={D.amber} />
                  <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis" }}>{n.title}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </aside>

      {/* MIDDLE · note list */}
      <div style={{ background: D.card, border: "1px solid " + D.border, borderRadius: 14, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: 12, borderBottom: "1px solid " + D.border, display: "flex", alignItems: "center", gap: 8 }}>
          <Search size={14} strokeWidth={1.8} color={D.txd} />
          <input
            ref={searchRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search notes…"
            style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: D.tx, fontFamily: ft, fontSize: 13 }}
          />
          {query && (
            <button onClick={() => setQuery("")} style={{ background: "transparent", border: "none", color: D.txd, cursor: "pointer", fontFamily: mn, fontSize: 11 }}>×</button>
          )}
        </div>
        <div style={{ flex: 1, overflow: "auto" }}>
          {filtered.length === 0 ? (
            <div style={{ padding: 28, textAlign: "center", fontFamily: ft, fontSize: 13, color: D.txm }}>
              {query ? "No notes match \"" + query + "\"." : "No notes in " + section + " yet — try + New note."}
            </div>
          ) : (
            filtered.map(n => {
              const isActive = activeId === n.id;
              return (
                <div key={n.id} onClick={() => { setActiveId(n.id); setPreview(false); }} style={{
                  padding: "12px 14px",
                  borderLeft: isActive ? "2px solid " + D.amber : "2px solid transparent",
                  borderBottom: "1px solid " + D.border,
                  background: isActive ? D.amber + "0A" : "transparent",
                  cursor: "pointer",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                    {n.pinned && <Pin size={10} strokeWidth={2} color={D.amber} />}
                    <div style={{ fontFamily: ft, fontSize: 13, fontWeight: 700, color: D.tx, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{n.title}</div>
                  </div>
                  <div style={{ fontFamily: ft, fontSize: 11, color: D.txm, lineHeight: 1.4, marginBottom: 4, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                    {n.body.replace(/[#*`>[\]]/g, "").slice(0, 200) || <em style={{ color: D.txd }}>empty</em>}
                  </div>
                  <div style={{ fontFamily: mn, fontSize: 9, color: D.txd, letterSpacing: 0.8 }}>{relativeTime(n.updatedAt)}</div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* RIGHT · editor */}
      <div style={{ background: D.card, border: "1px solid " + D.border, borderRadius: 14, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        {!active ? (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, padding: 32 }}>
            <StickyNote size={64} strokeWidth={1.4} color={D.amber} style={{ opacity: 0.4 }} />
            <div style={{ fontFamily: gf, fontSize: 22, fontWeight: 800, color: D.tx, letterSpacing: -0.3 }}>Capture your first thought.</div>
            <div style={{ fontFamily: ft, fontSize: 13, color: D.txm, textAlign: "center", maxWidth: 360 }}>Quotes, ideas, links, half-formed angles — drop them here and use #tags + [[backlinks]] to weave them together.</div>
            <button onClick={newNote} style={{
              padding: "10px 18px", background: D.amber, color: "#060608", border: "none", borderRadius: 8,
              fontFamily: mn, fontSize: 11, fontWeight: 800, letterSpacing: 1.4, textTransform: "uppercase", cursor: "pointer",
              display: "inline-flex", alignItems: "center", gap: 6,
            }}><Plus size={13} strokeWidth={2.2} /> New note</button>
          </div>
        ) : (
          <>
            {/* Editor toolbar */}
            <div style={{ padding: "10px 14px", borderBottom: "1px solid " + D.border, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              <ToolbarBtn label={active.pinned ? "Unpin" : "Pin"} Icon={active.pinned ? PinOff : Pin} onClick={() => togglePin(active.id)} />
              <ToolbarBtn label="Archive" Icon={Archive} onClick={() => archive(active.id)} />
              <ToolbarBtn label="Copy" Icon={Copy} onClick={() => { copyText(active.body); showToast("Copied.", "success"); }} />
              <ToolbarBtn label={preview ? "Edit" : "Preview"} Icon={preview ? EyeOff : Eye} onClick={() => setPreview(p => !p)} />
              <ToolbarBtn label="Export .md" Icon={FileText} onClick={() => {
                const blob = new Blob([active.body], { type: "text/markdown" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url; a.download = (active.title || "note").replace(/[^A-Za-z0-9_-]/g, "_") + ".md";
                document.body.appendChild(a); a.click(); a.remove();
                URL.revokeObjectURL(url);
              }} />
              <ToolbarBtn label="Delete" Icon={Trash2} onClick={() => deleteNote(active.id)} danger />
              <div style={{ marginLeft: "auto", display: "flex", gap: 6, alignItems: "center" }}>
                <select
                  value={active.section}
                  onChange={e => setActiveSection(active.id, e.target.value as Section)}
                  style={{
                    background: "rgba(255,255,255,0.04)", border: "1px solid " + D.border, borderRadius: 6,
                    color: D.tx, fontFamily: mn, fontSize: 10, padding: "5px 8px", cursor: "pointer", outline: "none",
                  }}>
                  {SECTIONS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
                <SendToChip text={active.body} sourceTool="notes" kind="caption" />
              </div>
            </div>

            {/* Title */}
            <input
              ref={titleRef}
              value={active.title}
              onChange={e => setActiveTitle(e.target.value)}
              placeholder="Untitled"
              style={{
                width: "100%", padding: "16px 22px 4px", background: "transparent", border: "none", outline: "none",
                color: D.tx, fontFamily: gf, fontSize: 24, fontWeight: 800, letterSpacing: -0.4, boxSizing: "border-box",
              }}
            />

            {/* Tag row */}
            {active.tags.length > 0 && (
              <div style={{ padding: "0 22px 6px", display: "flex", flexWrap: "wrap", gap: 4 }}>
                {active.tags.map(t => (
                  <span key={t} style={{ fontFamily: mn, fontSize: 10, color: D.violet, background: D.violet + "12", border: "1px solid " + D.violet + "33", borderRadius: 999, padding: "2px 8px" }}>#{t}</span>
                ))}
              </div>
            )}

            {/* Body — editor or preview */}
            <div style={{ flex: 1, overflow: "auto", padding: "8px 22px 18px" }}>
              {preview ? (
                renderMarkdown(active.body, jumpToTitle)
              ) : (
                <textarea
                  ref={bodyRef}
                  value={active.body}
                  onChange={e => setActiveBody(e.target.value)}
                  placeholder="Start writing — supports # heading, **bold**, *italic*, [link](url), [[backlinks]], and #tags."
                  style={{
                    width: "100%", minHeight: "100%", background: "transparent", border: "none", outline: "none",
                    color: D.tx, fontFamily: ft, fontSize: 14, lineHeight: 1.6, resize: "none", boxSizing: "border-box",
                  }}
                />
              )}
            </div>

            {/* Linked-notes panel */}
            {backlinks.length > 0 && (
              <div style={{ padding: "12px 22px", borderTop: "1px solid " + D.border, background: D.surface }}>
                <div style={{ fontFamily: mn, fontSize: 9, color: D.txd, letterSpacing: 2, marginBottom: 6, textTransform: "uppercase" }}>Linked from</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {backlinks.map(b => (
                    <button key={b.id} onClick={() => { setSection(b.section); setActiveTag(null); setActiveId(b.id); }} style={{
                      padding: "4px 10px", background: "rgba(255,255,255,0.04)", border: "1px solid " + D.border, borderRadius: 6,
                      color: D.blue, fontFamily: ft, fontSize: 12, cursor: "pointer",
                    }}>{b.title}</button>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function ToolbarBtn({ label, Icon, onClick, danger }: { label: string; Icon: typeof Pin; onClick: () => void; danger?: boolean }) {
  return (
    <button onClick={onClick} title={label} style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      padding: "5px 9px", borderRadius: 6,
      background: "rgba(255,255,255,0.03)", border: "1px solid " + D.border,
      color: danger ? D.coral : D.txm, fontFamily: mn, fontSize: 10, fontWeight: 700, letterSpacing: 0.4,
      cursor: "pointer", textTransform: "uppercase",
    }}><Icon size={11} strokeWidth={1.8} />{label}</button>
  );
}
