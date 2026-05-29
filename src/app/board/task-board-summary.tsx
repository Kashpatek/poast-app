"use client";

// Task Board Suite — full-on productivity launcher embedded in POAST.
//
// Layout: left sidebar (views, categories, team) + top filter bar +
// content area that swaps between Today / Schedule / Board / All / Done.
// Quick-add input top-right, full "New task" modal for everything else.
//
// Shares the Supabase row with /board (Studio) so edits round-trip.

import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { D, ft, gf, mn } from "../shared-constants";
import { confirmDialog, promptDialog } from "../dialog-context";

// ─── types (mirror akash-todo schema) ───
type Priority = "HIGH" | "MEDIUM" | "THIS WEEK" | "ONGOING" | "DONE";
interface Subtask { id: string; title: string; done?: boolean }
interface Task {
  id: string;
  title: string;
  description?: string;
  category: string;
  priority: Priority;
  dueDate?: string;
  done?: boolean;
  assignee?: string;
  subtasks?: Subtask[];
  estimateMins?: number;
  addedAt: string;
  updatedAt?: string;
  isRecurringTemplate?: boolean;
  pinned?: boolean;
  source?: string;
  scheduledFor?: string;
}
interface ActivityEntry { ts: string; action: string; label: string; taskId?: string }
interface Board { id: string; name: string; tasks: Task[]; createdAt: string; activity?: ActivityEntry[] }
interface BoardArchive { boards: Board[]; activeId: string }
interface SavedView {
  id: string;
  name: string;
  view: ViewKey;
  catFilter: string | null;
  assigneeFilter: string | null;
  search: string;
  groupBy: GroupBy;
}

const PRIORITY_ORDER: Priority[] = ["HIGH", "MEDIUM", "THIS WEEK", "ONGOING"];

const CATEGORIES = [
  "GRAPHIC DESIGN", "MARKETING OPS", "VIDEO PRODUCTION", "BRAND / IDENTITY",
  "DEV / ACCESS", "CONTENT OPS", "PODCAST", "EVENTS", "RESEARCH", "ADMIN", "OTHER",
];
const CAT_COLOR: Record<string, string> = {
  "GRAPHIC DESIGN": D.amber, "MARKETING OPS": D.coral, "VIDEO PRODUCTION": D.blue,
  "BRAND / IDENTITY": D.teal, "DEV / ACCESS": D.violet, "CONTENT OPS": D.cyan,
  "PODCAST": D.coral, "EVENTS": D.amber, "RESEARCH": D.blue,
  "ADMIN": D.violet, "OTHER": D.txd,
};
const PRI_COLOR: Record<Priority, string> = {
  HIGH: D.coral, MEDIUM: D.amber, "THIS WEEK": D.blue, ONGOING: D.txm, DONE: D.teal,
};
const ASSIGNEES = ["Akash", "Daksh", "Vansh", "Max", "Michelle", "Unassigned"];
const ASSIGNEE_COLOR: Record<string, string> = {
  Akash: D.amber, Daksh: D.blue, Vansh: D.teal, Max: D.violet,
  Michelle: D.coral, Unassigned: D.txd,
};

type ViewKey = "today" | "schedule" | "board" | "all" | "category" | "week" | "calendar" | "focus" | "done";
type GroupBy = "priority" | "category" | "assignee" | "due";
type SmartFilter = "overdue" | "today" | "nodue" | "unassigned" | "recent" | null;
type TaskGroup = { key: string; color: string; tasks: Task[] };

// Smart filters are live-computed slices that compose on top of catFilter /
// assigneeFilter / search. They live next to Saved Views in the sidebar so a
// user can jump to "Overdue" or "Recently added" without writing them down.
// Counts re-derive from openTasks each render so the chips stay in sync.
const SMART_FILTERS: { id: NonNullable<SmartFilter>; label: string; icon: string; accentKey: "coral" | "amber" | "blue" | "violet" | "teal" }[] = [
  { id: "overdue",    label: "Overdue",       icon: "⚠", accentKey: "coral"  },
  { id: "today",      label: "Due today",     icon: "◐", accentKey: "amber"  },
  { id: "nodue",      label: "No due date",   icon: "◌", accentKey: "violet" },
  { id: "unassigned", label: "Unassigned",    icon: "○", accentKey: "blue"   },
  { id: "recent",     label: "Recently added",icon: "✦", accentKey: "teal"   },
];
function matchesSmart(t: Task, sf: SmartFilter): boolean {
  if (!sf) return true;
  if (sf === "overdue")    return isOverdue(t);
  if (sf === "today")      return isToday(t);
  if (sf === "nodue")      return !t.dueDate && !t.done;
  if (sf === "unassigned") return (!t.assignee || t.assignee === "Unassigned") && !t.done;
  if (sf === "recent")     return Date.parse(t.addedAt) > Date.now() - 24 * 60 * 60 * 1000;
  return true;
}

const GROUP_LABELS: Record<GroupBy, string> = {
  priority: "Priority",
  category: "Category",
  assignee: "Assignee",
  due:      "Due date",
};

const VIEW_META: Record<ViewKey, { label: string; icon: string }> = {
  today:    { label: "Today",      icon: "◉" },
  schedule: { label: "Schedule",   icon: "▤" },
  week:     { label: "Week",       icon: "▥" },
  calendar: { label: "Calendar",   icon: "▩" },
  board:    { label: "Board",      icon: "▦" },
  category: { label: "Categories", icon: "◈" },
  all:      { label: "All",        icon: "≡" },
  focus:    { label: "Focus",      icon: "◎" },
  done:     { label: "Done",       icon: "✓" },
};
function viewLabel(v: ViewKey): string { return VIEW_META[v].label; }
function viewIcon(v: ViewKey): string { return VIEW_META[v].icon; }

// Drag context — lets deeply-nested rows opt into HTML5 drag without prop
// drilling. Drop targets (sidebar entries, board columns, combine dock)
// call applyPatch / addToCombine.
interface DragCtxValue {
  draggingId: string | null;
  startDrag: (id: string) => void;
  endDrag: () => void;
  applyPatch: (id: string, patch: Partial<Task>) => void;
  combineIds: string[];
  toggleCombine: (id: string) => void;
  clearCombine: () => void;
  openCombine: () => void;
  selectedIds: Set<string>;
  toggleSelected: (id: string) => void;
  openFocus: (t: Task) => void;
  openEdit: (t: Task) => void;
  removeTask: (id: string) => void;
}
const DragCtx = React.createContext<DragCtxValue | null>(null);
function useDrag(): DragCtxValue {
  const v = useContext(DragCtx);
  if (!v) throw new Error("DragCtx missing");
  return v;
}

// ─── helpers ───
function startOfDay(d: Date): Date { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
function isoDate(d: Date): string { return d.toISOString().slice(0, 10); }
function todayIso() { return isoDate(startOfDay(new Date())); }
function isOverdue(t: Task): boolean { return !!t.dueDate && !t.done && t.dueDate < todayIso(); }
function isToday(t: Task): boolean { return !!t.dueDate && t.dueDate === todayIso(); }
function dueLabel(d?: string): string {
  if (!d) return "—";
  const t = todayIso();
  if (d === t) return "Today";
  if (d < t) {
    const days = Math.floor((Date.parse(t) - Date.parse(d)) / 86400000);
    return days === 1 ? "1d late" : days + "d late";
  }
  const days = Math.floor((Date.parse(d) - Date.parse(t)) / 86400000);
  if (days === 1) return "Tomorrow";
  if (days <= 6) return new Date(d + "T00:00:00").toLocaleDateString("en-US", { weekday: "short" });
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
function greeting(name: string): string {
  const h = new Date().getHours();
  if (h < 5) return "Still up, " + name + "?";
  if (h < 12) return "Good morning, " + name + ".";
  if (h < 17) return "Good afternoon, " + name + ".";
  if (h < 21) return "Good evening, " + name + ".";
  return "Late night, " + name + "?";
}

// Match the AkashTodo planner default: unsized tasks count as 30m.
function estOf(t: Task): number { return Math.max(0, t.estimateMins ?? 30); }
function sumMins(arr: Task[]): number { return arr.reduce((s, t) => s + estOf(t), 0); }
function fmtMins(n: number): string {
  if (n <= 0) return "0m";
  const h = Math.floor(n / 60);
  const m = n % 60;
  if (h === 0) return m + "m";
  if (m === 0) return h + "h";
  return h + "h " + m + "m";
}

function Avatar({ name, size = 22 }: { name: string; size?: number }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: size,
      background: ASSIGNEE_COLOR[name] || D.txd,
      color: "#0A0A0F", fontWeight: 800, fontSize: size * 0.42,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: ft, flexShrink: 0,
    }}>{name[0]}</div>
  );
}

function StatusCircle({ done = false, size = 16, onClick }: { done?: boolean; size?: number; onClick?: (e: React.MouseEvent) => void }) {
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onClick?.(e); }}
      style={{
        width: size, height: size, borderRadius: size,
        border: "1.6px solid " + (done ? D.teal : D.txd),
        background: done ? D.teal : "transparent",
        display: "flex", alignItems: "center", justifyContent: "center",
        flexShrink: 0, cursor: "pointer", padding: 0,
      }}
    >
      {done && <svg width={size * 0.55} height={size * 0.55} viewBox="0 0 12 12" fill="none"><path d="M2 6.5L5 9.5L10 3.5" stroke="#0A0A0F" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>}
    </button>
  );
}

function TimePill({ mins, tone = "muted" }: { mins: number; tone?: "muted" | "warm" | "cool" }) {
  const color = tone === "warm" ? D.amber : tone === "cool" ? D.blue : D.txm;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      fontFamily: mn, fontSize: 10, fontWeight: 600, letterSpacing: 0.3,
      color, padding: "2px 7px",
      border: "1px solid " + color + "44",
      borderRadius: 5, whiteSpace: "nowrap",
    }}>
      <span style={{ fontSize: 9, opacity: 0.8 }}>◷</span> {fmtMins(mins)}
    </span>
  );
}

// ── ported chrome from the original AkashTodo ──

// Small stat tile (OVERDUE / TODAY / DONE) used inside TodayHero.
function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center", gap: 0,
      padding: "4px 12px",
      background: value > 0 ? color + "16" : "transparent",
      border: "1px solid " + (value > 0 ? color + "55" : D.border),
      borderRadius: 8, minWidth: 56,
    }}>
      <span style={{ fontFamily: gf, fontSize: 18, fontWeight: 900, color: value > 0 ? color : D.txd, letterSpacing: -0.6, lineHeight: 1 }}>{value}</span>
      <span style={{ fontFamily: mn, fontSize: 8, color: value > 0 ? color : D.txd, letterSpacing: 0.8 }}>{label}</span>
    </div>
  );
}

// 5-card priority counter row. Top accent bar + glowing huge number + lift on hover.
function PriorityCounter({ label, count, color }: { label: string; count: number; color: string }) {
  const [hover, setHover] = useState(false);
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: "relative",
        background: hover ? "linear-gradient(180deg, " + color + "10, transparent 70%), " + D.surface : D.surface,
        border: "1px solid " + (hover ? color + "66" : D.border),
        borderRadius: 10,
        padding: "12px 14px 10px",
        overflow: "hidden",
        transition: "border-color 0.18s, box-shadow 0.18s, background 0.18s, transform 0.18s",
        transform: hover ? "translateY(-1px)" : "translateY(0)",
        boxShadow: hover ? "0 8px 22px " + color + "26, inset 0 0 0 1px " + color + "22" : "none",
      }}
    >
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: "linear-gradient(90deg, " + color + ", " + color + "66)" }} />
      <div style={{ fontFamily: mn, fontSize: 9, letterSpacing: 1.2, textTransform: "uppercase", color: hover ? color : D.txd, marginBottom: 4, transition: "color 0.18s" }}>{label}</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <span style={{ fontFamily: gf, fontSize: 28, fontWeight: 900, color, letterSpacing: -1, lineHeight: 1, textShadow: hover ? "0 0 14px " + color + "55" : "none", transition: "text-shadow 0.18s" }}>{count}</span>
      </div>
    </div>
  );
}

// SVG donut for subtask completion — replaces the flat "⊟ 0/3" text.
function SubtaskRing({ done, total, color, size = 22 }: { done: number; total: number; color: string; size?: number }) {
  const stroke = 2.2;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = total === 0 ? 0 : done / total;
  return (
    <svg width={size} height={size} viewBox={"0 0 " + size + " " + size} style={{ flexShrink: 0, display: "block" }}>
      <circle cx={size / 2} cy={size / 2} r={r} stroke={color + "33"} strokeWidth={stroke} fill="transparent" />
      <circle
        cx={size / 2} cy={size / 2} r={r}
        stroke={color} strokeWidth={stroke} strokeLinecap="round" fill="transparent"
        strokeDasharray={(c * pct) + " " + c}
        transform={"rotate(-90 " + (size / 2) + " " + (size / 2) + ")"}
        style={{ transition: "stroke-dasharray 0.3s" }}
      />
      <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle" fill={color} fontFamily="JetBrains Mono, monospace" fontSize={size * 0.36} fontWeight={800}>
        {done}/{total}
      </text>
    </svg>
  );
}

