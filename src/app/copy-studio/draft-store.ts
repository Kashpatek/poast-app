// CopySTUDIO · unified draft store.
// localForage (IndexedDB) for client persistence. The Recent Drafts
// strip + every WRITE/SHIP module reads/writes through this single
// surface so versions / autosave / export all stay coherent.

"use client";

import localforage from "localforage";
import { uid } from "../shared-constants";

let store: LocalForage | null = null;
function db(): LocalForage {
  if (!store) {
    store = localforage.createInstance({ name: "poast-copy-studio", storeName: "drafts" });
  }
  return store;
}

// Fail-quiet mirror to /api/drafts so the server has a copy of every draft
// for cross-device pickup. Same pattern as design-studio/projects-store →
// /api/db: local IndexedDB stays the source of truth, the server write is
// best-effort and intentionally not awaited from the public API.
async function pushRemote(record: DraftRecord): Promise<void> {
  try {
    await fetch("/api/drafts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: record.id, name: record.title, body: record }),
    });
  } catch {
    // fail-quiet
  }
}

export type DraftPlatform = "essay" | "thread" | "newsletter" | "carousel" | "pack" | "post" | "seo" | "other";

export interface HeadlineVariant {
  text: string;
  rationale?: string;
  picked?: boolean;
}

export interface VoiceScore {
  score: number;
  topLine?: string;
  capturedAt: number;
}

export interface Snapshot {
  at: number;
  bodyJSON: unknown;
  title: string;
}

export interface DraftRecord {
  id: string;
  title: string;
  platform: DraftPlatform;
  module: string;
  bodyJSON: unknown;
  bodyHTML: string;
  voiceScore?: VoiceScore;
  headlineVariants?: HeadlineVariant[];
  meta?: Record<string, unknown>;
  snapshots?: Snapshot[];
  deletedAt?: number | null;
  createdAt: number;
  updatedAt: number;
}

const SNAPSHOT_CAP = 12;

export async function listDrafts(opts?: { includeDeleted?: boolean }): Promise<DraftRecord[]> {
  const keys = await db().keys();
  const items: DraftRecord[] = [];
  for (const key of keys) {
    const r = await db().getItem<DraftRecord>(key);
    if (r) items.push(r);
  }
  return items
    .filter(d => opts?.includeDeleted ? true : !d.deletedAt)
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function getDraft(id: string): Promise<DraftRecord | null> {
  return (await db().getItem<DraftRecord>(id)) || null;
}

export async function saveDraft(input: Partial<DraftRecord> & { id?: string; title: string; platform: DraftPlatform; module: string }): Promise<DraftRecord> {
  const now = Date.now();
  const id = input.id || uid("draft");
  const existing = input.id ? await getDraft(input.id) : null;
  const next: DraftRecord = {
    id,
    title: input.title,
    platform: input.platform,
    module: input.module,
    bodyJSON: input.bodyJSON ?? existing?.bodyJSON ?? {},
    bodyHTML: input.bodyHTML ?? existing?.bodyHTML ?? "",
    voiceScore: input.voiceScore ?? existing?.voiceScore,
    headlineVariants: input.headlineVariants ?? existing?.headlineVariants,
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

export async function snapshotDraft(id: string): Promise<DraftRecord | null> {
  const d = await getDraft(id);
  if (!d) return null;
  const snaps = (d.snapshots || []).slice();
  snaps.push({ at: Date.now(), bodyJSON: d.bodyJSON, title: d.title });
  d.snapshots = snaps.slice(-SNAPSHOT_CAP);
  await db().setItem(d.id, d);
  return d;
}

export async function softDelete(id: string): Promise<void> {
  const d = await getDraft(id);
  if (!d) return;
  d.deletedAt = Date.now();
  await db().setItem(id, d);
}

export async function restoreDraft(id: string): Promise<void> {
  const d = await getDraft(id);
  if (!d) return;
  d.deletedAt = null;
  await db().setItem(id, d);
}

export async function hardDelete(id: string): Promise<void> {
  await db().removeItem(id);
}
