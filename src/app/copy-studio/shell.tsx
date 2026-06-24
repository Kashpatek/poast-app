"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { D, ft, gf, mn } from "../shared-constants";
import { ArrowLeft, Type } from "lucide-react";

// CopySTUDIO accent · amber → coral → magenta. Apply to background-clip
// text on the hero headline (same technique as the Produce hero), and
// as the signature tint on module accents.
export const COPY_GRADIENT = "linear-gradient(120deg, #F7B041 0%, #E0556B 45%, #A24BC9 100%)";
export const COPY_SOLID = "#E0556B";
export const COPY_GLOW = "rgba(224,85,107,0.16)";

export interface CopyShellProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
}

export function CopyShell({ children, title, subtitle }: CopyShellProps) {
  const pathname = usePathname() || "/copy-studio";
  const isHub = pathname === "/copy-studio";

  return (
    <div style={{ minHeight: "100vh", background: "var(--page-bg, " + D.bg + ")", color: D.tx, fontFamily: ft }}>
      {/* Top bar */}
      <div style={{
        display: "flex", alignItems: "center", padding: "0 20px",
        height: 56, borderBottom: "1px solid " + D.border,
        background: "rgba(10,10,14,0.72)",
        backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
        gap: 16, position: "sticky", top: 0, zIndex: 5,
      }}>
        <Link href="/" style={{ color: D.txm, textDecoration: "none", fontFamily: mn, fontSize: 12, letterSpacing: 0.6, display: "inline-flex", alignItems: "center", gap: 6 }}>
          <ArrowLeft size={13} strokeWidth={1.8} /> POAST
        </Link>
        <div style={{ width: 1, height: 20, background: D.border }} />
        {isHub ? (
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, fontFamily: gf, fontSize: 18, letterSpacing: 0.4, color: D.tx }}>
            <Type size={16} strokeWidth={2} color={COPY_SOLID} />
            CopySTUDIO
          </div>
        ) : (
          <Link href="/copy-studio" style={{ fontFamily: mn, fontSize: 12, letterSpacing: 0.6, color: D.txm, textDecoration: "none" }}>
            ← CopySTUDIO
          </Link>
        )}
        <span style={{ marginLeft: "auto", fontFamily: mn, fontSize: 9, color: "rgba(255,255,255,0.30)", letterSpacing: 2.4 }}>
          THE WORDS
        </span>
      </div>

      {/* Sub-tool header */}
      {title ? (
        <div style={{ padding: "18px 28px 6px", borderBottom: subtitle ? "none" : "1px solid " + D.border }}>
          <div style={{ fontFamily: gf, fontSize: 26, fontWeight: 900, letterSpacing: -0.4, color: D.tx }}>{title}</div>
          {subtitle ? <div style={{ fontFamily: ft, fontSize: 13, color: D.txm, marginTop: 4 }}>{subtitle}</div> : null}
        </div>
      ) : null}

      {children}
    </div>
  );
}

export default CopyShell;

// Tiny hook · returns true when window is wide enough for the
// 3-column hub grid. Drives layout breakpoints without a CSS-in-JS dep.
export function useNarrow(threshold = 900): boolean {
  const [n, setN] = useState(false);
  useEffect(() => {
    function check() { if (typeof window !== "undefined") setN(window.innerWidth < threshold); }
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, [threshold]);
  return n;
}
