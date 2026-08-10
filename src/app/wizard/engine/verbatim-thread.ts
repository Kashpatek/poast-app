// ═══════════════════════════════════════════════════════════════════════════
// Verbatim thread → deck engine (v3.9)
//
// Verbatim mode is authored as a THREAD: an ordered list of entries, each a
// block of text (+ optional image). Each entry maps to a page (page 1 is the
// cover, entry N is page N+1). Text ships VERBATIM — never reworded.
//
// The hard part is overflow: a long entry may not fit one page. Rule:
//   1. FIT — size the font within a legible range to fit the whole entry on one
//      page (short entries scale up, long ones scale down).
//   2. FLOW — only if it will not fit even at the minimum readable size, split
//      across the fewest pages, BALANCED (no near-empty orphan page), always
//      cutting on a COMPLETE sentence. Remainder carries to the next page.
//
// splitSentences is the sentence-safe cutter: it never splits inside decimals
// (4.2%), currency, abbreviations (U.S., Inc.), or initialisms, and its output
// concatenates back to the exact input (no character is ever dropped) — the two
// failure modes the old regex-based splitVerbatim had.
// ═══════════════════════════════════════════════════════════════════════════

export type ThreadImageMode = "share" | "standalone";

export interface ThreadEntry {
  id: string;
  text: string;
  image?: string; // data: URL or proxied URL
  imageMode?: ThreadImageMode; // how the image lays out (default "share")
}

// Abbreviations whose trailing period is NOT a sentence end.
var ABBREV: Record<string, boolean> = {
  mr: true, mrs: true, ms: true, dr: true, prof: true, sr: true, jr: true,
  st: true, mt: true, vs: true, etc: true, inc: true, ltd: true, co: true,
  corp: true, llc: true, no: true, fig: true, al: true, approx: true,
  dept: true, gov: true, gen: true, sen: true, rep: true, est: true,
  jan: true, feb: true, mar: true, apr: true, jun: true, jul: true, aug: true,
  sep: true, sept: true, oct: true, nov: true, dec: true,
};

function isUpper(c: string): boolean { return c >= "A" && c <= "Z"; }
function isDigit(c: string): boolean { return c >= "0" && c <= "9"; }
function isSpace(c: string): boolean { return c === " " || c === "\n" || c === "\t" || c === "\r" || c === "\f" || c === "\v"; }

/**
 * Split text into sentences, safely. Guarantees: the returned pieces concatenate
 * back to the EXACT input (each piece keeps its trailing whitespace), and no
 * split lands inside a decimal, abbreviation, or initialism.
 */
export function splitSentences(text: string): string[] {
  var s = String(text || "");
  var n = s.length;
  if (!n) return [];
  var out: string[] = [];
  var start = 0;
  for (var i = 0; i < n; i++) {
    var ch = s[i];
    if (ch !== "." && ch !== "!" && ch !== "?") continue;
    // Extend over a run of terminators (?!, ..., etc.)
    var j = i;
    while (j + 1 < n && (s[j + 1] === "." || s[j + 1] === "!" || s[j + 1] === "?")) j++;
    // Optional closing quote / bracket after the terminator run.
    var k = j + 1;
    while (k < n && (s[k] === '"' || s[k] === "'" || s[k] === ")" || s[k] === "]" || s[k] === "”" || s[k] === "’")) k++;
    // Must be followed by whitespace or end-of-text to even be a candidate.
    if (k < n && !isSpace(s[k])) { i = j; continue; }
    // Gather the trailing whitespace so pieces reconstruct the input exactly.
    var w = k;
    while (w < n && isSpace(s[w])) w++;
    // The token immediately before the terminator run.
    var p = i - 1;
    while (p >= 0 && (/[A-Za-z0-9.]/).test(s[p])) p--;
    var word = s.slice(p + 1, i);
    var afterChar = w < n ? s[w] : "";
    var boundary = true;
    if (afterChar === "") {
      boundary = true; // end of text
    } else if (!(isUpper(afterChar) || isDigit(afterChar) || afterChar === '"' || afterChar === "'" || afterChar === "(" || afterChar === "“")) {
      boundary = false; // next char is lowercase/other → mid-abbreviation or continuation
    } else {
      var wl = word.toLowerCase().replace(/\.+$/, "");
      if (ABBREV[wl]) boundary = false;
      else if ((/^([a-z]\.)*[a-z]$/i).test(word)) boundary = false; // U.S, e.g, a.m
      else if (ch === "." && i > 0 && isDigit(s[i - 1]) && isDigit(afterChar)) boundary = false; // 4. 2 across space
    }
    if (boundary) {
      out.push(s.slice(start, w));
      start = w;
      i = w - 1;
    } else {
      i = j;
    }
  }
  if (start < n) out.push(s.slice(start));
  return out;
}

// Height (px) of `text` wrapped at the body box width, rendered at fontPx.
export type MeasureFit = (text: string, fontPx: number) => number;

export interface FlowPage { text: string; fontPx: number; part: number; parts: number; }

export interface FitOpts {
  minFont: number;
  maxFont: number;
  boxHeight: number; // px available for body text on one page
  measure: MeasureFit;
  step?: number; // font search granularity (px), default 1
}

function largestFontThatFits(text: string, maxF: number, minF: number, step: number, boxH: number, measure: MeasureFit): number | null {
  for (var f = maxF; f >= minF; f -= step) {
    if (measure(text, f) <= boxH) return f;
  }
  return null;
}

