// Carousel 2.0 · SVG-in-HTML ingestion (Slice 1).
//
// Turns an authored HTML file (with one or more <svg> roots) into catalog
// products with an AI-fillable `fields[]` schema. See ./INGESTION.md for the
// authoring contract. Client-only (uses DOMParser + Fabric); Fabric is
// dynamically imported inside functions so this module never evaluates canvas
// code during SSR.

import {
  CATALOG_SCHEMA_VERSION,
  SLIDE_DIMS,
  type CatalogField,
  type CatalogProduct,
  type FieldRole,
  type FieldType,
  type ModuleType,
  type ProductKind,
  type SlideDims,
  type SlotAccept,
  type TemplateSlot,
} from "./types";
import { CANVAS_DIMS, dimsMatch, normalizeIntrinsic, type Rect } from "../../lib/canvas-fit";
import { validateProduct } from "./schema";

const KNOWN_ROLES: FieldRole[] = [
  "headline", "subhead", "body", "eyebrow", "stat", "label", "quote",
  "attribution", "image", "logo", "chart", "footer", "page-number",
];

// ── small utils ────────────────────────────────────────────────────────────

// Cheap, deterministic 32-bit string hash (djb2) → hex. Not cryptographic —
// just for cache-busting on source content change.
export function contentHash(str: string): string {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0;
  return (h >>> 0).toString(16);
}

function titleFromId(id: string): string {
  return id.replace(/^(bg|tpl|mod)-/, "").replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function dedupeNames(fields: CatalogField[]): CatalogField[] {
  const seen: Record<string, number> = {};
  return fields.map((f) => {
    if (seen[f.name] === undefined) {
      seen[f.name] = 1;
      return f;
    }
    seen[f.name] += 1;
    return { ...f, name: `${f.name}-${seen[f.name]}` };
  });
}

function inferTypeFromRole(role: FieldRole | undefined, tag: string): FieldType {
  if (role === "image" || role === "logo") return "image";
  if (role === "chart") return "chart";
  if (role === "stat") return "number";
  if (tag === "image") return "image";
  return "text";
}

// ── marker parsing ───────────────────────────────────────────────────────────

interface Anchor {
  x: number;
  y: number;
  w: number;
  h: number;
}
interface Marker {
  kind?: ProductKind;
  id?: string;
  title?: string;
  category?: string;
  tags?: string[];
  moduleType?: ModuleType;
  coverEligible?: boolean;
  anchor?: Anchor;
}

function parseAnchor(v?: string | boolean): Anchor | undefined {
  if (typeof v !== "string") return undefined;
  const n = v.split(",").map((s) => Number(s.trim()));
  if (n.length === 4 && n.every((x) => Number.isFinite(x))) return { x: n[0], y: n[1], w: n[2], h: n[3] };
  return undefined;
}

function parseAttrs(attrStr: string): Record<string, string | boolean> {
  const out: Record<string, string | boolean> = {};
  const re = /([A-Za-z_][\w-]*)(?:="([^"]*)")?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(attrStr)) !== null) {
    if (!m[1]) continue;
    out[m[1]] = m[2] !== undefined ? m[2] : true;
  }
  return out;
}

function markerFromAttrs(a: Record<string, string | boolean>): Marker {
  const tags = typeof a.tags === "string" ? a.tags.split(",").map((t) => t.trim()).filter(Boolean) : undefined;
  return {
    kind: typeof a.kind === "string" ? (a.kind as ProductKind) : undefined,
    id: typeof a.id === "string" ? a.id : undefined,
    title: typeof a.title === "string" ? a.title : undefined,
    category: typeof a.category === "string" ? a.category : undefined,
    tags,
    moduleType: typeof a.moduleType === "string" ? (a.moduleType as ModuleType) : (typeof a["module-type"] === "string" ? (a["module-type"] as ModuleType) : undefined),
    coverEligible: a.coverEligible === true || a.coverEligible === "true" || a["cover-eligible"] === true || a["cover-eligible"] === "true",
    anchor: parseAnchor(a.anchor),
  };
}

