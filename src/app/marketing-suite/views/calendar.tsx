"use client";
// MarketingSUITE · Calendar — the centerpiece scheduler over m.events.
// Three view modes (Month grid / Week columns / Agenda list), drag-and-drop
// reschedule in Month via @dnd-kit, a buffer-layer toggle, and per-type filter
// chips. One item, every view: production flows in from the spine; you add the
// marketing layer on top. Styling = inline CSSProperties + D tokens only.
import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors,
  useDraggable, useDroppable, closestCenter,
  type DragStartEvent, type DragEndEvent,
} from "@dnd-kit/core";
import {
  CalendarDays, LayoutGrid, Columns3, List, Plus, Rocket, Clapperboard,
  Scissors, Radio, Palette, Send, GripVertical,
} from "lucide-react";
import { D, ft, gf, mn } from "../../shared-constants";
import {
  type MarketingEvent,
  TYPE_COLOR, STATUS_COLOR, STATUS_LABEL, channelOf,
} from "../marketing-constants";
import { type ViewProps } from "../use-marketing";
import { useCreate } from "../create-context";
import { EventHoverCard } from "../components/event-hover-card";

// ─── Local helpers ───
type Mode = "month" | "week" | "agenda";

// Click an event → open the editor; hover → preview card. Shared by every
// calendar event renderer so the surface behaves consistently. Click and hover
// are returned separately so draggable chips can route the click through their
// own pointer-distance guard (dnd-kit's pointer capture otherwise swallows the
// native click).
function useEventInteractions(e: MarketingEvent) {
  const { openEdit } = useCreate();
  const [rect, setRect] = useState<DOMRect | null>(null);
  return {
    open: () => openEdit(e),
    onClick: (ev: React.MouseEvent) => { ev.stopPropagation(); openEdit(e); },
    hoverHandlers: {
      onMouseEnter: (ev: React.MouseEvent) => setRect(ev.currentTarget.getBoundingClientRect()),
      onMouseLeave: () => setRect(null),
    },
    hover: rect ? <EventHoverCard e={e} rect={rect} /> : null,
  };
}

// Compose dnd-kit drag with a reliable click: record pointer-down position in
// the capture phase (before dnd's own pointerdown arms the sensor), and on
// pointer-up treat <5px of travel as a click → open the editor. A real drag
// moves further, so it never mis-fires. Spreads alongside {...listeners}.
function useDragClick(onOpen: () => void) {
  const down = useRef<{ x: number; y: number } | null>(null);
  return {
    onPointerDownCapture: (ev: React.PointerEvent) => { down.current = { x: ev.clientX, y: ev.clientY }; },
    onPointerUp: (ev: React.PointerEvent) => {
      const d = down.current; down.current = null;
      if (d && Math.hypot(ev.clientX - d.x, ev.clientY - d.y) < 5) onOpen();
    },
  };
}

const DOW = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
const GRID_GAP = 6; // px gap between month cells (used to size responsive rows)

// Monday-indexed day-of-week (0 = Mon … 6 = Sun) for grid alignment.
function mondayIdx(d: Date): number { return (d.getDay() + 6) % 7; }
function startOfDay(d: Date): Date { const n = new Date(d); n.setHours(0, 0, 0, 0); return n; }
function addDays(d: Date, n: number): Date { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function ymd(d: Date): string { return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; }
function fromDayKey(key: string): Date { const [y, m, day] = key.split("-").map(Number); return new Date(y, m, day); }
function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }).replace(" ", "").toLowerCase();
}

// Filter chip definitions — map onto the EventType union.
const FILTERS: { key: string; label: string; Icon: typeof Rocket; match: (e: MarketingEvent) => boolean }[] = [
  { key: "all", label: "All", Icon: List, match: () => true },
  { key: "launch", label: "Launches", Icon: Rocket, match: (e) => e.type === "launch" },
  { key: "production", label: "Production", Icon: Clapperboard, match: (e) => e.type === "production" },
  { key: "clip", label: "Clip drops", Icon: Scissors, match: (e) => e.type === "clip" },
  { key: "ad", label: "Ad flights", Icon: Radio, match: (e) => e.type === "ad" },
  { key: "kiosk", label: "Kiosk", Icon: Palette, match: (e) => e.type === "kiosk" },
];

