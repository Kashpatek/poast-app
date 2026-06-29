"use client";
// MarketingSUITE cockpit shell — the "launch control" frame the user approved:
// top bar (← POAST · wordmark · live chip · notifications · panel toggle),
// left nav rail (view switch), center active view, hideable right widget rail.
import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, ChevronDown, PanelRightClose, PanelRightOpen, Rocket, Settings as SettingsIcon } from "lucide-react";
import { D, ft, gf, mn } from "../shared-constants";
import AppearanceSettings from "./components/appearance-settings";
import { MarketingTour, MARKETING_TOUR_STEPS } from "./components/tour";
import { VIEWS, type ViewId } from "./marketing-constants";
import { useMarketing, type ViewProps } from "./use-marketing";

import TodayView from "./views/today";
import AgendaView from "./views/agenda";
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
import { CreateProvider } from "./create-context";
import AssistantBar from "./components/assistant-bar";
import CalendarStatusPill from "./components/calendar-status-pill";

// Chrome dimensions. The top bar and left rail both auto-hide and reveal on
// hover — a thin "peek" stays visible at each edge as the affordance (the same
// gesture for both, as requested).
const TOPBAR_H = 52;
const RAIL_W = 86;
const RAIL_PEEK = 16;
const TOP_PEEK = 8;

