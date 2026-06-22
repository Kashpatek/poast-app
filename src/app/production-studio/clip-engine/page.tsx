"use client";
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { ProductionStudioShell } from "../shell";

// Browser-only (File upload, <video>, fetch) — skip SSR like the other tools.
const ClipEngine = dynamic(() => import("../clip-engine"), { ssr: false });

export default function ClipEnginePage() {
  const [ok, setOk] = useState(false);

  useEffect(function () {
    try {
      const stored = localStorage.getItem("poast-current-user");
      if (stored) {
        setOk(true);
        return;
      }
    } catch (e) {}
    window.location.href = "/";
  }, []);

  if (!ok) return null;

  return (
    <ProductionStudioShell
      title="Auto-Clip"
      subtitle="Big file or YouTube link in → reviewed, branded vertical clips out"
    >
      <ClipEngine />
    </ProductionStudioShell>
  );
}
