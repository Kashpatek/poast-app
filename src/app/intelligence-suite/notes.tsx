"use client";

// NotesPanel — IntelligenceSUITE / Notes (slot 8).
// Quick research capture: textarea → list of note cards. Persisted to
// localStorage immediately so reloads are instant, then mirrored to
// Supabase via /api/db (id="is-notes-master") for cross-session sync.
// On mount we hydrate from LS first; the remote fetch runs in parallel
// and we keep whichever side has the newer updatedAt.

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Pin, PinOff, Trash2, Copy, Search } from "lucide-react";
import { D, ft, gf, mn, copyText, uid } from "../shared-constants";
import { showToast } from "../toast-context";
import { SendToChip } from "../components/send-to-chip";

interface Note {
  id: string;
  body: string;
  tags: string[];
  pinned: boolean;
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
const MAX_LINES_COLLAPSED = 8;

// ─── helpers ────────────────────────────────────────────────────────
function extractTags(body: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  // #tag — letters/digits/underscore/dash, anchored on a non-word boundary.
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

function readLS(): NotesEnvelope | null {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as NotesEnvelope;
    if (!parsed || !Array.isArray(parsed.notes)) return null;
    return parsed;
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

// ─── component ──────────────────────────────────────────────────────
export default function NotesPanel() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState("");
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const draftRef = useRef<HTMLTextAreaElement | null>(null);
  const lastSavedRef = useRef<string>("");
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Hydrate: LS first (instant paint), then merge with remote if remote
  // is newer. We compare envelope.updatedAt rather than per-note ts so
  // a stale local cache from a different device can't silently win.
  useEffect(function () {
    const local = readLS();
    if (local) {
      setNotes(local.notes);
      lastSavedRef.current = JSON.stringify({ notes: local.notes });
    }
    setHydrated(true);
    let cancelled = false;
    (async function () {
      try {
        const res = await fetch("/api/db?table=" + DB_TABLE + "&id=" + DB_ID);
        if (!res.ok) return;
        const j = await res.json();
        const row = j.data;
        if (!row || cancelled) return;
        const data = row.data as NotesEnvelope | undefined;
        if (!data || !Array.isArray(data.notes)) return;
        const localStamp = local ? local.updatedAt : 0;
        const remoteStamp = data.updatedAt || 0;
        if (remoteStamp >= localStamp) {
          setNotes(data.notes);
          writeLS({ notes: data.notes, updatedAt: remoteStamp });
          lastSavedRef.current = JSON.stringify({ notes: data.notes });
        }
      } catch {
        /* offline — LS already populated UI */
      }
    })();
    return function () { cancelled = true; };
  }, []);

  // Debounced persist. Mirrors to LS synchronously (so a reload right
  // after a keystroke doesn't lose it) and to the DB on a 500ms trail.
  useEffect(function () {
    if (!hydrated) return;
    const serialized = JSON.stringify({ notes: notes });
    if (serialized === lastSavedRef.current) return;
    const stamp = Date.now();
    writeLS({ notes: notes, updatedAt: stamp });
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(function () {
      lastSavedRef.current = serialized;
      void fetch("/api/db", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          table: DB_TABLE,
          data: {
            id: DB_ID,
            name: "IS Notes",
            type: DB_TYPE,
            data: { notes: notes, updatedAt: stamp },
            updated_at: new Date().toISOString(),
          },
        }),
      }).catch(function () { /* swallow — LS is still authoritative */ });
    }, 500);
    return function () {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [notes, hydrated]);

  // ── actions ─────────────────────────────────────────────────
  function addNote() {
    const body = draft.trim();
    if (!body) return;
    const now = Date.now();
    const note: Note = {
      id: uid("note"),
      body: body,
      tags: extractTags(body),
      pinned: false,
      createdAt: now,
      updatedAt: now,
    };
    setNotes(function (cur) { return [note, ...cur]; });
    setDraft("");
    showToast("Note captured.", "success");
    if (draftRef.current) draftRef.current.focus();
  }

  function deleteNote(id: string) {
    setNotes(function (cur) { return cur.filter(function (n) { return n.id !== id; }); });
    showToast("Note deleted.", "info");
  }

  function togglePin(id: string) {
    setNotes(function (cur) {
      return cur.map(function (n) {
        if (n.id !== id) return n;
        return { ...n, pinned: !n.pinned, updatedAt: Date.now() };
      });
    });
  }

  function copyNote(body: string) {
    if (copyText(body)) showToast("Note copied.", "success");
    else showToast("Copy failed.", "error");
  }

  // ── derived: tag universe + filtered list ──────────────────
  const allTags = useMemo(function () {
    const counts: Record<string, number> = {};
    notes.forEach(function (n) {
      n.tags.forEach(function (t) { counts[t] = (counts[t] || 0) + 1; });
    });
    return Object.entries(counts)
      .sort(function (a, b) { return b[1] - a[1]; })
      .map(function (entry) { return { tag: entry[0], count: entry[1] }; });
  }, [notes]);

  const visibleNotes = useMemo(function () {
    const q = query.trim().toLowerCase();
    return notes
      .filter(function (n) {
        if (activeTag && n.tags.indexOf(activeTag) === -1) return false;
        if (q && n.body.toLowerCase().indexOf(q) === -1) return false;
        return true;
      })
      .slice()
      .sort(function (a, b) {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        return b.createdAt - a.createdAt;
      });
  }, [notes, query, activeTag]);

  // ── render ──────────────────────────────────────────────────
  return (
    <div style={{
      maxWidth: 920,
      margin: "0 auto",
      padding: "28px 22px 56px 22px",
      fontFamily: ft,
    }}>
      {/* Header */}
      <div style={{ marginBottom: 22 }}>
        <div style={{ fontFamily: gf, fontSize: 38, fontWeight: 800, color: D.tx, letterSpacing: -0.8, lineHeight: 1.05 }}>
          Notes
        </div>
        <div style={{ fontFamily: ft, fontSize: 14, color: D.txm, marginTop: 6 }}>
          Quick research capture and reading list.
        </div>
      </div>

      {/* Quick-add */}
      <div style={{
        background: D.card,
        border: "1px solid " + D.border,
        borderRadius: 12,
        padding: 14,
        marginBottom: 22,
      }}>
        <textarea
          ref={draftRef}
          value={draft}
          onChange={function (e) { setDraft(e.target.value); }}
          onKeyDown={function (e) {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
              e.preventDefault();
              addNote();
            }
          }}
          rows={3}
          placeholder="Capture a thought, quote, article, or #idea... (⌘+Enter to save)"
          style={{
            width: "100%",
            background: "transparent",
            border: "none",
            outline: "none",
            resize: "vertical",
            color: D.tx,
            fontFamily: ft,
            fontSize: 14,
            lineHeight: 1.5,
            minHeight: 64,
          }}
        />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 8 }}>
          <div style={{ fontFamily: mn, fontSize: 9, color: D.txd, letterSpacing: 0.8, textTransform: "uppercase" }}>
            #tags become filter chips
          </div>
          <button
            onClick={addNote}
            disabled={!draft.trim()}
            style={{
              padding: "8px 18px",
              borderRadius: 999,
              border: "none",
              background: draft.trim() ? D.amber : "rgba(247,176,65,0.20)",
              color: draft.trim() ? "#0A0A0E" : D.txd,
              fontFamily: mn, fontSize: 10, fontWeight: 800, letterSpacing: 1.4,
              textTransform: "uppercase",
              cursor: draft.trim() ? "pointer" : "default",
              transition: "all 0.15s ease",
            }}
          >
            Add note
          </button>
        </div>
      </div>

      {/* Search */}
      <div style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "10px 12px",
        background: D.card,
        border: "1px solid " + D.border,
        borderRadius: 10,
        marginBottom: 14,
      }}>
        <Search size={13} strokeWidth={2.4} color={D.txm} />
        <input
          type="text"
          value={query}
          onChange={function (e) { setQuery(e.target.value); }}
          placeholder="Search notes..."
          style={{
            flex: 1,
            background: "transparent",
            border: "none",
            outline: "none",
            color: D.tx,
            fontFamily: ft, fontSize: 13,
          }}
        />
        {query && (
          <span
            onClick={function () { setQuery(""); }}
            role="button"
            style={{
              fontFamily: mn, fontSize: 9, color: D.txd, cursor: "pointer",
              padding: "3px 8px", borderRadius: 6, border: "1px solid " + D.border,
            }}
          >
            Clear
          </span>
        )}
      </div>

      {/* Tag filter row */}
      {allTags.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 18 }}>
          <TagChip
            label="All"
            active={activeTag === null}
            onClick={function () { setActiveTag(null); }}
          />
          {allTags.map(function (entry) {
            return (
              <TagChip
                key={entry.tag}
                label={"#" + entry.tag}
                count={entry.count}
                active={activeTag === entry.tag}
                onClick={function () { setActiveTag(activeTag === entry.tag ? null : entry.tag); }}
              />
            );
          })}
        </div>
      )}

      {/* Notes list */}
      {visibleNotes.length === 0 ? (
        <EmptyState hasNotes={notes.length > 0} />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {visibleNotes.map(function (n) {
            return (
              <NoteCard
                key={n.id}
                note={n}
                expanded={!!expanded[n.id]}
                onToggleExpand={function () {
                  setExpanded(function (cur) {
                    const next = { ...cur };
                    next[n.id] = !cur[n.id];
                    return next;
                  });
                }}
                onCopy={function () { copyNote(n.body); }}
                onPin={function () { togglePin(n.id); }}
                onDelete={function () { deleteNote(n.id); }}
                onTagClick={function (tag) { setActiveTag(activeTag === tag ? null : tag); }}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── subcomponents ──────────────────────────────────────────────────
interface TagChipProps {
  label: string;
  count?: number;
  active: boolean;
  onClick: () => void;
}

function TagChip({ label, count, active, onClick }: TagChipProps) {
  const [hover, setHover] = useState(false);
  const on = active || hover;
  return (
    <span
      role="button"
      onClick={onClick}
      onMouseEnter={function () { setHover(true); }}
      onMouseLeave={function () { setHover(false); }}
      style={{
        display: "inline-flex", alignItems: "center", gap: 5,
        padding: "5px 10px",
        borderRadius: 999,
        background: active ? D.amber + "18" : (hover ? "rgba(255,255,255,0.04)" : "transparent"),
        border: "1px solid " + (active ? D.amber + "55" : D.border),
        color: on ? D.amber : D.txm,
        fontFamily: mn, fontSize: 10, fontWeight: 700, letterSpacing: 0.6,
        cursor: "pointer",
        userSelect: "none",
        transition: "all 0.15s ease",
        whiteSpace: "nowrap",
      }}
    >
      {label}
      {typeof count === "number" && (
        <span style={{ color: active ? D.amber : D.txd, opacity: 0.8 }}>· {count}</span>
      )}
    </span>
  );
}

interface NoteCardProps {
  note: Note;
  expanded: boolean;
  onToggleExpand: () => void;
  onCopy: () => void;
  onPin: () => void;
  onDelete: () => void;
  onTagClick: (tag: string) => void;
}

function NoteCard({ note, expanded, onToggleExpand, onCopy, onPin, onDelete, onTagClick }: NoteCardProps) {
  const lines = note.body.split("\n");
  const tooLong = lines.length > MAX_LINES_COLLAPSED;
  const displayBody = expanded || !tooLong
    ? note.body
    : lines.slice(0, MAX_LINES_COLLAPSED).join("\n");

  return (
    <div style={{
      background: note.pinned
        ? "linear-gradient(180deg, rgba(247,176,65,0.05), " + D.card + " 60%)"
        : D.card,
      border: "1px solid " + (note.pinned ? D.amber + "33" : D.border),
      borderRadius: 12,
      padding: 14,
      display: "flex", flexDirection: "column", gap: 10,
    }}>
      {/* Body */}
      <div style={{
        fontFamily: ft, fontSize: 14, color: D.tx,
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
        lineHeight: 1.55,
      }}>
        {displayBody}
        {tooLong && (
          <>
            {!expanded && <span style={{ color: D.txd }}>…</span>}
            <span
              role="button"
              onClick={onToggleExpand}
              style={{
                display: "inline-block",
                marginLeft: 8,
                fontFamily: mn, fontSize: 10, fontWeight: 700, color: D.amber,
                letterSpacing: 0.6, textTransform: "uppercase",
                cursor: "pointer",
              }}
            >
              {expanded ? "Show less" : "Show more"}
            </span>
          </>
        )}
      </div>

      {/* Tags */}
      {note.tags.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
          {note.tags.map(function (t) {
            return (
              <span
                key={t}
                role="button"
                onClick={function () { onTagClick(t); }}
                style={{
                  fontFamily: mn, fontSize: 9, fontWeight: 700,
                  color: D.amber,
                  padding: "2px 7px",
                  borderRadius: 999,
                  background: D.amber + "10",
                  border: "1px solid " + D.amber + "30",
                  cursor: "pointer",
                  letterSpacing: 0.4,
                }}
              >
                #{t}
              </span>
            );
          })}
        </div>
      )}

      {/* Footer */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        gap: 10,
        flexWrap: "wrap",
      }}>
        <div style={{
          fontFamily: mn, fontSize: 10, color: D.txd, letterSpacing: 0.6,
        }}>
          {relativeTime(note.createdAt)}
          {note.pinned && (
            <span style={{ marginLeft: 8, color: D.amber }}>· pinned</span>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <IconChip label="Copy" Icon={Copy} onClick={onCopy} />
          <SendToChip text={note.body} sourceTool="notes" kind="other" />
          <IconChip
            label={note.pinned ? "Unpin" : "Pin"}
            Icon={note.pinned ? PinOff : Pin}
            onClick={onPin}
            active={note.pinned}
          />
          <IconChip label="Delete" Icon={Trash2} onClick={onDelete} danger />
        </div>
      </div>
    </div>
  );
}

interface IconChipProps {
  label: string;
  Icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
  onClick: () => void;
  active?: boolean;
  danger?: boolean;
}

function IconChip({ label, Icon, onClick, active, danger }: IconChipProps) {
  const [hover, setHover] = useState(false);
  const color = danger
    ? (hover ? D.coral : "rgba(255,255,255,0.4)")
    : active
      ? D.amber
      : (hover ? D.amber : "rgba(255,255,255,0.5)");
  const borderColor = danger
    ? (hover ? D.coral + "55" : D.border)
    : active
      ? D.amber + "55"
      : (hover ? D.amber + "55" : D.border);
  return (
    <span
      role="button"
      title={label}
      onClick={onClick}
      onMouseEnter={function () { setHover(true); }}
      onMouseLeave={function () { setHover(false); }}
      style={{
        display: "inline-flex", alignItems: "center", gap: 5,
        fontFamily: mn, fontSize: 9, color: color,
        cursor: "pointer",
        padding: "3px 8px",
        borderRadius: 6,
        border: "1px solid " + borderColor,
        background: (active || hover) && !danger ? D.amber + "08" : (hover && danger ? D.coral + "08" : "transparent"),
        userSelect: "none",
        transition: "all 0.15s ease",
        whiteSpace: "nowrap",
      }}
    >
      <Icon size={10} strokeWidth={2.4} />
      <span>{label}</span>
    </span>
  );
}

function EmptyState({ hasNotes }: { hasNotes: boolean }) {
  return (
    <div style={{
      padding: "40px 22px",
      textAlign: "center",
      border: "1px dashed " + D.border,
      borderRadius: 12,
      color: D.txm,
      fontFamily: ft, fontSize: 13,
      lineHeight: 1.55,
    }}>
      {hasNotes
        ? "No notes match the current filter."
        : "No notes yet. Capture ideas, articles, quotes, anything worth remembering."}
    </div>
  );
}
