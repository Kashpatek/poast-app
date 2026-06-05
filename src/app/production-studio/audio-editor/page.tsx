"use client";
import { useEffect, useState } from "react";
import AudioEditor from "../audio-editor";
import { ProductionStudioShell } from "../shell";

export default function AudioEditorPage() {
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
    <ProductionStudioShell title="Audio Editor" subtitle="Waveform trim, fade, normalize — runs in your browser">
      <AudioEditor />
    </ProductionStudioShell>
  );
}
