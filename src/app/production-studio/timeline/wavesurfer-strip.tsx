"use client";

// ProductionSTUDIO · Timeline waveform strip.
//
// Renders a pre-computed peaks array as a WaveSurfer.js waveform inside
// a clip's body on the timeline. The strip is a "display only" view —
// it doesn't decode audio, never plays back, and never owns a media
// element. The peaks come from extractWaveform() in waveform-utils.ts.
//
// The wavesurfer instance is created with a single, in-memory pseudo
// data source so it can render `peaks` directly without loading a URL.

import React, { useEffect, useRef } from "react";
import WaveSurfer from "wavesurfer.js";
import { D } from "../../shared-constants";

interface WavesurferStripProps {
  /** Pre-computed amplitude envelope (0..1). 1000 samples preferred. */
  peaks: number[];
  /** Total duration of the underlying clip, in seconds. */
  durationSec: number;
  /** Height of the rendered strip in CSS pixels. Default 36. */
  height?: number;
  /** Foreground waveform color. Default the amber accent at ~85%. */
  color?: string;
  /** Background color of the surface behind the waveform. */
  backgroundColor?: string;
  /** Optional override for the cursor color — set to "transparent" to hide. */
  cursorColor?: string;
}

export default function WavesurferStrip(props: WavesurferStripProps) {
  const {
    peaks,
    durationSec,
    height = 36,
    color = `${D.amber}d8`,
    backgroundColor = "transparent",
    cursorColor = "transparent",
  } = props;

  const containerRef = useRef<HTMLDivElement | null>(null);
  const wsRef = useRef<WaveSurfer | null>(null);

  // Latest props bag — keeps the wavesurfer instance stable across
  // renders that only change cosmetic props.
  const styleRef = useRef({ color, backgroundColor, cursorColor, height });
  styleRef.current = { color, backgroundColor, cursorColor, height };

  useEffect(() => {
    if (!containerRef.current) return;
    const ws = WaveSurfer.create({
      container: containerRef.current,
      waveColor: styleRef.current.color,
      progressColor: styleRef.current.color,
      cursorColor: styleRef.current.cursorColor,
      height: styleRef.current.height,
      barWidth: 1,
      barGap: 1,
      barRadius: 1,
      normalize: true,
      interact: false,
      // We feed peaks directly via the load() API.
    });
    wsRef.current = ws;

    return () => {
      try {
        ws.destroy();
      } catch {}
      wsRef.current = null;
    };
    // Recreate only on height change — color/bg updates are applied
    // inline below without tearing down.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [height]);

  // Push peaks into wavesurfer. The library accepts `(url|"", peaks,
  // duration)` — passing an empty string avoids any network fetch.
  useEffect(() => {
    const ws = wsRef.current;
    if (!ws) return;
    if (!peaks || peaks.length === 0 || durationSec <= 0) return;
    try {
      // load() signature accepts (url, peaks?, duration?)
      ws.load("", [peaks], durationSec).catch(() => {
        // Non-fatal — strip just stays blank.
      });
    } catch {
      // Ignore; surface will simply be empty.
    }
  }, [peaks, durationSec]);

  // Apply cosmetic color updates without re-creating the instance.
  useEffect(() => {
    const ws = wsRef.current;
    if (!ws) return;
    try {
      ws.setOptions({
        waveColor: color,
        progressColor: color,
        cursorColor,
      });
    } catch {
      // setOptions may not exist on older builds — strip then stays
      // with its initial colors.
    }
  }, [color, cursorColor]);

  return (
    <div
      ref={containerRef}
      style={{
        width: "100%",
        height,
        background: backgroundColor,
        pointerEvents: "none",
        // The library mounts an absolutely-positioned canvas; the parent
        // surface needs to clip it cleanly.
        overflow: "hidden",
      }}
    />
  );
}
