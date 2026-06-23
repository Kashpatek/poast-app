"use client";
// Interactive first-run guided tour for MarketingSUITE — spotlight + coach-marks.
// Mirrors the mockup engine: highlights real shell elements (tagged data-tour),
// first-run only (localStorage + user_prefs.tour_seen), skippable, relaunchable
// via the "poast:replay-tour" window event (fired from Appearance settings).
import { useEffect, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { ft, gf, mn } from "../../shared-constants";

export interface TourStep {
  selector?: string;            // CSS selector of the element to spotlight (omit = centered)
  title: string;
  body: string;
  place?: "top" | "bottom" | "left" | "right" | "center";
  pad?: number;
}

interface Rect { top: number; left: number; width: number; height: number; }

const ACC = "var(--amber)";

export function MarketingTour({
  steps, storageKey, owner,
}: { steps: TourStep[]; storageKey: string; owner: string }) {
  const [i, setI] = useState(-1);
  const [rect, setRect] = useState<Rect | null>(null);
  const active = i >= 0;

  const finish = useCallback((commit: boolean) => {
    setI(-1);
    if (commit) {
      try { localStorage.setItem("poast3.tour." + storageKey, "1"); } catch {}
      try {
        fetch("/api/prefs", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ owner, tour_seen: true }),
        });
      } catch {}
    }
  }, [storageKey, owner]);

  // first-run auto-start (localStorage primary; server flag reconciled by provider)
  useEffect(() => {
    let seen = false;
    try { seen = localStorage.getItem("poast3.tour." + storageKey) === "1"; } catch {}
    if (seen) return;
    const t = setTimeout(() => setI(0), 850);
    return () => clearTimeout(t);
  }, [storageKey]);

  // relaunch from Settings
  useEffect(() => {
    const h = () => setI(0);
    window.addEventListener("poast:replay-tour", h);
    return () => window.removeEventListener("poast:replay-tour", h);
  }, []);

  // position spotlight for the active step
  useEffect(() => {
    if (!active) return;
    const step = steps[i];
    const calc = () => {
      if (!step?.selector) { setRect(null); return; }
      const el = document.querySelector(step.selector) as HTMLElement | null;
      if (!el) { setRect(null); return; }
      const r = el.getBoundingClientRect();
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
    };
    const el = step?.selector ? document.querySelector(step.selector) : null;
    if (el) (el as HTMLElement).scrollIntoView({ block: "center", behavior: "smooth" });
    const t = setTimeout(calc, el ? 180 : 0);
    window.addEventListener("resize", calc);
    window.addEventListener("scroll", calc, true);
    return () => { clearTimeout(t); window.removeEventListener("resize", calc); window.removeEventListener("scroll", calc, true); };
  }, [active, i, steps]);

  // keyboard
  useEffect(() => {
    if (!active) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") finish(true);
      else if (e.key === "ArrowRight") setI((x) => (x >= steps.length - 1 ? (finish(true), -1) : x + 1));
      else if (e.key === "ArrowLeft") setI((x) => Math.max(0, x - 1));
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [active, steps.length, finish]);

  if (!active || typeof document === "undefined") return null;

  const step = steps[i];
  const last = i === steps.length - 1;
  const pad = step.pad ?? 8;

  // card placement
  const cw = 330, ch = 196, gap = 16, m = 12;
  const vw = typeof window !== "undefined" ? window.innerWidth : 1440;
  const vh = typeof window !== "undefined" ? window.innerHeight : 900;
  let cardTop: number, cardLeft: number;
  let place = step.place;
  if (!rect || place === "center") {
    cardLeft = (vw - cw) / 2; cardTop = (vh - ch) / 2; place = "center";
  } else {
    if (!place) {
      if (vw - (rect.left + rect.width) > cw + 28) place = "right";
      else if (rect.left > cw + 28) place = "left";
      else if (vh - (rect.top + rect.height) > ch + 28) place = "bottom";
      else place = "top";
    }
    if (place === "right") { cardLeft = rect.left + rect.width + gap; cardTop = rect.top; }
    else if (place === "left") { cardLeft = rect.left - cw - gap; cardTop = rect.top; }
    else if (place === "top") { cardLeft = rect.left; cardTop = rect.top - ch - gap; }
    else { cardLeft = rect.left; cardTop = rect.top + rect.height + gap; }
  }
  cardLeft = Math.max(m, Math.min(cardLeft, vw - cw - m));
  cardTop = Math.max(m, Math.min(cardTop, vh - ch - m));

  const overlay = (
    <div style={{ position: "fixed", inset: 0, zIndex: 9000, fontFamily: ft }}>
      {/* catcher dims interaction */}
      <div style={{ position: "fixed", inset: 0 }} />
      {/* spotlight */}
      <div style={{
        position: "fixed",
        top: rect ? rect.top - pad : vh / 2, left: rect ? rect.left - pad : vw / 2,
        width: rect ? rect.width + pad * 2 : 0, height: rect ? rect.height + pad * 2 : 0,
        borderRadius: 12, pointerEvents: "none",
        boxShadow: rect
          ? `0 0 0 9999px rgba(6,5,12,0.66), 0 0 0 2px ${ACC}, 0 0 26px 4px color-mix(in srgb, ${ACC} 45%, transparent)`
          : "0 0 0 9999px rgba(6,5,12,0.74)",
        transition: "all 0.32s cubic-bezier(.3,.7,.3,1)",
      }} />
      {/* card */}
      <div style={{
        position: "fixed", top: cardTop, left: cardLeft, width: cw, zIndex: 9002,
        background: "linear-gradient(180deg, rgba(20,19,28,0.98), rgba(10,10,16,0.98))",
        border: "1px solid rgba(255,255,255,0.10)", borderRadius: 18, padding: "18px 18px 14px",
        boxShadow: "0 24px 70px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.06)",
        backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)", color: "#EDE9E2",
      }}>
        <button onClick={() => finish(true)} style={{
          position: "absolute", top: 14, right: 14, fontFamily: mn, fontSize: 10,
          letterSpacing: ".14em", textTransform: "uppercase", color: "#6b6776",
          background: "transparent", border: "none", cursor: "pointer",
        }}>Skip</button>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: mn, fontSize: 10, letterSpacing: ".24em", textTransform: "uppercase", color: ACC, marginBottom: 9 }}>
          <span>POAST tour</span><span style={{ color: "#8A8690" }}>{i + 1} / {steps.length}</span>
        </div>
        <h3 style={{ fontFamily: gf, fontWeight: 700, fontSize: 18, letterSpacing: "-0.01em", margin: "0 0 7px" }}>{step.title}</h3>
        <div style={{ fontSize: 13.5, lineHeight: 1.55, color: "#B9B4BE", fontWeight: 300 }} dangerouslySetInnerHTML={{ __html: step.body }} />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 16, gap: 12 }}>
          <div style={{ display: "flex", gap: 6 }}>
            {steps.map((_, k) => (
              <span key={k} style={{ width: k === i ? 18 : 6, height: 6, borderRadius: 3, background: k === i ? ACC : "rgba(255,255,255,0.18)", transition: "all .2s" }} />
            ))}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {i > 0 && (
              <button onClick={() => setI(i - 1)} style={btn("back")}>Back</button>
            )}
            <button onClick={() => (last ? finish(true) : setI(i + 1))} style={btn("next")}>{last ? "Finish" : "Next"}</button>
          </div>
        </div>
      </div>
    </div>
  );
  return createPortal(overlay, document.body);
}

