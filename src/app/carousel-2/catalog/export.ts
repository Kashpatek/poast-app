// Carousel 2.0 · PNG export (asset-agnostic).
// Rasterizes any self-contained SVG string (a product, a filled slide, or a
// composed design) to a PNG Blob via a canvas, then triggers a download.
// Client-only. Note: waits for fonts so text renders in Grift/Outfit; external
// (non-data-URL) images inside the SVG can taint the canvas — inline as data
// URLs before export when that matters (the AI image path already does).

const XMLNS = "http://www.w3.org/2000/svg";

// Ensure the svg root declares xmlns + explicit pixel width/height so the
// browser rasterizes it at the intended size.
function normalizeSvg(svg: string, w: number, h: number): string {
  let s = svg;
  if (!/xmlns=/.test(s)) s = s.replace(/^<svg /, `<svg xmlns="${XMLNS}" `);
  // Force pixel dimensions (strip a style width/height override if present).
  s = s.replace(/^<svg([^>]*)>/, (_m, attrs) => {
    const cleaned = String(attrs)
      .replace(/\swidth="[^"]*"/i, "")
      .replace(/\sheight="[^"]*"/i, "")
      .replace(/\sstyle="[^"]*"/i, "");
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
