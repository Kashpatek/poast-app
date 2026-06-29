"use client";
// MarketingSUITE · the sync fabric.
//
// One reconciler that keeps board tasks and marketing events in lock-step so the
// whole suite reads as ONE intertwined surface (the user's ask: "in campaigns I
// should also be easily able to edit tasks, add notes, update the tracker… and
// it all be synced with tasks I have. Deadlines also are aligned to the calendar
// and the timeline plotline. It should all be in-sync").
//
// It does three things, all change-driven and loop-free:
//   1. PAIR SYNC — a task linked to an event (task.marketingEventId === event.id
//      OR event.payload.sourceTaskId === task.id) keeps its done-state and due
//      date aligned, both directions. Toggle the task done → the launch event on
//      the Calendar/Timeline goes done, and vice-versa.
//   2. DATED SUBTASKS → CALENDAR — give a subtask a due date and it surfaces on
//      the Calendar as "Project: subtask text" (the naming agent), linked back by
//      payload.subtaskId + subtask.spawnedEventId. Re-dating moves it; clearing
//      the date or deleting the subtask removes it.
//   3. Done/date stay two-way for those spawned subtask events too.
//
// Loop-free: a per-pair "last reconciled" signature in a ref. The FIRST time a
// pair is seen we only adopt the current state as the baseline (no propagation —
// pre-existing mismatches are the user's data, not ours to yank). From then on,
// only the side that actually CHANGED drives the other; after we write, the
// signature is advanced to the resolved value so the re-render it triggers is a
// no-op.
//
// Safe in DEMO: every mutator it calls (m.updateEvent / m.addEvent / m.moveEvent
// / m.removeEvent / boardUpdateTask) is mode-gated and only touches in-memory
// state in demo — so the reconciler is fully exercisable without writing the
// shared Neon DB or the akash-todo-master board.
import { useEffect, useRef } from "react";
import { projectEventTitle, type MarketingEvent, type BoardTaskLite } from "./marketing-constants";
import { useBoardStore, boardUpdateTask } from "./board-store";
import { resolveDefaultCalendarId } from "./use-google";
import type { MarketingState } from "./use-marketing";

type Sub = NonNullable<BoardTaskLite["subtasks"]>[number];

// Local Y-M-D for an ISO datetime (matches how board dueDate is stored — the
// board uses a timezone-shifted slice, so we mirror it to avoid off-by-one).
function localYMD(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10);
}
// Put a Y-M-D date onto an event, preserving the original time-of-day (so a
// deadline stays at 9a, a filming block keeps its hour) when there is one.
function dateWithTimeOf(ymd: string, baseISO?: string | null): string {
  const base = baseISO ? new Date(baseISO) : null;
  const [y, mo, da] = ymd.split("-").map(Number);
  const d = base && !isNaN(base.getTime()) ? new Date(base) : new Date();
  if (!base || isNaN(base.getTime())) d.setHours(9, 0, 0, 0);
  d.setFullYear(y, mo - 1, da);
  return d.toISOString();
}
const sameYMD = (a: string | null, b: string | null) => (a || null) === (b || null);

// The atom both pair-sync and subtask-sync reconcile over.
interface State { done: boolean; due: string | null }
interface Sig { eDone: boolean; eDue: string | null; tDone: boolean; tDue: string | null }
interface Plan {
  writeEvent: { done?: boolean; due?: string | null };
  writeTask: { done?: boolean; due?: string | null };
  sig: Sig;
}

