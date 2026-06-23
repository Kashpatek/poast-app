"use client";
// MarketingSUITE data hook. Server-first, but resilient: if /api/marketing is
// unreachable (egress 402, tables not migrated yet, network), it falls back to
// the last localStorage cache, then to the demo dataset — so the suite always
// renders. Mutations are optimistic + best-effort persisted; the cache mirror
// keeps edits across refreshes during an outage.
import { useCallback, useEffect, useRef, useState } from "react";
import { makeDemoData, type MarketingEvent, type Campaign, type SeriesDef } from "./marketing-constants";

const CACHE_KEY = "marketing-suite-cache-v1";
function uid(p: string) { return p + "-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 7); }

export interface MarketingState {
  events: MarketingEvent[];
  campaigns: Campaign[];
  loading: boolean;
  offline: boolean;
  source: "server" | "cache" | "demo";
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

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/marketing");
      const j = await res.json();
      if (res.ok && Array.isArray(j.events)) {
        if (j.events.length === 0 && (!j.campaigns || j.campaigns.length === 0)) {
          // Reachable but empty (fresh table) → seed demo so it's reviewable.
          const demo = makeDemoData();
          setEvents(demo.events); setCampaigns(demo.campaigns); setSource("demo");
        } else {
          setEvents(j.events); setCampaigns(j.campaigns || []); setSource("server");
        }
        setOffline(false);
      } else {
        throw new Error(j.error || "load failed");
      }
    } catch {
      let used = false;
      try {
        const raw = localStorage.getItem(CACHE_KEY);
        if (raw) { const c = JSON.parse(raw); setEvents(c.events || []); setCampaigns(c.campaigns || []); setSource("cache"); used = true; }
      } catch { /* ignore */ }
      if (!used) { const demo = makeDemoData(); setEvents(demo.events); setCampaigns(demo.campaigns); setSource("demo"); }
      setOffline(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Mirror to localStorage whenever data changes (post-hydration).
  useEffect(() => {
    if (loading) return;
    try { localStorage.setItem(CACHE_KEY, JSON.stringify({ events, campaigns })); } catch { /* ignore */ }
  }, [events, campaigns, loading]);

  const saveEvent = useCallback(async (e: MarketingEvent) => {
    try { await fetch("/api/marketing", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: "event", data: e }) }); } catch { /* best-effort */ }
  }, []);
  const saveCampaign = useCallback(async (c: Campaign) => {
    try { await fetch("/api/marketing", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: "campaign", data: c }) }); } catch { /* best-effort */ }
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
    try { fetch("/api/marketing", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: "event", id }) }); } catch { /* best-effort */ }
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

  return { events, campaigns, loading, offline, source, addEvent, updateEvent, moveEvent, removeEvent, addCampaign, addSeries, refresh: load };
}
