"use client";

// Akash's personal Task Board.
//
// Five interchangeable views (List · Board · Calendar · Week · Focus), an
// inline quick-add bar with smart prefixes, filter chips, drag-and-drop
// reschedule/repri, pin, tags, sort, and keyboard shortcuts.
//
// Storage: Supabase under projects/akash-todo-master. Multi-board.
// Add modes preserved: Manual / Prompt (Claude parses prose) / Image
// (Claude vision extracts tasks).

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { D, ft, gf, mn } from "./shared-constants";
import { useUser, isAkash } from "./user-context";

type Priority = "HIGH" | "MEDIUM" | "THIS WEEK" | "ONGOING" | "DONE";
type AddMode = "manual" | "prompt" | "image";
type ViewType = "list" | "board" | "calendar" | "week" | "focus";
type SortType = "manual" | "due" | "added" | "alpha";
type FilterChip = "all" | "today" | "overdue" | "week" | "nodue" | "pinned";

interface Subtask {
  id: string;
  title: string;
  done?: boolean;
}

interface Task {
  id: string;
  title: string;
  description?: string;
  category: string;
  priority: Priority;
  dueDate?: string;
  notes?: string;
  done?: boolean;
  pinned?: boolean;
  tags?: string[];
  subtasks?: Subtask[];
  // ISO datetime — when the user time-blocked this task on the Daily
  // Planner. Drives where it renders in the hour timeline. May or may
  // not be the same day as dueDate (you can block tomorrow's work today).
  scheduledFor?: string;
  // Optional estimate in minutes, used by the planner to size the
  // timeline block. Defaults to 30 if not set.
  estimateMins?: number;
  source?: "manual" | "prompt" | "image" | "quick";
  addedAt: string;
  updatedAt?: string;
}

interface Board {
  id: string;
  name: string;
  description?: string;
  tasks: Task[];
  createdAt: string;
}

interface BoardArchive {
  boards: Board[];
  activeId: string;
}

const CATEGORIES = [
  "GRAPHIC DESIGN",
  "MARKETING OPS",
  "VIDEO PRODUCTION",
  "BRAND / IDENTITY",
  "DEV / ACCESS",
  "CONTENT OPS",
  "PODCAST",
  "EVENTS",
  "RESEARCH",
  "ADMIN",
  "OTHER",
];

const CATEGORY_COLORS: Record<string, string> = {
  "GRAPHIC DESIGN":   "#F7B041",
  "MARKETING OPS":    "#E06347",
  "VIDEO PRODUCTION": "#0B86D1",
  "BRAND / IDENTITY": "#2EAD8E",
  "DEV / ACCESS":     "#905CCB",
  "CONTENT OPS":      "#26C9D8",
  "PODCAST":          "#E06347",
  "EVENTS":           "#F7B041",
  "RESEARCH":         "#0B86D1",
  "ADMIN":            "#905CCB",
  "OTHER":            "#8A8690",
};

const PRIORITIES: Priority[] = ["HIGH", "MEDIUM", "THIS WEEK", "ONGOING", "DONE"];
const PRIORITY_COLORS: Record<Priority, string> = {
  "HIGH":      "#E06347",
  "MEDIUM":    "#F7B041",
  "THIS WEEK": "#0B86D1",
  "ONGOING":   "#8A8690",
  "DONE":      "#2EAD8E",
};

const VIEW_OPTIONS: Array<{ id: ViewType; label: string; hint: string }> = [
  { id: "list",     label: "List",     hint: "1" },
  { id: "board",    label: "Board",    hint: "2" },
  { id: "calendar", label: "Calendar", hint: "3" },
  { id: "week",     label: "Week",     hint: "4" },
  { id: "focus",    label: "Focus",    hint: "5" },
];

// ════════════════════════════════════════════════════════════════════
// Main component
// ════════════════════════════════════════════════════════════════════

