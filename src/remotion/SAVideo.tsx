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
  Loop,
  staticFile,
} from "remotion";

var AMBER = "#F7B041";
var BG = "#060608";
var TX = "#FFFFFF";
var TXM = "#A0A0A0";

var DEFAULT_FONT = "'Outfit',sans-serif";
var DEFAULT_FONT_SIZE = 48;

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
  fontFamily?: string;
  fontSize?: number;
  captionStyle?: "overlay" | "subtitles" | "minimal";
  clipVolume?: number;
  voVolume?: number;
  musicVolume?: number;
}

// ═══ Grift font registration ═══
var GriftFontFaces: React.FC = () => {
  var css = [
    { weight: 400, file: "Grift-Regular.woff2" },
    { weight: 500, file: "Grift-Medium.woff2" },
    { weight: 600, file: "Grift-SemiBold.woff2" },
    { weight: 700, file: "Grift-Bold.woff2" },
    { weight: 800, file: "Grift-ExtraBold.woff2" },
    { weight: 900, file: "Grift-Black.woff2" },
  ].map(function (f) {
    return "@font-face { font-family: 'Grift'; font-weight: " + f.weight + "; font-display: block; src: url('" + staticFile("fonts/" + f.file) + "') format('woff2'); }";
  }).join("\n");
  return <style dangerouslySetInnerHTML={{ __html: css }} />;
};

var FadeText: React.FC<{ text: string; delay?: number; size?: number; color?: string; weight?: number; maxW?: string; font?: string }> = function (props) {
  var text = props.text;
  var delay = props.delay || 0;
  var size = props.size || DEFAULT_FONT_SIZE;
  var color = props.color || TX;
  var weight = props.weight || 700;
  var maxW = props.maxW || "75%";
  var font = props.font || DEFAULT_FONT;
  var frame = useCurrentFrame();
  var opacity = interpolate(frame - delay, [0, 20], [0, 1], { extrapolateRight: "clamp", extrapolateLeft: "clamp" });
  var y = interpolate(frame - delay, [0, 20], [20, 0], { extrapolateRight: "clamp", extrapolateLeft: "clamp" });
  return (
    <div style={{ opacity: Math.max(0, opacity), transform: "translateY(" + Math.max(0, y) + "px)", fontFamily: font, fontSize: size, fontWeight: weight, color: color, textAlign: "center", maxWidth: maxW, lineHeight: 1.4 }}>
      {text}
    </div>
  );
};

var ProgressBar: React.FC = function () {
  var frame = useCurrentFrame();
  var config = useVideoConfig();
  var pct = (frame / config.durationInFrames) * 100;
  return (
    <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 4, background: AMBER + "20" }}>
      <div style={{ height: "100%", width: pct + "%", background: AMBER }} />
    </div>
  );
};

