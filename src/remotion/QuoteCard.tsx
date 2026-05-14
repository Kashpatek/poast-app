// SA Quote Card — 5s @ 30fps. Title fades in, attribution slides up,
// SA box lettermark glows in bottom-right. Used by the Programmatic
// editor in DesignStudio.

import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

export interface QuoteCardProps {
  quote: string;
  attribution: string;
  source?: string;
  accentColor?: string;
  background?: string;
}

export const QuoteCard: React.FC<QuoteCardProps> = ({
  quote,
  attribution,
  source,
  accentColor = "#F7B041",
  background = "#06060C",
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  // Quote fade-in over 24 frames starting at 6.
  const quoteOpacity = interpolate(frame, [6, 30], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const quoteY = spring({ frame: frame - 6, fps, config: { damping: 16, stiffness: 90 } });

  // Attribution slides up at 36.
  const attrOpacity = interpolate(frame, [36, 60], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const attrY = interpolate(frame, [36, 60], [40, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  // Lettermark glow appears at 50.
  const stampOpacity = interpolate(frame, [50, 80], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  const fontSize = Math.min(96, Math.round(width / 18));
  const padding = Math.round(width * 0.08);
  const stampSize = Math.round(Math.min(width, height) * 0.10);

  return (
    <AbsoluteFill style={{ background, fontFamily: "Outfit, sans-serif" }}>
      {/* Amber rule down the left edge */}
      <div
        style={{
          position: "absolute",
          left: padding,
          top: padding,
          bottom: padding,
          width: 6,
          background: accentColor,
          opacity: quoteOpacity,
        }}
      />

      {/* Quote */}
      <div
        style={{
          position: "absolute",
          left: padding + 30,
          right: padding,
          top: "50%",
          transform: `translateY(calc(-50% + ${(1 - quoteY) * 40}px))`,
          color: "#E8E4DD",
          fontSize,
          fontWeight: 800,
          letterSpacing: -0.8,
          lineHeight: 1.1,
          opacity: quoteOpacity,
        }}
      >
        “{quote}”
      </div>

      {/* Attribution */}
      <div
        style={{
          position: "absolute",
          left: padding + 30,
          bottom: padding + 24,
          color: accentColor,
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: Math.round(fontSize * 0.28),
          fontWeight: 700,
          letterSpacing: 3,
          textTransform: "uppercase",
          opacity: attrOpacity,
          transform: `translateY(${attrY}px)`,
        }}
      >
        — {attribution}
      </div>

      {source ? (
        <div
          style={{
            position: "absolute",
            left: padding + 30,
            bottom: padding,
            color: "#9B9588",
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: Math.round(fontSize * 0.22),
            letterSpacing: 1.5,
            textTransform: "uppercase",
            opacity: attrOpacity,
            transform: `translateY(${attrY}px)`,
          }}
        >
          {source}
        </div>
      ) : null}

      {/* Lettermark stamp */}
      <div
        style={{
          position: "absolute",
          right: padding,
          bottom: padding,
          width: stampSize,
          height: stampSize,
          background: accentColor,
          borderRadius: stampSize * 0.12,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#060608",
          fontWeight: 900,
          fontSize: Math.round(stampSize * 0.5),
          letterSpacing: -1,
          opacity: stampOpacity,
          boxShadow: `0 0 ${stampSize * 0.6}px ${accentColor}66`,
        }}
      >
        SA
      </div>
    </AbsoluteFill>
  );
};
