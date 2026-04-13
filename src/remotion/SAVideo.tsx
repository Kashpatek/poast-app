import React from "react";
import {
  AbsoluteFill,
  Sequence,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Audio,
  Video,
} from "remotion";

const AMBER = "#F7B041";
const BG = "#060608";
const TX = "#E8E4DD";
const TXM = "#6B6878";

interface Section {
  label: string;
  text: string;
  clipUrl?: string;
}

interface DataPoint {
  value: string;
  label: string;
}

interface Props {
  hook: string;
  scriptSections: Section[];
  dataPoints: DataPoint[];
  thumbnailHeadline: string;
  audioUrl: string;
  clipUrls: string[];
  musicUrl: string;
  duration: number;
}

const FadeText: React.FC<{ text: string; delay?: number; size?: number; color?: string; weight?: number }> = ({
  text, delay = 0, size = 40, color = TX, weight = 700,
}) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame - delay, [0, 15], [0, 1], { extrapolateRight: "clamp", extrapolateLeft: "clamp" });
  const y = interpolate(frame - delay, [0, 15], [16, 0], { extrapolateRight: "clamp", extrapolateLeft: "clamp" });
  return (
    <div style={{ opacity: Math.max(0, opacity), transform: `translateY(${Math.max(0, y)}px)`, fontFamily: "Outfit, sans-serif", fontSize: size, fontWeight: weight, color, textAlign: "center", maxWidth: "80%", lineHeight: 1.3 }}>
      {text}
    </div>
  );
};

const ProgressBar: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const pct = (frame / durationInFrames) * 100;
  return (
    <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 3, background: `${AMBER}20` }}>
      <div style={{ height: "100%", width: `${pct}%`, background: AMBER }} />
    </div>
  );
};

const Watermark: React.FC = () => (
  <div style={{ position: "absolute", bottom: 20, right: 24, display: "flex", alignItems: "center", gap: 8, opacity: 0.6 }}>
    <div style={{ width: 24, height: 24, borderRadius: 6, background: `${AMBER}30`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Outfit", fontSize: 12, fontWeight: 900, color: AMBER }}>SA</div>
    <span style={{ fontFamily: "JetBrains Mono", fontSize: 9, color: TXM }}>SEMIANALYSIS</span>
  </div>
);

export const SAVideo: React.FC<Props> = ({
  hook, scriptSections, dataPoints, thumbnailHeadline,
  audioUrl, clipUrls, musicUrl, duration,
}) => {
  const { fps } = useVideoConfig();
  const totalFrames = duration * fps;

  // Calculate section frames
  const hookFrames = Math.round(totalFrames * 0.12);
  const sectionFrames = scriptSections.length > 0
    ? Math.round((totalFrames * 0.7) / scriptSections.length)
    : totalFrames * 0.7;
  const dataFrames = Math.round(totalFrames * 0.1);
  const outroFrames = totalFrames - hookFrames - (sectionFrames * scriptSections.length) - dataFrames;

  let f = 0;

  return (
    <AbsoluteFill style={{ background: BG }}>
      {/* Audio */}
      {audioUrl && <Audio src={audioUrl} />}
      {musicUrl && <Audio src={musicUrl} volume={0.15} />}

      {/* Ambient */}
      <div style={{ position: "absolute", top: "-20%", right: "-10%", width: "50%", height: "50%", borderRadius: "50%", background: `radial-gradient(circle, ${AMBER}08, transparent 60%)` }} />

      {/* HOOK */}
      <Sequence from={f} durationInFrames={hookFrames}>
        <AbsoluteFill style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 80px" }}>
          <FadeText text={hook} size={52} color={AMBER} weight={900} delay={5} />
          <div style={{ marginTop: 16 }}>
            <FadeText text={thumbnailHeadline || "SemiAnalysis"} size={18} color={TXM} weight={500} delay={18} />
          </div>
          <Watermark />
        </AbsoluteFill>
      </Sequence>

      {/* SCRIPT SECTIONS with B-Roll */}
      {scriptSections.map((section, i) => {
        f += i === 0 ? hookFrames : sectionFrames;
        const clipUrl = clipUrls[i] || section.clipUrl;
        return (
          <Sequence key={i} from={f} durationInFrames={sectionFrames}>
            <AbsoluteFill>
              {/* B-Roll background */}
              {clipUrl && (
                <div style={{ position: "absolute", inset: 0, opacity: 0.4 }}>
                  <Video src={clipUrl} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                </div>
              )}
              {/* Text overlay */}
              <AbsoluteFill style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 100px" }}>
                <div style={{ background: `${BG}CC`, borderRadius: 16, padding: "28px 36px", border: `1px solid ${AMBER}15`, maxWidth: "85%" }}>
                  <div style={{ fontFamily: "JetBrains Mono", fontSize: 10, fontWeight: 700, color: AMBER, letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>{section.label}</div>
                  <FadeText text={section.text} size={24} color={TX} weight={500} delay={5} />
                </div>
                <Watermark />
              </AbsoluteFill>
            </AbsoluteFill>
          </Sequence>
        );
      })}

      {/* DATA POINTS */}
      {dataPoints.length > 0 && (() => {
        f += sectionFrames;
        return (
          <Sequence from={f} durationInFrames={dataFrames}>
            <AbsoluteFill style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 20 }}>
              <FadeText text="Key Numbers" size={18} color={AMBER} weight={700} />
              <div style={{ display: "flex", gap: 16 }}>
                {dataPoints.slice(0, 3).map((dp, di) => {
                  const s = spring({ frame: useCurrentFrame() - di * 8, fps: 30, config: { damping: 12 } });
                  return (
                    <div key={di} style={{ transform: `scale(${s})`, background: `${BG}EE`, border: `1px solid ${AMBER}25`, borderRadius: 12, padding: "18px 24px", textAlign: "center" }}>
                      <div style={{ fontFamily: "JetBrains Mono", fontSize: 40, fontWeight: 900, color: AMBER }}>{dp.value}</div>
                      <div style={{ fontFamily: "Outfit", fontSize: 14, color: TXM, marginTop: 4 }}>{dp.label}</div>
                    </div>
                  );
                })}
              </div>
              <Watermark />
            </AbsoluteFill>
          </Sequence>
        );
      })()}

      {/* OUTRO */}
      {(() => {
        f += dataFrames;
        return (
          <Sequence from={f} durationInFrames={outroFrames}>
            <AbsoluteFill style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16 }}>
              <FadeText text="semianalysis.com" size={20} color={AMBER} weight={700} delay={5} />
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 20 }}>
                <div style={{ width: 44, height: 44, borderRadius: 10, background: `${AMBER}25`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Outfit", fontSize: 20, fontWeight: 900, color: AMBER }}>SA</div>
                <div>
                  <div style={{ fontFamily: "Outfit", fontSize: 16, fontWeight: 700, color: TX }}>SemiAnalysis</div>
                  <div style={{ fontFamily: "JetBrains Mono", fontSize: 10, color: TXM }}>youtube.com/@SemianalysisWeekly</div>
                </div>
              </div>
            </AbsoluteFill>
          </Sequence>
        );
      })()}

      <ProgressBar />
    </AbsoluteFill>
  );
};
