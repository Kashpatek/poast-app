// Carousel 2.0 · forward contracts (Slice 1 = typed seams only).
//
// These are the interfaces later slices plug into. Bodies throw so the seams
// exist and type-check against the REAL upstream types today, but nothing is
// wired yet. Do not call these in Slice 1.
//
// Type-only imports keep this module free of runtime coupling to the client
// components / editor they reference.

import type { CatalogProduct, CatalogTemplate, CatalogField } from "./types";
import type { DesignTemplate } from "../../design-studio/canvas-editor/templates";
import type { VerbatimDraft } from "../../carousel-verbatim";
import type { CoverTemplateId } from "../../carousel-covers";
import type { LLMProviderName } from "../../shared-constants";
import type * as fabric from "fabric";

const NOT_IMPL = (phase: string) => new Error(`Carousel 2.0: not implemented — ${phase}`);

// (a) Catalog → Fabric editor ------------------------------------------------
// A product becomes a DesignTemplate the existing design-studio canvas can
// load via canvas.loadFromJSON, and/or a set of Fabric objects to drop in.
// Field locators survive so the editor knows which object is "headline".
export function productToDesignTemplate(_product: CatalogProduct): DesignTemplate {
  throw NOT_IMPL("editor bridge (productToDesignTemplate) — editor slice");
}

export function productToFabricObjects(
  _product: CatalogProduct
): Promise<fabric.FabricObject[]> {
  throw NOT_IMPL("editor bridge (productToFabricObjects) — editor slice");
}

// (b) AI auto-fill -----------------------------------------------------------
// Given a product's fields + a brief, the AI returns values keyed by field
// name. Wires to a future action:"autofill" in /api/carousel.
export interface AutofillRequest {
  productId: string;
  fields: CatalogField[];
  brief: string;
  provider?: LLMProviderName;
}
export interface AutofillResult {
  values: Record<string, string>; // field.name -> value
}
export function autofillProduct(_req: AutofillRequest): Promise<AutofillResult> {
  throw NOT_IMPL("AI auto-fill (autofillProduct) — AI slice");
}

// (c) Verbatim-as-a-function -------------------------------------------------
// Maps an existing verbatim wizard draft onto a template's fields by role
// (title→headline, subtitle→subhead, topic→eyebrow, image→image).
export function verbatimDraftToFieldValues(
  _draft: VerbatimDraft,
  _template: CatalogTemplate
): Record<string, string> {
  throw NOT_IMPL("verbatim bridge (verbatimDraftToFieldValues) — verbatim slice");
}

// (d) Cover facelift ---------------------------------------------------------
// Re-express today's SVG cover templates as catalog templates via the parser,
// proving the catalog absorbs existing covers with no bespoke code.
export function coverTemplateToCatalogTemplate(_id: CoverTemplateId): CatalogTemplate {
  throw NOT_IMPL("cover facelift (coverTemplateToCatalogTemplate) — cover slice");
}
