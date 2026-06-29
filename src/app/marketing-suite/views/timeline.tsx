"use client";
// MarketingSUITE · Timeline — every marketing milestone on one time axis.
//
// Two reads of the same spine:
//   • GANTT  — horizontal lanes (grouped by Type or Campaign). Each lane packs
//     its events into as few non-overlapping sub-rows as possible (interval
//     packing) so bars/markers never override each other; expand a lane to
//     force one row per task. A live NOW playhead sweeps the axis.
//   • AGENDA — a clean chronological list grouped by day (Past / Today / next
//     days). Zero overlap, dense-friendly, great for "what's coming".
//
// Range presets (1W / 2W / 1M / Quarter) zoom the Gantt window; day labels
// thin out automatically as the window widens. Read-only over `m`.
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  GanttChart, CalendarRange, ChevronRight, ChevronDown, Diamond, Triangle,
  Radio, Layers, ArrowRight, List, Rows3, Tag, ChevronLeft, CalendarDays, Crosshair,
  Pencil, Check, Copy, Trash2, MoveRight, Repeat,
} from "lucide-react";
import { D, ft, gf, mn } from "../../shared-constants";
import {
  TYPE_COLOR, STATUS_COLOR, STATUS_LABEL, channelOf,
  eventRollout, eventSeries, eventEpisodeNo,
  type MarketingEvent, type EventType, type Campaign,
} from "../marketing-constants";
import type { ViewProps } from "../use-marketing";
import { useCreate } from "../create-context";
import { ContextMenu, type MenuItem, type MenuState } from "../components/context-menu";
import PageHeader from "../components/page-header";

// ─── Lane model ───
// A lane is just a label + accent + a predicate selecting its events, so the
// same packing/render code serves both "group by type" and "group by campaign".
interface Lane { key: string; label: string; accent: string; match: (e: MarketingEvent) => boolean; }

interface TypeLaneDef { key: string; label: string; types: EventType[]; accent: string; }
const TYPE_LANE_DEFS: TypeLaneDef[] = [
  { key: "production", label: "Production", types: ["production"],          accent: TYPE_COLOR.production },
  { key: "launch",     label: "Launch",     types: ["launch", "campaign"],  accent: TYPE_COLOR.launch },
  { key: "ads",        label: "Ads",        types: ["ad", "kiosk"],         accent: TYPE_COLOR.ad },
  { key: "clips",      label: "Clips",      types: ["clip", "buffer"],      accent: TYPE_COLOR.clip },
  { key: "strategy",   label: "Strategy",   types: ["strategy"],            accent: TYPE_COLOR.strategy },
  { key: "other",      label: "Other",      types: ["manual"],              accent: TYPE_COLOR.manual },
];

const DAY = 24 * 60 * 60 * 1000;
const LABEL_W = 140;        // sticky lane-label gutter
const AXIS_H = 50;          // time-axis header height
const LANE_PAD_Y = 8;       // vertical breathing room inside a lane
const ROW_COLLAPSED = 28;   // packed sub-row height
const ROW_EXPANDED = 30;    // per-task row height when expanded
const BAR_H = 20;           // event bar height
const PACK_GAP = 8;         // min px gap between two items on one packed sub-row
const MIN_BAR = 30;         // min ranged-bar footprint for packing
const POINT_SLOT = 26;      // horizontal slot a point marker reserves for packing

// Weighted weekly scroll: one "page" shows N weeks at a fixed scale; the whole
// track spans a 90-day cap, so you scroll week-by-week (week 1 → week 2 → …).
// Past 90 days, hand off to the Calendar.
const SPAN_DAYS = 90;
const DENSITIES = [
  { key: "1w", label: "Week",  weeks: 1 },
  { key: "2w", label: "2 wk",  weeks: 2 },
  { key: "4w", label: "Month", weeks: 4 },
] as const;
type DensityKey = (typeof DENSITIES)[number]["key"];

function startOfDay(d: Date): Date { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
function startOfWeek(d: Date): Date { // Monday-anchored
  const x = startOfDay(d); const day = (x.getDay() + 6) % 7; x.setDate(x.getDate() - day); return x;
}
function fmtDay(d: Date) { return d.toLocaleDateString(undefined, { month: "short", day: "numeric" }); }
function fmtTime(d: Date) { return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }); }
function isWeekend(d: Date) { const g = d.getDay(); return g === 0 || g === 6; }

interface TipState { id: string; x: number; y: number; below: boolean; }
type ViewMode = "gantt" | "agenda";
type GroupBy = "type" | "campaign" | "rollout" | "series";

const scrollBtn: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 4, cursor: "pointer",
  fontFamily: mn, fontSize: 10.5, letterSpacing: 0.3, padding: "6px 11px",
  border: "none", background: "transparent", color: D.txm,
};

