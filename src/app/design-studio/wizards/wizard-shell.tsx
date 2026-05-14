"use client";

// Shared modal chrome for every DesignStudio wizard. One overlay, scroll-safe
// panel, step dots, back/next + skip. Wizards plug their step content into
// `children`. Cribbed from onboarding/welcome-modal.tsx with looser styling
// so wizards can host form fields, grids, etc.

import React, { useEffect } from "react";
import { D, ft, gf, mn } from "../../shared-constants";

export interface WizardShellProps {
  open: boolean;
  title: string;
  badge?: string;
  step: number;       // 0-indexed
  totalSteps: number;
  canGoBack?: boolean;
  canGoNext?: boolean;
  isFinalStep?: boolean;
  nextLabel?: string;
  finalLabel?: string;
  onBack?: () => void;
  onNext?: () => void;
  onClose: () => void;
  children: React.ReactNode;
}

export function WizardShell(props: WizardShellProps) {
  const {
    open,
    title,
    badge,
    step,
    totalSteps,
    canGoBack = true,
    canGoNext = true,
    isFinalStep = false,
    nextLabel = "Next",
    finalLabel = "Create",
    onBack,
    onNext,
    onClose,
    children,
  } = props;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && onNext && canGoNext) onNext();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, onNext, canGoNext]);

  if (!open) return null;

  return (
    <div style={overlay} onClick={onClose}>
      <div style={panel} onClick={(e) => e.stopPropagation()}>
        <div style={headerRow}>
          <span style={badgeStyle}>{badge ?? "DESIGN STUDIO"}</span>
          <span style={stepCounter}>
            {step + 1} / {totalSteps}
          </span>
        </div>

        <h1 style={titleStyle}>{title}</h1>

        <div style={body}>{children}</div>

        <div style={dotRow}>
          {Array.from({ length: totalSteps }).map((_, i) => (
            <span key={i} style={i === step ? dotActive : dot} />
          ))}
        </div>

        <div style={actionRow}>
          <button type="button" style={skipBtn} onClick={onClose}>
            Cancel
          </button>
          <div style={{ display: "flex", gap: 8 }}>
            {step > 0 && canGoBack && onBack ? (
              <button type="button" style={secondaryBtn} onClick={onBack}>
                ← Back
              </button>
            ) : null}
            <button
              type="button"
              style={{ ...primaryBtn, opacity: canGoNext ? 1 : 0.45, cursor: canGoNext ? "pointer" : "not-allowed" }}
              disabled={!canGoNext}
              onClick={canGoNext ? onNext : undefined}
              autoFocus
            >
              {isFinalStep ? finalLabel : nextLabel + " →"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const overlay: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(6,6,12,0.78)",
  backdropFilter: "blur(8px)",
  WebkitBackdropFilter: "blur(8px)",
  zIndex: 12000,
  display: "flex",
  alignItems: "safe center",
  justifyContent: "center",
  overflowY: "auto",
  padding: 24,
};

const panel: React.CSSProperties = {
  width: "min(680px, 96vw)",
  background: "#0A0A14",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 14,
  padding: "26px 28px 22px",
  boxShadow: "0 32px 80px rgba(0,0,0,0.55), 0 0 0 1px rgba(247,176,65,0.05)",
  maxHeight: "calc(100vh - 48px)",
  overflowY: "auto",
  flexShrink: 0,
};

const headerRow: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: 18,
};

const badgeStyle: React.CSSProperties = {
  fontFamily: mn,
  fontSize: 10,
  letterSpacing: 2,
  fontWeight: 700,
  color: D.amber,
  background: "rgba(247,176,65,0.12)",
  border: `1px solid ${D.amber}`,
  padding: "3px 8px",
  borderRadius: 4,
};

const stepCounter: React.CSSProperties = {
  fontFamily: mn,
  fontSize: 10,
  letterSpacing: 1.5,
  color: D.txd,
};

const titleStyle: React.CSSProperties = {
  fontFamily: gf,
  fontSize: 26,
  fontWeight: 900,
  letterSpacing: -0.6,
  color: D.tx,
  margin: "0 0 16px",
};

const body: React.CSSProperties = {
  marginBottom: 18,
};

const dotRow: React.CSSProperties = {
  display: "flex",
  gap: 6,
  justifyContent: "center",
  marginBottom: 16,
};

const dot: React.CSSProperties = {
  width: 6,
  height: 6,
  borderRadius: "50%",
  background: D.border,
  transition: "background 0.2s ease, width 0.2s ease",
};

const dotActive: React.CSSProperties = {
  width: 18,
  height: 6,
  borderRadius: 3,
  background: D.amber,
};

const actionRow: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 8,
};

const primaryBtn: React.CSSProperties = {
  background: D.amber,
  color: "#060608",
  border: "none",
  padding: "10px 18px",
  borderRadius: 8,
  fontFamily: ft,
  fontSize: 13,
  fontWeight: 800,
  cursor: "pointer",
  letterSpacing: 0.3,
};

const secondaryBtn: React.CSSProperties = {
  background: "transparent",
  color: D.tx,
  border: `1px solid ${D.border}`,
  padding: "10px 16px",
  borderRadius: 8,
  fontFamily: ft,
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
};

const skipBtn: React.CSSProperties = {
  background: "transparent",
  color: D.txd,
  border: "none",
  padding: "10px 6px",
  fontFamily: mn,
  fontSize: 11,
  cursor: "pointer",
  letterSpacing: 0.3,
};

// Shared form bits used inside wizard steps.
export const wizardFieldset: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 14,
};

export const wizardLabel: React.CSSProperties = {
  fontFamily: mn,
  fontSize: 10,
  letterSpacing: 1.6,
  textTransform: "uppercase",
  color: D.txd,
  marginBottom: 6,
  display: "block",
};

export const wizardInput: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  background: "rgba(255,255,255,0.03)",
  border: `1px solid ${D.border}`,
  borderRadius: 8,
  color: D.tx,
  fontFamily: ft,
  fontSize: 14,
  outline: "none",
  boxSizing: "border-box",
};

export const wizardTextarea: React.CSSProperties = {
  ...wizardInput,
  minHeight: 90,
  resize: "vertical",
  fontFamily: ft,
  lineHeight: 1.5,
};
