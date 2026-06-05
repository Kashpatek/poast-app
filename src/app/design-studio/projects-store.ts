// DesignStudio · unified projects store.
// localForage (IndexedDB) for local persistence plus a fail-quiet sync
// to /api/db (table=projects) so every editor (Fabric canvas, Tiptap doc,
// Excalidraw, motion, programmatic) reads/writes through one surface.

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { DependencyList } from "react";
import localforage from "localforage";
import { uid } from "../shared-constants";

export type ProjectKind = "canvas" | "doc" | "excalidraw" | "motion" | "programmatic";

export interface ProjectRecord {
  id: string;
  title: string;
  kind: ProjectKind;
  category?: string;
  preset?: { width: number; height: number; name?: string };
  pages: Array<{ id: string; thumb?: string; payload: unknown }>;
  templateId?: string;
  meta?: Record<string, unknown>;
  snapshots?: ProjectSnapshot[];
  deletedAt?: number | null;
  createdAt: number;
  updatedAt: number;
}

export interface ProjectSnapshot {
  at: number;
  payload: unknown;
  title: string;
}

const SNAPSHOT_CAP = 12;
const REMOTE_TYPE = "design-project";

let store: LocalForage | null = null;
function db(): LocalForage {
  if (!store) {
    store = localforage.createInstance({ name: "poast-design-studio", storeName: "projects" });
  }
  return store;
}

async function pushRemote(record: ProjectRecord): Promise<void> {
  try {
    await fetch("/api/db", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        table: "projects",
        data: {
          id: record.id,
          name: record.title,
          type: REMOTE_TYPE,
          data: record,
          updated_at: new Date(record.updatedAt).toISOString(),
        },
      }),
    });
  } catch {
    // fail-quiet — local copy is the source of truth
  }
}

export async function listProjects(opts?: { includeDeleted?: boolean }): Promise<ProjectRecord[]> {
  const keys = await db().keys();
  const items: ProjectRecord[] = [];
  for (const key of keys) {
    const r = await db().getItem<ProjectRecord>(key);
    if (r) items.push(r);
  }
  return items
    .filter(p => (opts?.includeDeleted ? true : !p.deletedAt))
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function getProject(id: string): Promise<ProjectRecord | null> {
  return (await db().getItem<ProjectRecord>(id)) || null;
}

export async function saveProject(
  input: Partial<ProjectRecord> & {
    id?: string;
    title: string;
    kind: ProjectKind;
    pages: ProjectRecord["pages"];
  }
): Promise<ProjectRecord> {
  const now = Date.now();
  const id = input.id || uid("proj");
  const existing = input.id ? await getProject(input.id) : null;
  const next: ProjectRecord = {
    id,
    title: input.title,
    kind: input.kind,
    category: input.category ?? existing?.category,
    preset: input.preset ?? existing?.preset,
    pages: input.pages,
    templateId: input.templateId ?? existing?.templateId,
    meta: input.meta ?? existing?.meta,
    snapshots: existing?.snapshots ?? [],
    deletedAt: input.deletedAt ?? existing?.deletedAt ?? null,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };
  await db().setItem(id, next);
  void pushRemote(next);
  return next;
}

export async function snapshotProject(id: string): Promise<ProjectRecord | null> {
  const p = await getProject(id);
  if (!p) return null;
  const snaps = (p.snapshots || []).slice();
  snaps.push({ at: Date.now(), payload: p.pages, title: p.title });
  p.snapshots = snaps.slice(-SNAPSHOT_CAP);
  await db().setItem(p.id, p);
  void pushRemote(p);
  return p;
}

export async function softDeleteProject(id: string): Promise<void> {
  const p = await getProject(id);
  if (!p) return;
  p.deletedAt = Date.now();
  p.updatedAt = Date.now();
  await db().setItem(id, p);
  void pushRemote(p);
}

export async function restoreProject(id: string): Promise<void> {
  const p = await getProject(id);
  if (!p) return;
  p.deletedAt = null;
  p.updatedAt = Date.now();
  await db().setItem(id, p);
  void pushRemote(p);
}

export async function hardDeleteProject(id: string): Promise<void> {
  await db().removeItem(id);
  try {
    await fetch("/api/db", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ table: "projects", id }),
    });
  } catch {
    // fail-quiet
  }
}

export async function hydrateRemote(id: string): Promise<ProjectRecord | null> {
  try {
    const res = await fetch(`/api/db?table=projects&id=${encodeURIComponent(id)}`);
    if (!res.ok) return await getProject(id);
    const json = await res.json();
    const row = json?.data as { data?: ProjectRecord } | undefined;
    const remote = row?.data;
    if (!remote || !remote.updatedAt) return await getProject(id);
    const local = await getProject(id);
    if (!local || remote.updatedAt > local.updatedAt) {
      await db().setItem(id, remote);
      return remote;
    }
    return local;
  } catch {
    return await getProject(id);
  }
}

export type AutosaveStatus = "idle" | "saving" | "saved" | "error";

export function useAutosave(
  callback: () => Promise<void> | void,
  deps: DependencyList,
  delayMs: number = 1200
): { status: AutosaveStatus; lastSavedAt: number | null; saveNow: () => Promise<void> } {
  const [status, setStatus] = useState<AutosaveStatus>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const cbRef = useRef(callback);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const firstRunRef = useRef(true);

  useEffect(() => {
    cbRef.current = callback;
  }, [callback]);

  const flush = useCallback(async () => {
    setStatus("saving");
    try {
      await cbRef.current();
      setLastSavedAt(Date.now());
      setStatus("saved");
    } catch {
      setStatus("error");
    }
  }, []);

  const saveNow = useCallback(async () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    await flush();
  }, [flush]);

  useEffect(() => {
    if (firstRunRef.current) {
      firstRunRef.current = false;
      return;
    }
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      void flush();
    }, delayMs);
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, delayMs, flush]);

  return { status, lastSavedAt, saveNow };
}
