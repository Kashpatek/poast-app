"use client";

// HubPalette — global ⌘K switcher for jumping between POAST hub sections.
// Mounted on poast-client.tsx and suppressed when sec === "tasks" so the Task
// Board's own ⌘K palette keeps ownership of that surface. Items are derived
// from SIDEBAR_CATS so any new section that lands in the sidebar is
// automatically searchable here without touching this file.

import React, { useState, useEffect, useMemo, useRef } from "react";
import { D as C, ft, mn } from "./shared-constants";

type LucideIcon = React.ComponentType<{ size?: number | string; strokeWidth?: number; color?: string; style?: React.CSSProperties }>;

export interface PaletteItem {
  id: string;
  label: string;
  cat: string;
  color: string;
  href?: string;
  Icon?: LucideIcon;
}

export default function HubPalette({ items, onSelect }: { items: PaletteItem[]; onSelect: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [idx, setIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) {
      setQ("");
      setIdx(0);
      // Defer focus until after the input is mounted in the DOM.
      const t = setTimeout(() => inputRef.current?.focus(), 0);
      return () => clearTimeout(t);
    }
  }, [open]);

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    if (!qq) return items;
    return items.filter((i) =>
      i.label.toLowerCase().includes(qq) ||
      i.id.toLowerCase().includes(qq) ||
      i.cat.toLowerCase().includes(qq)
    );
  }, [q, items]);

  useEffect(() => { if (idx >= filtered.length) setIdx(0); }, [filtered.length, idx]);

  if (!open) return null;

  function pick(item: PaletteItem) {
    if (item.href) {
      window.open(item.href, "_blank");
    } else {
      onSelect(item.id);
    }
    setOpen(false);
  }

  return (
    <div
      onClick={() => setOpen(false)}
      style={{
        position: "fixed", inset: 0,
        background: "rgba(0,0,0,0.65)",
        display: "flex", alignItems: "flex-start", justifyContent: "center",
        paddingTop: "12vh",
        zIndex: 10000,
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 560, maxWidth: "92vw",
          background: "linear-gradient(180deg, #0B0B0F, #08080C)",
          border: "1px solid " + C.amber + "35",
          borderRadius: 14,
          boxShadow: "0 24px 64px rgba(0,0,0,0.7), 0 0 48px " + C.amber + "18",
          overflow: "hidden",
        }}
      >
        <div style={{ padding: "14px 18px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontFamily: mn, fontSize: 11, color: C.amber, letterSpacing: 2, fontWeight: 700 }}>⌘K</span>
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => { setQ(e.target.value); setIdx(0); }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") { e.preventDefault(); setIdx((i) => Math.min(i + 1, filtered.length - 1)); }
              else if (e.key === "ArrowUp") { e.preventDefault(); setIdx((i) => Math.max(i - 1, 0)); }
              else if (e.key === "Enter") { e.preventDefault(); if (filtered[idx]) pick(filtered[idx]); }
            }}
            placeholder="Jump to anything…"
            style={{
              flex: 1, background: "transparent", border: "none", outline: "none",
              color: "#E8E4DD", fontFamily: ft, fontSize: 16, fontWeight: 500,
            }}
          />
          {q && (
            <span style={{ fontFamily: mn, fontSize: 9, color: "rgba(255,255,255,0.4)", letterSpacing: 1 }}>{filtered.length}/{items.length}</span>
          )}
        </div>
        <div style={{ maxHeight: 380, overflowY: "auto", padding: "6px 0" }}>
          {filtered.length === 0 && (
            <div style={{ padding: "26px", textAlign: "center", color: "rgba(255,255,255,0.3)", fontFamily: mn, fontSize: 11, letterSpacing: 0.5 }}>No matches.</div>
          )}
          {filtered.map((item, i) => {
            const active = i === idx;
            return (
              <div
                key={item.id}
                onMouseEnter={() => setIdx(i)}
                onClick={() => pick(item)}
                style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "10px 18px",
                  cursor: "pointer",
                  background: active ? "rgba(247,176,65,0.10)" : "transparent",
                  borderLeft: "2px solid " + (active ? item.color : "transparent"),
                  transition: "background 0.08s ease, border-color 0.08s ease",
                }}
              >
                {item.Icon && <item.Icon size={16} color={item.color} strokeWidth={1.8} />}
                <span style={{ fontFamily: ft, fontSize: 14, color: "#E8E4DD", flex: 1 }}>{item.label}</span>
                <span style={{ fontFamily: mn, fontSize: 9, color: item.color, letterSpacing: 1.5, textTransform: "uppercase" }}>{item.cat}</span>
                {item.href && <span style={{ fontFamily: mn, fontSize: 9, color: "rgba(255,255,255,0.3)" }}>↗</span>}
              </div>
            );
          })}
        </div>
        <div style={{ padding: "8px 18px", borderTop: "1px solid rgba(255,255,255,0.06)", display: "flex", gap: 14, fontFamily: mn, fontSize: 9, color: "rgba(255,255,255,0.3)", letterSpacing: 0.5 }}>
          <span>↑↓ navigate</span>
          <span>↵ open</span>
          <span>esc dismiss</span>
          <span style={{ marginLeft: "auto" }}>⌘K toggle</span>
        </div>
      </div>
    </div>
  );
}
