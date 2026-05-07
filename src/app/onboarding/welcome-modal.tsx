"use client";

import React, { useEffect, useState } from "react";
import { D, ft, gf, mn } from "../shared-constants";
import { WELCOME_STEPS } from "./tours";

interface WelcomeModalProps {
  onClose: () => void;
  onComplete: () => void;
}

export function WelcomeModal({ onClose, onComplete }: WelcomeModalProps) {
  const [idx, setIdx] = useState(0);
  const total = WELCOME_STEPS.length;
  const step = WELCOME_STEPS[idx];
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
    <div style={overlay} onClick={onClose}>
      <div style={panel} onClick={function (e) { e.stopPropagation(); }}>
        <div style={badgeRow}>
          <span style={badge}>HELLO</span>
          <span style={stepCount}>{idx + 1} / {total}</span>
        </div>

        <h1 style={titleStyle}>{step.title}</h1>
        {step.subtitle ? <div style={subtitleStyle}>{step.subtitle}</div> : null}
        <p style={bodyStyle}>{step.body}</p>

        {step.bullets && step.bullets.length ? (
          <div style={bulletList}>
            {step.bullets.map(function (b, i) {
              return (
                <div key={i} style={bulletRow}>
                  <div style={bulletLabel}>{b.label}</div>
                  <div style={bulletText}>{b.text}</div>
                </div>
              );
            })}
          </div>
        ) : null}

        <div style={dotRow}>
          {WELCOME_STEPS.map(function (_, i) {
            return <span key={i} style={i === idx ? dotActive : dot} onClick={function () { setIdx(i); }} />;
          })}
        </div>

        <div style={actionRow}>
          <button type="button" style={skipBtn} onClick={onClose}>
            Skip for now
          </button>
          <div style={{ display: "flex", gap: 8 }}>
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
                Let&apos;s start
              </button>
            )}
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
  alignItems: "center",
  justifyContent: "center",
  padding: 24,
};

const panel: React.CSSProperties = {
  width: "min(560px, 96vw)",
  background: "#0A0A14",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 14,
  padding: "28px 28px 22px",
  boxShadow: "0 32px 80px rgba(0,0,0,0.55), 0 0 0 1px rgba(247,176,65,0.05)",
};

const badgeRow: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: 18,
};

const badge: React.CSSProperties = {
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

const stepCount: React.CSSProperties = {
  fontFamily: mn,
  fontSize: 10,
  letterSpacing: 1.5,
  color: D.txd,
};

const titleStyle: React.CSSProperties = {
  fontFamily: gf,
  fontSize: 30,
  fontWeight: 900,
  letterSpacing: -0.8,
  color: D.tx,
  margin: "0 0 6px",
};

const subtitleStyle: React.CSSProperties = {
  fontFamily: ft,
  fontSize: 14,
  color: D.amber,
  marginBottom: 12,
  fontWeight: 600,
};

const bodyStyle: React.CSSProperties = {
  fontFamily: ft,
  fontSize: 14,
  color: D.txm,
  lineHeight: 1.6,
  margin: "0 0 16px",
};

const bulletList: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 10,
  marginBottom: 18,
};

const bulletRow: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "120px 1fr",
  gap: 12,
  alignItems: "baseline",
  background: "rgba(255,255,255,0.02)",
  border: `1px solid ${D.border}`,
  borderRadius: 8,
  padding: "10px 14px",
};

const bulletLabel: React.CSSProperties = {
  fontFamily: ft,
  fontSize: 13,
  fontWeight: 800,
  color: D.tx,
};

const bulletText: React.CSSProperties = {
  fontFamily: ft,
  fontSize: 13,
  color: D.txm,
  lineHeight: 1.5,
};

const dotRow: React.CSSProperties = {
  display: "flex",
  gap: 6,
  justifyContent: "center",
  marginBottom: 18,
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