function parseTopMarker(html: string): Marker | null {
  const m = /<!--\s*@carouselAsset\b([\s\S]*?)-->/.exec(html);
  if (!m) return null;
  return markerFromAttrs(parseAttrs(m[1]));
}

function markerFromSvgEl(svgEl: Element): Marker {
  const g = (k: string) => svgEl.getAttribute(k) || undefined;
  const tags = g("data-tags")?.split(",").map((t) => t.trim()).filter(Boolean);
  return {
    kind: (g("data-kind") as ProductKind) || undefined,
    id: g("data-product-id"),
    title: g("data-title"),
    category: g("data-category"),
    tags,
    moduleType: (g("data-module-type") as ModuleType) || undefined,
    coverEligible: svgEl.getAttribute("data-cover-eligible") === "true" || svgEl.hasAttribute("data-cover-eligible"),
    anchor: parseAnchor(g("data-anchor")),
  };
}

// ── SVG extraction ───────────────────────────────────────────────────────────

// Extract one-or-many self-contained <svg> strings from an HTML file, each with
// its resolved marker. Inlines <head>/document <style> into the svg so the
// product renders standalone.
export function extractSvgsFromHtml(html: string): Array<{ svg: string; marker: Marker }> {
  if (typeof DOMParser === "undefined") return [];
  const doc = new DOMParser().parseFromString(html, "text/html");
  const headStyle = Array.from(doc.querySelectorAll("style"))
    .map((s) => s.textContent || "")
    .join("\n")
    .trim();
  const topMarker = parseTopMarker(html);
  const svgs = Array.from(doc.querySelectorAll("svg"));
  if (!svgs.length) return [];
  const multi = svgs.filter((s) => s.getAttribute("data-product-id"));
  const targets = multi.length ? multi : [svgs[0]];

  return targets.map((svgEl) => {
    // Inline document <style> into the svg if it has none of its own.
    if (headStyle && !svgEl.querySelector("style")) {
      const styleEl = doc.createElementNS("http://www.w3.org/2000/svg", "style");
      styleEl.textContent = headStyle;
      svgEl.insertBefore(styleEl, svgEl.firstChild);
    }
    const marker = multi.length ? markerFromSvgEl(svgEl) : topMarker || {};
    return { svg: svgEl.outerHTML, marker };
  });
}

// ── field extraction ─────────────────────────────────────────────────────────

function isAnnotated(el: Element): boolean {
  if (el.getAttribute("data-field")) return true;
  const id = el.getAttribute("id") || "";
  if (id.startsWith("field:")) return true;
  return (KNOWN_ROLES as string[]).indexOf(id) !== -1;
}

function annotatedFieldFromEl(el: Element, objectIndex?: number): CatalogField {
  const tag = el.tagName.toLowerCase();
  const dataField = el.getAttribute("data-field") || undefined;
  const id = el.getAttribute("id") || undefined;
  const name = dataField || (id && id.startsWith("field:") ? id.slice(6) : id) || "field";
  const roleAttr = (el.getAttribute("data-role") as FieldRole) || undefined;
  const role: FieldRole | undefined =
    roleAttr || (id && (KNOWN_ROLES as string[]).indexOf(id) !== -1 ? (id as FieldRole) : undefined);
  const type = (el.getAttribute("data-type") as FieldType) || inferTypeFromRole(role, tag);

  const num = (k: string): number | undefined => {
    const v = el.getAttribute(k);
    return v == null ? undefined : Number(v);
  };
  const constraints = {
    maxLen: num("data-maxlen"),
    minFont: num("data-minfont"),
    maxFont: num("data-maxfont"),
    required: el.hasAttribute("data-required") ? true : undefined,
  };
  const hasConstraints = Object.values(constraints).some((v) => v !== undefined);

  const rawDefault =
    type === "image"
      ? el.getAttribute("href") || el.getAttribute("xlink:href") || ""
      : (el.textContent || "").trim();

  return {
    name,
    type,
    label: name,
    placeholder: rawDefault || undefined,
    defaultValue: rawDefault || undefined,
    constraints: hasConstraints ? constraints : undefined,
    locator: { svgId: id, dataField, role, objectIndex: objectIndex != null && objectIndex >= 0 ? objectIndex : undefined },
  };
}

