// ═══════════════════════════════════════════════════════════════════════════
// Page furniture (v3.11) — swipe arrow, per-page logo, and a CHOOSABLE closer CTA.
//
// Rendered on every non-cover CLASSIC/verbatim page (unique/library self-render):
//   • swipe arrow  — frosted circle + chevron, bottom-right, on every page after
//     the cover EXCEPT the last. Palette-accented.
//   • logo         — real brand mark (logo-assets), chosen corner, post-cover pages.
//   • closer CTA   — on the last (text "body") page, fills the blank space under
//     the text in one of five selectable styles (hero / buttons / list /
//     newsletter / bar), or a compact chip strip when space is tight, or off.
//
// Emitted as SVG inner markup on the 1080×1350 canvas so preview, editor canvas,
// and the PNG export render it identically (data-URI logo survives SVG-as-<img>).
// ═══════════════════════════════════════════════════════════════════════════

import { makeCanvasMeasure } from "./verbatim-thread";
import { LOGO_LETTERMARK, LOGO_LETTERMARKTEXT, LOGO_BOXLETTERMARK, LOGO_FULL, type LogoAsset } from "./logo-assets";

const GF = "Grift, Outfit, sans-serif";
const FW = 1080, FH = 1350, MX = 76;
const CW = FW - MX * 2;                 // 928
const CX = FW / 2;                       // 540
const BODY_TOP = Math.round(FH * 0.10);  // 135
const BODY_BOTTOM = Math.round(FH * 0.92); // 1242
const AVAIL = BODY_BOTTOM - BODY_TOP;
const INK = "#ffffff", MUT = "rgba(255,255,255,0.55)", AMBER = "#F7B041", COBALT = "#0092FF";

