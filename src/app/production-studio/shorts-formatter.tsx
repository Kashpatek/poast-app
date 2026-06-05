"use client";

// Shorts Formatter — 16:9 source clip → 9:16 vertical for TikTok / Reels /
// Shorts. v1 is center-crop only; smart-crop with face follow is a follow-up
// (the picker exposes it greyed-out so the upgrade path is visible). All
// transcoding happens client-side via @ffmpeg/ffmpeg (single-threaded core
// avoids the COOP/COEP requirement on Vercel).

import React, { useEffect, useRef, useState } from "react";
import { D, ft, gf, mn } from "../shared-constants";
import { showToast } from "../toast-context";

type Preset = "tiktok" | "reels" | "shorts";
type Strategy = "center" | "smart";

interface PresetSpec {
  id: Preset;
  label: string;
  sub: string;
  accent: string;
}

const PRESETS: PresetSpec[] = [
  { id: "tiktok", label: "TikTok", sub: "9:16 · 1080×1920 · 60s target", accent: D.coral },
  { id: "reels", label: "Reels", sub: "9:16 · 1080×1920 · 60s target", accent: D.violet },
  { id: "shorts", label: "Shorts", sub: "9:16 · 1080×1920 · 60s target", accent: D.crimson },
];

export default function ShortsFormatter() {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [preset, setPreset] = useState<Preset>("tiktok");
  const [strategy, setStrategy] = useState<Strategy>("center");
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [outputBlob, setOutputBlob] = useState<Blob | null>(null);
  const [outputUrl, setOutputUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingFFmpeg, setLoadingFFmpeg] = useState(false);

  // Hold the FFmpeg instance across runs so the wasm only loads once.
  const ffmpegRef = useRef<unknown>(null);

  useEffect(function () {
    return function () {
      if (videoUrl) URL.revokeObjectURL(videoUrl);
      if (outputUrl) URL.revokeObjectURL(outputUrl);
    };
  }, [videoUrl, outputUrl]);

  function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith("video/")) {
      setError("Please choose a video file (mp4 recommended).");
      return;
    }
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    if (outputUrl) URL.revokeObjectURL(outputUrl);
    setVideoFile(f);
    setVideoUrl(URL.createObjectURL(f));
    setOutputBlob(null);
    setOutputUrl(null);
    setError(null);
    setProgress(0);
  }

  async function ensureFFmpeg() {
    if (ffmpegRef.current) return ffmpegRef.current as { run: (file: File) => Promise<Blob> };
    setLoadingFFmpeg(true);
    try {
      const { FFmpeg } = await import("@ffmpeg/ffmpeg");
      const { toBlobURL, fetchFile } = await import("@ffmpeg/util");
      const ffmpeg = new FFmpeg();
      ffmpeg.on("progress", function (p: { progress: number }) {
        const pct = Math.max(0, Math.min(1, p.progress)) * 100;
        setProgress(pct);
      });
      await ffmpeg.load({
        coreURL: await toBlobURL("https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.js", "text/javascript"),
        wasmURL: await toBlobURL("https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.wasm", "application/wasm"),
      });
      const wrapped = {
        async run(file: File): Promise<Blob> {
          await ffmpeg.writeFile("input.mp4", await fetchFile(file));
          await ffmpeg.exec([
            "-i",
            "input.mp4",
            "-vf",
            "crop=ih*9/16:ih,scale=1080:1920",
            "-c:a",
            "copy",
            "output.mp4",
          ]);
          const data = (await ffmpeg.readFile("output.mp4")) as Uint8Array;
          // Copy into a fresh ArrayBuffer to detach from wasm memory.
          const copy = new Uint8Array(data.byteLength);
          copy.set(data);
          return new Blob([copy.buffer], { type: "video/mp4" });
        },
      };
      ffmpegRef.current = wrapped;
      return wrapped;
    } finally {
      setLoadingFFmpeg(false);
    }
  }

  async function runReframe() {
    if (!videoFile) return;
    setProcessing(true);
    setError(null);
    setProgress(0);
    setOutputBlob(null);
    if (outputUrl) {
      URL.revokeObjectURL(outputUrl);
      setOutputUrl(null);
    }
    try {
      const ff = await ensureFFmpeg();
      const blob = await ff.run(videoFile);
      const url = URL.createObjectURL(blob);
      setOutputBlob(blob);
      setOutputUrl(url);
      setProgress(100);
      showToast(`Reframed for ${PRESETS.find((p) => p.id === preset)?.label}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setProcessing(false);
    }
  }

  function downloadOutput() {
    if (!outputBlob || !outputUrl) return;
    const a = document.createElement("a");
    const base = videoFile?.name.replace(/\.[^.]+$/, "") || "clip";
    a.href = outputUrl;
    a.download = `${base}-${preset}-9x16.mp4`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  const canReframe = !!videoFile && !processing && !loadingFFmpeg;

  return (
    <div style={{ maxWidth: 1180, margin: "0 auto", padding: "40px 32px 64px" }}>
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          padding: "4px 10px",
          borderRadius: 999,
          background: "rgba(144,92,203,0.10)",
          border: `1px solid ${D.violet}55`,
          marginBottom: 14,
        }}
      >
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: D.violet, boxShadow: `0 0 8px ${D.violet}` }} />
        <span style={{ fontFamily: mn, fontSize: 10, letterSpacing: 1.4, color: D.violet, textTransform: "uppercase" }}>
          Production Studio
        </span>
      </div>
      <h1
        style={{
          fontFamily: gf,
          fontSize: 38,
          fontWeight: 900,
          letterSpacing: -1,
          margin: 0,
          marginBottom: 8,
          color: D.tx,
        }}
      >
        Shorts Formatter
      </h1>
      <div style={{ fontFamily: ft, fontSize: 15, color: D.txm, maxWidth: 720, lineHeight: 1.5, marginBottom: 28 }}>
        Drop a 16:9 clip, pick the destination feed. We reframe to 9:16 (1080×1920) entirely in your browser — no upload, no queue.
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.1fr) minmax(0, 1fr)", gap: 24 }}>
        {/* LEFT: Input + controls */}
        <div>
          <div style={lbl}>Source clip</div>
          <label
            htmlFor="shorts-formatter-file"
            style={{
              display: "block",
              background: D.surface,
              border: `1px dashed ${videoFile ? D.violet + "88" : D.border}`,
              borderRadius: 10,
              padding: "18px 16px",
              cursor: "pointer",
              fontFamily: mn,
              fontSize: 12,
              color: videoFile ? D.tx : D.txm,
              letterSpacing: 0.4,
              textAlign: "center",
            }}
          >
            {videoFile ? `${videoFile.name} · ${(videoFile.size / (1024 * 1024)).toFixed(1)} MB` : "Click to choose an MP4"}
            <input
              id="shorts-formatter-file"
              type="file"
              accept="video/*"
              onChange={onPickFile}
              style={{ display: "none" }}
            />
          </label>

          {videoUrl ? (
            <div style={{ marginTop: 14, background: "#000", borderRadius: 10, overflow: "hidden", border: `1px solid ${D.border}` }}>
              <video src={videoUrl} controls style={{ width: "100%", display: "block", maxHeight: 360 }} />
            </div>
          ) : null}

          <div style={{ marginTop: 22 }}>
            <div style={lbl}>Crop strategy</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <StrategyRow
                id="center"
                label="Center crop"
                sub="Take the middle 9:16 column of the frame."
                selected={strategy === "center"}
                onSelect={() => setStrategy("center")}
              />
              <StrategyRow
                id="smart"
                label="Smart crop (face follow)"
                sub="Re-target the crop window to the active speaker each cut."
                selected={false}
                disabled
                placeholder
                onSelect={() => {}}
              />
            </div>
          </div>

          <div style={{ marginTop: 22 }}>
            <div style={lbl}>Output preset</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
              {PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPreset(p.id)}
                  style={{
                    textAlign: "left",
                    background: preset === p.id ? `${p.accent}1c` : D.surface,
                    border: `1px solid ${preset === p.id ? p.accent : D.border}`,
                    color: D.tx,
                    borderRadius: 10,
                    padding: "12px 12px 11px",
                    cursor: "pointer",
                    fontFamily: ft,
                  }}
                >
                  <div style={{ fontFamily: gf, fontSize: 15, color: D.tx, marginBottom: 2 }}>{p.label}</div>
                  <div style={{ fontFamily: mn, fontSize: 10, color: D.txm, letterSpacing: 0.4 }}>{p.sub}</div>
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginTop: 24, display: "flex", alignItems: "center", gap: 12 }}>
            <button
              type="button"
              onClick={runReframe}
              disabled={!canReframe}
              style={{
                background: D.violet,
                color: "#06060A",
                border: "none",
                padding: "12px 22px",
                borderRadius: 8,
                fontFamily: ft,
                fontSize: 13,
                fontWeight: 800,
                cursor: canReframe ? "pointer" : "not-allowed",
                opacity: canReframe ? 1 : 0.5,
                minWidth: 180,
              }}
            >
              {loadingFFmpeg ? "Loading FFmpeg…" : processing ? "Reframing…" : "Reframe"}
            </button>
            {processing || progress > 0 ? (
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ height: 8, background: D.surface, borderRadius: 999, overflow: "hidden", border: `1px solid ${D.border}` }}>
                  <div
                    style={{
                      width: `${Math.min(100, progress)}%`,
                      height: "100%",
                      background: `linear-gradient(90deg, ${D.violet}, ${D.cyan})`,
                      transition: "width 120ms linear",
                    }}
                  />
                </div>
                <div style={{ fontFamily: mn, fontSize: 10, color: D.txd, marginTop: 6, letterSpacing: 0.4 }}>
                  {Math.round(progress)}% · transcoding locally
                </div>
              </div>
            ) : null}
          </div>

          {error ? <div style={errorBox}>{error}</div> : null}
        </div>

        {/* RIGHT: Output preview */}
        <div>
          <div style={lbl}>9:16 output</div>
          <div
            style={{
              background: D.surface,
              border: `1px solid ${D.border}`,
              borderRadius: 10,
              padding: 14,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 14,
            }}
          >
            <div
              style={{
                aspectRatio: "9 / 16",
                width: "min(100%, 260px)",
                background: "#000",
                borderRadius: 12,
                overflow: "hidden",
                border: `1px solid ${D.border}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {outputUrl ? (
                <video src={outputUrl} controls style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                <div style={{ fontFamily: mn, fontSize: 11, color: D.txd, letterSpacing: 0.4, textAlign: "center", padding: 20 }}>
                  {processing ? "Working…" : "Output preview appears here after Reframe."}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={downloadOutput}
              disabled={!outputUrl}
              style={{
                background: outputUrl ? D.teal : "transparent",
                color: outputUrl ? "#06060A" : D.txd,
                border: `1px solid ${outputUrl ? D.teal : D.border}`,
                padding: "9px 18px",
                borderRadius: 8,
                fontFamily: mn,
                fontSize: 11,
                fontWeight: 700,
                cursor: outputUrl ? "pointer" : "not-allowed",
                letterSpacing: 0.6,
              }}
            >
              Download 9:16 MP4
            </button>
          </div>
          <div style={{ fontFamily: mn, fontSize: 10, color: D.txd, marginTop: 10, letterSpacing: 0.4, lineHeight: 1.5 }}>
            v1 uses center crop and copies the audio stream. Trim, smart-crop, and per-platform aspect tweaks land in a follow-up.
          </div>
        </div>
      </div>
    </div>
  );
}

function StrategyRow({
  label,
  sub,
  selected,
  onSelect,
  disabled,
  placeholder,
}: {
  id: Strategy;
  label: string;
  sub: string;
  selected: boolean;
  onSelect: () => void;
  disabled?: boolean;
  placeholder?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 12,
        textAlign: "left",
        background: selected ? `${D.violet}14` : D.surface,
        border: `1px solid ${selected ? D.violet : D.border}`,
        borderRadius: 10,
        padding: "12px 14px",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.55 : 1,
        fontFamily: ft,
        color: D.tx,
      }}
    >
      <span
        aria-hidden
        style={{
          marginTop: 3,
          width: 14,
          height: 14,
          borderRadius: "50%",
          border: `1px solid ${selected ? D.violet : D.txd}`,
          background: selected ? D.violet : "transparent",
          flex: "0 0 auto",
        }}
      />
      <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
        <span style={{ fontFamily: gf, fontSize: 14, color: D.tx, display: "flex", alignItems: "center", gap: 8 }}>
          {label}
          {placeholder ? (
            <span
              style={{
                fontFamily: mn,
                fontSize: 9,
                letterSpacing: 0.8,
                padding: "2px 6px",
                borderRadius: 4,
                background: "rgba(255,255,255,0.06)",
                color: D.txd,
                border: `1px solid ${D.border}`,
                textTransform: "uppercase",
              }}
            >
              Placeholder
            </span>
          ) : null}
        </span>
        <span style={{ fontFamily: mn, fontSize: 11, color: D.txm, letterSpacing: 0.3 }}>{sub}</span>
      </span>
    </button>
  );
}

const lbl: React.CSSProperties = {
  fontFamily: mn,
  fontSize: 10,
  letterSpacing: 1.2,
  textTransform: "uppercase",
  color: D.txm,
  marginBottom: 6,
};

const errorBox: React.CSSProperties = {
  background: "rgba(209,51,74,0.08)",
  border: `1px solid ${D.crimson}55`,
  borderRadius: 8,
  padding: "10px 14px",
  fontFamily: mn,
  fontSize: 12,
  color: D.crimson,
  marginTop: 16,
};
