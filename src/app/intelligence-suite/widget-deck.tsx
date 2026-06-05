"use client";

// HUB widget deck — customizable command-center grid mounted on the
// /intelligence-suite hub home, below the app launcher. Wraps the 17
// legacy widgets from ../news-flow inside a new CommandCard chrome,
// adds edit-mode reorder/remove, a picker modal, and persists state
// to localStorage + Supabase.
//
// TODO: refactor news-flow's <W> wrapper into a body-only render path
// so we don't end up with double chrome (CommandCard outside + legacy
// <W> header inside). Acceptable trade-off for v1 — the legacy emoji
// header reads as a subtle inner caption beneath the dominant card.

import React, { useEffect, useRef, useState } from "react";
import {
  Bookmark, Calculator, Calendar, CalendarDays, CheckSquare, Coins, Eye,
  GripVertical, Hourglass, Landmark, Lightbulb, Microscope, Newspaper, Plus,
  Radio, Smile, StickyNote, Timer, TrendingUp, X,
} from "lucide-react";
import { D, ft, gf, mn } from "../shared-constants";
import {
  AIIdeas, Bookmarks, BufferCalWidget, CalcWidget, ChipKun, Countdown,
  CryptoWidget, EarningsCalendar, ETFWidget, LiveStreams, NewsFeed, Notes,
  Pomodoro, SAFeed, StockTicker, TodoList, Watchlist, WIDGET_META,
} from "../news-flow";

type SizeKey = "1x1" | "2x1" | "1x2" | "2x2";
const SIZE_CYCLE: SizeKey[] = ["1x1", "2x1", "1x2", "2x2"];
const SIZE_DIMS: Record<SizeKey, { gw: number; gh: number }> = {
  "1x1": { gw: 1, gh: 1 },
  "2x1": { gw: 2, gh: 1 },
  "1x2": { gw: 1, gh: 2 },
  "2x2": { gw: 2, gh: 2 },
};

interface CardMeta {
  Icon: React.ComponentType<{ size?: number; strokeWidth?: number; color?: string }>;
  accent: string;
  desc: string;
}

const CARD_META: Record<string, CardMeta> = {
  news:         { Icon: Newspaper,    accent: D.amber,  desc: "Cross-source news firehose with topic + source filters." },
  semianalysis: { Icon: Microscope,   accent: D.amber,  desc: "Latest SemiAnalysis research posts." },
  stocks:       { Icon: TrendingUp,   accent: D.teal,   desc: "Real-time semis + AI ticker board." },
  etfs:         { Icon: Landmark,     accent: D.teal,   desc: "Sector ETF snapshot." },
  crypto:       { Icon: Coins,        accent: D.amber,  desc: "Crypto + commodities at a glance." },
  earnings:     { Icon: CalendarDays, accent: D.violet, desc: "Upcoming earnings dates by ticker." },
  live:         { Icon: Radio,        accent: D.coral,  desc: "Tracked YouTube live streams." },
  watchlist:    { Icon: Eye,          accent: D.cyan,   desc: "Pinned tickers and keyword alerts." },
  ideas:        { Icon: Lightbulb,    accent: D.violet, desc: "AI-generated post angles." },
  notes:        { Icon: StickyNote,   accent: D.blue,   desc: "Quick scratchpad for research notes." },
  todos:        { Icon: CheckSquare,  accent: D.teal,   desc: "Lightweight task list with deadlines." },
  bufcal:       { Icon: Calendar,     accent: D.cyan,   desc: "Buffer post calendar preview." },
  pomodoro:     { Icon: Timer,        accent: D.coral,  desc: "Focus timer with break cycles." },
  chipkun:      { Icon: Smile,        accent: D.amber,  desc: "Chip-kun mascot vibe boost." },
  bookmarks:    { Icon: Bookmark,     accent: D.amber,  desc: "Pinned URLs for fast access." },
  calc:         { Icon: Calculator,   accent: D.txm,    desc: "Quick numeric scratchpad." },
  countdown:    { Icon: Hourglass,    accent: D.coral,  desc: "Countdown to keynotes + launches." },
};

const DEFAULT_WIDGETS: string[] = [
  "semianalysis", "news", "stocks", "earnings",
  "watchlist", "ideas", "bookmarks", "countdown",
];

const ALL_WIDGET_IDS: string[] = [
  "news", "semianalysis", "stocks", "etfs", "crypto", "earnings", "live",
  "watchlist", "ideas", "notes", "todos", "bufcal", "pomodoro", "chipkun",
  "bookmarks", "calc", "countdown",
];

const LS_KEY = "poast-hub-widget-deck";
const DB_ID = "hub-widget-deck";