export default function AkashTodo() {
  const userCtx = useUser();
  const allowed = isAkash(userCtx.user);

  const [archive, setArchive] = useState<BoardArchive>({ boards: [], activeId: "" });
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ViewType>("list");
  const [groupBy, setGroupBy] = useState<"priority" | "category" | "due">("priority");
  const [sortBy, setSortBy] = useState<SortType>("manual");
  const [showDone, setShowDone] = useState(false);
  const [filter, setFilter] = useState("");
  const [filterChip, setFilterChip] = useState<FilterChip>("all");
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [addingMode, setAddingMode] = useState<AddMode | null>(null);
  const [boardModalOpen, setBoardModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [focusModeTask, setFocusModeTask] = useState<Task | null>(null);
  const [quickAdd, setQuickAdd] = useState("");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveError, setSaveError] = useState<string | null>(null);

  const searchRef = useRef<HTMLInputElement>(null);
  const quickRef = useRef<HTMLInputElement>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedRef = useRef<string>("");
  const savedFlashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Load / persist ──────────────────────────────────────────────
  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/db?table=projects");
      const j = await res.json();
      const row = (j.data || []).find((r: { id: string; type: string }) => r.id === "akash-todo-master" && r.type === "akash-todo");
      const data: BoardArchive = row?.data || { boards: [], activeId: "" };
      if (!data.boards || data.boards.length === 0) {
        const def: Board = {
          id: "b-" + Date.now(),
          name: "May 2026",
          description: "Marketing + Production",
          tasks: [],
          createdAt: new Date().toISOString(),
        };
        data.boards = [def];
        data.activeId = def.id;
      }
      if (!data.activeId || !data.boards.find((b) => b.id === data.activeId)) {
        data.activeId = data.boards[0].id;
      }
      // Snapshot what we loaded so the auto-save effect doesn't fire on the
      // initial render purely from setArchive populating the value.
      lastSavedRef.current = JSON.stringify(data);
      setArchive(data);
    } catch { /* tolerate */ }
    setLoading(false);
  }, []);

  useEffect(() => { if (allowed) load(); }, [allowed, load]);

  // Auto-save: any change to `archive` after load triggers a debounced
  // write. We surface saving / saved / error so a silent Supabase failure
  // can't make changes look persisted when they aren't.
  const saveArchive = useCallback(async (next: BoardArchive) => {
    setSaveState("saving");
    setSaveError(null);
    try {
      const res = await fetch("/api/db", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          table: "projects",
          data: {
            id: "akash-todo-master",
            name: "Akash Todo",
            type: "akash-todo",
            data: next,
            updated_at: new Date().toISOString(),
          },
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setSaveError(j.error || `HTTP ${res.status}`);
        setSaveState("error");
        return;
      }
      lastSavedRef.current = JSON.stringify(next);
      setSaveState("saved");
      if (savedFlashTimerRef.current) clearTimeout(savedFlashTimerRef.current);
      savedFlashTimerRef.current = setTimeout(() => setSaveState((s) => s === "saved" ? "idle" : s), 1500);
    } catch (e) {
      setSaveError(String(e));
      setSaveState("error");
    }
  }, []);

  useEffect(() => {
    if (loading) return;
    const serialized = JSON.stringify(archive);
    if (serialized === lastSavedRef.current) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => { saveArchive(archive); }, 400);
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, [archive, loading, saveArchive]);

  const activeBoard = archive.boards.find((b) => b.id === archive.activeId);

  // Functional setter that always reads the latest committed `archive`,
  // so rapid sequential updates (quick-add, then a toggle, then a drag)
  // can never lose intermediate state via stale closure.
  function updateActiveBoard(patch: Partial<Board> | ((b: Board) => Board)) {
    setArchive((cur) => {
      const activeId = cur.activeId;
      if (!activeId) return cur;
      const idx = cur.boards.findIndex((b) => b.id === activeId);
      if (idx === -1) return cur;
      const current = cur.boards[idx];
      const next = typeof patch === "function" ? patch(current) : { ...current, ...patch };
      const boards = cur.boards.slice();
      boards[idx] = next;
      return { ...cur, boards };
    });
  }

  async function addTasks(newTasks: Omit<Task, "id" | "addedAt">[]) {
    const stamp = new Date().toISOString();
    const expanded: Task[] = newTasks.map((t, i) => ({
      ...t,
      id: "t-" + Date.now() + "-" + i,
      addedAt: stamp,
    }));
    updateActiveBoard((b) => ({ ...b, tasks: [...expanded, ...b.tasks] }));
    setAddingMode(null);
  }

  function updateTask(id: string, patch: Partial<Task>) {
    updateActiveBoard((b) => ({
      ...b,
      tasks: b.tasks.map((t) => (t.id === id ? { ...t, ...patch, updatedAt: new Date().toISOString() } : t)),
    }));
  }

  function removeTask(id: string) {
    updateActiveBoard((b) => ({ ...b, tasks: b.tasks.filter((t) => t.id !== id) }));
  }

  function submitQuickAdd() {
    const txt = quickAdd.trim();
    if (!txt) return;
    // Multi-line paste → group bullet/dash lines as subtasks of the
    // preceding non-bullet line. Each "parent" line gets its own smart-
    // prefix parse (!high, @category, due:, #tag). Bullets get attached
    // as subtasks (still get smart-prefix parsing on their title).
    const rawLines = txt.split(/\r?\n/);
    const groups = groupLinesIntoTasks(rawLines);
    if (groups.length > 1 || (groups.length === 1 && groups[0].subs.length > 0)) {
      const parsedTasks = groups.map((g) => {
        const parent = parseQuickAdd(g.parent);
        if (!parent.title) return null;
        const subs = g.subs.map((s) => parseQuickAdd(s).title).filter(Boolean);
        if (subs.length > 0) {
          parent.subtasks = subs.map((t, i) => ({
            id: "s-" + Date.now() + "-" + i + "-" + Math.random().toString(36).slice(2, 6),
            title: t,
            done: false,
          }));
        }
        return parent;
      }).filter((p): p is Omit<Task, "id" | "addedAt"> => p !== null);
      if (parsedTasks.length) addTasks(parsedTasks);
      setQuickAdd("");
      return;
    }
    const parsed = parseQuickAdd(txt);
    if (!parsed.title) return;
    addTasks([parsed]);
    setQuickAdd("");
  }

  // ── Filter pipeline ─────────────────────────────────────────────
  const allTags = useMemo(() => {
    const set = new Set<string>();
    (activeBoard?.tasks || []).forEach((t) => (t.tags || []).forEach((g) => set.add(g)));
    return Array.from(set).sort();
  }, [activeBoard]);

  const visibleTasks = useMemo(() => {
    if (!activeBoard) return [] as Task[];
    const q = filter.trim().toLowerCase();
    const today = startOfDay(new Date());
    const weekOut = new Date(today); weekOut.setDate(weekOut.getDate() + 7);
    return activeBoard.tasks.filter((t) => {
      if (!showDone && (t.done || t.priority === "DONE")) return false;
      if (q) {
        const hay = `${t.title} ${t.description || ""} ${t.category} ${t.notes || ""} ${(t.tags || []).join(" ")}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (tagFilter && !(t.tags || []).includes(tagFilter)) return false;
      if (filterChip === "today") {
        if (!t.dueDate) return false;
        const d = startOfDay(new Date(t.dueDate));
        if (isNaN(d.getTime())) return false;
        if (d.getTime() > today.getTime()) return false;
      } else if (filterChip === "overdue") {
        if (!t.dueDate) return false;
        const d = startOfDay(new Date(t.dueDate));
        if (isNaN(d.getTime()) || d >= today) return false;
      } else if (filterChip === "week") {
        if (!t.dueDate) return false;
        const d = startOfDay(new Date(t.dueDate));
        if (isNaN(d.getTime()) || d > weekOut) return false;
      } else if (filterChip === "nodue") {
        if (t.dueDate) return false;
      } else if (filterChip === "pinned") {
        if (!t.pinned) return false;
      }
      return true;
    });
  }, [activeBoard, filter, showDone, filterChip, tagFilter]);

  // ── Keyboard shortcuts ──────────────────────────────────────────
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement | null)?.tagName;
      const inText = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
      if (e.key === "Escape") {
        if (editingTask) { setEditingTask(null); return; }
        if (addingMode) { setAddingMode(null); return; }
        if (boardModalOpen) { setBoardModalOpen(false); return; }
      }
      if (inText) return;
      if (e.key === "/") { e.preventDefault(); searchRef.current?.focus(); return; }
      if (e.key === "n") { e.preventDefault(); quickRef.current?.focus(); return; }
      if (e.key === "N") { e.preventDefault(); setAddingMode("manual"); return; }
      if (e.key >= "1" && e.key <= "5") {
        const v = VIEW_OPTIONS[Number(e.key) - 1];
        if (v) setView(v.id);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editingTask, addingMode, boardModalOpen]);

  // ── Guard ───────────────────────────────────────────────────────
  if (!allowed) {
    return (
      <div style={{ maxWidth: 600, margin: "60px auto", padding: 24, textAlign: "center" }}>
        <div style={{ fontFamily: gf, fontSize: 22, color: D.tx, marginBottom: 8 }}>Akash only</div>
        <div style={{ fontFamily: ft, fontSize: 13, color: D.txm, lineHeight: 1.5 }}>
          This board is the Brand and Creative Director&apos;s personal queue. If you should have access, ping Akash.
        </div>
      </div>
    );
  }

  // Common task handlers passed into each view
  const taskHandlers = {
    onEdit: (t: Task) => setEditingTask(t),
    onToggleDone: (t: Task) => updateTask(t.id, { done: !t.done }),
    onTogglePin: (t: Task) => updateTask(t.id, { pinned: !t.pinned }),
    onMove: (id: string, patch: Partial<Task>) => updateTask(id, patch),
    onRemove: (id: string) => removeTask(id),
    onStartFocus: (t: Task) => setFocusModeTask(t),
  };

  // Counts per priority on full board (not filtered)
  const fullCounts = PRIORITIES.map((p) => ({
    p,
    n: (activeBoard?.tasks || []).filter((t) => (t.done ? "DONE" : t.priority) === p).length,
  }));

  return (
    <div style={{ maxWidth: 1280, margin: "0 auto", padding: "40px 32px" }}>
      {/* ── Header ──────────────────────────────────────────────── */}
      <div style={{ marginBottom: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "4px 10px", borderRadius: 999, background: "rgba(247,176,65,0.10)", border: `1px solid ${D.amber}55` }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: D.amber, boxShadow: `0 0 8px ${D.amber}` }} />
            <span style={{ fontFamily: mn, fontSize: 10, letterSpacing: 1.4, color: D.amber, textTransform: "uppercase" }}>
              Marketing + Production
            </span>
          </div>
          <SaveIndicator state={saveState} error={saveError} onRetry={() => saveArchive(archive)} />
        </div>
        <h1 style={{ fontFamily: ft, fontSize: 46, fontWeight: 900, letterSpacing: -1.6, margin: 0, marginBottom: 4, color: D.tx }}>
          Task Board{" "}
          <span style={{ background: "linear-gradient(120deg,#F7B041,#26C9D8,#F7B041)", backgroundSize: "200% 100%", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", animation: "tbShim 9s ease-in-out infinite" }}>
            {activeBoard?.name || ""}
          </span>
          <style dangerouslySetInnerHTML={{ __html: "@keyframes tbShim{0%,100%{background-position:0% 50%}50%{background-position:100% 50%}}" }} />
        </h1>
        <div style={{ fontFamily: ft, fontSize: 13, color: D.txm }}>
          SemiAnalysis Marketing · Akash Patel · 1-5 switch views · n quick-add · / search · Esc close
        </div>
      </div>

      {/* ── View switcher ──────────────────────────────────────── */}
      <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
        {VIEW_OPTIONS.map((v) => {
          const active = view === v.id;
          return (
            <button
              key={v.id}
              type="button"
              onClick={() => setView(v.id)}
              style={{
                padding: "8px 16px",
                background: active ? D.amber : "transparent",
                color: active ? "#060608" : D.tx,
                border: `1px solid ${active ? D.amber : D.border}`,
                borderRadius: 8,
                fontFamily: ft,
                fontSize: 13,
                fontWeight: active ? 800 : 500,
                cursor: "pointer",
                letterSpacing: 0.3,
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              {v.label}
              <span style={{ fontFamily: mn, fontSize: 9, opacity: active ? 0.7 : 0.5, padding: "1px 5px", border: `1px solid ${active ? "rgba(0,0,0,0.25)" : D.border}`, borderRadius: 3 }}>{v.hint}</span>
            </button>
          );
        })}
      </div>

      {/* ── Toolbar ────────────────────────────────────────────── */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginBottom: 10 }}>
        <select
          value={archive.activeId}
          onChange={(e) => setArchive((cur) => ({ ...cur, activeId: e.target.value }))}
          style={{ ...inputStyle, width: 200 }}
        >
          {archive.boards.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <button type="button" onClick={() => setBoardModalOpen(true)} style={ghostBtn}>+ Board</button>
        <input
          ref={searchRef}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter tasks… (/)"
          style={{ ...inputStyle, flex: 1, minWidth: 180 }}
        />
        {view === "list" || view === "board" ? (
          <select value={groupBy} onChange={(e) => setGroupBy(e.target.value as typeof groupBy)} style={{ ...inputStyle, width: 160 }}>
            <option value="priority">Group: Priority</option>
            <option value="category">Group: Category</option>
            {view === "list" ? <option value="due">Group: Due</option> : null}
          </select>
        ) : null}
        {view === "list" ? (
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value as SortType)} style={{ ...inputStyle, width: 150 }}>
            <option value="manual">Sort: Manual</option>
            <option value="due">Sort: Due ↑</option>
            <option value="added">Sort: Newest</option>
            <option value="alpha">Sort: A→Z</option>
          </select>
        ) : null}
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: mn, fontSize: 11, color: D.txm, cursor: "pointer" }}>
          <input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} style={{ accentColor: D.amber }} />
          Show done
        </label>
        <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
          <button type="button" onClick={() => setAddingMode("manual")} style={primaryBtn}>+ Task</button>
          <button type="button" onClick={() => setAddingMode("prompt")} style={ghostBtn}>From prompt</button>
          <button type="button" onClick={() => setAddingMode("image")} style={ghostBtn}>From image</button>
        </div>
      </div>

      {/* ── Filter chips ───────────────────────────────────────── */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center", marginBottom: 10 }}>
        {[
          { id: "all", label: "All" },
          { id: "today", label: "Today + overdue" },
          { id: "overdue", label: "Overdue" },
          { id: "week", label: "This week" },
          { id: "nodue", label: "No date" },
          { id: "pinned", label: "★ Pinned" },
        ].map((c) => {
          const active = filterChip === c.id;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => setFilterChip(c.id as FilterChip)}
              style={{
                padding: "5px 12px",
                background: active ? "rgba(247,176,65,0.16)" : "transparent",
                color: active ? D.amber : D.txm,
                border: `1px solid ${active ? D.amber : D.border}`,
                borderRadius: 999,
                fontFamily: mn,
                fontSize: 10.5,
                fontWeight: 600,
                cursor: "pointer",
                letterSpacing: 0.4,
              }}
            >
              {c.label}
            </button>
          );
        })}
        {allTags.length > 0 ? (
          <>
            <div style={{ width: 1, height: 20, background: D.border, margin: "0 4px" }} />
            {allTags.map((tag) => {
              const active = tagFilter === tag;
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => setTagFilter(active ? null : tag)}
                  style={{
                    padding: "5px 10px",
                    background: active ? D.violet + "22" : "transparent",
                    color: active ? D.violet : D.txm,
                    border: `1px solid ${active ? D.violet : D.border}`,
                    borderRadius: 999,
                    fontFamily: mn,
                    fontSize: 10.5,
                    cursor: "pointer",
                    letterSpacing: 0.4,
                  }}
                >
                  #{tag}
                </button>
              );
            })}
          </>
        ) : null}
      </div>

      {/* ── Quick add ──────────────────────────────────────────── */}
      <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 18, background: D.surface, border: `1px solid ${D.border}`, borderRadius: 10, padding: "6px 6px 6px 14px" }}>
        <span style={{ fontFamily: mn, fontSize: 11, color: D.amber, letterSpacing: 0.6 }}>＋</span>
        <input
          ref={quickRef}
          value={quickAdd}
          onChange={(e) => setQuickAdd(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") submitQuickAdd(); }}
          onPaste={(e) => {
            // Multi-line paste shortcut. Detects bullet/dash/numbered
            // children and folds them into subtasks of the preceding
            // parent line. Top-level bullets without a parent become
            // their own tasks.
            const txt = e.clipboardData.getData("text");
            if (txt && /\r?\n/.test(txt.trim())) {
              e.preventDefault();
              const groups = groupLinesIntoTasks(txt.split(/\r?\n/));
              const parsedTasks = groups.map((g) => {
                const parent = parseQuickAdd(g.parent);
                if (!parent.title) return null;
                const subs = g.subs.map((s) => parseQuickAdd(s).title).filter(Boolean);
                if (subs.length > 0) {
                  parent.subtasks = subs.map((t, i) => ({
                    id: "s-" + Date.now() + "-" + i + "-" + Math.random().toString(36).slice(2, 6),
                    title: t,
                    done: false,
                  }));
                }
                return parent;
              }).filter((p): p is Omit<Task, "id" | "addedAt"> => p !== null);
              if (parsedTasks.length) { addTasks(parsedTasks); setQuickAdd(""); }
            }
          }}
          placeholder='Quick add · paste multiple lines for batch · "Redo ribbons !high @design due:wed #ribbons" · Enter to add'
          style={{ ...inputStyle, border: "none", background: "transparent", padding: "8px 6px" }}
        />
        <button type="button" onClick={submitQuickAdd} disabled={!quickAdd.trim()} style={{ ...primaryBtn, opacity: quickAdd.trim() ? 1 : 0.4, padding: "7px 14px" }}>Add</button>
      </div>

      {/* ── Counters ───────────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8, marginBottom: 20 }}>
        {fullCounts.map(({ p, n }) => {
          const color = PRIORITY_COLORS[p];
          return (
            <div key={p} style={{ background: D.surface, border: `1px solid ${D.border}`, borderRadius: 10, padding: "10px 14px" }}>
              <div style={{ fontFamily: mn, fontSize: 9, letterSpacing: 1.2, textTransform: "uppercase", color: D.txd, marginBottom: 4 }}>{p}</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                <span style={{ fontFamily: gf, fontSize: 24, fontWeight: 900, color, letterSpacing: -0.8, lineHeight: 1 }}>{n}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── View body ──────────────────────────────────────────── */}
      {loading ? (
        <SkeletonView />
      ) : visibleTasks.length === 0 && view !== "calendar" && view !== "week" ? (
        <div style={emptyBox}>
          {filter || filterChip !== "all" || tagFilter
            ? "No tasks match the current filters."
            : "No tasks yet. Type something into Quick Add, paste a Slack thread into From Prompt, or drop a screenshot into From Image."}
        </div>
      ) : view === "list" ? (
        <ListView tasks={visibleTasks} groupBy={groupBy} sortBy={sortBy} handlers={taskHandlers} />
      ) : view === "board" ? (
        <BoardView tasks={visibleTasks} groupBy={groupBy === "due" ? "priority" : groupBy} handlers={taskHandlers} />
      ) : view === "calendar" ? (
        <CalendarView tasks={visibleTasks} handlers={taskHandlers} />
      ) : view === "week" ? (
        <WeekView tasks={visibleTasks} handlers={taskHandlers} />
      ) : (
        <FocusView tasks={visibleTasks} handlers={taskHandlers} />
      )}

      {/* ── Modals ─────────────────────────────────────────────── */}
      {addingMode ? (
        <AddTaskModal
          mode={addingMode}
          onCancel={() => setAddingMode(null)}
          onAdd={addTasks}
          onSwitchMode={setAddingMode}
        />
      ) : null}
      {boardModalOpen ? (
        <BoardModal
          archive={archive}
          onCancel={() => setBoardModalOpen(false)}
          onSave={(next) => { setArchive(next); setBoardModalOpen(false); }}
        />
      ) : null}
      {editingTask ? (
        <EditTaskModal
          task={editingTask}
          onCancel={() => setEditingTask(null)}
          onSave={(patch) => { updateTask(editingTask.id, patch); setEditingTask(null); }}
          onRemove={() => { if (confirm("Remove this task?")) { removeTask(editingTask.id); setEditingTask(null); } }}
        />
      ) : null}
      {focusModeTask ? (
        <FocusMode
          task={
            // Always read the fresh task from state so subtask toggles
            // inside Focus Mode reflect immediately.
            activeBoard?.tasks.find((t) => t.id === focusModeTask.id) || focusModeTask
          }
          onClose={() => setFocusModeTask(null)}
          onUpdate={(patch) => updateTask(focusModeTask.id, patch)}
          onComplete={() => {
            updateTask(focusModeTask.id, { done: true });
            // Auto-pick next unfinished task scheduled today, then today
            // by due date, then any priority HIGH task.
            const all = activeBoard?.tasks || [];
            const todayIso = isoDate(startOfDay(new Date()));
            const next = all.find((t) => !t.done && t.id !== focusModeTask.id && t.scheduledFor && isoDate(new Date(t.scheduledFor)) === todayIso)
              || all.find((t) => !t.done && t.id !== focusModeTask.id && t.dueDate === todayIso)
              || all.find((t) => !t.done && t.id !== focusModeTask.id && t.priority === "HIGH");
            setFocusModeTask(next || null);
          }}
          onSkipToNext={() => {
            const all = activeBoard?.tasks || [];
            const todayIso = isoDate(startOfDay(new Date()));
            const next = all.find((t) => !t.done && t.id !== focusModeTask.id && t.scheduledFor && isoDate(new Date(t.scheduledFor)) === todayIso)
              || all.find((t) => !t.done && t.id !== focusModeTask.id && t.dueDate === todayIso)
              || all.find((t) => !t.done && t.id !== focusModeTask.id);
            setFocusModeTask(next || null);
          }}
        />
      ) : null}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// Views
// ════════════════════════════════════════════════════════════════════

interface Handlers {
  onEdit: (t: Task) => void;
  onToggleDone: (t: Task) => void;
  onTogglePin: (t: Task) => void;
  onMove: (id: string, patch: Partial<Task>) => void;
  onRemove: (id: string) => void;
  onStartFocus: (t: Task) => void;
}

// ── List view ──────────────────────────────────────────────────────
function ListView({ tasks, groupBy, sortBy, handlers }: { tasks: Task[]; groupBy: "priority" | "category" | "due"; sortBy: SortType; handlers: Handlers }) {
  const sorted = useMemo(() => sortTasks(tasks, sortBy), [tasks, sortBy]);
  const pinned = sorted.filter((t) => t.pinned);
  const rest = sorted.filter((t) => !t.pinned);
  const grouped = useMemo(() => groupTasks(rest, groupBy), [rest, groupBy]);

  // Translate a drop on a group header into the right field patch:
  //   priority groups  → { priority: HIGH | MEDIUM | THIS WEEK | ONGOING | DONE, done: false (except DONE) }
  //   category groups  → { category: <name> }
  //   due groups       → relative dueDate (today / +3d / +14d / undefined)
  function patchForGroup(key: string): Partial<Task> | null {
    if (groupBy === "priority") {
      const p = key as Priority;
      if (PRIORITIES.includes(p)) {
        return p === "DONE" ? { done: true } : { priority: p, done: false };
      }
      return null;
    }
    if (groupBy === "category") {
      return { category: key };
    }
    if (groupBy === "due") {
      const today = startOfDay(new Date());
      if (key === "Overdue") { const d = new Date(today); d.setDate(d.getDate() - 1); return { dueDate: isoDate(d) }; }
      if (key === "This week") { const d = new Date(today); d.setDate(d.getDate() + 3); return { dueDate: isoDate(d) }; }
      if (key === "Later") { const d = new Date(today); d.setDate(d.getDate() + 14); return { dueDate: isoDate(d) }; }
      if (key === "No due date") return { dueDate: undefined };
    }
    return null;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {pinned.length > 0 ? (
        <DropGroup
          label="★ Pinned"
          color={D.amber}
          count={pinned.length}
          onDropTask={(id) => handlers.onMove(id, { pinned: true })}
          hint="drop a task here to pin it"
        >
          {pinned.map((t) => <TaskRow key={t.id} task={t} handlers={handlers} />)}
        </DropGroup>
      ) : null}
      {grouped.map(({ key, tasks: gts }) => (
        <DropGroup
          key={key}
          label={key}
          color={groupBy === "priority" ? (PRIORITY_COLORS[key as Priority] || D.txd) : null}
          count={gts.length}
          onDropTask={(id) => { const patch = patchForGroup(key); if (patch) handlers.onMove(id, patch); }}
          hint={`drop here to move to "${key}"`}
        >
          {gts.map((t) => <TaskRow key={t.id} task={t} handlers={handlers} />)}
        </DropGroup>
      ))}
      {grouped.length === 0 && pinned.length === 0 ? (
        <div style={emptyBox}>No tasks match the current filters.</div>
      ) : null}
    </div>
  );
}

// Wraps a list group so the entire group (header + rows + a small drop
// strip below) accepts a drop. Dropping moves the task into that group
// (changes priority / category / due bucket / pinned).
function DropGroup({ label, color, count, onDropTask, hint, children }: { label: string; color: string | null; count: number; onDropTask: (id: string) => void; hint: string; children: React.ReactNode }) {
  const [over, setOver] = useState(false);
  return (
    <div
      onDragOver={(e) => { e.preventDefault(); if (!over) setOver(true); }}
      onDragLeave={(e) => {
        // Only clear when the drag actually leaves the group (not when
        // moving between child elements). currentTarget.contains check
        // would require a ref; the relatedTarget approach is good enough.
        const next = e.relatedTarget as Node | null;
        if (!next || !(e.currentTarget as HTMLDivElement).contains(next)) setOver(false);
      }}
      onDrop={(e) => { e.preventDefault(); setOver(false); const id = e.dataTransfer.getData("text/plain"); if (id) onDropTask(id); }}
      style={{
        padding: over ? "6px 8px" : "0px",
        margin: over ? "-6px -8px" : "0px",
        borderRadius: 10,
        background: over ? "rgba(247,176,65,0.05)" : "transparent",
        outline: over ? `1px dashed ${D.amber}55` : "none",
        transition: "background 0.12s",
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 8 }}>
        <div style={{ fontFamily: mn, fontSize: 10, letterSpacing: 1.4, textTransform: "uppercase", color: color || D.txd, display: "flex", alignItems: "center", gap: 8 }}>
          {color ? <span style={{ width: 8, height: 8, borderRadius: "50%", background: color }} /> : null}
          {label}
          {over ? <span style={{ fontFamily: mn, fontSize: 9, color: D.amber, letterSpacing: 0.6 }}>· {hint}</span> : null}
        </div>
        <span style={{ fontFamily: mn, fontSize: 10, color: D.txd, letterSpacing: 0.4 }}>{count}</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>{children}</div>
    </div>
  );
}

function TaskRow({ task, handlers }: { task: Task; handlers: Handlers }) {
  const pColor = PRIORITY_COLORS[(task.done ? "DONE" : task.priority) as Priority] || D.txd;
  const cColor = CATEGORY_COLORS[task.category] || D.txm;
  const due = formatDue(task.dueDate);
  const [hover, setHover] = useState(false);
  const [priorityMenuOpen, setPriorityMenuOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [renameDraft, setRenameDraft] = useState(task.title);
  const [expanded, setExpanded] = useState(false);

  const subtasks = task.subtasks || [];
  const totalSubs = subtasks.length;
  const doneSubs = subtasks.filter((s) => s.done).length;
  const hasSubs = totalSubs > 0;

  function pickPriority(p: Priority) {
    setPriorityMenuOpen(false);
    if (p === "DONE") handlers.onMove(task.id, { done: true });
    else handlers.onMove(task.id, { priority: p, done: false });
  }

  function commitRename() {
    const next = renameDraft.trim();
    setRenaming(false);
    if (next && next !== task.title) handlers.onMove(task.id, { title: next });
    else setRenameDraft(task.title);
  }

  function toggleSubtask(id: string) {
    const nextSubs = subtasks.map((s) => s.id === id ? { ...s, done: !s.done } : s);
    handlers.onMove(task.id, { subtasks: nextSubs });
  }

  function addSubtask(title: string) {
    const t = title.trim();
    if (!t) return;
    const id = "s-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6);
    handlers.onMove(task.id, { subtasks: [...subtasks, { id, title: t, done: false }] });
  }

  function removeSubtask(id: string) {
    handlers.onMove(task.id, { subtasks: subtasks.filter((s) => s.id !== id) });
  }

  return (
    <div
      style={{
        background: D.surface,
        border: `1px solid ${hover ? D.amber + "44" : D.border}`,
        borderRadius: 10,
        opacity: task.done ? 0.55 : 1,
        position: "relative",
        // When the priority popover is open, lift the whole row above
        // its siblings so the popover doesn't sit behind the next row.
        // (The hover `transform` below creates a stacking context, so
        // we need to raise zIndex here, not on the inner popover.)
        zIndex: priorityMenuOpen ? 50 : "auto",
        transition: "border-color 0.15s, box-shadow 0.15s, transform 0.15s",
        boxShadow: hover ? "0 4px 12px rgba(0,0,0,0.25)" : "none",
        // Skip the hover lift while the menu is open so we don't create
        // a new stacking context that would re-trap the popover.
        transform: hover && !priorityMenuOpen ? "translateY(-1px)" : "translateY(0)",
        animation: "tbRowIn 0.2s ease",
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => { setHover(false); setPriorityMenuOpen(false); }}
    >
      <style dangerouslySetInnerHTML={{ __html: "@keyframes tbRowIn{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:translateY(0)}}" }} />
      <div
        draggable={!renaming}
        onDragStart={(e) => e.dataTransfer.setData("text/plain", task.id)}
        onClick={(e) => { if (renaming) return; if ((e.target as HTMLElement).closest("[data-no-row-click]")) return; handlers.onEdit(task); }}
        style={{
          padding: "9px 14px",
          display: "flex",
          alignItems: "center",
          gap: 12,
          cursor: renaming ? "text" : "grab",
        }}
      >
        <button
          type="button"
          data-no-row-click
          onClick={(e) => { e.stopPropagation(); handlers.onToggleDone(task); }}
          title={task.done ? "Mark as not done" : "Mark as done"}
          style={{
            width: 14, height: 14, borderRadius: "50%",
            background: task.done ? D.teal : "transparent",
            border: `2px solid ${task.done ? D.teal : pColor}`,
            boxShadow: !task.done ? `0 0 6px ${pColor}66` : "none",
            cursor: "pointer", flexShrink: 0, padding: 0,
          }}
        />
        <div style={{
          fontFamily: mn, fontSize: 9, letterSpacing: 1.2, textTransform: "uppercase",
          fontWeight: 700, color: cColor, background: cColor + "1c", border: `1px solid ${cColor}55`,
          padding: "3px 10px", borderRadius: 4, flexShrink: 0, minWidth: 110, textAlign: "center",
        }}>
          {task.category}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {renaming ? (
              <input
                data-no-row-click
                autoFocus
                value={renameDraft}
                onChange={(e) => setRenameDraft(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                onBlur={commitRename}
                onKeyDown={(e) => {
                  if (e.key === "Enter") { e.preventDefault(); commitRename(); }
                  if (e.key === "Escape") { setRenameDraft(task.title); setRenaming(false); }
                }}
                style={{ flex: 1, minWidth: 0, background: D.bg, color: D.tx, border: `1px solid ${D.amber}`, borderRadius: 4, padding: "3px 8px", fontFamily: gf, fontSize: 14, fontWeight: 700, outline: "none" }}
              />
            ) : (
              <span
                data-no-row-click
                onClick={(e) => { e.stopPropagation(); setRenameDraft(task.title); setRenaming(true); }}
                title="Click to rename"
                style={{ fontFamily: gf, fontSize: 14, fontWeight: 700, color: D.tx, letterSpacing: -0.3, textDecoration: task.done ? "line-through" : "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", cursor: "text", padding: "1px 2px", borderRadius: 3 }}
              >
                {task.title}
              </span>
            )}
            {(task.tags || []).map((tag) => (
              <span key={tag} style={{ fontFamily: mn, fontSize: 9, color: D.violet, background: D.violet + "1c", border: `1px solid ${D.violet}55`, padding: "1px 6px", borderRadius: 3, letterSpacing: 0.4 }}>#{tag}</span>
            ))}
          </div>
          {task.description ? (
            <div style={{ fontFamily: ft, fontSize: 11.5, color: D.txm, marginTop: 2, lineHeight: 1.4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {task.description}
            </div>
          ) : null}
        </div>

        {hasSubs ? (
          <button
            type="button"
            data-no-row-click
            onClick={(e) => { e.stopPropagation(); setExpanded((v) => !v); }}
            title={`${doneSubs} of ${totalSubs} subtasks done`}
            style={{
              fontFamily: mn, fontSize: 9, letterSpacing: 0.6,
              padding: "3px 8px", borderRadius: 4,
              background: doneSubs === totalSubs ? D.teal + "1c" : D.violet + "1c",
              color: doneSubs === totalSubs ? D.teal : D.violet,
              border: `1px solid ${(doneSubs === totalSubs ? D.teal : D.violet)}55`,
              cursor: "pointer", flexShrink: 0, lineHeight: 1.4,
              display: "inline-flex", alignItems: "center", gap: 4,
            }}
          >
            <span style={{ fontSize: 8 }}>{expanded ? "▾" : "▸"}</span>
            {doneSubs}/{totalSubs}
          </button>
        ) : null}
      {/* Quick priority change — click the pill to open a popover. */}
      <div style={{ position: "relative", flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          onClick={() => setPriorityMenuOpen((v) => !v)}
          title={`Priority: ${task.done ? "DONE" : task.priority} — click to change`}
          style={{
            fontFamily: mn, fontSize: 9, letterSpacing: 1, textTransform: "uppercase",
            fontWeight: 700, color: pColor, background: pColor + "1c", border: `1px solid ${pColor}55`,
            padding: "3px 8px", borderRadius: 4, cursor: "pointer", lineHeight: 1.4,
          }}
        >
          {task.done ? "DONE" : task.priority}
        </button>
        {priorityMenuOpen ? (
          <div style={{ position: "absolute", top: "calc(100% + 6px)", right: 0, background: D.bg, border: `1px solid ${D.border}`, borderRadius: 8, padding: 4, zIndex: 100, boxShadow: "0 6px 24px rgba(0,0,0,0.4)", display: "flex", flexDirection: "column", gap: 2, minWidth: 110 }}>
            {PRIORITIES.map((p) => {
              const c = PRIORITY_COLORS[p];
              const active = (task.done ? "DONE" : task.priority) === p;
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => pickPriority(p)}
                  style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 8px", background: active ? c + "22" : "transparent", color: active ? c : D.tx, border: "none", borderRadius: 4, fontFamily: mn, fontSize: 10, letterSpacing: 0.6, cursor: "pointer", textAlign: "left" }}
                >
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: c }} />
                  {p}
                </button>
              );
            })}
          </div>
        ) : null}
      </div>

      {/* Edit button — always present so it's discoverable; muted until hover. */}
      <button
        type="button"
        data-no-row-click
        onClick={(e) => { e.stopPropagation(); handlers.onEdit(task); }}
        title="Edit task"
        style={{ background: "transparent", border: `1px solid ${hover ? D.border : "transparent"}`, color: hover ? D.tx : D.txd, fontFamily: mn, fontSize: 9, letterSpacing: 0.6, cursor: "pointer", padding: "3px 8px", borderRadius: 4, lineHeight: 1.4, flexShrink: 0, textTransform: "uppercase", fontWeight: 700 }}
      >
        Edit
      </button>

      <button
        type="button"
        data-no-row-click
        onClick={(e) => { e.stopPropagation(); handlers.onTogglePin(task); }}
        title={task.pinned ? "Unpin" : "Pin"}
        style={{ background: "transparent", border: "none", color: task.pinned ? D.amber : D.txd, fontSize: 14, cursor: "pointer", padding: 0, lineHeight: 1 }}
      >
        {task.pinned ? "★" : "☆"}
      </button>
      {due ? (
        <div style={{ fontFamily: mn, fontSize: 10, color: due.urgent ? D.coral : D.txm, letterSpacing: 0.4, flexShrink: 0, minWidth: 60, textAlign: "right" }}>
          {due.label}
        </div>
      ) : null}
      </div>
      {/* Expanded subtask checklist — collapsed by default; toggles via the
          progress pill. Adding/removing/toggling all auto-saves through
          the standard handlers. */}
      {expanded ? (
        <div
          data-no-row-click
          onClick={(e) => e.stopPropagation()}
          style={{ padding: "4px 14px 12px 44px", borderTop: `1px solid ${D.border}`, display: "flex", flexDirection: "column", gap: 4 }}
        >
          {subtasks.map((s) => (
            <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button
                type="button"
                onClick={() => toggleSubtask(s.id)}
                title={s.done ? "Mark not done" : "Mark done"}
                style={{ width: 12, height: 12, borderRadius: 3, background: s.done ? D.teal : "transparent", border: `1.5px solid ${s.done ? D.teal : D.border}`, cursor: "pointer", padding: 0, flexShrink: 0 }}
              />
              <span style={{ flex: 1, fontFamily: ft, fontSize: 12.5, color: s.done ? D.txd : D.tx, textDecoration: s.done ? "line-through" : "none", lineHeight: 1.4 }}>{s.title}</span>
              <button
                type="button"
                onClick={() => removeSubtask(s.id)}
                title="Remove subtask"
                style={{ background: "transparent", border: "none", color: D.txd, fontFamily: mn, fontSize: 11, cursor: "pointer", padding: "0 4px", opacity: 0.6 }}
              >×</button>
            </div>
          ))}
          <SubtaskInlineAdd onAdd={addSubtask} />
        </div>
      ) : null}
    </div>
  );
}

function SubtaskInlineAdd({ onAdd }: { onAdd: (t: string) => void }) {
  const [v, setV] = useState("");
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 2 }}>
      <span style={{ width: 12, height: 12, borderRadius: 3, border: `1.5px dashed ${D.border}`, flexShrink: 0 }} />
      <input
        value={v}
        onChange={(e) => setV(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") { e.preventDefault(); if (v.trim()) { onAdd(v.trim()); setV(""); } }
          if (e.key === "Escape") { setV(""); (e.target as HTMLInputElement).blur(); }
        }}
        placeholder="+ Add subtask, Enter to save"
        style={{ flex: 1, background: "transparent", color: D.tx, border: "none", outline: "none", fontFamily: ft, fontSize: 12.5, padding: "2px 0", lineHeight: 1.4 }}
      />
    </div>
  );
}

// ── Board view (Kanban) ────────────────────────────────────────────
function BoardView({ tasks, groupBy, handlers }: { tasks: Task[]; groupBy: "priority" | "category"; handlers: Handlers }) {
  const cols = groupBy === "priority"
    ? PRIORITIES.filter((p) => p !== "DONE").map((p) => ({ key: p, color: PRIORITY_COLORS[p] }))
    : CATEGORIES.map((c) => ({ key: c, color: CATEGORY_COLORS[c] || D.txm }));

  function dropPatch(colKey: string): Partial<Task> {
    return groupBy === "priority" ? { priority: colKey as Priority, done: false } : { category: colKey };
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(cols.length, 4)}, 1fr)`, gap: 12, overflowX: "auto" }}>
      {cols.map((col) => {
        const colTasks = tasks.filter((t) => (groupBy === "priority" ? (t.done ? "DONE" : t.priority) === col.key : t.category === col.key));
        return (
          <BoardColumn
            key={col.key}
            label={col.key}
            color={col.color}
            tasks={colTasks}
            onDropTask={(id) => handlers.onMove(id, dropPatch(col.key))}
            handlers={handlers}
          />
        );
      })}
    </div>
  );
}

function BoardColumn({ label, color, tasks, onDropTask, handlers }: { label: string; color: string; tasks: Task[]; onDropTask: (id: string) => void; handlers: Handlers }) {
  const [over, setOver] = useState(false);
  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); const id = e.dataTransfer.getData("text/plain"); if (id) onDropTask(id); }}
      style={{
        background: over ? "rgba(247,176,65,0.06)" : D.surface,
        border: `1px solid ${over ? D.amber : D.border}`,
        borderRadius: 10, padding: 10, minHeight: 220,
        transition: "background 0.12s, border-color 0.12s",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: color }} />
        <span style={{ fontFamily: mn, fontSize: 10, letterSpacing: 1.2, color: D.tx, textTransform: "uppercase", fontWeight: 700 }}>{label}</span>
        <span style={{ marginLeft: "auto", fontFamily: mn, fontSize: 10, color: D.txd }}>{tasks.length}</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {tasks.map((t) => <BoardCard key={t.id} task={t} handlers={handlers} />)}
        {tasks.length === 0 ? <div style={{ fontFamily: mn, fontSize: 10, color: D.txd, padding: 8, textAlign: "center" }}>Drop here</div> : null}
      </div>
    </div>
  );
}

