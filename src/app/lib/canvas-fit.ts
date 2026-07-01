// Shared canvas-fit core — the single source for "affix + block to the canvas".
//
// Every design surface (Carousel 2.0 ingest/compose/export/QA, and later the
// design-studio editor) reuses these pure helpers so off-size content scales,
// aligns, and clamps consistently instead of overflowing or floating.
//
// PURE + framework-agnostic: no React, no Fabric, no DOM. `normalizeIntrinsic`
// reads the <svg> root by string parse (not DOMParser) so this module is safe
// to import from types, SSR, workers, or the browser. Every function is
// (w,h)-parameterized — it NEVER assumes portrait 1080x1350 (design-studio is
// preset-driven, default 1080x1080, and passes its own dims).

export interface Dims {
  width: number;
  height: number;
}
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

// Canonical carousel slide canvas. The default for Carousel 2.0 only — other
// surfaces pass their active preset dims to the functions below.
export const CANVAS_DIMS: Dims = { width: 1080, height: 1350 };

// Canonical SemiAnalysis carousel SAFE ZONE — the real numbers from the design
// handover (HANDOVER.md §1): text + logos stay inside these insets on the
// 1080×1350 canvas. Side margin is 76 for body content (60 for covers); top safe
// line 135 (10%), bottom safe line 108 (8%). Backgrounds are full-bleed and
// intentionally ignore this. The source of truth for the export gate + editor
// grid; measured content margins are compared against it.
export interface Insets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}
export const CAROUSEL_SAFE_ZONE: Insets = { top: 135, right: 76, bottom: 108, left: 76 };
export const CAROUSEL_COVER_SIDE_MARGIN = 60;

export interface IntrinsicSize {
  width: number;
  height: number;
  viewBox: [number, number, number, number] | null;
}

// Read a numeric length attribute off the <svg> open tag, ignoring unit-suffixed
// or percentage values we can't resolve to pixels.
function readLen(tag: string, name: string): number | null {
  const m = new RegExp(`\\b${name}\\s*=\\s*["']([^"']+)["']`, "i").exec(tag);
  if (!m) return null;
  const raw = m[1].trim();
  if (raw.endsWith("%")) return null; // relative — not an intrinsic pixel size
  const v = parseFloat(raw);
  return Number.isFinite(v) && v > 0 ? v : null;
}

// Derive an SVG's intrinsic size from its root: viewBox first, else width/height
// attrs, else null. viewBox is returned separately so callers can honor the
// source's own coordinate space when nesting it.
export function normalizeIntrinsic(svg: string): IntrinsicSize | null {
  const open = /<svg\b[^>]*>/i.exec(svg);
  if (!open) return null;
  const tag = open[0];

  let viewBox: [number, number, number, number] | null = null;
  const vbM = /viewBox\s*=\s*["']([^"']+)["']/i.exec(tag);
  if (vbM) {
    const p = vbM[1].split(/[\s,]+/).map(Number).filter((n) => Number.isFinite(n));
    if (p.length === 4) viewBox = [p[0], p[1], p[2], p[3]];
  }

  const wAttr = readLen(tag, "width");
  const hAttr = readLen(tag, "height");
  let width = wAttr ?? (viewBox ? viewBox[2] : null);
  let height = hAttr ?? (viewBox ? viewBox[3] : null);
  if (width == null || height == null || width <= 0 || height <= 0) {
    if (viewBox && viewBox[2] > 0 && viewBox[3] > 0) {
      width = viewBox[2];
      height = viewBox[3];
    } else {
      return null;
    }
  }
  return { width, height, viewBox };
}

export interface Fit {
  scale: number;
  dx: number; // x offset to center the fitted box in the destination
  dy: number;
  w: number; // fitted box size
  h: number;
}

// Aspect-preserving fit INSIDE the destination (letterbox — the "meet" rule).
// The unified replacement for the Math.min(dstW/srcW, dstH/srcH) copies.
export function fitContain(srcW: number, srcH: number, dstW: number, dstH: number): Fit {
  if (srcW <= 0 || srcH <= 0) return { scale: 1, dx: 0, dy: 0, w: dstW, h: dstH };
  const scale = Math.min(dstW / srcW, dstH / srcH);
  const w = srcW * scale;
  const h = srcH * scale;
  return { scale, dx: (dstW - w) / 2, dy: (dstH - h) / 2, w, h };
}