// Greedy-pack atoms (sentences) into pages, each capped at `cap` px tall at
// `font`. Returns Infinity count if any single atom exceeds the cap (infeasible).
function greedyPages(atoms: string[], cap: number, font: number, measure: MeasureFit): { count: number; pages: string[] } {
  var pages: string[] = [];
  var cur = "";
  for (var a = 0; a < atoms.length; a++) {
    var atom = atoms[a];
    if (measure(atom.trim(), font) > cap) return { count: Infinity, pages: [] };
    var trial = cur + atom;
    if (cur === "" || measure(trial.trim(), font) <= cap) {
      cur = trial;
    } else {
      pages.push(cur);
      cur = atom;
    }
  }
  if (cur !== "") pages.push(cur);
  return { count: pages.length, pages: pages };
}

// Word-split a single oversize sentence into runs each ≤ boxH at font (last
// resort so we never exceed a page and never drop text).
function wordSplitOversize(sentence: string, boxH: number, font: number, measure: MeasureFit): string[] {
  var words = sentence.split(/(\s+)/); // keep separators for exact reconstruction
  var runs: string[] = [];
  var cur = "";
  for (var i = 0; i < words.length; i++) {
    var trial = cur + words[i];
    if (cur === "" || measure(trial.trim(), font) <= boxH) {
      cur = trial;
    } else {
      runs.push(cur);
      cur = words[i];
    }
  }
  if (cur !== "") runs.push(cur);
  return runs.length ? runs : [sentence];
}

/**
 * Fit the whole entry on one page if a legible font allows; otherwise flow it
 * across the fewest, most-balanced pages, cutting only on sentence boundaries.
 */
export function fitOrFlow(text: string, o: FitOpts): FlowPage[] {
  var clean = String(text || "").trim();
  var step = o.step || 1;
  if (!clean) return [{ text: "", fontPx: o.maxFont, part: 1, parts: 1 }];

  // 1) FIT — largest legible font that puts the whole entry on one page.
  var fitFont = largestFontThatFits(clean, o.maxFont, o.minFont, step, o.boxHeight, o.measure);
  if (fitFont !== null) return [{ text: clean, fontPx: fitFont, part: 1, parts: 1 }];

  // 2) FLOW — at the minimum font, split into balanced pages on sentences.
  var sentences = splitSentences(text);
  // Pre-split any single sentence too tall for a page (rare) into word runs, so
  // every atom fits and no text is dropped.
  var atoms: string[] = [];
  for (var i = 0; i < sentences.length; i++) {
    if (o.measure(sentences[i].trim(), o.minFont) > o.boxHeight) {
      var runs = wordSplitOversize(sentences[i], o.boxHeight, o.minFont, o.measure);
      for (var r = 0; r < runs.length; r++) atoms.push(runs[r]);
    } else {
      atoms.push(sentences[i]);
    }
  }

  var minFeasible = greedyPages(atoms, o.boxHeight, o.minFont, o.measure).count;
  if (!isFinite(minFeasible) || minFeasible < 1) minFeasible = 1;

  // Balance: find the SMALLEST height cap that still fits in minFeasible pages.
  // A smaller cap fills each page more evenly, so the last page is never a
  // near-empty orphan. Binary search on the cap (page count is monotone in cap).
  var lo = 1, hi = o.boxHeight, bestPages: string[] | null = null;
  for (var iter = 0; iter < 24; iter++) {
    var mid = (lo + hi) / 2;
    var res = greedyPages(atoms, mid, o.minFont, o.measure);
    if (res.count <= minFeasible) { bestPages = res.pages; hi = mid; }
    else { lo = mid; }
  }
  var finalPages = bestPages || greedyPages(atoms, o.boxHeight, o.minFont, o.measure).pages;

  var parts = finalPages.length;
  return finalPages.map(function (t, idx) {
    return { text: t.trim(), fontPx: o.minFont, part: idx + 1, parts: parts };
  });
}

// ── Canvas-backed measurer (browser only) ──────────────────────────────────
// Word-wraps at boxWidthPx using the real body font and returns rendered height.
// Mirrors SlideCanvas / edit-overflow metrics (lineHeight, font). SSR-safe: the
// caller only builds this in the browser at deck-build time (fonts warm).
export function makeCanvasMeasure(boxWidthPx: number, fontFamily: string, lineHeight: number): MeasureFit {
  var canvas = typeof document !== "undefined" ? document.createElement("canvas") : null;
  var ctx = canvas ? canvas.getContext("2d") : null;
  return function (text: string, fontPx: number): number {
    if (!ctx) {
      // Fallback heuristic if no canvas (should not happen in the wizard).
      var cpl = Math.max(1, Math.floor(boxWidthPx / (fontPx * 0.5)));
      var lines0 = 0;
      var paras0 = String(text).split(/\n/);
      for (var q = 0; q < paras0.length; q++) lines0 += Math.max(1, Math.ceil(paras0[q].length / cpl));
      return lines0 * fontPx * lineHeight;
    }
    ctx.font = fontPx + "px " + fontFamily;
    var totalLines = 0;
    var paras = String(text).split(/\n/);
    for (var pi = 0; pi < paras.length; pi++) {
      var words = paras[pi].split(/\s+/).filter(Boolean);
      if (!words.length) { totalLines += 1; continue; }
      var line = "";
      var lines = 1;
      for (var wi = 0; wi < words.length; wi++) {
        var probe = line ? line + " " + words[wi] : words[wi];
        if (ctx.measureText(probe).width <= boxWidthPx || !line) {
          line = probe;
        } else {
          lines++;
          line = words[wi];
        }
      }
      totalLines += lines;
    }
    return totalLines * fontPx * lineHeight;
  };
}
