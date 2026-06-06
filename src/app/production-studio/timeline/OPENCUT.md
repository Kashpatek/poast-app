# Timeline Editor · OpenCut Integration

## Current state (v3)

`/production-studio/timeline` mounts the [OpenCut](https://opencut.app)
classic editor in an iframe inside the POAST ProductionSTUDIO shell, and
adds a **Timeline Workspace** that runs POAST's caption / chapter /
filler / B-Roll pipelines *next to* the embedded editor. Today the bridge
between the two is a **clipboard hand-off** — POAST produces structured
JSON, the user pastes it into OpenCut (or imports it manually).

The original v1 NLE (FFmpeg.wasm + 1 video + 1 audio track) is preserved
at `./legacy.tsx` for reference and as a fallback if the iframe path is
ever rolled back.

## Source

- Repository: [OpenCut-app/OpenCut](https://github.com/OpenCut-app/OpenCut)
- License: MIT
- Hosted classic: <https://opencut.app>
- Vendored reference clone: [`/apps/opencut`](../../../../apps/opencut)
  — taken 2026-06-06 with `git clone --depth 1`. Not installed, not
  built; used only as source-of-truth for porting work. See
  [`apps/opencut/README-POAST.md`](../../../../apps/opencut/README-POAST.md).

## Hand-off API (shipped in this batch)

POAST exposes four hand-off endpoints under `/api/opencut/*`. Each one
takes an input artifact (transcript, segments, or media metadata) and
returns JSON in a shape that's either directly importable by OpenCut or
trivially adaptable inside the Timeline Workspace.

| Endpoint                        | Input                                    | Output                                                                    | Used by                          |
| ------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------- | -------------------------------- |
| `POST /api/opencut/captions`    | Whisper transcript (word- or segment-level timings) | `{ tracks: [{ id, type:"caption", clips: [{ id, start, end, text, style }] }] }` matching OpenCut's caption-track schema. | Auto-Caption → Timeline Workspace. |
| `POST /api/opencut/chapters`    | Transcript or summary text + episode metadata. | `{ markers: [{ time, label, color }] }` — OpenCut marker JSON; also YouTube chapter text + Spotify chapter JSON. | Chapter Generator.               |
| `POST /api/opencut/filler-segments` | Transcript with timings + filler-word policy. | `{ cuts: [{ start, end, reason, confidence }] }` — ripple-delete list for the editor. | Transcript Cleaner.              |
| `POST /api/opencut/broll-suggest`   | Transcript + topic tags.                | `{ suggestions: [{ time, query, sources: ["pexels","sa-archive"], thumb? }] }` per timestamp. | Timeline Workspace B-Roll panel. |

These run server-side so the LLM/Whisper keys never reach the browser.
Each one is idempotent and stateless — the Timeline Workspace caches
results in `localStorage` keyed by transcript hash.

## Clipboard hand-off protocol

Until OpenCut publishes a real plugin/postMessage API, the Workspace
hands artifacts to the embedded editor through the system clipboard:

1. User runs a tool in the Workspace (e.g. "Generate captions"). POAST
   calls the matching `/api/opencut/*` endpoint and stores the result in
   Workspace state.
2. The Workspace shows the artifact in a preview panel with a
   **"Copy for OpenCut"** button. Clicking it serializes the artifact
   using one of these envelopes:
   - **Captions**: SRT or VTT plain text — OpenCut accepts both via its
     subtitle import. Also offered as OpenCut native JSON for power
     users who paste into the project file directly.
   - **Chapters**: OpenCut marker JSON, plus a YouTube chapter block
     (`HH:MM:SS Label\n…`) for description fields.
   - **Filler-segments**: an EDL-style cut list (start / end / action)
     OpenCut can import as a ripple-delete batch when its EDL importer
     ships. Today users apply cuts manually using the rendered
     timestamp list.
   - **B-Roll suggestions**: a markdown checklist `- [HH:MM:SS] query`
     plus per-row "Open Pexels search" links.
3. User focuses the iframe and pastes (`Cmd/Ctrl-V`) into OpenCut's
   relevant import surface. The OpenCut iframe is loaded with
   `allow="clipboard-read; clipboard-write"` so the paste round-trips
   cleanly on Chromium and Safari.
4. Workspace remembers which artifacts were copied this session so the
   user can see what's already been pushed across.

This is intentionally a manual loop. It is fragile (depends on the
user's focus + paste), but it ships **today** and does not require any
OpenCut changes.

## Deferred deep-integration scope

To move from clipboard hand-off to a first-class POAST surface, the
following work is required. Everything here is **not** shipping in this
batch.

### 1. Style port (Tailwind → inline styles)

OpenCut uses Tailwind CSS throughout. POAST is Tailwind-free; every panel
uses inline styles bound to the brand tokens in `src/app/shared-constants.ts`
(`D`, `ft`, `gf`, `mn`). The port means:

- Strip Tailwind from `tailwind.config.{js,ts}` and `postcss.config.js`
  in the vendored OpenCut tree (`apps/opencut/apps/web`).
- Rewrite each component's `className` props to `style` objects using
  `D.bg / D.surface / D.card / D.border / D.tx / D.txm / D.txd / D.amber /
  D.blue / D.teal / D.violet / D.coral`.
- Replace OpenCut's font stack with `ft` (body), `gf` (headings, Grift),
  `mn` (mono/labels).
- Match the rest of ProductionSTUDIO: 1px translucent borders, 10–14px
  border radius, sticky shell headers, monospace caps for section labels.

### 2. State bridge (OpenCut Zustand ↔ POAST store)

OpenCut keeps its timeline, clip, and project state in Zustand. POAST
persists projects via `/api/db` (table `projects`, rows keyed by `id` +
`type`, payload in `data`). The bridge needs:

- A `useOpenCutBridge` hook that subscribes to OpenCut's Zustand store
  and mirrors timeline mutations into a POAST project row of
  `type: "production-timeline"`.
- Load path: on mount, hydrate OpenCut's store from the POAST row before
  the editor renders any clips.
- Save path: debounce Zustand updates (250ms) and POST to `/api/db`.
- Conflict policy: last-write-wins with a `version` field; warn if the
  loaded row's version is newer than the in-memory one.

### 3. Plugin / MCP API integration

When OpenCut publishes a plugin or MCP API:

- Replace the clipboard hand-off with `window.postMessage` (iframe) or
  a direct in-process plugin (vendored editor).
- Promote each `/api/opencut/*` artifact from "copy-paste payload" to
  "live track" — captions become a caption track, filler-segments
  become ripple cuts the user can preview, B-Roll suggestions become
  draggable placeholders on the ruler.
- Two-way sync: edits in OpenCut surface back into the Workspace
  (e.g. moving a caption clip updates the transcript word timings).

### 4. Track wiring (cross-tool data flow)

The point of putting OpenCut inside POAST is to let the other
ProductionSTUDIO tools write directly to the timeline:

- **Auto-Caption** (`/production-studio/auto-caption`): when Whisper
  returns word-level timings, mount them as a caption track in OpenCut
  with the chosen style preset. Word boundaries become caption-track
  clip boundaries so ripple-delete on a single word collapses both the
  caption and the underlying video segment.
- **Ripple-delete from transcript**: Transcript Cleaner / Auto-Caption
  surfaces a "remove filler word" action. The handler should map the
  word's timing back to OpenCut's timeline, splice out that range, and
  ripple every downstream clip + caption left by the same delta.
- **Shorts Formatter** (`/production-studio/shorts-formatter`):
  subject-tracked smart-crop using MediaPipe's face/object detection
  (or [smartcrop.js](https://github.com/jwagner/smartcrop.js) as a
  fallback). The reframe writes a per-frame crop track into OpenCut as
  a transform layer so the 9:16 export honors subject tracking without
  re-rendering.
- **Chapter Generator** (`/production-studio/chapter-generator`):
  chapter timings drag onto the OpenCut ruler as markers.

### 5. Audio pipeline

OpenCut handles audio tracks but POAST wants a richer chain:

- [WaveSurfer.js](https://wavesurfer-js.org/) for waveform rendering on
  every audio clip (visual parity with Audio Editor).
- [RNNoise](https://github.com/xiph/rnnoise) (WASM build) for noise
  suppression on imported clips, exposed as a per-clip toggle.
- LUFS normalizer targeting **-16 LUFS** integrated on the master bus
  before export, matching the SemiAnalysis podcast loudness target.

### 6. Export

OpenCut's export uses FFmpeg.wasm. Keep that pipeline but:

- Surface the export queue in `/production-studio/render-queue` instead
  of an in-editor modal — POAST already has a Render Queue tool.
- Render presets honor the SemiAnalysis YouTube + Spotify guidelines
  (1920×1080 H.264 + AAC for video, 48kHz stereo AAC for podcast audio).

## Estimated scope

Roughly a multi-day port + one deep integration session, gated on
upstream:

- Day 1: Vendor OpenCut from `apps/opencut/`, strip Tailwind, swap the
  design system.
- Day 2: State bridge to `/api/db`, hydrate + persist + conflict handling.
- Day 3: Auto-Caption → caption track wiring, ripple-delete from
  transcript word timings.
- Day 4: Shorts Formatter smartcrop track + chapter-marker drag-in.
- Day 5: WaveSurfer + RNNoise + LUFS, render queue integration, polish.

Track upstream — much of this becomes easier once OpenCut's
plugin/MCP API stabilizes. The clipboard hand-off and the four
`/api/opencut/*` endpoints stay useful regardless: they're what feeds
the eventual live tracks too.
