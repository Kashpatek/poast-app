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
import { createPortal } from "react-dom";
import { D, ft, gf, mn } from "./shared-constants";
import { useUser, isAkash } from "./user-context";
import { confirmDialog } from "./dialog-context";

type Priority = "HIGH" | "MEDIUM" | "THIS WEEK" | "ONGOING" | "DONE";
type AddMode = "manual" | "prompt" | "image";
type ViewType = "list" | "board" | "calendar" | "week" | "focus" | "category";
type SortType = "manual" | "due" | "added" | "alpha";
type FilterChip = "all" | "today" | "overdue" | "week" | "nodue" | "pinned";
type GroupBy = "priority" | "category" | "due" | "assignee";

interface Subtask {
  id: string;
  title: string;
  done?: boolean;
}

// Dated comment entry on a task. Used so notes can read as a log
// instead of one ever-growing freeform text blob — easier to see what
// happened when, esp. for shared / multi-day work.
interface NoteEntry {
  id: string;
  ts: string;          // ISO datetime when entry was added
  author?: string;     // optional; we just stamp with current user when known
  text: string;
}

type Recurrence = "daily" | "weekly" | "monthly";

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
  // Who is on the hook for this task. Defaults to "Akash" (owner of the
  // board). "Unassigned" surfaces tasks waiting for an owner.
  assignee?: string;
  subtasks?: Subtask[];
  // ISO datetime — when the user time-blocked this task on the Daily
  // Planner. Drives where it renders in the hour timeline. May or may
  // not be the same day as dueDate (you can block tomorrow's work today).
  scheduledFor?: string;
  // Optional estimate in minutes, used by the planner to size the
  // timeline block. Defaults to 30 if not set.
  estimateMins?: number;
  source?: "manual" | "prompt" | "image" | "quick" | "recurring";
  addedAt: string;
  updatedAt?: string;
  // Manual ordering hint inside a group (lower = higher on the list).
  // Set by drag-reorder; tasks without it sort after manually-ordered
  // ones, then by addedAt.
  manualOrder?: number;
  // Recurring template flag. When set, an unfinished instance gets
  // auto-spawned each period and the template itself stays "template"
  // (never displayed). Templates are identified by `isRecurringTemplate`
  // and the rolling instances reference the template via `recurringFrom`.
  recurrence?: Recurrence;
  recurrenceAnchor?: string;     // ISO date — anchor for weekly/monthly cadence
  isRecurringTemplate?: boolean; // hidden from views; only spawns children
  recurringFrom?: string;        // child task → parent template id
  lastSpawnedFor?: string;       // template → last ISO date we minted an instance for
  // Dated entry list. Lives alongside the legacy `notes` string so
  // existing data renders unchanged; the modal appends new comments
  // here so a multi-day task reads as a thread.
  notesLog?: NoteEntry[];
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

// SemiAnalysis marketing roster. Akash is the board owner — every task
// defaults to him; he reassigns out to the team via the avatar popover.
// "Unassigned" is a real bucket (lets a task wait for an owner without
// faking ownership).
interface AssigneeSpec { id: string; name: string; initial: string; color: string }
const ASSIGNEES: AssigneeSpec[] = [
  { id: "Akash",      name: "Akash",      initial: "A", color: "#F7B041" },
  { id: "Daksh",      name: "Daksh",      initial: "D", color: "#0B86D1" },
  { id: "Vansh",      name: "Vansh",      initial: "V", color: "#905CCB" },
  { id: "Max",        name: "Max",        initial: "M", color: "#26C9D8" },
  { id: "Michelle",   name: "Michelle",   initial: "M", color: "#E06347" },
  { id: "Unassigned", name: "Unassigned", initial: "?", color: "#4E4B56" },
];
const ASSIGNEE_BY_ID: Record<string, AssigneeSpec> = Object.fromEntries(ASSIGNEES.map((a) => [a.id, a]));
function getAssigneeSpec(id: string | undefined): AssigneeSpec {
  if (!id) return ASSIGNEE_BY_ID.Unassigned;
  return ASSIGNEE_BY_ID[id] || ASSIGNEE_BY_ID.Unassigned;
}
const ASSIGNEE_NAMES = ASSIGNEES.map((a) => a.id);

