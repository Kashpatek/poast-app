# Timeline Editor · OpenCut Integration

## Current state (v2)

`/production-studio/timeline` mounts the [OpenCut](https://opencut.app)
classic editor in an iframe inside the POAST ProductionSTUDIO shell. This
is a baseline embed — OpenCut runs as its own app and POAST does not
read or write its timeline state.

The original v1 NLE (FFmpeg.wasm + 1 video + 1 audio track) is preserved
at `./legacy.tsx` for reference and as a fallback if the iframe path is
ever rolled back.

## Source

- Repository: [OpenCut-app/OpenCut](https://github.com/OpenCut-app/OpenCut)
- License: MIT
- Hosted classic: <https://opencut.app>

## Deferred deep-integration scope

To move from an iframe baseline to a first-class POAST surface, the
following work is required:

### 1. Style port (Tailwind → inline styles)

OpenCut uses Tailwind CSS throughout. POAST is Tailwind-free; every panel
uses inline styles bound to the brand tokens in `src/app/shared-constants.ts`
(`D`, `ft`, `gf`, `mn`). The port means:

- Strip Tailwind from `tailwind.config.{js,ts}` and `postcss.config.js`
  in the vendored OpenCut tree.
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

### 3. Track wiring (cross-tool data flow)

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
  subject-tracked smart-crop using [smartcrop.js](https://github.com/jwagner/smartcrop.js)
  or a face-detection model. The reframe writes a per-frame crop track
  into OpenCut as a transform layer so the 9:16 export honors subject
  tracking without re-rendering.
- **Chapter Generator** (`/production-studio/chapter-generator`):
  chapter timings drag onto the OpenCut ruler as markers.

### 4. Audio pipeline

OpenCut handles audio tracks but POAST wants a richer chain:

- [WaveSurfer.js](https://wavesurfer-js.org/) for waveform rendering on
  every audio clip (visual parity with Audio Editor).
- [RNNoise](https://github.com/xiph/rnnoise) (WASM build) for noise
  suppression on imported clips, exposed as a per-clip toggle.
- LUFS normalizer targeting **-16 LUFS** integrated on the master bus
  before export, matching the SemiAnalysis podcast loudness target.

### 5. Export

OpenCut's export uses FFmpeg.wasm. Keep that pipeline but:

- Surface the export queue in `/production-studio/render-queue` instead
  of an in-editor modal — POAST already has a Render Queue tool.
- Render presets honor the SemiAnalysis YouTube + Spotify guidelines
  (1920×1080 H.264 + AAC for video, 48kHz stereo AAC for podcast audio).

## Estimated scope

Roughly a multi-day port + one deep integration session:

- Day 1: Vendor OpenCut, strip Tailwind, swap the design system.
- Day 2: State bridge to `/api/db`, hydrate + persist + conflict handling.
- Day 3: Auto-Caption → caption track wiring, ripple-delete from
  transcript word timings.
- Day 4: Shorts Formatter smartcrop track + chapter-marker drag-in.
- Day 5: WaveSurfer + RNNoise + LUFS, render queue integration, polish.

Track upstream — much of this becomes easier once OpenCut's
plugin/MCP API stabilizes.
