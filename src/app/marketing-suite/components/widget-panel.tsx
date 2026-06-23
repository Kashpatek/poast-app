"use client";
// MarketingSUITE · right-rail portable widget panel.
// Drag-to-reorder (grip) via @dnd-kit, per-widget minimize, "+ Add widget".
// Widgets: Pomodoro (live timer) · To-do (Today / Back-flow) · Deadlines
// (1s countdowns to upcoming m.events) · Ads live + Trends feeds.
// Inline React.CSSProperties + D tokens only — POAST house pattern.
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DndContext, PointerSensor, closestCenter, useSensor, useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext, arrayMove, useSortable, verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Timer, Play, Pause, RotateCcw, ListTodo, AlarmClock, Radio, TrendingUp,
  GripVertical, ChevronDown, Plus, X, Flame,
} from "lucide-react";
import { D, ft, gf, mn } from "../../shared-constants";
import { channelOf, TYPE_COLOR } from "../marketing-constants";
import type { MarketingState } from "../use-marketing";

// ─── tiny formatters (ported from mockup) ───
const pad = (n: number) => String(Math.floor(n)).padStart(2, "0");
function mmss(ms: number): string {
  if (ms < 0) ms = 0;
  const s = Math.floor(ms / 1000);
  return pad(s / 60) + ":" + pad(s % 60);
}
function countdown(ms: number): string {
  if (ms <= 0) return "now";
  let s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400); s %= 86400;
  const h = Math.floor(s / 3600); s %= 3600;
  const m = Math.floor(s / 60); s %= 60;
  if (d > 0) return d + "d " + h + "h " + pad(m) + "m";
  if (h > 0) return h + "h " + pad(m) + "m " + pad(s) + "s";
  return pad(m) + ":" + pad(s);
}

// ─── 1Hz shared clock so the time-based widgets tick in lockstep ───
function useNow(active: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [active]);
  return now;
}

// ═══════════════════════════════════════════════════════════
// Shared widget shell — header (grip · title · minimize) + body
// ═══════════════════════════════════════════════════════════
const cardStyle: React.CSSProperties = {
  background: D.cardGrad, border: `1px solid ${D.border}`, borderRadius: 12,
  overflow: "hidden", boxShadow: D.glow,
};
const headStyle: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 8, padding: "9px 11px",
  fontFamily: mn, fontSize: 10.5, letterSpacing: 0.5, textTransform: "uppercase",
  color: D.txm, borderBottom: `1px solid ${D.border}`, userSelect: "none",
};
const microLabel: React.CSSProperties = {
  fontFamily: mn, fontSize: 9.5, letterSpacing: 0.4, color: D.txd,
  textTransform: "uppercase",
};
const iconGhost: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", justifyContent: "center",
  width: 22, height: 20, padding: 0, border: "none", background: "transparent",
  color: D.txd, cursor: "pointer", transition: "color 0.15s",
};

