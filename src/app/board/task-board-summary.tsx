"use client";

// Compact Task Board summary embedded inside POAST under the Tasks tab.
// Above the fold: gradient hero + stat tiles + hot seat cards.
// Below the fold: the FULL queue, grouped by priority — every open task,
// no truncation, mirroring the density of the legacy AkashTodo list view
// so scrolling shows everything you had before.
//
// Reads/writes the same Supabase row as /board (Studio), so edits in
// either surface round-trip. Polls every 20s for cross-tab sync.

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { D, ft, mn } from "../shared-constants";

// ─── types (same shape as akash-todo / task-board-studio) ───
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
}
interface Board { id: string; name: string; tasks: Task[]; createdAt: string }
interface BoardArchive { boards: Board[]; activeId: string }

const PRIORITY_ORDER: Priority[] = ["HIGH", "MEDIUM", "THIS WEEK", "ONGOING"];

const CAT_COLOR: Record<string, string> = {
  "GRAPHIC DESIGN": D.amber, "MARKETING OPS": D.coral, "VIDEO PRODUCTION": D.blue,
  "BRAND / IDENTITY": D.teal, "DEV / ACCESS": D.violet, "CONTENT OPS": D.cyan,
  "PODCAST": D.coral, "EVENTS": D.amber, "RESEARCH": D.blue,
  "ADMIN": D.violet, "OTHER": D.txd,
};
const PRI_COLOR: Record<Priority, string> = {
  HIGH: D.coral, MEDIUM: D.amber, "THIS WEEK": D.blue, ONGOING: D.txm, DONE: D.teal,
};
const ASSIGNEE_COLOR: Record<string, string> = {
  Akash: D.amber, Daksh: D.blue, Vansh: D.teal, Max: D.violet,
  Michelle: D.coral, Unassigned: D.txd,
};

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

// Match the AkashTodo planner default: tasks without an explicit
// estimate count as 30m so rollups never read "0" when the queue is
// real but unsized.
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

// Compact pill used for time estimates throughout — readable on both
// the dark hot seat cards and the lighter group headers.
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

