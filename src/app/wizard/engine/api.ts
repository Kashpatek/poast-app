// ═══════════════════════════════════════════════════════════════════════════
// Wizard engine · typed client for POST /api/carousel and /api/db
//
// Request shapes are VERBATIM copies of the monolith's call sites
// (carousel.tsx + carousel-verbatim.tsx, cited per function). Two deliberate
// bug fixes vs V1, both flagged inline:
//   BUG FIX #1 — generateImage omits `provider` when the user's image
//     provider is "imagen": /api/carousel's zod schema only allows
//     provider ∈ {claude, gemini, grok} (route.ts:86), so V1's
//     BRollPickerModal sending provider:"imagen" 400s ("Invalid input").
//     Omitting the key hits the server default, which IS Imagen
//     (route.ts:418: imgProvider === "grok" ? "grok" : "imagen").
//   BUG FIX #2 — saveArchive accepts an optional existing id so re-saves
//     UPSERT the same row instead of always minting a new carousel-<ts> row.
// ═══════════════════════════════════════════════════════════════════════════

import { getSurfaceProvider, getPreferredProvider } from "../../shared-constants";
import { COVER_TOPICS } from "../../carousel-covers";
import type { Slide, ThemeKey, Variant, CaptionOption, GeneratedSlide, BRollImageAsset } from "./types";
import type { UniqueContent } from "./unique/build";

export const CAROUSEL_SURFACE = "carousel";

// Resolved provider for every /api/carousel POST. Reads localStorage so
// it stays in sync with the ProviderChips chip selection without each
// call site needing to subscribe to React state. (carousel.tsx:19-21)
export function carouselProvider(): "claude" | "gemini" | "grok" | "openai" {
  return getSurfaceProvider(CAROUSEL_SURFACE) || getPreferredProvider();
}

