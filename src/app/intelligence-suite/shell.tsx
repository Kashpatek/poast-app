"use client";

import React, { ReactNode, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Home,
  TrendingUp,
  Lightbulb,
  Radio,
  Star,
  Crosshair,
  Sun,
  StickyNote,
  ArrowLeft,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { D, ft, gf, mn } from "../shared-constants";
import { useShortcuts } from "../keyboard-shortcuts";

// ─── IntelligenceSUITE Command Center shell ─────────────────────────
// Vertical scroll container with a scroll-aware eyebrow + page title
// (only shown at the HUB while scrollY is near the top) and a sticky
// tab bar that lifts into view once scroll passes the threshold — or
// stays sticky on every non-HUB route. Pure chrome; each /<app> page
// mounts its own panel as children.

export interface AppDef {
  id: string;
  label: string;
  path: string;
  Icon: LucideIcon;
}

export const APPS: AppDef[] = [
  { id: "hub",         label: "HUB",         path: "/intelligence-suite",             Icon: Home },
  { id: "trends",      label: "Trends",      path: "/intelligence-suite/trends",      Icon: TrendingUp },
  { id: "ideas",       label: "Ideas",       path: "/intelligence-suite/ideas",       Icon: Lightbulb },
  { id: "signals",     label: "Signals",     path: "/intelligence-suite/signals",     Icon: Radio },
  { id: "watchlist",   label: "Watchlist",   path: "/intelligence-suite/watchlist",   Icon: Star },
  { id: "competitive", label: "Competitive", path: "/intelligence-suite/competitive", Icon: Crosshair },
  { id: "brief",       label: "Brief",       path: "/intelligence-suite/brief",       Icon: Sun },
  { id: "notes",       label: "Notes",       path: "/intelligence-suite/notes",       Icon: StickyNote },
];

const STICKY_THRESHOLD_PX = 64;

export interface CommandCenterShellProps {
  children: ReactNode;
  // Optional activeId carry-over from the previous shell iteration —
  // when set, it overrides the path-derived active tab. Sub-route
  // pages may still pass it; the tab bar prefers it over usePathname.
  activeId?: string;
}

// Lowercase alias so callers can write `import { apps } from "../shell"`
// — matches the convention sub-route pages settled on.
export const apps = APPS;

function pathForId(id: string | undefined): string | undefined {
  if (!id) return undefined;
  const hit = APPS.find(function (a) { return a.id === id; });
  return hit ? hit.path : undefined;
}

export default function CommandCenterShell({ children, activeId }: CommandCenterShellProps) {
  const pathname = usePathname() || "/intelligence-suite";
  const router = useRouter();
  const activePath = pathForId(activeId) || pathname;
  const isHub = activePath === "/intelligence-suite";

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [scrollY, setScrollY] = useState(0);

  // rAF-throttled scroll listener on the inner container — the page
  // itself doesn't scroll, the shell does.
  useEffect(function () {
    const el = scrollRef.current;
    if (!el) return;
    let ticking = false;
    function onScroll() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () {
        setScrollY(el ? el.scrollTop : 0);
        ticking = false;
      });
    }
    el.addEventListener("scroll", onScroll, { passive: true });
    return function () { el.removeEventListener("scroll", onScroll); };
  }, []);

  // ⌘+1..8 — jump between apps. Listed inline so the array index ↔
  // hotkey number mapping is unambiguous at a glance.
  useShortcuts(
    {
      "$mod+1": { description: "Open " + APPS[0].label, handler: function () { router.push(APPS[0].path); } },
      "$mod+2": { description: "Open " + APPS[1].label, handler: function () { router.push(APPS[1].path); } },
      "$mod+3": { description: "Open " + APPS[2].label, handler: function () { router.push(APPS[2].path); } },
      "$mod+4": { description: "Open " + APPS[3].label, handler: function () { router.push(APPS[3].path); } },
      "$mod+5": { description: "Open " + APPS[4].label, handler: function () { router.push(APPS[4].path); } },
      "$mod+6": { description: "Open " + APPS[5].label, handler: function () { router.push(APPS[5].path); } },
      "$mod+7": { description: "Open " + APPS[6].label, handler: function () { router.push(APPS[6].path); } },
      "$mod+8": { description: "Open " + APPS[7].label, handler: function () { router.push(APPS[7].path); } },
    },
    { scope: "IntelligenceSUITE" },
  );

  const heroVisible = isHub && scrollY < STICKY_THRESHOLD_PX;
  const showStickyBar = !isHub || scrollY >= STICKY_THRESHOLD_PX;

  return (
    <div style={{ minHeight: "100vh", background: D.bg, color: D.tx, fontFamily: ft }}>
      <div
        ref={scrollRef}
        style={{
          height: "100vh",
          overflow: "auto",
        }}
      >
        {/* Sticky tab bar — appears once the eyebrow has scrolled past,
            or unconditionally on every non-HUB route. */}
        {showStickyBar ? <AppTabBar pathname={activePath} /> : null}

        {/* Eyebrow + page title — only at HUB top-of-scroll. Opacity
            fades against the threshold so the hand-off to the sticky
            bar reads as one motion. */}
        {isHub ? (
          <div
            style={{
              padding: "48px 32px 0",
              opacity: Math.max(0, 1 - scrollY / STICKY_THRESHOLD_PX),
              transform: "translateY(" + (-Math.min(scrollY, STICKY_THRESHOLD_PX) * 0.25) + "px)",
              transition: "opacity 80ms linear",
              pointerEvents: heroVisible ? "auto" : "none",
              height: heroVisible ? "auto" : 0,
              overflow: "hidden",
            }}
          >
            <HubHero />
          </div>
        ) : null}

        <div>{children}</div>
      </div>
    </div>
  );
}

