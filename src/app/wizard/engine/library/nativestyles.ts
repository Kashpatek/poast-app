// @ts-nocheck — the GENERATED STYLES section below is untyped designer JS
// spliced in by verify/port-styledefs.js; runtime gates (render.js contract,
// gallery smoke, probes) carry correctness for this file.
// ═══════════════════════════════════════════════════════════════════════════
// Library mode · NATIVE infinity STYLE COMPOSITIONS (v3.2, 2026-07-14).
//
// The second generation of native infinity backdrops: where the v3.1
// classics (nativebg.ts) are sparse fields scaled to the deck length, each
// STYLE here is ONE large designed graphic — a fixed 10-page canvas
// (10800×1350) with an evolving act-structure — that the app cuts into
// 1080×1350 frames. Decks shorter than 10 show a contiguous seeded window
// of frames, so any post sees a different stretch of the same world.
// The look is allowed to CHANGE across the pages (a fab hall opens into an
// empty corridor, a molten river cools into a delta) as long as every
// transition flows smoothly — no seams, no mirroring, nothing aligned to a
// frame boundary.
//
// Styles symbolize their category by SUBJECT and are multicolor on the hue
// kit — `gen(seed, hue)` re-skins any composition to any category tint.
//
// SELF-CONTAINED ON PURPOSE: no imports. verify/build-gallery-natives.js
// transpiles this file to public/library/nativestyles.mjs so the review
// gallery renders the exact same generators — keep it dependency-free or
// the browser module breaks.
// ═══════════════════════════════════════════════════════════════════════════

export type NativeStyleHue = "blend" | "amber" | "cobalt" | "green";

export const NATIVE_PAGES = 10;

const W = 1080;
const H = 1350;
const SW = NATIVE_PAGES * W;

export interface NativeStyleDef {
  name: string;
  desc: string;
  /** the category this composition SYMBOLIZES (its default pool) — every
   *  style still renders in any hue via gen(seed, hue) */
  cat: NativeStyleHue;
  /** full 10-page strip inner SVG in global coords [0, 10800] × [0, 1350] */
  gen: (seed: number, hue: NativeStyleHue) => string;
}

/* ── deterministic toolkit (same idiom as nativebg.ts — duplicated here so
      this file stays import-free for the gallery transpile) ── */

function mulberry32(a: number): () => number {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

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

function schedule(r: () => number, sw: number, minS: number, maxS: number, forceGapS?: number): number[] {
  const xs: number[] = [];
  let x = (0.15 + r() * 0.75) * W;
  while (x < sw - 0.2 * W) {
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

const HUES: Record<NativeStyleHue, { a: string; b: string; ga: string; gb: string; c: string }> = {
  blend:  { a: "#F7B041", b: "#0092FF", ga: "#FFC969", gb: "#3FA9FF", c: "#E8ECF5" },
  amber:  { a: "#FF8A1E", b: "#F7B041", ga: "#FFBE5C", gb: "#FFD08A", c: "#FFE2B8" },
  cobalt: { a: "#0092FF", b: "#66C4FF", ga: "#2FA5FF", gb: "#8FD4FF", c: "#D6EDFF" },
  green:  { a: "#35C9A4", b: "#8FEFD2", ga: "#4BDDB7", gb: "#A8F5DF", c: "#DDF7EE" },
};

const INKS = {
  navy: "#0E1524", graphite: "#0B0F19", coal: "#080B12",
  platinum: "#8992A5", silver: "#B9C0CF",
};

function glowAlphaBoost(hue: NativeStyleHue): number {
  return hue === "amber" || hue === "green" ? 1.25 : 1;
}


/* ── the style registry — winners from the native-lab2 design panel land
      here. Keys live in the same "n:<key>" space as the classic families. ── */

export const STYLE_DEFS: Record<string, NativeStyleDef> = {};

// ═══ BEGIN GENERATED STYLES (verify/port-styledefs.js — do not edit by hand) ═══

STYLE_DEFS["citygrid"] = (function () {
const PAGES = NATIVE_PAGES;
void PAGES;
// citygrid · "datacenter campus" — native-infinity 10-page composition
//
// PAGE MAP (1 page = 1080px; ALL envelopes are smooth raised-cosine humps in
// x — no term is 1080-periodic, no style break at any k*1080):
//   p1-2  (0-2160)     campus edge: dark land, a few scattered low halls,
//                      ONE distant far-layer block w/ faint slits + soft gb
//                      glow (~x 520-900), roadside poles, thin haze.
//   p3-5  (2160-5400)  cluster ONE swells (dens hump c=3.4W, hw=2.3W):
//                      dense overlapping halls, two cooling-tower groups,
//                      pylon run begins ~x 2350 carrying ONE hue-b wire
//                      swooping pylon to pylon.
//   p6    (5400-6480)  the wire drops into a substation yard (sX≈5.66-5.94W)
//                      and the HERO CRANE landmark stands at crX≈5.99-6.19W,
//                      jib over the yard, ga work light at the hook (bottom
//                      quarter) + soft pool on the ground. Appears ONCE, and
//                      both sX and crX stay >=0.22W off every frame boundary.
//   p7-8  (6480-8640)  cluster TWO (hump c=7.3W, hw=1.5W) — dimmer litEnv,
//                      one tower group, no pylons: the campus winding down.
//   p9-10 (8640-10800) outskirts: land goes dark, cool haze lingers, ONE
//                      lone lit block far off (center 10.07-10.44 pages, ga
//                      slits + soft dome), then near-empty dark land.
//
// Structure is neutral ink (navy silhouettes, platinum hairlines); ALL hue
// lives in light: window slits (mostly platinum, some a, some b — capped
// runs, whole dark stretches), the b power line, ga/gb ground haze + cluster
// domes, the ga crane work light. Mid-band (y 300-1000) carries only
// hairline-scale features; every glow is anchored y>1010.
//
// v3.2 DENSIFY PASS (neutral-ink detail only; layout/anchors byte-identical —
// all new randomness from fresh mulberry32 streams appended after the master
// r/rF/rW/rD declarations, never inserted mid-sequence):
//   · halls >300px get facade louver banks + dock recesses; halls >320px in
//     dense zones get rooftop plant (chiller bumps, exhaust stacks, whisper
//     plumes <=0.045)
//   · cooling towers: tallest per cluster-1 group lifted to the y1002 shell
//     ceiling (mid-band law wins over raw +50px), lip 0.24, air-inlet
//     colonnade ticks + basin hairline; slow plume-lift wisps drift downwind
//     above each group (top edge >=y950, <=0.045)
//   · substation anatomy: insulator strings, twin busbars, radiator fins,
//     disconnect A-frame, lightning mast (<=y1090)
//   · backup-generator yards (bund + enclosure rows) at ~sX-840 and ~6.55W;
//     security-fence runs w/ light poles at ~sX-740 and past the crane
//   · power line: 2.2px navy under-stroke beneath the b wire (path geometry
//     untouched) + stroke opacity 0.48*min(1.15,boost) so amber/green hold
//     their edge over ground haze
//   · crane apex dot -> aviation beacon (r2.2 @0.7 + plain r7 halo @0.10)
//   · presence floor: when a dens>0.4 stretch leaves the trailing 0.75W
//     window under 35% built, the next culled candidate is force-kept from a
//     fresh rP stream (master r() consumption unchanged)
//   · far layer: extra slits (eff. chance ~0.45, up to 2) + 2-3 far tower
//     silhouettes (navy 0.55) via rF2 — rF stream untouched
// (helpers provided by the registry's shared toolkit)
return {
  key: 'citygrid',
  name: 'datacenter campus',
  cat: 'blend',
  desc: 'night campus skyline: data halls + cooling towers, one power line swooping into a crane-lit substation',
  gen(seed, hue) {
    const c = HUES[hue], SW = PAGES * W, boost = glowAlphaBoost(hue);
    const r = mulberry32(seed + 401);   // master layout
    const rF = mulberry32(seed + 907);  // far layer
    const rW = mulberry32(seed + 613);  // windows
    const rD = mulberry32(seed + 149);  // detail (fences, dots, haze, braces)
    const gNz = valueNoise1D(seed + 55);
    const fNz = valueNoise1D(seed + 77);
    // v3.2 densify pass — FRESH independent streams only (never touch the
    // master r/rF/rW/rD consumption order: anchors + layout stay byte-identical)
    const rE = mulberry32(seed + 223);  // facade louvers/docks + rooftop plant rows
    const rP = mulberry32(seed + 271);  // presence-floor forced halls
    const rT = mulberry32(seed + 283);  // tower colonnades + plume lift
    const rS = mulberry32(seed + 307);  // substation anatomy
    const rG = mulberry32(seed + 311);  // generator yards + security fences
    const rF2 = mulberry32(seed + 331); // far-layer extra slits + far towers
    const P = (n) => Math.round(n);
    const O = (n) => Math.min(1, n).toFixed(3);

    // --- smooth arc envelopes -------------------------------------------
    const hump = (x, cx, hw) => {
      const t = Math.abs(x - cx) / hw;
      return t >= 1 ? 0 : 0.5 + 0.5 * Math.cos(Math.PI * t);
    };
    const dens = (x) => Math.min(1,
      0.10 + hump(x, 3.4 * W, 2.45 * W) + 0.5 * hump(x, 5.55 * W, 1.0 * W) + 0.72 * hump(x, 7.3 * W, 1.5 * W));
    const lit = (x) => {
      const v = Math.min(1, 0.3 + 0.75 * hump(x, 3.4 * W, 2.4 * W) + 0.38 * hump(x, 7.3 * W, 1.7 * W));
      let t = Math.min(1, Math.max(0, (x - 8.2 * W) / (1.4 * W)));
      t = t * t * (3 - 2 * t);
      return v * (1 - 0.78 * t);
    };
    const gY = (x) => H - 132 + 40 * (gNz(x / (1.9 * W)) - 0.5);
    const fgY = (x) => gY(x) - 74 - 42 * fNz(x / (1.3 * W));

    // --- fixed scene anchors (consumed from r in this order) -------------
    const dbx = (0.45 + r() * 0.32) * W;              // distant block, p1
    const crX = (5.55 + r() * 0.18) * W;              // hero crane (landmark)
    const sX = crX - (250 + r() * 80);                // substation yard center
    const gantX = sX - 45 + r() * 26;                 // gantry the wire lands on
    const gantTop = gY(gantX) - (118 + r() * 26);

    // --- FAR LAYER --------------------------------------------------------
    let far = '';
    const farOn = (x) => {
      let a = Math.min(1, Math.max(0, (x - 1.15 * W) / (1.05 * W)));
      a = a * a * (3 - 2 * a);
      const b = 1 - Math.min(1, Math.max(0, (x - 8.35 * W) / (0.9 * W)));
      return a * b;
    };
    let fx = -180 + rF() * 240;
    const farBlocks = []; // recorded for the v3.2 densify pass (no rng cost)
    while (fx < SW + 100) {
      const w = 100 + rF() * 240;
      const keep = rF() < (0.22 + 0.6 * dens(fx)) * farOn(fx);
      if (keep) {
        const h = 34 + rF() * 84;
        const y = fgY(fx + w / 2);
        far += `<rect x="${P(fx)}" y="${P(y - h)}" width="${P(w)}" height="${P(h)}" fill="${INKS.navy}" opacity="0.6"/>`;
        const hadSlit = rF() < 0.3;
        if (hadSlit) far += `<rect x="${P(fx + 14 + rF() * (w - 40))}" y="${P(y - h + 8 + rF() * Math.max(4, h - 16))}" width="${P(10 + rF() * 12)}" height="2.5" fill="${INKS.platinum}" opacity="${O(0.13 + 0.1 * rF())}"/>`;
        farBlocks.push({ fx, w, y, h, hadSlit });
      }
      fx += w + 40 + rF() * 330;
    }
    // whisper of depth at the very start (bleeds off the canvas edge)
    {
      const w0 = 120 + rF() * 90, x0 = -50 + rF() * 220, h0 = 26 + rF() * 22;
      far += `<rect x="${P(x0)}" y="${P(fgY(x0 + w0 / 2) - h0)}" width="${P(w0)}" height="${P(h0)}" fill="${INKS.navy}" opacity="0.45"/>`;
    }
    // the ONE distant block on page 1
    {
      const w = 150 + r() * 70, y = fgY(dbx), h = 44 + r() * 22;
      far += `<ellipse cx="${P(dbx + w / 2)}" cy="${P(y - 8)}" rx="200" ry="85" fill="${c.gb}" opacity="${O(0.1 * boost)}" filter="url(#nb-blur)"/>`;
      far += `<rect x="${P(dbx)}" y="${P(y - h)}" width="${P(w)}" height="${P(h)}" fill="${INKS.navy}" opacity="0.58"/>`;
      far += `<rect x="${P(dbx + 16 + r() * 20)}" y="${P(y - h + 9)}" width="${P(12 + r() * 10)}" height="2.5" fill="${INKS.platinum}" opacity="0.24"/>`;
      far += `<rect x="${P(dbx + w * 0.55 + r() * 18)}" y="${P(y - h + 12 + r() * 8)}" width="${P(11 + r() * 9)}" height="2.5" fill="${c.b}" opacity="0.3"/>`;
    }

    // --- GROUND HAZE (behind the mid halls, so they silhouette) ----------
    let haze = '';
    const hxs = schedule(rD, SW, 0.55, 1.6);
    let hRun = '', hLen = 0;
    for (const hx of hxs) {
      let col = rD() < 0.5 ? c.ga : c.gb;
      if (col === hRun && hLen >= 2) col = col === c.ga ? c.gb : c.ga;
      if (col === hRun) hLen++; else { hRun = col; hLen = 1; }
      haze += `<ellipse cx="${P(hx)}" cy="${P(gY(hx) + 30)}" rx="${P(300 + rD() * 420)}" ry="${P(110 + rD() * 90)}" fill="${col}" opacity="${O((0.045 + 0.06 * dens(hx)) * boost)}" filter="url(#nb-blur)"/>`;
    }
    haze += `<ellipse cx="${P((3.25 + r() * 0.45) * W)}" cy="${P(H - 190)}" rx="680" ry="230" fill="${c.gb}" opacity="${O(0.095 * boost)}" filter="url(#nb-blur)"/>`;
    haze += `<ellipse cx="${P((7.1 + r() * 0.45) * W)}" cy="${P(H - 180)}" rx="580" ry="200" fill="${c.ga}" opacity="${O(0.058 * boost)}" filter="url(#nb-blur)"/>`;
    haze += `<ellipse cx="${P((9.05 + r() * 0.3) * W)}" cy="${P(H - 130)}" rx="540" ry="160" fill="${c.gb}" opacity="${O(0.06 * boost)}" filter="url(#nb-blur)"/>`;
    haze += `<ellipse cx="${P((9.75 + r() * 0.3) * W)}" cy="${P(H - 110)}" rx="500" ry="140" fill="${c.gb}" opacity="${O(0.05 * boost)}" filter="url(#nb-blur)"/>`;

    // --- PYLON RUN + THE WIRE (behind the halls) --------------------------
    let pyl = '';
    const wirePts = [];
    { // stub pole where the line steps down into the campus
      const px = (2.2 + r() * 0.25) * W - (300 + r() * 120);
      const g = gY(px), top = g - (175 + r() * 40);
      pyl += `<path d="M ${P(px)} ${P(g)} L ${P(px)} ${P(top)} M ${P(px - 16)} ${P(top + 10)} L ${P(px + 16)} ${P(top + 10)}" stroke="${INKS.platinum}" stroke-width="1.4" fill="none" opacity="0.16"/>`;
      wirePts.push([px, top + 4]);
    }
    let px = (2.24 + r() * 0.22) * W;
    const pxs = [];
    while (px < sX - 380) { pxs.push(px); px += (0.42 + Math.pow(r(), 1.4) * 0.34) * W; }
    pxs.push(sX - (150 + r() * 60));
    for (const x of pxs) {
      const g = gY(x), top = g - (355 + r() * 85);
      const arm1 = top + 30, arm2 = top + 62;
      const s1 = 34 + r() * 8, s2 = 22 + r() * 6;
      pyl += `<path d="M ${P(x - 16)} ${P(g)} L ${P(x - 4)} ${P(top + 26)} L ${P(x)} ${P(top)} L ${P(x + 4)} ${P(top + 26)} L ${P(x + 16)} ${P(g)} M ${P(x - 12)} ${P(g - 80)} L ${P(x + 9)} ${P(g - 172)} M ${P(x + 12)} ${P(g - 80)} L ${P(x - 9)} ${P(g - 172)} M ${P(x - s1)} ${P(arm1)} L ${P(x + s1)} ${P(arm1)} M ${P(x - s2)} ${P(arm2)} L ${P(x + s2)} ${P(arm2)}" stroke="${INKS.platinum}" stroke-width="1.5" fill="none" opacity="0.21"/>`;
      const side = rD() < 0.5 ? -1 : 1;
      const ax = x + side * (s1 - 3), ay = arm1 + 9;
      pyl += `<path d="M ${P(ax)} ${P(arm1)} L ${P(ax)} ${P(ay)}" stroke="${INKS.platinum}" stroke-width="1.2" fill="none" opacity="0.2"/>`;
      pyl += `<circle cx="${P(ax)}" cy="${P(ay)}" r="1.6" fill="${c.gb}" opacity="0.5"/>`;
      wirePts.push([ax, ay]);
    }
    let wd = `M ${P(wirePts[0][0])} ${P(wirePts[0][1])}`;
    for (let i = 1; i < wirePts.length; i++) {
      const [x1, y1] = wirePts[i - 1], [x2, y2] = wirePts[i];
      const sag = 55 + r() * 60;
      wd += ` Q ${P((x1 + x2) / 2)} ${P((y1 + y2) / 2 + 2 * sag)} ${P(x2)} ${P(y2)}`;
    }
    { // final swoop down into the substation gantry
      const [lx, ly] = wirePts[wirePts.length - 1];
      wd += ` Q ${P((lx + gantX) / 2 + 40)} ${P((ly + gantTop) / 2 + 66)} ${P(gantX)} ${P(gantTop)}`;
    }
    // v3.2: dark under-stroke halo so the wire keeps its edge on every hue
    // (amber's c.b sat on amber ground haze and vanished mid-swoop) — plus a
    // mild wire-opacity boost for the boosted hues. Path geometry untouched.
    pyl += `<path d="${wd}" stroke="${INKS.navy}" stroke-width="2.2" fill="none" opacity="0.5"/>`;
    pyl += `<path d="${wd}" stroke="${c.b}" stroke-width="1.4" fill="none" opacity="${O(0.48 * Math.min(1.15, boost))}"/>`;

    // --- MID LAYER: DATA HALLS -------------------------------------------
    let mid = '';
    const bRects = [];  // kept hall [x0,x1,topY] — for the tower prominence pass
    const keptIv = [];  // kept hall intervals — for the presence floor
    // v3.2 facade pass (rE only): intake-louver banks + loading-dock recesses,
    // GUARANTEED on any hall face wider than 300px (no more dead walls)
    const facade = (x0, w0, top0, gy0) => {
      let s = '';
      const h0 = gy0 - top0;
      const nb = 2 + Math.floor(rE() * 3); // 2-4 louver banks, aperiodic x
      for (let b = 0; b < nb; b++) {
        const lw = 12 + rE() * 6, lx = x0 + 18 + rE() * Math.max(8, w0 - lw - 40);
        const nl = 3 + Math.floor(rE() * 3); // 3-5 hairlines per bank
        const ly = top0 + 12 + rE() * Math.max(4, h0 - 30);
        const lop = O(0.05 + rE() * 0.03);
        for (let li = 0; li < nl; li++) {
          const yy = ly + li * 4.5;
          if (yy > gy0 - 9) break;
          s += `<rect x="${P(lx)}" y="${P(yy)}" width="${P(lw)}" height="1" fill="${INKS.platinum}" opacity="${lop}"/>`;
        }
      }
      const nd = 1 + (rE() < 0.4 ? 1 : 0); // 1-2 dock recesses
      for (let dd = 0; dd < nd; dd++) {
        const dw = 26 + rE() * 14, dh = 14 + rE() * 9, dx0 = x0 + 22 + rE() * Math.max(8, w0 - dw - 48);
        s += `<rect x="${P(dx0)}" y="${P(gy0 - dh)}" width="${P(dw)}" height="${P(dh)}" fill="${INKS.navy}" opacity="0.25"/>`;
        s += `<rect x="${P(dx0)}" y="${P(gy0 - dh - 1)}" width="${P(dw)}" height="1" fill="${INKS.platinum}" opacity="0.07"/>`;
      }
      return s;
    };
    // v3.2 rooftop plant row (rE only): chiller/AHU bumps at jittered gaps +
    // exhaust stacks with whisper plume wisps — every wide hall gets its plant
    const roofPlant = (x0, w0, top0) => {
      let s = '';
      let cx0 = x0 + 10 + rE() * 30;
      const nC = 3 + Math.floor(rE() * 4); // 3-6 bumps, 24-80px jittered gaps
      for (let ci = 0; ci < nC && cx0 < x0 + w0 - 26; ci++) {
        const cw = 10 + rE() * 6, ch = 6 + rE() * 6;
        s += `<rect x="${P(cx0)}" y="${P(top0 - ch)}" width="${P(cw)}" height="${P(ch)}" fill="${INKS.navy}" opacity="0.9"/>`;
        cx0 += cw + 24 + rE() * 56;
      }
      const nS = 1 + (rE() < 0.45 ? 1 : 0); // 1-2 thin exhaust stacks
      for (let si = 0; si < nS; si++) {
        const sw2 = 2 + rE(), sh2 = 18 + rE() * 12, sx2 = x0 + 16 + rE() * Math.max(10, w0 - 42);
        s += `<rect x="${P(sx2)}" y="${P(top0 - sh2)}" width="${sw2.toFixed(1)}" height="${P(sh2)}" fill="${INKS.navy}" opacity="0.9"/>`;
        s += `<ellipse cx="${P(sx2 + (rE() - 0.5) * 14)}" cy="${P(top0 - sh2 - 18 - rE() * 12)}" rx="${P(26 + rE() * 14)}" ry="${P(10 + rE() * 6)}" fill="${INKS.silver}" opacity="${O(0.028 + rE() * 0.016)}" filter="url(#nb-blur)"/>`;
      }
      return s;
    };
    { // two guaranteed halls on the campus edge (p2 must not go dead) —
      // deliberately unalike: a compact taller shed, then a long low hall
      const e1 = (1.38 + r() * 0.3) * W, w1 = 170 + r() * 90, h1 = 84 + r() * 40;
      const e2 = e1 + w1 + 240 + r() * 300, w2 = 360 + r() * 170, h2 = 40 + r() * 18;
      for (const [ex, ew, eh] of [[e1, w1, h1], [e2, w2, h2]]) {
        const gy = gY(ex + ew / 2);
        mid += `<rect x="${P(ex)}" y="${P(gy - eh)}" width="${P(ew)}" height="${P(eh + 6)}" fill="${INKS.navy}" opacity="0.9"/>`;
        mid += `<line x1="${P(ex)}" y1="${P(gy - eh)}" x2="${P(ex + ew)}" y2="${P(gy - eh)}" stroke="${INKS.silver}" stroke-width="1" opacity="0.1"/>`;
        bRects.push([ex, ex + ew, gy - eh]);
        if (ew > 300) mid += facade(ex, ew, gy - eh, gy);
      }
      mid += `<rect x="${P(e1 + 20 + r() * (w1 - 60))}" y="${P(gY(e1) - h1 + 12 + r() * 8)}" width="${P(14 + r() * 10)}" height="3" fill="${r() < 0.6 ? INKS.platinum : c.b}" opacity="${O(0.3 + r() * 0.12)}"/>`;
      mid += `<rect x="${P(e2 + 30 + r() * (w2 - 130))}" y="${P(gY(e2) - 16 - r() * 8)}" width="${P(55 + r() * 60)}" height="2.5" fill="${INKS.platinum}" opacity="0.17"/>`;
    }
    // outskirts: the main rank dies away smoothly after ~p8.4 (dark land)
    const mainOn = (x) => {
      let t = Math.min(1, Math.max(0, (x - 8.35 * W) / (0.95 * W)));
      t = t * t * (3 - 2 * t);
      return 1 - 0.92 * t;
    };
    let winRun = '', winLen = 0, blockCount = 0;
    let bx = -240 + r() * 180;
    while (bx < SW + 140) {
      const d = dens(bx);
      const w = 110 + (0.3 + 0.7 * r()) * (150 + 430 * d);
      const inYard = bx + w > sX - 280 && bx < sX + 200; // keep the yard clear
      const keepMain = r() < (0.26 + 0.72 * d) * mainOn(bx) && !inYard;
      if (keepMain) {
        // cluster 2 stays lower + dimmer than cluster 1 (the campus winding down)
        let h = Math.max(40, (52 + 265 * Math.pow(r(), 1.35)) * (0.5 + 0.9 * d) * (0.55 + 0.45 * mainOn(bx)) * (1 - 0.28 * hump(bx, 7.35 * W, 1.7 * W)));
        if (r() < 0.13 && d > 0.45) h *= 1.4 + r() * 0.45; // rare taller block — jagged skyline
        const gy = gY(bx + w / 2), top = gy - h;
        mid += `<rect x="${P(bx)}" y="${P(top)}" width="${P(w)}" height="${P(h + 6)}" fill="${INKS.navy}" opacity="0.9"/>`;
        mid += `<line x1="${P(bx)}" y1="${P(top)}" x2="${P(bx + w)}" y2="${P(top)}" stroke="${INKS.silver}" stroke-width="1" opacity="${O(0.09 + 0.11 * d)}"/>`;
        if (rD() < 0.3 && w > 300) mid += `<line x1="${P(bx + w * (0.3 + rD() * 0.4))}" y1="${P(top + 4)}" x2="${P(bx + w * (0.3 + rD() * 0.4))}" y2="${P(gy - 8)}" stroke="${INKS.platinum}" stroke-width="1" opacity="0.05"/>`;
        if (h > 64 && rD() < 0.55) { // rooftop plant
          const vn = 1 + Math.floor(rD() * 2);
          for (let v = 0; v < vn; v++) {
            const vw = 14 + rD() * 20, vx = bx + 14 + rD() * Math.max(10, w - vw - 28), vh = 7 + rD() * 9;
            mid += `<rect x="${P(vx)}" y="${P(top - vh)}" width="${P(vw)}" height="${P(vh)}" fill="${INKS.navy}" opacity="0.9"/>`;
          }
          if (rD() < 0.16) mid += `<rect x="${P(bx + 20 + rD() * Math.max(10, w - 46))}" y="${P(top - 18)}" width="3" height="18" fill="${INKS.navy}" opacity="0.9"/>`;
        }
        // window slits — sparse, never a grid, whole dark stretches
        const lf = rW() < 0.32 ? 0 : 0.45 + rW() * 0.75;
        if (lf > 0) {
          const lv = lit(bx + w / 2) * lf;
          const rows = h > 120 ? (rW() < 0.5 ? 2 : 3) : (h > 62 && rW() < 0.4 ? 2 : 1);
          let slits = 0;
          for (let row = 0; row < rows && slits < 18; row++) {
            const wy = top + 13 + row * (13 + rW() * 9);
            if (wy > gy - 12) break;
            let wx = bx + 12 + rW() * 70;
            while (wx < bx + w - 38 && slits < 18) {
              if (rW() < 0.13 + 0.47 * lv) {
                const sw = 15 + rW() * 19;
                const t = rW();
                let col, op;
                if (t < 0.62) { col = INKS.platinum; op = 0.32 + 0.24 * rW(); }
                else if (t < 0.82) { col = c.a; op = 0.38 + 0.22 * rW(); }
                else { col = c.b; op = 0.38 + 0.22 * rW(); }
                if (col !== INKS.platinum) {
                  if (col === winRun && winLen >= 2) col = col === c.a ? c.b : c.a;
                  if (col === winRun) winLen++; else { winRun = col; winLen = 1; }
                  if (wx < 80 || wx > SW - 80) { col = INKS.platinum; op = 0.24; }
                }
                mid += `<rect x="${P(wx)}" y="${P(wy)}" width="${P(sw)}" height="${rW() < 0.2 ? 4 : 3}" fill="${col}" opacity="${O(op * (0.45 + 0.55 * lv))}"/>`;
                slits++;
              }
              wx += 32 + rW() * 100;
            }
          }
          if (rW() < 0.25 && w > 240) { // one long dim lit corridor
            mid += `<rect x="${P(bx + 24 + rW() * (w - 170))}" y="${P(gy - 14 - rW() * 10)}" width="${P(60 + rW() * 80)}" height="2.5" fill="${INKS.platinum}" opacity="${O(0.22 * (0.5 + 0.5 * lv))}"/>`;
          }
        }
        blockCount++;
        bRects.push([bx, bx + w, top]);
        keptIv.push([bx, bx + w]);
        // v3.2 (rE only): guaranteed wide-face facade detail + rooftop plant
        if (w > 300) mid += facade(bx, w, top, gy);
        if (w > 320 && d > 0.35 && mainOn(bx) > 0.55) mid += roofPlant(bx, w, top);
      } else if (d > 0.4 && mainOn(bx) > 0.5 && !inYard) {
        // v3.2 presence floor (rP only): if the trailing 0.75W window in a
        // dense region closed under ~35% silhouette fill, force-keep this
        // candidate — no seed may render a gap-toothed campus. Existing
        // streams untouched: the forced hall draws exclusively from rP.
        const wl = bx - 0.75 * W;
        let fill = 0;
        for (const [a0, b0] of keptIv) fill += Math.max(0, Math.min(b0, bx) - Math.max(a0, wl));
        if (fill < 0.35 * 0.75 * W) {
          const h2 = Math.max(44, (52 + 190 * Math.pow(rP(), 1.35)) * (0.5 + 0.9 * d) * (1 - 0.28 * hump(bx, 7.35 * W, 1.7 * W)));
          const gy2 = gY(bx + w / 2), top2 = gy2 - h2;
          mid += `<rect x="${P(bx)}" y="${P(top2)}" width="${P(w)}" height="${P(h2 + 6)}" fill="${INKS.navy}" opacity="0.9"/>`;
          mid += `<line x1="${P(bx)}" y1="${P(top2)}" x2="${P(bx + w)}" y2="${P(top2)}" stroke="${INKS.silver}" stroke-width="1" opacity="${O(0.09 + 0.11 * d)}"/>`;
          if (rP() < 0.6) mid += `<rect x="${P(bx + 14 + rP() * Math.max(10, w - 46))}" y="${P(top2 + 12 + rP() * 9)}" width="${P(15 + rP() * 16)}" height="3" fill="${INKS.platinum}" opacity="${O(0.28 + rP() * 0.14)}"/>`;
          bRects.push([bx, bx + w, top2]);
          keptIv.push([bx, bx + w]);
          if (w > 300) mid += facade(bx, w, top2, gy2);
        }
      }
      let gap = 20 + r() * 90 + (1 - d) * (90 + Math.pow(r(), 1.2) * 680);
      if (d > 0.55 && r() < 0.44) gap = -40 - r() * 130; // stepped overlaps in the thick of it
      bx += w + gap;
    }

    // --- COOLING TOWER GROUPS ---------------------------------------------
    let tow = '';
    const tower = (cx, g, wb, ht, op) => {
      const wt = wb * 0.62;
      return `<path d="M ${P(cx - wb / 2)} ${P(g)} C ${P(cx - wb * 0.27)} ${P(g - ht * 0.42)} ${P(cx - wb * 0.26)} ${P(g - ht * 0.68)} ${P(cx - wt / 2)} ${P(g - ht)} L ${P(cx + wt / 2)} ${P(g - ht)} C ${P(cx + wb * 0.26)} ${P(g - ht * 0.68)} ${P(cx + wb * 0.27)} ${P(g - ht * 0.42)} ${P(cx + wb / 2)} ${P(g)} Z" fill="${INKS.navy}" opacity="${op}"/>`;
    };
    const tgXs = [(2.5 + r() * 0.55) * W, (4.15 + r() * 0.5) * W, (7.05 + r() * 0.6) * W];
    const tgTall = []; // per-group tallest tower — for the v3.2 plume lift
    for (let gi = 0; gi < tgXs.length; gi++) {
      const n = 2 + Math.floor(r() * 3);
      // phase 1: consume the master streams in the EXACT original order
      let tx = tgXs[gi];
      const ts = [];
      for (let i = 0; i < n; i++) {
        const wb = 74 + r() * 46, ht = 128 + r() * 72, g = gY(tx) + 4;
        const pdx = (r() - 0.5) * 30, pdy = 30 + r() * 20, prx = 50 + r() * 30, pry = 24 + r() * 12;
        const dot = rD() < 0.3;
        ts.push({ tx, g, wb, ht, pdx, pdy, prx, pry, dot, lift: 0 });
        tx += wb + 18 + r() * 34;
      }
      // v3.2 prominence guarantee: each cluster-1 group's tallest tower must
      // clear the tallest overlapping hall roofline by >=50px (deterministic
      // lift, no rng; shell top capped at y=1002 — mid-band stays hairline)
      let ti = 0;
      for (let i = 1; i < n; i++) if (ts[i].ht > ts[ti].ht) ti = i;
      if (gi < 2) {
        const t = ts[ti];
        let minTop = Infinity;
        for (const [a0, b0, tp] of bRects) if (b0 > t.tx - t.wb / 2 - 20 && a0 < t.tx + t.wb / 2 + 20) minTop = Math.min(minTop, tp);
        if (minTop < Infinity) {
          const want = Math.min(t.g - minTop + 50, t.g - 1002);
          if (want > t.ht) { t.lift = want - t.ht; t.ht = want; }
        }
      }
      // phase 2: draw — throat-lip strengthened 0.2->0.24, plus the v3.2
      // air-inlet colonnade over a basin line (rT stream only)
      for (const t of ts) {
        tow += tower(t.tx, t.g, t.wb, t.ht, 0.92);
        tow += `<ellipse cx="${P(t.tx)}" cy="${P(t.g - t.ht)}" rx="${P(t.wb * 0.31)}" ry="3" fill="none" stroke="${INKS.platinum}" stroke-width="1" opacity="0.24"/>`;
        let pcy = t.g - t.ht - t.pdy;
        if (t.lift) pcy = Math.max(pcy, 950 + t.pry);
        tow += `<ellipse cx="${P(t.tx + t.pdx)}" cy="${P(pcy)}" rx="${P(t.prx)}" ry="${P(t.pry)}" fill="${INKS.silver}" opacity="0.06" filter="url(#nb-blur)"/>`;
        if (t.dot) tow += `<circle cx="${P(t.tx)}" cy="${P(t.g - t.ht - 4)}" r="1.5" fill="${c.a}" opacity="0.5"/>`;
        tow += `<line x1="${P(t.tx - t.wb / 2)}" y1="${P(t.g)}" x2="${P(t.tx + t.wb / 2)}" y2="${P(t.g)}" stroke="${INKS.platinum}" stroke-width="1" opacity="0.09"/>`;
        const nk = 6 + Math.floor(rT() * 5); // 6-10 inlet ticks, jittered
        let kx = t.tx - t.wb / 2 + 5 + rT() * 4;
        for (let k = 0; k < nk && kx < t.tx + t.wb / 2 - 4; k++) {
          tow += `<line x1="${P(kx)}" y1="${P(t.g - 12)}" x2="${P(kx)}" y2="${P(t.g - 1)}" stroke="${INKS.platinum}" stroke-width="1" opacity="${O(0.07 + rT() * 0.03)}"/>`;
          kx += ((t.wb - 12) / nk) * (0.75 + rT() * 0.5);
        }
      }
      const tt = ts[ti];
      tgTall.push({ tx: tt.tx, top: tt.g - tt.ht });
    }
    // v3.2 plume lift (rT): 1-2 extra wisps per group drifting on a per-seed
    // wind direction — top edge hard-capped y>=950, alpha <=0.045, fading up
    const wind = (rT() < 0.5 ? -1 : 1) * (18 + rT() * 26);
    for (const tg of tgTall) {
      const nw = 1 + (rT() < 0.5 ? 1 : 0);
      for (let k2 = 1; k2 <= nw; k2++) {
        const ry2 = 13 + rT() * 8, rx2 = 40 + rT() * 26;
        let cy2 = tg.top - 26 - k2 * (34 + rT() * 16);
        cy2 = Math.max(cy2, 950 + ry2);
        const op2 = Math.max(0.018, 0.04 - k2 * 0.009);
        tow += `<ellipse cx="${P(tg.tx + wind * k2 * (0.7 + rT() * 0.5))}" cy="${P(cy2)}" rx="${P(rx2)}" ry="${P(ry2)}" fill="${INKS.silver}" opacity="${op2.toFixed(3)}" filter="url(#nb-blur)"/>`;
      }
    }
    // v3.2 far-plane densify (rF2): extra slits on recorded far blocks
    // (effective slit chance 0.3 -> ~0.45, up to 2 per block) + 2-3 dim far
    // cooling-tower silhouettes standing in cluster-gap sightlines
    for (const b of farBlocks) {
      let has = b.hadSlit;
      if (!has && rF2() < 0.21) {
        far += `<rect x="${P(b.fx + 14 + rF2() * (b.w - 40))}" y="${P(b.y - b.h + 8 + rF2() * Math.max(4, b.h - 16))}" width="${P(10 + rF2() * 12)}" height="2.5" fill="${INKS.platinum}" opacity="${O(0.13 + 0.1 * rF2())}"/>`;
        has = true;
      }
      if (has && rF2() < 0.3) {
        far += `<rect x="${P(b.fx + 14 + rF2() * (b.w - 40))}" y="${P(b.y - b.h + 8 + rF2() * Math.max(4, b.h - 16))}" width="${P(10 + rF2() * 12)}" height="2.5" fill="${INKS.platinum}" opacity="${O(0.13 + 0.1 * rF2())}"/>`;
      }
    }
    {
      const nFT = 2 + (rF2() < 0.6 ? 1 : 0);
      const ftc = [(1.72 + rF2() * 0.42) * W, (4.98 + rF2() * 0.28) * W, (6.5 + rF2() * 0.35) * W];
      for (let i = 0; i < nFT; i++) {
        const fcx = ftc[i], fg = fgY(fcx);
        far += tower(fcx, fg, 28 + rF2() * 12, 40 + rF2() * 20, 0.55);
      }
    }

    // --- SUBSTATION YARD ----------------------------------------------------
    let sub = '';
    {
      const sg = gY(sX);
      let fence = '';
      let fpx = sX - 180 - r() * 30;
      const fEnd = sX + 160 + r() * 40;
      const fStart = fpx;
      while (fpx < fEnd) { fence += `M ${P(fpx)} ${P(sg + 2)} L ${P(fpx)} ${P(sg - 28)} `; fpx += 24 + rD() * 18; }
      sub += `<path d="${fence}" stroke="${INKS.platinum}" stroke-width="1" fill="none" opacity="0.16"/>`;
      sub += `<line x1="${P(fStart)}" y1="${P(sg - 28)}" x2="${P(fEnd)}" y2="${P(sg - 28)}" stroke="${INKS.platinum}" stroke-width="1" opacity="0.13"/>`;
      const trs = [];
      for (let i = 0; i < 2; i++) {
        const tx = sX - 84 + i * (84 + r() * 26) + r() * 18, tw = 52 + r() * 22, th = 42 + r() * 16;
        sub += `<rect x="${P(tx)}" y="${P(sg - th)}" width="${P(tw)}" height="${P(th)}" fill="${INKS.navy}" opacity="0.9"/>`;
        sub += `<line x1="${P(tx)}" y1="${P(sg - th)}" x2="${P(tx + tw)}" y2="${P(sg - th)}" stroke="${INKS.silver}" stroke-width="1" opacity="0.14"/>`;
        sub += `<path d="M ${P(tx + 8)} ${P(sg - th)} L ${P(tx + 8)} ${P(sg - th - 9)} M ${P(tx + tw / 2)} ${P(sg - th)} L ${P(tx + tw / 2)} ${P(sg - th - 12)} M ${P(tx + tw - 8)} ${P(sg - th)} L ${P(tx + tw - 8)} ${P(sg - th - 8)}" stroke="${INKS.platinum}" stroke-width="1.2" fill="none" opacity="0.16"/>`;
        trs.push({ tx, tw, th });
      }
      sub += `<path d="M ${P(gantX - 34)} ${P(sg + 2)} L ${P(gantX - 34)} ${P(gantTop)} L ${P(gantX + 34)} ${P(gantTop)} L ${P(gantX + 34)} ${P(sg + 2)}" stroke="${INKS.platinum}" stroke-width="1.5" fill="none" opacity="0.2"/>`;
      sub += `<path d="M ${P(gantX + 12)} ${P(gantTop)} L ${P(gantX + 12)} ${P(gantTop + 12)}" stroke="${INKS.platinum}" stroke-width="1.2" fill="none" opacity="0.2"/>`;
      sub += `<circle cx="${P(gantX + 12)}" cy="${P(gantTop + 13)}" r="1.6" fill="${c.gb}" opacity="0.5"/>`;
      sub += `<circle cx="${P(sX + 6)}" cy="${P(sg - 12)}" r="2.2" fill="${c.gb}" opacity="0.6"/>`;
      sub += `<circle cx="${P(sX + 6)}" cy="${P(sg - 10)}" r="95" fill="${c.gb}" opacity="${O(0.1 * boost)}" filter="url(#nb-blur)"/>`;
      // v3.2 substation anatomy (rS only, all hairline platinum — the yard is
      // the wire's terminus and needs its real electrical grammar):
      // insulator strings hanging from the gantry beam
      for (let i = 0; i < 3; i++) {
        const ix = gantX - 22 + i * 22 + (rS() - 0.5) * 6, il = 8 + rS() * 2;
        sub += `<line x1="${P(ix)}" y1="${P(gantTop + 1)}" x2="${P(ix)}" y2="${P(gantTop + 1 + il)}" stroke="${INKS.platinum}" stroke-width="1" opacity="0.16"/>`;
      }
      // twin busbar run, gantry to transformers, ~52px above the ground
      const bu1 = Math.min(gantX - 34, Math.min(...trs.map((t) => t.tx)));
      const bu2 = Math.max(gantX + 34, Math.max(...trs.map((t) => t.tx + t.tw)));
      sub += `<line x1="${P(bu1)}" y1="${P(sg - 52)}" x2="${P(bu2)}" y2="${P(sg - 52)}" stroke="${INKS.platinum}" stroke-width="1" opacity="0.12"/>`;
      sub += `<line x1="${P(bu1)}" y1="${P(sg - 47)}" x2="${P(bu2)}" y2="${P(sg - 47)}" stroke="${INKS.platinum}" stroke-width="1" opacity="0.10"/>`;
      // radiator-fin combs on each transformer flank
      for (const t of trs) {
        for (const sgn of [-1, 1]) {
          const nf2 = 4 + (rS() < 0.5 ? 1 : 0);
          for (let f = 0; f < nf2; f++) {
            const fxp = sgn < 0 ? t.tx - 3 - f * 3 : t.tx + t.tw + 3 + f * 3;
            sub += `<line x1="${P(fxp)}" y1="${P(sg - t.th + 10)}" x2="${P(fxp)}" y2="${P(sg - t.th + 18)}" stroke="${INKS.platinum}" stroke-width="1" opacity="0.10"/>`;
          }
        }
      }
      // one disconnect-switch A-frame on the bus + one lightning mast
      const ax2 = (bu1 + bu2) / 2 + (rS() - 0.5) * 30;
      sub += `<path d="M ${P(ax2 - 6)} ${P(sg - 40)} L ${P(ax2)} ${P(sg - 52)} L ${P(ax2 + 6)} ${P(sg - 40)}" stroke="${INKS.platinum}" stroke-width="1" fill="none" opacity="0.14"/>`;
      const mh = 90 + rS() * 30, mx2 = sX + 120 + rS() * 24;
      sub += `<line x1="${P(mx2)}" y1="${P(sg)}" x2="${P(mx2)}" y2="${P(sg - mh)}" stroke="${INKS.platinum}" stroke-width="1" opacity="0.15"/>`;
      sub += `<circle cx="${P(mx2)}" cy="${P(sg - mh - 1)}" r="1.2" fill="${INKS.silver}" opacity="0.3"/>`;
    }
    // --- v3.2: BACKUP-GENERATOR YARDS + SECURITY-LIT PERIMETER (rG only) ----
    // every real campus flanks its halls with a diesel farm and a fenced,
    // security-lit edge; nothing bright, aperiodic spacing throughout
    {
      const gensetRow = (x0, x1) => {
        let s = `<line x1="${P(x0 - 6)}" y1="${P(gY(x0) - 20)}" x2="${P(x1 + 6)}" y2="${P(gY(x1) - 20)}" stroke="${INKS.platinum}" stroke-width="1" opacity="0.10"/>`;
        let gx = x0 + rG() * 24;
        const n = 4 + Math.floor(rG() * 3); // 4-6 enclosures, 10-30px gaps
        for (let i = 0; i < n && gx < x1 - 18; i++) {
          const gw = 18 + rG() * 8, gh = 12 + rG() * 4, gg = gY(gx + gw / 2);
          s += `<rect x="${P(gx)}" y="${P(gg - gh)}" width="${P(gw)}" height="${P(gh)}" fill="${INKS.navy}" opacity="0.9"/>`;
          s += `<rect x="${P(gx + 4 + rG() * (gw - 10))}" y="${P(gg - gh - 6)}" width="2" height="6" fill="${INKS.navy}" opacity="0.9"/>`;
          gx += gw + 10 + rG() * 20;
        }
        return s;
      };
      const fenceRun = (x0, x1) => {
        let d2 = `M ${P(x0)} ${P(gY(x0) - 24)}`;
        for (let xx = x0 + 40; xx <= x1; xx += 40) d2 += ` L ${P(xx)} ${P(gY(xx) - 24)}`;
        let s = `<path d="${d2}" stroke="${INKS.platinum}" stroke-width="1" fill="none" opacity="${O(0.10 + rG() * 0.03)}"/>`;
        let fx2 = x0 + rG() * 10;
        while (fx2 < x1) { // jittered posts, 24-42px — never a beat
          s += `<line x1="${P(fx2)}" y1="${P(gY(fx2) + 1)}" x2="${P(fx2)}" y2="${P(gY(fx2) - 24)}" stroke="${INKS.platinum}" stroke-width="1" opacity="0.12"/>`;
          fx2 += 24 + rG() * 18;
        }
        const np = 2 + (rG() < 0.5 ? 1 : 0); // 2-3 light poles, pinprick only
        for (let i = 0; i < np; i++) {
          const lx2 = x0 + 20 + rG() * (x1 - x0 - 40), lh = 28 + rG() * 6, lg = gY(lx2);
          s += `<line x1="${P(lx2)}" y1="${P(lg)}" x2="${P(lx2)}" y2="${P(lg - lh)}" stroke="${INKS.platinum}" stroke-width="1" opacity="0.15"/>`;
          s += `<circle cx="${P(lx2)}" cy="${P(lg - lh - 2)}" r="1.3" fill="${INKS.silver}" opacity="0.35"/>`;
        }
        return s;
      };
      sub += gensetRow(sX - 840, sX - 540);       // approach strip before the yard
      sub += gensetRow(6.55 * W, 6.72 * W);       // short second row, page 7
      sub += fenceRun(sX - 740, sX - 440);        // perimeter: before the yard
      const f2x = Math.max(5.88 * W, crX + 300);  // perimeter: after the crane
      sub += fenceRun(f2x, f2x + 220);
    }

    // --- HERO CRANE (the landmark, once) -----------------------------------
    let crane = '';
    {
      const cg = gY(crX), mTop = cg - (585 + r() * 55), mw = 8;
      let mast = `M ${P(crX - mw)} ${P(cg + 2)} L ${P(crX - mw)} ${P(mTop)} M ${P(crX + mw)} ${P(cg + 2)} L ${P(crX + mw)} ${P(mTop)} `;
      let zy = cg - 24 - rD() * 20, flip = 1;
      while (zy > mTop + 30) { const step = 52 + rD() * 26; mast += `M ${P(crX - mw * flip)} ${P(zy)} L ${P(crX + mw * flip)} ${P(zy - step)} `; zy -= step; flip = -flip; }
      crane += `<path d="${mast}" stroke="${INKS.platinum}" stroke-width="1.7" fill="none" opacity="0.27"/>`;
      const dir = -1, jl = 320 + r() * 60; // jib points back over the yard
      const tipX = crX + dir * jl, tipY = mTop - 4;
      let jib = `M ${P(crX)} ${P(mTop + 4)} L ${P(tipX)} ${P(tipY)} M ${P(crX)} ${P(mTop + 22)} L ${P(tipX)} ${P(tipY + 8)} `;
      for (let i = 1; i <= 4; i++) {
        const t = i / 5 + (rD() - 0.5) * 0.06;
        jib += `M ${P(crX + dir * jl * t)} ${P(mTop + 4 + (tipY - mTop - 4) * t)} L ${P(crX + dir * jl * Math.min(1, t + 0.09))} ${P(mTop + 22)} `;
      }
      const cjX = crX - dir * (105 + r() * 25);
      jib += `M ${P(crX)} ${P(mTop + 8)} L ${P(cjX)} ${P(mTop + 12)} `;
      crane += `<path d="${jib}" stroke="${INKS.platinum}" stroke-width="1.6" fill="none" opacity="0.27"/>`;
      crane += `<rect x="${P(cjX - 11)}" y="${P(mTop + 12)}" width="22" height="26" fill="${INKS.navy}" opacity="0.95"/>`;
      const apY = mTop - 46;
      crane += `<path d="M ${P(crX)} ${P(mTop)} L ${P(crX)} ${P(apY)} L ${P(tipX)} ${P(tipY)} M ${P(crX)} ${P(apY)} L ${P(cjX)} ${P(mTop + 12)}" stroke="${INKS.platinum}" stroke-width="1.3" fill="none" opacity="0.23"/>`;
      const tt = 0.58 + r() * 0.24, hkX = crX + dir * jl * tt;
      const hkTop = mTop + 22 + (tipY + 8 - (mTop + 22)) * tt;
      const hkY = 1030 + r() * 35;
      crane += `<path d="M ${P(hkX)} ${P(hkTop)} L ${P(hkX)} ${P(hkY)} M ${P(hkX - 5)} ${P(hkY)} L ${P(hkX + 5)} ${P(hkY)}" stroke="${INKS.platinum}" stroke-width="1" fill="none" opacity="0.2"/>`;
      crane += `<circle cx="${P(hkX)}" cy="${P(hkY + 7)}" r="115" fill="${c.ga}" opacity="${O(0.13 * boost)}" filter="url(#nb-blur)"/>`;
      crane += `<circle cx="${P(hkX)}" cy="${P(hkY + 7)}" r="9" fill="${c.ga}" opacity="0.3"/>`;
      crane += `<circle cx="${P(hkX)}" cy="${P(hkY + 7)}" r="3" fill="${c.ga}" opacity="0.9"/>`;
      crane += `<ellipse cx="${P(hkX)}" cy="${P(cg - 2)}" rx="140" ry="30" fill="${c.ga}" opacity="${O(0.11 * boost)}" filter="url(#nb-blur)"/>`;
      // v3.2: apex dot upgraded to a proper aviation obstruction beacon —
      // same element, same position; plain r7 halo, NO blur, no new glow
      crane += `<circle cx="${P(crX)}" cy="${P(apY - 4)}" r="7" fill="${c.a}" opacity="0.10"/>`;
      crane += `<circle cx="${P(crX)}" cy="${P(apY - 4)}" r="2.2" fill="${c.a}" opacity="0.7"/>`;
    }

    // --- GROUND LINE + ROAD DOTS + EDGE POLES + FRONT HAZE ------------------
    let front = '';
    let gp = `M -20 ${P(gY(-20))}`;
    for (let gx = 117; gx <= SW + 60; gx += 137) gp += ` L ${P(gx)} ${P(gY(gx))}`;
    front += `<path d="${gp}" stroke="${INKS.platinum}" stroke-width="1" fill="none" opacity="0.17"/>`;
    const dxs = schedule(rD, SW, 0.28, 1.2);
    for (const dx of dxs) {
      if (rD() < 0.25 + 0.5 * dens(dx)) front += `<circle cx="${P(dx)}" cy="${P(gY(dx) + 9 + rD() * 8)}" r="${(1 + rD() * 0.7).toFixed(1)}" fill="${INKS.silver}" opacity="${O(0.26 + 0.18 * rD())}"/>`;
    }
    const pls = schedule(rD, SW, 0.9, 2.4);
    for (const plx of pls) {
      if (dens(plx) < 0.32 && Math.abs(plx - crX) > 300) {
        const g = gY(plx);
        front += `<path d="M ${P(plx)} ${P(g)} L ${P(plx)} ${P(g - 32)}" stroke="${INKS.platinum}" stroke-width="1.2" fill="none" opacity="0.15"/>`;
        front += `<circle cx="${P(plx)}" cy="${P(g - 34)}" r="1.3" fill="${INKS.silver}" opacity="0.4"/>`;
      }
    }
    front += `<ellipse cx="${P((1.6 + r() * 1.5) * W)}" cy="${P(H - 26)}" rx="${P(360 + r() * 200)}" ry="80" fill="${c.gb}" opacity="${O(0.05 * boost)}" filter="url(#nb-blur)"/>`;
    front += `<ellipse cx="${P((4.6 + r() * 1.6) * W)}" cy="${P(H - 24)}" rx="${P(380 + r() * 220)}" ry="75" fill="${c.ga}" opacity="${O(0.05 * boost)}" filter="url(#nb-blur)"/>`;
    front += `<ellipse cx="${P((7.8 + r() * 1.6) * W)}" cy="${P(H - 26)}" rx="${P(340 + r() * 220)}" ry="75" fill="${c.gb}" opacity="${O(0.045 * boost)}" filter="url(#nb-blur)"/>`;

    // --- LONE LIT BLOCK, far off in the outskirts (once, p10) --------------
    let lone = '';
    {
      const lx = (9.34 + r() * 0.32) * W;
      const w = 190 + r() * 70, y = fgY(lx), h = 50 + r() * 26;
      lone += `<ellipse cx="${P(lx + w / 2)}" cy="${P(y - 12)}" rx="270" ry="105" fill="${c.ga}" opacity="${O(0.12 * boost)}" filter="url(#nb-blur)"/>`;
      lone += `<rect x="${P(lx)}" y="${P(y - h)}" width="${P(w)}" height="${P(h)}" fill="${INKS.navy}" opacity="0.58"/>`;
      lone += `<line x1="${P(lx)}" y1="${P(y - h)}" x2="${P(lx + w)}" y2="${P(y - h)}" stroke="${INKS.silver}" stroke-width="1" opacity="0.08"/>`;
      lone += `<rect x="${P(lx + 18 + r() * 16)}" y="${P(y - h + 10)}" width="${P(13 + r() * 9)}" height="3" fill="${c.ga}" opacity="0.6"/>`;
      lone += `<rect x="${P(lx + w * 0.44 + r() * 14)}" y="${P(y - h + 14 + r() * 8)}" width="${P(12 + r() * 9)}" height="3" fill="${c.ga}" opacity="0.55"/>`;
      lone += `<rect x="${P(lx + w * 0.72 + r() * 12)}" y="${P(y - h + 11)}" width="${P(11 + r() * 8)}" height="2.5" fill="${INKS.platinum}" opacity="0.3"/>`;
    }

    return far + haze + tow + pyl + mid + sub + crane + front + lone;
  },
};
})();

STYLE_DEFS["compound"] = (function () {
const PAGES = NATIVE_PAGES;
void PAGES;
// compound · "compounding arcs" · cat: green
// ============================================================================
// PAGE MAP (one 10800x1350 scene, cut into ten 1080px frames):
//   P1-P2  (0-2160)     genesis: shallow arcs hug the floor; an ELDER arc from
//                       a prior cycle crosses high and dies tip-first; one
//                       FALSE-START arc rises, stalls, dissolves. The hero
//                       enters off-canvas left, one of the crowd. Ghost arcs
//                       (spent generations, far layer) drift flat in the sky.
//   P3-P5  (2160-5400)  multiplication: staggered launches bunch into a rising
//                       pack; soft wide under-strokes shade the bunch where
//                       arcs crowd; a few companions are cool-lit seams; light
//                       pools on the floor beneath (bottom quarter only).
//   P6     (5400-6480)  breakaway: at xBk (off-boundary, >=0.22W from both
//                       cuts) the hero's slope kicks ~5x — one-time ga glint
//                       + spark dots + velocity flare (THE LANDMARK). Knee
//                       sits low so its glow is text-safe.
//   P7-P8  (6480-8640)  maturity: pack arcs flatten high on logistic tops
//                       under a warm altitude glow; the steep hero overtakes
//                       mid-P7; one casualty arc dies early after the break.
//   P9-P10 (8640-10800) survival: pack strands dissolve tip-first on
//                       STAGGERED fades through P9, ghosts thin out, the dot
//                       floor empties; the hero alone keeps climbing, easing,
//                       and exits the right edge still rising into a faint
//                       warm exit glow.
// Continuity devices: hero y = integral of a smooth slope function (sigmoid
// ramps + one decaying kick) — no piecewise breaks; family arc shape blends
// exponential->logistic by maturity; density/opacity move on gaussians,
// sigmoids or noise only. Every arc spans 2-4 pages and crosses cuts
// mid-flight; nothing steps on a 1080 beat. Depth = 3 planes: ghost arcs
// (far, flat, faint) / pack + hero (mid) / dot floor + pools (near).
// v3.2 chart-anatomy pass: the strip now carries the artifacts of a real
// multi-series growth chart — origin gridline hairlines + baseline ticks in
// P1-2 (fading out by P2), sparse data-marker tick-dots on the pack (P3-8,
// ~15% cool c.b), terminal "last print" dots where the elder / casualty /
// two P9 strands die, pennant flags on 2-3 out-of-band hero milestones, and
// a dash-jittered asymptote hairline over P7-8.5 at the pack's ceiling P(∞).
// Ghost plane raised to op 0.08-0.11 + a 7th arc in the P3-5 sky; bunch
// under-shade deepened (0.045/σ1950); cool seams up to 0.12; sprouts louder
// (op .115, w1.6, k1.9) each with a first-print accent dot; 2-3 extra cool
// genesis floor accents. All new passes run on independent RNG channels
// (mulberry32((seed^0xE7A0)+tag)) appended after the legacy stream, and all
// positions derive from live geometry (yAt/heroY/P/fadeStart), never
// constants. Everything is hairline (op<=0.05) or dot-scale, so the knee
// glint stays the only landmark and the text mid-band stays whisper-quiet.
// ============================================================================
// (helpers provided by the registry's shared toolkit)
return {
  key: 'compound',
  name: 'compounding arcs',
  cat: 'green',
  desc: 'nested growth curves compound up-and-right; one breaks away at a glint and survives alone to the edge',
  gen(seed, hue) {
    const c = HUES[hue], SW = PAGES * W, boost = glowAlphaBoost(hue);
    const r = mulberry32(seed + 4099);
    const sig = (z) => 1 / (1 + Math.exp(-z));
    // nudge a scalar off any frame boundary (anti-alignment only)
    const nb = (x) => { const m = ((x % W) + W) % W; if (m < 115) return x + (150 - m); if (m > W - 115) return x + (W - m) + 40; return x; };
    // pack destiny line: where the family is heading — rises then flattens high
    const P = (x) => 1268 - 830 * sig((x - 5850) / 1560);
    const expC = (t, k) => (Math.exp(k * t) - 1) / (Math.exp(k) - 1);
    const logC = (t, g) => { const lo = sig(-0.55 * g), hi = sig(0.45 * g); return (sig(g * (t - 0.55)) - lo) / (hi - lo); };
    let out = '';

    // segment-drawn curve with tip softening, staggered life fade, optional
    // wide soft under-stroke (density shading where arcs bunch)
    const drawCurve = (x0, end, yAt, ink, wdt, bop, fadeStart, fLen, shade) => {
      const span = end - x0, NS = 9;
      for (let s2 = 0; s2 < NS; s2++) {
        const sx = x0 + (span * s2) / NS, ex = x0 + (span * (s2 + 1)) / NS, mid = (sx + ex) / 2;
        const tip = s2 === 0 ? 0.4 : s2 === 1 ? 0.8 : s2 === NS - 1 ? 0.35 : s2 === NS - 2 ? 0.7 : 1;
        const lf = mid <= fadeStart ? 1 : Math.max(0, 1 - (mid - fadeStart) / fLen);
        const op = bop * tip * lf;
        if (op < 0.008) continue;
        let d = '';
        const pts = 13;
        for (let p = 0; p <= pts; p++) { const px = sx + ((ex - sx) * p) / pts; d += (p ? 'L' : 'M') + Math.round(px) + ' ' + Math.round(yAt(px)); }
        if (shade) { const so = shade(mid) * tip * lf; if (so > 0.007) out += `<path d="${d}" fill="none" stroke="${INKS.silver}" stroke-width="12" opacity="${so.toFixed(3)}"/>`; }
        out += `<path d="${d}" fill="none" stroke="${ink}" stroke-width="${wdt}" opacity="${op.toFixed(3)}"/>`;
      }
    };

    // ---- hero spine: integrate a smooth slope story ----------------------
    const xBk = 5680 + r() * 520;              // breakaway knee, page 6
    const heroX0 = -(0.2 + r() * 0.3) * W;     // enters off-canvas left
    const heroY0 = 1228 + r() * 18;
    const heroY1 = 158 + r() * 62;             // exits top-right, still rising
    const heroNz = valueNoise1D(seed + 901);
    const slope = (x) => (0.024 + 0.085 * sig((x - 4250) / 950)
      + 0.34 * sig((x - xBk) / 140) * (1 - 0.78 * sig((x - 8250) / 780)))
      * (1 - 0.62 * sig((x - 8900) / 850));
    const HS = 14, hcum = [];
    let acc = 0;
    for (let x = heroX0; x <= SW + 90; x += HS) { hcum.push(acc); acc += slope(x) * HS; }
    const hscale = (heroY0 - heroY1) / hcum[hcum.length - 1];
    const heroY = (x) => {
      const f = (x - heroX0) / HS, i = Math.max(0, Math.min(hcum.length - 2, Math.floor(f))), u = Math.max(0, Math.min(1, f - i));
      return heroY0 - (hcum[i] * (1 - u) + hcum[i + 1] * u) * hscale + 12 * (heroNz(x / 860) - 0.5);
    };

    // ---- ambient light (all blurred, anchored top/bottom quarters) -------
    const g1x = nb(2380 + r() * 420);
    const g2x = nb(g1x + 560 + r() * 980);
    const g3x = nb(Math.min(g2x + 540 + r() * 1150, 5200));
    const G = [
      [nb(760 + r() * 420), 1180 + r() * 80, 260 + r() * 70, c.gb, 0.065 + r() * 0.015],   // genesis floor, cool
      [g1x, 1150 + r() * 90, 290 + r() * 90, c.gb, 0.085 + r() * 0.02],   // floor pool under early bunch
      [g2x, 1130 + r() * 100, 300 + r() * 90, c.ga, 0.072 + r() * 0.018], // warm floor pool mid-bunch
      [g3x, 1160 + r() * 80, 280 + r() * 100, c.gb, 0.085 + r() * 0.02],  // floor pool late bunch
      [nb(1500 + r() * 700), 150 + r() * 75, 240 + r() * 80, c.gb, 0.055 + r() * 0.015],   // cold early sky
      [nb(3860 + r() * 520), 165 + r() * 80, 265 + r() * 70, c.gb, 0.052 + r() * 0.015],   // cool sky over the bunch
      [nb(7420 + r() * 720), 175 + r() * 80, 300 + r() * 70, c.ga, 0.07 + r() * 0.02],     // warm altitude glow P7-8
      [nb(9040 + r() * 430), 180 + r() * 70, 240 + r() * 70, c.gb, 0.042 + r() * 0.012],   // cold thin air over the fade
      [nb(9330 + r() * 320), 1200 + r() * 80, 230 + r() * 60, c.gb, 0.042 + r() * 0.01],   // dim floor under the fade
      [nb(10280 + r() * 200), 200 + r() * 70, 215 + r() * 50, c.ga, 0.055 + r() * 0.012],  // survivor exit glow
    ];
    for (const [gx, gy, gr, gk, go] of G)
      out += `<circle cx="${Math.round(gx)}" cy="${Math.round(gy)}" r="${Math.round(gr)}" fill="${gk}" opacity="${Math.min(0.11, go * boost).toFixed(3)}" filter="url(#nb-blur)"/>`;

    // ---- far plane: spent generations — flat ghost arcs, whole-strip depth
    for (let gi = 0; gi < 6; gi++) {
      const gx0 = nb((-1.15 + gi * 1.78 + r() * 1.05) * W);
      let gEnd = gx0 + (2.6 + r() * 2.0) * W;
      if (gEnd > SW + 160) gEnd = SW + 160;
      const yb = 195 + r() * 555;
      const rise = 40 + r() * 110;
      const gg = 3.6 + r() * 2.0;
      const nzG = valueNoise1D(seed * 7 + gi * 269);
      const gspan = gEnd - gx0;
      const yAtG = (x) => { const t = Math.max(0, Math.min(1, (x - gx0) / gspan)); return yb - rise * logC(t, gg) + 22 * (nzG(x / 900) - 0.5); };
      const gop = Math.min(0.11, 0.08 + r() * 0.03); // v3.2: ghost plane lifted above film grain, capped under the pack
      const gink = r() < 0.5 ? INKS.silver : INKS.platinum;
      const gFS = gi === 5 ? 9900 + r() * 200 : 8950 + r() * 750; // last ghost dissolves inside P10
      drawCurve(gx0, gEnd, yAtG, gink, (1.1 + r() * 0.5).toFixed(1), gop, gFS, 700 + r() * 400, null);
    }

    // ---- genesis false start: rises, stalls, dies (cautionary sibling) ----
    {
      const fx0 = nb(340 + r() * 430);
      const fEnd = fx0 + (0.85 + r() * 0.45) * W;
      const fy0 = 1205 + r() * 30, frise = 130 + r() * 95;
      const nzF = valueNoise1D(seed + 313);
      const fspan = fEnd - fx0;
      const yAtF = (x) => { const t = Math.max(0, Math.min(1, (x - fx0) / fspan)); return fy0 - frise * logC(t, 5.4) + 8 * (nzF(x / 500) - 0.5); };
      drawCurve(fx0, fEnd, yAtF, INKS.platinum, '1.4', 0.115, fx0 + 0.52 * fspan, 0.4 * fspan, null);
    }

    // ---- dot-grid whisper, lowest 15% only: denser at genesis, thins late -
    const dotNz = valueNoise1D(seed + 557);
    const rows = [1192, 1258, 1319], rowW = [0.95, 0.8, 0.62];
    let dx = -34 + r() * 60;
    while (dx < SW + 30) {
      const pres = 0.66 + 0.15 * Math.exp(-Math.pow((dx - 950) / 1500, 2)) - 0.3 * sig((dx - 8750) / 900);
      for (let ri = 0; ri < 3; ri++) {
        if (r() < pres * rowW[ri] * (0.55 + 0.9 * dotNz(dx / 500 + ri * 3.7))) {
          const cy2 = rows[ri] + (r() - 0.5) * 34, cx2 = dx + (r() - 0.5) * 26;
          if (r() < 0.048 && cx2 > 60 && cx2 < SW - 60) {
            const ac = r() < 0.5 ? c.a : c.b;
            out += `<circle cx="${Math.round(cx2)}" cy="${Math.round(cy2)}" r="${(2.8 + r() * 1.2).toFixed(1)}" fill="${ac}" opacity="${(0.36 + r() * 0.18).toFixed(2)}"/>`;
          } else {
            out += `<circle cx="${Math.round(cx2)}" cy="${Math.round(cy2)}" r="${(2.6 + r() * 1.6).toFixed(1)}" fill="${INKS.platinum}" opacity="${(0.12 + r() * 0.08).toFixed(3)}"/>`;
          }
        }
      }
      dx += 46 + r() * 58;
    }

    // ---- family arc launches: aperiodic, density-enveloped ---------------
    const starts = [];
    let ax = -(0.25 + r() * 0.45) * W;
    while (ax < 5900) {
      starts.push(ax);
      const D = 0.62 + 1.35 * Math.exp(-Math.pow((ax - 3600) / 2500, 2));
      ax += ((0.32 + Math.pow(r(), 1.45) * 0.95) * W) / D;
    }
    // guarantee one dead stretch so the middle breathes
    if (starts.length > 4) {
      let big = 0, bi = -1;
      for (let i = 2; i < starts.length; i++) { const g = starts[i] - starts[i - 1]; if (g > big) { big = g; bi = i; } }
      if (big < 0.85 * W && bi > 1) starts.splice(bi, 1);
    }
    const arcs = starts.map((s) => ({ x0: s, late: false }));
    for (const s of starts)
      if (s > 1650 && s < 5250 && r() < 0.62 && arcs.length < 21)
        arcs.push({ x0: s + 140 + r() * 380, late: false, cool: r() < 0.3 }); // bunch companions, some cool-lit
    const lj = 1 + (r() < 0.5 ? 1 : 0);
    for (let i = 0; i < lj; i++) arcs.push({ x0: 5950 + r() * 700 + i * 430, late: true });   // late joiners, start mid-height
    arcs.push({ x0: -(1.35 + r() * 0.6) * W, elder: true });  // a prior generation: its rising tail crosses P1-2, then dies
    arcs.sort((a, b) => a.x0 - b.x0);
    // one casualty of the breakaway: dies mid-P7, ahead of the pack's fade
    let casIdx = -1;
    for (let i = 0; i < arcs.length; i++)
      if (!arcs[i].elder && !arcs[i].late && arcs[i].x0 > 1900 && arcs[i].x0 < 3600 && (casIdx < 0 || r() < 0.5)) casIdx = i;
    const bunchShade = (mid) => 0.045 * Math.exp(-Math.pow((mid - 4150) / 1950, 2)); // v3.2: deeper/wider ink-buildup under the bunch

    let ai = 0;
    const arcGeom = []; // v3.2: live geometry captured for the appended chart-anatomy passes
    for (let aj = 0; aj < arcs.length; aj++) {
      const A = arcs[aj];
      ai++;
      const nzA = valueNoise1D(seed * 5 + ai * 131);
      const x0 = nb(A.x0);
      let end = x0 + (2 + r() * 2) * W;
      if (A.elder) end = 1620 + r() * 830;
      if (end > 9560) end = 9250 + r() * 650;              // only the hero reaches the edge
      if (!A.elder && end - x0 < 1.5 * W) end = x0 + 1.5 * W + r() * 260;
      const span = end - x0;
      const y0 = A.elder ? 1230 : A.late ? Math.min(1235, P(x0) + 250 + r() * 110) : 1150 + r() * 95;
      let m = Math.max(0, Math.min(1, ((x0 + end) / 2 - 2700) / 4300)); // maturity: exp -> logistic
      if (A.elder) m = 1;                                  // prior cycle: fully logistic, already high
      let y1 = P(end) - r() * 130 + (r() - 0.5) * 60 - (1 - m) * (70 + r() * 150); // young arcs get real lift
      if (A.elder) y1 = 420 + r() * 110;
      if (y1 > y0 - 90) y1 = y0 - 90 - r() * 50;
      if (y1 < 205) y1 = 205 + r() * 60;
      const early = !A.elder && !A.late && x0 < 1600;
      const k = (early ? 1.55 : 2.5) + r() * (early ? 0.5 : 1.3), g = A.elder ? 5.6 + r() * 1.2 : 4.4 + r() * 1.9;
      const ink = A.cool ? c.gb : (A.elder || r() < 0.55 ? INKS.silver : INKS.platinum);
      const wdt = A.elder ? '1.9' : (1.5 + r() * 0.7).toFixed(1);
      const bop = A.cool ? 0.12 + r() * 0.035 : (A.elder ? 0.16 : early ? 0.13 : 0.12) + r() * (A.elder ? 0.04 : 0.06); // v3.2: cool seams +0.02 so gb registers in the green render
      const yAt = (x) => {
        const t = Math.max(0, Math.min(1, (x - x0) / span));
        return y0 - (y0 - y1) * ((1 - m) * expC(t, k) + m * logC(t, g)) + 11 * (nzA(x / 640) - 0.5);
      };
      let fadeStart, fLen;
      if (A.elder) { fadeStart = end - 0.32 * span; fLen = 0.5 * span; }
      else if (aj === casIdx) { fadeStart = 6650 + r() * 650; fLen = 480 + r() * 260; }
      else { fadeStart = 8300 + r() * 950; fLen = 700 + r() * 900; }
      drawCurve(x0, end, yAt, ink, wdt, bop, fadeStart, fLen, A.elder ? null : bunchShade);
      arcGeom.push({ x0, end, span, yAt, fadeStart, fLen, bop, elder: !!A.elder, late: !!A.late, cas: aj === casIdx });
    }

    // ---- the cycle restarts: two sprout arcs at the floor of P9-P10 -------
    // v3.2: sprouts louder (op .115+, w 1.6, curvature 1.9) — the thesis beat
    // must register; each gets one first-print marker dot (own RNG channel).
    for (let si = 0; si < 2; si++) {
      const sx0 = nb(si === 0 ? 9280 + r() * 330 : 10020 + r() * 260);
      const sEnd = sx0 + (1.35 + r() * 0.5) * W;
      const sy0 = 1205 + r() * 35, sRise = 155 + r() * 95, sk = 1.9 + r() * 0.4;
      const nzS = valueNoise1D(seed + 977 + si * 61);
      const sspan = sEnd - sx0;
      const yAtS = (x) => { const t = Math.max(0, Math.min(1, (x - sx0) / sspan)); return sy0 - sRise * expC(t, sk) + 7 * (nzS(x / 460) - 0.5); };
      drawCurve(sx0, sEnd, yAtS, INKS.platinum, '1.6', 0.115 + r() * 0.025, SW + 900, 500, null);
      const rs = mulberry32((seed ^ 0xE7A0) + 131 + si * 37);
      const spx = Math.min(10600, sx0 + (0.55 + rs() * 0.15) * sspan); // clamp respects the right edge band
      out += `<circle cx="${Math.round(spx)}" cy="${Math.round(yAtS(spx))}" r="2.2" fill="${si === 0 ? c.b : c.a}" opacity="${si === 0 ? '0.40' : '0.38'}"/>`;
    }

    // ---- hero: warm glow core after the knee, then the bright hairline ----
    // Edge law (rubric rule 6): hue lives only inside [hIn, hOut]. The line
    // still runs edge-to-edge for strip continuity, but it enters and leaves
    // as neutral ink — "one of the crowd" — so no accent touches the outer
    // 60px bands. Handoff segments taper opacity so the ignition reads
    // gradual, not switched.
    const hIn = 210, hOut = SW - 210;
    const heroSeg = (sx, ex, col, op) => {
      let d = '';
      const pts2 = Math.ceil((ex - sx) / 16);
      for (let p = 0; p <= pts2; p++) { const px = sx + ((ex - sx) * p) / pts2; d += (p ? 'L' : 'M') + Math.round(px) + ' ' + Math.round(heroY(px)); }
      out += `<path d="${d}" fill="none" stroke="${col}" stroke-width="2.3" opacity="${op.toFixed(3)}"/>`;
    };
    let gd = '';
    {
      const gs = xBk - 40, ge = hOut, pts2 = Math.ceil((ge - gs) / 18);
      for (let p = 0; p <= pts2; p++) { const px = gs + ((ge - gs) * p) / pts2; gd += (p ? 'L' : 'M') + Math.round(px) + ' ' + Math.round(heroY(px)); }
      out += `<path d="${gd}" fill="none" stroke="${c.ga}" stroke-width="9" opacity="${(0.065 * boost).toFixed(3)}"/>`;
    }
    const hop = (x) => 0.24 + 0.07 * sig((x - 3800) / 1300) + 0.1 * sig((x - xBk) / 220);
    heroSeg(heroX0, hIn, INKS.platinum, 0.15);
    const HN = 16;
    for (let s2 = 0; s2 < HN; s2++) {
      const sx = hIn + ((hOut - hIn) * s2) / HN, ex = hIn + ((hOut - hIn) * (s2 + 1)) / HN;
      const taper = s2 === 0 ? 0.6 : s2 === HN - 1 ? 0.7 : 1;
      heroSeg(sx, ex, c.a, hop((sx + ex) / 2) * taper);
    }
    heroSeg(hOut, SW + 60, INKS.platinum, 0.15);

    // ---- milestone nodes on the hero (irregular) --------------------------
    const ms = schedule(r, SW, 0.5, 1.3);
    let runCol = '', runLen = 0;
    const msPts = []; // v3.2: captured for the pennant pass
    for (const mx0 of ms) {
      const mx = nb(mx0);
      if (mx < 520 || mx > 10420 || Math.abs(mx - xBk) < 320) continue;
      const my = heroY(mx);
      let col = r() < 0.5 ? c.a : c.b;
      if (col === runCol && runLen >= 2) col = col === c.a ? c.b : c.a;
      if (col === runCol) runLen++; else { runCol = col; runLen = 1; }
      const safe = my > 1012 || my < 338;                 // halo only outside the text mid-band
      if (safe) out += `<circle cx="${Math.round(mx)}" cy="${Math.round(my)}" r="${Math.round(125 + r() * 50)}" fill="${col === c.a ? c.ga : c.gb}" opacity="${(0.05 * boost).toFixed(3)}" filter="url(#nb-blur)"/>`;
      out += `<circle cx="${Math.round(mx)}" cy="${Math.round(my)}" r="${(2.8 + r() * 1.7).toFixed(1)}" fill="${col}" opacity="${(0.45 + r() * 0.15).toFixed(2)}"/>`;
      msPts.push({ mx, my, col });
    }

    // ---- THE LANDMARK: breakaway glint at the knee (once, off-boundary) ---
    const bx = Math.round(xBk), by = Math.round(heroY(xBk));
    out += `<circle cx="${bx}" cy="${by}" r="175" fill="${c.ga}" opacity="${Math.min(0.11, 0.1 * boost).toFixed(3)}" filter="url(#nb-blur)"/>`;
    const ang = (-13 + (r() - 0.5) * 6).toFixed(1);
    out += `<g transform="rotate(${ang} ${bx} ${by})">`
      + `<line x1="${bx - 95}" y1="${by}" x2="${bx + 155}" y2="${by}" stroke="${c.ga}" stroke-width="1.2" opacity="0.32"/>`
      + `<line x1="${bx}" y1="${by - 58}" x2="${bx}" y2="${by + 44}" stroke="${c.ga}" stroke-width="1.2" opacity="0.22"/></g>`;
    out += `<circle cx="${bx}" cy="${by}" r="5.2" fill="${c.ga}" opacity="0.6"/>`
      + `<circle cx="${bx}" cy="${by}" r="2.1" fill="${c.c}" opacity="0.55"/>`;
    for (let i = 0; i < 3; i++)
      out += `<circle cx="${Math.round(bx - 70 + r() * 160)}" cy="${Math.round(by - 55 + r() * 95)}" r="${(1.3 + r() * 0.7).toFixed(1)}" fill="${c.ga}" opacity="${(0.26 + r() * 0.1).toFixed(2)}"/>`;

    // ======================================================================
    // v3.2 chart-anatomy passes. All on independent RNG channels
    // (mulberry32((seed ^ 0xE7A0) + tag)) appended AFTER the legacy r()
    // stream, so nothing above re-jitters; all positions derive from live
    // geometry (yAt/heroY/P/fadeStart) with the nb()/mid-band/edge guards.
    // ======================================================================

    // (1) chart-origin anatomy: 3 gridline hairlines fading out by ~P2 end,
    //     plus aperiodic baseline ticks rising from y~1330 (all below the
    //     1012 mid-band floor; neutral ink only).
    {
      const ra = mulberry32((seed ^ 0xE7A0) + 11);
      for (let li = 0; li < 3; li++) {
        const gy = [1030, 1140, 1250][li] + (ra() - 0.5) * 14;
        const fc = 1250 + ra() * 250, fw = 250 + ra() * 80;
        for (let sx = 140; sx < 2100; sx += 196) {
          const ex = Math.min(2100, sx + 196), gmid = (sx + ex) / 2;
          const op = 0.05 * (1 - sig((gmid - fc) / fw));
          if (op < 0.006) break;
          out += `<line x1="${sx}" y1="${gy.toFixed(1)}" x2="${Math.round(ex)}" y2="${gy.toFixed(1)}" stroke="${INKS.platinum}" stroke-width="1" opacity="${op.toFixed(3)}"/>`;
        }
      }
      let tx = 150 + ra() * 170;
      while (tx < 1500) {
        const th = 6 + ra() * 3, txx = nb(tx);
        out += `<line x1="${Math.round(txx)}" y1="1330" x2="${Math.round(txx)}" y2="${(1330 - th).toFixed(1)}" stroke="${INKS.silver}" stroke-width="1" opacity="0.08"/>`;
        tx += 185 + Math.pow(ra(), 1.4) * 260;
      }
    }

    // (2b) 7th ghost arc: fills the thin P3-P5 sky with the composition's
    //      own depth device (prior generations drifting high).
    {
      const rg = mulberry32((seed ^ 0xE7A0) + 23);
      const gx0 = nb(1900 + rg() * 700);
      const gEnd = Math.min(SW + 160, gx0 + (2.8 + rg() * 0.6) * W);
      const yb = 240 + rg() * 180, rise = 60 + rg() * 70, gg = 3.8 + rg() * 1.6;
      const nzG7 = valueNoise1D(seed + 4243);
      const gspan = gEnd - gx0;
      const yAtG7 = (x) => { const t = Math.max(0, Math.min(1, (x - gx0) / gspan)); return yb - rise * logC(t, gg) + 20 * (nzG7(x / 900) - 0.5); };
      drawCurve(gx0, gEnd, yAtG7, INKS.platinum, (1.3 + rg() * 0.3).toFixed(1), 0.09, gEnd + 900, 600, null);
    }

    // (3) tick-dot data markers on the pack (P3-P8): sparse per-series
    //     prints make the bunch read as many time-series; ~15% carry the
    //     cool c.b, threaded through the milestone runCol/runLen caps.
    //     Mid-band dots stay <=2.2px and <=0.22.
    {
      const rt2 = mulberry32((seed ^ 0xE7A0) + 47);
      let nDots = 0;
      for (const Ag of arcGeom) {
        if (Ag.elder || Ag.late || nDots >= 22) continue;
        const n = 1 + (rt2() < 0.4 ? 1 : 0);
        for (let di = 0; di < n && nDots < 22; di++) {
          const t = 0.25 + Math.pow(rt2(), 1.25) * 0.55;
          const dxp = Ag.x0 + t * Ag.span;
          const hueRoll = rt2(), rr = 1.6 + rt2() * 0.5, opR = rt2();
          if (dxp < 2200 || dxp > 8300 || dxp > Ag.fadeStart) continue;
          const dyp = Ag.yAt(dxp);
          const inBand = dyp > 338 && dyp < 1012;
          if (hueRoll < 0.15) {
            let col = c.b;
            if (col === runCol && runLen >= 2) col = c.a;
            if (col === runCol) runLen++; else { runCol = col; runLen = 1; }
            out += `<circle cx="${Math.round(dxp)}" cy="${Math.round(dyp)}" r="${rr.toFixed(1)}" fill="${col}" opacity="${inBand ? '0.22' : '0.30'}"/>`;
          } else {
            out += `<circle cx="${Math.round(dxp)}" cy="${Math.round(dyp)}" r="${rr.toFixed(1)}" fill="${INKS.platinum}" opacity="${(0.16 + opR * 0.06).toFixed(2)}"/>`;
          }
          nDots++;
        }
      }
    }

    // (5) pennant flags on 2-3 hero milestones already outside the text
    //     mid-band (floor nodes in P2-3, sky nodes in P8-9), clear of xBk.
    //     <=20px, op 0.3, the dot's own kit hue — the knee glint still wins.
    {
      const rp = mulberry32((seed ^ 0xE7A0) + 61);
      const elig = msPts.filter((m) => Math.abs(m.mx - xBk) >= 400 &&
        ((m.my > 1036 && m.mx > 1080 && m.mx < 3240) || (m.my < 318 && m.mx > 7560 && m.mx < 9720)));
      const nP = Math.min(elig.length, 2 + (rp() < 0.5 ? 1 : 0));
      for (let pi = 0; pi < nP; pi++) {
        const m = elig[Math.floor((pi * elig.length) / nP)];
        const L = 14 + rp() * 6, py = m.my - L;
        out += `<line x1="${Math.round(m.mx)}" y1="${(m.my - 4).toFixed(1)}" x2="${Math.round(m.mx)}" y2="${py.toFixed(1)}" stroke="${m.col}" stroke-width="1" opacity="0.3"/>`
          + `<line x1="${Math.round(m.mx)}" y1="${py.toFixed(1)}" x2="${(m.mx + 7).toFixed(1)}" y2="${(py + 2.8).toFixed(1)}" stroke="${m.col}" stroke-width="1" opacity="0.3"/>`;
      }
    }

    // (6) terminal "last print" dots where series die: elder tip (P2),
    //     casualty end (P7), two staggered P9 pack fades. Neutral ink,
    //     placed at each arc's last drawn segment midpoint (live geometry).
    {
      const rT = mulberry32((seed ^ 0xE7A0) + 83);
      const lastMid = (Ag) => {
        let lm = null;
        for (let s2 = 0; s2 < 9; s2++) {
          const mid = Ag.x0 + (Ag.span * (s2 + 0.5)) / 9;
          const tip = s2 === 0 ? 0.4 : s2 === 1 ? 0.8 : s2 === 8 ? 0.35 : s2 === 7 ? 0.7 : 1;
          const lf = mid <= Ag.fadeStart ? 1 : Math.max(0, 1 - (mid - Ag.fadeStart) / Ag.fLen);
          if (Ag.bop * tip * lf >= 0.008) lm = mid;
        }
        return lm;
      };
      const termDot = (Ag, ink2, op2) => {
        const lm = lastMid(Ag);
        if (lm == null) return;
        out += `<circle cx="${Math.round(lm)}" cy="${Math.round(Ag.yAt(lm))}" r="${(1.8 + rT() * 0.4).toFixed(1)}" fill="${ink2}" opacity="${op2}"/>`;
      };
      const elderG = arcGeom.find((a) => a.elder);
      if (elderG) termDot(elderG, INKS.platinum, '0.2');
      const casG = arcGeom.find((a) => a.cas);
      if (casG) termDot(casG, INKS.silver, '0.18');
      const p9 = arcGeom.filter((a) => !a.elder && !a.cas)
        .map((a) => ({ a, lm: lastMid(a) }))
        .filter((o) => o.lm != null && o.lm > 7800 && o.lm < 9620) // survival-act strands only; stays out of P10
        .sort((o1, o2) => o1.lm - o2.lm);
      const picks = p9.slice(-2); // the last two strands to die get their period
      for (const o of picks)
        out += `<circle cx="${Math.round(o.lm)}" cy="${Math.round(o.a.yAt(o.lm))}" r="${(1.8 + rT() * 0.4).toFixed(1)}" fill="${INKS.platinum}" opacity="0.15"/>`;
    }

    // (9) dash-jittered asymptote hairline at the pack's ceiling P(∞) ~438:
    //     fades in after the knee, dies before the survival act. Irregular
    //     dash/gap lengths — never a fixed period. op<=0.045 in the band.
    {
      const rD = mulberry32((seed ^ 0xE7A0) + 97);
      const nzD = valueNoise1D(seed + 7331);
      const yAs = P(SW * 40);
      const ci = xBk + 860, co = 8760;
      let dxx = ci - 320;
      while (dxx < 9150) {
        const len = 18 + rD() * 16, gap = 50 + rD() * 30;
        const dmid = dxx + len / 2;
        const env = sig((dmid - ci) / 170) * (1 - sig((dmid - co) / 180));
        const op = 0.045 * env;
        if (op >= 0.006) {
          const jy = yAs + 3 * (nzD(dmid / 640) - 0.5);
          out += `<line x1="${Math.round(dxx)}" y1="${jy.toFixed(1)}" x2="${Math.round(dxx + len)}" y2="${jy.toFixed(1)}" stroke="${INKS.platinum}" stroke-width="1" opacity="${op.toFixed(3)}"/>`;
        }
        dxx += len + gap;
      }
    }

    // (10) genesis runs cold: 2-3 extra floor-row accent dots in x 520-2200,
    //      cool-favored 2:1, same size/op family as the legacy accents.
    {
      const rc2 = mulberry32((seed ^ 0xE7A0) + 149);
      const nA = 2 + (rc2() < 0.5 ? 1 : 0);
      let axx = 540 + rc2() * 460;
      for (let i2 = 0; i2 < nA && axx < 2200; i2++) {
        const rowY = rows[Math.floor(rc2() * 3) % 3] + (rc2() - 0.5) * 30;
        const colA = rc2() < 0.667 ? c.b : c.a;
        out += `<circle cx="${Math.round(axx)}" cy="${Math.round(rowY)}" r="${(2.8 + rc2() * 1.2).toFixed(1)}" fill="${colA}" opacity="${(0.36 + rc2() * 0.18).toFixed(2)}"/>`;
        axx += 320 + rc2() * 460;
      }
    }

    return out;
  },
};
})();

STYLE_DEFS["emberfield"] = (function () {
const PAGES = NATIVE_PAGES;
void PAGES;
// emberfield · "cooling field" · cat amber
// ONE 10800x1350 scene: a field of ingots cooling after a pour, low horizon.
//
// PAGE MAP (x in W=1080 units — all ramps ride smoothstep+noise, anchored
// OFF frame boundaries, so every adjacent pair is the same world mid-motion):
//  P1-P3 (0-3W)   HOT ZONE — dense slab clusters on two depth planes, many
//                 ga cores at varied intensity, smoke wisps leaning with a
//                 drifting wind, spark specks, warm ground pools.
//  P4    (3-4W)   HERO — brightest ingot (landmark, once, x=3.25-3.75W):
//                 white-hot crack, stacked core glow, faint haze above,
//                 neighbors' glows suppressed so it owns the page.
//  P5-P7 (4-7W)   COOLING — heat ramps down from x≈2.9W to ≈8.0W, density
//                 from ≈4.5W to ≈9.6W; glows weaken, wisps thin out.
//  P8-P9 (7-9W)   COLD — sparse dark slabs, cool b rims only, ONE gb glint
//                 (landmark, once, off-boundary window).
//  P10   (9-10W)  EMPTY — bare ground, horizons and slag streaks run on,
//                 a single last ember dot (landmark, once).
//
// v3.2 ENHANCEMENT PASS (anatomy, not layout — the realized walk, ramps,
// anchors and hue kits are byte-identical; every new detail rides its OWN
// rng channel, seed^0xE7A0-keyed, so nothing downstream re-jitters):
//  · billet/round-stock bundles — 2nd silhouette family at ~1.40/2.55/5.25/
//    6.60W; the 1.40W one end-on as 3+2 hex-packed rounds with one c.a arc
//  · high smoke-haze drift bands over P1-P5 tops (y<300, alpha<=0.035)
//  · dunnage spacer ticks lifting stacked piles 3-4px (platinum, hot pages)
//  · chalk identity tick pairs on ~30% of wide slab faces (c.b hot /
//    platinum cold), lifting-lug notches on ~25% (coal step + hairline)
//  · radiant floor glow under g>0.55 slabs (ga ellipse below the base seam)
//  · torch-cut end seams — short c.a strokes down hot slabs' side edges
//  · one distant crane fall + girder at ~1.6W (platinum, stops y~360)
//  · P9 transfer-rail pair fading into P10 + a waiting cold slab pair;
//    P10 dead-ember dots + one spilled-runner line (all neutral ink)
//  · cold-zone rim swap: ~60% of heat<0.05 rims trade c.b for silver
// (helpers provided by the registry's shared toolkit)
return {
  key: 'emberfield',
  name: 'cooling field',
  cat: 'amber',
  desc: 'ingot field cooling after the pour — ember cores fade to one last spark',
  gen(seed, hue) {
    const c = HUES[hue], SW = PAGES * W, boost = glowAlphaBoost(hue);
    const r = mulberry32(seed + 6047);
    const nzFar = valueNoise1D(seed + 109);
    const nzNear = valueNoise1D(seed + 223);
    const nzWind = valueNoise1D(seed + 349);
    const nzHeat = valueNoise1D(seed + 467);
    const nzClump = valueNoise1D(seed + 577);
    // v3.2 detail rng — independent channels keyed off the main stream so
    // new draws NEVER consume r() (which would re-jitter the whole yard)
    const dRng = (tag) => mulberry32(((seed ^ 0xE7A0) + tag) | 0);
    const slabRng = (x) => mulberry32(((seed ^ 0xE7A0) + Math.round(x * 13)) | 0);
    const f0 = (v) => v.toFixed(0), f1 = (v) => v.toFixed(1), f3 = (v) => v.toFixed(3);
    const ss = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
    const cl01 = (v) => Math.max(0, Math.min(1, v));
    // strip-edge hue exclusion (rubric hard failure 6: no hue accents at
    // x<60 or x>SW-60). Crisp accent strokes hard-gate outside EDGE; broad
    // blurred glows taper with edgeK — a smooth ramp, never a dark notch.
    const EDGE = 0.06 * W; // 64.8px, clears the 60px banned band
    const edgeK = (x) => ss(cl01((Math.min(x, SW - x) - 55) / 320));
    // heat: 1 through the hot zone, decays x≈2.9W→8.0W (never boundary-tied)
    const heat = (x) => cl01((1 - ss((x / SW - 0.27) / 0.47)) * (0.85 + 0.3 * nzHeat(x / (1.35 * W))));
    // density: full to x≈4.5W, gone by ≈9.6W
    const dens = (x) => 1 - ss((x / SW - 0.415) / 0.475);
    const wind = (x) => (nzWind(x / (2.35 * W)) - 0.5) * 2;
    const yFar = (x) => 958 + (nzFar(x / (1.85 * W)) - 0.5) * 88 + (nzFar(x / (0.43 * W)) - 0.5) * 26;
    const yNear = (x) => 1102 + (nzNear(x / (1.55 * W)) - 0.5) * 104 + (nzNear(x / (0.37 * W)) - 0.5) * 30;

    // landmark anchors — each >= 0.22W from every k*1080 by construction
    const xH = (3.25 + r() * 0.5) * W;                          // hero, page 4
    const xG = (r() < 0.5 ? 7.23 : 8.23) * W + r() * 0.5 * W;   // cool glint, p8-9
    const xE = (9.24 + r() * 0.49) * W;                         // last ember, p10

    let out = '';

    // ---- 1 · sky specks: warm motes over the hot field, cold dust beyond
    for (const px of schedule(r, SW, 0.5, 1.7)) {
      const hh = heat(px), warm = r() < hh * 1.25 && px > 80 && px < SW - 80;
      const py = 150 + r() * 500, pr = warm ? 1.1 + r() * 0.9 : 1 + r() * 0.6;
      out += warm
        ? `<circle cx="${f0(px)}" cy="${f0(py)}" r="${f1(pr)}" fill="${c.ga}" opacity="${f3(0.1 + 0.1 * hh)}"/>`
        : `<circle cx="${f0(px)}" cy="${f0(py)}" r="${f1(pr)}" fill="${INKS.silver}" opacity="${f3(0.06 + r() * 0.06)}"/>`;
    }

    // ---- 2 · ground bands (two depth planes; 149px sampling — never 1080-periodic)
    const bandPath = (yFn) => {
      let p = `M-24 ${H + 24}L-24 ${f0(yFn(0))}`;
      for (let bx = 0; bx <= SW + 148; bx += 149) p += `L${bx} ${f0(yFn(Math.min(bx, SW)))}`;
      return p + `L${SW + 24} ${H + 24}Z`;
    };
    const ridgePath = (yFn) => {
      let p = `M-24 ${f0(yFn(0))}`;
      for (let bx = 0; bx <= SW + 148; bx += 149) p += `L${bx} ${f0(yFn(Math.min(bx, SW)))}`;
      return p;
    };
    out += `<path d="${bandPath(yFar)}" fill="${INKS.navy}" opacity="0.2"/>`;
    out += `<path d="${ridgePath(yFar)}" fill="none" stroke="${INKS.platinum}" stroke-width="1" opacity="0.14"/>`;

    // ---- 3 · far-plane ingots (small, partly swallowed by the near band)
    const slab = (x0, y0, w, h2, tilt, insetK, fillOp) => {
      const skew = h2 * tilt, inset = w * insetK;
      const xl = x0 - w / 2, xr = x0 + w / 2;
      return {
        path: `<path d="M${f1(xl)} ${f1(y0)}L${f1(xr)} ${f1(y0)}L${f1(xr - inset + skew)} ${f1(y0 - h2)}L${f1(xl + inset + skew)} ${f1(y0 - h2)}Z" fill="${INKS.coal}" opacity="${f3(fillOp)}"/>`,
        tl: [xl + inset + skew, y0 - h2], tr: [xr - inset + skew, y0 - h2],
      };
    };
    let fx = -80 + r() * 170;
    while (fx < SW * 0.886) {
      const d = Math.max(dens(fx), fx / SW < 0.87 ? 0.1 : 0), hh = heat(fx);
      const clumpF = 0.5 + 1.0 * nzClump(fx / (0.29 * W) + 7);
      const w = 34 + r() * 72, h2 = w * (0.3 + r() * 0.24);
      const y0 = yFar(fx) + 12 + r() * 40;
      const g = hh > 0.07 ? hh * r() * r() : 0;
      // edge law: silhouettes may straddle the frame, hue accents may not
      const eSafe = fx - 0.66 * w > EDGE && fx + 0.66 * w < SW - EDGE;
      const ek = edgeK(fx);
      if (g > 0.28 && ek > 0.01) out += `<circle cx="${f0(fx)}" cy="${f0(y0 - h2 * 0.5)}" r="${f0(44 + 66 * g)}" fill="${c.ga}" opacity="${f3((0.038 + 0.05 * g) * boost * ek)}" filter="url(#nb-blur)"/>`;
      const s = slab(fx, y0, w, h2, (r() - 0.5) * 0.2, 0.05 + r() * 0.09, 0.55 + r() * 0.25);
      out += s.path;
      if (g > 0.28) {
        if (eSafe) out += `<line x1="${f1(s.tl[0])}" y1="${f1(s.tl[1])}" x2="${f1(s.tr[0])}" y2="${f1(s.tr[1])}" stroke="${c.a}" stroke-width="1" opacity="${f3(0.13 + 0.2 * g)}"/>`;
      } else if (r() < 0.6) {
        const rimOp = 0.08 + r() * 0.08; // consume r() even when edge-gated
        // v3.2: dead-cold rims read moonlit-silver on ~60% (c.b kept on the
        // rest so the kit's second hue survives) — ink swap only
        const rimInk = hh < 0.05 && slabRng(fx)() < 0.6 ? INKS.silver : c.b;
        if (eSafe) out += `<line x1="${f1(s.tl[0])}" y1="${f1(s.tl[1])}" x2="${f1(s.tr[0])}" y2="${f1(s.tr[1])}" stroke="${rimInk}" stroke-width="1" opacity="${f3(rimOp)}"/>`;
      }
      fx += Math.max(40, (56 + Math.pow(r(), 1.5) * 250) / (0.13 + 0.87 * d) * clumpF);
    }

    // ---- 4 · near ground band (darker silhouette plane) + its ridge
    out += `<path d="${bandPath(yNear)}" fill="${INKS.coal}" opacity="0.34"/>`;
    out += `<path d="${ridgePath(yNear)}" fill="none" stroke="${INKS.platinum}" stroke-width="1" opacity="0.07"/>`;

    // ---- 5 · ambient pools ON the near ground — the field radiating heat,
    //          decaying with the arc; the odd cool breath once it's gone cold
    for (const px of schedule(r, SW, 0.8, 2.2, 2.8)) {
      const hh = heat(px), ek = edgeK(px); // pools reach r≈380 — taper at edges
      const pr = 190 + r() * 190, py = yNear(px) + 40 + r() * 140;
      if (hh > 0.12) {
        if (ek > 0.01) out += `<circle cx="${f0(px)}" cy="${f0(py)}" r="${f0(pr)}" fill="${c.ga}" opacity="${f3((0.034 + 0.06 * hh) * boost * ek)}" filter="url(#nb-blur)"/>`;
      } else if (r() < 0.7) {
        if (ek > 0.01) out += `<circle cx="${f0(px)}" cy="${f0(py)}" r="${f0(pr * 0.85)}" fill="${c.gb}" opacity="${f3(0.036 * boost * ek)}" filter="url(#nb-blur)"/>`;
      }
    }

    // ---- 6 · slag streaks, molten runner threads (pour channels) and
    //          ground micro-embers — texture runs the full strip
    let sx = 90 + r() * 300; // never start a hue thread inside the x<60 band
    while (sx < SW - 130) {
      const d = 0.25 + 0.75 * dens(sx), hh = heat(sx);
      const yn = yNear(sx);
      const sy = yn + 42 + r() * Math.max(30, H - 84 - yn);
      const len = 40 + r() * 140, dy = (r() - 0.5) * 9;
      if (r() < 0.34 * hh) { // a cooling runner still glowing in its channel
        const jog = (r() - 0.5) * 12;
        out += `<path d="M${f0(sx)} ${f1(sy)}L${f0(sx + len * 0.45)} ${f1(sy + jog)}L${f0(sx + len)} ${f1(sy + jog * 0.4 + dy * 0.4)}" fill="none" stroke="${c.ga}" stroke-width="1.4" opacity="${f3(0.12 + 0.26 * hh * r())}" stroke-linecap="round"/>`;
      } else {
        out += `<line x1="${f0(sx)}" y1="${f1(sy)}" x2="${f0(sx + len)}" y2="${f1(sy + dy)}" stroke="${INKS.platinum}" stroke-width="1" opacity="${f3(0.045 + r() * 0.055)}"/>`;
      }
      if (r() < 0.45 * hh) {
        out += `<circle cx="${f0(sx + r() * len)}" cy="${f1(sy - 2 - r() * 8)}" r="${f1(0.9 + r() * 1.3)}" fill="${c.ga}" opacity="${f3(0.22 + r() * 0.3)}"/>`;
      }
      sx += 105 + Math.pow(r(), 1.3) * (150 + 500 * (1 - d));
    }

    // ---- 7 · near-plane ingots: glow core → slab (± stacked pile) → rim →
    //          crack → spill → sparks → wisp. Heat gates everything.
    const wisp = (wx, wy, rise, lean, amp, col, op, wd) => {
      const x1 = wx + lean * 0.18 + amp, y1 = wy - rise * 0.34;
      const x2 = wx + lean * 0.62 - amp * 0.8, y2 = wy - rise * 0.68;
      return `<path d="M${f1(wx)} ${f1(wy)}C${f1(x1)} ${f1(y1)} ${f1(x2)} ${f1(y2)} ${f1(wx + lean)} ${f1(wy - rise)}" stroke="${col}" stroke-width="${wd}" fill="none" opacity="${f3(op)}" stroke-linecap="round"/>`;
    };
    let wispN = 0;
    const drawNear = (x0) => {
      const dr = slabRng(x0); // v3.2 detail channel — never touches r()
      const yTop = yNear(x0);
      const depth = r();
      const y0 = Math.min(H - 26, yTop + 34 + depth * (H - 74 - yTop));
      const sc = 0.5 + 0.55 * depth;
      const w = (70 + r() * 130) * sc, h2 = w * (0.3 + r() * 0.22);
      const hh = heat(x0), d = dens(x0);
      let g = hh > 0.07 ? Math.min(0.85, hh * Math.pow(r(), 1.3) * 1.15) : 0;
      if (Math.abs(x0 - xH) < 650) g *= 0.35;
      // edge law: the coal silhouette may straddle the frame edge, but hue
      // accents may not (base-contact line spans x0±0.62w → test 0.66w)
      const eSafe = x0 - 0.66 * w > EDGE && x0 + 0.66 * w < SW - EDGE;
      const ek = edgeK(x0);
      if (g > 0.15 && ek > 0.01) out += `<circle cx="${f0(x0)}" cy="${f0(y0 - h2 * 0.5)}" r="${f0(60 + 150 * g)}" fill="${c.ga}" opacity="${f3((0.05 + 0.08 * g) * boost * ek)}" filter="url(#nb-blur)"/>`;
      const s = slab(x0, y0, w, h2, (r() - 0.5) * 0.22, 0.05 + r() * 0.09, 0.7 + r() * 0.2);
      out += s.path;
      let top = s;
      if (r() < 0.22 * d && w > 88) { // stacked pile — hot yards pile ingots
        const w3 = w * (0.5 + r() * 0.2), h3 = h2 * (0.7 + r() * 0.2);
        // v3.2: slabs never stack face-to-face — dunnage lifts the upper one
        const lift = 3 + dr();
        const xs2 = x0 + (r() - 0.5) * w * 0.24; // same r() order as shipped
        const s2 = slab(xs2, y0 - h2 - lift, w3, h3, (r() - 0.5) * 0.3, 0.1, 0.72 + r() * 0.18);
        out += s2.path;
        // spacer ticks in the air gap, unevenly walked across the overlap
        const nT = 2 + (dr() < 0.4 ? 1 : 0);
        let tf = 0.14 + dr() * 0.2;
        for (let i = 0; i < nT && tf < 0.92; i++) {
          const tx = xs2 - w3 / 2 + tf * w3;
          out += `<line x1="${f1(tx)}" y1="${f1(y0 - h2 - lift)}" x2="${f1(tx)}" y2="${f1(y0 - h2 + 1)}" stroke="${INKS.platinum}" stroke-width="1" opacity="${f3(0.1 + dr() * 0.04)}"/>`;
          tf += 0.2 + dr() * 0.24;
        }
        top = s2;
      }
      if (g > 0.32) {
        if (eSafe) out += `<line x1="${f1(top.tl[0])}" y1="${f1(top.tl[1])}" x2="${f1(top.tr[0])}" y2="${f1(top.tr[1])}" stroke="${c.a}" stroke-width="1.2" opacity="${f3(0.18 + 0.3 * g)}"/>`;
      } else {
        // skylight rim + faint top-face sheen — how a cold slab reads
        const rimOp = 0.15 + r() * 0.13; // consume r() even when edge-gated
        // v3.2: dead-cold rims (heat<0.05) go silver on ~60% — in amber c.b
        // is warm gold, so "cold" read dying-warm; silver is hue-invariant
        const rimInk = hh < 0.05 && dr() < 0.6 ? INKS.silver : c.b;
        if (eSafe) out += `<line x1="${f1(top.tl[0])}" y1="${f1(top.tl[1])}" x2="${f1(top.tr[0])}" y2="${f1(top.tr[1])}" stroke="${rimInk}" stroke-width="1.5" opacity="${f3(rimOp)}"/>`;
        if (r() < 0.7) out += `<path d="M${f1(top.tl[0])} ${f1(top.tl[1])}L${f1(top.tr[0])} ${f1(top.tr[1])}L${f1(top.tr[0] - 5)} ${f1(top.tr[1] + 6)}L${f1(top.tl[0] + 5)} ${f1(top.tl[1] + 6)}Z" fill="${INKS.platinum}" opacity="${f3(0.07 + r() * 0.06)}"/>`;
      }
      // v3.2 lug notches (~25% of wide slabs, P1-P9) — tong reliefs stepped
      // into the top edge near each end; coal-on-coal + a hairline wall
      if (w > 110 && x0 < 9 * W && dr() < 0.25) {
        const eL = top.tr[0] - top.tl[0];
        const nf = [0.12 + dr() * 0.06, 0.82 + dr() * 0.06];
        for (let i = 0; i < 2; i++) {
          const nx2 = top.tl[0] + nf[i] * eL, ny2 = top.tl[1];
          const wallX = i === 0 ? nx2 + 3 : nx2 - 3; // inner edge of the cut
          out += `<rect x="${f1(nx2 - 3)}" y="${f1(ny2 - 0.8)}" width="6" height="4.8" fill="${INKS.coal}" opacity="0.92"/>`;
          out += `<line x1="${f1(wallX)}" y1="${f1(ny2)}" x2="${f1(wallX)}" y2="${f1(ny2 + 4)}" stroke="${INKS.platinum}" stroke-width="1" opacity="0.08"/>`;
        }
      }
      // v3.2 identity tick pairs (~30% of wide slabs, P1-P8) — chalked heat/
      // lot marks on the front face; c.b hot, platinum cold, never near a
      // landmark window
      if (w > 100 && x0 < 8 * W && dr() < 0.3 && Math.abs(x0 - xH) > 300 && Math.abs(x0 - xG) > 300) {
        const my = y0 - h2 * 0.65, mx = x0 + (dr() - 0.5) * w * 0.3;
        const ml = 8 + dr() * 6, sk = (dr() - 0.5) * 3, mg = 4 + dr() * 2;
        const hotMk = g > 0.32;
        if (!hotMk || eSafe) {
          const mInk = hotMk ? c.b : INKS.platinum;
          const mOp = f3((hotMk ? 0.12 : 0.1) + dr() * 0.04);
          out += `<line x1="${f1(mx)}" y1="${f1(my)}" x2="${f1(mx + sk)}" y2="${f1(my + ml)}" stroke="${mInk}" stroke-width="1" opacity="${mOp}"/>`;
          out += `<line x1="${f1(mx + mg)}" y1="${f1(my)}" x2="${f1(mx + mg + sk)}" y2="${f1(my + ml)}" stroke="${mInk}" stroke-width="1" opacity="${mOp}"/>`;
        }
      }
      // v3.2 torch-cut end seam (hot fringe only) — the cut END face stays
      // hottest longest; a short c.a stroke down one slanted side edge
      if (g > 0.45 && x0 < 4.35 * W && eSafe && dr() < 0.7) {
        const rSide = dr() < 0.5;
        const bcx = rSide ? x0 + w / 2 : x0 - w / 2;
        const tc = rSide ? s.tr : s.tl;
        const ddx = bcx - tc[0], ddy = y0 - tc[1];
        const dl = Math.hypot(ddx, ddy) || 1, sl = 5 + dr() * 4;
        out += `<line x1="${f1(tc[0])}" y1="${f1(tc[1])}" x2="${f1(tc[0] + (ddx / dl) * sl)}" y2="${f1(tc[1] + (ddy / dl) * sl)}" stroke="${c.a}" stroke-width="1.2" opacity="${f3(0.2 + 0.25 * g)}" stroke-linecap="round"/>`;
      }
      if (g > 0.28) {
        const sy2 = y0 - h2 * (0.32 + r() * 0.3);
        const sx1 = x0 - w * (0.18 + r() * 0.2), sx2 = x0 + w * (0.12 + r() * 0.22);
        const jog = (r() - 0.5) * h2 * 0.3;
        if (eSafe) out += `<path d="M${f1(sx1)} ${f1(sy2)}L${f1((sx1 + sx2) / 2)} ${f1(sy2 + jog)}L${f1(sx2)} ${f1(sy2 + jog * 0.3)}" stroke="${c.ga}" stroke-width="${f1(1.3 + g)}" fill="none" opacity="${f3(0.22 + 0.38 * g)}" stroke-linecap="round"/>`;
      }
      // v3.2 radiant floor glow — hot steel lights the ground under it first;
      // drawn beneath the base-contact line so the line is the bright seam
      if (g > 0.55 && ek > 0.01) out += `<ellipse cx="${f0(x0)}" cy="${f0(y0 + 10)}" rx="${f0(w * 0.9)}" ry="${f0(12 + dr() * 4)}" fill="${c.ga}" opacity="${f3((0.04 + 0.06 * g) * boost * ek)}" filter="url(#nb-blur)"/>`;
      if (g > 0.5 && eSafe) out += `<line x1="${f1(x0 - w * 0.62)}" y1="${f1(y0 + 2)}" x2="${f1(x0 + w * 0.62)}" y2="${f1(y0 + 2)}" stroke="${c.ga}" stroke-width="1.6" opacity="${f3(0.1 + 0.2 * g)}"/>`;
      if (g > 0.6) {
        const n = 1 + Math.floor(r() * 2.2);
        for (let i = 0; i < n; i++) {
          // sparks stray up to ~65px from x0 — gate each on its OWN cx
          const scx = x0 + (r() - 0.5) * 70 + wind(x0) * 30, scy = y0 - h2 - 8 - r() * 85;
          const srr = 1 + r() * 1.3, sop = 0.3 + r() * 0.25;
          if (scx > EDGE && scx < SW - EDGE) out += `<circle cx="${f1(scx)}" cy="${f1(scy)}" r="${f1(srr)}" fill="${c.ga}" opacity="${f3(sop)}"/>`;
        }
      }
      if (g > 0.42 && wispN < 22 && r() < 0.75) {
        wispN++;
        const rise = 200 + r() * 240, lean = wind(x0) * (70 + r() * 90), amp = (r() - 0.5) * 70;
        out += wisp(x0 + (r() - 0.5) * w * 0.4, y0 - h2 - 4, rise, lean, amp, INKS.silver, 0.08 + r() * 0.06, 1.3);
        if (r() < 0.4) out += wisp(x0 + (r() - 0.5) * w * 0.5, y0 - h2 - 2, rise * 0.7, lean * 0.8, -amp, INKS.silver, 0.06, 1);
      }
    };
    let nx = -140 + r() * 130;
    while (nx < SW * 0.907) {
      const t = nx / SW;
      // walk density: arc density with a small cold-zone floor (ends x≈9.45W)
      const dw = Math.max(dens(nx), t < 0.875 ? 0.13 : 0);
      const clump0 = 0.5 + 1.0 * nzClump(nx / (0.34 * W));
      // the hot opening stays packed: clumps yes, voids no
      const clump = t < 0.25 ? Math.min(clump0, 1.0) : clump0;
      if (Math.abs(nx - xH) > 250) drawNear(nx);
      let step = (40 + Math.pow(r(), 1.6) * 225) / (0.10 + 0.90 * dw) * clump;
      if (r() < 0.10 && t > 0.3) step *= 2.4; // occasional dead stretch
      nx += Math.max(36, step);
    }

    // ---- 8 · HERO ingot (page 4) — brightest core in the field + haze above
    {
      const yH0 = Math.min(H - 40, yNear(xH) + 88);
      const w = 208 + r() * 50, h2 = w * 0.42;
      const wl = wind(xH);
      out += `<circle cx="${f0(xH)}" cy="${f0(yH0 - h2 * 0.4)}" r="300" fill="${c.ga}" opacity="${f3(0.08 * boost)}" filter="url(#nb-blur)"/>`;
      out += `<circle cx="${f0(xH)}" cy="${f0(yH0 - h2 * 0.45)}" r="150" fill="${c.ga}" opacity="${f3(0.1 * boost)}" filter="url(#nb-blur)"/>`;
      out += `<circle cx="${f0(xH + wl * 60)}" cy="${f0(yH0 - h2 - 300)}" r="185" fill="${c.ga}" opacity="${f3(0.06 * boost)}" filter="url(#nb-blur)"/>`;
      const s = slab(xH, yH0, w, h2, (r() - 0.5) * 0.14, 0.08, 0.9);
      out += s.path;
      out += `<line x1="${f1(s.tl[0])}" y1="${f1(s.tl[1])}" x2="${f1(s.tr[0])}" y2="${f1(s.tr[1])}" stroke="${c.ga}" stroke-width="1.6" opacity="0.5"/>`;
      const sy2 = yH0 - h2 * 0.48;
      out += `<path d="M${f1(xH - w * 0.36)} ${f1(sy2 + 6)}L${f1(xH - w * 0.1)} ${f1(sy2 - 8)}L${f1(xH + w * 0.14)} ${f1(sy2 + 3)}L${f1(xH + w * 0.34)} ${f1(sy2 - 4)}" stroke="${c.ga}" stroke-width="2.2" fill="none" opacity="0.62" stroke-linecap="round"/>`;
      out += `<path d="M${f1(xH - w * 0.16)} ${f1(yH0 - h2 * 0.2)}L${f1(xH + w * 0.08)} ${f1(yH0 - h2 * 0.26)}" stroke="${c.ga}" stroke-width="1.4" fill="none" opacity="0.4" stroke-linecap="round"/>`;
      out += `<circle cx="${f1(xH - w * 0.1)}" cy="${f1(sy2 - 8)}" r="2" fill="${c.c}" opacity="0.62"/>`;
      out += `<circle cx="${f1(xH + w * 0.14)}" cy="${f1(sy2 + 3)}" r="1.4" fill="${c.c}" opacity="0.5"/>`;
      out += `<line x1="${f1(xH - w * 0.66)}" y1="${f1(yH0 + 2.5)}" x2="${f1(xH + w * 0.66)}" y2="${f1(yH0 + 2.5)}" stroke="${c.ga}" stroke-width="2" opacity="0.28"/>`;
      for (let i = 0; i < 4; i++) {
        out += `<circle cx="${f1(xH + (r() - 0.5) * 140 + wl * 40)}" cy="${f1(yH0 - h2 - 16 - r() * 150)}" r="${f1(1.2 + r() * 1.2)}" fill="${c.ga}" opacity="${f3(0.35 + r() * 0.25)}"/>`;
      }
      out += wisp(xH - w * 0.15, yH0 - h2 - 6, 320 + r() * 130, wl * 130, (r() - 0.5) * 80, c.c, 0.12, 1.3);
      out += wisp(xH + w * 0.2, yH0 - h2 - 4, 260 + r() * 120, wl * 100, (r() - 0.5) * 60, INKS.silver, 0.08, 1.1);
    }

    // ---- 9 · the one cool glint in the cold zone (pages 8-9)
    {
      const yG0 = Math.min(H - 34, yNear(xG) + 72);
      const w = 104 + r() * 40, h2 = w * 0.36;
      out += `<circle cx="${f0(xG)}" cy="${f0(yG0 - h2 * 0.5)}" r="120" fill="${c.gb}" opacity="${f3(0.075 * boost)}" filter="url(#nb-blur)"/>`;
      const s = slab(xG, yG0, w, h2, (r() - 0.5) * 0.16, 0.09, 0.82);
      out += s.path;
      out += `<line x1="${f1(s.tl[0])}" y1="${f1(s.tl[1])}" x2="${f1(s.tr[0])}" y2="${f1(s.tr[1])}" stroke="${c.gb}" stroke-width="1.7" opacity="0.62"/>`;
      out += `<circle cx="${f1(xG + w * 0.12)}" cy="${f1(yG0 - h2 - 1)}" r="2" fill="${c.gb}" opacity="0.65"/>`;
      out += `<line x1="${f1(xG - w * 0.5)}" y1="${f1(yG0 + 2)}" x2="${f1(xG + w * 0.5)}" y2="${f1(yG0 + 2)}" stroke="${c.gb}" stroke-width="1.2" opacity="0.16"/>`;
    }

    // ---- 10 · last ember (page 10) — one dot on empty ground
    {
      const yE0 = yNear(xE) + 124;
      out += `<circle cx="${f0(xE)}" cy="${f0(yE0)}" r="95" fill="${c.ga}" opacity="${f3(0.075 * boost)}" filter="url(#nb-blur)"/>`;
      out += `<circle cx="${f0(xE)}" cy="${f0(yE0)}" r="10" fill="${c.ga}" opacity="0.22"/>`;
      out += `<circle cx="${f0(xE)}" cy="${f0(yE0)}" r="3"  fill="${c.ga}" opacity="0.72"/>`;
      out += wisp(xE, yE0 - 5, 160 + r() * 60, wind(xE) * 60, (r() - 0.5) * 40, INKS.silver, 0.07, 1);
    }

    // ================= v3.2 detail passes (appended — own rng channels,
    // the realized r() layout above is byte-identical to the shipped gen) ==

    // ---- 11 · high smoke haze — broad drift bands hanging over the hot
    //           zone (P1-P3), thinning by P5, gone after. Top band only
    //           (y<300): the text mid-band stays untouched. alpha<=0.035.
    {
      const rh = dRng(11);
      const centers = [0.62 + rh() * 0.5, 1.7 + rh() * 0.55, 2.7 + rh() * 0.55, 4.25 + rh() * 0.55];
      for (let bi = 0; bi < centers.length; bi++) {
        const hx = centers[bi] * W, hh = heat(hx);
        const op = Math.min(0.035, (0.03 + rh() * 0.008) * (0.35 + 0.65 * hh));
        const rx2 = 360 + rh() * 190, ry2 = 38 + rh() * 17;
        const hy = 120 + rh() * 110; // bottom edge <=284, never below y~300
        const ang = wind(hx) * 5;
        const hInk = rh() < 0.72 ? INKS.silver : INKS.navy;
        out += `<ellipse cx="${f0(hx)}" cy="${f0(hy)}" rx="${f0(rx2)}" ry="${f0(ry2)}" fill="${hInk}" opacity="${f3(op)}" transform="rotate(${f1(ang)} ${f0(hx)} ${f0(hy)})" filter="url(#nb-blur)"/>`;
        if (bi < 3) { // hot-zone bands get a trailing second lobe
          const ox = hx + (rh() - 0.5) * rx2 * 0.7, oy = hy + 14 + rh() * 18;
          out += `<ellipse cx="${f0(ox)}" cy="${f0(oy)}" rx="${f0(rx2 * 0.7)}" ry="${f0(ry2 * 0.8)}" fill="${INKS.silver}" opacity="${f3(op * 0.7)}" transform="rotate(${f1(ang)} ${f0(ox)} ${f0(oy)})" filter="url(#nb-blur)"/>`;
        }
      }
    }

    // ---- 12 · distant overhead-crane fall (P2, once) — the one structure
    //           bridging sky and horizon; platinum only, stops y~360, so it
    //           reads as chrome, never as a third landmark
    {
      const rc = dRng(23);
      const xC = (1.56 + rc() * 0.13) * W; // >=0.3W off the 1W and 2W cuts
      const gy = 112 + rc() * 16;
      out += `<line x1="${f0(xC - 0.42 * W)}" y1="${f0(gy)}" x2="${f0(xC + 0.42 * W)}" y2="${f0(gy)}" stroke="${INKS.platinum}" stroke-width="1" opacity="${f3(0.05 + rc() * 0.02)}"/>`;
      const yHk = 338 + rc() * 8;
      out += `<line x1="${f0(xC)}" y1="0" x2="${f0(xC)}" y2="${f0(yHk)}" stroke="${INKS.platinum}" stroke-width="1" opacity="${f3(0.1 + rc() * 0.03)}"/>`;
      out += `<line x1="${f1(xC - 3)}" y1="${f0(yHk)}" x2="${f1(xC - 3)}" y2="${f0(yHk + 8)}" stroke="${INKS.platinum}" stroke-width="1" opacity="0.14"/>`;
      out += `<line x1="${f1(xC + 3)}" y1="${f0(yHk)}" x2="${f1(xC + 3)}" y2="${f0(yHk + 8)}" stroke="${INKS.platinum}" stroke-width="1" opacity="0.14"/>`;
      out += `<circle cx="${f0(xC)}" cy="${f0(yHk + 8)}" r="4" fill="none" stroke="${INKS.platinum}" stroke-width="1" opacity="0.14"/>`;
    }

    // ---- 13 · billet/round-stock bundles — the second silhouette family a
    //           real yard holds. Side elevations at ~2.55/5.25/6.60W, one
    //           end-on 3+2 hex pack at ~1.40W (the steelyard signature).
    {
      const rb = dRng(37);
      const bundleSide = (bx, hot) => {
        const bw = 140 + rb() * 80, bh = 26 + rb() * 14;
        const by = yNear(bx) + 46 + rb() * 70, skw = (rb() - 0.5) * 6;
        out += `<path d="M${f1(bx - bw / 2)} ${f1(by)}L${f1(bx + bw / 2)} ${f1(by)}L${f1(bx + bw / 2 + skw)} ${f1(by - bh)}L${f1(bx - bw / 2 + skw)} ${f1(by - bh)}Z" fill="${INKS.coal}" opacity="${f3(0.65 + rb() * 0.15)}"/>`;
        const nL = 2 + (rb() < 0.5 ? 1 : 0); // rounds read via separators
        for (let i = 1; i <= nL; i++) {
          const tfr = i / (nL + 1), ly = by - bh * tfr + (rb() - 0.5) * 2;
          out += `<line x1="${f1(bx - bw / 2 + skw * tfr + 2)}" y1="${f1(ly)}" x2="${f1(bx + bw / 2 + skw * tfr - 2)}" y2="${f1(ly)}" stroke="${INKS.platinum}" stroke-width="1" opacity="${f3(0.06 + rb() * 0.04)}"/>`;
        }
        const eSafe = bx - bw > EDGE && bx + bw < SW - EDGE;
        if (hot) {
          if (eSafe) out += `<line x1="${f1(bx - bw / 2 + skw)}" y1="${f1(by - bh)}" x2="${f1(bx + bw / 2 + skw)}" y2="${f1(by - bh)}" stroke="${c.a}" stroke-width="1" opacity="${f3(0.14 + rb() * 0.04)}"/>`;
        } else {
          out += `<line x1="${f1(bx - bw / 2 + skw)}" y1="${f1(by - bh)}" x2="${f1(bx + bw / 2 + skw)}" y2="${f1(by - bh)}" stroke="${INKS.silver}" stroke-width="1" opacity="${f3(0.08 + rb() * 0.04)}"/>`;
        }
      };
      { // end-on hex pack, hot zone ~1.40W (>=0.15W off both cuts)
        const bx = (1.36 + rb() * 0.08) * W, rr2 = 9 + rb() * 3;
        const by = yNear(bx) + 55 + rb() * 50, cyB = by - rr2, cyT = by - rr2 - rr2 * 1.732;
        for (const ox of [-2 * rr2, 0, 2 * rr2]) out += `<circle cx="${f1(bx + ox)}" cy="${f1(cyB)}" r="${f1(rr2)}" fill="${INKS.coal}" fill-opacity="0.78" stroke="${INKS.platinum}" stroke-width="1" stroke-opacity="0.09"/>`;
        for (const ox of [-rr2, rr2]) out += `<circle cx="${f1(bx + ox)}" cy="${f1(cyT)}" r="${f1(rr2)}" fill="${INKS.coal}" fill-opacity="0.78" stroke="${INKS.platinum}" stroke-width="1" stroke-opacity="0.09"/>`;
        const eSafe = bx - 3 * rr2 > EDGE && bx + 3 * rr2 < SW - EDGE;
        if (eSafe) out += `<path d="M${f1(bx + rr2 - rr2 * 0.766)} ${f1(cyT - rr2 * 0.643)}A${f1(rr2)} ${f1(rr2)} 0 0 1 ${f1(bx + rr2 + rr2 * 0.766)} ${f1(cyT - rr2 * 0.643)}" fill="none" stroke="${c.a}" stroke-width="1.2" opacity="${f3(0.16 + rb() * 0.04)}"/>`;
      }
      bundleSide(Math.min((2.5 + rb() * 0.08) * W, xH - 0.65 * W), true); // hot, clear of the hero halo
      bundleSide((5.21 + rb() * 0.08) * W, false); // cooling — silver rims
      bundleSide((6.56 + rb() * 0.08) * W, false);
    }

    // ---- 14 · P9 rescue beat — transfer rails answer "where did the steel
    //           go?": a hairline pair riding yNear from 8.05W, fading out
    //           across the 9W cut by ~9.6W, with one waiting cold slab pair
    {
      const rr3 = dRng(53);
      const gap3 = 26 + rr3() * 8;
      const railFade = (x) => (x < 8.9 * W ? 1 : Math.max(0, 1 - (x - 8.9 * W) / (0.72 * W)));
      for (const off of [58, 58 + gap3]) {
        const x0r = 8.05 * W, x1r = 9.62 * W, segN = 10, segL = (x1r - x0r) / segN;
        for (let si = 0; si < segN; si++) {
          const sa = x0r + si * segL, sb = sa + segL;
          const op = 0.068 * railFade((sa + sb) / 2);
          if (op < 0.006) continue;
          let p = `M${f0(sa)} ${f1(yNear(sa) + off)}`;
          for (let px = sa + 45; px <= sb + 1; px += 45) { const qx = Math.min(px, sb); p += `L${f0(qx)} ${f1(yNear(qx) + off)}`; }
          out += `<path d="${p}" fill="none" stroke="${INKS.platinum}" stroke-width="1" opacity="${f3(op)}"/>`;
        }
      }
      // the waiting pair — placed at whichever of ~8.15/8.75W clears xG
      const cA = (8.13 + rr3() * 0.05) * W, cB = (8.72 + rr3() * 0.05) * W;
      let xR = Math.abs(cA - xG) >= Math.abs(cB - xG) ? cA : cB;
      if (Math.abs(xR - xG) < 0.35 * W) xR = Math.max(8.15 * W, Math.min(8.85 * W, xG + (xR > xG ? 0.35 : -0.35) * W));
      const yP = yNear(xR) + 58 + gap3 * 0.8;
      const wA = 96 + rr3() * 30, xA = xR - 34 - rr3() * 10;
      const sA = slab(xA, yP, wA, wA * (0.28 + rr3() * 0.06), (rr3() - 0.5) * 0.16, 0.08 + rr3() * 0.04, 0.75 + rr3() * 0.1);
      out += sA.path;
      out += `<line x1="${f1(sA.tl[0])}" y1="${f1(sA.tl[1])}" x2="${f1(sA.tr[0])}" y2="${f1(sA.tr[1])}" stroke="${INKS.silver}" stroke-width="1" opacity="${f3(0.1 + rr3() * 0.04)}"/>`;
      const mAy = yP - wA * 0.28 * 0.6, mAx = xA + (rr3() - 0.5) * wA * 0.25, mAg = 4 + rr3() * 2; // identity ticks
      out += `<line x1="${f1(mAx)}" y1="${f1(mAy)}" x2="${f1(mAx + 1)}" y2="${f1(mAy + 9)}" stroke="${INKS.platinum}" stroke-width="1" opacity="0.11"/>`;
      out += `<line x1="${f1(mAx + mAg)}" y1="${f1(mAy)}" x2="${f1(mAx + mAg + 1)}" y2="${f1(mAy + 9)}" stroke="${INKS.platinum}" stroke-width="1" opacity="0.11"/>`;
      const wB = 84 + rr3() * 24, xB = xR + 42 + rr3() * 10;
      const sB = slab(xB, yP + 4, wB, wB * (0.3 + rr3() * 0.05), (rr3() - 0.5) * 0.16, 0.09, 0.75 + rr3() * 0.1);
      out += sB.path;
      out += `<line x1="${f1(sB.tl[0])}" y1="${f1(sB.tl[1])}" x2="${f1(sB.tr[0])}" y2="${f1(sB.tr[1])}" stroke="${INKS.silver}" stroke-width="1" opacity="${f3(0.1 + rr3() * 0.04)}"/>`;
      const lugX = sB.tl[0] + (0.14 + rr3() * 0.04) * (sB.tr[0] - sB.tl[0]); // lug notch
      out += `<rect x="${f1(lugX - 3)}" y="${f1(sB.tl[1] - 0.8)}" width="6" height="4.8" fill="${INKS.coal}" opacity="0.92"/>`;
      out += `<line x1="${f1(lugX + 3)}" y1="${f1(sB.tl[1])}" x2="${f1(lugX + 3)}" y2="${f1(sB.tl[1] + 4)}" stroke="${INKS.platinum}" stroke-width="1" opacity="0.08"/>`;
      for (let i = 0, nF = 2 + (rr3() < 0.5 ? 1 : 0); i < nF; i++) { // mill-scale flecks
        const fxk = xR + (rr3() - 0.5) * 280, fyk = yNear(fxk) + 70 + rr3() * 80;
        out += `<circle cx="${f0(fxk)}" cy="${f0(fyk)}" r="${f1(1 + rr3() * 0.5)}" fill="${INKS.platinum}" opacity="0.08"/>`;
      }
    }

    // ---- 15 · emptied-yard micro-marks (P10) — a floor that recently held
    //           steel: dead-ember dots + one cold spilled runner, all
    //           neutral ink, all >=250px clear of the last-ember landmark
    {
      const rm = dRng(71);
      let placed = 0, guard = 0;
      while (placed < 3 && guard++ < 40) {
        const mx = (9.16 + rm() * 0.7) * W;
        if (Math.abs(mx - xE) < 250) continue;
        const my = yNear(mx) + 60 + rm() * 120;
        out += `<circle cx="${f0(mx)}" cy="${f0(my)}" r="${f1(1 + rm() * 0.5)}" fill="${INKS.platinum}" opacity="${f3(0.07 + rm() * 0.02)}"/>`;
        placed++;
      }
      let rx0 = 0; guard = 0;
      while (guard++ < 40) { const t = (9.14 + rm() * 0.6) * W; if (Math.abs(t - xE) >= 360) { rx0 = t; break; } }
      if (rx0) {
        const ry0 = yNear(rx0) + 70 + rm() * 90, rl = 60 + rm() * 50;
        out += `<line x1="${f0(rx0)}" y1="${f1(ry0)}" x2="${f0(rx0 + Math.sign(xE - rx0) * rl)}" y2="${f1(ry0 + (rm() - 0.5) * 14)}" stroke="${INKS.platinum}" stroke-width="1" opacity="${f3(0.05 + rm() * 0.01)}"/>`;
      }
    }

    return out;
  },
};
})();

STYLE_DEFS["flowpath"] = (function () {
const PAGES = NATIVE_PAGES;
void PAGES;
// flowpath · "schematic route" · cat: blend
// One giant system schematic travelling left -> right: soft-cornered node
// plates (whisper outlines over near-black panel fills), orthogonal bus
// lines that jog around each other, via dots at elbows, port ticks on node
// edges, packet dashes riding the accent buses. Hue lives in the two accent
// buses (hot path = HUES.a, return = HUES.b) + anchored ga/gb glows; all
// structure is neutral ink. No text, nothing periodic, everything crosses
// frame boundaries mid-feature.
//
// PAGE MAP (10800 x 1350 · frame boundaries at k*1080):
//  p1-2   SOURCE — big node N0 (~x370-1010) + companion N1 (~x1400-1780 up
//         high). Hot(a) + return(b) enter from x=0 as GRAY handoff spans,
//         pick up hue at a via x=210 (rule 6: no hue within 60px of either
//         strip edge), thread N0; three gray support buses fan out of N0's
//         right edge into spread lanes.
//  p3-4   OPEN ROUTING — long runs and lazy jogs. One low node N2 (~x3450+),
//         hot dips through it, return lifts over it; one gray bus dies at a
//         stub (~page 3.0), a fresh one appears from a via (~page 4.1).
//  p5-6   INTERCHANGE (the landmark, exactly once) — trio L1 (up) / L2
//         (low) / L3 (mid), centers 5650-6230 (>=240px off every boundary).
//         Hot threads L1 then L3; return + a gray thread L2; a vertical
//         rung couples L3 to L2. Two glows flank it top/bottom.
//  p7-8   CONVERGENCE — gray buses end one by one (stub ~x7.2, N6 ~x7.8,
//         N7 ~x8.7, stubs ~x8.5/x8.9); by x~9000 only the accents remain.
//  p9-10  TERMINAL — large double-walled node NT (~x9200-9810, crossing the
//         p9/p10 seam mid-feature); hot enters its upper port, return its
//         lower port, and the two accent buses exit with one last lazy jog
//         each, dropping hue at a via x=SW-210 and running out to x=10800
//         as gray handoff spans. Quiet, breathing tail.
//
// v3.2 MICRO-ANATOMY pass (independent rj/rd RNG channels — the original r()
// stream is byte-identical, so all v3.1 geometry incl. the landmark holds):
// silkscreen refdes dash-clusters + pin-1 dots on the 7 major plates; SOIC
// pin rows + inner pad dashes on N0/L1/L2/L3/NT edges; size-jittered vias
// everywhere with ~1-in-5 drawn as open annular rings; guard-via fences
// beside the p3 return run and the p7-8 hot run; one length-matching
// serpentine on g1's top lane (p3); test points hung off the g2/g7 debug
// stubs; exactly 4 fiducials (local pair flanking the interchange, globals
// p2 + p10); dashed courtyard outlines around N2/N6; ground-pour hatch
// fragments anchoring N0/L2/NT; a stitching-via field in p7's lower-left
// dead zone. Plate presence lifted (edge +0.04, panel fill 0.35, NT outer
// wall o*0.62); return(b) bus differentiated from hot(a) by line STYLE —
// hollow annular elbows, 12-18px packet dashes, 1.6 stroke (hot: filled
// dots, 24-50px dashes, 1.8). All additions are neutral platinum/silver at
// <=0.22 opacity, in top/bottom quarters or hugging existing plates/buses.
// (helpers provided by the registry's shared toolkit)
return {
  key: 'flowpath',
  name: 'schematic route',
  cat: 'blend',
  desc: 'orthogonal bus routes threading node plates: source fan-out to lone terminal exit',
  gen(seed, hue) {
    const c = HUES[hue], SW = PAGES * W;
    const r = mulberry32(seed + 29);
    // v3.2 detail channels — INDEPENDENT of r(): never re-jitters v3.1 geometry
    const rj = mulberry32((seed ^ 0xE7A0) + 1); // via/tick size jitter inside draw helpers
    const rd = mulberry32((seed ^ 0xE7A0) + 2); // appended silkscreen/copper detail pass
    const boost = glowAlphaBoost(hue);
    const nzY = valueNoise1D(seed + 401); // accent-bus drift
    const nzB = valueNoise1D(seed + 907); // ghost-bus wander
    const nzG = valueNoise1D(seed + 613); // dash-trace altitude
    const F = (v) => v.toFixed(1);
    const clampY = (y) => Math.max(170, Math.min(1190, y));
    // keep any elbow / edge from landing ON a frame boundary (never aligned)
    const nud = (x) => {
      const m = ((x % W) + W) % W;
      if (m < 16) return x + (18 - m);
      if (m > W - 16) return x - (m - (W - 18));
      return x;
    };

    let glowL = '', bgL = '', nodeL = '', grayL = '', accL = '', dotL = '';

    // jittered via (item 3): mixed radii, ~1-in-5 untented (open annulus).
    // rj channel only — call order is deterministic, r() stream untouched.
    const via = (x, y, op) => {
      const rr = 1.8 + rj() * 1.8;
      return rj() < 0.2
        ? `<circle cx="${F(x)}" cy="${F(y)}" r="${F(rr + 0.5)}" fill="none" stroke="${INKS.silver}" stroke-width="1" opacity="${op}"/>`
        : `<circle cx="${F(x)}" cy="${F(y)}" r="${F(rr)}" fill="${INKS.silver}" opacity="${op}"/>`;
    };

    // ---------- nodes ----------
    const mkNode = (cx, cy, w, h) => {
      const x1 = nud(cx - w / 2), x2 = nud(cx + w / 2);
      return { cx: (x1 + x2) / 2, cy, x1, x2, w: x2 - x1, h, y1: cy - h / 2, y2: cy + h / 2, rx: 16 + r() * 24 };
    };
    const port = (n, t) => n.y1 + t * n.h;

    const N0 = mkNode(660 + r() * 150, 615 + r() * 80, 570 + r() * 120, 520 + r() * 90);   // source
    const N1 = mkNode(1520 + r() * 200, 275 + r() * 60, 330 + r() * 80, 300 + r() * 55);   // companion, high
    const N2 = mkNode(3500 + r() * 300, 955 + r() * 80, 390 + r() * 80, 330 + r() * 60);   // open stretch, low
    const L1 = mkNode(5650 + r() * 80, 435 + r() * 55, 360 + r() * 55, 320 + r() * 45);    // landmark trio
    const L2 = mkNode(5950 + r() * 70, 990 + r() * 45, 400 + r() * 60, 300 + r() * 50);
    const L3 = mkNode(6170 + r() * 55, 605 + r() * 40, 330 + r() * 45, 280 + r() * 40);
    const N6 = mkNode(7840 + r() * 220, 525 + r() * 75, 360 + r() * 75, 330 + r() * 55);   // convergence
    const N7 = mkNode(8730 + r() * 150, 1035 + r() * 55, 300 + r() * 55, 270 + r() * 45);  // small, low
    const NT = mkNode(9420 + r() * 130, 670 + r() * 70, 580 + r() * 100, 480 + r() * 75);  // terminal

    const drawNode = (n, opts) => {
      opts = opts || {};
      // item 10: presence lift — edge hairline +0.04, panel fill 0.32->0.35
      const o = (opts.op || (0.12 + r() * 0.05)) + 0.04;
      if (opts.double) {
        nodeL += `<rect x="${F(n.x1 - 13)}" y="${F(n.y1 - 13)}" width="${F(n.w + 26)}" height="${F(n.h + 26)}" rx="${F(n.rx + 9)}" fill="none" stroke="${INKS.platinum}" stroke-width="1" opacity="${(o * 0.62).toFixed(3)}"/>`;
      }
      nodeL += `<rect x="${F(n.x1)}" y="${F(n.y1)}" width="${F(n.w)}" height="${F(n.h)}" rx="${F(n.rx)}" fill="${INKS.navy}" fill-opacity="0.35" stroke="${INKS.platinum}" stroke-opacity="${o.toFixed(3)}" stroke-width="1.5"/>`;
      if (opts.inset !== false && r() < 0.78) {
        const ins = 22 + r() * 22;
        nodeL += `<rect x="${F(n.x1 + ins)}" y="${F(n.y1 + ins)}" width="${F(n.w - 2 * ins)}" height="${F(n.h - 2 * ins)}" rx="${F(Math.max(6, n.rx - 8))}" fill="none" stroke="${INKS.silver}" stroke-width="1" opacity="${(o * 0.5).toFixed(3)}"/>`;
      }
      // port ticks, left + right edges, jittered (never metered); size/width
      // jitter from rj (item 3), y positions recorded for the pin-row pass
      n.tickYs = { l: [], r: [] };
      for (const side of [n.x1, n.x2]) {
        const cnt = 2 + Math.floor(r() * 3);
        const dir = side === n.x1 ? -1 : 1;
        for (let i = 0; i < cnt; i++) {
          const ty = n.y1 + (0.12 + r() * 0.76) * n.h;
          n.tickYs[dir === -1 ? 'l' : 'r'].push(ty);
          nodeL += `<line x1="${F(side)}" y1="${F(ty)}" x2="${F(side + dir * (9 + r() * 6))}" y2="${F(ty)}" stroke="${INKS.silver}" stroke-width="${(1 + rj() * 0.5).toFixed(2)}" opacity="${(0.16 + rj() * 0.06).toFixed(3)}"/>`;
        }
      }
      if (opts.topTicks) {
        const cnt = 2 + Math.floor(r() * 2);
        for (let i = 0; i < cnt; i++) {
          const tx = n.x1 + (0.15 + r() * 0.7) * n.w;
          nodeL += `<line x1="${F(tx)}" y1="${F(n.y1)}" x2="${F(tx)}" y2="${F(n.y1 - 9 - r() * 6)}" stroke="${INKS.silver}" stroke-width="${(1 + rj() * 0.5).toFixed(2)}" opacity="${(0.16 + rj() * 0.06).toFixed(3)}"/>`;
        }
      }
      if (opts.seam) { // lit hairline along part of one horizontal edge
        const sx = n.x1 + n.w * (0.08 + r() * 0.45);
        const sl = n.w * (0.22 + r() * 0.3);
        const sy = opts.seam.edge === 'top' ? n.y1 : n.y2;
        nodeL += `<line x1="${F(sx)}" y1="${F(sy)}" x2="${F(Math.min(sx + sl, n.x2 - 14))}" y2="${F(sy)}" stroke="${opts.seam.col}" stroke-width="1.6" opacity="${(0.32 + r() * 0.12).toFixed(3)}"/>`;
      }
    };

    // ---------- bus machinery ----------
    // steps: [{x,y}] = "by x=X be at y=Y" -> horizontal run then vertical jog
    const bus = (x0, y0, steps) => {
      let d = `M ${F(x0)} ${F(y0)}`, py = y0, px = x0;
      const el = [], runs = [];
      for (const s of steps) {
        const x = nud(s.x);
        d += ` L ${F(x)} ${F(py)}`;
        if (x - px > 2) runs.push({ x1: px, x2: x, y: py });
        px = x;
        if (Math.abs(s.y - py) > 0.5) {
          d += ` L ${F(x)} ${F(s.y)}`;
          el.push({ x, y: py }, { x, y: s.y });
          py = s.y;
        }
      }
      return { d, el, runs, x: px, y: py };
    };
    // drift from y0 at xa toward y1 at xb with noise offsets — routes flow
    // toward their destination instead of teleporting around
    const wander = (xa, xb, y0, y1, lane) => {
      const steps = [], dist = xb - xa;
      const n = Math.max(1, Math.round(dist / (W * (1.25 + r() * 0.9))));
      let x = xa + (0.24 + r() * 0.3) * (dist / (n + 0.6));
      for (let i = 0; i < n && x < xb - 260; i++) {
        const t = (x - xa) / dist;
        steps.push({ x, y: clampY(y0 + (y1 - y0) * t + (nzY(x / 910 + lane * 37.7) - 0.5) * 360) });
        x += (0.55 + r() * 0.85) * (dist / (n + 0.6));
      }
      steps.push({ x: xb, y: y1 });
      return steps;
    };
    const drawGray = (x0, y0, steps, opts) => {
      opts = opts || {};
      const b = bus(x0, y0, steps);
      grayL += `<path d="${b.d}" fill="none" stroke="${INKS.platinum}" stroke-width="1.4" opacity="${(opts.op || 0.16).toFixed(3)}" stroke-linejoin="round"/>`;
      for (const e of b.el) if (r() < 0.8) dotL += via(e.x, e.y, '0.24');
      if (opts.origin) dotL += `<circle cx="${F(x0)}" cy="${F(y0)}" r="3.4" fill="${INKS.silver}" opacity="0.32"/>`;
      if (opts.stub) {
        dotL += via(b.x, b.y, '0.32')
          + `<line x1="${F(b.x)}" y1="${F(b.y - 9)}" x2="${F(b.x)}" y2="${F(b.y + 9)}" stroke="${INKS.silver}" stroke-width="1.2" opacity="0.28"/>`;
      }
      return b;
    };
    // rule 6 — hue never inside the 60px strip-edge exclusion zones. Each
    // accent bus hands off to neutral gray outside [xIn..xOut]: the outer
    // spans render in the gray-bus style (no glow underlay, no packet
    // dashes, no colored elbows), and one colored via at each handoff keeps
    // the hue reading as entering/exiting. The three spans are SEPARATE
    // bus() segments so packet-dash runs recompute inside the colored span
    // only (a dash on a full-polyline exit run could reach past SW-60).
    // item 11: `ret` differentiates the return bus from hot by line STYLE
    // (hollow annular elbows, 12-18px packet dashes, 1.6 stroke) — same hue,
    // same route, zero luminance cost.
    const EDGE_SAFE = 210;
    const drawAcc = (x0, y0, steps, col, glowCol, ret) => {
      const xIn = nud(EDGE_SAFE), xOut = nud(SW - EDGE_SAFE);
      const pre = [], mid = [], post = [];
      let yIn = y0;
      for (const s of steps) {
        const x = nud(s.x);
        if (x <= xIn) { pre.push(s); yIn = s.y; }
        else if (x <= xOut) mid.push(s);
        else post.push(s);
      }
      const yOut = mid.length ? mid[mid.length - 1].y : yIn;
      const graySpan = (gx0, gy0, gsteps) => {
        const gb = bus(gx0, gy0, gsteps);
        grayL += `<path d="${gb.d}" fill="none" stroke="${INKS.platinum}" stroke-width="1.4" opacity="0.16" stroke-linejoin="round"/>`;
        for (const e of gb.el) dotL += via(e.x, e.y, '0.24');
      };
      pre.push({ x: xIn, y: yIn });
      graySpan(x0, y0, pre);
      graySpan(xOut, yOut, post);
      dotL += `<circle cx="${F(xIn)}" cy="${F(yIn)}" r="3" fill="${col}" opacity="0.55"/>`
        + `<circle cx="${F(xOut)}" cy="${F(yOut)}" r="3" fill="${col}" opacity="0.55"/>`;
      mid.push({ x: xOut, y: yOut });
      const b = bus(xIn, yIn, mid);
      accL += `<path d="${b.d}" fill="none" stroke="${glowCol}" stroke-width="7" opacity="${(0.09 * boost).toFixed(3)}" stroke-linejoin="round" stroke-linecap="round"/>`
        + `<path d="${b.d}" fill="none" stroke="${col}" stroke-width="${ret ? 1.6 : 1.8}" opacity="0.5" stroke-linejoin="round"/>`;
      for (const e of b.el) {
        const rr = 1.8 + rj() * 1.8; // item 3: jittered via radii
        dotL += ret
          ? `<circle cx="${F(e.x)}" cy="${F(e.y)}" r="${F(Math.max(2.2, rr))}" fill="none" stroke="${col}" stroke-width="1.4" opacity="0.5"/>`
          : `<circle cx="${F(e.x)}" cy="${F(e.y)}" r="${F(rr)}" fill="${col}" opacity="0.55"/>`;
      }
      // packet dashes riding long runs + occasional gray tap-spurs
      for (const run of b.runs) {
        const len = run.x2 - run.x1;
        if (len < 480) continue;
        if (r() < 0.6) {
          const px = run.x1 + (0.12 + r() * 0.72) * len;
          const pt = r(); // one draw either way — r() stream unchanged
          const pl = ret ? 12 + pt * 6 : 24 + pt * 26;
          accL += `<line x1="${F(px)}" y1="${F(run.y)}" x2="${F(px + pl)}" y2="${F(run.y)}" stroke="${col}" stroke-width="3" opacity="0.6" stroke-linecap="round"/>`;
        }
        if (len > 700 && r() < 0.4) {
          const sx = nud(run.x1 + (0.2 + r() * 0.6) * len);
          const sd = (run.y > 680 ? -1 : 1) * (56 + r() * 90);
          const sy = clampY(run.y + sd);
          grayL += `<line x1="${F(sx)}" y1="${F(run.y)}" x2="${F(sx)}" y2="${F(sy)}" stroke="${INKS.platinum}" stroke-width="1.2" opacity="0.14"/>`;
          dotL += via(sx, sy, '0.26');
        }
      }
      return b;
    };
    const portDot = (x, y, col) => {
      dotL += `<circle cx="${F(x)}" cy="${F(y)}" r="${F(1.8 + rj() * 1.8)}" fill="${col}" opacity="0.55"/>`;
    };

    // ---------- depth layer: ghost schematic far behind ----------
    for (let g = 0; g < 3; g++) {
      const xs = schedule(r, SW, 0.8, 1.9);
      const steps = xs.map((x) => ({ x, y: clampY(180 + nzB(x / 1450 + g * 51.3) * 990) }));
      steps.push({ x: SW + 6, y: steps.length ? steps[steps.length - 1].y : 380 + g * 300 });
      const y0 = clampY(180 + nzB(-0.4 + g * 51.3) * 990);
      const b = bus(-6, y0, steps);
      bgL += `<path d="${b.d}" fill="none" stroke="${INKS.platinum}" stroke-width="1" opacity="0.05" stroke-linejoin="round"/>`;
    }
    const ghosts = [
      mkNode(2560 + r() * 240, 370 + r() * 90, 540 + r() * 120, 420 + r() * 90),
      mkNode(4800 + r() * 220, 1050 + r() * 70, 500 + r() * 120, 380 + r() * 80),
      mkNode(7150 + r() * 240, 880 + r() * 80, 560 + r() * 120, 400 + r() * 80),
    ];
    for (const gn of ghosts) {
      bgL += `<rect x="${F(gn.x1)}" y="${F(gn.y1)}" width="${F(gn.w)}" height="${F(gn.h)}" rx="${F(gn.rx + 8)}" fill="${INKS.navy}" fill-opacity="0.18" stroke="${INKS.silver}" stroke-opacity="0.06" stroke-width="1"/>`;
    }
    // faint dashed trace fragments — quiet texture everywhere
    for (const x of schedule(r, SW, 0.4, 1.1)) {
      const len = 170 + r() * 260;
      const y = clampY(195 + nzG(x / 700) * 970);
      bgL += `<line x1="${F(x)}" y1="${F(y)}" x2="${F(Math.min(x + len, SW - 30))}" y2="${F(y)}" stroke="${INKS.platinum}" stroke-width="1" opacity="${(0.05 + r() * 0.04).toFixed(3)}" stroke-dasharray="2 10"/>`;
    }
    // sparse via stitch clusters, anchored high or low
    for (const x of schedule(r, SW, 1.2, 2.6)) {
      const cnt = 3 + Math.floor(r() * 3);
      const yc = r() < 0.5 ? 175 + r() * 120 : 1090 + r() * 130;
      let vx = x, vy = yc;
      for (let i = 0; i < cnt; i++) {
        dotL += via(vx, vy, (0.13 + r() * 0.07).toFixed(3));
        vx += 10 + r() * 12; vy += (r() - 0.5) * 22;
      }
    }

    // ---------- glows (anchored top/bottom quarters, landmark brightest) ----------
    const glow = (x, y, rad, col, op) => {
      glowL += `<circle cx="${F(x)}" cy="${F(y)}" r="${F(rad)}" fill="${col}" opacity="${(op * boost).toFixed(3)}" filter="url(#nb-blur)"/>`;
    };
    glow(N0.cx + 60 + r() * 90, 150 + r() * 60, 250, c.ga, 0.075);
    glow(N1.cx + 120 + r() * 120, 1190 + r() * 40, 230, c.gb, 0.06);
    glow(3860 + r() * 300, 1205 + r() * 40, 235, c.ga, 0.05);
    glow(L1.cx - 90 + r() * 80, 145 + r() * 50, 250, c.gb, 0.08);
    glow(L2.cx + 40 + r() * 90, 1205 + r() * 40, 290, c.ga, 0.09);
    glow(7260 + r() * 160, 1225 + r() * 30, 205, c.ga, 0.045);
    glow(8150 + r() * 250, 140 + r() * 60, 200, c.gb, 0.05);
    glow(NT.cx - 60 + r() * 90, 1195 + r() * 40, 260, c.gb, 0.075);
    glow(10120 + r() * 160, 195 + r() * 70, 190, c.ga, 0.055); // core+blur stays left of SW-60 at any seed

    // ---------- draw nodes ----------
    drawNode(N0, { op: 0.14 + r() * 0.03, seam: { edge: 'top', col: c.a } });
    drawNode(N1, {});
    drawNode(N2, {});
    drawNode(L1, { op: 0.15 + r() * 0.03, topTicks: true, seam: { edge: 'top', col: c.b } });
    drawNode(L2, { op: 0.15 + r() * 0.03, seam: { edge: 'bottom', col: c.a } });
    drawNode(L3, { op: 0.14 + r() * 0.03, topTicks: true });
    drawNode(N6, {});
    drawNode(N7, {});
    drawNode(NT, { op: 0.14 + r() * 0.03, double: true, inset: false, seam: { edge: 'bottom', col: c.b } });
    // rare pale highlights: two tiny status dots on landmark + terminal
    dotL += `<circle cx="${F(L3.x1 + L3.w * (0.2 + r() * 0.5))}" cy="${F(L3.y1)}" r="2.2" fill="${c.c}" opacity="0.5"/>`;
    dotL += `<circle cx="${F(NT.x2)}" cy="${F(NT.y1 + NT.h * (0.2 + r() * 0.3))}" r="2.2" fill="${c.c}" opacity="0.5"/>`;

    // ---------- gray support buses ----------
    // fan-out trio from N0's right edge
    const f1 = port(N0, 0.09 + r() * 0.06), f2 = port(N0, 0.5 + r() * 0.06), f3 = port(N0, 0.86 + r() * 0.06);
    // g1: top lane, all the way to landmark L1
    const g1b = drawGray(N0.x2, f1, [
      { x: N0.x2 + 130 + r() * 180, y: 210 + r() * 70 },
      { x: 2850 + r() * 260, y: 255 + r() * 70 },
      { x: L1.x1 - (120 + r() * 80), y: port(L1, 0.16 + r() * 0.14) },
      { x: L1.x1, y: port(L1, 0.16) },
    ], { op: 0.17 });
    // g2: mid lane, dies at a stub around page 3.0
    const g2b = drawGray(N0.x2, f2, [
      { x: N0.x2 + 210 + r() * 200, y: 745 + r() * 70 },
      { x: 2330 + r() * 200, y: 690 + r() * 60 },
      { x: 2990 + r() * 220, y: 690 },
    ], { op: 0.14, stub: true });
    // g3: low lane, long haul into N6's lower port
    drawGray(N0.x2, f3, [
      { x: N0.x2 + 150 + r() * 160, y: 1150 + r() * 55 },
      { x: 4130 + r() * 250, y: 1205 + r() * 35 },
      { x: N6.x1 - (150 + r() * 100), y: port(N6, 0.72 + r() * 0.1) },
      { x: N6.x1, y: port(N6, 0.75) },
    ], { op: 0.16 });
    // g4: appears from a via on page ~4.1, threads L3, dies before N6
    const g4y = 295 + r() * 80, g4x = 4380 + r() * 240;
    const pL3g = port(L3, 0.3 + r() * 0.3);
    drawGray(g4x, g4y, [
      { x: g4x + 260 + r() * 220, y: pL3g },
      { x: L3.x2 + 30, y: pL3g },
      { x: 6760 + r() * 180, y: 430 + r() * 70 },
      { x: 7160 + r() * 200, y: 430 },
    ], { op: 0.15, origin: true, stub: true });
    // g5: appears low on page ~4.8, threads L2, merges into N7
    const g5x = 5060 + r() * 160, g5y = 1200 + r() * 40;
    const pL2g = port(L2, 0.62 + r() * 0.2);
    drawGray(g5x, g5y, [
      { x: L2.x1 - (70 + r() * 60), y: pL2g },
      { x: L2.x2 + 40, y: pL2g },
      { x: 6620 + r() * 160, y: port(N7, 0.3 + r() * 0.3) },
      { x: N7.x1, y: port(N7, 0.35) },
    ], { op: 0.15, origin: true });
    // g6: interchange rung — vertical coupler between L3 bottom and L2 top
    {
      const rxx = nud(Math.max(L2.x1 + 30, Math.min(L2.x2 - 30, 6030 + r() * 110)));
      const rx2 = nud(rxx - (24 + r() * 34));
      const my = (L3.y2 + L2.y1) / 2 + (r() - 0.5) * 14;
      grayL += `<path d="M ${F(rxx)} ${F(L3.y2 + 2)} L ${F(rxx)} ${F(my)} L ${F(rx2)} ${F(my)} L ${F(rx2)} ${F(L2.y1 - 2)}" fill="none" stroke="${INKS.platinum}" stroke-width="1.4" opacity="0.18" stroke-linejoin="round"/>`;
      dotL += via(rxx, my, '0.26') + via(rx2, my, '0.26');
    }
    // g7: leaves L3, wanders, dies at a stub around page 7.9
    const pL3o = port(L3, 0.55 + r() * 0.2);
    const g7b = drawGray(L3.x2, pL3o, [
      { x: L3.x2 + 180 + r() * 140, y: 720 + r() * 90 },
      { x: 7690 + r() * 240, y: 845 + r() * 70 },
      { x: 8430 + r() * 230, y: 845 },
    ], { op: 0.14, stub: true });
    // g8: leaves N6 high, last gray to die (page ~8.3)
    const pN6o = port(N6, 0.25 + r() * 0.15);
    drawGray(N6.x2, pN6o, [
      { x: N6.x2 + 200 + r() * 180, y: 265 + r() * 60 },
      { x: 8880 + r() * 130, y: 265 },
    ], { op: 0.14, stub: true });

    // ---------- accent buses: hot path (a) + return (b), full width ----------
    // hot: N0 -> N2 -> L1 -> L3 -> N6 -> NT -> exit
    const hp0 = port(N0, 0.3 + r() * 0.14);
    const hpN2 = port(N2, 0.3 + r() * 0.4);
    const hpL1 = port(L1, 0.34 + r() * 0.34);
    const hpL3 = port(L3, 0.3 + r() * 0.4);
    const hpN6 = port(N6, 0.3 + r() * 0.35);
    const hpNT = port(NT, 0.26 + r() * 0.22);
    const hotSteps = [{ x: 170 + r() * 300, y: hp0 }, { x: N0.x2 + 60, y: hp0 }];
    hotSteps.push(...wander(N0.x2 + 60, N2.x1 - (260 + r() * 160), hp0, hpN2, 1));
    hotSteps.push({ x: N2.x2 + 50, y: hpN2 });
    hotSteps.push(...wander(N2.x2 + 50, L1.x1 - (60 + r() * 110), hpN2, hpL1, 1));
    hotSteps.push({ x: (L1.x2 + L3.x1) / 2, y: hpL3 }); // tight interchange hop
    hotSteps.push({ x: L3.x2 + 45, y: hpL3 });
    hotSteps.push(...wander(L3.x2 + 140, N6.x1 - (70 + r() * 130), hpL3, hpN6, 1));
    hotSteps.push({ x: N6.x2 + 50, y: hpN6 });
    hotSteps.push(...wander(N6.x2 + 50, NT.x1 - (80 + r() * 140), hpN6, hpNT, 1));
    hotSteps.push({ x: NT.x2 + 60, y: hpNT });
    const hotOut = clampY(hpNT + (r() - 0.5) * 320);
    hotSteps.push({ x: 10090 + r() * 280, y: hotOut });
    hotSteps.push({ x: SW + 6, y: hotOut });
    const hotIn = clampY(hp0 + (r() - 0.5) * 340);
    const hotB = drawAcc(-6, hotIn, hotSteps, c.a, c.ga);
    for (const [n, p] of [[N0, hp0], [N2, hpN2], [L1, hpL1], [L3, hpL3], [N6, hpN6], [NT, hpNT]]) {
      portDot(n.x1, p, c.a); portDot(n.x2, p, c.a);
    }

    // return: N0 -> N1 -> around N2 -> L2 -> low run -> N7 -> NT -> exit
    const rp0 = port(N0, 0.64 + r() * 0.14);
    const rpN1 = port(N1, 0.35 + r() * 0.3);
    const byN2 = N2.y1 - (52 + r() * 66);
    const rpL2 = port(L2, 0.28 + r() * 0.3);
    const rpN7 = port(N7, 0.4 + r() * 0.3);
    const rpNT = port(NT, 0.66 + r() * 0.14);
    const retSteps = [{ x: 250 + r() * 330, y: rp0 }, { x: N0.x2 + 40, y: rp0 }];
    retSteps.push({ x: N0.x2 + 160 + r() * 200, y: rpN1 });
    retSteps.push({ x: N1.x2 + 50, y: rpN1 });
    retSteps.push(...wander(N1.x2 + 50, N2.x1 - (60 + r() * 80), rpN1, byN2, 2));
    retSteps.push({ x: N2.x2 + (70 + r() * 90), y: byN2 });
    retSteps.push(...wander(N2.x2 + 240, L2.x1 - (70 + r() * 100), byN2, rpL2, 2));
    retSteps.push({ x: L2.x2 + 40, y: rpL2 });
    retSteps.push({ x: L2.x2 + 130 + r() * 160, y: 1150 + r() * 55 });
    retSteps.push(...wander(L2.x2 + 320, N7.x1 - (60 + r() * 90), 1170, rpN7, 2));
    retSteps.push({ x: N7.x2 + 40, y: rpN7 });
    retSteps.push(...wander(N7.x2 + 40, NT.x1 - (70 + r() * 110), rpN7, rpNT, 2));
    retSteps.push({ x: NT.x2 + 40, y: rpNT });
    const retOut = clampY(rpNT + 90 + r() * 160);
    retSteps.push({ x: 10250 + r() * 260, y: retOut });
    retSteps.push({ x: SW + 6, y: retOut });
    const retIn = clampY(rp0 + (r() - 0.5) * 300);
    const retB = drawAcc(-6, retIn, retSteps, c.b, c.gb, true);
    for (const [n, p] of [[N0, rp0], [N1, rpN1], [L2, rpL2], [N7, rpN7], [NT, rpNT]]) {
      portDot(n.x1, p, c.b); portDot(n.x2, p, c.b);
    }

    // ---------- v3.2 micro-anatomy pass (rd channel only, appended) ----------
    // item 1 · silkscreen refdes dash-clusters + pin-1 dots on major plates
    for (const n of [N0, N1, L1, L2, L3, N6, NT]) {
      const by = n.y1 - (18 + rd() * 12);
      let dx = nud(n.x1 + 4 + rd() * 10);
      const cnt = 2 + Math.floor(rd() * 3);
      for (let i = 0; i < cnt; i++) {
        const dl = 8 + rd() * 12, dy = by + (rd() - 0.5) * 6;
        nodeL += `<line x1="${F(dx)}" y1="${F(dy)}" x2="${F(dx + dl)}" y2="${F(dy)}" stroke="${INKS.silver}" stroke-width="1" opacity="${(0.1 + rd() * 0.04).toFixed(3)}"/>`;
        dx += dl + 5 + rd() * 9;
      }
      dotL += `<circle cx="${F(n.x1 + 16 + rd() * 8)}" cy="${F(n.y1 + 16 + rd() * 8)}" r="${F(2.5 + rd())}" fill="${INKS.silver}" opacity="${(0.16 + rd() * 0.04).toFixed(3)}"/>`;
    }
    // item 2 · SOIC pin rows: densify edge ticks to 5-8 (jittered pitch) and
    // pair EVERY tick with an inner pad-dash (the copper land pattern)
    for (const n of [N0, L1, L2, L3, NT]) {
      for (const side of ['l', 'r']) {
        const edge = side === 'l' ? n.x1 : n.x2, dir = side === 'l' ? -1 : 1;
        const ys = n.tickYs[side].slice();
        const add = Math.max(2, 5 + Math.floor(rd() * 4) - ys.length);
        let ty = n.y1 + n.h * (0.06 + rd() * 0.14);
        const pitch = (n.h * 0.82) / (add + 0.5);
        for (let i = 0; i < add && ty < n.y2 - 12; i++) {
          nodeL += `<line x1="${F(edge)}" y1="${F(ty)}" x2="${F(edge + dir * (6 + rd() * 12))}" y2="${F(ty)}" stroke="${INKS.silver}" stroke-width="${(1 + rd() * 0.5).toFixed(2)}" opacity="${(0.16 + rd() * 0.06).toFixed(3)}"/>`;
          ys.push(ty);
          ty += pitch * (0.65 + rd() * 0.7); // ±35% pitch jitter, never metered
        }
        for (const y of ys) {
          const pl = 4 + rd() * 3;
          nodeL += `<line x1="${F(edge - dir * 5)}" y1="${F(y)}" x2="${F(edge - dir * (5 + pl))}" y2="${F(y)}" stroke="${INKS.silver}" stroke-width="1" opacity="0.1"/>`;
        }
      }
    }
    // item 4 · guard-via fences flanking the two thinnest accent stretches
    const runAt = (runs, x) => runs.find((rn) => x >= rn.x1 + 6 && x <= rn.x2 - 6);
    const fenceRow = (runs, xa, xb, sideDir, skip) => {
      const cnt = 5 + Math.floor(rd() * 5); // 5-9 dots
      const gapAt = 1 + Math.floor(rd() * Math.max(1, cnt - 2)); // 2-3 fragments
      let x = xa + rd() * 80;
      for (let i = 0; i < cnt && x < xb; i++) {
        const run = runAt(runs, x);
        const blocked = skip && x > skip[0] && x < skip[1];
        if (run && !blocked) {
          dotL += `<circle cx="${F(nud(x))}" cy="${F(run.y + sideDir * (14 + rd() * 4))}" r="${F(1.6 + rd() * 0.8)}" fill="${INKS.silver}" opacity="${(0.1 + rd() * 0.04).toFixed(3)}"/>`;
        }
        x += 28 + rd() * 42; // aperiodic pitch
        if (i === gapAt || (i === gapAt + 3 && rd() < 0.5)) x += 90 + rd() * 120;
      }
    };
    fenceRow(retB.runs, 2300, 3400, -1);                          // p3, above the blue run
    fenceRow(hotB.runs, 6900, 8200, 1, [N6.x1 - 20, N6.x2 + 20]); // p7-8, below the amber run
    // item 5 · ONE length-matching serpentine on g1's top lane (p3)
    {
      const sRun = g1b.runs.find((rn) => rn.y < 380 && rn.x2 - rn.x1 > 420 && rn.x1 < 2520 && rn.x2 > 2620);
      if (sRun) {
        const sy = sRun.y, teeth = 5 + Math.floor(rd() * 3);
        let x = Math.max(sRun.x1 + 60, 2410 + rd() * 50);
        let d = `M ${F(x)} ${F(sy)}`;
        for (let i = 0; i < teeth && x < Math.min(sRun.x2 - 50, 2960); i++) {
          const th = 16 + rd() * 10, pw = 24 + rd() * 18, gp = 8 + rd() * 12; // ±30% pitch
          d += ` L ${F(x)} ${F(sy - th)} L ${F(x + pw)} ${F(sy - th)} L ${F(x + pw)} ${F(sy)} L ${F(x + pw + gp)} ${F(sy)}`;
          x += pw + gp;
        }
        grayL += `<path d="${d}" fill="none" stroke="${INKS.platinum}" stroke-width="1.4" opacity="0.17" stroke-linejoin="round"/>`;
      }
    }
    // item 6 · test points hung off the g2 / g7 debug stubs
    const testPoint = (sx, sy) => {
      const tx = nud(sx), len = 42 + rd() * 26, ty = sy + len, rr = 4 + rd();
      grayL += `<line x1="${F(tx)}" y1="${F(sy + 10)}" x2="${F(tx)}" y2="${F(ty - rr)}" stroke="${INKS.platinum}" stroke-width="1" opacity="0.12"/>`;
      dotL += `<circle cx="${F(tx)}" cy="${F(ty)}" r="${F(rr)}" fill="none" stroke="${INKS.platinum}" stroke-width="1" opacity="${(0.14 + rd() * 0.02).toFixed(3)}"/>`
        + `<circle cx="${F(tx)}" cy="${F(ty)}" r="1.5" fill="${INKS.silver}" opacity="0.18"/>`;
    };
    testPoint(g2b.x, g2b.y);
    testPoint(g7b.x, g7b.y);
    // item 7 · fiducials: local pair flanking the interchange + globals p2/p10
    const fid = (x, y) => {
      const fx = nud(x);
      grayL += `<circle cx="${F(fx)}" cy="${F(y)}" r="${F(8 + rd() * 3)}" fill="none" stroke="${INKS.platinum}" stroke-width="1" opacity="${(0.08 + rd() * 0.02).toFixed(3)}"/>`;
      dotL += `<circle cx="${F(fx)}" cy="${F(y)}" r="3" fill="${INKS.silver}" opacity="0.16"/>`;
    };
    fid(5490 + rd() * 50, 190 + rd() * 50);   // above L1
    fid(6090 + rd() * 50, 1185 + rd() * 50);  // below L2
    fid(1930 + rd() * 60, 1150 + rd() * 30);  // global, p2
    fid(10270 + rd() * 130, 210 + rd() * 60); // global, p10 (>210px from edge)
    // item 8 · dashed courtyard/keepout outlines around N2 + N6
    for (const n of [N2, N6]) {
      const ins = 18 + rd() * 8;
      const cx1 = nud(n.x1 - ins), cx2 = nud(n.x2 + ins);
      nodeL += `<rect x="${F(cx1)}" y="${F(n.y1 - ins)}" width="${F(cx2 - cx1)}" height="${F(n.h + 2 * ins)}" rx="${F(n.rx + ins * 0.5)}" fill="none" stroke="${INKS.platinum}" stroke-width="1" stroke-dasharray="4 9" opacity="${(0.05 + rd() * 0.02).toFixed(3)}"/>`;
    }
    // item 9 · ground-pour hatch fragments anchoring the three big plates
    const hatch = (x0, y0) => {
      const cnt = 4 + Math.floor(rd() * 4);
      for (let i = 0; i < cnt; i++) {
        const lx = nud(x0 + rd() * 55), ly = y0 + i * (7 + rd() * 4); // ragged stagger
        const ln = (18 + rd() * 42) * 0.707;
        bgL += `<line x1="${F(lx)}" y1="${F(ly)}" x2="${F(lx + ln)}" y2="${F(Math.min(ly + ln, 1330))}" stroke="${INKS.platinum}" stroke-width="1" opacity="${(0.04 + rd() * 0.02).toFixed(3)}"/>`;
      }
    };
    hatch(N0.x1 - 12 + rd() * 20, Math.max(965, N0.y2 + 14));
    hatch(L2.x1 + 6 + rd() * 30, Math.max(1150, L2.y2 + 14));
    hatch(NT.x1 - 12 + rd() * 20, Math.max(965, NT.y2 + 14));
    // item 12 · stitching-via field in p7's lower-left dead zone (clear of
    // the x7260 glow anchor) + one dashed pour-trace fragment through it
    {
      let x = 6520 + rd() * 50;
      const cnt = 8 + Math.floor(rd() * 5);
      for (let i = 0; i < cnt && x < 7150; i++) {
        const y = (i % 2 ? 1098 : 1170) + rd() * 55; // loose staggered grid
        dotL += `<circle cx="${F(nud(x))}" cy="${F(y)}" r="${F(1.6 + rd())}" fill="${INKS.silver}" opacity="${(0.1 + rd() * 0.05).toFixed(3)}"/>`;
        x += 26 + rd() * 38;
      }
      const fx = nud(6540 + rd() * 260), fy = 1105 + rd() * 120, fl = 120 + rd() * 60;
      bgL += `<line x1="${F(fx)}" y1="${F(fy)}" x2="${F(fx + fl)}" y2="${F(fy)}" stroke="${INKS.platinum}" stroke-width="1" opacity="0.06" stroke-dasharray="2 10"/>`;
    }

    return glowL + bgL + nodeL + grayL + accL + dotL;
  },
};
})();

STYLE_DEFS["foundry"] = (function () {
const PAGES = NATIVE_PAGES;
void PAGES;
// foundry · "fab floor" — night panorama of ONE cleanroom hall (cat: blend).
//
// PAGE MAP (u = x/1080 · every phase edge is seed-jittered, never on an
// integer; density envelope is smoothstep-interpolated so no hard breaks):
//   p1-3  u 0.0-3.0   DENSE TOOL ROW — overlapping litho/track/chamber/tower
//                     silhouettes (navy/graphite fills, platinum hairline
//                     tops), status LEDs (c.a/c.b dots, run-capped), back-wall
//                     pipes in the gaps; one faint distant c.gb bay glow
//                     (~u 1.5) + two tiny warm c.ga under-bay pools.
//   p4-5  u 3.0-5.0   THE HALL OPENS — tools taper out (~u 3.4) into a bare
//                     transfer corridor: floor lane hairlines, back-wall
//                     seams + one door with a cool light-leak, overhead HVAC
//                     duct, and ONE AGV silhouette (landmark, ~u 4.5).
//   p6-7  u 5.0-7.0   row resumes sparse and builds to the HERO EXPOSURE BAY
//                     (~u 6.5): gantry-framed bay glowing c.ga from within,
//                     lit windows, one bright door seam, floor reflection —
//                     the composition's one hot landmark, exactly once.
//   p8-9  u 7.0-9.0   METROLOGY ROW THINNING — shorter tools, wider gaps,
//                     fewer LEDs; second, fainter c.gb glow (~u 8.4).
//   p10   u 9.0-10    DARK END WALL — tools gone; pipe runs carry on and fade
//                     toward the right edge; one last tiny status LED.
//
// Depth layers back-to-front: wall pipes/seams -> floor haze (soft platinum
// ellipses) -> FAR back row (v3.2 two-step parallax, 0.16-0.22 fills) ->
// back row -> ambient bay glows -> ceiling duct/rail/lamps -> tool row ->
// hero bay -> AGV -> floor line / lane marks / sheen -> v3.2 anatomy passes.
// Hue lives ONLY in light: glows (ga/gb), LEDs (a/b), lit windows/seams;
// all structure = INKS.
//
// v3.2 FAB-ANATOMY ENHANCEMENT (10 additions, all on independent RNG
// channels so the established r() stream + both landmarks stay put):
//   1 FOUP load ports — 1-2 outlined squares per wide tool at ONE shared
//     waist height (FLOOR-86 +/-8), ~40% occupied (NV carrier + run-capped
//     c.a/c.b dot), pages 1-3 & 6-9, hero span skipped.
//   2 Tri-stack signal masts on 3-4 metrology towers (c.a/c.b/c.c top-down,
//     one per page max, never two within 300px).
//   3 Second OHT pod on page 2 (clear of xGb1) + twin suspension belts and
//     260-420px drawn rail segments around BOTH pods.
//   4 FFU ceiling-grid whisper: schedule()-jittered dashed hairline at
//     ductY+58 with per-page stub verticals; fades across page 10.
//   5 Far back tool row behind layer 2b (heights 140-320, fills 0.16-0.22,
//     base FLOOR-10) — skips corridor u3.4-5.0 and hero +/-260.
//   6 Hero inner silhouette reshaped into a litho/EUV scanner train (main
//     body + interface tunnel + rounded source vessel, c.ga slit at the
//     joint, readout relocated onto the body) — bay/glows untouched.
//   7 AGV magnetic guide path (FLOOR+52, la->lb) with c.c reflective dashes;
//     c.c 'white light' cores in headlight and door light-leak.
//   8 Corridor furniture: c.c interlock beacon on the door lintel + one
//     wall-mounted extinguisher station (c.a dot).
//   9 One wafer stocker on page 8/9: 3x5-6 jittered shelf-dash matrix
//     (below the text band) + c.b port dot at the shared dock height.
//  10 Wall pipe drops completed with 6x10 valve boxes + 1px flex hoses to
//     the adjacent tool flank, 2-3 notches on pages 1-3.
// (helpers provided by the registry's shared toolkit)
return {
  key: 'foundry',
  name: 'fab floor',
  cat: 'blend',
  desc: 'night cleanroom hall: dense tool row, bare AGV corridor, one glowing exposure bay, thinning metrology, dark end wall',
  gen(seed, hue) {
    const c = HUES[hue], SW = PAGES * W, boost = glowAlphaBoost(hue);
    const r = mulberry32(seed + 401);
    const nzH = valueNoise1D(seed + 91);
    const FLOOR = 1188;
    const P = INKS.platinum, NV = INKS.navy, GR = INKS.graphite;
    const fx = (v) => (Math.round(v * 10) / 10).toString();
    const ln = (x1, y1, x2, y2, col, sw, op) => `<line x1="${fx(x1)}" y1="${fx(y1)}" x2="${fx(x2)}" y2="${fx(y2)}" stroke="${col}" stroke-width="${sw}" opacity="${op.toFixed(3)}"/>`;
    const dot = (cx, cy, rr, col, op) => `<circle cx="${fx(cx)}" cy="${fx(cy)}" r="${fx(rr)}" fill="${col}" opacity="${op.toFixed(3)}"/>`;
    const rect = (x, y, w2, h2, col, op) => `<rect x="${fx(x)}" y="${fx(y)}" width="${fx(w2)}" height="${fx(h2)}" fill="${col}" opacity="${op.toFixed(3)}"/>`;
    const glow = (cx, cy, rr, col, op) => `<circle cx="${fx(cx)}" cy="${fx(cy)}" r="${fx(rr)}" fill="${col}" opacity="${op.toFixed(3)}" filter="url(#nb-blur)"/>`;
    const gel = (cx, cy, rx, ry, col, op) => `<ellipse cx="${fx(cx)}" cy="${fx(cy)}" rx="${fx(rx)}" ry="${fx(ry)}" fill="${col}" opacity="${op.toFixed(3)}" filter="url(#nb-blur)"/>`;
    // keep discrete feature anchors off frame boundaries (rule 7)
    const nudge = (x) => { const m = ((x % W) + W) % W; if (m < 24) return x + (26 - m); if (m > W - 24) return x + (W - m) + 26; return x; };
    let out = '';

    // ---- v3.2 fab-anatomy channels + records ------------------------------
    // Independent RNG streams for the anatomy passes so no new draw is ever
    // inserted into the established r() sequence (that would re-jitter the
    // whole layout and could shove a landmark onto a cut). Existing elements
    // are RECORDED during their draw (no extra r() calls) and decorated in
    // appended passes.
    const rPort = mulberry32((seed ^ 0xE7A0) + 11);  // FOUP load ports
    const rMast = mulberry32((seed ^ 0xE7A0) + 23);  // tri-stack signal masts
    const rPod = mulberry32((seed ^ 0xE7A0) + 37);   // 2nd OHT pod + hoists
    const rFfu = mulberry32((seed ^ 0xE7A0) + 53);   // FFU ceiling grid
    const rFar = mulberry32((seed ^ 0xE7A0) + 71);   // far back row
    const rHero = mulberry32((seed ^ 0xE7A0) + 89);  // hero scanner-train side
    const rCor = mulberry32((seed ^ 0xE7A0) + 101);  // guide path + furniture
    const rStk = mulberry32((seed ^ 0xE7A0) + 113);  // wafer stocker
    const rVal = mulberry32((seed ^ 0xE7A0) + 127);  // valve boxes + hoses
    const tools = [], towers = [], dropsRec = [];
    let railYRec = 0, oxPod = 0, doorX = 0, doorW = 0, doorH = 0, axAgv = 0, laRec = 0, lbRec = 0, farRowAt = 0;

    // ---- arc density envelope (smoothstep through jittered control pts) ----
    const cp = [[-0.4, 0.88], [2.62, 0.86], [3.46, 0.13], [4.84, 0.09], [5.68, 0.70], [7.18, 0.60], [8.72, 0.32], [9.38, 0.09], [10.4, 0.02]];
    for (let i = 1; i < cp.length - 1; i++) cp[i][0] += (r() - 0.5) * 0.16;
    const env = (x) => {
      const u = x / W;
      if (u <= cp[0][0]) return cp[0][1];
      for (let i = 0; i < cp.length - 1; i++) {
        if (u <= cp[i + 1][0]) {
          const t = (u - cp[i][0]) / (cp[i + 1][0] - cp[i][0]);
          const s = t * t * (3 - 2 * t);
          return cp[i][1] * (1 - s) + cp[i + 1][1] * s;
        }
      }
      return cp[cp.length - 1][1];
    };
    // end-wall fade — begins inside page 10, off-boundary
    const fadeAt = (9.26 + r() * 0.1) * W;
    const fade = (x) => x < fadeAt ? 1 : Math.max(0.05, 1 - (x - fadeAt) / (0.82 * W));

    // ---- fixed anchors (consumed early so layout is seed-stable) ----------
    const xGb1 = (1.35 + r() * 0.4) * W;          // distant lit bay, page 2
    const xPool1 = (0.45 + r() * 0.3) * W;        // warm under-bay pool, p1
    const xPool2 = (2.3 + r() * 0.4) * W;         // warm under-bay pool, p3
    const xDoor = 3240 + 340 + r() * 470;         // corridor back-wall door
    const xAgv = (4.35 + r() * 0.4) * W;          // AGV landmark
    const xHero = (6.35 + r() * 0.35) * W;        // hero exposure bay landmark
    const heroW = 430 + r() * 60;
    const xGb2 = (8.3 + r() * 0.35) * W;          // fainter distant bay, p9
    const xLastLed = (9.52 + r() * 0.22) * W;     // last light in the dark
    const heroL = xHero - heroW / 2, heroR = xHero + heroW / 2;

    // ---- layer 1 · back wall: service pipe lanes + seams + door -----------
    const laneYs = [898 + r() * 26, 976 + r() * 26, 1052 + r() * 26];
    for (let li = 0; li < 3; li++) {
      const ly = laneYs[li];
      const brk = schedule(r, SW, 1.0, 2.7);
      const pts = [-(40 + r() * 220), ...brk, SW + 60];
      for (let i = 0; i < pts.length - 1; i++) {
        const off = r() < 0.3;                    // some spans are missing pipe
        const baseOp = 0.055 + r() * 0.045;
        const doDrop = r() < 0.34;
        const dropJit = (r() - 0.5) * 44;
        const doValve = r() < 0.5;
        if (off) continue;
        let a = nudge(pts[i]), b = nudge(pts[i + 1]);
        let s = a;
        while (s < b) {
          // chunk so opacity can breathe with env (wall shows where tools thin)
          const e2 = Math.min(b, s + ((s > fadeAt - 300) ? 280 : 620));
          const mx = (s + e2) / 2;
          const op = Math.min(0.16, baseOp * (1 + 0.9 * (1 - env(mx)))) * fade(mx);
          if (op > 0.008) out += ln(s, ly, e2, ly, P, li === 2 ? 1.6 : 1.1, op);
          s = e2;
        }
        if (doDrop && b < SW - 80 && b > 60) {
          const dx = nudge(b + dropJit);
          out += ln(dx, ly, dx, FLOOR - 4, P, 1, (0.05 + baseOp * 0.5) * fade(dx));
          if (doValve) out += dot(dx, ly, 4.5, P, 0.14 * fade(dx));
          dropsRec.push({ x: dx, ly });
        }
      }
    }
    { // end-wall: two pipe drops descending into the dark (page 10)
      const d1 = nudge((9.12 + r() * 0.22) * W), d2 = nudge((9.55 + r() * 0.2) * W);
      out += ln(d1, laneYs[0], d1, FLOOR - 4, P, 1, 0.07 * fade(d1));
      out += ln(d2, laneYs[1], d2, FLOOR - 4, P, 1, 0.06 * fade(d2));
      out += dot(d1, laneYs[0], 4.5, P, 0.12 * fade(d1));
    }
    for (const sx0 of schedule(r, SW, 0.42, 1.15)) {
      const yTop = 1006 + r() * 22, op = 0.055 + r() * 0.04;
      if (env(sx0) < 0.44) {
        const sx = nudge(sx0);
        out += ln(sx, yTop, sx, FLOOR - 3, P, 1, op * fade(sx));
      }
    }
    { // corridor back-wall door with a cool light-leak underneath
      const dw = 88 + r() * 40, dh = 140 + r() * 40, dx = nudge(xDoor);
      doorX = dx; doorW = dw; doorH = dh;
      out += ln(dx, FLOOR - dh, dx, FLOOR - 2, P, 1, 0.11);
      out += ln(dx + dw, FLOOR - dh, dx + dw, FLOOR - 2, P, 1, 0.11);
      out += ln(dx, FLOOR - dh, dx + dw, FLOOR - dh, P, 1, 0.09);
      out += ln(dx + 3, FLOOR - 2, dx + dw - 3, FLOOR - 2, c.gb, 2.5, 0.3 * boost);
      out += glow(dx + dw / 2, FLOOR + 20, 180, c.gb, 0.065 * boost);
    }
    { // corridor wall cabinets (small service boxes against the back wall)
      const nCab = 2 + (r() < 0.5 ? 1 : 0);
      for (let ci = 0; ci < nCab; ci++) {
        const cx2 = nudge((3.62 + (ci + r() * 0.6) * 0.52) * W);
        if (Math.abs(cx2 - xDoor - 60) < 130 || Math.abs(cx2 - xAgv) < 160) continue;
        const cw = 60 + r() * 60, ch = 70 + r() * 60;
        out += rect(cx2, FLOOR - ch, cw, ch, NV, 0.55 + r() * 0.2);
        out += ln(cx2, FLOOR - ch, cx2 + cw, FLOOR - ch, P, 1, 0.08);
        if (r() < 0.7) out += dot(cx2 + cw * (0.2 + r() * 0.6), FLOOR - ch * 0.45, 1.8, r() < 0.5 ? c.a : c.b, 0.26);
      }
    }

    // ---- layer 2 · floor-level haze (uneven, so silhouettes cut out) ------
    for (const hx0 of schedule(r, SW, 0.8, 1.8)) {
      const hx = hx0, cy = 1065 + r() * 70, rx = 420 + r() * 420, ry = 90 + r() * 80;
      out += gel(hx, cy, rx, ry, P, (0.035 + r() * 0.03) * fade(hx));
    }

    // ---- layer 2b · back row: tall distant silhouettes (parallax depth) ---
    farRowAt = out.length; // v3.2: far parallax row is spliced in HERE (behind 2b)
    {
      const nzB = valueNoise1D(seed + 311);
      let bx = -(140 + r() * 260);
      while (bx < SW - 60) {
        const e = env(bx + 160);
        if (e < 0.3) { bx += 300 + r() * 340; continue; }
        if (bx > heroL - 200 && bx < heroR + 200) { bx = heroR + 200 + r() * 120; continue; }
        const bw = 200 + r() * 240;
        bx = nudge(bx);
        const bh = Math.min(560, (260 + 320 * nzB(bx / 520)) * (0.6 + 0.45 * e));
        const bt = FLOOR - 6 - bh;
        const hasBump = r() < 0.5, bumpX = bx + bw * (0.15 + r() * 0.5), bumpW = bw * (0.2 + r() * 0.2), bumpH = 30 + r() * 60;
        let d = `M${fx(bx)} ${FLOOR - 6}L${fx(bx)} ${fx(bt)}`;
        if (hasBump) d += `L${fx(bumpX)} ${fx(bt)}L${fx(bumpX)} ${fx(bt - bumpH)}L${fx(bumpX + bumpW)} ${fx(bt - bumpH)}L${fx(bumpX + bumpW)} ${fx(bt)}`;
        d += `L${fx(bx + bw)} ${fx(bt)}L${fx(bx + bw)} ${FLOOR - 6}Z`;
        out += `<path d="${d}" fill="${NV}" opacity="${(0.34 + r() * 0.12).toFixed(3)}"/>`;
        if (r() < 0.6) out += ln(bx, bt, bx + bw, bt, P, 1, 0.04 * fade(bx));
        bx += bw + (40 + Math.pow(r(), 1.5) * 320) / Math.pow(Math.max(e, 0.05), 1.1);
      }
    }

    // ---- layer 3 · ambient bay glows (both kit hues, all off-boundary) ----
    out += glow(xGb1, 1130 + r() * 60, 330 + r() * 70, c.gb, (0.085 + r() * 0.02) * boost);
    out += glow(xPool1, 1195 + r() * 25, 200 + r() * 60, c.ga, (0.06 + r() * 0.016) * boost);
    out += glow(xPool2, 1195 + r() * 25, 200 + r() * 60, c.ga, (0.06 + r() * 0.016) * boost);
    out += glow(xGb2, 1140 + r() * 50, 290 + r() * 60, c.gb, (0.058 + r() * 0.016) * boost);

    // ---- layer 4 · overhead: HVAC duct runs, hangers, rail, ceiling lamps -
    const ductY = 118 + r() * 46;
    const ductSpans = [];
    {
      const brk = schedule(r, SW, 1.1, 2.9);
      const pts = [-(30 + r() * 180), ...brk, SW + 50];
      for (let i = 0; i < pts.length - 1; i++) {
        const on = r() > 0.36, op = 0.065 + r() * 0.028;
        if (!on) continue;
        const a = nudge(pts[i]), b = nudge(pts[i + 1]);
        ductSpans.push([a, b]);
        out += ln(a, ductY, b, ductY, P, 1.2, op * fade((a + b) / 2));
        out += ln(a, ductY + 22, b, ductY + 22, P, 1, op * 0.7 * fade((a + b) / 2));
      }
    }
    {
      const hangers = [];
      for (const hx0 of schedule(r, SW, 0.75, 2.0)) {
        const drop = 66 + r() * 120, op = 0.05 + r() * 0.025;
        const hx = nudge(hx0);
        if (ductSpans.some(([a, b]) => hx > a + 30 && hx < b - 30)) {
          out += ln(hx, ductY + 22, hx, ductY + 22 + drop, P, 1, op * fade(hx));
          hangers.push(hx);
        }
      }
      for (let i = 0; i < hangers.length - 1; i++) {      // sagging cable runs
        const a = hangers[i], b = hangers[i + 1];
        if (b - a < 760 && r() < 0.7 && ductSpans.some(([s, e2]) => a > s && b < e2)) {
          const sag = 20 + r() * 34;
          out += `<path d="M${fx(a)} ${fx(ductY + 26)}Q${fx((a + b) / 2)} ${fx(ductY + 26 + sag)} ${fx(b)} ${fx(ductY + 26)}" fill="none" stroke="${P}" stroke-width="1" opacity="${(0.04 * fade(a)).toFixed(3)}"/>`;
        }
      }
    }
    {
      const railY = 208 + r() * 36;
      railYRec = railY;
      const brk = schedule(r, SW, 2.0, 4.2);
      const pts = [-(20 + r() * 150), ...brk, SW + 40];
      for (let i = 0; i < pts.length - 1; i++) {
        const on = r() > 0.48, op = 0.042 + r() * 0.02;
        if (on) out += ln(nudge(pts[i]), railY, nudge(pts[i + 1]), railY, P, 1, op * fade((pts[i] + pts[i + 1]) / 2));
      }
      // one OHT pod mid-transit on the rail (quiet approach stretch, once)
      const ox = nudge((5.45 + r() * 0.3) * W);
      oxPod = ox;
      out += ln(ox - 150 - r() * 60, railY, ox + 150 + r() * 60, railY, P, 1.2, 0.06);
      out += ln(ox, railY, ox, railY + 26, P, 1, 0.1);
      out += rect(ox - 17, railY + 26, 34, 26, NV, 0.9);
      out += ln(ox - 17, railY + 26, ox + 17, railY + 26, P, 1, 0.14);
      out += dot(ox + 10, railY + 44, 1.7, c.a, 0.32);
    }
    for (const lx0 of schedule(r, SW, 1.4, 3.1)) {
      const lx = nudge(lx0);
      out += dot(lx, ductY + 34 + r() * 26, 2.2 + r(), c.c, (0.1 + r() * 0.08) * fade(lx));
    }

    // ---- layer 5 · the tool row (aperiodic cursor walk over env) ----------
    let runCol = '', runLen = 0;
    const led = (lx, ly, rr, op) => {
      let col = r() < 0.52 ? c.b : c.a;
      if (col === runCol && runLen >= 2) col = col === c.b ? c.a : c.b;
      if (col === runCol) runLen++; else { runCol = col; runLen = 1; }
      return { s: dot(lx, ly, rr, col, op), col };
    };
    const hillMod = valueNoise1D(seed + 811);
    let x = -(90 + r() * 180);
    let prevRight = -1e9, prevH = 0;
    while (x < SW - 60) {
      const e = env(x + 110);
      if (e < 0.17) { x += 220 + r() * 260; prevRight = -1e9; continue; }
      if (x > heroL - 90 && x < heroR + 90) { x = heroR + 90 + r() * 90; prevRight = -1e9; continue; }
      const kind = Math.floor(r() * 4);
      let w = kind === 2 ? 58 + r() * 46 : kind === 3 ? 230 + r() * 100 : kind === 0 ? 170 + r() * 120 : 130 + r() * 100;
      x = nudge(x); if (((x + w) % W + W) % W < 24 || ((x + w) % W + W) % W > W - 24) x += 40;
      let h = (130 + 330 * Math.pow(nzH(x / 340), 1.2)) * (0.5 + 0.55 * e) * (0.72 + 0.56 * hillMod(x / (1.9 * W)));
      if (kind === 2) h *= 1.35;
      h = Math.max(115, Math.min(kind === 2 ? 455 : 400, h));
      const t1 = FLOOR - h;
      const fill = r() < 0.62 ? NV : GR;
      const fop = (0.78 + r() * 0.22) * Math.max(fade(x), 0.35);
      const eop = (0.11 + r() * 0.08) * fade(x);
      let body = '', top = '';
      let gA = 0, gB = 0; // section geometry recorded for the load-port pass
      if (kind === 0) {          // litho: tall chamber + lower track section
        const t2 = FLOOR - h * (0.42 + r() * 0.2), sx = x + w * (0.34 + r() * 0.3);
        gA = sx; gB = t2;
        body = `M${fx(x)} ${FLOOR}L${fx(x)} ${fx(t1)}L${fx(sx)} ${fx(t1)}L${fx(sx)} ${fx(t2)}L${fx(x + w)} ${fx(t2)}L${fx(x + w)} ${FLOOR}Z`;
        top = `M${fx(x)} ${fx(t1)}L${fx(sx)} ${fx(t1)}L${fx(sx)} ${fx(t2)}L${fx(x + w)} ${fx(t2)}`;
      } else if (kind === 1) {   // chamber with rooftop unit
        const tb = FLOOR - h * 0.78, rx = x + w * (0.18 + r() * 0.4), rw = w * (0.24 + r() * 0.18);
        gB = tb;
        body = `M${fx(x)} ${FLOOR}L${fx(x)} ${fx(tb)}L${fx(rx)} ${fx(tb)}L${fx(rx)} ${fx(t1)}L${fx(rx + rw)} ${fx(t1)}L${fx(rx + rw)} ${fx(tb)}L${fx(x + w)} ${fx(tb)}L${fx(x + w)} ${FLOOR}Z`;
        top = `M${fx(x)} ${fx(tb)}L${fx(rx)} ${fx(tb)}L${fx(rx)} ${fx(t1)}L${fx(rx + rw)} ${fx(t1)}L${fx(rx + rw)} ${fx(tb)}L${fx(x + w)} ${fx(tb)}`;
      } else if (kind === 2) {   // metrology tower + antenna (emission deferred to layer 5b, same r() draws)
        body = `M${fx(x)} ${FLOOR}L${fx(x)} ${fx(t1)}L${fx(x + w)} ${fx(t1)}L${fx(x + w)} ${FLOOR}Z`;
        top = `M${fx(x)} ${fx(t1)}L${fx(x + w)} ${fx(t1)}`;
        const ax = x + w * (0.3 + r() * 0.4);
        const aTop = t1 - 40 - r() * 46;
        const aLine = ln(ax, t1, ax, aTop, P, 1, 0.07 * fade(x));
        let aDot = null;
        if (r() < 0.5) aDot = dot(ax, t1 - 44 - r() * 40, 1.6, r() < 0.5 ? c.a : c.b, 0.2 * fade(x));
        towers.push({ ax, aTop, aLine, aDot, fd: fade(x) });
      } else {                   // wide low tool with raised hood
        const tb = FLOOR - h * 0.68, kx = x + w * (0.5 + r() * 0.25);
        gA = kx; gB = tb;
        body = `M${fx(x)} ${FLOOR}L${fx(x)} ${fx(tb)}L${fx(kx)} ${fx(tb)}L${fx(kx + w * 0.09)} ${fx(t1)}L${fx(x + w)} ${fx(t1)}L${fx(x + w)} ${FLOOR}Z`;
        top = `M${fx(x)} ${fx(tb)}L${fx(kx)} ${fx(tb)}L${fx(kx + w * 0.09)} ${fx(t1)}L${fx(x + w)} ${fx(t1)}`;
      }
      out += `<path d="${body}" fill="${fill}" opacity="${fop.toFixed(3)}"/>`;
      out += `<path d="${top}" fill="none" stroke="${P}" stroke-width="1" opacity="${eop.toFixed(3)}"/>`;
      const nSeam = r() < 0.55 ? 1 : r() < 0.5 ? 2 : 0;
      for (let sI = 0; sI < nSeam; sI++) {
        const sx2 = x + w * (0.2 + r() * 0.6);
        out += ln(sx2, FLOOR - h * (0.3 + r() * 0.35), sx2, FLOOR - 4, P, 1, 0.05 * fade(x));
      }
      const nLed = 1 + (r() < 0.55 ? 1 : 0) + (r() < 0.2 ? 1 : 0);
      for (let li2 = 0; li2 < nLed; li2++) {
        const lx = x + w * (0.12 + r() * 0.76), ly = FLOOR - 24 - r() * 106;
        if (r() < 0.16) {        // lit readout slot instead of a dot
          const col2 = r() < 0.5 ? c.a : c.b;
          out += rect(lx, ly, 10 + r() * 9, 3.5, col2, (0.32 + r() * 0.14) * fade(x));
        } else {
          const L = led(lx, ly, 2.4 + r() * 1.2, (0.38 + r() * 0.2) * fade(x));
          out += L.s;
          if (li2 === 0 && r() < 0.5)
            out += ln(lx, FLOOR + 5, lx, FLOOR + 5 + 26 + r() * 55, L.col, 1, (0.07 + r() * 0.05) * fade(x));
        }
      }
      // transfer bridge to the previous tool when they stand close
      if (x - prevRight > 8 && x - prevRight < 74 && prevH > 170 && h > 170 && r() < 0.75) {
        const by = FLOOR - 84 - r() * 46, bw2 = x - prevRight + 8;
        out += rect(prevRight - 4, by, bw2, 13, NV, 0.85 * Math.max(fade(x), 0.35));
        out += ln(prevRight - 4, by, prevRight - 4 + bw2, by, P, 1, 0.09 * fade(x));
      }
      prevRight = x + w; prevH = h;
      tools.push({ x, w, h, kind, gA, gB, fd: fade(x) });
      const gap = Math.min(1500, (12 + Math.pow(r(), 1.6) * 120) / Math.pow(Math.max(e, 0.05), 1.5));
      x += w + gap;
    }

    // ---- layer 5b · antenna emission + tri-stack signal masts (v3.2 #2) ---
    // 2-3 masts on pages 1-3 (near u 0.4/1.8/2.7, jittered) and 1-2 on pages
    // 6-8 get the fab tell: 3 stacked status dots c.a/c.b/c.c top-down. At
    // most one per page, never two within 300px; all others keep their
    // original single antenna dot, byte-identical.
    {
      const picks = [];
      const tgts = [
        [0.4 + (rMast() - 0.5) * 0.3, 0, 3.0],
        [1.8 + (rMast() - 0.5) * 0.3, 0, 3.0],
        [2.7 + (rMast() - 0.5) * 0.25, 0, 3.0],
        [5.45 + rMast() * 0.9, 5.0, 8.0],
      ];
      if (rMast() < 0.55) tgts.push([6.8 + rMast() * 1.0, 5.0, 8.0]);
      for (const [tu, lo, hi] of tgts) {
        let best = null, bd = 1e9;
        for (const tw2 of towers) {
          const uu = tw2.ax / W, mm = ((tw2.ax % W) + W) % W;
          if (uu < lo || uu >= hi || mm < 26 || mm > W - 26) continue;
          if (tw2.ax < 70 || tw2.ax > SW - 70) continue;
          const d = Math.abs(uu - tu);
          if (d < bd) { bd = d; best = tw2; }
        }
        if (!best || bd > (lo >= 5 ? 1.0 : 0.5) || picks.includes(best)) continue;
        if (picks.some((p) => Math.abs(p.ax - best.ax) < 300 || Math.floor(p.ax / W) === Math.floor(best.ax / W))) continue;
        picks.push(best);
      }
      for (const tw2 of towers) {
        out += tw2.aLine;
        if (picks.includes(tw2)) {
          const stack = [c.a, c.b, c.c];
          for (let di = 0; di < 3; di++) out += dot(tw2.ax, tw2.aTop + di * 6, 1.8, stack[di], (0.22 + rMast() * 0.08) * tw2.fd);
        } else if (tw2.aDot) out += tw2.aDot;
      }
    }

    // ---- layer 6 · HERO EXPOSURE BAY (landmark, once, off-boundary) -------
    {
      const bayH = 400 + r() * 50, topY = FLOOR - bayH;
      out += glow(xHero, 1150, 360 + r() * 50, c.ga, (0.085 + r() * 0.02) * boost);
      out += glow(xHero + (r() - 0.5) * 80, 1170, 180, c.ga, 0.075 * boost);
      // gantry frame: beam + pillars
      out += rect(heroL - 30, topY, heroW + 60, 20, NV, 0.8);
      out += ln(heroL - 30, topY, heroR + 30, topY, P, 1, 0.16);
      out += ln(heroL - 18, topY + 22, heroR + 18, topY + 22, c.ga, 1, 0.16);
      out += rect(heroL - 30, topY, 24, bayH, NV, 0.8);
      out += rect(heroR + 6, topY, 24, bayH, NV, 0.8);
      // inner tool silhouette — v3.2 #6: litho/EUV scanner train. Same iw/ix
      // footprint partitioned 0.62 main body + 0.08 interface tunnel + 0.30
      // rounded source-vessel module; all GR 0.85, bay itself untouched.
      const iw = heroW * 0.62, ix = xHero - iw / 2 + (r() - 0.5) * 30, ih = bayH * 0.72;
      const it = FLOOR - ih;
      const vSide = rHero() < 0.5 ? -1 : 1;   // vessel end: -1 left, +1 right
      const mbw = iw * 0.62, tw3 = iw * 0.08, vw3 = iw * 0.30;
      const mbx = vSide < 0 ? ix + vw3 + tw3 : ix;
      const tx3 = vSide < 0 ? ix + vw3 : ix + mbw;
      const vx3 = vSide < 0 ? ix : ix + mbw + tw3;
      const rx2 = mbx + mbw * (0.2 + r() * 0.3), rw2 = mbw * 0.26;
      out += `<path d="M${fx(mbx)} ${FLOOR}L${fx(mbx)} ${fx(it + ih * 0.22)}L${fx(rx2)} ${fx(it + ih * 0.22)}L${fx(rx2)} ${fx(it)}L${fx(rx2 + rw2)} ${fx(it)}L${fx(rx2 + rw2)} ${fx(it + ih * 0.22)}L${fx(mbx + mbw)} ${fx(it + ih * 0.22)}L${fx(mbx + mbw)} ${FLOOR}Z" fill="${GR}" opacity="0.85"/>`;
      out += rect(tx3, FLOOR - ih * 0.55, tw3, ih * 0.55, GR, 0.85);
      const vh = ih * 0.45, vt = FLOOR - vh;
      const vOut = vSide < 0 ? vx3 : vx3 + vw3, vIn = vSide < 0 ? vx3 + vw3 : vx3;
      out += `<path d="M${fx(vIn)} ${FLOOR}L${fx(vIn)} ${fx(vt)}L${fx(vOut - vSide * 14)} ${fx(vt)}Q${fx(vOut)} ${fx(vt)} ${fx(vOut)} ${fx(vt + 14)}L${fx(vOut)} ${FLOOR}Z" fill="${GR}" opacity="0.85"/>`;
      out += rect(vIn - 3, vt + vh * 0.22, 6, 44, c.ga, 0.30); // lit slit at the module joint
      // lit windows on the train (bottom quarter only; clamped inside vessel)
      let wx = ix + 18 + r() * 20;
      for (let wi = 0; wi < 3 + (r() < 0.5 ? 1 : 0); wi++) {
        const ww = 16 + r() * 24, wh = 7 + r() * 9;
        let wy = 1035 + r() * 100;
        if (wx + ww > ix + iw - 12) break;
        if (wx + ww > vx3 && wx < vx3 + vw3 && wy < vt + 5) wy = vt + 6;
        out += rect(wx, wy, ww, wh, c.ga, 0.3 + r() * 0.12);
        wx += ww + 18 + r() * 46;
      }
      // operator-panel readout relocated onto the main body (v3.2 #6)
      out += rect(mbx + mbw * 0.5 - 5 + (r() - 0.5) * 40, 1078 + r() * 30, 10, 7, c.c, 0.42);
      // bright door seam
      const seamX = xHero + (r() - 0.5) * heroW * 0.5;
      out += ln(seamX, 1012, seamX, FLOOR - 2, c.ga, 2, 0.45 + r() * 0.1);
      // pillar status LEDs
      out += dot(heroL - 18, FLOOR - 60 - r() * 40, 2.6, c.a, 0.45);
      out += dot(heroR + 18, FLOOR - 60 - r() * 40, 2.6, c.b, 0.45);
      // floor reflection: soft pool + vertical shimmers
      out += gel(xHero, 1268, 280, 55, c.ga, 0.06 * boost);
      for (let si = 0; si < 4; si++) {
        const sx3 = xHero + (r() - 0.5) * heroW * 0.8;
        out += ln(sx3, FLOOR + 6, sx3, FLOOR + 6 + 35 + r() * 55, c.ga, 1.4, 0.07 + r() * 0.05);
      }
      out += ln(heroL - 160, FLOOR + 1, heroR + 160, FLOOR + 1, c.ga, 1, 0.12);
    }

    // ---- layer 7 · AGV in the corridor (landmark, once) -------------------
    {
      const ax = nudge(xAgv), aw = 168, ah = 46, ay = FLOOR - ah;
      axAgv = ax;
      out += `<path d="M${fx(ax - aw / 2 + 10)} ${FLOOR}Q${fx(ax - aw / 2)} ${FLOOR} ${fx(ax - aw / 2)} ${fx(FLOOR - 12)}L${fx(ax - aw / 2)} ${fx(ay + 10)}Q${fx(ax - aw / 2)} ${fx(ay)} ${fx(ax - aw / 2 + 10)} ${fx(ay)}L${fx(ax + aw / 2 - 10)} ${fx(ay)}Q${fx(ax + aw / 2)} ${fx(ay)} ${fx(ax + aw / 2)} ${fx(ay + 10)}L${fx(ax + aw / 2)} ${fx(FLOOR - 12)}Q${fx(ax + aw / 2)} ${FLOOR} ${fx(ax + aw / 2 - 10)} ${FLOOR}Z" fill="${NV}" opacity="0.95"/>`;
      const px = ax - 14 + (r() - 0.5) * 30;
      out += rect(px, ay - 30, 54, 30, GR, 0.95);
      out += ln(px, ay - 30, px + 54, ay - 30, P, 1, 0.18);
      out += ln(ax - aw / 2, ay, ax + aw / 2, ay, P, 1, 0.16);
      out += dot(ax - aw / 2 + 20, FLOOR - 16, 2.4, c.a, 0.42);
      out += dot(ax + aw / 2 - 8, FLOOR - 16, 2.8, c.b, 0.55);
      out += glow(ax + aw / 2 + 60, FLOOR - 20, 170, c.gb, 0.07 * boost);
      out += ln(ax - 24, FLOOR + 5, ax - 24, FLOOR + 5 + 20 + r() * 20, P, 1, 0.08);
      out += ln(ax + aw / 2 - 8, FLOOR + 5, ax + aw / 2 - 8, FLOOR + 32 + r() * 18, c.b, 1, 0.12);
    }

    // ---- layer 8 · floor: main line, corridor lane marks, sheen, last LED -
    out += ln(-40, FLOOR, fadeAt + 230, FLOOR, P, 1, 0.16);
    out += ln(fadeAt + 230, FLOOR, fadeAt + 560, FLOOR, P, 1, 0.08);
    out += ln(fadeAt + 560, FLOOR, SW + 40, FLOOR, P, 1, 0.035);
    {
      const la = (3.28 + r() * 0.2) * W, lb = (5.42 + r() * 0.2) * W;
      laRec = la; lbRec = lb;
      for (const lyOff of [70 + r() * 14, 97 + r() * 14]) {
        const y2 = FLOOR + lyOff, m = (lb - la) * 0.15;
        out += ln(nudge(la), y2, la + m, y2, P, 1, 0.06);
        out += ln(la + m, y2, lb - m, y2, P, 1, 0.12);
        out += ln(lb - m, y2, nudge(lb), y2, P, 1, 0.06);
      }
    }
    for (const shx0 of schedule(r, SW, 0.7, 1.9)) {
      const shx = nudge(shx0), y3 = 1235 + r() * 85, len = 70 + r() * 190;
      out += ln(shx, y3, shx + len, y3, P, 1, (0.035 + r() * 0.03) * fade(shx));
    }
    {
      const lx = nudge(xLastLed), ly2 = 1096 + r() * 60;
      out += dot(lx, ly2, 3, c.b, 0.36);
      out += ln(lx, FLOOR + 4, lx, FLOOR + 4 + 24 + r() * 20, c.b, 1, 0.08);
    }

    // ======== v3.2 fab-anatomy passes (appended; fresh channels only, ======
    // ======== except led() carrier dots which extend the r() stream at =====
    // ======== its very end — nothing draws from r() after this point) ======

    { // #4 · FFU ceiling-grid whisper: dashed hairline at ductY+58 (+/-6),
      // schedule()-jittered chunks + 2-3 stub verticals per page; crosses
      // page 10 only under fade(x). Ceiling zone, far above the text band.
      const gy = ductY + 58;
      const starts = schedule(rFfu, SW, 0.13, 0.31);
      starts.push(SW + 200);
      for (let i = 0; i + 1 < starts.length; i++) {
        const dlen = Math.min(90 + rFfu() * 130, starts[i + 1] - starts[i] - 40);
        const yy = gy + (rFfu() - 0.5) * 12;
        const op = (0.03 + rFfu() * 0.015) * fade(starts[i] + dlen / 2);
        if (dlen > 24 && op > 0.006) out += ln(starts[i], yy, starts[i] + dlen, yy, P, 1, op);
      }
      for (const sx0 of schedule(rFfu, SW, 0.28, 0.55)) {
        const sx = nudge(sx0), y0 = gy + (rFfu() - 0.5) * 10;
        const sop = 0.04 * fade(sx);
        if (sop > 0.006) out += ln(sx, y0, sx, y0 + 14, P, 1, sop);
      }
    }

    { // #5 · far back tool row (two-step parallax): 0.16-0.22 NV fills at
      // ~60% height, base FLOOR-10, skipping corridor u 3.4-5.0 and hero
      // +/-260px; spliced in BEHIND layer 2b via farRowAt.
      const nzF = valueNoise1D(seed + 977);
      let fr2 = '';
      let bx = -(120 + rFar() * 240);
      while (bx < SW - 60) {
        const uu = (bx + 130) / W;
        if (uu >= 9.0) break;
        if (uu > 3.35 && uu < 5.02) { bx = 5.02 * W + rFar() * 220; continue; }
        const e = env(bx + 140);
        if (e < 0.28) { bx += 340 + rFar() * 380; continue; }
        if (bx > heroL - 260 && bx < heroR + 260) { bx = heroR + 260 + rFar() * 150; continue; }
        const bw = 160 + rFar() * 220;
        bx = nudge(bx);
        const bh = Math.min(320, 140 + 180 * nzF(bx / 610) * (0.55 + 0.5 * e));
        fr2 += rect(bx, FLOOR - 10 - bh, bw, bh, NV, (0.16 + rFar() * 0.06) * Math.max(fade(bx), 0.3));
        if (rFar() < 0.25) fr2 += ln(bx, FLOOR - 10 - bh, bx + bw, FLOOR - 10 - bh, P, 1, 0.025 * fade(bx));
        bx += bw + (150 + Math.pow(rFar(), 1.4) * 520) / Math.pow(Math.max(e, 0.05), 0.9);
      }
      out = out.slice(0, farRowAt) + fr2 + out.slice(farRowAt);
    }

    { // #3 · second OHT pod (page 2, clear of the xGb1 glow) + true hoist
      // anatomy on BOTH pods: twin 1px suspension belts and an extended
      // 260-420px drawn rail segment around each.
      let ox2 = (1.62 + rPod() * 0.26) * W;
      if (Math.abs(ox2 - xGb1) < 205) ox2 = xGb1 + 205 + rPod() * 50;
      if (ox2 > 1.95 * W) ox2 = xGb1 - 205 - rPod() * 50;
      ox2 = nudge(ox2);
      out += ln(ox2 - 150 - rPod() * 60, railYRec, ox2 + 150 + rPod() * 60, railYRec, P, 1.2, 0.06 + rPod() * 0.02);
      out += rect(ox2 - 17, railYRec + 26, 34, 26, NV, 0.9);
      out += ln(ox2 - 17, railYRec + 26, ox2 + 17, railYRec + 26, P, 1, 0.14);
      out += dot(ox2 + (rPod() < 0.5 ? -10 : 10), railYRec + 44, 1.7, c.a, 0.28);
      for (const px of [oxPod, ox2]) {
        const ext = 130 + rPod() * 80;
        out += ln(px - ext, railYRec, px + ext, railYRec, P, 1, 0.07);
        out += ln(px - 4, railYRec, px - 4, railYRec + 26, P, 1, 0.08);
        out += ln(px + 4, railYRec, px + 4, railYRec + 26, P, 1, 0.08);
      }
    }

    { // #7 · AGV guide path (la->lb at FLOOR+52, brighter mid) with c.c
      // reflective dashes; c.c 'white light' cores for headlight + door leak.
      const gpy = FLOOR + 52 + (rCor() - 0.5) * 12;
      const m = (lbRec - laRec) * 0.15;
      out += ln(nudge(laRec), gpy, laRec + m, gpy, P, 1, 0.03);
      out += ln(laRec + m, gpy, lbRec - m, gpy, P, 1, 0.05);
      out += ln(lbRec - m, gpy, nudge(lbRec), gpy, P, 1, 0.03);
      const nd = 3 + (rCor() < 0.5 ? 1 : 0);
      for (let di = 0; di < nd; di++) {
        const dx2 = nudge(laRec + m + (lbRec - laRec - 2 * m) * (0.06 + 0.88 * rCor()));
        out += rect(dx2 - 2, gpy - 0.75, 4, 1.5, c.c, 0.10);
      }
      out += dot(axAgv + 86, FLOOR - 20, 2.2, c.c, 0.30);
      out += ln(doorX + doorW * 0.32, FLOOR - 2, doorX + doorW * 0.68, FLOOR - 2, c.c, 1.3, 0.30);
    }

    { // #8 · corridor furniture: interlock beacon on the door lintel + one
      // wall-mounted extinguisher station (140px clear of door, 200 of AGV).
      out += dot(doorX + doorW / 2, FLOOR - doorH - 4, 1.8, c.c, 0.22);
      let ex = (3.3 + rCor() * 0.8) * W;
      if (ex + 10 > doorX - 140 && ex < doorX + doorW + 140) ex = doorX + doorW + 152 + rCor() * 120;
      if (Math.abs(ex - xAgv) < 212) ex = Math.min(doorX - 172, xAgv - 250) - rCor() * 60;
      ex = nudge(ex);
      out += rect(ex, FLOOR - 110, 8, 22, NV, 0.6);
      out += ln(ex - 2, FLOOR - 112, ex + 10, FLOOR - 112, P, 1, 0.08);
      out += dot(ex + 4, FLOOR - 103, 1.5, c.a, 0.18);
    }

    { // #9 · wafer stocker, exactly once (u~7.6-8.2, clear of xGb2): a tall
      // kind-2-style tower gains a jittered 3x5-6 shelf-dash matrix (kept
      // below the text band) + one c.b port dot at the shared dock height.
      let st = null;
      for (const t of tools) {
        if (t.kind !== 2 || t.w < 85 || t.h < 330) continue;
        const cxT = t.x + t.w / 2, uu = cxT / W;
        if (uu < 7.55 || uu > 8.25) continue;
        if (Math.abs(cxT - xGb2) < 200) continue;
        if (!st || t.h > st.h) st = t;
      }
      let sx4, sw4, sh4, sfd;
      if (st) { sx4 = st.x; sw4 = st.w; sh4 = st.h; sfd = st.fd; }
      else {
        sw4 = 90 + rStk() * 30; sh4 = 380 + rStk() * 50;
        sx4 = (7.62 + rStk() * 0.5) * W;
        if (Math.abs(sx4 + sw4 / 2 - xGb2) < 210) sx4 = xGb2 - 240 - sw4 - rStk() * 80;
        sx4 = nudge(sx4); sfd = fade(sx4);
        out += rect(sx4, FLOOR - sh4, sw4, sh4, NV, 0.82);
        out += ln(sx4, FLOOR - sh4, sx4 + sw4, FLOOR - sh4, P, 1, 0.1 * sfd);
      }
      const rows = 5 + (rStk() < 0.5 ? 1 : 0);
      const shelfTop = Math.max(FLOOR - sh4 + 36, 852);
      const step = (FLOOR - 120 - shelfTop) / rows;
      for (let ci = 0; ci < 3; ci++) {
        const colx = sx4 + sw4 * (0.22 + ci * 0.28) + (rStk() - 0.5) * 6;
        for (let ri = 0; ri < rows; ri++) {
          const ry = shelfTop + ri * step + (rStk() - 0.5) * 10;
          if (rStk() < 0.3) continue;
          out += rect(colx - 2.5, ry, 5, 2, P, 0.045);
        }
      }
      out += dot(nudge(sx4 + sw4 * (0.3 + rStk() * 0.4)), FLOOR - 88, 2, c.b, 0.25 * sfd);
    }

    { // #10 · point-of-connection drops completed: valve boxes + flex hoses
      // in 2-3 inter-tool notches of pages 1-3 (env > 0.6).
      const seen = [];
      let done = 0;
      const finish = (gx) => {
        const by2 = 1072 + rVal() * 10;
        out += rect(gx - 3, by2, 6, 10, NV, 0.5);
        out += ln(gx - 3, by2, gx + 3, by2, P, 1, 0.07);
        let bt = null, bd2 = 1e9;
        for (const t of tools) {
          const fl = gx < t.x + t.w / 2 ? t.x : t.x + t.w;
          const d2 = Math.abs(fl - gx);
          if (d2 > 3 && d2 < bd2) { bd2 = d2; bt = fl; }
        }
        if (bt !== null && bd2 < 260) {
          const hy = 1124 + rVal() * 34;
          out += `<path d="M${fx(gx)} ${fx(by2 + 10)}Q${fx((gx + bt) / 2)} ${fx(hy + 36)} ${fx(bt)} ${fx(hy)}" fill="none" stroke="${P}" stroke-width="1" opacity="0.040"/>`;
        }
        seen.push(gx); done++;
      };
      for (const dp of dropsRec) {
        if (done >= 3) break;
        const uu = dp.x / W;
        if (uu < 0.2 || uu > 2.9 || env(dp.x) < 0.6) continue;
        if (tools.some((t) => dp.x > t.x - 4 && dp.x < t.x + t.w + 4)) continue;
        if (rVal() < 0.25) continue;
        finish(dp.x);
      }
      if (done < 2) { // extend the drop recipe into an open notch if too few landed clear
        const sorted = tools.filter((t) => t.x > 0.15 * W && t.x < 2.95 * W).sort((q, q2) => q.x - q2.x);
        for (let i = 0; i + 1 < sorted.length && done < 2; i++) {
          const gL = sorted[i].x + sorted[i].w, gR = sorted[i + 1].x;
          if (gR - gL < 34 || env((gL + gR) / 2) < 0.6) continue;
          if (seen.some((sxx) => Math.abs(sxx - (gL + gR) / 2) < 260)) continue;
          if (rVal() < 0.35) continue;
          const gx = nudge(gL + (gR - gL) * (0.3 + rVal() * 0.4));
          const gly = laneYs[Math.floor(rVal() * 3) % 3];
          out += ln(gx, gly, gx, FLOOR - 4, P, 1, 0.06);
          finish(gx);
        }
      }
    }

    { // #1 · FOUP load ports: 1-2 outlined squares per wide tool at ONE
      // shared waist height (FLOOR-86 +/-8), ~40% occupied with an NV
      // carrier + run-capped c.a/c.b presence dot via led() — these led()
      // calls extend the r() stream strictly at its end.
      // silhouette top at a given x on the tool front (per recorded section
      // geometry) so ports on short tools sit under their TALLER section
      const topAt = (t, px2) =>
        t.kind === 0 ? (px2 < t.gA ? FLOOR - t.h : t.gB)
        : t.kind === 1 ? t.gB
        : (px2 < t.gA ? t.gB : FLOOR - t.h);
      for (const t of tools) {
        if (t.kind === 2 || t.w < 140) continue;
        const uu = (t.x + t.w / 2) / W;
        if (!(uu < 3.0 || (uu >= 5.0 && uu < 9.0))) continue;
        if (t.x + t.w > heroL - 90 && t.x < heroR + 90) continue;
        const n = 1 + (rPort() < 0.42 ? 1 : 0);
        for (let pi = 0; pi < n; pi++) {
          const s = 13 + rPort() * 3;
          const fr3 = n === 1 ? 0.3 + rPort() * 0.4 : pi === 0 ? 0.16 + rPort() * 0.22 : 0.6 + rPort() * 0.22;
          let px = nudge(t.x + t.w * fr3);
          const cy = FLOOR - 86 + (rPort() - 0.5) * 16;
          const occ = rPort() < 0.4;
          if (cy - s / 2 - 8 < topAt(t, px)) { // retry once under the tall section
            let lo2 = 0, hi2 = 0;
            if (t.kind === 0) { lo2 = t.x + 8 + s; hi2 = t.gA - 8 - s; }
            else if (t.kind === 3) { lo2 = t.gA + t.w * 0.09 + 8; hi2 = t.x + t.w - 8 - s; }
            if (hi2 - lo2 < 12) continue;
            px = nudge(lo2 + (hi2 - lo2) * rPort());
            if (cy - s / 2 - 8 < topAt(t, px)) continue;
          }
          if (px < 70 || px > SW - 70) continue;
          if (px - s / 2 < t.x + 3 || px + s / 2 > t.x + t.w - 3) continue;
          out += `<rect x="${fx(px - s / 2)}" y="${fx(cy - s / 2)}" width="${fx(s)}" height="${fx(s)}" fill="none" stroke="${P}" stroke-width="1" opacity="${((0.07 + rPort() * 0.03) * t.fd).toFixed(3)}"/>`;
          if (occ) {
            out += rect(px - s / 2 + 1.5, cy - s / 2 + 1.5, s - 3, s - 3, NV, 0.5);
            out += led(px, cy - s / 2 - 4, 2, 0.25 * t.fd).s;
          }
        }
      }
    }

    return out;
  },
};
})();

STYLE_DEFS["groundtrack"] = (function () {
const PAGES = NATIVE_PAGES;
void PAGES;
// groundtrack · "orbital track" · cobalt
// ONE 10800x1350 satellite ground-track chart. PAGE MAP (x in pages, W=1080):
//   p1  (0-1)  : primary track enters mid-amplitude over a whisper graticule;
//                a dotted "previous pass" history echo fades out; coastline +
//                jittered equator dashes ground the chart.
//   p2  (1-2)  : station 1 dish (~x1.55W) casts a faint cone up to the pass;
//                the pale second orbit fades in late in the page.
//   p3-4(2-4)  : the two tracks interleave and cross — pale node dots mark
//                the intersections; the primary's amplitude swells.
//   p5-6(4-6)  : LANDMARK (~x5.5W, off-boundary): the satellite itself —
//                bright glint, fading trail, footprint ellipse, warm glow.
//   p7  (6-7)  : the second orbit dives and exits below the map mid-page.
//   p8-9(7-9)  : amplitude flattens, graticule/ticks thin, a ghost dotted
//                "next pass" pre-echo appears — the chart breathes out; a
//                tiny telemetry handshake (~x8.5W) keeps p9 alive.
//   p10 (9-10) : station 2 (~x9.45W), cone up-right to the departing track.
// All change rides smooth envelopes (cosine control points at seed-jittered,
// non-integer page positions) — nothing starts, ends, or bends at k*1080.
// v3.2 realism+density pass (independent RNG channels, r() stream untouched):
//   chart frame  : equator lifted to 0.10 + degree-tick stubs, ONE broken
//                  prime meridian mid-p3, graduated bottom frame-tick clusters
//   graticule    : ~15% extra whisper columns (net ~285px), plus-marks 0.10,
//                  latitude hairlines 0.07 (same thin() fade into p8-9)
//   map          : coastline inlet fragments p1-2 / p8-9 / ~x3.9W + island
//                  archipelago ~x8.3W (fills the exhale's lower band)
//   track chart  : sensor-swath corridor p3-4, westward repeat-pass ghost of
//                  the 2nd orbit p3-5 (layer-F dash cadence), asc/desc node
//                  rings at two equator crossings, direction chevrons on both
//                  curves, dashed footprint + solar panels at the glint
//   stations     : st1 ray-fan fused into a soft wedge shaft (4-5 grain rays
//                  kept at half), AOS/LOS dashed visibility half-ellipses at
//                  both bases, radome + shed at st2, dashed downlink LOS from
//                  the handshake sloping into st2 (stops 40px short)
// (helpers provided by the registry's shared toolkit)
return {
  key: 'groundtrack',
  name: 'orbital track',
  cat: 'cobalt',
  desc: 'satellite ground-track chart — drifting sine pass, crossing pale orbit, one glinting bird over two listening dishes',
  gen(seed, hue) {
    const c = HUES[hue], SW = PAGES * W, boost = glowAlphaBoost(hue);
    const r = mulberry32(seed + 9041);
    const periodN = valueNoise1D(seed + 101);
    const ampN = valueNoise1D(seed + 211);
    const centN = valueNoise1D(seed + 307);
    const per2N = valueNoise1D(seed + 401);
    const cent2N = valueNoise1D(seed + 503);
    const amp2N = valueNoise1D(seed + 607);
    const coastN = valueNoise1D(seed + 719);
    const coast2N = valueNoise1D(seed + 823);
    const gratN = valueNoise1D(seed + 907);
    const eqN = valueNoise1D(seed + 1013);
    // v3.2: independent RNG channels for the realism pass — NEVER draw from
    // the r() stream for new detail (it would re-jitter everything downstream
    // and could shove the landmark onto a cut).
    const nr = (tag) => mulberry32((seed ^ 0xE7A0) + tag);
    const rBeam = nr(5);

    const F = (v) => (Math.round(v * 10) / 10).toString();
    const ss = (t) => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };
    const env = (pts, x) => {
      if (x <= pts[0][0]) return pts[0][1];
      for (let i = 1; i < pts.length; i++) if (x < pts[i][0]) {
        const u = 0.5 - 0.5 * Math.cos(Math.PI * (x - pts[i - 1][0]) / (pts[i][0] - pts[i - 1][0]));
        return pts[i - 1][1] * (1 - u) + pts[i][1] * u;
      }
      return pts[pts.length - 1][1];
    };

    // ---- primary track geometry (amp/center envelopes follow the arc) ----
    const jt = () => (r() - 0.5) * 0.22 * W;
    const ampPts = [
      [-0.2 * W, 246 + r() * 30], [1.9 * W + jt(), 282 + r() * 28], [3.4 * W + jt(), 372 + r() * 32],
      [5.4 * W + (r() - 0.5) * 0.1 * W, 398 + r() * 26], [6.7 * W + jt(), 318 + r() * 26],
      [7.9 * W + jt(), 172 + r() * 22], [8.8 * W + jt(), 122 + r() * 18], [10.2 * W, 142 + r() * 20],
    ];
    const center = (x) => 632 + (centN(x / (2.4 * W)) - 0.5) * 220 - 178 * ss((x - 8.35 * W) / (1.65 * W));
    const ampAt = (x) => env(ampPts, x) * (0.9 + 0.2 * ampN(x / (1.9 * W)));

    const DS = 12, NPT = Math.floor(SW / DS) + 1;
    // two-pass phase: integrate, then a slow warp (done by x=3.6W, invisible)
    // that lands an exact crest at x=5.5W so the landmark rides the top.
    const phB = new Array(NPT);
    let ph = 0.32 + r() * 0.35;
    for (let i = 0; i < NPT; i++) {
      phB[i] = ph;
      ph += (DS * Math.PI * 2) / ((2.05 + periodN(i * DS / (3.3 * W))) * W);
    }
    let dW = (-Math.PI / 2 - phB[Math.round(5.5 * W / DS)]) % (Math.PI * 2);
    if (dW <= -Math.PI) dW += Math.PI * 2; else if (dW > Math.PI) dW -= Math.PI * 2;
    const T1 = new Array(NPT);
    for (let i = 0; i < NPT; i++) {
      const x = i * DS;
      const cen = center(x);
      const am = Math.min(ampAt(x), cen - 142, 1228 - cen);
      const p = phB[i] + dW * ss(x / (3.6 * W));
      T1[i] = { x, y: cen + am * Math.sin(p), cen, am, ph: p };
    }

    // ---- secondary pale orbit: fades in ~p2, dives out mid-p7 ----
    const ph20 = 2.1 + r() * 0.9;
    const xs2 = (1.38 + r() * 0.26) * W;
    let diveStart = (6.02 + r() * 0.2) * W;
    let T2 = [];
    for (let attempt = 0; attempt < 5; attempt++) {
      const arr = []; let p2 = ph20, exitX = SW;
      for (let i = 0; i < NPT; i++) {
        const x = i * DS;
        const cen = 716 + (cent2N(x / (2.1 * W)) - 0.5) * 210 + 980 * Math.pow(ss((x - diveStart) / (1.25 * W)), 1.5);
        const am = 196 + 120 * amp2N(x / (2.0 * W));
        const y = cen + am * Math.sin(p2);
        arr.push({ x, y });
        p2 += (DS * Math.PI * 2) / ((1.5 + 0.85 * per2N(x / (2.6 * W))) * W);
        if (y > H + 40) { exitX = x; break; }
      }
      T2 = arr;
      const db = Math.abs(exitX - Math.round(exitX / W) * W);
      if (db > 230 || exitX >= SW) break;
      diveStart += 0.29 * W;
    }

    // ---- landmark position: highest crest inside safe window ~x5.5W ----
    const gi0 = Math.floor(5.36 * W / DS), gi1 = Math.ceil(5.64 * W / DS);
    let gI = gi0;
    for (let i = gi0; i <= gi1; i++) if (T1[i].y < T1[gI].y) gI = i;
    const gX = T1[gI].x, gY = T1[gI].y;

    let out = '';

    // ---- layer A: whisper graticule dots, thinning toward p8-9 ----
    const cols = []; let gx = -60 - r() * 120;
    while (gx < SW + 80) { cols.push(gx); gx += 235 + r() * 185; }
    const rows = []; let gy = 92 + r() * 75;
    while (gy < H - 60) { rows.push(gy); gy += 172 + r() * 150; }
    const thin = (x) => 1 - 0.55 * ss((x - 6.9 * W) / (2.3 * W));
    for (const cx of cols) for (const cy of rows) {
      const p = (0.38 + 0.44 * gratN(cx * 0.0011 + cy * 0.017)) * thin(cx);
      if (r() > p) continue;
      const roll = r();
      if (roll < 0.15) {
        const l2 = 6 + r() * 4;
        out += `<path d="M${F(cx - l2)} ${F(cy)}H${F(cx + l2)}M${F(cx)} ${F(cy - l2)}V${F(cy + l2)}" fill="none" stroke="${INKS.silver}" stroke-width="1" opacity="0.10"/>`;
      } else {
        const hueDot = roll > 0.9;
        out += `<circle cx="${F(cx)}" cy="${F(cy)}" r="${F(1.9 + r() * 1.3)}" fill="${hueDot ? c.gb : INKS.silver}" opacity="${(hueDot ? 0.09 : 0.065 + r() * 0.025).toFixed(3)}"/>`;
      }
    }
    // broken row hairline segments — the chart's latitude lines, whisper
    for (const ry of rows) {
      let sx0 = -80 - r() * 500;
      while (sx0 < SW) {
        const len = 90 + r() * 170;
        if (r() < 0.6 * thin(sx0)) {
          out += `<line x1="${F(sx0)}" y1="${F(ry)}" x2="${F(sx0 + len)}" y2="${F(ry)}" stroke="${INKS.platinum}" stroke-width="1" opacity="0.07"/>`;
        }
        sx0 += len + 430 + r() * 900;
      }
    }

    // ---- layer B: equator — jittered dashes, never a fixed beat ----
    const yEq = 752 + (r() - 0.5) * 70;
    let ex = -20 - r() * 60;
    while (ex < SW) {
      const on = 34 + r() * 52, off = 30 + r() * 46;
      const skip = r() < 0.24 + 0.3 * ss((ex - 8.2 * W) / (1.9 * W));
      if (!skip) {
        const y1 = yEq + (eqN(ex / (1.8 * W)) - 0.5) * 26;
        const y2 = yEq + (eqN((ex + on) / (1.8 * W)) - 0.5) * 26;
        out += `<line x1="${F(ex)}" y1="${F(y1)}" x2="${F(ex + on)}" y2="${F(y2)}" stroke="${INKS.platinum}" stroke-width="1" opacity="0.10"/>`;
      }
      ex += on + off;
    }

    // ---- layer C: coastline + far ridge behind it (depth) + islands ----
    let cd2 = '';
    for (let x = 0; x <= SW; x += 36) {
      const y = 1146 + (coast2N(x / (0.94 * W)) - 0.5) * 78;
      cd2 += (x === 0 ? 'M' : 'L') + x + ' ' + F(y);
    }
    out += `<path d="${cd2}" fill="none" stroke="${INKS.platinum}" stroke-width="1" opacity="0.055"/>`;
    let cd = '';
    for (let x = 0; x <= SW; x += 30) {
      const y = 1206 + (coastN(x / (0.62 * W)) - 0.5) * 116 + (coast2N(x / (0.16 * W)) - 0.5) * 44;
      cd += (x === 0 ? 'M' : 'L') + x + ' ' + F(y);
    }
    out += `<path d="${cd}" fill="none" stroke="${INKS.platinum}" stroke-width="1" opacity="0.115"/>`;
    for (const ix of schedule(r, SW, 0.55, 1.4)) {
      const n = 2 + Math.floor(r() * 3);
      for (let k = 0; k < n; k++) {
        out += `<circle cx="${F(ix + (r() - 0.5) * 130)}" cy="${F(1238 + r() * 66)}" r="${F(1.1 + r())}" fill="${INKS.silver}" opacity="${(0.06 + r() * 0.05).toFixed(3)}"/>`;
      }
    }

    // ---- layer D: glow pools riding the track's extremes ----
    let runCol = '', runLen = 0;
    for (const gx0 of schedule(r, SW, 1.15, 2.5, 1.6)) {
      if (Math.abs(gx0 - gX) < 0.62 * W) continue;
      const i0 = Math.max(0, Math.floor((gx0 - 0.42 * W) / DS)), i1 = Math.min(NPT - 1, Math.floor((gx0 + 0.42 * W) / DS));
      // pools ride the track's extremes; after the warm landmark they seek
      // troughs and stay cool so no later crest-glow rhymes with the glint —
      // the back half's only warmth is station 2's beam
      const postGlint = gx0 > gX;
      let bi = i0, bd = -1;
      for (let i = i0; i <= i1; i += 3) {
        const d2 = postGlint ? T1[i].y : Math.abs(T1[i].y - 672);
        if (d2 > bd) { bd = d2; bi = i; }
      }
      const py = T1[bi].y, crest = T1[bi].y < T1[bi].cen;
      // crest pools sit on the pass only when it rides the top quarter;
      // trough pools sink under it into the bottom quarter (light pooling
      // below the pass) — the middle band never hosts more than a wisp
      const cy2 = crest ? py : Math.max(py + 110, 1052);
      const big = crest ? py <= 310 : true;
      const rad = big ? 170 + r() * 130 : 76 + r() * 40;
      const op = (big ? 0.05 + r() * 0.04 : 0.042) * boost;
      // warm pools only at pre-glint troughs — the glint keeps the only warm
      // crest, so no frame rhymes with the landmark. Under amber the gb
      // troughs read dusty, so amber prefers the ga boost path (the r() draw
      // still always happens — draw count is sacred).
      let col = postGlint || crest ? c.gb : (r() < (hue === 'amber' ? 0.22 : 0.5) ? c.gb : c.ga);
      if (!postGlint && !crest && col === runCol && runLen >= 2) col = col === c.gb ? c.ga : c.gb;
      if (col === runCol) runLen++; else { runCol = col; runLen = 1; }
      out += `<circle cx="${F(T1[bi].x)}" cy="${F(cy2)}" r="${F(rad)}" fill="${col}" opacity="${op.toFixed(3)}" filter="url(#nb-blur)"/>`;
    }

    // ---- layer E: ground stations (cones now, dish silhouettes on top) ----
    const station = (sx, coneCol, lightCol, om, fuse) => {
      const baseY = 1252 + r() * 18, hubY = baseY - 44;
      const tx = sx + 70 + r() * 150;
      const ty = T1[Math.max(0, Math.min(NPT - 1, Math.round(tx / DS)))].y;
      const cw = 84 + r() * 40, apy = hubY - 6, tipY = Math.max(150, ty + 26);
      // nested same-apex fan: one blurred wash + concentric crisp triangles,
      // each a hair brighter toward the axis — smooth radial falloff with no
      // crossing seams (round-1 tilted slices made checkerboard artifacts)
      const bx = sx + (tx - sx) * 0.8, by = apy + (tipY - apy) * 0.8;
      let cs = `<polygon points="${F(sx)},${F(apy)} ${F(bx - cw)},${F(by)} ${F(bx + cw)},${F(by)}" fill="${coneCol}" opacity="${((fuse ? 0.026 : 0.032) * boost * om).toFixed(3)}" filter="url(#nb-blur)"/>`;
      // hairline rays from the apex — staggered lengths end in points, so
      // the beam dissolves upward with NO flat edge anywhere (crisp nested
      // triangles terrace no matter how shallow the steps). Pale rays near
      // the axis carry the luminance; hue rays feather the edges.
      const dxb = tx - sx, dyb = tipY - apy;
      const beamLen = Math.hypot(dxb, dyb), ang0 = Math.atan2(dyb, dxb);
      const spread = Math.atan2(cw, beamLen * 0.85);
      // v3.2 fuse (station 1): the ray-fan reads wiry at preview scale — fuse
      // it into ONE soft uplink shaft: stacked same-apex wedges through
      // nb-blur at 0.7/0.85/1.0 of the spread, then keep only a few grain
      // rays at half strength. The r() draws below are IDENTICAL either way
      // (emission-gated only) so downstream layout never moves.
      if (fuse) {
        for (const [wsc, wcol] of [[1.0, coneCol], [0.85, coneCol], [0.7, c.c]]) {
          const a1 = ang0 - spread * wsc, a2 = ang0 + spread * wsc;
          const Lw = beamLen * (0.8 + rBeam() * 0.08);
          cs += `<polygon points="${F(sx)},${F(apy)} ${F(sx + Math.cos(a1) * Lw)},${F(apy + Math.sin(a1) * Lw)} ${F(sx + Math.cos(a2) * Lw)},${F(apy + Math.sin(a2) * Lw)}" fill="${wcol}" opacity="${((0.012 + rBeam() * 0.004) * boost).toFixed(4)}" filter="url(#nb-blur)"/>`;
        }
      }
      const nR = 15 + Math.floor(r() * 5);
      const keepStep = Math.max(3, Math.round(nR / 4.5));
      for (let k2 = 0; k2 < nR; k2++) {
        const t = ((k2 + 0.5) / nR) * 2 - 1;
        const a = ang0 + t * spread * (0.92 + 0.16 * r());
        const core = Math.abs(t) < 0.42;
        const L = beamLen * (core ? 0.55 + r() * 0.45 : 0.3 + r() * 0.5);
        const ex2 = sx + Math.cos(a) * L, ey = apy + Math.sin(a) * L;
        const pale = core && r() < 0.55;
        const o = (core ? 0.028 + r() * 0.02 : 0.013 + r() * 0.013) * om;
        if (!fuse || k2 % keepStep === 1) {
          cs += `<line x1="${F(sx)}" y1="${F(apy)}" x2="${F(ex2)}" y2="${F(ey)}" stroke="${pale ? c.c : coneCol}" stroke-width="${core ? 1.8 : 1.3}" opacity="${(fuse ? o * 0.5 : o).toFixed(4)}"/>`;
        }
      }
      const aim = Math.max(-38, Math.min(38, Math.atan2(tx - sx, hubY - ty) * 180 / Math.PI));
      let ds = `<line x1="${F(sx - 74)}" y1="${F(baseY)}" x2="${F(sx + 88)}" y2="${F(baseY)}" stroke="${INKS.platinum}" stroke-width="1" opacity="0.16"/>`;
      ds += `<rect x="${F(sx - 3.5)}" y="${F(hubY + 6)}" width="7" height="${F(baseY - hubY - 6)}" fill="${INKS.platinum}" opacity="0.2"/>`;
      ds += `<line x1="${F(sx - 15)}" y1="${F(baseY)}" x2="${F(sx - 3)}" y2="${F(hubY + 16)}" stroke="${INKS.platinum}" stroke-width="1" opacity="0.14"/>`;
      ds += `<g transform="translate(${F(sx)} ${F(hubY)}) rotate(${F(aim)})">`
        + `<path d="M-27 3 Q0 -27 27 3 Q0 13 -27 3 Z" fill="${INKS.platinum}" opacity="0.22"/>`
        + `<line x1="0" y1="-6" x2="0" y2="-27" stroke="${INKS.platinum}" stroke-width="1" opacity="0.28"/>`
        + `<circle cx="0" cy="-30" r="2" fill="${lightCol}" opacity="0.55"/></g>`;
      ds += `<circle cx="${F(sx + 6)}" cy="${F(hubY + 14)}" r="1.8" fill="${lightCol}" opacity="0.5"/>`;
      ds += `<circle cx="${F(sx)}" cy="${F(hubY)}" r="9" fill="${coneCol}" opacity="0.12"/>`;
      return { cs, ds, sx, baseY, hubY };
    };
    const st1 = station((1.5 + r() * 0.14) * W, c.gb, c.a, 1, true);
    const st2 = station((9.38 + r() * 0.13) * W, c.ga, c.b, 1.15, false);
    out += st1.cs + st2.cs;

    // ---- layer F: secondary orbit as jittered pale dashes (fade-in) ----
    let dOn = r() < 0.7, rem = 24 + r() * 40, seg = [];
    for (let i = Math.ceil(xs2 / DS); i < T2.length; i++) {
      const p = T2[i];
      if (dOn) seg.push(p);
      rem -= DS;
      if (rem <= 0) {
        if (dOn && seg.length >= 2) {
          const op = 0.2 * ss((p.x - xs2) / 640);
          if (op > 0.025) {
            let dd = 'M' + F(seg[0].x) + ' ' + F(seg[0].y);
            for (let k = 1; k < seg.length; k++) dd += 'L' + F(seg[k].x) + ' ' + F(seg[k].y);
            out += `<path d="${dd}" fill="none" stroke="${c.c}" stroke-width="1.6" opacity="${op.toFixed(3)}"/>`;
          }
        }
        dOn = !dOn; seg = [];
        rem = dOn ? 26 + r() * 48 : 14 + r() * 26;
      }
    }

    // ---- layer G: the primary ground track (corridor halo + hairline) ----
    let d1c = '';
    for (let i = 0; i < NPT; i += 6) d1c += (i ? 'L' : 'M') + T1[i].x + ' ' + F(T1[i].y);
    out += `<path d="${d1c}" fill="none" stroke="${c.gb}" stroke-width="34" opacity="0.026"/>`;
    out += `<path d="${d1c}" fill="none" stroke="${c.gb}" stroke-width="14" opacity="0.048"/>`;
    let d1 = '';
    for (let i = 0; i < NPT; i += 2) d1 += (i ? 'L' : 'M') + T1[i].x + ' ' + F(T1[i].y);
    out += `<path d="${d1}" fill="none" stroke="${c.gb}" stroke-width="7" opacity="0.06"/>`;
    out += `<path d="${d1}" fill="none" stroke="${c.b}" stroke-width="2.2" opacity="0.42"/>`;

    // ---- layer H: time ticks along the track (thin out with the arc) ----
    for (const txx of schedule(r, SW, 0.16, 0.55)) {
      if (Math.abs(txx - gX) < 420) continue;
      const late = txx > 7.8 * W;
      const roll = r();
      if (late && roll < 0.45) continue;
      const i = Math.round(txx / DS);
      if (i < 2 || i >= NPT - 2) continue;
      const p = T1[i];
      if (r() < 0.3) {
        const q = T1[i + 2], dx = q.x - p.x, dy = q.y - p.y, L = Math.hypot(dx, dy) || 1;
        const ux = dx / L, uy = dy / L, len = 9 + r() * 8, warm = r() < 0.3 && txx < 7.2 * W;
        out += `<line x1="${F(p.x - ux * len)}" y1="${F(p.y - uy * len)}" x2="${F(p.x + ux * len)}" y2="${F(p.y + uy * len)}" stroke="${warm ? c.a : c.gb}" stroke-width="2" opacity="0.3"/>`;
      } else {
        out += `<circle cx="${F(p.x)}" cy="${F(p.y)}" r="${F(1.5 + r())}" fill="${c.gb}" opacity="${(0.16 + r() * 0.12).toFixed(3)}"/>`;
      }
    }

    // ---- layer H2: telemetry handshake on the flattened pass (p9) — a
    //      quiet incident so the calm stretch never goes dead ----
    const hxc = (8.42 + r() * 0.3) * W;
    {
      const i0 = Math.round(hxc / DS), p0 = T1[i0];
      out += `<circle cx="${F(p0.x)}" cy="${F(p0.y)}" r="${F(84 + r() * 30)}" fill="${c.gb}" opacity="${(0.045 * boost).toFixed(3)}" filter="url(#nb-blur)"/>`;
      let off = 0;
      for (let k = 0; k < 3; k++) {
        const p = T1[Math.min(NPT - 1, i0 + Math.round(off / DS))];
        out += `<circle cx="${F(p.x)}" cy="${F(p.y)}" r="${F(1.9 + r() * 0.9)}" fill="${k === 1 ? c.c : c.gb}" opacity="${(0.32 - k * 0.07).toFixed(2)}"/>`;
        off += 44 + r() * 70;
      }
      const pq = T1[Math.min(NPT - 1, i0 + 2)];
      out += `<line x1="${F(p0.x)}" y1="${F(p0.y)}" x2="${F(pq.x)}" y2="${F(pq.y)}" stroke="${c.c}" stroke-width="1.6" opacity="0.3" stroke-linecap="round"/>`;
    }

    // ---- layer I: crossing nodes where the orbits intersect ----
    let prevD = null;
    for (let i = Math.ceil((xs2 + 380) / DS); i < T2.length; i++) {
      const dyy = T1[i].y - T2[i].y;
      if (prevD !== null && ((prevD < 0) !== (dyy < 0)) && Math.abs(T1[i].x - gX) > 320) {
        out += `<circle cx="${F(T1[i].x)}" cy="${F(T1[i].y)}" r="5.5" fill="${c.c}" opacity="0.1"/>`
          + `<circle cx="${F(T1[i].x)}" cy="${F(T1[i].y)}" r="2.3" fill="${c.c}" opacity="0.32"/>`;
      }
      prevD = dyy;
    }

    // ---- layer J: pass echoes — dotted history fading out over p1-2,
    //      dotted "next pass" fading in over p8-10 (the chart breathes) ----
    let hxp = -20 - r() * 40;
    const hEnd = (2.3 + r() * 0.25) * W;
    while (hxp < hEnd) {
      const p = T1[Math.max(0, Math.min(NPT - 1, Math.round(hxp / DS)))];
      const hy = p.cen + p.am * Math.sin(p.ph - 2.15) - 44;
      const op = 0.15 * ss((hEnd - hxp) / (1.15 * W));
      const hued = r() < 0.22;
      if (op > 0.02 && hy > 130 && hy < 1240) out += `<circle cx="${F(hxp)}" cy="${F(hy)}" r="2.1" fill="${hued ? c.gb : INKS.silver}" opacity="${(op * (hued ? 0.85 : 1)).toFixed(3)}"/>`;
      hxp += 27 + r() * 25;
    }
    let gxp = 7.5 * W + r() * 0.2 * W;
    while (gxp < SW - 10) {
      const p = T1[Math.min(NPT - 1, Math.round(gxp / DS))];
      const gy2 = p.cen + p.am * Math.sin(p.ph + 2.35) + 58;
      const op = 0.17 * ss((gxp - 7.5 * W) / (1.1 * W));
      const hued = r() < 0.26;
      if (op > 0.02 && gy2 > 130 && gy2 < 1240) out += `<circle cx="${F(gxp)}" cy="${F(gy2)}" r="2.2" fill="${hued ? c.gb : INKS.silver}" opacity="${(op * (hued ? 0.85 : 1)).toFixed(3)}"/>`;
      gxp += 28 + r() * 24;
    }

    // ---- layer K: THE LANDMARK — satellite glint, trail, footprint ----
    // (v3.2: footprint drawn dashed — real coverage circles are — same ink)
    out += `<ellipse cx="${F(gX)}" cy="${F(gY)}" rx="${F(126 + r() * 40)}" ry="${F(38 + r() * 14)}" fill="none" stroke="${c.gb}" stroke-width="1" stroke-dasharray="7 5" opacity="0.13"/>`;
    out += `<circle cx="${F(gX)}" cy="${F(gY)}" r="${F(180 + r() * 60)}" fill="${c.ga}" opacity="${(0.09 * boost).toFixed(3)}" filter="url(#nb-blur)"/>`;
    let tb = 26 + r() * 14;
    for (let k = 0; k < 9; k++) {
      const p = T1[Math.max(0, gI - Math.round(tb / DS))];
      const f = 1 - k / 9;
      out += `<circle cx="${F(p.x)}" cy="${F(p.y)}" r="${F(1.2 + 2.2 * f)}" fill="${c.gb}" opacity="${(0.08 + 0.45 * f * f).toFixed(3)}"/>`;
      tb += 28 + r() * 34;
    }
    // tapering luminous tail hugging the track behind the bird
    const tailSeg = (iA, iB, w2, o) => {
      let dd = '';
      for (let i = Math.max(0, iA); i <= Math.max(0, iB); i++) dd += (dd ? 'L' : 'M') + F(T1[i].x) + ' ' + F(T1[i].y);
      return `<path d="${dd}" fill="none" stroke="${c.gb}" stroke-width="${w2}" opacity="${o}" stroke-linecap="round"/>`;
    };
    out += tailSeg(gI - 30, gI - 16, 1.3, 0.1) + tailSeg(gI - 17, gI - 8, 1.9, 0.19) + tailSeg(gI - 9, gI - 2, 2.6, 0.32);
    const q1 = T1[Math.max(0, gI - 3)];
    out += `<line x1="${F(q1.x)}" y1="${F(q1.y)}" x2="${F(gX)}" y2="${F(gY)}" stroke="${c.c}" stroke-width="2.4" opacity="0.5" stroke-linecap="round"/>`;
    out += `<line x1="${F(gX - 17)}" y1="${F(gY)}" x2="${F(gX + 17)}" y2="${F(gY)}" stroke="${c.c}" stroke-width="1" opacity="0.32"/>`;
    out += `<line x1="${F(gX)}" y1="${F(gY - 15)}" x2="${F(gX)}" y2="${F(gY + 15)}" stroke="${c.c}" stroke-width="1" opacity="0.32"/>`;
    out += `<circle cx="${F(gX)}" cy="${F(gY)}" r="13" fill="${c.gb}" opacity="0.12"/>`;
    out += `<circle cx="${F(gX)}" cy="${F(gY)}" r="6.2" fill="${c.gb}" opacity="0.26"/>`;
    out += `<circle cx="${F(gX)}" cy="${F(gY)}" r="2.7" fill="${c.c}" opacity="0.6"/>`;

    // ---- layer L: dish silhouettes over everything ----
    out += st1.ds + st2.ds;

    // ================= v3.2 realism + density pass =================
    // Everything below rides independent nr(tag) channels appended after the
    // shipped layers — the r() stream above is byte-identical to round 4, so
    // geometry, stations, landmark and handshake cannot move.

    // (1) chart frame: equator degree-tick stubs + ONE broken prime meridian
    let meridianX = 0;
    {
      const rq = nr(1);
      for (const tq of schedule(rq, SW, 0.35, 0.9)) {
        const keep = 1 - 0.62 * ss((tq - 8.2 * W) / (1.9 * W)); // match equator skip-fade into p8-10
        if (rq() > keep) continue;
        const yq = yEq + (eqN(tq / (1.8 * W)) - 0.5) * 26;
        const tl = 4 + rq() * 2, dn = rq() < 0.72 ? 1 : -1;
        out += `<line x1="${F(tq)}" y1="${F(yq)}" x2="${F(tq)}" y2="${F(yq + dn * tl)}" stroke="${INKS.platinum}" stroke-width="1" opacity="0.09"/>`;
      }
      let mx = (2.7 + (rq() - 0.5) * 0.3) * W;
      const ncut = Math.round(mx / W) * W;
      if (Math.abs(mx - ncut) < 300) mx = ncut + (mx >= ncut ? 300 : -300);
      meridianX = mx;
      let my = 180 + rq() * 55, nseg = 0;
      while (my < 1150 && nseg < 5) {
        const y2m = Math.min(1240, my + 140 + rq() * 220);
        out += `<line x1="${F(mx)}" y1="${F(my)}" x2="${F(mx)}" y2="${F(y2m)}" stroke="${INKS.platinum}" stroke-width="1" opacity="0.07"/>`;
        my = y2m + 55 + rq() * 95; nseg++;
      }
    }

    // (2) graticule densify: extra whisper columns interleaved between the
    // shipped ones (net col spacing ~285px), same cell law + thin() fade
    {
      const rg = nr(2);
      for (const gx2 of schedule(rg, SW, 1.35, 2.95, 2.2)) {
        for (const cy of rows) {
          const p = (0.38 + 0.44 * gratN(gx2 * 0.0011 + cy * 0.017)) * thin(gx2);
          if (rg() > p) continue;
          const roll = rg();
          if (roll < 0.15) {
            const l2 = 6 + rg() * 4;
            out += `<path d="M${F(gx2 - l2)} ${F(cy)}H${F(gx2 + l2)}M${F(gx2)} ${F(cy - l2)}V${F(cy + l2)}" fill="none" stroke="${INKS.silver}" stroke-width="1" opacity="0.10"/>`;
          } else {
            const hueDot = roll > 0.9;
            out += `<circle cx="${F(gx2)}" cy="${F(cy)}" r="${F(1.9 + rg() * 1.3)}" fill="${hueDot ? c.gb : INKS.silver}" opacity="${(hueDot ? 0.09 : 0.065 + rg() * 0.025).toFixed(3)}"/>`;
          }
        }
      }
    }

    // (3) coastline inlet fragments in the empty lower band (p1-2, p8-9, one
    // cluster ~x3.9W) + island archipelago ~x8.3W — neutral ink only
    {
      const rc = nr(3);
      const offCut = (v) => { const nct = Math.round(v / W) * W; return Math.abs(v - nct) < 70 ? nct + (v >= nct ? 90 : -90) : v; };
      for (const [z0, z1] of [[0.12 * W, 1.9 * W], [7.05 * W, 8.9 * W], [3.55 * W, 4.2 * W]]) {
        const n = 2 + Math.floor(rc() * 2);
        for (let f2 = 0; f2 < n; f2++) {
          const len = 300 + rc() * 400;
          let fx = offCut(z0 + rc() * Math.max(60, z1 - z0 - len));
          if (Math.abs(fx + len - Math.round((fx + len) / W) * W) < 70) fx -= 95;
          let fy = 985 + rc() * 215;
          const slope = (rc() - 0.5) * 0.15;
          let dd = 'M' + F(fx) + ' ' + F(fy);
          const steps = Math.floor(len / 46);
          for (let s2 = 1; s2 <= steps; s2++) {
            fy = Math.max(952, Math.min(1248, fy + slope * 46 + (rc() - 0.5) * 26));
            dd += 'L' + F(fx + s2 * 46) + ' ' + F(fy);
          }
          out += `<path d="${dd}" fill="none" stroke="${INKS.platinum}" stroke-width="1" opacity="${(0.06 + rc() * 0.03).toFixed(3)}"/>`;
        }
      }
      const ax = 8.3 * W + (rc() - 0.5) * 0.12 * W;
      const nA = 4 + Math.floor(rc() * 3);
      for (let k = 0; k < nA; k++) out += `<circle cx="${F(ax + (rc() - 0.5) * 210)}" cy="${F(1180 + rc() * 90)}" r="${F(1 + rc())}" fill="${INKS.silver}" opacity="0.07"/>`;
      for (let k = 0; k < 2; k++) {
        const ax2 = ax + (rc() - 0.5) * 190, ay2 = 1195 + rc() * 70, aw = 34 + rc() * 26;
        out += `<path d="M${F(ax2 - aw)} ${F(ay2)}Q${F(ax2)} ${F(ay2 - 9 - rc() * 7)} ${F(ax2 + aw)} ${F(ay2)}" fill="none" stroke="${INKS.platinum}" stroke-width="1" opacity="0.07"/>`;
      }
    }

    // (4) graduated bottom frame edge — aperiodic tick-dash clusters; hued
    // members respect the x<60 / x>10740 edge exclusion and cuts stay clear
    {
      const rf = nr(4);
      for (const cx0 of schedule(rf, SW, 0.5, 1.3)) {
        if (Math.abs(cx0 - Math.round(cx0 / W) * W) < 95) continue;
        const n = 3 + Math.floor(rf() * 5);
        let tx2 = cx0;
        for (let k = 0; k < n; k++) {
          const h2 = 8 + rf() * 4, w2 = rf() < 0.3 ? 2 : 1, yb = 1293 + rf() * 8;
          const hued = rf() < 0.125;
          const op4 = hued ? '0.10' : (0.10 + rf() * 0.03).toFixed(3);
          const dcut = Math.abs(tx2 - Math.round(tx2 / W) * W);
          if (tx2 > 60 && tx2 < SW - 60 && dcut > 26) {
            out += `<rect x="${F(tx2)}" y="${F(yb)}" width="${w2}" height="${F(h2)}" fill="${hued ? c.gb : INKS.platinum}" opacity="${op4}"/>`;
          }
          tx2 += 14 + rf() * 16;
        }
      }
    }

    // (7) sensor-swath corridor paralleling the primary track through p3-4 —
    // neutral whisper hairlines, cosine fade at both ends, clear of the glint
    {
      const rw = nr(7);
      const x0 = 2.4 * W, x1 = Math.min(4.6 * W, gX - 0.62 * W);
      const off = 26 + rw() * 4;
      for (const sgn of [-1, 1]) {
        const pts = [];
        for (let i = Math.ceil(x0 / DS); i <= Math.floor(x1 / DS); i += 2) {
          const p = T1[i], q = T1[Math.max(0, i - 2)];
          const dx = p.x - q.x, dy = p.y - q.y, L2 = Math.hypot(dx, dy) || 1;
          pts.push([p.x - (dy / L2) * off * sgn, p.y + (dx / L2) * off * sgn, p.x]);
        }
        for (let s2 = 0; s2 + 1 < pts.length; s2 += 5) {
          const seg2 = pts.slice(s2, s2 + 6);
          const xm2 = seg2[Math.floor(seg2.length / 2)][2];
          const u = ss((xm2 - x0) / (0.4 * W)) * ss((x1 - xm2) / (0.4 * W));
          if (u < 0.1) continue;
          let dd = '';
          for (const pt of seg2) dd += (dd ? 'L' : 'M') + F(pt[0]) + ' ' + F(pt[1]);
          out += `<path d="${dd}" fill="none" stroke="${INKS.silver}" stroke-width="1" opacity="${(0.05 * u).toFixed(3)}"/>`;
        }
      }
    }

    // (8) westward repeat-pass ghost of the SECOND orbit (p3-5 sky): dotted
    // silver, x-0.32W / y+36, layer F's exact dash cadence — same family
    {
      const rg2 = nr(8);
      const gx0 = 2.05 * W + rg2() * 0.2 * W;
      const gx1 = Math.min(4.98 * W, gX - 0.5 * W);
      let x2 = gx0, on2 = rg2() < 0.7, rem2 = 26 + rg2() * 48;
      while (x2 < gx1) {
        if (on2) {
          const i2 = Math.round((x2 + 0.32 * W) / DS);
          if (i2 >= T2.length) break;
          const gy3 = T2[i2].y + 36;
          const u = ss((x2 - gx0) / (0.35 * W)) * ss((gx1 - x2) / (0.35 * W));
          const op2 = (0.05 + rg2() * 0.02) * u;
          if (op2 > 0.012 && gy3 > 150 && gy3 < 1100) out += `<circle cx="${F(x2)}" cy="${F(gy3)}" r="1.8" fill="${INKS.silver}" opacity="${op2.toFixed(3)}"/>`;
          const st3 = 12 + rg2() * 5;
          x2 += st3; rem2 -= st3;
        } else { x2 += rem2; rem2 = 0; }
        if (rem2 <= 0) { on2 = !on2; rem2 = on2 ? 26 + rg2() * 48 : 14 + rg2() * 26; }
      }
    }

    // (9) ascending/descending node rings where the track crosses the equator
    // (one in p2-3, one in p6-7; >=300px off cuts, >=420px off the glint)
    {
      const rn = nr(9);
      for (const [w0, w1] of [[1.05 * W, 2.95 * W], [5.05 * W, 6.95 * W]]) {
        let pick = -1;
        for (let i = Math.max(1, Math.ceil(w0 / DS)); i <= Math.min(NPT - 1, Math.floor(w1 / DS)); i++) {
          const e0 = yEq + (eqN(T1[i - 1].x / (1.8 * W)) - 0.5) * 26;
          const e1 = yEq + (eqN(T1[i].x / (1.8 * W)) - 0.5) * 26;
          if ((T1[i - 1].y - e0 < 0) !== (T1[i].y - e1 < 0)) {
            const x3 = T1[i].x;
            if (Math.abs(x3 - Math.round(x3 / W) * W) >= 300 && Math.abs(x3 - gX) >= 420) { pick = i; if (rn() < 0.65) break; }
          }
        }
        if (pick < 0) continue;
        const p = T1[pick];
        out += `<circle cx="${F(p.x)}" cy="${F(p.y)}" r="5" fill="none" stroke="${c.c}" stroke-width="1" opacity="0.16"/>`
          + `<line x1="${F(p.x)}" y1="${F(p.y - 4)}" x2="${F(p.x)}" y2="${F(p.y + 4)}" stroke="${INKS.platinum}" stroke-width="1" opacity="0.10"/>`;
      }
    }

    // (10) direction-of-motion chevrons: one on the primary (p3, c.gb 0.22),
    // one on the pale orbit (p4, c.c 0.14) — disambiguates the interleave
    {
      const rv = nr(10);
      const chev = (P, dx, dy, col, op2) => {
        const a = Math.atan2(dy, dx);
        const b1 = a + Math.PI - 0.46, b2 = a - Math.PI + 0.46;
        return `<path d="M${F(P.x + Math.cos(b1) * 9)} ${F(P.y + Math.sin(b1) * 9)}L${F(P.x)} ${F(P.y)}L${F(P.x + Math.cos(b2) * 9)} ${F(P.y + Math.sin(b2) * 9)}" fill="none" stroke="${col}" stroke-width="1.6" opacity="${op2}"/>`;
      };
      let cx1 = (2.66 + rv() * 0.12) * W;
      if (Math.abs(cx1 - meridianX) < 70) cx1 += 115;
      const i1 = Math.round(cx1 / DS);
      out += chev(T1[i1], T1[i1 + 2].x - T1[i1 - 2].x, T1[i1 + 2].y - T1[i1 - 2].y, c.gb, '0.22');
      const i2b = Math.round((3.74 + rv() * 0.12) * W / DS);
      if (i2b + 2 < T2.length) out += chev(T2[i2b], T2[i2b + 2].x - T2[i2b - 2].x, T2[i2b + 2].y - T2[i2b - 2].y, c.c, '0.14');
    }

    // (11) satellite bus anatomy at the glint — solar-panel bars + hairline
    // struts perpendicular to the track, IN PLACE (nothing moves/brightens)
    {
      const tp = T1[Math.min(NPT - 1, gI + 2)], tm = T1[Math.max(0, gI - 2)];
      const nd = Math.atan2(tp.y - tm.y, tp.x - tm.x) * 180 / Math.PI + 90;
      out += `<g transform="translate(${F(gX)} ${F(gY)}) rotate(${F(nd)})">`
        + `<line x1="6" y1="0" x2="10" y2="0" stroke="${c.gb}" stroke-width="1" opacity="0.3"/>`
        + `<line x1="-6" y1="0" x2="-10" y2="0" stroke="${c.gb}" stroke-width="1" opacity="0.3"/>`
        + `<rect x="10" y="-1.5" width="9" height="3" fill="${c.gb}" opacity="0.3"/>`
        + `<rect x="-19" y="-1.5" width="9" height="3" fill="${c.gb}" opacity="0.3"/></g>`;
    }

    // (6) station site anatomy: dashed AOS/LOS visibility half-ellipses at
    // both bases; station 2 gains a radome dome + equipment shed
    {
      const rs2 = nr(6);
      for (const st of [st1, st2]) {
        const rx2 = 200 + rs2() * 60, ry2 = 60 + rs2() * 20;
        out += `<path d="M${F(st.sx - rx2)} ${F(st.baseY)}A${F(rx2)} ${F(ry2)} 0 0 1 ${F(st.sx + rx2)} ${F(st.baseY)}" fill="none" stroke="${INKS.platinum}" stroke-width="1" stroke-dasharray="${F(6 + rs2() * 6)} ${F(8 + rs2() * 9)}" opacity="0.07"/>`;
      }
      const bx = st2.sx + 34 + rs2() * 14;
      out += `<path d="M${F(bx - 10)} ${F(st2.baseY)}A10 10 0 0 1 ${F(bx + 10)} ${F(st2.baseY)}Z" fill="${INKS.platinum}" opacity="0.16"/>`;
      out += `<rect x="${F(st2.sx - 44 - rs2() * 12)}" y="${F(st2.baseY - 8)}" width="14" height="8" fill="${INKS.platinum}" opacity="0.12"/>`;
    }

    // (12) downlink line-of-sight: the bird acquires station 2 before losing
    // the pass — dashed c.c hairline from the handshake sloping down-right,
    // opacity ramping toward the dish, stopping 40px short of the apex
    {
      const rd = nr(12);
      const hp = T1[Math.min(NPT - 1, Math.round(hxc / DS))];
      const dx = st2.sx - hp.x, dy = st2.hubY - 6 - hp.y;
      const L3 = Math.hypot(dx, dy), ux = dx / L3, uy = dy / L3;
      let t3 = 26 + rd() * 16;
      while (t3 < L3 - 40) {
        const t4 = Math.min(L3 - 40, t3 + 10 + rd() * 8);
        out += `<line x1="${F(hp.x + ux * t3)}" y1="${F(hp.y + uy * t3)}" x2="${F(hp.x + ux * t4)}" y2="${F(hp.y + uy * t4)}" stroke="${c.c}" stroke-width="1" opacity="${(0.03 + 0.04 * t3 / L3).toFixed(3)}"/>`;
        t3 = t4 + 9 + rd() * 9;
      }
    }

    return out;
  },
};
})();

STYLE_DEFS["heatmap"] = (function () {
const PAGES = NATIVE_PAGES;
void PAGES;
// heatmap · "die floorplan" · cat: blend
// A silicon die floorplan panorama — one continuous tour across a giant chip.
// Structure is neutral hairline outlines; hue lives only in light: the cobalt
// interconnect spine, amber feed + word-line, lit seams/pins, and ONE hot
// core glowing ga from within.
//
// PAGE MAP (frame k spans x=[k*1080,(k+1)*1080]; all features seed-jittered):
//  1   die edge IO: sparse pad cells + a huge faint periph outline; the
//      interconnect spine enters mid-air and starts its Manhattan run
//  2   last IO pads; block density begins its smooth ramp (x~1850-3150)
//  3   core logic builds: more outlines, partitions, corner brackets
//  4   dense core: companion bus hairlines beside the spine, via farms
//  5   densest logic + a small dotted SRAM foreshadow block low
//  6   LANDMARK hot core block (x~5660-6240, bottom quarter) glowing from
//      within; an amber feed hairline drops from the spine into it
//  7   density eases into the SRAM district; big dotted array (upper half)
//  8   second dotted array (lower half); amber word-line runs the low band
//  9   thinning periphery, right-side IO pads appear
// 10   die edge: pads, double seal-ring hairline (x~10470-10550, off-
//      boundary) with crackstop ticks, faint top/bottom die-edge rules
// Phase transitions are smoothstepped over ranges whose midpoints sit far
// from every k*1080; block edges and spine jogs dodge boundaries by >=16px.
//
// v3.2 ENHANCEMENT PASS — quiet neutral-ink die furniture, top (y<430) /
// bottom (y>900) bands only; landmark geometry, spine path, act envelope
// and the mid-band silence untouched:
//  · LEFT seal ring + crackstop ticks (page 1) mirroring the right one
//  · ordered bond-pad ring runs (pages 1-2 and 9-10, both safe bands)
//  · scribe-street test keys (page 10 street + a page-1 echo): alignment
//    cross, vernier ticks, mini PCM cell with pin ticks
//  · routing-channel hairline groups between macros (pages 3-5)
//  · two one-off power-mesh whisper grids (page 4 top; right of sB low)
//  · ONE clock H-tree (page 4, bottom band)
//  · SRAM periphery anatomy: sense-amp/column-mux strip + row-decoder
//    strip on sA/sB, foreshadow periphery on sC; dot-lattice floor lifted
//  · bit-line stubs off the amber word-line + extra via dots on the spine
//    (texture separates the two warm/cool nets); hot-core glow +0.02 alpha
//  · die-corner crackstop chamfers where the right ring meets edge rules
// All new detail draws from independent RNG channels (seed ^ 0xE7A0) so the
// pre-existing r() stream — and the landmark's cut distance — is frozen.
// (helpers provided by the registry's shared toolkit)
return {
  key: 'heatmap',
  name: 'die floorplan',
  cat: 'blend',
  desc: 'silicon die tour — IO edge, core logic, one hot core, SRAM arrays, seal ring',
  gen(seed, hue) {
    const c = HUES[hue], SW = PAGES * W, boost = glowAlphaBoost(hue);
    const r = mulberry32(seed + 47);
    const nT = valueNoise1D(seed + 101), nM = valueNoise1D(seed + 202), nB = valueNoise1D(seed + 303);
    const nSp = valueNoise1D(seed + 404);
    // v3.2 enhancement channels — independent of r() so the existing jitter
    // stream (and the landmark placement) is byte-frozen
    const rE = mulberry32((seed ^ 0xE7A0) + 5);   // SRAM periphery anatomy
    const rN = mulberry32((seed ^ 0xE7A0) + 11);  // left ring / scribe keys / pad runs / chamfers
    const rC = mulberry32((seed ^ 0xE7A0) + 41);  // routing channels / power mesh / H-tree
    const rB = mulberry32((seed ^ 0xE7A0) + 53);  // bit-line stubs / spine via dots
    const P0 = (v) => v.toFixed(0);
    const sstep = (x, a, b) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
    // arc density envelope — midpoints 2500 / 6850 / 9550, all off-boundary
    const dens = (x) => Math.max(0.06,
      0.16 + 0.68 * sstep(x, 1850, 3150) - 0.22 * sstep(x, 6400, 7300) - 0.5 * sstep(x, 8750, 10350));
    const dodge = (x) => { const m = ((x % W) + W) % W; return m < 40 ? x + 56 : m > W - 40 ? x - 56 : x; };
    const bell = (x, c0, wd) => Math.exp(-((x - c0) * (x - c0)) / (2 * wd * wd));
    let out = '';

    // accent alternator — cap runs of 2 so the blend reads two-hue everywhere
    // (rr param lets v3.2 passes route through the cap on their own channel)
    let accLast = '', accRun = 0;
    const pickAcc = (rr = r) => {
      let col = rr() < 0.5 ? c.a : c.b;
      if (col === accLast && accRun >= 2) col = col === c.a ? c.b : c.a;
      if (col === accLast) accRun++; else { accLast = col; accRun = 1; }
      return col;
    };

    // ---- landmark + district geometry (fixed early so structure dodges it)
    const hw = 390 + r() * 130;
    const hx = 5650 + r() * (6235 - hw - 5650);       // whole block >=0.26W off boundaries
    const hy = 950 + r() * 70, hh = 260 + r() * 60;   // bottom quarter
    const hcx = hx + hw / 2;
    // SRAM district: A upper (pages ~7), B lower (~8), C small foreshadow (~5)
    const sA = [6820 + r() * 240, 115 + r() * 85, 950 + r() * 300, 430 + r() * 160, 'top'];
    const sB = [7660 + r() * 260, 850 + r() * 80, 800 + r() * 300, 0, 'bot'];
    sB[3] = Math.min(370 + r() * 90, 1300 - sB[1]);
    const sC = [4310 + r() * 380, 1015 + r() * 100, 380 + r() * 150, 0, 'bot'];
    sC[3] = Math.min(210 + r() * 60, 1300 - sC[1]);
    const srams = [sA, sB, sC];
    const inKeepout = (xc, yc, bw, bh) => {
      const hw2 = (bw || 0) / 2, hh2 = (bh || 0) / 2;
      // hot core: reject any body overlap with its breathing room
      if (xc + hw2 > hx - 280 && xc - hw2 < hx + hw + 280 && yc + hh2 > hy - 300) return true;
      for (const s of srams) if (xc > s[0] - 70 && xc < s[0] + s[2] + 70 && yc > s[1] - 60 && yc < s[1] + s[3] + 60) return true;
      return false;
    };

    // ---- ambient light: two whisper-cool pools (core + SRAM activity),
    // kept far below the hot-core landmark so it stays the one bright thing
    out += `<circle cx="${P0(3250 + r() * 650)}" cy="${P0(130 + r() * 130)}" r="${P0(270 + r() * 60)}" fill="${c.gb}" opacity="${((0.05 + r() * 0.012) * boost).toFixed(3)}" filter="url(#nb-blur)"/>`;
    out += `<circle cx="${P0(7350 + r() * 550)}" cy="${P0(160 + r() * 140)}" r="${P0(250 + r() * 70)}" fill="${c.gb}" opacity="${((0.048 + r() * 0.012) * boost).toFixed(3)}" filter="url(#nb-blur)"/>`;

    // ---- FAR layer: huge whisper outlines (die-scale hierarchy)
    for (const fx of schedule(r, SW, 1.05, 2.5)) {
      if (fx > 9650) { r(); r(); continue; }
      const fw = 900 + r() * 1050, fh = 520 + r() * 540;
      const fy = 65 + r() * Math.max(10, 1285 - fh - 65);
      out += `<rect x="${P0(dodge(fx))}" y="${P0(fy)}" width="${P0(fw)}" height="${P0(fh)}" fill="none" stroke="${INKS.platinum}" stroke-width="1" opacity="${(0.06 + r() * 0.02).toFixed(3)}"/>`;
    }

    // ---- block builder (outline + optional partition/brackets/inset/accent)
    const drawBlock = (x, y, w, h, op, dloc) => {
      const x1 = dodge(x), x2 = dodge(x + w), ww = x2 - x1;
      out += `<rect x="${P0(x1)}" y="${P0(y)}" width="${P0(ww)}" height="${P0(h)}" fill="none" stroke="${INKS.platinum}" stroke-width="1" opacity="${op.toFixed(3)}"/>`;
      if (r() < 0.36 && ww > 230 && h > 150) {          // one Manhattan partition
        if (r() < 0.6) {
          const px = x1 + ww * (0.28 + r() * 0.44);
          out += `<line x1="${P0(px)}" y1="${P0(y)}" x2="${P0(px)}" y2="${P0(y + h)}" stroke="${INKS.platinum}" stroke-width="1" opacity="${(op * 0.85).toFixed(3)}"/>`;
        } else {
          const py = y + h * (0.3 + r() * 0.4);
          out += `<line x1="${P0(x1)}" y1="${P0(py)}" x2="${P0(x1 + ww)}" y2="${P0(py)}" stroke="${INKS.platinum}" stroke-width="1" opacity="${(op * 0.85).toFixed(3)}"/>`;
        }
      }
      if (r() < 0.32 && ww > 120 && h > 100) {          // layout corner brackets
        const l = Math.min(30, ww * 0.18, h * 0.18);
        const bo = Math.min(0.26, op + 0.09).toFixed(3);
        out += `<path d="M${P0(x1)} ${P0(y + l)}V${P0(y)}H${P0(x1 + l)}" fill="none" stroke="${INKS.silver}" stroke-width="1" opacity="${bo}"/>`;
        out += `<path d="M${P0(x2)} ${P0(y + h - l)}V${P0(y + h)}H${P0(x2 - l)}" fill="none" stroke="${INKS.silver}" stroke-width="1" opacity="${bo}"/>`;
      }
      if (r() < 0.22 && ww > 260 && h > 180) {          // nested inset macro
        const ins = 18 + r() * 26;
        out += `<rect x="${P0(x1 + ins)}" y="${P0(y + ins)}" width="${P0(ww - 2 * ins)}" height="${P0(h - 2 * ins)}" fill="none" stroke="${INKS.platinum}" stroke-width="1" opacity="${(op * 0.75).toFixed(3)}"/>`;
      }
      if (r() < 0.11 + 0.15 * dloc) {                    // lit seam or pin ticks
        const topSafe = y < 330, botSafe = y + h > 1015;
        if (topSafe || botSafe) {
          const ey = topSafe ? y : y + h;
          if (r() < 0.55) {                              // partial lit seam
            const col = pickAcc();
            const sx0 = x1 + 8 + r() * ww * 0.2, sl = ww * (0.3 + r() * 0.45);
            out += `<line x1="${P0(sx0)}" y1="${P0(ey)}" x2="${P0(Math.min(sx0 + sl, x2 - 8))}" y2="${P0(ey)}" stroke="${col}" stroke-width="1.2" opacity="${(0.26 + r() * 0.14).toFixed(3)}"/>`;
          } else {                                       // pin ticks, jittered
            const col = r() < 0.35 ? INKS.silver : pickAcc();
            const po = col === INKS.silver ? 0.22 : 0.3;
            let px = x1 + 18 + r() * 50, np = 0;
            while (px < x2 - 20 && np < 9) {
              out += `<rect x="${P0(px)}" y="${P0(topSafe ? ey - 9 : ey + 1)}" width="3" height="8" fill="${col}" opacity="${po}"/>`;
              px += 26 + r() * 58; np++;
            }
          }
        }
      }
    };

    // ---- MID layer: three independent lanes of macro blocks
    const lanes = [
      { top: 58, bot: 425, h0: 150, h1: 190, op: 0.14, k: 1.0, n: nT },
      { top: 430, bot: 900, h0: 180, h1: 230, op: 0.085, k: 0.6, n: nM },
      { top: 905, bot: 1296, h0: 160, h1: 190, op: 0.14, k: 1.0, n: nB },
    ];
    for (const L of lanes) {
      let x = -320 + r() * 500;
      while (x < SW + 200) {
        const dloc = dens(x + 200);
        let w = 140 + Math.pow(r(), 1.7) * 680;
        if (r() < 0.1) w *= 1.9;
        const gap = (40 + Math.pow(r(), 1.4) * 480) * Math.max(0.25, 1.5 - 1.35 * dloc);
        const h = L.h0 + r() * L.h1;
        const y0 = L.top + r() * Math.max(4, L.bot - L.top - h);
        const pres = (0.15 + 0.9 * dloc) * L.k * (0.7 + 0.6 * L.n(x / 1500));
        const ko = inKeepout(x + w / 2, y0 + h / 2, w, h);
        if (r() < pres && !(ko && r() < 0.8)) {
          drawBlock(x, y0, w, h, L.op * (0.8 + 0.5 * r()), dloc);
        }
        x += w + gap;
      }
    }
    // core clutter: extra mid-size blocks only where the die is dense
    for (const cx2 of schedule(r, SW, 0.3, 0.85)) {
      const dl = dens(cx2);
      if (dl < 0.55 || r() > dl) { r(); r(); continue; }
      const w = 120 + r() * 320, h = 90 + r() * 190;
      let y0 = r() < 0.5 ? 70 + r() * 320 : 900 + r() * 340;
      y0 = Math.min(y0, 1318 - h);
      if (inKeepout(cx2 + w / 2, y0 + h / 2, w, h)) continue;
      drawBlock(cx2, y0, w, h, 0.12 + r() * 0.06, dl);
    }
    // occasional TALL blocks breaking the lane logic (hugely varied sizes)
    for (const tx of schedule(r, SW, 1.5, 3.2)) {
      if (dens(tx) < 0.32 || (tx > 5450 && tx < 6500)) { r(); r(); r(); continue; }
      const w = 300 + r() * 420, h = 520 + r() * 480;
      const y0 = 80 + r() * (1290 - 80 - h);
      if (!inKeepout(tx + w / 2, y0 + h / 2, w, h)) drawBlock(tx, y0, w, h, 0.095, dens(tx));
    }
    // tiny standard-cell stubs
    for (const tx of schedule(r, SW, 0.35, 1.0)) {
      const dl = dens(tx);
      if (r() > dl * 1.4) continue;
      const tw = 66 + r() * 110, th = 56 + r() * 96;
      let ty = r() < 0.5 ? 90 + r() * 300 : 880 + r() * 380;
      ty = Math.min(ty, 1320 - th);
      if (inKeepout(tx + tw / 2, ty + th / 2, tw, th)) continue;
      drawBlock(tx, ty, tw, th, 0.18, dl);
    }
    // via farms — small dot clusters in the dense core
    for (const vx of schedule(r, SW, 0.8, 2.0)) {
      if (dens(vx) < 0.45 || Math.abs(vx - hcx) < 560) { r(); continue; }
      const n = 4 + Math.floor(r() * 4);
      const cy = r() < 0.5 ? 120 + r() * 200 : 1040 + r() * 220;
      for (let i = 0; i < n; i++) {
        out += `<circle cx="${P0(vx + (r() - 0.5) * 110)}" cy="${P0(cy + (r() - 0.5) * 90)}" r="1.5" fill="${INKS.platinum}" opacity="0.20"/>`;
      }
    }

    // ---- SRAM arrays: outlines + jittered dot lattices (pitch >= ~47px)
    const drawSram = (s, fore, seamCol) => {
      const [x, y, w, h, band] = s;
      const oo = fore ? 0.13 : 0.17;
      out += `<rect x="${P0(dodge(x))}" y="${P0(y)}" width="${P0(w)}" height="${P0(h)}" fill="none" stroke="${INKS.platinum}" stroke-width="1.1" opacity="${oo}"/>`;
      out += `<rect x="${P0(x + 13)}" y="${P0(y + 13)}" width="${P0(w - 26)}" height="${P0(h - 26)}" fill="none" stroke="${INKS.platinum}" stroke-width="1" opacity="${(oo * 0.6).toFixed(3)}"/>`;
      if (!fore) {
        // bank grid: two vertical + one horizontal partition, jittered
        const px1 = x + w * (0.26 + r() * 0.14), px2 = x + w * (0.6 + r() * 0.16);
        out += `<line x1="${P0(px1)}" y1="${P0(y)}" x2="${P0(px1)}" y2="${P0(y + h)}" stroke="${INKS.platinum}" stroke-width="1" opacity="0.13"/>`;
        out += `<line x1="${P0(px2)}" y1="${P0(y)}" x2="${P0(px2)}" y2="${P0(y + h)}" stroke="${INKS.platinum}" stroke-width="1" opacity="0.13"/>`;
        const py = y + h * (0.4 + r() * 0.25);
        out += `<line x1="${P0(x)}" y1="${P0(py)}" x2="${P0(x + w)}" y2="${P0(py)}" stroke="${INKS.platinum}" stroke-width="1" opacity="0.11"/>`;
        const ey = band === 'top' ? y : y + h;
        const sx0 = x + 14 + r() * w * 0.25, sl = w * (0.3 + r() * 0.4);
        out += `<line x1="${P0(sx0)}" y1="${P0(ey)}" x2="${P0(sx0 + sl)}" y2="${P0(ey)}" stroke="${seamCol}" stroke-width="1.3" opacity="${(0.3 + r() * 0.12).toFixed(3)}"/>`;
        // v3.2 SRAM macro periphery (rE channel): sense-amp/column-mux strip
        // along a long edge + row-decoder strip along one short edge. Kept
        // out of the y 430-900 text band — a top-lane array whose core-facing
        // (bottom) edge dips into the band hosts its strip on the TOP edge.
        const saH = 22 + rE() * 8;
        const saY = band === 'top' ? (y + h + 4 + saH < 430 ? y + h - 4 - saH : y + 4) : y + 4;
        out += `<rect x="${P0(x + 16)}" y="${P0(saY)}" width="${P0(w - 32)}" height="${P0(saH)}" fill="none" stroke="${INKS.platinum}" stroke-width="1" opacity="0.14"/>`;
        const nct = 6 + Math.floor(rE() * 5);
        let ctx2 = x + 30 + rE() * 40;
        for (let i = 0; i < nct && ctx2 < x + w - 26; i++) {
          out += `<line x1="${P0(ctx2)}" y1="${P0(saY + 3)}" x2="${P0(ctx2)}" y2="${P0(saY + saH - 3)}" stroke="${INKS.platinum}" stroke-width="1" opacity="0.14"/>`;
          ctx2 += (w - 70) / nct * (0.82 + rE() * 0.36);
        }
        const rdX = rE() < 0.5 ? x + 4 : x + w - 22;
        const rdY0 = y + 4;
        const rdY1 = band === 'top' ? Math.min(y + h - 4, 424) : y + h - 4;
        if (rdY1 - rdY0 > 60) out += `<rect x="${P0(rdX)}" y="${P0(rdY0)}" width="18" height="${P0(rdY1 - rdY0)}" fill="none" stroke="${INKS.platinum}" stroke-width="1" opacity="0.13"/>`;
      } else {
        // v3.2 foreshadow periphery (sC): one sense-amp strip hairline + two
        // bank straps at reduced op, so page 5 reads as 'first SRAM'
        const fsH = 20 + rE() * 6;
        out += `<rect x="${P0(x + 15)}" y="${P0(y + 4)}" width="${P0(w - 30)}" height="${P0(fsH)}" fill="none" stroke="${INKS.platinum}" stroke-width="1" opacity="0.12"/>`;
        const fb1 = x + w * (0.3 + rE() * 0.1), fb2 = x + w * (0.62 + rE() * 0.12);
        out += `<line x1="${P0(fb1)}" y1="${P0(y)}" x2="${P0(fb1)}" y2="${P0(y + h)}" stroke="${INKS.platinum}" stroke-width="1" opacity="0.12"/>`;
        out += `<line x1="${P0(fb2)}" y1="${P0(y)}" x2="${P0(fb2)}" y2="${P0(y + h)}" stroke="${INKS.platinum}" stroke-width="1" opacity="0.12"/>`;
      }
      const pitch = 50 + r() * 14;
      for (let yy = y + 30 + r() * 12; yy < y + h - 24; yy += pitch * (0.92 + r() * 0.16)) {
        for (let xx = x + 26 + r() * pitch * 0.5; xx < x + w - 22; xx += pitch * (0.9 + r() * 0.2)) {
          if (r() < 0.17) continue;
          const dy = yy + (r() - 0.5) * 10;
          const hot = !fore && (band === 'top' ? dy < 332 : dy > 1013) && r() < 0.06;
          if (hot) out += `<circle cx="${P0(xx)}" cy="${P0(dy)}" r="2" fill="${pickAcc()}" opacity="0.34"/>`;
          else out += `<circle cx="${P0(xx)}" cy="${P0(dy)}" r="${(1.9 + r() * 0.7).toFixed(1)}" fill="${INKS.platinum}" opacity="${(0.20 + r() * 0.07).toFixed(3)}"/>`;
        }
      }
    };
    drawSram(sC, true, c.a);
    drawSram(sA, false, c.b);
    drawSram(sB, false, c.a);

    // ---- interconnect spine: one Manhattan hairline across the whole die
    const spineYat = (x) => {
      const v = 195 + nSp(x / 2100) * 715;
      const p = bell(x, hcx, 800);              // ease toward the hot core feed height
      return v * (1 - p) + 645 * p;
    };
    const spineStart = 140 + r() * 260;       // enter mid-air, clear of the x<60 edge ban
    let sx = spineStart, sy = spineYat(spineStart);
    const entryY = sy;
    let dP = `M${P0(sx)} ${P0(sy)}`;
    const runs = [], viasB = [];
    const spineEnd = SW - 300 - r() * 140;
    for (;;) {
      let nx = sx + 430 + Math.pow(r(), 1.3) * 1050;
      if (nx >= spineEnd - 140) nx = spineEnd;
      nx = dodge(nx);
      dP += `H${P0(nx)}`;
      runs.push([sx, nx, sy]);
      if (nx >= spineEnd - 30) break;
      let ny = spineYat(nx);
      if (Math.abs(ny - sy) < 60) ny = sy + (ny >= sy ? 1 : -1) * (80 + r() * 150);
      ny = Math.max(150, Math.min(1180, ny));
      dP += `V${P0(ny)}`;
      viasB.push([nx, r() < 0.55 ? sy : ny]);
      sx = nx; sy = ny;
    }
    out += `<path d="${dP}" fill="none" stroke="${c.b}" stroke-width="1.2" opacity="0.32"/>`;
    for (const [vx, vy] of viasB) out += `<circle cx="${P0(vx)}" cy="${P0(vy)}" r="2.1" fill="${c.b}" opacity="0.5"/>`;
    // companion bus hairlines in the dense core only
    for (const [a0, a1, ay] of runs) {
      if (a0 > 2250 && a1 < 6600 && a1 - a0 > 450 && r() < 0.65) {
        out += `<line x1="${P0(a0 + 46)}" y1="${P0(ay + 9)}" x2="${P0(a1 - 46)}" y2="${P0(ay + 9)}" stroke="${c.b}" stroke-width="1" opacity="0.16"/>`;
      }
    }
    // spine entry: tiny IO pad square marking where the spine enters mid-air
    out += `<rect x="${P0(spineStart - 16)}" y="${P0(entryY - 8)}" width="16" height="16" fill="none" stroke="${c.b}" stroke-width="1.1" opacity="0.42"/>`;
    out += `<circle cx="${P0(spineStart - 8)}" cy="${P0(entryY)}" r="1.8" fill="${c.b}" opacity="0.5"/>`;
    // spine terminal: tiny IO pad square just before the seal ring
    out += `<rect x="${P0(spineEnd)}" y="${P0(sy - 8)}" width="16" height="16" fill="none" stroke="${c.b}" stroke-width="1.1" opacity="0.42"/>`;
    out += `<circle cx="${P0(spineEnd + 8)}" cy="${P0(sy)}" r="1.8" fill="${c.b}" opacity="0.5"/>`;
    // amber feed: drops from the spine into the hot core
    const bx0 = dodge(hx + hw * (0.3 + r() * 0.4));
    let runY = 640;
    for (const rn of runs) if (bx0 >= rn[0] && bx0 <= rn[1]) { runY = rn[2]; break; }
    out += `<line x1="${P0(bx0)}" y1="${P0(runY + 3)}" x2="${P0(bx0)}" y2="${P0(hy)}" stroke="${c.a}" stroke-width="1.2" opacity="0.38"/>`;
    out += `<circle cx="${P0(bx0)}" cy="${P0(runY)}" r="2.2" fill="${c.a}" opacity="0.5"/>`;
    out += `<circle cx="${P0(bx0)}" cy="${P0(hy)}" r="2" fill="${c.a}" opacity="0.45"/>`;

    // ---- amber word-line: low band through the SRAM district (pages 7-9)
    let ax = 6560 + r() * 320, ay = 1120 + r() * 130;
    let aP = `M${P0(ax)} ${P0(ay)}`;
    const aEnd = 9750 + r() * 420, viasA = [], aRuns = [];
    for (;;) {
      let nx = ax + 420 + Math.pow(r(), 1.3) * 680;
      if (nx >= aEnd - 300) nx = aEnd;
      nx = dodge(nx);
      aP += `H${P0(nx)}`;
      aRuns.push([ax, nx, ay]);            // v3.2: capture for bit-line stubs
      if (nx >= aEnd - 60) { ax = nx; break; }
      let ny = Math.max(1055, Math.min(1290, ay + (r() < 0.5 ? -1 : 1) * (45 + r() * 110)));
      if (Math.abs(ny - ay) < 25) ny = Math.min(1290, ay + 60);
      aP += `V${P0(ny)}`;
      viasA.push([nx, r() < 0.5 ? ay : ny]);
      ax = nx; ay = ny;
    }
    out += `<path d="${aP}" fill="none" stroke="${c.a}" stroke-width="1.1" opacity="0.30"/>`;
    for (const [vx, vy] of viasA) out += `<circle cx="${P0(vx)}" cy="${P0(vy)}" r="1.9" fill="${c.a}" opacity="0.42"/>`;
    out += `<rect x="${P0(ax)}" y="${P0(ay - 7)}" width="14" height="14" fill="none" stroke="${c.a}" stroke-width="1.1" opacity="0.38"/>`;

    // ---- LANDMARK: the one hot core, glowing ga from within (bottom quarter)
    const gcx = hx + hw / 2, gcy = hy + hh * 0.55;
    out += `<circle cx="${P0(gcx)}" cy="${P0(gcy)}" r="${P0(350 + r() * 50)}" fill="${c.ga}" opacity="${((0.10 + r() * 0.02) * boost).toFixed(3)}" filter="url(#nb-blur)"/>`;
    out += `<circle cx="${P0(gcx + (r() - 0.5) * 60)}" cy="${P0(gcy + 20)}" r="160" fill="${c.ga}" opacity="${(0.095 * boost).toFixed(3)}" filter="url(#nb-blur)"/>`;
    out += `<rect x="${P0(hx)}" y="${P0(hy)}" width="${P0(hw)}" height="${P0(hh)}" fill="none" stroke="${c.a}" stroke-width="1.3" opacity="0.30"/>`;
    out += `<rect x="${P0(hx + 24)}" y="${P0(hy + 24)}" width="${P0(hw - 48)}" height="${P0(hh - 48)}" fill="none" stroke="${c.a}" stroke-width="1" opacity="0.15"/>`;
    const pp1 = hx + hw * (0.3 + r() * 0.12), pp2 = hx + hw * (0.62 + r() * 0.12);
    out += `<line x1="${P0(pp1)}" y1="${P0(hy)}" x2="${P0(pp1)}" y2="${P0(hy + hh)}" stroke="${INKS.platinum}" stroke-width="1" opacity="0.18"/>`;
    out += `<line x1="${P0(pp2)}" y1="${P0(hy)}" x2="${P0(pp2)}" y2="${P0(hy + hh)}" stroke="${INKS.platinum}" stroke-width="1" opacity="0.18"/>`;
    const nvc = 9 + Math.floor(r() * 5);
    for (let i = 0; i < nvc; i++) {
      out += `<circle cx="${P0(gcx + (r() - 0.5) * hw * 0.55)}" cy="${P0(hy + hh * (0.3 + r() * 0.55))}" r="${(1.6 + r() * 0.8).toFixed(1)}" fill="${c.ga}" opacity="${(0.34 + r() * 0.12).toFixed(3)}"/>`;
    }
    const st1 = hx + hw * (0.14 + r() * 0.1), st2 = hx + hw * (0.82 + r() * 0.08);
    out += `<line x1="${P0(st1)}" y1="${P0(hy)}" x2="${P0(st1)}" y2="${P0(hy + 34 + r() * 30)}" stroke="${c.a}" stroke-width="1.2" opacity="0.3"/>`;
    out += `<line x1="${P0(st2)}" y1="${P0(hy)}" x2="${P0(st2)}" y2="${P0(hy + 34 + r() * 30)}" stroke="${c.a}" stroke-width="1.2" opacity="0.3"/>`;

    // ---- IO pads: loose columns near the left die edge, a few at the right
    const pad = (x, y, rr = r, acc = null) => {   // v3.2: rr/acc for ring runs
      const wp = 62 + rr() * 30, hp = 96 + rr() * 42;
      const yy = Math.min(y, 1330 - hp);
      out += `<rect x="${P0(dodge(x))}" y="${P0(yy)}" width="${P0(wp)}" height="${P0(hp)}" fill="none" stroke="${INKS.platinum}" stroke-width="1" opacity="0.17"/>`;
      out += `<rect x="${P0(x + 12)}" y="${P0(yy + 12)}" width="${P0(wp - 24)}" height="${P0(hp - 24)}" fill="none" stroke="${INKS.platinum}" stroke-width="1" opacity="0.12"/>`;
      out += `<circle cx="${P0(x + wp / 2)}" cy="${P0(yy + hp / 2)}" r="2.2" fill="${INKS.silver}" opacity="0.22"/>`;
      if (acc === null ? rr() < 0.5 : acc) out += `<rect x="${P0(x + wp - 1)}" y="${P0(yy + hp * 0.4)}" width="9" height="3" fill="${pickAcc(rr)}" opacity="0.35"/>`;
    };
    const nlp = 6 + Math.floor(r() * 3);
    for (let i = 0; i < nlp; i++) {
      pad(90 + Math.pow(r(), 1.6) * 1900, r() < 0.55 ? 95 + r() * 240 : 990 + r() * 240);
    }
    const nrp = 4 + Math.floor(r() * 2);
    for (let i = 0; i < nrp; i++) {
      pad(10060 + r() * 320, r() < 0.5 ? 110 + r() * 220 : 1000 + r() * 220);
    }

    // ---- seal ring: double hairline near the right die edge + crackstop ticks
    const s1 = SW - 250 - r() * 60, s2 = s1 - 38 - r() * 26;
    out += `<line x1="${P0(s1)}" y1="-20" x2="${P0(s1)}" y2="${H + 20}" stroke="${INKS.silver}" stroke-width="1.3" opacity="0.30"/>`;
    out += `<line x1="${P0(s2)}" y1="-20" x2="${P0(s2)}" y2="${H + 20}" stroke="${INKS.platinum}" stroke-width="1" opacity="0.16"/>`;
    const ntk = 6 + Math.floor(r() * 4);
    for (let i = 0; i < ntk; i++) {
      const ty = 60 + r() * 1230;
      out += `<line x1="${P0(s2 + 4)}" y1="${P0(ty)}" x2="${P0(s1 - 4)}" y2="${P0(ty)}" stroke="${INKS.platinum}" stroke-width="1" opacity="0.22"/>`;
    }
    // faint die-edge rules running off the canvas top/bottom right
    // (coords hoisted IN DRAW ORDER — v3.2 chamfers reuse the intersections)
    const e1x = 9280 + r() * 300, e1a = 30 + r() * 12, e1b = 30 + r() * 12;
    out += `<line x1="${P0(e1x)}" y1="${P0(e1a)}" x2="${SW + 40}" y2="${P0(e1b)}" stroke="${INKS.silver}" stroke-width="1" opacity="0.10"/>`;
    const e2x = 9350 + r() * 300, e2a = H - 30 - r() * 12, e2b = H - 30 - r() * 12;
    out += `<line x1="${P0(e2x)}" y1="${P0(e2a)}" x2="${SW + 40}" y2="${P0(e2b)}" stroke="${INKS.silver}" stroke-width="1" opacity="0.10"/>`;

    // ================= v3.2 enhancement passes (independent RNG channels;
    // appended after all r() draws so the existing stream is frozen) =======

    // ---- LEFT seal ring (page 1): mirrors the right ring so page 1 reads
    // as a die edge, not open space. Neutral ink only, all geometry x>=80.
    const l1 = 148 + rN() * 20;                       // silver outer, x≈160
    const l2 = Math.max(82, l1 - 38 - rN() * 26);     // platinum inner, x≈115
    out += `<line x1="${P0(l1)}" y1="-20" x2="${P0(l1)}" y2="${H + 20}" stroke="${INKS.silver}" stroke-width="1.3" opacity="0.28"/>`;
    out += `<line x1="${P0(l2)}" y1="-20" x2="${P0(l2)}" y2="${H + 20}" stroke="${INKS.platinum}" stroke-width="1" opacity="0.15"/>`;
    const nlt = 5 + Math.floor(rN() * 4);             // 5-8 crackstop ticks
    for (let i = 0; i < nlt; i++) {
      const ty = 60 + rN() * 1230;
      out += `<line x1="${P0(l2 + 4)}" y1="${P0(ty)}" x2="${P0(l1 - 4)}" y2="${P0(ty)}" stroke="${INKS.platinum}" stroke-width="1" opacity="0.20"/>`;
    }

    // ---- scribe-street process-control keys (page 10, between the right
    // ring and x<=10740; one neutral echo on page 1 outside the left ring)
    const acx = Math.min(s1 + 60 + rN() * 80, 10716), acy = 110 + rN() * 170, acs = 9 + rN() * 3;
    out += `<line x1="${P0(acx - acs)}" y1="${P0(acy)}" x2="${P0(acx + acs)}" y2="${P0(acy)}" stroke="${INKS.platinum}" stroke-width="1" opacity="0.18"/>`;
    out += `<line x1="${P0(acx)}" y1="${P0(acy - acs)}" x2="${P0(acx)}" y2="${P0(acy + acs)}" stroke="${INKS.platinum}" stroke-width="1" opacity="0.18"/>`;
    let vnx = s1 + 46 + rN() * 60;
    const vny = 1050 + rN() * 70, vnn = 5 + Math.floor(rN() * 3);
    for (let i = 0; i < vnn && vnx < 10730; i++) {
      out += `<line x1="${P0(vnx)}" y1="${P0(vny)}" x2="${P0(vnx)}" y2="${P0(vny + 16)}" stroke="${INKS.platinum}" stroke-width="1" opacity="0.16"/>`;
      vnx += 6 + rN() * 2;
    }
    const pmx = Math.min(s1 + 40 + rN() * 80, 10740 - 64), pmy = 1170 + rN() * 90;
    out += `<rect x="${P0(pmx)}" y="${P0(pmy)}" width="60" height="40" fill="none" stroke="${INKS.platinum}" stroke-width="1" opacity="${(0.16 + rN() * 0.04).toFixed(3)}"/>`;
    const npin = 4 + Math.floor(rN() * 3);
    for (let i = 0; i < npin; i++) {
      out += `<rect x="${P0(pmx + 7 + i * (48 / npin) + rN() * 3)}" y="${P0(pmy + 41)}" width="3" height="6" fill="${INKS.platinum}" opacity="0.18"/>`;
    }
    const eh = (l2 - 80) / 2;                          // page-1 echo street half-width
    if (eh > 12) {
      const exc = 80 + eh, exs = Math.min(10, eh - 5), eyc = 150 + rN() * 140;
      out += `<line x1="${P0(exc - exs)}" y1="${P0(eyc)}" x2="${P0(exc + exs)}" y2="${P0(eyc)}" stroke="${INKS.platinum}" stroke-width="1" opacity="0.16"/>`;
      out += `<line x1="${P0(exc)}" y1="${P0(eyc - exs)}" x2="${P0(exc)}" y2="${P0(eyc + exs)}" stroke="${INKS.platinum}" stroke-width="1" opacity="0.16"/>`;
    }
    let evx = 84;
    const evy = 1090 + rN() * 130;
    for (let i = 0; i < 5 && evx < l2 - 6; i++) {
      out += `<line x1="${P0(evx)}" y1="${P0(evy)}" x2="${P0(evx)}" y2="${P0(evy + 14)}" stroke="${INKS.platinum}" stroke-width="1" opacity="0.15"/>`;
      evx += 6 + rN() * 2;
    }

    // ---- die-corner crackstop chamfers where the right ring crosses the
    // faint die-edge rules (sells 'die corner' at thumbnail scale)
    const eyT = e1a + (e1b - e1a) * ((s1 - e1x) / (SW + 40 - e1x));
    const eyB = e2a + (e2b - e2a) * ((s1 - e2x) / (SW + 40 - e2x));
    const chT = 12 + rN() * 6, chB = 12 + rN() * 6;
    out += `<line x1="${P0(s1 - chT)}" y1="${P0(eyT)}" x2="${P0(s1)}" y2="${P0(eyT + chT)}" stroke="${INKS.silver}" stroke-width="1" opacity="0.18"/>`;
    out += `<line x1="${P0(s1 - chB)}" y1="${P0(eyB)}" x2="${P0(s1)}" y2="${P0(eyB - chB)}" stroke="${INKS.silver}" stroke-width="1" opacity="0.18"/>`;

    // ---- ordered bond-pad ring runs: perimeter IO rows at jittered pitch
    // (pages 1-2 and 9-10, both safe bands; at most one accent stub per run)
    const padRun = (x0, y0, n, xMax) => {
      const accIdx = rN() < 0.7 ? Math.floor(rN() * n) : -1;
      let px = x0;
      for (let i = 0; i < n && px < xMax; i++) {
        pad(px, y0 + (rN() - 0.5) * 16, rN, i === accIdx);
        px += 104 + rN() * 44;                         // pad w + gap ~26-60, jitter >12%
      }
    };
    padRun(250 + rN() * 160, 100 + rN() * 90, 4 + Math.floor(rN() * 2), 1900);
    padRun(640 + rN() * 260, 1045 + rN() * 130, 3 + Math.floor(rN() * 3), 1900);
    padRun(1290 + rN() * 240, rN() < 0.5 ? 105 + rN() * 90 : 1060 + rN() * 120, 3 + Math.floor(rN() * 2), 1980);
    padRun(9730 + rN() * 150, 110 + rN() * 90, 3 + Math.floor(rN() * 2), s2 - 120);
    padRun(9960 + rN() * 170, 1050 + rN() * 120, 3 + Math.floor(rN() * 2), s2 - 120);

    // ---- routing channels: grouped parallel hairlines in the macro gaps of
    // pages 3-5 (top/bottom bands only, keepouts + seam dodge respected)
    let nrg = 0;
    for (const gx of schedule(rC, SW, 0.34, 0.8)) {
      if (gx < 2300 || gx > 5000 || nrg >= 6) continue;
      const len = 180 + rC() * 240;
      if (gx + len > 5440) continue;                   // never cross x 5450-6500
      const nl = 2 + Math.floor(rC() * 2), lg = 7 + rC() * 2, gh = nl * lg;
      const gy = rC() < 0.5 ? 66 + rC() * (414 - gh - 66) : 912 + rC() * (1284 - gh - 912);
      if (inKeepout(gx + len / 2, gy + gh / 2, len, gh + 10)) continue;
      const gop = (0.10 + rC() * 0.03).toFixed(3);
      const gx1 = dodge(gx), gx2 = dodge(gx + len);
      for (let i = 0; i < nl; i++) {
        out += `<line x1="${P0(gx1)}" y1="${P0(gy + i * lg)}" x2="${P0(gx2)}" y2="${P0(gy + i * lg)}" stroke="${INKS.platinum}" stroke-width="1" opacity="${gop}"/>`;
      }
      nrg++;
    }

    // ---- power-mesh whisper grids: exactly two one-off patches, different
    // sizes, midpoints far from cuts. (The brief's page-8 low slot collides
    // with the sB keepout at this seed, so patch B sits just right of sB.)
    const meshPatch = (mx, my, mw, mh0) => {
      const mh = Math.min(mh0, 1288 - my);
      const pt = 105 + rC() * 40;
      for (let gx2 = mx; gx2 <= mx + mw; gx2 += pt * (0.85 + rC() * 0.3)) {
        const gxd = dodge(gx2);
        out += `<line x1="${P0(gxd)}" y1="${P0(my)}" x2="${P0(gxd)}" y2="${P0(my + mh)}" stroke="${INKS.platinum}" stroke-width="1" opacity="${(0.045 + rC() * 0.015).toFixed(3)}"/>`;
      }
      for (let gy2 = my; gy2 <= my + mh; gy2 += pt * (0.85 + rC() * 0.3)) {
        out += `<line x1="${P0(mx)}" y1="${P0(gy2)}" x2="${P0(mx + mw)}" y2="${P0(gy2)}" stroke="${INKS.platinum}" stroke-width="1" opacity="${(0.045 + rC() * 0.015).toFixed(3)}"/>`;
      }
    };
    meshPatch(3360 + rC() * 60, 82 + rC() * 30, 600 + rC() * 80, 250 + rC() * 40);
    meshPatch(8880 + rC() * 60, 958 + rC() * 40, 540 + rC() * 80, 260 + rC() * 40);

    // ---- ONE clock H-tree (page 4, bottom band, clear of all keepouts):
    // trunk + two crossbars + four child stubs, neutral hairlines + tip dots
    const htx = 3905 + rC() * 30, hty = 952 + rC() * 60, hcy2 = hty + 120;
    const hop = (0.13 + rC() * 0.02).toFixed(3);
    out += `<line x1="${P0(htx + 60)}" y1="${P0(hcy2)}" x2="${P0(htx + 240)}" y2="${P0(hcy2)}" stroke="${INKS.platinum}" stroke-width="1" opacity="${hop}"/>`;
    for (const bx of [htx + 60, htx + 240]) {
      out += `<line x1="${P0(bx)}" y1="${P0(hcy2 - 90)}" x2="${P0(bx)}" y2="${P0(hcy2 + 90)}" stroke="${INKS.platinum}" stroke-width="1" opacity="${hop}"/>`;
      for (const sy2 of [hcy2 - 90, hcy2 + 90]) {
        out += `<line x1="${P0(bx - 40)}" y1="${P0(sy2)}" x2="${P0(bx + 40)}" y2="${P0(sy2)}" stroke="${INKS.platinum}" stroke-width="1" opacity="${hop}"/>`;
        out += `<circle cx="${P0(bx - 40)}" cy="${P0(sy2)}" r="1.5" fill="${INKS.platinum}" opacity="0.18"/>`;
        out += `<circle cx="${P0(bx + 40)}" cy="${P0(sy2)}" r="1.5" fill="${INKS.platinum}" opacity="0.18"/>`;
      }
    }

    // ---- bit-line stubs rising off the amber word-line: texture separates
    // the warm memory net (stubbed) from the cool spine (via-dotted), which
    // survives every hue re-skin
    const nWant = 10 + Math.floor(rB() * 5);
    let nStub = 0;
    for (const [wa, wb, wy] of aRuns) {
      let sxp = wa + 46 + rB() * 110;
      while (sxp < wb - 20 && nStub < nWant) {
        const sh2 = 7 + rB() * 3, sxd = dodge(sxp);
        out += `<line x1="${P0(sxd)}" y1="${P0(wy - 1)}" x2="${P0(sxd)}" y2="${P0(wy - 1 - sh2)}" stroke="${c.a}" stroke-width="1" opacity="0.22"/>`;
        sxp += 90 + rB() * 130;
        nStub++;
      }
    }
    // 2-3 extra via dots on the cobalt spine only — never on the word-line,
    // and only where the spine sits outside the y 430-900 text band
    let nDot = 0;
    const dWant = 2 + Math.floor(rB() * 2);
    for (const [ba, bb, by] of runs) {
      if (nDot >= dWant) break;
      if (bb < 6480 || ba > 10200 || (by > 425 && by < 905)) continue;
      const da = Math.max(ba + 50, 6480), db2 = Math.min(bb - 50, 10200);
      if (db2 - da < 60) continue;
      out += `<circle cx="${P0(dodge(da + rB() * (db2 - da)))}" cy="${P0(by)}" r="1.9" fill="${c.b}" opacity="0.42"/>`;
      nDot++;
    }

    return out;
  },
};
})();

STYLE_DEFS["kilnrow"] = (function () {
const PAGES = NATIVE_PAGES;
void PAGES;
// kilnrow · "furnace hall" — an annealing hall in flat elevation, one 10-page scene.
//
// PAGE MAP (1 page = 1080px; nothing starts/ends/aligns at k*1080):
//   p1   [0,1080)     hall entry: bare wall + entry jamb, the first door ~x700-990
//   p2-4 [1080,4320)  working row: dark doors, aperiodic widths/gaps, heights ride
//                     a slow noise wave; faint cool skylight pool high near x~2500-3150
//   p5   [4320,5400)  HERO (the landmark, once): blazing ga door with slatted glow,
//                     white-hot slot, spilling floor pool, heat shimmer (center 4750-5000)
//   p6   [5400,6480)  the row gives out ~x5640: bare wall, two faint high pipes with
//                     hangers + valve drops bridge the gap (pipes span ~5150-7400)
//   p7-8 [6480,8640)  second, dimmer row from ~x6930; the EMBER door (dim warm glow)
//                     at 7860-8320; second faint cool pool high ~x8600
//   p9   [8640,9720)  row peters out: last squat door before x9310, floor line fades
//   p10  [9720,10800) rail runs on into the dark; distant gb pilot light x10000-10540
//
// Continuity spine on every page: crane-rail hairline y~240, sparse wall seams,
// floor line y1183 (fades after the last door), rail pair y1236/1245 with
// irregular sleeper ticks. Structure = neutral ink hairlines; hue lives in light
// (ga hero/ember, gb pilot + ambient pools, b indicator dots, c white-hot slot).
//
// v3.2 ENHANCEMENT PASS (all on independent RNG channels — the original r()
// stream, layout, landmarks and pilot position are byte-identical):
//   · voussoir joint courses + springing ticks (hero/ember always, ~40% of
//     dark/dim doors, platinum 0.05-0.08)
//   · counterweight gear — pulley/dashed chain/weight box — weight LOW on the
//     open hero, HIGH on two shut p3-4 doors; guillotine guide channels above
//     the hero crown
//   · sight ports on door centerlines: exactly 2 lit c-cores (door left of
//     hero + ember door), 2-3 unlit rings elsewhere
//   · flue stacks over 3 working-row + 1 second-row door centers (aperiodic —
//     x from door centers), ga shimmer wisps over the two tallest; roof-monitor
//     skylights over both gb ambient pools (their drawn source)
//   · parked charging car on the rails ~x2450 (navy deck, wheels, coal load)
//   · bare-wall dressing: p2 left = gauge manifold/conduit drop/patch plate;
//     p7 left = 2 patch plates/conduit run off drop2/hose reel
//   · pilot re-formed as a gas-cock + teardrop flame, core now pale c (same
//     x/y, same halo + floor ellipse)
//   · sleeper ticks de-metronomed: ±55px jitter + ~12% dropouts from an
//     independent channel (r() draws preserved so downstream never re-rolls)
//   · heat shimmer legibility: stroke-width 1.4, amp (14+j*6), hero 4 lines
// (helpers provided by the registry's shared toolkit)
return {
  key: 'kilnrow',
  name: 'furnace hall',
  cat: 'amber',
  desc: 'annealing hall: aperiodic furnace-door row, one blazing door, one ember, rail into dark',
  gen(seed, hue) {
    const c = HUES[hue], SW = PAGES * W;
    const r = mulberry32(seed + 613);
    // v3.2 detail channels — independent of the main r() stream (RNG
    // discipline: never insert/remove draws mid-sequence of r()).
    const r2 = mulberry32((seed ^ 0xE7A0) + 1); // wall furniture, stacks, monitors, charging car
    const rd = mulberry32((seed ^ 0xE7A0) + 3); // per-door anatomy (joints / gear / sight ports)
    const rs = mulberry32((seed ^ 0xE7A0) + 5); // extra hero shimmer line
    const rj = mulberry32((seed ^ 0xE7A0) + 9); // sleeper-tick re-jitter + dropouts
    const hNz = valueNoise1D(seed + 7);      // door-height long wave
    const tickNz = valueNoise1D(seed + 907); // sleeper-tick brightness wander
    const shimNz = valueNoise1D(seed + 311); // heat-shimmer wiggle
    const boost = glowAlphaBoost(hue);
    const FLOOR = 1183, RAIL = 1236;
    const f1 = (n) => String(Math.round(n * 10) / 10);
    const f3 = (n) => n.toFixed(3);
    // push a coordinate off any frame boundary — never start/end AT x = k*1080
    const offB = (v, m = 26) => {
      const k = Math.round(v / W) * W;
      if (k >= 0 && k <= SW && Math.abs(v - k) < m) return v >= k ? k + m : v === k ? k - m : k - m;
      return v;
    };

    // ---------------- door layout (positions first, so layers can dodge) ----
    const heroW = 196 + r() * 46;
    const heroC = 4750 + r() * 250;   // page-5 interior, >=0.25W off both cuts
    const emberW = 166 + r() * 42;
    const emberC = 7860 + r() * 460;  // pages 7-8 interior, off-boundary
    const doors = [];
    const addDoor = (xx, w, kind) => {
      let L = offB(xx);
      const k2 = Math.round((L + w) / W) * W;
      if (k2 >= 0 && k2 <= SW && Math.abs(L + w - k2) < 26) L += (L + w >= k2 ? 26 : -26);
      let h;
      if (kind === 'hero') h = 545 + r() * 55;
      else if (kind === 'ember') h = 415 + r() * 55;
      else {
        h = Math.min(565, 295 + 245 * hNz(L / 1900) + r() * 95) * (kind === 'dim' ? 0.92 : 1);
        if (r() < 0.18) h *= 0.62; // occasional squat hatch breaks the row rhythm
      }
      doors.push({ x: L, w, h, kind });
      return L + w;
    };
    let x = 690 + r() * 90;                       // p1: the first door
    addDoor(x, 165 + r() * 55, 'dark');
    x = doors[0].x + doors[0].w + 300 + Math.pow(r(), 1.5) * 330;
    while (x < heroC - heroW / 2 - 250) {         // p2-4: working row
      const w = r() < 0.15 ? 248 + r() * 62 : 128 + r() * 96;
      const e = addDoor(x, w, 'dark');
      x = e + 175 + Math.pow(r(), 1.6) * 430;
    }
    addDoor(heroC - heroW / 2, heroW, 'hero');    // p5: the landmark, exactly once
    x = heroC + heroW / 2 + 230 + r() * 170;
    while (x < 5640) {                            // row tapers into the gap
      const w = 130 + r() * 80;
      const e = addDoor(x, w, 'dark');
      x = e + 260 + Math.pow(r(), 1.5) * 380;
    }
    x = 6930 + r() * 150;                         // p7-8: dimmer second row
    let emberIn = false;
    while (x < 9310) {
      if (!emberIn && x + 150 > emberC - emberW / 2) {
        addDoor(emberC - emberW / 2, emberW, 'ember');
        x = emberC + emberW / 2 + 210 + Math.pow(r(), 1.4) * 300;
        emberIn = true;
        continue;
      }
      const w = 122 + r() * 88;
      const e = addDoor(x, w, 'dim');
      x = e + 195 + Math.pow(r(), 1.6) * 460;
    }
    if (!emberIn) addDoor(emberC - emberW / 2, emberW, 'ember');
    let lastEnd = 0;
    for (const d of doors) lastEnd = Math.max(lastEnd, d.x + d.w);

    let bg = '', lit = '';

    // ---------------- back layer -------------------------------------------
    // two faint cool skylight pools, high, off the landmark zones
    const ambs = [
      [2450 + r() * 700, 118 + r() * 90, 245 + r() * 65, 0.045],
      [8560 + r() * 420, 130 + r() * 80, 225 + r() * 60, 0.038],
    ];
    for (const a of ambs) bg += `<circle cx="${f1(offB(a[0]))}" cy="${f1(a[1])}" r="${f1(a[2])}" fill="${c.gb}" opacity="${f3(a[3] * boost)}" filter="url(#nb-blur)"/>`;

    // crane-rail hairline pair along the top of the wall
    const wallY = 233 + r() * 14;
    bg += `<line x1="-40" y1="${f1(wallY)}" x2="${SW + 40}" y2="${f1(wallY)}" stroke="${INKS.platinum}" stroke-width="1" opacity="0.09"/>`;
    bg += `<line x1="-40" y1="${f1(wallY + 9)}" x2="${SW + 40}" y2="${f1(wallY + 9)}" stroke="${INKS.platinum}" stroke-width="1" opacity="0.05"/>`;

    // entry jamb + lintel (the doorway we came in through), page-1 left
    const jx = offB(118 + r() * 70);
    bg += `<line x1="${f1(jx)}" y1="${f1(wallY + 24)}" x2="${f1(jx)}" y2="${FLOOR - 4}" stroke="${INKS.platinum}" stroke-width="1.4" opacity="0.11"/>`;
    bg += `<line x1="${f1(jx + 15)}" y1="${f1(wallY + 40)}" x2="${f1(jx + 15)}" y2="${FLOOR - 4}" stroke="${INKS.platinum}" stroke-width="1" opacity="0.06"/>`;
    bg += `<line x1="${f1(jx - 8)}" y1="${f1(wallY + 24)}" x2="${f1(jx + 140 + r() * 60)}" y2="${f1(wallY + 24)}" stroke="${INKS.platinum}" stroke-width="1" opacity="0.08"/>`;

    // sparse vertical wall seams (skip door spans + the hero zone)
    for (const s0 of schedule(r, SW, 1.15, 2.7)) {
      const sx = offB(s0);
      if (Math.abs(sx - heroC) < 330) continue;
      let clash = false;
      for (const d of doors) if (sx > d.x - 44 && sx < d.x + d.w + 44) { clash = true; break; }
      if (clash) continue;
      bg += `<line x1="${f1(sx)}" y1="${f1(wallY + 18)}" x2="${f1(sx)}" y2="${FLOOR - 8}" stroke="${INKS.platinum}" stroke-width="1" opacity="${sx > 9450 ? '0.038' : '0.06'}"/>`;
    }

    // faint high piping across the bare-wall gap (p6), fading in and out
    const p0 = 5140 + r() * 130, p1 = 7280 + r() * 150;
    const pys = [262 + r() * 22];
    pys.push(pys[0] + 30 + r() * 18);
    for (let pi = 0; pi < 2; pi++) {
      const y = f1(pys[pi]);
      const a = offB(p0 + pi * (18 + r() * 40)), b = offB(p1 - pi * (24 + r() * 50));
      const m1 = offB(a + 320 + r() * 140), m2 = offB(b - 360 - r() * 160);
      bg += `<line x1="${f1(a)}" y1="${y}" x2="${f1(m1)}" y2="${y}" stroke="${INKS.platinum}" stroke-width="1.4" opacity="0.06"/>`;
      bg += `<line x1="${f1(m1)}" y1="${y}" x2="${f1(m2)}" y2="${y}" stroke="${INKS.platinum}" stroke-width="1.4" opacity="0.13"/>`;
      bg += `<line x1="${f1(m2)}" y1="${y}" x2="${f1(b)}" y2="${y}" stroke="${INKS.platinum}" stroke-width="1.4" opacity="0.06"/>`;
    }
    let hx = p0 + 60 + r() * 90;                  // hanger rods above the top pipe
    while (hx < p1 - 50) {
      const hxx = offB(hx);
      bg += `<line x1="${f1(hxx)}" y1="${f1(pys[0] - 14)}" x2="${f1(hxx)}" y2="${f1(pys[0])}" stroke="${INKS.platinum}" stroke-width="1" opacity="0.08"/>`;
      hx += 150 + Math.pow(r(), 1.3) * 260;
    }
    // two service drops: one valve, one gauge with a cool indicator dot
    const drop1 = offB(5960 + r() * 380), drop2 = offB(6520 + r() * 330);
    bg += `<line x1="${f1(drop1)}" y1="${f1(pys[1])}" x2="${f1(drop1)}" y2="${FLOOR - 4}" stroke="${INKS.platinum}" stroke-width="1" opacity="0.08"/>`;
    const vy = pys[1] + 150 + r() * 160;
    bg += `<circle cx="${f1(drop1)}" cy="${f1(vy)}" r="6.5" fill="none" stroke="${INKS.platinum}" stroke-width="1" opacity="0.18"/>`;
    bg += `<line x1="${f1(drop1 - 10)}" y1="${f1(vy)}" x2="${f1(drop1 + 10)}" y2="${f1(vy)}" stroke="${INKS.platinum}" stroke-width="1" opacity="0.12"/>`;
    const jby = pys[1] + 46 + r() * 40; // conduit junction box on the valve drop
    bg += `<rect x="${f1(drop1 - 7)}" y="${f1(jby)}" width="14" height="19" fill="none" stroke="${INKS.platinum}" stroke-width="1" opacity="0.14"/>`;
    bg += `<line x1="${f1(drop2)}" y1="${f1(pys[1])}" x2="${f1(drop2)}" y2="${FLOOR - 4}" stroke="${INKS.platinum}" stroke-width="1" opacity="0.07"/>`;
    const gy = pys[1] + 90 + r() * 120;
    bg += `<circle cx="${f1(drop2)}" cy="${f1(gy)}" r="9" fill="none" stroke="${INKS.platinum}" stroke-width="1" opacity="0.15"/>`;
    lit += `<circle cx="${f1(drop2)}" cy="${f1(gy)}" r="2.4" fill="${c.b}" opacity="0.46"/>`;

    // floor line: bright through the working hall, fades after the last door
    const fE1 = offB(lastEnd + 220 + r() * 120), fE2 = offB(fE1 + 520 + r() * 200);
    bg += `<line x1="-40" y1="${FLOOR}" x2="${f1(fE1)}" y2="${FLOOR}" stroke="${INKS.platinum}" stroke-width="1" opacity="0.12"/>`;
    bg += `<line x1="${f1(fE1)}" y1="${FLOOR}" x2="${f1(fE2)}" y2="${FLOOR}" stroke="${INKS.platinum}" stroke-width="1" opacity="0.065"/>`;
    bg += `<line x1="${f1(fE2)}" y1="${FLOOR}" x2="${SW + 40}" y2="${FLOOR}" stroke="${INKS.platinum}" stroke-width="1" opacity="0.035"/>`;

    // faint floor scuffs — drag marks in front of the row, sparse, off the hero
    for (const q0 of schedule(r, SW, 0.55, 1.45)) {
      const qx = offB(q0);
      if (Math.abs(qx - heroC) < 380) continue;
      const ql = 34 + r() * 62, qy = 1146 + r() * 28;
      const qf = qx > lastEnd ? 0.55 : 1;
      bg += `<line x1="${f1(qx - ql / 2)}" y1="${f1(qy)}" x2="${f1(qx + ql / 2)}" y2="${f1(qy - 1 - r() * 2)}" stroke="${INKS.platinum}" stroke-width="1" opacity="${f3((0.038 + r() * 0.022) * qf)}"/>`;
    }

    // the rail pair, full length — it outlives the doors
    bg += `<line x1="-40" y1="${RAIL}" x2="${SW + 40}" y2="${RAIL}" stroke="${INKS.platinum}" stroke-width="1.4" opacity="0.2"/>`;
    bg += `<line x1="-40" y1="${RAIL + 9}" x2="${SW + 40}" y2="${RAIL + 9}" stroke="${INKS.platinum}" stroke-width="1" opacity="0.08"/>`;

    // irregular sleeper ticks, dimming into the dark end.
    // v3.2 de-metronome: the r() draws (wobble, height, interval) are kept
    // exactly as before so nothing downstream re-rolls; the independent rj
    // channel overlays ±55px positional jitter and ~12% dropouts (double-gaps)
    // to break the residual ~96px beat. Opacity formula + post-lastEnd fade
    // unchanged and still evaluated at the un-jittered tx.
    let tx = -20 + r() * 70;
    while (tx < SW + 20) {
      const wob = (r() - 0.5) * 3, th = 7 + r() * 8;
      const jtx = tx + (rj() - 0.5) * 110, drop = rj() < 0.12;
      if (!drop) {
        const txx = offB(jtx, 14);
        const fade = tx > lastEnd ? Math.max(0.42, 1 - (tx - lastEnd) / 2600) : 1;
        const to = (0.06 + 0.09 * tickNz(tx / 640)) * fade;
        bg += `<line x1="${f1(txx)}" y1="${RAIL + 3}" x2="${f1(txx + wob)}" y2="${f1(RAIL + 3 + th)}" stroke="${INKS.platinum}" stroke-width="1" opacity="${f3(to)}"/>`;
      }
      tx += 42 + Math.pow(r(), 1.4) * 130;
    }

    // ---------------- the doors --------------------------------------------
    // v3.2 legibility bump: width 1 -> 1.4, amplitude (11+j*5) -> (14+j*6);
    // `extra` appends additional line(s) drawn from the independent rs channel
    // so the hero can carry 4 lines without disturbing the r() stream.
    const shimmer = (cx, hw, yTop, lines, op0, extra) => {
      let s = '';
      for (let j = 0; j < lines + (extra || 0); j++) {
        const rr2 = j < lines ? r : rs;
        const y0 = yTop - 26 - j * (24 + rr2() * 16);
        const x0 = offB(cx - hw - rr2() * 20), x1 = offB(cx + hw + rr2() * 20);
        let p = '';
        for (let xx = x0; xx <= x1; xx += 15) {
          const yy = y0 + (shimNz(xx / 33 + j * 61.7) - 0.5) * (14 + j * 6);
          p += (p ? ' L' : 'M') + f1(xx) + ' ' + f1(yy);
        }
        s += `<path d="${p}" fill="none" stroke="${c.ga}" stroke-width="1.4" opacity="${f3(Math.max(0.05, op0 - j * 0.035))}"/>`;
      }
      return s;
    };

    for (const d of doors) {
      const dw = d.w, dx = d.x, h = d.h, top = FLOOR - h, R = dw / 2;
      const arch = (ins) => {
        const rr = R - ins, l = dx + ins, rt = dx + dw - ins, yy = top + ins + rr;
        return `M${f1(l)} ${FLOOR} L${f1(l)} ${f1(yy)} A${f1(rr)} ${f1(rr)} 0 0 1 ${f1(rt)} ${f1(yy)} L${f1(rt)} ${FLOOR}`;
      };
      bg += `<path d="${arch(0)} Z" fill="${INKS.navy}" opacity="0.45"/>`;
      bg += `<path d="${arch(12)} Z" fill="${INKS.coal}" opacity="0.5"/>`;
      if (d.kind === 'hero') {
        const cx = dx + R, ay = top + R;
        bg += `<path d="${arch(0)}" fill="none" stroke="${c.ga}" stroke-width="2" opacity="0.5"/>`;
        bg += `<path d="${arch(12)}" fill="none" stroke="${c.ga}" stroke-width="1" opacity="0.22"/>`;
        bg += `<line x1="${f1(dx - 10)}" y1="${FLOOR + 3}" x2="${f1(dx + dw + 10)}" y2="${FLOOR + 3}" stroke="${INKS.platinum}" stroke-width="1" opacity="0.16"/>`;
        // furnace light: soft spill + hotter core
        lit += `<circle cx="${f1(cx)}" cy="${FLOOR - 130}" r="350" fill="${c.ga}" opacity="${f3(0.08 * boost)}" filter="url(#nb-blur)"/>`;
        lit += `<circle cx="${f1(cx)}" cy="${FLOOR - 55}" r="155" fill="${c.ga}" opacity="${f3(0.10 * boost)}" filter="url(#nb-blur)"/>`;
        // arch fanlight
        const rr = R - 15, yy = top + 15 + rr;
        lit += `<path d="M${f1(dx + 15)} ${f1(yy)} A${f1(rr)} ${f1(rr)} 0 0 1 ${f1(dx + dw - 15)} ${f1(yy)} Z" fill="${c.ga}" opacity="0.10"/>`;
        // louver slats, brightest at the hearth, clamped in the text mid-band
        let sy = FLOOR - 12;
        while (sy > ay + 12) {
          const t = (FLOOR - sy) / h;
          let op = 0.05 + 0.30 * (1 - t);
          if (sy < 1012) op = Math.min(op, 0.15);
          const insX = 10 + 24 * t;
          lit += `<rect x="${f1(dx + insX)}" y="${f1(sy)}" width="${f1(dw - 2 * insX)}" height="${f1(4 + r() * 4)}" fill="${c.ga}" opacity="${f3(op)}"/>`;
          sy -= 26 + r() * 30;
        }
        // white-hot slot under the door + pooled light on the floor
        lit += `<rect x="${f1(dx + 6)}" y="${FLOOR - 7}" width="${f1(dw - 12)}" height="4.5" fill="${c.c}" opacity="0.5"/>`;
        lit += `<ellipse cx="${f1(cx)}" cy="${FLOOR + 24}" rx="300" ry="44" fill="${c.ga}" opacity="${f3(0.11 * boost)}" filter="url(#nb-blur)"/>`;
        lit += `<ellipse cx="${f1(cx)}" cy="${FLOOR + 10}" rx="130" ry="11" fill="${c.ga}" opacity="0.14"/>`;
        for (let i = 0; i < 3; i++) {
          const ly = 1218 + i * 22 + r() * 10, ll = 70 + r() * 90, lo = (r() - 0.5) * 170;
          lit += `<line x1="${f1(cx + lo - ll / 2)}" y1="${f1(ly)}" x2="${f1(cx + lo + ll / 2)}" y2="${f1(ly)}" stroke="${c.ga}" stroke-width="1.2" opacity="${f3(0.16 - i * 0.04)}"/>`;
        }
        lit += shimmer(cx, R + 30, top, 3, 0.2, 1); // 4th line rides the rs channel
      } else if (d.kind === 'ember') {
        const cx = dx + R;
        bg += `<path d="${arch(0)}" fill="none" stroke="${c.a}" stroke-width="1.4" opacity="0.33"/>`;
        bg += `<path d="${arch(12)}" fill="none" stroke="${c.a}" stroke-width="1" opacity="0.15"/>`;
        bg += `<line x1="${f1(dx - 9)}" y1="${FLOOR + 3}" x2="${f1(dx + dw + 9)}" y2="${FLOOR + 3}" stroke="${INKS.platinum}" stroke-width="1" opacity="0.12"/>`;
        lit += `<circle cx="${f1(cx)}" cy="${FLOOR - 80}" r="190" fill="${c.ga}" opacity="${f3(0.06 * boost)}" filter="url(#nb-blur)"/>`;
        let sy = FLOOR - 10;
        for (const so of [0.2, 0.13, 0.08]) {
          lit += `<rect x="${f1(dx + 12)}" y="${f1(sy)}" width="${f1(dw - 24)}" height="${f1(3.5 + r() * 3)}" fill="${c.ga}" opacity="${f3(so)}"/>`;
          sy -= 24 + r() * 20;
        }
        lit += `<rect x="${f1(dx + 7)}" y="${FLOOR - 6}" width="${f1(dw - 14)}" height="3.5" fill="${c.ga}" opacity="0.36"/>`;
        lit += `<ellipse cx="${f1(cx)}" cy="${FLOOR + 18}" rx="170" ry="28" fill="${c.ga}" opacity="${f3(0.07 * boost)}" filter="url(#nb-blur)"/>`;
        lit += shimmer(cx, R + 14, top, 2, 0.11);
      } else {
        const dim = d.kind === 'dim';
        const fo = dim ? 0.09 + r() * 0.05 : 0.14 + r() * 0.07;
        bg += `<path d="${arch(0)}" fill="none" stroke="${INKS.platinum}" stroke-width="1.3" opacity="${f3(fo)}"/>`;
        bg += `<path d="${arch(12)}" fill="none" stroke="${INKS.platinum}" stroke-width="1" opacity="${f3(fo * 0.55)}"/>`;
        bg += `<line x1="${f1(dx - 9)}" y1="${FLOOR + 3}" x2="${f1(dx + dw + 9)}" y2="${FLOOR + 3}" stroke="${INKS.platinum}" stroke-width="1" opacity="${dim ? '0.09' : '0.14'}"/>`;
        if (dw > 240) bg += `<line x1="${f1(dx + R)}" y1="${f1(top + R + 6)}" x2="${f1(dx + R)}" y2="${FLOOR - 2}" stroke="${INKS.platinum}" stroke-width="1" opacity="${f3(fo * 0.7)}"/>`;
        if (r() < 0.28) {
          const hw2 = 26 + r() * 10, hh2 = 34 + r() * 12, hy = top + h * 0.42;
          bg += `<rect x="${f1(dx + R - hw2 / 2)}" y="${f1(hy)}" width="${f1(hw2)}" height="${f1(hh2)}" fill="none" stroke="${INKS.platinum}" stroke-width="1" opacity="${f3(fo * 0.9)}"/>`;
        }
        if (r() < 0.35) bg += `<line x1="${f1(dx + R - 13)}" y1="${f1(top - 24)}" x2="${f1(dx + R + 13)}" y2="${f1(top - 24)}" stroke="${INKS.platinum}" stroke-width="1" opacity="0.11"/>`;
        if (r() < 0.26) {
          const side = r() < 0.5 ? dx - 14 : dx + dw + 14;
          lit += `<circle cx="${f1(side)}" cy="${f1(FLOOR - 90 - r() * 140)}" r="2.6" fill="${c.b}" opacity="0.45"/>`;
        }
        if (r() < 0.45) {
          const ly = 1214 + r() * 46, ll = dw * 0.45;
          bg += `<line x1="${f1(dx + R - ll / 2 + (r() - 0.5) * 40)}" y1="${f1(ly)}" x2="${f1(dx + R + ll / 2)}" y2="${f1(ly)}" stroke="${INKS.platinum}" stroke-width="1" opacity="0.055"/>`;
        }
      }
    }

    // ---------------- hall end: the distant pilot light ---------------------
    const px = offB(Math.min(10540, 9990 + r() * 540));
    const py = 1068 + r() * 42;
    bg += `<line x1="${f1(px - 9)}" y1="${f1(py + 12)}" x2="${f1(px + 9)}" y2="${f1(py + 12)}" stroke="${INKS.platinum}" stroke-width="1" opacity="0.1"/>`;
    bg += `<line x1="${f1(px)}" y1="${f1(py + 12)}" x2="${f1(px)}" y2="${f1(py + 38)}" stroke="${INKS.platinum}" stroke-width="1" opacity="0.09"/>`;
    // v3.2 gas-cock assembly: supply stub off the bracket stem + handle tick
    bg += `<line x1="${f1(px)}" y1="${f1(py + 30)}" x2="${f1(px + 16)}" y2="${f1(py + 30)}" stroke="${INKS.platinum}" stroke-width="1" opacity="0.08"/>`;
    bg += `<line x1="${f1(px + 8)}" y1="${f1(py + 26)}" x2="${f1(px + 8)}" y2="${f1(py + 34)}" stroke="${INKS.platinum}" stroke-width="1" opacity="0.1"/>`;
    lit += `<circle cx="${f1(px)}" cy="${f1(py)}" r="110" fill="${c.gb}" opacity="${f3(0.09 * boost)}" filter="url(#nb-blur)"/>`;
    // v3.2 identity-by-form: teardrop flame outline around a paler c core
    // (was a gb dot r3.2 — position, halo and floor ellipse untouched)
    lit += `<path d="M${f1(px)} ${f1(py - 6.2)} C${f1(px + 3.1)} ${f1(py - 2)} ${f1(px + 2.6)} ${f1(py + 2.4)} ${f1(px)} ${f1(py + 4.4)} C${f1(px - 2.6)} ${f1(py + 2.4)} ${f1(px - 3.1)} ${f1(py - 2)} ${f1(px)} ${f1(py - 6.2)} Z" fill="none" stroke="${c.gb}" stroke-width="1" opacity="0.25"/>`;
    lit += `<circle cx="${f1(px)}" cy="${f1(py)}" r="2.6" fill="${c.c}" opacity="0.6"/>`;
    lit += `<ellipse cx="${f1(px)}" cy="${FLOOR + 10}" rx="56" ry="7" fill="${c.gb}" opacity="0.1"/>`;

    // ============ v3.2 enhancement pass (channels rd / r2 only) =============
    // Industrial anatomy + bare-wall dressing. Everything below is neutral
    // platinum/navy ink at 0.04-0.15, except: two lit sight-port cores (c.c,
    // <=0.35) and the ga shimmer wisps over the two tallest stacks (<=0.06).
    const nearCut = (v) => { const k = Math.round(v / W) * W; return k >= 0 && k <= SW && Math.abs(v - k) < 26; };
    let heroI = -1, emberI = -1;
    doors.forEach((d, i) => { if (d.kind === 'hero') heroI = i; else if (d.kind === 'ember') emberI = i; });
    const heroD = doors[heroI], emberD = doors[emberI];

    // (3) voussoir joint courses + springing ticks — refractory brickwork.
    // Hero + ember always; a seeded ~40% of dark/dim doors. Platinum on all
    // (the hero's ga arch stroke keeps owning the color).
    for (const d of doors) {
      const isHE = d.kind === 'hero' || d.kind === 'ember';
      const pick = rd() < 0.4;
      if (!isHE && !pick) continue;
      const R0 = d.w / 2, cx0 = d.x + R0, cy0 = FLOOR - d.h + R0;
      const n = 4 + Math.floor(rd() * 2.999);
      const jop = isHE ? 0.08 : 0.05 + rd() * 0.025;
      for (let i = 0; i < n; i++) {
        const th = (Math.PI * (i + 0.55 + (rd() - 0.5) * 0.55)) / n;
        const co = Math.cos(th), si = Math.sin(th);
        if (nearCut(cx0 + co * (R0 - 6))) continue; // joints never sit on a frame cut
        bg += `<line x1="${f1(cx0 + co * (R0 - 11.5))}" y1="${f1(cy0 - si * (R0 - 11.5))}" x2="${f1(cx0 + co * (R0 - 0.5))}" y2="${f1(cy0 - si * (R0 - 0.5))}" stroke="${INKS.platinum}" stroke-width="1" opacity="${f3(jop)}"/>`;
      }
      bg += `<line x1="${f1(d.x + 1)}" y1="${f1(cy0)}" x2="${f1(d.x + 13)}" y2="${f1(cy0)}" stroke="${INKS.platinum}" stroke-width="1" opacity="0.07"/>`;
      bg += `<line x1="${f1(d.x + d.w - 13)}" y1="${f1(cy0)}" x2="${f1(d.x + d.w - 1)}" y2="${f1(cy0)}" stroke="${INKS.platinum}" stroke-width="1" opacity="0.07"/>`;
    }

    // (4) counterweight lifting gear: pulley + dashed chain + weight box.
    // Weight LOW on the open hero (y~1080), HIGH (y~700-760) on two shut
    // dark doors near x2900/x3900. Hero chain keeps >=40px off the louvers.
    const cwPicks = [];
    for (const tgt of [2900, 3900]) {
      let best = -1, bd = 1e9;
      doors.forEach((d, i) => {
        if (d.kind !== 'dark' || cwPicks.includes(i)) return;
        const cc = d.x + d.w / 2;
        if (cc < 2200 || cc > 4300 || Math.abs(cc - heroC) < 380) return;
        const dd = Math.abs(cc - tgt);
        if (dd < bd) { bd = dd; best = i; }
      });
      if (best >= 0) cwPicks.push(best);
    }
    const gear = (d, open) => {
      const side = rd() < 0.5 ? -1 : 1, off = open ? 34 : 16;
      const chX = offB(d.x + (side < 0 ? -off : d.w + off));
      const topY = FLOOR - d.h, pyl = topY - 10 - rd() * 8;
      const wTop = open ? 1074 + rd() * 12 : Math.max(topY + 40, 700 + rd() * 60);
      bg += `<circle cx="${f1(chX)}" cy="${f1(pyl)}" r="4" fill="none" stroke="${INKS.platinum}" stroke-width="1" opacity="0.11"/>`;
      bg += `<line x1="${f1(chX)}" y1="${f1(pyl + 4)}" x2="${f1(chX)}" y2="${f1(wTop)}" stroke="${INKS.platinum}" stroke-width="1" stroke-dasharray="3 2" opacity="0.1"/>`;
      bg += `<rect x="${f1(chX - 5)}" y="${f1(wTop)}" width="10" height="26" fill="${INKS.navy}" opacity="0.35"/>`;
      bg += `<rect x="${f1(chX - 5)}" y="${f1(wTop)}" width="10" height="26" fill="none" stroke="${INKS.platinum}" stroke-width="1" opacity="0.12"/>`;
    };
    gear(heroD, true);
    for (const i of cwPicks) gear(doors[i], false);

    // (12) hero guillotine guide channels: shoulder pairs up to a lintel-beam
    // tick — where the raised door lives. Span matches the door slot.
    {
      const topY = FLOOR - heroD.h, chTop = topY - 82 - rd() * 6;
      for (const gx of [heroD.x + 7, heroD.x + 21, heroD.x + heroD.w - 21, heroD.x + heroD.w - 7]) {
        bg += `<line x1="${f1(gx)}" y1="${f1(topY - 10)}" x2="${f1(gx)}" y2="${f1(chTop)}" stroke="${INKS.platinum}" stroke-width="1" opacity="0.08"/>`;
      }
      bg += `<line x1="${f1(heroD.x + 3)}" y1="${f1(chTop)}" x2="${f1(heroD.x + heroD.w - 3)}" y2="${f1(chTop)}" stroke="${INKS.platinum}" stroke-width="1" opacity="0.09"/>`;
    }

    // (5) sight ports at ~55% door height. Exactly two lit c-cores strip-wide
    // (door left of hero + ember, <=0.35 — b dots already run 0.45); the rest
    // are unlit cover-disc rings.
    const port = (d, litOn) => {
      const pcx = offB(d.x + d.w / 2), pcy = FLOOR - d.h * 0.55;
      bg += `<circle cx="${f1(pcx)}" cy="${f1(pcy)}" r="4.5" fill="none" stroke="${INKS.platinum}" stroke-width="1" opacity="0.08"/>`;
      if (litOn) lit += `<circle cx="${f1(pcx)}" cy="${f1(pcy)}" r="2.2" fill="${c.c}" opacity="${f3(0.31 + rd() * 0.04)}"/>`;
    };
    if (heroI > 0 && doors[heroI - 1].kind === 'dark') port(doors[heroI - 1], true);
    port(emberD, true);
    let rings = 0;
    doors.forEach((d, i) => {
      if (rings >= 3 || (d.kind !== 'dark' && d.kind !== 'dim') || i === heroI - 1) return;
      if (rd() < 0.18) { port(d, false); rings++; }
    });

    // (1) p2 left bare wall (between the entry door and the working row):
    // two-gauge manifold + conduit drop to a junction box + bolted patch plate
    {
      const g0 = doors[0].x + doors[0].w + 44, g1 = doors[1] ? doors[1].x - 40 : 1500;
      const lo = Math.max(1112, g0), hi2 = Math.max(lo + 90, Math.min(1460, g1));
      const at = (t) => offB(lo + (hi2 - lo) * t);
      const mX = at(0.14 + r2() * 0.1), mY = 566 + r2() * 60, mo = f3(0.1 + r2() * 0.03);
      bg += `<line x1="${f1(mX - 6)}" y1="${f1(mY + 15)}" x2="${f1(mX + 32)}" y2="${f1(mY + 15)}" stroke="${INKS.platinum}" stroke-width="1" opacity="0.07"/>`;
      bg += `<circle cx="${f1(mX)}" cy="${f1(mY)}" r="7" fill="none" stroke="${INKS.platinum}" stroke-width="1" opacity="${mo}"/>`;
      bg += `<line x1="${f1(mX)}" y1="${f1(mY)}" x2="${f1(mX + 3.4)}" y2="${f1(mY - 3.4)}" stroke="${INKS.platinum}" stroke-width="1" opacity="${mo}"/>`;
      bg += `<circle cx="${f1(mX + 26)}" cy="${f1(mY + 2)}" r="9" fill="none" stroke="${INKS.platinum}" stroke-width="1" opacity="${mo}"/>`;
      bg += `<line x1="${f1(mX + 26)}" y1="${f1(mY + 2)}" x2="${f1(mX + 21.5)}" y2="${f1(mY - 0.5)}" stroke="${INKS.platinum}" stroke-width="1" opacity="${mo}"/>`;
      const cX = at(0.5 + r2() * 0.1), jbY = 694 + r2() * 16;
      bg += `<line x1="${f1(cX)}" y1="${f1(wallY + 10)}" x2="${f1(cX)}" y2="${f1(jbY)}" stroke="${INKS.platinum}" stroke-width="1" opacity="0.06"/>`;
      bg += `<rect x="${f1(cX - 7)}" y="${f1(jbY)}" width="14" height="19" fill="none" stroke="${INKS.platinum}" stroke-width="1" opacity="0.1"/>`;
      const pX = at(0.82 + r2() * 0.1), pY = 872 + r2() * 20;
      bg += `<rect x="${f1(pX - 15)}" y="${f1(pY)}" width="30" height="42" fill="none" stroke="${INKS.platinum}" stroke-width="1" opacity="0.06"/>`;
      for (const [ox, oy] of [[-11, 4], [11, 4], [-11, 38], [11, 38]])
        bg += `<circle cx="${f1(pX + ox)}" cy="${f1(pY + oy)}" r="1.2" fill="${INKS.platinum}" opacity="0.06"/>`;
    }

    // (2) p7 left bare wall: staggered patch plates, a conduit run tying the
    // existing drop2 riser to a second junction box, floor-level hose reel.
    // Neutral ink only — drop2's cool indicator already lives on this page.
    {
      const plate = (xx, yy, ww, hh) => {
        const q = offB(xx);
        bg += `<rect x="${f1(q - ww / 2)}" y="${f1(yy)}" width="${ww}" height="${hh}" fill="none" stroke="${INKS.platinum}" stroke-width="1" opacity="${f3(0.05 + r2() * 0.02)}"/>`;
      };
      plate(6560 + r2() * 140, 754 + r2() * 16, 26, 36);
      plate(6690 + r2() * 160, 944 + r2() * 14, 34, 30);
      const cy2 = 614 + r2() * 14;
      let b2 = drop2 - (100 + r2() * 70);
      if (b2 < 6500) b2 = Math.min(6880, drop2 + 90 + r2() * 50);
      b2 = offB(b2);
      bg += `<line x1="${f1(drop2)}" y1="${f1(cy2)}" x2="${f1(b2)}" y2="${f1(cy2)}" stroke="${INKS.platinum}" stroke-width="1" opacity="0.08"/>`;
      bg += `<rect x="${f1(b2 - 6)}" y="${f1(cy2 - 8)}" width="12" height="16" fill="none" stroke="${INKS.platinum}" stroke-width="1" opacity="0.08"/>`;
      const hX = offB(6548 + r2() * 300), hY = 1126 + r2() * 10;
      bg += `<circle cx="${f1(hX)}" cy="${f1(hY)}" r="16" fill="none" stroke="${INKS.platinum}" stroke-width="1" opacity="0.09"/>`;
      bg += `<circle cx="${f1(hX)}" cy="${f1(hY)}" r="1.6" fill="${INKS.platinum}" opacity="0.09"/>`;
    }

    // (6) flue stacks over the roofline — x drawn from door centers (already
    // aperiodic), 3 over the working row + 1 over the second row, never near
    // the hero or ember. Paired hairlines + cap and flange ticks; ga heat
    // wisps (shimNz) above the two tallest only.
    const stacks = [];
    for (const tgt of [1550, 2750, 3950]) {
      let best = -1, bd = 1e9;
      doors.forEach((d) => {
        const cc = d.x + d.w / 2;
        if (d.kind !== 'dark' || cc < 1200 || cc > 4260 || Math.abs(cc - heroC) < 330) return;
        if (stacks.some((s) => Math.abs(s.cx - cc) < 60)) return;
        const dd = Math.abs(cc - tgt);
        if (dd < bd) { bd = dd; best = cc; }
      });
      if (best >= 0) stacks.push({ cx: best });
    }
    {
      let best = -1, bd = 1e9;
      doors.forEach((d) => {
        const cc = d.x + d.w / 2;
        if (d.kind !== 'dim' || cc < 7900 || cc > 8620 || Math.abs(cc - emberC) < 300) return;
        const dd = Math.abs(cc - 8250);
        if (dd < bd) { bd = dd; best = cc; }
      });
      if (best >= 0) stacks.push({ cx: best });
    }
    for (const s of stacks) {
      s.x = offB(s.cx); s.top = 84 + r2() * 66;
      const g = 14 + r2() * 4, sop = f3(0.05 + r2() * 0.03);
      const xl = s.x - g / 2, xr = s.x + g / 2, fy = wallY - 36 - r2() * 46;
      bg += `<line x1="${f1(xl)}" y1="${f1(wallY)}" x2="${f1(xl)}" y2="${f1(s.top)}" stroke="${INKS.platinum}" stroke-width="1" opacity="${sop}"/>`;
      bg += `<line x1="${f1(xr)}" y1="${f1(wallY)}" x2="${f1(xr)}" y2="${f1(s.top)}" stroke="${INKS.platinum}" stroke-width="1" opacity="${sop}"/>`;
      bg += `<line x1="${f1(xl - 3)}" y1="${f1(s.top)}" x2="${f1(xr + 3)}" y2="${f1(s.top)}" stroke="${INKS.platinum}" stroke-width="1" opacity="${sop}"/>`;
      bg += `<line x1="${f1(xl - 2)}" y1="${f1(fy)}" x2="${f1(xr + 2)}" y2="${f1(fy)}" stroke="${INKS.platinum}" stroke-width="1" opacity="${sop}"/>`;
    }
    for (const s of [...stacks].sort((a, b) => a.top - b.top).slice(0, 2)) {
      const yw = Math.min(90, Math.max(52, s.top - 30));
      const wx0 = offB(s.x - 44), wx1 = offB(s.x + 44);
      let p = '';
      for (let xx = wx0; xx <= wx1; xx += 12) {
        const yy = yw + (shimNz(xx / 29 + s.x * 0.013) - 0.5) * 10;
        p += (p ? ' L' : 'M') + f1(xx) + ' ' + f1(yy);
      }
      lit += `<path d="${p}" fill="none" stroke="${c.ga}" stroke-width="1" opacity="0.055"/>`;
    }

    // (7) roof-monitor skylights — the drawn source of the two gb ambient
    // pools (positions/radii/opacities of the pools themselves untouched).
    for (const a of ambs) {
      const mcx = offB(a[0]);
      const x0 = offB(mcx - 128 - r2() * 8), x1 = offB(mcx + 128 + r2() * 8);
      const y0 = 124 + r2() * 32, nm = 2 + Math.floor(r2() * 1.999);
      bg += `<rect x="${f1(x0)}" y="${f1(y0)}" width="${f1(x1 - x0)}" height="14" fill="none" stroke="${INKS.platinum}" stroke-width="1" opacity="0.05"/>`;
      for (let i = 1; i <= nm; i++) {
        const mx = offB(x0 + ((x1 - x0) * i) / (nm + 1));
        bg += `<line x1="${f1(mx)}" y1="${f1(y0)}" x2="${f1(mx)}" y2="${f1(y0 + 14)}" stroke="${INKS.platinum}" stroke-width="1" opacity="0.05"/>`;
      }
    }

    // (8) parked charging car on the rails, p3 (clear of the x2160 cut):
    // navy flat-wagon deck, platinum top edge, wheels on the RAIL line,
    // coupling hook on the leading end, dark coal load hump. No hue, no glow.
    {
      const ccx = offB(2412 + r2() * 130), dw2 = 168 + r2() * 8;
      bg += `<ellipse cx="${f1(ccx)}" cy="1198" rx="40" ry="11" fill="${INKS.coal}" opacity="0.4"/>`;
      bg += `<rect x="${f1(ccx - dw2 / 2)}" y="1198" width="${f1(dw2)}" height="30" fill="${INKS.navy}" opacity="0.4"/>`;
      bg += `<line x1="${f1(ccx - dw2 / 2)}" y1="1198" x2="${f1(ccx + dw2 / 2)}" y2="1198" stroke="${INKS.platinum}" stroke-width="1" opacity="0.12"/>`;
      for (const wx of [ccx - dw2 / 2 + 30, ccx + dw2 / 2 - 30])
        bg += `<circle cx="${f1(wx)}" cy="${RAIL - 8}" r="8" fill="none" stroke="${INKS.platinum}" stroke-width="1" opacity="0.15"/>`;
      bg += `<line x1="${f1(ccx + dw2 / 2)}" y1="1212" x2="${f1(ccx + dw2 / 2 + 12)}" y2="1212" stroke="${INKS.platinum}" stroke-width="1" opacity="0.12"/>`;
    }

    return bg + lit;
  },
};
})();

STYLE_DEFS["ledgerline"] = (function () {
const PAGES = NATIVE_PAGES;
void PAGES;
// ledgerline · "market terrain" · one 10800x1350 composition, cut into 10 frames
//
// PAGE MAP (global x):
//   pg 1-2  BASE GRIND    crest low + calm (y~1150-1185, gentle undulation),
//                         sparse short wicks, whisper volume stubble, one dim
//                         scheduled pool riding the crest
//   pg 3    FIRST RISE    crest swells to y~935 near x~3040, brief pause, second
//                         push — wicks lengthen, hot hairline segments wake up
//   pg 4-5  DRAWDOWN      lower-high rollover x~4090 then the plunge — LANDMARK 1:
//                         tight V pit at x~4620-4960 (y~1300) with capitulation
//                         wick cluster, panic volume, cold gb pool; dead-cat
//                         bounce + soft retest (a small W-bottom) on the way out
//   pg 6-7  RECOVERY      steady climb; wick density/length + volume swell via a
//                         smooth dens() envelope (the "volume thickening")
//   pg 8    RALLY PEAK    LANDMARK 2 x~7820-8290 (y~700): ga glow + dot + double
//                         ring, ATH hairline segments fading rightward into 9-10
//   pg 9-10 PLATEAU TAPER crest settles y~870-910 under the ATH memory line,
//                         volatility + volume decay, back layers lift away
//                         (sep() envelope) — calm exit
//
// v3.2 ANATOMY PASS (all new detail on independent RNG channels, ch(tag) =
// mulberry32((seed^0xE7A0)+tag) — the original r() stream is untouched):
//   1  time-axis baseline y=1345 (platinum 0.045) + aperiodic tick stubs 5-9px
//   2  session shading: full-height navy bands 0.022-0.032, aperiodic widths,
//      occasional skip — behind everything
//   3  moving-average companion: lagged smooth of crest (window [-420,+140]),
//      platinum 0.10; crest+44 strata echo dimmed 0.10 -> 0.06 to compensate
//   4  candle-wick clusters at x~1750/6290/9500 around the close-dot events
//      (4-6 platinum hairs 0.22-0.30 + exactly ONE hue hair 0.30)
//   5  panic-volume swell: 14-20 extra floor bars under the pit (c.b 0.15-0.17
//      where panic>0.55, platinum 0.10 elsewhere)
//   6  peak-to-trough depth bracket at valleyX+~330 (platinum 0.11, 8px caps)
//   7  resistance-memory dashed hairline at the prior swing high (hiY), from
//      x=3120 to the recovery re-cross — behind the terrain, gridline-quiet
//   8  fifth whisper gridline y=1096-1166 (platinum 0.05) for pgs 1-2 sky
//   9  three exhaustion up-wicks into the rally top (2x c.a 0.30, 1x plat 0.26)
//  10  ATH-memory extension: 1-2 more c.a segments at 0.035/0.02 out to <=10600
//  11  taper-volume refinement x>8820: existing bars shortened by
//      (1-0.5*sep(x)), plus a sparse supplemental platinum pass 0.07/0.10
//
// DEPTH: 4 chart layers. Three parallax-shifted back layers (arc flattened
// 0.24 / 0.40 / 0.60, x-shifted, own noise) in neutral navy fills — far crests
// platinum hairlines, near-back crest c.b hairline — under the main silhouette
// (darkest fill). Crest color strategy: one neutral silver spine, plus c.a
// segments where the market climbs and c.b segments where it falls (opacity
// follows slope) — no cross-hue RGB lerp (mud). 3-4 whisper gridlines behind
// everything, occluded by the terrain like a real chart. Hue lives only in
// light: crest overlays, wicks, pools, the peak dot. Landmarks sit >=260px off
// every frame boundary; point features are edge-nudged. Nothing periodic:
// jittered anchors + noise + schedule() only.
// (helpers provided by the registry's shared toolkit)
return {
  key: 'ledgerline',
  name: 'market terrain',
  cat: 'green',
  desc: 'market-chart terrain: calm grind, sharp W-bottom drawdown, thickening recovery, rally peak, plateau taper',
  gen(seed, hue) {
    const c = HUES[hue], SW = PAGES * W, boost = glowAlphaBoost(hue);
    const r = mulberry32(seed + 29);
    const nzA = valueNoise1D(seed + 101), nzB = valueNoise1D(seed + 211);
    const nz1 = valueNoise1D(seed + 307), nz2 = valueNoise1D(seed + 401), nz3 = valueNoise1D(seed + 701);
    const nzE = valueNoise1D(seed + 509), nzF = valueNoise1D(seed + 601);
    const J = (s) => (r() - 0.5) * s;
    const sstep = (t) => { t = Math.min(1, Math.max(0, t)); return t * t * (3 - 2 * t); };

    const valleyX = 4620 + r() * 340; // landmark 1 — >=260px from x=4320/5400
    const peakX = 7820 + r() * 470;   // landmark 2 — >=260px from x=7560/8640

    // [x, y, volatility] macro anchors — cosine-interpolated rolling terrain
    const A = [
      [-140, 1168 + J(26), 0.32],
      [560 + J(110), 1148 + J(24), 0.28],
      [1240 + J(120), 1182 + J(22), 0.24],
      [1900 + J(120), 1152 + J(24), 0.30],
      [2520 + J(130), 1064 + J(34), 0.45],
      [3040 + J(120), 936 + J(36), 0.55],
      [3430 + J(110), 974 + J(26), 0.50],
      [3800 + J(110), 918 + J(26), 0.60],
      [4090 + J(80), 1034 + J(26), 0.72],
      [valleyX - 320, 1130 + J(22), 0.55],
      [valleyX - 120, 1238, 0.28],
      [valleyX, 1300, 0.10],
      [valleyX + 110, 1242, 0.32],
      [valleyX + 230, 1162 + J(16), 0.48],
      [valleyX + 400, 1186 + J(14), 0.40],
      [5980 + J(110), 1106 + J(24), 0.58],
      [6560 + J(100), 1022 + J(24), 0.66],
      [7050 + J(110), 952 + J(22), 0.70],
      [7420 + J(90), 856 + J(20), 0.72],
      [peakX - 170, 764 + J(14), 0.50],
      [peakX, 700 + J(14), 0.22],
      [peakX + 180, 786 + J(16), 0.44],
      [8880 + J(110), 872 + J(18), 0.38],
      [9460 + J(90), 902 + J(16), 0.28],
      [10160 + J(120), 884 + J(14), 0.22],
      [10940, 908 + J(12), 0.18],
    ];
    const macro = (x, k) => {
      let i = 0;
      while (i < A.length - 2 && x > A[i + 1][0]) i++;
      const t = Math.min(1, Math.max(0, (x - A[i][0]) / (A[i + 1][0] - A[i][0])));
      const s = 0.5 - 0.5 * Math.cos(Math.PI * t);
      return A[i][k] + (A[i + 1][k] - A[i][k]) * s;
    };
    const crest = (x) => macro(x, 1) + macro(x, 2) * ((nzA(x / 300) - 0.5) * 118 + (nzB(x / 105) - 0.5) * 42);
    // recovery volume envelope: swells from the valley, relaxes past the peak
    const dens = (x) => sstep((x - valleyX - 260) / 2500) * (1 - 0.72 * sstep((x - peakX - 240) / 1300));
    const panic = (x) => Math.exp(-((x - valleyX) / 470) * ((x - valleyX) / 470));
    // calm-exit layer separation envelope (pages 9-10)
    const sep = (x) => sstep((x - 8820) / 1700);
    const MID = 1058;
    const b1 = (x) => (macro(x - 430, 1) - MID) * 0.60 + MID - 118 - 92 * sep(x) + (nz1(x / 240) - 0.5) * 56;
    const b2 = (x) => (macro(x + 590, 1) - MID) * 0.40 + MID - 232 - 168 * sep(x) + (nz2(x / 330) - 0.5) * 66;
    const b3 = (x) => (macro(x + 1130, 1) - MID) * 0.24 + MID - 336 - 58 * sep(x) + (nz3(x / 430) - 0.5) * 48;
    // market mood along the crest: falling -> cold (c.b), rising -> hot (c.a)
    const heat = (x) => {
      const sl = (macro(x + 150, 1) - macro(x - 150, 1)) / 300;
      return Math.min(1, Math.max(0, 0.5 - sl * 4.2));
    };

    const STEP = 13;
    const areaPath = (fn) => {
      let d = `M-60 ${H + 60}`;
      for (let x = -60; x <= SW + 60; x += STEP) d += `L${x} ${fn(x).toFixed(1)}`;
      d += `L${SW + 60} ${H + 60}Z`;
      return d;
    };
    const linePath = (fn) => {
      let d = '';
      for (let x = -60; x <= SW + 60; x += STEP) d += `${d ? 'L' : 'M'}${x} ${fn(x).toFixed(1)}`;
      return d;
    };
    // nudge point features off frame-boundary x (never lands ON a cut)
    const clearEdge = (x) => { const m = ((x % W) + W) % W; return m < 22 ? x + (26 - m) : m > W - 22 ? x - (26 - (W - m)) : x; };
    const dodgeX = (x) => { const m = ((x % W) + W) % W; if (m < 170) return x + (175 - m); if (m > W - 170) return x - (m - (W - 170)) - 8; return x; };
    // v3.2: independent RNG channels for the anatomy pass — NEVER draw from r
    // here, so the original stream (landmarks, pools, wicks) stays byte-frozen
    const ch = (tag) => mulberry32((seed ^ 0xE7A0) + tag);

    let out = '';

    // ---- v3.2 #2: session shading — aperiodic full-height bands, alternating
    // presence with occasional skipped sessions (dead stretches), navy whisper
    const rS = ch(2);
    const sbx = schedule(rS, SW, 0.24, 0.62, 1.1);
    for (let i = 0; i + 1 < sbx.length; i += 2) {
      const skip = rS() < 0.22, sa = 0.026 + rS() * 0.006;
      if (skip) continue; // dead session — keep a stretch bandless
      const x0 = clearEdge(sbx[i]), x1 = clearEdge(Math.min(sbx[i + 1], x0 + 700));
      if (x1 - x0 < 200) continue;
      out += `<rect x="${x0.toFixed(0)}" y="0" width="${(x1 - x0).toFixed(0)}" height="${H}" fill="${INKS.navy}" opacity="${sa.toFixed(3)}"/>`;
    }

    // ---- whisper gridlines (3-4, uneven spacing, occluded by terrain) ----
    const gys = [248 + r() * 118, 474 + r() * 168, 704 + r() * 108, 948 + r() * 84];
    if (r() < 0.35) gys.splice(1 + Math.floor(r() * 3), 1);
    for (const gy of gys) out += `<line x1="0" y1="${gy.toFixed(0)}" x2="${SW}" y2="${gy.toFixed(0)}" stroke="${INKS.platinum}" stroke-width="1" opacity="${(0.05 + r() * 0.018).toFixed(3)}"/>`;
    // v3.2 #8: a fifth whisper gridline low enough to ride above the pg 1-2
    // base-grind crest, swallowed by the rising terrain from pg 3 onward
    const g5y = (1096 + ch(8)() * 70).toFixed(0);
    out += `<line x1="0" y1="${g5y}" x2="${SW}" y2="${g5y}" stroke="${INKS.platinum}" stroke-width="1" opacity="0.05"/>`;

    // v3.2 #7: resistance-memory hairline at the prior swing high — dashed with
    // jitter, drawn BEHIND the terrain so the drawdown ridge occludes it like
    // the gridlines; runs from the pg-3 high out to the recovery re-cross
    let hiY = 1e9;
    for (let x = 2900; x <= 3900; x += 13) hiY = Math.min(hiY, crest(x));
    hiY = Math.max(hiY + 2, 886); // never intrude on the text mid-band
    let rex = 7000;
    for (let x = 5600; x <= 7600; x += 13) { if (crest(x) <= hiY) { rex = x; break; } }
    const rR = ch(7);
    let dres = '';
    for (let x = 3120; x < rex;) {
      const dl = 4.5 + rR() * 5, gp = 8 + rR() * 6;
      dres += `M${x.toFixed(0)} ${hiY.toFixed(1)}h${dl.toFixed(1)}`;
      x += dl + gp;
    }
    out += `<path d="${dres}" fill="none" stroke="${INKS.platinum}" stroke-width="1" opacity="${(0.055 + rR() * 0.015).toFixed(3)}"/>`;

    // ---- depth layers: far -> near ----
    out += `<path d="${areaPath(b3)}" fill="${INKS.navy}" opacity="0.17"/>`;
    out += `<path d="${linePath(b3)}" fill="none" stroke="${INKS.platinum}" stroke-width="1" opacity="0.085"/>`;
    out += `<path d="${areaPath(b2)}" fill="${INKS.navy}" opacity="0.30"/>`;
    out += `<path d="${linePath(b2)}" fill="none" stroke="${INKS.platinum}" stroke-width="1" opacity="0.13"/>`;
    out += `<path d="${areaPath(b1)}" fill="${INKS.navy}" opacity="0.44"/>`;
    out += `<path d="${linePath(b1)}" fill="none" stroke="${c.b}" stroke-width="1" opacity="0.16"/>`;
    out += `<path d="${areaPath(crest)}" fill="${INKS.navy}" opacity="0.74"/>`;
    // strata echo hairlines inside the main terrain (noise-wobbled, not copies)
    out += `<path d="${linePath((x) => crest(x) + 44 + 30 * nzE(x / 640))}" fill="none" stroke="${INKS.platinum}" stroke-width="1" opacity="0.06"/>`;
    out += `<path d="${linePath((x) => crest(x) + 112 + 48 * nzF(x / 860))}" fill="none" stroke="${INKS.platinum}" stroke-width="1" opacity="0.07"/>`;
    // v3.2 #3: moving-average companion — lagged smooth of the crest (window
    // [-420,+140]): above price through the drawdown (death cross at the
    // rollover), below it through the recovery (golden cross). Strata echo
    // above was dimmed 0.10 -> 0.06 so total neutral ink stays flat.
    const ma = (x) => { let s = 0; for (let u = -420; u <= 140; u += 40) s += crest(x + u); return s / 15; };
    out += `<path d="${linePath(ma)}" fill="none" stroke="${INKS.platinum}" stroke-width="1" opacity="0.10"/>`;

    // ---- scheduled glow pools riding the crest (skip landmark zones) ----
    const gxs = schedule(r, SW, 1.4, 3.1, 2.2);
    let gi = r() < 0.5 ? 0 : 1;
    for (const gx of gxs) {
      const rad = 128 + r() * 80, po = 0.055 + r() * 0.026;
      if (Math.abs(gx - peakX) < 560 || Math.abs(gx - valleyX) < 560) continue;
      const gy = Math.max(crest(gx) + 70, 1015);
      const col = (gi++ % 2) ? c.ga : c.gb;
      out += `<circle cx="${gx.toFixed(0)}" cy="${gy.toFixed(0)}" r="${rad.toFixed(0)}" fill="${col}" opacity="${Math.min(0.11, po * boost).toFixed(3)}" filter="url(#nb-blur)"/>`;
    }
    // landmark 1: cold pool + colder core in the valley pit
    out += `<circle cx="${valleyX.toFixed(0)}" cy="1300" r="255" fill="${c.gb}" opacity="${Math.min(0.11, 0.085 * boost).toFixed(3)}" filter="url(#nb-blur)"/>`;
    out += `<circle cx="${(valleyX + 24).toFixed(0)}" cy="1330" r="115" fill="${c.gb}" opacity="${Math.min(0.11, 0.07 * boost).toFixed(3)}" filter="url(#nb-blur)"/>`;

    // ---- main crest: neutral spine + hot/cold hairline overlays (no hue lerp) ----
    out += `<path d="${linePath(crest)}" fill="none" stroke="${INKS.silver}" stroke-width="1.4" opacity="0.32"/>`;
    const SEG = STEP * 10;
    for (let x0 = -60; x0 < SW + 60; x0 += SEG) {
      const ht = heat(x0 + SEG / 2);
      // feathered activation: weak trends get whispers, only real moves saturate
      const hot = sstep((ht - 0.58) / 0.42), cold = sstep((0.42 - ht) / 0.42);
      if (hot < 0.1 && cold < 0.1) continue;
      let d = '';
      for (let x = x0; x <= Math.min(x0 + SEG, SW + 60); x += STEP) d += `${d ? 'L' : 'M'}${x} ${crest(x).toFixed(1)}`;
      if (hot >= 0.1) out += `<path d="${d}" fill="none" stroke="${c.a}" stroke-width="1.7" opacity="${Math.min(0.56, 0.06 + 0.5 * Math.pow(hot, 1.3)).toFixed(3)}"/>`;
      if (cold >= 0.1) out += `<path d="${d}" fill="none" stroke="${c.b}" stroke-width="1.7" opacity="${Math.min(0.52, 0.055 + 0.46 * Math.pow(cold, 1.3)).toFixed(3)}"/>`;
    }

    // ---- candle-wick ticks along the crest (aperiodic, envelope-driven) ----
    const txs = schedule(r, SW, 0.048, 0.16);
    for (const tx0 of txs) {
      const q = r(), flip = r() < 0.25, lenR = r(), colR = r(), keepR = r();
      const dw = Math.max(dens(tx0), 0.85 * panic(tx0));
      if (keepR > 0.30 + 0.60 * dw) continue;
      const tx = clearEdge(tx0);
      const len = Math.min(56, (11 + lenR * 15) * (0.7 + 1.6 * dw) * (0.8 + 0.5 * macro(tx, 2)));
      const sl = crest(tx + 26) - crest(tx - 26);
      const below = (sl > 0) !== flip; // falling slope -> down-wick (25% contrarian)
      const y1 = below ? crest(tx) + 5 : crest(tx) - 5;
      const y2 = below ? y1 + len : y1 - len;
      const ht = heat(tx), acc = q > 0.80;
      const col = acc ? (ht > 0.62 ? c.a : ht < 0.38 ? c.b : INKS.silver) : INKS.platinum;
      out += `<line x1="${tx.toFixed(0)}" y1="${y1.toFixed(0)}" x2="${tx.toFixed(0)}" y2="${y2.toFixed(0)}" stroke="${col}" stroke-width="1.6" opacity="${(acc ? 0.50 : 0.30 + colR * 0.16).toFixed(2)}"/>`;
    }
    // capitulation down-wick cluster in the pit + two hopeful up-wicks after
    const vwx = [-(196 + r() * 40), -(118 + r() * 34), -(44 + r() * 26), 34 + r() * 30, 96 + r() * 36];
    for (let k = 0; k < 5; k++) {
      const vx = clearEdge(valleyX + vwx[k]);
      const vy = crest(vx) + 6;
      const vl = (42 + r() * 30) * (1 + 0.7 * panic(vx));
      out += `<line x1="${vx.toFixed(0)}" y1="${vy.toFixed(0)}" x2="${vx.toFixed(0)}" y2="${Math.min(H - 6, vy + vl).toFixed(0)}" stroke="${c.b}" stroke-width="2" opacity="${(0.34 + r() * 0.16).toFixed(2)}"/>`;
    }
    for (const ux of [640 + r() * 70, 880 + r() * 80]) {
      const vx = clearEdge(valleyX + ux), vy = crest(vx) - 5;
      out += `<line x1="${vx.toFixed(0)}" y1="${vy.toFixed(0)}" x2="${vx.toFixed(0)}" y2="${(vy - 26 - r() * 16).toFixed(0)}" stroke="${c.a}" stroke-width="1.6" opacity="${(0.26 + r() * 0.1).toFixed(2)}"/>`;
    }
    out += `<circle cx="${valleyX.toFixed(0)}" cy="${(crest(valleyX) + 3).toFixed(1)}" r="3.4" fill="${c.gb}" opacity="0.52"/>`;

    // ---- whisper volume stubble along the floor (activity follows the arc) ----
    const bxs = schedule(r, SW, 0.017, 0.052);
    const vb = ['', '', '', ''];
    for (const bx0 of bxs) {
      const hR = r(), aR = r();
      const bx = clearEdge(bx0);
      const venv = Math.max(dens(bx), panic(bx));
      const bh = (4 + 30 * venv + 12 * hR) * (1 - 0.5 * sep(bx)); // v3.2 #11: shorter tape into the taper
      const seg = `M${bx.toFixed(0)} ${H - 8}L${bx.toFixed(0)} ${(H - 8 - bh).toFixed(1)}`;
      if (aR < 0.24 && panic(bx) > 0.55) vb[2] += seg;
      else if (aR < 0.22 && Math.abs(bx - peakX) < 520) vb[3] += seg;
      else vb[aR < 0.5 ? 0 : 1] += seg;
    }
    if (vb[0]) out += `<path d="${vb[0]}" fill="none" stroke="${INKS.platinum}" stroke-width="2" opacity="0.11"/>`;
    if (vb[1]) out += `<path d="${vb[1]}" fill="none" stroke="${INKS.platinum}" stroke-width="2" opacity="0.07"/>`;
    if (vb[2]) out += `<path d="${vb[2]}" fill="none" stroke="${c.b}" stroke-width="2" opacity="0.17"/>`;
    if (vb[3]) out += `<path d="${vb[3]}" fill="none" stroke="${c.a}" stroke-width="2" opacity="0.15"/>`;

    // ---- rare pale close-dots on the crest ----
    const dxs = schedule(r, SW, 1.1, 2.6, 1.8);
    for (const dx0 of dxs) {
      if (Math.abs(dx0 - peakX) < 420 || Math.abs(dx0 - valleyX) < 420) continue;
      const dx = clearEdge(dx0);
      out += `<circle cx="${dx.toFixed(0)}" cy="${(crest(dx) - 1).toFixed(1)}" r="2.3" fill="${c.c}" opacity="0.34"/>`;
    }

    // ---- landmark 2: rally peak marker + ATH hairline fading right ----
    const pY = crest(peakX);
    out += `<circle cx="${peakX.toFixed(0)}" cy="${(pY - 4).toFixed(0)}" r="130" fill="${c.ga}" opacity="${Math.min(0.11, 0.088 * boost).toFixed(3)}" filter="url(#nb-blur)"/>`;
    out += `<circle cx="${peakX.toFixed(0)}" cy="${(pY - 2).toFixed(1)}" r="26" fill="none" stroke="${c.a}" stroke-width="1" opacity="0.14"/>`;
    out += `<circle cx="${peakX.toFixed(0)}" cy="${(pY - 2).toFixed(1)}" r="13" fill="none" stroke="${c.a}" stroke-width="1.5" opacity="0.40"/>`;
    out += `<circle cx="${peakX.toFixed(0)}" cy="${(pY - 2).toFixed(1)}" r="4.4" fill="${c.ga}" opacity="0.55"/>`;
    let sx = peakX + 46 + r() * 30;
    const segOps = [0.18, 0.11, 0.06];
    for (let k = 0; k < 3; k++) {
      const ex = dodgeX(sx + 380 + r() * 260);
      out += `<line x1="${sx.toFixed(0)}" y1="${(pY - 2).toFixed(1)}" x2="${ex.toFixed(0)}" y2="${(pY - 2).toFixed(1)}" stroke="${c.a}" stroke-width="1" opacity="${segOps[k]}"/>`;
      sx = dodgeX(ex + 40 + r() * 60);
    }

    // ==== v3.2 anatomy pass — appended detail on independent channels ====

    // #1: time-axis baseline + aperiodic tick stubs (neutral ink, floor band)
    const rA = ch(1);
    out += `<line x1="0" y1="${H - 5}" x2="${SW}" y2="${H - 5}" stroke="${INKS.platinum}" stroke-width="1" opacity="0.045"/>`;
    const axs = schedule(rA, SW, 0.06, 0.22);
    let axd1 = '', axd2 = '';
    for (const ax0 of axs) {
      const ax = clearEdge(ax0), tl = 5 + rA() * 4;
      const tseg = `M${ax.toFixed(0)} ${H - 5}v-${tl.toFixed(1)}`;
      if (rA() < 0.5) axd1 += tseg; else axd2 += tseg;
    }
    if (axd1) out += `<path d="${axd1}" fill="none" stroke="${INKS.platinum}" stroke-width="1" opacity="0.062"/>`;
    if (axd2) out += `<path d="${axd2}" fill="none" stroke="${INKS.platinum}" stroke-width="1" opacity="0.088"/>`;

    // #4: candle-wick hairline clusters around the three quiet close-dot
    // events — platinum carries the read, exactly ONE hue hair per cluster
    const rW4 = ch(4);
    for (const cx0 of [1750, 6290, 9500]) {
      const cx = dodgeX(cx0);
      const nh = 4 + Math.floor(rW4() * 3);
      const hueIdx = Math.floor(rW4() * nh);
      for (let k = 0; k < nh; k++) {
        const hx = clearEdge(cx + (rW4() - 0.5) * 110);
        const up = rW4() < 0.5, hl = 10 + rW4() * 20, po = 0.22 + rW4() * 0.08;
        const y0 = crest(hx) + (up ? -4 : 4);
        const y1 = up ? y0 - hl : y0 + hl;
        const hued = k === hueIdx;
        const col = hued ? (heat(hx) > 0.62 ? c.a : c.b) : INKS.platinum;
        out += `<line x1="${hx.toFixed(0)}" y1="${y0.toFixed(1)}" x2="${hx.toFixed(0)}" y2="${y1.toFixed(1)}" stroke="${col}" stroke-width="1" opacity="${(hued ? 0.30 : po).toFixed(2)}"/>`;
      }
    }

    // #5: panic-volume densification — the histogram swells under the pit
    const rP = ch(5);
    const npb = 14 + Math.floor(rP() * 7);
    let pv1 = '', pv2 = '';
    for (let k = 0; k < npb; k++) {
      const px = clearEdge(valleyX - 620 + rP() * 1240);
      const pw = panic(px);
      const ph = 10 + rP() * 14 + 20 * pw;
      const seg = `M${px.toFixed(0)} ${H - 8}v-${ph.toFixed(1)}`;
      if (pw > 0.55) pv1 += seg; else pv2 += seg;
    }
    if (pv1) out += `<path d="${pv1}" fill="none" stroke="${c.b}" stroke-width="2" opacity="${(0.15 + rP() * 0.02).toFixed(3)}"/>`;
    if (pv2) out += `<path d="${pv2}" fill="none" stroke="${INKS.platinum}" stroke-width="2" opacity="0.10"/>`;

    // #6: peak-to-trough depth-marker bracket — prior-high level (hiY, shared
    // with the resistance line) down to pit depth, 8px caps, one-time detail
    const bkx = dodgeX(valleyX + 310 + ch(6)() * 40);
    out += `<path d="M${(bkx - 4).toFixed(0)} ${hiY.toFixed(1)}h8M${bkx.toFixed(0)} ${hiY.toFixed(1)}V1296M${(bkx - 4).toFixed(0)} 1296h8" fill="none" stroke="${INKS.platinum}" stroke-width="1" opacity="0.11"/>`;

    // #9: exhaustion up-wicks into the rally top (beside landmark 2 — the
    // landmark itself is frozen)
    const rX = ch(9);
    for (const [dxp, wcol, wop] of [[-140, c.a, 0.30], [-60, c.a, 0.30], [90, INKS.platinum, 0.26]]) {
      const wx = clearEdge(peakX + dxp), wl = 26 + rX() * 18;
      const wy = crest(wx) - 4;
      out += `<line x1="${wx.toFixed(0)}" y1="${wy.toFixed(1)}" x2="${wx.toFixed(0)}" y2="${(wy - wl).toFixed(1)}" stroke="${wcol}" stroke-width="1" opacity="${wop}"/>`;
    }

    // #10: ATH-memory extension — 1-2 more segments fading 0.035 -> 0.02,
    // dodged across the pg 9/10 cut, stopped before the edge-accent zone
    const rT = ch(10);
    let ax0 = sx;
    for (let k = 0; k < 2 && ax0 < 10380; k++) {
      let ax1 = dodgeX(Math.min(ax0 + 320 + rT() * 320, 10600));
      if (ax1 > 10600) ax1 = 10600;
      if (ax1 - ax0 < 120) break;
      out += `<line x1="${ax0.toFixed(0)}" y1="${(pY - 2).toFixed(1)}" x2="${ax1.toFixed(0)}" y2="${(pY - 2).toFixed(1)}" stroke="${c.a}" stroke-width="1" opacity="${k ? 0.02 : 0.035}"/>`;
      ax0 = dodgeX(ax1 + 30 + rT() * 50);
    }

    // #11: taper-volume supplement x>8820 — shorter but more frequent prints
    // so the tape calms instead of dying (platinum only)
    const rV = ch(11);
    let tv1 = '', tv2 = '';
    for (const vx0 of schedule(rV, SW, 0.02, 0.048)) {
      const keep = rV() < 0.38, hR2 = rV(), bkt = rV();
      if (vx0 < 8820 || !keep) continue;
      const vx = clearEdge(vx0);
      const vh = (5 + hR2 * 12) * (1 - 0.5 * sep(vx));
      const vseg = `M${vx.toFixed(0)} ${H - 8}v-${vh.toFixed(1)}`;
      if (bkt < 0.5) tv1 += vseg; else tv2 += vseg;
    }
    if (tv1) out += `<path d="${tv1}" fill="none" stroke="${INKS.platinum}" stroke-width="2" opacity="0.10"/>`;
    if (tv2) out += `<path d="${tv2}" fill="none" stroke="${INKS.platinum}" stroke-width="2" opacity="0.07"/>`;

    return out;
  },
};
})();

STYLE_DEFS["meltstream"] = (function () {
const PAGES = NATIVE_PAGES;
void PAGES;
// meltstream · molten channel · cat amber
//
// PAGE MAP (10800x1350, cut into 10 frames of 1080):
//  p1   THE POUR — dark angular slag structure hangs top-left; a tiny bright
//       origin pool (top quarter, y~360) spills a thin ribbon that bends
//       right and drops into the channel. Faint dry crack leads in from x=0.
//  p2-4 CALM WINDING — river wanders y 470-810 between layered dark banks
//       (far fill + darker near fill each side, platinum rim hairlines).
//       Page 2 runs high, page 3 dips low past bottom-bank terraces,
//       page 4 lifts again while banks begin converging; embers thicken.
//  p5   GORGE (landmark, once, >=0.22W off both boundaries) — top bank mass
//       dives, channel margins tighten to ~55px, river drops to y~1000
//       (bottom quarter), ribbon at max width with pale core + brightest glow.
//  p6-7 OXBOW EBB — tight S-meander while intensity collapses to a whisper
//       (~1px ribbon, no glow); an abandoned hairline oxbow scar loop floats
//       above the channel. Quietest stretch of the strip.
//  p8   TRIBUTARY — a cool gb ribbon slides out from behind the top bank,
//       sags down and merges; gb glow at the join, then a gb whisper current
//       rides the main river toward the delta.
//  p9   RECOVERED FLOW — gentle, mid-bright, banks easing apart.
//  p10  COOLING DELTA — banks recede wide; river fans into three staggered
//       threads (branch points and ends all off-boundary) that cool from
//       glow color to platinum and taper to nothing before the edge.
//
// All arc positions seed-jittered (offB nudges everything >=150px away from
// every k*1080). Color: structure = INKS only; hue lives in the ribbon,
// glows (ga/gb), lit rims, embers. gb carries the tributary/join so single
// hues read two-tone and blend reads amber-x-cobalt.
//
// v3.2 ENHANCEMENT PASS (casting-works anatomy). The legacy r() stream is
// FROZEN — every new element rides an independent rQ(tag) channel
// (mulberry32((seed^0xE7A0)+tag)) so pre-existing jitter and the gorge
// landmark hold. New structure is INKS-only; hue lives only in light:
//  p1   ladle/tundish trapezoid hung on two bail hairlines above the
//       platform block; ~140px pour fall (ga, pale-core upper half)
//       replaces the old 15px stub, inside the fixed source-glow footprint.
//  p1-2 runner-and-gate branches: 2-3 dead-end side channels that froze
//       off — hot ga mouths fading to cooled platinum hairlines.
//  p3   mold row seated on a strata hairline on the top bank; cooling-
//       strata shore lines (8/16/26px, fading outward) under the low ribbon.
//  p4   ingot stack below the bottom-bank crest (one still-hot c.a dot);
//       one ember-thickening cluster on the gorge approach.
//  p5   slag-crust rafts (coal lenses, c.a downstream rims) ride the bright
//       stretch; two turbulence spark-cluster fans at the constriction.
//  p6-7 ebb whisper segmented into cooling crust plates with 2-3px c.a hot
//       windows + <=2 transverse cracks; oxbow scar gets two sagging tie-in
//       necks down to the channel rim and stranded slag boulders.
//  p8   confluence spit (graphite wedge) keeps tributary/main separate to
//       the merge tip; gb chevron ripples trail downstream; join glow traded
//       to two lobes (r170 main + r90 tributary side — alpha-area <= before).
//  p9   one launder/gantry crossing: two 1px posts off the bottom-bank
//       crest, single 1px deck hairline spanning above the ribbon.
//  p10  pig-bed fingers off both outer delta threads (ga mouths nearest the
//       branch points, hue kept < x10300); the beaded down-thread converted
//       to the same crust-plate anatomy.
// (helpers provided by the registry's shared toolkit)
return {
  key: 'meltstream',
  name: 'molten channel',
  cat: 'amber',
  desc: 'molten river through slag banks: pour, gorge flare, oxbow ebb, cool delta',
  gen(seed, hue) {
    const c = HUES[hue], SW = PAGES * W, boost = glowAlphaBoost(hue);
    const r = mulberry32(seed + 9041);
    const nzRip = valueNoise1D(seed + 301);
    const nzI = valueNoise1D(seed + 511);
    const nzTB = valueNoise1D(seed + 97);
    const nzBB = valueNoise1D(seed + 131);
    const nzTN = valueNoise1D(seed + 177);
    const nzBN = valueNoise1D(seed + 223);
    const nzW = valueNoise1D(seed + 269);
    const nzT1 = valueNoise1D(seed + 331);
    const nzRid = valueNoise1D(seed + 401);
    const nzTh = valueNoise1D(seed + 449);
    const nzJ1 = valueNoise1D(seed + 601);
    const nzJ2 = valueNoise1D(seed + 647);

    const F = (n) => n.toFixed(1);
    const FO = (n) => n.toFixed(3); // opacities: F() would quantize to 0.0/0.1
    const G = (x, cx, s) => Math.exp(-((x - cx) * (x - cx)) / (2 * s * s));
    const ss = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
    const offB = (x) => { const m = x - Math.floor(x / W) * W; if (m < 150) return x + (150 - m) + 37; if (m > W - 150) return x - (m - (W - 150)) - 37; return x; };
    const smin = (a, b, k) => { const h = Math.max(0, Math.min(1, (b - a) / k * 0.5 + 0.5)); return a * h + b * (1 - h) - k * h * (1 - h); };
    const smax = (a, b, k) => -smin(-a, -b, k);
    // v3.2 enhancement channels — independent of the frozen r() stream
    const rQ = (tag) => mulberry32(((seed ^ 0xE7A0) + tag) | 0);
    let oxb = null, trib = null; // captured for the tie-in / spit passes

    // ---- arc anchors (all seeded, all nudged off frame boundaries) ----
    const xSrc = offB(330 + r() * 160);
    const gorgeX = offB(4644 + r() * 432);          // landmark, once
    const joinX = offB(7890 + r() * 260);
    const deltaX = offB(9860 + r() * 200);
    const oxDim = offB(6640 + r() * 200);            // oxbow dim center

    const kp = [
      [xSrc, 350 + r() * 20],
      [offB(xSrc + 620 + r() * 240), 540 + r() * 120],
      [offB(1900 + r() * 260), 470 + r() * 110],
      [offB(2800 + r() * 220), 700 + r() * 110],
      [offB(3720 + r() * 200), 580 + r() * 90],
      [gorgeX, 975 + r() * 45],
      [offB(5790 + r() * 220), 730 + r() * 90],
      [offB(6250 + r() * 120), 528 + r() * 60],
      [offB(6760 + r() * 120), 838 + r() * 60],
      [offB(7200 + r() * 110), 612 + r() * 60],
      [joinX, 680 + r() * 60],
      [offB(8840 + r() * 200), 545 + r() * 70],
      [deltaX, 705 + r() * 50],
      [SW, 680 + r() * 60],
    ];
    const ycRaw = (x) => {
      if (x <= kp[0][0]) return kp[0][1];
      for (let i = 0; i < kp.length - 1; i++) {
        if (x <= kp[i + 1][0]) {
          const u = (x - kp[i][0]) / (kp[i + 1][0] - kp[i][0]);
          const s2 = u * u * (3 - 2 * u);
          return kp[i][1] + (kp[i + 1][1] - kp[i][1]) * s2;
        }
      }
      return kp[kp.length - 1][1];
    };
    const yc = (x) => ycRaw(x) + (nzRip(x / 320) - 0.5) * 52 * ss(xSrc + 40, xSrc + 560, x);

    // brightness of the melt along its length (arc phases, all smooth)
    const inten = (x) => {
      let I = 0.5 + 0.16 * (nzI(x / 860) - 0.5) * 2
        + 0.52 * G(x, xSrc + 130, 330)
        + 0.70 * G(x, gorgeX, 380)
        + 0.30 * G(x, joinX + 170, 330);
      I *= 1 - 0.93 * G(x, oxDim, 500);
      I *= 1 - 0.96 * ss(deltaX - 260, SW - 260, x);
      return Math.max(0.02, Math.min(1.12, I));
    };
    const wid = (x) => Math.max(0.7, (0.5 + 7.0 * Math.pow(Math.min(1, inten(x)), 1.25)) * (0.88 + 0.24 * nzW(x / 240)));

    // ---- bank edges ----
    const widen = (x) => ss(deltaX - 650, SW - 160, x);
    const pinch = (x) => 0.88 * G(x, gorgeX, 430);
    const mT = (x) => 95 - 45 * G(x, gorgeX, 300);
    const topEdge = (x) => {
      const tb = 214 + 250 * nzTB(x / 1100) + 48 * (nzJ1(x / 260) - 0.5) * 2 - 170 * widen(x);
      const dive = tb + pinch(x) * Math.max(0, yc(x) - mT(x) - tb);
      return smin(Math.max(tb, dive), yc(x) - mT(x) + 20, 50);
    };
    const bottomEdge = (x) => {
      const bb = 1082 - 236 * nzBB(x / 1000) - 44 * (nzJ2(x / 240) - 0.5) * 2 + 150 * widen(x);
      return smax(bb, yc(x) + mT(x) - 12, 60);
    };
    const topNear = (x) => Math.max(26, topEdge(x) - 128 - 108 * nzTN(x / 380) - 30 * (nzJ2(x / 210) - 0.5) * 2);
    const bottomNear = (x) => Math.min(H - 16, bottomEdge(x) + 118 + 96 * nzBN(x / 360) + 28 * (nzJ1(x / 230) - 0.5) * 2);

    let out = '';

    // ---- far ridge whisper (deepest layer) ----
    {
      let d = '';
      for (let i = 0; i <= 200; i++) { const x = SW * i / 200; d += (i ? 'L' : 'M') + F(x) + ',' + F(296 + 148 * nzRid(x / 820)); }
      out += `<path d="${d}" fill="none" stroke="${INKS.platinum}" stroke-width="1" opacity="0.05"/>`;
    }

    // ---- bank fills ----
    const bank = (fy, topSide, fill, op) => {
      let d = 'M0,' + (topSide ? '0' : F(H));
      const n = 300;
      for (let i = 0; i <= n; i++) { const x = SW * i / n; d += 'L' + F(x) + ',' + F(fy(x)); }
      d += 'L' + F(SW) + ',' + (topSide ? '0' : F(H)) + 'Z';
      return `<path d="${d}" fill="${fill}" opacity="${op}"/>`;
    };
    out += bank(topEdge, true, INKS.navy, 0.15);
    out += bank(bottomEdge, false, INKS.navy, 0.15);

    // ---- strata segments inside both banks (layered slag, aperiodic) ----
    const stxs = schedule(r, SW, 0.75, 2.1, 2.6);
    for (const sx0 of stxs) {
      const top = r() < 0.48, len = 700 + r() * 1300, toff = 38 + r() * 120, wob = 18 + r() * 26, op = 0.05 + r() * 0.04;
      if (sx0 + len > SW - 80) continue;
      let d = '';
      const n = Math.ceil(len / 55);
      for (let i = 0; i <= n; i++) {
        const x = sx0 + len * i / n;
        const y = top ? topEdge(x) - toff + wob * (nzT1(x / 290) - 0.5) * 2 : bottomEdge(x) + toff + wob * (nzT1(x / 310) - 0.5) * 2;
        d += (i ? 'L' : 'M') + F(x) + ',' + F(Math.max(14, Math.min(H - 12, y)));
      }
      out += `<path d="${d}" fill="none" stroke="${INKS.platinum}" stroke-width="1" opacity="${F(op)}"/>`;
    }

    out += bank(topNear, true, INKS.graphite, 0.20);
    out += bank(bottomNear, false, INKS.graphite, 0.20);
    // crest hairlines on the near layers (helps the darker mass read as a layer)
    out += (() => { let d = ''; for (let i = 0; i <= 300; i++) { const x = SW * i / 300; d += (i ? 'L' : 'M') + F(x) + ',' + F(topNear(x)); } return `<path d="${d}" fill="none" stroke="${INKS.platinum}" stroke-width="1" opacity="0.09"/>`; })();
    out += (() => { let d = ''; for (let i = 0; i <= 300; i++) { const x = SW * i / 300; d += (i ? 'L' : 'M') + F(x) + ',' + F(bottomNear(x)); } return `<path d="${d}" fill="none" stroke="${INKS.platinum}" stroke-width="1" opacity="0.09"/>`; })();

    // ---- source structure (dark angular spout, top-left biased) ----
    const sx = xSrc, sy = kp[0][1] + 2;
    // massing block behind (a second silhouette for depth)
    out += `<path d="M${F(sx - 330)},0L${F(sx - 312)},${F(sy - 250)}L${F(sx - 366)},${F(sy - 236)}L${F(sx - 344)},${F(sy - 140)}L${F(sx - 250)},${F(sy - 118)}L${F(sx - 262)},0Z" fill="${INKS.navy}" opacity="0.14"/>`;
    out += `<path d="M${F(sx - 231)},0L${F(sx - 208)},${F(sy - 226)}L${F(sx - 254)},${F(sy - 206)}L${F(sx - 228)},${F(sy - 80)}L${F(sx - 144)},${F(sy - 58)}L${F(sx - 128)},${F(sy - 6)}L${F(sx + 6)},${F(sy - 8)}L${F(sx + 17)},${F(sy - 32)}L${F(sx + 66)},${F(sy - 46)}L${F(sx + 79)},${F(sy - 128)}L${F(sx + 139)},${F(sy - 146)}L${F(sx + 125)},0Z" fill="${INKS.graphite}" opacity="0.20"/>`;
    out += `<path d="M${F(sx - 254)},${F(sy - 206)}L${F(sx - 228)},${F(sy - 80)}L${F(sx - 144)},${F(sy - 58)}L${F(sx - 128)},${F(sy - 6)}L${F(sx + 6)},${F(sy - 8)}" fill="none" stroke="${INKS.platinum}" stroke-width="1.2" opacity="0.3"/>`;
    out += `<path d="M${F(sx + 17)},${F(sy - 32)}L${F(sx + 66)},${F(sy - 46)}L${F(sx + 79)},${F(sy - 128)}" fill="none" stroke="${INKS.platinum}" stroke-width="1" opacity="0.22"/>`;
    out += `<line x1="${F(sx - 126)}" y1="${F(sy - 5)}" x2="${F(sx + 5)}" y2="${F(sy - 7)}" stroke="${c.ga}" stroke-width="1.5" opacity="0.55"/>`;
    // dry crack leading in from the left edge
    {
      let d = '';
      for (let i = 0; i <= 14; i++) { const x = (sx - 230) * i / 14; d += (i ? 'L' : 'M') + F(x) + ',' + F(430 - 66 * (x / (sx - 230)) + 24 * nzT1(x / 170)); }
      out += `<path d="${d}" fill="none" stroke="${INKS.platinum}" stroke-width="1" opacity="0.06"/>`;
    }

    // ---- oxbow scar (abandoned loop, once) ----
    {
      const ox = offB(6700 + r() * 160), oy = yc(6700) - 205 - r() * 40, rot = -0.28 + r() * 0.2;
      oxb = { ox, oy, rot }; // capture only — no extra r() draws
      let d1 = '', d2 = '';
      for (let i = 0; i <= 26; i++) {
        const th = -0.42 * Math.PI + (1.56 * Math.PI) * i / 26;
        const ex = Math.cos(th) * 118, ey = Math.sin(th) * 62;
        d1 += (i ? 'L' : 'M') + F(ox + ex * Math.cos(rot) - ey * Math.sin(rot)) + ',' + F(oy + ex * Math.sin(rot) + ey * Math.cos(rot));
        if (i >= 4 && i <= 22) {
          const ex2 = Math.cos(th) * 97, ey2 = Math.sin(th) * 47;
          d2 += (i > 4 ? 'L' : 'M') + F(ox + ex2 * Math.cos(rot) - ey2 * Math.sin(rot)) + ',' + F(oy + ex2 * Math.sin(rot) + ey2 * Math.cos(rot));
        }
      }
      out += `<path d="${d1}" fill="none" stroke="${INKS.platinum}" stroke-width="1.4" opacity="0.13"/>`;
      out += `<path d="${d2}" fill="none" stroke="${c.gb}" stroke-width="1" opacity="0.10"/>`;
    }

    // ---- slag scarps (short tilted cracks on the banks, aperiodic) ----
    const sxs = schedule(r, SW, 0.28, 0.9);
    for (const x of sxs) {
      const top = r() < 0.45;
      const e1 = top ? topNear(x) : bottomEdge(x);
      const e2 = top ? topEdge(x) : bottomNear(x);
      const y0 = e1 + (e2 - e1) * (0.25 + 0.5 * r());
      const len = 60 + 140 * r(), tilt = (r() - 0.5) * 46, kink = (r() - 0.5) * 30;
      const lit = inten(x) > 0.85 && r() < 0.5;
      const col = lit ? (r() < 0.5 ? c.a : c.b) : INKS.platinum;
      out += `<path d="M${F(x)},${F(y0)}L${F(x + len * 0.55)},${F(y0 + tilt * 0.5 + kink)}L${F(x + len)},${F(y0 + tilt)}" fill="none" stroke="${col}" stroke-width="1" opacity="${lit ? '0.26' : F(0.07 + 0.05 * r())}"/>`;
    }

    // ---- rim hairlines along the channel-facing edges ----
    const rim = (fy, dy, op) => {
      let d = '';
      for (let i = 0; i <= 300; i++) { const x = SW * i / 300; d += (i ? 'L' : 'M') + F(x) + ',' + F(fy(x) + dy); }
      return `<path d="${d}" fill="none" stroke="${INKS.platinum}" stroke-width="1" opacity="${op}"/>`;
    };
    out += rim(topEdge, 0.5, 0.17);
    out += rim(bottomEdge, -0.5, 0.18);

    // ---- gorge wall light (part of the one landmark) ----
    for (const [side, x0g, x1g, opg] of [[1, gorgeX - 470 - r() * 60, gorgeX + 380 + r() * 60, 0.30], [0, gorgeX - 350 - r() * 50, gorgeX + 430 + r() * 50, 0.24]]) {
      let d = '';
      const n = Math.ceil((x1g - x0g) / 22);
      for (let i = 0; i <= n; i++) {
        const px = x0g + (x1g - x0g) * i / n;
        d += (i ? 'L' : 'M') + F(px) + ',' + F(side ? topEdge(px) + 1.6 : bottomEdge(px) - 1.6);
      }
      out += `<path d="${d}" fill="none" stroke="${c.ga}" stroke-width="1.3" opacity="${F(opg)}"/>`;
    }

    // ---- glows (river bloom, scheduled, neighbor-aware) ----
    const gxs = schedule(r, SW, 0.55, 1.5, 1.9);
    let runCol = '', runLen = 0;
    for (let i = 0; i < gxs.length; i++) {
      const jitY = (r() - 0.5) * 40, pick = r(), szr = r(), opr = r();
      // x-jitter (reusing the spare opr draw): the scheduler can emit a
      // near-even run of blooms whose beat reads as a metronome in the
      // autocorrelation; +-130px breaks any such run without touching the
      // seed stream
      const gx = gxs[i] + (opr - 0.5) * 260;
      if (gx < xSrc + 80 || gx > deltaX + 100) continue;
      const I = inten(gx);
      if (I < 0.15 || Math.abs(gx - gorgeX) < 320) continue;
      const gapPrev = i > 0 ? gx - gxs[i - 1] : Infinity;
      const gapNext = i < gxs.length - 1 ? gxs[i + 1] - gx : Infinity;
      const rad = Math.min(150 + szr * 160, 0.8 * Math.min(gapPrev, gapNext));
      // trim only blooms whose DISC substantially crosses a page cut (their
      // 90px blur would wash across it and can steal the brightest window
      // from the gorge under other seeds). Opacity-only, keyed to each glow's
      // seeded radius: a blanket per-page window or radius clamp reads as a
      // 1-page metronome in the autocorrelation.
      const md = gx % W, cutD = Math.min(md, W - md);
      const cutDamp = cutD < rad - 40 ? 0.75 : 1;
      let col = Math.abs(gx - joinX) < 750 ? (pick < 0.45 ? c.gb : c.ga) : (pick < 0.26 ? c.gb : c.ga);
      if (col === runCol && runLen >= 2) col = col === c.gb ? c.ga : c.gb;
      if (col === runCol) runLen++; else { runCol = col; runLen = 1; }
      out += `<circle cx="${F(gx)}" cy="${F(yc(gx) + jitY)}" r="${F(rad)}" fill="${col}" opacity="${FO(Math.min(0.105, (0.045 + 0.05 * Math.min(1, I)) * boost) * cutDamp)}" filter="url(#nb-blur)"/>`;
    }
    // fixed glows: source, gorge (landmark, brightest), tributary join
    out += `<circle cx="${F(xSrc + 15)}" cy="360" r="190" fill="${c.ga}" opacity="${FO(Math.min(0.07, 0.065 * boost))}" filter="url(#nb-blur)"/>`;
    out += `<circle cx="${F(gorgeX)}" cy="${F(yc(gorgeX) + 10)}" r="262" fill="${c.ga}" opacity="0.15" filter="url(#nb-blur)"/>`;
    // join glow traded to two lobes (v3.2 item 9c): r205 -> r170 main +
    // r90/0.05 tributary-side. Total alpha-area strictly below the old
    // single glow, so mean/p95 hold and the join stays dimmer than the gorge.
    out += `<circle cx="${F(joinX + 60)}" cy="${F(yc(joinX))}" r="170" fill="${c.gb}" opacity="${FO(Math.min(0.065, 0.05 * boost))}" filter="url(#nb-blur)"/>`;
    out += `<circle cx="${F(joinX - 140)}" cy="${F(yc(joinX) - 120)}" r="90" fill="${c.gb}" opacity="0.05" filter="url(#nb-blur)"/>`;

    // ---- lit rim segments (river light catching the bank edges) ----
    const rxs = schedule(r, SW, 0.5, 1.3);
    for (const x of rxs) {
      const topSide = r() < 0.5, len = 90 + 150 * r(), opr = r();
      const I = inten(x + len / 2);
      if (I < 0.55 || x + len > SW - 60) continue;
      let d = '';
      const n = Math.ceil(len / 18);
      for (let i = 0; i <= n; i++) { const px = x + len * i / n; d += (i ? 'L' : 'M') + F(px) + ',' + F((topSide ? topEdge(px) + 1.5 : bottomEdge(px) - 1.5)); }
      const col = Math.abs(x - joinX) < 700 ? c.gb : c.ga;
      out += `<path d="${d}" fill="none" stroke="${col}" stroke-width="1.2" opacity="${F(0.12 + 0.2 * Math.min(1, I) * (0.6 + 0.4 * opr))}"/>`;
    }

    // ---- ribbons ----
    const rib = (x0, x1, fy, fw, step, fill, op) => {
      let top = '', bot = '';
      const n = Math.max(2, Math.ceil((x1 - x0) / step));
      for (let i = 0; i <= n; i++) {
        const x = x0 + (x1 - x0) * i / n, y = fy(x), w = Math.max(0, fw(x)) / 2;
        top += (i ? 'L' : 'M') + F(x) + ',' + F(y - w);
        bot = 'L' + F(x) + ',' + F(y + w) + bot;
      }
      return `<path d="${top}${bot}Z" fill="${fill}" opacity="${op}"/>`;
    };

    // delta threads: platinum cooled underlays first, glow-color over
    const endC = Math.min(10620, offB(10470 + r() * 60));
    const branchU = offB(deltaX - 210 - r() * 70), devU = -(235 + r() * 90), endU = Math.min(10620, offB(10330 + r() * 80));
    const branchD = offB(deltaX + 120 + r() * 70), devD = 250 + r() * 90, endD = Math.min(10620, offB(10540 + r() * 80));
    const ycU = (x) => yc(x) + devU * ss(branchU, branchU + 560, x);
    const ycD = (x) => yc(x) + devD * ss(branchD, branchD + 560, x);
    const thW = (branch, end, amp) => (x) => amp * ss(branch, branch + 240, x) * (1 - ss(end - 430, end, x)) * (0.85 + 0.3 * nzTh(x / 200));
    out += rib(deltaX - 160, Math.min(10680, endC + 140), yc, (x) => 1.9 * ss(deltaX - 160, deltaX + 120, x) * (1 - ss(endC - 200, endC + 140, x)), 30, INKS.platinum, '0.14');
    out += rib(branchU + 160, Math.min(10680, endU + 130), ycU, (x) => 1.7 * ss(branchU + 160, branchU + 420, x) * (1 - ss(endU - 190, endU + 130, x)), 30, INKS.platinum, '0.13');
    out += rib(branchD + 160, Math.min(10680, endD + 130), ycD, (x) => 1.7 * ss(branchD + 160, branchD + 420, x) * (1 - ss(endD - 190, endD + 130, x)), 30, INKS.platinum, '0.13');
    out += rib(branchU, endU, ycU, thW(branchU, endU, 2.4), 28, c.ga, '0.32');
    out += rib(branchD, endD, ycD, thW(branchD, endD, 2.4), 28, c.ga, '0.32');

    // continuous whisper thread under the ribbon (keeps the dim oxbow unbroken)
    {
      let d = '';
      const n = Math.ceil((deltaX + 60 - xSrc) / 42);
      for (let i = 0; i <= n; i++) { const x = xSrc + (deltaX + 60 - xSrc) * i / n; d += (i ? 'L' : 'M') + F(x) + ',' + F(yc(x)); }
      out += `<path d="${d}" fill="none" stroke="${c.ga}" stroke-width="0.7" opacity="0.16"/>`;
    }
    // main molten ribbon (source to center-thread fade)
    out += rib(xSrc, endC, yc, (x) => wid(x) * (1 - ss(endC - 480, endC, x)), 26, c.ga, '0.42');

    // pale cores where the melt runs hottest (source + gorge only)
    const wc = (x) => Math.max(0, inten(x) - 0.8) * 4.6;
    out += rib(xSrc, xSrc + 700, yc, wc, 24, c.c, '0.5');
    out += rib(gorgeX - 820, gorgeX + 820, yc, wc, 24, c.c, '0.5');

    // gb whisper current after the join
    out += rib(joinX + 20, deltaX + 250, (x) => yc(x) + 4.5, (x) => 1.3 * ss(joinX + 20, joinX + 260, x) * (1 - ss(deltaX - 160, deltaX + 250, x)), 34, c.gb, '0.3');

    // tributary (cool gb, slides out from behind the top bank)
    {
      const tx0 = offB(7300 + r() * 120), ty0 = 130 + r() * 50, bow = 110 + r() * 80;
      trib = { tx0, ty0, bow }; // capture only — no extra r() draws
      const xJm = joinX + 40, yJ = yc(xJm) + 1;
      const txF = (t) => tx0 + (xJm - tx0) * Math.pow(t, 1.12);
      let top = '', bot = '';
      const n = 30;
      for (let i = 0; i <= n; i++) {
        const t = i / n, x = txF(t);
        const y = ty0 + (yJ - ty0) * (t * t * (3 - 2 * t)) + bow * Math.sin(2.7 * t) * (1 - t);
        const w = ((1.2 + 2.2 * t) * ss(0, 0.14, t) * (1 - ss(0.93, 1, t) * 0.5)) / 2;
        top += (i ? 'L' : 'M') + F(x) + ',' + F(y - w);
        bot = 'L' + F(x) + ',' + F(y + w) + bot;
      }
      out += `<path d="${top}${bot}Z" fill="${c.gb}" opacity="0.30"/>`;
      out += `<circle cx="${F(txF(0.74))}" cy="${F(ty0 + (yJ - ty0) * 0.74 + bow * 0.35)}" r="110" fill="${c.gb}" opacity="${FO(Math.min(0.055, 0.045 * boost))}" filter="url(#nb-blur)"/>`;
      // two cool sparks riding the tributary
      out += `<circle cx="${F(txF(0.3) + 8)}" cy="${F(ty0 + (yJ - ty0) * 0.28 + bow * 0.7 - 22)}" r="1.6" fill="${c.b}" opacity="0.4"/>`;
      out += `<circle cx="${F(txF(0.74) - 12)}" cy="${F(ty0 + (yJ - ty0) * 0.72 + bow * 0.35 - 30)}" r="1.2" fill="${c.b}" opacity="0.32"/>`;
    }

    // ---- ladle/tundish + pour fall + origin pool (v3.2 item 1) ----
    // The angular block reads as the casting platform; a trapezoid bucket
    // hangs off two bail hairlines and pours a long fall into the pool.
    // All added brightness stays inside the fixed source-glow footprint.
    {
      const rl = rQ(11);
      const bx = sx + (rl() - 0.5) * 18, tilt = (rl() - 0.5) * 10;
      const topY = 116 + rl() * 8, botY = topY + 106;
      const fx = bx + 56 + rl() * 8; // pour fall x, off the lip tip
      out += `<path d="M${F(bx - 75)},${F(topY + tilt)}L${F(bx + 75)},${F(topY - tilt)}L${F(bx + 48)},${F(botY)}L${F(bx - 46)},${F(botY - 4)}Z" fill="${INKS.graphite}" opacity="0.21"/>`;
      out += `<path d="M${F(bx + 48)},${F(botY)}L${F(bx + 74)},${F(botY - 9)}L${F(bx + 58)},${F(botY + 10)}Z" fill="${INKS.graphite}" opacity="0.22"/>`;
      out += `<line x1="${F(bx - 75)}" y1="${F(topY + tilt)}" x2="${F(bx + 75)}" y2="${F(topY - tilt)}" stroke="${INKS.platinum}" stroke-width="1" opacity="0.12"/>`;
      out += `<line x1="${F(bx - 52)}" y1="${F(topY + tilt * 0.69)}" x2="${F(bx - 55)}" y2="-6" stroke="${INKS.platinum}" stroke-width="1" opacity="0.13"/>`;
      out += `<line x1="${F(bx + 54)}" y1="${F(topY - tilt * 0.72)}" x2="${F(bx + 57)}" y2="-6" stroke="${INKS.platinum}" stroke-width="1" opacity="0.13"/>`;
      // pour fall: bright ga stream carrying a pale core in its upper half
      out += `<line x1="${F(fx)}" y1="${F(botY + 8)}" x2="${F(fx + 2)}" y2="${F(sy + 9)}" stroke="${c.ga}" stroke-width="2" opacity="0.5"/>`;
      out += `<line x1="${F(fx)}" y1="${F(botY + 8)}" x2="${F(fx + 1)}" y2="${F((botY + 8 + sy + 9) / 2)}" stroke="${c.c}" stroke-width="1" opacity="0.4"/>`;
      out += `<ellipse cx="${F(fx + 2)}" cy="${F(sy + 11)}" rx="15" ry="5" fill="${c.ga}" opacity="0.5"/>`;
      out += `<ellipse cx="${F(fx + 1)}" cy="${F(sy + 10)}" rx="5.5" ry="2" fill="${c.c}" opacity="0.55"/>`;
    }

    // ---- ember specks drifting above the melt ----
    const exs = schedule(r, SW, 0.055, 0.24);
    for (const ex of exs) {
      const gate = r(), hR = r(), sR = r(), oR = r(), cR = r(), tR = r();
      if (ex < xSrc + 40) continue;
      const I = inten(ex);
      if (gate > I + 0.18) continue;
      const y = Math.max(118, yc(ex) - 26 - 300 * Math.pow(hR, 1.6));
      const col = (Math.abs(ex - joinX) < 800 ? cR < 0.62 : cR < 0.3) ? c.b : c.a;
      const op = Math.min(0.6, (0.22 + 0.4 * oR) * Math.min(1, I + 0.25));
      out += `<circle cx="${F(ex)}" cy="${F(y)}" r="${F(1.1 + 2.3 * sR)}" fill="${col}" opacity="${F(op)}"/>`;
      if (tR < 0.35) out += `<line x1="${F(ex + 1)}" y1="${F(y - 3)}" x2="${F(ex + 3 - 4 * tR)}" y2="${F(y - 12 - 9 * tR)}" stroke="${col}" stroke-width="0.8" opacity="0.11"/>`;
    }
    // a few sparks rising off the pour itself
    for (let i = 0; i < 4; i++) {
      const px = sx - 45 + r() * 160 + i * 22, py = sy - 40 - r() * 190;
      out += `<circle cx="${F(px)}" cy="${F(py)}" r="${F(1 + r() * 1.5)}" fill="${r() < 0.7 ? c.a : c.b}" opacity="${F(0.25 + r() * 0.28)}"/>`;
    }

    // ================= v3.2 enhancement passes (appended) =================
    // Casting-works anatomy on independent rQ channels; neutral-ink
    // silhouettes/hairlines 0.05-0.28 plus rationed hue sparks/stubs.

    // (2) runner-and-gate branches: dead-end side channels that froze off
    {
      const rg = rQ(22);
      let bxr = xSrc + 260 + rg() * 220;
      const nBr = 2 + (rg() < 0.6 ? 1 : 0);
      for (let i = 0; i < nBr && bxr < 1900; i++) {
        const x0 = offB(bxr);
        const side = rg() < 0.62 ? 1 : -1; // mostly toward the open floor
        const ang = (20 + rg() * 15) * Math.PI / 180;
        const x1 = offB(x0 + (90 + rg() * 90) * Math.cos(ang));
        const y0 = yc(x0) + side * (wid(x0) / 2 - 0.5);
        const y1 = y0 + side * Math.tan(ang) * (x1 - x0);
        const mf = Math.min(0.6, (30 + rg() * 20) / Math.hypot(x1 - x0, y1 - y0));
        out += `<line x1="${F(x0)}" y1="${F(y0)}" x2="${F(x1)}" y2="${F(y1)}" stroke="${INKS.platinum}" stroke-width="1" opacity="${FO(0.10 + rg() * 0.03)}"/>`;
        out += `<line x1="${F(x0)}" y1="${F(y0)}" x2="${F(x0 + (x1 - x0) * mf)}" y2="${F(y0 + (y1 - y0) * mf)}" stroke="${c.ga}" stroke-width="1" opacity="0.20"/>`;
        bxr += (350 + rg() * 480) * (0.6 + rg() * 0.8); // +-40% jitter
      }
    }

    // (3) mold row (p3 top bank) / ingot stack (p4 bottom bank, one hot dot)
    {
      const rm = rQ(33);
      const cluster = (xa, xb, top, hotOne) => {
        const baseOff = (top ? 34 : 36) + rm() * 20;
        const bY = (x) => top ? topEdge(x) - baseOff : Math.min(H - 22, bottomNear(x) + baseOff);
        let x = offB(xa + rm() * 90);
        const nRects = 4 + Math.floor(rm() * 2.99);
        const hotIdx = Math.floor(rm() * nRects);
        const xStart = x;
        let xEnd = x, row = '';
        for (let i = 0; i < nRects && x < xb; i++) {
          const w2 = 30 + rm() * 25, h2 = 18 + rm() * 12;
          const yb = bY(x + w2 / 2);
          row += `<rect x="${F(x)}" y="${F(yb - h2)}" width="${F(w2)}" height="${F(h2)}" fill="${INKS.navy}" opacity="${FO(0.10 + rm() * 0.03)}"/>`;
          row += `<line x1="${F(x)}" y1="${F(yb - h2)}" x2="${F(x + w2)}" y2="${F(yb - h2)}" stroke="${INKS.platinum}" stroke-width="1" opacity="0.07"/>`;
          if (hotOne && i === hotIdx) row += `<circle cx="${F(x + w2 / 2)}" cy="${F(yb - h2 - 2)}" r="1" fill="${c.a}" opacity="0.25"/>`;
          xEnd = x + w2;
          x += w2 + (16 + rm() * 22) * (0.6 + rm() * 0.8); // +-40% jitter, no grid
        }
        let d = '';
        const nn = Math.max(2, Math.ceil((xEnd + 28 - xStart) / 30));
        for (let i = 0; i <= nn; i++) { const px = xStart - 14 + (xEnd + 28 - xStart) * i / nn; d += (i ? 'L' : 'M') + F(px) + ',' + F(bY(px)); }
        out += `<path d="${d}" fill="none" stroke="${INKS.platinum}" stroke-width="1" opacity="0.06"/>` + row;
      };
      cluster(2380, 3020, true, false);
      cluster(3520, 4120, false, true);
    }

    // (4) cooling-strata shore lines on the p3 bottom-bank terraces
    {
      const rs = rQ(44);
      const offs = [8, 16, 26], ops = [0.10, 0.07, 0.05];
      for (let j = 0; j < 3; j++) {
        if (j === 2 && rs() < 0.25) break; // 2-3 lines
        const xa = offB(2700 + rs() * 260 + j * 55);
        const xb = Math.min(3430, xa + 400 + rs() * 300); // ragged staggered ends
        const o = offs[j] + (rs() - 0.5) * 3;
        let d = '';
        const n = Math.ceil((xb - xa) / 40);
        for (let i = 0; i <= n; i++) { const x = xa + (xb - xa) * i / n; d += (i ? 'L' : 'M') + F(x) + ',' + F(yc(x) + wid(x) / 2 + o); }
        out += `<path d="${d}" fill="none" stroke="${INKS.platinum}" stroke-width="1" opacity="${FO(ops[j])}"/>`;
      }
    }

    // (5) slag-crust rafts riding the bright gorge stretch (net-darkening)
    {
      const rc = rQ(55);
      const nL = 3 + Math.floor(rc() * 2.99); // 3-5
      let lx = gorgeX - 560 + rc() * 160;
      for (let i = 0; i < nL && lx < gorgeX + 560; i++) {
        const cx2 = offB(lx);
        const rx = 7 + rc() * 13, ry = 1.5 + rc() * 1.2;
        const sideS = rc() < 0.5 ? -1 : 1; // off the pale-core centerline
        const cy2 = yc(cx2) + sideS * (ry + 0.8 + rc() * 1.6);
        out += `<ellipse cx="${F(cx2)}" cy="${F(cy2)}" rx="${F(rx)}" ry="${F(ry)}" fill="${INKS.coal}" opacity="${FO(0.35 + rc() * 0.15)}"/>`;
        out += `<path d="M${F(cx2 + rx - 5)},${F(cy2 - ry * 0.8)}Q${F(cx2 + rx + 1)},${F(cy2)} ${F(cx2 + rx - 5)},${F(cy2 + ry * 0.8)}" fill="none" stroke="${c.a}" stroke-width="1" opacity="0.30"/>`;
        lx += (140 + rc() * 260) * (0.65 + rc() * 0.7); // aperiodic
      }
    }

    // (6) turbulence spark clusters fanned above the gorge constriction
    {
      const rk = rQ(66);
      const centers = [offB(gorgeX - 300 + rk() * 150), offB(gorgeX + 90 + rk() * 190)];
      for (let ci = 0; ci < 2; ci++) {
        const cx3 = centers[ci];
        const baseY = yc(cx3) - wid(cx3) / 2 - 3;
        const nS = 5 + Math.floor(rk() * 3.99); // 5-8 each; total speck budget ~25 shared with (12)
        for (let i = 0; i < nS; i++) {
          const th2 = (-90 + (rk() - 0.5) * 60) * Math.PI / 180; // ~60 deg fan
          const rad = 18 + Math.pow(rk(), 1.3) * 105;
          const px2 = cx3 + Math.cos(th2) * rad, py2 = baseY + Math.sin(th2) * rad;
          const col2 = rk() < 0.55 ? c.a : c.b;
          out += `<circle cx="${F(px2)}" cy="${F(py2)}" r="${F(0.8 + rk() * 1.2)}" fill="${col2}" opacity="${FO(0.30 + rk() * 0.25)}"/>`;
          if (i < 3 && rk() < 0.8) out += `<line x1="${F(px2)}" y1="${F(py2)}" x2="${F(px2 + Math.cos(th2) * 8)}" y2="${F(py2 + Math.sin(th2) * 8)}" stroke="${col2}" stroke-width="0.8" opacity="0.12"/>`;
        }
      }
    }

    // (7) ebb whisper -> cooling crust plates with c.a hot windows (p6-7).
    // Coal understroke knocks the melt line back so the platinum plate
    // reads as skinned-over crust; alpha ~trades, net brightness unchanged.
    {
      const rp = rQ(77);
      let x = 6205 + rp() * 45, ticks = 0;
      while (x < 7075) {
        {
          const m = x - Math.floor(x / W) * W; // plates keep >=165px clear of cuts
          if (m < 165) x += (165 - m) + rp() * 25;
          else if (m > W - 165) x += (W - m) + 165 + rp() * 25;
        }
        let x1 = x + 20 + rp() * 40; // 20-60px plates, aperiodic
        const nc = (Math.floor(x / W) + 1) * W;
        if (x1 > nc - 165) x1 = Math.max(x + 12, nc - 165);
        if (x1 <= x + 6 || x >= 7075) break;
        let d = '';
        const n = Math.max(2, Math.ceil((x1 - x) / 14));
        for (let i = 0; i <= n; i++) { const px = x + (x1 - x) * i / n; d += (i ? 'L' : 'M') + F(px) + ',' + F(yc(px)); }
        out += `<path d="${d}" fill="none" stroke="${INKS.coal}" stroke-width="2" opacity="0.22"/>`;
        out += `<path d="${d}" fill="none" stroke="${INKS.platinum}" stroke-width="0.9" opacity="0.10"/>`;
        if (ticks < 2 && rp() < 0.14) { // 1-2 transverse crack ticks total
          const tx = x + (x1 - x) * (0.3 + rp() * 0.4), tl = 2 + rp() * 2;
          out += `<line x1="${F(tx)}" y1="${F(yc(tx) - tl)}" x2="${F(tx + 1.5)}" y2="${F(yc(tx) + tl)}" stroke="${INKS.platinum}" stroke-width="0.8" opacity="0.08"/>`;
          ticks++;
        }
        const hw = 2 + rp(); // 2-3px hot window glowing between plates
        if (x1 < 7070) out += `<line x1="${F(x1)}" y1="${F(yc(x1))}" x2="${F(x1 + hw)}" y2="${F(yc(x1 + hw))}" stroke="${c.a}" stroke-width="1.4" opacity="0.30"/>`;
        x = x1 + hw;
        if (rp() < 0.5) x += 18 + rp() * 34; // bare-whisper runs (<60px, stays optically continuous)
      }
    }

    // (8) oxbow tie-in necks + stranded slag boulders (loop itself untouched)
    if (oxb) {
      const ro = rQ(88);
      const pt = (th) => {
        const ex = Math.cos(th) * 118, ey = Math.sin(th) * 62;
        return [oxb.ox + ex * Math.cos(oxb.rot) - ey * Math.sin(oxb.rot), oxb.oy + ex * Math.sin(oxb.rot) + ey * Math.cos(oxb.rot)];
      };
      const [xA, yA] = pt(-0.42 * Math.PI), [xB, yB] = pt(1.14 * Math.PI);
      const neck = (x0, y0, dir) => {
        const xt = offB(x0 + dir * (60 + ro() * 40));
        const yt = yc(xt) - wid(xt) / 2 - 1;
        const mx = x0 + (xt - x0) * 0.45, my = y0 + (yt - y0) * 0.72; // sag below the chord
        out += `<path d="M${F(x0)},${F(y0)}Q${F(mx)},${F(my)} ${F(xt)},${F(yt)}" fill="none" stroke="${INKS.platinum}" stroke-width="1" opacity="0.08"/>`;
      };
      neck(xA, yA, 1); neck(xB, yB, -1);
      const nB2 = 2 + (ro() < 0.5 ? 1 : 0);
      for (let i = 0; i < nB2; i++) {
        out += `<circle cx="${F(oxb.ox - 40 + ro() * 80)}" cy="${F(oxb.oy - 10 + ro() * 30)}" r="${F(2 + ro() * 1.5)}" fill="${INKS.navy}" opacity="0.18"/>`;
      }
    }

    // (9a/9b) confluence spit + interference-ripple chevrons at the join
    if (trib) {
      const rj = rQ(99);
      const xJm = joinX + 40, yJ = yc(xJm) + 1;
      const tX = (t) => trib.tx0 + (xJm - trib.tx0) * Math.pow(t, 1.12);
      const tY = (t) => trib.ty0 + (yJ - trib.ty0) * (t * t * (3 - 2 * t)) + trib.bow * Math.sin(2.7 * t) * (1 - t);
      const tAt = (xq) => { let lo = 0, hi = 1; for (let i = 0; i < 30; i++) { const m = (lo + hi) / 2; if (tX(m) < xq) lo = m; else hi = m; } return (lo + hi) / 2; };
      const t0 = tAt(xJm - 200 - rj() * 15);
      let up = '', dn = '', tipT = 0.995, drew = 0;
      for (let i = 0; i <= 24; i++) {
        const t = t0 + (0.995 - t0) * i / 24;
        const x = tX(t), yu = tY(t) + 4, yl = yc(x) - wid(x) / 2 - 1.5;
        if (yu >= yl - 1) { tipT = t; break; }
        up += (drew ? 'L' : 'M') + F(x) + ',' + F(yu);
        dn = 'L' + F(x) + ',' + F(yl) + dn;
        drew++;
      }
      if (drew > 1) {
        const xt2 = tX(tipT);
        out += `<path d="${up}L${F(xt2)},${F(yc(xt2) - wid(xt2) / 2 - 2)}${dn}Z" fill="${INKS.graphite}" opacity="0.28"/>`;
      }
      let cxv = xJm + 26 + rj() * 22;
      const nCh = 3 + (rj() < 0.5 ? 1 : 0);
      for (let i = 0; i < nCh; i++) {
        const h2 = 4 + rj() * 3, yv = yc(cxv);
        out += `<path d="M${F(cxv)},${F(yv - h2)}L${F(cxv + 11)},${F(yv)}L${F(cxv)},${F(yv + h2)}" fill="none" stroke="${c.gb}" stroke-width="0.8" opacity="0.18"/>`;
        cxv += (34 + rj() * 30) * (0.7 + rj() * 0.6);
      }
    }

    // (10) one launder/gantry crossing on p9 — neutral ink only
    {
      const rt = rQ(110);
      const gx = offB(8950 + rt() * 400);
      const po = 70 + rt() * 35;
      const xL = gx - po, xR = gx + po + rt() * 20;
      const deckY = yc(gx) - 78 - rt() * 28; // above the ribbon, below the crest
      out += `<line x1="${F(xL)}" y1="${F(deckY)}" x2="${F(xL)}" y2="${F(bottomEdge(xL) - 1)}" stroke="${INKS.platinum}" stroke-width="1" opacity="0.10"/>`;
      out += `<line x1="${F(xR)}" y1="${F(deckY)}" x2="${F(xR)}" y2="${F(bottomEdge(xR) - 1)}" stroke="${INKS.platinum}" stroke-width="1" opacity="0.10"/>`;
      out += `<line x1="${F(xL - 16)}" y1="${F(deckY)}" x2="${F(xR + 16)}" y2="${F(deckY)}" stroke="${INKS.platinum}" stroke-width="1" opacity="0.12"/>`;
    }

    // (11) pig-bed fingers on the outer delta threads + down-thread crust
    {
      const rf = rQ(121);
      const fingers = (yF, xa, xb) => {
        let x = xa + rf() * 60, hued = 0;
        const nF = 3 + (rf() < 0.5 ? 1 : 0);
        for (let i = 0; i < nF && x < xb; i++) {
          const x0 = offB(x);
          const sideF = rf() < 0.5 ? -1 : 1;
          const ang = (40 + rf() * 20) * Math.PI / 180;
          let len = 35 + rf() * 35;
          const slope = (yF(x0 + 12) - yF(x0 - 12)) / 24;
          const a2 = Math.atan2(slope, 1) + sideF * ang;
          if (x0 + Math.cos(a2) * len > 10640) len = Math.max(10, (10640 - x0) / Math.max(0.2, Math.cos(a2))); // ink ends >=160px off the edge
          const x1 = x0 + Math.cos(a2) * len, y1 = yF(x0) + Math.sin(a2) * len;
          out += `<line x1="${F(x0)}" y1="${F(yF(x0))}" x2="${F(x1)}" y2="${F(y1)}" stroke="${INKS.platinum}" stroke-width="1" opacity="${FO(0.10 + rf() * 0.03)}"/>`;
          if (hued < 2 && x0 < 10285) { // hot ga mouths nearest the branch, hue < x10300
            const mfr = Math.min(0.5, (12 + rf() * 6) / len);
            out += `<line x1="${F(x0)}" y1="${F(yF(x0))}" x2="${F(x0 + (x1 - x0) * mfr)}" y2="${F(yF(x0) + (y1 - yF(x0)) * mfr)}" stroke="${c.ga}" stroke-width="1" opacity="0.18"/>`;
            hued++;
          }
          x += (95 + rf() * 130) * (0.55 + rf() * 0.9); // +-45% jitter — no comb
        }
      };
      fingers(ycU, 9840, 10360);
      fingers(ycD, 10230, 10480);
      // down-thread beading -> deliberate crust plates (as in pass 7)
      let xd = 10235 + rf() * 30;
      while (xd < 10545) {
        const x1 = Math.min(10560, xd + 18 + rf() * 34);
        let d = '';
        const n = Math.max(2, Math.ceil((x1 - xd) / 14));
        for (let i = 0; i <= n; i++) { const px = xd + (x1 - xd) * i / n; d += (i ? 'L' : 'M') + F(px) + ',' + F(ycD(px)); }
        out += `<path d="${d}" fill="none" stroke="${INKS.coal}" stroke-width="1.8" opacity="0.18"/>`;
        out += `<path d="${d}" fill="none" stroke="${INKS.platinum}" stroke-width="0.8" opacity="0.10"/>`;
        const hw = 2 + rf() * 0.8;
        if (x1 < 10420) out += `<line x1="${F(x1)}" y1="${F(ycD(x1))}" x2="${F(x1 + hw)}" y2="${F(ycD(x1 + hw))}" stroke="${c.a}" stroke-width="1.3" opacity="0.25"/>`;
        xd = x1 + hw + (rf() < 0.45 ? 14 + rf() * 26 : 0);
      }
    }

    // (12) ember-thickening cluster on the p4 gorge approach
    {
      const re2 = rQ(132);
      const cx4 = offB(3950 + re2() * 280);
      const n4 = 4 + Math.floor(re2() * 2.99); // 4-6, inside the shared ~25-speck budget
      for (let i = 0; i < n4; i++) {
        const x4 = cx4 + (re2() - 0.5) * 240;
        const hy = 18 + Math.pow(re2(), 1.4) * 150;
        out += `<circle cx="${F(x4)}" cy="${F(yc(x4) - wid(x4) / 2 - hy)}" r="${F(0.8 + re2() * 1.0)}" fill="${re2() < 0.6 ? c.a : c.b}" opacity="${FO(0.25 + re2() * 0.15)}"/>`;
      }
    }

    return out;
  },
};
})();

STYLE_DEFS["mintvault"] = (function () {
const PAGES = NATIVE_PAGES;
void PAGES;
// mintvault · vault colonnade — ONE 10800x1350 native-infinity composition.
//
// PAGE MAP (10 frames of 1080; every feature crosses boundaries mid-feature,
// all phase breakpoints are seed-jittered and never sit on k*1080):
//  1 [0    -1080 ] blank vault wall: cornice + floor hairlines, sparse masonry
//                  joints; the first pillar fades in near the right edge
//  2 [1080 -2160 ] colonnade wakes: pillars reach full presence, first lit seam
//  3 [2160 -3240 ] full colonnade: rolling height wave, open bay, a cool seam
//  4 [3240 -4320 ] tall pillar run, uneven warm seam pair
//  5 [4320 -5400 ] hall opens up: density eases, seams dim — the approach
//  6 [5400 -6480 ] LANDMARK once: arch aperture (center in [5720,6120], always
//                  >=0.22W from both boundaries) glowing ga from within, floor
//                  light pool, lit jamb rims, warm streak on the cornice above
//  7 [6480 -7560 ] lit-seam cluster: several close (never even) mixed-hue seams
//  8 [7560 -8640 ] colonnade dissolves mid-frame into a blank wall stretch
//  9 [8640 -9720 ] sparse faint pillars resume out of the dark, unlit
// 10 [9720 -10800] last pillar pair, ONE cool gb seam, cornice/floor hairlines
//                  fade out — dark exit
//
// Structure is neutral (platinum/silver); ALL hue lives in light: seam glows
// (ga/gb), crisp seam lines + rim lights (a/b), one rare pale-c floor pool at
// the landmark. Blurred shapes keep min dimension ~200+ so the nb-blur filter
// region never clips into visible edges.
//
// v3.2 anatomy pass (whisper grade — crisp <=0.16, area glows <=0.10; the
// landmarks, act structure and luminance budget are unchanged):
//  · p6 vault-door artifacts: spoke handwheel + hub, rivet ring in the 13px
//    arch band, strap-hinge plates on the left jamb, machined threshold sill
//    with a ga wear glow — all inside the existing aperture/jamb footprint
//  · p1 rescue: guaranteed cornice dentil run + ONE distant gb sconce pair
//    (second kit hue on the strip's only hue-less page); dentils elsewhere
//    come and go with corN presence noise
//  · both blank walls: staggered ashlar joints (per-course segments offset
//    half a block — real bonds never run continuous verticals)
//  · colonnade: two-step plinths + necking-ring capitals, floor reflection
//    stubs under rim-lit pillar edges (p2-4 + cluster), and a guard-rail
//    whisper line with aperiodic stanchions low in the frame
//  · p7 cluster: one transitional bay each side (620->460->330 accelerando;
//    inserted AFTER seam selection so the gap list and rS stream match the
//    pre-v3.2 build byte-for-byte) and a cool-guarantee (>=2 cool cluster
//    seams on every seed — recolor-only, geometry frozen at selection)
// New detail rides its own RNG channels (mulberry32((seed^0xE7A0)+tag)) so
// the legacy r/rB/rS/rC streams are untouched and nothing re-jitters.
// (helpers provided by the registry's shared toolkit)
return {
  key: 'mintvault',
  name: 'vault colonnade',
  cat: 'green',
  desc: 'dark vault colonnade, faint lit seams, one glowing arch aperture',
  gen(seed, hue) {
    const c = HUES[hue], SW = PAGES * W, boost = glowAlphaBoost(hue);
    const rEnv = mulberry32(seed * 3 + 11);   // envelopes + arch + exit geometry
    const r = mulberry32(seed + 17);          // front pillars
    const rB = mulberry32(seed * 13 + 457);   // back pillars
    const rS = mulberry32(seed * 29 + 7);     // seams
    const rC = mulberry32(seed * 31 + 3);     // cornice / floor / joints
    // v3.2 anatomy pass: independent channels — never insert draws into the
    // legacy streams above (mid-sequence re-jitter shifts the whole strip)
    const rDw = mulberry32((seed ^ 0xE7A0) + 1); // door: wheel, rivets, hinges
    const rDe = mulberry32((seed ^ 0xE7A0) + 2); // cornice dentils
    const rSc = mulberry32((seed ^ 0xE7A0) + 3); // p1 sconce pair
    const rAs = mulberry32((seed ^ 0xE7A0) + 4); // staggered ashlar
    const rGr = mulberry32((seed ^ 0xE7A0) + 5); // guard-rail stanchions
    const hN = valueNoise1D(seed + 31), wN = valueNoise1D(seed + 57);
    const corN = valueNoise1D(seed + 91), floN = valueNoise1D(seed + 133);
    const y0 = 1208, y0b = 1152, CY = 236;
    const cap = (v, mx) => (v > mx ? mx : v);
    const f0 = (v) => v.toFixed(0), f3 = (v) => v.toFixed(3);

    // ---- authored envelopes (smoothstep between jittered nodes) -----------
    const jn = (x) => x + (rEnv() - 0.5) * 140;
    const mkEnv = (nodes) => (x) => {
      if (x <= nodes[0][0]) return nodes[0][1];
      for (let i = 1; i < nodes.length; i++) if (x < nodes[i][0]) {
        const a = nodes[i - 1], b = nodes[i];
        const t = (x - a[0]) / (b[0] - a[0]), u = t * t * (3 - 2 * t);
        return a[1] + (b[1] - a[1]) * u;
      }
      return nodes[nodes.length - 1][1];
    };
    // pillar presence density
    const dens = mkEnv([[0, 0], [jn(930), 0], [jn(1720), 0.86], [jn(4080), 0.86],
      [jn(5160), 0.66], [jn(6330), 0.90], [jn(7390), 0.90], [jn(7965), 0],
      [jn(8735), 0], [jn(8930), 0.48], [jn(10130), 0.48], [jn(10520), 0], [SW, 0]]);
    // lit-seam probability
    const seamP = mkEnv([[0, 0], [jn(1530), 0], [jn(1865), 0.26], [jn(4060), 0.26],
      [jn(4470), 0.12], [jn(6515), 0.12], [jn(6660), 0.62], [jn(7395), 0.62],
      [jn(7690), 0], [SW, 0]]);
    const clLo = 6600 + rEnv() * 90, clHi = 7370 + rEnv() * 90; // cluster window
    // end-of-strip fade for the long hairlines (dark exit)
    const endFade = (x) => (x < 10240 ? 1 : x > 10680 ? 0 : 1 - Math.pow((x - 10240) / 440, 2) * (3 - 2 * (x - 10240) / 440));

    // ---- landmark + exit geometry -----------------------------------------
    const archX = 5720 + rEnv() * 400;                 // >=320 from x=5400/6480
    const halfW = 132 + rEnv() * 26, spring = 520 + rEnv() * 50;
    const ry = halfW * 1.18, apex = spring - ry;
    const jwL = 56 + rEnv() * 14, jwR = 56 + rEnv() * 14;
    const jTopL = 245 + rEnv() * 45, jTopR = 245 + rEnv() * 45;
    const exX = 10040 + rEnv() * 280;                  // final cool seam center
    const exHalf = 88 + rEnv() * 28;

    // ---- front pillars ------------------------------------------------------
    const pillars = [];
    for (const x of schedule(r, SW, 0.15, 0.46, 0.6)) {
      const roll = r();
      if (roll >= dens(x)) continue;
      if (Math.abs(x - archX) < halfW + Math.max(jwL, jwR) + 46) continue;
      if (Math.abs(x - exX) < exHalf + 150) continue;
      const w = 30 + 56 * Math.pow(wN(x * 0.0037), 1.15) + r() * 12;
      const top = 285 + 330 * hN(x * 0.00115) + r() * 80;
      pillars.push({ cx: x, w, top, m: 0.35 + 0.65 * cap(dens(x) / 0.86, 1) });
    }
    // jamb pillars flanking the aperture (the landmark appears exactly once)
    pillars.push({ cx: archX - halfW - jwL / 2 - 8, w: jwL, top: jTopL, m: 1, jamb: 'L' });
    pillars.push({ cx: archX + halfW + jwR / 2 + 8, w: jwR, top: jTopR, m: 1, jamb: 'R' });
    // final pillar pair framing the exit seam (page 10)
    pillars.push({ cx: exX - exHalf, w: 38 + rEnv() * 10, top: 430 + rEnv() * 120, m: 0.68, ex: true });
    pillars.push({ cx: exX + exHalf, w: 38 + rEnv() * 10, top: 430 + rEnv() * 120, m: 0.68, ex: true });
    pillars.sort((a, b) => a.cx - b.cx);
    // densify the arc windows: split any over-wide gap (jittered, aperiodic)
    // so the lit-seam guarantees below always have eligible gaps — unlucky
    // seeds otherwise render a dark cluster and the arc dies
    // (cluster tightens to ~330px bays so 4+ lit slots fit — the colonnade
    // visibly bunches up where the light concentrates)
    // NOTE: the v3.2 transitional bays are NOT added here — they are inserted
    // after seam selection (own RNG channel) so this loop, the gap list and
    // the whole rS stream stay byte-identical to the pre-v3.2 build
    for (const [lo, hi, maxGap] of [[1700, 4270, 620], [4380, 5100, 620], [clLo - 60, clHi + 60, 330]]) {
      for (let pass = 0; pass < 5; pass++) {
        let did = false;
        for (let i = 0; i + 1 < pillars.length; i++) {
          const gL = pillars[i].cx + pillars[i].w / 2, gR = pillars[i + 1].cx - pillars[i + 1].w / 2;
          // split any over-wide gap OVERLAPPING the window (mids can fall
          // outside it when a gap runs past the window edge)
          const iLo = Math.max(gL + 70, lo), iHi = Math.min(gR - 70, hi);
          if (gR - gL <= maxGap || iHi - iLo < 40) continue;
          const nx = iLo + (0.25 + r() * 0.5) * (iHi - iLo);
          if (Math.abs(nx - archX) < halfW + Math.max(jwL, jwR) + 46) continue;
          if (Math.abs(nx - exX) < exHalf + 150) continue;
          const w = 30 + 56 * Math.pow(wN(nx * 0.0037), 1.15) + r() * 12;
          const top = 285 + 330 * hN(nx * 0.00115) + r() * 80;
          pillars.splice(i + 1, 0, { cx: nx, w, top, m: 0.35 + 0.65 * cap(dens(nx) / 0.86, 1) });
          did = true; i++;
        }
        if (!did) break;
      }
    }

    let out = '';

    // ---- floor haze: faint platinum air pockets tie all phases together ----
    for (const x of schedule(rC, SW, 0.55, 1.25)) {
      const hz = 0.016 + 0.02 * floN(x * 0.0011 + 77) + rC() * 0.006;
      out += `<ellipse cx="${f0(x)}" cy="${f0(y0 - 24 - rC() * 46)}" rx="${f0(280 + rC() * 180)}" ry="${f0(120 + rC() * 50)}" fill="${INKS.platinum}" opacity="${f3(cap(hz * endFade(x), 0.038))}" filter="url(#nb-blur)"/>`;
    }

    // ---- back layer (depth): thinner, fainter, higher floor ----------------
    // envelope lags the front by ~220px so the back rank lingers as the front
    // dissolves into wall (and wakes first coming out of it) — smoother phases
    const densB = (x) => Math.max(dens(x - 220), dens(x + 220) * 0.55);
    for (const x of schedule(rB, SW, 0.10, 0.27)) {
      const roll = rB();
      if (roll >= densB(x) * 0.85) continue;
      if (Math.abs(x - archX) < halfW + 90) continue;
      let hid = false;
      for (const p of pillars) if (Math.abs(x - p.cx) < p.w * 0.5 + 8) { hid = true; break; }
      if (hid) continue;
      const wb = 16 + rB() * 18, tb = 640 + 260 * hN(x * 0.0009 + 50) + rB() * 80;
      const mb = 0.3 + 0.7 * cap(densB(x) / 0.93, 1);
      const m1 = tb + (y0b - tb) * (0.26 + rB() * 0.14), m2b = tb + (y0b - tb) * (0.55 + rB() * 0.14);
      out += `<rect x="${f0(x - wb / 2)}" y="${f0(tb)}" width="${f0(wb)}" height="${f0(m1 - tb)}" fill="${INKS.platinum}" opacity="${f3(0.032 * mb)}"/>`
        + `<rect x="${f0(x - wb / 2)}" y="${f0(m1)}" width="${f0(wb)}" height="${f0(m2b - m1)}" fill="${INKS.platinum}" opacity="${f3(0.048 * mb)}"/>`
        + `<rect x="${f0(x - wb / 2)}" y="${f0(m2b)}" width="${f0(wb)}" height="${f0(y0b - m2b)}" fill="${INKS.platinum}" opacity="${f3(0.062 * mb)}"/>`;
    }

    // ---- arch interior glow (behind the jambs) ------------------------------
    const xLA = archX - halfW, xRA = archX + halfW;
    const archPath = `M ${f0(xLA)} ${f0(y0)} L ${f0(xLA)} ${f0(spring)} A ${f0(halfW)} ${f0(ry)} 0 0 1 ${f0(xRA)} ${f0(spring)} L ${f0(xRA)} ${f0(y0)}`;
    // faint veil over the whole opening, then light that POOLS low and blooms up
    out += `<path d="${archPath} Z" fill="${c.ga}" opacity="${f3(cap(0.045 * boost, 0.055))}" filter="url(#nb-blur)"/>`;
    out += `<rect x="${f0(archX - 105)}" y="${f0(y0 - 340)}" width="210" height="348" fill="${c.ga}" opacity="${f3(cap(0.095 * boost, 0.11))}" filter="url(#nb-blur)"/>`;
    out += `<ellipse cx="${f0(archX)}" cy="${f0(y0 - 118)}" rx="150" ry="200" fill="${c.ga}" opacity="${f3(cap(0.06 * boost, 0.075))}" filter="url(#nb-blur)"/>`;
    out += `<circle cx="${f0(archX)}" cy="${f0(apex + 96)}" r="118" fill="${c.ga}" opacity="${f3(cap(0.03 * boost, 0.038))}" filter="url(#nb-blur)"/>`;

    // ---- front pillars -------------------------------------------------------
    // shaft renderer shared with the v3.2 transitional bays; called with the
    // legacy r stream for the main rank so the draw order is unchanged
    const drawShaft = (p, rg) => {
      const { cx, w, top, m } = p;
      const x = cx - w / 2, span = y0 - top;
      // smooth upward fade: cumulative stack of 9 fine low-alpha rects with
      // per-pillar jittered split heights — deltas stay <=0.015 so no ledge
      // ever reads as a band, and no split aligns across pillars
      out += `<rect x="${f0(x)}" y="${f0(top - 130)}" width="${f0(w)}" height="90" fill="${INKS.platinum}" opacity="${f3(0.006 * m)}"/>`
        + `<rect x="${f0(x)}" y="${f0(top - 55)}" width="${f0(w)}" height="55" fill="${INKS.platinum}" opacity="${f3(0.011 * m)}"/>`
        + `<rect x="${f0(x)}" y="${f0(top)}" width="${f0(w)}" height="${f0(span)}" fill="${INKS.platinum}" opacity="${f3(0.018 * m)}"/>`;
      let fr = 0.08 + rg() * 0.05;
      for (const st of [0.009, 0.010, 0.010, 0.011, 0.012, 0.012, 0.013, 0.014, 0.015]) {
        const yy = top + span * fr;
        out += `<rect x="${f0(x)}" y="${f0(yy)}" width="${f0(w)}" height="${f0(y0 - yy)}" fill="${INKS.platinum}" opacity="${f3(st * m)}"/>`;
        fr += 0.07 + rg() * 0.05;
        if (fr > 0.94) fr = 0.94;
      }
      out += `<rect x="${f0(x - 8)}" y="${f0(y0 - 30)}" width="${f0(w + 16)}" height="30" fill="${INKS.platinum}" opacity="${f3(0.115 * m)}"/>`;
      const eTop = top + span * 0.14;
      out += `<line x1="${f0(x)}" y1="${f0(y0)}" x2="${f0(x)}" y2="${f0(eTop)}" stroke="${INKS.silver}" stroke-width="1" opacity="${f3((0.09 + rg() * 0.06) * m)}"/>`
        + `<line x1="${f0(x + w)}" y1="${f0(y0)}" x2="${f0(x + w)}" y2="${f0(eTop)}" stroke="${INKS.silver}" stroke-width="1" opacity="${f3((0.09 + rg() * 0.06) * m)}"/>`;
      if (rg() < 0.55) { // stone drum joint
        const jy = top + span * (0.34 + rg() * 0.34);
        out += `<line x1="${f0(x)}" y1="${f0(jy)}" x2="${f0(x + w)}" y2="${f0(jy)}" stroke="${INKS.silver}" stroke-width="1" opacity="${f3(0.09 * m)}"/>`;
      }
    };
    for (const p of pillars) drawShaft(p, r);

    // ---- lit seams in some gaps (most gaps stay dark) ------------------------
    // pass 1: collect eligible gaps and decide which are lit
    const gaps = [];
    for (let i = 0; i + 1 < pillars.length; i++) {
      const L = pillars[i], R = pillars[i + 1];
      const gL = L.cx + L.w / 2, gR = R.cx - R.w / 2, s = gR - gL, mid = (gL + gR) / 2;
      if (gL < archX && gR > archX) continue;              // the aperture itself
      // calm zone around the aperture — narrower on the right so it never
      // swallows the cluster's leading gaps when archX lands high
      const calm = mid < archX ? 640 : 470;
      if (Math.abs(mid - archX) < calm && !(L.ex && R.ex)) continue;
      const isExit = !!(L.ex && R.ex);
      const inCluster = mid > clLo - 80 && mid < clHi + 80;
      if (!isExit && (s < (inCluster ? 55 : 90) || s > (inCluster ? 720 : 640))) continue;
      gaps.push({ i, L, R, gL, gR, s, mid, isExit, inCluster, lit: isExit });
    }
    let litStreak = 0;
    for (let k = 0; k < gaps.length; k++) {
      const g = gaps[k];
      if (g.isExit) continue;
      const adj = k > 0 && gaps[k - 1].lit && gaps[k - 1].i === g.i - 1;
      if (g.inCluster) { g.lit = rS() < 0.85 && (!adj || litStreak < 3); }
      else if (rS() < seamP(g.mid) && !adj) g.lit = true;
      litStreak = g.lit && adj ? litStreak + 1 : g.lit ? 1 : 0;
    }
    // guarantee the arc: >=3 seams across the 2-4 colonnade, one dim remnant
    // in the page-5 approach, >=4 in the cluster
    const litMids = () => gaps.filter((g) => g.lit).map((g) => g.mid);
    const forceIn = (lo, hi, want, minGap, dim) => {
      for (const mg of [minGap, Math.floor(minGap * 0.55), 60]) {
        let have = litMids().filter((m) => m > lo && m < hi).length;
        for (let k = 0; k < gaps.length && have < want; k++) {
          const g = gaps[k];
          if (g.lit || g.mid < lo || g.mid > hi) continue;
          if (litMids().some((m) => Math.abs(m - g.mid) < mg)) continue;
          g.lit = true; if (dim) g.dim = true; have++;
        }
        if (have >= want) return;
      }
    };
    forceIn(1750, 4250, 3, 560);
    forceIn(4380, 5100, 1, 380, true);
    forceIn(clLo - 80, clHi + 80, 4, 150);
    // pass 2a: hue picks + geometry jitters. rS() call ORDER matches the old
    // single draw pass exactly (1 warm pick unless exit, then 5 jitters), so
    // seam geometry is byte-stable; the cool-guarantee below recolors only.
    let runWarm = 0, runCool = 0;
    const litG = [];
    for (const g of gaps) {
      if (!g.lit) continue;
      g.warm = false;
      if (!g.isExit) {
        g.warm = rS() < 0.62;
        if (g.warm && runWarm >= 2) g.warm = false;
        else if (!g.warm && runCool >= 2) g.warm = true;
      }
      if (g.warm) { runWarm++; runCool = 0; } else { runCool++; runWarm = 0; }
      g.jGlo = rS(); g.jCx = rS(); g.jTall = rS(); g.jUp = rS(); g.jGlint = rS();
      g.cxV = g.mid + (g.jCx - 0.5) * g.s * 0.14;
      litG.push(g);
    }
    // v3.2 cluster cool-guarantee: on seeds where the cluster leans amber,
    // flip its TRAILING warm picks to cool until 2 are cool — selection is
    // done, geometry is frozen, and no >2 same-hue run is ever created
    const clG = litG.filter((g) => g.inCluster && !g.isExit);
    let nCool = clG.filter((g) => !g.warm).length;
    for (let k = clG.length - 1; k >= 0 && nCool < 2; k--) {
      if (!clG[k].warm) continue;
      clG[k].warm = false;
      let run = 0, bad = false;
      for (const g of clG) { run = g.warm ? 0 : run + 1; if (run > 2) bad = true; }
      if (bad) clG[k].warm = true; else nCool++;
    }

    // ---- v3.2 transitional bays flanking the cluster (density-only) ----------
    // one intermediate bay width per side so 620 -> ~460 -> 330 reads as an
    // accelerando toward the light instead of a mid-wall density switch.
    // Inserted AFTER seam selection on an independent channel: the gap list
    // and the whole rS stream above stay byte-identical to the pre-v3.2
    // build (no landmark re-jitter), and a guard keeps every new shaft clear
    // of the chosen seam lines. Drawn here, before the seam light, so glows
    // still overlay shafts exactly like the main rank.
    const rT = mulberry32((seed ^ 0xE7A0) + 7);
    for (const [lo, hi] of [[clLo - 480, clLo - 40], [clHi + 40, clHi + 480]]) {
      for (let pass = 0; pass < 3; pass++) {
        let did = false;
        for (let i = 0; i + 1 < pillars.length; i++) {
          const tL = pillars[i].cx + pillars[i].w / 2, tR = pillars[i + 1].cx - pillars[i + 1].w / 2;
          const iLo = Math.max(tL + 70, lo), iHi = Math.min(tR - 70, hi);
          if (tR - tL <= 460 || iHi - iLo < 40) continue;
          const nx = iLo + (0.25 + rT() * 0.5) * (iHi - iLo);
          if (Math.abs(nx - archX) < halfW + Math.max(jwL, jwR) + 46) continue;
          if (Math.abs(nx - exX) < exHalf + 150) continue;
          const w = 30 + 56 * Math.pow(wN(nx * 0.0037), 1.15) + rT() * 12;
          if (litG.some((g) => Math.abs(nx - g.cxV) < w / 2 + 40)) continue;
          const top = 285 + 330 * hN(nx * 0.00115) + rT() * 80;
          const np = { cx: nx, w, top, m: 0.35 + 0.65 * cap(dens(nx) / 0.86, 1), t: true };
          pillars.splice(i + 1, 0, np);
          drawShaft(np, rT);
          did = true; i++;
        }
        if (!did) break;
      }
    }

    // pass 2b: draw
    for (const g of litG) {
      const { L, R, gL, gR, s, mid, isExit, inCluster, warm } = g;
      // dim remnant seams use the lighter glow core for their crisp line —
      // raw accents at low alpha die on dark tints (green especially)
      const G = warm ? c.ga : c.gb, A = g.dim ? G : warm ? c.a : c.b;
      const m2 = isExit ? 1 : g.dim ? 0.62 : inCluster ? 1.12 : mid > 4300 && mid < 5500 ? 0.8 : 1;
      const glo = cap((0.068 + g.jGlo * 0.02) * boost * m2, 0.105);
      const cx = g.cxV;
      const sTall = 480 + g.jTall * 200; // seam heights vary, never uniform
      // soft light column (wide enough that nb-blur never clips)
      out += `<rect x="${f0(cx - 105)}" y="${f0(y0 - sTall)}" width="210" height="${f0(sTall + 8)}" fill="${G}" opacity="${f3(glo)}" filter="url(#nb-blur)"/>`
        + `<circle cx="${f0(cx)}" cy="${f0(y0 - sTall - 100)}" r="128" fill="${G}" opacity="${f3(cap(glo * 0.4, 0.045))}" filter="url(#nb-blur)"/>`;
      // crisp seam line, brighter low, fading up
      out += `<line x1="${f0(cx)}" y1="${f0(y0)}" x2="${f0(cx)}" y2="${f0(y0 - 320)}" stroke="${A}" stroke-width="1.3" opacity="${f3(cap(0.42 * m2, 0.5))}"/>`
        + `<line x1="${f0(cx)}" y1="${f0(y0 - 320)}" x2="${f0(cx)}" y2="${f0(y0 - sTall - 140 - g.jUp * 90)}" stroke="${A}" stroke-width="1" opacity="${f3(0.17 * m2)}"/>`;
      // floor: soft pool + crisp glint + reflected line (lit seams only)
      out += `<ellipse cx="${f0(cx)}" cy="${f0(y0 + 58)}" rx="${f0(Math.max(140, Math.min(s * 0.62, 170)))}" ry="84" fill="${G}" opacity="${f3(cap(glo * 1.1, 0.10))}" filter="url(#nb-blur)"/>`
        + `<ellipse cx="${f0(cx)}" cy="${f0(y0 + 7)}" rx="${f0(30 + g.jGlint * 16)}" ry="5" fill="${G}" opacity="${f3(0.22 * m2)}"/>`
        + `<line x1="${f0(cx)}" y1="${f0(y0 + 4)}" x2="${f0(cx)}" y2="${f0(y0 + 86)}" stroke="${A}" stroke-width="1" opacity="${f3(0.16 * m2)}"/>`
        + `<line x1="${f0(cx)}" y1="${f0(y0 + 86)}" x2="${f0(cx)}" y2="${f0(y0 + 148)}" stroke="${A}" stroke-width="1" opacity="0.05"/>`;
      // rim light on the two flanking pillar edges
      out += `<line x1="${f0(gL)}" y1="${f0(y0)}" x2="${f0(gL)}" y2="${f0(y0 - (y0 - L.top) * 0.52)}" stroke="${A}" stroke-width="1" opacity="${f3(0.26 * m2)}"/>`
        + `<line x1="${f0(gR)}" y1="${f0(y0)}" x2="${f0(gR)}" y2="${f0(y0 - (y0 - R.top) * 0.52)}" stroke="${A}" stroke-width="1" opacity="${f3(0.26 * m2)}"/>`;
      // v3.2 floor reflection stubs: a polished vault floor mirrors the lit
      // pillar edges beside each seam, not just the seam core (p2-4 + cluster)
      if ((mid > 1750 && mid < 4300) || inCluster) {
        for (const ex of [gL, gR]) out += `<line x1="${f0(ex)}" y1="${f0(y0 + 4)}" x2="${f0(ex)}" y2="${f0(y0 + 44)}" stroke="${A}" stroke-width="1" opacity="${f3(0.07 * m2)}"/>`
          + `<line x1="${f0(ex)}" y1="${f0(y0 + 44)}" x2="${f0(ex)}" y2="${f0(y0 + 70)}" stroke="${A}" stroke-width="1" opacity="0.03"/>`;
      }
    }

    // ---- arch dressing (over the pillars) ------------------------------------
    out += `<path d="${archPath}" fill="none" stroke="${c.ga}" stroke-width="1.5" opacity="0.34"/>`;
    const hw3 = halfW - 13, ry3 = ry - 15;
    out += `<path d="M ${f0(archX - hw3)} ${f0(y0)} L ${f0(archX - hw3)} ${f0(spring)} A ${f0(hw3)} ${f0(ry3)} 0 0 1 ${f0(archX + hw3)} ${f0(spring)} L ${f0(archX + hw3)} ${f0(y0)}" fill="none" stroke="${c.ga}" stroke-width="1" opacity="0.12"/>`;
    out += `<line x1="${f0(xLA)}" y1="${f0(y0)}" x2="${f0(xRA)}" y2="${f0(y0)}" stroke="${c.ga}" stroke-width="1.5" opacity="0.38"/>`;
    out += `<ellipse cx="${f0(archX)}" cy="${f0(y0 + 72)}" rx="215" ry="106" fill="${c.ga}" opacity="${f3(cap(0.10 * boost, 0.11))}" filter="url(#nb-blur)"/>`
      + `<ellipse cx="${f0(archX)}" cy="${f0(y0 + 9)}" rx="66" ry="9" fill="${c.ga}" opacity="0.17"/>`
      + `<ellipse cx="${f0(archX)}" cy="${f0(y0 + 8)}" rx="26" ry="4.5" fill="${c.c}" opacity="0.18"/>`
      + `<line x1="${f0(xLA)}" y1="${f0(y0 + 4)}" x2="${f0(xLA)}" y2="${f0(y0 + 90)}" stroke="${c.ga}" stroke-width="1" opacity="0.12"/>`
      + `<line x1="${f0(xRA)}" y1="${f0(y0 + 4)}" x2="${f0(xRA)}" y2="${f0(y0 + 90)}" stroke="${c.ga}" stroke-width="1" opacity="0.12"/>`;
    for (const p of pillars) { // lit inner rims on the jambs
      if (!p.jamb) continue;
      const rx = p.jamb === 'L' ? p.cx + p.w / 2 : p.cx - p.w / 2;
      out += `<line x1="${f0(rx)}" y1="${f0(y0)}" x2="${f0(rx)}" y2="${f0(spring - 24)}" stroke="${c.ga}" stroke-width="1.2" opacity="0.24"/>`;
    }

    // ---- v3.2 vault-door anatomy: the artifacts that make a vault door a
    // vault door — all inside the aperture/jamb footprint, hairline/dot grade
    // spoke handwheel (diameter ~1/2 door width), hub, seed-jittered rotation
    const wr = 58 + rDw() * 8, wy = (apex + y0) / 2, wRot = rDw() * Math.PI / 2;
    out += `<circle cx="${f0(archX)}" cy="${f0(wy)}" r="${f0(wr)}" fill="none" stroke="${INKS.silver}" stroke-width="1.3" opacity="0.15"/>`
      + `<circle cx="${f0(archX)}" cy="${f0(wy)}" r="8" fill="${INKS.silver}" opacity="0.16"/>`;
    for (let k = 0; k < 4; k++) {
      const a = wRot + k * Math.PI / 2;
      out += `<line x1="${f0(archX + 8 * Math.cos(a))}" y1="${f0(wy + 8 * Math.sin(a))}" x2="${f0(archX + (wr - 2) * Math.cos(a))}" y2="${f0(wy + (wr - 2) * Math.sin(a))}" stroke="${INKS.silver}" stroke-width="1" opacity="0.11"/>`;
    }
    let gp = ''; // interior pool light catches the lower-left rim quadrant only
    for (let t = 0; t <= 6; t++) {
      const a = (Math.PI / 180) * (106 + t * 11);
      gp += (t ? ' L ' : 'M ') + f0(archX + wr * Math.cos(a)) + ' ' + f0(wy + wr * Math.sin(a));
    }
    out += `<path d="${gp}" fill="none" stroke="${c.ga}" stroke-width="1" opacity="0.10"/>`;
    // rivet ring in the 13px arch band: up the left jamb, over the apex, down
    // the right jamb — spacing seed-jittered, never a metronome
    const rvR = halfW - 6.5, rvRy = ry - 7.5, jambLen = y0 - spring;
    const arcLen = Math.PI / 2 * (rvR + rvRy), totLen = jambLen * 2 + arcLen;
    let sp = 16 + rDw() * 18;
    while (sp < totLen - 10) {
      let px, py;
      if (sp < jambLen) { px = archX - rvR; py = y0 - sp; }
      else if (sp < jambLen + arcLen) {
        const a = Math.PI * (1 - (sp - jambLen) / arcLen);
        px = archX + rvR * Math.cos(a); py = spring - rvRy * Math.sin(a);
      } else { px = archX + rvR; py = spring + (sp - jambLen - arcLen); }
      out += `<circle cx="${f0(px)}" cy="${f0(py)}" r="1.8" fill="${INKS.silver}" opacity="0.13"/>`;
      // ~every 5th dot in the bottom 300px takes a ga glint where the pool reaches
      if (py > y0 - 300 && rDw() < 0.2) out += `<circle cx="${f0(px)}" cy="${f0(py)}" r="2.6" fill="${c.ga}" opacity="0.10"/>`;
      sp += 30 + rDw() * 8;
    }
    // strap-hinge plates on the left jamb inner edge, lit edge toward the pool
    for (const hy of [660, 1010]) {
      out += `<rect x="${f0(xLA - 3)}" y="${f0(hy - 24)}" width="14" height="48" fill="${INKS.platinum}" opacity="0.10"/>`
        + `<line x1="${f0(xLA + 11)}" y1="${f0(hy - 24)}" x2="${f0(xLA + 11)}" y2="${f0(hy + 24)}" stroke="${INKS.silver}" stroke-width="1" opacity="0.14"/>`;
    }
    // machined threshold sill spanning aperture + jambs, with a ga wear glow
    // that explains why the pool is brightest at the opening
    const thL = xLA - jwL - 10, thR = xRA + jwR + 10;
    out += `<rect x="${f0(thL)}" y="1204" width="${f0(thR - thL)}" height="14" fill="${INKS.platinum}" opacity="0.09"/>`
      + `<line x1="${f0(thL)}" y1="1204" x2="${f0(thR)}" y2="1204" stroke="${INKS.silver}" stroke-width="1" opacity="0.15"/>`
      + `<ellipse cx="${f0(archX)}" cy="${f0(y0 + 2)}" rx="110" ry="8" fill="${c.ga}" opacity="0.10"/>`;

    // ---- cornice hairline (full width, wandering presence) -------------------
    let xw = 0;
    while (xw < SW) {
      const len = 240 + rC() * 260;
      const bump = 1 + 0.55 * Math.exp(-Math.pow(((xw + len / 2) - archX) / 360, 2));
      const op = cap((0.055 + 0.10 * corN(xw * 0.0016)) * endFade(xw) * bump, 0.17);
      if (op > 0.015) out += `<line x1="${f0(xw)}" y1="${CY}" x2="${f0(Math.min(xw + len, SW))}" y2="${CY}" stroke="${INKS.platinum}" stroke-width="1" opacity="${f3(op)}"/>`;
      xw += len;
    }
    xw = 0; // intermittent molding shadow line
    while (xw < SW) {
      const len = 300 + rC() * 340;
      if (corN(xw * 0.0016 + 40) > 0.58) {
        const op = 0.045 * endFade(xw);
        if (op > 0.015) out += `<line x1="${f0(xw)}" y1="${CY + 17}" x2="${f0(Math.min(xw + len, SW))}" y2="${CY + 17}" stroke="${INKS.platinum}" stroke-width="1" opacity="${f3(op)}"/>`;
      }
      xw += len;
    }
    // warm streak on the cornice above the aperture
    out += `<line x1="${f0(archX - 260)}" y1="${CY + 1}" x2="${f0(archX + 260)}" y2="${CY + 1}" stroke="${c.ga}" stroke-width="1" opacity="0.10"/>`;

    // v3.2 dentil course under the cornice: intermittent + aperiodic runs
    // riding corN presence noise; the page-1 run is GUARANTEED (its rescue —
    // drawn detail in the top band, far from the text mid-band)
    const dRun = 380 + rDe() * 180, dLo = 140 + rDe() * (1020 - 140 - dRun);
    let xd = 20 + rDe() * 20;
    while (xd < SW - 30) {
      if ((xd > dLo && xd < dLo + dRun) || corN(xd * 0.0016 + 12) > 0.42) {
        const op = 0.055 * endFade(xd);
        if (op > 0.012) out += `<rect x="${f0(xd)}" y="${CY + 2}" width="3" height="6" fill="${INKS.platinum}" opacity="${f3(op)}"/>`;
      }
      xd += 20 + rDe() * 10;
    }
    // v3.2 distant sconce pair on the page-1 blank wall — pilot lighting, and
    // the second kit hue (gb) on the strip's only hue-less page. Drawn exactly
    // once; mounted high (y~340), above the text mid-band, whisper-faint.
    for (const sx of [480 + (rSc() - 0.5) * 100, 760 + (rSc() - 0.5) * 100]) {
      out += `<circle cx="${f0(sx)}" cy="340" r="70" fill="${c.gb}" opacity="${f3(cap(0.04 * boost, 0.05))}" filter="url(#nb-blur)"/>`
        + `<circle cx="${f0(sx)}" cy="340" r="2" fill="${c.gb}" opacity="0.14"/>`
        + `<rect x="${f0(sx - 18)}" y="344" width="36" height="74" fill="${c.gb}" opacity="0.018"/>`
        + `<rect x="${f0(sx - 18)}" y="418" width="36" height="66" fill="${c.gb}" opacity="0.009"/>`;
    }

    // ---- floor hairline -------------------------------------------------------
    xw = 0;
    while (xw < SW) {
      const len = 220 + rC() * 280;
      const op = cap((0.06 + 0.10 * floN(xw * 0.0019)) * endFade(xw), 0.16);
      if (op > 0.015) out += `<line x1="${f0(xw)}" y1="${y0}" x2="${f0(Math.min(xw + len, SW))}" y2="${y0}" stroke="${INKS.platinum}" stroke-width="1" opacity="${f3(op)}"/>`;
      xw += len;
    }

    // ---- staggered ashlar coursing on the two blank wall stretches (v3.2) ----
    // real bonds STAGGER: per-course joint segments offset half a block between
    // adjacent courses — never continuous top-to-bottom verticals. 3 course
    // lines per zone; everything stays hairline so the walls still read dark.
    for (const z of [[130 + rAs() * 150, 850 + rAs() * 110], [8020 + rAs() * 130, 8600 + rAs() * 130]]) {
      const yc = [405 + rAs() * 70, 560 + rAs() * 220, 880 + rAs() * 160];
      for (const y of yc) out += `<line x1="${f0(z[0] + rAs() * 160)}" y1="${f0(y)}" x2="${f0(z[1] - rAs() * 160)}" y2="${f0(y)}" stroke="${INKS.silver}" stroke-width="1" opacity="0.042"/>`;
      const bands = [[yc[0], yc[1]], [yc[1], yc[2]], [yc[2], y0 - 8]];
      const bw = 170 + rAs() * 60, ticks = [];
      for (let bi = 0; bi < 3; bi++) {
        let jx = z[0] + 24 + (bi % 2) * bw * 0.5 + rAs() * bw * 0.3;
        while (jx < z[1] - 24) {
          out += `<line x1="${f0(jx)}" y1="${f0(bands[bi][0] + 6)}" x2="${f0(jx)}" y2="${f0(bands[bi][1] - 6)}" stroke="${INKS.silver}" stroke-width="1" opacity="${f3(0.05 + rAs() * 0.015)}"/>`;
          ticks.push([jx, bands[bi][0]]);
          jx += bw * (0.8 + rAs() * 0.45);
        }
      }
      const nt = 1 + Math.floor(rAs() * 2); // 1-2 brighter joint intersections
      for (let t = 0; t < nt && ticks.length; t++) {
        const [tx, ty] = ticks[Math.floor(rAs() * ticks.length)];
        out += `<line x1="${f0(tx)}" y1="${f0(ty - 4)}" x2="${f0(tx)}" y2="${f0(ty + 4)}" stroke="${INKS.silver}" stroke-width="2" opacity="0.08"/>`;
      }
    }

    // ---- v3.2 column bases + capitals: classical termination ----------------
    // two-step plinth in the (already bright) floor zone; necking ring rides
    // the shaft's own alpha and only appears on full-presence shafts (m>0.7)
    const inCol = (x) => (x > 1700 && x < 5300) || (x > 6600 && x < 7500) || (x > 8930 && x < 10500);
    for (const p of pillars) {
      if (p.jamb || !inCol(p.cx)) continue;
      const { cx, w, top, m } = p, x = cx - w / 2, ef = endFade(cx);
      out += `<rect x="${f0(x - 15)}" y="${f0(y0 - 12)}" width="${f0(w + 30)}" height="12" fill="${INKS.platinum}" opacity="${f3(0.085 * m * ef)}"/>`
        + `<line x1="${f0(x - 8)}" y1="${f0(y0 - 30)}" x2="${f0(x + w + 8)}" y2="${f0(y0 - 30)}" stroke="${INKS.silver}" stroke-width="1" opacity="${f3(0.08 * m * ef)}"/>`;
      if (m > 0.7) out += `<line x1="${f0(x)}" y1="${f0(top + (y0 - top) * 0.09)}" x2="${f0(x + w)}" y2="${f0(top + (y0 - top) * 0.09)}" stroke="${INKS.silver}" stroke-width="1" opacity="${f3(0.045 * m * ef)}"/>`;
    }

    // ---- v3.2 guard rail: bank-hall furniture linking the bases -------------
    // whisper hairline at y0-58 in segments that stop 6px short of each pillar
    // edge (passing behind the columns), stanchion ticks at aperiodic spacing
    for (const [rLo, rHi, rop, dPl] of [[1750, 5050, 0.05, 0.86], [8930, 10080, 0.035, 0.48]]) {
      const ryR = y0 - 58;
      const seg = (a, b) => {
        if (b - a < 26) return;
        const mid = (a + b) / 2, op = rop * cap(dens(mid) / dPl, 1) * endFade(mid);
        if (op > 0.012) out += `<line x1="${f0(a)}" y1="${f0(ryR)}" x2="${f0(b)}" y2="${f0(ryR)}" stroke="${INKS.platinum}" stroke-width="1" opacity="${f3(op)}"/>`;
      };
      let segL = rLo;
      for (const p of pillars) {
        const pL = p.cx - p.w / 2 - 6, pR = p.cx + p.w / 2 + 6;
        if (pR < rLo) continue;
        if (pL > rHi) break;
        seg(segL, Math.min(pL, rHi));
        segL = Math.max(segL, pR);
      }
      seg(segL, rHi);
      let sx = rLo + 40 + rGr() * 240;
      while (sx < rHi) {
        if (dens(sx) > 0.4) {
          let hid = false;
          for (const p of pillars) if (Math.abs(sx - p.cx) < p.w / 2 + 10) { hid = true; break; }
          if (!hid) out += `<line x1="${f0(sx)}" y1="${f0(ryR)}" x2="${f0(sx)}" y2="${f0(ryR + 10)}" stroke="${INKS.platinum}" stroke-width="1" opacity="${f3(0.055 * endFade(sx))}"/>`;
        }
        sx += 300 + rGr() * 220;
      }
    }

    return out;
  },
};
})();

STYLE_DEFS["portside"] = (function () {
const PAGES = NATIVE_PAGES;
void PAGES;
// portside · "night port" · cobalt — ONE 10800x1350 composition.
//
// PAGE MAP (10 x 1080):
//  p1    open water — navy band, sparse c.b glints, faint cool sky pool,
//        star pinpricks; breakwater mound enters (~0.25W) and crosses on;
//        an anchored vessel rides beyond it, hull mid-ship across the cut.
//  p2    vessel stern (c.a anchor light, c.b deck dot) + breakwater head +
//        tiny c.b channel marker with reflection; quay deck fades in
//        (~1.75W); first bollards on the fresh quay.
//  p3    terminal builds — first low container stacks (1-3 tiers), far-band
//        silhouette rises behind; crane 1's LOWERED boom reaches in from
//        the right, hanging load over the young stacks (crosses x=3W).
//  p4    crane 1 full silhouette (boom lowered, trolley + cables + load),
//        moderate stacks, first amber work lights.
//  p5    OPEN QUAY GAP (~4.5W) — empty deck, lone high-mast lamp, straddle
//        carrier silhouette, bollards; breathing room before the district.
//  p6    stack district ramps dense — tall varied stacks, lit block faces,
//        work-light chips, far band at full height.
//  p7    LANDMARK — crane 2, boom RAISED ~50°, c.gb beacon + soft halo at
//        the tip (~6.67W, off-boundary), beacon reflection streak in water.
//  p8    stacks thin out, last work lights, quay face begins to fade.
//  p9    quay ends (~8.35W); mooring dolphins + a c.b fairway buoy in the
//        water; a dark headland shore rises across the water.
//  p10   dark shore over a farther ridge (depth) + ONE distant c.ga harbor
//        light with long reflection; platinum pinpricks; port behind us.
//
// All knots are seed-jittered and offB()-clamped so no anchor sits within
// ~255px of any x=k*1080; bands/features cross boundaries mid-feature and
// every phase change is a smoothstep ramp >= 0.4W wide. Structure is INKS
// neutral (lit container faces = low-op platinum, dark rows = low-op navy);
// hue lives only in light: c.b water glints + channel marker, c.gb beacon
// halo, c.a work lights / lamps, c.ga harbor light + terminal sky pools.
//
// v3.2 PORT-ANATOMY DETAIL PASS (whisper ink only, <=0.36 op, y>1000 or
// foreground water; landmarks, act structure, sky and mid-band untouched):
//  - bollards re-jittered onto an independent rng channel (0.35-1.9W +
//    forced gap + randomized 24-64px pair offsets) to break 1-page cadence;
//    figure-eight rope hints on ~40% of nubs. Legacy r() draws are still
//    consumed so everything downstream renders byte-identical to v3.1.
//  - tire fenders on the p2 + p5-gap quay faces; p5 quiet beat = mooring
//    catenary + quay ladder between gap lamp and straddle carrier.
//  - straddle carrier anatomy (wheels, cross-tie, top module, carried box);
//    crane 1 rail bogies + boom-tip sheave/falls + headblock strokes.
//  - ISO corner-casting dots + twist-lock ticks on ~35%/30% of lit stacks.
//  - channel lateral pair (approach buoy recolored c.gb + new c.a buoy on
//    p2 water); parked reach stacker on p8; capped mooring dolphins with
//    ONE guaranteed marker + c.b micro-reflection on p9; distant anchored
//    ship (ink hull + single masthead pinprick) on p10's dead water;
//    breakwater armor-rock ticks + anchor-chain hint / deck-cargo seams p1.
// (helpers provided by the registry's shared toolkit)
return {
  key: 'portside',
  name: 'night port',
  cat: 'cobalt',
  desc: 'container terminal at night — stacked blocks, two gantry cranes, one beacon over black water',
  gen(seed, hue) {
    const c = HUES[hue], SW = PAGES * W;
    const r = mulberry32(seed + 9041);
    const boost = glowAlphaBoost(hue);
    const nzH = valueNoise1D(seed + 101);
    const nzF = valueNoise1D(seed + 223);
    const nzG = valueNoise1D(seed + 389);
    const nzS = valueNoise1D(seed + 547);
    const nzD = valueNoise1D(seed + 641);
    const sm = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
    const ramp = (x, a, b) => sm((x - a) / (b - a));
    const offB = (x, m) => {
      m = m || 255;
      const f = ((x % W) + W) % W;
      return f < m ? x + (m - f) : f > W - m ? x - (f - (W - m)) : x;
    };
    const F = (v) => (Math.round(v * 10) / 10).toString();
    let out = '';

    const DECK = 1150, WTR = 1186;

    // ---- layout scalars (fixed draw order) ----
    const q0 = offB((1.68 + r() * 0.1) * W);        // quay fade-in anchor
    const q1 = offB((8.3 + r() * 0.1) * W);         // quay end
    const gapC = offB((4.44 + r() * 0.14) * W);     // open-gap center (p5)
    const gapHW = (0.4 + r() * 0.08) * W;
    const dn0 = (5.28 + r() * 0.12) * W, dn1 = (5.86 + r() * 0.1) * W;   // dense ramp up
    const dn2 = (7.08 + r() * 0.1) * W, dn3 = (7.8 + r() * 0.12) * W;    // dense ramp down
    const cx1 = offB((3.29 + r() * 0.07) * W, 270); // crane 1 center
    const tip1 = cx1 - (630 + r() * 115);           // lowered boom tip (crosses x=3W)
    const topY1 = 588, apex1 = 472;
    const tip2 = offB((6.63 + r() * 0.09) * W, 280); // raised boom tip = beacon x
    const cx2 = tip2 - (338 + r() * 26);
    const topY2 = 548, apex2 = 420, tipY2 = 150;
    const bw0 = (0.22 + r() * 0.07) * W;             // breakwater
    const bw1 = offB((1.46 + r() * 0.1) * W, 270);
    const shore0 = q1 + (0.16 + r() * 0.09) * W;     // headland start
    const hl = offB((9.34 + r() * 0.1) * W, 290);    // harbor light

    const dens = (x) => {
      let d = ramp(x, q0 + 0.16 * W, q0 + 1.25 * W) * (1 - ramp(x, q1 - 1.15 * W, q1 - 0.1 * W));
      d *= 0.52 + 0.48 * ramp(x, dn0, dn1) * (1 - ramp(x, dn2, dn3));
      d *= 1 - 0.94 * (1 - sm(Math.min(Math.abs(x - gapC) / gapHW, 1)));
      d *= 0.72 + 0.45 * nzD(x / (0.83 * W));
      return Math.max(0, Math.min(1, d));
    };

    const shoreTop = (x) => WTR - (12 + 86 * ramp(x, shore0, shore0 + 0.6 * W) * (0.5 + 0.5 * nzS(x / 240)));

    const dot = (x, y, col, k) =>
      `<circle cx="${F(x)}" cy="${F(y)}" r="${F(10 * k)}" fill="${col}" opacity="${(0.1 * boost).toFixed(3)}"/>` +
      `<circle cx="${F(x)}" cy="${F(y)}" r="${F(4.6 * k)}" fill="${col}" opacity="${Math.min(0.22 * boost, 0.28).toFixed(3)}"/>` +
      `<circle cx="${F(x)}" cy="${F(y)}" r="${F(2 * k)}" fill="${col}" opacity="0.58"/>`;

    const chip = (x, y, col) =>
      `<circle cx="${F(x)}" cy="${F(y)}" r="6.5" fill="${col}" opacity="${(0.12 * boost).toFixed(3)}"/>` +
      `<rect x="${F(x - 2.8)}" y="${F(y - 2)}" width="5.6" height="4" fill="${col}" opacity="${(0.38 + r() * 0.16).toFixed(3)}"/>`;

    const lights = []; // reflection sources {x, col, s, long}

    // ---- sky pools (light pollution over the terminal, cool over water) ----
    {
      const poolXs = schedule(r, SW, 1.6, 3.0, 2.4);
      let runCol = '', runLen = 0;
      for (const px of poolXs) {
        if (Math.abs(px - tip2) < 0.55 * W) continue; // beacon owns that sky
        const inTerm = px > q0 && px < q1;
        let col = inTerm ? (r() < 0.62 ? c.ga : c.gb) : c.gb;
        if (col === runCol && runLen >= 2) col = col === c.ga ? c.gb : c.ga;
        if (col === runCol) runLen++; else { runCol = col; runLen = 1; }
        const rad = 240 + r() * 95, py = 95 + r() * 120;
        out += `<circle cx="${F(px)}" cy="${F(py)}" r="${F(rad)}" fill="${col}" opacity="${((0.048 + r() * 0.018) * boost).toFixed(3)}" filter="url(#nb-blur)"/>`;
      }
    }

    // ---- star pinpricks (whisper, top band) ----
    {
      const sXs = schedule(r, SW, 0.26, 0.8);
      for (const sx of sXs) {
        const open = sx < q0 - 0.2 * W || sx > q1 + 0.2 * W;
        const n = 1 + (r() < (open ? 0.6 : 0.35) ? 1 : 0) + (open && r() < 0.3 ? 1 : 0);
        for (let i = 0; i < n; i++) {
          const x = sx + (r() - 0.5) * 260, y = 42 + r() * 238;
          out += `<circle cx="${F(x)}" cy="${F(y)}" r="${F(1 + r() * 0.7)}" fill="${INKS.silver}" opacity="${(0.1 + r() * (open ? 0.2 : 0.14)).toFixed(3)}"/>`;
        }
      }
    }

    // ---- water band ----
    out += `<rect x="-80" y="${WTR}" width="${SW + 160}" height="${H - WTR + 6}" fill="${INKS.navy}" opacity="0.18"/>`;

    // ---- horizon hairline (open-water zones only, broken) ----
    const horiz = (xa, xb) => {
      let x = xa;
      while (x < xb) {
        const len = 240 + r() * 300, e = Math.min(x + len, xb);
        out += `<line x1="${F(x)}" y1="${WTR + 1}" x2="${F(e)}" y2="${WTR + 1}" stroke="${INKS.platinum}" stroke-width="1" opacity="${(0.085 + r() * 0.06).toFixed(3)}"/>`;
        x = e + 40 + r() * 110;
      }
    };
    horiz(-60, q0 + 40);
    horiz(q1 - 60, SW + 60);

    // ---- far stack band (behind everything on the quay) ----
    {
      let x = q0 + 0.08 * W;
      let d = `M${F(x)} ${DECK}`;
      while (x < q1 - 0.04 * W) {
        const seg = 78 + r() * 150;
        const pd = dens(x + seg / 2);
        const hgt = pd < 0.14 ? 0 : 30 + 150 * pd * (0.3 + 0.85 * nzF(x / 190));
        const ny = DECK - hgt;
        d += ` L${F(x)} ${F(ny)} L${F(Math.min(x + seg, q1))} ${F(ny)}`;
        x += seg;
      }
      d += ` L${F(x)} ${DECK} Z`;
      out += `<path d="${d}" fill="${INKS.platinum}" opacity="0.06"/>`;
    }

    // ---- quay face + deck hairline (broken segments, end fades) ----
    {
      const qfade = (x) => ramp(x, q0 - 20, q0 + 0.55 * W) * (1 - ramp(x, q1 - 0.8 * W, q1 + 20));
      let x = q0;
      while (x < q1) {
        const fe0 = qfade(x);
        const len = 150 + r() * 220 + 260 * fe0;
        const e = Math.min(x + len, q1);
        const fe = qfade((x + e) / 2);
        if (fe > 0.03) {
          out += `<rect x="${F(x)}" y="${DECK}" width="${F(e - x)}" height="${WTR - DECK}" fill="${INKS.platinum}" opacity="${(0.05 * fe).toFixed(3)}"/>`;
          out += `<line x1="${F(x)}" y1="${DECK}" x2="${F(e)}" y2="${DECK}" stroke="${INKS.platinum}" stroke-width="1.3" opacity="${((0.12 + r() * 0.07) * (0.25 + 0.75 * fe)).toFixed(3)}"/>`;
        }
        x = e + 3 + r() * 8 + (1 - fe0) * 130;
      }
    }

    // ---- breakwater (p1-2) ----
    {
      const pts = [];
      let x = bw0;
      while (x < bw1) { pts.push([x, 1206 + 20 * nzS(x / 150) + r() * 5]); x += 42 + r() * 46; }
      pts.push([bw1, 1214 + r() * 8]);
      let d = `M${F(bw0)} 1256`;
      for (const p of pts) d += ` L${F(p[0])} ${F(p[1])}`;
      d += ` L${F(bw1)} 1256 Z`;
      out += `<path d="${d}" fill="${INKS.platinum}" opacity="0.13"/>`;
      for (let i = 0; i + 1 < pts.length; i++) {
        if (r() < 0.25) continue;
        out += `<line x1="${F(pts[i][0])}" y1="${F(pts[i][1])}" x2="${F(pts[i + 1][0])}" y2="${F(pts[i + 1][1])}" stroke="${INKS.platinum}" stroke-width="1.2" opacity="${(0.17 + r() * 0.12).toFixed(3)}"/>`;
      }
      const mx = bw1 - 14, my = 1200;
      out += `<line x1="${F(mx)}" y1="${F(my)}" x2="${F(mx)}" y2="${F(my - 27)}" stroke="${INKS.platinum}" stroke-width="1.5" opacity="0.26"/>`;
      out += dot(mx, my - 32, c.b, 1.0);
      lights.push({ x: mx, col: c.gb, s: 0.6, long: false });
    }

    // ---- anchored vessel in the roadstead, hull mid-ship across the p1/p2 cut ----
    let vBow = 0, vHy = 0; const cargoRects = []; // hoisted for the v3.2 detail pass
    {
      const bow = W - (95 + r() * 115); vBow = bow;
      const len = 300 + r() * 80;
      const stern = bow + len;
      const hy = 1152 + r() * 8; vHy = hy;
      out += `<path d="M${F(bow)} ${F(WTR + 3)} L${F(bow + 30)} ${F(hy)} L${F(stern - 10)} ${F(hy)} L${F(stern)} ${F(WTR + 3)} Z" fill="${INKS.platinum}" opacity="0.08"/>`;
      out += `<line x1="${F(bow + 30)}" y1="${F(hy)}" x2="${F(stern - 10)}" y2="${F(hy)}" stroke="${INKS.platinum}" stroke-width="1.2" opacity="0.22"/>`;
      let bx = bow + 48 + r() * 18;
      while (bx < stern - 96) {
        const bwd = 22 + r() * 30, bh = 7 + r() * 9;
        out += `<rect x="${F(bx)}" y="${F(hy - bh)}" width="${F(bwd)}" height="${F(bh)}" fill="${INKS.platinum}" opacity="${(0.055 + r() * 0.035).toFixed(3)}"/>`;
        cargoRects.push([bx, bwd, bh]);
        bx += bwd + 4 + r() * 16;
      }
      const hx = stern - 48;
      out += `<rect x="${F(hx)}" y="${F(hy - 26)}" width="27" height="26" fill="${INKS.platinum}" opacity="0.1"/>`;
      out += `<line x1="${F(hx + 3)}" y1="${F(hy - 26)}" x2="${F(hx + 24)}" y2="${F(hy - 26)}" stroke="${INKS.platinum}" stroke-width="1" opacity="0.24"/>`;
      const fmx = bow + 38;
      out += `<line x1="${F(fmx)}" y1="${F(hy)}" x2="${F(fmx)}" y2="${F(hy - 33)}" stroke="${INKS.platinum}" stroke-width="1.2" opacity="0.2"/>`;
      out += dot(fmx, hy - 38, c.a, 0.75);
      out += `<circle cx="${F(hx + 13)}" cy="${F(hy - 31)}" r="1.7" fill="${c.b}" opacity="0.5"/>`;
      // approach buoy seaward of the breakwater (foreground water, p1) —
      // v3.2: green-family lateral (c.gb); its red-family partner (c.a)
      // sits on p2's water in the detail pass, marking the channel entrance
      const ab = offB((0.4 + r() * 0.14) * W, 240);
      out += `<line x1="${F(ab)}" y1="${F(1306)}" x2="${F(ab)}" y2="${F(1288)}" stroke="${INKS.platinum}" stroke-width="1.3" opacity="0.18"/>`;
      out += dot(ab, 1283, c.gb, 0.62);
      const aby = 1322 + r() * 8;
      out += `<line x1="${F(ab - 11 + r() * 7)}" y1="${F(aby)}" x2="${F(ab + 12)}" y2="${F(aby)}" stroke="${c.gb}" stroke-width="2" opacity="0.2" stroke-linecap="round"/>`;
    }

    // ---- dark headland shore (p9-10) ----
    {
      // farther ridge behind, rising toward the strip's end (depth layer)
      const f0 = shore0 + (0.35 + r() * 0.15) * W;
      let fx = f0;
      let fd = `M${F(f0)} ${WTR + 30}`;
      while (fx < SW + 90) {
        fd += ` L${F(fx)} ${F(WTR - (24 + 118 * ramp(fx, f0, f0 + 0.75 * W) * (0.45 + 0.55 * nzF(fx / 310))))}`;
        fx += 60 + r() * 80;
      }
      fd += ` L${F(fx)} ${WTR + 30} Z`;
      out += `<path d="${fd}" fill="${INKS.platinum}" opacity="0.05"/>`;
      const pts = [];
      let x = shore0;
      while (x < SW + 90) { pts.push([x, shoreTop(x)]); x += 52 + r() * 70; }
      let d = `M${F(shore0)} ${WTR + 30}`;
      for (const p of pts) d += ` L${F(p[0])} ${F(p[1])}`;
      d += ` L${F(x)} ${WTR + 30} Z`;
      out += `<path d="${d}" fill="${INKS.platinum}" opacity="0.09"/>`;
      for (let i = 0; i + 1 < pts.length; i++) {
        if (r() < 0.35) continue;
        out += `<line x1="${F(pts[i][0])}" y1="${F(pts[i][1])}" x2="${F(pts[i + 1][0])}" y2="${F(pts[i + 1][1])}" stroke="${INKS.platinum}" stroke-width="1" opacity="${(0.09 + r() * 0.07).toFixed(3)}"/>`;
      }
      const np = 2 + Math.floor(r() * 2);
      for (let i = 0; i < np; i++) {
        const px = shore0 + 0.32 * W + r() * (SW - shore0 - 0.55 * W);
        out += `<circle cx="${F(px)}" cy="${F(shoreTop(px) + 10)}" r="1.4" fill="${INKS.silver}" opacity="${(0.25 + r() * 0.15).toFixed(3)}"/>`;
      }
      // the one distant harbor light
      const hy = shoreTop(hl) - 7;
      out += `<circle cx="${F(hl)}" cy="${F(hy)}" r="120" fill="${c.ga}" opacity="${(0.06 * boost).toFixed(3)}" filter="url(#nb-blur)"/>`;
      out += dot(hl, hy, c.ga, 1.15);
      lights.push({ x: hl, col: c.ga, s: 0.72, long: true });
      // fairway buoy in the water off the quay end (p9 life)
      const qb = offB(q1 + (0.5 + r() * 0.14) * W, 230);
      out += `<line x1="${F(qb)}" y1="${F(1246)}" x2="${F(qb)}" y2="${F(1226)}" stroke="${INKS.platinum}" stroke-width="1.4" opacity="0.2"/>`;
      out += dot(qb, 1221, c.b, 0.7);
      const qby = 1262 + r() * 10;
      out += `<line x1="${F(qb - 12 + r() * 8)}" y1="${F(qby)}" x2="${F(qb + 14)}" y2="${F(qby)}" stroke="${c.gb}" stroke-width="2" opacity="0.22" stroke-linecap="round"/>`;
    }

    // ---- container stacks (main layer) ----
    const stacks = []; // {sx, w, tiers, th, lit} — hoisted for the v3.2 detail pass
    {
      const clXs = schedule(r, SW, 0.16, 0.5, 0.8);
      for (const cxx of clXs) {
        const p = dens(cxx);
        if (p < 0.06) continue;
        if (r() > Math.min(p * 1.9 + 0.08, 0.93)) continue;
        const nSt = 1 + Math.floor(r() * (1.7 + 4 * p));
        let sx = cxx - 0.5 * nSt * 86;
        for (let s = 0; s < nSt; s++) {
          const wSt = 56 + r() * 42;
          const tierH = 26 + r() * 5;
          const pd = dens(sx + wSt / 2);
          let tiers = Math.max(1, Math.round((0.7 + 5.4 * pd) * (0.32 + 0.92 * nzH(sx / 380)) + r() * 1.4));
          tiers = Math.min(tiers, Math.floor((DECK - 922) / tierH));
          const lit = r() < 0.48;
          stacks.push({ sx, w: wSt, tiers, th: tierH, lit });
          const baseOp = lit ? 0.095 + r() * 0.055 : 0.042 + r() * 0.024;
          for (let t = 0; t < tiers; t++) {
            const y = DECK - (t + 1) * tierH;
            out += `<rect x="${F(sx)}" y="${F(y)}" width="${F(wSt)}" height="${F(tierH - 2)}" fill="${INKS.platinum}" opacity="${(baseOp * (0.85 + r() * 0.3)).toFixed(3)}"/>`;
          }
          if (lit) {
            for (let t = 1; t < tiers; t++) {
              out += `<line x1="${F(sx + 1)}" y1="${F(DECK - t * tierH - 1)}" x2="${F(sx + wSt - 1)}" y2="${F(DECK - t * tierH - 1)}" stroke="${INKS.coal}" stroke-width="1.6" opacity="0.4"/>`;
            }
            if (wSt > 74 && r() < 0.55) {
              const vx = sx + wSt * (0.38 + r() * 0.24);
              out += `<line x1="${F(vx)}" y1="${F(DECK - tiers * tierH + 3)}" x2="${F(vx)}" y2="${F(DECK - 3)}" stroke="${INKS.coal}" stroke-width="1.3" opacity="0.3"/>`;
            }
          }
          if (r() < 0.38) {
            const ty = DECK - tiers * tierH;
            out += `<line x1="${F(sx)}" y1="${F(ty)}" x2="${F(sx + wSt)}" y2="${F(ty)}" stroke="${INKS.platinum}" stroke-width="1" opacity="${(0.1 + r() * 0.12).toFixed(3)}"/>`;
          }
          if (r() < 0.09 && tiers > 1) {
            // reefer row — one hue-lit seam, low in the stack
            const st = 1 + Math.floor(r() * Math.min(tiers - 1, 3));
            const sy = DECK - st * tierH - 1;
            if (sy > 1012) out += `<line x1="${F(sx + 2)}" y1="${F(sy)}" x2="${F(sx + wSt - 2)}" y2="${F(sy)}" stroke="${r() < 0.6 ? c.b : c.a}" stroke-width="1.2" opacity="${(0.18 + r() * 0.1).toFixed(3)}"/>`;
          }
          if (r() < p * 0.55) {
            const ly = DECK - (1 + Math.floor(r() * Math.min(tiers, 4))) * tierH + tierH * 0.4;
            if (ly > 1012) out += chip(sx + 8 + r() * (wSt - 16), ly, r() < 0.62 ? c.a : INKS.silver);
          }
          sx += wSt + 5 + r() * 16;
          if (r() < 0.18) sx += 30 + r() * 70;
        }
      }
    }

    // ---- gantry cranes ----
    const craneBase = (cx, topY, apexY, tipX, tipY) => {
      const P = INKS.platinum;
      const L = (x1, y1, x2, y2, sw, op) => `<line x1="${F(x1)}" y1="${F(y1)}" x2="${F(x2)}" y2="${F(y2)}" stroke="${P}" stroke-width="${sw}" opacity="${op}"/>`;
      const dir = tipX > cx ? 1 : -1;
      const gEnd = cx - dir * 168;
      const bStart = cx + dir * 148;
      let s = '';
      s += L(cx - 122, DECK, cx - 96, topY, 2.6, 0.3);
      s += L(cx + 122, DECK, cx + 96, topY, 2.6, 0.3);
      s += L(cx - 117, 1082, cx + 117, 1082, 2, 0.2);
      s += L(cx - 108, 892, cx + 108, 892, 1.4, 0.14);
      s += L(cx - 104, DECK, cx + 108, 892, 1, 0.1);
      s += L(gEnd, topY, bStart, topY, 3, 0.32);
      s += L(bStart, topY, tipX, tipY, 3, 0.32);
      s += L(cx - 96, topY, cx, apexY, 2, 0.26);
      s += L(cx + 96, topY, cx, apexY, 2, 0.26);
      s += L(cx, apexY, (bStart + tipX) / 2, (topY + tipY) / 2, 1.2, 0.17);
      s += L(cx, apexY, tipX - dir * 8, tipY + 6, 1.3, 0.2);
      s += L(cx, apexY, gEnd + dir * 24, topY, 1.1, 0.15);
      s += `<rect x="${F(cx - dir * 116 - 30)}" y="${F(topY - 30)}" width="60" height="28" fill="${INKS.platinum}" opacity="0.07"/>`;
      s += `<rect x="${F(dir > 0 ? gEnd : gEnd - 44)}" y="${F(topY + 8)}" width="44" height="26" fill="${INKS.platinum}" opacity="0.06"/>`;
      s += `<rect x="${F(cx - dir * 116 - 8)}" y="${F(topY - 24)}" width="5" height="4" fill="${c.a}" opacity="0.45"/>`;
      return s;
    };

    // crane 1 — boom lowered, working (trolley + cables + hanging load)
    let c1tx = 0, c1loadY = 0; // hoisted for the v3.2 detail pass
    {
      out += craneBase(cx1, topY1, apex1, tip1, topY1 + 16);
      const bStart = cx1 - 148;
      const t = 0.32 + r() * 0.28;
      const tx = bStart + (tip1 - bStart) * t; c1tx = tx;
      const ty = topY1 + 16 * t;
      const loadY = 1030 + r() * 22; c1loadY = loadY;
      out += `<rect x="${F(tx - 11)}" y="${F(ty - 4)}" width="22" height="9" fill="${INKS.platinum}" opacity="0.3"/>`;
      out += `<line x1="${F(tx - 8)}" y1="${F(ty + 5)}" x2="${F(tx - 8)}" y2="${F(loadY)}" stroke="${INKS.platinum}" stroke-width="1" opacity="0.16"/>`;
      out += `<line x1="${F(tx + 8)}" y1="${F(ty + 5)}" x2="${F(tx + 8)}" y2="${F(loadY)}" stroke="${INKS.platinum}" stroke-width="1" opacity="0.16"/>`;
      out += `<line x1="${F(tx - 34)}" y1="${F(loadY)}" x2="${F(tx + 34)}" y2="${F(loadY)}" stroke="${INKS.platinum}" stroke-width="2.4" opacity="0.3"/>`;
      out += `<rect x="${F(tx - 33)}" y="${F(loadY + 3)}" width="66" height="27" fill="${INKS.platinum}" opacity="0.07"/>`;
      out += `<line x1="${F(tx - 33)}" y1="${F(loadY + 3)}" x2="${F(tx + 33)}" y2="${F(loadY + 3)}" stroke="${INKS.platinum}" stroke-width="1" opacity="0.14"/>`;
      out += `<circle cx="${F(tx)}" cy="${F(ty - 7)}" r="2" fill="${c.a}" opacity="0.45"/>`;
      out += `<circle cx="${F(tip1 + 6)}" cy="${F(topY1 + 14)}" r="1.8" fill="${INKS.silver}" opacity="0.32"/>`;
    }

    // crane 2 — boom raised, the beacon landmark
    {
      out += craneBase(cx2, topY2, apex2, tip2, tipY2);
      const bStart = cx2 + 148;
      for (let i = 0; i < 4; i++) {
        const t = 0.16 + i * 0.2 + r() * 0.06;
        const bx = bStart + (tip2 - bStart) * t, by = topY2 + (tipY2 - topY2) * t;
        out += `<line x1="${F(bx - 7)}" y1="${F(by + 9)}" x2="${F(bx + 7)}" y2="${F(by - 9)}" stroke="${INKS.platinum}" stroke-width="1" opacity="0.13"/>`;
      }
      out += `<rect x="${F(cx2 - 74)}" y="${F(topY2 + 12)}" width="22" height="9" fill="${INKS.platinum}" opacity="0.26"/>`;
      const bmx = bStart + (tip2 - bStart) * 0.55, bmy = topY2 + (tipY2 - topY2) * 0.55;
      out += `<circle cx="${F(bmx)}" cy="${F(bmy)}" r="1.6" fill="${INKS.silver}" opacity="0.3"/>`;
      // beacon + soft halo (the once-only landmark light)
      out += `<circle cx="${F(tip2)}" cy="${F(tipY2)}" r="190" fill="${c.gb}" opacity="${(0.105 * boost).toFixed(3)}" filter="url(#nb-blur)"/>`;
      out += `<circle cx="${F(tip2)}" cy="${F(tipY2)}" r="26" fill="${c.gb}" opacity="${(0.07 * boost).toFixed(3)}"/>`;
      out += dot(tip2, tipY2, c.gb, 1.5);
      lights.push({ x: tip2, col: c.gb, s: 0.92, long: true });
    }

    // ---- high-mast lamps on the quay (one guaranteed in the open gap) ----
    let gapLampX = 0; // hoisted for the v3.2 detail pass
    {
      const lamp = (px) => {
        const topy = 1002 + r() * 26;
        out += `<line x1="${F(px)}" y1="${DECK}" x2="${F(px)}" y2="${F(topy)}" stroke="${INKS.platinum}" stroke-width="1.6" opacity="0.2"/>`;
        out += `<line x1="${F(px - 11)}" y1="${F(topy)}" x2="${F(px + 13)}" y2="${F(topy)}" stroke="${INKS.platinum}" stroke-width="1.6" opacity="0.22"/>`;
        const amberish = r() < 0.7;
        out += dot(px - 6 + r() * 12, topy - 5, amberish ? c.a : INKS.silver, 0.85);
        lights.push({ x: px, col: amberish ? c.ga : INKS.silver, s: 0.58, long: false });
      };
      const gapLamp = offB(gapC - (0.1 + r() * 0.12) * W, 200); gapLampX = gapLamp;
      lamp(gapLamp);
      const pXs = schedule(r, SW, 1.25, 2.3);
      let nP = 0;
      for (const px0 of pXs) {
        if (nP >= 3) break;
        const px = offB(px0, 140);
        if (px < q0 + 0.28 * W || px > q1 - 0.32 * W) continue;
        if (Math.abs(px - cx1) < 0.34 * W || Math.abs(px - cx2) < 0.34 * W) continue;
        if (Math.abs(px - gapLamp) < 0.5 * W) continue;
        if (dens(px) < 0.18) continue;
        lamp(px);
        nP++;
      }
    }

    // ---- bollards (incl. the first pair on the young quay) ----
    // v3.2: rhythm re-jittered on an INDEPENDENT rng channel — spacing
    // widened 0.5-1.3W -> 0.35-1.9W with a forced >=1.6W dead gap, pair
    // offsets randomized 24-42 -> 24-64px, pair skip prob raised — to pull
    // the near-threshold 1-page acPeak down. The legacy r() draws below are
    // still consumed (output discarded) so the stream feeding the straddle
    // carrier, dolphins, glints and reflections stays byte-identical.
    const bollards = []; // {x} — hoisted for fender suppression + p5 catenary
    {
      { // legacy stream-preserving stub — consumes exactly v3.1's draws
        const bXs = schedule(r, SW, 0.5, 1.3);
        const all = [q0 + 70 + r() * 60, q0 + 200 + r() * 90];
        for (const bx of bXs) if (bx > q0 + 340 && bx < q1 - 80) all.push(bx);
        for (const bx of all) {
          const fe = ramp(bx, q0, q0 + 0.3 * W) * (1 - ramp(bx, q1 - 0.35 * W, q1));
          if (fe < 0.25) continue;
          if (r() < 0.4) r();
        }
      }
      const rb = mulberry32((seed ^ 0xE7A0) + 13);
      const bXs = schedule(rb, SW, 0.35, 1.9, 1.6);
      const all = [q0 + 70 + rb() * 60, q0 + 200 + rb() * 90];
      for (const bx of bXs) if (bx > q0 + 340 && bx < q1 - 80) all.push(bx);
      for (const bx of all) {
        const fe = ramp(bx, q0, q0 + 0.3 * W) * (1 - ramp(bx, q1 - 0.35 * W, q1));
        if (fe < 0.25) continue;
        bollards.push({ x: bx });
        out += `<rect x="${F(bx - 5)}" y="${F(DECK - 9)}" width="10" height="9" rx="3" fill="${INKS.platinum}" opacity="${(0.34 * fe).toFixed(3)}"/>`;
        if (rb() < 0.28) {
          const cbx = bx + 24 + rb() * 40;
          bollards.push({ x: cbx });
          out += `<rect x="${F(cbx)}" y="${F(DECK - 8)}" width="9" height="8" rx="3" fill="${INKS.platinum}" opacity="${(0.27 * fe).toFixed(3)}"/>`;
        }
        // figure-eight mooring-rope hint on ~40% of nubs (THE bollard cue) —
        // decision hashed off the bollard's own x so realizations don't streak
        const rr = mulberry32(((seed ^ 0xE7A0) + Math.round(bx * 7)) | 0);
        if (rr() < 0.42) {
          const rop = ((0.16 + rr() * 0.06) * Math.min(1, fe + 0.25)).toFixed(3);
          out += `<path d="M${F(bx - 7)} ${F(DECK - 5)} q3.5 -6.5 7 0 q3.5 6 7 0" fill="none" stroke="${INKS.platinum}" stroke-width="1" opacity="${rop}"/>`;
          if (rr() < 0.3) out += `<line x1="${F(bx + 5)}" y1="${F(DECK - 4)}" x2="${F(bx + 25 + rr() * 15)}" y2="${DECK}" stroke="${INKS.platinum}" stroke-width="1" opacity="${rop}"/>`;
        }
      }
    }

    // ---- straddle carrier in the open gap (p5) ----
    let scX = 0, scY = 0; // hoisted for the v3.2 detail pass
    {
      const vx = offB(gapC + (0.06 + r() * 0.1) * W, 270); scX = vx;
      const vy = DECK - 48; scY = vy;
      out += `<line x1="${F(vx - 20)}" y1="${DECK}" x2="${F(vx - 20)}" y2="${F(vy)}" stroke="${INKS.platinum}" stroke-width="2.4" opacity="0.34"/>`;
      out += `<line x1="${F(vx + 20)}" y1="${DECK}" x2="${F(vx + 20)}" y2="${F(vy)}" stroke="${INKS.platinum}" stroke-width="2.4" opacity="0.34"/>`;
      out += `<line x1="${F(vx - 25)}" y1="${F(vy)}" x2="${F(vx + 25)}" y2="${F(vy)}" stroke="${INKS.platinum}" stroke-width="2.6" opacity="0.36"/>`;
      out += `<rect x="${F(vx + 4)}" y="${F(vy + 3)}" width="16" height="12" fill="${INKS.platinum}" opacity="0.13"/>`;
      out += `<circle cx="${F(vx - 22)}" cy="${F(vy + 6)}" r="1.8" fill="${c.a}" opacity="0.42"/>`;
    }

    // ---- mooring dolphins off the quay end (p9) ----
    // v3.2: pile geometry recorded for the cap-beam pass; the old per-dolphin
    // marker draw is consumed but not emitted — the detail pass guarantees the
    // marker on exactly ONE dolphin instead.
    const dolphins = []; // {x, x0, x1, top}
    {
      const ds = [offB(q1 + (0.05 + r() * 0.06) * W, 150), offB(q1 + (0.28 + r() * 0.1) * W, 150)];
      for (const dxc of ds) {
        const np = 2 + Math.floor(r() * 2);
        let px = dxc - np * 5;
        const x0 = px; let x1 = px, top = WTR + 16;
        for (let i = 0; i < np; i++) {
          const hgt = 20 + r() * 15;
          out += `<line x1="${F(px)}" y1="${F(WTR + 16)}" x2="${F(px)}" y2="${F(WTR - hgt + 16)}" stroke="${INKS.platinum}" stroke-width="1.7" opacity="${(0.16 + r() * 0.08).toFixed(3)}"/>`;
          x1 = px; top = Math.min(top, WTR - hgt + 16);
          px += 7 + r() * 7;
        }
        dolphins.push({ x: dxc, x0, x1, top });
        r(); // legacy marker draw — kept so the downstream stream is unchanged
      }
    }

    // ---- sparse water glints ----
    {
      const gXs = schedule(r, SW, 0.09, 0.38);
      for (const gx of gXs) {
        const n = 1 + (r() < 0.45 ? 1 : 0) + (r() < 0.15 ? 1 : 0);
        for (let i = 0; i < n; i++) {
          const gy = WTR + 14 + Math.pow(r(), 1.6) * 130;
          const len = 15 + r() * 50;
          const bright = r() < 0.13;
          const col = bright ? c.gb : c.b;
          const op = Math.min((bright ? 0.3 + r() * 0.1 : 0.14 + r() * 0.16) * (0.7 + 0.6 * nzG(gx / 700)) * (1 + 0.65 * (1 - dens(gx))), 0.38);
          out += `<line x1="${F(gx - len / 2 + (r() - 0.5) * 70)}" y1="${F(gy)}" x2="${F(gx + len / 2)}" y2="${F(gy)}" stroke="${col}" stroke-width="${bright ? 2.2 : 1.7}" opacity="${op.toFixed(3)}" stroke-linecap="round"/>`;
        }
      }
    }

    // ---- reflections under real lights ----
    for (const lt of lights) {
      let y = WTR + 10 + r() * 12;
      const n = lt.long ? 6 + Math.floor(r() * 3) : 3 + Math.floor(r() * 2);
      for (let i = 0; i < n; i++) {
        const t = i / n;
        const len = (9 + r() * 38) * (1 + t * (lt.long ? 1.9 : 0.7));
        const dx = (r() - 0.5) * (18 + t * 46);
        const op = Math.min(lt.s * (0.5 - t * 0.34) * (0.6 + r() * 0.75), 0.4);
        if (op > 0.02) out += `<line x1="${F(lt.x + dx - len / 2)}" y1="${F(y)}" x2="${F(lt.x + dx + len / 2)}" y2="${F(y)}" stroke="${lt.col}" stroke-width="2.2" opacity="${op.toFixed(3)}" stroke-linecap="round"/>`;
        y += 12 + r() * 28;
        if (y > H - 12) break;
      }
    }

    // ==================== v3.2 PORT-ANATOMY DETAIL PASS ====================
    // Whisper-opacity DRAWN detail only (<=0.36 op), all in the y>1000
    // structure shelf or foreground water. No new lights, no landmark change.
    // Every draw comes from the independent rd channel so the legacy r()
    // stream above stays byte-identical to v3.1.
    {
      const rd = mulberry32((seed ^ 0xE7A0) + 5);
      const nearBollard = (x) => bollards.some((b) => Math.abs(b.x - x) < 40);

      // (1) tire fenders hung on the two thinnest quay-face stretches
      // (fresh quay p2, open-gap wall p5) — stroke-only, dark ink, no light
      for (const [za, zb] of [[Math.max(1900, q0 + 150), 2900], [4400, 5300]]) {
        let fx = za + rd() * 80, nF = 0;
        while (fx < zb && nF < 6) {
          const fxx = offB(fx, 60);
          if (!nearBollard(fxx)) {
            const fr = 5 + rd() * 2;
            const fy = DECK + 3 + rd() * 3 + fr;
            out += `<circle cx="${F(fxx)}" cy="${F(fy)}" r="${F(fr)}" fill="none" stroke="${rd() < 0.5 ? INKS.coal : INKS.navy}" stroke-width="1.3" opacity="${(0.22 + rd() * 0.1).toFixed(3)}"/>`;
            nF++;
          }
          fx += 90 + rd() * 170;
        }
      }

      // (3) p5 quiet drawn beat — mooring-line catenary off a bollard top +
      // a ladder recess in the quay face, between the gap lamp and carrier
      {
        const wa = Math.max(4620, gapLampX + 90);
        const wb = Math.max(wa + 60, Math.min(5000, scX - 110));
        let bx0 = -1;
        for (const b of bollards) if (b.x > wa && b.x < wb) { bx0 = b.x; break; }
        if (bx0 < 0) {
          bx0 = offB(wa + (wb - wa) * (0.2 + rd() * 0.3), 255);
          out += `<rect x="${F(bx0 - 5)}" y="${F(DECK - 9)}" width="10" height="9" rx="3" fill="${INKS.platinum}" opacity="0.32"/>`;
        }
        const ex = Math.min(bx0 + 62 + rd() * 26, scX - 60);
        out += `<path d="M${F(bx0)} ${F(DECK - 8)} Q${F((bx0 + ex) / 2)} ${F(DECK + 7)} ${F(ex)} ${F(DECK - 1)}" fill="none" stroke="${INKS.platinum}" stroke-width="1.2" opacity="${(0.16 + rd() * 0.04).toFixed(3)}"/>`;
        const lx = offB(Math.min(bx0 + 150 + rd() * 90, wb), 255);
        if (Math.abs(lx - bx0) > 60) {
          const lop = (0.12 + rd() * 0.03).toFixed(3);
          out += `<line x1="${F(lx)}" y1="${DECK}" x2="${F(lx)}" y2="${WTR}" stroke="${INKS.platinum}" stroke-width="1" opacity="${lop}"/>`;
          out += `<line x1="${F(lx + 8)}" y1="${DECK}" x2="${F(lx + 8)}" y2="${WTR}" stroke="${INKS.platinum}" stroke-width="1" opacity="${lop}"/>`;
          for (let i = 1; i <= 3; i++) out += `<line x1="${F(lx)}" y1="${F(DECK + i * 9)}" x2="${F(lx + 8)}" y2="${F(DECK + i * 9)}" stroke="${INKS.platinum}" stroke-width="1" opacity="${lop}"/>`;
        }
      }

      // (4) straddle-carrier anatomy — wheels at deck, cross-tie, machinery
      // module on the beam, carried box inside the portal (same footprint)
      {
        for (const dx of [-24, -16, 16, 24]) out += `<circle cx="${F(scX + dx)}" cy="${F(DECK - 3)}" r="2" fill="${INKS.platinum}" opacity="0.3"/>`;
        const my = (scY + DECK) / 2 + 2;
        out += `<line x1="${F(scX - 20)}" y1="${F(my)}" x2="${F(scX + 20)}" y2="${F(my)}" stroke="${INKS.platinum}" stroke-width="1" opacity="0.18"/>`;
        out += `<rect x="${F(scX - 6)}" y="${F(scY - 10)}" width="10" height="7" fill="${INKS.platinum}" opacity="0.14"/>`;
        const by = scY + 0.6 * (DECK - scY) - 11;
        out += `<line x1="${F(scX - 6)}" y1="${F(scY + 2)}" x2="${F(scX - 6)}" y2="${F(by)}" stroke="${INKS.platinum}" stroke-width="1" opacity="0.14"/>`;
        out += `<line x1="${F(scX + 6)}" y1="${F(scY + 2)}" x2="${F(scX + 6)}" y2="${F(by)}" stroke="${INKS.platinum}" stroke-width="1" opacity="0.14"/>`;
        out += `<rect x="${F(scX - 10)}" y="${F(by)}" width="20" height="11" fill="${INKS.platinum}" opacity="0.12"/>`;
      }

      // (5) crane 1 machine anatomy — rail bogies under the portal legs,
      // boom-tip sheave + idle falls, headblock strokes at the spreader ends
      {
        for (const dx of [-122, 122]) {
          out += `<rect x="${F(cx1 + dx - 8)}" y="${F(DECK - 7)}" width="16" height="7" fill="${INKS.platinum}" opacity="0.24"/>`;
          out += `<line x1="${F(cx1 + dx - 5)}" y1="${F(DECK - 2.5)}" x2="${F(cx1 + dx + 5)}" y2="${F(DECK - 2.5)}" stroke="${INKS.coal}" stroke-width="1" opacity="0.3"/>`;
        }
        out += `<circle cx="${F(tip1)}" cy="${F(topY1 + 16)}" r="2.2" fill="${INKS.platinum}" opacity="0.28"/>`;
        out += `<line x1="${F(tip1)}" y1="${F(topY1 + 18)}" x2="${F(tip1)}" y2="${F(topY1 + 38)}" stroke="${INKS.platinum}" stroke-width="1" opacity="0.1"/>`;
        out += `<line x1="${F(c1tx - 31)}" y1="${F(c1loadY - 8)}" x2="${F(c1tx - 31)}" y2="${F(c1loadY)}" stroke="${INKS.platinum}" stroke-width="1.2" opacity="0.2"/>`;
        out += `<line x1="${F(c1tx + 31)}" y1="${F(c1loadY - 8)}" x2="${F(c1tx + 31)}" y2="${F(c1loadY)}" stroke="${INKS.platinum}" stroke-width="1.2" opacity="0.2"/>`;
      }

      // (6) ISO corner castings + twist-lock ticks on lit stacks only,
      // probability-gated (aperiodic), respecting the y>1012 whisper rule
      for (const st of stacks) {
        if (!st.lit) continue;
        const ty = DECK - st.tiers * st.th;
        if (rd() < 0.35 && ty > 1012) {
          const dop = (0.2 + rd() * 0.06).toFixed(3);
          out += `<circle cx="${F(st.sx + 2.5)}" cy="${F(ty + 2.5)}" r="1.6" fill="${INKS.platinum}" opacity="${dop}"/>`;
          out += `<circle cx="${F(st.sx + st.w - 2.5)}" cy="${F(ty + 2.5)}" r="1.6" fill="${INKS.platinum}" opacity="${dop}"/>`;
        }
        for (let t = 1; t < st.tiers; t++) {
          if (rd() >= 0.3) continue;
          const sy = DECK - t * st.th - 1;
          if (sy <= 1012) continue;
          out += `<line x1="${F(st.sx + 1.5)}" y1="${F(sy - 1.2)}" x2="${F(st.sx + 1.5)}" y2="${F(sy + 1.3)}" stroke="${INKS.platinum}" stroke-width="1" opacity="0.18"/>`;
          out += `<line x1="${F(st.sx + st.w - 1.5)}" y1="${F(sy - 1.2)}" x2="${F(st.sx + st.w - 1.5)}" y2="${F(sy + 1.3)}" stroke="${INKS.platinum}" stroke-width="1" opacity="0.18"/>`;
        }
      }

      // (7) red-family lateral buoy on p2's water — partner to the recolored
      // c.gb approach buoy; the anchored vessel came in between them
      {
        const bxr = offB(1770 + rd() * 100, 255);
        const byr = 1292 + rd() * 10;
        out += `<line x1="${F(bxr)}" y1="${F(byr + 21)}" x2="${F(bxr)}" y2="${F(byr + 2)}" stroke="${INKS.platinum}" stroke-width="1.3" opacity="0.18"/>`;
        out += dot(bxr, byr - 3, c.a, 0.55);
        for (let i = 0; i < 2; i++) {
          const gy = byr + 32 + i * (12 + rd() * 9);
          const gl = 9 + rd() * 8;
          out += `<line x1="${F(bxr - gl / 2 + (rd() - 0.5) * 10)}" y1="${F(gy)}" x2="${F(bxr + gl / 2)}" y2="${F(gy)}" stroke="${c.a}" stroke-width="1.8" opacity="${(0.12 + rd() * 0.05).toFixed(3)}" stroke-linecap="round"/>`;
        }
      }

      // (8) parked reach stacker on the p8 apron — bridges dense district to
      // quay end with one truthful yard machine, zero glow
      {
        const rx = offB(7960 + rd() * 320, 255);
        out += `<rect x="${F(rx)}" y="${F(DECK - 14)}" width="64" height="14" fill="${INKS.platinum}" opacity="0.11"/>`;
        const bx1 = rx + 12, by1 = DECK - 15, bx2 = rx + 64, by2 = DECK - 34;
        out += `<line x1="${F(bx1)}" y1="${F(by1)}" x2="${F(bx2)}" y2="${F(by2)}" stroke="${INKS.platinum}" stroke-width="2" opacity="0.26"/>`;
        out += `<line x1="${F(bx2)}" y1="${F(by2)}" x2="${F(bx2)}" y2="${F(by2 + 8)}" stroke="${INKS.platinum}" stroke-width="1.2" opacity="0.24"/>`;
        out += `<circle cx="${F(rx + 15)}" cy="${F(DECK - 2)}" r="2.2" fill="${INKS.platinum}" opacity="0.3"/>`;
        out += `<circle cx="${F(rx + 50)}" cy="${F(DECK - 2)}" r="2.2" fill="${INKS.platinum}" opacity="0.3"/>`;
        out += `<rect x="${F(rx + 44)}" y="${F(DECK - 19)}" width="2.5" height="2.5" fill="${c.a}" opacity="0.4"/>`;
      }

      // (9) mooring-dolphin cap beams + ONE guaranteed marker with a c.b
      // micro-reflection — working platforms, not debris
      {
        const mi = rd() < 0.5 ? 0 : 1;
        for (let i = 0; i < dolphins.length; i++) {
          const d = dolphins[i];
          const cw = Math.max(10, Math.min(14, d.x1 - d.x0 + 4));
          const cxm = (d.x0 + d.x1) / 2;
          out += `<line x1="${F(cxm - cw / 2)}" y1="${F(d.top - 1)}" x2="${F(cxm + cw / 2)}" y2="${F(d.top - 1)}" stroke="${INKS.platinum}" stroke-width="1.5" opacity="0.22"/>`;
          if (i === mi) {
            out += `<circle cx="${F(d.x)}" cy="${F(WTR - 8)}" r="1.5" fill="${INKS.silver}" opacity="0.3"/>`;
            for (let s = 0; s < 2; s++) {
              const gy = 1206 + s * (14 + rd() * 8);
              out += `<line x1="${F(d.x - 6 + (rd() - 0.5) * 8)}" y1="${F(gy)}" x2="${F(d.x + 7)}" y2="${F(gy)}" stroke="${c.b}" stroke-width="1.6" opacity="${(0.1 + rd() * 0.05).toFixed(3)}" stroke-linecap="round"/>`;
            }
          }
        }
      }

      // (10) distant anchored ship in the p10 roadstead — ink hull on the
      // horizon hairline, ONE masthead pinprick, no glow, no reflection
      // column (the c.ga harbor light stays the page's only light event)
      {
        const scx = offB(9850 + rd() * 110, 255);
        const hw = 35 + rd() * 10;
        out += `<rect x="${F(scx - hw)}" y="1179" width="${F(hw * 2)}" height="6" fill="${INKS.platinum}" opacity="0.13"/>`;
        out += `<rect x="${F(scx + hw * 0.3)}" y="1176.5" width="10" height="2.5" fill="${INKS.platinum}" opacity="0.13"/>`;
        out += `<rect x="${F(scx + hw * 0.3 + 2)}" y="1174.5" width="6" height="2" fill="${INKS.platinum}" opacity="0.13"/>`;
        if (rd() < 0.6) out += `<rect x="${F(scx - hw * 0.45)}" y="1177" width="7" height="2" fill="${INKS.platinum}" opacity="0.12"/>`;
        out += `<circle cx="${F(scx + hw * 0.3 + 5)}" cy="1170.5" r="1.2" fill="${INKS.silver}" opacity="0.3"/>`;
        const gy = 1203 + rd() * 10;
        out += `<line x1="${F(scx - 9 + rd() * 6)}" y1="${F(gy)}" x2="${F(scx + 9)}" y2="${F(gy)}" stroke="${c.b}" stroke-width="1.6" opacity="${(0.1 + rd() * 0.04).toFixed(3)}" stroke-linecap="round"/>`;
      }

      // (11) armor-rock ticks on the p1 breakwater face — jumbled rubble,
      // not a smooth dune; 1-2 extra near the head below the marker mast
      {
        let ax = bw0 + 60 + rd() * 80, nA = 0;
        while (ax < bw1 - 60 && nA < 8) {
          const ay = 1216 + rd() * 26;
          const al = 8 + rd() * 6;
          const dirn = rd() < 0.5 ? 1 : -1;
          out += `<line x1="${F(ax)}" y1="${F(ay)}" x2="${F(ax + al * 0.8)}" y2="${F(ay - dirn * al * 0.55)}" stroke="${INKS.platinum}" stroke-width="1" opacity="${(0.12 + rd() * 0.04).toFixed(3)}"/>`;
          nA++;
          ax += 110 + rd() * 200;
        }
        for (let i = 0; i < 2; i++) {
          const hx2 = bw1 - 36 + rd() * 22, hy2 = 1214 + rd() * 20;
          out += `<line x1="${F(hx2)}" y1="${F(hy2)}" x2="${F(hx2 + 6 + rd() * 5)}" y2="${F(hy2 - 5)}" stroke="${INKS.platinum}" stroke-width="1" opacity="${(0.12 + rd() * 0.04).toFixed(3)}"/>`;
        }
      }

      // (12) anchor-chain hint off the vessel's bow hawse (explains the
      // stillness) + 1-2 coal micro-seams in the deck cargo (laden feeder)
      {
        const hx0 = vBow + 26, hy0 = vHy + 6;
        const drop = WTR + 2 - hy0;
        for (let i = 0; i < 4; i++) {
          const t = 0.12 + i * 0.26;
          out += `<line x1="${F(hx0 - 7.5 * t)}" y1="${F(hy0 + drop * t)}" x2="${F(hx0 - 7.5 * t - 1)}" y2="${F(hy0 + drop * t + 3)}" stroke="${INKS.platinum}" stroke-width="1" opacity="0.14"/>`;
        }
        const nSeam = 1 + (rd() < 0.5 ? 1 : 0);
        for (let i = 0; i < nSeam && cargoRects.length > 0; i++) {
          const cr = cargoRects[Math.floor(rd() * cargoRects.length)];
          const sx2 = cr[0] + cr[1] * (0.35 + rd() * 0.3);
          out += `<line x1="${F(sx2)}" y1="${F(vHy - cr[2] + 1)}" x2="${F(sx2)}" y2="${F(vHy - 1)}" stroke="${INKS.coal}" stroke-width="1" opacity="0.3"/>`;
        }
      }
    }

    return out;
  },
};
})();

STYLE_DEFS["subsea"] = (function () {
const PAGES = NATIVE_PAGES;
void PAGES;
// subsea · "cable route" · cobalt
// ONE 10800x1350 composition: an ocean-floor submarine cable route.
//
// PAGE MAP (10 x 1080):
//   p1-2  continental shelf — seafloor high (~y950-1030), warm surface-light
//         pools in the top quarter, dense depth soundings, the cable hugging
//         the shelf, first repeaters.
//   p3-4  the slope — terrain descends ~200px, bathymetric contour dashes
//         below the ridgeline, one cool ambient pool deep in the column.
//   p5-6  abyssal plain — calm flat floor (~y1210), manganese-nodule dots
//         along it, soundings thin out, a lone cool top pool, lone repeaters.
//   p7    THE TRENCH (landmark, once; center seeded into 0.635-0.665*SW so
//         it sits >=0.22W off every frame edge) — the near floor plunges
//         below the canvas, the cable spans the gap in a long catenary with
//         one lit mid-span repeater and a faint abyssal glow beneath it.
//   p8-9  the rise — rugged climb, a seamount peak (~0.86*SW, also once)
//         the cable drapes over, soundings thicken again, warm top pool.
//   p10   landfall — shore shelf, dark shore-station silhouette, one warm
//         c.ga shore light, the cable rises out of the deep and lands at
//         the station wall.
//
// All phase transitions are knot-smoothed (smoothstep between seed-jittered
// knots) with noise on top: no hard break anywhere, nothing aligned to any
// x = k*1080. Structure is INKS neutrals only; hue lives in light: the c.b
// cable hairline, c.gb repeaters + halos, c.ga surface light / branching
// units / shore light. The cable is a taut-rope relaxation over the terrain:
// it touches ridge tops, lifts over bumps, sags across gaps — the trench
// catenary falls out of the same physics.
//
// v3.2 ENHANCEMENT PASS (anatomy + density; landmarks/pools/acts untouched):
//   p1-2  shore end plough-BURIED 2.5px into the shelf (fades out ~x2350 as
//         the slope begins) + dashed silver plough-disturbance track; ~1/3 of
//         dense-zone soundings become 2-dot survey tick columns (op lifted).
//   all   repeaters get neutral-ink pressure-housing lozenges rotated to the
//         rope (mid halo 0.08->0.07 pays the ink back).
//   p3-4  ONE true branching unit on the slope: Y-housing + c.b spur hairline
//         dissolving toward the far ridge (2nd warm 'bu' demoted to c.gb);
//         two extra dashed contours at offsets 95/130 below the crest.
//   p5-6  half-buried charted shipwreck (ink only, sub-landmark) on the
//         plain; nodules re-clustered into 2-3 gaussian patches, count ~46,
//         bigger + stronger; a 4th current wisp + 1 extra sonar ping.
//   p7    trench catenary deepened ~38-47px (smoothstep dip on TOP of the
//         hull solver; mid-span repeater rides the new rope) + touchdown
//         ticks at both lips + 3 tight contour dashes down each wall.
//   p10   articulated-pipe sheath under-stroke on the final ~260px, cable
//         dives below the beach ~90px before the wall into a manhole hatch +
//         dashed conduit to the station footing; beacon gets beam ticks + a
//         brighter core (two faintest windows dimmed to pay).
// New detail rides INDEPENDENT rng channels ((seed^0xE7A0)+tag / fresh noise
// offsets) so the original r() stream — landmarks, pools, schedule — is
// byte-stable.
// (helpers provided by the registry's shared toolkit)
return {
  key: 'subsea',
  name: 'cable route',
  cat: 'cobalt',
  desc: 'submarine cable rides bathymetric terrain: shelf, slope, abyssal plain, trench catenary, seamount, lit shore station',
  gen(seed, hue) {
    const c = HUES[hue] || HUES.blend;
    const SW = PAGES * W;
    const boost = glowAlphaBoost(hue);
    const r = mulberry32(seed + 4021);
    const nzA = valueNoise1D(seed + 101); // near-floor wander
    const nzB = valueNoise1D(seed + 202); // mid ridge wander
    const nzC = valueNoise1D(seed + 303); // far band wander
    const nzF = valueNoise1D(seed + 404); // fine ripple
    const nzL = valueNoise1D(seed + 505); // cable lift breath
    const nzW = valueNoise1D(seed + 606); // current-drift wisps
    // v3.2 enhancement channels — independent of the primary r() stream so
    // the original composition (landmarks, pools, schedule) stays byte-stable
    const rP = mulberry32((seed ^ 0xE7A0) + 1); // catenary-dip params
    const rC = mulberry32((seed ^ 0xE7A0) + 2); // extra contour jitter
    const rN = mulberry32((seed ^ 0xE7A0) + 3); // nodule clusters
    const rT = mulberry32((seed ^ 0xE7A0) + 4); // sounding tick columns
    const rX = mulberry32((seed ^ 0xE7A0) + 5); // shipwreck placement
    const rW = mulberry32((seed ^ 0xE7A0) + 6); // extra wisp + ping
    const nzP = valueNoise1D(seed + 707);       // plough-track jitter

    const nudge = (x) => { const m = ((x % W) + W) % W; if (m < 55) return x + (60 - m); if (m > W - 55) return x - (m - (W - 55)) - 6; return x; };
    const F = (v) => v.toFixed(1);
    const O = (v) => v.toFixed(3);

    // ---- arc skeleton ---------------------------------------------------
    const trenchU = 0.635 + 0.03 * r();   // landmark, off every boundary
    const smU = 0.848 + 0.014 * r();      // seamount peak, off boundary
    const stU = 0.932 + 0.028 * r();      // shore station, off boundary
    const trenchX = trenchU * SW;
    const xSt = stU * SW;

    // depth profile knots [u, y] — the story of the route
    const K = [
      [0, 942 + r() * 20],
      [0.072 + 0.02 * r(), 924 + r() * 18],
      [0.152 + 0.02 * r(), 962 + r() * 18],
      [0.226 + 0.02 * r(), 1015 + r() * 22],
      [0.312 + 0.02 * r(), 1118 + r() * 22],
      [0.412 + 0.02 * r(), 1188 + r() * 14],
      [0.512 + 0.018 * r(), 1202 + r() * 12],
      [trenchU - 0.1, 1188 + r() * 10],
      [trenchU - 0.052, 1180 + r() * 8],
      [trenchU - 0.038, 1430 + r() * 20],
      [trenchU, 1516 + r() * 26],
      [trenchU + 0.038, 1436 + r() * 20],
      [trenchU + 0.052, 1178 + r() * 8],
      [trenchU + 0.1, 1172 + r() * 12],
      [0.772 + 0.012 * r(), 1142 + r() * 16],
      [smU - 0.06, 1112 + r() * 12],
      [smU - 0.02, 882 + r() * 10],
      [smU, 800 + r() * 14],
      [smU + 0.02, 886 + r() * 10],
      [smU + 0.06, 1112 + r() * 12],
      [stU, 958 + r() * 12],
      [1.0, 932 + r() * 14],
    ];
    // roughness envelope: rugged shelf/rise, calm plain, dead-calm trench walls
    const AK = [
      [0, 0.78], [0.24, 0.8], [0.40, 0.5], [0.50, 0.26], [0.565, 0.28],
      [trenchU, 0.12], [trenchU + 0.09, 0.45], [0.79, 0.72], [0.87, 0.6],
      [0.94, 0.5], [1, 0.58],
    ];
    const interp = (KN) => (u) => {
      if (u <= KN[0][0]) return KN[0][1];
      for (let i = 0; i < KN.length - 1; i++) {
        if (u <= KN[i + 1][0]) {
          const t = (u - KN[i][0]) / (KN[i + 1][0] - KN[i][0]);
          const s = t * t * (3 - 2 * t);
          return KN[i][1] * (1 - s) + KN[i + 1][1] * s;
        }
      }
      return KN[KN.length - 1][1];
    };
    const base = interp(K);
    const ampF = interp(AK);
    const clampU = (u) => Math.min(1, Math.max(0, u));

    const nearY = (x) => {
      const u = x / SW, a = ampF(u);
      return base(u) + (nzA(x / 540) - 0.5) * 2 * (15 + 58 * a) + (nzF(x / 150) - 0.5) * 14 * (0.35 + 0.65 * a);
    };
    const midY = (x) => {
      const um = clampU(x / SW - 0.022), a = ampF(um), b = base(um);
      // extra plunge inside the trench so the chasm goes truly dark
      return 1145 + (b - 1145) * 0.58 - 160 + Math.max(0, b - 1300) * 0.9 + (nzB(x / 680) - 0.5) * 2 * (10 + 30 * a);
    };
    const farY = (x) => {
      const uf = clampU(x / SW + 0.03), a = ampF(uf);
      return 1104 + (base(uf) - 1145) * 0.22 - 262 + (nzC(x / 780) - 0.5) * 2 * (8 + 20 * a);
    };

    // ---- cable: taut-rope relaxation over the near floor -----------------
    const stepC = 8;
    const n = Math.floor(SW / stepC) + 1;
    const terr = new Array(n);
    for (let i = 0; i < n; i++) terr[i] = nearY(i * stepC);
    // Exact taut-rope: greatest curve above terrain whose sag curvature is
    // capped at 2*kcurv per sample^2. Substituting g = y + k*i^2 turns the
    // cap into convexity, so the cable is the lower convex hull of
    // (i, terr[i] + k*i^2) — touches crests, hangs parabolic spans over gaps.
    const kcurv = 0.012;
    const T = new Array(n);
    for (let i = 0; i < n; i++) T[i] = terr[i] + kcurv * i * i;
    const hull = [];
    for (let i = 0; i < n; i++) {
      while (hull.length >= 2) {
        const a = hull[hull.length - 2], b = hull[hull.length - 1];
        if ((T[b] - T[a]) * (i - b) >= (T[i] - T[b]) * (b - a)) hull.pop(); else break;
      }
      hull.push(i);
    }
    const cab = new Array(n);
    for (let i = 0, hi = 0; i < n; i++) {
      while (hi < hull.length - 1 && hull[hi + 1] <= i) hi++;
      const a = hull[hi], b = hull[Math.min(hi + 1, hull.length - 1)];
      const g = b === a ? T[a] : T[a] + ((T[b] - T[a]) * (i - a)) / (b - a);
      cab[i] = g - kcurv * i * i;
    }
    // v3.2: two adjustments ON TOP of the hull solver (never replacing it):
    // shore-end plough burial across the shelf (real shore ends are trenched
    // ~2-3px INTO the seabed; fades out over 200px as the slope begins), and
    // a deeper trench-span dip so the catenary reads at thumbnail scale.
    const ss01 = (t) => { const u = Math.min(1, Math.max(0, t)); return u * u * (3 - 2 * u); };
    const buryF = (x) => ss01(x / 150) * ss01((2350 - x) / 200);
    const dipAmp = 38 + 9 * rP();     // mid-span hangs ~38-47px lower
    const dipHW = 0.03 * SW;          // half-width of the extra dip
    const cabAt = (i) => {
      const x = i * stepC;
      let y = cab[i] - (6 + 9 * nzL(x / 300));
      const b = buryF(x);
      if (b > 0) y = y * (1 - b) + (nearY(x) + 2.5) * b;
      return y + dipAmp * ss01(1 - Math.abs(x - trenchX) / dipHW);
    };

    let out = '';

    // ---- water-column light pools (top quarter, blurred, both hues) ------
    const tops = [
      [nudge((0.30 + 0.42 * r()) * W), 95 + 90 * r(), 310 + 50 * r(), c.ga, 0.082],
      [nudge((1.48 + 0.5 * r()) * W), 135 + 80 * r(), 250 + 40 * r(), c.ga, 0.06],
      [nudge((4.55 + 0.75 * r()) * W), 110 + 80 * r(), 285 + 50 * r(), c.gb, 0.065],
      [nudge((8.25 + 0.55 * r()) * W), 120 + 70 * r(), 255 + 40 * r(), c.ga, 0.058],
    ];
    for (const [px, py, pr, pc, po] of tops) {
      out += `<circle cx="${F(px)}" cy="${F(py)}" r="${F(pr)}" fill="${pc}" opacity="${O(po * boost)}" filter="url(#nb-blur)"/>`;
    }

    // ---- bathymetric terrain: far band, mid ridge, near floor ------------
    const ridge = (fn) => {
      let d = 'M0,' + F(fn(0));
      for (let x = 24; x < SW; x += 24) d += 'L' + Math.round(x) + ',' + F(fn(x));
      return d + 'L' + SW + ',' + F(fn(SW));
    };
    const dFar = ridge(farY), dMid = ridge(midY), dNear = ridge(nearY);
    // dark seam-shadows under each crest so the bands separate instead of fusing
    const seam = (fn, off) => {
      let d = 'M0,' + F(fn(0) + off);
      for (let x = 24; x < SW; x += 24) d += 'L' + Math.round(x) + ',' + F(fn(x) + off);
      return d + 'L' + SW + ',' + F(fn(SW) + off);
    };
    const closeD = `L${SW},${H + 60}L0,${H + 60}Z`;
    out += `<path d="${dFar}${closeD}" fill="${INKS.platinum}" opacity="0.075"/>`;
    out += `<path d="${dFar}" fill="none" stroke="${INKS.platinum}" stroke-width="1" opacity="0.10"/>`;
    out += `<path d="${dMid}${closeD}" fill="${INKS.platinum}" opacity="0.11"/>`;
    out += `<path d="${seam(midY, 8)}" fill="none" stroke="${INKS.coal}" stroke-width="14" opacity="0.45"/>`;
    out += `<path d="${dMid}" fill="none" stroke="${INKS.platinum}" stroke-width="1.1" opacity="0.15"/>`;
    out += `<path d="${dNear}${closeD}" fill="${INKS.platinum}" opacity="0.14"/>`;
    out += `<path d="${seam(nearY, 10)}" fill="none" stroke="${INKS.coal}" stroke-width="18" opacity="0.5"/>`;
    // light falls off below the near crest: deepening coal bands to the bottom
    out += `<path d="${seam(nearY, 78)}${closeD}" fill="${INKS.coal}" opacity="0.3"/>`;
    out += `<path d="${seam(nearY, 185)}${closeD}" fill="${INKS.coal}" opacity="0.42"/>`;
    out += `<path d="${dNear}" fill="none" stroke="${INKS.silver}" stroke-width="1.4" opacity="0.24"/>`;

    // current-drift wisps: long faint hairlines in the mid water column
    for (let j = 0; j < 3; j++) {
      const xw0 = (1.7 + j * 2.4 + r() * 1.1) * W;
      const len = (1.3 + 0.9 * r()) * W;
      const yw0 = 195 + 155 * r();
      let d = 'M' + Math.round(xw0) + ',' + F(yw0 + (nzW(xw0 / 520) - 0.5) * 70);
      for (let x = xw0 + 40; x < Math.min(SW - 90, xw0 + len); x += 40) d += 'L' + Math.round(x) + ',' + F(yw0 + (nzW(x / 520) - 0.5) * 70);
      out += `<path d="${d}" fill="none" stroke="${INKS.platinum}" stroke-width="1" opacity="${O(0.07 + 0.025 * r())}"/>`;
    }

    // ---- bathy-chart contour dashes (slope + rise) ------------------------
    const contour = (u0, u1, off, dash, op) => {
      const x0 = u0 * SW, x1 = u1 * SW;
      let d = 'M' + Math.round(x0) + ',' + F(nearY(x0) + off);
      for (let x = x0 + 30; x < x1; x += 30) d += 'L' + Math.round(x) + ',' + F(nearY(x) + off);
      return `<path d="${d}" fill="none" stroke="${INKS.platinum}" stroke-width="1" stroke-dasharray="${dash}" opacity="${op}"/>`;
    };
    out += contour(0.158 + 0.02 * r(), 0.44 + 0.02 * r(), 30, '9 15 4 21', 0.085);
    out += contour(0.225 + 0.02 * r(), 0.405 + 0.02 * r(), 62, '5 18 9 14', 0.07);
    out += contour(0.757 + 0.015 * r(), 0.886 + 0.012 * r(), 40, '8 13 5 19', 0.07);
    // v3.2: contour crowding — two deeper slope contours (tight packing =
    // steep, chart-style) + short tightly-stacked dashes down both trench
    // walls, which had no chart furniture at all
    out += contour(0.203 + 0.012 * rC(), 0.392 + 0.012 * rC(), 95, '7 16 4 13', 0.072);
    out += contour(0.212 + 0.012 * rC(), 0.376 + 0.012 * rC(), 130, '4 14 8 17', 0.062);
    for (const [w0, w1] of [[trenchU - 0.052, trenchU - 0.038], [trenchU + 0.038, trenchU + 0.052]]) {
      out += contour(w0, w1, 40, '5 9', 0.06);
      out += contour(w0, w1, 85, '4 8', 0.06);
      out += contour(w0, w1, 130, '6 11', 0.06);
    }

    // ---- deep ambient pools (bottom quarter, blurred) ---------------------
    const deeps = [
      [nudge((3.15 + 0.6 * r()) * W), 1255 + 45 * r(), 230 + 40 * r(), c.gb, 0.055],
      [trenchX + (r() - 0.5) * 120, 1315, 290 + 40 * r(), c.gb, 0.065],
      [nudge(xSt + 40 + 90 * r()), 1170 + 60 * r(), 210 + 30 * r(), c.ga, 0.055],
    ];
    for (const [px, py, pr, pc, po] of deeps) {
      out += `<circle cx="${F(px)}" cy="${F(py)}" r="${F(pr)}" fill="${pc}" opacity="${O(po * boost)}" filter="url(#nb-blur)"/>`;
    }

    // ---- manganese nodules on the abyssal plain ---------------------------
    // v3.2: patchy clustered pavement (real nodule fields are patchy, and
    // clusters survive downscaling) — count ~46, r 1.3-2.4, op 0.18-0.28.
    // The original loop keeps its exact 4-draws-per-nodule r() consumption;
    // clusters + extras ride the independent rN channel.
    const nodU0 = 0.405, nodU1 = trenchU - 0.042; // x 4374 .. trench shoulder
    const nodC = [];
    {
      const ncn = 2 + (rN() < 0.55 ? 0 : 1);
      for (let k = 0; k < ncn; k++) nodC.push([nudge((nodU0 + 0.03 + rN() * (nodU1 - nodU0 - 0.06)) * SW), 150 + 130 * rN()]);
    }
    const nodDot = (u01, uy, ur, uo) => {
      const k = Math.min(nodC.length - 1, Math.floor(u01 * nodC.length));
      let t = (u01 * nodC.length - k) * 2 - 1;
      t = (t < 0 ? -1 : 1) * t * t; // pack toward the cluster core
      const x = nudge(Math.max(nodU0 * SW, Math.min(nodU1 * SW, nodC[k][0] + t * nodC[k][1])));
      const y = nearY(x) + 6 + uy * 28;
      return `<circle cx="${F(x)}" cy="${F(y)}" r="${(1.3 + 1.1 * ur).toFixed(1)}" fill="${INKS.silver}" opacity="${O(0.18 + 0.10 * uo)}"/>`;
    };
    const nodN = 24 + Math.floor(r() * 8);
    for (let i = 0; i < nodN; i++) out += nodDot(r(), r(), r(), r());
    const nodN2 = 15 + Math.floor(rN() * 6);
    for (let i = 0; i < nodN2; i++) out += nodDot(rN(), rN(), rN(), rN());

    // ---- depth soundings: whisper dots, dense near coasts ------------------
    // v3.2: in the dense shelf/shore zones ~1/3 of soundings become 2-dot
    // survey tick columns and the opacity range lifts 0.09-0.20 -> 0.12-0.24
    // (they vanished when downscaled). Same 5 r() draws per iteration; the
    // tick decisions ride the independent rT channel. Gated to y<360 so the
    // text-safe mid-band (y 380-780) gains nothing.
    for (let i = 0; i < 110; i++) {
      const x = nudge(r() * SW);
      const u = x / SW;
      const shelf = Math.max(0, 1 - u / 0.30);
      const shore = Math.max(0, (u - 0.74) / 0.26);
      const zone = Math.max(shelf, shore * 0.9);
      if (r() < 0.22 + 0.78 * zone) {
        const y = 70 + r() * 430;
        const rad = (1.1 + 1.1 * r()).toFixed(1);
        const od = r();
        const dense = zone > 0.5 && y < 360;
        const op = O(dense ? 0.12 + 0.12 * od : 0.09 + 0.11 * od);
        out += `<circle cx="${F(x)}" cy="${F(y)}" r="${rad}" fill="${INKS.platinum}" opacity="${op}"/>`;
        if (dense && rT() < 0.34) out += `<circle cx="${F(x)}" cy="${F(y + 10 + 4 * rT())}" r="${rad}" fill="${INKS.platinum}" opacity="${op}"/>`;
      } else { r(); r(); r(); }
    }
    // sonar ping trails: short vertical dot runs
    const pings = schedule(r, SW, 0.9, 2.2);
    for (const px0 of pings) {
      const px = nudge(px0);
      let py = 95 + r() * 140;
      const cnt = 3 + (r() < 0.4 ? 1 : 0);
      for (let k = 0; k < cnt; k++) {
        out += `<circle cx="${F(px + (r() - 0.5) * 6)}" cy="${F(py)}" r="1.4" fill="${INKS.platinum}" opacity="${O(0.13 + 0.06 * r())}"/>`;
        py += 26 + r() * 16;
      }
    }

    // ---- repeater schedule (moved BEFORE the cable draw — the landfall tail
    // and wreck placement need it; safe because the cable block consumes no
    // r() draws, so the primary stream order is unchanged) -------------------
    const reps = schedule(r, SW, 0.55, 1.45).map(nudge)
      .filter((x) => x > 100 && x < xSt - 210 && Math.abs(x - trenchX) > 520);
    reps.push(nudge(trenchX + (r() - 0.5) * 70)); // the trench-span repeater
    const last = reps.length - 1;
    let bu1 = -1, bu2 = -1;
    if (last >= 2) {
      bu1 = Math.floor(r() * last);
      bu2 = (bu1 + 2 + Math.floor(r() * Math.max(1, last - 3))) % last; // v3.2: demoted to c.gb below
    }
    // v3.2: ONE true branching unit — the repeater nearest u~0.31 on the
    // slope (preferring the u 0.26-0.36 window, >=80px off every cut) gets a
    // Y-housing + a diverging spur; warm accents stay rationed (bu2 demoted).
    const cutDist = (x) => { const m = ((x % W) + W) % W; return Math.min(m, W - m); };
    let buIdx = -1, buScore = 1e9;
    for (let i = 0; i < last; i++) {
      const d = Math.abs(reps[i] - 0.31 * SW);
      const score = (reps[i] > 0.26 * SW && reps[i] < 0.36 * SW) ? d : d + 4000;
      if (cutDist(reps[i]) >= 80 && score < buScore) { buScore = score; buIdx = i; }
    }

    // ---- v3.2: charted shipwreck, half-buried on the abyssal plain ---------
    // (INK ONLY — no hue, no glow — so it stays sub-landmark). Preferred spot
    // is u~0.485; the scan slides along the plain until the WHOLE wreck
    // (hull -65..+150 incl. sediment wedge) is >=55px clear of every cut and
    // >=600px from every repeater, staying as close to the brief spot as the
    // seed's schedule allows.
    let wx = 5238, wFar = -1;
    const wJ = (rX() - 0.5) * 40;
    for (let t = 0; t <= 26; t++) {
      const cxw = 5076 + (6156 - 5076) * (t / 26) + wJ;
      if (Math.floor((cxw - 120) / W) !== Math.floor((cxw + 205) / W)) continue; // stay 55px clear of cuts
      let dmin = 1e9;
      for (const rx of reps) dmin = Math.min(dmin, Math.abs(rx - cxw));
      const score = dmin >= 600 ? 1e6 - Math.abs(cxw - 5238) : dmin;
      if (score > wFar) { wFar = score; wx = cxw; }
    }
    const wy = nearY(wx) + 5; // hull centre sits just below the floor line
    out += `<g transform="rotate(8 ${F(wx)} ${F(wy)})">`
      + `<path d="M${F(wx - 60)},${F(wy)} Q${F(wx - 28)},${F(wy - 11)} ${F(wx + 16)},${F(wy - 9)} Q${F(wx + 50)},${F(wy - 7)} ${F(wx + 60)},${F(wy + 2)} L${F(wx + 52)},${F(wy + 11)} Q${F(wx)},${F(wy + 15)} ${F(wx - 52)},${F(wy + 10)} Z" fill="${INKS.coal}" opacity="0.55"/>`
      + `<path d="M${F(wx - 57)},${F(wy - 1)} Q${F(wx - 28)},${F(wy - 10)} ${F(wx + 16)},${F(wy - 8)} Q${F(wx + 48)},${F(wy - 6)} ${F(wx + 57)},${F(wy + 1)}" fill="none" stroke="${INKS.platinum}" stroke-width="1" opacity="0.16"/>`
      + `<line x1="${F(wx - 10)}" y1="${F(wy - 9)}" x2="${F(wx - 16)}" y2="${F(wy - 28)}" stroke="${INKS.platinum}" stroke-width="1" opacity="0.16"/>`
      + `</g>`
      + `<path d="M${F(wx + 52)},${F(wy + 3)} L${F(wx + 145)},${F(wy + 10)} L${F(wx + 54)},${F(wy + 11)} Z" fill="${INKS.coal}" opacity="0.25"/>`;

    // ---- v3.2: sea-plough burial track beside the buried shore-end ---------
    const plough = (x0, x1, op) => {
      let d = 'M' + Math.round(x0) + ',' + F(nearY(x0) - 1 + (nzP(x0 / 90) - 0.5) * 6);
      for (let x = x0 + 34; x <= x1; x += 34) d += 'L' + Math.round(x) + ',' + F(nearY(x) - 1 + (nzP(x / 90) - 0.5) * 6);
      return `<path d="${d}" fill="none" stroke="${INKS.silver}" stroke-width="1" stroke-dasharray="14 22 6 18" opacity="${O(op)}"/>`;
    };
    out += plough(150, 2150, 0.14) + plough(2152, 2350, 0.07);

    // ---- THE CABLE ---------------------------------------------------------
    const xEnd = xSt - 79;                    // beach manhole at the wall
    const gy = terr[Math.round(xSt / stepC)]; // station ground line
    const xDip = xEnd - 90;                   // articulated-pipe dive point
    const yAt = (x) => cabAt(Math.max(0, Math.min(n - 1, Math.round(x / stepC))));
    const tailY = (x) => {                    // v3.2: dive under the beach
      if (x <= xDip) return yAt(x);
      const t = ss01((x - xDip) / 90);
      return yAt(xDip) * (1 - t) + (gy + 4) * t;
    };
    let dcab = 'M0,' + F(cabAt(0));
    for (let i = 2; i * stepC <= xDip; i += 2) dcab += 'L' + Math.round(i * stepC) + ',' + F(cabAt(i));
    for (let x = xDip + 15; x < xEnd; x += 15) dcab += 'L' + F(x) + ',' + F(tailY(x));
    dcab += 'L' + F(xEnd) + ',' + F(gy + 4);
    // v3.2: articulated-pipe sheath under-stroke on the final run
    let dsh = '';
    const shX0 = nudge(xEnd - 260);
    for (let x = shX0; x < xEnd; x += 16) dsh += (dsh ? 'L' : 'M') + F(x) + ',' + F(tailY(x));
    dsh += 'L' + F(xEnd) + ',' + F(gy + 4);
    out += `<path d="${dsh}" fill="none" stroke="${c.b}" stroke-width="3.4" opacity="0.30"/>`;
    out += `<path d="${dcab}" fill="none" stroke="${c.gb}" stroke-width="9" opacity="${O(0.1 * boost)}"/>`;
    out += `<path d="${dcab}" fill="none" stroke="${c.b}" stroke-width="2.2" opacity="0.6"/>`;
    // v3.2: beach manhole hatch + buried conduit to the station footing
    out += `<rect x="${F(xEnd - 5)}" y="${F(gy - 1)}" width="10" height="5" fill="none" stroke="${INKS.silver}" stroke-width="1" opacity="0.28"/>`;
    out += `<line x1="${F(xEnd + 5)}" y1="${F(gy + 3)}" x2="${F(xSt - 14)}" y2="${F(gy + 8)}" stroke="${INKS.silver}" stroke-width="1" stroke-dasharray="4 10" opacity="0.14"/>`;
    // v3.2: free-span touchdown ticks where the cable leaves the trench lips
    {
      const iT = Math.max(1, Math.min(n - 2, Math.round(trenchX / stepC)));
      let iL = iT, iR = iT;
      while (iL > 1 && terr[iL] - cab[iL] > 3) iL--;   // gap = terrain below rope
      while (iR < n - 2 && terr[iR] - cab[iR] > 3) iR++;
      for (const it of [iL, iR]) {
        const tx = nudge(it * stepC);
        const ty = yAt(tx);
        out += `<line x1="${F(tx)}" y1="${F(ty - 4)}" x2="${F(tx)}" y2="${F(ty + 4)}" stroke="${INKS.silver}" stroke-width="1.2" opacity="0.22"/>`;
      }
    }

    // ---- repeater rendering (v3.2: in-line pressure housings; warm light =
    // bu1 + the true branching unit; the r() draws keep their exact order) ---
    for (let i = 0; i < reps.length; i++) {
      const x = reps[i];
      const ci = Math.max(0, Math.min(n - 1, Math.round(x / stepC)));
      const y = cabAt(ci) - 1;
      const col = (i === bu1 || i === buIdx) ? c.ga : c.gb;
      if (y > 1045) out += `<circle cx="${F(x)}" cy="${F(y)}" r="${F(115 + 55 * r())}" fill="${col}" opacity="${O((0.065 + 0.025 * r()) * boost)}" filter="url(#nb-blur)"/>`;
      // housing lozenge spliced in line with the rope, rotated to its slope
      const ang = Math.atan2(cabAt(Math.min(n - 1, ci + 3)) - cabAt(Math.max(0, ci - 3)), 6 * stepC) * 180 / Math.PI;
      const hw = i === buIdx ? 17 : 13, hh = i === buIdx ? 5.5 : 4.5;
      out += `<g transform="rotate(${F(ang)} ${F(x)} ${F(y)})"><rect x="${F(x - hw)}" y="${F(y - hh)}" width="${hw * 2}" height="${hh * 2}" rx="${F(hh)}" fill="${INKS.coal}" fill-opacity="0.5" stroke="${INKS.silver}" stroke-width="1" stroke-opacity="0.3"/>`
        + (i === buIdx ? `<rect x="${F(x - 3)}" y="${F(y - hh - 6)}" width="14" height="6" rx="3" fill="${INKS.coal}" fill-opacity="0.5" stroke="${INKS.silver}" stroke-width="1" stroke-opacity="0.3" transform="rotate(-26 ${F(x)} ${F(y)})"/>` : '')
        + `</g>`;
      out += `<circle cx="${F(x)}" cy="${F(y)}" r="${(20 + 6 * r()).toFixed(1)}" fill="${col}" opacity="${O(0.07 * boost)}"/>`;
      out += `<circle cx="${F(x)}" cy="${F(y)}" r="${(7 + 4 * r()).toFixed(1)}" fill="${col}" opacity="${O(0.2 * boost)}"/>`;
      out += `<circle cx="${F(x)}" cy="${F(y)}" r="3.1" fill="${col}" opacity="0.6"/>`;
      if (i === buIdx) {
        // v3.2: diverging spur — implied route to a second landing, curving
        // toward the far ridge band and dissolving (opacity 0.4 -> 0)
        let sx = x, sy = y;
        for (let s = 1; s <= 7; s++) {
          const t = s / 7, e = t * t * (3 - 2 * t);
          const nx2 = x + 420 * t;
          const ny2 = y + (farY(nx2) + 46 - y) * e * 0.85;
          out += `<line x1="${F(sx)}" y1="${F(sy)}" x2="${F(nx2)}" y2="${F(ny2)}" stroke="${c.b}" stroke-width="1.4" opacity="${O(0.4 * (1 - t * 0.97))}"/>`;
          sx = nx2; sy = ny2;
        }
      }
    }

    // ---- shore station (dark silhouette, one warm light) --------------------
    out += `<rect x="${F(xSt - 78)}" y="${F(gy - 64)}" width="150" height="90" fill="${INKS.coal}" opacity="0.88"/>`;
    out += `<rect x="${F(xSt + 72)}" y="${F(gy - 34)}" width="52" height="60" fill="${INKS.coal}" opacity="0.88"/>`;
    out += `<line x1="${F(xSt - 78)}" y1="${F(gy - 64)}" x2="${F(xSt + 72)}" y2="${F(gy - 64)}" stroke="${INKS.silver}" stroke-width="1.2" opacity="0.3"/>`;
    out += `<line x1="${F(xSt + 72)}" y1="${F(gy - 34)}" x2="${F(xSt + 124)}" y2="${F(gy - 34)}" stroke="${INKS.silver}" stroke-width="1" opacity="0.2"/>`;
    out += `<line x1="${F(xSt - 70)}" y1="${F(gy - 63)}" x2="${F(xSt - 70)}" y2="${F(gy - 150)}" stroke="${INKS.silver}" stroke-width="1.5" opacity="0.24"/>`;
    // v3.2: two faintest windows dimmed 0.34/0.30 -> 0.28/0.24 to pay for the
    // beacon signature below
    out += `<rect x="${F(xSt - 40 + 8 * r())}" y="${F(gy - 44)}" width="7" height="6" fill="${c.ga}" opacity="0.42"/>`;
    out += `<rect x="${F(xSt + 6 + 10 * r())}" y="${F(gy - 41)}" width="6" height="6" fill="${c.ga}" opacity="0.28"/>`;
    out += `<rect x="${F(xSt + 84 + 8 * r())}" y="${F(gy - 22)}" width="5" height="5" fill="${c.ga}" opacity="0.24"/>`;
    // v3.2: beacon signature — mast highlight, brighter core, two beam ticks
    // (a navigational light no repeater can be mistaken for, in every hue)
    out += `<line x1="${F(xSt - 70)}" y1="${F(gy - 150)}" x2="${F(xSt - 70)}" y2="${F(gy - 104)}" stroke="${INKS.silver}" stroke-width="2" opacity="0.10"/>`;
    out += `<circle cx="${F(xSt - 70)}" cy="${F(gy - 156)}" r="11" fill="${c.ga}" opacity="${O(0.18 * boost)}"/>`;
    out += `<line x1="${F(xSt - 92)}" y1="${F(gy - 156)}" x2="${F(xSt - 78)}" y2="${F(gy - 156)}" stroke="${c.ga}" stroke-width="1.2" opacity="0.22"/>`;
    out += `<line x1="${F(xSt - 62)}" y1="${F(gy - 156)}" x2="${F(xSt - 48)}" y2="${F(gy - 156)}" stroke="${c.ga}" stroke-width="1.2" opacity="0.22"/>`;
    out += `<circle cx="${F(xSt - 70)}" cy="${F(gy - 156)}" r="3.2" fill="${c.ga}" opacity="0.7"/>`;

    // ---- v3.2: dark-not-blank on the abyssal pages — a fourth current-drift
    // wisp over the plain + one extra sonar ping trail (both whisper-band,
    // well above the terrain, below pool brightness; independent rW channel)
    {
      const xw0 = (4.6 + 0.5 * rW()) * W;
      const len = 1.6 * W;
      const yw0 = 245 + 50 * rW(); // stays inside y 210-330 with the wander
      let d = 'M' + Math.round(xw0) + ',' + F(yw0 + (nzW(xw0 / 520 + 37) - 0.5) * 70);
      for (let x = xw0 + 40; x < Math.min(SW - 90, xw0 + len); x += 40) d += 'L' + Math.round(x) + ',' + F(yw0 + (nzW(x / 520 + 37) - 0.5) * 70);
      out += `<path d="${d}" fill="none" stroke="${INKS.platinum}" stroke-width="1" opacity="${O(0.06 + 0.02 * rW())}"/>`;
      const px = nudge((0.42 + 0.16 * rW()) * SW);
      let py = 95 + rW() * 140;
      const cnt = 3 + (rW() < 0.4 ? 1 : 0);
      for (let k = 0; k < cnt; k++) {
        out += `<circle cx="${F(px + (rW() - 0.5) * 6)}" cy="${F(py)}" r="1.4" fill="${INKS.platinum}" opacity="${O(0.13 + 0.06 * rW())}"/>`;
        py += 26 + rW() * 16;
      }
    }

    return out;
  },
};
})();

// ═══ END GENERATED STYLES ═══
