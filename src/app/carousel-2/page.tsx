"use client";

// /carousel-2 — Carousel 2.0 studio (Canva-like design surface).
//
// Slice 1 mounts the ASSET LIBRARY. The editor canvas, AI auto-fill, verbatim
// bridge, and cover facelift are later slices. Auth gate + ShortcutsProvider
// mirror /carousel (src/app/carousel/page.tsx): read poast-current-user from
// localStorage, redirect to / if absent. All other deps (user-context, toast,
// dialog) are provided by the root layout, so this route boots standalone.

import { useEffect, useState } from "react";
import { ShortcutsProvider } from "../keyboard-shortcuts";
import CarouselStudio from "./carousel-studio";

export default function Carousel2Page() {
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
    <ShortcutsProvider>
      <div style={{ maxWidth: 1400, margin: "0 auto", padding: "24px 28px 64px" }}>
        <CarouselStudio />
      </div>
    </ShortcutsProvider>
  );
}
