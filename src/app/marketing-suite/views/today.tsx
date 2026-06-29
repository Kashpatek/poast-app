"use client";
// MarketingSUITE · Today — the editable "launch control" cockpit. A responsive
// bento of modular tiles whose set + order live in localStorage ("ms-today-modules-v1",
// seeded from DEFAULT_MODULES). Flip "Edit layout" to drag-rearrange (@dnd-kit),
// remove tiles, and pull new ones from the MODULE_CATALOG. Out of edit mode the
// tiles are clean, hoverable, and jump into the relevant view via onOpenView.
// Every renderer reads live `m` / readBoardTasks — no refetch of the spine.
// Styling = inline CSSProperties + D tokens only (POAST house rule); no Tailwind.
import React from "react";
import {
  DndContext, PointerSensor, KeyboardSensor, closestCenter,
  useSensor, useSensors, type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext, sortableKeyboardCoordinates, rectSortingStrategy,
  useSortable, arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Sparkles, CalendarDays, Megaphone, Radio, TrendingUp,
  Clapperboard, BarChart3, ListTodo, AlarmClock, Newspaper, StickyNote,
  ArrowRight, Plus, X, GripVertical, Flame, TriangleAlert, CheckCircle2,
  Gauge, Activity, Pencil, Check, Shapes, Clock, DollarSign, Timer,
  CalendarClock, CheckSquare,
  type LucideIcon,
} from "lucide-react";
import { D, ft, gf, mn } from "../../shared-constants";
import {
  STATUS_COLOR, STATUS_LABEL, channelOf, adPlatform, adPayload,
  MODULE_CATALOG, DEFAULT_MODULES, readBoardTasks,
  type MarketingEvent, type Campaign, type EventStatus, type ModuleDef,
  type BoardTaskLite,
} from "../marketing-constants";
import type { MarketingState, ViewProps } from "../use-marketing";
import { useCreate } from "../create-context";
import PageHeader from "../components/page-header";

// ════════ persistence keys ════════
const LAYOUT_KEY = "ms-today-modules-v1";
const NOTES_KEY = "ms-today-notes";

// ════════ date utils ════════
const DAY = 86400000;
function startOfDay(d: Date) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }).toLowerCase().replace(" ", "");
}
function relDay(d: Date, now: Date) {
  const diff = Math.round((+startOfDay(d) - +startOfDay(now)) / DAY);
  if (diff === 0) return "today";
  if (diff === 1) return "tmrw";
  if (diff < 0) return `${-diff}d ago`;
  return `in ${diff}d`;
}
const DOW = ["S", "M", "T", "W", "T", "F", "S"];

// ════════ per-module accent + icon ════════
const ACCENTS: Record<string, [string, string]> = {
  amber: [D.amber, D.coral], cyan: [D.cyan, D.blue], teal: [D.teal, D.cyan],
  violet: [D.violet, D.crimson], coral: [D.coral, D.violet], blue: [D.blue, D.cyan],
  crimson: [D.crimson, D.coral],
};
interface ModuleMeta { accent: keyof typeof ACCENTS; Icon: LucideIcon; view?: string; }
const MODULE_META: Record<string, ModuleMeta> = {
  schedule:   { accent: "amber",   Icon: Sparkles,     view: "calendar" },
  weekheat:   { accent: "cyan",    Icon: CalendarDays, view: "calendar" },
  campaigns:  { accent: "violet",  Icon: Megaphone,    view: "campaigns" },
  ads:        { accent: "crimson", Icon: Radio,        view: "kiosk" },
  trends:     { accent: "coral",   Icon: TrendingUp,   view: "trends" },
  tasks:      { accent: "blue",    Icon: ListTodo,     view: "board" },
  efficiency: { accent: "teal",    Icon: Gauge,        view: "analytics" },
  deadlines:  { accent: "amber",   Icon: AlarmClock,   view: "timeline" },
  brief:      { accent: "amber",   Icon: Newspaper,    view: "brief" },
  kiosk:      { accent: "violet",  Icon: Clapperboard, view: "kiosk" },
  notes:      { accent: "teal",    Icon: StickyNote },
};
const CATALOG_BY_ID: Record<string, ModuleDef> = Object.fromEntries(MODULE_CATALOG.map((c) => [c.id, c]));

// ════════ shared style atoms ════════
const GH: React.CSSProperties = {
  fontFamily: mn, fontSize: 10, letterSpacing: 1.4, textTransform: "uppercase",
  color: D.txm, display: "flex", alignItems: "center", gap: 7, marginBottom: 12,
};
function teaserLink(color: string): React.CSSProperties {
  return {
    display: "inline-flex", alignItems: "center", gap: 5, marginTop: "auto", paddingTop: 12,
    fontFamily: mn, fontSize: 10, color, textDecoration: "none", opacity: 0.92,
  };
}
const CAMP_STATUS_LABEL: Record<Campaign["status"], string> = {
  planning: "Planning", active: "Active", wrapping: "Wrapping", done: "Done",
};

