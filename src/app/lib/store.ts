// POAST 4.0 · global Zustand store.
//
// Three slices that unlock cross-tool routing + the multi-API spread:
//
// 1. Provider slice — thin reactive layer over the existing
//    localStorage-backed `getPreferredProvider` / `getSurfaceProvider`
//    helpers in shared-constants.ts. Reads sync from localStorage on
//    mount; updates fire a tick so React components subscribed via
//    `useStore` re-render when ProviderChips changes the value.
//
// 2. Output bus — every tool that generates output (captions, ideas,
//    headlines, briefs, etc.) calls `pushOutput()` so other tools can
//    consume it. "Send to Capper" / "Send to Approval Queue" buttons
//    read from this. Capped at 50 entries so we don't bloat memory.
//
// 3. Routing payload — one-shot handoff for cross-suite jumps. Source
//    tool calls `setPendingRoute({ destinationTool, payload })`, the
//    sidebar navigates, destination tool's mount effect calls
//    `consumePendingRoute(toolId)` to receive and clear.
//
// localStorage keys remain the source of truth for provider
// preferences — the store is just a reactive cache. Other persisted
// state (output bus, routing payload) is in-memory only because it's
// inherently session-scoped.

"use client";

import { create } from "zustand";
import type { LLMProviderName } from "../shared-constants";

// ─── Types ────────────────────────────────────────────────────────────

export type ProviderOrAuto = LLMProviderName | "auto";

export interface ToolOutput {
  id: string;                 // local-id-<ts>-<rand>
  ts: number;                 // Date.now() when pushed
  sourceTool: string;         // "capper", "slop-top", "sa-weekly", ...
  kind: "caption" | "thread" | "headline" | "idea" | "brief" | "image" | "other";
  payload: unknown;           // tool-defined shape
  preview?: string;           // 1-line human label for chip rendering
  provider?: LLMProviderName; // which LLM produced it (when applicable)
}

export interface RoutingPayload {
  destinationTool: string;    // sidebar id of the tool that should receive
  sourceTool: string;         // who sent it (for telemetry + back-button hint)
  payload: unknown;           // free-form; destination tool knows the shape
  kind?: ToolOutput["kind"];
  ts: number;
}

// ─── Store shape ─────────────────────────────────────────────────────

interface PoastStore {
  // PROVIDER SLICE
  globalProvider: LLMProviderName;
  surfaceProviders: Record<string, ProviderOrAuto>;
  // Bump-on-change tick — components subscribed to this re-render when
  // any provider state shifts (used inside resolve callers that want
  // to re-evaluate per render).
  providerTick: number;
  refreshProviderFromStorage: () => void;
  setGlobalProvider: (p: LLMProviderName) => void;
  setSurfaceProvider: (surface: string, p: ProviderOrAuto) => void;

  // OUTPUT BUS SLICE
  outputs: ToolOutput[];
  pushOutput: (out: Omit<ToolOutput, "id" | "ts"> & { id?: string; ts?: number }) => ToolOutput;
  consumeOutputs: (sourceTool?: string) => ToolOutput[];
  clearOutputs: () => void;

  // ROUTING PAYLOAD SLICE
  pendingRoute: RoutingPayload | null;
  setPendingRoute: (route: Omit<RoutingPayload, "ts"> & { ts?: number }) => void;
  consumePendingRoute: (destinationTool: string) => RoutingPayload | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────

const OUTPUT_CAP = 50;

function readGlobalProviderSync(): LLMProviderName {
  if (typeof window === "undefined") return "claude";
  try {
    const v = window.localStorage.getItem("poast-llm-provider");
    return v === "gemini" || v === "grok" ? v : "claude";
  } catch { return "claude"; }
}

function readSurfaceProvidersSync(): Record<string, ProviderOrAuto> {
  if (typeof window === "undefined") return {};
  const out: Record<string, ProviderOrAuto> = {};
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (!k || !k.startsWith("poast-llm-provider:")) continue;
      const surface = k.slice("poast-llm-provider:".length);
      const v = window.localStorage.getItem(k);
      if (v === "claude" || v === "gemini" || v === "grok") {
        out[surface] = v;
      }
    }
  } catch { /* localStorage disabled / quota */ }
  return out;
}

