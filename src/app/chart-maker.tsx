"use client";
import React, { useState, useRef } from "react";
import * as XLSX from "xlsx";
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area, PieChart, Pie, Cell,
  ScatterChart, Scatter,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LabelList,
} from "recharts";
import { D as C, ft, mn } from "./shared-constants";
import { useUser } from "./user-context";

// ═══ TYPES ═══
type ChartKind = "bar" | "stacked" | "hbar" | "line" | "area" | "areaStacked" | "scatter" | "pie";
type StyleMode = "clean" | "branded";
type PaletteKey = "saCore" | "saSpectrum" | "saCapital";
type Orientation = "cols" | "rows";
type BackdropKey = "amber" | "cobalt" | "both" | "capital";
type ThemeMode = "dark" | "light";
type InputMode = "paste" | "manual" | "excel";

// ═══ GRID ⇄ CSV ═══
function csvToGrid(csv: string): string[][] {
  const lines = csv.replace(/\r/g, "").split(/\n/).filter((l) => l !== "" || true);
  return lines.map((l) => l.includes("\t") ? l.split("\t").map((c) => c.trim()) : l.split(",").map((c) => c.trim()));
}
function gridToCsv(grid: string[][]): string {
  return grid.map((row) => row.map((c) => String(c ?? "")).join(",")).join("\n");
}

interface BackdropSpec { name: string; base: string; glows: { x: number; y: number; r: number; color: string }[]; accent: string; }
const LIGHT_BACKDROPS: Record<BackdropKey, BackdropSpec> = {
  amber: {
    name: "Amber",
    base: "#FAFAF7",
    accent: "#F7B041",
    glows: [
      { x: 0.90, y: 0.10, r: 0.6, color: "rgba(247,176,65,0.18)" },
      { x: 0.10, y: 0.90, r: 0.5, color: "rgba(247,176,65,0.08)" },
    ],
  },
  cobalt: {
    name: "Cobalt",
    base: "#F7FAFC",
    accent: "#0B86D1",
    glows: [
      { x: 0.90, y: 0.10, r: 0.6, color: "rgba(11,134,209,0.16)" },
      { x: 0.10, y: 0.90, r: 0.5, color: "rgba(11,134,209,0.08)" },
    ],
  },
  both: {
    name: "Amber + Cobalt",
    base: "#FAFAF7",
    accent: "#F7B041",
    glows: [
      { x: 0.90, y: 0.10, r: 0.6, color: "rgba(247,176,65,0.16)" },
      { x: 0.10, y: 0.90, r: 0.5, color: "rgba(11,134,209,0.10)" },
    ],
  },
  capital: {
    name: "Capital (Teal)",
    base: "#F5FAF8",
    accent: "#2EAD8E",
    glows: [
      { x: 0.90, y: 0.10, r: 0.6, color: "rgba(46,173,142,0.18)" },
      { x: 0.10, y: 0.90, r: 0.5, color: "rgba(122,207,186,0.08)" },
    ],
  },
};
const BACKDROPS: Record<BackdropKey, BackdropSpec> = {
  amber: {
    name: "Amber",
    base: "#06060C",
    accent: "#F7B041",
    glows: [
      { x: 0.85, y: 0.15, r: 0.7,  color: "rgba(247,176,65,0.22)" },
      { x: 0.15, y: 0.85, r: 0.55, color: "rgba(247,176,65,0.10)" },
    ],
  },
  cobalt: {
    name: "Cobalt",
    base: "#06060C",
    accent: "#0B86D1",
    glows: [
      { x: 0.85, y: 0.15, r: 0.7,  color: "rgba(11,134,209,0.22)" },
      { x: 0.15, y: 0.85, r: 0.55, color: "rgba(11,134,209,0.10)" },
    ],
  },
  both: {
    name: "Amber + Cobalt",
    base: "#06060C",
    accent: "#F7B041",
    glows: [
      { x: 0.85, y: 0.15, r: 0.7,  color: "rgba(247,176,65,0.18)" },
      { x: 0.10, y: 0.90, r: 0.60, color: "rgba(11,134,209,0.14)" },
    ],
  },
  capital: {
    name: "Capital (Teal)",
    base: "#06120F",
    accent: "#2EAD8E",
    glows: [
      { x: 0.85, y: 0.15, r: 0.7,  color: "rgba(46,173,142,0.22)" },
      { x: 0.15, y: 0.90, r: 0.55, color: "rgba(122,207,186,0.12)" },
    ],
  },
};

interface ChartRow { [key: string]: string | number; }

// ═══ SA PALETTES (from brand cheatsheet + skill files) ═══
// SA Spectrum — 12 unique hues (skill: sa-core-charts)
const SA_SPECTRUM = [
  "#F7B041", // S1 Amber
  "#0B86D1", // S2 Blue
  "#2EAD8E", // S3 Teal
  "#E06347", // S4 Coral
  "#905CCB", // S5 Violet
  "#26C9D8", // S6 Cyan
  "#D1334A", // S7 Crimson
  "#56BC42", // S8 Sage
  "#D34574", // S9 Rose
  "#E8C83A", // S10 Sunflower
  "#495BCE", // S11 Indigo
  "#BF49B5", // S12 Magenta
];

// SA Core — 4 brand + warm/cool tints (brand cheatsheet)
const SA_CORE = [
  "#F7B041", // S1 Amber
  "#0B86D1", // S2 Blue
  "#2EAD8E", // S3 Teal
  "#E06347", // S4 Coral
  "#C58B25", // S5 A600 (darker amber)
  "#086AA6", // S6 B600 (darker blue)
  "#F9C877", // S7 A300 (lighter amber)
  "#5DA9DE", // S8 B300 (lighter blue)
  "#9B6E1E", // S9 A700
  "#064D7A", // S10 B700
  "#FAD79A", // S11 A200
  "#97CBEC", // S12 B200
];

// SA Capital — teal-centric (skill: sa-capital-charts)
const SA_CAPITAL = [
  "#2EAD8E", // S1 Teal base
  "#7ACFBA", // S2 Teal light (Mint)
  "#F7B041", // S3 Amber accent
  "#0B86D1", // S4 Blue accent
  "#E06347", // S5+ Coral — alert/loss ONLY
];

const PALETTES: Record<PaletteKey, { name: string; blurb: string; colors: string[] }> = {
  saCore:     { name: "SA Core",     blurb: "4 brand + tints. Use S1–S4 first.", colors: SA_CORE },
  saSpectrum: { name: "SA Spectrum", blurb: "12 unique hues. Never skip ahead.", colors: SA_SPECTRUM },
  saCapital:  { name: "SA Capital",  blurb: "Teal-centric. Coral = alert only.", colors: SA_CAPITAL },
};

const GREY = "#3D3D3D"; // SA Metal — gridlines + "Other" pie slices ONLY, never as data

const CHART_KINDS: { key: ChartKind; label: string }[] = [
  { key: "bar",         label: "Bar (grouped)" },
  { key: "stacked",     label: "Bar (stacked)" },
  { key: "hbar",        label: "Bar (horizontal)" },
  { key: "line",        label: "Line" },
  { key: "area",        label: "Area" },
  { key: "areaStacked", label: "Area (stacked)" },
  { key: "scatter",     label: "Scatter" },
  { key: "pie",         label: "Pie" },
];

// ═══ CSV PARSER + ORIENTATION ═══

// Coerce a cell string to a number when possible, handling common suffixes
// like "1.0x", "50%", "$1,200", "2.5M", "3k". Returns NaN if not numeric.
function coerceNumber(v: string | undefined): number {
  if (v === undefined || v === null) return NaN;
  const raw = String(v).trim();
  if (raw === "") return NaN;
  // Strip common non-numeric prefixes/suffixes
  // $1,234 → 1234   50% → 50   1.0x → 1.0   2.5M → 2.5   3k → 3
  const cleaned = raw
    .replace(/[$£€¥]/g, "")
    .replace(/,/g, "")
    .replace(/[%x×]$/i, "")
    .trim();
  // Magnitude suffixes: k, m, b, t (case-insensitive)
  const magMatch = cleaned.match(/^(-?[\d.]+)\s*([kmbt])$/i);
  if (magMatch) {
    const base = Number(magMatch[1]);
    const mul = { k: 1e3, m: 1e6, b: 1e9, t: 1e12 } as Record<string, number>;
    const n = base * (mul[magMatch[2].toLowerCase()] || 1);
    return isNaN(n) ? NaN : n;
  }
  const n = Number(cleaned);
  return isNaN(n) ? NaN : n;
}

// Split a line on tabs OR commas, whichever is present (tabs win if both)
function splitRow(line: string): string[] {
  if (line.includes("\t")) return line.split("\t").map((c) => c.trim());
  return line.split(",").map((c) => c.trim());
}