// Gradient banner with greeting + OVERDUE/TODAY/DONE stats + 3 numbered "Start here"
// suggestions. Ranked by priority with overdue/today/pinned boosts.
function TodayHero({ tasks, doneRecent, onFocus }: { tasks: Task[]; doneRecent: number; onFocus: (t: Task) => void }) {
  const todayStr = todayIso();
  const live = tasks.filter((t) => !t.done && t.priority !== "DONE");
  const overdueN = live.filter(isOverdue).length;
  const todayN = live.filter(isToday).length;
  const pOrder: Record<Priority, number> = { HIGH: 0, MEDIUM: 1, "THIS WEEK": 2, ONGOING: 3, DONE: 9 };
  const score = (t: Task) => {
    let s = pOrder[t.priority] * 10;
    if (t.dueDate && t.dueDate < todayStr) s -= 100;
    else if (t.dueDate === todayStr) s -= 50;
    if (t.pinned) s -= 5;
    return s;
  };
  const suggestions = [...live].sort((a, b) => score(a) - score(b)).slice(0, 3);

  const hour = new Date().getHours();
  const greet = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <div style={{
      marginBottom: 16, position: "relative", overflow: "hidden", borderRadius: 14,
      border: "1px solid " + D.amber + "33",
      background: "linear-gradient(135deg, rgba(247,176,65,0.10) 0%, rgba(11,134,209,0.06) 60%, transparent 100%), " + D.surface,
      padding: 16,
    }}>
      <div aria-hidden="true" style={{
        position: "absolute", top: -40, right: -40, width: 200, height: 200, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(247,176,65,0.18), transparent 70%)", pointerEvents: "none",
      }} />
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, marginBottom: 10, position: "relative" }}>
        <div>
          <div style={{ fontFamily: mn, fontSize: 10, color: D.amber, letterSpacing: 1.4, textTransform: "uppercase", fontWeight: 700 }}>{greet}, Akash</div>
          <div style={{ fontFamily: gf, fontSize: 18, fontWeight: 800, color: D.tx, letterSpacing: -0.4, marginTop: 2 }}>
            {todayN === 0 && overdueN === 0
              ? "Nothing on the board for today — pick something to push forward."
              : todayN + " due today" + (overdueN > 0 ? " · " + overdueN + " overdue" : "") + (doneRecent > 0 ? " · " + doneRecent + " done" : "")}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          <Stat label="OVERDUE" value={overdueN} color={D.coral} />
          <Stat label="TODAY"   value={todayN}   color={D.amber} />
          <Stat label="DONE"    value={doneRecent} color={D.teal} />
        </div>
      </div>
      {suggestions.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 4, position: "relative" }}>
          <div style={{ fontFamily: mn, fontSize: 9, color: D.txd, letterSpacing: 1.2, textTransform: "uppercase" }}>Start here</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {suggestions.map((t, i) => {
              const pColor = PRI_COLOR[t.priority] || D.txd;
              const due = t.dueDate ? dueLabel(t.dueDate) : null;
              const urgent = isOverdue(t) || isToday(t);
              return (
                <a
                  key={t.id}
                  href="/board"
                  target="_blank"
                  rel="noopener"
                  onClick={(e) => { e.preventDefault(); onFocus(t); }}
                  style={{
                    display: "flex", alignItems: "center", gap: 10, padding: "8px 10px",
                    background: i === 0 ? "rgba(247,176,65,0.10)" : "rgba(255,255,255,0.02)",
                    border: "1px solid " + (i === 0 ? D.amber + "55" : D.border),
                    borderRadius: 8, cursor: "pointer", textAlign: "left", width: "100%",
                    textDecoration: "none", color: "inherit",
                  }}
                >
                  <span style={{ fontFamily: mn, fontSize: 10, color: D.amber, letterSpacing: 0.5, minWidth: 18, opacity: i === 0 ? 1 : 0.5 }}>#{i + 1}</span>
                  <Avatar name={t.assignee || "Akash"} size={18} />
                  <span style={{ fontFamily: mn, fontSize: 8.5, color: pColor, letterSpacing: 0.6, padding: "1px 6px", border: "1px solid " + pColor + "55", borderRadius: 3, textTransform: "uppercase" }}>{t.priority}</span>
                  <span style={{ flex: 1, minWidth: 0, fontFamily: gf, fontSize: 13, fontWeight: 700, color: D.tx, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.title}</span>
                  {due && <span style={{ fontFamily: mn, fontSize: 9.5, color: urgent ? D.coral : D.txm, letterSpacing: 0.4 }}>{due}</span>}
                  <span style={{
                    background: i === 0 ? D.amber : "transparent",
                    color: i === 0 ? "#060608" : D.amber,
                    border: "1px solid " + D.amber, padding: "4px 10px", borderRadius: 6,
                    fontFamily: mn, fontSize: 9, letterSpacing: 0.6, fontWeight: 800, textTransform: "uppercase",
                  }}>Focus →</span>
                </a>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// SUMMARY (the suite)
// ═══════════════════════════════════════════════════════════════════
interface TaskBoardSummaryProps {
  // "embed" = inside POAST hub (max-width 1500, "Open Studio" link).
  // "standalone" = full-screen at /board (wider canvas, "POAST hub" backlink, STUDIO eyebrow).
  mode?: "embed" | "standalone";
}

export default function TaskBoardSummary({ mode = "embed" }: TaskBoardSummaryProps = {}) {
  const isStandalone = mode === "standalone";
  const [archive, setArchive] = useState<BoardArchive>({ boards: [], activeId: "" });
  const [loading, setLoading] = useState(true);
  const [quickAdd, setQuickAdd] = useState("");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");

  // suite state
  const [view, setView] = useState<ViewKey>("today");
  const [groupBy, setGroupBy] = useState<GroupBy>("priority");
  const [catFilter, setCatFilter] = useState<string | null>(null);
  const [assigneeFilter, setAssigneeFilter] = useState<string | null>(null);
  const [smartFilter, setSmartFilter] = useState<SmartFilter>(null);
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [focusIdx, setFocusIdx] = useState(0);
  const [savedViews, setSavedViews] = useState<SavedView[]>([]);

  // drag + combine state
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [combineIds, setCombineIds] = useState<string[]>([]);
  const [combineModalOpen, setCombineModalOpen] = useState(false);

  // palette + bulk-select + focus state
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [focusTask, setFocusTask] = useState<Task | null>(null);
  const [editTaskId, setEditTaskId] = useState<string | null>(null);
  const [activityOpen, setActivityOpen] = useState(false);
  const [plannerOpen, setPlannerOpen] = useState(false);
  const [narrow, setNarrow] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  // undo stack — last 20 archive snapshots
  const undoStackRef = useRef<BoardArchive[]>([]);
  function pushHistory(prev: BoardArchive) {
    undoStackRef.current = [...undoStackRef.current, prev].slice(-20);
  }
  function undo() {
    const stack = undoStackRef.current;
    if (stack.length === 0) return;
    const prev = stack[stack.length - 1];
    undoStackRef.current = stack.slice(0, -1);
    setArchive(prev);
  }

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(max-width: 860px)");
    const update = () => setNarrow(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const lastSavedRef = useRef<string>("");
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/db?table=projects");
      const j = await res.json();
      const row = (j.data || []).find((r: { id: string; type: string }) => r.id === "akash-todo-master" && r.type === "akash-todo");
      const data: BoardArchive = row?.data || { boards: [], activeId: "" };
      if (data.boards.length === 0) {
        const def: Board = { id: "b-" + Date.now(), name: "May 2026", tasks: [], createdAt: new Date().toISOString() };
        data.boards = [def];
        data.activeId = def.id;
      }
      if (!data.activeId || !data.boards.find((b) => b.id === data.activeId)) data.activeId = data.boards[0].id;
      lastSavedRef.current = JSON.stringify(data);
      setArchive(data);
    } catch { /* tolerate */ }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (loading) return;
    const id = setInterval(() => { load(); }, 20000);
    return () => clearInterval(id);
  }, [loading, load]);

  const saveArchive = useCallback(async (next: BoardArchive) => {
    setSaveState("saving");
    try {
      const res = await fetch("/api/db", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          table: "projects",
          data: { id: "akash-todo-master", name: "Akash Todo", type: "akash-todo", data: next, updated_at: new Date().toISOString() },
        }),
      });
      if (!res.ok) { setSaveState("error"); return; }
      lastSavedRef.current = JSON.stringify(next);
      setSaveState("saved");
      setTimeout(() => setSaveState((s) => s === "saved" ? "idle" : s), 1500);
    } catch { setSaveState("error"); }
  }, []);

  useEffect(() => {
    if (loading) return;
    const ser = JSON.stringify(archive);
    if (ser === lastSavedRef.current) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => saveArchive(archive), 400);
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, [archive, loading, saveArchive]);

  // ── Saved Views — per-user (localStorage). Lets users snapshot a
  // view + filter + group-by combo as a one-click chip in the sidebar,
  // Plane-style. Personal to this browser; not synced to Supabase.
  useEffect(() => {
    try {
      const raw = typeof window !== "undefined" ? window.localStorage.getItem("tb-saved-views") : null;
      if (raw) setSavedViews(JSON.parse(raw));
    } catch {}
  }, []);
  useEffect(() => {
    try {
      if (typeof window !== "undefined") {
        window.localStorage.setItem("tb-saved-views", JSON.stringify(savedViews));
      }
    } catch {}
  }, [savedViews]);

  const activeBoard = archive.boards.find((b) => b.id === archive.activeId);
  const allTasks = useMemo(() => (activeBoard?.tasks || []).filter((t) => !t.isRecurringTemplate), [activeBoard]);
  const openTasks = useMemo(() => allTasks.filter((t) => !t.done), [allTasks]);

  function recordActivity(b: Board, action: string, label: string, taskId?: string): Board {
    const entry: ActivityEntry = { ts: new Date().toISOString(), action, label, taskId };
    const log = [entry, ...(b.activity || [])].slice(0, 100);
    return { ...b, activity: log };
  }

  function updateActiveBoard(patch: (b: Board) => Board, log?: { action: string; label: string; taskId?: string }) {
    setArchive((cur) => {
      const id = cur.activeId; if (!id) return cur;
      const idx = cur.boards.findIndex((b) => b.id === id); if (idx < 0) return cur;
      pushHistory(cur);
      let next = patch(cur.boards[idx]);
      if (log) next = recordActivity(next, log.action, log.label, log.taskId);
      const boards = cur.boards.slice();
      boards[idx] = next;
      return { ...cur, boards };
    });
  }

  function toggleDone(id: string) {
    const t = allTasks.find((x) => x.id === id);
    updateActiveBoard(
      (b) => ({ ...b, tasks: b.tasks.map((x) => x.id === id ? { ...x, done: !x.done, updatedAt: new Date().toISOString() } : x) }),
      { action: t?.done ? "reopen" : "done", label: t?.title || "task", taskId: id },
    );
  }

  function applyPatch(id: string, patch: Partial<Task>) {
    const t = allTasks.find((x) => x.id === id);
    const key = Object.keys(patch)[0] || "edit";
    updateActiveBoard(
      (b) => ({ ...b, tasks: b.tasks.map((x) => x.id === id ? { ...x, ...patch, updatedAt: new Date().toISOString() } : x) }),
      { action: key, label: (t?.title || "task") + " → " + Object.values(patch).join(", "), taskId: id },
    );
  }
  function removeTask(id: string) {
    const t = allTasks.find((x) => x.id === id);
    updateActiveBoard(
      (b) => ({ ...b, tasks: b.tasks.filter((x) => x.id !== id) }),
      { action: "delete", label: t?.title || "task", taskId: id },
    );
  }
  function duplicateTask(id: string) {
    const src = allTasks.find((x) => x.id === id);
    if (!src) return;
    const stamp = new Date().toISOString();
    const copy: Task = {
      ...src,
      id: "t-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6),
      title: "Copy of " + src.title,
      addedAt: stamp,
      updatedAt: undefined,
      done: false,
      pinned: false,
      isRecurringTemplate: false,
      source: "duplicate",
      subtasks: src.subtasks ? src.subtasks.map((s) => ({
        id: "s-" + Date.now() + "-" + Math.random().toString(36).slice(2, 5),
        title: s.title,
        done: false,
      })) : undefined,
    };
    updateActiveBoard(
      (b) => ({ ...b, tasks: [copy, ...b.tasks] }),
      { action: "duplicate", label: copy.title, taskId: copy.id },
    );
    setEditTaskId(copy.id);
  }
  function toggleCombine(id: string) {
    setCombineIds((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]);
  }
  function clearCombine() { setCombineIds([]); }
  function openCombine() { if (combineIds.length >= 2) setCombineModalOpen(true); }

  function toggleSelected(id: string) {
    setSelectedIds((p) => {
      const next = new Set(p);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }
  function clearSelection() { setSelectedIds(new Set()); }
  function bulkPatch(patch: Partial<Task>) {
    if (selectedIds.size === 0) return;
    const n = selectedIds.size;
    const key = Object.keys(patch)[0] || "edit";
    updateActiveBoard(
      (b) => ({ ...b, tasks: b.tasks.map((t) => selectedIds.has(t.id) ? { ...t, ...patch, updatedAt: new Date().toISOString() } : t) }),
      { action: "bulk-" + key, label: n + " tasks → " + Object.values(patch).join(", ") },
    );
  }
  function bulkRemove() {
    if (selectedIds.size === 0) return;
    const n = selectedIds.size;
    updateActiveBoard(
      (b) => ({ ...b, tasks: b.tasks.filter((t) => !selectedIds.has(t.id)) }),
      { action: "bulk-delete", label: "deleted " + n + " tasks" },
    );
    clearSelection();
  }
  function bulkDone() {
    if (selectedIds.size === 0) return;
    const n = selectedIds.size;
    updateActiveBoard(
      (b) => ({ ...b, tasks: b.tasks.map((t) => selectedIds.has(t.id) ? { ...t, done: true, updatedAt: new Date().toISOString() } : t) }),
      { action: "bulk-done", label: "completed " + n + " tasks" },
    );
    clearSelection();
  }

  const dragCtxValue = useMemo<DragCtxValue>(() => ({
    draggingId,
    startDrag: setDraggingId,
    endDrag: () => setDraggingId(null),
    applyPatch,
    combineIds,
    toggleCombine,
    clearCombine,
    openCombine,
    selectedIds,
    toggleSelected,
    openFocus: setFocusTask,
    openEdit: (t: Task) => setEditTaskId(t.id),
    removeTask,
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [draggingId, combineIds, selectedIds]);

  function commitCombine(merged: Task, sourceIds: string[]) {
    updateActiveBoard(
      (b) => ({ ...b, tasks: [merged, ...b.tasks.filter((t) => !sourceIds.includes(t.id))] }),
      { action: "combine", label: "merged " + sourceIds.length + " → " + merged.title, taskId: merged.id },
    );
    setCombineIds([]);
    setCombineModalOpen(false);
  }

  // ── global keyboard handlers (⌘K palette, ⌘Z undo, Esc, F) ──
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tgt = e.target as HTMLElement | null;
      const typing = tgt && (tgt.tagName === "INPUT" || tgt.tagName === "TEXTAREA" || tgt.isContentEditable);
      if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        setPaletteOpen((o) => !o);
        return;
      }
      if ((e.metaKey || e.ctrlKey) && (e.key === "z" || e.key === "Z") && !e.shiftKey) {
        e.preventDefault();
        undo();
        return;
      }
      if (e.key === "Escape") {
        if (shortcutsOpen) { setShortcutsOpen(false); return; }
        if (editTaskId) { setEditTaskId(null); return; }
        if (focusTask) { setFocusTask(null); return; }
        if (paletteOpen) { setPaletteOpen(false); return; }
        if (activityOpen) { setActivityOpen(false); return; }
        if (sidebarOpen) { setSidebarOpen(false); return; }
        if (combineModalOpen) { setCombineModalOpen(false); return; }
        if (combineIds.length > 0) { clearCombine(); return; }
        if (selectedIds.size > 0) { clearSelection(); return; }
      }
      if (!typing && e.key === "?" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setShortcutsOpen((o) => !o);
        return;
      }
      if (!typing && e.key === "f" && !e.metaKey && !e.ctrlKey && !e.altKey && !focusTask && !paletteOpen) {
        const first = openTasks[0];
        if (first) { e.preventDefault(); setFocusTask(first); }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusTask, paletteOpen, activityOpen, sidebarOpen, combineModalOpen, combineIds.length, selectedIds, openTasks, shortcutsOpen, editTaskId]);

  function submitQuickAdd() {
    const txt = quickAdd.trim();
    if (!txt) return;
    const stamp = new Date().toISOString();
    const t: Task = {
      id: "t-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6),
      title: txt,
      category: catFilter || "OTHER",
      priority: "MEDIUM",
      assignee: assigneeFilter || "Akash",
      addedAt: stamp,
      source: "quick",
    };
    updateActiveBoard(
      (b) => ({ ...b, tasks: [t, ...b.tasks] }),
      { action: "add", label: t.title, taskId: t.id },
    );
    setQuickAdd("");
  }

  function addFullTask(t: Task) {
    updateActiveBoard(
      (b) => ({ ...b, tasks: [t, ...b.tasks] }),
      { action: "add", label: t.title, taskId: t.id },
    );
    setAddOpen(false);
  }

  // ── filters applied to open tasks ──
  const filteredOpen = useMemo(() => {
    const q = search.trim().toLowerCase();
    return openTasks.filter((t) => {
      if (catFilter && t.category !== catFilter) return false;
      if (assigneeFilter && (t.assignee || "Akash") !== assigneeFilter) return false;
      if (smartFilter && !matchesSmart(t, smartFilter)) return false;
      if (q) {
        const hay = (t.title + " " + (t.description || "") + " " + t.category).toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [openTasks, catFilter, assigneeFilter, smartFilter, search]);

  // Per-smart-filter counts for sidebar badges (uses unfiltered openTasks so
  // counts always show total available items, not items remaining inside the
  // current cat/assignee selection).
  const smartCounts = useMemo(() => {
    const out: Record<string, number> = { overdue: 0, today: 0, nodue: 0, unassigned: 0, recent: 0 };
    for (const t of openTasks) {
      if (matchesSmart(t, "overdue"))    out.overdue++;
      if (matchesSmart(t, "today"))      out.today++;
      if (matchesSmart(t, "nodue"))      out.nodue++;
      if (matchesSmart(t, "unassigned")) out.unassigned++;
      if (matchesSmart(t, "recent"))     out.recent++;
    }
    return out;
  }, [openTasks]);

  // ── stats (always whole board, ignore filters so the hero is stable) ──
  const stats = useMemo(() => {
    const weekOutIso = isoDate(new Date(Date.now() + 7 * 86400000));
    const overdue = openTasks.filter(isOverdue);
    const today = openTasks.filter(isToday);
    const week = openTasks.filter((t) => !isOverdue(t) && !isToday(t) && t.dueDate && t.dueDate <= weekOutIso);
    const doneRecent = allTasks.filter((t) => t.done && t.updatedAt && Date.parse(t.updatedAt) > Date.now() - 7 * 86400000);
    return {
      overdue: { n: overdue.length, mins: sumMins(overdue) },
      today:   { n: today.length,   mins: sumMins(today) },
      week:    { n: week.length,    mins: sumMins(week) },
      open:    { n: openTasks.length, mins: sumMins(openTasks) },
      doneRecent: { n: doneRecent.length, mins: sumMins(doneRecent) },
    };
  }, [allTasks, openTasks]);

  // ── sidebar counts ──
  const categoryCounts = useMemo(() => {
    const m: Record<string, number> = {};
    openTasks.forEach((t) => { m[t.category] = (m[t.category] || 0) + 1; });
    return m;
  }, [openTasks]);
  const assigneeCounts = useMemo(() => {
    const m: Record<string, number> = {};
    openTasks.forEach((t) => { const a = t.assignee || "Akash"; m[a] = (m[a] || 0) + 1; });
    return m;
  }, [openTasks]);
  const priorityCounts = useMemo(() => {
    const m: Record<Priority, number> = { HIGH: 0, MEDIUM: 0, "THIS WEEK": 0, ONGOING: 0, DONE: 0 };
    openTasks.forEach((t) => { m[t.priority] = (m[t.priority] || 0) + 1; });
    m.DONE = allTasks.filter((t) => t.done).length;
    return m;
  }, [openTasks, allTasks]);

  // ── view-specific derived data ──
  // Today: hot seat (overdue + today) + queue (everything else, grouped by priority)
  const hotSeat = useMemo(() => [
    ...filteredOpen.filter(isOverdue).sort((a, b) => (a.dueDate || "").localeCompare(b.dueDate || "")),
    ...filteredOpen.filter(isToday),
  ], [filteredOpen]);
  const restOpen = useMemo(() => filteredOpen.filter((t) => !isOverdue(t) && !isToday(t)), [filteredOpen]);

  // Today view always groups by priority (the "hot seat then queue" layout
  // assumes priority). Other views honor the user's GroupBy selector.
  const queueGroups = useMemo(() => {
    if (view === "today") return groupTasks(restOpen, "priority");
    return groupTasks(filteredOpen, groupBy);
  }, [view, restOpen, filteredOpen, groupBy]);

  // Schedule: overdue bucket + 14 day sections + no-date bucket
  const schedule = useMemo(() => {
    const days: { iso: string; date: Date; tasks: Task[]; mins: number }[] = [];
    const start = startOfDay(new Date());
    for (let i = 0; i < 14; i++) {
      const d = new Date(start); d.setDate(d.getDate() + i);
      const iso = isoDate(d);
      const dayTasks = filteredOpen.filter((t) => t.dueDate === iso)
        .sort((a, b) => PRIORITY_ORDER.indexOf(a.priority) - PRIORITY_ORDER.indexOf(b.priority));
      days.push({ iso, date: d, tasks: dayTasks, mins: sumMins(dayTasks) });
    }
    const overdueTasks = filteredOpen.filter(isOverdue).sort((a, b) => (a.dueDate || "").localeCompare(b.dueDate || ""));
    const noDateTasks = filteredOpen.filter((t) => !t.dueDate)
      .sort((a, b) => PRIORITY_ORDER.indexOf(a.priority) - PRIORITY_ORDER.indexOf(b.priority));
    const laterTasks = filteredOpen.filter((t) => {
      if (!t.dueDate || isOverdue(t)) return false;
      const cutoffIso = isoDate(new Date(Date.now() + 14 * 86400000));
      return t.dueDate >= cutoffIso;
    }).sort((a, b) => (a.dueDate || "").localeCompare(b.dueDate || ""));
    return { overdueTasks, days, noDateTasks, laterTasks };
  }, [filteredOpen]);

  // Done: recently completed (last 30d), newest first
  const doneTasks = useMemo(() => {
    const cutoff = Date.now() - 30 * 86400000;
    return allTasks.filter((t) => t.done && t.updatedAt && Date.parse(t.updatedAt) > cutoff)
      .sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
  }, [allTasks]);

  const totalQueue = useMemo(() => ({ n: filteredOpen.length, mins: sumMins(filteredOpen) }), [filteredOpen]);

  const filtersActive = !!(catFilter || assigneeFilter || smartFilter || search.trim());
  function clearAllFilters() { setCatFilter(null); setAssigneeFilter(null); setSmartFilter(null); setSearch(""); }

  // Compose a default name from the active state if the user just hits
  // Enter at the prompt — "Today · Akash" reads better than "Saved view 1".
  function defaultViewName(): string {
    const parts: string[] = [];
    parts.push(viewLabel(view));
    if (catFilter) parts.push(catFilter.split(" ")[0]);
    if (assigneeFilter) parts.push(assigneeFilter);
    if (search.trim()) parts.push(`"${search.trim().slice(0, 14)}"`);
    return parts.join(" · ");
  }
  async function saveCurrentView() {
    const name = await promptDialog({
      title: "Save this view",
      body: "Name a one-click chip that restores the current tab, filters, and grouping.",
      placeholder: "e.g. Today · Akash",
      initial: defaultViewName(),
      cta: "Save view",
    });
    if (!name || !name.trim()) return;
    setSavedViews((cur) => [
      ...cur,
      {
        id: "v-" + Date.now() + "-" + Math.random().toString(36).slice(2, 5),
        name: name.trim(),
        view, catFilter, assigneeFilter, search, groupBy,
      },
    ]);
  }
  function applySavedView(v: SavedView) {
    setView(v.view);
    setCatFilter(v.catFilter);
    setAssigneeFilter(v.assigneeFilter);
    setSearch(v.search);
    setGroupBy(v.groupBy);
  }
  async function deleteSavedView(id: string) {
    const target = savedViews.find((v) => v.id === id);
    const ok = await confirmDialog({
      title: "Delete saved view?",
      body: target ? `"${target.name}" — you can recreate it later from the same filters.` : "",
      cta: "Delete",
      variant: "danger",
    });
    if (ok) setSavedViews((cur) => cur.filter((v) => v.id !== id));
  }

  if (loading) {
    return (
      <div style={{ padding: 60, display: "flex", justifyContent: "center", alignItems: "center", color: D.txm, fontFamily: ft }}>
        <div style={{ width: 28, height: 28, border: "2px solid " + D.border, borderTopColor: D.amber, borderRadius: 999, animation: "spin 0.9s linear infinite" }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <DragCtx.Provider value={dragCtxValue}>
    <div style={{
      padding: narrow ? "14px 12px 80px" : (isStandalone ? "26px 36px 80px" : "20px 26px 60px"),
      fontFamily: ft, color: D.tx,
      maxWidth: isStandalone ? 1820 : 1500,
      margin: "0 auto", position: "relative",
    }}>
      <style>{`
        @keyframes tbRowIn { from { opacity: 0; transform: translateY(-2px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes tbPulseRed { 0%,100% { opacity: 1; } 50% { opacity: 0.55; } }
        @keyframes tbShimmer { 0% { background-position: 0% 50%; } 100% { background-position: 200% 50%; } }
        @keyframes tbDockPulse { 0%,100% { box-shadow: 0 0 0 0 rgba(247,176,65,0.45); } 50% { box-shadow: 0 0 0 8px rgba(247,176,65,0); } }
        @media (max-width: 860px) {
          .tbq-row { grid-template-columns: 18px 1fr auto auto !important; gap: 8px !important; padding: 10px 12px !important; }
          .tbq-row .tbq-cat,
          .tbq-row .tbq-time,
          .tbq-row .tbq-sub,
          .tbq-row .tbq-pri { display: none !important; }
          .tbq-row .tbq-avatar { display: inline-flex !important; }
          .tbv-tabs { -webkit-overflow-scrolling: touch; scrollbar-width: none; }
          .tbv-tabs::-webkit-scrollbar { display: none; }
        }
      `}</style>
      {/* AMBIENT BACKDROP — soft amber + violet glows behind everything */}
      <div aria-hidden="true" style={{
        position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0,
        background: "radial-gradient(700px 400px at 90% 0%, rgba(247,176,65,0.06), transparent 60%), radial-gradient(560px 400px at 0% 100%, rgba(144,92,203,0.05), transparent 60%)",
      }} />
      {/* HEADER HERO */}
      <div style={{
        position: "relative", padding: narrow ? "18px 16px 16px" : "26px 32px 22px", marginBottom: 18,
        background: "linear-gradient(135deg, " + D.card + " 0%, " + D.surface + " 100%)",
        border: "1px solid " + D.border, borderRadius: 18, overflow: "hidden",
      }}>
        <div style={{
          position: "absolute", inset: 0, pointerEvents: "none",
          background: "radial-gradient(500px 280px at 90% -10%, rgba(247,176,65,0.12), transparent 60%), radial-gradient(380px 240px at -5% 110%, rgba(144,92,203,0.10), transparent 60%)",
        }} />
        <div style={{ position: "relative", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 24, flexWrap: "wrap", marginBottom: 18 }}>
          <div>
            <div style={{
              fontFamily: mn, fontSize: 10.5, letterSpacing: 1.5, fontWeight: 700, textTransform: "uppercase", marginBottom: 6,
              background: "linear-gradient(90deg, " + D.amber + ", " + D.cyan + ", " + D.amber + ")",
              backgroundSize: "200% 100%",
              WebkitBackgroundClip: "text", backgroundClip: "text",
              color: "transparent",
              animation: "tbShimmer 14s linear infinite",
            }}>
              {isStandalone ? "Studio · " : ""}{new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
            </div>
            <h1 style={{ fontFamily: gf, fontSize: narrow ? 22 : 28, fontWeight: 900, letterSpacing: -0.8, margin: 0, marginBottom: 6, lineHeight: 1.15 }}>{greeting("Akash")}</h1>
            <div style={{ fontSize: 13, color: D.txm }}>
              {stats.overdue.n + stats.today.n === 0
                ? "Nothing due today. Queue is yours to shape."
                : `${stats.overdue.n + stats.today.n} thing${stats.overdue.n + stats.today.n === 1 ? "" : "s"} on the hot seat — ~${fmtMins(stats.overdue.mins + stats.today.mins)} of work.`}
              {stats.overdue.n > 0 && <span style={{ color: D.coral }}> {stats.overdue.n} already late.</span>}
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            {narrow && (
              <button
                onClick={() => setSidebarOpen(true)}
                aria-label="Open navigation"
                style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  padding: "9px 12px", background: D.surface, border: "1px solid " + D.border,
                  color: D.tx, borderRadius: 10, fontFamily: mn, fontSize: 14, fontWeight: 700,
                  cursor: "pointer",
                }}
              >☰</button>
            )}
            <button
              onClick={() => setPaletteOpen(true)}
              title="Command palette (⌘K)"
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "9px 12px", background: D.surface, border: "1px solid " + D.border,
                color: D.txm, borderRadius: 10, fontFamily: mn, fontSize: 11, fontWeight: 600,
                cursor: "pointer", letterSpacing: 0.4,
              }}
            >⌘K</button>
            {!narrow && (
              <button
                onClick={() => setShortcutsOpen(true)}
                title="Keyboard shortcuts (?)"
                style={{
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  width: 32, height: 32,
                  background: D.surface, border: "1px solid " + D.border,
                  color: D.txm, borderRadius: 10, fontFamily: mn, fontSize: 13, fontWeight: 700,
                  cursor: "pointer",
                }}
              >?</button>
            )}
            <button
              onClick={() => setPlannerOpen((o) => !o)}
              title="Daily planner"
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "9px 12px",
                background: plannerOpen ? D.amber + "22" : D.surface,
                border: "1px solid " + (plannerOpen ? D.amber + "66" : D.border),
                color: plannerOpen ? D.amber : D.txm,
                borderRadius: 10, fontFamily: mn, fontSize: 11, fontWeight: 700,
                cursor: "pointer", letterSpacing: 0.4,
              }}
            >▦ planner</button>
            <button
              onClick={() => setActivityOpen(true)}
              title="Activity log"
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "9px 12px", background: D.surface, border: "1px solid " + D.border,
                color: D.txm, borderRadius: 10, fontFamily: mn, fontSize: 11, fontWeight: 700,
                cursor: "pointer", letterSpacing: 0.4,
              }}
            >⟲ activity</button>
            <button
              onClick={() => setAddOpen(true)}
              style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                padding: "10px 16px", background: D.surface, border: "1px solid " + D.border,
                color: D.tx, borderRadius: 10, fontFamily: ft, fontSize: 13, fontWeight: 600,
                cursor: "pointer",
              }}
            >＋ New task</button>
            {!narrow && (isStandalone ? (
              <a
                href="/"
                style={{
                  display: "inline-flex", alignItems: "center", gap: 9,
                  padding: "11px 18px",
                  background: D.surface, border: "1px solid " + D.border,
                  color: D.tx, borderRadius: 12,
                  fontSize: 13, fontWeight: 600, textDecoration: "none",
                  whiteSpace: "nowrap",
                }}
              >
                <span style={{ fontSize: 13 }}>←</span> POAST hub
              </a>
            ) : (
              <a
                href="/board"
                target="_blank"
                rel="noopener"
                style={{
                  display: "inline-flex", alignItems: "center", gap: 9,
                  padding: "11px 18px",
                  background: "linear-gradient(135deg, " + D.amber + ", " + D.coral + ")",
                  color: "#0A0A0F", borderRadius: 12,
                  fontSize: 13, fontWeight: 700, textDecoration: "none",
                  boxShadow: "0 6px 20px rgba(247,176,65,0.25)",
                  whiteSpace: "nowrap",
                }}
              >
                <span style={{ fontSize: 16 }}>✦</span> Open Studio <span style={{ fontSize: 11 }}>↗</span>
              </a>
            ))}
          </div>
        </div>

        {/* priority counters */}
        <div style={{ position: "relative", display: "grid", gridTemplateColumns: narrow ? "repeat(2, 1fr)" : "repeat(5, 1fr)", gap: 10 }}>
          <PriorityCounter label="High"      count={priorityCounts.HIGH}        color={PRI_COLOR.HIGH} />
          <PriorityCounter label="Medium"    count={priorityCounts.MEDIUM}      color={PRI_COLOR.MEDIUM} />
          <PriorityCounter label="This Week" count={priorityCounts["THIS WEEK"]} color={PRI_COLOR["THIS WEEK"]} />
          <PriorityCounter label="Ongoing"   count={priorityCounts.ONGOING}     color={PRI_COLOR.ONGOING} />
          <PriorityCounter label="Done"      count={priorityCounts.DONE}        color={PRI_COLOR.DONE} />
        </div>
      </div>

      {/* VIEW TABS — primary "shape of view" nav (Plane-style) */}
      <ViewTabs
        view={view}
        setView={setView}
        groupBy={groupBy}
        setGroupBy={setGroupBy}
        counts={{
          today: hotSeat.length + restOpen.length,
          schedule: filteredOpen.length,
          week: filteredOpen.length,
          calendar: filteredOpen.length,
          board: filteredOpen.length,
          category: filteredOpen.length,
          all: filteredOpen.length,
          focus: filteredOpen.length,
          done: doneTasks.length,
        }}
        narrow={narrow}
      />

      {/* SUITE — sidebar + content */}
      <div style={{ display: "grid", gridTemplateColumns: narrow ? "1fr" : "210px 1fr", gap: 18, alignItems: "flex-start" }}>
        {/* SIDEBAR */}
        {narrow && sidebarOpen && (
          <div
            onClick={() => setSidebarOpen(false)}
            style={{
              position: "fixed", inset: 0, zIndex: 11400,
              background: "rgba(6,6,12,0.55)", backdropFilter: "blur(3px)", WebkitBackdropFilter: "blur(3px)",
            }}
          />
        )}
        <aside style={narrow ? {
          display: sidebarOpen ? "block" : "none",
          position: "fixed", top: 0, left: 0, bottom: 0, zIndex: 11450,
          width: "min(280px, 86vw)",
          background: "#0A0A14", borderRight: "1px solid " + D.border,
          padding: 16, overflowY: "auto",
          boxShadow: "10px 0 32px rgba(0,0,0,0.5)",
        } : {
          position: "sticky", top: 18,
          background: D.card, border: "1px solid " + D.border, borderRadius: 14,
          padding: 14,
          maxHeight: "calc(100vh - 60px)", overflowY: "auto",
        }}>
          {narrow && (
            <div style={{ display: "flex", alignItems: "center", marginBottom: 10 }}>
              <span style={{ fontFamily: mn, fontSize: 10, color: D.amber, letterSpacing: 1.4, textTransform: "uppercase", fontWeight: 800 }}>menu</span>
              <button onClick={() => setSidebarOpen(false)} style={{
                marginLeft: "auto", background: "transparent", border: "1px solid " + D.border,
                color: D.txm, padding: "3px 8px", borderRadius: 5,
                fontFamily: mn, fontSize: 10, cursor: "pointer", letterSpacing: 0.4,
              }}>close</button>
            </div>
          )}
          <SidebarSection label="Workspace">
            <button
              onClick={() => setAddOpen(true)}
              style={{
                width: "100%", display: "flex", alignItems: "center", gap: 9,
                padding: "9px 12px",
                background: "linear-gradient(135deg, " + D.amber + ", " + D.coral + ")",
                color: "#0A0A0F", border: "none", borderRadius: 9,
                fontFamily: ft, fontSize: 12.5, fontWeight: 700,
                cursor: "pointer", marginBottom: 6,
              }}
            >＋ New task</button>
            <SidebarInput value={search} setValue={setSearch} placeholder="Search…" />
          </SidebarSection>

          <SidebarSection label="Smart filters">
            {SMART_FILTERS.map((sf) => {
              const accent = D[sf.accentKey];
              const count = smartCounts[sf.id];
              const active = smartFilter === sf.id;
              return (
                <SidebarRow
                  key={sf.id}
                  active={active}
                  onClick={() => setSmartFilter(active ? null : sf.id)}
                  accent={accent}
                  left={<span style={{ fontFamily: mn, fontSize: 12, color: active ? accent : count > 0 ? accent : D.txd, width: 14, textAlign: "center", flexShrink: 0 }}>{sf.icon}</span>}
                  label={sf.label}
                  count={count}
                />
              );
            })}
          </SidebarSection>

          <SidebarSection
            label="Saved views"
            right={
              <button
                type="button"
                onClick={saveCurrentView}
                title="Save current tab + filters as a one-click chip"
                style={{
                  background: "transparent", border: "1px solid " + D.border,
                  color: D.txm, padding: "2px 6px", borderRadius: 4,
                  fontFamily: mn, fontSize: 9.5, fontWeight: 700, letterSpacing: 0.5,
                  cursor: "pointer",
                }}
              >+ save</button>
            }
          >
            {savedViews.length === 0 && (
              <div style={{ fontSize: 11, color: D.txd, padding: "2px 8px 4px", letterSpacing: 0.2 }}>
                Snapshot a tab + filters with{" "}
                <span style={{ fontFamily: mn, color: D.txm }}>+ save</span>.
              </div>
            )}
            {savedViews.map((v) => {
              const active =
                v.view === view &&
                v.catFilter === catFilter &&
                v.assigneeFilter === assigneeFilter &&
                v.search === search &&
                v.groupBy === groupBy;
              return (
                <SidebarRow
                  key={v.id}
                  active={active}
                  onClick={() => applySavedView(v)}
                  accent={D.amber}
                  left={<span style={{ fontFamily: mn, fontSize: 11, color: active ? D.amber : D.txm, width: 14, textAlign: "center", flexShrink: 0 }}>{viewIcon(v.view)}</span>}
                  label={v.name}
                  right={
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); deleteSavedView(v.id); }}
                      title="Delete saved view"
                      style={{
                        background: "transparent", border: "none",
                        color: D.txd, padding: "0 2px", cursor: "pointer",
                        fontFamily: mn, fontSize: 12, fontWeight: 700,
                      }}
                    >×</button>
                  }
                />
              );
            })}
          </SidebarSection>

          <SidebarSection label="Categories">
            {CATEGORIES.filter((c) => categoryCounts[c]).map((c) => (
              <SidebarRow
                key={c}
                active={catFilter === c}
                onClick={() => setCatFilter(catFilter === c ? null : c)}
                accent={CAT_COLOR[c] || D.txd}
                left={<span style={{ width: 8, height: 8, borderRadius: 999, background: CAT_COLOR[c] || D.txd, flexShrink: 0 }} />}
                label={c.toLowerCase().replace(/\b\w/g, (l) => l.toUpperCase()).replace("/", " / ")}
                count={categoryCounts[c]}
                onDropTask={(id) => applyPatch(id, { category: c })}
              />
            ))}
            {CATEGORIES.filter((c) => categoryCounts[c]).length === 0 && (
              <div style={{ fontSize: 11.5, color: D.txd, padding: "4px 8px" }}>No tasks yet.</div>
            )}
          </SidebarSection>

          <SidebarSection label="Team">
            {ASSIGNEES.filter((a) => assigneeCounts[a]).map((a) => (
              <SidebarRow
                key={a}
                active={assigneeFilter === a}
                onClick={() => setAssigneeFilter(assigneeFilter === a ? null : a)}
                accent={ASSIGNEE_COLOR[a] || D.txd}
                left={<Avatar name={a} size={16} />}
                label={a}
                count={assigneeCounts[a]}
                onDropTask={(id) => applyPatch(id, { assignee: a })}
              />
            ))}
          </SidebarSection>

          <div style={{
            marginTop: 12, padding: "10px 12px",
            fontSize: 10.5, color: D.txd, fontFamily: mn, letterSpacing: 0.3,
            borderTop: "1px solid " + D.border, paddingTop: 12,
          }}>
            {saveState === "saved" ? <span style={{ color: D.teal }}>✓ Synced</span>
              : saveState === "saving" ? <span style={{ color: D.amber }}>● Saving…</span>
              : saveState === "error" ? <span style={{ color: D.coral }}>● Sync failed</span>
              : <span>● Auto-saves to cloud</span>}
          </div>
        </aside>

        {/* MAIN */}
        <main>
          {/* TOOLBAR — quick add + filter chips */}
          <div style={{
            display: "flex", alignItems: "center", gap: 10,
            padding: "10px 14px", background: D.card, border: "1px solid " + D.border,
            borderRadius: 12, marginBottom: 14,
          }}>
            <span style={{ fontSize: 16, color: D.amber, fontWeight: 700 }}>+</span>
            <input
              value={quickAdd}
              onChange={(e) => setQuickAdd(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") submitQuickAdd(); }}
              placeholder="Quick add (Enter)…"
              style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: D.tx, fontFamily: ft, fontSize: 13.5 }}
            />
            {filtersActive && (
              <button
                onClick={clearAllFilters}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  padding: "5px 10px", background: "transparent", border: "1px solid " + D.border,
                  color: D.txm, fontFamily: mn, fontSize: 10.5, borderRadius: 6, cursor: "pointer",
                }}
              >clear filters ×</button>
            )}
          </div>

          {filtersActive && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
              {smartFilter && (() => {
                const sf = SMART_FILTERS.find((s) => s.id === smartFilter);
                if (!sf) return null;
                return <Chip label={sf.icon + "  " + sf.label} color={D[sf.accentKey]} onClear={() => setSmartFilter(null)} />;
              })()}
              {catFilter && <Chip label={catFilter} color={CAT_COLOR[catFilter] || D.txd} onClear={() => setCatFilter(null)} />}
              {assigneeFilter && <Chip label={assigneeFilter} color={ASSIGNEE_COLOR[assigneeFilter] || D.txd} onClear={() => setAssigneeFilter(null)} />}
              {search.trim() && <Chip label={`"${search.trim()}"`} color={D.violet} onClear={() => setSearch("")} />}
            </div>
          )}

          {/* CONTENT BY VIEW */}
          {view === "today" && plannerOpen && (
            <DailyPlanner
              tasks={allTasks}
              onToggle={toggleDone}
              onClose={() => setPlannerOpen(false)}
            />
          )}
          {view === "today" && (
            <TodayView
              allOpen={filteredOpen}
              doneRecent={stats.doneRecent.n}
              hotSeat={hotSeat}
              queueGroups={queueGroups}
              totalQueue={totalQueue}
              onToggle={toggleDone}
              onFocus={(t) => {
                const idx = [...hotSeat, ...restOpen].findIndex((x) => x.id === t.id);
                if (idx >= 0) setFocusIdx(idx);
                setView("focus");
              }}
            />
          )}

          {view === "schedule" && (
            <ScheduleView
              schedule={schedule}
              onToggle={toggleDone}
            />
          )}

          {view === "board" && (
            <BoardKanban
              groups={groupTasks(filteredOpen, groupBy)}
              groupBy={groupBy}
              onToggle={toggleDone}
            />
          )}

          {view === "all" && (
            <AllOpenView
              queueGroups={queueGroups}
              totalQueue={totalQueue}
              groupBy={groupBy}
              onToggle={toggleDone}
            />
          )}

          {view === "category" && (
            <CategoryView
              groups={groupTasks(filteredOpen, "category")}
              onToggle={toggleDone}
            />
          )}

          {view === "week" && (
            <WeekView
              filteredOpen={filteredOpen}
              onToggle={toggleDone}
            />
          )}

          {view === "calendar" && (
            <CalendarView
              filteredOpen={filteredOpen}
              onToggle={toggleDone}
            />
          )}

          {view === "focus" && (
            <FocusViewBlock
              tasks={[...hotSeat, ...restOpen]}
              index={focusIdx}
              setIndex={setFocusIdx}
              onToggle={toggleDone}
            />
          )}

          {view === "done" && (
            <DoneView tasks={doneTasks} onToggle={toggleDone} />
          )}
        </main>
      </div>

      {addOpen && (
        <AddTaskModal
          defaultCat={catFilter}
          defaultAssignee={assigneeFilter}
          onSubmit={addFullTask}
          onClose={() => setAddOpen(false)}
        />
      )}

      {/* Combine Dock — fixed right edge, auto-expands during any drag */}
      <CombineDock
        tasks={allTasks.filter((t) => combineIds.includes(t.id))}
        dragActive={draggingId !== null}
      />

      {combineModalOpen && (
        <CombineModal
          sources={allTasks.filter((t) => combineIds.includes(t.id))}
          onClose={() => setCombineModalOpen(false)}
          onCommit={commitCombine}
        />
      )}

      {paletteOpen && (
        <CommandPalette
          tasks={allTasks}
          onClose={() => setPaletteOpen(false)}
          setView={setView}
          setCatFilter={setCatFilter}
          setAssigneeFilter={setAssigneeFilter}
          clearFilters={() => { setCatFilter(null); setAssigneeFilter(null); setSearch(""); }}
          openAddTask={() => setAddOpen(true)}
          openFocus={(t) => setFocusTask(t)}
          openTask={(t) => setFocusTask(t)}
        />
      )}

      <BulkActionBar
        count={selectedIds.size}
        onAssign={(a) => bulkPatch({ assignee: a })}
        onPriority={(p) => bulkPatch({ priority: p })}
        onCategory={(c) => bulkPatch({ category: c })}
        onDone={bulkDone}
        onDelete={bulkRemove}
        onClear={clearSelection}
      />

      {focusTask && (
        <FocusMode
          task={focusTask}
          onClose={() => setFocusTask(null)}
          onComplete={() => {
            toggleDone(focusTask.id);
            const next = openTasks.find((t) => t.id !== focusTask.id) || null;
            setFocusTask(next);
          }}
          onNext={() => {
            const next = openTasks.find((t) => t.id !== focusTask.id) || null;
            setFocusTask(next);
          }}
          onPatch={(p) => applyPatch(focusTask.id, p)}
        />
      )}

      {editTaskId && (() => {
        const task = allTasks.find((t) => t.id === editTaskId);
        if (!task) return null;
        return (
          <EditDrawer
            task={task}
            onClose={() => setEditTaskId(null)}
            onPatch={(p) => applyPatch(task.id, p)}
            onDelete={() => { removeTask(task.id); setEditTaskId(null); }}
            onDuplicate={() => duplicateTask(task.id)}
            onFocus={() => { setFocusTask(task); setEditTaskId(null); }}
            onToggleDone={() => toggleDone(task.id)}
          />
        );
      })()}

      {shortcutsOpen && (
        <ShortcutsOverlay onClose={() => setShortcutsOpen(false)} />
      )}

      {activityOpen && (
        <ActivityLog
          entries={activeBoard?.activity || []}
          onClose={() => setActivityOpen(false)}
        />
      )}
    </div>
    </DragCtx.Provider>
  );
}

