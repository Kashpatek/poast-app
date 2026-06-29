"use client";
// MarketingSUITE · shared board-task store.
//
// One module-level store (useSyncExternalStore) so every surface — the Agenda
// rail, the in-campaign task panel, the sync reconciler — reads and writes the
// SAME task list. It is mode-aware, mirroring use-marketing:
//   • DEMO — an in-memory sandbox seeded by makeDemoBoardTasks. NEVER reads or
//     writes the real akash-todo-master board, so demo edits are 100% safe.
//   • LIVE — reads the real board (/api/db projects row) and persists edits via
//     /api/board-task (POST create, PATCH update). This is Akash's master board.
//
// The shell drives mode via boardSetMode(mode, owner) in an effect; views read
// through useBoardStore()/useBoardTasks(). Writes are gated to LIVE — in demo
// they only mutate the in-memory snapshot.
import { useSyncExternalStore } from "react";
import { readBoardTasks, makeDemoBoardTasks, type BoardTaskLite } from "./marketing-constants";

const ROW_ID = "akash-todo-master";
export type BoardMode = "demo" | "live";

interface BoardSnap {
  tasks: BoardTaskLite[];
  mode: BoardMode;
  owner: string;
  loaded: boolean;
}

let snap: BoardSnap = { tasks: [], mode: "demo", owner: "shared", loaded: false };
const listeners = new Set<() => void>();
// A fresh object each emit so getSnapshot's identity changes → subscribers rerun.
function emit(next: Partial<BoardSnap>) { snap = { ...snap, ...next }; listeners.forEach((l) => l()); }
function subscribe(l: () => void) { listeners.add(l); return () => { listeners.delete(l); }; }
function getSnapshot() { return snap; }
// Stable server snapshot (the suite is client-only, but the hook still requires it).
const SERVER_SNAP: BoardSnap = { tasks: [], mode: "demo", owner: "shared", loaded: false };
function getServerSnapshot() { return SERVER_SNAP; }

// Guards against races when the mode flips faster than a live fetch resolves.
let loadSeq = 0;

// Switch the store between the demo sandbox and the live board. Called by the
// shell whenever the suite's mode/owner changes.
export async function boardSetMode(mode: BoardMode, owner: string) {
  if (snap.loaded && snap.mode === mode && snap.owner === owner) return;
  const seq = ++loadSeq;
  if (mode === "demo") {
    // In-memory sandbox only — never touch the real board.
    emit({ mode, owner, tasks: makeDemoBoardTasks(new Date()), loaded: true });
    return;
  }
  emit({ mode, owner, loaded: false });
  try {
    const res = await fetch(`/api/db?table=projects&id=${ROW_ID}`);
    const j = await res.json();
    if (seq !== loadSeq) return; // superseded by a newer mode switch
    const arch = j?.data?.data;
    const out: BoardTaskLite[] = [];
    (arch?.boards || []).forEach((b: { tasks?: BoardTaskLite[] }) => (b.tasks || []).forEach((t) => out.push(t)));
    emit({ tasks: out, loaded: true });
  } catch {
    if (seq !== loadSeq) return;
    emit({ tasks: readBoardTasks(), loaded: true }); // fall back to local cache
  }
}

export function boardRefresh() { snap = { ...snap, loaded: false }; return boardSetMode(snap.mode, snap.owner); }