// Tiny channel pill (no brand icons in lucide@1.8 — color dot + short code).
function ChannelPill({ channel }: { channel?: string | null }) {
  if (!channel) return null;
  const ch = channelOf(channel);
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5, flex: "none",
      fontFamily: mn, fontSize: 9, letterSpacing: 0.4, color: ch.c,
      border: `1px solid ${ch.c}44`, background: `${ch.c}14`,
      borderRadius: 999, padding: "2px 7px",
    }}>
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: ch.c }} />
      {ch.s}
    </span>
  );
}

// ════════ sortable tile shell ════════
function Tile({
  id, accent, span2, edit, onOpen, onRemove, children,
}: {
  id: string;
  accent: keyof typeof ACCENTS;
  span2?: boolean;
  edit: boolean;
  onOpen?: () => void;
  onRemove: () => void;
  children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, disabled: !edit });
  const [g0, g1] = ACCENTS[accent];
  const clickable = !edit && !!onOpen;
  return (
    <div
      ref={setNodeRef}
      style={{
        gridColumn: span2 ? "span 2" : "span 1",
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 30 : undefined,
      }}
    >
      <div
        onClick={clickable ? onOpen : undefined}
        style={{
          position: "relative", borderRadius: 18, padding: 16, overflow: "hidden",
          minHeight: 152, height: "100%",
          background: edit
            ? "linear-gradient(150deg, rgba(255,255,255,0.07), rgba(255,255,255,0.02))"
            : "linear-gradient(150deg, rgba(255,255,255,0.05), rgba(255,255,255,0.012))",
          border: `1px solid ${isDragging ? `${g0}80` : D.border}`,
          boxShadow: isDragging
            ? `inset 0 1px 0 rgba(255,255,255,0.06), 0 30px 70px -20px rgba(0,0,0,0.9), 0 0 0 1px ${g0}30`
            : "inset 0 1px 0 rgba(255,255,255,0.03), 0 10px 30px -18px rgba(0,0,0,0.7)",
          opacity: isDragging ? 0.96 : 1,
          cursor: clickable ? "pointer" : edit ? "default" : "default",
          transition: "transform 0.2s, border-color 0.2s, box-shadow 0.2s",
          display: "flex", flexDirection: "column",
        }}
        onMouseEnter={(e) => {
          if (!clickable) return;
          e.currentTarget.style.transform = "translateY(-4px)";
          e.currentTarget.style.borderColor = "rgba(255,255,255,0.18)";
          e.currentTarget.style.boxShadow = "inset 0 1px 0 rgba(255,255,255,0.05), 0 26px 60px -22px rgba(0,0,0,0.85)";
        }}
        onMouseLeave={(e) => {
          if (!clickable) return;
          e.currentTarget.style.transform = "translateY(0)";
          e.currentTarget.style.borderColor = D.border;
          e.currentTarget.style.boxShadow = "inset 0 1px 0 rgba(255,255,255,0.03), 0 10px 30px -18px rgba(0,0,0,0.7)";
        }}
      >
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, height: 3,
          background: `linear-gradient(90deg, ${g0}, ${g1})`,
          boxShadow: `0 0 14px ${g0}`, opacity: 0.95,
        }} />

        {/* edit affordances */}
        {edit && (
          <>
            <button
              {...attributes}
              {...listeners}
              aria-label="Drag to reorder"
              style={{
                position: "absolute", top: 8, left: 8, zIndex: 4,
                width: 26, height: 26, borderRadius: 8, cursor: "grab",
                border: `1px solid ${D.border}`, background: "rgba(0,0,0,0.35)",
                color: D.txm, display: "flex", alignItems: "center", justifyContent: "center",
                touchAction: "none",
              }}
            >
              <GripVertical size={14} />
            </button>
            <button
              onClick={(ev) => { ev.stopPropagation(); onRemove(); }}
              aria-label="Remove module"
              style={{
                position: "absolute", top: 8, right: 8, zIndex: 4,
                width: 26, height: 26, borderRadius: 8, cursor: "pointer",
                border: `1px solid ${D.coral}55`, background: `${D.coral}1a`,
                color: D.coral, display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >
              <X size={14} />
            </button>
          </>
        )}

        <div style={{
          display: "flex", flexDirection: "column", flex: 1, minWidth: 0,
          paddingTop: edit ? 26 : 0,
          pointerEvents: edit ? "none" : "auto",
          filter: edit ? "saturate(0.9)" : "none",
        }}>
          {children}
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════ main view ════════════════════════════
export default function TodayView({ m, onOpenView }: ViewProps) {
  const open = (v: string) => onOpenView?.(v);
  const { openCreate } = useCreate();
  const now = React.useMemo(() => new Date(), []);

  // ── layout state (persisted) ──
  const [order, setOrder] = React.useState<string[]>(DEFAULT_MODULES);
  const [edit, setEdit] = React.useState(false);
  const [hydrated, setHydrated] = React.useState(false);

  React.useEffect(() => {
    try {
      const raw = localStorage.getItem(LAYOUT_KEY);
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) {
          const clean = arr.filter((x): x is string => typeof x === "string" && !!CATALOG_BY_ID[x]);
          if (clean.length) setOrder(Array.from(new Set(clean)));
        }
      }
    } catch { /* ignore */ }
    setHydrated(true);
  }, []);

  React.useEffect(() => {
    if (!hydrated) return;
    try { localStorage.setItem(LAYOUT_KEY, JSON.stringify(order)); } catch { /* ignore */ }
  }, [order, hydrated]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    setOrder((prev) => {
      const oi = prev.indexOf(String(active.id));
      const ni = prev.indexOf(String(over.id));
      if (oi < 0 || ni < 0) return prev;
      return arrayMove(prev, oi, ni);
    });
  };

  const placed = new Set(order);
  const available = MODULE_CATALOG.filter((c) => !placed.has(c.id));
  const addModule = (id: string) => setOrder((prev) => (prev.includes(id) ? prev : [...prev, id]));
  const removeModule = (id: string) => setOrder((prev) => prev.filter((x) => x !== id));
  const resetLayout = () => setOrder(DEFAULT_MODULES);

  const liveCount = m.events.filter((e) => e.status === "live").length;
  const todayCount = m.events.filter((e) => sameDay(new Date(e.start), now)).length;
  const todayLabel = now.toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" });

  return (
    <div style={{ padding: "22px 26px 48px", fontFamily: ft, color: D.tx }}>
      {/* ── page head ── */}
      <PageHeader
        id="today"
        title="Today"
        aside={`· ${todayLabel}`}
        subtitle={<>
          Your launch control — modular, editable, all live. {liveCount > 0 && (
            <span style={{ color: D.teal }}>{liveCount} live now ·</span>
          )} {todayCount} on deck today.
        </>}
        right={<>
          {/* Always-visible quick-create actions (full pop-up suites) */}
          <button onClick={() => openCreate("task")} style={quickBtn(D.coral)} title="New task">
            <CheckSquare size={13} /> Task
          </button>
          <button onClick={() => openCreate("schedule")} style={quickBtn(D.amber)} title="Schedule a booking / block / meeting">
            <CalendarClock size={13} /> Schedule
          </button>
          <button onClick={() => openCreate("campaign")} style={quickBtn(D.violet)} title="New campaign">
            <Megaphone size={13} /> Campaign
          </button>
          <div style={{ width: 1, height: 20, background: D.border, margin: "0 2px" }} />
          {edit && (
            <button onClick={resetLayout} style={ghostBtn} title="Restore default layout">
              <RotateLabel />
            </button>
          )}
          <button
            onClick={() => setEdit((v) => !v)}
            style={edit ? primaryBtn : ghostBtn}
          >
            {edit
              ? (<><Check size={13} style={{ verticalAlign: -2, marginRight: 5 }} /> Done editing</>)
              : (<><Pencil size={13} style={{ verticalAlign: -2, marginRight: 5 }} /> Edit layout</>)}
          </button>
        </>}
      />

      {/* ── edit-mode hint + add panel ── */}
      {edit && (
        <AddPanel available={available} onAdd={addModule} count={order.length} />
      )}

      {/* ── bento grid ── */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={order} strategy={rectSortingStrategy}>
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
            gap: 14, alignItems: "stretch", gridAutoFlow: "dense",
          }}>
            {order.map((id) => {
              const meta = MODULE_META[id];
              const def = CATALOG_BY_ID[id];
              if (!meta || !def) return null;
              return (
                <Tile
                  key={id}
                  id={id}
                  accent={meta.accent}
                  span2={def.span === 2}
                  edit={edit}
                  onOpen={meta.view ? () => open(meta.view!) : undefined}
                  onRemove={() => removeModule(id)}
                >
                  <ModuleBody id={id} m={m} now={now} open={open} />
                </Tile>
              );
            })}
          </div>
        </SortableContext>
      </DndContext>

      {order.length === 0 && (
        <div style={{
          marginTop: 18, padding: "34px 20px", textAlign: "center", borderRadius: 16,
          border: `1px dashed ${D.border}`, color: D.txm, fontSize: 13,
        }}>
          <Shapes size={22} color={D.txd} style={{ marginBottom: 8 }} />
          <div>No modules placed. {edit ? "Add some from the panel above." : "Hit Edit layout to build your launchboard."}</div>
        </div>
      )}
    </div>
  );
}