interface DeckConfig {
  activeIds: string[];
  widgetSizes: Record<string, SizeKey>;
}

function loadFromLS(): DeckConfig | null {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    const activeIds = Array.isArray(parsed.activeIds)
      ? parsed.activeIds.filter(function (id: unknown) { return typeof id === "string" && ALL_WIDGET_IDS.indexOf(id as string) >= 0; })
      : null;
    if (!activeIds) return null;
    const widgetSizes: Record<string, SizeKey> = {};
    if (parsed.widgetSizes && typeof parsed.widgetSizes === "object") {
      for (const k of Object.keys(parsed.widgetSizes)) {
        const v = parsed.widgetSizes[k];
        if (v === "1x1" || v === "2x1" || v === "1x2" || v === "2x2") widgetSizes[k] = v;
      }
    }
    return { activeIds, widgetSizes };
  } catch (e) {
    return null;
  }
}

function saveToLS(cfg: DeckConfig): void {
  try { localStorage.setItem(LS_KEY, JSON.stringify(cfg)); } catch (e) {}
}

function dbSync(cfg: DeckConfig): void {
  fetch("/api/db", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      table: "projects",
      data: {
        id: DB_ID,
        name: "HUB Widget Deck",
        data: cfg,
        type: "hub-widget-deck",
        updated_at: new Date().toISOString(),
      },
    }),
  }).catch(function () {});
}

// Stub for widgets that take an onDraft prop. The HUB deck doesn't
// host the draft modal — clicking Draft from a news row routes to the
// post composer via the standard ideation hash.
function noopDraft() {}

