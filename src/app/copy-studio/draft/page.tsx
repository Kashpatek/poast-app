"use client";

import React, { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import CopyShell from "../shell";
import DraftEditor from "./draft-editor";
import { D, mn } from "../../shared-constants";

export default function DraftPage() {
  return (
    <Suspense fallback={<div style={{ padding: 40, fontFamily: mn, color: D.txd }}>Booting editor…</div>}>
      <DraftPageInner />
    </Suspense>
  );
}

function DraftPageInner() {
  const [ok, setOk] = useState(false);
  const params = useSearchParams();
  const draftId = params.get("id");
  const seed = params.get("seed");

  useEffect(() => {
    try {
      const stored = localStorage.getItem("poast-current-user");
      if (stored) { setOk(true); return; }
    } catch {}
    if (typeof window !== "undefined") window.location.href = "/";
  }, []);

  if (!ok) return null;

  return (
    <CopyShell title="Draft" subtitle="Tiptap editor, autosave, brand-voice gate, and export to docx / md / html.">
      <DraftEditor draftId={draftId} seed={seed} />
    </CopyShell>
  );
}
