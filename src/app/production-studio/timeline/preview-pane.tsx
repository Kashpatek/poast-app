"use client";

// ProductionSTUDIO · Timeline preview pane.
//
// Composites the active video/image clips inside the project's frame at
// the current playhead, draws caption overlays on top, and drives a
// rAF playback loop. The pane is a controlled component — playhead +
// play state live in the editor shell; this file just paints + emits.
//
// Active-clip swap strategy: we mount one <video> element per video
// placement that's currently on the timeline so the browser can keep
// each clip warm. The non-active ones are display:none + paused.

import React, { useCallback, useEffect, useMemo, useRef } from "react";
import { D, ft, mn } from "../../shared-constants";
import {
  type Project,
  type TimelinePlacement,
  type MediaClip,
  type CaptionCue,
  type FrameSize,
  captionsAt,
  findClip,
  frameOf,
  placementsAt,
  projectDuration,
} from "./types";

interface PreviewPaneProps {
  project: Project;
  playheadSec: number;
  onPlayheadChange: (s: number) => void;
  isPlaying: boolean;
  onPlayToggle: () => void;
}

// ─── Layout math ───
// The preview frame is rendered at "fit" inside its container — the
// largest box that preserves the preset aspect ratio. We don't lock to
// the pixel resolution because 1080×1920 won't fit any sane viewport.
function fitFrame(frame: FrameSize, container: { w: number; h: number }): {
  w: number;
  h: number;
} {
  if (container.w <= 0 || container.h <= 0) return { w: frame.width, h: frame.height };
  const scale = Math.min(container.w / frame.width, container.h / frame.height);
  return { w: Math.round(frame.width * scale), h: Math.round(frame.height * scale) };
}

function formatTimecode(sec: number): string {
  if (!isFinite(sec) || sec < 0) sec = 0;
  const m = Math.floor(sec / 60);
  const s = sec - m * 60;
  return `${String(m).padStart(2, "0")}:${s.toFixed(1).padStart(4, "0")}`;
}

