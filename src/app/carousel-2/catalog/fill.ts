// Carousel 2.0 · fill — apply field values back into a product's SVG (Slice 3).
//
// Resolves each field to its SVG node via the locator (svgId → dataField →
// objectIndex best-effort) and sets its text / image href. Used to preview an
// AI-auto-filled slide; also the seed for filled export later. Client-only
// (DOMParser / XMLSerializer).

import type { CatalogField } from "./types";

function attrEscape(s: string): string {
  return s.replace(/["\\]/g, "\\$&");
}

function setNodeValue(el: Element, field: CatalogField, value: string): void {
  if (field.type === "image") {
    el.setAttribute("href", value);
    el.setAttribute("xlink:href", value);
    return;
  }
  // Text: replace content (collapses <tspan> line breaks — acceptable for a
  // fill preview; the editor slice will handle rich multi-line reflow).
  el.textContent = value;
}

// Return a new SVG string with `values` (keyed by field name) applied.
export function applyFieldValues(svg: string, fields: CatalogField[], values: Record<string, string>): string {
  if (typeof DOMParser === "undefined") return svg;
  const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
  const texts = Array.from(doc.querySelectorAll("text"));
  const images = Array.from(doc.querySelectorAll("image"));

  fields.forEach((f) => {
    const v = values[f.name];
    if (typeof v !== "string" || !v.length) return;
    const l = f.locator;
    let el: Element | null = null;
    if (l.svgId) el = doc.querySelector(`[id="${attrEscape(l.svgId)}"]`);
    if (!el && l.dataField) el = doc.querySelector(`[data-field="${attrEscape(l.dataField)}"]`);
    if (!el && typeof l.objectIndex === "number") {
      // Best-effort for inferred fields (no stable id): nth text/image in DOM
      // order. May not always line up with the heuristic's index; annotated
      // fields (svgId/dataField) are the reliable path.
      const pool = f.type === "image" ? images : texts;
      el = pool[l.objectIndex] || null;
    }
    if (el) setNodeValue(el, f, v);
  });

  return new XMLSerializer().serializeToString(doc.documentElement);
}
