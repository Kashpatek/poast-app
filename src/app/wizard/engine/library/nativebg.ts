// ═══════════════════════════════════════════════════════════════════════════
// Library mode · NATIVE infinity backdrops (platform v3.1, 2026-07-14).
//
// The baked 36 are single 1080x1350 compositions — infinity mode tiles them
// by mirroring, which is pixel-continuous but perceptually a loop ("they
// genuinely feel looped"). Native backdrops fix that at the source: each
// family procedurally generates ONE continuous composition across the whole
// deck width (global strip coords [0, n*1080] x [0, 1350]) and every slide
// renders a 1080-wide WINDOW onto it — features drift and never repeat, no
// mirroring, seams invisible by construction.
//
// Five families survived a two-round adversarial judge panel (8 candidates,
// per-tweak re-verification): traces / isobars / ridge / orbits / skyline.
// Panel rules baked into the generators: aperiodic event scheduling (no
// fixed beat at any slide multiple), long-wavelength drift so compositions
// TRAVEL, one-time landmarks for swipe identity, glow cores lighter than the
// accent hues (low-alpha amber over near-black otherwise reads muddy brown).
//
// Deterministic like everything in this engine: mulberry32 + seeded value
// noise, no Math.random / Date — the same (fam, seed, n, hue) always renders
// the identical strip, so drafts re-render identically forever.
//
// Native keys live in the SAME string key space as baked backdrop keys with
// an "n:" prefix ("n:traces") so overrides, draft JSON, and the picker flow
// through the existing channels untouched.
// ═══════════════════════════════════════════════════════════════════════════

import { STYLE_DEFS, NATIVE_PAGES } from "./nativestyles";
import type { NativeStyleDef } from "./nativestyles";

export type NativeHue = "blend" | "amber" | "cobalt" | "green";

const W = 1080;
const H = 1350;

// v3.1 CLASSICS ("before") — sparse fields scaled to the deck length.
export const NATIVE_FAMILIES = ["traces", "isobars", "ridge", "orbits", "skyline"] as const;
export type NativeFamily = (typeof NATIVE_FAMILIES)[number];

export const NATIVE_PREFIX = "n:";
export { NATIVE_PAGES, STYLE_DEFS };

export function isNativeKey(key: string | null | undefined): boolean {
  return typeof key === "string" && key.slice(0, 2) === NATIVE_PREFIX;
}

/** v3.2 style compositions are looked up by bare key ("foundry"); classics
 *  by family name. Anything unknown falls back to the traces classic. */
export function nativeGenKeyOf(key: string): string {
  const bare = isNativeKey(key) ? key.slice(2) : key;
  if (STYLE_DEFS[bare]) return bare;
  return (NATIVE_FAMILIES as readonly string[]).indexOf(bare) >= 0 ? bare : "traces";
}

export function isStyleGenKey(bare: string): boolean {
  return !!STYLE_DEFS[bare];
}

export function nativeFamilyOf(key: string): NativeFamily {
  const fam = key.slice(2) as NativeFamily;
  return (NATIVE_FAMILIES as readonly string[]).indexOf(fam) >= 0 ? fam : "traces";
}

/** Picker/rail labels for the classics — style compositions carry their own
 *  meta in STYLE_DEFS. nativeMetaOf() resolves either kind. */
export const NATIVE_META: Record<NativeFamily, { name: string; desc: string }> = {
  traces:  { name: "bus traces",  desc: "PCB lanes jog across the whole deck" },
  isobars: { name: "isobars",     desc: "contour field, accents drift and fade" },
  ridge:   { name: "ridgeline",   desc: "terrain horizon travels peak to valley" },
  orbits:  { name: "orbits",      desc: "glows + arc fragments, uneven cadence" },
  skyline: { name: "skyline",     desc: "equalizer bar floor under roaming glows" },
};

export function nativeMetaOf(key: string): { name: string; desc: string } {
  const bare = nativeGenKeyOf(key);
  const style: NativeStyleDef | undefined = STYLE_DEFS[bare];
  if (style) return { name: style.name, desc: style.desc };
  return NATIVE_META[bare as NativeFamily];
}

/** The native pool for a deck category: that category's style compositions
 *  first (the new generation), then the classics — all bare keys. */
/** ∞ approval sitting (Akash, 2026-07-15, 54/54 decided): styles CUT from
 *  the ∞ shelves and the fresh-deck pool. Gens stay in the registry (an
 *  already-stamped deck keeps rendering; the gallery still shows them). */
