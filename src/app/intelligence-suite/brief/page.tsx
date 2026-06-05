"use client";

import { useEffect, useState } from "react";
import { CommandCenterShell } from "../shell";
import MorningBrief from "../morning-brief";

// /intelligence-suite/brief — full-page Morning Brief.
// MorningBrief is now itself the newspaper-style brief; this page is
// the auth gate + shell chrome wrapper. Persistence + history live
// inside the MorningBrief component.

export default function BriefPage() {
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
    <CommandCenterShell activeId="brief">
      <MorningBrief />
    </CommandCenterShell>
  );
}