function parseCSV(raw: string, orientation: Orientation): { columns: string[]; rows: ChartRow[] } {
  const lines = raw.replace(/\r/g, "").split(/\n/).filter((l) => l.trim() !== "");
  if (lines.length < 2) return { columns: [], rows: [] };
  const table = lines.map(splitRow);

  if (orientation === "cols") {
    // First row = headers (label col + series names as columns). First col = X labels.
    const columns = table[0].map((c, i) => c || (i === 0 ? "Metric" : `Series ${i}`));
    const rows: ChartRow[] = table.slice(1).map((cells) => {
      const row: ChartRow = {};
      columns.forEach((col, i) => {
        const v = cells[i];
        const n = coerceNumber(v);
        row[col] = !isNaN(n) ? n : (v || "");
      });
      return row;
    });
    return { columns, rows };
  } else {
    // Rows as series: first col = series name, remaining cols = values per x-point.
    // First row's remaining cells = x labels. Transpose mentally into wide rows.
    const xLabels = table[0].slice(1);
    const seriesNames = table.slice(1).map((r) => r[0] || "Series");
    const columns = [table[0][0] || "Metric", ...seriesNames];
    const rows: ChartRow[] = xLabels.map((x, xi) => {
      const row: ChartRow = { [columns[0]]: x };
      seriesNames.forEach((name, si) => {
        const v = table[si + 1][xi + 1];
        const n = coerceNumber(v);
        row[name] = !isNaN(n) ? n : 0;
      });
      return row;
    });
    return { columns, rows };
  }
}

const SAMPLE_COLS = `Quarter,Nvidia,AMD,Intel
Q1 2025,68,18,14
Q2 2025,72,19,12
Q3 2025,74,20,10
Q4 2025,78,22,9`;

const SAMPLE_ROWS = `Company,Q1 2025,Q2 2025,Q3 2025,Q4 2025
Nvidia,68,72,74,78
AMD,18,19,20,22
Intel,14,12,10,9`;

// ═══ EXPORT: SVG → PNG ═══
async function waitForFonts() {
  if (typeof document !== "undefined" && document.fonts) {
    try {
      await Promise.all([
        document.fonts.load("600 16px Outfit"),
        document.fonts.load("700 16px Outfit"),
        document.fonts.load("800 16px Outfit"),
        document.fonts.load("500 16px JetBrains Mono"),
      ]);
      await document.fonts.ready;
    } catch { /* noop */ }
  }
}

interface ExportOpts {
  kind: ChartKind;
  rows: ChartRow[];
  labelKey: string;
  seriesKeys: string[];
  colors: string[];
  style: StyleMode;
  backdrop: BackdropKey;
  title: string;
  source: string;
  axisMode: "auto" | "manual";
  xAxisLabel: string;
  yAxisLabel: string;
  width: number;
  height: number;
  userScale: number;
  showValues: boolean;
  theme: ThemeMode;
  yMaxOverride?: number;
}

// Paint the backdrop (branded mode) or leave transparent (clean)
function paintBackdrop(ctx: CanvasRenderingContext2D, w: number, h: number, style: StyleMode, backdrop: BackdropKey, theme: ThemeMode) {
  if (style !== "branded") return;
  const spec = (theme === "light" ? LIGHT_BACKDROPS : BACKDROPS)[backdrop];
  ctx.fillStyle = spec.base;
  ctx.fillRect(0, 0, w, h);
  spec.glows.forEach((g) => {
    const grad = ctx.createRadialGradient(w * g.x, h * g.y, 0, w * g.x, h * g.y, w * g.r);
    grad.addColorStop(0, g.color);
    grad.addColorStop(1, g.color.replace(/,\s*[\d.]+\)/, ",0)"));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  });
  const S = h / PREVIEW_H;
  ctx.fillStyle = spec.accent;
  ctx.fillRect(Math.round(40 * S), Math.round(40 * S), Math.round(50 * S), Math.round(3 * S));
}

// Measure text
function measureText(ctx: CanvasRenderingContext2D, text: string, font: string) {
  ctx.font = font;
  return ctx.measureText(text).width;
}

// Wrap a label (x-axis categorical) if too long
function drawLabelRotated(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, angle: number, font: string, color: string) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 0, 0);
  ctx.restore();
}

// Nice round number for tick spacing
function niceStep(range: number, targetSteps = 5): number {
  const rough = range / targetSteps;
  const pow = Math.pow(10, Math.floor(Math.log10(rough)));
  const n = rough / pow;
  let step: number;
  if (n < 1.5) step = 1;
  else if (n < 3) step = 2;
  else if (n < 7) step = 5;
  else step = 10;
  return step * pow;
}

// ═══ CHART DRAWING ═══
// Reference preview plot height (Recharts ResponsiveContainer height=520)
const PREVIEW_H = 520;

function drawChart(ctx: CanvasRenderingContext2D, opts: ExportOpts) {
  const { kind, rows, labelKey, seriesKeys, colors, style, title, source, axisMode, xAxisLabel, yAxisLabel, width, height, backdrop } = opts;

  const { theme } = opts;
  const isLight = theme === "light";
  const bdSpec = (isLight ? LIGHT_BACKDROPS : BACKDROPS)[backdrop];
  const isBranded = style === "branded";
  const textColor = isBranded ? (isLight ? "#1A1A1A" : "#E8E4DD") : "#1A1A1A";
  const axisColor = isBranded ? (isLight ? "#666666" : "rgba(255,255,255,0.55)") : "#888888";
  const gridColor = isBranded ? (isLight ? "rgba(0,0,0,0.10)" : "rgba(255,255,255,0.10)") : "rgba(0,0,0,0.10)";

  // Scale factor: export height / preview height, times user-tunable multiplier.
  const scale = (height / PREVIEW_H) * (opts.userScale || 1);
  const S = (n: number) => Math.round(n * scale);

  // Layout regions (scaled) — tight, matches preview
  const padLeft = S(isBranded ? 60 : 50);
  const padRight = S(isBranded ? 60 : 50);
  const padTop = S(isBranded ? (title ? 95 : 55) : 45);
  const padBottom = S(isBranded ? 50 : 40);

  // Title + accent (branded only) — reference sizes match the preview exactly
  if (isBranded && title) {
    ctx.font = `800 ${S(26)}px 'Outfit', Arial, sans-serif`;
    ctx.fillStyle = isLight ? "#1A1A1A" : "#E8E4DD";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(title, S(40), S(57));
  }

  if (kind === "pie") {
    drawPie(ctx, rows, labelKey, seriesKeys, colors, { padLeft, padRight, padTop, padBottom, width, height, textColor, scale });
  } else {
    drawCartesian(ctx, opts, { padLeft, padRight, padTop, padBottom, axisColor, gridColor, textColor, scale });
  }

  // Source line + wordmark (branded only) — reference sizes match preview
  if (isBranded) {
    if (source) {
      ctx.font = `500 ${S(10)}px 'JetBrains Mono', monospace`;
      ctx.fillStyle = isLight ? "rgba(0,0,0,0.55)" : "rgba(255,255,255,0.55)";
      ctx.textAlign = "left";
      ctx.textBaseline = "bottom";
      ctx.fillText(source, S(40), height - S(18));
    }
    ctx.font = `700 ${S(10)}px 'JetBrains Mono', monospace`;
    ctx.fillStyle = bdSpec.accent;
    ctx.textAlign = "right";
    ctx.textBaseline = "bottom";
    ctx.fillText("SEMIANALYSIS", width - S(40), height - S(18));
  }

  // Manual axis labels — positioned relative to the actual plot area.
  // Vertical charts: X label below ticks (and above legend), Y label rotated on left.
  // Horizontal bar: X label is the numeric axis; Y label is categories axis.
  if (axisMode === "manual" && kind !== "pie") {
    const legendH = S(54);
    const plotBottom = height - padBottom - legendH;
    const plotHCenter = (padTop + plotBottom) / 2;
    if (xAxisLabel) {
      ctx.font = `700 ${S(14)}px 'Outfit', Arial, sans-serif`;
      ctx.fillStyle = textColor;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      // Between x-ticks and legend (ticks at plotBottom+S(30), legend at plotBottom+S(65))
      ctx.fillText(xAxisLabel, (padLeft + (width - padRight)) / 2, plotBottom + S(48));
    }
    if (yAxisLabel) {
      ctx.save();
      ctx.translate(padLeft - S(48), plotHCenter);
      ctx.rotate(-Math.PI / 2);
      ctx.font = `700 ${S(14)}px 'Outfit', Arial, sans-serif`;
      ctx.fillStyle = textColor;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(yAxisLabel, 0, 0);
      ctx.restore();
    }
  }
}

