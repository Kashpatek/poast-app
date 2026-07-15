// ═══════════════════════════════════════════════════════════════════════════
// Unique mode · renderUniqueSvg — the complete 1080x1350 slide SVG.
// Same string feeds the DOM canvas (dangerouslySetInnerHTML), the thumbnail
// and the blob→img PNG export, so it must be pure and deterministic: the
// backdrop PRNG is seeded from slide.id, never Math.random / Date.now.
// ═══════════════════════════════════════════════════════════════════════════

import type { Slide } from "../types";
import { renderBackdrop, hashSeed } from "./backdrops";
import { libraryBgInner } from "../library/compose";
import type { LibPalette } from "../library/palette";
import type { UniqueStrength } from "./backdrops";
import {
  headline, bodyBlock, monoText, esc,
  GRIFT, MONO, TX, MUTED, COBALT, AMBER, MINT, TABULAR,
} from "./render-text";
import { statCards, chartPanel } from "./render-blocks";

var W = 1080;
var H = 1350;
var M = 76;                 // margins (spec 9.2)
var CW = W - M * 2;         // 928 content width
var LINE_2 = "rgba(232,228,221,.14)";

var ACCENTS: Record<string, string> = { E: AMBER, C: COBALT, S: MINT };
// v3.7: library-backdrop recolor palette per direction (same hues as ACCENTS;
// "green" is the library palette token for mint).
var DIRECTION_PALETTE: Record<string, string> = { E: "amber", C: "cobalt", S: "green" };
var STRENGTHS: Record<string, UniqueStrength> = {
  cover: "motif", stat: "ambient", chart: "grain", quote: "focal", closer: "motif",
};

function pad2(n: number): string { return n < 10 ? "0" + n : String(n); }

// Wordmark: semi(cobalt)analysis(amber) — colors never change per direction.
function wordmark(): string {
  return '<text x="' + M + '" y="136" font-family="' + GRIFT + '" font-size="44" font-weight="800" letter-spacing="-0.01em">' +
    '<tspan fill="' + COBALT + '">semi</tspan><tspan fill="' + AMBER + '">analysis</tspan></text>';
}

// Bordered kicker chip (cover) or plain mono kicker (other kinds).
function kickerRow(kicker: string, accent: string, chip: boolean, y: number): string {
  if (!kicker) return "";
  var text = kicker.toUpperCase();
  if (!chip) {
    return '<text x="' + M + '" y="' + y + '" font-family="' + MONO + '" font-size="22" font-weight="500" letter-spacing="0.16em" ' + TABULAR + '>' +
      '<tspan fill="' + accent + '">// </tspan><tspan fill="' + MUTED + '">' + esc(text) + "</tspan></text>";
  }
  var chipW = Math.round(text.length * 20 * 0.62 + 22 * 0.62 * 3 + 56);
  if (chipW > CW) chipW = CW;
  return (
    '<rect x="' + M + '" y="' + (y - 34) + '" width="' + chipW + '" height="52" rx="26" fill="rgba(12,14,22,.55)" stroke="' + LINE_2 + '" stroke-width="1"/>' +
    '<text x="' + (M + 28) + '" y="' + y + '" font-family="' + MONO + '" font-size="20" font-weight="500" letter-spacing="0.16em" ' + TABULAR + '>' +
    '<tspan fill="' + accent + '">// </tspan><tspan fill="' + MUTED + '">' + esc(text) + "</tspan></text>"
  );
}

// Footer: hairline rule, domain in accent, page NN / MM mono muted.
function footer(accent: string, page: number, total: number, arrow: boolean): string {
  var out = '<line x1="' + M + '" y1="1258" x2="' + (W - M) + '" y2="1258" stroke="' + LINE_2 + '" stroke-width="1"/>';
  out += '<text x="' + M + '" y="1306" font-family="' + MONO + '" font-size="22" font-weight="500" letter-spacing="0.08em" fill="' + accent + '">semianalysis.com</text>';
  if (arrow) {
    out += '<text x="' + (W - M - 150) + '" y="1307" text-anchor="end" font-family="' + MONO + '" font-size="30" font-weight="700" fill="' + accent + '">→</text>';
  }
  out += monoText(pad2(page) + " / " + pad2(total), W - M, 1306, 22, MUTED, { anchor: "end", ls: "0.1em" });
  return out;
}

