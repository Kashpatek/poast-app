"use client";
import { useEffect, useState } from "react";
import ClipCaptions from "../../clip-captions";
import { ProductionStudioShell } from "../shell";

// /production-studio/capper — Capper (the hub's caption studio) housed inside
// Production Studio. ClipCaptions is reused as-is; its own relative imports
// resolve from src/app, and the root layout supplies every provider it needs.
// Auth gate mirrors the other tools — read localStorage directly to skip the
// UserContext hydration race that bounces fresh tabs.
export default function CapperPage() {
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
    <ProductionStudioShell title="Capper" subtitle="Generate AI captions with tone, audience & platform controls">
      <ClipCaptions />
    </ProductionStudioShell>
  );
}