function genId() { return "t-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 6); }
const JSON_HEADERS = { "Content-Type": "application/json" };

// The subset of fields the POST create route accepts.
function createBody(t: BoardTaskLite) {
  return {
    title: t.title,
    category: t.category || "MARKETING OPS",
    priority: t.priority || "MEDIUM",
    assignee: t.assignee || "Akash",
    ...(t.description ? { description: t.description } : {}),
    ...(t.dueDate ? { dueDate: t.dueDate } : {}),
    ...(t.scheduledFor ? { scheduledFor: t.scheduledFor } : {}),
    ...(t.estimateMins ? { estimateMins: t.estimateMins } : {}),
    ...(t.marketingEventId ? { marketingEventId: t.marketingEventId } : {}),
    source: "marketing-suite",
  };
}

// Create a task. Optimistic in both modes; LIVE also POSTs and reconciles the
// server-assigned id, then PATCHes any rich fields (subtasks/notes) the create
// route doesn't accept. `onPersisted` fires with the FINAL task (real id) — in
// demo synchronously, in live after the POST resolves — so callers can back-link
// a marketing event to the correct id without racing the reconciliation.
export function boardCreateTask(
  input: Partial<BoardTaskLite> & { title: string },
  onPersisted?: (task: BoardTaskLite) => void,
): BoardTaskLite {
  const nowISO = new Date().toISOString();
  const t: BoardTaskLite = {
    category: "MARKETING OPS",
    priority: "MEDIUM",
    assignee: "Akash",
    ...input,
    id: input.id || genId(),
    title: input.title,
    addedAt: input.addedAt || nowISO,
    updatedAt: nowISO,
  };
  emit({ tasks: [t, ...snap.tasks] });
  if (snap.mode !== "live") { onPersisted?.(t); return t; }
  (async () => {
    let finalId = t.id;
    try {
      const res = await fetch("/api/board-task", { method: "POST", headers: JSON_HEADERS, body: JSON.stringify(createBody(t)) });
      const j = await res.json();
      const realId: string | undefined = j?.task?.id;
      if (realId && realId !== t.id) {
        finalId = realId;
        emit({ tasks: snap.tasks.map((x) => (x.id === t.id ? { ...x, id: realId } : x)) });
      }
      const rich: Partial<BoardTaskLite> = {};
      if (t.subtasks?.length) rich.subtasks = t.subtasks;
      if (t.notesLog?.length) rich.notesLog = t.notesLog;
      if (t.notes) rich.notes = t.notes;
      if (t.done) rich.done = t.done;
      if (Object.keys(rich).length) {
        await fetch("/api/board-task", { method: "PATCH", headers: JSON_HEADERS, body: JSON.stringify({ id: finalId, patch: rich }) });
      }
    } catch { /* best-effort */ }
    onPersisted?.({ ...t, id: finalId });
  })();
  return t;
}

// Update a task by its id OR its linked marketingEventId. Optimistic in both
// modes; LIVE also PATCHes the real board. Array fields in `patch` replace.
export function boardUpdateTask(idOrEventId: string, patch: Partial<BoardTaskLite>): BoardTaskLite | undefined {
  const nowISO = new Date().toISOString();
  let target: BoardTaskLite | undefined;
  emit({
    tasks: snap.tasks.map((t) => {
      if (t.id !== idOrEventId && t.marketingEventId !== idOrEventId) return t;
      target = { ...t, ...patch, updatedAt: nowISO };
      return target;
    }),
  });
  if (snap.mode === "live" && target) {
    const tgt = target;
    (async () => {
      try {
        await fetch("/api/board-task", {
          method: "PATCH", headers: JSON_HEADERS,
          body: JSON.stringify({ id: tgt.id, marketingEventId: tgt.marketingEventId, patch: { ...patch, updatedAt: nowISO } }),
        });
      } catch { /* best-effort */ }
    })();
  }
  return target;
}

export interface BoardStore {
  tasks: BoardTaskLite[];
  mode: BoardMode;
  loaded: boolean;
  createBoardTask: typeof boardCreateTask;
  updateBoardTask: typeof boardUpdateTask;
  refresh: typeof boardRefresh;
}

export function useBoardStore(): BoardStore {
  const s = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return {
    tasks: s.tasks, mode: s.mode, loaded: s.loaded,
    createBoardTask: boardCreateTask, updateBoardTask: boardUpdateTask, refresh: boardRefresh,
  };
}
