"use client";
// Agenda Wizard — "I've got time, plan my day." Pick the tasks you want to work
// on (left), pull from a prioritized backlog (right), then either Build manually
// (packs them from now → your end-of-day around what's already scheduled) or let
// Claude auto-build the whole day. Either way it writes time-blocks onto the
// Agenda.
import React, { useEffect, useMemo, useState } from "react";
import { Wand2, Plus, X, Loader2, GripVertical, Clock } from "lucide-react";
import { D, ft, mn } from "../../shared-constants";
import { Modal, GhostBtn, PrimaryBtn } from "./modal";
import type { MarketingState } from "../use-marketing";
import type { BoardTaskLite } from "../marketing-constants";
import { useBoardTasks } from "../use-board-tasks";

const PRIORITY_RANK: Record<string, number> = { HIGH: 0, MEDIUM: 1, "THIS WEEK": 2, ONGOING: 3, DONE: 9 };
function startOfDay(d: Date) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
function toDateStr(d: Date) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }
function minsOfDay(d: Date) { return d.getHours() * 60 + d.getMinutes(); }
function parseHHMM(s: string) { const [h, m] = s.split(":").map(Number); return (h || 0) * 60 + (m || 0); }
function hhmm(min: number) { return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(Math.round(min % 60)).padStart(2, "0")}`; }
function isoAt(date: Date, min: number) { const d = new Date(date); d.setHours(Math.floor(min / 60), Math.round(min % 60), 0, 0); return d.toISOString(); }
function snap15(min: number) { return Math.round(min / 15) * 15; }

type Tab = "priority" | "due" | "category";

export default function AgendaWizard({ open, m, date, onClose, onOpenView }: {
  open: boolean;
  m: MarketingState;
  date: Date;
  onClose: () => void;
  onOpenView?: (v: string, focusId?: string) => void;
}) {
  const allTasks = useBoardTasks();
  const [endTime, setEndTime] = useState("18:00");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [tab, setTab] = useState<Tab>("priority");
  const [busy, setBusy] = useState<null | "manual" | "ai">(null);
  const [result, setResult] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => { if (open) { setSelectedIds([]); setResult(null); setErr(null); } }, [open]);

  const openTasks = useMemo(() => allTasks.filter((t) => !t.done), [allTasks]);
  const byId = useMemo(() => new Map(openTasks.map((t) => [t.id, t])), [openTasks]);
  const selected = selectedIds.map((id) => byId.get(id)).filter(Boolean) as BoardTaskLite[];

  const backlog = useMemo(() => {
    const pool = openTasks.filter((t) => !selectedIds.includes(t.id));
    const arr = [...pool];
    if (tab === "priority") arr.sort((a, b) => (PRIORITY_RANK[a.priority || "MEDIUM"] ?? 1) - (PRIORITY_RANK[b.priority || "MEDIUM"] ?? 1));
    else if (tab === "due") arr.sort((a, b) => (a.dueDate || "9999").localeCompare(b.dueDate || "9999"));
    else arr.sort((a, b) => (a.category || "ZZ").localeCompare(b.category || "ZZ"));
    return arr;
  }, [openTasks, selectedIds, tab]);

  const add = (id: string) => setSelectedIds((p) => p.includes(id) ? p : [...p, id]);
  const remove = (id: string) => setSelectedIds((p) => p.filter((x) => x !== id));

  // Existing blocks on this day → avoid overlap.
  function busySlots() {
    const dk = startOfDay(date).getTime();
    return m.events
      .filter((e) => startOfDay(new Date(e.start)).getTime() === dk && e.start)
      .map((e) => ({ start: minsOfDay(new Date(e.start)), end: e.end ? minsOfDay(new Date(e.end)) : minsOfDay(new Date(e.start)) + 30, title: e.title }))
      .sort((a, b) => a.start - b.start);
  }
  function startCursor() {
    const isToday = startOfDay(new Date()).getTime() === startOfDay(date).getTime();
    return snap15(Math.max(isToday ? minsOfDay(new Date()) + 5 : 9 * 60, 6 * 60));
  }

  function createBlock(title: string, startMin: number, endMin: number, taskId?: string) {
    m.addEvent({
      title, type: "manual", status: "scheduled",
      start: isoAt(date, startMin), end: isoAt(date, endMin),
      source: "poast", payload: { scheduleKind: "block", ...(taskId ? { sourceTaskId: taskId } : {}) },
    });
  }

  // ── Manual: pack selected tasks from the cursor to end, around busy slots ──
  function buildManual() {
    const list = selected.length ? selected : backlog.slice(0, 8);
    if (!list.length) { setErr("No tasks to schedule — add some on the Board first."); return; }
    setBusy("manual"); setErr(null); setResult(null);
    const end = parseHHMM(endTime);
    const slots = busySlots();
    let cursor = startCursor();
    let made = 0;
    const fits = (s: number, e: number) => !slots.some((b) => s < b.end && e > b.start);
    for (const t of list) {
      const dur = t.estimateMins && t.estimateMins > 0 ? Math.min(t.estimateMins, 180) : 45;
      // advance cursor past any conflict
      let guard = 0;
      while (cursor + dur <= end && !fits(cursor, cursor + dur) && guard < 200) {
        const hit = slots.find((b) => cursor < b.end && cursor + dur > b.start);
        cursor = hit ? snap15(hit.end + 5) : cursor + 15; guard++;
      }
      if (cursor + dur > end) break;
      createBlock(t.title, cursor, cursor + dur, t.id);
      slots.push({ start: cursor, end: cursor + dur, title: t.title });
      slots.sort((a, b) => a.start - b.start);
      cursor = snap15(cursor + dur + 10); // 10-min breather
      made++;
    }
    setBusy(null);
    setResult(made ? `Built ${made} block${made === 1 ? "" : "s"} into your day ✓` : "Couldn’t fit anything before your end time.");
    if (made) onOpenView?.("schedule");
  }

  // ── AI: let Claude build the whole day ──
  async function buildAI() {
    const list = selected.length ? selected : backlog.slice(0, 12);
    if (!list.length) { setErr("No tasks to plan — add some on the Board first."); return; }
    setBusy("ai"); setErr(null); setResult(null);
    try {
      const res = await fetch("/api/assistant/plan-day", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: toDateStr(date),
          startTime: hhmm(startCursor()),
          endTime,
          busy: busySlots().map((b) => ({ startTime: hhmm(b.start), endTime: hhmm(b.end), title: b.title })),
          tasks: list.map((t) => ({ id: t.id, title: t.title, estimateMins: t.estimateMins, priority: t.priority, subtasks: (t.subtasks || []).length })),
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Could not build a plan");
      const plan = Array.isArray(j.plan) ? j.plan : [];
      const slots = busySlots();
      let made = 0;
      for (const b of plan) {
        const s = parseHHMM(b.startTime), e = parseHHMM(b.endTime);
        if (isNaN(s) || isNaN(e) || e <= s) continue;
        if (slots.some((bz) => s < bz.end && e > bz.start)) continue; // never double-book
        createBlock(b.title, s, e, b.taskId);
        slots.push({ start: s, end: e, title: b.title });
        made++;
      }
      setResult(made ? `Claude built ${made} block${made === 1 ? "" : "s"} ✓ ${j.summary ? "· " + j.summary : ""}` : "The planner returned nothing to schedule.");
      if (made) onOpenView?.("schedule");
    } catch (e) {
      setErr(String(e instanceof Error ? e.message : e));
    } finally { setBusy(null); }
  }

  return (
    <Modal
      open={open} title="Plan my day" subtitle="Pick what to work on — build it yourself or let Claude lay out your day"
      accent={D.violet} icon={<Wand2 size={17} />} width={840} onClose={onClose}
      footer={<>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginRight: "auto", fontFamily: mn, fontSize: 11, color: D.txm }}>
          <Clock size={13} /> End my day at
          <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} style={{ background: D.card, border: `1px solid ${D.border}`, borderRadius: 7, color: D.tx, fontFamily: mn, fontSize: 12, padding: "5px 8px" }} />
        </div>
        <GhostBtn onClick={onClose}>Cancel</GhostBtn>
        <button onClick={buildManual} disabled={!!busy} style={{
          display: "inline-flex", alignItems: "center", gap: 6, cursor: busy ? "default" : "pointer", borderRadius: 9, padding: "9px 15px",
          border: `1px solid ${D.border}`, background: "transparent", color: D.tx, fontFamily: mn, fontSize: 11.5, opacity: busy ? 0.6 : 1,
        }}>{busy === "manual" ? <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> : <Plus size={13} />} Build my day</button>
        <PrimaryBtn onClick={buildAI} disabled={!!busy} accent={D.violet}>
          {busy === "ai" ? "Thinking…" : "✨ Auto-build with AI"}
        </PrimaryBtn>
      </>}
    >
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        {/* LEFT — working on */}
        <Col title="Working on" hint={selected.length ? `${selected.length} selected` : "drag or click tasks in"} accent={D.violet}
          onDrop={(id) => add(id)}>
          {selected.length === 0 && <Empty text="Nothing yet — pull tasks from the right." />}
          {selected.map((t) => (
            <Chip key={t.id} t={t} onAction={() => remove(t.id)} actionIcon={<X size={13} />} draggableId={t.id} />
          ))}
        </Col>

        {/* RIGHT — backlog */}
        <Col title="Backlog" accent={D.blue}
          tabs={<div style={{ display: "inline-flex", border: `1px solid ${D.border}`, borderRadius: 8, overflow: "hidden" }}>
            {(["priority", "due", "category"] as Tab[]).map((tb, i) => (
              <button key={tb} onClick={() => setTab(tb)} style={{
                fontFamily: mn, fontSize: 9.5, padding: "4px 9px", cursor: "pointer", border: "none",
                borderLeft: i ? `1px solid ${D.border}` : "none", textTransform: "capitalize",
                color: tab === tb ? D.tx : D.txm, background: tab === tb ? D.hover : "transparent",
              }}>{tb}</button>
            ))}
          </div>}>
          {backlog.length === 0 && <Empty text="No open tasks. Add some on the Board." />}
          {backlog.slice(0, 60).map((t) => (
            <Chip key={t.id} t={t} onAction={() => add(t.id)} actionIcon={<Plus size={13} />} draggableId={t.id} showMeta />
          ))}
        </Col>
      </div>

      {(result || err) && (
        <div style={{ marginTop: 12, fontFamily: mn, fontSize: 11.5, color: err ? D.coral : D.teal, border: `1px solid ${(err ? D.coral : D.teal)}44`, borderRadius: 8, padding: "9px 11px", background: (err ? D.coral : D.teal) + "10" }}>
          {err || result}
        </div>
      )}
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </Modal>
  );
}

function Col({ title, hint, accent, tabs, children, onDrop }: {
  title: string; hint?: string; accent: string; tabs?: React.ReactNode; children: React.ReactNode;
  onDrop?: (taskId: string) => void;
}) {
  const [over, setOver] = useState(false);
  return (
    <div
      onDragOver={onDrop ? (e) => { e.preventDefault(); setOver(true); } : undefined}
      onDragLeave={() => setOver(false)}
      onDrop={onDrop ? (e) => { e.preventDefault(); setOver(false); const id = e.dataTransfer.getData("application/x-wizard-task"); if (id) onDrop(id); } : undefined}
      style={{ border: `1px solid ${over ? accent + "88" : D.border}`, borderRadius: 12, background: over ? accent + "0c" : D.card, padding: "11px 11px", minHeight: 280, maxHeight: 420, overflow: "auto", transition: "all 0.12s" }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <span style={{ fontFamily: mn, fontSize: 9.5, letterSpacing: 0.6, textTransform: "uppercase", color: accent }}>{title}</span>
        {hint && <span style={{ fontFamily: mn, fontSize: 9, color: D.txd }}>{hint}</span>}
        <span style={{ flex: 1 }} />
        {tabs}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>{children}</div>
    </div>
  );
}

function Chip({ t, onAction, actionIcon, draggableId, showMeta }: {
  t: BoardTaskLite; onAction: () => void; actionIcon: React.ReactNode; draggableId: string; showMeta?: boolean;
}) {
  const pr = t.priority && t.priority !== "MEDIUM" ? t.priority : null;
  return (
    <div
      draggable
      onDragStart={(e) => { e.dataTransfer.setData("application/x-wizard-task", draggableId); e.dataTransfer.effectAllowed = "move"; }}
      style={{ display: "flex", alignItems: "center", gap: 7, padding: "7px 8px", borderRadius: 9, border: `1px solid ${D.border}`, background: D.cardGrad, cursor: "grab" }}
    >
      <GripVertical size={12} color={D.txd} style={{ flex: "none" }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: ft, fontSize: 12.5, color: D.tx, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.title}</div>
        {showMeta && (
          <div style={{ display: "flex", gap: 7, marginTop: 2, fontFamily: mn, fontSize: 8.5, color: D.txd }}>
            {pr && <span style={{ color: pr === "HIGH" ? D.coral : D.txm }}>{pr}</span>}
            {t.category && <span>{t.category}</span>}
            {t.estimateMins ? <span>{t.estimateMins}m</span> : null}
            {t.dueDate && <span>due {t.dueDate.slice(5)}</span>}
          </div>
        )}
      </div>
      <button onClick={onAction} style={{ width: 22, height: 22, borderRadius: 6, flex: "none", cursor: "pointer", border: `1px solid ${D.border}`, background: "transparent", color: D.txm, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
        {actionIcon}
      </button>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div style={{ fontFamily: mn, fontSize: 10.5, color: D.txd, padding: "14px 4px", textAlign: "center" }}>{text}</div>;
}
