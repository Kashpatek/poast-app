"use client";

// Graphics editor page — renders the Polotno-backed shell for a specific
// graphic project. The shell is dynamically imported with ssr: false
// because Polotno reaches for `window` at module load.

import React, { use } from "react";
import dynamic from "next/dynamic";
import { D, ft, mn } from "../../../shared-constants";

const PolotnoShell = dynamic(() => import("./polotno-shell").then((m) => m.PolotnoShell), {
  ssr: false,
  loading: () => (
    <div style={{ padding: 32, color: D.txm, fontFamily: mn, fontSize: 12 }}>
      Loading Graphics editor…
    </div>
  ),
});

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function GraphicProjectPage({ params }: PageProps) {
  const { id } = use(params);
  return (
    <div style={{ minHeight: "100vh", background: D.bg, color: D.tx, fontFamily: ft }}>
      <PolotnoShell projectId={id} />
    </div>
  );
}
