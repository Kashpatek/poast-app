"use client";

// Wavesurfer.js host. Kept in its own file so `next/dynamic` can pull
// it in browser-only — the Wavesurfer module touches `window` at import.

import React, { useEffect, useRef } from "react";
import WaveSurfer from "wavesurfer.js";
import RegionsPlugin, { type Region } from "wavesurfer.js/dist/plugins/regions.esm.js";
import { D } from "../shared-constants";

interface WaveformPanelProps {
  blob: Blob;
  onReady: (api: { play: () => void; pause: () => void; stop: () => void; duration: number }) => void;
  onTimeUpdate: (t: number) => void;
  onPlay: () => void;
  onPause: () => void;
  onRegionChange: (start: number | null, end: number | null) => void;
}

export default function WaveformPanel(props: WaveformPanelProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const wsRef = useRef<WaveSurfer | null>(null);
  const regionsRef = useRef<RegionsPlugin | null>(null);
  const activeRegionRef = useRef<Region | null>(null);
  // Stash the latest callbacks so the effect deps stay stable and we
  // don't tear down the wavesurfer instance on every parent rerender.
  const cbRef = useRef(props);
  cbRef.current = props;

  useEffect(() => {
    if (!containerRef.current) return;
    const regions = RegionsPlugin.create();
    const ws = WaveSurfer.create({
      container: containerRef.current,
      waveColor: "#3a3540",
      progressColor: D.violet,
      cursorColor: D.amber,
      height: 120,
      barWidth: 2,
      barGap: 1,
      barRadius: 1,
      normalize: true,
      plugins: [regions],
    });
    wsRef.current = ws;
    regionsRef.current = regions;

    ws.loadBlob(props.blob).catch(() => {
      // Surface a soft failure — the parent will see no duration / no ready.
    });

    ws.on("ready", () => {
      const duration = ws.getDuration();
      cbRef.current.onReady({
        play: () => void ws.play(),
        pause: () => ws.pause(),
        stop: () => ws.stop(),
        duration,
      });
      // Enable drag-to-select once data is decoded.
      regions.enableDragSelection({
        color: "rgba(144, 92, 203, 0.22)",
      });
    });

    ws.on("timeupdate", (t: number) => cbRef.current.onTimeUpdate(t));
    ws.on("play", () => cbRef.current.onPlay());
    ws.on("pause", () => cbRef.current.onPause());
    ws.on("finish", () => cbRef.current.onPause());

    regions.on("region-created", (r: Region) => {
      // Only one selection at a time; remove any prior region.
      const prior = activeRegionRef.current;
      if (prior && prior !== r) prior.remove();
      activeRegionRef.current = r;
      cbRef.current.onRegionChange(r.start, r.end);
    });
    regions.on("region-updated", (r: Region) => {
      activeRegionRef.current = r;
      cbRef.current.onRegionChange(r.start, r.end);
    });
    regions.on("region-removed", (r: Region) => {
      if (activeRegionRef.current === r) {
        activeRegionRef.current = null;
        cbRef.current.onRegionChange(null, null);
      }
    });

    return () => {
      try {
        ws.destroy();
      } catch {}
      wsRef.current = null;
      regionsRef.current = null;
      activeRegionRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.blob]);

  return <div ref={containerRef} style={{ width: "100%" }} />;
}
