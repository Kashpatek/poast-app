// SA Episode Trailer — 30s @ 30fps. Cold-open big number, episode title,
// guest, hooks list, CTA. Three "scenes" timed across 900 frames.

import React from "react";
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
  Sequence,
} from "remotion";

export interface EpisodeTrailerProps {
  episodeNumber: string;
  title: string;
  guest: string;
  hooks: string[];
  accentColor?: string;
  background?: string;
}

export const EpisodeTrailer: React.FC<EpisodeTrailerProps> = ({
  episodeNumber,
  title,
  guest,
  hooks,
  accentColor = "#F7B041",
  background = "#06060C",
}) => {
  return (
    <AbsoluteFill style={{ background, fontFamily: "Outfit, sans-serif" }}>
      <Sequence from={0} durationInFrames={150}>
        <SceneCover episodeNumber={episodeNumber} title={title} accentColor={accentColor} />
      </Sequence>
      <Sequence from={150} durationInFrames={300}>
        <SceneGuest guest={guest} accentColor={accentColor} />
      </Sequence>
      <Sequence from={450} durationInFrames={300}>
        <SceneHooks hooks={hooks} accentColor={accentColor} />
      </Sequence>
      <Sequence from={750} durationInFrames={150}>
        <SceneCTA accentColor={accentColor} />
      </Sequence>
    </AbsoluteFill>
  );
};

function SceneCover({ episodeNumber, title, accentColor }: { episodeNumber: string; title: string; accentColor: string }) {
  const frame = useCurrentFrame();
  const { width } = useVideoConfig();
  const o = interpolate(frame, [0, 18], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", opacity: o }}>
      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: Math.round(width * 0.022), color: accentColor, letterSpacing: 3, marginBottom: 18, fontWeight: 700 }}>
        EP. {episodeNumber}
      </div>
      <div style={{ color: "#E8E4DD", fontSize: Math.round(width * 0.06), fontWeight: 900, letterSpacing: -1, textAlign: "center", padding: "0 80px", lineHeight: 1.1 }}>
        {title}
      </div>
    </AbsoluteFill>
  );
}

function SceneGuest({ guest, accentColor }: { guest: string; accentColor: string }) {
  const frame = useCurrentFrame();
  const { width } = useVideoConfig();
  const o = interpolate(frame, [0, 18], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const y = interpolate(frame, [0, 18], [30, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", opacity: o, transform: `translateY(${y}px)` }}>
      <div style={{ color: accentColor, fontFamily: "'JetBrains Mono', monospace", fontSize: Math.round(width * 0.018), letterSpacing: 4, marginBottom: 20, fontWeight: 700, textTransform: "uppercase" }}>
        With
      </div>
      <div style={{ color: "#E8E4DD", fontSize: Math.round(width * 0.07), fontWeight: 900, letterSpacing: -1, textAlign: "center" }}>
        {guest}
      </div>
    </AbsoluteFill>
  );
}

function SceneHooks({ hooks, accentColor }: { hooks: string[]; accentColor: string }) {
  const frame = useCurrentFrame();
  const { width } = useVideoConfig();
  return (
    <AbsoluteFill style={{ alignItems: "flex-start", justifyContent: "center", padding: "0 80px", gap: 24 }}>
      {hooks.slice(0, 4).map((h, i) => {
        const start = i * 30;
        const o = interpolate(frame, [start, start + 18], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
        const x = interpolate(frame, [start, start + 18], [-40, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
        return (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 20, opacity: o, transform: `translateX(${x}px)` }}>
            <div style={{ width: 12, height: 12, background: accentColor, borderRadius: 2 }} />
            <div style={{ color: "#E8E4DD", fontSize: Math.round(width * 0.032), fontWeight: 700, letterSpacing: -0.4 }}>
              {h}
            </div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
}

function SceneCTA({ accentColor }: { accentColor: string }) {
  const frame = useCurrentFrame();
  const { width } = useVideoConfig();
  const o = interpolate(frame, [0, 18], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", opacity: o }}>
      <div style={{ color: "#E8E4DD", fontSize: Math.round(width * 0.05), fontWeight: 800, marginBottom: 16, letterSpacing: -0.6 }}>
        Watch the full episode
      </div>
      <div style={{ color: accentColor, fontFamily: "'JetBrains Mono', monospace", fontSize: Math.round(width * 0.025), letterSpacing: 3, fontWeight: 700, textTransform: "uppercase" }}>
        SEMIANALYSIS.COM
      </div>
    </AbsoluteFill>
  );
}