function WidgetCard(props: {
  id: string;
  title: React.ReactNode;
  accent: string;
  minimized: boolean;
  onToggle: () => void;
  onClose?: () => void;
  headerRight?: React.ReactNode;
  glow?: boolean;
  children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: props.id });
  const style: React.CSSProperties = {
    ...cardStyle,
    transform: CSS.Transform.toString(transform),
    transition: transition || "box-shadow 0.18s, border-color 0.18s",
    marginBottom: 11,
    opacity: isDragging ? 0.9 : 1,
    zIndex: isDragging ? 5 : 1,
    position: "relative",
    boxShadow: isDragging
      ? D.glowHover
      : props.glow
        ? `0 0 0 1px ${props.accent}44, 0 0 22px ${props.accent}22, ${D.glow}`
        : D.glow,
    borderColor: props.glow ? props.accent + "55" : D.border,
  };
  return (
    <div ref={setNodeRef} style={style}>
      <div style={{ ...headStyle, borderBottom: props.minimized ? "none" : headStyle.borderBottom }}>
        <span
          {...attributes}
          {...listeners}
          title="Drag to reorder"
          style={{
            display: "inline-flex", cursor: "grab", color: D.txd, touchAction: "none",
            marginLeft: -2,
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = D.txm)}
          onMouseLeave={(e) => (e.currentTarget.style.color = D.txd)}
        >
          <GripVertical size={13} />
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: D.tx }}>
          {props.title}
        </span>
        <span style={{ flex: 1 }} />
        {props.headerRight}
        {props.onClose && (
          <button
            onClick={props.onClose}
            title="Remove widget"
            style={iconGhost}
            onMouseEnter={(e) => (e.currentTarget.style.color = D.coral)}
            onMouseLeave={(e) => (e.currentTarget.style.color = D.txd)}
          >
            <X size={13} />
          </button>
        )}
        <button
          onClick={props.onToggle}
          title={props.minimized ? "Expand" : "Minimize"}
          style={iconGhost}
          onMouseEnter={(e) => (e.currentTarget.style.color = D.txm)}
          onMouseLeave={(e) => (e.currentTarget.style.color = D.txd)}
        >
          <ChevronDown
            size={14}
            style={{ transform: props.minimized ? "rotate(-90deg)" : "none", transition: "transform 0.18s" }}
          />
        </button>
      </div>
      {!props.minimized && <div style={{ padding: 11 }}>{props.children}</div>}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// 1) Pomodoro
