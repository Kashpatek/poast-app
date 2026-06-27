"use client";
// MarketingSUITE · Agenda — the daily command surface (renamed from Schedule).
//
//   • DAY  — a beautiful morning→night time grid. Blocks sit at their real
//     times; a live NOW line sweeps the day and flags anything you've run past.
//     Click empty space to slot something; drag a block to re-time it; drag a
//     task in from the rail to block time for it.
//   • LIST — the forward day-planner (today + upcoming), grouped by day.
//
// "Plan my day" opens the Agenda Wizard (auto-builds your day from your tasks).
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarClock, Plus, ArrowRight, CalendarCheck, Rows3, ListChecks, Wand2,
  ChevronLeft, ChevronRight, Crosshair, GripVertical, AlertTriangle, Clock,
} from "lucide-react";
import { D, ft, gf, mn } from "../../shared-constants";
import {
  STATUS_COLOR, STATUS_LABEL, scheduleKindOf, channelOf, TYPE_COLOR,
  type MarketingEvent, type BoardTaskLite,
} from "../marketing-constants";
import type { ViewProps } from "../use-marketing";
import { useCreate } from "../create-context";
import { useBoardTasks } from "../use-board-tasks";
import GoogleCalendarsPanel from "../components/google-calendars";
import AgendaWizard from "../components/agenda-wizard";
import { useGoogle } from "../use-google";

// Day-grid geometry.
const START_HOUR = 6, END_HOUR = 23;          // 6am → 11pm
const HOUR_PX = 58;
const GUTTER_W = 62;
const SNAP = 15;                              // minute snap for slotting
const DAY_MS = 86_400_000;

