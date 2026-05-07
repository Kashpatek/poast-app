"use client";

import React, { useEffect } from "react";
import { D, ft, gf, mn } from "../shared-constants";
import type { CoachContent } from "./tours";

interface CoachMarkProps {
  content: CoachContent;
  onDismiss: () => void;
  // Called when the user explicitly says "don't show again". Same effect as dismiss
  // for the modal; the difference is in what the host persists.
  onHidePermanent: () => void;
  primaryAction?: { label: string; onClick: () => void };
}

// A small, friendly card that pops up when the user lands on a tool for the first
// time. Bottom-right corner so it doesn't block the work area. Click outside to
// dismiss. No backdrop — coach marks shouldn't feel modal.
export function CoachMark({ content, onDismiss, onHidePermanent, primaryAction }: CoachMarkProps) {
  useEffect(() => {
    var onKey = function (e: KeyboardEvent) {
      if (e.key === "Escape") onDismiss();
    };
    window.addEventListener("keydown", onKey);
    return function () { window.removeEventListener("keydown", onKey); };
  }, [onDismiss]);

  return (
    <div style={wrap} role="dialog" aria-label={content.title}>
      <div style={badgeRow}>
        <span style={badge}>QUICK NOTE</span>
        <button type="button" onClick={onDismiss} aria-label="Close" style={closeBtn}>×</button>
      </div>
      <div style={titleStyle}>{content.title}</div>
      <p style={bodyStyle}>{content.body}</p>
      {content.tip ? (
        <div style={tipBox}>
          <span style={tipLabel}>TIP</span>
          <span style={tipText}>{content.tip}</span>
        </div>
      ) : null}
      <div style={actionRow}>
        <button type="button" onClick={onHidePermanent} style={hideBtn}>
          Don&apos;t show again
        </button>
        <div style={{ display: "flex", gap: 6 }}>
          <button type="button" onClick={onDismiss} style={secondaryBtn}>Got it</button>
          {primaryAction ? (
            <button type="button" onClick={primaryAction.onClick} style={primaryBtn}>
              {primaryAction.label}
            </button>
          ) : null}
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
  width: "min(380px, calc(100vw - 48px))",
  background: "#0A0A14",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 14,
  padding: "16px 18px 14px",
  boxShadow: "0 24px 60px rgba(0,0,0,0.55), 0 0 0 1px rgba(247,176,65,0.08), 0 0 24px rgba(247,176,65,0.06)",
  animation: "coachPop 0.32s cubic-bezier(0.16, 1, 0.3, 1)",
};

const badgeRow: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  marginBottom: 8,
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
  fontSize: 18,
  fontWeight: 800,
  color: D.tx,
  marginBottom: 6,
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