function drawCartesian(
  ctx: CanvasRenderingContext2D,
  opts: ExportOpts,
  layout: { padLeft: number; padRight: number; padTop: number; padBottom: number; axisColor: string; gridColor: string; textColor: string; scale: number }
) {
  const { kind, rows, labelKey, seriesKeys, colors, width, height } = opts;
  const { padLeft, padRight, padTop, padBottom, axisColor, gridColor, textColor, scale } = layout;
  const S = (n: number) => Math.round(n * scale);

  // Reserve space for legend at bottom (scaled)
  const legendH = S(54);
  const plotLeft = padLeft;
  const plotRight = width - padRight;
  const plotTop = padTop;
  const plotBottom = height - padBottom - legendH;
  const plotW = plotRight - plotLeft;
  const plotH = plotBottom - plotTop;

  // Compute data extent
  const stacked = kind === "stacked" || kind === "areaStacked";
  let maxV = 0, minV = 0;
  rows.forEach((r) => {
    if (stacked) {
      let sum = 0;
      seriesKeys.forEach((k) => { sum += Number(r[k]) || 0; });
      if (sum > maxV) maxV = sum;
    } else {
      seriesKeys.forEach((k) => {
        const v = Number(r[k]) || 0;
        if (v > maxV) maxV = v;
        if (v < minV) minV = v;
      });
    }
  });
  if (maxV === minV) maxV = minV + 1;
  // Round up maxV to nice step
  const step = niceStep(maxV - minV, 5);
  const yMax = opts.yMaxOverride && opts.yMaxOverride > 0 ? opts.yMaxOverride : Math.ceil(maxV / step) * step;
  const yMin = minV < 0 ? Math.floor(minV / step) * step : 0;

  const xToPx = (i: number, total: number) => plotLeft + (plotW / total) * (i + 0.5);
  const yToPx = (v: number) => plotBottom - ((v - yMin) / (yMax - yMin)) * plotH;

  // Font + stroke sizes scaled from preview (PREVIEW_H) proportions
  const tickFont = `600 ${S(14)}px 'Outfit', Arial, sans-serif`;

  // Gridlines + y-axis labels
  ctx.font = tickFont;
  ctx.fillStyle = axisColor;
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  for (let v = yMin; v <= yMax + 0.0001; v += step) {
    const y = yToPx(v);
    ctx.strokeStyle = gridColor;
    ctx.lineWidth = Math.max(1, S(1));
    ctx.beginPath();
    ctx.moveTo(plotLeft, y);
    ctx.lineTo(plotRight, y);
    ctx.stroke();
    const label = Number.isInteger(step) ? String(v) : v.toFixed(1);
    ctx.fillText(label, plotLeft - S(10), y);
  }

  // X-axis labels
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillStyle = axisColor;
  const xLabels = rows.map((r) => String(r[labelKey] ?? ""));
  const maxLabelW = Math.max(...xLabels.map((l) => measureText(ctx, l, tickFont)));
  const rotate = maxLabelW > plotW / rows.length - S(10);
  xLabels.forEach((l, i) => {
    const x = xToPx(i, rows.length);
    if (rotate) {
      drawLabelRotated(ctx, l, x, plotBottom + S(10), -Math.PI / 6, tickFont, axisColor);
    } else {
      ctx.fillText(l, x, plotBottom + S(10));
    }
  });

  // Data series
  const showVals = opts.showValues;
  const valueFont = `700 ${S(12)}px 'Outfit', Arial, sans-serif`;
  const fmt = (v: number) => {
    if (Math.abs(v) >= 1000) return v.toLocaleString();
    if (Number.isInteger(v)) return String(v);
    return v.toFixed(1);
  };

  // ═══ HORIZONTAL BAR ═══
  if (kind === "hbar") {
    drawHorizontalBar(ctx, opts, { plotLeft, plotRight, plotTop, plotBottom, plotW, plotH, axisColor, gridColor, textColor, scale });
    drawLegend(ctx, seriesKeys, colors, { plotLeft, plotRight, plotBottom, textColor, scale, extraGap: opts.axisMode === "manual" && opts.xAxisLabel ? 65 : 48 });
    return;
  }

  if (kind === "bar" || kind === "stacked") {
    const groupWidth = plotW / rows.length;
    if (kind === "bar") {
      const barCount = seriesKeys.length;
      const barWidth = (groupWidth * 0.72) / barCount;
      const gap = S(2);
      rows.forEach((row, i) => {
        seriesKeys.forEach((key, s) => {
          const v = Number(row[key]) || 0;
          const centerX = xToPx(i, rows.length);
          const x = centerX - (barCount * barWidth) / 2 + s * barWidth;
          const y = yToPx(v);
          ctx.fillStyle = colors[s % colors.length];
          ctx.fillRect(x, y, barWidth - gap, plotBottom - y);
          if (showVals) {
            ctx.font = valueFont;
            ctx.fillStyle = textColor;
            ctx.textAlign = "center";
            ctx.textBaseline = "bottom";
            ctx.fillText(fmt(v), x + (barWidth - gap) / 2, y - S(4));
          }
        });
      });
    } else {
      // stacked
      const barWidth = groupWidth * 0.72;
      rows.forEach((row, i) => {
        let cumulative = 0;
        const centerX = xToPx(i, rows.length);
        const x = centerX - barWidth / 2;
        seriesKeys.forEach((key, s) => {
          const v = Number(row[key]) || 0;
          const y = yToPx(cumulative + v);
          const h = yToPx(cumulative) - y;
          ctx.fillStyle = colors[s % colors.length];
          ctx.fillRect(x, y, barWidth, h);
          if (showVals && h > S(20)) {
            ctx.font = valueFont;
            ctx.fillStyle = "#ffffff";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(fmt(v), x + barWidth / 2, y + h / 2);
          }
          cumulative += v;
        });
      });
    }
  } else if (kind === "line" || kind === "scatter") {
    const isScatter = kind === "scatter";
    const lineW = S(3);
    const dotR = isScatter ? S(7) : S(4);
    seriesKeys.forEach((key, s) => {
      if (!isScatter) {
        ctx.strokeStyle = colors[s % colors.length];
        ctx.lineWidth = lineW;
        ctx.lineJoin = "round";
        ctx.beginPath();
        rows.forEach((row, i) => {
          const v = Number(row[key]) || 0;
          const x = xToPx(i, rows.length);
          const y = yToPx(v);
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        });
        ctx.stroke();
      }
      rows.forEach((row, i) => {
        const v = Number(row[key]) || 0;
        const x = xToPx(i, rows.length);
        const y = yToPx(v);
        ctx.fillStyle = colors[s % colors.length];
        ctx.beginPath();
        ctx.arc(x, y, dotR, 0, Math.PI * 2);
        ctx.fill();
        if (showVals) {
          ctx.font = valueFont;
          ctx.fillStyle = textColor;
          ctx.textAlign = "center";
          ctx.textBaseline = "bottom";
          ctx.fillText(fmt(v), x, y - dotR - S(4));
        }
      });
    });
  } else if (kind === "area" || kind === "areaStacked") {
    if (kind === "areaStacked") {
      // Compute stacked values per row
      const stack: number[][] = rows.map(() => []);
      rows.forEach((row, i) => {
        let cum = 0;
        seriesKeys.forEach((key) => {
          cum += Number(row[key]) || 0;
          stack[i].push(cum);
        });
      });
      // Draw from bottom to top
      seriesKeys.forEach((_key, s) => {
        const color = colors[s % colors.length];
        ctx.fillStyle = color + "D0"; // 82% alpha
        ctx.strokeStyle = color;
        ctx.lineWidth = S(2.2);
        ctx.beginPath();
        rows.forEach((_row, i) => {
          const x = xToPx(i, rows.length);
          const yTop = yToPx(stack[i][s]);
          if (i === 0) ctx.moveTo(x, yTop); else ctx.lineTo(x, yTop);
        });
        for (let i = rows.length - 1; i >= 0; i--) {
          const x = xToPx(i, rows.length);
          const yBot = s === 0 ? yToPx(0) : yToPx(stack[i][s - 1]);
          ctx.lineTo(x, yBot);
        }
        ctx.closePath();
        ctx.fill();
      });
    } else {
      // overlaid areas
      seriesKeys.forEach((key, s) => {
        const color = colors[s % colors.length];
        ctx.fillStyle = color + "A0"; // transparent-ish
        ctx.strokeStyle = color;
        ctx.lineWidth = S(2.2);
        ctx.beginPath();
        rows.forEach((row, i) => {
          const v = Number(row[key]) || 0;
          const x = xToPx(i, rows.length);
          const y = yToPx(v);
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        });
        ctx.lineTo(xToPx(rows.length - 1, rows.length), yToPx(0));
        ctx.lineTo(xToPx(0, rows.length), yToPx(0));
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        rows.forEach((row, i) => {
          const v = Number(row[key]) || 0;
          const x = xToPx(i, rows.length);
          const y = yToPx(v);
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        });
        ctx.stroke();
      });
    }
  }

  // Legend — centered under the plot area
  const legendFont = `600 ${S(14)}px 'Outfit', Arial, sans-serif`;
  ctx.font = legendFont;
  const swatch = S(14);
  const itemGap = S(24);
  const padBetweenSwatchAndText = S(8);
  const items = seriesKeys.map((k) => ({ text: k, w: measureText(ctx, k, legendFont) + swatch + padBetweenSwatchAndText }));
  const totalW = items.reduce((a, b) => a + b.w, 0) + itemGap * (items.length - 1);
  let cursor = (plotLeft + plotRight) / 2 - totalW / 2;
  const legendY = plotBottom + (opts.axisMode === "manual" && opts.xAxisLabel ? S(65) : S(48));
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  items.forEach((it, i) => {
    ctx.fillStyle = colors[i % colors.length];
    ctx.fillRect(cursor, legendY - swatch / 2, swatch, swatch);
    ctx.fillStyle = textColor;
    ctx.fillText(it.text, cursor + swatch + padBetweenSwatchAndText, legendY);
    cursor += it.w + itemGap;
  });
}

