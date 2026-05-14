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

// Aspect-aware caption sizing. Captions in vertical / square need to be
// substantially bigger than 16:9 for legibility on mobile feeds. We pick
// a baseline from the composition's actual width/height ratio and let the
// `fontSize` prop override if the user wants per-section tuning.
function pickBaseFontSize(width: number, height: number): number {
  var ratio = width / height;
  if (ratio < 0.7) return 72;   // 9:16 vertical
  if (ratio < 1.3) return 64;   // 1:1 square
  return 56;                     // 16:9 landscape (was 48 — bumped per Premier brief)
}

// Readability stroke + drop shadow so captions stay legible over busy b-roll.
var CAPTION_TEXT_SHADOW =
  "0 0 8px rgba(0,0,0,0.85), 0 2px 6px rgba(0,0,0,0.75), 0 0 18px rgba(0,0,0,0.5)";

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

var FadeText: React.FC<{
  text: string;
  delay?: number;
  size?: number;
  color?: string;
  weight?: number;
  maxW?: string;
  font?: string;
  letterSpacing?: number;
  shadow?: boolean;
  align?: "left" | "center" | "right";
}> = function (props) {
  var text = props.text;
  var delay = props.delay || 0;
  var size = props.size || 56;
  var color = props.color || TX;
  var weight = props.weight || 700;
  var maxW = props.maxW || "75%";
  var font = props.font || DEFAULT_FONT;
  var letterSpacing = typeof props.letterSpacing === "number" ? props.letterSpacing : -0.6;
  var shadow = props.shadow !== false;
  var align = props.align || "center";
  var frame = useCurrentFrame();
  var opacity = interpolate(frame - delay, [0, 20], [0, 1], { extrapolateRight: "clamp", extrapolateLeft: "clamp" });
  var y = interpolate(frame - delay, [0, 24], [28, 0], { extrapolateRight: "clamp", extrapolateLeft: "clamp" });
  var blur = interpolate(frame - delay, [0, 14], [6, 0], { extrapolateRight: "clamp", extrapolateLeft: "clamp" });
  return (
    <div
      style={{
        opacity: Math.max(0, opacity),
        transform: "translateY(" + Math.max(0, y) + "px)",
        filter: blur > 0.1 ? "blur(" + blur + "px)" : "none",
        fontFamily: font,
        fontSize: size,
        fontWeight: weight,
        color: color,
        textAlign: align,
        maxWidth: maxW,
        lineHeight: 1.15,
        letterSpacing: letterSpacing,
        textShadow: shadow ? CAPTION_TEXT_SHADOW : "none",
        WebkitFontSmoothing: "antialiased",
      }}
    >
      {text}
    </div>
  );
};

// Cinematic film grain overlay — animated SVG-based noise that drifts each frame.
// Pure CSS approach using an inline SVG turbulence filter, no asset deps.
var FilmGrain: React.FC<{ opacity?: number }> = function (props) {
  var op = typeof props.opacity === "number" ? props.opacity : 0.10;
  var frame = useCurrentFrame();
  // Re-seed each frame so the grain looks like real film noise.
  var seed = (frame % 13) + 1;
  var svg =
    "<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'>" +
      "<filter id='n'>" +
        "<feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch' seed='" + seed + "'/>" +
        "<feColorMatrix type='matrix' values='0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.4 0'/>" +
      "</filter>" +
      "<rect width='100%' height='100%' filter='url(#n)'/>" +
    "</svg>";
  var url = "data:image/svg+xml;utf8," + encodeURIComponent(svg);
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        backgroundImage: "url(\"" + url + "\")",
        backgroundRepeat: "repeat",
        backgroundSize: "200px 200px",
        opacity: op,
        pointerEvents: "none",
        mixBlendMode: "overlay",
        zIndex: 9,
      }}
    />
  );
};

// Vignette — soft dark gradient at the corners. Adds depth and focuses the eye.
var Vignette: React.FC<{ strength?: number }> = function (props) {
  var s = typeof props.strength === "number" ? props.strength : 0.55;
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background:
          "radial-gradient(ellipse at center, transparent 30%, rgba(0,0,0," + s + ") 100%)",
        pointerEvents: "none",
        zIndex: 8,
      }}
    />
  );
};

