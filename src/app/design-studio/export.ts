"use client";

import { saveAs } from "file-saver";
import JSZip from "jszip";
import { jsPDF } from "jspdf";
import type { Canvas, StaticCanvas } from "fabric";
import type { Artboard } from "./artboard-ops";

// Either a live interactive Canvas or a headless StaticCanvas — both expose
// toDataURL / toSVG with identical signatures for our purposes.
type AnyFabricCanvas = Canvas | StaticCanvas;

export interface FabricExportable {
  canvases: AnyFabricCanvas[];
  title: string;
  filename?: string;
}

function slugify(s: string): string {
  return s.replace(/[^A-Za-z0-9_-]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 60) || "design";
}

function baseName(input: FabricExportable): string {
  return slugify(input.filename || input.title);
}

function pageLabel(i: number, total: number): string {
  const width = String(total).length < 2 ? 2 : String(total).length;
  return `page-${String(i + 1).padStart(width, "0")}`;
}

// PNG / JPG / SVG single-page = dump first canvas. Multi-page = zip.

export async function exportFabricPNG(input: FabricExportable, opts?: { multiplier?: number }): Promise<void> {
  const multiplier = opts?.multiplier ?? 2;
  if (input.canvases.length === 0) return;
  if (input.canvases.length === 1) {
    const dataUrl = input.canvases[0].toDataURL({ format: "png", multiplier });
    const blob = await (await fetch(dataUrl)).blob();
    saveAs(blob, baseName(input) + ".png");
    return;
  }
  await exportFabricZip(input, "png");
}

export async function exportFabricJPG(input: FabricExportable, opts?: { multiplier?: number; quality?: number }): Promise<void> {
  const multiplier = opts?.multiplier ?? 2;
  const quality = opts?.quality ?? 0.92;
  if (input.canvases.length === 0) return;
  if (input.canvases.length === 1) {
    const dataUrl = input.canvases[0].toDataURL({ format: "jpeg", multiplier, quality });
    const blob = await (await fetch(dataUrl)).blob();
    saveAs(blob, baseName(input) + ".jpg");
    return;
  }
  await exportFabricZip(input, "jpg");
}

export async function exportFabricSVG(input: FabricExportable): Promise<void> {
  if (input.canvases.length === 0) return;
  if (input.canvases.length === 1) {
    const svg = input.canvases[0].toSVG();
    saveAs(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }), baseName(input) + ".svg");
    return;
  }
  await exportFabricZip(input, "svg");
}

export async function exportFabricPDF(input: FabricExportable): Promise<void> {
  if (input.canvases.length === 0) return;
  const multiplier = 2;
  const first = input.canvases[0];
  // jsPDF expects format as [w, h] in the chosen unit. Pixel-unit PDFs let
  // us drop the bitmap in at native resolution without re-scaling.
  const firstDim: [number, number] = [first.width || 1, first.height || 1];
  const doc = new jsPDF({
    orientation: firstDim[0] >= firstDim[1] ? "l" : "p",
    unit: "px",
    format: firstDim,
    hotfixes: ["px_scaling"],
  });
  for (let i = 0; i < input.canvases.length; i++) {
    const c = input.canvases[i];
    const w = c.width || 1;
    const h = c.height || 1;
    if (i > 0) {
      doc.addPage([w, h], w >= h ? "l" : "p");
    }
    const dataUrl = c.toDataURL({ format: "png", multiplier });
    doc.addImage(dataUrl, "PNG", 0, 0, w, h);
  }
  doc.save(baseName(input) + ".pdf");
}

export async function exportFabricZip(input: FabricExportable, format: "png" | "jpg" | "svg"): Promise<void> {
  if (input.canvases.length === 0) return;
  const zip = new JSZip();
  const total = input.canvases.length;
  for (let i = 0; i < total; i++) {
    const c = input.canvases[i];
    const name = pageLabel(i, total);
    if (format === "svg") {
      zip.file(name + ".svg", c.toSVG());
    } else if (format === "png") {
      const dataUrl = c.toDataURL({ format: "png", multiplier: 2 });
      const blob = await (await fetch(dataUrl)).blob();
      zip.file(name + ".png", blob);
    } else {
      const dataUrl = c.toDataURL({ format: "jpeg", multiplier: 2, quality: 0.92 });
      const blob = await (await fetch(dataUrl)).blob();
      zip.file(name + ".jpg", blob);
    }
  }
  const out = await zip.generateAsync({ type: "blob" });
  saveAs(out, baseName(input) + ".zip");
}

// --- Legacy SVG export from raw Artboard records ---------------------------
// project-client.tsx still calls exportSVG(name, artboards[]) on the
// pre-Fabric data shape. Keep it working until that route gets migrated.

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
