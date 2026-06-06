// ProductionSTUDIO · Timeline export pipeline.
//
// Renders a Project to an mp4 Blob entirely in-browser via FFmpeg.wasm.
// The pipeline is split into three phases:
//   1. Ingest — every referenced clip is loaded into ffmpeg memfs once.
//      Each placement that trims/extends the source becomes its own
//      pre-cut intermediate so the final concat stage is a flat list of
//      same-length segments.
//   2. Compose — build the filter graph: per-track concat (video filter
//      for video tracks; concat filter for audio), then scale/crop to
//      the platform preset, then amix the audio tracks together. If
//      burnCaptions, every caption track is serialized to an ASS file
//      written to memfs and burned via the subtitles filter.
//   3. Encode — H.264 + AAC, mp4. Returned as a fresh Blob detached
//      from wasm memory so the caller can revokeObjectURL freely.
//
// FFmpeg.wasm is lazy-loaded from the unpkg core build (same single-
// threaded core used in shorts-formatter — no SharedArrayBuffer / COOP
// required).

"use client";

import {
  type Project,
  type TimelineTrack,
  type TimelinePlacement,
  type MediaClip,
  type CaptionCue,
  type FramePreset,
  PRESET_FRAMES,
  findClip,
  projectDuration,
} from "./types";

// ─── FFmpeg.wasm ───
// We mirror the shorts-formatter pattern: dynamic-import the package
// the first time we need it, keep the instance alive across exports.

interface FFmpegInstance {
  load: (opts: { coreURL: string; wasmURL: string }) => Promise<void>;
  writeFile: (name: string, data: Uint8Array | string) => Promise<void>;
  readFile: (name: string) => Promise<Uint8Array | string>;
  deleteFile: (name: string) => Promise<void>;
  exec: (args: string[]) => Promise<number>;
  on: (event: string, cb: (msg: { progress?: number; time?: number; message?: string }) => void) => void;
}

let ffmpegRef: FFmpegInstance | null = null;
let ffmpegLoadPromise: Promise<FFmpegInstance> | null = null;

async function ensureFFmpeg(onLoadProgress?: (msg: string) => void): Promise<FFmpegInstance> {
  if (ffmpegRef) return ffmpegRef;
  if (ffmpegLoadPromise) return ffmpegLoadPromise;

  ffmpegLoadPromise = (async () => {
    onLoadProgress?.("Loading FFmpeg.wasm…");
    const { FFmpeg } = await import("@ffmpeg/ffmpeg");
    const { toBlobURL } = await import("@ffmpeg/util");
    const ff = new FFmpeg() as unknown as FFmpegInstance;
    await ff.load({
      coreURL: await toBlobURL(
        "https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.js",
        "text/javascript",
      ),
      wasmURL: await toBlobURL(
        "https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.wasm",
        "application/wasm",
      ),
    });
    ffmpegRef = ff;
    return ff;
  })();

  try {
    return await ffmpegLoadPromise;
  } finally {
    ffmpegLoadPromise = null;
  }
}

// ─── Public API ───

export interface ExportOptions {
  preset: FramePreset;
  burnCaptions: boolean;
  /** Progress 0..1 across the whole pipeline (ingest + encode). */
  onProgress?: (pct: number) => void;
  /** Free-form status line (loading wasm, ingesting clip N…). */
  onStatus?: (msg: string) => void;
  /** Output framerate. Default 30. */
  fps?: number;
}

