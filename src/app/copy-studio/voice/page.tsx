"use client";

import { useEffect, useState } from "react";
import CopyShell from "../shell";
import VoiceScorer from "../../voice-scorer";

export default function VoicePage() {
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
    <CopyShell title="Brand Voice Gate" subtitle="0-10 SA-on-brand score, breakdown by rubric, surgical rewrites.">
      <VoiceScorer />
    </CopyShell>
  );
}
