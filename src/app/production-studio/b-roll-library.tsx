"use client";

import Link from "next/link";
import BRollLibrary from "../broll-library";
import { ProductionStudioShell } from "./shell";
import { D, mn } from "../shared-constants";

export default function BRollLibraryHub() {
  return (
    <ProductionStudioShell>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "10px 20px",
          borderBottom: `1px solid ${D.border}`,
          background: D.card,
        }}
      >
        <Link
          href="/production-studio/brief-builder"
          style={{
            fontFamily: mn,
            fontSize: 11,
            letterSpacing: 0.4,
            color: D.amber,
            textDecoration: "none",
            padding: "4px 10px",
            borderRadius: 6,
            border: `1px solid ${D.amber}55`,
            background: D.amber + "08",
            whiteSpace: "nowrap",
            transition: "all 0.2s ease",
          }}
        >
          ⚡ Generate from brief
        </Link>
        <div style={{ fontFamily: mn, fontSize: 10, color: D.txd }}>
          Spin up a Brief Builder run to seed new B-Roll clips.
        </div>
      </div>
      <BRollLibrary />
    </ProductionStudioShell>
  );
}
