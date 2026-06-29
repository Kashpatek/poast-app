"use client";
// MarketingSUITE · DatePicker — a calendar-popover replacement for the bare
// <input type="date"> used across the create layer. Same contract as a date
// input (value/onChange are "YYYY-MM-DD"), but clicking opens a styled month
// grid (portal) instead of relying on the browser's native picker.
//
// House style: inline React.CSSProperties + D tokens; no Tailwind, no deps.
import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { D, ft, mn } from "../../shared-constants";

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];
const MONTHS = ["January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"];

function parse(v?: string | null): { y: number; m: number; d: number } | null {
  const mm = /^(\d{4})-(\d{2})-(\d{2})/.exec(v || "");
  if (!mm) return null;
  return { y: +mm[1], m: +mm[2], d: +mm[3] };
}
function toVal(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}
export function formatDateLabel(v?: string | null): string {
  const p = parse(v);
  if (!p) return "";
  return new Date(p.y, p.m - 1, p.d).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function DatePicker({ value, onChange, placeholder = "Pick a date", accent = D.amber, clearable = true, style }: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  accent?: string;
  clearable?: boolean;
  style?: React.CSSProperties;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ left: number; top: number; up: boolean }>({ left: 0, top: 0, up: false });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);

  const sel = parse(value);
  const today = new Date();
  const [view, setView] = useState(() => {
    const p = sel || { y: today.getFullYear(), m: today.getMonth() + 1, d: 1 };
    return { y: p.y, m: p.m };
  });

  // Re-center the visible month on the selected value whenever the popover opens.
  useEffect(() => {
    if (!open) return;
    const p = parse(value) || { y: today.getFullYear(), m: today.getMonth() + 1, d: 1 };
    setView({ y: p.y, m: p.m });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;
    const r = triggerRef.current.getBoundingClientRect();
    const PANEL_H = 320;
    const up = r.bottom + PANEL_H > window.innerHeight && r.top > PANEL_H;
    setPos({ left: r.left, top: up ? r.top - 6 : r.bottom + 6, up });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (popRef.current?.contains(e.target as Node) || triggerRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    const onScroll = () => setOpen(false);
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [open]);

  const firstWeekday = new Date(view.y, view.m - 1, 1).getDay();
  const daysInMonth = new Date(view.y, view.m, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const step = (delta: number) => setView((v) => {
    const m = v.m + delta;
    if (m < 1) return { y: v.y - 1, m: 12 };
    if (m > 12) return { y: v.y + 1, m: 1 };
    return { y: v.y, m };
  });

  const navBtn = (onClick: () => void, children: React.ReactNode) => (
    <button onClick={onClick} style={{
      width: 26, height: 26, borderRadius: 7, cursor: "pointer", display: "inline-flex",
      alignItems: "center", justifyContent: "center", border: `1px solid ${D.border}`,
      background: "transparent", color: D.txm,
    }}>{children}</button>
  );

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          width: "100%", fontFamily: ft, fontSize: 13.5, textAlign: "left",
          color: value ? D.tx : D.txd, background: D.card,
          border: `1px solid ${open ? accent + "66" : D.border}`, borderRadius: 9,
          padding: "9px 11px", outline: "none", cursor: "pointer", boxSizing: "border-box",
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
          ...(style || {}),
        }}
      >
        <span>{value ? formatDateLabel(value) : placeholder}</span>
        <CalendarDays size={15} style={{ color: D.txm, flex: "none" }} />
      </button>

      {open && typeof document !== "undefined" && createPortal(
        <div
          ref={popRef}
          style={{
            position: "fixed", left: pos.left, top: pos.top, zIndex: 9000,
            transform: pos.up ? "translateY(-100%)" : "none",
            width: 252, background: D.surface, border: `1px solid ${accent}44`, borderRadius: 12,
            boxShadow: "0 20px 60px rgba(0,0,0,0.6)", padding: 12, fontFamily: ft,
          }}
        >
          {/* Header — month nav */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 9 }}>
            {navBtn(() => step(-1), <ChevronLeft size={15} />)}
            <span style={{ fontFamily: mn, fontSize: 12, letterSpacing: 0.3, color: D.tx }}>
              {MONTHS[view.m - 1]} {view.y}
            </span>
            {navBtn(() => step(1), <ChevronRight size={15} />)}
          </div>
          {/* Weekday header */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2, marginBottom: 4 }}>
            {WEEKDAYS.map((w, i) => (
              <span key={i} style={{ textAlign: "center", fontFamily: mn, fontSize: 9.5, color: D.txd }}>{w}</span>
            ))}
          </div>
          {/* Day grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2 }}>
            {cells.map((d, i) => {
              if (d == null) return <span key={i} />;
              const isSel = !!sel && sel.y === view.y && sel.m === view.m && sel.d === d;
              const isToday = today.getFullYear() === view.y && today.getMonth() + 1 === view.m && today.getDate() === d;
              return (
                <button
                  key={i}
                  onClick={() => { onChange(toVal(view.y, view.m, d)); setOpen(false); }}
                  style={{
                    height: 30, borderRadius: 7, cursor: "pointer", fontFamily: ft, fontSize: 12.5,
                    border: isToday && !isSel ? `1px solid ${accent}66` : "1px solid transparent",
                    background: isSel ? accent : "transparent",
                    color: isSel ? "#15100a" : D.tx, fontWeight: isSel ? 700 : 400,
                  }}
                >{d}</button>
              );
            })}
          </div>
          {/* Footer — Today / Clear */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 9 }}>
            <button onClick={() => { const n = new Date(); onChange(toVal(n.getFullYear(), n.getMonth() + 1, n.getDate())); setOpen(false); }}
              style={{ fontFamily: mn, fontSize: 10.5, color: accent, background: "transparent", border: "none", cursor: "pointer", padding: 2 }}>
              Today
            </button>
            {clearable && value && (
              <button onClick={() => { onChange(""); setOpen(false); }}
                style={{ fontFamily: mn, fontSize: 10.5, color: D.txm, background: "transparent", border: "none", cursor: "pointer", padding: 2 }}>
                Clear
              </button>
            )}
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
