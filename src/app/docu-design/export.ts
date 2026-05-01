import type { Artboard } from "./artboard-ops";

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

function safeFilename(name: string, suffix?: string): string {
  const base = name.replace(/[^a-z0-9-_]+/gi, "_").replace(/^_+|_+$/g, "") || "untitled";
  return suffix ? `${base}-${suffix}` : base;
}

function ensureSvgRoot(svg: string, w: number, h: number): string {
  const trimmed = svg.trim();
  if (trimmed.startsWith("<svg")) return trimmed;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">${trimmed}</svg>`;
}

export function exportSVG(projectName: string, artboards: Artboard[]): void {
  if (!artboards.length) return;

  if (artboards.length === 1) {
    const a = artboards[0];
    const svg = ensureSvgRoot(a.svg, a.w, a.h);
    downloadBlob(new Blob([svg], { type: "image/svg+xml" }), `${safeFilename(projectName)}.svg`);
    return;
  }

  artboards.forEach((a, i) => {
    const svg = ensureSvgRoot(a.svg, a.w, a.h);
    const idx = String(i + 1).padStart(2, "0");
    const label = a.label ? safeFilename(a.label) : `page-${idx}`;
    downloadBlob(new Blob([svg], { type: "image/svg+xml" }), `${safeFilename(projectName)}-${label}.svg`);
  });
}
