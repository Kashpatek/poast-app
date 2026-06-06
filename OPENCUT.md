# OpenCut · index

POAST's video timeline (`/production-studio/timeline`) is built on top
of [OpenCut](https://opencut.app) (MIT). The vendored source at
`apps/opencut/` is now installed + dev-servable; the Next app proxies
`/embed/opencut/*` to the local Vite server so the iframe pulls a
self-hosted build instead of the public host. Run both servers
together with `npm run dev:all` (or `npm run dev` + `npm run dev:opencut`
in separate terminals).

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
| Editor embed (iframe)   | `src/app/production-studio/timeline/`  | Shipped (self-hosted) |
| Same-origin proxy       | `next.config.ts rewrites`              | Shipped               |
| Timeline Workspace      | `src/app/production-studio/timeline/`  | Shipped               |
| Hand-off API            | `src/app/api/opencut/*`                | Shipped               |
| Clipboard hand-off      | Timeline Workspace ↔ iframe            | Shipped               |
| Vendored source         | `apps/opencut/` (1411 packages installed) | Shipped            |
| Tailwind → inline port  | `apps/opencut/apps/web/**`             | Deferred              |
| Plugin / MCP bridge     | n/a — blocked on upstream              | Deferred              |
| MediaPipe smartcrop, WaveSurfer / RNNoise / LUFS | n/a            | Deferred              |

## How the self-host works (this commit)

- `apps/opencut/apps/web` is the OpenCut classic source (TanStack Start
  + Vite + Tailwind v4 + Cloudflare Workers target). Installed via
  `bun install`; deps live in `apps/opencut/apps/web/node_modules`
  (gitignored).
- `npm run dev:opencut` starts Vite on port 5173 with
  `--base /embed/opencut/` so every emitted asset path is prefixed.
- `next.config.ts` adds a rewrite from `/embed/opencut[/*]` →
  `http://localhost:5173/embed/opencut[/*]`. The path prefix matches
  Vite's base so HMR + assets + Tanstack Start streaming all resolve
  through POAST's origin.
- `src/app/production-studio/timeline.tsx` iframes `/embed/opencut/`,
  which the browser sees as same-origin — clipboard / postMessage will
  work once OpenCut publishes the API.
- Production: set `OPENCUT_URL` env var to the host serving
  `npm run build:opencut`. Same prefix; the rewrite handles the rest.