// Pure core: given the last-reconciled signature and the current event/task
// state, decide what (if anything) to write to each side and the advanced
// signature. "event" = e, "task" = t (or a subtask + its spawned event).
function plan(last: Sig, e: State, t: State): Plan {
  const out: Plan = { writeEvent: {}, writeTask: {}, sig: { eDone: e.done, eDue: e.due, tDone: t.done, tDue: t.due } };
  // ── done ──
  if (e.done === t.done) {
    // already agree
  } else if (t.done !== last.tDone) {
    out.writeEvent.done = t.done; out.sig.eDone = t.done;       // task moved → event follows
  } else if (e.done !== last.eDone) {
    out.writeTask.done = e.done; out.sig.tDone = e.done;        // event moved → task follows
  } else {
    out.writeEvent.done = t.done; out.sig.eDone = t.done;       // disagree, neither moved → task wins
  }
  // ── due ──
  if (sameYMD(t.due, e.due)) {
    // already agree
  } else if (t.due !== last.tDue) {
    if (t.due) { out.writeEvent.due = t.due; out.sig.eDue = t.due; }  // task set/changed → move event
    // task cleared its date → leave the event where it is (don't delete a launch)
  } else if (e.due !== last.eDue) {
    out.writeTask.due = e.due; out.sig.tDue = e.due;            // event moved → set task due
  } else if (e.due) {
    out.writeTask.due = e.due; out.sig.tDue = e.due;            // disagree, neither moved → event wins
  }
  return out;
}