// Sort comparator shared by every grouping: pinned > earlier due > newer added.
function sortInGroup(a: Task, b: Task): number {
  if (!!b.pinned !== !!a.pinned) return (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0);
  const ad = a.dueDate || "9999-12-31";
  const bd = b.dueDate || "9999-12-31";
  if (ad !== bd) return ad < bd ? -1 : 1;
  return (b.addedAt || "").localeCompare(a.addedAt || "");
}

// Generalized grouper. Mode = priority | category | assignee | due.
// Returns groups in display order; empty groups skipped.
function groupTasks(tasks: Task[], mode: GroupBy): { key: string; color: string; tasks: Task[] }[] {
  if (mode === "priority") {
    return PRIORITY_ORDER
      .map((p) => ({ key: p as string, color: PRI_COLOR[p], tasks: tasks.filter((t) => t.priority === p).sort(sortInGroup) }))
      .filter((g) => g.tasks.length);
  }
  if (mode === "category") {
    return CATEGORIES
      .map((c) => ({ key: c, color: CAT_COLOR[c] || D.txd, tasks: tasks.filter((t) => t.category === c).sort(sortInGroup) }))
      .filter((g) => g.tasks.length);
  }
  if (mode === "assignee") {
    return ASSIGNEES
      .map((a) => ({ key: a, color: ASSIGNEE_COLOR[a] || D.txd, tasks: tasks.filter((t) => (t.assignee || "Akash") === a).sort(sortInGroup) }))
      .filter((g) => g.tasks.length);
  }
  // "due" — Overdue, Today, This week, Later, No date
  const t = todayIso();
  const weekIso = isoDate(new Date(Date.now() + 7 * 86400000));
  const buckets: { key: string; color: string; tasks: Task[] }[] = [
    { key: "Overdue",   color: D.coral,  tasks: tasks.filter(isOverdue).sort((a, b) => (a.dueDate || "").localeCompare(b.dueDate || "")) },
    { key: "Today",     color: D.amber,  tasks: tasks.filter((x) => x.dueDate === t).sort(sortInGroup) },
    { key: "This week", color: D.blue,   tasks: tasks.filter((x) => !!x.dueDate && x.dueDate > t && x.dueDate <= weekIso).sort((a, b) => (a.dueDate || "").localeCompare(b.dueDate || "")) },
    { key: "Later",     color: D.violet, tasks: tasks.filter((x) => !!x.dueDate && x.dueDate > weekIso).sort((a, b) => (a.dueDate || "").localeCompare(b.dueDate || "")) },
    { key: "No date",   color: D.txm,    tasks: tasks.filter((x) => !x.dueDate).sort(sortInGroup) },
  ];
  return buckets.filter((g) => g.tasks.length);
}

// ── tiny ui primitives used by the sidebar / chips ──