// Aspect-preserving fill that COVERS the destination (crop — the "slice" rule).
export function fitCover(srcW: number, srcH: number, dstW: number, dstH: number): Fit {
  if (srcW <= 0 || srcH <= 0) return { scale: 1, dx: 0, dy: 0, w: dstW, h: dstH };
  const scale = Math.max(dstW / srcW, dstH / srcH);
  const w = srcW * scale;
  const h = srcH * scale;
  return { scale, dx: (dstW - w) / 2, dy: (dstH - h) / 2, w, h };
}

export interface ClampResult {
  rect: Rect;
  changed: boolean;
}

// Clamp a rect fully inside [0,0,bounds]. Size is capped to the bounds first,
// then the origin is pulled in so the whole rect stays on-canvas.
export function clampRect(rect: Rect, bounds: Dims): ClampResult {
  const w = Math.max(0, Math.min(rect.w, bounds.width));
  const h = Math.max(0, Math.min(rect.h, bounds.height));
  const x = Math.max(0, Math.min(rect.x, bounds.width - w));
  const y = Math.max(0, Math.min(rect.y, bounds.height - h));
  const changed = x !== rect.x || y !== rect.y || w !== rect.w || h !== rect.h;
  return { rect: { x, y, w, h }, changed };
}

export interface OverflowReport {
  overflows: boolean;
  left: boolean;
  right: boolean;
  top: boolean;
  bottom: boolean;
  dx: number; // farthest horizontal overshoot in px
  dy: number; // farthest vertical overshoot in px
}

// How far a rect spills outside the bounds (for a soft warning, not a block).
export function overflowReport(rect: Rect, bounds: Dims): OverflowReport {
  const left = rect.x < 0;
  const top = rect.y < 0;
  const right = rect.x + rect.w > bounds.width;
  const bottom = rect.y + rect.h > bounds.height;
  const dx = Math.max(left ? -rect.x : 0, right ? rect.x + rect.w - bounds.width : 0);
  const dy = Math.max(top ? -rect.y : 0, bottom ? rect.y + rect.h - bounds.height : 0);
  return { overflows: left || right || top || bottom, left, right, top, bottom, dx: Math.round(dx), dy: Math.round(dy) };
}

export function aspectRatio(w: number, h: number): number {
  return h > 0 ? w / h : 0;
}

// Same size (rounded to the pixel)?
export function dimsMatch(a: Dims, b: Dims): boolean {
  return Math.round(a.width) === Math.round(b.width) && Math.round(a.height) === Math.round(b.height);
}

// Same aspect ratio within a small relative tolerance?
export function aspectMismatch(a: Dims, b: Dims, tol = 0.01): boolean {
  const ra = aspectRatio(a.width, a.height);
  const rb = aspectRatio(b.width, b.height);
  if (!ra || !rb) return true;
  return Math.abs(ra - rb) / rb > tol;
}

// Do two rects overlap (share any area)?
export function rectsOverlap(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export interface MarginReport {
  left: number;
  right: number;
  top: number;
  bottom: number;
  content: Rect; // the measured content bounding box
  symmetricX: boolean;
  symmetricY: boolean;
  fullBleed: boolean; // content spans ~the whole canvas (e.g. a background)
}

// Turn a measured content bounding box into edge insets — this is how we "see"
// what safe zone an authored asset actually uses, rather than assuming one.
export function measureMargins(content: Rect, canvas: Dims, tol = 4): MarginReport {
  const left = Math.round(content.x);
  const top = Math.round(content.y);
  const right = Math.round(canvas.width - (content.x + content.w));
  const bottom = Math.round(canvas.height - (content.y + content.h));
  return {
    left,
    right,
    top,
    bottom,
    content,
    symmetricX: Math.abs(left - right) <= tol,
    symmetricY: Math.abs(top - bottom) <= tol,
    fullBleed: left <= tol && right <= tol && top <= tol && bottom <= tol,
  };
}
