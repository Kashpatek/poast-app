"use client";

// Auto-Caption Renderer — upload video + transcript JSON (or plain
// text), preview SA-branded burned captions via Remotion Player, then
// export an MP4 via FFmpeg.wasm with the captions hard-burned through
// the `subtitles` filter. v1 falls back to letting the user download
// the SRT side-car if the wasm encode fails (memory caps on long clips).

import React, { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { AbsoluteFill, OffthreadVideo, useCurrentFrame, useVideoConfig } from "remotion";
import { D, ft, mn, uid } from "../shared-constants";
import { useStore } from "../lib/store";
import { showToast } from "../toast-context";
import { SendToChip } from "../components/send-to-chip";

// Player + ffmpeg are heavy; lazy-load no-SSR.
const Player = dynamic(
  () => import("@remotion/player").then((m) => m.Player as unknown as React.ComponentType<Record<string, unknown>>),
  { ssr: false }
) as unknown as React.ComponentType<Record<string, unknown>>;

// ─── Types ──────────────────────────────────────────────────────────────

interface Cue {
  start: number; // seconds
  end: number;   // seconds
  text: string;
}

type CaptionFont = "outfit" | "mono" | "grift";
type CaptionPosition = "bottom" | "middle" | "top";
type CaptionSize = "small" | "medium" | "large";
type CaptionBackground = "none" | "box" | "blur";
type CaptionColor = "amber" | "white" | "custom";

interface CaptionStyle {
  font: CaptionFont;
  color: CaptionColor;
  customColor: string;
  position: CaptionPosition;
  size: CaptionSize;
  background: CaptionBackground;
}

const DEFAULT_STYLE: CaptionStyle = {
  font: "outfit",
  color: "amber",
  customColor: "#F7B041",
  position: "bottom",
  size: "medium",
  background: "box",
};

const FONT_STACK: Record<CaptionFont, string> = {
  outfit: "'Outfit', sans-serif",
  mono: "'JetBrains Mono', monospace",
  grift: "'Grift', 'Outfit', sans-serif",
};

const SIZE_SCALE: Record<CaptionSize, number> = {
  small: 0.038,
  medium: 0.055,
  large: 0.075,
};

// ─── Parsing ────────────────────────────────────────────────────────────

function colorOf(style: CaptionStyle): string {
  if (style.color === "amber") return D.amber;
  if (style.color === "white") return D.tx;
  return style.customColor || D.amber;
}

// Parse transcript input — supports JSON array of {start, end, text} or
// plain text (one cue per non-empty line, 2s windows starting at 0).
function parseTranscript(raw: string): { cues: Cue[]; mode: "json" | "auto" | "empty"; error?: string } {
  const trimmed = (raw || "").trim();
  if (!trimmed) return { cues: [], mode: "empty" };

  if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed);
      const arr = Array.isArray(parsed) ? parsed : (Array.isArray(parsed.cues) ? parsed.cues : []);
      const cues: Cue[] = [];
      for (const c of arr) {
        const start = Number(c?.start ?? c?.from ?? c?.t);
        const end = Number(c?.end ?? c?.to ?? (Number(start) + 2));
        const text = String(c?.text ?? c?.caption ?? "").trim();
        if (!Number.isFinite(start) || !Number.isFinite(end) || !text) continue;
        cues.push({ start, end, text });
      }
      cues.sort((a, b) => a.start - b.start);
      return { cues, mode: "json" };
    } catch (e) {
      return { cues: [], mode: "json", error: "Invalid JSON: " + String((e as Error).message || e) };
    }
  }

  // Plain text fallback — 2s windows per line.
  const lines = trimmed.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const cues: Cue[] = lines.map((text, i) => ({ start: i * 2, end: i * 2 + 2, text }));
  return { cues, mode: "auto" };
}

function fmtTime(s: number): string {
  const ms = Math.round((s - Math.floor(s)) * 1000);
  const total = Math.floor(s);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const sec = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")},${String(ms).padStart(3, "0")}`;
}

function cuesToSrt(cues: Cue[]): string {
  return cues
    .map((c, i) => `${i + 1}\n${fmtTime(c.start)} --> ${fmtTime(c.end)}\n${c.text}\n`)
    .join("\n");
}

// ─── Remotion composition ──────────────────────────────────────────────

