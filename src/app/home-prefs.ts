"use client";

// ─── Home organization store (site-wide) ────────────────────────────────────
// One source of truth for how every home orders its tools:
//   Recently used (most-recent first) → Favorites (pinned) → system order.
// Both lists are per-user localStorage, and any change broadcasts a window
// event so every mounted home re-reads immediately (and `storage` keeps other
// tabs in sync). Recents are insertion-ordered (unshift), so "recent first"
// needs no timestamps — which also keeps this resume/SSR-safe (no Date.now).

import { useEffect, useState } from "react";

const PIN_KEY = (o: string) => `poast-pins-${o || "anon"}`;
const REC_KEY = (o: string) => `poast-recent-${o || "anon"}`;
const EVT = "poast-homeprefs";
const REC_CAP = 12;

function read(key: string): string[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const v = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function write(key: string, arr: string[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(arr));
  } catch {
    /* private mode / quota — non-fatal */
  }
  try {
    window.dispatchEvent(new Event(EVT));
  } catch {
    /* SSR */
  }
}

// ── Favorites (pins) ──
export function readPins(owner: string): string[] {
  return read(PIN_KEY(owner));
}
export function isPinned(owner: string, id: string): boolean {
  return readPins(owner).includes(id);
}
/** Toggle a pin. New pins go to the FRONT so the newest favorite leads. */
export function togglePin(owner: string, id: string): string[] {
  const p = readPins(owner);
  const i = p.indexOf(id);
  if (i >= 0) p.splice(i, 1);
  else p.unshift(id);
  write(PIN_KEY(owner), p);
  return p;
}
export function removePin(owner: string, id: string): string[] {
  const p = readPins(owner).filter((x) => x !== id);
  write(PIN_KEY(owner), p);
  return p;
}

// ── Recently used ──
export function readRecent(owner: string): string[] {
  return read(REC_KEY(owner));
}
/** Record a tool open. Most-recent first, de-duped, capped. `home` is ignored. */
export function pushRecent(owner: string, id: string): void {
  if (!id || id === "home") return;
  const r = readRecent(owner).filter((x) => x !== id);
  r.unshift(id);
  write(REC_KEY(owner), r.slice(0, REC_CAP));
}

// ── Live hook ──
// Returns the current pins + recent for `owner`, re-reading whenever either
// changes in this tab (EVT) or another tab (storage).
export function useHomePrefs(owner: string): { pins: string[]; recent: string[] } {
  const [, bump] = useState(0);
  useEffect(() => {
    const h = () => bump((x) => x + 1);
    window.addEventListener(EVT, h);
    window.addEventListener("storage", h);
    return () => {
      window.removeEventListener(EVT, h);
      window.removeEventListener("storage", h);
    };
  }, []);
  return { pins: readPins(owner), recent: readRecent(owner) };
}
