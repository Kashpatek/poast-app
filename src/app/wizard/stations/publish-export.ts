// ═══════════════════════════════════════════════════════════════════════════
// SA Carousel 2.0 · PUBLISH station helpers (non-JSX)
//
// Naming conventions are VERBATIM V1 (carousel.tsx ExportStep):
//   dateStamp  — carousel.tsx:2643
//   filePrefix — carousel.tsx:2644  →  "M.D.YY - <title20>"
//   PNG names  — carousel.tsx:2654  →  "<filePrefix>_slideN.png"
//   archive display name — carousel.tsx:2799-2802 → "M.D.YY - <coverTitle> (<hostname>)"
// The overflow estimator mirrors export-renderer.ts's body-centering
// measurement math (same wrap loop, same paragraph-gap 0.6 rule) so the
// preflight verdict tracks what the exporter will actually draw.
// ═══════════════════════════════════════════════════════════════════════════

import { FULL_W, FULL_H, MARGIN_X, getBackdropUrl, type Slide, type ThemeKey, type CaptionOption } from "../engine/types";
import { renderSlideToCanvas } from "../engine/export-renderer";
import type { PlatTab } from "../store";

// ─── platforms (limits per V1 ReviewStep, carousel.tsx:1882-1886) ───
export const PLATFORMS: { key: PlatTab; label: string; limit: number }[] = [
  { key: "instagram", label: "INSTAGRAM", limit: 2200 },
  { key: "tiktok", label: "TIKTOK", limit: 2200 },
  { key: "shorts", label: "SHORTS", limit: 100 },
];

// ─── V1 naming ───
export function dateStamp(): string {
  const d = new Date();
  return d.getMonth() + 1 + "." + d.getDate() + "." + String(d.getFullYear()).slice(2);
}

/** V1 cover-title fallback (carousel.tsx:2642). */
export function coverTitleOf(slides: Slide[]): string {
  const cover = slides.find(function (s) { return s.type === "cover"; });
  return (cover && cover.title) || "carousel";
}

/** "M.D.YY - <title20>" — PNG/zip/docx prefix, byte-identical to V1. */
export function filePrefix(coverTitle: string): string {
  return dateStamp() + " - " + coverTitle.replace(/[^a-zA-Z0-9 ]/g, "").slice(0, 20).trim().replace(/\s+/g, "_");
}

/** "M.D.YY - <coverTitle> (<hostname>)" — archive row display name. */
export function archiveDisplayName(coverTitle: string, sourceUrl: string): string {
  let name = dateStamp() + " - " + coverTitle;
  if (sourceUrl) {
    try {
      name += " (" + new URL(sourceUrl).hostname.replace("www.", "") + ")";
    } catch {
      /* unparseable URL: plain name */
    }
  }
  return name;
}

// ─── caption plumbing (CaptionOption per-platform fields; shorts edits `title`) ───
export function platformText(opt: CaptionOption | null | undefined, plat: PlatTab): string {
  if (!opt) return "";
  const data = (opt[plat] && typeof opt[plat] === "object" ? opt[plat] : {}) as Record<string, unknown>;
  return plat === "shorts" ? String(data.title || "") : String(data.caption || "");
}

/** updateCaptionOption patch that writes the active platform's text field. */
export function platformPatch(opt: CaptionOption, plat: PlatTab, value: string): Partial<CaptionOption> {
  const prev = (opt[plat] && typeof opt[plat] === "object" ? opt[plat] : {}) as Record<string, unknown>;
  const next: Record<string, unknown> = { ...prev };
  if (plat === "shorts") next.title = value;
  else next.caption = value;
  return { [plat]: next } as Partial<CaptionOption>;
}

/** Hashtags for the platform, or null when the shape has none (mirror V1:
 *  the hashtags line renders for instagram/tiktok only). */
export function platformHashtags(opt: CaptionOption, plat: PlatTab): string[] | null {
  const data = opt[plat];
  if (!data || typeof data !== "object") return null;
  const tags = (data as Record<string, unknown>).hashtags;
  return Array.isArray(tags) ? tags.map(String) : null;
}

