"use client";

// /intelligence-suite/notes · Phase 7B Notes app route. Auth gate
// mirrors the asset-library / hub pattern (sync localStorage read,
// redirect to / when poast-current-user is absent) to dodge the
// hydration race that flickers fresh tabs.

import { useEffect, useState } from "react";
import NotesPanel from "../notes";
import { CommandCenterShell } from "../shell";

export default function IntelligenceSuiteNotesPage() {
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
    <CommandCenterShell activeId="notes">
      <NotesPanel />
    </CommandCenterShell>
  );
}
