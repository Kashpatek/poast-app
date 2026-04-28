"use client";
import { useEffect, useState } from "react";
import { ArrowLeft, Sparkles } from "lucide-react";
import ChartMaker2 from "../chart-maker-2";
import { D as C, ft, gf, mn } from "../shared-constants";

// /charts · Chart Maker 2 standalone. Glass / glow chrome lifted from
// POAST's splash screen. Auth check mirrors /brand-launch and
// /asset-library: read user from localStorage (synchronously avoids the
// parent-effect-fires-after-child hydration race).
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
    <div style={{ background: "#06060A", minHeight: "100vh", color: C.tx, position: "relative", overflow: "hidden" }}>
      {/* Animated background — same drift orbs we use on the POAST splash */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes cmDrift1 { 0%{transform:translate(0,0)} 50%{transform:translate(40px,-26px)} 100%{transform:translate(0,0)} }
        @keyframes cmDrift2 { 0%{transform:translate(0,0)} 50%{transform:translate(-30px,18px)} 100%{transform:translate(0,0)} }
        @keyframes cmDrift3 { 0%{transform:translate(0,0)} 50%{transform:translate(22px,28px)} 100%{transform:translate(0,0)} }
        @keyframes cmGlow   { 0%,100%{opacity:0.55} 50%{opacity:0.95} }
      ` }} />
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0, overflow: "hidden" }}>
        <div style={{ position: "absolute", top: "-12%", right: "-6%", width: "55vw", height: "55vw", borderRadius: "50%", background: "radial-gradient(circle, rgba(247,176,65,0.06) 0%, transparent 60%)", animation: "cmDrift1 22s ease-in-out infinite" }} />
        <div style={{ position: "absolute", bottom: "-15%", left: "8%", width: "60vw", height: "60vw", borderRadius: "50%", background: "radial-gradient(circle, rgba(11,134,209,0.05) 0%, transparent 60%)", animation: "cmDrift2 28s ease-in-out infinite" }} />
        <div style={{ position: "absolute", top: "35%", left: "-12%", width: "42vw", height: "42vw", borderRadius: "50%", background: "radial-gradient(circle, rgba(144,92,203,0.04) 0%, transparent 60%)", animation: "cmDrift3 32s ease-in-out infinite" }} />
        <div style={{ position: "absolute", top: "12%", right: "30%", width: "20vw", height: "20vw", borderRadius: "50%", background: "radial-gradient(circle, rgba(224,99,71,0.05) 0%, transparent 60%)", animation: "cmGlow 9s ease-in-out infinite" }} />
      </div>

      {/* Branded standalone header — sticky glass with gradient wordmark */}
      <div style={{
        position: "sticky", top: 0, zIndex: 100,
        background: "rgba(10,10,16,0.78)",
        backdropFilter: "blur(20px) saturate(140%)",
        WebkitBackdropFilter: "blur(20px) saturate(140%)",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        padding: "14px 26px",
        display: "flex", alignItems: "center", gap: 18,
        boxShadow: "0 1px 0 rgba(255,255,255,0.03) inset",
      }}>
        <a
          href="/"
          target="_self"
          title="Back to POAST"
          style={glassChipStyle()}
          onMouseEnter={glassChipHover(true)}
          onMouseLeave={glassChipHover(false)}
        >
          <ArrowLeft size={11} strokeWidth={2.4} /> POAST
        </a>

        <div style={{ display: "flex", alignItems: "center", gap: 14, flex: 1 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 9,
            background: "linear-gradient(135deg, " + C.amber + ", " + C.coral + ")",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 0 24px " + C.amber + "55, 0 0 48px " + C.coral + "30, 0 1px 0 rgba(255,255,255,0.18) inset",
          }}>
            <Sparkles size={15} strokeWidth={2.4} color="#0A0A0E" />
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
              <span style={{ fontFamily: gf, fontSize: 19, fontWeight: 900, color: "#E8E4DD", letterSpacing: -0.3 }}>Chart Maker</span>
              <span style={{
                fontFamily: gf, fontSize: 19, fontWeight: 900, letterSpacing: -0.3,
                background: "linear-gradient(135deg, " + C.amber + " 0%, " + C.coral + " 100%)",
                WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text",
                filter: "drop-shadow(0 0 8px " + C.amber + "30)",
              }}>2</span>
              <span style={{ fontFamily: mn, fontSize: 8, fontWeight: 800, color: C.amber, letterSpacing: 1.5, padding: "2px 7px", border: "1px solid " + C.amber + "55", borderRadius: 3, background: C.amber + "16", boxShadow: "0 0 12px " + C.amber + "20" }}>BETA</span>
            </div>
            <div style={{ fontFamily: mn, fontSize: 9, color: C.txm, letterSpacing: 1.4, textTransform: "uppercase", marginTop: 2 }}>Think-cell-grade chart builder · SemiAnalysis</div>
          </div>
        </div>

        <span style={{ fontFamily: mn, fontSize: 9, color: C.txd, letterSpacing: 1.5, padding: "5px 11px", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 4, background: "rgba(255,255,255,0.02)" }}>STANDALONE</span>
      </div>

      <div style={{ padding: "0 26px 80px", position: "relative", zIndex: 1 }}>
        <ChartMaker2 standalone />
      </div>
    </div>
  );
}

// ─── Glass chip style helpers · used by the back button + standalone pill ─
function glassChipStyle(): React.CSSProperties {
  return {
    display: "inline-flex", alignItems: "center", gap: 7,
    padding: "8px 14px", borderRadius: 8,
    background: "rgba(255,255,255,0.04)",
    backdropFilter: "blur(8px)",
    WebkitBackdropFilter: "blur(8px)",
    border: "1px solid rgba(255,255,255,0.10)",
    color: C.txm, fontFamily: mn, fontSize: 10, fontWeight: 800, letterSpacing: 0.6,
    textDecoration: "none",
    transition: "all 0.18s ease",
    boxShadow: "0 1px 0 rgba(255,255,255,0.04) inset",
  };
}
function glassChipHover(hov: boolean) {
  return (e: React.MouseEvent<HTMLAnchorElement | HTMLButtonElement | HTMLDivElement>) => {
    if (hov) {
      e.currentTarget.style.background = "rgba(255,255,255,0.08)";
      e.currentTarget.style.borderColor = "rgba(247,176,65,0.30)";
      e.currentTarget.style.boxShadow = "0 0 20px rgba(247,176,65,0.20), 0 1px 0 rgba(255,255,255,0.06) inset";
      e.currentTarget.style.color = "#E8E4DD";
    } else {
      e.currentTarget.style.background = "rgba(255,255,255,0.04)";
      e.currentTarget.style.borderColor = "rgba(255,255,255,0.10)";
      e.currentTarget.style.boxShadow = "0 1px 0 rgba(255,255,255,0.04) inset";
      e.currentTarget.style.color = C.txm;
    }
  };
}