export default function MarketingSuiteShell() {
  const [active, setActive] = useState<ViewId>("today");
  const [panelOpen, setPanelOpen] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [focusId, setFocusId] = useState<string | undefined>(undefined);
  // Auto-hide chrome: rail slides out from the left, top bar drops from the top.
  const [railOpen, setRailOpen] = useState(false);
  const [barShown, setBarShown] = useState(false);
  const railT = useRef<number | undefined>(undefined);
  const barT = useRef<number | undefined>(undefined);
  const m = useMarketing();
  const vp: ViewProps = {
    m,
    focusId,
    onOpenView: (v, fid) => { setActive(v as ViewId); setFocusId(fid); },
  };
  // The board carries its own full-bleed chrome; everything else gets centered.
  const isBoard = active === "board";

  // Hover open/close with a small close delay so the cursor can travel from the
  // peek edge onto the revealed panel without it snapping shut.
  const openRail = () => { window.clearTimeout(railT.current); setRailOpen(true); };
  const closeRail = () => { window.clearTimeout(railT.current); railT.current = window.setTimeout(() => setRailOpen(false), 160); };
  const showBar = () => { window.clearTimeout(barT.current); setBarShown(true); };
  const hideBar = () => { window.clearTimeout(barT.current); barT.current = window.setTimeout(() => setBarShown(false), 220); };
  const pickView = (v: ViewId) => { setActive(v); setRailOpen(false); };
  useEffect(() => () => { window.clearTimeout(railT.current); window.clearTimeout(barT.current); }, []);

  function renderView() {
    switch (active) {
      case "today": return <TodayView {...vp} />;
      case "schedule": return <AgendaView {...vp} />;
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

  // Demo ⇄ Live toggle state. "Live" reads/writes this user's real data; "Demo"
  // is an in-memory sandbox. Offline only matters in Live mode.
  const liveOffline = m.mode === "live" && m.offline;

  const activeAccent = (VIEWS.find((v) => v.id === active)?.accent) || D.amber;

  return (
    <CreateProvider m={m} onOpenView={vp.onOpenView}>
    <div className="ms-shell" style={{ minHeight: "100vh", background: "var(--page-bg, " + D.bg + ")", color: D.tx, fontFamily: ft }}>
      {/* ── Top-edge reveal sensor + peek notch (the always-visible affordance) ── */}
      <div onMouseEnter={showBar} style={{ position: "fixed", top: 0, left: 0, right: 0, height: TOP_PEEK, zIndex: 41 }} />
      {!barShown && (
        <div onMouseEnter={showBar} title="Hover for the toolbar" style={{
          position: "fixed", top: 0, left: "50%", transform: "translateX(-50%)", zIndex: 42,
          height: 16, padding: "0 16px", display: "inline-flex", alignItems: "center", justifyContent: "center",
          borderRadius: "0 0 9px 9px", background: "rgba(10,10,14,0.82)", border: `1px solid ${D.border}`, borderTop: "none",
          color: D.txd, cursor: "pointer",
        }}>
          <ChevronDown size={12} />
        </div>
      )}

      {/* ── Top bar (auto-hides; drops in on hover) ── */}
      <div onMouseEnter={showBar} onMouseLeave={hideBar} style={{
        display: "flex", alignItems: "center", gap: 14, padding: "0 18px", height: TOPBAR_H,
        borderBottom: `1px solid ${D.border}`, background: "rgba(10,10,14,0.82)",
        backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 45,
        transform: barShown ? "translateY(0)" : "translateY(-100%)",
        transition: "transform 0.26s cubic-bezier(0.22,0.61,0.36,1)",
        boxShadow: barShown ? "0 14px 40px rgba(0,0,0,0.45)" : "none",
      }}>
        <Link href="/" data-tour="wordmark" style={{ color: D.txm, textDecoration: "none", fontFamily: mn, fontSize: 12, display: "inline-flex", alignItems: "center", gap: 4 }}>
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
        {/* Assistant omnibox — type/paste anything, it figures out what to create */}
        <div data-tour="assistant" onFocusCapture={showBar} style={{ display: "flex", alignItems: "center" }}>
          <AssistantBar />
        </div>
        <span style={{ flex: 1 }} />
        {/* Owner + offline hint */}
        <span style={{ fontFamily: mn, fontSize: 10, color: liveOffline ? D.coral : D.txd, display: "inline-flex", alignItems: "center", gap: 6 }}>
          {liveOffline && <span title="Working from cache — changes will sync when back online">⚠ cached</span>}
          {m.owner && m.owner !== "shared" && <span title="Signed-in workspace">{m.owner}</span>}
        </span>
        {/* Google Calendar status + connect prompt — visible from every view */}
        <CalendarStatusPill onManage={() => setActive("schedule")} />
        <NotifBell m={m} />
        <button onClick={() => setSettingsOpen(true)} title="Settings & theme" data-tour="settings" style={iconBtn}>
          <SettingsIcon size={17} />
        </button>
        <button
          onClick={() => setPanelOpen((v) => !v)}
          title={panelOpen ? "Hide widgets" : "Show widgets"}
          data-tour="panel"
          style={iconBtn}
        >
          {panelOpen ? <PanelRightClose size={17} /> : <PanelRightOpen size={17} />}
        </button>
      </div>

      {/* ── Body: peek gutter · main · widgets (full height; chrome floats over) ── */}
      <div style={{ display: "flex", alignItems: "stretch", minHeight: "100vh" }}>
        {/* Left peek gutter so content clears the rail handle */}
        <div style={{ width: RAIL_PEEK, flex: "none" }} />

        {/* Center: active view. Board is full-bleed; every other view is
            centered with a max width so it doesn't pin left on ultra-wide. */}
        <main style={{ flex: 1, minWidth: 0, height: "100vh", overflow: "auto" }}>
          <div key={active} className="ms-view" style={{ minHeight: "100%" }}>
            {isBoard ? renderView() : (
              <div style={{
                maxWidth: 1560, margin: "0 auto", width: "100%", boxSizing: "border-box",
                // Consistent breathing room on every view — the chrome auto-hides, so
                // the view is the whole surface; keep it off the screen/rail edges.
                paddingInline: "clamp(12px, 2vw, 40px)",
              }}>
                {renderView()}
              </div>
            )}
          </div>
        </main>

        {/* Right widget rail */}
        {panelOpen && (
          <aside style={{
            width: 320, flex: "none", borderLeft: `1px solid ${D.border}`,
            position: "sticky", top: 0, height: "100vh", overflow: "auto", background: D.bg,
          }}>
            <WidgetPanel m={m} />
          </aside>
        )}
      </div>

      {/* ── Left rail peek handle (always visible affordance) ── */}
      <div onMouseEnter={openRail} onMouseLeave={closeRail} title="Hover for navigation" style={{
        position: "fixed", left: 0, top: 0, bottom: 0, width: RAIL_PEEK, zIndex: 38,
        display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
        background: `linear-gradient(180deg, ${activeAccent}22, transparent 22%, transparent 78%, ${activeAccent}22)`,
        borderRight: `1px solid ${D.border}`,
        opacity: railOpen ? 0 : 1, transition: "opacity 0.2s",
      }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5, color: D.txm }}>
          <span style={{ width: 3, height: 18, borderRadius: 3, background: activeAccent + "99" }} />
          <ChevronRight size={12} />
          <span style={{ width: 3, height: 18, borderRadius: 3, background: D.border }} />
        </div>
      </div>

      {/* ── Left nav rail (slides in on hover; collapses after a pick) ── */}
      <nav data-tour="rail" onMouseEnter={openRail} onMouseLeave={closeRail} style={{
        position: "fixed", left: 0, top: 0, height: "100vh", width: RAIL_W, zIndex: 40,
        flex: "none", borderRight: `1px solid ${D.border}`,
        display: "flex", flexDirection: "column", gap: 4, padding: "20px 8px 12px",
        background: "rgba(10,10,14,0.92)", backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)",
        transform: railOpen ? "translateX(0)" : "translateX(-100%)",
        transition: "transform 0.24s cubic-bezier(0.22,0.61,0.36,1)",
        boxShadow: railOpen ? "18px 0 48px rgba(0,0,0,0.5)" : "none",
        overflowY: "auto",
      }}>
        {VIEWS.map((v) => {
          const on = v.id === active;
          return (
            <button key={v.id} onClick={() => pickView(v.id)} title={v.label} style={{
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

      <AppearanceSettings open={settingsOpen} onClose={() => setSettingsOpen(false)} m={m} />
      <MarketingTour steps={MARKETING_TOUR_STEPS} storageKey="marketing.v1" owner={m.owner || "shared"} />
      <style>{`
        @keyframes msViewIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
        .ms-view { animation: msViewIn 0.28s ease both; }
        @media (prefers-reduced-motion: reduce) { .ms-view { animation: none; } }
      `}</style>
    </div>
    </CreateProvider>
  );
}

const iconBtn: React.CSSProperties = {
  width: 34, height: 34, borderRadius: 9, border: `1px solid ${D.border}`,
  background: "transparent", color: D.txm, cursor: "pointer",
  display: "inline-flex", alignItems: "center", justifyContent: "center",
};
