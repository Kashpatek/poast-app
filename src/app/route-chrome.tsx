"use client";

import { ArrowLeft } from "lucide-react";
import { useTheme } from "./theme-context";
import StockBackdrop, { GlassBackdrop } from "./stock-backdrop";
import { DepthBackdrop } from "./home-glass-depth";
import GlassLens from "./glass-lens";

// ─── Shared themed shell for the standalone (new-tab) routes ────────────────
// The 8 internal tools that open in their own tab (/charts, /intelligence-suite,
// /copy-studio, /design-studio, /ai-training, /marketing-suite,
// /production-studio, /brand-launch) live under the root layout — so they
// already inherit data-theme + ThemeProvider + tokens.css — but they render
// NONE of the hub's ambient: no fluid backdrop, no way home. This wraps each
// route (via a per-route layout.tsx) so a new tab still feels like POAST.
//
//   • Mounts the active theme's fixed backdrop (Stock aurora / Glass fluid /
//     Depth night sky) as a viewport sibling at z-index 0, exactly as the hub
//     does. Each route's outermost page background is neutralised to
//     `transparent` under stock/glass via the `--page-bg` token (tokens.css),
//     so the backdrop shows through the gaps between the shell's panels.
//   • Lifts the route content into its own z-index:1 layer so the shell paints
//     ABOVE the fixed z-index:0 backdrop (a fixed z-index:0 element otherwise
//     paints over in-flow content).
//   • A floating "Back to POAST" glass pill returns this tab to the hub.
//
// CLASSIC IS UNTOUCHED: under the classic theme this renders children verbatim
// with no wrapper, no backdrop, no pill — byte-identical to today.

// `showBack` opts a route into the floating return pill — only the 3 routes that
// lack a native "← POAST" link need it (ai-training, brand-launch, charts). The
// other 5 shells already render their own top-left/right back link, so passing
// the pill there would duplicate it. `backSide` avoids the route's own top-corner
// chrome (charts has a "library" button top-left → its pill goes right).
export default function RouteChrome({
  children,
  showBack = false,
  backSide = "left",
}: {
  children: React.ReactNode;
  showBack?: boolean;
  backSide?: "left" | "right";
}) {
  const { theme, bg, glassMat } = useTheme();
  const isGlass = theme === "glass";
  const isStock = theme === "stock";

  if (!isGlass && !isStock) return <>{children}</>;

  return (
    <>
      {isStock && <StockBackdrop bg={bg} />}
      {isGlass && glassMat !== "depth" && <GlassBackdrop />}
      {isGlass && glassMat === "depth" && <DepthBackdrop />}
      {isGlass && <GlassLens />}

      {/* Return-to-hub pill — floating frosted glass, above shell chrome. Opt-in. */}
      {showBack && (
        <a
          href="/"
          aria-label="Back to POAST"
          style={{
            position: "fixed",
            top: 14,
            [backSide]: 16,
            zIndex: 2147483000,
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "9px 15px 9px 12px",
            borderRadius: 999,
            textDecoration: "none",
            fontFamily: "var(--ft, 'Outfit', system-ui, sans-serif)",
            fontWeight: 600,
            fontSize: 13,
            letterSpacing: "-0.1px",
            color: "#fff",
            background:
              "linear-gradient(180deg, rgba(40,32,60,0.52), rgba(18,14,30,0.6))",
            backdropFilter: "blur(28px) saturate(1.7)",
            WebkitBackdropFilter: "blur(28px) saturate(1.7)",
            border: "1px solid rgba(255,255,255,0.16)",
            boxShadow:
              "inset 1px 1px 0 rgba(255,255,255,0.22), 0 14px 34px rgba(0,0,0,0.42)",
          }}
        >
          <ArrowLeft size={15} strokeWidth={2.2} />
          POAST
        </a>
      )}

      {/* Content layer — above the fixed z:0 backdrop */}
      <div style={{ position: "relative", zIndex: 1, minHeight: "100dvh" }}>{children}</div>
    </>
  );
}
