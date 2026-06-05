"use client";

// ProductionSTUDIO · Timeline Editor (Phase 6E, v1)
//
// A basic non-linear editor: media bin + 2-track timeline (video / audio
// overlay), drag-to-position, right-edge trim, HTML5 chained preview, and
// FFmpeg.wasm export via CDN-loaded core (no SharedArrayBuffer required —
// we load the single-threaded core so it works without COOP/COEP headers).
//
// This is intentionally a v1: 1 video track + 1 audio track, no
// transitions, no effects. The goal is a working visualization-plus-export.

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Plus, Play, Square, Download, Loader2, Trash2, Film, Music } from "lucide-react";
import { ProductionStudioShell } from "./shell";
import { D, ft, gf, mn, uid } from "../shared-constants";
import { useToast } from "../toast-context";

interface Clip {
  id: string;
  name: string;
  url: string;          // blob URL for preview
  file: File;           // original file for export
  durationSec: number;
  kind: "video" | "audio";
}

interface Placement {
  id: string;
  clipId: string;
  startSec: number;     // where it begins on the timeline
  durationSec: number;  // visible length on the timeline (after trim)
  trimStartSec: number; // offset into the source clip
}

interface DragState {
  placementId: string;
  track: "video" | "audio";
  mode: "move" | "trim-right";
  originX: number;
  originStart: number;
  originDuration: number;
}

// ─── FFmpeg.wasm loader (CDN, single-threaded, no SAB) ───
// Loaded lazily on first export; cached after.
type FFmpegInstance = {
  load: (opts: { coreURL: string; wasmURL: string }) => Promise<void>;
  writeFile: (name: string, data: Uint8Array) => Promise<void>;
  readFile: (name: string) => Promise<Uint8Array | string>;
  exec: (args: string[]) => Promise<number>;
  on: (event: string, cb: (msg: { progress?: number; time?: number }) => void) => void;
};

let ffmpegCached: FFmpegInstance | null = null;

async function loadFFmpeg(onProgress: (pct: number) => void): Promise<FFmpegInstance> {
  if (ffmpegCached) return ffmpegCached;

  // Pull both modules from a stable CDN as ESM. Avoids the missing npm
  // package situation while still using the same API.
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-expect-error - dynamic CDN import has no type info
  const ffMod = await import(/* webpackIgnore: true */ "https://esm.sh/@ffmpeg/ffmpeg@0.12.10");
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-expect-error - dynamic CDN import has no type info
  const utilMod = await import(/* webpackIgnore: true */ "https://esm.sh/@ffmpeg/util@0.12.1");

  const FFmpegCtor = ffMod.FFmpeg as new () => FFmpegInstance;
  const toBlobURL = utilMod.toBlobURL as (url: string, mime: string) => Promise<string>;

  const ff = new FFmpegCtor();
  ff.on("progress", (msg) => {
    if (typeof msg.progress === "number") onProgress(Math.max(0, Math.min(100, msg.progress * 100)));
  });

  const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd";
  await ff.load({
    coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
    wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm"),
  });

  ffmpegCached = ff;
  return ff;
}

// Probe duration via a hidden HTMLMediaElement.
function probeDuration(file: File, kind: "video" | "audio"): Promise<number> {
  return new Promise((resolve) => {
    const el = document.createElement(kind === "video" ? "video" : "audio") as HTMLMediaElement;
    el.preload = "metadata";
    el.src = URL.createObjectURL(file);
    const done = () => {
      const d = isFinite(el.duration) ? el.duration : 0;
      resolve(d);
    };
    el.addEventListener("loadedmetadata", done, { once: true });
    el.addEventListener("error", () => resolve(0), { once: true });
  });
}

// Pixels-per-second derived from zoom slider (1..10 → 30..240 px/s).
function zoomToPxPerSec(z: number): number {
  return 20 + z * 22;
}