export function renderUniqueSvg(slide: Slide, page: number, total: number): string {
  var kind = slide.uniqueKind || "stat";
  var accent = ACCENTS[slide.uniqueDirection || "E"] || AMBER;
  var strength = STRENGTHS[kind] || "ambient";
  var seed = hashSeed(String(slide.id || "u"));
  // v3.7: a stamped library backdrop (deck bgSource "library") replaces the
  // procedural field wholesale — recolored to the DIRECTION's palette so the
  // art-direction identity survives (E amber / C cobalt / S mint). Falls
  // back to the procedural field until the bg SVG text cache is warm (the
  // canvas/preview effects kick ensureClassicBgs and repaint; the exporter
  // awaits it before rasterizing, so preview and PNG stay identical).
  var backdrop: string;
  var libInner = slide.libraryBg
    ? libraryBgInner(
        slide.libraryBg,
        (DIRECTION_PALETTE[slide.uniqueDirection || "E"] || "amber") as LibPalette,
        !!slide.libraryBgFlip
      )
    : null;
  if (libInner !== null) {
    backdrop = libInner;
  } else {
    backdrop = renderBackdrop(slide.uniqueBackdrop || "eclipse", seed, strength, accent);
  }

  var title = slide.title || "";
  var body = slide.bodyText || "";
  var kicker = slide.uniqueKicker || "";
  var aw = slide.uniqueAccentWord;
  var inner = "";

  if (kind === "cover") {
    inner += kickerRow(kicker, accent, true, 262);
    var hCover = headline(title, aw, accent, M, 420, [88, 76, 64], 3, CW);
    inner += hCover.svg;
    if (body) inner += bodyBlock(body, M, 420 + hCover.height + 44, 30, CW, 2).svg;
  } else if (kind === "stat") {
    inner += kickerRow(kicker, accent, false, 250);
    var hStat = headline(title, aw, accent, M, 300, [60, 52, 46], 3, CW);
    inner += hStat.svg;
    var yAfter = 300 + hStat.height + 36;
    if (body) inner += bodyBlock(body, M, yAfter, 28, CW, 2).svg;
    var cards = statCards(slide.uniqueStats || [], M, 986, CW);
    if (cards.svg) {
      inner += cards.svg;
    } else if (!body && slide.subtitle) {
      inner += bodyBlock(slide.subtitle, M, yAfter, 28, CW, 3).svg;
    }
  } else if (kind === "chart") {
    inner += kickerRow(kicker, accent, false, 250);
    var hChart = headline(title, aw, accent, M, 300, [56, 48, 42], 2, CW);
    inner += hChart.svg;
    var yBody = 300 + hChart.height + 32;
    if (body) inner += bodyBlock(body, M, yBody, 26, CW, 2).svg;
    var ch = slide.uniqueChart;
    if (ch && ch.points && ch.points.length) {
      inner += chartPanel(ch, M, 636, CW, 566, accent).svg;
    }
  } else if (kind === "quote") {
    var hQuote = headline(title, aw, accent, M, 0, [64, 56, 48], 4, CW);
    var qTop = Math.max(300, Math.round((H - hQuote.height) / 2) - 60);
    var hQuote2 = headline(title, aw, accent, M, qTop, [64, 56, 48], 4, CW);
    inner += '<text x="' + M + '" y="' + (qTop - 36) + '" font-family="' + GRIFT + '" font-size="120" font-weight="800" fill="' + accent + '" opacity="0.5">&#8220;</text>';
    inner += hQuote2.svg;
    if (kicker) {
      inner += '<text x="' + M + '" y="' + (qTop + hQuote2.height + 64) + '" font-family="' + MONO + '" font-size="20" font-weight="500" letter-spacing="0.16em" ' + TABULAR + '>' +
        '<tspan fill="' + accent + '">— </tspan><tspan fill="' + MUTED + '">' + esc(kicker.toUpperCase()) + "</tspan></text>";
    }
  } else { // closer
    inner += kickerRow(kicker, accent, false, 250);
    var hClose = headline(title, aw, accent, M, 380, [72, 62, 54], 3, CW);
    inner += hClose.svg;
    var yCta = 380 + hClose.height + 48;
    if (body) {
      var bb = bodyBlock(body, M, yCta, 30, CW, 2, TX);
      inner += bb.svg;
      yCta += bb.height + 72;
    } else {
      yCta += 40;
    }
    var cta = (slide.ctaText || "Read the full analysis").toUpperCase();
    inner += '<text x="' + M + '" y="' + yCta + '" font-family="' + MONO + '" font-size="26" font-weight="700" letter-spacing="0.14em" fill="' + accent + '">' + esc(cta) + " →</text>";
    inner += '<line x1="' + M + '" y1="' + (yCta + 26) + '" x2="' + (M + 72) + '" y2="' + (yCta + 26) + '" stroke="' + accent + '" stroke-width="3"/>';
  }

  return (
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + " " + H + '" width="' + W + '" height="' + H + '">' +
    '<rect x="0" y="0" width="' + W + '" height="' + H + '" fill="#06070C"/>' +
    backdrop +
    wordmark() +
    inner +
    footer(accent, page, total, kind === "cover") +
    "</svg>"
  );
}
