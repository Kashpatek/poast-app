// SA Data Story — single-stat animated explainer. Count-up number,
// label, source attribution, optional contextual paragraph. 15-30s
// @ 30fps. Aspect-aware sizing (picks defaults from composition w/h).

import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
  Audio,
} from "remotion";

export interface DataStoryProps {
  value: string;          // "$44B", "92%", "1.8 EB"
  label: string;          // "TSMC capex 2026"
  source?: string;        // "Q1 earnings"
  context?: string;       // 1-2 sentence framing
  accentColor?: string;
  background?: string;
  audioUrl?: string;
  voVolume?: number;
}

export const DataStory: React.FC<DataStoryProps> = ({
  value,
  label,
  source,
  context,
  accentColor = "#F7B041",
  background = "#06060C",
  audioUrl,
  voVolume = 1.0,
}) => {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();

  // Aspect-aware sizing.
  const ratio = width / height;
  const valueFontSize = ratio < 0.7
    ? Math.round(width * 0.28)
    : ratio < 1.3
      ? Math.round(width * 0.22)
      : Math.round(width * 0.16);
  const labelFontSize = Math.round(valueFontSize * 0.22);
  const contextFontSize = Math.round(valueFontSize * 0.16);

  // Animation timing.
  const valueOpacity = interpolate(frame, [10, 36], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const valueY = interpolate(frame, [10, 36], [40, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const valueScale = spring({ frame: frame - 10, fps, config: { damping: 12, stiffness: 80 } });
  const labelOpacity = interpolate(frame, [30, 56], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const contextOpacity = context ? interpolate(frame, [60, 90], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) : 0;
  const sourceOpacity = source ? interpolate(frame, [90, 120], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) : 0;

  return (
    <AbsoluteFill style={{ background, fontFamily: "Outfit, sans-serif" }}>
      {audioUrl ? <Audio src={audioUrl} volume={voVolume} /> : null}

      {/* Ambient radial bloom */}
      <div style={{
        position: "absolute",
        inset: 0,
        background: "radial-gradient(circle at 50% 45%, " + accentColor + "1F, transparent 55%)",
      }} />

      {/* Subtle grid */}
      <div style={{
        position: "absolute",
        inset: 0,
        backgroundImage: "linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)",
        backgroundSize: "60px 60px",
        opacity: 0.5,
      }} />

      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", padding: Math.round(width * 0.06), gap: Math.round(width * 0.025) }}>
        {/* Source pill */}
        {source ? (
          <div style={{
            opacity: sourceOpacity,
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: contextFontSize * 0.7,
            color: accentColor,
            letterSpacing: 4,
            textTransform: "uppercase",
            padding: "6px 14px",
            border: `1px solid ${accentColor}55`,
            borderRadius: 999,
            background: accentColor + "10",
          }}>
            {source}
          </div>
        ) : null}

        {/* Big number */}
        <div
          style={{
            opacity: valueOpacity,
            transform: `translateY(${valueY}px) scale(${valueScale})`,
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: valueFontSize,
            fontWeight: 900,
            color: accentColor,
            letterSpacing: -valueFontSize * 0.04,
            lineHeight: 1,
            textShadow: `0 0 ${valueFontSize * 0.4}px ${accentColor}AA, 0 0 ${valueFontSize * 0.8}px ${accentColor}66`,
            textAlign: "center",
          }}
        >
          {value}
        </div>

        {/* Glow rule */}
        <div style={{
          width: interpolate(frame, [25, 50], [0, valueFontSize * 0.6], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
          height: 3,
          background: accentColor,
          borderRadius: 2,
          boxShadow: `0 0 18px ${accentColor}, 0 0 36px ${accentColor}66`,
          marginTop: Math.round(width * 0.01),
        }} />

        {/* Label */}
        <div
          style={{
            opacity: labelOpacity,
            fontSize: labelFontSize,
            fontWeight: 800,
            color: "#E8E4DD",
            textAlign: "center",
            maxWidth: "84%",
            letterSpacing: -0.6,
            lineHeight: 1.15,
          }}
        >
          {label}
        </div>

        {/* Context */}
        {context ? (
          <div
            style={{
              opacity: contextOpacity,
              fontSize: contextFontSize,
              fontWeight: 500,
              color: "#A0A0A0",
              textAlign: "center",
              maxWidth: "72%",
              lineHeight: 1.5,
              marginTop: Math.round(width * 0.015),
            }}
          >
            {context}
          </div>
        ) : null}
      </AbsoluteFill>

      {/* SA stamp */}
      <div style={{
        position: "absolute",
        bottom: Math.round(width * 0.04),
        right: Math.round(width * 0.04),
        opacity: interpolate(frame, [40, 70], [0, 0.6], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: contextFontSize * 0.75,
        color: accentColor,
        letterSpacing: 4,
        textTransform: "uppercase",
      }}>
        SemiAnalysis
      </div>
    </AbsoluteFill>
  );
};
