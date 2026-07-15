"use client";

// /carousel-2 — CarouselNEU: the SA Carousel 2.0 FOUNDRY wizard.
//
// This is the finished wizard ported from the carousel-standalone sandbox
// (2026-07-15), replacing the old Slice-1 "asset library" studio that lived
// here. Modes: Classic (ai) / Verbatim / Unique / Neu (library). The wizard
// tree lives in src/app/wizard/ and is self-contained: WizardApp brings its
// own ShortcutsProvider, seat gate (redirects to / when no seat), and scoped
// theme.css; user/toast/dialog contexts come from the root layout. Legacy V1
// at /carousel is untouched.
//
// Lazy + ssr:false per AUDIT #20 (heavy tools load only on their own route,
// never in the hub bundle) and because the wizard is browser-only (zustand
// persist on localStorage, canvas exporters).
//
// Fonts: poast-client.tsx injects Grift/Outfit/JetBrains Mono only at "/",
// so this route must carry its own block (same rule as the standalone's
// layout.tsx). The wizard chrome (theme.css), the SVG templates (Outfit /
// JetBrains Mono), and the PNG exporter (ensureFontsReady loads Grift
// 400/700/800) all depend on these being present.

import dynamic from "next/dynamic";

const WizardApp = dynamic(() => import("../wizard/WizardApp"), { ssr: false });

const FONTS = `
@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;700&display=swap');
@font-face{font-family:'Grift';src:url('/fonts/Grift-Regular.woff2') format('woff2');font-weight:400;font-style:normal;font-display:swap}
@font-face{font-family:'Grift';src:url('/fonts/Grift-Medium.woff2') format('woff2');font-weight:500;font-style:normal;font-display:swap}
@font-face{font-family:'Grift';src:url('/fonts/Grift-SemiBold.woff2') format('woff2');font-weight:600;font-style:normal;font-display:swap}
@font-face{font-family:'Grift';src:url('/fonts/Grift-Bold.woff2') format('woff2');font-weight:700;font-style:normal;font-display:swap}
@font-face{font-family:'Grift';src:url('/fonts/Grift-ExtraBold.woff2') format('woff2');font-weight:800;font-style:normal;font-display:swap}
@font-face{font-family:'Grift';src:url('/fonts/Grift-Black.woff2') format('woff2');font-weight:900;font-style:normal;font-display:swap}
`;

export default function Carousel2Page() {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: FONTS }} />
      <WizardApp />
    </>
  );
}
