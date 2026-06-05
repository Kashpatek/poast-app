"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { D, ft, gf, mn } from "../shared-constants";

interface ProductionStudioShellProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
}

export function ProductionStudioShell({ children, title, subtitle }: ProductionStudioShellProps) {
  const pathname = usePathname() || "/production-studio";
  const isHub = pathname === "/production-studio";

  return (
    <div
      style={{
        minHeight: "100vh",
        background: D.bg,
        color: D.tx,
        fontFamily: ft,
      }}
    >
      {/* Top bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          padding: "0 20px",
          height: 56,
          borderBottom: `1px solid ${D.border}`,
          background: "rgba(10,10,14,0.72)",
          backdropFilter: "blur(10px)",
          WebkitBackdropFilter: "blur(10px)",
          gap: 16,
          position: "sticky",
          top: 0,
          zIndex: 5,
        }}
      >
        <Link
          href="/"
          style={{
            color: D.txm,
            textDecoration: "none",
            fontFamily: mn,
            fontSize: 12,
            letterSpacing: 0.6,
          }}
        >
          ← POAST
        </Link>
        <div style={{ width: 1, height: 20, background: D.border }} />
        {isHub ? (
          <div style={{ fontFamily: gf, fontSize: 18, letterSpacing: 0.4, color: D.tx }}>
            ProductionSTUDIO
          </div>
        ) : (
          <Link
            href="/production-studio"
            style={{
              fontFamily: mn,
              fontSize: 12,
              letterSpacing: 0.6,
              color: D.txm,
              textDecoration: "none",
            }}
          >
            ← ProductionSTUDIO
          </Link>
        )}
      </div>

      {/* Sub-nav: visual section tabs */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "10px 20px",
          borderBottom: `1px solid ${D.border}`,
          background: D.bg,
        }}
      >
        <span style={subNavTab}>🎬 VIDEO</span>
        <span style={subNavTab}>🎙️ AUDIO</span>
      </div>

      {/* Sub-tool header (when title is provided by the calling page) */}
      {title ? (
        <div style={{ padding: "18px 24px 6px", borderBottom: subtitle ? "none" : `1px solid ${D.border}` }}>
          <div style={{ fontFamily: gf, fontSize: 22, letterSpacing: 0.2, color: D.tx }}>{title}</div>
          {subtitle ? (
            <div style={{ fontFamily: ft, fontSize: 13, color: D.txm, marginTop: 4 }}>{subtitle}</div>
          ) : null}
        </div>
      ) : null}

      {/* Outlet */}
      <div>{children}</div>
    </div>
  );
}

const subNavTab: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "6px 12px",
  borderRadius: 6,
  border: `1px solid ${D.border}`,
  background: D.card,
  color: D.txm,
  fontFamily: mn,
  fontSize: 11,
  letterSpacing: 1,
  textTransform: "uppercase",
};
