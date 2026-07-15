// Unique backdrops · ECLIPSE family (amber): eclipse disc, particle waves,
// contour dunes. Pure, deterministic, defs ids suffixed with ctx.uid.
import type { BkCtx } from "./backdrops";

function f(n: number): number { return Math.round(n * 100) / 100; }

// eclipse — occluded disc with accent rim glow over a faint grid
export function bkEclipse(c: BkCtx): string {
  var cx = f(c.rnd(640, 800));
  var cy = f(c.rnd(340, 480));
  var r = f(c.rnd(300, 380));
  var u = c.uid;
  var grid = "";
  for (var gx = 0; gx <= c.W; gx += 90) {
    grid += '<line x1="' + gx + '" y1="0" x2="' + gx + '" y2="' + c.H + '" stroke="#E8E4DD" stroke-width="1" opacity="' + c.op(0.35) + '"/>';
  }
  for (var gy = 0; gy <= c.H; gy += 90) {
    grid += '<line x1="0" y1="' + gy + '" x2="' + c.W + '" y2="' + gy + '" stroke="#E8E4DD" stroke-width="1" opacity="' + c.op(0.35) + '"/>';
  }
  return (
    '<defs>' +
    '<radialGradient id="ec-glow-' + u + '" cx="50%" cy="50%" r="50%">' +
    '<stop offset="62%" stop-color="' + c.accent + '" stop-opacity="0"/>' +
    '<stop offset="86%" stop-color="' + c.accent + '" stop-opacity="' + c.op(2.6) + '"/>' +
    '<stop offset="100%" stop-color="' + c.accent + '" stop-opacity="0"/>' +
    '</radialGradient>' +
    '<filter id="ec-blur-' + u + '" x="-40%" y="-40%" width="180%" height="180%">' +
    '<feGaussianBlur stdDeviation="14"/></filter>' +
    '</defs>' +
    grid +
    '<circle cx="' + cx + '" cy="' + cy + '" r="' + f(r * 1.34) + '" fill="url(#ec-glow-' + u + ')"/>' +
    '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none" stroke="' + c.accent + '" stroke-width="5" opacity="' + c.op(3.2) + '" filter="url(#ec-blur-' + u + ')"/>' +
    '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="#06070C" stroke="' + c.accent + '" stroke-width="1.5" opacity="0.92" stroke-opacity="' + c.op(4.2) + '"/>' +
    '<circle cx="' + cx + '" cy="' + cy + '" r="' + f(r * 0.72) + '" fill="none" stroke="#E8E4DD" stroke-width="1" opacity="' + c.op(0.6) + '"/>'
  );
}

// particles — drifting dot field along 2-3 sine waves, a few glow dots
export function bkParticles(c: BkCtx): string {
  var u = c.uid;
  var waves = 2 + Math.floor(c.rng() * 2); // 2..3
  var out =
    '<defs><filter id="pt-blur-' + u + '" x="-120%" y="-120%" width="340%" height="340%">' +
    '<feGaussianBlur stdDeviation="5"/></filter></defs>';
  for (var w = 0; w < waves; w++) {
    var baseY = f(c.rnd(240, c.H - 260));
    var amp = f(c.rnd(60, 150));
    var freq = c.rnd(1.4, 2.6);
    var phase = c.rnd(0, Math.PI * 2);
    var n = 26 + Math.floor(c.rng() * 12);
    for (var i = 0; i <= n; i++) {
      var x = f((i / n) * c.W);
      var y = f(baseY + Math.sin((i / n) * Math.PI * 2 * freq + phase) * amp + c.rnd(-14, 14));
      var rr = f(c.rnd(1.6, 4.2));
      var glow = c.rng() < 0.09;
      if (glow) {
        out += '<circle cx="' + x + '" cy="' + y + '" r="' + f(rr * 2.6) + '" fill="' + c.accent + '" opacity="' + c.op(3.4) + '" filter="url(#pt-blur-' + u + ')"/>';
        out += '<circle cx="' + x + '" cy="' + y + '" r="' + f(rr) + '" fill="' + c.accent + '" opacity="' + c.op(5.5) + '"/>';
      } else {
        var tone = c.rng() < 0.6 ? c.accent : "#E8E4DD";
        out += '<circle cx="' + x + '" cy="' + y + '" r="' + rr + '" fill="' + tone + '" opacity="' + c.op(c.rnd(1.2, 2.6)) + '"/>';
      }
    }
  }
  return out;
}

// dunes — layered accent contour curves rising from the lower half
export function bkDunes(c: BkCtx): string {
  var u = c.uid;
  var layers = 6 + Math.floor(c.rng() * 3); // 6..8
  var out =
    '<defs><linearGradient id="dn-fade-' + u + '" x1="0" y1="0" x2="0" y2="1">' +
    '<stop offset="0%" stop-color="' + c.accent + '" stop-opacity="' + c.op(0.9) + '"/>' +
    '<stop offset="100%" stop-color="' + c.accent + '" stop-opacity="0"/>' +
    '</linearGradient></defs>';
  for (var l = 0; l < layers; l++) {
    var t = l / (layers - 1);
    var yBase = f(c.H * (0.42 + t * 0.5) + c.rnd(-24, 24));
    var y1 = f(yBase + c.rnd(-90, -30));
    var y2 = f(yBase + c.rnd(30, 90));
    var xm = f(c.rnd(c.W * 0.3, c.W * 0.7));
    var d =
      "M -40 " + yBase +
      " C " + f(xm * 0.5) + " " + y1 + ", " + xm + " " + y2 + ", " + f(c.W * 0.72) + " " + f(yBase + c.rnd(-40, 40)) +
      " S " + f(c.W + 40) + " " + y1 + ", " + f(c.W + 40) + " " + yBase;
    var strong = l % 2 === 0;
    out += '<path d="' + d + '" fill="none" stroke="' + (strong ? c.accent : "#E8E4DD") + '" stroke-width="' + (strong ? 2 : 1) + '" opacity="' + c.op(strong ? 3 - t * 1.4 : 1.1) + '"/>';
    if (l === 0) {
      out += '<path d="' + d + ' L ' + f(c.W + 40) + ' ' + (c.H + 40) + ' L -40 ' + (c.H + 40) + ' Z" fill="url(#dn-fade-' + u + ')" opacity="' + c.op(0.8) + '"/>';
    }
  }
  return out;
}
