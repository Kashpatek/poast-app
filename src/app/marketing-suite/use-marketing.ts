"use client";
// MarketingSUITE data hook.
//
// Two explicit modes the user flips from the top bar:
//   • DEMO — an in-memory sample dataset (a safe sandbox; never persisted, so
//     edits here never touch the database). Great for exploring the suite.
//   • LIVE — the signed-in user's real data from /api/marketing, scoped by
//     owner so each teammate gets their own events/campaigns. Resilient: on an
//     outage it falls back to the last cache, then to demo, and flags offline.
//
// Per-user: the owner is the signed-in POAST name (localStorage/sessionStorage
// "poast-current-user"); GET/POST/DELETE all carry it so data never crosses
// users. The shared task board (Board view) is intentionally NOT scoped here —
// it remains Akash's master board, embedded as-is.
import { useCallback, useEffect, useRef, useState } from "react";
import { makeDemoData, type MarketingEvent, type Campaign, type SeriesDef } from "./marketing-constants";

const CACHE_KEY = "marketing-suite-cache-v1";
const MODE_KEY = "marketing-suite-mode";
function uid(p: string) { return p + "-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 7); }

export type DataMode = "demo" | "live";

// Signed-in POAST identity — drives per-user scoping. Falls back to "shared".
function currentOwner(): string {
  try {
    return (
      window.localStorage.getItem("poast-current-user") ||
      window.sessionStorage.getItem("poast-current-user") ||
      "shared"
    );
  } catch { return "shared"; }
}
function cacheKey(owner: string) { return `${CACHE_KEY}::${owner}`; }
function modeKey(owner: string) { return `${MODE_KEY}::${owner}`; }

export interface MarketingState {
  events: MarketingEvent[];
  campaigns: Campaign[];
  loading: boolean;
  offline: boolean;
  source: "server" | "cache" | "demo";
  mode: DataMode;
  owner: string;
  setMode: (m: DataMode) => void;
  addEvent: (e: Partial<MarketingEvent>) => MarketingEvent;
  updateEvent: (id: string, patch: Partial<MarketingEvent>) => void;
  moveEvent: (id: string, newStartISO: string) => void;
  removeEvent: (id: string) => void;
  addCampaign: (c: Partial<Campaign>) => Campaign;
  addSeries: (campaignId: string, s: SeriesDef) => MarketingEvent[];
  refresh: () => void;
}

export interface ViewProps {
  m: MarketingState;
  // optional focusId lets one view deep-link into another (e.g. Campaigns
  // "new ad" → Ad Kiosk with that ad preselected).
  onOpenView?: (v: string, focusId?: string) => void;
  focusId?: string;
}

export function useMarketing(): MarketingState {
  const [events, setEvents] = useState<MarketingEvent[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const [source, setSource] = useState<"server" | "cache" | "demo">("demo");
  const [owner, setOwner] = useState<string>("shared");
  const [mode, setModeState] = useState<DataMode>("demo");

  // Refs so persistence callbacks always read the latest mode/owner.
  const modeRef = useRef<DataMode>("demo");
  const ownerRef = useRef<string>("shared");
  modeRef.current = mode;
  ownerRef.current = owner;

  // Resolve identity + stored mode preference once on mount.
  useEffect(() => {
    const o = currentOwner();
    setOwner(o);
    let pref: DataMode = "demo";
    try { const s = window.localStorage.getItem(modeKey(o)); if (s === "live" || s === "demo") pref = s; } catch { /* ignore */ }
    setModeState(pref);
  }, []);

  const load = useCallback(async (o: string, md: DataMode) => {
    setLoading(true);
    if (md === "demo") {
      const demo = makeDemoData();
      setEvents(demo.events); setCampaigns(demo.campaigns);
      setSource("demo"); setOffline(false); setLoading(false);
      return;
    }
    try {
      const res = await fetch(`/api/marketing?owner=${encodeURIComponent(o)}`);
      const j = await res.json();
      if (res.ok && Array.isArray(j.events)) {
        // Live = exactly what's stored for this user (empty is a valid state).
        setEvents(j.events); setCampaigns(j.campaigns || []);
        setSource("server"); setOffline(false);
      } else {
        throw new Error(j.error || "load failed");
      }
    } catch {
      let used = false;
      try {
        const raw = localStorage.getItem(cacheKey(o));
        if (raw) { const c = JSON.parse(raw); setEvents(c.events || []); setCampaigns(c.campaigns || []); setSource("cache"); used = true; }
      } catch { /* ignore */ }
      if (!used) { const demo = makeDemoData(); setEvents(demo.events); setCampaigns(demo.campaigns); setSource("demo"); }
      setOffline(true);
    } finally {
      setLoading(false);
    }
  }, []);

  // (Re)load whenever owner or mode changes.
  useEffect(() => { load(owner, mode); }, [load, owner, mode]);

  const setMode = useCallback((m: DataMode) => {
    setModeState(m);
    try { window.localStorage.setItem(modeKey(ownerRef.current), m); } catch { /* ignore */ }
  }, []);

  // Mirror live data to a per-user cache (so edits survive an outage). Demo is
  // never mirrored — it must not overwrite the user's real cached data.
  useEffect(() => {
    if (loading || mode !== "live") return;
    try { localStorage.setItem(cacheKey(ownerRef.current), JSON.stringify({ events, campaigns })); } catch { /* ignore */ }
  }, [events, campaigns, loading, mode]);

  // Persistence is gated on LIVE mode — demo edits stay local (sandbox).
  const saveEvent = useCallback(async (e: MarketingEvent) => {
    if (modeRef.current !== "live") return;
    try { await fetch("/api/marketing", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: "event", owner: ownerRef.current, data: e }) }); } catch { /* best-effort */ }
  }, []);
  const saveCampaign = useCallback(async (c: Campaign) => {
    if (modeRef.current !== "live") return;
    try { await fetch("/api/marketing", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: "campaign", owner: ownerRef.current, data: c }) }); } catch { /* best-effort */ }
  }, []);

  const addEvent = useCallback((partial: Partial<MarketingEvent>): MarketingEvent => {
    const e: MarketingEvent = {
      id: partial.id || uid("e"),
      title: partial.title || "Untitled",
      type: partial.type || "manual",
      status: partial.status || "idea",
      start: partial.start || new Date().toISOString(),
      end: partial.end ?? null,
      campaignId: partial.campaignId ?? null,
      channel: partial.channel ?? null,
      source: partial.source || "manual",
      notes: partial.notes ?? null,
      payload: partial.payload || {},
    };
    setEvents((prev) => [...prev, e]);
    void saveEvent(e);
    return e;
  }, [saveEvent]);

  const updateEvent = useCallback((id: string, patch: Partial<MarketingEvent>) => {
    setEvents((prev) => prev.map((e) => {
      if (e.id !== id) return e;
      const ne = { ...e, ...patch };
      void saveEvent(ne);
      return ne;
    }));
  }, [saveEvent]);

  const moveEvent = useCallback((id: string, newStartISO: string) => {
    setEvents((prev) => prev.map((e) => {
      if (e.id !== id) return e;
      let end = e.end;
      if (e.end) {
        const dur = new Date(e.end).getTime() - new Date(e.start).getTime();
        end = new Date(new Date(newStartISO).getTime() + dur).toISOString();
      }
      const ne = { ...e, start: newStartISO, end };
      void saveEvent(ne);
      return ne;
    }));
  }, [saveEvent]);

  const removeEvent = useCallback((id: string) => {
    setEvents((prev) => prev.filter((e) => e.id !== id));
    if (modeRef.current !== "live") return;
    try { fetch("/api/marketing", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: "event", owner: ownerRef.current, id }) }); } catch { /* best-effort */ }
  }, []);

  const addCampaign = useCallback((partial: Partial<Campaign>): Campaign => {
    const c: Campaign = {
      id: partial.id || uid("camp"),
      name: partial.name || "New campaign",
      color: partial.color || "#905CCB",
      status: partial.status || "planning",
      goal: partial.goal ?? null,
      start: partial.start ?? null,
      end: partial.end ?? null,
      series: partial.series || [],
      payload: partial.payload || {},
    };
    setCampaigns((prev) => [c, ...prev]);
    void saveCampaign(c);
    return c;
  }, [saveCampaign]);

  const addSeries = useCallback((campaignId: string, s: SeriesDef): MarketingEvent[] => {
    const gen: MarketingEvent[] = [];
    for (let i = 0; i < Math.min(s.count, 52); i++) {
      const d = new Date(s.firstRelease);
      d.setDate(d.getDate() + i * s.frequencyDays);
      gen.push({
        id: uid("e"), title: s.name + " #" + (i + 1), type: "buffer", status: "idea",
        start: d.toISOString(), end: null, campaignId, channel: s.channel ?? null,
        source: "manual", notes: null, payload: { series: s.id },
      });
    }
    setEvents((prev) => [...prev, ...gen]);
    setCampaigns((prev) => prev.map((c) => c.id === campaignId ? { ...c, series: [...c.series, s] } : c));
    gen.forEach((e) => void saveEvent(e));
    return gen;
  }, [saveEvent]);

  return {
    events, campaigns, loading, offline, source, mode, owner, setMode,
    addEvent, updateEvent, moveEvent, removeEvent, addCampaign, addSeries,
    refresh: () => load(ownerRef.current, modeRef.current),
  };
}
