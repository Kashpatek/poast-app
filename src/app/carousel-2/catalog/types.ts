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

import { CANVAS_DIMS } from "../../lib/canvas-fit";

export const CATALOG_SCHEMA_VERSION = 1;

// Slides are fixed Instagram-portrait; kept as a type so a product can, in
// principle, declare its own size, but the seed + covers are all 1080x1350.
// Re-pointed to the shared canonical CANVAS_DIMS so there is one source of
// truth for the slide size across every surface (see lib/canvas-fit.ts).
export interface SlideDims {
  width: number;
  height: number;
}
export const SLIDE_DIMS: SlideDims = CANVAS_DIMS;

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

// A slot is the overlay's "blocking / rule": a named region that accepts
// certain widget (module) kinds. Overlays declare slots; modules get assigned
// into them. `accepts` lists module types (or the generics image|text|module).
export type SlotAccept = ModuleType | "image" | "text" | "module";
export interface TemplateSlot {
  id: string;
  label?: string;
  region: { x: number; y: number; w: number; h: number }; // 1080x1350 space
  accepts: SlotAccept[];
  role?: FieldRole;
  required?: boolean;
}

export interface CatalogTemplate extends CatalogBase {
  kind: "template";
  slots?: TemplateSlot[]; // blocking regions widgets assign into
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

// ── Composition — "things are just layers" ──────────────────────────────────
// A DesignComposition is a custom build: a background + an overlay (which
// supplies the blocking/slots) + modules (widgets) assigned into those slots,
// plus per-slot field values. It resolves to ordered layers for render/export.
export interface SlotAssignment {
  slotId: string;
  moduleId?: string; // the widget (module) assigned to this slot
  values?: Record<string, string>; // field.name -> value (module or overlay text)
}
export interface DesignComposition {
  id: string;
  title: string;
  dims: SlideDims;
  backgroundId?: string;
  overlayId: string; // the template supplying the blocking
  assignments: SlotAssignment[];
  createdAt: number;
  updatedAt: number;
}
// A resolved render layer (bottom→top order).
export interface DesignLayer {
  kind: "background" | "overlay" | "module";
  productId: string;
  region?: { x: number; y: number; w: number; h: number };
  svg: string;
}

// ── Deck — an ordered set of slides ("the carousel") ─────────────────────────
// The multi-slide layer over DesignComposition — the make-flow's core object.
// Each slide is a composition (overlay + optional background + slot widgets)
// plus its overlay field VALUES and a positional ROLE. Roles mirror the
// production carousel's slide.position semantics (1=cover, middle=body, last=
// closer) so the familiar "cover + body slides + closer" deck shape survives.
export type SlideRole = "cover" | "body" | "closer";

export interface DeckSlide {
  id: string;
  role: SlideRole;
  overlayId: string; // catalog template id — the slide's layout
  backgroundId?: string; // catalog background id — optional backdrop
  values: Record<string, string>; // overlay field.name -> value (headline, body…)
  assignments: SlotAssignment[]; // widgets assigned into the overlay's slots
}

export interface Deck {
  id: string;
  title: string;
  theme?: string; // ThemeKey-ish label (general|internal|external|capital)
  dims: SlideDims;
  slides: DeckSlide[];
  createdAt: number;
  updatedAt: number;
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