// Shared POST helper — same fetch shape as every monolith call site, with
// the {error} envelope surfaced as a thrown Error (the monolith toasts
// `d.error || fallback`; callers here catch and do the same).
async function postCarousel<T>(payload: Record<string, unknown>, fallbackError: string): Promise<T> {
  var r = await fetch("/api/carousel", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  var d = await r.json();
  if (!r.ok || (d && d.error)) throw new Error((d && d.error) || fallbackError);
  return d as T;
}

// ─── generate (carousel.tsx:3349-3376) ───
// One LLM call → 3 structurally different slide-deck variants.
export async function generateCarousel(opts: {
  text?: string;
  url?: string;
  category: ThemeKey | string;
  mode: string;
  pageCount: number;
  imageUrls?: string[];
}): Promise<Record<string, Variant>> {
  var d = await postCarousel<{ variants?: Record<string, Variant> }>({
    action: "generate",
    text: opts.text,
    url: opts.url,
    category: opts.category,
    mode: opts.mode,
    pageCount: opts.pageCount || 4,
    // Monolith filters out data: URLs before sending (carousel.tsx:3359).
    imageUrls: (opts.imageUrls || []).filter(function(u) { return u && !u.startsWith("data:"); }),
    provider: carouselProvider(),
  }, "Generation failed");
  if (!d.variants) throw new Error("No valid variants returned.");
  return d.variants;
}

// ─── unique (design spec §9.5) ───
// One LLM call → structured UniqueContent (cover + sections + closer).
// The route returns { content: {...} } (the UniqueContent envelope); like
// "generate", it does not fetch the url server-side, so send the article
// text and let url ride along as a source reference.
export async function generateUnique(opts: {
  text?: string;
  url?: string;
  category: ThemeKey | string;
  pageCount: number;
}): Promise<UniqueContent> {
  var d = await postCarousel<{ content?: UniqueContent; ts?: number }>({
    action: "unique",
    text: opts.text,
    url: opts.url,
    category: opts.category,
    pageCount: opts.pageCount,
    provider: carouselProvider(),
  }, "Unique generation failed");
  if (!d || !d.content) throw new Error("No unique content returned.");
  return d.content;
}

// ─── editor slides → API-vocabulary slides (carousel.tsx:1900-1917) ───
export function buildApiSlides(slides: Slide[]) {
  return slides.map(function(sl: Slide) {
    // Unique slides (design spec §9.4): fold the unique fields into the API
    // vocabulary so caption generation sees the real content. Cover keeps
    // title/subtitle; every other kind combines headline + body + stat
    // lines + chart label into body_text.
    if (sl.type === "unique") {
      if (sl.uniqueKind === "cover") {
        return {
          type: "COVER",
          title: sl.title || "",
          subtitle: sl.bodyText || "",
          body_text: "",
          subtext: "",
          image_url: "",
        };
      }
      var parts: string[] = [];
      if (sl.title) parts.push(sl.title);
      if (sl.bodyText) parts.push(sl.bodyText);
      (sl.uniqueStats || []).forEach(function(st) {
        var line = st.label + ": " + st.value;
        if (st.delta) line += " (" + st.delta + ")";
        parts.push(line);
      });
      if (sl.uniqueChart && sl.uniqueChart.label) parts.push("Chart: " + sl.uniqueChart.label);
      if (sl.uniqueKind === "closer" && sl.ctaText) parts.push(sl.ctaText);
      return {
        type: sl.uniqueKind === "closer" ? "BODY_FINAL" : "BODY_A",
        title: "",
        subtitle: "",
        body_text: parts.join("\n"),
        subtext: "",
        image_url: "",
      };
    }
    var apiType = "BODY_A";
    if (sl.type === "cover") apiType = "COVER";
    else if (sl.position === 4) apiType = "BODY_FINAL";
    else if (sl.type === "image_text") apiType = "BODY_IMAGE";
    else if (sl.type === "large_image") apiType = "BODY_LARGE_IMAGE";
    else if (sl.position === 3) apiType = "BODY_B";
    return {
      type: apiType,
      title: sl.title || "",
      subtitle: sl.subtitle || "",
      body_text: sl.bodyText || "",
      subtext: sl.caption || "",
      image_url: sl.imageUrl || "",
    };
  });
}

// ─── caption (carousel.tsx:1919-1944) ───
// 3 caption options × Instagram/TikTok/Shorts. `slides` are API-vocabulary
// slides — run editor slides through buildApiSlides() first.
export async function generateCaptions(opts: {
  slides: GeneratedSlide[] | ReturnType<typeof buildApiSlides>;
  sourceUrl?: string;
  variantLabel?: string;
  theme: ThemeKey | string;
  extraContext?: string;
}): Promise<CaptionOption[]> {
  var d = await postCarousel<{ captionOptions?: CaptionOption[] }>({
    action: "caption",
    slides: opts.slides,
    sourceUrl: opts.sourceUrl || "",
    variantLabel: opts.variantLabel || "",
    theme: opts.theme,
    extraContext: opts.extraContext || "",
    provider: carouselProvider(),
  }, "Caption generation failed");
  if (d.captionOptions && Array.isArray(d.captionOptions) && d.captionOptions.length > 0) {
    return d.captionOptions;
  }
  return [];
}

// ─── rewrite (call sites carousel.tsx:1738 and :1768) ───
// direction "regenerate-title" + targetLength "punchy"  → new cover title
// direction "shorten"|"lengthen" + targetLength label   → resized subtitle
export async function rewriteText(opts: {
  text: string;
  direction: "regenerate-title" | "shorten" | "lengthen" | string;
  targetLength: string;
}): Promise<string> {
  var d = await postCarousel<{ text?: string }>({
    action: "rewrite",
    text: opts.text,
    direction: opts.direction,
    targetLength: opts.targetLength,
    provider: carouselProvider(),
  }, "Rewrite failed");
  if (!d.text) throw new Error("Rewrite returned no text.");
  return d.text;
}

// ─── fetchImages (carousel.tsx:858; sends NO provider, like the monolith) ───
export async function fetchArticleImages(url: string): Promise<string[]> {
  var d = await postCarousel<{ images?: string[] }>({
    action: "fetchImages",
    url: url,
  }, "Image fetch failed");
  return d.images || [];
}

// ─── generateImage (call sites carousel.tsx:713-723, :1116-1127;
//     carousel-verbatim.tsx:567-579) ───
// BUG FIX #1: when the user's image provider is "imagen", OMIT the provider
// key entirely — the server defaults to Imagen (route.ts:418) and its zod
// schema rejects provider:"imagen" with a 400 (route.ts:86). Only send
// provider:"grok" when Grok is explicitly chosen. (V1's BRollPickerModal
// always sent the raw value, so Imagen generation 400'd.)
export async function generateImage(opts: {
  prompt?: string;               // free-text prompt (maps to slideText, like BRollPickerModal)
  customPrompt?: string;         // user-edited prompt used verbatim as the subject (verbatim wizard)
  slideContext?: { title?: string; subtitle?: string; bodyText?: string; type?: string };
  style?: string;                // editorial | cinematic | photorealistic | dataviz | abstract
  category?: string;
  provider?: "imagen" | "grok";
}): Promise<{ images: string[]; provider?: string; fellBackTo?: string }> {
  var payload: Record<string, unknown> = {
    action: "generateImage",
    title: opts.slideContext ? opts.slideContext.title : undefined,
    subtitle: opts.slideContext ? opts.slideContext.subtitle : undefined,
    slideType: opts.slideContext ? opts.slideContext.type : undefined,
    slideText: opts.prompt !== undefined ? opts.prompt : (opts.slideContext ? opts.slideContext.bodyText : undefined),
    style: opts.style,
    category: opts.category,
    customPrompt: opts.customPrompt,
  };
  if (opts.provider === "grok") payload.provider = "grok"; // BUG FIX #1: never send "imagen"
  var d = await postCarousel<{ images?: string[]; provider?: string; fellBackTo?: string }>(payload, "Generate failed");
  return { images: (d.images || []), provider: d.provider, fellBackTo: d.fellBackTo };
}

// ─── verbatim-titles (carousel-verbatim.tsx:445-476) ───
// Returns title/subtitle pairs, with back-compat parsing for the legacy
// titles[] payload shape.
export async function verbatimTitles(text: string, category: ThemeKey | string): Promise<{ title: string; subtitle: string }[]> {
  var d = await postCarousel<{ pairs?: { title: string; subtitle: string }[]; titles?: string[] }>({
    action: "verbatim-titles",
    text: text,
    category: category,
    provider: carouselProvider(),
  }, "Failed to generate titles.");
  var pairs = (d.pairs || []) as { title: string; subtitle: string }[];
  if (!pairs.length) {
    // Back-compat for old payload shape.
    var legacy = (d.titles || []) as string[];
    pairs = legacy.map(function(t) { return { title: t, subtitle: "" }; });
  }
  if (!pairs.length) throw new Error("No titles returned. Try again.");
  return pairs;
}

// ─── verbatim-subtitle (carousel-verbatim.tsx:478-505) ───
export async function verbatimSubtitle(title: string, text: string, category: ThemeKey | string): Promise<string[]> {
  var d = await postCarousel<{ subtitles?: string[]; subtitle?: string }>({
    action: "verbatim-subtitle",
    text: text || "",
    title: title,
    category: category,
    provider: carouselProvider(),
  }, "Failed to suggest subtitle.");
  var subs = (d.subtitles || []) as string[];
  if (!subs.length && d.subtitle) subs = [String(d.subtitle)];
  if (!subs.length) throw new Error("No subtitles returned. Try again.");
  return subs;
}

// ─── verbatim-image-prompt (carousel-verbatim.tsx:535-560) ───
// Call site also ships the first 1500 chars of the paste text for context.
export async function verbatimImagePrompt(title: string, subtitle: string, category: ThemeKey | string, text?: string): Promise<string> {
  var d = await postCarousel<{ prompt?: string }>({
    action: "verbatim-image-prompt",
    title: title,
    subtitle: subtitle,
    category: category,
    text: (text || "").slice(0, 1500),
    provider: carouselProvider(),
  }, "Failed to suggest a prompt.");
  if (!d.prompt) throw new Error("No prompt returned.");
  return String(d.prompt);
}

// ─── verbatim-topic (carousel-verbatim.tsx:507-533; also carousel.tsx:1640) ───
// Ships the canonical COVER_TOPICS list and the first 4000 chars of text,
// exactly like the wizard call site.
export async function verbatimTopic(title: string, text: string): Promise<string> {
  var d = await postCarousel<{ topic?: string }>({
    action: "verbatim-topic",
    title: title,
    text: (text || "").slice(0, 4000),
    topics: COVER_TOPICS,
    provider: carouselProvider(),
  }, "Failed to categorize.");
  if (!d.topic) throw new Error("No topic returned. Pick one or type your own.");
  return String(d.topic);
}

// ═══════════════════════════════════════════════════════════════════════════
// /api/db — archive + shared B-roll library
// ═══════════════════════════════════════════════════════════════════════════

export interface ArchiveRow {
  id: string;
  name?: string;
  type?: string;
  created_at?: string;
  data?: Record<string, unknown>;
}

async function dbJson<T>(res: Response, fallbackError: string): Promise<T> {
  var d = await res.json();
  if (!res.ok || (d && d.error)) throw new Error((d && d.error) || fallbackError);
  return d as T;
}

// ─── list (carousel.tsx:3272-3284) ───
// GET orders by created_at server-side, but V1 re-sorts by data.timestamp
// desc client-side — kept verbatim.
export async function listArchive(): Promise<ArchiveRow[]> {
  var r = await fetch("/api/db?table=projects&type=carousel-archive");
  var res = await dbJson<{ data?: ArchiveRow[] }>(r, "Failed to load archive.");
  var items = (res.data || []);
  items.sort(function(a: { data?: Record<string, unknown> }, b: { data?: Record<string, unknown> }) {
    var ta = a.data && a.data.timestamp ? new Date(a.data.timestamp as string).getTime() : 0;
    var tb = b.data && b.data.timestamp ? new Date(b.data.timestamp as string).getTime() : 0;
    return tb - ta;
  });
  return items;
}

// ─── save (carousel.tsx:2820-2831) ───
// Same nested POST shape as ExportStep.handleSaveArchive. BUG FIX #2: V1
// always minted "carousel-" + Date.now(), so every re-save of an opened
// carousel created a brand-new archive row. Pass the existing row's id to
// UPSERT it instead; omit it for a new save (default id is unchanged).
export async function saveArchive(row: {
  id?: string;
  name: string;
  data: Record<string, unknown>;
}): Promise<{ id: string }> {
  var id = row.id || "carousel-" + Date.now(); // BUG FIX #2
  var r = await fetch("/api/db", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      table: "projects",
      data: {
        id: id,
        type: "carousel-archive",
        name: row.name,
        data: row.data,
      },
    }),
  });
  await dbJson<{ data?: unknown }>(r, "Failed to save archive.");
  return { id: id };
}

