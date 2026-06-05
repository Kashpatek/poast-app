"use client";

// Audio Editor — browser-side podcast audio surgery. Drop or pick an
// mp3/wav/m4a, scrub the waveform, drag-select a region, and run
// trim / cut / fade / normalize via FFmpeg.wasm. FFmpeg loads lazily on
// the first edit (single-threaded core so we don't need COOP/COEP).

import React, { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { D, ft, gf, mn } from "../shared-constants";
import { showToast } from "../toast-context";

// Wavesurfer is purely client-side and inspects `window` at import time.
// Dynamic import keeps the editor SSR-safe.
const WaveformPanel = dynamic(() => import("./audio-editor-waveform"), {
  ssr: false,
  loading: () => (
    <div style={{ padding: 32, color: D.txm, fontFamily: mn, fontSize: 12 }}>Loading waveform…</div>
  ),
});

export interface AudioEditorState {
  fileName: string;
  fileMime: string;
  blob: Blob;
}

function formatTime(s: number): string {
  if (!isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60);
  const sec = s - m * 60;
  return `${String(m).padStart(2, "0")}:${sec.toFixed(2).padStart(5, "0")}`;
}

function inferMime(name: string, fallback: string): string {
  const n = name.toLowerCase();
  if (n.endsWith(".mp3")) return "audio/mpeg";
  if (n.endsWith(".wav")) return "audio/wav";
  if (n.endsWith(".m4a")) return "audio/mp4";
  if (n.endsWith(".aac")) return "audio/aac";
  if (n.endsWith(".ogg")) return "audio/ogg";
  return fallback || "audio/mpeg";
}

function inferExt(mime: string, name: string): string {
  const n = (name || "").toLowerCase();
  const dot = n.lastIndexOf(".");
  if (dot >= 0) return n.slice(dot + 1);
  if (mime.includes("wav")) return "wav";
  if (mime.includes("mp4")) return "m4a";
  if (mime.includes("ogg")) return "ogg";
  return "mp3";
}

export default function AudioEditor() {
  const [audio, setAudio] = useState<AudioEditorState | null>(null);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [regionStart, setRegionStart] = useState<number | null>(null);
  const [regionEnd, setRegionEnd] = useState<number | null>(null);
  const [ffmpegReady, setFfmpegReady] = useState(false);
  const [ffmpegLoading, setFfmpegLoading] = useState(false);
  const [processing, setProcessing] = useState<string | null>(null);
  const [dragHover, setDragHover] = useState(false);
  const ffmpegRef = useRef<unknown>(null);
  const waveformActionsRef = useRef<{
    play: () => void;
    pause: () => void;
    stop: () => void;
  } | null>(null);

  const onWaveformReady = useCallback(
    (api: {
      play: () => void;
      pause: () => void;
      stop: () => void;
      duration: number;
    }) => {
      waveformActionsRef.current = { play: api.play, pause: api.pause, stop: api.stop };
      setDuration(api.duration);
    },
    [],
  );

  function handleFiles(files: FileList | null) {
    if (!files || !files.length) return;
    const f = files[0];
    const mime = inferMime(f.name, f.type);
    if (!/(audio\/)/.test(mime) && !/(mpeg|wav|mp4|aac|ogg)/.test(mime)) {
      showToast("Unsupported file type — use mp3, wav, or m4a", "error");
      return;
    }
    setAudio({ fileName: f.name, fileMime: mime, blob: f });
    setRegionStart(null);
    setRegionEnd(null);
    setCurrentTime(0);
    setPlaying(false);
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragHover(false);
    handleFiles(e.dataTransfer.files);
  }

  function reset() {
    setAudio(null);
    setDuration(0);
    setCurrentTime(0);
    setRegionStart(null);
    setRegionEnd(null);
    setPlaying(false);
  }

  async function ensureFfmpeg(): Promise<unknown> {
    if (ffmpegRef.current) return ffmpegRef.current;
    setFfmpegLoading(true);
    try {
      const mod = await import("@ffmpeg/ffmpeg");
      const util = await import("@ffmpeg/util");
      const ff = new mod.FFmpeg();
      await ff.load({
        coreURL: await util.toBlobURL(
          "https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.js",
          "text/javascript",
        ),
        wasmURL: await util.toBlobURL(
          "https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.wasm",
          "application/wasm",
        ),
      });
      ffmpegRef.current = ff;
      setFfmpegReady(true);
      return ff;
    } finally {
      setFfmpegLoading(false);
    }
  }

  async function runFfmpeg(args: string[], inputName: string, outputName: string): Promise<Blob> {
    if (!audio) throw new Error("No audio loaded");
    const util = await import("@ffmpeg/util");
    const ff = (await ensureFfmpeg()) as {
      writeFile: (name: string, data: Uint8Array) => Promise<void>;
      exec: (args: string[]) => Promise<number>;
      readFile: (name: string) => Promise<Uint8Array | string>;
      deleteFile: (name: string) => Promise<void>;
    };
    const buf = new Uint8Array(await audio.blob.arrayBuffer());
    await ff.writeFile(inputName, buf);
    const code = await ff.exec(args);
    if (code !== 0) {
      await ff.deleteFile(inputName).catch(() => undefined);
      throw new Error("FFmpeg exited with code " + code);
    }
    const out = await ff.readFile(outputName);
    const outArr = typeof out === "string" ? new TextEncoder().encode(out) : out;
    await ff.deleteFile(inputName).catch(() => undefined);
    await ff.deleteFile(outputName).catch(() => undefined);
    const blob = new Blob([outArr.buffer as ArrayBuffer], { type: audio.fileMime });
    void util;
    return blob;
  }

  async function applyEdit(label: string, build: (inExt: string, outExt: string) => string[]) {
    if (!audio) return;
    setProcessing(label);
    try {
      const ext = inferExt(audio.fileMime, audio.fileName);
      const inputName = "in." + ext;
      const outputName = "out." + ext;
      const args = ["-i", inputName, ...build(inputName, outputName), "-y", outputName];
      const blob = await runFfmpeg(args, inputName, outputName);
      setAudio({ fileName: audio.fileName, fileMime: audio.fileMime, blob });
      setRegionStart(null);
      setRegionEnd(null);
      showToast(label + " applied", "success");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      showToast(label + " failed: " + msg, "error");
    } finally {
      setProcessing(null);
    }
  }

  function hasRegion(): boolean {
    return regionStart !== null && regionEnd !== null && regionEnd > regionStart;
  }

  async function trimToSelection() {
    if (!hasRegion()) {
      showToast("Drag on the waveform to select a region first", "info");
      return;
    }
    const s = regionStart!;
    const e = regionEnd!;
    await applyEdit("Trim", () => ["-ss", String(s), "-to", String(e), "-c", "copy"]);
  }

  async function cutSelection() {
    if (!hasRegion()) {
      showToast("Drag on the waveform to select a region first", "info");
      return;
    }
    const s = regionStart!;
    const e = regionEnd!;
    // Concat the head + tail around the cut using the concat filter.
    await applyEdit("Cut", () => [
      "-filter_complex",
      `[0:a]atrim=0:${s},asetpts=PTS-STARTPTS[a0];[0:a]atrim=start=${e},asetpts=PTS-STARTPTS[a1];[a0][a1]concat=n=2:v=0:a=1[out]`,
      "-map",
      "[out]",
    ]);
  }

  async function addFadeIn() {
    if (!duration) return;
    const dur = Math.min(3, duration);
    await applyEdit("Fade in", () => ["-af", `afade=t=in:st=0:d=${dur}`]);
  }

  async function addFadeOut() {
    if (!duration) return;
    const dur = Math.min(3, duration);
    const start = Math.max(0, duration - dur);
    await applyEdit("Fade out", () => ["-af", `afade=t=out:st=${start}:d=${dur}`]);
  }

  async function normalize() {
    await applyEdit("Normalize", () => ["-af", "loudnorm=I=-16:TP=-1.5:LRA=11"]);
  }

  function exportFile() {
    if (!audio) return;
    const url = URL.createObjectURL(audio.blob);
    const a = document.createElement("a");
    a.href = url;
    const base = audio.fileName.replace(/\.[^.]+$/, "");
    const ext = inferExt(audio.fileMime, audio.fileName);
    a.download = `${base}-edit.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    showToast("Export started", "success");
  }

  useEffect(() => {
    return () => {
      const ff = ffmpegRef.current as { terminate?: () => void } | null;
      try {
        ff?.terminate?.();
      } catch {}
    };
  }, []);

  const busy = processing !== null || ffmpegLoading;

  if (!audio) {
    return (
      <div style={{ padding: "32px 24px", maxWidth: 920, margin: "0 auto" }}>
        <DropZone
          dragHover={dragHover}
          onDragEnter={() => setDragHover(true)}
          onDragLeave={() => setDragHover(false)}
          onDrop={onDrop}
          onFiles={handleFiles}
        />
        <div style={{ marginTop: 18, color: D.txd, fontFamily: mn, fontSize: 11, letterSpacing: 0.4 }}>
          MP3, WAV, M4A · processed locally · no upload
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: "20px 24px 64px", maxWidth: 1200, margin: "0 auto" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginBottom: 14,
          flexWrap: "wrap",
        }}
      >
        <div style={{ fontFamily: mn, fontSize: 12, color: D.txm }}>FILE</div>
        <div style={{ fontFamily: ft, fontSize: 14, color: D.tx }}>{audio.fileName}</div>
        <div style={{ flex: 1 }} />
        <button onClick={reset} style={ghostBtn}>
          Load different file
        </button>
      </div>

      <div
        style={{
          background: D.card,
          border: `1px solid ${D.border}`,
          borderRadius: 12,
          padding: 14,
          marginBottom: 14,
        }}
      >
        <WaveformPanel
          blob={audio.blob}
          onReady={onWaveformReady}
          onTimeUpdate={setCurrentTime}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onRegionChange={(s, e) => {
            setRegionStart(s);
            setRegionEnd(e);
          }}
        />
        <div
          style={{
            marginTop: 10,
            display: "flex",
            alignItems: "center",
            gap: 16,
            fontFamily: mn,
            fontSize: 11,
            color: D.txm,
          }}
        >
          <span>{formatTime(currentTime)} / {formatTime(duration)}</span>
          {hasRegion() ? (
            <span style={{ color: D.violet }}>
              SELECTION {formatTime(regionStart!)} → {formatTime(regionEnd!)}
              {"  "}({(regionEnd! - regionStart!).toFixed(2)}s)
            </span>
          ) : (
            <span>Drag on the waveform to select a region</span>
          )}
        </div>
      </div>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
          marginBottom: 14,
          alignItems: "center",
        }}
      >
        <button
          onClick={() => waveformActionsRef.current?.play()}
          style={toolBtn(D.teal)}
          disabled={busy || playing}
        >
          ▶ Play
        </button>
        <button
          onClick={() => waveformActionsRef.current?.pause()}
          style={toolBtn(D.amber)}
          disabled={busy || !playing}
        >
          ⏸ Pause
        </button>
        <button
          onClick={() => waveformActionsRef.current?.stop()}
          style={toolBtn(D.coral)}
          disabled={busy}
        >
          ⏹ Stop
        </button>
        <div style={vsep} />
        <button onClick={trimToSelection} style={toolBtn(D.violet)} disabled={busy || !hasRegion()}>
          Trim to selection
        </button>
        <button onClick={cutSelection} style={toolBtn(D.crimson)} disabled={busy || !hasRegion()}>
          Cut selection
        </button>
        <div style={vsep} />
        <button onClick={addFadeIn} style={toolBtn(D.cyan)} disabled={busy}>
          Fade in
        </button>
        <button onClick={addFadeOut} style={toolBtn(D.cyan)} disabled={busy}>
          Fade out
        </button>
        <button onClick={normalize} style={toolBtn(D.blue)} disabled={busy}>
          Normalize
        </button>
        <div style={vsep} />
        <button onClick={exportFile} style={primaryBtn} disabled={busy}>
          Export
        </button>
      </div>

      <div
        style={{
          fontFamily: mn,
          fontSize: 11,
          color: D.txd,
          minHeight: 18,
        }}
      >
        {ffmpegLoading ? "Loading FFmpeg…" : null}
        {processing ? `Working: ${processing}…` : null}
        {!ffmpegLoading && !processing && ffmpegReady ? "FFmpeg ready" : null}
        {!ffmpegLoading && !processing && !ffmpegReady ? "FFmpeg loads on first edit" : null}
      </div>
    </div>
  );
}

function DropZone({
  dragHover,
  onDragEnter,
  onDragLeave,
  onDrop,
  onFiles,
}: {
  dragHover: boolean;
  onDragEnter: () => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
  onFiles: (files: FileList | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        onDragEnter();
      }}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      style={{
        background: D.card,
        border: `1.5px dashed ${dragHover ? D.violet : D.border}`,
        borderRadius: 14,
        padding: "56px 24px",
        textAlign: "center",
        transition: "border-color 140ms ease, background 140ms ease",
      }}
    >
      <div
        style={{
          fontFamily: gf,
          fontSize: 22,
          color: D.tx,
          marginBottom: 6,
          letterSpacing: 0.2,
        }}
      >
        Drop an audio file here
      </div>
      <div style={{ fontFamily: ft, fontSize: 13, color: D.txm, marginBottom: 18 }}>
        MP3, WAV, or M4A — everything runs in your browser
      </div>
      <button onClick={() => inputRef.current?.click()} style={primaryBtn}>
        Upload audio
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="audio/mpeg,audio/wav,audio/mp4,audio/aac,audio/ogg,.mp3,.wav,.m4a,.aac,.ogg"
        style={{ display: "none" }}
        onChange={(e) => onFiles(e.target.files)}
      />
    </div>
  );
}

const primaryBtn: React.CSSProperties = {
  background: D.amber,
  color: "#0A0A0F",
  border: "none",
  borderRadius: 8,
  padding: "10px 18px",
  fontFamily: mn,
  fontSize: 12,
  letterSpacing: 0.6,
  textTransform: "uppercase",
  cursor: "pointer",
  fontWeight: 600,
};

const ghostBtn: React.CSSProperties = {
  background: "transparent",
  color: D.txm,
  border: `1px solid ${D.border}`,
  borderRadius: 6,
  padding: "6px 12px",
  fontFamily: mn,
  fontSize: 11,
  letterSpacing: 0.6,
  textTransform: "uppercase",
  cursor: "pointer",
};

function toolBtn(accent: string): React.CSSProperties {
  return {
    background: D.card,
    color: D.tx,
    border: `1px solid ${accent}55`,
    borderRadius: 6,
    padding: "8px 14px",
    fontFamily: mn,
    fontSize: 11,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    cursor: "pointer",
  };
}

const vsep: React.CSSProperties = {
  width: 1,
  height: 20,
  background: D.border,
  margin: "0 4px",
};
