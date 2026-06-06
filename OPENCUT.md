# OpenCut · index (decommissioned)

POAST's video timeline (`/production-studio/timeline`) **no longer
integrates OpenCut**. The upstream classic editor became a placeholder,
so we replaced the iframe wrapper with POAST's own native multi-track
NLE. The `/api/opencut/*` endpoints stay in place, but they are now
consumed **by the native editor's AI Drop panel** rather than as a
clipboard hand-off to an embedded iframe.

## Where to read

- [`src/app/production-studio/timeline/OPENCUT.md`](src/app/production-studio/timeline/OPENCUT.md)
  — **the live editor doc**. Covers the native editor architecture,
  how the AI Drop panel consumes `/api/opencut/*` directly, persistence
  via the design-studio projects-store, and why we dropped the iframe.
- [`apps/opencut/README-POAST.md`](apps/opencut/README-POAST.md)
  — **the vendored source status note**. The clone is left on disk
  but is no longer built or served.

## What changed (this commit)

| Layer                   | Before                                 | After                                       |
| ----------------------- | -------------------------------------- | ------------------------------------------- |
| Editor surface          | `<iframe src="/embed/opencut/" />`     | Native `TimelineEditor` component           |
| Same-origin proxy       | `next.config.ts` rewrite to :5173      | Removed                                     |
| Sub-server scripts      | `dev:opencut`, `dev:all`, `build:opencut` | Removed from `package.json`              |
| Hand-off API            | `/api/opencut/*` → clipboard → iframe  | `/api/opencut/*` → AI Drop panel → tracks   |
| Vendored source         | `apps/opencut/` (installed, dev-served) | `apps/opencut/` (left on disk, not built)  |

## Why

- Upstream classic editor became an empty placeholder.
- The iframe added a Bun + Vite + Tailwind v4 + Cloudflare-Workers
  build chain for zero shipped behavior.
- POAST already had a working FFmpeg.wasm NLE foundation
  (`src/app/production-studio/timeline/legacy.tsx`) — extending that
  into multi-track was cleaner than chasing upstream.
- Clipboard hand-off was always intended as a stopgap.

The four `/api/opencut/*` endpoints (captions, chapters,
filler-segments, broll-suggest) stay shipped and are first-class inputs
to the native editor's AI Drop panel.
