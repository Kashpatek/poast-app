// ═══════════════════════════════════════════════════════════════════════════
// Library platform v2 · palette — category-driven tint for the 36 baked-BLEND
// backgrounds (contract docs/LIBRARY-INTEGRATION.md v2 §P). CATEGORY picks
// the tint: general = blend (baked identity) · internal = amber · external =
// cobalt · capital = green — the same mapping as the THEMES slide-backdrop
// system.
//
// Recoloring is exact-token replacement over the background SVG document TEXT
// only — compose applies it before the bg is inlined, so template overlays
// keep their brand colors. Token census across public/library/backgrounds/
// *.svg (2026-07-13, re-verified against the shipped files):
//   amber family  #F7B041 ×2667 · #FFCB6B ×93 · #E8A830 ×21 · #F6C25A ×1
//                 rgba(247,176,65,a) ×78
//   cobalt family #0092FF ×1905 · #0B86D1 ×564 · #3BABFF ×403 · #0A6AA6 ×56
//                 #9fd4ff ×21 (baked LOWERCASE — lookups normalize) · #7FC4F0 ×1
//                 rgba(11,134,209,a) ×69
//   neutral — NEVER remapped: #2B3340 · #FFF / #FFFFFF · #10141C · #0A0B10 ·
//                 #05070A · #0A0F1A · #08120F · #070A12 · #080A0D · #E8E8E8 ·
//                 #000 / #000000 · rgba(255,255,255,x) · rgba(0,0,0,0)
// Every family token above appears in every map that moves its family — an
// unmapped family token would silently stay blend, which reads as a bug on a
// tinted canvas.
// ═══════════════════════════════════════════════════════════════════════════

import type { ThemeKey } from "../types";

export type LibPalette = "blend" | "amber" | "cobalt" | "green";

// Category → tint (v2 platform rule). general ships the baked blend untouched.
export var CATEGORY_PALETTE: Record<ThemeKey, LibPalette> = {
  general: "blend",
  internal: "amber",
  external: "cobalt",
  capital: "green",
};

// ─── role-preserving token maps ───
// Design rules (contract §P): each palette keeps (or re-anchors) one family
// and re-registers EVERY token of the other onto a DISTINCT register of a
// second hue, so the two-tone depth of the baked designs survives — never
// collapse both families into one hex. Relative lightness ordering inside
// each family is preserved (vivid stays vividest, deep stays deepest). rgba
// tokens are mapped as the "rgba(r,g,b," PREFIX so the baked alpha channel
// passes through exactly. Hex map keys are UPPERCASE; the scanner normalizes
// matches before lookup (#9fd4ff is baked lowercase).

// AMBER (internal): ambers keep their baked identity; cobalts move to a hot
// orange/bronze ladder (hue ≈28° vs the kept ambers' ≈40°) so the former
// blue voice stays a separate, warmer second voice.
var AMBER_MAP: Record<string, string> = {
  "#9FD4FF": "#FFD2A0", // pale ice      → pale peach (lightest stays lightest)
  "#7FC4F0": "#F5B57E", // soft ice      → soft apricot
  "#3BABFF": "#FF9C4A", // light vivid   → light hot orange
  "#0092FF": "#FF8A1E", // vivid cobalt  → hot vivid amber-orange
  "#0B86D1": "#D66F1A", // mid cobalt    → burnt orange
  "#0A6AA6": "#8C4A12", // deep cobalt   → deep bronze (deepest stays deepest)
  "rgba(11,134,209,": "rgba(214,111,26,", // mid-cobalt washes → burnt orange, alpha kept
  // amber family (#F7B041 #FFCB6B #E8A830 #F6C25A, rgba(247,176,65,a)):
  // intentionally absent — kept verbatim as the baked identity.
};

