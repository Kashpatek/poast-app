// ═══════════════════════════════════════════════════════════════════════════
// Page furniture (v3.10) — swipe arrow, per-page logo, and the closer CTA.
//
// Rendered on every non-cover page across ALL carousel modes:
//   • swipe arrow  — frosted circle + chevron, bottom-right, on every page
//     after the cover EXCEPT the last (means "there's more").
//   • logo         — the real brand mark (logo-assets), placed in a chosen
//     corner (default top-right, opposite the arrow), on every page after cover.
//   • closer CTA   — on the LAST page, fills the blank space under the text,
//     ADAPTIVE: full "follow for more" + logo lockup + 3 CTA cards when ~2/3 is
//     open, a compact 3-chip strip when only ~1/3 is open, nothing when full.
//
// Emitted as SVG inner markup on the 1080×1350 canvas so the live preview, the
// editor canvas, and the rasterized PNG export all render it identically
// (data-URI logo works in the SVG-as-<img> export; external href would not).
// ═══════════════════════════════════════════════════════════════════════════

import { makeCanvasMeasure } from "./verbatim-thread";
import { LOGO_LETTERMARK, LOGO_LETTERMARKTEXT, LOGO_BOXLETTERMARK, LOGO_FULL, type LogoAsset } from "./logo-assets";

const GF = "Grift, Outfit, sans-serif";
const FULL_W = 1080, FULL_H = 1350, MARGIN_X = 76;
const CW = FULL_W - MARGIN_X * 2;         // 928
const BODY_TOP = Math.round(FULL_H * 0.10);    // 135
const BODY_BOTTOM = Math.round(FULL_H * 0.92); // 1242
const AVAIL = BODY_BOTTOM - BODY_TOP;     // 1107

function esc(s: string): string {
  return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// ── Options ────────────────────────────────────────────────────────────────
export type LogoVariant = "lettermark" | "lettermarkText" | "boxLettermark" | "full" | "none";
export type Corner = "tl" | "tr" | "bl" | "br";
export interface FurnitureOpts { arrow: boolean; logo: LogoVariant; logoCorner: Corner }
export const DEFAULT_FURNITURE: FurnitureOpts = { arrow: true, logo: "lettermark", logoCorner: "tr" };

function logoAsset(v: LogoVariant): LogoAsset | null {
  if (v === "full") return LOGO_FULL;
  if (v === "boxLettermark") return LOGO_BOXLETTERMARK;
  if (v === "lettermarkText") return LOGO_LETTERMARKTEXT;
  if (v === "lettermark") return LOGO_LETTERMARK;
  return null;
}

// ── The pool of 6 CTAs (closer shows the first three) ────────────────────────
export interface CtaItem { label: string; sub: string }
export const CLOSER_CTAS: CtaItem[] = [
  { label: "Read the full analysis", sub: "semianalysis.com" },
  { label: "Follow @SemiAnalysis", sub: "for daily analysis" },
  { label: "Subscribe", sub: "the newsletter" },
  { label: "Share this", sub: "send it on" },
  { label: "Save for later", sub: "bookmark it" },
  { label: "Turn on alerts", sub: "never miss a drop" },
];

// Palette → accent (matches palette.ts identities). Blend = "both" → the ring
// takes the second (amber) so the arrow shows cobalt + amber together.
const PALETTE_ACCENT: Record<string, string> = { amber: "#F7B041", cobalt: "#0092FF", green: "#2EAD8E", blend: "#0092FF" };
function accentFor(palette?: string): { main: string; ring: string } {
  const p = palette && PALETTE_ACCENT[palette] ? palette : "blend";
  const main = PALETTE_ACCENT[p];
  const ring = p === "blend" ? "#F7B041" : main; // blend uses both hues
  return { main, ring };
}

// ── Swipe arrow (bottom-right frosted circle + chevron), smaller + accented ──
function swipeArrowInner(main: string, ring: string): string {
  const r = 38;
  const cx = FULL_W - MARGIN_X - r;
  const cy = FULL_H - MARGIN_X - r;
  return (
    `<circle cx="${cx}" cy="${cy}" r="${r}" fill="rgba(255,255,255,0.08)" stroke="${ring}" stroke-opacity="0.55" stroke-width="1.5"/>` +
    `<path d="M ${cx - r * 0.22} ${cy - r * 0.40} L ${cx + r * 0.34} ${cy} L ${cx - r * 0.22} ${cy + r * 0.40}" fill="none" stroke="${main}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>`
  );
}

// ── Corner logo ──────────────────────────────────────────────────────────────
function pageLogoInner(v: LogoVariant, corner: Corner, targetH?: number): string {
  const asset = logoAsset(v);
  if (!asset) return "";
  const h = targetH || (v === "full" ? 92 : v === "boxLettermark" || v === "lettermarkText" ? 46 : 52);
  const w = asset.w * (h / asset.h);
  const pad = 64;
  const x = corner === "tl" || corner === "bl" ? pad : FULL_W - pad - w;
  const y = corner === "tl" || corner === "tr" ? pad : FULL_H - pad - h;
  return `<image href="${asset.uri}" xlink:href="${asset.uri}" x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid meet"/>`;
}

// ── Closer CTA blocks ────────────────────────────────────────────────────────
function chevronCircle(cx: number, cy: number, r: number, color: string): string {
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.18)" stroke-width="1"/>` +
    `<path d="M ${cx - r * 0.28} ${cy - r * 0.42} L ${cx + r * 0.34} ${cy} L ${cx - r * 0.28} ${cy + r * 0.42}" fill="none" stroke="${color}" stroke-width="${Math.max(3, r * 0.14)}" stroke-linecap="round" stroke-linejoin="round"/>`;
}

