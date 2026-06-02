"use client";

// DiagramEditor · Checkpoint 1 stub. Replaced in Checkpoint 4 by the
// react-konva canvas with shape tools and properties panel.

import { D, ft, gf, mn } from "./studio-theme";
import { StudioDoc } from "./studio-types";

export default function DiagramEditor({ doc, onChangePayload }: {
  doc: StudioDoc;
  onChangePayload: (payload: unknown) => void;
}) {
  void onChangePayload;
  return (
    <div style={{ maxWidth: 980, margin: "0 auto", padding: "48px 28px" }}>
      <div style={{
        padding: "60px 36px",
        background: "linear-gradient(180deg, " + D.card + ", " + D.surface + ")",
        border: "1px dashed " + D.blue + "55",
        borderRadius: 16,
        textAlign: "center",
        boxShadow: "0 12px 36px rgba(0,0,0,0.4)",
      }}>
        <div style={{
          fontFamily: mn, fontSize: 10, color: D.blue, letterSpacing: 2,
          fontWeight: 700, textTransform: "uppercase", marginBottom: 10,
        }}>diagram editor · placeholder</div>
        <h3 style={{
          fontFamily: gf, fontSize: 28, fontWeight: 900, color: D.tx,
          letterSpacing: -0.6, margin: "0 0 10px",
        }}>{doc.name}</h3>
        <p style={{
          fontFamily: ft, fontSize: 14, color: D.txm, maxWidth: 540, margin: "0 auto",
          lineHeight: 1.5,
        }}>react-konva canvas with shape tools lands in Checkpoint 4.</p>
      </div>
    </div>
  );
}
