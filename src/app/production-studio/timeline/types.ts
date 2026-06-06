// ProductionSTUDIO · Timeline shared types.
//
// Every module in /production-studio/timeline (preview-pane, waveform-utils,
// export-pipeline, wavesurfer-strip, editor-shell-tracks…) is built around
// the Project shape defined here. The contract is intentionally narrow —
// the editor-shell-tracks task fills in tooling on top of it, but the
// preview + export + waveform paths consume only what's in this file.

export type FramePreset = "tiktok" | "reels" | "shorts" | "square" | "landscape";

export interface FrameSize {
  width: number;
  height: number;
}

// Canonical preset dimensions. Imported by preview-pane (for the frame
// box), export-pipeline (for ffmpeg scale/crop), and any future thumb-
// renderer that needs to lay out at output resolution.
export const PRESET_FRAMES: Record<FramePreset, FrameSize> = {
  tiktok: { width: 1080, height: 1920 },
  reels: { width: 1080, height: 1920 },
  shorts: { width: 1080, height: 1920 },
  square: { width: 1080, height: 1080 },
  landscape: { width: 1920, height: 1080 },
};

export type ClipKind = "video" | "audio" | "image";

export interface MediaClip {
  id: string;
  name: string;
  kind: ClipKind;
  // Object URL for in-browser playback. The export pipeline also reads
  // `file` (if present) for ffmpeg ingestion — when only `url` is set we
  // fetch + arrayBuffer it during export.
  url: string;
  file?: File;
  durationSec: number;
  // Optional — cached by waveform-utils so the strip + UI can paint
  // immediately on revisit. Audio + (audio of) video clips both qualify.
  peaks?: number[];
}

export type TrackKind = "video" | "audio" | "caption" | "overlay";

export interface TimelinePlacement {
  id: string;
  clipId: string;
  // Where the clip starts on the master timeline.
  startSec: number;
  // Visible length on the timeline (after trim).
  durationSec: number;
  // Offset into the source clip.
  trimStartSec: number;
  // Per-clip mute / solo / volume — audio-only.
  volume?: number;   // 0..1, default 1
  muted?: boolean;
}

export interface CaptionCue {
  id: string;
  startSec: number;
  endSec: number;
  text: string;
}

export interface TimelineTrack {
  id: string;
  kind: TrackKind;
  // Display label ("V1", "A1", "Captions", "B-Roll"…).
  label: string;
  placements: TimelinePlacement[];
  // Caption tracks store cues directly — they don't reference media clips.
  captions?: CaptionCue[];
  muted?: boolean;
  hidden?: boolean;
}

export interface Project {
  id: string;
  title: string;
  preset: FramePreset;
  // Master timeline duration in seconds. Optional — when undefined the
  // consumers compute it from the placements.
  durationSec?: number;
  // Media bin (clips imported but not necessarily placed).
  mediaBin: MediaClip[];
  tracks: TimelineTrack[];
  // Free-form metadata bag for other tools (caption style, chapter list,
  // B-Roll suggestions…). Untyped on purpose so this file stays stable.
  meta?: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
}

// ─── Helpers shared across the modules below ───

export function frameOf(project: Project): FrameSize {
  return PRESET_FRAMES[project.preset];
}

export function projectDuration(project: Project): number {
  if (typeof project.durationSec === "number" && project.durationSec > 0) {
    return project.durationSec;
  }
  let end = 0;
  for (const track of project.tracks) {
    for (const p of track.placements) {
      const tail = p.startSec + p.durationSec;
      if (tail > end) end = tail;
    }
    if (track.captions) {
      for (const c of track.captions) {
        if (c.endSec > end) end = c.endSec;
      }
    }
  }
  return end;
}

export function findClip(project: Project, clipId: string): MediaClip | undefined {
  return project.mediaBin.find((c) => c.id === clipId);
}

// Placements active at a given timeline second. Used by the preview pane
// to mount the right <video> element + caption overlay each frame.
export function placementsAt(track: TimelineTrack, sec: number): TimelinePlacement[] {
  const out: TimelinePlacement[] = [];
  for (const p of track.placements) {
    if (sec >= p.startSec && sec < p.startSec + p.durationSec) out.push(p);
  }
  return out;
}

export function captionsAt(track: TimelineTrack, sec: number): CaptionCue[] {
  if (!track.captions) return [];
  return track.captions.filter((c) => sec >= c.startSec && sec < c.endSec);
}