// ═══════════════════════════════════════════════════════════
const btnBase: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
  height: 32, borderRadius: 8, border: `1px solid ${D.border}`,
  background: "transparent", fontFamily: ft, fontSize: 12.5, fontWeight: 500,
  cursor: "pointer", transition: "all 0.15s",
};
const chipBase: React.CSSProperties = {
  display: "flex", flexDirection: "column", alignItems: "center", gap: 1,
  padding: "5px 4px", borderRadius: 7, border: `1px solid ${D.border}`,
  background: "transparent", cursor: "pointer", transition: "all 0.15s",
};
const POMO_MODES = [
  { m: 25, label: "Focus" },
  { m: 5, label: "Break" },
  { m: 15, label: "Long" },
];
function PomodoroBody() {
  const [baseMin, setBaseMin] = useState(25);
  const [ms, setMs] = useState(25 * 60 * 1000);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!running) return;
    tickRef.current = setInterval(() => {
      setMs((prev) => {
        const next = prev - 1000;
        if (next <= 0) { setRunning(false); setDone(true); return 0; }
        return next;
      });
    }, 1000);
    return () => { if (tickRef.current) clearInterval(tickRef.current); };
  }, [running]);

  const pick = useCallback((min: number) => {
    setBaseMin(min); setMs(min * 60 * 1000); setRunning(false); setDone(false);
  }, []);
  const reset = useCallback(() => {
    setMs(baseMin * 60 * 1000); setRunning(false); setDone(false);
  }, [baseMin]);

  const total = baseMin * 60 * 1000;
  const pct = total > 0 ? Math.max(0, Math.min(1, ms / total)) : 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 11 }}>
      {/* clock */}
      <div style={{ position: "relative", width: "100%", textAlign: "center" }}>
        <div
          style={{
            fontFamily: mn, fontSize: 38, fontWeight: 600, lineHeight: 1, letterSpacing: 1,
            color: done ? D.teal : running ? D.amber : D.tx,
            textShadow: running ? `0 0 22px ${D.amber}55` : "none",
            transition: "color 0.25s, text-shadow 0.25s",
          }}
        >
          {done ? "✓ Done" : mmss(ms)}
        </div>
        {/* progress track */}
        <div style={{ height: 3, borderRadius: 2, background: "rgba(255,255,255,0.06)", marginTop: 9, overflow: "hidden" }}>
          <div style={{
            height: "100%", width: `${pct * 100}%`,
            background: running ? D.amber : D.txm,
            boxShadow: running ? `0 0 10px ${D.amber}` : "none",
            transition: "width 0.6s linear, background 0.25s",
          }} />
        </div>
      </div>
      {/* controls */}
      <div style={{ display: "flex", gap: 7, width: "100%" }}>
        <button
          onClick={() => { setDone(false); setRunning((r) => !r); }}
          style={{
            flex: 1, ...btnBase,
            background: running ? "transparent" : D.amber + "1A",
            borderColor: running ? D.border : D.amber + "66",
            color: running ? D.tx : D.amber,
          }}
        >
          {running ? <Pause size={13} /> : <Play size={13} />}
          {running ? "Pause" : "Start"}
        </button>
        <button onClick={reset} style={{ ...btnBase, width: 40, color: D.txm }} title="Reset">
          <RotateCcw size={13} />
        </button>
      </div>
      {/* mode chips */}
      <div style={{ display: "flex", gap: 6, width: "100%" }}>
        {POMO_MODES.map((md) => {
          const on = md.m === baseMin;
          return (
            <button
              key={md.m}
              onClick={() => pick(md.m)}
              style={{
                flex: 1, ...chipBase,
                borderColor: on ? D.amber + "66" : D.border,
                background: on ? D.amber + "16" : "transparent",
                color: on ? D.amber : D.txm,
              }}
            >
              <span style={{ fontFamily: mn, fontSize: 12, fontWeight: 600 }}>{md.m}</span>
              <span style={{ ...microLabel, fontSize: 8, color: on ? D.amber : D.txd }}>{md.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// 2) To-do (Today / Back-flow)
// ═══════════════════════════════════════════════════════════
interface Task { label: string; done: boolean; overdue?: string; }
const SEED_TODO: Record<"today" | "back", Task[]> = {
  today: [
    { label: "Approve EP18 thumbnail", done: false, overdue: "today" },
    { label: "Brief ad creative v2", done: false, overdue: "today" },
    { label: "Post EP17 TikTok · 11a", done: false },
    { label: "Confirm clip batch 14", done: false },
  ],
  back: [
    { label: "Q3 recap thread", done: false, overdue: "3d late" },
    { label: "Update brand kit links", done: false, overdue: "1w late" },
    { label: "Archive Sept clips", done: true },
  ],
};
function TodoBody() {
  const [tab, setTab] = useState<"today" | "back">("today");
  const [tasks, setTasks] = useState<Record<"today" | "back", Task[]>>(SEED_TODO);
  const toggle = (i: number) => setTasks((prev) => ({
    ...prev,
    [tab]: prev[tab].map((t, j) => (j === i ? { ...t, done: !t.done } : t)),
  }));
  const list = tasks[tab];
  const remaining = list.filter((t) => !t.done).length;

  return (
    <div>
      {/* toggle */}
      <div style={{ display: "flex", gap: 4, padding: 3, background: D.bg, borderRadius: 8, marginBottom: 9 }}>
        {(["today", "back"] as const).map((t) => {
          const on = tab === t;
          return (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                flex: 1, padding: "5px 0", borderRadius: 6, border: "none", cursor: "pointer",
                fontFamily: mn, fontSize: 10, letterSpacing: 0.4, textTransform: "uppercase",
                background: on ? D.surface : "transparent",
                color: on ? D.tx : D.txm,
                boxShadow: on ? "inset 0 0 0 1px " + D.border : "none",
                transition: "all 0.15s",
              }}
            >
              {t === "today" ? "Today" : "Back-flow"}
            </button>
          );
        })}
      </div>
      {/* items */}
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {list.map((t, i) => (
          <button
            key={t.label}
            onClick={() => toggle(i)}
            style={{
              display: "flex", alignItems: "center", gap: 9, padding: "7px 6px",
              borderRadius: 7, border: "none", background: "transparent", cursor: "pointer",
              textAlign: "left", width: "100%", transition: "background 0.14s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = D.hover)}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            <span style={{
              width: 15, height: 15, flex: "none", borderRadius: 5, position: "relative",
              border: `1.5px solid ${t.done ? D.teal : D.txd}`,
              background: t.done ? D.teal : "transparent", transition: "all 0.15s",
            }}>
              {t.done && (
                <span style={{
                  position: "absolute", left: 4, top: 1, width: 4, height: 8,
                  borderRight: `2px solid ${D.bg}`, borderBottom: `2px solid ${D.bg}`,
                  transform: "rotate(42deg)",
                }} />
              )}
            </span>
            <span style={{
              flex: 1, fontFamily: ft, fontSize: 12.5,
              color: t.done ? D.txd : D.tx,
              textDecoration: t.done ? "line-through" : "none", transition: "color 0.15s",
            }}>
              {t.label}
            </span>
            {t.overdue && !t.done && (
              <span style={{
                fontFamily: mn, fontSize: 8.5, letterSpacing: 0.3, padding: "2px 5px",
                borderRadius: 5, whiteSpace: "nowrap",
                color: D.coral, background: D.coral + "1A", border: `1px solid ${D.coral}3A`,
              }}>
                {t.overdue}
              </span>
            )}
          </button>
        ))}
      </div>
      <div style={{ ...microLabel, marginTop: 8, paddingTop: 8, borderTop: `1px solid ${D.border}` }}>
        {remaining} open · {list.length - remaining} done
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// 3) Deadlines — live countdowns to upcoming m.events
// ═══════════════════════════════════════════════════════════
const WARN_MS = 4 * 3600 * 1000; // < 4h → warn color
function DeadlinesBody({ m, now }: { m: MarketingState; now: number }) {
  const upcoming = useMemo(() => {
    return m.events
      .filter((e) => e.status !== "done" && new Date(e.start).getTime() > now - 60_000)
      .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
      .slice(0, 4);
  }, [m.events, now]);

  if (upcoming.length === 0) {
    return <div style={{ ...microLabel, color: D.txd }}>No upcoming deadlines</div>;
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {upcoming.map((e) => {
        const remaining = new Date(e.start).getTime() - now;
        const warn = remaining > 0 && remaining < WARN_MS;
        const live = remaining <= 0;
        const dotColor = live ? D.teal : warn ? D.coral : TYPE_COLOR[e.type];
        const ch = e.channel ? channelOf(e.channel) : null;
        return (
          <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 9, padding: "6px 4px" }}>
            <span style={{
              width: 7, height: 7, flex: "none", borderRadius: "50%", background: dotColor,
              boxShadow: warn || live ? `0 0 8px ${dotColor}` : "none",
            }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontFamily: ft, fontSize: 12, color: D.tx, whiteSpace: "nowrap",
                overflow: "hidden", textOverflow: "ellipsis",
              }}>
                {e.title}
              </div>
              {ch && (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 4, marginTop: 2 }}>
                  <span style={{ width: 5, height: 5, borderRadius: "50%", background: ch.c }} />
                  <span style={{ ...microLabel, fontSize: 8.5, color: D.txm }}>{ch.s}</span>
                </span>
              )}
            </div>
            <span style={{
              fontFamily: mn, fontSize: 11, fontWeight: 600, whiteSpace: "nowrap",
              color: live ? D.teal : warn ? D.coral : D.txm,
              textShadow: warn ? `0 0 10px ${D.coral}55` : "none",
            }}>
              {live ? "now" : countdown(remaining)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// 4) Ads live — derived from m.events of type 'ad'
// ═══════════════════════════════════════════════════════════
function AdsBody({ m }: { m: MarketingState }) {
  const ads = useMemo(() => m.events.filter((e) => e.type === "ad").slice(0, 4), [m.events]);
  // Deterministic pseudo-spend per ad id so it stays stable across renders.
  const rows = ads.map((e, i) => {
    const spent = 55 + ((e.id.charCodeAt(e.id.length - 1) * 7 + i * 13) % 42); // 55-96%
    const up = i % 2 === 0;
    const grad = up
      ? `linear-gradient(90deg, ${D.teal}, ${D.cyan})`
      : `linear-gradient(90deg, ${D.coral}, ${D.crimson})`;
    const label = (e.channel ? channelOf(e.channel).n : e.title).split("·")[0].trim();
    return { id: e.id, label, spent, up, grad };
  });
  if (rows.length === 0) {
    return <div style={{ ...microLabel, color: D.txd }}>No live ad flights</div>;
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
      {rows.map((r) => (
        <div key={r.id}>
          <div style={{ display: "flex", alignItems: "baseline", marginBottom: 5 }}>
            <span style={{ fontFamily: ft, fontSize: 12, color: D.tx }}>{r.label}</span>
            <span style={{ flex: 1 }} />
            <span style={{ ...microLabel, fontSize: 10, color: r.up ? D.teal : D.coral }}>
              {r.spent}% {r.up ? "▲" : "▼"}
            </span>
          </div>
          <div style={{ height: 5, borderRadius: 3, background: "rgba(255,255,255,0.05)", overflow: "hidden" }}>
            <div style={{
              height: "100%", width: `${r.spent}%`, background: r.grad,
              borderRadius: 3, transition: "width 0.5s ease",
            }} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// 5) Trends feed — small static rising-signal rows
// ═══════════════════════════════════════════════════════════
const TRENDS = [
  { label: "afrobeat hook", delta: "+340%", color: D.teal, hot: false },
  { label: "HBM4 angle", delta: "hot", color: D.amber, hot: true },
  { label: "datacenter capex", delta: "+88%", color: D.cyan, hot: false },
];
function TrendsBody() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {TRENDS.map((t) => (
        <div key={t.label} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 4px" }}>
          <span style={{ ...microLabel, fontSize: 8.5, color: D.teal, whiteSpace: "nowrap" }}>▲7d</span>
          <span style={{ flex: 1, fontFamily: ft, fontSize: 12, color: D.tx }}>{t.label}</span>
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 3,
            fontFamily: mn, fontSize: 10, color: t.color,
          }}>
            {t.hot && <Flame size={11} />}
            {t.delta}
          </span>
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// Placeholder (added via "+ Add widget")
// ═══════════════════════════════════════════════════════════
const ADD_NAMES = ["Notes", "Quick links", "Mini calendar", "Slack feed", "Reach sparkline", "Music · now playing"];
function PlaceholderBody({ name }: { name: string }) {
  return (
    <div style={{ ...microLabel, color: D.txd, lineHeight: 1.5, textTransform: "none" }}>
      {name} · placeholder<br />drag the grip to reorder
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// Panel
// ═══════════════════════════════════════════════════════════
type WidgetKind = "pomodoro" | "todo" | "deadlines" | "ads" | "trends" | "placeholder";
interface WidgetDef {
  id: string;
  kind: WidgetKind;
  title: string;
  icon: React.ReactNode;
  accent: string;
  name?: string; // placeholder display name
}

const BASE_WIDGETS: WidgetDef[] = [
  { id: "w-pomodoro", kind: "pomodoro", title: "Pomodoro", icon: <Timer size={13} color={D.amber} />, accent: D.amber },
  { id: "w-todo", kind: "todo", title: "To-do", icon: <ListTodo size={13} color={D.blue} />, accent: D.blue },
  { id: "w-deadlines", kind: "deadlines", title: "Deadlines", icon: <AlarmClock size={13} color={D.cyan} />, accent: D.cyan },
  { id: "w-ads", kind: "ads", title: "Ads live", icon: <Radio size={13} color={D.crimson} />, accent: D.crimson },
  { id: "w-trends", kind: "trends", title: "Trends", icon: <TrendingUp size={13} color={D.coral} />, accent: D.coral },
];

export default function WidgetPanel({ m }: { m: MarketingState }) {
  const [widgets, setWidgets] = useState<WidgetDef[]>(BASE_WIDGETS);
  const [order, setOrder] = useState<string[]>(BASE_WIDGETS.map((w) => w.id));
  const [minimized, setMinimized] = useState<Record<string, boolean>>({});

  // Panel clock drives the Deadlines countdowns (Pomodoro owns its own clock).
  const now = useNow(true);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const onDragEnd = useCallback((ev: DragEndEvent) => {
    const { active, over } = ev;
    if (!over || active.id === over.id) return;
    setOrder((prev) => {
      const from = prev.indexOf(String(active.id));
      const to = prev.indexOf(String(over.id));
      if (from < 0 || to < 0) return prev;
      return arrayMove(prev, from, to);
    });
  }, []);

  const toggleMin = useCallback((id: string) => {
    setMinimized((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const addWidget = useCallback(() => {
    const name = ADD_NAMES[Math.floor(Math.random() * ADD_NAMES.length)];
    const id = "w-x-" + Date.now().toString(36);
    const def: WidgetDef = {
      id, kind: "placeholder", title: name, name,
      icon: <Plus size={13} color={D.violet} />, accent: D.violet,
    };
    setWidgets((prev) => [...prev, def]);
    setOrder((prev) => [...prev, id]);
  }, []);

  const removeWidget = useCallback((id: string) => {
    setWidgets((prev) => prev.filter((w) => w.id !== id));
    setOrder((prev) => prev.filter((x) => x !== id));
    setMinimized((prev) => { const n = { ...prev }; delete n[id]; return n; });
  }, []);

  const byId = useMemo(() => {
    const map: Record<string, WidgetDef> = {};
    widgets.forEach((w) => { map[w.id] = w; });
    return map;
  }, [widgets]);

  const ordered = order.map((id) => byId[id]).filter(Boolean) as WidgetDef[];

  function renderBody(w: WidgetDef) {
    switch (w.kind) {
      case "pomodoro": return <PomodoroBody />;
      case "todo": return <TodoBody />;
      case "deadlines": return <DeadlinesBody m={m} now={now} />;
      case "ads": return <AdsBody m={m} />;
      case "trends": return <TrendsBody />;
      case "placeholder": return <PlaceholderBody name={w.name || "Widget"} />;
      default: return null;
    }
  }

  return (
    <div style={{ padding: 13, fontFamily: ft }}>
      {/* rail heading */}
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 12, padding: "0 2px" }}>
        <span style={{ fontFamily: gf, fontSize: 13, letterSpacing: 0.5, color: D.tx, textTransform: "uppercase" }}>
          Widgets
        </span>
        <span style={{ flex: 1 }} />
        <span style={{ ...microLabel, color: D.txd }}>{ordered.length} pinned</span>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={order} strategy={verticalListSortingStrategy}>
          {ordered.map((w) => (
            <WidgetCard
              key={w.id}
              id={w.id}
              accent={w.accent}
              minimized={!!minimized[w.id]}
              onToggle={() => toggleMin(w.id)}
              onClose={w.kind === "placeholder" ? () => removeWidget(w.id) : undefined}
              title={<>{w.icon}{w.title}</>}
              headerRight={
                w.kind === "ads"
                  ? <span style={{ ...microLabel, fontSize: 8.5, color: D.teal }}>● live</span>
                  : undefined
              }
            >
              {renderBody(w)}
            </WidgetCard>
          ))}
        </SortableContext>
      </DndContext>

      {/* add widget */}
      <button
        onClick={addWidget}
        style={{
          display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
          width: "100%", padding: 10, marginTop: 2, borderRadius: 10,
          border: `1px dashed ${D.border}`, background: "transparent",
          fontFamily: mn, fontSize: 11, letterSpacing: 0.4, textTransform: "uppercase",
          color: D.txm, cursor: "pointer", transition: "all 0.16s",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = D.violet + "66";
          e.currentTarget.style.color = D.violet;
          e.currentTarget.style.background = D.violet + "0E";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = D.border;
          e.currentTarget.style.color = D.txm;
          e.currentTarget.style.background = "transparent";
        }}
      >
        <Plus size={13} /> Add widget
      </button>
    </div>
  );
}