// Plane-style horizontal view switcher. Lives between the hero and the
// suite grid; replaces the old Views block inside the sidebar. Each tab
// = icon + label + count. Group-by selector rides on the right end and
// only shows for the views where grouping applies (all, board).
function ViewTabs({
  view, setView, groupBy, setGroupBy, counts, narrow,
}: {
  view: ViewKey;
  setView: (v: ViewKey) => void;
  groupBy: GroupBy;
  setGroupBy: (g: GroupBy) => void;
  counts: Record<ViewKey, number>;
  narrow: boolean;
}) {
  const tabs: { k: ViewKey; l: string; icon: string }[] = (
    ["today", "schedule", "week", "calendar", "board", "category", "all", "focus", "done"] as ViewKey[]
  ).map((k) => ({ k, l: VIEW_META[k].label, icon: VIEW_META[k].icon }));
  const showGroupBy = view === "all" || view === "board";
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10,
      marginBottom: 14,
      flexWrap: narrow ? "nowrap" : "wrap",
    }}>
      <div
        className="tbv-tabs"
        style={{
          display: "flex", alignItems: "center", gap: 4,
          padding: 4,
          background: D.card, border: "1px solid " + D.border, borderRadius: 12,
          flex: 1, minWidth: 0,
          overflowX: narrow ? "auto" : "visible",
        }}
      >
        {tabs.map((t) => {
          const active = view === t.k;
          const n = counts[t.k];
          return (
            <button
              key={t.k}
              onClick={() => setView(t.k)}
              title={t.l}
              style={{
                display: "inline-flex", alignItems: "center", gap: 7,
                padding: "7px 12px",
                background: active ? D.amber + "1F" : "transparent",
                border: "1px solid " + (active ? D.amber + "55" : "transparent"),
                color: active ? D.tx : D.txm,
                borderRadius: 8,
                fontFamily: ft, fontSize: 12.5, fontWeight: active ? 700 : 500,
                cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0,
                transition: "background 0.12s, color 0.12s, border-color 0.12s",
              }}
            >
              <span style={{ fontFamily: mn, fontSize: 11, color: active ? D.amber : D.txd, lineHeight: 1 }}>{t.icon}</span>
              <span>{t.l}</span>
              {n > 0 && (
                <span style={{
                  fontFamily: mn, fontSize: 10, fontWeight: 700,
                  color: active ? D.amber : D.txd,
                  padding: "1px 6px", borderRadius: 999,
                  background: active ? D.amber + "22" : D.surface,
                }}>{n}</span>
              )}
            </button>
          );
        })}
      </div>
      {showGroupBy && (
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 4,
          padding: "4px 5px", background: D.card, border: "1px solid " + D.border, borderRadius: 10,
          flexShrink: 0,
        }}>
          <span style={{ fontFamily: mn, fontSize: 9.5, color: D.txd, padding: "0 6px", letterSpacing: 0.6, textTransform: "uppercase" }}>group</span>
          {(["priority", "category", "assignee", "due"] as GroupBy[]).map((g) => (
            <button
              key={g}
              onClick={() => setGroupBy(g)}
              style={{
                padding: "5px 10px",
                background: groupBy === g ? D.amber : "transparent",
                color: groupBy === g ? "#0A0A0F" : D.txm,
                border: "none", borderRadius: 6,
                fontFamily: ft, fontSize: 11, fontWeight: groupBy === g ? 700 : 500,
                cursor: "pointer",
              }}
            >{GROUP_LABELS[g]}</button>
          ))}
        </div>
      )}
    </div>
  );
}

function SidebarSection({ label, children, right }: { label: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 6,
        padding: "4px 8px", marginBottom: 4,
      }}>
        <span style={{
          fontSize: 9.5, color: D.txd, letterSpacing: 1.2, fontWeight: 700,
          textTransform: "uppercase",
        }}>{label}</span>
        {right && <span style={{ marginLeft: "auto" }}>{right}</span>}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>{children}</div>
    </div>
  );
}

function SidebarRow({
  active, onClick, left, label, count, accent, onDropTask, right,
}: {
  active: boolean;
  onClick: () => void;
  left: React.ReactNode;
  label: string;
  count?: number;
  accent: string;
  onDropTask?: (taskId: string) => void;
  right?: React.ReactNode;
}) {
  const drag = useDrag();
  const [over, setOver] = useState(false);
  const isDropTarget = !!onDropTask && drag.draggingId !== null;
  return (
    <button
      onClick={onClick}
      onDragOver={onDropTask ? (e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setOver(true); } : undefined}
      onDragLeave={onDropTask ? () => setOver(false) : undefined}
      onDrop={onDropTask ? (e) => {
        e.preventDefault();
        const id = e.dataTransfer.getData("text/plain");
        if (id) onDropTask(id);
        setOver(false);
        drag.endDrag();
      } : undefined}
      style={{
        display: "flex", alignItems: "center", gap: 9,
        padding: "7px 10px",
        background: over
          ? accent + "33"
          : isDropTarget
          ? accent + "0F"
          : active ? accent + "1A" : "transparent",
        border: "none",
        borderLeft: "2px solid " + (over ? accent : active ? accent : "transparent"),
        outline: over ? "1px dashed " + accent : "none",
        outlineOffset: -2,
        color: active ? D.tx : D.txm,
        fontFamily: ft, fontSize: 12.5, fontWeight: active ? 600 : 500,
        textAlign: "left", cursor: "pointer", borderRadius: "0 7px 7px 0",
        width: "100%",
        transition: "background 0.12s, outline-color 0.12s",
      }}
    >
      {left}
      <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
      {typeof count === "number" && count > 0 && (
        <span style={{ fontFamily: mn, fontSize: 10, color: active ? accent : D.txd }}>{count}</span>
      )}
      {right}
    </button>
  );
}

function SidebarInput({ value, setValue, placeholder }: { value: string; setValue: (v: string) => void; placeholder: string }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 6,
      padding: "6px 10px", background: D.surface, border: "1px solid " + D.border, borderRadius: 8,
    }}>
      <span style={{ color: D.txd, fontSize: 11 }}>⌕</span>
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: D.tx, fontFamily: ft, fontSize: 12 }}
      />
    </div>
  );
}

function Chip({ label, color, onClear }: { label: string; color: string; onClear: () => void }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      padding: "4px 9px", borderRadius: 999,
      background: color + "1A", border: "1px solid " + color + "55",
      color, fontSize: 11, fontWeight: 600, fontFamily: ft,
    }}>
      {label}
      <button onClick={onClear} style={{ background: "transparent", border: "none", color, cursor: "pointer", padding: 0, fontSize: 13, lineHeight: 1 }}>×</button>
    </span>
  );
}

// ═══════════════════════════════════════════════════════════════════
// VIEWS
// ═══════════════════════════════════════════════════════════════════

function TodayView({ allOpen, doneRecent, hotSeat, queueGroups, totalQueue, onToggle, onFocus }: {
  allOpen: Task[];
  doneRecent: number;
  hotSeat: Task[];
  queueGroups: TaskGroup[];
  totalQueue: { n: number; mins: number };
  onToggle: (id: string) => void;
  onFocus: (t: Task) => void;
}) {
  return (
    <div>
      <TodayHero tasks={allOpen} doneRecent={doneRecent} onFocus={onFocus} />

      <SectionHeader label="Hot seat" count={hotSeat.length} mins={sumMins(hotSeat)} tone="warm" />
      {hotSeat.length === 0 ? (
        <EmptyState title="Nothing on fire" subtitle="Today is clear. Plan ahead in Schedule view." />
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 10, marginBottom: 28 }}>
          {hotSeat.map((t) => <HotSeatCard key={t.id} task={t} onToggle={() => onToggle(t.id)} />)}
        </div>
      )}

      <SectionHeader
        label="Queue"
        count={totalQueue.n - hotSeat.length}
        mins={Math.max(0, totalQueue.mins - sumMins(hotSeat))}
        right="grouped by priority"
      />
      <QueueGrouped groups={queueGroups} onToggle={onToggle} />
    </div>
  );
}

function ScheduleView({ schedule, onToggle }: {
  schedule: { overdueTasks: Task[]; days: { iso: string; date: Date; tasks: Task[]; mins: number }[]; noDateTasks: Task[]; laterTasks: Task[] };
  onToggle: (id: string) => void;
}) {
  const { overdueTasks, days, noDateTasks, laterTasks } = schedule;
  const todayStr = todayIso();
  return (
    <div>
      <SectionHeader label="Schedule" count={overdueTasks.length + days.reduce((s, d) => s + d.tasks.length, 0)} mins={sumMins(overdueTasks) + days.reduce((s, d) => s + d.mins, 0)} right="next 14 days" />

      {overdueTasks.length > 0 && (
        <DaySection
          title="Overdue"
          subtitle={`${overdueTasks.length} late`}
          accent={D.coral}
          tasks={overdueTasks}
          onToggle={onToggle}
        />
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {days.map((d) => {
          const isThisDay = d.iso === todayStr;
          const dow = d.date.toLocaleDateString("en-US", { weekday: "short" });
          const md = d.date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
          const title = isThisDay ? "Today · " + md : d.iso === isoDate(new Date(Date.now() + 86400000)) ? "Tomorrow · " + md : dow + " · " + md;
          return (
            <DaySection
              key={d.iso}
              title={title}
              subtitle={d.tasks.length === 0 ? "No tasks" : `${d.tasks.length} · ~${fmtMins(d.mins)}`}
              accent={isThisDay ? D.amber : d.tasks.length === 0 ? D.txd : D.blue}
              tasks={d.tasks}
              onToggle={onToggle}
              dim={d.tasks.length === 0}
            />
          );
        })}
      </div>

      {laterTasks.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <DaySection
            title="Later"
            subtitle={`${laterTasks.length} · ~${fmtMins(sumMins(laterTasks))}`}
            accent={D.violet}
            tasks={laterTasks}
            onToggle={onToggle}
          />
        </div>
      )}

      {noDateTasks.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <DaySection
            title="No due date"
            subtitle={`${noDateTasks.length} · ~${fmtMins(sumMins(noDateTasks))}`}
            accent={D.txm}
            tasks={noDateTasks}
            onToggle={onToggle}
          />
        </div>
      )}
    </div>
  );
}

