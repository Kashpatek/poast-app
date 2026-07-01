// Carousel 2.0 · catalog client cache + (dormant) publish (Slice 1).
//
// Source of truth is the in-repo public/carousel-2-assets/ files; the catalog
// is DERIVED at runtime. This module caches the parsed catalog + rasterized
// thumbnails in IndexedDB so re-visits are instant. Publishing user-authored
// assets to the shared store is STUBBED + guarded so nothing writes to Neon in
// dev.

"use client";

import localforage from "localforage";
import type { Catalog, CatalogProduct } from "./types";

let catalogDb: LocalForage | null = null;
function db(): LocalForage {
  if (!catalogDb) catalogDb = localforage.createInstance({ name: "poast-carousel-2", storeName: "catalog" });
  return catalogDb;
}

let thumbDb: LocalForage | null = null;
function thumbs(): LocalForage {
  if (!thumbDb) thumbDb = localforage.createInstance({ name: "poast-carousel-2", storeName: "thumbs" });
  return thumbDb;
}

const CATALOG_KEY = "catalog:v1";

// Return the cached catalog only if it matches the current manifest hash.
export async function getCachedCatalog(manifestHash: string): Promise<Catalog | null> {
  try {
    const c = await db().getItem<Catalog>(CATALOG_KEY);
    return c && c.manifestHash === manifestHash ? c : null;
  } catch {
    return null;
  }
}

export async function setCachedCatalog(catalog: Catalog): Promise<void> {
  try {
    await db().setItem(CATALOG_KEY, catalog);
  } catch {
    /* quota / private mode — cache is best-effort */
  }
}

export async function clearCachedCatalog(): Promise<void> {
  try {
    await db().removeItem(CATALOG_KEY);
  } catch {
    /* ignore */
  }
}

// Thumbnails keyed by product id + source content hash (so they bust on edit).
function thumbKey(id: string, contentHash?: string): string {
  return `${id}@${contentHash || "0"}`;
}
export async function getCachedThumb(id: string, contentHash?: string): Promise<string | null> {
  try {
    return (await thumbs().getItem<string>(thumbKey(id, contentHash))) || null;
  } catch {
    return null;
  }
}
export async function setCachedThumb(id: string, contentHash: string | undefined, dataUrl: string): Promise<void> {
  try {
    await thumbs().setItem(thumbKey(id, contentHash), dataUrl);
  } catch {
    /* ignore */
  }
}

// ── dormant, guarded publish (later slice) ─────────────────────────────────
// User-authored assets would publish to the shared `projects` table with
// type "carousel-asset" (no new table). Guarded so dev never writes to Neon.
export function publishEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (process.env.NODE_ENV === "production") return true;
    return new URLSearchParams(window.location.search).has("publish");
  } catch {
    return false;
  }
}

export async function publishProduct(_product: CatalogProduct, opts?: { publish?: boolean }): Promise<void> {
  if (!(opts?.publish && publishEnabled())) {
    if (typeof console !== "undefined") console.warn("[carousel-2] publish disabled (dev): no shared-store write");
    return;
  }
  // Later slice: POST /api/db { table:"projects", data:{ type:"carousel-asset", … } }.
  throw new Error("Carousel 2.0: publishProduct not implemented — asset-publish slice");
}

export async function fetchPublishedProducts(): Promise<CatalogProduct[]> {
  // Dormant this slice — shared/global assets come from the in-repo manifest.
  return [];
}
