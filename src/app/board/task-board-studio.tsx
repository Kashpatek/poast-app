"use client";

// Studio Task Board — the rebuilt full-screen surface.
//
// Reads + writes the same Supabase row as the legacy <AkashTodo />:
//   projects table → id "akash-todo-master", type "akash-todo"
// so the embedded summary card in POAST stays in sync.
//
// Visual: Amie / Height premium look — sidebar (workspaces, views,
// categories), gradient hero with greeting + stat tiles + week strip,
// "Hot Seat" card grid for urgent items, "Queue" table below.

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { D, ft, mn } from "../shared-constants";

// ─── types (mirror akash-todo schema) ───
type Priority = "HIGH" | "MEDIUM" | "THIS WEEK" | "ONGOING" | "DONE";

interface Subtask { id: string; title: string; done?: boolean }
interface NoteEntry { id: string; ts: string; author?: string; text: string }

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
  assignee?: string;
  subtasks?: Subtask[];
  scheduledFor?: string;
  estimateMins?: number;
  source?: "manual" | "prompt" | "image" | "quick" | "recurring";
  addedAt: string;
  updatedAt?: string;
  manualOrder?: number;
  recurrence?: "daily" | "weekly" | "monthly";
  recurrenceAnchor?: string;
  isRecurringTemplate?: boolean;
  recurringFrom?: string;
  lastSpawnedFor?: string;
  notesLog?: NoteEntry[];
}

interface Board { id: string; name: string; description?: string; tasks: Task[]; createdAt: string }
interface BoardArchive { boards: Board[]; activeId: string }

// ─── constants (mirrored to stay self-contained) ───
const CATEGORIES = [
  "GRAPHIC DESIGN", "MARKETING OPS", "VIDEO PRODUCTION", "BRAND / IDENTITY",
  "DEV / ACCESS", "CONTENT OPS", "PODCAST", "EVENTS", "RESEARCH", "ADMIN", "OTHER",
];
const CAT_COLOR: Record<string, string> = {
  "GRAPHIC DESIGN": D.amber, "MARKETING OPS": D.blue, "VIDEO PRODUCTION": D.coral,
  "BRAND / IDENTITY": D.violet, "DEV / ACCESS": D.cyan, "CONTENT OPS": D.teal,
  "PODCAST": D.crimson, "EVENTS": D.amber, "RESEARCH": D.blue,
  "ADMIN": D.txm, "OTHER": D.txd,
};
const PRIORITIES: Priority[] = ["HIGH", "MEDIUM", "THIS WEEK", "ONGOING", "DONE"];
const PRI_COLOR: Record<Priority, string> = {
  HIGH: D.coral, MEDIUM: D.amber, "THIS WEEK": D.blue, ONGOING: D.teal, DONE: D.txd,
};
const ASSIGNEES = [
  { id: "Akash", color: D.amber },
  { id: "Daksh", color: D.blue },
  { id: "Vansh", color: D.teal },
  { id: "Max", color: D.violet },
  { id: "Michelle", color: D.coral },
  { id: "Unassigned", color: D.txd },
];
const ASSIGNEE_COLOR: Record<string, string> = Object.fromEntries(ASSIGNEES.map((a) => [a.id, a.color]));

// ─── helpers ───
function startOfDay(d: Date): Date { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
function isoDate(d: Date): string { return d.toISOString().slice(0, 10); }
function todayIso() { return isoDate(startOfDay(new Date())); }
function tomorrowIso() { const d = startOfDay(new Date()); d.setDate(d.getDate() + 1); return isoDate(d); }

function isOverdue(t: Task): boolean {
  if (!t.dueDate || t.done) return false;
  return t.dueDate < todayIso();
}
function isToday(t: Task): boolean {
  return !!t.dueDate && t.dueDate === todayIso();
}
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
  if (days <= 6) {
    const wd = new Date(d + "T00:00:00").toLocaleDateString("en-US", { weekday: "short" });
    return wd;
  }
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// Match akash-todo's spawnDueRecurring so templates produce instances
// the same way the legacy surface does. Kept tight, no need to dedupe
// against templates — both surfaces run the same logic on load.
function periodBoundary(rec: "daily" | "weekly" | "monthly", anchor: Date, now: Date): string {
  const today = startOfDay(now);
  if (rec === "daily") return isoDate(today);
  if (rec === "weekly") {
    const wantDow = anchor.getDay();
    const d = new Date(today);
    const delta = (d.getDay() - wantDow + 7) % 7;
    d.setDate(d.getDate() - delta);
    return isoDate(d);
  }
  const wantDom = Math.min(anchor.getDate(), 28);
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
      subtasks: (t.subtasks || []).map((s, k) => ({ id: "s-" + Date.now() + "-" + k + "-" + Math.random().toString(36).slice(2, 6), title: s.title, done: false })),
    };
    out.push(inst);
    out[i] = { ...t, lastSpawnedFor: due };
  }
  return out;
}

