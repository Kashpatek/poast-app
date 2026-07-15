// ═══════════════════════════════════════════════════════════════════════════
// Library mode · backdrop assignment — EXACT semantic port of
// docs/handoff-20260713/pickBackdrop.reference.js (same math, same names).
// verify/probe-library-core.js diffs outputs 1:1 against the reference AND
// structurally checks the expressions below — change nothing here without
// changing the reference upstream first.
//
// Concept: backgrounds are CATEGORICALLY DECIDED (topic → pool) and FINALIZED
// IN THE WIZARD (user picks one of 3 candidates, or any of the 36). No
// Math.random / Date.now: deterministic given (seed, topic, slide, overrides),
// so drafts re-render identically until the user overrides.
// ═══════════════════════════════════════════════════════════════════════════

import type { LibTopic, TopicsData } from "./data";
import { NATIVE_PREFIX, isNativeKey, nativeDefaultPool } from "./nativebg";
import type { NativeHue } from "./nativebg";

/** Simple stable string hash for post ids. (FNV-1a, same as reference) */
export function postSeed(postId: string): number {
  var h = 2166136261;
  for (var i = 0; i < String(postId).length; i++) {
    h ^= String(postId).charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// "brand" is guaranteed present in backdrop-topics.json (it IS the fallback
// pool); the reference assumes the same, so the assertion is safe.
function topicOrBrand(topics: TopicsData, topicKey: string): LibTopic {
  return (
    topics.topics.find(function (x) { return x.key === topicKey; }) ||
    (topics.topics.find(function (x) { return x.key === "brand"; }) as LibTopic)
  );
}

/** Ordered candidate pool for a topic: primary first, then secondary, then brand primary. */
export function poolFor(topics: TopicsData, topicKey: string): string[] {
  var t = topicOrBrand(topics, topicKey);
  var brand = topics.topics.find(function (x) { return x.key === "brand"; }) as LibTopic;
  var seen = new Set<string>();
  return [...t.primary, ...t.secondary, ...brand.primary].filter(function (k) { return !seen.has(k) && seen.add(k); });
}

/**
 * The wizard's "3 selections": deterministic lead pick + two alternates.
 * candidates[0] — the assigned pick for this slide (primary pool, seed-rotated)
 * candidates[1] — next primary (same category, different look)
 * candidates[2] — first secondary (range) — falls back to another primary if none
 */
export function candidates(topics: TopicsData, topicKey: string, seed: number, slideIndex: number = 0): string[] {
  var t = topicOrBrand(topics, topicKey);
  var p = t.primary, s = t.secondary;
  var lead = p[(seed + slideIndex) % p.length];
  var alt1 = p[(seed + slideIndex + 1) % p.length];
  var alt2 = s.length ? s[(seed + slideIndex) % s.length] : p[(seed + slideIndex + 2) % p.length];
  return [...new Set([lead, alt1, alt2])];
}

/**
 * Final resolution for a slide.
 * @param override  a backdrop key the user finalized for this slide (or post-level default);
 *                  always wins — the user can always select another.
 * @param prevKey   the previous slide's key; the assigned pick advances past it so two
 *                  consecutive slides never repeat a background.
 */
export function pickBackdrop(
  topics: TopicsData,
  topicKey: string,
  seed: number,
  slideIndex: number = 0,
  override: string | null = null,
  prevKey: string | null = null
): string {
  if (override) return override;
  var pool = poolFor(topics, topicKey);
  var i = (seed + slideIndex) % pool.length;
  if (pool[i] === prevKey) i = (i + 1) % pool.length;
  return pool[i];
}

/**
 * Run pickBackdrop across a whole deck (the store calls this on every
 * topic/override/order change and stamps the result into slide.libraryBg).
 * prevKey chains on the RESOLVED key of the previous slide — a user override
 * feeds the no-consecutive-repeat rule for the slide after it, exactly like
 * the reference's example wiring.
 */
export function resolveBgChain(
  overrides: (string | null | undefined)[],
  topics: TopicsData,
  topicKey: string,
  seed: number
): string[] {
  var out: string[] = [];
  var prevKey: string | null = null;
  for (var i = 0; i < overrides.length; i++) {
    var key = pickBackdrop(topics, topicKey, seed, i, overrides[i] || null, prevKey);
    out.push(key);
    prevKey = key;
  }
  return out;
}

// ═══ Infinity mode (platform v3, 2026-07-14) — NOT part of the reference
// port above; a deliberate extension. The whole deck shares ONE backdrop key
// and odd positions mirror it horizontally, so slide N's right edge equals
// slide N+1's left edge exactly and the carousel reads as a single
// (slides × 1080) × 1350 strip. ═══

// v3.6 extension-zone import — imports hoist, and this MUST live below the
// guarded reference port (lines 1-103 stay byte-identical to the handoff).
import { nativePoolForTopic } from "./nativebg";
void nativeDefaultPool; // guarded import above kept verbatim; unused post-v3.6

/** Backdrops carrying faint ticker TEXT — mirroring would render it
 *  backwards, so infinity auto-pick skips them and manual picks disable the
 *  mirror (identical repeats; seams rely on the bg's own edge continuity). */
export var MIRROR_UNSAFE: Record<string, boolean> = { "23": true, "29": true };

/** Backdrops whose seams stay pixel-continuous but where the mirror trick is
 *  perceptually LOUD (2026-07-14 seam review, 3/3 adversarial confirmations
 *  each): one dominant directional feature folds into Rorschach/chevron
 *  shapes exactly at slide boundaries (04 diagonal sweep, 06 comet head,
 *  10/14 contour ink-blots, 22 perspective-floor V-columns, 24 arc vesica,
 *  35 sliver/merged racks). Infinity auto-pick skips them; a MANUAL pick
 *  still mirrors — the symmetry may be wanted, and unmirrored repeats would
 *  show real seams. Every topic pool keeps ≥2 mirrorable keys after skips. */
export var MIRROR_WEAK: Record<string, boolean> = {
  "04": true, "06": true, "10": true, "14": true,
  "22": true, "24": true, "35": true,
};

/** ∞ approval sitting (Akash, 2026-07-15, 54/54 decided): ONLY these baked
 *  keys stay usable in infinity mode — on the rest the mirror fold reads as
 *  a crease where glows fade across the joint. Rotate mode (per-slide, no
 *  mirroring) keeps all 36; an already-stamped ∞ override keeps rendering. */
export var INFINITY_BAKED_KEEP: Record<string, boolean> = {
  "01": true, "03": true, "05": true, "08": true, "12": true,
  "16": true, "20": true, "28": true, "33": true,
};

/** Deck-level infinity resolution: one key — the first override wins; a
 *  fresh deck (no override) gets a NATIVE family ("n:<fam>", v3.1),
 *  seed-rotated so different posts land on different worlds. Native strips
 *  are continuous by construction and NEVER flip; baked overrides mirror on
 *  odd slides unless mirror-unsafe. Deterministic given (seed, topic,
 *  overrides) like the rotate chain.
 *
 *  pickBakedInfinity is the pre-native auto-pick (topic pool advanced past
 *  mirror-unsafe/-weak keys) — kept exported for the review gallery and as
 *  the documented fallback semantics should the native default ever revert. */
export function pickBakedInfinity(topics: TopicsData, topicKey: string, seed: number): string {
  var pool = poolFor(topics, topicKey);
  var at = seed % pool.length;
  for (var step = 0; step < pool.length; step++) {
    var cand = pool[(at + step) % pool.length];
    if (INFINITY_BAKED_KEEP[cand] && !MIRROR_UNSAFE[cand] && !MIRROR_WEAK[cand]) return cand;
  }
  // topic pool holds no approved key: rotate over the approved set itself
  // (every approved key already passed the seam panel — none are weak/unsafe)
  var appr = Object.keys(INFINITY_BAKED_KEEP).sort();
  if (appr.length) return appr[seed % appr.length];
  // approval list empty (never true today): original fallback semantics
  for (var step2 = 0; step2 < pool.length; step2++) {
    var cand2 = pool[(at + step2) % pool.length];
    if (!MIRROR_UNSAFE[cand2]) return cand2;
  }
  return pool[at]; // all unsafe: keep lead, no mirror
}

export function resolveBgInfinity(
  overrides: (string | null | undefined)[],
  topics: TopicsData,
  topicKey: string,
  seed: number,
  palette?: NativeHue
): { keys: string[]; flips: boolean[] } {
  var deckKey: string | null = null;
  for (var i = 0; i < overrides.length; i++) {
    if (overrides[i]) { deckKey = overrides[i] as string; break; }
  }
  if (!deckKey) {
    // v3.2: rotate over the deck category's style compositions (the fixed
    // 10-page graphics); classics stay as manual picks once styles exist.
    // v3.6: the post's TOPIC narrows the rotation to the styles that
    // symbolize it (NATIVE_TOPIC_AFFINITY) — the ∞ default now honors the
    // topic parse the same way the baked pools always have.
    var pool = nativePoolForTopic(palette || "blend", topicKey);
    deckKey = NATIVE_PREFIX + pool[seed % pool.length];
  }
  var mirrorable = !isNativeKey(deckKey) && !MIRROR_UNSAFE[deckKey];
  var keys: string[] = [];
  var flips: boolean[] = [];
  for (var j = 0; j < overrides.length; j++) {
    keys.push(deckKey);
    flips.push(mirrorable && j % 2 === 1);
  }
  return { keys: keys, flips: flips };
}