interface CaptionVideoProps {
  videoUrl: string;
  cues: Cue[];
  style: CaptionStyle;
  fps: number;
}

const CaptionVideoComp: React.FC<CaptionVideoProps> = ({ videoUrl, cues, style, fps }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const t = frame / fps;
  const active = cues.find((c) => t >= c.start && t < c.end);

  const fontSize = Math.round(Math.min(width, height) * SIZE_SCALE[style.size]);
  const color = colorOf(style);
  const fontFamily = FONT_STACK[style.font];

  const posStyle: React.CSSProperties = {
    position: "absolute",
    left: "8%",
    right: "8%",
    textAlign: "center",
    fontFamily,
    fontSize,
    fontWeight: style.font === "mono" ? 600 : 800,
    color,
    lineHeight: 1.25,
    letterSpacing: style.font === "mono" ? 0 : -0.4,
    textShadow: style.background === "none" ? "0 2px 8px rgba(0,0,0,0.85), 0 0 12px rgba(0,0,0,0.7)" : "none",
  };

  if (style.position === "bottom") {
    posStyle.bottom = "9%";
  } else if (style.position === "top") {
    posStyle.top = "9%";
  } else {
    posStyle.top = "50%";
    posStyle.transform = "translateY(-50%)";
  }

  const innerWrap: React.CSSProperties = {
    display: "inline-block",
    padding: style.background === "none" ? 0 : "10px 18px",
    borderRadius: 8,
    background:
      style.background === "box"
        ? "rgba(6,6,12,0.72)"
        : style.background === "blur"
        ? "rgba(6,6,12,0.35)"
        : "transparent",
    backdropFilter: style.background === "blur" ? "blur(8px)" : undefined,
    WebkitBackdropFilter: style.background === "blur" ? "blur(8px)" : undefined,
    boxShadow: style.background === "box" ? "0 4px 18px rgba(0,0,0,0.5)" : "none",
  };

  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <OffthreadVideo src={videoUrl} muted={false} />
      {active ? (
        <div style={posStyle}>
          <span style={innerWrap}>{active.text}</span>
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

// ─── Main component ───────────────────────────────────────────────────

export default function AutoCaption() {
  const pushOutput = useStore((s) => s.pushOutput);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoMeta, setVideoMeta] = useState<{ width: number; height: number; duration: number } | null>(null);
  const [transcript, setTranscript] = useState("");
  const [style, setStyle] = useState<CaptionStyle>(DEFAULT_STYLE);
  const [renderProgress, setRenderProgress] = useState<number | null>(null);
  const [outputUrl, setOutputUrl] = useState<string | null>(null);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [rendering, setRendering] = useState(false);
  const ffmpegRef = useRef<unknown | null>(null);
  const objectUrls = useRef<string[]>([]);

  const parsed = useMemo(() => parseTranscript(transcript), [transcript]);
  const cues = parsed.cues;

  // Clean up object URLs on unmount.
  useEffect(() => () => {
    objectUrls.current.forEach((u) => {
      try { URL.revokeObjectURL(u); } catch { /* ignore */ }
    });
  }, []);

  function onVideoPick(file: File | null) {
    if (!file) return;
    if (videoUrl) {
      try { URL.revokeObjectURL(videoUrl); } catch { /* ignore */ }
    }
    const url = URL.createObjectURL(file);
    objectUrls.current.push(url);
    setVideoFile(file);
    setVideoUrl(url);
    setOutputUrl(null);
    setRenderError(null);

    // Probe dimensions + duration via a transient <video>.
    const probe = document.createElement("video");
    probe.preload = "metadata";
    probe.muted = true;
    probe.src = url;
    probe.onloadedmetadata = () => {
      const w = probe.videoWidth || 1920;
      const h = probe.videoHeight || 1080;
      const d = Number.isFinite(probe.duration) ? probe.duration : 60;
      setVideoMeta({ width: w, height: h, duration: d });
    };
  }

  const playerDims = useMemo(() => {
    if (!videoMeta) return { width: 1920, height: 1080, durationInFrames: 1800, fps: 30 };
    const fps = 30;
    return {
      width: videoMeta.width,
      height: videoMeta.height,
      fps,
      durationInFrames: Math.max(30, Math.ceil(videoMeta.duration * fps)),
    };
  }, [videoMeta]);

  async function loadFfmpeg(): Promise<{ ff: unknown; util: { fetchFile: (f: File | string) => Promise<Uint8Array>; toBlobURL: (u: string, m: string) => Promise<string> } } | null> {
    if (ffmpegRef.current) {
      // util is dynamic-imported each call; cheap.
      const util = await import("@ffmpeg/util");
      return { ff: ffmpegRef.current, util: { fetchFile: util.fetchFile, toBlobURL: util.toBlobURL } };
    }
    try {
      const mod = await import("@ffmpeg/ffmpeg");
      const util = await import("@ffmpeg/util");
      const ff = new mod.FFmpeg();
      // Single-threaded core — no SharedArrayBuffer requirement.
      await ff.load({
        coreURL: await util.toBlobURL("https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.js", "text/javascript"),
        wasmURL: await util.toBlobURL("https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.wasm", "application/wasm"),
      });
      ffmpegRef.current = ff;
      return { ff, util: { fetchFile: util.fetchFile, toBlobURL: util.toBlobURL } };
    } catch (e) {
      setRenderError("Failed to load FFmpeg.wasm: " + String((e as Error).message || e));
      return null;
    }
  }

  async function renderMp4() {
    if (!videoFile || cues.length === 0) return;
    setRendering(true);
    setRenderProgress(0);
    setRenderError(null);
    setOutputUrl(null);

    const bundle = await loadFfmpeg();
    if (!bundle) { setRendering(false); setRenderProgress(null); return; }
    const { ff, util } = bundle;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ffmpeg = ff as any;

    const onProgress = (p: { progress: number }) => {
      const v = Math.max(0, Math.min(1, Number(p?.progress) || 0));
      setRenderProgress(v);
    };
    try { ffmpeg.on("progress", onProgress); } catch { /* older builds */ }

    try {
      const inputName = "input.mp4";
      const srtName = "captions.srt";
      const outputName = "output.mp4";
      await ffmpeg.writeFile(inputName, await util.fetchFile(videoFile));
      await ffmpeg.writeFile(srtName, new TextEncoder().encode(cuesToSrt(cues)));

      // SubStation-style force_style override gives us color, font size,
      // and box background without needing a separate .ass file.
      const color = colorOf(style);
      // ASS color order is &HBBGGRR — convert from #RRGGBB.
      const hex = color.replace("#", "");
      const r = hex.slice(0, 2), g = hex.slice(2, 4), b = hex.slice(4, 6);
      const assColor = `&H00${b}${g}${r}`.toUpperCase();
      const fontSize = style.size === "small" ? 28 : style.size === "large" ? 56 : 40;
      // Alignment: 2 = bottom-center, 5 = middle-center, 8 = top-center.
      const alignment = style.position === "top" ? 8 : style.position === "middle" ? 5 : 2;
      const borderStyle = style.background === "box" ? 3 : 1;
      const fontName =
        style.font === "mono" ? "JetBrains Mono" : style.font === "grift" ? "Grift" : "Outfit";
      const force = [
        `FontName=${fontName}`,
        `FontSize=${fontSize}`,
        `PrimaryColour=${assColor}`,
        `OutlineColour=&H80000000`,
        `BackColour=&H80000000`,
        `BorderStyle=${borderStyle}`,
        `Outline=2`,
        `Shadow=1`,
        `Alignment=${alignment}`,
        `MarginV=60`,
      ].join(",");

      await ffmpeg.exec([
        "-i", inputName,
        "-vf", `subtitles=${srtName}:force_style='${force}'`,
        "-c:a", "copy",
        "-preset", "ultrafast",
        outputName,
      ]);

      const data = await ffmpeg.readFile(outputName);
      const blob = new Blob([data as BlobPart], { type: "video/mp4" });
      const url = URL.createObjectURL(blob);
      objectUrls.current.push(url);
      setOutputUrl(url);
      setRenderProgress(1);
      showToast("Captioned MP4 ready");

      pushOutput({
        sourceTool: "auto-caption",
        kind: "other",
        payload: { cues, style, filename: (videoFile.name || "video") + ".captioned.mp4" },
        preview: `${cues.length} cues burned · ${(blob.size / (1024 * 1024)).toFixed(1)}MB MP4`,
      });
    } catch (e) {
      setRenderError("Render failed: " + String((e as Error).message || e) + ". Try the SRT side-car as a fallback.");
    } finally {
      try { ffmpeg.off("progress", onProgress); } catch { /* ignore */ }
      setRendering(false);
    }
  }

  function downloadSrt() {
    if (cues.length === 0) return;
    const blob = new Blob([cuesToSrt(cues)], { type: "application/x-subrip" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = (videoFile?.name?.replace(/\.[^.]+$/, "") || "captions") + ".srt";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast("SRT downloaded");
  }

  function fillExample() {
    if (!videoMeta) return;
    const d = videoMeta.duration;
    const exemplar: Cue[] = [
      { start: 0, end: Math.min(2.5, d * 0.1), text: "Welcome to SemiAnalysis." },
      { start: Math.min(2.5, d * 0.1), end: Math.min(5, d * 0.2), text: "Today we go deeper on the chip supply chain." },
      { start: Math.min(5, d * 0.2), end: Math.min(8, d * 0.35), text: "Let's start with what TSMC's roadmap actually says." },
    ];
    setTranscript(JSON.stringify(exemplar, null, 2));
  }

  const styleSummary = `${style.font} · ${style.color === "custom" ? style.customColor : style.color} · ${style.position} · ${style.size} · ${style.background}`;

  return (
    <div style={{ padding: "28px 24px 64px", maxWidth: 1380, margin: "0 auto", fontFamily: ft, color: D.tx }}>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(340px, 380px) 1fr", gap: 24, alignItems: "start" }}>
        {/* Controls */}
        <aside style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <section style={panel}>
            <div style={lbl}>1 · Source video</div>
            <input
              type="file"
              accept="video/mp4,video/quicktime,video/webm"
              onChange={(e) => onVideoPick(e.target.files?.[0] || null)}
              style={{ fontFamily: mn, fontSize: 11, color: D.txm }}
            />
            {videoFile && videoMeta ? (
              <div style={metaRow}>
                <span style={metaKey}>{videoFile.name}</span>
                <span style={metaVal}>
                  {videoMeta.width}×{videoMeta.height} · {videoMeta.duration.toFixed(1)}s · {(videoFile.size / (1024 * 1024)).toFixed(1)}MB
                </span>
              </div>
            ) : null}
          </section>

          <section style={panel}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
              <div style={lbl}>2 · Transcript</div>
              <button onClick={fillExample} disabled={!videoMeta} style={smallBtn}>
                Insert example
              </button>
            </div>
            <textarea
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              placeholder={`Paste JSON: [{"start":0,"end":2,"text":"Hello"}]\nOr plain text (one line per cue, 2s window each).`}
              style={{ ...inputStyle, minHeight: 200, fontFamily: mn, fontSize: 12, resize: "vertical" }}
            />
            <div style={metaRow}>
              <span style={metaKey}>
                {parsed.mode === "json" ? "JSON" : parsed.mode === "auto" ? "Auto-timed" : "Empty"}
              </span>
              <span style={metaVal}>{cues.length} cue{cues.length === 1 ? "" : "s"}</span>
            </div>
            {parsed.error ? <div style={errorBox}>{parsed.error}</div> : null}
          </section>

          <section style={panel}>
            <div style={lbl}>3 · Style</div>
            <Field label="Font">
              <SegmentedRow
                value={style.font}
                onChange={(v) => setStyle({ ...style, font: v as CaptionFont })}
                opts={[{ v: "outfit", l: "Outfit" }, { v: "mono", l: "JetBrains" }, { v: "grift", l: "Grift" }]}
              />
            </Field>
            <Field label="Color">
              <SegmentedRow
                value={style.color}
                onChange={(v) => setStyle({ ...style, color: v as CaptionColor })}
                opts={[{ v: "amber", l: "Amber" }, { v: "white", l: "White" }, { v: "custom", l: "Custom" }]}
              />
              {style.color === "custom" ? (
                <input
                  type="color"
                  value={style.customColor}
                  onChange={(e) => setStyle({ ...style, customColor: e.target.value })}
                  style={{ marginTop: 8, width: 56, height: 28, background: "transparent", border: `1px solid ${D.border}`, borderRadius: 4 }}
                />
              ) : null}
            </Field>
            <Field label="Position">
              <SegmentedRow
                value={style.position}
                onChange={(v) => setStyle({ ...style, position: v as CaptionPosition })}
                opts={[{ v: "bottom", l: "Bottom" }, { v: "middle", l: "Middle" }, { v: "top", l: "Top" }]}
              />
            </Field>
            <Field label="Size">
              <SegmentedRow
                value={style.size}
                onChange={(v) => setStyle({ ...style, size: v as CaptionSize })}
                opts={[{ v: "small", l: "S" }, { v: "medium", l: "M" }, { v: "large", l: "L" }]}
              />
            </Field>
            <Field label="Background">
              <SegmentedRow
                value={style.background}
                onChange={(v) => setStyle({ ...style, background: v as CaptionBackground })}
                opts={[{ v: "none", l: "None" }, { v: "box", l: "Box" }, { v: "blur", l: "Blur" }]}
              />
            </Field>
            <div style={{ ...metaVal, marginTop: 6 }}>{styleSummary}</div>
          </section>

          <section style={panel}>
            <div style={lbl}>4 · Export</div>
            <button
              onClick={renderMp4}
              disabled={rendering || !videoFile || cues.length === 0}
              style={{
                ...primaryBtn,
                opacity: rendering || !videoFile || cues.length === 0 ? 0.5 : 1,
                cursor: rendering || !videoFile || cues.length === 0 ? "not-allowed" : "pointer",
              }}
            >
              {rendering ? `Rendering… ${Math.round((renderProgress || 0) * 100)}%` : "Render MP4"}
            </button>
            <button onClick={downloadSrt} disabled={cues.length === 0} style={secondaryBtn}>
              Download .srt side-car
            </button>
            {renderProgress !== null && rendering ? (
              <div style={{ height: 4, background: D.border, borderRadius: 2, overflow: "hidden", marginTop: 4 }}>
                <div style={{ height: "100%", width: `${(renderProgress || 0) * 100}%`, background: D.amber, transition: "width 120ms linear" }} />
              </div>
            ) : null}
            {renderError ? <div style={errorBox}>{renderError}</div> : null}
            {outputUrl ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 4 }}>
                <a
                  href={outputUrl}
                  download={(videoFile?.name?.replace(/\.[^.]+$/, "") || "video") + ".captioned.mp4"}
                  style={{
                    fontFamily: mn,
                    fontSize: 11,
                    color: D.amber,
                    textDecoration: "underline",
                    letterSpacing: 0.6,
                  }}
                >
                  Download captioned MP4 →
                </a>
                <SendToChip
                  text={`Captioned MP4 · ${cues.length} cues · ${styleSummary}`}
                  sourceTool="auto-caption"
                  kind="other"
                />
              </div>
            ) : null}
            <div style={{ ...metaVal, marginTop: 8, lineHeight: 1.5 }}>
              FFmpeg.wasm encodes single-threaded in your browser. Long videos may exceed memory — fall back to the SRT side-car and burn server-side.
            </div>
          </section>
        </aside>

        {/* Preview */}
        <main style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={lbl}>Preview</div>
          <div
            style={{
              background: "#000",
              borderRadius: 10,
              overflow: "hidden",
              border: `1px solid ${D.border}`,
              aspectRatio: videoMeta ? `${videoMeta.width} / ${videoMeta.height}` : "16 / 9",
              minHeight: 280,
            }}
          >
            {videoUrl ? (
              <Player
                key={`${videoUrl}-${playerDims.width}x${playerDims.height}-${playerDims.durationInFrames}`}
                component={CaptionVideoComp as unknown as React.ComponentType<Record<string, unknown>>}
                durationInFrames={playerDims.durationInFrames}
                fps={playerDims.fps}
                compositionWidth={playerDims.width}
                compositionHeight={playerDims.height}
                inputProps={{ videoUrl, cues, style, fps: playerDims.fps }}
                controls
                loop={false}
                style={{ width: "100%", height: "100%" }}
              />
            ) : (
              <div
                style={{
                  width: "100%",
                  height: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontFamily: mn,
                  fontSize: 12,
                  color: D.txd,
                  letterSpacing: 0.6,
                }}
              >
                Upload a video to preview →
              </div>
            )}
          </div>

          {cues.length > 0 ? (
            <div style={{ ...panel, padding: "12px 14px" }}>
              <div style={lbl}>Cue list</div>
              <div style={{ maxHeight: 220, overflowY: "auto", display: "flex", flexDirection: "column", gap: 2 }}>
                {cues.slice(0, 200).map((c, i) => (
                  <div key={`${c.start}-${i}-${uid("cue")}`} style={cueRow}>
                    <span style={{ color: D.amber, fontFamily: mn, fontSize: 11, width: 88, flexShrink: 0 }}>
                      {fmtTime(c.start).slice(3, 11)}
                    </span>
                    <span style={{ fontFamily: ft, fontSize: 13, color: D.tx }}>{c.text}</span>
                  </div>
                ))}
                {cues.length > 200 ? (
                  <div style={{ ...metaVal, marginTop: 6 }}>… {cues.length - 200} more</div>
                ) : null}
              </div>
            </div>
          ) : null}
        </main>
      </div>
    </div>
  );
}

// ─── Sub-components / styles ──────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ ...metaKey, marginBottom: 6 }}>{label}</div>
      {children}
    </div>
  );
}