function DaySection({ title, subtitle, accent, tasks, onToggle, dim }: {
  title: string; subtitle: string; accent: string; tasks: Task[]; onToggle: (id: string) => void; dim?: boolean;
}) {
  return (
    <div style={{ opacity: dim ? 0.55 : 1 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 6 }}>
        <span style={{ width: 6, height: 6, borderRadius: 999, background: accent }} />
        <h3 style={{ fontSize: 13, fontWeight: 700, margin: 0, color: D.tx }}>{title}</h3>
        <span style={{ fontFamily: mn, fontSize: 10.5, color: D.txd }}>{subtitle}</span>
      </div>
      {tasks.length === 0 ? (
        <div style={{ padding: "10px 14px", background: D.card, border: "1px dashed " + D.border, borderRadius: 10, color: D.txd, fontSize: 12, fontStyle: "italic" }}>
          — open
        </div>
      ) : (
        <div style={{ background: D.card, border: "1px solid " + D.border, borderRadius: 12, overflow: "hidden" }}>
          {tasks.map((t, i) => (
            <QueueRow key={t.id} task={t} last={i === tasks.length - 1} onToggle={() => onToggle(t.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

function BoardKanban({ groups, groupBy, onToggle }: {
  groups: TaskGroup[];
  groupBy: GroupBy;
  onToggle: (id: string) => void;
}) {
  if (groups.length === 0) {
    return <EmptyState title="No tasks" subtitle={"Nothing to show on the " + GROUP_LABELS[groupBy].toLowerCase() + " board."} />;
  }
  return (
    <div style={{
      display: "grid",
      gridAutoFlow: "column",
      gridAutoColumns: "minmax(240px, 1fr)",
      gap: 12,
      overflowX: "auto", paddingBottom: 8,
    }}>
      {groups.map((col) => (
        <BoardColumn key={col.key} col={col} groupBy={groupBy} onToggle={onToggle} />
      ))}
    </div>
  );
}

function BoardColumn({ col, groupBy, onToggle }: {
  col: TaskGroup;
  groupBy: GroupBy;
  onToggle: (id: string) => void;
}) {
  const drag = useDrag();
  const [over, setOver] = useState(false);
  const isTarget = drag.draggingId !== null && groupBy !== "due";
  const onDropHere = (e: React.DragEvent) => {
    e.preventDefault();
    setOver(false);
    const id = e.dataTransfer.getData("text/plain");
    if (!id) { drag.endDrag(); return; }
    if (groupBy === "priority") drag.applyPatch(id, { priority: col.key as Priority });
    else if (groupBy === "category") drag.applyPatch(id, { category: col.key });
    else if (groupBy === "assignee") drag.applyPatch(id, { assignee: col.key });
    drag.endDrag();
  };
  return (
    <div
      onDragOver={isTarget ? (e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setOver(true); } : undefined}
      onDragLeave={isTarget ? () => setOver(false) : undefined}
      onDrop={isTarget ? onDropHere : undefined}
      style={{
        background: over ? col.color + "14" : D.card,
        border: "1px solid " + (over ? col.color : isTarget ? col.color + "55" : D.border),
        borderRadius: 12,
        padding: 12, display: "flex", flexDirection: "column", gap: 8,
        minHeight: 240,
        transition: "background 0.12s, border-color 0.12s",
        outline: over ? "2px dashed " + col.color : "none",
        outlineOffset: -4,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, paddingBottom: 8, borderBottom: "1px solid " + D.border }}>
        <span style={{ width: 8, height: 8, borderRadius: 999, background: col.color }} />
        <span style={{ fontFamily: mn, fontSize: 10.5, color: col.color, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{col.key}</span>
        <span style={{ marginLeft: "auto", fontFamily: mn, fontSize: 10, color: D.txd }}>{col.tasks.length}</span>
        <TimePill mins={sumMins(col.tasks)} />
      </div>
      {col.tasks.map((t) => <BoardCard key={t.id} task={t} onToggle={() => onToggle(t.id)} />)}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// CATEGORY VIEW — rich category sections with mini stats
// ═══════════════════════════════════════════════════════════════════

function CategoryView({ groups, onToggle }: { groups: TaskGroup[]; onToggle: (id: string) => void }) {
  if (groups.length === 0) {
    return <EmptyState title="No categories in play" subtitle="Capture a task to start filling categories." />;
  }
  const total = groups.reduce((s, g) => s + g.tasks.length, 0);
  const totalMins = groups.reduce((s, g) => s + sumMins(g.tasks), 0);
  return (
    <div>
      <SectionHeader label="By category" count={total} mins={totalMins} right={`${groups.length} active`} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))", gap: 14 }}>
        {groups.map((g) => {
          const overdue = g.tasks.filter(isOverdue).length;
          const todayCt = g.tasks.filter(isToday).length;
          return (
            <div key={g.key} style={{
              background: D.card, border: "1px solid " + D.border, borderRadius: 14,
              overflow: "hidden", display: "flex", flexDirection: "column",
            }}>
              <div style={{
                padding: "14px 16px 12px",
                borderBottom: "1px solid " + D.border,
                background: "linear-gradient(180deg, " + g.color + "10, transparent)",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 999, background: g.color }} />
                  <span style={{ fontFamily: mn, fontSize: 11, letterSpacing: 1.2, textTransform: "uppercase", color: g.color, fontWeight: 800 }}>{g.key}</span>
                  <span style={{ marginLeft: "auto", fontFamily: mn, fontSize: 10.5, color: D.txd }}>{g.tasks.length} open</span>
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <TimePill mins={sumMins(g.tasks)} />
                  {overdue > 0 && (
                    <span style={{ fontSize: 10, color: D.coral, fontFamily: mn, fontWeight: 700, padding: "2px 7px", border: "1px solid " + D.coral + "55", borderRadius: 5 }}>● {overdue} overdue</span>
                  )}
                  {todayCt > 0 && (
                    <span style={{ fontSize: 10, color: D.amber, fontFamily: mn, fontWeight: 700, padding: "2px 7px", border: "1px solid " + D.amber + "55", borderRadius: 5 }}>● {todayCt} today</span>
                  )}
                </div>
              </div>
              <div style={{ maxHeight: 380, overflowY: "auto" }}>
                {g.tasks.map((t, i) => (
                  <QueueRow key={t.id} task={t} last={i === g.tasks.length - 1} onToggle={() => onToggle(t.id)} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// WEEK VIEW — 7-day columns starting today, tasks stacked per column
// ═══════════════════════════════════════════════════════════════════

function WeekView({ filteredOpen, onToggle }: { filteredOpen: Task[]; onToggle: (id: string) => void }) {
  const start = startOfDay(new Date());
  const days = useMemo(() => {
    const arr: { date: Date; iso: string; tasks: Task[] }[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(start); d.setDate(d.getDate() + i);
      const iso = isoDate(d);
      const tasks = filteredOpen.filter((t) => t.dueDate === iso)
        .sort((a, b) => PRIORITY_ORDER.indexOf(a.priority) - PRIORITY_ORDER.indexOf(b.priority));
      arr.push({ date: d, iso, tasks });
    }
    return arr;
  }, [filteredOpen, start]);
  const overdue = filteredOpen.filter(isOverdue);
  const todayStr = todayIso();

  return (
    <div>
      <SectionHeader label="This week" count={days.reduce((s, d) => s + d.tasks.length, 0)} mins={days.reduce((s, d) => s + sumMins(d.tasks), 0)} right="next 7 days" />

      {overdue.length > 0 && (
        <div style={{
          marginBottom: 14, padding: "12px 14px",
          background: "rgba(224,99,71,0.06)", border: "1px solid rgba(224,99,71,0.30)", borderRadius: 12,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <span style={{ width: 6, height: 6, borderRadius: 999, background: D.coral }} />
            <span style={{ fontFamily: mn, fontSize: 10.5, letterSpacing: 1.2, color: D.coral, fontWeight: 800, textTransform: "uppercase" }}>Overdue · {overdue.length}</span>
            <TimePill mins={sumMins(overdue)} />
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {overdue.slice(0, 6).map((t) => (
              <a key={t.id} href="/board" target="_blank" rel="noopener"
                style={{
                  fontSize: 11.5, color: D.tx, textDecoration: "none",
                  padding: "5px 10px", background: D.surface, border: "1px solid " + D.border, borderRadius: 7,
                  maxWidth: 280, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>{t.title}</a>
            ))}
            {overdue.length > 6 && <span style={{ fontSize: 11, color: D.txd, alignSelf: "center" }}>+ {overdue.length - 6} more</span>}
          </div>
        </div>
      )}

      <div style={{
        display: "grid", gridTemplateColumns: "repeat(7, minmax(140px, 1fr))",
        gap: 8, overflowX: "auto",
      }}>
        {days.map((d) => {
          const isThisDay = d.iso === todayStr;
          const dow = d.date.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase();
          const dn = d.date.getDate();
          const isWeekend = d.date.getDay() === 0 || d.date.getDay() === 6;
          return (
            <div key={d.iso} style={{
              background: isThisDay ? "rgba(247,176,65,0.06)" : D.card,
              border: "1px solid " + (isThisDay ? "rgba(247,176,65,0.40)" : D.border),
              borderRadius: 12, padding: 10, display: "flex", flexDirection: "column", gap: 6,
              minHeight: 320,
            }}>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", paddingBottom: 8, borderBottom: "1px solid " + D.border }}>
                <span style={{ fontFamily: mn, fontSize: 10, fontWeight: 700, color: isThisDay ? D.amber : isWeekend ? D.txd : D.txm, letterSpacing: 0.6 }}>{dow}</span>
                <span style={{ fontSize: 18, fontWeight: 800, color: isThisDay ? D.amber : D.tx }}>{dn}</span>
              </div>
              {d.tasks.length === 0 ? (
                <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: D.txd, fontSize: 10.5, fontStyle: "italic" }}>—</div>
              ) : d.tasks.map((t) => (
                <a key={t.id} href="/board" target="_blank" rel="noopener" style={{
                  display: "block", padding: "6px 8px", background: D.surface, border: "1px solid " + D.border,
                  borderLeft: "3px solid " + (CAT_COLOR[t.category] || D.txd),
                  borderRadius: 6, textDecoration: "none", color: "inherit",
                }}>
                  <div style={{
                    fontSize: 11.5, fontWeight: 500, color: D.tx, lineHeight: 1.3,
                    display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
                    textDecoration: t.done ? "line-through" : "none", opacity: t.done ? 0.5 : 1,
                  }}>{t.title}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 4 }}>
                    <Avatar name={t.assignee || "Akash"} size={14} />
                    <span style={{ fontFamily: mn, fontSize: 9, color: PRI_COLOR[t.priority], fontWeight: 700 }}>{t.priority}</span>
                    <span style={{ marginLeft: "auto", fontFamily: mn, fontSize: 9, color: D.txd }}>{fmtMins(estOf(t))}</span>
                    <StatusCircle done={t.done} size={11} onClick={() => onToggle(t.id)} />
                  </div>
                </a>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// CALENDAR VIEW — month grid (6 rows × 7 cols), tasks chip per day
// ═══════════════════════════════════════════════════════════════════

function CalendarView({ filteredOpen, onToggle }: { filteredOpen: Task[]; onToggle: (id: string) => void }) {
  const [cursor, setCursor] = useState(() => {
    const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); return d;
  });

  const monthName = cursor.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const tasksByDate = useMemo(() => {
    const m: Record<string, Task[]> = {};
    filteredOpen.forEach((t) => {
      if (!t.dueDate) return;
      if (!m[t.dueDate]) m[t.dueDate] = [];
      m[t.dueDate].push(t);
    });
    return m;
  }, [filteredOpen]);

  // Render a 6×7 grid starting from the Sunday of the week containing day 1
  const gridStart = useMemo(() => {
    const d = new Date(cursor);
    d.setDate(1);
    d.setDate(d.getDate() - d.getDay());
    return d;
  }, [cursor]);

  const cells = useMemo(() => {
    const arr: { date: Date; iso: string; inMonth: boolean; tasks: Task[] }[] = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(gridStart); d.setDate(d.getDate() + i);
      const iso = isoDate(d);
      arr.push({ date: d, iso, inMonth: d.getMonth() === cursor.getMonth(), tasks: tasksByDate[iso] || [] });
    }
    return arr;
  }, [gridStart, cursor, tasksByDate]);

  const todayStr = todayIso();
  const monthMins = cells.filter((c) => c.inMonth).reduce((s, c) => s + sumMins(c.tasks), 0);
  const monthCount = cells.filter((c) => c.inMonth).reduce((s, c) => s + c.tasks.length, 0);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, paddingBottom: 8, borderBottom: "1px solid " + D.border }}>
        <h2 style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>{monthName}</h2>
        <span style={{ fontFamily: mn, fontSize: 11, color: D.txd }}>{monthCount}</span>
        {monthMins > 0 && <TimePill mins={monthMins} tone="cool" />}
        <div style={{ marginLeft: "auto", display: "flex", gap: 4 }}>
          <CalendarNavBtn label="‹" onClick={() => { const d = new Date(cursor); d.setMonth(d.getMonth() - 1); setCursor(d); }} />
          <CalendarNavBtn label="Today" onClick={() => { const d = new Date(); d.setDate(1); d.setHours(0,0,0,0); setCursor(d); }} />
          <CalendarNavBtn label="›" onClick={() => { const d = new Date(cursor); d.setMonth(d.getMonth() + 1); setCursor(d); }} />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, marginBottom: 6 }}>
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d} style={{ fontFamily: mn, fontSize: 9.5, color: D.txd, letterSpacing: 0.8, textAlign: "center", padding: "4px 0", textTransform: "uppercase", fontWeight: 700 }}>{d}</div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
        {cells.map((c) => {
          const isToday = c.iso === todayStr;
          const overdueHere = c.iso < todayStr;
          return (
            <div key={c.iso} style={{
              minHeight: 96, padding: 6,
              background: isToday ? "rgba(247,176,65,0.06)" : D.card,
              border: "1px solid " + (isToday ? "rgba(247,176,65,0.40)" : D.border),
              borderRadius: 9,
              opacity: c.inMonth ? 1 : 0.4,
              display: "flex", flexDirection: "column", gap: 3,
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <span style={{
                  fontSize: 11, fontWeight: 700,
                  color: isToday ? D.amber : c.inMonth ? D.tx : D.txd,
                }}>{c.date.getDate()}</span>
                {c.tasks.length > 0 && <span style={{ fontFamily: mn, fontSize: 9, color: overdueHere ? D.coral : D.txd }}>{c.tasks.length}</span>}
              </div>
              {c.tasks.slice(0, 3).map((t) => (
                <a key={t.id} href="/board" target="_blank" rel="noopener" style={{
                  fontSize: 10, color: D.tx, padding: "2px 5px",
                  background: D.surface, borderLeft: "2px solid " + (CAT_COLOR[t.category] || D.txd),
                  borderRadius: 3, textDecoration: "none",
                  display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  textDecorationLine: t.done ? "line-through" : "none",
                  opacity: t.done ? 0.5 : 1,
                }} onClick={(e) => { if ((e.target as HTMLElement).tagName === "INPUT") { e.preventDefault(); onToggle(t.id); } }}>{t.title}</a>
              ))}
              {c.tasks.length > 3 && <span style={{ fontFamily: mn, fontSize: 9, color: D.txd }}>+{c.tasks.length - 3} more</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CalendarNavBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      padding: "5px 10px", background: D.surface, border: "1px solid " + D.border,
      color: D.txm, fontFamily: ft, fontSize: 11, fontWeight: 600, borderRadius: 7, cursor: "pointer",
    }}>{label}</button>
  );
}

// ═══════════════════════════════════════════════════════════════════
// FOCUS VIEW — single big card, paginate through hot seat then queue
// ═══════════════════════════════════════════════════════════════════

function FocusViewBlock({ tasks, index, setIndex, onToggle }: {
  tasks: Task[]; index: number; setIndex: (n: number) => void; onToggle: (id: string) => void;
}) {
  if (tasks.length === 0) {
    return <EmptyState title="Inbox zero" subtitle="No open tasks to focus on. Treat yourself." />;
  }
  const idx = Math.max(0, Math.min(index, tasks.length - 1));
  const t = tasks[idx];
  const overdue = isOverdue(t);
  const due = dueLabel(t.dueDate);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <h2 style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>Focus</h2>
        <span style={{ fontFamily: mn, fontSize: 11, color: D.txd }}>{idx + 1} of {tasks.length}</span>
        <div style={{ marginLeft: "auto", display: "flex", gap: 4 }}>
          <CalendarNavBtn label="‹ Prev" onClick={() => setIndex(Math.max(0, idx - 1))} />
          <CalendarNavBtn label="Next ›" onClick={() => setIndex(Math.min(tasks.length - 1, idx + 1))} />
        </div>
      </div>

      <div style={{
        position: "relative", padding: "32px 36px",
        background: D.card,
        border: "1px solid " + (overdue ? "rgba(224,99,71,0.40)" : D.border),
        borderRadius: 18,
        boxShadow: "0 12px 36px rgba(0,0,0,0.25)",
      }}>
        <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 5, background: CAT_COLOR[t.category] || D.txd, borderRadius: "5px 0 0 5px" }} />

        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
          <span style={{ fontFamily: mn, fontSize: 11, color: CAT_COLOR[t.category] || D.txd, fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase" }}>{t.category}</span>
          <span style={{ fontFamily: mn, fontSize: 11, color: PRI_COLOR[t.priority], fontWeight: 700, padding: "3px 9px", border: "1px solid " + PRI_COLOR[t.priority] + "55", borderRadius: 6 }}>{t.priority}</span>
          {overdue && <span style={{ fontFamily: mn, fontSize: 11, color: D.coral, fontWeight: 700 }}>● {due.toUpperCase()}</span>}
          <div style={{ marginLeft: "auto" }}>
            <TimePill mins={estOf(t)} tone="warm" />
          </div>
        </div>

        <h1 style={{
          fontSize: 28, fontWeight: 800, letterSpacing: -0.6, margin: 0, lineHeight: 1.2,
          color: D.tx, marginBottom: 14,
          textDecoration: t.done ? "line-through" : "none", opacity: t.done ? 0.5 : 1,
        }}>{t.title}</h1>

        {t.description && (
          <div style={{ fontSize: 13.5, color: D.txm, lineHeight: 1.55, marginBottom: 16, whiteSpace: "pre-wrap" }}>{t.description}</div>
        )}

        {t.subtasks && t.subtasks.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 10, color: D.txd, letterSpacing: 0.8, fontWeight: 700, textTransform: "uppercase", marginBottom: 6 }}>Subtasks · {t.subtasks.filter((s) => s.done).length}/{t.subtasks.length}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {t.subtasks.map((s) => (
                <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0" }}>
                  <StatusCircle done={s.done} size={12} />
                  <span style={{ fontSize: 13, color: D.tx, textDecoration: s.done ? "line-through" : "none", opacity: s.done ? 0.5 : 1 }}>{s.title}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: 12, paddingTop: 16, borderTop: "1px solid " + D.border }}>
          <Avatar name={t.assignee || "Akash"} size={26} />
          <div>
            <div style={{ fontSize: 12, color: D.tx, fontWeight: 600 }}>{t.assignee || "Akash"}</div>
            <div style={{ fontSize: 11, color: D.txd, fontFamily: mn }}>{due}</div>
          </div>
          <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            <button
              onClick={() => onToggle(t.id)}
              style={{
                padding: "9px 16px",
                background: t.done ? D.surface : "linear-gradient(135deg, " + D.teal + ", " + D.cyan + ")",
                border: t.done ? "1px solid " + D.border : "none",
                color: t.done ? D.txm : "#0A0A0F",
                fontFamily: ft, fontSize: 12.5, fontWeight: 700, borderRadius: 9, cursor: "pointer",
              }}
            >{t.done ? "Reopen" : "✓ Mark done"}</button>
            <a href="/board" target="_blank" rel="noopener" style={{
              padding: "9px 16px", background: "transparent", border: "1px solid " + D.border,
              color: D.txm, fontFamily: ft, fontSize: 12.5, fontWeight: 600, borderRadius: 9, textDecoration: "none",
            }}>Open in Studio ↗</a>
          </div>
        </div>
      </div>
    </div>
  );
}

function BoardCard({ task, onToggle }: { task: Task; onToggle: () => void }) {
  const overdue = isOverdue(task);
  const drag = useDrag();
  const isDragging = drag.draggingId === task.id;
  const isCombined = drag.combineIds.includes(task.id);
  const isSelected = drag.selectedIds.has(task.id);
  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (e.shiftKey) { e.preventDefault(); drag.toggleSelected(task.id); return; }
    if (e.metaKey || e.ctrlKey || e.altKey) {
      e.preventDefault();
      drag.toggleCombine(task.id);
    }
  };
  const handleDouble = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    drag.openFocus(task);
  };
  return (
    <a
      href="/board"
      target="_blank"
      rel="noopener"
      draggable
      onClick={handleClick}
      onDoubleClick={handleDouble}
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", task.id);
        e.dataTransfer.effectAllowed = "move";
        drag.startDrag(task.id);
      }}
      onDragEnd={() => drag.endDrag()}
      style={{
        position: "relative", padding: "10px 12px",
        background: isSelected ? "rgba(247,176,65,0.12)" : isCombined ? "rgba(120,162,255,0.08)" : D.surface,
        border: "1px solid " + (isSelected ? D.amber + "88" : isCombined ? D.blue + "88" : overdue ? "rgba(224,99,71,0.30)" : D.border),
        borderRadius: 9, textDecoration: "none", color: "inherit", display: "block",
        opacity: isDragging ? 0.45 : 1,
        transition: "background 0.14s, border-color 0.14s, opacity 0.14s",
        cursor: "grab",
      }}
    >
      <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 3, background: CAT_COLOR[task.category] || D.txd, borderRadius: "3px 0 0 3px" }} />
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 6 }}>
        <StatusCircle done={task.done} size={13} onClick={onToggle} />
        <span style={{ fontSize: 9, color: CAT_COLOR[task.category] || D.txd, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase" }}>{task.category}</span>
      </div>
      <div style={{
        fontSize: 12.5, fontWeight: 500, color: D.tx, lineHeight: 1.35,
        textDecoration: task.done ? "line-through" : "none",
        opacity: task.done ? 0.5 : 1, marginBottom: 8,
        display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden",
      }}>{task.title}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <Avatar name={task.assignee || "Akash"} size={16} />
        <TimePill mins={estOf(task)} />
        {task.dueDate && (
          <span style={{
            marginLeft: "auto", fontFamily: mn, fontSize: 9.5,
            color: overdue ? D.coral : isToday(task) ? D.amber : D.txm,
          }}>{dueLabel(task.dueDate)}</span>
        )}
      </div>
    </a>
  );
}

function AllOpenView({ queueGroups, totalQueue, groupBy, onToggle }: {
  queueGroups: TaskGroup[];
  totalQueue: { n: number; mins: number };
  groupBy: GroupBy;
  onToggle: (id: string) => void;
}) {
  return (
    <div>
      <SectionHeader label="All open" count={totalQueue.n} mins={totalQueue.mins} right={"grouped by " + groupBy} />
      <QueueGrouped groups={queueGroups} onToggle={onToggle} />
    </div>
  );
}

function DoneView({ tasks, onToggle }: { tasks: Task[]; onToggle: (id: string) => void }) {
  return (
    <div>
      <SectionHeader label="Recently completed" count={tasks.length} mins={sumMins(tasks)} right="last 30 days" />
      {tasks.length === 0 ? (
        <EmptyState title="Nothing completed yet" subtitle="Check off a few items and they'll land here." />
      ) : (
        <div style={{ background: D.card, border: "1px solid " + D.border, borderRadius: 12, overflow: "hidden" }}>
          {tasks.map((t, i) => (
            <QueueRow key={t.id} task={t} last={i === tasks.length - 1} onToggle={() => onToggle(t.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

function QueueGrouped({ groups, onToggle }: { groups: TaskGroup[]; onToggle: (id: string) => void }) {
  if (groups.length === 0) {
    return <EmptyState title="Queue is empty" subtitle="Capture a task above, or open Studio to plan." />;
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {groups.map(({ key, color, tasks }) => {
        const groupMins = sumMins(tasks);
        return (
          <div key={key}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: 999, background: color }} />
              <span style={{ fontFamily: mn, fontSize: 10, letterSpacing: 1.4, textTransform: "uppercase", color, fontWeight: 700 }}>{key}</span>
              <span style={{ fontFamily: mn, fontSize: 10, color: D.txd }}>{tasks.length}</span>
              <TimePill mins={groupMins} />
            </div>
            <div style={{ background: D.card, border: "1px solid " + D.border, borderRadius: 12, overflow: "hidden" }}>
              {tasks.map((t, i) => (
                <QueueRow key={t.id} task={t} last={i === tasks.length - 1} onToggle={() => onToggle(t.id)} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Section header used at the top of each view's content area.
function SectionHeader({ label, count, mins, right, tone = "muted" }: {
  label: string; count: number; mins: number; right?: string; tone?: "muted" | "warm" | "cool";
}) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 12, paddingBottom: 8, borderBottom: "1px solid " + D.border }}>
      <h2 style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>{label}</h2>
      <span style={{ fontFamily: mn, fontSize: 11, color: D.txd }}>{count}</span>
      {mins > 0 && <TimePill mins={mins} tone={tone} />}
      {right && <span style={{ marginLeft: "auto", fontSize: 11, color: D.txd, fontFamily: mn }}>{right}</span>}
    </div>
  );
}

function EmptyState({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div style={{
      padding: 40, background: D.card, border: "1px dashed " + D.border, borderRadius: 12,
      textAlign: "center", color: D.txm, fontSize: 13.5,
    }}>
      <div style={{ fontSize: 30, marginBottom: 8, color: D.txd }}>✶</div>
      <div style={{ color: D.tx, fontWeight: 600, marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: 12 }}>{subtitle}</div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// HOT SEAT CARD
// ═══════════════════════════════════════════════════════════════════

function HotSeatCard({ task, onToggle }: { task: Task; onToggle: () => void }) {
  const overdue = isOverdue(task);
  const today = isToday(task);
  const [hover, setHover] = useState(false);
  const drag = useDrag();
  const isDragging = drag.draggingId === task.id;
  const isCombined = drag.combineIds.includes(task.id);
  const isSelected = drag.selectedIds.has(task.id);
  const pColor = PRI_COLOR[task.priority] || D.txd;
  const cColor = CAT_COLOR[task.category] || D.txd;
  const subDone = task.subtasks?.filter((s) => s.done).length || 0;
  const subTotal = task.subtasks?.length || 0;
  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.shiftKey) { e.preventDefault(); drag.toggleSelected(task.id); return; }
    if (e.metaKey || e.ctrlKey || e.altKey) {
      e.preventDefault();
      drag.toggleCombine(task.id);
      return;
    }
    drag.openEdit(task);
  };
  const handleDouble = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    drag.openFocus(task);
  };
  return (
    <div
      role="button"
      tabIndex={0}
      draggable
      onClick={handleClick}
      onDoubleClick={handleDouble}
      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); drag.openEdit(task); } }}
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", task.id);
        e.dataTransfer.effectAllowed = "move";
        drag.startDrag(task.id);
      }}
      onDragEnd={() => drag.endDrag()}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: "relative", padding: "14px 16px 14px 19px",
        background: isSelected ? "rgba(247,176,65,0.10)" : isCombined ? "rgba(120,162,255,0.08)" : D.card,
        border: "1px solid " + (isSelected ? D.amber + "88" : isCombined ? D.blue + "88" : hover ? D.amber + "66" : overdue ? "rgba(224,99,71,0.30)" : D.border),
        borderRadius: 12, textDecoration: "none", color: "inherit", display: "block",
        transition: "border-color 0.14s, transform 0.14s, box-shadow 0.14s, opacity 0.14s",
        transform: hover ? "translateY(-1px)" : "translateY(0)",
        boxShadow: hover ? "0 8px 22px rgba(247,176,65,0.18)" : "none",
        opacity: isDragging ? 0.45 : 1,
        cursor: "grab",
        animation: "tbRowIn 0.22s ease both",
      }}
    >
      <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 3, background: "linear-gradient(180deg, " + pColor + ", " + pColor + "66)", borderRadius: "4px 0 0 4px" }} />
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <StatusCircle done={task.done} size={14} onClick={onToggle} />
        <span style={{
          fontSize: 9, color: cColor, fontWeight: 700, letterSpacing: 0.6, textTransform: "uppercase",
          background: cColor + "12", border: "1px solid " + cColor + "44",
          padding: "2px 7px", borderRadius: 4, whiteSpace: "nowrap",
        }}>{task.category}</span>
        {overdue && <span style={{ marginLeft: "auto", fontSize: 9.5, color: D.coral, fontWeight: 700, letterSpacing: 0.5, fontFamily: mn, animation: "tbPulseRed 1.8s infinite" }}>● {dueLabel(task.dueDate).toUpperCase()}</span>}
        {today && !overdue && <span style={{ marginLeft: "auto", fontSize: 9.5, color: D.amber, fontWeight: 700, letterSpacing: 0.5, fontFamily: mn }}>● TODAY</span>}
      </div>
      <div style={{
        fontFamily: gf, fontSize: 14, fontWeight: 700, lineHeight: 1.35, color: D.tx, marginBottom: 10, letterSpacing: -0.2,
        textDecoration: task.done ? "line-through" : "none", opacity: task.done ? 0.6 : 1,
      }}>{task.title}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, paddingTop: 8, borderTop: "1px solid " + D.border }}>
        <Avatar name={task.assignee || "Akash"} size={20} />
        <span style={{ fontSize: 11.5, color: D.txm }}>{task.assignee || "Akash"}</span>
        <TimePill mins={estOf(task)} />
        {subTotal > 0 && <SubtaskRing done={subDone} total={subTotal} color={subDone === subTotal ? D.teal : D.violet} size={20} />}
        <span style={{
          marginLeft: "auto", fontSize: 9.5, color: pColor, fontFamily: mn,
          fontWeight: 700, padding: "2px 7px",
          background: pColor + "15", border: "1px solid " + pColor + "55", borderRadius: 5,
          letterSpacing: 0.5, textTransform: "uppercase",
        }}>{task.priority}</span>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// QUEUE ROW (used in Today, All, Schedule day sections, Done)
// ═══════════════════════════════════════════════════════════════════

function QueueRow({ task, last, onToggle }: { task: Task; last: boolean; onToggle: () => void }) {
  const overdue = isOverdue(task);
  const today = isToday(task);
  const dueColor = overdue ? D.coral : today ? D.amber : D.txm;
  const pColor = PRI_COLOR[task.priority] || D.txd;
  const cColor = CAT_COLOR[task.category] || D.txd;
  const subDone = task.subtasks?.filter((s) => s.done).length || 0;
  const subTotal = task.subtasks?.length || 0;
  const [hover, setHover] = useState(false);
  const drag = useDrag();
  const isDragging = drag.draggingId === task.id;
  const isCombined = drag.combineIds.includes(task.id);
  const isSelected = drag.selectedIds.has(task.id);
  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.shiftKey) { e.preventDefault(); drag.toggleSelected(task.id); return; }
    if (e.metaKey || e.ctrlKey || e.altKey) {
      e.preventDefault();
      drag.toggleCombine(task.id);
      return;
    }
    drag.openEdit(task);
  };
  const handleDouble = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    drag.openFocus(task);
  };
  return (
    <div
      role="button"
      tabIndex={0}
      draggable
      onClick={handleClick}
      onDoubleClick={handleDouble}
      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); drag.openEdit(task); } }}
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", task.id);
        e.dataTransfer.effectAllowed = "move";
        drag.startDrag(task.id);
      }}
      onDragEnd={() => drag.endDrag()}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className="tbq-row"
      style={{
        position: "relative",
        display: "grid",
        gridTemplateColumns: "20px 110px 1fr auto auto auto auto auto",
        alignItems: "center", gap: 10, padding: "9px 14px 9px 17px",
        borderBottom: last ? "none" : "1px solid " + D.border,
        textDecoration: "none", color: "inherit",
        background: isSelected
          ? "rgba(247,176,65,0.12)"
          : isCombined
          ? "rgba(120,162,255,0.10)"
          : hover
          ? "rgba(247,176,65,0.06)"
          : overdue ? "rgba(224,99,71,0.04)" : "transparent",
        transition: "background 0.14s, box-shadow 0.14s, opacity 0.14s",
        boxShadow: isSelected
          ? "inset 2px 0 0 " + D.amber
          : isCombined
          ? "inset 2px 0 0 " + D.blue
          : hover ? "inset 2px 0 0 " + D.amber : "inset 2px 0 0 " + pColor + "55",
        opacity: isDragging ? 0.45 : 1,
        cursor: "grab",
        animation: "tbRowIn 0.22s ease both",
      }}
    >
      <StatusCircle done={task.done} size={16} onClick={onToggle} />
      <span className="tbq-cat" style={{
        fontSize: 9, color: cColor, fontWeight: 700, letterSpacing: 0.6, textTransform: "uppercase",
        background: cColor + "12", border: "1px solid " + cColor + "44",
        padding: "3px 6px", borderRadius: 4,
        textAlign: "center", whiteSpace: "nowrap",
        overflow: "hidden", textOverflow: "ellipsis",
      }}>{task.category}</span>
      <div style={{
        minWidth: 0,
        fontFamily: gf, fontSize: 13.5, fontWeight: 600, color: D.tx, lineHeight: 1.3,
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        textDecoration: task.done ? "line-through" : "none",
        opacity: task.done ? 0.5 : 1, letterSpacing: -0.1,
      }}>{task.title}</div>
      <span className="tbq-sub">
        {subTotal > 0
          ? <SubtaskRing done={subDone} total={subTotal} color={subDone === subTotal ? D.teal : D.violet} size={20} />
          : <span style={{ width: 20, display: "inline-block" }} />}
      </span>
      <span className="tbq-time"><TimePill mins={estOf(task)} /></span>
      <span style={{
        fontFamily: mn, fontSize: 10, color: dueColor,
        padding: "3px 8px",
        background: overdue ? "rgba(224,99,71,0.10)" : "transparent",
        border: "1px solid " + dueColor + "44", borderRadius: 5,
        whiteSpace: "nowrap", minWidth: 64, textAlign: "center", fontWeight: 600,
      }}>{dueLabel(task.dueDate)}</span>
      <span className="tbq-avatar"><Avatar name={task.assignee || "Akash"} size={22} /></span>
      <span className="tbq-pri" style={{
        fontSize: 9.5, color: pColor, fontFamily: mn, fontWeight: 700,
        padding: "3px 8px",
        background: pColor + "15",
        border: "1px solid " + pColor + "55", borderRadius: 5,
        whiteSpace: "nowrap", letterSpacing: 0.5, textTransform: "uppercase",
      }}>{task.priority}</span>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// ADD TASK MODAL
// ═══════════════════════════════════════════════════════════════════

function AddTaskModal({ defaultCat, defaultAssignee, onSubmit, onClose }: {
  defaultCat: string | null;
  defaultAssignee: string | null;
  onSubmit: (t: Task) => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState(defaultCat || "OTHER");
  const [priority, setPriority] = useState<Priority>("MEDIUM");
  const [assignee, setAssignee] = useState(defaultAssignee || "Akash");
  const [dueDate, setDueDate] = useState("");
  const [estimateMins, setEstimateMins] = useState(30);

  const titleRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => { titleRef.current?.focus(); }, []);

  // body scroll lock
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  function submit() {
    const txt = title.trim();
    if (!txt) return;
    const t: Task = {
      id: "t-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6),
      title: txt,
      description: description.trim() || undefined,
      category,
      priority,
      assignee,
      dueDate: dueDate || undefined,
      estimateMins: estimateMins || undefined,
      addedAt: new Date().toISOString(),
      source: "manual",
    };
    onSubmit(t);
  }

  if (typeof window === "undefined") return null;

  return createPortal(
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 24, fontFamily: ft,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(560px, 100%)", maxHeight: "90vh", overflowY: "auto",
          background: D.bg, border: "1px solid " + D.border, borderRadius: 16,
          boxShadow: "0 24px 60px rgba(0,0,0,0.5)",
        }}
      >
        <div style={{ padding: "20px 22px 14px", borderBottom: "1px solid " + D.border, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontFamily: mn, fontSize: 10, color: D.amber, letterSpacing: 1.4, fontWeight: 700, textTransform: "uppercase", marginBottom: 4 }}>New task</div>
            <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: D.tx }}>Capture something to do</h3>
          </div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", color: D.txm, fontSize: 22, cursor: "pointer", padding: 4 }}>×</button>
        </div>

        <div style={{ padding: 22, display: "flex", flexDirection: "column", gap: 14 }}>
          <ModalField label="Title">
            <input
              ref={titleRef}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit(); }}
              placeholder="What needs doing?"
              style={inputStyle}
            />
          </ModalField>

          <ModalField label="Notes (optional)">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Context, links, acceptance criteria…"
              rows={3}
              style={{ ...inputStyle, resize: "vertical", minHeight: 64, fontFamily: ft }}
            />
          </ModalField>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <ModalField label="Category">
              <select value={category} onChange={(e) => setCategory(e.target.value)} style={inputStyle}>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </ModalField>
            <ModalField label="Priority">
              <select value={priority} onChange={(e) => setPriority(e.target.value as Priority)} style={inputStyle}>
                {PRIORITY_ORDER.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </ModalField>
            <ModalField label="Assignee">
              <select value={assignee} onChange={(e) => setAssignee(e.target.value)} style={inputStyle}>
                {ASSIGNEES.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </ModalField>
            <ModalField label="Due date">
              <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} style={inputStyle} />
            </ModalField>
            <ModalField label="Estimate (minutes)">
              <input type="number" min={0} step={15} value={estimateMins} onChange={(e) => setEstimateMins(Number(e.target.value) || 0)} style={inputStyle} />
            </ModalField>
            <ModalField label="Quick due">
              <div style={{ display: "flex", gap: 6 }}>
                {[
                  { l: "Today", iso: todayIso() },
                  { l: "Tomorrow", iso: isoDate(new Date(Date.now() + 86400000)) },
                  { l: "Next wk", iso: isoDate(new Date(Date.now() + 7 * 86400000)) },
                ].map((q) => (
                  <button
                    key={q.l}
                    onClick={() => setDueDate(q.iso)}
                    style={{
                      flex: 1, padding: "8px 6px", background: dueDate === q.iso ? D.amber + "22" : D.surface,
                      border: "1px solid " + (dueDate === q.iso ? D.amber : D.border),
                      color: dueDate === q.iso ? D.amber : D.txm,
                      fontFamily: ft, fontSize: 11, fontWeight: 600, borderRadius: 7, cursor: "pointer",
                    }}
                  >{q.l}</button>
                ))}
              </div>
            </ModalField>
          </div>
        </div>

        <div style={{
          padding: "14px 22px", borderTop: "1px solid " + D.border,
          display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10,
        }}>
          <div style={{ fontFamily: mn, fontSize: 10.5, color: D.txd }}>⌘ + Enter to create</div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={onClose}
              style={{
                padding: "9px 16px", background: "transparent", border: "1px solid " + D.border,
                color: D.txm, fontFamily: ft, fontSize: 13, fontWeight: 600, borderRadius: 9, cursor: "pointer",
              }}
            >Cancel</button>
            <button
              onClick={submit}
              disabled={!title.trim()}
              style={{
                padding: "9px 18px",
                background: title.trim() ? "linear-gradient(135deg, " + D.amber + ", " + D.coral + ")" : D.surface,
                border: "1px solid " + (title.trim() ? "transparent" : D.border),
                color: title.trim() ? "#0A0A0F" : D.txd,
                fontFamily: ft, fontSize: 13, fontWeight: 700, borderRadius: 9,
                cursor: title.trim() ? "pointer" : "not-allowed",
                opacity: title.trim() ? 1 : 0.6,
              }}
            >Create task</button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "9px 12px",
  background: D.surface, border: "1px solid " + D.border, borderRadius: 8,
  color: D.tx, fontFamily: ft, fontSize: 13, outline: "none",
};

function ModalField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "block" }}>
      <div style={{ fontSize: 10.5, color: D.txd, letterSpacing: 0.8, fontWeight: 700, textTransform: "uppercase", marginBottom: 5 }}>{label}</div>
      {children}
    </label>
  );
}

// ═══════════════════════════════════════════════════════════════════
// COMBINE DOCK — floating right-edge drawer
// ═══════════════════════════════════════════════════════════════════
// Drop 2+ tasks here to stage them, then hit Combine to ask Claude for a
// merged proposal. Auto-expands and pulses the moment any drag starts.

function CombineDock({ tasks, dragActive }: { tasks: Task[]; dragActive: boolean }) {
  const drag = useDrag();
  const [open, setOpen] = useState(false);
  const [over, setOver] = useState(false);

  useEffect(() => {
    if (dragActive) setOpen(true);
  }, [dragActive]);

  const has = tasks.length > 0;
  const canCombine = tasks.length >= 2;

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const id = e.dataTransfer.getData("text/plain");
        if (id) drag.toggleCombine(id);
      }}
      style={{
        position: "fixed", right: 16, top: "50%", transform: "translateY(-50%)",
        width: open ? 264 : 56,
        background: D.card,
        border: "1px solid " + (over ? D.amber : has ? D.amber + "66" : D.border),
        borderRadius: 14,
        boxShadow: over
          ? "0 0 0 4px " + D.amber + "44, 0 18px 40px rgba(0,0,0,0.5)"
          : has ? "0 0 0 2px " + D.amber + "22, 0 12px 30px rgba(0,0,0,0.4)" : "0 8px 22px rgba(0,0,0,0.35)",
        zIndex: 80,
        padding: open ? 12 : 8,
        transition: "width 0.18s, border-color 0.14s, box-shadow 0.14s",
        animation: dragActive && !over ? "tbDockPulse 1.2s infinite" : "none",
        overflow: "hidden",
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title={open ? "Collapse" : "Expand combine bucket"}
        style={{
          width: "100%", display: "flex", alignItems: "center", gap: 8,
          padding: "6px 8px",
          background: has ? D.amber + "15" : "transparent",
          border: "1px solid " + (has ? D.amber + "55" : D.border),
          color: has ? D.amber : D.txm,
          borderRadius: 8, cursor: "pointer", fontFamily: mn, fontSize: 11, fontWeight: 700, letterSpacing: 0.4,
        }}
      >
        {has ? <span style={{ fontFamily: gf, fontSize: 16, fontWeight: 900, lineHeight: 1 }}>{tasks.length}</span> : <span style={{ fontSize: 14 }}>↘</span>}
        {open && <span style={{ marginLeft: "auto" }}>COMBINE</span>}
      </button>

      {open && (
        <>
          <div style={{
            marginTop: 10, padding: "10px 8px",
            border: "1.5px dashed " + (over ? D.amber : has ? D.amber + "55" : D.border),
            borderRadius: 8, minHeight: 60,
            background: over ? D.amber + "12" : "transparent",
            display: "flex", flexDirection: "column", gap: 4,
            fontFamily: mn, fontSize: 10, color: D.txd, textAlign: "center",
            transition: "border-color 0.14s, background 0.14s",
          }}>
            {has ? (
              tasks.map((t) => (
                <div key={t.id} style={{
                  display: "flex", alignItems: "center", gap: 6, padding: "4px 6px",
                  background: "rgba(255,255,255,0.03)", borderRadius: 5,
                  fontFamily: ft, fontSize: 11.5, color: D.tx, textAlign: "left",
                }}>
                  <Avatar name={t.assignee || "Akash"} size={14} />
                  <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.title}</span>
                  <button
                    type="button"
                    onClick={() => drag.toggleCombine(t.id)}
                    title="Remove"
                    style={{ background: "transparent", border: "none", color: D.txd, cursor: "pointer", fontSize: 13, padding: 0 }}
                  >×</button>
                </div>
              ))
            ) : (
              <span style={{ padding: "10px 0" }}>{dragActive ? "↓ Drop here ↓" : "Drag duplicates here"}</span>
            )}
          </div>

          <button
            type="button"
            onClick={drag.openCombine}
            disabled={!canCombine}
            style={{
              marginTop: 10, width: "100%", padding: "9px 10px",
              background: canCombine ? D.amber : "transparent",
              color: canCombine ? "#0A0A0F" : D.txd,
              border: "1px " + (canCombine ? "solid " + D.amber : "dashed " + D.border),
              borderRadius: 8, fontFamily: mn, fontSize: 10.5, fontWeight: 800, letterSpacing: 0.6,
              cursor: canCombine ? "pointer" : "not-allowed",
              textTransform: "uppercase",
            }}
          >
            ✦ Combine {tasks.length || ""} {canCombine ? "→ 1" : ""}
          </button>
          {has && (
            <button
              type="button"
              onClick={drag.clearCombine}
              style={{
                marginTop: 6, width: "100%", padding: "6px",
                background: "transparent", color: D.txd,
                border: "none", fontFamily: mn, fontSize: 9.5, letterSpacing: 0.5,
                cursor: "pointer", textTransform: "uppercase",
              }}
            >clear</button>
          )}
        </>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// COMBINE MODAL — preview Claude's merge, edit, commit
// ═══════════════════════════════════════════════════════════════════

interface MergeProposal {
  title: string;
  description: string;
  category: string;
  priority: Priority;
  assignee: string;
  dueDate: string;
  notes: string;
  subtasks: { title: string }[];
}

function CombineModal({ sources, onClose, onCommit }: {
  sources: Task[];
  onClose: () => void;
  onCommit: (merged: Task, sourceIds: string[]) => void;
}) {
  const [proposal, setProposal] = useState<MergeProposal>(() => ({
    title: sources[0]?.title || "",
    description: sources[0]?.description || "",
    category: sources[0]?.category || "OTHER",
    priority: sources[0]?.priority || "MEDIUM",
    assignee: sources[0]?.assignee || "Akash",
    dueDate: sources.map((s) => s.dueDate).filter(Boolean).sort()[0] || "",
    notes: "",
    subtasks: sources.flatMap((s) => s.subtasks || []).map((s) => ({ title: s.title })),
  }));
  const [state, setState] = useState<"idle" | "thinking" | "error">("idle");
  const [error, setError] = useState("");

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  async function smartMerge() {
    setState("thinking"); setError("");
    try {
      const res = await fetch("/api/akash-todo/combine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tasks: sources.map((s) => ({
            title: s.title,
            description: s.description,
            category: s.category,
            priority: s.priority,
            assignee: s.assignee,
            dueDate: s.dueDate,
            subtasks: (s.subtasks || []).map((st) => ({ title: st.title, done: st.done })),
          })),
        }),
      });
      const j = await res.json();
      if (!res.ok || !j.title) throw new Error(j.error || "no proposal");
      setProposal({
        title: j.title || "",
        description: j.description || "",
        category: j.category || "OTHER",
        priority: (j.priority || "MEDIUM") as Priority,
        assignee: j.assignee || "Akash",
        dueDate: j.dueDate || "",
        notes: j.notes || "",
        subtasks: Array.isArray(j.subtasks) ? j.subtasks.map((s: { title?: string }) => ({ title: s.title || "" })) : [],
      });
      setState("idle");
    } catch (e) {
      setError(e instanceof Error ? e.message : "merge failed");
      setState("error");
    }
  }

  function commit() {
    const stamp = new Date().toISOString();
    const merged: Task = {
      id: "t-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6),
      title: proposal.title.trim() || "Combined task",
      description: proposal.description,
      category: proposal.category,
      priority: proposal.priority,
      assignee: proposal.assignee,
      dueDate: proposal.dueDate || undefined,
      subtasks: proposal.subtasks.filter((s) => s.title.trim()).map((s, i) => ({
        id: "st-" + Date.now() + "-" + i, title: s.title.trim(),
      })),
      estimateMins: 30,
      addedAt: stamp,
      updatedAt: stamp,
      source: "combine",
    };
    onCommit(merged, sources.map((s) => s.id));
  }

  return createPortal(
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, background: "rgba(6,6,8,0.7)", backdropFilter: "blur(20px)",
      WebkitBackdropFilter: "blur(20px)", zIndex: 90,
      display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: "8vh",
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: 640, maxWidth: "94vw", maxHeight: "84vh", overflowY: "auto",
        background: D.card, border: "1px solid " + D.border, borderRadius: 14,
        padding: "22px 26px", fontFamily: ft, color: D.tx,
      }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 6 }}>
          <div style={{ fontFamily: mn, fontSize: 10, color: D.txd, letterSpacing: 1.4, textTransform: "uppercase" }}>Combine {sources.length} tasks</div>
          <button onClick={smartMerge} disabled={state === "thinking"} style={{
            background: D.amber + "22", color: D.amber, border: "1px solid " + D.amber + "66",
            padding: "5px 11px", borderRadius: 7, fontFamily: mn, fontSize: 10, fontWeight: 700, cursor: "pointer",
            letterSpacing: 0.4, textTransform: "uppercase",
          }}>{state === "thinking" ? "✦ Thinking…" : "✦ Smart merge with Claude"}</button>
        </div>
        <h2 style={{ fontFamily: gf, fontSize: 22, fontWeight: 900, letterSpacing: -0.5, margin: "0 0 14px" }}>Merge into one</h2>

        {error && (
          <div style={{ marginBottom: 12, padding: "8px 10px", background: D.coral + "15", border: "1px solid " + D.coral + "55", borderRadius: 6, color: D.coral, fontSize: 12 }}>
            {error}
          </div>
        )}

        <div style={{ marginBottom: 12, padding: "8px 10px", background: "rgba(255,255,255,0.02)", border: "1px dashed " + D.border, borderRadius: 8 }}>
          <div style={{ fontFamily: mn, fontSize: 9, color: D.txd, letterSpacing: 1, textTransform: "uppercase", marginBottom: 5 }}>sources</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            {sources.map((s) => (
              <div key={s.id} style={{ fontSize: 11.5, color: D.txm, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>· {s.title}</div>
            ))}
          </div>
        </div>

        <ModalField label="Title">
          <input value={proposal.title} onChange={(e) => setProposal({ ...proposal, title: e.target.value })}
            style={inputStyle} />
        </ModalField>
        <ModalField label="Description">
          <textarea value={proposal.description} onChange={(e) => setProposal({ ...proposal, description: e.target.value })}
            rows={3} style={{ ...inputStyle, minHeight: 64, fontFamily: ft }} />
        </ModalField>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 12 }}>
          <ModalField label="Category">
            <select value={proposal.category} onChange={(e) => setProposal({ ...proposal, category: e.target.value })} style={inputStyle}>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </ModalField>
          <ModalField label="Priority">
            <select value={proposal.priority} onChange={(e) => setProposal({ ...proposal, priority: e.target.value as Priority })} style={inputStyle}>
              {(["HIGH", "MEDIUM", "THIS WEEK", "ONGOING"] as Priority[]).map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </ModalField>
          <ModalField label="Assignee">
            <select value={proposal.assignee} onChange={(e) => setProposal({ ...proposal, assignee: e.target.value })} style={inputStyle}>
              {ASSIGNEES.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </ModalField>
        </div>
        <ModalField label="Due date">
          <input type="date" value={proposal.dueDate} onChange={(e) => setProposal({ ...proposal, dueDate: e.target.value })} style={inputStyle} />
        </ModalField>
        <ModalField label={"Subtasks · " + proposal.subtasks.length}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {proposal.subtasks.map((s, i) => (
              <div key={i} style={{ display: "flex", gap: 6 }}>
                <input value={s.title} onChange={(e) => {
                  const next = [...proposal.subtasks]; next[i] = { title: e.target.value };
                  setProposal({ ...proposal, subtasks: next });
                }} style={{ ...inputStyle, padding: "5px 8px" }} />
                <button onClick={() => setProposal({ ...proposal, subtasks: proposal.subtasks.filter((_, j) => j !== i) })}
                  style={{ background: "transparent", border: "1px solid " + D.border, color: D.txd, padding: "0 8px", borderRadius: 5, cursor: "pointer", fontSize: 12 }}>×</button>
              </div>
            ))}
            <button onClick={() => setProposal({ ...proposal, subtasks: [...proposal.subtasks, { title: "" }] })}
              style={{ marginTop: 4, padding: "5px 10px", background: "transparent", border: "1px dashed " + D.border, color: D.txd, borderRadius: 5, fontFamily: mn, fontSize: 10.5, cursor: "pointer", letterSpacing: 0.4 }}>
              + add subtask
            </button>
          </div>
        </ModalField>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
          <button onClick={onClose} style={{
            padding: "8px 14px", background: "transparent", border: "1px solid " + D.border,
            color: D.txm, borderRadius: 7, fontFamily: ft, fontSize: 12, cursor: "pointer",
          }}>Cancel</button>
          <button onClick={commit} style={{
            padding: "8px 16px", background: D.amber, color: "#0A0A0F", border: "1px solid " + D.amber,
            borderRadius: 7, fontFamily: ft, fontSize: 12, fontWeight: 700, cursor: "pointer",
          }}>Combine {sources.length} → 1</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ═══════════════════════════════════════════════════════════════════
// ⌘K COMMAND PALETTE
// ═══════════════════════════════════════════════════════════════════

type PaletteResult = {
  id: string;
  kind: "task" | "view" | "filter" | "command" | "assignee";
  label: string;
  hint: string;
  color: string;
  initial?: string;
  run: () => void;
};

function CommandPalette({
  tasks, onClose, setView, setCatFilter, setAssigneeFilter,
  clearFilters, openAddTask, openFocus, openTask,
}: {
  tasks: Task[];
  onClose: () => void;
  setView: (v: ViewKey) => void;
  setCatFilter: (c: string | null) => void;
  setAssigneeFilter: (a: string | null) => void;
  clearFilters: () => void;
  openAddTask: () => void;
  openFocus: (t: Task) => void;
  openTask: (t: Task) => void;
}) {
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);

  const isSlash = query.startsWith("/");
  const isAt = query.startsWith("@");
  const lcQuery = query.toLowerCase().replace(/^[/@]/, "").trim();

  const results = useMemo<PaletteResult[]>(() => {
    const out: PaletteResult[] = [];

    const views: { k: ViewKey; l: string }[] = [
      { k: "today", l: "Today" }, { k: "schedule", l: "Schedule" }, { k: "week", l: "Week" },
      { k: "calendar", l: "Calendar" }, { k: "board", l: "Board" }, { k: "category", l: "Categories" },
      { k: "all", l: "All open" }, { k: "focus", l: "Focus" }, { k: "done", l: "Done" },
    ];

    const commands: { id: string; label: string; hint: string; run: () => void }[] = [
      { id: "cmd-add", label: "New task", hint: "add", run: openAddTask },
      { id: "cmd-clear-filters", label: "Clear filters", hint: "reset", run: clearFilters },
    ];

    if (isSlash) {
      commands.forEach((c) => {
        if (!lcQuery || c.label.toLowerCase().includes(lcQuery)) {
          out.push({ id: c.id, kind: "command", label: c.label, hint: c.hint, color: D.amber, initial: "/", run: c.run });
        }
      });
      views.forEach((v) => {
        if (!lcQuery || v.l.toLowerCase().includes(lcQuery)) {
          out.push({ id: "view-" + v.k, kind: "view", label: "Go to " + v.l, hint: "view", color: D.blue, initial: "V", run: () => setView(v.k) });
        }
      });
      return out.slice(0, 12);
    }

    if (isAt) {
      CATEGORIES.forEach((c) => {
        if (!lcQuery || c.toLowerCase().includes(lcQuery)) {
          const color = CAT_COLOR[c] || D.txd;
          out.push({ id: "cat-" + c, kind: "filter", label: "Filter · " + c, hint: "category", color, initial: c[0], run: () => setCatFilter(c) });
        }
      });
      ASSIGNEES.forEach((a) => {
        if (!lcQuery || a.toLowerCase().includes(lcQuery)) {
          out.push({ id: "asn-" + a, kind: "assignee", label: "Filter · " + a, hint: "assignee", color: D.violet, initial: a[0], run: () => setAssigneeFilter(a) });
        }
      });
      return out.slice(0, 14);
    }

    if (!lcQuery) {
      tasks.slice(0, 6).forEach((t) => {
        const c = CAT_COLOR[t.category] || D.txd;
        out.push({ id: t.id, kind: "task", label: t.title, hint: t.category, color: c, initial: t.category[0], run: () => openTask(t) });
      });
      commands.forEach((c) => {
        out.push({ id: c.id, kind: "command", label: c.label, hint: c.hint, color: D.amber, initial: "/", run: c.run });
      });
      out.push({ id: "view-focus", kind: "view", label: "Focus the top task", hint: "F", color: D.amber, initial: "F", run: () => { if (tasks[0]) openFocus(tasks[0]); } });
      return out.slice(0, 12);
    }

    tasks.forEach((t) => {
      const hay = (t.title + " " + (t.description || "") + " " + t.category + " " + (t.assignee || "")).toLowerCase();
      if (hay.includes(lcQuery)) {
        const c = CAT_COLOR[t.category] || D.txd;
        out.push({ id: t.id, kind: "task", label: t.title, hint: t.category, color: c, initial: t.category[0], run: () => openTask(t) });
      }
    });
    views.forEach((v) => {
      if (v.l.toLowerCase().includes(lcQuery)) {
        out.push({ id: "view-" + v.k, kind: "view", label: "Go to " + v.l, hint: "view", color: D.blue, initial: "V", run: () => setView(v.k) });
      }
    });
    commands.forEach((c) => {
      if (c.label.toLowerCase().includes(lcQuery)) {
        out.push({ id: c.id, kind: "command", label: c.label, hint: c.hint, color: D.amber, initial: "/", run: c.run });
      }
    });
    return out.slice(0, 12);
  }, [query, tasks, isSlash, isAt, lcQuery, setView, setCatFilter, setAssigneeFilter, openAddTask, clearFilters, openFocus, openTask]);

  const safeCursor = Math.max(0, Math.min(cursor, results.length - 1));

  const fire = useCallback((i: number) => {
    const r = results[i]; if (!r) return;
    r.run(); onClose();
  }, [results, onClose]);

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setCursor((c) => Math.min(c + 1, results.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setCursor((c) => Math.max(0, c - 1)); }
    else if (e.key === "Enter") { e.preventDefault(); fire(safeCursor); }
    else if (e.key === "Escape") { e.preventDefault(); onClose(); }
  };

  if (typeof window === "undefined") return null;
  return createPortal(
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, background: "rgba(6,6,12,0.72)",
      backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
      zIndex: 13000, display: "flex", alignItems: "flex-start",
      justifyContent: "center", paddingTop: "12vh", padding: 24,
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: "min(640px, 96vw)", background: "#0A0A14",
        border: "1px solid rgba(255,255,255,0.10)", borderRadius: 14,
        boxShadow: "0 30px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(247,176,65,0.08)",
        overflow: "hidden", display: "flex", flexDirection: "column", maxHeight: "70vh",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 18px", borderBottom: "1px solid " + D.border }}>
          <span style={{ fontFamily: mn, fontSize: 11, color: D.amber, letterSpacing: 0.6, padding: "2px 7px", border: "1px solid " + D.amber + "55", borderRadius: 4 }}>⌘K</span>
          <input
            autoFocus
            value={query}
            onChange={(e) => { setQuery(e.target.value); setCursor(0); }}
            onKeyDown={onKey}
            placeholder={'Search tasks, "/" for commands, "@" for filters…'}
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
                key={r.id + "-" + i} type="button"
                onMouseEnter={() => setCursor(i)}
                onClick={() => fire(i)}
                style={{
                  display: "flex", alignItems: "center", gap: 10, width: "100%",
                  padding: "9px 12px",
                  background: active ? "rgba(247,176,65,0.10)" : "transparent",
                  border: "none",
                  borderLeft: "2px solid " + (active ? r.color : "transparent"),
                  borderRadius: 6, cursor: "pointer", textAlign: "left",
                  fontFamily: ft, fontSize: 13, color: D.tx,
                }}
              >
                <span style={{
                  width: 18, height: 18, borderRadius: 4,
                  background: r.color + "22", border: "1px solid " + r.color + "55",
                  color: r.color, display: "inline-flex", alignItems: "center", justifyContent: "center",
                  fontFamily: mn, fontSize: 9, fontWeight: 800, flexShrink: 0,
                }}>{r.initial || (r.kind === "task" ? "T" : r.kind === "view" ? "V" : "•")}</span>
                <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.label}</span>
                <span style={{ fontFamily: mn, fontSize: 9, color: D.txd, letterSpacing: 0.5, flexShrink: 0 }}>{r.hint}</span>
              </button>
            );
          })}
        </div>
        <div style={{
          padding: "8px 14px", borderTop: "1px solid " + D.border,
          fontFamily: mn, fontSize: 9, color: D.txd, letterSpacing: 0.4,
          display: "flex", justifyContent: "space-between",
        }}>
          <span>{results.length} result{results.length === 1 ? "" : "s"}</span>
          <span>Type / for commands · @ for filters</span>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ═══════════════════════════════════════════════════════════════════
