// Carousel 2.0 · asset validator (handoff loop).
// Paste or drop an SVG-in-HTML asset and see EXACTLY how the ingestion parser
// reads it — fields, slots, preview, warnings — without touching the manifest
// or saving anything. The tight feedback loop for authoring new overlays.

"use client";

import { useEffect, useState } from "react";
import { D as C, ft, gf, mn } from "../../shared-constants";
import { ingestHtml, measureContentBBox } from "../catalog/parser";
import { inspectProduct, type QANote } from "../catalog/qa";
import { CANVAS_DIMS, CAROUSEL_SAFE_ZONE, dimsMatch, measureMargins, type MarginReport } from "../../lib/canvas-fit";
import type { CatalogField, CatalogProduct, CatalogTemplate } from "../catalog/types";

function previewSvg(svg: string): string {
  return svg.replace(/^<svg /, '<svg style="width:100%;height:100%;display:block" ');
}

function FieldLine({ f }: { f: CatalogField }) {
  const loc = f.locator.dataField
    ? `data-field="${f.locator.dataField}"`
    : f.locator.svgId
    ? `#${f.locator.svgId}`
    : typeof f.locator.objectIndex === "number"
    ? `object[${f.locator.objectIndex}]`
    : "—";
  return (
    <div style={{ display: "flex", gap: 8, fontFamily: mn, fontSize: 10, color: C.txm, padding: "4px 0", borderBottom: "1px solid " + C.border }}>
      <span style={{ color: C.tx, minWidth: 90, fontWeight: 700 }}>{f.name}</span>
      <span style={{ color: C.cyan, minWidth: 56 }}>{f.type}</span>
      <span style={{ color: C.amber, minWidth: 76 }}>{f.locator.role || "—"}</span>
      <span style={{ color: C.txd }}>{loc}</span>
    </div>
  );
}