function collectAnnotated(doc: Document): Element[] {
  const set = new Set<Element>();
  doc.querySelectorAll("[data-field]").forEach((e) => set.add(e));
  doc.querySelectorAll("[id^='field:']").forEach((e) => set.add(e));
  // Plain id matching a known role (e.g. id="headline").
  KNOWN_ROLES.forEach((r) => doc.querySelectorAll(`#${r}`).forEach((e) => set.add(e)));
  return Array.from(set);
}

/* eslint-disable @typescript-eslint/no-explicit-any */
async function fabricParse(svg: string): Promise<{ objects: any[]; elements: Element[] }> {
  try {
    const fabric: any = await import("fabric");
    const out = await fabric.loadSVGFromString(svg);
    return { objects: out.objects || [], elements: out.elements || [] };
  } catch {
    return { objects: [], elements: [] };
  }
}

// Infer fields for the un-annotated content nodes. `skip` = indices already
// captured by annotation. `demoteToBody` = the asset has annotations, so any
// leftover text is treated as body (don't steal headline/subhead/eyebrow from
// the annotated intent).
function heuristicFields(objects: any[], elements: Element[], skip: Set<number>, demoteToBody: boolean): CatalogField[] {
  const texts: Array<{ i: number; fontSize: number; text: string; top: number }> = [];
  const images: number[] = [];
  objects.forEach((obj, i) => {
    if (!obj || skip.has(i)) return;
    const el = elements[i];
    if (el && isAnnotated(el)) return;
    const type = String(obj.type || "").toLowerCase();
    const tag = el ? el.tagName.toLowerCase() : "";
    if (type.includes("text") || tag === "text" || tag === "tspan") {
      texts.push({ i, fontSize: Number(obj.fontSize) || 0, text: String(obj.text || "").trim(), top: Number(obj.top) || 0 });
    } else if (type === "image" || tag === "image") {
      images.push(i);
    }
  });

  texts.sort((a, b) => b.fontSize - a.fontSize);
  const fields: CatalogField[] = [];
  let bodyN = 0;
  texts.forEach((tx, rank) => {
    const isCaps = !!tx.text && tx.text === tx.text.toUpperCase() && /[A-Z]/.test(tx.text) && tx.text.length <= 40;
    let role: FieldRole;
    let name: string;
    if (demoteToBody) {
      bodyN += 1;
      role = "body";
      name = `body-${bodyN}`;
    } else if (isCaps && tx.fontSize <= 44) {
      role = tx.top > 1050 ? "footer" : "eyebrow";
      name = role;
    } else if (rank === 0) {
      role = "headline";
      name = "headline";
    } else if (rank === 1) {
      role = "subhead";
      name = "subhead";
    } else {
      bodyN += 1;
      role = "body";
      name = `body-${bodyN}`;
    }
    fields.push({
      name,
      type: "text",
      label: name,
      placeholder: tx.text || undefined,
      defaultValue: tx.text || undefined,
      locator: { objectIndex: tx.i, role },
    });
  });
  images.forEach((idx, n) => {
    const name = images.length > 1 ? `photo-${n + 1}` : "photo";
    fields.push({ name, type: "image", label: name, locator: { objectIndex: idx, role: "image" } });
  });
  return fields;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

// Parse an svg string → fillable fields. Runs off Fabric's parsed elements
// (which carry data-* attributes AND give an objectIndex), merging annotated
// fields with heuristic-inferred leftovers. Falls back to a pure-DOM annotated
// scan if Fabric can't parse.
export async function parseSvgToFields(svg: string): Promise<{ fields: CatalogField[]; inferred: boolean }> {
  const { objects, elements } = await fabricParse(svg);
  if (objects.length || elements.length) {
    const annotatedFields: CatalogField[] = [];
    const captured = new Set<string>();
    const skip = new Set<number>();
    elements.forEach((el, i) => {
      if (el && isAnnotated(el)) {
        const f = annotatedFieldFromEl(el, i);
        annotatedFields.push(f);
        captured.add(f.name);
        skip.add(i);
      }
    });
    // Supplement with annotated container nodes Fabric didn't surface as a leaf
    // object (e.g. <g data-role="chart">).
    if (typeof DOMParser !== "undefined") {
      const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
      collectAnnotated(doc).forEach((el) => {
        const f = annotatedFieldFromEl(el);
        if (!captured.has(f.name)) {
          annotatedFields.push(f);
          captured.add(f.name);
        }
      });
    }
    const inferred = heuristicFields(objects, elements, skip, annotatedFields.length > 0);
    return { fields: dedupeNames([...annotatedFields, ...inferred]), inferred: inferred.length > 0 };
  }
  // Fabric failed → pure-DOM annotated-only fallback.
  if (typeof DOMParser !== "undefined") {
    const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
    const annotated = collectAnnotated(doc);
    if (annotated.length) {
      return { fields: dedupeNames(annotated.map((e) => annotatedFieldFromEl(e))), inferred: false };
    }
  }
  return { fields: [], inferred: false };
}

// ── slot (blocking) extraction ───────────────────────────────────────────────

function slotRegionNum(el: Element, dataAttr: string, geomAttr: string, fallback: number): number {
  const v = el.getAttribute(dataAttr) ?? el.getAttribute(geomAttr);
  const n = v == null ? NaN : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function slotFromEl(el: Element): TemplateSlot | null {
  const id = el.getAttribute("data-slot");
  if (!id) return null;
  const accepts = (el.getAttribute("data-accepts") || "module")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean) as SlotAccept[];
  return {
    id,
    label: el.getAttribute("data-label") || id,
    region: {
      x: slotRegionNum(el, "data-x", "x", 0),
      y: slotRegionNum(el, "data-y", "y", 0),
      w: slotRegionNum(el, "data-w", "width", SLIDE_DIMS.width),
      h: slotRegionNum(el, "data-h", "height", SLIDE_DIMS.height),
    },
    accepts: accepts.length ? accepts : ["module"],
    role: (el.getAttribute("data-role") as FieldRole) || undefined,
    required: el.hasAttribute("data-required") || undefined,
  };
}

// Overlays declare blocking regions with `data-slot` (+ data-accepts / geometry).
export function parseSvgToSlots(svg: string): TemplateSlot[] {
  if (typeof DOMParser === "undefined") return [];
  const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
  const out: TemplateSlot[] = [];
  doc.querySelectorAll("[data-slot]").forEach((el) => {
    const s = slotFromEl(el);
    if (s) out.push(s);
  });
  return out;
}

// ── product assembly ─────────────────────────────────────────────────────────

function assembleProduct(marker: Marker, svg: string, sourceFile: string, hash: string, fields: CatalogField[], inferred: boolean): CatalogProduct | null {
  const kind: ProductKind = marker.kind || "template";
  const id = marker.id || `${kind}-${hash}`;
  const now = Date.now();

  // Measure the asset's REAL size from its <svg> root rather than assuming the
  // canvas size. Modules are sub-elements measured by their anchor, so only
  // full-slide kinds (background/overlay/template) are held to the canvas size.
  const intrinsic = normalizeIntrinsic(svg);
  const dims: SlideDims = intrinsic ? { width: intrinsic.width, height: intrinsic.height } : SLIDE_DIMS;
  const meta: Record<string, unknown> = {};
  if (inferred) meta.inferred = true;
  if (intrinsic) meta.intrinsic = { width: intrinsic.width, height: intrinsic.height };
  if (kind !== "module" && !dimsMatch(dims, CANVAS_DIMS)) meta.dimsMismatch = true;

  const base = {
    id,
    title: marker.title || titleFromId(id),
    category: marker.category || kind,
    tags: marker.tags || [],
    dims,
    source: { file: sourceFile, contentHash: hash },
    svg,
    fields,
    schemaVersion: CATALOG_SCHEMA_VERSION,
    createdAt: now,
    updatedAt: now,
    meta: Object.keys(meta).length ? meta : undefined,
  };
  let product: CatalogProduct;
  if (kind === "background") {
    product = { ...base, kind: "background" };
  } else if (kind === "module") {
    product = { ...base, kind: "module", moduleType: marker.moduleType || "element", anchor: marker.anchor };
  } else {
    const slots = parseSvgToSlots(svg);
    product = { ...base, kind: "template", slots: slots.length ? slots : undefined, coverEligible: marker.coverEligible || undefined };
  }
  const v = validateProduct(product);
  if (!v.ok) {
    if (typeof console !== "undefined") console.warn(`[carousel-2] invalid product ${sourceFile}:`, v.errors);
    return null;
  }
  return v.product;
}

// Ingest one HTML file → 0..n validated products.
export async function ingestHtml(html: string, sourceFile: string): Promise<CatalogProduct[]> {
  const extracted = extractSvgsFromHtml(html);
  const hash = contentHash(html);
  const products: CatalogProduct[] = [];
  for (const { svg, marker } of extracted) {
    const { fields, inferred } = await parseSvgToFields(svg);
    const product = assembleProduct(marker, svg, sourceFile, hash, fields, inferred);
    if (product) products.push(product);
  }
  return products;
}

// ── thumbnail rasterization ────────────────────────────────────────────────

/* eslint-disable @typescript-eslint/no-explicit-any */
// Rasterize a product's svg to a PNG dataURL (lazy, client-only). Waits for
// fonts so text renders in Grift/Outfit, not a fallback.
export async function renderProductThumb(product: CatalogProduct, maxEdge = 320): Promise<string> {
  if (typeof window === "undefined" || typeof document === "undefined") return "";
  try {
    if (document.fonts && document.fonts.ready) await document.fonts.ready;
  } catch {
    /* ignore */
  }
  try {
    const fabric: any = await import("fabric");
    const { width, height } = product.dims;
    const el = document.createElement("canvas");
    const canvas = new fabric.StaticCanvas(el, { width, height, enableRetinaScaling: false });
    const out = await fabric.loadSVGFromString(product.svg);
    (out.objects || []).filter(Boolean).forEach((o: any) => canvas.add(o));
    canvas.renderAll();
    const multiplier = maxEdge / Math.max(width, height);
    const url = canvas.toDataURL({ format: "png", multiplier });
    canvas.dispose();
    return url;
  } catch {
    return "";
  }
}

// Measure the union bounding box of a product's rendered content (client-only).
// Feeds measureMargins() so the validator can SHOW what safe zone an asset
// actually uses, rather than assuming one. Extents are raw (may be negative or
// exceed the canvas) so overflow reads as a negative/oversized margin. Waits for
// fonts so text metrics are real.
export async function measureContentBBox(product: CatalogProduct): Promise<Rect | null> {
  if (typeof window === "undefined" || typeof document === "undefined") return null;
  try {
    if (document.fonts && document.fonts.ready) await document.fonts.ready;
  } catch {
    /* ignore */
  }
  try {
    const fabric: any = await import("fabric");
    const { width, height } = product.dims;
    const el = document.createElement("canvas");
    const canvas = new fabric.StaticCanvas(el, { width, height, enableRetinaScaling: false });
    const out = await fabric.loadSVGFromString(product.svg);
    const objs = (out.objects || []).filter(Boolean);
    if (!objs.length) {
      canvas.dispose();
      return null;
    }
    objs.forEach((o: any) => canvas.add(o));
    canvas.renderAll();
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const o of objs) {
      const b = o.getBoundingRect ? o.getBoundingRect() : null;
      if (!b) continue;
      minX = Math.min(minX, b.left);
      minY = Math.min(minY, b.top);
      maxX = Math.max(maxX, b.left + b.width);
      maxY = Math.max(maxY, b.top + b.height);
    }
    canvas.dispose();
    if (!Number.isFinite(minX) || !Number.isFinite(maxX)) return null;
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
  } catch {
    return null;
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */
