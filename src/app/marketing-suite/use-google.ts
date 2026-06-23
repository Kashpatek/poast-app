"use client";
// Client hook for Google Calendar connection state (per signed-in user).
import { useCallback, useEffect, useState } from "react";

export interface GoogleCalendarInfo { id: string; summary: string; primary?: boolean; backgroundColor?: string; }
export interface GoogleStatus {
  configured: boolean;
  connected: boolean;
  email?: string;
  calendars?: GoogleCalendarInfo[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  prefs?: Record<string, any>;
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

  return { status, loading, owner, reload, connect, disconnect, syncCalendar };
}
