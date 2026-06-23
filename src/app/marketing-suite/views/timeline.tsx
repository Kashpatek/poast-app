"use client";
// MarketingSUITE · Timeline — an expandable horizontal Gantt "spine" of every
// marketing event on one time axis. Lanes are grouped by type and each lane
// header is a clickable expander: COLLAPSED packs the whole group onto one
// summary track; EXPANDED breaks the group into one row per task so every item
// is individually visible and hoverable. Bars/markers are positioned from real
// ISO dates, a live NOW playhead sweeps the axis, day ticks + week separators +
// weekend shading sit behind everything, and the range control swaps between a
// 2 / 4 / 6-week window. Read-only over the `m` spine; nothing here mutates.
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  GanttChart, CalendarRange, ChevronRight, ChevronDown, Diamond, Triangle,
  Radio, Layers, ArrowRight,
} from "lucide-react";
import { D, ft, gf, mn } from "../../shared-constants";
import {
  TYPE_COLOR, STATUS_COLOR, STATUS_LABEL, channelOf,
  type MarketingEvent, type EventType,
} from "../marketing-constants";
import type { ViewProps } from "../use-marketing";

// ─── Lane model ───
// The spec's six lanes, each collecting one or more EventTypes. Order top→down.
interface LaneDef { key: string; label: string; types: EventType[]; accent: string; }
const LANES: LaneDef[] = [
  { key: "production", label: "Production", types: ["production"],          accent: TYPE_COLOR.production },
  { key: "launch",     label: "Launch",     types: ["launch", "campaign"],  accent: TYPE_COLOR.launch },
  { key: "ads",        label: "Ads",        types: ["ad", "kiosk"],         accent: TYPE_COLOR.ad },
  { key: "clips",      label: "Clips",      types: ["clip", "buffer"],      accent: TYPE_COLOR.clip },
  { key: "strategy",   label: "Strategy",   types: ["strategy"],            accent: TYPE_COLOR.strategy },
  { key: "buffer",     label: "Other",      types: ["manual"],              accent: TYPE_COLOR.manual },
];

const DAY = 24 * 60 * 60 * 1000;
const LABEL_W = 132;        // sticky lane-label gutter
const AXIS_H = 50;          // time-axis header height
const LANE_PAD_Y = 7;       // vertical breathing room inside a lane
const SUMMARY_H = 30;       // bar/marker track height when collapsed
const TASK_ROW_H = 30;      // per-task row height when expanded
const BAR_H = 22;           // event bar height
const RANGES = [2, 4, 6] as const;   // selectable window in weeks
type RangeWeeks = (typeof RANGES)[number];

function startOfDay(d: Date): Date { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
function startOfWeek(d: Date): Date { // Monday-anchored
  const x = startOfDay(d); const day = (x.getDay() + 6) % 7; x.setDate(x.getDate() - day); return x;
}
function fmtDay(d: Date) { return d.toLocaleDateString(undefined, { month: "short", day: "numeric" }); }
function fmtTime(d: Date) { return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }); }
function isWeekend(d: Date) { const g = d.getDay(); return g === 0 || g === 6; }

interface TipState { id: string; x: number; y: number; below: boolean; }

