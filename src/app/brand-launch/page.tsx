"use client";
import { useEffect, useState } from "react";

// SemiAnalysis Brand Launch · analyst-review viewer.
// Iframes the BroadcastBuilder viewer (public origin). Reads localStorage
// directly rather than going through UserContext to avoid the child-effect-
// fires-before-parent-effect race, which was redirecting authed users back
// to / on a fresh tab.
export default function BrandLaunchPage() {
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
        src="https://broadcast-builder.vercel.app/viewer"
        title="SemiAnalysis Brand Launch · Viewer"
        allow="autoplay; fullscreen; clipboard-read; clipboard-write"
        style={{ width: "100%", height: "100%", border: "none", display: "block" }}
      />
    </div>
  );
}
