// ═══════════════════════════════════════════════════════════════════════════
// Library mode · composeLibrarySvg — background + populated template as ONE
// 1080x1350 SVG string, shared verbatim between DOM preview and PNG export
// (contract docs/LIBRARY-INTEGRATION.md §B; rendering rules from the handoff
// README "learned the hard way" list).
//
// Composition is pure and synchronous given cached SVG texts: all fetching
// goes through ensureLibraryAssets() into module caches, and compose returns
// null until they are warm (renderers kick ensure + re-render on resolve).
// Text population is DOM-based (DOMParser + XMLSerializer — this module runs
// client-side only, same as the unique renderer) with real canvas measureText,
// fitting DOWN from the baked font-size toward data-minfont and never past
// the baked size — layouts were tuned against overflow that way. Deterministic:
// no Math.random / Date; slot clipPath ids derive from slide.id + slot name.
// ═══════════════════════════════════════════════════════════════════════════

import type { Slide } from "../types";
import type { LibTemplate } from "./data";
import { loadTemplates, templatesSync, bgSvgUrl, tplSvgUrl } from "./data";
import type { LibPalette } from "./palette";
import { recolorBgSvg } from "./palette";
import type { NativeHue } from "./nativebg";
import { isNativeKey, nativeGenKeyOf, renderNativeBgInner } from "./nativebg";

var SVG_NS = "http://www.w3.org/2000/svg";
var FALLBACK_BG = "02"; // resolved key should always be stamped by the store; belt-and-braces

// ─── SVG-text caches (url → text, + in-flight dedupe, same shape as data.ts) ───
var svgTextCache: Record<string, string> = {};
var svgTextInflight: Record<string, Promise<string> | undefined> = {};

// Fetch one SVG text once. A failed fetch clears the in-flight slot so the
// next ensure retries instead of caching the error forever.
function fetchSvgText(url: string): Promise<string> {
  var cached = svgTextCache[url];
  if (cached !== undefined) return Promise.resolve(cached);
  var inflight = svgTextInflight[url];
  if (inflight) return inflight;
  var p = fetch(url)
    .then(function (r) {
      if (!r.ok) throw new Error("svg fetch failed: " + r.status + " " + url);
      return r.text();
    })
    .then(function (text) {
      svgTextCache[url] = text;
      return text;
    })
    .catch(function (e) {
      svgTextInflight[url] = undefined;
      throw e;
    });
  svgTextInflight[url] = p;
  return p;
}

function templateByIdx(templates: LibTemplate[], idx: number | undefined): LibTemplate | null {
  if (idx == null) return null;
  for (var i = 0; i < templates.length; i++) {
    if (templates[i].idx === idx) return templates[i];
  }
  return null;
}

// Distinct asset URLs a deck needs: each library slide's template SVG + its
// resolved backdrop SVG (needed-only; the renderer's ensure-on-null is the
// on-demand path for anything that changes later).
function neededUrls(slides: Slide[], templates: LibTemplate[]): string[] {
  var urls: Record<string, boolean> = {};
  for (var i = 0; i < slides.length; i++) {
    var s = slides[i];
    if (s.type !== "library") continue;
    var t = templateByIdx(templates, s.libraryTemplate);
    if (t) urls[tplSvgUrl(t)] = true;
    // Native infinity bgs are generated, not fetched — no URL to warm.
    if (!isNativeKey(s.libraryBg)) urls[bgSvgUrl(s.libraryBg || FALLBACK_BG)] = true;
  }
  return Object.keys(urls);
}

// Text fitting measures with canvas measureText, and Grift's metrics differ
// from the fallback font — but composedCache keys don't carry font state, so
// a compose that ran before the webfonts landed would stay stale (wrong
// wraps/line heights) until some other input changed. Gate the FIRST compose
// behind fonts.ready instead: local twin of export-renderer's
// ensureFontsReady (importing it would cycle — export-renderer imports from
// this module). Resolves immediately once fonts are loaded.
function fontsForMeasure(): Promise<void> {
  if (typeof document === "undefined" || !document.fonts) return Promise.resolve();
  return Promise.all([
    document.fonts.load("400 16px Grift"),
    document.fonts.load("700 16px Grift"),
    document.fonts.load("800 16px Grift"),
  ])
    .then(function () { return document.fonts.ready; })
    .then(function () {}, function () {}); // font API failure: measure with fallback
}

