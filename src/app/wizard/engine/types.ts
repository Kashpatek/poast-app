// ═══════════════════════════════════════════════════════════════════════════
// Wizard engine · types + constants + pure slide helpers
//
// VERBATIM extraction from src/app/carousel.tsx (SA CAROUSEL v3.1). The
// monolith stays untouched; this module re-exports the proven data model so
// the new wizard can import it without pulling in 3,500 lines of UI.
// Source line references are against carousel.tsx as of 2026-07-06.
// ═══════════════════════════════════════════════════════════════════════════

import type { CoverTemplateId } from "../../carousel-covers";
export type { CoverTemplateId } from "../../carousel-covers";

// ═══ TYPES ═══ (carousel.tsx:28-105)
export type ThemeKey = "general" | "internal" | "external" | "capital";

export interface Slide {
  type: string;
  title?: string;
  subtitle?: string;
  bodyText?: string;
  imageUrl?: string;
  imageUrl2?: string;
  imageHeight?: number;
  imagePosition?: string;
  imagePosition2?: string;
  imageFit?: string;
  bodySize: number;
  titleSize: number;
  subtitleSize: number;
  captionSize: number;
  caption?: string;
  caption2?: string;
  ctaText?: string;
  ctaPosition?: string;
  position: number;
  id: string;
  inverted?: boolean;
  subtitleLength?: number;
  _carouselTitle?: string;
  // C1 additions
  titleAnchor?: "top" | "center"; // default "top"
  titleMarginTop?: number; // default 80 (px in 1080x1350 space)
  bodyAnchor?: "top" | "center"; // default "top" for body slides; for position=4, "top"
  coverTemplate?: CoverTemplateId;
  coverAccent?: string;
  coverShowSub?: boolean;
  coverDual?: boolean;
  coverLogoPos?: "left" | "right"; // which corner the SA logo sits in (default right)
  coverTopic?: string;             // accent category label (replaces the old "ISSUE 24" meta)
  coverTitleScale?: number;        // manual title-size multiplier (1 = template default)
  coverUpper?: boolean;            // uppercase cover title (undefined = true, V1 default)
  coverTight?: boolean;            // tight title letter-spacing (undefined = false, V1 default)
  // Unique mode additions (spec 9.4) — all optional, additive, persist through
  // existing draft + archive paths untouched.
  uniqueKind?: "cover" | "stat" | "chart" | "quote" | "closer";
  uniqueDirection?: "E" | "C" | "S";
  uniqueBackdrop?: string;      // one of the 9 backdrop ids in spec 9.1
  uniqueKicker?: string;
  uniqueAccentWord?: string;    // exact word in title to accent (first match)
  uniqueStats?: { label: string; value: string; delta?: string; dir?: "up" | "down" | "flat" }[];
  uniqueChart?: { label: string; unit?: string; points: number[]; xLabels: string[] };
  // Library mode additions (design-system handoff 2026-07-13, spec
  // docs/LIBRARY-INTEGRATION.md) — all optional, additive; slide.type is
  // "library" for these. libraryBg is the RESOLVED backdrop key ("01".."36"):
  // the store recomputes the whole chain (seed rotation + no-consecutive-
  // repeat + overrides) whenever topic/overrides/order change, so renderers
  // stay pure per-slide.
  libraryTemplate?: number;                   // templates.json idx (stable global id)
  libraryFills?: Record<string, string>;      // field name -> populated text
  librarySlotImages?: Record<string, string>; // slot name -> image URL (proxied)
  libraryBg?: string;                         // resolved backdrop key "01".."36"
  libraryBgOverride?: string | null;          // user-finalized key; wins over assignment
  libraryPalette?: "blend" | "amber" | "cobalt" | "green"; // category tint applied to the bg at compose (unset = blend, the baked v1 identity)
  // Platform v3 additions (2026-07-14) — all optional, additive:
  libraryBgFlip?: boolean; // infinity mode: mirror the bg on odd positions (seamless strip)
  // Native infinity (v3.1): when libraryBg is an "n:<family>" key the store
  // stamps the render params here — compose windows slide idx of an n-slide
  // continuous strip generated from seed. Absent on baked-bg slides.
  libraryBgNative?: { fam: string; seed: number; idx: number; n: number };
  librarySlotFit?: Record<string, "cover" | "contain">; // slot name -> FILL (crop) | FIT (letterbox)
  libraryLayout?: Record<string, { size?: number; wMul?: number; lines?: number; dx?: number; dy?: number }>; // field -> text-fit panel overrides (dx/dy = px nudge in template space, may be negative)
}

