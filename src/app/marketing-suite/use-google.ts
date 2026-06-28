"use client";
// Client hook for Google Calendar connection state (per signed-in user).
import { useCallback, useEffect, useState } from "react";

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

export function currentOwner(): string {
  try {
    return window.localStorage.getItem("poast-current-user")
      || window.sessionStorage.getItem("poast-current-user") || "shared";
  } catch { return "shared"; }
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

  const isSelected = useCallback((calId: string) => isCalSelected(status.prefs, calId), [status.prefs]);

  return { status, loading, owner, reload, connect, disconnect, syncCalendar, setCalendarSelected, syncSelected, isSelected };
}
