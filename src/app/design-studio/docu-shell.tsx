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
  hideNav?: boolean;
}

const NAV: Array<{ href: string; label: string; match: (p: string) => boolean }> = [
  { href: "/design-studio", label: "Studio", match: (p) => p === "/design-studio" || p.startsWith("/design-studio/p/") },
  { href: "/design-studio/system", label: "Design systems", match: (p) => p.startsWith("/design-studio/system") },
  { href: "/design-studio/examples", label: "Examples", match: (p) => p.startsWith("/design-studio/examples") },
];

export function DocuShell({ children, title, rightSlot, hideNav = false }: DocuShellProps) {
  const pathname = usePathname() || "/design-studio";
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
          <div style={{ fontFamily: gf, fontSize: 22, marginBottom: 8 }}>DesignStudio is in early access</div>
          <div style={{ color: D.txm, fontSize: 13, fontFamily: ft, lineHeight: 1.5 }}>
            Currently rolled out to Marketing only. Returning you to POAST…
          </div>
        </div>
      </div>
    );
  }

  const topBar = (
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
        position: "relative",
        zIndex: 5,
      }}
    >
      <Link
        href="/"
        style={{ color: D.txm, textDecoration: "none", fontFamily: mn, fontSize: 12, letterSpacing: 0.6 }}
      >
        ← POAST
      </Link>
      <div style={{ width: 1, height: 20, background: D.border }} />
      <div style={{ fontFamily: gf, fontSize: 18, letterSpacing: 0.4, color: D.tx }}>DesignStudio</div>
      {title ? (
        <>
          <div style={{ color: D.txd, fontFamily: mn, fontSize: 12 }}>/</div>
          <div style={{ fontFamily: ft, fontSize: 14, color: D.txm }}>{title}</div>
        </>
      ) : null}
      <div style={{ marginLeft: "auto" }}>{rightSlot}</div>
    </div>
  );

  if (hideNav) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "var(--page-bg, #06060C)",
          color: D.tx,
          fontFamily: ft,
          display: "flex",
          flexDirection: "column",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Ambient backdrop — soft amber + cobalt orbs that slowly drift. */}
        <AmbientBackdrop />
        {topBar}
        <main style={{ flex: 1, overflow: "auto", position: "relative", zIndex: 2 }}>{children}</main>
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
        <div style={{ fontFamily: gf, fontSize: 18, letterSpacing: 0.4, color: D.tx }}>DesignStudio</div>
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

// Ambient backdrop — three soft glow orbs that drift on long timers.
// Pure decoration; no interaction. pointerEvents: none so it never blocks
// clicks on the content above.
function AmbientBackdrop() {
  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        pointerEvents: "none",
        zIndex: 1,
      }}
    >
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @keyframes dsOrbA{0%,100%{transform:translate3d(0,0,0) scale(1)}50%{transform:translate3d(40px,-30px,0) scale(1.08)}}
            @keyframes dsOrbB{0%,100%{transform:translate3d(0,0,0) scale(1)}50%{transform:translate3d(-50px,40px,0) scale(1.12)}}
            @keyframes dsOrbC{0%,100%{transform:translate3d(0,0,0) scale(1)}50%{transform:translate3d(30px,30px,0) scale(0.92)}}
            @keyframes dsGrid{0%{opacity:0.04}50%{opacity:0.07}100%{opacity:0.04}}
            .ds-orb-a{animation:dsOrbA 18s ease-in-out infinite}
            .ds-orb-b{animation:dsOrbB 22s ease-in-out infinite}
            .ds-orb-c{animation:dsOrbC 26s ease-in-out infinite}
            .ds-grid{animation:dsGrid 12s ease-in-out infinite}
          `,
        }}
      />
      {/* Subtle dotted grid wash */}
      <div
        className="ds-grid"
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "radial-gradient(rgba(255,255,255,0.4) 1px, transparent 1px)",
          backgroundSize: "44px 44px",
          opacity: 0.05,
        }}
      />
      {/* Amber orb top-right */}
      <div
        className="ds-orb-a"
        style={{
          position: "absolute",
          top: "-160px",
          right: "-140px",
          width: 540,
          height: 540,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(247,176,65,0.32) 0%, rgba(247,176,65,0.10) 38%, transparent 70%)",
          filter: "blur(50px)",
        }}
      />
      {/* Cobalt orb bottom-left */}
      <div
        className="ds-orb-b"
        style={{
          position: "absolute",
          bottom: "-180px",
          left: "-160px",
          width: 580,
          height: 580,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(11,134,209,0.30) 0%, rgba(11,134,209,0.08) 40%, transparent 72%)",
          filter: "blur(58px)",
        }}
      />
      {/* Teal accent mid-right */}
      <div
        className="ds-orb-c"
        style={{
          position: "absolute",
          top: "42%",
          right: "20%",
          width: 320,
          height: 320,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(46,173,142,0.22) 0%, rgba(46,173,142,0.06) 42%, transparent 75%)",
          filter: "blur(46px)",
        }}
      />
      {/* Top vignette to lift content readability */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse at 50% 0%, rgba(255,255,255,0.04) 0%, transparent 55%)",
        }}
      />
    </div>
  );
}