export var INFINITY_STYLE_CUT: Record<string, boolean> = {
  emberfield: true, kilnrow: true,
};

function approvedStylesFor(palette: NativeHue): string[] {
  return Object.keys(STYLE_DEFS).filter(function (k) {
    return STYLE_DEFS[k].cat === palette && !INFINITY_STYLE_CUT[k];
  });
}

export function nativeKeysFor(palette: NativeHue): string[] {
  return [...approvedStylesFor(palette), ...NATIVE_FAMILIES];
}

/** Fresh-deck auto-pick rotates over the category's NEW styles when any
 *  exist (they are the ask: per-category compositions); classics remain
 *  manual picks. Falls back to classics while a category has no styles
 *  (or every style it has was cut in the approval sitting). */
export function nativeDefaultPool(palette: NativeHue): string[] {
  const styles = approvedStylesFor(palette);
  return styles.length ? styles : [...NATIVE_FAMILIES];
}

/** Topic → style affinity (v3.6): the post's TOPIC steers which native
 *  composition a fresh ∞ deck lands on, the same way topics steer the baked
 *  pools (backdrop-topics.json). Keys are backdrop-topics topic keys; values
 *  are style keys that SYMBOLIZE the topic, in preference order. Only styles
 *  that survive the category pool (hue + approval cuts) are honored — a
 *  markets post in the general category still rotates the blend styles.
 *  Cut styles (emberfield, kilnrow) are deliberately absent. "brand" and any
 *  unlisted topic keep the plain category rotation. */
export var NATIVE_TOPIC_AFFINITY: Record<string, string[]> = {
  datacenter:    ["citygrid", "heatmap"],
  power:         ["meltstream", "citygrid"],
  accelerator:   ["heatmap", "flowpath"],
  memory:        ["heatmap", "flowpath"],
  foundry:       ["foundry", "meltstream"],
  packaging:     ["flowpath", "foundry"],
  equipment:     ["foundry", "meltstream"],
  networking:    ["subsea", "portside", "flowpath"],
  cloud:         ["citygrid", "groundtrack"],
  "models-labs": ["heatmap", "citygrid"],
  markets:       ["ledgerline", "compound"],
  geopolitics:   ["groundtrack", "portside", "subsea"],
  "space-dc":    ["groundtrack", "citygrid"],
};

/** The pool a fresh ∞ deck actually rotates over: the topic's affinity
 *  styles that exist in this category's approved pool, else the whole
 *  category pool. Seed rotation happens over the RETURNED pool, so two
 *  posts on the same topic can still land on different on-topic worlds. */
export function nativePoolForTopic(palette: NativeHue, topicKey?: string | null): string[] {
  const pool = nativeDefaultPool(palette);
  const pref = (topicKey && NATIVE_TOPIC_AFFINITY[topicKey]) || [];
  const matched = pref.filter(function (k) { return pool.indexOf(k) >= 0; });
  return matched.length ? matched : pool;
}

/* ── deterministic PRNG + helpers (mulberry32 — same idiom as the unique
      engine's seeded backdrops) ── */