export default function CalendarView({ m, onOpenView }: ViewProps) {
  void onOpenView;
  const [mode, setMode] = useState<Mode>("month");
  const [filter, setFilter] = useState<string>("all");
  const [showBuffer, setShowBuffer] = useState(true);
  // Anchor controls which month / week is in view; defaults to "now".
  const [anchor, setAnchor] = useState<Date>(() => startOfDay(new Date()));
  const [dragId, setDragId] = useState<string | null>(null);
  const [overKey, setOverKey] = useState<string | null>(null);

  const today = useMemo(() => startOfDay(new Date()), []);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  // The visible, filtered slice of the spine.
  const visible = useMemo(() => {
    const matchFilter = FILTERS.find((f) => f.key === filter) || FILTERS[0];
    return m.events.filter((e) => {
      if (!showBuffer && e.source === "buffer") return false;
      return matchFilter.match(e);
    });
  }, [m.events, filter, showBuffer]);

  const dragEvent = dragId ? m.events.find((e) => e.id === dragId) || null : null;

  function handleDragStart(ev: DragStartEvent) { setDragId(String(ev.active.id)); }
  function handleDragEnd(ev: DragEndEvent) {
    const id = String(ev.active.id);
    const target = ev.over ? String(ev.over.id) : null;
    setDragId(null);
    setOverKey(null);
    if (!target) return;
    const cur = m.events.find((e) => e.id === id);
    if (!cur) return;
    const dest = fromDayKey(target);
    const old = new Date(cur.start);
    if (sameDay(dest, old)) return;
    // Preserve time-of-day; only the date moves.
    const next = new Date(dest);
    next.setHours(old.getHours(), old.getMinutes(), 0, 0);
    m.moveEvent(id, next.toISOString());
  }

  function addEvent() {
    const start = new Date();
    start.setHours(9, 0, 0, 0);
    m.addEvent({ title: "New marketing item", type: "manual", status: "idea", source: "manual", start: start.toISOString() });
  }
  function addBufferPost() {
    const start = new Date();
    start.setHours(11, 0, 0, 0);
    m.addEvent({ title: "Buffer post", type: "buffer", status: "idea", source: "buffer", channel: "x", start: start.toISOString() });
  }

  const monthLabel = anchor.toLocaleDateString([], { month: "long", year: "numeric" });

  return (
    <div style={{ padding: "22px 26px 60px", fontFamily: ft }}>
      {/* ── Page head ── */}
      <div style={S.phead}>
        <div>
          <h1 style={S.h1}>
            <CalendarDays size={22} color={D.cyan} style={{ verticalAlign: -3, marginRight: 6 }} />
            Marketing Calendar
          </h1>
          <div style={S.sub}>
            {monthLabel} · one item, every view. Production flows in automatically; you add the marketing layer.
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          {/* Prev / today / next */}
          <div style={S.navGroup}>
            <button style={S.navBtn} title="Previous"
              onClick={() => setAnchor((a) => mode === "week" ? addDays(a, -7) : new Date(a.getFullYear(), a.getMonth() - 1, 1))}>
              <ChevronGlyph dir="left" />
            </button>
            <button style={S.todayBtn} onClick={() => setAnchor(startOfDay(new Date()))}>Today</button>
            <button style={S.navBtn} title="Next"
              onClick={() => setAnchor((a) => mode === "week" ? addDays(a, 7) : new Date(a.getFullYear(), a.getMonth() + 1, 1))}>
              <ChevronGlyph dir="right" />
            </button>
          </div>
          {/* View tabs */}
          <div style={S.vtabs}>
            <Vtab on={mode === "month"} onClick={() => setMode("month")} Icon={LayoutGrid}>Month</Vtab>
            <Vtab on={mode === "week"} onClick={() => setMode("week")} Icon={Columns3}>Week</Vtab>
            <Vtab on={mode === "agenda"} onClick={() => setMode("agenda")} Icon={List}>Agenda</Vtab>
          </div>
          <button style={S.btn} onClick={addBufferPost}
            onMouseEnter={(e) => hov(e, true)} onMouseLeave={(e) => hov(e, false)}>
            <Plus size={13} style={{ verticalAlign: -2, marginRight: 5 }} /> Buffer post
          </button>
          <button style={{ ...S.btn, ...S.btnPrimary }} onClick={addEvent}
            onMouseEnter={(e) => { e.currentTarget.style.filter = "brightness(1.08)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.filter = "none"; }}>
            <Plus size={13} style={{ verticalAlign: -2, marginRight: 5 }} /> Event
          </button>
        </div>
      </div>

      {/* ── Filter chips + buffer toggle ── */}
      <div style={S.chips}>
        {FILTERS.map((f) => {
          const on = filter === f.key;
          return (
            <span key={f.key} onClick={() => setFilter(f.key)}
              style={{ ...S.chip, ...(on ? S.chipOn : null) }}>
              {f.key !== "all" && <f.Icon size={11} style={{ verticalAlign: -2, marginRight: 3 }} />}
              {f.label}
            </span>
          );
        })}
        <span style={{ flex: 1 }} />
        <span onClick={() => setShowBuffer((v) => !v)}
          style={{ ...S.toggle, ...(showBuffer ? S.toggleOn : null) }}>
          <span style={{ ...S.sw, ...(showBuffer ? S.swOn : null) }}>
            <span style={{ ...S.knob, ...(showBuffer ? S.knobOn : null) }} />
          </span>
          <Send size={12} style={{ verticalAlign: -2 }} /> Buffer posts
        </span>
      </div>

      {/* ── The view layer ── */}
      <DndContext sensors={sensors} collisionDetection={closestCenter}
        onDragStart={handleDragStart} onDragEnd={handleDragEnd}
        onDragOver={(e) => setOverKey(e.over ? String(e.over.id) : null)}
        onDragCancel={() => { setDragId(null); setOverKey(null); }}>
        {mode === "month" && (
          <MonthGrid anchor={anchor} today={today} events={visible} overKey={overKey} dragId={dragId} />
        )}
        {mode === "week" && (
          <WeekColumns anchor={anchor} today={today} events={visible} />
        )}
        {mode === "agenda" && (
          <AgendaList today={today} events={visible} />
        )}
        <DragOverlay dropAnimation={null}>
          {dragEvent ? <EventChip e={dragEvent} overlay /> : null}
        </DragOverlay>
      </DndContext>

      {mode !== "agenda" && visible.length === 0 && (
        <div style={S.empty}>No events match this filter. Adjust the chips above or add one.</div>
      )}
    </div>
  );
}

/* ═══════════════════ MONTH ═══════════════════ */
function MonthGrid({ anchor, today, events, overKey, dragId }: {
  anchor: Date; today: Date; events: MarketingEvent[]; overKey: string | null; dragId: string | null;
}) {
  // Build a 6-week (42-cell) grid Monday-aligned around the anchor month.
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const lead = mondayIdx(first);
  const gridStart = addDays(first, -lead);
  const cells = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));

  const byDay = useMemo(() => {
    const map = new Map<string, MarketingEvent[]>();
    for (const e of events) {
      const k = ymd(startOfDay(new Date(e.start)));
      const arr = map.get(k) || [];
      arr.push(e);
      map.set(k, arr);
    }
    for (const arr of map.values()) arr.sort((a, b) => +new Date(a.start) - +new Date(b.start));
    return map;
  }, [events]);

  // "+N more" overflow popover (Google-Cal style): which day is expanded.
  const [more, setMore] = useState<{ day: Date; events: MarketingEvent[]; rect: DOMRect } | null>(null);

  // Responsive row height: the six week-rows share whatever vertical space is
  // left below the header, so the month always *fills the screen* without
  // overflowing it (the old fixed 124px rows ran off the bottom on laptops and
  // left squat landscape cells on wide monitors). Measured from the grid's own
  // top, recomputed on resize.
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [rowH, setRowH] = useState(116);
  useEffect(() => {
    const calc = () => {
      const el = wrapRef.current;
      if (!el) return;
      const top = el.getBoundingClientRect().top;
      const avail = window.innerHeight - top - 22; // bottom breathing room
      setRowH(Math.max(84, Math.floor((avail - GRID_GAP * 5) / 6)));
    };
    calc();
    window.addEventListener("resize", calc);
    return () => window.removeEventListener("resize", calc);
  }, []);
  // Chip capacity scales with the row height; the rest collapse into "+N more".
  const maxChips = Math.max(2, Math.floor((rowH - 26) / 18));

  return (
    <div>
      <div style={S.dow}>{DOW.map((d) => <span key={d} style={S.dowCell}>{d}</span>)}</div>
      <div ref={wrapRef} style={{ ...S.month, gridAutoRows: rowH }}>
        {cells.map((day) => {
          const key = ymd(day);
          const inMonth = day.getMonth() === anchor.getMonth();
          const isToday = sameDay(day, today);
          const dayEvents = byDay.get(key) || [];
          return (
            <DayCell key={key} dayKey={key} dayNum={day.getDate()} inMonth={inMonth}
              isToday={isToday} isOver={overKey === key} dragId={dragId} events={dayEvents}
              maxChips={maxChips}
              onMore={(rect) => setMore({ day, events: dayEvents, rect })} />
          );
        })}
      </div>
      {more && (
        <DayMorePopover day={more.day} events={more.events} rect={more.rect} onClose={() => setMore(null)} />
      )}
    </div>
  );
}

