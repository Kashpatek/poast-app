// Carousel 2.0 · PNG export (asset-agnostic).
// Rasterizes any self-contained SVG string (a product, a filled slide, or a
// composed design) to a PNG Blob via a canvas, then triggers a download.
// Client-only. Note: waits for fonts so text renders in Grift/Outfit; external
// (non-data-URL) images inside the SVG can taint the canvas — inline as data
// URLs before export when that matters (the AI image path already does).

import { normalizeIntrinsic } from "../../lib/canvas-fit";

const XMLNS = "http://www.w3.org/2000/svg";

// Ensure the svg root declares xmlns + explicit pixel width/height so the
// browser rasterizes it at the intended size — AND a viewBox so it can't
// stretch. A no-viewBox SVG with width/height attrs would scale its user units
// to the forced (w,h) and distort; injecting the intrinsic box makes the raster
// letterbox (preserveAspectRatio "meet") instead.
function normalizeSvg(svg: string, w: number, h: number): string {
  let s = svg;
  if (!/xmlns=/.test(s)) s = s.replace(/^<svg /, `<svg xmlns="${XMLNS}" `);
  const intrinsic = normalizeIntrinsic(s);
  // Force pixel dimensions (strip a style width/height override if present).
  s = s.replace(/^<svg([^>]*)>/, (_m, attrs) => {
    let cleaned = String(attrs)
      .replace(/\swidth="[^"]*"/i, "")
      .replace(/\sheight="[^"]*"/i, "")
      .replace(/\sstyle="[^"]*"/i, "");
    if (!/viewBox\s*=/i.test(cleaned)) {
      const vb = intrinsic ? `0 0 ${intrinsic.width} ${intrinsic.height}` : `0 0 ${w} ${h}`;
      cleaned = ` viewBox="${vb}"` + cleaned;
    }
    return `<svg${cleaned} width="${w}" height="${h}">`;
  });
  return s;
}

export async function svgToPngBlob(svg: string, w: number, h: number, scale = 2): Promise<Blob> {
  if (typeof document === "undefined") throw new Error("export requires a browser");
  try {
    if (document.fonts && document.fonts.ready) await document.fonts.ready;
  } catch {
    /* ignore */
  }
  const normalized = normalizeSvg(svg, w, h);
  const url = URL.createObjectURL(new Blob([normalized], { type: "image/svg+xml;charset=utf-8" }));
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const im = new Image();
      im.onload = () => resolve(im);
      im.onerror = () => reject(new Error("SVG failed to load for export"));
      im.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(w * scale);
    canvas.height = Math.round(h * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("no 2d context");
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob((b) => resolve(b), "image/png"));
    if (!blob) throw new Error("canvas.toBlob returned null (canvas may be tainted by a cross-origin image)");
    return blob;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

// Convenience: rasterize + download in one call.
export async function exportSvgPng(svg: string, w: number, h: number, filename: string, scale = 2): Promise<void> {
  const blob = await svgToPngBlob(svg, w, h, scale);
  downloadBlob(blob, filename);
}

// ── deck (multi-slide) export ──────────────────────────────────────────────
// Filename mirrors the production carousel exactly: {MM.dd.yy}-{title}_slide{n}.png
function pad2(n: number): string {
  return n < 10 ? "0" + n : String(n);
}
export function makeSlideFilename(deckTitle: string, index: number): string {
  const d = new Date();
  const stamp = `${pad2(d.getMonth() + 1)}.${pad2(d.getDate())}.${String(d.getFullYear()).slice(2)}`;
  const title =
    (deckTitle || "carousel")
      .replace(/[^a-z0-9 ]/gi, "")
      .trim()
      .slice(0, 20)
      .replace(/\s+/g, "_") || "carousel";
  return `${stamp}-${title}_slide${index + 1}.png`;
}

// Rasterize + download an ordered set of slide SVGs, one PNG each, staggered so
// the browser doesn't drop concurrent downloads (matches production's 400ms).
// Kept asset-agnostic: the caller (deck editor) renders slide SVGs via
// deck.renderDeckSvgs and hands the strings in, so export.ts stays free of any
// deck/catalog imports.
export async function exportDeckPngs(
  svgs: string[],
  w: number,
  h: number,
  deckTitle: string,
  opts?: { scale?: number; delayMs?: number; onProgress?: (done: number, total: number) => void }
): Promise<void> {
  const scale = opts?.scale ?? 2;
  const delayMs = opts?.delayMs ?? 400;
  for (let i = 0; i < svgs.length; i++) {
    const blob = await svgToPngBlob(svgs[i], w, h, scale);
    downloadBlob(blob, makeSlideFilename(deckTitle, i));
    opts?.onProgress?.(i + 1, svgs.length);
    if (i < svgs.length - 1 && delayMs > 0) await new Promise((r) => setTimeout(r, delayMs));
  }
}
