"use client";

import { useEffect, useState } from "react";
import { D, ft, gf } from "../../shared-constants";
import { CommandCenterShell, apps } from "../shell";
import CompetitiveRadarPanel from "../competitive-radar";

// /intelligence-suite/competitive — competitor publishing radar as a
// standalone IS app. Auth gate mirrors /asset-library.
export default function CompetitivePage() {
  var _ok = useState(false), ok = _ok[0], setOk = _ok[1];

  useEffect(function () {
    try {
      var stored = localStorage.getItem("poast-current-user");
      if (stored) { setOk(true); return; }
    } catch (e) {}
    window.location.href = "/";
  }, []);

  if (!ok) return null;

  var app = apps.find(function (a) { return a.id === "competitive"; }) || apps[5];

  return (
    <CommandCenterShell activeId="competitive">
      <div style={{ padding: "32px 32px 64px", maxWidth: 1280, margin: "0 auto" }}>
        <div style={{ marginBottom: 22 }}>
          <div style={{ fontFamily: gf, fontSize: 38, fontWeight: 900, color: D.tx, letterSpacing: -0.6 }}>{app.label}</div>
          <div style={{ fontFamily: ft, fontSize: 14, color: D.txm, marginTop: 6 }}>
            What the field is shipping — coverage gaps, recurring beats, and outlets gaining velocity.
          </div>
        </div>
        <div style={{ background: D.card, border: "1px solid " + D.border, borderRadius: 14, padding: "20px 22px" }}>
          <CompetitiveRadarPanel />
        </div>
      </div>
    </CommandCenterShell>
  );
}
