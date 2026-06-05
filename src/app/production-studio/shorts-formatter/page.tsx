"use client";
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { ProductionStudioShell } from "../shell";

// FFmpeg.wasm + URL.createObjectURL are browser-only; skip SSR to avoid the
// hydration mismatch from server-rendering an empty <video> shell.
const ShortsFormatter = dynamic(() => import("../shorts-formatter"), { ssr: false });

// Auth gate mirrors /asset-library — read localStorage directly to skip
// the UserContext hydration race that bounces fresh tabs.
export default function ShortsFormatterPage() {
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
    <ProductionStudioShell title="Shorts Formatter" subtitle="16:9 → 9:16 reframe for TikTok / Reels / Shorts">
      <ShortsFormatter />
    </ProductionStudioShell>
  );
}
