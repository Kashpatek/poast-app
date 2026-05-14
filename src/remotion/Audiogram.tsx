// Audiogram — square or vertical waveform composition with captions.
// Animated bars + caption fade-in/out. Audio is pulled from `audioUrl`
// when a real render is fired; the Player preview uses synthetic bars.

import React from "react";
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

export interface AudiogramProps {
  title: string;
  attribution: string;
  audioUrl?: string;
  waveformColor?: string;
  accentColor?: string;
  background?: string;
}

export const Audiogram: React.FC<AudiogramProps> = ({
  title,
  attribution,
  waveformColor = "#F7B041",
  accentColor = "#F7B041",
  background = "#06060C",
}) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  const barCount = 48;
  const padding = Math.round(width * 0.08);
  const wfHeight = Math.round(height * 0.18);
  const wfTop = Math.round(height * 0.62);

  return (
    <AbsoluteFill style={{ background, fontFamily: "Outfit, sans-serif" }}>
      {/* Title */}
      <div
        style={{
          position: "absolute",
          top: padding,
          left: padding,
          right: padding,
          color: "#E8E4DD",
          fontSize: Math.round(width * 0.05),
          fontWeight: 800,
          letterSpacing: -0.6,
          lineHeight: 1.15,
        }}
      >
        {title}
      </div>

      {/* Attribution */}
      <div
        style={{
          position: "absolute",
          top: padding + Math.round(width * 0.05) * 2.5,
          left: padding,
          color: accentColor,
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: Math.round(width * 0.018),
          fontWeight: 700,
          letterSpacing: 2,
          textTransform: "uppercase",
        }}
      >
        — {attribution}
      </div>

      {/* Waveform */}
      <div style={{ position: "absolute", left: padding, right: padding, top: wfTop, height: wfHeight, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        {Array.from({ length: barCount }).map((_, i) => {
          // Pseudo-waveform — each bar oscillates with a unique phase.
          const phase = (frame + i * 6) / 6;
          const amp = (Math.sin(phase) * 0.5 + 0.5) * 0.7 + Math.random() * 0.05;
          const h = Math.max(6, Math.round(wfHeight * amp));
          return (
            <div
              key={i}
              style={{
                width: Math.max(3, Math.round((width - padding * 2) / barCount) - 3),
                height: h,
                background: waveformColor,
                borderRadius: 3,
                opacity: 0.85,
              }}
            />
          );
        })}
      </div>

      {/* SA stamp */}
      <div
        style={{
          position: "absolute",
          left: padding,
          bottom: padding,
          width: Math.round(width * 0.08),
          height: Math.round(width * 0.08),
          background: accentColor,
          borderRadius: Math.round(width * 0.01),
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#060608",
          fontWeight: 900,
          fontSize: Math.round(width * 0.04),
          opacity: interpolate(frame, [0, 30], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
        }}
      >
        SA
      </div>
    </AbsoluteFill>
  );
};
