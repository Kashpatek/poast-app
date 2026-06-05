"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import CopyShell from "../shell";
import { D, ft, gf, mn } from "../../shared-constants";
import { Captions, ExternalLink } from "lucide-react";
import { COPY_SOLID, COPY_GLOW } from "../shell";

// Capper / ClipCaptions is inlined in poast-client.tsx (sec="captions")
// so we can't import it as a component. Until we extract it, this page
// gives the same launch pad with an open-in-shell button.
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
      <div style={{ maxWidth: 720, margin: "40px auto", padding: "0 28px" }}>
        <div style={{
          background: "#0D0D12", border: "1px solid " + D.border, borderRadius: 14, padding: "28px 26px",
          boxShadow: "0 0 24px " + COPY_GLOW,
        }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <Captions size={20} color={COPY_SOLID} strokeWidth={1.8} />
            <span style={{ fontFamily: mn, fontSize: 11, color: COPY_SOLID, letterSpacing: 2, textTransform: "uppercase", fontWeight: 800 }}>Capper</span>
          </div>
          <div style={{ fontFamily: gf, fontSize: 24, fontWeight: 900, letterSpacing: -0.4, color: D.tx, marginBottom: 10 }}>Open Capper in the POAST shell</div>
          <div style={{ fontFamily: ft, fontSize: 14, color: D.txm, lineHeight: 1.55, marginBottom: 18 }}>
            Capper still lives inside the main POAST shell (legacy reasons). We&apos;ll extract it as a shared component in a follow-up so it can mount here natively. For now, click through — your draft will keep autosaving.
          </div>
          <Link href="/?sec=captions" style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            padding: "10px 16px", background: COPY_SOLID, color: "#060608",
            borderRadius: 8, fontFamily: mn, fontSize: 11, fontWeight: 800, letterSpacing: 1.4,
            textTransform: "uppercase", textDecoration: "none",
          }}>Open Capper <ExternalLink size={12} strokeWidth={2.2} /></Link>
        </div>
      </div>
    </CopyShell>
  );
}
