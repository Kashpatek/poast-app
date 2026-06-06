# OpenCut (vendored reference clone — decommissioned)

> **Status (2026-06-06):** Upstream OpenCut classic is currently a
> **placeholder** — the editor surface does not ship a functional NLE.
> Because of this, POAST has stopped integrating OpenCut and now ships
> **its own native timeline editor** at `/production-studio/timeline`.
> This directory is left on disk for reference only; it is no longer
> installed, built, served, or wired into the POAST app, and `npm run
> dev` does not depend on it. See
> [`../OPENCUT.md`](../../OPENCUT.md) and
> [`../../src/app/production-studio/timeline/OPENCUT.md`](../../src/app/production-studio/timeline/OPENCUT.md).

This directory is a shallow clone of
[OpenCut-app/OpenCut](https://github.com/OpenCut-app/OpenCut) (MIT)
taken on **2026-06-06**.

It is **not** installed, built, or wired into the POAST app. We keep the
source tree here as a reference snapshot so we can:

1. Port any useful UI patterns to POAST's inline-style design system
   (`src/app/shared-constants.ts` — tokens `D`, `ft`, `gf`, `mn`) if
   the upstream editor ever ships a real implementation.
2. Diff against future upstream releases to evaluate re-integration.
3. Preserve the MIT license attribution alongside any code we port out.

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
