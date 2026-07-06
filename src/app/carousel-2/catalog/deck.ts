// Carousel 2.0 · deck engine (make-flow).
//
// The multi-slide layer: assemble catalog templates + backgrounds into an
// ordered Deck, edit each slide's fields, render each slide to a self-contained
// SVG, and (via export.ts) batch-export to PNGs — the carousel-2 equivalent of
// the production carousel's slides[] + downloadAll().
//
// The CRUD here is PURE + immutable (safe from anywhere). renderDeckSlideSvg
// applies field values through fill.ts (DOMParser) so it is CLIENT-ONLY, like
// the composer's live preview. Rendering reuses the shipped composition
// renderer so a slide is byte-for-byte WYSIWYG with the composer + PNG export.

import {
  SLIDE_DIMS,
  type CatalogBackground,
  type CatalogProduct,
  type CatalogTemplate,
  type Deck,
  type DeckSlide,
  type DesignComposition,
  type SlideDims,
  type SlideRole,
} from "./types";
import { renderCompositionSvg } from "./composition";
import { applyFieldValues } from "./fill";

type Getter = (id: string) => CatalogProduct | undefined;

// Monotonic-ish id; Date.now + a per-module counter avoids collisions when
// several slides are created in the same millisecond (add/duplicate loops).
let seq = 0;
function uid(prefix: string): string {
  seq += 1;
  return `${prefix}-${Date.now().toString(36)}-${seq.toString(36)}`;
}

// A new slide carries NO field values — it renders the template's OWN authored
// SVG verbatim (tspans, exact positions, demo copy all intact). A value is added
// only when the user edits that field, so an untouched slide is byte-faithful to
// how the designer authored the overlay and is never degraded by the fill
// re-serialize (which collapses multi-line <tspan> text into one line).
export function makeSlide(overlay: CatalogTemplate, role: SlideRole, background?: CatalogBackground): DeckSlide {
  return {
    id: uid("slide"),
    role,
    overlayId: overlay.id,
    backgroundId: background?.id,
    values: {},
    assignments: (overlay.slots || []).map((s) => ({ slotId: s.id })),
  };
}

export function createDeck(title: string, slides: DeckSlide[] = []): Deck {
  const now = Date.now();
  return {
    id: uid("deck"),
    title: title || "Untitled carousel",
    dims: SLIDE_DIMS,
    slides,
    createdAt: now,
    updatedAt: now,
  };
}

// ── slide CRUD (immutable) ────────────────────────────────────────────────────

function touch(deck: Deck, slides: DeckSlide[]): Deck {
  return { ...deck, slides, updatedAt: Date.now() };
}

// Insert a slide. A body slide lands before the trailing closer (so bodies stack
// between cover and closer, like getSlidePositions); anything else appends.
export function addSlide(deck: Deck, slide: DeckSlide): Deck {
  const slides = deck.slides.slice();
  if (slide.role === "body") {
    const closerIdx = slides.findIndex((s) => s.role === "closer");
    if (closerIdx !== -1) {
      slides.splice(closerIdx, 0, slide);
      return touch(deck, slides);
    }
  }
  slides.push(slide);
  return touch(deck, slides);
}

export function duplicateSlide(deck: Deck, slideId: string): Deck {
  const idx = deck.slides.findIndex((s) => s.id === slideId);
  if (idx === -1) return deck;
  const src = deck.slides[idx];
  const copy: DeckSlide = {
    ...src,
    id: uid("slide"),
    values: { ...src.values },
    assignments: src.assignments.map((a) => ({ ...a })),
  };
  const slides = deck.slides.slice();
  slides.splice(idx + 1, 0, copy);
  return touch(deck, slides);
}

// Remove a slide — but never leave the deck empty (a carousel needs ≥1 slide).
export function removeSlide(deck: Deck, slideId: string): Deck {
  if (deck.slides.length <= 1) return deck;
  const slides = deck.slides.filter((s) => s.id !== slideId);
  return slides.length === deck.slides.length ? deck : touch(deck, slides);
}

export function moveSlide(deck: Deck, slideId: string, dir: -1 | 1): Deck {
  const idx = deck.slides.findIndex((s) => s.id === slideId);
  if (idx === -1) return deck;
  const j = idx + dir;
  if (j < 0 || j >= deck.slides.length) return deck;
  const slides = deck.slides.slice();
  const [s] = slides.splice(idx, 1);
  slides.splice(j, 0, s);
  return touch(deck, slides);
}

export function updateSlide(deck: Deck, slideId: string, patch: Partial<DeckSlide>): Deck {
  let changed = false;
  const slides = deck.slides.map((s) => {
    if (s.id !== slideId) return s;
    changed = true;
    return { ...s, ...patch };
  });
  return changed ? touch(deck, slides) : deck;
}

// Set one overlay field's value on one slide.
export function setSlideValue(deck: Deck, slideId: string, fieldName: string, value: string): Deck {
  return updateSlide(deck, slideId, {
    values: { ...(deck.slides.find((s) => s.id === slideId)?.values || {}), [fieldName]: value },
  });
}

export function setSlideBackground(deck: Deck, slideId: string, backgroundId?: string): Deck {
  return updateSlide(deck, slideId, { backgroundId });
}

// Swap a slide's overlay template. Re-seed values from the new template so its
// demo copy shows, but carry over any prior value whose field name still exists.
export function setSlideOverlay(deck: Deck, slideId: string, overlay: CatalogTemplate): Deck {
  const slide = deck.slides.find((s) => s.id === slideId);
  const prior = slide?.values || {};
  // Carry over ONLY values the user actually set whose field name still exists in
  // the new template; every other field falls back to the new template's authored
  // default (rendered verbatim), so a swap never injects/degrades demo copy.
  const values: Record<string, string> = {};
  overlay.fields.forEach((f) => {
    if (typeof prior[f.name] === "string") values[f.name] = prior[f.name];
  });
  return updateSlide(deck, slideId, {
    overlayId: overlay.id,
    values,
    assignments: (overlay.slots || []).map((s) => ({ slotId: s.id })),
  });
}

export function renameDeck(deck: Deck, title: string): Deck {
  return { ...deck, title, updatedAt: Date.now() };
}

// ── render ────────────────────────────────────────────────────────────────────

function slideToComposition(slide: DeckSlide, dims: SlideDims): DesignComposition {
  const now = Date.now();
  return {
    id: slide.id,
    title: "",
    dims,
    backgroundId: slide.backgroundId,
    overlayId: slide.overlayId,
    assignments: slide.assignments,
    createdAt: now,
    updatedAt: now,
  };
}

// Render one slide to a self-contained SVG: the overlay with its field values
// applied, stacked over the background + any slot widgets. Reuses the shipped
// composition renderer by handing it a getter that returns a FILLED clone of the
// overlay product — so the deck preview + export match the composer exactly.
export function renderDeckSlideSvg(slide: DeckSlide, get: Getter, dims: SlideDims = SLIDE_DIMS): string {
  const overlay = get(slide.overlayId) as CatalogTemplate | undefined;
  const wrapped: Getter = (id) => {
    if (overlay && id === overlay.id) {
      return { ...overlay, svg: applyFieldValues(overlay.svg, overlay.fields, slide.values) };
    }
    return get(id);
  };
  return renderCompositionSvg(slideToComposition(slide, dims), wrapped);
}

// Render every slide (order preserved) — the input to exportDeckPngs.
export function renderDeckSvgs(deck: Deck, get: Getter): string[] {
  return deck.slides.map((s) => renderDeckSlideSvg(s, get, deck.dims));
}