export async function exportTimeline(
  project: Project,
  opts: ExportOptions,
): Promise<Blob> {
  const fps = opts.fps ?? 30;
  const frame = PRESET_FRAMES[opts.preset];
  const totalDuration = projectDuration(project) || 0;
  if (totalDuration <= 0) {
    throw new Error("Project has no clips to export.");
  }

  opts.onStatus?.("Loading FFmpeg.wasm…");
  const ff = await ensureFFmpeg(opts.onStatus);
  // Wire ffmpeg progress into the second half of our progress bar.
  // (The ingest phase drives the first half.)
  ff.on("progress", (msg) => {
    if (typeof msg.progress === "number") {
      const ffPct = Math.max(0, Math.min(1, msg.progress));
      opts.onProgress?.(0.5 + ffPct * 0.5);
    }
  });

  const tempFiles = new Set<string>();
  const safeDelete = async (path: string) => {
    if (!tempFiles.has(path)) return;
    try {
      await ff.deleteFile(path);
    } catch {}
    tempFiles.delete(path);
  };
  const writeTemp = async (path: string, data: Uint8Array | string) => {
    await ff.writeFile(path, data);
    tempFiles.add(path);
  };

  try {
    // ─── 1. Ingest clips ───
    // Each unique clip → one ingested file in memfs.
    const ingestedByClip = new Map<string, string>();
    const referencedClips = collectReferencedClips(project);
    let clipIdx = 0;
    for (const clip of referencedClips) {
      const ext = guessExtension(clip);
      const path = `in_${clipIdx}.${ext}`;
      clipIdx += 1;
      opts.onStatus?.(`Loading ${clip.name}…`);
      const bytes = await clipBytes(clip);
      await writeTemp(path, bytes);
      ingestedByClip.set(clip.id, path);

      const pct = referencedClips.length > 0 ? clipIdx / referencedClips.length : 1;
      opts.onProgress?.(pct * 0.45);
    }

    // ─── 2. Pre-cut each placement into a per-segment intermediate ───
    // Doing the trim up-front (via -ss / -t copy) keeps the final concat
    // stage a flat list which the concat demuxer handles cleanly.
    const videoSegments: string[] = []; // paths, in order
    const audioSegments: Array<{ path: string; startSec: number; volume: number }> = [];

    let segIdx = 0;
    const videoTracks = project.tracks.filter(
      (t) => !t.hidden && (t.kind === "video" || t.kind === "overlay"),
    );
    const audioTracks = project.tracks.filter(
      (t) => !t.muted && (t.kind === "audio" || t.kind === "video"),
    );

    // For the video, we layer multiple video tracks into one timeline by
    // walking the dominant video track (the first non-hidden one) in
    // chronological order. Overlay tracks are deferred to a follow-up —
    // v1 honors the editor-shell's expectation that V1 is the master.
    const dominantVideo = videoTracks[0];
    if (dominantVideo) {
      const placements = [...dominantVideo.placements].sort((a, b) => a.startSec - b.startSec);
      let cursor = 0;
      for (const p of placements) {
        const clip = findClip(project, p.clipId);
        if (!clip || clip.kind === "audio") continue;
        const ingestPath = ingestedByClip.get(clip.id);
        if (!ingestPath) continue;

        // Gap before this placement → black-frame filler segment.
        if (p.startSec > cursor + 0.01) {
          const fillerLen = p.startSec - cursor;
          const fillerPath = `seg_${segIdx++}_filler.mp4`;
          opts.onStatus?.("Rendering gap…");
          await ff.exec([
            "-f",
            "lavfi",
            "-i",
            `color=c=black:s=${frame.width}x${frame.height}:r=${fps}:d=${fillerLen.toFixed(3)}`,
            "-f",
            "lavfi",
            "-i",
            `anullsrc=r=48000:cl=stereo`,
            "-shortest",
            "-pix_fmt",
            "yuv420p",
            "-c:v",
            "libx264",
            "-preset",
            "ultrafast",
            "-c:a",
            "aac",
            fillerPath,
          ]);
          tempFiles.add(fillerPath);
          videoSegments.push(fillerPath);
        }

        // The actual clip segment, trimmed + scaled + cropped + framed.
        const segPath = `seg_${segIdx++}_v.mp4`;
        const sourceStart = Math.max(0, p.trimStartSec);
        const lenSec = Math.max(0.05, p.durationSec);

        const vf = buildScaleCropFilter(frame.width, frame.height);
        const isImage = clip.kind === "image";
        if (isImage) {
          // Still image → looped to len
          await ff.exec([
            "-loop",
            "1",
            "-t",
            lenSec.toFixed(3),
            "-i",
            ingestPath,
            "-f",
            "lavfi",
            "-t",
            lenSec.toFixed(3),
            "-i",
            `anullsrc=r=48000:cl=stereo`,
            "-vf",
            `${vf},fps=${fps}`,
            "-pix_fmt",
            "yuv420p",
            "-c:v",
            "libx264",
            "-preset",
            "ultrafast",
            "-c:a",
            "aac",
            segPath,
          ]);
        } else {
          await ff.exec([
            "-ss",
            sourceStart.toFixed(3),
            "-i",
            ingestPath,
            "-t",
            lenSec.toFixed(3),
            "-vf",
            `${vf},fps=${fps}`,
            "-pix_fmt",
            "yuv420p",
            "-c:v",
            "libx264",
            "-preset",
            "ultrafast",
            "-c:a",
            "aac",
            "-ar",
            "48000",
            "-ac",
            "2",
            segPath,
          ]);
        }
        tempFiles.add(segPath);
        videoSegments.push(segPath);
        cursor = p.startSec + lenSec;
      }

      // Trailing gap to project duration.
      if (cursor < totalDuration - 0.01) {
        const tailLen = totalDuration - cursor;
        const tailPath = `seg_${segIdx++}_tail.mp4`;
        await ff.exec([
          "-f",
          "lavfi",
          "-i",
          `color=c=black:s=${frame.width}x${frame.height}:r=${fps}:d=${tailLen.toFixed(3)}`,
          "-f",
          "lavfi",
          "-i",
          `anullsrc=r=48000:cl=stereo`,
          "-shortest",
          "-pix_fmt",
          "yuv420p",
          "-c:v",
          "libx264",
          "-preset",
          "ultrafast",
          "-c:a",
          "aac",
          tailPath,
        ]);
        tempFiles.add(tailPath);
        videoSegments.push(tailPath);
      }
    } else {
      // No video at all — render a black frame of total duration. The
      // audio tracks below will still drive the export.
      const blackPath = `seg_${segIdx++}_black.mp4`;
      await ff.exec([
        "-f",
        "lavfi",
        "-i",
        `color=c=black:s=${frame.width}x${frame.height}:r=${fps}:d=${totalDuration.toFixed(3)}`,
        "-f",
        "lavfi",
        "-i",
        `anullsrc=r=48000:cl=stereo`,
        "-shortest",
        "-pix_fmt",
        "yuv420p",
        "-c:v",
        "libx264",
        "-preset",
        "ultrafast",
        "-c:a",
        "aac",
        blackPath,
      ]);
      tempFiles.add(blackPath);
      videoSegments.push(blackPath);
    }

    opts.onProgress?.(0.5);

    // Audio-only tracks get pre-cut into their own intermediates so the
    // final amix happens against a clean set of single-stream wavs.
    for (const track of audioTracks) {
      // Skip the dominant video track — its audio is already in the
      // composed segments. Mixing an audio-only track that re-references
      // the same clip would double-count.
      if (track === dominantVideo) continue;

      for (const p of track.placements) {
        const clip = findClip(project, p.clipId);
        if (!clip || clip.kind === "image") continue;
        const ingestPath = ingestedByClip.get(clip.id);
        if (!ingestPath) continue;
        if (p.muted) continue;
        const lenSec = Math.max(0.05, p.durationSec);
        const segPath = `aud_${segIdx++}.wav`;
        await ff.exec([
          "-ss",
          Math.max(0, p.trimStartSec).toFixed(3),
          "-i",
          ingestPath,
          "-t",
          lenSec.toFixed(3),
          "-vn",
          "-ar",
          "48000",
          "-ac",
          "2",
          segPath,
        ]);
        tempFiles.add(segPath);
        audioSegments.push({
          path: segPath,
          startSec: p.startSec,
          volume: clamp01(p.volume ?? 1),
        });
      }
    }

    // ─── 3. Concat video segments ───
    const concatListPath = "video_concat.txt";
    const concatBody = videoSegments.map((p) => `file '${p}'`).join("\n");
    await writeTemp(concatListPath, concatBody);

    const concatVideoPath = "concat_video.mp4";
    await ff.exec([
      "-f",
      "concat",
      "-safe",
      "0",
      "-i",
      concatListPath,
      "-c",
      "copy",
      concatVideoPath,
    ]);
    tempFiles.add(concatVideoPath);

    // ─── 4. Caption burn (optional) ───
    let burnedVideoPath = concatVideoPath;
    if (opts.burnCaptions) {
      const captions = collectCaptions(project);
      if (captions.length > 0) {
        const subPath = "captions.ass";
        const ass = buildAssFile(captions, frame.width, frame.height);
        await writeTemp(subPath, ass);
        burnedVideoPath = "burned_video.mp4";
        // The `subtitles` filter takes a path; escape colons just in case.
        await ff.exec([
          "-i",
          concatVideoPath,
          "-vf",
          `subtitles=${subPath}`,
          "-c:v",
          "libx264",
          "-preset",
          "ultrafast",
          "-c:a",
          "copy",
          burnedVideoPath,
        ]);
        tempFiles.add(burnedVideoPath);
      }
    }

    // ─── 5. Final mux: video + amix of audio overlays ───
    const finalPath = "out.mp4";

    if (audioSegments.length === 0) {
      // Just re-encode the burned/concat output to make sure the
      // container is clean.
      await ff.exec([
        "-i",
        burnedVideoPath,
        "-c:v",
        "libx264",
        "-preset",
        "ultrafast",
        "-pix_fmt",
        "yuv420p",
        "-c:a",
        "aac",
        "-movflags",
        "+faststart",
        finalPath,
      ]);
    } else {
      // Build an input list: [0] = video (with its own audio), then one
      // input per audio overlay with -itsoffset for placement.
      const inputs: string[] = ["-i", burnedVideoPath];
      audioSegments.forEach((seg) => {
        if (seg.startSec > 0) {
          inputs.push("-itsoffset", seg.startSec.toFixed(3));
        }
        inputs.push("-i", seg.path);
      });

      // amix all audio streams: [0:a] plus each overlay input's [n:a].
      // We adelay each overlay individually because -itsoffset alone
      // affects start time but some ffmpeg builds clip the silence.
      const audioLabels: string[] = ["[0:a]"];
      const adelayParts: string[] = [];
      audioSegments.forEach((seg, idx) => {
        const inputIdx = idx + 1;
        const delayMs = Math.max(0, Math.round(seg.startSec * 1000));
        const tag = `[a${idx}]`;
        const vol = seg.volume.toFixed(3);
        // Pad with adelay so all streams share the same timeline.
        adelayParts.push(`[${inputIdx}:a]adelay=${delayMs}|${delayMs},volume=${vol}${tag}`);
        audioLabels.push(tag);
      });

      const filter = [
        ...adelayParts,
        `${audioLabels.join("")}amix=inputs=${audioLabels.length}:duration=longest:normalize=0[aout]`,
      ].join(";");

      await ff.exec([
        ...inputs,
        "-filter_complex",
        filter,
        "-map",
        "0:v",
        "-map",
        "[aout]",
        "-c:v",
        "libx264",
        "-preset",
        "ultrafast",
        "-pix_fmt",
        "yuv420p",
        "-c:a",
        "aac",
        "-ar",
        "48000",
        "-ac",
        "2",
        "-movflags",
        "+faststart",
        "-shortest",
        finalPath,
      ]);
    }
    tempFiles.add(finalPath);

    opts.onStatus?.("Finalizing…");
    const data = (await ff.readFile(finalPath)) as Uint8Array;
    // Detach from wasm memory so revokeObjectURL is safe.
    const copy = new Uint8Array(data.byteLength);
    copy.set(data);
    opts.onProgress?.(1);
    return new Blob([copy.buffer], { type: "video/mp4" });
  } finally {
    // Best-effort cleanup of temp files.
    for (const path of Array.from(tempFiles)) {
      await safeDelete(path);
    }
  }
}