export default function PreviewPane(props: PreviewPaneProps) {
  const { project, playheadSec, onPlayheadChange, isPlaying, onPlayToggle } = props;

  const containerRef = useRef<HTMLDivElement | null>(null);
  const frameRef = useRef<HTMLDivElement | null>(null);
  // Map<placementId, HTMLVideoElement> so we can imperatively seek when
  // the playhead jumps and the active clip changes.
  const videoElsRef = useRef<Map<string, HTMLVideoElement>>(new Map());
  // Container size tracked for fit calc — re-rendered on ResizeObserver.
  const [boxSize, setBoxSize] = React.useState<{ w: number; h: number }>({ w: 0, h: 0 });

  const totalDuration = useMemo(() => projectDuration(project) || 10, [project]);
  const frame = useMemo(() => frameOf(project), [project]);
  const fit = useMemo(() => fitFrame(frame, boxSize), [frame, boxSize]);

  // ─── Active media + captions at the current playhead ───
  // Multiple video tracks may be visible; we composite top-down (later
  // tracks paint over earlier ones). Images are treated the same.
  const activeVideo = useMemo(() => {
    const out: Array<{ track: number; placement: TimelinePlacement; clip: MediaClip }> = [];
    project.tracks.forEach((track, idx) => {
      if (track.hidden || (track.kind !== "video" && track.kind !== "overlay")) return;
      for (const p of placementsAt(track, playheadSec)) {
        const clip = findClip(project, p.clipId);
        if (!clip || clip.kind === "audio") continue;
        out.push({ track: idx, placement: p, clip });
      }
    });
    return out;
  }, [project, playheadSec]);

  const activeAudio = useMemo(() => {
    const out: Array<{ placement: TimelinePlacement; clip: MediaClip; trackMuted: boolean }> = [];
    for (const track of project.tracks) {
      if (track.kind !== "audio" && track.kind !== "video") continue;
      for (const p of placementsAt(track, playheadSec)) {
        const clip = findClip(project, p.clipId);
        if (!clip) continue;
        // Video clips contribute audio too unless track is muted.
        out.push({ placement: p, clip, trackMuted: !!track.muted });
      }
    }
    return out;
  }, [project, playheadSec]);

  const activeCaptions = useMemo(() => {
    const out: CaptionCue[] = [];
    for (const track of project.tracks) {
      if (track.kind !== "caption" || track.hidden) continue;
      out.push(...captionsAt(track, playheadSec));
    }
    return out;
  }, [project, playheadSec]);

  // ─── Container resize ───
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      const r = el.getBoundingClientRect();
      setBoxSize({ w: r.width, h: r.height });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ─── Sync <video> elements to playhead ───
  // For every active video placement, seek the <video> to the right
  // offset into the source and (un)pause it. The browser's seek is
  // async so we issue + forget; the next rAF frame catches any drift.
  useEffect(() => {
    const els = videoElsRef.current;
    const activeIds = new Set(activeVideo.map((a) => a.placement.id));

    // Pause non-active.
    els.forEach((el, id) => {
      if (!activeIds.has(id)) {
        try {
          el.pause();
        } catch {}
      }
    });

    for (const { placement, clip } of activeVideo) {
      const el = els.get(placement.id);
      if (!el) continue;
      if (clip.kind !== "video") continue;
      const target = (playheadSec - placement.startSec) + placement.trimStartSec;
      // Don't fight the browser if we're already close (drift < 100ms).
      if (Math.abs(el.currentTime - target) > 0.12) {
        try {
          el.currentTime = Math.max(0, Math.min(target, el.duration || target));
        } catch {}
      }
      if (isPlaying) {
        if (el.paused) {
          el.play().catch(() => {});
        }
      } else if (!el.paused) {
        el.pause();
      }
    }
  }, [activeVideo, playheadSec, isPlaying]);

  // ─── Sync audio playback ───
  // We rely on <video> elements (muted=false on the dominant audio
  // track only — same logic as the video sync). For the v1 we let every
  // active video clip's own audio play, which matches the iframe-free
  // legacy behavior. Per-track mute respected.
  useEffect(() => {
    const els = videoElsRef.current;
    for (const { placement, trackMuted } of activeAudio) {
      const el = els.get(placement.id);
      if (!el) continue;
      const vol = placement.volume ?? 1;
      el.volume = Math.max(0, Math.min(1, vol));
      el.muted = !!(placement.muted || trackMuted);
    }
  }, [activeAudio]);

  // ─── rAF playback loop ───
  // 30fps virtual clock: increment playhead by (now - lastTick) so we
  // stay accurate even if the browser throttles us. Loop self-stops
  // when the playhead passes the project end.
  const rafRef = useRef<number | null>(null);
  const lastTickRef = useRef<number>(0);
  // We need the freshest props inside the loop without re-binding the
  // rAF cycle every render.
  const stateRef = useRef({
    isPlaying,
    playheadSec,
    totalDuration,
    onPlayheadChange,
    onPlayToggle,
  });
  stateRef.current = { isPlaying, playheadSec, totalDuration, onPlayheadChange, onPlayToggle };

  useEffect(() => {
    if (!isPlaying) {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      return;
    }
    lastTickRef.current = performance.now();
    const tick = (now: number) => {
      const dt = (now - lastTickRef.current) / 1000;
      lastTickRef.current = now;
      const s = stateRef.current;
      const next = s.playheadSec + dt;
      if (next >= s.totalDuration) {
        s.onPlayheadChange(s.totalDuration);
        s.onPlayToggle(); // stop at end
        return;
      }
      s.onPlayheadChange(next);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [isPlaying]);

  // ─── Transport handlers ───
  const seekTo = useCallback(
    (s: number) => {
      onPlayheadChange(Math.max(0, Math.min(totalDuration, s)));
    },
    [onPlayheadChange, totalDuration],
  );

  // ─── Rendering ───
  // Frame "canvas" composites video clips at output-space pixels then
  // scales the whole frame down via CSS transform for the viewport.
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 12,
        background: D.card,
        border: `1px solid ${D.border}`,
        borderRadius: 12,
        padding: 14,
        height: "100%",
        minHeight: 0,
        boxSizing: "border-box",
      }}
    >
      <div
        ref={containerRef}
        style={{
          flex: 1,
          minHeight: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#000",
          borderRadius: 10,
          overflow: "hidden",
          position: "relative",
        }}
      >
        <div
          ref={frameRef}
          style={{
            position: "relative",
            width: fit.w,
            height: fit.h,
            background: "#000",
            overflow: "hidden",
          }}
        >
          {/* Mount one <video> per active video placement. */}
          {activeVideo.map(({ placement, clip }) => (
            <video
              key={placement.id}
              ref={(el) => {
                if (el) videoElsRef.current.set(placement.id, el);
                else videoElsRef.current.delete(placement.id);
              }}
              src={clip.url}
              playsInline
              preload="auto"
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                objectFit: "cover",
                pointerEvents: "none",
              }}
            />
          ))}

          {/* Image overlays (kind: image). */}
          {project.tracks
            .filter((t) => !t.hidden && (t.kind === "video" || t.kind === "overlay"))
            .flatMap((t) => placementsAt(t, playheadSec).map((p) => ({ p, t })))
            .map(({ p }) => {
              const clip = findClip(project, p.clipId);
              if (!clip || clip.kind !== "image") return null;
              return (
                <img
                  key={p.id}
                  src={clip.url}
                  alt=""
                  draggable={false}
                  style={{
                    position: "absolute",
                    inset: 0,
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    pointerEvents: "none",
                  }}
                />
              );
            })}

          {/* Empty-state placeholder. */}
          {activeVideo.length === 0 && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: D.txd,
                fontFamily: mn,
                fontSize: 11,
                letterSpacing: 1.2,
                textTransform: "uppercase",
              }}
            >
              No active clip
            </div>
          )}

          {/* Caption overlay — stacked bottom-center, 1 line per cue. */}
          {activeCaptions.length > 0 && (
            <div
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                bottom: Math.max(24, fit.h * 0.08),
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 6,
                padding: "0 8%",
                pointerEvents: "none",
              }}
            >
              {activeCaptions.map((c) => (
                <div
                  key={c.id}
                  style={{
                    fontFamily: ft,
                    fontWeight: 800,
                    fontSize: Math.max(14, fit.h * 0.028),
                    color: "#fff",
                    textShadow: "0 2px 8px rgba(0,0,0,0.85), 0 0 2px rgba(0,0,0,0.95)",
                    background: "rgba(0,0,0,0.42)",
                    padding: "4px 10px",
                    borderRadius: 6,
                    maxWidth: "100%",
                    textAlign: "center",
                    lineHeight: 1.2,
                  }}
                >
                  {c.text}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Transport */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "4px 2px 0",
        }}
      >
        <TransportBtn label="⏮" title="Rewind to start" onClick={() => seekTo(0)} />
        <TransportBtn label="⏪" title="Back 5s" onClick={() => seekTo(playheadSec - 5)} />
        <TransportBtn
          label={isPlaying ? "⏸" : "▶"}
          title={isPlaying ? "Pause" : "Play"}
          onClick={onPlayToggle}
          accent
        />
        <TransportBtn label="⏩" title="Forward 5s" onClick={() => seekTo(playheadSec + 5)} />
        <TransportBtn label="⏭" title="Skip to end" onClick={() => seekTo(totalDuration)} />
        <div
          style={{
            marginLeft: "auto",
            fontFamily: mn,
            fontSize: 12,
            color: D.tx,
            letterSpacing: 0.5,
          }}
        >
          <span style={{ color: D.amber }}>{formatTimecode(playheadSec)}</span>
          <span style={{ color: D.txd }}> / </span>
          <span>{formatTimecode(totalDuration)}</span>
        </div>
      </div>
    </div>
  );
}

// ─── Small subcomponents ───

function TransportBtn(props: {
  label: string;
  title: string;
  onClick: () => void;
  accent?: boolean;
}) {
  return (
    <button
      type="button"
      title={props.title}
      onClick={props.onClick}
      style={{
        width: 34,
        height: 30,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        background: props.accent ? `${D.amber}1f` : D.surface,
        border: `1px solid ${props.accent ? `${D.amber}66` : D.border}`,
        color: props.accent ? D.amber : D.tx,
        borderRadius: 6,
        fontFamily: mn,
        fontSize: 13,
        cursor: "pointer",
        padding: 0,
        lineHeight: 1,
      }}
    >
      {props.label}
    </button>
  );
}