export default function TimelineView({ m, onOpenView }: ViewProps) {
  void onOpenView;
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [tip, setTip] = useState<TipState | null>(null);
  const [range, setRange] = useState<RangeWeeks>(4);
  // Per-lane expand + per-lane hide.
  const [open, setOpen] = useState<Record<string, boolean>>({ ads: true });
  const [hidden, setHidden] = useState<Record<string, boolean>>({});
  const [tick, setTick] = useState(0);          // re-render the playhead each minute
  const [pxPerDay, setPxPerDay] = useState(64);  // density derived from container width

  const now = useMemo(() => new Date(), [tick]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep the NOW playhead honest without thrashing.
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 60 * 1000);
    return () => clearInterval(t);
  }, []);

  // ─── Window: a tidy, week-aligned span around the events & today ───
  const win = useMemo(() => {
    let min = Infinity;
    for (const e of m.events) {
      const s = new Date(e.start).getTime();
      if (s < min) min = s;
    }
    const nowT = now.getTime();
    if (!isFinite(min)) min = nowT;
    // Anchor on the Monday a few days before the earliest event (but never far
    // past "now" — keep today on screen).
    const anchor = Math.min(min - 2 * DAY, nowT - 2 * DAY);
    const from = startOfWeek(new Date(anchor));
    const days = range * 7;
    const to = startOfDay(new Date(from.getTime() + days * DAY));
    return { from, to, days };
  }, [m.events, range, now]);

  const trackW = win.days * pxPerDay;

  // Fit the chosen week-range to the visible viewport width so the default
  // window fills the canvas; horizontal scroll only kicks in when it can't.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const measure = () => {
      const avail = el.clientWidth - LABEL_W - 1;
      if (avail > 80) setPxPerDay(Math.max(34, Math.min(120, avail / win.days)));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [win.days]);

  const xOf = (d: Date) => ((d.getTime() - win.from.getTime()) / DAY) * pxPerDay;
  const nowX = xOf(now);

  // ─── Group events into lanes (sorted by start) ───
  const laneEvents = useMemo(() => {
    const out: Record<string, MarketingEvent[]> = {};
    for (const lane of LANES) out[lane.key] = [];
    for (const e of m.events) {
      const lane = LANES.find((l) => l.types.includes(e.type));
      if (lane) out[lane.key].push(e);
    }
    for (const k of Object.keys(out)) out[k].sort((a, b) => +new Date(a.start) - +new Date(b.start));
    return out;
  }, [m.events]);

  // ─── Day ticks across the axis ───
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

  // Week band headers (Mon-anchored) for the top strip.
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

  const visibleLanes = LANES.filter((l) => !hidden[l.key]);

  // ─── Vertical layout: each lane occupies N task rows (expanded) or 1 (collapsed) ───
  const layout = useMemo(() => {
    let y = 0;
    const rows: { lane: LaneDef; top: number; h: number; expanded: boolean; rowsCount: number }[] = [];
    for (const lane of visibleLanes) {
      const evs = laneEvents[lane.key];
      const expanded = !!open[lane.key] && evs.length > 0;
      const rowsCount = expanded ? evs.length : 1;
      const h = LANE_PAD_Y * 2 + rowsCount * (expanded ? TASK_ROW_H : SUMMARY_H);
      rows.push({ lane, top: y, h, expanded, rowsCount });
      y += h;
    }
    return { rows, total: Math.max(y, 120) };
  }, [visibleLanes, laneEvents, open]);

  function toggleOpen(k: string) { setOpen((o) => ({ ...o, [k]: !o[k] })); }
  function toggleHide(k: string) { setHidden((h) => ({ ...h, [k]: !h[k] })); }

  const totalEvents = m.events.length;
  const rangedCount = m.events.filter((e) => e.end).length;

  return (
    <div style={{ padding: "22px 26px 48px", fontFamily: ft, color: D.tx }}>
      {/* ── Page header ── */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 16, marginBottom: 16, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 280 }}>
          <h1 style={{
            margin: 0, fontFamily: gf, fontSize: 25, fontWeight: 700, letterSpacing: 0.3,
            display: "inline-flex", alignItems: "center", gap: 10,
          }}>
            <GanttChart size={22} color={D.teal} /> Production Timeline
          </h1>
          <div style={{ marginTop: 6, fontSize: 13, color: D.txm, maxWidth: 600, lineHeight: 1.45 }}>
            Every production and marketing milestone on one axis. Expand a lane to
            split it into one row per task — spot collisions before they ship.
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 6, fontFamily: mn, fontSize: 9.5,
            letterSpacing: 0.4, color: D.txd, textTransform: "uppercase",
            border: `1px solid ${D.border}`, borderRadius: 8, padding: "5px 10px", background: D.card,
          }}>
            <Layers size={12} color={D.teal} />
            {totalEvents} events · {rangedCount} ranged
          </div>
          {/* Range control */}
          <div style={{
            display: "inline-flex", border: `1px solid ${D.border}`, borderRadius: 9,
            overflow: "hidden", background: D.card,
          }}>
            {RANGES.map((r, i) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 5, cursor: "pointer",
                  fontFamily: mn, fontSize: 10.5, letterSpacing: 0.3, padding: "6px 12px",
                  border: "none", borderLeft: i ? `1px solid ${D.border}` : "none",
                  color: range === r ? D.tx : D.txm, background: range === r ? D.hover : "transparent",
                  transition: "background 0.14s, color 0.14s",
                }}
              >
                {i === 0 && <CalendarRange size={12} />} {r}w
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Lane filter / expand chips ── */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14, alignItems: "center" }}>
        {LANES.map((lane) => {
          const on = !hidden[lane.key];
          const count = laneEvents[lane.key].length;
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
                  color: on ? D.tx : D.txd,
                }}
              >
                <span style={{
                  width: 8, height: 8, borderRadius: 999,
                  background: on ? lane.accent : D.txd,
                  boxShadow: on ? `0 0 8px ${lane.accent}88` : "none",
                }} />
                {lane.label}
                <span style={{ color: on ? lane.accent : D.txd, fontSize: 9.5 }}>{count}</span>
              </button>
              <button
                onClick={() => count > 0 && on && toggleOpen(lane.key)}
                disabled={count === 0 || !on}
                title={expanded ? "Collapse to one track" : "Expand to per-task rows"}
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

      {/* ── Chart shell ── */}
      <div style={{
        border: `1px solid ${D.border}`, borderRadius: 14, overflow: "hidden",
        background: D.cardGrad, boxShadow: D.glow, position: "relative",
      }}>
        <div ref={scrollRef} style={{ overflowX: "auto", overflowY: "hidden", position: "relative" }}>
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
                  Lanes
                </span>
                <span style={{ fontFamily: mn, fontSize: 9.5, color: D.teal }}>{range}-week window</span>
              </div>
              <div style={{ position: "relative", width: trackW, flex: "none" }}>
                {/* Week bands */}
                {weekBands.map((b, i) => (
                  <div key={i} style={{
                    position: "absolute", left: b.x, top: 6, width: b.w, height: 18,
                    borderLeft: `1px solid ${D.border}`,
                    display: "flex", alignItems: "center", padding: "0 8px",
                    fontFamily: mn, fontSize: 9.5, letterSpacing: 0.3, whiteSpace: "nowrap",
                    color: b.hasNow ? D.amber : D.txm, fontWeight: b.hasNow ? 700 : 500,
                  }}>
                    {b.label}{b.hasNow && <span style={{ marginLeft: 6, fontSize: 8, color: D.amber }}>· NOW</span>}
                  </div>
                ))}
                {/* Day numbers */}
                {ticks.map((t) => (
                  <div key={t.i} style={{
                    position: "absolute", left: t.x, top: 27, width: pxPerDay, height: 20,
                    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                    gap: 0, overflow: "hidden",
                  }}>
                    <span style={{
                      fontFamily: mn, fontSize: 8.5,
                      color: t.today ? D.amber : t.weekend ? D.txd : D.txm,
                      fontWeight: t.today ? 700 : 500,
                    }}>
                      {t.date.toLocaleDateString(undefined, { weekday: "short" }).slice(0, 2)}
                    </span>
                    <span style={{
                      fontFamily: mn, fontSize: 10,
                      color: t.today ? D.amber : D.txd, fontWeight: t.today ? 700 : 500,
                    }}>
                      {t.date.getDate()}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Lanes body ── */}
            <div style={{ position: "relative", height: layout.total, display: "flex" }}>
              {/* Sticky label column (rendered as one block so it scrolls vertically with rows) */}
              <div style={{
                width: LABEL_W, flex: "none", position: "sticky", left: 0, zIndex: 5,
                background: D.card, borderRight: `1px solid ${D.border}`,
              }}>
                {layout.rows.map(({ lane, top, h, expanded, rowsCount }) => (
                  <div
                    key={lane.key}
                    onClick={() => laneEvents[lane.key].length > 0 && toggleOpen(lane.key)}
                    style={{
                      position: "absolute", left: 0, right: 0, top, height: h,
                      borderBottom: `1px solid ${D.border}`, cursor: laneEvents[lane.key].length ? "pointer" : "default",
                      display: "flex", flexDirection: "column", justifyContent: "flex-start",
                      padding: `${LANE_PAD_Y}px 0 0 12px`, transition: "background 0.15s",
                    }}
                    onMouseEnter={(ev) => { ev.currentTarget.style.background = D.hover; }}
                    onMouseLeave={(ev) => { ev.currentTarget.style.background = "transparent"; }}
                  >
                    <div style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                      <span style={{ color: expanded ? lane.accent : D.txd, display: "inline-flex" }}>
                        {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                      </span>
                      <span style={{
                        fontFamily: mn, fontSize: 10, letterSpacing: 0.7, fontWeight: 700,
                        textTransform: "uppercase", color: lane.accent,
                      }}>
                        {lane.label}
                      </span>
                    </div>
                    <div style={{ marginTop: 3, display: "inline-flex", alignItems: "center", gap: 5, paddingLeft: 17 }}>
                      <span style={{ width: 5, height: 5, borderRadius: 999, background: lane.accent }} />
                      <span style={{ fontFamily: mn, fontSize: 8.5, color: D.txd, letterSpacing: 0.2 }}>
                        {rowsCount} {expanded ? "rows" : laneEvents[lane.key].length === 1 ? "item" : "items"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Track area */}
              <div style={{ position: "relative", width: trackW, flex: "none" }}>
                {/* Background: weekend shading + day grid + week separators */}
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

                {/* Lane row dividers (under bars) */}
                {layout.rows.map(({ lane, top, h }) => (
                  <div key={lane.key} style={{
                    position: "absolute", left: 0, right: 0, top: top + h - 1, height: 1,
                    background: D.border, pointerEvents: "none",
                  }} />
                ))}

                {/* Bars / markers */}
                {layout.rows.map(({ lane, top, expanded }) => {
                  const evs = laneEvents[lane.key];
                  return evs.map((e, idx) => {
                    const rowTop = expanded
                      ? top + LANE_PAD_Y + idx * TASK_ROW_H
                      : top + LANE_PAD_Y;
                    const rowH = expanded ? TASK_ROW_H : SUMMARY_H;
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
                      />
                    );
                  });
                })}

                {visibleLanes.length === 0 && (
                  <div style={{
                    position: "absolute", inset: 0, display: "flex", alignItems: "center",
                    justifyContent: "center", fontFamily: mn, fontSize: 12, color: D.txd,
                  }}>
                    All lanes hidden — re-enable a chip above.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── Floating tooltip (anchored to the scroll layer so it tracks bars) ── */}
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
        <LegendItem icon={<span style={{ display: "inline-block", width: 14, height: 8, background: "rgba(255,255,255,0.05)", borderRadius: 2 }} />} label="weekend" />
        <LegendItem icon={<Radio size={10} color={D.teal} />} label="hover any bar for details — overlaps stay individually hoverable" />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// One event on the track: a ranged bar (left/width from start→end) or a point
// marker (diamond for ads/kiosk, triangle otherwise). Reports its anchor rect
// up to the parent so a single shared tooltip can render above the scroll layer
// — that keeps overlapping bars individually hoverable without z-index wars.
function EventItem({
  e, accent, xOf, trackW, rowTop, rowH, showLabel, hovered, onEnter, onLeave,
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
    // Anchor at the bar's horizontal centre (clamped) within the track, plus the
    // current row's vertical edge — both are offsets within the scroll content,
    // so the single shared tooltip lines up regardless of scroll position.
    const x = el.offsetLeft + Math.min(el.offsetWidth / 2, 60);
    const below = rowTop < 64;
    const y = below ? rowTop + rowH : rowTop;
    onEnter(x, y, below);
  }

  const x = Math.max(0, Math.min(trackW - 6, xOf(start)));

  // ── Ranged bar ──
  if (end) {
    const rawX = xOf(start);
    const w = Math.max(26, xOf(end) - rawX);
    return (
      <div
        ref={ref}
        data-tl-bar
        onMouseEnter={fire}
        onMouseLeave={onLeave}
        style={{
          position: "absolute", left: rawX, top: rowTop + (rowH - BAR_H) / 2,
          width: w, height: BAR_H, cursor: "pointer", zIndex: hovered ? 9 : 2,
        }}
      >
        <div style={{
          position: "relative", height: "100%", borderRadius: 6,
          background: `linear-gradient(90deg, ${accent}3a, ${accent}1a)`,
          border: `1px solid ${accent}${hovered ? "cc" : "60"}`,
          boxShadow: hovered ? `0 6px 20px ${accent}44` : "none",
          display: "flex", alignItems: "center", gap: 6, padding: "0 8px",
          overflow: "hidden", transition: "border-color 0.15s, box-shadow 0.15s",
        }}>
          <span style={{
            position: "absolute", left: 0, top: 0, bottom: 0, width: 3, background: accent,
            borderTopLeftRadius: 6, borderBottomLeftRadius: 6,
          }} />
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
  return (
    <div
      ref={ref}
      data-tl-bar
      onMouseEnter={fire}
      onMouseLeave={onLeave}
      style={{
        position: "absolute", left: x - 8, top: rowTop + (rowH - BAR_H) / 2, height: BAR_H,
        display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer",
        zIndex: hovered ? 9 : 3, paddingRight: 6, maxWidth: showLabel ? trackW - x : undefined,
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