function DayCell({ dayKey, dayNum, inMonth, isToday, isOver, dragId, events, maxChips, onMore }: {
  dayKey: string; dayNum: number; inMonth: boolean; isToday: boolean;
  isOver: boolean; dragId: string | null; events: MarketingEvent[]; maxChips: number;
  onMore: (rect: DOMRect) => void;
}) {
  const { setNodeRef } = useDroppable({ id: dayKey });
  const shown = events.slice(0, maxChips);
  const extra = events.length - shown.length;
  return (
    <div ref={setNodeRef} style={{
      ...S.cell,
      ...(inMonth ? null : S.cellMuted),
      ...(isToday ? S.cellToday : null),
      ...(isOver ? S.cellOver : null),
    }}>
      <div style={{ ...S.cellN, ...(isToday ? { color: D.cyan } : null) }}>{dayNum}</div>
      <div style={S.cellBody}>
        {shown.map((e) => <DraggableChip key={e.id} e={e} hidden={dragId === e.id} />)}
        {extra > 0 && (
          <button style={S.more}
            onClick={(ev) => { ev.stopPropagation(); onMore(ev.currentTarget.getBoundingClientRect()); }}>
            +{extra} more
          </button>
        )}
      </div>
    </div>
  );
}

function DraggableChip({ e, hidden }: { e: MarketingEvent; hidden: boolean }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: e.id });
  const { open } = useEventInteractions(e);
  const click = useDragClick(open);
  return (
    <div ref={setNodeRef} {...attributes} {...listeners} {...click}
      style={{ opacity: hidden || isDragging ? 0.25 : 1, touchAction: "none", cursor: "grab" }}>
      <EventChip e={e} />
    </div>
  );
}

// The "+N more" overflow popover — lists every event on the day; each row opens
// the editor. Closes on outside-click or Esc.
function DayMorePopover({ day, events, rect, onClose }: {
  day: Date; events: MarketingEvent[]; rect: DOMRect; onClose: () => void;
}) {
  const { openEdit } = useCreate();
  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => { if (ev.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const W = 268;
  const left = Math.max(8, Math.min(rect.left, window.innerWidth - W - 8));
  const top = Math.min(rect.bottom + 6, window.innerHeight - 340);
  return createPortal(
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 90 }} />
      <div style={{ ...S.morePop, left, top, width: W }} onClick={(e) => e.stopPropagation()}>
        <div style={S.morePopHead}>
          {day.toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" }).toUpperCase()}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 300, overflowY: "auto" }}>
          {events.map((e) => (
            <div key={e.id} style={{ cursor: "pointer" }}
              onClick={() => { onClose(); openEdit(e); }}>
              <EventChip e={e} />
            </div>
          ))}
        </div>
      </div>
    </>,
    document.body,
  );
}

/* ═══════════════════ WEEK ═══════════════════ */
function WeekColumns({ anchor, today, events }: { anchor: Date; today: Date; events: MarketingEvent[] }) {
  const lead = mondayIdx(anchor);
  const weekStart = addDays(startOfDay(anchor), -lead);
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  return (
    <div style={S.week}>
      {days.map((day, i) => {
        const isToday = sameDay(day, today);
        const dayEvents = events
          .filter((e) => sameDay(new Date(e.start), day))
          .sort((a, b) => +new Date(a.start) - +new Date(b.start));
        return (
          <WeekCol key={ymd(day)} dayKey={ymd(day)}>
            <div style={{ ...S.wh, ...(isToday ? { color: D.cyan } : null) }}>
              {DOW[i]}
              <b style={{ ...S.whB, ...(isToday ? { color: D.cyan } : null) }}>{day.getDate()}</b>
            </div>
            {dayEvents.length === 0
              ? <div style={S.weekEmpty}>—</div>
              : dayEvents.map((e) => <WeekEventRow key={e.id} e={e} />)}
          </WeekCol>
        );
      })}
    </div>
  );
}

// Week columns are also drop targets so DnD works across modes.
function WeekCol({ dayKey, children }: { dayKey: string; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: dayKey });
  return (
    <div ref={setNodeRef} style={{ ...S.wcol, ...(isOver ? { borderColor: D.cyan, boxShadow: `0 0 14px ${D.cyan}33` } : null) }}>
      {children}
    </div>
  );
}

function WeekEventRow({ e }: { e: MarketingEvent }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: e.id });
  const col = TYPE_COLOR[e.type];
  const ix = useEventInteractions(e);
  const click = useDragClick(ix.open);
  return (
    <div ref={setNodeRef} {...attributes} {...listeners} {...click} {...ix.hoverHandlers}
      style={{
        opacity: isDragging ? 0.3 : 1, touchAction: "none", cursor: "pointer",
        borderRadius: 8, padding: "7px 8px", marginBottom: 6,
        background: tint(col, e.source === "buffer" ? 0.16 : 0.1),
        border: e.source === "buffer" ? `1px dashed ${tint(col, 0.5)}` : `1px solid ${tint(col, 0.22)}`,
      }}>
      {ix.hover}
      <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 3 }}>
        <span style={{ ...S.statusDot, background: STATUS_COLOR[e.status] }} />
        <span style={{ fontFamily: mn, fontSize: 9, color: D.txm }}>{fmtTime(e.start)}</span>
        {e.channel && <ChannelPill keyName={e.channel} />}
      </div>
      <div style={{ fontSize: 11.5, color: D.tx, lineHeight: 1.25 }}>{e.title}</div>
    </div>
  );
}

/* ═══════════════════ AGENDA ═══════════════════ */
function AgendaList({ today, events }: { today: Date; events: MarketingEvent[] }) {
  const groups = useMemo(() => {
    const upcoming = events
      .filter((e) => startOfDay(new Date(e.start)) >= today)
      .sort((a, b) => +new Date(a.start) - +new Date(b.start));
    const map = new Map<string, MarketingEvent[]>();
    for (const e of upcoming) {
      const k = ymd(startOfDay(new Date(e.start)));
      const arr = map.get(k) || [];
      arr.push(e);
      map.set(k, arr);
    }
    return Array.from(map.entries());
  }, [events, today]);

  if (groups.length === 0) {
    return <div style={S.empty}>Nothing scheduled from today forward.</div>;
  }
  return (
    <div>
      {groups.map(([key, items]) => {
        const day = fromDayKey(key);
        const isToday = sameDay(day, today);
        const hasBuffer = items.some((x) => x.source === "buffer");
        return (
          <div key={key} style={{ ...S.agRow, ...(hasBuffer ? { background: tint(D.cyan, 0.02) } : null) }}>
            <div style={S.agDate}>
              {day.toLocaleDateString([], { month: "short", day: "numeric" }).toUpperCase()}
              {isToday && <span style={{ color: D.cyan, display: "block" }}>today</span>}
            </div>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
              {items.map((e) => <AgendaItem key={e.id} e={e} />)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function AgendaItem({ e }: { e: MarketingEvent }) {
  const col = TYPE_COLOR[e.type];
  const ix = useEventInteractions(e);
  return (
    <div onClick={ix.onClick} {...ix.hoverHandlers} style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer" }}>
      {ix.hover}
      <span style={{ width: 3, alignSelf: "stretch", borderRadius: 3, background: col, flex: "none", minHeight: 30 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 14, color: D.tx }}>{e.title}</span>
          {e.channel && <ChannelPill keyName={e.channel} />}
        </div>
        <small style={S.agSmall}>
          <span style={{ ...S.statusDot, background: STATUS_COLOR[e.status], display: "inline-block", marginRight: 5, verticalAlign: 1 }} />
          {fmtTime(e.start)} · {e.type}{e.source === "buffer" ? " · buffer post" : ""} · {STATUS_LABEL[e.status]}
        </small>
      </div>
    </div>
  );
}

/* ═══════════════════ Shared bits ═══════════════════ */
function EventChip({ e, overlay }: { e: MarketingEvent; overlay?: boolean }) {
  const col = TYPE_COLOR[e.type];
  const isBuf = e.source === "buffer";
  const t = new Date(e.start);
  const showTime = t.getHours() !== 0 || t.getMinutes() !== 0;
  const ix = useEventInteractions(e);
  return (
    <>
      <div
        {...(overlay ? {} : ix.hoverHandlers)}
        style={{
          ...S.ev,
          background: tint(col, isBuf ? 0.16 : 0.13),
          color: lighten(col),
          border: isBuf ? `1px dashed ${tint(col, 0.5)}` : "1px solid transparent",
          boxShadow: overlay ? `0 8px 24px rgba(0,0,0,0.55), 0 0 0 1px ${tint(col, 0.4)}` : "none",
          cursor: overlay ? "grab" : "pointer",
        }}>
        {overlay && <GripVertical size={10} style={{ flex: "none", opacity: 0.7 }} />}
        <span style={{ ...S.statusDot, background: STATUS_COLOR[e.status] }} />
        {e.channel
          ? <span style={{ fontFamily: mn, fontSize: 8.5, color: channelOf(e.channel).c, flex: "none" }}>{channelOf(e.channel).s}</span>
          : null}
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {showTime ? fmtTime(e.start) + " " : ""}{e.title}
        </span>
      </div>
      {!overlay && ix.hover}
    </>
  );
}

function ChannelPill({ keyName }: { keyName: string }) {
  const ch = channelOf(keyName);
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4, fontFamily: mn, fontSize: 8.5,
      letterSpacing: 0.4, color: ch.c, border: `1px solid ${ch.c}44`, background: ch.c + "12",
      borderRadius: 999, padding: "1px 6px",
    }}>
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: ch.c }} /> {ch.s}
    </span>
  );
}

function Vtab({ on, onClick, Icon, children }: {
  on: boolean; onClick: () => void; Icon: typeof Rocket; children: React.ReactNode;
}) {
  return (
    <button onClick={onClick} style={{ ...S.vtabBtn, ...(on ? S.vtabOn : null) }}
      onMouseEnter={(e) => { if (!on) e.currentTarget.style.color = D.tx; }}
      onMouseLeave={(e) => { if (!on) e.currentTarget.style.color = D.txm; }}>
      <Icon size={13} style={{ verticalAlign: -2, marginRight: 5 }} />{children}
    </button>
  );
}

function ChevronGlyph({ dir }: { dir: "left" | "right" }) {
  return (
    <span style={{ fontFamily: mn, fontSize: 14, lineHeight: 1, color: D.txm }}>{dir === "left" ? "‹" : "›"}</span>
  );
}

function hov(e: React.MouseEvent<HTMLButtonElement>, on: boolean) {
  e.currentTarget.style.color = on ? D.tx : D.txm;
  e.currentTarget.style.borderColor = on ? "rgba(255,255,255,0.2)" : D.border;
}

// ─── Color utilities (translate hex token → rgba tint / lighter text) ───
function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function tint(hex: string, a: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}
function lighten(hex: string): string {
  const [r, g, b] = hexToRgb(hex);
  const mix = (c: number) => Math.round(c + (255 - c) * 0.45);
  return `rgb(${mix(r)},${mix(g)},${mix(b)})`;
}

// ─── Style objects (module scope, per house pattern) ───
const S: Record<string, React.CSSProperties> = {
  phead: { display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, marginBottom: 18, flexWrap: "wrap" },
  h1: { fontFamily: gf, fontWeight: 700, fontSize: 30, letterSpacing: "-0.8px", margin: 0, color: D.tx },
  sub: { color: D.txm, fontSize: 13, marginTop: 3 },

  navGroup: { display: "inline-flex", border: `1px solid ${D.border}`, borderRadius: 10, overflow: "hidden" },
  navBtn: { background: "transparent", border: "none", color: D.txm, cursor: "pointer", padding: "9px 11px", display: "inline-flex", alignItems: "center" },
  todayBtn: { background: "transparent", border: "none", borderLeft: `1px solid ${D.border}`, borderRight: `1px solid ${D.border}`, color: D.txm, cursor: "pointer", padding: "9px 12px", fontFamily: mn, fontSize: 10.5, letterSpacing: 0.5 },

  vtabs: { display: "inline-flex", border: `1px solid ${D.border}`, borderRadius: 10, overflow: "hidden" },
  vtabBtn: { fontFamily: mn, fontSize: 11, letterSpacing: "0.5px", color: D.txm, background: "transparent", border: "none", padding: "9px 15px", cursor: "pointer", transition: "color 0.16s" },
  vtabOn: { color: "#06060c", background: `linear-gradient(135deg, ${D.cyan}, ${D.violet})`, fontWeight: 700 },

  btn: { fontFamily: mn, fontSize: 11, letterSpacing: "0.5px", borderRadius: 9, padding: "9px 14px", cursor: "pointer", border: `1px solid ${D.border}`, background: "transparent", color: D.txm, transition: "0.16s" },
  btnPrimary: { background: `linear-gradient(135deg, ${D.amber}, #d88f2c)`, color: "#1a1206", border: "none", fontWeight: 700 },

  chips: { display: "flex", gap: 7, flexWrap: "wrap", marginBottom: 16, alignItems: "center" },
  chip: { fontFamily: mn, fontSize: 10, letterSpacing: "0.5px", border: `1px solid ${D.border}`, borderRadius: 999, padding: "5px 11px", color: D.txm, cursor: "pointer", transition: "0.16s" },
  chipOn: { color: D.cyan, borderColor: `${D.cyan}66`, background: `${D.cyan}12` },

  toggle: { display: "inline-flex", alignItems: "center", gap: 8, fontFamily: mn, fontSize: 11, color: D.txm, cursor: "pointer", border: `1px solid ${D.border}`, borderRadius: 999, padding: "6px 12px", transition: "0.16s" },
  toggleOn: { color: D.cyan, borderColor: `${D.cyan}66` },
  sw: { width: 30, height: 17, borderRadius: 999, background: "#1a1a22", position: "relative", transition: "0.18s", flex: "none" },
  swOn: { background: `${D.cyan}66` },
  knob: { position: "absolute", top: 2, left: 2, width: 13, height: 13, borderRadius: "50%", background: D.txm, transition: "0.18s" },
  knobOn: { left: 15, background: D.cyan },

  dow: { display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 6, marginBottom: 6 },
  dowCell: { fontFamily: mn, fontSize: 9, color: D.txd, textAlign: "center", letterSpacing: 0.5 },
  // Six fixed-height rows → the grid is perfectly regular no matter how busy a
  // day is; overflow is handled per-cell by the "+N more" affordance.
  month: { display: "grid", gridTemplateColumns: "repeat(7,1fr)", gridAutoRows: 116, gap: GRID_GAP },
  cell: { minHeight: 0, borderRadius: 9, background: "#0c0c12", border: `1px solid ${D.border}`, padding: 6, position: "relative", display: "flex", flexDirection: "column", overflow: "hidden", transition: "border-color 0.14s, box-shadow 0.14s, background 0.14s" },
  cellMuted: { opacity: 0.4 },
  cellToday: { outline: `1px solid ${D.cyan}`, boxShadow: `0 0 14px ${D.cyan}2e` },
  cellOver: { borderColor: D.cyan, background: `${D.cyan}10`, boxShadow: `0 0 16px ${D.cyan}33` },
  cellN: { fontFamily: mn, fontSize: 10, color: D.txd, marginBottom: 2, flex: "none" },
  cellBody: { display: "flex", flexDirection: "column", flex: 1, minHeight: 0, overflow: "hidden" },
  more: { fontFamily: mn, fontSize: 9, letterSpacing: 0.3, color: D.txm, background: "transparent", border: "none", textAlign: "left", padding: "2px 6px", marginTop: 2, cursor: "pointer", flex: "none" },
  morePop: { position: "fixed", zIndex: 91, background: "#0c0c14", border: `1px solid ${D.border}`, borderRadius: 12, padding: 12, boxShadow: "0 18px 50px rgba(0,0,0,0.6)" },
  morePopHead: { fontFamily: mn, fontSize: 10, letterSpacing: 0.5, color: D.txm, marginBottom: 8 },

  ev: { fontSize: 10, borderRadius: 5, padding: "2px 6px", marginTop: 4, display: "flex", alignItems: "center", gap: 5, whiteSpace: "nowrap", overflow: "hidden", maxWidth: "100%" },
  statusDot: { width: 5, height: 5, borderRadius: "50%", flex: "none" },

  week: { display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 8 },
  wcol: { border: `1px solid ${D.border}`, borderRadius: 10, background: "#0b0b11", minHeight: "54vh", padding: 8, transition: "border-color 0.14s, box-shadow 0.14s" },
  wh: { fontFamily: mn, fontSize: 10, color: D.txd, textAlign: "center", marginBottom: 8 },
  whB: { display: "block", fontSize: 16, color: D.tx, fontFamily: ft },
  weekEmpty: { fontFamily: mn, fontSize: 9, color: D.txd, textAlign: "center", marginTop: 20 },

  agRow: { display: "flex", gap: 14, padding: "14px 8px", borderBottom: `1px solid ${D.border}`, borderRadius: 8 },
  agDate: { fontFamily: mn, fontSize: 11, color: D.amber, width: 76, flex: "none", lineHeight: 1.5 },
  agSmall: { display: "block", color: D.txm, fontFamily: mn, fontSize: 11, marginTop: 3 },

  empty: { color: D.txm, fontFamily: mn, fontSize: 12, padding: "30px 8px", textAlign: "center", border: `1px dashed ${D.border}`, borderRadius: 10, marginTop: 16 },
};
