"use client";
import React, { useRef, useState } from "react";

// Miniaturized version of the BroadcastBuilder cover slide (sa-i3bf0q4q).
// Layers stacked with translateZ depths so the whole stage tilts in 3D
// on hover. Click opens /brand-launch in a new tab.
export default function BrandLaunchTile() {
  var tileRef = useRef<HTMLDivElement | null>(null);
  var innerRef = useRef<HTMLDivElement | null>(null);
  var rafRef = useRef<number | null>(null);
  var _hov = useState(false), hov = _hov[0], setHov = _hov[1];

  var onMove = function(e: React.MouseEvent<HTMLDivElement>) {
    var tile = tileRef.current; var inner = innerRef.current;
    if (!tile || !inner) return;
    var clientX = e.clientX, clientY = e.clientY;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(function() {
      if (!tile || !inner) return;
      var r = tile.getBoundingClientRect();
      var x = (clientX - r.left) / r.width - 0.5;
      var y = (clientY - r.top) / r.height - 0.5;
      inner.style.transform = "rotateY(" + (x * 10) + "deg) rotateX(" + (y * -10) + "deg) scale(1.04)";
    });
  };
  var onLeave = function() {
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    var inner = innerRef.current;
    if (inner) inner.style.transform = "rotateY(0deg) rotateX(0deg) scale(1)";
    setHov(false);
  };
  var onEnter = function() { setHov(true); };
  var onClick = function() { window.open("/brand-launch", "_blank"); };

  return (
    <div
      ref={tileRef}
      onMouseMove={onMove}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      onClick={onClick}
      style={{
        position: "relative",
        width: "100%",
        height: 160,
        margin: "10px 0 12px",
        cursor: "pointer",
        perspective: "1200px",
        borderRadius: 12,
        boxShadow: hov
          ? "0 20px 48px rgba(247,176,65,0.32), 0 0 0 1px rgba(247,176,65,0.35), 0 0 60px rgba(247,176,65,0.18)"
          : "0 8px 20px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.05)",
        transition: "box-shadow 0.32s cubic-bezier(.2,.7,.2,1)",
      }}
    >
      <div
        ref={innerRef}
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: 12,
          overflow: "hidden",
          transformStyle: "preserve-3d",
          transition: "transform 0.22s cubic-bezier(.2,.7,.2,1), filter 0.22s",
          filter: hov ? "brightness(1.06) saturate(1.1)" : "brightness(1) saturate(1)",
          background: "radial-gradient(ellipse at 50% 50%, #14121a 0%, #07070a 70%)",
          willChange: "transform",
        }}
      >
        {/* Layer 1 · backdrop */}
        <div style={{
          position: "absolute", inset: 0,
          background: "radial-gradient(ellipse at 50% 50%, #0A0A0F 0%, #06060B 80%)",
          transform: "translateZ(-60px)",
        }} />

        {/* Layer 2 · 4 concentric rotating rings */}
        <div className={"bbtl-rings " + (hov ? "bbtl-rings-fast" : "")} style={{
          position: "absolute", left: "50%", top: "50%",
          width: 0, height: 0,
          transform: "translate(-50%,-50%) translateZ(-30px)",
          pointerEvents: "none",
        }}>
          <div className="bbtl-ring bbtl-r1" />
          <div className="bbtl-ring bbtl-r2" />
          <div className="bbtl-ring bbtl-r3" />
          <div className="bbtl-ring bbtl-r4" />
        </div>

        {/* Layer 3 · breathing amber glow */}
        <div className="bbtl-glow" style={{
          position: "absolute", left: "50%", top: "50%",
          width: 240, height: 240,
          transform: "translate(-50%,-50%) translateZ(-10px)",
          background: "radial-gradient(circle, rgba(247,176,65,0.30), transparent 65%)",
          filter: "blur(8px)",
          pointerEvents: "none",
        }} />

        {/* Layer 4 · lettermark + LIVE pill (top center) */}
        <div style={{
          position: "absolute", top: 14, left: 0, right: 0,
          display: "flex", justifyContent: "center", alignItems: "center",
          transform: "translateZ(20px)",
          pointerEvents: "none",
        }}>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            padding: "5px 11px",
            border: "1px solid rgba(247,176,65,0.45)",
            borderRadius: 999,
            background: "rgba(247,176,65,0.06)",
            backdropFilter: "blur(6px)",
            WebkitBackdropFilter: "blur(6px)",
            fontFamily: "Outfit, Aptos, sans-serif",
            color: "#fff",
            letterSpacing: "0.32em",
            fontSize: 8,
            fontWeight: 700,
            textTransform: "uppercase",
            whiteSpace: "nowrap",
          }}>
            <span style={{ fontWeight: 800, color: "#fff" }}>SA</span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "#E06347" }}>
              <span className="bbtl-blink" style={{
                width: 5, height: 5, borderRadius: "50%",
                background: "#E06347",
                boxShadow: "0 0 8px #E06347",
                display: "inline-block",
              }} />
              LIVE
            </span>
          </div>
        </div>

        {/* Layer 6 · BROADCAST echo (transparent stroke, slow drift) — behind the mega */}
        <div className="bbtl-echo" style={{
          position: "absolute", left: "50%", top: "50%",
          transform: "translate(-50%,-50%) translateZ(40px)",
          fontFamily: "Outfit, Aptos, sans-serif",
          fontWeight: 800,
          fontSize: 36,
          lineHeight: 0.85,
          letterSpacing: "-0.04em",
          whiteSpace: "nowrap",
          color: "transparent",
          WebkitTextStroke: "1px rgba(255,255,255,0.10)",
          pointerEvents: "none",
          zIndex: 1,
        }}>BROADCAST</div>

        {/* Layer 5 · BROADCAST mega · gradient white→amber→coral */}
        <div style={{
          position: "absolute", left: "50%", top: "50%",
          transform: "translate(-50%,-50%) translateZ(60px)",
          fontFamily: "Outfit, Aptos, sans-serif",
          fontWeight: 800,
          fontSize: 36,
          lineHeight: 0.85,
          letterSpacing: "-0.04em",
          whiteSpace: "nowrap",
          background: "linear-gradient(180deg, #fff 0%, #F7B041 65%, #E06347 100%)",
          WebkitBackgroundClip: "text",
          backgroundClip: "text",
          WebkitTextFillColor: "transparent",
          color: "transparent",
          textShadow: "0 0 24px rgba(247,176,65,0.25)",
          pointerEvents: "none",
          zIndex: 2,
        }}>BROADCAST</div>

        {/* Bottom hint label */}
        <div style={{
          position: "absolute", left: 0, right: 0, bottom: 10,
          textAlign: "center",
          fontFamily: "Outfit, Aptos, sans-serif",
          fontSize: 8,
          fontWeight: 600,
          letterSpacing: "0.34em",
          textTransform: "uppercase",
          color: "rgba(255,255,255,0.55)",
          transform: "translateZ(20px)",
          pointerEvents: "none",
        }}>
          Brand Launch <span style={{ color: "#2EAD8E", margin: "0 6px" }}>/</span> <b style={{ color: "#F7B041", fontWeight: 700 }}>2026</b>
        </div>
      </div>

      {/* Scoped styles · keyframes + ring sizes + ring speed-up on hover */}
      <style>{`
        @keyframes bbtlSpin { to { transform: translate(-50%,-50%) rotate(360deg) } }
        @keyframes bbtlBreath { 0%,100% { opacity:.65 } 50% { opacity:1 } }
        @keyframes bbtlEcho { 0%,100% { transform: translate(-50%,-50%) translateZ(40px) translateX(0) } 50% { transform: translate(-50%,-50%) translateZ(40px) translateX(2px) } }
        @keyframes bbtlBlink { 0%,100% { opacity:1 } 50% { opacity:.3 } }
        .bbtl-glow { animation: bbtlBreath 6s ease-in-out infinite }
        .bbtl-echo { animation: bbtlEcho 6s ease-in-out infinite }
        .bbtl-blink { animation: bbtlBlink 1.4s ease-in-out infinite }
        .bbtl-ring {
          position: absolute; left: 50%; top: 50%;
          border-radius: 50%; border: 1px solid rgba(255,255,255,0.08);
        }
        .bbtl-r1 { width: 80px;  height: 80px;  border-color: rgba(247,176,65,0.35); transform: translate(-50%,-50%); animation: bbtlSpin 18s linear infinite }
        .bbtl-r2 { width: 130px; height: 130px; border-color: rgba(46,173,142,0.28); transform: translate(-50%,-50%); animation: bbtlSpin 28s linear infinite reverse }
        .bbtl-r3 { width: 200px; height: 200px; border-color: rgba(11,134,209,0.28); transform: translate(-50%,-50%); animation: bbtlSpin 42s linear infinite }
        .bbtl-r4 { width: 280px; height: 280px; border-color: rgba(224,99,71,0.22); transform: translate(-50%,-50%); animation: bbtlSpin 60s linear infinite reverse }
        .bbtl-rings-fast .bbtl-r1 { animation-duration: 12.6s }
        .bbtl-rings-fast .bbtl-r2 { animation-duration: 19.6s }
        .bbtl-rings-fast .bbtl-r3 { animation-duration: 29.4s }
        .bbtl-rings-fast .bbtl-r4 { animation-duration: 42s }
      `}</style>
    </div>
  );
}
