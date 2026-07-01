// Carousel 2.0 · composition engine (Slice 2).
//
// The association layer: overlays (templates) declare SLOTS (blocking/rules);
// modules are WIDGETS that get assigned into slots; a DesignComposition is the
// custom build, and it resolves to ordered LAYERS (background → overlay →
// assigned widgets) for a live preview / future editor + export.
//
// Pure module — no React, no Fabric. Renders a self-contained SVG by nesting
// each layer's <svg> (a widget is scaled from its content box into the slot
// region via a nested viewBox).

import {
  SLIDE_DIMS,
  type CatalogBackground,
  type CatalogModule,
  type CatalogProduct,
  type CatalogTemplate,
  type DesignComposition,
  type DesignLayer,
  type TemplateSlot,
} from "./types";

// ── association ──────────────────────────────────────────────────────────────

// Does a widget (module) fit a slot's rules? Slot `accepts` lists module types,
// or the generics "module" (any), "text" (text-ish), "image".
export function moduleFitsSlot(module: CatalogModule, slot: TemplateSlot): boolean {
  const a = slot.accepts;
  if (a.indexOf("module") !== -1) return true;
  if (a.indexOf(module.moduleType) !== -1) return true;
  if (a.indexOf("text") !== -1 && (module.moduleType === "text-box" || module.moduleType === "quote" || module.moduleType === "stat")) return true;
  return false;
}

export function modulesForSlot(slot: TemplateSlot, modules: CatalogModule[]): CatalogModule[] {
  return modules.filter((m) => moduleFitsSlot(m, slot));
}

export function slotsForModule(module: CatalogModule, template: CatalogTemplate): TemplateSlot[] {
  return (template.slots || []).filter((s) => moduleFitsSlot(module, s));
}

// ── composition CRUD (immutable) ─────────────────────────────────────────────

export function createComposition(overlay: CatalogTemplate, background?: CatalogBackground): DesignComposition {
  const now = Date.now();
  return {
    id: "comp-" + now.toString(36),
    title: overlay.title,
    dims: overlay.dims || SLIDE_DIMS,
    backgroundId: background?.id,
    overlayId: overlay.id,
    assignments: (overlay.slots || []).map((s) => ({ slotId: s.id })),
    createdAt: now,
    updatedAt: now,
  };
}

export function assignModuleToSlot(comp: DesignComposition, slotId: string, moduleId?: string): DesignComposition {
  const found = comp.assignments.some((x) => x.slotId === slotId);
  const assignments = found
    ? comp.assignments.map((x) => (x.slotId === slotId ? { ...x, moduleId } : x))
    : comp.assignments.concat([{ slotId, moduleId }]);
  return { ...comp, assignments, updatedAt: Date.now() };
}

export function setBackground(comp: DesignComposition, backgroundId?: string): DesignComposition {
  return { ...comp, backgroundId, updatedAt: Date.now() };
}

// ── layer resolution + render ─────────────────────────────────────────────────

type Getter = (id: string) => CatalogProduct | undefined;

export function compositionToLayers(comp: DesignComposition, get: Getter): DesignLayer[] {
  const layers: DesignLayer[] = [];
  if (comp.backgroundId) {
    const bg = get(comp.backgroundId);
    if (bg) layers.push({ kind: "background", productId: bg.id, svg: bg.svg });
  }
  const overlay = get(comp.overlayId) as CatalogTemplate | undefined;
  if (overlay) layers.push({ kind: "overlay", productId: overlay.id, svg: overlay.svg });
  comp.assignments.forEach((a) => {
    if (!a.moduleId) return;
    const mod = get(a.moduleId);
    if (!mod) return;
    const slot = overlay?.slots?.find((s) => s.id === a.slotId);
    layers.push({ kind: "module", productId: mod.id, region: slot?.region, svg: mod.svg });
  });
  return layers;
}

export function extractSvgInner(svg: string): string {
  const open = svg.search(/<svg[^>]*>/i);
  if (open === -1) return svg;
  const start = svg.indexOf(">", open) + 1;
  const end = svg.lastIndexOf("</svg>");
  return end > start ? svg.slice(start, end) : svg.slice(start);
}

function sourceViewBox(p: CatalogProduct): string {
  // A module with an anchor exposes just its content box, so it scales cleanly
  // into a slot. Everything else uses the full slide.
  const anchor = (p as CatalogModule).anchor;
  if (p.kind === "module" && anchor) return `${anchor.x} ${anchor.y} ${anchor.w} ${anchor.h}`;
  return `0 0 ${SLIDE_DIMS.width} ${SLIDE_DIMS.height}`;
}

// Compose the layers into one self-contained SVG string (crisp preview; also
// the seed for future rasterized export). Widgets are nested + fit into slots.
export function renderCompositionSvg(comp: DesignComposition, get: Getter): string {
  const w = comp.dims.width;
  const h = comp.dims.height;
  const layers = compositionToLayers(comp, get);
  const getP = (id: string) => get(id);
  const parts = layers.map((layer) => {
    const p = getP(layer.productId);
    const inner = extractSvgInner(layer.svg);
    if (layer.kind === "module" && layer.region) {
      const r = layer.region;
      const vb = p ? sourceViewBox(p) : `0 0 ${w} ${h}`;
      return `<svg x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" viewBox="${vb}" preserveAspectRatio="xMidYMid meet" overflow="visible">${inner}</svg>`;
    }
    return `<svg x="0" y="0" width="${w}" height="${h}" viewBox="0 0 ${SLIDE_DIMS.width} ${SLIDE_DIMS.height}">${inner}</svg>`;
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">${parts.join("")}</svg>`;
}
