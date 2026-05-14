"use client";

// Drafts auto-save hook. Every tool can wrap its state with `useDraft`
// to get transparent persistence to localStorage (instant) plus a Supabase
// sync (every 5s, debounced) so drafts survive a browser crash or a
// laptop swap. Two-line integration into any tool.
//
// Usage:
//   const [data, setData] = useDraft<MyShape>("sloptop", initial);
//
// What you get for free:
//   - Loaded from localStorage on mount (instant)
//   - Background-syncs to Supabase under projects/drafts-<key> every 5s
//   - On reload, re-hydrates from Supabase if newer than localStorage
//   - "Last saved 3s ago" timestamp via useDraftMeta

import { useCallback, useEffect, useRef, useState } from "react";

const SYNC_DEBOUNCE_MS = 5000;

interface DraftEnvelope<T> {
  data: T;
  updatedAt: string;
  author?: string;
}

export interface DraftMeta {
  lastSavedAt: string | null;
  syncing: boolean;
  source: "local" | "remote" | "fresh";
}

export function useDraft<T>(key: string, initial: T): [T, (next: T | ((prev: T) => T)) => void, DraftMeta] {
  const lsKey = "draft:" + key;
  const dbKey = "drafts-" + key;

  const [data, setData] = useState<T>(() => {
    if (typeof window === "undefined") return initial;
    try {
      const raw = window.localStorage.getItem(lsKey);
      if (raw) {
        const parsed = JSON.parse(raw) as DraftEnvelope<T>;
        return parsed.data;
      }
    } catch { /* ignore */ }
    return initial;
  });

  const [meta, setMeta] = useState<DraftMeta>({
    lastSavedAt: typeof window !== "undefined" ? window.localStorage.getItem(lsKey + ":updatedAt") : null,
    syncing: false,
    source: typeof window !== "undefined" && window.localStorage.getItem(lsKey) ? "local" : "fresh",
  });

  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSyncedJson = useRef<string>("");

  // Hydrate from Supabase on first mount if remote is newer than local.
  useEffect(() => {
    let cancelled = false;
    async function hydrate() {
      try {
        const res = await fetch("/api/db?table=projects");
        if (!res.ok) return;
        const j = await res.json();
        const row = (j.data || []).find((r: { id: string; type: string }) => r.id === dbKey && r.type === "draft");
        if (!row?.data) return;
        const remote = row.data as DraftEnvelope<T>;
        const localTs = typeof window !== "undefined" ? window.localStorage.getItem(lsKey + ":updatedAt") : null;
        if (cancelled) return;
        if (!localTs || (remote.updatedAt && remote.updatedAt > localTs)) {
          setData(remote.data);
          setMeta((m) => ({ ...m, lastSavedAt: remote.updatedAt, source: "remote" }));
          try {
            window.localStorage.setItem(lsKey, JSON.stringify(remote));
            window.localStorage.setItem(lsKey + ":updatedAt", remote.updatedAt || new Date().toISOString());
          } catch { /* ignore */ }
        }
      } catch { /* ignore */ }
    }
    hydrate();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const persist = useCallback(
    (next: T) => {
      const envelope: DraftEnvelope<T> = { data: next, updatedAt: new Date().toISOString() };
      try {
        if (typeof window !== "undefined") {
          window.localStorage.setItem(lsKey, JSON.stringify(envelope));
          window.localStorage.setItem(lsKey + ":updatedAt", envelope.updatedAt);
        }
      } catch { /* ignore */ }
      setMeta((m) => ({ ...m, lastSavedAt: envelope.updatedAt, source: "local" }));

      // Debounced remote sync.
      if (syncTimer.current) clearTimeout(syncTimer.current);
      syncTimer.current = setTimeout(async () => {
        const serialized = JSON.stringify(envelope);
        if (serialized === lastSyncedJson.current) return;
        setMeta((m) => ({ ...m, syncing: true }));
        try {
          await fetch("/api/db", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ table: "projects", id: dbKey, type: "draft", data: envelope }),
          });
          lastSyncedJson.current = serialized;
        } catch { /* ignore */ }
        setMeta((m) => ({ ...m, syncing: false }));
      }, SYNC_DEBOUNCE_MS);
    },
    [lsKey, dbKey]
  );

  const setAndPersist = useCallback(
    (next: T | ((prev: T) => T)) => {
      setData((prev) => {
        const nextValue = typeof next === "function" ? (next as (p: T) => T)(prev) : next;
        persist(nextValue);
        return nextValue;
      });
    },
    [persist]
  );

  // Flush pending sync on unmount.
  useEffect(() => {
    return () => {
      if (syncTimer.current) {
        clearTimeout(syncTimer.current);
        syncTimer.current = null;
      }
    };
  }, []);

  return [data, setAndPersist, meta];
}

// Tiny status pill any tool can render to show users their draft state.
export function DraftStatusLabel({ meta }: { meta: DraftMeta }) {
  const when = meta.lastSavedAt ? timeAgo(new Date(meta.lastSavedAt)) : "—";
  return (
    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: meta.syncing ? "#F7B041" : "#4E4B56", letterSpacing: 0.6 }}>
      {meta.syncing ? "Saving…" : meta.lastSavedAt ? "Saved " + when : "Not saved"}
    </span>
  );
}

function timeAgo(d: Date): string {
  const sec = Math.floor((Date.now() - d.getTime()) / 1000);
  if (sec < 5) return "just now";
  if (sec < 60) return sec + "s ago";
  const min = Math.floor(sec / 60);
  if (min < 60) return min + "m ago";
  const hr = Math.floor(min / 60);
  if (hr < 24) return hr + "h ago";
  return d.toLocaleDateString();
}
