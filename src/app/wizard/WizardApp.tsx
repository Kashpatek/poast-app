"use client";
// ═══════════════════════════════════════════════════════════════════════════
// WizardApp — root shell for the SA Carousel 2.0 wizard at /carousel-2
// (CarouselNEU). Ported from the carousel-standalone sandbox 2026-07-15;
// engine/stations/store are byte-equal to the verified standalone tree.
//
// Provider stack: layout.tsx already mounts ErrorBoundary > UserProvider >
// ToastProvider > DialogProvider around every route (same as V1). Matching
// V1's /carousel/page.tsx, the only provider the page itself must add is
// ShortcutsProvider (the "?" cheat sheet + useShortcuts registry).
//
// Seat gate (differs from the standalone, which seeded a default "Akash"
// seat for sandbox use): here the seat must already exist — it is set by
// the real sign-in flow. No seat → redirect to "/", same contract as
// /carousel/page.tsx. Server-side access is enforced by src/proxy.ts
// (session cookie + ADMIN_ONLY_PREFIXES); this client gate only prevents
// a broken seatless render. The `ready` flag keeps stations from
// rendering until the check has run.
// ═══════════════════════════════════════════════════════════════════════════

import "./theme.css";
import { useEffect, useState } from "react";
import { ShortcutsProvider } from "../keyboard-shortcuts";
import { isValidUserName } from "../user-context";
import { useWizard } from "./store";
import { Topbar } from "./components/Chrome";
import { HomeStation } from "./stations/HomeStation";
import { CreateStation } from "./stations/CreateStation";
import { ChooseStation } from "./stations/ChooseStation";
import { EditStation } from "./stations/EditStation";
import { PublishStation } from "./stations/PublishStation";
import { GeneratingOverlay } from "./stations/GeneratingOverlay";

const SEAT_KEY = "poast-current-user";

function StationSwitch() {
  const station = useWizard((s) => s.station);
  const generating = useWizard((s) => s.generating);
  return (
    <>
      {station === "home" && <HomeStation />}
      {station === "create" && <CreateStation />}
      {station === "choose" && <ChooseStation />}
      {station === "edit" && <EditStation />}
      {station === "publish" && <PublishStation />}
      {(station === "generating" || generating) && <GeneratingOverlay />}
    </>
  );
}

export default function WizardApp() {
  const [ready, setReady] = useState(false);
  // Category re-tints the chipboard accents (theme.css [data-cat] vars):
  // general = amber x cobalt, internal = amber, external = cobalt, capital = mint.
  const category = useWizard((s) => s.category);

  useEffect(function gateSeat() {
    try {
      const seat =
        localStorage.getItem(SEAT_KEY) || sessionStorage.getItem(SEAT_KEY);
      if (seat && isValidUserName(seat)) {
        setReady(true);
        return;
      }
    } catch {
      /* storage unavailable — fall through to the redirect */
    }
    window.location.href = "/";
  }, []);

  if (!ready) return null;

  return (
    <ShortcutsProvider>
      <div className="wz-root wizard-root" data-cat={category}>
        {/* THE FOUNDRY backdrop (docs/THEME-FOUNDRY.md v3.3): iron sky + heat
            haze, film grain, the CHIPBOARD (four corner trace networks with
            LED children <i> and signal pulses <s>), 12 deterministic embers,
            warm vignette. Fixed, z-index -1 inside the isolated root, so they
            sit behind the crossbar chrome and every station. */}
        <div className="wz-sky" aria-hidden="true">
          <div className="wz-haze" />
        </div>
        <div className="wz-grid" aria-hidden="true" />
        <div className="wz-board" aria-hidden="true">
          <div className="bd bd-tl">
            {Array.from({ length: 4 }, (_, i) => (
              <i key={i} />
            ))}
            <s />
            <s />
          </div>
          <div className="bd bd-tr">
            {Array.from({ length: 10 }, (_, i) => (
              <i key={i} />
            ))}
          </div>
          <div className="bd bd-bl">
            {Array.from({ length: 5 }, (_, i) => (
              <i key={i} />
            ))}
            <s />
          </div>
          <div className="bd bd-br">
            {Array.from({ length: 4 }, (_, i) => (
              <i key={i} />
            ))}
          </div>
        </div>
        <div className="wz-embers" aria-hidden="true">
          {Array.from({ length: 12 }, (_, i) => (
            <i key={i} />
          ))}
        </div>
        <div className="wz-vignette" aria-hidden="true" />
        <Topbar />
        <StationSwitch />
      </div>
    </ShortcutsProvider>
  );
}