export function WidgetDeck() {
  var _active = useState<string[]>(DEFAULT_WIDGETS), activeIds = _active[0], setActiveIds = _active[1];
  var _sizes = useState<Record<string, SizeKey>>({}), widgetSizes = _sizes[0], setWidgetSizes = _sizes[1];
  var _edit = useState<boolean>(false), editMode = _edit[0], setEditMode = _edit[1];
  var _picker = useState<boolean>(false), pickerOpen = _picker[0], setPickerOpen = _picker[1];
  var _loaded = useState<boolean>(false), loaded = _loaded[0], setLoaded = _loaded[1];

  const dragId = useRef<string | null>(null);

  // Hydrate: race localStorage (fast) against Supabase (canonical).
  useEffect(function () {
    let settled = false;
    const timer = window.setTimeout(function () {
      if (settled) return;
      settled = true;
      const ls = loadFromLS();
      if (ls) {
        setActiveIds(ls.activeIds);
        setWidgetSizes(ls.widgetSizes);
      }
      setLoaded(true);
    }, 800);

    fetch("/api/db?table=projects").then(function (r) { return r.json(); }).then(function (res) {
      if (settled) return;
      clearTimeout(timer);
      settled = true;
      if (res && res.data && Array.isArray(res.data)) {
        const row = res.data.find(function (r: Record<string, unknown>) {
          return r && r.type === "hub-widget-deck" && r.id === DB_ID;
        });
        if (row && row.data && typeof row.data === "object") {
          const cfg = row.data as DeckConfig;
          if (Array.isArray(cfg.activeIds) && cfg.activeIds.length > 0) {
            const cleaned = cfg.activeIds.filter(function (id) { return ALL_WIDGET_IDS.indexOf(id) >= 0; });
            setActiveIds(cleaned);
          }
          if (cfg.widgetSizes && typeof cfg.widgetSizes === "object") {
            setWidgetSizes(cfg.widgetSizes);
          }
          setLoaded(true);
          return;
        }
      }
      const ls = loadFromLS();
      if (ls) {
        setActiveIds(ls.activeIds);
        setWidgetSizes(ls.widgetSizes);
      }
      setLoaded(true);
    }).catch(function () {
      if (settled) return;
      clearTimeout(timer);
      settled = true;
      const ls = loadFromLS();
      if (ls) {
        setActiveIds(ls.activeIds);
        setWidgetSizes(ls.widgetSizes);
      }
      setLoaded(true);
    });

    return function () { clearTimeout(timer); };
  }, []);

  // Persist on change once hydrated.
  useEffect(function () {
    if (!loaded) return;
    const cfg: DeckConfig = { activeIds, widgetSizes };
    saveToLS(cfg);
    dbSync(cfg);
  }, [activeIds, widgetSizes, loaded]);

  function getSize(id: string): SizeKey {
    return widgetSizes[id] || "1x1";
  }

  function cycleSize(id: string) {
    setWidgetSizes(function (prev) {
      const cur = prev[id] || "1x1";
      const idx = SIZE_CYCLE.indexOf(cur);
      const next = SIZE_CYCLE[(idx + 1) % SIZE_CYCLE.length];
      return Object.assign({}, prev, { [id]: next });
    });
  }

  function addWidget(id: string) {
    if (activeIds.indexOf(id) >= 0) return;
    setActiveIds(function (prev) { return prev.concat([id]); });
    setWidgetSizes(function (prev) {
      if (prev[id]) return prev;
      return Object.assign({}, prev, { [id]: "1x1" as SizeKey });
    });
  }

  function removeWidget(id: string) {
    setActiveIds(function (prev) { return prev.filter(function (x) { return x !== id; }); });
  }

  function resetToDefault() {
    setActiveIds(DEFAULT_WIDGETS.slice());
    setWidgetSizes({});
  }

  function handleDragStart(_e: React.DragEvent, id: string) {
    dragId.current = id;
  }
  function handleDragOver(e: React.DragEvent, _id: string) {
    e.preventDefault();
  }
  function handleDrop(_e: React.DragEvent, dropId: string) {
    const from = dragId.current;
    dragId.current = null;
    if (!from || from === dropId) return;
    setActiveIds(function (prev) {
      const fromIdx = prev.indexOf(from);
      const toIdx = prev.indexOf(dropId);
      if (fromIdx < 0 || toIdx < 0) return prev;
      const next = prev.slice();
      next.splice(fromIdx, 1);
      next.splice(toIdx, 0, from);
      return next;
    });
  }

  return (
    <div>
      {/* ── Deck header ─────────────────────────────────────────── */}
      <div style={{
        display: "flex", alignItems: "flex-end", justifyContent: "space-between",
        gap: 16, marginTop: 48, marginBottom: 18, flexWrap: "wrap",
      }}>
        <div>
          <div style={{
            fontFamily: mn, fontSize: 11, fontWeight: 800, color: D.amber,
            letterSpacing: 2.4, textTransform: "uppercase",
          }}>Dashboard</div>
          <div style={{
            fontFamily: ft, fontSize: 14, color: D.txm, marginTop: 6,
          }}>Customizable widget deck — drag to reorder, click + to add.</div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <DeckPill
            onClick={function () { setPickerOpen(true); }}
            icon={<Plus size={12} strokeWidth={2.4} />}
            label="Add widget"
            accent={D.amber}
          />
          <DeckPill
            onClick={function () { setEditMode(function (v) { return !v; }); }}
            label={editMode ? "Done" : "Edit"}
            accent={editMode ? D.teal : D.txm}
          />
          <DeckPill
            onClick={resetToDefault}
            label="Reset"
            accent={D.txm}
          />
        </div>
      </div>

      {/* ── Grid ────────────────────────────────────────────────── */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
        gap: 14,
      }}>
        {activeIds.map(function (id) {
          const meta = CARD_META[id];
          const wm = WIDGET_META[id];
          if (!meta || !wm) return null;
          const size = getSize(id);
          const dims = SIZE_DIMS[size];
          return (
            <CommandCard
              key={id}
              id={id}
              title={wm.l}
              accent={meta.accent}
              Icon={meta.Icon}
              gw={dims.gw}
              gh={dims.gh}
              size={size}
              editMode={editMode}
              onCycleSize={function () { cycleSize(id); }}
              onRemove={function () { removeWidget(id); }}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
            >
              {renderWidget(id, dims.gw, dims.gh)}
            </CommandCard>
          );
        })}
      </div>

      {/* ── Picker modal ────────────────────────────────────────── */}
      {pickerOpen && (
        <PickerModal
          activeIds={activeIds}
          onAdd={function (id) { addWidget(id); }}
          onClose={function () { setPickerOpen(false); }}
        />
      )}
    </div>
  );
}

export default WidgetDeck;

// Render the legacy widget by id with the correct WidgetBaseProps.
// Returned JSX is mounted inside CommandCard's body — drag handlers
// live on the CommandCard wrapper, so we leave them undefined here.
function renderWidget(id: string, gw: number, gh: number): React.ReactNode {
  const base = { id: "hub-" + id, gw, gh, fontSize: 1 };
  switch (id) {
    case "news":         return <NewsFeed {...base} onDraft={noopDraft} />;
    case "semianalysis": return <SAFeed {...base} onDraft={noopDraft} />;
    case "stocks":       return <StockTicker {...base} />;
    case "etfs":         return <ETFWidget {...base} />;
    case "crypto":       return <CryptoWidget {...base} />;
    case "earnings":     return <EarningsCalendar {...base} />;
    case "live":         return <LiveStreams {...base} />;
    case "watchlist":    return <Watchlist {...base} />;
    case "ideas":        return <AIIdeas {...base} onDraft={noopDraft} />;
    case "notes":        return <Notes {...base} />;
    case "todos":        return <TodoList {...base} />;
    case "bufcal":       return <BufferCalWidget {...base} />;
    case "pomodoro":     return <Pomodoro {...base} />;
    case "chipkun":      return <ChipKun {...base} />;
    case "bookmarks":    return <Bookmarks {...base} />;
    case "calc":         return <CalcWidget {...base} />;
    case "countdown":    return <Countdown {...base} />;
    default:             return null;
  }
}

