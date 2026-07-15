// ═══════════════════════════════════════════════════════════════════════════
// Library platform v3 · chart — Claude-generated chart specs rendered to
// brand-styled SVG, entirely client-side (docs/LIBRARY-INTEGRATION.md §V).
//
// The LLM never draws: POST /api/library {action:"chart"} returns a small
// validated SPEC (type/title/unit/series/points, exact figures from the
// article only) and renderChartSvg turns it into FOUNDRY-voiced SVG markup.
// The result ships as a data: URL into slide.librarySlotImages[slot], so it
// rides the existing compose → preview → PNG-export path with zero special
// cases (applySlots just sets <image href>).
// ═══════════════════════════════════════════════════════════════════════════

import { carouselProvider } from "../api";
import type { LibPalette } from "./palette";

export interface ChartSeries { label: string; points: { x: string; y: number }[] }
export interface ChartSpec {
  type: "line" | "bar" | "area";
  title: string;
  unit: string;
  series: ChartSeries[];
  source: string;
}

// ─── spec generation (server call) ───
export async function generateChartSpec(opts: {
  text?: string;
  url?: string;
  slideContext?: string;
}): Promise<ChartSpec> {
  var r = await fetch("/api/library", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "chart",
      text: opts.text,
      url: opts.url,
      slideContext: (opts.slideContext || "").slice(0, 2000),
      provider: carouselProvider(),
    }),
  });
  var d = await r.json();
  if (!r.ok || (d && d.error)) throw new Error((d && d.error) || "Chart generation failed");
  if (!d || !d.chart) throw new Error("No chart returned.");
  return d.chart as ChartSpec;
}

// ─── render (pure) ───
// Palette-aware series ladder: first series wears the category voice, the
// second the counter-voice, the third neutral grey — same two-tone logic as
// the backdrop recolor maps.
var SERIES_COLORS: Record<LibPalette, string[]> = {
  blend: ["#0092FF", "#F7B041", "#8992A5"],
  amber: ["#FF8A1E", "#F7B041", "#8992A5"],
  cobalt: ["#0092FF", "#3BABFF", "#8992A5"],
  green: ["#2EAD8E", "#F7B041", "#8992A5"],
};

var FONT = "'Outfit','Inter',sans-serif";

