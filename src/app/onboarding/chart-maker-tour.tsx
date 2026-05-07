"use client";

import React, { useEffect, useState } from "react";
import { D, ft, gf, mn } from "../shared-constants";
import { CHART_TOUR_STEPS } from "./tours";

interface ChartMakerTourProps {
  onClose: () => void;
  onComplete: () => void;
}

// Multi-step tour for Chart Maker 2. Bigger / more detailed than the other tool
// coach marks because Chart Maker 2 itself is more intricate. Bottom-right
// dock so the user can keep the chart in view while reading.
export function ChartMakerTour({ onClose, onComplete }: ChartMakerTourProps) {
  const [idx, setIdx] = useState(0);
  const total = CHART_TOUR_STEPS.length;
  const step = CHART_TOUR_STEPS[idx];
  const isLast = idx === total - 1;

  useEffect(() => {
    var onKey = function (e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") setIdx(function (i) { return Math.min(total - 1, i + 1); });
      if (e.key === "ArrowLeft") setIdx(function (i) { return Math.max(0, i - 1); });
    };
    window.addEventListener("keydown", onKey);
    return function () { window.removeEventListener("keydown", onKey); };
  }, [onClose, total]);

  return (
    <div style={wrap} role="dialog" aria-label="Chart Maker tour">
      <div style={badgeRow}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={badge}>CHART MAKER TOUR</span>
          <span style={stepCount}>{idx + 1} / {total}</span>
        </div>
        <button type="button" onClick={onClose} aria-label="Close" style={closeBtn}>×</button>
      </div>

      <div style={titleStyle}>{step.title}</div>
      <p style={bodyStyle}>{step.body}</p>
      {step.tip ? (
        <div style={tipBox}>
          <span style={tipLabel}>TIP</span>
          <span style={tipText}>{step.tip}</span>
        </div>
      ) : null}

      <div style={dotRow}>
        {CHART_TOUR_STEPS.map(function (_, i) {
          return <span key={i} style={i === idx ? dotActive : dot} onClick={function () { setIdx(i); }} />;
        })}
      </div>

      <div style={actionRow}>
        <button type="button" style={hideBtn} onClick={onClose}>
          Skip tour
        </button>
        <div style={{ display: "flex", gap: 6 }}>
          {idx > 0 ? (
            <button type="button" style={secondaryBtn} onClick={function () { setIdx(idx - 1); }}>
              ← Back
            </button>
          ) : null}
          {!isLast ? (
            <button type="button" style={primaryBtn} onClick={function () { setIdx(idx + 1); }} autoFocus>
              Next →
            </button>
          ) : (
            <button type="button" style={primaryBtn} onClick={onComplete} autoFocus>
              Got it
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

const wrap: React.CSSProperties = {
  position: "fixed",
  right: 24,
  bottom: 24,
  zIndex: 11500,
  width: "min(420px, calc(100vw - 48px))",
  background: "#0A0A14",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 14,
  padding: "16px 18px 14px",
  boxShadow: "0 24px 60px rgba(0,0,0,0.55), 0 0 0 1px rgba(247,176,65,0.08), 0 0 32px rgba(247,176,65,0.08)",
  animation: "coachPop 0.32s cubic-bezier(0.16, 1, 0.3, 1)",
};

const badgeRow: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  marginBottom: 10,
};

const badge: React.CSSProperties = {
  fontFamily: mn,
  fontSize: 9,
  letterSpacing: 2,
  fontWeight: 700,
  color: D.amber,
  background: "rgba(247,176,65,0.12)",
  border: `1px solid ${D.amber}`,
  padding: "2px 7px",
  borderRadius: 4,
};

const stepCount: React.CSSProperties = {
  fontFamily: mn,
  fontSize: 10,
  color: D.txd,
  letterSpacing: 1,
};

const closeBtn: React.CSSProperties = {
  background: "transparent",
  border: "none",
  color: D.txd,
  fontSize: 18,
  cursor: "pointer",
  padding: 0,
  width: 22,
  height: 22,
  lineHeight: "20px",
};

const titleStyle: React.CSSProperties = {
  fontFamily: gf,
  fontSize: 20,
  fontWeight: 800,
  color: D.tx,
  marginBottom: 8,
};

const bodyStyle: React.CSSProperties = {
  fontFamily: ft,
  fontSize: 13,
  color: D.txm,
  lineHeight: 1.6,
  margin: "0 0 10px",
};

const tipBox: React.CSSProperties = {
  display: "flex",
  alignItems: "baseline",
  gap: 8,
  background: "rgba(11,134,209,0.08)",
  border: `1px solid rgba(11,134,209,0.25)`,
  borderRadius: 8,
  padding: "8px 10px",
  marginBottom: 12,
};

const tipLabel: React.CSSProperties = {
  fontFamily: mn,
  fontSize: 9,
  fontWeight: 700,
  letterSpacing: 1.5,
  color: D.blue,
  flexShrink: 0,
};

const tipText: React.CSSProperties = {
  fontFamily: ft,
  fontSize: 12,
  color: D.txm,
  lineHeight: 1.5,
};

const dotRow: React.CSSProperties = {
  display: "flex",
  gap: 6,
  justifyContent: "center",
  marginBottom: 14,
};

const dot: React.CSSProperties = {
  width: 6,
  height: 6,
  borderRadius: "50%",
  background: D.border,
  cursor: "pointer",
  transition: "background 0.2s ease",
};

const dotActive: React.CSSProperties = {
  width: 18,
  height: 6,
  borderRadius: 3,
  background: D.amber,
  cursor: "pointer",
  transition: "background 0.2s ease",
};

const actionRow: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 8,
};

const hideBtn: React.CSSProperties = {
  background: "transparent",
  color: D.txd,
  border: "none",
  fontFamily: mn,
  fontSize: 10,
  letterSpacing: 0.4,
  cursor: "pointer",
  padding: 0,
  textDecoration: "underline",
  textDecorationColor: "rgba(255,255,255,0.1)",
  textUnderlineOffset: 3,
};

const secondaryBtn: React.CSSProperties = {
  background: "transparent",
  color: D.tx,
  border: `1px solid ${D.border}`,
  padding: "6px 12px",
  borderRadius: 7,
  fontFamily: ft,
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
};

const primaryBtn: React.CSSProperties = {
  background: D.amber,
  color: "#060608",
  border: "none",
  padding: "6px 12px",
  borderRadius: 7,
  fontFamily: ft,
  fontSize: 12,
  fontWeight: 800,
  cursor: "pointer",
};