// reset-layout button label (kept tiny to avoid an extra import noise line)
function RotateLabel() {
  return <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><Shapes size={13} /> Reset</span>;
}

// ════════ add-module panel (edit mode) ════════
function AddPanel({ available, onAdd, count }: { available: ModuleDef[]; onAdd: (id: string) => void; count: number }) {
  return (
    <div style={{
      marginBottom: 16, padding: "14px 16px", borderRadius: 16,
      border: `1px solid ${D.amber}33`,
      background: "linear-gradient(150deg, rgba(247,176,65,0.06), rgba(255,255,255,0.012))",
      boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
    }}>
      <div style={{ ...GH, marginBottom: 11, color: D.amber }}>
        <Shapes size={13} /> Add modules
        <span style={{ marginLeft: "auto", color: D.txd, letterSpacing: 0.5 }}>{count} placed · {available.length} available</span>
      </div>
      {available.length === 0 ? (
        <div style={{ fontSize: 12.5, color: D.txm }}>
          Every module is on the board. Drag the tiles to rearrange, or remove a few to free them up.
        </div>
      ) : (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {available.map((c) => {
            const meta = MODULE_META[c.id];
            const [g0] = ACCENTS[meta?.accent ?? "amber"];
            const Icon = meta?.Icon ?? Plus;
            return (
              <button
                key={c.id}
                onClick={() => onAdd(c.id)}
                title={c.desc}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 9, cursor: "pointer",
                  border: `1px solid ${g0}44`, background: `${g0}12`, color: D.tx,
                  borderRadius: 11, padding: "8px 12px 8px 10px", textAlign: "left",
                  transition: "border-color 0.15s, background 0.15s, transform 0.12s",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = `${g0}99`; e.currentTarget.style.transform = "translateY(-1px)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = `${g0}44`; e.currentTarget.style.transform = "translateY(0)"; }}
              >
                <span style={{
                  width: 26, height: 26, borderRadius: 7, flex: "none",
                  background: `${g0}1f`, color: g0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <Icon size={14} />
                </span>
                <span style={{ display: "flex", flexDirection: "column", lineHeight: 1.15 }}>
                  <span style={{ fontSize: 12.5, fontWeight: 600 }}>{c.label}</span>
                  <span style={{ fontFamily: mn, fontSize: 9, color: D.txd, marginTop: 2 }}>{c.desc}</span>
                </span>
                <Plus size={13} color={g0} style={{ marginLeft: 4, flex: "none" }} />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ════════════════════════════ module bodies ════════════════════════════
function ModuleBody({ id, m, now, open }: { id: string; m: MarketingState; now: Date; open: (v: string) => void }) {
  switch (id) {
    case "schedule":   return <ScheduleBody m={m} now={now} />;
    case "weekheat":   return <WeekHeatBody m={m} now={now} />;
    case "campaigns":  return <CampaignsBody m={m} now={now} />;
    case "ads":        return <AdsBody m={m} now={now} />;
    case "trends":     return <TrendsBody />;
    case "tasks":      return <TasksBody />;
    case "efficiency": return <EfficiencyBody />;
    case "deadlines":  return <DeadlinesBody m={m} now={now} />;
    case "brief":      return <BriefBody m={m} now={now} />;
    case "kiosk":      return <KioskBody open={open} />;
    case "notes":      return <NotesBody />;
    default:           return null;
  }
}

// ─── schedule (span 2) ───
function ScheduleBody({ m, now }: { m: MarketingState; now: Date }) {
  const todays = m.events
    .filter((e) => sameDay(new Date(e.start), now))
    .sort((a, b) => +new Date(a.start) - +new Date(b.start));
  const liveCount = todays.filter((e) => e.status === "live").length;
  return (
    <>
      <div style={GH}>
        <Sparkles size={13} /> Today&rsquo;s schedule
        <span style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 8 }}>
          {liveCount > 0 && (
            <span style={{ fontFamily: mn, fontSize: 9, color: D.teal, display: "inline-flex", alignItems: "center", gap: 4 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: D.teal, boxShadow: `0 0 8px ${D.teal}` }} />
              {liveCount} live
            </span>
          )}
          <span style={{ fontFamily: mn, fontSize: 9, color: D.txd }}>{todays.length} items</span>
        </span>
      </div>
      {todays.length === 0 ? (
        <EmptyLine icon={CheckCircle2} color={D.teal} text="Clear runway — nothing scheduled for today." />
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", columnGap: 18, rowGap: 0 }}>
          {todays.map((e) => <ScheduleRow key={e.id} e={e} />)}
        </div>
      )}
      <span style={teaserLink(D.amber)}><ArrowRight size={12} /> open calendar</span>
    </>
  );
}
function ScheduleRow({ e }: { e: MarketingEvent }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10, fontSize: 13.5, padding: "8px 0",
      borderBottom: `1px solid ${D.border}`,
    }}>
      <span style={{ fontFamily: mn, fontSize: 11, color: D.amber, width: 50, flex: "none" }}>{fmtTime(e.start)}</span>
      <span style={{
        width: 7, height: 7, borderRadius: "50%", flex: "none",
        background: STATUS_COLOR[e.status as EventStatus],
        boxShadow: e.status === "live" ? `0 0 8px ${STATUS_COLOR[e.status]}` : "none",
      }} title={STATUS_LABEL[e.status as EventStatus]} />
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, minWidth: 0 }}>{e.title}</span>
      <ChannelPill channel={e.channel} />
    </div>
  );
}

// ─── week heat ───
function WeekHeatBody({ m, now }: { m: MarketingState; now: Date }) {
  const today0 = startOfDay(now);
  const week = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today0.getTime() + i * DAY);
    const count = m.events.filter((e) => sameDay(new Date(e.start), d)).length;
    return { d, count, isToday: i === 0 };
  });
  const maxCount = Math.max(1, ...week.map((w) => w.count));
  const total = week.reduce((s, w) => s + w.count, 0);
  return (
    <>
      <div style={GH}>
        <CalendarDays size={13} /> Next 7 days
        <span style={{ marginLeft: "auto", fontFamily: mn, fontSize: 9, color: D.txd }}>{total} drops</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 5, marginBottom: 6 }}>
        {week.map((w, i) => (
          <span key={i} style={{ fontFamily: mn, fontSize: 9, color: w.isToday ? D.amber : D.txd, textAlign: "center" }}>{DOW[w.d.getDay()]}</span>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 5 }}>
        {week.map((w, i) => {
          const ratio = w.count / maxCount;
          const lvl = w.count === 0 ? 0 : ratio > 0.66 ? 3 : ratio > 0.33 ? 2 : 1;
          const bgByLvl = ["rgba(255,255,255,0.04)", `${D.cyan}2e`, `${D.cyan}57`, `${D.cyan}99`];
          return (
            <div key={i} title={`${w.count} on ${w.d.toLocaleDateString()}`} style={{
              aspectRatio: "1", borderRadius: 6, background: bgByLvl[lvl],
              outline: w.isToday ? `1.5px solid ${D.amber}` : "none",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontFamily: mn, fontSize: 9, color: lvl >= 2 ? "#06060C" : D.txm, fontWeight: lvl >= 2 ? 700 : 400,
            }}>
              {w.count > 0 ? w.count : ""}
            </div>
          );
        })}
      </div>
      <div style={{ marginTop: 11, fontFamily: mn, fontSize: 9, color: D.txd, lineHeight: 1.6 }}>cool = open · hot = packed</div>
      <span style={teaserLink(D.cyan)}><ArrowRight size={12} /> full calendar</span>
    </>
  );
}

