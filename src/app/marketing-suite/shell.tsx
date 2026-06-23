"use client";
// MarketingSUITE cockpit shell — the "launch control" frame the user approved:
// top bar (← POAST · wordmark · live chip · notifications · panel toggle),
// left nav rail (view switch), center active view, hideable right widget rail.
import React, { useState } from "react";
import Link from "next/link";
import { ChevronLeft, PanelRightClose, PanelRightOpen, Rocket } from "lucide-react";
import { D, ft, gf, mn } from "../shared-constants";
import { VIEWS, type ViewId } from "./marketing-constants";
import { useMarketing, type ViewProps } from "./use-marketing";

import TodayView from "./views/today";
import CalendarView from "./views/calendar";
import TimelineView from "./views/timeline";
import BoardView from "./views/board";
import CampaignsView from "./views/campaigns";
import KioskView from "./views/kiosk";
import TrendsView from "./views/trends";
import AnalyticsView from "./views/analytics";
import BriefView from "./views/brief";
import WidgetPanel from "./components/widget-panel";
import NotifBell from "./components/notifications";

export default function MarketingSuiteShell() {
  const [active, setActive] = useState<ViewId>("today");
  const [panelOpen, setPanelOpen] = useState(true);
  const [focusId, setFocusId] = useState<string | undefined>(undefined);
  const m = useMarketing();
  const vp: ViewProps = {
    m,
    focusId,
    onOpenView: (v, fid) => { setActive(v as ViewId); setFocusId(fid); },
  };
  // The board carries its own full-bleed chrome; everything else gets centered.
  const isBoard = active === "board";

  function renderView() {
    switch (active) {
      case "today": return <TodayView {...vp} />;
      case "calendar": return <CalendarView {...vp} />;
      case "timeline": return <TimelineView {...vp} />;
      case "board": return <BoardView />;
      case "campaigns": return <CampaignsView {...vp} />;
      case "kiosk": return <KioskView {...vp} />;
      case "trends": return <TrendsView {...vp} />;
      case "analytics": return <AnalyticsView {...vp} />;
      case "brief": return <BriefView {...vp} />;
      default: return null;
    }
  }

  const srcChip = m.source === "server"
    ? { label: "● Live", color: D.teal }
    : m.source === "cache"
      ? { label: "⚠ Offline · cached", color: D.coral }
      : { label: "◷ Demo data", color: D.amber };

  return (
    <div style={{ minHeight: "100vh", background: D.bg, color: D.tx, fontFamily: ft }}>
      {/* ── Top bar ── */}
      <div style={{
        display: "flex", alignItems: "center", gap: 14, padding: "0 18px", height: 52,
        borderBottom: `1px solid ${D.border}`, background: "rgba(10,10,14,0.78)",
        backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
        position: "sticky", top: 0, zIndex: 30,
      }}>
        <Link href="/" style={{ color: D.txm, textDecoration: "none", fontFamily: mn, fontSize: 12, display: "inline-flex", alignItems: "center", gap: 4 }}>
          <ChevronLeft size={14} /> POAST
        </Link>
        <div style={{ width: 1, height: 20, background: D.border }} />
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          <Rocket size={16} color={D.amber} />
          <span style={{ fontFamily: gf, fontSize: 16, letterSpacing: 0.4 }}>
            MARKETING<span style={{ color: D.amber }}>SUITE</span>
          </span>
        </div>
        <span style={{ flex: 1 }} />
        <span style={{ fontFamily: mn, fontSize: 10.5, color: srcChip.color, border: `1px solid ${srcChip.color}44`, borderRadius: 999, padding: "4px 10px" }}>
          {srcChip.label}
        </span>
        <NotifBell m={m} />
        <button
          onClick={() => setPanelOpen((v) => !v)}
          title={panelOpen ? "Hide widgets" : "Show widgets"}
          style={iconBtn}
        >
          {panelOpen ? <PanelRightClose size={17} /> : <PanelRightOpen size={17} />}
        </button>
      </div>

      {/* ── Body: rail · main · widgets ── */}
      <div style={{ display: "flex", alignItems: "stretch", minHeight: "calc(100vh - 52px)" }}>
        {/* Left nav rail */}
        <nav style={{
          width: 84, flex: "none", borderRight: `1px solid ${D.border}`,
          display: "flex", flexDirection: "column", gap: 4, padding: "12px 8px",
          position: "sticky", top: 52, height: "calc(100vh - 52px)", background: D.bg,
        }}>
          {VIEWS.map((v) => {
            const on = v.id === active;
            return (
              <button key={v.id} onClick={() => setActive(v.id)} title={v.label} style={{
                display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
                padding: "9px 4px", borderRadius: 10, cursor: "pointer",
                border: `1px solid ${on ? v.accent + "55" : "transparent"}`,
                background: on ? v.accent + "14" : "transparent",
                color: on ? v.accent : D.txm, transition: "all 0.16s",
              }}
                onMouseEnter={(e) => { if (!on) e.currentTarget.style.background = "rgba(255,255,255,0.03)"; }}
                onMouseLeave={(e) => { if (!on) e.currentTarget.style.background = "transparent"; }}
              >
                <v.Icon size={18} />
                <span style={{ fontFamily: mn, fontSize: 8.5, letterSpacing: 0.4, textTransform: "uppercase" }}>{v.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Center: active view. Board is full-bleed; every other view is
            centered with a max width so it doesn't pin left on ultra-wide. */}
        <main style={{ flex: 1, minWidth: 0, overflow: "auto" }}>
          {isBoard ? renderView() : (
            <div style={{ maxWidth: 1520, margin: "0 auto", width: "100%" }}>
              {renderView()}
            </div>
          )}
        </main>

        {/* Right widget rail */}
        {panelOpen && (
          <aside style={{
            width: 320, flex: "none", borderLeft: `1px solid ${D.border}`,
            position: "sticky", top: 52, height: "calc(100vh - 52px)", overflow: "auto", background: D.bg,
          }}>
            <WidgetPanel m={m} />
          </aside>
        )}
      </div>
    </div>
  );
}

const iconBtn: React.CSSProperties = {
  width: 34, height: 34, borderRadius: 9, border: `1px solid ${D.border}`,
  background: "transparent", color: D.txm, cursor: "pointer",
  display: "inline-flex", alignItems: "center", justifyContent: "center",
};
