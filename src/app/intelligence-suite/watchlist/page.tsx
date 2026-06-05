"use client";

import { useEffect, useState } from "react";
import { D, ft, gf } from "../../shared-constants";
import { CommandCenterShell, apps } from "../shell";
import WatchlistAlertsPanel from "../watchlist-alerts";

// /intelligence-suite/watchlist — pinned topics + alert rules as a
// standalone IS app. Auth gate mirrors /asset-library.
export default function WatchlistPage() {
  var _ok = useState(false), ok = _ok[0], setOk = _ok[1];

  useEffect(function () {
    try {
      var stored = localStorage.getItem("poast-current-user");
      if (stored) { setOk(true); return; }
    } catch (e) {}
    window.location.href = "/";
  }, []);

  if (!ok) return null;

  var app = apps.find(function (a) { return a.id === "watchlist"; }) || apps[4];

  return (
    <CommandCenterShell activeId="watchlist">
      <div style={{ padding: "32px 32px 64px", maxWidth: 1280, margin: "0 auto" }}>
        <div style={{ marginBottom: 22 }}>
          <div style={{ fontFamily: gf, fontSize: 38, fontWeight: 900, color: D.tx, letterSpacing: -0.6 }}>{app.label}</div>
          <div style={{ fontFamily: ft, fontSize: 14, color: D.txm, marginTop: 6 }}>
            Pinned tickers, topics, and authors with alert thresholds — the things you cannot afford to miss.
          </div>
        </div>
        <div style={{ background: D.card, border: "1px solid " + D.border, borderRadius: 14, padding: "20px 22px" }}>
          <WatchlistAlertsPanel />
        </div>
      </div>
    </CommandCenterShell>
  );
}