// ─── campaigns ───
function CampaignsBody({ m, now }: { m: MarketingState; now: Date }) {
  const camps = m.campaigns.slice().sort((a, b) => {
    const rank = (s: Campaign["status"]) => (s === "active" ? 0 : s === "wrapping" ? 1 : s === "planning" ? 2 : 3);
    return rank(a.status) - rank(b.status);
  });
  const active = camps.filter((c) => c.status === "active").length;
  return (
    <>
      <div style={GH}>
        <Megaphone size={13} /> Campaigns
        <span style={{ marginLeft: "auto", fontFamily: mn, fontSize: 9, color: D.teal }}>{active} active</span>
      </div>
      {camps.length === 0
        ? <EmptyLine icon={Megaphone} color={D.violet} text="No campaigns yet." />
        : camps.slice(0, 4).map((c) => <CampaignRow key={c.id} c={c} now={now} />)}
      <span style={teaserLink(D.violet)}><ArrowRight size={12} /> all campaigns</span>
    </>
  );
}
function CampaignRow({ c, now }: { c: Campaign; now: Date }) {
  const dim = c.status === "done";
  const daysLeft = c.end ? Math.ceil((+new Date(c.end) - +now) / DAY) : null;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 13, padding: "6px 0", opacity: dim ? 0.6 : 1 }}>
      <span style={{ width: 9, height: 9, borderRadius: 3, background: c.color, flex: "none" }} />
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, minWidth: 0 }}>{c.name}</span>
      <span style={{
        fontFamily: mn, fontSize: 8.5, letterSpacing: 0.5, color: c.color,
        border: `1px solid ${c.color}55`, borderRadius: 999, padding: "2px 7px", flex: "none",
      }}>{CAMP_STATUS_LABEL[c.status]}</span>
      {daysLeft !== null && daysLeft >= 0 && (
        <span style={{ fontFamily: mn, fontSize: 10, color: D.cyan, flex: "none" }}>→{daysLeft}d</span>
      )}
    </div>
  );
}