// Greeting tuned by local hour.
function greeting(name: string): string {
  const h = new Date().getHours();
  if (h < 5) return "Still up, " + name + "?";
  if (h < 12) return "Good morning, " + name + ".";
  if (h < 17) return "Good afternoon, " + name + ".";
  if (h < 21) return "Good evening, " + name + ".";
  return "Late night, " + name + "?";
}

// ─── shared UI primitives ───
function Avatar({ name, size = 24 }: { name: string; size?: number }) {
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
      {done && (
        <svg width={size * 0.55} height={size * 0.55} viewBox="0 0 12 12" fill="none">
          <path d="M2 6.5L5 9.5L10 3.5" stroke="#0A0A0F" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  );
}

function CatPill({ cat, small = false }: { cat: string; small?: boolean }) {
  const c = CAT_COLOR[cat] || D.txd;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      padding: small ? "2px 8px" : "3px 10px",
      background: c + "14", border: "1px solid " + c + "30", borderRadius: 999,
      fontSize: small ? 10 : 11, color: c, fontWeight: 500, fontFamily: ft,
      whiteSpace: "nowrap",
    }}>
      <span style={{ width: 5, height: 5, background: c, borderRadius: 5 }} />{cat}
    </span>
  );
}

function PriPill({ pri }: { pri: Priority }) {
  const c = PRI_COLOR[pri];
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      padding: "2px 8px",
      border: "1px solid " + c + "55", borderRadius: 5,
      fontFamily: mn, fontSize: 10, color: c, fontWeight: 600, letterSpacing: 0.4,
    }}>
      <span style={{ width: 5, height: 5, background: c, borderRadius: 1 }} />{pri}
    </span>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Main component