function esc(s: string): string {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function fmtVal(v: number): string {
  var a = Math.abs(v);
  if (a >= 1000) return String(Math.round(v)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  if (a >= 100) return String(Math.round(v));
  if (a >= 1) return String(Math.round(v * 10) / 10);
  return String(Math.round(v * 100) / 100);
}

/** Render a chart spec to standalone SVG markup (default 900×560 — slot
 *  rects crop/letterbox via preserveAspectRatio, so exact fit is not
 *  required). Transparent canvas: the template card behind it shows through. */
export function renderChartSvg(spec: ChartSpec, palette: LibPalette, w: number = 900, h: number = 560): string {
  var colors = SERIES_COLORS[palette] || SERIES_COLORS.blend;
  var padL = 26, padR = 26, padT = spec.title ? 78 : 34, padB = spec.source ? 92 : 64;
  var plotW = w - padL - padR;
  var plotH = h - padT - padB;

  var allY: number[] = [];
  spec.series.forEach(function (s) { s.points.forEach(function (p) { allY.push(p.y); }); });
  var maxY = Math.max.apply(null, allY);
  var minY = Math.min.apply(null, [0].concat(allY)); // baseline at 0 unless negatives
  var span = maxY - minY || 1;
  maxY += span * 0.08; // headroom so peaks don't kiss the top
  span = maxY - minY;

  var xCount = Math.max.apply(null, spec.series.map(function (s) { return s.points.length; }));
  var xAt = function (i: number): number {
    if (spec.type === "bar") return padL + (plotW / xCount) * (i + 0.5);
    return padL + (xCount <= 1 ? plotW / 2 : (plotW / (xCount - 1)) * i);
  };
  var yAt = function (v: number): number { return padT + plotH - ((v - minY) / span) * plotH; };

  var parts: string[] = [];
  parts.push('<svg viewBox="0 0 ' + w + " " + h + '" xmlns="http://www.w3.org/2000/svg">');

  // Title row + unit chip
  if (spec.title) {
    parts.push('<text x="' + padL + '" y="40" style="font-family:' + FONT + ";font-size:27px;font-weight:800;letter-spacing:1.2px;text-transform:uppercase;fill:#E8ECF3\">" + esc(spec.title.toUpperCase()) + "</text>");
  }
  if (spec.unit) {
    parts.push('<text x="' + (w - padR) + '" y="40" text-anchor="end" style="font-family:' + FONT + ';font-size:22px;font-weight:700;letter-spacing:1.5px;fill:#8992A5">' + esc(spec.unit.toUpperCase()) + "</text>");
  }

  // Gridlines (4 hairlines) + max/min value labels
  for (var g = 0; g <= 3; g++) {
    var gy = padT + (plotH / 3) * g;
    parts.push('<line x1="' + padL + '" y1="' + gy + '" x2="' + (w - padR) + '" y2="' + gy + '" stroke="rgba(255,255,255,0.09)" stroke-width="1"/>');
    var gv = maxY - (span / 3) * g;
    parts.push('<text x="' + (w - padR) + '" y="' + (gy - 6) + '" text-anchor="end" style="font-family:' + FONT + ';font-size:17px;font-weight:500;fill:rgba(137,146,165,0.85)">' + fmtVal(gv) + "</text>");
  }

  // Series
  spec.series.forEach(function (s, si) {
    var color = colors[si % colors.length];
    if (spec.type === "bar") {
      var groupW = plotW / xCount;
      var barW = Math.min(64, (groupW * 0.62) / spec.series.length);
      s.points.forEach(function (p, i) {
        var cx = xAt(i) - (barW * spec.series.length) / 2 + si * barW;
        var y0 = yAt(Math.max(0, minY));
        var y1 = yAt(p.y);
        var top = Math.min(y0, y1);
        var bh = Math.max(2, Math.abs(y0 - y1));
        parts.push('<rect x="' + cx.toFixed(1) + '" y="' + top.toFixed(1) + '" width="' + barW.toFixed(1) + '" height="' + bh.toFixed(1) + '" rx="3" fill="' + color + '" opacity="0.92"/>');
      });
    } else {
      var pts = s.points.map(function (p, i) { return xAt(i).toFixed(1) + "," + yAt(p.y).toFixed(1); });
      if (spec.type === "area" && s.points.length) {
        var base = yAt(Math.max(0, minY)).toFixed(1);
        parts.push('<polygon points="' + xAt(0).toFixed(1) + "," + base + " " + pts.join(" ") + " " + xAt(s.points.length - 1).toFixed(1) + "," + base + '" fill="' + color + '" opacity="0.16"/>');
      }
      parts.push('<polyline points="' + pts.join(" ") + '" fill="none" stroke="' + color + '" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>');
      // End-point emphasis + value
      var last = s.points[s.points.length - 1];
      if (last) {
        parts.push('<circle cx="' + xAt(s.points.length - 1).toFixed(1) + '" cy="' + yAt(last.y).toFixed(1) + '" r="7" fill="' + color + '"/>');
        parts.push('<text x="' + (xAt(s.points.length - 1) - 10).toFixed(1) + '" y="' + (yAt(last.y) - 14).toFixed(1) + '" text-anchor="end" style="font-family:' + FONT + ';font-size:21px;font-weight:800;fill:' + color + '">' + fmtVal(last.y) + "</text>");
      }
    }
  });

  // X labels (first/last always; thin the middle to keep it readable)
  var labels = (spec.series[0] ? spec.series[0].points : []).map(function (p) { return p.x; });
  var step = Math.max(1, Math.ceil(labels.length / 6));
  labels.forEach(function (lx, i) {
    if (i % step !== 0 && i !== labels.length - 1) return;
    var anchor = i === 0 ? "start" : i === labels.length - 1 ? "end" : "middle";
    var tx = i === 0 ? padL : i === labels.length - 1 ? w - padR : xAt(i);
    parts.push('<text x="' + tx + '" y="' + (padT + plotH + 30) + '" text-anchor="' + anchor + '" style="font-family:' + FONT + ';font-size:18px;font-weight:600;letter-spacing:0.5px;fill:#8992A5">' + esc(lx) + "</text>");
  });

  // Legend (2+ series) + source line
  var footY = h - 22;
  if (spec.series.length > 1) {
    var lx0 = padL;
    spec.series.forEach(function (s, si) {
      var color = colors[si % colors.length];
      parts.push('<rect x="' + lx0 + '" y="' + (footY - 12) + '" width="16" height="6" rx="3" fill="' + color + '"/>');
      parts.push('<text x="' + (lx0 + 24) + '" y="' + footY + '" style="font-family:' + FONT + ';font-size:17px;font-weight:600;fill:#B9C2D4">' + esc(s.label || "Series " + (si + 1)) + "</text>");
      lx0 += 24 + 10 * Math.max(6, (s.label || "").length) + 30;
    });
  }
  if (spec.source) {
    parts.push('<text x="' + (w - padR) + '" y="' + footY + '" text-anchor="end" style="font-family:' + FONT + ';font-size:16px;font-weight:600;letter-spacing:1px;fill:rgba(137,146,165,0.7)">' + esc(spec.source.toUpperCase()) + "</text>");
  }
  parts.push("</svg>");
  return parts.join("");
}

/** SVG markup → data: URL, the form applySlots/<image href> consumes (data:
 *  URLs rasterize inside SVG-as-image, same mechanism as exported slot
 *  photos — export-renderer passes them through untouched). */
export function chartSvgToDataUrl(svg: string): string {
  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
}
