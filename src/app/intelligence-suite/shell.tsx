"use client";

import { ReactNode, useState } from "react";
import { ArrowLeft, ChevronDown, ChevronUp, Sparkles } from "lucide-react";
import { D, ft, gf, mn } from "../shared-constants";

// ─── IntelligenceSUITE hub shell ─────────────────────────────────────
// Top toolbar (title + date range + Morning Brief CTA + layout dropdown)
// over a three-column flex layout (Signal Feed 35 / Story Radar 35 /
// Ideation Board 30) with a collapsible bottom drawer (Watchlist +
// Alerts / Competitive Radar placeholders for v1). All panels are
// mounted by hub-landing.tsx — this file is layout chrome only.

export type DateRange = "24h" | "7d" | "30d";
export type LayoutMode = "focus" | "research" | "ideation";

export interface IntelligenceSuiteShellProps {
  signalFeed: ReactNode;
  storyRadar: ReactNode;
  ideationBoard: ReactNode;
  morningBrief?: ReactNode;
  watchlist?: ReactNode;
  competitive?: ReactNode;
  onGenerateBrief?: () => void;
  dateRange?: DateRange;
  onDateRangeChange?: (r: DateRange) => void;
  layoutMode?: LayoutMode;
  onLayoutModeChange?: (l: LayoutMode) => void;
}

const RANGE_LABEL: Record<DateRange, string> = { "24h": "Last 24h", "7d": "Last 7d", "30d": "Last 30d" };
const LAYOUT_LABEL: Record<LayoutMode, string> = { focus: "Focus", research: "Research", ideation: "Ideation" };