// ═══════════════════════════════════════════════════════════════════
export default function TaskBoardStudio() {
  const [archive, setArchive] = useState<BoardArchive>({ boards: [], activeId: "" });
  const [loading, setLoading] = useState(true);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [view, setView] = useState<"today" | "upcoming" | "all" | "done">("today");
  const [catFilter, setCatFilter] = useState<string | null>(null);
  const [assigneeFilter, setAssigneeFilter] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const lastSavedRef = useRef<string>("");
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── load ──
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
      data.boards = data.boards.map((b) => ({ ...b, tasks: spawnDueRecurring(b.tasks) }));
      lastSavedRef.current = JSON.stringify(data);
      setArchive(data);
    } catch { /* tolerate */ }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── save (debounced) ──
  const saveArchive = useCallback(async (next: BoardArchive) => {
    setSaveState("saving");
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

  const activeBoard = archive.boards.find((b) => b.id === archive.activeId);
  const allTasks = useMemo(() => (activeBoard?.tasks || []).filter((t) => !t.isRecurringTemplate), [activeBoard]);

  // ── CRUD ──
  function updateActiveBoard(patch: (b: Board) => Board) {
    setArchive((cur) => {
      const id = cur.activeId; if (!id) return cur;
      const idx = cur.boards.findIndex((b) => b.id === id); if (idx < 0) return cur;
      const next = patch(cur.boards[idx]);
      const boards = cur.boards.slice();
      boards[idx] = next;
      return { ...cur, boards };
    });
  }

  function addTask(t: Omit<Task, "id" | "addedAt">) {
    const stamp = new Date().toISOString();
    const newT: Task = { ...t, id: "t-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6), addedAt: stamp };
    updateActiveBoard((b) => ({ ...b, tasks: [newT, ...b.tasks] }));
  }
  function updateTask(id: string, patch: Partial<Task>) {
    updateActiveBoard((b) => ({
      ...b,
      tasks: b.tasks.map((t) => t.id === id ? { ...t, ...patch, updatedAt: new Date().toISOString() } : t),
    }));
  }
  function removeTask(id: string) {
    updateActiveBoard((b) => ({ ...b, tasks: b.tasks.filter((t) => t.id !== id) }));
  }

  // ── derived: filtered view ──
  const filteredTasks = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allTasks.filter((t) => {
      if (view === "done") { if (!t.done) return false; }
      else { if (t.done) return false; }
      if (view === "today") {
        if (!isToday(t) && !isOverdue(t)) return false;
      } else if (view === "upcoming") {
        if (!t.dueDate || isOverdue(t)) return false;
      }
      if (catFilter && t.category !== catFilter) return false;
      if (assigneeFilter && (t.assignee || "Akash") !== assigneeFilter) return false;
      if (q) {
        const hay = (t.title + " " + (t.description || "") + " " + t.category).toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [allTasks, view, catFilter, assigneeFilter, search]);

  const hotSeat = useMemo(() => filteredTasks.filter((t) => isOverdue(t) || isToday(t)), [filteredTasks]);
  const queue = useMemo(() => filteredTasks.filter((t) => !isOverdue(t) && !isToday(t)), [filteredTasks]);

  // ── stats for hero tiles ──
  const stats = useMemo(() => {
    const open = allTasks.filter((t) => !t.done);
    return {
      overdue: open.filter(isOverdue).length,
      today: open.filter(isToday).length,
      week: open.filter((t) => t.priority === "THIS WEEK" || (t.dueDate && t.dueDate <= isoDate(new Date(Date.now() + 7 * 86400000)) && !isOverdue(t) && !isToday(t))).length,
      open: open.length,
    };
  }, [allTasks]);

  // category counts (over all tasks for sidebar)
  const catCounts = useMemo(() => {
    const m: Record<string, number> = {};
    allTasks.forEach((t) => { if (!t.done) m[t.category] = (m[t.category] || 0) + 1; });
    return m;
  }, [allTasks]);

  // ── week strip data ──
  const weekStrip = useMemo(() => {
    const today = startOfDay(new Date());
    const dow = today.getDay();
    const monday = new Date(today); monday.setDate(today.getDate() - ((dow + 6) % 7));
    const days: { date: Date; iso: string; label: string; isToday: boolean; count: number }[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday); d.setDate(monday.getDate() + i);
      const iso = isoDate(d);
      const count = allTasks.filter((t) => t.dueDate === iso && !t.done).length;
      days.push({ date: d, iso, label: d.toLocaleDateString("en-US", { weekday: "short" }), isToday: iso === todayIso(), count });
    }
    return days;
  }, [allTasks]);

  // ── editing task ──
  const editingTask = editingId ? allTasks.find((t) => t.id === editingId) : null;

  if (loading) {
    return (
      <div style={{ background: D.bg, color: D.tx, fontFamily: ft, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
          <div style={{ width: 38, height: 38, border: "2px solid " + D.border, borderTopColor: D.amber, borderRadius: 999, animation: "spin 0.9s linear infinite" }} />
          <div style={{ fontSize: 13, color: D.txm }}>Loading your board…</div>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: D.bg, color: D.tx, fontFamily: ft, minHeight: "100vh", display: "flex" }}>
      {/* SIDEBAR */}
      <aside style={{
        width: 248, padding: "20px 14px", borderRight: "1px solid " + D.border,
        flexShrink: 0, display: "flex", flexDirection: "column",
        position: "sticky", top: 0, height: "100vh", overflowY: "auto",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 22, padding: "0 6px" }}>
          <div style={{
            width: 32, height: 32, borderRadius: 9,
            background: "linear-gradient(135deg, " + D.amber + ", " + D.violet + ")",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#0A0A0F", fontWeight: 900, fontSize: 14,
          }}>S</div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700 }}>Studio</div>
            <div style={{ fontSize: 10.5, color: D.txd, fontFamily: mn, letterSpacing: 0.5 }}>{activeBoard?.name || "—"}</div>
          </div>
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 4, fontFamily: mn, fontSize: 9, color: saveState === "saving" ? D.amber : saveState === "saved" ? D.teal : saveState === "error" ? D.coral : D.txd }}>
            <span style={{ width: 5, height: 5, borderRadius: 5, background: saveState === "saving" ? D.amber : saveState === "saved" ? D.teal : saveState === "error" ? D.coral : D.txd }} />
            {saveState === "saving" ? "save" : saveState === "saved" ? "✓" : saveState === "error" ? "!" : "ok"}
          </div>
        </div>

        <button
          onClick={() => setAddOpen(true)}
          style={{
            padding: "10px 14px",
            background: "linear-gradient(135deg, " + D.amber + ", " + D.coral + ")",
            border: "none", borderRadius: 10, color: "#0A0A0F", fontWeight: 700,
            fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center",
            gap: 8, marginBottom: 16, fontFamily: ft,
          }}
        >
          <span style={{ fontSize: 16, fontWeight: 900 }}>+</span> New task
        </button>

        {/* search */}
        <div style={{
          margin: "0 0 16px", padding: "7px 11px",
          background: D.surface, border: "1px solid " + D.border, borderRadius: 8,
          display: "flex", alignItems: "center", gap: 9, color: D.txm, fontSize: 12,
        }}>
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
            <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.3" />
            <path d="M9.5 9.5L12.5 12.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search…"
            style={{
              flex: 1, background: "transparent", border: "none", outline: "none",
              color: D.tx, fontFamily: ft, fontSize: 13, minWidth: 0,
            }}
          />
        </div>

        {/* views */}
        {[
          { k: "today", l: "Today", n: stats.overdue + stats.today, c: D.amber, ic: "✦" },
          { k: "upcoming", l: "Upcoming", n: stats.week, c: D.blue, ic: "▤" },
          { k: "all", l: "All tasks", n: stats.open, c: D.txm, ic: "◍" },
          { k: "done", l: "Done", n: allTasks.filter((t) => t.done).length, c: D.teal, ic: "✓" },
        ].map((v) => (
          <div
            key={v.k}
            onClick={() => setView(v.k as typeof view)}
            style={{
              padding: "9px 11px", display: "flex", alignItems: "center", gap: 11,
              borderRadius: 8, marginBottom: 2, cursor: "pointer",
              background: view === v.k ? "rgba(247,176,65,0.08)" : "transparent",
              color: view === v.k ? D.tx : D.txm,
              fontSize: 13, fontWeight: view === v.k ? 600 : 400,
            }}
          >
            <span style={{ color: v.c, width: 14, textAlign: "center" }}>{v.ic}</span>
            <span>{v.l}</span>
            <span style={{ marginLeft: "auto", fontFamily: mn, fontSize: 10, color: D.txd }}>{v.n}</span>
          </div>
        ))}

        {/* categories */}
        <div style={{ fontSize: 10, fontWeight: 700, color: D.txd, letterSpacing: 1.5, margin: "24px 11px 10px", textTransform: "uppercase" }}>Categories</div>
        <div
          onClick={() => setCatFilter(null)}
          style={{ padding: "6px 11px", display: "flex", alignItems: "center", gap: 11, fontSize: 12.5, color: catFilter === null ? D.tx : D.txm, cursor: "pointer", borderRadius: 6, background: catFilter === null ? "rgba(255,255,255,0.03)" : "transparent" }}
        >
          <span style={{ width: 14, color: D.txd }}>·</span>
          <span>All categories</span>
        </div>
        {CATEGORIES.map((c) => {
          const n = catCounts[c] || 0;
          if (n === 0 && catFilter !== c) return null;
          const active = catFilter === c;
          return (
            <div
              key={c}
              onClick={() => setCatFilter(active ? null : c)}
              style={{ padding: "6px 11px", display: "flex", alignItems: "center", gap: 11, fontSize: 12.5, color: active ? D.tx : D.txm, cursor: "pointer", borderRadius: 6, background: active ? "rgba(255,255,255,0.03)" : "transparent" }}
            >
              <span style={{
                width: 14, height: 14, background: CAT_COLOR[c] + "20",
                border: "1px solid " + CAT_COLOR[c] + "60", borderRadius: 4,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <span style={{ width: 5, height: 5, background: CAT_COLOR[c], borderRadius: 5 }} />
              </span>
              <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c}</span>
              <span style={{ fontFamily: mn, fontSize: 10, color: D.txd }}>{n}</span>
            </div>
          );
        })}

        {/* assignees */}
        <div style={{ fontSize: 10, fontWeight: 700, color: D.txd, letterSpacing: 1.5, margin: "20px 11px 8px", textTransform: "uppercase" }}>Team</div>
        <div style={{ display: "flex", gap: 6, padding: "0 8px", flexWrap: "wrap" }}>
          {ASSIGNEES.map((a) => (
            <button
              key={a.id}
              onClick={() => setAssigneeFilter(assigneeFilter === a.id ? null : a.id)}
              title={a.id}
              style={{
                padding: 0, border: "none", background: "transparent",
                cursor: "pointer", opacity: !assigneeFilter || assigneeFilter === a.id ? 1 : 0.35,
                outline: assigneeFilter === a.id ? "2px solid " + D.amber : "none",
                outlineOffset: 2, borderRadius: 999,
              }}
            >
              <Avatar name={a.id} size={28} />
            </button>
          ))}
        </div>

        <div style={{ marginTop: "auto", padding: "12px 8px 0", borderTop: "1px solid " + D.border, display: "flex", alignItems: "center", gap: 10 }}>
          <Avatar name="Akash" size={30} />
          <div style={{ fontSize: 12, minWidth: 0 }}>
            <div style={{ fontWeight: 600 }}>Akash Patel</div>
            <div style={{ color: D.txd, fontSize: 10 }}>Director</div>
          </div>
          <a href="/" style={{ marginLeft: "auto", fontSize: 11, color: D.txm, textDecoration: "none" }}>← POAST</a>
        </div>
      </aside>

      {/* MAIN */}
      <main style={{ flex: 1, minWidth: 0, overflow: "auto" }}>
        {/* HERO */}
        <section style={{ position: "relative", padding: "42px 48px 30px", overflow: "hidden", borderBottom: "1px solid " + D.border }}>
          <div style={{
            position: "absolute", inset: 0,
            background: "radial-gradient(700px 400px at 92% -10%, rgba(247,176,65,0.12), transparent 60%), radial-gradient(500px 320px at -5% 110%, rgba(144,92,203,0.10), transparent 60%)",
            pointerEvents: "none",
          }} />
          <div style={{ position: "relative", display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 24, marginBottom: 28, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: 11, color: D.amber, letterSpacing: 1.5, fontWeight: 700, textTransform: "uppercase", marginBottom: 8 }}>
                {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
              </div>
              <h1 style={{ fontSize: 38, fontWeight: 800, letterSpacing: -1, margin: 0, marginBottom: 8, lineHeight: 1.1 }}>
                {greeting("Akash")}
              </h1>
              <div style={{ fontSize: 14, color: D.txm }}>
                {stats.overdue + stats.today === 0
                  ? "Nothing due today. Queue is yours to shape."
                  : `${stats.overdue + stats.today} thing${stats.overdue + stats.today === 1 ? "" : "s"} need${stats.overdue + stats.today === 1 ? "s" : ""} attention today.`}
                {stats.overdue > 0 && <span style={{ color: D.coral }}> {stats.overdue} already late.</span>}
              </div>
            </div>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              {[
                { l: "Overdue", v: stats.overdue, c: D.coral },
                { l: "Today", v: stats.today, c: D.amber },
                { l: "This week", v: stats.week, c: D.blue },
                { l: "Open", v: stats.open, c: D.teal },
              ].map((s) => (
                <div key={s.l} style={{
                  padding: "12px 18px", background: D.card,
                  border: "1px solid " + D.border, borderRadius: 11, minWidth: 96,
                }}>
                  <div style={{ fontSize: 10, color: D.txd, letterSpacing: 1, fontWeight: 600, textTransform: "uppercase", marginBottom: 5 }}>{s.l}</div>
                  <div style={{ fontSize: 26, fontWeight: 800, color: s.c, lineHeight: 1, letterSpacing: -0.5 }}>{s.v}</div>
                </div>
              ))}
            </div>
          </div>

          {/* WEEK STRIP */}
          <div style={{ position: "relative", display: "flex", gap: 8 }}>
            {weekStrip.map((d) => (
              <div key={d.iso} style={{
                flex: 1, padding: "12px 14px",
                background: d.isToday ? "rgba(247,176,65,0.10)" : D.card,
                border: "1px solid " + (d.isToday ? D.amber + "40" : D.border),
                borderRadius: 10, cursor: "pointer",
              }}>
                <div style={{
                  fontSize: 10, color: d.isToday ? D.amber : D.txd,
                  letterSpacing: 1, fontWeight: 700, textTransform: "uppercase", marginBottom: 4,
                }}>{d.label}</div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                  <span style={{
                    fontSize: 22, fontWeight: 700,
                    color: d.isToday ? D.tx : (d.date.getDay() === 0 || d.date.getDay() === 6 ? D.txm : D.tx),
                    letterSpacing: -0.5,
                  }}>{d.date.getDate()}</span>
                  {d.count > 0 && (
                    <span style={{
                      fontSize: 10, color: D.txm, fontFamily: mn,
                      padding: "2px 6px", background: D.surface, border: "1px solid " + D.border,
                      borderRadius: 999, marginLeft: "auto",
                    }}>{d.count}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* HOT SEAT */}
        {(view === "today" || view === "all") && hotSeat.length > 0 && (
          <section style={{ padding: "32px 48px 8px" }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 18 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Hot seat</h2>
              <span style={{ fontSize: 12, color: D.txd, fontFamily: mn }}>{hotSeat.length} item{hotSeat.length === 1 ? "" : "s"}</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 14 }}>
              {hotSeat.map((t) => (
                <HotSeatCard
                  key={t.id}
                  task={t}
                  onToggle={() => updateTask(t.id, { done: !t.done })}
                  onEdit={() => setEditingId(t.id)}
                />
              ))}
            </div>
          </section>
        )}

        {/* QUEUE */}
        <section style={{ padding: hotSeat.length > 0 ? "32px 48px 60px" : "32px 48px 60px" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 14 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>{view === "done" ? "Completed" : view === "upcoming" ? "Upcoming" : view === "today" ? "Queue" : "All tasks"}</h2>
            <span style={{ fontSize: 12, color: D.txd, fontFamily: mn }}>{(view === "today" ? queue : filteredTasks).length} item{(view === "today" ? queue : filteredTasks).length === 1 ? "" : "s"}</span>
            {(catFilter || assigneeFilter) && (
              <div style={{ display: "flex", gap: 6, marginLeft: 12 }}>
                {catFilter && (
                  <span style={{ fontSize: 11, color: D.amber, padding: "3px 9px", background: "rgba(247,176,65,0.10)", borderRadius: 999, display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer" }} onClick={() => setCatFilter(null)}>
                    {catFilter} <span>×</span>
                  </span>
                )}
                {assigneeFilter && (
                  <span style={{ fontSize: 11, color: D.amber, padding: "3px 9px", background: "rgba(247,176,65,0.10)", borderRadius: 999, display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer" }} onClick={() => setAssigneeFilter(null)}>
                    {assigneeFilter} <span>×</span>
                  </span>
                )}
              </div>
            )}
          </div>
          {(view === "today" ? queue : filteredTasks).length === 0 ? (
            <div style={{ padding: 40, background: D.card, border: "1px dashed " + D.border, borderRadius: 12, textAlign: "center", color: D.txm, fontSize: 14 }}>
              {view === "done" ? "Nothing completed yet." : view === "today" && hotSeat.length === 0 ? "Today is clear. Look at Upcoming?" : "No matching tasks."}
            </div>
          ) : (
            <div style={{ background: D.card, border: "1px solid " + D.border, borderRadius: 12, overflow: "hidden" }}>
              {(view === "today" ? queue : filteredTasks).map((t, i, arr) => (
                <QueueRow
                  key={t.id}
                  task={t}
                  isLast={i === arr.length - 1}
                  onToggle={() => updateTask(t.id, { done: !t.done })}
                  onEdit={() => setEditingId(t.id)}
                />
              ))}
            </div>
          )}
        </section>
      </main>

      {/* MODALS */}
      {editingTask && (
        <EditModal
          task={editingTask}
          onClose={() => setEditingId(null)}
          onSave={(patch) => { updateTask(editingTask.id, patch); setEditingId(null); }}
          onRemove={() => { removeTask(editingTask.id); setEditingId(null); }}
        />
      )}
      {addOpen && (
        <AddModal
          onClose={() => setAddOpen(false)}
          onAdd={(t) => { addTask(t); setAddOpen(false); }}
        />
      )}
    </div>
  );
}

// ─── Hot Seat card ───
function HotSeatCard({ task, onToggle, onEdit }: { task: Task; onToggle: () => void; onEdit: () => void }) {
  const overdue = isOverdue(task);
  const today = isToday(task);
  const subPct = task.subtasks && task.subtasks.length > 0
    ? task.subtasks.filter((s) => s.done).length / task.subtasks.length
    : 0;
  const subDone = task.subtasks?.filter((s) => s.done).length || 0;
  const subTotal = task.subtasks?.length || 0;
  return (
    <div
      onClick={onEdit}
      style={{
        position: "relative", padding: "20px 22px",
        background: D.card,
        border: "1px solid " + (overdue ? "rgba(224,99,71,0.30)" : D.border),
        borderRadius: 14, cursor: "pointer", overflow: "hidden",
        transition: "transform 0.15s, border-color 0.15s",
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = D.borderStrong || "rgba(255,255,255,0.10)"; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = overdue ? "rgba(224,99,71,0.30)" : D.border; }}
    >
      <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 3, background: CAT_COLOR[task.category] || D.txd }} />
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <StatusCircle done={task.done} onClick={onToggle} />
        <CatPill cat={task.category} small />
        {overdue && <span style={{ fontSize: 10.5, color: D.coral, fontWeight: 700, letterSpacing: 0.5, marginLeft: "auto" }}>● {dueLabel(task.dueDate).toUpperCase()}</span>}
        {today && !overdue && <span style={{ fontSize: 10.5, color: D.amber, fontWeight: 700, letterSpacing: 0.5, marginLeft: "auto" }}>● TODAY</span>}
      </div>
      <div style={{ fontSize: 15.5, fontWeight: 600, lineHeight: 1.35, color: D.tx, marginBottom: 12 }}>{task.title}</div>
      {task.description && (
        <div style={{ fontSize: 13, color: D.txm, lineHeight: 1.5, marginBottom: 14, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as const }}>
          {task.description}
        </div>
      )}
      {subTotal > 0 && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ height: 4, background: D.surface, borderRadius: 4, overflow: "hidden" }}>
            <div style={{ height: "100%", width: (subPct * 100) + "%", background: D.teal, borderRadius: 4, transition: "width 0.3s" }} />
          </div>
          <div style={{ fontSize: 10.5, color: D.txd, marginTop: 6, fontFamily: mn }}>{subDone} of {subTotal} steps</div>
        </div>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 10, paddingTop: 12, borderTop: "1px solid " + D.border }}>
        <Avatar name={task.assignee || "Akash"} size={24} />
        <span style={{ fontSize: 12.5, color: D.txm }}>{task.assignee || "Akash"}</span>
        <PriPill pri={task.priority} />
      </div>
    </div>
  );
}

// ─── Queue row ───
function QueueRow({ task, isLast, onToggle, onEdit }: { task: Task; isLast: boolean; onToggle: () => void; onEdit: () => void }) {
  return (
    <div
      onClick={onEdit}
      style={{
        padding: "13px 18px", display: "flex", alignItems: "center", gap: 12,
        borderBottom: isLast ? "none" : "1px solid " + D.border, cursor: "pointer",
        background: "transparent", transition: "background 0.12s",
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,0.02)"; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = "transparent"; }}
    >
      <StatusCircle done={task.done} onClick={onToggle} size={15} />
      <span style={{
        fontSize: 14, color: D.tx, flex: 1, fontWeight: 500, minWidth: 0,
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        textDecoration: task.done ? "line-through" : "none",
        opacity: task.done ? 0.55 : 1,
      }}>{task.title}</span>
      {task.subtasks && task.subtasks.length > 0 && (
        <span style={{ fontFamily: mn, fontSize: 10.5, color: D.txd }}>
          {task.subtasks.filter((s) => s.done).length}/{task.subtasks.length}
        </span>
      )}
      <CatPill cat={task.category} small />
      <PriPill pri={task.priority} />
      <span style={{
        fontSize: 11.5, color: isOverdue(task) ? D.coral : isToday(task) ? D.amber : D.txm,
        minWidth: 60, textAlign: "right", fontFamily: mn, fontWeight: isOverdue(task) ? 700 : 400,
      }}>{dueLabel(task.dueDate)}</span>
      <Avatar name={task.assignee || "Akash"} size={22} />
    </div>
  );
}

// ─── Edit modal ───
function ModalShell({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);
  if (!mounted) return null;
  return createPortal(
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, background: "rgba(6,6,12,0.72)",
        backdropFilter: "blur(8px)", zIndex: 12000,
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 24, overflowY: "auto",
      }}
    >
      <div onClick={(e) => e.stopPropagation()} style={{ width: "min(680px, 96vw)" }}>
        {children}
      </div>
    </div>,
    document.body,
  );
}

function EditModal({ task, onClose, onSave, onRemove }: { task: Task; onClose: () => void; onSave: (p: Partial<Task>) => void; onRemove: () => void }) {
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description || "");
  const [category, setCategory] = useState(task.category);
  const [priority, setPriority] = useState<Priority>(task.priority);
  const [assignee, setAssignee] = useState(task.assignee || "Akash");
  const [dueDate, setDueDate] = useState(task.dueDate || "");
  const [subtasks, setSubtasks] = useState<Subtask[]>(task.subtasks || []);
  const [newSub, setNewSub] = useState("");
  const [notes, setNotes] = useState(task.notes || "");

  function save() {
    onSave({
      title: title.trim() || task.title,
      description: description.trim() || undefined,
      category, priority, assignee,
      dueDate: dueDate || undefined,
      subtasks: subtasks.length > 0 ? subtasks : undefined,
      notes: notes.trim() || undefined,
    });
  }

  return (
    <ModalShell onClose={onClose}>
      <div style={{ background: "#0A0A14", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: "26px 28px 20px", maxHeight: "calc(100vh - 48px)", overflowY: "auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
          <CatPill cat={category} />
          <PriPill pri={priority} />
          <span style={{ marginLeft: "auto", fontFamily: mn, fontSize: 10, color: D.txd }}>{task.id}</span>
        </div>

        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          autoFocus
          style={{
            width: "100%", padding: "8px 0", marginBottom: 14,
            background: "transparent", border: "none", outline: "none",
            color: D.tx, fontFamily: ft, fontSize: 22, fontWeight: 700,
            borderBottom: "1px solid " + D.border, boxSizing: "border-box",
          }}
        />

        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Add a description…"
          rows={2}
          style={{
            width: "100%", padding: "8px 0", marginBottom: 18,
            background: "transparent", border: "none", outline: "none",
            color: D.tx, fontFamily: ft, fontSize: 14, lineHeight: 1.5,
            resize: "vertical", borderBottom: "1px solid " + D.border, boxSizing: "border-box",
          }}
        />

        {/* properties grid */}
        <div style={{ display: "grid", gridTemplateColumns: "100px 1fr", gap: "12px 16px", marginBottom: 20 }}>
          <Field label="Category">
            <select value={category} onChange={(e) => setCategory(e.target.value)} style={selectStyle}>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Priority">
            <select value={priority} onChange={(e) => setPriority(e.target.value as Priority)} style={selectStyle}>
              {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </Field>
          <Field label="Assignee">
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {ASSIGNEES.map((a) => (
                <button
                  key={a.id}
                  onClick={() => setAssignee(a.id)}
                  style={{
                    padding: "5px 10px", borderRadius: 999,
                    border: "1px solid " + (assignee === a.id ? a.color : D.border),
                    background: assignee === a.id ? a.color + "20" : "transparent",
                    color: assignee === a.id ? D.tx : D.txm,
                    fontSize: 12, cursor: "pointer", fontFamily: ft,
                    display: "inline-flex", alignItems: "center", gap: 6,
                  }}
                >
                  <Avatar name={a.id} size={18} />
                  {a.id}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Due date">
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} style={selectStyle} />
            <div style={{ display: "flex", gap: 5, marginTop: 6 }}>
              <button onClick={() => setDueDate(todayIso())} style={chipBtn}>Today</button>
              <button onClick={() => setDueDate(tomorrowIso())} style={chipBtn}>Tomorrow</button>
              <button onClick={() => setDueDate("")} style={chipBtn}>None</button>
            </div>
          </Field>
        </div>

        {/* subtasks */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, color: D.txm, fontWeight: 700, letterSpacing: 1, marginBottom: 8, textTransform: "uppercase" }}>Subtasks</div>
          {subtasks.map((s, i) => (
            <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "5px 0" }}>
              <StatusCircle done={s.done} size={14} onClick={() => setSubtasks(subtasks.map((x, k) => k === i ? { ...x, done: !x.done } : x))} />
              <input
                value={s.title}
                onChange={(e) => setSubtasks(subtasks.map((x, k) => k === i ? { ...x, title: e.target.value } : x))}
                style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: s.done ? D.txd : D.tx, fontFamily: ft, fontSize: 13.5, textDecoration: s.done ? "line-through" : "none" }}
              />
              <button onClick={() => setSubtasks(subtasks.filter((_, k) => k !== i))} style={{ background: "transparent", border: "none", color: D.txd, cursor: "pointer", fontSize: 14 }}>×</button>
            </div>
          ))}
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 4 }}>
            <span style={{ fontSize: 14, color: D.txd, paddingLeft: 1 }}>+</span>
            <input
              value={newSub}
              onChange={(e) => setNewSub(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && newSub.trim()) {
                  setSubtasks([...subtasks, { id: "s-" + Date.now(), title: newSub.trim(), done: false }]);
                  setNewSub("");
                }
              }}
              placeholder="Add a step…"
              style={{ flex: 1, padding: "5px 0", background: "transparent", border: "none", outline: "none", color: D.tx, fontFamily: ft, fontSize: 13.5 }}
            />
          </div>
        </div>

        {/* notes */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, color: D.txm, fontWeight: 700, letterSpacing: 1, marginBottom: 8, textTransform: "uppercase" }}>Notes</div>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Links, blockers, context…"
            style={{ width: "100%", padding: "8px 10px", background: D.surface, border: "1px solid " + D.border, borderRadius: 6, color: D.tx, fontFamily: ft, fontSize: 13, resize: "vertical", outline: "none", boxSizing: "border-box" }}
          />
        </div>

        {/* footer */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, paddingTop: 16, borderTop: "1px solid " + D.border }}>
          <button onClick={() => { if (confirm("Delete this task?")) onRemove(); }} style={{ background: "transparent", border: "1px solid " + D.coral + "60", color: D.coral, padding: "8px 14px", borderRadius: 8, fontSize: 12.5, fontFamily: ft, cursor: "pointer" }}>Delete</button>
          <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            <button onClick={onClose} style={{ background: "transparent", border: "1px solid " + D.border, color: D.tx, padding: "8px 14px", borderRadius: 8, fontSize: 12.5, fontFamily: ft, cursor: "pointer" }}>Cancel</button>
            <button onClick={save} style={{ background: D.amber, border: "none", color: "#0A0A0F", padding: "8px 16px", borderRadius: 8, fontSize: 12.5, fontFamily: ft, fontWeight: 700, cursor: "pointer" }}>Save</button>
          </div>
        </div>
      </div>
    </ModalShell>
  );
}

