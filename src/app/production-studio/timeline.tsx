"use client";

// ProductionSTUDIO · Timeline Workspace (v4 · Native NLE)
//
// v1 was a from-scratch FFmpeg.wasm NLE (preserved at ./timeline/legacy.tsx).
// v2 embedded https://opencut.app in an iframe.
// v3 wrapped that iframe with a Workspace panel + /api/opencut/* hand-off.
//
// v4 (this file) ships POAST's own native timeline editor. The OpenCut
// iframe is gone — upstream became a placeholder, so we no longer proxy
// it. The legacy v1 NLE at ./timeline/legacy.tsx is the structural
// foundation (single video + single audio track, drag clips, trim,
// FFmpeg concat); the new editor extends that into a multi-track
// surface with an AI Drop panel that consumes /api/opencut/* directly.
//
// Layout:
//   ┌─────────────────────────────────────────────────────────┐
//   │  AI Drop Panel  │              Preview Pane             │
//   │   (transcript    │                                       │
//   │   + 4 actions    │                                       │
//   │   + drop into    │                                       │
//   │   tracks)        │                                       │
//   │                  ├───────────────────────────────────────┤
//   │                  │            Timeline Editor            │
//   │                  │  (multi-track, drag clips, captions,  │
//   │                  │   chapters, B-roll, ripple cuts)      │
//   └─────────────────────────────────────────────────────────┘

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ProductionStudioShell } from "./shell";
import { D, ft, mn, uid } from "../shared-constants";
import { saveProject, getProject } from "../design-studio/projects-store";
import type { ProjectRecord } from "../design-studio/projects-store";
import { TimelineEditor } from "./timeline/editor";
import PreviewPane from "./timeline/preview-pane";
import { AiDropPanel } from "./timeline/ai-drop-panel";
import type {
  CaptionClip,
  ChapterMarker,
  FillerMarker,
  BrollSuggestion,
} from "./timeline/ai-drop-panel";
import type {
  Project,
  TimelineTrack,
  CaptionCue,
} from "./timeline/types";

const TIMELINE_PROJECT_ID = "poast-production-timeline-default";
const TIMELINE_PROJECT_TITLE = "Production Timeline";

function emptyProject(): Project {
  const now = Date.now();
  return {
    id: TIMELINE_PROJECT_ID,
    title: TIMELINE_PROJECT_TITLE,
    preset: "landscape",
    mediaBin: [],
    tracks: [],
    meta: {},
    createdAt: now,
    updatedAt: now,
  };
}