function fullBlock(region: { x: number; y: number; w: number; h: number }, ctas: CtaItem[], accent: string, headline: string, logoV: LogoVariant): string {
  let out = "";
  // Header lockup: logo + "FOLLOW FOR MORE" style headline.
  const logo = logoAsset(logoV) || LOGO_LETTERMARK;
  const lh = 40;
  const lw = logo.w * (lh / logo.h);
  out += `<image href="${logo.uri}" xlink:href="${logo.uri}" x="${region.x}" y="${region.y}" width="${lw}" height="${lh}" preserveAspectRatio="xMidYMid meet"/>`;
  out += `<text x="${region.x + lw + 18}" y="${region.y + 29}" font-family="${GF}" font-size="26" font-weight="800" letter-spacing="2" fill="#ffffff">${esc(headline.toUpperCase())}</text>`;
  const top = region.y + lh + 20;
  const gap = 16;
  const n = ctas.length;
  const cardH = Math.max(92, Math.floor((region.h - (lh + 20) - gap * (n - 1)) / n));
  for (let i = 0; i < n; i++) {
    const cy = top + i * (cardH + gap);
    const c = ctas[i];
    out += `<rect x="${region.x}" y="${cy}" width="${region.w}" height="${cardH}" rx="18" fill="rgba(255,255,255,0.045)" stroke="rgba(255,255,255,0.12)" stroke-width="1"/>`;
    out += `<rect x="${region.x}" y="${cy + 14}" width="5" height="${cardH - 28}" rx="2.5" fill="${accent}"/>`;
    const midY = cy + cardH / 2;
    out += `<text x="${region.x + 34}" y="${midY - 4}" font-family="${GF}" font-size="34" font-weight="800" letter-spacing="0.5" fill="#ffffff">${esc(c.label.toUpperCase())}</text>`;
    if (c.sub) out += `<text x="${region.x + 34}" y="${midY + 30}" font-family="${GF}" font-size="22" font-weight="500" fill="rgba(255,255,255,0.55)">${esc(c.sub)}</text>`;
    out += chevronCircle(region.x + region.w - 44, midY, 26, accent);
  }
  return out;
}

