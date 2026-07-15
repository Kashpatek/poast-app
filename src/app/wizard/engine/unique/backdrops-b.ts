// Unique backdrops · CIRCUIT family (cobalt): blueprint geometry, PCB traces
// with via dots, fine grid + concentric arcs. Pure, deterministic.
import type { BkCtx } from "./backdrops";

function f(n: number): number { return Math.round(n * 100) / 100; }

// blueprint — hairline rects, lines and measure ticks in the accent
export function bkBlueprint(c: BkCtx): string {
  var out = "";
  var i;
  // hairline construction rects
  var rects = 4 + Math.floor(c.rng() * 3);
  for (i = 0; i < rects; i++) {
    var rw = f(c.rnd(160, 460));
    var rh = f(c.rnd(120, 360));
    var rx = f(c.rnd(-40, c.W - rw * 0.5));
    var ry = f(c.rnd(-40, c.H - rh * 0.5));
    out += '<rect x="' + rx + '" y="' + ry + '" width="' + rw + '" height="' + rh + '" fill="none" stroke="' + c.accent + '" stroke-width="1" opacity="' + c.op(c.rnd(1.4, 2.6)) + '"/>';
    if (c.rng() < 0.5) {
      out += '<line x1="' + rx + '" y1="' + ry + '" x2="' + f(rx + rw) + '" y2="' + f(ry + rh) + '" stroke="' + c.accent + '" stroke-width="1" opacity="' + c.op(1) + '"/>';
    }
  }
  // long construction lines across the frame
  var lines = 3 + Math.floor(c.rng() * 3);
  for (i = 0; i < lines; i++) {
    var horiz = c.rng() < 0.5;
    var p = f(horiz ? c.rnd(120, c.H - 120) : c.rnd(120, c.W - 120));
    out += horiz
      ? '<line x1="0" y1="' + p + '" x2="' + c.W + '" y2="' + p + '" stroke="#E8E4DD" stroke-width="1" opacity="' + c.op(0.8) + '"/>'
      : '<line x1="' + p + '" y1="0" x2="' + p + '" y2="' + c.H + '" stroke="#E8E4DD" stroke-width="1" opacity="' + c.op(0.8) + '"/>';
  }
  // measure ticks along one edge run
  var ty = f(c.rnd(200, c.H - 200));
  var x0 = f(c.rnd(60, 220));
  var x1 = f(c.W - c.rnd(60, 220));
  out += '<line x1="' + x0 + '" y1="' + ty + '" x2="' + x1 + '" y2="' + ty + '" stroke="' + c.accent + '" stroke-width="1" opacity="' + c.op(2.4) + '"/>';
  var ticks = 8 + Math.floor(c.rng() * 6);
  for (i = 0; i <= ticks; i++) {
    var tx = f(x0 + ((x1 - x0) * i) / ticks);
    var th = i % 4 === 0 ? 16 : 8;
    out += '<line x1="' + tx + '" y1="' + f(ty - th) + '" x2="' + tx + '" y2="' + f(ty + th) + '" stroke="' + c.accent + '" stroke-width="1" opacity="' + c.op(2.4) + '"/>';
  }
  return out;
}

// traces — rounded-corner PCB runs with via dots at the terminals
export function bkTraces(c: BkCtx): string {
  var out = "";
  var runs = 7 + Math.floor(c.rng() * 4);
  for (var i = 0; i < runs; i++) {
    var x = f(c.rnd(-20, c.W * 0.5));
    var y = f(c.rnd(80, c.H - 80));
    var d = "M " + x + " " + y;
    var segs = 3 + Math.floor(c.rng() * 3);
    var horiz = true;
    for (var s = 0; s < segs; s++) {
      var len = f(c.rnd(90, 300));
      var dir = c.rng() < 0.5 ? -1 : 1;
      if (horiz) { x = f(Math.min(c.W + 20, x + len)); d += " H " + x; }
      else { y = f(Math.max(60, Math.min(c.H - 60, y + dir * len))); d += " V " + y; }
      horiz = !horiz;
    }
    var main = c.rng() < 0.55;
    out += '<path d="' + d + '" fill="none" stroke="' + (main ? c.accent : "#E8E4DD") + '" stroke-width="' + (main ? 2 : 1.2) + '" stroke-linejoin="round" stroke-linecap="round" opacity="' + c.op(main ? 2.6 : 1) + '"/>';
    // via dot at the end of the run
    out += '<circle cx="' + x + '" cy="' + y + '" r="7" fill="none" stroke="' + c.accent + '" stroke-width="2" opacity="' + c.op(3) + '"/>';
    out += '<circle cx="' + x + '" cy="' + y + '" r="2.5" fill="' + c.accent + '" opacity="' + c.op(3.4) + '"/>';
  }
  return out;
}

// grid — fine 28px grid, concentric arcs, scattered vias
export function bkGrid(c: BkCtx): string {
  var u = c.uid;
  var out =
    '<defs><pattern id="gr-p-' + u + '" width="28" height="28" patternUnits="userSpaceOnUse">' +
    '<path d="M 28 0 L 0 0 0 28" fill="none" stroke="#E8E4DD" stroke-width="1" stroke-opacity="' + c.op(0.9) + '"/>' +
    '</pattern></defs>' +
    '<rect x="0" y="0" width="' + c.W + '" height="' + c.H + '" fill="url(#gr-p-' + u + ')"/>';
  var cx = f(c.rnd(c.W * 0.55, c.W * 0.95));
  var cy = f(c.rnd(c.H * 0.15, c.H * 0.6));
  var arcs = 4 + Math.floor(c.rng() * 3);
  for (var i = 0; i < arcs; i++) {
    var r = f(120 + i * c.rnd(70, 110));
    out += '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none" stroke="' + (i % 2 === 0 ? c.accent : "#E8E4DD") + '" stroke-width="1" opacity="' + c.op(i % 2 === 0 ? 2.2 : 0.9) + '"' + (i % 3 === 2 ? ' stroke-dasharray="2 10"' : "") + '/>';
  }
  var vias = 8 + Math.floor(c.rng() * 6);
  for (var v = 0; v < vias; v++) {
    var vx = f(Math.round(c.rnd(2, 36)) * 28);
    var vy = f(Math.round(c.rnd(2, 46)) * 28);
    out += '<circle cx="' + vx + '" cy="' + vy + '" r="3" fill="' + c.accent + '" opacity="' + c.op(c.rnd(1.6, 3)) + '"/>';
  }
  return out;
}