function btn(kind: "next" | "back"): React.CSSProperties {
  if (kind === "next") return {
    fontFamily: ft, fontWeight: 600, fontSize: 13, cursor: "pointer", borderRadius: 10,
    padding: "9px 14px", border: "1px solid transparent", color: "#1a1208",
    background: `linear-gradient(135deg, #FFC766, ${ACC})`,
    boxShadow: `0 8px 22px color-mix(in srgb, ${ACC} 30%, transparent)`,
  };
  return {
    fontFamily: ft, fontWeight: 600, fontSize: 13, cursor: "pointer", borderRadius: 10,
    padding: "9px 14px", border: "1px solid rgba(255,255,255,0.10)", color: "#B9B4BE",
    background: "rgba(255,255,255,0.04)",
  };
}

// Default MarketingSUITE step set — targets shell elements tagged with data-tour.
export const MARKETING_TOUR_STEPS: TourStep[] = [
  { title: "Welcome to MarketingSUITE 👋", body: "Your launch-control cockpit for everything marketing. Quick 30-second tour — skip anytime.", place: "center" },
  { selector: '[data-tour="wordmark"]', title: "You're in MarketingSUITE", body: "Tap <b>← POAST</b> any time to return to the main hub. The rest of this bar is your command center.", place: "bottom" },
  { selector: '[data-tour="assistant"]', title: "The assistant omnibox", body: "Type or paste anything — a link, an idea, a press note — and POAST figures out what to create.", place: "bottom" },
  { selector: '[data-tour="rail"]', title: "Switch views here", body: "Today, Schedule, Calendar, Timeline, Board, Campaigns and more — your whole workflow down the left rail.", place: "right" },
  { selector: '[data-tour="panel"]', title: "Your widgets", body: "Toggle the right panel for live timers, insights and quick stats. Hide it when you want focus.", place: "bottom" },
  { selector: '[data-tour="settings"]', title: "Settings & your theme", body: "Open <b>Settings</b> to switch your theme — <b>Classic</b>, <b>Stock</b> or <b>Glass</b> — and your backdrop. Replay this tour from here too.", place: "bottom" },
  { title: "You're all set 🚀", body: "That's the tour. Everything saves automatically. Welcome aboard!", place: "center" },
];