// Reusable legend drawer (used by hbar)
function drawLegend(
  ctx: CanvasRenderingContext2D,
  seriesKeys: string[],
  colors: string[],
  layout: { plotLeft: number; plotRight: number; plotBottom: number; textColor: string; scale: number; extraGap: number }
) {
  const { plotLeft, plotRight, plotBottom, textColor, scale } = layout;
  const S = (n: number) => Math.round(n * scale);
  const legendFont = `600 ${S(14)}px 'Outfit', Arial, sans-serif`;
  ctx.font = legendFont;
  const swatch = S(14);
  const itemGap = S(24);
  const padBetween = S(8);
  const items = seriesKeys.map((k) => ({ text: k, w: ctx.measureText(k).width + swatch + padBetween }));
  const totalW = items.reduce((a, b) => a + b.w, 0) + itemGap * (items.length - 1);
  let cursor = (plotLeft + plotRight) / 2 - totalW / 2;
  const legendY = plotBottom + S(layout.extraGap);
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  items.forEach((it, i) => {
    ctx.fillStyle = colors[i % colors.length];
    ctx.fillRect(cursor, legendY - swatch / 2, swatch, swatch);
    ctx.fillStyle = textColor;
    ctx.fillText(it.text, cursor + swatch + padBetween, legendY);
    cursor += it.w + itemGap;
  });
}

// Horizontal bar chart — rows are Y categories, first series column drives bar length
function drawHorizontalBar(
  ctx: CanvasRenderingContext2D,
  opts: ExportOpts,
  layout: { plotLeft: number; plotRight: number; plotTop: number; plotBottom: number; plotW: number; plotH: number; axisColor: string; gridColor: string; textColor: string; scale: number }
) {
  const { rows, labelKey, seriesKeys, colors } = opts;
  const { plotLeft, plotRight, plotTop, plotBottom, plotW, plotH, axisColor, gridColor, textColor, scale } = layout;
  const S = (n: number) => Math.round(n * scale);

  const showVals = opts.showValues;
  const valueFont = `700 ${S(12)}px 'Outfit', Arial, sans-serif`;
  const fmt = (v: number) => Math.abs(v) >= 1000 ? v.toLocaleString() : Number.isInteger(v) ? String(v) : v.toFixed(1);

  // Data extent (X axis is now numeric, Y is categorical)
  let maxV = 0;
  rows.forEach((r) => seriesKeys.forEach((k) => { const v = Number(r[k]) || 0; if (v > maxV) maxV = v; }));
  if (maxV === 0) maxV = 1;
  const step = niceStep(maxV, 5);
  const xMax = opts.yMaxOverride && opts.yMaxOverride > 0 ? opts.yMaxOverride : Math.ceil(maxV / step) * step;

  const xToPx = (v: number) => plotLeft + (v / xMax) * plotW;
  const yToPx = (i: number, total: number) => plotTop + (plotH / total) * (i + 0.5);

  const tickFont = `600 ${S(14)}px 'Outfit', Arial, sans-serif`;
  ctx.font = tickFont;

  // Vertical gridlines + numeric x-axis labels at bottom
  ctx.fillStyle = axisColor;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  for (let v = 0; v <= xMax + 0.0001; v += step) {
    const x = xToPx(v);
    ctx.strokeStyle = gridColor;
    ctx.lineWidth = Math.max(1, S(1));
    ctx.beginPath();
    ctx.moveTo(x, plotTop);
    ctx.lineTo(x, plotBottom);
    ctx.stroke();
    ctx.fillText(Number.isInteger(step) ? String(v) : v.toFixed(1), x, plotBottom + S(10));
  }

  // Y-axis categorical labels
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  ctx.fillStyle = axisColor;
  rows.forEach((r, i) => {
    ctx.fillText(String(r[labelKey] ?? ""), plotLeft - S(10), yToPx(i, rows.length));
  });

  // Bars (one group per row, one bar per series)
  const rowHeight = plotH / rows.length;
  const seriesCount = seriesKeys.length;
  const barTotalH = rowHeight * 0.72;
  const barH = barTotalH / seriesCount;
  const gap = S(1);
  rows.forEach((row, i) => {
    const centerY = yToPx(i, rows.length);
    seriesKeys.forEach((key, s) => {
      const v = Number(row[key]) || 0;
      const y = centerY - barTotalH / 2 + s * barH;
      const w = (v / xMax) * plotW;
      ctx.fillStyle = colors[s % colors.length];
      ctx.fillRect(plotLeft, y, w, barH - gap);
      if (showVals) {
        ctx.font = valueFont;
        ctx.fillStyle = textColor;
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillText(fmt(v), plotLeft + w + S(6), y + (barH - gap) / 2);
      }
    });
  });
}

function drawPie(
  ctx: CanvasRenderingContext2D,
  rows: ChartRow[],
  labelKey: string,
  seriesKeys: string[],
  colors: string[],
  layout: { padLeft: number; padRight: number; padTop: number; padBottom: number; width: number; height: number; textColor: string; scale: number }
) {
  const seriesKey = seriesKeys[0];
  if (!seriesKey) return;
  const { padLeft, padRight, padTop, padBottom, width, height, textColor, scale } = layout;
  const S = (n: number) => Math.round(n * scale);
  const legendReserve = S(40);
  const cx = (padLeft + (width - padRight)) / 2;
  const cy = (padTop + (height - padBottom - legendReserve)) / 2;
  const r = Math.min((width - padLeft - padRight) / 2, (height - padTop - padBottom - legendReserve) / 2) * 0.75;

  const total = rows.reduce((s, row) => s + (Number(row[seriesKey]) || 0), 0) || 1;
  let start = -Math.PI / 2;
  rows.forEach((row, i) => {
    const v = (Number(row[seriesKey]) || 0) / total;
    const end = start + v * Math.PI * 2;
    ctx.fillStyle = colors[i % colors.length];
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, start, end);
    ctx.closePath();
    ctx.fill();
    start = end;
  });

  // Legend
  const legendFont = `600 ${S(14)}px 'Outfit', Arial, sans-serif`;
  ctx.font = legendFont;
  const swatch = S(14);
  const itemGap = S(24);
  const padBetween = S(8);
  const items = rows.map((row, i) => {
    const name = String(row[labelKey] ?? "");
    return { text: name, w: measureText(ctx, name, legendFont) + swatch + padBetween, color: colors[i % colors.length] };
  });
  const totalW = items.reduce((a, b) => a + b.w, 0) + itemGap * (items.length - 1);
  let cursor = cx - totalW / 2;
  const legendY = cy + r + S(40);
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  items.forEach((it) => {
    ctx.fillStyle = it.color;
    ctx.fillRect(cursor, legendY - swatch / 2, swatch, swatch);
    ctx.fillStyle = textColor;
    ctx.fillText(it.text, cursor + swatch + padBetween, legendY);
    cursor += it.w + itemGap;
  });
}

async function exportChartPNG(opts: ExportOpts): Promise<Blob> {
  await waitForFonts();
  const canvas = document.createElement("canvas");
  canvas.width = opts.width;
  canvas.height = opts.height;
  const ctx = canvas.getContext("2d")!;
  paintBackdrop(ctx, opts.width, opts.height, opts.style, opts.backdrop, opts.theme);
  drawChart(ctx, opts);
  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob failed"))), "image/png");
  });
}