export interface GeneratedSlide {
  type: string;
  title?: string;
  subtitle?: string;
  body_text?: string;
  image_url?: string;
  subtext?: string;
}

export interface Variant {
  label?: string;
  topic?: string;
  slides: GeneratedSlide[];
}

export interface BRollImageAsset {
  id: string;
  type: string;
  url: string;
  thumbnail?: string;
  filename?: string;
  description?: string;
  category?: string;
}

export interface CarouselState {
  category: ThemeKey;
  url?: string;
  text?: string;
  mode: string;
  pageCount: number;
  fileName?: string;
  articleImages?: string[];
  selectedArticleImage?: string | null;
  fetchingImages?: boolean;
  // "ai" (default) — LLM rewrites/structures the input into 3 variants.
  // "verbatim" — analyst's text is laid out across slides unchanged.
  generationMode?: "ai" | "verbatim";
}

// (carousel.tsx:1868-1874)
export interface CaptionOption {
  label?: string;
  instagram?: { caption?: string; hashtags?: string[] };
  tiktok?: { caption?: string; hashtags?: string[] };
  shorts?: { title?: string; hashtags?: string[] };
  [key: string]: unknown;
}

// ═══ THEME / BACKDROP MAPPING ═══ (carousel.tsx:107-147)
export var THEMES: Record<ThemeKey, { prefix: string; label: string; color: string; desc: string }> = {
  general:  { prefix: "YB", label: "General",  color: "#D4A853", desc: "Industry news, trends, analysis" },
  internal: { prefix: "Y",  label: "Internal", color: "#F7B041", desc: "SA original research and findings" },
  external: { prefix: "B",  label: "External", color: "#0B86D1", desc: "Third-party content with SA commentary" },
  capital:  { prefix: "G",  label: "Capital",  color: "#2EAD8E", desc: "Financial and investment analysis" },
};

export function getBackdropUrl(theme: ThemeKey, position: number) {
  return "/backdrops/" + THEMES[theme].prefix + position + ".jpg";
}

export function getSlidePositions(count: number) {
  if (count === 1) return [4];
  if (count === 2) return [1, 4];
  if (count === 3) return [1, 2, 4];
  var positions = [1];
  for (var i = 1; i < count - 1; i++) {
    positions.push(i % 2 === 1 ? 2 : 3);
  }
  positions.push(4);
  return positions;
}

export function getSlideType(position: number) {
  if (position === 1) return "cover";
  if (position === 4) return "body"; // closer is body layout, no arrow is baked in bg
  return "body";
}

// Canvas dimensions at full resolution
export var FULL_W = 1080;
export var FULL_H = 1350;
// Display scale: ~450px wide
export var DISPLAY_W = 450;
export var DISPLAY_H = 562; // 450 * (1350/1080)
export var SCALE = DISPLAY_W / FULL_W; // ~0.4167

// Margins at full res: 7% = ~76px
export var MARGIN_X = 76;
export var MARGIN_Y = 95;