function SegmentedRow<T extends string>({ value, onChange, opts }: { value: T; onChange: (v: T) => void; opts: { v: T; l: string }[] }) {
  return (
    <div style={{ display: "flex", gap: 4, background: D.surface, padding: 3, border: `1px solid ${D.border}`, borderRadius: 8 }}>
      {opts.map((o) => {
        const active = o.v === value;
        return (
          <button
            key={o.v}
            type="button"
            onClick={() => onChange(o.v)}
            style={{
              flex: 1,
              padding: "6px 10px",
              borderRadius: 5,
              border: "none",
              background: active ? D.amber : "transparent",
              color: active ? "#06060A" : D.txm,
              fontFamily: mn,
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: 0.6,
              textTransform: "uppercase",
              cursor: "pointer",
              transition: "background 120ms",
            }}
          >
            {o.l}
          </button>
        );
      })}
    </div>
  );
}

const panel: React.CSSProperties = {
  background: D.card,
  border: `1px solid ${D.border}`,
  borderRadius: 10,
  padding: "14px 16px",
  display: "flex",
  flexDirection: "column",
  gap: 8,
};

const lbl: React.CSSProperties = {
  fontFamily: mn,
  fontSize: 10,
  letterSpacing: 1.4,
  textTransform: "uppercase",
  color: D.txm,
};

