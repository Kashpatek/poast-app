"use client";
import { useEffect, useState } from "react";
import HubLanding from "./hub-landing";

// /intelligence-suite · Phase 7A hub shell. Auth gate mirrors
// /asset-library (sync localStorage read; redirect to / when the
// poast-current-user key is absent) to avoid the hydration race that
// flickered fresh tabs in earlier hub experiments.
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

  return <HubLanding />;
}