// ─── live ads (spend + pacing from adPayload) ───
function AdsBody({ m, now }: { m: MarketingState; now: Date }) {
  const flights = m.events.filter((e) => e.type === "ad");
  const live = flights.filter((e) => e.status === "live");
  const totalSpend = flights.reduce((s, e) => s + (adPayload(e).metrics?.spend ?? 0), 0);
  return (
    <>
      <div style={GH}>
        <Radio size={13} /> Live ads
        <span style={{ marginLeft: "auto", fontFamily: mn, fontSize: 9, color: D.txd }}>{live.length} live</span>
      </div>
      {flights.length === 0 ? (
        <EmptyLine icon={Radio} color={D.crimson} text="No ad flights running." />
      ) : (
        <div>
          {flights.slice(0, 3).map((e, i) => <AdPaceRow key={e.id} e={e} idx={i} now={now} />)}
        </div>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: "auto", paddingTop: 12 }}>
        <DollarSign size={13} color={D.amber} />
        <span style={{ fontFamily: gf, fontSize: 18, fontWeight: 700, color: D.tx }}>
          ${totalSpend >= 1000 ? `${(totalSpend / 1000).toFixed(1)}k` : Math.round(totalSpend)}
        </span>
        <span style={{ fontFamily: mn, fontSize: 9, color: D.txd }}>spend to date</span>
        <span style={{ marginLeft: "auto", fontFamily: mn, fontSize: 10, color: D.crimson, display: "inline-flex", alignItems: "center", gap: 5 }}>
          <ArrowRight size={12} /> kiosk
        </span>
      </div>
    </>
  );
}
function AdPaceRow({ e, idx, now }: { e: MarketingEvent; idx: number; now: Date }) {
  let pct = 0.5;
  if (e.end) {
    const s = +new Date(e.start), en = +new Date(e.end), n = +now;
    pct = en > s ? Math.min(1, Math.max(0, (n - s) / (en - s))) : 0.5;
  }
  const over = pct > 0.8;
  const plat = adPlatform(adPayload(e).platform ?? e.channel);
  const spend = adPayload(e).metrics?.spend;
  const fill = over
    ? `linear-gradient(90deg, ${D.coral}, ${D.crimson})`
    : `linear-gradient(90deg, ${D.teal}, ${D.cyan})`;
  return (
    <div style={{ marginTop: idx === 0 ? 2 : 9 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, alignItems: "center", gap: 8 }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 7, overflow: "hidden", minWidth: 0 }}>
          <span style={{
            fontFamily: mn, fontSize: 8, color: plat.c, flex: "none",
            border: `1px solid ${plat.c}44`, borderRadius: 4, padding: "1px 4px",
          }}>{plat.s}</span>
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.title}</span>
        </span>
        <span style={{ fontFamily: mn, fontSize: 10, color: over ? D.coral : D.txm, flex: "none", display: "inline-flex", alignItems: "center", gap: 5 }}>
          {spend ? `$${spend >= 1000 ? `${(spend / 1000).toFixed(1)}k` : spend}` : `${Math.round(pct * 100)}%`}
          {over ? <TriangleAlert size={11} /> : <CheckCircle2 size={11} color={D.teal} />}
        </span>
      </div>
      <div style={{ height: 7, borderRadius: 6, background: "rgba(255,255,255,0.06)", overflow: "hidden", margin: "5px 0" }}>
        <span style={{ display: "block", height: "100%", width: `${Math.round(pct * 100)}%`, background: fill }} />
      </div>
    </div>
  );
}