function BoardCard({ task, handlers }: { task: Task; handlers: Handlers }) {
  const cColor = CATEGORY_COLORS[task.category] || D.txm;
  const pColor = PRIORITY_COLORS[(task.done ? "DONE" : task.priority) as Priority] || D.txd;
  const due = formatDue(task.dueDate);
  return (
    <div
      draggable
      onDragStart={(e) => e.dataTransfer.setData("text/plain", task.id)}
      onClick={() => handlers.onEdit(task)}
      style={{
        background: D.bg,
        border: `1px solid ${D.border}`,
        borderLeft: `3px solid ${pColor}`,
        borderRadius: 8,
        padding: "8px 10px",
        cursor: "pointer",
        opacity: task.done ? 0.55 : 1,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
        <span style={{ fontFamily: mn, fontSize: 8.5, color: cColor, letterSpacing: 0.8, textTransform: "uppercase", padding: "1px 6px", border: `1px solid ${cColor}55`, borderRadius: 3 }}>{task.category}</span>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); handlers.onTogglePin(task); }}
          title={task.pinned ? "Unpin" : "Pin"}
          style={{ marginLeft: "auto", background: "transparent", border: "none", color: task.pinned ? D.amber : D.txd, fontSize: 11, cursor: "pointer", padding: 0, lineHeight: 1 }}
        >
          {task.pinned ? "★" : "☆"}
        </button>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); handlers.onToggleDone(task); }}
          style={{ width: 11, height: 11, borderRadius: "50%", background: task.done ? D.teal : "transparent", border: `2px solid ${task.done ? D.teal : pColor}`, cursor: "pointer", padding: 0 }}
        />
      </div>
      <div style={{ fontFamily: gf, fontSize: 12.5, fontWeight: 700, color: D.tx, letterSpacing: -0.2, marginBottom: 4, textDecoration: task.done ? "line-through" : "none", lineHeight: 1.3 }}>
        {task.title}
      </div>
      {task.description ? (
        <div style={{ fontFamily: ft, fontSize: 11, color: D.txm, lineHeight: 1.4, marginBottom: 6, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
          {task.description}
        </div>
      ) : null}
      {(task.tags || []).length > 0 || due || (task.subtasks && task.subtasks.length > 0) ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, alignItems: "center" }}>
          {(task.tags || []).map((tag) => (
            <span key={tag} style={{ fontFamily: mn, fontSize: 8.5, color: D.violet, background: D.violet + "1c", padding: "1px 5px", borderRadius: 3, letterSpacing: 0.4 }}>#{tag}</span>
          ))}
          {task.subtasks && task.subtasks.length > 0 ? (() => {
            const tot = task.subtasks.length;
            const done = task.subtasks.filter((s) => s.done).length;
            const all = done === tot;
            const c = all ? D.teal : D.violet;
            return <span style={{ fontFamily: mn, fontSize: 8.5, color: c, background: c + "1c", padding: "1px 5px", borderRadius: 3, letterSpacing: 0.4, border: `1px solid ${c}55` }}>☑ {done}/{tot}</span>;
          })() : null}
          {due ? <span style={{ marginLeft: "auto", fontFamily: mn, fontSize: 9, color: due.urgent ? D.coral : D.txm, letterSpacing: 0.4 }}>{due.label}</span> : null}
        </div>
      ) : null}
    </div>
  );
}