const VIEW_OPTIONS: Array<{ id: ViewType; label: string; hint: string }> = [
  { id: "list",     label: "List",     hint: "1" },
  { id: "board",    label: "Board",    hint: "2" },
  { id: "calendar", label: "Calendar", hint: "3" },
  { id: "week",     label: "Week",     hint: "4" },
  { id: "focus",    label: "Focus",    hint: "5" },
  { id: "category", label: "Category", hint: "6" },
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
  const [groupBy, setGroupBy] = useState<GroupBy>("priority");
  const [sortBy, setSortBy] = useState<SortType>("manual");
  const [showDone, setShowDone] = useState(false);
  const [filter, setFilter] = useState("");
  const [filterChip, setFilterChip] = useState<FilterChip>("all");
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [assigneeFilter, setAssigneeFilter] = useState<string | null>(null);
  const [addingMode, setAddingMode] = useState<AddMode | null>(null);
  const [boardModalOpen, setBoardModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [focusModeTask, setFocusModeTask] = useState<Task | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  // Undo / activity log. Each entry is a snapshot of the full archive
  // taken BEFORE the labeled action ran, so restoring the entry
  // rewinds the board to that exact state. Capped at 60 entries so
  // memory stays bounded.
  interface HistoryEntry { id: string; ts: string; label: string; archive: BoardArchive }
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const isRestoringRef = useRef(false);
  function pushHistory(label: string) {
    if (isRestoringRef.current) return;
    setHistory((cur) => {
      const entry: HistoryEntry = {
        id: "h-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6),
        ts: new Date().toISOString(),
        label,
        archive: JSON.parse(JSON.stringify(archive)) as BoardArchive,
      };
      const next = [...cur, entry];
      return next.length > 60 ? next.slice(next.length - 60) : next;
    });
  }
  function undo() {
    if (history.length === 0) return;
    const last = history[history.length - 1];
    isRestoringRef.current = true;
    setArchive(last.archive);
    setHistory((cur) => cur.slice(0, -1));
    setTimeout(() => { isRestoringRef.current = false; }, 0);
  }
  function jumpToHistory(id: string) {
    const idx = history.findIndex((e) => e.id === id);
    if (idx < 0) return;
    isRestoringRef.current = true;
    setArchive(history[idx].archive);
    setHistory((cur) => cur.slice(0, idx));
    setHistoryOpen(false);
    setTimeout(() => { isRestoringRef.current = false; }, 0);
  }
  // Combine bucket — drag duplicates here, then merge into one task. Set
  // is insertion-ordered so the merge preview keeps the user's pick order.
  const [combineIds, setCombineIds] = useState<Set<string>>(new Set());
  const [combineOpen, setCombineOpen] = useState(false);
  const [quickAdd, setQuickAdd] = useState("");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  // hydrated flips true ONLY after a successful load. The auto-save effect
  // gates on it, so a failed load can never overwrite the stored board with
  // the empty default (the real cause of the "my tasks vanished" scare).
  const [hydrated, setHydrated] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const searchRef = useRef<HTMLInputElement>(null);
  const quickRef = useRef<HTMLInputElement>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedRef = useRef<string>("");
  const savedFlashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Load / persist ──────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch("/api/db?table=projects");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
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
      // Spawn any recurring templates that are due. Walks every board's
      // task list, finds templates, and mints instances for any period
      // boundary they've crossed since lastSpawnedFor. Runs before the
      // initial snapshot so the auto-save effect catches the new tasks.
      data.boards = data.boards.map((b) => ({
        ...b,
        tasks: spawnDueRecurring(b.tasks),
      }));
      // Snapshot what we loaded so the auto-save effect doesn't fire on the
      // initial render purely from setArchive populating the value.
      lastSavedRef.current = JSON.stringify(data);
      setArchive(data);
      // Success → allow auto-save. Until this flips true the auto-save effect
      // is inert, so a failed/empty load can't overwrite the real board.
      setHydrated(true);
    } catch (e) {
      // Leave `hydrated` false (on first load) so we don't clobber the stored
      // board. Surface the reason for the status bar + reload affordance.
      setLoadError(e instanceof Error ? e.message : "Couldn't reach the server");
    } finally {
      setLoading(false);
    }
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
    // Gate on a successful load, not merely "not loading". A failed initial
    // load leaves hydrated=false, so this never fires and can't overwrite the
    // stored board with the empty default.
    if (!hydrated) return;
    const serialized = JSON.stringify(archive);
    if (serialized === lastSavedRef.current) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => { saveArchive(archive); }, 400);
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, [archive, hydrated, saveArchive]);

  const activeBoard = archive.boards.find((b) => b.id === archive.activeId);

  // Functional setter that always reads the latest committed `archive`,
  // so rapid sequential updates (quick-add, then a toggle, then a drag)
  // can never lose intermediate state via stale closure. The optional
  // `label` is captured into the undo history before the mutation
  // applies, so undo/jump-to entries surface meaningful actions
  // (Add task, Reorder, Bulk delete, …) instead of generic "Change".
  function updateActiveBoard(patch: Partial<Board> | ((b: Board) => Board), label?: string) {
    if (label) pushHistory(label);
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
    updateActiveBoard((b) => ({ ...b, tasks: [...expanded, ...b.tasks] }), newTasks.length === 1 ? `Added "${newTasks[0].title.slice(0, 40)}"` : `Added ${newTasks.length} tasks`);
    setAddingMode(null);
  }

  function updateTask(id: string, patch: Partial<Task>) {
    // Build a concise human label from the patch shape so the history
    // tab reads like an activity feed ("Marked done", "Reassigned to
    // Daksh") instead of generic "Edited task".
    const keys = Object.keys(patch);
    let label = "Edited task";
    const t = (activeBoard?.tasks || []).find((x) => x.id === id);
    const titleStr = t ? ` "${t.title.slice(0, 40)}"` : "";
    if (patch.done !== undefined && keys.length <= 2) label = patch.done ? "Marked done" + titleStr : "Reopened" + titleStr;
    else if (patch.assignee !== undefined && keys.length <= 2) label = `Reassigned${titleStr} to ${patch.assignee || "Unassigned"}`;
    else if (patch.priority !== undefined && keys.length <= 2) label = `Set priority${titleStr} → ${patch.priority}`;
    else if (patch.dueDate !== undefined && keys.length <= 2) label = patch.dueDate ? `Due${titleStr} → ${patch.dueDate}` : `Cleared date${titleStr}`;
    else if (patch.pinned !== undefined && keys.length <= 2) label = patch.pinned ? "Pinned" + titleStr : "Unpinned" + titleStr;
    else if (patch.subtasks !== undefined && keys.length <= 2) label = "Updated subtasks" + titleStr;
    else if (patch.manualOrder !== undefined && keys.length <= 2) label = "Reordered" + titleStr;
    else if (patch.title !== undefined) label = `Renamed${titleStr} → "${(patch.title || "").slice(0, 40)}"`;
    updateActiveBoard((b) => ({
      ...b,
      tasks: b.tasks.map((t) => (t.id === id ? { ...t, ...patch, updatedAt: new Date().toISOString() } : t)),
    }), label);
  }

  function removeTask(id: string) {
    const t = (activeBoard?.tasks || []).find((x) => x.id === id);
    updateActiveBoard((b) => ({ ...b, tasks: b.tasks.filter((t) => t.id !== id) }), `Removed "${(t?.title || "task").slice(0, 40)}"`);
  }

  // ── Bulk-selection helpers ──────────────────────────────────────
  function toggleSelected(id: string) {
    setSelectedIds((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }
  function clearSelection() { setSelectedIds(new Set()); }
  function bulkPatch(patch: Partial<Task>) {
    if (selectedIds.size === 0) return;
    const n = selectedIds.size;
    const labelKey = Object.keys(patch)[0] || "field";
    const label = `Bulk ${labelKey === "done" ? (patch.done ? "marked done" : "reopened") : labelKey === "assignee" ? "reassigned" : labelKey === "priority" ? "repri" : labelKey === "pinned" ? (patch.pinned ? "pinned" : "unpinned") : "edited"} ${n}`;
    updateActiveBoard((b) => ({
      ...b,
      tasks: b.tasks.map((t) => selectedIds.has(t.id) ? { ...t, ...patch, updatedAt: new Date().toISOString() } : t),
    }), label);
  }
  async function bulkRemove() {
    if (selectedIds.size === 0) return;
    const n = selectedIds.size;
    const ok = await confirmDialog({
      title: `Remove ${n} task${n === 1 ? "" : "s"}?`,
      body: "This can't be undone from here.",
      cta: "Remove",
      variant: "danger",
    });
    if (!ok) return;
    updateActiveBoard((b) => ({ ...b, tasks: b.tasks.filter((t) => !selectedIds.has(t.id)) }), `Bulk removed ${n}`);
    clearSelection();
  }

  // ── Combine bucket helpers ─────────────────────────────────────
  function addToCombine(id: string) {
    setCombineIds((cur) => { const next = new Set(cur); next.add(id); return next; });
  }
  function removeFromCombine(id: string) {
    setCombineIds((cur) => { const next = new Set(cur); next.delete(id); return next; });
  }
  function clearCombine() { setCombineIds(new Set()); }
  function commitCombine(merged: Omit<Task, "id" | "addedAt">, sourceIds: string[]) {
    const stamp = new Date().toISOString();
    const newTask: Task = { ...merged, id: "t-" + Date.now(), addedAt: stamp };
    updateActiveBoard((b) => ({
      ...b,
      tasks: [newTask, ...b.tasks.filter((t) => !sourceIds.includes(t.id))],
    }), `Combined ${sourceIds.length} → "${(merged.title || "merged").slice(0, 40)}"`);
    clearCombine();
    setCombineOpen(false);
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
      // Recurring templates aren't real tasks — they only mint instances.
      if (t.isRecurringTemplate) return false;
      if (!showDone && (t.done || t.priority === "DONE")) return false;
      if (q) {
        const hay = `${t.title} ${t.description || ""} ${t.category} ${t.notes || ""} ${(t.tags || []).join(" ")}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (tagFilter && !(t.tags || []).includes(tagFilter)) return false;
      if (assigneeFilter) {
        const a = t.assignee || "Akash";
        if (a !== assigneeFilter) return false;
      }
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
  }, [activeBoard, filter, showDone, filterChip, tagFilter, assigneeFilter]);

  // ── Keyboard shortcuts ──────────────────────────────────────────
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement | null)?.tagName;
      const inText = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
      // Cmd/Ctrl+K opens the command palette from anywhere, including
      // inside text fields — that's the standard Linear/Notion/Slack
      // expectation and we honor it.
      if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        setPaletteOpen((v) => !v);
        return;
      }
      // ⌘Z / Ctrl+Z undoes the last action even from inside inputs.
      if ((e.metaKey || e.ctrlKey) && (e.key === "z" || e.key === "Z") && !e.shiftKey) {
        e.preventDefault();
        undo();
        return;
      }
      if (e.key === "Escape") {
        if (paletteOpen) { setPaletteOpen(false); return; }
        if (editingTask) { setEditingTask(null); return; }
        if (addingMode) { setAddingMode(null); return; }
        if (boardModalOpen) { setBoardModalOpen(false); return; }
        if (selectedIds.size > 0) { setSelectedIds(new Set()); return; }
      }
      if (inText) return;
      if (e.key === "/") { e.preventDefault(); searchRef.current?.focus(); return; }
      if (e.key === "n") { e.preventDefault(); quickRef.current?.focus(); return; }
      if (e.key === "N") { e.preventDefault(); setAddingMode("manual"); return; }
      if (e.key >= "1" && e.key <= "6") {
        const v = VIEW_OPTIONS[Number(e.key) - 1];
        if (v) setView(v.id);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editingTask, addingMode, boardModalOpen, paletteOpen, selectedIds.size, history.length]);

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
  const taskHandlers: Handlers = {
    onEdit: (t: Task) => setEditingTask(t),
    onToggleDone: (t: Task) => updateTask(t.id, { done: !t.done }),
    onTogglePin: (t: Task) => updateTask(t.id, { pinned: !t.pinned }),
    onMove: (id: string, patch: Partial<Task>) => updateTask(id, patch),
    onRemove: (id: string) => removeTask(id),
    onStartFocus: (t: Task) => setFocusModeTask(t),
    isSelected: (id: string) => selectedIds.has(id),
    anySelected: selectedIds.size > 0,
    onToggleSelected: toggleSelected,
    filterQuery: filter.trim() || undefined,
    onReorderTo: (droppedId: string, targetId: string) => {
      if (droppedId === targetId) return;
      updateActiveBoard((b) => {
        const dropped = b.tasks.find((t) => t.id === droppedId);
        const target = b.tasks.find((t) => t.id === targetId);
        if (!dropped || !target) return b;
        // Same-group key for the active groupBy. Cross-group drops fall
        // through (DropGroup handles those).
        const keyOf = (t: Task) => groupBy === "category" ? t.category
          : groupBy === "assignee" ? (t.assignee || "Akash")
          : (t.done ? "DONE" : t.priority);
        if (keyOf(dropped) !== keyOf(target)) return b;
        // Build the new order list for the group and re-stamp integer
        // manualOrder so subsequent saves persist the position.
        const group = b.tasks.filter((t) => keyOf(t) === keyOf(target)).sort(byManual);
        const without = group.filter((t) => t.id !== droppedId);
        const idx = without.findIndex((t) => t.id === targetId);
        const next = [...without.slice(0, idx), dropped, ...without.slice(idx)];
        const orderMap = new Map<string, number>();
        next.forEach((t, i) => orderMap.set(t.id, i));
        return {
          ...b,
          tasks: b.tasks.map((t) => orderMap.has(t.id) ? { ...t, manualOrder: orderMap.get(t.id) } : t),
        };
      });
    },
  };

  // Counts per priority on full board (not filtered)
  const fullCounts = PRIORITIES.map((p) => ({
    p,
    n: (activeBoard?.tasks || []).filter((t) => (t.done ? "DONE" : t.priority) === p).length,
  }));

  return (
    <div className="tb-page" style={{ position: "relative", maxWidth: 1280, margin: "0 auto", padding: "40px 32px" }}>
      {/* Ambient backdrop · two soft radial glows (amber top-right, cobalt
          bottom-left) that breathe through the page. Pointer-events:none
          so they never intercept clicks. Lives behind everything. */}
      <div aria-hidden="true" style={{
        position: "fixed", inset: 0, zIndex: -1, pointerEvents: "none",
        background: "radial-gradient(900px 600px at 85% -10%, rgba(247,176,65,0.10), transparent 60%), radial-gradient(900px 700px at -10% 110%, rgba(11,134,209,0.10), transparent 60%)",
      }} />
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes tbBreathe{0%,100%{opacity:0.55;transform:scale(1)}50%{opacity:1;transform:scale(1.03)}}
        .tb-chip{transition:transform 0.12s ease, border-color 0.12s ease, background 0.12s ease}
        .tb-chip:hover{transform:translateY(-1px)}
        /* Phone layout · the toolbar/counter row scrunches at ≤720px.
           Stack the title metadata, let the 5 priority cards wrap, and
           tuck the combine dock to the bottom so it doesn't crowd the
           right edge of a narrow screen. */
        @media (max-width: 720px) {
          .tb-page{padding:20px 14px !important;}
          .tb-counters{grid-template-columns:repeat(auto-fit,minmax(96px,1fr)) !important;}
          .tb-title{font-size:32px !important;letter-spacing:-1 !important;}
          .tb-hint{display:none !important;}
          .tb-toolbar{flex-direction:column !important;align-items:stretch !important;}
          .tb-toolbar > *{width:100% !important;}
          .tb-combine{right:8px !important;bottom:80px !important;top:auto !important;transform:none !important;max-height:50vh !important;}
        }
      ` }} />
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
          <LoadIndicator loading={loading} error={loadError} onReload={load} />
        </div>
        <h1 className="tb-title" style={{ fontFamily: ft, fontSize: 46, fontWeight: 900, letterSpacing: -1.6, margin: 0, marginBottom: 6, color: D.tx, display: "inline-flex", alignItems: "baseline", gap: 12 }}>
          <span>Task Board</span>
          <span style={{ background: "linear-gradient(120deg,#F7B041 0%,#26C9D8 50%,#F7B041 100%)", backgroundSize: "300% 100%", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", animation: "tbShim 14s linear infinite" }}>
            {activeBoard?.name || ""}
          </span>
          <style dangerouslySetInnerHTML={{ __html: "@keyframes tbShim{0%{background-position:0% 50%}100%{background-position:300% 50%}}" }} />
        </h1>
        {/* Thin animated underline · echoes the title gradient and gives
            the header a finished, intentional edge. */}
        <div aria-hidden="true" style={{ width: 96, height: 2, marginBottom: 8, borderRadius: 2, background: "linear-gradient(120deg,#F7B041,#26C9D8,#F7B041)", backgroundSize: "300% 100%", animation: "tbShim 14s linear infinite", opacity: 0.85 }} />
        <div className="tb-hint" style={{ fontFamily: ft, fontSize: 13, color: D.txm }}>
          SemiAnalysis Marketing · Akash Patel · ⌘K palette · ⌘-click multi-select · drag→Combine bucket · 1-6 views · n quick-add · / search · hover row + a/p/t/d/e/f · Esc close
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
      <div className="tb-toolbar" style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginBottom: 10 }}>
        <select
          value={archive.activeId}
          onChange={(e) => setArchive((cur) => ({ ...cur, activeId: e.target.value }))}
          style={{ ...inputStyle, width: 200 }}
        >
          {archive.boards.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <button type="button" onClick={() => setBoardModalOpen(true)} style={ghostBtn}>+ Board</button>
        <button
          type="button"
          onClick={undo}
          disabled={history.length === 0}
          title={history.length === 0 ? "Nothing to undo yet" : `Undo "${history[history.length - 1].label}" · ⌘Z`}
          style={{ ...ghostBtn, padding: "9px 11px", opacity: history.length === 0 ? 0.4 : 1, cursor: history.length === 0 ? "not-allowed" : "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}
        >
          ↶ Undo
        </button>
        <div style={{ position: "relative" }}>
          <button
            type="button"
            onClick={() => setHistoryOpen((v) => !v)}
            title="Clickable activity log — restore any prior state"
            style={{ ...ghostBtn, padding: "9px 11px", display: "inline-flex", alignItems: "center", gap: 6 }}
          >
            ⏱ History
            <span style={{ fontFamily: mn, fontSize: 9, color: D.txd, padding: "1px 6px", borderRadius: 3, background: "rgba(255,255,255,0.04)" }}>{history.length}</span>
          </button>
          {historyOpen ? (
            <div style={{ position: "absolute", top: "calc(100% + 6px)", right: 0, width: 360, maxHeight: 420, overflowY: "auto", background: "#0A0A14", border: `1px solid ${D.border}`, borderRadius: 10, boxShadow: "0 20px 50px rgba(0,0,0,0.5)", zIndex: 200, padding: 6 }}>
              <div style={{ fontFamily: mn, fontSize: 9, color: D.txd, letterSpacing: 1.2, textTransform: "uppercase", padding: "6px 10px" }}>Activity · click to restore</div>
              {history.length === 0 ? (
                <div style={{ fontFamily: mn, fontSize: 11, color: D.txd, padding: "10px 12px", textAlign: "center" }}>No actions yet</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  {[...history].reverse().map((e, idx) => (
                    <button
                      key={e.id}
                      type="button"
                      onClick={() => jumpToHistory(e.id)}
                      title="Restore the board to the state just BEFORE this action"
                      style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "7px 10px", background: idx === 0 ? "rgba(247,176,65,0.10)" : "transparent", border: "none", borderLeft: `2px solid ${idx === 0 ? D.amber : "transparent"}`, borderRadius: 4, cursor: "pointer", textAlign: "left", fontFamily: ft, fontSize: 12, color: D.tx }}
                    >
                      <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.label}</span>
                      <span style={{ fontFamily: mn, fontSize: 9, color: D.txd, letterSpacing: 0.4, flexShrink: 0 }}>{new Date(e.ts).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : null}
        </div>
        <input
          ref={searchRef}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter tasks… (/)"
          style={{ ...inputStyle, flex: 1, minWidth: 180 }}
        />
        {view === "list" || view === "board" ? (
          <select value={groupBy} onChange={(e) => setGroupBy(e.target.value as GroupBy)} style={{ ...inputStyle, width: 170 }}>
            <option value="priority">Group: Priority</option>
            <option value="category">Group: Category</option>
            <option value="assignee">Group: Assignee</option>
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
              className="tb-chip"
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
                boxShadow: active ? "0 2px 10px rgba(247,176,65,0.16)" : "none",
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
                  className="tb-chip"
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

      {/* ── Assignee filter chips ──────────────────────────────────
          Mirror of the date/pinned chip row above but for ownership.
          "All" clears, each chip filters to a single person's queue. */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center", marginBottom: 14 }}>
        <span style={{ fontFamily: mn, fontSize: 9, letterSpacing: 1.2, textTransform: "uppercase", color: D.txd, marginRight: 4 }}>Assigned</span>
        <button
          type="button"
          className="tb-chip"
          onClick={() => setAssigneeFilter(null)}
          style={{
            padding: "5px 12px",
            background: assigneeFilter === null ? "rgba(247,176,65,0.16)" : "transparent",
            color: assigneeFilter === null ? D.amber : D.txm,
            border: `1px solid ${assigneeFilter === null ? D.amber : D.border}`,
            borderRadius: 999,
            fontFamily: mn,
            fontSize: 10.5,
            fontWeight: 600,
            cursor: "pointer",
            letterSpacing: 0.4,
          }}
        >
          All
        </button>
        {ASSIGNEES.map((a) => {
          const active = assigneeFilter === a.id;
          return (
            <button
              key={a.id}
              type="button"
              className="tb-chip"
              onClick={() => setAssigneeFilter(active ? null : a.id)}
              style={{
                padding: "4px 10px 4px 4px",
                background: active ? a.color + "22" : "transparent",
                color: active ? a.color : D.txm,
                border: `1px solid ${active ? a.color : D.border}`,
                borderRadius: 999,
                fontFamily: mn,
                fontSize: 10.5,
                fontWeight: 600,
                cursor: "pointer",
                letterSpacing: 0.4,
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <Avatar spec={a} size={18} glow={active} />
              {a.name}
            </button>
          );
        })}
      </div>

      {/* ── Quick add ──────────────────────────────────────────── */}
      <div data-glass="" style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 18, background: D.surface, border: `1px solid ${D.border}`, borderRadius: 10, padding: "6px 6px 6px 14px" }}>
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
          placeholder='Quick add · "Redo ribbons !high @design +Daksh due:wed #ribbons" · Enter to add'
          style={{ ...inputStyle, border: "none", background: "transparent", padding: "8px 6px" }}
        />
        <button type="button" onClick={submitQuickAdd} disabled={!quickAdd.trim()} style={{ ...primaryBtn, opacity: quickAdd.trim() ? 1 : 0.4, padding: "7px 14px" }}>Add</button>
      </div>

      {/* ── Today hero ─────────────────────────────────────────── */}
      <TodayHero
        tasks={(activeBoard?.tasks || []).filter((t) => !t.isRecurringTemplate)}
        onStartFocus={(t) => setFocusModeTask(t)}
        onOpenTask={(t) => setEditingTask(t)}
      />
      {/* ── Priority counters (kept as quick legend below the hero) ── */}
      <div className="tb-counters" style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8, marginBottom: 20 }}>
        {fullCounts.map(({ p, n }) => {
          const color = PRIORITY_COLORS[p];
          return (
            <PriorityCounter key={p} label={p} count={n} color={color} />
          );
        })}
      </div>

      {loadError && !loading ? (
        <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 12, padding: "12px 16px", marginBottom: 16, borderRadius: 10, background: D.coral + "14", border: `1px solid ${D.coral}55`, fontFamily: mn, fontSize: 12, color: D.coral, lineHeight: 1.5 }}>
          <span style={{ flex: 1, minWidth: 240 }}>⚠ Couldn&apos;t load the latest board ({loadError}). Your saved tasks are safe in the cloud — this is a connection hiccup, not data loss.{!hydrated ? " Editing is paused until a successful reload so nothing gets overwritten." : ""}</span>
          <button type="button" onClick={load} style={{ background: D.coral, border: "none", color: "#060608", cursor: "pointer", fontFamily: mn, fontSize: 11, fontWeight: 700, padding: "6px 14px", borderRadius: 6, letterSpacing: 0.4 }}>↻ Reload</button>
        </div>
      ) : null}

      {/* ── View body ──────────────────────────────────────────── */}
      {loading ? (
        <SkeletonView />
      ) : visibleTasks.length === 0 && view !== "calendar" && view !== "week" ? (
        <div data-glass="" style={emptyBox}>
          {filter || filterChip !== "all" || tagFilter
            ? "No tasks match the current filters."
            : "No tasks yet. Type something into Quick Add, paste a Slack thread into From Prompt, or drop a screenshot into From Image."}
        </div>
      ) : view === "list" ? (
        <ListView tasks={visibleTasks} groupBy={groupBy} sortBy={sortBy} handlers={taskHandlers} />
      ) : view === "board" ? (
        <BoardView tasks={visibleTasks} groupBy={groupBy === "due" ? "priority" : groupBy as "priority" | "category" | "assignee"} handlers={taskHandlers} />
      ) : view === "calendar" ? (
        <CalendarView tasks={visibleTasks} handlers={taskHandlers} />
      ) : view === "week" ? (
        <WeekView tasks={visibleTasks} handlers={taskHandlers} />
      ) : view === "category" ? (
        <CategoryView tasks={visibleTasks} handlers={taskHandlers} />
      ) : (
        <FocusView tasks={visibleTasks} handlers={taskHandlers} />
      )}

      {/* ── Modals ─────────────────────────────────────────────── */}
      {addingMode ? (
        <AddTaskModal
          mode={addingMode}
          existingTasks={activeBoard?.tasks || []}
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
      {/* Combine bucket — visible whenever there's at least one task on
          the board so the user can always drag a duplicate there. Hidden
          on calendar / week / focus views which have their own chrome. */}
      {(view === "list" || view === "board" || view === "category") && (activeBoard?.tasks.length || 0) > 0 ? (
        <CombineDock
          ids={combineIds}
          tasks={(activeBoard?.tasks || []).filter((t) => combineIds.has(t.id))}
          onAdd={addToCombine}
          onRemove={removeFromCombine}
          onClear={clearCombine}
          onOpen={() => setCombineOpen(true)}
        />
      ) : null}
      {combineOpen ? (
        <CombineModal
          tasks={(activeBoard?.tasks || []).filter((t) => combineIds.has(t.id))}
          onCancel={() => setCombineOpen(false)}
          onCommit={commitCombine}
        />
      ) : null}
      {selectedIds.size > 0 ? (
        <BulkActionBar
          count={selectedIds.size}
          onAssign={(id) => bulkPatch({ assignee: id === "Unassigned" ? undefined : id })}
          onPriority={(p) => bulkPatch({ priority: p, done: false })}
          onDone={() => { bulkPatch({ done: true }); clearSelection(); }}
          onPin={() => bulkPatch({ pinned: true })}
          onDelete={bulkRemove}
          onClear={clearSelection}
        />
      ) : null}
      {paletteOpen ? (
        <CommandPalette
          tasks={activeBoard?.tasks || []}
          onClose={() => setPaletteOpen(false)}
          onOpenTask={(t) => { setPaletteOpen(false); setEditingTask(t); }}
          onStartFocus={(t) => { setPaletteOpen(false); setFocusModeTask(t); }}
          onSwitchView={(v) => { setPaletteOpen(false); setView(v); }}
          onSetAssigneeFilter={(a) => { setPaletteOpen(false); setAssigneeFilter(a); }}
          onSetChip={(c) => { setPaletteOpen(false); setFilterChip(c); }}
          onClearFilters={() => { setPaletteOpen(false); setFilter(""); setFilterChip("all"); setTagFilter(null); setAssigneeFilter(null); }}
          onAddTask={() => { setPaletteOpen(false); setAddingMode("manual"); }}
          onFromPrompt={() => { setPaletteOpen(false); setAddingMode("prompt"); }}
        />
      ) : null}
      {editingTask ? (
        <EditTaskModal
          task={editingTask}
          currentUser={userCtx.user?.name}
          onCancel={() => setEditingTask(null)}
          onSave={(patch) => { updateTask(editingTask.id, patch); setEditingTask(null); }}
          onRemove={async () => {
            const ok = await confirmDialog({
              title: "Remove this task?",
              body: editingTask.title,
              cta: "Remove",
              variant: "danger",
            });
            if (ok) { removeTask(editingTask.id); setEditingTask(null); }
          }}
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
  // Bulk selection — rows know whether they're selected so they can
  // light up, and a Cmd-click anywhere on the row toggles membership.
  // `anySelected` is true whenever the selection set is non-empty (the
  // row uses it to flip plain-click into a toggle, matching how Finder
  // and Notion behave in multi-select mode).
  isSelected: (id: string) => boolean;
  anySelected: boolean;
  onToggleSelected: (id: string) => void;
  // Drop a row on another row to manually reorder within the same
  // group (priority / category / assignee, whichever is the active
  // groupBy). Cross-group drops are still handled by DropGroup.
  onReorderTo: (droppedId: string, targetId: string) => void;
  // Live filter text — when set, TaskRow highlights matching substrings
  // in the title so the user can see why a row matched.
  filterQuery?: string;
}

// ── List view ──────────────────────────────────────────────────────
function ListView({ tasks, groupBy, sortBy, handlers }: { tasks: Task[]; groupBy: GroupBy; sortBy: SortType; handlers: Handlers }) {
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
    if (groupBy === "assignee") {
      return { assignee: key === "Unassigned" ? undefined : key };
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
          color={
            groupBy === "priority" ? (PRIORITY_COLORS[key as Priority] || D.txd)
            : groupBy === "assignee" ? getAssigneeSpec(key).color
            : groupBy === "category" ? (CATEGORY_COLORS[key] || D.txd)
            : null
          }
          count={gts.length}
          onDropTask={(id) => { const patch = patchForGroup(key); if (patch) handlers.onMove(id, patch); }}
          hint={`drop here to move to "${key}"`}
        >
          {gts.map((t) => <TaskRow key={t.id} task={t} handlers={handlers} />)}
        </DropGroup>
      ))}
      {grouped.length === 0 && pinned.length === 0 ? (
        <div data-glass="" style={emptyBox}>No tasks match the current filters.</div>
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
  const aSpec = getAssigneeSpec(task.assignee || "Akash");
  const due = formatDue(task.dueDate);
  const [hover, setHover] = useState(false);
  const [priorityMenuOpen, setPriorityMenuOpen] = useState(false);
  const [assigneeMenuOpen, setAssigneeMenuOpen] = useState(false);
  const [dueMenuOpen, setDueMenuOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [renameDraft, setRenameDraft] = useState(task.title);
  const [expanded, setExpanded] = useState(false);
  // Brief green pulse when a task transitions to done. Watch `task.done`
  // and flip a transient flag for 700ms; CSS keyframes handle the rest.
  const [justDone, setJustDone] = useState(false);
  const prevDoneRef = useRef<boolean>(!!task.done);
  useEffect(() => {
    const wasDone = prevDoneRef.current;
    const isDone = !!task.done;
    prevDoneRef.current = isDone;
    if (!wasDone && isDone) {
      setJustDone(true);
      const id = setTimeout(() => setJustDone(false), 700);
      return () => clearTimeout(id);
    }
  }, [task.done]);
  const anyMenuOpen = priorityMenuOpen || assigneeMenuOpen || dueMenuOpen;
  const selected = handlers.isSelected(task.id);

  const subtasks = task.subtasks || [];
  const totalSubs = subtasks.length;
  const doneSubs = subtasks.filter((s) => s.done).length;
  const hasSubs = totalSubs > 0;

  function pickPriority(p: Priority) {
    setPriorityMenuOpen(false);
    if (p === "DONE") handlers.onMove(task.id, { done: true });
    else handlers.onMove(task.id, { priority: p, done: false });
  }

  function pickAssignee(id: string) {
    setAssigneeMenuOpen(false);
    handlers.onMove(task.id, { assignee: id === "Unassigned" ? undefined : id });
  }

  function pickDue(d: string | undefined) {
    setDueMenuOpen(false);
    handlers.onMove(task.id, { dueDate: d });
  }

  // Hover hotkeys — when this row is the one under the cursor, hitting
  // a/p/d/e/f/Backspace runs the matching action. Skipped if any popover
  // is already open (so menu navigation isn't hijacked) or if focus is
  // inside a text field (so typing in another input doesn't fire).
  useEffect(() => {
    if (!hover || renaming) return;
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "a" || e.key === "A") { e.preventDefault(); setAssigneeMenuOpen((v) => !v); setPriorityMenuOpen(false); setDueMenuOpen(false); }
      else if (e.key === "p" || e.key === "P") { e.preventDefault(); setPriorityMenuOpen((v) => !v); setAssigneeMenuOpen(false); setDueMenuOpen(false); }
      else if (e.key === "t" || e.key === "T") { e.preventDefault(); setDueMenuOpen((v) => !v); setAssigneeMenuOpen(false); setPriorityMenuOpen(false); }
      else if (e.key === "d" || e.key === "D") { e.preventDefault(); handlers.onToggleDone(task); }
      else if (e.key === "e" || e.key === "E") { e.preventDefault(); handlers.onEdit(task); }
      else if (e.key === "f" || e.key === "F") { e.preventDefault(); handlers.onStartFocus(task); }
      else if (e.key === "Backspace" || e.key === "Delete") {
        if (anyMenuOpen) return;
        e.preventDefault();
        confirmDialog({
          title: "Remove task?",
          body: task.title,
          cta: "Remove",
          variant: "danger",
        }).then((ok) => { if (ok) handlers.onRemove(task.id); });
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [hover, renaming, anyMenuOpen, task, handlers]);

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
      data-glass=""
      style={{
        background: selected ? "rgba(247,176,65,0.10)" : justDone ? "rgba(46,173,142,0.10)" : D.surface,
        border: `1px solid ${selected ? D.amber : justDone ? D.teal : hover ? D.amber + "44" : D.border}`,
        borderRadius: 10,
        opacity: task.done ? 0.55 : 1,
        position: "relative",
        boxShadow: selected ? `0 0 0 2px ${D.amber}33` : justDone ? `0 0 0 2px ${D.teal}55, 0 0 22px ${D.teal}33` : (hover ? "0 4px 12px rgba(0,0,0,0.25)" : "none"),
        // When any popover (priority/assignee) is open, lift the whole
        // row above its siblings so the popover doesn't sit behind the
        // next row. (The hover `transform` below creates a stacking
        // context, so we need to raise zIndex here, not on the inner
        // popover.)
        zIndex: anyMenuOpen ? 50 : "auto",
        transition: "border-color 0.15s, box-shadow 0.15s, transform 0.15s, background 0.2s",
        // Skip the hover lift while a menu is open so we don't create
        // a new stacking context that would re-trap the popover.
        transform: hover && !anyMenuOpen ? "translateY(-1px)" : "translateY(0)",
        animation: "tbRowIn 0.2s ease",
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => { setHover(false); setPriorityMenuOpen(false); setAssigneeMenuOpen(false); setDueMenuOpen(false); }}
    >
      <style dangerouslySetInnerHTML={{ __html: "@keyframes tbRowIn{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:translateY(0)}}@keyframes tbBurst{0%{opacity:0;transform:translate(-50%,-50%) scale(0.4)}30%{opacity:1;transform:translate(-50%,-50%) scale(1.05)}70%{opacity:1;transform:translate(-50%,-50%) scale(1)}100%{opacity:0;transform:translate(-50%,-50%) scale(1.4)}}" }} />
      {justDone ? (
        <div aria-hidden="true" style={{ position: "absolute", left: 24, top: "50%", transform: "translate(-50%,-50%)", width: 28, height: 28, borderRadius: "50%", background: D.teal, color: "#06060C", fontFamily: gf, fontSize: 16, fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 0 24px ${D.teal}`, pointerEvents: "none", zIndex: 60, animation: "tbBurst 0.7s ease-out forwards" }}>
          ✓
        </div>
      ) : null}
      <div
        draggable={!renaming}
        onDragStart={(e) => { e.dataTransfer.setData("text/plain", task.id); e.dataTransfer.effectAllowed = "move"; }}
        onDragOver={(e) => { if (e.dataTransfer.types.includes("text/plain")) e.preventDefault(); }}
        onDrop={(e) => {
          const dropped = e.dataTransfer.getData("text/plain");
          if (!dropped || dropped === task.id) return;
          // Stop the bubble so DropGroup doesn't also fire and patch
          // priority/category for what was meant as an in-group reorder.
          e.preventDefault();
          e.stopPropagation();
          handlers.onReorderTo(dropped, task.id);
        }}
        onClick={(e) => {
          if (renaming) return;
          if ((e.target as HTMLElement).closest("[data-no-row-click]")) return;
          // Cmd/Ctrl-click always toggles selection. Once anything is
          // selected, a plain click also toggles — so the user can
          // multi-select without holding Cmd after the first one. This
          // matches Finder/Notion's multi-select UX.
          if (e.metaKey || e.ctrlKey || handlers.anySelected) {
            handlers.onToggleSelected(task.id);
            return;
          }
          handlers.onEdit(task);
        }}
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
                <Highlight text={task.title} q={handlers.filterQuery} />
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
            title={`${doneSubs} of ${totalSubs} subtasks done · click to ${expanded ? "collapse" : "expand"}`}
            style={{
              background: "transparent", border: "none", padding: "2px 4px",
              cursor: "pointer", flexShrink: 0, lineHeight: 1,
              display: "inline-flex", alignItems: "center", gap: 4,
              borderRadius: 4,
            }}
          >
            <SubtaskRing done={doneSubs} total={totalSubs} color={doneSubs === totalSubs ? D.teal : D.violet} />
            <span style={{ fontFamily: mn, fontSize: 8, color: D.txd, lineHeight: 1 }}>{expanded ? "▾" : "▸"}</span>
          </button>
        ) : null}
      {/* Quick assignee change — click the avatar bubble to reassign. */}
      <div style={{ position: "relative", flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          onClick={() => { setAssigneeMenuOpen((v) => !v); setPriorityMenuOpen(false); }}
          title={`Assigned to ${aSpec.name} — click to reassign`}
          style={{
            background: "transparent",
            border: "none",
            padding: 0,
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            lineHeight: 1,
          }}
        >
          <Avatar spec={aSpec} size={20} glow={hover || assigneeMenuOpen} />
        </button>
        {assigneeMenuOpen ? (
          <div style={{ position: "absolute", top: "calc(100% + 6px)", right: 0, background: D.bg, border: `1px solid ${D.border}`, borderRadius: 8, padding: 4, zIndex: 100, boxShadow: "0 6px 24px rgba(0,0,0,0.4)", display: "flex", flexDirection: "column", gap: 2, minWidth: 160 }}>
            {ASSIGNEES.map((a) => {
              const active = (task.assignee || "Akash") === a.id;
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => pickAssignee(a.id)}
                  style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 8px", background: active ? a.color + "22" : "transparent", color: active ? a.color : D.tx, border: "none", borderRadius: 4, fontFamily: mn, fontSize: 10.5, letterSpacing: 0.4, cursor: "pointer", textAlign: "left" }}
                >
                  <Avatar spec={a} size={16} />
                  {a.name}
                </button>
              );
            })}
          </div>
        ) : null}
      </div>

      {/* Quick priority change — click the pill to open a popover. */}
      <div style={{ position: "relative", flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          onClick={() => { setPriorityMenuOpen((v) => !v); setAssigneeMenuOpen(false); }}
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
      <div style={{ position: "relative", flexShrink: 0, minWidth: due ? 60 : 0, textAlign: "right" }} onClick={(e) => e.stopPropagation()}>
        {due ? (
          <button
            type="button"
            data-no-row-click
            onClick={() => { setDueMenuOpen((v) => !v); setAssigneeMenuOpen(false); setPriorityMenuOpen(false); }}
            title="Click to retarget · t to toggle"
            style={{ background: "transparent", border: `1px solid ${dueMenuOpen ? (due.urgent ? D.coral : D.amber) : "transparent"}`, color: due.urgent ? D.coral : D.txm, fontFamily: mn, fontSize: 10, letterSpacing: 0.4, padding: "2px 6px", borderRadius: 4, cursor: "pointer", lineHeight: 1.4 }}
          >
            {due.label}
          </button>
        ) : hover ? (
          <button
            type="button"
            data-no-row-click
            onClick={() => { setDueMenuOpen((v) => !v); setAssigneeMenuOpen(false); setPriorityMenuOpen(false); }}
            title="Add a due date · t to toggle"
            style={{ background: "transparent", border: `1px dashed ${D.border}`, color: D.txd, fontFamily: mn, fontSize: 9, letterSpacing: 0.4, padding: "2px 7px", borderRadius: 4, cursor: "pointer", lineHeight: 1.4 }}
          >
            + Date
          </button>
        ) : null}
        {dueMenuOpen ? <DueMenu current={task.dueDate} onPick={pickDue} /> : null}
      </div>
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
function BoardView({ tasks, groupBy, handlers }: { tasks: Task[]; groupBy: "priority" | "category" | "assignee"; handlers: Handlers }) {
  const cols = groupBy === "priority"
    ? PRIORITIES.filter((p) => p !== "DONE").map((p) => ({ key: p, color: PRIORITY_COLORS[p] }))
    : groupBy === "assignee"
    ? ASSIGNEES.map((a) => ({ key: a.id, color: a.color }))
    : CATEGORIES.map((c) => ({ key: c, color: CATEGORY_COLORS[c] || D.txm }));

  function dropPatch(colKey: string): Partial<Task> {
    if (groupBy === "priority") return { priority: colKey as Priority, done: false };
    if (groupBy === "assignee") return { assignee: colKey === "Unassigned" ? undefined : colKey };
    return { category: colKey };
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(cols.length, 4)}, 1fr)`, gap: 12, overflowX: "auto" }}>
      {cols.map((col) => {
        const colTasks = tasks.filter((t) => (
          groupBy === "priority" ? (t.done ? "DONE" : t.priority) === col.key
          : groupBy === "assignee" ? (t.assignee || "Akash") === col.key
          : t.category === col.key
        ));
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
      data-glass=""
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
  const aSpec = getAssigneeSpec(task.assignee || "Akash");
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
        <Avatar spec={aSpec} size={16} />
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
    <ModalPortal>
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
          <div data-glass="" style={emptyBox}>No tasks scheduled for this day.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {tasks.map((t) => <TaskRow key={t.id} task={t} handlers={handlers} />)}
          </div>
        )}
      </div>
    </div>
    </ModalPortal>
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
      data-glass=""
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
        <div data-glass="" style={{ background: D.surface, border: `1px solid ${D.border}`, borderRadius: 12, padding: 12 }}>
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
            <div data-glass="" style={emptyBox}>Inbox zero. Or just no tasks queued for this stretch. Add some via Quick Add.</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

// ── Category view ───────────────────────────────────────────────────
// Tab row across the top (one tab per category that has tasks, plus
// "All"), and a clean list below. Dropping a task on a tab reassigns
// its category — so this doubles as a category-router. The tab order
// matches the canonical CATEGORIES list so muscle memory persists.
function CategoryView({ tasks, handlers }: { tasks: Task[]; handlers: Handlers }) {
  const counts: Record<string, number> = {};
  tasks.forEach((t) => { counts[t.category] = (counts[t.category] || 0) + 1; });
  // Show every canonical category that has at least one task, in the
  // canonical order. Anything non-canonical falls into "OTHER".
  const tabs: string[] = ["__ALL__", ...CATEGORIES.filter((c) => (counts[c] || 0) > 0)];
  const [active, setActive] = useState<string>("__ALL__");
  const filtered = active === "__ALL__" ? tasks : tasks.filter((t) => t.category === active);

  return (
    <div>
      <div style={{ display: "flex", gap: 4, marginBottom: 14, flexWrap: "wrap", borderBottom: `1px solid ${D.border}`, paddingBottom: 1 }}>
        {tabs.map((c) => {
          const isAll = c === "__ALL__";
          const color = isAll ? D.amber : (CATEGORY_COLORS[c] || D.txm);
          const isActive = active === c;
          const n = isAll ? tasks.length : (counts[c] || 0);
          return (
            <CategoryTab
              key={c}
              label={isAll ? "All" : c}
              color={color}
              count={n}
              active={isActive}
              onClick={() => setActive(c)}
              onDropTask={isAll ? undefined : (id) => handlers.onMove(id, { category: c })}
            />
          );
        })}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {filtered.length === 0 ? (
          <div data-glass="" style={emptyBox}>No tasks in this category.</div>
        ) : filtered.map((t) => <TaskRow key={t.id} task={t} handlers={handlers} />)}
      </div>
    </div>
  );
}

function CategoryTab({ label, color, count, active, onClick, onDropTask }: { label: string; color: string; count: number; active: boolean; onClick: () => void; onDropTask?: (id: string) => void }) {
  const [over, setOver] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      onDragOver={onDropTask ? (e) => { e.preventDefault(); if (!over) setOver(true); } : undefined}
      onDragLeave={onDropTask ? () => setOver(false) : undefined}
      onDrop={onDropTask ? (e) => { e.preventDefault(); setOver(false); const id = e.dataTransfer.getData("text/plain"); if (id) onDropTask(id); } : undefined}
      style={{
        position: "relative",
        padding: "8px 14px",
        background: over ? color + "22" : active ? color + "16" : "transparent",
        color: over ? color : active ? color : D.txm,
        border: "none",
        borderBottom: `2px solid ${over ? color : active ? color : "transparent"}`,
        borderRadius: 0,
        fontFamily: mn,
        fontSize: 10.5,
        fontWeight: active ? 800 : 600,
        cursor: "pointer",
        letterSpacing: 0.6,
        textTransform: "uppercase",
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        transition: "color 0.12s, background 0.12s, border-color 0.12s",
        marginBottom: -1,
      }}
    >
      {label}
      <span style={{ fontFamily: mn, fontSize: 9, padding: "1px 6px", borderRadius: 3, background: active || over ? color + "33" : "rgba(255,255,255,0.05)", color: active || over ? color : D.txd, letterSpacing: 0.3 }}>{count}</span>
    </button>
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
    <div data-glass="" style={{ background: D.surface, border: `1px solid ${color}33`, borderRadius: 10, padding: 10 }}>
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
    <ModalPortal>
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
        <div data-glass="" style={{ display: "flex", alignItems: "center", gap: 18, padding: "12px 16px", background: D.surface, border: `1px solid ${D.border}`, borderRadius: 12 }}>
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
          <div data-glass="" style={{ background: D.surface, border: `1px solid ${D.border}`, borderRadius: 12, padding: "14px 18px" }}>
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
    </ModalPortal>
  );
}

// ════════════════════════════════════════════════════════════════════
// Modals
// ════════════════════════════════════════════════════════════════════

// ── Edit Task Modal ────────────────────────────────────────────────
function EditTaskModal({ task, currentUser, onCancel, onSave, onRemove }: { task: Task; currentUser?: string; onCancel: () => void; onSave: (patch: Partial<Task>) => void; onRemove: () => void }) {
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description || "");
  const [category, setCategory] = useState(task.category);
  const [priority, setPriority] = useState<Priority>(task.priority);
  const [assignee, setAssignee] = useState<string>(task.assignee || "Akash");
  const [dueDate, setDueDate] = useState(task.dueDate || "");
  const [notes, setNotes] = useState(task.notes || "");
  const [tags, setTags] = useState((task.tags || []).join(", "));
  const [pinned, setPinned] = useState(!!task.pinned);
  const [done, setDone] = useState(!!task.done);
  const [subtasks, setSubtasks] = useState<Subtask[]>(task.subtasks || []);
  const [subDraft, setSubDraft] = useState("");
  // Recurring: "none" or one of Recurrence. Anchor defaults to today
  // (or task's dueDate if set) so weekly/monthly cadence has a sensible
  // start day. Save() bakes these onto the task and flips it to a
  // template so future spawns happen automatically.
  const [recurrence, setRecurrence] = useState<Recurrence | "none">(task.recurrence || (task.isRecurringTemplate ? "weekly" : "none"));
  const [recurrenceAnchor, setRecurrenceAnchor] = useState<string>(task.recurrenceAnchor || task.dueDate || isoDate(new Date()));
  // Threaded notes: keep the existing list and let the user append.
  const [notesLog, setNotesLog] = useState<NoteEntry[]>(task.notesLog || []);
  const [logDraft, setLogDraft] = useState("");
  // Clicking a task opens this modal in read-only "view" first; the pencil
  // switches to the full "edit" form. Esc / overlay closes either mode.
  const [mode, setMode] = useState<"view" | "edit">("view");
  // If the modal instance is reused for a different task, reset to view.
  useEffect(() => { setMode("view"); }, [task.id]);

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

  function addLogEntry() {
    const text = logDraft.trim();
    if (!text) return;
    setNotesLog((cur) => [...cur, { id: "n-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6), ts: new Date().toISOString(), author: currentUser, text }]);
    setLogDraft("");
  }
  function removeLogEntry(id: string) { setNotesLog((cur) => cur.filter((e) => e.id !== id)); }

  function save() {
    if (!title.trim()) return;
    const isTemplate = recurrence !== "none";
    onSave({
      title: title.trim(),
      description: description.trim() || undefined,
      category,
      priority,
      assignee: assignee === "Unassigned" ? undefined : assignee,
      dueDate: dueDate || undefined,
      notes: notes.trim() || undefined,
      tags: tags.split(",").map((t) => t.trim().replace(/^#/, "")).filter(Boolean),
      pinned,
      done,
      subtasks: subtasks.length > 0 ? subtasks.map((s) => ({ ...s, title: s.title.trim() })).filter((s) => s.title) : undefined,
      // Recurring template flip. Saving the task with recurrence !== "none"
      // turns it into a hidden template — child instances mint on load.
      isRecurringTemplate: isTemplate ? true : undefined,
      recurrence: isTemplate ? (recurrence as Recurrence) : undefined,
      recurrenceAnchor: isTemplate ? recurrenceAnchor : undefined,
      // Threaded notes — null out the array when empty so the row never
      // renders an "Activity (0)" badge.
      notesLog: notesLog.length > 0 ? notesLog : undefined,
    });
  }

  const pill = (c: string): React.CSSProperties => ({ fontFamily: mn, fontSize: 9.5, fontWeight: 700, letterSpacing: 0.4, textTransform: "uppercase", color: c, background: c + "1c", border: `1px solid ${c}44`, borderRadius: 999, padding: "3px 9px" });
  const pColorV = PRIORITY_COLORS[(task.done ? "DONE" : task.priority) as Priority] || D.txd;
  const cColorV = CATEGORY_COLORS[task.category] || D.txm;
  const dueStrV = task.dueDate ? new Date(task.dueDate + "T00:00:00").toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }) : "—";
  const viewBlock = (
    <>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 14 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: gf, fontSize: 20, fontWeight: 800, color: D.tx, letterSpacing: -0.4, lineHeight: 1.25, textDecoration: task.done ? "line-through" : "none", opacity: task.done ? 0.65 : 1 }}>{task.title}</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 9 }}>
            <span style={pill(pColorV)}>{task.done ? "DONE" : task.priority}</span>
            <span style={pill(cColorV)}>{task.category}</span>
            {task.pinned ? <span style={pill(D.amber)}>★ Pinned</span> : null}
            {task.assignee ? <span style={pill(D.txm)}>{task.assignee}</span> : null}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
          <button type="button" onClick={() => setMode("edit")} title="Edit task" style={{ background: D.amber, color: "#060608", border: "none", padding: "7px 14px", borderRadius: 8, fontFamily: ft, fontSize: 12.5, fontWeight: 700, cursor: "pointer", letterSpacing: 0.2 }}>✎ Edit</button>
          <button type="button" onClick={onCancel} title="Close" style={{ background: "transparent", border: `1px solid ${D.border}`, color: D.txm, width: 32, height: 32, borderRadius: 8, cursor: "pointer", fontFamily: mn, fontSize: 15, lineHeight: 1 }}>×</button>
        </div>
      </div>
      {task.description ? <div style={{ fontFamily: ft, fontSize: 14, color: D.tx, lineHeight: 1.55, whiteSpace: "pre-wrap", marginBottom: 14, padding: "12px 14px", background: D.surface, border: `1px solid ${D.border}`, borderRadius: 10 }}>{task.description}</div> : null}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
        <div><div style={lbl}>Assignee</div><div style={{ fontFamily: ft, fontSize: 13.5, color: D.tx, marginTop: 3 }}>{task.assignee || "Unassigned"}</div></div>
        <div><div style={lbl}>Due date</div><div style={{ fontFamily: ft, fontSize: 13.5, color: D.tx, marginTop: 3 }}>{dueStrV}</div></div>
      </div>
      {task.tags && task.tags.length ? (
        <div style={{ marginBottom: 14 }}>
          <div style={lbl}>Tags</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 5 }}>{task.tags.map((t) => <span key={t} style={{ fontFamily: mn, fontSize: 10, color: D.txm, background: D.surface, border: `1px solid ${D.border}`, borderRadius: 999, padding: "3px 10px" }}>#{t}</span>)}</div>
        </div>
      ) : null}
      {task.subtasks && task.subtasks.length ? (
        <div style={{ marginBottom: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}><div style={lbl}>Subtasks</div><div style={{ fontFamily: mn, fontSize: 9, color: D.txd }}>{task.subtasks.filter((s) => s.done).length}/{task.subtasks.length} done</div></div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>{task.subtasks.map((s) => (
            <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 9px", background: D.surface, border: `1px solid ${D.border}`, borderRadius: 6 }}>
              <span style={{ width: 13, height: 13, borderRadius: 3, background: s.done ? D.teal : "transparent", border: `1.5px solid ${s.done ? D.teal : D.border}`, flexShrink: 0, display: "grid", placeItems: "center", color: "#060608", fontSize: 9 }}>{s.done ? "✓" : ""}</span>
              <span style={{ flex: 1, fontFamily: ft, fontSize: 13, color: s.done ? D.txd : D.tx, textDecoration: s.done ? "line-through" : "none" }}>{s.title}</span>
            </div>
          ))}</div>
        </div>
      ) : null}
      {task.notes ? (
        <div style={{ marginBottom: 14 }}><div style={lbl}>Notes</div><div style={{ fontFamily: ft, fontSize: 13, color: D.tx, lineHeight: 1.5, whiteSpace: "pre-wrap", marginTop: 4 }}>{task.notes}</div></div>
      ) : null}
      {task.notesLog && task.notesLog.length ? (
        <div><div style={lbl}>Activity</div><div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 5, maxHeight: 220, overflowY: "auto" }}>{task.notesLog.map((e) => (
          <div key={e.id} style={{ padding: "6px 10px", background: D.surface, border: `1px solid ${D.border}`, borderRadius: 6 }}>
            <div style={{ fontFamily: mn, fontSize: 9, color: D.txd, marginBottom: 2 }}>{new Date(e.ts).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}{e.author ? ` · ${e.author}` : ""}</div>
            <div style={{ fontFamily: ft, fontSize: 12.5, color: D.tx, lineHeight: 1.4, whiteSpace: "pre-wrap" }}>{e.text}</div>
          </div>
        ))}</div></div>
      ) : null}
    </>
  );

  return (
    <ModalPortal>
    <div style={overlay} onClick={onCancel}>
      <div style={{ ...panel, width: "min(640px, 96vw)" }} onClick={(e) => e.stopPropagation()}>
        {mode === "view" ? viewBlock : (<>
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
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div>
            <div style={lbl}>Assignee</div>
            <AssigneePicker value={assignee} onChange={setAssignee} />
          </div>
          <div>
            <div style={lbl}>Due date</div>
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} style={inputStyle} />
          </div>
        </div>
        <Field label="Tags (comma separated)" value={tags} onChange={setTags} placeholder="ribbons, q3, hotfix" />

        {/* Recurring schedule. Saving with anything other than "Off"
            flips this to a template; instances spawn automatically each
            period. The schedule is hidden from views (so a template
            never shows up in the list); only its children render. */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
          <div>
            <div style={lbl}>Repeats</div>
            <select value={recurrence} onChange={(e) => setRecurrence(e.target.value as Recurrence | "none")} style={inputStyle}>
              <option value="none">Off · one-time task</option>
              <option value="daily">Every day</option>
              <option value="weekly">Every week (same weekday)</option>
              <option value="monthly">Every month (same day-of-month)</option>
            </select>
          </div>
          <div>
            <div style={lbl}>Anchor date</div>
            <input type="date" value={recurrenceAnchor} onChange={(e) => setRecurrenceAnchor(e.target.value)} disabled={recurrence === "none"} style={{ ...inputStyle, opacity: recurrence === "none" ? 0.45 : 1 }} />
          </div>
        </div>

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

        {/* Activity log · dated thread for multi-day / multi-person work. */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
            <div style={lbl}>Activity</div>
            <div style={{ fontFamily: mn, fontSize: 9, color: D.txd, letterSpacing: 0.4 }}>{notesLog.length} {notesLog.length === 1 ? "entry" : "entries"}</div>
          </div>
          {notesLog.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 6, maxHeight: 220, overflowY: "auto" }}>
              {notesLog.map((e) => (
                <div key={e.id} style={{ padding: "6px 10px", background: D.surface, border: `1px solid ${D.border}`, borderRadius: 6 }}>
                  <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 2 }}>
                    <span style={{ fontFamily: mn, fontSize: 9, color: D.txd, letterSpacing: 0.4 }}>
                      {new Date(e.ts).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                      {e.author ? ` · ${e.author}` : ""}
                    </span>
                    <button type="button" onClick={() => removeLogEntry(e.id)} title="Delete entry" style={{ background: "transparent", border: "none", color: D.txd, fontFamily: mn, fontSize: 11, cursor: "pointer", opacity: 0.6 }}>×</button>
                  </div>
                  <div style={{ fontFamily: ft, fontSize: 12.5, color: D.tx, lineHeight: 1.4, whiteSpace: "pre-wrap" }}>{e.text}</div>
                </div>
              ))}
            </div>
          ) : null}
          <div style={{ display: "flex", gap: 6, alignItems: "flex-start", padding: "6px 8px", background: D.surface, border: `1px dashed ${D.border}`, borderRadius: 6 }}>
            <textarea
              value={logDraft}
              onChange={(e) => setLogDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); addLogEntry(); } }}
              placeholder="Add an entry · ⌘+Enter to post"
              style={{ flex: 1, minHeight: 32, background: "transparent", color: D.tx, border: "none", outline: "none", fontFamily: ft, fontSize: 12.5, resize: "vertical", padding: "2px 0", lineHeight: 1.4 }}
            />
            <button type="button" onClick={addLogEntry} disabled={!logDraft.trim()} style={{ background: D.amber, color: "#060608", border: "none", padding: "4px 10px", borderRadius: 4, fontFamily: mn, fontSize: 10, fontWeight: 800, cursor: logDraft.trim() ? "pointer" : "not-allowed", opacity: logDraft.trim() ? 1 : 0.4, letterSpacing: 0.4 }}>Post</button>
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 14 }}>
          <button type="button" onClick={onRemove} style={{ background: "transparent", border: `1px solid ${D.coral}55`, color: D.coral, padding: "9px 14px", borderRadius: 8, fontFamily: ft, fontSize: 12, cursor: "pointer" }}>Delete task</button>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" onClick={onCancel} style={ghostBtn}>Cancel</button>
            <button type="button" onClick={save} disabled={!title.trim()} style={{ ...primaryBtn, opacity: title.trim() ? 1 : 0.5 }}>Save</button>
          </div>
        </div>
        </>)}
      </div>
    </div>
    </ModalPortal>
  );
}

// ── Add Task Modal (preserved from prior version) ─────────────────
function AddTaskModal({ mode, existingTasks, onCancel, onAdd, onSwitchMode }: { mode: AddMode; existingTasks: Task[]; onCancel: () => void; onAdd: (tasks: Omit<Task, "id" | "addedAt">[]) => void; onSwitchMode: (m: AddMode) => void }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("MARKETING OPS");
  const [priority, setPriority] = useState<Priority>("MEDIUM");
  const [assignee, setAssignee] = useState<string>("Akash");
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
      assignee: assignee === "Unassigned" ? undefined : assignee,
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
    <ModalPortal>
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
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <div style={lbl}>Assignee</div>
                <AssigneePicker value={assignee} onChange={setAssignee} />
              </div>
              <div>
                <div style={lbl}>Due date (optional)</div>
                <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} placeholder="2026-05-21" style={inputStyle} />
              </div>
            </div>
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
              <ParsedPreview tasks={parsedTasks} existingTasks={existingTasks} onConfirm={() => onAdd(parsedTasks)} onEdit={setParsedTasks} onCancel={() => setParsedTasks([])} />
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
                <ParsedPreview tasks={parsedTasks} existingTasks={existingTasks} onConfirm={() => onAdd(parsedTasks)} onEdit={setParsedTasks} onCancel={() => setParsedTasks([])} />
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
    </ModalPortal>
  );
}

function ParsedPreview({ tasks, existingTasks, onConfirm, onEdit, onCancel }: { tasks: Omit<Task, "id" | "addedAt">[]; existingTasks: Task[]; onConfirm: () => void; onEdit: (t: Omit<Task, "id" | "addedAt">[]) => void; onCancel: () => void }) {
  // Compute dup matches once per render. Compare every parsed task to:
  //   1. each existing board task (only the best match above threshold)
  //   2. each OTHER parsed task in the batch (catches the model emitting
  //      two near-identical rows for the same prose item)
  const matches = tasks.map((t, i) => {
    let existingHit: { title: string; score: number } | null = null;
    for (const e of existingTasks) {
      const s = similarity(t.title, e.title);
      if (s >= 0.5 && (!existingHit || s > existingHit.score)) existingHit = { title: e.title, score: s };
    }
    let batchHit: { title: string; index: number; score: number } | null = null;
    for (let j = 0; j < tasks.length; j++) {
      if (j === i) continue;
      const s = similarity(t.title, tasks[j].title);
      if (s >= 0.5 && (!batchHit || s > batchHit.score)) batchHit = { title: tasks[j].title, index: j, score: s };
    }
    return { existingHit, batchHit };
  });
  const dupCount = matches.filter((m) => m.existingHit || m.batchHit).length;

  return (
    <div style={{ marginTop: 16, flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 6 }}>
        <div style={lbl}>Found {tasks.length} task{tasks.length === 1 ? "" : "s"} — review before adding</div>
        <div style={{ fontFamily: mn, fontSize: 9, color: D.txd, letterSpacing: 0.4 }}>2-column dense layout</div>
      </div>
      {dupCount > 0 ? (
        <div style={{ fontFamily: mn, fontSize: 10, color: D.coral, letterSpacing: 0.3, padding: "6px 10px", marginBottom: 8, background: "rgba(224,99,71,0.08)", border: `1px solid ${D.coral}55`, borderRadius: 6 }}>
          ⚠ {dupCount} item{dupCount === 1 ? "" : "s"} look{dupCount === 1 ? "s" : ""} like a duplicate. Drop with × before confirming, or add them and merge later via the Combine bucket.
        </div>
      ) : null}
      <div style={{ flex: 1, minHeight: 0, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, overflowY: "auto", marginBottom: 12, paddingRight: 4, alignContent: "start" }}>
        {tasks.map((t, i) => {
          const cColor = CATEGORY_COLORS[t.category] || D.txm;
          const pColor = PRIORITY_COLORS[t.priority as Priority] || D.txd;
          const m = matches[i];
          const dup = m.existingHit || m.batchHit;
          return (
            <div key={i} style={{ background: D.bg, border: `1px solid ${dup ? D.coral + "55" : D.border}`, borderLeft: `3px solid ${pColor}`, borderRadius: 8, padding: "8px 10px", position: "relative", display: "flex", flexDirection: "column", gap: 3, boxShadow: dup ? `inset 0 0 0 1px ${D.coral}22` : "none" }}>
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
              {dup ? (
                <div style={{ fontFamily: mn, fontSize: 9, color: D.coral, letterSpacing: 0.3, lineHeight: 1.35, display: "flex", alignItems: "center", gap: 4 }} title={m.existingHit ? `Already on board (${Math.round((m.existingHit.score) * 100)}% match)` : `Duplicate inside this batch (${Math.round(((m.batchHit?.score) || 0) * 100)}% match)`}>
                  <span>{m.existingHit ? "↻ on board:" : "↻ batch dup:"}</span>
                  <span style={{ color: D.txm, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, minWidth: 0 }}>
                    {(m.existingHit?.title || m.batchHit?.title || "").slice(0, 60)}
                  </span>
                </div>
              ) : null}
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

  async function removeBoard(id: string) {
    if (archive.boards.length === 1) return;
    const board = archive.boards.find((b) => b.id === id);
    const ok = await confirmDialog({
      title: "Delete board?",
      body: `${board?.name || "This board"} and all ${board?.tasks.length ?? 0} tasks will be removed.`,
      cta: "Delete board",
      variant: "danger",
    });
    if (!ok) return;
    const remaining = archive.boards.filter((b) => b.id !== id);
    onSave({ boards: remaining, activeId: remaining[0].id });
  }

  return (
    <ModalPortal>
    <div style={overlay} onClick={onCancel}>
      <div style={panel} onClick={(e) => e.stopPropagation()}>
        <div style={{ fontFamily: gf, fontSize: 20, fontWeight: 800, color: D.tx, letterSpacing: -0.5, marginBottom: 14 }}>Boards</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 16 }}>
          {archive.boards.map((b) => (
            <div key={b.id} data-glass="" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: D.surface, border: `1px solid ${D.border}`, borderRadius: 8 }}>
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
    </ModalPortal>
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

function groupTasks(tasks: Task[], by: GroupBy): Array<{ key: string; tasks: Task[] }> {
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
  if (by === "assignee") {
    // Walk the canonical roster so column order matches the filter chips.
    return ASSIGNEES
      .map((a) => ({ key: a.id, tasks: tasks.filter((t) => (t.assignee || "Akash") === a.id) }))
      .filter((g) => g.tasks.length > 0);
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
  } else if (by === "manual") {
    arr.sort(byManual);
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

// Recurrence helpers. A template stores `lastSpawnedFor` (ISO date of
// the most recent instance we minted). On load we compute the most
// recent period boundary and, if the template hasn't seen it yet,
// spawn a new instance whose dueDate is that boundary.
function periodBoundary(rec: Recurrence, anchor: Date, now: Date): string {
  const today = startOfDay(now);
  if (rec === "daily") return isoDate(today);
  if (rec === "weekly") {
    // Most recent occurrence whose weekday matches the anchor's weekday.
    const wantDow = anchor.getDay();
    const d = new Date(today);
    const delta = (d.getDay() - wantDow + 7) % 7;
    d.setDate(d.getDate() - delta);
    return isoDate(d);
  }
  // monthly — most recent occurrence whose day-of-month <= today's.
  const wantDom = Math.min(anchor.getDate(), 28); // clamp so Feb still works
  const d = new Date(today);
  if (d.getDate() < wantDom) d.setMonth(d.getMonth() - 1);
  d.setDate(wantDom);
  return isoDate(d);
}
function spawnDueRecurring(tasks: Task[]): Task[] {
  const now = new Date();
  const out: Task[] = [...tasks];
  for (let i = 0; i < out.length; i++) {
    const t = out[i];
    if (!t.isRecurringTemplate || !t.recurrence) continue;
    const anchor = t.recurrenceAnchor ? new Date(t.recurrenceAnchor + "T00:00:00") : new Date(t.addedAt);
    const due = periodBoundary(t.recurrence, anchor, now);
    if (t.lastSpawnedFor === due) continue;
    // Mint a new instance from the template.
    const inst: Task = {
      ...t,
      id: "t-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6),
      addedAt: new Date().toISOString(),
      isRecurringTemplate: false,
      recurringFrom: t.id,
      recurrence: undefined,
      recurrenceAnchor: undefined,
      lastSpawnedFor: undefined,
      done: false,
      dueDate: due,
      source: "recurring",
      // Reset subtask completion so each instance starts fresh.
      subtasks: (t.subtasks || []).map((s, k) => ({ id: "s-" + Date.now() + "-" + k + "-" + Math.random().toString(36).slice(2, 6), title: s.title, done: false })),
    };
    out.push(inst);
    out[i] = { ...t, lastSpawnedFor: due };
  }
  return out;
}
// Append an entry to a task's notesLog (creates the array if absent).
function appendNoteEntry(t: Task, text: string, author?: string): Task {
  const entry: NoteEntry = {
    id: "n-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6),
    ts: new Date().toISOString(),
    author,
    text: text.trim(),
  };
  return { ...t, notesLog: [...(t.notesLog || []), entry] };
}
// Sort tasks by manualOrder (lower first), then addedAt newest-first.
// Used inside a group when sortBy === "manual".
function byManual(a: Task, b: Task) {
  const aHas = typeof a.manualOrder === "number";
  const bHas = typeof b.manualOrder === "number";
  if (aHas && bHas) return (a.manualOrder as number) - (b.manualOrder as number);
  if (aHas) return -1;
  if (bHas) return 1;
  return (b.addedAt || "").localeCompare(a.addedAt || "");
}

// Title similarity — Jaccard on tokens (lowercased, alphanumeric). Used
// by the import flow to flag "this looks like one we already have." A
// stopword filter keeps "Redo the ribbons" from matching everything that
// happens to contain "the". Threshold the caller picks; 0.5 catches
// "Redo ribbons" vs "Redo ClusterMax ribbons" without too many false
// positives.
const TB_STOP = new Set(["the", "a", "an", "and", "or", "to", "of", "for", "on", "in", "at", "by", "with", "from"]);
function similarity(a: string, b: string): number {
  const tok = (s: string) => new Set(
    s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter((w) => w && !TB_STOP.has(w))
  );
  const A = tok(a), B = tok(b);
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0;
  A.forEach((x) => { if (B.has(x)) inter++; });
  const union = A.size + B.size - inter;
  return union === 0 ? 0 : inter / union;
}

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
  let assignee: string | undefined;
  let dueDate: string | undefined;
  const tags: string[] = [];

  // Assignee prefix `+name` — checked before category so `+Daksh` is a
  // person, not a typo for `@daksh`. Names are matched case-insensitive
  // against the ASSIGNEES roster.
  const asgRe = /\+(\w+)/g;
  const asgLcMap: Record<string, string> = Object.fromEntries(ASSIGNEE_NAMES.map((n) => [n.toLowerCase(), n]));
  title = title.replace(asgRe, (_m, w) => {
    const v = asgLcMap[(w as string).toLowerCase()];
    if (v) { assignee = v; return ""; }
    return "+" + w;
  });

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
    assignee,
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

// Load-status + force-reload control. Mirrors SaveIndicator. When healthy it
// stays as a persistent "↻ Reload" button so the board can always be re-fetched
// from the cloud; while loading it shows a pill; on failure it explains and
// offers reload (with the raw reason behind "why?").
function LoadIndicator({ loading, error, onReload }: { loading: boolean; error: string | null; onReload: () => void }) {
  const [showFull, setShowFull] = useState(false);
  if (loading) {
    return <span style={{ fontFamily: mn, fontSize: 10, letterSpacing: 0.6, color: D.txm, display: "inline-flex", alignItems: "center", gap: 6, padding: "3px 9px", borderRadius: 999, background: "rgba(255,255,255,0.04)", border: `1px solid ${D.border}` }}>
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: D.amber, animation: "tbPulse 1.1s ease-in-out infinite" }} />
      Loading
      <style dangerouslySetInnerHTML={{ __html: "@keyframes tbPulse{0%,100%{opacity:0.35}50%{opacity:1}}" }} />
    </span>;
  }
  if (error) {
    return (
      <span style={{ display: "inline-flex", flexDirection: "column", alignItems: "stretch", gap: 4 }}>
        <span style={{ fontFamily: mn, fontSize: 10, letterSpacing: 0.6, color: D.coral, display: "inline-flex", alignItems: "center", gap: 8, padding: "4px 10px", borderRadius: 8, background: D.coral + "16", border: `1px solid ${D.coral}55` }}>
          ⚠ Load failed — data is safe in the cloud
          <button type="button" onClick={onReload} style={{ background: D.coral, border: "none", color: "#060608", cursor: "pointer", fontFamily: mn, fontSize: 10, padding: "2px 8px", borderRadius: 4, fontWeight: 700, letterSpacing: 0.4 }}>reload</button>
          <button type="button" onClick={() => setShowFull((v) => !v)} style={{ background: "transparent", border: `1px solid ${D.coral}55`, color: D.coral, cursor: "pointer", fontFamily: mn, fontSize: 10, padding: "2px 8px", borderRadius: 4, letterSpacing: 0.4 }}>{showFull ? "hide" : "why?"}</button>
        </span>
        {showFull && error ? (
          <span style={{ fontFamily: mn, fontSize: 11, color: D.coral, padding: "8px 12px", background: D.coral + "0a", border: `1px solid ${D.coral}40`, borderRadius: 8, whiteSpace: "pre-wrap", maxWidth: 720, lineHeight: 1.5, letterSpacing: 0.2 }}>
            {error}
          </span>
        ) : null}
      </span>
    );
  }
  return (
    <button type="button" onClick={onReload} title="Reload the board from the cloud" style={{ fontFamily: mn, fontSize: 10, letterSpacing: 0.6, color: D.txm, display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 9px", borderRadius: 999, background: "rgba(255,255,255,0.04)", border: `1px solid ${D.border}`, cursor: "pointer" }}>↻ Reload</button>
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

// Round avatar with a person's initial. Used in chip rows, task rows, and
// the popover. `glow` adds a soft halo so the active filter chip and the
// task row's assignee bubble feel alive without screaming.
function Avatar({ spec, size = 18, glow = false }: { spec: AssigneeSpec; size?: number; glow?: boolean }) {
  const isUnassigned = spec.id === "Unassigned";
  const fontSize = Math.max(8, Math.round(size * 0.5));
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: size,
        height: size,
        borderRadius: "50%",
        background: isUnassigned ? "transparent" : spec.color + "26",
        border: `1.5px solid ${isUnassigned ? D.border : spec.color}`,
        color: isUnassigned ? D.txd : spec.color,
        fontFamily: mn,
        fontSize,
        fontWeight: 800,
        letterSpacing: 0,
        lineHeight: 1,
        flexShrink: 0,
        boxShadow: glow && !isUnassigned ? `0 0 8px ${spec.color}66` : "none",
      }}
      title={spec.name}
    >
      {spec.initial}
    </span>
  );
}

// Wraps every occurrence of `q` in `text` with a soft amber-tinted
// <mark>. Case-insensitive, escapes regex metacharacters. Used in
// the active filter view and inside ⌘K results so the matched
// substring lights up.
function Highlight({ text, q }: { text: string; q?: string }) {
  if (!q) return <>{text}</>;
  const needle = q.trim().toLowerCase();
  if (!needle) return <>{text}</>;
  const escaped = needle.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
  const parts = text.split(new RegExp(`(${escaped})`, "gi"));
  return <>{parts.map((p, i) => (i % 2 === 1 ? <mark key={i} style={{ background: D.amber + "33", color: "inherit", padding: 0, borderRadius: 2 }}>{p}</mark> : <span key={i}>{p}</span>))}</>;
}

// ── Today hero ──────────────────────────────────────────────────────
// What the user actually needs at 9am: how many things are on for today,
// what's overdue, and the next 1-3 tasks to actually start. One-click
// Focus Mode on the top suggestion so the flow from "open the board"
// to "doing the work" is a single tap.
function TodayHero({ tasks, onStartFocus, onOpenTask }: { tasks: Task[]; onStartFocus: (t: Task) => void; onOpenTask: (t: Task) => void }) {
  const today = startOfDay(new Date());
  const todayIso = isoDate(today);
  const live = tasks.filter((t) => !t.done && t.priority !== "DONE");
  const overdue = live.filter((t) => t.dueDate && t.dueDate < todayIso);
  const dueToday = live.filter((t) => t.dueDate === todayIso);
  const doneToday = tasks.filter((t) => t.done && (t.updatedAt || t.addedAt || "").slice(0, 10) === todayIso);
  // Suggestion ranking: HIGH > MEDIUM > THIS WEEK > ONGOING, with overdue
  // and today-due bumped up. Capped at 3.
  const pOrder: Record<Priority, number> = { HIGH: 0, MEDIUM: 1, "THIS WEEK": 2, ONGOING: 3, DONE: 9 };
  const score = (t: Task) => {
    let s = pOrder[t.priority] * 10;
    if (t.dueDate && t.dueDate < todayIso) s -= 100;
    else if (t.dueDate === todayIso) s -= 50;
    if (t.pinned) s -= 5;
    return s;
  };
  const suggestions = [...live].sort((a, b) => score(a) - score(b)).slice(0, 3);

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 18) return "Good afternoon";
    return "Good evening";
  })();

  return (
    <div data-glass="" style={{ marginBottom: 16, position: "relative", overflow: "hidden", borderRadius: 14, border: `1px solid ${D.amber}33`, background: `linear-gradient(135deg, rgba(247,176,65,0.10) 0%, rgba(11,134,209,0.06) 60%, transparent 100%), ${D.surface}`, padding: 16 }}>
      <div aria-hidden="true" style={{ position: "absolute", top: -40, right: -40, width: 200, height: 200, borderRadius: "50%", background: "radial-gradient(circle, rgba(247,176,65,0.18), transparent 70%)", pointerEvents: "none" }} />
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, marginBottom: 10 }}>
        <div>
          <div style={{ fontFamily: mn, fontSize: 10, color: D.amber, letterSpacing: 1.4, textTransform: "uppercase", fontWeight: 700 }}>{greeting}, Akash</div>
          <div style={{ fontFamily: gf, fontSize: 18, fontWeight: 800, color: D.tx, letterSpacing: -0.4, marginTop: 2 }}>
            {dueToday.length === 0 && overdue.length === 0
              ? "Nothing on the board for today — pick something to push forward."
              : `${dueToday.length} due today${overdue.length > 0 ? ` · ${overdue.length} overdue` : ""}${doneToday.length > 0 ? ` · ${doneToday.length} done` : ""}`}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          <Stat label="OVERDUE" value={overdue.length} color={D.coral} />
          <Stat label="TODAY"   value={dueToday.length} color={D.amber} />
          <Stat label="DONE"    value={doneToday.length} color={D.teal}  />
        </div>
      </div>
      {suggestions.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <div style={{ fontFamily: mn, fontSize: 9, color: D.txd, letterSpacing: 1.2, textTransform: "uppercase" }}>Start here</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {suggestions.map((t, i) => {
              const aSpec = getAssigneeSpec(t.assignee || "Akash");
              const pColor = PRIORITY_COLORS[t.priority] || D.txd;
              const due = formatDue(t.dueDate);
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => onOpenTask(t)}
                  style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", background: i === 0 ? "rgba(247,176,65,0.10)" : "rgba(255,255,255,0.02)", border: `1px solid ${i === 0 ? D.amber + "55" : D.border}`, borderRadius: 8, cursor: "pointer", textAlign: "left", width: "100%" }}
                >
                  <span style={{ fontFamily: mn, fontSize: 10, color: D.amber, letterSpacing: 0.5, minWidth: 18, opacity: i === 0 ? 1 : 0.5 }}>#{i + 1}</span>
                  <Avatar spec={aSpec} size={18} />
                  <span style={{ fontFamily: mn, fontSize: 8.5, color: pColor, letterSpacing: 0.6, padding: "1px 6px", border: `1px solid ${pColor}55`, borderRadius: 3, textTransform: "uppercase" }}>{t.priority}</span>
                  <span style={{ flex: 1, minWidth: 0, fontFamily: gf, fontSize: 13, fontWeight: 700, color: D.tx, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.title}</span>
                  {due ? <span style={{ fontFamily: mn, fontSize: 9.5, color: due.urgent ? D.coral : D.txm, letterSpacing: 0.4 }}>{due.label}</span> : null}
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onStartFocus(t); }}
                    title="Start Focus Mode on this task"
                    style={{ background: i === 0 ? D.amber : "transparent", color: i === 0 ? "#060608" : D.amber, border: `1px solid ${D.amber}`, padding: "4px 10px", borderRadius: 6, fontFamily: mn, fontSize: 9, letterSpacing: 0.6, fontWeight: 800, cursor: "pointer", textTransform: "uppercase" }}
                  >
                    Focus →
                  </button>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0, padding: "4px 12px", background: value > 0 ? color + "16" : "transparent", border: `1px solid ${value > 0 ? color + "55" : D.border}`, borderRadius: 8, minWidth: 56 }}>
      <span style={{ fontFamily: gf, fontSize: 18, fontWeight: 900, color: value > 0 ? color : D.txd, letterSpacing: -0.6, lineHeight: 1 }}>{value}</span>
      <span style={{ fontFamily: mn, fontSize: 8, color: value > 0 ? color : D.txd, letterSpacing: 0.8 }}>{label}</span>
    </div>
  );
}

// Polished priority counter card · top accent bar in the priority color,
// huge stat number, and a soft color-tinted glow on hover. Replaces the
// flat dark cards that read as legend-only at a glance.
function PriorityCounter({ label, count, color }: { label: string; count: number; color: string }) {
  const [hover, setHover] = useState(false);
  return (
    <div
      data-glass=""
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: "relative",
        background: hover ? `linear-gradient(180deg, ${color}10, transparent 70%), ${D.surface}` : D.surface,
        border: `1px solid ${hover ? color + "66" : D.border}`,
        borderRadius: 10,
        padding: "12px 14px 10px",
        overflow: "hidden",
        transition: "border-color 0.18s, box-shadow 0.18s, background 0.18s, transform 0.18s",
        transform: hover ? "translateY(-1px)" : "translateY(0)",
        boxShadow: hover ? `0 8px 22px ${color}26, inset 0 0 0 1px ${color}22` : "none",
      }}
    >
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, ${color}, ${color}66)` }} />
      <div style={{ fontFamily: mn, fontSize: 9, letterSpacing: 1.2, textTransform: "uppercase", color: hover ? color : D.txd, marginBottom: 4, transition: "color 0.18s" }}>{label}</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <span style={{ fontFamily: gf, fontSize: 28, fontWeight: 900, color, letterSpacing: -1, lineHeight: 1, textShadow: hover ? `0 0 14px ${color}55` : "none", transition: "text-shadow 0.18s" }}>{count}</span>
      </div>
    </div>
  );
}

// Tiny circular progress donut for subtask completion. Sized to match
// the old "0/3" pill so adjacent row chrome doesn't reflow. Pure SVG so
// it animates cheaply and stays crisp at any zoom.
function SubtaskRing({ done, total, color, size = 22 }: { done: number; total: number; color: string; size?: number }) {
  const stroke = 2.2;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = total === 0 ? 0 : done / total;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flexShrink: 0, display: "block" }}>
      <circle cx={size / 2} cy={size / 2} r={r} stroke={color + "33"} strokeWidth={stroke} fill="transparent" />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        stroke={color}
        strokeWidth={stroke}
        strokeLinecap="round"
        fill="transparent"
        strokeDasharray={`${c * pct} ${c}`}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: "stroke-dasharray 0.3s" }}
      />
      <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle" fill={color} fontFamily="JetBrains Mono, monospace" fontSize={size * 0.36} fontWeight={800} letterSpacing="0">
        {done}/{total}
      </text>
    </svg>
  );
}

// ── Combine bucket ──────────────────────────────────────────────────
// Floating "Combine" dock pinned to the right edge of the viewport.
// Drag any task here to stage it for consolidation; once you have 2+
// staged, the Combine button opens a merge preview where you can edit
// the result before committing. Removing source tasks happens on
// commit, not on drop, so a drag-then-cancel is harmless.
function CombineDock({ ids, tasks, onAdd, onRemove, onClear, onOpen }: {
  ids: Set<string>;
  tasks: Task[];
  onAdd: (id: string) => void;
  onRemove: (id: string) => void;
  onClear: () => void;
  onOpen: () => void;
}) {
  const [over, setOver] = useState(false);
  // Default expanded so the drop target is always obvious. User can
  // still collapse with the header button if they want it out of the
  // way; we just don't START hidden.
  const [expanded, setExpanded] = useState(true);
  // Whenever a drag is in flight ANYWHERE on the page, flip dragging
  // on so the dock pulses + force-expands. Listening on the document
  // (rather than the dock alone) catches all task drags, since they
  // start on a TaskRow far away from this panel.
  const [dragging, setDragging] = useState(false);
  useEffect(() => {
    const onStart = () => { setDragging(true); setExpanded(true); };
    const onEnd = () => setDragging(false);
    document.addEventListener("dragstart", onStart);
    document.addEventListener("dragend", onEnd);
    document.addEventListener("drop", onEnd);
    return () => {
      document.removeEventListener("dragstart", onStart);
      document.removeEventListener("dragend", onEnd);
      document.removeEventListener("drop", onEnd);
    };
  }, []);
  useEffect(() => { if (ids.size > 0) setExpanded(true); }, [ids.size]);

  return (
    <BodyPortal>
      <div
        onDragOver={(e) => { e.preventDefault(); if (!over) setOver(true); }}
        onDragLeave={(e) => {
          const next = e.relatedTarget as Node | null;
          if (!next || !(e.currentTarget as HTMLDivElement).contains(next)) setOver(false);
        }}
        onDrop={(e) => {
          e.preventDefault(); setOver(false);
          const id = e.dataTransfer.getData("text/plain");
          if (id) onAdd(id);
        }}
        className="tb-combine"
        style={{
          position: "fixed", right: 16, top: "50%", transform: "translateY(-50%)",
          width: expanded ? 260 : 56, maxHeight: "70vh",
          background: "#0A0A14",
          border: `1px solid ${over ? D.amber : dragging || ids.size > 0 ? D.amber : D.border}`,
          borderRadius: 12,
          padding: 12,
          boxShadow: over || dragging
            ? `0 0 0 3px ${D.amber}55, 0 24px 60px rgba(0,0,0,0.5)`
            : ids.size > 0 ? `0 16px 48px rgba(0,0,0,0.5), 0 0 0 1px ${D.amber}22` : "0 8px 22px rgba(0,0,0,0.4)",
          zIndex: 10800,
          display: "flex", flexDirection: "column", gap: 8,
          transition: "width 0.18s, border-color 0.12s, box-shadow 0.18s",
          animation: dragging ? "tbDockPulse 1.2s ease-in-out infinite" : undefined,
        }}
      >
        <style dangerouslySetInnerHTML={{ __html: "@keyframes tbDockPulse{0%,100%{box-shadow:0 0 0 3px rgba(247,176,65,0.40),0 24px 60px rgba(0,0,0,0.5)}50%{box-shadow:0 0 0 6px rgba(247,176,65,0.60),0 24px 60px rgba(0,0,0,0.5)}}" }} />
        {/* Header · always visible, doubles as collapse toggle. */}
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          style={{ display: "flex", alignItems: "center", gap: 6, background: "transparent", border: "none", color: ids.size > 0 || dragging ? D.amber : D.txm, cursor: "pointer", padding: 0, fontFamily: mn, fontSize: 10, letterSpacing: 1.2, textTransform: "uppercase", fontWeight: 700 }}
          title={expanded ? "Collapse combine dock" : "Expand combine dock"}
        >
          <span style={{ width: 22, height: 22, borderRadius: 5, background: (ids.size > 0 || dragging) ? D.amber + "33" : "transparent", border: `1.5px solid ${(ids.size > 0 || dragging) ? D.amber : D.border}`, color: (ids.size > 0 || dragging) ? D.amber : D.txm, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 900 }}>
            {ids.size > 0 ? ids.size : "↘"}
          </span>
          {expanded ? <span>{dragging ? "Drop here to combine" : "Combine bucket"}</span> : null}
        </button>
        {expanded ? (
          <>
            <div style={{ fontFamily: mn, fontSize: 9.5, color: dragging ? D.amber : D.txd, letterSpacing: 0.3, lineHeight: 1.4 }}>
              {dragging ? "↓ Drop the task here ↓" : ids.size === 0 ? "Drag duplicate tasks here, then merge into one." : `${ids.size} staged · merge into one`}
            </div>
            <div
              style={{
                flex: 1, minHeight: ids.size === 0 ? 140 : 0,
                overflowY: "auto",
                display: "flex", flexDirection: "column", gap: 4,
                padding: 8,
                borderRadius: 8,
                background: over ? "rgba(247,176,65,0.18)" : dragging ? "rgba(247,176,65,0.08)" : "rgba(255,255,255,0.02)",
                border: `2px dashed ${over ? D.amber : dragging ? D.amber + "88" : D.border}`,
                transition: "background 0.12s, border-color 0.12s",
              }}
            >
              {tasks.length === 0 ? (
                <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6, fontFamily: mn, fontSize: 11, color: dragging ? D.amber : D.txd, letterSpacing: 0.4, textAlign: "center", padding: "16px 4px", fontWeight: 700 }}>
                  <span style={{ fontSize: 22, lineHeight: 1 }}>↘</span>
                  {dragging ? "Drop to combine" : "Drag duplicates here"}
                </div>
              ) : tasks.map((t) => {
                const aSpec = getAssigneeSpec(t.assignee || "Akash");
                return (
                  <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 7px", background: D.bg, border: `1px solid ${D.border}`, borderRadius: 6 }}>
                    <Avatar spec={aSpec} size={16} />
                    <span style={{ flex: 1, minWidth: 0, fontFamily: ft, fontSize: 11.5, color: D.tx, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", lineHeight: 1.3 }}>{t.title}</span>
                    <button type="button" onClick={() => onRemove(t.id)} title="Remove from bucket" style={{ background: "transparent", border: "none", color: D.txd, fontFamily: mn, fontSize: 12, cursor: "pointer", padding: "0 2px" }}>×</button>
                  </div>
                );
              })}
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <button
                type="button"
                onClick={onOpen}
                disabled={ids.size < 2}
                title={ids.size < 2 ? "Need at least 2 tasks to combine" : "Open merge preview"}
                style={{ flex: 1, padding: "7px 10px", background: ids.size >= 2 ? D.amber : "transparent", color: ids.size >= 2 ? "#060608" : D.txd, border: `1px solid ${ids.size >= 2 ? D.amber : D.border}`, borderRadius: 6, fontFamily: ft, fontSize: 11, fontWeight: 800, cursor: ids.size >= 2 ? "pointer" : "not-allowed", letterSpacing: 0.3 }}
              >
                Combine {ids.size > 0 ? ids.size : ""}
              </button>
              {ids.size > 0 ? (
                <button type="button" onClick={onClear} title="Empty bucket" style={{ padding: "7px 10px", background: "transparent", color: D.txm, border: `1px solid ${D.border}`, borderRadius: 6, fontFamily: mn, fontSize: 10, cursor: "pointer" }}>Clear</button>
              ) : null}
            </div>
          </>
        ) : null}
      </div>
    </BodyPortal>
  );
}

// Modal that shows the merged preview before committing. Pre-populates
// every field with a smart default (longest title, concatenated descs,
// highest priority, earliest due date, union of tags, deduped subtasks).
// User can override anything before hitting confirm.
function CombineModal({ tasks, onCancel, onCommit }: { tasks: Task[]; onCancel: () => void; onCommit: (merged: Omit<Task, "id" | "addedAt">, sourceIds: string[]) => void }) {
  // Smart defaults computed once on open.
  const defaults = (() => {
    const longestTitle = tasks.reduce((a, b) => (a.title.length >= b.title.length ? a : b), tasks[0]).title;
    const descs = tasks.map((t) => t.description).filter(Boolean) as string[];
    const description = Array.from(new Set(descs)).join(" · ");
    const notes = Array.from(new Set(tasks.map((t) => t.notes).filter(Boolean) as string[])).join(" · ");
    // Highest priority wins; HIGH > MEDIUM > THIS WEEK > ONGOING.
    const pOrder: Record<Priority, number> = { HIGH: 0, MEDIUM: 1, "THIS WEEK": 2, ONGOING: 3, DONE: 4 };
    const priority = (tasks.map((t) => t.priority).sort((a, b) => pOrder[a] - pOrder[b])[0] || "MEDIUM") as Priority;
    // Most common category (tie → first).
    const catCount: Record<string, number> = {};
    tasks.forEach((t) => { catCount[t.category] = (catCount[t.category] || 0) + 1; });
    const category = Object.entries(catCount).sort((a, b) => b[1] - a[1])[0]?.[0] || tasks[0].category;
    // Most common assignee.
    const aCount: Record<string, number> = {};
    tasks.forEach((t) => { const a = t.assignee || "Akash"; aCount[a] = (aCount[a] || 0) + 1; });
    const assignee = Object.entries(aCount).sort((a, b) => b[1] - a[1])[0]?.[0] || "Akash";
    // Earliest due date.
    const dueDates = tasks.map((t) => t.dueDate).filter(Boolean) as string[];
    const dueDate = dueDates.sort()[0];
    // Union of tags.
    const tagSet = new Set<string>();
    tasks.forEach((t) => (t.tags || []).forEach((tg) => tagSet.add(tg)));
    const tags = Array.from(tagSet);
    // Dedup subtasks by lowercased title.
    const seen = new Set<string>();
    const subtasks: Subtask[] = [];
    tasks.forEach((t) => (t.subtasks || []).forEach((s) => {
      const k = s.title.trim().toLowerCase();
      if (!k || seen.has(k)) return;
      seen.add(k);
      subtasks.push({ id: "s-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6), title: s.title, done: !!s.done });
    }));
    const pinned = tasks.some((t) => t.pinned);
    return { title: longestTitle, description, notes, priority, category, assignee, dueDate, tags, subtasks, pinned };
  })();

  const [title, setTitle] = useState(defaults.title);
  const [description, setDescription] = useState(defaults.description);
  const [notes, setNotes] = useState(defaults.notes);
  const [priority, setPriority] = useState<Priority>(defaults.priority);
  const [category, setCategory] = useState(defaults.category);
  const [assignee, setAssignee] = useState(defaults.assignee);
  const [dueDate, setDueDate] = useState(defaults.dueDate || "");
  const [tagsStr, setTagsStr] = useState((defaults.tags || []).join(", "));
  const [subtasks, setSubtasks] = useState<Subtask[]>(defaults.subtasks);
  const [aiState, setAiState] = useState<"idle" | "thinking" | "error">("idle");
  const [aiError, setAiError] = useState<string | null>(null);

  function toggleSub(id: string) { setSubtasks((cur) => cur.map((s) => s.id === id ? { ...s, done: !s.done } : s)); }
  function removeSub(id: string) { setSubtasks((cur) => cur.filter((s) => s.id !== id)); }

  // Smart merge — sends raw source tasks to Claude, replaces every
  // editable field with the AI proposal. User can still edit before
  // hitting commit, so the result is a starting point, not a contract.
  async function aiSmartMerge() {
    setAiState("thinking");
    setAiError(null);
    try {
      const payload = tasks.map((t) => ({
        title: t.title,
        description: t.description,
        category: t.category,
        priority: t.priority,
        assignee: t.assignee,
        dueDate: t.dueDate,
        notes: t.notes,
        tags: t.tags,
        subtasks: (t.subtasks || []).map((s) => ({ title: s.title, done: !!s.done })),
      }));
      const res = await fetch("/api/akash-todo/combine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tasks: payload }),
      });
      const j = await res.json();
      if (!res.ok || !j.merged) {
        setAiError(j.error || "AI merge failed");
        setAiState("error");
        return;
      }
      const m = j.merged;
      if (m.title) setTitle(m.title);
      if (m.description) setDescription(m.description);
      if (m.notes) setNotes(m.notes);
      if (m.priority) setPriority(m.priority as Priority);
      if (m.category) setCategory(m.category);
      if (m.assignee) setAssignee(m.assignee);
      if (m.dueDate) setDueDate(m.dueDate);
      if (Array.isArray(m.subtasks)) setSubtasks(m.subtasks);
      setAiState("idle");
    } catch (e) {
      setAiError(String(e));
      setAiState("error");
    }
  }

  function commit() {
    if (!title.trim()) return;
    const merged: Omit<Task, "id" | "addedAt"> = {
      title: title.trim(),
      description: description.trim() || undefined,
      notes: notes.trim() || undefined,
      category, priority,
      assignee: assignee === "Unassigned" ? undefined : assignee,
      dueDate: dueDate || undefined,
      tags: tagsStr.split(",").map((s) => s.trim().replace(/^#/, "")).filter(Boolean),
      pinned: defaults.pinned,
      subtasks: subtasks.length ? subtasks : undefined,
      source: "manual",
    };
    onCommit(merged, tasks.map((t) => t.id));
  }

  return (
    <ModalPortal>
      <div style={overlay} onClick={onCancel}>
        <div style={{ ...panel, width: "min(680px, 96vw)" }} onClick={(e) => e.stopPropagation()}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, gap: 8 }}>
            <div>
              <div style={{ fontFamily: mn, fontSize: 10, letterSpacing: 1.4, color: D.amber, textTransform: "uppercase", fontWeight: 700 }}>Combine {tasks.length} tasks</div>
              <div style={{ fontFamily: gf, fontSize: 22, fontWeight: 800, color: D.tx, letterSpacing: -0.5, marginTop: 2 }}>Merge preview</div>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <button
                type="button"
                onClick={aiSmartMerge}
                disabled={aiState === "thinking"}
                title="Send the source tasks to Claude and replace this preview with a smart merge"
                style={{ background: aiState === "thinking" ? "transparent" : "linear-gradient(120deg, #F7B041, #905CCB)", color: aiState === "thinking" ? D.amber : "#060608", border: `1px solid ${D.amber}`, padding: "8px 14px", borderRadius: 8, fontFamily: ft, fontSize: 12, fontWeight: 800, cursor: aiState === "thinking" ? "wait" : "pointer", letterSpacing: 0.3 }}
              >
                {aiState === "thinking" ? "✦ Thinking…" : "✦ Smart merge with Claude"}
              </button>
              <button type="button" onClick={onCancel} style={ghostBtn}>Cancel</button>
            </div>
          </div>
          {aiError ? (
            <div style={{ fontFamily: mn, fontSize: 11, color: D.coral, padding: "6px 10px", background: "rgba(224,99,71,0.08)", border: `1px solid ${D.coral}55`, borderRadius: 6, marginBottom: 10 }}>
              {aiError}
            </div>
          ) : null}

          {/* Source list · tiny strip showing what's being merged. */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 12, padding: "8px 10px", background: D.surface, border: `1px dashed ${D.border}`, borderRadius: 8 }}>
            {tasks.map((t) => (
              <span key={t.id} style={{ fontFamily: mn, fontSize: 9.5, color: D.txm, padding: "2px 8px", background: D.bg, border: `1px solid ${D.border}`, borderRadius: 999, letterSpacing: 0.2 }} title={t.description || ""}>
                {t.title.length > 40 ? t.title.slice(0, 38) + "…" : t.title}
              </span>
            ))}
          </div>

          <Field label="Title" value={title} onChange={setTitle} />
          <Field label="Description (concatenated)" value={description} onChange={setDescription} multi />
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
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <div style={lbl}>Assignee</div>
              <AssigneePicker value={assignee} onChange={setAssignee} />
            </div>
            <div>
              <div style={lbl}>Due date (earliest)</div>
              <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} style={inputStyle} />
            </div>
          </div>
          <Field label="Tags (union, comma separated)" value={tagsStr} onChange={setTagsStr} />

          {subtasks.length > 0 ? (
            <div style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
                <div style={lbl}>Subtasks (deduplicated)</div>
                <div style={{ fontFamily: mn, fontSize: 9, color: D.txd, letterSpacing: 0.4 }}>{subtasks.filter((s) => s.done).length}/{subtasks.length} done</div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 200, overflowY: "auto", padding: 2 }}>
                {subtasks.map((s) => (
                  <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 8px", background: D.surface, border: `1px solid ${D.border}`, borderRadius: 6 }}>
                    <button type="button" onClick={() => toggleSub(s.id)} style={{ width: 14, height: 14, borderRadius: 3, background: s.done ? D.teal : "transparent", border: `1.5px solid ${s.done ? D.teal : D.border}`, cursor: "pointer", padding: 0, flexShrink: 0 }} />
                    <span style={{ flex: 1, color: s.done ? D.txd : D.tx, fontFamily: ft, fontSize: 12.5, textDecoration: s.done ? "line-through" : "none" }}>{s.title}</span>
                    <button type="button" onClick={() => removeSub(s.id)} title="Drop" style={{ background: "transparent", border: "none", color: D.txd, fontFamily: mn, fontSize: 12, cursor: "pointer", padding: "0 2px", opacity: 0.6 }}>×</button>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <Field label="Notes (concatenated)" value={notes} onChange={setNotes} multi />

          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 14 }}>
            <div style={{ fontFamily: mn, fontSize: 10, color: D.coral, letterSpacing: 0.4 }}>
              ⚠ The {tasks.length} source task{tasks.length === 1 ? "" : "s"} will be deleted on commit.
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" onClick={onCancel} style={ghostBtn}>Cancel</button>
              <button type="button" onClick={commit} disabled={!title.trim()} style={{ ...primaryBtn, opacity: title.trim() ? 1 : 0.5 }}>
                Combine {tasks.length} → 1
              </button>
            </div>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}

// ── Bulk action bar ─────────────────────────────────────────────────
// Floating toolbar pinned to the bottom of the viewport when one or
// more tasks are selected (Cmd-click on a row to start a selection).
// Surfaces the same actions as a single-row popover but applies them
// to the whole set: reassign, repri, mark done, delete.
function BulkActionBar({ count, onAssign, onPriority, onDone, onPin, onDelete, onClear }: {
  count: number;
  onAssign: (id: string) => void;
  onPriority: (p: Priority) => void;
  onDone: () => void;
  onPin: () => void;
  onDelete: () => void;
  onClear: () => void;
}) {
  return (
    <BodyPortal>
      <div style={{ position: "fixed", left: 0, right: 0, bottom: 24, display: "flex", justifyContent: "center", pointerEvents: "none", zIndex: 11000 }}>
        <div style={{ pointerEvents: "auto", display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: "#0A0A14", border: `1px solid ${D.amber}55`, borderRadius: 12, boxShadow: "0 24px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(247,176,65,0.08)", fontFamily: mn, fontSize: 11, letterSpacing: 0.3 }}>
          <span style={{ color: D.amber, fontWeight: 700, padding: "3px 10px", background: D.amber + "1c", border: `1px solid ${D.amber}55`, borderRadius: 999 }}>
            {count} selected
          </span>
          <span style={{ color: D.txd, fontSize: 9 }}>Assign:</span>
          {ASSIGNEES.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => onAssign(a.id)}
              title={"Assign to " + a.name}
              style={{ background: "transparent", border: "none", padding: 0, cursor: "pointer", display: "inline-flex" }}
            >
              <Avatar spec={a} size={22} glow />
            </button>
          ))}
          <span style={{ width: 1, height: 18, background: D.border, margin: "0 2px" }} />
          <span style={{ color: D.txd, fontSize: 9 }}>Priority:</span>
          {(["HIGH", "MEDIUM", "THIS WEEK", "ONGOING"] as Priority[]).map((p) => {
            const c = PRIORITY_COLORS[p];
            return (
              <button
                key={p}
                type="button"
                onClick={() => onPriority(p)}
                title={"Set priority to " + p}
                style={{ background: c + "1c", color: c, border: `1px solid ${c}55`, padding: "3px 8px", borderRadius: 4, fontFamily: mn, fontSize: 9, letterSpacing: 0.6, cursor: "pointer", fontWeight: 700, textTransform: "uppercase" }}
              >
                {p}
              </button>
            );
          })}
          <span style={{ width: 1, height: 18, background: D.border, margin: "0 2px" }} />
          <button type="button" onClick={onDone}   style={{ background: "transparent", border: `1px solid ${D.teal}55`,  color: D.teal,  padding: "5px 10px", borderRadius: 6, fontFamily: mn, fontSize: 10, cursor: "pointer", letterSpacing: 0.4 }}>✓ Done</button>
          <button type="button" onClick={onPin}    style={{ background: "transparent", border: `1px solid ${D.amber}55`, color: D.amber, padding: "5px 10px", borderRadius: 6, fontFamily: mn, fontSize: 10, cursor: "pointer", letterSpacing: 0.4 }}>★ Pin</button>
          <button type="button" onClick={onDelete} style={{ background: "transparent", border: `1px solid ${D.coral}55`, color: D.coral, padding: "5px 10px", borderRadius: 6, fontFamily: mn, fontSize: 10, cursor: "pointer", letterSpacing: 0.4 }}>Delete</button>
          <button type="button" onClick={onClear}  style={{ background: "transparent", border: `1px solid ${D.border}`,  color: D.txm,   padding: "5px 10px", borderRadius: 6, fontFamily: mn, fontSize: 10, cursor: "pointer", letterSpacing: 0.4 }}>Esc · Clear</button>
        </div>
      </div>
    </BodyPortal>
  );
}

// ── Command Palette (⌘K) ────────────────────────────────────────────
// Universal switcher: fuzzy-search every task in the active board, plus
// slash-commands for view switches, filter chips, and assignee filters.
// Arrow keys navigate, Enter fires, Esc closes. Lives behind ModalPortal
// so it pins to the viewport regardless of scroll.
interface PaletteCommand {
  id: string;
  kind: "task" | "view" | "filter" | "assignee" | "action";
  label: string;
  hint: string;
  color: string;
  initial?: string;
  task?: Task;
  run: () => void;
}
function CommandPalette({ tasks, onClose, onOpenTask, onStartFocus, onSwitchView, onSetAssigneeFilter, onSetChip, onClearFilters, onAddTask, onFromPrompt }: {
  tasks: Task[];
  onClose: () => void;
  onOpenTask: (t: Task) => void;
  onStartFocus: (t: Task) => void;
  onSwitchView: (v: ViewType) => void;
  onSetAssigneeFilter: (id: string | null) => void;
  onSetChip: (c: FilterChip) => void;
  onClearFilters: () => void;
  onAddTask: () => void;
  onFromPrompt: () => void;
}) {
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);

  // Build the command list every render — cheap (n=tasks+~25 statics)
  // and lets typing immediately reshape the results.
  const lcQuery = query.trim().toLowerCase();
  const isSlash = lcQuery.startsWith("/") || lcQuery.startsWith("@");
  const stripped = isSlash ? lcQuery.slice(1) : lcQuery;

  // Static commands always available, filtered by prefix when slashing.
  const staticCmds: PaletteCommand[] = [
    { id: "v-list",     kind: "view",     label: "Switch to List view",     hint: "1",          color: D.amber, run: () => onSwitchView("list") },
    { id: "v-board",    kind: "view",     label: "Switch to Board view",    hint: "2",          color: D.amber, run: () => onSwitchView("board") },
    { id: "v-calendar", kind: "view",     label: "Switch to Calendar view", hint: "3",          color: D.amber, run: () => onSwitchView("calendar") },
    { id: "v-week",     kind: "view",     label: "Switch to Week view",     hint: "4",          color: D.amber, run: () => onSwitchView("week") },
    { id: "v-focus",    kind: "view",     label: "Switch to Focus view",    hint: "5",          color: D.amber, run: () => onSwitchView("focus") },
    { id: "f-today",    kind: "filter",   label: "Filter: Today + overdue", hint: "chip",       color: D.coral, run: () => onSetChip("today") },
    { id: "f-overdue",  kind: "filter",   label: "Filter: Overdue only",    hint: "chip",       color: D.coral, run: () => onSetChip("overdue") },
    { id: "f-week",     kind: "filter",   label: "Filter: This week",       hint: "chip",       color: D.blue,  run: () => onSetChip("week") },
    { id: "f-pinned",   kind: "filter",   label: "Filter: Pinned",          hint: "chip",       color: D.amber, run: () => onSetChip("pinned") },
    { id: "f-nodue",    kind: "filter",   label: "Filter: No due date",     hint: "chip",       color: D.txm,   run: () => onSetChip("nodue") },
    { id: "f-clear",    kind: "action",   label: "Clear all filters",       hint: "reset",      color: D.teal,  run: onClearFilters },
    ...ASSIGNEES.map((a) => ({
      id: "a-" + a.id, kind: "assignee" as const,
      label: a.id === "Akash" ? "Mine (Akash)" : a.name,
      hint: "show only",
      color: a.color,
      initial: a.initial,
      run: () => onSetAssigneeFilter(a.id),
    })),
    { id: "a-all",      kind: "action",   label: "Show everyone's tasks",   hint: "reset",      color: D.teal,  run: () => onSetAssigneeFilter(null) },
    { id: "add",        kind: "action",   label: "Add new task",            hint: "N",          color: D.amber, run: onAddTask },
    { id: "add-prompt", kind: "action",   label: "Add from prompt (AI)",    hint: "paste",      color: D.amber, run: onFromPrompt },
  ];

  let results: PaletteCommand[] = [];
  if (lcQuery === "") {
    // Empty state: show a useful starter set (most recent tasks + key commands).
    const recent = tasks.filter((t) => !t.done).slice(0, 6).map((t) => taskToCmd(t, onOpenTask, onStartFocus));
    results = [
      ...recent,
      ...staticCmds.slice(0, 8),
    ];
  } else if (isSlash) {
    // Slash mode: filter static commands only.
    results = staticCmds.filter((c) => c.label.toLowerCase().includes(stripped));
  } else {
    // Free-text: fuzzy across tasks (title, desc, tags, category, assignee)
    // plus any static command whose label contains the query.
    const matchedTasks = tasks.filter((t) => {
      const hay = `${t.title} ${t.description || ""} ${t.category} ${(t.assignee || "Akash")} ${(t.tags || []).join(" ")}`.toLowerCase();
      return hay.includes(lcQuery);
    }).slice(0, 12).map((t) => taskToCmd(t, onOpenTask, onStartFocus));
    const matchedCmds = staticCmds.filter((c) => c.label.toLowerCase().includes(lcQuery));
    results = [...matchedTasks, ...matchedCmds];
  }

  // Clamp cursor when results change.
  const safeCursor = Math.min(cursor, Math.max(0, results.length - 1));

  function fire(idx: number) {
    const r = results[idx];
    if (r) r.run();
  }

  function onKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") { e.preventDefault(); setCursor((c) => Math.min(results.length - 1, c + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setCursor((c) => Math.max(0, c - 1)); }
    else if (e.key === "Enter") { e.preventDefault(); fire(safeCursor); }
    else if (e.key === "Escape") { e.preventDefault(); onClose(); }
  }

  return (
    <ModalPortal>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(6,6,12,0.72)", backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", zIndex: 13000, display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: "12vh", padding: 24 }}>
        <div onClick={(e) => e.stopPropagation()} style={{ width: "min(640px, 96vw)", background: "#0A0A14", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 14, boxShadow: "0 30px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(247,176,65,0.08)", overflow: "hidden", display: "flex", flexDirection: "column", maxHeight: "70vh" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 18px", borderBottom: `1px solid ${D.border}` }}>
            <span style={{ fontFamily: mn, fontSize: 11, color: D.amber, letterSpacing: 0.6, padding: "2px 7px", border: `1px solid ${D.amber}55`, borderRadius: 4 }}>⌘K</span>
            <input
              autoFocus
              value={query}
              onChange={(e) => { setQuery(e.target.value); setCursor(0); }}
              onKeyDown={onKey}
              placeholder='Search tasks, or "/" for commands, "@" for filters…'
              style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: D.tx, fontFamily: ft, fontSize: 16, padding: "2px 0", letterSpacing: -0.1 }}
            />
            <span style={{ fontFamily: mn, fontSize: 9, color: D.txd, letterSpacing: 0.6 }}>↑↓ · Enter · Esc</span>
          </div>
          <div style={{ overflowY: "auto", flex: 1, padding: 6 }}>
            {results.length === 0 ? (
              <div style={{ padding: 24, textAlign: "center", fontFamily: mn, fontSize: 11, color: D.txd, letterSpacing: 0.4 }}>
                No matches for &ldquo;{query}&rdquo;
              </div>
            ) : results.map((r, i) => {
              const active = i === safeCursor;
              return (
                <button
                  key={r.id}
                  type="button"
                  onMouseEnter={() => setCursor(i)}
                  onClick={() => fire(i)}
                  style={{
                    display: "flex", alignItems: "center", gap: 10, width: "100%",
                    padding: "9px 12px",
                    background: active ? "rgba(247,176,65,0.10)" : "transparent",
                    border: "none",
                    borderLeft: `2px solid ${active ? r.color : "transparent"}`,
                    borderRadius: 6,
                    cursor: "pointer",
                    textAlign: "left",
                    fontFamily: ft, fontSize: 13, color: D.tx,
                  }}
                >
                  <span style={{ width: 18, height: 18, borderRadius: 4, background: r.color + "22", border: `1px solid ${r.color}55`, color: r.color, display: "inline-flex", alignItems: "center", justifyContent: "center", fontFamily: mn, fontSize: 9, fontWeight: 800, flexShrink: 0 }}>
                    {r.initial || (r.kind === "task" ? "T" : r.kind === "view" ? "V" : r.kind === "filter" ? "F" : r.kind === "assignee" ? "@" : "•")}
                  </span>
                  <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}><Highlight text={r.label} q={isSlash ? undefined : lcQuery} /></span>
                  <span style={{ fontFamily: mn, fontSize: 9, color: D.txd, letterSpacing: 0.5, flexShrink: 0 }}>{r.hint}</span>
                </button>
              );
            })}
          </div>
          <div style={{ padding: "8px 14px", borderTop: `1px solid ${D.border}`, fontFamily: mn, fontSize: 9, color: D.txd, letterSpacing: 0.4, display: "flex", justifyContent: "space-between" }}>
            <span>{results.length} result{results.length === 1 ? "" : "s"}</span>
            <span>Type / for commands · @ for filters</span>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}

function taskToCmd(t: Task, onOpen: (t: Task) => void, _onFocus: (t: Task) => void): PaletteCommand {
  const aSpec = getAssigneeSpec(t.assignee || "Akash");
  const due = t.dueDate ? formatDue(t.dueDate) : null;
  const hint = due ? due.label : (t.priority || "—");
  return {
    id: "t-" + t.id,
    kind: "task",
    label: t.title,
    hint,
    color: aSpec.color,
    initial: aSpec.initial,
    task: t,
    run: () => onOpen(t),
  };
}

// Quick due-date popover. Surfaced on the task row when the date pill
// (or "+ Date" placeholder on hover) is clicked. Presets cover ~95% of
// what gets typed manually; the native date input handles the rest.
function DueMenu({ current, onPick }: { current?: string; onPick: (d: string | undefined) => void }) {
  const today = startOfDay(new Date());
  const todayIso = isoDate(today);
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
  // Friday-of-this-week: 5 - dow (0..6 with sun=0); if past Friday, fall through to next Friday.
  const friday = new Date(today);
  const fridayDelta = (5 - friday.getDay() + 7) % 7;
  friday.setDate(friday.getDate() + (fridayDelta === 0 ? 7 : fridayDelta));
  const nextMon = new Date(today);
  const monDelta = (1 - nextMon.getDay() + 7) % 7;
  nextMon.setDate(nextMon.getDate() + (monDelta === 0 ? 7 : monDelta));
  const week = new Date(today); week.setDate(week.getDate() + 7);
  const presets: Array<{ label: string; sub: string; iso: string }> = [
    { label: "Today",    sub: "tonight",  iso: todayIso },
    { label: "Tomorrow", sub: tomorrow.toLocaleDateString(undefined, { weekday: "short" }), iso: isoDate(tomorrow) },
    { label: "Friday",   sub: friday.toLocaleDateString(undefined, { month: "short", day: "numeric" }), iso: isoDate(friday) },
    { label: "Next Mon", sub: nextMon.toLocaleDateString(undefined, { month: "short", day: "numeric" }), iso: isoDate(nextMon) },
    { label: "+1 week",  sub: week.toLocaleDateString(undefined, { month: "short", day: "numeric" }),   iso: isoDate(week) },
  ];
  return (
    <div style={{ position: "absolute", top: "calc(100% + 6px)", right: 0, background: D.bg, border: `1px solid ${D.border}`, borderRadius: 8, padding: 6, zIndex: 100, boxShadow: "0 6px 24px rgba(0,0,0,0.4)", display: "flex", flexDirection: "column", gap: 2, minWidth: 200, textAlign: "left" }}>
      {presets.map((p) => {
        const active = current === p.iso;
        return (
          <button
            key={p.label}
            type="button"
            onClick={() => onPick(p.iso)}
            style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "5px 10px", background: active ? D.amber + "22" : "transparent", color: active ? D.amber : D.tx, border: "none", borderRadius: 4, fontFamily: mn, fontSize: 10.5, letterSpacing: 0.4, cursor: "pointer" }}
          >
            <span>{p.label}</span>
            <span style={{ color: D.txd, fontSize: 9, letterSpacing: 0.3 }}>{p.sub}</span>
          </button>
        );
      })}
      <div style={{ height: 1, background: D.border, margin: "4px 0" }} />
      <label style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 10px", fontFamily: mn, fontSize: 9.5, color: D.txm, letterSpacing: 0.4 }}>
        <span>Pick:</span>
        <input
          type="date"
          value={current || ""}
          onChange={(e) => onPick(e.target.value || undefined)}
          style={{ flex: 1, background: D.surface, color: D.tx, border: `1px solid ${D.border}`, borderRadius: 4, padding: "3px 6px", fontFamily: mn, fontSize: 10, outline: "none" }}
        />
      </label>
      {current ? (
        <button
          type="button"
          onClick={() => onPick(undefined)}
          style={{ marginTop: 2, display: "flex", alignItems: "center", gap: 6, padding: "5px 10px", background: "transparent", color: D.coral, border: "none", borderRadius: 4, fontFamily: mn, fontSize: 10, letterSpacing: 0.4, cursor: "pointer", textAlign: "left" }}
        >
          × Clear date
        </button>
      ) : null}
    </div>
  );
}

// Avatar-chip picker used in the Add / Edit modals. Visual sibling of a
// native <select> but with the assignee's color and initial baked in.
function AssigneePicker({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const spec = getAssigneeSpec(value);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 8px", background: "rgba(255,255,255,0.03)", border: `1px solid ${D.border}`, borderRadius: 6, height: 38 }}>
      <Avatar spec={spec} size={20} />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ flex: 1, background: "transparent", color: D.tx, border: "none", outline: "none", fontFamily: ft, fontSize: 13, cursor: "pointer" }}
      >
        {ASSIGNEES.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
      </select>
    </div>
  );
}

// Portal helper without side effects. Use for floating *chrome* that
// happens to need viewport-anchored positioning (the combine dock, the
// bulk-action bar) — they live on top of the page but should never
// stop the page from scrolling.
function BodyPortal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return null;
  return createPortal(children, document.body);
}

// Same as BodyPortal but ALSO locks body scroll while mounted. Use for
// actual modal dialogs (Edit / Add / Board / Focus / Combine / ⌘K) so
// the underlying page can't slide out from under the modal mid-edit.
function ModalPortal({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);
  return <BodyPortal>{children}</BodyPortal>;
}

const lbl: React.CSSProperties = { fontFamily: mn, fontSize: 10, letterSpacing: 1.2, textTransform: "uppercase", color: D.txd, marginBottom: 4 };
const inputStyle: React.CSSProperties = { width: "100%", padding: "8px 10px", background: "rgba(255,255,255,0.03)", border: `1px solid ${D.border}`, borderRadius: 6, color: D.tx, fontFamily: ft, fontSize: 13, outline: "none", boxSizing: "border-box" };
const primaryBtn: React.CSSProperties = { background: D.amber, color: "#060608", border: "none", padding: "9px 18px", borderRadius: 8, fontFamily: ft, fontSize: 13, fontWeight: 800, cursor: "pointer", letterSpacing: 0.3 };
const ghostBtn: React.CSSProperties = { background: "transparent", color: D.tx, border: `1px solid ${D.border}`, padding: "9px 14px", borderRadius: 8, fontFamily: ft, fontSize: 12, cursor: "pointer" };
const emptyBox: React.CSSProperties = { border: `1px dashed ${D.border}`, borderRadius: 12, padding: 28, background: D.surface, color: D.txm, fontFamily: ft, fontSize: 14, lineHeight: 1.5 };
const overlay: React.CSSProperties = { position: "fixed", inset: 0, background: "rgba(6,6,12,0.78)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)", zIndex: 12000, display: "flex", alignItems: "safe center", justifyContent: "center", overflowY: "auto", padding: 24 };
const panel: React.CSSProperties = { width: "min(680px, 96vw)", background: "#0A0A14", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: "26px 28px 22px", maxHeight: "calc(100vh - 48px)", overflowY: "auto" };