// ═══════════════════════════════════════════════════════════════════
// SUMMARY
// ═══════════════════════════════════════════════════════════════════
export default function TaskBoardSummary() {
  const [archive, setArchive] = useState<BoardArchive>({ boards: [], activeId: "" });
  const [loading, setLoading] = useState(true);
  const [quickAdd, setQuickAdd] = useState("");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");

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

  // Cross-tab sync: refetch every 20s so edits in the full Studio
  // surface show up here without a manual refresh.
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
  const openTasks = useMemo(() => allTasks.filter((t) => !t.done), [allTasks]);

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

  function toggleDone(id: string) {
    updateActiveBoard((b) => ({
      ...b,
      tasks: b.tasks.map((t) => t.id === id ? { ...t, done: !t.done, updatedAt: new Date().toISOString() } : t),
    }));
  }

  function submitQuickAdd() {
    const txt = quickAdd.trim();
    if (!txt) return;
    const stamp = new Date().toISOString();
    const t: Task = {
      id: "t-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6),
      title: txt,
      category: "OTHER",
      priority: "MEDIUM",
      assignee: "Akash",
      addedAt: stamp,
      source: "quick",
    };
    updateActiveBoard((b) => ({ ...b, tasks: [t, ...b.tasks] }));
    setQuickAdd("");
  }

  // ── stats with time rollups ──
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

  // ── hot seat: overdue first (oldest first), then today ──
  const hotSeat = useMemo(() => [
    ...openTasks.filter(isOverdue).sort((a, b) => (a.dueDate || "").localeCompare(b.dueDate || "")),
    ...openTasks.filter(isToday),
  ].slice(0, 6), [openTasks]);

  // ── full queue, grouped by priority (HIGH → MEDIUM → THIS WEEK → ONGOING) ──
  // Within each group: pinned first, then by dueDate ascending (no date last),
  // then by addedAt newest. Mirrors AkashTodo list-view ordering closely
  // enough that scrolling here feels like the existing board.
  const queueGroups = useMemo(() => {
    const groups: { key: Priority; tasks: Task[] }[] = [];
    for (const p of PRIORITY_ORDER) {
      const tasks = openTasks.filter((t) => t.priority === p).sort((a, b) => {
        if (!!b.pinned !== !!a.pinned) return (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0);
        const ad = a.dueDate || "9999-12-31";
        const bd = b.dueDate || "9999-12-31";
        if (ad !== bd) return ad < bd ? -1 : 1;
        return (b.addedAt || "").localeCompare(a.addedAt || "");
      });
      if (tasks.length) groups.push({ key: p, tasks });
    }
    return groups;
  }, [openTasks]);

  const totalQueue = useMemo(() => ({
    n: openTasks.length,
    mins: sumMins(openTasks),
  }), [openTasks]);

  if (loading) {
    return (
      <div style={{ padding: 60, display: "flex", justifyContent: "center", alignItems: "center", color: D.txm, fontFamily: ft }}>
        <div style={{ width: 28, height: 28, border: "2px solid " + D.border, borderTopColor: D.amber, borderRadius: 999, animation: "spin 0.9s linear infinite" }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div style={{ padding: "20px 26px 60px", fontFamily: ft, color: D.tx, maxWidth: 1300, margin: "0 auto" }}>
      {/* HEADER */}
      <div style={{
        position: "relative", padding: "28px 32px 26px", marginBottom: 22,
        background: "linear-gradient(135deg, " + D.card + " 0%, " + D.surface + " 100%)",
        border: "1px solid " + D.border, borderRadius: 18, overflow: "hidden",
      }}>
        <div style={{
          position: "absolute", inset: 0, pointerEvents: "none",
          background: "radial-gradient(500px 280px at 90% -10%, rgba(247,176,65,0.12), transparent 60%), radial-gradient(380px 240px at -5% 110%, rgba(144,92,203,0.10), transparent 60%)",
        }} />
        <div style={{ position: "relative", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 24, flexWrap: "wrap", marginBottom: 22 }}>
          <div>
            <div style={{ fontSize: 10.5, color: D.amber, letterSpacing: 1.5, fontWeight: 700, textTransform: "uppercase", marginBottom: 6 }}>
              {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
            </div>
            <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: -0.8, margin: 0, marginBottom: 6, lineHeight: 1.15 }}>{greeting("Akash")}</h1>
            <div style={{ fontSize: 13.5, color: D.txm }}>
              {stats.overdue.n + stats.today.n === 0
                ? "Nothing due today. Queue is yours to shape."
                : `${stats.overdue.n + stats.today.n} thing${stats.overdue.n + stats.today.n === 1 ? "" : "s"} on the hot seat — ~${fmtMins(stats.overdue.mins + stats.today.mins)} of work.`}
              {stats.overdue.n > 0 && <span style={{ color: D.coral }}> {stats.overdue.n} already late.</span>}
            </div>
          </div>
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
            <span style={{ fontSize: 16 }}>✦</span> Open full board <span style={{ fontSize: 11 }}>↗</span>
          </a>
        </div>

        {/* stat tiles — each shows count + estimated workload */}
        <div style={{ position: "relative", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
          {[
            { l: "Overdue", v: stats.overdue.n, mins: stats.overdue.mins, c: D.coral },
            { l: "Today",   v: stats.today.n,   mins: stats.today.mins,   c: D.amber },
            { l: "This week", v: stats.week.n, mins: stats.week.mins, c: D.blue },
            { l: "Open total", v: stats.open.n, mins: stats.open.mins, c: D.teal },
            { l: "Done (7d)", v: stats.doneRecent.n, mins: stats.doneRecent.mins, c: D.violet },
          ].map((s) => (
            <div key={s.l} style={{ padding: "12px 16px", background: "rgba(255,255,255,0.02)", border: "1px solid " + D.border, borderRadius: 11 }}>
              <div style={{ fontSize: 10, color: D.txd, letterSpacing: 1, fontWeight: 600, textTransform: "uppercase", marginBottom: 5 }}>{s.l}</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                <div style={{ fontSize: 24, fontWeight: 800, color: s.c, lineHeight: 1, letterSpacing: -0.5 }}>{s.v}</div>
                <div style={{ fontFamily: mn, fontSize: 10.5, color: D.txd, letterSpacing: 0.3 }}>~{fmtMins(s.mins)}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* QUICK ADD */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", background: D.card, border: "1px solid " + D.border, borderRadius: 12, marginBottom: 22 }}>
        <span style={{ fontSize: 17, color: D.amber, fontWeight: 700 }}>+</span>
        <input
          value={quickAdd}
          onChange={(e) => setQuickAdd(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") submitQuickAdd(); }}
          placeholder="Capture a task… (Enter to add — opens in Studio with full edit)"
          style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: D.tx, fontFamily: ft, fontSize: 14 }}
        />
        {saveState !== "idle" && (
          <span style={{ fontSize: 10.5, color: saveState === "saved" ? D.teal : saveState === "saving" ? D.amber : D.coral, fontFamily: mn, letterSpacing: 0.5 }}>
            {saveState === "saved" ? "✓ saved" : saveState === "saving" ? "saving…" : "save failed"}
          </span>
        )}
      </div>

      {/* HOT SEAT */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 12 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>Hot seat</h2>
          <span style={{ fontSize: 11, color: D.txd, fontFamily: mn }}>{hotSeat.length} item{hotSeat.length === 1 ? "" : "s"}</span>
          {hotSeat.length > 0 && <TimePill mins={sumMins(hotSeat)} tone="warm" />}
          <a href="/board" target="_blank" rel="noopener" style={{ marginLeft: "auto", fontSize: 11.5, color: D.txm, textDecoration: "none" }}>View in Studio →</a>
        </div>

        {hotSeat.length === 0 ? (
          <div style={{ padding: 32, background: D.card, border: "1px dashed " + D.border, borderRadius: 12, textAlign: "center", color: D.txm, fontSize: 13.5 }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>✶</div>
            Nothing on fire. Today is clear.
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 10 }}>
            {hotSeat.map((t) => {
              const overdue = isOverdue(t);
              const today = isToday(t);
              return (
                <a
                  key={t.id}
                  href="/board"
                  target="_blank"
                  rel="noopener"
                  style={{
                    position: "relative", padding: "14px 16px",
                    background: D.card,
                    border: "1px solid " + (overdue ? "rgba(224,99,71,0.30)" : D.border),
                    borderRadius: 12, textDecoration: "none", color: "inherit",
                    display: "block",
                  }}
                >
                  <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 3, background: CAT_COLOR[t.category] || D.txd, borderRadius: "4px 0 0 4px" }} />
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                    <StatusCircle done={t.done} size={14} onClick={() => toggleDone(t.id)} />
                    <span style={{ fontSize: 10, color: CAT_COLOR[t.category] || D.txd, fontWeight: 600, letterSpacing: 0.5, textTransform: "uppercase" }}>{t.category}</span>
                    {overdue && <span style={{ marginLeft: "auto", fontSize: 10, color: D.coral, fontWeight: 700, letterSpacing: 0.5 }}>● {dueLabel(t.dueDate).toUpperCase()}</span>}
                    {today && !overdue && <span style={{ marginLeft: "auto", fontSize: 10, color: D.amber, fontWeight: 700, letterSpacing: 0.5 }}>● TODAY</span>}
                  </div>
                  <div style={{ fontSize: 13.5, fontWeight: 600, lineHeight: 1.35, color: D.tx, marginBottom: 10, textDecoration: t.done ? "line-through" : "none", opacity: t.done ? 0.6 : 1 }}>{t.title}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, paddingTop: 8, borderTop: "1px solid " + D.border }}>
                    <Avatar name={t.assignee || "Akash"} size={20} />
                    <span style={{ fontSize: 11.5, color: D.txm }}>{t.assignee || "Akash"}</span>
                    <TimePill mins={estOf(t)} />
                    <span style={{ marginLeft: "auto", fontSize: 10, color: PRI_COLOR[t.priority], fontFamily: mn, fontWeight: 600, padding: "2px 7px", border: "1px solid " + PRI_COLOR[t.priority] + "55", borderRadius: 5 }}>{t.priority}</span>
                  </div>
                </a>
              );
            })}
          </div>
        )}
      </div>

      {/* FULL QUEUE — grouped by priority, every open task. Scroll the
          page for everything; mirrors the legacy AkashTodo list view so
          nothing's hidden behind a "View more". */}
      <div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 14, paddingBottom: 10, borderBottom: "1px solid " + D.border }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>Full queue</h2>
          <span style={{ fontSize: 11, color: D.txd, fontFamily: mn }}>{totalQueue.n} open</span>
          {totalQueue.n > 0 && <TimePill mins={totalQueue.mins} tone="cool" />}
          <span style={{ marginLeft: "auto", fontSize: 11, color: D.txd, fontFamily: mn }}>
            grouped by priority · click a row to edit in Studio
          </span>
        </div>

        {queueGroups.length === 0 ? (
          <div style={{ padding: 36, background: D.card, border: "1px dashed " + D.border, borderRadius: 12, textAlign: "center", color: D.txm, fontSize: 13.5 }}>
            Queue is empty. Capture something above, or open the Studio board to plan the week.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
            {queueGroups.map(({ key, tasks }) => {
              const groupMins = sumMins(tasks);
              return (
                <div key={key}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                    <span style={{ width: 8, height: 8, borderRadius: 999, background: PRI_COLOR[key] }} />
                    <span style={{ fontFamily: mn, fontSize: 10, letterSpacing: 1.4, textTransform: "uppercase", color: PRI_COLOR[key], fontWeight: 700 }}>{key}</span>
                    <span style={{ fontFamily: mn, fontSize: 10, color: D.txd }}>{tasks.length}</span>
                    <TimePill mins={groupMins} />
                  </div>
                  <div style={{ background: D.card, border: "1px solid " + D.border, borderRadius: 12, overflow: "hidden" }}>
                    {tasks.map((t, i) => (
                      <QueueRow
                        key={t.id}
                        task={t}
                        last={i === tasks.length - 1}
                        onToggle={() => toggleDone(t.id)}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// Single dense row inside the full queue. Whole row is a link to /board
// so clicking sends you to the Studio with the task in context.
function QueueRow({ task, last, onToggle }: { task: Task; last: boolean; onToggle: () => void }) {
  const overdue = isOverdue(task);
  const today = isToday(task);
  const dueColor = overdue ? D.coral : today ? D.amber : D.txm;

  return (
    <a
      href="/board"
      target="_blank"
      rel="noopener"
      style={{
        display: "grid",
        gridTemplateColumns: "20px 1fr auto auto auto auto",
        alignItems: "center",
        gap: 12,
        padding: "10px 14px",
        borderBottom: last ? "none" : "1px solid " + D.border,
        textDecoration: "none", color: "inherit",
        background: overdue ? "rgba(224,99,71,0.04)" : "transparent",
      }}
    >
      <StatusCircle done={task.done} size={16} onClick={onToggle} />

      <div style={{ minWidth: 0, display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ width: 3, alignSelf: "stretch", background: CAT_COLOR[task.category] || D.txd, borderRadius: 3, flexShrink: 0 }} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{
            fontSize: 13.5, fontWeight: 500, color: D.tx, lineHeight: 1.3,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            textDecoration: task.done ? "line-through" : "none",
            opacity: task.done ? 0.5 : 1,
          }}>{task.title}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 3 }}>
            <span style={{ fontSize: 9.5, color: CAT_COLOR[task.category] || D.txd, fontWeight: 700, letterSpacing: 0.6, textTransform: "uppercase" }}>{task.category}</span>
            {task.subtasks && task.subtasks.length > 0 && (
              <span style={{ fontSize: 10, color: D.txd, fontFamily: mn }}>
                ⊟ {task.subtasks.filter((s) => s.done).length}/{task.subtasks.length}
              </span>
            )}
          </div>
        </div>
      </div>

      <TimePill mins={estOf(task)} />

      <span style={{
        fontFamily: mn, fontSize: 10.5, color: dueColor,
        padding: "3px 8px",
        border: "1px solid " + dueColor + "44",
        borderRadius: 5,
        whiteSpace: "nowrap",
        minWidth: 64, textAlign: "center",
      }}>{dueLabel(task.dueDate)}</span>

      <Avatar name={task.assignee || "Akash"} size={22} />

      <span style={{
        fontSize: 9.5, color: PRI_COLOR[task.priority], fontFamily: mn, fontWeight: 700,
        padding: "3px 8px",
        border: "1px solid " + PRI_COLOR[task.priority] + "55",
        borderRadius: 5,
        whiteSpace: "nowrap",
      }}>{task.priority}</span>
    </a>
  );
}
