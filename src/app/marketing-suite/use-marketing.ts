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
import {
  makeDemoData, episodeTitles, projectEventTitle, stageOf, BUILD_STAGES, FOLLOWUP_STAGES,
  type MarketingEvent, type Campaign, type SeriesDef,
} from "./marketing-constants";

// A building-block Project seeds these (topic→film→edit, undated); finalizing a
// premiere re-dates them and adds the follow-ups (release, clips).
export interface ProjectInput { title: string; episodeNo?: number; guests?: string[]; baseTitle?: string }

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
  updateCampaign: (id: string, patch: Partial<Campaign>) => void;
  removeCampaign: (id: string) => void;
  addSeries: (campaignId: string, s: SeriesDef) => MarketingEvent[];
  addProject: (campaignId: string, opts: ProjectInput) => MarketingEvent[];
  finalizeRollout: (groupId: string, premiereISO: string) => void;
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

  const updateCampaign = useCallback((id: string, patch: Partial<Campaign>) => {
    setCampaigns((prev) => prev.map((c) => {
      if (c.id !== id) return c;
      const nc = { ...c, ...patch };
      void saveCampaign(nc);
      return nc;
    }));
  }, [saveCampaign]);

  const removeCampaign = useCallback((id: string) => {
    // Cascade: drop the campaign AND its events (rollouts/items live as events
    // tagged campaignId). Best-effort server deletes in live mode only.
    const removedEventIds = events.filter((e) => e.campaignId === id).map((e) => e.id);
    setCampaigns((prev) => prev.filter((c) => c.id !== id));
    setEvents((prev) => prev.filter((e) => e.campaignId !== id));
    if (modeRef.current !== "live") return;
    const del = (body: object) => {
      try { fetch("/api/marketing", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); } catch { /* best-effort */ }
    };
    del({ kind: "campaign", owner: ownerRef.current, id });
    removedEventIds.forEach((eid) => del({ kind: "event", owner: ownerRef.current, id: eid }));
  }, [events]);

  // Project a Series into Rollouts. A "podcast" series fans each release into
  // its full lifecycle (topic→film→edit→release→clips, lead-up dated off the
  // release); a simple series keeps one release event per occurrence. Ids are
  // DETERMINISTIC (`<series>-r<n>[-<stage>]`) so re-projecting REPLACES in place
  // (no duplicates) and cleans up events from a prior, larger projection.
  const addSeries = useCallback((campaignId: string, s: SeriesDef): MarketingEvent[] => {
    const count = Math.min(s.count, 52);
    const stages = s.kind === "podcast" && s.stages?.length ? s.stages : null;
    const titles = episodeTitles(s.baseTitle || s.name, s.guests || []);
    const gen: MarketingEvent[] = [];
    for (let i = 0; i < count; i++) {
      const episodeNo = i + 1;
      const release = new Date(s.firstRelease);
      release.setDate(release.getDate() + i * s.frequencyDays);
      const releaseISO = release.toISOString();
      const rolloutId = `${s.id}-r${episodeNo}`;
      if (stages) {
        for (const st of stages) {
          const d = new Date(release);
          d.setDate(d.getDate() + st.offsetDays);
          const end = st.durationMins ? new Date(d.getTime() + st.durationMins * 60_000).toISOString() : null;
          const onAir = st.key === "release" || st.key === "clips";
          gen.push({
            id: `${rolloutId}-${st.key}`,
            title: `${st.label}: ${s.baseTitle || s.name} #${episodeNo}`,
            type: st.type, status: st.status,
            start: d.toISOString(), end,
            campaignId, channel: onAir ? (s.channel ?? null) : null,
            source: "manual", notes: null,
            payload: { series: s.id, rollout: rolloutId, stage: st.key, episodeNo, release: releaseISO, scheduleKind: st.scheduleKind, titles },
          });
        }
      } else {
        gen.push({
          id: rolloutId, title: `${s.name} #${episodeNo}`, type: "buffer", status: "idea",
          start: releaseISO, end: null, campaignId, channel: s.channel ?? null,
          source: "manual", notes: null,
          payload: { series: s.id, rollout: rolloutId, episodeNo, release: releaseISO },
        });
      }
    }
    const genIds = new Set(gen.map((e) => e.id));
    const isStale = (e: MarketingEvent) =>
      e.campaignId === campaignId &&
      (e.payload as { series?: string } | undefined)?.series === s.id &&
      !genIds.has(e.id);
    const staleIds = events.filter(isStale).map((e) => e.id);
    setEvents((prev) => {
      const byId = new Map(prev.filter((e) => !isStale(e)).map((e) => [e.id, e] as const));
      gen.forEach((e) => byId.set(e.id, e));
      return Array.from(byId.values());
    });
    // Persist the campaign's series[] (replace-in-place by id) — addSeries used
    // to skip this, so the campaign row drifted from its generated events.
    const existing = campaigns.find((c) => c.id === campaignId);
    const nextSeries = existing
      ? (existing.series.some((x) => x.id === s.id)
          ? existing.series.map((x) => (x.id === s.id ? s : x))
          : [...existing.series, s])
      : [s];
    if (existing) void saveCampaign({ ...existing, series: nextSeries });
    setCampaigns((prev) => prev.map((c) => (c.id === campaignId ? { ...c, series: nextSeries } : c)));
    gen.forEach((e) => void saveEvent(e));
    if (modeRef.current === "live" && staleIds.length) {
      staleIds.forEach((id) => {
        try { fetch("/api/marketing", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: "event", owner: ownerRef.current, id }) }); } catch { /* best-effort */ }
      });
    }
    return gen;
  }, [events, campaigns, saveEvent, saveCampaign]);

  // Create a building-block Project: seeds the build steps (topic → film →
  // edit) UNDATED (payload.unscheduled) under one rollout group id, phase
  // "project". Titled "name: step" via the canonical naming agent. No premiere
  // yet — finalizeRollout locks one later.
  const addProject = useCallback((campaignId: string, opts: ProjectInput): MarketingEvent[] => {
    const name = (opts.title || "Untitled project").trim();
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 32) || "project";
    const groupId = `${campaignId}-proj-${slug}-${Math.random().toString(36).slice(2, 6)}`;
    const titles = episodeTitles(opts.baseTitle || name, opts.guests || []);
    const nowISO = new Date().toISOString();
    const gen: MarketingEvent[] = BUILD_STAGES.map((st) => ({
      id: `${groupId}-${st.key}`,
      title: projectEventTitle(name, st.label),
      type: st.type, status: st.status,
      start: nowISO, end: null,
      campaignId, channel: null, source: "poast", notes: null,
      payload: { rollout: groupId, phase: "project", stage: st.key, episodeNo: opts.episodeNo ?? null, projectName: name, titles, scheduleKind: st.scheduleKind, unscheduled: true },
    }));
    setEvents((prev) => [...prev, ...gen]);
    gen.forEach((e) => void saveEvent(e));
    return gen;
  }, [saveEvent]);

  // Promote a Project → Rollout: lock the finalized premiere, re-date the build
  // steps as lead-up to it, and mint the follow-ups (release, clips) that didn't
  // exist yet. Everything stays titled "name: detail". Idempotent on stage ids.
  const finalizeRollout = useCallback((groupId: string, premiereISO: string) => {
    const premiere = new Date(premiereISO);
    if (isNaN(premiere.getTime())) return;
    const created: MarketingEvent[] = [];
    setEvents((prev) => {
      const group = prev.filter((e) => (e.payload as { rollout?: string } | undefined)?.rollout === groupId);
      if (!group.length) return prev;
      const pget = <T,>(k: string): T | undefined => {
        const hit = group.find((e) => (e.payload as Record<string, unknown> | undefined)?.[k] != null);
        return hit ? ((hit.payload as Record<string, unknown>)[k] as T) : undefined;
      };
      const name = pget<string>("projectName") || group[0].title.split(":")[0].trim();
      const episodeNo = pget<number>("episodeNo") ?? null;
      const titles = pget<unknown>("titles");
      const existingStages = new Set(
        group.map((e) => (e.payload as { stage?: string } | undefined)?.stage).filter(Boolean) as string[],
      );
      // 1) Promote + re-date the group's existing events.
      const updated = prev.map((e) => {
        if ((e.payload as { rollout?: string } | undefined)?.rollout !== groupId) return e;
        const stageKey = (e.payload as { stage?: string } | undefined)?.stage;
        const st = stageKey ? stageOf(stageKey) : undefined;
        let start = e.start; let end = e.end ?? null;
        if (st) {
          const d = new Date(premiere); d.setDate(d.getDate() + st.offsetDays);
          start = d.toISOString();
          end = st.durationMins ? new Date(d.getTime() + st.durationMins * 60_000).toISOString() : null;
        }
        const ne: MarketingEvent = { ...e, start, end, payload: { ...(e.payload || {}), phase: "rollout", release: premiereISO, unscheduled: false } };
        void saveEvent(ne);
        return ne;
      });
      // 2) Mint any missing follow-ups (release, clips).
      FOLLOWUP_STAGES.forEach((st) => {
        if (existingStages.has(st.key)) return;
        const d = new Date(premiere); d.setDate(d.getDate() + st.offsetDays);
        const ev: MarketingEvent = {
          id: `${groupId}-${st.key}`,
          title: projectEventTitle(name, st.label),
          type: st.type, status: st.status,
          start: d.toISOString(),
          end: st.durationMins ? new Date(d.getTime() + st.durationMins * 60_000).toISOString() : null,
          campaignId: group[0].campaignId ?? null, channel: null, source: "manual", notes: null,
          payload: { rollout: groupId, phase: "rollout", stage: st.key, episodeNo, projectName: name, titles, release: premiereISO, scheduleKind: st.scheduleKind },
        };
        void saveEvent(ev);
        created.push(ev);
      });
      return [...updated, ...created];
    });
  }, [saveEvent]);

  return {
    events, campaigns, loading, offline, source, mode, owner, setMode,
    addEvent, updateEvent, moveEvent, removeEvent, addCampaign, updateCampaign, removeCampaign, addSeries,
    addProject, finalizeRollout,
    refresh: () => load(ownerRef.current, modeRef.current),
  };
}