function makeId(prefix: string): string {
  return prefix + "-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
}

// ─── Store ───────────────────────────────────────────────────────────

export const useStore = create<PoastStore>((set, get) => ({
  // Provider slice
  globalProvider: readGlobalProviderSync(),
  surfaceProviders: readSurfaceProvidersSync(),
  providerTick: 0,
  refreshProviderFromStorage: () => {
    set({
      globalProvider: readGlobalProviderSync(),
      surfaceProviders: readSurfaceProvidersSync(),
      providerTick: get().providerTick + 1,
    });
  },
  setGlobalProvider: (p) => {
    if (typeof window !== "undefined") {
      try { window.localStorage.setItem("poast-llm-provider", p); } catch { /* full disk */ }
    }
    set({ globalProvider: p, providerTick: get().providerTick + 1 });
  },
  setSurfaceProvider: (surface, p) => {
    if (typeof window !== "undefined") {
      const key = "poast-llm-provider:" + surface;
      try {
        if (p === "auto") window.localStorage.removeItem(key);
        else window.localStorage.setItem(key, p);
      } catch { /* full disk */ }
    }
    const next = { ...get().surfaceProviders };
    if (p === "auto") delete next[surface];
    else next[surface] = p;
    set({ surfaceProviders: next, providerTick: get().providerTick + 1 });
  },

  // Output bus slice
  outputs: [],
  pushOutput: (out) => {
    const full: ToolOutput = {
      id: out.id || makeId("out"),
      ts: out.ts || Date.now(),
      sourceTool: out.sourceTool,
      kind: out.kind,
      payload: out.payload,
      preview: out.preview,
      provider: out.provider,
    };
    set((s) => ({ outputs: [full, ...s.outputs].slice(0, OUTPUT_CAP) }));
    return full;
  },
  consumeOutputs: (sourceTool) => {
    const all = get().outputs;
    return sourceTool ? all.filter((o) => o.sourceTool === sourceTool) : all;
  },
  clearOutputs: () => set({ outputs: [] }),

  // Routing payload slice
  pendingRoute: null,
  setPendingRoute: (route) => set({
    pendingRoute: {
      destinationTool: route.destinationTool,
      sourceTool: route.sourceTool,
      payload: route.payload,
      kind: route.kind,
      ts: route.ts || Date.now(),
    },
  }),
  consumePendingRoute: (destinationTool) => {
    const r = get().pendingRoute;
    if (!r || r.destinationTool !== destinationTool) return null;
    set({ pendingRoute: null });
    return r;
  },
}));

// Cross-tab sync — when localStorage changes in another tab (e.g. user
// changes provider on AI Training page in tab A while Capper is open
// in tab B), the storage event fires in tab B and refreshes the cache.
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === "poast-llm-provider" || (e.key && e.key.startsWith("poast-llm-provider:"))) {
      useStore.getState().refreshProviderFromStorage();
    }
  });
}

// ─── Selector helpers ────────────────────────────────────────────────
// Sugar for the common subscription pattern: "give me the effective
// provider for this surface, re-rendering on any change."
export function useEffectiveProvider(surface?: string): LLMProviderName {
  // Subscribe to providerTick so any change wakes the consumer.
  const tick = useStore((s) => s.providerTick);
  void tick;
  const global = useStore((s) => s.globalProvider);
  const surfaceOverride = useStore((s) => (surface ? s.surfaceProviders[surface] : undefined));
  if (surfaceOverride && surfaceOverride !== "auto") return surfaceOverride as LLMProviderName;
  return global;
}
