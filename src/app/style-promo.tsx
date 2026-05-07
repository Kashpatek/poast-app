"use client";

import React from "react";

// "Advertisement" eyebrow that links out to the live style guide.
// Slim, gradient-flowing, high-density information in one line.
// Used on the analyst splash, the director home, and the asset library.
export function StyleGuidePromo({ position = "top" }: { position?: "top" | "inline" }) {
  return (
    <a
      href="/style-guide.html"
      target="_blank"
      rel="noopener"
      style={{
        ...(position === "top"
          ? { position: "fixed", top: 12, left: "50%", transform: "translateX(-50%)", zIndex: 10500 }
          : { position: "relative", margin: "0 auto" }),
        display: "inline-flex",
        alignItems: "center",
        gap: 12,
        padding: "8px 16px",
        borderRadius: 999,
        background: "rgba(10,10,20,0.85)",
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
        border: "1px solid rgba(247,176,65,0.30)",
        boxShadow: "0 4px 16px rgba(0,0,0,0.35), 0 0 24px rgba(247,176,65,0.10)",
        textDecoration: "none",
        cursor: "pointer",
        animation: "promoBreathe 6s ease-in-out infinite",
        maxWidth: "calc(100vw - 24px)",
      }}
    >
      <span
        style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 9,
          fontWeight: 700,
          letterSpacing: 2,
          textTransform: "uppercase",
          color: "#F7B041",
          padding: "2px 6px",
          borderRadius: 3,
          background: "rgba(247,176,65,0.12)",
          border: "1px solid rgba(247,176,65,0.4)",
          flexShrink: 0,
        }}
      >
        NEW
      </span>
      <span
        style={{
          fontFamily: "'Outfit', sans-serif",
          fontSize: 12,
          fontWeight: 700,
          background: "linear-gradient(120deg, #F7B041 0%, #26C9D8 50%, #F7B041 100%)",
          backgroundSize: "200% 100%",
          WebkitBackgroundClip: "text",
          backgroundClip: "text",
          color: "transparent",
          animation: "promoShim 8s ease-in-out infinite",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        POAST Design System · download the brand kit
      </span>
      <span
        style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 10,
          fontWeight: 700,
          color: "#E8E4DD",
          opacity: 0.7,
          flexShrink: 0,
        }}
      >
        ↗
      </span>
      <style
        dangerouslySetInnerHTML={{
          __html:
            "@keyframes promoShim{0%,100%{background-position:0% 50%}50%{background-position:100% 50%}}@keyframes promoBreathe{0%,100%{box-shadow:0 4px 16px rgba(0,0,0,0.35), 0 0 24px rgba(247,176,65,0.10)}50%{box-shadow:0 6px 24px rgba(0,0,0,0.45), 0 0 36px rgba(247,176,65,0.18)}}",
        }}
      />
    </a>
  );
}
