// Carousel 2.0 · composer (Slice 2).
// Custom-build in the catalogue: pick an overlay (blocking) + a background, then
// assign widget modules into the overlay's slots. Live layered preview. The
// composition is the seed the editor/export slices will consume.

"use client";

import { useMemo, useState } from "react";
import { D as C, ft, gf, mn } from "../../shared-constants";
import {
  createComposition,
  assignModuleToSlot,
  setBackground,
  modulesForSlot,
  renderCompositionSvg,
} from "../catalog/composition";
import type { CatalogBackground, CatalogModule, CatalogProduct, CatalogTemplate } from "../catalog/types";

function Chip({ active, color, onClick, children }: { active: boolean; color: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "5px 11px",
        borderRadius: 999,
        cursor: "pointer",
        background: active ? color + "22" : C.bg,
        border: "1px solid " + (active ? color + "80" : C.border),
        color: active ? color : C.txm,
        fontFamily: mn,
        fontSize: 10,
        fontWeight: 600,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </button>
  );
}

export function Composer({ template, products, onClose }: { template: CatalogTemplate; products: CatalogProduct[]; onClose: () => void }) {
  const get = useMemo(() => {
    const m = new Map(products.map((p) => [p.id, p] as const));
    return (id: string): CatalogProduct | undefined => m.get(id);
  }, [products]);
  const modules = useMemo(() => products.filter((p) => p.kind === "module") as CatalogModule[], [products]);
  const backgrounds = useMemo(() => products.filter((p) => p.kind === "background") as CatalogBackground[], [products]);

  const [comp, setComp] = useState(() => createComposition(template));
  const slots = template.slots || [];

  const previewSvg = useMemo(() => {
    const raw = renderCompositionSvg(comp, get);
    return raw.replace(/^<svg /, '<svg style="width:100%;height:100%;display:block" ');
  }, [comp, get]);

  const assignedOf = (slotId: string) => comp.assignments.find((a) => a.slotId === slotId)?.moduleId;

  return (
    <div
      data-testid="carousel2-composer"
      style={{ position: "sticky", top: 16, alignSelf: "flex-start", width: 380, flexShrink: 0, maxHeight: "calc(100vh - 40px)", overflowY: "auto", background: C.card, border: "1px solid " + C.border, borderRadius: 14, padding: 18 }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14 }}>
        <div>
          <div style={{ fontFamily: mn, fontSize: 9, color: C.cyan, textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 4 }}>Compose · custom build</div>
          <div style={{ fontFamily: gf, fontSize: 18, fontWeight: 800, color: C.tx, letterSpacing: -0.3 }}>{template.title}</div>
        </div>
        <button onClick={onClose} style={{ background: "transparent", border: "1px solid " + C.border, borderRadius: 6, color: C.txm, fontFamily: mn, fontSize: 12, cursor: "pointer", padding: "4px 8px" }}>✕</button>
      </div>

      {/* live layered preview */}
      <div style={{ width: "100%", aspectRatio: "1080/1350", background: "#06060C", borderRadius: 10, overflow: "hidden", border: "1px solid " + C.border, marginBottom: 16 }} dangerouslySetInnerHTML={{ __html: previewSvg }} />

      {/* background */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontFamily: mn, fontSize: 9, color: C.blue, textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 8 }}>Background</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          <Chip active={!comp.backgroundId} color={C.blue} onClick={() => setComp(setBackground(comp, undefined))}>none</Chip>
          {backgrounds.map((b) => (
            <Chip key={b.id} active={comp.backgroundId === b.id} color={C.blue} onClick={() => setComp(setBackground(comp, b.id))}>{b.title}</Chip>
          ))}
        </div>
      </div>

      {/* slots → widgets */}
      <div style={{ fontFamily: mn, fontSize: 9, color: C.amber, textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 10 }}>
        Slots · {slots.length}
      </div>
      {slots.length === 0 && <div style={{ fontFamily: ft, fontSize: 12, color: C.txm }}>This overlay has no slots (self-contained template).</div>}
      {slots.map((slot) => {
        const fits = modulesForSlot(slot, modules);
        const assigned = assignedOf(slot.id);
        return (
          <div key={slot.id} style={{ padding: "12px 14px", border: "1px solid " + C.border, borderRadius: 10, background: C.bg, marginBottom: 8 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <div style={{ fontFamily: mn, fontSize: 12, fontWeight: 700, color: C.tx }}>{slot.label || slot.id}</div>
              <div style={{ fontFamily: mn, fontSize: 9, color: C.txd }}>accepts: {slot.accepts.join(", ")}</div>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              <Chip active={!assigned} color={C.amber} onClick={() => setComp(assignModuleToSlot(comp, slot.id, undefined))}>empty</Chip>
              {fits.map((m) => (
                <Chip key={m.id} active={assigned === m.id} color={C.amber} onClick={() => setComp(assignModuleToSlot(comp, slot.id, m.id))}>{m.title}</Chip>
              ))}
              {fits.length === 0 && <span style={{ fontFamily: ft, fontSize: 11, color: C.txd }}>no compatible widgets yet</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
