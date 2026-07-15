// Unique backdrops · SIGNAL family (mint): terminal query feed, topo contour
// loops, flowing stream bundles. Pure, deterministic.
import type { BkCtx } from "./backdrops";

function f(n: number): number { return Math.round(n * 100) / 100; }

var QUERIES = [
  "> query accelerator_shipments --window q2",
  "> join fab_capacity ON node = 'N2'",
  "> select capex, delta from hyperscalers",
  "> trace supply_chain --depth 3",
  "> agg tokens_served group by provider",
  "> fetch hbm_pricing --spot",
  "> diff roadmap_2026 roadmap_2027",
  "> watch power_draw --site all",
  "> rank interconnect by bandwidth desc",
  "> sample yield_curve --lots 400",
  "> emit report --format carousel",
  "> ok · 8,411 rows · 0.31s",
];

// terminal — mono query feed lines + scanline rows
export function bkTerminal(c: BkCtx): string {
  var out = "";
  var y;
  // scanline rows across the full frame
  for (y = 0; y < c.H; y += 6) {
    if ((y / 6) % 2 === 0) continue;
    out += '<rect x="0" y="' + y + '" width="' + c.W + '" height="1" fill="#E8E4DD" opacity="' + c.op(0.28) + '"/>';
  }
  // feed lines, deterministic pick + drift
  var rows = 14 + Math.floor(c.rng() * 6);
  var startY = f(c.rnd(90, 160));
  var gap = f(c.rnd(58, 74));
  for (var i = 0; i < rows; i++) {
    y = f(startY + i * gap);
    if (y > c.H - 60) break;
    var q = QUERIES[Math.floor(c.rng() * QUERIES.length)];
    var bright = c.rng() < 0.22;
    var x = f(c.rnd(50, 90));
    out += '<text x="' + x + '" y="' + y + '" font-family="\'JetBrains Mono\', monospace" font-size="24" fill="' + (bright ? c.accent : "#E8E4DD") + '" opacity="' + c.op(bright ? 3.2 : 1.2) + '">' + q.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;") + "</text>";
    if (bright) {
      out += '<rect x="' + f(x - 26) + '" y="' + f(y - 18) + '" width="10" height="22" fill="' + c.accent + '" opacity="' + c.op(2.6) + '"/>';
    }
  }
  return out;
}

// topo — nested contour loops (jittered concentric rings around 2 poles)
export function bkTopo(c: BkCtx): string {
  var out = "";
  var poles = 2;
  for (var p = 0; p < poles; p++) {
    var cx = f(p === 0 ? c.rnd(c.W * 0.15, c.W * 0.45) : c.rnd(c.W * 0.6, c.W * 0.95));
    var cy = f(p === 0 ? c.rnd(c.H * 0.12, c.H * 0.42) : c.rnd(c.H * 0.55, c.H * 0.9));
    var rings = 6 + Math.floor(c.rng() * 4);
    var wob = c.rnd(0.06, 0.16);
    var phase = c.rnd(0, Math.PI * 2);
    for (var r = 1; r <= rings; r++) {
      var rad = r * c.rnd(46, 62);
      var pts = "";
      var n = 26;
      for (var i = 0; i <= n; i++) {
        var a = (i / n) * Math.PI * 2;
        var rr = rad * (1 + wob * Math.sin(a * 3 + phase + r * 0.7));
        var px = f(cx + Math.cos(a) * rr);
        var py = f(cy + Math.sin(a) * rr * 1.12);
        pts += (i === 0 ? "M " : " L ") + px + " " + py;
      }
      var main = r % 3 === 0;
      out += '<path d="' + pts + ' Z" fill="none" stroke="' + (main ? c.accent : "#E8E4DD") + '" stroke-width="' + (main ? 1.6 : 1) + '" opacity="' + c.op(main ? 2.4 : 0.9) + '"/>';
    }
    out += '<circle cx="' + cx + '" cy="' + cy + '" r="3.5" fill="' + c.accent + '" opacity="' + c.op(3.2) + '"/>';
  }
  return out;
}

// stream — flowing bezier line bundles sweeping the frame
export function bkStream(c: BkCtx): string {
  var u = c.uid;
  var out =
    '<defs><filter id="st-blur-' + u + '" x="-40%" y="-40%" width="180%" height="180%">' +
    '<feGaussianBlur stdDeviation="6"/></filter></defs>';
  var bundles = 2 + Math.floor(c.rng() * 2);
  for (var b = 0; b < bundles; b++) {
    var y0 = f(c.rnd(120, c.H - 160));
    var y1 = f(c.rnd(120, c.H - 160));
    var mx1 = f(c.rnd(c.W * 0.2, c.W * 0.45));
    var my1 = f(c.rnd(60, c.H - 60));
    var mx2 = f(c.rnd(c.W * 0.55, c.W * 0.85));
    var my2 = f(c.rnd(60, c.H - 60));
    var lines = 6 + Math.floor(c.rng() * 5);
    for (var i = 0; i < lines; i++) {
      var off = (i - lines / 2) * c.rnd(10, 20);
      var d = "M -30 " + f(y0 + off) +
        " C " + mx1 + " " + f(my1 + off * 1.6) + ", " + mx2 + " " + f(my2 + off * 1.6) + ", " + f(c.W + 30) + " " + f(y1 + off);
      var lead = i === Math.floor(lines / 2);
      if (lead) {
        out += '<path d="' + d + '" fill="none" stroke="' + c.accent + '" stroke-width="4" opacity="' + c.op(2) + '" filter="url(#st-blur-' + u + ')"/>';
      }
      out += '<path d="' + d + '" fill="none" stroke="' + (lead ? c.accent : "#E8E4DD") + '" stroke-width="' + (lead ? 1.8 : 1) + '" opacity="' + c.op(lead ? 3 : c.rnd(0.7, 1.4)) + '"/>';
    }
  }
  return out;
}