// ─── Add modal ───
function AddModal({ onClose, onAdd }: { onClose: () => void; onAdd: (t: Omit<Task, "id" | "addedAt">) => void }) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("GRAPHIC DESIGN");
  const [priority, setPriority] = useState<Priority>("MEDIUM");
  const [assignee, setAssignee] = useState("Akash");
  const [dueDate, setDueDate] = useState("");

  function submit() {
    if (!title.trim()) return;
    onAdd({ title: title.trim(), category, priority, assignee, dueDate: dueDate || undefined, source: "manual" });
  }

  return (
    <ModalShell onClose={onClose}>
      <div style={{ background: "#0A0A14", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: "26px 28px 20px" }}>
        <div style={{ fontSize: 14, color: D.txm, marginBottom: 14 }}>New task</div>
        <input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && title.trim()) submit(); }}
          placeholder="What needs doing?"
          style={{ width: "100%", padding: "10px 0", marginBottom: 18, background: "transparent", border: "none", outline: "none", color: D.tx, fontFamily: ft, fontSize: 20, fontWeight: 600, borderBottom: "1px solid " + D.border, boxSizing: "border-box" }}
        />
        <div style={{ display: "grid", gridTemplateColumns: "100px 1fr", gap: "12px 16px", marginBottom: 20 }}>
          <Field label="Category">
            <select value={category} onChange={(e) => setCategory(e.target.value)} style={selectStyle}>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Priority">
            <select value={priority} onChange={(e) => setPriority(e.target.value as Priority)} style={selectStyle}>
              {PRIORITIES.filter((p) => p !== "DONE").map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </Field>
          <Field label="Assignee">
            <select value={assignee} onChange={(e) => setAssignee(e.target.value)} style={selectStyle}>
              {ASSIGNEES.map((a) => <option key={a.id} value={a.id}>{a.id}</option>)}
            </select>
          </Field>
          <Field label="Due">
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} style={selectStyle} />
            <div style={{ display: "flex", gap: 5, marginTop: 6 }}>
              <button onClick={() => setDueDate(todayIso())} style={chipBtn}>Today</button>
              <button onClick={() => setDueDate(tomorrowIso())} style={chipBtn}>Tomorrow</button>
              <button onClick={() => setDueDate("")} style={chipBtn}>None</button>
            </div>
          </Field>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, paddingTop: 14, borderTop: "1px solid " + D.border }}>
          <button onClick={onClose} style={{ background: "transparent", border: "1px solid " + D.border, color: D.tx, padding: "8px 14px", borderRadius: 8, fontSize: 12.5, fontFamily: ft, cursor: "pointer" }}>Cancel</button>
          <button onClick={submit} style={{ background: D.amber, border: "none", color: "#0A0A0F", padding: "8px 18px", borderRadius: 8, fontSize: 12.5, fontFamily: ft, fontWeight: 700, cursor: "pointer" }}>Add task</button>
        </div>
      </div>
    </ModalShell>
  );
}

// ─── tiny styled bits ───
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <div style={{ fontSize: 11, color: D.txm, fontWeight: 600, letterSpacing: 0.5, textTransform: "uppercase", paddingTop: 6 }}>{label}</div>
      <div>{children}</div>
    </>
  );
}

const selectStyle: React.CSSProperties = {
  padding: "7px 10px", background: D.surface, border: "1px solid " + D.border,
  borderRadius: 6, color: D.tx, fontFamily: ft, fontSize: 13, outline: "none",
  minWidth: 200,
};

const chipBtn: React.CSSProperties = {
  padding: "3px 9px", background: "transparent", border: "1px solid " + D.border,
  borderRadius: 999, color: D.txm, fontFamily: ft, fontSize: 11, cursor: "pointer",
};