// ─── rename (carousel.tsx:3256-3265) ───
// Top-level row-field shape (id/type/name beside data), exactly as
// ArchiveView sends it.
export async function renameArchive(id: string, name: string, data?: Record<string, unknown>): Promise<void> {
  var r = await fetch("/api/db", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      table: "projects",
      id: id,
      type: "carousel-archive",
      name: name,
      data: data || {},
    }),
  });
  await dbJson<{ data?: unknown }>(r, "Failed to rename.");
}

// ─── delete (carousel.tsx:3239-3245) ───
export async function deleteArchive(id: string): Promise<void> {
  var r = await fetch("/api/db", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ table: "projects", id: id }),
  });
  await dbJson<{ success?: boolean }>(r, "Failed to delete.");
}

// ─── B-roll library (carousel.tsx:179-191 and :1092-1104) ───
// One shared row: id "broll-master", type "broll-asset", data.assets[].
// Note: the V1 pickers filter to a.type === "image" for display — filtering
// is left to callers here so a load → save round-trip can't drop non-image
// assets from the shared row.
export async function loadBrollAssets(): Promise<BRollImageAsset[]> {
  var r = await fetch("/api/db?table=projects");
  var res = await dbJson<{ data?: Array<{ type: string; id: string; data?: { assets?: BRollImageAsset[] } }> }>(r, "Failed to load B-roll library.");
  if (res.data && res.data.length > 0) {
    var row = res.data.find(function(rw) { return rw.type === "broll-asset" && rw.id === "broll-master"; });
    if (row && row.data && row.data.assets) return row.data.assets;
  }
  return [];
}

export async function saveBrollAssets(assets: BRollImageAsset[]): Promise<void> {
  var r = await fetch("/api/db", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      table: "projects",
      data: {
        id: "broll-master",
        type: "broll-asset",
        name: "B-Roll Library",
        data: { assets: assets },
      },
    }),
  });
  await dbJson<{ data?: unknown }>(r, "Failed to save B-roll library.");
}
