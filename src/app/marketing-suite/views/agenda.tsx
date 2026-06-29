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
import { createPortal } from "react-dom";
import {
  CalendarClock, Plus, ArrowRight, CalendarCheck, Rows3, ListChecks, Wand2,
  ChevronLeft, ChevronRight, Crosshair, GripVertical, AlertTriangle, Clock, Zap,
  Pencil, Check, Copy, Trash2, MoveRight, CalendarPlus,
} from "lucide-react";
import { D, ft, gf, mn } from "../../shared-constants";
import {
  STATUS_COLOR, STATUS_LABEL, scheduleKindOf, channelOf, TYPE_COLOR,
  isAllDayEvent, eventCalendarId,
  type MarketingEvent, type BoardTaskLite,
} from "../marketing-constants";
import type { ViewProps } from "../use-marketing";
import { useCreate } from "../create-context";
import { useBoardTasks } from "../use-board-tasks";
import GoogleCalendarsPanel from "../components/google-calendars";
import AgendaWizard from "../components/agenda-wizard";
import { EventHoverCard } from "../components/event-hover-card";
import LockIn from "../components/lock-in";
import { useGoogle, calendarTargets, type GoogleStatus } from "../use-google";

// id → { name, color } for showing which calendar an event belongs to.
function calLookup(status: GoogleStatus | undefined): Record<string, { name: string; color: string }> {
  const map: Record<string, { name: string; color: string }> = {};
  for (const c of calendarTargets(status)) map[c.id] = { name: c.name, color: c.color };
  return map;
}

// Day-grid geometry. The grid spans the full day (midnight→midnight) but sits in
// a scroll viewport that auto-locks to the current hour, so you land on "now" and
// can scroll up to revisit earlier hours.
const START_HOUR = 0, END_HOUR = 24;          // full day
const HOUR_PX = 60;
const GUTTER_W = 64;
const SNAP = 15;                              // minute snap when dragging/resizing
const BOOK_SNAP = 30;                         // hover-to-book snaps to clean :30 slots
const DAY_MS = 86_400_000;
const MIN_VIEW_H = 440;                        // floor for the viewport-filling grid height
const NON_TODAY_START = 8;                     // other days open scrolled to ~8am

