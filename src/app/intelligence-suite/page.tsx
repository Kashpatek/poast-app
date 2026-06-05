"use client";

// /intelligence-suite · Phase 7B HUB landing. Auth gate mirrors
// /asset-library (sync localStorage read; redirect to / when the
// poast-current-user key is absent) to avoid the hydration race that
// flickered fresh tabs in earlier hub experiments. The HubLanding
// component renders inside CommandCenterShell so the sticky tab bar
// stays consistent with the other 7 IntelligenceSUITE apps.

import { useEffect, useState } from "react";
import CommandCenterShell from "./shell";
import { HubLanding } from "./hub-landing";

export default function IntelligenceSuitePage() {
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
    <CommandCenterShell activeId="hub">
      <HubLanding />
    </CommandCenterShell>
  );
}
