"use client";
// MarketingSUITE · Schedule — a forward-looking day-planner for bookings,
// blocks, meetings, filming and any dated commitment. Distinct from Calendar
// (month grid) and Timeline (Gantt): this is "what's on, by day and time", with
// one-tap scheduling. Reads the shared event spine; create routes through the
// Schedule modal.
import React, { useMemo, useState } from "react";
import { CalendarClock, Plus, ArrowRight, Clock, CalendarCheck } from "lucide-react";
import { D, ft, gf, mn } from "../../shared-constants";
import {
  STATUS_COLOR, STATUS_LABEL, scheduleKindOf, channelOf, TYPE_COLOR,
  type MarketingEvent,
} from "../marketing-constants";
import type { ViewProps } from "../use-marketing";
import { useCreate } from "../create-context";
import GoogleCalendarsPanel from "../components/google-calendars";

const DAY = 24 * 60 * 60 * 1000;
function startOfDay(d: Date) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
function fmtTime(d: Date) { return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }); }

const RANGES = [
  { key: 7, label: "7 days" },
  { key: 14, label: "2 weeks" },
  { key: 30, label: "Month" },
] as const;

export default function ScheduleView({ m }: ViewProps) {
  const { openCreate } = useCreate();
  const [days, setDays] = useState<number>(14);
  const [showCals, setShowCals] = useState(false);
  const now = useMemo(() => new Date(), []);
  const today0 = startOfDay(now).getTime();

  // Bucket dated events into the visible day window.
  const buckets = useMemo(() => {
    const out: { key: number; date: Date; events: MarketingEvent[] }[] = [];
    for (let i = 0; i < days; i++) {
      const d = new Date(today0 + i * DAY);
      out.push({ key: d.getTime(), date: d, events: [] });
    }
    const end = today0 + days * DAY;
    for (const e of m.events) {
      const t = new Date(e.start).getTime();
      if (t < today0 || t >= end) continue;
      const k = startOfDay(new Date(e.start)).getTime();
      const bucket = out.find((b) => b.key === k);
      if (bucket) bucket.events.push(e);
    }
    out.forEach((b) => b.events.sort((a, z) => +new Date(a.start) - +new Date(z.start)));
    return out;
  }, [m.events, days, today0]);

  const totalScheduled = buckets.reduce((n, b) => n + b.events.length, 0);
  const campaignName = (id?: string | null) => m.campaigns.find((c) => c.id === id)?.name;

  return (
    <div style={{ padding: "22px 26px 48px", fontFamily: ft, color: D.tx }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 16, marginBottom: 16, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 280 }}>
          <h1 style={{ margin: 0, fontFamily: gf, fontSize: 25, fontWeight: 700, letterSpacing: 0.3, display: "inline-flex", alignItems: "center", gap: 10 }}>
            <CalendarClock size={22} color={D.amber} /> Schedule
          </h1>
          <div style={{ marginTop: 6, fontSize: 13, color: D.txm, maxWidth: 620, lineHeight: 1.45 }}>
            Bookings, blocks, meetings and filming — by day and time. {totalScheduled} scheduled in the next {days} days.
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <div style={{ display: "inline-flex", border: `1px solid ${D.border}`, borderRadius: 9, overflow: "hidden", background: D.card }}>
            {RANGES.map((r, i) => (
              <button key={r.key} onClick={() => setDays(r.key)} style={{
                fontFamily: mn, fontSize: 10.5, letterSpacing: 0.3, padding: "7px 13px", cursor: "pointer",
                border: "none", borderLeft: i ? `1px solid ${D.border}` : "none",
                color: days === r.key ? D.tx : D.txm, background: days === r.key ? D.hover : "transparent",
              }}>{r.label}</button>
            ))}
          </div>
          <button onClick={() => setShowCals((v) => !v)} title="Google Calendar" style={{
            display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer",
            fontFamily: mn, fontSize: 10.5, letterSpacing: 0.3, borderRadius: 9, padding: "8px 12px",
            border: `1px solid ${showCals ? D.teal + "66" : D.border}`, background: showCals ? D.teal + "14" : "transparent",
            color: showCals ? D.teal : D.txm,
          }}>
            <CalendarCheck size={13} /> Calendars
          </button>
          <button onClick={() => openCreate("schedule")} style={{
            display: "inline-flex", alignItems: "center", gap: 7, cursor: "pointer", border: "none",
            fontFamily: mn, fontSize: 11, fontWeight: 700, letterSpacing: 0.3, borderRadius: 9, padding: "8px 15px",
            color: "#15100a", background: `linear-gradient(135deg, ${D.amber}, ${D.amber}cc)`,
          }}>
            <Plus size={14} /> Schedule
          </button>
        </div>
      </div>

      {showCals && <div style={{ marginBottom: 14 }}><GoogleCalendarsPanel /></div>}

      {/* Day planner */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {buckets.map((b, idx) => {
          const isToday = idx === 0;
          const empty = b.events.length === 0;
          // Hide empty days beyond the first week to keep it tight.
          if (empty && idx >= 7) return null;
          return (
            <div key={b.key} style={{
              border: `1px solid ${isToday ? D.amber + "44" : D.border}`, borderRadius: 13,
              background: isToday ? `linear-gradient(180deg, ${D.amber}0c, ${D.cardGrad})` : D.cardGrad,
              overflow: "hidden",
            }}>
              {/* Day header */}
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 15px", borderBottom: empty ? "none" : `1px solid ${D.border}` }}>
                <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.1 }}>
                  <span style={{ fontFamily: gf, fontSize: 14, fontWeight: 700, color: isToday ? D.amber : D.tx }}>
                    {isToday ? "Today" : b.date.toLocaleDateString(undefined, { weekday: "long" })}
                  </span>
                  <span style={{ fontFamily: mn, fontSize: 10, color: D.txd }}>
                    {b.date.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                  </span>
                </div>
                <span style={{ flex: 1 }} />
                <span style={{ fontFamily: mn, fontSize: 9.5, color: D.txd }}>
                  {empty ? "nothing scheduled" : `${b.events.length} ${b.events.length === 1 ? "item" : "items"}`}
                </span>
                <button onClick={() => openCreate("schedule", { date: toDateStr(b.date) })} title="Schedule on this day" style={{
                  width: 24, height: 24, borderRadius: 7, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center",
                  border: `1px solid ${D.border}`, background: "transparent", color: D.txm,
                }}>
                  <Plus size={13} />
                </button>
              </div>
              {/* Items */}
              {!empty && (
                <div>
                  {b.events.map((e) => <ScheduleRow key={e.id} e={e} campaignName={campaignName(e.campaignId)} />)}
                </div>
              )}
            </div>
          );
        })}
        {totalScheduled === 0 && (
          <div style={{ padding: "40px 0", textAlign: "center" }}>
            <Clock size={26} color={D.txd} style={{ marginBottom: 10 }} />
            <div style={{ fontFamily: mn, fontSize: 12, color: D.txd, marginBottom: 14 }}>Nothing on the schedule yet.</div>
            <button onClick={() => openCreate("schedule")} style={{
              display: "inline-flex", alignItems: "center", gap: 7, cursor: "pointer", border: "none",
              fontFamily: mn, fontSize: 11, fontWeight: 700, borderRadius: 9, padding: "9px 16px",
              color: "#15100a", background: `linear-gradient(135deg, ${D.amber}, ${D.amber}cc)`,
            }}>
              <Plus size={14} /> Schedule your first thing
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function ScheduleRow({ e, campaignName }: { e: MarketingEvent; campaignName?: string }) {
  const kindKey = typeof e.payload?.scheduleKind === "string" ? (e.payload.scheduleKind as string) : null;
  const kind = kindKey ? scheduleKindOf(kindKey) : null;
  const accent = kind?.color || TYPE_COLOR[e.type];
  const statusC = STATUS_COLOR[e.status];
  const ch = e.channel ? channelOf(e.channel) : null;
  const start = new Date(e.start);
  const end = e.end ? new Date(e.end) : null;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 15px", borderBottom: `1px solid ${D.border}55` }}
      onMouseEnter={(ev) => { ev.currentTarget.style.background = D.hover; }}
      onMouseLeave={(ev) => { ev.currentTarget.style.background = "transparent"; }}
    >
      <div style={{ width: 92, flex: "none", fontFamily: mn, fontSize: 11, color: D.txm, display: "flex", alignItems: "center", gap: 4 }}>
        {fmtTime(start)}{end && <><ArrowRight size={9} color={D.txd} /><span style={{ color: D.txd }}>{fmtTime(end)}</span></>}
      </div>
      <span style={{ width: 3, height: 30, borderRadius: 2, background: accent, flex: "none", boxShadow: `0 0 8px ${accent}66` }} />
      {kind && (
        <span style={{ fontFamily: mn, fontSize: 8, letterSpacing: 0.5, textTransform: "uppercase", color: accent, border: `1px solid ${accent}55`, borderRadius: 4, padding: "1px 5px", flex: "none" }}>
          {kind.label}
        </span>
      )}
      <span style={{ fontFamily: ft, fontSize: 13.5, fontWeight: 500, color: D.tx, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {e.title}
      </span>
      <span style={{ flex: 1 }} />
      {campaignName && <span style={{ fontFamily: mn, fontSize: 9.5, color: D.txd, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 150 }}>{campaignName}</span>}
      {ch && <span style={{ fontFamily: mn, fontSize: 8, color: ch.c, border: `1px solid ${ch.c}66`, borderRadius: 4, padding: "1px 5px", flex: "none" }}>{ch.s}</span>}
      <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontFamily: mn, fontSize: 9.5, color: statusC, width: 76, flex: "none" }}>
        <span style={{ width: 6, height: 6, borderRadius: 999, background: statusC }} />{STATUS_LABEL[e.status]}
      </span>
    </div>
  );
}

function toDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