// ─── trends (teaser) ───
function TrendsBody() {
  const trends = [
    { tag: "afrobeat hook", lift: "+340%", hot: true },
    { tag: "“real reason”", lift: "+180%", hot: false },
    { tag: "HBM4 angle", lift: "hot", hot: true },
  ];
  return (
    <>
      <div style={GH}><TrendingUp size={13} /> Trends rising</div>
      {trends.map((t, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 13, padding: "6px 0" }}>
          {t.hot ? <Flame size={13} color={D.amber} style={{ flex: "none" }} /> : <span style={{ width: 13, flex: "none" }} />}
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.tag}</span>
          <span style={{ marginLeft: "auto", fontFamily: mn, fontSize: 10, color: t.lift === "hot" ? D.amber : D.teal }}>
            {t.lift !== "hot" ? `▲ ${t.lift}` : "hot"}
          </span>
        </div>
      ))}
      <span style={teaserLink(D.coral)}><ArrowRight size={12} /> explore trends</span>
    </>
  );
}

// ─── tasks (board snapshot) ───
function TasksBody() {
  const [tasks, setTasks] = React.useState<BoardTaskLite[]>([]);
  React.useEffect(() => { setTasks(readBoardTasks()); }, []);
  const open = tasks.filter((t) => !t.done);
  const done = tasks.length - open.length;
  const teaser = open.slice(0, 4);
  const hasReal = tasks.length > 0;
  const demo = ["EP18 thumbnail review", "Ad creative v2 sign-off", "Schedule clip batch 14"];
  return (
    <>
      <div style={GH}>
        <ListTodo size={13} /> Tasks
        <span style={{ marginLeft: "auto", fontFamily: mn, fontSize: 9, color: D.txd }}>
          {hasReal ? `${open.length} open · ${done} done` : "demo"}
        </span>
      </div>
      {hasReal ? (
        open.length === 0
          ? <EmptyLine icon={CheckCircle2} color={D.teal} text="Inbox zero — board is clear." />
          : teaser.map((t) => (
            <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 13, padding: "5px 0" }}>
              <span style={{ width: 14, height: 14, border: `1.5px solid ${D.blue}`, borderRadius: 4, flex: "none" }} />
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.title}</span>
            </div>
          ))
      ) : (
        demo.map((t, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 13, padding: "5px 0" }}>
            <span style={{ width: 14, height: 14, border: `1.5px solid ${D.blue}`, borderRadius: 4, flex: "none" }} />
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t}</span>
          </div>
        ))
      )}
      <span style={teaserLink(D.blue)}><ArrowRight size={12} /> open board</span>
    </>
  );
}