export function hashtagsPatch(opt: CaptionOption, plat: PlatTab, raw: string): Partial<CaptionOption> {
  const prev = (opt[plat] && typeof opt[plat] === "object" ? opt[plat] : {}) as Record<string, unknown>;
  const tags = raw
    .split(/[\s,]+/)
    .map(function (t) { return t.replace(/^#+/, "").trim(); })
    .filter(Boolean);
  return { [plat]: { ...prev, hashtags: tags } } as Partial<CaptionOption>;
}

/** The archive `caption` field. V1 stored an OBJECT ({caption, hashtags} —
 *  legacy loadFromArchive feeds it straight to setCaption and reads
 *  caption.caption), so the shape is kept and filled with the ACTIVE
 *  platform's text (shorts title maps onto caption). */
export function captionForArchive(opt: CaptionOption | null | undefined, plat: PlatTab): Record<string, unknown> | null {
  if (!opt) return null;
  const data = (opt[plat] && typeof opt[plat] === "object" ? opt[plat] : {}) as Record<string, unknown>;
  return {
    caption: plat === "shorts" ? String(data.title || "") : String(data.caption || ""),
    hashtags: Array.isArray(data.hashtags) ? data.hashtags : [],
  };
}

// ─── rendering + download plumbing ───
export async function renderSlidePng(slide: Slide, theme: ThemeKey, page?: number, total?: number): Promise<Uint8Array> {
  const blob = await renderSlideToCanvas(slide, getBackdropUrl(theme, slide.position), page, total);
  return new Uint8Array(await blob.arrayBuffer());
}

/** Copy into a fresh buffer so the Blob ctor sees a plain ArrayBuffer. */
export function bytesToBlob(bytes: Uint8Array, type: string): Blob {
  const copy = new Uint8Array(bytes.length);
  copy.set(bytes);
  return new Blob([copy.buffer], { type });
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─── overflow estimate (preflight) ───
// Same layout constants and wrap counting as export-renderer.ts's
// vertical-centering measurement (carousel.tsx:2506-2524 lineage). Returns
// estimated overflow in FULL-RES px (0 = fits). Only body-copy layouts can
// overflow; cover/image-led types return 0.
const TOP_Y = Math.round(FULL_H * 0.1);
const BOTTOM_Y = Math.round(FULL_H * 0.08);
const AVAIL_H = FULL_H - TOP_Y - BOTTOM_Y;
const CONTENT_W = FULL_W - MARGIN_X * 2;

let measureCtx: CanvasRenderingContext2D | null = null;

function getMeasureCtx(): CanvasRenderingContext2D | null {
  if (typeof document === "undefined") return null;
  if (!measureCtx) measureCtx = document.createElement("canvas").getContext("2d");
  return measureCtx;
}

export function estimateOverflowPx(slide: Slide): number {
  const text = (slide.bodyText || "").trim();
  let lineHeight = 1.55;
  let reserved = 0; // px the image block(s) + gap occupy inside AVAIL_H
  if (slide.type === "body") {
    if (slide.imageUrl) reserved = Math.round(AVAIL_H * ((slide.imageHeight || 45) / 100)) + 16;
  } else if (slide.type === "image_text") {
    lineHeight = 1.5;
    reserved = Math.round(AVAIL_H * ((slide.imageHeight || 50) / 100)) + 16;
  } else if (slide.type === "body_dual") {
    lineHeight = 1.5;
    reserved = Math.max(120, Math.round(AVAIL_H * 0.55)) + 10;
  } else {
    return 0;
  }
  if (!text) return 0;
  const ctx = getMeasureCtx();
  if (!ctx) return 0;
  const size = slide.bodySize || 28;
  ctx.font = "400 " + size + "px Grift, Outfit, sans-serif";
  let totalLines = 0;
  const paragraphs = text.split(/\n/);
  for (let p = 0; p < paragraphs.length; p++) {
    const para = paragraphs[p].trim();
    if (!para) { totalLines += 0.6; continue; } // blank line = paragraph gap
    const words = para.split(" ");
    let line = "";
    for (let i = 0; i < words.length; i++) {
      const test = line + words[i] + " ";
      if (ctx.measureText(test).width > CONTENT_W && i > 0) {
        totalLines++;
        line = words[i] + " ";
      } else {
        line = test;
      }
    }
    if (line.trim()) totalLines++;
  }
  const textH = totalLines * size * lineHeight;
  return Math.max(0, Math.round(textH - (AVAIL_H - reserved)));
}