function ParsedCard({ product }: { product: CatalogProduct }) {
  const slots = product.kind === "template" ? (product as CatalogTemplate).slots || [] : [];
  const inferred = !!(product.meta && (product.meta as { inferred?: boolean }).inferred);

  const notes: QANote[] = [];
  if (!product.fields.length && !slots.length) notes.push({ level: "warn", message: "no fields or slots detected — decorative, or add data-field / data-slot" });
  if (inferred) notes.push({ level: "warn", message: "some fields were heuristically inferred — annotate with data-field/data-role for stability" });
  notes.push(...inspectProduct(product));

  // Measured content geometry — so we can SEE the asset's real safe zone.
  const [margins, setMargins] = useState<MarginReport | null>(null);
  useEffect(() => {
    let alive = true;
    measureContentBBox(product).then((bbox) => {
      if (!alive || !bbox) return;
      setMargins(measureMargins(bbox, { width: product.dims.width, height: product.dims.height }));
    });
    return () => {
      alive = false;
    };
  }, [product]);

  const intrinsic = (product.meta && (product.meta as { intrinsic?: { width: number; height: number } }).intrinsic) || product.dims;
  const dimsOk = dimsMatch(intrinsic, CANVAS_DIMS);

  return (
    <div style={{ display: "flex", gap: 16, padding: 16, border: "1px solid " + C.border, borderRadius: 12, background: C.card, marginBottom: 14 }}>
      <div style={{ width: 200, flexShrink: 0 }}>
        <div style={{ width: "100%", aspectRatio: `${product.dims.width}/${product.dims.height}`, background: "#06060C", borderRadius: 8, overflow: "hidden", border: "1px solid " + C.border }} dangerouslySetInnerHTML={{ __html: previewSvg(product.svg) }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <span style={{ fontFamily: mn, fontSize: 9, fontWeight: 700, textTransform: "uppercase", color: "#fff", background: (product.kind === "background" ? C.blue : product.kind === "module" ? C.cyan : C.amber) + "cc", padding: "3px 7px", borderRadius: 5 }}>
            {product.kind === "module" ? (product as { moduleType?: string }).moduleType || "module" : product.kind}
          </span>
          <span style={{ fontFamily: gf, fontSize: 16, fontWeight: 800, color: C.tx }}>{product.title}</span>
          <span style={{ fontFamily: mn, fontSize: 10, color: C.txd }}>{product.id}</span>
        </div>

        {/* measured geometry / safe-zone readout */}
        <div data-testid="carousel2-geometry" style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", margin: "6px 0 8px", fontFamily: mn, fontSize: 10 }}>
          <span style={{ color: C.txm, textTransform: "uppercase", letterSpacing: 1.2, fontSize: 9 }}>geometry</span>
          <span style={{ color: dimsOk ? C.teal : C.amber, border: "1px solid " + (dimsOk ? C.teal : C.amber) + "55", borderRadius: 5, padding: "2px 7px" }}>
            {intrinsic.width}×{intrinsic.height}{dimsOk ? " ✓" : ` ≠ ${CANVAS_DIMS.width}×${CANVAS_DIMS.height}`}
          </span>
          {product.kind !== "module" && margins && (
            margins.fullBleed ? (
              <span style={{ color: C.txd }}>full-bleed</span>
            ) : (
              <span style={{ color: C.txd }}>
                content margins · L{margins.left} R{margins.right} T{margins.top} B{margins.bottom}
                {margins.symmetricX && margins.symmetricY ? " · symmetric" : ""}
              </span>
            )
          )}
          {product.kind !== "module" && (
            <span style={{ color: C.txd, opacity: 0.75 }}>
              safe-zone target · L{CAROUSEL_SAFE_ZONE.left} R{CAROUSEL_SAFE_ZONE.right} T{CAROUSEL_SAFE_ZONE.top} B{CAROUSEL_SAFE_ZONE.bottom}
            </span>
          )}
        </div>

        {notes.map((n, i) => {
          const col = n.level === "warn" ? C.amber : C.txm;
          return (
            <div key={i} style={{ fontFamily: ft, fontSize: 11, color: col, background: col + "10", border: "1px solid " + col + "30", borderRadius: 6, padding: "6px 8px", marginBottom: 6 }}>
              {n.level === "warn" ? "⚠" : "ℹ"} {n.message}
            </div>
          );
        })}

        <div style={{ fontFamily: mn, fontSize: 9, color: C.amber, textTransform: "uppercase", letterSpacing: 1.2, margin: "8px 0 4px" }}>Fields · {product.fields.length}</div>
        {product.fields.length ? product.fields.map((f) => <FieldLine key={f.name} f={f} />) : <div style={{ fontFamily: ft, fontSize: 11, color: C.txd }}>none</div>}

        {slots.length > 0 && (
          <>
            <div style={{ fontFamily: mn, fontSize: 9, color: C.cyan, textTransform: "uppercase", letterSpacing: 1.2, margin: "10px 0 4px" }}>Slots · {slots.length}</div>
            {slots.map((s) => (
              <div key={s.id} style={{ display: "flex", gap: 8, fontFamily: mn, fontSize: 10, color: C.txm, padding: "4px 0", borderBottom: "1px solid " + C.border }}>
                <span style={{ color: C.tx, minWidth: 90, fontWeight: 700 }}>{s.id}</span>
                <span style={{ color: C.cyan }}>accepts: {s.accepts.join(", ")}</span>
                <span style={{ color: C.txd, marginLeft: "auto" }}>{s.region.x},{s.region.y} · {s.region.w}×{s.region.h}</span>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

export function AssetValidator() {
  const [html, setHtml] = useState("");
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [busy, setBusy] = useState(false);
  const [ran, setRan] = useState(false);
  const [drag, setDrag] = useState(false);

  async function parse(src?: string) {
    const h = (src ?? html).trim();
    if (!h) return;
    setBusy(true);
    setRan(true);
    try {
      setProducts(await ingestHtml(h, "pasted.html"));
    } catch {
      setProducts([]);
    } finally {
      setBusy(false);
    }
  }

  function onFile(f?: File | null) {
    if (!f) return;
    const r = new FileReader();
    r.onload = (e) => {
      const t = String((e.target && e.target.result) || "");
      setHtml(t);
      parse(t);
    };
    r.readAsText(f);
  }

  return (
    <div>
      <div style={{ fontFamily: ft, fontSize: 13, color: C.txm, marginBottom: 12, maxWidth: 720 }}>
        Paste your SVG-in-HTML (or drop a file) to see exactly how the parser reads it — detected fields, slots, and a live preview. Nothing is saved; this is just to sanity-check overlays as you build them.
      </div>
      <div
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); if (e.dataTransfer.files.length) onFile(e.dataTransfer.files[0]); }}
        style={{ marginBottom: 12 }}
      >
        <textarea
          value={html}
          onChange={(e) => setHtml(e.target.value)}
          placeholder="Paste the full HTML including the <svg>…</svg> (and optional <!-- @carouselAsset … --> marker)."
          rows={8}
          style={{ width: "100%", padding: "12px 14px", background: drag ? C.amber + "08" : C.card, border: "1px solid " + (drag ? C.amber : C.border), borderRadius: 10, color: C.tx, fontFamily: mn, fontSize: 12, lineHeight: 1.5, resize: "vertical", outline: "none", boxSizing: "border-box" }}
        />
      </div>
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 20 }}>
        <button onClick={() => parse()} disabled={busy || !html.trim()} style={{ padding: "9px 20px", borderRadius: 8, background: busy || !html.trim() ? C.surface : C.amber, border: "none", color: busy || !html.trim() ? C.txd : C.bg, fontFamily: ft, fontSize: 13, fontWeight: 800, cursor: busy || !html.trim() ? "not-allowed" : "pointer" }}>
          {busy ? "Parsing…" : "Parse asset"}
        </button>
        <label style={{ fontFamily: mn, fontSize: 10, color: C.txm, cursor: "pointer", padding: "8px 14px", border: "1px solid " + C.border, borderRadius: 8, background: C.card }}>
          Upload .html
          <input type="file" accept=".html,.htm,.svg,.txt" onChange={(e) => onFile(e.target.files && e.target.files[0])} style={{ display: "none" }} />
        </label>
      </div>

      {ran && !busy && !products.length && (
        <div style={{ padding: 20, fontFamily: ft, fontSize: 13, color: C.coral, background: C.coral + "10", border: "1px solid " + C.coral + "40", borderRadius: 10 }}>
          No product parsed. Make sure the file contains an <code>&lt;svg&gt;</code> (1080×1350). A first-line <code>&lt;!-- @carouselAsset kind=… --&gt;</code> marker sets kind/id/category.
        </div>
      )}
      {products.map((p) => (
        <ParsedCard key={p.id} product={p} />
      ))}
    </div>
  );
}