export default function IntelligenceSuiteShell(props: IntelligenceSuiteShellProps) {
  const [dateOpen, setDateOpen] = useState(false);
  const [layoutOpen, setLayoutOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(true);

  const range: DateRange = props.dateRange || "7d";
  const layout: LayoutMode = props.layoutMode || "focus";

  return (
    <div style={{ background: D.bg, minHeight: "100vh", color: D.tx, display: "flex", flexDirection: "column" }}>
      {/* ── Top toolbar ───────────────────────────────────────────── */}
      <div style={{
        position: "sticky", top: 0, zIndex: 100,
        background: "rgba(10,10,16,0.82)",
        backdropFilter: "blur(20px) saturate(140%)",
        WebkitBackdropFilter: "blur(20px) saturate(140%)",
        borderBottom: "1px solid " + D.border,
        padding: "12px 22px",
        display: "flex", alignItems: "center", gap: 14,
      }}>
        <a
          href="/"
          title="Back to POAST"
          style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "7px 12px", borderRadius: 7,
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.10)",
            color: D.txm, fontFamily: mn, fontSize: 10, fontWeight: 800, letterSpacing: 0.6,
            textDecoration: "none",
          }}
        >
          <ArrowLeft size={11} strokeWidth={2.4} /> POAST
        </a>

        <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: "linear-gradient(135deg, " + D.amber + ", " + D.violet + ")",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 0 24px " + D.amber + "44, 0 0 48px " + D.violet + "28",
          }}>
            <Sparkles size={14} strokeWidth={2.4} color="#0A0A0E" />
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
              <span style={{ fontFamily: gf, fontSize: 19, fontWeight: 900, color: D.tx, letterSpacing: -0.3 }}>Intelligence</span>
              <span style={{
                fontFamily: gf, fontSize: 19, fontWeight: 900, letterSpacing: -0.3,
                background: "linear-gradient(135deg, " + D.amber + " 0%, " + D.violet + " 100%)",
                WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text",
              }}>SUITE</span>
              <span style={{ fontFamily: mn, fontSize: 8, fontWeight: 800, color: D.amber, letterSpacing: 1.5, padding: "2px 7px", border: "1px solid " + D.amber + "55", borderRadius: 3, background: D.amber + "16" }}>PHASE 7A</span>
            </div>
            <div style={{ fontFamily: mn, fontSize: 9, color: D.txm, letterSpacing: 1.4, textTransform: "uppercase", marginTop: 2 }}>Signal · Radar · Ideation</div>
          </div>
        </div>

        {/* Date range dropdown */}
        <div style={{ position: "relative" }}>
          <button
            onClick={function () { setDateOpen(function (v) { return !v; }); setLayoutOpen(false); }}
            style={dropdownTriggerStyle(dateOpen)}
          >
            <span style={{ color: D.txm, fontWeight: 700 }}>RANGE</span>
            <span style={{ color: D.tx }}>{RANGE_LABEL[range]}</span>
            <ChevronDown size={11} strokeWidth={2.4} />
          </button>
          {dateOpen ? (
            <div style={dropdownPanelStyle()}>
              {(["24h", "7d", "30d"] as DateRange[]).map(function (r) {
                return (
                  <button
                    key={r}
                    onClick={function () { props.onDateRangeChange && props.onDateRangeChange(r); setDateOpen(false); }}
                    style={dropdownItemStyle(r === range)}
                  >{RANGE_LABEL[r]}</button>
                );
              })}
            </div>
          ) : null}
        </div>

        {/* Generate Morning Brief CTA */}
        <button
          onClick={props.onGenerateBrief}
          style={{
            display: "inline-flex", alignItems: "center", gap: 7,
            padding: "7px 14px", borderRadius: 7,
            background: "linear-gradient(135deg, " + D.amber + "22, " + D.violet + "1E)",
            border: "1px solid " + D.amber + "55",
            color: D.amber,
            fontFamily: mn, fontSize: 10, fontWeight: 800, letterSpacing: 0.6,
            textTransform: "uppercase", cursor: "pointer",
          }}
        >
          <Sparkles size={11} strokeWidth={2.4} /> Generate Morning Brief
        </button>

        {/* Layout dropdown */}
        <div style={{ position: "relative" }}>
          <button
            onClick={function () { setLayoutOpen(function (v) { return !v; }); setDateOpen(false); }}
            style={dropdownTriggerStyle(layoutOpen)}
          >
            <span style={{ color: D.txm, fontWeight: 700 }}>LAYOUT</span>
            <span style={{ color: D.tx }}>{LAYOUT_LABEL[layout]}</span>
            <ChevronDown size={11} strokeWidth={2.4} />
          </button>
          {layoutOpen ? (
            <div style={dropdownPanelStyle()}>
              {(["focus", "research", "ideation"] as LayoutMode[]).map(function (l) {
                return (
                  <button
                    key={l}
                    onClick={function () { props.onLayoutModeChange && props.onLayoutModeChange(l); setLayoutOpen(false); }}
                    style={dropdownItemStyle(l === layout)}
                  >{LAYOUT_LABEL[l]}</button>
                );
              })}
            </div>
          ) : null}
        </div>
      </div>

      {/* Optional Morning Brief card under the toolbar */}
      {props.morningBrief ? (
        <div style={{ padding: "12px 22px 0 22px" }}>
          {props.morningBrief}
        </div>
      ) : null}

      {/* ── Three-column workspace ───────────────────────────────── */}
      <div style={{ display: "flex", flex: 1, minHeight: 0, padding: 14, gap: 0 }}>
        <PanelColumn flex={35} label="SIGNAL FEED" borderRight>
          {props.signalFeed}
        </PanelColumn>
        <PanelColumn flex={35} label="STORY RADAR" borderRight>
          {props.storyRadar}
        </PanelColumn>
        <PanelColumn flex={30} label="IDEATION BOARD">
          {props.ideationBoard}
        </PanelColumn>
      </div>

      {/* ── Bottom drawer ────────────────────────────────────────── */}
      <div style={{
        borderTop: "1px solid " + D.border,
        background: D.card,
      }}>
        <button
          onClick={function () { setDrawerOpen(function (v) { return !v; }); }}
          style={{
            width: "100%",
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "10px 22px",
            background: "transparent",
            border: "none",
            color: D.txm,
            fontFamily: mn, fontSize: 10, fontWeight: 800, letterSpacing: 1.4,
            textTransform: "uppercase",
            cursor: "pointer",
          }}
        >
          <span>Watchlist · Alerts · Competitive Radar</span>
          {drawerOpen ? <ChevronDown size={12} strokeWidth={2.4} /> : <ChevronUp size={12} strokeWidth={2.4} />}
        </button>
        {drawerOpen ? (
          <div style={{ display: "flex", gap: 0, padding: "0 14px 14px 14px", borderTop: "1px solid " + D.border }}>
            <DrawerCard title="WATCHLIST · ALERTS" borderRight>
              {props.watchlist || <DrawerPlaceholder text="Watchlist + Alerts arrive in Phase 7B." />}
            </DrawerCard>
            <DrawerCard title="COMPETITIVE RADAR">
              {props.competitive || <DrawerPlaceholder text="Competitive Radar arrives in Phase 7B." />}
            </DrawerCard>
          </div>
        ) : null}
      </div>
    </div>
  );
}

