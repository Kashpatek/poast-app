// ═══════════════════════════════════════════════════════════════════════════
// Library mode · data — types + JSON loaders for the 2026-07-13 design-system
// handoff (90 approved templates + 36 topic-pooled backgrounds).
//
// Types mirror docs/LIBRARY-INTEGRATION.md §A verbatim; the JSON schemas are
// docs/handoff-20260713/README.md "Data contracts". Both loaders fetch ONCE
// per session through a module cache with in-flight promise dedupe (parallel
// callers share the same request); *Sync peeks the cache so pure renderers
// can stay synchronous once assets are warm (same pattern compose.ts uses
// for SVG texts). Template `idx` is THE stable cross-system key — never
// renumber (hard constraint).
// ═══════════════════════════════════════════════════════════════════════════

export type LibTopicKey =
  | "datacenter" | "power" | "accelerator" | "memory" | "foundry"
  | "packaging" | "equipment" | "networking" | "cloud" | "models-labs"
  | "markets" | "geopolitics" | "space-dc" | "brand";

// Field/slot schema parsed from the annotated SVG data-attributes
// (data-field/data-role/data-maxlen/... — templates.json and the SVGs agree).
export interface LibField { name: string; element: string; role: string; maxLen?: number; minFont?: number; maxFont?: number }
export interface LibSlot  { name: string; accepts: string; label?: string; role?: string; x: number; y: number; width: number; height: number }
export interface LibTemplate {
  idx: number;
  id: string;
  layout: string;
  family: string;
  disposition: string;
  useWhen?: string;
  svgFile: string;               // "svg/NNN-layout.svg" relative to the handoff package
  dims: { width: number; height: number };
  fields: LibField[];
  slots: LibSlot[];
  looksGood?: number;
  articulates?: string;
  fixNote?: string;
}

// backdrop-topics.json: 14 topics → primary/secondary pools over keys "01".."36".
export interface LibTopic { key: LibTopicKey; name: string; covers: string; primary: string[]; secondary: string[] }
export interface TopicsData { topics: LibTopic[]; backdrops: Record<string, { name: string; native: string; tier: string }> }

// ─── module caches (+ in-flight dedupe) ───
var templatesCache: LibTemplate[] | null = null;
var templatesInflight: Promise<LibTemplate[]> | null = null;
var topicsCache: TopicsData | null = null;
var topicsInflight: Promise<TopicsData> | null = null;

// Fetch /library/templates.json once. Concurrent callers before the first
// resolve share the in-flight promise; a failed fetch clears it so the next
// caller retries instead of caching the error forever.
export function loadTemplates(): Promise<LibTemplate[]> {
  if (templatesCache) return Promise.resolve(templatesCache);
  if (templatesInflight) return templatesInflight;
  templatesInflight = fetch("/library/templates.json")
    .then(function (r) {
      if (!r.ok) throw new Error("templates.json fetch failed: " + r.status);
      return r.json();
    })
    .then(function (d: { templates?: LibTemplate[] }) {
      templatesCache = (d && d.templates) || [];
      return templatesCache;
    })
    .catch(function (e) {
      templatesInflight = null;
      throw e;
    });
  return templatesInflight;
}

// Fetch /library/backdrop-topics.json once (same cache + dedupe shape).
export function loadTopics(): Promise<TopicsData> {
  if (topicsCache) return Promise.resolve(topicsCache);
  if (topicsInflight) return topicsInflight;
  topicsInflight = fetch("/library/backdrop-topics.json")
    .then(function (r) {
      if (!r.ok) throw new Error("backdrop-topics.json fetch failed: " + r.status);
      return r.json();
    })
    .then(function (d: TopicsData) {
      topicsCache = d;
      return topicsCache;
    })
    .catch(function (e) {
      topicsInflight = null;
      throw e;
    });
  return topicsInflight;
}

// Cache peeks — null until the corresponding load*() has resolved once.
export function templatesSync(): LibTemplate[] | null { return templatesCache; }
export function topicsSync(): TopicsData | null { return topicsCache; }

// ─── asset URLs ───
// Backdrops ship as public/library/backgrounds/bg-<key>.svg, key "01".."36".
export const bgSvgUrl = function (key: string): string {
  return "/library/backgrounds/bg-" + key + ".svg";
};

// templates.json carries svgFile relative to the handoff package
// ("svg/000-coverText.svg"); the ingested copies live flat under
// public/library/templates/, so serve by basename.
export const tplSvgUrl = function (t: LibTemplate): string {
  var base = t.svgFile.split("/").pop() || t.svgFile;
  return "/library/templates/" + base;
};