// ═══ CommandCard ═══
interface CommandCardProps {
  id: string;
  title: string;
  accent: string;
  Icon: React.ComponentType<{ size?: number; strokeWidth?: number; color?: string }>;
  gw: number;
  gh: number;
  size: SizeKey;
  editMode: boolean;
  onCycleSize: () => void;
  onRemove: () => void;
  onDragStart: (e: React.DragEvent, id: string) => void;
  onDragOver: (e: React.DragEvent, id: string) => void;
  onDrop: (e: React.DragEvent, id: string) => void;
  children: React.ReactNode;
}

function CommandCard({
  id, title, accent, Icon, gw, gh, size, editMode,
  onCycleSize, onRemove, onDragStart, onDragOver, onDrop, children,
}: CommandCardProps) {
  var _hover = useState<boolean>(false), hover = _hover[0], setHover = _hover[1];
  var _dropTarget = useState<boolean>(false), dropTarget = _dropTarget[0], setDropTarget = _dropTarget[1];

  return (
    <div
      draggable={editMode}
      onDragStart={function (e) { if (editMode) onDragStart(e, id); }}
      onDragOver={function (e) {
        if (!editMode) return;
        e.preventDefault();
        setDropTarget(true);
        onDragOver(e, id);
      }}
      onDragLeave={function () { setDropTarget(false); }}
      onDrop={function (e) {
        setDropTarget(false);
        if (editMode) onDrop(e, id);
      }}
      onMouseEnter={function () { setHover(true); }}
      onMouseLeave={function () { setHover(false); }}
      style={{
        background: D.card,
        border: dropTarget
          ? "2px dashed " + D.amber
          : "1px solid " + (hover ? accent + "4D" : D.border),
        borderRadius: 14,
        padding: 0,
        display: "flex",
        flexDirection: "column",
        gridColumn: "span " + gw,
        gridRow: "span " + gh,
        minHeight: gh * 220,
        overflow: "hidden",
        transition: "border-color 160ms ease, box-shadow 160ms ease",
        boxShadow: hover ? "0 10px 28px rgba(0,0,0,0.45), 0 0 22px " + accent + "1A" : "none",
        cursor: editMode ? "grab" : "default",
      }}
    >
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "12px 14px",
        borderBottom: "1px solid " + D.border,
        background: "linear-gradient(90deg, " + accent + "10, transparent 60%)",
        flexShrink: 0,
      }}>
        {editMode && (
          <GripVertical size={14} strokeWidth={1.8} color={D.txd} />
        )}
        <Icon size={16} strokeWidth={1.8} color={accent} />
        <span style={{
          fontFamily: gf, fontSize: 14, fontWeight: 700, color: D.tx,
          letterSpacing: 0,
        }}>{title}</span>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
          {editMode ? (
            <>
              <button
                type="button"
                onClick={onCycleSize}
                title="Cycle size"
                style={{
                  fontFamily: mn, fontSize: 9, fontWeight: 700, color: D.txm,
                  background: "transparent",
                  border: "1px solid " + D.border,
                  borderRadius: 4,
                  padding: "3px 6px",
                  cursor: "pointer",
                  letterSpacing: 0.5,
                }}
              >{size}</button>
              <button
                type="button"
                onClick={onRemove}
                title="Remove widget"
                style={{
                  background: "transparent",
                  border: "1px solid " + D.border,
                  borderRadius: 4,
                  padding: 3,
                  cursor: "pointer",
                  color: D.coral,
                  display: "inline-flex",
                }}
              ><X size={12} strokeWidth={2.2} /></button>
            </>
          ) : (
            <button
              type="button"
              onClick={onCycleSize}
              title="Cycle size"
              style={{
                fontFamily: mn, fontSize: 9, fontWeight: 700, color: D.txd,
                background: "transparent",
                border: "1px solid " + D.border,
                borderRadius: 4,
                padding: "3px 6px",
                cursor: "pointer",
                letterSpacing: 0.5,
              }}
            >{size}</button>
          )}
        </div>
      </div>

      {/* Body — no padding so the inner legacy <W> fills edge-to-edge. */}
      <div style={{
        flex: 1, minHeight: 0,
        background: D.surface,
        overflow: "auto",
      }}>
        <div className="hub-deck-widget-inner">
          {children}
        </div>
      </div>
    </div>
  );
}

