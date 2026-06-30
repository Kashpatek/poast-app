"use client";
// Client hook for Google Calendar connection state (per signed-in user).
import { useCallback, useEffect, useState } from "react";
import { D } from "../shared-constants";
import { DEFAULT_CALENDARS } from "./marketing-constants";

export interface GoogleCalendarInfo { id: string; summary: string; primary?: boolean; backgroundColor?: string; }
export interface GooglePrefs {
  // Which calendars feed MarketingSUITE. A calendar is on unless explicitly
  // false (default-on), so a fresh connection shows everything until narrowed.
  selected?: Record<string, boolean>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [k: string]: any;
}
export interface GoogleStatus {
  configured: boolean;
  connected: boolean;
  email?: string;
  calendars?: GoogleCalendarInfo[];
  prefs?: GooglePrefs;
}

// A calendar feeds the suite unless its pref is explicitly false (default-on).
export function isCalSelected(prefs: GooglePrefs | undefined, calId: string): boolean {
  return prefs?.selected?.[calId] !== false;
}

export interface CalTarget { id: string; name: string; color: string; google: boolean; }
// One source of truth for the "which calendar" picker (create + edit) and the
// calendar-name lookup in the agenda: the in-app SA calendar plus every
// connected + selected Google calendar.
export function calendarTargets(status: GoogleStatus | undefined): CalTarget[] {
  const out: CalTarget[] = DEFAULT_CALENDARS.map((c) => ({ id: c.id, name: c.name, color: c.color, google: false }));
  if (status?.connected) {
    for (const c of status.calendars || []) {
      if (isCalSelected(status.prefs, c.id)) out.push({ id: c.id, name: c.summary, color: c.backgroundColor || D.cyan, google: true });
    }
  }
  return out;
}

export function currentOwner(): string {
  try {
    return window.localStorage.getItem("poast-current-user")
      || window.sessionStorage.getItem("poast-current-user") || "shared";
  } catch { return "shared"; }
}

// ─── Default calendar (per owner) ───
// The one calendar new events & dated tasks land on by default. Chosen on first
// connect (forced via the Calendars panel) and changeable from Settings. Stored
// client-side per signed-in user; always falls back to the in-app SA calendar.
const DEFAULT_CAL_KEY = "ms-default-calendar";
export const FALLBACK_CALENDAR_ID = "sa-marketing";
export function getDefaultCalendarId(owner?: string): string | null {
  try { return window.localStorage.getItem(`${DEFAULT_CAL_KEY}:${owner || currentOwner()}`); } catch { return null; }
}
export function resolveDefaultCalendarId(owner?: string): string {
  return getDefaultCalendarId(owner) || FALLBACK_CALENDAR_ID;
}
export function setDefaultCalendarId(owner: string, id: string): void {
  try {
    window.localStorage.setItem(`${DEFAULT_CAL_KEY}:${owner}`, id);
    window.dispatchEvent(new CustomEvent("ms-default-calendar-changed", { detail: { owner, id } }));
  } catch { /* ignore */ }
}
// True once the user has explicitly picked a default for this owner.
export function hasDefaultCalendar(owner?: string): boolean {
  return !!getDefaultCalendarId(owner);
}

export function useGoogle() {
  const [status, setStatus] = useState<GoogleStatus>({ configured: false, connected: false });
  const [loading, setLoading] = useState(true);
  const [owner, setOwner] = useState("shared");

  const reload = useCallback(async (o?: string) => {
    const who = o || owner;
    setLoading(true);
    try {
      const res = await fetch(`/api/google/status?owner=${encodeURIComponent(who)}`);
      const j = await res.json();
      setStatus(j);
    } catch {
      setStatus({ configured: false, connected: false });
    } finally { setLoading(false); }
  }, [owner]);

  useEffect(() => {
    const o = currentOwner();
    setOwner(o);
    reload(o);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const connect = useCallback(() => {
    window.location.href = `/api/google/auth?owner=${encodeURIComponent(owner)}`;
  }, [owner]);

  const disconnect = useCallback(async () => {
    await fetch("/api/google/disconnect", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ owner }) });
    reload(owner);
  }, [owner, reload]);

  const syncCalendar = useCallback(async (calendarId: string) => {
    const res = await fetch("/api/google/sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ owner, calendarId }) });
    return res.json();
  }, [owner]);

  // Select / deselect one calendar. Optimistically flips status.prefs so the
  // checkbox responds instantly; the server persists the choice and applies it
  // live (on → pulls the calendar, off → purges its events).
  const setCalendarSelected = useCallback(async (calendarId: string, on: boolean) => {
    setStatus((s) => ({ ...s, prefs: { ...s.prefs, selected: { ...s.prefs?.selected, [calendarId]: on } } }));
    try {
      const res = await fetch("/api/google/sync", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ owner, setCalendar: { id: calendarId, on } }),
      });
      return await res.json();
    } catch (e) {
      reload(owner); // re-sync from the server if the write failed
      return { ok: false, error: String(e) };
    }
  }, [owner, reload]);

  // Push+pull every selected calendar at once (and purge de-selected ones).
  const syncSelected = useCallback(async () => {
    const res = await fetch("/api/google/sync", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ owner, syncSelected: true }),
    });
    return res.json();
  }, [owner]);

  // Show / hide Google personal status events (working location / OOO / focus).
  // Optimistically flips the pref so the toggle responds instantly; the server
  // persists it and applies live (on → pull+tag, off → purge every mirror row).
  const setShowStatusEvents = useCallback(async (on: boolean) => {
    setStatus((s) => ({ ...s, prefs: { ...s.prefs, showStatusEvents: on } }));
    try {
      const res = await fetch("/api/google/sync", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ owner, setShowStatus: on }),
      });
      return await res.json();
    } catch (e) {
      reload(owner);
      return { ok: false, error: String(e) };
    }
  }, [owner, reload]);

  const isSelected = useCallback((calId: string) => isCalSelected(status.prefs, calId), [status.prefs]);
  const showStatusEvents = status.prefs?.showStatusEvents === true;

  return { status, loading, owner, reload, connect, disconnect, syncCalendar, setCalendarSelected, syncSelected, setShowStatusEvents, showStatusEvents, isSelected };
}
