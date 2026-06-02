"use client";

// ChartEditor · Checkpoint 1 stub. Renders a placeholder until Checkpoint 2
// wires in the real ChartMaker2 wrapper with initialState/onChange/mode.

import { D, ft, gf, mn } from "./studio-theme";
import { StudioDoc } from "./studio-types";

export default function ChartEditor({ doc, onChangePayload }: {
  doc: StudioDoc;
  onChangePayload: (payload: unknown) => void;
}) {
  void onChangePayload;
  return (
    <EditorStub
      title={doc.name}
      type="chart"
      accent={D.amber}
      hint="Chart editor lands in Checkpoint 2 — this stub already participates in save/load."
    />
  );
}

function EditorStub({ title, type, accent, hint }: {
  title: string; type: string; accent: string; hint: string;
}) {
  return (
    <div style={{
      maxWidth: 980, margin: "0 auto", padding: "48px 28px",
    }}>
      <div style={{
        padding: "60px 36px",
        background: "linear-gradient(180deg, " + D.card + ", " + D.surface + ")",
        border: "1px dashed " + accent + "55",
        borderRadius: 16,
        textAlign: "center",
        boxShadow: "0 12px 36px rgba(0,0,0,0.4)",
      }}>
        <div style={{
          fontFamily: mn, fontSize: 10, color: accent, letterSpacing: 2,
          fontWeight: 700, textTransform: "uppercase", marginBottom: 10,
        }}>{type} editor · placeholder</div>
        <h3 style={{
          fontFamily: gf, fontSize: 28, fontWeight: 900, color: D.tx,
          letterSpacing: -0.6, margin: "0 0 10px",
        }}>{title}</h3>
        <p style={{
          fontFamily: ft, fontSize: 14, color: D.txm, maxWidth: 540, margin: "0 auto",
          lineHeight: 1.5,
        }}>{hint}</p>
      </div>
    </div>
  );
}
