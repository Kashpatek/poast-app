// Carousel 2.0 · field inspector (Slice 1).
// A right-side drawer showing a product's AI-fillable fields[] — the
// contract-visibility / QA surface while assets are authored (SVG-in-HTML).

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { D as C, ft, gf, mn } from "../../shared-constants";
import { AutofillPanel } from "./autofill-panel";
import { exportSvgPng } from "../catalog/export";
import { openSvgInEditor, editorHref } from "../catalog/editor-bridge";
import type { CatalogField, CatalogProduct, CatalogTemplate } from "../catalog/types";

const TYPE_COLOR: Record<string, string> = {
  text: C.tx,
  richtext: C.tx,
  image: C.blue,
  chart: C.cyan,
  number: C.teal,
  color: C.violet,
};

function locatorLabel(f: CatalogField): string {
  const l = f.locator;
  if (l.dataField) return `data-field="${l.dataField}"`;
  if (l.svgId) return `#${l.svgId}`;
  if (typeof l.objectIndex === "number") return `object[${l.objectIndex}]`;
  return "—";
}

function FieldRow({ f }: { f: CatalogField }) {
  const c = TYPE_COLOR[f.type] || C.tx;
  const cons = f.constraints
    ? Object.entries(f.constraints)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => `${k}:${v}`)
        .join(" · ")
    : "";
  return (
    <div style={{ padding: "12px 14px", border: "1px solid " + C.border, borderRadius: 10, background: C.bg, marginBottom: 8 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
        <div style={{ fontFamily: mn, fontSize: 13, fontWeight: 700, color: C.tx }}>{f.name}</div>
        <span style={{ fontFamily: mn, fontSize: 9, fontWeight: 700, textTransform: "uppercase", color: c, border: "1px solid " + c + "55", borderRadius: 5, padding: "2px 7px" }}>
          {f.type}
        </span>
      </div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", fontFamily: mn, fontSize: 10, color: C.txm }}>
        {f.locator.role && <span>role: <span style={{ color: C.amber }}>{f.locator.role}</span></span>}
        <span>locator: <span style={{ color: C.txm }}>{locatorLabel(f)}</span></span>
        {cons && <span>{cons}</span>}
      </div>
      {f.defaultValue && (
        <div style={{ fontFamily: ft, fontSize: 12, color: C.txm, marginTop: 6, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          “{f.defaultValue}”
        </div>
      )}
    </div>
  );
}

export function FieldInspector({ product, onClose, onCompose }: { product: CatalogProduct; onClose: () => void; onCompose?: () => void }) {
  const inferred = !!(product.meta && (product.meta as { inferred?: boolean }).inferred);
  const slots = product.kind === "template" ? (product as CatalogTemplate).slots || [] : [];
  const router = useRouter();
  const [opening, setOpening] = useState(false);
  async function editInCanvas() {
    if (opening) return;
    setOpening(true);
    try {
      const id = await openSvgInEditor({ svg: product.svg, width: product.dims.width, height: product.dims.height, title: product.title });
      router.push(editorHref(id));
    } catch {
      setOpening(false);
    }
  }
  return (
    <div
      data-testid="carousel2-inspector"
      style={{
        position: "sticky",
        top: 16,
        alignSelf: "flex-start",
        width: 340,
        flexShrink: 0,
        maxHeight: "calc(100vh - 40px)",
        overflowY: "auto",
        background: C.card,
        border: "1px solid " + C.border,
        borderRadius: 14,
        padding: 18,
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12 }}>
        <div>
          <div style={{ fontFamily: mn, fontSize: 9, color: C.txm, textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 4 }}>
            {product.kind}
            {inferred ? " · inferred" : ""}
          </div>
          <div style={{ fontFamily: gf, fontSize: 18, fontWeight: 800, color: C.tx, letterSpacing: -0.3 }}>{product.title}</div>
          <div style={{ fontFamily: mn, fontSize: 10, color: C.txd, marginTop: 4 }}>{product.id}</div>
        </div>
        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
          <button
            data-testid="carousel2-inspector-edit"
            onClick={editInCanvas}
            disabled={opening}
            title="Open this product as editable objects in the canvas editor"
            style={{ background: "transparent", border: "1px solid " + C.violet + "55", borderRadius: 6, color: C.violet, fontFamily: mn, fontSize: 11, cursor: opening ? "wait" : "pointer", padding: "4px 8px" }}
          >
            {opening ? "…" : "✎ Edit"}
          </button>
          <button
            onClick={() => { exportSvgPng(product.svg, product.dims.width, product.dims.height, `${product.id}.png`).catch(() => {}); }}
            title="Download PNG"
            style={{ background: "transparent", border: "1px solid " + C.border, borderRadius: 6, color: C.teal, fontFamily: mn, fontSize: 11, cursor: "pointer", padding: "4px 8px" }}
          >
            ⬇ PNG
          </button>
          <button
            onClick={onClose}
            style={{ background: "transparent", border: "1px solid " + C.border, borderRadius: 6, color: C.txm, fontFamily: mn, fontSize: 12, cursor: "pointer", padding: "4px 8px" }}
          >
            ✕
          </button>
        </div>
      </div>

      <AutofillPanel product={product} />

      <div style={{ fontFamily: mn, fontSize: 9, color: C.amber, textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 10 }}>
        Fields · {product.fields.length}
      </div>
      {product.fields.length ? (
        product.fields.map((f) => <FieldRow key={f.name} f={f} />)
      ) : (
        <div style={{ fontFamily: ft, fontSize: 12, color: C.txm }}>No fillable fields (decorative asset).</div>
      )}

      {slots.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontFamily: mn, fontSize: 9, color: C.cyan, textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 10 }}>
            Slots · {slots.length} <span style={{ color: C.txd }}>(blocking / rules)</span>
          </div>
          {slots.map((s) => (
            <div key={s.id} style={{ padding: "10px 12px", border: "1px solid " + C.border, borderRadius: 10, background: C.bg, marginBottom: 8 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ fontFamily: mn, fontSize: 12, fontWeight: 700, color: C.tx }}>{s.label || s.id}</div>
                <div style={{ fontFamily: mn, fontSize: 9, color: C.cyan }}>{s.accepts.join(", ")}</div>
              </div>
            </div>
          ))}
          {onCompose && (
            <button
              onClick={onCompose}
              style={{ width: "100%", marginTop: 4, padding: "10px 0", borderRadius: 8, background: C.cyan + "18", border: "1px solid " + C.cyan + "55", color: C.cyan, fontFamily: ft, fontSize: 13, fontWeight: 800, cursor: "pointer", letterSpacing: 0.3 }}
            >
              Compose ▸ assign widgets
            </button>
          )}
        </div>
      )}

      <div style={{ marginTop: 14, fontFamily: mn, fontSize: 9, color: C.txd, lineHeight: 1.6 }}>
        source: {product.source.file}
        <br />
        dims: {product.dims.width}×{product.dims.height}
      </div>
    </div>
  );
}
