"use client";
import { useEffect, useState } from "react";

// SemiAnalysis Style Guide / Asset Library browser.
// Iframes the BroadcastBuilder asset-library shell. Reads localStorage
// directly to avoid the UserContext hydration race (child effects run
// before parent effects, so useUser() sees null on a fresh tab).
export default function AssetLibraryPage() {
  var _ok = useState(false), ok = _ok[0], setOk = _ok[1];

  useEffect(function() {
    try {
      var stored = localStorage.getItem("poast-current-user");
      if (stored) { setOk(true); return; }
    } catch (e) {}
    window.location.href = "/";
  }, []);

  if (!ok) return null;

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