// BULK ACTION BAR (floating, appears when selection is non-empty)
// ═══════════════════════════════════════════════════════════════════

function BulkActionBar({
  count, onAssign, onPriority, onCategory, onDone, onDelete, onClear,
}: {
  count: number;
  onAssign: (a: string) => void;
  onPriority: (p: Priority) => void;
  onCategory: (c: string) => void;
  onDone: () => void;
  onDelete: () => void;
  onClear: () => void;
}) {
  if (typeof window === "undefined" || count === 0) return null;
  return createPortal(
    <div style={{
      position: "fixed", left: 0, right: 0, bottom: 24,
      display: "flex", justifyContent: "center", pointerEvents: "none", zIndex: 11000,
    }}>
      <div style={{
        pointerEvents: "auto", display: "flex", alignItems: "center", gap: 10,
        padding: "10px 14px", background: "#0A0A14",
        border: "1px solid " + D.amber + "55", borderRadius: 12,
        boxShadow: "0 24px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(247,176,65,0.08)",
        fontFamily: mn, fontSize: 11, letterSpacing: 0.3,
        animation: "tbRowIn 0.18s ease both",
        flexWrap: "wrap", maxWidth: "calc(100vw - 24px)", justifyContent: "center",
      }}>
        <span style={{
          color: D.amber, fontWeight: 700, padding: "3px 10px",
          background: D.amber + "1c", border: "1px solid " + D.amber + "55", borderRadius: 999,
        }}>{count} selected</span>

        <span style={{ color: D.txd, fontSize: 9 }}>assign</span>
        {ASSIGNEES.map((a) => (
          <button key={a} type="button" onClick={() => onAssign(a)} title={"Assign to " + a}
            style={{ background: "transparent", border: "none", padding: 0, cursor: "pointer", display: "inline-flex" }}>
            <Avatar name={a} size={22} />
          </button>
        ))}

        <span style={{ width: 1, height: 18, background: D.border, margin: "0 2px" }} />

        <span style={{ color: D.txd, fontSize: 9 }}>priority</span>
        {(["HIGH", "MEDIUM", "THIS WEEK", "ONGOING"] as Priority[]).map((p) => {
          const c = PRI_COLOR[p];
          return (
            <button key={p} type="button" onClick={() => onPriority(p)} title={"Priority " + p}
              style={{
                background: c + "1c", color: c, border: "1px solid " + c + "55",
                padding: "3px 8px", borderRadius: 4, fontFamily: mn, fontSize: 9,
                letterSpacing: 0.6, cursor: "pointer", fontWeight: 700, textTransform: "uppercase",
              }}>{p}</button>
          );
        })}

        <span style={{ width: 1, height: 18, background: D.border, margin: "0 2px" }} />

        <select
          onChange={(e) => { if (e.target.value) { onCategory(e.target.value); e.target.value = ""; } }}
          defaultValue=""
          style={{
            background: "transparent", color: D.txm, border: "1px solid " + D.border,
            padding: "4px 8px", borderRadius: 6, fontFamily: mn, fontSize: 10, cursor: "pointer",
          }}
        >
          <option value="" disabled>category…</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>

        <button type="button" onClick={onDone}
          style={{ background: "transparent", border: "1px solid " + D.teal + "55", color: D.teal,
                   padding: "5px 10px", borderRadius: 6, fontFamily: mn, fontSize: 10, cursor: "pointer", letterSpacing: 0.4 }}>
          ✓ Done
        </button>
        <button type="button" onClick={onDelete}
          style={{ background: "transparent", border: "1px solid " + D.coral + "55", color: D.coral,
                   padding: "5px 10px", borderRadius: 6, fontFamily: mn, fontSize: 10, cursor: "pointer", letterSpacing: 0.4 }}>
          Delete
        </button>
        <button type="button" onClick={onClear}
          style={{ background: "transparent", border: "1px solid " + D.border, color: D.txm,
                   padding: "5px 10px", borderRadius: 6, fontFamily: mn, fontSize: 10, cursor: "pointer", letterSpacing: 0.4 }}>
          Esc · clear
        </button>
      </div>
    </div>,
    document.body,
  );
}

