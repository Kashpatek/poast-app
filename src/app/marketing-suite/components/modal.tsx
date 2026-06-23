"use client";
// Reusable modal primitive + form atoms for the MarketingSUITE create layer.
// No dialog primitive existed in the suite, so this is the one place backdrop /
// focus / Esc-to-close / overlay styling lives. House style: inline
// React.CSSProperties + D tokens, fonts ft/gf/mn.
import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { D, ft, gf, mn } from "../../shared-constants";

export function Modal({
  open, title, subtitle, accent = D.amber, icon, onClose, children, footer, width = 560,
}: {
  open: boolean;
  title: string;
  subtitle?: string;
  accent?: string;
  icon?: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: number;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: "fixed", inset: 0, zIndex: 300, display: "flex",
        alignItems: "flex-start", justifyContent: "center", padding: "7vh 16px 16px",
        background: "rgba(4,4,9,0.66)", backdropFilter: "blur(7px)", WebkitBackdropFilter: "blur(7px)",
        overflowY: "auto",
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        style={{
          width: "100%", maxWidth: width, background: D.surface,
          border: `1px solid ${accent}44`, borderRadius: 16,
          boxShadow: `0 30px 90px rgba(0,0,0,0.62), 0 0 0 1px rgba(255,255,255,0.02)`,
          fontFamily: ft, color: D.tx, overflow: "hidden",
        }}
      >
        {/* Header */}
        <div style={{
          display: "flex", alignItems: "flex-start", gap: 12, padding: "16px 18px",
          borderBottom: `1px solid ${D.border}`,
          background: `linear-gradient(180deg, ${accent}12, transparent)`,
        }}>
          {icon && (
            <div style={{
              width: 34, height: 34, borderRadius: 9, flex: "none", display: "flex",
              alignItems: "center", justifyContent: "center",
              background: accent + "1c", border: `1px solid ${accent}55`, color: accent,
            }}>
              {icon}
            </div>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: gf, fontSize: 17, fontWeight: 700, letterSpacing: 0.2 }}>{title}</div>
            {subtitle && <div style={{ fontSize: 12, color: D.txm, marginTop: 2 }}>{subtitle}</div>}
          </div>
          <button onClick={onClose} title="Close (Esc)" style={{
            width: 30, height: 30, borderRadius: 8, flex: "none", cursor: "pointer",
            border: `1px solid ${D.border}`, background: "transparent", color: D.txm,
            display: "inline-flex", alignItems: "center", justifyContent: "center",
          }}>
            <X size={16} />
          </button>
        </div>
        {/* Body */}
        <div style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: 13 }}>
          {children}
        </div>
        {/* Footer */}
        {footer && (
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 9,
            padding: "13px 18px", borderTop: `1px solid ${D.border}`, background: "rgba(255,255,255,0.015)",
          }}>
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

// ─── Form atoms ───
const labelStyle: React.CSSProperties = {
  fontFamily: mn, fontSize: 9.5, letterSpacing: 0.6, textTransform: "uppercase", color: D.txd,
  marginBottom: 5, display: "block",
};
const fieldBase: React.CSSProperties = {
  width: "100%", fontFamily: ft, fontSize: 13.5, color: D.tx, background: D.card,
  border: `1px solid ${D.border}`, borderRadius: 9, padding: "9px 11px", outline: "none",
  boxSizing: "border-box",
};

export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "block" }}>
      <span style={labelStyle}>{label}</span>
      {children}
      {hint && <span style={{ fontSize: 11, color: D.txd, marginTop: 4, display: "block" }}>{hint}</span>}
    </label>
  );
}

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      style={{ ...fieldBase, ...(props.style || {}) }}
      onFocus={(e) => { e.currentTarget.style.borderColor = `${D.amber}66`; props.onFocus?.(e); }}
      onBlur={(e) => { e.currentTarget.style.borderColor = D.border; props.onBlur?.(e); }}
    />
  );
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      style={{ ...fieldBase, minHeight: 72, resize: "vertical", lineHeight: 1.45, ...(props.style || {}) }}
      onFocus={(e) => { e.currentTarget.style.borderColor = `${D.amber}66`; props.onFocus?.(e); }}
      onBlur={(e) => { e.currentTarget.style.borderColor = D.border; props.onBlur?.(e); }}
    />
  );
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...props} style={{ ...fieldBase, cursor: "pointer", appearance: "none", ...(props.style || {}) }} />
  );
}

export function Row({ children, cols = 2 }: { children: React.ReactNode; cols?: number }) {
  return <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 11 }}>{children}</div>;
}

export function GhostBtn({ children, onClick, disabled }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      fontFamily: mn, fontSize: 11.5, letterSpacing: 0.4, borderRadius: 9, padding: "9px 15px",
      cursor: disabled ? "default" : "pointer", border: `1px solid ${D.border}`,
      background: "transparent", color: D.txm, opacity: disabled ? 0.5 : 1,
    }}>{children}</button>
  );
}

export function PrimaryBtn({ children, onClick, disabled, accent = D.amber }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean; accent?: string }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      fontFamily: mn, fontSize: 11.5, letterSpacing: 0.4, fontWeight: 700, borderRadius: 9, padding: "9px 17px",
      cursor: disabled ? "default" : "pointer", border: "none", color: "#15100a",
      background: disabled ? D.border : `linear-gradient(135deg, ${accent}, ${accent}cc)`,
      opacity: disabled ? 0.6 : 1, transition: "opacity 0.15s",
    }}>{children}</button>
  );
}

// Segmented chip picker (used for schedule-kind, calendar target, etc.)
export function ChipPicker<T extends string>({ options, value, onChange }: {
  options: { key: T; label: string; color?: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
      {options.map((o) => {
        const on = o.key === value;
        const c = o.color || D.amber;
        return (
          <button key={o.key} onClick={() => onChange(o.key)} style={{
            fontFamily: mn, fontSize: 11, letterSpacing: 0.3, borderRadius: 999, padding: "6px 13px",
            cursor: "pointer", border: `1px solid ${on ? c : D.border}`,
            background: on ? c + "1f" : "transparent", color: on ? c : D.txm,
            display: "inline-flex", alignItems: "center", gap: 6, transition: "all 0.14s",
          }}>
            <span style={{ width: 7, height: 7, borderRadius: 999, background: c }} />
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