// ═══ MAIN ═══
export default function ChartMaker() {
  const [csv, setCsv] = useState(SAMPLE_COLS);
  const [inputMode, setInputMode] = useState<InputMode>("paste");
  const [xlsxWorkbook, setXlsxWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [xlsxSheet, setXlsxSheet] = useState<string>("");
  const [xlsxRange, setXlsxRange] = useState<string>("");
  const [xlsxError, setXlsxError] = useState<string>("");
  const [orientation, setOrientation] = useState<Orientation>("cols");
  const [kind, setKind] = useState<ChartKind>("bar");
  const [palette, setPalette] = useState<PaletteKey>("saCore");
  const [style, setStyle] = useState<StyleMode>("branded");
  const [theme, setTheme] = useState<ThemeMode>("dark");
  const [backdrop, setBackdrop] = useState<BackdropKey>("both");
  const [axisMode, setAxisMode] = useState<"auto" | "manual">("auto");
  const [userScale, setUserScale] = useState<number>(1.0); // 0.7–1.5 multiplier
  const [showValues, setShowValues] = useState<boolean>(false);
  const [yMaxInput, setYMaxInput] = useState<string>(""); // empty = auto
  const [xAxisLabel, setXAxisLabel] = useState("");
  const [yAxisLabel, setYAxisLabel] = useState("");
  const [title, setTitle] = useState("Accelerator Market Share");
  const [source, setSource] = useState("Source: SemiAnalysis Accelerator Model");
  const [exporting, setExporting] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const chartRef = useRef<HTMLDivElement>(null);
  const userCtx = useUser();

  const parsed = parseCSV(csv, orientation);
  const labelKey = parsed.columns[0] || "";
  const seriesKeys = parsed.columns.slice(1);
  const colors = PALETTES[palette].colors;

  // ═══ MANUAL GRID HANDLERS ═══
  const grid = csvToGrid(csv);
  const ensureGrid = (g: string[][]) => (g.length === 0 ? [[""]] : g);
  function setCell(r: number, c: number, v: string) {
    const next = grid.map((row) => [...row]);
    next[r][c] = v;
    setCsv(gridToCsv(next));
  }
  function addRow() { setCsv(gridToCsv([...grid, Array(grid[0]?.length || 1).fill("")])); }
  function removeRow(i: number) {
    if (grid.length <= 2) return; // keep header + 1
    setCsv(gridToCsv(grid.filter((_, idx) => idx !== i)));
  }
  function addCol() { setCsv(gridToCsv(grid.map((r) => [...r, ""]))); }
  function removeCol(i: number) {
    if ((grid[0]?.length || 0) <= 2) return; // keep label + 1 series
    setCsv(gridToCsv(grid.map((r) => r.filter((_, idx) => idx !== i))));
  }

  // ═══ EXCEL HANDLERS ═══
  function handleExcelFile(file: File) {
    setXlsxError("");
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = new Uint8Array(ev.target!.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array" });
        setXlsxWorkbook(wb);
        setXlsxSheet(wb.SheetNames[0] || "");
        setXlsxRange("");
      } catch (e) {
        setXlsxError("Failed to parse file: " + (e as Error).message);
      }
    };
    reader.onerror = () => setXlsxError("File read failed");
    reader.readAsArrayBuffer(file);
  }
  function importExcel() {
    if (!xlsxWorkbook || !xlsxSheet) return;
    try {
      const ws = xlsxWorkbook.Sheets[xlsxSheet];
      if (!ws) { setXlsxError("Sheet not found"); return; }
      const opts: XLSX.Sheet2CSVOpts & { range?: string } = { FS: ",", blankrows: false };
      if (xlsxRange.trim()) opts.range = xlsxRange.trim().toUpperCase();
      const csvOut = XLSX.utils.sheet_to_csv(ws, opts);
      if (!csvOut.trim()) { setXlsxError("Empty range — check the range or sheet"); return; }
      setCsv(csvOut.trim());
      setXlsxError("");
      setInputMode("manual"); // flip to manual so they can see the result
    } catch (e) {
      setXlsxError("Import failed: " + (e as Error).message);
    }
  }

  function swapOrientation(next: Orientation) {
    setOrientation(next);
    // Offer to swap sample data as a convenience
    if (csv === SAMPLE_COLS && next === "rows") setCsv(SAMPLE_ROWS);
    else if (csv === SAMPLE_ROWS && next === "cols") setCsv(SAMPLE_COLS);
  }

  // FLIP: transpose the underlying CSV so rows and columns swap.
  // Previously-X-labels become series names and vice versa. Handy for
  // pivoting without retyping data.
  function flipData() {
    const g = csvToGrid(csv);
    if (g.length === 0 || g[0].length === 0) return;
    const cols = g[0].length;
    const transposed: string[][] = [];
    for (let c = 0; c < cols; c++) {
      const newRow: string[] = [];
      for (let r = 0; r < g.length; r++) {
        newRow.push(g[r][c] ?? "");
      }
      transposed.push(newRow);
    }
    setCsv(gridToCsv(transposed));
  }

  function handleExport() {
    setExporting(true);
    const W = style === "branded" ? 1920 : 1600;
    const H = style === "branded" ? 1080 : 900;
    exportChartPNG({
      kind,
      rows: parsed.rows,
      labelKey,
      seriesKeys,
      colors,
      style,
      backdrop,
      title: style === "branded" ? title : "",
      source: style === "branded" ? source : "",
      axisMode,
      xAxisLabel,
      yAxisLabel,
      width: W,
      height: H,
      userScale,
      showValues,
      theme,
      yMaxOverride: yMaxInput.trim() ? Number(yMaxInput) : undefined,
    })
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        const safe = (title || "chart").replace(/[^a-zA-Z0-9]+/g, "_").slice(0, 40);
        a.download = `${safe}_${style}_${kind}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        setExporting(false);
      })
      .catch((e) => { alert("Export failed: " + e.message); setExporting(false); });
  }

  function handleSaveArchive() {
    setSaveStatus("saving");
    const authorName = userCtx.user ? userCtx.user.name : "Unknown";
    const authorRole = userCtx.user ? userCtx.user.role : "";
    const data = {
      csv, orientation, kind, palette, style, backdrop, title, source,
      axisMode, xAxisLabel, yAxisLabel, userScale, showValues, theme, yMaxInput,
      timestamp: new Date().toISOString(),
      createdBy: authorName,
      createdByRole: authorRole,
    };
    fetch("/api/db", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        table: "projects",
        data: {
          id: "chart-" + Date.now(),
          type: "chart",
          name: title || "Untitled Chart",
          data,
        },
      }),
    })
      .then((r) => r.json())
      .then(() => { setSaveStatus("saved"); setTimeout(() => setSaveStatus("idle"), 3000); })
      .catch(() => { setSaveStatus("idle"); alert("Save failed"); });
  }

  // ═══ CHART RENDERER ═══
  function renderChart() {
    if (parsed.rows.length === 0) return <Empty />;
    const isLight = theme === "light";
    const isBrandedDark = style === "branded" && !isLight;
    const axisColor = isBrandedDark ? "rgba(255,255,255,0.55)" : "#666666";
    const gridColor = isBrandedDark ? "rgba(255,255,255,0.10)" : GREY + "35";
    const textColor = isBrandedDark ? "#E8E4DD" : "#1A1A1A";
    const tooltipBg = isBrandedDark ? "#0A0A14" : "#ffffff";
    const tooltipBorder = isBrandedDark ? "rgba(255,255,255,0.1)" : "#E0E0E0";

    // Add margin for axis labels when in manual mode
    const showLabels = axisMode === "manual";
    const showX = showLabels && !!xAxisLabel;
    const showY = showLabels && !!yAxisLabel;
    const common = {
      data: parsed.rows,
      margin: {
        top: 20,
        right: 30,
        left: showY ? 30 : 10,
        bottom: 10,
      },
    };
    // Apply userScale to preview so slider changes are visible live
    const tickFS = Math.round(14 * userScale);
    const legendFS = Math.round(14 * userScale);
    const lineW = Math.max(2, 3 * userScale);
    const dotR = Math.max(3, 4 * userScale);
    const tickStyle = { fontSize: tickFS, fontFamily: "'Outfit', sans-serif", fontWeight: 600, fill: axisColor };
    const legendStyle = { color: textColor, fontFamily: "'Outfit', sans-serif", fontSize: legendFS, fontWeight: 600 };
    const xLabel = showX ? { value: xAxisLabel, position: "insideBottom" as const, offset: -28, fill: textColor, fontSize: Math.round(14 * userScale), fontFamily: "'Outfit', sans-serif", fontWeight: 700 } : undefined;
    const yLabel = showY ? { value: yAxisLabel, angle: -90, position: "insideLeft" as const, fill: textColor, fontSize: Math.round(14 * userScale), fontFamily: "'Outfit', sans-serif", fontWeight: 700, style: { textAnchor: "middle" as const } } : undefined;
    const valueLabelStyle = { fill: textColor, fontSize: Math.round(12 * userScale), fontFamily: "'Outfit', sans-serif", fontWeight: 700 };
    const yDomain: [number | "auto", number | "auto"] = yMaxInput.trim() && !isNaN(Number(yMaxInput))
      ? [0, Number(yMaxInput)] : ["auto", "auto"];
    const fmtVal = (v: number) => {
      if (typeof v !== "number") return "";
      if (Math.abs(v) >= 1000) return v.toLocaleString();
      if (Number.isInteger(v)) return String(v);
      return v.toFixed(1);
    };

    if (kind === "pie") {
      const pieData = parsed.rows.map((r) => ({ name: String(r[labelKey]), value: Number(r[seriesKeys[0]]) || 0 }));
      return (
        <ResponsiveContainer width="100%" height={520}>
          <PieChart>
            <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={Math.round(180 * Math.min(1.2, userScale))} label={showValues ? (e: { name?: string; value?: number }) => `${e.name}: ${fmtVal(e.value || 0)}` : { fill: textColor, fontSize: Math.round(13 * userScale), fontFamily: "'Outfit', sans-serif", fontWeight: 600 }}>
              {pieData.map((_, i) => <Cell key={i} fill={colors[i % colors.length]} />)}
            </Pie>
            <Tooltip contentStyle={{ background: tooltipBg, border: `1px solid ${tooltipBorder}`, borderRadius: 8, color: textColor }} />
          </PieChart>
        </ResponsiveContainer>
      );
    }

    if (kind === "scatter") {
      // Plot each series as points at (categorical index, y-value)
      const scatterData = seriesKeys.map((k) => parsed.rows.map((r, i) => ({ x: i, y: Number(r[k]) || 0, label: String(r[labelKey] ?? "") })));
      return (
        <ResponsiveContainer width="100%" height={520}>
          <ScatterChart {...common}>
            <CartesianGrid stroke={gridColor} vertical={false} />
            <XAxis type="number" dataKey="x" tick={tickStyle} stroke={axisColor} tickLine={false} axisLine={false} domain={[-0.5, parsed.rows.length - 0.5]} tickFormatter={(v: number) => parsed.rows[v]?.[labelKey] !== undefined ? String(parsed.rows[v][labelKey]) : ""} ticks={parsed.rows.map((_, i) => i)} />
            <YAxis type="number" tick={tickStyle} stroke={axisColor} tickLine={false} axisLine={false} domain={yDomain} />
            <Tooltip contentStyle={{ background: tooltipBg, border: `1px solid ${tooltipBorder}`, borderRadius: 8, color: textColor }} />
            {seriesKeys.map((k, i) => (
              <Scatter key={k} name={k} data={scatterData[i]} fill={colors[i % colors.length]}>
                {showValues && <LabelList dataKey="y" position="top" formatter={fmtVal as never} style={valueLabelStyle as never} />}
              </Scatter>
            ))}
          </ScatterChart>
        </ResponsiveContainer>
      );
    }

    if (kind === "hbar") {
      return (
        <ResponsiveContainer width="100%" height={520}>
          <BarChart {...common} layout="vertical" margin={{ top: 20, right: 50, left: 60, bottom: 10 }}>
            <CartesianGrid stroke={gridColor} horizontal={false} />
            <XAxis type="number" tick={tickStyle} stroke={axisColor} tickLine={false} axisLine={false} domain={yDomain} />
            <YAxis type="category" dataKey={labelKey} tick={tickStyle} stroke={axisColor} tickLine={false} axisLine={false} width={100} />
            <Tooltip contentStyle={{ background: tooltipBg, border: `1px solid ${tooltipBorder}`, borderRadius: 8, color: textColor }} />
            {seriesKeys.map((k, i) => (
              <Bar key={k} dataKey={k} fill={colors[i % colors.length]} radius={[0, 6, 6, 0]}>
                {showValues && <LabelList dataKey={k} position="right" formatter={fmtVal as never} style={valueLabelStyle as never} />}
              </Bar>
            ))}
          </BarChart>
        </ResponsiveContainer>
      );
    }

    if (kind === "line") {
      return (
        <ResponsiveContainer width="100%" height={520}>
          <LineChart {...common}>
            <CartesianGrid stroke={gridColor} vertical={false} />
            <XAxis dataKey={labelKey} tick={tickStyle} stroke={axisColor} tickLine={false} axisLine={false} />
            <YAxis tick={tickStyle} stroke={axisColor} tickLine={false} axisLine={false} domain={yDomain} />
            <Tooltip contentStyle={{ background: tooltipBg, border: `1px solid ${tooltipBorder}`, borderRadius: 8, color: textColor }} />
            {seriesKeys.map((k, i) => (
              <Line key={k} type="monotone" dataKey={k} stroke={colors[i % colors.length]} strokeWidth={lineW} dot={{ r: dotR }}>
                {showValues && <LabelList dataKey={k} position="top" formatter={fmtVal as never} style={valueLabelStyle as never} />}
              </Line>
            ))}
          </LineChart>
        </ResponsiveContainer>
      );
    }

    if (kind === "area" || kind === "areaStacked") {
      return (
        <ResponsiveContainer width="100%" height={520}>
          <AreaChart {...common}>
            <CartesianGrid stroke={gridColor} vertical={false} />
            <XAxis dataKey={labelKey} tick={tickStyle} stroke={axisColor} tickLine={false} axisLine={false} />
            <YAxis tick={tickStyle} stroke={axisColor} tickLine={false} axisLine={false} domain={yDomain} />
            <Tooltip contentStyle={{ background: tooltipBg, border: `1px solid ${tooltipBorder}`, borderRadius: 8, color: textColor }} />
            {seriesKeys.map((k, i) => (
              <Area key={k} type="monotone" dataKey={k} stroke={colors[i % colors.length]} fill={colors[i % colors.length]} fillOpacity={0.82} strokeWidth={Math.max(1.5, 2.2 * userScale)} stackId={kind === "areaStacked" ? "a" : undefined}>
                {showValues && <LabelList dataKey={k} position="top" formatter={fmtVal as never} style={valueLabelStyle as never} />}
              </Area>
            ))}
          </AreaChart>
        </ResponsiveContainer>
      );
    }

    return (
      <ResponsiveContainer width="100%" height={520}>
        <BarChart {...common}>
          <CartesianGrid stroke={gridColor} vertical={false} />
          <XAxis dataKey={labelKey} tick={tickStyle} stroke={axisColor} tickLine={false} axisLine={false} />
          <YAxis tick={tickStyle} stroke={axisColor} tickLine={false} axisLine={false} domain={yDomain} />
          <Tooltip contentStyle={{ background: tooltipBg, border: `1px solid ${tooltipBorder}`, borderRadius: 8, color: textColor }} />
          {seriesKeys.map((k, i) => (
            <Bar key={k} dataKey={k} fill={colors[i % colors.length]} stackId={kind === "stacked" ? "a" : undefined} radius={kind === "stacked" ? [0, 0, 0, 0] : [6, 6, 0, 0]}>
              {showValues && <LabelList dataKey={k} position={kind === "stacked" ? "center" : "top"} formatter={fmtVal as never} style={{ ...valueLabelStyle, fill: kind === "stacked" ? "#ffffff" : textColor } as never} />}
            </Bar>
          ))}
        </BarChart>
      </ResponsiveContainer>
    );
  }

  const bdSpec = (theme === "light" ? LIGHT_BACKDROPS : BACKDROPS)[backdrop];
  const previewBg = style === "branded" ? bdSpec.base : "#ffffff";
  const previewTitleColor = theme === "light" ? "#1A1A1A" : "#E8E4DD";
  const previewSourceColor = theme === "light" ? "rgba(0,0,0,0.55)" : "rgba(255,255,255,0.55)";

  return (
    <div style={{ padding: "28px 32px 60px", maxWidth: 1400, margin: "0 auto", color: C.tx, fontFamily: ft }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontFamily: ft, fontSize: 24, fontWeight: 900, color: C.tx, letterSpacing: -0.5 }}>Chart Maker</div>
        <div style={{ fontFamily: mn, fontSize: 11, color: C.txm, marginTop: 4, letterSpacing: 1 }}>SA BRAND PALETTES · CSV OR TRANSPOSED · CLEAN OR BRANDED PNG</div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "340px 1fr", gap: 18 }}>
        {/* ═══ CONTROLS ═══ */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {/* Orientation */}
          <Section label="Data Orientation" defaultOpen={false}>
            <div style={{ display: "flex", gap: 6 }}>
              <Pill active={orientation === "cols"} onClick={() => swapOrientation("cols")}>Columns = Series</Pill>
              <Pill active={orientation === "rows"} onClick={() => swapOrientation("rows")}>Rows = Series</Pill>
            </div>
            <div style={{ fontSize: 10, color: C.txd, fontFamily: mn, marginTop: 6 }}>
              {orientation === "cols"
                ? "First row = headers. First col = X labels. Each other column is a series."
                : "First row = X labels (skip first cell). First col = series names. Each row is a series."}
            </div>
          </Section>

          {/* Data Input */}
          <Section label="Data">
            <div style={{ display: "flex", gap: 4, marginBottom: 8 }}>
              <Pill active={inputMode === "paste"} onClick={() => setInputMode("paste")}>Paste CSV</Pill>
              <Pill active={inputMode === "manual"} onClick={() => setInputMode("manual")}>Manual</Pill>
              <Pill active={inputMode === "excel"} onClick={() => setInputMode("excel")}>Excel</Pill>
            </div>

            {inputMode === "paste" && (
              <textarea
                value={csv}
                onChange={(e) => setCsv(e.target.value)}
                rows={8}
                placeholder="Paste CSV data..."
                style={{ width: "100%", padding: 12, background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, color: C.tx, fontFamily: mn, fontSize: 11, lineHeight: 1.6, resize: "vertical", outline: "none", boxSizing: "border-box" }}
              />
            )}

            {inputMode === "manual" && (
              <div>
                <div style={{ maxHeight: 260, overflow: "auto", border: `1px solid ${C.border}`, borderRadius: 8, background: C.card }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: mn, fontSize: 10 }}>
                    <tbody>
                      {ensureGrid(grid).map((row, ri) => (
                        <tr key={ri}>
                          {row.map((cell, ci) => (
                            <td key={ci} style={{ borderRight: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}`, padding: 0, minWidth: 80 }}>
                              <input
                                value={cell}
                                onChange={(e) => setCell(ri, ci, e.target.value)}
                                style={{ width: "100%", padding: "5px 8px", background: ri === 0 || ci === 0 ? C.surface : "transparent", border: "none", color: ri === 0 || ci === 0 ? C.amber : C.tx, fontFamily: mn, fontSize: 11, fontWeight: ri === 0 || ci === 0 ? 700 : 400, outline: "none", boxSizing: "border-box" }}
                              />
                            </td>
                          ))}
                          <td style={{ padding: 2, background: C.card }}>
                            {grid.length > 2 && (
                              <button onClick={() => removeRow(ri)} title="Delete row" style={miniBtn(C.coral)}>−</button>
                            )}
                          </td>
                        </tr>
                      ))}
                      <tr>
                        {grid[0]?.map((_, ci) => (
                          <td key={ci} style={{ padding: 2, background: C.card, borderRight: `1px solid ${C.border}` }}>
                            {(grid[0]?.length || 0) > 2 && (
                              <button onClick={() => removeCol(ci)} title="Delete column" style={miniBtn(C.coral)}>−</button>
                            )}
                          </td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                  <button onClick={addRow} style={miniBtnText(C.teal)}>+ Row</button>
                  <button onClick={addCol} style={miniBtnText(C.blue)}>+ Column</button>
                </div>
                <div style={{ fontSize: 9, color: C.txd, fontFamily: mn, marginTop: 6 }}>
                  First row + first column are highlighted as headers. All inputs sync to CSV automatically.
                </div>
              </div>
            )}

            {inputMode === "excel" && (
              <div>
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleExcelFile(f);
                  }}
                  style={{ fontFamily: ft, fontSize: 11, color: C.txm, width: "100%", padding: "10px 0" }}
                />
                {xlsxWorkbook && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
                    <div>
                      <div style={{ fontSize: 9, color: C.txd, fontFamily: mn, marginBottom: 4 }}>SHEET</div>
                      <select
                        value={xlsxSheet}
                        onChange={(e) => setXlsxSheet(e.target.value)}
                        style={{ width: "100%", padding: "6px 10px", background: C.card, border: `1px solid ${C.border}`, borderRadius: 6, color: C.tx, fontFamily: ft, fontSize: 12, outline: "none" }}
                      >
                        {xlsxWorkbook.SheetNames.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                    <div>
                      <div style={{ fontSize: 9, color: C.txd, fontFamily: mn, marginBottom: 4 }}>RANGE (optional, e.g. A1:D20)</div>
                      <input
                        value={xlsxRange}
                        onChange={(e) => setXlsxRange(e.target.value)}
                        placeholder="Leave blank for whole sheet"
                        style={inputStyle(C)}
                      />
                    </div>
                    <button onClick={importExcel} style={{ padding: "10px 14px", background: C.amber + "15", border: `1px solid ${C.amber}60`, borderRadius: 6, color: C.amber, fontFamily: ft, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                      Import to Grid
                    </button>
                  </div>
                )}
                {xlsxError && <div style={{ fontSize: 11, color: C.coral, fontFamily: mn, marginTop: 6 }}>{xlsxError}</div>}
                <div style={{ fontSize: 9, color: C.txd, fontFamily: mn, marginTop: 8 }}>
                  .xlsx, .xls, or .csv. Pick the sheet and optional range. Imports into the Manual grid where you can edit before charting.
                </div>
              </div>
            )}
          </Section>

          {/* Chart Type */}
          <Section label="Chart Type">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
              {CHART_KINDS.map((k) => (
                <Pill key={k.key} active={kind === k.key} onClick={() => setKind(k.key)}>{k.label}</Pill>
              ))}
            </div>
          </Section>

          {/* Axes — only for non-pie */}
          {kind !== "pie" && (
            <Section label="Axis Labels" defaultOpen={false}>
              <div style={{ display: "flex", gap: 6, marginBottom: 8, alignItems: "center" }}>
                <Pill active={axisMode === "auto"} onClick={() => setAxisMode("auto")}>Auto</Pill>
                <Pill active={axisMode === "manual"} onClick={() => setAxisMode("manual")}>Manual</Pill>
                <button
                  onClick={flipData}
                  title="Transpose rows and columns (swap series with X labels)"
                  style={{ marginLeft: "auto", padding: "8px 12px", background: C.violet + "15", border: `1px solid ${C.violet}40`, borderRadius: 6, color: C.violet, fontFamily: ft, fontSize: 11, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}
                >
                  ⇅ FLIP
                </button>
              </div>
              {axisMode === "auto" && (
                <div style={{ fontSize: 10, color: C.txd, fontFamily: mn }}>
                  No axis labels. Chart uses the CSV header as implicit categories.
                </div>
              )}
              {axisMode === "manual" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <div>
                    <div style={{ fontSize: 9, color: C.txd, fontFamily: mn, marginBottom: 3 }}>X AXIS</div>
                    <input
                      value={xAxisLabel}
                      onChange={(e) => setXAxisLabel(e.target.value)}
                      placeholder="e.g. Quarter"
                      style={inputStyle(C)}
                    />
                  </div>
                  <div>
                    <div style={{ fontSize: 9, color: C.txd, fontFamily: mn, marginBottom: 3 }}>Y AXIS</div>
                    <input
                      value={yAxisLabel}
                      onChange={(e) => setYAxisLabel(e.target.value)}
                      placeholder="e.g. Market Share (%)"
                      style={inputStyle(C)}
                    />
                  </div>
                </div>
              )}
            </Section>
          )}

          {/* Palette — compact row */}
          <Section label="Palette" defaultOpen={false}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 4 }}>
              {(Object.keys(PALETTES) as PaletteKey[]).map((k) => {
                const p = PALETTES[k];
                const active = palette === k;
                return (
                  <button key={k} onClick={() => setPalette(k)} title={p.blurb} style={{ display: "flex", flexDirection: "column", alignItems: "stretch", gap: 4, padding: "6px 6px", borderRadius: 6, background: active ? C.amber + "15" : C.surface, border: `1px solid ${active ? C.amber + "40" : C.border}`, color: active ? C.amber : C.txm, fontFamily: ft, fontSize: 10, fontWeight: 700, cursor: "pointer" }}>
                    <div style={{ display: "flex", gap: 1.5, width: "100%" }}>
                      {p.colors.slice(0, 6).map((c, i) => (
                        <div key={i} style={{ flex: 1, height: 10, borderRadius: 1, background: c }} />
                      ))}
                    </div>
                    <div style={{ fontSize: 10, color: active ? C.amber : C.tx, textAlign: "center" }}>{p.name}</div>
                  </button>
                );
              })}
            </div>
            <div style={{ fontSize: 9, color: C.txd, fontFamily: mn, marginTop: 4 }}>
              Using S1–S{Math.min(seriesKeys.length, colors.length)} · Grey reserved for gridlines
            </div>
          </Section>

          {/* Style */}
          <Section label="Export Style" defaultOpen={false}>
            <div style={{ display: "flex", gap: 6 }}>
              <Pill active={style === "clean"} onClick={() => setStyle("clean")}>Clean (transparent)</Pill>
              <Pill active={style === "branded"} onClick={() => setStyle("branded")}>SA Branded</Pill>
            </div>
          </Section>

          {style === "branded" && (
            <>
              <Section label="Theme" defaultOpen={false}>
                <div style={{ display: "flex", gap: 6 }}>
                  <Pill active={theme === "dark"} onClick={() => setTheme("dark")}>Dark</Pill>
                  <Pill active={theme === "light"} onClick={() => setTheme("light")}>Light</Pill>
                </div>
              </Section>

              <Section label="Backdrop Gradient" defaultOpen={false}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                  {(Object.keys(BACKDROPS) as BackdropKey[]).map((k) => {
                    const spec = (theme === "light" ? LIGHT_BACKDROPS : BACKDROPS)[k];
                    const active = backdrop === k;
                    const swatch = `linear-gradient(135deg, ${spec.base} 0%, ${spec.glows[0].color.replace(/[\d.]+\)/, "0.8)")} 120%)`;
                    return (
                      <button key={k} onClick={() => setBackdrop(k)} style={{ padding: 0, borderRadius: 8, border: `1px solid ${active ? spec.accent + "80" : C.border}`, background: "transparent", cursor: "pointer", overflow: "hidden", boxShadow: active ? `0 0 0 2px ${spec.accent}25` : "none", transition: "all 0.15s" }}>
                        <div style={{ height: 44, background: swatch, position: "relative" }}>
                          <div style={{ position: "absolute", top: 6, left: 8, width: 16, height: 2, background: spec.accent }} />
                        </div>
                        <div style={{ padding: "6px 10px", fontFamily: ft, fontSize: 10, fontWeight: 700, color: active ? spec.accent : C.txm, textAlign: "left" }}>{spec.name}</div>
                      </button>
                    );
                  })}
                </div>
              </Section>

              <Section label="Chart Title" defaultOpen={false}>
                <div style={{ fontSize: 9, color: C.txd, fontFamily: mn, marginBottom: 4 }}>
                  Large headline shown above the chart in branded mode
                </div>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Accelerator Market Share"
                  style={{ ...inputStyle(C), fontSize: 14, fontWeight: 700, padding: "10px 12px" }}
                />
              </Section>

              <Section label="Source Text" defaultOpen={false}>
                <div style={{ fontSize: 9, color: C.txd, fontFamily: mn, marginBottom: 4 }}>
                  Citation/attribution shown at the bottom-left of the exported chart
                </div>
                <input
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                  placeholder="e.g. Source: SemiAnalysis Accelerator Model"
                  style={{ ...inputStyle(C), fontFamily: mn, fontSize: 11 }}
                />
              </Section>
            </>
          )}

          {/* Actions */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <button onClick={handleExport} disabled={exporting} style={primaryBtn(C, exporting)}>
              {exporting ? "Exporting..." : "Download PNG"}
            </button>
            <button onClick={handleSaveArchive} disabled={saveStatus === "saving"} style={secondaryBtn(C, saveStatus)}>
              {saveStatus === "saving" ? "Saving..." : saveStatus === "saved" ? "Saved to Archive" : "Save to Archive"}
            </button>
          </div>
        </div>

        {/* ═══ PREVIEW ═══ */}
        <div>
          <div style={{ fontFamily: mn, fontSize: 10, color: C.amber, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 10 }}>Preview</div>
          <div ref={chartRef} style={{ width: "100%", minHeight: 600, borderRadius: 14, padding: 40, background: previewBg, border: `1px solid ${style === "branded" ? "rgba(255,255,255,0.08)" : C.border}`, boxShadow: "0 8px 40px rgba(0,0,0,0.25)", position: "relative", overflow: "hidden" }}>
            {style === "branded" && (
              <>
                {bdSpec.glows.map((g, i) => (
                  <div key={i} style={{ position: "absolute", inset: 0, background: `radial-gradient(circle at ${g.x * 100}% ${g.y * 100}%, ${g.color}, transparent 65%)`, pointerEvents: "none" }} />
                ))}
                <div style={{ position: "relative", marginBottom: 16 }}>
                  <div style={{ width: 50, height: 3, background: bdSpec.accent, marginBottom: 14 }} />
                  <div style={{ fontFamily: ft, fontSize: 26, fontWeight: 900, color: previewTitleColor, letterSpacing: -0.5 }}>{title || "Chart Title"}</div>
                </div>
              </>
            )}
            <div style={{ position: "relative" }}>
              {/* Rotated Y axis label — tight against the Y-axis ticks */}
              {axisMode === "manual" && !!yAxisLabel && kind !== "pie" && kind !== "hbar" && (
                <div style={{ position: "absolute", left: 12, top: "50%", transform: "translate(-50%, -50%) rotate(-90deg)", fontFamily: ft, fontSize: 13, fontWeight: 700, color: theme === "light" ? "#1A1A1A" : "#E8E4DD", whiteSpace: "nowrap", pointerEvents: "none" }}>
                  {yAxisLabel}
                </div>
              )}
              {renderChart()}
              {/* X axis name ABOVE the legend (matches export layout) */}
              {axisMode === "manual" && !!xAxisLabel && kind !== "pie" && (
                <div style={{ textAlign: "center", marginTop: 2, fontFamily: ft, fontSize: 13, fontWeight: 700, color: theme === "light" ? "#1A1A1A" : "#E8E4DD" }}>
                  {xAxisLabel}
                </div>
              )}
              {/* HTML legend below the X-axis name */}
              {kind !== "pie" && seriesKeys.length > 0 && (
                <div style={{ display: "flex", justifyContent: "center", flexWrap: "wrap", gap: 20, marginTop: 10, fontFamily: ft, fontSize: 13, fontWeight: 600, color: theme === "light" ? "#1A1A1A" : "#E8E4DD" }}>
                  {seriesKeys.map((k, i) => (
                    <div key={k} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <div style={{ width: 12, height: 12, borderRadius: 2, background: colors[i % colors.length] }} />
                      <span>{k}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {style === "branded" && (
              <div style={{ position: "absolute", bottom: 18, left: 40, right: 40, display: "flex", justifyContent: "space-between", alignItems: "center", fontFamily: mn, fontSize: 10 }}>
                <span style={{ color: previewSourceColor }}>{source}</span>
                <span style={{ color: bdSpec.accent, fontWeight: 700, letterSpacing: 1.5 }}>SEMIANALYSIS</span>
              </div>
            )}
          </div>
          {/* Toolbar: compact — scale hides behind button, show-values + y-max always visible */}
          <ChartToolbar
            userScale={userScale}
            setUserScale={setUserScale}
            showValues={showValues}
            setShowValues={setShowValues}
            yMaxInput={yMaxInput}
            setYMaxInput={setYMaxInput}
          />
          <div style={{ fontFamily: mn, fontSize: 10, color: C.txd, marginTop: 8 }}>
            {parsed.rows.length} rows · {seriesKeys.length} series · {PALETTES[palette].name} · {style === "branded" ? `1920×1080 ${bdSpec.name} backdrop` : "1600×900 transparent"} · Scale {userScale.toFixed(2)}×{showValues ? " · values on" : ""}
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══ HELPERS ═══
function Section({ label, children, defaultOpen = true, collapsible = true }: { label: string; children: React.ReactNode; defaultOpen?: boolean; collapsible?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const isOpen = collapsible ? open : true;
  return (
    <div style={{ borderBottom: `1px solid ${C.border}`, paddingBottom: isOpen ? 10 : 0, marginBottom: 2 }}>
      <button
        onClick={() => collapsible && setOpen(!open)}
        style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", background: "transparent", border: "none", cursor: collapsible ? "pointer" : "default", textAlign: "left" }}
      >
        <span style={{ fontFamily: mn, fontSize: 9, color: C.amber, textTransform: "uppercase", letterSpacing: 1.5 }}>{label}</span>
        {collapsible && <span style={{ fontFamily: mn, fontSize: 10, color: C.txd, transition: "transform 0.2s", transform: isOpen ? "rotate(90deg)" : "rotate(0deg)" }}>▸</span>}
      </button>
      {isOpen && <div>{children}</div>}
    </div>
  );
}

function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} style={{ padding: "8px 12px", borderRadius: 6, background: active ? C.amber + "15" : C.surface, border: `1px solid ${active ? C.amber + "40" : C.border}`, color: active ? C.amber : C.txm, fontFamily: ft, fontSize: 11, fontWeight: 600, cursor: "pointer", transition: "all 0.15s" }}>
      {children}
    </button>
  );
}

function Empty() {
  return (
    <div style={{ height: 520, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: ft, fontSize: 13, color: C.txd }}>
      Paste CSV data to see the chart
    </div>
  );
}

function ChartToolbar({
  userScale, setUserScale, showValues, setShowValues, yMaxInput, setYMaxInput,
}: {
  userScale: number; setUserScale: (n: number) => void;
  showValues: boolean; setShowValues: (b: boolean) => void;
  yMaxInput: string; setYMaxInput: (s: string) => void;
}) {
  const [scaleOpen, setScaleOpen] = useState(false);
  return (
    <div style={{ marginTop: 10, padding: "8px 12px", background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
      {/* Scale — collapsed icon button, expands into slider */}
      {!scaleOpen ? (
        <button onClick={() => setScaleOpen(true)} title="Adjust chart scale" style={{ padding: "4px 10px", background: userScale !== 1 ? C.amber + "15" : "transparent", border: `1px solid ${userScale !== 1 ? C.amber + "40" : C.border}`, borderRadius: 6, color: userScale !== 1 ? C.amber : C.txm, fontFamily: mn, fontSize: 10, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
          ⚖ Scale {userScale !== 1 ? `${userScale.toFixed(2)}×` : ""}
        </button>
      ) : (
        <div style={{ display: "flex", alignItems: "center", gap: 8, flex: "1 1 280px" }}>
          <span style={{ fontFamily: mn, fontSize: 9, color: C.txd, letterSpacing: 1.5, textTransform: "uppercase" }}>Scale</span>
          <input type="range" min={0.7} max={1.5} step={0.05} value={userScale} onChange={(e) => setUserScale(Number(e.target.value))} style={{ flex: 1, accentColor: C.amber }} />
          <span style={{ fontFamily: mn, fontSize: 11, color: C.amber, minWidth: 42, textAlign: "right" }}>{userScale.toFixed(2)}×</span>
          <button onClick={() => setUserScale(1.0)} title="Reset" style={{ padding: "2px 6px", background: "transparent", border: `1px solid ${C.border}`, borderRadius: 4, color: C.txm, fontFamily: mn, fontSize: 9, cursor: "pointer" }}>1×</button>
          <button onClick={() => setScaleOpen(false)} title="Collapse" style={{ padding: "2px 6px", background: "transparent", border: "none", color: C.txd, fontFamily: mn, fontSize: 14, cursor: "pointer", lineHeight: 1 }}>×</button>
        </div>
      )}
      <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontFamily: mn, fontSize: 10, color: showValues ? C.teal : C.txm }}>
        <input type="checkbox" checked={showValues} onChange={(e) => setShowValues(e.target.checked)} style={{ accentColor: C.teal }} />
        Values
      </label>
      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
        <span style={{ fontFamily: mn, fontSize: 9, color: C.txd, letterSpacing: 1.2, textTransform: "uppercase" }}>Y-max</span>
        <input value={yMaxInput} onChange={(e) => setYMaxInput(e.target.value.replace(/[^\d.]/g, ""))} placeholder="auto" style={{ width: 60, padding: "3px 8px", background: C.bg, border: `1px solid ${C.border}`, borderRadius: 5, color: C.tx, fontFamily: mn, fontSize: 11, outline: "none" }} />
      </div>
    </div>
  );
}

function inputStyle(C: { card: string; border: string; tx: string }): React.CSSProperties {
  return { width: "100%", padding: "8px 10px", background: C.card, border: `1px solid ${C.border}`, borderRadius: 6, color: C.tx, fontFamily: ft, fontSize: 12, outline: "none", boxSizing: "border-box" };
}

function primaryBtn(C: { amber: string; bg: string }, disabled: boolean): React.CSSProperties {
  return { padding: "12px 20px", background: C.amber, border: "none", borderRadius: 8, color: C.bg, fontFamily: ft, fontSize: 13, fontWeight: 800, cursor: disabled ? "wait" : "pointer", opacity: disabled ? 0.6 : 1, transition: "all 0.15s" };
}

function secondaryBtn(C: { violet: string; teal: string; surface: string; border: string }, state: string): React.CSSProperties {
  const isSaved = state === "saved";
  return { padding: "10px 16px", background: isSaved ? C.teal + "15" : C.surface, border: `1px solid ${isSaved ? C.teal + "40" : C.border}`, borderRadius: 8, color: isSaved ? C.teal : C.violet, fontFamily: ft, fontSize: 12, fontWeight: 700, cursor: state === "saving" ? "wait" : "pointer", transition: "all 0.15s" };
}

function miniBtn(color: string): React.CSSProperties {
  return { width: 20, height: 20, borderRadius: 4, background: "transparent", border: `1px solid ${color}40`, color, fontFamily: mn, fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 };
}
function miniBtnText(color: string): React.CSSProperties {
  return { padding: "5px 10px", background: "transparent", border: `1px solid ${color}40`, borderRadius: 5, color, fontFamily: mn, fontSize: 10, fontWeight: 700, cursor: "pointer" };
}