function compactStrip(region: { x: number; y: number; w: number; h: number }, ctas: CtaItem[], accent: string): string {
  let out = "";
  const n = ctas.length;
  const gap = 14;
  const pillW = Math.floor((region.w - gap * (n - 1)) / n);
  const pillH = Math.min(92, Math.max(60, region.h - 8));
  const py = region.y + region.h - pillH; // anchor to the bottom of the region
  for (let i = 0; i < n; i++) {
    const px = region.x + i * (pillW + gap);
    const c = ctas[i];
    out += `<rect x="${px}" y="${py}" width="${pillW}" height="${pillH}" rx="${pillH / 2}" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.14)" stroke-width="1"/>`;
    out += `<circle cx="${px + 24}" cy="${py + pillH / 2}" r="6" fill="${accent}"/>`;
    out += `<text x="${px + 42}" y="${py + pillH / 2 + 8}" font-family="${GF}" font-size="22" font-weight="700" letter-spacing="0.4" fill="#ffffff">${esc(c.label.toUpperCase())}</text>`;
  }
  return out;
}

/** Closer CTA inner-SVG (or ""): measures the leftover space under the body
 *  text and picks full / compact / none. */
export function closerCtaInner(
  slide: { bodyText?: string; bodySize?: number; coverAccent?: string; type?: string },
  topic?: string,
  logoV: LogoVariant = "lettermark"
): string {
  const bodyText = (slide.bodyText || "").trim();
  const bodySize = slide.bodySize || 28;
  const accent = slide.coverAccent || "#F7B041";
  const measure = makeCanvasMeasure(CW, GF, 1.5);
  const textH = bodyText ? measure(bodyText, bodySize) : 0;
  const textBottom = BODY_TOP + textH;
  const gap = 44;
  const regionY = textBottom + gap;
  const regionH = BODY_BOTTOM - regionY;
  const emptyFrac = (BODY_BOTTOM - textBottom) / AVAIL;
  const region = { x: MARGIN_X, y: regionY, w: CW, h: regionH };
  const headline = topic && topic.trim() ? "Follow for more on " + topic.trim() : "Follow for more";
  const ctas = [
    { label: topic && topic.trim() ? "Read the full " + topic.trim() + " piece" : CLOSER_CTAS[0].label, sub: CLOSER_CTAS[0].sub },
    CLOSER_CTAS[1],
    CLOSER_CTAS[2],
  ];
  if (emptyFrac >= 0.5 && regionH > 300) return fullBlock(region, ctas, accent, headline, logoV);
  if (emptyFrac >= 0.22 && regionH > 80) return compactStrip(region, ctas, accent);
  return "";
}

// ── Composite: all furniture for one slide ───────────────────────────────────
export function furnitureInner(
  slide: { type?: string; bodyText?: string; bodySize?: number; coverAccent?: string; libraryPalette?: string },
  opts: FurnitureOpts,
  page: number,
  total: number,
  topic?: string
): string {
  const isCover = (slide.type || "").indexOf("cover") === 0;
  if (isCover) return ""; // the cover draws its own logo/topic
  const isLast = page >= total;
  const acc = accentFor(slide.libraryPalette);
  let out = "";
  if (opts.logo !== "none") out += pageLogoInner(opts.logo, opts.logoCorner);
  if (opts.arrow && !isLast) out += swipeArrowInner(acc.main, acc.ring);
  if (isLast && total > 1) out += closerCtaInner({ ...slide, coverAccent: slide.coverAccent || acc.main }, topic, opts.logo === "none" ? "lettermark" : opts.logo);
  return out;
}

/** Full-canvas SVG string for a slide's furniture (or ""). Preview/canvas inject
 *  this via innerHTML; export draws it onto the canvas. */
export function furnitureSvg(
  slide: Parameters<typeof furnitureInner>[0],
  opts: FurnitureOpts,
  page: number,
  total: number,
  topic?: string
): string {
  const inner = furnitureInner(slide, opts, page, total, topic);
  if (!inner) return "";
  return '<svg viewBox="0 0 1080 1350" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" style="width:100%;height:100%;display:block;position:absolute;inset:0;pointer-events:none">' + inner + "</svg>";
}
