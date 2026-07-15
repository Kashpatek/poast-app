// ═══════════════════════════════════════════════════════════════════════════
// Unique mode · generative backdrops — dispatcher + seeded PRNG
//
// Every generator is a pure function of (seed, strength, accent): same inputs,
// same SVG string, so DOM canvas, thumbnail and PNG export are pixel-identical.
// NEVER Math.random / Date.now in here. The caller (render.ts) paints the
// #06070C base rect first; these return only an inner fragment (defs + shapes)
// for a 1080x1350 viewBox.
// ═══════════════════════════════════════════════════════════════════════════

import { bkEclipse, bkParticles, bkDunes } from "./backdrops-a";
import { bkBlueprint, bkTraces, bkGrid } from "./backdrops-b";
import { bkTerminal, bkTopo, bkStream } from "./backdrops-c";

export type UniqueBackdropId =
  | "eclipse" | "particles" | "dunes"
  | "blueprint" | "traces" | "grid"
  | "terminal" | "topo" | "stream";

export type UniqueStrength = "grain" | "ambient" | "motif" | "focal";

// Relative opacity tiers (spec 9 craft note). Generators design opacities as
// multiples of ctx.k so the whole scene scales with the tier.
var TIERS: Record<UniqueStrength, number> = {
  grain: 0.04,
  ambient: 0.07,
  motif: 0.11,
  focal: 0.18,
};

// mulberry32 — small fast deterministic PRNG
export function mulberry32(seed: number): () => number {
  var a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    var t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// FNV-1a string hash → 32-bit seed. Slide ids are stable after build, so all
// three render surfaces derive the identical seed.
export function hashSeed(s: string): number {
  var h = 0x811c9dc5;
  for (var i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

// Shared context handed to every generator.
export interface BkCtx {
  rng: () => number;
  rnd: (a: number, b: number) => number;
  k: number;            // tier opacity scale (design opacities = base * k)
  op: (base: number) => number; // clamped opacity helper
  accent: string;       // direction accent (never used for text deltas)
  uid: string;          // unique defs-id suffix (previews render many svgs inline)
  W: number;            // 1080
  H: number;            // 1350
}

export function renderBackdrop(
  id: UniqueBackdropId | string,
  seed: number,
  strength: UniqueStrength,
  accent: string
): string {
  var rng = mulberry32(seed);
  var k = TIERS[strength] !== undefined ? TIERS[strength] : TIERS.motif;
  var ctx: BkCtx = {
    rng: rng,
    rnd: function (a, b) { return a + rng() * (b - a); },
    k: k,
    op: function (base) {
      var v = base * k;
      return Math.round(Math.min(0.9, Math.max(0, v)) * 1000) / 1000;
    },
    accent: accent,
    uid: "u" + (seed >>> 0).toString(36),
    W: 1080,
    H: 1350,
  };
  switch (id) {
    case "eclipse": return bkEclipse(ctx);
    case "particles": return bkParticles(ctx);
    case "dunes": return bkDunes(ctx);
    case "blueprint": return bkBlueprint(ctx);
    case "traces": return bkTraces(ctx);
    case "grid": return bkGrid(ctx);
    case "terminal": return bkTerminal(ctx);
    case "topo": return bkTopo(ctx);
    case "stream": return bkStream(ctx);
    default: return bkEclipse(ctx);
  }
}