// ─── Eyebrow + title ────────────────────────────────────────────────
function HubHero() {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
      <div>
        <div
          style={{
            fontFamily: mn,
            fontSize: 10,
            fontWeight: 800,
            color: D.txm,
            letterSpacing: 2.4,
            textTransform: "uppercase",
          }}
        >
          INTELLIGENCE SUITE
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 10 }}>
          <div
            style={{
              width: 36, height: 36, borderRadius: 9,
              background: "linear-gradient(135deg, " + D.amber + ", " + D.violet + ")",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 0 24px " + D.amber + "44, 0 0 48px " + D.violet + "28",
            }}
          >
            <Sparkles size={16} strokeWidth={2.4} color="#0A0A0E" />
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
            <span style={{ fontFamily: gf, fontSize: 32, fontWeight: 900, color: D.tx, letterSpacing: -0.6 }}>Command</span>
            <span
              style={{
                fontFamily: gf, fontSize: 32, fontWeight: 900, letterSpacing: -0.6,
                background: "linear-gradient(135deg, " + D.amber + " 0%, " + D.violet + " 100%)",
                WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text",
              }}
            >
              Center
            </span>
          </div>
        </div>
      </div>

      <Link
        href="/"
        title="Back to POAST"
        style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          padding: "7px 12px", borderRadius: 7,
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.10)",
          color: D.txm, fontFamily: mn, fontSize: 10, fontWeight: 800, letterSpacing: 0.6,
          textDecoration: "none",
        }}
      >
        <ArrowLeft size={11} strokeWidth={2.4} /> POAST
      </Link>
    </div>
  );
}

// ─── Tab bar ────────────────────────────────────────────────────────
export function AppTabBar({ pathname }: { pathname?: string }) {
  const livePath = usePathname() || "/intelligence-suite";
  const active = pathname || livePath;

  return (
    <div
      style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        background: "rgba(13,13,18,0.86)",
        backdropFilter: "blur(18px) saturate(140%)",
        WebkitBackdropFilter: "blur(18px) saturate(140%)",
        borderBottom: "1px solid " + D.border,
      }}
    >
      <style>{`
        .is-tabbar::-webkit-scrollbar { display: none; }
      `}</style>
      <div
        className="is-tabbar"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "10px 16px",
          overflowX: "auto",
          scrollbarWidth: "none",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 4, flex: 1, minWidth: 0 }}>
          {APPS.map(function (app) {
            const isActive = app.path === active;
            const Icon = app.Icon;
            return (
              <Link
                key={app.id}
                href={app.path}
                style={{
                  position: "relative",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 7,
                  padding: "8px 12px",
                  borderRadius: 7,
                  background: isActive ? D.amber + "1F" : "transparent",
                  color: isActive ? D.amber : D.txm,
                  fontFamily: mn,
                  fontSize: 11,
                  fontWeight: 800,
                  letterSpacing: 0.8,
                  textTransform: "uppercase",
                  textDecoration: "none",
                  whiteSpace: "nowrap",
                  transition: "background 120ms ease, color 120ms ease",
                }}
              >
                <Icon size={13} strokeWidth={2.4} />
                <span>{app.label}</span>
                {isActive ? (
                  <span
                    style={{
                      position: "absolute",
                      left: 10,
                      right: 10,
                      bottom: -11,
                      height: 2,
                      background: D.amber,
                      borderRadius: 2,
                    }}
                  />
                ) : null}
              </Link>
            );
          })}
        </div>

        {/* ⌘K hint — pure visual affordance for now. */}
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            padding: "5px 9px",
            borderRadius: 6,
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.10)",
            color: D.txm,
            fontFamily: mn,
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: 0.8,
            flexShrink: 0,
          }}
        >
          ⌘K
        </div>
      </div>
    </div>
  );
}

// Named re-export so sub-route pages can do
// `import { CommandCenterShell, apps } from "../shell"`.
export { CommandCenterShell };
