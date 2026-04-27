"use client";
import { useEffect } from "react";
import { useUser } from "../user-context";

// SemiAnalysis Brand Launch · analyst-review viewer.
// Iframes the BroadcastBuilder viewer (public origin) and enforces POAST's
// auth gate on this side: if no user is set we redirect to the landing
// page which forces the lock-screen flow.
export default function BrandLaunchPage() {
  var userCtx = useUser();
  useEffect(function() {
    if (!userCtx.user) window.location.href = "/";
  }, [userCtx.user]);

  if (!userCtx.user) return null;

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