function mulberry32(a: number): () => number {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Seeded 1D value noise: smooth interpolation between lattice randoms.
// Period-free — the lattice is indexed by unbounded integers, so nothing
// repeats at any slide multiple.
function valueNoise1D(seed: number): (x: number) => number {
  const cache: Record<number, number> = {};
  const latt = (i: number): number => {
    if (!(i in cache)) cache[i] = mulberry32((seed * 374761393 + i * 668265263) | 0)();
    return cache[i];
  };
  return (x: number): number => {
    const i = Math.floor(x), f = x - i;
    const u = f * f * (3 - 2 * f);
    return latt(i) * (1 - u) + latt(i + 1) * u;
  };
}

// Aperiodic event scheduler: x positions with intervals drawn from
// [minS, maxS] slide-widths (biased low), never a fixed beat. When forceGapS
// is set and no gap reaches it, one event is dropped to open a dead stretch.
function schedule(r: () => number, SW: number, minS: number, maxS: number, forceGapS?: number): number[] {
  const xs: number[] = [];
  let x = (0.15 + r() * 0.75) * W;
  while (x < SW - 0.2 * W) {
    xs.push(x);
    x += (minS + Math.pow(r(), 1.4) * (maxS - minS)) * W;
  }
  if (forceGapS && xs.length > 2) {
    let big = 0, bi = -1;
    for (let i = 1; i < xs.length; i++) { const g = xs[i] - xs[i - 1]; if (g > big) { big = g; bi = i; } }
    if (big < forceGapS * W && bi > 0) xs.splice(bi, 1);
  }
  return xs;
}

// a/b: accent hues · ga/gb: glow cores (lighter + saturated — low-alpha glows
// over near-black go muddy brown otherwise) · c: pale highlight, used rarely.
// Category mapping matches LibPalette: blend=general, amber=internal,
// cobalt=external, green=capital.
const HUES: Record<NativeHue, { a: string; b: string; ga: string; gb: string; c: string }> = {
  blend:  { a: "#F7B041", b: "#0092FF", ga: "#FFC969", gb: "#3FA9FF", c: "#E8ECF5" },
  amber:  { a: "#FF8A1E", b: "#F7B041", ga: "#FFBE5C", gb: "#FFD08A", c: "#FFE2B8" },
  cobalt: { a: "#0092FF", b: "#66C4FF", ga: "#2FA5FF", gb: "#8FD4FF", c: "#D6EDFF" },
  // green runs brighter than the brand token on purpose: capital's #2EAD8E is
  // intrinsically low-sat and at backdrop opacities read near gray-monotone
  // (round-2 panel note) — accents lift toward mint so the tint keeps pace.
  green:  { a: "#35C9A4", b: "#8FEFD2", ga: "#4BDDB7", gb: "#A8F5DF", c: "#DDF7EE" },
};

// Glows at backdrop alpha lean on hue chroma; amber/green sit lower than
// cobalt at equal alpha (round-2 panel: "warm gray" cores) — equalize.
function glowAlphaBoost(hue: NativeHue): number {
  return hue === "amber" || hue === "green" ? 1.25 : 1;
}

/* Each generator: (seed, n, hue) -> full-strip inner SVG string in GLOBAL
   strip coordinates [0, n*W] x [0, H]. Rules: features LOW contrast
   (op .05-.2) except sparse accents; features cross slide boundaries
   mid-feature; nothing periodic at 1080. The near-black base rect is added
   by the per-slide wrapper. */

// 1 · traces — PCB bus lanes. Lane center-y drifts across the strip (the
// skeleton is never the same twice), runs capped ~0.83 slide, jittered-grid
// lane spacing, per-segment opacity shimmer, lit nodes on the actual trace.
function genTraces(seed: number, n: number, hue: NativeHue): string {
  const c = HUES[hue], SW = n * W, r = mulberry32(seed + 3);
  let out = "";
  const lanes = 6 + Math.floor(r() * 3);
  const band = H - 260;
  let aIdx = 0; // alternate accent hue by accent ORDER — amber leads in blend
  for (let l = 0; l < lanes; l++) {
    const drift = valueNoise1D(seed + 200 + l * 17);
    const baseY = 130 + ((l + 0.15 + r() * 0.7) / lanes) * band;
    const laneY = (x: number) => baseY + (drift(x / (3.2 * W)) - 0.5) * 0.20 * H;
    const accent = l % 3 === 0;
    const sw = accent ? 1.8 : 1.2;
    const col = accent ? (aIdx++ % 2 ? c.b : c.a) : "#8992A5";
    const segs: [number, number, number][] = [];
    let x = -60, y = Math.max(90, Math.min(H - 90, laneY(0)));
    while (x < SW + 60) {
      const x2 = Math.min(x + (0.28 + r() * 0.55) * W, SW + 60);
      segs.push([x, x2, y]);
      const op = (accent ? 0.22 : 0.12) * (0.78 + r() * 0.44);
      out += `<path d="M ${x.toFixed(0)} ${y.toFixed(0)} H ${x2.toFixed(0)}" fill="none" stroke="${col}" stroke-width="${sw}" opacity="${op.toFixed(3)}"/>`;
      x = x2;
      if (x >= SW + 60) break;
      const ny = Math.max(90, Math.min(H - 90, laneY(x) + (r() - 0.5) * 130));
      if (Math.abs(ny - y) > 24) {
        out += `<path d="M ${x.toFixed(0)} ${y.toFixed(0)} V ${ny.toFixed(0)}" fill="none" stroke="${col}" stroke-width="${sw}" opacity="${accent ? 0.20 : 0.11}"/>`;
        out += `<circle cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="4.5" fill="none" stroke="#8992A5" stroke-width="1.4" opacity="0.28"/>`;
        y = ny;
      } else {
        out += `<circle cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="3.2" fill="${col}" opacity="0.30"/>`;
      }
    }
    if (accent) {
      for (let k = 0; k < n; k++) {
        const s = segs[Math.floor(r() * segs.length)];
        const nx = s[0] + r() * (s[1] - s[0]);
        out += `<circle cx="${nx.toFixed(0)}" cy="${s[2].toFixed(0)}" r="3" fill="${col}" opacity="0.55"/>`;
      }
    }
  }
  return out;
}

// 2 · isobars — contour field. Accent hairlines carry long-wave altitude
// drift (±20% H) so the composition travels; the second accent fades out
// once in the back half; a short extra accent fades in elsewhere; gray lines
// above the JPEG-crush floor; one contour-pinch landmark.
function genIsobars(seed: number, n: number, hue: NativeHue): string {
  const c = HUES[hue], SW = n * W, r = mulberry32(seed + 7);
  let out = "";
  const lines = 13, STEP = 44;
  let px: number;
  do { px = (0.6 + r() * (n - 1.2)) * W; } while (Math.abs(px / W - Math.round(px / W)) < 0.22);
  const pinchY = H * (0.35 + r() * 0.3);
  const fadeX = (n * 0.55 + r() * 0.25) * W;
  const inX = (0.3 + r() * Math.max(0.2, n - 2.9)) * W;
  const yOf = (l: number, nz: (x: number) => number, drf: (x: number) => number, driftAmp: number, accent: boolean, x: number): number => {
    let y = (l + 0.7) * (H / (lines + 0.7))
      + 130 * (nz(x / 640) - 0.5) + 60 * (nz(x / 210 + 40) - 0.5)
      + (drf(x / (2.9 * W)) - 0.5) * 2 * driftAmp;
    if (!accent && l >= 5 && l <= 8) {
      const t = Math.exp(-((x - px) ** 2) / (2 * 340 * 340));
      y = y * (1 - 0.8 * t) + pinchY * 0.8 * t;
    }
    return y;
  };
  for (let l = 0; l < lines; l++) {
    const nz = valueNoise1D(seed + 101 + l * 13);
    const drf = valueNoise1D(seed + 401 + l * 29);
    const accent = l === 4 || l === 9;
    const driftAmp = accent ? 0.20 * H : 0.06 * H;
    const col = accent ? (l === 4 ? c.b : c.a) : "#8992A5";
    if (!accent) {
      let d = "";
      for (let x = -20; x <= SW + 20; x += STEP) d += (d ? " L" : "M") + ` ${x} ${yOf(l, nz, drf, driftAmp, accent, x).toFixed(1)}`;
      out += `<path d="${d}" fill="none" stroke="${col}" stroke-width="1.15" opacity="0.11"/>`;
    } else {
      // chunked so opacity can follow a fade envelope (one-time, aperiodic)
      for (let x0 = -20; x0 <= SW + 20; x0 += STEP * 3) {
        const mid = x0 + STEP * 1.5;
        let env = 1;
        if (l === 9) env = Math.max(0.12, Math.min(1, 1 - (mid - fadeX) / (1.5 * W)));
        let d = "";
        for (let x = x0; x <= Math.min(x0 + STEP * 3, SW + 20); x += STEP) d += (d ? " L" : "M") + ` ${x} ${yOf(l, nz, drf, driftAmp, accent, x).toFixed(1)}`;
        out += `<path d="${d}" fill="none" stroke="${col}" stroke-width="1.7" opacity="${(0.20 * env).toFixed(3)}"/>`;
      }
    }
  }
  // extra short accent: fades in + out over a ~2.2-slide window, mid-field.
  // Repelled from the l=4 accent (same hue) — isobars must never cross. The
  // side is locked ONCE at the window start (a distance-only clamp let the
  // line side-swap through the main accent as a vertical zigzag — round-3
  // finding) and the floor is soft, so near-misses breathe instead of
  // running in mechanical lockstep at the minimum.
  const xnz = valueNoise1D(seed + 601), xdr = valueNoise1D(seed + 613);
  const a4nz = valueNoise1D(seed + 101 + 4 * 13), a4drf = valueNoise1D(seed + 401 + 4 * 29);
  const rawExtra = (x: number): number =>
    H * 0.52 + 130 * (xnz(x / 640) - 0.5) + (xdr(x / (2.9 * W)) - 0.5) * 0.3 * H;
  const a4Y = (x: number): number => yOf(4, a4nz, a4drf, 0.20 * H, true, x);
  const side = rawExtra(inX) >= a4Y(inX) ? 1 : -1;
  const extraY = (x: number): number => {
    const sep = side * (rawExtra(x) - a4Y(x));
    if (sep >= 98) return a4Y(x) + side * sep;
    const t = Math.max(0, Math.min(1, (sep - 42) / 56));
    return a4Y(x) + side * (70 + 28 * (t * t * (3 - 2 * t)));
  };
  for (let x0 = inX; x0 <= inX + 2.2 * W; x0 += STEP * 3) {
    const mid = x0 + STEP * 1.5;
    const t = (mid - inX) / (2.2 * W);
    const env = Math.max(0, Math.sin(Math.PI * Math.min(1, Math.max(0, t))));
    if (env < 0.06) continue;
    let d = "";
    for (let x = x0; x <= Math.min(x0 + STEP * 3, inX + 2.2 * W); x += STEP) {
      d += (d ? " L" : "M") + ` ${x.toFixed(0)} ${extraY(x).toFixed(1)}`;
    }
    out += `<path d="${d}" fill="none" stroke="${c.b}" stroke-width="1.5" opacity="${(0.17 * env).toFixed(3)}"/>`;
  }
  return out;
}

// 3 · ridge — terrain horizon. Altitude drifts across ~35-70% H over the
// deck (a real peak and valley); amplitude modulation mixes near-flat
// stretches with a sharper massif; 1-2 whole-field sky glows off-boundary;
// band fills NEUTRAL navy/graphite with the hue only in the crest rim-light.
function genRidge(seed: number, n: number, hue: NativeHue): string {
  const c = HUES[hue], SW = n * W, r = mulberry32(seed + 5);
  let out = "";
  const alt = valueNoise1D(seed + 501);
  const ampMod = valueNoise1D(seed + 517);
  // Horizon altitude: contrast-stretched noise + a guaranteed 3/4-cycle swing
  // across the deck, so the ridge REALLY visits both the ~35% peak band and
  // the ~70% valley band (plain value noise hugs the middle — round-2 finding).
  const ph = r() * Math.PI * 2;
  const rawW = (x: number): number => {
    const nzv = (alt(x / (2.6 * W)) - 0.5) * 2.4;
    const sw = Math.sin((x / SW) * Math.PI * 1.5 + ph);
    return 0.55 * nzv + 0.62 * sw;
  };
  // renormalize to the deck's own extremes so EVERY seed genuinely visits
  // both the ~35% peak band and the ~70% valley band (unnormalized noise+sine
  // rarely align — round-2 finding: valley never happened)
  let wLo = Infinity, wHi = -Infinity;
  for (let s = 0; s <= 160; s++) {
    const w = rawW((s / 160) * SW);
    if (w < wLo) wLo = w;
    if (w > wHi) wHi = w;
  }
  const altW = (x: number): number =>
    -0.95 + 1.9 * ((rawW(x) - wLo) / Math.max(0.0001, wHi - wLo));
  // One jagged massif landmark: off-boundary, away from strip ends, and on
  // neutral altitude (a massif on the valley would cancel the valley).
  let mx = (0.7 + r() * (n - 1.4)) * W;
  for (let tries = 0; tries < 20; tries++) {
    if (Math.abs(mx / W - Math.round(mx / W)) >= 0.25 && Math.abs(altW(mx)) < 0.35) break;
    mx = (0.7 + r() * (n - 1.4)) * W;
  }
  const mAmp = 190 + r() * 90, mSig = 240 + r() * 120;
  // Two sky glows: one in each half of the deck, both off-boundary.
  const gob = (0.06 + r() * 0.03) * glowAlphaBoost(hue);
  for (let g = 0; g < 2; g++) {
    const lo = g === 0 ? 0.4 : n / 2 + 0.3;
    const hi = g === 0 ? n / 2 - 0.3 : n - 0.4;
    let gx: number;
    do { gx = (lo + r() * (hi - lo)) * W; } while (Math.abs(gx / W - Math.round(gx / W)) < 0.28);
    const gy = H * (0.08 + r() * 0.24);
    out += `<circle cx="${gx.toFixed(0)}" cy="${gy.toFixed(0)}" r="${(340 + r() * 180).toFixed(0)}" fill="${g ? c.gb : c.ga}" opacity="${(gob * (0.8 + r() * 0.4)).toFixed(3)}" filter="url(#nb-blur)"/>`;
  }
  const layers = [
    { off: 0,   amp: 300, f: 1 / 900, fill: "#0E1524", fop: 0.55, crest: c.b, cop: 0.34, cw: 1.7, ns: 31, mk: 1 },
    { off: 210, amp: 220, f: 1 / 650, fill: "#0B0F19", fop: 0.65, crest: c.a, cop: 0.30, cw: 1.5, ns: 47, mk: 0.45 },
    { off: 400, amp: 130, f: 1 / 480, fill: "#080B12", fop: 0.75, crest: "#8992A5", cop: 0.12, cw: 1.3, ns: 59, mk: 0.15 },
  ];
  for (const L of layers) {
    const nz = valueNoise1D(seed + L.ns), nz2 = valueNoise1D(seed + L.ns + 7), nz3 = valueNoise1D(seed + L.ns + 13);
    let d = `M -20 ${H + 20}`, crest = "";
    for (let x = -20; x <= SW + 20; x += 36) {
      const wv = altW(x);
      const base = H * (0.525 + (wv > 0 ? 0.25 : 0.20) * wv) + L.off;
      // hard amplitude contrast: long near-flat calms AND a sharper massif;
      // valleys run calm so the terrain lift doesn't mask the deep dip
      const ae = L.amp * (0.15 + 2.2 * Math.pow(ampMod(x / (2.2 * W)), 2.2)) * (1 - 0.85 * Math.max(0, wv));
      const mBump = mAmp * L.mk * Math.exp(-((x - mx) ** 2) / (2 * mSig * mSig)) * (0.75 + 0.5 * nz3(x / 90));
      const y = Math.min(H - 30, base - ae * (0.50 * nz(x * L.f) + 0.32 * nz2(x * L.f * 2.7) + 0.18 * nz3(x * L.f * 6.1)) - mBump);
      d += ` L ${x} ${y.toFixed(1)}`;
      crest += (crest ? " L" : "M") + ` ${x} ${y.toFixed(1)}`;
    }
    d += ` L ${SW + 20} ${H + 20} Z`;
    out += `<path d="${d}" fill="${L.fill}" opacity="${L.fop}"/>`;
    out += `<path d="${crest}" fill="none" stroke="${L.crest}" stroke-width="${L.cw}" opacity="${L.cop}"/>`;
  }
  return out;
}

// 4 · orbits — glow + arc fragments. Scheduler with 0.7-2.5 slide intervals
// + one forced ≥1.6-slide dead stretch; free vertical glow placement; color
// repeats allowed (no ABAB); arc count 0-5 with one always-bare glow.
function genOrbits(seed: number, n: number, hue: NativeHue): string {
  const c = HUES[hue], SW = n * W, r = mulberry32(seed + 41);
  let out = "";
  // The dead stretch is judged on VISIBLE rest (center gap minus glow radii,
  // round-2 finding) — force a wider center gap AND shrink the glows that
  // flank it so the rest survives their falloff.
  const xs = schedule(r, SW, 0.7, 2.5, 2.4);
  let big = 0, bi = -1;
  for (let i = 1; i < xs.length; i++) { const g = xs[i] - xs[i - 1]; if (g > big) { big = g; bi = i; } }
  const bareIdx = Math.floor(r() * xs.length);
  const boost = glowAlphaBoost(hue);
  for (let i = 0; i < xs.length; i++) {
    const cx = xs[i];
    const cy = H * (0.10 + r() * 0.80);
    const flank = i === bi || i === bi - 1;
    const gr = 380 * (0.55 + r() * 0.95) * (flank ? 0.6 : 1);
    const gcol = r() < 0.55 ? c.gb : c.ga;
    const rings = i === bareIdx ? 0 : Math.floor(r() * 6);
    for (let k = 0; k < rings; k++) {
      const rad = 220 + k * (130 + r() * 70);
      // min sweep 1.3 rad: short fragments at glow edges read as broken
      // dashes at native brightness (round-2 finding)
      const a0 = r() * Math.PI * 2, sweep = 1.3 + r() * 2.2;
      const x0 = cx + rad * Math.cos(a0), y0 = cy + rad * Math.sin(a0);
      const x1 = cx + rad * Math.cos(a0 + sweep), y1 = cy + rad * Math.sin(a0 + sweep);
      const accent = r() > 0.85;
      const col = accent ? (r() > 0.5 ? c.a : c.b) : "#8992A5";
      out += `<path d="M ${x0.toFixed(0)} ${y0.toFixed(0)} A ${rad.toFixed(0)} ${rad.toFixed(0)} 0 ${sweep > Math.PI ? 1 : 0} 1 ${x1.toFixed(0)} ${y1.toFixed(0)}" fill="none" stroke="${col}" stroke-width="${accent ? 1.8 : 1.1}" opacity="${accent ? 0.18 : 0.09}"/>`;
      if (accent) out += `<circle cx="${x1.toFixed(0)}" cy="${y1.toFixed(0)}" r="3.4" fill="${col}" opacity="0.5"/>`;
    }
    out += `<circle cx="${cx.toFixed(0)}" cy="${cy.toFixed(0)}" r="${gr.toFixed(0)}" fill="${gcol}" opacity="${((0.05 + r() * 0.035) * boost).toFixed(3)}" filter="url(#nb-blur)"/>`;
  }
  return out;
}

// 5 · skyline — equalizer-bar floor. Aperiodic glow scheduler (one glow
// rides LOW near the bars); valley floors modulated so no two valleys match;
// one mid-field accent stub cluster as a landmark; uneven accent clustering.
function genSkyline(seed: number, n: number, hue: NativeHue): string {
  const c = HUES[hue], SW = n * W, r = mulberry32(seed + 17);
  const nz = valueNoise1D(seed + 71);
  const floorMod = valueNoise1D(seed + 733);
  const hillMod = valueNoise1D(seed + 811);
  let out = "";
  const gxs = schedule(r, SW, 0.7, 2.3);
  const lowIdx = Math.floor(r() * gxs.length);
  const boost = glowAlphaBoost(hue);
  let runCol = "", runLen = 0;
  for (let i = 0; i < gxs.length; i++) {
    // Neighbor-aware radius: adjacent glows must not fuse into one flat
    // slab across multiple slides (round-2 finding) — cap each radius by the
    // gap to its neighbors, and never let one color run 3 glows deep.
    const gapPrev = i > 0 ? gxs[i] - gxs[i - 1] : Infinity;
    const gapNext = i < gxs.length - 1 ? gxs[i + 1] - gxs[i] : Infinity;
    const rad = Math.min(430 * (0.55 + r() * 1.05), 0.72 * Math.min(gapPrev, gapNext, 2.4 * W));
    const low = i === lowIdx;
    const gy = low ? H - 340 - r() * 160 : 120 + r() * 260;
    let col = r() < 0.55 ? c.gb : c.ga;
    if (col === runCol && runLen >= 2) col = col === c.gb ? c.ga : c.gb;
    if (col === runCol) runLen++; else { runCol = col; runLen = 1; }
    out += `<circle cx="${gxs[i].toFixed(0)}" cy="${gy.toFixed(0)}" r="${rad.toFixed(0)}" fill="${col}" opacity="${((0.05 + r() * 0.045) * boost).toFixed(3)}" filter="url(#nb-blur)"/>`;
  }
  const stubX = (0.8 + r() * (n - 1.6)) * W;
  const bw = 30, gap = 13;
  for (let x = 6; x + bw <= SW - 4; x += bw + gap) {
    const hBase = 34 + 120 * floorMod(x / (2.4 * W));
    // hillMod decorrelates peak heights (two hills topped out at the exact
    // same pixel in round 2)
    const h = hBase + 300 * Math.pow(nz(x / 320), 1.6) * (0.8 + 0.4 * hillMod(x / (1.7 * W)));
    const nearStub = Math.abs(x - stubX) < 110;
    // never an accent flush against the strip edge — a clipped saturated bar
    // on the last slide reads as a bug, not an endless world
    const edge = x < 60 || x + bw > SW - 60;
    const accent = !edge && (nearStub ? r() > 0.45 : r() > 0.92);
    const col = accent ? (r() > 0.5 ? c.a : c.b) : "#8992A5";
    const hh = nearStub && accent ? h + 130 + r() * 90 : h;
    const tt = H - 60 - hh;
    out += `<rect x="${x}" y="${tt.toFixed(0)}" width="${bw}" height="${hh.toFixed(0)}" fill="${col}" opacity="${accent ? 0.20 : 0.09}"/>`;
    if (accent) out += `<rect x="${x}" y="${tt.toFixed(0)}" width="${bw}" height="4" fill="${col}" opacity="0.6"/>`;
  }
  out += `<line x1="0" y1="${H - 58}" x2="${SW}" y2="${H - 58}" stroke="#8992A5" stroke-width="1" opacity="0.16"/>`;
  return out;
}

const GENERATORS: Record<NativeFamily, (seed: number, n: number, hue: NativeHue) => string> = {
  traces: genTraces, isobars: genIsobars, ridge: genRidge,
  orbits: genOrbits, skyline: genSkyline,
};

// Full-strip cache: a deck of N slides shares one strip, and compose calls
// per slide. Tiny entries-count cap — a working session touches a handful of
// (fam, seed, n, hue) tuples, but the picker cycling families/palettes
// shouldn't grow this unbounded.
let stripCache: Record<string, string> = {};
let stripCacheSize = 0;

function stripFor(fam: NativeFamily, seed: number, n: number, hue: NativeHue): string {
  const key = fam + "|" + seed + "|" + n + "|" + hue;
  const hit = stripCache[key];
  if (hit !== undefined) return hit;
  if (stripCacheSize >= 48) { stripCache = {}; stripCacheSize = 0; }
  const out = GENERATORS[fam](seed, n, hue);
  stripCache[key] = out;
  stripCacheSize++;
  return out;
}

// v3.2 styles are fixed 10-page canvases — the strip is independent of deck
// length, so the cache key drops n (bigger hit rate when counts change).
function styleStripFor(key: string, seed: number, hue: NativeHue): string {
  const ck = "s|" + key + "|" + seed + "|" + hue;
  const hit = stripCache[ck];
  if (hit !== undefined) return hit;
  if (stripCacheSize >= 48) { stripCache = {}; stripCacheSize = 0; }
  const out = STYLE_DEFS[key].gen(seed >>> 0, hue);
  stripCache[ck] = out;
  stripCacheSize++;
  return out;
}

/**
 * Per-slide inner markup for a native infinity backdrop: near-black base +
 * the slide's 1080-wide window onto the continuous strip. Drop-in replacement
 * for a baked bg's inner SVG in composeLibrarySvg — never mirrored.
 *
 * The nb-blur / nb-base ids are shared by every native slide; all definitions
 * are identical, so inline co-existence in one document resolves to the same
 * visual result (same contract the baked gNNNN gradient ids rely on).
 *
 * v3.1 classics scale their strip to the deck length (window = idx*1080).
 * v3.2 style compositions are ONE fixed 10-page graphic: a deck of n<10
 * slides shows a contiguous seeded window of frames — off = seed % (10-n+1),
 * frame = off+idx — so different posts land on different stretches of the
 * same world and a 10-page deck rides the full arc.
 *
 * @param fam  bare generator key — a STYLE_DEFS key or a classic family name
 * @param idx  the slide's deck position (window offset — idx*1080)
 * @param n    deck length (strip width — features scale their count with it)
 */
export function renderNativeBgInner(
  fam: string,
  seed: number,
  idx: number,
  n: number,
  hue: NativeHue
): string {
  const safeHue = HUES[hue] ? hue : "blend";
  const genKey = nativeGenKeyOf(fam);
  let safeN = Math.max(1, Math.min(24, Math.floor(n) || 1));
  let safeIdx = Math.max(0, Math.min(safeN - 1, Math.floor(idx) || 0));
  let inner: string;
  if (STYLE_DEFS[genKey]) {
    const shown = Math.min(safeN, NATIVE_PAGES);
    const off = (seed >>> 0) % (NATIVE_PAGES - shown + 1);
    safeIdx = Math.min(off + safeIdx, NATIVE_PAGES - 1);
    safeN = NATIVE_PAGES;
    inner = styleStripFor(genKey, seed >>> 0, safeHue);
  } else {
    inner = stripFor(genKey as NativeFamily, seed >>> 0, safeN, safeHue);
  }
  // nb-grain: ~4%-alpha cool-white noise over everything — dithers the 1-LSB
  // concentric banding soft glows show on OLED (round-2 panel finding).
  // feTurbulence is deterministic (fixed default seed), per-slide identical,
  // and far below text-contrast relevance.
  return (
    `<defs><filter id="nb-blur" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="90"/></filter>` +
    `<filter id="nb-grain"><feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="2" stitchTiles="stitch"/>` +
    `<feColorMatrix type="matrix" values="0 0 0 0 0.72  0 0 0 0 0.78  0 0 0 0 0.90  0.08 0 0 0 0"/></filter>` +
    `<linearGradient id="nb-base" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="#07080D"/><stop offset="1" stop-color="#050609"/></linearGradient></defs>` +
    `<rect width="${W}" height="${H}" fill="url(#nb-base)"/>` +
    `<g transform="translate(${-safeIdx * W} 0)">${inner}</g>` +
    `<rect width="${W}" height="${H}" filter="url(#nb-grain)"/>`
  );
}