// Prefetch templates.json + every distinct template/bg SVG text the deck
// needs into the module caches, and wait for the measuring fonts. Rejects on
// any failed fetch (in-flight slots are cleared, so a later call retries).
export function ensureLibraryAssets(slides: Slide[]): Promise<void> {
  var hasLibrary = false;
  for (var i = 0; i < (slides || []).length; i++) {
    if (slides[i].type === "library") { hasLibrary = true; break; }
  }
  if (!hasLibrary) return Promise.resolve();
  return loadTemplates().then(function (templates) {
    var waits: Promise<unknown>[] = neededUrls(slides, templates).map(fetchSvgText);
    waits.push(fontsForMeasure());
    return Promise.all(waits).then(function () {});
  });
}

// True once composeLibrarySvg can run synchronously for every library slide
// in the deck (templates.json resolved + all needed SVG texts cached).
export function libraryAssetsReady(slides: Slide[]): boolean {
  var templates = templatesSync();
  for (var i = 0; i < (slides || []).length; i++) {
    var s = slides[i];
    if (s.type !== "library") continue;
    if (!templates) return false;
    var t = templateByIdx(templates, s.libraryTemplate);
    if (t && svgTextCache[tplSvgUrl(t)] === undefined) return false;
    if (!isNativeKey(s.libraryBg) && svgTextCache[bgSvgUrl(s.libraryBg || FALLBACK_BG)] === undefined) return false;
  }
  return true;
}

// ─── text measurement (module-level offscreen canvas) ───

export type MeasureFn = (line: string, size: number) => number;

var measureCtx: CanvasRenderingContext2D | null = null;
function getMeasureCtx(): CanvasRenderingContext2D | null {
  if (measureCtx) return measureCtx;
  if (typeof document === "undefined") return null;
  var c = document.createElement("canvas");
  c.width = 32;
  c.height = 32;
  measureCtx = c.getContext("2d");
  return measureCtx;
}

// The slice of the inline style a field's fit needs. letter-spacing comes in
// px ("1.5px") or em ("-0.03em" — scales with font size); text-transform:
// uppercase must apply BEFORE measuring and before writing tspans.
interface FieldStyle {
  family: string;
  size: number;
  weight: string;
  letterSpacingPx: number;
  letterSpacingEm: number;
  uppercase: boolean;
}

function parseFieldStyle(styleAttr: string): FieldStyle {
  var out: FieldStyle = {
    family: "'Outfit','Inter',sans-serif",
    size: 32,
    weight: "400",
    letterSpacingPx: 0,
    letterSpacingEm: 0,
    uppercase: false,
  };
  var parts = String(styleAttr || "").split(";");
  for (var i = 0; i < parts.length; i++) {
    var colon = parts[i].indexOf(":");
    if (colon < 0) continue;
    var k = parts[i].slice(0, colon).trim().toLowerCase();
    var v = parts[i].slice(colon + 1).trim();
    if (k === "font-family" && v) out.family = v;
    else if (k === "font-size") { var fs = parseFloat(v); if (isFinite(fs) && fs > 0) out.size = fs; }
    else if (k === "font-weight" && v) out.weight = v;
    else if (k === "letter-spacing") {
      var ls = parseFloat(v);
      if (isFinite(ls)) { if (/em\s*$/.test(v)) out.letterSpacingEm = ls; else out.letterSpacingPx = ls; }
    } else if (k === "text-transform" && /uppercase/.test(v)) out.uppercase = true;
  }
  return out;
}

