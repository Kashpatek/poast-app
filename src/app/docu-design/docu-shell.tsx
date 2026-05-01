"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { D, ft, gf, mn } from "../shared-constants";
import { useUser, canUseDocuDesign } from "../user-context";

interface DocuShellProps {
  children: React.ReactNode;
  title?: string;
  rightSlot?: React.ReactNode;
}

const NAV: Array<{ href: string; label: string; match: (p: string) => boolean }> = [
  { href: "/docu-design", label: "Designs", match: (p) => p === "/docu-design" || p.startsWith("/docu-design/p/") },
  { href: "/docu-design/system", label: "Design systems", match: (p) => p.startsWith("/docu-design/system") },
  { href: "/docu-design/examples", label: "Examples", match: (p) => p.startsWith("/docu-design/examples") },
];

export function DocuShell({ children, title, rightSlot }: DocuShellProps) {
  const pathname = usePathname() || "/docu-design";
  const router = useRouter();
  const { user } = useUser();
  const allowed = canUseDocuDesign(user);

  useEffect(() => {
    if (user !== null && !allowed) {
      router.replace("/");
    }
  }, [user, allowed, router]);

  if (user !== null && !allowed) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: D.bg,
          color: D.tx,
          fontFamily: ft,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 32,
          textAlign: "center",
        }}
      >
        <div>
          <div style={{ fontFamily: gf, fontSize: 22, marginBottom: 8 }}>DocuDesign is in early access</div>
          <div style={{ color: D.txm, fontSize: 13, fontFamily: ft, lineHeight: 1.5 }}>
            Currently rolled out to Marketing only. Returning you to POAST…
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: D.bg,
        color: D.tx,
        fontFamily: ft,
        display: "grid",
        gridTemplateColumns: "220px 1fr",
        gridTemplateRows: "56px 1fr",
      }}
    >
      <div
        style={{
          gridColumn: "1 / 3",
          gridRow: "1",
          display: "flex",
          alignItems: "center",
          padding: "0 20px",
          borderBottom: `1px solid ${D.border}`,
          background: D.card,
          gap: 16,
        }}
      >
        <Link
          href="/"
          style={{ color: D.txm, textDecoration: "none", fontFamily: mn, fontSize: 12, letterSpacing: 0.6 }}
        >
          ← POAST
        </Link>
        <div style={{ width: 1, height: 20, background: D.border }} />
        <div style={{ fontFamily: gf, fontSize: 18, letterSpacing: 0.4, color: D.tx }}>DocuDesign</div>
        {title ? (
          <>
            <div style={{ color: D.txd, fontFamily: mn, fontSize: 12 }}>/</div>
            <div style={{ fontFamily: ft, fontSize: 14, color: D.txm }}>{title}</div>
          </>
        ) : null}
        <div style={{ marginLeft: "auto" }}>{rightSlot}</div>
      </div>

      <nav
        style={{
          gridColumn: "1",
          gridRow: "2",
          background: D.card,
          borderRight: `1px solid ${D.border}`,
          padding: "16px 12px",
          display: "flex",
          flexDirection: "column",
          gap: 4,
        }}
      >
        {NAV.map((item) => {
          const active = item.match(pathname);
          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                display: "block",
                padding: "8px 12px",
                borderRadius: 8,
                fontSize: 13,
                fontFamily: ft,
                color: active ? D.tx : D.txm,
                background: active ? D.hover : "transparent",
                textDecoration: "none",
                border: active ? `1px solid ${D.border}` : "1px solid transparent",
              }}
            >
              {item.label}
            </Link>
          );
        })}
        <div style={{ marginTop: "auto", padding: "8px 12px", color: D.txd, fontFamily: mn, fontSize: 11 }}>
          v0.1 · SVG only
        </div>
      </nav>

      <main style={{ gridColumn: "2", gridRow: "2", overflow: "hidden", display: "flex" }}>
        <div style={{ flex: 1, overflow: "auto" }}>{children}</div>
      </main>
    </div>
  );
}
