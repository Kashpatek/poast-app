"use client";

import { useEffect, useState } from "react";
import { CommandCenterShell } from "../shell";
import StoryRadarPanel from "../story-radar";

// /intelligence-suite/trends — the rich Trends dashboard mounts as a
// standalone IS app. Auth gate mirrors /asset-library: sync
// localStorage read, redirect to "/" when the poast-current-user key
// is absent. The panel owns its own title bar + chrome so this page
// just provides the shell and the scroll container.
export default function TrendsPage() {
  var _ok = useState(false), ok = _ok[0], setOk = _ok[1];

  useEffect(function () {
    try {
      var stored = localStorage.getItem("poast-current-user");
      if (stored) { setOk(true); return; }
    } catch (e) {}
    window.location.href = "/";
  }, []);

  if (!ok) return null;

  return (
    <CommandCenterShell activeId="trends">
      <StoryRadarPanel />
    </CommandCenterShell>
  );
}