// ─── Internals ───

function collectReferencedClips(project: Project): MediaClip[] {
  const seen = new Set<string>();
  const out: MediaClip[] = [];
  for (const t of project.tracks) {
    for (const p of t.placements) {
      if (seen.has(p.clipId)) continue;
      seen.add(p.clipId);
      const clip = findClip(project, p.clipId);
      if (clip) out.push(clip);
    }
  }
  return out;
}

function collectCaptions(project: Project): CaptionCue[] {
  const out: CaptionCue[] = [];
  for (const t of project.tracks) {
    if (t.kind === "caption" && !t.hidden && t.captions) {
      out.push(...t.captions);
    }
  }
  return out.sort((a, b) => a.startSec - b.startSec);
}

function guessExtension(clip: MediaClip): string {
  if (clip.file?.name) {
    const m = clip.file.name.match(/\.([a-zA-Z0-9]+)$/);
    if (m) return m[1].toLowerCase();
  }
  if (clip.kind === "audio") return "mp3";
  if (clip.kind === "image") return "png";
  return "mp4";
}

async function clipBytes(clip: MediaClip): Promise<Uint8Array> {
  if (clip.file) {
    const buf = await clip.file.arrayBuffer();
    return new Uint8Array(buf);
  }
  const res = await fetch(clip.url);
  if (!res.ok) throw new Error(`Failed to fetch clip ${clip.name}: ${res.status}`);
  const buf = await res.arrayBuffer();
  return new Uint8Array(buf);
}