var Watermark: React.FC = function () {
  return (
    <div style={{ position: "absolute", bottom: 28, right: 32, display: "flex", alignItems: "center", gap: 10, opacity: 0.5 }}>
      <div style={{ width: 32, height: 32, borderRadius: 8, background: AMBER + "30", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Outfit", fontSize: 16, fontWeight: 900, color: AMBER }}>SA</div>
      <span style={{ fontFamily: "JetBrains Mono", fontSize: 11, color: TXM }}>SEMIANALYSIS</span>
    </div>
  );
};

export var SAVideo: React.FC<Props> = function (props) {
  var hook = props.hook;
  var scriptSections = props.scriptSections;
  var dataPoints = props.dataPoints;
  var thumbnailHeadline = props.thumbnailHeadline;
  var audioUrl = props.audioUrl;
  var clipUrls = props.clipUrls;
  var musicUrl = props.musicUrl;
  var duration = props.duration;
  var fontFamily = props.fontFamily || DEFAULT_FONT;
  var fontSize = props.fontSize || DEFAULT_FONT_SIZE;
  var captionStyle = props.captionStyle || "overlay";
  var clipVolume = typeof props.clipVolume === "number" ? props.clipVolume : 0.3;
  var voVolume = typeof props.voVolume === "number" ? props.voVolume : 1.0;
  var musicVolume = typeof props.musicVolume === "number" ? props.musicVolume : 0.15;

  var needsGrift = fontFamily.toLowerCase().indexOf("grift") !== -1;

  // Proportional sizes
  var headingSize = fontSize;             // 1x
  var bodySize = Math.round(fontSize * 0.75);   // 0.75x
  var labelSize = Math.round(fontSize * 0.5);   // 0.5x

  var config = useVideoConfig();
  var fps = config.fps;
  var totalFrames = duration * fps;
  var musicDurationFrames = 30 * fps;

  var hookFrames = Math.round(totalFrames * 0.12);
  var sectionFrames = scriptSections.length > 0
    ? Math.round((totalFrames * 0.7) / scriptSections.length)
    : Math.round(totalFrames * 0.7);
  var dataFrames = dataPoints.length > 0 ? Math.round(totalFrames * 0.08) : 0;
  var outroFrames = totalFrames - hookFrames - (sectionFrames * scriptSections.length) - dataFrames;

  var f = 0;

  return (
    <AbsoluteFill style={{ background: BG }}>
      {/* Register Grift if needed */}
      {needsGrift && <GriftFontFaces />}

      {/* Voiceover */}
      {audioUrl && <Audio src={audioUrl} volume={voVolume} />}
      {/* Music -- looped */}
      {musicUrl && <Loop durationInFrames={musicDurationFrames}>
        <Audio src={musicUrl} volume={musicVolume} />
      </Loop>}

      {/* Ambient glow */}
      <div style={{ position: "absolute", top: "-20%", right: "-10%", width: "50%", height: "50%", borderRadius: "50%", background: "radial-gradient(circle, " + AMBER + "0A, transparent 60%)" }} />

      {/* ═══ HOOK ═══ */}
      <Sequence from={f} durationInFrames={hookFrames}>
        <AbsoluteFill style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 120px" }}>
          <FadeText text={hook} size={Math.round(headingSize * 1.33)} color={AMBER} weight={900} delay={5} maxW="70%" font={fontFamily} />
          <div style={{ marginTop: 24 }}>
            <FadeText text={thumbnailHeadline || "SemiAnalysis"} size={labelSize} color={TXM} weight={500} delay={20} font={fontFamily} />
          </div>
          <Watermark />
        </AbsoluteFill>
      </Sequence>

      {/* ═══ SCRIPT SECTIONS ═══ */}
      {scriptSections.map(function (section, i) {
        f += i === 0 ? hookFrames : sectionFrames;
        var clipUrl = clipUrls[i] || section.clipUrl;

        // "minimal" caption style: skip mid-video text overlays entirely
        if (captionStyle === "minimal") {
          return (
            <Sequence key={i} from={f} durationInFrames={sectionFrames}>
              <AbsoluteFill>
                {clipUrl && (
                  <Video src={clipUrl} volume={clipVolume} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                )}
                <Watermark />
              </AbsoluteFill>
            </Sequence>
          );
        }

        // "subtitles" caption style: text at bottom with dark background strip, no cards
        if (captionStyle === "subtitles") {
          return (
            <Sequence key={i} from={f} durationInFrames={sectionFrames}>
              <AbsoluteFill>
                {clipUrl && (
                  <Video src={clipUrl} volume={clipVolume} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                )}
                {/* Bottom subtitle strip */}
                <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "rgba(0,0,0,0.75)", padding: "20px 60px 28px" }}>
                  <FadeText text={section.text} size={bodySize} color={TX} weight={600} delay={5} maxW="100%" font={fontFamily} />
                </div>
                <Watermark />
              </AbsoluteFill>
            </Sequence>
          );
        }

        // "overlay" caption style (default): text on dark semi-transparent cards over b-roll
        return (
          <Sequence key={i} from={f} durationInFrames={sectionFrames}>
            <AbsoluteFill>
              {/* B-Roll background -- full bleed */}
              {clipUrl && (
                <Video src={clipUrl} volume={clipVolume} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              )}
              {/* Dark overlay for readability */}
              <div style={{ position: "absolute", inset: 0, background: "linear-gradient(transparent 30%, rgba(0,0,0,0.7) 100%)" }} />
              {/* Text at bottom */}
              <AbsoluteFill style={{ display: "flex", flexDirection: "column", justifyContent: "flex-end", padding: "0 80px 80px" }}>
                <div style={{ fontFamily: "JetBrains Mono", fontSize: Math.round(labelSize * 0.54), fontWeight: 700, color: AMBER, letterSpacing: 3, textTransform: "uppercase", marginBottom: 10 }}>{section.label}</div>
                <FadeText text={section.text} size={bodySize} color={TX} weight={600} delay={5} maxW="90%" font={fontFamily} />
              </AbsoluteFill>
              <Watermark />
            </AbsoluteFill>
          </Sequence>
        );
      })}

      {/* ═══ DATA POINTS ═══ */}
      {dataPoints.length > 0 && (function () {
        f += sectionFrames;
        return (
          <Sequence from={f} durationInFrames={dataFrames}>
            <AbsoluteFill style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 28 }}>
              <FadeText text="Key Numbers" size={labelSize} color={AMBER} weight={700} font={fontFamily} />
              <div style={{ display: "flex", gap: 20 }}>
                {dataPoints.slice(0, 3).map(function (dp, di) {
                  var s = spring({ frame: useCurrentFrame() - di * 8, fps: 30, config: { damping: 12 } });
                  return (
                    <div key={di} style={{ transform: "scale(" + s + ")", background: BG + "EE", border: "1px solid " + AMBER + "30", borderRadius: 16, padding: "24px 36px", textAlign: "center" }}>
                      <div style={{ fontFamily: "JetBrains Mono", fontSize: Math.round(headingSize * 1.17), fontWeight: 900, color: AMBER }}>{dp.value}</div>
                      <div style={{ fontFamily: fontFamily, fontSize: Math.round(labelSize * 0.75), color: TXM, marginTop: 6 }}>{dp.label}</div>
                    </div>
                  );
                })}
              </div>
              <Watermark />
            </AbsoluteFill>
          </Sequence>
        );
      })()}

      {/* ═══ OUTRO ═══ */}
      {(function () {
        f += dataFrames;
        return (
          <Sequence from={f} durationInFrames={outroFrames}>
            <AbsoluteFill style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 20 }}>
              {/* SA logo */}
              <img src="/sa-logo.svg" style={{ width: 120, height: 120, marginBottom: 16 }} />
              <FadeText text="SemiAnalysis" size={Math.round(headingSize * 0.875)} color={TX} weight={800} delay={5} font={fontFamily} />
              <FadeText text="semianalysis.com" size={labelSize} color={AMBER} weight={600} delay={15} font={fontFamily} />
              <div style={{ marginTop: 10 }}>
                <FadeText text="youtube.com/@SemianalysisWeekly" size={Math.round(labelSize * 0.58)} color={TXM} weight={500} delay={25} font={fontFamily} />
              </div>
            </AbsoluteFill>
          </Sequence>
        );
      })()}

      <ProgressBar />
    </AbsoluteFill>
  );
};
