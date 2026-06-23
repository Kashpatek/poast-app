"use client";

import { useEffect, useState } from "react";
import { CommandCenterShell } from "../shell";
import NewsFlow from "../../news-flow";

// /intelligence-suite/dashboard — News Flow housed inside IntelligenceSUITE as
// a "Dashboard" view. Added as an extra tab; the suite still opens to its hub
// landing by default (page.tsx, activeId="hub"). NewsFlow is reused as-is and
// supplies its own widget grid; the root layout provides its providers.
export default function DashboardPage() {
  const [ok, setOk] = useState(false);

  useEffect(function () {
    try {
      var stored = localStorage.getItem("poast-current-user");
      if (stored) { setOk(true); return; }
    } catch (e) {}
    window.location.href = "/";
  }, []);

  if (!ok) return null;

  return (
    <CommandCenterShell activeId="dashboard">
      <NewsFlow />
    </CommandCenterShell>
  );
}
