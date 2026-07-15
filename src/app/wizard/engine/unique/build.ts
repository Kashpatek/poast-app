// ═══════════════════════════════════════════════════════════════════════════
// Unique mode · buildUniqueDeck — deterministic mapper from generated content
// to editor Slides. Same content, three compositions: the direction remaps
// backdrop family, accent, and slide-kind ordering (spec 9.1/9.5).
// Ids use Date.now (build-time only); render seeds derive from the id string
// hash, so once built a deck renders pixel-identically everywhere.
// ═══════════════════════════════════════════════════════════════════════════

import type { Slide } from "../types";

export interface UniqueStat { label: string; value: string; delta?: string; dir?: "up" | "down" | "flat" }
export interface UniqueChart { label: string; unit?: string; points: number[]; xLabels: string[] }
export interface UniqueSection {
  kicker?: string;
  headline: string;
  accentWord?: string;
  body?: string;
  stats?: UniqueStat[];
  chart?: UniqueChart;
  quote?: string;
}
export interface UniqueContent {
  title: string;
  accentWord?: string;
  kicker?: string;
  summary?: string;
  sections: UniqueSection[];
  closer?: { headline?: string; body?: string; cta?: string };
}

export const UNIQUE_DIRECTIONS: { key: "E" | "C" | "S"; name: string; accent: string; backdrops: string[] }[] = [
  { key: "E", name: "ECLIPSE", accent: "#F7B041", backdrops: ["eclipse", "particles", "dunes"] },
  { key: "C", name: "CIRCUIT", accent: "#0B86D1", backdrops: ["blueprint", "traces", "grid"] },
  { key: "S", name: "SIGNAL", accent: "#2EAD8E", backdrops: ["terminal", "topo", "stream"] },
];

// Numeric size fields existing code paths expect on every Slide (no NaNs).
var SIZES = { bodySize: 34, titleSize: 74, subtitleSize: 34, captionSize: 22 };

function sectionKind(s: UniqueSection): "stat" | "chart" | "quote" {
  if (s.chart && s.chart.points && s.chart.points.length >= 2) return "chart";
  if (s.stats && s.stats.length) return "stat";
  if (s.quote) return "quote";
  return "stat"; // empty stats renders as a statement (spec 9.7)
}

export function buildUniqueDeck(content: UniqueContent, direction: "E" | "C" | "S", pageCount?: number): Slide[] {
  var dir = UNIQUE_DIRECTIONS.filter(function (d) { return d.key === direction; })[0] || UNIQUE_DIRECTIONS[0];
  var stamp = Date.now();
  var sections = (content.sections || []).filter(function (s) { return !!(s && (s.headline || s.quote)); });

  // Direction remaps kind ordering: rotate the body sections so the three
  // decks open with different rhythms (E: 0, C: +1, S: +2).
  var offset = direction === "C" ? 1 : direction === "S" ? 2 : 0;
  if (sections.length > 1 && offset > 0) {
    var off = offset % sections.length;
    sections = sections.slice(off).concat(sections.slice(0, off));
  }

  // Respect pageCount: cover + bodies + closer. Trim extra sections, pad
  // shortfall with quote slides cut from the summary (never fabricate data).
  var hasCloser = pageCount === undefined ? true : pageCount >= 2;
  var bodyTarget = pageCount === undefined
    ? Math.max(1, sections.length)
    : Math.max(0, pageCount - (hasCloser ? 2 : 1));
  if (sections.length > bodyTarget) sections = sections.slice(0, bodyTarget);
  while (sections.length < bodyTarget) {
    sections.push({
      headline: content.title,
      accentWord: content.accentWord,
      kicker: content.kicker,
      quote: content.summary || content.title,
    });
  }

  var slides: Slide[] = [];
  var totalIdx = 0;
  function nextId(): string { return "u-" + direction + "-" + totalIdx + "-" + stamp; }

  // Cover
  slides.push({
    ...SIZES,
    id: nextId(),
    type: "unique",
    position: 1,
    title: content.title || "",
    bodyText: content.summary || "",
    uniqueKind: "cover",
    uniqueDirection: direction,
    uniqueBackdrop: dir.backdrops[0],
    uniqueKicker: content.kicker || "",
    uniqueAccentWord: content.accentWord,
  } as Slide);
  totalIdx++;

  // Body sections
  for (var i = 0; i < sections.length; i++) {
    var s = sections[i];
    var kind = sectionKind(s);
    var slide: Slide = {
      ...SIZES,
      id: nextId(),
      type: "unique",
      position: i % 2 === 0 ? 2 : 3,
      title: kind === "quote" ? (s.quote || s.headline || "") : (s.headline || ""),
      bodyText: kind === "quote" ? "" : (s.body || ""),
      uniqueKind: kind,
      uniqueDirection: direction,
      uniqueBackdrop: dir.backdrops[totalIdx % 3],
      uniqueKicker: kind === "quote" ? (s.kicker || s.headline || "") : (s.kicker || ""),
      uniqueAccentWord: s.accentWord,
    } as Slide;
    if (kind === "stat" && s.stats && s.stats.length) {
      slide.uniqueStats = s.stats.slice(0, 3).map(function (st) {
        return { label: st.label || "", value: st.value || "", delta: st.delta, dir: st.dir };
      });
    }
    if (kind === "chart" && s.chart) {
      slide.uniqueChart = {
        label: s.chart.label || "",
        unit: s.chart.unit,
        points: (s.chart.points || []).slice(),
        xLabels: (s.chart.xLabels || []).slice(),
      };
    }
    slides.push(slide);
    totalIdx++;
  }

  // Closer
  if (hasCloser) {
    var closer = content.closer || {};
    slides.push({
      ...SIZES,
      id: nextId(),
      type: "unique",
      position: 4,
      title: closer.headline || content.title || "",
      bodyText: closer.body || "",
      ctaText: closer.cta || "Read the full analysis",
      uniqueKind: "closer",
      uniqueDirection: direction,
      uniqueBackdrop: dir.backdrops[totalIdx % 3],
      uniqueKicker: content.kicker || "",
      uniqueAccentWord: content.accentWord,
    } as Slide);
  }

  return slides;
}