// ─── Column wrapper with mono uppercase header ───────────────────────
function PanelColumn({ flex, label, borderRight, children }: { flex: number; label: string; borderRight?: boolean; children: ReactNode }) {
  return (
    <div style={{
      flex: flex,
      display: "flex", flexDirection: "column",
      minWidth: 0, minHeight: 0,
      borderRight: borderRight ? "1px solid " + D.border : "none",
      padding: "0 12px",
    }}>
      <div style={{
        fontFamily: mn, fontSize: 10, fontWeight: 800, color: D.amber,
        letterSpacing: 2, textTransform: "uppercase",
        padding: "8px 4px 12px 4px",
        borderBottom: "1px solid " + D.border,
        marginBottom: 12,
      }}>{label}</div>
      <div style={{ flex: 1, minHeight: 0, overflow: "auto" }}>{children}</div>
    </div>
  );
}

function DrawerCard({ title, borderRight, children }: { title: string; borderRight?: boolean; children: ReactNode }) {
  return (
    <div style={{
      flex: 1,
      minWidth: 0,
      borderRight: borderRight ? "1px solid " + D.border : "none",
      padding: "12px 14px",
    }}>
      <div style={{
        fontFamily: mn, fontSize: 9, fontWeight: 800, color: D.amber,
        letterSpacing: 1.6, textTransform: "uppercase",
        marginBottom: 8,
      }}>{title}</div>
      {children}
    </div>
  );
}

function DrawerPlaceholder({ text }: { text: string }) {
  return (
    <div style={{
      padding: 16,
      border: "1px dashed " + D.border,
      borderRadius: 8,
      color: D.txd,
      fontFamily: ft, fontSize: 12,
    }}>{text}</div>
  );
}

// ─── Dropdown style helpers ──────────────────────────────────────────
function dropdownTriggerStyle(open: boolean): React.CSSProperties {
  return {
    display: "inline-flex", alignItems: "center", gap: 8,
    padding: "7px 11px", borderRadius: 7,
    background: open ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.04)",
    border: "1px solid " + (open ? "rgba(247,176,65,0.40)" : "rgba(255,255,255,0.10)"),
    color: D.tx,
    fontFamily: mn, fontSize: 10, letterSpacing: 0.6,
    cursor: "pointer",
  };
}

function dropdownPanelStyle(): React.CSSProperties {
  return {
    position: "absolute", top: "calc(100% + 6px)", right: 0,
    minWidth: 140,
    background: D.card,
    border: "1px solid " + D.border,
    borderRadius: 8,
    boxShadow: "0 8px 30px rgba(0,0,0,0.5)",
    padding: 4,
    zIndex: 200,
  };
}

function dropdownItemStyle(active: boolean): React.CSSProperties {
  return {
    display: "block",
    width: "100%",
    textAlign: "left",
    padding: "8px 10px",
    borderRadius: 5,
    background: active ? "rgba(247,176,65,0.10)" : "transparent",
    border: "none",
    color: active ? D.amber : D.tx,
    fontFamily: mn, fontSize: 10, fontWeight: 700, letterSpacing: 0.6,
    cursor: "pointer",
  };
}