// ═══ VERBATIM SPLITTER ═══ (carousel.tsx:633-690)
// Verbatim splitter — preserves the analyst's writing untouched. Splits on
// paragraph breaks first; falls back to line breaks for unformatted blobs.
// Groups or splits chunks so the slide count matches the user's pick.
export function splitVerbatim(text: string, pageCount: number): GeneratedSlide[] {
  var raw = String(text || "").trim();
  if (!raw) return [];
  var rawChunks = raw.split(/\n\s*\n|\n-{3,}\n/).map(function(s) { return s.trim(); }).filter(Boolean);
  if (rawChunks.length === 1) {
    rawChunks = raw.split(/\n+/).map(function(s) { return s.trim(); }).filter(Boolean);
  }
  if (!rawChunks.length) rawChunks = [raw];

  var target = pageCount && pageCount > 0
    ? Math.max(1, pageCount)
    : Math.min(7, Math.max(3, rawChunks.length));

  var chunks: string[] = rawChunks.slice();
  if (chunks.length > target) {
    var grouped: string[] = [];
    var groupSize = Math.ceil(chunks.length / target);
    for (var i = 0; i < chunks.length; i += groupSize) {
      grouped.push(chunks.slice(i, i + groupSize).join("\n\n"));
    }
    chunks = grouped.slice(0, target);
  } else if (chunks.length < target) {
    var safety = 0;
    while (chunks.length < target && safety++ < 64) {
      var longestIdx = 0;
      for (var j = 0; j < chunks.length; j++) {
        if (chunks[j].length > chunks[longestIdx].length) longestIdx = j;
      }
      var longest = chunks[longestIdx];
      var sentences = longest.match(/[^.!?]+[.!?]+(\s|$)|\S[^.!?]*$/g);
      if (!sentences || sentences.length < 2) break;
      var mid = Math.ceil(sentences.length / 2);
      var first = sentences.slice(0, mid).join("").trim();
      var second = sentences.slice(mid).join("").trim();
      if (!first || !second) break;
      chunks.splice(longestIdx, 1, first, second);
    }
  }

  // Cover title cap — cut at the last word boundary before 140 chars and
  // push the dropped tail into the subtitle so no words vanish. Ellipsis is
  // added only when the title was truncated mid-thought (tail preserved).
  function capCoverTitle(line: string, restText: string): { title: string; subtitle: string } {
    var MAX_TITLE = 140;
    if (line.length <= MAX_TITLE) return { title: line, subtitle: restText };
    var cut = line.lastIndexOf(" ", MAX_TITLE);
    if (cut <= 0) cut = MAX_TITLE; // no word boundary — hard cut, tail still preserved
    var title = line.slice(0, cut).trim();
    var tail = line.slice(cut).trim();
    var subtitle = tail ? (restText ? tail + "\n" + restText : tail) : restText;
    if (tail && !/[.!?…]$/.test(title)) title += "…";
    return { title: title, subtitle: subtitle };
  }

  var slides: GeneratedSlide[] = [];
  for (var k = 0; k < chunks.length; k++) {
    var c = chunks[k];
    if (k === 0 && chunks.length > 1) {
      var firstLine = (c.split(/\n/)[0] || c).trim();
      var rest = c.slice(firstLine.length).trim();
      var cover = capCoverTitle(firstLine, rest);
      slides.push({ type: "COVER", title: cover.title, subtitle: cover.subtitle });
    } else if (k === chunks.length - 1 && chunks.length > 1) {
      slides.push({ type: "BODY_FINAL", body_text: c });
    } else if (chunks.length === 1) {
      var firstLine2 = (c.split(/\n/)[0] || c).trim();
      var rest2 = c.slice(firstLine2.length).trim();
      var cover2 = capCoverTitle(firstLine2, rest2);
      slides.push({ type: "COVER", title: cover2.title, subtitle: cover2.subtitle });
    } else {
      slides.push({ type: k % 2 === 1 ? "BODY_A" : "BODY_B", body_text: c });
    }
  }
  return slides;
}

// ═══ CONVERT API RESPONSE TO EDITOR SLIDES ═══ (carousel.tsx:3176-3211)
export function apiSlidesToEditorSlides(apiSlides: GeneratedSlide[], slideCount: number): Slide[] {
  var positions = getSlidePositions(slideCount);
  return apiSlides.map(function(apiSl, i) {
    var pos = positions[i] || (i === apiSlides.length - 1 ? 4 : 2);
    var type = "body";
    if (pos === 1) type = "cover";
    else if (apiSl.type === "BODY_IMAGE") type = "image_text";
    else if (apiSl.type === "BODY_LARGE_IMAGE") type = "large_image";
    // else body (for BODY_A, BODY_B, BODY_FINAL, CLOSER)

    // Convert bullet points to paragraph breaks in body text
    var bodyText = apiSl.body_text || "";
    bodyText = bodyText.replace(/^\s*[-*]\s+/gm, "\n").replace(/^\s*\d+[.)]\s+/gm, "\n").replace(/\n{3,}/g, "\n\n").trim();

    return {
      id: "slide-" + i,
      position: pos,
      type: type,
      title: apiSl.title || "",
      titleSize: 74,
      subtitle: apiSl.subtitle || "",
      subtitleSize: 34,
      bodyText: bodyText,
      bodySize: 28,
      imageUrl: apiSl.image_url || "",
      imageHeight: type === "cover" ? 46 : type === "image_text" ? 50 : type === "large_image" ? 72 : 45,
      imagePosition: "center",
      imageFit: "cover",
      caption: apiSl.subtext || "",
      captionSize: 18,
      titleAnchor: "top",
      titleMarginTop: 80,
      bodyAnchor: "top",
    } as Slide;
  });
}
