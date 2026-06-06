# OpenCut · index

POAST's video timeline (`/production-studio/timeline`) is built on top
of [OpenCut](https://opencut.app) (MIT). The integration is split across
two surfaces:

## Where to read

- [`src/app/production-studio/timeline/OPENCUT.md`](src/app/production-studio/timeline/OPENCUT.md)
  — **the live integration plan**. Covers the iframe embed, the four
  `/api/opencut/*` hand-off endpoints, the clipboard hand-off protocol
  between the Timeline Workspace and the embedded editor, and the
  deferred deep-integration work (Tailwind port, Zustand bridge,
  plugin/MCP wiring, MediaPipe smartcrop, WaveSurfer / RNNoise / LUFS
  audio).
- [`apps/opencut/README-POAST.md`](apps/opencut/README-POAST.md)
  — **the vendored source reference**. Explains the
  `apps/opencut/` clone (shallow snapshot, MIT, taken 2026-06-06),
  how to run it standalone, and how to re-sync it against upstream.

## TL;DR

| Layer                   | Where                                  | Status                |
| ----------------------- | -------------------------------------- | --------------------- |
| Editor embed (iframe)   | `src/app/production-studio/timeline/`  | Shipped               |
| Timeline Workspace      | `src/app/production-studio/timeline/`  | Shipped (this batch)  |
| Hand-off API            | `src/app/api/opencut/*`                | Shipped (this batch)  |
| Clipboard hand-off      | Timeline Workspace ↔ iframe            | Shipped (this batch)  |
| Vendored source         | `apps/opencut/` (not installed/built)  | Shipped (this batch)  |
| Tailwind → inline port  | `apps/opencut/apps/web/**`             | Deferred              |
| Plugin / MCP bridge     | n/a — blocked on upstream              | Deferred              |
| MediaPipe smartcrop, WaveSurfer / RNNoise / LUFS | n/a            | Deferred              |
