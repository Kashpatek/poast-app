"use client";

import { useEffect, useState } from "react";
import { D, ft, gf } from "../../shared-constants";
import { CommandCenterShell, apps } from "../shell";
import IdeationBoardPanel from "../ideation-board";

// /intelligence-suite/ideas — starfield ideation board as a standalone
// IS app. Auth gate mirrors /asset-library.
export default function IdeasPage() {
  var _ok = useState(false), ok = _ok[0], setOk = _ok[1];

  useEffect(function () {
    try {
      var stored = localStorage.getItem("poast-current-user");
      if (stored) { setOk(true); return; }
    } catch (e) {}
    window.location.href = "/";
  }, []);

  if (!ok) return null;

  var app = apps.find(function (a) { return a.id === "ideas"; }) || apps[2];

  return (
    <CommandCenterShell activeId="ideas">
      <div style={{ padding: "32px 32px 64px", maxWidth: 1280, margin: "0 auto" }}>
        <div style={{ marginBottom: 22 }}>
          <div style={{ fontFamily: gf, fontSize: 38, fontWeight: 900, color: D.tx, letterSpacing: -0.6 }}>{app.label}</div>
          <div style={{ fontFamily: ft, fontSize: 14, color: D.txm, marginTop: 6 }}>
            Starfield ideation — turn signals and trends into deck-worthy story angles.
          </div>
        </div>
        <div style={{ background: D.card, border: "1px solid " + D.border, borderRadius: 14, padding: "20px 22px" }}>
          <IdeationBoardPanel />
        </div>
      </div>
    </CommandCenterShell>
  );
}