function esc(s: string): string { return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

// ── Options ──────────────────────────────────────────────────────────────────
export type LogoVariant = "lettermark" | "lettermarkText" | "boxLettermark" | "full" | "none";
export type Corner = "tl" | "tr" | "bl" | "br";
export type CloserStyle = "siteLine" | "heroIcons" | "heroLogo" | "heroBold" | "buttons" | "list" | "newsletter" | "bar" | "off";
export const CLOSER_STYLES: { id: CloserStyle; label: string }[] = [
  { id: "siteLine", label: "Website line (classic)" },
  { id: "heroIcons", label: "Hero · icons" },
  { id: "heroLogo", label: "Hero · logo-led" },
  { id: "heroBold", label: "Hero · bold" },
  { id: "buttons", label: "Big buttons" },
  { id: "list", label: "Minimal list" },
  { id: "newsletter", label: "Newsletter" },
  { id: "bar", label: "Icon tiles + bar" },
  { id: "off", label: "None" },
];
// ctaText is the editable "old white CTA" line — the website (e.g. semianalysis.com)
// or "LINK IN BIO". It replaces the formerly hard-coded site line across every
// closer style, and is the whole payload of the classic `siteLine` closer.
export interface FurnitureOpts { arrow: boolean; logo: LogoVariant; logoCorner: Corner; closerCta: CloserStyle; ctaText: string }
export const DEFAULT_FURNITURE: FurnitureOpts = { arrow: true, logo: "lettermark", logoCorner: "tr", closerCta: "heroIcons", ctaText: "semianalysis.com" };
export const DEFAULT_CTA_TEXT = "semianalysis.com";
// Quick presets the inspector offers for the editable line.
export const CTA_PRESETS = ["semianalysis.com", "LINK IN BIO"];
// The subscribe button reads naturally whether the line is a domain or a phrase.
function subscribeLine(site: string): string {
  const s = (site || DEFAULT_CTA_TEXT).trim();
  return (s.indexOf(".") >= 0 && s.indexOf(" ") < 0 ? "SUBSCRIBE AT " : "SUBSCRIBE · ") + s.toUpperCase();
}

function logoAsset(v: LogoVariant): LogoAsset { return v === "full" ? LOGO_FULL : v === "boxLettermark" ? LOGO_BOXLETTERMARK : v === "lettermarkText" ? LOGO_LETTERMARKTEXT : LOGO_LETTERMARK; }

// ── The 6-CTA pool (icon names map to the line-icon library) ──────────────────
export interface CtaItem { icon: string; label: string; sub: string }
export const CLOSER_CTAS: CtaItem[] = [
  { icon: "read", label: "Read the full analysis", sub: "semianalysis.com" },
  { icon: "follow", label: "Follow @SemiAnalysis", sub: "for daily analysis" },
  { icon: "subscribe", label: "Subscribe", sub: "the newsletter" },
  { icon: "save", label: "Save for later", sub: "bookmark it" },
  { icon: "alert", label: "Turn on alerts", sub: "never miss a drop" },
  { icon: "share", label: "Share this", sub: "send it on" },
];

// ── Palette accent ────────────────────────────────────────────────────────────
const PALETTE_ACCENT: Record<string, string> = { amber: AMBER, cobalt: COBALT, green: "#2EAD8E", blend: COBALT };
function accentFor(palette?: string): { main: string; ring: string } {
  const p = palette && PALETTE_ACCENT[palette] ? palette : "blend";
  const main = PALETTE_ACCENT[p];
  return { main, ring: p === "blend" ? AMBER : main };
}

// ── Line icons (24-unit grid) ────────────────────────────────────────────────
const ICON: Record<string, string> = {
  read: '<path d="M4 12 h13"/><path d="M12 6 l6 6 -6 6"/>',
  follow: '<circle cx="12" cy="8" r="4"/><path d="M4 20 a8 8 0 0 1 16 0"/>',
  subscribe: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7 l9 6 9 -6"/>',
  save: '<path d="M7 3 h10 v18 l-5 -4 -5 4 z"/>',
  alert: '<path d="M6 9 a6 6 0 0 1 12 0 c0 5 2 6 2 6 H4 s2 -1 2 -6"/><path d="M10 21 a2 2 0 0 0 4 0"/>',
  share: '<path d="M22 3 L2 11 l7 3 3 7 z"/><path d="M22 3 L11 14"/>',
};
function icon(name: string, x: number, y: number, s: number, color: string, sw = 2): string {
  return `<g transform="translate(${x},${y}) scale(${s / 24})" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${ICON[name] || ""}</g>`;
}
function tx(x: number, y: number, size: number, weight: number, fill: string, str: string, anchor = "start", ls = "0"): string {
  return `<text x="${x}" y="${y}" font-family="${GF}" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}" letter-spacing="${ls}">${esc(str)}</text>`;
}
function chip(cx: number, cy: number, r: number, name: string, color: string): string {
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="rgba(255,255,255,0.06)" stroke="${color}" stroke-opacity="0.5"/>${icon(name, cx - r * 0.55, cy - r * 0.55, r * 1.1, color, 2.2)}`;
}
function logoAt(v: LogoVariant, x: number, y: number, h: number): string {
  const a = logoAsset(v); const w = a.w * (h / a.h);
  return `<image href="${a.uri}" xlink:href="${a.uri}" x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid meet"/>`;
}
function logoCentered(v: LogoVariant, cx: number, y: number, h: number): string {
  const a = logoAsset(v); const w = a.w * (h / a.h);
  return logoAt(v, cx - w / 2, y, h);
}

// ── Swipe arrow (bottom-right, smaller, palette-accented) ─────────────────────
function swipeArrowInner(main: string, ring: string): string {
  const r = 38, cx = FW - MX - r, cy = FH - MX - r;
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="rgba(255,255,255,0.08)" stroke="${ring}" stroke-opacity="0.55" stroke-width="1.5"/>` +
    `<path d="M ${cx - r * 0.22} ${cy - r * 0.40} L ${cx + r * 0.34} ${cy} L ${cx - r * 0.22} ${cy + r * 0.40}" fill="none" stroke="${main}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>`;
}

// ── Corner logo ────────────────────────────────────────────────────────────────
function pageLogoInner(v: LogoVariant, corner: Corner): string {
  if (v === "none") return "";
  const h = v === "full" ? 92 : v === "boxLettermark" || v === "lettermarkText" ? 46 : 52;
  const a = logoAsset(v), w = a.w * (h / a.h), pad = 64;
  const x = corner === "tl" || corner === "bl" ? pad : FW - pad - w;
  const y = corner === "tl" || corner === "tr" ? pad : FH - pad - h;
  return logoAt(v, x, y, h);
}

// ── Closer CTA styles (region-relative) ───────────────────────────────────────
type Region = { x: number; y: number; w: number; h: number };

function iconRow(names: string[], cy: number, accent: string): string {
  const isp = 132, x0 = CX - (isp * (names.length - 1)) / 2;
  return names.map((n, i) => chip(x0 + i * isp, cy, 42, n, accent)).join("");
}
const HERO_LOGO = (v: LogoVariant) => (v === "none" ? "lettermark" : v) as LogoVariant;

// Classic "old white CTA" — a clean, centered site line is the whole closer.
// Small caps lead-in → the editable line (website or LINK IN BIO) → logo.
function sSiteLine(r: Region, accent: string, logoV: LogoVariant, site: string): string {
  const groupH = 34 + 26 + 74 + 44 + 56;
  let y = r.y + Math.max(16, ((r.h - 30) - groupH) / 2);
  let o = "";
  o += tx(CX, y + 26, 30, 700, MUT, "READ THE FULL ANALYSIS", "middle", "2.5");
  y += 34 + 26;
  o += tx(CX, y + 56, 72, 800, accent, site, "middle", "1");
  y += 74 + 44;
  o += logoCentered(HERO_LOGO(logoV), CX, y, 56);
  return o;
}

// Hero · icons — Save/Alerts/Share row → headline → sub → logo, group centered; site pinned bottom
function sHeroIcons(r: Region, accent: string, logoV: LogoVariant, topic: string, site: string): string {
  const groupH = 84 + 30 + 88 + 14 + 30 + 26 + 58; // icons+head+sub+logo w/ gaps
  let y = r.y + Math.max(16, ((r.h - 60) - groupH) / 2);
  let o = "";
  o += iconRow(["save", "alert", "share"], y + 42, accent);
  y += 84 + 30;
  o += tx(CX, y + 64, 82, 800, INK, "FOLLOW FOR MORE", "middle", "1");
  y += 88 + 14;
  o += tx(CX, y + 24, 28, 500, MUT, topic ? "More on " + topic : "The full analysis, plus daily updates.", "middle");
  y += 30 + 26;
  o += logoCentered(HERO_LOGO(logoV), CX, y, 58);
  o += tx(CX, r.y + r.h - 14, 32, 700, accent, site, "middle", "1");
  return o;
}
// Hero · logo-led — big logo → headline → sub → icons row; site pinned bottom
function sHeroLogo(r: Region, accent: string, logoV: LogoVariant, topic: string, site: string): string {
  const groupH = 74 + 30 + 84 + 14 + 30 + 30 + 84;
  let y = r.y + Math.max(16, ((r.h - 60) - groupH) / 2);
  let o = "";
  o += logoCentered(HERO_LOGO(logoV), CX, y, 74);
  y += 74 + 30;
  o += tx(CX, y + 62, 78, 800, INK, "FOLLOW FOR MORE", "middle", "1");
  y += 84 + 14;
  o += tx(CX, y + 24, 28, 500, MUT, topic ? "More on " + topic : "The full analysis, plus daily updates.", "middle");
  y += 30 + 30;
  o += iconRow(["save", "alert", "share"], y + 42, accent);
  o += tx(CX, r.y + r.h - 14, 32, 700, accent, site, "middle", "1");
  return o;
}
// Hero · bold — two-line headline + logo, airy, no icons; site pinned bottom
function sHeroBold(r: Region, accent: string, logoV: LogoVariant, site: string): string {
  const groupH = 108 + 108 + 40 + 64;
  let y = r.y + Math.max(16, ((r.h - 60) - groupH) / 2);
  let o = "";
  o += tx(CX, y + 90, 108, 900, INK, "FOLLOW", "middle", "1");
  y += 108;
  o += tx(CX, y + 90, 108, 900, INK, "FOR MORE", "middle", "1");
  y += 108 + 40;
  o += logoCentered(HERO_LOGO(logoV), CX, y, 64);
  o += tx(CX, r.y + r.h - 14, 32, 700, accent, site, "middle", "1");
  return o;
}
// 05 · Big buttons — primary (filled read) + secondary (outline follow) + logo
function sButtons(r: Region, accent: string, logoV: LogoVariant): string {
  const bh = 148, gap = 22, block = bh * 2 + gap + 96, by = r.y + Math.max(8, (r.h - block) / 2);
  let o = "";
  o += `<rect x="${r.x}" y="${by}" width="${r.w}" height="${bh}" rx="26" fill="${accent}"/>`;
  o += icon("read", r.x + 44, by + bh / 2 - 20, 40, "#0A0B10", 3);
  o += tx(r.x + 112, by + bh / 2 + 12, 38, 900, "#0A0B10", "READ THE FULL ANALYSIS", "start", "0.5");
  const b2 = by + bh + gap;
  o += `<rect x="${r.x}" y="${b2}" width="${r.w}" height="${bh}" rx="26" fill="none" stroke="${INK}" stroke-opacity="0.5" stroke-width="2"/>`;
  o += icon("follow", r.x + 44, b2 + bh / 2 - 20, 40, INK, 2.6);
  o += tx(r.x + 112, b2 + bh / 2 + 12, 38, 800, INK, "FOLLOW @SEMIANALYSIS", "start", "0.5");
  o += logoCentered(logoV === "none" ? "lettermark" : logoV, CX, b2 + bh + 36, 50);
  return o;
}
// 06 · Minimal list — hairline dividers, icon + label + sub
function sList(r: Region, accent: string, site: string): string {
  const items = CLOSER_CTAS.slice(0, 4), rh = Math.min(150, r.h / items.length), y0 = r.y + (r.h - rh * items.length) / 2;
  let o = "";
  items.forEach((c, i) => {
    const y = y0 + i * rh, my = y + rh / 2;
    if (i) o += `<line x1="${r.x}" y1="${y}" x2="${r.x + r.w}" y2="${y}" stroke="rgba(255,255,255,0.12)"/>`;
    o += icon(c.icon, r.x, my - 20, 40, accent, 2.2);
    o += tx(r.x + 70, my - 2, 36, 800, INK, c.label.toUpperCase(), "start", "0.4");
    o += tx(r.x + r.w, my - 2, 26, 500, MUT, c.icon === "read" ? site : c.sub, "end");
  });
  return o;
}
// 07 · Newsletter — leads to the WEBSITE to subscribe; footer icon row + logo.
// The card + icon row are vertically centered in the region (logo stays pinned
// low) so the block isn't crowded against the body text above.
function sNews(r: Region, accent: string, logoV: LogoVariant, site: string): string {
  const ch = Math.min(300, r.h * 0.52);
  const blockH = ch + 62 + 46; // card + gap + footer icon row
  const top = r.y + Math.max(24, (r.h - 70 - blockH) / 2);
  let o = "";
  o += `<rect x="${r.x}" y="${top}" width="${r.w}" height="${ch}" rx="26" fill="rgba(0,146,255,0.10)" stroke="${accent}" stroke-opacity="0.45"/>`;
  o += chip(r.x + 82, top + 92, 46, "subscribe", accent);
  o += tx(r.x + 152, top + 80, 38, 800, INK, "SUBSCRIBE TO THE NEWSLETTER", "start", "0.3");
  o += tx(r.x + 152, top + 122, 26, 500, MUT, "Free, straight to your inbox.", "start");
  const btnH = 66, btnY = top + ch - btnH - 30;
  o += `<rect x="${r.x + 40}" y="${btnY}" width="${r.w - 80}" height="${btnH}" rx="16" fill="${accent}"/>`;
  o += tx(CX, btnY + btnH / 2 + 9, 28, 800, "#0A0B10", subscribeLine(site), "middle", "0.5");
  const fy = top + ch + 62, fsp = r.w / 4;
  ["read", "follow", "save", "share"].forEach((n, i) => { o += chip(r.x + fsp * i + fsp / 2, fy, 40, n, accent); });
  o += logoCentered(logoV === "none" ? "lettermark" : logoV, CX, r.y + r.h - 54, 46);
  return o;
}
// 08 · Icon tiles + footer bar. Tiles centered between the top and the bar so
// they aren't crowded against the body text above.
function sBar(r: Region, accent: string, logoV: LogoVariant, site: string): string {
  const items = CLOSER_CTAS.slice(0, 4), gap = 16, pw = (r.w - gap * 3) / 4, ph = Math.min(170, r.h - 200), py = r.y + Math.max(30, (r.h - 86 - ph) / 2);
  let o = "";
  items.forEach((c, i) => {
    const px = r.x + i * (pw + gap);
    o += `<rect x="${px}" y="${py}" width="${pw}" height="${ph}" rx="20" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.13)"/>`;
    o += chip(px + pw / 2, py + ph * 0.36, 38, c.icon, i % 2 ? COBALT : accent);
    o += tx(px + pw / 2, py + ph - 24, 22, 800, INK, c.label.toUpperCase().split(" ")[0], "middle", "0.3");
  });
  const barY = r.y + r.h - 86;
  o += `<rect x="${r.x}" y="${barY}" width="${r.w}" height="86" rx="18" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.12)"/>`;
  o += logoAt(logoV === "none" ? "lettermark" : logoV, r.x + 28, barY + 22, 42);
  o += tx(r.x + r.w - 28, barY + 56, 30, 700, accent, site, "end", "1");
  return o;
}
// Compact fallback when the leftover space is tight (3 icon pills)
function compactStrip(r: Region, accent: string): string {
  const items = CLOSER_CTAS.slice(0, 3), gap = 14, pw = (r.w - gap * 2) / 3, ph = Math.min(92, Math.max(60, r.h - 8)), py = r.y + r.h - ph;
  let o = "";
  items.forEach((c, i) => {
    const px = r.x + i * (pw + gap);
    o += `<rect x="${px}" y="${py}" width="${pw}" height="${ph}" rx="${ph / 2}" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.14)"/>`;
    o += icon(c.icon, px + 22, py + ph / 2 - 15, 30, accent, 2.2);
    o += tx(px + 62, py + ph / 2 + 8, 22, 700, INK, c.label.toUpperCase().split(" ").slice(0, 2).join(" "), "start", "0.3");
  });
  return o;
}

const MIN_H: Record<string, number> = { siteLine: 210, heroIcons: 470, heroLogo: 480, heroBold: 440, buttons: 420, list: 320, newsletter: 470, bar: 320 };

/** Closer CTA inner-SVG (or ""): measures leftover space and renders the chosen
 *  style, a compact strip when tight, or nothing when the page is full. */
export function closerCtaInner(
  slide: { bodyText?: string; bodySize?: number },
  topic: string,
  style: CloserStyle,
  logoV: LogoVariant,
  accent: string,
  ctaText?: string
): string {
  if (style === "off") return "";
  const site = (ctaText || DEFAULT_CTA_TEXT).trim() || DEFAULT_CTA_TEXT;
  const bodyText = (slide.bodyText || "").trim();
  const bodySize = slide.bodySize || 28;
  const measure = makeCanvasMeasure(CW, GF, 1.55);
  const textH = bodyText ? measure(bodyText, bodySize) : 0;
  const regionY = BODY_TOP + textH + 44;
  const r: Region = { x: MX, y: regionY, w: CW, h: BODY_BOTTOM - regionY };
  if (r.h >= (MIN_H[style] || 320)) {
    if (style === "siteLine") return sSiteLine(r, accent, logoV, site);
    if (style === "heroIcons") return sHeroIcons(r, accent, logoV, topic, site);
    if (style === "heroLogo") return sHeroLogo(r, accent, logoV, topic, site);
    if (style === "heroBold") return sHeroBold(r, accent, logoV, site);
    if (style === "buttons") return sButtons(r, accent, logoV);
    if (style === "list") return sList(r, accent, site);
    if (style === "newsletter") return sNews(r, accent, logoV, site);
    if (style === "bar") return sBar(r, accent, logoV, site);
  }
  // The classic line collapses to a single pinned line when space is tight.
  if (style === "siteLine" && r.h >= 44) {
    return tx(CX, r.y + r.h - 12, 34, 800, accent, site, "middle", "1");
  }
  if (r.h >= 90) return compactStrip(r, accent);
  return "";
}

// ── Composite furniture for one slide ─────────────────────────────────────────
export function furnitureInner(
  slide: { type?: string; bodyText?: string; bodySize?: number; coverAccent?: string; libraryPalette?: string },
  opts: FurnitureOpts,
  page: number,
  total: number,
  topic?: string
): string {
  const type = slide.type || "";
  if (type.indexOf("cover") === 0) return "";           // cover draws its own
  if (type === "unique" || type === "library") return ""; // self-render their own furniture
  const isLast = page >= total;
  const acc = accentFor(slide.libraryPalette);
  let out = "";
  if (opts.logo !== "none") out += pageLogoInner(opts.logo, opts.logoCorner);
  if (opts.arrow && !isLast) out += swipeArrowInner(acc.main, acc.ring);
  // Closer CTA fills the blank space under a plain text "body" closer only.
  if (isLast && total > 1 && type === "body" && (slide.bodyText || "").trim()) {
    const t = topic && topic.trim() && topic.trim().toLowerCase() !== "brand" ? topic.trim().replace(/[-_]+/g, " ") : "";
    out += closerCtaInner(slide, t, opts.closerCta, opts.logo, acc.main, opts.ctaText);
  }
  return out;
}

/** Full-canvas SVG for a slide's furniture (or ""). */
export function furnitureSvg(slide: Parameters<typeof furnitureInner>[0], opts: FurnitureOpts, page: number, total: number, topic?: string): string {
  const inner = furnitureInner(slide, opts, page, total, topic);
  if (!inner) return "";
  return '<svg viewBox="0 0 1080 1350" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" style="width:100%;height:100%;display:block;position:absolute;inset:0;pointer-events:none">' + inner + "</svg>";
}