// ═══════════════════════════════════════════════════════════════════
// FOCUS MODE (fullscreen overlay with timer)
// ═══════════════════════════════════════════════════════════════════

function FocusMode({
  task, onClose, onComplete, onNext, onPatch,
}: {
  task: Task;
  onClose: () => void;
  onComplete: () => void;
  onNext: () => void;
  onPatch: (patch: Partial<Task>) => void;
}) {
  const [secs, setSecs] = useState(25 * 60);
  const [running, setRunning] = useState(false);
  const pColor = PRI_COLOR[task.priority] || D.txd;
  const cColor = CAT_COLOR[task.category] || D.txd;
  const subtasks = task.subtasks || [];
  const doneSubs = subtasks.filter((s) => s.done).length;
  const mm = Math.floor(secs / 60);
  const ss = secs % 60;

  useEffect(() => {
    if (!running) return;
    if (secs <= 0) { setRunning(false); return; }
    const id = setTimeout(() => setSecs((s) => Math.max(0, s - 1)), 1000);
    return () => clearTimeout(id);
  }, [running, secs]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tgt = e.target as HTMLElement | null;
      if (tgt && (tgt.tagName === "INPUT" || tgt.tagName === "TEXTAREA")) return;
      if (e.key === " ") { e.preventDefault(); setRunning((r) => !r); }
      else if (e.key === "Enter") { e.preventDefault(); onComplete(); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onComplete]);

  function toggleSub(idx: number) {
    const next = subtasks.map((s, i) => i === idx ? { ...s, done: !s.done } : s);
    onPatch({ subtasks: next });
  }

  if (typeof window === "undefined") return null;
  return createPortal(
    <div style={{
      position: "fixed", inset: 0, zIndex: 12500, background: "rgba(6,6,12,0.94)",
      backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
    }}>
      <div style={{
        width: "min(720px, 96vw)", maxHeight: "calc(100vh - 48px)",
        overflowY: "auto", display: "flex", flexDirection: "column", gap: 22,
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontFamily: mn, fontSize: 10, color: D.amber, letterSpacing: 1.6, textTransform: "uppercase", fontWeight: 700 }}>
            Focus mode · <span style={{ color: cColor }}>{task.category}</span>
          </div>
          <button type="button" onClick={onClose}
            style={{ background: "transparent", border: "1px solid " + D.border, color: D.txm,
                     padding: "5px 12px", borderRadius: 6, fontFamily: mn, fontSize: 10, cursor: "pointer", letterSpacing: 0.6 }}>
            Esc · exit
          </button>
        </div>

        <div>
          <div style={{
            fontFamily: gf, fontSize: 36, fontWeight: 900, color: D.tx,
            letterSpacing: -1.4, lineHeight: 1.15, marginBottom: 8,
          }}>{task.title}</div>
          {task.description ? (
            <div style={{ fontFamily: ft, fontSize: 14.5, color: D.txm, lineHeight: 1.55 }}>{task.description}</div>
          ) : null}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
            <span style={{
              fontFamily: mn, fontSize: 10, color: pColor,
              background: pColor + "22", border: "1px solid " + pColor + "55",
              padding: "2px 8px", borderRadius: 4, letterSpacing: 0.6, fontWeight: 700, textTransform: "uppercase",
            }}>{task.priority}</span>
            {task.dueDate ? (
              <span style={{ fontFamily: mn, fontSize: 10, color: isOverdue(task) ? D.coral : D.txm, letterSpacing: 0.5 }}>
                Due {dueLabel(task.dueDate)}
              </span>
            ) : null}
          </div>
        </div>

        <div style={{
          display: "flex", alignItems: "center", gap: 18,
          padding: "12px 16px", background: D.surface, border: "1px solid " + D.border, borderRadius: 12,
        }}>
          <div style={{
            fontFamily: mn, fontSize: 36, fontWeight: 800,
            color: secs < 60 && running ? D.coral : D.tx,
            letterSpacing: 1, minWidth: 110,
          }}>
            {String(mm).padStart(2, "0")}:{String(ss).padStart(2, "0")}
          </div>
          <button type="button" onClick={() => setRunning((r) => !r)}
            style={{
              background: running ? D.coral + "22" : D.amber,
              color: running ? D.coral : "#060608",
              border: "1px solid " + (running ? D.coral + "55" : D.amber),
              padding: "9px 18px", borderRadius: 8, fontFamily: ft, fontSize: 13, fontWeight: 800,
              cursor: "pointer", letterSpacing: 0.3,
            }}>
            {running ? "⏸ Pause" : "▶ Start"}
          </button>
          <div style={{ display: "flex", gap: 4 }}>
            {[5, 15, 25, 50].map((m) => (
              <button key={m} type="button" onClick={() => { setSecs(m * 60); setRunning(false); }}
                style={{
                  padding: "5px 10px",
                  background: secs === m * 60 ? D.amber + "22" : "transparent",
                  color: secs === m * 60 ? D.amber : D.txm,
                  border: "1px solid " + (secs === m * 60 ? D.amber + "55" : D.border),
                  borderRadius: 5, fontFamily: mn, fontSize: 10, cursor: "pointer", letterSpacing: 0.4, fontWeight: 700,
                }}>{m}m</button>
            ))}
          </div>
          <span style={{ marginLeft: "auto", fontFamily: mn, fontSize: 9, color: D.txd, letterSpacing: 0.5 }}>
            Space ▷ toggle · Enter ▷ done
          </span>
        </div>

        {subtasks.length > 0 ? (
          <div style={{ background: D.surface, border: "1px solid " + D.border, borderRadius: 12, padding: "14px 18px" }}>
            <div style={{ fontFamily: mn, fontSize: 10, color: D.txd, letterSpacing: 1.2, textTransform: "uppercase", fontWeight: 700, marginBottom: 10 }}>
              Checklist · {doneSubs}/{subtasks.length}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {subtasks.map((s, i) => (
                <div key={i} onClick={() => toggleSub(i)}
                  style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }}>
                  <span style={{
                    width: 18, height: 18, borderRadius: 4,
                    background: s.done ? D.teal : "transparent",
                    border: "2px solid " + (s.done ? D.teal : D.border),
                    flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
                    color: "#060608", fontFamily: mn, fontSize: 12, fontWeight: 800,
                  }}>{s.done ? "✓" : ""}</span>
                  <span style={{
                    fontFamily: ft, fontSize: 15,
                    color: s.done ? D.txd : D.tx,
                    textDecoration: s.done ? "line-through" : "none", lineHeight: 1.4,
                  }}>{s.title}</span>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <button type="button" onClick={onComplete}
            style={{
              flex: 1, padding: "14px 20px", background: D.teal, color: "#060608",
              border: "none", borderRadius: 10, fontFamily: ft, fontSize: 15, fontWeight: 800,
              cursor: "pointer", letterSpacing: 0.4, boxShadow: "0 0 24px " + D.teal + "33",
            }}>
            ✓ Done &amp; Next
          </button>
          <button type="button" onClick={onNext}
            style={{
              padding: "14px 20px", background: "transparent", color: D.tx,
              border: "1px solid " + D.border, borderRadius: 10,
              fontFamily: ft, fontSize: 14, cursor: "pointer", letterSpacing: 0.3,
            }}>
            Skip
          </button>
          <button type="button" onClick={onClose}
            style={{
              padding: "14px 20px", background: "transparent", color: D.txm,
              border: "1px solid " + D.border, borderRadius: 10,
              fontFamily: ft, fontSize: 14, cursor: "pointer", letterSpacing: 0.3,
            }}>
            Exit
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ═══════════════════════════════════════════════════════════════════
// ACTIVITY LOG popover (right-side drawer)
// ═══════════════════════════════════════════════════════════════════

function ActivityLog({ entries, onClose }: { entries: ActivityEntry[]; onClose: () => void }) {
  if (typeof window === "undefined") return null;
  function timeAgo(ts: string): string {
    const ms = Date.now() - new Date(ts).getTime();
    if (ms < 60_000) return "just now";
    if (ms < 3_600_000) return Math.floor(ms / 60_000) + "m ago";
    if (ms < 86_400_000) return Math.floor(ms / 3_600_000) + "h ago";
    return Math.floor(ms / 86_400_000) + "d ago";
  }
  function colorFor(action: string): string {
    if (action.includes("done")) return D.teal;
    if (action.includes("delete")) return D.coral;
    if (action.includes("add")) return D.amber;
    if (action.includes("combine")) return D.blue;
    if (action.includes("bulk")) return D.violet;
    return D.txd;
  }
  return createPortal(
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, zIndex: 11500,
      background: "rgba(6,6,12,0.55)",
      backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)",
      display: "flex", justifyContent: "flex-end",
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: "min(420px, 92vw)", height: "100%",
        background: "#0A0A14", borderLeft: "1px solid " + D.border,
        display: "flex", flexDirection: "column",
        boxShadow: "-12px 0 32px rgba(0,0,0,0.5)",
      }}>
        <div style={{ display: "flex", alignItems: "center", padding: "14px 18px", borderBottom: "1px solid " + D.border }}>
          <span style={{ fontFamily: mn, fontSize: 10, color: D.amber, letterSpacing: 1.4, textTransform: "uppercase", fontWeight: 800 }}>● activity</span>
          <span style={{ marginLeft: "auto", fontFamily: mn, fontSize: 9.5, color: D.txd }}>{entries.length} entries</span>
          <button onClick={onClose} style={{
            marginLeft: 10, background: "transparent", border: "1px solid " + D.border,
            color: D.txm, padding: "4px 10px", borderRadius: 5,
            fontFamily: mn, fontSize: 10, cursor: "pointer", letterSpacing: 0.5,
          }}>Esc</button>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "8px 0" }}>
          {entries.length === 0 ? (
            <div style={{ padding: 40, textAlign: "center", fontFamily: mn, fontSize: 11, color: D.txd, letterSpacing: 0.4 }}>
              Nothing yet. Edits, completes, and merges will show up here.
            </div>
          ) : entries.map((e, i) => {
            const c = colorFor(e.action);
            return (
              <div key={i} style={{
                display: "grid", gridTemplateColumns: "auto 1fr auto",
                gap: 10, padding: "8px 18px",
                borderLeft: "2px solid " + c + "55",
                borderBottom: "1px solid " + D.border,
                alignItems: "center",
              }}>
                <span style={{
                  fontFamily: mn, fontSize: 8.5, color: c,
                  background: c + "1c", border: "1px solid " + c + "44",
                  padding: "2px 6px", borderRadius: 4,
                  letterSpacing: 0.6, textTransform: "uppercase", fontWeight: 800,
                }}>{e.action}</span>
                <span style={{
                  fontFamily: ft, fontSize: 12, color: D.tx, lineHeight: 1.3,
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>{e.label}</span>
                <span style={{ fontFamily: mn, fontSize: 9.5, color: D.txd, letterSpacing: 0.3 }}>{timeAgo(e.ts)}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ═══════════════════════════════════════════════════════════════════
// DAILY PLANNER — two-pane: unscheduled queue + hour buckets
// ═══════════════════════════════════════════════════════════════════

function PlannerHourBlock({ hour, tasks, onToggle }: {
  hour: number;
  tasks: Task[];
  onToggle: (id: string) => void;
}) {
  const drag = useDrag();
  const [over, setOver] = useState(false);
  const hrLabel = hour === 0 ? "12a" : hour === 12 ? "12p" : hour > 12 ? hour - 12 + "p" : hour + "a";
  const slotIso = todayIso() + "T" + String(hour).padStart(2, "0") + ":00:00";
  const isTarget = drag.draggingId !== null;
  return (
    <div
      onDragOver={isTarget ? (e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setOver(true); } : undefined}
      onDragLeave={isTarget ? () => setOver(false) : undefined}
      onDrop={isTarget ? (e) => {
        e.preventDefault();
        const id = e.dataTransfer.getData("text/plain");
        if (id) drag.applyPatch(id, { scheduledFor: slotIso });
        setOver(false);
        drag.endDrag();
      } : undefined}
      style={{
        display: "grid", gridTemplateColumns: "40px 1fr",
        gap: 8, padding: "6px 8px",
        borderTop: "1px solid " + D.border,
        background: over ? D.amber + "15" : "transparent",
        minHeight: 40,
        transition: "background 0.12s",
      }}
    >
      <span style={{ fontFamily: mn, fontSize: 10, color: D.txd, letterSpacing: 0.4, paddingTop: 6 }}>{hrLabel}</span>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {tasks.map((t) => (
          <QueueRow key={t.id} task={t} last onToggle={() => onToggle(t.id)} />
        ))}
        {tasks.length === 0 && over && (
          <div style={{ fontFamily: mn, fontSize: 10, color: D.amber, letterSpacing: 0.4, padding: "8px 4px", border: "1px dashed " + D.amber + "55", borderRadius: 5 }}>
            drop to schedule for {hrLabel}
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// EDIT DRAWER — right-side slide-in task detail panel
// ═══════════════════════════════════════════════════════════════════
// Replaces the old "click row → opens /board in a new tab" hop. Plane /
// Linear / Height all use a right-side drawer for fast in-context edits
// while keeping the board visible behind it. Auto-saves on blur.

function EditDrawer({
  task, onClose, onPatch, onDelete, onDuplicate, onFocus, onToggleDone,
}: {
  task: Task;
  onClose: () => void;
  onPatch: (patch: Partial<Task>) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onFocus: () => void;
  onToggleDone: () => void;
}) {
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description || "");
  const [newSubtask, setNewSubtask] = useState("");
  const pColor = PRI_COLOR[task.priority] || D.txd;
  const cColor = CAT_COLOR[task.category] || D.txd;
  const aColor = ASSIGNEE_COLOR[task.assignee || "Unassigned"] || D.txd;
  const subtasks = task.subtasks || [];
  const doneSubs = subtasks.filter((s) => s.done).length;

  // re-sync local fields when navigating to a different task in the drawer
  useEffect(() => {
    setTitle(task.title);
    setDescription(task.description || "");
  }, [task.id, task.title, task.description]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tgt = e.target as HTMLElement | null;
      const typing = tgt && (tgt.tagName === "INPUT" || tgt.tagName === "TEXTAREA" || tgt.isContentEditable);
      if (e.key === "Escape" && !typing) { e.preventDefault(); onClose(); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function commitTitle() {
    const next = title.trim();
    if (next && next !== task.title) onPatch({ title: next });
    else if (!next) setTitle(task.title);
  }
  function commitDescription() {
    if ((description || "") !== (task.description || "")) {
      onPatch({ description: description.trim() || undefined });
    }
  }
  function toggleSub(idx: number) {
    const next = subtasks.map((s, i) => i === idx ? { ...s, done: !s.done } : s);
    onPatch({ subtasks: next });
  }
  function deleteSub(idx: number) {
    const next = subtasks.filter((_, i) => i !== idx);
    onPatch({ subtasks: next });
  }
  function addSub() {
    const txt = newSubtask.trim();
    if (!txt) return;
    const next = [
      ...subtasks,
      { id: "s-" + Date.now() + "-" + Math.random().toString(36).slice(2, 5), title: txt },
    ];
    onPatch({ subtasks: next });
    setNewSubtask("");
  }

  if (typeof window === "undefined") return null;

  return createPortal(
    <>
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0, zIndex: 9500,
          background: "rgba(0,0,0,0.45)", backdropFilter: "blur(2px)",
          animation: "tbDrawerFade 0.18s ease-out",
        }}
      />
      <div
        style={{
          position: "fixed", top: 0, right: 0, bottom: 0,
          width: "min(520px, 100vw)", zIndex: 9600,
          background: D.bg, borderLeft: "1px solid " + D.border,
          boxShadow: "-22px 0 50px rgba(0,0,0,0.55)",
          display: "flex", flexDirection: "column",
          fontFamily: ft,
          animation: "tbDrawerSlide 0.22s cubic-bezier(0.16, 1, 0.3, 1)",
        }}
      >
        <style>{`
          @keyframes tbDrawerSlide { from { transform: translateX(100%); } to { transform: translateX(0); } }
          @keyframes tbDrawerFade { from { opacity: 0; } to { opacity: 1; } }
        `}</style>

        {/* Header */}
        <div style={{
          padding: "14px 18px",
          borderBottom: "1px solid " + D.border,
          display: "flex", alignItems: "center", gap: 10,
        }}>
          <div style={{ fontFamily: mn, fontSize: 10, color: D.amber, letterSpacing: 1.4, fontWeight: 700, textTransform: "uppercase" }}>
            Task · <span style={{ color: cColor }}>{task.category}</span>
          </div>
          <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
            <button
              type="button"
              onClick={onFocus}
              title="Open in Focus mode"
              style={{
                padding: "5px 10px", background: D.amber + "18",
                border: "1px solid " + D.amber + "55", color: D.amber,
                fontFamily: mn, fontSize: 10, fontWeight: 700, letterSpacing: 0.6,
                borderRadius: 6, cursor: "pointer",
              }}
            >◎ Focus</button>
            <button
              type="button"
              onClick={onClose}
              title="Close (Esc)"
              style={{
                background: "transparent", border: "1px solid " + D.border,
                color: D.txm, padding: "5px 12px", borderRadius: 6,
                fontFamily: mn, fontSize: 10, cursor: "pointer", letterSpacing: 0.6,
              }}
            >Esc · close</button>
          </div>
        </div>

        {/* Scrollable body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "18px 22px", display: "flex", flexDirection: "column", gap: 18 }}>
          {/* Title + done toggle */}
          <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
            <button
              type="button"
              onClick={onToggleDone}
              title={task.done ? "Reopen" : "Mark done"}
              style={{
                marginTop: 5, width: 22, height: 22, flexShrink: 0,
                background: task.done ? D.teal : "transparent",
                border: "1.5px solid " + (task.done ? D.teal : D.border),
                borderRadius: 6, cursor: "pointer",
                color: "#060608", fontFamily: mn, fontSize: 12, fontWeight: 900,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >{task.done ? "✓" : ""}</button>
            <textarea
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={commitTitle}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  (e.target as HTMLTextAreaElement).blur();
                }
              }}
              rows={1}
              style={{
                flex: 1, resize: "none",
                background: "transparent", border: "none", outline: "none",
                color: D.tx, fontFamily: gf, fontWeight: 900,
                fontSize: 24, lineHeight: 1.22, letterSpacing: -0.6,
                padding: 0, textDecoration: task.done ? "line-through" : "none",
                opacity: task.done ? 0.55 : 1,
              }}
            />
          </div>

          {/* Meta chips row */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <DrawerField label="Priority">
              <select
                value={task.priority}
                onChange={(e) => onPatch({ priority: e.target.value as Priority })}
                style={{
                  ...drawerSelectStyle,
                  color: pColor,
                  borderColor: pColor + "55",
                  background: pColor + "12",
                }}
              >
                {PRIORITY_ORDER.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </DrawerField>
            <DrawerField label="Category">
              <select
                value={task.category}
                onChange={(e) => onPatch({ category: e.target.value })}
                style={{
                  ...drawerSelectStyle,
                  color: cColor,
                  borderColor: cColor + "55",
                  background: cColor + "12",
                }}
              >
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </DrawerField>
            <DrawerField label="Assignee">
              <select
                value={task.assignee || "Unassigned"}
                onChange={(e) => onPatch({ assignee: e.target.value })}
                style={{
                  ...drawerSelectStyle,
                  color: aColor,
                  borderColor: aColor + "55",
                  background: aColor + "12",
                }}
              >
                {ASSIGNEES.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </DrawerField>
            <DrawerField label="Due date">
              <input
                type="date"
                value={task.dueDate || ""}
                onChange={(e) => onPatch({ dueDate: e.target.value || undefined })}
                style={drawerSelectStyle}
              />
            </DrawerField>
            <DrawerField label="Estimate (min)">
              <input
                type="number"
                min={0}
                step={15}
                value={task.estimateMins ?? 0}
                onChange={(e) => onPatch({ estimateMins: Number(e.target.value) || undefined })}
                style={drawerSelectStyle}
              />
            </DrawerField>
            <DrawerField label="Quick due">
              <div style={{ display: "flex", gap: 4 }}>
                {(() => {
                  // Next Monday: 7 days from now if today is Mon, else days until next Mon.
                  const now = new Date();
                  const dow = now.getDay(); // 0=Sun, 1=Mon, …
                  const daysToMon = ((1 - dow + 7) % 7) || 7;
                  const monIso = isoDate(new Date(Date.now() + daysToMon * 86400000));
                  return [
                    { l: "Today", iso: todayIso() },
                    { l: "Tmrw", iso: isoDate(new Date(Date.now() + 86400000)) },
                    { l: "Mon", iso: monIso },
                    { l: "Wk+", iso: isoDate(new Date(Date.now() + 7 * 86400000)) },
                  ].map((q) => (
                    <button
                      key={q.l}
                      type="button"
                      onClick={() => onPatch({ dueDate: q.iso })}
                      style={{
                        flex: 1, padding: "6px 4px",
                        background: task.dueDate === q.iso ? D.amber + "22" : D.surface,
                        border: "1px solid " + (task.dueDate === q.iso ? D.amber : D.border),
                        color: task.dueDate === q.iso ? D.amber : D.txm,
                        fontFamily: mn, fontSize: 10, fontWeight: 700, letterSpacing: 0.4,
                        borderRadius: 6, cursor: "pointer",
                      }}
                    >{q.l}</button>
                  ));
                })()}
                {task.dueDate && (
                  <button
                    type="button"
                    onClick={() => onPatch({ dueDate: undefined })}
                    title="Clear due date"
                    style={{
                      flex: "0 0 32px", padding: "6px 4px",
                      background: "transparent",
                      border: "1px solid " + D.border,
                      color: D.txd,
                      fontFamily: mn, fontSize: 11, fontWeight: 700,
                      borderRadius: 6, cursor: "pointer",
                    }}
                  >×</button>
                )}
              </div>
            </DrawerField>
          </div>

          {/* Description */}
          <DrawerField label="Notes">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onBlur={commitDescription}
              placeholder="Context, links, acceptance criteria…"
              rows={4}
              style={{
                width: "100%", padding: "10px 12px",
                background: D.surface, border: "1px solid " + D.border, borderRadius: 8,
                color: D.tx, fontFamily: ft, fontSize: 13, outline: "none",
                resize: "vertical", minHeight: 80, lineHeight: 1.5,
              }}
            />
          </DrawerField>

          {/* Subtasks */}
          <DrawerField label={`Subtasks${subtasks.length ? ` · ${doneSubs}/${subtasks.length}` : ""}`}>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {subtasks.map((s, i) => (
                <div
                  key={s.id}
                  style={{
                    display: "flex", alignItems: "center", gap: 8,
                    padding: "7px 10px",
                    background: D.surface, border: "1px solid " + D.border,
                    borderRadius: 7,
                  }}
                >
                  <button
                    type="button"
                    onClick={() => toggleSub(i)}
                    style={{
                      width: 16, height: 16, flexShrink: 0,
                      background: s.done ? D.teal : "transparent",
                      border: "1.5px solid " + (s.done ? D.teal : D.border),
                      borderRadius: 4, cursor: "pointer",
                      color: "#060608", fontFamily: mn, fontSize: 10, fontWeight: 900,
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}
                  >{s.done ? "✓" : ""}</button>
                  <span style={{
                    flex: 1, fontFamily: ft, fontSize: 13, color: D.tx,
                    textDecoration: s.done ? "line-through" : "none",
                    opacity: s.done ? 0.55 : 1,
                  }}>{s.title}</span>
                  <button
                    type="button"
                    onClick={() => deleteSub(i)}
                    title="Remove subtask"
                    style={{
                      background: "transparent", border: "none",
                      color: D.txd, padding: 2, cursor: "pointer",
                      fontFamily: mn, fontSize: 13, fontWeight: 700,
                    }}
                  >×</button>
                </div>
              ))}
              <div style={{ display: "flex", gap: 6 }}>
                <input
                  value={newSubtask}
                  onChange={(e) => setNewSubtask(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addSub(); } }}
                  placeholder="+ subtask…"
                  style={{
                    flex: 1, padding: "7px 10px",
                    background: D.surface, border: "1px dashed " + D.border, borderRadius: 7,
                    color: D.tx, fontFamily: ft, fontSize: 13, outline: "none",
                  }}
                />
                <button
                  type="button"
                  onClick={addSub}
                  disabled={!newSubtask.trim()}
                  style={{
                    padding: "7px 12px",
                    background: newSubtask.trim() ? D.amber + "22" : D.surface,
                    border: "1px solid " + (newSubtask.trim() ? D.amber + "55" : D.border),
                    color: newSubtask.trim() ? D.amber : D.txd,
                    fontFamily: mn, fontSize: 10, fontWeight: 700, letterSpacing: 0.6,
                    borderRadius: 6, cursor: newSubtask.trim() ? "pointer" : "not-allowed",
                  }}
                >ADD</button>
              </div>
            </div>
          </DrawerField>

          {/* Metadata footer */}
          <div style={{
            fontFamily: mn, fontSize: 10, color: D.txd, letterSpacing: 0.4,
            display: "flex", flexDirection: "column", gap: 3,
            padding: "10px 0 0", borderTop: "1px solid " + D.border,
          }}>
            <span>Added {new Date(task.addedAt).toLocaleString()}</span>
            {task.updatedAt && <span>Updated {new Date(task.updatedAt).toLocaleString()}</span>}
            {task.source && <span>Source · {task.source}</span>}
          </div>
        </div>

        {/* Footer actions */}
        <div style={{
          padding: "12px 18px", borderTop: "1px solid " + D.border,
          display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10,
        }}>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              onClick={onDelete}
              style={{
                padding: "8px 14px",
                background: "transparent", border: "1px solid " + D.coral + "55",
                color: D.coral, fontFamily: mn, fontSize: 11, fontWeight: 700, letterSpacing: 0.6,
                borderRadius: 7, cursor: "pointer",
              }}
            >⌫ Delete</button>
            <button
              type="button"
              onClick={onDuplicate}
              title="Clone this task — same category, priority, assignee, subtasks; opens new copy in drawer"
              style={{
                padding: "8px 14px",
                background: "transparent", border: "1px solid " + D.border,
                color: D.txm, fontFamily: mn, fontSize: 11, fontWeight: 700, letterSpacing: 0.6,
                borderRadius: 7, cursor: "pointer",
              }}
            >⎘ Duplicate</button>
          </div>
          <div style={{ fontFamily: mn, fontSize: 10, color: D.txd, letterSpacing: 0.4 }}>
            Auto-saved · {task.priority}
          </div>
        </div>
      </div>
    </>,
    document.body,
  );
}

const drawerSelectStyle: React.CSSProperties = {
  width: "100%", padding: "8px 10px",
  background: D.surface, border: "1px solid " + D.border, borderRadius: 7,
  color: D.tx, fontFamily: mn, fontSize: 11, fontWeight: 700, letterSpacing: 0.4,
  textTransform: "uppercase", outline: "none", cursor: "pointer",
};

function DrawerField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "block" }}>
      <div style={{
        fontFamily: mn, fontSize: 9.5, color: D.txd, letterSpacing: 0.8,
        fontWeight: 700, textTransform: "uppercase", marginBottom: 5,
      }}>{label}</div>
      {children}
    </label>
  );
}

// ═══════════════════════════════════════════════════════════════════
// SHORTCUTS OVERLAY — ? to view all keyboard shortcuts
// ═══════════════════════════════════════════════════════════════════

function ShortcutsOverlay({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" || e.key === "?") { e.preventDefault(); onClose(); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const groups: { title: string; rows: { keys: string[]; label: string }[] }[] = [
    {
      title: "Navigation",
      rows: [
        { keys: ["⌘", "K"], label: "Command palette" },
        { keys: ["?"], label: "This shortcuts panel" },
        { keys: ["Esc"], label: "Close any overlay" },
      ],
    },
    {
      title: "Tasks",
      rows: [
        { keys: ["Click row"], label: "Open task drawer" },
        { keys: ["Double-click"], label: "Focus mode" },
        { keys: ["Shift", "Click"], label: "Bulk-select" },
        { keys: ["⌘", "Click"], label: "Add to combine bucket" },
        { keys: ["F"], label: "Focus current task" },
      ],
    },
    {
      title: "Editing",
      rows: [
        { keys: ["⌘", "Z"], label: "Undo last change" },
        { keys: ["⌘", "Enter"], label: "Submit modal" },
        { keys: ["Space"], label: "Focus mode · play/pause timer" },
        { keys: ["Enter"], label: "Focus mode · mark done & next" },
      ],
    },
  ];

  if (typeof window === "undefined") return null;
  return createPortal(
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 13000,
        background: "rgba(6,6,12,0.78)", backdropFilter: "blur(8px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 24, fontFamily: ft,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(560px, 100%)", maxHeight: "86vh", overflowY: "auto",
          background: D.bg, border: "1px solid " + D.border, borderRadius: 16,
          boxShadow: "0 24px 60px rgba(0,0,0,0.55)",
          padding: "22px 24px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
          <div>
            <div style={{ fontFamily: mn, fontSize: 10, color: D.amber, letterSpacing: 1.4, fontWeight: 700, textTransform: "uppercase", marginBottom: 4 }}>
              Keyboard shortcuts
            </div>
            <h3 style={{ fontSize: 20, fontWeight: 800, margin: 0, color: D.tx, fontFamily: gf, letterSpacing: -0.4 }}>
              Move at terminal speed
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "transparent", border: "1px solid " + D.border,
              color: D.txm, padding: "5px 12px", borderRadius: 6,
              fontFamily: mn, fontSize: 10, cursor: "pointer", letterSpacing: 0.6,
            }}
          >Esc · close</button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {groups.map((g) => (
            <div key={g.title}>
              <div style={{
                fontFamily: mn, fontSize: 9.5, color: D.txd, letterSpacing: 0.8,
                fontWeight: 700, textTransform: "uppercase", marginBottom: 8,
              }}>{g.title}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {g.rows.map((r, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      padding: "7px 10px",
                      background: D.surface, border: "1px solid " + D.border, borderRadius: 7,
                    }}
                  >
                    <span style={{ fontFamily: ft, fontSize: 13, color: D.tx }}>{r.label}</span>
                    <span style={{ display: "flex", gap: 4 }}>
                      {r.keys.map((k, j) => (
                        <kbd
                          key={j}
                          style={{
                            padding: "3px 8px", background: D.bg,
                            border: "1px solid " + D.border, borderRadius: 5,
                            fontFamily: mn, fontSize: 10, fontWeight: 700,
                            color: D.amber, letterSpacing: 0.4,
                          }}
                        >{k}</kbd>
                      ))}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function DailyPlanner({ tasks, onToggle, onClose }: {
  tasks: Task[];
  onToggle: (id: string) => void;
  onClose: () => void;
}) {
  const drag = useDrag();
  const todayDate = todayIso();
  const todayTasks = tasks.filter((t) => !t.done && (
    t.scheduledFor?.startsWith(todayDate) || t.dueDate === todayDate
  ));
  const scheduled = todayTasks.filter((t) => !!t.scheduledFor);
  const unscheduledOpen = tasks.filter((t) => !t.done && !t.scheduledFor);

  const byHour = new Map<number, Task[]>();
  scheduled.forEach((t) => {
    const h = t.scheduledFor ? new Date(t.scheduledFor).getHours() : 9;
    const arr = byHour.get(h) || [];
    arr.push(t);
    byHour.set(h, arr);
  });

  const [unschedOver, setUnschedOver] = useState(false);

  return (
    <div style={{
      display: "grid", gridTemplateColumns: "minmax(260px, 1fr) 1.4fr",
      gap: 12, marginBottom: 18,
      background: D.card, border: "1px solid " + D.border, borderRadius: 12, overflow: "hidden",
    }}>
      <div
        onDragOver={drag.draggingId ? (e) => { e.preventDefault(); setUnschedOver(true); } : undefined}
        onDragLeave={drag.draggingId ? () => setUnschedOver(false) : undefined}
        onDrop={drag.draggingId ? (e) => {
          e.preventDefault();
          const id = e.dataTransfer.getData("text/plain");
          if (id) drag.applyPatch(id, { scheduledFor: undefined });
          setUnschedOver(false);
          drag.endDrag();
        } : undefined}
        style={{
          borderRight: "1px solid " + D.border,
          display: "flex", flexDirection: "column",
          background: unschedOver ? "rgba(247,176,65,0.06)" : "transparent",
          transition: "background 0.12s",
        }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderBottom: "1px solid " + D.border }}>
          <span style={{ fontFamily: mn, fontSize: 10, color: D.amber, letterSpacing: 1.4, textTransform: "uppercase", fontWeight: 800 }}>unscheduled</span>
          <span style={{ marginLeft: "auto", fontFamily: mn, fontSize: 9.5, color: D.txd }}>{unscheduledOpen.length}</span>
          <button onClick={onClose} style={{
            background: "transparent", border: "1px solid " + D.border, color: D.txm,
            padding: "3px 8px", borderRadius: 5, fontFamily: mn, fontSize: 9.5, cursor: "pointer", letterSpacing: 0.4,
          }}>close planner</button>
        </div>
        <div style={{ flex: 1, overflowY: "auto", maxHeight: 540 }}>
          {unscheduledOpen.length === 0 ? (
            <div style={{ padding: 24, fontFamily: mn, fontSize: 10.5, color: D.txd, letterSpacing: 0.4, textAlign: "center" }}>
              All tasks scheduled. Nice.
            </div>
          ) : unscheduledOpen.map((t, i) => (
            <QueueRow key={t.id} task={t} last={i === unscheduledOpen.length - 1} onToggle={() => onToggle(t.id)} />
          ))}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderBottom: "1px solid " + D.border }}>
          <span style={{ fontFamily: mn, fontSize: 10, color: D.amber, letterSpacing: 1.4, textTransform: "uppercase", fontWeight: 800 }}>today · timeline</span>
          <span style={{ marginLeft: "auto", fontFamily: mn, fontSize: 9.5, color: D.txd }}>{scheduled.length} scheduled</span>
        </div>
        <div style={{ flex: 1, overflowY: "auto", maxHeight: 540 }}>
          {Array.from({ length: 18 }).map((_, i) => {
            const h = i + 6;
            return <PlannerHourBlock key={h} hour={h} tasks={byHour.get(h) || []} onToggle={onToggle} />;
          })}
        </div>
      </div>
    </div>
  );
}

