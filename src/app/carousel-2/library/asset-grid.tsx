// Carousel 2.0 · library grid + product card (Slice 1).
// Cards lazily rasterize their SVG to a thumbnail (IntersectionObserver +
// IndexedDB thumb cache) so the grid stays fast as the library grows.

"use client";

import { useEffect, useRef, useState } from "react";
import { D as C, ft, gf, mn } from "../../shared-constants";
import { renderProductThumb } from "../catalog/parser";
import { getCachedThumb, setCachedThumb } from "../catalog/catalog-store";
import type { CatalogProduct } from "../catalog/types";

const KIND_COLOR: Record<string, string> = {
  background: C.blue,
  template: C.amber,
  module: C.cyan,
};

function useLazyThumb(product: CatalogProduct, ref: React.RefObject<HTMLDivElement | null>): string {
  const [thumb, setThumb] = useState<string>("");
  const started = useRef(false);

  useEffect(() => {
    const node = ref.current;
    if (!node || started.current) return;
    let cancelled = false;

    const run = async () => {
      if (started.current) return;
      started.current = true;
      const hash = product.source.contentHash;
      const cached = await getCachedThumb(product.id, hash);
      if (cached) {
        if (!cancelled) setThumb(cached);
        return;
      }
      const url = await renderProductThumb(product);
      if (url && !cancelled) {
        setThumb(url);
        setCachedThumb(product.id, hash, url);
      }
    };

    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          run();
          io.disconnect();
        }
      },
      { rootMargin: "200px" }
    );
    io.observe(node);
    return () => {
      cancelled = true;
      io.disconnect();
    };
  }, [product, ref]);

  return thumb;
}

function ProductCard({ product, onInspect }: { product: CatalogProduct; onInspect: (p: CatalogProduct) => void }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const thumb = useLazyThumb(product, ref);
  const kindColor = KIND_COLOR[product.kind] || C.txm;

  return (
    <div
      ref={ref}
      onClick={() => onInspect(product)}
      style={{
        cursor: "pointer",
        borderRadius: 12,
        overflow: "hidden",
        border: "1px solid " + C.border,
        background: C.card,
        transition: "all 0.15s",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = kindColor + "80";
        e.currentTarget.style.transform = "translateY(-2px)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = C.border;
        e.currentTarget.style.transform = "translateY(0)";
      }}
    >
      <div style={{ position: "relative", width: "100%", aspectRatio: "1080/1350", background: "#06060C" }}>
        {thumb ? (
          <img src={thumb} alt={product.title} style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }} />
        ) : (
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: mn, fontSize: 10, color: C.txd }}>
            rendering…
          </div>
        )}
        <div style={{ position: "absolute", top: 8, left: 8, display: "flex", gap: 6, alignItems: "center" }}>
          <span style={{ fontFamily: mn, fontSize: 8, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase", color: "#fff", background: kindColor + "cc", padding: "3px 7px", borderRadius: 5 }}>
            {product.kind === "module" ? (product as { moduleType?: string }).moduleType || "module" : product.kind}
          </span>
          {(product as { coverEligible?: boolean }).coverEligible && (
            <span style={{ fontFamily: mn, fontSize: 8, fontWeight: 700, color: C.bg, background: C.amber, padding: "3px 7px", borderRadius: 5 }}>COVER</span>
          )}
          {product.meta && (product.meta as { inferred?: boolean }).inferred && (
            <span style={{ fontFamily: mn, fontSize: 8, fontWeight: 700, color: "#fff", background: "rgba(0,0,0,0.6)", padding: "3px 7px", borderRadius: 5 }}>INFERRED</span>
          )}
        </div>
      </div>
      <div style={{ padding: "10px 12px" }}>
        <div style={{ fontFamily: gf, fontSize: 14, fontWeight: 700, color: C.tx, letterSpacing: -0.2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {product.title}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
          <div style={{ fontFamily: ft, fontSize: 11, color: C.txm, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {product.tags.slice(0, 3).join(" · ") || product.category}
          </div>
          <div style={{ fontFamily: mn, fontSize: 9, color: C.txd, flexShrink: 0, marginLeft: 8 }}>
            {product.fields.length} {product.fields.length === 1 ? "field" : "fields"}
          </div>
        </div>
      </div>
    </div>
  );
}

export function AssetGrid({ products, onInspect }: { products: CatalogProduct[]; onInspect: (p: CatalogProduct) => void }) {
  if (!products.length) {
    return (
      <div style={{ padding: 48, textAlign: "center", fontFamily: ft, fontSize: 13, color: C.txm, background: C.card, border: "1px solid " + C.border, borderRadius: 12 }}>
        No assets match.
      </div>
    );
  }
  return (
    <div
      data-testid="carousel2-grid"
      style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 16 }}
    >
      {products.map((p) => (
        <ProductCard key={p.id} product={p} onInspect={onInspect} />
      ))}
    </div>
  );
}
