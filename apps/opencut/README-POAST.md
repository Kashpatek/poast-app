# OpenCut (vendored reference clone)

This directory is a shallow clone of
[OpenCut-app/OpenCut](https://github.com/OpenCut-app/OpenCut) (MIT)
taken on **2026-06-06**.

It is **not** installed, built, or wired into the POAST app. We keep the
source tree here as a reference snapshot so we can:

1. Port OpenCut's React/Tailwind UI to POAST's inline-style design system
   (`src/app/shared-constants.ts` — tokens `D`, `ft`, `gf`, `mn`).
2. Mirror OpenCut's Zustand stores into our POAST project store (via
   `/api/db`) once we vendor the editor in-process.
3. Track upstream when OpenCut publishes its plugin/MCP API so we can
   replace today's clipboard hand-off with a real bidirectional bridge.

## Running OpenCut standalone (optional)

If you want to poke at the upstream editor locally without touching the
POAST app:

```bash
cd apps/opencut
# OpenCut ships a bun.lock + turbo workspace
bun install
bun run dev
```

(or `npm install && npm run dev` if you don't have Bun — note that
OpenCut's lockfile is `bun.lock`, so npm will resolve a slightly
different dep graph.)

Nothing in `apps/opencut/` runs as part of `next dev` in this repo.

## Why is the inner `.git` removed?

The clone was made with `git clone --depth 1` and then the inner `.git`
directory was deleted so the OpenCut tree does not behave as a nested
submodule inside the POAST repo's git index. To re-sync against
upstream, blow this directory away and re-clone:

```bash
rm -rf apps/opencut
mkdir -p apps && cd apps
git clone --depth 1 https://github.com/OpenCut-app/OpenCut.git opencut
rm -rf opencut/.git
```

## Integration model with POAST

See [`/src/app/production-studio/timeline/OPENCUT.md`](../../src/app/production-studio/timeline/OPENCUT.md)
for the full integration plan. Short version:

| Stage              | Status                                                                 |
| ------------------ | ---------------------------------------------------------------------- |
| Iframe embed       | Shipped — `/production-studio/timeline` mounts `https://opencut.app`.  |
| Clipboard hand-off | Shipped — POAST emits captions/chapters/cut-list JSON the user pastes. |
| Tailwind port      | Deferred — needs full pass over `apps/opencut/apps/web`.               |
| Zustand bridge     | Deferred — waits on Tailwind port + a vendored editor build.           |
| Plugin/MCP API     | Blocked on upstream — see OpenCut roadmap.                             |
| MediaPipe smartcrop, WaveSurfer/RNNoise/LUFS audio | Deferred.                          |

## License

OpenCut is MIT-licensed. The upstream `LICENSE` file is preserved at
`./LICENSE`. Any code we port from this tree into POAST proper must
carry the MIT notice forward in the file header.