// Real measured width at a given size: ctx.font from the parsed style, plus
// letter-spacing × (chars − 1) when the style sets it. Falls back to an
// estimate (~0.55em/char, unique-renderer ballpark) if canvas is unavailable.
function makeMeasure(style: FieldStyle): MeasureFn {
  return function (line: string, size: number): number {
    var ctx = getMeasureCtx();
    var w: number;
    if (ctx) {
      ctx.font = style.weight + " " + size + "px " + style.family;
      w = ctx.measureText(line).width;
    } else {
      w = line.length * size * 0.55;
    }
    var ls = style.letterSpacingEm ? style.letterSpacingEm * size : style.letterSpacingPx;
    if (ls && line.length > 1) w += ls * (line.length - 1);
    return w;
  };
}

// ─── wrap + fit (pure given a measurer — exposed via __composeInternals) ───

// Greedy word wrap on measured widths. A single word wider than maxWidth is
// kept whole on its own line; the step-down/ellipsis passes handle it.
function wrapFill(text: string, size: number, maxWidth: number, measure: MeasureFn): string[] {
  var words = String(text || "").trim().split(/\s+/).filter(Boolean);
  var lines: string[] = [];
  var line = "";
  for (var i = 0; i < words.length; i++) {
    var cand = line ? line + " " + words[i] : words[i];
    if (line && measure(cand, size) > maxWidth) {
      lines.push(line);
      line = words[i];
    } else {
      line = cand;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

// Hard-truncate one line so line+"…" fits maxWidth: drop trailing words,
// then trailing chars if a single word is still too wide.
function ellipsize(line: string, size: number, maxWidth: number, measure: MeasureFn): string {
  var t = String(line || "");
  var guard = 0;
  while (t && measure(t + "…", size) > maxWidth && guard++ < 400) {
    var cut = t.replace(/\s*\S+$/, "");
    t = cut && cut !== t ? cut : t.slice(0, -1);
    t = t.replace(/\s+$/, "");
  }
  return t + "…";
}

export interface FitResult { lines: string[]; size: number; truncated: boolean }

// Fit DOWN, never up (handoff rule): wrap at the baked size; while the line
// count exceeds the baked tspan count OR any line overflows maxWidth, step
// the size ×0.95 toward minFont (re-wrapping each step). Still overflowing
// at minFont → keep the first maxLines lines and hard-truncate with "…".
function fitFill(
  text: string,
  bakedSize: number,
  minFont: number,
  maxLines: number,
  maxWidth: number,
  measure: MeasureFn
): FitResult {
  var floor = Math.min(isFinite(minFont) && minFont > 0 ? minFont : bakedSize, bakedSize);
  var size = bakedSize;
  var lines = wrapFill(text, size, maxWidth, measure);
  var guard = 0;
  while (overflows(lines, size, maxLines, maxWidth, measure) && size > floor + 0.01 && guard++ < 64) {
    size = Math.max(floor, size * 0.95);
    lines = wrapFill(text, size, maxWidth, measure);
  }
  var truncated = false;
  if (lines.length > maxLines) {
    lines = lines.slice(0, maxLines);
    lines[maxLines - 1] = ellipsize(lines[maxLines - 1], size, maxWidth, measure);
    truncated = true;
  }
  // Width clamp for any line still too wide at the floor (single unbreakable
  // over-long word) — ellipsize that line rather than let it overflow.
  for (var i = 0; i < lines.length; i++) {
    if (measure(lines[i], size) > maxWidth) {
      lines[i] = ellipsize(lines[i], size, maxWidth, measure);
      truncated = true;
    }
  }
  return { lines: lines, size: size, truncated: truncated };
}

function overflows(lines: string[], size: number, maxLines: number, maxWidth: number, measure: MeasureFn): boolean {
  if (lines.length > maxLines) return true;
  for (var i = 0; i < lines.length; i++) {
    if (measure(lines[i], size) > maxWidth) return true;
  }
  return false;
}

function round2(n: number): number { return Math.round(n * 100) / 100; }

// ─── field population (DOM) ───

// Rewrite the style's font-size in place when the fit stepped down.
function setStyleFontSize(el: Element, size: number): void {
  var st = el.getAttribute("style") || "";
  var next = st.replace(/font-size:\s*[^;]+/, "font-size:" + round2(size) + "px");
  if (next === st) next = (st ? st.replace(/;?\s*$/, ";") : "") + "font-size:" + round2(size) + "px";
  el.setAttribute("style", next);
}

// One field's user layout override (EDIT text-fit panel §T): an explicit
// size PINS the font (wrap-only fit, may exceed the baked size — the user
// asked for it), wMul widens/narrows the wrap box, lines resets the budget,
// dx/dy nudge the text in template-space px (may be negative).
export interface FieldLayout { size?: number; wMul?: number; lines?: number; dx?: number; dy?: number }

// Replace one text element's tspans with the fill re-wrapped to data-w.
// Geometry contract: first tspan keeps the baked first-ROW y; subsequent
// lines add the baked row y-delta scaled by (fitted size / baked size),
// fallback 1.18 × font-size when only one row is baked. All tspans keep the
// baked x (text-anchor lives on the <text> element and is untouched). A
// layout dx/dy nudge shifts every tspan by that many template-space px —
// but ONLY when present: without it the baked x attr string is written back
// verbatim, so existing decks serialize byte-identically (export parity).
// Line budget is max(baked ROW count, data-maxlines). Rows — not tspans:
// templates bake styled inline runs as sibling tspans sharing one y, so
// counting tspans inflates the budget past the panel (text collides with
// the deco below it) and reads a same-row sibling as the "second line"
// (y-delta 0 → generic 1.18 fallback instead of the designed grid).
function populateField(doc: Document, textEl: Element, fill: string, layout?: FieldLayout): void {
  var role = textEl.getAttribute("data-role") || "";
  var cls = textEl.getAttribute("class") || "";
  if (role === "logo" || /\bov-logo\b/.test(cls)) return; // brand marks: NEVER modify

  var style = parseFieldStyle(textEl.getAttribute("style") || "");
  var text = style.uppercase ? String(fill).toUpperCase() : String(fill);

  var tspans = textEl.getElementsByTagName("tspan");
  var rawYs: number[] = [];
  for (var ri = 0; ri < tspans.length; ri++) {
    var ry = parseFloat(tspans[ri].getAttribute("y") || "");
    if (isFinite(ry)) rawYs.push(ry);
  }
  rawYs.sort(function (a, b) { return a - b; });
  // Merge runs whose baselines sit closer than half the font size: exact-y
  // dedupe alone still counts baseline-JITTERED decorative runs as rows
  // (#131 bakes size-graded chevrons ~5px apart beside the text row, which
  // read as a 4-row grid with a 4.97px line height — any wrapped fill
  // overprints into an ink blob). A real next line can't sit closer than
  // half the glyph height.
  var rowYs: number[] = [];
  for (var mi = 0; mi < rawYs.length; mi++) {
    if (!rowYs.length || rawYs[mi] - rowYs[rowYs.length - 1] >= style.size * 0.5) rowYs.push(rawYs[mi]);
  }
  var bakedCount = Math.max(1, rowYs.length);
  var first = tspans.length ? tspans[0] : null;
  var x = (first && first.getAttribute("x")) || textEl.getAttribute("x") || "0";
  var firstY = rowYs.length ? rowYs[0] : parseFloat(textEl.getAttribute("y") || "0");
  if (!isFinite(firstY)) firstY = 0;
  var bakedLineH = rowYs.length >= 2 ? rowYs[1] - rowYs[0] : NaN;
  // Sanity floor stays even with merged rows — a degenerate grid must never
  // compose tighter than the glyphs themselves.
  if (!isFinite(bakedLineH) || bakedLineH < style.size * 0.5) bakedLineH = style.size * 1.18;

  var dataW = parseFloat(textEl.getAttribute("data-w") || "");
  var minFont = parseFloat(textEl.getAttribute("data-minfont") || "");
  var dataMaxLines = parseInt(textEl.getAttribute("data-maxlines") || "", 10);
  var maxLines = Math.max(bakedCount, isFinite(dataMaxLines) ? dataMaxLines : 0);
  if (layout && layout.lines && layout.lines > 0) maxLines = layout.lines;
  if (layout && layout.wMul && isFinite(dataW)) dataW = dataW * layout.wMul;
  var measure = makeMeasure(style);
  var fit: FitResult;
  if (isFinite(dataW) && dataW > 0) {
    if (layout && layout.size && layout.size > 0) {
      // Pinned size: no step-down, wrap at exactly this size.
      fit = fitFill(text, layout.size, layout.size, maxLines, dataW, measure);
    } else {
      // No data-minfont → floor at the baked size (only templates that opt in
      // may shrink); fitFill clamps the floor at the baked size either way.
      fit = fitFill(text, style.size, minFont, maxLines, dataW, measure);
    }
  } else if (layout && layout.size && layout.size > 0) {
    fit = { lines: [text], size: layout.size, truncated: false };
  } else {
    // Single-line field with no wrap width (labels, footers without data-w):
    // write the text as-is; maxLen is enforced upstream by the planner/UI.
    fit = { lines: [text], size: style.size, truncated: false };
  }

  if (fit.size !== style.size) setStyleFontSize(textEl, fit.size);
  var lineH = bakedLineH * (fit.size / style.size);

  // X/Y nudge (§T): offset only when set and finite — otherwise the baked x
  // attr STRING passes through untouched (byte-identical, see contract above).
  var dx = layout && typeof layout.dx === "number" && isFinite(layout.dx) ? layout.dx : 0;
  var dy = layout && typeof layout.dy === "number" && isFinite(layout.dy) ? layout.dy : 0;
  var xOut = dx ? String(round2((parseFloat(x) || 0) + dx)) : x;

  while (textEl.firstChild) textEl.removeChild(textEl.firstChild);
  for (var i = 0; i < fit.lines.length; i++) {
    var ts = doc.createElementNS(SVG_NS, "tspan");
    ts.setAttribute("x", xOut);
    ts.setAttribute("y", String(round2(firstY + dy + lineH * i)));
    ts.textContent = fit.lines[i]; // XMLSerializer escapes & < >
    textEl.appendChild(ts);
  }
}

// ─── slot population (DOM) ───

// Deterministic clipPath id from slide.id + slot name — never Math.random,
// so DOM preview and PNG export serialize identically.
function slotClipId(slideId: string, slotName: string): string {
  return ("libclip-" + slideId + "-" + slotName).replace(/[^A-Za-z0-9_-]/g, "-");
}

// For every slot rect: dashed stroke off always (it is dev annotation); when
// an image is assigned, insert clipPath + <image preserveAspectRatio="slice">
// immediately BEFORE the rect in document order so anything painted after
// still layers above it (handoff rule).
function applySlots(doc: Document, root: Element, slide: Slide): void {
  var rects = root.getElementsByTagName("rect");
  // Live collection — snapshot first; we insert siblings while iterating.
  var slotRects: Element[] = [];
  for (var i = 0; i < rects.length; i++) {
    if (rects[i].getAttribute("data-slot")) slotRects.push(rects[i]);
  }
  for (var j = 0; j < slotRects.length; j++) {
    var rect = slotRects[j];
    rect.setAttribute("stroke", "none");
    var name = rect.getAttribute("data-slot") || "";
    var url = slide.librarySlotImages ? slide.librarySlotImages[name] : undefined;
    var parent = rect.parentNode;
    if (!url || !parent) continue;

    var clipId = slotClipId(String(slide.id || "s"), name);
    var clip = doc.createElementNS(SVG_NS, "clipPath");
    clip.setAttribute("id", clipId);
    var cr = doc.createElementNS(SVG_NS, "rect");
    cr.setAttribute("x", rect.getAttribute("x") || "0");
    cr.setAttribute("y", rect.getAttribute("y") || "0");
    cr.setAttribute("width", rect.getAttribute("width") || "0");
    cr.setAttribute("height", rect.getAttribute("height") || "0");
    cr.setAttribute("rx", rect.getAttribute("rx") || "0");
    clip.appendChild(cr);

    var img = doc.createElementNS(SVG_NS, "image");
    img.setAttribute("href", url);
    img.setAttribute("x", rect.getAttribute("x") || "0");
    img.setAttribute("y", rect.getAttribute("y") || "0");
    img.setAttribute("width", rect.getAttribute("width") || "0");
    img.setAttribute("height", rect.getAttribute("height") || "0");
    // FILL (slice, default) crops to the slot's fixed frame; FIT (meet)
    // letterboxes the whole image inside it — the EDIT slot panel toggles.
    var fitMode = slide.librarySlotFit ? slide.librarySlotFit[name] : undefined;
    img.setAttribute("preserveAspectRatio", fitMode === "contain" ? "xMidYMid meet" : "xMidYMid slice");
    img.setAttribute("data-slotimg", name); // on-canvas hit-testing (EDIT select)
    img.setAttribute("clip-path", "url(#" + clipId + ")");

    parent.insertBefore(clip, rect);
    parent.insertBefore(img, rect);
  }
}

// ─── composition ───

// Inner content of an SVG document string (outer <svg …> tag stripped).
function innerSvg(svgText: string): string {
  var open = svgText.indexOf("<svg");
  if (open < 0) return svgText;
  var gt = svgText.indexOf(">", open);
  var close = svgText.lastIndexOf("</svg>");
  if (gt < 0 || close <= gt) return svgText;
  return svgText.slice(gt + 1, close);
}

// Populate fills + slots into the template markup. Fields with no fill entry
// keep their baked placeholder text; scrim rects are never touched. On a
// parse failure (should never happen for shipped assets) fall back to the
// raw template inner so the slide still renders its baked state.
function populateTemplate(tplText: string, slide: Slide): string {
  var doc = new DOMParser().parseFromString(tplText, "image/svg+xml");
  var root = doc.documentElement;
  if (!root || root.nodeName === "parsererror" || doc.getElementsByTagName("parsererror").length) {
    console.error("[library/compose] template SVG parse failed for idx " + slide.libraryTemplate);
    return innerSvg(tplText);
  }
  var fills = slide.libraryFills || {};
  var layouts = slide.libraryLayout || {};
  var texts = root.getElementsByTagName("text");
  for (var i = 0; i < texts.length; i++) {
    var name = texts[i].getAttribute("data-field");
    if (!name) continue;
    // A layout override re-populates even when the fill is the baked
    // placeholder (fills[name] undefined → repopulate placeholder text at the
    // new size only when an override exists for the field).
    if (fills[name] === undefined && !layouts[name]) continue;
    var fillText = fills[name] !== undefined ? fills[name] : (texts[i].textContent || "");
    populateField(doc, texts[i], fillText, layouts[name]);
  }
  applySlots(doc, root, slide);
  return innerSvg(new XMLSerializer().serializeToString(root));
}

// Backgrounds use unique gradient ids (gNNNN_*) so bg/template collisions do
// not happen in practice — assert-and-log if one ever appears (contract).
var dupWarned: Record<string, boolean> = {};
function warnDuplicateIds(bgInner: string, tplMarkup: string, warnKey: string): void {
  if (dupWarned[warnKey]) return;
  var seen: Record<string, boolean> = {};
  var re = /\sid="([^"]+)"/g;
  var m: RegExpExecArray | null;
  while ((m = re.exec(bgInner))) seen[m[1]] = true;
  var re2 = /\sid="([^"]+)"/g;
  while ((m = re2.exec(tplMarkup))) {
    if (seen[m[1]]) {
      dupWarned[warnKey] = true;
      console.warn("[library/compose] duplicate id between bg and template (" + warnKey + "): " + m[1]);
      return;
    }
  }
  dupWarned[warnKey] = true;
}

