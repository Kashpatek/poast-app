// Carousel 2.0 · editor bridge (one-way → design-studio Fabric editor).
//
// Opens a catalog product or a composed slide as EDITABLE Fabric objects in the
// existing design-studio canvas editor. `loadSVGFromString` flattens the SVG
// into individual objects (<text>→Textbox, shapes→Rect/Path, <image>→Image), so
// the slide becomes fully editable — the "Canva-like" surface.
//
// One-way by design: nothing here writes back into the carousel-2 catalog (the
// catalog stays the read-only source). The opened design persists as a
// design-studio ProjectRecord — i.e. it lands in the user's archive (the
// /design-studio hub), findable + re-openable later.
//
// Client-only: Fabric + a temp canvas need the browser, so `fabric` is a dynamic
// import (matches parser.ts) and these functions throw if called during SSR.

import { saveProject } from "../../design-studio/projects-store";
import { uid } from "../../shared-constants";

/* eslint-disable @typescript-eslint/no-explicit-any */

// Derive the artboard's PAGE color from the slide's SVG: the fill of its
// full-bleed background rect (SA templates open with one, e.g. #06060C), else
// white. This becomes the Fabric canvas backgroundColor so the editor page is a
// solid, template-colored artboard — not a transparent (checkerboard) surface.
export function pageColorFromSvg(svg: string, width: number, height: number): string {
  const rects = svg.match(/<rect\b[^>]*>/gi) || [];
  for (const tag of rects) {
    const num = (attr: string): number => {
      const m = tag.match(new RegExp(attr + '\\s*=\\s*"([\\d.]+)"'));
      return m ? parseFloat(m[1]) : NaN;
    };
    const x = num("x");
    const y = num("y");
    const rw = num("width");
    const rh = num("height");
    const fillM = tag.match(/fill\s*=\s*"([^"]+)"/i);
    const fill = fillM ? fillM[1] : "";
    const fullBleed = (isNaN(x) || x <= 1) && (isNaN(y) || y <= 1) && rw >= width * 0.98 && rh >= height * 0.98;
    if (fullBleed && fill && fill !== "none" && !/^url\(/i.test(fill)) return fill;
  }
  return "#FFFFFF";
}

// Rasterize a self-contained SVG into a Fabric `canvas.toJSON()` payload
// ({version, objects, background}) that the design-studio editor rehydrates via
// loadFromJSON. The `background` makes the artboard a solid page (loadFromJSON
// resets an absent background to transparent, which is what showed the
// checkerboard through the page).
// TODO(editor autofill seam): a loadSVGFromString reviver could copy
// data-field/data-role onto each object + propertiesToInclude to preserve field
// locators for editor-side AI fill. Deferred — nothing consumes it yet.
export async function svgToCanvasPayload(
  svg: string,
  width: number,
  height: number
): Promise<{ version: string; objects: unknown[]; background?: string }> {
  if (typeof window === "undefined" || typeof document === "undefined") {
    throw new Error("editor bridge requires a browser");
  }
  try {
    if (document.fonts && document.fonts.ready) await document.fonts.ready;
  } catch {
    /* ignore */
  }
  const fabric: any = await import("fabric");
  const el = document.createElement("canvas");
  el.width = width;
  el.height = height;
  const background = pageColorFromSvg(svg, width, height);
  const sc = new fabric.StaticCanvas(el, { width, height, backgroundColor: background, enableRetinaScaling: false });
  try {
    const out = await fabric.loadSVGFromString(svg);
    (out.objects || []).filter(Boolean).forEach((o: any) => sc.add(o));
    sc.renderAll();
    const json: any = sc.toJSON();
    return { version: json.version, objects: json.objects || [], background: json.background ?? background };
  } finally {
    try {
      sc.dispose();
    } catch {
      /* ignore */
    }
  }
}

/* eslint-enable @typescript-eslint/no-explicit-any */

// Build a persisted design-studio project from a self-contained SVG and return
// its id. Open it with editorHref(id). Creates a fresh archive project each call
// (the Canva "make a copy" model — one-way, never mutates the catalog).
export async function openSvgInEditor(opts: {
  svg: string;
  width: number;
  height: number;
  title: string;
}): Promise<string> {
  const payload = await svgToCanvasPayload(opts.svg, opts.width, opts.height);
  const saved = await saveProject({
    title: opts.title,
    kind: "canvas",
    category: "carousel", // enables the editor's multi-page carousel strip
    preset: { width: opts.width, height: opts.height, name: "carousel" },
    pages: [{ id: uid("page"), payload }],
  });
  return saved.id;
}

// Route to open the design-studio editor on a given project id.
export function editorHref(projectId: string): string {
  return `/design-studio/canvas-editor?id=${encodeURIComponent(projectId)}`;
}
