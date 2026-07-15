// Unique mode · composed content blocks: stat cards and the chart panel.
// Delta colors are ALWAYS mint(up)/coral(down) regardless of direction accent.
import { esc, monoText, MONO, TX, MUTED, MINT, CORAL, TABULAR } from "./render-text";

var CARD_BG = "rgba(12,14,22,.78)";
var LINE_2 = "rgba(232,228,221,.14)";
var LINE = "rgba(232,228,221,.08)";

export interface StatIn { label: string; value: string; delta?: string; dir?: "up" | "down" | "flat" }
export interface ChartIn { label: string; unit?: string; points: number[]; xLabels: string[] }

// 1-3 stat cards in a row. Returns the fragment + consumed height.
export function statCards(stats: StatIn[], x: number, yTop: number, width: number): { svg: string; height: number } {
  var list = (stats || []).slice(0, 3);
  if (!list.length) return { svg: "", height: 0 };
  var gap = 20;
  var h = 220;
  var cw = Math.floor((width - gap * (list.length - 1)) / list.length);
  var svg = "";
  for (var i = 0; i < list.length; i++) {
    var st = list[i];
    var cx = x + i * (cw + gap);
    var pad = 30;
    var innerW = cw - pad * 2;
    svg += '<rect x="' + cx + '" y="' + yTop + '" width="' + cw + '" height="' + h + '" rx="14" fill="' + CARD_BG + '" stroke="' + LINE_2 + '" stroke-width="1"/>';
    svg += monoText(st.label || "", cx + pad, yTop + 54, 20, MUTED);
    var val = String(st.value || "");
    var vfs = Math.min(64, Math.floor(innerW / (0.6 * Math.max(1, val.length))));
    if (vfs < 26) vfs = 26;
    svg += '<text x="' + (cx + pad) + '" y="' + (yTop + 142) + '" font-family="' + MONO + '" font-size="' + vfs + '" font-weight="700" fill="' + TX + '" ' + TABULAR + ">" + esc(val) + "</text>";
    if (st.delta) {
      var dir = st.dir || "flat";
      var dc = dir === "up" ? MINT : dir === "down" ? CORAL : MUTED;
      var mark = dir === "up" ? "↑ " : dir === "down" ? "↓ " : "· ";
      svg += '<text x="' + (cx + pad) + '" y="' + (yTop + 186) + '" font-family="' + MONO + '" font-size="22" font-weight="500" fill="' + dc + '" ' + TABULAR + ">" + esc(mark + st.delta) + "</text>";
    }
  }
  return { svg: svg, height: h };
}

// Framed chart panel: accent polyline 3px, r7 circle terminals, 4 hairline
// y-gridlines, mono 16px axis labels, unit label top right.
export function chartPanel(chart: ChartIn, x: number, yTop: number, width: number, height: number, accent: string): { svg: string; height: number } {
  var pts = (chart.points || []).filter(function (n) { return typeof n === "number" && isFinite(n); });
  var svg = '<rect x="' + x + '" y="' + yTop + '" width="' + width + '" height="' + height + '" rx="14" fill="rgba(12,14,22,.55)" stroke="' + LINE_2 + '" stroke-width="1"/>';
  var pad = 40;
  svg += monoText(chart.label || "", x + pad, yTop + 48, 18, MUTED);
  if (chart.unit) svg += monoText(chart.unit, x + width - pad, yTop + 48, 16, accent, { anchor: "end", caps: false });
  var plotX = x + pad;
  var plotY = yTop + 78;
  var plotW = width - pad * 2;
  var plotH = height - 78 - 66;
  // 4 hairline y-gridlines
  var min = Infinity, max = -Infinity, i;
  for (i = 0; i < pts.length; i++) { if (pts[i] < min) min = pts[i]; if (pts[i] > max) max = pts[i]; }
  if (!pts.length) { min = 0; max = 1; }
  if (min === max) { min -= 1; max += 1; }
  var span = max - min;
  for (i = 0; i < 4; i++) {
    var gy = plotY + (plotH * i) / 3;
    var gv = max - (span * i) / 3;
    svg += '<line x1="' + plotX + '" y1="' + gy.toFixed(1) + '" x2="' + (plotX + plotW) + '" y2="' + gy.toFixed(1) + '" stroke="' + LINE + '" stroke-width="1"/>';
    svg += '<text x="' + (plotX + plotW) + '" y="' + (gy - 8).toFixed(1) + '" text-anchor="end" font-family="' + MONO + '" font-size="16" fill="' + MUTED + '" ' + TABULAR + ">" + esc(formatTick(gv)) + "</text>";
  }
  // polyline
  if (pts.length >= 2) {
    var coords: string[] = [];
    var px = 0, py = 0;
    for (i = 0; i < pts.length; i++) {
      px = plotX + (plotW * i) / (pts.length - 1);
      py = plotY + plotH - ((pts[i] - min) / span) * plotH;
      coords.push(px.toFixed(1) + "," + py.toFixed(1));
    }
    svg += '<polyline points="' + coords.join(" ") + '" fill="none" stroke="' + accent + '" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>';
    var first = coords[0].split(",");
    var last = coords[coords.length - 1].split(",");
    svg += '<circle cx="' + first[0] + '" cy="' + first[1] + '" r="7" fill="#06070C" stroke="' + accent + '" stroke-width="3"/>';
    svg += '<circle cx="' + last[0] + '" cy="' + last[1] + '" r="7" fill="' + accent + '"/>';
  }
  // x labels: first, middle, last (or all if few)
  var xl = chart.xLabels || [];
  if (xl.length) {
    var idxs = xl.length <= 4 ? xl.map(function (_, k) { return k; }) : [0, Math.floor((xl.length - 1) / 2), xl.length - 1];
    for (var j = 0; j < idxs.length; j++) {
      var k = idxs[j];
      var lx = plotX + plotW * (xl.length > 1 ? k / (xl.length - 1) : 0.5);
      var anchor = k === 0 ? "start" : k === xl.length - 1 ? "end" : "middle";
      svg += '<text x="' + lx.toFixed(1) + '" y="' + (plotY + plotH + 42) + '" text-anchor="' + anchor + '" font-family="' + MONO + '" font-size="16" fill="' + MUTED + '" ' + TABULAR + ">" + esc(String(xl[k]).toUpperCase()) + "</text>";
    }
  }
  return { svg: svg, height: height };
}

function formatTick(v: number): string {
  var av = Math.abs(v);
  if (av >= 1000000) return (v / 1000000).toFixed(1).replace(/\.0$/, "") + "M";
  if (av >= 1000) return (v / 1000).toFixed(1).replace(/\.0$/, "") + "K";
  if (av >= 100) return String(Math.round(v));
  if (av >= 10) return v.toFixed(1).replace(/\.0$/, "");
  return v.toFixed(2).replace(/\.?0+$/, "") || "0";
}
