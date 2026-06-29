"use client";
// Shared right-click context menu for MarketingSUITE surfaces (Agenda, Calendar,
// Timeline). Portaled to <body>, closes on outside-click / Esc / scroll. Items
// can be actions, separators, non-clickable section headings, or "choice" rows
// with a leading color dot + an active check (used by Timeline's move-to-lane).
import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Check } from "lucide-react";
import { D, ft, mn } from "../../shared-constants";

// Floating popovers need an opaque surface: var(--bg) is semi-transparent under
// the Stock/Glass themes, which would let event chips bleed through the menu.
// Matches the opaque panel used by the calendar's "+N more" popover.
const MENU_SURFACE = "#0c0c14";

export type MenuItem = {
  label?: string;
  icon?: React.ReactNode;
  onClick?: () => void;
  danger?: boolean;
  sep?: boolean;
  hint?: string;
  heading?: string;   // non-clickable section label
  dot?: string;       // leading color dot (lane / campaign accent)
  active?: boolean;   // current selection — tinted row + amber check
};

// Generic menu anchor used by the view-level state (`null` = closed).
export type MenuState = { x: number; y: number; items: MenuItem[] } | null;

export function ContextMenu({ x, y, items, onClose, width = 220 }: {
  x: number; y: number; items: MenuItem[]; onClose: () => void; width?: number;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = () => onClose();
    // Ignore scrolls that originate INSIDE the menu's own overflow container —
    // a capture-phase window listener otherwise fires for them and would close
    // a tall (scrollable) menu the instant the user scrolls within it.
    const onScroll = (e: Event) => {
      if (e.target instanceof Node && rootRef.current?.contains(e.target)) return;
      onClose();
    };
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("pointerdown", close);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("keydown", k);
    return () => {
      window.removeEventListener("pointerdown", close);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("keydown", k);
    };
  }, [onClose]);
  if (typeof document === "undefined") return null;
  const W = width;
  // Rough height estimate so the menu flips up when it'd overflow the bottom.
  const estH = items.reduce((h, it) => h + (it.sep ? 11 : it.heading ? 24 : 33), 0) + 12;
  const left = Math.max(8, Math.min(x, window.innerWidth - W - 8));
  const top = Math.min(y, Math.max(8, window.innerHeight - estH - 8));
  return createPortal(
    <div ref={rootRef} onPointerDown={(e) => e.stopPropagation()} onContextMenu={(e) => e.preventDefault()}
      style={{
        position: "fixed", left, top, width: W, zIndex: 14000, background: MENU_SURFACE,
        border: `1px solid ${D.border}`, borderRadius: 11, boxShadow: "0 20px 56px rgba(0,0,0,0.62)",
        padding: 6, fontFamily: ft, maxHeight: "min(76vh, 560px)", overflowY: "auto",
      }}>
      {items.map((it, i) => it.sep ? (
        <div key={i} style={{ height: 1, background: D.border, margin: "5px 6px" }} />
      ) : it.heading ? (
        <div key={i} style={{ fontFamily: mn, fontSize: 8.5, letterSpacing: 0.7, textTransform: "uppercase", color: D.txd, padding: "6px 9px 3px" }}>{it.heading}</div>
      ) : (
        <button key={i} onClick={() => { onClose(); it.onClick?.(); }}
          onMouseEnter={(e) => { e.currentTarget.style.background = D.hover; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = it.active ? D.hover : "transparent"; }}
          style={{
            display: "flex", alignItems: "center", gap: 9, width: "100%", textAlign: "left",
            border: "none", background: it.active ? D.hover : "transparent",
            color: it.danger ? D.coral : D.tx, cursor: "pointer", padding: "7px 9px",
            borderRadius: 7, fontFamily: ft, fontSize: 12.5,
          }}>
          {it.dot
            ? <span style={{ width: 15, flex: "none", display: "inline-flex", justifyContent: "center" }}><span style={{ width: 8, height: 8, borderRadius: 999, background: it.dot }} /></span>
            : <span style={{ width: 15, flex: "none", display: "inline-flex", color: it.danger ? D.coral : D.txm }}>{it.icon}</span>}
          <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.label}</span>
          {it.active && <Check size={12} color={D.amber} style={{ flex: "none" }} />}
          {it.hint && <span style={{ fontFamily: mn, fontSize: 9, color: D.txd, flex: "none" }}>{it.hint}</span>}
        </button>
      ))}
    </div>,
    document.body,
  );
}