// ── Calendar view (month) ──────────────────────────────────────────
function CalendarView({ tasks, handlers }: { tasks: Task[]; handlers: Handlers }) {
  const [anchor, setAnchor] = useState(() => { const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); return d; });
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const days = useMemo(() => buildMonthGrid(anchor), [anchor]);
  const byDay = useMemo(() => {
    const m = new Map<string, Task[]>();
    tasks.forEach((t) => {
      if (!t.dueDate) return;
      const key = t.dueDate;
      (m.get(key) || m.set(key, []).get(key)!).push(t);
    });
    return m;
  }, [tasks]);

  const monthLabel = anchor.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const today = isoDate(startOfDay(new Date()));
  const noDate = tasks.filter((t) => !t.dueDate);

  function shift(months: number) {
    const d = new Date(anchor); d.setMonth(d.getMonth() + months); setAnchor(d);
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <button type="button" onClick={() => shift(-1)} style={ghostBtn}>‹</button>
        <button type="button" onClick={() => { const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); setAnchor(d); }} style={ghostBtn}>Today</button>
        <button type="button" onClick={() => shift(1)} style={ghostBtn}>›</button>
        <div style={{ fontFamily: gf, fontSize: 22, fontWeight: 800, color: D.tx, letterSpacing: -0.6 }}>{monthLabel}</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, marginBottom: 4 }}>
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d} style={{ fontFamily: mn, fontSize: 10, letterSpacing: 1.2, color: D.txd, textAlign: "center", padding: "4px 0", textTransform: "uppercase" }}>{d}</div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
        {days.map(({ date, inMonth }) => {
          const iso = isoDate(date);
          const cellTasks = byDay.get(iso) || [];
          const isToday = iso === today;
          return (
            <CalendarCell
              key={iso}
              date={date}
              isToday={isToday}
              inMonth={inMonth}
              tasks={cellTasks}
              onDrop={(id) => handlers.onMove(id, { dueDate: iso })}
              onSelect={() => setSelectedDay(iso)}
              onEdit={handlers.onEdit}
            />
          );
        })}
      </div>

      {/* Unscheduled bucket */}
      {noDate.length > 0 ? (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontFamily: mn, fontSize: 10, letterSpacing: 1.4, color: D.txd, textTransform: "uppercase", marginBottom: 8 }}>Unscheduled · drag to a date</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {noDate.map((t) => (
              <div
                key={t.id}
                draggable
                onDragStart={(e) => e.dataTransfer.setData("text/plain", t.id)}
                onClick={() => handlers.onEdit(t)}
                style={{ background: D.surface, border: `1px solid ${D.border}`, borderLeft: `3px solid ${PRIORITY_COLORS[t.priority]}`, borderRadius: 6, padding: "5px 10px", cursor: "grab", fontFamily: ft, fontSize: 12, color: D.tx }}
              >
                {t.title}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* Day-detail popover */}
      {selectedDay ? (
        <DayDetailModal
          iso={selectedDay}
          tasks={byDay.get(selectedDay) || []}
          onClose={() => setSelectedDay(null)}
          handlers={handlers}
        />
      ) : null}
    </div>
  );
}

function CalendarCell({ date, isToday, inMonth, tasks, onDrop, onSelect, onEdit }: { date: Date; isToday: boolean; inMonth: boolean; tasks: Task[]; onDrop: (id: string) => void; onSelect: () => void; onEdit: (t: Task) => void }) {
  const [over, setOver] = useState(false);
  const max = 3;
  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); const id = e.dataTransfer.getData("text/plain"); if (id) onDrop(id); }}
      onClick={onSelect}
      style={{
        background: over ? "rgba(247,176,65,0.08)" : (inMonth ? D.surface : D.bg),
        border: `1px solid ${over ? D.amber : (isToday ? D.amber : D.border)}`,
        borderRadius: 8,
        minHeight: 96,
        padding: 6,
        cursor: "pointer",
        opacity: inMonth ? 1 : 0.4,
        display: "flex", flexDirection: "column",
      }}
    >
      <div style={{ fontFamily: mn, fontSize: 11, color: isToday ? D.amber : D.tx, fontWeight: isToday ? 800 : 500, letterSpacing: 0.4, marginBottom: 4 }}>
        {date.getDate()}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 3, flex: 1, overflow: "hidden" }}>
        {tasks.slice(0, max).map((t) => {
          const c = PRIORITY_COLORS[t.done ? "DONE" : t.priority];
          return (
            <div
              key={t.id}
              draggable
              onDragStart={(e) => { e.stopPropagation(); e.dataTransfer.setData("text/plain", t.id); }}
              onClick={(e) => { e.stopPropagation(); onEdit(t); }}
              style={{
                background: c + "1f",
                borderLeft: `2px solid ${c}`,
                fontFamily: ft, fontSize: 10.5,
                color: D.tx,
                padding: "2px 5px",
                borderRadius: 3,
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                textDecoration: t.done ? "line-through" : "none",
                opacity: t.done ? 0.55 : 1,
              }}
              title={t.title}
            >
              {t.pinned ? "★ " : ""}{t.title}
            </div>
          );
        })}
        {tasks.length > max ? (
          <div style={{ fontFamily: mn, fontSize: 9, color: D.txd }}>+{tasks.length - max} more</div>
        ) : null}
      </div>
    </div>
  );
}

function DayDetailModal({ iso, tasks, onClose, handlers }: { iso: string; tasks: Task[]; onClose: () => void; handlers: Handlers }) {
  const label = new Date(iso + "T00:00:00").toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
  return (
    <div style={overlay} onClick={onClose}>
      <div style={{ ...panel, width: "min(540px, 96vw)" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 14 }}>
          <div>
            <div style={{ fontFamily: mn, fontSize: 10, letterSpacing: 1.4, color: D.txd, textTransform: "uppercase" }}>{iso}</div>
            <div style={{ fontFamily: gf, fontSize: 22, fontWeight: 800, color: D.tx, letterSpacing: -0.6 }}>{label}</div>
          </div>
          <button type="button" onClick={onClose} style={ghostBtn}>Close</button>
        </div>
        {tasks.length === 0 ? (
          <div style={emptyBox}>No tasks scheduled for this day.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {tasks.map((t) => <TaskRow key={t.id} task={t} handlers={handlers} />)}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Week view ──────────────────────────────────────────────────────
function WeekView({ tasks, handlers }: { tasks: Task[]; handlers: Handlers }) {
  const [start, setStart] = useState(() => {
    const d = new Date(); d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - d.getDay()); // Sunday
    return d;
  });

  const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(start); d.setDate(d.getDate() + i); return d; });
  const today = isoDate(startOfDay(new Date()));
  const noDate = tasks.filter((t) => !t.dueDate);

  function shift(days: number) {
    const d = new Date(start); d.setDate(d.getDate() + days); setStart(d);
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <button type="button" onClick={() => shift(-7)} style={ghostBtn}>‹ Prev</button>
        <button type="button" onClick={() => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - d.getDay()); setStart(d); }} style={ghostBtn}>This week</button>
        <button type="button" onClick={() => shift(7)} style={ghostBtn}>Next ›</button>
        <div style={{ fontFamily: gf, fontSize: 20, fontWeight: 800, color: D.tx, letterSpacing: -0.5 }}>
          {start.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
          {" — "}
          {days[6].toLocaleDateString(undefined, { month: "short", day: "numeric" })}
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 8 }}>
        {days.map((d) => {
          const iso = isoDate(d);
          const dayTasks = tasks.filter((t) => t.dueDate === iso);
          // Overdue rolls into today
          if (iso === today) {
            const overdue = tasks.filter((t) => t.dueDate && t.dueDate < today && !t.done);
            return <WeekColumn key={iso} date={d} isToday tasks={[...overdue, ...dayTasks]} overdueCount={overdue.length} onDrop={(id) => handlers.onMove(id, { dueDate: iso })} handlers={handlers} />;
          }
          return <WeekColumn key={iso} date={d} isToday={false} tasks={dayTasks} overdueCount={0} onDrop={(id) => handlers.onMove(id, { dueDate: iso })} handlers={handlers} />;
        })}
      </div>

      {noDate.length > 0 ? (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontFamily: mn, fontSize: 10, letterSpacing: 1.4, color: D.txd, textTransform: "uppercase", marginBottom: 8 }}>Unscheduled · drag to a day</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {noDate.map((t) => (
              <div
                key={t.id}
                draggable
                onDragStart={(e) => e.dataTransfer.setData("text/plain", t.id)}
                onClick={() => handlers.onEdit(t)}
                style={{ background: D.surface, border: `1px solid ${D.border}`, borderLeft: `3px solid ${PRIORITY_COLORS[t.priority]}`, borderRadius: 6, padding: "5px 10px", cursor: "grab", fontFamily: ft, fontSize: 12, color: D.tx }}
              >
                {t.title}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function WeekColumn({ date, isToday, tasks, overdueCount, onDrop, handlers }: { date: Date; isToday: boolean; tasks: Task[]; overdueCount: number; onDrop: (id: string) => void; handlers: Handlers }) {
  const [over, setOver] = useState(false);
  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); const id = e.dataTransfer.getData("text/plain"); if (id) onDrop(id); }}
      style={{
        background: over ? "rgba(247,176,65,0.08)" : D.surface,
        border: `1px solid ${over ? D.amber : (isToday ? D.amber : D.border)}`,
        borderRadius: 10, padding: 8, minHeight: 280,
      }}
    >
      <div style={{ marginBottom: 8 }}>
        <div style={{ fontFamily: mn, fontSize: 9, letterSpacing: 1.2, color: isToday ? D.amber : D.txd, textTransform: "uppercase" }}>
          {date.toLocaleDateString(undefined, { weekday: "short" })}
        </div>
        <div style={{ fontFamily: gf, fontSize: 16, fontWeight: 800, color: isToday ? D.amber : D.tx, letterSpacing: -0.4 }}>
          {date.getDate()}
        </div>
        {overdueCount > 0 ? (
          <div style={{ fontFamily: mn, fontSize: 9, color: D.coral, letterSpacing: 0.4 }}>+ {overdueCount} overdue</div>
        ) : null}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        {tasks.map((t) => <WeekChip key={t.id} task={t} handlers={handlers} />)}
        {tasks.length === 0 ? <div style={{ fontFamily: mn, fontSize: 9, color: D.txd, padding: 6, textAlign: "center" }}>—</div> : null}
      </div>
    </div>
  );
}

