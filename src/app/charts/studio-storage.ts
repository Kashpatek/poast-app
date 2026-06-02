// POAST Studio · unified save/load API.
//
// All editors talk to this module — they never call Supabase or localStorage
// directly. The branching rule:
//   - Named users (anyone who isn't an Analyst) → mirror to Supabase via
//     /api/studio, with a localStorage cache so reloads feel instant.
//   - Analysts (and anonymous) → localStorage ONLY. Never written to the
//     server, so analysts can't see each other's drafts on a shared laptop.
//
// The Supabase mirror is best-effort. If the network call fails we keep the
// local copy and surface the error via SaveState — same idle/saving/saved/
// error pattern Task Board already uses.

import { StudioDoc, isAnalystOwner } from "./studio-types";

const LOCAL_KEY = "poast-studio-docs-v1";

interface LocalIndex {
  // owner → docs (so a single shared browser can house both Akash's docs
  // and an Analyst session without one stomping the other).
  byOwner: Record<string, StudioDoc[]>;
}

function readLocal(): LocalIndex {
  if (typeof window === "undefined") return { byOwner: {} };
  try {
    const raw = window.localStorage.getItem(LOCAL_KEY);
    if (!raw) return { byOwner: {} };
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && parsed.byOwner) return parsed as LocalIndex;
  } catch { /* fall through */ }
  return { byOwner: {} };
}

function writeLocal(idx: LocalIndex): void {
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(LOCAL_KEY, JSON.stringify(idx)); } catch { /* quota — swallow */ }
}

function upsertLocal(owner: string, doc: StudioDoc): void {
  const idx = readLocal();
  const list = idx.byOwner[owner] || [];
  const existing = list.findIndex(d => d.id === doc.id);
  if (existing >= 0) list[existing] = doc; else list.unshift(doc);
  idx.byOwner[owner] = list;
  writeLocal(idx);
}

function removeLocal(owner: string, id: string): void {
  const idx = readLocal();
  const list = idx.byOwner[owner] || [];
  idx.byOwner[owner] = list.filter(d => d.id !== id);
  writeLocal(idx);
}

function localListFor(owner: string): StudioDoc[] {
  const idx = readLocal();
  return (idx.byOwner[owner] || []).slice();
}

function localGet(owner: string, id: string): StudioDoc | null {
  return localListFor(owner).find(d => d.id === id) || null;
}

// ── Server-side mirror (Supabase via /api/studio) ──────────────────────────
// Named users only. Functions resolve to local results if the API errors,
// so the UI degrades gracefully when Supabase is unreachable.

async function serverList(owner: string): Promise<StudioDoc[] | null> {
  try {
    const res = await fetch(`/api/studio?owner=${encodeURIComponent(owner)}`, { cache: "no-store" });
    if (!res.ok) return null;
    const j = await res.json();
    if (!Array.isArray(j.docs)) return null;
    return j.docs as StudioDoc[];
  } catch {
    return null;
  }
}

async function serverSave(doc: StudioDoc): Promise<boolean> {
  try {
    const res = await fetch("/api/studio", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ user: doc.owner, doc }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function serverDelete(owner: string, id: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/studio?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ user: owner, id }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// ── Public API ────────────────────────────────────────────────────────────

export async function listDocs(owner: string): Promise<StudioDoc[]> {
  const local = localListFor(owner);
  if (isAnalystOwner(owner)) return local;
  const server = await serverList(owner);
  if (!server) return local;
  // Merge: server is the truth. Replace the local index for this owner with
  // the server list so deletes that happened on another device propagate.
  const idx = readLocal();
  idx.byOwner[owner] = server;
  writeLocal(idx);
  return server;
}

export async function loadDoc(owner: string, id: string): Promise<StudioDoc | null> {
  // Local is always tried first for instant load; the list call refreshes
  // the index from the server side, so on reload we get the latest.
  const cached = localGet(owner, id);
  if (cached) return cached;
  if (isAnalystOwner(owner)) return null;
  const list = await serverList(owner);
  if (!list) return null;
  return list.find(d => d.id === id) || null;
}

export async function saveDoc(doc: StudioDoc): Promise<{ ok: boolean; error?: string }> {
  const stamped: StudioDoc = { ...doc, updatedAt: new Date().toISOString() };
  upsertLocal(stamped.owner, stamped);
  if (isAnalystOwner(stamped.owner)) return { ok: true };
  const ok = await serverSave(stamped);
  return ok ? { ok: true } : { ok: false, error: "Server save failed — kept locally" };
}

export async function deleteDoc(owner: string, id: string): Promise<{ ok: boolean; error?: string }> {
  removeLocal(owner, id);
  if (isAnalystOwner(owner)) return { ok: true };
  const ok = await serverDelete(owner, id);
  return ok ? { ok: true } : { ok: false, error: "Server delete failed — local copy removed" };
}