// Cinematic b-roll wrapper — applies Ken Burns (slow zoom + pan), color grade,
// and crossfade. Each section gets its own instance.
var CinematicClip: React.FC<{ clipUrl: string; volume: number; index: number; durationFrames: number }> = function (props) {
  var clipUrl = props.clipUrl;
  var volume = props.volume;
  var index = props.index;
  var dur = props.durationFrames;
  var frame = useCurrentFrame();
  // Alternate zoom direction per section so cuts feel varied.
  var zoomIn = index % 2 === 0;
  var scale = interpolate(frame, [0, dur], zoomIn ? [1.05, 1.18] : [1.18, 1.05], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  // Subtle horizontal drift.
  var driftX = interpolate(frame, [0, dur], zoomIn ? [-1.5, 1.5] : [1.5, -1.5], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  // Crossfade in for the first 12 frames of the clip.
  var fadeIn = interpolate(frame, [0, 12], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", opacity: fadeIn }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          transform: "scale(" + scale + ") translateX(" + driftX + "%)",
          transformOrigin: "center center",
          willChange: "transform",
        }}
      >
        <Video
          src={clipUrl}
          volume={volume}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            // Color grade: slight desaturation, lift shadows, warm midtones.
            filter: "saturate(0.92) contrast(1.08) brightness(1.02)",
          }}
        />
      </div>
    </div>
  );
};