function WeekChip({ task, handlers }: { task: Task; handlers: Handlers }) {
  const c = PRIORITY_COLORS[(task.done ? "DONE" : task.priority) as Priority];
  return (
    <div
      draggable
      onDragStart={(e) => e.dataTransfer.setData("text/plain", task.id)}
      onClick={() => handlers.onEdit(task)}
      style={{
        background: D.bg,
        border: `1px solid ${D.border}`,
        borderLeft: `3px solid ${c}`,
        borderRadius: 6,
        padding: "5px 7px",
        cursor: "pointer",
        opacity: task.done ? 0.55 : 1,
      }}
    >
      <div style={{ fontFamily: ft, fontSize: 11.5, fontWeight: 600, color: D.tx, lineHeight: 1.3, textDecoration: task.done ? "line-through" : "none", overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
        {task.pinned ? "★ " : ""}{task.title}
      </div>
    </div>
  );
}

// ── Focus view ─────────────────────────────────────────────────────
// ════════════════════════════════════════════════════════════════════
// Focus / Today view — Daily Planner with hour timeline + task queue +
// daily brief banner + one-click into Focus Mode (single-task overlay).
// ════════════════════════════════════════════════════════════════════

// Timeline runs 7am → 9pm on 30-min slots. Each slot = 30px tall.
const TIMELINE_START_HOUR = 7;
const TIMELINE_END_HOUR = 21;
const SLOT_HEIGHT_PX = 30;
const SLOTS_PER_HOUR = 2;

function FocusView({ tasks, handlers }: { tasks: Task[]; handlers: Handlers }) {
  const today = startOfDay(new Date());
  const todayIso = isoDate(today);

  // Bucket tasks by status. A task is "scheduled today" if its
  // scheduledFor falls on today's date.
  const overdue = tasks.filter((t) => !t.done && t.dueDate && t.dueDate < todayIso).sort(byDueAsc);
  const scheduledToday = tasks.filter((t) => !t.done && t.scheduledFor && isoDate(new Date(t.scheduledFor)) === todayIso).sort(byScheduled);
  const scheduledIds = new Set(scheduledToday.map((t) => t.id));
  const dueTodayUnsched = tasks.filter((t) => !t.done && t.dueDate === todayIso && !scheduledIds.has(t.id)).sort(byPriorityAsc);
  const weekOut = (() => { const d = new Date(today); d.setDate(d.getDate() + 7); return isoDate(d); })();
  const thisWeek = tasks.filter((t) => !t.done && t.dueDate && t.dueDate > todayIso && t.dueDate <= weekOut && !scheduledIds.has(t.id)).sort(byDueAsc);
  const noDate = tasks.filter((t) => !t.done && !t.dueDate && !scheduledIds.has(t.id) && !t.pinned).slice(0, 12);
  const pinned = tasks.filter((t) => !t.done && t.pinned && !scheduledIds.has(t.id));

  const doneToday = tasks.filter((t) => t.done && (t.scheduledFor && isoDate(new Date(t.scheduledFor)) === todayIso || t.dueDate === todayIso)).length;
  const totalToday = scheduledToday.length + dueTodayUnsched.length + overdue.length + doneToday;

  // Suggested next: highest priority unfinished, prefer scheduled-today
  // first, then due-today, then overdue, then any HIGH.
  const suggested = scheduledToday[0] || dueTodayUnsched[0] || overdue[0] || tasks.find((t) => !t.done && t.priority === "HIGH") || null;

  function scheduleAt(id: string, hour: number, minute: number) {
    const dt = new Date(today);
    dt.setHours(hour, minute, 0, 0);
    handlers.onMove(id, { scheduledFor: dt.toISOString() });
  }
  function unschedule(id: string) {
    handlers.onMove(id, { scheduledFor: undefined });
  }

  return (
    <div>
      {/* ── DAILY BRIEF BANNER ──────────────────────────────────────── */}
      <div style={{
        marginBottom: 18,
        padding: "16px 18px",
        background: "linear-gradient(135deg, " + D.amber + "12, transparent 70%)",
        border: `1px solid ${overdue.length > 0 ? D.coral + "55" : D.amber + "44"}`,
        borderRadius: 14,
        display: "grid",
        gridTemplateColumns: "minmax(0, 1fr) auto",
        gap: 16,
        alignItems: "center",
      }}>
        <div>
          <div style={{ fontFamily: mn, fontSize: 10, color: D.amber, letterSpacing: 1.4, textTransform: "uppercase", fontWeight: 700, marginBottom: 4 }}>Daily brief · {today.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 14, alignItems: "baseline", marginBottom: 6 }}>
            {overdue.length > 0 ? (
              <span style={{ fontFamily: gf, fontSize: 26, fontWeight: 900, color: D.coral, letterSpacing: -0.6, display: "inline-flex", alignItems: "baseline", gap: 6, animation: "tbPulseRed 1.8s ease-in-out infinite" }}>
                {overdue.length} <span style={{ fontFamily: mn, fontSize: 10, letterSpacing: 1.2, textTransform: "uppercase", fontWeight: 700, color: D.coral }}>overdue</span>
              </span>
            ) : null}
            <span style={{ fontFamily: gf, fontSize: 22, fontWeight: 800, color: D.tx, letterSpacing: -0.4, display: "inline-flex", alignItems: "baseline", gap: 6 }}>
              {scheduledToday.length + dueTodayUnsched.length} <span style={{ fontFamily: mn, fontSize: 10, letterSpacing: 1.2, textTransform: "uppercase", fontWeight: 700, color: D.txm }}>queued today</span>
            </span>
            <span style={{ fontFamily: gf, fontSize: 18, fontWeight: 700, color: D.txm, letterSpacing: -0.3, display: "inline-flex", alignItems: "baseline", gap: 6 }}>
              {thisWeek.length} <span style={{ fontFamily: mn, fontSize: 10, letterSpacing: 1.2, textTransform: "uppercase", fontWeight: 700, color: D.txd }}>this week</span>
            </span>
            {doneToday > 0 ? (
              <span style={{ fontFamily: gf, fontSize: 16, fontWeight: 700, color: D.teal, letterSpacing: -0.3, display: "inline-flex", alignItems: "baseline", gap: 6 }}>
                {doneToday} <span style={{ fontFamily: mn, fontSize: 10, letterSpacing: 1.2, textTransform: "uppercase", fontWeight: 700, color: D.teal }}>done</span>
              </span>
            ) : null}
          </div>
          {suggested ? (
            <div style={{ fontFamily: ft, fontSize: 13, color: D.txm, lineHeight: 1.5 }}>
              Next up: <strong style={{ color: D.tx }}>{suggested.title}</strong>
              {suggested.subtasks && suggested.subtasks.length > 0 ? <span style={{ color: D.txd }}> · {suggested.subtasks.filter((s) => !s.done).length} subtasks open</span> : null}
              {suggested.dueDate ? <span style={{ color: suggested.dueDate < todayIso ? D.coral : D.txd }}> · {formatDue(suggested.dueDate)?.label}</span> : null}
            </div>
          ) : (
            <div style={{ fontFamily: ft, fontSize: 13, color: D.txm }}>Nothing overdue, nothing scheduled. Drag from the queue or hit Quick Add to set up the day.</div>
          )}
          <style dangerouslySetInnerHTML={{ __html: "@keyframes tbPulseRed{0%,100%{opacity:1}50%{opacity:0.55}}" }} />
        </div>
        {suggested ? (
          <button
            type="button"
            onClick={() => handlers.onStartFocus(suggested)}
            style={{ background: D.amber, color: "#060608", border: "none", padding: "12px 22px", borderRadius: 10, fontFamily: ft, fontSize: 14, fontWeight: 800, cursor: "pointer", letterSpacing: 0.3, boxShadow: `0 0 24px ${D.amber}33` }}
          >
            ▶ Start Focus
          </button>
        ) : null}
      </div>

      {/* ── PLANNER GRID ────────────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.4fr) minmax(0, 1fr)", gap: 18 }}>
        {/* LEFT — hour timeline */}
        <div style={{ background: D.surface, border: `1px solid ${D.border}`, borderRadius: 12, padding: 12 }}>
          <div style={{ fontFamily: mn, fontSize: 10, color: D.txd, letterSpacing: 1.4, textTransform: "uppercase", fontWeight: 700, marginBottom: 8 }}>Time block · today</div>
          <Timeline
            today={today}
            tasksToday={scheduledToday}
            onDropAt={(id, h, m) => scheduleAt(id, h, m)}
            onUnschedule={unschedule}
            handlers={handlers}
          />
        </div>

        {/* RIGHT — task queue */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {overdue.length > 0 ? (
            <QueueGroup label={`⚠ Overdue · ${overdue.length}`} color={D.coral} tasks={overdue} handlers={handlers} pulse />
          ) : null}
          {dueTodayUnsched.length > 0 ? (
            <QueueGroup label={`🔥 Today · ${dueTodayUnsched.length}`} color={D.amber} tasks={dueTodayUnsched} handlers={handlers} />
          ) : null}
          {pinned.length > 0 ? (
            <QueueGroup label={`★ Pinned · ${pinned.length}`} color={D.amber} tasks={pinned} handlers={handlers} />
          ) : null}
          {thisWeek.length > 0 ? (
            <QueueGroup label={`📅 This week · ${thisWeek.length}`} color={D.blue} tasks={thisWeek} handlers={handlers} />
          ) : null}
          {noDate.length > 0 ? (
            <QueueGroup label={`Unscheduled · ${noDate.length}`} color={D.txm} tasks={noDate} handlers={handlers} />
          ) : null}
          {overdue.length === 0 && dueTodayUnsched.length === 0 && thisWeek.length === 0 && pinned.length === 0 && noDate.length === 0 ? (
            <div style={emptyBox}>Inbox zero. Or just no tasks queued for this stretch. Add some via Quick Add.</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function byScheduled(a: Task, b: Task) {
  return (a.scheduledFor || "").localeCompare(b.scheduledFor || "");
}

// ── Timeline ────────────────────────────────────────────────────────
function Timeline({ today, tasksToday, onDropAt, onUnschedule, handlers }: { today: Date; tasksToday: Task[]; onDropAt: (id: string, h: number, m: number) => void; onUnschedule: (id: string) => void; handlers: Handlers }) {
  const totalSlots = (TIMELINE_END_HOUR - TIMELINE_START_HOUR) * SLOTS_PER_HOUR;
  const nowMinutes = (() => {
    const n = new Date();
    if (isoDate(startOfDay(n)) !== isoDate(today)) return null;
    return (n.getHours() - TIMELINE_START_HOUR) * 60 + n.getMinutes();
  })();

  // Render scheduled tasks as absolutely-positioned blocks atop the slots.
  function blockFor(t: Task) {
    if (!t.scheduledFor) return null;
    const dt = new Date(t.scheduledFor);
    const startMin = (dt.getHours() - TIMELINE_START_HOUR) * 60 + dt.getMinutes();
    if (startMin < 0 || startMin > (TIMELINE_END_HOUR - TIMELINE_START_HOUR) * 60) return null;
    const dur = Math.max(15, t.estimateMins || 30);
    const topPx = (startMin / 30) * SLOT_HEIGHT_PX;
    const heightPx = Math.max(SLOT_HEIGHT_PX - 4, (dur / 30) * SLOT_HEIGHT_PX - 4);
    return { topPx, heightPx };
  }

  return (
    <div style={{ position: "relative", maxHeight: 540, overflowY: "auto" }}>
      <div style={{ position: "relative", height: totalSlots * SLOT_HEIGHT_PX, paddingLeft: 56 }}>
        {/* Hour labels + drop slots */}
        {Array.from({ length: totalSlots }, (_, i) => {
          const hour = TIMELINE_START_HOUR + Math.floor(i / SLOTS_PER_HOUR);
          const minute = (i % SLOTS_PER_HOUR) * 30;
          const onHour = minute === 0;
          return (
            <TimelineSlot
              key={i}
              hour={hour}
              minute={minute}
              onHour={onHour}
              top={i * SLOT_HEIGHT_PX}
              onDrop={(id) => onDropAt(id, hour, minute)}
            />
          );
        })}

        {/* Current-time line */}
        {nowMinutes !== null && nowMinutes >= 0 ? (
          <div style={{
            position: "absolute",
            left: 50, right: 0,
            top: (nowMinutes / 30) * SLOT_HEIGHT_PX,
            borderTop: `2px solid ${D.coral}`,
            zIndex: 5,
            pointerEvents: "none",
          }}>
            <span style={{ position: "absolute", left: -42, top: -10, fontFamily: mn, fontSize: 9, color: D.coral, fontWeight: 700, letterSpacing: 0.4, background: D.surface, padding: "1px 4px", borderRadius: 3 }}>NOW</span>
          </div>
        ) : null}

        {/* Scheduled blocks */}
        {tasksToday.map((t) => {
          const b = blockFor(t);
          if (!b) return null;
          const c = PRIORITY_COLORS[t.priority];
          const dt = new Date(t.scheduledFor!);
          const timeLabel = dt.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
          return (
            <div
              key={t.id}
              draggable
              onDragStart={(e) => e.dataTransfer.setData("text/plain", t.id)}
              onClick={() => handlers.onStartFocus(t)}
              style={{
                position: "absolute",
                left: 56,
                right: 4,
                top: b.topPx,
                height: b.heightPx,
                background: c + "22",
                borderLeft: `3px solid ${c}`,
                borderRadius: 6,
                padding: "4px 8px",
                cursor: "pointer",
                overflow: "hidden",
                fontFamily: ft,
                opacity: t.done ? 0.55 : 1,
                zIndex: 4,
                display: "flex",
                flexDirection: "column",
                justifyContent: b.heightPx > 36 ? "flex-start" : "center",
              }}
              title={`${t.title} · ${timeLabel}`}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontFamily: mn, fontSize: 9, color: c, letterSpacing: 0.4, fontWeight: 700 }}>{timeLabel}</span>
                <span style={{ fontFamily: gf, fontSize: 12, fontWeight: 700, color: D.tx, lineHeight: 1.2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{t.title}</span>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onUnschedule(t.id); }}
                  title="Unschedule"
                  style={{ background: "transparent", border: "none", color: D.txd, fontSize: 11, cursor: "pointer", padding: 0, lineHeight: 1 }}
                >×</button>
              </div>
              {b.heightPx > 38 && t.subtasks && t.subtasks.length > 0 ? (
                <div style={{ marginTop: 2, fontFamily: mn, fontSize: 9, color: D.txd, letterSpacing: 0.3 }}>
                  {t.subtasks.filter((s) => s.done).length}/{t.subtasks.length} subtasks
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TimelineSlot({ hour, minute, onHour, top, onDrop }: { hour: number; minute: number; onHour: boolean; top: number; onDrop: (id: string) => void }) {
  const [over, setOver] = useState(false);
  const h12 = ((hour + 11) % 12) + 1;
  const ampm = hour < 12 ? "am" : "pm";
  return (
    <div
      onDragOver={(e) => { e.preventDefault(); if (!over) setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); const id = e.dataTransfer.getData("text/plain"); if (id) onDrop(id); }}
      style={{
        position: "absolute",
        left: 0, right: 0,
        top, height: SLOT_HEIGHT_PX,
        borderTop: onHour ? `1px solid ${D.border}` : `1px dashed ${D.border}88`,
        background: over ? "rgba(247,176,65,0.08)" : "transparent",
        transition: "background 0.1s",
      }}
    >
      {onHour ? (
        <div style={{ position: "absolute", left: 0, top: -7, width: 50, textAlign: "right", paddingRight: 8, fontFamily: mn, fontSize: 10, color: D.txd, letterSpacing: 0.4 }}>
          {h12}:{String(minute).padStart(2, "0")} {ampm}
        </div>
      ) : null}
    </div>
  );
}

// ── Queue group (right side of planner) ──────────────────────────────
function QueueGroup({ label, color, tasks, handlers, pulse }: { label: string; color: string; tasks: Task[]; handlers: Handlers; pulse?: boolean }) {
  return (
    <div style={{ background: D.surface, border: `1px solid ${color}33`, borderRadius: 10, padding: 10 }}>
      <div style={{ fontFamily: mn, fontSize: 10, color, letterSpacing: 1.2, textTransform: "uppercase", fontWeight: 700, marginBottom: 8, animation: pulse ? "tbPulseRed 1.8s ease-in-out infinite" : undefined }}>{label}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        {tasks.map((t) => <QueueCard key={t.id} task={t} handlers={handlers} />)}
      </div>
    </div>
  );
}

function QueueCard({ task, handlers }: { task: Task; handlers: Handlers }) {
  const pColor = PRIORITY_COLORS[task.priority];
  const due = formatDue(task.dueDate);
  return (
    <div
      draggable
      onDragStart={(e) => e.dataTransfer.setData("text/plain", task.id)}
      onClick={() => handlers.onEdit(task)}
      style={{
        background: D.bg,
        border: `1px solid ${D.border}`,
        borderLeft: `3px solid ${pColor}`,
        borderRadius: 6,
        padding: "6px 9px",
        cursor: "grab",
        opacity: task.done ? 0.55 : 1,
      }}
      title="Drag onto a timeline slot to schedule"
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); handlers.onToggleDone(task); }}
          style={{ width: 11, height: 11, borderRadius: "50%", background: task.done ? D.teal : "transparent", border: `2px solid ${task.done ? D.teal : pColor}`, cursor: "pointer", padding: 0, flexShrink: 0 }}
        />
        <span style={{ flex: 1, minWidth: 0, fontFamily: ft, fontSize: 12.5, fontWeight: 600, color: D.tx, lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{task.pinned ? "★ " : ""}{task.title}</span>
        {task.subtasks && task.subtasks.length > 0 ? (
          <span style={{ fontFamily: mn, fontSize: 8.5, color: D.violet, letterSpacing: 0.3 }}>{task.subtasks.filter((s) => s.done).length}/{task.subtasks.length}</span>
        ) : null}
        {due ? <span style={{ fontFamily: mn, fontSize: 9, color: due.urgent ? D.coral : D.txm, letterSpacing: 0.4 }}>{due.label}</span> : null}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// Focus Mode — single-task, full-screen overlay. Pomodoro-ish timer,
// subtask checklist, "Done + next" / "Skip" / "Exit" actions.
// ════════════════════════════════════════════════════════════════════

function FocusMode({ task, onClose, onUpdate, onComplete, onSkipToNext }: { task: Task; onClose: () => void; onUpdate: (patch: Partial<Task>) => void; onComplete: () => void; onSkipToNext: () => void }) {
  const [secs, setSecs] = useState(25 * 60);
  const [running, setRunning] = useState(false);

  // Reset timer when the focused task changes (Done + next swaps task).
  useEffect(() => { setSecs(25 * 60); setRunning(false); }, [task.id]);

  useEffect(() => {
    if (!running) return;
    const iv = setInterval(() => setSecs((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(iv);
  }, [running]);

  // Keyboard: Esc closes, Space toggles timer, Enter marks done + next.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") { e.preventDefault(); onClose(); }
      if (e.key === " " && (e.target as HTMLElement)?.tagName !== "INPUT") { e.preventDefault(); setRunning((r) => !r); }
      if (e.key === "Enter" && !(e.target as HTMLElement)?.closest("input")) { e.preventDefault(); onComplete(); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, onComplete]);

  const mm = Math.floor(secs / 60);
  const ss = secs % 60;
  const subtasks = task.subtasks || [];
  const doneSubs = subtasks.filter((s) => s.done).length;

  function toggleSub(id: string) {
    onUpdate({ subtasks: subtasks.map((s) => s.id === id ? { ...s, done: !s.done } : s) });
  }

  const pColor = PRIORITY_COLORS[task.priority];

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 12500,
      background: "rgba(6,6,12,0.94)",
      backdropFilter: "blur(20px)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 24,
    }}>
      <div style={{ width: "min(720px, 96vw)", maxHeight: "calc(100vh - 48px)", overflowY: "auto", display: "flex", flexDirection: "column", gap: 22 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontFamily: mn, fontSize: 10, color: D.amber, letterSpacing: 1.6, textTransform: "uppercase", fontWeight: 700 }}>Focus mode · {task.category}</div>
          <button type="button" onClick={onClose} style={{ background: "transparent", border: `1px solid ${D.border}`, color: D.txm, padding: "5px 12px", borderRadius: 6, fontFamily: mn, fontSize: 10, cursor: "pointer", letterSpacing: 0.6 }}>Esc · exit</button>
        </div>

        <div>
          <div style={{ fontFamily: gf, fontSize: 36, fontWeight: 900, color: D.tx, letterSpacing: -1.4, lineHeight: 1.15, marginBottom: 8 }}>{task.title}</div>
          {task.description ? (
            <div style={{ fontFamily: ft, fontSize: 14.5, color: D.txm, lineHeight: 1.55 }}>{task.description}</div>
          ) : null}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
            <span style={{ fontFamily: mn, fontSize: 10, color: pColor, background: pColor + "22", border: `1px solid ${pColor}55`, padding: "2px 8px", borderRadius: 4, letterSpacing: 0.6, fontWeight: 700, textTransform: "uppercase" }}>{task.priority}</span>
            {task.dueDate ? (
              <span style={{ fontFamily: mn, fontSize: 10, color: formatDue(task.dueDate)?.urgent ? D.coral : D.txm, letterSpacing: 0.5 }}>Due {formatDue(task.dueDate)?.label}</span>
            ) : null}
            {(task.tags || []).map((tag) => (
              <span key={tag} style={{ fontFamily: mn, fontSize: 10, color: D.violet, background: D.violet + "1c", padding: "1px 7px", borderRadius: 3, letterSpacing: 0.4 }}>#{tag}</span>
            ))}
          </div>
        </div>

        {/* Timer */}
        <div style={{ display: "flex", alignItems: "center", gap: 18, padding: "12px 16px", background: D.surface, border: `1px solid ${D.border}`, borderRadius: 12 }}>
          <div style={{ fontFamily: mn, fontSize: 36, fontWeight: 800, color: secs < 60 ? D.coral : D.tx, letterSpacing: 1, minWidth: 96 }}>
            {String(mm).padStart(2, "0")}:{String(ss).padStart(2, "0")}
          </div>
          <button type="button" onClick={() => setRunning((r) => !r)} style={{ background: running ? D.coral + "22" : D.amber, color: running ? D.coral : "#060608", border: `1px solid ${running ? D.coral + "55" : D.amber}`, padding: "9px 18px", borderRadius: 8, fontFamily: ft, fontSize: 13, fontWeight: 800, cursor: "pointer", letterSpacing: 0.3 }}>
            {running ? "⏸ Pause" : "▶ Start"}
          </button>
          <div style={{ display: "flex", gap: 4 }}>
            {[5, 15, 25, 50].map((m) => (
              <button key={m} type="button" onClick={() => { setSecs(m * 60); setRunning(false); }} style={{ padding: "5px 10px", background: secs === m * 60 ? D.amber + "22" : "transparent", color: secs === m * 60 ? D.amber : D.txm, border: `1px solid ${secs === m * 60 ? D.amber + "55" : D.border}`, borderRadius: 5, fontFamily: mn, fontSize: 10, cursor: "pointer", letterSpacing: 0.4, fontWeight: 700 }}>{m}m</button>
            ))}
          </div>
          <span style={{ marginLeft: "auto", fontFamily: mn, fontSize: 9, color: D.txd, letterSpacing: 0.5 }}>Space ▷ toggle · Enter ▷ done + next</span>
        </div>

        {/* Subtasks */}
        {subtasks.length > 0 ? (
          <div style={{ background: D.surface, border: `1px solid ${D.border}`, borderRadius: 12, padding: "14px 18px" }}>
            <div style={{ fontFamily: mn, fontSize: 10, color: D.txd, letterSpacing: 1.2, textTransform: "uppercase", fontWeight: 700, marginBottom: 10 }}>Checklist · {doneSubs}/{subtasks.length}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {subtasks.map((s) => (
                <div key={s.id} onClick={() => toggleSub(s.id)} style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }}>
                  <span style={{ width: 18, height: 18, borderRadius: 4, background: s.done ? D.teal : "transparent", border: `2px solid ${s.done ? D.teal : D.border}`, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "#060608", fontFamily: mn, fontSize: 12, fontWeight: 800 }}>{s.done ? "✓" : ""}</span>
                  <span style={{ fontFamily: ft, fontSize: 15, color: s.done ? D.txd : D.tx, textDecoration: s.done ? "line-through" : "none", lineHeight: 1.4 }}>{s.title}</span>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {/* Action row */}
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <button type="button" onClick={onComplete} style={{ flex: 1, padding: "14px 20px", background: D.teal, color: "#060608", border: "none", borderRadius: 10, fontFamily: ft, fontSize: 15, fontWeight: 800, cursor: "pointer", letterSpacing: 0.4, boxShadow: `0 0 24px ${D.teal}33` }}>
            ✓ Done & Next
          </button>
          <button type="button" onClick={onSkipToNext} style={{ padding: "14px 20px", background: "transparent", color: D.tx, border: `1px solid ${D.border}`, borderRadius: 10, fontFamily: ft, fontSize: 14, cursor: "pointer", letterSpacing: 0.3 }}>
            Skip
          </button>
          <button type="button" onClick={onClose} style={{ padding: "14px 20px", background: "transparent", color: D.txm, border: `1px solid ${D.border}`, borderRadius: 10, fontFamily: ft, fontSize: 14, cursor: "pointer", letterSpacing: 0.3 }}>
            Exit
          </button>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// Modals
// ════════════════════════════════════════════════════════════════════

// ── Edit Task Modal ────────────────────────────────────────────────
function EditTaskModal({ task, onCancel, onSave, onRemove }: { task: Task; onCancel: () => void; onSave: (patch: Partial<Task>) => void; onRemove: () => void }) {
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description || "");
  const [category, setCategory] = useState(task.category);
  const [priority, setPriority] = useState<Priority>(task.priority);
  const [dueDate, setDueDate] = useState(task.dueDate || "");
  const [notes, setNotes] = useState(task.notes || "");
  const [tags, setTags] = useState((task.tags || []).join(", "));
  const [pinned, setPinned] = useState(!!task.pinned);
  const [done, setDone] = useState(!!task.done);
  const [subtasks, setSubtasks] = useState<Subtask[]>(task.subtasks || []);
  const [subDraft, setSubDraft] = useState("");

  function addSub() {
    const t = subDraft.trim();
    if (!t) return;
    setSubtasks((cur) => [...cur, { id: "s-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6), title: t, done: false }]);
    setSubDraft("");
  }
  function toggleSub(id: string) {
    setSubtasks((cur) => cur.map((s) => s.id === id ? { ...s, done: !s.done } : s));
  }
  function removeSub(id: string) {
    setSubtasks((cur) => cur.filter((s) => s.id !== id));
  }
  function updateSubTitle(id: string, next: string) {
    setSubtasks((cur) => cur.map((s) => s.id === id ? { ...s, title: next } : s));
  }

  function save() {
    if (!title.trim()) return;
    onSave({
      title: title.trim(),
      description: description.trim() || undefined,
      category,
      priority,
      dueDate: dueDate || undefined,
      notes: notes.trim() || undefined,
      tags: tags.split(",").map((t) => t.trim().replace(/^#/, "")).filter(Boolean),
      pinned,
      done,
      subtasks: subtasks.length > 0 ? subtasks.map((s) => ({ ...s, title: s.title.trim() })).filter((s) => s.title) : undefined,
    });
  }

  return (
    <div style={overlay} onClick={onCancel}>
      <div style={{ ...panel, width: "min(640px, 96vw)" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <div style={{ fontFamily: gf, fontSize: 20, fontWeight: 800, color: D.tx, letterSpacing: -0.5 }}>Edit task</div>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" onClick={() => setPinned(!pinned)} style={{ background: "transparent", border: `1px solid ${pinned ? D.amber : D.border}`, color: pinned ? D.amber : D.tx, padding: "6px 12px", borderRadius: 8, fontFamily: ft, fontSize: 12, cursor: "pointer", letterSpacing: 0.3 }}>
              {pinned ? "★ Pinned" : "☆ Pin"}
            </button>
            <button type="button" onClick={() => setDone(!done)} style={{ background: done ? D.teal + "22" : "transparent", border: `1px solid ${done ? D.teal : D.border}`, color: done ? D.teal : D.tx, padding: "6px 12px", borderRadius: 8, fontFamily: ft, fontSize: 12, cursor: "pointer", letterSpacing: 0.3 }}>
              {done ? "✓ Done" : "Mark done"}
            </button>
          </div>
        </div>
        <Field label="Title" value={title} onChange={setTitle} />
        <Field label="Description" value={description} onChange={setDescription} multi />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div>
            <div style={lbl}>Category</div>
            <select value={category} onChange={(e) => setCategory(e.target.value)} style={inputStyle}>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <div style={lbl}>Priority</div>
            <select value={priority} onChange={(e) => setPriority(e.target.value as Priority)} style={inputStyle}>
              {PRIORITIES.filter((p) => p !== "DONE").map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
        </div>
        <Field label="Due date" value={dueDate} onChange={setDueDate} type="date" />
        <Field label="Tags (comma separated)" value={tags} onChange={setTags} placeholder="ribbons, q3, hotfix" />

        {/* Subtasks editor — full add/remove/toggle/rename. */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
            <div style={lbl}>Subtasks</div>
            <div style={{ fontFamily: mn, fontSize: 9, color: D.txd, letterSpacing: 0.4 }}>{subtasks.filter((s) => s.done).length}/{subtasks.length} done</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 6 }}>
            {subtasks.map((s) => (
              <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 8px", background: D.surface, border: `1px solid ${D.border}`, borderRadius: 6 }}>
                <button
                  type="button"
                  onClick={() => toggleSub(s.id)}
                  style={{ width: 14, height: 14, borderRadius: 3, background: s.done ? D.teal : "transparent", border: `1.5px solid ${s.done ? D.teal : D.border}`, cursor: "pointer", padding: 0, flexShrink: 0 }}
                />
                <input
                  value={s.title}
                  onChange={(e) => updateSubTitle(s.id, e.target.value)}
                  style={{ flex: 1, background: "transparent", color: s.done ? D.txd : D.tx, textDecoration: s.done ? "line-through" : "none", border: "none", outline: "none", fontFamily: ft, fontSize: 13, padding: "2px 0" }}
                />
                <button type="button" onClick={() => removeSub(s.id)} title="Remove" style={{ background: "transparent", border: "none", color: D.txd, fontFamily: mn, fontSize: 12, cursor: "pointer", padding: "0 2px", opacity: 0.6 }}>×</button>
              </div>
            ))}
            {subtasks.length === 0 ? (
              <div style={{ fontFamily: mn, fontSize: 10, color: D.txd, letterSpacing: 0.3, padding: "4px 2px" }}>No subtasks yet</div>
            ) : null}
          </div>
          <div style={{ display: "flex", gap: 6, alignItems: "center", padding: "4px 8px", background: D.surface, border: `1px dashed ${D.border}`, borderRadius: 6 }}>
            <span style={{ width: 14, height: 14, borderRadius: 3, border: `1.5px dashed ${D.border}`, flexShrink: 0 }} />
            <input
              value={subDraft}
              onChange={(e) => setSubDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addSub(); } }}
              placeholder="+ Add subtask, Enter to save"
              style={{ flex: 1, background: "transparent", color: D.tx, border: "none", outline: "none", fontFamily: ft, fontSize: 13, padding: "2px 0" }}
            />
          </div>
        </div>

        <Field label="Notes" value={notes} onChange={setNotes} multi />
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 14 }}>
          <button type="button" onClick={onRemove} style={{ background: "transparent", border: `1px solid ${D.coral}55`, color: D.coral, padding: "9px 14px", borderRadius: 8, fontFamily: ft, fontSize: 12, cursor: "pointer" }}>Delete task</button>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" onClick={onCancel} style={ghostBtn}>Cancel</button>
            <button type="button" onClick={save} disabled={!title.trim()} style={{ ...primaryBtn, opacity: title.trim() ? 1 : 0.5 }}>Save</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Add Task Modal (preserved from prior version) ─────────────────
function AddTaskModal({ mode, onCancel, onAdd, onSwitchMode }: { mode: AddMode; onCancel: () => void; onAdd: (tasks: Omit<Task, "id" | "addedAt">[]) => void; onSwitchMode: (m: AddMode) => void }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("MARKETING OPS");
  const [priority, setPriority] = useState<Priority>("MEDIUM");
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");

  const [promptText, setPromptText] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");
  const [parsing, setParsing] = useState(false);
  const [parsedTasks, setParsedTasks] = useState<Omit<Task, "id" | "addedAt">[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function handleImage(file: File) {
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  }

  async function parsePrompt() {
    if (!promptText.trim() && !imageFile) return;
    setParsing(true);
    setError(null);
    setParsedTasks([]);
    try {
      let imageUrl: string | undefined;
      if (imageFile) {
        const reader = new FileReader();
        const data = await new Promise<string>((res, rej) => {
          reader.onload = () => res(reader.result as string);
          reader.onerror = () => rej(reader.error);
          reader.readAsDataURL(imageFile);
        });
        const up = await fetch("/api/upload-asset", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ data, filename: imageFile.name, contentType: imageFile.type }),
        });
        const upJ = await up.json();
        if (!up.ok || !upJ.url) {
          setError("Image upload failed: " + (upJ.error || up.status));
          setParsing(false);
          return;
        }
        imageUrl = upJ.url;
      }
      const today = new Date().toISOString().slice(0, 10);
      const res = await fetch("/api/akash-todo/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: promptText.trim() || undefined, imageUrl, today }),
      });
      const j = await res.json();
      if (!res.ok) {
        // Surface the raw model output too when the parse route gave it
        // back so we can see exactly what came through and either retry
        // or copy + manually shape.
        const e = j.error || "Parse failed";
        const raw = typeof j.raw === "string" ? "\n\n--- model output ---\n" + j.raw : "";
        setError(e + raw);
      } else {
        setParsedTasks((j.tasks || []).map((t: Omit<Task, "id" | "addedAt">) => ({ ...t, source: imageUrl ? "image" : "prompt" })));
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setParsing(false);
    }
  }

  function submitManual() {
    if (!title.trim()) return;
    onAdd([{
      title: title.trim(),
      description: description.trim() || undefined,
      category,
      priority,
      dueDate: dueDate || undefined,
      notes: notes.trim() || undefined,
      source: "manual",
    }]);
  }

  const wide = mode === "image" || mode === "prompt";
  // Explicit height (not just min) so flex children can actually grow to
  // fill the panel. With overflowY: auto + only a minHeight, the panel
  // collapses to its intrinsic content height and `flex: 1` resolves to
  // zero remaining space, which is why the parsed-task list used to take
  // only the top third of the modal with a dark void below.
  const panelStyle: React.CSSProperties = wide
    ? {
        ...panel,
        width: "min(1080px, 96vw)",
        height: "min(840px, calc(100vh - 48px))",
        maxHeight: "calc(100vh - 48px)",
        minHeight: undefined,
        overflowY: "hidden",
        display: "flex",
        flexDirection: "column",
      }
    : panel;

  return (
    <div style={overlay} onClick={onCancel}>
      <div style={panelStyle} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", gap: 6, marginBottom: 16, flexShrink: 0 }}>
          {(["manual", "prompt", "image"] as const).map((m) => {
            const active = mode === m;
            return (
              <button
                key={m}
                type="button"
                onClick={() => onSwitchMode(m)}
                style={{
                  padding: "8px 14px",
                  background: active ? D.amber : "transparent",
                  color: active ? "#060608" : D.tx,
                  border: `1px solid ${active ? D.amber : D.border}`,
                  borderRadius: 8,
                  fontFamily: ft,
                  fontSize: 12,
                  fontWeight: active ? 800 : 500,
                  cursor: "pointer",
                  letterSpacing: 0.3,
                }}
              >
                {m === "manual" ? "Manual" : m === "prompt" ? "From prompt" : "From image"}
              </button>
            );
          })}
        </div>

        {mode === "manual" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <Field label="Title" value={title} onChange={setTitle} placeholder="Redo ClusterMax ribbons" />
            <Field label="Description (optional)" value={description} onChange={setDescription} placeholder="Participant version, basic version, deadline next Wednesday" multi />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <div style={lbl}>Category</div>
                <select value={category} onChange={(e) => setCategory(e.target.value)} style={inputStyle}>
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <div style={lbl}>Priority</div>
                <select value={priority} onChange={(e) => setPriority(e.target.value as Priority)} style={inputStyle}>
                  {PRIORITIES.filter((p) => p !== "DONE").map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
            </div>
            <Field label="Due date (optional)" value={dueDate} onChange={setDueDate} placeholder="2026-05-21" type="date" />
            <Field label="Notes (optional)" value={notes} onChange={setNotes} placeholder="Contacts, blockers, links" multi />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button type="button" onClick={onCancel} style={ghostBtn}>Cancel</button>
              <button type="button" onClick={submitManual} disabled={!title.trim()} style={{ ...primaryBtn, opacity: title.trim() ? 1 : 0.5 }}>
                Add task
              </button>
            </div>
          </div>
        ) : null}

        {mode === "prompt" ? (
          <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
            <div style={lbl}>Paste anything · Slack thread, email, meeting notes, brain dump</div>
            <textarea
              value={promptText}
              onChange={(e) => setPromptText(e.target.value)}
              placeholder="Need to redo the ClusterMax ribbons by next Wednesday. Also BoM images for the Unitree robots, ask Jacob. Datacloud Cannes Luma graphic for the SA happy hour. Capital business cards + website timeline next week..."
              style={{ ...inputStyle, minHeight: 200, resize: "vertical" }}
            />
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10 }}>
              <span style={{ fontFamily: mn, fontSize: 10, color: D.txd, letterSpacing: 0.4 }}>{promptText.length} chars</span>
              <button type="button" onClick={parsePrompt} disabled={parsing || !promptText.trim()} style={{ ...primaryBtn, opacity: parsing || !promptText.trim() ? 0.5 : 1 }}>
                {parsing ? "Parsing…" : "Parse into tasks"}
              </button>
            </div>
            {error ? <div style={{ marginTop: 10, fontFamily: mn, fontSize: 11, color: D.coral }}>{error}</div> : null}
            {parsedTasks.length > 0 ? (
              <ParsedPreview tasks={parsedTasks} onConfirm={() => onAdd(parsedTasks)} onEdit={setParsedTasks} onCancel={() => setParsedTasks([])} />
            ) : null}
          </div>
        ) : null}

        {mode === "image" ? (
          parsedTasks.length > 0 ? (
            <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 16, flex: 1, minHeight: 0 }}>
              <div>
                <div style={lbl}>Source image</div>
                {imagePreview ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={imagePreview} alt="preview" style={{ width: "100%", maxHeight: 280, objectFit: "contain", display: "block", border: `1px solid ${D.border}`, borderRadius: 8, marginBottom: 10 }} />
                ) : null}
                {imageFile ? (
                  <div style={{ fontFamily: mn, fontSize: 10, color: D.txm, marginBottom: 8, wordBreak: "break-all" }}>{imageFile.name}</div>
                ) : null}
                <button type="button" onClick={parsePrompt} disabled={parsing} style={{ ...primaryBtn, opacity: parsing ? 0.5 : 1, width: "100%" }}>
                  {parsing ? "Re-reading…" : "Re-extract"}
                </button>
                <button type="button" onClick={() => { setImageFile(null); setImagePreview(""); setParsedTasks([]); }} style={{ ...ghostBtn, width: "100%", marginTop: 8 }}>
                  Different image
                </button>
              </div>
              <div style={{ minWidth: 0, minHeight: 0, display: "flex", flexDirection: "column" }}>
                <ParsedPreview tasks={parsedTasks} onConfirm={() => onAdd(parsedTasks)} onEdit={setParsedTasks} onCancel={() => setParsedTasks([])} />
              </div>
            </div>
          ) : (
            <div>
              <div style={lbl}>Drop a screenshot, PDF page, or whiteboard photo</div>
              <label
                onDragOver={(e) => { e.preventDefault(); e.currentTarget.style.borderColor = D.amber; }}
                onDragLeave={(e) => { e.currentTarget.style.borderColor = D.border; }}
                onDrop={(e) => { e.preventDefault(); e.currentTarget.style.borderColor = D.border; const f = e.dataTransfer.files?.[0]; if (f) handleImage(f); }}
                style={{
                  display: "block",
                  border: `1px dashed ${D.border}`,
                  borderRadius: 10,
                  padding: imagePreview ? 0 : 32,
                  background: D.surface,
                  textAlign: "center",
                  cursor: "pointer",
                  marginBottom: 12,
                  overflow: "hidden",
                }}
              >
                {imagePreview ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={imagePreview} alt="preview" style={{ width: "100%", maxHeight: 240, objectFit: "contain", display: "block" }} />
                ) : (
                  <div style={{ fontFamily: ft, fontSize: 13, color: D.txm, lineHeight: 1.5 }}>
                    Drop image here · or click to choose
                  </div>
                )}
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImage(f); }}
                  style={{ display: "none" }}
                />
              </label>
              {imageFile ? (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <span style={{ fontFamily: mn, fontSize: 10, color: D.txm }}>{imageFile.name}</span>
                  <button type="button" onClick={() => { setImageFile(null); setImagePreview(""); }} style={{ background: "transparent", border: "none", color: D.coral, fontFamily: mn, fontSize: 10, cursor: "pointer" }}>Remove</button>
                </div>
              ) : null}
              <button type="button" onClick={parsePrompt} disabled={parsing || !imageFile} style={{ ...primaryBtn, opacity: parsing || !imageFile ? 0.5 : 1, width: "100%" }}>
                {parsing ? "Reading image with Claude…" : "Extract tasks from image"}
              </button>
              {error ? <div style={{ marginTop: 10, fontFamily: mn, fontSize: 11, color: D.coral }}>{error}</div> : null}
            </div>
          )
        ) : null}
      </div>
    </div>
  );
}

function ParsedPreview({ tasks, onConfirm, onEdit, onCancel }: { tasks: Omit<Task, "id" | "addedAt">[]; onConfirm: () => void; onEdit: (t: Omit<Task, "id" | "addedAt">[]) => void; onCancel: () => void }) {
  return (
    <div style={{ marginTop: 16, flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 6 }}>
        <div style={lbl}>Found {tasks.length} task{tasks.length === 1 ? "" : "s"} — review before adding</div>
        <div style={{ fontFamily: mn, fontSize: 9, color: D.txd, letterSpacing: 0.4 }}>2-column dense layout</div>
      </div>
      <div style={{ flex: 1, minHeight: 0, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, overflowY: "auto", marginBottom: 12, paddingRight: 4, alignContent: "start" }}>
        {tasks.map((t, i) => {
          const cColor = CATEGORY_COLORS[t.category] || D.txm;
          const pColor = PRIORITY_COLORS[t.priority as Priority] || D.txd;
          return (
            <div key={i} style={{ background: D.bg, border: `1px solid ${D.border}`, borderLeft: `3px solid ${pColor}`, borderRadius: 8, padding: "8px 10px", position: "relative", display: "flex", flexDirection: "column", gap: 3 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontFamily: mn, fontSize: 8.5, color: cColor, letterSpacing: 0.6, textTransform: "uppercase", padding: "1px 5px", border: `1px solid ${cColor}55`, borderRadius: 3, lineHeight: 1.3 }}>{t.category}</span>
                <span style={{ fontFamily: mn, fontSize: 8.5, color: pColor, letterSpacing: 0.6 }}>{t.priority}</span>
                {t.dueDate ? <span style={{ marginLeft: "auto", fontFamily: mn, fontSize: 8.5, color: D.txd, letterSpacing: 0.3 }}>{t.dueDate}</span> : null}
                <button
                  type="button"
                  onClick={() => onEdit(tasks.filter((_, idx) => idx !== i))}
                  title="Drop this task"
                  style={{ marginLeft: t.dueDate ? 4 : "auto", background: "transparent", border: "none", color: D.txd, cursor: "pointer", padding: "0 2px", fontSize: 13, lineHeight: 1 }}
                >×</button>
              </div>
              <div style={{ fontFamily: gf, fontSize: 12.5, fontWeight: 700, color: D.tx, lineHeight: 1.3, letterSpacing: -0.2 }}>{t.title}</div>
              {t.description ? <div style={{ fontFamily: ft, fontSize: 11, color: D.txm, lineHeight: 1.4, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{t.description}</div> : null}
              {t.subtasks && t.subtasks.length > 0 ? (
                <div style={{ marginTop: 4, paddingTop: 4, borderTop: `1px dashed ${D.border}`, display: "flex", flexDirection: "column", gap: 2 }}>
                  <div style={{ fontFamily: mn, fontSize: 8.5, color: D.violet, letterSpacing: 0.4, textTransform: "uppercase", fontWeight: 700 }}>{t.subtasks.length} subtask{t.subtasks.length === 1 ? "" : "s"}</div>
                  {t.subtasks.slice(0, 4).map((s, si) => (
                    <div key={si} style={{ fontFamily: ft, fontSize: 10.5, color: D.txm, lineHeight: 1.4, display: "flex", alignItems: "center", gap: 5 }}>
                      <span style={{ width: 8, height: 8, borderRadius: 2, border: `1px solid ${D.border}`, flexShrink: 0 }} />
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.title}</span>
                    </div>
                  ))}
                  {t.subtasks.length > 4 ? <div style={{ fontFamily: mn, fontSize: 9, color: D.txd, letterSpacing: 0.3 }}>+ {t.subtasks.length - 4} more</div> : null}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <button type="button" onClick={onCancel} style={ghostBtn}>Discard all</button>
        <button type="button" onClick={onConfirm} style={primaryBtn}>Add {tasks.length} task{tasks.length === 1 ? "" : "s"}</button>
      </div>
    </div>
  );
}

// ── Board management ───────────────────────────────────────────────
function BoardModal({ archive, onCancel, onSave }: { archive: BoardArchive; onCancel: () => void; onSave: (a: BoardArchive) => void }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  function addBoard() {
    if (!name.trim()) return;
    const next: Board = { id: "b-" + Date.now(), name: name.trim(), description: description.trim() || undefined, tasks: [], createdAt: new Date().toISOString() };
    onSave({ boards: [...archive.boards, next], activeId: next.id });
  }

  function removeBoard(id: string) {
    if (archive.boards.length === 1) return;
    if (!confirm("Delete this board and all its tasks?")) return;
    const remaining = archive.boards.filter((b) => b.id !== id);
    onSave({ boards: remaining, activeId: remaining[0].id });
  }

  return (
    <div style={overlay} onClick={onCancel}>
      <div style={panel} onClick={(e) => e.stopPropagation()}>
        <div style={{ fontFamily: gf, fontSize: 20, fontWeight: 800, color: D.tx, letterSpacing: -0.5, marginBottom: 14 }}>Boards</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 16 }}>
          {archive.boards.map((b) => (
            <div key={b.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: D.surface, border: `1px solid ${D.border}`, borderRadius: 8 }}>
              <div>
                <div style={{ fontFamily: ft, fontSize: 13, color: D.tx, fontWeight: 700 }}>{b.name}</div>
                {b.description ? <div style={{ fontFamily: mn, fontSize: 10, color: D.txd }}>{b.description}</div> : null}
                <div style={{ fontFamily: mn, fontSize: 9, color: D.txd, marginTop: 2 }}>{b.tasks.length} task{b.tasks.length === 1 ? "" : "s"}</div>
              </div>
              <button type="button" onClick={() => removeBoard(b.id)} disabled={archive.boards.length === 1} style={{ background: "transparent", border: "none", color: archive.boards.length === 1 ? D.txd : D.coral, fontFamily: mn, fontSize: 10, cursor: archive.boards.length === 1 ? "not-allowed" : "pointer", letterSpacing: 0.4 }}>Delete</button>
            </div>
          ))}
        </div>
        <div style={{ borderTop: `1px solid ${D.border}`, paddingTop: 14 }}>
          <Field label="New board name" value={name} onChange={setName} placeholder="June 2026" />
          <Field label="Description (optional)" value={description} onChange={setDescription} placeholder="Marketing + Production" />
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
            <button type="button" onClick={onCancel} style={ghostBtn}>Close</button>
            <button type="button" onClick={addBoard} disabled={!name.trim()} style={{ ...primaryBtn, opacity: name.trim() ? 1 : 0.5 }}>+ Add board</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// Helpers
// ════════════════════════════════════════════════════════════════════

function Field({ label, value, onChange, placeholder, multi, type }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; multi?: boolean; type?: string }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={lbl}>{label}</div>
      {multi ? (
        <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} style={{ ...inputStyle, minHeight: 70, resize: "vertical" }} />
      ) : (
        <input type={type || "text"} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} style={inputStyle} />
      )}
    </div>
  );
}

function groupTasks(tasks: Task[], by: "priority" | "category" | "due"): Array<{ key: string; tasks: Task[] }> {
  if (by === "priority") {
    const order: Priority[] = ["HIGH", "MEDIUM", "THIS WEEK", "ONGOING", "DONE"];
    return order
      .map((k) => ({ key: k, tasks: tasks.filter((t) => (t.done ? "DONE" : t.priority) === k) }))
      .filter((g) => g.tasks.length > 0);
  }
  if (by === "category") {
    const buckets: Record<string, Task[]> = {};
    tasks.forEach((t) => { (buckets[t.category] = buckets[t.category] || []).push(t); });
    return Object.entries(buckets)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, ts]) => ({ key: k, tasks: ts }));
  }
  const buckets: Record<string, Task[]> = { Overdue: [], "This week": [], "Later": [], "No due date": [] };
  const today = startOfDay(new Date());
  const weekOut = new Date(today); weekOut.setDate(weekOut.getDate() + 7);
  tasks.forEach((t) => {
    if (!t.dueDate) { buckets["No due date"].push(t); return; }
    const d = startOfDay(new Date(t.dueDate));
    if (isNaN(d.getTime())) { buckets["No due date"].push(t); return; }
    if (d < today) buckets["Overdue"].push(t);
    else if (d <= weekOut) buckets["This week"].push(t);
    else buckets["Later"].push(t);
  });
  return Object.entries(buckets).filter(([, ts]) => ts.length > 0).map(([k, ts]) => ({ key: k, tasks: ts }));
}

function sortTasks(tasks: Task[], by: SortType): Task[] {
  const arr = [...tasks];
  if (by === "due") {
    arr.sort((a, b) => {
      if (!a.dueDate && !b.dueDate) return 0;
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return a.dueDate.localeCompare(b.dueDate);
    });
  } else if (by === "added") {
    arr.sort((a, b) => (b.addedAt || "").localeCompare(a.addedAt || ""));
  } else if (by === "alpha") {
    arr.sort((a, b) => a.title.localeCompare(b.title));
  }
  return arr;
}

function byDueAsc(a: Task, b: Task) {
  if (!a.dueDate && !b.dueDate) return 0;
  if (!a.dueDate) return 1;
  if (!b.dueDate) return -1;
  return a.dueDate.localeCompare(b.dueDate);
}

function byPriorityAsc(a: Task, b: Task) {
  const order: Record<Priority, number> = { HIGH: 0, MEDIUM: 1, "THIS WEEK": 2, ONGOING: 3, DONE: 4 };
  return order[a.priority] - order[b.priority];
}

function formatDue(due?: string): { label: string; urgent: boolean } | null {
  if (!due) return null;
  const d = new Date(due);
  if (isNaN(d.getTime())) return null;
  const today = startOfDay(new Date());
  const diffDays = Math.round((d.getTime() - today.getTime()) / 86400000);
  if (diffDays < 0) return { label: `${Math.abs(diffDays)}d overdue`, urgent: true };
  if (diffDays === 0) return { label: "Today", urgent: true };
  if (diffDays === 1) return { label: "Tomorrow", urgent: true };
  if (diffDays < 7) return { label: `in ${diffDays}d`, urgent: false };
  return { label: d.toLocaleDateString(undefined, { month: "short", day: "numeric" }), urgent: false };
}

function startOfDay(d: Date): Date { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
function isoDate(d: Date): string { return d.toISOString().slice(0, 10); }

function buildMonthGrid(anchor: Date): Array<{ date: Date; inMonth: boolean }> {
  const month = anchor.getMonth();
  const first = new Date(anchor); first.setDate(1); first.setHours(0, 0, 0, 0);
  const start = new Date(first); start.setDate(first.getDate() - first.getDay());
  const out: Array<{ date: Date; inMonth: boolean }> = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start); d.setDate(start.getDate() + i);
    out.push({ date: d, inMonth: d.getMonth() === month });
  }
  return out;
}

// Group a flat list of pasted lines into parent-with-subtask blocks.
// Recognizes bullet/dash/asterisk/numbered children, with optional
// leading whitespace (so indentation works too). The first non-empty
// line that DOESN'T look like a bullet becomes a parent; subsequent
// bullet lines attach to it as subtasks until the next parent appears.
// Top-level bullets with no preceding parent each become their own
// flat task (no subtasks).
function groupLinesIntoTasks(lines: string[]): Array<{ parent: string; subs: string[] }> {
  const groups: Array<{ parent: string; subs: string[] }> = [];
  const bulletRe = /^(?:\s*)(?:[-*•·→▸]|\d+[.)])\s+(.+)$/;
  for (const raw of lines) {
    if (!raw || !raw.trim()) continue;
    const bulletMatch = raw.match(bulletRe);
    if (bulletMatch) {
      const content = bulletMatch[1].trim();
      if (!content) continue;
      // If there's a parent above, attach as subtask. Otherwise treat
      // as its own flat task (so a pure bullet list still imports
      // sensibly with no forced subtasks).
      if (groups.length > 0) groups[groups.length - 1].subs.push(content);
      else groups.push({ parent: content, subs: [] });
    } else {
      groups.push({ parent: raw.trim(), subs: [] });
    }
  }
  return groups;
}

function parseQuickAdd(input: string): Omit<Task, "id" | "addedAt"> {
  let title = input;
  let priority: Priority = "MEDIUM";
  let category = "MARKETING OPS";
  let dueDate: string | undefined;
  const tags: string[] = [];

  const priMap: Record<string, Priority> = { high: "HIGH", h: "HIGH", med: "MEDIUM", medium: "MEDIUM", m: "MEDIUM", week: "THIS WEEK", w: "THIS WEEK", thisweek: "THIS WEEK", ongoing: "ONGOING", o: "ONGOING" };
  const priRe = /!(\w+)/g;
  title = title.replace(priRe, (_m, w) => {
    const v = priMap[(w as string).toLowerCase()];
    if (v) priority = v;
    return "";
  });

  const catMap: Record<string, string> = {
    design: "GRAPHIC DESIGN", graphic: "GRAPHIC DESIGN", gd: "GRAPHIC DESIGN",
    marketing: "MARKETING OPS", ops: "MARKETING OPS", mo: "MARKETING OPS",
    video: "VIDEO PRODUCTION", production: "VIDEO PRODUCTION", vp: "VIDEO PRODUCTION",
    brand: "BRAND / IDENTITY", identity: "BRAND / IDENTITY",
    dev: "DEV / ACCESS", access: "DEV / ACCESS",
    content: "CONTENT OPS", co: "CONTENT OPS",
    podcast: "PODCAST", pod: "PODCAST",
    events: "EVENTS", event: "EVENTS",
    research: "RESEARCH", r: "RESEARCH",
    admin: "ADMIN",
    other: "OTHER",
  };
  const catRe = /@(\w+)/g;
  title = title.replace(catRe, (_m, w) => {
    const v = catMap[(w as string).toLowerCase()];
    if (v) category = v;
    return "";
  });

  const dueRe = /\bdue:(\S+)/i;
  const dueMatch = title.match(dueRe);
  if (dueMatch) {
    dueDate = parseDueWord(dueMatch[1]);
    title = title.replace(dueMatch[0], "");
  }

  const tagRe = /#(\w[\w-]*)/g;
  title = title.replace(tagRe, (_m, w) => { tags.push(w); return ""; });

  title = title.replace(/\s+/g, " ").trim();

  return {
    title,
    category,
    priority,
    dueDate,
    tags: tags.length ? tags : undefined,
    source: "quick",
  };
}

function parseDueWord(w: string): string | undefined {
  if (/^\d{4}-\d{2}-\d{2}$/.test(w)) return w;
  const lc = w.toLowerCase();
  const today = startOfDay(new Date());
  if (lc === "today") return isoDate(today);
  if (lc === "tomorrow" || lc === "tmrw" || lc === "tom") { const d = new Date(today); d.setDate(d.getDate() + 1); return isoDate(d); }
  if (lc === "yesterday") { const d = new Date(today); d.setDate(d.getDate() - 1); return isoDate(d); }
  if (lc === "nextweek" || lc === "nw") { const d = new Date(today); d.setDate(d.getDate() + 7); return isoDate(d); }
  const days = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
  const idx = days.findIndex((d) => lc.startsWith(d));
  if (idx >= 0) {
    const d = new Date(today);
    const diff = (idx - d.getDay() + 7) % 7 || 7;
    d.setDate(d.getDate() + diff);
    return isoDate(d);
  }
  return undefined;
}

// ── Save indicator ──────────────────────────────────────────────────
function SaveIndicator({ state, error, onRetry }: { state: "idle" | "saving" | "saved" | "error"; error: string | null; onRetry: () => void }) {
  const [showFull, setShowFull] = useState(false);
  if (state === "idle") return null;
  if (state === "saving") {
    return <span style={{ fontFamily: mn, fontSize: 10, letterSpacing: 0.6, color: D.txm, display: "inline-flex", alignItems: "center", gap: 6, padding: "3px 9px", borderRadius: 999, background: "rgba(255,255,255,0.04)", border: `1px solid ${D.border}` }}>
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: D.amber, animation: "tbPulse 1.1s ease-in-out infinite" }} />
      Saving
      <style dangerouslySetInnerHTML={{ __html: "@keyframes tbPulse{0%,100%{opacity:0.35}50%{opacity:1}}" }} />
    </span>;
  }
  if (state === "saved") {
    return <span style={{ fontFamily: mn, fontSize: 10, letterSpacing: 0.6, color: D.teal, display: "inline-flex", alignItems: "center", gap: 6, padding: "3px 9px", borderRadius: 999, background: D.teal + "12", border: `1px solid ${D.teal}40` }}>✓ Saved</span>;
  }
  // Error state — show inline expandable so the actual cause is visible.
  return (
    <span style={{ display: "inline-flex", flexDirection: "column", alignItems: "stretch", gap: 4 }}>
      <span style={{ fontFamily: mn, fontSize: 10, letterSpacing: 0.6, color: D.coral, display: "inline-flex", alignItems: "center", gap: 8, padding: "4px 10px", borderRadius: 8, background: D.coral + "16", border: `1px solid ${D.coral}55` }}>
        ⚠ Save failed — your changes are LOCAL ONLY, reload will lose them
        <button type="button" onClick={onRetry} style={{ background: D.coral, border: "none", color: "#060608", cursor: "pointer", fontFamily: mn, fontSize: 10, padding: "2px 8px", borderRadius: 4, fontWeight: 700, letterSpacing: 0.4 }}>retry</button>
        <button type="button" onClick={() => setShowFull((v) => !v)} style={{ background: "transparent", border: `1px solid ${D.coral}55`, color: D.coral, cursor: "pointer", fontFamily: mn, fontSize: 10, padding: "2px 8px", borderRadius: 4, letterSpacing: 0.4 }}>{showFull ? "hide" : "why?"}</button>
        {error ? (
          <button
            type="button"
            onClick={() => { if (error) navigator.clipboard?.writeText(error); }}
            style={{ background: "transparent", border: `1px solid ${D.coral}55`, color: D.coral, cursor: "pointer", fontFamily: mn, fontSize: 10, padding: "2px 8px", borderRadius: 4, letterSpacing: 0.4 }}
          >
            copy
          </button>
        ) : null}
      </span>
      {showFull && error ? (
        <span style={{ fontFamily: mn, fontSize: 11, color: D.coral, padding: "8px 12px", background: D.coral + "0a", border: `1px solid ${D.coral}40`, borderRadius: 8, whiteSpace: "pre-wrap", maxWidth: 720, lineHeight: 1.5, letterSpacing: 0.2 }}>
          {error}
        </span>
      ) : null}
    </span>
  );
}

// ── Skeleton view (loading state that matches the eventual layout) ─
function SkeletonView() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {[0, 1].map((g) => (
        <div key={g}>
          <div style={{ width: 110, height: 12, background: D.surface, borderRadius: 4, marginBottom: 10, opacity: 0.7 }} />
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {[0, 1, 2, 3].map((r) => (
              <div key={r} style={{ background: D.surface, border: `1px solid ${D.border}`, borderRadius: 10, padding: "10px 14px", display: "flex", alignItems: "center", gap: 14, height: 44, opacity: 0.55, animation: `tbSk 1.3s ease-in-out infinite ${(g * 4 + r) * 80}ms` }}>
                <div style={{ width: 14, height: 14, borderRadius: "50%", background: D.border, flexShrink: 0 }} />
                <div style={{ width: 110, height: 14, borderRadius: 4, background: D.border, flexShrink: 0 }} />
                <div style={{ flex: 1, height: 12, borderRadius: 4, background: D.border, opacity: 0.6 }} />
                <div style={{ width: 60, height: 10, borderRadius: 4, background: D.border, opacity: 0.5 }} />
              </div>
            ))}
          </div>
        </div>
      ))}
      <style dangerouslySetInnerHTML={{ __html: "@keyframes tbSk{0%,100%{opacity:0.4}50%{opacity:0.7}}" }} />
    </div>
  );
}

const lbl: React.CSSProperties = { fontFamily: mn, fontSize: 10, letterSpacing: 1.2, textTransform: "uppercase", color: D.txd, marginBottom: 4 };
const inputStyle: React.CSSProperties = { width: "100%", padding: "8px 10px", background: "rgba(255,255,255,0.03)", border: `1px solid ${D.border}`, borderRadius: 6, color: D.tx, fontFamily: ft, fontSize: 13, outline: "none", boxSizing: "border-box" };
const primaryBtn: React.CSSProperties = { background: D.amber, color: "#060608", border: "none", padding: "9px 18px", borderRadius: 8, fontFamily: ft, fontSize: 13, fontWeight: 800, cursor: "pointer", letterSpacing: 0.3 };
const ghostBtn: React.CSSProperties = { background: "transparent", color: D.tx, border: `1px solid ${D.border}`, padding: "9px 14px", borderRadius: 8, fontFamily: ft, fontSize: 12, cursor: "pointer" };
const emptyBox: React.CSSProperties = { border: `1px dashed ${D.border}`, borderRadius: 12, padding: 28, background: D.surface, color: D.txm, fontFamily: ft, fontSize: 14, lineHeight: 1.5 };
const overlay: React.CSSProperties = { position: "fixed", inset: 0, background: "rgba(6,6,12,0.78)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)", zIndex: 12000, display: "flex", alignItems: "safe center", justifyContent: "center", overflowY: "auto", padding: 24 };
const panel: React.CSSProperties = { width: "min(680px, 96vw)", background: "#0A0A14", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: "26px 28px 22px", maxHeight: "calc(100vh - 48px)", overflowY: "auto" };
