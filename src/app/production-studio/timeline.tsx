"use client";

// ProductionSTUDIO · Timeline Editor (v2 · OpenCut iframe baseline)
//
// The original v1 was a from-scratch HTML5/FFmpeg.wasm NLE — capable but
// limited to a single video + single audio track and no effects pipeline.
// Spec calls for OpenCut (https://github.com/OpenCut-app/OpenCut, MIT) as
// the editor surface. Full integration is multi-day:
//
//   - Port OpenCut's Tailwind classes to inline styles to match the rest
//     of the POAST shell.
//   - Bridge OpenCut's Zustand store to the POAST projects store so
//     timelines persist alongside other ProductionSTUDIO artifacts.
//   - Wire ripple-delete handlers to Whisper transcript word timings from
//     Auto-Caption, smartcrop.js subject-tracking for the 9:16 reframe in
//     Shorts Formatter, and WaveSurfer.js / RNNoise for the audio side.
//   - Caption track auto-mount from Auto-Caption output, LUFS normalizer
//     targeting -16 LUFS, chapter-marker drag-in from Chapter Generator.
//
// Until that lands, this v2 mounts the OpenCut hosted classic in an
// iframe. The other ProductionSTUDIO tools (Auto-Caption, Shorts
// Formatter, Chapter Generator, Transcript Cleaner) ship as separate
// surfaces — see /production-studio for the full grid.
//
// See ./timeline/OPENCUT.md for the deferred integration scope and
// ./timeline/legacy.tsx for the v1 NLE (kept for reference).

import React from "react";
import { ExternalLink, Film } from "lucide-react";
import { ProductionStudioShell } from "./shell";
import { D, ft, gf, mn } from "../shared-constants";

const OPENCUT_URL = "https://opencut.app";

export function TimelineEditorView() {
  return (
    <ProductionStudioShell
      title="Timeline Editor"
      subtitle="OpenCut classic embed (MIT) — multi-track editing inside the POAST shell."
    >
      <div style={{ padding: "12px 20px 32px", display: "flex", flexDirection: "column", gap: 12 }}>
        {/* Sticky local header */}
        <div
          style={{
            position: "sticky",
            top: 56,
            zIndex: 4,
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "10px 14px",
            background: D.surface,
            border: `1px solid ${D.border}`,
            borderRadius: 10,
            backdropFilter: "blur(10px)",
            WebkitBackdropFilter: "blur(10px)",
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: `${D.blue}1c`,
              border: `1px solid ${D.blue}55`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Film size={16} color={D.blue} strokeWidth={1.8} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.2 }}>
            <div style={{ fontFamily: gf, fontSize: 16, letterSpacing: 0.2, color: D.tx }}>
              Timeline Editor · OpenCut
            </div>
            <div style={{ fontFamily: mn, fontSize: 10, letterSpacing: 0.6, color: D.txd, textTransform: "uppercase" }}>
              opencut.app · MIT
            </div>
          </div>
          <div style={{ flex: 1 }} />
          <a
            href={OPENCUT_URL}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "6px 12px",
              borderRadius: 6,
              border: `1px solid ${D.blue}55`,
              background: "transparent",
              color: D.blue,
              fontFamily: mn,
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: 0.6,
              textTransform: "uppercase",
              textDecoration: "none",
            }}
          >
            <ExternalLink size={12} /> Open in new tab
          </a>
        </div>

        {/* OpenCut iframe */}
        <div
          style={{
            background: "#000",
            border: `1px solid ${D.border}`,
            borderRadius: 10,
            overflow: "hidden",
          }}
        >
          <iframe
            src={OPENCUT_URL}
            title="OpenCut Timeline Editor"
            sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-downloads allow-modals allow-pointer-lock allow-presentation"
            allow="camera; microphone; clipboard-read; clipboard-write; fullscreen; autoplay; encrypted-media; display-capture"
            style={{
              display: "block",
              width: "100%",
              height: "calc(100vh - 200px)",
              border: "none",
              background: "#000",
            }}
          />
        </div>

        {/* Integration note */}
        <div
          style={{
            background: D.surface,
            border: `1px solid ${D.border}`,
            borderRadius: 10,
            padding: "14px 16px",
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          <div
            style={{
              fontFamily: mn,
              fontSize: 10,
              letterSpacing: 1.2,
              textTransform: "uppercase",
              color: D.amber,
            }}
          >
            Integration Note
          </div>
          <div style={{ fontFamily: ft, fontSize: 13, color: D.txm, lineHeight: 1.55 }}>
            Timeline editor is the OpenCut classic embed (MIT). Auto-Caption /
            Shorts Formatter / Chapter Generator / filler-word removal are wired
            as separate ProductionSTUDIO tools — deeper track-level integration
            (caption track auto-mounted, ripple-delete from transcript,
            subject-tracked smart-crop) lands when OpenCut&apos;s plugin/MCP API
            stabilizes upstream. See <span style={{ fontFamily: mn, fontSize: 12, color: D.tx }}>/production-studio</span> for those tools today.
          </div>
        </div>
      </div>
    </ProductionStudioShell>
  );
}