const metaKey: React.CSSProperties = {
  fontFamily: mn,
  fontSize: 10,
  letterSpacing: 1.2,
  textTransform: "uppercase",
  color: D.txd,
};

const metaVal: React.CSSProperties = {
  fontFamily: mn,
  fontSize: 10,
  letterSpacing: 0.4,
  color: D.txm,
};

const metaRow: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 8,
  marginTop: 4,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: D.surface,
  border: `1px solid ${D.border}`,
  borderRadius: 8,
  color: D.tx,
  fontFamily: ft,
  fontSize: 13,
  padding: "10px 12px",
  outline: "none",
  boxSizing: "border-box",
};

const primaryBtn: React.CSSProperties = {
  background: D.amber,
  color: "#060608",
  border: "none",
  padding: "11px 18px",
  borderRadius: 8,
  fontFamily: ft,
  fontSize: 13,
  fontWeight: 800,
};

const secondaryBtn: React.CSSProperties = {
  background: "transparent",
  color: D.tx,
  border: `1px solid ${D.border}`,
  padding: "9px 14px",
  borderRadius: 8,
  fontFamily: mn,
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: 0.6,
  cursor: "pointer",
};

const smallBtn: React.CSSProperties = {
  background: "transparent",
  color: D.txm,
  border: `1px solid ${D.border}`,
  padding: "4px 8px",
  borderRadius: 5,
  fontFamily: mn,
  fontSize: 10,
  letterSpacing: 0.5,
  cursor: "pointer",
};

const errorBox: React.CSSProperties = {
  background: "rgba(209,51,74,0.08)",
  border: `1px solid ${D.crimson}55`,
  borderRadius: 8,
  padding: "8px 12px",
  fontFamily: mn,
  fontSize: 11,
  color: D.crimson,
  marginTop: 6,
};

const cueRow: React.CSSProperties = {
  display: "flex",
  alignItems: "baseline",
  gap: 12,
  padding: "4px 6px",
  borderBottom: `1px solid ${D.border}`,
};