// COBALT (external): mirror image — cobalts keep their baked identity;
// ambers move to an ice-cyan ladder (hue ≈190–196° vs the kept cobalts'
// ≈205° azure), a colder second voice beside the kept blues.
var COBALT_MAP: Record<string, string> = {
  "#FFCB6B": "#8FE0F0", // light amber   → light ice cyan (lightest stays lightest)
  "#F6C25A": "#5FC9E8", // mid amber     → mid cyan
  "#F7B041": "#2FB1E0", // core amber    → vivid cyan (distinct from kept #0092FF azure)
  "#E8A830": "#1A87B0", // deep amber    → steel cyan (deepest stays deepest)
  "rgba(247,176,65,": "rgba(47,177,224,", // core-amber washes → vivid cyan, alpha kept
  // cobalt family (#0092FF #0B86D1 #3BABFF #0A6AA6 #9FD4FF #7FC4F0,
  // rgba(11,134,209,a)): intentionally absent — kept verbatim.
};

// GREEN (capital): BOTH families move — ambers onto a mint ladder anchored
// on SA mint #2EAD8E (hue ≈163°), cobalts onto a deeper teal ladder
// (hue ≈180–184°) — two distinguishable green registers.
var GREEN_MAP: Record<string, string> = {
  // amber → mint (core anchors exactly on SA mint)
  "#FFCB6B": "#7FDCC0", // light amber   → pale mint (lightest stays lightest)
  "#F6C25A": "#55C7A6", // mid amber     → light mint
  "#F7B041": "#2EAD8E", // core amber    → SA mint (anchor)
  "#E8A830": "#1F8A6F", // deep amber    → deep mint (deepest stays deepest)
  "rgba(247,176,65,": "rgba(46,173,142,", // core-amber washes → SA mint, alpha kept
  // cobalt → teal
  "#9FD4FF": "#9BDBDB", // pale ice      → pale teal (lightest stays lightest)
  "#7FC4F0": "#6FC9C9", // soft ice      → soft teal
  "#3BABFF": "#35B9B9", // light vivid   → light teal
  "#0092FF": "#00A5A5", // vivid cobalt  → vivid teal
  "#0B86D1": "#0A7E86", // mid cobalt    → deep teal
  "#0A6AA6": "#085F66", // deep cobalt   → deepest teal (deepest stays deepest)
  "rgba(11,134,209,": "rgba(10,126,134,", // mid-cobalt washes → deep teal, alpha kept
};

var PALETTE_MAPS: Record<Exclude<LibPalette, "blend">, Record<string, string>> = {
  amber: AMBER_MAP,
  cobalt: COBALT_MAP,
  green: GREEN_MAP,
};

// One-pass token scanner: the two family rgba( prefixes first, then 6-digit
// hex, then 3-digit hex, each hex alternative guarded by (?![0-9A-Fa-f]) so
// a longer token is never half-replaced (single pass ≡ longest-first, and a
// replacement's output is never re-scanned). 3-digit neutrals (#FFF, #000)
// match but are never in a map; #FFFFFF likewise misses the maps — both
// spellings pass through untouched, as all neutrals must.
var TOKEN_RE = /rgba\(247,176,65,|rgba\(11,134,209,|#[0-9A-Fa-f]{6}(?![0-9A-Fa-f])|#[0-9A-Fa-f]{3}(?![0-9A-Fa-f])/g;

// Recolor one background SVG document text. blend = identity — the returned
// string is the input reference, byte-identical to the baked file, so v1
// output (and probe-library's reload determinism) cannot drift. Hex matches
// are uppercased before lookup; unmapped tokens pass through unchanged.
export function recolorBgSvg(svg: string, palette: LibPalette): string {
  if (palette === "blend") return svg;
  var map = PALETTE_MAPS[palette];
  return String(svg || "").replace(TOKEN_RE, function (tok) {
    var hit = map[tok.charAt(0) === "#" ? tok.toUpperCase() : tok];
    return hit !== undefined ? hit : tok;
  });
}

// ─── test hook ───
// Probe/rig-only: raw tables + scanner so verify rigs can cross-check their
// duplicated copies (verify/shoot-palettes.js restates the maps by hand).
export var __paletteInternals = {
  AMBER_MAP: AMBER_MAP,
  COBALT_MAP: COBALT_MAP,
  GREEN_MAP: GREEN_MAP,
  TOKEN_RE: TOKEN_RE,
};