// ─── efficiency (throughput snapshot) ───
function EfficiencyBody() {
  const [tasks, setTasks] = React.useState<BoardTaskLite[] | null>(null);
  React.useEffect(() => { setTasks(readBoardTasks()); }, []);
  // real if we have board data; else demo numbers
  const real = tasks && tasks.length > 0;
  const total = real ? tasks!.length : 48;
  const done = real ? tasks!.filter((t) => t.done).length : 31;
  const pct = total ? Math.round((done / total) * 100) : 0;
  // avg cycle (days) from done tasks with timestamps; fallback demo
  let avg = 2.4;
  if (real) {
    const spans = tasks!
      .filter((t) => t.done && t.addedAt && t.updatedAt)
      .map((t) => (+new Date(t.updatedAt!) - +new Date(t.addedAt!)) / DAY)
      .filter((d) => d >= 0 && Number.isFinite(d));
    if (spans.length) avg = spans.reduce((s, d) => s + d, 0) / spans.length;
  }
  return (
    <>
      <div style={GH}>
        <Gauge size={13} /> Efficiency
        <span style={{ marginLeft: "auto", fontFamily: mn, fontSize: 9, color: real ? D.txd : D.txd }}>{real ? "live" : "demo"}</span>
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 2 }}>
        <span style={{ fontFamily: gf, fontSize: 30, fontWeight: 700, color: D.teal }}>{pct}%</span>
        <span style={{ fontFamily: mn, fontSize: 10, color: D.txm }}>{done}/{total} done</span>
      </div>
      <div style={{ height: 8, borderRadius: 6, background: "rgba(255,255,255,0.06)", overflow: "hidden", margin: "10px 0 4px" }}>
        <span style={{ display: "block", height: "100%", width: `${pct}%`, background: `linear-gradient(90deg, ${D.teal}, ${D.cyan})` }} />
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 8, fontSize: 12, color: D.txm }}>
        <Timer size={13} color={D.cyan} />
        avg cycle <span style={{ fontFamily: mn, color: D.tx }}>{avg.toFixed(1)}d</span>
        <Activity size={13} color={D.amber} style={{ marginLeft: "auto" }} />
        <span style={{ fontFamily: mn, fontSize: 10, color: D.amber }}>{total - done} in flight</span>
      </div>
      <span style={teaserLink(D.teal)}><ArrowRight size={12} /> open data</span>
    </>
  );
}

// ─── deadlines (soonest upcoming) ───
function DeadlinesBody({ m, now }: { m: MarketingState; now: Date }) {
  const upcoming = m.events
    .filter((e) => +new Date(e.start) >= +now && e.status !== "done")
    .sort((a, b) => +new Date(a.start) - +new Date(b.start))
    .slice(0, 4);
  return (
    <>
      <div style={GH}>
        <AlarmClock size={13} /> Deadlines
        <span style={{ marginLeft: "auto", fontFamily: mn, fontSize: 9, color: D.txd }}>soonest</span>
      </div>
      {upcoming.length === 0 ? (
        <EmptyLine icon={Clock} color={D.amber} text="Nothing ticking — all clear ahead." />
      ) : upcoming.map((e) => {
        const d = new Date(e.start);
        const soon = +d - +now < DAY;
        return (
          <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 13, padding: "6px 0" }}>
            <span style={{
              width: 7, height: 7, borderRadius: "50%", flex: "none",
              background: STATUS_COLOR[e.status as EventStatus],
            }} />
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, minWidth: 0 }}>{e.title}</span>
            <span style={{ fontFamily: mn, fontSize: 10, color: soon ? D.coral : D.amber, flex: "none" }}>{relDay(d, now)}</span>
          </div>
        );
      })}
      <span style={teaserLink(D.amber)}><ArrowRight size={12} /> open timeline</span>
    </>
  );
}