// Tiny utility: a glowing horizontal rule used in titles and lower-thirds.
var GlowRule: React.FC<{ color?: string; width?: number; delay?: number }> = function (props) {
  var color = props.color || AMBER;
  var w = props.width || 80;
  var delay = props.delay || 0;
  var frame = useCurrentFrame();
  var grow = interpolate(frame - delay, [0, 28], [0, w], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <div
      style={{
        width: grow,
        height: 3,
        background: color,
        borderRadius: 2,
        boxShadow: "0 0 18px " + color + ", 0 0 40px " + color + "66",
      }}
    />
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
  var captionStyle = props.captionStyle || "overlay";
  var clipVolume = typeof props.clipVolume === "number" ? props.clipVolume : 0.3;
  var voVolume = typeof props.voVolume === "number" ? props.voVolume : 1.0;
  var musicVolume = typeof props.musicVolume === "number" ? props.musicVolume : 0.15;

  var needsGrift = fontFamily.toLowerCase().indexOf("grift") !== -1;

  var config = useVideoConfig();
  var fps = config.fps;
  var totalFrames = duration * fps;
  var musicDurationFrames = 30 * fps;

  // Aspect-aware font size — picked once based on composition dimensions.
  // User-provided fontSize wins if set.
  var fontSize = props.fontSize || pickBaseFontSize(config.width, config.height);

  // Proportional sizes — headlines lean larger now for movie-screen presence.
  var headingSize = Math.round(fontSize * 1.15);
  var bodySize = Math.round(fontSize * 0.92);
  var labelSize = Math.round(fontSize * 0.42);

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

      {/* ═══ HOOK ═══ Dramatic cinematic intro. */}
      <Sequence from={f} durationInFrames={hookFrames}>
        <AbsoluteFill style={{ background: BG, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 96px", position: "relative" }}>
          {/* Sweeping amber glow that drifts behind the title */}
          <div style={{
            position: "absolute",
            inset: 0,
            background: "radial-gradient(circle at 50% 45%, " + AMBER + "1F, transparent 55%), radial-gradient(circle at 20% 80%, " + AMBER + "12, transparent 50%)",
          }} />
          {/* Label above hook */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 18, marginBottom: 28, position: "relative", zIndex: 2 }}>
            <GlowRule color={AMBER} width={120} delay={4} />
            <div style={{ fontFamily: "JetBrains Mono", fontSize: Math.max(14, Math.round(labelSize * 0.7)), fontWeight: 700, color: AMBER, letterSpacing: 6, textTransform: "uppercase" }}>
              SemiAnalysis
            </div>
          </div>
          <FadeText
            text={hook}
            size={Math.round(headingSize * 1.45)}
            color={TX}
            weight={900}
            delay={10}
            maxW="86%"
            font={fontFamily}
            letterSpacing={-1.6}
            shadow={true}
          />
          {thumbnailHeadline ? (
            <div style={{ marginTop: 28, position: "relative", zIndex: 2 }}>
              <FadeText text={thumbnailHeadline} size={Math.round(bodySize * 0.6)} color={TXM} weight={500} delay={28} font={fontFamily} letterSpacing={0.6} shadow={false} />
            </div>
          ) : null}
          <Vignette strength={0.5} />
          <FilmGrain opacity={0.08} />
          <Watermark />
        </AbsoluteFill>
      </Sequence>

      {/* ═══ SCRIPT SECTIONS ═══ Cinematic b-roll with Ken Burns + tasteful lower thirds. */}
      {scriptSections.map(function (section, i) {
        f += i === 0 ? hookFrames : sectionFrames;
        var clipUrl = clipUrls[i] || section.clipUrl;

        // "minimal" caption style: skip mid-video text overlays entirely.
        if (captionStyle === "minimal") {
          return (
            <Sequence key={i} from={f} durationInFrames={sectionFrames}>
              <AbsoluteFill>
                {clipUrl ? (
                  <CinematicClip clipUrl={clipUrl} volume={clipVolume} index={i} durationFrames={sectionFrames} />
                ) : <div style={{ position: "absolute", inset: 0, background: BG }} />}
                <Vignette strength={0.45} />
                <FilmGrain opacity={0.07} />
                <Watermark />
              </AbsoluteFill>
            </Sequence>
          );
        }

        // "subtitles" caption style: bold bottom strip, big readable text.
        if (captionStyle === "subtitles") {
          return (
            <Sequence key={i} from={f} durationInFrames={sectionFrames}>
              <AbsoluteFill>
                {clipUrl ? (
                  <CinematicClip clipUrl={clipUrl} volume={clipVolume} index={i} durationFrames={sectionFrames} />
                ) : <div style={{ position: "absolute", inset: 0, background: BG }} />}
                <Vignette strength={0.5} />
                {/* Gradient cap above the subtitle for readability */}
                <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "32%", background: "linear-gradient(to top, rgba(0,0,0,0.92) 30%, transparent 100%)" }} />
                <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "32px 80px 64px" }}>
                  <FadeText
                    text={section.text}
                    size={bodySize}
                    color={TX}
                    weight={700}
                    delay={5}
                    maxW="100%"
                    font={fontFamily}
                    letterSpacing={-0.4}
                    shadow={true}
                  />
                </div>
                <FilmGrain opacity={0.07} />
                <Watermark />
              </AbsoluteFill>
            </Sequence>
          );
        }

        // "overlay" caption style (default): cinematic lower-third with amber rule.
        return (
          <Sequence key={i} from={f} durationInFrames={sectionFrames}>
            <AbsoluteFill>
              {clipUrl ? (
                <CinematicClip clipUrl={clipUrl} volume={clipVolume} index={i} durationFrames={sectionFrames} />
              ) : <div style={{ position: "absolute", inset: 0, background: BG }} />}

              {/* Cinematic gradient — soft top, strong bottom */}
              <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(0,0,0,0.35) 0%, transparent 25%, transparent 55%, rgba(0,0,0,0.85) 100%)" }} />

              <Vignette strength={0.45} />

              {/* Lower-third text block */}
              <AbsoluteFill style={{ display: "flex", flexDirection: "column", justifyContent: "flex-end", padding: "0 80px 100px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 18 }}>
                  <div style={{
                    width: 36,
                    height: 4,
                    background: AMBER,
                    borderRadius: 2,
                    boxShadow: "0 0 14px " + AMBER + ", 0 0 30px " + AMBER + "55",
                  }} />
                  <div style={{
                    fontFamily: "JetBrains Mono",
                    fontSize: Math.max(13, Math.round(labelSize * 0.75)),
                    fontWeight: 700,
                    color: AMBER,
                    letterSpacing: 4,
                    textTransform: "uppercase",
                    textShadow: "0 2px 8px rgba(0,0,0,0.8)",
                  }}>
                    {section.label}
                  </div>
                </div>
                <FadeText
                  text={section.text}
                  size={bodySize}
                  color={TX}
                  weight={800}
                  delay={8}
                  maxW="88%"
                  font={fontFamily}
                  letterSpacing={-0.6}
                  shadow={true}
                  align="left"
                />
              </AbsoluteFill>
              <FilmGrain opacity={0.075} />
              <Watermark />
            </AbsoluteFill>
          </Sequence>
        );
      })}

      {/* ═══ DATA POINTS ═══ Big bold stat cards over a dark canvas. */}
      {dataPoints.length > 0 && (function () {
        f += sectionFrames;
        return (
          <Sequence from={f} durationInFrames={dataFrames}>
            <AbsoluteFill style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 32,
              background: "radial-gradient(circle at 50% 50%, #0E0E18 0%, " + BG + " 70%)",
            }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, marginBottom: 4 }}>
                <GlowRule color={AMBER} width={64} delay={2} />
                <div style={{
                  fontFamily: "JetBrains Mono",
                  fontSize: Math.max(14, Math.round(labelSize * 0.75)),
                  fontWeight: 700,
                  color: AMBER,
                  letterSpacing: 6,
                  textTransform: "uppercase",
                }}>
                  By the numbers
                </div>
              </div>
              <div style={{ display: "flex", gap: 24, flexWrap: "wrap", justifyContent: "center", maxWidth: "92%" }}>
                {dataPoints.slice(0, 3).map(function (dp, di) {
                  var s = spring({ frame: useCurrentFrame() - di * 10, fps: 30, config: { damping: 14 } });
                  return (
                    <div
                      key={di}
                      style={{
                        transform: "scale(" + s + ")",
                        background: "rgba(10,10,20,0.7)",
                        border: "1px solid " + AMBER + "40",
                        borderRadius: 18,
                        padding: "36px 44px",
                        textAlign: "center",
                        boxShadow: "0 24px 60px rgba(0,0,0,0.55), 0 0 0 1px " + AMBER + "10, inset 0 1px 0 rgba(255,255,255,0.04)",
                        backdropFilter: "blur(8px)",
                      }}
                    >
                      <div style={{
                        fontFamily: "JetBrains Mono",
                        fontSize: Math.round(headingSize * 1.55),
                        fontWeight: 900,
                        color: AMBER,
                        letterSpacing: -2,
                        textShadow: "0 0 30px " + AMBER + "66",
                        lineHeight: 1,
                      }}>{dp.value}</div>
                      <div style={{ fontFamily: fontFamily, fontSize: Math.round(labelSize * 0.95), color: TXM, marginTop: 14, letterSpacing: 0.4 }}>{dp.label}</div>
                    </div>
                  );
                })}
              </div>
              <FilmGrain opacity={0.08} />
              <Watermark />
            </AbsoluteFill>
          </Sequence>
        );
      })()}

      {/* ═══ OUTRO ═══ Glowing SA mark, big call. */}
      {(function () {
        f += dataFrames;
        return (
          <Sequence from={f} durationInFrames={outroFrames}>
            <AbsoluteFill style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 22,
              background: "radial-gradient(circle at 50% 40%, #0E0E1A 0%, " + BG + " 70%)",
              position: "relative",
            }}>
              {/* Glowing SA mark */}
              <div style={{
                width: 140,
                height: 140,
                marginBottom: 8,
                background: AMBER,
                borderRadius: 24,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 0 80px " + AMBER + "AA, 0 0 160px " + AMBER + "55, 0 0 0 1px " + AMBER,
                fontFamily: "Outfit, sans-serif",
                fontSize: 72,
                fontWeight: 900,
                color: "#060608",
                letterSpacing: -3,
              }}>SA</div>
              <FadeText text="SemiAnalysis" size={Math.round(headingSize * 1.1)} color={TX} weight={900} delay={6} font={fontFamily} letterSpacing={-1} />
              <GlowRule color={AMBER} width={80} delay={14} />
              <FadeText text="semianalysis.com" size={Math.round(bodySize * 0.65)} color={AMBER} weight={700} delay={20} font={"'JetBrains Mono', monospace"} letterSpacing={3} />
              <FadeText text="youtube.com/@SemianalysisWeekly" size={Math.round(labelSize * 0.7)} color={TXM} weight={500} delay={32} font={"'JetBrains Mono', monospace"} letterSpacing={2} />
              <FilmGrain opacity={0.075} />
            </AbsoluteFill>
          </Sequence>
        );
      })()}

      <ProgressBar />
    </AbsoluteFill>
  );
};
