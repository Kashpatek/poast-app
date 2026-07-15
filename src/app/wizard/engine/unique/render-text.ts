// Unique mode · text primitives: XML escaping, estimated-width word wrap,
// accent-word display headlines. Estimation constants: Grift ~0.52em/char,
// Outfit ~0.5em/char, JetBrains Mono ~0.6em/char.

export var TX = "#E9E6DF";
export var MUTED = "#9A96A0";
export var MINT = "#2EAD8E";
export var CORAL = "#E06347";
export var COBALT = "#0B86D1";
export var AMBER = "#F7B041";
export var GRIFT = "'Grift', 'Arial Black', sans-serif";
export var OUTFIT = "'Outfit', sans-serif";
export var MONO = "'JetBrains Mono', monospace";
export var TABULAR = 'style="font-variant-numeric:tabular-nums"';

export function esc(s: string): string {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function charW(font: "grift" | "outfit" | "mono"): number {
  return font === "grift" ? 0.52 : font === "mono" ? 0.6 : 0.5;
}

// Greedy word wrap on estimated widths. Never lets a line exceed maxWidth
// (single overlong words are kept whole; the step-down loop handles them).
export function wrapWords(words: string[], fontSize: number, font: "grift" | "outfit" | "mono", maxWidth: number): string[][] {
  var cw = charW(font) * fontSize;
  var lines: string[][] = [];
  var line: string[] = [];
  var len = 0;
  for (var i = 0; i < words.length; i++) {
    var w = words[i];
    var wLen = w.length * cw;
    var add = line.length ? (1 * cw) + wLen : wLen;
    if (line.length && len + add > maxWidth) {
      lines.push(line);
      line = [w];
      len = wLen;
    } else {
      line.push(w);
      len += add;
    }
  }
  if (line.length) lines.push(line);
  return lines;
}

export function wrapText(text: string, fontSize: number, font: "grift" | "outfit" | "mono", maxWidth: number, maxLines: number): string[] {
  var words = String(text || "").trim().split(/\s+/).filter(Boolean);
  var lines = wrapWords(words, fontSize, font, maxWidth).map(function (l) { return l.join(" "); });
  if (lines.length > maxLines) {
    lines = lines.slice(0, maxLines);
    var last = lines[maxLines - 1];
    lines[maxLines - 1] = last.replace(/\s*\S*$/, "") + " …";
  }
  return lines;
}

export interface HeadlineResult { svg: string; height: number; lines: number; fontSize: number }

// Display headline: Grift 800, one accent-colored word (first case-insensitive
// whole-word match), capped at maxLines with font step-down fallback.
export function headline(
  text: string,
  accentWord: string | undefined,
  accentColor: string,
  x: number,
  yTop: number,
  sizes: number[],
  maxLines: number,
  maxWidth: number
): HeadlineResult {
  var words = String(text || "").trim().split(/\s+/).filter(Boolean);
  var accentIdx = -1;
  if (accentWord) {
    var target = accentWord.trim().toLowerCase();
    for (var i = 0; i < words.length; i++) {
      if (words[i].replace(/^[^\w$%]+|[^\w$%]+$/g, "").toLowerCase() === target) { accentIdx = i; break; }
    }
  }
  var fs = sizes[sizes.length - 1];
  var lines: string[][] = [];
  for (var s = 0; s < sizes.length; s++) {
    lines = wrapWords(words, sizes[s], "grift", maxWidth);
    if (lines.length <= maxLines) { fs = sizes[s]; break; }
    if (s === sizes.length - 1) { fs = sizes[s]; lines = lines.slice(0, maxLines); }
  }
  var gap = Math.round(fs * 1.04);
  var svg = "";
  var wordAt = 0;
  for (var li = 0; li < lines.length; li++) {
    var y = yTop + fs + li * gap;
    var spans = "";
    for (var wi = 0; wi < lines[li].length; wi++) {
      var fill = wordAt === accentIdx ? accentColor : TX;
      spans += '<tspan fill="' + fill + '">' + esc(lines[li][wi]) + (wi < lines[li].length - 1 ? " " : "") + "</tspan>";
      wordAt++;
    }
    svg += '<text x="' + x + '" y="' + y + '" font-family="' + GRIFT + '" font-size="' + fs + '" font-weight="800" letter-spacing="-0.02em">' + spans + "</text>";
  }
  return { svg: svg, height: lines.length ? fs + (lines.length - 1) * gap : 0, lines: lines.length, fontSize: fs };
}

// Outfit body block, muted by default.
export function bodyBlock(text: string, x: number, yTop: number, fontSize: number, maxWidth: number, maxLines: number, fill?: string): { svg: string; height: number } {
  var lines = wrapText(text, fontSize, "outfit", maxWidth, maxLines);
  var gap = Math.round(fontSize * 1.5);
  var svg = "";
  for (var i = 0; i < lines.length; i++) {
    svg += '<text x="' + x + '" y="' + (yTop + fontSize + i * gap) + '" font-family="' + OUTFIT + '" font-size="' + fontSize + '" font-weight="450" fill="' + (fill || MUTED) + '">' + esc(lines[i]) + "</text>";
  }
  return { svg: svg, height: lines.length ? fontSize + (lines.length - 1) * gap : 0 };
}

// Mono caps label.
export function monoText(text: string, x: number, y: number, fontSize: number, fill: string, opts?: { anchor?: string; ls?: string; caps?: boolean }): string {
  var o = opts || {};
  var t = o.caps === false ? text : String(text || "").toUpperCase();
  return '<text x="' + x + '" y="' + y + '"' + (o.anchor ? ' text-anchor="' + o.anchor + '"' : "") +
    ' font-family="' + MONO + '" font-size="' + fontSize + '" font-weight="500" letter-spacing="' + (o.ls || "0.14em") + '" fill="' + fill + '" ' + TABULAR + ">" + esc(t) + "</text>";
}
