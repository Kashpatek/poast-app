// Carousel 2.0 · catalog data model (Slice 1).
//
// Pure types only — no React, no Fabric, no browser APIs — so this module is
// import-cheap and usable from the parser, a future API route, or a worker.
//
// A "product" is one reusable design asset in the library. There are three
// kinds, all sharing CatalogBase, discriminated by `kind`:
//   - background : full-bleed backdrop (~30)
//   - template   : a full-slide composition (the ~175 "overlays"); AI-fillable
//   - module     : a sub-element (chart, text-box, stat, quote, logo, element)
//
// The heart of the model is the AI-readable DATA-BINDING SCHEMA: every product
// carries `fields[]` describing the fillable slots, each with a `locator` that
// maps the field back to a node in the product's SVG so an editor / the AI /
// verbatim can populate it deterministically.

export const CATALOG_SCHEMA_VERSION = 1;

// Slides are fixed Instagram-portrait; kept as a type so a product can, in
// principle, declare its own size, but the seed + covers are all 1080x1350.
export interface SlideDims {
  width: number;
  height: number;
}
export const SLIDE_DIMS: SlideDims = { width: 1080, height: 1350 };

export type ProductKind = "background" | "template" | "module";

export type ModuleType =
  | "chart"
  | "text-box"
  | "stat"
  | "quote"
  | "logo-lockup"
  | "element";

// The value shape a field expects. `chart` is a slot that a chart module /
// chart-maker output drops into; `image` is a photo/graphic frame.
export type FieldType = "text" | "richtext" | "image" | "chart" | "number" | "color";

// Semantic role — drives AI mapping and the verbatim bridge (e.g. a verbatim
// title fills the field whose role is "headline"). Kept as a union so callers
// get autocomplete; unknown roles fall back to `undefined`.
export type FieldRole =
  | "headline"
  | "subhead"
  | "body"
  | "eyebrow"
  | "stat"
  | "label"
  | "quote"
  | "attribution"
  | "image"
  | "logo"
  | "chart"
  | "footer"
  | "page-number";

export interface FieldConstraints {
  maxLen?: number;
  minFont?: number;
  maxFont?: number;
  min?: number; // numeric fields
  max?: number;
  required?: boolean;
  multiline?: boolean;
  options?: string[]; // enum-ish text fields
}

// Maps a field to a node in the parsed SVG. Resolution order at fill-time:
//   1. svgId       — element id (id="field:headline" or id="headline")
//   2. dataField   — [data-field="headline"]
//   3. objectIndex — index into loadSVGFromString().objects[] (heuristic path)
export interface FieldLocator {
  svgId?: string;
  dataField?: string;
  objectIndex?: number;
  role?: FieldRole;
}

export interface CatalogField {
  name: string; // unique within a product; the key AI/verbatim fill against
  type: FieldType;
  label?: string;
  placeholder?: string;
  defaultValue?: string;
  constraints?: FieldConstraints;
  locator: FieldLocator;
}

export interface CatalogSource {
  file: string; // path under public/carousel-2-assets/…
  contentHash?: string; // hash of the source HTML, for cache-busting
}

export interface CatalogBase {
  id: string;
  kind: ProductKind;
  title: string;
  category: string;
  tags: string[];
  dims: SlideDims;
  source: CatalogSource;
  svg: string; // extracted, self-contained <svg>…</svg>
  thumb?: string; // dataURL, lazily rasterized (never persisted to the seed)
  fields: CatalogField[];
  schemaVersion: number;
  createdAt: number;
  updatedAt: number;
  meta?: Record<string, unknown>; // e.g. { inferred: true }
}

export interface CatalogBackground extends CatalogBase {
  kind: "background";
}

export interface CatalogModule extends CatalogBase {
  kind: "module";
  moduleType: ModuleType;
  // Optional default placement when dropped into a template (1080x1350 space).
  anchor?: { x: number; y: number; w: number; h: number };
}

// A reference used when a template is COMPOSED from a background + modules
// rather than authored as one self-contained SVG. v1 default: composition is
// empty and the template is self-contained (fields[] flattened onto it).
export interface CompositionRef {
  ref: string; // product id
  refKind: "background" | "module";
  placement?: { x: number; y: number; w: number; h: number; z?: number };
  fieldOverrides?: Record<string, Partial<CatalogField>>;
}

export interface CatalogTemplate extends CatalogBase {
  kind: "template";
  composition?: CompositionRef[];
  coverEligible?: boolean; // can stand in as slide-1 cover
}

export type CatalogProduct = CatalogBackground | CatalogModule | CatalogTemplate;

export interface Catalog {
  schemaVersion: number;
  generatedAt: number;
  manifestHash: string;
  products: CatalogProduct[];
}

// Manifest that lists which source files to ingest (public/carousel-2-assets).
export interface CatalogManifestEntry {
  path: string; // relative to public/carousel-2-assets/
  kind?: ProductKind; // optional hint; the file marker wins
  id?: string; // optional hint; the file marker wins
}
export interface CatalogManifest {
  version: number;
  files: CatalogManifestEntry[];
}

// Narrowing helpers.
export function isBackground(p: CatalogProduct): p is CatalogBackground {
  return p.kind === "background";
}
export function isModule(p: CatalogProduct): p is CatalogModule {
  return p.kind === "module";
}
export function isTemplate(p: CatalogProduct): p is CatalogTemplate {
  return p.kind === "template";
}