// Right-click actions for a timeline item: re-categorize (move it into another
// lane / campaign), reschedule (the Gantt has no drag, so moves happen here),
// plus the standard edit / status / duplicate / delete. All mutate the spine.
function timelineMenuItems(
  m: ViewProps["m"], e: MarketingEvent, openEdit: (e: MarketingEvent) => void,
  ctx: { groupBy: GroupBy; campaigns: Campaign[]; now: Date },
): MenuItem[] {
  const shift = (days: number) => { const d = new Date(e.start); d.setDate(d.getDate() + days); m.moveEvent(e.id, d.toISOString()); };
  const toToday = () => { const t = new Date(e.start); const d = new Date(ctx.now); d.setHours(t.getHours(), t.getMinutes(), 0, 0); m.moveEvent(e.id, d.toISOString()); };
  const items: MenuItem[] = [
    { label: "Edit details", icon: <Pencil size={13} />, onClick: () => openEdit(e) },
    { label: e.status === "done" ? "Mark not done" : "Mark done", icon: <Check size={13} />, onClick: () => m.updateEvent(e.id, { status: e.status === "done" ? "scheduled" : "done" }) },
  ];
  // Repurpose — move the item into another lane / category.
  if (ctx.groupBy === "type") {
    items.push({ sep: true }, { heading: "Move to lane" });
    for (const def of TYPE_LANE_DEFS) {
      const active = def.types.includes(e.type);
      items.push({ label: def.label, dot: def.accent, active, onClick: () => { if (!active) m.updateEvent(e.id, { type: def.types[0] }); } });
    }
  } else {
    items.push({ sep: true }, { heading: "Move to campaign" });
    for (const c of ctx.campaigns) {
      const active = e.campaignId === c.id;
      items.push({ label: c.name, dot: c.color || D.violet, active, onClick: () => { if (!active) m.updateEvent(e.id, { campaignId: c.id }); } });
    }
    items.push({ label: "Unassigned", dot: D.txm, active: !e.campaignId, onClick: () => { if (e.campaignId) m.updateEvent(e.id, { campaignId: null }); } });
  }
  // Reschedule — no drag on the timeline, so move it from here.
  items.push(
    { sep: true }, { heading: "Reschedule" },
    { label: "To today", icon: <CalendarDays size={13} />, onClick: toToday },
    { label: "Back 1 day", icon: <ChevronLeft size={13} />, onClick: () => shift(-1) },
    { label: "Forward 1 day", icon: <ChevronRight size={13} />, onClick: () => shift(1) },
    { label: "Forward 1 week", icon: <MoveRight size={13} />, onClick: () => shift(7) },
    { label: "Pick date / time…", icon: <CalendarRange size={13} />, onClick: () => openEdit(e) },
  );
  items.push(
    { sep: true },
    { label: "Duplicate", icon: <Copy size={13} />, onClick: () => m.addEvent({ title: e.title + " (copy)", type: e.type, status: "idea", start: e.start, end: e.end, channel: e.channel, campaignId: e.campaignId, source: "manual", payload: { ...(e.payload || {}) } }) },
    { label: "Delete", icon: <Trash2 size={13} />, danger: true, onClick: () => m.removeEvent(e.id) },
  );
  return items;
}

export default function TimelineView({ m, onOpenView }: ViewProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [availH, setAvailH] = useState(560);
  const [tip, setTip] = useState<TipState | null>(null);
  const [mode, setMode] = useState<ViewMode>("gantt");
  const [groupBy, setGroupBy] = useState<GroupBy>("type");
  const [density, setDensity] = useState<DensityKey>("1w");
  const [open, setOpen] = useState<Record<string, boolean>>({ ads: true });
  const [hidden, setHidden] = useState<Record<string, boolean>>({});
  const [tick, setTick] = useState(0);          // re-render the playhead each minute
  const [pxPerDay, setPxPerDay] = useState(64);  // pixels/day so one page = N weeks
  const { openEdit } = useCreate();
  const [menu, setMenu] = useState<MenuState>(null);

  const now = useMemo(() => new Date(), [tick]); // eslint-disable-line react-hooks/exhaustive-deps
  const visibleWeeks = DENSITIES.find((d) => d.key === density)!.weeks;
  // Raise the shared right-click menu for any timeline item (Gantt bar/marker or
  // list row). Built fresh each open so lane/campaign "active" ticks stay current.
  const openItemMenu = (e: MarketingEvent, x: number, y: number) =>
    setMenu({ x, y, items: timelineMenuItems(m, e, openEdit, { groupBy, campaigns: m.campaigns, now }) });

  // Keep the NOW playhead honest without thrashing.
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 60 * 1000);
    return () => clearInterval(t);
  }, []);

  // Fill the viewport: the Gantt chart claims whatever height is left below the
  // controls (minus room for the legend), so lanes use the full screen instead
  // of floating in a short box. Scrolls internally once content runs taller.
  useEffect(() => {
    const calc = () => {
      const el = wrapRef.current; if (!el) return;
      setAvailH(Math.max(380, Math.floor(window.innerHeight - el.getBoundingClientRect().top - 58)));
    };
    calc(); window.addEventListener("resize", calc);
    return () => window.removeEventListener("resize", calc);
  }, [mode]);

  // ─── Lanes (Type / Campaign / Rollout / Series) ───
  const lanes: Lane[] = useMemo(() => {
    if (groupBy === "campaign") {
      const byId = new Map<string, Campaign>(m.campaigns.map((c) => [c.id, c]));
      const out: Lane[] = m.campaigns.map((c) => ({
        key: c.id, label: c.name, accent: c.color || D.violet,
        match: (e: MarketingEvent) => e.campaignId === c.id,
      }));
      out.push({ key: "_none", label: "Unassigned", accent: D.txm, match: (e) => !e.campaignId || !byId.has(e.campaignId) });
      // Drop campaign lanes with nothing in them so the chart stays legible.
      return out.filter((l) => m.events.some(l.match));
    }
    if (groupBy === "rollout") {
      // One lane per Rollout (release cycle): episodes read left-to-right
      // topic→film→edit→release→clips. Only tagged events appear here.
      const seen = new Map<string, { label: string; accent: string; first: number }>();
      m.events.forEach((e) => {
        const r = eventRollout(e); if (!r) return;
        const camp = m.campaigns.find((c) => c.id === e.campaignId);
        const epNo = eventEpisodeNo(e);
        const t = +new Date(e.start);
        const cur = seen.get(r);
        if (!cur) seen.set(r, { label: epNo != null ? `EP${epNo}` : r, accent: camp?.color || D.cyan, first: t });
        else if (t < cur.first) cur.first = t;
      });
      return Array.from(seen.entries())
        .sort((a, b) => a[1].first - b[1].first)
        .map(([id, meta]) => ({ key: id, label: meta.label, accent: meta.accent, match: (e: MarketingEvent) => eventRollout(e) === id }));
    }
    if (groupBy === "series") {
      // One lane per Series (flattened across campaigns).
      const defs = m.campaigns.flatMap((c) => c.series.map((s) => ({ s, c })));
      const out: Lane[] = defs.map(({ s, c }) => ({
        key: s.id, label: s.name, accent: c.color || D.cyan,
        match: (e: MarketingEvent) => eventSeries(e) === s.id,
      }));
      return out.filter((l) => m.events.some(l.match));
    }
    return TYPE_LANE_DEFS.map((d) => ({
      key: d.key, label: d.label, accent: d.accent,
      match: (e: MarketingEvent) => d.types.includes(e.type),
    }));
  }, [groupBy, m.campaigns, m.events]);

  // ─── Window: a fixed 90-day span, week-aligned, starting a week before now so
  // a little history scrolls in to the left and ~12 weeks of runway to the
  // right. The viewport only ever shows `visibleWeeks` at a time. ───
  const win = useMemo(() => {
    const from = startOfWeek(new Date(now.getTime() - 7 * DAY));
    const days = SPAN_DAYS;
    const to = startOfDay(new Date(from.getTime() + days * DAY));
    return { from, to, days };
  }, [now]);

  const trackW = win.days * pxPerDay;

  // Scale so one screen-width = `visibleWeeks` weeks; the 90-day track is wider
  // than the viewport, so you scroll week-by-week.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const measure = () => {
      const avail = el.clientWidth - LABEL_W - 1;
      if (avail > 80) setPxPerDay(Math.max(14, avail / (visibleWeeks * 7)));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [visibleWeeks]);

  const xOf = (d: Date) => ((d.getTime() - win.from.getTime()) / DAY) * pxPerDay;
  const nowX = xOf(now);

  // Recenter on "today" when the scale changes (and on first paint).
  const scrollToToday = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ left: Math.max(0, ((now.getTime() - win.from.getTime()) / DAY) * pxPerDay - pxPerDay * 2), behavior: "smooth" });
  }, [now, win.from, pxPerDay]);
  const nudgeWeek = (dir: 1 | -1) => { const el = scrollRef.current; if (el) el.scrollBy({ left: dir * pxPerDay * 7, behavior: "smooth" }); };
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollLeft = Math.max(0, ((now.getTime() - win.from.getTime()) / DAY) * pxPerDay - pxPerDay * 2);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pxPerDay]);

  // Adaptive axis density — thin out day labels as cells shrink.
  const showDayNum = pxPerDay >= 22;
  const showWeekday = pxPerDay >= 40;

  // ─── Group events into lanes (sorted by start) ───
  const laneEvents = useMemo(() => {
    const out: Record<string, MarketingEvent[]> = {};
    for (const lane of lanes) out[lane.key] = [];
    for (const e of m.events) {
      const lane = lanes.find((l) => l.match(e));
      if (lane) out[lane.key].push(e);
    }
    for (const k of Object.keys(out)) out[k].sort((a, b) => +new Date(a.start) - +new Date(b.start));
    return out;
  }, [m.events, lanes]);

  // ─── Day ticks ───
  const ticks = useMemo(() => {
    const arr: { i: number; x: number; date: Date; today: boolean; weekStart: boolean; weekend: boolean }[] = [];
    const today = startOfDay(now).getTime();
    for (let i = 0; i < win.days; i++) {
      const d = new Date(win.from.getTime() + i * DAY);
      arr.push({
        i, x: i * pxPerDay, date: d,
        today: startOfDay(d).getTime() === today,
        weekStart: d.getDay() === 1,
        weekend: isWeekend(d),
      });
    }
    return arr;
  }, [win.from, win.days, pxPerDay, now]);

  // Week band headers (Mon-anchored).
  const weekBands = useMemo(() => {
    const out: { x: number; w: number; label: string; hasNow: boolean }[] = [];
    for (let i = 0; i < win.days; i += 7) {
      const d = new Date(win.from.getTime() + i * DAY);
      const x = i * pxPerDay;
      const w = Math.min(7, win.days - i) * pxPerDay;
      const wkEnd = new Date(d.getTime() + 6 * DAY);
      const hasNow = now >= d && now < new Date(d.getTime() + 7 * DAY);
      out.push({ x, w, label: `${fmtDay(d)} – ${fmtDay(wkEnd)}`, hasNow });
    }
    return out;
  }, [win.from, win.days, pxPerDay, now]);

  const visibleLanes = lanes.filter((l) => !hidden[l.key]);

  // ─── Layout: pack each lane's events into non-overlapping sub-rows ───
  // Collapsed: greedy interval-packing (first sub-row whose last item ends
  // before this one starts). Expanded: one sub-row per task. Either way no two
  // items share a cell, so nothing overrides.
  const layout = useMemo(() => {
    const base: {
      lane: Lane; h: number; expanded: boolean; rowH: number;
      subCount: number; subOf: Map<string, number>;
    }[] = [];
    let natural = 0;
    for (const lane of visibleLanes) {
      const evs = laneEvents[lane.key] || [];
      const expanded = !!open[lane.key] && evs.length > 0;
      const subOf = new Map<string, number>();
      let subCount = 1;
      if (expanded) {
        evs.forEach((e, i) => subOf.set(e.id, i));
        subCount = Math.max(1, evs.length);
      } else {
        const lastX: number[] = []; // rightmost x reserved per sub-row
        for (const e of evs) {
          const x0 = xOf(new Date(e.start));
          const x1 = e.end ? Math.max(xOf(new Date(e.end)), x0 + MIN_BAR) : x0 + POINT_SLOT;
          let placed = -1;
          for (let r = 0; r < lastX.length; r++) {
            if (x0 >= lastX[r] + PACK_GAP) { placed = r; lastX[r] = x1; break; }
          }
          if (placed < 0) { placed = lastX.length; lastX.push(x1); }
          subOf.set(e.id, placed);
        }
        subCount = Math.max(1, lastX.length);
      }
      const rowH = expanded ? ROW_EXPANDED : ROW_COLLAPSED;
      const h = LANE_PAD_Y * 2 + subCount * rowH;
      base.push({ lane, h, expanded, rowH, subCount, subOf });
      natural += h;
    }
    // Spread any leftover vertical space evenly across lanes so the chart fills
    // the viewport; `pad` re-centers each lane's packed rows inside its taller
    // band. When content already overflows, extra is 0 and the chart scrolls.
    const body = Math.max(0, availH - AXIS_H - 2);
    const extra = base.length ? Math.max(0, body - natural) : 0;
    const per = base.length ? extra / base.length : 0;
    let y = 0;
    const rows = base.map((r) => {
      const h = r.h + per;
      const row = { ...r, top: y, h, pad: per / 2 };
      y += h;
      return row;
    });
    return { rows, total: Math.max(y, 120) };
  }, [visibleLanes, laneEvents, open, pxPerDay, win.from, win.days, availH]);

  function toggleOpen(k: string) { setOpen((o) => ({ ...o, [k]: !o[k] })); }
  function toggleHide(k: string) { setHidden((h) => ({ ...h, [k]: !h[k] })); }

  const totalEvents = m.events.length;
  const rangedCount = m.events.filter((e) => e.end).length;

  return (
    <div style={{ padding: "22px 26px 48px", fontFamily: ft, color: D.tx }}>
      {/* ── Page header ── */}
      <PageHeader
        id="timeline"
        title="Production Timeline"
        subtitle="Every production and marketing milestone on one axis. Overlapping items auto-stack so nothing collides — expand a lane for one row per task, or switch to Agenda for a clean chronological read."
        right={<>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 6, fontFamily: mn, fontSize: 9.5,
            letterSpacing: 0.4, color: D.txd, textTransform: "uppercase",
            border: `1px solid ${D.border}`, borderRadius: 8, padding: "5px 10px", background: D.card,
          }}>
            <Layers size={12} color={D.teal} />
            {totalEvents} events · {rangedCount} ranged
          </div>
          {/* View-mode switch */}
          <Segmented
            options={[
              { key: "gantt", label: "Gantt", Icon: GanttChart },
              { key: "agenda", label: "List", Icon: List },
            ]}
            value={mode}
            onChange={(v) => setMode(v as ViewMode)}
          />
        </>}
      />

      {mode === "gantt" ? (
        <>
          {/* ── Gantt controls: group-by + range ── */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 14, alignItems: "center" }}>
            <Segmented
              options={[
                { key: "type", label: "By type", Icon: Rows3 },
                { key: "campaign", label: "By campaign", Icon: Tag },
                { key: "rollout", label: "By rollout", Icon: Repeat },
                { key: "series", label: "By series", Icon: Radio },
              ]}
              value={groupBy}
              onChange={(v) => { setGroupBy(v as GroupBy); setOpen(v === "type" ? { ads: true } : {}); }}
            />
            {/* Scale (how many weeks fill the screen) */}
            <div style={{
              display: "inline-flex", border: `1px solid ${D.border}`, borderRadius: 9,
              overflow: "hidden", background: D.card,
            }}>
              {DENSITIES.map((r, i) => (
                <button
                  key={r.key}
                  onClick={() => setDensity(r.key)}
                  title={`${r.weeks} week${r.weeks > 1 ? "s" : ""} per screen`}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 5, cursor: "pointer",
                    fontFamily: mn, fontSize: 10.5, letterSpacing: 0.3, padding: "6px 13px",
                    border: "none", borderLeft: i ? `1px solid ${D.border}` : "none",
                    color: density === r.key ? D.tx : D.txm, background: density === r.key ? D.hover : "transparent",
                    transition: "background 0.14s, color 0.14s",
                  }}
                >
                  {i === 0 && <CalendarRange size={12} />} {r.label}
                </button>
              ))}
            </div>
            {/* Week scroller: ‹ prev · Today · next › */}
            <div style={{ display: "inline-flex", border: `1px solid ${D.border}`, borderRadius: 9, overflow: "hidden", background: D.card }}>
              <button onClick={() => nudgeWeek(-1)} title="Previous week" style={scrollBtn}><ChevronLeft size={13} /></button>
              <button onClick={scrollToToday} title="Jump to today" style={{ ...scrollBtn, borderLeft: `1px solid ${D.border}`, borderRight: `1px solid ${D.border}`, color: D.amber }}><Crosshair size={12} /> Today</button>
              <button onClick={() => nudgeWeek(1)} title="Next week" style={scrollBtn}><ChevronRight size={13} /></button>
            </div>
            {onOpenView && (
              <button onClick={() => onOpenView("calendar")} title="See the full picture in the Calendar" style={{
                display: "inline-flex", alignItems: "center", gap: 5, cursor: "pointer",
                fontFamily: mn, fontSize: 10, letterSpacing: 0.3, padding: "6px 11px", borderRadius: 9,
                border: `1px solid ${D.border}`, background: "transparent", color: D.txm,
              }}>
                <CalendarDays size={12} /> 90-day cap · Calendar →
              </button>
            )}
            <span style={{ flex: 1 }} />
            {/* Lane filter / expand chips */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", justifyContent: "flex-end" }}>
              {lanes.map((lane) => {
                const on = !hidden[lane.key];
                const count = (laneEvents[lane.key] || []).length;
                const expanded = !!open[lane.key] && count > 0;
                return (
                  <span key={lane.key} style={{
                    display: "inline-flex", alignItems: "center",
                    border: `1px solid ${on ? lane.accent + "55" : D.border}`,
                    background: on ? lane.accent + "10" : "transparent",
                    borderRadius: 999, overflow: "hidden", transition: "all 0.16s",
                  }}>
                    <button
                      onClick={() => toggleHide(lane.key)}
                      title={on ? "Hide lane" : "Show lane"}
                      style={{
                        display: "inline-flex", alignItems: "center", gap: 7, cursor: "pointer",
                        fontFamily: mn, fontSize: 10.5, letterSpacing: 0.3, textTransform: "uppercase",
                        padding: "5px 4px 5px 11px", border: "none", background: "transparent",
                        color: on ? D.tx : D.txd, maxWidth: 168,
                      }}
                    >
                      <span style={{
                        width: 8, height: 8, borderRadius: 999, flex: "none",
                        background: on ? lane.accent : D.txd,
                        boxShadow: on ? `0 0 8px ${lane.accent}88` : "none",
                      }} />
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{lane.label}</span>
                      <span style={{ color: on ? lane.accent : D.txd, fontSize: 9.5 }}>{count}</span>
                    </button>
                    <button
                      onClick={() => count > 0 && on && toggleOpen(lane.key)}
                      disabled={count === 0 || !on}
                      title={expanded ? "Collapse to packed track" : "Expand to per-task rows"}
                      style={{
                        display: "inline-flex", alignItems: "center", cursor: count > 0 && on ? "pointer" : "default",
                        padding: "5px 8px 5px 4px", border: "none", background: "transparent",
                        color: expanded ? lane.accent : D.txd, opacity: count > 0 && on ? 1 : 0.4,
                      }}
                    >
                      {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                    </button>
                  </span>
                );
              })}
            </div>
          </div>

          {/* ── Chart shell ── */}
          <div ref={wrapRef} style={{
            border: `1px solid ${D.border}`, borderRadius: 14, overflow: "hidden",
            background: D.cardGrad, boxShadow: D.glow, position: "relative",
          }}>
            <div ref={scrollRef} style={{ overflowX: "auto", overflowY: "auto", position: "relative", height: availH }}>
              <div style={{ minWidth: LABEL_W + trackW, position: "relative" }}>
                {/* ── Time axis header ── */}
                <div style={{
                  display: "flex", height: AXIS_H, position: "sticky", top: 0, zIndex: 6,
                  background: D.card, borderBottom: `1px solid ${D.border}`,
                }}>
                  <div style={{
                    width: LABEL_W, flex: "none", borderRight: `1px solid ${D.border}`,
                    position: "sticky", left: 0, zIndex: 7, background: D.card,
                    display: "flex", flexDirection: "column", justifyContent: "center", gap: 2,
                    padding: "0 0 0 14px",
                  }}>
                    <span style={{ fontFamily: mn, fontSize: 9, letterSpacing: 0.7, color: D.txd, textTransform: "uppercase" }}>
                      {groupBy === "campaign" ? "Campaigns" : groupBy === "rollout" ? "Rollouts" : groupBy === "series" ? "Series" : "Lanes"}
                    </span>
                    <span style={{ fontFamily: mn, fontSize: 9.5, color: D.teal }}>
                      {visibleWeeks === 1 ? "Week" : `${visibleWeeks}-week`} view · 90-day span
                    </span>
                  </div>
                  <div style={{ position: "relative", width: trackW, flex: "none" }}>
                    {weekBands.map((b, i) => (
                      <div key={i} style={{
                        position: "absolute", left: b.x, top: 6, width: b.w, height: 18,
                        borderLeft: `1px solid ${D.border}`,
                        display: "flex", alignItems: "center", padding: "0 8px",
                        fontFamily: mn, fontSize: 9.5, letterSpacing: 0.3, whiteSpace: "nowrap", overflow: "hidden",
                        color: b.hasNow ? D.amber : D.txm, fontWeight: b.hasNow ? 700 : 500,
                      }}>
                        {b.label}{b.hasNow && <span style={{ marginLeft: 6, fontSize: 8, color: D.amber }}>· NOW</span>}
                      </div>
                    ))}
                    {ticks.map((t) => (
                      <div key={t.i} style={{
                        position: "absolute", left: t.x, top: 27, width: pxPerDay, height: 20,
                        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                        gap: 0, overflow: "hidden",
                      }}>
                        {showWeekday && (
                          <span style={{
                            fontFamily: mn, fontSize: 8.5,
                            color: t.today ? D.amber : t.weekend ? D.txd : D.txm,
                            fontWeight: t.today ? 700 : 500,
                          }}>
                            {t.date.toLocaleDateString(undefined, { weekday: "short" }).slice(0, 2)}
                          </span>
                        )}
                        {(showDayNum && (showWeekday || t.weekStart || t.today)) && (
                          <span style={{
                            fontFamily: mn, fontSize: 10,
                            color: t.today ? D.amber : D.txd, fontWeight: t.today ? 700 : 500,
                          }}>
                            {t.date.getDate()}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* ── Lanes body ── */}
                <div style={{ position: "relative", height: layout.total, display: "flex" }}>
                  {/* Sticky label column */}
                  <div style={{
                    width: LABEL_W, flex: "none", position: "sticky", left: 0, zIndex: 5,
                    background: D.card, borderRight: `1px solid ${D.border}`,
                  }}>
                    {layout.rows.map(({ lane, top, h, expanded, subCount }) => (
                      <div
                        key={lane.key}
                        onClick={() => (laneEvents[lane.key] || []).length > 0 && toggleOpen(lane.key)}
                        style={{
                          position: "absolute", left: 0, right: 0, top, height: h,
                          borderBottom: `1px solid ${D.border}`, cursor: (laneEvents[lane.key] || []).length ? "pointer" : "default",
                          display: "flex", flexDirection: "column", justifyContent: "center",
                          padding: "0 0 0 12px", transition: "background 0.15s",
                        }}
                        onMouseEnter={(ev) => { ev.currentTarget.style.background = D.hover; }}
                        onMouseLeave={(ev) => { ev.currentTarget.style.background = "transparent"; }}
                      >
                        <div style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                          <span style={{ color: expanded ? lane.accent : D.txd, display: "inline-flex" }}>
                            {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                          </span>
                          <span style={{
                            fontFamily: mn, fontSize: 10, letterSpacing: 0.5, fontWeight: 700,
                            textTransform: "uppercase", color: lane.accent,
                            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: LABEL_W - 36,
                          }}>
                            {lane.label}
                          </span>
                        </div>
                        <div style={{ marginTop: 3, display: "inline-flex", alignItems: "center", gap: 5, paddingLeft: 17 }}>
                          <span style={{ width: 5, height: 5, borderRadius: 999, background: lane.accent }} />
                          <span style={{ fontFamily: mn, fontSize: 8.5, color: D.txd, letterSpacing: 0.2 }}>
                            {(laneEvents[lane.key] || []).length} {(laneEvents[lane.key] || []).length === 1 ? "item" : "items"}
                            {!expanded && subCount > 1 ? ` · ${subCount} rows` : ""}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Track area */}
                  <div style={{ position: "relative", width: trackW, flex: "none" }}>
                    <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
                      {ticks.map((t) => (
                        <React.Fragment key={t.i}>
                          {t.weekend && (
                            <div style={{
                              position: "absolute", left: t.x, top: 0, bottom: 0, width: pxPerDay,
                              background: "rgba(255,255,255,0.018)",
                            }} />
                          )}
                          <div style={{
                            position: "absolute", left: t.x, top: 0, bottom: 0, width: 1,
                            background: t.weekStart ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.022)",
                          }} />
                        </React.Fragment>
                      ))}
                    </div>

                    {/* NOW playhead */}
                    {nowX >= 0 && nowX <= trackW && (
                      <div style={{
                        position: "absolute", left: nowX, top: 0, bottom: 0, width: 2, zIndex: 4,
                        background: `linear-gradient(180deg, ${D.amber}, ${D.amber}22)`,
                        pointerEvents: "none", boxShadow: `0 0 14px ${D.amber}55`,
                      }}>
                        <div style={{
                          position: "absolute", top: -2, left: -4, width: 10, height: 10, borderRadius: 999,
                          background: D.amber, boxShadow: `0 0 12px ${D.amber}`,
                        }} />
                      </div>
                    )}

                    {/* Lane dividers */}
                    {layout.rows.map(({ lane, top, h }) => (
                      <div key={lane.key} style={{
                        position: "absolute", left: 0, right: 0, top: top + h - 1, height: 1,
                        background: D.border, pointerEvents: "none",
                      }} />
                    ))}

                    {/* Bars / markers (placed by packed sub-row) */}
                    {layout.rows.map(({ lane, top, expanded, rowH, subOf, pad }) => {
                      const evs = laneEvents[lane.key] || [];
                      return evs.map((e) => {
                        const sub = subOf.get(e.id) ?? 0;
                        const rowTop = top + LANE_PAD_Y + pad + sub * rowH;
                        return (
                          <EventItem
                            key={e.id}
                            e={e}
                            accent={lane.accent}
                            xOf={xOf}
                            trackW={trackW}
                            rowTop={rowTop}
                            rowH={rowH}
                            showLabel={expanded}
                            hovered={tip?.id === e.id}
                            onEnter={(x, y, below) => setTip({ id: e.id, x, y, below })}
                            onLeave={() => setTip((t) => (t?.id === e.id ? null : t))}
                            onContext={openItemMenu}
                          />
                        );
                      });
                    })}

                    {visibleLanes.length === 0 && (
                      <div style={{
                        position: "absolute", inset: 0, display: "flex", alignItems: "center",
                        justifyContent: "center", fontFamily: mn, fontSize: 12, color: D.txd,
                      }}>
                        {lanes.length === 0 ? "No events to plot yet." : "All lanes hidden — re-enable a chip above."}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Floating tooltip */}
              {tip && (() => {
                const e = m.events.find((ev) => ev.id === tip.id);
                if (!e) return null;
                return <Tooltip e={e} x={tip.x} y={tip.y} below={tip.below} />;
              })()}
            </div>
          </div>

          {/* ── Legend ── */}
          <div style={{
            marginTop: 14, display: "flex", flexWrap: "wrap", gap: 18,
            fontFamily: mn, fontSize: 10, color: D.txd, alignItems: "center",
          }}>
            <LegendItem icon={<span style={{ display: "inline-block", width: 20, height: 9, borderRadius: 3, background: `linear-gradient(90deg, ${D.teal}, ${D.teal}99)`, border: `1px solid ${D.teal}66` }} />} label="ranged event (start → end)" />
            <LegendItem icon={<Triangle size={9} color={D.amber} fill={D.amber} />} label="point milestone" />
            <LegendItem icon={<Diamond size={9} color={D.crimson} fill={D.crimson} />} label="ad / kiosk creative" />
            <LegendItem icon={<span style={{ display: "inline-block", width: 2, height: 12, background: D.amber, boxShadow: `0 0 8px ${D.amber}` }} />} label="NOW playhead" />
            <LegendItem icon={<Rows3 size={11} color={D.teal} />} label="overlaps auto-stack — hover any item for detail" />
          </div>
        </>
      ) : (
        <AgendaView m={m} now={now} onContext={openItemMenu} />
      )}
      {menu && <ContextMenu x={menu.x} y={menu.y} items={menu.items} onClose={() => setMenu(null)} />}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Segmented control (shared by mode / group-by switches).
function Segmented({ options, value, onChange }: {
  options: { key: string; label: string; Icon: React.ComponentType<{ size?: number }> }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div style={{ display: "inline-flex", border: `1px solid ${D.border}`, borderRadius: 9, overflow: "hidden", background: D.card }}>
      {options.map((o, i) => {
        const on = o.key === value;
        return (
          <button
            key={o.key}
            onClick={() => onChange(o.key)}
            style={{
              display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer",
              fontFamily: mn, fontSize: 10.5, letterSpacing: 0.3, padding: "6px 12px",
              border: "none", borderLeft: i ? `1px solid ${D.border}` : "none",
              color: on ? D.tx : D.txm, background: on ? D.hover : "transparent",
              transition: "background 0.14s, color 0.14s",
            }}
          >
            <o.Icon size={12} /> {o.label}
          </button>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// One event on the Gantt track: a ranged bar (clamped to the visible window,
// with edge notches when it continues off-screen) or a point marker.
function EventItem({
  e, accent, xOf, trackW, rowTop, rowH, showLabel, hovered, onEnter, onLeave, onContext,
}: {
  e: MarketingEvent;
  accent: string;
  xOf: (d: Date) => number;
  trackW: number;
  rowTop: number;
  rowH: number;
  showLabel: boolean;
  hovered: boolean;
  onEnter: (x: number, y: number, below: boolean) => void;
  onLeave: () => void;
  onContext: (e: MarketingEvent, x: number, y: number) => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const start = new Date(e.start);
  const end = e.end ? new Date(e.end) : null;
  const statusC = STATUS_COLOR[e.status];
  const ch = e.channel ? channelOf(e.channel) : null;
  const isAd = e.type === "ad" || e.type === "kiosk";

  function fire() {
    const el = ref.current;
    if (!el) return;
    const x = el.offsetLeft + Math.min(el.offsetWidth / 2, 60);
    const below = rowTop < 64;
    const y = below ? rowTop + rowH : rowTop;
    onEnter(x, y, below);
  }

  // ── Ranged bar ──
  if (end) {
    const rawL = xOf(start);
    const rawR = xOf(end);
    const left = Math.max(0, rawL);
    const right = Math.min(trackW, rawR);
    const w = Math.max(MIN_BAR, right - left);
    const clipL = rawL < 0;
    const clipR = rawR > trackW;
    return (
      <div
        ref={ref}
        data-tl-bar
        onMouseEnter={fire}
        onMouseLeave={onLeave}
        onContextMenu={(ev) => { ev.preventDefault(); onContext(e, ev.clientX, ev.clientY); }}
        style={{
          position: "absolute", left, top: rowTop + (rowH - BAR_H) / 2,
          width: w, height: BAR_H, cursor: "pointer", zIndex: hovered ? 9 : 2,
        }}
      >
        <div style={{
          position: "relative", height: "100%", borderRadius: 6,
          background: `linear-gradient(90deg, ${accent}3a, ${accent}1a)`,
          border: `1px solid ${accent}${hovered ? "cc" : "60"}`,
          borderLeftStyle: clipL ? "dashed" : "solid",
          borderRightStyle: clipR ? "dashed" : "solid",
          boxShadow: hovered ? `0 6px 20px ${accent}44` : "none",
          display: "flex", alignItems: "center", gap: 6, padding: "0 8px",
          overflow: "hidden", transition: "border-color 0.15s, box-shadow 0.15s",
        }}>
          {!clipL && <span style={{
            position: "absolute", left: 0, top: 0, bottom: 0, width: 3, background: accent,
            borderTopLeftRadius: 6, borderBottomLeftRadius: 6,
          }} />}
          <span style={{
            width: 6, height: 6, borderRadius: 999, background: statusC, flex: "none",
            boxShadow: `0 0 6px ${statusC}aa`, marginLeft: 2,
          }} />
          <span style={{
            fontFamily: ft, fontSize: 11, fontWeight: 500, color: D.tx,
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          }}>
            {e.title}
          </span>
          {ch && (
            <span style={{
              flex: "none", fontFamily: mn, fontSize: 8, color: ch.c,
              border: `1px solid ${ch.c}66`, borderRadius: 4, padding: "1px 4px", marginLeft: "auto",
            }}>
              {ch.s}
            </span>
          )}
        </div>
      </div>
    );
  }

  // ── Point marker ──
  const px = Math.max(0, Math.min(trackW - 6, xOf(start)));
  return (
    <div
      ref={ref}
      data-tl-bar
      onMouseEnter={fire}
      onMouseLeave={onLeave}
      onContextMenu={(ev) => { ev.preventDefault(); onContext(e, ev.clientX, ev.clientY); }}
      style={{
        position: "absolute", left: px - 8, top: rowTop + (rowH - BAR_H) / 2, height: BAR_H,
        display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer",
        zIndex: hovered ? 9 : 3, paddingRight: 6, maxWidth: showLabel ? trackW - px : undefined,
      }}
    >
      <span style={{ position: "relative", display: "inline-flex", flex: "none", filter: hovered ? `drop-shadow(0 0 6px ${accent})` : "none" }}>
        {isAd
          ? <Diamond size={15} color={accent} fill={accent} />
          : <Triangle size={14} color={accent} fill={accent} />}
        <span style={{
          position: "absolute", right: -2, top: -2, width: 6, height: 6, borderRadius: 999,
          background: statusC, border: `1.5px solid ${D.card}`,
        }} />
      </span>
      {showLabel && (
        <span style={{
          fontFamily: ft, fontSize: 11, fontWeight: 500, color: hovered ? D.tx : D.txm,
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", transition: "color 0.15s",
        }}>
          {e.title}
        </span>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// AGENDA — chronological list grouped by day. Past collapses to a thin strip;
// Today + upcoming days are full rows. No geometry, so nothing ever overlaps.
function AgendaView({ m, now, onContext }: { m: ViewProps["m"]; now: Date; onContext: (e: MarketingEvent, x: number, y: number) => void }) {
  const today = startOfDay(now).getTime();
  const groups = useMemo(() => {
    const byDay = new Map<number, MarketingEvent[]>();
    for (const e of m.events) {
      const k = startOfDay(new Date(e.start)).getTime();
      if (!byDay.has(k)) byDay.set(k, []);
      byDay.get(k)!.push(e);
    }
    const keys = [...byDay.keys()].sort((a, b) => a - b);
    return keys.map((k) => ({
      day: new Date(k),
      key: k,
      past: k < today,
      isToday: k === today,
      events: byDay.get(k)!.sort((a, b) => +new Date(a.start) - +new Date(b.start)),
    }));
  }, [m.events, today]);

  const campaignName = (id?: string | null) => m.campaigns.find((c) => c.id === id)?.name;

  if (!groups.length) {
    return (
      <div style={{ padding: "60px 0", textAlign: "center", fontFamily: mn, fontSize: 12, color: D.txd }}>
        No events yet — add one and it’ll show here in order.
      </div>
    );
  }

  return (
    <div style={{
      border: `1px solid ${D.border}`, borderRadius: 14, overflow: "hidden",
      background: D.cardGrad, boxShadow: D.glow,
    }}>
      {groups.map((g) => (
        <div key={g.key} style={{ opacity: g.past ? 0.62 : 1, borderTop: `1px solid ${D.border}` }}>
          {/* Day header */}
          <div style={{
            display: "flex", alignItems: "center", gap: 10, padding: "9px 16px",
            position: "sticky", top: 0, background: D.card, borderBottom: `1px solid ${D.border}`, zIndex: 2,
          }}>
            <span style={{
              fontFamily: gf, fontSize: 14, fontWeight: 700,
              color: g.isToday ? D.amber : g.past ? D.txm : D.tx,
            }}>
              {g.isToday ? "Today" : g.day.toLocaleDateString(undefined, { weekday: "long" })}
            </span>
            <span style={{ fontFamily: mn, fontSize: 10.5, color: D.txd }}>
              {g.day.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
            </span>
            {g.isToday && <span style={{ width: 6, height: 6, borderRadius: 999, background: D.amber, boxShadow: `0 0 8px ${D.amber}` }} />}
            <span style={{ flex: 1 }} />
            <span style={{ fontFamily: mn, fontSize: 9.5, color: D.txd }}>{g.events.length} {g.events.length === 1 ? "item" : "items"}</span>
          </div>
          {/* Rows */}
          {g.events.map((e) => {
            const accent = TYPE_COLOR[e.type];
            const statusC = STATUS_COLOR[e.status];
            const ch = e.channel ? channelOf(e.channel) : null;
            const cname = campaignName(e.campaignId);
            const start = new Date(e.start);
            const end = e.end ? new Date(e.end) : null;
            return (
              <div key={e.id} style={{
                display: "flex", alignItems: "center", gap: 12, padding: "9px 16px 9px 16px",
                borderBottom: `1px solid ${D.border}55`, cursor: "pointer",
              }}
                onContextMenu={(ev) => { ev.preventDefault(); onContext(e, ev.clientX, ev.clientY); }}
                onMouseEnter={(ev) => { ev.currentTarget.style.background = D.hover; }}
                onMouseLeave={(ev) => { ev.currentTarget.style.background = "transparent"; }}
              >
                <span style={{ fontFamily: mn, fontSize: 10.5, color: D.txm, width: 64, flex: "none" }}>
                  {fmtTime(start)}
                </span>
                <span style={{ width: 3, height: 26, borderRadius: 2, background: accent, flex: "none", boxShadow: `0 0 8px ${accent}66` }} />
                <span style={{
                  fontFamily: mn, fontSize: 8, letterSpacing: 0.5, textTransform: "uppercase",
                  color: accent, border: `1px solid ${accent}55`, borderRadius: 4, padding: "1px 5px", flex: "none",
                }}>
                  {e.type}
                </span>
                <span style={{
                  fontFamily: ft, fontSize: 13, fontWeight: 500, color: D.tx,
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>
                  {e.title}
                  {end && <span style={{ fontFamily: mn, fontSize: 9.5, color: D.txd }}>  → {fmtDay(end)}</span>}
                </span>
                <span style={{ flex: 1 }} />
                {cname && (
                  <span style={{ fontFamily: mn, fontSize: 9.5, color: D.txd, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 160 }}>
                    {cname}
                  </span>
                )}
                {ch && (
                  <span style={{
                    flex: "none", fontFamily: mn, fontSize: 8, color: ch.c,
                    border: `1px solid ${ch.c}66`, borderRadius: 4, padding: "1px 5px",
                  }}>
                    {ch.s}
                  </span>
                )}
                <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontFamily: mn, fontSize: 9.5, color: statusC, width: 78, flex: "none" }}>
                  <span style={{ width: 6, height: 6, borderRadius: 999, background: statusC }} />
                  {STATUS_LABEL[e.status]}
                </span>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// Shared tooltip rendered once, above the scroll content.
function Tooltip({ e, x, y, below }: { e: MarketingEvent; x: number; y: number; below: boolean }) {
  const start = new Date(e.start);
  const end = e.end ? new Date(e.end) : null;
  const accent = TYPE_COLOR[e.type];
  const statusC = STATUS_COLOR[e.status];
  const ch = e.channel ? channelOf(e.channel) : null;
  return (
    <div style={{
      position: "absolute", left: x + LABEL_W, top: y, zIndex: 30,
      transform: below ? "translate(-50%, 10px)" : "translate(-50%, calc(-100% - 10px))",
      background: D.surface, border: `1px solid ${accent}66`, borderRadius: 10,
      padding: "10px 12px", minWidth: 184, maxWidth: 268, pointerEvents: "none",
      boxShadow: "0 14px 38px rgba(0,0,0,0.6)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 7 }}>
        <span style={{
          fontFamily: mn, fontSize: 8, letterSpacing: 0.6, textTransform: "uppercase",
          color: accent, border: `1px solid ${accent}55`, borderRadius: 4, padding: "1px 5px",
        }}>
          {e.type}
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontFamily: mn, fontSize: 9, color: statusC }}>
          <span style={{ width: 6, height: 6, borderRadius: 999, background: statusC }} />
          {STATUS_LABEL[e.status]}
        </span>
      </div>
      <div style={{ fontFamily: ft, fontSize: 13, fontWeight: 600, color: D.tx, lineHeight: 1.3 }}>
        {e.title}
      </div>
      <div style={{
        marginTop: 8, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap",
        fontFamily: mn, fontSize: 9.5, color: D.txm,
      }}>
        <span>{fmtDay(start)} · {fmtTime(start)}</span>
        {end && (
          <>
            <ArrowRight size={10} color={D.txd} />
            <span>{fmtDay(end)} · {fmtTime(end)}</span>
          </>
        )}
      </div>
      {ch && (
        <div style={{ marginTop: 6, display: "inline-flex", alignItems: "center", gap: 6, fontFamily: mn, fontSize: 9.5, color: D.txm }}>
          <span style={{ width: 6, height: 6, borderRadius: 999, background: ch.c, boxShadow: `0 0 6px ${ch.c}88` }} />
          {ch.n}
        </div>
      )}
    </div>
  );
}

function LegendItem({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      {icon}{label}
    </span>
  );
}