export function useSyncReconciler(m: MarketingState) {
  const { tasks } = useBoardStore();
  const pairSig = useRef<Map<string, Sig>>(new Map());
  const subSig = useRef<Map<string, Sig>>(new Map());
  // Subtask (taskId::subId) keys we've already minted an event for this pass-set,
  // so a double effect run before state settles can't double-spawn.
  const spawning = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (m.loading) return;
    const events = m.events;
    const evById = new Map(events.map((e) => [e.id, e] as const));
    const doneRevert = (e: MarketingEvent) => (e.payload?.unscheduled ? "idea" : "scheduled") as MarketingEvent["status"];

    // Batch subtask edits per task so multiple subtask writes in one pass don't
    // clobber each other (boardUpdateTask replaces the whole subtasks array).
    const pendingSubs = new Map<string, Sub[]>();
    const subsFor = (t: BoardTaskLite) => pendingSubs.get(t.id) || (t.subtasks ? t.subtasks.map((s) => ({ ...s })) : []);
    const setSub = (t: BoardTaskLite, id: string, patch: Partial<Sub>) => {
      const arr = subsFor(t).map((s) => (s.id === id ? { ...s, ...patch } : s));
      pendingSubs.set(t.id, arr);
    };

    // ── 1) PAIR SYNC (task ↔ its main event) ──
    for (const t of tasks) {
      // Resolve the linked event: explicit marketingEventId, else an event that
      // points back via sourceTaskId. Skip subtask-spawned events (handled below).
      let e: MarketingEvent | undefined = t.marketingEventId ? evById.get(t.marketingEventId) : undefined;
      if (!e) e = events.find((x) => x.payload?.sourceTaskId === t.id && !x.payload?.subtaskId);
      if (!e) continue;
      const key = t.id + "::" + e.id;
      const cur: Sig = { eDone: e.status === "done", eDue: localYMD(e.start), tDone: !!t.done, tDue: t.dueDate || null };
      const last = pairSig.current.get(key);
      if (!last) { pairSig.current.set(key, cur); continue; }       // first sight → adopt baseline
      const p = plan(last, { done: cur.eDone, due: cur.eDue }, { done: cur.tDone, due: cur.tDue });
      const evPatch: Partial<MarketingEvent> = {};
      if (p.writeEvent.done !== undefined) evPatch.status = p.writeEvent.done ? "done" : doneRevert(e);
      if (p.writeEvent.due) evPatch.start = dateWithTimeOf(p.writeEvent.due, e.start);
      if (Object.keys(evPatch).length) m.updateEvent(e.id, evPatch);
      const tPatch: Partial<BoardTaskLite> = {};
      if (p.writeTask.done !== undefined) tPatch.done = p.writeTask.done;
      if (p.writeTask.due !== undefined) tPatch.dueDate = p.writeTask.due || undefined;
      if (Object.keys(tPatch).length) boardUpdateTask(t.id, tPatch);
      pairSig.current.set(key, p.sig);
    }

    // ── 2) DATED SUBTASKS → CALENDAR (+ two-way done/date) ──
    const liveSpawnIds = new Set<string>();
    for (const t of tasks) {
      const subs = t.subtasks;
      if (!subs?.length) continue;
      const prefix = t.category || t.title;
      for (const s of subs) {
        const dated = !!s.dueDate;
        const ev = s.spawnedEventId ? evById.get(s.spawnedEventId) : undefined;

        // (a) dated, no live event yet → spawn "Prefix: subtask" on the calendar
        if (dated && !ev) {
          const spawnKey = t.id + "::" + s.id;
          if (spawning.current.has(spawnKey)) { if (s.spawnedEventId) liveSpawnIds.add(s.spawnedEventId); continue; }
          spawning.current.add(spawnKey);
          const created = m.addEvent({
            title: projectEventTitle(prefix, s.title),
            type: "manual", status: s.done ? "done" : "scheduled",
            start: dateWithTimeOf(s.dueDate!, null), end: null,
            campaignId: m.campaigns.find((c) => c.name === t.category)?.id ?? null,
            source: "poast", notes: null,
            // Honor the default calendar so dated subtasks land where everything
            // else does (Agenda/Calendar/Timeline lane), not just the fallback.
            payload: { scheduleKind: "deadline", sourceTaskId: t.id, subtaskId: s.id, calendarId: resolveDefaultCalendarId(m.owner) },
          });
          setSub(t, s.id, { spawnedEventId: created.id });
          subSig.current.set(created.id, { eDone: !!s.done, eDue: s.dueDate || null, tDone: !!s.done, tDue: s.dueDate || null });
          liveSpawnIds.add(created.id);
          continue;
        }

        // (b) had an event but the date was cleared → remove it + unlink
        if (!dated && s.spawnedEventId) {
          if (ev) m.removeEvent(s.spawnedEventId);
          subSig.current.delete(s.spawnedEventId);
          setSub(t, s.id, { spawnedEventId: undefined });
          spawning.current.delete(t.id + "::" + s.id);
          continue;
        }

        // (c) dated with a live event → keep title/done/date in sync, two-way
        if (dated && ev) {
          liveSpawnIds.add(ev.id);
          const wantTitle = projectEventTitle(prefix, s.title);
          if (ev.title !== wantTitle) m.updateEvent(ev.id, { title: wantTitle });
          const key = ev.id;
          const cur: Sig = { eDone: ev.status === "done", eDue: localYMD(ev.start), tDone: !!s.done, tDue: s.dueDate || null };
          const last = subSig.current.get(key);
          if (!last) { subSig.current.set(key, cur); continue; }
          const p = plan(last, { done: cur.eDone, due: cur.eDue }, { done: cur.tDone, due: cur.tDue });
          const evPatch: Partial<MarketingEvent> = {};
          if (p.writeEvent.done !== undefined) evPatch.status = p.writeEvent.done ? "done" : "scheduled";
          if (p.writeEvent.due) evPatch.start = dateWithTimeOf(p.writeEvent.due, ev.start);
          if (Object.keys(evPatch).length) m.updateEvent(ev.id, evPatch);
          if (p.writeTask.done !== undefined) setSub(t, s.id, { done: p.writeTask.done });
          if (p.writeTask.due !== undefined) setSub(t, s.id, { dueDate: p.writeTask.due || undefined });
          subSig.current.set(key, p.sig);
        }
      }
    }

    // ── 3) ORPHAN CLEANUP — a spawned subtask event whose subtask is gone ──
    for (const e of events) {
      const sid = e.payload?.subtaskId;
      if (typeof sid === "string" && sid && !liveSpawnIds.has(e.id)) {
        m.removeEvent(e.id);
        subSig.current.delete(e.id);
      }
    }

    // Flush batched subtask edits (one write per touched task).
    for (const [taskId, arr] of pendingSubs) boardUpdateTask(taskId, { subtasks: arr });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [m.events, tasks, m.loading]);
}