export function TimelineEditorView() {
  const [project, setProject] = useState<Project>(() => emptyProject());
  const [loaded, setLoaded] = useState(false);
  // Which project to load/persist. Defaults to the standing production timeline;
  // a `?project=<id>` param (the Clip Engine handoff) opens that project instead.
  const [projectId, setProjectId] = useState(TIMELINE_PROJECT_ID);
  const [playheadSec, setPlayheadSec] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  // Hydrate from projects-store (kind:"motion") on mount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const pid =
          (typeof window !== "undefined" &&
            new URLSearchParams(window.location.search).get("project")) ||
          TIMELINE_PROJECT_ID;
        setProjectId(pid);
        const row = await getProject(pid);
        if (cancelled) return;
        if (row && row.pages && row.pages[0]) {
          const payload = row.pages[0].payload as Project | undefined;
          if (payload && typeof payload === "object" && Array.isArray(payload.tracks)) {
            setProject(payload);
          }
        }
      } catch {
        // fail-quiet — start with empty editor
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Debounced persistence — projects-store has its own remote sync.
  useEffect(() => {
    if (!loaded) return;
    const handle = window.setTimeout(() => {
      const record: Partial<ProjectRecord> & {
        id: string;
        title: string;
        kind: "motion";
        pages: ProjectRecord["pages"];
      } = {
        id: projectId,
        title: project.title || TIMELINE_PROJECT_TITLE,
        kind: "motion",
        pages: [{ id: uid("page"), payload: project }],
      };
      saveProject(record).catch(() => {
        // fail-quiet
      });
    }, 400);
    return () => window.clearTimeout(handle);
  }, [project, loaded, projectId]);

  // ─── AiDropPanel callbacks: mutate the Project shape directly ────────

  const handleAddCaptions = useCallback((captions: CaptionClip[]) => {
    setProject((prev) => {
      const cues: CaptionCue[] = captions.map((c) => ({
        id: c.id,
        startSec: c.start,
        endSec: c.end,
        text: c.text,
      }));
      const tracks = stripTracksByKind(prev.tracks, "caption");
      const captionTrack: TimelineTrack = {
        id: uid("track-captions"),
        kind: "caption",
        label: "Captions",
        placements: [],
        captions: cues,
      };
      return { ...prev, tracks: [...tracks, captionTrack], updatedAt: Date.now() };
    });
  }, []);

  const handleAddChapters = useCallback((chapters: ChapterMarker[]) => {
    setProject((prev) => ({
      ...prev,
      meta: { ...(prev.meta || {}), chapters },
      updatedAt: Date.now(),
    }));
  }, []);

  const handleAddFillerMarkers = useCallback((fillers: FillerMarker[]) => {
    setProject((prev) => ({
      ...prev,
      meta: { ...(prev.meta || {}), fillerMarkers: fillers },
      updatedAt: Date.now(),
    }));
  }, []);

  const handleAddBrollSuggestions = useCallback((suggestions: BrollSuggestion[]) => {
    setProject((prev) => ({
      ...prev,
      meta: { ...(prev.meta || {}), brollSuggestions: suggestions },
      updatedAt: Date.now(),
    }));
  }, []);

  const handlePlayToggle = useCallback(() => setIsPlaying((v) => !v), []);

  const subtitle = useMemo(
    () => "Native multi-track editor with AI-powered captions, chapters, ripple cuts, and B-roll.",
    [],
  );

  return (
    <ProductionStudioShell title="Timeline Editor" subtitle={subtitle}>
      <EditorWrapper
        project={project}
        onProjectChange={setProject}
        playheadSec={playheadSec}
        onPlayheadChange={setPlayheadSec}
        isPlaying={isPlaying}
        onPlayToggle={handlePlayToggle}
        onAddCaptions={handleAddCaptions}
        onAddChapters={handleAddChapters}
        onAddFillerMarkers={handleAddFillerMarkers}
        onAddBrollSuggestions={handleAddBrollSuggestions}
        loaded={loaded}
      />
    </ProductionStudioShell>
  );
}

function stripTracksByKind(tracks: TimelineTrack[], kind: TimelineTrack["kind"]): TimelineTrack[] {
  return tracks.filter((t) => t.kind !== kind);
}

interface EditorWrapperProps {
  project: Project;
  onProjectChange: (next: Project) => void;
  playheadSec: number;
  onPlayheadChange: (s: number) => void;
  isPlaying: boolean;
  onPlayToggle: () => void;
  onAddCaptions: (captions: CaptionClip[]) => void;
  onAddChapters: (chapters: ChapterMarker[]) => void;
  onAddFillerMarkers: (fillers: FillerMarker[]) => void;
  onAddBrollSuggestions: (suggestions: BrollSuggestion[]) => void;
  loaded: boolean;
}

function EditorWrapper(props: EditorWrapperProps) {
  if (!props.loaded) {
    return (
      <div
        style={{
          padding: "32px 24px",
          fontFamily: mn,
          fontSize: 12,
          color: D.txd,
          letterSpacing: 0.6,
        }}
      >
        Loading project…
      </div>
    );
  }

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(280px, 360px) minmax(0, 1fr)",
        gridTemplateRows: "minmax(0, 1fr) minmax(0, 1fr)",
        gridTemplateAreas: '"aside preview" "aside timeline"',
        gap: 12,
        padding: "12px 20px 32px",
        minHeight: "calc(100vh - 140px)",
        fontFamily: ft,
      }}
    >
      <div style={{ gridArea: "aside", minHeight: 0 }}>
        <AiDropPanel
          onAddCaptions={props.onAddCaptions}
          onAddChapters={props.onAddChapters}
          onAddFillerMarkers={props.onAddFillerMarkers}
          onAddBrollSuggestions={props.onAddBrollSuggestions}
        />
      </div>
      <div style={{ gridArea: "preview", minHeight: 0 }}>
        <PreviewPane
          project={props.project}
          playheadSec={props.playheadSec}
          onPlayheadChange={props.onPlayheadChange}
          isPlaying={props.isPlaying}
          onPlayToggle={props.onPlayToggle}
        />
      </div>
      <div style={{ gridArea: "timeline", minHeight: 0 }}>
        <TimelineEditor
          project={props.project}
          onProjectChange={props.onProjectChange}
          playheadSec={props.playheadSec}
          onPlayheadChange={props.onPlayheadChange}
          isPlaying={props.isPlaying}
          onPlayToggle={props.onPlayToggle}
        />
      </div>
    </div>
  );
}
