// ============================================================================
// SA Brand · Excel-template reference thumbnails
// ============================================================================
// Maps template-id → public path of the LibreOffice-rasterized PNG for the
// original SemiAnalysis brand Excel sheet that the in-app template descends
// from. The PNGs themselves are generated on the user's machine by running:
//
//   npm run rasterize-tables
//
// which invokes scripts/rasterize-sa-tables.mjs (LibreOffice headless). Until
// the user runs that script the entries below resolve to paths that 404 — the
// chart-maker-2 gallery checks for the mapping but the <img> simply fails to
// load. We do NOT bundle placeholder PNGs.
//
// Mapping is hand-curated against the 6 canonical SA-Brand workbook sheets:
//   1. Clustered Bar
//   2. Line Trend
//   3. Stacked Bar
//   4. Pie
//   5. Waterfall
//   6. Scatter
// Additional template-ids that descend visually from one of those 6 sheets
// point at the same PNG (e.g. SA · Stacked Area uses the stacked-bar ref).
// ============================================================================

// Canonical slugs match the rasterizer's slugify() output for the SA Brand
// workbooks shipped in /SEMIANALYSIS/Brand/Brand 2026 Launch/Excel Templates/
// (filename: "Template - Light and Dark - Outfit.xlsx"). When the user later
// adds per-chart-type sheet exports, the mapping below points at the
// per-sheet slug names.
const REF_DIR = "/sa-table-refs";

// Per-chart-type sheet thumbs (preferred — one PNG per chart type).
const PER_TYPE: Record<string, string> = {
  "sa-brand-clustered-bar":         `${REF_DIR}/sa-clustered-bar.png`,
  "sa-brand-line-monthly":          `${REF_DIR}/sa-line-trend.png`,
  "sa-brand-stacked-region":        `${REF_DIR}/sa-stacked-bar.png`,
  "sa-brand-pie-segment":           `${REF_DIR}/sa-pie.png`,
  "sa-brand-waterfall-pl":          `${REF_DIR}/sa-waterfall.png`,
  "sa-brand-scatter-flops-power":   `${REF_DIR}/sa-scatter.png`,
  // Descend-from mappings (no dedicated sheet; share the closest sibling).
  "sa-brand-stackedarea-accelerator": `${REF_DIR}/sa-stacked-bar.png`,
  "sa-brand-flops-availability":      `${REF_DIR}/sa-clustered-bar.png`,
  "sa-brand-tco-pflop":                `${REF_DIR}/sa-clustered-bar.png`,
};

// Workbook-level fallbacks. The rasterizer always produces these two slugs
// even before any per-sheet split. The gallery can reach for them if a
// per-type PNG isn't present.
const WORKBOOK_FALLBACKS = [
  `${REF_DIR}/template-light-and-dark-outfit.png`,
  `${REF_DIR}/template-light-and-dark-aptos.png`,
];

/**
 * Returns the public path of the reference PNG for `templateId`, or null
 * when no thumb is mapped. The caller is responsible for handling 404s
 * (e.g. by hiding the link if the image fails to load).
 */
export function getThumb(templateId: string): string | null {
  return PER_TYPE[templateId] ?? null;
}

/**
 * True when the template-id has any mapped thumb (per-type or workbook
 * fallback). Used by the gallery to decide whether to render the
 * "Reference original" link.
 */
export function hasThumb(templateId: string): boolean {
  return templateId in PER_TYPE;
}

/**
 * All workbook-level fallback PNGs the rasterizer is expected to produce.
 * Exposed so the gallery can preload or list them for debugging.
 */
export function workbookFallbacks(): string[] {
  return [...WORKBOOK_FALLBACKS];
}
