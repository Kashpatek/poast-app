"use client";
import React, { useState } from "react";

// Compact sidebar tile: "SA Brand Launch · 2026" with a slideshow icon
// that opens /brand-launch in a new tab. Replaces the previous 160px-tall
// 3D card with rotating rings + giant BROADCAST text — it was beautiful
// but ate too much sidebar real estate.
export default function BrandLaunchTile() {
  const [hov, setHov] = useState(false);
  return (
    <button
      type="button"
      onClick={() => window.open("/brand-launch", "_blank")}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      title="Open the 2026 brand launch deck"
      style={{
        width: "100%",
        margin: "8px 0 6px",
        padding: "9px 12px",
        display: "flex",
        alignItems: "center",
        gap: 10,
        background: hov
          ? "linear-gradient(135deg, rgba(247,176,65,0.14), rgba(224,99,71,0.10))"
          : "linear-gradient(135deg, rgba(247,176,65,0.06), rgba(224,99,71,0.04))",
        border: "1px solid " + (hov ? "rgba(247,176,65,0.50)" : "rgba(247,176,65,0.22)"),
        borderRadius: 10,
        cursor: "pointer",
        transition: "background 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease, transform 0.18s ease",
        boxShadow: hov ? "0 6px 18px rgba(247,176,65,0.18), 0 0 0 1px rgba(247,176,65,0.20)" : "0 2px 8px rgba(0,0,0,0.25)",
        transform: hov ? "translateY(-1px)" : "translateY(0)",
        fontFamily: "Outfit, sans-serif",
        textAlign: "left",
      }}
    >
      {/* Live dot */}
      <span
        style={{
          width: 7,
          height: 7,
          borderRadius: "50%",
          background: "#E06347",
          boxShadow: "0 0 8px #E06347",
          flexShrink: 0,
          animation: "blDot 1.6s ease-in-out infinite",
        }}
      />
      <style dangerouslySetInnerHTML={{ __html: "@keyframes blDot{0%,100%{opacity:1}50%{opacity:0.4}}" }} />

      {/* Title block */}
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: "block", fontSize: 11, fontWeight: 800, color: "#E8E4DD", letterSpacing: 0.2, lineHeight: 1.2 }}>
          Brand Launch
        </span>
        <span style={{ display: "block", fontFamily: "'JetBrains Mono', monospace", fontSize: 9, fontWeight: 700, color: hov ? "#F7B041" : "rgba(255,255,255,0.45)", letterSpacing: 1.5, marginTop: 2 }}>
          2026 · Presentation
        </span>
      </span>

      {/* Slideshow play button */}
      <span
        style={{
          width: 26,
          height: 26,
          borderRadius: 7,
          background: hov ? "#F7B041" : "rgba(247,176,65,0.18)",
          color: hov ? "#060608" : "#F7B041",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          transition: "background 0.18s ease, color 0.18s ease",
          boxShadow: hov ? "0 0 12px rgba(247,176,65,0.35)" : "none",
        }}
      >
        {/* Triangle play glyph rendered with CSS borders for crisp 1px edges */}
        <span
          style={{
            display: "inline-block",
            width: 0,
            height: 0,
            marginLeft: 2,
            borderTop: "5px solid transparent",
            borderBottom: "5px solid transparent",
            borderLeft: "8px solid currentColor",
          }}
        />
      </span>
    </button>
  );
}
