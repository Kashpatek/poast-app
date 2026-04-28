"use client";
import { useEffect, useState } from "react";
import { ArrowLeft, Sparkles } from "lucide-react";
import ChartMaker2 from "../chart-maker-2";
import { D as C, ft, gf, mn } from "../shared-constants";

// /charts · Chart Maker 2 standalone. Opens in its own tab from POAST's
// sidebar so analysts get the full canvas without POAST's tool chrome.
// Auth check mirrors /brand-launch and /asset-library: read user from
// localStorage (synchronously avoids the parent-effect-fires-after-child
// hydration race that sent users back to / on a fresh tab).
export default function ChartsPage() {
  var _o = useState(false), ok = _o[0], setOk = _o[1];

  useEffect(function() {
    try {
      var stored = localStorage.getItem("poast-current-user");
      if (stored) { setOk(true); return; }
    } catch (e) {}
    window.location.href = "/";
  }, []);

  if (!ok) return null;

  return (
    <div style={{ background: "#06060A", minHeight: "100vh", color: C.tx }}>
      {/* Branded standalone header — sticky so it stays visible while
          the chart canvas scrolls underneath. */}
      <div style={{
        position: "sticky", top: 0, zIndex: 100,
        background: "rgba(10,10,16,0.92)",
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        padding: "12px 24px",
        display: "flex", alignItems: "center", gap: 16,
      }}>
        <a
          href="/"
          target="_self"
          title="Back to POAST"
          style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "7px 12px", borderRadius: 7, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: C.txm, fontFamily: mn, fontSize: 10, fontWeight: 800, letterSpacing: 0.6, textDecoration: "none", transition: "background 0.15s" }}
          onMouseEnter={function(e: React.MouseEvent<HTMLAnchorElement>) { e.currentTarget.style.background = "rgba(255,255,255,0.07)"; }}
          onMouseLeave={function(e: React.MouseEvent<HTMLAnchorElement>) { e.currentTarget.style.background = "rgba(255,255,255,0.04)"; }}
        >
          <ArrowLeft size={11} strokeWidth={2.4} /> POAST
        </a>

        <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1 }}>
          <div style={{
            width: 30, height: 30, borderRadius: 7,
            background: "linear-gradient(135deg, " + C.amber + ", " + C.coral + ")",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 0 20px " + C.amber + "40, 0 0 40px " + C.coral + "20",
          }}>
            <Sparkles size={14} strokeWidth={2.4} color="#0A0A0E" />
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
              <span style={{ fontFamily: gf, fontSize: 18, fontWeight: 900, color: "#E8E4DD", letterSpacing: -0.3 }}>Chart Maker</span>
              <span style={{
                fontFamily: gf, fontSize: 18, fontWeight: 900, letterSpacing: -0.3,
                background: "linear-gradient(135deg, " + C.amber + ", " + C.coral + ")",
                WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text",
              }}>2</span>
              <span style={{ fontFamily: mn, fontSize: 8, fontWeight: 800, color: C.amber, letterSpacing: 1.5, padding: "2px 6px", border: "1px solid " + C.amber + "55", borderRadius: 3, background: C.amber + "12" }}>BETA</span>
            </div>
            <div style={{ fontFamily: mn, fontSize: 9, color: C.txm, letterSpacing: 1.4, textTransform: "uppercase", marginTop: 2 }}>Think-cell-flavored chart builder · SemiAnalysis</div>
          </div>
        </div>

        <span style={{ fontFamily: mn, fontSize: 9, color: C.txd, letterSpacing: 1.5, padding: "4px 10px", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 4 }}>STANDALONE</span>
      </div>

      <div style={{ padding: "0 24px 60px" }}>
        <ChartMaker2 standalone />
      </div>
    </div>
  );
}
