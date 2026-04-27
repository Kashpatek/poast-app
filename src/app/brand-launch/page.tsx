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

  // Listen for in-iframe nav requests from BroadcastBuilder. The viewer's
  // Asset Library footer link postMessages here when iframed instead of
  // navigating its own iframe to /asset-library.html. We bounce the user
  // to POAST's local /asset-library route so the experience stays inside
  // POAST chrome.
  useEffect(function() {
    var handler = function(e: MessageEvent) {
      var data = e.data as { type?: string; to?: string } | null;
      if (data && data.type === "sa:nav" && data.to === "asset-library") {
        window.location.href = "/asset-library";
      }
    };
    window.addEventListener("message", handler);
    return function() { window.removeEventListener("message", handler); };
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
