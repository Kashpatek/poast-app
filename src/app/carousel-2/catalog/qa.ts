// Carousel 2.0 · soft quality inspection (asset-agnostic).
//
// Produces amber WARNINGS / muted INFO notes about an already-parsed product —
// it never drops it (that's schema.validateProduct's job for STRUCTURAL
// failures). This is the "quality measures" surface for the soft-snap + export
// gate policy: the validator shows these on ingest, and the export/publish gate
// will aggregate the same notes before a slide ships.
//
// Pure — no React, no Fabric, no DOM — so the same checks run in the validator,
// a future export gate, or a headless test.

import { CANVAS_DIMS, dimsMatch, overflowReport, rectsOverlap } from "../../lib/canvas-fit";
import type { CatalogProduct, CatalogTemplate, TemplateSlot } from "./types";

export interface QANote {
  level: "warn" | "info";
  message: string;
}

export function inspectProduct(p: CatalogProduct): QANote[] {
  const notes: QANote[] = [];
  const canvas = CANVAS_DIMS;

  // 1. Dimensions — full-slide kinds (background / overlay / template) must be
  //    authored at the canvas size to affix cleanly. Modules are measured by
  //    their anchor and are exempt.
  if (p.kind !== "module" && !dimsMatch(p.dims, canvas)) {
    notes.push({
      level: "warn",
      message: `authored at ${p.dims.width}×${p.dims.height}, not ${canvas.width}×${canvas.height} — it will not affix to the slide`,
    });
  }

  // 2/3. Slots — off-canvas regions (clamped on render) and colliding regions.
  const slots: TemplateSlot[] = p.kind === "template" ? (p as CatalogTemplate).slots || [] : [];
  slots.forEach((s) => {
    const o = overflowReport(s.region, canvas);
    if (o.overflows) {
      const sides = [o.left && "left", o.right && "right", o.top && "top", o.bottom && "bottom"]
        .filter(Boolean)
        .join("/");
      notes.push({
        level: "warn",
        message: `slot "${s.id}" extends past the canvas (${sides}, up to ${Math.max(o.dx, o.dy)}px) — clamped on render`,
      });
    }
  });
  for (let i = 0; i < slots.length; i++) {
    for (let j = i + 1; j < slots.length; j++) {
      if (rectsOverlap(slots[i].region, slots[j].region)) {
        notes.push({ level: "warn", message: `slots "${slots[i].id}" and "${slots[j].id}" overlap — widgets may collide` });
      }
    }
  }

  // 4. Field constraints — parsed today but never checked against the content.
  p.fields.forEach((f) => {
    const c = f.constraints;
    if (!c) return;
    if (c.maxLen != null && f.defaultValue && f.defaultValue.length > c.maxLen) {
      notes.push({ level: "warn", message: `field "${f.name}" default is ${f.defaultValue.length} chars, over maxLen ${c.maxLen}` });
    }
    if (c.required && !f.defaultValue) {
      notes.push({ level: "info", message: `field "${f.name}" is required but has no default/placeholder` });
    }
  });

  return notes;
}
