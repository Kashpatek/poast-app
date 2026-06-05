"use client";

import { useEffect, useState } from "react";
import { D, ft, gf } from "../../shared-constants";
import { CommandCenterShell, apps } from "../shell";
import IdeationBoardPanel from "../ideation-board";

// /intelligence-suite/ideas — full ideation suite (3-zone layout,
// kanban/cards toggle, generate modal, inspiration feed). The panel
// owns its own chrome; this page provides only the header.
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
      <div style={{ padding: "24px 32px 32px", maxWidth: 1480, margin: "0 auto" }}>
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontFamily: gf, fontSize: 38, fontWeight: 900, color: D.tx, letterSpacing: -0.6 }}>{app.label}</div>
          <div style={{ fontFamily: ft, fontSize: 14, color: D.txm, marginTop: 6 }}>
            Generate, develop, and dispatch story angles. Built for play.
          </div>
        </div>
        <IdeationBoardPanel />
      </div>
    </CommandCenterShell>
  );
}
