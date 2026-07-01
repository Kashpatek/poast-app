// Carousel 2.0 · useCatalog — load + parse + cache the asset library.
//
// Fetches the manifest, ingests each SVG-in-HTML file into products, dedupes by
// id, and caches the parsed catalog in IndexedDB (keyed by manifest hash) so
// re-visits are instant. Reads static public/ files only — no /api/db writes.

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ingestHtml, contentHash } from "../catalog/parser";
import { validateManifest } from "../catalog/schema";
import { getCachedCatalog, setCachedCatalog, clearCachedCatalog } from "../catalog/catalog-store";
import {
  CATALOG_SCHEMA_VERSION,
  type Catalog,
  type CatalogProduct,
  type ProductKind,
} from "../catalog/types";

const BASE = "/carousel-2-assets";

async function fetchText(path: string): Promise<string> {
  const r = await fetch(path, { cache: "no-store" });
  if (!r.ok) throw new Error(`${path}: HTTP ${r.status}`);
  return r.text();
}

async function buildCatalog(): Promise<Catalog> {
  const manifestText = await fetchText(`${BASE}/manifest.json`);
  const manifestHash = contentHash(manifestText);
  const manifest = validateManifest(JSON.parse(manifestText));
  if (!manifest) throw new Error("invalid manifest.json");

  const products: CatalogProduct[] = [];
  const seen = new Set<string>();
  for (const f of manifest.files) {
    try {
      const html = await fetchText(`${BASE}/${f.path}`);
      const parsed = await ingestHtml(html, f.path);
      for (const p of parsed) {
        if (!seen.has(p.id)) {
          seen.add(p.id);
          products.push(p);
        }
      }
    } catch (e) {
      if (typeof console !== "undefined") console.warn("[carousel-2] failed to ingest", f.path, e);
    }
  }
  return { schemaVersion: CATALOG_SCHEMA_VERSION, generatedAt: Date.now(), manifestHash, products };
}

export interface UseCatalog {
  catalog: Catalog | null;
  products: CatalogProduct[];
  byKind: Record<ProductKind, CatalogProduct[]>;
  loading: boolean;
  error: string | null;
  search: (q: string) => CatalogProduct[];
  reload: () => Promise<void>;
}

export function useCatalog(): UseCatalog {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (force?: boolean) => {
    setLoading(true);
    setError(null);
    try {
      const manifestText = await fetchText(`${BASE}/manifest.json`);
      const manifestHash = contentHash(manifestText);
      if (!force) {
        const cached = await getCachedCatalog(manifestHash);
        if (cached) {
          setCatalog(cached);
          setLoading(false);
          return;
        }
      }
      const built = await buildCatalog();
      setCatalog(built);
      await setCachedCatalog(built);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const products = useMemo(() => catalog?.products || [], [catalog]);

  const byKind = useMemo(() => {
    const m: Record<ProductKind, CatalogProduct[]> = { background: [], template: [], module: [] };
    products.forEach((p) => m[p.kind].push(p));
    return m;
  }, [products]);

  const search = useCallback(
    (q: string) => {
      const t = q.trim().toLowerCase();
      if (!t) return products;
      return products.filter((p) => {
        const hay = [
          p.title,
          p.category,
          p.tags.join(" "),
          p.fields.map((f) => `${f.name} ${f.locator.role || ""}`).join(" "),
        ]
          .join(" ")
          .toLowerCase();
        return hay.includes(t);
      });
    },
    [products]
  );

  const reload = useCallback(async () => {
    await clearCachedCatalog();
    await load(true);
  }, [load]);

  return { catalog, products, byKind, loading, error, search, reload };
}