// Recolored-background text cache, keyed palette|url (the svg-text cache is
// keyed by url alone — the palette must be part of any lookup that returns
// tinted text so switching category recomposes rather than reusing a stale
// tint). blend bypasses entirely: the baked text is returned by reference,
// byte-identical to v1 output.
var recoloredBgCache: Record<string, string> = {};
function recoloredBgText(url: string, text: string, palette: LibPalette): string {
  if (palette === "blend") return text;
  var key = palette + "|" + url;
  var hit = recoloredBgCache[key];
  if (hit !== undefined) return hit;
  var out = recolorBgSvg(text, palette);
  recoloredBgCache[key] = out;
  return out;
}

// Composed-output cache: one entry per slide id, invalidated whenever any
// compose input (template, fills, slot images, resolved bg, palette) changes.
var composedCache: Record<string, { key: string; svg: string }> = {};

// The complete composited slide: (bg inner)(populated template inner) inside
// one outer 1080x1350 <svg>. Null until ensureLibraryAssets has cached the
// needed SVG texts (renderers kick ensure and re-render on resolve); pure and
// deterministic otherwise — the identical string feeds preview and export.
export function composeLibrarySvg(slide: Slide): string | null {
  if (typeof document === "undefined") return null; // DOMParser + canvas: client-only
  if (!slide || slide.type !== "library" || slide.libraryTemplate == null) return null;
  var templates = templatesSync();
  if (!templates) return null;
  var t = templateByIdx(templates, slide.libraryTemplate);
  if (!t) {
    console.warn("[library/compose] unknown template idx " + slide.libraryTemplate);
    return null;
  }
  var bgKey = slide.libraryBg || FALLBACK_BG;
  // Category tint (v2 §P): recolor applies to the BACKGROUND text only,
  // before it is inlined — template overlays keep their brand colors.
  var palette: LibPalette = slide.libraryPalette ?? "blend";
  // Native infinity (v3.1): the bg is generated, not fetched — the store
  // stamped the render params (strip window) alongside the "n:<fam>" key.
  // A native key without params (never stamped that way — belt-and-braces
  // against hand-edited drafts) renders a lone slide-0 window rather than
  // falling into the fetch path, which would 404 forever.
  var native = isNativeKey(bgKey)
    ? slide.libraryBgNative || { fam: nativeGenKeyOf(bgKey), seed: 0, idx: 0, n: 1 }
    : undefined;
  var tplText = svgTextCache[tplSvgUrl(t)];
  var bgText = native ? "" : svgTextCache[bgSvgUrl(bgKey)];
  if (tplText === undefined || bgText === undefined) return null;

  var cacheKey =
    t.idx + "|" + bgKey + "|" + palette + "|" + (slide.libraryBgFlip ? "F" : "-") + "|" +
    (native ? "N" + native.fam + ":" + native.seed + ":" + native.idx + ":" + native.n + "|" : "") +
    JSON.stringify(slide.libraryFills || {}) + "|" +
    JSON.stringify(slide.librarySlotImages || {}) + "|" +
    JSON.stringify(slide.librarySlotFit || {}) + "|" +
    JSON.stringify(slide.libraryLayout || {});
  var slideId = String(slide.id || "s");
  var hit = composedCache[slideId];
  if (hit && hit.key === cacheKey) return hit.svg;

  var bgInner: string;
  if (native) {
    // The native hue IS the category palette (same four keys); never mirrored
    // — the strip is continuous by construction.
    bgInner = renderNativeBgInner(native.fam, native.seed, native.idx, native.n, palette as NativeHue);
  } else {
    bgInner = innerSvg(recoloredBgText(bgSvgUrl(bgKey), bgText, palette));
    // Infinity mode (§U): odd deck positions mirror the shared backdrop so
    // slide N's right edge equals slide N+1's left edge by construction — the
    // deck reads as one continuous strip. Template content is never mirrored.
    if (slide.libraryBgFlip) {
      bgInner = '<g transform="translate(1080 0) scale(-1 1)">' + bgInner + "</g>";
    }
  }
  var tplMarkup = populateTemplate(tplText, slide);
  warnDuplicateIds(bgInner, tplMarkup, bgKey + "/" + t.idx);
  var svg =
    '<svg viewBox="0 0 1080 1350" xmlns="http://www.w3.org/2000/svg">' +
    bgInner + tplMarkup +
    "</svg>";
  composedCache[slideId] = { key: cacheKey, svg: svg };
  return svg;
}

// ─── test hook ───
// Probe-only (verify/probe-library.js): the pure wrap/measure pipeline with
// an injectable measurer so wrapping is exercisable deterministically.
export var __composeInternals = {
  parseFieldStyle: parseFieldStyle,
  makeMeasure: makeMeasure,
  wrapFill: wrapFill,
  fitFill: fitFill,
  ellipsize: ellipsize,
  innerSvg: innerSvg,
};
