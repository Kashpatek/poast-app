// Carousel 2.0 · AI auto-fill panel (Slice 3).
// A brief in → the AI fills the product's text fields → a live filled preview.

"use client";

import { useState } from "react";
import { D as C, ft, mn, getSurfaceProvider, getPreferredProvider } from "../../shared-constants";
import { showToast } from "../../toast-context";
import { applyFieldValues } from "../catalog/fill";
import type { CatalogProduct } from "../catalog/types";

export function AutofillPanel({ product }: { product: CatalogProduct }) {
  const [brief, setBrief] = useState("");
  const [busy, setBusy] = useState(false);
  const [filled, setFilled] = useState<string>("");

  const textFields = product.fields.filter((f) => f.type === "text" || f.type === "richtext" || f.type === "number");
  if (!textFields.length) return null;

  async function run() {
    if (busy) return;
    if (!brief.trim()) {
      showToast("Add a brief first.");
      return;
    }
    setBusy(true);
    try {
      const provider = getSurfaceProvider("carousel") || getPreferredProvider();
      const r = await fetch("/api/carousel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "autofill",
          brief,
          category: product.category,
          provider,
          fields: textFields.map((f) => ({ name: f.name, type: f.type, role: f.locator.role, placeholder: f.placeholder, constraints: f.constraints })),
        }),
      });
      const d = await r.json();
      if (!r.ok || d.error) {
        showToast(d.error || "Auto-fill failed.");
        return;
      }
      const vals = (d.values || {}) as Record<string, string>;
      const svg = applyFieldValues(product.svg, product.fields, vals).replace(/^<svg /, '<svg style="width:100%;height:100%;display:block" ');
      setFilled(svg);
    } catch (e) {
      showToast("Network error: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ marginBottom: 14, padding: "12px 14px", border: "1px solid " + C.border, borderRadius: 10, background: C.bg }}>
      <div style={{ fontFamily: mn, fontSize: 9, color: C.amber, textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 8 }}>AI Auto-fill</div>
      <textarea
        value={brief}
        onChange={(e) => setBrief(e.target.value)}
        placeholder="Paste the analyst brief / key points — the AI fills this template's fields."
        rows={3}
        style={{ width: "100%", padding: "8px 10px", background: C.card, border: "1px solid " + C.border, borderRadius: 8, color: C.tx, fontFamily: ft, fontSize: 12, lineHeight: 1.5, resize: "vertical", outline: "none", boxSizing: "border-box", marginBottom: 8 }}
      />
      <button
        onClick={run}
        disabled={busy}
        style={{ width: "100%", padding: "9px 0", borderRadius: 8, background: busy ? C.surface : C.amber + "18", border: "1px solid " + C.amber + "55", color: C.amber, fontFamily: ft, fontSize: 13, fontWeight: 800, cursor: busy ? "wait" : "pointer" }}
      >
        {busy ? "Filling…" : "✨ AI fill fields"}
      </button>
      {filled && (
        <div
          data-testid="carousel2-filled"
          style={{ marginTop: 10, width: "100%", aspectRatio: "1080/1350", background: "#06060C", borderRadius: 8, overflow: "hidden", border: "1px solid " + C.border }}
          dangerouslySetInnerHTML={{ __html: filled }}
        />
      )}
    </div>
  );
}