function buildScaleCropFilter(w: number, h: number): string {
  // Scale to cover, then center-crop to exact target dimensions. This
  // matches the shorts-formatter pattern but parameterized per preset.
  // setsar=1 fixes any non-square pixel aspect.
  return [
    `scale=w='if(gt(a,${w}/${h}),-2,${w})':h='if(gt(a,${w}/${h}),${h},-2)'`,
    `crop=${w}:${h}`,
    "setsar=1",
  ].join(",");
}

function clamp01(v: number): number {
  if (!isFinite(v)) return 1;
  if (v < 0) return 0;
  if (v > 1) return 1;
  return v;
}

// ─── ASS subtitle builder ───
// We emit a minimal but well-formed ASS so the FFmpeg `subtitles` filter
// burns clean styled text. Default style is white, bold, drop shadow,
// bottom-centered — same look as the preview overlay.

function buildAssFile(cues: CaptionCue[], width: number, height: number): string {
  const header =
    `[Script Info]\n` +
    `ScriptType: v4.00+\n` +
    `PlayResX: ${width}\n` +
    `PlayResY: ${height}\n` +
    `ScaledBorderAndShadow: yes\n` +
    `\n` +
    `[V4+ Styles]\n` +
    `Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\n` +
    // Sizing: ~3.5% of frame height feels right at 1080p verticals.
    `Style: Default,Arial,${Math.round(height * 0.038)},&H00FFFFFF,&H00FFFFFF,&H00000000,&H64000000,1,0,0,0,100,100,0,0,1,3,2,2,80,80,${Math.round(height * 0.08)},1\n` +
    `\n` +
    `[Events]\n` +
    `Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n`;

  const lines = cues.map((c) => {
    const start = toAssTimecode(c.startSec);
    const end = toAssTimecode(c.endSec);
    const text = c.text
      .replace(/\\/g, "\\\\")
      .replace(/\r?\n/g, "\\N")
      .replace(/\{/g, "\\{")
      .replace(/\}/g, "\\}");
    return `Dialogue: 0,${start},${end},Default,,0,0,0,,${text}`;
  });

  return header + lines.join("\n") + "\n";
}

function toAssTimecode(sec: number): string {
  if (!isFinite(sec) || sec < 0) sec = 0;
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec - h * 3600) / 60);
  const s = sec - h * 3600 - m * 60;
  const cs = Math.floor((s - Math.floor(s)) * 100);
  return `${h}:${String(m).padStart(2, "0")}:${String(Math.floor(s)).padStart(2, "0")}.${String(cs).padStart(2, "0")}`;
}
