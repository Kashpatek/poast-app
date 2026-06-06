# Timeline Editor · Native NLE (post-OpenCut)

## Current state (v4 — native)

`/production-studio/timeline` now ships **POAST's own native timeline
editor**. OpenCut is **no longer integrated**: upstream's classic editor
became an empty placeholder, so we removed the iframe wrapper, the
`/embed/opencut/*` proxy rewrite, and the `dev:opencut` / `build:opencut`
sub-server scripts.

The previous v3 file (iframe + Workspace + clipboard hand-off) and the
original v1 NLE (FFmpeg.wasm + 1 video + 1 audio track) are both
preserved as references:

- `./legacy.tsx` — the structural foundation for the native editor
  (single video + single audio track, drag clips, trim, FFmpeg concat).
- Git history holds the v3 iframe wrapper.

## Architecture

```
src/app/production-studio/timeline.tsx     ← page wrapper, persistence, layout
src/app/production-studio/timeline/
  editor.tsx         ← multi-track editor (TimelineEditor + TimelineEditorApi)
  preview-pane.tsx   ← real-time preview surface (PreviewPane)
  ai-drop-panel.tsx  ← transcript + 4 AI actions + drop-into-track buttons
  legacy.tsx         ← v1 FFmpeg.wasm NLE (reference)
```

Persistence reuses `src/app/design-studio/projects-store.ts` with
`kind: "motion"` — the project is round-tripped through localForage
(IndexedDB) and fail-quiet sync'd to `/api/db`.

## AI endpoints (now consumed in-process)

The four `/api/opencut/*` endpoints still ship, but their consumer
changed: previously they fed a clipboard hand-off to the iframe;
**now they are consumed directly by the native editor's AI Drop
panel**, which writes results onto real timeline tracks.

| Endpoint                            | Input                                    | Output                                                                  | In-editor effect                                  |
| ----------------------------------- | ---------------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------- |
| `POST /api/opencut/captions`        | Whisper transcript                       | `{ captions: [{ start, end, text, words? }] }`                          | New caption track, one clip per cue.              |
| `POST /api/opencut/chapters`        | Transcript / summary + episode metadata  | `{ chapters: [{ timestamp, title, secondsIntoEpisode }] }`              | Chapter markers pinned on the ruler.              |
| `POST /api/opencut/filler-segments` | Transcript with timings                  | `{ filler: [{ start, end, word, reason }] }`                            | Ripple-delete batch on the primary video/audio.   |
| `POST /api/opencut/broll-suggest`   | Transcript + topic tags                  | `{ suggestions: [{ secondsIntoEpisode, topic, keywords }] }`            | Draggable B-roll cue placeholders on the ruler.   |

The route names keep the `opencut` prefix for compatibility with any
external integrations — they describe the artifact shape, not the
back-end.

## Linked tools (separate pages, deep-linked)

The editor links out to the other ProductionSTUDIO tools rather than
embedding them. They write transcripts / chapters / shorts into shared
storage; the AI Drop panel can load from those exports.

- `/production-studio/transcript-cleaner` — cleaned transcript source.
- `/production-studio/auto-caption` — Whisper word-level timings.
- `/production-studio/shorts-formatter` — 9:16 reframe presets.
- `/production-studio/chapter-generator` — chapter markers.

## Why we dropped OpenCut

- Upstream classic became a placeholder (empty editor surface).
- The iframe added a build/dep footprint (Bun, Vite, Tailwind v4,
  Cloudflare Workers target) for zero shipped behavior.
- Clipboard hand-off was always a stopgap.
- The legacy v1 NLE already proves POAST can run FFmpeg.wasm export
  in-process — the multi-track upgrade was always the cleaner path.

The vendored source at `apps/opencut/` is left on disk (gitignored
sub-deps) but is no longer built, served, or referenced by the app.
See `apps/opencut/README-POAST.md` for the status note.