function startOfDay(d: Date) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
function addDays(d: Date, n: number) { return new Date(d.getTime() + n * DAY_MS); }
function toDateStr(d: Date) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }
function fmtTime(d: Date) { return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }); }
function minsOfDay(d: Date) { return d.getHours() * 60 + d.getMinutes(); }
function yOfMin(min: number) { return ((min - START_HOUR * 60) / 60) * HOUR_PX; }
function minOfY(y: number) { return START_HOUR * 60 + (y / HOUR_PX) * 60; }
function snap(min: number) { return Math.round(min / SNAP) * SNAP; }
function snapBook(min: number) { return Math.round(min / BOOK_SNAP) * BOOK_SNAP; }
function estMins(t: BoardTaskLite) { return t.estimateMins && t.estimateMins > 0 ? t.estimateMins : 45; }
function clampMin(min: number) { return Math.max(START_HOUR * 60, Math.min(END_HOUR * 60, min)); }
function isoAt(date: Date, minutes: number) { const d = new Date(date); d.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0); return d.toISOString(); }
function hhmm(minutes: number) { const h = Math.floor(minutes / 60), m = Math.round(minutes % 60); return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`; }

export default function AgendaView({ m, onOpenView }: ViewProps) {
  const { openCreate, openEdit } = useCreate();
  const [view, setView] = useState<"day" | "list">("day");
  const [date, setDate] = useState<Date>(() => startOfDay(new Date()));
  const [showCals, setShowCals] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [lockOpen, setLockOpen] = useState(false);
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
          <button onClick={() => setLockOpen(true)} title="Lock in — fill your free time with focused work" style={{
            display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer", border: `1px solid ${D.amber}77`,
            fontFamily: mn, fontSize: 11, fontWeight: 800, letterSpacing: 0.4, borderRadius: 9, padding: "8px 14px",
            color: D.amber, background: D.amber + "16",
          }}>
            <Zap size={13} /> Lock In
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

      {showCals && <div style={{ marginBottom: 14 }}><GoogleCalendarsPanel onChanged={() => m.refresh()} /></div>}

      {/* Day-nav (day view only) — big, clean, white date so the day reads at a glance */}
      {view === "day" && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
          <button onClick={() => setDate((d) => addDays(d, -1))} style={navBtn}><ChevronLeft size={15} /></button>
          <button onClick={() => setDate(startOfDay(new Date()))} style={{ ...navBtn, width: "auto", padding: "0 13px", gap: 6, color: isToday ? D.amber : D.txm }}>
            <Crosshair size={12} /> Today
          </button>
          <button onClick={() => setDate((d) => addDays(d, 1))} style={navBtn}><ChevronRight size={15} /></button>
          <div style={{ marginLeft: 8, display: "flex", alignItems: "baseline", gap: 11 }}>
            <span style={{ fontFamily: gf, fontSize: 27, fontWeight: 800, letterSpacing: -0.6, color: D.tx }}>
              {date.toLocaleDateString(undefined, { weekday: "long" })}
            </span>
            <span style={{ fontFamily: gf, fontSize: 27, fontWeight: 400, letterSpacing: -0.6, color: D.tx }}>
              {date.toLocaleDateString(undefined, { month: "long", day: "numeric" })}
            </span>
            {isToday && (
              <span style={{ fontFamily: mn, fontSize: 9.5, fontWeight: 700, letterSpacing: 0.6, textTransform: "uppercase", color: D.amber, border: `1px solid ${D.amber}66`, background: D.amber + "16", borderRadius: 999, padding: "2px 9px", alignSelf: "center" }}>Today</span>
            )}
          </div>
        </div>
      )}

      {view === "day"
        ? <DayGrid m={m} date={date} now={now} isToday={isToday} openCreate={openCreate} onOpenEdit={openEdit} gStatus={gcalStatus} />
        : <ListView m={m} now={now} openCreate={openCreate} onOpenEdit={openEdit} />}

      <AgendaWizard open={wizardOpen} m={m} date={date} onClose={() => setWizardOpen(false)} onOpenView={onOpenView} />
      {lockOpen && <LockIn m={m} onClose={() => setLockOpen(false)} />}
    </div>
  );
}

// ════════ DAY GRID ════════
interface Placed { e: MarketingEvent; startMin: number; endMin: number; col: number; cols: number; }
type DragMode = "move" | "resize" | "resize-top";
type MenuItem = { label?: string; icon?: React.ReactNode; onClick?: () => void; danger?: boolean; sep?: boolean; hint?: string };
type Menu =
  | { kind: "block"; x: number; y: number; items: MenuItem[] }
  | { kind: "task"; x: number; y: number; items: MenuItem[] }
  | null;

function DayGrid({ m, date, now, isToday, openCreate, onOpenEdit, gStatus }: {
  m: ViewProps["m"]; date: Date; now: Date; isToday: boolean;
  openCreate: (k: "schedule", pf?: Record<string, unknown>) => void;
  onOpenEdit: (e: MarketingEvent) => void;
  gStatus: GoogleStatus | undefined;
}) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [drag, setDrag] = useState<{ id: string; offMin: number; startY: number; moved: boolean; mode: DragMode; startMin: number; endMin: number } | null>(null);
  const [dragY, setDragY] = useState(0);
  const [hover, setHover] = useState<{ e: MarketingEvent; rect: DOMRect } | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [ghostMin, setGhostMin] = useState<number | null>(null);
  const [menu, setMenu] = useState<Menu>(null);

  const tasks = useBoardTasks();
  const dayKey = startOfDay(date).getTime();
  const cals = useMemo(() => calLookup(gStatus), [gStatus]);

  // Fill the viewport: the grid + rail share whatever height is left below the
  // header, so you never page-scroll and the current hour is never clipped.
  const [availH, setAvailH] = useState(620);
  useEffect(() => {
    const calc = () => {
      const el = wrapRef.current; if (!el) return;
      setAvailH(Math.max(MIN_VIEW_H, Math.floor(window.innerHeight - el.getBoundingClientRect().top - 22)));
    };
    calc(); window.addEventListener("resize", calc);
    return () => window.removeEventListener("resize", calc);
  }, []);

  // Esc clears any selection / context menu.
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") { setSelectedId(null); setMenu(null); } };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, []);

  // All-day events get a banner row so they don't fill the whole timed grid.
  const allDayEvents = useMemo(
    () => m.events.filter((e) => startOfDay(new Date(e.start)).getTime() === dayKey && isAllDayEvent(e)),
    [m.events, dayKey],
  );

  // Timed events on this day, with overlap columns.
  const placed = useMemo<Placed[]>(() => {
    const evs = m.events
      .filter((e) => startOfDay(new Date(e.start)).getTime() === dayKey && !isAllDayEvent(e))
      .map((e) => {
        const s = new Date(e.start);
        const startMin = clampMin(minsOfDay(s));
        // End: same-day uses its real minute; an event ending on a later calendar
        // day runs to the bottom of the grid rather than collapsing to a stub.
        let rawEnd = startMin + 30;
        if (e.end) {
          const eEnd = new Date(e.end);
          const dayDiff = startOfDay(eEnd).getTime() - startOfDay(s).getTime();
          rawEnd = dayDiff > 0 ? END_HOUR * 60 : minsOfDay(eEnd);
        }
        const endMin = clampMin(Math.max(rawEnd, startMin + 20));
        return { e, startMin, endMin };
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
  // Scroll slack so "now" can always sit near the TOP and roll, even late at night
  // when there's little day left below it (otherwise the scroll clamps and dumps
  // you at the bottom). Only as much empty tail as actually needed.
  const tailPad = isToday ? Math.max(0, yOfMin(nowMin) - 44 + availH - gridH) : 0;

  // Land with "now" near the TOP and the rest of the day rolling below; scroll up
  // for earlier hours. Other days open at the morning. Re-runs on day change only,
  // so it never yanks the scroll out from under you mid-read.
  useEffect(() => {
    const sc = scrollRef.current;
    if (!sc) return;
    sc.scrollTop = isToday
      ? Math.max(0, yOfMin(minsOfDay(new Date())) - 44)
      : Math.max(0, yOfMin(NON_TODAY_START * 60) - 12);
  }, [dayKey, isToday, availH]);

  // Push a time change to Google for synced events (best-effort, time-only so it
  // never wipes description/location/guests on the Google side).
  const pushTime = useCallback(async (ev: MarketingEvent, startISO: string, endISO: string | null) => {
    const calId = eventCalendarId(ev);
    const tgt = calendarTargets(gStatus).find((c) => c.id === calId);
    if (!tgt?.google || !gStatus?.connected || m.mode !== "live") return;
    const gcalEventId = ev.gcalEventId || (typeof ev.payload?.gcalEventId === "string" ? ev.payload.gcalEventId : null);
    if (!gcalEventId) return;
    try {
      await fetch("/api/google/event", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ owner: m.owner, calendarId: calId, fromCalendarId: calId, gcalEventId, title: ev.title, start: startISO, end: endISO, allDay: isAllDayEvent(ev) }),
      });
    } catch { /* best-effort */ }
  }, [gStatus, m.mode, m.owner]);

  // ── pointer: move (body) · resize (top/bottom handle) · click → select ──
  const onBlockPointerDown = (e: React.PointerEvent, p: Placed, mode: DragMode) => {
    if (e.button === 2) return;                          // leave right-click to the menu
    e.preventDefault(); e.stopPropagation();
    setHover(null); setMenu(null);
    const rect = canvasRef.current!.getBoundingClientRect();
    const y = e.clientY - rect.top;
    setDrag({ id: p.e.id, offMin: minOfY(y) - p.startMin, startY: y, moved: false, mode, startMin: p.startMin, endMin: p.endMin });
    setDragY(y);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (drag) {
      const rect = canvasRef.current!.getBoundingClientRect();
      const y = e.clientY - rect.top;
      setDragY(y);
      if (!drag.moved && Math.abs(y - drag.startY) > 4) setDrag((d) => d ? { ...d, moved: true } : d);
      return;
    }
    // hover ghost on empty canvas → a clean :30 slot you can click to book
    const t = e.target as HTMLElement;
    if (t.closest("[data-block]")) { setGhostMin(null); return; }
    const rect = canvasRef.current!.getBoundingClientRect();
    setGhostMin(snapBook(clampMin(minOfY(e.clientY - rect.top))));
  };
  const onPointerUp = () => {
    if (!drag) return;
    const ev = m.events.find((x) => x.id === drag.id);
    if (!drag.moved) {
      setSelectedId(drag.id);                            // click selects → stretch handles appear
    } else if (ev && drag.mode === "resize") {
      const endMin = snap(clampMin(Math.max(drag.startMin + SNAP, minOfY(dragY))));
      const endISO = isoAt(date, endMin);
      m.updateEvent(drag.id, { end: endISO });
      void pushTime(ev, ev.start, endISO);
    } else if (ev && drag.mode === "resize-top") {
      const startMin = snap(clampMin(Math.min(drag.endMin - SNAP, minOfY(dragY))));
      const startISO = isoAt(date, startMin);
      const endISO = isoAt(date, drag.endMin);
      m.updateEvent(drag.id, { start: startISO, end: endISO });
      void pushTime(ev, startISO, endISO);
    } else if (ev) {
      const newStartMin = snap(clampMin(minOfY(dragY) - drag.offMin));
      const newStartISO = isoAt(date, newStartMin);
      m.moveEvent(drag.id, newStartISO);
      const newEndISO = ev.end ? new Date(new Date(newStartISO).getTime() + (new Date(ev.end).getTime() - new Date(ev.start).getTime())).toISOString() : null;
      void pushTime(ev, newStartISO, newEndISO);
    }
    setDrag(null);
  };

  // ── click empty → book a clean :30 slot ──
  const onCanvasClick = (e: React.MouseEvent) => {
    if (drag) return;
    if ((e.target as HTMLElement).closest("[data-block]")) return;
    setSelectedId(null); setMenu(null);
    const rect = canvasRef.current!.getBoundingClientRect();
    const min = snapBook(clampMin(minOfY(e.clientY - rect.top)));
    openCreate("schedule", { date: toDateStr(date), startTime: hhmm(min) });
  };

  // ── drop a task from the rail ──
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const raw = e.dataTransfer.getData("application/x-task");
    if (!raw) return;
    const t = JSON.parse(raw) as BoardTaskLite;
    const rect = canvasRef.current!.getBoundingClientRect();
    const startMin = snapBook(clampMin(minOfY(e.clientY - rect.top)));
    const dur = estMins(t);
    m.addEvent({
      title: t.title, type: "manual", status: "scheduled",
      start: isoAt(date, startMin), end: isoAt(date, Math.min(END_HOUR * 60, startMin + dur)),
      source: "poast", payload: { scheduleKind: "block", sourceTaskId: t.id },
    });
  };

  // ── quick-scheduling helpers (used by the right-click menus) ──
  const dayBusy = (): [number, number][] => placed.map((p) => [p.startMin, p.endMin] as [number, number]).sort((a, b) => a[0] - b[0]);
  const nextFreeStart = (dur: number) => {
    let cur = snap(clampMin(isToday ? Math.max(minsOfDay(now) + 5, START_HOUR * 60) : 9 * 60));
    for (const [s, en] of dayBusy()) { if (s - cur >= dur) break; if (en > cur) cur = snap(en); }
    return clampMin(Math.min(cur, END_HOUR * 60 - dur));
  };
  const quickBlock = (t: BoardTaskLite, dur: number) => {
    const s = nextFreeStart(dur);
    m.addEvent({
      title: t.title, type: "manual", status: "scheduled",
      start: isoAt(date, s), end: isoAt(date, Math.min(END_HOUR * 60, s + dur)),
      source: "poast", payload: { scheduleKind: "block", sourceTaskId: t.id },
    });
  };
  const setLen = (ev: MarketingEvent, startMin: number, dur: number) => {
    const endISO = isoAt(date, clampMin(startMin + dur));
    m.updateEvent(ev.id, { end: endISO }); void pushTime(ev, ev.start, endISO);
  };
  const blockMenuItems = (ev: MarketingEvent, startMin: number): MenuItem[] => [
    { label: "Edit", icon: <Pencil size={13} />, onClick: () => onOpenEdit(ev) },
    { label: ev.status === "done" ? "Mark not done" : "Mark done", icon: <Check size={13} />, onClick: () => m.updateEvent(ev.id, { status: ev.status === "done" ? "scheduled" : "done" }) },
    { label: "Duplicate", icon: <Copy size={13} />, onClick: () => m.addEvent({ title: ev.title + " (copy)", type: ev.type, status: "scheduled", start: ev.start, end: ev.end, channel: ev.channel, campaignId: ev.campaignId, source: "poast", payload: { ...(ev.payload || {}) } }) },
    { sep: true },
    { label: "30 min", hint: "length", onClick: () => setLen(ev, startMin, 30) },
    { label: "45 min", onClick: () => setLen(ev, startMin, 45) },
    { label: "1 hour", onClick: () => setLen(ev, startMin, 60) },
    { label: "1.5 hours", onClick: () => setLen(ev, startMin, 90) },
    { label: "2 hours", onClick: () => setLen(ev, startMin, 120) },
    { sep: true },
    { label: "Move to tomorrow", icon: <MoveRight size={13} />, onClick: () => m.moveEvent(ev.id, new Date(new Date(ev.start).getTime() + DAY_MS).toISOString()) },
    { label: "Delete", icon: <Trash2 size={13} />, danger: true, onClick: () => { m.removeEvent(ev.id); setSelectedId(null); } },
  ];
  const taskMenuItems = (t: BoardTaskLite): MenuItem[] => [
    { label: "Block next free time", icon: <Zap size={13} />, hint: `${estMins(t)}m`, onClick: () => quickBlock(t, estMins(t)) },
    { label: "Block 30 min", onClick: () => quickBlock(t, 30) },
    { label: "Block 1 hour", onClick: () => quickBlock(t, 60) },
    { label: "Block 2 hours", onClick: () => quickBlock(t, 120) },
    { sep: true },
    { label: "Schedule…", icon: <CalendarPlus size={13} />, onClick: () => openCreate("schedule", { title: t.title, date: toDateStr(date), startTime: hhmm(nextFreeStart(estMins(t))) }) },
  ];

  return (
    <div ref={wrapRef} style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
      {/* Grid */}
      <div style={{ flex: 1, minWidth: 0, border: `1px solid ${D.border}`, borderRadius: 14, background: D.cardGrad, overflow: "hidden", height: availH, display: "flex", flexDirection: "column" }}>
        {allDayEvents.length > 0 && (
          <div style={{ flex: "none", display: "flex", alignItems: "flex-start", gap: 8, padding: "8px 12px 8px 0", borderBottom: `1px solid ${D.border}` }}>
            <div style={{ width: GUTTER_W - 8, flex: "none", textAlign: "right", fontFamily: mn, fontSize: 9, color: D.txd, paddingTop: 5, textTransform: "uppercase", letterSpacing: 0.4 }}>all-day</div>
            <div style={{ flex: 1, display: "flex", flexWrap: "wrap", gap: 6, minWidth: 0 }}>
              {allDayEvents.map((e) => {
                const c = cals[eventCalendarId(e)];
                return (
                  <button key={e.id} type="button"
                    onClick={() => onOpenEdit(e)}
                    onContextMenu={(ev) => { ev.preventDefault(); setMenu({ kind: "block", x: ev.clientX, y: ev.clientY, items: blockMenuItems(e, minsOfDay(new Date(e.start))) }); }}
                    onMouseEnter={(ev) => setHover({ e, rect: ev.currentTarget.getBoundingClientRect() })}
                    onMouseLeave={() => setHover(null)}
                    style={{ display: "inline-flex", alignItems: "center", gap: 6, maxWidth: "100%", cursor: "pointer",
                      padding: "4px 9px", borderRadius: 7, border: `1px solid ${(c?.color || D.amber)}66`,
                      background: `${c?.color || D.amber}1c`, color: D.tx, fontFamily: ft, fontSize: 11.5, fontWeight: 600 }}>
                    <span style={{ width: 7, height: 7, borderRadius: 2, background: c?.color || D.amber, flex: "none" }} />
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.title}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
        <div ref={scrollRef} onPointerLeave={() => setGhostMin(null)} style={{ flex: 1, overflowY: "auto", overflowX: "hidden" }}>
        <div
          ref={canvasRef}
          onClick={onCanvasClick}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onContextMenu={(e) => { if ((e.target as HTMLElement).closest("[data-block]")) return; e.preventDefault(); }}
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
                <div style={{ position: "absolute", left: GUTTER_W - 4, right: 0, top: y, height: 1, background: "rgba(255,255,255,0.06)" }} />
                <div style={{ position: "absolute", left: 0, top: y - 6, width: GUTTER_W - 10, textAlign: "right", fontFamily: mn, fontSize: 9.5, color: D.txd }}>
                  {(hour % 24) % 12 === 0 ? 12 : (hour % 24) % 12}{(hour % 24) < 12 ? "a" : "p"}
                </div>
              </React.Fragment>
            );
          })}
          {/* half-hour + quarter-hour ticks (the bookable :30 / :15 grid) */}
          {Array.from({ length: END_HOUR - START_HOUR }, (_, i) => (
            <React.Fragment key={"t" + i}>
              <div style={{ position: "absolute", left: GUTTER_W, right: 0, top: i * HOUR_PX + HOUR_PX / 2, height: 1, background: "rgba(255,255,255,0.035)" }} />
              <div style={{ position: "absolute", left: GUTTER_W, right: 0, top: i * HOUR_PX + HOUR_PX / 4, height: 1, borderTop: "1px dotted rgba(255,255,255,0.025)" }} />
              <div style={{ position: "absolute", left: GUTTER_W, right: 0, top: i * HOUR_PX + (HOUR_PX * 3) / 4, height: 1, borderTop: "1px dotted rgba(255,255,255,0.025)" }} />
            </React.Fragment>
          ))}

          {/* :30 hover ghost — click to book a clean slot */}
          {ghostMin != null && !drag && (
            <div style={{ position: "absolute", left: GUTTER_W, right: 6, top: yOfMin(ghostMin), height: (BOOK_SNAP / 60) * HOUR_PX - 2, borderRadius: 7, border: `1px dashed ${D.amber}88`, background: `${D.amber}12`, pointerEvents: "none", display: "flex", alignItems: "center", gap: 6, padding: "0 9px", zIndex: 2 }}>
              <Plus size={11} color={D.amber} />
              <span style={{ fontFamily: mn, fontSize: 9.5, color: D.amber }}>{hhmmLabel(ghostMin)} · click to book</span>
            </div>
          )}

          {/* Blocks */}
          {placed.map((p) => (
            <DayBlock
              key={p.e.id} p={p} date={date} now={now} isToday={isToday}
              dragging={drag?.id === p.e.id} dragMode={drag?.id === p.e.id ? drag.mode : undefined}
              dragY={dragY} dragOff={drag?.offMin || 0} selected={selectedId === p.e.id}
              cal={cals[eventCalendarId(p.e)]}
              onPointerDown={onBlockPointerDown}
              onEdit={onOpenEdit}
              onContext={(ev, pl) => setMenu({ kind: "block", x: ev.clientX, y: ev.clientY, items: blockMenuItems(pl.e, pl.startMin) })}
              onHover={(rect) => setHover(rect ? { e: p.e, rect } : null)}
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
        {tailPad > 0 && <div style={{ height: tailPad }} />}
        </div>
      </div>

      {/* Task rail */}
      <TaskRail tasks={tasks} date={date} openCreate={openCreate} now={now} availH={availH}
        onTaskContext={(e, t) => setMenu({ kind: "task", x: e.clientX, y: e.clientY, items: taskMenuItems(t) })} />

      {/* Hover preview (suppressed while dragging) */}
      {hover && !drag && (
        <EventHoverCard e={hover.e} rect={hover.rect}
          calName={cals[eventCalendarId(hover.e)]?.name} calColor={cals[eventCalendarId(hover.e)]?.color} />
      )}

      {/* Right-click context menu */}
      {menu && <ContextMenu x={menu.x} y={menu.y} items={menu.items} onClose={() => setMenu(null)} />}
    </div>
  );
}

// Portaled right-click menu — closes on outside click / Esc / scroll.
function ContextMenu({ x, y, items, onClose }: { x: number; y: number; items: MenuItem[]; onClose: () => void }) {
  useEffect(() => {
    const close = () => onClose();
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("pointerdown", close);
    window.addEventListener("scroll", close, true);
    window.addEventListener("keydown", k);
    return () => { window.removeEventListener("pointerdown", close); window.removeEventListener("scroll", close, true); window.removeEventListener("keydown", k); };
  }, [onClose]);
  if (typeof document === "undefined") return null;
  const W = 214;
  const left = Math.min(x, window.innerWidth - W - 8);
  const top = Math.min(y, window.innerHeight - (items.length * 33 + 16));
  return createPortal(
    <div onPointerDown={(e) => e.stopPropagation()} onContextMenu={(e) => e.preventDefault()}
      style={{ position: "fixed", left, top, width: W, zIndex: 14000, background: D.bg, border: `1px solid ${D.border}`, borderRadius: 11, boxShadow: "0 20px 56px rgba(0,0,0,0.62)", padding: 6, fontFamily: ft }}>
      {items.map((it, i) => it.sep ? (
        <div key={i} style={{ height: 1, background: D.border, margin: "5px 6px" }} />
      ) : (
        <button key={i} onClick={() => { onClose(); it.onClick?.(); }}
          onMouseEnter={(e) => { e.currentTarget.style.background = D.hover; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
          style={{ display: "flex", alignItems: "center", gap: 9, width: "100%", textAlign: "left", border: "none", background: "transparent", color: it.danger ? D.coral : D.tx, cursor: "pointer", padding: "7px 9px", borderRadius: 7, fontFamily: ft, fontSize: 12.5 }}>
          <span style={{ width: 15, flex: "none", display: "inline-flex", color: it.danger ? D.coral : D.txm }}>{it.icon}</span>
          <span style={{ flex: 1 }}>{it.label}</span>
          {it.hint && <span style={{ fontFamily: mn, fontSize: 9, color: D.txd }}>{it.hint}</span>}
        </button>
      ))}
    </div>,
    document.body,
  );
}

function DayBlock({ p, now, isToday, dragging, dragMode, dragY, dragOff, selected, cal, onPointerDown, onHover, onContext, onEdit }: {
  p: Placed; date: Date; now: Date; isToday: boolean;
  dragging: boolean; dragMode?: DragMode; dragY: number; dragOff: number; selected: boolean;
  cal?: { name: string; color: string };
  onPointerDown: (e: React.PointerEvent, p: Placed, mode: DragMode) => void;
  onHover: (rect: DOMRect | null) => void;
  onContext: (e: React.MouseEvent, p: Placed) => void;
  onEdit: (e: MarketingEvent) => void;
}) {
  const kindKey = typeof p.e.payload?.scheduleKind === "string" ? (p.e.payload.scheduleKind as string) : null;
  const kind = kindKey && kindKey !== "task" ? scheduleKindOf(kindKey) : null;
  const accent = cal?.color || kind?.color || TYPE_COLOR[p.e.type];
  // Live preview while dragging — move shifts both ends, resize handles move one.
  const liveStart = dragging && dragMode === "move" ? snap(clampMin(minOfY(dragY) - dragOff))
    : dragging && dragMode === "resize-top" ? snap(clampMin(Math.min(p.endMin - SNAP, minOfY(dragY))))
    : p.startMin;
  const liveEnd = dragging && dragMode === "resize" ? snap(clampMin(Math.max(p.startMin + SNAP, minOfY(dragY)))) : p.endMin;
  const dur = liveEnd - liveStart;
  const top = yOfMin(liveStart);
  const height = Math.max(22, (dur / 60) * HOUR_PX - 3);
  const nowMin = minsOfDay(now);
  const done = p.e.status === "done";
  const overdue = isToday && nowMin > p.endMin && !done;
  const live = isToday && nowMin >= liveStart && nowMin < liveEnd;

  return (
    <div
      data-block
      onPointerDown={(e) => onPointerDown(e, p, "move")}
      onDoubleClick={() => onEdit(p.e)}
      onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); onContext(e, p); }}
      onMouseEnter={(e) => onHover(e.currentTarget.getBoundingClientRect())}
      onMouseLeave={() => onHover(null)}
      style={{
        position: "absolute",
        top, height,
        // Columns are laid out inside the lane (canvas width minus the time
        // gutter) so blocks never overflow the right edge regardless of count.
        left: `calc(${GUTTER_W}px + (100% - ${GUTTER_W}px) * ${p.col} / ${p.cols})`,
        width: `calc((100% - ${GUTTER_W}px) / ${p.cols} - 8px)`,
        zIndex: dragging ? 20 : selected ? 12 : live ? 6 : 3,
        background: done ? `linear-gradient(135deg, ${accent}1c, ${accent}0a)` : `linear-gradient(135deg, ${accent}2e, ${accent}14)`,
        border: `1px solid ${overdue ? D.coral : accent}${selected || live ? "" : "66"}`,
        borderLeft: `3px solid ${overdue ? D.coral : accent}`,
        borderRadius: 8, padding: "4px 8px", cursor: dragging && dragMode === "move" ? "grabbing" : "grab", overflow: "hidden",
        boxShadow: dragging ? "0 12px 30px rgba(0,0,0,0.55)" : selected ? `0 0 0 1px ${accent}, 0 8px 22px rgba(0,0,0,0.45)` : live ? `0 0 16px ${accent}44` : "none",
        opacity: done ? 0.72 : 1, userSelect: "none", touchAction: "none",
        transition: dragging ? "none" : "box-shadow 0.12s, border-color 0.12s",
      }}
    >
      {/* top stretch handle (selected) */}
      {selected && (
        <div onPointerDown={(e) => onPointerDown(e, p, "resize-top")}
          style={{ position: "absolute", left: 0, right: 0, top: -1, height: 11, cursor: "ns-resize", display: "flex", justifyContent: "center", alignItems: "flex-start" }}>
          <span style={{ width: 28, height: 3, borderRadius: 2, marginTop: 1, background: accent }} />
        </div>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
        {live && <span style={{ width: 6, height: 6, borderRadius: 999, background: D.teal, boxShadow: `0 0 6px ${D.teal}`, flex: "none" }} />}
        {overdue && <AlertTriangle size={11} color={D.coral} style={{ flex: "none" }} />}
        {done && <Check size={11} color={accent} style={{ flex: "none" }} />}
        <span style={{ fontFamily: ft, fontSize: 12, fontWeight: 600, color: D.tx, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textDecoration: done ? "line-through" : "none" }}>{p.e.title}</span>
      </div>
      {height > 32 && (
        <div style={{ fontFamily: mn, fontSize: 9.5, color: overdue ? D.coral : D.txm, marginTop: 2 }}>
          {hhmmLabel(liveStart)}–{hhmmLabel(liveEnd)} · {dur}m{kind ? ` · ${kind.label}` : ""}{overdue ? " · overran" : live ? " · live" : ""}
        </div>
      )}
      {/* bottom stretch handle — always grabbable; bar appears when selected */}
      <div
        onPointerDown={(e) => onPointerDown(e, p, "resize")}
        style={{ position: "absolute", left: 0, right: 0, bottom: -1, height: selected ? 12 : 8, cursor: "ns-resize", display: "flex", justifyContent: "center", alignItems: "flex-end" }}
      >
        {selected && <span style={{ width: 28, height: 3, borderRadius: 2, marginBottom: 1, background: accent }} />}
      </div>
    </div>
  );
}
function hhmmLabel(min: number) { const h = Math.floor(min / 60), m = Math.round(min % 60); const ap = h < 12 ? "a" : "p"; const h12 = h % 12 === 0 ? 12 : h % 12; return m === 0 ? `${h12}${ap}` : `${h12}:${String(m).padStart(2, "0")}${ap}`; }

// ════════ TASK RAIL ════════
const PRIO_ORDER: Record<string, number> = { HIGH: 0, MEDIUM: 1, "THIS WEEK": 2, ONGOING: 3 };
const PRIO_COLOR: Record<string, string> = { HIGH: D.coral, MEDIUM: D.amber, "THIS WEEK": D.blue, ONGOING: D.txd };
type TaskSort = "priority" | "due" | "added";

function sortTasks(tasks: BoardTaskLite[], sort: TaskSort): BoardTaskLite[] {
  const arr = [...tasks];
  if (sort === "priority") arr.sort((a, b) => (PRIO_ORDER[a.priority || ""] ?? 9) - (PRIO_ORDER[b.priority || ""] ?? 9) || (a.dueDate || "9").localeCompare(b.dueDate || "9"));
  else if (sort === "due") arr.sort((a, b) => (a.dueDate || "9999").localeCompare(b.dueDate || "9999"));
  else arr.sort((a, b) => (b.addedAt || "").localeCompare(a.addedAt || ""));
  return arr;
}

function TaskRail({ tasks, date, openCreate, now, availH, onTaskContext }: {
  tasks: BoardTaskLite[]; date: Date; now: Date; availH: number;
  openCreate: (k: "schedule", pf?: Record<string, unknown>) => void;
  onTaskContext: (e: React.MouseEvent, t: BoardTaskLite) => void;
}) {
  const [sort, setSort] = useState<TaskSort>("priority");
  const open = useMemo(() => sortTasks(tasks.filter((t) => !t.done), sort).slice(0, 80), [tasks, sort]);
  const nextSlot = () => {
    const base = startOfDay(now).getTime() === startOfDay(date).getTime() ? Math.max(minsOfDay(now) + 5, START_HOUR * 60) : START_HOUR * 60 + 9 * 60;
    return hhmm(snap(clampMin(base)));
  };
  const sorts: { k: TaskSort; label: string }[] = [{ k: "priority", label: "Priority" }, { k: "due", label: "Due" }, { k: "added", label: "Recent" }];
  return (
    <div style={{ width: 296, flex: "none", border: `1px solid ${D.border}`, borderRadius: 14, background: D.cardGrad, display: "flex", flexDirection: "column", height: availH, overflow: "hidden" }}>
      <div style={{ flex: "none", padding: "13px 14px 11px", borderBottom: `1px solid ${D.border}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
          <ListChecks size={16} color={D.blue} />
          <span style={{ fontFamily: gf, fontSize: 17, fontWeight: 800, letterSpacing: -0.3, color: D.tx }}>Task queue</span>
          <span style={{ flex: 1 }} />
          <span style={{ fontFamily: mn, fontSize: 9.5, color: D.txd }}>{open.length}</span>
        </div>
        <div style={{ fontFamily: mn, fontSize: 8.5, letterSpacing: 0.5, color: D.txd, textTransform: "uppercase", marginBottom: 11 }}>Drag onto a slot · right-click for options</div>
        <div style={{ display: "flex", border: `1px solid ${D.border}`, borderRadius: 9, overflow: "hidden", background: D.card }}>
          {sorts.map((s, i) => (
            <button key={s.k} onClick={() => setSort(s.k)} style={{
              flex: 1, fontFamily: mn, fontSize: 10, letterSpacing: 0.3, cursor: "pointer", padding: "7px 0",
              border: "none", borderLeft: i ? `1px solid ${D.border}` : "none",
              color: sort === s.k ? D.tx : D.txm, background: sort === s.k ? D.hover : "transparent",
            }}>{s.label}</button>
          ))}
        </div>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "11px 12px", display: "flex", flexDirection: "column", gap: 7 }}>
        {open.length === 0 && <div style={{ fontFamily: mn, fontSize: 10.5, color: D.txd, padding: "10px 2px" }}>No open tasks. Add some on the Board.</div>}
        {open.map((t) => {
          const pc = t.priority ? PRIO_COLOR[t.priority] : null;
          const due = t.dueDate ? new Date(t.dueDate + "T00:00:00") : null;
          return (
            <div
              key={t.id}
              draggable
              onDragStart={(e) => { e.dataTransfer.setData("application/x-task", JSON.stringify(t)); e.dataTransfer.effectAllowed = "copy"; }}
              onClick={() => openCreate("schedule", { title: t.title, date: toDateStr(date), startTime: nextSlot() })}
              onContextMenu={(e) => { e.preventDefault(); onTaskContext(e, t); }}
              title="Drag onto the grid · click to slot at the next free time · right-click for options"
              style={{ display: "flex", alignItems: "flex-start", gap: 9, padding: "10px 11px", borderRadius: 11, border: `1px solid ${D.border}`, background: D.card, cursor: "grab", borderLeft: pc ? `3px solid ${pc}` : `1px solid ${D.border}`, transition: "background 0.12s, border-color 0.12s" }}
              onMouseEnter={(e) => { e.currentTarget.style.background = D.hover; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = D.card; }}
            >
              <GripVertical size={14} color={D.txd} style={{ flex: "none", marginTop: 1 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: ft, fontSize: 13, color: D.tx, lineHeight: 1.32, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{t.title}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 6, flexWrap: "wrap" }}>
                  {pc && <span style={{ fontFamily: mn, fontSize: 8, fontWeight: 700, letterSpacing: 0.4, color: pc, border: `1px solid ${pc}55`, background: pc + "12", borderRadius: 5, padding: "1px 6px" }}>{t.priority}</span>}
                  {t.category && <span style={{ fontFamily: mn, fontSize: 8.5, color: D.txd, textTransform: "uppercase", letterSpacing: 0.3 }}>{t.category}</span>}
                  {t.estimateMins ? <span style={{ fontFamily: mn, fontSize: 8.5, color: D.txm, display: "inline-flex", alignItems: "center", gap: 3 }}><Clock size={8} />{t.estimateMins}m</span> : null}
                  {due && <span style={{ fontFamily: mn, fontSize: 8.5, color: D.txd, marginLeft: "auto" }}>due {due.toLocaleDateString(undefined, { month: "numeric", day: "numeric" })}</span>}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ════════ LIST VIEW (forward day-planner) ════════
function ListView({ m, now, openCreate, onOpenEdit }: {
  m: ViewProps["m"]; now: Date;
  openCreate: (k: "schedule", pf?: Record<string, unknown>) => void;
  onOpenEdit: (e: MarketingEvent) => void;
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
            {!empty && <div>{b.events.map((e) => <ListRow key={e.id} e={e} campaignName={campaignName(e.campaignId)} onOpenEdit={onOpenEdit} />)}</div>}
          </div>
        );
      })}
    </div>
  );
}

function ListRow({ e, campaignName, onOpenEdit }: { e: MarketingEvent; campaignName?: string; onOpenEdit: (e: MarketingEvent) => void }) {
  const kindKey = typeof e.payload?.scheduleKind === "string" ? (e.payload.scheduleKind as string) : null;
  const kind = kindKey && kindKey !== "task" ? scheduleKindOf(kindKey) : null;
  const accent = kind?.color || TYPE_COLOR[e.type];
  const statusC = STATUS_COLOR[e.status];
  const ch = e.channel ? channelOf(e.channel) : null;
  const start = new Date(e.start); const end = e.end ? new Date(e.end) : null;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 15px", borderBottom: `1px solid ${D.border}55`, cursor: "pointer" }}
      onClick={() => onOpenEdit(e)}
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