function startOfDay(d: Date) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
function addDays(d: Date, n: number) { return new Date(d.getTime() + n * DAY_MS); }
function toDateStr(d: Date) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }
function fmtTime(d: Date) { return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }); }
function minsOfDay(d: Date) { return d.getHours() * 60 + d.getMinutes(); }
function yOfMin(min: number) { return ((min - START_HOUR * 60) / 60) * HOUR_PX; }
function minOfY(y: number) { return START_HOUR * 60 + (y / HOUR_PX) * 60; }
function snap(min: number) { return Math.round(min / SNAP) * SNAP; }
function clampMin(min: number) { return Math.max(START_HOUR * 60, Math.min(END_HOUR * 60, min)); }
function isoAt(date: Date, minutes: number) { const d = new Date(date); d.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0); return d.toISOString(); }
function hhmm(minutes: number) { const h = Math.floor(minutes / 60), m = Math.round(minutes % 60); return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`; }

export default function AgendaView({ m, onOpenView }: ViewProps) {
  const { openCreate } = useCreate();
  const [view, setView] = useState<"day" | "list">("day");
  const [date, setDate] = useState<Date>(() => startOfDay(new Date()));
  const [showCals, setShowCals] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [tick, setTick] = useState(0);
  useEffect(() => { const t = setInterval(() => setTick((n) => n + 1), 30_000); return () => clearInterval(t); }, []);

  // Surface the calendar panel by default while Google isn't connected yet, so
  // the Connect prompt is visible the moment you land on Agenda (auto-open once).
  const { status: gcalStatus, loading: gcalLoading } = useGoogle();
  const promptedCals = useRef(false);
  useEffect(() => {
    if (!gcalLoading && gcalStatus.configured && !gcalStatus.connected && !promptedCals.current) {
      promptedCals.current = true;
      setShowCals(true);
    }
  }, [gcalLoading, gcalStatus.configured, gcalStatus.connected]);
  const now = useMemo(() => new Date(), [tick]); // eslint-disable-line react-hooks/exhaustive-deps

  const isToday = startOfDay(now).getTime() === date.getTime();

  return (
    <div style={{ padding: "22px 26px 48px", fontFamily: ft, color: D.tx }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 16, marginBottom: 16, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 260 }}>
          <h1 style={{ margin: 0, fontFamily: gf, fontSize: 25, fontWeight: 700, letterSpacing: 0.3, display: "inline-flex", alignItems: "center", gap: 10 }}>
            <CalendarClock size={22} color={D.amber} /> Agenda
          </h1>
          <div style={{ marginTop: 6, fontSize: 13, color: D.txm, maxWidth: 620, lineHeight: 1.45 }}>
            Your day, blocked out morning to night. Slot tasks, drag to re-time, and let the wizard build the rest.
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" }}>
          <div style={{ display: "inline-flex", border: `1px solid ${D.border}`, borderRadius: 9, overflow: "hidden", background: D.card }}>
            <ModeBtn on={view === "day"} onClick={() => setView("day")} icon={<Rows3 size={12} />} label="Day" />
            <ModeBtn on={view === "list"} onClick={() => setView("list")} icon={<ListChecks size={12} />} label="List" left />
          </div>
          <button onClick={() => setWizardOpen(true)} title="Plan my day" style={{
            display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer", border: "none",
            fontFamily: mn, fontSize: 11, fontWeight: 700, letterSpacing: 0.3, borderRadius: 9, padding: "8px 14px",
            color: "#150a1c", background: `linear-gradient(135deg, ${D.violet}, ${D.violet}cc)`,
          }}>
            <Wand2 size={13} /> Plan my day
          </button>
          <button onClick={() => setShowCals((v) => !v)} title="Google Calendar" style={{
            display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer",
            fontFamily: mn, fontSize: 10.5, borderRadius: 9, padding: "8px 12px",
            border: `1px solid ${showCals ? D.teal + "66" : D.border}`, background: showCals ? D.teal + "14" : "transparent",
            color: showCals ? D.teal : D.txm,
          }}>
            <CalendarCheck size={13} /> Calendars
          </button>
          <button onClick={() => openCreate("schedule", { date: toDateStr(date) })} style={{
            display: "inline-flex", alignItems: "center", gap: 7, cursor: "pointer", border: "none",
            fontFamily: mn, fontSize: 11, fontWeight: 700, letterSpacing: 0.3, borderRadius: 9, padding: "8px 15px",
            color: "#15100a", background: `linear-gradient(135deg, ${D.amber}, ${D.amber}cc)`,
          }}>
            <Plus size={14} /> Schedule
          </button>
        </div>
      </div>

      {showCals && <div style={{ marginBottom: 14 }}><GoogleCalendarsPanel /></div>}

      {/* Day-nav (day view only) */}
      {view === "day" && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <button onClick={() => setDate((d) => addDays(d, -1))} style={navBtn}><ChevronLeft size={15} /></button>
          <button onClick={() => setDate(startOfDay(new Date()))} style={{ ...navBtn, width: "auto", padding: "0 13px", gap: 6, color: isToday ? D.amber : D.txm }}>
            <Crosshair size={12} /> Today
          </button>
          <button onClick={() => setDate((d) => addDays(d, 1))} style={navBtn}><ChevronRight size={15} /></button>
          <span style={{ fontFamily: gf, fontSize: 16, fontWeight: 700, marginLeft: 4, color: isToday ? D.amber : D.tx }}>
            {date.toLocaleDateString(undefined, { weekday: "long" })}
          </span>
          <span style={{ fontFamily: mn, fontSize: 11, color: D.txd }}>{date.toLocaleDateString(undefined, { month: "long", day: "numeric" })}</span>
        </div>
      )}

      {view === "day"
        ? <DayGrid m={m} date={date} now={now} isToday={isToday} openCreate={openCreate} />
        : <ListView m={m} now={now} openCreate={openCreate} />}

      <AgendaWizard open={wizardOpen} m={m} date={date} onClose={() => setWizardOpen(false)} onOpenView={onOpenView} />
    </div>
  );
}

// ════════ DAY GRID ════════
interface Placed { e: MarketingEvent; startMin: number; endMin: number; col: number; cols: number; }

function DayGrid({ m, date, now, isToday, openCreate }: {
  m: ViewProps["m"]; date: Date; now: Date; isToday: boolean;
  openCreate: (k: "schedule", pf?: Record<string, unknown>) => void;
}) {
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const [drag, setDrag] = useState<{ id: string; offMin: number } | null>(null);
  const [dragY, setDragY] = useState(0);

  const tasks = useBoardTasks();
  const dayKey = startOfDay(date).getTime();

  // Events on this day, with overlap columns.
  const placed = useMemo<Placed[]>(() => {
    const evs = m.events
      .filter((e) => startOfDay(new Date(e.start)).getTime() === dayKey)
      .map((e) => {
        const s = new Date(e.start);
        const startMin = clampMin(minsOfDay(s));
        const endMin = clampMin(e.end ? minsOfDay(new Date(e.end)) : startMin + 30);
        return { e, startMin, endMin: Math.max(endMin, startMin + 20) };
      })
      .sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin);
    // Column packing per overlap cluster (Google-calendar style).
    const out: Placed[] = [];
    let cluster: { p: Omit<Placed, "col" | "cols">; col: number }[] = [];
    let colsEnd: number[] = [];
    let clusterMaxEnd = -1;
    const flush = () => {
      const n = colsEnd.length || 1;
      cluster.forEach((c) => out.push({ ...c.p, col: c.col, cols: n }));
      cluster = []; colsEnd = []; clusterMaxEnd = -1;
    };
    for (const p of evs) {
      if (cluster.length && p.startMin >= clusterMaxEnd) flush();
      let col = colsEnd.findIndex((end) => end <= p.startMin);
      if (col === -1) { col = colsEnd.length; colsEnd.push(p.endMin); } else colsEnd[col] = p.endMin;
      cluster.push({ p, col });
      clusterMaxEnd = Math.max(clusterMaxEnd, p.endMin);
    }
    if (cluster.length) flush();
    return out;
  }, [m.events, dayKey]);

  const gridH = (END_HOUR - START_HOUR) * HOUR_PX;
  const nowMin = minsOfDay(now);
  const nowVisible = isToday && nowMin >= START_HOUR * 60 && nowMin <= END_HOUR * 60;

  // ── drag-to-reslot ──
  const onBlockPointerDown = (e: React.PointerEvent, p: Placed) => {
    e.preventDefault();
    const rect = canvasRef.current!.getBoundingClientRect();
    const y = e.clientY - rect.top;
    setDrag({ id: p.e.id, offMin: minOfY(y) - p.startMin });
    setDragY(y);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag) return;
    const rect = canvasRef.current!.getBoundingClientRect();
    setDragY(e.clientY - rect.top);
  };
  const onPointerUp = () => {
    if (!drag) return;
    const newStart = snap(clampMin(minOfY(dragY) - drag.offMin));
    m.moveEvent(drag.id, isoAt(date, newStart));
    setDrag(null);
  };

  // ── click empty → slot ──
  const onCanvasClick = (e: React.MouseEvent) => {
    if (drag) return;
    if ((e.target as HTMLElement).closest("[data-block]")) return;
    const rect = canvasRef.current!.getBoundingClientRect();
    const min = snap(clampMin(minOfY(e.clientY - rect.top)));
    openCreate("schedule", { date: toDateStr(date), startTime: hhmm(min) });
  };

  // ── drop a task from the rail ──
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const raw = e.dataTransfer.getData("application/x-task");
    if (!raw) return;
    const t = JSON.parse(raw) as BoardTaskLite;
    const rect = canvasRef.current!.getBoundingClientRect();
    const startMin = snap(clampMin(minOfY(e.clientY - rect.top)));
    const dur = t.estimateMins && t.estimateMins > 0 ? t.estimateMins : 30;
    m.addEvent({
      title: t.title, type: "manual", status: "scheduled",
      start: isoAt(date, startMin), end: isoAt(date, Math.min(END_HOUR * 60, startMin + dur)),
      source: "poast", payload: { scheduleKind: "block", sourceTaskId: t.id },
    });
  };

  return (
    <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
      {/* Grid */}
      <div style={{ flex: 1, minWidth: 0, border: `1px solid ${D.border}`, borderRadius: 14, background: D.cardGrad, overflow: "hidden" }}>
        <div
          ref={canvasRef}
          onClick={onCanvasClick}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; }}
          onDrop={onDrop}
          style={{ position: "relative", height: gridH, cursor: drag ? "grabbing" : "copy" }}
        >
          {/* Hour lines + labels */}
          {Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => {
            const hour = START_HOUR + i;
            const y = i * HOUR_PX;
            return (
              <React.Fragment key={hour}>
                <div style={{ position: "absolute", left: 0, right: 0, top: y, height: 1, background: "rgba(255,255,255,0.05)" }} />
                <div style={{ position: "absolute", left: 0, top: y - 6, width: GUTTER_W - 8, textAlign: "right", fontFamily: mn, fontSize: 9.5, color: D.txd }}>
                  {hour % 12 === 0 ? 12 : hour % 12}{hour < 12 ? "a" : "p"}
                </div>
              </React.Fragment>
            );
          })}
          {/* half-hour faint lines */}
          {Array.from({ length: END_HOUR - START_HOUR }, (_, i) => (
            <div key={"h" + i} style={{ position: "absolute", left: GUTTER_W, right: 0, top: i * HOUR_PX + HOUR_PX / 2, height: 1, background: "rgba(255,255,255,0.022)" }} />
          ))}

          {/* Blocks */}
          {placed.map((p) => (
            <DayBlock
              key={p.e.id} p={p} date={date} now={now} isToday={isToday}
              dragging={drag?.id === p.e.id} dragY={dragY} dragOff={drag?.offMin || 0}
              onPointerDown={onBlockPointerDown}
            />
          ))}

          {/* NOW line */}
          {nowVisible && (
            <div style={{ position: "absolute", left: GUTTER_W - 4, right: 0, top: yOfMin(nowMin), zIndex: 8, pointerEvents: "none" }}>
              <div style={{ position: "absolute", left: -2, top: -4, width: 8, height: 8, borderRadius: 999, background: D.coral, boxShadow: `0 0 10px ${D.coral}` }} />
              <div style={{ position: "absolute", left: 6, right: 0, top: 0, height: 2, background: `linear-gradient(90deg, ${D.coral}, ${D.coral}33)` }} />
              <span style={{ position: "absolute", right: 6, top: -8, fontFamily: mn, fontSize: 9, color: D.coral, background: D.bg, padding: "0 4px" }}>{fmtTime(now)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Task rail */}
      <TaskRail tasks={tasks} date={date} openCreate={openCreate} now={now} />
    </div>
  );
}

function DayBlock({ p, date, now, isToday, dragging, dragY, dragOff, onPointerDown }: {
  p: Placed; date: Date; now: Date; isToday: boolean;
  dragging: boolean; dragY: number; dragOff: number;
  onPointerDown: (e: React.PointerEvent, p: Placed) => void;
}) {
  const kindKey = typeof p.e.payload?.scheduleKind === "string" ? (p.e.payload.scheduleKind as string) : null;
  const kind = kindKey && kindKey !== "task" ? scheduleKindOf(kindKey) : null;
  const accent = kind?.color || TYPE_COLOR[p.e.type];
  const startMin = dragging ? snap(clampMin(minOfY(dragY) - dragOff)) : p.startMin;
  const dur = p.endMin - p.startMin;
  const top = yOfMin(startMin);
  const height = Math.max(22, (dur / 60) * HOUR_PX - 3);
  const colW = (100 - 1) / p.cols;
  const left = GUTTER_W + 4;
  const nowMin = minsOfDay(now);
  const overdue = isToday && nowMin > p.endMin && p.e.status !== "done";
  const live = isToday && nowMin >= startMin && nowMin < p.endMin;

  return (
    <div
      data-block
      onPointerDown={(e) => onPointerDown(e, p)}
      style={{
        position: "absolute",
        top, height,
        left: `calc(${left}px + ${p.col * colW}%)`,
        width: `calc(${colW}% - 8px)`,
        zIndex: dragging ? 20 : live ? 6 : 3,
        background: `linear-gradient(135deg, ${accent}2e, ${accent}14)`,
        border: `1px solid ${overdue ? D.coral : accent}${live ? "" : "66"}`,
        borderLeft: `3px solid ${overdue ? D.coral : accent}`,
        borderRadius: 8, padding: "4px 8px", cursor: "grab", overflow: "hidden",
        boxShadow: dragging ? `0 10px 26px rgba(0,0,0,0.5)` : live ? `0 0 16px ${accent}44` : "none",
        userSelect: "none", touchAction: "none",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
        {live && <span style={{ width: 6, height: 6, borderRadius: 999, background: D.teal, boxShadow: `0 0 6px ${D.teal}`, flex: "none" }} />}
        {overdue && <AlertTriangle size={11} color={D.coral} style={{ flex: "none" }} />}
        <span style={{ fontFamily: ft, fontSize: 12, fontWeight: 600, color: D.tx, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.e.title}</span>
      </div>
      {height > 34 && (
        <div style={{ fontFamily: mn, fontSize: 9.5, color: overdue ? D.coral : D.txm, marginTop: 2 }}>
          {hhmmLabel(startMin)}–{hhmmLabel(p.endMin)}{kind ? ` · ${kind.label}` : ""}{overdue ? " · overran" : live ? " · live" : ""}
        </div>
      )}
    </div>
  );
}
function hhmmLabel(min: number) { const h = Math.floor(min / 60), m = Math.round(min % 60); const ap = h < 12 ? "a" : "p"; const h12 = h % 12 === 0 ? 12 : h % 12; return m === 0 ? `${h12}${ap}` : `${h12}:${String(m).padStart(2, "0")}${ap}`; }

// ════════ TASK RAIL ════════
function TaskRail({ tasks, date, openCreate, now }: {
  tasks: BoardTaskLite[]; date: Date; now: Date;
  openCreate: (k: "schedule", pf?: Record<string, unknown>) => void;
}) {
  const open = tasks.filter((t) => !t.done).slice(0, 40);
  const nextSlot = () => {
    const base = startOfDay(now).getTime() === startOfDay(date).getTime() ? Math.max(minsOfDay(now) + 5, START_HOUR * 60) : START_HOUR * 60 + 9 * 60;
    return hhmm(snap(clampMin(base)));
  };
  return (
    <div style={{ width: 244, flex: "none", border: `1px solid ${D.border}`, borderRadius: 14, background: D.cardGrad, padding: "12px 12px", maxHeight: (END_HOUR - START_HOUR) * HOUR_PX, overflow: "auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 10 }}>
        <ListChecks size={13} color={D.blue} />
        <span style={{ fontFamily: mn, fontSize: 9.5, letterSpacing: 0.6, textTransform: "uppercase", color: D.blue }}>Tasks · drag to slot</span>
      </div>
      {open.length === 0 && <div style={{ fontFamily: mn, fontSize: 10.5, color: D.txd, padding: "8px 2px" }}>No open tasks. Add some on the Board.</div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {open.map((t) => (
          <div
            key={t.id}
            draggable
            onDragStart={(e) => { e.dataTransfer.setData("application/x-task", JSON.stringify(t)); e.dataTransfer.effectAllowed = "copy"; }}
            onClick={() => openCreate("schedule", { title: t.title, date: toDateStr(date), startTime: nextSlot() })}
            title="Drag onto the grid, or click to slot at the next free time"
            style={{ display: "flex", alignItems: "center", gap: 7, padding: "7px 8px", borderRadius: 9, border: `1px solid ${D.border}`, background: D.card, cursor: "grab" }}
          >
            <GripVertical size={13} color={D.txd} style={{ flex: "none" }} />
            <span style={{ fontFamily: ft, fontSize: 12.5, color: D.tx, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.title}</span>
            {t.estimateMins ? <span style={{ marginLeft: "auto", fontFamily: mn, fontSize: 8.5, color: D.txd, flex: "none" }}>{t.estimateMins}m</span> : null}
          </div>
        ))}
      </div>
    </div>
  );
}

// ════════ LIST VIEW (forward day-planner) ════════
function ListView({ m, now, openCreate }: {
  m: ViewProps["m"]; now: Date;
  openCreate: (k: "schedule", pf?: Record<string, unknown>) => void;
}) {
  const today0 = startOfDay(now).getTime();
  const days = 14;
  const buckets = useMemo(() => {
    const out: { key: number; date: Date; events: MarketingEvent[] }[] = [];
    for (let i = 0; i < days; i++) { const d = new Date(today0 + i * DAY_MS); out.push({ key: d.getTime(), date: d, events: [] }); }
    const end = today0 + days * DAY_MS;
    for (const e of m.events) {
      const t = new Date(e.start).getTime();
      if (t < today0 || t >= end) continue;
      const b = out.find((x) => x.key === startOfDay(new Date(e.start)).getTime());
      if (b) b.events.push(e);
    }
    out.forEach((b) => b.events.sort((a, z) => +new Date(a.start) - +new Date(z.start)));
    return out;
  }, [m.events, today0]);
  const campaignName = (id?: string | null) => m.campaigns.find((c) => c.id === id)?.name;
  const total = buckets.reduce((n, b) => n + b.events.length, 0);

  if (total === 0) return (
    <div style={{ padding: "40px 0", textAlign: "center" }}>
      <Clock size={26} color={D.txd} style={{ marginBottom: 10 }} />
      <div style={{ fontFamily: mn, fontSize: 12, color: D.txd, marginBottom: 14 }}>Nothing scheduled in the next {days} days.</div>
      <button onClick={() => openCreate("schedule")} style={{ display: "inline-flex", alignItems: "center", gap: 7, cursor: "pointer", border: "none", fontFamily: mn, fontSize: 11, fontWeight: 700, borderRadius: 9, padding: "9px 16px", color: "#15100a", background: `linear-gradient(135deg, ${D.amber}, ${D.amber}cc)` }}>
        <Plus size={14} /> Schedule something
      </button>
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {buckets.map((b, idx) => {
        const isToday = idx === 0; const empty = b.events.length === 0;
        if (empty && idx >= 7) return null;
        return (
          <div key={b.key} style={{ border: `1px solid ${isToday ? D.amber + "44" : D.border}`, borderRadius: 13, background: isToday ? `linear-gradient(180deg, ${D.amber}0c, ${D.cardGrad})` : D.cardGrad, overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 15px", borderBottom: empty ? "none" : `1px solid ${D.border}` }}>
              <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.1 }}>
                <span style={{ fontFamily: gf, fontSize: 14, fontWeight: 700, color: isToday ? D.amber : D.tx }}>{isToday ? "Today" : b.date.toLocaleDateString(undefined, { weekday: "long" })}</span>
                <span style={{ fontFamily: mn, fontSize: 10, color: D.txd }}>{b.date.toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
              </div>
              <span style={{ flex: 1 }} />
              <span style={{ fontFamily: mn, fontSize: 9.5, color: D.txd }}>{empty ? "nothing scheduled" : `${b.events.length} ${b.events.length === 1 ? "item" : "items"}`}</span>
              <button onClick={() => openCreate("schedule", { date: toDateStr(b.date) })} title="Schedule on this day" style={{ width: 24, height: 24, borderRadius: 7, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", border: `1px solid ${D.border}`, background: "transparent", color: D.txm }}>
                <Plus size={13} />
              </button>
            </div>
            {!empty && <div>{b.events.map((e) => <ListRow key={e.id} e={e} campaignName={campaignName(e.campaignId)} />)}</div>}
          </div>
        );
      })}
    </div>
  );
}

function ListRow({ e, campaignName }: { e: MarketingEvent; campaignName?: string }) {
  const kindKey = typeof e.payload?.scheduleKind === "string" ? (e.payload.scheduleKind as string) : null;
  const kind = kindKey && kindKey !== "task" ? scheduleKindOf(kindKey) : null;
  const accent = kind?.color || TYPE_COLOR[e.type];
  const statusC = STATUS_COLOR[e.status];
  const ch = e.channel ? channelOf(e.channel) : null;
  const start = new Date(e.start); const end = e.end ? new Date(e.end) : null;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 15px", borderBottom: `1px solid ${D.border}55` }}
      onMouseEnter={(ev) => { ev.currentTarget.style.background = D.hover; }}
      onMouseLeave={(ev) => { ev.currentTarget.style.background = "transparent"; }}>
      <div style={{ width: 92, flex: "none", fontFamily: mn, fontSize: 11, color: D.txm, display: "flex", alignItems: "center", gap: 4 }}>
        {fmtTime(start)}{end && <><ArrowRight size={9} color={D.txd} /><span style={{ color: D.txd }}>{fmtTime(end)}</span></>}
      </div>
      <span style={{ width: 3, height: 30, borderRadius: 2, background: accent, flex: "none", boxShadow: `0 0 8px ${accent}66` }} />
      {kind && <span style={{ fontFamily: mn, fontSize: 8, letterSpacing: 0.5, textTransform: "uppercase", color: accent, border: `1px solid ${accent}55`, borderRadius: 4, padding: "1px 5px", flex: "none" }}>{kind.label}</span>}
      <span style={{ fontFamily: ft, fontSize: 13.5, fontWeight: 500, color: D.tx, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.title}</span>
      <span style={{ flex: 1 }} />
      {campaignName && <span style={{ fontFamily: mn, fontSize: 9.5, color: D.txd, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 150 }}>{campaignName}</span>}
      {ch && <span style={{ fontFamily: mn, fontSize: 8, color: ch.c, border: `1px solid ${ch.c}66`, borderRadius: 4, padding: "1px 5px", flex: "none" }}>{ch.s}</span>}
      <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontFamily: mn, fontSize: 9.5, color: statusC, width: 76, flex: "none" }}>
        <span style={{ width: 6, height: 6, borderRadius: 999, background: statusC }} />{STATUS_LABEL[e.status]}
      </span>
    </div>
  );
}

// ════════ shared bits ════════
function ModeBtn({ on, onClick, icon, label, left }: { on: boolean; onClick: () => void; icon: React.ReactNode; label: string; left?: boolean }) {
  return (
    <button onClick={onClick} style={{
      display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer", fontFamily: mn, fontSize: 10.5,
      padding: "7px 13px", border: "none", borderLeft: left ? `1px solid ${D.border}` : "none",
      color: on ? D.tx : D.txm, background: on ? D.hover : "transparent",
    }}>{icon} {label}</button>
  );
}
const navBtn: React.CSSProperties = {
  width: 30, height: 30, borderRadius: 8, display: "inline-flex", alignItems: "center", justifyContent: "center",
  border: `1px solid ${D.border}`, background: "transparent", color: D.txm, cursor: "pointer", fontFamily: mn, fontSize: 10.5,
};
