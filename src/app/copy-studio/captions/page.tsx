"use client";

import { useEffect, useState } from "react";
import CopyShell from "../shell";
import ClipCaptions from "../../clip-captions";

// CopySTUDIO Captions module · mounts Capper / ClipCaptions natively now
// that it's been lifted out of poast-client.tsx into a shared component
// (src/app/clip-captions.tsx). Same in-shell mount keeps working at
// sec === "captions" so legacy bookmarks survive.
export default function CaptionsPage() {
  const [ok, setOk] = useState(false);
  useEffect(() => {
    try {
      const stored = localStorage.getItem("poast-current-user");
      if (stored) { setOk(true); return; }
    } catch {}
    if (typeof window !== "undefined") window.location.href = "/";
  }, []);
  if (!ok) return null;
  return (
    <CopyShell title="Captions" subtitle="Capper — per-platform captions per clip, voice and source-aware.">
      <ClipCaptions />
    </CopyShell>
  );
}