// ═══ Pill ═══
function DeckPill({ onClick, icon, label, accent }: { onClick: () => void; icon?: React.ReactNode; label: string; accent: string }) {
  var _hover = useState<boolean>(false), hover = _hover[0], setHover = _hover[1];
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={function () { setHover(true); }}
      onMouseLeave={function () { setHover(false); }}
      style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        background: hover ? D.hover : D.card,
        border: "1px solid " + (hover ? accent + "66" : D.border),
        borderRadius: 999,
        padding: "6px 12px",
        cursor: "pointer",
        color: accent,
        fontFamily: mn, fontSize: 10, fontWeight: 700,
        letterSpacing: 1.4, textTransform: "uppercase",
        transition: "border-color 140ms ease, background 140ms ease",
      }}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

// ═══ Picker Modal ═══
function PickerModal({
  activeIds, onAdd, onClose,
}: { activeIds: string[]; onAdd: (id: string) => void; onClose: () => void }) {
  useEffect(function () {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return function () { window.removeEventListener("keydown", onKey); };
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0,
        background: "rgba(0,0,0,0.65)",
        backdropFilter: "blur(4px)",
        zIndex: 1000,
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 24,
      }}
    >
      <div
        onClick={function (e) { e.stopPropagation(); }}
        style={{
          background: D.card,
          border: "1px solid " + D.border,
          borderRadius: 16,
          width: "100%", maxWidth: 880,
          maxHeight: "85vh",
          display: "flex", flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <div style={{
          padding: "18px 22px",
          borderBottom: "1px solid " + D.border,
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div>
            <div style={{
              fontFamily: mn, fontSize: 10, fontWeight: 800, color: D.amber,
              letterSpacing: 2.4, textTransform: "uppercase",
            }}>Library</div>
            <div style={{
              fontFamily: gf, fontSize: 22, fontWeight: 800, color: D.tx,
              marginTop: 4,
            }}>Add a widget</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "transparent",
              border: "1px solid " + D.border,
              borderRadius: 8,
              padding: 6,
              cursor: "pointer",
              color: D.txm,
              display: "inline-flex",
            }}
          ><X size={16} strokeWidth={2.2} /></button>
        </div>

        <div style={{
          padding: 18,
          overflow: "auto",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
          gap: 12,
        }}>
          {ALL_WIDGET_IDS.map(function (id) {
            const meta = CARD_META[id];
            const wm = WIDGET_META[id];
            if (!meta || !wm) return null;
            const added = activeIds.indexOf(id) >= 0;
            const Icon = meta.Icon;
            return (
              <button
                key={id}
                type="button"
                disabled={added}
                onClick={function () { if (!added) { onAdd(id); } }}
                style={{
                  textAlign: "left",
                  background: added ? D.surface : D.card,
                  border: "1px solid " + D.border,
                  borderRadius: 12,
                  padding: 14,
                  cursor: added ? "default" : "pointer",
                  display: "flex", flexDirection: "column", gap: 8,
                  opacity: added ? 0.5 : 1,
                  transition: "border-color 140ms ease, background 140ms ease",
                  color: "inherit",
                }}
                onMouseEnter={function (e) {
                  if (added) return;
                  e.currentTarget.style.borderColor = meta.accent + "66";
                  e.currentTarget.style.background = D.hover;
                }}
                onMouseLeave={function (e) {
                  if (added) return;
                  e.currentTarget.style.borderColor = D.border;
                  e.currentTarget.style.background = D.card;
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <Icon size={22} strokeWidth={1.6} color={meta.accent} />
                  {added && (
                    <span style={{
                      fontFamily: mn, fontSize: 9, fontWeight: 700, color: D.teal,
                      letterSpacing: 1.2, textTransform: "uppercase",
                      border: "1px solid " + D.teal + "55",
                      borderRadius: 999,
                      padding: "2px 8px",
                    }}>Added</span>
                  )}
                </div>
                <div style={{
                  fontFamily: gf, fontSize: 16, fontWeight: 700, color: D.tx,
                  letterSpacing: -0.1,
                }}>{wm.l}</div>
                <div style={{
                  fontFamily: ft, fontSize: 12, color: D.txm, lineHeight: 1.4,
                }}>{meta.desc}</div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
