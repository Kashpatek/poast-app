"use client";

// ChartEditor · wraps ChartMaker2 inside the Studio shell.
//
// The shell owns save/load + chrome (header, save pill, back button); this
// component is the bridge between the saved StudioDoc.payload and the
// strongly-typed initialState/onChange contract on ChartMaker2.
//
// Hydration model:
//   - When the doc is opened, payload is whatever was last saved (or a
//     fresh stub from Gallery: { kind:"chart", version:1, templateId }).
//   - We pass it straight through as initialState. ChartMaker2 seeds its
//     own internal state from the templateId/type and any sheet/annotations
//     present.
//   - Every internal change emits a fresh payload via onChange → the shell
//     debounces and persists.

import ChartMaker2 from "../chart-maker-2";
import { ChartDocPayload, StudioDoc } from "./studio-types";

export default function ChartEditor({ doc, onChangePayload }: {
  doc: StudioDoc;
  onChangePayload: (payload: unknown) => void;
}) {
  // Defensive cast — payload is `unknown` at the storage layer.
  const seed = (doc.payload && typeof doc.payload === "object")
    ? (doc.payload as ChartDocPayload)
    : { kind: "chart" as const, version: 1 as const };

  return (
    <div style={{ padding: "0 24px 80px", position: "relative" }}>
      <ChartMaker2
        initialState={seed}
        onChange={(payload) => onChangePayload(payload)}
      />
    </div>
  );
}