// ─── daily brief (standup text, span 2) ───
function BriefBody({ m, now }: { m: MarketingState; now: Date }) {
  const todays = m.events.filter((e) => sameDay(new Date(e.start), now));
  const live = m.events.filter((e) => e.status === "live").length;
  const blocked = m.events.filter((e) => e.status === "blocked");
  const activeCamps = m.campaigns.filter((c) => c.status === "active").length;
  const flights = m.events.filter((e) => e.type === "ad" && e.status === "live").length;
  const next = m.events
    .filter((e) => +new Date(e.start) >= +now && e.status !== "done")
    .sort((a, b) => +new Date(a.start) - +new Date(b.start))[0];
  return (
    <>
      <div style={GH}><Newspaper size={13} /> Daily brief</div>
      <div style={{ fontSize: 13.5, lineHeight: 1.7, color: D.tx }}>
        <span style={{ color: D.amber, fontWeight: 600 }}>{todays.length} item{todays.length === 1 ? "" : "s"}</span> on deck today
        {live > 0 && <> · <span style={{ color: D.teal }}>{live} live</span></>}.{" "}
        <span style={{ color: D.violet }}>{activeCamps} campaign{activeCamps === 1 ? "" : "s"}</span> active,{" "}
        <span style={{ color: D.crimson }}>{flights} ad flight{flights === 1 ? "" : "s"}</span> pacing.
        {next && (
          <> Next up: <span style={{ color: D.tx, fontWeight: 600 }}>{next.title}</span> <span style={{ fontFamily: mn, fontSize: 11, color: D.txm }}>({relDay(new Date(next.start), now)})</span>.</>
        )}
      </div>
      {blocked.length > 0 && (
        <div style={{
          marginTop: 12, display: "flex", alignItems: "center", gap: 8, fontSize: 12.5,
          color: D.coral, background: `${D.coral}12`, border: `1px solid ${D.coral}33`,
          borderRadius: 10, padding: "8px 11px",
        }}>
          <TriangleAlert size={14} style={{ flex: "none" }} />
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {blocked.length} blocked · {blocked[0].title}
          </span>
        </div>
      )}
      <span style={teaserLink(D.amber)}><ArrowRight size={12} /> full brief</span>
    </>
  );
}

// ─── kiosk jump card ───
function KioskBody({ open }: { open: (v: string) => void }) {
  return (
    <>
      <div style={GH}><Clapperboard size={13} /> Ad Kiosk</div>
      <div style={{ fontSize: 12.5, color: D.txm, lineHeight: 1.55, marginBottom: 12 }}>
        Spin up paid creative — variants, channels, and copy from one composer.
      </div>
      <button
        onClick={(ev) => { ev.stopPropagation(); open("kiosk"); }}
        style={{
          marginTop: "auto", border: `1px solid ${D.violet}80`, color: "#C9A6FF",
          borderRadius: 9, padding: 9, textAlign: "center", fontFamily: mn,
          fontSize: 10, letterSpacing: 0.5, background: `${D.violet}14`, cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
          transition: "background 0.15s, border-color 0.15s",
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = `${D.violet}26`; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = `${D.violet}14`; }}
      >
        <Plus size={12} /> NEW CREATIVE
      </button>
    </>
  );
}

// ─── notes (persisted textarea) ───
function NotesBody() {
  const [val, setVal] = React.useState("");
  const [ready, setReady] = React.useState(false);
  React.useEffect(() => {
    try { setVal(localStorage.getItem(NOTES_KEY) || ""); } catch { /* ignore */ }
    setReady(true);
  }, []);
  React.useEffect(() => {
    if (!ready) return;
    try { localStorage.setItem(NOTES_KEY, val); } catch { /* ignore */ }
  }, [val, ready]);
  return (
    <>
      <div style={GH}>
        <StickyNote size={13} /> Notes
        <span style={{ marginLeft: "auto", fontFamily: mn, fontSize: 9, color: D.txd }}>autosaved</span>
      </div>
      <textarea
        value={val}
        onChange={(e) => setVal(e.target.value)}
        placeholder="Jot a quick note for the day…"
        spellCheck={false}
        style={{
          flex: 1, minHeight: 84, resize: "none", width: "100%", boxSizing: "border-box",
          background: "rgba(0,0,0,0.25)", border: `1px solid ${D.border}`, borderRadius: 10,
          color: D.tx, fontFamily: ft, fontSize: 13, lineHeight: 1.55, padding: "9px 11px",
          outline: "none",
        }}
        onFocus={(e) => { e.currentTarget.style.borderColor = `${D.teal}66`; }}
        onBlur={(e) => { e.currentTarget.style.borderColor = D.border; }}
      />
    </>
  );
}

// ─── tiny empty-state line ───
function EmptyLine({ icon: Icon, color, text }: { icon: LucideIcon; color: string; text: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: D.txm, padding: "8px 0" }}>
      <Icon size={14} color={color} style={{ flex: "none" }} />
      <span>{text}</span>
    </div>
  );
}

// ════════ button style atoms ════════
const ghostBtn: React.CSSProperties = {
  fontFamily: mn, fontSize: 11, letterSpacing: 0.5, borderRadius: 9, padding: "9px 14px",
  cursor: "pointer", border: `1px solid ${D.border}`, background: "transparent", color: D.txm,
  transition: "color 0.16s, border-color 0.16s",
};
const primaryBtn: React.CSSProperties = {
  fontFamily: mn, fontSize: 11, letterSpacing: 0.5, borderRadius: 9, padding: "9px 14px",
  cursor: "pointer", border: "none", fontWeight: 700,
  background: `linear-gradient(135deg, ${D.amber}, #d88f2c)`, color: "#1a1206",
};
function quickBtn(c: string): React.CSSProperties {
  return {
    fontFamily: mn, fontSize: 11, letterSpacing: 0.3, borderRadius: 9, padding: "8px 12px",
    cursor: "pointer", border: `1px solid ${c}55`, background: c + "14", color: c,
    display: "inline-flex", alignItems: "center", gap: 6,
  };
}
