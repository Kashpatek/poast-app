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
//
// Sync model — chart → table:
//   - ChartMaker2 emits the current sheet inside every payload snapshot.
//   - We keep the latest sheet in a ref; the floating "→ Table" button
//     reads from it and hands it to the shell's onBuildTable callback.

import { useRef } from "react";
import { Table2 } from "lucide-react";
import ChartMaker2 from "../chart-maker-2";
import { D, mn } from "./studio-theme";
import { ChartDocPayload, StudioDoc, TableSheet } from "./studio-types";

export default function ChartEditor({ doc, onChangePayload, onBuildTable }: {
  doc: StudioDoc;
  onChangePayload: (payload: unknown) => void;
  onBuildTable?: (sheet: TableSheet, sourceName: string) => void;
}) {
  // Defensive cast — payload is `unknown` at the storage layer.
  const seed = (doc.payload && typeof doc.payload === "object")
    ? (doc.payload as ChartDocPayload)
    : { kind: "chart" as const, version: 1 as const };

  // Latest sheet from ChartMaker2, captured on every payload emit so the
  // "→ Table" button can hand it off without poking ChartMaker2's state.
  const latestSheetRef = useRef<TableSheet | null>(
    (seed.sheet && typeof seed.sheet === "object") ? (seed.sheet as TableSheet) : null,
  );
  const latestTitleRef = useRef<string>(seed.title || doc.name || "Untitled");

  return (
    <div style={{ padding: "0 24px 80px", position: "relative" }}>
      <ChartMaker2
        initialState={seed}
        onChange={(payload) => {
          if (payload && typeof payload === "object") {
            const p = payload as ChartDocPayload;
            if (p.sheet) latestSheetRef.current = p.sheet as TableSheet;
            if (p.title) latestTitleRef.current = p.title;
          }
          onChangePayload(payload);
        }}
      />
      {onBuildTable && (
        <button
          onClick={() => {
            if (!latestSheetRef.current) return;
            onBuildTable(latestSheetRef.current, latestTitleRef.current);
          }}
          title="Mint a table doc seeded with this chart's data"
          style={{
            position: "fixed", right: 28, bottom: 28,
            display: "inline-flex", alignItems: "center", gap: 7,
            padding: "9px 14px",
            background: D.amber, color: "#0A0C10",
            border: "none", borderRadius: 999,
            boxShadow: "0 14px 32px rgba(0,0,0,0.5)",
            fontFamily: mn, fontSize: 11, fontWeight: 800, letterSpacing: 0.7,
            textTransform: "uppercase", cursor: "pointer",
            zIndex: 30,
          }}
        >
          <Table2 size={13} strokeWidth={2.4} />
          → Table
        </button>
      )}
    </div>
  );
}
