// Carousel 2.0 · studio shell (Slice 1 = the asset library).
// Facet rail + search + grid + field inspector. The editor canvas, AI
// auto-fill, verbatim bridge, and cover facelift mount here in later slices.

"use client";

import { useMemo, useState } from "react";
import { D as C, ft, gf, mn } from "../shared-constants";
import { useCatalog } from "./library/use-catalog";
import { AssetGrid } from "./library/asset-grid";
import { FieldInspector } from "./library/field-inspector";
import { Composer } from "./library/composer";
import type { CatalogProduct, CatalogTemplate, ProductKind } from "./catalog/types";

type KindFilter = "all" | ProductKind;

const KIND_TABS: { key: KindFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "background", label: "Backgrounds" },
  { key: "template", label: "Templates" },
  { key: "module", label: "Modules" },
];

export default function CarouselStudio() {
  const { products, byKind, loading, error, search, reload } = useCatalog();
  const [kind, setKind] = useState<KindFilter>("all");
  const [query, setQuery] = useState("");
  const [coverOnly, setCoverOnly] = useState(false);
  const [selected, setSelected] = useState<CatalogProduct | null>(null);
  const [composing, setComposing] = useState(false);

  const select = (p: CatalogProduct | null) => {
    setSelected(p);
    setComposing(false);
  };
  const selectedTemplate = selected && selected.kind === "template" ? (selected as CatalogTemplate) : null;
  const isSlotted = !!(selectedTemplate && selectedTemplate.slots && selectedTemplate.slots.length);

  const filtered = useMemo(() => {
    let list = search(query);
    if (kind !== "all") list = list.filter((p) => p.kind === kind);
    if (coverOnly) list = list.filter((p) => (p as { coverEligible?: boolean }).coverEligible);
    return list;
  }, [search, query, kind, coverOnly]);

  const count = (k: KindFilter) => (k === "all" ? products.length : byKind[k].length);

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <div style={{ fontFamily: mn, fontSize: 10, color: C.amber, letterSpacing: "2px", textTransform: "uppercase", marginBottom: 6 }}>
            Carousel 2.0 · Studio
          </div>
          <div style={{ fontFamily: gf, fontSize: 30, fontWeight: 900, color: C.tx, letterSpacing: -0.6 }}>Asset Library</div>
          <div style={{ fontFamily: ft, fontSize: 14, color: C.txm, marginTop: 6, maxWidth: 640 }}>
            Backgrounds, templates, and modules — parsed from SVG, fillable by AI. Browse, then build.
          </div>
        </div>
        <button
          onClick={() => reload()}
          style={{ padding: "8px 14px", background: C.surface, border: "1px solid " + C.border, borderRadius: 8, color: C.txm, fontFamily: mn, fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, cursor: "pointer" }}
        >
          ↻ Reload
        </button>
      </div>

      {/* Controls */}
      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 20, flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 6 }}>
          {KIND_TABS.map((t) => {
            const active = kind === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setKind(t.key)}
                style={{
                  padding: "8px 14px",
                  borderRadius: 8,
                  background: active ? C.amber + "18" : C.card,
                  border: "1px solid " + (active ? C.amber : C.border),
                  color: active ? C.amber : C.txm,
                  fontFamily: ft,
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                {t.label} <span style={{ opacity: 0.6 }}>{count(t.key)}</span>
              </button>
            );
          })}
        </div>

        <label
          onClick={() => setCoverOnly((v) => !v)}
          style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", padding: "8px 12px", borderRadius: 8, background: coverOnly ? C.amber + "18" : C.card, border: "1px solid " + (coverOnly ? C.amber + "60" : C.border) }}
        >
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: coverOnly ? C.amber : C.border }} />
          <span style={{ fontFamily: mn, fontSize: 10, fontWeight: 700, color: coverOnly ? C.amber : C.txm, letterSpacing: 0.5 }}>COVER-ELIGIBLE</span>
        </label>

        <div style={{ flex: 1 }} />

        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search title, tags, fields…"
          style={{ width: 280, padding: "9px 14px", background: C.card, border: "1px solid " + C.border, borderRadius: 8, color: C.tx, fontFamily: ft, fontSize: 13, outline: "none" }}
          onFocus={(e) => (e.currentTarget.style.borderColor = C.amber)}
          onBlur={(e) => (e.currentTarget.style.borderColor = C.border)}
        />
      </div>

      {/* Body */}
      {loading && (
        <div style={{ padding: 48, textAlign: "center", fontFamily: ft, fontSize: 13, color: C.txm, background: C.card, border: "1px solid " + C.border, borderRadius: 12 }}>
          Loading catalog…
        </div>
      )}
      {error && !loading && (
        <div style={{ padding: 24, fontFamily: mn, fontSize: 12, color: C.coral, background: C.coral + "10", border: "1px solid " + C.coral + "40", borderRadius: 12 }}>
          Failed to load catalog: {error}
        </div>
      )}
      {!loading && !error && (
        <div style={{ display: "flex", gap: 20, alignItems: "flex-start" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <AssetGrid products={filtered} onInspect={select} />
          </div>
          {selected && composing && selectedTemplate ? (
            <Composer template={selectedTemplate} products={products} onClose={() => setComposing(false)} />
          ) : selected ? (
            <FieldInspector
              product={selected}
              onClose={() => select(null)}
              onCompose={isSlotted ? () => setComposing(true) : undefined}
            />
          ) : null}
        </div>
      )}
    </div>
  );
}
