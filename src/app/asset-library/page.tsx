"use client";
import { useEffect } from "react";
import { useUser } from "../user-context";

// SemiAnalysis Style Guide / Asset Library browser.
// Iframes the BroadcastBuilder asset-library shell (which already lands on
// slide 24 of the deck via postMessage). Same auth gate as /brand-launch.
export default function AssetLibraryPage() {
  var userCtx = useUser();
  useEffect(function() {
    if (!userCtx.user) window.location.href = "/";
  }, [userCtx.user]);

  if (!userCtx.user) return null;

  return (
    <div style={{ position: "fixed", inset: 0, background: "#06060A" }}>
      <iframe
        src="https://broadcast-builder.vercel.app/asset-library"
        title="SemiAnalysis Asset Library"
        allow="autoplay; fullscreen; clipboard-read; clipboard-write"
        style={{ width: "100%", height: "100%", border: "none", display: "block" }}
      />
    </div>
  );
}
