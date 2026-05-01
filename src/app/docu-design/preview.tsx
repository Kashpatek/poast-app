"use client";

import React, { useMemo } from "react";
import { D, mn } from "../shared-constants";
import type { Artboard } from "./artboard-ops";

interface PreviewProps {
  artboard: Artboard | null;
  zoom?: number;
}

export function Preview({ artboard, zoom = 1 }: PreviewProps) {
  const srcDoc = useMemo(() => {
    if (!artboard) return "";
    return buildSrcDoc(artboard.svg, artboard.w, artboard.h);
  }, [artboard]);

  if (!artboard) {
    return (
      <div style={emptyWrap}>
        <div style={{ fontFamily: mn, fontSize: 12, color: D.txd }}>
          Empty artboard. Send a message to start.
        </div>
      </div>
    );
  }

  const w = artboard.w * zoom;
  const h = artboard.h * zoom;

  return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", padding: 24 }}>
      <div style={{ ...frame, width: w, height: h }}>
        <iframe
          title={`artboard-${artboard.id}`}
          sandbox=""
          srcDoc={srcDoc}
          style={{ width: w, height: h, border: 0, background: "#fff", display: "block" }}
        />
      </div>
    </div>
  );
}

function buildSrcDoc(svg: string, w: number, h: number): string {
  const safeSvg = svg.trim() || `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"></svg>`;
  return `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;padding:0;background:#fff;width:100%;height:100%;overflow:hidden}svg{display:block;width:100%;height:100%}</style></head><body>${safeSvg}</body></html>`;
}

const frame: React.CSSProperties = {
  background: "#fff",
  boxShadow: "0 8px 40px rgba(0,0,0,0.55)",
  border: `1px solid ${D.border}`,
};

const emptyWrap: React.CSSProperties = {
  width: "100%",
  height: "100%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 32,
  border: `1px dashed ${D.border}`,
  borderRadius: 12,
  background: D.surface,
  margin: 24,
};