export function TimelineEditorView() {
  const { showToast } = useToast();
  const fileRef = useRef<HTMLInputElement | null>(null);

  const [mediaBin, setMediaBin] = useState<Clip[]>([]);
  const [videoTrack, setVideoTrack] = useState<Placement[]>([]);
  const [audioTrack, setAudioTrack] = useState<Placement[]>([]);
  const [zoom, setZoom] = useState<number>(5);

  // Preview state.
  const previewRef = useRef<HTMLVideoElement | null>(null);
  const audioPreviewRef = useRef<HTMLAudioElement | null>(null);
  const playStateRef = useRef<{ playing: boolean; idx: number; t0: number; offset: number }>({
    playing: false,
    idx: 0,
    t0: 0,
    offset: 0,
  });
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);

  // Export state.
  const [exporting, setExporting] = useState(false);
  const [exportPct, setExportPct] = useState(0);
  const [exportUrl, setExportUrl] = useState<string | null>(null);

  // Drag state.
  const dragRef = useRef<DragState | null>(null);

  const pxPerSec = zoomToPxPerSec(zoom);

  const totalDuration = useMemo(() => {
    const end = (arr: Placement[]) => arr.reduce((m, p) => Math.max(m, p.startSec + p.durationSec), 0);
    return Math.max(end(videoTrack), end(audioTrack), 10);
  }, [videoTrack, audioTrack]);

  // ─── Upload ───
  const onPickFile = useCallback(() => fileRef.current?.click(), []);

  const onFilesChosen = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const added: Clip[] = [];
    for (const f of files) {
      const isAudio = f.type.startsWith("audio/");
      const kind: "video" | "audio" = isAudio ? "audio" : "video";
      const dur = await probeDuration(f, kind);
      added.push({
        id: uid("clip"),
        name: f.name,
        url: URL.createObjectURL(f),
        file: f,
        durationSec: dur || 5,
        kind,
      });
    }
    setMediaBin((cur) => [...cur, ...added]);
    showToast(`Added ${added.length} clip${added.length === 1 ? "" : "s"} to bin.`, "success");
    if (fileRef.current) fileRef.current.value = "";
  }, [showToast]);

  // ─── Drag from bin onto timeline ───
  const onBinDragStart = useCallback((e: React.DragEvent<HTMLDivElement>, clip: Clip) => {
    e.dataTransfer.setData("application/x-poast-clip", clip.id);
    e.dataTransfer.effectAllowed = "copy";
  }, []);

  const onTrackDrop = useCallback((e: React.DragEvent<HTMLDivElement>, track: "video" | "audio") => {
    e.preventDefault();
    const clipId = e.dataTransfer.getData("application/x-poast-clip");
    if (!clipId) return;
    const clip = mediaBin.find((c) => c.id === clipId);
    if (!clip) return;
    if (track === "video" && clip.kind === "audio") {
      showToast("Drop audio clips on the audio track.", "info");
      return;
    }
    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    const x = e.clientX - rect.left;
    const startSec = Math.max(0, x / pxPerSec);
    const placement: Placement = {
      id: uid("p"),
      clipId: clip.id,
      startSec,
      durationSec: clip.durationSec,
      trimStartSec: 0,
    };
    if (track === "video") setVideoTrack((cur) => [...cur, placement].sort(byStart));
    else setAudioTrack((cur) => [...cur, placement].sort(byStart));
  }, [mediaBin, pxPerSec, showToast]);

  const onTrackDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    if (e.dataTransfer.types.includes("application/x-poast-clip")) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
    }
  }, []);

  // ─── Drag placements on the timeline ───
  const onPlacementMouseDown = useCallback((
    e: React.MouseEvent<HTMLDivElement>,
    placement: Placement,
    track: "video" | "audio",
    mode: "move" | "trim-right",
  ) => {
    e.stopPropagation();
    dragRef.current = {
      placementId: placement.id,
      track,
      mode,
      originX: e.clientX,
      originStart: placement.startSec,
      originDuration: placement.durationSec,
    };
    const onMove = (ev: MouseEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const dxPx = ev.clientX - d.originX;
      const dxSec = dxPx / pxPerSec;
      const setter = d.track === "video" ? setVideoTrack : setAudioTrack;
      setter((cur) => cur.map((p) => {
        if (p.id !== d.placementId) return p;
        if (d.mode === "move") {
          return { ...p, startSec: Math.max(0, d.originStart + dxSec) };
        }
        // trim-right: shrink/grow visible duration. Don't exceed source.
        const clip = mediaBin.find((c) => c.id === p.clipId);
        const maxLen = clip ? Math.max(0.05, clip.durationSec - p.trimStartSec) : d.originDuration + dxSec;
        const nextLen = Math.max(0.2, Math.min(maxLen, d.originDuration + dxSec));
        return { ...p, durationSec: nextLen };
      }).sort(byStart));
    };
    const onUp = () => {
      dragRef.current = null;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, [mediaBin, pxPerSec]);

  // ─── Delete a placement ───
  const removePlacement = useCallback((id: string, track: "video" | "audio") => {
    const setter = track === "video" ? setVideoTrack : setAudioTrack;
    setter((cur) => cur.filter((p) => p.id !== id));
  }, []);

  // ─── Preview playback ───
  // v1 strategy: drive the preview by stepping through the videoTrack
  // sequentially. We mute the <video> and play the first audio overlay
  // (if any) via a parallel <audio> element, started at currentTime.
  const stop = useCallback(() => {
    playStateRef.current.playing = false;
    setPlaying(false);
    if (previewRef.current) previewRef.current.pause();
    if (audioPreviewRef.current) audioPreviewRef.current.pause();
  }, []);

  const playFrom = useCallback(async (startAt: number) => {
    const v = previewRef.current;
    if (!v) return;
    const sorted = [...videoTrack].sort(byStart);
    if (!sorted.length) {
      showToast("Drop at least one video clip on the timeline first.", "info");
      return;
    }
    // Find first placement covering startAt, otherwise the next one.
    let idx = sorted.findIndex((p) => startAt < p.startSec + p.durationSec);
    if (idx === -1) idx = 0;
    playStateRef.current = { playing: true, idx, t0: performance.now(), offset: startAt };
    setPlaying(true);

    const a = audioPreviewRef.current;
    if (a && audioTrack.length) {
      const first = [...audioTrack].sort(byStart)[0];
      const clip = mediaBin.find((c) => c.id === first.clipId);
      if (clip) {
        a.src = clip.url;
        const into = Math.max(0, startAt - first.startSec) + first.trimStartSec;
        try {
          a.currentTime = Math.min(into, clip.durationSec);
          await a.play();
        } catch {/* user gesture missing */}
      }
    }

    const step = async () => {
      const ps = playStateRef.current;
      if (!ps.playing) return;
      const elapsed = (performance.now() - ps.t0) / 1000 + ps.offset;
      setCurrentTime(elapsed);
      const cur = sorted[ps.idx];
      if (!cur) { stop(); return; }
      if (elapsed >= cur.startSec + cur.durationSec) {
        ps.idx += 1;
        if (ps.idx >= sorted.length) { stop(); return; }
        const nxt = sorted[ps.idx];
        const clip = mediaBin.find((c) => c.id === nxt.clipId);
        if (clip && v) {
          v.src = clip.url;
          v.currentTime = nxt.trimStartSec;
          v.muted = true;
          try { await v.play(); } catch {/* */}
        }
      } else if (elapsed >= cur.startSec && v.src === "") {
        const clip = mediaBin.find((c) => c.id === cur.clipId);
        if (clip) {
          v.src = clip.url;
          v.currentTime = cur.trimStartSec + Math.max(0, elapsed - cur.startSec);
          v.muted = true;
          try { await v.play(); } catch {/* */}
        }
      } else if (v.paused && v.src) {
        try { await v.play(); } catch {/* */}
      }
      requestAnimationFrame(step);
    };

    // Prime the very first placement.
    const first = sorted[idx];
    const clip = mediaBin.find((c) => c.id === first.clipId);
    if (clip) {
      v.src = clip.url;
      const into = Math.max(0, startAt - first.startSec) + first.trimStartSec;
      v.currentTime = Math.min(into, clip.durationSec);
      v.muted = true;
      try { await v.play(); } catch {/* */}
    }
    requestAnimationFrame(step);
  }, [videoTrack, audioTrack, mediaBin, showToast, stop]);

  const play = useCallback(() => { void playFrom(currentTime); }, [playFrom, currentTime]);

  // ─── Export ───
  const exportMp4 = useCallback(async () => {
    if (!videoTrack.length) {
      showToast("Add at least one video clip to export.", "info");
      return;
    }
    setExporting(true);
    setExportPct(0);
    setExportUrl(null);
    try {
      const ff = await loadFFmpeg(setExportPct);
      const sorted = [...videoTrack].sort(byStart);

      // 1) Write each source video, trim it to its placement window, and
      //    pad with silent audio if missing so the concat is uniform.
      const segmentNames: string[] = [];
      for (let i = 0; i < sorted.length; i++) {
        const pl = sorted[i];
        const clip = mediaBin.find((c) => c.id === pl.clipId);
        if (!clip) continue;
        const inName = `in_${i}_${cleanName(clip.name)}`;
        const outName = `seg_${i}.mp4`;
        const buf = new Uint8Array(await clip.file.arrayBuffer());
        await ff.writeFile(inName, buf);
        await ff.exec([
          "-ss", pl.trimStartSec.toFixed(3),
          "-i", inName,
          "-t", pl.durationSec.toFixed(3),
          "-c:v", "libx264",
          "-preset", "ultrafast",
          "-pix_fmt", "yuv420p",
          "-c:a", "aac",
          "-ar", "44100",
          outName,
        ]);
        segmentNames.push(outName);
      }

      // 2) Build a concat manifest and stitch into one MP4.
      const manifest = segmentNames.map((n) => `file '${n}'`).join("\n");
      await ff.writeFile("concat.txt", new TextEncoder().encode(manifest));
      const concatOut = "concat.mp4";
      await ff.exec([
        "-f", "concat",
        "-safe", "0",
        "-i", "concat.txt",
        "-c", "copy",
        concatOut,
      ]);

      // 3) Optionally mix in the first audio overlay placement.
      let finalName = concatOut;
      if (audioTrack.length) {
        const overlay = [...audioTrack].sort(byStart)[0];
        const aClip = mediaBin.find((c) => c.id === overlay.clipId);
        if (aClip) {
          const aIn = `audio_in_${cleanName(aClip.name)}`;
          const buf = new Uint8Array(await aClip.file.arrayBuffer());
          await ff.writeFile(aIn, buf);
          const mixed = "final.mp4";
          // Delay the overlay to its startSec, then mix with the original
          // video audio. Output ends when the longest stream ends.
          await ff.exec([
            "-i", concatOut,
            "-ss", overlay.trimStartSec.toFixed(3),
            "-t", overlay.durationSec.toFixed(3),
            "-i", aIn,
            "-filter_complex",
            `[1:a]adelay=${Math.round(overlay.startSec * 1000)}|${Math.round(overlay.startSec * 1000)}[a1];[0:a][a1]amix=inputs=2:duration=longest[aout]`,
            "-map", "0:v",
            "-map", "[aout]",
            "-c:v", "copy",
            "-c:a", "aac",
            mixed,
          ]);
          finalName = mixed;
        }
      }

      const data = await ff.readFile(finalName);
      const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data;
      const ab = new ArrayBuffer(bytes.byteLength);
      new Uint8Array(ab).set(bytes);
      const blob = new Blob([ab], { type: "video/mp4" });
      const url = URL.createObjectURL(blob);
      setExportUrl(url);
      setExportPct(100);
      showToast("Export finished. Download from the toolbar.", "success");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      showToast("Export failed: " + msg, "error");
    } finally {
      setExporting(false);
    }
  }, [videoTrack, audioTrack, mediaBin, showToast]);

  // Cleanup blob URLs.
  useEffect(() => {
    return () => {
      mediaBin.forEach((c) => URL.revokeObjectURL(c.url));
      if (exportUrl) URL.revokeObjectURL(exportUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <ProductionStudioShell title="Timeline Editor" subtitle="v1 · 1 video track + 1 audio overlay, drag to place, trim from the right edge, export to MP4.">
      <div style={{ padding: "16px 20px 32px", display: "grid", gridTemplateColumns: "260px 1fr", gap: 14, minHeight: 600 }}>
        {/* ── Media bin ── */}
        <aside style={{
          background: D.surface,
          border: `1px solid ${D.border}`,
          borderRadius: 12,
          padding: 12,
          height: "fit-content",
          maxHeight: "78vh",
          overflow: "auto",
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <span style={{ fontFamily: mn, fontSize: 10, letterSpacing: 1.2, color: D.txd, textTransform: "uppercase" }}>Media Bin</span>
            <button
              type="button"
              onClick={onPickFile}
              style={primaryBtn}
            >
              <Plus size={12} /> Add
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="video/mp4,video/quicktime,video/webm,audio/*"
              multiple
              onChange={onFilesChosen}
              style={{ display: "none" }}
            />
          </div>

          {mediaBin.length === 0 ? (
            <div style={{
              fontFamily: ft,
              fontSize: 12,
              color: D.txm,
              lineHeight: 1.5,
              padding: 12,
              border: `1px dashed ${D.border}`,
              borderRadius: 8,
              textAlign: "center",
            }}>
              Upload mp4 or audio files. Drag them onto the tracks below.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {mediaBin.map((c) => (
                <div
                  key={c.id}
                  draggable
                  onDragStart={(e) => onBinDragStart(e, c)}
                  style={{
                    background: D.card,
                    border: `1px solid ${D.border}`,
                    borderRadius: 8,
                    padding: 8,
                    cursor: "grab",
                    display: "flex",
                    gap: 8,
                    alignItems: "center",
                  }}
                >
                  <div style={{
                    width: 28, height: 28, borderRadius: 6,
                    background: c.kind === "video" ? D.blue + "22" : D.violet + "22",
                    border: `1px solid ${c.kind === "video" ? D.blue + "55" : D.violet + "55"}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    {c.kind === "video" ? <Film size={14} color={D.blue} /> : <Music size={14} color={D.violet} />}
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontFamily: ft, fontSize: 12, color: D.tx, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {c.name}
                    </div>
                    <div style={{ fontFamily: mn, fontSize: 9, color: D.txd, letterSpacing: 0.4 }}>
                      {c.kind} · {formatTime(c.durationSec)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </aside>

        {/* ── Main editor ── */}
        <main style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
          {/* Toolbar */}
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "10px 12px",
            background: D.surface,
            border: `1px solid ${D.border}`,
            borderRadius: 10,
            flexWrap: "wrap",
          }}>
            <button type="button" onClick={play} disabled={playing} style={iconBtn(D.teal)}>
              <Play size={12} /> Play
            </button>
            <button type="button" onClick={stop} disabled={!playing} style={iconBtn(D.coral)}>
              <Square size={12} /> Stop
            </button>
            <div style={{ width: 1, height: 18, background: D.border }} />
            <div style={{ fontFamily: mn, fontSize: 11, color: D.txm, letterSpacing: 0.5 }}>
              {formatTime(currentTime)} / {formatTime(totalDuration)}
            </div>
            <div style={{ width: 1, height: 18, background: D.border }} />
            <label style={{ fontFamily: mn, fontSize: 10, color: D.txd, letterSpacing: 0.8, textTransform: "uppercase" }}>Zoom</label>
            <input
              type="range"
              min={1}
              max={10}
              value={zoom}
              onChange={(e) => setZoom(parseInt(e.target.value, 10))}
              style={{ width: 120 }}
            />
            <div style={{ flex: 1 }} />
            <button
              type="button"
              onClick={exportMp4}
              disabled={exporting || videoTrack.length === 0}
              style={iconBtn(D.amber)}
            >
              {exporting ? <Loader2 size={12} className="spin" /> : <Download size={12} />}
              {exporting ? `Exporting… ${Math.round(exportPct)}%` : "Export MP4"}
            </button>
            {exportUrl ? (
              <a href={exportUrl} download="timeline-export.mp4" style={{ ...iconBtn(D.teal), textDecoration: "none" }}>
                <Download size={12} /> Download
              </a>
            ) : null}
          </div>

          {/* Preview */}
          <div style={{
            background: "#000",
            border: `1px solid ${D.border}`,
            borderRadius: 10,
            aspectRatio: "16/9",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
          }}>
            <video ref={previewRef} style={{ maxWidth: "100%", maxHeight: "100%" }} playsInline />
            <audio ref={audioPreviewRef} style={{ display: "none" }} />
          </div>

          {/* Tracks */}
          <div style={{
            background: D.surface,
            border: `1px solid ${D.border}`,
            borderRadius: 10,
            padding: 10,
            overflowX: "auto",
          }}>
            <Ruler totalSec={totalDuration} pxPerSec={pxPerSec} />
            <TrackLane
              label="VIDEO"
              kind="video"
              accent={D.blue}
              placements={videoTrack}
              clips={mediaBin}
              pxPerSec={pxPerSec}
              onDrop={onTrackDrop}
              onDragOver={onTrackDragOver}
              onPlacementMouseDown={onPlacementMouseDown}
              onRemove={removePlacement}
            />
            <TrackLane
              label="AUDIO"
              kind="audio"
              accent={D.violet}
              placements={audioTrack}
              clips={mediaBin}
              pxPerSec={pxPerSec}
              onDrop={onTrackDrop}
              onDragOver={onTrackDragOver}
              onPlacementMouseDown={onPlacementMouseDown}
              onRemove={removePlacement}
            />
          </div>
        </main>
      </div>
      <style>{`
        .spin { animation: poast-spin 0.9s linear infinite; }
        @keyframes poast-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </ProductionStudioShell>
  );
}

function Ruler({ totalSec, pxPerSec }: { totalSec: number; pxPerSec: number }) {
  const ticks: number[] = [];
  const step = totalSec > 60 ? 5 : 1;
  for (let s = 0; s <= totalSec + step; s += step) ticks.push(s);
  return (
    <div style={{
      position: "relative",
      height: 18,
      borderBottom: `1px solid ${D.border}`,
      marginBottom: 6,
      minWidth: Math.max(600, totalSec * pxPerSec + 80),
    }}>
      {ticks.map((s) => (
        <div key={s} style={{
          position: "absolute",
          left: 80 + s * pxPerSec,
          top: 0,
          height: "100%",
          display: "flex",
          alignItems: "flex-end",
        }}>
          <span style={{ fontFamily: mn, fontSize: 9, color: D.txd, letterSpacing: 0.4, transform: "translateX(-50%)" }}>
            {formatTime(s)}
          </span>
        </div>
      ))}
    </div>
  );
}

function TrackLane({
  label, kind, accent, placements, clips, pxPerSec, onDrop, onDragOver, onPlacementMouseDown, onRemove,
}: {
  label: string;
  kind: "video" | "audio";
  accent: string;
  placements: Placement[];
  clips: Clip[];
  pxPerSec: number;
  onDrop: (e: React.DragEvent<HTMLDivElement>, track: "video" | "audio") => void;
  onDragOver: (e: React.DragEvent<HTMLDivElement>) => void;
  onPlacementMouseDown: (e: React.MouseEvent<HTMLDivElement>, p: Placement, track: "video" | "audio", mode: "move" | "trim-right") => void;
  onRemove: (id: string, track: "video" | "audio") => void;
}) {
  const totalSec = placements.reduce((m, p) => Math.max(m, p.startSec + p.durationSec), 30);
  return (
    <div style={{ display: "flex", marginBottom: 8, minWidth: Math.max(600, totalSec * pxPerSec + 80) }}>
      <div style={{
        width: 80,
        flexShrink: 0,
        padding: "0 8px",
        display: "flex",
        alignItems: "center",
        fontFamily: mn,
        fontSize: 10,
        color: accent,
        letterSpacing: 1,
        textTransform: "uppercase",
        borderRight: `1px solid ${D.border}`,
      }}>
        {label}
      </div>
      <div
        onDrop={(e) => onDrop(e, kind)}
        onDragOver={onDragOver}
        style={{
          position: "relative",
          flex: 1,
          height: 56,
          background: D.bg,
          border: `1px dashed ${D.border}`,
          borderRadius: 6,
          marginLeft: 8,
        }}
      >
        {placements.map((p) => {
          const clip = clips.find((c) => c.id === p.clipId);
          return (
            <div
              key={p.id}
              onMouseDown={(e) => onPlacementMouseDown(e, p, kind, "move")}
              style={{
                position: "absolute",
                left: p.startSec * pxPerSec,
                top: 4,
                width: Math.max(24, p.durationSec * pxPerSec),
                height: 48,
                background: accent + "33",
                border: `1px solid ${accent}`,
                borderRadius: 5,
                cursor: "grab",
                display: "flex",
                alignItems: "center",
                padding: "0 8px",
                overflow: "hidden",
              }}
              title={clip?.name || "clip"}
            >
              <div style={{
                fontFamily: ft,
                fontSize: 11,
                color: D.tx,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                flex: 1,
              }}>
                {clip?.name || "clip"}
              </div>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onRemove(p.id, kind); }}
                style={{
                  background: "transparent",
                  border: "none",
                  color: D.txm,
                  cursor: "pointer",
                  padding: 2,
                  display: "flex",
                  alignItems: "center",
                }}
                title="Remove"
              >
                <Trash2 size={11} />
              </button>
              {/* Trim handle */}
              <div
                onMouseDown={(e) => { e.stopPropagation(); onPlacementMouseDown(e, p, kind, "trim-right"); }}
                style={{
                  position: "absolute",
                  right: 0,
                  top: 0,
                  width: 8,
                  height: "100%",
                  background: accent,
                  cursor: "ew-resize",
                  borderRadius: "0 5px 5px 0",
                }}
                title="Trim"
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function byStart(a: Placement, b: Placement): number {
  return a.startSec - b.startSec;
}

function formatTime(sec: number): string {
  if (!isFinite(sec) || sec < 0) sec = 0;
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function cleanName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

const primaryBtn: React.CSSProperties = {
  background: D.amber + "22",
  border: `1px solid ${D.amber}88`,
  color: D.amber,
  padding: "4px 10px",
  borderRadius: 5,
  fontFamily: mn,
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: 0.6,
  textTransform: "uppercase",
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
};

function iconBtn(color: string): React.CSSProperties {
  return {
    background: "transparent",
    border: `1px solid ${color}55`,
    color,
    padding: "5px 10px",
    borderRadius: 5,
    fontFamily: mn,
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
  };
}
