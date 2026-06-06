"use client";

// /carousel — standalone entry point for the Carousel tool.
//
// The Carousel component (src/app/carousel.tsx) lives inside the main
// poast-client shell at /, but it has no event-bus coupling: every
// dependency (user-context, toast, dialog, onboarding) is mounted at the
// root layout, so it works on any route. The one piece it does need that
// the layout doesn't provide is ShortcutsProvider — Carousel registers
// ⌘G via useShortcuts. We wrap it here so the standalone route boots
// cleanly without dragging in the rest of poast-client.
//
// Auth gate mirrors /intelligence-suite/page.tsx: read poast-current-user
// from localStorage; redirect to / if absent. Avoids a hydration race on
// fresh tabs.

import { useEffect, useState } from "react";
import Carousel from "../carousel";
import { ShortcutsProvider } from "../keyboard-shortcuts";

export default function CarouselPage() {
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
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 28px 64px" }}>
        <Carousel />
      </div>
    </ShortcutsProvider>
  );
}
