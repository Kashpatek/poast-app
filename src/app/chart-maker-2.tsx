"use client";
import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { D as C, ft, gf, mn } from "./shared-constants";
import { showToast } from "./toast-context";
// Wave 14.2 · Univer (full Excel-grade spreadsheet) · The CSS bundle for the
// Univer presets ships as a flat ~80 KB stylesheet. We import it eagerly so
// that when the user toggles EXCEL SUITE in Launch mode, all of Univer's UI
// (formula bar, ribbon, sheet tabs, find/replace, conditional formatting)
// renders styled instantly without a CSS race. The Univer JS itself
// (~3 MB) is still loaded lazily inside UniverSheetPane via dynamic import,
// so initial route weight is unaffected.
import "@univerjs/preset-sheets-core/lib/index.css";
import {
  Calendar, Download, Eye, EyeOff, Plus, X, ChevronUp, ChevronDown,
  BarChart3, Columns3, AlignVerticalDistributeCenter, AlignVerticalJustifyCenter,
  TrendingUp, TrendingDown, Grid3x3, GitBranch,
  LineChart, Activity, Layers,
  PieChart, Disc, ScatterChart, Circle,
  GanttChart,
  Undo2, Redo2, Hash, Sigma, ArrowUpDown, Minus, Trash2,
  FileCode2, ArrowLeftRight, ArrowLeft, Square, Diamond, MinusSquare,
  ClipboardPaste, Sparkles, Type, Keyboard, X as XIcon,
  Palette, Lock, Unlock, Table, ChevronLeft, ChevronRight,
  Maximize2, Minimize2, Settings, Image as ImageIcon, Columns2, Rows2, Rocket,
  CornerUpLeft, Repeat, ArrowDownUp, MoveHorizontal, Upload, FileSpreadsheet,
  Volume2, VolumeX, Sun, Moon, HelpCircle, Pipette, Check,
  GripVertical, Pin, PinOff, ZoomIn, ZoomOut, Wrench,
} from "lucide-react";

// ═══════════════════════════════════════════════════════════════════════════
// CHART TYPE REGISTRY · maps the chart-type grid to in-app renderers
// ═══════════════════════════════════════════════════════════════════════════

type ChartType =
  | "stacked" | "pct" | "clustered" | "wfup" | "wfdn"
  | "mekkoPct" | "combo" | "line" | "stackedArea" | "pctArea"
  | "mekkoUnit" | "pie" | "doughnut" | "scatter" | "bubble"
  | "variance" | "gantt";

type ThemeId = "saCore" | "saSpectrum" | "saBrand";

// Official SemiAnalysis chart palettes — verbatim from the brand spec.
// Use S1-S4 for ≤4 series, S5-S8 for 5-8, S9-S12 for 9+. Never skip
// ahead, never mix Core and Spectrum in one chart.
const THEMES: Record<ThemeId, { name: string; sub: string; colors: string[] }> = {
  saCore: {
    name: "SA Core",
    sub: "Amber + Cobalt family · default",
    colors: [
      "#F7B041", // S1 Amber
      "#0B86D1", // S2 Cobalt
      "#2EAD8E", // S3 Mint
      "#E06347", // S4 Coral
      "#AC7B2D", // S5 Amber 600
      "#075D92", // S6 Cobalt 600
      "#F9C370", // S7 Amber 300
      "#48A4DC", // S8 Cobalt 300
      "#7B5820", // S9 Amber 700
      "#054368", // S10 Cobalt 700
      "#FAD396", // S11 Amber 200
      "#78BCE5", // S12 Cobalt 200
    ],
  },
  saSpectrum: {
    name: "SA Spectrum",
    sub: "Full hue wheel · for 5+ series with distinct hues",
    colors: [
      "#F7B041", // S1 Amber
      "#0B86D1", // S2 Cobalt
      "#2EAD8E", // S3 Mint
      "#E06347", // S4 Coral
      "#905CCB", // S5 Violet
      "#26C9D8", // S6 Cyan
      "#D1334A", // S7 Crimson
      "#56BC42", // S8 Sage
      "#D34574", // S9 Rose
      "#E8C83A", // S10 Sunflower
      "#495BCE", // S11 Indigo
      "#BF49B5", // S12 Magenta
    ],
  },
  saBrand: {
    name: "SA Brand",
    sub: "Official SA template palette · Excel-matched",
    colors: [
      "#4472C4", // S1  Primary Blue
      "#ED7D31", // S2  Orange
      "#70AD47", // S3  Green
      "#FFC000", // S4  Gold
      "#5B9BD5", // S5  Light Blue
      "#A5A5A5", // S6  Gray
      "#44546A", // S7  Charcoal
      "#264478", // S8  Navy (darker primary)
      "#9E480E", // S9  Burnt orange
      "#43682B", // S10 Dark green
      "#7F6000", // S11 Olive
      "#2E4D70", // S12 Steel
    ],
  },
};

// Neutral colors per the SA spec — for gridlines, axes, "Other" pie
// slices, table headers. NEVER use as a data series color.
const SA_SLATE = "#3D3D3D";
const SA_METAL = "#969696";

// ─── Backdrops · ported from ChartMaker 1 ──────────────────────────────────
// Each backdrop = base color + 1-2 radial glow stops. Two halves: dark (for
// SA decks) and light (for client one-pagers). The chart preview card and
// the PNG export pipeline both honor the same spec so the saved image
// matches what the user sees.
type BackdropKey = "amber" | "cobalt" | "both" | "capital";
type BackdropMode = "dark" | "light";
interface BackdropSpec { name: string; base: string; glows: Array<{ x: number; y: number; r: number; color: string }>; accent: string }

const BACKDROPS_DARK: Record<BackdropKey, BackdropSpec> = {
  amber:   { name: "Amber",         base: "#06060C", accent: "#F7B041", glows: [{ x: 0.85, y: 0.15, r: 0.70, color: "rgba(247,176,65,0.22)" }, { x: 0.15, y: 0.85, r: 0.55, color: "rgba(247,176,65,0.10)" }] },
  cobalt:  { name: "Cobalt",        base: "#06060C", accent: "#0B86D1", glows: [{ x: 0.85, y: 0.15, r: 0.70, color: "rgba(11,134,209,0.22)" }, { x: 0.15, y: 0.85, r: 0.55, color: "rgba(11,134,209,0.10)" }] },
  both:    { name: "Amber + Cobalt", base: "#06060C", accent: "#F7B041", glows: [{ x: 0.85, y: 0.15, r: 0.70, color: "rgba(247,176,65,0.18)" }, { x: 0.10, y: 0.90, r: 0.60, color: "rgba(11,134,209,0.14)" }] },
  capital: { name: "Capital (Teal)", base: "#06120F", accent: "#2EAD8E", glows: [{ x: 0.85, y: 0.15, r: 0.70, color: "rgba(46,173,142,0.22)" }, { x: 0.15, y: 0.90, r: 0.55, color: "rgba(122,207,186,0.12)" }] },
};
const BACKDROPS_LIGHT: Record<BackdropKey, BackdropSpec> = {
  amber:   { name: "Amber",         base: "#FAFAF7", accent: "#F7B041", glows: [{ x: 0.90, y: 0.10, r: 0.60, color: "rgba(247,176,65,0.18)" }, { x: 0.10, y: 0.90, r: 0.50, color: "rgba(247,176,65,0.08)" }] },
  cobalt:  { name: "Cobalt",        base: "#F7FAFC", accent: "#0B86D1", glows: [{ x: 0.90, y: 0.10, r: 0.60, color: "rgba(11,134,209,0.16)" }, { x: 0.10, y: 0.90, r: 0.50, color: "rgba(11,134,209,0.08)" }] },
  both:    { name: "Amber + Cobalt", base: "#FAFAF7", accent: "#F7B041", glows: [{ x: 0.90, y: 0.10, r: 0.60, color: "rgba(247,176,65,0.16)" }, { x: 0.10, y: 0.90, r: 0.50, color: "rgba(11,134,209,0.10)" }] },
  capital: { name: "Capital (Teal)", base: "#F5FAF8", accent: "#2EAD8E", glows: [{ x: 0.90, y: 0.10, r: 0.60, color: "rgba(46,173,142,0.18)" }, { x: 0.10, y: 0.90, r: 0.50, color: "rgba(122,207,186,0.08)" }] },
};

// Build a CSS background for the given backdrop spec — base color +
// stacked radial gradients at the configured glow stops.
function backdropCss(spec: BackdropSpec, w = 100, h = 100): string {
  const stops = spec.glows.map(g => `radial-gradient(circle at ${(g.x * w).toFixed(0)}% ${(g.y * h).toFixed(0)}%, ${g.color} 0%, transparent ${(g.r * 100).toFixed(0)}%)`);
  return [...stops, spec.base].join(", ");
}

// ─── Sample data per chart type ────────────────────────────────────────────
type CellValue = string | number;
interface ColumnSpec { key: string; label: string; type: "text" | "number" | "date" | "percent" }
interface DataSheet { schema: ColumnSpec[]; rows: Array<Record<string, CellValue>> }

function samplePerType(type: ChartType): DataSheet {
  switch (type) {
    case "stacked":
    case "clustered":
    case "pct":
    case "line":
    case "stackedArea":
    case "pctArea":
    case "combo":
      return {
        schema: [
          { key: "category", label: "Category", type: "text" },
          { key: "s1", label: "NV", type: "number" },
          { key: "s2", label: "AMD", type: "number" },
          { key: "s3", label: "TPU", type: "number" },
        ],
        rows: [
          { category: "Q1 '25", s1: 145, s2: 32, s3: 78 },
          { category: "Q2 '25", s1: 168, s2: 41, s3: 92 },
          { category: "Q3 '25", s1: 184, s2: 48, s3: 115 },
          { category: "Q4 '25", s1: 210, s2: 56, s3: 138 },
          { category: "Q1 '26", s1: 232, s2: 62, s3: 165 },
        ],
      };
    case "wfup":
      return {
        schema: [
          { key: "category", label: "Step", type: "text" },
          { key: "value", label: "Δ", type: "number" },
        ],
        rows: [
          { category: "Start", value: 100 },
          { category: "Add A", value: 35 },
          { category: "Add B", value: 18 },
          { category: "Subtract C", value: -12 },
          { category: "Add D", value: 22 },
          { category: "End", value: 163 },
        ],
      };
    case "wfdn":
      return {
        schema: [
          { key: "category", label: "Step", type: "text" },
          { key: "value", label: "Δ", type: "number" },
        ],
        rows: [
          { category: "Revenue", value: 220 },
          { category: "COGS", value: -68 },
          { category: "OpEx", value: -42 },
          { category: "Tax", value: -25 },
          { category: "One-offs", value: -8 },
          { category: "Net", value: 77 },
        ],
      };
    case "variance":
      return {
        schema: [
          { key: "category", label: "Period", type: "text" },
          { key: "ac", label: "AC", type: "number" },
          { key: "py", label: "PY", type: "number" },
        ],
        rows: [
          { category: "Q1", ac: 145, py: 132 },
          { category: "Q2", ac: 168, py: 150 },
          { category: "Q3", ac: 184, py: 192 },
          { category: "Q4", ac: 210, py: 188 },
          { category: "FY", ac: 707, py: 662 },
        ],
      };
    case "mekkoPct":
    case "mekkoUnit":
      return {
        schema: [
          { key: "category", label: "Segment", type: "text" },
          { key: "weight", label: "Total", type: "number" },
          { key: "s1", label: "A", type: "number" },
          { key: "s2", label: "B", type: "number" },
          { key: "s3", label: "C", type: "number" },
        ],
        rows: [
          { category: "Hyperscalers", weight: 60, s1: 38, s2: 14, s3: 8 },
          { category: "Enterprise", weight: 25, s1: 8, s2: 12, s3: 5 },
          { category: "Govt", weight: 10, s1: 2, s2: 4, s3: 4 },
          { category: "Other", weight: 5, s1: 1, s2: 2, s3: 2 },
        ],
      };
    case "pie":
    case "doughnut":
      return {
        schema: [
          { key: "label", label: "Label", type: "text" },
          { key: "value", label: "Value", type: "number" },
        ],
        rows: [
          { label: "NV", value: 78 },
          { label: "AMD", value: 12 },
          { label: "Apple", value: 5 },
          { label: "TPU", value: 3 },
          { label: "Other", value: 2 },
        ],
      };
    case "scatter":
    case "bubble":
      return {
        schema: [
          { key: "label", label: "Label", type: "text" },
          { key: "x", label: "X", type: "number" },
          { key: "y", label: "Y", type: "number" },
          { key: "size", label: "Size", type: "number" },
        ],
        rows: [
          { label: "H100", x: 80, y: 4000, size: 100 },
          { label: "H200", x: 141, y: 4900, size: 80 },
          { label: "B200", x: 192, y: 9000, size: 60 },
          { label: "MI300X", x: 192, y: 1300, size: 30 },
          { label: "MI325X", x: 256, y: 1300, size: 25 },
        ],
      };
    case "gantt":
      return {
        schema: [
          { key: "task", label: "Task", type: "text" },
          { key: "start", label: "Start", type: "date" },
          { key: "end", label: "End", type: "date" },
          { key: "group", label: "Group", type: "text" },
          { key: "owner", label: "Owner", type: "text" },
          { key: "progress", label: "%", type: "percent" },
        ],
        rows: [
          { task: "Plan launch", start: "2026-01-05", end: "2026-01-19", group: "Phase 1 · Discovery", owner: "Akash", progress: 100 },
          { task: "Customer interviews", start: "2026-01-12", end: "2026-02-02", group: "Phase 1 · Discovery", owner: "Vansh", progress: 100 },
          { task: "Brand kit refresh", start: "2026-01-26", end: "2026-02-23", group: "Phase 1 · Discovery", owner: "Michelle", progress: 75 },
          { task: "Build CRM pipeline", start: "2026-02-09", end: "2026-04-06", group: "Phase 2 · Build", owner: "Vansh", progress: 45 },
          { task: "Press deck", start: "2026-02-23", end: "2026-03-30", group: "Phase 2 · Build", owner: "Akash", progress: 60 },
          { task: "Launch event prep", start: "2026-03-16", end: "2026-04-20", group: "Phase 2 · Build", owner: "Michelle", progress: 20 },
          { task: "Soft launch", start: "2026-04-13", end: "2026-04-20", group: "Phase 3 · Launch", owner: "Akash", progress: 0 },
          { task: "Public launch", start: "2026-04-27", end: "2026-04-27", group: "Phase 3 · Launch", owner: "Akash", progress: 0 },
          { task: "Week-1 retro", start: "2026-05-04", end: "2026-05-11", group: "Phase 3 · Launch", owner: "Vansh", progress: 0 },
        ],
      };
  }
}

// ─── Type registry: icon, label, working flag ──────────────────────────────
type LucideIcon = React.ComponentType<{ size?: number | string; strokeWidth?: number; color?: string }>;

interface TypeSpec { id: ChartType; label: string; Icon: LucideIcon; working: boolean }

const TYPES: TypeSpec[][] = [
  [
    { id: "stacked",     label: "Stacked",    Icon: Columns3,                         working: true  },
    { id: "pct",         label: "100%",       Icon: AlignVerticalJustifyCenter,       working: true  },
    { id: "clustered",   label: "Clustered",  Icon: AlignVerticalDistributeCenter,    working: true  },
    { id: "wfup",        label: "Waterfall +", Icon: TrendingUp,                      working: true  },
    { id: "wfdn",        label: "Waterfall −", Icon: TrendingDown,                    working: true  },
    { id: "variance",    label: "Variance (AC vs PY)", Icon: ArrowLeftRight,          working: true  },
  ],
  [
    { id: "mekkoPct",    label: "Mekko %",    Icon: Grid3x3,                          working: true  },
    { id: "combo",       label: "Combo",      Icon: GitBranch,                        working: true  },
    { id: "line",        label: "Line",       Icon: LineChart,                        working: true  },
    { id: "stackedArea", label: "Stacked Area", Icon: Layers,                         working: true  },
    { id: "pctArea",     label: "100% Area",  Icon: Activity,                         working: true  },
  ],
  [
    { id: "mekkoUnit",   label: "Mekko Unit", Icon: BarChart3,                        working: true  },
    { id: "pie",         label: "Pie",        Icon: PieChart,                         working: true  },
    { id: "doughnut",    label: "Doughnut",   Icon: Disc,                             working: true  },
    { id: "scatter",     label: "Scatter",    Icon: ScatterChart,                     working: true  },
    { id: "bubble",      label: "Bubble",     Icon: Circle,                           working: true  },
  ],
  [
    { id: "gantt",       label: "Gantt",      Icon: GanttChart,                       working: true  },
  ],
];

// ═══════════════════════════════════════════════════════════════════════════
// LIBREOFFICE-CALC-STYLE DATASHEET · column letters, row numbers, formula
// bar, cell selection, basic formulas (=A1+B2 / =SUM(A1:A5) / =AVG / =MIN /
// =MAX / =COUNT). Slider mode lets you control number cells with a slider
// instead of typing.
// ═══════════════════════════════════════════════════════════════════════════

// 0=A, 1=B, 25=Z, 26=AA, 27=AB...
function colLetter(idx: number): string {
  let s = ""; let n = idx;
  while (true) { s = String.fromCharCode(65 + (n % 26)) + s; n = Math.floor(n / 26) - 1; if (n < 0) break; }
  return s;
}
// Parse a cell address like "A1", "AB42", or absolute "$A$1" / "$A1" / "A$1"
// into {col, row}. Zero-indexed. The $ markers are stripped (we don't track
// absolute vs relative because there's no fill-down auto-shift in this app).
function parseCellRef(ref: string): { col: number; row: number } | null {
  const m = ref.match(/^\$?([A-Z]+)\$?(\d+)$/);
  if (!m) return null;
  let col = 0;
  for (const ch of m[1]) col = col * 26 + (ch.charCodeAt(0) - 64);
  return { col: col - 1, row: parseInt(m[2], 10) - 1 };
}
// Resolve a single cell ref against a sheet, returning its raw numeric
// value (formulas are recursively evaluated, with a depth cap to break
// reference cycles).
function resolveCell(ref: string, sheet: DataSheet, depth = 0): number {
  if (depth > 16) return 0;
  const p = parseCellRef(ref);
  if (!p) return 0;
  const colKey = sheet.schema[p.col]?.key;
  if (!colKey) return 0;
  const v = sheet.rows[p.row]?.[colKey];
  if (typeof v === "number") return v;
  if (typeof v === "string" && v.startsWith("=")) {
    const r = evalFormula(v, sheet, depth + 1);
    return typeof r === "number" ? r : 0;
  }
  const n = Number(v);
  return isNaN(n) ? 0 : n;
}
// Expand a range "A1:B5" into a flat array of resolved numeric values.
function expandRange(start: string, end: string, sheet: DataSheet, depth: number): number[] {
  const a = parseCellRef(start), b = parseCellRef(end);
  if (!a || !b) return [];
  const out: number[] = [];
  for (let r = a.row; r <= b.row; r++) {
    for (let c = a.col; c <= b.col; c++) {
      const ref = colLetter(c) + (r + 1);
      out.push(resolveCell(ref, sheet, depth + 1));
    }
  }
  return out;
}

// Resolve a 2D range "A1:D5" into a 2D array of raw cell values (string|number).
function resolveRange2D(rangeStr: string, sheet: DataSheet): (string | number)[][] {
  const parts = rangeStr.trim().split(":");
  if (parts.length !== 2) return [];
  const a = parseCellRef(parts[0].trim());
  const b = parseCellRef(parts[1].trim());
  if (!a || !b) return [];
  const out: (string | number)[][] = [];
  for (let r = a.row; r <= b.row; r++) {
    const row: (string | number)[] = [];
    for (let c = a.col; c <= b.col; c++) {
      const colKey = sheet.schema[c]?.key;
      if (!colKey) { row.push(""); continue; }
      const v = sheet.rows[r]?.[colKey];
      row.push(v === undefined ? "" : v);
    }
    out.push(row);
  }
  return out;
}

// Evaluate a criteria string like ">5", "<10", ">=3", "text", "=5" against a value.
function evalCriteria(criteria: string, val: string | number): boolean {
  const c = String(criteria).trim();
  const n = Number(val);
  const ops: Array<[string, (a: number, b: number) => boolean]> = [
    [">=", (a, b) => a >= b], ["<=", (a, b) => a <= b],
    ["<>", (a, b) => a !== b], [">", (a, b) => a > b],
    ["<", (a, b) => a < b], ["=", (a, b) => a === b],
  ];
  for (const [op, fn] of ops) {
    if (c.startsWith(op)) {
      const rhs = Number(c.slice(op.length));
      if (!isNaN(rhs) && !isNaN(n)) return fn(n, rhs);
      return String(val) === c.slice(op.length);
    }
  }
  // Exact match
  if (!isNaN(Number(c)) && !isNaN(n)) return n === Number(c);
  return String(val).toLowerCase() === c.toLowerCase();
}
// Evaluate a formula string. Supports SUM / AVG / AVERAGE / MIN / MAX /
// COUNT and basic arithmetic with cell references (A1 + B2 etc).
function evalFormula(expr: string, sheet: DataSheet, depth = 0): number | string {
  if (depth > 16) return "#CYC";
  const e = (expr.startsWith("=") ? expr.slice(1) : expr).trim();
  if (!e) return "";
  try {
    let s = e;

    // TODAY() — return ISO date string
    s = s.replace(/TODAY\s*\(\s*\)/gi, () => {
      const d = new Date(); return '"' + d.toISOString().slice(0, 10) + '"';
    });

    // CONCAT / CONCATENATE(a, b, ...)
    s = s.replace(/(?:CONCAT|CONCATENATE)\s*\(([^)]+)\)/gi, (_, body) => {
      const parts = body.split(",").map((p: string) => {
        const t = p.trim();
        const ref = parseCellRef(t);
        if (ref) {
          const colKey = sheet.schema[ref.col]?.key;
          return colKey ? String(sheet.rows[ref.row]?.[colKey] ?? "") : "";
        }
        return t.replace(/^["']|["']$/g, "");
      });
      return '"' + parts.join("") + '"';
    });

    // VLOOKUP(lookup, A1:D5, col_index, [0]) — supports $ absolute refs
    s = s.replace(/VLOOKUP\s*\(([^,]+),\s*(\$?[A-Z]+\$?\d+:\$?[A-Z]+\$?\d+)\s*,\s*(\d+)(?:\s*,\s*[^)]+)?\)/gi, (_, lookupRaw, rangeStr, colIdxRaw) => {
      const lookup = lookupRaw.trim().replace(/^["']|["']$/g, "");
      const colIdx = parseInt(colIdxRaw, 10) - 1;
      const table = resolveRange2D(rangeStr, sheet);
      for (const row of table) {
        if (evalCriteria(lookup, row[0] as string | number)) {
          const v = row[colIdx];
          return v !== undefined ? String(v) : "#N/A";
        }
      }
      return "0";
    });

    // HLOOKUP(lookup, A1:D5, row_index, [0]) — like VLOOKUP but searches first row
    s = s.replace(/HLOOKUP\s*\(([^,]+),\s*(\$?[A-Z]+\$?\d+:\$?[A-Z]+\$?\d+)\s*,\s*(\d+)(?:\s*,\s*[^)]+)?\)/gi, (_, lookupRaw, rangeStr, rowIdxRaw) => {
      const lookup = lookupRaw.trim().replace(/^["']|["']$/g, "");
      const rowIdx = parseInt(rowIdxRaw, 10) - 1;
      const table = resolveRange2D(rangeStr, sheet);
      if (!table[0]) return "#N/A";
      for (let c = 0; c < table[0].length; c++) {
        if (evalCriteria(lookup, table[0][c] as string | number)) {
          const v = table[rowIdx]?.[c];
          return v !== undefined ? String(v) : "#N/A";
        }
      }
      return "0";
    });

    // INDEX(A1:D5, row, col)
    s = s.replace(/INDEX\s*\((\$?[A-Z]+\$?\d+:\$?[A-Z]+\$?\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/gi, (_, rangeStr, rowRaw, colRaw) => {
      const rowIdx = parseInt(rowRaw, 10) - 1;
      const colIdx = parseInt(colRaw, 10) - 1;
      const table = resolveRange2D(rangeStr, sheet);
      const v = table[rowIdx]?.[colIdx];
      return v !== undefined ? String(v) : "0";
    });

    // MATCH(lookup, A1:A5, [0])
    s = s.replace(/MATCH\s*\(([^,]+),\s*(\$?[A-Z]+\$?\d+:\$?[A-Z]+\$?\d+)(?:\s*,\s*[^)]+)?\)/gi, (_, lookupRaw, rangeStr) => {
      const lookup = lookupRaw.trim().replace(/^["']|["']$/g, "");
      const table = resolveRange2D(rangeStr, sheet);
      // flatten to 1D
      const flat = table.flat();
      for (let i = 0; i < flat.length; i++) {
        if (evalCriteria(lookup, flat[i] as string | number)) return String(i + 1);
      }
      return "0";
    });

    // SUMIFS(sum_range, crit_range1, crit1, [crit_range2, crit2, ...])
    s = s.replace(/SUMIFS\s*\((\$?[A-Z]+\$?\d+:\$?[A-Z]+\$?\d+)((?:\s*,\s*\$?[A-Z]+\$?\d+:\$?[A-Z]+\$?\d+\s*,\s*[^,)]+)+)\s*\)/gi, (_, sumRange, rest) => {
      const sumVals = resolveRange2D(sumRange, sheet).flat();
      // Parse pairs (range, criteria) from rest
      const pairs: Array<{ range: string; crit: string }> = [];
      const re = /,\s*(\$?[A-Z]+\$?\d+:\$?[A-Z]+\$?\d+)\s*,\s*([^,)]+)/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(rest)) !== null) {
        pairs.push({ range: m[1], crit: m[2].trim().replace(/^["']|["']$/g, "") });
      }
      const checkArrays = pairs.map(p => resolveRange2D(p.range, sheet).flat());
      let total = 0;
      for (let i = 0; i < sumVals.length; i++) {
        const allMatch = pairs.every((p, pi) => evalCriteria(p.crit, checkArrays[pi][i] as string | number));
        if (allMatch) total += Number(sumVals[i]) || 0;
      }
      return String(total);
    });

    // SUMIF(A1:A5, criteria, B1:B5)
    s = s.replace(/SUMIF\s*\((\$?[A-Z]+\$?\d+:\$?[A-Z]+\$?\d+)\s*,\s*([^,]+)\s*,\s*(\$?[A-Z]+\$?\d+:\$?[A-Z]+\$?\d+)\s*\)/gi, (_, rangeStr, criteriaRaw, sumRangeStr) => {
      const criteria = criteriaRaw.trim().replace(/^["']|["']$/g, "");
      const checkVals = resolveRange2D(rangeStr, sheet).flat();
      const sumVals = resolveRange2D(sumRangeStr, sheet).flat();
      let total = 0;
      for (let i = 0; i < checkVals.length; i++) {
        if (evalCriteria(criteria, checkVals[i] as string | number)) total += Number(sumVals[i]) || 0;
      }
      return String(total);
    });

    // SUMIF(A1:A5, criteria) — implicit sum_range = range
    s = s.replace(/SUMIF\s*\((\$?[A-Z]+\$?\d+:\$?[A-Z]+\$?\d+)\s*,\s*([^)]+)\s*\)/gi, (_, rangeStr, criteriaRaw) => {
      const criteria = criteriaRaw.trim().replace(/^["']|["']$/g, "");
      const vals = resolveRange2D(rangeStr, sheet).flat();
      let total = 0;
      for (const v of vals) { if (evalCriteria(criteria, v as string | number)) total += Number(v) || 0; }
      return String(total);
    });

    // COUNTIF(A1:A5, criteria)
    s = s.replace(/COUNTIF\s*\((\$?[A-Z]+\$?\d+:\$?[A-Z]+\$?\d+)\s*,\s*([^)]+)\s*\)/gi, (_, rangeStr, criteriaRaw) => {
      const criteria = criteriaRaw.trim().replace(/^["']|["']$/g, "");
      const vals = resolveRange2D(rangeStr, sheet).flat();
      let count = 0;
      for (const v of vals) { if (evalCriteria(criteria, v as string | number)) count++; }
      return String(count);
    });

    // String functions: LEN/LEFT/RIGHT/MID
    s = s.replace(/LEN\s*\(([^)]+)\)/gi, (_, body) => {
      const t = body.trim();
      const ref = parseCellRef(t);
      if (ref) {
        const colKey = sheet.schema[ref.col]?.key;
        return String((colKey ? String(sheet.rows[ref.row]?.[colKey] ?? "") : "").length);
      }
      return String(t.replace(/^["']|["']$/g, "").length);
    });
    s = s.replace(/LEFT\s*\(([^,]+),\s*(\d+)\s*\)/gi, (_, body, n) => {
      const t = body.trim();
      const ref = parseCellRef(t);
      const text = ref && sheet.schema[ref.col] ? String(sheet.rows[ref.row]?.[sheet.schema[ref.col].key] ?? "") : t.replace(/^["']|["']$/g, "");
      return '"' + text.slice(0, parseInt(n, 10)) + '"';
    });
    s = s.replace(/RIGHT\s*\(([^,]+),\s*(\d+)\s*\)/gi, (_, body, n) => {
      const t = body.trim();
      const ref = parseCellRef(t);
      const text = ref && sheet.schema[ref.col] ? String(sheet.rows[ref.row]?.[sheet.schema[ref.col].key] ?? "") : t.replace(/^["']|["']$/g, "");
      return '"' + text.slice(-parseInt(n, 10)) + '"';
    });
    s = s.replace(/MID\s*\(([^,]+),\s*(\d+)\s*,\s*(\d+)\s*\)/gi, (_, body, startN, lenN) => {
      const t = body.trim();
      const ref = parseCellRef(t);
      const text = ref && sheet.schema[ref.col] ? String(sheet.rows[ref.row]?.[sheet.schema[ref.col].key] ?? "") : t.replace(/^["']|["']$/g, "");
      const start = parseInt(startN, 10) - 1;
      const len = parseInt(lenN, 10);
      return '"' + text.slice(start, start + len) + '"';
    });

    // Date helpers: YEAR/MONTH/DAY of an ISO date string
    s = s.replace(/YEAR\s*\(([^)]+)\)/gi, (_, body) => {
      const t = body.trim().replace(/^["']|["']$/g, "");
      const ref = parseCellRef(t);
      const ds = ref && sheet.schema[ref.col] ? String(sheet.rows[ref.row]?.[sheet.schema[ref.col].key] ?? "") : t;
      const d = new Date(ds);
      return isNaN(d.getTime()) ? "0" : String(d.getUTCFullYear());
    });
    s = s.replace(/MONTH\s*\(([^)]+)\)/gi, (_, body) => {
      const t = body.trim().replace(/^["']|["']$/g, "");
      const ref = parseCellRef(t);
      const ds = ref && sheet.schema[ref.col] ? String(sheet.rows[ref.row]?.[sheet.schema[ref.col].key] ?? "") : t;
      const d = new Date(ds);
      return isNaN(d.getTime()) ? "0" : String(d.getUTCMonth() + 1);
    });
    s = s.replace(/DAY\s*\(([^)]+)\)/gi, (_, body) => {
      const t = body.trim().replace(/^["']|["']$/g, "");
      const ref = parseCellRef(t);
      const ds = ref && sheet.schema[ref.col] ? String(sheet.rows[ref.row]?.[sheet.schema[ref.col].key] ?? "") : t;
      const d = new Date(ds);
      return isNaN(d.getTime()) ? "0" : String(d.getUTCDate());
    });

    // 1) Resolve range refs (A1:A5) into comma-joined numbers — supports $
    s = s.replace(/(\$?[A-Z]+\$?\d+):(\$?[A-Z]+\$?\d+)/g, (_, a, b) => expandRange(a, b, sheet, depth).join(","));
    // 2) Resolve named functions before single-cell substitution so SUM(A1) etc work
    const runFn = (raw: string, body: (vs: number[]) => number) => {
      // Parse body args: split by comma, each arg is either a number or a single cell ref
      const args = raw.split(",").map(t => t.trim()).filter(t => t !== "");
      const vs = args.map(a => {
        const ref = parseCellRef(a);
        if (ref) return resolveCell(a, sheet, depth + 1);
        const n = Number(a);
        return isNaN(n) ? 0 : n;
      });
      return body(vs);
    };
    s = s
      .replace(/SUM\s*\(([^)]+)\)/gi, (_, body) => String(runFn(body, vs => vs.reduce((a, b) => a + b, 0))))
      .replace(/(?:AVG|AVERAGE|MEAN)\s*\(([^)]+)\)/gi, (_, body) => String(runFn(body, vs => vs.length ? vs.reduce((a, b) => a + b, 0) / vs.length : 0)))
      .replace(/MAX\s*\(([^)]+)\)/gi, (_, body) => String(runFn(body, vs => vs.length ? Math.max(...vs) : 0)))
      .replace(/MIN\s*\(([^)]+)\)/gi, (_, body) => String(runFn(body, vs => vs.length ? Math.min(...vs) : 0)))
      .replace(/COUNT\s*\(([^)]+)\)/gi, (_, body) => { const args = body.split(",").filter((x: string) => x.trim() !== ""); return String(args.length); })
      .replace(/PRODUCT\s*\(([^)]+)\)/gi, (_, body) => String(runFn(body, vs => vs.reduce((a, b) => a * b, 1))))
      // Single-arg unary functions
      .replace(/ABS\s*\(([^)]+)\)/gi, (_, body) => String(runFn(body, vs => Math.abs(vs[0] || 0))))
      .replace(/ROUND\s*\(([^)]+)\)/gi, (_, body) => {
        const args = body.split(",").map((t: string) => t.trim());
        const v = args[0] ? (parseCellRef(args[0]) ? resolveCell(args[0], sheet, depth + 1) : Number(args[0]) || 0) : 0;
        const places = args[1] ? Number(args[1]) || 0 : 0;
        const m = Math.pow(10, places);
        return String(Math.round(v * m) / m);
      })
      .replace(/SQRT\s*\(([^)]+)\)/gi, (_, body) => String(runFn(body, vs => Math.sqrt(Math.max(0, vs[0] || 0)))))
      .replace(/POW\s*\(([^,]+),([^)]+)\)/gi, (_, a, b) => {
        const va = parseCellRef(a.trim()) ? resolveCell(a.trim(), sheet, depth + 1) : Number(a) || 0;
        const vb = parseCellRef(b.trim()) ? resolveCell(b.trim(), sheet, depth + 1) : Number(b) || 0;
        return String(Math.pow(va, vb));
      })
      // IF(cond, then, else) — cond is any arithmetic expression evaluated for truthiness
      .replace(/IF\s*\(([^,]+),([^,]+),([^)]+)\)/gi, (_, cond, t, f) => {
        try {
          const cs = cond.replace(/\$?[A-Z]+\$?\d+/g, (ref: string) => String(resolveCell(ref, sheet, depth + 1)));
          if (!/^[\d\s.+\-*/(),<>=!&|]+$/.test(cs)) return f.trim();
          const tFn = parseCellRef(t.trim()) ? resolveCell(t.trim(), sheet, depth + 1) : (Number(t) || t.trim());
          const fFn = parseCellRef(f.trim()) ? resolveCell(f.trim(), sheet, depth + 1) : (Number(f) || f.trim());
          // eslint-disable-next-line @typescript-eslint/no-implied-eval
          const r = Function("\"use strict\"; return (" + cs + ");")();
          return String(r ? tFn : fFn);
        } catch { return "0"; }
      })
      // IFERROR(value, fallback) — try evaluating value, return fallback on error
      .replace(/IFERROR\s*\(([^,]+),([^)]+)\)/gi, (_, v, fb) => {
        try {
          const vs = v.replace(/\$?[A-Z]+\$?\d+/g, (ref: string) => String(resolveCell(ref, sheet, depth + 1)));
          if (!/^[\d\s.+\-*/(),]+$/.test(vs)) return fb.trim();
          // eslint-disable-next-line @typescript-eslint/no-implied-eval
          const r = Function("\"use strict\"; return (" + vs + ");")();
          return typeof r === "number" && isFinite(r) ? String(r) : fb.trim();
        } catch { return fb.trim(); }
      });
    // 3) Resolve remaining single-cell refs (allows $A$1 etc.)
    s = s.replace(/\$?[A-Z]+\$?\d+/g, ref => String(resolveCell(ref, sheet, depth + 1)));
    // 4) Pure arithmetic (or quoted string) — whitelist before eval
    if (s.startsWith('"') && s.endsWith('"')) return s.slice(1, -1);
    if (!/^[\d\s.+\-*/(),]+$/.test(s)) return "#REF";
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    const result = Function("\"use strict\"; return (" + s + ");")();
    return typeof result === "number" && isFinite(result) ? result : "#ERR";
  } catch (err) {
    return "#ERR";
  }
}

// Compute a derived sheet with all formulas evaluated. Renderers consume
// this so charts always show numeric values; the table still owns the
// raw `=…` strings so users can edit them.
function computeSheet(sheet: DataSheet): DataSheet {
  const rows = sheet.rows.map(row => {
    const out: Record<string, CellValue> = {};
    for (const [k, v] of Object.entries(row)) {
      if (typeof v === "string" && v.startsWith("=")) {
        const r = evalFormula(v, sheet);
        out[k] = r;
      } else {
        out[k] = v;
      }
    }
    return out;
  });
  return { schema: sheet.schema, rows };
}

function DataSheetGrid({ sheet, onChange, sliderMode, onToggleSliderMode, selectedRowIdxs, onChangeSelectedRowIdxs, chartedRowsActive, onToggleChartedRows, onClearChartedRows }: {
  sheet: DataSheet;
  onChange: (s: DataSheet) => void;
  sliderMode: boolean;
  onToggleSliderMode: () => void;
  // Wave 13 · selected-row state, lifted to ChartMaker2 so the chart can
  // filter to "chart selected only".
  selectedRowIdxs?: Set<number>;
  onChangeSelectedRowIdxs?: (s: Set<number>) => void;
  // Whether the chart is currently filtered to selected rows
  chartedRowsActive?: boolean;
  onToggleChartedRows?: () => void;
  onClearChartedRows?: () => void;
}) {
  const [active, setActive] = useState<{ row: number; col: number } | null>(null);
  // Wave 13 · row selection — internal fallback when not lifted.
  const [internalSelected, setInternalSelected] = useState<Set<number>>(new Set());
  const sel = selectedRowIdxs ?? internalSelected;
  const setSel = (next: Set<number>) => {
    if (onChangeSelectedRowIdxs) onChangeSelectedRowIdxs(next);
    else setInternalSelected(next);
  };
  const lastClickedRowRef = useRef<number | null>(null);
  const onRowNumberClick = (e: React.MouseEvent, r: number) => {
    e.stopPropagation();
    const next = new Set(sel);
    if (e.shiftKey && lastClickedRowRef.current !== null) {
      const lo = Math.min(lastClickedRowRef.current, r);
      const hi = Math.max(lastClickedRowRef.current, r);
      for (let i = lo; i <= hi; i++) next.add(i);
    } else if (e.metaKey || e.ctrlKey) {
      if (next.has(r)) next.delete(r); else next.add(r);
    } else {
      // Plain click toggles single row (clears the rest).
      if (next.has(r) && next.size === 1) next.clear();
      else { next.clear(); next.add(r); }
    }
    lastClickedRowRef.current = r;
    setSel(next);
  };
  const setCell = (rowIdx: number, key: string, raw: string) => {
    const next = sheet.rows.slice();
    const col = sheet.schema.find(c => c.key === key);
    let v: CellValue = raw;
    // Formulas keep the raw string; otherwise coerce numbers.
    if (raw.startsWith("=")) {
      v = raw;
    } else if (col && (col.type === "number" || col.type === "percent")) {
      const num = Number(raw.replace("%", ""));
      v = isNaN(num) ? raw : num;
    }
    next[rowIdx] = { ...next[rowIdx], [key]: v };
    onChange({ ...sheet, rows: next });
  };
  const addRow = () => {
    const blank: Record<string, CellValue> = {};
    sheet.schema.forEach(c => { blank[c.key] = c.type === "number" || c.type === "percent" ? 0 : ""; });
    onChange({ ...sheet, rows: [...sheet.rows, blank] });
  };
  const removeRow = (i: number) => {
    if (sheet.rows.length <= 1) return;
    onChange({ ...sheet, rows: sheet.rows.filter((_, j) => j !== i) });
    if (active && active.row === i) setActive(null);
  };
  const insertRowAt = (i: number, dir: "above" | "below") => {
    const blank: Record<string, CellValue> = {};
    sheet.schema.forEach(c => { blank[c.key] = c.type === "number" || c.type === "percent" ? 0 : ""; });
    const next = sheet.rows.slice();
    next.splice(dir === "above" ? i : i + 1, 0, blank);
    onChange({ ...sheet, rows: next });
  };
  const clearRow = (i: number) => {
    const blank: Record<string, CellValue> = {};
    sheet.schema.forEach(c => { blank[c.key] = c.type === "number" || c.type === "percent" ? 0 : ""; });
    const next = sheet.rows.slice();
    next[i] = blank;
    onChange({ ...sheet, rows: next });
  };
  // DataSheet context menu state
  const [dsMenu, setDsMenu] = useState<{ x: number; y: number; rowIdx: number } | null>(null);
  const onRowContextMenu = (e: React.MouseEvent, rowIdx: number) => {
    e.preventDefault();
    e.stopPropagation();
    setDsMenu({ x: e.clientX, y: e.clientY, rowIdx });
  };
  const renameCol = (key: string, newLabel: string) => onChange({ ...sheet, schema: sheet.schema.map(c => c.key === key ? { ...c, label: newLabel } : c) });
  const addCol = () => {
    let n = 1;
    while (sheet.schema.some(c => c.key === "s" + n)) n++;
    const newCol: ColumnSpec = { key: "s" + n, label: "Series " + n, type: "number" };
    onChange({ schema: [...sheet.schema, newCol], rows: sheet.rows.map(r => ({ ...r, [newCol.key]: 0 })) });
  };
  const removeCol = (key: string) => {
    if (sheet.schema.length <= 2) return;
    onChange({ schema: sheet.schema.filter(c => c.key !== key), rows: sheet.rows.map(r => { const { [key]: _, ...rest } = r; return rest; }) });
  };
  // Compute slider min/max per number column from current values
  const sliderRange = (key: string): { min: number; max: number } => {
    const vals = sheet.rows.map(r => Number(r[key]) || 0);
    const lo = Math.min(0, ...vals);
    const hi = Math.max(...vals, 1);
    const span = hi - lo || 1;
    return { min: Math.floor(lo - span * 0.2), max: Math.ceil(hi + span * 0.2) };
  };

  const cellInput: React.CSSProperties = { width: "100%", padding: "7px 9px", border: "1px solid transparent", background: "transparent", color: C.tx, fontFamily: ft, fontSize: 12, outline: "none", boxSizing: "border-box" };
  const headerInput: React.CSSProperties = { ...cellInput, fontFamily: mn, fontSize: 10, fontWeight: 700, color: C.amber, letterSpacing: 0.6, textTransform: "uppercase" };

  // Active cell address + raw value (for the formula bar)
  const activeAddr = active ? colLetter(active.col) + (active.row + 1) : "";
  const activeKey = active ? sheet.schema[active.col]?.key : "";
  const activeRaw = active && activeKey ? String(sheet.rows[active.row]?.[activeKey] ?? "") : "";
  const setActiveValue = (v: string) => {
    if (!active || !activeKey) return;
    setCell(active.row, activeKey, v);
  };

  return (
    <div style={{ background: "rgba(13,13,18,0.72)", backdropFilter: "blur(14px) saturate(140%)", WebkitBackdropFilter: "blur(14px) saturate(140%)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, overflow: "hidden", boxShadow: "0 1px 0 rgba(255,255,255,0.04) inset, 0 12px 32px rgba(0,0,0,0.30)" }}>
      {/* Formula bar · LibreOffice / Excel style */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderBottom: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)" }}>
        <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", minWidth: 60, padding: "5px 10px", borderRadius: 5, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", fontFamily: mn, fontSize: 11, fontWeight: 800, color: active ? C.amber : C.txm, letterSpacing: 0.5 }}>{activeAddr || "—"}</span>
        <span style={{ fontFamily: mn, fontSize: 11, color: C.txd, fontWeight: 700 }}>fx</span>
        <input
          value={activeRaw}
          onChange={e => setActiveValue(e.target.value)}
          placeholder={active ? "Type a value or =FORMULA" : "Click a cell to edit"}
          disabled={!active}
          style={{ flex: 1, padding: "6px 10px", background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 5, color: C.tx, fontFamily: mn, fontSize: 12, outline: "none" }}
          onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
        />
        <Toggle on={sliderMode} onChange={onToggleSliderMode} label="Slider" title="Toggle slider mode for number cells" />
      </div>

      {/* Wave 13 · row-selection status pill — shows when 1+ rows selected. */}
      {sel.size > 0 && (
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "7px 12px", borderBottom: "1px solid rgba(255,255,255,0.06)",
          background: `linear-gradient(180deg, ${C.amber}10, transparent)`,
        }}>
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "4px 9px", borderRadius: 999,
            background: C.amber + "1A",
            border: "1px solid " + C.amber + "55",
            color: C.amber,
            fontFamily: mn, fontSize: 10, fontWeight: 800, letterSpacing: 0.6,
            textTransform: "uppercase",
          }}>
            {sel.size} ROW{sel.size === 1 ? "" : "S"} SELECTED
          </span>
          {onToggleChartedRows && (
            <button
              onClick={onToggleChartedRows}
              title="Toggle: chart only the selected rows vs. all rows"
              style={{
                padding: "5px 10px", borderRadius: 6,
                background: chartedRowsActive ? C.amber + "26" : "rgba(255,255,255,0.04)",
                border: "1px solid " + (chartedRowsActive ? C.amber + "70" : "rgba(255,255,255,0.10)"),
                color: chartedRowsActive ? C.amber : C.txm,
                fontFamily: mn, fontSize: 9, fontWeight: 800, letterSpacing: 0.6,
                cursor: "pointer", textTransform: "uppercase",
                display: "inline-flex", alignItems: "center", gap: 5,
              }}
            >
              CHART SELECTED ONLY {chartedRowsActive ? "✓" : "↗"}
            </button>
          )}
          <span style={{ flex: 1 }} />
          <button
            onClick={() => { setSel(new Set()); onClearChartedRows?.(); }}
            title="Clear row selection"
            style={{
              padding: "5px 10px", borderRadius: 6,
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.10)",
              color: C.txm,
              fontFamily: mn, fontSize: 9, fontWeight: 800, letterSpacing: 0.6,
              cursor: "pointer", textTransform: "uppercase",
              display: "inline-flex", alignItems: "center", gap: 5,
            }}
          >CLEAR ×</button>
        </div>
      )}

      <div style={{ overflow: "auto", maxHeight: 480 }}>
        <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0 }}>
          <colgroup>
            <col style={{ width: 44 }} />
            {sheet.schema.map(c => <col key={c.key} />)}
            <col style={{ width: 36 }} />
          </colgroup>
          <thead>
            {/* Column letters (A, B, C…) */}
            <tr>
              <th style={{ position: "sticky", top: 0, zIndex: 20, background: "#0D0D14", borderBottom: "1px solid rgba(255,255,255,0.10)", padding: "4px 0", fontFamily: mn, fontSize: 9, color: C.txd, letterSpacing: 0.4 }} />
              {sheet.schema.map((col, i) => (
                <th key={col.key} style={{ position: "sticky", top: 0, zIndex: 20, background: "#0D0D14", borderBottom: "1px solid rgba(255,255,255,0.10)", borderLeft: "1px solid rgba(255,255,255,0.04)", padding: "4px 0", fontFamily: mn, fontSize: 9, fontWeight: 800, color: active && active.col === i ? C.amber : C.txm, letterSpacing: 0.6, textAlign: "center" }}>
                  {colLetter(i)}
                </th>
              ))}
              <th style={{ position: "sticky", top: 0, zIndex: 20, background: "#0D0D14", borderBottom: "1px solid rgba(255,255,255,0.10)", padding: 0 }} />
            </tr>
            {/* Editable column labels */}
            <tr>
              <th style={{ position: "sticky", top: 24, zIndex: 19, background: "#0D0D12", borderBottom: "1px solid rgba(255,255,255,0.10)", padding: 0 }} />
              {sheet.schema.map((col, i) => (
                <th key={col.key} style={{ position: "sticky", top: 24, zIndex: 19, background: "#0D0D12", borderBottom: "1px solid rgba(255,255,255,0.10)", borderLeft: "1px solid rgba(255,255,255,0.04)", padding: 0 }}>
                  <CellInput value={col.label} onCommit={v => renameCol(col.key, v || col.label)} style={headerInput} />
                  {sheet.schema.length > 2 && (
                    <span onClick={() => removeCol(col.key)} title="Remove column" style={{ position: "absolute", top: 4, right: 4, cursor: "pointer", color: C.txd, padding: 2, lineHeight: 0 }}>
                      <X size={10} />
                    </span>
                  )}
                </th>
              ))}
              <th style={{ position: "sticky", top: 24, zIndex: 19, background: "#0D0D12", borderBottom: "1px solid rgba(255,255,255,0.10)", padding: 0 }}>
                <span onClick={addCol} title="Add column" style={{ display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: C.txm, padding: "8px 0" }}>
                  <Plus size={12} strokeWidth={2.2} />
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            {sheet.rows.map((row, r) => {
              const isRowSel = sel.has(r);
              const rowBgBase = r % 2 === 0 ? "transparent" : "rgba(255,255,255,0.015)";
              const rowBg = isRowSel ? "rgba(247,176,65,0.10)" : rowBgBase;
              return (
              <tr
                key={r}
                style={{ background: rowBg, transition: "background 0.16s cubic-bezier(.2,.7,.2,1)" }}
                onMouseEnter={e => { if (!isRowSel) (e.currentTarget as HTMLElement).style.background = "rgba(247,176,65,0.06)"; }}
                onMouseLeave={e => { if (!isRowSel) (e.currentTarget as HTMLElement).style.background = rowBgBase; }}
              >
                <td
                  onClick={(e) => onRowNumberClick(e, r)}
                  title="Click to toggle row selection · Shift-click for range · Ctrl/Cmd-click for additive"
                  style={{
                    width: 44, textAlign: "center",
                    borderTop: "1px solid rgba(255,255,255,0.04)",
                    borderLeft: isRowSel ? `3px solid ${C.amber}` : "3px solid transparent",
                    color: isRowSel ? C.amber : (active && active.row === r ? C.amber : C.txd),
                    fontFamily: mn, fontSize: 10, fontWeight: 700, position: "relative",
                    background: isRowSel ? "rgba(247,176,65,0.14)" : "rgba(255,255,255,0.02)",
                    cursor: "pointer",
                    userSelect: "none",
                  }}
                >
                  <span style={{ display: "inline-block", padding: "6px 4px" }}>{r + 1}</span>
                  <span onClick={(e) => { e.stopPropagation(); removeRow(r); }} title="Remove row" style={{ position: "absolute", top: "50%", right: 4, transform: "translateY(-50%)", cursor: "pointer", padding: 2, color: C.txd, lineHeight: 0, display: "inline-flex", opacity: 0.5 }} onMouseEnter={e => { e.currentTarget.style.opacity = "1"; e.currentTarget.style.color = "#E06347"; }} onMouseLeave={e => { e.currentTarget.style.opacity = "0.5"; e.currentTarget.style.color = C.txd; }}>
                    <X size={10} />
                  </span>
                </td>
                {sheet.schema.map((col, ci) => {
                  const isActive = active && active.row === r && active.col === ci;
                  const raw = String(row[col.key] ?? "");
                  const isFormula = raw.startsWith("=");
                  // For display: if formula, show evaluated result; else raw
                  const display = isFormula ? (() => { const v = evalFormula(raw, sheet); return typeof v === "number" ? niceRound(v) : v; })() : raw;
                  return (
                    <td
                      key={col.key}
                      onClick={() => setActive({ row: r, col: ci })}
                      onContextMenu={e => onRowContextMenu(e, r)}
                      style={{
                        borderTop: "1px solid rgba(255,255,255,0.04)",
                        borderLeft: "1px solid rgba(255,255,255,0.03)",
                        padding: 0,
                        position: "relative",
                        background: isActive ? C.amber + "12" : "transparent",
                        boxShadow: isActive ? "inset 0 0 0 2px " + C.amber + "60" : "none",
                      }}
                    >
                      {sliderMode && (col.type === "number" || col.type === "percent") && !isFormula ? (
                        <div style={{ padding: "8px 10px", display: "flex", alignItems: "center", gap: 8 }}>
                          <input
                            type="range"
                            min={sliderRange(col.key).min}
                            max={sliderRange(col.key).max}
                            value={Number(raw) || 0}
                            onChange={e => setCell(r, col.key, e.target.value)}
                            style={{ flex: 1, accentColor: C.amber, cursor: "ew-resize" }}
                          />
                          <span style={{ fontFamily: mn, fontSize: 11, fontWeight: 700, color: isActive ? C.amber : C.tx, minWidth: 44, textAlign: "right" }}>{niceRound(Number(raw) || 0)}</span>
                        </div>
                      ) : (
                        <CellInput
                          value={isFormula ? raw : (isFormula === false && typeof display === "string" ? display : String(display))}
                          onCommit={v => setCell(r, col.key, v)}
                          style={{ ...cellInput, color: isFormula ? C.amber : C.tx, fontFamily: isFormula ? mn : ft }}
                          type={col.type === "date" ? "date" : col.type}
                          onScrub={col.type === "number" || col.type === "percent" ? () => {} : undefined}
                        />
                      )}
                      {isFormula && (
                        <span title={"Formula: " + raw} style={{ position: "absolute", top: 2, right: 4, fontFamily: mn, fontSize: 8, fontWeight: 800, color: C.amber, opacity: 0.65, pointerEvents: "none", letterSpacing: 0.5 }}>fx</span>
                      )}
                    </td>
                  );
                })}
                <td style={{ width: 36, borderTop: "1px solid rgba(255,255,255,0.04)" }} />
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div style={{ padding: "8px 12px", borderTop: "1px solid rgba(255,255,255,0.06)", display: "flex", gap: 8, alignItems: "center" }}>
        <button onClick={addRow} style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 12px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.10)", background: "rgba(255,255,255,0.025)", color: C.txm, fontFamily: mn, fontSize: 10, fontWeight: 700, letterSpacing: 0.5, cursor: "pointer" }}>
          <Plus size={11} strokeWidth={2.2} /> ROW
        </button>
        <button onClick={addCol} style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 12px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.10)", background: "rgba(255,255,255,0.025)", color: C.txm, fontFamily: mn, fontSize: 10, fontWeight: 700, letterSpacing: 0.5, cursor: "pointer" }}>
          <Plus size={11} strokeWidth={2.2} /> COLUMN
        </button>
        <span style={{ flex: 1 }} />
        <span style={{ fontFamily: mn, fontSize: 9, color: C.txd, letterSpacing: 0.5 }}>FORMULAS · =SUM(A1:A5) · =AVG · =MIN · =MAX · =A1+B1</span>
      </div>
      {/* Cell right-click context menu */}
      {dsMenu && (
        <>
          <div style={{ position: "fixed", inset: 0, zIndex: 1000 }} onClick={() => setDsMenu(null)} onContextMenu={e => { e.preventDefault(); setDsMenu(null); }} />
          <div style={{
            position: "fixed", left: dsMenu.x, top: dsMenu.y, zIndex: 1001,
            background: "rgba(13,13,20,0.97)", backdropFilter: "blur(16px)",
            WebkitBackdropFilter: "blur(16px)",
            border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8,
            boxShadow: "0 8px 32px rgba(0,0,0,0.50)", padding: "4px 0", minWidth: 160,
          }}>
            {[
              { label: "Insert row above", action: () => insertRowAt(dsMenu.rowIdx, "above") },
              { label: "Insert row below", action: () => insertRowAt(dsMenu.rowIdx, "below") },
              null,
              { label: "Clear row", action: () => clearRow(dsMenu.rowIdx) },
              { label: "Delete row", action: () => removeRow(dsMenu.rowIdx), danger: true },
            ].map((item, i) => item === null
              ? <div key={i} style={{ height: 1, background: "rgba(255,255,255,0.07)", margin: "3px 0" }} />
              : <button key={i} onClick={() => { item.action(); setDsMenu(null); }} style={{
                  display: "block", width: "100%", padding: "8px 14px", background: "transparent",
                  border: "none", textAlign: "left", color: item.danger ? "#E06347" : C.tx,
                  fontFamily: mn, fontSize: 11, fontWeight: 600, cursor: "pointer", letterSpacing: 0.3,
                }} onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}>
                {item.label}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// Cell input that stays controlled while the user types but mirrors
// upstream changes (e.g. a chart drag updating the same cell). Commits
// to the parent on blur or Enter so we don't fire setState on every
// keystroke through the whole sheet. type="date" wires the native
// browser calendar picker; type="number" supports drag-scrub.
function CellInput({ value, onCommit, style, type, onScrub }: { value: string; onCommit: (v: string) => void; style: React.CSSProperties; type?: "text" | "number" | "date" | "percent"; onScrub?: (delta: number) => void }) {
  const [local, setLocal] = useState(value);
  const focusedRef = useRef(false);
  const scrubRef = useRef<{ x: number; v: number } | null>(null);
  useEffect(() => { if (!focusedRef.current) setLocal(value); }, [value]);
  const inputType = type === "date" ? "date" : "text";
  return (
    <input
      type={inputType}
      value={local}
      onChange={e => setLocal(e.target.value)}
      onFocus={e => { focusedRef.current = true; if (inputType !== "date") e.target.select(); }}
      onBlur={() => { focusedRef.current = false; if (local !== value) onCommit(local); }}
      onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); (e.target as HTMLInputElement).blur(); } if (e.key === "Escape") { setLocal(value); (e.target as HTMLInputElement).blur(); } }}
      onPointerDown={onScrub && (type === "number" || type === "percent") ? e => {
        // Alt+drag enters scrub mode. We use Alt to preserve normal click
        // behavior (focus + select) and get the modifier explicit.
        if (!e.altKey) return;
        e.preventDefault();
        const numV = Number(local) || 0;
        scrubRef.current = { x: e.clientX, v: numV };
        (e.target as Element).setPointerCapture?.(e.pointerId);
        const onMove = (ev: PointerEvent) => {
          const ds = scrubRef.current;
          if (!ds) return;
          const dx = ev.clientX - ds.x;
          // 1px = 1 unit when the value is small; scale by magnitude
          const scale = Math.max(1, Math.abs(ds.v) / 100);
          const next = ds.v + dx * scale;
          const rounded = Math.round(next * 100) / 100;
          setLocal(String(rounded));
          onCommit(String(rounded));
        };
        const onUp = () => {
          scrubRef.current = null;
          window.removeEventListener("pointermove", onMove);
          window.removeEventListener("pointerup", onUp);
        };
        window.addEventListener("pointermove", onMove);
        window.addEventListener("pointerup", onUp);
      } : undefined}
      title={onScrub && (type === "number" || type === "percent") ? "Alt-drag horizontally to scrub the value" : undefined}
      style={style}
    />
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// DRAG-SCRUB INPUT · Wave 13 · generalized Alt+drag scrub for any numeric
// input. Drop-in replacement for <input type="number"> with magnitude-aware
// step. Hold Shift while dragging for fine-grained (×0.1) movement.
// ═══════════════════════════════════════════════════════════════════════════
type DragScrubInputProps = {
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
  max?: number;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type" | "min" | "max" | "step">;
function DragScrubInput({ value, onChange, step, min, max, style, title, onKeyDown, onBlur, ...rest }: DragScrubInputProps) {
  const [local, setLocal] = useState(String(value));
  const focusedRef = useRef(false);
  const scrubRef = useRef<{ x: number; v: number } | null>(null);
  const [altHeld, setAltHeld] = useState(false);
  useEffect(() => { if (!focusedRef.current) setLocal(String(value)); }, [value]);
  useEffect(() => {
    const onKD = (e: KeyboardEvent) => { if (e.altKey) setAltHeld(true); };
    const onKU = (e: KeyboardEvent) => { if (!e.altKey) setAltHeld(false); };
    window.addEventListener("keydown", onKD);
    window.addEventListener("keyup", onKU);
    return () => { window.removeEventListener("keydown", onKD); window.removeEventListener("keyup", onKU); };
  }, []);
  const clamp = useCallback((n: number) => {
    let r = n;
    if (typeof min === "number" && r < min) r = min;
    if (typeof max === "number" && r > max) r = max;
    return r;
  }, [min, max]);
  const commit = useCallback((s: string) => {
    const n = Number(s);
    if (!Number.isFinite(n)) { setLocal(String(value)); return; }
    const clamped = clamp(n);
    onChange(clamped);
    setLocal(String(clamped));
  }, [value, onChange, clamp]);
  return (
    <input
      {...rest}
      type="text"
      value={local}
      onChange={e => setLocal(e.target.value)}
      onFocus={e => { focusedRef.current = true; e.target.select(); }}
      onBlur={e => { focusedRef.current = false; if (local !== String(value)) commit(local); onBlur?.(e); }}
      onKeyDown={e => {
        if (e.key === "Enter") { e.preventDefault(); (e.target as HTMLInputElement).blur(); }
        else if (e.key === "Escape") { setLocal(String(value)); (e.target as HTMLInputElement).blur(); }
        else if (e.key === "ArrowUp") { e.preventDefault(); commit(String(clamp(Number(local) + (step ?? 1)))); }
        else if (e.key === "ArrowDown") { e.preventDefault(); commit(String(clamp(Number(local) - (step ?? 1)))); }
        onKeyDown?.(e);
      }}
      onPointerDown={e => {
        if (!e.altKey) return;
        e.preventDefault();
        const numV = Number(local) || 0;
        scrubRef.current = { x: e.clientX, v: numV };
        (e.target as Element).setPointerCapture?.(e.pointerId);
        const onMove = (ev: PointerEvent) => {
          const ds = scrubRef.current;
          if (!ds) return;
          const dx = ev.clientX - ds.x;
          // Magnitude-aware: 1px = 1 unit when value is small; scaled up
          // when value is large. Shift = ×0.1 fine-grained.
          const baseScale = Math.max(step ?? 1, Math.abs(ds.v) / 100);
          const scale = ev.shiftKey ? baseScale * 0.1 : baseScale;
          const next = ds.v + dx * scale;
          const rounded = Math.round(next * 100) / 100;
          const c = clamp(rounded);
          setLocal(String(c));
          onChange(c);
        };
        const onUp = () => {
          scrubRef.current = null;
          window.removeEventListener("pointermove", onMove);
          window.removeEventListener("pointerup", onUp);
        };
        window.addEventListener("pointermove", onMove);
        window.addEventListener("pointerup", onUp);
      }}
      title={title ?? "Alt-drag horizontally to scrub the value (Shift for fine)"}
      style={{ ...style, cursor: altHeld ? "ew-resize" : (style as React.CSSProperties)?.cursor }}
    />
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// COMMON SVG HELPERS
// ═══════════════════════════════════════════════════════════════════════════
const fontSans = "'Outfit', ui-sans-serif, system-ui, sans-serif";
const fontMono = "'JetBrains Mono', ui-monospace, monospace";

function fmtNum(n: number): string {
  if (Math.abs(n) >= 1e9) return (n / 1e9).toFixed(1) + "B";
  if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(1) + "M";
  if (Math.abs(n) >= 1e3) return (n / 1e3).toFixed(1) + "K";
  if (Math.abs(n) >= 100) return Math.round(n).toString();
  return Math.round(n * 10) / 10 + "";
}

// Chart-wide number formatting · we ship a chart-wide setting that
// covers the 8 most useful presets (no per-label control yet).
type NumberFormat = "auto" | "int" | "dec1" | "pct" | "usd" | "k" | "m" | "b";
function fmtVal(v: number, f: NumberFormat): string {
  if (f === "auto") return fmtNum(v);
  if (f === "int") return Math.round(v).toLocaleString();
  if (f === "dec1") return v.toLocaleString(undefined, { maximumFractionDigits: 1, minimumFractionDigits: 1 });
  if (f === "pct") return Math.round(v) + "%";
  if (f === "usd") return "$" + Math.round(v).toLocaleString();
  if (f === "k") return (v / 1e3).toFixed(1) + "K";
  if (f === "m") return (v / 1e6).toFixed(2) + "M";
  if (f === "b") return (v / 1e9).toFixed(2) + "B";
  return String(v);
}
const NUM_FMT_LABELS: Record<NumberFormat, string> = {
  auto: "Auto", int: "1,234", dec1: "1.2", pct: "1%", usd: "$1", k: "1K", m: "1M", b: "1B",
};

// Compute compound annual growth rate · ((b/a)^(1/years) - 1) * 100.
// Years is the number of category steps between the picked points,
// which is a serviceable approximation when the categories are ordered
// chronologically.
function cagrPct(a: number, b: number, steps: number): number {
  if (a <= 0 || b <= 0 || steps <= 0) return 0;
  return (Math.pow(b / a, 1 / steps) - 1) * 100;
}

// ─── Excel paste detection · ported from ChartMaker 1 ─────────────────────
// Recognizes the SA "horizontal" layout — one row of dates, one row of
// numeric values, optional row of point labels (chip names) below.
// Pivots into a canonical [{Date, Value, _label}, ...] shape so the
// rest of the pipeline can ingest it.
function coerceNumber(s: string): number {
  const c = s.replace(/[\s,]/g, "");
  if (c === "" || c === "-") return NaN;
  return Number(c);
}
const SERIES_LABEL_PATTERNS_CM2 = /(launch\s*time|tflops|flops|gb\/s|bandwidth|capacity|tdp|watts?|chip)/i;

function splitRow(line: string): string[] {
  // Tab-first (Excel default), fall back to comma. Quoted commas not
  // handled — analysts pasting from Excel always get TSV.
  if (line.indexOf("\t") !== -1) return line.split("\t");
  return line.split(",").map(s => s.trim());
}

function detectHorizontalLayout(table: string[][]): { xValues: string[]; yValues: number[]; seriesName: string; labels: string[] | null } | null {
  if (table.length < 2) return null;
  const maxW = Math.max(...table.map(r => r.length));
  if (maxW < 3) return null;
  const dateRows: number[] = [];
  const numRows: number[] = [];
  for (let i = 0; i < table.length; i++) {
    const cells = table[i].slice(1).map(c => (c || "").trim());
    const nonEmpty = cells.filter(c => c !== "").length;
    if (nonEmpty < 2) continue;
    let dateCount = 0, numCount = 0;
    cells.forEach(c => {
      if (!c) return;
      if (!isNaN(coerceNumber(c))) numCount++;
      else if (!isNaN(Date.parse(c))) dateCount++;
    });
    if (dateCount / nonEmpty >= 0.7) dateRows.push(i);
    else if (numCount / nonEmpty >= 0.7) numRows.push(i);
  }
  if (dateRows.length !== 1 || numRows.length !== 1) return null;
  const dr = dateRows[0], nr = numRows[0];
  const xValues: string[] = [], yValues: number[] = [], usedCols: number[] = [];
  for (let c = 1; c < maxW; c++) {
    const dCell = (table[dr][c] || "").trim();
    const nCell = (table[nr][c] || "").trim();
    const n = coerceNumber(nCell);
    if (dCell && !isNaN(Date.parse(dCell)) && !isNaN(n)) { xValues.push(dCell); yValues.push(n); usedCols.push(c); }
  }
  if (xValues.length < 2) return null;
  let seriesName = "";
  for (let i = 0; i < table.length; i++) {
    const first = (table[i][0] || "").trim();
    if (!first || SERIES_LABEL_PATTERNS_CM2.test(first)) continue;
    seriesName = first; break;
  }
  if (!seriesName) seriesName = (table[nr][0] || "").trim() || "Series";
  let labels: string[] | null = null;
  for (let i = 0; i < table.length; i++) {
    if (i === dr || i === nr) continue;
    const candidates = usedCols.map(c => (table[i][c] || "").trim());
    const allValid = candidates.every(v => v && isNaN(coerceNumber(v)) && isNaN(Date.parse(v)));
    if (allValid) { labels = candidates; break; }
  }
  return { xValues, yValues, seriesName, labels };
}

// Parse a pasted block into a DataSheet for the categorical chart family
// (Stacked / Clustered / Line / Area). Tries the SA horizontal layout
// first; falls back to standard "Category | S1 | S2..." with header row.
function parsePasteForCategorical(raw: string): DataSheet | null {
  const lines = raw.replace(/\r/g, "").split("\n").filter(l => l.trim() !== "");
  if (lines.length < 2) return null;
  const table = lines.map(splitRow);
  const horiz = detectHorizontalLayout(table);
  if (horiz) {
    return {
      schema: [
        { key: "category", label: "Date", type: "date" },
        { key: "s1", label: horiz.seriesName, type: "number" },
      ],
      rows: horiz.xValues.map((x, i) => ({ category: x, s1: horiz.yValues[i] })),
    };
  }
  // Standard CSV: first row is headers, first column = category, rest = numeric series
  const header = table[0];
  if (header.length < 2) return null;
  const schema: ColumnSpec[] = [
    { key: "category", label: header[0] || "Category", type: "text" },
  ];
  for (let i = 1; i < header.length; i++) {
    schema.push({ key: "s" + i, label: header[i] || "Series " + i, type: "number" });
  }
  const rows: Array<Record<string, CellValue>> = [];
  for (let r = 1; r < table.length; r++) {
    const row: Record<string, CellValue> = { category: table[r][0] || "" };
    for (let i = 1; i < header.length; i++) {
      const v = coerceNumber((table[r][i] || "").trim());
      row["s" + i] = isNaN(v) ? 0 : v;
    }
    rows.push(row);
  }
  return rows.length > 0 ? { schema, rows } : null;
}

function niceTicks(min: number, max: number, count = 5): number[] {
  if (min === max) return [min];
  const range = max - min;
  const rough = range / count;
  const pow = Math.pow(10, Math.floor(Math.log10(rough)));
  const m = rough / pow;
  const step = (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * pow;
  const start = Math.ceil(min / step) * step;
  const ticks: number[] = [];
  for (let v = start; v <= max + 0.0001; v += step) ticks.push(Math.round(v / step) * step);
  return ticks;
}

// ═══════════════════════════════════════════════════════════════════════════
// CATEGORICAL CHARTS (column / bar / line / area)
// Schema expected: first column text (category), rest number (series)
// ═══════════════════════════════════════════════════════════════════════════
type OnUpdateRow = (rowIdx: number, patch: Record<string, CellValue>) => void;
type OnDeleteRow = (rowIdx: number) => void;
type LucideIconCmp = React.ComponentType<{ size?: number | string; strokeWidth?: number; color?: string }>;
type ContextMenuItem =
  | { label: string; onClick: () => void; danger?: boolean; divider?: boolean }
  | { kind: "iconRow"; icons: Array<{ Icon: LucideIconCmp; title: string; active?: boolean; onClick: () => void }> }
  | { kind: "swatchRow"; colors: string[]; onPick: (color: string | null) => void; current?: string };
type OnShowMenu = (e: React.MouseEvent, items: ContextMenuItem[]) => void;

// ElementIconMenu state
interface ElementMenuState {
  x: number;
  y: number;
  kind: "bar" | "canvas";
  rowIdx?: number;
  seriesKey?: string;
  palette?: string[];
  currentColor?: string;
  onCagr?: () => void;
  onDiff?: () => void;
  onRefLine?: () => void;
  onCallout?: () => void;
  onSetColor?: (c: string | null) => void;
  onDelete?: () => void;
}
type OnShowElementMenu = (state: ElementMenuState) => void;

// ─── Annotations · annotation-arrow overlays on top of the data ───────────
type Annotation =
  | { id: string; kind: "refline"; value: number; label?: string; color?: string }
  | { id: string; kind: "cagr"; rowFrom: number; rowTo: number; seriesKey: string }
  | { id: string; kind: "diff"; rowFrom: number; rowTo: number; seriesKey: string }
  // Wave 11 · series CAGR shown next to the last data point of a series
  | { id: string; kind: "seriesCagr"; seriesKey: string }
  // Wave 11 · total difference between column totals (vs same-series diff)
  | { id: string; kind: "totalDiff"; rowFrom: number; rowTo: number }
  // Free-form text callout placed via the ANNOTATE tool. x/y are in
  // SVG viewBox coords so positions stay stable across re-renders.
  | { id: string; kind: "callout"; x: number; y: number; text: string; color?: string };

type PickMode = null | { kind: "cagr" | "diff"; bars: Array<{ rowIdx: number; key: string }> };
// Single-click placement mode for the ANNOTATE TEXT tool — distinct
// from pickMode (multi-step). Click anywhere on the chart background
// to drop a callout.
type PlaceMode = null | { kind: "callout" };
type OnPickBar = (rowIdx: number, key: string) => boolean; // returns true if pick consumed the click

// Floating mini-toolbar selection · LEGACY · kept for backwards
// compatibility with the old FloatingMiniToolbar fallback. The new
// SelectedElement model below drives the radial-menu selection.
interface BarSelection {
  kind: "bar";
  rowIdx: number;
  key: string;
  color: string;
  // Anchor for the floating toolbar (in client coords)
  anchorX: number;
  anchorY: number;
}
type OnSelect = (sel: BarSelection | null) => void;

// ─── Wave 11 · radial-menu selection paradigm ─────────────────────────────
// Click an element first → it shows a glow + handles. Then drag the top
// midpoint handle to resize, or right-click / press M for the radial wheel.
// Esc deselects, click-on-canvas deselects.
// Wave 12 · anchorX/anchorY are CLIENT (viewport) coords captured at the
// click site. They drive the SelectionPopup placement. Optional so older
// callers that haven't been threaded through yet still type-check.
type SelectedElement =
  | { kind: "segment"; rowIdx: number; key: string; color: string; anchorX?: number; anchorY?: number }
  | { kind: "point"; rowIdx: number; key: string; color: string; anchorX?: number; anchorY?: number }
  | { kind: "label"; labelType: "segment" | "series" | "total" | "category"; rowIdx?: number; key?: string; anchorX?: number; anchorY?: number }
  | { kind: "annotation"; id: string; anchorX?: number; anchorY?: number }
  | { kind: "axis"; which: "x" | "y"; anchorX?: number; anchorY?: number }
  | { kind: "legend"; key: string; anchorX?: number; anchorY?: number }
  | { kind: "mekkoColumn"; rowIdx: number; anchorX?: number; anchorY?: number }
  | { kind: "canvas"; anchorX?: number; anchorY?: number };
type OnSelectElement = (sel: SelectedElement | null, anchor?: { x: number; y: number }) => void;

// Position of the radial wheel — anchored at the cursor when opened.
interface WheelAnchor { x: number; y: number; selected: SelectedElement | null }

interface CatProps {
  sheet: DataSheet; cfg: ChartConfig; W: number; H: number;
  onUpdateRow?: OnUpdateRow;
  onDeleteRow?: OnDeleteRow;
  onShowMenu?: OnShowMenu;
  onShowElementMenu?: OnShowElementMenu;
  annotations?: Annotation[];
  pickMode?: PickMode;
  onPickBar?: OnPickBar;
  onSelect?: OnSelect;
  // Wave 11 · selection-driven UI
  selected?: SelectedElement | null;
  onSelectElement?: OnSelectElement;
  // Open the radial wheel at the given client coords for the current selection.
  onOpenWheel?: (clientX: number, clientY: number) => void;
  // Per-series color override (changes apply to the whole series).
  onSetSeriesColor?: (key: string, color: string | null) => void;
}

// Convert pointer event coords to SVG-viewBox coords. Walks up to the
// owning <svg>, snapshots the screen CTM, applies its inverse to the
// pointer location. This is what makes drag handlers work regardless of
// CSS scaling, padding, or zoom.
function pointerToSvg(e: React.PointerEvent | PointerEvent, target: Element): { x: number; y: number } | null {
  const svg = target.closest("svg") as SVGSVGElement | null;
  if (!svg) return null;
  const pt = svg.createSVGPoint();
  pt.x = e.clientX;
  pt.y = e.clientY;
  const ctm = svg.getScreenCTM();
  if (!ctm) return null;
  const t = pt.matrixTransform(ctm.inverse());
  return { x: t.x, y: t.y };
}

// ─── Wave 11 · selection handles ───────────────────────────────────────────
// Render an amber glow box + corner / edge handles around a selected
// element. The TOP MIDPOINT receives drag events for vertical resize.
function SelectionHandles({
  x, y, w, h, accent = C.amber, onTopHandleDown, onTopHandleMove, onTopHandleUp,
  showCornerHandles = true, showEdgeHandles = true,
}: {
  x: number; y: number; w: number; h: number; accent?: string;
  onTopHandleDown?: (e: React.PointerEvent) => void;
  onTopHandleMove?: (e: React.PointerEvent) => void;
  onTopHandleUp?: (e: React.PointerEvent) => void;
  showCornerHandles?: boolean; showEdgeHandles?: boolean;
}) {
  const corners: Array<[number, number, string]> = [
    [x, y, "nwse-resize"],
    [x + w, y, "nesw-resize"],
    [x, y + h, "nesw-resize"],
    [x + w, y + h, "nwse-resize"],
  ];
  return (
    <g>
      <g pointerEvents="none">
        <rect
          x={x - 2} y={y - 2} width={w + 4} height={Math.max(0, h + 4)}
          fill="none" stroke={accent} strokeWidth={2}
          strokeDasharray="none"
          filter="url(#cm2SelGlow)"
        >
          <animate attributeName="opacity" values="0.7;1.0;0.7" dur="1.6s" repeatCount="indefinite" />
        </rect>
        {showCornerHandles && corners.map(([hx, hy, cur], i) => (
          <rect key={"c"+i} x={hx - 3.5} y={hy - 3.5} width={7} height={7}
            fill="#FFFFFF" stroke={accent} strokeWidth={1.5} rx={1}
            style={{ cursor: cur }} />
        ))}
        {showEdgeHandles && (
          <rect
            x={x + w / 2 - 3.5} y={y + h - 3.5} width={7} height={7}
            fill="#FFFFFF" stroke={accent} strokeWidth={1.5} rx={1}
            style={{ cursor: "ns-resize" }}
          />
        )}
      </g>
      {/* TOP HANDLE · interactive drag-to-resize */}
      {showEdgeHandles && (
        <rect
          x={x + w / 2 - 5} y={y - 5} width={10} height={10}
          fill={accent} stroke="#FFFFFF" strokeWidth={1.5} rx={2}
          style={{ cursor: "ns-resize" }}
          onPointerDown={onTopHandleDown}
          onPointerMove={onTopHandleMove}
          onPointerUp={onTopHandleUp}
        />
      )}
    </g>
  );
}

function getCategoricalSeries(sheet: DataSheet) {
  const catCol = sheet.schema[0];
  const seriesCols = sheet.schema.slice(1).filter(c => c.type === "number" || c.type === "percent");
  const categories = sheet.rows.map(r => String(r[catCol.key] ?? ""));
  const series = seriesCols.map(s => ({ key: s.key, label: s.label, values: sheet.rows.map(r => Number(r[s.key]) || 0) }));
  return { categories, series };
}

// Watermark · POAST box logo behind the chart data. Position is stable
// per-chart (hashed from W*H) so re-renders don't jitter the logo. Two
// modes:
//   centered → dead-center on the chart canvas
//   random   → offset 10–30% from center toward bottom-right
function Watermark({ cfg, W, H }: { cfg: ChartConfig; W: number; H: number }) {
  if (!cfg.watermark || cfg.watermark === "off") return null;
  const SIZE = 280;
  let cx: number;
  let cy: number;
  if (cfg.watermark === "centered") {
    cx = W / 2 - SIZE / 2;
    cy = H / 2 - SIZE / 2;
  } else {
    // Stable hash → fraction in [0.10, 0.30] for both axes, biased toward
    // bottom-right of the canvas so the data still reads on top.
    const hash = (Math.sin(W * H * 0.000131) * 10000) % 1;
    const offX = 0.10 + Math.abs(hash) * 0.20;
    const offY = 0.10 + Math.abs((hash * 1.7) % 1) * 0.20;
    cx = W * (0.5 + offX) - SIZE / 2;
    cy = H * (0.5 + offY) - SIZE / 2;
  }
  return (
    <image
      href="/box-logo.png"
      xlinkHref="/box-logo.png"
      x={cx}
      y={cy}
      width={SIZE}
      height={SIZE}
      opacity={0.20}
      style={{ pointerEvents: "none" }}
    />
  );
}

function ChartFrame({ cfg, W, H, children, leftPad = 56, rightPad = 24, topPad = 70, bottomPad = 48 }: { cfg: ChartConfig; W: number; H: number; children: React.ReactNode; leftPad?: number; rightPad?: number; topPad?: number; bottomPad?: number }) {
  void rightPad; void bottomPad;
  const cc = chartColors(cfg);
  const chartH = H - topPad - bottomPad;
  return (
    <g>
      {/* Wave 11 · selection-glow filter + handle pulse animation */}
      <defs>
        <filter id="cm2SelGlow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="g" />
          <feMerge><feMergeNode in="g" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <filter id="cm2SelGlowSoft" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="2" result="g" />
          <feMerge><feMergeNode in="g" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      <rect x="0" y="0" width={W} height={H} fill="transparent" pointerEvents="none" />
      {/* Wave 12 · watermark sits BEHIND title + data so it whispers, not shouts */}
      <Watermark cfg={cfg} W={W} H={H} />
      <text x={leftPad} y="28" fill={cc.text} style={{ fontFamily: fontSans, fontSize: 18, fontWeight: 900 }}>{cfg.title}</text>
      <text x={leftPad} y="48" fill={cc.muted} style={{ fontFamily: fontMono, fontSize: 10, letterSpacing: 1 }}>{cfg.subtitle.toUpperCase()}</text>
      {cfg.yLabel && (
        <text
          textAnchor="middle"
          fill={cc.muted}
          transform={`translate(12, ${topPad + chartH / 2}) rotate(-90)`}
          style={{ fontFamily: fontMono, fontSize: 9, letterSpacing: 1 }}
        >{cfg.yLabel.toUpperCase()}</text>
      )}
      {cfg.xLabel && (
        <text
          x={(leftPad + W - rightPad) / 2}
          y={topPad + chartH + bottomPad - 4}
          textAnchor="middle"
          fill={cc.muted}
          style={{ fontFamily: fontMono, fontSize: 9, letterSpacing: 1 }}
        >{cfg.xLabel.toUpperCase()}</text>
      )}
      <g transform={`translate(0, ${topPad})`}>
        {children}
      </g>
    </g>
  );
}

function StackedColumn({ sheet, cfg, W, H, onUpdateRow, onDeleteRow, onShowMenu, onShowElementMenu, annotations, pickMode, onPickBar, onSelect, onSetSeriesColor, selected, onSelectElement, onOpenWheel }: CatProps) {
  void pickMode;
  const [hoverCat, setHoverCat] = useState<number | null>(null);
  const { categories, series } = getCategoricalSeries(sheet);
  const seriesKeys = sheet.schema.slice(1).filter(c => c.type === "number" || c.type === "percent").map(c => c.key);
  const catKey = sheet.schema[0]?.key || "category";
  const palette = THEMES[cfg.theme].colors;
  // Series color resolver — per-series override > theme palette[i]
  const colorOf = (key: string, idx: number) => cfg.seriesColors?.[key] || palette[idx % palette.length];
  const legendSwatchClick = onSetSeriesColor && onShowMenu ? (key: string, e: React.MouseEvent) => onShowMenu(e, [
    { kind: "swatchRow", colors: palette, current: cfg.seriesColors?.[key], onPick: c => onSetSeriesColor(key, c) },
  ]) : undefined;
  const [editingCat, setEditingCat] = useState<number | null>(null);
  const cc = chartColors(cfg);
  const SIDE_LEGEND_W = (cfg.legendPos === "left" || cfg.legendPos === "right") ? 100 : 0;
  const leftPad = cfg.legendPos === "left" ? 56 + SIDE_LEGEND_W : 56;
  const rightPad = cfg.legendPos === "right" ? 24 + SIDE_LEGEND_W : 24;
  const topPad = 70, bottomPad = cfg.legendPos === "top" ? 60 : 48;
  const chartW = W - leftPad - rightPad;
  const chartH = H - topPad - bottomPad;

  const totals = categories.map((_, i) => series.reduce((a, s) => a + s.values[i], 0));
  const maxVal = Math.max(0, ...totals);
  const ticks = cfg.logScale
    ? (() => { const t: number[] = []; let p = 1; while (p <= maxVal * 1.2) { t.push(p); p *= 10; } return t; })()
    : niceTicks(0, maxVal, 5);
  const tickMax = cfg.yMax !== undefined ? cfg.yMax : (ticks[ticks.length - 1] || 1);
  const tMin = 0;
  const yOf = cfg.logScale
    ? (v: number) => { if (v <= 0) return chartH; const logMin = Math.log10(Math.max(0.1, tMin + 0.1)); const logMax = Math.log10(tickMax); return chartH * (1 - (Math.log10(Math.max(0.1, v)) - logMin) / (logMax - logMin)); }
    : (v: number) => chartH - (v / tickMax) * chartH;

  const groupW = chartW / categories.length;
  const barW = Math.min(groupW * ((cfg.barWidthPct ?? 65) / 100), 100);

  // Wave 11 · CLICK-TO-SELECT then DRAG-HANDLE-TO-RESIZE.
  // Click on body of a bar selects it only — drag is initiated via the
  // TOP MIDPOINT HANDLE rendered when selected. Pointer y maps to a
  // cumulative value (counting from baseline up); subtract the segments
  // below to get this segment's height.
  const dragRef = useRef<{ rowIdx: number; key: string; cumBelow: number } | null>(null);
  const cumValueAt = (e: React.PointerEvent): number | null => {
    const pt = pointerToSvg(e, e.currentTarget);
    if (!pt) return null;
    const localY = pt.y - topPad;
    return Math.max(0, tickMax * (1 - localY / chartH));
  };
  const onBodyDown = (rowIdx: number, key: string) => (e: React.PointerEvent) => {
    if (!onUpdateRow) return;
    e.stopPropagation();
    if (onPickBar && onPickBar(rowIdx, key)) return;
    if (e.button !== 0) return;
    const color = palette[seriesKeys.indexOf(key) % palette.length];
    if (onSelectElement) {
      onSelectElement({ kind: "segment", rowIdx, key, color, anchorX: e.clientX, anchorY: e.clientY });
    }
    // Legacy hook for FloatingMiniToolbar (kept as fallback)
    if (onSelect) onSelect({ kind: "bar", rowIdx, key, color, anchorX: e.clientX, anchorY: e.clientY });
  };
  const onTopHandleDown = (rowIdx: number, key: string, cumBelow: number) => (e: React.PointerEvent) => {
    if (!onUpdateRow) return;
    e.stopPropagation();
    e.preventDefault();
    dragRef.current = { rowIdx, key, cumBelow };
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    const cv = cumValueAt(e);
    if (cv != null) onUpdateRow(rowIdx, { [key]: niceRound(Math.max(0, cv - cumBelow)) });
  };
  const onMove = (e: React.PointerEvent) => {
    const ds = dragRef.current;
    if (!ds || !onUpdateRow) return;
    const cv = cumValueAt(e);
    if (cv != null) onUpdateRow(ds.rowIdx, { [ds.key]: niceRound(Math.max(0, cv - ds.cumBelow)) });
  };
  const onUp = () => { dragRef.current = null; };

  return (
    <ChartFrame cfg={cfg} W={W} H={H} leftPad={leftPad} rightPad={rightPad} topPad={topPad} bottomPad={bottomPad}>
      {ticks.map(t => (
        <g key={t}>
          {cfg.showGridlines !== false && <line x1={leftPad} x2={W - rightPad} y1={yOf(t)} y2={yOf(t)} stroke={cc.grid} strokeWidth="1" />}
          {cfg.showTickMarks && <line x1={leftPad - 4} x2={leftPad} y1={yOf(t)} y2={yOf(t)} stroke={cc.muted} strokeWidth="1.5" />}
          <text x={leftPad - 8} y={yOf(t) + 4} textAnchor="end" fill={cc.muted} style={{ fontFamily: fontMono, fontSize: 10 }}>{fmtVal(t, cfg.numFmt)}</text>
        </g>
      ))}
      {categories.map((cat, i) => {
        // For rounded corners: detect which series is topmost (last non-zero)
        const topSeriesIdx = (() => {
          for (let k = series.length - 1; k >= 0; k--) { if (series[k].values[i] > 0) return k; }
          return series.length - 1;
        })();
        let cum = 0;
        return (
          <g key={i} style={{ animation: `cm2BarRise 0.6s cubic-bezier(.2,.7,.2,1) both`, animationDelay: `${i * 30}ms`, transformOrigin: `${leftPad + i * groupW + groupW / 2}px ${H - bottomPad}px`, transformBox: "fill-box" as React.CSSProperties["transformBox"] }}>
            {series.map((s, si) => {
              const v = s.values[i];
              const cumBelow = cum;
              const y0 = yOf(cum);
              const y1 = yOf(cum + v);
              cum += v;
              const key = seriesKeys[si];
              const isTop = cfg.roundedCorners && si === topSeriesIdx && v > 0;
              const segX = leftPad + i * groupW + (groupW - barW) / 2;
              const segH = Math.max(0, y0 - y1);
              const isSelected = selected?.kind === "segment" && selected.rowIdx === i && selected.key === key;
              return (
                <g key={si}>
                <rect
                  x={segX}
                  y={y1}
                  width={barW}
                  height={segH}
                  rx={isTop ? 4 : 0}
                  ry={isTop ? 4 : 0}
                  fill={colorOf(seriesKeys[si], si)}
                  stroke={cfg.showBorders ? cc.barBorder : "none"}
                  strokeWidth={cfg.showBorders ? 1 : 0}
                  onPointerDown={onBodyDown(i, key)}
                  onMouseEnter={() => setHoverCat(i)}
                  onMouseLeave={() => setHoverCat(h => h === i ? null : h)}
                  onContextMenu={e => {
                    e.preventDefault(); e.stopPropagation();
                    const color = colorOf(seriesKeys[si], si);
                    if (onSelectElement) onSelectElement({ kind: "segment", rowIdx: i, key, color, anchorX: e.clientX, anchorY: e.clientY });
                    if (onOpenWheel) { onOpenWheel(e.clientX, e.clientY); return; }
                    if (onShowElementMenu) {
                      onShowElementMenu({ x: e.clientX, y: e.clientY, kind: "bar", rowIdx: i, seriesKey: key, currentColor: cfg.seriesColors?.[key] });
                    } else {
                      onShowMenu?.(e, [
                        { label: "Set segment to 0", onClick: () => onUpdateRow?.(i, { [key]: 0 }) },
                        { label: "Round to nearest 10", onClick: () => onUpdateRow?.(i, { [key]: Math.round(v / 10) * 10 }) },
                        { label: "", divider: true, onClick: () => {} },
                        { label: "Delete row", danger: true, onClick: () => onDeleteRow?.(i) },
                      ]);
                    }
                  }}
                  style={{ cursor: onUpdateRow ? "pointer" : "default" }}
                />
                {cfg.showSegmentLabels && (y0 - y1) > 14 && barW > 20 && (
                  <text
                    x={leftPad + i * groupW + (groupW - barW) / 2 + barW / 2}
                    y={(y0 + y1) / 2 + 3}
                    textAnchor="middle"
                    fill={cc.onBar}
                    style={{ fontFamily: fontMono, fontSize: 9, fontWeight: 800, pointerEvents: "none" }}
                  >{fmtVal(v, cfg.numFmt)}</text>
                )}
                {isSelected && (
                  <SelectionHandles
                    x={segX} y={y1} w={barW} h={segH}
                    onTopHandleDown={onTopHandleDown(i, key, cumBelow)}
                    onTopHandleMove={onMove}
                    onTopHandleUp={onUp}
                  />
                )}
              </g>
              );
            })}
            {cfg.showTotalLabels !== false && <text x={leftPad + i * groupW + groupW / 2} y={yOf(totals[i]) - 6} textAnchor="middle" fill={cc.text} style={{ fontFamily: fontMono, fontSize: 10, fontWeight: 700, pointerEvents: "none" }}>{fmtVal(totals[i], cfg.numFmt)}</text>}
            {editingCat === i ? (
              <foreignObject x={leftPad + i * groupW + 6} y={chartH + 8} width={groupW - 12} height={26}>
                <input
                  autoFocus
                  defaultValue={cat}
                  onBlur={e => { onUpdateRow?.(i, { [catKey]: (e.target as HTMLInputElement).value }); setEditingCat(null); }}
                  onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); if (e.key === "Escape") setEditingCat(null); }}
                  style={{ width: "100%", height: "100%", padding: "0 6px", background: "#0A0A0E", border: "1px solid " + C.amber + "80", borderRadius: 4, color: "#E8E4DD", fontFamily: fontSans, fontSize: 11, outline: "none", boxSizing: "border-box", textAlign: "center" }}
                />
              </foreignObject>
            ) : (
              <text
                x={leftPad + i * groupW + groupW / 2} y={chartH + 22} textAnchor="middle" fill={cc.muted}
                onDoubleClick={() => onUpdateRow && setEditingCat(i)}
                style={{ fontFamily: fontSans, fontSize: 11, fontWeight: 600, cursor: onUpdateRow ? "text" : "default" }}
              >{cat}</text>
            )}
          </g>
        );
      })}
      {cfg.legendPos === "left" && <Legend series={series.map((s, si) => ({ key: seriesKeys[si], label: s.label, color: colorOf(seriesKeys[si], si) }))} W={W} y={10} leftPad={0} onSwatchClick={legendSwatchClick} textColor={cc.muted} vertical vertX={2} chartH={chartH} sideW={SIDE_LEGEND_W} />}
      {cfg.legendPos === "right" && <Legend series={series.map((s, si) => ({ key: seriesKeys[si], label: s.label, color: colorOf(seriesKeys[si], si) }))} W={W} y={10} leftPad={0} onSwatchClick={legendSwatchClick} textColor={cc.muted} vertical vertX={W - SIDE_LEGEND_W} chartH={chartH} sideW={SIDE_LEGEND_W} />}
      {(cfg.legendPos === "top" || cfg.legendPos === "bottom") && <Legend series={series.map((s, si) => ({ key: seriesKeys[si], label: s.label, color: colorOf(seriesKeys[si], si) }))} W={W} y={cfg.legendPos === "top" ? -28 : chartH + 36} leftPad={leftPad} onSwatchClick={legendSwatchClick} textColor={cc.muted} />}
      {hoverCat !== null && (() => {
        const i = hoverCat;
        const cx = leftPad + i * groupW + groupW / 2;
        // Tooltip card position — clamp to chart bounds
        const ttW = 180, ttH = Math.min(140, 36 + series.length * 16);
        const ttX = Math.min(Math.max(leftPad, cx + 16), W - rightPad - ttW);
        const ttY = topPad + 8;
        return (
          <g pointerEvents="none">
            <line x1={cx} x2={cx} y1={0} y2={chartH} stroke={cc.muted} strokeDasharray="3 4" strokeWidth={1} opacity={0.6} />
            <foreignObject x={ttX} y={ttY} width={ttW} height={ttH}>
              <div style={{ background: "rgba(13,13,18,0.95)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 8, padding: "8px 10px", fontFamily: ft, fontSize: 11, color: "#E8E4DD", boxShadow: "0 8px 20px rgba(0,0,0,0.5)" }}>
                <div style={{ fontFamily: mn, fontSize: 9, fontWeight: 800, marginBottom: 5, letterSpacing: 0.5, textTransform: "uppercase", color: C.amber }}>{categories[i]}</div>
                {series.map((s, si) => (
                  <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 6, padding: "1px 0" }}>
                    <span style={{ width: 8, height: 8, borderRadius: 2, background: colorOf(seriesKeys[si], si) }} />
                    <span style={{ flex: 1 }}>{s.label}</span>
                    <span style={{ fontFamily: mn, fontWeight: 700 }}>{fmtVal(s.values[i], cfg.numFmt)}</span>
                  </div>
                ))}
                <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 0 0", marginTop: 4, borderTop: "1px solid rgba(255,255,255,0.10)" }}>
                  <span style={{ flex: 1, fontFamily: mn, fontSize: 9, color: C.txm, letterSpacing: 0.4, textTransform: "uppercase" }}>Total</span>
                  <span style={{ fontFamily: mn, fontWeight: 800 }}>{fmtVal(totals[i], cfg.numFmt)}</span>
                </div>
              </div>
            </foreignObject>
          </g>
        );
      })()}
      {/* Annotations · ref lines, CAGR, diff. Anchored to the TOP of the
          stack at each picked row (cumulative sum). */}
      <AnnotationLayer
        annotations={annotations || []}
        getBarTop={(rowIdx, key) => {
          // Stacked: anchor to the top of the picked segment (cumulative)
          let cum = 0;
          for (const k of seriesKeys) {
            const v = Number(sheet.rows[rowIdx]?.[k] ?? 0);
            cum += v;
            if (k === key) break;
          }
          const cx = leftPad + rowIdx * groupW + groupW / 2;
          return { x: cx, y: yOf(cum), value: Number(sheet.rows[rowIdx]?.[key] ?? 0) };
        }}
        getColumnTop={(rowIdx) => {
          const cx = leftPad + rowIdx * groupW + groupW / 2;
          return { x: cx, y: yOf(totals[rowIdx]), total: totals[rowIdx] };
        }}
        getSeriesEndPoint={(key) => {
          const si = seriesKeys.indexOf(key);
          if (si < 0) return null;
          const lastIdx = sheet.rows.length - 1;
          if (lastIdx < 0) return null;
          let cum = 0;
          for (const k of seriesKeys) {
            const v = Number(sheet.rows[lastIdx]?.[k] ?? 0);
            cum += v;
            if (k === key) break;
          }
          const first = Number(sheet.rows[0]?.[key] ?? 0);
          const last = Number(sheet.rows[lastIdx]?.[key] ?? 0);
          const cx = leftPad + lastIdx * groupW + groupW / 2;
          return { x: cx, y: yOf(cum), first, last, steps: lastIdx, color: colorOf(key, si) };
        }}
        chartW={W - leftPad - rightPad}
        chartH={chartH}
        leftPad={leftPad}
        topPad={topPad}
        tickMax={tickMax}
        yOf={yOf}
        fmt={cfg.numFmt}
      />
    </ChartFrame>
  );
}

function ClusteredColumn({ sheet, cfg, W, H, onUpdateRow, onDeleteRow, onShowMenu, onShowElementMenu, annotations, pickMode, onPickBar, onSelect, onSetSeriesColor, selected, onSelectElement, onOpenWheel }: CatProps) {
  const { categories, series } = getCategoricalSeries(sheet);
  const seriesKeys = sheet.schema.slice(1).filter(c => c.type === "number" || c.type === "percent").map(c => c.key);
  const catKey = sheet.schema[0]?.key || "category";
  const [editingCat, setEditingCat] = useState<number | null>(null);
  const palette = THEMES[cfg.theme].colors;
  const colorOf = (key: string, idx: number) => cfg.seriesColors?.[key] || palette[idx % palette.length];
  const legendSwatchClick = onSetSeriesColor && onShowMenu ? (key: string, e: React.MouseEvent) => onShowMenu(e, [
    { kind: "swatchRow", colors: palette, current: cfg.seriesColors?.[key], onPick: c => onSetSeriesColor(key, c) },
  ]) : undefined;
  const cc = chartColors(cfg);
  const SIDE_LEGEND_W = (cfg.legendPos === "left" || cfg.legendPos === "right") ? 100 : 0;
  const leftPad = cfg.legendPos === "left" ? 56 + SIDE_LEGEND_W : 56;
  const rightPad = cfg.legendPos === "right" ? 24 + SIDE_LEGEND_W : 24;
  const topPad = 70, bottomPad = cfg.legendPos === "top" ? 60 : 48;
  const chartW = W - leftPad - rightPad;
  const chartH = H - topPad - bottomPad;

  const maxVal = Math.max(0, ...series.flatMap(s => s.values));
  const ticks = cfg.logScale
    ? (() => { const t: number[] = []; let p = 1; while (p <= maxVal * 1.2) { t.push(p); p *= 10; } return t; })()
    : niceTicks(0, maxVal, 5);
  const tickMax = cfg.yMax !== undefined ? cfg.yMax : (ticks[ticks.length - 1] || 1);
  const yOf = cfg.logScale
    ? (v: number) => { if (v <= 0) return chartH; const logMax = Math.log10(tickMax); return chartH * (1 - (Math.log10(Math.max(0.1, v)) - Math.log10(0.1)) / (logMax - Math.log10(0.1))); }
    : (v: number) => chartH - (v / tickMax) * chartH;

  const groupW = chartW / categories.length;
  // Wave 13 · barWidthPct controls the total fraction of groupW the cluster
  // takes up. Inner pad is split symmetrically on each side.
  const clusterFrac = (cfg.barWidthPct ?? 65) / 100;
  const innerW = groupW * clusterFrac;
  const innerPad = (groupW - innerW) / 2;
  const barW = innerW / series.length;

  // Pointer y (in SVG viewBox coords) → numeric value. Subtract topPad
  // because the chart contents are inside a `<g translate(0, topPad)>`.
  const valueAtPointer = (e: React.PointerEvent): number | null => {
    const pt = pointerToSvg(e, e.currentTarget);
    if (!pt) return null;
    const localY = pt.y - topPad;
    return Math.max(0, tickMax * (1 - localY / chartH));
  };
  const dragRef = useRef<{ rowIdx: number; key: string } | null>(null);
  // Click body = select; the TOP HANDLE (rendered when selected) drives drag.
  const onBodyDown = (rowIdx: number, key: string) => (e: React.PointerEvent) => {
    if (!onUpdateRow) return;
    e.stopPropagation();
    if (onPickBar && onPickBar(rowIdx, key)) return;
    if (e.button !== 0) return;
    const color = palette[seriesKeys.indexOf(key) % palette.length];
    if (onSelectElement) onSelectElement({ kind: "segment", rowIdx, key, color, anchorX: e.clientX, anchorY: e.clientY });
    if (onSelect) onSelect({ kind: "bar", rowIdx, key, color, anchorX: e.clientX, anchorY: e.clientY });
  };
  const onTopHandleDown = (rowIdx: number, key: string) => (e: React.PointerEvent) => {
    if (!onUpdateRow) return;
    e.stopPropagation();
    e.preventDefault();
    dragRef.current = { rowIdx, key };
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    const v = valueAtPointer(e);
    if (v != null) onUpdateRow(rowIdx, { [key]: niceRound(v) });
  };
  const onMove = (e: React.PointerEvent) => {
    const ds = dragRef.current;
    if (!ds || !onUpdateRow) return;
    const v = valueAtPointer(e);
    if (v != null) onUpdateRow(ds.rowIdx, { [ds.key]: niceRound(v) });
  };
  const onUp = () => { dragRef.current = null; };

  return (
    <ChartFrame cfg={cfg} W={W} H={H} leftPad={leftPad} rightPad={rightPad} topPad={topPad} bottomPad={bottomPad}>
      {ticks.map(t => (
        <g key={t}>
          {cfg.showGridlines !== false && <line x1={leftPad} x2={W - rightPad} y1={yOf(t)} y2={yOf(t)} stroke={cc.grid} strokeWidth="1" />}
          <text x={leftPad - 8} y={yOf(t) + 4} textAnchor="end" fill={cc.muted} style={{ fontFamily: fontMono, fontSize: 10 }}>{fmtVal(t, cfg.numFmt)}</text>
        </g>
      ))}
      {categories.map((cat, i) => (
        <g key={i} style={{ animation: `cm2BarRise 0.6s cubic-bezier(.2,.7,.2,1) both`, animationDelay: `${i * 30}ms`, transformOrigin: `${leftPad + i * groupW + groupW / 2}px ${H - bottomPad}px`, transformBox: "fill-box" as React.CSSProperties["transformBox"] }}>
          {series.map((s, si) => {
            const v = s.values[i];
            const x = leftPad + i * groupW + innerPad + si * barW;
            const y = yOf(v);
            const key = seriesKeys[si];
            const isSel = selected?.kind === "segment" && selected.rowIdx === i && selected.key === key;
            return (
              <g key={si}>
                <rect
                  x={x + 1} y={y} width={barW - 2} height={chartH - y}
                  rx={cfg.roundedCorners ? 4 : 0}
                  ry={cfg.roundedCorners ? 4 : 0}
                  fill={colorOf(seriesKeys[si], si)}
                  onPointerDown={onBodyDown(i, key)}
                  onContextMenu={e => {
                    e.preventDefault(); e.stopPropagation();
                    const color = colorOf(seriesKeys[si], si);
                    if (onSelectElement) onSelectElement({ kind: "segment", rowIdx: i, key, color, anchorX: e.clientX, anchorY: e.clientY });
                    if (onOpenWheel) { onOpenWheel(e.clientX, e.clientY); return; }
                    if (onShowElementMenu) {
                      onShowElementMenu({ x: e.clientX, y: e.clientY, kind: "bar", rowIdx: i, seriesKey: key, currentColor: cfg.seriesColors?.[key] });
                    } else {
                      onShowMenu?.(e, [
                        { label: "Set to 0", onClick: () => onUpdateRow?.(i, { [key]: 0 }) },
                        { label: "Set to max", onClick: () => onUpdateRow?.(i, { [key]: niceRound(tickMax) }) },
                        { label: "Round to nearest 10", onClick: () => onUpdateRow?.(i, { [key]: Math.round(v / 10) * 10 }) },
                        { label: "", divider: true, onClick: () => {} },
                        { label: "Delete row", danger: true, onClick: () => onDeleteRow?.(i) },
                      ]);
                    }
                  }}
                  style={{ cursor: onUpdateRow ? "pointer" : "default" }}
                />
                <text x={x + barW / 2} y={y - 4} textAnchor="middle" fill={cc.text} style={{ fontFamily: fontMono, fontSize: 9, fontWeight: 700, pointerEvents: "none" }}>{fmtVal(v, cfg.numFmt)}</text>
                {isSel && (
                  <SelectionHandles
                    x={x + 1} y={y} w={barW - 2} h={chartH - y}
                    onTopHandleDown={onTopHandleDown(i, key)}
                    onTopHandleMove={onMove}
                    onTopHandleUp={onUp}
                  />
                )}
              </g>
            );
          })}
          {editingCat === i ? (
            <foreignObject x={leftPad + i * groupW + 6} y={chartH + 8} width={groupW - 12} height={26}>
              <input
                autoFocus
                defaultValue={cat}
                onBlur={e => { onUpdateRow?.(i, { [catKey]: (e.target as HTMLInputElement).value }); setEditingCat(null); }}
                onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); if (e.key === "Escape") setEditingCat(null); }}
                style={{ width: "100%", height: "100%", padding: "0 6px", background: "#0A0A0E", border: "1px solid " + C.amber + "80", borderRadius: 4, color: "#E8E4DD", fontFamily: fontSans, fontSize: 11, outline: "none", boxSizing: "border-box", textAlign: "center" }}
              />
            </foreignObject>
          ) : (
            <text
              x={leftPad + i * groupW + groupW / 2} y={chartH + 22} textAnchor="middle" fill={cc.muted}
              onDoubleClick={() => onUpdateRow && setEditingCat(i)}
              style={{ fontFamily: fontSans, fontSize: 11, fontWeight: 600, cursor: onUpdateRow ? "text" : "default" }}
            >{cat}</text>
          )}
        </g>
      ))}
      {cfg.legendPos === "left" && <Legend series={series.map((s, si) => ({ key: seriesKeys[si], label: s.label, color: colorOf(seriesKeys[si], si) }))} W={W} y={10} leftPad={0} onSwatchClick={legendSwatchClick} textColor={cc.muted} vertical vertX={2} chartH={chartH} sideW={SIDE_LEGEND_W} />}
      {cfg.legendPos === "right" && <Legend series={series.map((s, si) => ({ key: seriesKeys[si], label: s.label, color: colorOf(seriesKeys[si], si) }))} W={W} y={10} leftPad={0} onSwatchClick={legendSwatchClick} textColor={cc.muted} vertical vertX={W - SIDE_LEGEND_W} chartH={chartH} sideW={SIDE_LEGEND_W} />}
      {(cfg.legendPos === "top" || cfg.legendPos === "bottom") && <Legend series={series.map((s, si) => ({ key: seriesKeys[si], label: s.label, color: colorOf(seriesKeys[si], si) }))} W={W} y={cfg.legendPos === "top" ? -28 : chartH + 36} leftPad={leftPad} onSwatchClick={legendSwatchClick} textColor={cc.muted} />}
      {/* Annotations layer · reference lines, CAGR arrows, Δ markers */}
      <AnnotationLayer
        annotations={annotations || []}
        getX={i => leftPad + i * groupW + innerPad + (seriesKeys.indexOf("__placeholder__") + 0.5) * barW + groupW / 2 - groupW / 2}
        getBarTop={(rowIdx, key) => {
          const si = seriesKeys.indexOf(key);
          const cx = leftPad + rowIdx * groupW + innerPad + si * barW + barW / 2;
          const cy = yOf(Number(sheet.rows[rowIdx]?.[key] ?? 0));
          return { x: cx, y: cy, value: Number(sheet.rows[rowIdx]?.[key] ?? 0) };
        }}
        getColumnTop={(rowIdx) => {
          // For clustered, "column total" = sum of all series values for the row;
          // anchor x = group center, y at sum of values
          const total = seriesKeys.reduce((a, k) => a + (Number(sheet.rows[rowIdx]?.[k]) || 0), 0);
          const cx = leftPad + rowIdx * groupW + groupW / 2;
          const maxAtRow = Math.max(0, ...seriesKeys.map(k => Number(sheet.rows[rowIdx]?.[k]) || 0));
          return { x: cx, y: yOf(maxAtRow), total };
        }}
        getSeriesEndPoint={(key) => {
          const si = seriesKeys.indexOf(key);
          if (si < 0) return null;
          const lastIdx = sheet.rows.length - 1;
          if (lastIdx < 0) return null;
          const cx = leftPad + lastIdx * groupW + innerPad + si * barW + barW / 2;
          const last = Number(sheet.rows[lastIdx]?.[key] ?? 0);
          const first = Number(sheet.rows[0]?.[key] ?? 0);
          return { x: cx, y: yOf(last), first, last, steps: lastIdx, color: colorOf(key, si) };
        }}
        chartW={W - leftPad - rightPad}
        chartH={chartH}
        leftPad={leftPad}
        topPad={topPad}
        tickMax={tickMax}
        yOf={yOf}
        fmt={cfg.numFmt}
      />
    </ChartFrame>
  );
}

// Round a numeric value to a sensible step (1, 0.1, 10, etc) based on magnitude.
// Keeps drag-set values from looking like 47.823892.
function niceRound(v: number): number {
  if (v === 0) return 0;
  const abs = Math.abs(v);
  if (abs >= 100) return Math.round(v);
  if (abs >= 10) return Math.round(v * 10) / 10;
  if (abs >= 1) return Math.round(v * 100) / 100;
  return Math.round(v * 1000) / 1000;
}

function PercentColumn({ sheet, cfg, W, H }: CatProps) {
  const { categories, series } = getCategoricalSeries(sheet);
  const palette = THEMES[cfg.theme].colors;
  const cc = chartColors(cfg);
  const SIDE_LEGEND_W = (cfg.legendPos === "left" || cfg.legendPos === "right") ? 100 : 0;
  const leftPad = cfg.legendPos === "left" ? 56 + SIDE_LEGEND_W : 56;
  const rightPad = cfg.legendPos === "right" ? 24 + SIDE_LEGEND_W : 24;
  const topPad = 70, bottomPad = cfg.legendPos === "top" ? 60 : 48;
  const chartW = W - leftPad - rightPad;
  const chartH = H - topPad - bottomPad;
  const groupW = chartW / categories.length;
  const barW = Math.min(groupW * ((cfg.barWidthPct ?? 65) / 100), 100);

  const ticks = [0, 25, 50, 75, 100];
  const yOf = (v: number) => chartH - (v / 100) * chartH;

  return (
    <ChartFrame cfg={cfg} W={W} H={H} leftPad={leftPad} rightPad={rightPad} topPad={topPad} bottomPad={bottomPad}>
      {ticks.map(t => (
        <g key={t}>
          {cfg.showGridlines !== false && <line x1={leftPad} x2={W - rightPad} y1={yOf(t)} y2={yOf(t)} stroke={cc.grid} strokeWidth="1" />}
          <text x={leftPad - 8} y={yOf(t) + 4} textAnchor="end" fill={cc.muted} style={{ fontFamily: fontMono, fontSize: 10 }}>{t}%</text>
        </g>
      ))}
      {categories.map((cat, i) => {
        const total = series.reduce((a, s) => a + s.values[i], 0) || 1;
        let cum = 0;
        return (
          <g key={i} style={{ animation: `cm2BarRise 0.6s cubic-bezier(.2,.7,.2,1) both`, animationDelay: `${i * 30}ms`, transformOrigin: `${leftPad + i * groupW + groupW / 2}px ${H - bottomPad}px`, transformBox: "fill-box" as React.CSSProperties["transformBox"] }}>
            {series.map((s, si) => {
              const pct = (s.values[i] / total) * 100;
              const y0 = yOf(cum);
              const y1 = yOf(cum + pct);
              cum += pct;
              const cx = leftPad + i * groupW + (groupW - barW) / 2;
              return (
                <g key={si}>
                  <rect x={cx} y={y1} width={barW} height={Math.max(0, y0 - y1)} fill={palette[si % palette.length]} stroke={cfg.showBorders ? cc.barBorder : "none"} strokeWidth={cfg.showBorders ? 1 : 0} />
                  {(y0 - y1) > 18 && <text x={cx + barW / 2} y={(y0 + y1) / 2 + 3} textAnchor="middle" fill={cc.onBar} style={{ fontFamily: fontMono, fontSize: 9, fontWeight: 800 }}>{Math.round(pct)}%</text>}
                </g>
              );
            })}
            <text x={leftPad + i * groupW + groupW / 2} y={chartH + 22} textAnchor="middle" fill={cc.muted} style={{ fontFamily: fontSans, fontSize: 11, fontWeight: 600 }}>{cat}</text>
          </g>
        );
      })}
      {cfg.legendPos === "left" && <Legend series={series.map((s, si) => ({ label: s.label, color: palette[si % palette.length] }))} W={W} y={10} leftPad={0} textColor={cc.muted} vertical vertX={2} chartH={chartH} sideW={SIDE_LEGEND_W} />}
      {cfg.legendPos === "right" && <Legend series={series.map((s, si) => ({ label: s.label, color: palette[si % palette.length] }))} W={W} y={10} leftPad={0} textColor={cc.muted} vertical vertX={W - SIDE_LEGEND_W} chartH={chartH} sideW={SIDE_LEGEND_W} />}
      {(cfg.legendPos === "top" || cfg.legendPos === "bottom") && <Legend series={series.map((s, si) => ({ label: s.label, color: palette[si % palette.length] }))} W={W} y={cfg.legendPos === "top" ? -28 : chartH + 36} leftPad={leftPad} textColor={cc.muted} />}
    </ChartFrame>
  );
}

function LineProfile({ sheet, cfg, W, H, fill = false, stacked = false, pct100 = false, onUpdateRow, selected, onSelectElement, onOpenWheel }: CatProps & { fill?: boolean; stacked?: boolean; pct100?: boolean }) {
  const { categories, series: rawSeries } = getCategoricalSeries(sheet);
  // Normalize to 100% per column when pct100 is set
  const series = pct100
    ? rawSeries.map((s, si) => ({
        ...s,
        values: s.values.map((v, ci) => {
          const rowTotal = rawSeries.reduce((sum, rs) => sum + (rs.values[ci] ?? 0), 0) || 1;
          return (v / rowTotal) * 100;
        }),
      }))
    : rawSeries;
  const seriesKeys = sheet.schema.slice(1).filter(c => c.type === "number" || c.type === "percent").map(c => c.key);
  const palette = THEMES[cfg.theme].colors;
  const colorOf = (key: string, idx: number) => cfg.seriesColors?.[key] || palette[idx % palette.length];
  const cc = chartColors(cfg);
  const SIDE_LEGEND_W = (cfg.legendPos === "left" || cfg.legendPos === "right") ? 100 : 0;
  const leftPad = cfg.legendPos === "left" ? 56 + SIDE_LEGEND_W : 56;
  const rightPad = cfg.legendPos === "right" ? 24 + SIDE_LEGEND_W : 24;
  const topPad = 70, bottomPad = cfg.legendPos === "top" ? 60 : 48;
  const chartW = W - leftPad - rightPad;
  const chartH = H - topPad - bottomPad;
  // Time-axis detection · port of ChartMaker 1's auto-time behavior. If
  // every category parses as a date, position points by timestamp instead
  // of even category spacing — so May 2020 → Dec 2022 lands further apart
  // than Q1 → Q2.
  const tsValues = categories.map(c => Date.parse(c));
  const useTime = categories.length >= 2 && tsValues.every(t => !isNaN(t));
  // Manual X axis range overrides the auto fit (interpreted as unix-ms in
  // time-axis mode).
  const tMin = useTime ? (cfg.xMin !== undefined ? cfg.xMin : Math.min(...tsValues)) : 0;
  const tMax = useTime ? (cfg.xMax !== undefined ? cfg.xMax : Math.max(...tsValues)) : 1;
  const tSpan = Math.max(1, tMax - tMin);
  const colW = chartW / Math.max(1, categories.length - 1);
  const xOf = useTime
    ? (i: number) => leftPad + ((tsValues[i] - tMin) / tSpan) * chartW
    : (i: number) => leftPad + i * colW;
  // Time-axis ticks: pick a unit that gives ~5 ticks across the span.
  const tDays = tSpan / 86400000;
  const timeUnit: TimeUnit = tDays > 365 * 1.5 ? "quarter" : (tDays > 90 ? "month" : "week");
  const timeTicks = useTime ? buildTicks(tMin, tMax, timeUnit) : [];

  const lineDragRef = useRef<{ rowIdx: number; key: string } | null>(null);

  const renderedSeries = stacked
    ? series.map((s, si) => {
        if (si === 0) return { ...s, cumValues: s.values };
        const prev = series.slice(0, si).reduce<number[]>((acc, p) => acc.length === 0 ? p.values : acc.map((v, i) => v + p.values[i]), []);
        const cum = s.values.map((v, i) => v + prev[i]);
        return { ...s, cumValues: cum };
      })
    : series.map(s => ({ ...s, cumValues: s.values }));

  const allY = renderedSeries.flatMap(s => s.cumValues);
  const minV = Math.min(0, ...allY);
  const maxV = Math.max(0, ...allY);
  const ticks = niceTicks(minV, maxV, 5);
  const tickMin = cfg.yMin !== undefined ? cfg.yMin : ticks[0];
  const tickMax = cfg.yMax !== undefined ? cfg.yMax : ticks[ticks.length - 1];
  const yOf = (v: number) => chartH - ((v - tickMin) / Math.max(0.0001, tickMax - tickMin)) * chartH;

  return (
    <ChartFrame cfg={cfg} W={W} H={H} leftPad={leftPad} rightPad={rightPad} topPad={topPad} bottomPad={bottomPad}>
      {ticks.map(t => (
        <g key={t}>
          {cfg.showGridlines !== false && <line x1={leftPad} x2={W - rightPad} y1={yOf(t)} y2={yOf(t)} stroke={cc.grid} strokeWidth="1" />}
          <text x={leftPad - 8} y={yOf(t) + 4} textAnchor="end" fill={cc.muted} style={{ fontFamily: fontMono, fontSize: 10 }}>{fmtVal(t, cfg.numFmt)}</text>
        </g>
      ))}
      {/* Fills (areas) */}
      {fill && renderedSeries.map((s, si) => {
        const baseline = stacked
          ? si === 0
            ? categories.map(() => 0)
            : renderedSeries[si - 1].cumValues
          : categories.map(() => 0);
        const top = s.cumValues.map((v, i) => xOf(i) + "," + yOf(v)).join(" ");
        const bottomRev = baseline.map((v, i) => xOf(categories.length - 1 - i) + "," + yOf(baseline[categories.length - 1 - i])).join(" ");
        return <polygon key={"f-" + si} points={top + " " + bottomRev} fill={palette[si % palette.length]} fillOpacity="0.5" />;
      })}
      {/* Lines + dots · drag any dot to set its value */}
      {(() => {
        const dragRefHack = lineDragRef; // capture ref into IIFE so handlers see it
        const valueAt = (e: React.PointerEvent): number | null => {
          const pt = pointerToSvg(e, e.currentTarget);
          if (!pt) return null;
          const localY = pt.y - topPad;
          return tickMin + (1 - localY / chartH) * (tickMax - tickMin);
        };
        return renderedSeries.map((s, si) => {
          const path = s.cumValues.map((v, i) => `${i === 0 ? "M" : "L"} ${xOf(i)} ${yOf(v)}`).join(" ");
          const key = seriesKeys[si];
          const lineColor = colorOf(key, si);
          // Wave 11 · point click-to-select; drag only when the point is
          // already selected (so casual clicks don't slam values around).
          const onDown = (rowIdx: number) => (e: React.PointerEvent) => {
            if (!onUpdateRow) return;
            e.stopPropagation();
            const isSel = selected?.kind === "point" && selected.rowIdx === rowIdx && selected.key === key;
            if (!isSel) {
              if (onSelectElement) onSelectElement({ kind: "point", rowIdx, key, color: lineColor, anchorX: e.clientX, anchorY: e.clientY });
              return; // don't drag yet — first click just selects
            }
            dragRefHack.current = { rowIdx, key };
            (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
          };
          const onMove = (e: React.PointerEvent) => {
            const ds = dragRefHack.current;
            if (!ds || !onUpdateRow) return;
            const cv = valueAt(e);
            if (cv == null) return;
            // For stacked, the displayed value is cumulative; we want the
            // raw series value, so subtract the underlying baseline.
            if (stacked && si > 0) {
              const baseAt = renderedSeries[si - 1].cumValues[ds.rowIdx];
              onUpdateRow(ds.rowIdx, { [ds.key]: niceRound(Math.max(0, cv - baseAt)) });
            } else {
              onUpdateRow(ds.rowIdx, { [ds.key]: niceRound(cv) });
            }
          };
          const onUp = () => { dragRefHack.current = null; };
          const lastIdx = s.cumValues.length - 1;
          const lastVal = s.cumValues[lastIdx];
          return (
            <g key={si} style={{ animation: `cm2BarRise 0.6s cubic-bezier(.2,.7,.2,1) both`, animationDelay: `${si * 60}ms` }}>
              <path d={path} fill="none" stroke={lineColor} strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" />
              {s.cumValues.map((v, i) => {
                const ptSel = selected?.kind === "point" && selected.rowIdx === i && selected.key === key;
                return (
                  <g key={i}>
                    {ptSel && (
                      <circle cx={xOf(i)} cy={yOf(v)} r={11} fill="none" stroke={C.amber} strokeWidth={2} filter="url(#cm2SelGlow)">
                        <animate attributeName="opacity" values="0.7;1.0;0.7" dur="1.6s" repeatCount="indefinite" />
                      </circle>
                    )}
                    <circle
                      cx={xOf(i)} cy={yOf(v)} r="6"
                      fill={cc.barBorder}
                      stroke={ptSel ? C.amber : lineColor}
                      strokeWidth={ptSel ? 2.6 : 2}
                      onPointerDown={onDown(i)}
                      onPointerMove={onMove}
                      onPointerUp={onUp}
                      onContextMenu={e => {
                        e.preventDefault(); e.stopPropagation();
                        if (onSelectElement) onSelectElement({ kind: "point", rowIdx: i, key, color: lineColor, anchorX: e.clientX, anchorY: e.clientY });
                        if (onOpenWheel) onOpenWheel(e.clientX, e.clientY);
                      }}
                      style={{ cursor: onUpdateRow ? "pointer" : "default" }}
                    />
                  </g>
                );
              })}
              {/* Data point markers */}
              {cfg.markerShape && cfg.markerShape !== "none" && s.cumValues.map((v, i) => {
                const mx = xOf(i), my = yOf(v);
                if (cfg.markerShape === "circle") return <circle key={"mk"+i} cx={mx} cy={my} r={4} fill={lineColor} stroke="none" pointerEvents="none" />;
                if (cfg.markerShape === "square") return <rect key={"mk"+i} x={mx-4} y={my-4} width={8} height={8} fill={lineColor} stroke="none" pointerEvents="none" />;
                if (cfg.markerShape === "diamond") return <polygon key={"mk"+i} points={`${mx},${my-5} ${mx+5},${my} ${mx},${my+5} ${mx-5},${my}`} fill={lineColor} stroke="none" pointerEvents="none" />;
                return null;
              })}
              {/* Series end-label */}
              {cfg.showEndLabels && lastVal >= tickMin && lastVal <= tickMax && (
                <text
                  x={xOf(lastIdx) + 8}
                  y={yOf(lastVal)}
                  textAnchor="start"
                  fill={lineColor}
                  style={{ fontFamily: fontSans, fontSize: 11, fontWeight: 700, pointerEvents: "none" }}
                >{s.label}</text>
              )}
            </g>
          );
        });
      })()}
      {/* X-axis labels · time ticks when categories are dates, else category names */}
      {useTime ? (
        <>
          {timeTicks.map((t, i) => {
            const x = leftPad + ((t - tMin) / tSpan) * chartW;
            if (x < leftPad - 4 || x > leftPad + chartW + 4) return null;
            return <text key={"tt-" + i} x={x} y={chartH + 22} textAnchor="middle" fill={cc.muted} style={{ fontFamily: fontMono, fontSize: 10, fontWeight: 700, letterSpacing: 0.4 }}>{formatTick(t, timeUnit)}</text>;
          })}
          {/* Per-point chip labels above each point — ports the SA
              "labels row beneath data" rendering from ChartMaker 1.
              Only the first series gets labels; pulls from `_label_*`
              columns if present. */}
          {renderedSeries.length > 0 && categories.map((_, i) => {
            const labelKey = "_label_" + seriesKeys[0];
            const lbl = String(sheet.rows[i]?.[labelKey] ?? "");
            if (!lbl) return null;
            return <text key={"chip-" + i} x={xOf(i)} y={yOf(renderedSeries[0].cumValues[i]) - 14} textAnchor="middle" fill={colorOf(seriesKeys[0], 0)} style={{ fontFamily: fontMono, fontSize: 10, fontWeight: 800, letterSpacing: 0.5 }}>{lbl}</text>;
          })}
        </>
      ) : (
        categories.map((cat, i) => (
          <text key={i} x={xOf(i)} y={chartH + 22} textAnchor="middle" fill={cc.muted} style={{ fontFamily: fontSans, fontSize: 11, fontWeight: 600 }}>{cat}</text>
        ))
      )}
      {cfg.legendPos === "left" && <Legend series={series.map((s, si) => ({ key: seriesKeys[si], label: s.label, color: colorOf(seriesKeys[si], si) }))} W={W} y={10} leftPad={0} textColor={cc.muted} vertical vertX={2} chartH={chartH} sideW={SIDE_LEGEND_W} />}
      {cfg.legendPos === "right" && <Legend series={series.map((s, si) => ({ key: seriesKeys[si], label: s.label, color: colorOf(seriesKeys[si], si) }))} W={W} y={10} leftPad={0} textColor={cc.muted} vertical vertX={W - SIDE_LEGEND_W} chartH={chartH} sideW={SIDE_LEGEND_W} />}
      {(cfg.legendPos === "top" || cfg.legendPos === "bottom") && <Legend series={series.map((s, si) => ({ key: seriesKeys[si], label: s.label, color: colorOf(seriesKeys[si], si) }))} W={W} y={cfg.legendPos === "top" ? -28 : chartH + 36} leftPad={leftPad} textColor={cc.muted} />}
    </ChartFrame>
  );
}

function Pie({ sheet, cfg, W, H, doughnut = false }: { sheet: DataSheet; cfg: ChartConfig; W: number; H: number; doughnut?: boolean }) {
  const palette = THEMES[cfg.theme].colors;
  const cc = chartColors(cfg);
  const labelCol = sheet.schema[0];
  const valueCol = sheet.schema.find(c => c.type === "number") || sheet.schema[1];
  const rawItems = sheet.rows.map(r => ({ label: String(r[labelCol.key] ?? ""), value: Number(r[valueCol.key]) || 0 }))
    .filter(it => it.value > 0);
  const rawTotal = rawItems.reduce((a, it) => a + it.value, 0) || 1;
  const threshold = cfg.pieOtherThreshold ?? 3;
  // Aggregate small slices into "Other"
  const otherVal = threshold > 0 ? rawItems.filter(it => (it.value / rawTotal) * 100 < threshold).reduce((a, it) => a + it.value, 0) : 0;
  const mainItems = threshold > 0 ? rawItems.filter(it => (it.value / rawTotal) * 100 >= threshold) : rawItems;
  const items = otherVal > 0 ? [...mainItems, { label: "Other", value: otherVal, isOther: true }] : mainItems.map(it => ({ ...it, isOther: false }));
  const total = items.reduce((a, it) => a + it.value, 0) || 1;

  const cx = W / 2;
  const cy = H / 2 + 20;
  const R = Math.min(W, H - 80) / 2 - 50;
  const innerR = doughnut ? R * 0.55 : 0;

  let angle = -Math.PI / 2;
  const arcs = items.map((it, i) => {
    const portion = it.value / total;
    const a0 = angle;
    const a1 = angle + portion * Math.PI * 2;
    angle = a1;
    const large = portion > 0.5 ? 1 : 0;
    const x0 = cx + Math.cos(a0) * R, y0 = cy + Math.sin(a0) * R;
    const x1 = cx + Math.cos(a1) * R, y1 = cy + Math.sin(a1) * R;
    const ix0 = cx + Math.cos(a0) * innerR, iy0 = cy + Math.sin(a0) * innerR;
    const ix1 = cx + Math.cos(a1) * innerR, iy1 = cy + Math.sin(a1) * innerR;
    const path = doughnut
      ? `M ${x0} ${y0} A ${R} ${R} 0 ${large} 1 ${x1} ${y1} L ${ix1} ${iy1} A ${innerR} ${innerR} 0 ${large} 0 ${ix0} ${iy0} Z`
      : `M ${cx} ${cy} L ${x0} ${y0} A ${R} ${R} 0 ${large} 1 ${x1} ${y1} Z`;
    const labelA = (a0 + a1) / 2;
    const labelR = R + 24;
    return {
      label: it.label, value: it.value, portion, color: (it as {isOther?: boolean}).isOther ? SA_METAL : palette[i % palette.length], path,
      labelX: cx + Math.cos(labelA) * labelR,
      labelY: cy + Math.sin(labelA) * labelR,
    };
  });

  return (
    <g>
      <rect x="0" y="0" width={W} height={H} fill="transparent" />
      <text x="56" y="28" fill={cc.text} style={{ fontFamily: fontSans, fontSize: 18, fontWeight: 900 }}>{cfg.title}</text>
      <text x="56" y="48" fill={cc.muted} style={{ fontFamily: fontMono, fontSize: 10, letterSpacing: 1 }}>{cfg.subtitle.toUpperCase()}</text>
      {arcs.map((a, i) => (
        <g key={i}>
          <path d={a.path} fill={a.color} stroke={cfg.showBorders ? cc.barBorder : "none"} strokeWidth={cfg.showBorders ? 1.5 : 0} />
          {a.portion > 0.04 && (
            <text x={a.labelX} y={a.labelY} textAnchor={a.labelX < cx ? "end" : "start"} fill={cc.text} style={{ fontFamily: fontSans, fontSize: 11, fontWeight: 700 }}>
              <tspan>{a.label}</tspan>
              <tspan x={a.labelX} dy="14" fill={cc.muted} style={{ fontFamily: fontMono, fontSize: 10, fontWeight: 600 }}>{Math.round(a.portion * 100)}%</tspan>
            </text>
          )}
        </g>
      ))}
      {doughnut && (
        <text x={cx} y={cy + 4} textAnchor="middle" fill={cc.text} style={{ fontFamily: fontSans, fontSize: 22, fontWeight: 900 }}>{fmtVal(total, cfg.numFmt)}</text>
      )}
    </g>
  );
}

function Scatter({ sheet, cfg, W, H, bubble = false }: { sheet: DataSheet; cfg: ChartConfig; W: number; H: number; bubble?: boolean }) {
  const palette = THEMES[cfg.theme].colors;
  const cc = chartColors(cfg);
  const labelCol = sheet.schema.find(c => c.type === "text");
  const xCol = sheet.schema.find(c => c.key === "x" || (c.type === "number" && c.label.toLowerCase() === "x")) || sheet.schema.filter(c => c.type === "number")[0];
  const yCol = sheet.schema.find(c => c.key === "y" || (c.type === "number" && c.label.toLowerCase() === "y")) || sheet.schema.filter(c => c.type === "number")[1];
  const sizeCol = sheet.schema.find(c => c.key === "size" || (c.type === "number" && c.label.toLowerCase() === "size"));
  if (!xCol || !yCol) return <text x="10" y="40" fill="#fff">Need X and Y columns</text>;

  const points = sheet.rows.map(r => ({
    label: labelCol ? String(r[labelCol.key] ?? "") : "",
    x: Number(r[xCol.key]) || 0,
    y: Number(r[yCol.key]) || 0,
    size: sizeCol ? (Number(r[sizeCol.key]) || 0) : 0,
  }));

  const leftPad = 56, rightPad = 24, topPad = 70, bottomPad = 48;
  const chartW = W - leftPad - rightPad;
  const chartH = H - topPad - bottomPad;
  const xs = points.map(p => p.x);
  const ys = points.map(p => p.y);
  // Scale range = data min/max with 5% padding on each side. Ticks come
  // from niceTicks but only inform labels; the range is what positions
  // points. Previously the range used niceTicks[0]/[last] which could
  // start ABOVE the actual min, pushing points off-canvas to the left.
  const xMin = Math.min(...xs), xMax = Math.max(...xs);
  const yMin = Math.min(...ys), yMax = Math.max(...ys);
  const xPad = (xMax - xMin || 1) * 0.06;
  const yPad = (yMax - yMin || 1) * 0.08;
  // Allow manual override (cfg.xMin/xMax/yMin/yMax) to pin scatter axes.
  const xRangeMin = cfg.xMin !== undefined ? cfg.xMin : xMin - xPad;
  const xRangeMax = cfg.xMax !== undefined ? cfg.xMax : xMax + xPad;
  const yRangeMin = cfg.yMin !== undefined ? cfg.yMin : yMin - yPad;
  const yRangeMax = cfg.yMax !== undefined ? cfg.yMax : yMax + yPad;
  const xTicks = niceTicks(xRangeMin, xRangeMax, 5).filter(t => t >= xRangeMin && t <= xRangeMax);
  const yTicks = niceTicks(yRangeMin, yRangeMax, 5).filter(t => t >= yRangeMin && t <= yRangeMax);
  const xOf = (v: number) => leftPad + ((v - xRangeMin) / Math.max(0.0001, xRangeMax - xRangeMin)) * chartW;
  const yOf = (v: number) => chartH - ((v - yRangeMin) / Math.max(0.0001, yRangeMax - yRangeMin)) * chartH;
  const sizes = points.map(p => p.size);
  const sMax = Math.max(1, ...sizes);
  const radius = (s: number) => bubble ? Math.max(4, Math.sqrt(s / sMax) * 28) : 6;

  return (
    <ChartFrame cfg={cfg} W={W} H={H} leftPad={leftPad} rightPad={rightPad} topPad={topPad} bottomPad={bottomPad}>
      {yTicks.map(t => (
        <g key={"y" + t}>
          {cfg.showGridlines !== false && <line x1={leftPad} x2={W - rightPad} y1={yOf(t)} y2={yOf(t)} stroke={cc.grid} strokeWidth="1" />}
          <text x={leftPad - 8} y={yOf(t) + 4} textAnchor="end" fill={cc.muted} style={{ fontFamily: fontMono, fontSize: 10 }}>{fmtVal(t, cfg.numFmt)}</text>
        </g>
      ))}
      {xTicks.map(t => (
        <text key={"x" + t} x={xOf(t)} y={chartH + 22} textAnchor="middle" fill={cc.muted} style={{ fontFamily: fontMono, fontSize: 10 }}>{fmtVal(t, cfg.numFmt)}</text>
      ))}
      {points.map((p, i) => (
        <g key={i}>
          <circle cx={xOf(p.x)} cy={yOf(p.y)} r={radius(p.size)} fill={palette[i % palette.length]} fillOpacity="0.6" stroke={palette[i % palette.length]} strokeWidth="1.5" />
          <text x={xOf(p.x)} y={yOf(p.y) - radius(p.size) - 6} textAnchor="middle" fill={cc.text} style={{ fontFamily: fontSans, fontSize: 10, fontWeight: 700 }}>{p.label}</text>
        </g>
      ))}
    </ChartFrame>
  );
}

function Waterfall({ sheet, cfg, W, H }: CatProps) {
  const palette = THEMES[cfg.theme].colors;
  const cc = chartColors(cfg);
  const posColor = palette[0];
  const negColor = C.coral;
  const totalColor = palette[1] || palette[0];

  const labelCol = sheet.schema[0];
  const valCol = sheet.schema.find(c => c.type === "number") || sheet.schema[1];
  const items = sheet.rows.map((r, i) => ({
    label: String(r[labelCol.key] ?? ""),
    value: Number(r[valCol.key]) || 0,
    isStartEnd: i === 0 || i === sheet.rows.length - 1,
  }));

  const leftPad = 56, rightPad = 24, topPad = 70, bottomPad = 48;
  const chartW = W - leftPad - rightPad;
  const chartH = H - topPad - bottomPad;
  const groupW = chartW / items.length;
  const barW = Math.min(groupW * ((cfg.barWidthPct ?? 65) / 100), 100);

  // Compute running totals and bar positions
  let running = 0;
  const segments = items.map((it, i) => {
    if (it.isStartEnd) {
      const v = it.value;
      const seg = { y0: 0, y1: v, label: v, color: totalColor, isTotal: true, cum: v };
      running = i === 0 ? v : running;
      return seg;
    } else {
      const y0 = running;
      running += it.value;
      const y1 = running;
      const isUp = it.value >= 0;
      return { y0: Math.min(y0, y1), y1: Math.max(y0, y1), label: it.value, color: isUp ? posColor : negColor, isTotal: false, cum: running };
    }
  });

  const minV = Math.min(0, ...segments.map(s => s.y0));
  const maxV = Math.max(...segments.map(s => s.y1));
  const ticks = niceTicks(minV, maxV, 5);
  const tickMin = ticks[0], tickMax = ticks[ticks.length - 1];
  const yOf = (v: number) => chartH - ((v - tickMin) / Math.max(0.0001, tickMax - tickMin)) * chartH;

  return (
    <ChartFrame cfg={cfg} W={W} H={H} leftPad={leftPad} rightPad={rightPad} topPad={topPad} bottomPad={bottomPad}>
      {ticks.map(t => (
        <g key={t}>
          {cfg.showGridlines !== false && <line x1={leftPad} x2={W - rightPad} y1={yOf(t)} y2={yOf(t)} stroke={cc.grid} strokeWidth="1" />}
          <text x={leftPad - 8} y={yOf(t) + 4} textAnchor="end" fill={cc.muted} style={{ fontFamily: fontMono, fontSize: 10 }}>{fmtVal(t, cfg.numFmt)}</text>
        </g>
      ))}
      {segments.map((seg, i) => {
        const x = leftPad + i * groupW + (groupW - barW) / 2;
        const y = yOf(seg.y1);
        const h = Math.max(0, yOf(seg.y0) - yOf(seg.y1));
        return (
          <g key={i} style={{ animation: `cm2BarRise 0.6s cubic-bezier(.2,.7,.2,1) both`, animationDelay: `${i * 30}ms`, transformOrigin: `${x + barW / 2}px ${H - bottomPad}px`, transformBox: "fill-box" as React.CSSProperties["transformBox"] }}>
            <rect x={x} y={y} width={barW} height={h} fill={seg.color} fillOpacity={seg.isTotal ? 0.92 : 0.85} stroke={cfg.showBorders ? cc.barBorder : "none"} strokeWidth={cfg.showBorders ? 1 : 0} />
            {/* Connector line to next */}
            {i < segments.length - 1 && !segments[i + 1].isTotal && (
              <line x1={x + barW} x2={leftPad + (i + 1) * groupW + (groupW - barW) / 2} y1={yOf(seg.cum)} y2={yOf(seg.cum)} stroke={cc.gridStrong} strokeDasharray="3 3" />
            )}
            <text x={x + barW / 2} y={y - 6} textAnchor="middle" fill={cc.text} style={{ fontFamily: fontMono, fontSize: 10, fontWeight: 700 }}>{(seg.label as number) >= 0 ? "+" : ""}{fmtVal(seg.label as number, cfg.numFmt)}</text>
            <text x={leftPad + i * groupW + groupW / 2} y={chartH + 22} textAnchor="middle" fill={cc.muted} style={{ fontFamily: fontSans, fontSize: 11, fontWeight: 600 }}>{items[i].label}</text>
          </g>
        );
      })}
    </ChartFrame>
  );
}

// Free-form text callout · drag to move, double-click to edit inline,
// right-click to delete. Stored at SVG-viewBox coords so size scales
// with the chart container.
function CalloutNode({ annot, onMove, onEdit, onDelete }: {
  annot: Extract<Annotation, { kind: "callout" }>;
  onMove: (x: number, y: number) => void;
  onEdit: (text: string) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const dragRef = useRef<{ x0: number; y0: number; ax0: number; ay0: number } | null>(null);
  const tw = Math.max(40, annot.text.length * 6.6 + 16);
  const onDown = (e: React.PointerEvent) => {
    if (editing) return;
    e.stopPropagation();
    const pt = pointerToSvg(e, e.currentTarget);
    if (!pt) return;
    dragRef.current = { x0: pt.x, y0: pt.y, ax0: annot.x, ay0: annot.y };
    (e.target as Element).setPointerCapture?.(e.pointerId);
  };
  const onMv = (e: React.PointerEvent) => {
    const ds = dragRef.current;
    if (!ds) return;
    const pt = pointerToSvg(e, e.currentTarget);
    if (!pt) return;
    onMove(Math.round(ds.ax0 + (pt.x - ds.x0)), Math.round(ds.ay0 + (pt.y - ds.y0)));
  };
  const onUp = () => { dragRef.current = null; };
  const onContextMenu = (e: React.MouseEvent) => { e.preventDefault(); onDelete(); };
  return (
    <g
      transform={`translate(${annot.x}, ${annot.y})`}
      onPointerDown={onDown}
      onPointerMove={onMv}
      onPointerUp={onUp}
      onDoubleClick={() => setEditing(true)}
      onContextMenu={onContextMenu}
      style={{ cursor: editing ? "text" : "grab" }}
    >
      <rect x="0" y="-14" width={tw} height="22" rx="4" fill="#0A0A0E" stroke={annot.color || C.amber} strokeWidth="1" opacity="0.95" />
      {editing ? (
        <foreignObject x="0" y="-14" width={Math.max(120, tw)} height="22">
          <input
            autoFocus
            defaultValue={annot.text}
            onBlur={e => { onEdit((e.target as HTMLInputElement).value); setEditing(false); }}
            onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); if (e.key === "Escape") setEditing(false); }}
            style={{ width: "100%", height: "100%", padding: "0 8px", background: "transparent", border: "none", color: "#E8E4DD", fontFamily: fontMono, fontSize: 11, fontWeight: 700, outline: "none", boxSizing: "border-box" }}
          />
        </foreignObject>
      ) : (
        <text x={tw / 2} y="2" textAnchor="middle" fill={annot.color || C.amber} style={{ fontFamily: fontMono, fontSize: 11, fontWeight: 800, letterSpacing: 0.3, userSelect: "none" }}>{annot.text}</text>
      )}
    </g>
  );
}

// Annotations layer · reference lines, CAGR arrows, and Δ markers.
// `getBarTop(rowIdx, key)` resolves to {x, y, value} of the targeted bar's
// top in chart-local coords (after the ChartFrame translate).
function AnnotationLayer({ annotations, getBarTop, getColumnTop, getSeriesEndPoint, chartW, chartH, leftPad, topPad, tickMax, yOf, fmt }: {
  annotations: Annotation[];
  getX?: (rowIdx: number) => number;
  getBarTop: (rowIdx: number, key: string) => { x: number; y: number; value: number };
  // Optional · column total top (used by `totalDiff` annotations)
  getColumnTop?: (rowIdx: number) => { x: number; y: number; total: number };
  // Optional · last point of a series (used by `seriesCagr` annotations)
  getSeriesEndPoint?: (seriesKey: string) => { x: number; y: number; first: number; last: number; steps: number; color: string } | null;
  chartW: number;
  chartH: number;
  leftPad: number;
  topPad: number;
  tickMax: number;
  yOf: (v: number) => number;
  fmt: NumberFormat;
}) {
  // Suppress unused
  void chartW; void chartH; void leftPad; void topPad;
  return (
    <g pointerEvents="none">
      {annotations.map(a => {
        if (a.kind === "refline") {
          const v = a.value;
          if (v < 0 || v > tickMax) return null;
          const y = yOf(v);
          return (
            <g key={a.id}>
              <line x1={leftPad} x2={leftPad + chartW} y1={y} y2={y} stroke={a.color || "#E06347"} strokeWidth="1.6" strokeDasharray="4 4" opacity="0.85" />
              <rect x={leftPad + chartW - 8} y={y - 9} width={4 + (a.label || fmtVal(v, fmt)).length * 6.2} height="18" rx="3" fill={a.color || "#E06347"} transform={`translate(-${4 + (a.label || fmtVal(v, fmt)).length * 6.2}, 0)`} />
              <text x={leftPad + chartW - 12} y={y + 4} textAnchor="end" fill="#fff" style={{ fontFamily: fontMono, fontSize: 10, fontWeight: 800, letterSpacing: 0.5 }}>{a.label || fmtVal(v, fmt)}</text>
            </g>
          );
        }
        if (a.kind === "cagr" || a.kind === "diff") {
          const A = getBarTop(a.rowFrom, a.seriesKey);
          const B = getBarTop(a.rowTo, a.seriesKey);
          if (!A || !B) return null;
          const arcTop = Math.min(A.y, B.y) - 36;
          const midX = (A.x + B.x) / 2;
          const path = `M ${A.x} ${A.y} Q ${midX} ${arcTop} ${B.x} ${B.y}`;
          let labelText = "";
          if (a.kind === "cagr") {
            const steps = Math.abs(a.rowTo - a.rowFrom);
            const pct = cagrPct(A.value, B.value, steps);
            labelText = (pct >= 0 ? "+" : "") + pct.toFixed(1) + "% CAGR";
          } else {
            const delta = B.value - A.value;
            labelText = (delta >= 0 ? "+" : "") + fmtVal(delta, fmt);
          }
          const labelW = labelText.length * 7 + 16;
          return (
            <g key={a.id}>
              <path d={path} fill="none" stroke={C.amber} strokeWidth="2" />
              {/* arrowhead at B */}
              <polygon
                points={`${B.x - 5},${B.y - 10} ${B.x + 5},${B.y - 10} ${B.x},${B.y - 1}`}
                fill={C.amber}
              />
              {/* label pill */}
              <rect x={midX - labelW / 2} y={arcTop - 12} width={labelW} height="20" rx="4" fill="#0A0A0E" stroke={C.amber} strokeWidth="1" />
              <text x={midX} y={arcTop + 2} textAnchor="middle" fill={C.amber} style={{ fontFamily: fontMono, fontSize: 11, fontWeight: 800, letterSpacing: 0.3 }}>{labelText}</text>
            </g>
          );
        }
        if (a.kind === "totalDiff" && getColumnTop) {
          const A = getColumnTop(a.rowFrom);
          const B = getColumnTop(a.rowTo);
          if (!A || !B) return null;
          const arcTop = Math.min(A.y, B.y) - 36;
          const midX = (A.x + B.x) / 2;
          const path = `M ${A.x} ${A.y} Q ${midX} ${arcTop} ${B.x} ${B.y}`;
          const delta = B.total - A.total;
          const pct = A.total !== 0 ? (delta / A.total) * 100 : 0;
          const labelText = "Σ " + (delta >= 0 ? "+" : "") + fmtVal(delta, fmt) + " (" + (pct >= 0 ? "+" : "") + pct.toFixed(0) + "%)";
          const labelW = labelText.length * 6.5 + 18;
          return (
            <g key={a.id}>
              <path d={path} fill="none" stroke="#2EAD8E" strokeWidth="2" strokeDasharray="6 4" />
              <polygon points={`${B.x - 5},${B.y - 10} ${B.x + 5},${B.y - 10} ${B.x},${B.y - 1}`} fill="#2EAD8E" />
              <rect x={midX - labelW / 2} y={arcTop - 12} width={labelW} height="20" rx="4" fill="#0A0A0E" stroke="#2EAD8E" strokeWidth="1" />
              <text x={midX} y={arcTop + 2} textAnchor="middle" fill="#2EAD8E" style={{ fontFamily: fontMono, fontSize: 10, fontWeight: 800, letterSpacing: 0.3 }}>{labelText}</text>
            </g>
          );
        }
        if (a.kind === "seriesCagr" && getSeriesEndPoint) {
          const ep = getSeriesEndPoint(a.seriesKey);
          if (!ep || ep.first <= 0 || ep.last <= 0 || ep.steps <= 0) return null;
          const pct = cagrPct(ep.first, ep.last, ep.steps);
          const txt = "CAGR " + (pct >= 0 ? "+" : "") + pct.toFixed(1) + "%";
          const w = txt.length * 6.6 + 14;
          return (
            <g key={a.id}>
              <rect x={ep.x + 8} y={ep.y - 22} width={w} height="20" rx="4" fill="#0A0A0E" stroke={ep.color} strokeWidth="1" />
              <text x={ep.x + 8 + w / 2} y={ep.y - 8} textAnchor="middle" fill={ep.color} style={{ fontFamily: fontMono, fontSize: 10, fontWeight: 800, letterSpacing: 0.3 }}>{txt}</text>
            </g>
          );
        }
        return null;
      })}
    </g>
  );
}

// Zebra BI-flavored variance chart · AC bars with PY reference markers and
// auto green/red ΔV labels. Schema is (Category, AC, PY); falls back to
// the first two number columns if those exact keys are missing.
function VarianceBar({ sheet, cfg, W, H, onUpdateRow, onShowMenu, onDeleteRow, onShowElementMenu, selected, onSelectElement, onOpenWheel }: CatProps) {
  void onShowMenu; void onDeleteRow;
  const palette = THEMES[cfg.theme].colors;
  const cc = chartColors(cfg);
  const acColor = palette[0];
  const pyColor = "rgba(255,255,255,0.45)";
  const upColor = "#4FBF6B"; // IBCS green = good
  const dnColor = "#E06347"; // IBCS red = bad

  const catCol = sheet.schema[0];
  const numCols = sheet.schema.filter(c => c.type === "number" || c.type === "percent");
  const acCol = numCols.find(c => c.key === "ac") || numCols[0];
  const pyCol = numCols.find(c => c.key === "py") || numCols[1];
  if (!acCol || !pyCol) {
    return <text x={W / 2} y={H / 2} textAnchor="middle" fill={C.txd}>Need AC + PY columns</text>;
  }

  const rows = sheet.rows.map((r, i) => ({
    rowIdx: i,
    cat: String(r[catCol.key] ?? ""),
    ac: Number(r[acCol.key]) || 0,
    py: Number(r[pyCol.key]) || 0,
  }));

  const leftPad = 56, rightPad = 24, topPad = 70, bottomPad = 60;
  const chartW = W - leftPad - rightPad;
  const chartH = H - topPad - bottomPad;
  const maxV = Math.max(0, ...rows.map(r => Math.max(r.ac, r.py)));
  const ticks = niceTicks(0, maxV, 5);
  const tickMax = ticks[ticks.length - 1];
  const yOf = (v: number) => chartH - (v / tickMax) * chartH;

  const groupW = chartW / rows.length;
  const barW = Math.min(groupW * ((cfg.barWidthPct ?? 65) / 100), 100);

  // Wave 11 · click-to-select then drag the top handle.
  const dragRef = useRef<{ rowIdx: number } | null>(null);
  const valueAt = (e: React.PointerEvent): number | null => {
    const pt = pointerToSvg(e, e.currentTarget);
    if (!pt) return null;
    const localY = pt.y - topPad;
    return Math.max(0, tickMax * (1 - localY / chartH));
  };
  const onBodyDown = (rowIdx: number) => (e: React.PointerEvent) => {
    if (!onUpdateRow) return;
    e.stopPropagation();
    if (e.button !== 0) return;
    if (onSelectElement) onSelectElement({ kind: "segment", rowIdx, key: acCol.key, color: acColor, anchorX: e.clientX, anchorY: e.clientY });
  };
  const onTopHandleDown = (rowIdx: number) => (e: React.PointerEvent) => {
    if (!onUpdateRow) return;
    e.stopPropagation();
    e.preventDefault();
    dragRef.current = { rowIdx };
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    const v = valueAt(e);
    if (v != null) onUpdateRow(rowIdx, { [acCol.key]: niceRound(v) });
  };
  const onMove = (e: React.PointerEvent) => {
    const ds = dragRef.current;
    if (!ds || !onUpdateRow) return;
    const v = valueAt(e);
    if (v != null) onUpdateRow(ds.rowIdx, { [acCol.key]: niceRound(v) });
  };
  const onUp = () => { dragRef.current = null; };

  return (
    <ChartFrame cfg={cfg} W={W} H={H} leftPad={leftPad} rightPad={rightPad} topPad={topPad} bottomPad={bottomPad}>
      {ticks.map(t => (
        <g key={t}>
          {cfg.showGridlines !== false && <line x1={leftPad} x2={W - rightPad} y1={yOf(t)} y2={yOf(t)} stroke={cc.grid} strokeWidth="1" />}
          <text x={leftPad - 8} y={yOf(t) + 4} textAnchor="end" fill={cc.muted} style={{ fontFamily: fontMono, fontSize: 10 }}>{fmtVal(t, cfg.numFmt)}</text>
        </g>
      ))}
      {rows.map((r, i) => {
        const cx = leftPad + i * groupW + (groupW - barW) / 2;
        const yAc = yOf(r.ac);
        const yPy = yOf(r.py);
        const delta = r.ac - r.py;
        const pct = r.py !== 0 ? (delta / r.py) * 100 : 0;
        const up = delta >= 0;
        const arrowColor = up ? upColor : dnColor;
        return (
          <g key={i} style={{ animation: `cm2BarRise 0.6s cubic-bezier(.2,.7,.2,1) both`, animationDelay: `${i * 30}ms`, transformOrigin: `${cx + barW / 2}px ${H - bottomPad}px`, transformBox: "fill-box" as React.CSSProperties["transformBox"] }}>
            {/* AC bar (filled) */}
            <rect
              x={cx} y={yAc} width={barW} height={chartH - yAc}
              fill={acColor}
              onPointerDown={onBodyDown(i)}
              onContextMenu={e => {
                e.preventDefault(); e.stopPropagation();
                if (onSelectElement) onSelectElement({ kind: "segment", rowIdx: i, key: acCol.key, color: acColor, anchorX: e.clientX, anchorY: e.clientY });
                if (onOpenWheel) { onOpenWheel(e.clientX, e.clientY); return; }
                if (onShowElementMenu) {
                  onShowElementMenu({ x: e.clientX, y: e.clientY, kind: "bar", rowIdx: i, seriesKey: acCol.key, currentColor: cfg.seriesColors?.[acCol.key] });
                }
              }}
              style={{ cursor: onUpdateRow ? "pointer" : "default" }}
            />
            {selected?.kind === "segment" && selected.rowIdx === i && selected.key === acCol.key && (
              <SelectionHandles
                x={cx} y={yAc} w={barW} h={chartH - yAc}
                onTopHandleDown={onTopHandleDown(i)}
                onTopHandleMove={onMove}
                onTopHandleUp={onUp}
              />
            )}
            {/* PY reference bracket — small horizontal mark on top of where PY would land */}
            <line x1={cx - 3} x2={cx + barW + 3} y1={yPy} y2={yPy} stroke={pyColor} strokeWidth="2" strokeDasharray="3 3" />
            <text x={cx + barW + 6} y={yPy + 3} fill={pyColor} style={{ fontFamily: fontMono, fontSize: 9, fontWeight: 700, pointerEvents: "none" }}>PY {fmtVal(r.py, cfg.numFmt)}</text>
            {/* AC value label inside or above bar */}
            <text x={cx + barW / 2} y={yAc - 6} textAnchor="middle" fill={cc.text} style={{ fontFamily: fontMono, fontSize: 11, fontWeight: 800, pointerEvents: "none" }}>{fmtVal(r.ac, cfg.numFmt)}</text>
            {/* Variance arrow + label · IBCS green = good, red = bad */}
            <g transform={`translate(${cx + barW / 2}, ${chartH + 16})`}>
              <polygon
                points={up ? "-4,-4 4,-4 0,3" : "-4,4 4,4 0,-3"}
                fill={arrowColor}
              />
              <text y={20} textAnchor="middle" fill={arrowColor} style={{ fontFamily: fontMono, fontSize: 11, fontWeight: 800, letterSpacing: 0.3, pointerEvents: "none" }}>{(up ? "+" : "")}{fmtVal(delta, cfg.numFmt)}</text>
              <text y={34} textAnchor="middle" fill={arrowColor} style={{ fontFamily: fontMono, fontSize: 9, fontWeight: 700, letterSpacing: 0.3, pointerEvents: "none", opacity: 0.85 }}>{(up ? "+" : "")}{Math.abs(pct) < 100 ? pct.toFixed(1) : pct.toFixed(0)}%</text>
            </g>
            {/* Category label (above the variance arrow) */}
            <text x={cx + barW / 2} y={chartH + 4} textAnchor="middle" fill={cc.muted} style={{ fontFamily: fontSans, fontSize: 11, fontWeight: 600 }}>{r.cat}</text>
          </g>
        );
      })}
      <Legend
        series={[
          { label: "AC", color: acColor },
          { label: "PY", color: "#A8A4A0" },
          { label: "Δ ▲", color: upColor },
          { label: "Δ ▼", color: dnColor },
        ]}
        W={W}
        y={H - topPad - 4}
        leftPad={leftPad}
        textColor={cc.muted}
      />
    </ChartFrame>
  );
}

function Legend({ series, W, y, leftPad, onSwatchClick, textColor, vertical, vertX, chartH, sideW }: { series: Array<{ label: string; color: string; key?: string }>; W: number; y: number; leftPad: number; onSwatchClick?: (key: string, e: React.MouseEvent) => void; textColor?: string; vertical?: boolean; vertX?: number; chartH?: number; sideW?: number }) {
  const tc = textColor || C.txm;
  const Swatch = ({ s, big }: { s: typeof series[number]; big?: boolean }) => (
    <rect
      x={big ? -10 : 0} y={big ? -10 : -8} width={big ? 20 : 14} height={big ? 20 : 14} rx={big ? 4 : 3} fill={s.color}
      stroke={onSwatchClick ? "rgba(255,255,255,0.20)" : "none"} strokeWidth={onSwatchClick ? 1 : 0}
      onClick={onSwatchClick && s.key ? (e => onSwatchClick(s.key!, e)) : undefined}
      style={{ cursor: onSwatchClick ? "pointer" : "default" }}
    >{onSwatchClick && <title>Click to recolor this series</title>}</rect>
  );
  if (vertical) {
    // Vertical legend · stacked layout (swatch on top, label below). Spread out
    // and vertically centered within the chart area. Each item ~52px tall.
    const itemH = 52;
    const totalH = series.length * itemH;
    const colW = sideW ?? 100;
    const colX = (vertX ?? 2) + colW / 2;  // horizontal center of the legend column
    const startY = (y) + Math.max(0, ((chartH ?? totalH) - totalH) / 2);
    return (
      <g>
        {series.map((s, i) => {
          const itemY = startY + i * itemH + itemH / 2;
          return (
            <g key={i} transform={`translate(${colX}, ${itemY})`}>
              <Swatch s={s} big />
              <text x="0" y="22" textAnchor="middle" fill={tc} style={{ fontFamily: fontMono, fontSize: 10, fontWeight: 800, letterSpacing: 0.8 }}>{s.label.toUpperCase()}</text>
            </g>
          );
        })}
      </g>
    );
  }
  // horizontal — center within W, fall back to leftPad if items overflow
  const itemW = 110;
  const totalW = series.length * itemW;
  const startX = Math.max(leftPad, (W - totalW) / 2);
  return (
    <g>
      {series.map((s, i) => (
        <g key={i} transform={`translate(${startX + i * itemW}, ${y})`}>
          <Swatch s={s} />
          <text x="20" y="3" fill={tc} style={{ fontFamily: fontMono, fontSize: 10, letterSpacing: 0.5 }}>{s.label.toUpperCase()}</text>
        </g>
      ))}
    </g>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// GANTT (preserved from v1, unified with picker)
// ═══════════════════════════════════════════════════════════════════════════
interface RawTask { task: string; start: number; end: number; group?: string; owner?: string; progress?: number; isMilestone?: boolean; shape?: "bar" | "milestone" | "dotted"; color?: string; sheetIdx: number }
interface GroupBlock { key: string; label: string; color: string; start: number; end: number; tasks: RawTask[] }
type TimeUnit = "week" | "month" | "quarter";

function parseDateMs(s: string | number): number | null {
  if (typeof s === "number") {
    if (s > 20000 && s < 80000) return Math.round((s - 25569) * 86400 * 1000);
    return s > 1e10 ? s : null;
  }
  const t = String(s).trim();
  if (!t) return null;
  const n = Date.parse(t);
  if (!isNaN(n)) return n;
  const num = Number(t);
  if (!isNaN(num) && num > 20000 && num < 80000) return Math.round((num - 25569) * 86400 * 1000);
  return null;
}

function ganttFromSheet(sheet: DataSheet): RawTask[] {
  const out: RawTask[] = [];
  for (let i = 0; i < sheet.rows.length; i++) {
    const r = sheet.rows[i];
    const task = String(r.task ?? "");
    const startMs = parseDateMs(r.start as string | number);
    const endMs = parseDateMs(r.end as string | number);
    if (!task || !startMs || !endMs) continue;
    const explicitShape = (r.shape as string)?.toLowerCase();
    const shape: RawTask["shape"] | undefined =
      explicitShape === "bar" || explicitShape === "milestone" || explicitShape === "dotted"
        ? (explicitShape as RawTask["shape"])
        : undefined;
    out.push({
      task,
      start: startMs,
      end: Math.max(endMs, startMs),
      group: (r.group as string) || undefined,
      owner: (r.owner as string) || undefined,
      progress: typeof r.progress === "number" ? r.progress : Number(r.progress) || undefined,
      isMilestone: startMs === endMs && shape !== "bar",
      shape,
      color: (r.color as string) || undefined,
      sheetIdx: i,
    });
  }
  return out;
}

// ms → "YYYY-MM-DD" for writing back into the sheet
function msToISODate(ms: number): string {
  const d = new Date(ms);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return y + "-" + m + "-" + dd;
}
const DAY_MS = 86400000;
const snapDay = (ms: number) => Math.round(ms / DAY_MS) * DAY_MS;

function buildGroups(tasks: RawTask[], palette: string[]): GroupBlock[] {
  const map = new Map<string, GroupBlock>();
  let i = 0;
  for (const t of tasks) {
    const key = t.group || "_ungrouped";
    let g = map.get(key);
    if (!g) {
      g = { key, label: t.group || "Tasks", color: palette[i % palette.length], start: t.start, end: t.end, tasks: [] };
      map.set(key, g);
      i++;
    }
    g.tasks.push(t);
    g.start = Math.min(g.start, t.start);
    g.end = Math.max(g.end, t.end);
  }
  return Array.from(map.values());
}

function startOfWeek(ms: number) { const d = new Date(ms); const day = d.getUTCDay() || 7; d.setUTCHours(0, 0, 0, 0); d.setUTCDate(d.getUTCDate() - (day - 1)); return d.getTime(); }
function startOfMonth(ms: number) { const d = new Date(ms); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1); }
function startOfQuarter(ms: number) { const d = new Date(ms); return Date.UTC(d.getUTCFullYear(), Math.floor(d.getUTCMonth() / 3) * 3, 1); }

function buildTicks(min: number, max: number, unit: TimeUnit): number[] {
  const out: number[] = [];
  let cur = unit === "week" ? startOfWeek(min) : unit === "month" ? startOfMonth(min) : startOfQuarter(min);
  while (cur <= max) {
    out.push(cur);
    const d = new Date(cur);
    if (unit === "week") d.setUTCDate(d.getUTCDate() + 7);
    else if (unit === "month") d.setUTCMonth(d.getUTCMonth() + 1);
    else d.setUTCMonth(d.getUTCMonth() + 3);
    cur = d.getTime();
  }
  out.push(cur);
  return out;
}

function formatTick(ms: number, unit: TimeUnit): string {
  const d = new Date(ms);
  const m = d.getUTCMonth();
  const y = d.getUTCFullYear();
  const ms3 = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][m];
  if (unit === "week") return ms3 + " " + d.getUTCDate();
  if (unit === "month") return ms3 + " " + String(y).slice(2);
  return "Q" + (Math.floor(m / 3) + 1) + " " + String(y).slice(2);
}

function fmtDateShort(ms: number) { const d = new Date(ms); return ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][d.getUTCMonth()] + " " + d.getUTCDate(); }
function durationDays(a: number, b: number) { return Math.max(1, Math.round((b - a) / 86400000)); }

// Right-click menu items for a Gantt task. Built as a helper so both
// milestone and bar branches share the same recipe — shape icons, color
// swatches, then text actions.
function ganttContextMenuItems(t: RawTask, effShape: "bar" | "milestone" | "dotted", palette: string[], onUpdateRow?: OnUpdateRow, onDeleteRow?: OnDeleteRow): ContextMenuItem[] {
  const span = Math.max(t.end - t.start, 7 * 86400000);
  return [
    { kind: "iconRow", icons: [
      { Icon: Square,       title: "Bar",       active: effShape === "bar",       onClick: () => onUpdateRow?.(t.sheetIdx, { shape: "bar", end: msToISODate(t.start === t.end ? t.start + span : t.end) }) },
      { Icon: Diamond,      title: "Milestone", active: effShape === "milestone", onClick: () => onUpdateRow?.(t.sheetIdx, { shape: "milestone", end: msToISODate(t.start) }) },
      { Icon: MinusSquare,  title: "Dotted",    active: effShape === "dotted",    onClick: () => onUpdateRow?.(t.sheetIdx, { shape: "dotted", end: msToISODate(t.start === t.end ? t.start + span : t.end) }) },
    ]},
    { kind: "swatchRow", colors: palette, current: t.color, onPick: c => onUpdateRow?.(t.sheetIdx, { color: c || "" }) },
    { label: "", divider: true, onClick: () => {} },
    { label: "Shift +7 days", onClick: () => onUpdateRow?.(t.sheetIdx, { start: msToISODate(t.start + 7 * 86400000), end: msToISODate(t.end + 7 * 86400000) }) },
    { label: "Shift −7 days", onClick: () => onUpdateRow?.(t.sheetIdx, { start: msToISODate(t.start - 7 * 86400000), end: msToISODate(t.end - 7 * 86400000) }) },
    { label: "Set 100% complete", onClick: () => onUpdateRow?.(t.sheetIdx, { progress: 100 }) },
    { label: "Reset progress",    onClick: () => onUpdateRow?.(t.sheetIdx, { progress: 0 }) },
    { label: "", divider: true, onClick: () => {} },
    { label: "Delete task", danger: true, onClick: () => onDeleteRow?.(t.sheetIdx) },
  ];
}

interface GanttOpts {
  unit: TimeUnit;
  showDates: boolean;
  showDuration: boolean;
  showOwner: boolean;
  showProgress: boolean;
  showToday: boolean;
  showGroups: boolean;
  collapseAll: boolean;
  collapsedKeys: Record<string, boolean>;
}

// ─── Mekko % ─────────────────────────────────────────────────────────────────
// Variable-width columns (width ∝ `weight` col), stacked-% bars within each.
function MekkoPercent({ sheet, cfg, W, H, onUpdateRow, selected, onSelectElement, onOpenWheel }: {
  sheet: DataSheet; cfg: ChartConfig; W: number; H: number;
  onUpdateRow?: OnUpdateRow;
  selected?: SelectedElement | null;
  onSelectElement?: OnSelectElement;
  onOpenWheel?: (clientX: number, clientY: number) => void;
}) {
  const { categories, series } = getCategoricalSeries(sheet);
  const palette = THEMES[cfg.theme].colors;
  const cc = chartColors(cfg);
  const leftPad = 56, rightPad = 24, topPad = 70, bottomPad = 48;
  const chartW = W - leftPad - rightPad;
  const chartH = H - topPad - bottomPad;

  // Weight column = "Total" / first number col not already in series
  const weightKey = sheet.schema.find(c => c.key === "weight" || (c.type === "number" && c.label.toLowerCase() === "total"))?.key
    ?? sheet.schema.find(c => c.type === "number")?.key ?? "";
  const weights = sheet.rows.map(r => Math.max(0, Number(r[weightKey]) || 0));
  const totalWeight = weights.reduce((a, b) => a + b, 0) || 1;

  const ticks = [0, 25, 50, 75, 100];
  const yOf = (v: number) => chartH - (v / 100) * chartH;

  // Build column x-positions proportional to weight
  let colX = 0;
  const cols = categories.map((cat, i) => {
    const colW = (weights[i] / totalWeight) * chartW;
    const x = leftPad + colX;
    colX += colW;
    return { cat, x, colW, i };
  });

  // Wave 11 · drag the right edge of a column to resize its weight.
  const colDrag = useRef<{ rowIdx: number; startX: number; startW: number; oldWeight: number } | null>(null);
  const onColDown = (rowIdx: number, startX: number, startW: number) => (e: React.PointerEvent) => {
    if (!onUpdateRow) return;
    e.stopPropagation(); e.preventDefault();
    colDrag.current = { rowIdx, startX, startW, oldWeight: weights[rowIdx] };
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
  };
  const onColMove = (e: React.PointerEvent) => {
    const ds = colDrag.current; if (!ds || !onUpdateRow) return;
    const pt = pointerToSvg(e, e.currentTarget); if (!pt) return;
    const newPxW = Math.max(8, pt.x - ds.startX);
    // Maintain proportionality vs total chart width
    const ratio = newPxW / Math.max(1, ds.startW);
    onUpdateRow(ds.rowIdx, { [weightKey]: niceRound(Math.max(0.1, ds.oldWeight * ratio)) });
  };
  const onColUp = () => { colDrag.current = null; };

  return (
    <ChartFrame cfg={cfg} W={W} H={H} leftPad={leftPad} rightPad={rightPad} topPad={topPad} bottomPad={bottomPad}>
      {ticks.map(t => (
        <g key={t}>
          {cfg.showGridlines !== false && <line x1={leftPad} x2={W - rightPad} y1={yOf(t)} y2={yOf(t)} stroke={cc.grid} strokeWidth="1" />}
          <text x={leftPad - 8} y={yOf(t) + 4} textAnchor="end" fill={cc.muted} style={{ fontFamily: fontMono, fontSize: 10 }}>{t}%</text>
        </g>
      ))}
      {/* 100% indicator — top-of-chart cap line */}
      {cfg.show100Indicator && (
        <line x1={leftPad} x2={W - rightPad} y1={yOf(100)} y2={yOf(100)} stroke={C.amber} strokeWidth={1.5} strokeDasharray="4 3" opacity={0.65} />
      )}
      {cols.map(({ cat, x, colW, i }) => {
        const total = series.reduce((a, s) => a + (s.values[i] ?? 0), 0) || 1;
        let cum = 0;
        // Wave 13 · Mekko applies barWidthPct as the inner column gap so
        // tighter bar-width = wider columns (less inter-column spacing).
        const GAP = colW > 6 ? Math.max(0, (100 - (cfg.barWidthPct ?? 65)) * 0.06) : 0;
        const isColSel = selected?.kind === "mekkoColumn" && selected.rowIdx === i;
        return (
          <g key={i}>
            {/* Click-to-select column hitbox (under segments). */}
            <rect x={x} y={0} width={colW} height={chartH} fill="transparent"
              onPointerDown={e => {
                if (e.button !== 0) return;
                e.stopPropagation();
                if (onSelectElement) onSelectElement({ kind: "mekkoColumn", rowIdx: i, anchorX: e.clientX, anchorY: e.clientY });
              }}
              onContextMenu={e => {
                e.preventDefault(); e.stopPropagation();
                if (onSelectElement) onSelectElement({ kind: "mekkoColumn", rowIdx: i, anchorX: e.clientX, anchorY: e.clientY });
                if (onOpenWheel) onOpenWheel(e.clientX, e.clientY);
              }}
              style={{ cursor: "pointer" }}
            />
            {series.map((s, si) => {
              const pct = ((s.values[i] ?? 0) / total) * 100;
              const y0 = yOf(cum);
              const y1 = yOf(cum + pct);
              cum += pct;
              const bx = x + GAP / 2;
              const bw = Math.max(0, colW - GAP);
              return (
                <g key={si}>
                  <rect x={bx} y={y1} width={bw} height={Math.max(0, y0 - y1)}
                    fill={palette[si % palette.length]}
                    stroke={cfg.showBorders ? cc.barBorder : "none"}
                    strokeWidth={cfg.showBorders ? 1 : 0}
                    pointerEvents="none" />
                  {(y0 - y1) > 16 && bw > 28 && (
                    <text x={bx + bw / 2} y={(y0 + y1) / 2 + 3} textAnchor="middle"
                      fill={cc.onBar} style={{ fontFamily: fontMono, fontSize: 9, fontWeight: 800, pointerEvents: "none" }}>
                      {Math.round(pct)}%
                    </text>
                  )}
                </g>
              );
            })}
            {/* Category label + weight % below the column */}
            <text x={x + colW / 2} y={chartH + 14} textAnchor="middle" fill={cc.muted}
              style={{ fontFamily: fontSans, fontSize: 10, fontWeight: 700, pointerEvents: "none" }}>{cat}</text>
            <text x={x + colW / 2} y={chartH + 28} textAnchor="middle" fill={cc.faint}
              style={{ fontFamily: fontMono, fontSize: 9, pointerEvents: "none" }}>{Math.round((weights[i] / totalWeight) * 100)}%</text>
            {/* Column divider */}
            {i > 0 && <line x1={x} x2={x} y1={0} y2={chartH} stroke={cc.gridStrong} strokeWidth="1" pointerEvents="none" />}
            {/* Selection · column glow + right-edge resize handle */}
            {isColSel && (
              <>
                <rect x={x - 1} y={-1} width={colW + 2} height={chartH + 2}
                  fill="none" stroke={C.amber} strokeWidth={2} filter="url(#cm2SelGlow)" pointerEvents="none">
                  <animate attributeName="opacity" values="0.7;1.0;0.7" dur="1.6s" repeatCount="indefinite" />
                </rect>
                <rect
                  x={x + colW - 4} y={chartH / 2 - 12} width={8} height={24}
                  fill={C.amber} stroke="#FFFFFF" strokeWidth={1.5} rx={2}
                  style={{ cursor: "ew-resize" }}
                  onPointerDown={onColDown(i, x, colW)}
                  onPointerMove={onColMove}
                  onPointerUp={onColUp}
                />
              </>
            )}
          </g>
        );
      })}
      {cfg.legendPos !== "hidden" && (
        <Legend series={series.map((s, si) => ({ label: s.label, color: palette[si % palette.length] }))}
          W={W} y={chartH + 36} leftPad={leftPad} textColor={cc.muted} />
      )}
    </ChartFrame>
  );
}

// ─── Mekko Unit ──────────────────────────────────────────────────────────────
// Absolute Marimekko: column widths proportional to a weight column, bar
// heights show absolute stacked values (not %). Y-axis is numeric, not %.
// Same data schema as Mekko Pct (category, weight/Total, s1, s2, ...).
function MekkoUnit({ sheet, cfg, W, H, onUpdateRow, selected, onSelectElement, onOpenWheel }: {
  sheet: DataSheet; cfg: ChartConfig; W: number; H: number;
  onUpdateRow?: OnUpdateRow;
  selected?: SelectedElement | null;
  onSelectElement?: OnSelectElement;
  onOpenWheel?: (clientX: number, clientY: number) => void;
}) {
  const { categories, series } = getCategoricalSeries(sheet);
  void series;
  const palette = THEMES[cfg.theme].colors;
  const colorOf = (key: string, idx: number) => cfg.seriesColors?.[key] || palette[idx % palette.length];
  const cc = chartColors(cfg);
  const leftPad = 56, rightPad = 24, topPad = 70, bottomPad = 48;
  const chartW = W - leftPad - rightPad;
  const chartH = H - topPad - bottomPad;

  const weightKey = sheet.schema.find(c => c.key === "weight" || (c.type === "number" && c.label.toLowerCase() === "total"))?.key
    ?? sheet.schema.find(c => c.type === "number")?.key ?? "";
  const seriesKeys = sheet.schema.filter(c => (c.type === "number" || c.type === "percent") && c.key !== weightKey).map(c => c.key);
  const weights = sheet.rows.map(r => Math.max(0, Number(r[weightKey]) || 0));
  const totalWeight = weights.reduce((a, b) => a + b, 0) || 1;

  const colTotals = categories.map((_, i) => seriesKeys.reduce((a, k) => a + (Number(sheet.rows[i]?.[k]) || 0), 0));
  const maxTotal = Math.max(0, ...colTotals);
  const ticks = niceTicks(0, maxTotal, 5);
  const tickMax = cfg.yMax !== undefined ? cfg.yMax : (ticks[ticks.length - 1] || 1);
  const yOf = (v: number) => chartH - (v / tickMax) * chartH;

  let colX = 0;
  const cols = categories.map((cat, i) => {
    const colW = (weights[i] / totalWeight) * chartW;
    const x = leftPad + colX;
    colX += colW;
    return { cat, x, colW, i };
  });

  // Wave 11 · column width drag (resizes weight)
  const colDrag = useRef<{ rowIdx: number; startX: number; startW: number; oldWeight: number } | null>(null);
  const onColDown = (rowIdx: number, startX: number, startW: number) => (e: React.PointerEvent) => {
    if (!onUpdateRow) return;
    e.stopPropagation(); e.preventDefault();
    colDrag.current = { rowIdx, startX, startW, oldWeight: weights[rowIdx] };
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
  };
  const onColMove = (e: React.PointerEvent) => {
    const ds = colDrag.current; if (!ds || !onUpdateRow) return;
    const pt = pointerToSvg(e, e.currentTarget); if (!pt) return;
    const newPxW = Math.max(8, pt.x - ds.startX);
    const ratio = newPxW / Math.max(1, ds.startW);
    onUpdateRow(ds.rowIdx, { [weightKey]: niceRound(Math.max(0.1, ds.oldWeight * ratio)) });
  };
  const onColUp = () => { colDrag.current = null; };

  return (
    <ChartFrame cfg={cfg} W={W} H={H} leftPad={leftPad} rightPad={rightPad} topPad={topPad} bottomPad={bottomPad}>
      {ticks.map(t => (
        <g key={t}>
          {cfg.showGridlines !== false && <line x1={leftPad} x2={W - rightPad} y1={yOf(t)} y2={yOf(t)} stroke={cc.grid} strokeWidth="1" />}
          <text x={leftPad - 8} y={yOf(t) + 4} textAnchor="end" fill={cc.muted} style={{ fontFamily: fontMono, fontSize: 10 }}>{fmtVal(t, cfg.numFmt)}</text>
        </g>
      ))}
      {cols.map(({ cat, x, colW, i }) => {
        let cum = 0;
        // Wave 13 · Mekko-Unit · barWidthPct drives inner column gap.
        const GAP = colW > 6 ? Math.max(0, (100 - (cfg.barWidthPct ?? 65)) * 0.06) : 0;
        const isColSel = selected?.kind === "mekkoColumn" && selected.rowIdx === i;
        return (
          <g key={i}>
            <rect x={x} y={0} width={colW} height={chartH} fill="transparent"
              onPointerDown={e => {
                if (e.button !== 0) return;
                e.stopPropagation();
                if (onSelectElement) onSelectElement({ kind: "mekkoColumn", rowIdx: i, anchorX: e.clientX, anchorY: e.clientY });
              }}
              onContextMenu={e => {
                e.preventDefault(); e.stopPropagation();
                if (onSelectElement) onSelectElement({ kind: "mekkoColumn", rowIdx: i, anchorX: e.clientX, anchorY: e.clientY });
                if (onOpenWheel) onOpenWheel(e.clientX, e.clientY);
              }}
              style={{ cursor: "pointer" }}
            />
            {seriesKeys.map((sk, si) => {
              const v = Number(sheet.rows[i]?.[sk]) || 0;
              const y0 = yOf(cum);
              const y1 = yOf(cum + v);
              cum += v;
              const bx = x + GAP / 2;
              const bw = Math.max(0, colW - GAP);
              return (
                <g key={si}>
                  <rect x={bx} y={y1} width={bw} height={Math.max(0, y0 - y1)}
                    fill={colorOf(sk, si)}
                    stroke={cfg.showBorders ? cc.barBorder : "none"}
                    strokeWidth={cfg.showBorders ? 1 : 0}
                    pointerEvents="none" />
                  {cfg.showSegmentLabels && (y0 - y1) > 14 && bw > 24 && (
                    <text x={bx + bw / 2} y={(y0 + y1) / 2 + 3} textAnchor="middle"
                      fill={cc.onBar} style={{ fontFamily: fontMono, fontSize: 9, fontWeight: 800, pointerEvents: "none" }}>
                      {fmtVal(v, cfg.numFmt)}
                    </text>
                  )}
                </g>
              );
            })}
            <text x={x + colW / 2} y={chartH + 14} textAnchor="middle" fill={cc.muted}
              style={{ fontFamily: fontSans, fontSize: 10, fontWeight: 700, pointerEvents: "none" }}>{cat}</text>
            <text x={x + colW / 2} y={chartH + 28} textAnchor="middle" fill={cc.faint}
              style={{ fontFamily: fontMono, fontSize: 9, pointerEvents: "none" }}>{Math.round((weights[i] / totalWeight) * 100)}%</text>
            {i > 0 && <line x1={x} x2={x} y1={0} y2={chartH} stroke={cc.gridStrong} strokeWidth="1" pointerEvents="none" />}
            {isColSel && (
              <>
                <rect x={x - 1} y={-1} width={colW + 2} height={chartH + 2}
                  fill="none" stroke={C.amber} strokeWidth={2} filter="url(#cm2SelGlow)" pointerEvents="none">
                  <animate attributeName="opacity" values="0.7;1.0;0.7" dur="1.6s" repeatCount="indefinite" />
                </rect>
                <rect
                  x={x + colW - 4} y={chartH / 2 - 12} width={8} height={24}
                  fill={C.amber} stroke="#FFFFFF" strokeWidth={1.5} rx={2}
                  style={{ cursor: "ew-resize" }}
                  onPointerDown={onColDown(i, x, colW)}
                  onPointerMove={onColMove}
                  onPointerUp={onColUp}
                />
              </>
            )}
          </g>
        );
      })}
      {cfg.legendPos !== "hidden" && (
        <Legend series={seriesKeys.map((k, si) => ({ key: k, label: sheet.schema.find(c => c.key === k)?.label || k, color: colorOf(k, si) }))}
          W={W} y={chartH + 36} leftPad={leftPad} textColor={cc.muted} />
      )}
    </ChartFrame>
  );
}

// ─── Combo (bar + line) ───────────────────────────────────────────────────────
// All series except the last render as clustered bars; the last series renders
// as a line overlay — useful for actual vs budget or volume vs price.
function ComboChart({ sheet, cfg, W, H }: { sheet: DataSheet; cfg: ChartConfig; W: number; H: number }) {
  const { categories, series } = getCategoricalSeries(sheet);
  const seriesKeys = sheet.schema.slice(1).filter(c => c.type === "number" || c.type === "percent").map(c => c.key);
  const palette = THEMES[cfg.theme].colors;
  const colorOf = (key: string, idx: number) => cfg.seriesColors?.[key] || palette[idx % palette.length];
  const cc = chartColors(cfg);
  const SIDE_LEGEND_W = (cfg.legendPos === "left" || cfg.legendPos === "right") ? 100 : 0;
  const leftPad = cfg.legendPos === "left" ? 56 + SIDE_LEGEND_W : 56;
  const rightPad = cfg.legendPos === "right" ? 24 + SIDE_LEGEND_W : 24;
  const topPad = 70, bottomPad = cfg.legendPos === "top" ? 60 : 48;
  const chartW = W - leftPad - rightPad;
  const chartH = H - topPad - bottomPad;
  const groupW = chartW / Math.max(1, categories.length);

  const barSeries = series.slice(0, Math.max(1, series.length - 1));
  const lineSeries = series[series.length - 1];
  const barSeriesKeys = seriesKeys.slice(0, Math.max(1, seriesKeys.length - 1));
  const lineSeriesKey = seriesKeys[seriesKeys.length - 1];

  const barW = Math.min((groupW / Math.max(1, barSeries.length)) * ((cfg.barWidthPct ?? 65) / 100) * 1.15, 60);
  const barGroupW = barW * barSeries.length;

  const allBarVals = barSeries.flatMap(s => s.values);
  const allLineVals = lineSeries?.values ?? [];
  const allVals = [...allBarVals, ...allLineVals];
  const minV = Math.min(0, ...allVals);
  const maxV = Math.max(0, ...allVals);
  const ticks = niceTicks(minV, maxV, 5);
  const tickMin = cfg.yMin !== undefined ? cfg.yMin : ticks[0];
  const tickMax = cfg.yMax !== undefined ? cfg.yMax : ticks[ticks.length - 1];
  const yOf = (v: number) => chartH - ((v - tickMin) / Math.max(0.0001, tickMax - tickMin)) * chartH;
  const xOf = (i: number) => leftPad + i * groupW + groupW / 2;

  const lineColor = lineSeries ? colorOf(lineSeriesKey, series.length - 1) : palette[0];

  return (
    <ChartFrame cfg={cfg} W={W} H={H} leftPad={leftPad} rightPad={rightPad} topPad={topPad} bottomPad={bottomPad}>
      {ticks.map(t => (
        <g key={t}>
          {cfg.showGridlines !== false && <line x1={leftPad} x2={W - rightPad} y1={yOf(t)} y2={yOf(t)} stroke={cc.grid} strokeWidth="1" />}
          <text x={leftPad - 8} y={yOf(t) + 4} textAnchor="end" fill={cc.muted} style={{ fontFamily: fontMono, fontSize: 10 }}>{fmtVal(t, cfg.numFmt)}</text>
        </g>
      ))}
      {/* Bars */}
      {categories.map((cat, i) => (
        <g key={i} style={{ animation: `cm2BarRise 0.6s cubic-bezier(.2,.7,.2,1) both`, animationDelay: `${i * 30}ms`, transformOrigin: `${leftPad + i * groupW + groupW / 2}px ${H - bottomPad}px`, transformBox: "fill-box" as React.CSSProperties["transformBox"] }}>
          {barSeries.map((s, si) => {
            const color = colorOf(barSeriesKeys[si], si);
            const v = s.values[i] ?? 0;
            const bx = leftPad + i * groupW + (groupW - barGroupW) / 2 + si * barW;
            const barTop = Math.min(yOf(0), yOf(v));
            const barH = Math.abs(yOf(v) - yOf(0));
            return (
              <rect key={si} x={bx} y={barTop} width={barW - 1} height={Math.max(1, barH)}
                fill={color}
                stroke={cfg.showBorders ? cc.barBorder : "none"}
                strokeWidth={cfg.showBorders ? 1 : 0} />
            );
          })}
          <text x={xOf(i)} y={chartH + 22} textAnchor="middle" fill={cc.muted}
            style={{ fontFamily: fontSans, fontSize: 11, fontWeight: 600 }}>{cat}</text>
        </g>
      ))}
      {/* Line overlay */}
      {lineSeries && categories.length >= 2 && (
        <>
          <polyline
            fill="none"
            stroke={lineColor}
            strokeWidth="2.5"
            strokeLinejoin="round"
            strokeLinecap="round"
            points={lineSeries.values.map((v, i) => `${xOf(i)},${yOf(v)}`).join(" ")}
          />
          {lineSeries.values.map((v, i) => (
            <circle key={i} cx={xOf(i)} cy={yOf(v)} r={4}
              fill={lineColor} stroke={cc.barBorder} strokeWidth={1.5} />
          ))}
        </>
      )}
      {/* Legend */}
      {cfg.legendPos === "left" && <Legend series={series.map((s, si) => ({ key: seriesKeys[si], label: s.label, color: colorOf(seriesKeys[si], si) }))} W={W} y={10} leftPad={0} textColor={cc.muted} vertical vertX={2} chartH={chartH} sideW={SIDE_LEGEND_W} />}
      {cfg.legendPos === "right" && <Legend series={series.map((s, si) => ({ key: seriesKeys[si], label: s.label, color: colorOf(seriesKeys[si], si) }))} W={W} y={10} leftPad={0} textColor={cc.muted} vertical vertX={W - SIDE_LEGEND_W} chartH={chartH} sideW={SIDE_LEGEND_W} />}
      {(cfg.legendPos === "top" || cfg.legendPos === "bottom") && <Legend series={series.map((s, si) => ({ key: seriesKeys[si], label: s.label, color: colorOf(seriesKeys[si], si) }))} W={W} y={cfg.legendPos === "top" ? -28 : chartH + 36} leftPad={leftPad} textColor={cc.muted} />}
    </ChartFrame>
  );
}

function GanttSvg({ sheet, cfg, W, H, opts, onToggleGroup, onUpdateRow, onDeleteRow, onShowMenu }: { sheet: DataSheet; cfg: ChartConfig; W: number; H: number; opts: GanttOpts; onToggleGroup: (k: string) => void; onUpdateRow?: OnUpdateRow; onDeleteRow?: OnDeleteRow; onShowMenu?: OnShowMenu }) {
  const palette = THEMES[cfg.theme].colors;
  const cc = chartColors(cfg);
  const tasks = ganttFromSheet(sheet);
  const groups = buildGroups(tasks, palette);

  const ROW_H = 36;
  const GROUP_ROW_H = 30;
  const HEADER_H = 56;
  const TITLE_H = 56;
  const PADDING = 16;
  // Self-adjusting left panel · sized to fit longest task name + owner.
  // SVG can't measure text without rendering, so we estimate from char
  // count at our font sizes (12px task, 10px owner). Clamps 220-420px.
  const longestTaskChars = Math.max(0, ...tasks.map(t => t.task.length));
  const longestOwnerChars = Math.max(0, ...tasks.map(t => (t.owner || "").length));
  const estTaskW = longestTaskChars * 7.2 + 32;
  const estOwnerW = (opts.showOwner ? longestOwnerChars * 6.4 + 24 : 0);
  const LEFT_PANEL_W = Math.max(220, Math.min(420, Math.round(estTaskW + estOwnerW + 32)));

  // Drag state · "move" shifts both start+end, "start"/"end" resize one edge.
  // Stored on a ref so React re-renders during the drag (driven by setState in
  // the move handler) don't recreate it.
  const dragRef = useRef<{ mode: "move" | "start" | "end"; sheetIdx: number; origStart: number; origEnd: number; cursorMs0: number } | null>(null);

  // Inline-rename state · which cell of which sheet row is currently
  // being edited (null = nothing). Keyed by sheet column key so we can
  // edit task name, owner, group, or progress without separate refs.
  const [editing, setEditing] = useState<{ rowIdx: number; key: string } | null>(null);

  if (tasks.length === 0) {
    return <g><text x={W / 2} y="100" textAnchor="middle" fill={C.txd} style={{ fontFamily: fontSans, fontSize: 13 }}>Add Task / Start / End rows below.</text></g>;
  }

  if (!tasks.length) return null;
  const minMs = Math.min(...tasks.map(t => t.start));
  const maxMs = Math.max(...tasks.map(t => t.end));
  const span = maxMs - minMs;
  const pad = Math.max(span * 0.04, 86400000 * 3);
  const bounds = { min: minMs - pad, max: maxMs + pad };
  const ticks = buildTicks(bounds.min, bounds.max, opts.unit);

  const visibleRows: Array<{ kind: "group" | "task"; group: GroupBlock; task?: RawTask }> = [];
  for (const g of groups) {
    const collapsed = opts.collapseAll || !!opts.collapsedKeys[g.key];
    if (opts.showGroups) visibleRows.push({ kind: "group", group: g });
    if (!collapsed) for (const t of g.tasks) visibleRows.push({ kind: "task", group: g, task: t });
  }

  const rowsHeight = visibleRows.reduce((a, r) => a + (r.kind === "group" ? GROUP_ROW_H : ROW_H), 0);
  const totalH = TITLE_H + HEADER_H + PADDING * 2 + rowsHeight;
  const totalW = W;
  const chartW = totalW - LEFT_PANEL_W - PADDING;

  const xOf = (ms: number) => {
    const t = (ms - bounds.min) / (bounds.max - bounds.min);
    return LEFT_PANEL_W + Math.max(0, Math.min(1, t)) * chartW;
  };

  // Inverse of xOf: pointer event → ms in the chart's time axis.
  const msAtPointer = (e: React.PointerEvent): number | null => {
    const pt = pointerToSvg(e, e.currentTarget);
    if (!pt) return null;
    const t = (pt.x - LEFT_PANEL_W) / chartW;
    return bounds.min + t * (bounds.max - bounds.min);
  };

  // Drag handler factory — bind a particular task + drag mode.
  const onBarDown = (task: RawTask, mode: "move" | "start" | "end") => (e: React.PointerEvent) => {
    if (!onUpdateRow) return;
    e.stopPropagation();
    const cursorMs = msAtPointer(e);
    if (cursorMs == null) return;
    dragRef.current = { mode, sheetIdx: task.sheetIdx, origStart: task.start, origEnd: task.end, cursorMs0: cursorMs };
    (e.target as Element).setPointerCapture?.(e.pointerId);
  };
  const onBarMove = (e: React.PointerEvent) => {
    const ds = dragRef.current;
    if (!ds || !onUpdateRow) return;
    const cursorMs = msAtPointer(e);
    if (cursorMs == null) return;
    const dms = snapDay(cursorMs - ds.cursorMs0);
    if (ds.mode === "move") {
      onUpdateRow(ds.sheetIdx, { start: msToISODate(ds.origStart + dms), end: msToISODate(ds.origEnd + dms) });
    } else if (ds.mode === "start") {
      const newStart = Math.min(ds.origStart + dms, ds.origEnd - DAY_MS);
      onUpdateRow(ds.sheetIdx, { start: msToISODate(newStart) });
    } else {
      const newEnd = Math.max(ds.origEnd + dms, ds.origStart + DAY_MS);
      onUpdateRow(ds.sheetIdx, { end: msToISODate(newEnd) });
    }
  };
  const onBarUp = () => { dragRef.current = null; };

  const todayMs = Date.now();
  const todayX = xOf(todayMs);
  const todayInRange = todayMs >= bounds.min && todayMs <= bounds.max;

  const rowTops: number[] = [];
  let cursor = TITLE_H + HEADER_H + PADDING;
  for (const r of visibleRows) {
    rowTops.push(cursor);
    cursor += r.kind === "group" ? GROUP_ROW_H : ROW_H;
  }

  return (
    <g>
      <rect x="0" y="0" width={totalW} height={totalH} fill="transparent" />
      <text x={LEFT_PANEL_W} y="26" fill={cc.text} style={{ fontFamily: fontSans, fontSize: 18, fontWeight: 900 }}>{cfg.title}</text>
      <text x={LEFT_PANEL_W} y="46" fill={cc.muted} style={{ fontFamily: fontMono, fontSize: 10, letterSpacing: 1 }}>{cfg.subtitle.toUpperCase()}</text>
      {ticks.map((t, i) => {
        const x = xOf(t);
        const next = ticks[i + 1];
        const labelX = next ? (x + xOf(next)) / 2 : x;
        return (
          <g key={"tk-" + i}>
            <line x1={x} x2={x} y1={TITLE_H} y2={totalH - PADDING} stroke="rgba(255,255,255,0.04)" />
            {next && <text x={labelX} y={TITLE_H + 24} textAnchor="middle" fill={cc.muted} style={{ fontFamily: fontMono, fontSize: 11, fontWeight: 700 }}>{formatTick(t, opts.unit)}</text>}
          </g>
        );
      })}
      <line x1={LEFT_PANEL_W} x2={totalW - PADDING} y1={TITLE_H + HEADER_H - 4} y2={TITLE_H + HEADER_H - 4} stroke="rgba(255,255,255,0.10)" />
      {visibleRows.map((r, i) => {
        const top = rowTops[i];
        if (r.kind === "group") {
          const collapsed = opts.collapseAll || !!opts.collapsedKeys[r.group.key];
          return (
            <g key={"g-" + r.group.key} onClick={() => onToggleGroup(r.group.key)} style={{ cursor: "pointer" }}>
              <rect x="0" y={top} width={totalW} height={GROUP_ROW_H} fill="rgba(255,255,255,0.015)" />
              <polygon points={collapsed ? `12,${top + GROUP_ROW_H / 2 - 5} 18,${top + GROUP_ROW_H / 2} 12,${top + GROUP_ROW_H / 2 + 5}` : `10,${top + GROUP_ROW_H / 2 - 4} 18,${top + GROUP_ROW_H / 2 - 4} 14,${top + GROUP_ROW_H / 2 + 4}`} fill={r.group.color} />
              <text x="26" y={top + GROUP_ROW_H / 2 + 4} fill={cc.text} style={{ fontFamily: fontSans, fontSize: 12, fontWeight: 800, letterSpacing: 0.3 }}>{r.group.label.toUpperCase()}</text>
              <line x1={xOf(r.group.start)} x2={xOf(r.group.end)} y1={top + GROUP_ROW_H / 2} y2={top + GROUP_ROW_H / 2} stroke={r.group.color} strokeWidth="2" opacity="0.6" />
              <circle cx={xOf(r.group.start)} cy={top + GROUP_ROW_H / 2} r="3" fill={r.group.color} />
              <circle cx={xOf(r.group.end)} cy={top + GROUP_ROW_H / 2} r="3" fill={r.group.color} />
            </g>
          );
        }
        const t = r.task!;
        // Per-task color override falls back to group color
        const color = t.color || r.group.color;
        const x1 = xOf(t.start);
        const x2 = xOf(t.end);
        const w = Math.max(2, x2 - x1);
        const barTop = top + 8;
        const barH = ROW_H - 16;
        // Effective shape: explicit shape column, else infer from start==end
        const effShape: "bar" | "milestone" | "dotted" =
          t.shape || (t.start === t.end ? "milestone" : "bar");
        const isMs = effShape === "milestone";
        const isDotted = effShape === "dotted";
        return (
          <g key={"t-" + i}>
            {i % 2 === 0 && <rect x="0" y={top} width={totalW} height={ROW_H} fill="rgba(255,255,255,0.015)" />}
            {editing && editing.rowIdx === t.sheetIdx && editing.key === "task" ? (
              <foreignObject x="28" y={top + 4} width={LEFT_PANEL_W - 56} height={ROW_H - 8}>
                <input
                  autoFocus
                  defaultValue={t.task}
                  onBlur={e => { const v = (e.target as HTMLInputElement).value; if (v && v !== t.task) onUpdateRow?.(t.sheetIdx, { task: v }); setEditing(null); }}
                  onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); if (e.key === "Escape") setEditing(null); }}
                  style={{ width: "100%", height: "100%", padding: "0 8px", background: "#0A0A0E", border: "1px solid " + C.amber + "80", borderRadius: 4, color: "#E8E4DD", fontFamily: fontSans, fontSize: 12, fontWeight: 600, outline: "none", boxSizing: "border-box" }}
                />
              </foreignObject>
            ) : (
              <text
                x="32" y={top + ROW_H / 2 + 4} fill={cc.text}
                onDoubleClick={() => onUpdateRow && setEditing({ rowIdx: t.sheetIdx, key: "task" })}
                style={{ fontFamily: fontSans, fontSize: 12, fontWeight: 500, cursor: onUpdateRow ? "text" : "default" }}
              >{t.task}</text>
            )}
            {opts.showOwner && t.owner && (
              editing && editing.rowIdx === t.sheetIdx && editing.key === "owner" ? (
                <foreignObject x={LEFT_PANEL_W - 90} y={top + 4} width={80} height={ROW_H - 8}>
                  <input
                    autoFocus
                    defaultValue={t.owner}
                    onBlur={e => { onUpdateRow?.(t.sheetIdx, { owner: (e.target as HTMLInputElement).value }); setEditing(null); }}
                    onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); if (e.key === "Escape") setEditing(null); }}
                    style={{ width: "100%", height: "100%", padding: "0 6px", background: "#0A0A0E", border: "1px solid " + color + "80", borderRadius: 4, color: color, fontFamily: fontMono, fontSize: 10, fontWeight: 700, outline: "none", boxSizing: "border-box", textAlign: "right" }}
                  />
                </foreignObject>
              ) : (
                <text
                  x={LEFT_PANEL_W - 12} y={top + ROW_H / 2 + 4} textAnchor="end" fill={color}
                  onDoubleClick={() => onUpdateRow && setEditing({ rowIdx: t.sheetIdx, key: "owner" })}
                  style={{ fontFamily: fontMono, fontSize: 10, fontWeight: 700, cursor: onUpdateRow ? "text" : "default" }}
                >{t.owner}</text>
              )
            )}
            {isMs ? (
              <g
                onPointerDown={onBarDown(t, "move")}
                onPointerMove={onBarMove}
                onPointerUp={onBarUp}
                onContextMenu={e => onShowMenu?.(e, ganttContextMenuItems(t, effShape, palette, onUpdateRow, onDeleteRow))}
                style={{ cursor: onUpdateRow ? "grab" : "default" }}
              >
                <polygon points={`${x1},${barTop} ${x1 + barH / 2},${barTop + barH / 2} ${x1},${barTop + barH} ${x1 - barH / 2},${barTop + barH / 2}`} fill={color} stroke="rgba(255,255,255,0.15)" />
                {opts.showDates && <text x={x1 + barH / 2 + 8} y={top + ROW_H / 2 + 4} fill={C.txm} style={{ fontFamily: fontMono, fontSize: 10 }}>{fmtDateShort(t.start)}</text>}
              </g>
            ) : (
              <g>
                {/* Main bar — pointer captures on this rect. Dotted variant
                    swaps to a dashed stroke + transparent fill. */}
                <rect
                  x={x1} y={barTop} width={w} height={barH} rx="5" ry="5"
                  fill={isDotted ? "transparent" : color}
                  fillOpacity={isDotted ? 0 : 0.35}
                  stroke={color}
                  strokeWidth={isDotted ? 1.6 : 1}
                  strokeDasharray={isDotted ? "5 4" : undefined}
                  onPointerDown={onBarDown(t, "move")}
                  onPointerMove={onBarMove}
                  onPointerUp={onBarUp}
                  onContextMenu={e => onShowMenu?.(e, ganttContextMenuItems(t, effShape, palette, onUpdateRow, onDeleteRow))}
                  style={{ cursor: onUpdateRow ? "grab" : "default" }}
                />
                {opts.showProgress && t.progress !== undefined && t.progress > 0 && !isDotted && (
                  <rect
                    x={x1} y={barTop} width={w * (t.progress / 100)} height={barH} rx="5" ry="5"
                    fill={color} fillOpacity="0.85"
                    onPointerDown={onBarDown(t, "move")}
                    onPointerMove={onBarMove}
                    onPointerUp={onBarUp}
                    style={{ cursor: onUpdateRow ? "grab" : "default", pointerEvents: "none" }}
                  />
                )}
                {/* Dotted variant · render a thin progress strip along the
                    bottom instead of a solid fill so the dashed border stays
                    legible. */}
                {opts.showProgress && t.progress !== undefined && t.progress > 0 && isDotted && (
                  <rect
                    x={x1 + 2} y={barTop + barH - 4} width={(w - 4) * (t.progress / 100)} height={3} rx="1.5"
                    fill={color}
                    style={{ pointerEvents: "none" }}
                  />
                )}
                {opts.showDates && w > 60 && (
                  <>
                    <text x={x1 + 8} y={top + ROW_H / 2 + 4} fill="#0A0A0E" style={{ fontFamily: fontMono, fontSize: 9, fontWeight: 700, pointerEvents: "none" }}>{fmtDateShort(t.start)}</text>
                    <text x={x2 - 8} y={top + ROW_H / 2 + 4} textAnchor="end" fill="#0A0A0E" style={{ fontFamily: fontMono, fontSize: 9, fontWeight: 700, pointerEvents: "none" }}>{fmtDateShort(t.end)}</text>
                  </>
                )}
                {opts.showDuration && w > 40 && <text x={x1 + w / 2} y={top + ROW_H / 2 + 4} textAnchor="middle" fill="#0A0A0E" style={{ fontFamily: fontMono, fontSize: 9, fontWeight: 800, pointerEvents: "none" }}>{durationDays(t.start, t.end)}d</text>}
                {opts.showProgress && t.progress !== undefined && <text x={x2 + 6} y={top + ROW_H / 2 + 4} fill={color} style={{ fontFamily: fontMono, fontSize: 9, fontWeight: 700, pointerEvents: "none" }}>{t.progress}%</text>}
                {/* Edge resize handles · invisible 8px-wide hit areas at each end */}
                {onUpdateRow && (
                  <>
                    <rect
                      x={x1 - 4} y={barTop - 2} width={8} height={barH + 4}
                      fill="transparent"
                      onPointerDown={onBarDown(t, "start")}
                      onPointerMove={onBarMove}
                      onPointerUp={onBarUp}
                      style={{ cursor: "ew-resize" }}
                    />
                    <rect
                      x={x2 - 4} y={barTop - 2} width={8} height={barH + 4}
                      fill="transparent"
                      onPointerDown={onBarDown(t, "end")}
                      onPointerMove={onBarMove}
                      onPointerUp={onBarUp}
                      style={{ cursor: "ew-resize" }}
                    />
                  </>
                )}
              </g>
            )}
          </g>
        );
      })}
      {opts.showToday && todayInRange && (
        <g>
          <line x1={todayX} x2={todayX} y1={TITLE_H + HEADER_H - 8} y2={totalH - PADDING} stroke={C.coral} strokeWidth="1.5" strokeDasharray="3 4" opacity="0.85" />
          <rect x={todayX - 22} y={TITLE_H + HEADER_H - 22} width="44" height="16" rx="3" fill={C.coral} />
          <text x={todayX} y={TITLE_H + HEADER_H - 10} textAnchor="middle" fill="#fff" style={{ fontFamily: fontMono, fontSize: 9, fontWeight: 800, letterSpacing: 1 }}>TODAY</text>
        </g>
      )}
      <line x1={LEFT_PANEL_W} x2={LEFT_PANEL_W} y1={TITLE_H} y2={totalH - PADDING} stroke="rgba(255,255,255,0.10)" />
    </g>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════
interface ChartConfig {
  type: ChartType; title: string; subtitle: string;
  theme: ThemeId; numFmt: NumberFormat;
  // Per-series color overrides (key → hex). Falls back to palette[i].
  seriesColors?: Record<string, string>;
  // Manual axis range. Undefined = auto-fit. xMin/xMax interpreted as
  // unix-ms when the active chart uses a time axis (LineProfile detects
  // this when every category parses as a date).
  yMin?: number;
  yMax?: number;
  xMin?: number;
  xMax?: number;
  // Whether the rendered backdrop is light (forces dark text on chart).
  lightBackdrop?: boolean;
  // Visual toggles · default off so charts read clean
  showBorders?: boolean;          // stroke between stacked segments / bar edges
  showGridlines?: boolean;        // horizontal Y axis gridlines (default true)
  showLegend?: boolean;           // legend visibility (default true)
  showSegmentLabels?: boolean;    // value label inside each stacked segment
  // Legend position relative to the chart canvas
  legendPos?: "top" | "bottom" | "left" | "right" | "hidden";
  // Optional axis labels
  yLabel?: string;    // vertical label on the left of the chart area
  xLabel?: string;    // horizontal label below the x-axis categories
  // When true, all chart interactions (drag, dblclick edit, right-click,
  // pointer capture) are no-ops. Lets the design pane be safe to touch.
  locked?: boolean;
  // New fields (feature additions)
  logScale?: boolean;
  showEndLabels?: boolean;
  markerShape?: "none" | "circle" | "square" | "diamond";
  roundedCorners?: boolean;
  showSecondaryAxis?: boolean;
  pieOtherThreshold?: number;
  // Wave 11 · feature additions
  showTotalLabels?: boolean;     // category-total label above stacked bars
  showTickMarks?: boolean;       // short tick marks on the Y axis
  show100Indicator?: boolean;    // 100% marker for percent charts
  axisBreak?: boolean;           // cosmetic Y-axis break for outliers
  // Wave 12 · POAST box-logo watermark behind the chart data. Stable
  // pseudo-random offset (hashed from chart W*H) so it doesn't jitter on
  // re-render. "centered" pins to dead-center; "off" hides entirely.
  watermark?: "off" | "random" | "centered";
  // Wave 13 · global bar-width control. Percentage of group width for
  // bar/column charts (default 65, range 20-95). For Mekko charts the
  // value drives the inner gap rather than the column width itself.
  barWidthPct?: number;
}

// Adaptive color set · text + grid pull from the backdrop mode so light
// surfaces don't render white-on-white. Used by every renderer for
// titles, axis ticks, category labels, value labels, gridlines.
function chartColors(cfg: ChartConfig) {
  if (cfg.lightBackdrop) {
    return {
      text:    "#0A0A0E",
      muted:   "#5C5A57",
      faint:   "#A8A4A0",
      grid:    "rgba(0,0,0,0.06)",
      gridStrong: "rgba(0,0,0,0.10)",
      barBorder:  "#FAFAF7",
      onBar:   "#0A0A0E",
    };
  }
  return {
    text:    "#E8E4DD",
    muted:   C.txm,
    faint:   C.txd,
    grid:    "rgba(255,255,255,0.05)",
    gridStrong: "rgba(255,255,255,0.10)",
    barBorder:  "#0A0A0E",
    onBar:   "#0A0A0E",
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// CHART TYPE WHEEL · radial picker. Shows all 16 chart types
// arranged in 22.5° wedges grouped visually by family (column · line · mekko ·
// gantt/scatter). Click a wedge to switch type; Esc / outside-click closes.
// ═══════════════════════════════════════════════════════════════════════════

// Family color tints for the wheel — wedge fills are family color × low alpha
// so the whole wheel reads at-a-glance even before you read labels.
function familyForType(t: ChartType): "column" | "line" | "mekko" | "gantt" {
  if (t === "stacked" || t === "pct" || t === "clustered" || t === "wfup" || t === "wfdn" || t === "variance") return "column";
  if (t === "line" || t === "stackedArea" || t === "pctArea" || t === "combo") return "line";
  if (t === "mekkoPct" || t === "mekkoUnit" || t === "pie" || t === "doughnut") return "mekko";
  return "gantt";
}
function familyColor(f: "column" | "line" | "mekko" | "gantt"): string {
  if (f === "column") return "#F7B041"; // amber
  if (f === "line")   return "#0B86D1"; // cobalt
  if (f === "mekko")  return "#2EAD8E"; // mint
  return "#E06347"; // coral
}

// Short labels for the radial wheel — full names like "Variance (AC vs PY)"
// don't fit in a 22.5° wedge. Falls back to spec.label if not in the map.
const WHEEL_SHORT_LABEL: Partial<Record<ChartType, string>> = {
  variance: "VARIANCE",
  stackedArea: "STK AREA",
  pctArea: "100% AREA",
  mekkoUnit: "MEKKO U",
  mekkoPct: "MEKKO %",
  wfup: "WF +",
  wfdn: "WF −",
  doughnut: "DONUT",
  clustered: "CLUSTER",
};

function ChartTypeWheel({ active, onSelect, onClose }: { active: ChartType; onSelect: (t: ChartType) => void; onClose: () => void }) {
  const types = TYPES.flat();
  const N = types.length; // expected 16
  const cx = 260, cy = 260;
  const outerR = 230;
  const innerR = 100;
  // Push icon toward outer ring, label toward inner ring — gives each wedge
  // a clear icon-on-top, label-below stack along its radial axis.
  const iconR = outerR - 38;
  const labelR = innerR + 30;
  const segDeg = 360 / N;
  const [hovered, setHovered] = useState<number | null>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Polar → cartesian helper. We rotate so wedge 0 starts at -90° (top).
  const point = (deg: number, r: number) => {
    const rad = ((deg - 90) * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  };

  // Build a wedge path for the i-th sector (0…N-1).
  const wedgePath = (i: number, scale = 1) => {
    const a0 = i * segDeg;
    const a1 = (i + 1) * segDeg;
    const o = outerR * scale;
    const inn = innerR;
    const p0 = point(a0, o);
    const p1 = point(a1, o);
    const q0 = point(a0, inn);
    const q1 = point(a1, inn);
    const large = segDeg > 180 ? 1 : 0;
    return `M ${q0.x} ${q0.y} L ${p0.x} ${p0.y} A ${o} ${o} 0 ${large} 1 ${p1.x} ${p1.y} L ${q1.x} ${q1.y} A ${inn} ${inn} 0 ${large} 0 ${q0.x} ${q0.y} Z`;
  };

  const activeIdx = types.findIndex(t => t.id === active);
  const activeLabel = types[activeIdx]?.label || "";

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 13000,
        background: "rgba(6,6,12,0.78)",
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        animation: "cm2WheelFade 0.18s ease forwards",
      }}
    >
      <style>{`@keyframes cm2WheelFade{from{opacity:0}to{opacity:1}}@keyframes cm2WheelSpin{from{transform:scale(.96) rotate(15deg);opacity:0}to{transform:scale(1) rotate(0deg);opacity:1}}`}</style>
      <div onClick={e => e.stopPropagation()} style={{ position: "relative", width: 520, height: 520, animation: "cm2WheelSpin 0.32s cubic-bezier(.2,.7,.2,1) both" }}>
        <svg viewBox="0 0 520 520" width="520" height="520" style={{ display: "block", overflow: "visible" }}>
          <defs>
            <filter id="cm2WheelGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="8" result="g" />
              <feMerge><feMergeNode in="g" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>
          {types.map((spec, i) => {
            const fam = familyForType(spec.id);
            const baseColor = familyColor(fam);
            const isActive = spec.id === active;
            const isHov = hovered === i;
            const scale = isHov || isActive ? 1.04 : 1;
            const fillAlpha = isActive ? "55" : (isHov ? "33" : "16");
            const stroke = isActive ? C.amber : (isHov ? baseColor : "rgba(255,255,255,0.06)");
            const angCenter = i * segDeg + segDeg / 2;
            const labelPos = point(angCenter, labelR);
            const iconPos = point(angCenter, iconR);
            return (
              <g key={spec.id}
                onMouseEnter={() => setHovered(i)}
                onMouseLeave={() => setHovered(h => (h === i ? null : h))}
                onClick={() => { onSelect(spec.id); onClose(); }}
                style={{ cursor: "pointer", transition: "transform 0.18s" }}
              >
                <path
                  d={wedgePath(i, scale)}
                  fill={baseColor + fillAlpha}
                  stroke={stroke}
                  strokeWidth={isActive ? 2 : 1}
                  filter={isActive ? "url(#cm2WheelGlow)" : undefined}
                />
                {/* Lucide icon · render as foreignObject so we get a real React component */}
                <foreignObject x={iconPos.x - 14} y={iconPos.y - 22} width={28} height={28} style={{ pointerEvents: "none" }}>
                  <div style={{ width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <spec.Icon size={20} strokeWidth={isActive ? 2.6 : 2} color={isActive ? C.amber : (isHov ? "#E8E4DD" : baseColor)} />
                  </div>
                </foreignObject>
                <text
                  x={labelPos.x}
                  y={labelPos.y + 4}
                  textAnchor="middle"
                  fill={isActive ? C.amber : (isHov ? "#E8E4DD" : C.txm)}
                  style={{ fontFamily: mn, fontSize: 8.5, fontWeight: 800, letterSpacing: 0.4, textTransform: "uppercase", pointerEvents: "none" }}
                >{WHEEL_SHORT_LABEL[spec.id] ?? spec.label.toUpperCase()}</text>
              </g>
            );
          })}
          {/* Center disk */}
          <circle cx={cx} cy={cy} r={innerR - 6} fill="#0B0B12" stroke="rgba(247,176,65,0.30)" strokeWidth="1.5" />
          <text x={cx} y={cy - 14} textAnchor="middle" fill={C.amber} style={{ fontFamily: mn, fontSize: 9, fontWeight: 800, letterSpacing: 1.5, textTransform: "uppercase" }}>Active</text>
          <text x={cx} y={cy + 8} textAnchor="middle" fill="#E8E4DD" style={{ fontFamily: gf, fontSize: 17, fontWeight: 900, letterSpacing: -0.3 }}>{activeLabel}</text>
          <text x={cx} y={cy + 28} textAnchor="middle" fill={C.txm} style={{ fontFamily: mn, fontSize: 8, letterSpacing: 1, textTransform: "uppercase" }}>Click any chart type</text>
        </svg>
        {/* Close button */}
        <button onClick={onClose} title="Close · Esc" style={{ position: "absolute", top: -6, right: -6, width: 36, height: 36, borderRadius: "50%", background: "#0D0D14", border: "1px solid rgba(255,255,255,0.14)", color: C.tx, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", boxShadow: "0 8px 20px rgba(0,0,0,0.5)" }}>
          <XIcon size={16} />
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ELEMENT ICON MENU · horizontal context strip that pops next to
// a clicked bar. Compact icon row: fill color (with inline swatch row) · CAGR
// arrow · diff arrow · ref line · callout · delete · more.
// ═══════════════════════════════════════════════════════════════════════════
function ElementIconMenu({ state, onClose, palette }: { state: ElementMenuState; onClose: () => void; palette: string[] }) {
  const [showSwatches, setShowSwatches] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    const onClick = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest("[data-element-menu]")) return;
      onClose();
    };
    document.addEventListener("keydown", onKey);
    setTimeout(() => document.addEventListener("click", onClick), 0);
    return () => { document.removeEventListener("keydown", onKey); document.removeEventListener("click", onClick); };
  }, [onClose]);

  const W = 360;
  const winW = typeof window !== "undefined" ? window.innerWidth : 1600;
  const winH = typeof window !== "undefined" ? window.innerHeight : 900;
  const x = Math.min(Math.max(8, state.x - W / 2), winW - W - 8);
  const y = Math.max(8, Math.min(state.y - 70, winH - 120));

  const IconBtn = ({ Icon, title, onClick, active, danger }: { Icon: LucideIconCmp; title: string; onClick: () => void; active?: boolean; danger?: boolean }) => {
    const [hov, setHov] = useState(false);
    const accent = danger ? "#E06347" : C.amber;
    return (
      <button
        onClick={onClick}
        title={title}
        onMouseEnter={() => setHov(true)}
        onMouseLeave={() => setHov(false)}
        style={{
          position: "relative",
          width: 40, height: 40, borderRadius: 8,
          background: active ? accent + "20" : (hov ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.03)"),
          border: "1px solid " + (active ? accent + "60" : (hov ? accent + "30" : "rgba(255,255,255,0.10)")),
          color: active ? accent : (danger ? accent : (hov ? C.tx : C.txm)),
          cursor: "pointer",
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          transition: "all 0.14s",
          boxShadow: active ? "0 0 12px " + accent + "30" : "none",
        }}
      >
        <Icon size={16} strokeWidth={2.2} />
        {hov && (
          <span style={{ position: "absolute", bottom: "calc(100% + 6px)", left: "50%", transform: "translateX(-50%)", padding: "4px 8px", background: "#0A0A0E", border: "1px solid rgba(255,255,255,0.14)", borderRadius: 5, fontFamily: mn, fontSize: 9, fontWeight: 700, color: "#E8E4DD", letterSpacing: 0.4, whiteSpace: "nowrap", pointerEvents: "none" }}>{title}</span>
        )}
      </button>
    );
  };

  return (
    <div
      data-element-menu
      style={{
        position: "fixed", left: x, top: y, zIndex: 11600,
        width: W,
        background: "rgba(13,13,18,0.95)",
        backdropFilter: "blur(14px) saturate(140%)",
        WebkitBackdropFilter: "blur(14px) saturate(140%)",
        border: "1px solid " + C.amber + "40",
        borderRadius: 14,
        padding: "8px 10px",
        boxShadow: "0 20px 50px rgba(0,0,0,0.55), 0 0 0 1px rgba(247,176,65,0.10), 0 0 24px " + C.amber + "20",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <IconBtn Icon={Palette} title="Fill color" onClick={() => setShowSwatches(v => !v)} active={showSwatches} />
        <IconBtn Icon={TrendingUp} title="CAGR arrow" onClick={() => { state.onCagr?.(); onClose(); }} />
        <IconBtn Icon={ArrowLeftRight} title="Diff arrow" onClick={() => { state.onDiff?.(); onClose(); }} />
        <IconBtn Icon={Minus} title="Reference line" onClick={() => { state.onRefLine?.(); onClose(); }} />
        <IconBtn Icon={Type} title="Callout" onClick={() => { state.onCallout?.(); onClose(); }} />
        <span style={{ width: 1, height: 24, background: "rgba(255,255,255,0.10)", margin: "0 2px" }} />
        <IconBtn Icon={Trash2} title="Delete" onClick={() => { state.onDelete?.(); onClose(); }} danger />
      </div>
      {showSwatches && (
        <div style={{ display: "flex", gap: 4, padding: "8px 4px 2px", flexWrap: "wrap" }}>
          <button
            onClick={() => { state.onSetColor?.(null); onClose(); }}
            title="Reset color"
            style={{ width: 22, height: 22, borderRadius: 4, background: "transparent", border: "1px dashed rgba(255,255,255,0.30)", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", color: C.txm }}
          ><X size={11} strokeWidth={2.4} /></button>
          {palette.map((c, i) => (
            <button
              key={i}
              onClick={() => { state.onSetColor?.(c); onClose(); }}
              title={c}
              style={{ width: 22, height: 22, borderRadius: 4, background: c, border: "1px solid " + (state.currentColor === c ? "#fff" : "rgba(0,0,0,0.4)"), cursor: "pointer", boxShadow: state.currentColor === c ? "0 0 0 2px " + c + "60" : "none" }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// RADIAL CONTEXT WHEEL · Wave 11 · radial wheel of icons
// arranged in a CIRCLE around the cursor. Replaces the linear ElementIconMenu
// for right-click on selected elements. Press M while something is selected
// or right-click on the element to open it.
// ═══════════════════════════════════════════════════════════════════════════

interface WheelIcon {
  Icon: LucideIcon;
  title: string;
  onClick: () => void;
  danger?: boolean;
  active?: boolean;
  // Wave 12 · stable id used by the WheelSettingsModal to enable / disable
  // each icon per element kind. Optional so existing callers still type-check.
  toolId?: string;
}

function RadialContextWheel({ x, y, icons, label, onClose }: {
  x: number; y: number;
  icons: WheelIcon[];
  label: string;
  onClose: () => void;
}) {
  const [hov, setHov] = useState<number | null>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    const onAny = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest("[data-radial-wheel]")) return;
      onClose();
    };
    document.addEventListener("keydown", onKey);
    const id = setTimeout(() => {
      document.addEventListener("mousedown", onAny);
      document.addEventListener("contextmenu", onAny);
    }, 0);
    return () => {
      clearTimeout(id);
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onAny);
      document.removeEventListener("contextmenu", onAny);
    };
  }, [onClose]);
  // Radius + clamp so the wheel doesn't fly off-screen
  // Wave 13 · bumped from 100→110 to fit more icons (auto-spaced).
  const R = 110;
  const D = R * 2 + 56;
  const winW = typeof window !== "undefined" ? window.innerWidth : 1600;
  const winH = typeof window !== "undefined" ? window.innerHeight : 900;
  const cx = Math.min(Math.max(D / 2 + 8, x), winW - D / 2 - 8);
  const cy = Math.min(Math.max(D / 2 + 8, y), winH - D / 2 - 8);
  // Position icons around the ring; start at the top (-PI/2)
  const positions = icons.map((_, i) => {
    const angle = (i / Math.max(1, icons.length)) * 2 * Math.PI - Math.PI / 2;
    return { dx: Math.cos(angle) * R, dy: Math.sin(angle) * R };
  });
  return (
    <div
      data-radial-wheel
      onContextMenu={e => e.preventDefault()}
      style={{
        position: "fixed",
        left: cx - D / 2,
        top: cy - D / 2,
        width: D, height: D,
        zIndex: 12000,
        pointerEvents: "none",
        animation: "cm2WheelOpen 0.18s cubic-bezier(.2,.7,.2,1) both",
      }}
    >
      <style>{`
        @keyframes cm2WheelOpen { from { opacity: 0; transform: scale(0.82) } to { opacity: 1; transform: scale(1) } }
      `}</style>
      {/* center label disk */}
      <div style={{
        position: "absolute", left: D / 2 - 36, top: D / 2 - 36,
        width: 72, height: 72, borderRadius: "50%",
        background: "rgba(13,13,18,0.92)",
        backdropFilter: "blur(14px) saturate(140%)",
        WebkitBackdropFilter: "blur(14px) saturate(140%)",
        border: "1px solid " + C.amber + "55",
        display: "inline-flex", alignItems: "center", justifyContent: "center", textAlign: "center",
        boxShadow: "0 12px 32px rgba(0,0,0,0.5), 0 0 24px " + C.amber + "30",
        pointerEvents: "auto",
        flexDirection: "column",
        padding: 6, lineHeight: 1.05,
      }}>
        <div style={{ fontFamily: mn, fontSize: 8, fontWeight: 800, color: C.amber, letterSpacing: 1.4, textTransform: "uppercase" }}>
          {hov !== null ? icons[hov].title : label}
        </div>
        <div style={{ fontFamily: mn, fontSize: 7, fontWeight: 700, color: C.txd, letterSpacing: 0.8, marginTop: 2, textTransform: "uppercase" }}>
          {hov !== null ? "click" : "wheel"}
        </div>
      </div>
      {icons.map((ic, i) => {
        const p = positions[i];
        const accent = ic.danger ? "#E06347" : C.amber;
        const isHov = hov === i;
        return (
          <span
            key={i}
            style={{
              position: "absolute",
              left: D / 2 + p.dx - 19,
              top: D / 2 + p.dy - 19,
              width: 38, height: 38,
              animation: `cm2WedgePop 0.32s cubic-bezier(.2,.7,.2,1) both`,
              animationDelay: `${i * 28}ms`,
              transformOrigin: "center",
              pointerEvents: "auto",
            }}
          >
            {/* Soft amber glow ring · only on hover */}
            {isHov && (
              <span aria-hidden style={{
                position: "absolute", inset: -8,
                borderRadius: "50%",
                background: `radial-gradient(circle, ${accent}55 0%, transparent 70%)`,
                pointerEvents: "none",
              }} />
            )}
            <button
              onMouseEnter={() => setHov(i)}
              onMouseLeave={() => setHov(h => h === i ? null : h)}
              onClick={() => { ic.onClick(); onClose(); }}
              title={ic.title}
              style={{
                position: "relative",
                width: 38, height: 38, borderRadius: "50%",
                background: ic.active ? accent + "30" : (isHov ? "rgba(13,13,18,0.96)" : "rgba(13,13,18,0.85)"),
                backdropFilter: "blur(10px) saturate(140%)",
                WebkitBackdropFilter: "blur(10px) saturate(140%)",
                border: "1px solid " + (ic.active ? accent + "88" : (isHov ? accent : "rgba(255,255,255,0.14)")),
                color: isHov || ic.active ? accent : "#E8E4DD",
                cursor: "pointer",
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                transform: isHov ? "scale(1.22)" : "scale(1)",
                boxShadow: isHov ? "0 12px 28px " + accent + "66, 0 0 22px " + accent + "55" : "0 6px 14px rgba(0,0,0,0.35)",
                transition: "all 0.16s cubic-bezier(.2,.7,.2,1)",
              }}
            >
              <ic.Icon size={16} strokeWidth={2.4} />
            </button>
          </span>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TOP MINI-TOOLBAR · Wave 11 · selection-driven horizontal toolbar that sits
// at the top of the chart card. Slides down when something is selected,
// shows context-specific controls for the selected element kind.
// ═══════════════════════════════════════════════════════════════════════════

function TopMiniToolbar({
  selected, onClose, palette,
  onSetSeriesColor, currentSeriesColor, onUpdateRow, sheet, numFmt, onChangeNumFmt,
  onAddTotalLabel, onAddSegmentLabel, onAddPercentLabel, onAddSeriesCagr, onAddTotalDiff,
  showGridlines, onToggleGridlines, showBorders, onToggleBorders,
  showTotalLabels, onToggleTotalLabels, showTickMarks, onToggleTickMarks,
  show100Indicator, onToggle100Indicator, onResetSelection,
}: {
  selected: SelectedElement;
  onClose: () => void;
  palette: string[];
  onSetSeriesColor?: (key: string, color: string | null) => void;
  currentSeriesColor?: string;
  onUpdateRow?: OnUpdateRow;
  sheet: DataSheet;
  numFmt: NumberFormat;
  onChangeNumFmt: (n: NumberFormat) => void;
  onAddTotalLabel?: () => void;
  onAddSegmentLabel?: () => void;
  onAddPercentLabel?: () => void;
  onAddSeriesCagr?: () => void;
  onAddTotalDiff?: () => void;
  showGridlines: boolean; onToggleGridlines: () => void;
  showBorders: boolean; onToggleBorders: () => void;
  showTotalLabels: boolean; onToggleTotalLabels: () => void;
  showTickMarks: boolean; onToggleTickMarks: () => void;
  show100Indicator: boolean; onToggle100Indicator: () => void;
  onResetSelection: () => void;
}) {
  void onAddTotalDiff;
  const Btn = ({ active, onClick, title, children, danger }: { active?: boolean; onClick: () => void; title: string; children: React.ReactNode; danger?: boolean }) => {
    const [hov, setHov] = useState(false);
    const accent = danger ? "#E06347" : C.amber;
    return (
      <button
        onClick={onClick} title={title}
        onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
        style={{
          padding: "5px 9px", borderRadius: 6,
          background: active ? accent + "22" : (hov ? "rgba(255,255,255,0.06)" : "transparent"),
          border: "1px solid " + (active ? accent + "66" : (hov ? "rgba(255,255,255,0.16)" : "rgba(255,255,255,0.08)")),
          color: active ? accent : (hov ? "#E8E4DD" : C.txm),
          fontFamily: mn, fontSize: 10, fontWeight: 700, letterSpacing: 0.5,
          cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 5,
          transition: "all 0.14s",
        }}
      >{children}</button>
    );
  };
  const labelKind = selected.kind.toUpperCase();
  return (
    <div
      data-mini-toolbar
      style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "6px 10px",
        marginBottom: 10,
        background: "rgba(13,13,18,0.85)",
        backdropFilter: "blur(14px) saturate(140%)",
        WebkitBackdropFilter: "blur(14px) saturate(140%)",
        border: "1px solid " + C.amber + "44",
        borderRadius: 10,
        boxShadow: "0 8px 22px rgba(0,0,0,0.35), 0 0 0 1px " + C.amber + "12 inset",
        animation: "cm2ToolbarSlide 0.22s cubic-bezier(.2,.7,.2,1) both",
        flexWrap: "wrap",
      }}
    >
      <style>{`@keyframes cm2ToolbarSlide { from { opacity: 0; transform: translateY(-6px) } to { opacity: 1; transform: translateY(0) } }`}</style>
      <span style={{
        fontFamily: mn, fontSize: 9, fontWeight: 800,
        color: C.amber, letterSpacing: 1.2,
        padding: "2px 8px",
        background: C.amber + "18",
        border: "1px solid " + C.amber + "55",
        borderRadius: 4,
      }}>{labelKind}</span>
      {/* Segment / Point — color picker */}
      {(selected.kind === "segment" || selected.kind === "point") && onSetSeriesColor && (
        <span style={{ display: "inline-flex", gap: 3, alignItems: "center" }}>
          <span style={{ fontFamily: mn, fontSize: 9, color: C.txm, letterSpacing: 0.6, marginRight: 2 }}>FILL</span>
          {palette.slice(0, 8).map((c, i) => (
            <button
              key={i}
              onClick={() => onSetSeriesColor(selected.key, c)}
              title={c}
              style={{ width: 16, height: 16, borderRadius: 3, background: c, border: "1px solid " + (currentSeriesColor === c ? "#fff" : "rgba(0,0,0,0.5)"), cursor: "pointer", boxShadow: currentSeriesColor === c ? "0 0 0 2px " + c + "60" : "none" }}
            />
          ))}
          <button
            onClick={() => onSetSeriesColor(selected.key, null)}
            title="Reset color"
            style={{ width: 16, height: 16, borderRadius: 3, background: "transparent", border: "1px dashed rgba(255,255,255,0.3)", cursor: "pointer", color: C.txm, display: "inline-flex", alignItems: "center", justifyContent: "center" }}
          ><X size={9} strokeWidth={2.4} /></button>
        </span>
      )}
      {/* Segment label toggles */}
      {selected.kind === "segment" && (
        <>
          <span style={{ width: 1, height: 18, background: "rgba(255,255,255,0.10)", margin: "0 2px" }} />
          {onAddTotalLabel && <Btn title="Toggle total labels" active={showTotalLabels} onClick={onAddTotalLabel}>Σ TOTAL</Btn>}
          {onAddSegmentLabel && <Btn title="Show value in segment" onClick={onAddSegmentLabel}># VALUE</Btn>}
          {onAddPercentLabel && <Btn title="Show percent of total" onClick={onAddPercentLabel}>% PCT</Btn>}
          {onAddSeriesCagr && <Btn title="Add CAGR badge to this series" onClick={onAddSeriesCagr}>↗ CAGR</Btn>}
          {onUpdateRow && (selected.kind === "segment") && (
            <>
              <span style={{ width: 1, height: 18, background: "rgba(255,255,255,0.10)", margin: "0 2px" }} />
              <input
                type="number"
                value={Number(sheet.rows[selected.rowIdx]?.[selected.key] ?? 0)}
                onChange={e => onUpdateRow(selected.rowIdx, { [selected.key]: Number(e.target.value) || 0 })}
                style={{ width: 64, padding: "4px 6px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.14)", borderRadius: 5, color: "#E8E4DD", fontFamily: mn, fontSize: 11, fontWeight: 700, outline: "none" }}
                title="Edit value"
              />
              <Btn title="Set this segment to 0" danger onClick={() => onUpdateRow(selected.rowIdx, { [selected.key]: 0 })}>0</Btn>
            </>
          )}
        </>
      )}
      {/* Axis */}
      {selected.kind === "axis" && (
        <>
          <Btn title="Gridlines" active={showGridlines} onClick={onToggleGridlines}>▦ GRID</Btn>
          <Btn title="Tick marks" active={showTickMarks} onClick={onToggleTickMarks}>| TICKS</Btn>
          <Btn title="100% indicator" active={show100Indicator} onClick={onToggle100Indicator}>= 100%</Btn>
        </>
      )}
      {/* Canvas */}
      {selected.kind === "canvas" && (
        <>
          <Btn title="Gridlines" active={showGridlines} onClick={onToggleGridlines}>▦ GRID</Btn>
          <Btn title="Borders" active={showBorders} onClick={onToggleBorders}>▢ BORDERS</Btn>
          <Btn title="Total labels" active={showTotalLabels} onClick={onToggleTotalLabels}>Σ TOTAL</Btn>
          <Btn title="Tick marks" active={showTickMarks} onClick={onToggleTickMarks}>| TICKS</Btn>
        </>
      )}
      {/* Label */}
      {selected.kind === "label" && (
        <>
          <span style={{ fontFamily: mn, fontSize: 9, color: C.txm }}>FORMAT</span>
          {(["auto", "int", "dec1", "pct", "k", "m", "b"] as const).map(fmt => (
            <Btn key={fmt} title={NUM_FMT_LABELS[fmt]} active={numFmt === fmt} onClick={() => onChangeNumFmt(fmt)}>{NUM_FMT_LABELS[fmt]}</Btn>
          ))}
        </>
      )}
      <span style={{ flex: 1 }} />
      <Btn title="Deselect (Esc)" onClick={() => { onResetSelection(); onClose(); }}><X size={12} strokeWidth={2.4} /></Btn>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SELECTION POPUP · Wave 12 · mini-toolbar that floats just
// above the clicked element in viewport coords. Appears the INSTANT a
// segment / point / mekkoColumn is selected — no need to pop the radial
// wheel. Inline color row + value input + label toggles + trash.
// ═══════════════════════════════════════════════════════════════════════════
interface SelectionPopupProps {
  selected: SelectedElement;
  palette: string[];
  currentSeriesColor?: string;
  onSetSeriesColor?: (key: string, color: string | null) => void;
  onUpdateRow?: OnUpdateRow;
  sheet: DataSheet;
  showSegmentLabels: boolean;
  showTotalLabels: boolean;
  onToggleSegmentLabels: () => void;
  onToggleTotalLabels: () => void;
  onTogglePercent: () => void;
  onClose: () => void;
}

function SelectionPopup({
  selected, palette, currentSeriesColor, onSetSeriesColor, onUpdateRow, sheet,
  showSegmentLabels, showTotalLabels, onToggleSegmentLabels, onToggleTotalLabels, onTogglePercent, onClose,
}: SelectionPopupProps) {
  // Pull the click anchor from the selection. Fall back to viewport center
  // if the selection has no anchor (keyboard-driven, programmatic).
  const winW = typeof window !== "undefined" ? window.innerWidth : 1280;
  const winH = typeof window !== "undefined" ? window.innerHeight : 800;
  const ax = selected.anchorX ?? winW / 2;
  const ay = selected.anchorY ?? winH / 2;
  // POPUP_W is approximate — the popup auto-sizes via inline-flex but we
  // need a number to clamp horizontally. Tall layouts wrap to a 2nd row.
  const POPUP_W = 380;
  const POPUP_H = 64;
  const left = Math.max(10, Math.min(winW - POPUP_W - 10, ax - POPUP_W / 2));
  // Float ABOVE the anchor by 16px. If that's off-screen flip below.
  const aboveTop = ay - POPUP_H - 18;
  const top = aboveTop < 12 ? Math.min(winH - POPUP_H - 12, ay + 18) : aboveTop;
  // Editable value reference for segment / point selections.
  const isCellish = selected.kind === "segment" || selected.kind === "point";
  const cellVal = isCellish ? Number(sheet.rows[selected.rowIdx]?.[selected.key] ?? 0) : 0;
  // valStr is kept as a local mirror so the DragScrubInput re-syncs when a
  // different bar is selected. The DragScrubInput itself owns its draft state.
  const [valStr, setValStr] = useState(String(cellVal));
  useEffect(() => { setValStr(String(cellVal)); }, [cellVal, selected.kind, isCellish ? selected.rowIdx : -1, isCellish ? selected.key : ""]);
  // Esc / click-outside dismissal. We rely on the parent to flip selected
  // back to null; here we just tell it via onClose.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    const onDown = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest("[data-selection-popup]")) return;
      if (t.closest("[data-mini-toolbar]")) return;
      if (t.closest("[data-radial-wheel]")) return;
      // Don't dismiss when clicking another selectable element — the new
      // selection will replace the popup naturally.
      if (t.closest("svg")) return;
      onClose();
    };
    document.addEventListener("keydown", onKey);
    const id = setTimeout(() => document.addEventListener("mousedown", onDown), 0);
    return () => {
      clearTimeout(id);
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
  }, [onClose]);
  const Sw = ({ c }: { c: string }) => {
    const on = currentSeriesColor === c;
    return (
      <button
        onClick={() => onSetSeriesColor && isCellish && onSetSeriesColor(selected.key, c)}
        title={c}
        style={{
          width: 18, height: 18, borderRadius: 4,
          background: c,
          border: "1px solid " + (on ? "#fff" : "rgba(0,0,0,0.5)"),
          boxShadow: on ? "0 0 0 2px " + c + "60, 0 2px 6px " + c + "55" : "0 1px 2px rgba(0,0,0,0.3)",
          cursor: "pointer", padding: 0, transition: "all 0.14s",
        }}
      />
    );
  };
  const Tog = ({ on, label, title, onClick }: { on: boolean; label: string; title: string; onClick: () => void }) => {
    const [hov, setHov] = useState(false);
    return (
      <button
        onClick={onClick}
        title={title}
        onMouseEnter={() => setHov(true)}
        onMouseLeave={() => setHov(false)}
        style={{
          padding: "4px 8px", borderRadius: 5,
          background: on ? C.amber + "26" : (hov ? "rgba(255,255,255,0.06)" : "transparent"),
          border: "1px solid " + (on ? C.amber + "70" : (hov ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.10)")),
          color: on ? C.amber : (hov ? "#E8E4DD" : C.txm),
          fontFamily: mn, fontSize: 9.5, fontWeight: 800, letterSpacing: 0.5,
          cursor: "pointer", whiteSpace: "nowrap",
          transition: "all 0.14s",
        }}
      >{label}</button>
    );
  };
  return (
    <div
      data-selection-popup
      style={{
        position: "fixed",
        left, top,
        zIndex: 11500,
        display: "inline-flex", alignItems: "center", gap: 6,
        padding: "7px 10px",
        background: "rgba(13,13,18,0.92)",
        backdropFilter: "blur(18px) saturate(160%)",
        WebkitBackdropFilter: "blur(18px) saturate(160%)",
        border: "1px solid " + C.amber + "55",
        borderRadius: 11,
        boxShadow: "0 14px 38px rgba(0,0,0,0.55), 0 0 0 1px " + C.amber + "18 inset, 0 0 28px " + C.amber + "30",
        animation: "cm2SelPopupIn 0.20s cubic-bezier(.2,.7,.2,1) both",
        flexWrap: "wrap",
        maxWidth: POPUP_W,
        pointerEvents: "auto",
      }}
    >
      <style>{`@keyframes cm2SelPopupIn { from { opacity: 0; transform: translateY(6px) scale(0.96) } to { opacity: 1; transform: translateY(0) scale(1) } }`}</style>
      {/* Color swatch row (first 12 palette colors + reset) */}
      {isCellish && onSetSeriesColor && (
        <span style={{ display: "inline-flex", gap: 3, alignItems: "center" }}>
          {palette.slice(0, 12).map((c, i) => <Sw key={i} c={c} />)}
          <button
            onClick={() => onSetSeriesColor(selected.key, null)}
            title="Reset color"
            style={{
              width: 18, height: 18, borderRadius: 4,
              background: "transparent",
              border: "1px dashed rgba(255,255,255,0.32)",
              cursor: "pointer", color: C.txm, padding: 0,
              display: "inline-flex", alignItems: "center", justifyContent: "center",
            }}
          ><X size={9} strokeWidth={2.4} /></button>
        </span>
      )}
      {/* Editable value input (commits on Enter / blur).
          Wave 13 · Alt-drag to scrub via DragScrubInput. */}
      {isCellish && onUpdateRow && (
        <>
          <span style={{ width: 1, height: 16, background: "rgba(255,255,255,0.12)", margin: "0 1px" }} />
          <DragScrubInput
            value={Number(valStr) || 0}
            onChange={(n) => {
              setValStr(String(n));
              if (selected.kind === "segment" || selected.kind === "point") {
                onUpdateRow(selected.rowIdx, { [selected.key]: n });
              }
            }}
            style={{
              width: 64, padding: "4px 6px",
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.18)",
              borderRadius: 5,
              color: "#E8E4DD",
              fontFamily: mn, fontSize: 11, fontWeight: 700,
              outline: "none",
              fontFeatureSettings: "'tnum'",
            }}
            title="Edit value · Enter to commit · Alt-drag to scrub"
          />
        </>
      )}
      <span style={{ width: 1, height: 16, background: "rgba(255,255,255,0.12)", margin: "0 1px" }} />
      {/* Label toggles */}
      <Tog on={showTotalLabels} label="Σ" title="Toggle total labels" onClick={onToggleTotalLabels} />
      <Tog on={showSegmentLabels} label="#" title="Toggle value labels" onClick={onToggleSegmentLabels} />
      <Tog on={false} label="%" title="Show as percent" onClick={onTogglePercent} />
      {/* Trash · zero this segment */}
      {isCellish && onUpdateRow && (
        <button
          onClick={() => { if (selected.kind === "segment" || selected.kind === "point") onUpdateRow(selected.rowIdx, { [selected.key]: 0 }); }}
          title="Set value to 0"
          style={{
            padding: "4px 7px", borderRadius: 5,
            background: "rgba(224,99,71,0.10)",
            border: "1px solid rgba(224,99,71,0.40)",
            color: "#E06347",
            cursor: "pointer", display: "inline-flex", alignItems: "center",
            transition: "all 0.14s",
          }}
          onMouseEnter={e => { e.currentTarget.style.background = "rgba(224,99,71,0.20)"; }}
          onMouseLeave={e => { e.currentTarget.style.background = "rgba(224,99,71,0.10)"; }}
        ><Trash2 size={11} strokeWidth={2.4} /></button>
      )}
      {/* The little tail/arrow pointing toward the anchor — purely decorative */}
      <span
        style={{
          position: "absolute",
          left: Math.max(12, Math.min(POPUP_W - 24, ax - left - 6)),
          bottom: aboveTop < 12 ? "auto" : -6,
          top: aboveTop < 12 ? -6 : "auto",
          width: 12, height: 12,
          background: "rgba(13,13,18,0.92)",
          border: "1px solid " + C.amber + "55",
          borderRight: "none", borderBottom: aboveTop < 12 ? "none" : "1px solid " + C.amber + "55",
          borderTop: aboveTop < 12 ? "1px solid " + C.amber + "55" : "none",
          transform: "rotate(45deg)",
          pointerEvents: "none",
        }}
      />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// STATUS BAR · slim row at the bottom of the canvas. Mirrors LibreOffice's
// status bar with type · row/col counts · sum · format · theme.
// ═══════════════════════════════════════════════════════════════════════════
function StatusBar({ chartType, sheet, numFmt, themeName, advanced }: { chartType: ChartType; sheet: DataSheet; numFmt: NumberFormat; themeName: string; advanced: boolean }) {
  const numericCols = sheet.schema.filter(c => c.type === "number" || c.type === "percent");
  const sum = sheet.rows.reduce((acc, row) => {
    return acc + numericCols.reduce((a, col) => {
      const v = row[col.key];
      return a + (typeof v === "number" ? v : Number(v) || 0);
    }, 0);
  }, 0);
  const typeLabel = TYPES.flat().find(t => t.id === chartType)?.label || chartType;
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 14,
      padding: "8px 16px",
      background: "rgba(13,13,18,0.85)",
      border: "1px solid rgba(255,255,255,0.06)",
      borderRadius: 10,
      fontFamily: mn, fontSize: 10, color: C.txm, letterSpacing: 0.6,
      backdropFilter: "blur(10px) saturate(140%)",
      WebkitBackdropFilter: "blur(10px) saturate(140%)",
      boxShadow: "0 1px 0 rgba(255,255,255,0.04) inset",
    }}>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: C.amber, fontWeight: 800, textTransform: "uppercase" }}>
        <Hash size={11} strokeWidth={2.4} color={C.amber} />
        {typeLabel}
      </span>
      <span style={{ opacity: 0.4 }}>·</span>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
        <Grid3x3 size={11} strokeWidth={2.2} color={C.txm} />
        {sheet.rows.length} ROWS × {sheet.schema.length} COLS
      </span>
      <span style={{ opacity: 0.4 }}>·</span>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
        <Sigma size={11} strokeWidth={2.4} color={C.amber} />
        {fmtVal(sum, numFmt)}
      </span>
      <span style={{ opacity: 0.4 }}>·</span>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
        <Type size={11} strokeWidth={2.2} color={C.txm} />
        FORMAT: {numFmt.toUpperCase()}
      </span>
      <span style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 4 }}>
        <Palette size={11} strokeWidth={2.2} color={C.amber} />
        {advanced ? "ADVANCED" : "SIMPLE"} MODE · THEME: {themeName.toUpperCase()}
      </span>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// PROPERTIES PANEL · right-side panel with [Design][Annotations][Series] tabs.
// Compact summary of the most-used controls so users don't have to open the
// full Design drawer for every tweak. Falls under the application-shell
// upgrade — when SIMPLE mode is on this hides via prop.
// ═══════════════════════════════════════════════════════════════════════════
function PropertiesPanel({
  tab, onChangeTab,
  theme, onChangeTheme,
  legendPos, onChangeLegendPos,
  showGridlines, onToggleGridlines,
  showBorders, onToggleBorders,
  logScale, onToggleLogScale,
  roundedCorners, onToggleRoundedCorners,
  showEndLabels, onToggleEndLabels,
  markerShape, onChangeMarkerShape,
  annotations, onRemoveAnnotation, onClearAnnotations,
  pickMode, placeMode, onStartPick, onCancelPick, onAddRefLine, onTogglePlaceText,
  chartType,
  series, onSetSeriesColor, palette,
  onOpenDesign,
  watermark, onChangeWatermark,
  onOpenExpanded,
  barWidthPct, onChangeBarWidthPct,
  axis, onChangeAxis,
}: {
  tab: "design" | "annotations" | "series";
  onChangeTab: (t: "design" | "annotations" | "series") => void;
  theme: ThemeId; onChangeTheme: (t: ThemeId) => void;
  legendPos: NonNullable<ChartConfig["legendPos"]>; onChangeLegendPos: (p: NonNullable<ChartConfig["legendPos"]>) => void;
  showGridlines: boolean; onToggleGridlines: () => void;
  showBorders: boolean; onToggleBorders: () => void;
  logScale: boolean; onToggleLogScale: () => void;
  roundedCorners: boolean; onToggleRoundedCorners: () => void;
  showEndLabels: boolean; onToggleEndLabels: () => void;
  markerShape: "none" | "circle" | "square" | "diamond"; onChangeMarkerShape: (s: "none" | "circle" | "square" | "diamond") => void;
  annotations: Annotation[]; onRemoveAnnotation: (id: string) => void; onClearAnnotations: () => void;
  pickMode: PickMode; placeMode: PlaceMode;
  onStartPick: (k: "cagr" | "diff") => void; onCancelPick: () => void;
  onAddRefLine: (v: number, l: string) => void; onTogglePlaceText: () => void;
  chartType: ChartType;
  series: Array<{ key: string; label: string; color: string }>;
  onSetSeriesColor: (key: string, color: string | null) => void;
  palette: string[];
  onOpenDesign: () => void;
  watermark: "off" | "centered" | "random"; onChangeWatermark: (w: "off" | "centered" | "random") => void;
  onOpenExpanded: () => void;
  // Wave 13 · global bar-width slider + axis range inputs
  barWidthPct: number; onChangeBarWidthPct: (v: number) => void;
  axis: { yMin?: number; yMax?: number; xMin?: number; xMax?: number };
  onChangeAxis: (next: { yMin?: number; yMax?: number; xMin?: number; xMax?: number }) => void;
}) {
  const tabs: Array<{ id: "design" | "annotations" | "series"; label: string }> = [
    { id: "design", label: "Design" }, { id: "annotations", label: "Annotate" }, { id: "series", label: "Series" },
  ];
  const annotApplies = ["stacked", "clustered", "line", "stackedArea", "wfup"].includes(chartType);
  const [refValue, setRefValue] = useState("0");
  const [refLabel, setRefLabel] = useState("");
  const [editingSeries, setEditingSeries] = useState<string | null>(null);
  return (
    <aside style={{
      background: "rgba(13,13,18,0.72)",
      backdropFilter: "blur(14px) saturate(140%)",
      WebkitBackdropFilter: "blur(14px) saturate(140%)",
      border: "1px solid rgba(255,255,255,0.07)",
      borderRadius: 14,
      position: "sticky", top: 14, alignSelf: "start",
      maxHeight: "calc(100vh - 56px)", overflow: "hidden",
      display: "flex", flexDirection: "column",
      boxShadow: "0 1px 0 rgba(255,255,255,0.04) inset, 0 12px 32px rgba(0,0,0,0.30)",
      width: 300,
    }}>
      <div style={{ padding: "12px 14px 0", borderBottom: "1px solid rgba(255,255,255,0.06)", flexShrink: 0 }}>
        <div style={{ fontFamily: gf, fontSize: 13, fontWeight: 800, color: C.tx, letterSpacing: -0.1, marginBottom: 8 }}>Properties</div>
        <div style={{ display: "flex", gap: 4, marginBottom: 0 }}>
          {tabs.map(t => {
            const on = tab === t.id;
            return (
              <button key={t.id} onClick={() => onChangeTab(t.id)} style={{ flex: 1, padding: "8px 6px", borderRadius: "6px 6px 0 0", border: "none", borderBottom: on ? "2px solid " + C.amber : "2px solid transparent", background: on ? C.amber + "16" : "transparent", color: on ? C.amber : C.txm, fontFamily: mn, fontSize: 10, fontWeight: 800, letterSpacing: 0.5, cursor: "pointer", textTransform: "uppercase" }}>{t.label}</button>
            );
          })}
        </div>
      </div>
      <div style={{ overflowY: "auto", flex: 1, padding: "14px 14px 16px" }}>
        {tab === "design" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <div style={{ fontFamily: mn, fontSize: 9, color: C.amber, letterSpacing: 1.4, textTransform: "uppercase", marginBottom: 8, fontWeight: 800 }}>Palette</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {(Object.entries(THEMES) as [ThemeId, typeof THEMES[ThemeId]][]).map(([id, t]) => {
                  const on = theme === id;
                  return (
                    <button key={id} onClick={() => onChangeTheme(id)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", background: on ? C.amber + "16" : "rgba(255,255,255,0.025)", border: "1px solid " + (on ? C.amber + "55" : "rgba(255,255,255,0.08)"), borderRadius: 7, cursor: "pointer", textAlign: "left" }}>
                      <span style={{ display: "inline-flex", gap: 1.5 }}>{t.colors.slice(0, 6).map((c, i) => <span key={i} style={{ width: 9, height: 14, background: c, borderRadius: 2 }} />)}</span>
                      <span style={{ fontFamily: ft, fontSize: 11, fontWeight: 800, color: on ? C.amber : "#E8E4DD" }}>{t.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <div style={{ fontFamily: mn, fontSize: 9, color: C.amber, letterSpacing: 1.4, textTransform: "uppercase", marginBottom: 8, fontWeight: 800 }}>Legend</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 3 }}>
                {(["bottom", "left", "right", "hidden"] as const).map(p => {
                  const on = legendPos === p;
                  return <button key={p} onClick={() => onChangeLegendPos(p)} style={{ padding: "7px 2px", borderRadius: 5, background: on ? C.amber + "20" : "rgba(255,255,255,0.025)", border: "1px solid " + (on ? C.amber + "55" : "rgba(255,255,255,0.08)"), color: on ? C.amber : C.tx, fontFamily: mn, fontSize: 8, fontWeight: 800, letterSpacing: 0.4, cursor: "pointer", textTransform: "uppercase" }}>{p}</button>;
                })}
              </div>
            </div>
            <div>
              <div style={{ fontFamily: mn, fontSize: 9, color: C.amber, letterSpacing: 1.4, textTransform: "uppercase", marginBottom: 8, fontWeight: 800 }}>Display</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <DesignToggle on={showGridlines} label="Gridlines" sub="Y axis guide lines" onChange={onToggleGridlines} />
                <DesignToggle on={showBorders} label="Borders" sub="Bar/segment outlines" onChange={onToggleBorders} />
                <DesignToggle on={logScale} label="Log Scale" sub="Logarithmic Y axis" onChange={onToggleLogScale} />
                <DesignToggle on={roundedCorners} label="Rounded" sub="Rounded bar corners" onChange={onToggleRoundedCorners} />
                <DesignToggle on={showEndLabels} label="End Labels" sub="Series labels at last point" onChange={onToggleEndLabels} />
              </div>
            </div>
            {/* Wave 13 · global bar-width slider */}
            <div>
              <div style={{ fontFamily: mn, fontSize: 9, color: C.amber, letterSpacing: 1.4, textTransform: "uppercase", marginBottom: 8, fontWeight: 800 }}>BAR WIDTH</div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <input
                  type="range"
                  min={20}
                  max={95}
                  value={barWidthPct}
                  onChange={e => onChangeBarWidthPct(Number(e.target.value))}
                  style={{ flex: 1, accentColor: C.amber }}
                />
                <span style={{ fontFamily: mn, fontSize: 11, fontWeight: 800, color: C.amber, minWidth: 36, textAlign: "right" }}>{barWidthPct}%</span>
              </div>
              <div style={{ fontFamily: mn, fontSize: 9, color: C.txd, marginTop: 6, letterSpacing: 0.4 }}>Affects all bar / column / mekko charts.</div>
            </div>
            {/* Wave 13 · axes range section */}
            <div>
              <div style={{ fontFamily: mn, fontSize: 9, color: C.amber, letterSpacing: 1.4, textTransform: "uppercase", marginBottom: 8, fontWeight: 800 }}>Axes</div>
              <AxisRangeBlock axis={axis} onChange={onChangeAxis} xApplies={["line", "stackedArea", "scatter", "bubble"].includes(chartType)} chartType={chartType} />
            </div>
            <div>
              <div style={{ fontFamily: mn, fontSize: 9, color: C.amber, letterSpacing: 1.4, textTransform: "uppercase", marginBottom: 8, fontWeight: 800 }}>Markers</div>
              <div style={{ display: "flex", gap: 4 }}>
                {(["none", "circle", "square", "diamond"] as const).map(s => {
                  const on = markerShape === s;
                  const lbl = s === "none" ? "—" : s === "circle" ? "●" : s === "square" ? "■" : "◆";
                  return <button key={s} onClick={() => onChangeMarkerShape(s)} style={{ flex: 1, padding: "7px 4px", borderRadius: 5, background: on ? C.amber + "20" : "rgba(255,255,255,0.025)", border: "1px solid " + (on ? C.amber + "55" : "rgba(255,255,255,0.08)"), color: on ? C.amber : C.tx, fontFamily: mn, fontSize: 11, fontWeight: 800, cursor: "pointer", textAlign: "center" }}>{lbl}</button>;
                })}
              </div>
            </div>
            <div>
              <div style={{ fontFamily: mn, fontSize: 9, color: C.amber, letterSpacing: 1.4, textTransform: "uppercase", marginBottom: 8, fontWeight: 800 }}>Watermark</div>
              <div style={{ display: "flex", gap: 3, padding: 3, background: "rgba(255,255,255,0.025)", borderRadius: 7 }}>
                {(["off", "centered", "random"] as const).map(m => {
                  const on = watermark === m;
                  return (
                    <button key={m} onClick={() => onChangeWatermark(m)} style={{ flex: 1, padding: "7px 4px", borderRadius: 5, background: on ? C.amber + "22" : "transparent", border: "none", color: on ? C.amber : C.txm, fontFamily: mn, fontSize: 9, fontWeight: 800, letterSpacing: 0.5, cursor: "pointer", textTransform: "uppercase" }}>{m}</button>
                  );
                })}
              </div>
            </div>
            <button
              onClick={onOpenExpanded}
              style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                padding: "10px 12px", borderRadius: 8,
                background: "linear-gradient(135deg, " + C.amber + "22, " + C.amber + "11)",
                border: "1px solid " + C.amber + "55",
                color: C.amber,
                fontFamily: mn, fontSize: 10, fontWeight: 900, letterSpacing: 0.6,
                cursor: "pointer", textTransform: "uppercase",
                transition: "all 0.16s",
                boxShadow: "0 1px 0 rgba(255,255,255,0.04) inset",
              }}
              onMouseEnter={e => { e.currentTarget.style.background = "linear-gradient(135deg, " + C.amber + "44, " + C.amber + "22)"; e.currentTarget.style.boxShadow = "0 6px 20px " + C.amber + "44, 0 1px 0 rgba(255,255,255,0.06) inset"; e.currentTarget.style.transform = "translateY(-1px)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "linear-gradient(135deg, " + C.amber + "22, " + C.amber + "11)"; e.currentTarget.style.boxShadow = "0 1px 0 rgba(255,255,255,0.04) inset"; e.currentTarget.style.transform = "translateY(0)"; }}
            >
              <Rocket size={13} strokeWidth={2.4} /> Launch Full Suite
            </button>
            <button onClick={onOpenDesign} style={{ padding: "9px 12px", borderRadius: 7, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.10)", color: C.tx, fontFamily: mn, fontSize: 10, fontWeight: 800, letterSpacing: 0.5, cursor: "pointer", textTransform: "uppercase" }}>Open full design panel →</button>
          </div>
        )}
        {tab === "annotations" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
              <button onClick={() => onStartPick("cagr")} disabled={!annotApplies} style={{ padding: "10px 8px", borderRadius: 7, background: pickMode?.kind === "cagr" ? C.amber + "20" : "rgba(255,255,255,0.025)", border: "1px solid " + (pickMode?.kind === "cagr" ? C.amber + "55" : "rgba(255,255,255,0.10)"), color: pickMode?.kind === "cagr" ? C.amber : C.tx, fontFamily: mn, fontSize: 10, fontWeight: 800, cursor: annotApplies ? "pointer" : "not-allowed", opacity: annotApplies ? 1 : 0.4, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 5 }}><Sigma size={11} /> CAGR</button>
              <button onClick={() => onStartPick("diff")} disabled={!annotApplies} style={{ padding: "10px 8px", borderRadius: 7, background: pickMode?.kind === "diff" ? C.amber + "20" : "rgba(255,255,255,0.025)", border: "1px solid " + (pickMode?.kind === "diff" ? C.amber + "55" : "rgba(255,255,255,0.10)"), color: pickMode?.kind === "diff" ? C.amber : C.tx, fontFamily: mn, fontSize: 10, fontWeight: 800, cursor: annotApplies ? "pointer" : "not-allowed", opacity: annotApplies ? 1 : 0.4, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 5 }}><ArrowUpDown size={11} /> Δ DIFF</button>
              <button onClick={onTogglePlaceText} style={{ padding: "10px 8px", borderRadius: 7, background: placeMode?.kind === "callout" ? C.amber + "20" : "rgba(255,255,255,0.025)", border: "1px solid " + (placeMode?.kind === "callout" ? C.amber + "55" : "rgba(255,255,255,0.10)"), color: placeMode?.kind === "callout" ? C.amber : C.tx, fontFamily: mn, fontSize: 10, fontWeight: 800, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 5 }}><Type size={11} /> TEXT</button>
              {pickMode && <button onClick={onCancelPick} style={{ padding: "10px 8px", borderRadius: 7, background: "rgba(224,99,71,0.10)", border: "1px solid rgba(224,99,71,0.40)", color: "#E06347", fontFamily: mn, fontSize: 10, fontWeight: 800, cursor: "pointer" }}>CANCEL</button>}
            </div>
            <div>
              <div style={{ fontFamily: mn, fontSize: 9, color: C.amber, letterSpacing: 1.4, textTransform: "uppercase", marginBottom: 6, fontWeight: 800 }}>Reference line</div>
              <div style={{ display: "flex", gap: 4 }}>
                <DragScrubInput value={Number(refValue) || 0} onChange={(n) => setRefValue(String(n))} placeholder="value" style={{ width: 60, padding: "7px 8px", background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 5, color: C.tx, fontFamily: mn, fontSize: 10, outline: "none" }} title="Alt-drag to scrub" />
                <input value={refLabel} onChange={e => setRefLabel(e.target.value)} placeholder="label" style={{ flex: 1, padding: "7px 8px", background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 5, color: C.tx, fontFamily: ft, fontSize: 11, outline: "none" }} />
                <button onClick={() => { const n = Number(refValue); if (!isNaN(n)) { onAddRefLine(n, refLabel); setRefValue("0"); setRefLabel(""); } }} style={{ padding: "7px 12px", background: C.amber, border: "none", borderRadius: 5, color: "#060608", fontFamily: mn, fontSize: 10, fontWeight: 800, cursor: "pointer" }}>ADD</button>
              </div>
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                <div style={{ fontFamily: mn, fontSize: 9, color: C.amber, letterSpacing: 1.4, textTransform: "uppercase", fontWeight: 800 }}>On chart · {annotations.length}</div>
                <span style={{ flex: 1 }} />
                {annotations.length > 0 && <button onClick={onClearAnnotations} style={{ padding: "4px 9px", borderRadius: 5, background: "rgba(224,99,71,0.10)", border: "1px solid rgba(224,99,71,0.40)", color: "#E06347", fontFamily: mn, fontSize: 9, fontWeight: 800, cursor: "pointer" }}>CLEAR</button>}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                {annotations.length === 0 && <span style={{ fontFamily: mn, fontSize: 10, color: C.txd }}>None yet</span>}
                {annotations.map(a => {
                  const label = a.kind === "cagr" ? "CAGR " + a.rowFrom + "→" + a.rowTo
                    : a.kind === "diff" ? "Δ " + a.rowFrom + "→" + a.rowTo
                    : a.kind === "refline" ? "Ref " + (a.label || a.value)
                    : a.kind === "callout" ? "Text · " + a.text.slice(0, 20)
                    : a.kind === "seriesCagr" ? "Series CAGR · " + a.seriesKey
                    : a.kind === "totalDiff" ? "Σ Δ " + a.rowFrom + "→" + a.rowTo
                    : "Annotation";
                  return (
                    <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 7px", background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 5 }}>
                      <span style={{ fontFamily: mn, fontSize: 10, color: C.tx, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
                      <button onClick={() => onRemoveAnnotation(a.id)} title="Remove" style={{ padding: 3, background: "transparent", border: "none", color: "#E06347", cursor: "pointer", display: "inline-flex" }}><X size={11} strokeWidth={2.4} /></button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
        {tab === "series" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {series.length === 0 && <span style={{ fontFamily: mn, fontSize: 10, color: C.txd }}>No series for this chart</span>}
            {series.map(s => {
              const editing = editingSeries === s.key;
              return (
                <div key={s.key} style={{ display: "flex", flexDirection: "column", gap: 4, padding: "7px 9px", background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 7 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <button onClick={() => setEditingSeries(editing ? null : s.key)} title="Click to recolor" style={{ width: 18, height: 18, borderRadius: 4, background: s.color, border: "1px solid rgba(255,255,255,0.18)", cursor: "pointer", padding: 0 }} />
                    <span style={{ flex: 1, fontFamily: ft, fontSize: 12, fontWeight: 700, color: C.tx, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.label}</span>
                  </div>
                  {editing && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 3, paddingTop: 4 }}>
                      <button onClick={() => { onSetSeriesColor(s.key, null); setEditingSeries(null); }} title="Reset" style={{ width: 18, height: 18, borderRadius: 3, background: "transparent", border: "1px dashed rgba(255,255,255,0.30)", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", color: C.txm }}><X size={9} strokeWidth={2.4} /></button>
                      {palette.map((c, i) => (
                        <button key={i} onClick={() => { onSetSeriesColor(s.key, c); setEditingSeries(null); }} title={c} style={{ width: 18, height: 18, borderRadius: 3, background: c, border: "1px solid " + (s.color === c ? "#fff" : "rgba(0,0,0,0.4)"), cursor: "pointer" }} />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </aside>
  );
}

export default function ChartMaker2({ standalone = false }: { standalone?: boolean }) {
  const [type, setType] = useState<ChartType>("stacked");
  const [title, setTitle] = useState("SemiAnalysis · 2026 Outlook");
  const [subtitle, setSubtitle] = useState("Quarterly view");
  const [theme, setTheme] = useState<ThemeId>("saCore");
  // Backdrop state · base color + glow stops for the chart canvas
  const [backdrop, setBackdrop] = useState<BackdropKey>("both");
  const [backdropMode, setBackdropMode] = useState<BackdropMode>("dark");
  // Design panel state — open/closed, plus visual flags
  const [designOpen, setDesignOpen] = useState(false);
  const [showBorders, setShowBorders] = useState(false);
  const [showGridlines, setShowGridlines] = useState(true);
  const [showSegmentLabels, setShowSegmentLabels] = useState(false);
  const [legendPos, setLegendPos] = useState<NonNullable<ChartConfig["legendPos"]>>("bottom");
  const [yLabel, setYLabel] = useState("");
  const [xLabel, setXLabel] = useState("");
  const [locked, setLocked] = useState(false);
  // New feature states
  const [logScale, setLogScale] = useState(false);
  const [showEndLabels, setShowEndLabels] = useState(false);
  const [markerShape, setMarkerShape] = useState<"none" | "circle" | "square" | "diamond">("circle");
  const [roundedCorners, setRoundedCorners] = useState(false);
  const [showSecondaryAxis, setShowSecondaryAxis] = useState(false);
  const [pieOtherThreshold, setPieOtherThreshold] = useState(3);
  // Wheel + element menu + mode state
  const [wheelOpen, setWheelOpen] = useState(false);
  const [elementMenu, setElementMenu] = useState<ElementMenuState | null>(null);
  const [advancedMode, setAdvancedMode] = useState(true);
  const [rightPanelOpen, setRightPanelOpen] = useState(true);
  const [rightTab, setRightTab] = useState<"design" | "annotations" | "series">("design");
  // Crosshair hover state — currently per-renderer (StackedColumn etc.); kept
  // here for potential future "broadcast hover" sync across multiple charts.
  const [, setHoveredCat] = useState<number | null>(null);
  void showSecondaryAxis; void setShowSecondaryAxis; void setHoveredCat; void setRightPanelOpen;
  // Per-series color overrides — clicking a Legend swatch lets you
  // recolor the entire series without changing the theme. Stored
  // per-chart-type so different chart types can have different colors.
  const [seriesColorsByType, setSeriesColorsByType] = useState<Partial<Record<ChartType, Record<string, string>>>>({});
  const seriesColors = seriesColorsByType[type] || {};
  const setSeriesColor = useCallback((key: string, color: string | null) => {
    setSeriesColorsByType(p => {
      const cur = { ...(p[type] || {}) };
      if (color === null) delete cur[key];
      else cur[key] = color;
      return { ...p, [type]: cur };
    });
  }, [type]);

  // Manual axis range overrides for charts that have a numeric Y axis.
  // Empty string = auto. Stored per-chart-type.
  const [axisByType, setAxisByType] = useState<Partial<Record<ChartType, { yMin?: number; yMax?: number; xMin?: number; xMax?: number }>>>({});
  const axis = axisByType[type] || {};
  const setAxis = useCallback((next: { yMin?: number; yMax?: number; xMin?: number; xMax?: number }) => {
    setAxisByType(p => ({ ...p, [type]: next }));
  }, [type]);
  const [numFmt, setNumFmt] = useState<NumberFormat>("auto");

  // Per-type sheets so switching types doesn't lose data. Wrapped in
  // history-aware updater so undo/redo can rewind any change.
  const [sheets, setSheetsRaw] = useState<Partial<Record<ChartType, DataSheet>>>(() => ({}));
  // Optional secondary table per chart type — used by the FLOPs Comparison
  // template which has TWO tables (raw values + indexed). The data section
  // shows a [Table 1][Table 2] tab bar when a secondary exists.
  const [secondarySheets, setSecondarySheets] = useState<Partial<Record<ChartType, DataSheet>>>({});
  const [activeDataTab, setActiveDataTab] = useState<"primary" | "secondary">("primary");
  // Per-type annotations (CAGR, diff, reference lines)
  const [annotByType, setAnnotByType] = useState<Partial<Record<ChartType, Annotation[]>>>({});
  // Multi-step pick mode for CAGR / diff arrows. Null = idle.
  const [pickMode, setPickMode] = useState<PickMode>(null);
  // Single-click placement mode for the ANNOTATE TEXT tool.
  const [placeMode, setPlaceMode] = useState<PlaceMode>(null);
  // Floating toolbar selection (LEGACY · still kept for backwards compat)
  const [selection, setSelection] = useState<BarSelection | null>(null);
  // Wave 11 · radial-menu-style selection — primary UI driver
  const [selected, setSelected] = useState<SelectedElement | null>(null);
  // Wave 13 · click model split: single click sets `selected` (handles only),
  // double click (or 2nd click on already-selected) flips popupOpen=true.
  const [popupOpen, setPopupOpen] = useState(false);
  const lastSelectAtRef = useRef<{ key: string; t: number }>({ key: "", t: 0 });
  // Stable identity key for a selection — used to detect "second click on
  // same element" within the 300ms double-click window.
  const selKey = useCallback((s: SelectedElement | null): string => {
    if (!s) return "";
    if (s.kind === "segment" || s.kind === "point") return `${s.kind}:${s.rowIdx}:${s.key}`;
    if (s.kind === "mekkoColumn") return `mekkoColumn:${s.rowIdx}`;
    if (s.kind === "label") return `label:${s.labelType}:${s.rowIdx ?? -1}:${s.key ?? ""}`;
    if (s.kind === "annotation") return `annotation:${s.id}`;
    if (s.kind === "axis") return `axis:${s.which}`;
    if (s.kind === "legend") return `legend:${s.key}`;
    return s.kind;
  }, []);
  // Wrapping selection handler: single click selects + closes popup; second
  // click on same element (or fast double click) opens the popup.
  const selectElement: OnSelectElement = useCallback((sel) => {
    if (!sel) { setSelected(null); setPopupOpen(false); lastSelectAtRef.current = { key: "", t: 0 }; return; }
    const k = selKey(sel);
    const now = Date.now();
    const prev = lastSelectAtRef.current;
    const isSameRecent = prev.key === k && now - prev.t < 320;
    setSelected(sel);
    if (isSameRecent) {
      setPopupOpen(true);
    } else {
      setPopupOpen(false);
    }
    lastSelectAtRef.current = { key: k, t: now };
  }, [selKey]);
  const [wheelAnchor, setWheelAnchor] = useState<WheelAnchor | null>(null);
  // Wave 11 · new feature toggles
  const [showTotalLabels, setShowTotalLabels] = useState(true);
  const [showTickMarks, setShowTickMarks] = useState(false);
  const [show100Indicator, setShow100Indicator] = useState(false);
  const [axisBreak, setAxisBreak] = useState(false);
  void axisBreak; void setAxisBreak;
  // Wave 12 · POAST box-logo watermark mode (off / centered / random)
  const [watermark, setWatermark] = useState<"off" | "centered" | "random">("off");
  // Wave 13 · global bar-width slider (percentage of group width).
  const [barWidthPct, setBarWidthPct] = useState(65);
  // Wave 13 · row-selection state per chart type. The DataSheet always shows
  // the full sheet for editing; renderers consume a filtered view when set.
  const [selectedRowIdxsByType, setSelectedRowIdxsByType] = useState<Partial<Record<ChartType, number[]>>>({});
  // Whether to actually filter the chart to selected rows (per type).
  const [chartedRowsByType, setChartedRowsByType] = useState<Partial<Record<ChartType, number[]>>>({});
  // Wave 12 · expanded webapp mode + pane state
  const [expandedMode, setExpandedMode] = useState(false);
  // Lock body scroll while expanded so the expanded shell isn't competing
  // with the outer /charts page header (which is sticky and can show through
  // if the page scrolls underneath the portal).
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (expandedMode) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = prev; };
    }
  }, [expandedMode]);
  const [paneMode, setPaneMode] = useState<"chart" | "table" | "split">("split");
  const [splitOrientation, setSplitOrientation] = useState<"vertical" | "horizontal">("vertical");
  const [splitterPos, setSplitterPos] = useState(0.55); // 0..1 ratio of first pane
  // Wave 15 · zoom for the Launch chart pane. "fit" auto-scales to fill the
  // pane (the default — and what we snap back to whenever the layout
  // changes); a numeric percentage scales by that factor and lets the pane
  // scroll if oversized. Presets: 50/75/100/125/150/200/300.
  const [chartZoom, setChartZoom] = useState<"fit" | number>("fit");
  // Wave 15 · pop-out modes for the Launch table pane.
  //   "docked"   — table inside the split layout (default)
  //   "floating" — table is a draggable + resizable floating window over the shell
  //   "window"   — table is in a separate browser window via window.open()
  const [tableWindowMode, setTableWindowMode] = useState<"docked" | "floating" | "window">("docked");
  const [floatingTablePos, setFloatingTablePos] = useState<{ x: number; y: number; w: number; h: number }>(() => {
    if (typeof window === "undefined") return { x: 80, y: 80, w: 720, h: 520 };
    try {
      const raw = localStorage.getItem("cm2-floating-table-pos");
      if (raw) return JSON.parse(raw);
    } catch {}
    return { x: Math.max(40, (typeof window !== "undefined" ? window.innerWidth : 1280) - 760), y: 100, w: 720, h: 520 };
  });
  useEffect(() => {
    try { localStorage.setItem("cm2-floating-table-pos", JSON.stringify(floatingTablePos)); } catch {}
  }, [floatingTablePos]);
  // Wave 15.1 · floating Launch toolbar (movable, pinnable, customizable).
  // Persists tool list, position, pinned state, and visibility to
  // localStorage so it survives reloads.
  const [floatToolbarTools, setFloatToolbarTools] = useState<FloatToolId[]>(() => {
    if (typeof window === "undefined") return DEFAULT_FLOAT_TOOLS.slice();
    try {
      const raw = localStorage.getItem("cm2-float-toolbar-tools");
      if (raw) {
        const parsed = parseFloatToolsSaved(JSON.parse(raw));
        if (parsed) return parsed;
      }
    } catch {}
    return DEFAULT_FLOAT_TOOLS.slice();
  });
  const [floatToolbarPos, setFloatToolbarPos] = useState<{ x: number; y: number } | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const raw = localStorage.getItem("cm2-float-toolbar-pos");
      if (raw) {
        const v = JSON.parse(raw);
        if (v && typeof v.x === "number" && typeof v.y === "number") return { x: v.x, y: v.y };
      }
    } catch {}
    return null;
  });
  const [floatToolbarPinned, setFloatToolbarPinned] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    try {
      const raw = localStorage.getItem("cm2-float-toolbar-pinned");
      if (raw === "0") return false;
      if (raw === "1") return true;
    } catch {}
    return true;
  });
  const [floatToolbarVisible, setFloatToolbarVisible] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    try {
      const raw = localStorage.getItem("cm2-float-toolbar-visible");
      if (raw === "0") return false;
      if (raw === "1") return true;
    } catch {}
    return true;
  });
  const [floatToolbarEditorOpen, setFloatToolbarEditorOpen] = useState(false);
  // Wave 15.1 · imperative open flag for the Templates modal — wired from
  // the float toolbar's "Templates" action so it can open the SAME modal the
  // FILE-group button opens (both render the headless instance via the
  // `openExternal` flag, so the user gets a single consistent gallery).
  const [floatToolbarTemplatesOpen, setFloatToolbarTemplatesOpen] = useState(false);
  useEffect(() => {
    try { localStorage.setItem("cm2-float-toolbar-tools", JSON.stringify(floatToolbarTools)); } catch {}
  }, [floatToolbarTools]);
  useEffect(() => {
    try {
      if (floatToolbarPos) localStorage.setItem("cm2-float-toolbar-pos", JSON.stringify(floatToolbarPos));
      else localStorage.removeItem("cm2-float-toolbar-pos");
    } catch {}
  }, [floatToolbarPos]);
  useEffect(() => {
    try { localStorage.setItem("cm2-float-toolbar-pinned", floatToolbarPinned ? "1" : "0"); } catch {}
  }, [floatToolbarPinned]);
  useEffect(() => {
    try { localStorage.setItem("cm2-float-toolbar-visible", floatToolbarVisible ? "1" : "0"); } catch {}
  }, [floatToolbarVisible]);
  // Wave 15 · auto-fit zoom whenever the chart pane changes shape. Snapping
  // to "fit" on every layout flip keeps the chart filling its container —
  // the user can always re-zoom afterwards.
  useEffect(() => {
    setChartZoom("fit");
  }, [paneMode, splitOrientation, splitterPos, expandedMode]);
  // Wave 14 · cinematic transition · captured anchor coords for expand morph
  const [expandTransitionFrom, setExpandTransitionFrom] = useState<{ x: number; y: number } | null>(null);
  const expandAnchorRef = useRef<HTMLSpanElement | null>(null);
  const templatesAnchorRef = useRef<HTMLSpanElement | null>(null);
  // Wave 14 · onboarding tour state
  const [tourOpen, setTourOpen] = useState(false);
  // Wave 14 · app-wide theme switcher
  const [appTheme, setAppTheme] = useAppTheme();
  // Wave 14 · vignette toggle (default on)
  const [vignette, setVignette] = useState(true);
  // Wave 14 · branded export footer toggle (default off)
  const [exportBranding, setExportBranding] = useState(false);
  // Wave 12 · radial wheel customization (which icons appear per kind).
  // Loaded from localStorage so user prefs persist across sessions.
  const [wheelConfig, setWheelConfig] = useState<Record<string, string[] | "all">>({});
  const [wheelSettingsOpen, setWheelSettingsOpen] = useState(false);
  useEffect(() => {
    try {
      const raw = localStorage.getItem("cm2-wheel-config-v1");
      if (raw) setWheelConfig(JSON.parse(raw));
    } catch {}
  }, []);
  useEffect(() => {
    try { localStorage.setItem("cm2-wheel-config-v1", JSON.stringify(wheelConfig)); } catch {}
  }, [wheelConfig]);

  const rawSheet = sheets[type] || samplePerType(type);
  // Renderers read the computed sheet (formulas evaluated) so chart values
  // reflect =SUM/=A1+B2 etc. The data sheet itself receives the raw sheet
  // so users can keep editing the formulas.
  const sheetFull = useMemo(() => computeSheet(rawSheet), [rawSheet]);
  // Wave 13 · filtered sheet — applied when "Chart selected only" is on.
  const sheet = useMemo(() => {
    const filter = chartedRowsByType[type];
    if (!filter || filter.length === 0) return sheetFull;
    const rows = filter.map(i => sheetFull.rows[i]).filter(Boolean);
    return { ...sheetFull, rows };
  }, [sheetFull, chartedRowsByType, type]);
  // Wave 13 · selected-row Set wrapper for the current chart type.
  const selectedRowIdxs = useMemo(() => new Set(selectedRowIdxsByType[type] ?? []), [selectedRowIdxsByType, type]);
  const setSelectedRowIdxs = useCallback((next: Set<number>) => {
    setSelectedRowIdxsByType(p => ({ ...p, [type]: Array.from(next).sort((a, b) => a - b) }));
  }, [type]);
  const chartedRowsActive = !!chartedRowsByType[type] && (chartedRowsByType[type]?.length ?? 0) > 0;
  const toggleChartedRows = useCallback(() => {
    setChartedRowsByType(p => {
      if (p[type] && (p[type]?.length ?? 0) > 0) { const next = { ...p }; delete next[type]; return next; }
      const sel = selectedRowIdxsByType[type] ?? [];
      if (sel.length === 0) return p;
      return { ...p, [type]: sel };
    });
  }, [type, selectedRowIdxsByType]);
  const clearChartedRows = useCallback(() => {
    setChartedRowsByType(p => { const next = { ...p }; delete next[type]; return next; });
    setSelectedRowIdxsByType(p => { const next = { ...p }; delete next[type]; return next; });
  }, [type]);
  const [sliderMode, setSliderMode] = useState(false);
  // Wave 14.2 · Table engine selector for Launch (Expanded) mode. Standard
  // = the existing in-house DataSheetGrid (lean, ~0 KB extra). Univer =
  // full Excel-grade spreadsheet (formula engine, multi-sheet, freeze
  // panes, conditional formatting). Persisted to localStorage so the
  // user's preference survives reloads.
  // Wave 15 · Default UNIVER so Launch mode feels like a real Excel-grade
  // suite the moment a user enters it. Univer JS still loads lazily inside
  // UniverSheetPane, so the compact route weight is unchanged — Univer only
  // boots up if the user actually opens Launch.
  const [tableEngine, setTableEngine] = useState<"standard" | "univer">("univer");
  useEffect(() => {
    try {
      const v = localStorage.getItem("cm2-table-engine");
      if (v === "univer" || v === "standard") setTableEngine(v);
    } catch {}
  }, []);
  useEffect(() => {
    try { localStorage.setItem("cm2-table-engine", tableEngine); } catch {}
  }, [tableEngine]);
  const annotations = annotByType[type] || [];
  const setSheet = useCallback((s: DataSheet) => setSheetsRaw(p => ({ ...p, [type]: s })), [type]);

  // Undo/redo · snapshots {sheets, annotations} on each mutation. Debounced
  // 300ms so a single drag (which fires onUpdateRow many times) leaves
  // exactly one entry in the past stack — its pre-drag state.
  type Snap = { sheets: typeof sheets; annot: typeof annotByType };
  const past = useRef<Snap[]>([]);
  const future = useRef<Snap[]>([]);
  const lastPushAt = useRef(0);
  const [, setHistTick] = useState(0);
  const undo = useCallback(() => {
    const prev = past.current.pop();
    if (!prev) return;
    future.current.push({ sheets, annot: annotByType });
    setSheetsRaw(prev.sheets);
    setAnnotByType(prev.annot);
    setHistTick(t => t + 1);
  }, [sheets, annotByType]);
  const redo = useCallback(() => {
    const next = future.current.pop();
    if (!next) return;
    past.current.push({ sheets, annot: annotByType });
    setSheetsRaw(next.sheets);
    setAnnotByType(next.annot);
    setHistTick(t => t + 1);
  }, [sheets, annotByType]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      const target = e.target as HTMLElement;
      const inInput = target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
      const k = e.key.toLowerCase();
      if (k === "z" && !e.shiftKey) { e.preventDefault(); undo(); }
      else if ((k === "z" && e.shiftKey) || k === "y") { e.preventDefault(); redo(); }
      else if (!inInput && k === "d" && !e.shiftKey) { e.preventDefault(); setDesignOpen(v => !v); }
      else if (!inInput && k === "l" && !e.shiftKey) { e.preventDefault(); setLocked(v => !v); }
      else if (!inInput && k === "e" && e.shiftKey) {
        e.preventDefault();
        if (expandAnchorRef.current) {
          const r = expandAnchorRef.current.getBoundingClientRect();
          setExpandTransitionFrom({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
        }
        setExpandedMode(v => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo]);

  // setSheets / setAnnotations are debounced-history wrappers around their
  // raw counterparts. Drag pointermove calls them many times in a burst;
  // only the first within a 300ms window snapshots the prior state.
  const setSheets = useCallback((updater: (p: typeof sheets) => typeof sheets) => {
    const now = Date.now();
    if (now - lastPushAt.current > 300) {
      past.current.push({ sheets, annot: annotByType });
      if (past.current.length > 100) past.current.shift();
      future.current = [];
      lastPushAt.current = now;
      setHistTick(t => t + 1);
    }
    setSheetsRaw(updater);
  }, [sheets, annotByType]);
  const setAnnotations = useCallback((next: Annotation[]) => {
    const now = Date.now();
    if (now - lastPushAt.current > 300) {
      past.current.push({ sheets, annot: annotByType });
      if (past.current.length > 100) past.current.shift();
      future.current = [];
      lastPushAt.current = now;
      setHistTick(t => t + 1);
    }
    setAnnotByType(p => ({ ...p, [type]: next }));
  }, [sheets, annotByType, type]);

  // Gantt-specific options
  const [ganttOpts, setGanttOpts] = useState<GanttOpts>({
    unit: "month", showDates: true, showDuration: false, showOwner: true,
    showProgress: true, showToday: true, showGroups: true,
    collapseAll: false, collapsedKeys: {},
  });

  const cfg: ChartConfig = { type, title, subtitle, theme, numFmt, seriesColors, yMin: axis.yMin, yMax: axis.yMax, xMin: axis.xMin, xMax: axis.xMax, lightBackdrop: backdropMode === "light", showBorders, showGridlines, showSegmentLabels, legendPos, yLabel: yLabel || undefined, xLabel: xLabel || undefined, locked, logScale, showEndLabels, markerShape, roundedCorners, pieOtherThreshold, showTotalLabels, showTickMarks, show100Indicator, axisBreak, watermark, barWidthPct };

  // Pick-mode handler · column-chart renderers call this on bar click.
  // Returns true if the click was consumed (we're in pick mode); the
  // renderer then suppresses its drag/contextmenu handling for that click.
  const onPickBar: OnPickBar = useCallback((rowIdx, key) => {
    if (!pickMode) return false;
    const next = [...pickMode.bars, { rowIdx, key }];
    if (next.length >= 2) {
      const annot: Annotation = {
        id: Math.random().toString(36).slice(2, 9),
        kind: pickMode.kind,
        rowFrom: next[0].rowIdx,
        rowTo: next[1].rowIdx,
        seriesKey: next[0].key,
      };
      setAnnotations([...annotations, annot]);
      setPickMode(null);
    } else {
      setPickMode({ ...pickMode, bars: next });
    }
    return true;
  }, [pickMode, annotations, setAnnotations]);

  // Add a reference line annotation. Uses inline prompt UI in the toolbar
  // so it doesn't need a modal.
  const addReferenceLine = useCallback((value: number, label: string) => {
    setAnnotations([...annotations, {
      id: Math.random().toString(36).slice(2, 9),
      kind: "refline",
      value,
      label: label || undefined,
    }]);
  }, [annotations, setAnnotations]);
  const removeAnnotation = useCallback((id: string) => {
    setAnnotations(annotations.filter(a => a.id !== id));
  }, [annotations, setAnnotations]);
  const clearAllAnnotations = useCallback(() => {
    setAnnotations([]);
  }, [setAnnotations]);

  const svgRef = useRef<SVGSVGElement | null>(null);

  // When switching to a working type with no stored sheet, pre-load the sample
  useEffect(() => {
    if (!sheets[type]) setSheets(p => ({ ...p, [type]: samplePerType(type) }));
    // also align title to type
    if (type === "gantt" && title.indexOf("Outlook") !== -1) setTitle("SemiAnalysis · 2026 Brand Launch");
    // Wave 11 · clear selection when type changes (selected refs may be stale)
    setSelected(null);
    setPopupOpen(false);
    setWheelAnchor(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type]);

  const onToggleGroup = (k: string) => setGanttOpts(p => ({ ...p, collapsedKeys: { ...p.collapsedKeys, [k]: !p.collapsedKeys[k] } }));

  const W = 1280;
  const H = type === "gantt" ? 700 : 560;

  // Slug for the downloaded file
  const slug = () => (title || "chart").replace(/\s+/g, "-").toLowerCase();

  // Wave 15 · Shared canvas-bake pipeline. Serializes the live SVG, paints
  // it into a 2× retina canvas with the current backdrop, and yields the
  // canvas back to a callback. PNG / JPG / PPTX all use this so they share
  // identical fidelity (no drift between formats).
  const bakeChartCanvas = (cb: (cv: HTMLCanvasElement, w: number, h: number) => void) => {
    if (!svgRef.current) return;
    const svg = svgRef.current;
    const xml = new XMLSerializer().serializeToString(svg);
    const w = svg.clientWidth || W;
    const h = svg.clientHeight || H;
    const img = new Image();
    const blob = new Blob([xml], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    img.onload = () => {
      const cv = document.createElement("canvas");
      cv.width = w * 2; cv.height = h * 2;
      const ctx = cv.getContext("2d");
      if (!ctx) { URL.revokeObjectURL(url); return; }
      const spec = backdropMode === "dark" ? BACKDROPS_DARK[backdrop] : BACKDROPS_LIGHT[backdrop];
      ctx.fillStyle = spec.base;
      ctx.fillRect(0, 0, cv.width, cv.height);
      for (const g of spec.glows) {
        const cx = g.x * cv.width, cy = g.y * cv.height;
        const radius = g.r * Math.max(cv.width, cv.height);
        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
        grad.addColorStop(0, g.color);
        grad.addColorStop(1, "transparent");
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, cv.width, cv.height);
      }
      ctx.scale(2, 2);
      ctx.drawImage(img, 0, 0, w, h);
      if (exportBranding) {
        ctx.save();
        ctx.fillStyle = "rgba(168,164,160,0.55)";
        ctx.font = "bold 8px 'JetBrains Mono', monospace";
        ctx.textAlign = "right";
        ctx.textBaseline = "bottom";
        ctx.fillText("Built with POAST Chart Maker · poast.app/charts", w - 8, h - 8);
        ctx.restore();
      }
      URL.revokeObjectURL(url);
      cb(cv, w, h);
    };
    img.onerror = () => { showToast("Couldn't render chart"); URL.revokeObjectURL(url); };
    img.src = url;
  };

  const exportPNG = () => {
    bakeChartCanvas((cv) => {
      cv.toBlob(b => {
        if (!b) return;
        const dl = URL.createObjectURL(b);
        const a = document.createElement("a");
        a.href = dl;
        a.download = slug() + ".png";
        a.click();
        URL.revokeObjectURL(dl);
      }, "image/png");
    });
  };

  // Wave 15 · JPG export — same pipeline, lossy JPEG at 0.92 quality.
  // Smaller files than PNG, ideal for slide decks and email attachments.
  const exportJPG = () => {
    bakeChartCanvas((cv) => {
      cv.toBlob(b => {
        if (!b) return;
        const dl = URL.createObjectURL(b);
        const a = document.createElement("a");
        a.href = dl;
        a.download = slug() + ".jpg";
        a.click();
        URL.revokeObjectURL(dl);
      }, "image/jpeg", 0.92);
    });
  };

  // Wave 15 · Capture chart as PNG data-URL (used by the PPTX exporter
  // and any future "drop chart into a doc" pipeline). Returns a Promise
  // so the caller can await the bake before composing the slide.
  const captureChartAsPngDataUrl = (): Promise<string> =>
    new Promise<string>((resolve, reject) => {
      try {
        bakeChartCanvas((cv) => {
          try { resolve(cv.toDataURL("image/png")); }
          catch (e) { reject(e); }
        });
      } catch (e) { reject(e); }
    });

  // Wave 15 · PowerPoint (.pptx) export via pptxgenjs. Dynamic-imported so
  // the ~250 KB library only loads when a user actually clicks the button —
  // compact mode stays unaffected. Slide layout: title + subtitle on top,
  // chart image centered, "Built with POAST Chart Maker" footer.
  const exportPPTX = async () => {
    try {
      const dataUrl = await captureChartAsPngDataUrl();
      const mod = await import("pptxgenjs");
      const PptxCtor = (mod as { default: new () => unknown }).default;
      const pres = new PptxCtor() as {
        title: string;
        author: string;
        addSlide: () => {
          background: { color: string };
          addText: (txt: string, opts: Record<string, unknown>) => void;
          addImage: (opts: Record<string, unknown>) => void;
        };
        writeFile: (opts: { fileName: string }) => Promise<unknown>;
      };
      pres.title = title || "POAST Chart";
      pres.author = "POAST Chart Maker";
      const slide = pres.addSlide();
      slide.background = { color: "0A0A0E" };
      slide.addText(title || "Untitled chart", { x: 0.5, y: 0.3, w: 9, h: 0.6, fontSize: 28, color: "F7B041", bold: true, fontFace: "Outfit" });
      if (subtitle) {
        slide.addText(subtitle, { x: 0.5, y: 1.0, w: 9, h: 0.4, fontSize: 14, color: "A8A4A0", fontFace: "Outfit" });
      }
      slide.addImage({ data: dataUrl, x: 0.5, y: 1.6, w: 9, h: 5 });
      slide.addText("Built with POAST Chart Maker", { x: 0.5, y: 7.0, w: 9, h: 0.3, fontSize: 9, color: "5C5A57", italic: true, align: "right", fontFace: "Outfit" });
      await pres.writeFile({ fileName: slug() + ".pptx" });
    } catch (e) {
      console.error("PPTX export failed", e);
      showToast("Couldn't export PowerPoint — try PNG instead");
    }
  };

  // Vector SVG export · serializes the live SVG and downloads the file
  // directly. Best for slides where you want infinite zoom and editable
  // shapes downstream.
  const exportSVG = () => {
    if (!svgRef.current) return;
    const svg = svgRef.current.cloneNode(true) as SVGSVGElement;
    // Force a viewBox if missing so the file renders standalone
    if (!svg.getAttribute("viewBox")) svg.setAttribute("viewBox", "0 0 " + W + " " + H);
    svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    svg.setAttribute("xmlns:xlink", "http://www.w3.org/1999/xlink");
    // Wave 14 · branded export footer
    if (exportBranding) {
      const t = document.createElementNS("http://www.w3.org/2000/svg", "text");
      t.setAttribute("x", String(W - 8));
      t.setAttribute("y", String(H - 8));
      t.setAttribute("text-anchor", "end");
      t.setAttribute("font-family", "'JetBrains Mono', monospace");
      t.setAttribute("font-size", "8");
      t.setAttribute("font-weight", "700");
      t.setAttribute("fill", "rgba(168,164,160,0.55)");
      t.textContent = "Built with POAST Chart Maker · poast.app/charts";
      svg.appendChild(t);
    }
    const xml = new XMLSerializer().serializeToString(svg);
    const blob = new Blob(['<?xml version="1.0" encoding="UTF-8"?>\n', xml], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = slug() + ".svg";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  // ⌘⇧C copy-as-PNG keyboard shortcut · effect after copyPNG is declared
  // (added below). Stub here for forward declaration via useCallback below.

  // Copy chart as PNG to clipboard
  const copyPNG = useCallback(async () => {
    const svg = svgRef.current;
    if (!svg) return;
    const xml = new XMLSerializer().serializeToString(svg);
    const blob = new Blob([xml], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const img = new window.Image();
    img.onload = async () => {
      const canvas = document.createElement("canvas");
      canvas.width = svg.viewBox.baseVal.width * 2;
      canvas.height = svg.viewBox.baseVal.height * 2;
      const ctx = canvas.getContext("2d")!;
      ctx.scale(2, 2);
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      canvas.toBlob(async (b) => {
        if (!b) return;
        try {
          await navigator.clipboard.write([new ClipboardItem({ "image/png": b })]);
          showToast("Chart copied to clipboard");
        } catch { showToast("Copy failed — use Export PNG instead"); }
      }, "image/png");
    };
    img.src = url;
  }, []);

  // Wave 14 · ⌘⇧C copy-PNG keyboard binding (separate effect since copyPNG must be in scope)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      if (!e.shiftKey) return;
      const target = e.target as HTMLElement;
      const inInput = target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
      if (inInput) return;
      const k = e.key.toLowerCase();
      if (k === "c") { e.preventDefault(); copyPNG(); playExportChime(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [copyPNG]);

  // Update a single sheet row directly (used by drag interactions).
  // The renderer hands us back the row index plus a partial patch; we
  // splice it into the active type's sheet.
  const onUpdateRow = useCallback((rowIdx: number, patch: Record<string, CellValue>) => {
    setSheets(p => {
      const cur = p[type] || samplePerType(type);
      const next = cur.rows.slice();
      next[rowIdx] = { ...next[rowIdx], ...patch };
      return { ...p, [type]: { ...cur, rows: next } };
    });
  }, [type]);

  // Drop a row from the active sheet (used by right-click "delete").
  const onDeleteRow = useCallback((rowIdx: number) => {
    setSheets(p => {
      const cur = p[type] || samplePerType(type);
      if (cur.rows.length <= 1) return p;
      return { ...p, [type]: { ...cur, rows: cur.rows.filter((_, i) => i !== rowIdx) } };
    });
  }, [type]);

  // Append a new Gantt task with sensible defaults. Today→+7d, inherits
  // group/owner from the last row so the new task lands inside the current
  // workstream.
  const appendGanttTask = useCallback(() => {
    setSheets(p => {
      const cur = p["gantt"] || samplePerType("gantt");
      const last = cur.rows[cur.rows.length - 1] || {};
      const today = Date.now();
      const start = msToISODate(today);
      const end = msToISODate(today + 7 * DAY_MS);
      const next: Record<string, CellValue> = { task: "New task", start, end, group: String(last.group || "Tasks"), owner: String(last.owner || ""), progress: 0 };
      return { ...p, gantt: { ...cur, rows: [...cur.rows, next] } };
    });
  }, []);

  // Right-click context menu state. The menu lives outside the SVG so
  // it can render on top with HTML styling.
  const [menu, setMenu] = useState<{ x: number; y: number; items: ContextMenuItem[] } | null>(null);
  // Keyboard shortcut overlay (? key)
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  // Welcome screen — first-visit tutorial. Honors `cm2-welcome-seen-v1` flag in
  // localStorage. Set on mount synchronously so the screen flashes only once.
  const [welcomeOpen, setWelcomeOpen] = useState(false);
  useEffect(() => {
    try {
      const seen = localStorage.getItem("cm2-welcome-seen-v1");
      if (!seen) setWelcomeOpen(true);
    } catch {}
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      // Don't intercept inside inputs / textareas
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (e.key === "?" || (e.key === "/" && e.shiftKey)) { e.preventDefault(); setShortcutsOpen(v => !v); }
      if (e.key === "Escape") {
        setShortcutsOpen(false); setWheelOpen(false); setWheelAnchor(null);
        setSelected(null); setPopupOpen(false); setSelection(null);
        // Wave 12 · Esc also exits expanded mode if no other overlay caught it
        setExpandedMode(false);
      }
      if (e.key === "w" || e.key === "W") {
        e.preventDefault();
        setWheelOpen(v => { if (!v) playWheelOpen(); else playWheelClose(); return !v; });
      }
      // Wave 11 · M opens the radial wheel for the current selection
      if (e.key === "m" || e.key === "M") {
        if (selected) {
          e.preventDefault();
          // Anchor at center of viewport when keyboard-triggered
          const cx = (typeof window !== "undefined" ? window.innerWidth : 1280) / 2;
          const cy = (typeof window !== "undefined" ? window.innerHeight : 800) / 2;
          setWheelAnchor({ x: cx, y: cy, selected });
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected]);
  const onShowMenu: OnShowMenu = useCallback((e, items) => {
    e.preventDefault();
    e.stopPropagation();
    setMenu({ x: e.clientX, y: e.clientY, items });
  }, []);

  // Pre-build the ElementIconMenu callbacks bound to the current state.
  // The chart renderer passes them in onShowElementMenu and the bar
  // captures rowIdx/key/color into the menu state when right-clicked.
  const onShowElementMenu: OnShowElementMenu = useCallback((s) => {
    setElementMenu({
      ...s,
      onCagr: () => setPickMode({ kind: "cagr", bars: s.rowIdx !== undefined && s.seriesKey ? [{ rowIdx: s.rowIdx, key: s.seriesKey }] : [] }),
      onDiff: () => setPickMode({ kind: "diff", bars: s.rowIdx !== undefined && s.seriesKey ? [{ rowIdx: s.rowIdx, key: s.seriesKey }] : [] }),
      onRefLine: () => {
        if (s.rowIdx === undefined || !s.seriesKey) return;
        const cur = sheets[type] || samplePerType(type);
        const v = Number(cur.rows[s.rowIdx]?.[s.seriesKey]) || 0;
        setAnnotations([...(annotByType[type] || []), { id: Math.random().toString(36).slice(2, 9), kind: "refline", value: v, label: String(v) }]);
      },
      onCallout: () => setPlaceMode({ kind: "callout" }),
      onSetColor: (c) => { if (s.seriesKey) setSeriesColor(s.seriesKey, c); },
      onDelete: () => { if (s.rowIdx !== undefined && s.seriesKey) onUpdateRow(s.rowIdx, { [s.seriesKey]: 0 }); },
    });
  }, [annotByType, type, sheets, setAnnotations, setSeriesColor, onUpdateRow]);

  const onOpenWheel = useCallback((clientX: number, clientY: number) => {
    setWheelAnchor({ x: clientX, y: clientY, selected });
  }, [selected]);
  const renderChart = () => {
    const a = { onUpdateRow, onDeleteRow, onShowMenu, onShowElementMenu, annotations, pickMode, onPickBar, onSelect: setSelection, onSetSeriesColor: setSeriesColor, selected, onSelectElement: selectElement, onOpenWheel };
    switch (type) {
      case "stacked": return <StackedColumn sheet={sheet} cfg={cfg} W={W} H={H} {...a} />;
      case "clustered": return <ClusteredColumn sheet={sheet} cfg={cfg} W={W} H={H} {...a} />;
      case "pct": return <PercentColumn sheet={sheet} cfg={cfg} W={W} H={H} />;
      case "line": return <LineProfile sheet={sheet} cfg={cfg} W={W} H={H} {...a} />;
      case "stackedArea": return <LineProfile sheet={sheet} cfg={cfg} W={W} H={H} fill stacked {...a} />;
      case "pie": return <Pie sheet={sheet} cfg={cfg} W={W} H={H} />;
      case "doughnut": return <Pie sheet={sheet} cfg={cfg} W={W} H={H} doughnut />;
      case "scatter": return <Scatter sheet={sheet} cfg={cfg} W={W} H={H} />;
      case "bubble": return <Scatter sheet={sheet} cfg={cfg} W={W} H={H} bubble />;
      case "pctArea": return <LineProfile sheet={sheet} cfg={cfg} W={W} H={H} fill stacked pct100 {...a} />;
      case "mekkoPct": return <MekkoPercent sheet={sheet} cfg={cfg} W={W} H={H} onUpdateRow={onUpdateRow} selected={selected} onSelectElement={selectElement} onOpenWheel={onOpenWheel} />;
      case "mekkoUnit": return <MekkoUnit sheet={sheet} cfg={cfg} W={W} H={H} onUpdateRow={onUpdateRow} selected={selected} onSelectElement={selectElement} onOpenWheel={onOpenWheel} />;
      case "combo": return <ComboChart sheet={sheet} cfg={cfg} W={W} H={H} />;
      case "wfup": return <Waterfall sheet={sheet} cfg={cfg} W={W} H={H} />;
      case "wfdn": return <Waterfall sheet={sheet} cfg={cfg} W={W} H={H} />;
      case "variance": return <VarianceBar sheet={sheet} cfg={cfg} W={W} H={H} {...a} />;
      case "gantt": return <GanttSvg sheet={sheet} cfg={cfg} W={W} H={H} opts={ganttOpts} onToggleGroup={onToggleGroup} onUpdateRow={onUpdateRow} onDeleteRow={onDeleteRow} onShowMenu={onShowMenu} />;
      default: {
        return (
          <g>
            <rect x="0" y="0" width={W} height={H} fill="transparent" />
            <text x={W / 2} y={H / 2 - 10} textAnchor="middle" fill={C.txm} style={{ fontFamily: fontSans, fontSize: 18, fontWeight: 800 }}>Coming soon</text>
            <text x={W / 2} y={H / 2 + 14} textAnchor="middle" fill={C.txd} style={{ fontFamily: fontMono, fontSize: 11 }}>{TYPES.flat().find(t => t.id === type)?.label.toUpperCase()}</text>
          </g>
        );
      }
    }
  };

  // Wave 14 · honor the app theme tokens for chrome surfaces (toolbar / inputs / panels).
  // Charts keep their own backdrop logic — we only adjust the surrounding chrome.
  const tokens = APP_TOKENS[appTheme];
  const cardBg = appTheme === "dark" ? "#0D0D12" : "#FFFFFF";
  const borderC = tokens.border;
  void tokens; // tokens reserved for future theme-aware refactors

  // Wave 15.1 · shared template apply handler so every entry point (FILE
  // group button + float toolbar action) lands the same data + theme.
  const applyTemplate = useCallback((tpl: TemplateSpec) => {
    setType(tpl.type);
    const built = tpl.build();
    if (built && typeof built === "object" && "primary" in built) {
      const dual = built as { primary: DataSheet; secondary?: DataSheet };
      setSheets(p => ({ ...p, [tpl.type]: dual.primary }));
      if (dual.secondary) setSecondarySheets(p => ({ ...p, [tpl.type]: dual.secondary }));
    } else {
      setSheets(p => ({ ...p, [tpl.type]: built as DataSheet }));
    }
    if (tpl.title) setTitle(tpl.title);
    if (tpl.subtitle) setSubtitle(tpl.subtitle);
    if (tpl.theme) setTheme(tpl.theme);
  }, [setSheets]);

  // Wave 15.1 · float toolbar quick actions for sheet edits. These reuse the
  // same setSheets path the inline "Add row / Add column" buttons use so
  // undo/redo + history snapshots keep working uniformly.
  const floatAddRow = useCallback(() => {
    setSheets(p => {
      const cur = p[type] || samplePerType(type);
      const blank: Record<string, CellValue> = {};
      cur.schema.forEach(c => { blank[c.key] = c.type === "number" || c.type === "percent" ? 0 : ""; });
      return { ...p, [type]: { ...cur, rows: [...cur.rows, blank] } };
    });
  }, [setSheets, type]);
  const floatAddCol = useCallback(() => {
    setSheets(p => {
      const cur = p[type] || samplePerType(type);
      let n = 1;
      while (cur.schema.some(c => c.key === "s" + n)) n++;
      const newCol: ColumnSpec = { key: "s" + n, label: "Series " + n, type: "number" };
      return { ...p, [type]: { schema: [...cur.schema, newCol], rows: cur.rows.map(r => ({ ...r, [newCol.key]: 0 })) } };
    });
  }, [setSheets, type]);
  // Best-effort delete-selection handler — drops the row of a selected
  // segment/point/label, removes a selected annotation, or no-ops when
  // nothing is selected.
  const floatDeleteSel = useCallback(() => {
    if (selected) {
      if (selected.kind === "annotation") {
        removeAnnotation(selected.id);
        setSelected(null);
        return;
      }
      const rowIdx = (selected as { rowIdx?: number }).rowIdx;
      if (typeof rowIdx === "number") {
        onDeleteRow(rowIdx);
        setSelected(null);
        return;
      }
    }
    showToast("Select a row, label, or annotation first to delete it");
  }, [selected, onDeleteRow]);
  // Toggle browser fullscreen.
  const floatFullScreen = useCallback(() => {
    if (typeof document === "undefined") return;
    try {
      if (!document.fullscreenElement) document.documentElement.requestFullscreen?.();
      else document.exitFullscreen?.();
    } catch {}
  }, []);
  // Stepwise zoom for the Launch chart pane (mirrors ZoomWidget +/- step).
  const floatZoomBy = useCallback((delta: number) => {
    setChartZoom(prev => {
      const cur = prev === "fit" ? 100 : prev;
      return Math.max(25, Math.min(400, Math.round((cur + delta) / 25) * 25));
    });
  }, []);
  // Sound + theme toggles (already wired to localStorage via their hooks).
  const [floatSoundOn, setFloatSoundOn] = useState<boolean>(() => isSoundOn());
  useEffect(() => { setFloatSoundOn(isSoundOn()); }, []);
  const floatToggleSound = useCallback(() => {
    const next = !isSoundOn();
    setSoundOn(next);
    setFloatSoundOn(next);
  }, []);

  return (
    <div style={{ padding: "32px 0 0", maxWidth: 1400, margin: "0 auto", position: "relative" }}>
      <style>{`
        @keyframes cm2ChartSwap { 0% { opacity: 0; transform: translateY(6px) } 100% { opacity: 1; transform: translateY(0) } }
        @keyframes cmGlowDrift1 { 0%,100% { transform: translate(0,0) } 50% { transform: translate(40px,-26px) } }
        @keyframes cmGlowDrift2 { 0%,100% { transform: translate(0,0) } 50% { transform: translate(-30px,18px) } }
        @keyframes cmGlowDrift3 { 0%,100% { transform: translate(0,0) } 50% { transform: translate(22px,28px) } }
        @keyframes cmGlowDrift4 { 0%,100% { transform: translate(0,0) } 50% { transform: translate(-18px,-22px) } }
        @keyframes cm2ExpandPop { 0% { opacity: 0; transform: scale(0.985) } 100% { opacity: 1; transform: scale(1) } }
        @keyframes cm2BarRise { from { opacity: 0; transform: translateY(20px) scaleY(0.85) } to { opacity: 1; transform: translateY(0) scaleY(1) } }
        @keyframes cm2WedgePop { from { opacity: 0; transform: scale(0.4) } to { opacity: 1; transform: scale(1) } }
        @keyframes cm2TipFade { from { opacity: 0; transform: translateY(-3px) scale(0.96) } to { opacity: 1; transform: translateY(0) scale(1) } }
        @keyframes cm2TipFadeUp { from { opacity: 0; transform: translateY(3px) scale(0.96) } to { opacity: 1; transform: translateY(0) scale(1) } }
        @keyframes cm2TipFadeLeft { from { opacity: 0; transform: translateX(3px) scale(0.96) } to { opacity: 1; transform: translateX(0) scale(1) } }
        @keyframes cm2TipFadeRight { from { opacity: 0; transform: translateX(-3px) scale(0.96) } to { opacity: 1; transform: translateX(0) scale(1) } }
        @keyframes cm2ParticleDrift1 { 0%,100% { transform: translate(0,0) } 50% { transform: translate(40px,-30px) } }
        @keyframes cm2ParticleDrift2 { 0%,100% { transform: translate(0,0) } 50% { transform: translate(-30px,40px) } }
        @keyframes cm2ParticleDrift3 { 0%,100% { transform: translate(0,0) } 50% { transform: translate(20px,30px) } }
        @keyframes cm2ParticleDrift4 { 0%,100% { transform: translate(0,0) } 50% { transform: translate(-20px,-20px) } }
        @keyframes cm2MiniBarRise { from { transform: scaleY(0.05); opacity: 0 } to { transform: scaleY(1); opacity: 1 } }
        @keyframes cm2MiniLineDraw { from { stroke-dashoffset: 200 } to { stroke-dashoffset: 0 } }
        @keyframes cm2WelcomeBars { 0%,100% { transform: scaleY(1) } 50% { transform: scaleY(0.7) } }
        @keyframes cm2WelcomeRotate { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
        @keyframes cm2WelcomeMenuPulse { 0%,100% { opacity: 0.5 } 50% { opacity: 1 } }
        @keyframes cm2WelcomeGridSweep { 0% { opacity: 0.2 } 50% { opacity: 1 } 100% { opacity: 0.2 } }
        @keyframes cm2WelcomeSplit { 0%,100% { transform: translateX(0) } 50% { transform: translateX(2px) } }
        @keyframes cm2WelcomeMorph { 0%,100% { transform: scale(1) } 50% { transform: scale(1.1) } }
        @keyframes cm2OnboardSpot { from { opacity: 0; transform: scale(0.92) } to { opacity: 1; transform: scale(1) } }
        @keyframes cm2OnboardPulse { 0%,100% { box-shadow: 0 0 0 0 rgba(247,176,65,0.55) } 50% { box-shadow: 0 0 0 14px rgba(247,176,65,0.0) } }
        @keyframes cm2TplRise { from { opacity: 0; transform: translateY(8px) } to { opacity: 1; transform: translateY(0) } }
        @keyframes cm2ModalFromAnchor { from { opacity: 0; transform: scale(0.18) } to { opacity: 1; transform: scale(1) } }
        @keyframes cm2FlipMorph { from { opacity: 0.6; transform: scale(0.5) } to { opacity: 1; transform: scale(1) } }
      `}</style>
      {/* Wave 12 · animated glow drift background — sits BEHIND content */}
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 0, overflow: "hidden", borderRadius: 16 }}>
        <div style={{ position:"absolute", top:"-12%", right:"-6%", width:"55vw", height:"55vw", borderRadius:"50%",
          background:"radial-gradient(circle, rgba(247,176,65,0.06) 0%, transparent 60%)",
          animation:"cmGlowDrift1 22s ease-in-out infinite" }} />
        <div style={{ position:"absolute", bottom:"-15%", left:"8%", width:"60vw", height:"60vw", borderRadius:"50%",
          background:"radial-gradient(circle, rgba(11,134,209,0.05) 0%, transparent 60%)",
          animation:"cmGlowDrift2 28s ease-in-out infinite" }} />
        <div style={{ position:"absolute", top:"35%", left:"-12%", width:"42vw", height:"42vw", borderRadius:"50%",
          background:"radial-gradient(circle, rgba(46,173,142,0.04) 0%, transparent 60%)",
          animation:"cmGlowDrift3 32s ease-in-out infinite" }} />
        <div style={{ position:"absolute", top:"12%", right:"30%", width:"20vw", height:"20vw", borderRadius:"50%",
          background:"radial-gradient(circle, rgba(224,99,71,0.05) 0%, transparent 60%)",
          animation:"cmGlowDrift4 26s ease-in-out infinite" }} />
      </div>
      {/* Wave 14 · ambient particles + grain noise overlay */}
      <AmbientParticles />
      <GrainOverlay />
      <div style={{ position: "relative", zIndex: 1 }}>
      <div style={{ marginBottom: 16, display: "flex", alignItems: "flex-start", gap: 16, flexWrap: "wrap", paddingTop: standalone ? 16 : 0 }}>
        {!standalone && (
          <div style={{ flex: "1 1 auto", minWidth: 280 }}>
            <div style={{ fontFamily: gf, fontSize: 28, fontWeight: 900, color: C.tx, letterSpacing: -0.5 }}>Chart Maker 2</div>
            <div style={{ fontFamily: mn, fontSize: 10, color: C.txm, marginTop: 4, letterSpacing: 1.2, fontWeight: 800 }}>RADIAL MENU // PICK · EDIT · ANNOTATE · EXPORT</div>
          </div>
        )}
        {standalone && <div style={{ flex: "1 1 auto" }} />}
        {/* Back-to-POAST button removed — the /charts page header already
            has a "← POAST" chip top-left, so it was redundant here. */}
        {/* Wave 15 · Toolbar reorg — grouped FILE / EDIT / INSERT / FORMAT / VIEW
            with hairline separators and tiny uppercase group labels. Reads
            like Excel/Figma: every control instantly findable. SIMPLE/ADVANCED
            now lives next to LAUNCH (both are mode controls). Right edge =
            sound, theme, download icon (with PNG/JPG/SVG/PPTX/Copy menu). */}

        {/* FILE — Templates · Paste · Import Excel */}
        <ToolGroup label="File">
          <span data-tour="templates" ref={templatesAnchorRef} style={{ display: "inline-flex" }}>
            <TemplatesButton onPick={applyTemplate} />
          </span>
          <PasteDataButton onPaste={raw => { const ds = parsePasteForCategorical(raw); if (ds) setSheets(p => ({ ...p, [type]: ds })); else showToast("Couldn't parse the paste — expected TSV or CSV with headers"); }} />
          <ImportExcelButton onImport={ds => setSheets(p => ({ ...p, [type]: ds }))} />
        </ToolGroup>
        <Sep />

        {/* EDIT — Undo · Redo · Lock */}
        <ToolGroup label="Edit">
          <UndoRedoButtons onUndo={undo} onRedo={redo} canUndo={past.current.length > 0} canRedo={future.current.length > 0} />
          <Tooltip label={locked ? "Unlock editing" : "Lock chart"} shortcut="⌘L" position="bottom">
            <span style={{ display: "inline-flex" }}><LockToggle locked={locked} onChange={setLocked} /></span>
          </Tooltip>
        </ToolGroup>
        <Sep />

        {/* INSERT — Type Wheel · Number Format */}
        <ToolGroup label="Insert">
          <span data-tour="type-wheel">
            <Tooltip label="Open chart-type wheel · radial picker" shortcut="W" position="bottom">
              <GlassButton onClick={() => setWheelOpen(true)} title="Open chart-type wheel · radial picker (W)" Icon={Sparkles} primary>TYPE WHEEL</GlassButton>
            </Tooltip>
          </span>
          <NumberFormatPicker fmt={numFmt} onChange={setNumFmt} />
        </ToolGroup>
        <Sep />

        {/* FORMAT — Design · Wheel Settings */}
        <ToolGroup label="Format">
          <span data-tour="design">
            <Tooltip label="Design panel · palette, backdrops, gridlines" shortcut="⌘D" position="bottom">
              <GlassButton onClick={() => setDesignOpen(v => !v)} title="Design panel · click to toggle (⌘D)" Icon={Palette} primary={designOpen}>DESIGN</GlassButton>
            </Tooltip>
          </span>
          <Tooltip label="Customize the radial context wheel" position="bottom">
            <GlassButton
              onClick={() => setWheelSettingsOpen(true)}
              title="Customize the radial context wheel · pick which tools appear per element"
              Icon={Settings}
            >WHEEL</GlassButton>
          </Tooltip>
        </ToolGroup>
        <Sep />

        {/* VIEW — Simple/Advanced · Launch · Tour */}
        <ToolGroup label="View">
          <div style={{ display: "inline-flex", padding: 3, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 999 }}>
            {(["simple", "advanced"] as const).map(m => {
              const on = (m === "advanced") === advancedMode;
              return (
                <button
                  key={m}
                  onClick={() => setAdvancedMode(m === "advanced")}
                  style={{ padding: "6px 14px", borderRadius: 999, background: on ? C.amber + "22" : "transparent", border: "none", color: on ? C.amber : C.txm, fontFamily: mn, fontSize: 10, fontWeight: 800, letterSpacing: 0.6, cursor: "pointer", textTransform: "uppercase" }}
                >{m}</button>
              );
            })}
          </div>
          <span data-tour="expand" ref={expandAnchorRef}>
            <LaunchButton onClick={() => {
              if (expandAnchorRef.current) {
                const r = expandAnchorRef.current.getBoundingClientRect();
                setExpandTransitionFrom({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
              }
              setExpandedMode(true);
            }} />
          </span>
          {!tourCompleted() && (
            <Tooltip label="Take the tour" position="bottom">
              <button
                onClick={() => setTourOpen(true)}
                title="Take the interactive tour"
                style={{
                  display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
                  padding: "9px 12px", borderRadius: 9,
                  background: "linear-gradient(135deg, #2EAD8E 0%, #2EAD8Ecc 100%)",
                  border: "1px solid #2EAD8E88", color: "#0A0A0E",
                  fontFamily: mn, fontSize: 11, fontWeight: 800, letterSpacing: 0.5,
                  cursor: "pointer",
                  boxShadow: "0 4px 14px rgba(46,173,142,0.35), 0 1px 0 rgba(255,255,255,0.18) inset",
                }}
              >
                <HelpCircle size={13} strokeWidth={2.4} />
                TOUR
              </button>
            </Tooltip>
          )}
        </ToolGroup>

        <span style={{ flex: 1 }} />

        {/* RIGHT EDGE — Sound · Theme · Export download icon */}
        <SoundToggle />
        <AppThemeToggle theme={appTheme} onChange={setAppTheme} />
        <ExportDropdownIcon
          onPNG={() => { exportPNG(); playExportChime(); }}
          onJPG={() => { exportJPG(); playExportChime(); }}
          onSVG={() => { exportSVG(); playExportChime(); }}
          onPPTX={() => { exportPPTX(); playExportChime(); }}
          onCopyPNG={() => { copyPNG(); playExportChime(); }}
        />
      </div>

      {/* Annotations toolbar — context-wheel action chips */}
      <AnnotationsBar
        annotations={annotations}
        type={type}
        pickMode={pickMode}
        placeMode={placeMode}
        onStartPick={kind => { setPlaceMode(null); setPickMode({ kind, bars: [] }); }}
        onCancelPick={() => setPickMode(null)}
        onAddRefLine={addReferenceLine}
        onTogglePlaceText={() => { setPickMode(null); setPlaceMode(placeMode?.kind === "callout" ? null : { kind: "callout" }); }}
        onRemove={removeAnnotation}
        onClearAll={clearAllAnnotations}
      />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
        <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Title" style={inputCSS(cardBg, borderC)} />
        <input value={subtitle} onChange={e => setSubtitle(e.target.value)} placeholder="Subtitle" style={inputCSS(cardBg, borderC)} />
      </div>

      {/* Three-column layout: type sidebar + canvas/sheet + properties panel.
          SIMPLE mode hides both side panels; ADVANCED uses the full grid. */}
      <div style={{ display: "grid", gridTemplateColumns: advancedMode && rightPanelOpen ? "240px minmax(0, 1fr) 300px" : (advancedMode ? "240px minmax(0, 1fr)" : "minmax(0, 1fr)"), gap: 16, marginBottom: 28 }}>
        {advancedMode && <ChartTypeSidebar active={type} onSelect={setType} />}

        <div style={{ minWidth: 0 }}>
          {/* Gantt toggles only show for gantt */}
          {type === "gantt" && (
            <div style={{
              display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14,
              padding: "12px 14px",
              background: "rgba(13,13,18,0.72)",
              backdropFilter: "blur(14px) saturate(140%)",
              WebkitBackdropFilter: "blur(14px) saturate(140%)",
              border: "1px solid rgba(255,255,255,0.07)",
              borderRadius: 12,
              alignItems: "center",
              boxShadow: "0 1px 0 rgba(255,255,255,0.04) inset, 0 8px 24px rgba(0,0,0,0.30)",
            }}>
              <UnitPicker unit={ganttOpts.unit} onChange={u => setGanttOpts(p => ({ ...p, unit: u }))} />
              <Sep />
              <Toggle on={ganttOpts.showDates} onChange={v => setGanttOpts(p => ({ ...p, showDates: v }))} label="Dates" title="Show start / end dates inside each bar" />
              <Toggle on={ganttOpts.showDuration} onChange={v => setGanttOpts(p => ({ ...p, showDuration: v }))} label="Duration" title="Show 'Nd' centered on each bar" />
              <Toggle on={ganttOpts.showOwner} onChange={v => setGanttOpts(p => ({ ...p, showOwner: v }))} label="Owner" title="Show owner names on the left panel" />
              <Toggle on={ganttOpts.showProgress} onChange={v => setGanttOpts(p => ({ ...p, showProgress: v }))} label="% Complete" title="Show progress fill + percent label" />
              <Toggle on={ganttOpts.showToday} onChange={v => setGanttOpts(p => ({ ...p, showToday: v }))} label="Today" title="Coral dashed line at today's date" />
              <Sep />
              <Toggle on={ganttOpts.showGroups} onChange={v => setGanttOpts(p => ({ ...p, showGroups: v }))} label="Groups" title="Show parent group rows" />
              <Toggle on={ganttOpts.collapseAll} onChange={v => setGanttOpts(p => ({ ...p, collapseAll: v }))} label="Collapse all" title="Collapse every group" />
              <span style={{ flex: 1 }} />
              <GlassButton onClick={appendGanttTask} title="Append a new 7-day task using the last row's group + owner" Icon={Plus} primary>ADD TASK</GlassButton>
            </div>
          )}

          {/* Wave 11 · selection-driven mini toolbar. Renders only when
              something is selected (segment / point / label / axis / canvas). */}
          {selected && selected.kind !== "annotation" && selected.kind !== "legend" && (
            <TopMiniToolbar
              selected={selected}
              onClose={() => { setSelected(null); setPopupOpen(false); }}
              palette={THEMES[theme].colors}
              onSetSeriesColor={setSeriesColor}
              currentSeriesColor={(selected.kind === "segment" || selected.kind === "point") ? seriesColors[selected.key] : undefined}
              onUpdateRow={onUpdateRow}
              sheet={sheet}
              numFmt={numFmt}
              onChangeNumFmt={setNumFmt}
              onAddTotalLabel={() => setShowTotalLabels(v => !v)}
              onAddSegmentLabel={() => setShowSegmentLabels(v => !v)}
              onAddPercentLabel={() => setShowSegmentLabels(v => !v)}
              onAddSeriesCagr={() => {
                if (selected.kind === "segment" || selected.kind === "point") {
                  setAnnotations([...annotations, { id: Math.random().toString(36).slice(2, 9), kind: "seriesCagr", seriesKey: selected.key }]);
                }
              }}
              showGridlines={showGridlines}
              onToggleGridlines={() => setShowGridlines(v => !v)}
              showBorders={showBorders}
              onToggleBorders={() => setShowBorders(v => !v)}
              showTotalLabels={showTotalLabels}
              onToggleTotalLabels={() => setShowTotalLabels(v => !v)}
              showTickMarks={showTickMarks}
              onToggleTickMarks={() => setShowTickMarks(v => !v)}
              show100Indicator={show100Indicator}
              onToggle100Indicator={() => setShow100Indicator(v => !v)}
              onResetSelection={() => { setSelected(null); setPopupOpen(false); }}
            />
          )}

          {/* Chart preview · click any element to select it (radial-menu style).
              Backdrop layer + chart sit inside a glass frame; the backdrop
              becomes the SVG fill on export so the saved PNG matches. */}
          <div data-tour="canvas" style={{
            position: "relative",
            background: backdropCss(backdropMode === "dark" ? BACKDROPS_DARK[backdrop] : BACKDROPS_LIGHT[backdrop]),
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 16,
            padding: "22px 26px",
            marginBottom: 14,
            overflow: "auto",
            boxShadow: vignette
              ? "0 1px 0 rgba(255,255,255,0.06) inset, 0 32px 64px rgba(0,0,0,0.45), inset 0 0 80px rgba(0,0,0,0.40)"
              : "0 1px 0 rgba(255,255,255,0.06) inset, 0 32px 64px rgba(0,0,0,0.45)",
          }}>
            <svg
              key={type}
              ref={svgRef}
              viewBox={`0 0 ${W} ${H}`}
              style={{ width: "100%", height: "auto", display: "block", fontFamily: ft, touchAction: "none", cursor: placeMode?.kind === "callout" ? "crosshair" : "default", animation: "cm2ChartSwap 0.32s cubic-bezier(.2,.7,.2,1) both" }}
              onContextMenu={e => {
                // Right-click on canvas (not on a selectable element) — the
                // bar / point's own onContextMenu stops propagation, so this
                // only fires on chart background. Open the radial wheel for
                // canvas if nothing is selected, else keep current selection.
                if (e.target === e.currentTarget || (e.target as Element).tagName === "rect" && (e.target as Element).getAttribute("fill") === "transparent") {
                  e.preventDefault();
                  setSelected({ kind: "canvas" });
                  setWheelAnchor({ x: e.clientX, y: e.clientY, selected: { kind: "canvas" } });
                }
              }}
            >
              {/* Click-on-canvas (background) deselects · sits BEHIND chart */}
              <rect
                x="0" y="0" width={W} height={H} fill="transparent"
                onPointerDown={() => { if (selected) { setSelected(null); setPopupOpen(false); } }}
              />
              {renderChart()}
              {/* Free-form text callouts (ANNOTATE TEXT) — rendered after
                  the chart so they sit on top. */}
              {annotations.filter(a => a.kind === "callout").map(a => (
                <CalloutNode
                  key={a.id}
                  annot={a as Extract<Annotation, { kind: "callout" }>}
                  onMove={(x, y) => setAnnotations(annotations.map(b => b.id === a.id ? { ...(b as Extract<Annotation, { kind: "callout" }>), x, y } : b))}
                  onEdit={text => setAnnotations(annotations.map(b => b.id === a.id ? { ...(b as Extract<Annotation, { kind: "callout" }>), text } : b))}
                  onDelete={() => removeAnnotation(a.id)}
                />
              ))}
              {/* Placement overlay · catches the next click to drop a text */}
              {placeMode?.kind === "callout" && (
                <rect
                  x="0" y="0" width={W} height={H}
                  fill="transparent"
                  onPointerDown={e => {
                    const pt = pointerToSvg(e, e.currentTarget);
                    if (!pt) return;
                    const newAnnot: Annotation = { id: Math.random().toString(36).slice(2, 9), kind: "callout", x: Math.round(pt.x), y: Math.round(pt.y), text: "Note" };
                    setAnnotations([...annotations, newAnnot]);
                    setPlaceMode(null);
                  }}
                  style={{ cursor: "crosshair" }}
                />
              )}
              {/* Edit-lock overlay · catches every pointer interaction so the
                  user can't accidentally drag a bar while styling. */}
              {locked && (
                <rect
                  x="0" y="0" width={W} height={H}
                  fill="transparent"
                  onPointerDown={e => { e.stopPropagation(); e.preventDefault(); }}
                  onClick={e => { e.stopPropagation(); e.preventDefault(); }}
                  onDoubleClick={e => { e.stopPropagation(); e.preventDefault(); }}
                  onContextMenu={e => e.preventDefault()}
                  style={{ cursor: "not-allowed" }}
                />
              )}
            </svg>
          </div>

          {/* Editable data sheet · with Table 1 / Table 2 tab bar for FLOPs-style dual-table charts */}
          <div data-tour="datasheet">
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <span style={{ fontFamily: mn, fontSize: 10, color: C.amber, letterSpacing: 1.5, textTransform: "uppercase", fontWeight: 800 }}>Data sheet</span>
              <span style={{ fontFamily: mn, fontSize: 9, color: C.txm, letterSpacing: 0.6 }}>· edits sync to the chart in real time</span>
              <span style={{ flex: 1 }} />
              {/* Table tab bar */}
              <div style={{ display: "inline-flex", gap: 4, padding: 3, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 7 }}>
                <button
                  onClick={() => setActiveDataTab("primary")}
                  style={{ padding: "5px 11px", borderRadius: 5, background: activeDataTab === "primary" ? C.amber + "22" : "transparent", border: "none", color: activeDataTab === "primary" ? C.amber : C.txm, fontFamily: mn, fontSize: 10, fontWeight: 800, letterSpacing: 0.5, cursor: "pointer", textTransform: "uppercase" }}
                >Table 1</button>
                {secondarySheets[type] ? (
                  <span style={{ display: "inline-flex", alignItems: "center" }}>
                    <button
                      onClick={() => setActiveDataTab("secondary")}
                      style={{ padding: "5px 11px", borderRadius: 5, background: activeDataTab === "secondary" ? C.amber + "22" : "transparent", border: "none", color: activeDataTab === "secondary" ? C.amber : C.txm, fontFamily: mn, fontSize: 10, fontWeight: 800, letterSpacing: 0.5, cursor: "pointer", textTransform: "uppercase" }}
                    >Table 2</button>
                    <button
                      onClick={() => { setSecondarySheets(p => { const c = { ...p }; delete c[type]; return c; }); if (activeDataTab === "secondary") setActiveDataTab("primary"); }}
                      title="Remove Table 2"
                      style={{ padding: "5px 7px", borderRadius: 5, background: "transparent", border: "none", color: C.txm, cursor: "pointer", display: "inline-flex" }}
                    ><X size={11} /></button>
                  </span>
                ) : (
                  <button
                    onClick={() => {
                      const cur = sheets[type] || samplePerType(type);
                      const blank: DataSheet = { schema: cur.schema, rows: cur.rows.map(r => {
                        const out: Record<string, CellValue> = {};
                        for (const c of cur.schema) out[c.key] = c.type === "number" || c.type === "percent" ? 0 : (typeof r[c.key] === "string" ? r[c.key] : "");
                        return out;
                      }) };
                      setSecondarySheets(p => ({ ...p, [type]: blank }));
                      setActiveDataTab("secondary");
                    }}
                    title="Add a second table — useful for FLOPs comparison (raw + indexed)"
                    style={{ padding: "5px 9px", borderRadius: 5, background: "transparent", border: "none", color: C.txm, fontFamily: mn, fontSize: 12, fontWeight: 800, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 3 }}
                  ><Plus size={11} /> ADD TABLE 2</button>
                )}
              </div>
            </div>
            {activeDataTab === "primary" || !secondarySheets[type] ? (
              <DataSheetGrid
                sheet={rawSheet}
                onChange={setSheet}
                sliderMode={sliderMode}
                onToggleSliderMode={() => setSliderMode(v => !v)}
                selectedRowIdxs={selectedRowIdxs}
                onChangeSelectedRowIdxs={setSelectedRowIdxs}
                chartedRowsActive={chartedRowsActive}
                onToggleChartedRows={toggleChartedRows}
                onClearChartedRows={clearChartedRows}
              />
            ) : (
              <DataSheetGrid
                sheet={secondarySheets[type]!}
                onChange={s => setSecondarySheets(p => ({ ...p, [type]: s }))}
                sliderMode={sliderMode}
                onToggleSliderMode={() => setSliderMode(v => !v)}
              />
            )}
          </div>

          {/* Status bar — bottom of canvas area */}
          <div style={{ marginTop: 12 }}>
            <StatusBar chartType={type} sheet={sheet} numFmt={numFmt} themeName={THEMES[theme].name} advanced={advancedMode} />
          </div>
        </div>

        {advancedMode && rightPanelOpen && (
          <PropertiesPanel
            tab={rightTab}
            onChangeTab={setRightTab}
            theme={theme}
            onChangeTheme={setTheme}
            legendPos={legendPos}
            onChangeLegendPos={setLegendPos}
            showGridlines={showGridlines}
            onToggleGridlines={() => setShowGridlines(v => !v)}
            showBorders={showBorders}
            onToggleBorders={() => setShowBorders(v => !v)}
            logScale={logScale}
            onToggleLogScale={() => setLogScale(v => !v)}
            roundedCorners={roundedCorners}
            onToggleRoundedCorners={() => setRoundedCorners(v => !v)}
            showEndLabels={showEndLabels}
            onToggleEndLabels={() => setShowEndLabels(v => !v)}
            markerShape={markerShape}
            onChangeMarkerShape={setMarkerShape}
            annotations={annotations}
            onRemoveAnnotation={removeAnnotation}
            onClearAnnotations={clearAllAnnotations}
            pickMode={pickMode}
            placeMode={placeMode}
            onStartPick={kind => { setPlaceMode(null); setPickMode({ kind, bars: [] }); }}
            onCancelPick={() => setPickMode(null)}
            onAddRefLine={addReferenceLine}
            onTogglePlaceText={() => { setPickMode(null); setPlaceMode(placeMode?.kind === "callout" ? null : { kind: "callout" }); }}
            chartType={type}
            series={(() => {
              const palette = THEMES[theme].colors;
              const cols = sheet.schema.slice(1).filter(c => c.type === "number" || c.type === "percent");
              return cols.map((c, i) => ({ key: c.key, label: c.label, color: seriesColors[c.key] || palette[i % palette.length] }));
            })()}
            onSetSeriesColor={setSeriesColor}
            palette={THEMES[theme].colors}
            onOpenDesign={() => setDesignOpen(v => !v)}
            watermark={watermark}
            onChangeWatermark={setWatermark}
            onOpenExpanded={() => setExpandedMode(true)}
            barWidthPct={barWidthPct}
            onChangeBarWidthPct={setBarWidthPct}
            axis={axis}
            onChangeAxis={setAxis}
          />
        )}
      </div>

      {menu && <ChartContextMenu menu={menu} onClose={() => setMenu(null)} />}
      {wheelOpen && <ChartTypeWheel active={type} onSelect={setType} onClose={() => setWheelOpen(false)} />}
      {welcomeOpen && (
        <WelcomeScreen
          onClose={(dontShowAgain) => {
            if (dontShowAgain) {
              try { localStorage.setItem("cm2-welcome-seen-v1", "1"); } catch {}
            }
            setWelcomeOpen(false);
          }}
          onOpenWheel={() => { setWelcomeOpen(false); setWheelOpen(true); }}
          onOpenShortcuts={() => { setWelcomeOpen(false); setShortcutsOpen(true); }}
        />
      )}
      {tourOpen && <OnboardingTour onClose={() => setTourOpen(false)} />}
      {/* "Help" button bottom-right · re-open welcome screen anytime */}
      <Tooltip label="Open welcome screen" position="left">
        <button
          onClick={() => setWelcomeOpen(true)}
          title="Open welcome / tips & tricks"
          style={{
            position: "fixed", bottom: 24, right: 78, zIndex: 500,
            width: 42, height: 42, borderRadius: "50%",
            background: "rgba(13,13,18,0.85)",
            backdropFilter: "blur(14px) saturate(140%)",
            WebkitBackdropFilter: "blur(14px) saturate(140%)",
            border: "1px solid rgba(46,173,142,0.40)",
            color: "#2EAD8E",
            fontFamily: gf, fontSize: 18, fontWeight: 900,
            cursor: "pointer",
            boxShadow: "0 8px 24px rgba(0,0,0,0.40), 0 0 20px rgba(46,173,142,0.30), 0 1px 0 rgba(255,255,255,0.06) inset",
          }}
        >?!</button>
      </Tooltip>
      <Tooltip label="Take the interactive tour" position="left">
        <button
          onClick={() => setTourOpen(true)}
          title="Take the interactive tour"
          style={{
            position: "fixed", bottom: 24, right: 132, zIndex: 500,
            width: 42, height: 42, borderRadius: "50%",
            background: "rgba(13,13,18,0.85)",
            backdropFilter: "blur(14px) saturate(140%)",
            WebkitBackdropFilter: "blur(14px) saturate(140%)",
            border: "1px solid rgba(11,134,209,0.40)",
            color: "#0B86D1",
            cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 8px 24px rgba(0,0,0,0.40), 0 0 20px rgba(11,134,209,0.30), 0 1px 0 rgba(255,255,255,0.06) inset",
          }}
        ><HelpCircle size={18} strokeWidth={2.4} /></button>
      </Tooltip>
      {elementMenu && <ElementIconMenu state={elementMenu} onClose={() => setElementMenu(null)} palette={THEMES[theme].colors} />}
      {/* Legacy FloatingMiniToolbar disabled — TopMiniToolbar covers it. */}
      {/* Wave 11 · Radial context wheel — primary right-click target. */}
      {wheelAnchor && wheelAnchor.selected && (() => {
        const sel = wheelAnchor.selected;
        const close = () => setWheelAnchor(null);
        const palette = THEMES[theme].colors;
        let icons: WheelIcon[] = [];
        let label = "WHEEL";
        if (sel.kind === "segment") {
          label = "SEGMENT";
          icons = [
            { toolId: "fill", Icon: Palette, title: "Fill color", onClick: () => {
              // Cycle through the palette — first tap re-applies first palette color.
              const cur = sel.key;
              const idx = palette.indexOf(seriesColors[cur] || sel.color);
              const next = palette[(idx + 1) % palette.length];
              setSeriesColor(cur, next);
            }},
            { toolId: "totalLabels", Icon: Sigma, title: "Toggle total labels", onClick: () => setShowTotalLabels(v => !v), active: showTotalLabels },
            { toolId: "segmentLabels", Icon: Hash, title: "Toggle segment labels", onClick: () => setShowSegmentLabels(v => !v), active: showSegmentLabels },
            { toolId: "cagr", Icon: TrendingUp, title: "CAGR arrow (pick a 2nd bar)", onClick: () => setPickMode({ kind: "cagr", bars: [{ rowIdx: sel.rowIdx, key: sel.key }] }) },
            { toolId: "diff", Icon: ArrowLeftRight, title: "Diff arrow (pick a 2nd bar)", onClick: () => setPickMode({ kind: "diff", bars: [{ rowIdx: sel.rowIdx, key: sel.key }] }) },
            { toolId: "totalDiff", Icon: ArrowUpDown, title: "Total diff arrow (pick a 2nd column)", onClick: () => {
              // For now plant a totalDiff between this column and the next column.
              const nextRow = (sel.rowIdx + 1) % Math.max(1, sheet.rows.length);
              setAnnotations([...annotations, { id: Math.random().toString(36).slice(2, 9), kind: "totalDiff", rowFrom: sel.rowIdx, rowTo: nextRow }]);
            }},
            { toolId: "seriesCagr", Icon: Activity, title: "Series CAGR badge", onClick: () => setAnnotations([...annotations, { id: Math.random().toString(36).slice(2, 9), kind: "seriesCagr", seriesKey: sel.key }]) },
            { toolId: "refLine", Icon: Minus, title: "Reference line at this value", onClick: () => {
              const v = Number(sheet.rows[sel.rowIdx]?.[sel.key]) || 0;
              setAnnotations([...annotations, { id: Math.random().toString(36).slice(2, 9), kind: "refline", value: v, label: String(v) }]);
            }},
            { toolId: "callout", Icon: Type, title: "Drop a callout", onClick: () => setPlaceMode({ kind: "callout" }) },
            // Wave 13 · new tools
            { toolId: "roundedCorners", Icon: CornerUpLeft, title: "Rounded corners", active: roundedCorners, onClick: () => setRoundedCorners(v => !v) },
            { toolId: "endLabels", Icon: Hash, title: "End labels", active: showEndLabels, onClick: () => setShowEndLabels(v => !v) },
            { toolId: "swap", Icon: MoveHorizontal, title: "Swap series with adjacent", onClick: () => {
              // Swap this series with the next one in the schema (or previous if it's the last).
              setSheets(p => {
                const cur = p[type] || samplePerType(type);
                const numericKeys = cur.schema.filter(s => s.type === "number" || s.type === "percent").map(s => s.key);
                const idx = numericKeys.indexOf(sel.key);
                if (idx < 0) return p;
                const otherIdx = idx + 1 < numericKeys.length ? idx + 1 : idx - 1;
                if (otherIdx < 0) return p;
                const a = sel.key, b = numericKeys[otherIdx];
                const newSchema = cur.schema.map(s => s.key === a ? { ...s, key: b } : s.key === b ? { ...s, key: a } : s);
                const newRows = cur.rows.map(r => { const next = { ...r }; const av = next[a]; next[a] = next[b]; next[b] = av; return next; });
                return { ...p, [type]: { schema: newSchema, rows: newRows } };
              });
            }},
            { toolId: "delete", Icon: Trash2, title: "Set to 0", danger: true, onClick: () => onUpdateRow(sel.rowIdx, { [sel.key]: 0 }) },
          ];
        } else if (sel.kind === "point") {
          label = "POINT";
          icons = [
            { toolId: "fill", Icon: Palette, title: "Fill color", onClick: () => {
              const idx = palette.indexOf(seriesColors[sel.key] || sel.color);
              const next = palette[(idx + 1) % palette.length];
              setSeriesColor(sel.key, next);
            }},
            { toolId: "endLabels", Icon: Hash, title: "Toggle end labels", onClick: () => setShowEndLabels(v => !v), active: showEndLabels },
            { toolId: "cagr", Icon: TrendingUp, title: "CAGR arrow", onClick: () => setPickMode({ kind: "cagr", bars: [{ rowIdx: sel.rowIdx, key: sel.key }] }) },
            { toolId: "diff", Icon: ArrowLeftRight, title: "Diff arrow", onClick: () => setPickMode({ kind: "diff", bars: [{ rowIdx: sel.rowIdx, key: sel.key }] }) },
            { toolId: "seriesCagr", Icon: Activity, title: "Series CAGR badge", onClick: () => setAnnotations([...annotations, { id: Math.random().toString(36).slice(2, 9), kind: "seriesCagr", seriesKey: sel.key }]) },
            { toolId: "refLine", Icon: Minus, title: "Reference line", onClick: () => {
              const v = Number(sheet.rows[sel.rowIdx]?.[sel.key]) || 0;
              setAnnotations([...annotations, { id: Math.random().toString(36).slice(2, 9), kind: "refline", value: v, label: String(v) }]);
            }},
            { toolId: "marker", Icon: Circle, title: "Cycle marker shape", onClick: () => setMarkerShape(s => s === "circle" ? "square" : s === "square" ? "diamond" : s === "diamond" ? "none" : "circle") },
            { toolId: "callout", Icon: Type, title: "Callout", onClick: () => setPlaceMode({ kind: "callout" }) },
            // Wave 13 · new tools
            { toolId: "roundedCorners", Icon: CornerUpLeft, title: "Rounded corners (smooth fills)", active: roundedCorners, onClick: () => setRoundedCorners(v => !v) },
            { toolId: "delete", Icon: Trash2, title: "Set to 0", danger: true, onClick: () => onUpdateRow(sel.rowIdx, { [sel.key]: 0 }) },
          ];
        } else if (sel.kind === "axis") {
          label = "AXIS";
          icons = [
            { toolId: "logScale", Icon: Activity, title: "Toggle log scale", active: logScale, onClick: () => setLogScale(v => !v) },
            { toolId: "gridlines", Icon: Grid3x3, title: "Gridlines", active: showGridlines, onClick: () => setShowGridlines(v => !v) },
            { toolId: "ticks", Icon: MinusSquare, title: "Tick marks", active: showTickMarks, onClick: () => setShowTickMarks(v => !v) },
            { toolId: "axisBreak", Icon: Layers, title: "Axis break", active: axisBreak, onClick: () => setAxisBreak(v => !v) },
            { toolId: "numFmt", Icon: Hash, title: "Number format · cycle", onClick: () => {
              const order: NumberFormat[] = ["auto", "int", "dec1", "pct", "k", "m", "b"];
              const idx = order.indexOf(numFmt);
              setNumFmt(order[(idx + 1) % order.length]);
            }},
            // Wave 13 · new tools
            { toolId: "tickStep", Icon: MinusSquare, title: "Tick step (prompt — sets yMax to a multiple of step)", onClick: () => {
              const stepStr = typeof window !== "undefined" ? window.prompt("Tick step (numeric):", "10") : null;
              const step = Number(stepStr);
              if (Number.isFinite(step) && step > 0) {
                // Round current yMax up to nearest multiple of step
                const curMax = axis.yMax ?? 100;
                const newMax = Math.ceil(curMax / step) * step;
                setAxis({ ...axis, yMax: newMax });
              }
            }},
            { toolId: "direction", Icon: ArrowDownUp, title: "Cycle axis direction (asc / desc placeholder)", onClick: () => {
              // Cosmetic toggle · invert min/max swap when both are set.
              if (axis.yMin !== undefined && axis.yMax !== undefined) {
                setAxis({ ...axis, yMin: axis.yMax, yMax: axis.yMin });
              }
            }},
          ];
        } else if (sel.kind === "label") {
          label = "LABEL";
          icons = [
            { toolId: "numFmt", Icon: Hash, title: "Cycle number format", onClick: () => {
              const order: NumberFormat[] = ["auto", "int", "dec1", "pct", "k", "m", "b"];
              const idx = order.indexOf(numFmt);
              setNumFmt(order[(idx + 1) % order.length]);
            }},
            { toolId: "totalLabels", Icon: Sigma, title: "Toggle total labels", active: showTotalLabels, onClick: () => setShowTotalLabels(v => !v) },
            { toolId: "hideLabels", Icon: EyeOff, title: "Hide labels", onClick: () => setShowSegmentLabels(false) },
            // Wave 13 · new tools
            { toolId: "content", Icon: Type, title: "Cycle label content (value / percent / total)", onClick: () => {
              // Cycles three label shorthands by toggling related toggles.
              if (showSegmentLabels && !showTotalLabels) { setShowSegmentLabels(false); setShowTotalLabels(true); }
              else if (showTotalLabels && !showSegmentLabels) { setShowTotalLabels(true); setShowSegmentLabels(true); }
              else { setShowSegmentLabels(true); setShowTotalLabels(false); }
            }},
            { toolId: "position", Icon: AlignVerticalJustifyCenter, title: "Cycle label position (auto/inside/outside placeholder)", onClick: () => {
              // Position toggle is a placeholder — cycles markerShape as a stand-in indicator.
              setMarkerShape(s => s === "none" ? "circle" : s === "circle" ? "square" : s === "square" ? "diamond" : "none");
            }},
          ];
        } else if (sel.kind === "mekkoColumn") {
          label = "COLUMN";
          icons = [
            { toolId: "shiftLeft", Icon: ChevronLeft, title: "Shift left", onClick: () => {} },
            { toolId: "shiftRight", Icon: ChevronRight, title: "Shift right", onClick: () => {} },
            { toolId: "delete", Icon: Trash2, title: "Delete column", danger: true, onClick: () => onDeleteRow(sel.rowIdx) },
          ];
        } else {
          // canvas
          label = "CANVAS";
          icons = [
            { toolId: "addSeries", Icon: Plus, title: "Add series", onClick: () => {
              setSheets(p => {
                const cur = p[type] || samplePerType(type);
                const next = { ...cur };
                const newKey = "s" + (cur.schema.length + 1);
                next.schema = [...cur.schema, { key: newKey, label: "Series " + cur.schema.length, type: "number" }];
                next.rows = cur.rows.map(r => ({ ...r, [newKey]: 0 }));
                return { ...p, [type]: next };
              });
            }},
            { toolId: "typeWheel", Icon: Sparkles, title: "Type wheel", onClick: () => setWheelOpen(true) },
            { toolId: "gridlines", Icon: Grid3x3, title: "Gridlines", active: showGridlines, onClick: () => setShowGridlines(v => !v) },
            { toolId: "borders", Icon: Square, title: "Borders", active: showBorders, onClick: () => setShowBorders(v => !v) },
            { toolId: "totalLabels", Icon: Sigma, title: "Total labels", active: showTotalLabels, onClick: () => setShowTotalLabels(v => !v) },
            { toolId: "ticks", Icon: MinusSquare, title: "Tick marks", active: showTickMarks, onClick: () => setShowTickMarks(v => !v) },
            { toolId: "numFmt", Icon: Hash, title: "Cycle number format", onClick: () => {
              const order: NumberFormat[] = ["auto", "int", "dec1", "pct", "k", "m", "b"];
              const idx = order.indexOf(numFmt);
              setNumFmt(order[(idx + 1) % order.length]);
            }},
            { toolId: "theme", Icon: Palette, title: "Cycle theme", onClick: () => setTheme(t => t === "saCore" ? "saSpectrum" : t === "saSpectrum" ? "saBrand" : "saCore") },
            { toolId: "reset", Icon: Undo2, title: "Reset chart (clear annotations)", onClick: () => setAnnotByType(p => ({ ...p, [type]: [] })) },
            // Wave 13 · canvas-level new tools
            { toolId: "watermark", Icon: ImageIcon, title: "Cycle watermark (off / centered / random)", active: watermark !== "off", onClick: () => setWatermark(w => w === "off" ? "centered" : w === "centered" ? "random" : "off") },
            { toolId: "logScale", Icon: Activity, title: "Toggle log scale", active: logScale, onClick: () => setLogScale(v => !v) },
            { toolId: "axisBreak", Icon: Layers, title: "Axis break", active: axisBreak, onClick: () => setAxisBreak(v => !v) },
            { toolId: "markerShape", Icon: Circle, title: "Cycle marker shape", onClick: () => setMarkerShape(s => s === "circle" ? "square" : s === "square" ? "diamond" : s === "diamond" ? "none" : "circle") },
            { toolId: "roundedCorners", Icon: CornerUpLeft, title: "Toggle rounded bar corners", active: roundedCorners, onClick: () => setRoundedCorners(v => !v) },
            { toolId: "endLabels", Icon: Hash, title: "Toggle end labels", active: showEndLabels, onClick: () => setShowEndLabels(v => !v) },
            { toolId: "barWidth", Icon: MoveHorizontal, title: "Cycle bar width (thin / med / thick)", onClick: () => setBarWidthPct(p => p < 40 ? 65 : p < 75 ? 90 : 30) },
            { toolId: "backdropMode", Icon: Eye, title: "Toggle backdrop dark / light", onClick: () => setBackdropMode(m => m === "dark" ? "light" : "dark") },
          ];
        }
        // Wave 12 · filter against the user's wheelConfig (per-kind allowlist)
        const cfgForKind = wheelConfig[sel.kind];
        if (cfgForKind && cfgForKind !== "all" && Array.isArray(cfgForKind)) {
          const allow = new Set(cfgForKind);
          icons = icons.filter(i => !i.toolId || allow.has(i.toolId));
        }
        return <RadialContextWheel x={wheelAnchor.x} y={wheelAnchor.y} icons={icons} label={label} onClose={close} />;
      })()}
      {shortcutsOpen && <ShortcutsOverlay onClose={() => setShortcutsOpen(false)} />}
      {designOpen && (
        <DesignDrawer
          onClose={() => setDesignOpen(false)}
          theme={theme} onChangeTheme={setTheme}
          backdrop={backdrop} backdropMode={backdropMode}
          onChangeBackdrop={setBackdrop} onChangeMode={setBackdropMode}
          legendPos={legendPos} onChangeLegendPos={setLegendPos}
          showBorders={showBorders} onToggleBorders={() => setShowBorders(v => !v)}
          showGridlines={showGridlines} onToggleGridlines={() => setShowGridlines(v => !v)}
          showSegmentLabels={showSegmentLabels} onToggleSegmentLabels={() => setShowSegmentLabels(v => !v)}
          axis={axis} onChangeAxis={setAxis} chartType={type}
          yLabel={yLabel} onChangeYLabel={setYLabel}
          xLabel={xLabel} onChangeXLabel={setXLabel}
          logScale={logScale} onToggleLogScale={() => setLogScale(v => !v)}
          roundedCorners={roundedCorners} onToggleRoundedCorners={() => setRoundedCorners(v => !v)}
          showEndLabels={showEndLabels} onToggleEndLabels={() => setShowEndLabels(v => !v)}
          markerShape={markerShape} onChangeMarkerShape={setMarkerShape}
          watermark={watermark} onChangeWatermark={setWatermark}
          barWidthPct={barWidthPct} onChangeBarWidthPct={setBarWidthPct}
          vignette={vignette} onToggleVignette={() => setVignette(v => !v)}
          exportBranding={exportBranding} onToggleExportBranding={() => setExportBranding(v => !v)}
        />
      )}
      {/* Floating help button · always-on glass pill, opens shortcuts overlay */}
      <Tooltip label="Keyboard shortcuts" shortcut="?" position="left">
      <button
        onClick={() => setShortcutsOpen(true)}
        title="Keyboard shortcuts · press ?"
        style={{
          position: "fixed", bottom: 24, right: 24, zIndex: 500,
          width: 42, height: 42, borderRadius: "50%",
          background: "rgba(13,13,18,0.85)",
          backdropFilter: "blur(14px) saturate(140%)",
          WebkitBackdropFilter: "blur(14px) saturate(140%)",
          border: "1px solid rgba(247,176,65,0.40)",
          color: C.amber,
          fontFamily: gf, fontSize: 18, fontWeight: 900,
          cursor: "pointer",
          boxShadow: "0 8px 24px rgba(0,0,0,0.40), 0 0 20px " + C.amber + "30, 0 1px 0 rgba(255,255,255,0.06) inset",
          display: "flex", alignItems: "center", justifyContent: "center",
          transition: "transform 0.18s cubic-bezier(.2,.7,.2,1), box-shadow 0.18s",
        }}
        onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 12px 32px rgba(0,0,0,0.50), 0 0 32px " + C.amber + "55, 0 1px 0 rgba(255,255,255,0.10) inset"; }}
        onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "0 8px 24px rgba(0,0,0,0.40), 0 0 20px " + C.amber + "30, 0 1px 0 rgba(255,255,255,0.06) inset"; }}
      >
        ?
      </button>
      </Tooltip>

      {/* Wave 12 · Selection popup floats above the clicked element with
          inline color row, value input, and label toggles. Coexists with
          TopMiniToolbar (which sits at the top of the canvas card). */}
      {/* SelectionPopup removed in Wave 14.1 — TopMiniToolbar at the top of the
          chart card now owns all selection-driven format controls. */}

      {/* Wave 12 · radial-wheel customizer modal */}
      {wheelSettingsOpen && (
        <WheelSettingsModal
          config={wheelConfig}
          onChange={setWheelConfig}
          onClose={() => setWheelSettingsOpen(false)}
        />
      )}

      {/* Wave 15.1 · float-toolbar editor — pick + reorder which tools appear */}
      {floatToolbarEditorOpen && (
        <FloatToolbarEditor
          tools={floatToolbarTools}
          onChange={setFloatToolbarTools}
          onClose={() => setFloatToolbarEditorOpen(false)}
        />
      )}

      {/* Wave 12 · Expanded webapp mode — full-viewport overlay with
          chart / table / split panes and animated glow background.
          Rendered to a portal at document.body so no parent scroll/transform
          can break the position:fixed layout. */}
      {expandedMode && typeof document !== "undefined" && createPortal(
        <ExpandedShell
          transitionFrom={expandTransitionFrom}
          onClose={() => setExpandedMode(false)}
          paneMode={paneMode}
          onChangePaneMode={setPaneMode}
          splitOrientation={splitOrientation}
          onChangeSplitOrientation={setSplitOrientation}
          splitterPos={splitterPos}
          onChangeSplitterPos={setSplitterPos}
          chartType={type}
          onChangeChartType={setType}
          themeName={THEMES[theme].name}
          paletteColors={THEMES[theme].colors}
          chartZoom={chartZoom}
          onChangeChartZoom={setChartZoom}
          tableMode={tableWindowMode}
          onChangeTableMode={setTableWindowMode}
          floatingTablePos={floatingTablePos}
          onChangeFloatingTablePos={setFloatingTablePos}
          topBarExtras={(
            // Wave 15 · Full toolbar inside Launch top bar — same FILE/EDIT/
            // INSERT/FORMAT controls the compact mode has, so Launch genuinely
            // is the "ultimate tool". The pane mode tabs and zoom widget live
            // in ExpandedShell itself (they're shell-specific).
            <>
              <ToolGroup label="File">
                <TemplatesButton
                  onPick={applyTemplate}
                  openExternal={floatToolbarTemplatesOpen}
                  onCloseExternal={() => setFloatToolbarTemplatesOpen(false)}
                />
                <PasteDataButton onPaste={raw => { const ds = parsePasteForCategorical(raw); if (ds) setSheets(p => ({ ...p, [type]: ds })); else showToast("Couldn't parse the paste — expected TSV or CSV with headers"); }} />
                <ImportExcelButton onImport={ds => setSheets(p => ({ ...p, [type]: ds }))} />
              </ToolGroup>
              <Sep />
              <ToolGroup label="Edit">
                <UndoRedoButtons onUndo={undo} onRedo={redo} canUndo={past.current.length > 0} canRedo={future.current.length > 0} />
                <Tooltip label={locked ? "Unlock editing" : "Lock chart"} shortcut="⌘L" position="bottom">
                  <span style={{ display: "inline-flex" }}><LockToggle locked={locked} onChange={setLocked} /></span>
                </Tooltip>
              </ToolGroup>
              <Sep />
              <ToolGroup label="Insert">
                <Tooltip label="Open chart-type wheel · radial picker" shortcut="W" position="bottom">
                  <GlassButton onClick={() => setWheelOpen(true)} title="Open chart-type wheel · radial picker (W)" Icon={Sparkles} primary>TYPE WHEEL</GlassButton>
                </Tooltip>
                <NumberFormatPicker fmt={numFmt} onChange={setNumFmt} />
              </ToolGroup>
              <Sep />
              <ToolGroup label="Format">
                <Tooltip label="Design panel · palette, backdrops, gridlines" shortcut="⌘D" position="bottom">
                  <GlassButton onClick={() => setDesignOpen(v => !v)} title="Design panel · click to toggle (⌘D)" Icon={Palette} primary={designOpen}>DESIGN</GlassButton>
                </Tooltip>
                <Tooltip label="Customize the radial context wheel" position="bottom">
                  <GlassButton
                    onClick={() => setWheelSettingsOpen(true)}
                    title="Customize the radial context wheel · pick which tools appear per element"
                    Icon={Settings}
                  >WHEEL</GlassButton>
                </Tooltip>
              </ToolGroup>
            </>
          )}
          floatToolbar={floatToolbarVisible ? (
            <FloatingLaunchToolbar
              tools={floatToolbarTools}
              pos={floatToolbarPos}
              pinned={floatToolbarPinned}
              onMove={setFloatToolbarPos}
              onTogglePin={() => setFloatToolbarPinned(p => !p)}
              onClose={() => setFloatToolbarVisible(false)}
              onEditTools={() => setFloatToolbarEditorOpen(true)}
              flags={{
                designOpen,
                locked,
                popOutActive: tableWindowMode === "floating",
                canUndo: past.current.length > 0,
                canRedo: future.current.length > 0,
              }}
              actions={{
                templates: () => setFloatToolbarTemplatesOpen(true),
                paste: () => {
                  // Try to read clipboard text; if granted, parse it the same
                  // way the FILE-group Paste button does. Falls back to a
                  // toast guiding the user to the toolbar button.
                  try {
                    if (typeof navigator !== "undefined" && navigator.clipboard?.readText) {
                      navigator.clipboard.readText().then(raw => {
                        const ds = parsePasteForCategorical(raw);
                        if (ds) setSheets(p => ({ ...p, [type]: ds }));
                        else showToast("Clipboard didn't look like TSV/CSV — use the FILE · Paste button");
                      }).catch(() => showToast("Clipboard read denied — use the FILE · Paste button"));
                    } else {
                      showToast("Clipboard API unavailable — use the FILE · Paste button");
                    }
                  } catch { showToast("Use the FILE · Paste button to paste TSV/CSV"); }
                },
                importExcel: () => { showToast("Click the FILE · IMPORT button — file pickers can't be triggered without a direct user click"); },
                typeWheel: () => setWheelOpen(true),
                numFmt: () => {
                  const order: NumberFormat[] = ["auto", "int", "dec1", "pct", "k", "m", "b"];
                  const idx = order.indexOf(numFmt);
                  setNumFmt(order[(idx + 1) % order.length]);
                  showToast("Number format · " + order[(idx + 1) % order.length]);
                },
                design: () => setDesignOpen(v => !v),
                wheelSettings: () => setWheelSettingsOpen(true),
                undo: () => undo(),
                redo: () => redo(),
                lock: () => setLocked(v => !v),
                exportPNG: () => { exportPNG(); playExportChime(); },
                exportSVG: () => { exportSVG(); playExportChime(); },
                exportPPTX: () => { exportPPTX(); playExportChime(); },
                copyPNG: () => { copyPNG(); playExportChime(); },
                popOutTable: () => setTableWindowMode(tableWindowMode === "floating" ? "docked" : "floating"),
                fitChart: () => setChartZoom("fit"),
                zoomIn: () => floatZoomBy(25),
                zoomOut: () => floatZoomBy(-25),
                fullScreen: floatFullScreen,
                tour: () => setTourOpen(true),
                soundToggle: floatToggleSound,
                themeToggle: () => setAppTheme(appTheme === "dark" ? "light" : "dark"),
                addRow: floatAddRow,
                addCol: floatAddCol,
                deleteSel: floatDeleteSel,
                wheelOpen: () => setWheelOpen(true),
              }}
            />
          ) : null}
          showToolbarBtn={!floatToolbarVisible ? (
            <button
              onClick={() => setFloatToolbarVisible(true)}
              title="Show the floating launch toolbar"
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "7px 12px", borderRadius: 8,
                background: C.amber + "1A",
                border: "1px solid " + C.amber + "55",
                color: C.amber,
                fontFamily: mn, fontSize: 10, fontWeight: 800, letterSpacing: 0.6,
                cursor: "pointer", transition: "all 0.16s",
                textTransform: "uppercase",
              }}
              onMouseEnter={e => { e.currentTarget.style.background = C.amber + "26"; }}
              onMouseLeave={e => { e.currentTarget.style.background = C.amber + "1A"; }}
            >
              <Wrench size={12} strokeWidth={2.4} />
              Show Toolbar
            </button>
          ) : null}
          topBarRightExtras={(
            <>
              <SoundToggle />
              <AppThemeToggle theme={appTheme} onChange={setAppTheme} />
              <ExportDropdownIcon
                onPNG={() => { exportPNG(); playExportChime(); }}
                onJPG={() => { exportJPG(); playExportChime(); }}
                onSVG={() => { exportSVG(); playExportChime(); }}
                onPPTX={() => { exportPPTX(); playExportChime(); }}
                onCopyPNG={() => { copyPNG(); playExportChime(); }}
              />
            </>
          )}
          chartCard={(
            // Wave 15 · ResizeObserver-driven chart sizing happens inside
            // ExpandedShell (it owns the pane DOM). We just hand it a render
            // function so the chart's W/H can adapt to the live pane size.
            <ChartPaneInner
              backdrop={backdrop}
              backdropMode={backdropMode}
              renderChart={renderChart}
              setSelected={setSelected}
              selected={selected}
              chartZoom={chartZoom}
              defaultW={W}
              defaultH={H}
            />
          )}
          dataSheet={(
            <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
              <div style={{
                padding: "10px 14px",
                borderBottom: "1px solid rgba(255,255,255,0.06)",
                display: "flex", alignItems: "center", gap: 10,
                background: "rgba(13,13,18,0.72)",
                backdropFilter: "blur(14px) saturate(140%)",
                WebkitBackdropFilter: "blur(14px) saturate(140%)",
              }}>
                <Table size={13} strokeWidth={2.4} color={C.amber} />
                <span style={{ fontFamily: mn, fontSize: 10, color: C.amber, letterSpacing: 1.5, textTransform: "uppercase", fontWeight: 800 }}>Data sheet</span>
                <span style={{ fontFamily: mn, fontSize: 9, color: C.txm, letterSpacing: 0.6 }}>· edits sync to the chart in real time</span>
                <span style={{ flex: 1 }} />
                {/* Wave 14.2 · Table engine toggle. EXCEL SUITE swaps in Univer
                    (full Excel-grade spreadsheet) for power features. */}
                <div style={{
                  display: "inline-flex",
                  border: "1px solid rgba(255,255,255,0.12)",
                  borderRadius: 8,
                  overflow: "hidden",
                  background: "rgba(255,255,255,0.03)",
                }}>
                  {(["standard", "univer"] as const).map(eng => {
                    const active = tableEngine === eng;
                    const label = eng === "standard" ? "Standard" : "Excel Suite";
                    return (
                      <button
                        key={eng}
                        onClick={() => setTableEngine(eng)}
                        title={eng === "standard" ? "Lean in-house data grid" : "Full Excel-grade spreadsheet (Univer · formulas, freeze panes, multi-sheet, conditional formatting)"}
                        style={{
                          padding: "5px 10px",
                          background: active ? C.amber + "26" : "transparent",
                          border: "none",
                          borderRight: eng === "standard" ? "1px solid rgba(255,255,255,0.10)" : "none",
                          color: active ? C.amber : C.txm,
                          fontFamily: mn, fontSize: 9, fontWeight: 800, letterSpacing: 1.2,
                          textTransform: "uppercase", cursor: "pointer",
                          transition: "all 0.16s cubic-bezier(.2,.7,.2,1)",
                        }}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
                {/* Wave 15 · pop-out controls — let the user detach the table
                    into a draggable in-app floating window. */}
                <button
                  onClick={() => setTableWindowMode(tableWindowMode === "floating" ? "docked" : "floating")}
                  title={tableWindowMode === "floating" ? "Dock the table back into the layout" : "Pop the table out into a draggable floating window"}
                  style={{
                    padding: "5px 10px",
                    border: "1px solid " + (tableWindowMode === "floating" ? C.amber + "70" : "rgba(255,255,255,0.12)"),
                    borderRadius: 8,
                    background: tableWindowMode === "floating" ? C.amber + "22" : "rgba(255,255,255,0.03)",
                    color: tableWindowMode === "floating" ? C.amber : C.txm,
                    fontFamily: mn, fontSize: 9, fontWeight: 800, letterSpacing: 1.2,
                    textTransform: "uppercase", cursor: "pointer",
                    display: "inline-flex", alignItems: "center", gap: 5,
                    transition: "all 0.16s cubic-bezier(.2,.7,.2,1)",
                  }}
                >
                  <Maximize2 size={11} strokeWidth={2.4} />
                  {tableWindowMode === "floating" ? "Dock" : "Pop Out"}
                </button>
              </div>
              {tableEngine === "univer" ? (
                // Univer takes the entire pane — it ships its own toolbar,
                // formula bar, sheet tabs, and scrollbars, so we drop the
                // outer padding/scroll wrapper used by the Standard grid.
                <div style={{ flex: 1, minHeight: 0, padding: 8 }}>
                  <UniverSheetPane initialSheet={rawSheet} onChange={setSheet} />
                </div>
              ) : (
                <div style={{ flex: 1, minHeight: 0, overflow: "auto", padding: 14 }}>
                  <DataSheetGrid
                    sheet={rawSheet}
                    onChange={setSheet}
                    sliderMode={sliderMode}
                    onToggleSliderMode={() => setSliderMode(v => !v)}
                    selectedRowIdxs={selectedRowIdxs}
                    onChangeSelectedRowIdxs={setSelectedRowIdxs}
                    chartedRowsActive={chartedRowsActive}
                    onToggleChartedRows={toggleChartedRows}
                    onClearChartedRows={clearChartedRows}
                  />
                </div>
              )}
            </div>
          )}
          propsPanel={(
            <PropertiesPanel
              tab={rightTab}
              onChangeTab={setRightTab}
              theme={theme}
              onChangeTheme={setTheme}
              legendPos={legendPos}
              onChangeLegendPos={setLegendPos}
              showGridlines={showGridlines}
              onToggleGridlines={() => setShowGridlines(v => !v)}
              showBorders={showBorders}
              onToggleBorders={() => setShowBorders(v => !v)}
              logScale={logScale}
              onToggleLogScale={() => setLogScale(v => !v)}
              roundedCorners={roundedCorners}
              onToggleRoundedCorners={() => setRoundedCorners(v => !v)}
              showEndLabels={showEndLabels}
              onToggleEndLabels={() => setShowEndLabels(v => !v)}
              markerShape={markerShape}
              onChangeMarkerShape={setMarkerShape}
              annotations={annotations}
              onRemoveAnnotation={removeAnnotation}
              onClearAnnotations={clearAllAnnotations}
              pickMode={pickMode}
              placeMode={placeMode}
              onStartPick={kind => { setPlaceMode(null); setPickMode({ kind, bars: [] }); }}
              onCancelPick={() => setPickMode(null)}
              onAddRefLine={addReferenceLine}
              onTogglePlaceText={() => { setPickMode(null); setPlaceMode(placeMode?.kind === "callout" ? null : { kind: "callout" }); }}
              chartType={type}
              series={(() => {
                const palette = THEMES[theme].colors;
                const cols = sheet.schema.slice(1).filter(c => c.type === "number" || c.type === "percent");
                return cols.map((c, i) => ({ key: c.key, label: c.label, color: seriesColors[c.key] || palette[i % palette.length] }));
              })()}
              onSetSeriesColor={setSeriesColor}
              palette={THEMES[theme].colors}
              onOpenDesign={() => setDesignOpen(v => !v)}
              watermark={watermark}
              onChangeWatermark={setWatermark}
              onOpenExpanded={() => setExpandedMode(true)}
              barWidthPct={barWidthPct}
              onChangeBarWidthPct={setBarWidthPct}
              axis={axis}
              onChangeAxis={setAxis}
            />
          )}
        />,
        document.body
      )}
      </div>
    </div>
  );
}

// ─── Keyboard shortcuts overlay · ? key ───────────────────────────────────
function ShortcutsOverlay({ onClose }: { onClose: () => void }) {
  const groups: Array<{ title: string; rows: Array<[string, string]> }> = [
    {
      title: "Editing",
      rows: [
        ["Drag a bar / point", "Set its value (column charts) · move task (Gantt)"],
        ["Drag bar edge", "Resize start / end (Gantt only)"],
        ["Double-click a label", "Edit task name / category / owner inline"],
        ["Click cell in data sheet", "Edit · Enter to commit, Esc to cancel"],
        ["Alt + drag number cell", "Scrub the value"],
      ],
    },
    {
      title: "Annotations",
      rows: [
        ["CAGR", "Click two bars/points to draw a CAGR arrow"],
        ["Δ DIFF", "Click two bars/points to show absolute Δ"],
        ["REF LINE", "Inline value + label form, drops a horizontal line"],
        ["TEXT", "Then click chart to drop a draggable text callout"],
        ["Right-click annotation", "Delete it"],
      ],
    },
    {
      title: "App",
      rows: [
        ["⌘Z / Ctrl+Z", "Undo"],
        ["⌘⇧Z / Ctrl+Y", "Redo"],
        ["?  /  Shift+/", "Open / close this overlay"],
        ["Esc", "Cancel pick mode · close overlay · cancel inline edit"],
        ["Right-click a bar", "Shape, color, shift, delete (Gantt also: ↔ resize)"],
      ],
    },
  ];
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(6,6,12,0.74)", backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", zIndex: 12500, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div onClick={e => e.stopPropagation()} style={{ width: "min(720px, 96vw)", maxHeight: "86vh", overflow: "auto", background: "#0D0D14", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 16, padding: "26px 28px", boxShadow: "0 32px 80px rgba(0,0,0,0.60), 0 0 0 1px rgba(247,176,65,0.06)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
          <Keyboard size={18} strokeWidth={2.2} color={C.amber} />
          <span style={{ fontFamily: gf, fontSize: 20, fontWeight: 900, color: "#E8E4DD", letterSpacing: -0.3 }}>Keyboard & gestures</span>
          <span style={{ marginLeft: "auto", cursor: "pointer", color: C.txm, padding: 4, display: "inline-flex" }} onClick={onClose}><XIcon size={18} /></span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 18 }}>
          {groups.map((g, i) => (
            <div key={i}>
              <div style={{ fontFamily: mn, fontSize: 9, color: C.amber, letterSpacing: 1.4, textTransform: "uppercase", marginBottom: 10 }}>{g.title}</div>
              {g.rows.map((r, j) => (
                <div key={j} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "6px 0", borderBottom: j < g.rows.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none" }}>
                  <span style={{ fontFamily: mn, fontSize: 10, fontWeight: 800, color: "#E8E4DD", letterSpacing: 0.4, padding: "3px 7px", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 4, background: "rgba(255,255,255,0.03)", whiteSpace: "nowrap" }}>{r[0]}</span>
                  <span style={{ fontFamily: ft, fontSize: 12, color: C.txm, lineHeight: 1.4, flex: 1 }}>{r[1]}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
        <div style={{ marginTop: 22, padding: "14px 16px", background: "rgba(247,176,65,0.06)", border: "1px solid rgba(247,176,65,0.20)", borderRadius: 10 }}>
          <div style={{ fontFamily: mn, fontSize: 10, color: C.amber, letterSpacing: 1, marginBottom: 4, textTransform: "uppercase", fontWeight: 800 }}>Tip</div>
          <div style={{ fontFamily: ft, fontSize: 13, color: "#E8E4DD", lineHeight: 1.5 }}>
            The chart and the data sheet stay in sync. Drag a bar to set a value <em>or</em> type in the cell — both update both surfaces. Switching chart type doesn't lose your data; each type keeps its own sheet.
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Export split button · primary action = PNG, dropdown for SVG, plus COPY ──
function ExportSplitButton({ onPNG, onSVG, onCopy }: { onPNG: () => void; onSVG: () => void; onCopy?: () => void }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    setTimeout(() => document.addEventListener("click", close), 0);
    return () => document.removeEventListener("click", close);
  }, [open]);
  const [hov, setHov] = useState(false);
  return (
    <div
      style={{ position: "relative", display: "inline-flex", borderRadius: 9, transform: hov ? "translateY(-1px)" : "translateY(0)", transition: "transform 0.18s cubic-bezier(.2,.7,.2,1)", boxShadow: hov ? "0 12px 28px " + C.amber + "55, 0 1px 0 rgba(255,255,255,0.20) inset" : "0 4px 14px " + C.amber + "30, 0 1px 0 rgba(255,255,255,0.18) inset" }}
      onClick={e => e.stopPropagation()}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
    >
      <button
        onClick={onPNG}
        title="Export raster PNG · 2× retina"
        style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 18px", borderRadius: "9px 0 0 9px", border: "1px solid " + C.amber + "60", borderRight: "none", background: "linear-gradient(135deg," + C.amber + ",#E8A020)", color: "#060608", fontFamily: ft, fontSize: 13, fontWeight: 800, cursor: "pointer", letterSpacing: 0.3, filter: hov ? "brightness(1.06)" : "brightness(1)", transition: "filter 0.18s" }}
      >
        <Download size={14} strokeWidth={2.2} />
        Export PNG
      </button>
      <button
        onClick={() => setOpen(v => !v)}
        title="More export options · SVG, etc."
        style={{ padding: "10px 11px", borderRadius: "0 9px 9px 0", border: "1px solid " + C.amber + "60", borderLeft: "1px solid rgba(0,0,0,0.18)", background: "linear-gradient(135deg," + C.amber + ",#E8A020)", color: "#060608", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", filter: hov ? "brightness(1.06)" : "brightness(1)", transition: "filter 0.18s" }}
      >
        <ChevronDown size={14} strokeWidth={2.4} style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }} />
      </button>
      {open && (
        <div style={{ position: "absolute", right: 0, top: "calc(100% + 4px)", background: "#0D0D14", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 9, padding: 4, minWidth: 200, zIndex: 1100, boxShadow: "0 18px 40px rgba(0,0,0,0.55)" }}>
          <div onClick={() => { onPNG(); setOpen(false); }} style={dropItem()}>
            <Download size={12} strokeWidth={2.2} />
            <span>PNG · raster, 2× crisp</span>
          </div>
          <div onClick={() => { onSVG(); setOpen(false); }} style={dropItem()}>
            <FileCode2 size={12} strokeWidth={2.2} />
            <span>SVG · vector, infinite zoom</span>
          </div>
          {onCopy && (
            <div onClick={() => { onCopy(); setOpen(false); }} style={dropItem()}>
              <ClipboardPaste size={12} strokeWidth={2.2} />
              <span>COPY · PNG to clipboard</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
function dropItem(): React.CSSProperties {
  return { padding: "9px 12px", borderRadius: 6, cursor: "pointer", display: "flex", alignItems: "center", gap: 10, color: "#E8E4DD", fontFamily: ft, fontSize: 12, fontWeight: 600, transition: "background 0.12s" };
}

// ─── Wave 15 · Toolbar grouping primitives ───────────────────────────────
// ToolGroup: visual cluster of related buttons + a tiny uppercase label
// underneath ("FILE", "EDIT", etc.). Sep renders a hairline between groups.
// Goal: compact toolbar that reads like Excel/Figma — every control
// instantly findable, no vertical bloat.
function ToolGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
      <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>{children}</div>
      <span style={{ fontFamily: mn, fontSize: 7.5, color: C.txd, letterSpacing: 1.4, fontWeight: 800, opacity: 0.6, textTransform: "uppercase" }}>{label}</span>
    </div>
  );
}

// ─── Wave 15 · LAUNCH button · reusable colorful CTA ────────────────────
// Animated gradient pill that opens the full expanded webapp suite.
// Pulled out of inline JSX so it can also live inside the Launch top bar
// (as a "you are here" badge — visible state, but disabled).
function LaunchButton({ onClick, badge = false }: { onClick?: () => void; badge?: boolean }) {
  return (
    <Tooltip label={badge ? "You're in Launch mode" : "Launch the full chart-building suite"} shortcut={badge ? undefined : "⌘⇧E"} position="bottom">
      <button
        onClick={onClick}
        title={badge ? "Currently in Launch mode" : "Launch the full chart-building suite (⌘⇧E · Esc to exit)"}
        disabled={badge}
        style={{
          position: "relative",
          display: "inline-flex", alignItems: "center", gap: 9,
          padding: badge ? "8px 14px" : "10px 18px", borderRadius: 11,
          background: "linear-gradient(135deg, #F7B041 0%, #E06347 38%, #905CCB 72%, #0B86D1 100%)",
          backgroundSize: "200% 200%",
          border: "1px solid rgba(255,255,255,0.32)",
          color: "#0A0A0E",
          fontFamily: gf, fontSize: badge ? 11 : 12, fontWeight: 900, letterSpacing: 0.4,
          cursor: badge ? "default" : "pointer",
          transition: "all 0.22s cubic-bezier(.2,.7,.2,1)",
          boxShadow:
            "0 10px 28px rgba(247,176,65,0.45)" +
            ", 0 6px 18px rgba(224,99,71,0.32)" +
            ", 0 4px 14px rgba(144,92,203,0.28)" +
            ", 0 1px 0 rgba(255,255,255,0.42) inset" +
            ", 0 0 0 1px rgba(255,255,255,0.10)",
          animation: "cm2LaunchPulse 4.2s ease-in-out infinite, cm2LaunchShimmer 7s ease-in-out infinite",
          textTransform: "uppercase",
          opacity: badge ? 0.95 : 1,
        }}
        onMouseEnter={badge ? undefined : (e => {
          e.currentTarget.style.transform = "translateY(-2px) scale(1.03)";
          e.currentTarget.style.boxShadow =
            "0 16px 40px rgba(247,176,65,0.60)" +
            ", 0 10px 26px rgba(224,99,71,0.45)" +
            ", 0 6px 18px rgba(144,92,203,0.40)" +
            ", 0 0 32px rgba(247,176,65,0.30)" +
            ", 0 1px 0 rgba(255,255,255,0.50) inset";
        })}
        onMouseLeave={badge ? undefined : (e => {
          e.currentTarget.style.transform = "translateY(0) scale(1)";
          e.currentTarget.style.boxShadow =
            "0 10px 28px rgba(247,176,65,0.45)" +
            ", 0 6px 18px rgba(224,99,71,0.32)" +
            ", 0 4px 14px rgba(144,92,203,0.28)" +
            ", 0 1px 0 rgba(255,255,255,0.42) inset" +
            ", 0 0 0 1px rgba(255,255,255,0.10)";
        })}
      >
        <style>{`
          @keyframes cm2LaunchPulse {
            0%,100% { filter: brightness(1) saturate(1.05); }
            50%     { filter: brightness(1.10) saturate(1.20); }
          }
          @keyframes cm2LaunchShimmer {
            0%,100% { background-position: 0% 50%; }
            50%     { background-position: 100% 50%; }
          }
          @keyframes cm2LaunchRocket {
            0%,100% { transform: translateY(0) rotate(-8deg); }
            50%     { transform: translateY(-2px) rotate(8deg); }
          }
        `}</style>
        <Rocket size={badge ? 13 : 14} strokeWidth={2.6} style={{ animation: "cm2LaunchRocket 2.4s ease-in-out infinite", transformOrigin: "center" }} />
        LAUNCH
        <span style={{
          width: 5, height: 5, borderRadius: "50%",
          background: "#FFFFFF",
          boxShadow: "0 0 8px #FFFFFF, 0 0 14px #F7B041",
          animation: "cm2LaunchPulse 1.6s ease-in-out infinite",
        }} />
      </button>
    </Tooltip>
  );
}

// ─── Wave 15 · Export dropdown icon · replaces verbose ExportSplitButton ──
// Single small icon button. Click → 5-row dropdown:
//   PNG · JPG · SVG · PowerPoint (.pptx) · Copy PNG
// Position absolute right of the toolbar so the menu opens flush to the
// right edge.
function ExportDropdownIcon({ onPNG, onJPG, onSVG, onPPTX, onCopyPNG }: {
  onPNG: () => void;
  onJPG: () => void;
  onSVG: () => void;
  onPPTX: () => void;
  onCopyPNG: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [hov, setHov] = useState(false);
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    setTimeout(() => document.addEventListener("click", close), 0);
    return () => document.removeEventListener("click", close);
  }, [open]);
  return (
    <div style={{ position: "relative", display: "inline-flex" }} onClick={e => e.stopPropagation()}>
      <button
        onClick={() => setOpen(v => !v)}
        onMouseEnter={() => setHov(true)}
        onMouseLeave={() => setHov(false)}
        title="Export · PNG, JPG, SVG, PowerPoint, Copy"
        style={{
          width: 36, height: 36, borderRadius: 9,
          background: open || hov ? "linear-gradient(135deg," + C.amber + "," + "#E8A020)" : "rgba(255,255,255,0.04)",
          border: "1px solid " + (open || hov ? C.amber + "70" : "rgba(255,255,255,0.10)"),
          color: open || hov ? "#060608" : C.txm,
          cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center",
          transition: "all 0.16s cubic-bezier(.2,.7,.2,1)",
          boxShadow: open || hov ? "0 6px 18px " + C.amber + "55, 0 1px 0 rgba(255,255,255,0.20) inset" : "none",
        }}
      >
        <Download size={15} strokeWidth={2.4} />
      </button>
      {open && (
        <div style={{
          position: "absolute", right: 0, top: "calc(100% + 6px)",
          background: "#0D0D14", border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: 10, padding: 4, minWidth: 232, zIndex: 1100,
          boxShadow: "0 18px 40px rgba(0,0,0,0.55)",
        }}>
          <div onClick={() => { onPNG(); setOpen(false); }} style={dropItem()}>
            <ImageIcon size={13} strokeWidth={2.2} color={C.amber} />
            <span style={{ flex: 1 }}>PNG</span>
            <span style={{ fontSize: 9, color: C.txd, fontFamily: mn, letterSpacing: 0.8 }}>2× retina</span>
          </div>
          <div onClick={() => { onJPG(); setOpen(false); }} style={dropItem()}>
            <ImageIcon size={13} strokeWidth={2.2} color="#0B86D1" />
            <span style={{ flex: 1 }}>JPG</span>
            <span style={{ fontSize: 9, color: C.txd, fontFamily: mn, letterSpacing: 0.8 }}>92%</span>
          </div>
          <div onClick={() => { onSVG(); setOpen(false); }} style={dropItem()}>
            <FileCode2 size={13} strokeWidth={2.2} color="#2EAD8E" />
            <span style={{ flex: 1 }}>SVG</span>
            <span style={{ fontSize: 9, color: C.txd, fontFamily: mn, letterSpacing: 0.8 }}>vector</span>
          </div>
          <div onClick={() => { onPPTX(); setOpen(false); }} style={dropItem()}>
            <FileSpreadsheet size={13} strokeWidth={2.2} color="#E06347" />
            <span style={{ flex: 1 }}>PowerPoint</span>
            <span style={{ fontSize: 9, color: C.txd, fontFamily: mn, letterSpacing: 0.8 }}>.pptx</span>
          </div>
          <div style={{ height: 1, background: "rgba(255,255,255,0.06)", margin: "4px 6px" }} />
          <div onClick={() => { onCopyPNG(); setOpen(false); }} style={dropItem()}>
            <ClipboardPaste size={13} strokeWidth={2.2} color="#905CCB" />
            <span style={{ flex: 1 }}>Copy PNG</span>
            <span style={{ fontSize: 9, color: C.txd, fontFamily: mn, letterSpacing: 0.8 }}>⌘⇧C</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Wave 15 · Chart pane inner · auto-fit + zoom-aware chart container ──
// Watches its own pane size with ResizeObserver and computes a 16:9 W/H
// that fills the available space. Applies the user's `chartZoom` either by
// "fit" (default, scales SVG to 100% width) or by an absolute scale factor
// (50/75/100/125/150/200/300%). When zoom > 100% the container scrolls.
function ChartPaneInner({
  backdrop, backdropMode, renderChart, setSelected, selected,
  chartZoom, defaultW, defaultH,
}: {
  backdrop: BackdropKey;
  backdropMode: BackdropMode;
  renderChart: () => React.ReactNode;
  setSelected: (s: SelectedElement | null) => void;
  selected: SelectedElement | null;
  chartZoom: "fit" | number;
  defaultW: number;
  defaultH: number;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState<{ w: number; h: number }>({ w: defaultW, h: defaultH });
  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const update = () => {
      const rect = el.getBoundingClientRect();
      const padX = 60;  // horizontal card padding (26 each side + a touch)
      const padY = 60;
      const w = Math.max(420, rect.width - padX);
      // Cap height so we never produce squashed-wide charts. 16:9 default,
      // but bounded by the actual available pane height.
      const h = Math.max(280, Math.min(rect.height - padY, w * 0.62));
      setSize({ w: Math.round(w), h: Math.round(h) });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  void defaultW; void defaultH;
  const W = size.w;
  const H = size.h;
  const scale = chartZoom === "fit" ? 1 : chartZoom / 100;
  return (
    <div ref={containerRef} style={{
      position: "relative",
      width: "100%", height: "100%",
      background: backdropCss(backdropMode === "dark" ? BACKDROPS_DARK[backdrop] : BACKDROPS_LIGHT[backdrop]),
      border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: 16,
      padding: "26px 30px",
      overflow: chartZoom === "fit" ? "hidden" : "auto",
      boxShadow: "0 1px 0 rgba(255,255,255,0.06) inset, 0 32px 64px rgba(0,0,0,0.45)",
    }}>
      <div style={{
        width: chartZoom === "fit" ? "100%" : W * scale,
        height: chartZoom === "fit" ? "100%" : H * scale,
        transformOrigin: "top left",
      }}>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          style={{
            width: chartZoom === "fit" ? "100%" : W * scale,
            height: chartZoom === "fit" ? "auto" : H * scale,
            display: "block",
            fontFamily: ft,
            touchAction: "none",
          }}
        >
          <rect x="0" y="0" width={W} height={H} fill="transparent" onPointerDown={() => { if (selected) setSelected(null); }} />
          {renderChart()}
        </svg>
      </div>
    </div>
  );
}

// ─── Wave 15 · Zoom widget · used in the Launch top bar ──────────────────
// [−] [PCT▼] [+] [Fit]. Click PCT to pick a preset; − / + step by 25%.
// "Fit" snaps back to auto-fit the pane.
function ZoomWidget({ zoom, onChange }: { zoom: "fit" | number; onChange: (z: "fit" | number) => void }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    setTimeout(() => document.addEventListener("click", close), 0);
    return () => document.removeEventListener("click", close);
  }, [open]);
  const pct = zoom === "fit" ? 100 : zoom;
  const presets: Array<"fit" | number> = ["fit", 50, 75, 100, 125, 150, 200, 300];
  const step = (delta: number) => {
    const cur = zoom === "fit" ? 100 : zoom;
    const next = Math.max(25, Math.min(400, Math.round((cur + delta) / 25) * 25));
    onChange(next);
  };
  const btn = (content: React.ReactNode, onClick: () => void, title: string, extra: React.CSSProperties = {}) => (
    <button onClick={onClick} title={title} style={{
      padding: "5px 8px", borderRadius: 6,
      background: "transparent", border: "none",
      color: C.txm, fontFamily: mn, fontSize: 10, fontWeight: 800, letterSpacing: 0.4,
      cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 3,
      transition: "all 0.16s",
      ...extra,
    }}
      onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.08)"; e.currentTarget.style.color = "#E8E4DD"; }}
      onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = C.txm; }}
    >{content}</button>
  );
  return (
    <div style={{ position: "relative", display: "inline-flex", alignItems: "center", gap: 0,
      padding: 2,
      background: "rgba(255,255,255,0.03)",
      border: "1px solid rgba(255,255,255,0.10)",
      borderRadius: 8,
    }} onClick={e => e.stopPropagation()}>
      {btn(<Minus size={11} strokeWidth={2.4} />, () => step(-25), "Zoom out · -25%")}
      {btn(
        <span style={{ minWidth: 38, textAlign: "center" }}>{zoom === "fit" ? "Fit" : `${pct}%`}</span>,
        () => setOpen(v => !v),
        "Zoom presets",
        { background: open ? C.amber + "22" : "transparent", color: open ? C.amber : C.txm }
      )}
      {btn(<Plus size={11} strokeWidth={2.4} />, () => step(25), "Zoom in · +25%")}
      <span style={{ width: 1, height: 14, background: "rgba(255,255,255,0.10)", margin: "0 2px" }} />
      {btn(
        <span>FIT</span>,
        () => onChange("fit"),
        "Fit chart to pane",
        { color: zoom === "fit" ? C.amber : C.txm, background: zoom === "fit" ? C.amber + "18" : "transparent" }
      )}
      {open && (
        <div style={{
          position: "absolute", left: 0, top: "calc(100% + 6px)",
          background: "#0D0D14", border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: 8, padding: 4, minWidth: 110, zIndex: 1100,
          boxShadow: "0 18px 40px rgba(0,0,0,0.55)",
        }}>
          {presets.map(p => {
            const isActive = (p === "fit" && zoom === "fit") || (typeof p === "number" && zoom === p);
            return (
              <div key={String(p)}
                onClick={() => { onChange(p); setOpen(false); }}
                style={{
                  ...dropItem(),
                  padding: "6px 10px",
                  background: isActive ? C.amber + "18" : "transparent",
                  color: isActive ? C.amber : "#E8E4DD",
                  fontSize: 11,
                }}
              >
                <span style={{ flex: 1 }}>{p === "fit" ? "Fit to pane" : `${p}%`}</span>
                {isActive && <Check size={11} strokeWidth={2.4} />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Wave 15 · FloatingTableWindow · draggable in-app table window ───────
// Glass-shell window with a drag header (move) + bottom-right resize
// handle. Persisted position/size lives in localStorage so it survives
// page reloads. Close button reverts to docked mode.
function FloatingTableWindow({
  pos, onChangePos, onClose, children,
}: {
  pos: { x: number; y: number; w: number; h: number };
  onChangePos: (p: { x: number; y: number; w: number; h: number }) => void;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const dragRef = useRef<{ kind: "move" | "resize"; startX: number; startY: number; orig: typeof pos } | null>(null);
  const onHeaderDown = (e: React.PointerEvent) => {
    e.preventDefault();
    dragRef.current = { kind: "move", startX: e.clientX, startY: e.clientY, orig: pos };
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
  };
  const onResizeDown = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragRef.current = { kind: "resize", startX: e.clientX, startY: e.clientY, orig: pos };
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
  };
  const onMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const { kind, startX, startY, orig } = dragRef.current;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    if (kind === "move") {
      onChangePos({ ...orig, x: Math.max(0, orig.x + dx), y: Math.max(0, orig.y + dy) });
    } else {
      onChangePos({ ...orig, w: Math.max(360, orig.w + dx), h: Math.max(240, orig.h + dy) });
    }
  };
  const onUp = () => { dragRef.current = null; };
  return (
    <div
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      style={{
        position: "fixed",
        left: pos.x, top: pos.y, width: pos.w, height: pos.h,
        background: "rgba(13,13,18,0.92)",
        backdropFilter: "blur(22px) saturate(160%)",
        WebkitBackdropFilter: "blur(22px) saturate(160%)",
        border: "1px solid rgba(255,255,255,0.14)",
        borderRadius: 14,
        boxShadow: "0 24px 64px rgba(0,0,0,0.55), 0 0 0 1px rgba(247,176,65,0.10)",
        zIndex: 12000,
        display: "flex", flexDirection: "column",
        overflow: "hidden",
        animation: "cm2ExpandPop 0.22s cubic-bezier(.2,.7,.2,1) both",
      }}
    >
      <div
        onPointerDown={onHeaderDown}
        style={{
          padding: "10px 14px",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          background: "rgba(13,13,18,0.78)",
          display: "flex", alignItems: "center", gap: 10,
          cursor: "move",
          flexShrink: 0,
          userSelect: "none",
        }}
      >
        <Table size={13} strokeWidth={2.4} color={C.amber} />
        <span style={{ fontFamily: mn, fontSize: 10, color: C.amber, letterSpacing: 1.5, textTransform: "uppercase", fontWeight: 800 }}>Data sheet · floating</span>
        <span style={{ fontFamily: mn, fontSize: 9, color: C.txm, letterSpacing: 0.6 }}>· drag to move · resize from corner</span>
        <span style={{ flex: 1 }} />
        <button
          onClick={onClose}
          title="Dock back into the split layout"
          style={{
            width: 22, height: 22, borderRadius: 5,
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.10)",
            color: C.txm,
            cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center",
          }}
        ><XIcon size={12} /></button>
      </div>
      <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>{children}</div>
      <div
        onPointerDown={onResizeDown}
        style={{
          position: "absolute", right: 0, bottom: 0, width: 18, height: 18,
          cursor: "nwse-resize",
          background: "linear-gradient(135deg, transparent 50%, " + C.amber + "55 50%, " + C.amber + "55 60%, transparent 60%, transparent 70%, " + C.amber + "55 70%, " + C.amber + "55 80%, transparent 80%)",
          borderRadius: "0 0 14px 0",
        }}
      />
    </div>
  );
}

// ─── Wave 15.1 · FloatingLaunchToolbar · movable, pinnable, customizable ─
// Glass-shell horizontal toolbar that lives ONLY in Launch mode. Drag handle
// on left, settings gear + close on right. Pin snaps it to top-center;
// unpinned mode keeps it wherever the user dropped it. Tools are stocked
// from a registry; the editor modal (FloatToolbarEditor) lets users
// add/remove/reorder them. State (tools list, position, pinned, visibility)
// persists to localStorage so it survives reloads.

type FloatToolId =
  | "templates" | "paste" | "importExcel"
  | "typeWheel" | "numFmt" | "design" | "wheelSettings"
  | "undo" | "redo" | "lock"
  | "exportPNG" | "exportSVG" | "exportPPTX" | "copyPNG"
  | "popOutTable" | "fitChart" | "zoomIn" | "zoomOut" | "fullScreen"
  | "tour" | "soundToggle" | "themeToggle"
  | "addRow" | "addCol" | "deleteSel"
  | "wheelOpen";

interface FloatToolMeta {
  label: string;
  Icon: LucideIconCmp;
  description: string;
}
const FLOAT_TOOLS: Record<FloatToolId, FloatToolMeta> = {
  templates:     { label: "Templates",       Icon: Sparkles,        description: "Quick-start gallery · production-ready charts" },
  paste:         { label: "Paste",           Icon: ClipboardPaste,  description: "Paste TSV/CSV directly into the data sheet" },
  importExcel:   { label: "Import",          Icon: Upload,          description: "Upload an .xlsx or .csv workbook" },
  typeWheel:     { label: "Type Wheel",      Icon: Sparkles,        description: "Radial chart-type picker (W)" },
  numFmt:        { label: "Number Format",   Icon: Hash,            description: "Switch number formatting · auto / pct / k / m / b" },
  design:        { label: "Design",          Icon: Palette,         description: "Palette, backdrops, gridlines (⌘D)" },
  wheelSettings: { label: "Wheel Settings",  Icon: Settings,        description: "Customize the radial context wheel" },
  undo:          { label: "Undo",            Icon: Undo2,           description: "Undo last change (⌘Z)" },
  redo:          { label: "Redo",            Icon: Redo2,           description: "Redo undone change (⌘⇧Z)" },
  lock:          { label: "Lock",            Icon: Lock,            description: "Lock chart from edits (⌘L)" },
  exportPNG:     { label: "Export PNG",      Icon: Download,        description: "Export chart as PNG" },
  exportSVG:     { label: "Export SVG",      Icon: FileCode2,       description: "Export chart as SVG" },
  exportPPTX:    { label: "Export PPTX",     Icon: FileSpreadsheet, description: "Export as PowerPoint slide" },
  copyPNG:       { label: "Copy PNG",        Icon: ImageIcon,       description: "Copy chart PNG to clipboard (⌘⇧C)" },
  popOutTable:   { label: "Pop Out Table",   Icon: Maximize2,       description: "Detach the data sheet into a floating window" },
  fitChart:      { label: "Fit Chart",       Icon: Minimize2,       description: "Fit chart to pane" },
  zoomIn:        { label: "Zoom In",         Icon: ZoomIn,          description: "Zoom chart in by 25%" },
  zoomOut:       { label: "Zoom Out",        Icon: ZoomOut,         description: "Zoom chart out by 25%" },
  fullScreen:    { label: "Full Screen",     Icon: Maximize2,       description: "Toggle browser full-screen" },
  tour:          { label: "Tour",            Icon: HelpCircle,      description: "Run the onboarding tour" },
  soundToggle:   { label: "Sound",           Icon: Volume2,         description: "Toggle sound effects" },
  themeToggle:   { label: "Theme",           Icon: Sun,             description: "Toggle light / dark theme" },
  addRow:        { label: "Add Row",         Icon: Plus,            description: "Append a blank row to the data sheet" },
  addCol:        { label: "Add Column",      Icon: Columns3,        description: "Append a new series column" },
  deleteSel:     { label: "Delete",          Icon: Trash2,          description: "Delete the selected element" },
  wheelOpen:     { label: "Element Wheel",   Icon: Disc,            description: "Open the radial wheel for the selected element" },
};

const DEFAULT_FLOAT_TOOLS: FloatToolId[] = [
  "templates", "paste", "importExcel",
  "typeWheel", "design", "wheelSettings",
  "undo", "redo", "lock",
  "exportPNG", "popOutTable", "fitChart",
];

// Validates a JSON-parsed value and returns a clean FloatToolId[] or null.
function parseFloatToolsSaved(raw: unknown): FloatToolId[] | null {
  if (!Array.isArray(raw)) return null;
  const valid = new Set(Object.keys(FLOAT_TOOLS));
  const out: FloatToolId[] = [];
  for (const r of raw) {
    if (typeof r === "string" && valid.has(r)) out.push(r as FloatToolId);
  }
  return out.length > 0 ? out : null;
}

interface FloatToolbarActions {
  templates: () => void;
  paste: () => void;
  importExcel: () => void;
  typeWheel: () => void;
  numFmt: () => void;
  design: () => void;
  wheelSettings: () => void;
  undo: () => void;
  redo: () => void;
  lock: () => void;
  exportPNG: () => void;
  exportSVG: () => void;
  exportPPTX: () => void;
  copyPNG: () => void;
  popOutTable: () => void;
  fitChart: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
  fullScreen: () => void;
  tour: () => void;
  soundToggle: () => void;
  themeToggle: () => void;
  addRow: () => void;
  addCol: () => void;
  deleteSel: () => void;
  wheelOpen: () => void;
}

interface FloatToolbarStateFlags {
  designOpen?: boolean;
  locked?: boolean;
  popOutActive?: boolean;
  canUndo?: boolean;
  canRedo?: boolean;
}

function FloatingLaunchToolbar({
  tools, pos, pinned, onMove, onTogglePin, onClose, onEditTools, actions, flags,
}: {
  tools: FloatToolId[];
  pos: { x: number; y: number } | null;
  pinned: boolean;
  onMove: (p: { x: number; y: number } | null) => void;
  onTogglePin: () => void;
  onClose: () => void;
  onEditTools: () => void;
  actions: FloatToolbarActions;
  flags: FloatToolbarStateFlags;
}) {
  const dragRef = useRef<{ startX: number; startY: number; orig: { x: number; y: number } } | null>(null);
  const rafRef = useRef<number | null>(null);
  const onHandleDown = (e: React.PointerEvent) => {
    if (pinned) return; // pinned toolbars are not draggable
    e.preventDefault();
    const orig = pos ?? { x: 0, y: 0 };
    dragRef.current = { startX: e.clientX, startY: e.clientY, orig };
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const { startX, startY, orig } = dragRef.current;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    if (rafRef.current != null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      // Constrain inside viewport (rough — toolbar may be ~640px wide).
      const maxX = (typeof window !== "undefined" ? window.innerWidth : 1280) - 80;
      const maxY = (typeof window !== "undefined" ? window.innerHeight : 720) - 60;
      const nx = Math.max(8, Math.min(maxX, orig.x + dx));
      const ny = Math.max(80, Math.min(maxY, orig.y + dy));
      onMove({ x: nx, y: ny });
    });
  };
  const onPointerUp = () => { dragRef.current = null; };

  // Pinned mode: top-center (transform translateX(-50%)).
  // Unpinned mode: free-floating at user-set absolute coords.
  const positionStyle: React.CSSProperties = pinned
    ? { left: "50%", top: 24, transform: "translateX(-50%)" }
    : pos
      ? { left: pos.x, top: pos.y }
      : { left: "50%", top: 24, transform: "translateX(-50%)" };

  const renderTool = (id: FloatToolId, idx: number) => {
    const meta = FLOAT_TOOLS[id];
    if (!meta) return null;
    const { Icon, label, description } = meta;
    let active = false;
    let disabled = false;
    if (id === "design") active = !!flags.designOpen;
    if (id === "lock") active = !!flags.locked;
    if (id === "popOutTable") active = !!flags.popOutActive;
    if (id === "undo" && flags.canUndo === false) disabled = true;
    if (id === "redo" && flags.canRedo === false) disabled = true;
    const onClick = () => {
      if (disabled) return;
      const fn = actions[id];
      if (fn) fn();
    };
    return (
      <FloatToolButton
        key={`${id}-${idx}`}
        Icon={Icon}
        title={label + " · " + description}
        active={active}
        disabled={disabled}
        onClick={onClick}
      />
    );
  };

  return (
    <div
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      style={{
        position: "absolute",
        ...positionStyle,
        zIndex: 11500,
        background: "rgba(13,13,18,0.92)",
        backdropFilter: "blur(18px) saturate(140%)",
        WebkitBackdropFilter: "blur(18px) saturate(140%)",
        border: "1px solid " + C.amber + "55",
        borderRadius: 12,
        boxShadow: "0 18px 44px rgba(0,0,0,0.55), 0 0 0 1px " + C.amber + "20, 0 0 24px " + C.amber + "18",
        minHeight: 52,
        display: "inline-flex", alignItems: "center", gap: 6,
        padding: "6px 8px",
        userSelect: "none",
        animation: "cm2ExpandPop 0.22s cubic-bezier(.2,.7,.2,1) both",
        transition: pinned ? "left 0.28s cubic-bezier(.2,.7,.2,1), top 0.28s cubic-bezier(.2,.7,.2,1), transform 0.28s cubic-bezier(.2,.7,.2,1)" : "none",
      }}
    >
      {/* Drag handle (only enabled when unpinned) */}
      <div
        onPointerDown={onHandleDown}
        title={pinned ? "Unpin to drag" : "Drag to move"}
        style={{
          width: 22, height: 36, borderRadius: 6,
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          color: pinned ? C.txd : C.txm,
          cursor: pinned ? "not-allowed" : "grab",
          opacity: pinned ? 0.45 : 1,
          background: pinned ? "transparent" : "rgba(255,255,255,0.04)",
          border: "1px solid " + (pinned ? "transparent" : "rgba(255,255,255,0.08)"),
          transition: "all 0.16s",
        }}
      >
        <GripVertical size={14} strokeWidth={2.4} />
      </div>

      {/* Pin lives right next to the grip — together they own the
          "where does this toolbar live" interaction. */}
      <FloatToolButton
        Icon={pinned ? Pin : PinOff}
        title={pinned ? "Pinned · click to unpin and drag freely" : "Unpinned · click to snap to top-center"}
        active={pinned}
        onClick={onTogglePin}
      />

      {/* Brand label */}
      <span style={{
        fontFamily: mn, fontSize: 8.5, color: C.amber,
        letterSpacing: 1.4, textTransform: "uppercase", fontWeight: 800,
        padding: "0 6px",
      }}>
        Toolbar
      </span>

      <span style={{ width: 1, height: 24, background: "rgba(255,255,255,0.08)", margin: "0 4px" }} />

      {/* Tool buttons */}
      {tools.map((id, i) => renderTool(id, i))}

      {tools.length === 0 && (
        <span style={{ fontFamily: mn, fontSize: 9, color: C.txd, padding: "0 10px" }}>
          No tools — click the gear to add some
        </span>
      )}

      <span style={{ width: 1, height: 24, background: "rgba(255,255,255,0.08)", margin: "0 4px" }} />

      {/* Right edge cluster — settings + close (pin moved next to grip) */}
      <FloatToolButton
        Icon={Settings}
        title="Edit toolbar · add, remove, or reorder tools"
        onClick={onEditTools}
      />
      <FloatToolButton
        Icon={XIcon}
        title="Hide toolbar · re-show from the Launch top bar"
        onClick={onClose}
      />
    </div>
  );
}

function FloatToolButton({
  Icon, title, active, disabled, onClick,
}: {
  Icon: LucideIconCmp;
  title: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      onClick={onClick}
      title={title}
      disabled={disabled}
      style={{
        width: 36, height: 36, borderRadius: 8,
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        background: active
          ? C.amber + "26"
          : hov && !disabled ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.03)",
        border: "1px solid " + (active
          ? C.amber + "70"
          : hov && !disabled ? C.amber + "55" : "rgba(255,255,255,0.10)"),
        color: active ? C.amber : (hov && !disabled ? "#E8E4DD" : C.txm),
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.40 : 1,
        boxShadow: hov && !disabled
          ? "0 0 12px " + C.amber + "30, 0 1px 0 rgba(255,255,255,0.06) inset"
          : "0 1px 0 rgba(255,255,255,0.04) inset",
        transition: "all 0.16s cubic-bezier(.2,.7,.2,1)",
      }}
    >
      <Icon size={18} strokeWidth={2.2} />
    </button>
  );
}

// ─── Wave 15.1 · FloatToolbarEditor · pick + reorder which tools appear ───
// Modal with two columns: LEFT lists every tool with a checkbox, RIGHT lists
// the currently-active tools with drag-to-reorder + remove handles. The
// drag-and-drop reorder is a tiny pointer-event implementation — no library.
function FloatToolbarEditor({
  tools, onChange, onClose,
}: {
  tools: FloatToolId[];
  onChange: (next: FloatToolId[]) => void;
  onClose: () => void;
}) {
  // Local mirror so reordering is snappy without parent re-renders mid-drag.
  const [draft, setDraft] = useState<FloatToolId[]>(tools);
  useEffect(() => { setDraft(tools); }, [tools]);

  const allIds = Object.keys(FLOAT_TOOLS) as FloatToolId[];
  const activeSet = new Set(draft);

  const toggleTool = (id: FloatToolId) => {
    setDraft(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);
  };

  // Drag-to-reorder · we track which index is being dragged + hover index.
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const onItemDown = (i: number) => (e: React.PointerEvent) => {
    e.preventDefault();
    setDragIdx(i);
    setHoverIdx(i);
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
  };
  const onItemMove = (i: number) => (e: React.PointerEvent) => {
    if (dragIdx == null) return;
    e.preventDefault();
    setHoverIdx(i);
  };
  const onItemUp = () => {
    if (dragIdx != null && hoverIdx != null && dragIdx !== hoverIdx) {
      setDraft(p => {
        const next = p.slice();
        const [moved] = next.splice(dragIdx, 1);
        next.splice(hoverIdx, 0, moved);
        return next;
      });
    }
    setDragIdx(null);
    setHoverIdx(null);
  };

  const removeAt = (i: number) => {
    setDraft(p => p.filter((_, j) => j !== i));
  };

  const apply = () => { onChange(draft); onClose(); };
  const reset = () => { setDraft(DEFAULT_FLOAT_TOOLS.slice()); };

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 12500,
        background: "rgba(6,6,12,0.74)",
        backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 20,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: "min(820px, 96vw)", maxHeight: "86vh",
          display: "flex", flexDirection: "column",
          background: "#0D0D14",
          border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: 14,
          boxShadow: "0 32px 80px rgba(0,0,0,0.55), 0 0 0 1px " + C.amber + "10",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "16px 20px",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}>
          <Wrench size={16} strokeWidth={2.2} color={C.amber} />
          <span style={{ fontFamily: gf, fontSize: 17, fontWeight: 800, color: "#E8E4DD", letterSpacing: -0.2 }}>
            Edit floating toolbar
          </span>
          <span style={{ marginLeft: "auto", fontFamily: mn, fontSize: 9, color: C.txm, letterSpacing: 1 }}>
            {draft.length} active · {allIds.length} total
          </span>
          <button
            onClick={onClose}
            title="Close"
            style={{
              width: 26, height: 26, borderRadius: 6,
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.10)",
              color: C.txm, cursor: "pointer",
              display: "inline-flex", alignItems: "center", justifyContent: "center",
            }}
          ><XIcon size={13} /></button>
        </div>

        <div style={{ fontFamily: ft, fontSize: 12, color: C.txm, padding: "10px 20px 0", lineHeight: 1.5 }}>
          Pick which tools appear on the floating toolbar. Drag the right column to reorder.
          Changes save instantly when you press Done.
        </div>

        {/* Two-column body */}
        <div style={{ flex: 1, minHeight: 0, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0 }}>
          {/* LEFT — available tools */}
          <div style={{
            padding: 16, overflowY: "auto",
            borderRight: "1px solid rgba(255,255,255,0.06)",
          }}>
            <div style={{ fontFamily: mn, fontSize: 9, color: C.amber, letterSpacing: 1.4, textTransform: "uppercase", fontWeight: 800, marginBottom: 10 }}>
              Available tools
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {allIds.map(id => {
                const m = FLOAT_TOOLS[id];
                const on = activeSet.has(id);
                return (
                  <label
                    key={id}
                    style={{
                      display: "flex", alignItems: "center", gap: 10,
                      padding: "8px 10px", borderRadius: 8,
                      background: on ? C.amber + "12" : "rgba(255,255,255,0.025)",
                      border: "1px solid " + (on ? C.amber + "44" : "rgba(255,255,255,0.06)"),
                      cursor: "pointer",
                      transition: "all 0.16s",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() => toggleTool(id)}
                      style={{ accentColor: C.amber, cursor: "pointer" }}
                    />
                    <m.Icon size={14} strokeWidth={2.2} color={on ? C.amber : C.txm} />
                    <span style={{ fontFamily: mn, fontSize: 11, fontWeight: 700, color: on ? C.amber : "#E8E4DD" }}>
                      {m.label}
                    </span>
                    <span style={{ marginLeft: "auto", fontFamily: ft, fontSize: 10, color: C.txd, lineHeight: 1.3, textAlign: "right", maxWidth: "55%" }}>
                      {m.description}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* RIGHT — active list, drag-to-reorder */}
          <div style={{ padding: 16, overflowY: "auto", display: "flex", flexDirection: "column" }}>
            <div style={{ fontFamily: mn, fontSize: 9, color: C.amber, letterSpacing: 1.4, textTransform: "uppercase", fontWeight: 800, marginBottom: 10 }}>
              Active toolbar order
            </div>
            {draft.length === 0 && (
              <div style={{
                padding: 20, borderRadius: 10,
                border: "1px dashed rgba(255,255,255,0.10)",
                fontFamily: ft, fontSize: 11, color: C.txd, textAlign: "center",
              }}>
                No tools selected. Pick some on the left.
              </div>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }} onPointerUp={onItemUp}>
              {draft.map((id, i) => {
                const m = FLOAT_TOOLS[id];
                const isDragging = dragIdx === i;
                const isHovered = hoverIdx === i && dragIdx !== null && dragIdx !== i;
                return (
                  <div
                    key={`${id}-${i}`}
                    onPointerDown={onItemDown(i)}
                    onPointerMove={onItemMove(i)}
                    onPointerUp={onItemUp}
                    style={{
                      display: "flex", alignItems: "center", gap: 10,
                      padding: "8px 10px", borderRadius: 8,
                      background: isDragging
                        ? C.amber + "26"
                        : isHovered
                          ? C.amber + "12"
                          : "rgba(255,255,255,0.03)",
                      border: "1px solid " + (isDragging
                        ? C.amber + "88"
                        : isHovered
                          ? C.amber + "55"
                          : "rgba(255,255,255,0.10)"),
                      cursor: isDragging ? "grabbing" : "grab",
                      transition: isDragging ? "none" : "all 0.16s",
                      userSelect: "none",
                    }}
                  >
                    <GripVertical size={13} strokeWidth={2.2} color={C.txm} />
                    <m.Icon size={14} strokeWidth={2.2} color={C.amber} />
                    <span style={{ fontFamily: mn, fontSize: 11, fontWeight: 700, color: "#E8E4DD" }}>
                      {m.label}
                    </span>
                    <span style={{ marginLeft: "auto", fontFamily: mn, fontSize: 9, color: C.txd, letterSpacing: 0.6 }}>
                      #{i + 1}
                    </span>
                    <button
                      onPointerDown={e => e.stopPropagation()}
                      onClick={() => removeAt(i)}
                      title="Remove from toolbar"
                      style={{
                        width: 22, height: 22, borderRadius: 5,
                        background: "rgba(255,255,255,0.04)",
                        border: "1px solid rgba(255,255,255,0.10)",
                        color: C.txm, cursor: "pointer",
                        display: "inline-flex", alignItems: "center", justifyContent: "center",
                      }}
                    ><XIcon size={11} /></button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: "14px 20px",
          borderTop: "1px solid rgba(255,255,255,0.06)",
          display: "flex", alignItems: "center", gap: 8,
          background: "rgba(255,255,255,0.02)",
        }}>
          <button
            onClick={reset}
            title="Restore the standard tool set"
            style={{
              padding: "8px 14px", borderRadius: 8,
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.10)",
              color: C.txm, cursor: "pointer",
              fontFamily: mn, fontSize: 10, fontWeight: 800, letterSpacing: 0.6,
              textTransform: "uppercase",
            }}
          >Reset to default</button>
          <span style={{ flex: 1 }} />
          <button
            onClick={onClose}
            style={{
              padding: "8px 14px", borderRadius: 8,
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.10)",
              color: C.txm, cursor: "pointer",
              fontFamily: mn, fontSize: 10, fontWeight: 800, letterSpacing: 0.6,
              textTransform: "uppercase",
            }}
          >Cancel</button>
          <button
            onClick={apply}
            style={{
              padding: "8px 16px", borderRadius: 8,
              background: C.amber + "26",
              border: "1px solid " + C.amber + "70",
              color: C.amber, cursor: "pointer",
              fontFamily: mn, fontSize: 10, fontWeight: 800, letterSpacing: 0.6,
              textTransform: "uppercase",
            }}
          >Done</button>
        </div>
      </div>
    </div>
  );
}

// ─── Templates · port of ChartMaker 1's quick-start preset library ───────
type TemplateCategory = "financial" | "tech" | "strategy" | "timeline" | "comparison";
// A template's build() may return a single sheet OR a {primary, secondary?}
// pair so dual-table charts (FLOPs comparison) ship a starter Table 2.
type TemplateBuildResult = DataSheet | { primary: DataSheet; secondary?: DataSheet };
interface TemplateSpec {
  id: string;
  emoji: string;
  label: string;
  desc: string;
  type: ChartType;
  category?: TemplateCategory;
  build: () => TemplateBuildResult;
  title?: string;
  subtitle?: string;
  theme?: ThemeId;
}
const TEMPLATES: TemplateSpec[] = [
  {
    id: "flops-comparison",
    emoji: "⚡",
    label: "FLOPs Comparison",
    desc: "DUAL TABLES · raw specs + indexed (H100=1)",
    category: "tech",
    type: "clustered",
    title: "TPU v6 vs H100 vs H200 vs B200",
    subtitle: "Source: SemiAnalysis · Two tables (raw + indexed)",
    build: () => {
      // Table 1 — absolute specs per chip
      const primary: DataSheet = {
        schema: [
          { key: "category", label: "Metric", type: "text" },
          { key: "s1", label: "TPU v6", type: "number" },
          { key: "s2", label: "H100", type: "number" },
          { key: "s3", label: "H200", type: "number" },
          { key: "s4", label: "B200", type: "number" },
        ],
        rows: [
          { category: "FP8 (TFLOPs)",     s1: 918,  s2: 2000, s3: 2000, s4: 4500 },
          { category: "BF16 (TFLOPs)",    s1: 459,  s2: 989,  s3: 989,  s4: 2250 },
          { category: "HBM Cap (GB)",     s1: 32,   s2: 80,   s3: 141,  s4: 192  },
          { category: "HBM BW (TB/s)",    s1: 1.2,  s2: 3.35, s3: 4.8,  s4: 8.0  },
          { category: "TDP (W)",          s1: 180,  s2: 700,  s3: 700,  s4: 1200 },
        ],
      };
      // Table 2 — indexed to H100 = 1.0× (computed at build time)
      const numericKeys: Array<"s1" | "s2" | "s3" | "s4"> = ["s1", "s2", "s3", "s4"];
      const secondary: DataSheet = {
        schema: primary.schema,
        rows: primary.rows.map(r => {
          const base = Number(r.s2) || 1;
          const out: Record<string, CellValue> = { category: r.category };
          for (const k of numericKeys) out[k] = Math.round(((Number(r[k]) || 0) / base) * 100) / 100;
          return out;
        }),
      };
      return { primary, secondary };
    },
  },
  {
    id: "shipments-stack",
    emoji: "📦",
    label: "AI Shipments Stack",
    desc: "Stacked area · 5y forecast",
    category: "tech",
    type: "stackedArea",
    title: "AI Compute Shipments by Type",
    subtitle: "Source: SemiAnalysis AI Compute Model",
    build: () => ({
      schema: [
        { key: "category", label: "Year", type: "text" },
        { key: "s1", label: "Nvidia", type: "number" },
        { key: "s2", label: "TPU", type: "number" },
        { key: "s3", label: "AMD", type: "number" },
      ],
      rows: [
        { category: "2023", s1: 2750, s2: 674, s3: 87 },
        { category: "2024", s1: 8440, s2: 2564, s3: 780 },
        { category: "2025", s1: 24419, s2: 5876, s3: 1307 },
        { category: "2026", s1: 73201, s2: 18653, s3: 6153 },
        { category: "2027", s1: 131012, s2: 35991, s3: 13700 },
      ],
    }),
  },
  {
    id: "revenue-forecast",
    emoji: "📈",
    label: "Revenue Forecast",
    desc: "Revenue · cost · profit",
    category: "financial",
    type: "line",
    title: "Revenue, Cost, Profit",
    subtitle: "Source: SemiAnalysis",
    build: () => ({
      schema: [
        { key: "category", label: "Year", type: "text" },
        { key: "s1", label: "Revenue", type: "number" },
        { key: "s2", label: "Cost", type: "number" },
        { key: "s3", label: "Profit", type: "number" },
      ],
      rows: [
        { category: "2023", s1: 100, s2: 70, s3: 30 },
        { category: "2024", s1: 150, s2: 95, s3: 55 },
        { category: "2025", s1: 220, s2: 135, s3: 85 },
        { category: "2026", s1: 310, s2: 175, s3: 135 },
        { category: "2027", s1: 430, s2: 230, s3: 200 },
      ],
    }),
  },
  {
    id: "segment-share",
    emoji: "🥧",
    label: "Segment Share",
    desc: "Pie · market by segment",
    category: "comparison",
    type: "pie",
    title: "Market Share by Segment",
    subtitle: "Source: SemiAnalysis",
    build: () => ({
      schema: [
        { key: "label", label: "Segment", type: "text" },
        { key: "value", label: "Share", type: "number" },
      ],
      rows: [
        { label: "Training", value: 45 },
        { label: "Inference", value: 30 },
        { label: "Edge", value: 15 },
        { label: "Other", value: 10 },
      ],
    }),
  },
  {
    id: "flops-vs-power",
    emoji: "🔋",
    label: "FLOPs vs Power",
    desc: "Scatter · efficiency frontier",
    category: "tech",
    type: "scatter",
    title: "FLOPs vs Power Consumption",
    subtitle: "Source: SemiAnalysis Accelerator Model",
    build: () => ({
      schema: [
        { key: "label", label: "Chip", type: "text" },
        { key: "x", label: "BF16 TFLOPs", type: "number" },
        { key: "y", label: "Power (W)", type: "number" },
        { key: "size", label: "Size", type: "number" },
      ],
      rows: [
        { label: "H100", x: 989, y: 700, size: 60 },
        { label: "H200", x: 989, y: 700, size: 60 },
        { label: "B200", x: 2250, y: 1200, size: 100 },
        { label: "MI300X", x: 1300, y: 750, size: 50 },
        { label: "TPU v5p", x: 459, y: 450, size: 35 },
        { label: "TPU v6", x: 918, y: 475, size: 60 },
      ],
    }),
  },
  {
    id: "price-bridge",
    emoji: "💧",
    label: "Price Waterfall",
    desc: "Build-Down · revenue → net",
    category: "financial",
    type: "wfdn",
    title: "Revenue to Net Income",
    subtitle: "Q4 2025 · USD millions",
    build: () => ({
      schema: [
        { key: "category", label: "Step", type: "text" },
        { key: "value", label: "Δ", type: "number" },
      ],
      rows: [
        { category: "Revenue", value: 220 },
        { category: "COGS", value: -68 },
        { category: "OpEx", value: -42 },
        { category: "Tax", value: -25 },
        { category: "One-offs", value: -8 },
        { category: "Net", value: 77 },
      ],
    }),
  },
  {
    id: "brand-launch-gantt",
    emoji: "📅",
    label: "Brand Launch Plan",
    desc: "Gantt · 3-phase rollout",
    category: "timeline",
    type: "gantt",
    title: "SemiAnalysis · 2026 Brand Launch",
    subtitle: "Phased rollout with owner accountability",
    build: () => samplePerType("gantt"),
  },
  {
    id: "variance-yoy",
    emoji: "Δ",
    label: "AC vs PY Variance",
    desc: "Zebra-BI bar · quarterly",
    category: "financial",
    type: "variance",
    title: "Quarterly AC vs PY",
    subtitle: "USD millions",
    build: () => samplePerType("variance"),
  },
  // ── Financial ────────────────────────────────────────────────────────────
  {
    id: "ebitda-bridge",
    emoji: "🏗",
    label: "EBITDA Bridge",
    desc: "Revenue → COGS → SGA → R&D → EBITDA",
    category: "financial",
    type: "wfup",
    title: "EBITDA Bridge",
    subtitle: "FY 2025 · USD millions",
    build: () => ({
      schema: [{ key: "category", label: "Step", type: "text" }, { key: "value", label: "Δ", type: "number" }],
      rows: [
        { category: "Revenue", value: 500 },
        { category: "− COGS", value: -180 },
        { category: "− SG&A", value: -75 },
        { category: "− R&D", value: -60 },
        { category: "Other", value: 15 },
        { category: "EBITDA", value: 200 },
      ],
    }),
  },
  {
    id: "pl-waterfall",
    emoji: "📉",
    label: "P&L Waterfall",
    desc: "Revenue down to Net Income",
    category: "financial",
    type: "wfdn",
    title: "P&L Waterfall",
    subtitle: "FY 2025 · USD millions",
    build: () => ({
      schema: [{ key: "category", label: "Step", type: "text" }, { key: "value", label: "Δ", type: "number" }],
      rows: [
        { category: "Revenue", value: 500 },
        { category: "− COGS", value: -180 },
        { category: "Gross Profit", value: 320 },
        { category: "− OpEx", value: -120 },
        { category: "− D&A", value: -35 },
        { category: "Net Income", value: 165 },
      ],
    }),
  },
  {
    id: "revenue-by-segment",
    emoji: "📊",
    label: "Revenue by Segment",
    desc: "4 segments × 5 quarters stacked",
    category: "financial",
    type: "stacked",
    title: "Revenue by Segment",
    subtitle: "Quarterly · USD millions",
    build: () => ({
      schema: [
        { key: "category", label: "Quarter", type: "text" },
        { key: "s1", label: "Cloud", type: "number" },
        { key: "s2", label: "Enterprise", type: "number" },
        { key: "s3", label: "Consumer", type: "number" },
        { key: "s4", label: "Govt", type: "number" },
      ],
      rows: [
        { category: "Q1 '25", s1: 120, s2: 80, s3: 45, s4: 20 },
        { category: "Q2 '25", s1: 135, s2: 88, s3: 50, s4: 22 },
        { category: "Q3 '25", s1: 155, s2: 95, s3: 58, s4: 25 },
        { category: "Q4 '25", s1: 180, s2: 110, s3: 65, s4: 28 },
        { category: "Q1 '26", s1: 200, s2: 120, s3: 72, s4: 32 },
      ],
    }),
  },
  {
    id: "yoy-growth",
    emoji: "📈",
    label: "YoY Growth",
    desc: "3 products × 4 years clustered",
    category: "financial",
    type: "clustered",
    title: "YoY Revenue Growth",
    subtitle: "USD millions",
    build: () => ({
      schema: [
        { key: "category", label: "Year", type: "text" },
        { key: "s1", label: "Product A", type: "number" },
        { key: "s2", label: "Product B", type: "number" },
        { key: "s3", label: "Product C", type: "number" },
      ],
      rows: [
        { category: "2022", s1: 100, s2: 60, s3: 40 },
        { category: "2023", s1: 130, s2: 78, s3: 55 },
        { category: "2024", s1: 170, s2: 102, s3: 78 },
        { category: "2025", s1: 220, s2: 138, s3: 110 },
      ],
    }),
  },
  // ── Tech / AI ─────────────────────────────────────────────────────────────
  {
    id: "h100-b200-mi300x",
    emoji: "🖥",
    label: "H100 vs B200 vs MI300X",
    desc: "FP8, BF16, HBM, TDP, price",
    category: "tech",
    type: "clustered",
    title: "H100 vs B200 vs MI300X",
    subtitle: "Source: SemiAnalysis Accelerator Model",
    build: () => ({
      schema: [
        { key: "category", label: "Metric", type: "text" },
        { key: "s1", label: "H100", type: "number" },
        { key: "s2", label: "B200", type: "number" },
        { key: "s3", label: "MI300X", type: "number" },
      ],
      rows: [
        { category: "FP8 (TFLOP/s)", s1: 3958, s2: 9000, s3: 2610 },
        { category: "BF16 (TFLOP/s)", s1: 1979, s2: 4500, s3: 1300 },
        { category: "HBM (GB)", s1: 80, s2: 192, s3: 192 },
        { category: "TDP (W)", s1: 700, s2: 1000, s3: 750 },
        { category: "Price ($K)", s1: 30, s2: 60, s3: 15 },
      ],
    }),
  },
  {
    id: "gpu-shipments",
    emoji: "📦",
    label: "GPU Shipments",
    desc: "NV/AMD/Google/Other by quarter",
    category: "tech",
    type: "stackedArea",
    title: "AI GPU Shipments by Vendor",
    subtitle: "Q1 2022 – Q4 2026 · Thousands of units",
    build: () => ({
      schema: [
        { key: "category", label: "Quarter", type: "text" },
        { key: "s1", label: "Nvidia", type: "number" },
        { key: "s2", label: "AMD", type: "number" },
        { key: "s3", label: "Google TPU", type: "number" },
        { key: "s4", label: "Other", type: "number" },
      ],
      rows: [
        { category: "Q1 '22", s1: 200, s2: 30, s3: 50, s4: 20 },
        { category: "Q4 '22", s1: 400, s2: 60, s3: 80, s4: 35 },
        { category: "Q4 '23", s1: 1800, s2: 120, s3: 200, s4: 80 },
        { category: "Q2 '24", s1: 3200, s2: 280, s3: 400, s4: 150 },
        { category: "Q4 '24", s1: 5800, s2: 520, s3: 700, s4: 280 },
        { category: "Q4 '25", s1: 14000, s2: 1200, s3: 1500, s4: 600 },
        { category: "Q4 '26", s1: 28000, s2: 2800, s3: 3200, s4: 1400 },
      ],
    }),
  },
  {
    id: "ai-training-compute",
    emoji: "🧠",
    label: "AI Training Compute",
    desc: "GPT-2 to frontier, log scale",
    category: "tech",
    type: "line",
    title: "AI Training Compute Over Time",
    subtitle: "Source: Epoch AI / SemiAnalysis estimates",
    build: () => ({
      schema: [
        { key: "category", label: "Model", type: "text" },
        { key: "s1", label: "FLOPs (log)", type: "number" },
      ],
      rows: [
        { category: "GPT-2 (2019)", s1: 1 },
        { category: "GPT-3 (2020)", s1: 314 },
        { category: "PaLM (2022)", s1: 2800 },
        { category: "GPT-4 (2023)", s1: 20000 },
        { category: "Gemini U (2024)", s1: 60000 },
        { category: "Frontier (2025)", s1: 300000 },
      ],
    }),
  },
  {
    id: "chip-roadmap",
    emoji: "🗺",
    label: "Chip Roadmap",
    desc: "H100→H200→B100→B200→Rubin timeline",
    category: "tech",
    type: "gantt",
    title: "Nvidia GPU Roadmap",
    subtitle: "2023–2026 · Source: SemiAnalysis",
    build: () => ({
      schema: [
        { key: "task", label: "Task", type: "text" },
        { key: "start", label: "Start", type: "date" },
        { key: "end", label: "End", type: "date" },
        { key: "group", label: "Group", type: "text" },
        { key: "owner", label: "Owner", type: "text" },
        { key: "progress", label: "%", type: "percent" },
      ],
      rows: [
        { task: "H100 GA", start: "2022-10-01", end: "2023-12-31", group: "Hopper Gen", owner: "Nvidia", progress: 100 },
        { task: "H200 GA", start: "2023-06-01", end: "2024-06-30", group: "Hopper Gen", owner: "Nvidia", progress: 100 },
        { task: "B100 Sampling", start: "2024-03-01", end: "2024-09-30", group: "Blackwell Gen", owner: "Nvidia", progress: 100 },
        { task: "B200 GA", start: "2024-09-01", end: "2025-06-30", group: "Blackwell Gen", owner: "Nvidia", progress: 75 },
        { task: "GB200 NVL72", start: "2024-12-01", end: "2025-09-30", group: "Blackwell Gen", owner: "Nvidia", progress: 40 },
        { task: "Rubin Ultra", start: "2025-06-01", end: "2026-12-31", group: "Rubin Gen", owner: "Nvidia", progress: 0 },
      ],
    }),
  },
  {
    id: "datacenter-power",
    emoji: "⚡",
    label: "Data Center Power",
    desc: "CPU/GPU/Networking/Cooling by year",
    category: "tech",
    type: "stacked",
    title: "Hyperscaler Data Center Power Mix",
    subtitle: "GW · Source: SemiAnalysis estimates",
    build: () => ({
      schema: [
        { key: "category", label: "Year", type: "text" },
        { key: "s1", label: "GPU/ASIC", type: "number" },
        { key: "s2", label: "CPU", type: "number" },
        { key: "s3", label: "Networking", type: "number" },
        { key: "s4", label: "Cooling", type: "number" },
      ],
      rows: [
        { category: "2022", s1: 4, s2: 8, s3: 3, s4: 5 },
        { category: "2023", s1: 8, s2: 9, s3: 4, s4: 6 },
        { category: "2024", s1: 18, s2: 10, s3: 6, s4: 9 },
        { category: "2025", s1: 42, s2: 12, s3: 9, s4: 18 },
        { category: "2026", s1: 90, s2: 14, s3: 14, s4: 35 },
      ],
    }),
  },
  // ── Strategy ────────────────────────────────────────────────────────────
  {
    id: "market-map",
    emoji: "🗺",
    label: "Market Map",
    desc: "Mekko % · 4 segments, 3 players",
    category: "strategy",
    type: "mekkoPct",
    title: "AI Infrastructure Market Map",
    subtitle: "Source: SemiAnalysis",
    build: () => ({
      schema: [
        { key: "category", label: "Segment", type: "text" },
        { key: "weight", label: "Total ($B)", type: "number" },
        { key: "s1", label: "Nvidia", type: "number" },
        { key: "s2", label: "Custom", type: "number" },
        { key: "s3", label: "Other", type: "number" },
      ],
      rows: [
        { category: "Training", weight: 60, s1: 48, s2: 8, s3: 4 },
        { category: "Inference", weight: 25, s1: 16, s2: 7, s3: 2 },
        { category: "Storage", weight: 10, s1: 4, s2: 2, s3: 4 },
        { category: "Networking", weight: 5, s1: 2, s2: 1, s3: 2 },
      ],
    }),
  },
  {
    id: "competitive-scores",
    emoji: "🏆",
    label: "Competitive Scores",
    desc: "5 criteria × 4 competitors, scored 1-5",
    category: "strategy",
    type: "clustered",
    title: "Competitive Assessment",
    subtitle: "Score 1–5 across key dimensions",
    build: () => ({
      schema: [
        { key: "category", label: "Criteria", type: "text" },
        { key: "s1", label: "Us", type: "number" },
        { key: "s2", label: "Competitor A", type: "number" },
        { key: "s3", label: "Competitor B", type: "number" },
        { key: "s4", label: "Competitor C", type: "number" },
      ],
      rows: [
        { category: "Performance", s1: 5, s2: 4, s3: 3, s4: 2 },
        { category: "Price", s1: 3, s2: 4, s3: 5, s4: 3 },
        { category: "Support", s1: 5, s2: 3, s3: 2, s4: 4 },
        { category: "Ecosystem", s1: 4, s2: 5, s3: 3, s4: 2 },
        { category: "Roadmap", s1: 5, s2: 4, s3: 2, s4: 3 },
      ],
    }),
  },
  {
    id: "bubble-tam",
    emoji: "🫧",
    label: "Bubble Chart TAM",
    desc: "x=growth, y=margin, size=revenue",
    category: "strategy",
    type: "bubble",
    title: "Market Opportunity Map",
    subtitle: "Bubble size = TAM ($B)",
    build: () => ({
      schema: [
        { key: "label", label: "Segment", type: "text" },
        { key: "x", label: "Growth (%)", type: "number" },
        { key: "y", label: "Margin (%)", type: "number" },
        { key: "size", label: "TAM ($B)", type: "number" },
      ],
      rows: [
        { label: "AI Training", x: 85, y: 62, size: 120 },
        { label: "AI Inference", x: 120, y: 45, size: 80 },
        { label: "Cloud GPU", x: 60, y: 35, size: 200 },
        { label: "Edge AI", x: 40, y: 28, size: 50 },
        { label: "Robotics", x: 95, y: 20, size: 30 },
      ],
    }),
  },
  // ── Timeline ────────────────────────────────────────────────────────────
  {
    id: "product-sprint",
    emoji: "🏃",
    label: "Product Sprint",
    desc: "4 sprints, design/eng/qa tracks",
    category: "timeline",
    type: "gantt",
    title: "Product Sprint Plan",
    subtitle: "Q1 2026",
    build: () => ({
      schema: [
        { key: "task", label: "Task", type: "text" },
        { key: "start", label: "Start", type: "date" },
        { key: "end", label: "End", type: "date" },
        { key: "group", label: "Group", type: "text" },
        { key: "owner", label: "Owner", type: "text" },
        { key: "progress", label: "%", type: "percent" },
      ],
      rows: [
        { task: "Sprint 1 Design", start: "2026-01-05", end: "2026-01-16", group: "Sprint 1", owner: "Design", progress: 100 },
        { task: "Sprint 1 Eng", start: "2026-01-12", end: "2026-01-23", group: "Sprint 1", owner: "Eng", progress: 100 },
        { task: "Sprint 1 QA", start: "2026-01-21", end: "2026-01-26", group: "Sprint 1", owner: "QA", progress: 100 },
        { task: "Sprint 2 Design", start: "2026-01-26", end: "2026-02-06", group: "Sprint 2", owner: "Design", progress: 80 },
        { task: "Sprint 2 Eng", start: "2026-02-02", end: "2026-02-13", group: "Sprint 2", owner: "Eng", progress: 60 },
        { task: "Sprint 3 Design", start: "2026-02-16", end: "2026-02-27", group: "Sprint 3", owner: "Design", progress: 20 },
        { task: "Sprint 3 Eng", start: "2026-02-23", end: "2026-03-06", group: "Sprint 3", owner: "Eng", progress: 0 },
        { task: "Sprint 4 Launch", start: "2026-03-09", end: "2026-03-20", group: "Sprint 4", owner: "All", progress: 0 },
      ],
    }),
  },
  {
    id: "go-to-market",
    emoji: "🚀",
    label: "Go-to-Market Plan",
    desc: "3 phases, 8 tasks",
    category: "timeline",
    type: "gantt",
    title: "Go-to-Market Plan",
    subtitle: "3-phase rollout",
    build: () => ({
      schema: [
        { key: "task", label: "Task", type: "text" },
        { key: "start", label: "Start", type: "date" },
        { key: "end", label: "End", type: "date" },
        { key: "group", label: "Group", type: "text" },
        { key: "owner", label: "Owner", type: "text" },
        { key: "progress", label: "%", type: "percent" },
      ],
      rows: [
        { task: "Market research", start: "2026-01-05", end: "2026-01-30", group: "Phase 1 · Prep", owner: "Strategy", progress: 100 },
        { task: "Brand & messaging", start: "2026-01-20", end: "2026-02-20", group: "Phase 1 · Prep", owner: "Marketing", progress: 80 },
        { task: "Sales enablement", start: "2026-02-01", end: "2026-03-01", group: "Phase 2 · Build", owner: "Sales", progress: 50 },
        { task: "Beta program", start: "2026-02-15", end: "2026-03-31", group: "Phase 2 · Build", owner: "Product", progress: 30 },
        { task: "Press briefings", start: "2026-03-15", end: "2026-04-05", group: "Phase 2 · Build", owner: "PR", progress: 10 },
        { task: "Launch event", start: "2026-04-06", end: "2026-04-07", group: "Phase 3 · Launch", owner: "All", progress: 0 },
        { task: "Paid campaigns", start: "2026-04-07", end: "2026-05-31", group: "Phase 3 · Launch", owner: "Marketing", progress: 0 },
        { task: "Post-launch retro", start: "2026-05-15", end: "2026-05-22", group: "Phase 3 · Launch", owner: "All", progress: 0 },
      ],
    }),
  },
  // ── Comparison ───────────────────────────────────────────────────────────
  {
    id: "before-vs-after",
    emoji: "↔",
    label: "Before vs After",
    desc: "Side-by-side 4 metrics",
    category: "comparison",
    type: "clustered",
    title: "Before vs After",
    subtitle: "Key metrics comparison",
    build: () => ({
      schema: [
        { key: "category", label: "Metric", type: "text" },
        { key: "s1", label: "Before", type: "number" },
        { key: "s2", label: "After", type: "number" },
      ],
      rows: [
        { category: "Throughput", s1: 100, s2: 185 },
        { category: "Latency (ms)", s1: 240, s2: 95 },
        { category: "Cost ($)", s1: 180, s2: 110 },
        { category: "Score", s1: 72, s2: 94 },
      ],
    }),
  },
  {
    id: "multi-series-trend",
    emoji: "📉",
    label: "Multi-Series Trend",
    desc: "5 series, 8 time periods",
    category: "comparison",
    type: "line",
    title: "Multi-Series Trend",
    subtitle: "8-period comparison",
    build: () => ({
      schema: [
        { key: "category", label: "Period", type: "text" },
        { key: "s1", label: "Series 1", type: "number" },
        { key: "s2", label: "Series 2", type: "number" },
        { key: "s3", label: "Series 3", type: "number" },
        { key: "s4", label: "Series 4", type: "number" },
        { key: "s5", label: "Series 5", type: "number" },
      ],
      rows: [
        { category: "P1", s1: 100, s2: 80, s3: 60, s4: 40, s5: 20 },
        { category: "P2", s1: 115, s2: 85, s3: 70, s4: 55, s5: 35 },
        { category: "P3", s1: 130, s2: 92, s3: 65, s4: 70, s5: 45 },
        { category: "P4", s1: 125, s2: 100, s3: 80, s4: 60, s5: 58 },
        { category: "P5", s1: 145, s2: 108, s3: 95, s4: 75, s5: 65 },
        { category: "P6", s1: 160, s2: 115, s3: 88, s4: 90, s5: 72 },
        { category: "P7", s1: 175, s2: 125, s3: 105, s4: 85, s5: 80 },
        { category: "P8", s1: 195, s2: 138, s3: 120, s4: 100, s5: 95 },
      ],
    }),
  },
  {
    id: "price-performance",
    emoji: "💎",
    label: "Price / Performance",
    desc: "8 chips: x=perf, y=price",
    category: "comparison",
    type: "scatter",
    title: "AI Chip Price / Performance",
    subtitle: "Source: SemiAnalysis Accelerator Model",
    build: () => ({
      schema: [
        { key: "label", label: "Chip", type: "text" },
        { key: "x", label: "BF16 TFLOPs", type: "number" },
        { key: "y", label: "Price ($K)", type: "number" },
        { key: "size", label: "Size", type: "number" },
      ],
      rows: [
        { label: "H100 SXM5", x: 1979, y: 30, size: 50 },
        { label: "H200 SXM5", x: 1979, y: 35, size: 50 },
        { label: "B200 SXM6", x: 4500, y: 60, size: 80 },
        { label: "MI300X", x: 1300, y: 15, size: 40 },
        { label: "MI325X", x: 1300, y: 17, size: 40 },
        { label: "TPU v5p", x: 459, y: 0, size: 20 },
        { label: "TPU v6", x: 918, y: 0, size: 30 },
        { label: "Gaudi 3", x: 1835, y: 10, size: 35 },
      ],
    }),
  },
  // ── SA Brand · Official SemiAnalysis Excel templates ────────────────────
  // Imported verbatim from /SEMIANALYSIS/Brand/Brand 2026 Launch/Excel
  // Templates/Template - Light and Dark - Outfit.xlsx — values are the
  // real numbers shipped in the brand-approved decks, not made up.
  {
    id: "sa-brand-clustered-bar",
    emoji: "📊",
    label: "SA · Clustered Bar (Showcase)",
    desc: "Q1-Q4 2025 · 3 series — official template",
    category: "financial",
    type: "clustered",
    title: "Clustered Bar Chart",
    subtitle: "Source: SemiAnalysis · SA Brand template",
    theme: "saBrand",
    build: () => ({
      schema: [
        { key: "category", label: "Category", type: "text" },
        { key: "s1", label: "Series A", type: "number" },
        { key: "s2", label: "Series B", type: "number" },
        { key: "s3", label: "Series C", type: "number" },
      ],
      rows: [
        { category: "Q1 2025", s1: 245, s2: 180, s3: 120 },
        { category: "Q2 2025", s1: 310, s2: 220, s3: 165 },
        { category: "Q3 2025", s1: 385, s2: 290, s3: 210 },
        { category: "Q4 2025", s1: 420, s2: 340, s3: 275 },
      ],
    }),
  },
  {
    id: "sa-brand-line-monthly",
    emoji: "📈",
    label: "SA · Line Trend (Showcase)",
    desc: "Revenue · Cost · Profit · Forecast — 6mo",
    category: "financial",
    type: "line",
    title: "Line Chart",
    subtitle: "Source: SemiAnalysis · SA Brand template",
    theme: "saBrand",
    build: () => ({
      schema: [
        { key: "category", label: "Month", type: "text" },
        { key: "s1", label: "Revenue", type: "number" },
        { key: "s2", label: "Cost", type: "number" },
        { key: "s3", label: "Profit", type: "number" },
        { key: "s4", label: "Forecast", type: "number" },
      ],
      rows: [
        { category: "Jan", s1: 150, s2: 90,  s3: 60,  s4: 55  },
        { category: "Feb", s1: 175, s2: 95,  s3: 80,  s4: 72  },
        { category: "Mar", s1: 200, s2: 100, s3: 100, s4: 90  },
        { category: "Apr", s1: 190, s2: 110, s3: 80,  s4: 85  },
        { category: "May", s1: 230, s2: 105, s3: 125, s4: 110 },
        { category: "Jun", s1: 260, s2: 115, s3: 145, s4: 130 },
      ],
    }),
  },
  {
    id: "sa-brand-stacked-region",
    emoji: "🌐",
    label: "SA · Stacked Bar by Region",
    desc: "Hardware / Software / Services / Cloud × 4 regions",
    category: "financial",
    type: "stacked",
    title: "Stacked Bar Chart",
    subtitle: "Source: SemiAnalysis · SA Brand template",
    theme: "saBrand",
    build: () => ({
      schema: [
        { key: "category", label: "Region", type: "text" },
        { key: "s1", label: "Hardware", type: "number" },
        { key: "s2", label: "Software", type: "number" },
        { key: "s3", label: "Services", type: "number" },
        { key: "s4", label: "Cloud", type: "number" },
      ],
      rows: [
        { category: "North America", s1: 450, s2: 320, s3: 180, s4: 250 },
        { category: "Europe",        s1: 380, s2: 270, s3: 150, s4: 200 },
        { category: "Asia Pacific",  s1: 520, s2: 190, s3: 220, s4: 310 },
        { category: "LATAM",         s1: 180, s2: 120, s3: 90,  s4: 110 },
      ],
    }),
  },
  {
    id: "sa-brand-pie-segment",
    emoji: "🥧",
    label: "SA · Pie · Segment Share",
    desc: "Data Center / Edge / Consumer / Auto / Other",
    category: "comparison",
    type: "pie",
    title: "Pie Chart",
    subtitle: "Source: SemiAnalysis · SA Brand template",
    theme: "saBrand",
    build: () => ({
      schema: [
        { key: "label", label: "Segment", type: "text" },
        { key: "value", label: "Share", type: "number" },
      ],
      rows: [
        { label: "Data Center", value: 42 },
        { label: "Edge AI",     value: 25 },
        { label: "Consumer",    value: 18 },
        { label: "Automotive",  value: 10 },
        { label: "Other",       value: 5  },
      ],
    }),
  },
  {
    id: "sa-brand-waterfall-pl",
    emoji: "💧",
    label: "SA · Waterfall (P&L)",
    desc: "Revenue → COGS → GP → OpEx → EBITDA → D&A → EBIT",
    category: "financial",
    type: "wfup",
    title: "Waterfall Chart",
    subtitle: "Source: SemiAnalysis · SA Brand template",
    theme: "saBrand",
    build: () => ({
      schema: [
        { key: "category", label: "Item", type: "text" },
        { key: "value",    label: "Value", type: "number" },
      ],
      rows: [
        { category: "Revenue",      value: 1000 },
        { category: "COGS",         value: -420 },
        { category: "Gross Profit", value: 580  },
        { category: "OpEx",         value: -280 },
        { category: "EBITDA",       value: 300  },
        { category: "D&A",          value: -50  },
        { category: "EBIT",         value: 250  },
      ],
    }),
  },
  {
    id: "sa-brand-scatter-flops-power",
    emoji: "⚡",
    label: "SA · Scatter · FLOPs vs Power",
    desc: "9 chips · x=FLOPs(T), y=Power(W), size=Perf/$",
    category: "tech",
    type: "scatter",
    title: "Scatter Plot",
    subtitle: "Source: SemiAnalysis · SA Brand template",
    theme: "saBrand",
    build: () => ({
      schema: [
        { key: "label", label: "Chip", type: "text" },
        { key: "x", label: "FLOPs (T)", type: "number" },
        { key: "y", label: "Power (W)", type: "number" },
        { key: "size", label: "Perf/$", type: "number" },
      ],
      rows: [
        { label: "Chip 1", x: 1000, y: 400,  size: 2.5 },
        { label: "Chip 2", x: 2500, y: 700,  size: 3.6 },
        { label: "Chip 3", x: 4500, y: 1200, size: 3.8 },
        { label: "Chip 4", x: 5000, y: 1000, size: 5.0 },
        { label: "Chip 5", x: 3200, y: 800,  size: 4.0 },
        { label: "Chip 6", x: 6000, y: 1500, size: 4.0 },
        { label: "Chip 7", x: 8000, y: 1800, size: 4.4 },
        { label: "Chip 8", x: 4000, y: 600,  size: 6.7 },
      ],
    }),
  },
  {
    id: "sa-brand-stackedarea-accelerator",
    emoji: "📐",
    label: "SA · Stacked Area · Accelerator Mix",
    desc: "GPU / TPU / Custom · 2020-2024",
    category: "tech",
    type: "stackedArea",
    title: "Accelerator Shipments",
    subtitle: "Source: SemiAnalysis · SA Brand template",
    theme: "saBrand",
    build: () => ({
      schema: [
        { key: "category", label: "Year", type: "text" },
        { key: "s1", label: "GPU", type: "number" },
        { key: "s2", label: "TPU", type: "number" },
        { key: "s3", label: "Custom", type: "number" },
      ],
      rows: [
        { category: "2020", s1: 120, s2: 40,  s3: 10  },
        { category: "2021", s1: 180, s2: 65,  s3: 25  },
        { category: "2022", s1: 290, s2: 110, s3: 55  },
        { category: "2023", s1: 450, s2: 180, s3: 95  },
        { category: "2024", s1: 680, s2: 300, s3: 170 },
      ],
    }),
  },
  {
    id: "sa-brand-flops-availability",
    emoji: "🚀",
    label: "SA · FLOPs Availability (TPU)",
    desc: "TPU v4 → v7 · BF16 TFLOPs by launch quarter",
    category: "tech",
    type: "clustered",
    title: "TPU FLOPs Availability",
    subtitle: "Source: SemiAnalysis · BF16 TFLOPS by launch",
    theme: "saBrand",
    build: () => ({
      schema: [
        { key: "category", label: "Generation", type: "text" },
        { key: "s1", label: "BF16 TFLOPS", type: "number" },
      ],
      rows: [
        { category: "TPU v4 (2Q22)",  s1: 275  },
        { category: "TPU v5e (4Q23)", s1: 197  },
        { category: "TPU v5p (1Q24)", s1: 459  },
        { category: "TPU v6 (4Q24)",  s1: 918  },
        { category: "TPU v7 (4Q25)",  s1: 2307 },
      ],
    }),
  },
  {
    id: "sa-brand-tco-pflop",
    emoji: "💰",
    label: "SA · TCO per Effective Training PFLOP",
    desc: "B300 / GB300 NVL72 / TPU v7 (20-60% MFU)",
    category: "financial",
    type: "clustered",
    title: "TCO per Effective Training PFLOP at various MFUs",
    subtitle: "Source: SemiAnalysis · Bar Chart template ($/hr per Eff PFLOP)",
    theme: "saBrand",
    build: () => ({
      schema: [
        { key: "category", label: "Configuration", type: "text" },
        { key: "s1", label: "$/hr per Eff PFLOP", type: "number" },
      ],
      rows: [
        { category: "B300 1200W (30% MFU)",      s1: 1.98 },
        { category: "GB300 NVL72 (30% MFU)",     s1: 1.82 },
        { category: "TPU v7 3D Torus (20% MFU)", s1: 1.73 },
        { category: "TPU v7 3D Torus (30% MFU)", s1: 1.16 },
        { category: "TPU v7 3D Torus (40% MFU)", s1: 0.87 },
        { category: "TPU v7 3D Torus (50% MFU)", s1: 0.69 },
        { category: "TPU v7 3D Torus (60% MFU)", s1: 0.58 },
      ],
    }),
  },
];

// ─── Backdrop picker · 4 spec backdrops × dark/light mode ─────────────────
function BackdropPicker({ backdrop, mode, onChangeBackdrop, onChangeMode }: { backdrop: BackdropKey; mode: BackdropMode; onChangeBackdrop: (k: BackdropKey) => void; onChangeMode: (m: BackdropMode) => void }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { const t = e.target as HTMLElement; if (t.closest("[data-bd-picker]")) return; setOpen(false); };
    setTimeout(() => document.addEventListener("click", close), 0);
    return () => document.removeEventListener("click", close);
  }, [open]);
  const set = mode === "dark" ? BACKDROPS_DARK : BACKDROPS_LIGHT;
  const cur = set[backdrop];
  return (
    <div data-bd-picker style={{ position: "relative" }} onClick={e => e.stopPropagation()}>
      <button
        onClick={() => setOpen(v => !v)}
        title={cur.name + " · " + (mode === "dark" ? "Dark" : "Light")}
        style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "9px 14px", borderRadius: 9,
          background: open ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.035)",
          backdropFilter: "blur(10px) saturate(140%)",
          WebkitBackdropFilter: "blur(10px) saturate(140%)",
          border: "1px solid " + (open ? C.amber + "55" : "rgba(255,255,255,0.10)"),
          color: open ? C.tx : C.txm,
          fontFamily: mn, fontSize: 11, fontWeight: 800, letterSpacing: 0.5,
          cursor: "pointer", transition: "all 0.18s",
          boxShadow: open ? "0 6px 20px " + C.amber + "20, 0 1px 0 rgba(255,255,255,0.06) inset" : "0 1px 0 rgba(255,255,255,0.04) inset",
        }}
      >
        <span style={{ width: 18, height: 14, borderRadius: 3, background: backdropCss(cur, 100, 100), border: "1px solid rgba(255,255,255,0.18)" }} />
        BACKDROP
        <ChevronDown size={11} strokeWidth={2.4} style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }} />
      </button>
      {open && (
        <div style={{ position: "absolute", right: 0, top: "calc(100% + 4px)", zIndex: 1100, background: "#0D0D14", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10, padding: 8, minWidth: 280, boxShadow: "0 18px 48px rgba(0,0,0,0.5)" }}>
          {/* Mode toggle */}
          <div style={{ display: "flex", gap: 4, marginBottom: 8, padding: 3, background: "rgba(255,255,255,0.025)", borderRadius: 7 }}>
            {(["dark", "light"] as BackdropMode[]).map(m => {
              const on = mode === m;
              return <button key={m} onClick={() => onChangeMode(m)} style={{ flex: 1, padding: "7px 10px", borderRadius: 5, background: on ? C.amber + "22" : "transparent", border: "none", color: on ? C.amber : C.txm, fontFamily: mn, fontSize: 10, fontWeight: 800, letterSpacing: 0.5, cursor: "pointer", textTransform: "uppercase" }}>{m}</button>;
            })}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
            {(Object.keys(set) as BackdropKey[]).map(k => {
              const spec = set[k];
              const on = backdrop === k;
              return (
                <button key={k} onClick={() => { onChangeBackdrop(k); }} style={{
                  display: "flex", flexDirection: "column", alignItems: "stretch", gap: 4, padding: 6,
                  background: on ? C.amber + "16" : "rgba(255,255,255,0.03)",
                  border: "1px solid " + (on ? C.amber + "55" : "rgba(255,255,255,0.08)"),
                  borderRadius: 7, cursor: "pointer",
                  transition: "all 0.14s",
                }}>
                  <div style={{ height: 48, borderRadius: 4, background: backdropCss(spec, 100, 100), border: "1px solid rgba(255,255,255,0.12)" }} />
                  <span style={{ fontFamily: mn, fontSize: 9, fontWeight: 700, color: on ? C.amber : C.tx, letterSpacing: 0.5, textAlign: "center" }}>{spec.name.toUpperCase()}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Manual axis range picker · Y always, X when chart supports it ────────
function AxisRangePicker({ axis, onChange, type }: { axis: { yMin?: number; yMax?: number; xMin?: number; xMax?: number }; onChange: (next: { yMin?: number; yMax?: number; xMin?: number; xMax?: number }) => void; type: ChartType }) {
  const [open, setOpen] = useState(false);
  const [yMinStr, setYMinStr] = useState(axis.yMin !== undefined ? String(axis.yMin) : "");
  const [yMaxStr, setYMaxStr] = useState(axis.yMax !== undefined ? String(axis.yMax) : "");
  const [xMinStr, setXMinStr] = useState(axis.xMin !== undefined ? String(axis.xMin) : "");
  const [xMaxStr, setXMaxStr] = useState(axis.xMax !== undefined ? String(axis.xMax) : "");
  useEffect(() => {
    setYMinStr(axis.yMin !== undefined ? String(axis.yMin) : "");
    setYMaxStr(axis.yMax !== undefined ? String(axis.yMax) : "");
    setXMinStr(axis.xMin !== undefined ? String(axis.xMin) : "");
    setXMaxStr(axis.xMax !== undefined ? String(axis.xMax) : "");
  }, [axis.yMin, axis.yMax, axis.xMin, axis.xMax]);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { const t = e.target as HTMLElement; if (t.closest("[data-axis-range]")) return; setOpen(false); };
    setTimeout(() => document.addEventListener("click", close), 0);
    return () => document.removeEventListener("click", close);
  }, [open]);
  // X range only meaningful for line + area (time axis) and scatter/bubble.
  const xApplies = ["line", "stackedArea", "scatter", "bubble"].includes(type);
  const apply = () => {
    const num = (s: string) => s === "" ? undefined : (isNaN(Number(s)) ? undefined : Number(s));
    onChange({
      yMin: num(yMinStr), yMax: num(yMaxStr),
      xMin: xApplies ? num(xMinStr) : undefined,
      xMax: xApplies ? num(xMaxStr) : undefined,
    });
  };
  const isAuto = !axis.yMin && !axis.yMax && !axis.xMin && !axis.xMax;
  return (
    <div data-axis-range style={{ position: "relative" }} onClick={e => e.stopPropagation()}>
      <button
        onClick={() => setOpen(v => !v)}
        title="Manual axis ranges · empty fields = auto-fit"
        style={{
          display: "flex", alignItems: "center", gap: 7,
          padding: "9px 14px", borderRadius: 9,
          background: open ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.035)",
          backdropFilter: "blur(10px) saturate(140%)",
          WebkitBackdropFilter: "blur(10px) saturate(140%)",
          border: "1px solid " + (open || !isAuto ? C.amber + "55" : "rgba(255,255,255,0.10)"),
          color: !isAuto ? C.amber : (open ? C.tx : C.txm),
          fontFamily: mn, fontSize: 11, fontWeight: 800, letterSpacing: 0.5,
          cursor: "pointer", transition: "all 0.18s",
          boxShadow: open || !isAuto ? "0 6px 20px " + C.amber + "20, 0 1px 0 rgba(255,255,255,0.06) inset" : "0 1px 0 rgba(255,255,255,0.04) inset",
        }}
      >
        <ArrowUpDown size={13} strokeWidth={2.2} />
        AXES
        <ChevronDown size={11} strokeWidth={2.4} style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }} />
      </button>
      {open && (
        <div style={{ position: "absolute", right: 0, top: "calc(100% + 4px)", zIndex: 1100, background: "#0D0D14", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 9, padding: 12, minWidth: 280, boxShadow: "0 18px 48px rgba(0,0,0,0.5)" }}>
          <div style={{ fontFamily: mn, fontSize: 9, color: C.txm, letterSpacing: 1.4, textTransform: "uppercase", marginBottom: 8 }}>Y axis range</div>
          <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
            <DragScrubInput
              value={Number(yMinStr) || 0}
              onChange={(n) => setYMinStr(String(n))}
              placeholder="y min"
              style={inputCSS("#06060A", "rgba(255,255,255,0.10)")}
              title="Alt-drag to scrub · empty = auto"
            />
            <DragScrubInput
              value={Number(yMaxStr) || 0}
              onChange={(n) => setYMaxStr(String(n))}
              placeholder="y max"
              style={inputCSS("#06060A", "rgba(255,255,255,0.10)")}
              title="Alt-drag to scrub · empty = auto"
            />
          </div>
          {xApplies && (
            <>
              <div style={{ fontFamily: mn, fontSize: 9, color: C.txm, letterSpacing: 1.4, textTransform: "uppercase", marginBottom: 8 }}>X axis range {type === "line" || type === "stackedArea" ? "(unix ms)" : ""}</div>
              <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
                <DragScrubInput
                  value={Number(xMinStr) || 0}
                  onChange={(n) => setXMinStr(String(n))}
                  placeholder="x min"
                  style={inputCSS("#06060A", "rgba(255,255,255,0.10)")}
                  title="Alt-drag to scrub · empty = auto"
                />
                <DragScrubInput
                  value={Number(xMaxStr) || 0}
                  onChange={(n) => setXMaxStr(String(n))}
                  placeholder="x max"
                  style={inputCSS("#06060A", "rgba(255,255,255,0.10)")}
                  title="Alt-drag to scrub · empty = auto"
                />
              </div>
            </>
          )}
          <div style={{ display: "flex", gap: 6 }}>
            <GlassButton onClick={() => { setYMinStr(""); setYMaxStr(""); setXMinStr(""); setXMaxStr(""); onChange({}); }} title="Reset to auto-fit">AUTO</GlassButton>
            <span style={{ flex: 1 }} />
            <GlassButton onClick={apply} primary title="Apply ranges">APPLY</GlassButton>
          </div>
          <div style={{ fontFamily: mn, fontSize: 9, color: C.txd, marginTop: 10, letterSpacing: 0.5 }}>Empty field = auto on that side</div>
        </div>
      )}
    </div>
  );
}

// ─── DESIGN drawer · slide-in pane consolidating styling controls ────────
function DesignDrawer({ onClose, theme, onChangeTheme, backdrop, backdropMode, onChangeBackdrop, onChangeMode, legendPos, onChangeLegendPos, showBorders, onToggleBorders, showGridlines, onToggleGridlines, showSegmentLabels, onToggleSegmentLabels, axis, onChangeAxis, chartType, yLabel, onChangeYLabel, xLabel, onChangeXLabel, logScale, onToggleLogScale, roundedCorners, onToggleRoundedCorners, showEndLabels, onToggleEndLabels, markerShape, onChangeMarkerShape, watermark, onChangeWatermark, barWidthPct, onChangeBarWidthPct, vignette = true, onToggleVignette, exportBranding = false, onToggleExportBranding }: {
  onClose: () => void;
  theme: ThemeId; onChangeTheme: (t: ThemeId) => void;
  backdrop: BackdropKey; backdropMode: BackdropMode;
  onChangeBackdrop: (k: BackdropKey) => void; onChangeMode: (m: BackdropMode) => void;
  legendPos: NonNullable<ChartConfig["legendPos"]>; onChangeLegendPos: (p: NonNullable<ChartConfig["legendPos"]>) => void;
  showBorders: boolean; onToggleBorders: () => void;
  showGridlines: boolean; onToggleGridlines: () => void;
  showSegmentLabels: boolean; onToggleSegmentLabels: () => void;
  axis: { yMin?: number; yMax?: number; xMin?: number; xMax?: number };
  onChangeAxis: (next: { yMin?: number; yMax?: number; xMin?: number; xMax?: number }) => void;
  chartType: ChartType;
  yLabel: string; onChangeYLabel: (v: string) => void;
  xLabel: string; onChangeXLabel: (v: string) => void;
  logScale: boolean; onToggleLogScale: () => void;
  roundedCorners: boolean; onToggleRoundedCorners: () => void;
  showEndLabels: boolean; onToggleEndLabels: () => void;
  markerShape: "none" | "circle" | "square" | "diamond"; onChangeMarkerShape: (s: "none" | "circle" | "square" | "diamond") => void;
  watermark: "off" | "centered" | "random"; onChangeWatermark: (w: "off" | "centered" | "random") => void;
  // Wave 13 · global bar-width slider (0-100, default 65)
  barWidthPct: number; onChangeBarWidthPct: (v: number) => void;
  // Wave 14 · vignette + branded export footer toggles
  vignette?: boolean; onToggleVignette?: () => void;
  exportBranding?: boolean; onToggleExportBranding?: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const xApplies = ["line", "stackedArea", "scatter", "bubble"].includes(chartType);
  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div style={{ padding: "16px 20px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
      <div style={{ fontFamily: mn, fontSize: 9, color: C.amber, letterSpacing: 1.6, textTransform: "uppercase", marginBottom: 12, fontWeight: 800 }}>{title}</div>
      {children}
    </div>
  );
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "transparent", zIndex: 12200, animation: "cm2DrawerFade 0.18s ease forwards", pointerEvents: "none" }}>
      <style>{`@keyframes cm2DrawerFade{from{opacity:0}to{opacity:1}}@keyframes cm2DrawerSlide{from{transform:translateX(100%)}to{transform:translateX(0)}}`}</style>
      <div onClick={e => e.stopPropagation()} style={{
        position: "absolute", right: 0, top: 0, bottom: 0,
        width: "min(420px, 92vw)",
        background: "rgba(10,10,16,0.96)",
        backdropFilter: "blur(24px) saturate(140%)",
        WebkitBackdropFilter: "blur(24px) saturate(140%)",
        borderLeft: "1px solid rgba(255,255,255,0.10)",
        boxShadow: "0 0 60px rgba(0,0,0,0.55), 0 0 0 1px rgba(247,176,65,0.04)",
        display: "flex", flexDirection: "column",
        animation: "cm2DrawerSlide 0.24s cubic-bezier(.2,.7,.2,1) forwards",
        pointerEvents: "auto",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "16px 20px", borderBottom: "1px solid rgba(255,255,255,0.06)", background: "linear-gradient(180deg, rgba(247,176,65,0.05), transparent)" }}>
          <Palette size={16} strokeWidth={2.2} color={C.amber} />
          <span style={{ fontFamily: gf, fontSize: 16, fontWeight: 800, color: "#E8E4DD", letterSpacing: -0.2 }}>Design</span>
          <span style={{ marginLeft: "auto", cursor: "pointer", color: C.txm, padding: 6, display: "inline-flex", borderRadius: 6 }} onClick={onClose} onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.05)"; }} onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }} title="Close · Esc"><XIcon size={16} /></span>
        </div>
        <div style={{ overflow: "auto", flex: 1 }}>
          {/* PALETTE */}
          <Section title="Color Palette">
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {(Object.entries(THEMES) as [ThemeId, typeof THEMES[ThemeId]][]).map(([id, t]) => {
                const on = theme === id;
                return (
                  <button key={id} onClick={() => onChangeTheme(id)} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", background: on ? C.amber + "16" : "rgba(255,255,255,0.025)", border: "1px solid " + (on ? C.amber + "55" : "rgba(255,255,255,0.08)"), borderRadius: 8, cursor: "pointer", textAlign: "left", transition: "all 0.14s" }}>
                    <span style={{ display: "inline-flex", gap: 2 }}>{t.colors.slice(0, 6).map((c, i) => <span key={i} style={{ width: 12, height: 18, background: c, borderRadius: 2 }} />)}</span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: ft, fontSize: 12, fontWeight: 800, color: on ? C.amber : "#E8E4DD" }}>{t.name}</div>
                      <div style={{ fontFamily: mn, fontSize: 9, color: C.txm, letterSpacing: 0.4 }}>{t.sub}</div>
                    </span>
                  </button>
                );
              })}
            </div>
          </Section>

          {/* BACKDROP */}
          <Section title="Backdrop">
            <div style={{ display: "flex", gap: 4, marginBottom: 10, padding: 3, background: "rgba(255,255,255,0.025)", borderRadius: 7 }}>
              {(["dark", "light"] as BackdropMode[]).map(m => {
                const on = backdropMode === m;
                return <button key={m} onClick={() => onChangeMode(m)} style={{ flex: 1, padding: "7px 10px", borderRadius: 5, background: on ? C.amber + "22" : "transparent", border: "none", color: on ? C.amber : C.txm, fontFamily: mn, fontSize: 10, fontWeight: 800, letterSpacing: 0.5, cursor: "pointer", textTransform: "uppercase" }}>{m}</button>;
              })}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
              {(Object.keys(backdropMode === "dark" ? BACKDROPS_DARK : BACKDROPS_LIGHT) as BackdropKey[]).map(k => {
                const set = backdropMode === "dark" ? BACKDROPS_DARK : BACKDROPS_LIGHT;
                const on = backdrop === k;
                return (
                  <button key={k} onClick={() => onChangeBackdrop(k)} style={{ display: "flex", flexDirection: "column", gap: 4, padding: 6, background: on ? C.amber + "16" : "rgba(255,255,255,0.025)", border: "1px solid " + (on ? C.amber + "55" : "rgba(255,255,255,0.08)"), borderRadius: 7, cursor: "pointer" }}>
                    <div style={{ height: 52, borderRadius: 4, background: backdropCss(set[k], 100, 100), border: "1px solid rgba(255,255,255,0.10)" }} />
                    <span style={{ fontFamily: mn, fontSize: 9, fontWeight: 800, color: on ? C.amber : C.tx, letterSpacing: 0.5, textAlign: "center" }}>{set[k].name.toUpperCase()}</span>
                  </button>
                );
              })}
            </div>
          </Section>

          {/* LEGEND POSITION */}
          <Section title="Legend Position">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 4 }}>
              {(["bottom", "left", "right", "hidden"] as const).map(p => {
                const on = legendPos === p;
                return <button key={p} onClick={() => onChangeLegendPos(p)} style={{ padding: "10px 4px", borderRadius: 6, background: on ? C.amber + "20" : "rgba(255,255,255,0.025)", border: "1px solid " + (on ? C.amber + "55" : "rgba(255,255,255,0.08)"), color: on ? C.amber : C.tx, fontFamily: mn, fontSize: 9, fontWeight: 800, letterSpacing: 0.5, cursor: "pointer", textTransform: "uppercase" }}>{p}</button>;
              })}
            </div>
            <div style={{ fontFamily: mn, fontSize: 9, color: C.txd, marginTop: 8, letterSpacing: 0.5 }}>The chart canvas re-flows around the legend.</div>
          </Section>

          {/* TOGGLES */}
          <Section title="Display">
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <DesignToggle on={showBorders} label="Bar borders" sub="Outline between stacked segments" onChange={onToggleBorders} />
              <DesignToggle on={showGridlines} label="Gridlines" sub="Horizontal Y axis guides" onChange={onToggleGridlines} />
              <DesignToggle on={showSegmentLabels} label="Segment labels" sub="Value inside each stacked bar segment" onChange={onToggleSegmentLabels} />
              <DesignToggle on={logScale} label="Log Scale" sub="Logarithmic Y axis (powers of 10)" onChange={onToggleLogScale} />
              <DesignToggle on={roundedCorners} label="Rounded Corners" sub="Rounded top corners on bars" onChange={onToggleRoundedCorners} />
              <DesignToggle on={showEndLabels} label="End Labels" sub="Series label at end of last line point" onChange={onToggleEndLabels} />
              {onToggleVignette && (
                <DesignToggle on={vignette} label="Vignette" sub="Soft inner shadow on canvas (focus center)" onChange={onToggleVignette} />
              )}
              {onToggleExportBranding && (
                <DesignToggle on={exportBranding} label="Branded Export" sub="Add 'Built with POAST' to PNG/SVG exports" onChange={onToggleExportBranding} />
              )}
            </div>
            <div style={{ marginTop: 12 }}>
              <div style={{ fontFamily: mn, fontSize: 9, color: C.txm, letterSpacing: 0.6, marginBottom: 6 }}>MARKER SHAPE (LINE)</div>
              <div style={{ display: "flex", gap: 4 }}>
                {(["none", "circle", "square", "diamond"] as const).map(s => {
                  const on = markerShape === s;
                  const label = s === "none" ? "—" : s === "circle" ? "●" : s === "square" ? "■" : "◆";
                  return <button key={s} onClick={() => onChangeMarkerShape(s)} style={{ flex: 1, padding: "8px 4px", borderRadius: 6, background: on ? C.amber + "20" : "rgba(255,255,255,0.025)", border: "1px solid " + (on ? C.amber + "55" : "rgba(255,255,255,0.08)"), color: on ? C.amber : C.tx, fontFamily: mn, fontSize: 11, fontWeight: 800, cursor: "pointer", textAlign: "center" }}>{label}</button>;
                })}
              </div>
            </div>
          </Section>

          {/* Wave 13 · BAR WIDTH (global) */}
          <Section title="Bar Width">
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <input
                type="range"
                min={20}
                max={95}
                value={barWidthPct}
                onChange={e => onChangeBarWidthPct(Number(e.target.value))}
                style={{ flex: 1, accentColor: C.amber }}
              />
              <span style={{ fontFamily: mn, fontSize: 11, fontWeight: 800, color: C.amber, minWidth: 36, textAlign: "right" }}>{barWidthPct}%</span>
            </div>
            <div style={{ fontFamily: mn, fontSize: 9, color: C.txd, marginTop: 8, letterSpacing: 0.5 }}>Affects all bar / column / mekko charts uniformly.</div>
          </Section>

          {/* AXES */}
          <Section title="Axes">
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontFamily: mn, fontSize: 9, color: C.txm, letterSpacing: 0.6, marginBottom: 6 }}>Y-AXIS LABEL</div>
              <input
                value={yLabel}
                onChange={e => onChangeYLabel(e.target.value)}
                placeholder="e.g. Revenue ($B)"
                style={{ width: "100%", padding: "8px 10px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 6, color: C.tx, fontFamily: mn, fontSize: 11, outline: "none", boxSizing: "border-box" }}
              />
            </div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontFamily: mn, fontSize: 9, color: C.txm, letterSpacing: 0.6, marginBottom: 6 }}>X-AXIS LABEL</div>
              <input
                value={xLabel}
                onChange={e => onChangeXLabel(e.target.value)}
                placeholder="e.g. Quarter"
                style={{ width: "100%", padding: "8px 10px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 6, color: C.tx, fontFamily: mn, fontSize: 11, outline: "none", boxSizing: "border-box" }}
              />
            </div>
            <AxisRangeBlock axis={axis} onChange={onChangeAxis} xApplies={xApplies} chartType={chartType} />
          </Section>

          {/* WATERMARK · Wave 12 · POAST box-logo behind the chart */}
          <Section title="Watermark">
            <div style={{ display: "flex", gap: 4, padding: 3, background: "rgba(255,255,255,0.025)", borderRadius: 7 }}>
              {(["off", "centered", "random"] as const).map(m => {
                const on = watermark === m;
                return (
                  <button
                    key={m}
                    onClick={() => onChangeWatermark(m)}
                    style={{
                      flex: 1, padding: "9px 10px", borderRadius: 5,
                      background: on ? C.amber + "22" : "transparent",
                      border: "none",
                      color: on ? C.amber : C.txm,
                      fontFamily: mn, fontSize: 10, fontWeight: 800, letterSpacing: 0.5,
                      cursor: "pointer", textTransform: "uppercase",
                      transition: "all 0.14s",
                    }}
                  >{m}</button>
                );
              })}
            </div>
            <div style={{ fontFamily: mn, fontSize: 9, color: C.txd, marginTop: 8, letterSpacing: 0.5 }}>POAST box-logo at 20% opacity behind the chart.</div>
          </Section>
        </div>
      </div>
    </div>
  );
}

function DesignToggle({ on, label, sub, onChange }: { on: boolean; label: string; sub: string; onChange: () => void }) {
  return (
    <button onClick={onChange} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", background: on ? C.amber + "12" : "rgba(255,255,255,0.025)", border: "1px solid " + (on ? C.amber + "40" : "rgba(255,255,255,0.08)"), borderRadius: 7, cursor: "pointer", textAlign: "left", transition: "all 0.14s" }}>
      <span style={{ width: 30, height: 18, borderRadius: 999, background: on ? C.amber : "rgba(255,255,255,0.10)", position: "relative", flexShrink: 0, transition: "background 0.18s" }}>
        <span style={{ position: "absolute", top: 2, left: on ? 14 : 2, width: 14, height: 14, borderRadius: "50%", background: on ? "#0A0A0E" : "#E8E4DD", transition: "left 0.18s cubic-bezier(.2,.7,.2,1)", boxShadow: "0 1px 3px rgba(0,0,0,0.30)" }} />
      </span>
      <span style={{ flex: 1 }}>
        <div style={{ fontFamily: ft, fontSize: 12, fontWeight: 800, color: on ? C.amber : "#E8E4DD" }}>{label}</div>
        <div style={{ fontFamily: mn, fontSize: 9, color: C.txm, letterSpacing: 0.4 }}>{sub}</div>
      </span>
    </button>
  );
}

function AxisRangeBlock({ axis, onChange, xApplies, chartType }: { axis: { yMin?: number; yMax?: number; xMin?: number; xMax?: number }; onChange: (n: { yMin?: number; yMax?: number; xMin?: number; xMax?: number }) => void; xApplies: boolean; chartType: ChartType }) {
  void chartType;
  const [yMinStr, setYMinStr] = useState(axis.yMin !== undefined ? String(axis.yMin) : "");
  const [yMaxStr, setYMaxStr] = useState(axis.yMax !== undefined ? String(axis.yMax) : "");
  const [xMinStr, setXMinStr] = useState(axis.xMin !== undefined ? String(axis.xMin) : "");
  const [xMaxStr, setXMaxStr] = useState(axis.xMax !== undefined ? String(axis.xMax) : "");
  const apply = () => {
    const num = (s: string) => s === "" ? undefined : (isNaN(Number(s)) ? undefined : Number(s));
    onChange({ yMin: num(yMinStr), yMax: num(yMaxStr), xMin: xApplies ? num(xMinStr) : undefined, xMax: xApplies ? num(xMaxStr) : undefined });
  };
  return (
    <div>
      <div style={{ fontFamily: mn, fontSize: 9, color: C.txm, letterSpacing: 1, marginBottom: 6 }}>Y AXIS</div>
      <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
        <DragScrubInput value={Number(yMinStr) || 0} onChange={(n) => setYMinStr(String(n))} placeholder="min" style={inputCSS("rgba(255,255,255,0.025)", "rgba(255,255,255,0.10)")} title="Alt-drag to scrub" />
        <DragScrubInput value={Number(yMaxStr) || 0} onChange={(n) => setYMaxStr(String(n))} placeholder="max" style={inputCSS("rgba(255,255,255,0.025)", "rgba(255,255,255,0.10)")} title="Alt-drag to scrub" />
      </div>
      {xApplies && (<>
        <div style={{ fontFamily: mn, fontSize: 9, color: C.txm, letterSpacing: 1, marginBottom: 6 }}>X AXIS</div>
        <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
          <DragScrubInput value={Number(xMinStr) || 0} onChange={(n) => setXMinStr(String(n))} placeholder="min" style={inputCSS("rgba(255,255,255,0.025)", "rgba(255,255,255,0.10)")} title="Alt-drag to scrub" />
          <DragScrubInput value={Number(xMaxStr) || 0} onChange={(n) => setXMaxStr(String(n))} placeholder="max" style={inputCSS("rgba(255,255,255,0.025)", "rgba(255,255,255,0.10)")} title="Alt-drag to scrub" />
        </div>
      </>)}
      <div style={{ display: "flex", gap: 6 }}>
        <GlassButton onClick={() => { setYMinStr(""); setYMaxStr(""); setXMinStr(""); setXMaxStr(""); onChange({}); }} title="Reset to auto-fit">AUTO</GlassButton>
        <span style={{ flex: 1 }} />
        <GlassButton onClick={apply} primary title="Apply ranges">APPLY</GlassButton>
      </div>
    </div>
  );
}

// ─── Lock toggle · prevents accidental chart edits while in design mode ──
function LockToggle({ locked, onChange }: { locked: boolean; onChange: (v: boolean) => void }) {
  return (
    <GlassButton
      onClick={() => onChange(!locked)}
      title={locked ? "Unlock · re-enable drag, double-click, right-click" : "Lock · prevent accidental edits while you style"}
      Icon={locked ? Lock : Unlock}
      glow={locked ? "#E06347" : C.amber}
    >
      {locked ? "LOCKED" : "EDIT"}
    </GlassButton>
  );
}

// ─── Templates · quick-start preset gallery ──────────────────────────────
function TemplatesButton({ onPick, openExternal, onCloseExternal, hideTrigger }: {
  onPick: (tpl: TemplateSpec) => void;
  // Wave 15.1 · external control so the floating Launch toolbar can open the
  // SAME modal the FILE-group button opens (shared instance via portal).
  openExternal?: boolean;
  onCloseExternal?: () => void;
  // When true, render only the modal (no trigger button) — used by the
  // floating toolbar which has its own button.
  hideTrigger?: boolean;
}) {
  const [openInternal, setOpenInternal] = useState(false);
  const open = hideTrigger ? !!openExternal : (openInternal || !!openExternal);
  const setOpen = (next: boolean) => {
    if (hideTrigger) {
      if (!next) onCloseExternal?.();
    } else {
      setOpenInternal(next);
      if (!next && openExternal) onCloseExternal?.();
    }
  };
  const [catFilter, setCatFilter] = useState<TemplateCategory | "all">("all");
  const cats: Array<{ id: TemplateCategory | "all"; label: string }> = [
    { id: "all", label: "All" },
    { id: "financial", label: "Financial" },
    { id: "tech", label: "Tech" },
    { id: "strategy", label: "Strategy" },
    { id: "timeline", label: "Timeline" },
    { id: "comparison", label: "Comparison" },
  ];
  const filtered = catFilter === "all" ? TEMPLATES : TEMPLATES.filter(t => t.category === catFilter);
  return (
    <>
      {!hideTrigger && (
        <GlassButton onClick={() => setOpen(true)} title="Quick-start templates · production charts" Icon={Sparkles}>TEMPLATES</GlassButton>
      )}
      {open && (
        <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(6,6,12,0.74)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)", zIndex: 12000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{
            width: "min(880px, 96vw)",
            maxHeight: "86vh", overflow: "auto",
            background: "#0D0D14",
            border: "1px solid rgba(255,255,255,0.10)",
            borderRadius: 14,
            padding: "22px 24px",
            boxShadow: "0 32px 80px rgba(0,0,0,0.55), 0 0 0 1px rgba(247,176,65,0.05)",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
              <Sparkles size={16} strokeWidth={2.2} color={C.amber} />
              <span style={{ fontFamily: gf, fontSize: 18, fontWeight: 800, color: "#E8E4DD", letterSpacing: -0.2 }}>Quick start</span>
              <span style={{ marginLeft: "auto", fontFamily: mn, fontSize: 9, color: C.txm, letterSpacing: 1 }}>{filtered.length}/{TEMPLATES.length} templates</span>
            </div>
            {/* Category filter tabs */}
            <div style={{ display: "flex", gap: 4, marginBottom: 16, flexWrap: "wrap" }}>
              {cats.map(c => {
                const on = catFilter === c.id;
                return (
                  <button key={c.id} onClick={() => setCatFilter(c.id)} style={{ padding: "6px 12px", borderRadius: 6, background: on ? C.amber + "20" : "rgba(255,255,255,0.03)", border: "1px solid " + (on ? C.amber + "55" : "rgba(255,255,255,0.10)"), color: on ? C.amber : C.txm, fontFamily: mn, fontSize: 9, fontWeight: 800, letterSpacing: 0.5, cursor: "pointer", textTransform: "uppercase" }}>{c.label}</button>
                );
              })}
            </div>
            <div style={{ fontFamily: ft, fontSize: 12, color: C.txm, lineHeight: 1.5, marginBottom: 18 }}>
              Pick a starting point. Loads sample data + sets the chart type, title, and subtitle. Replaces the active chart's data sheet.
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 10 }}>
              {filtered.map(tpl => (
                <TemplateCard key={tpl.id} tpl={tpl} onPick={() => { onPick(tpl); setOpen(false); }} />
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
function TemplateCard({ tpl, onPick }: { tpl: TemplateSpec; onPick: () => void }) {
  const [hov, setHov] = useState(false);
  // Use the template theme palette if specified, otherwise SA Core
  const previewPalette = THEMES[tpl.theme || "saCore"].colors;
  return (
    <button
      onClick={onPick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: "flex", flexDirection: "column", alignItems: "stretch", gap: 8,
        padding: "12px 14px",
        background: hov ? C.amber + "12" : "rgba(255,255,255,0.025)",
        border: "1px solid " + (hov ? C.amber + "55" : "rgba(255,255,255,0.08)"),
        borderRadius: 10, cursor: "pointer",
        transition: "all 0.22s cubic-bezier(.2,.7,.2,1)",
        transform: hov ? "translateY(-3px)" : "translateY(0)",
        boxShadow: hov ? "0 14px 32px " + C.amber + "25, 0 1px 0 rgba(255,255,255,0.06) inset" : "0 1px 0 rgba(255,255,255,0.04) inset",
        textAlign: "left", color: "#E8E4DD",
        animation: "cm2TplRise 0.36s cubic-bezier(.2,.7,.2,1) both",
      }}
    >
      {/* Mini chart preview */}
      <div style={{
        position: "relative",
        width: "100%", height: 92,
        borderRadius: 7,
        background: hov ? "rgba(0,0,0,0.30)" : "rgba(0,0,0,0.18)",
        border: "1px solid " + (hov ? C.amber + "30" : "rgba(255,255,255,0.06)"),
        overflow: "hidden",
        display: "flex", alignItems: "center", justifyContent: "center",
        transition: "all 0.2s",
      }}>
        <MiniChartPreview type={tpl.type} palette={previewPalette} />
        {/* corner emoji badge */}
        <span style={{
          position: "absolute", top: 4, right: 4,
          fontSize: 14, lineHeight: 1,
          padding: 3, borderRadius: 5,
          background: "rgba(13,13,18,0.85)",
          backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)",
          border: "1px solid rgba(255,255,255,0.10)",
          filter: hov ? "drop-shadow(0 0 12px " + C.amber + "60)" : "none",
        }}>{tpl.emoji}</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontFamily: gf, fontSize: 13, fontWeight: 800, color: hov ? C.amber : "#E8E4DD", letterSpacing: -0.1 }}>{tpl.label}</span>
      </div>
      <div style={{ fontFamily: ft, fontSize: 11, color: C.txm, lineHeight: 1.4 }}>{tpl.desc}</div>
      <div style={{ marginTop: "auto", display: "flex", alignItems: "center", gap: 6, paddingTop: 4 }}>
        <span style={{ fontFamily: mn, fontSize: 8, fontWeight: 700, color: C.txd, letterSpacing: 1, padding: "2px 6px", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 3, background: "rgba(255,255,255,0.025)", textTransform: "uppercase" }}>{TYPES.flat().find(t => t.id === tpl.type)?.label || tpl.type}</span>
      </div>
    </button>
  );
}

// ─── Paste data button + modal · ports SA Excel paste detection ──────────
// Click → glass modal with a textarea. The parser auto-detects the SA
// horizontal layout (Date row + Numeric row + optional chip-labels row)
// and falls back to standard CSV with headers.
function PasteDataButton({ onPaste }: { onPaste: (raw: string) => void }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  return (
    <>
      <GlassButton onClick={() => { setText(""); setOpen(true); }} title="Paste data from Excel · auto-detects SA horizontal layout" Icon={ClipboardPaste}>
        PASTE
      </GlassButton>
      {open && (
        <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(6,6,12,0.74)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)", zIndex: 12000, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div onClick={e => e.stopPropagation()} style={{
            width: "min(640px, 92vw)",
            background: "#0D0D14",
            border: "1px solid rgba(255,255,255,0.10)",
            borderRadius: 14,
            padding: "22px 24px 18px",
            boxShadow: "0 32px 80px rgba(0,0,0,0.55), 0 0 0 1px rgba(247,176,65,0.05)",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
              <ClipboardPaste size={16} strokeWidth={2.2} color={C.amber} />
              <span style={{ fontFamily: gf, fontSize: 17, fontWeight: 800, color: "#E8E4DD", letterSpacing: -0.2 }}>Paste data</span>
              <span style={{ marginLeft: "auto", fontFamily: mn, fontSize: 9, color: C.txm, letterSpacing: 1 }}>TSV · CSV · SA HORIZONTAL</span>
            </div>
            <div style={{ fontFamily: ft, fontSize: 12, color: C.txm, lineHeight: 1.5, marginBottom: 12 }}>
              Paste from Excel (tab-separated) or a CSV. We auto-detect the SA Excel layout (one date row + one numeric row + optional chip-labels row beneath) and pivot.
            </div>
            <textarea
              autoFocus
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder={"Category\tQ1\tQ2\tQ3\nNV\t100\t150\t220\nAMD\t40\t60\t90"}
              spellCheck={false}
              style={{
                width: "100%", minHeight: 200, padding: "12px 14px",
                background: "#06060A",
                border: "1px solid rgba(255,255,255,0.10)",
                borderRadius: 8,
                color: C.tx,
                fontFamily: mn, fontSize: 12, lineHeight: 1.5,
                outline: "none", resize: "vertical", boxSizing: "border-box",
                marginBottom: 14,
              }}
            />
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <GlassButton onClick={() => setOpen(false)}>CANCEL</GlassButton>
              <GlassButton onClick={() => { onPaste(text); setOpen(false); }} primary Icon={Sparkles}>IMPORT</GlassButton>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// IMPORT EXCEL · Wave 13 · SheetJS-powered .xlsx upload + tab picker.
// Falls back to existing parsePasteForCategorical for .csv / .tsv files.
// xlsx is dynamically imported so it never bloats the initial bundle.
// ═══════════════════════════════════════════════════════════════════════════
type WorkbookSheetSnapshot = {
  name: string;
  rows: number;
  cols: number;
  preview: (string | number)[][]; // first 10 rows
  raw: (string | number)[][];     // full sheet
};
function aoaToDataSheet(aoa: (string | number)[][]): DataSheet {
  const first = aoa[0] || [];
  const dataRows = aoa.slice(1);
  const colCount = Math.max(first.length, ...dataRows.map(r => r.length));
  const schema: ColumnSpec[] = [];
  for (let i = 0; i < colCount; i++) {
    const header = first[i];
    const sample = dataRows[0]?.[i];
    const dateLike = typeof sample === "string" && /^\d{4}-\d{2}-\d{2}/.test(sample);
    const type: ColumnSpec["type"] =
      typeof sample === "number" ? "number" :
      dateLike ? "date" : "text";
    const key = i === 0 ? "category" : `s${i}`;
    schema.push({ key, label: String(header ?? `Col ${i + 1}`), type });
  }
  const rows = dataRows.map(row => {
    const r: Record<string, CellValue> = {};
    schema.forEach((c, i) => { r[c.key] = row[i] !== undefined ? row[i] : ""; });
    return r;
  });
  return { schema, rows };
}

function ExcelTabPickerModal({ snapshots, fileName, onPick, onClose }: {
  snapshots: WorkbookSheetSnapshot[];
  fileName: string;
  onPick: (snapshot: WorkbookSheetSnapshot) => void;
  onClose: () => void;
}) {
  const [active, setActive] = useState(snapshots[0]?.name ?? "");
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const cur = snapshots.find(s => s.name === active) ?? snapshots[0];
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(6,6,12,0.74)", backdropFilter: "blur(8px) saturate(140%)", WebkitBackdropFilter: "blur(8px) saturate(140%)", zIndex: 12500, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: "min(720px, 94vw)", maxHeight: "86vh", display: "flex", flexDirection: "column",
        background: "rgba(13,13,18,0.96)",
        backdropFilter: "blur(18px) saturate(140%)",
        WebkitBackdropFilter: "blur(18px) saturate(140%)",
        border: "1px solid " + C.amber + "30",
        borderRadius: 14,
        boxShadow: "0 32px 80px rgba(0,0,0,0.55), 0 0 0 1px " + C.amber + "10",
        animation: "cm2ExcelIn 0.22s cubic-bezier(.2,.7,.2,1) both",
      }}>
        <style>{`@keyframes cm2ExcelIn{from{opacity:0;transform:translateY(8px) scale(0.97)}to{opacity:1;transform:translateY(0) scale(1)}}`}</style>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "16px 22px", borderBottom: "1px solid rgba(255,255,255,0.06)", background: "linear-gradient(180deg, " + C.amber + "08, transparent)" }}>
          <FileSpreadsheet size={16} strokeWidth={2.2} color={C.amber} />
          <span style={{ fontFamily: gf, fontSize: 16, fontWeight: 800, color: "#E8E4DD", letterSpacing: -0.2 }}>Import Excel</span>
          <span style={{ fontFamily: mn, fontSize: 10, color: C.txm, letterSpacing: 0.6, marginLeft: 6, padding: "2px 8px", background: "rgba(255,255,255,0.04)", borderRadius: 4, border: "1px solid rgba(255,255,255,0.08)" }}>{fileName}</span>
          <span style={{ flex: 1 }} />
          <button onClick={onClose} title="Close · Esc" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", padding: 6, borderRadius: 6, background: "transparent", border: "none", color: C.txm, cursor: "pointer" }} onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; }} onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}>
            <X size={14} />
          </button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "240px 1fr", gap: 0, flex: 1, minHeight: 0 }}>
          {/* Sheet list */}
          <div style={{ borderRight: "1px solid rgba(255,255,255,0.06)", padding: 10, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
            {snapshots.map(s => {
              const on = s.name === active;
              return (
                <button
                  key={s.name}
                  onClick={() => setActive(s.name)}
                  style={{
                    display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 4,
                    padding: "10px 12px", borderRadius: 8,
                    background: on ? C.amber + "16" : "rgba(255,255,255,0.025)",
                    border: "1px solid " + (on ? C.amber + "55" : "rgba(255,255,255,0.08)"),
                    cursor: "pointer", textAlign: "left",
                  }}
                >
                  <span style={{ fontFamily: ft, fontSize: 12, fontWeight: 800, color: on ? C.amber : "#E8E4DD" }}>{s.name}</span>
                  <span style={{ fontFamily: mn, fontSize: 9, color: C.txm, letterSpacing: 0.5 }}>{s.rows} row{s.rows === 1 ? "" : "s"} × {s.cols} col{s.cols === 1 ? "" : "s"}</span>
                  <span style={{ fontFamily: mn, fontSize: 9, color: C.txd, letterSpacing: 0.3, maxWidth: "100%", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={s.preview[0]?.map(String).join(" · ")}>
                    {(s.preview[0] ?? []).map(String).join(" · ").slice(0, 80)}
                  </span>
                </button>
              );
            })}
          </div>
          {/* Preview pane */}
          <div style={{ padding: 14, overflow: "auto" }}>
            <div style={{ fontFamily: mn, fontSize: 9, color: C.amber, letterSpacing: 1.4, textTransform: "uppercase", marginBottom: 8, fontWeight: 800 }}>Preview · first 10 rows</div>
            {cur ? (
              <div style={{ overflow: "auto", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8 }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: mn, fontSize: 11, color: C.tx }}>
                  <tbody>
                    {cur.preview.map((row, ri) => (
                      <tr key={ri} style={{ background: ri === 0 ? "rgba(247,176,65,0.06)" : (ri % 2 === 0 ? "transparent" : "rgba(255,255,255,0.012)") }}>
                        {row.map((cell, ci) => (
                          <td key={ci} style={{ padding: "6px 10px", borderTop: "1px solid rgba(255,255,255,0.05)", borderLeft: ci === 0 ? "none" : "1px solid rgba(255,255,255,0.04)", color: ri === 0 ? C.amber : C.tx, fontWeight: ri === 0 ? 800 : 500, whiteSpace: "nowrap" }}>{String(cell)}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{ fontFamily: mn, fontSize: 11, color: C.txm }}>No sheet selected.</div>
            )}
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, padding: "14px 22px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <span style={{ flex: 1 }} />
          <GlassButton onClick={onClose}>CANCEL</GlassButton>
          <GlassButton onClick={() => cur && onPick(cur)} primary Icon={Sparkles} disabled={!cur}>IMPORT THIS SHEET</GlassButton>
        </div>
      </div>
    </div>
  );
}

function ImportExcelButton({ onImport }: { onImport: (sheet: DataSheet) => void }) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [snapshots, setSnapshots] = useState<WorkbookSheetSnapshot[] | null>(null);
  const [fileName, setFileName] = useState("");
  const onFile = useCallback(async (file: File) => {
    setFileName(file.name);
    const lower = file.name.toLowerCase();
    if (lower.endsWith(".csv") || lower.endsWith(".tsv")) {
      const text = await file.text();
      const ds = parsePasteForCategorical(text);
      if (ds) onImport(ds);
      else showToast("Couldn't parse the file — expected TSV or CSV with headers");
      return;
    }
    if (!(lower.endsWith(".xlsx") || lower.endsWith(".xls"))) {
      showToast("Unsupported file type — pick .xlsx, .xls, .csv, or .tsv");
      return;
    }
    try {
      const buf = await file.arrayBuffer();
      const XLSX = await import("xlsx");
      const wb = XLSX.read(buf, { type: "array" });
      const snaps: WorkbookSheetSnapshot[] = wb.SheetNames.map(name => {
        const ws = wb.Sheets[name];
        const aoa = XLSX.utils.sheet_to_json<(string | number)[]>(ws, { header: 1, defval: "" });
        const rows = aoa.length;
        const cols = aoa.reduce((m, r) => Math.max(m, r.length), 0);
        return {
          name,
          rows,
          cols,
          preview: aoa.slice(0, 10),
          raw: aoa,
        };
      });
      if (snaps.length === 0) {
        showToast("No sheets found in workbook");
        return;
      }
      if (snaps.length === 1) {
        onImport(aoaToDataSheet(snaps[0].raw));
        return;
      }
      setSnapshots(snaps);
    } catch (err) {
      console.error(err);
      showToast("Failed to parse the Excel file");
    }
  }, [onImport]);
  return (
    <>
      <GlassButton onClick={() => fileRef.current?.click()} title="Import Excel · .xlsx, .xls, .csv, .tsv" Icon={FileSpreadsheet}>
        IMPORT EXCEL
      </GlassButton>
      <input
        ref={fileRef}
        type="file"
        accept=".xlsx,.xls,.csv,.tsv"
        style={{ display: "none" }}
        onChange={e => {
          const file = e.target.files?.[0];
          if (file) onFile(file);
          // Reset so the same file can be re-imported
          e.target.value = "";
        }}
      />
      {snapshots && (
        <ExcelTabPickerModal
          snapshots={snapshots}
          fileName={fileName}
          onPick={(snap) => { onImport(aoaToDataSheet(snap.raw)); setSnapshots(null); }}
          onClose={() => setSnapshots(null)}
        />
      )}
    </>
  );
}

// ─── Top-bar Undo/Redo buttons ─────────────────────────────────────────────
function UndoRedoButtons({ onUndo, onRedo, canUndo, canRedo }: { onUndo: () => void; onRedo: () => void; canUndo: boolean; canRedo: boolean }) {
  return (
    <div style={{ display: "flex", gap: 6 }}>
      <GlassButton onClick={onUndo} disabled={!canUndo} title="Undo · ⌘Z" Icon={Undo2}>UNDO</GlassButton>
      <GlassButton onClick={onRedo} disabled={!canRedo} title="Redo · ⌘⇧Z" Icon={Redo2}>REDO</GlassButton>
    </div>
  );
}

// ─── Glass button system · POAST aesthetic ────────────────────────────────
// Reusable button with backdrop blur, hover lift + amber glow, tooltip, and
// optional Icon. Replaces the rough `<button style={{...}}>` ad hoc styles
// scattered across the toolbar so everything moves in lockstep.
function GlassButton({ onClick, disabled, title, Icon, children, primary, glow }: {
  onClick?: () => void; disabled?: boolean; title?: string; Icon?: LucideIconCmp;
  children?: React.ReactNode; primary?: boolean; glow?: string;
}) {
  const [hov, setHov] = useState(false);
  const accent = glow || C.amber;
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: "inline-flex", alignItems: "center", gap: 7,
        padding: "9px 14px", borderRadius: 9,
        background: primary
          ? "linear-gradient(135deg, " + accent + ", " + (accent === C.amber ? "#E8A020" : accent) + ")"
          : (hov ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.035)"),
        backdropFilter: "blur(10px) saturate(140%)",
        WebkitBackdropFilter: "blur(10px) saturate(140%)",
        border: "1px solid " + (primary
          ? accent + "60"
          : (hov ? accent + "40" : "rgba(255,255,255,0.10)")),
        color: primary ? "#060608" : (disabled ? C.txd : (hov ? C.tx : C.txm)),
        fontFamily: mn, fontSize: 11, fontWeight: 800, letterSpacing: 0.5,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.4 : 1,
        transition: "all 0.18s cubic-bezier(.2,.7,.2,1)",
        transform: hov && !disabled ? "translateY(-1px)" : "translateY(0)",
        boxShadow: primary
          ? (hov ? "0 8px 24px " + accent + "55, 0 1px 0 rgba(255,255,255,0.20) inset" : "0 4px 14px " + accent + "30, 0 1px 0 rgba(255,255,255,0.18) inset")
          : (hov ? "0 6px 20px " + accent + "20, 0 1px 0 rgba(255,255,255,0.06) inset" : "0 1px 0 rgba(255,255,255,0.04) inset"),
      }}
    >
      {Icon && <Icon size={13} strokeWidth={2.2} />}
      {children}
    </button>
  );
}

// ─── Number-format picker (chart-wide) ─────────────────────────────────────
function NumberFormatPicker({ fmt, onChange }: { fmt: NumberFormat; onChange: (f: NumberFormat) => void }) {
  const [open, setOpen] = useState(false);
  const opts: Array<{ id: NumberFormat; preview: string; sub: string }> = [
    { id: "auto", preview: "Auto", sub: "1.2K · 1.5M" },
    { id: "int",  preview: "1,234", sub: "Integer" },
    { id: "dec1", preview: "1.2", sub: "1 decimal" },
    { id: "pct",  preview: "1%", sub: "Percent" },
    { id: "usd",  preview: "$1,234", sub: "Dollar" },
    { id: "k",    preview: "1.2K", sub: "Thousands" },
    { id: "m",    preview: "1.20M", sub: "Millions" },
    { id: "b",    preview: "1.20B", sub: "Billions" },
  ];
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    setTimeout(() => document.addEventListener("click", close), 0);
    return () => document.removeEventListener("click", close);
  }, [open]);
  return (
    <div style={{ position: "relative" }} onClick={e => e.stopPropagation()}>
      <button
        onClick={() => setOpen(v => !v)}
        title="Number format · how every value renders"
        style={{
          display: "flex", alignItems: "center", gap: 7,
          padding: "9px 14px", borderRadius: 9,
          background: open ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.035)",
          backdropFilter: "blur(10px) saturate(140%)",
          WebkitBackdropFilter: "blur(10px) saturate(140%)",
          border: "1px solid " + (open ? C.amber + "55" : "rgba(255,255,255,0.10)"),
          color: open ? C.tx : C.txm,
          fontFamily: mn, fontSize: 11, fontWeight: 800, letterSpacing: 0.5,
          cursor: "pointer",
          transition: "all 0.18s cubic-bezier(.2,.7,.2,1)",
          boxShadow: open ? "0 6px 20px " + C.amber + "20, 0 1px 0 rgba(255,255,255,0.06) inset" : "0 1px 0 rgba(255,255,255,0.04) inset",
        }}
      >
        <Hash size={13} strokeWidth={2.2} />
        {NUM_FMT_LABELS[fmt]}
        <ChevronDown size={11} strokeWidth={2.4} style={{ marginLeft: 2, transform: open ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }} />
      </button>
      {open && (
        <div style={{ position: "absolute", right: 0, top: "calc(100% + 4px)", zIndex: 1000, background: "#0D0D14", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 9, padding: 5, minWidth: 200, boxShadow: "0 18px 48px rgba(0,0,0,0.5)" }}>
          {opts.map(o => {
            const on = o.id === fmt;
            return (
              <div key={o.id} onClick={() => { onChange(o.id); setOpen(false); }} style={{ padding: "8px 10px", display: "flex", alignItems: "center", justifyContent: "space-between", borderRadius: 6, cursor: "pointer", background: on ? C.amber + "16" : "transparent" }}
                onMouseEnter={e => { if (!on) e.currentTarget.style.background = "rgba(255,255,255,0.04)"; }}
                onMouseLeave={e => { if (!on) e.currentTarget.style.background = "transparent"; }}
              >
                <span style={{ fontFamily: ft, fontSize: 12, fontWeight: 700, color: on ? C.amber : C.tx }}>{o.preview}</span>
                <span style={{ fontFamily: mn, fontSize: 9, color: C.txm, letterSpacing: 0.5 }}>{o.sub}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Annotations toolbar · Add reference line / CAGR / Δ ──────────────────
function AnnotationsBar({ annotations, type, pickMode, placeMode, onStartPick, onCancelPick, onAddRefLine, onTogglePlaceText, onRemove, onClearAll }: {
  annotations: Annotation[]; type: ChartType; pickMode: PickMode; placeMode: PlaceMode;
  onStartPick: (kind: "cagr" | "diff") => void;
  onCancelPick: () => void;
  onAddRefLine: (value: number, label: string) => void;
  onTogglePlaceText: () => void;
  onRemove: (id: string) => void;
  onClearAll: () => void;
}) {
  const [refOpen, setRefOpen] = useState(false);
  const [refValue, setRefValue] = useState("0");
  const [refLabel, setRefLabel] = useState("");
  // Annotations only really make sense for column / line family right now
  const annotApplies = ["stacked", "clustered", "line", "stackedArea", "wfup"].includes(type);
  if (!annotApplies && annotations.length === 0 && !pickMode) return null;

  return (
    <div style={{
      marginBottom: 14, padding: "12px 14px",
      background: "rgba(13,13,18,0.72)",
      backdropFilter: "blur(14px) saturate(140%)",
      WebkitBackdropFilter: "blur(14px) saturate(140%)",
      border: "1px solid rgba(255,255,255,0.07)",
      borderRadius: 12,
      display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center",
      boxShadow: "0 1px 0 rgba(255,255,255,0.04) inset, 0 8px 24px rgba(0,0,0,0.30)",
    }}>
      <span style={{ fontFamily: mn, fontSize: 9, color: C.txm, letterSpacing: 1.4, marginRight: 6, textTransform: "uppercase", fontWeight: 800 }}>Annotate</span>
      <AnnotChip active={pickMode?.kind === "cagr"} disabled={!annotApplies} title="Pick two bars/points to draw a CAGR arrow" Icon={Sigma} onClick={() => onStartPick("cagr")}>CAGR</AnnotChip>
      <AnnotChip active={pickMode?.kind === "diff"} disabled={!annotApplies} title="Pick two bars/points to show absolute Δ" Icon={ArrowUpDown} onClick={() => onStartPick("diff")}>Δ DIFF</AnnotChip>
      <AnnotChip active={refOpen} disabled={!annotApplies} title="Drop a horizontal reference line" Icon={Minus} onClick={() => setRefOpen(v => !v)}>REF LINE</AnnotChip>
      <AnnotChip active={placeMode?.kind === "callout"} title="Click chart to drop a free-form text annotation" Icon={Type} onClick={onTogglePlaceText}>TEXT</AnnotChip>
      {refOpen && (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "0 4px" }}>
          <DragScrubInput value={Number(refValue) || 0} onChange={(n) => setRefValue(String(n))} placeholder="value" style={{ width: 72, padding: "6px 9px", background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 6, color: C.tx, fontFamily: mn, fontSize: 11, outline: "none" }} title="Alt-drag to scrub" />
          <input value={refLabel} onChange={e => setRefLabel(e.target.value)} placeholder="label" style={{ width: 110, padding: "6px 9px", background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 6, color: C.tx, fontFamily: ft, fontSize: 11, outline: "none" }} />
          <GlassButton onClick={() => { const n = Number(refValue); if (!isNaN(n)) { onAddRefLine(n, refLabel); setRefValue("0"); setRefLabel(""); setRefOpen(false); } }} primary>ADD</GlassButton>
        </span>
      )}
      {annotations.length > 0 && (
        <>
          <Sep />
          <span style={{ fontFamily: mn, fontSize: 9, color: C.txm, letterSpacing: 0.5 }}>{annotations.length} on chart</span>
          <AnnotChip danger title="Remove every annotation" Icon={Trash2} onClick={onClearAll}>CLEAR</AnnotChip>
        </>
      )}
      {pickMode && (
        <>
          <Sep />
          <span style={{ fontFamily: mn, fontSize: 10, color: C.amber, letterSpacing: 0.6, fontWeight: 800, padding: "5px 10px", background: C.amber + "12", border: "1px solid " + C.amber + "40", borderRadius: 6, animation: "cmPickPulse 1.4s ease-in-out infinite" }}>
            CLICK {pickMode.bars.length === 0 ? "FIRST" : "SECOND"} BAR
          </span>
          <AnnotChip title="Cancel pick mode" onClick={onCancelPick}>CANCEL</AnnotChip>
          <style>{`@keyframes cmPickPulse{0%,100%{box-shadow:0 0 0 ${C.amber}00}50%{box-shadow:0 0 12px ${C.amber}60}}`}</style>
        </>
      )}
    </div>
  );
}

// Compact glass chip for the annotations bar — same hover lift as
// GlassButton but quieter footprint so a row of them doesn't feel busy.
function AnnotChip({ active, disabled, title, Icon, onClick, children, danger }: {
  active?: boolean; disabled?: boolean; title?: string; Icon?: LucideIconCmp;
  onClick: () => void; children: React.ReactNode; danger?: boolean;
}) {
  const [hov, setHov] = useState(false);
  const accent = danger ? "#E06347" : C.amber;
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        padding: "7px 12px", borderRadius: 7, cursor: disabled ? "not-allowed" : "pointer",
        background: active ? accent + "20" : (hov ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.03)"),
        border: "1px solid " + (active ? accent + "60" : (hov ? accent + "30" : "rgba(255,255,255,0.10)")),
        color: active ? accent : (danger ? accent : (hov ? C.tx : C.txm)),
        fontFamily: mn, fontSize: 10, fontWeight: 800, letterSpacing: 0.5,
        transition: "all 0.16s cubic-bezier(.2,.7,.2,1)",
        transform: hov && !disabled ? "translateY(-1px)" : "translateY(0)",
        opacity: disabled ? 0.4 : 1,
        boxShadow: active ? "0 0 12px " + accent + "30" : (hov ? "0 4px 12px " + accent + "18" : "none"),
      }}
    >
      {Icon && <Icon size={11} strokeWidth={2.4} />}
      {children}
    </button>
  );
}

// ─── Floating mini-toolbar · the "context wheel" pattern ──────────────────
// Pops up next to a selected bar with a tight set of actions: change color
// (cycle theme palette), set value to 0, delete the row.
function FloatingMiniToolbar({ selection, onClose, onUpdateRow, onDeleteRow, themes, currentTheme }: {
  selection: BarSelection; onClose: () => void;
  onUpdateRow?: OnUpdateRow; onDeleteRow?: OnDeleteRow;
  themes: typeof THEMES; currentTheme: ThemeId;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    const close = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest("[data-mini-toolbar]")) return;
      onClose();
    };
    document.addEventListener("keydown", onKey);
    setTimeout(() => document.addEventListener("click", close), 0);
    return () => { document.removeEventListener("keydown", onKey); document.removeEventListener("click", close); };
  }, [onClose]);
  const palette = themes[currentTheme].colors;
  return (
    <div data-mini-toolbar style={{ position: "fixed", left: Math.max(8, selection.anchorX - 100), top: Math.max(8, selection.anchorY - 56), zIndex: 11000, background: "#0D0D14", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 999, padding: "6px 10px", display: "flex", alignItems: "center", gap: 8, boxShadow: "0 18px 40px rgba(0,0,0,0.55), 0 0 0 1px " + selection.color + "30" }}>
      <span style={{ fontFamily: mn, fontSize: 9, color: C.txm, letterSpacing: 0.5, marginRight: 2 }}>BAR</span>
      {palette.slice(0, 6).map((c, i) => (
        <span
          key={i}
          title={"Theme color " + (i + 1)}
          onClick={() => { /* just visual confirm — the full color override would need per-bar custom colors which we keep theme-driven for now */ onClose(); }}
          style={{ width: 14, height: 14, borderRadius: 4, background: c, cursor: "pointer", border: "1px solid rgba(255,255,255,0.18)" }}
        />
      ))}
      <span style={{ width: 1, height: 16, background: "rgba(255,255,255,0.10)", margin: "0 2px" }} />
      <button
        onClick={() => { onUpdateRow?.(selection.rowIdx, { [selection.key]: 0 }); onClose(); }}
        title="Set to 0"
        style={{ padding: "4px 8px", borderRadius: 5, background: "transparent", border: "1px solid rgba(255,255,255,0.14)", color: C.tx, fontFamily: mn, fontSize: 10, fontWeight: 700, cursor: "pointer", letterSpacing: 0.5 }}
      >0</button>
      <button
        onClick={() => { onDeleteRow?.(selection.rowIdx); onClose(); }}
        title="Delete row"
        style={{ padding: "4px 8px", borderRadius: 5, background: "rgba(224,99,71,0.10)", border: "1px solid rgba(224,99,71,0.40)", color: "#E06347", fontFamily: mn, fontSize: 10, fontWeight: 800, cursor: "pointer", letterSpacing: 0.5, display: "inline-flex", alignItems: "center", gap: 4 }}
      ><Trash2 size={10} strokeWidth={2.2} /></button>
    </div>
  );
}

// Right-click context menu rendered on top of everything in the chart maker.
// Closes on outside click, Escape, or after invoking a menu item.
function ChartContextMenu({ menu, onClose }: { menu: { x: number; y: number; items: ContextMenuItem[] }; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    const onAnyClick = () => onClose();
    document.addEventListener("keydown", onKey);
    // Wait a tick so the click that opened us doesn't immediately close it
    const t = setTimeout(() => {
      document.addEventListener("click", onAnyClick);
      document.addEventListener("contextmenu", onAnyClick);
    }, 0);
    return () => {
      clearTimeout(t);
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("click", onAnyClick);
      document.removeEventListener("contextmenu", onAnyClick);
    };
  }, [onClose]);
  // Clamp position so the menu doesn't hang off-screen
  const W = 240;
  const x = Math.min(menu.x, (typeof window !== "undefined" ? window.innerWidth : 1600) - W - 8);
  const y = Math.min(menu.y, (typeof window !== "undefined" ? window.innerHeight : 900) - menu.items.length * 36 - 16);
  return (
    <div
      onClick={e => e.stopPropagation()}
      onContextMenu={e => e.preventDefault()}
      style={{
        position: "fixed", left: x, top: y, zIndex: 11500,
        width: W,
        background: "#0D0D14",
        border: "1px solid rgba(255,255,255,0.10)",
        borderRadius: 10,
        padding: "5px 0",
        boxShadow: "0 18px 48px rgba(0,0,0,0.5), 0 0 0 1px rgba(247,176,65,0.05)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
      }}
    >
      {menu.items.map((it, i) => {
        // Icon row · horizontally-laid-out shape choices
        if ("kind" in it && it.kind === "iconRow") {
          return (
            <div key={i} style={{ display: "flex", gap: 4, padding: "6px 8px" }}>
              {it.icons.map((ic, j) => (
                <button
                  key={j}
                  onClick={() => { ic.onClick(); onClose(); }}
                  title={ic.title}
                  style={{
                    flex: 1, padding: "10px 0", borderRadius: 6,
                    background: ic.active ? C.amber + "20" : "rgba(255,255,255,0.03)",
                    border: "1px solid " + (ic.active ? C.amber + "55" : "rgba(255,255,255,0.08)"),
                    color: ic.active ? C.amber : C.tx,
                    cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
                    fontFamily: mn, fontSize: 8, fontWeight: 700, letterSpacing: 0.5,
                  }}
                >
                  <ic.Icon size={16} strokeWidth={ic.active ? 2.4 : 2} />
                  {ic.title.toUpperCase()}
                </button>
              ))}
            </div>
          );
        }
        // Color swatch row · pick a color, including a "no override" reset
        if ("kind" in it && it.kind === "swatchRow") {
          return (
            <div key={i} style={{ display: "flex", gap: 4, padding: "6px 10px", flexWrap: "wrap" }}>
              <button
                onClick={() => { it.onPick(null); onClose(); }}
                title="Reset color"
                style={{ width: 22, height: 22, borderRadius: 4, background: "transparent", border: "1px dashed rgba(255,255,255,0.30)", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", color: C.txm }}
              >
                <X size={11} strokeWidth={2.4} />
              </button>
              {it.colors.map((c, j) => (
                <button
                  key={j}
                  onClick={() => { it.onPick(c); onClose(); }}
                  title={c}
                  style={{ width: 22, height: 22, borderRadius: 4, background: c, border: "1px solid " + (it.current === c ? "#fff" : "rgba(0,0,0,0.4)"), cursor: "pointer", boxShadow: it.current === c ? "0 0 0 2px " + c + "60" : "none" }}
                />
              ))}
            </div>
          );
        }
        // Default item
        const item = it as { label: string; onClick: () => void; danger?: boolean; divider?: boolean };
        if (item.divider) return <div key={i} style={{ height: 1, background: "rgba(255,255,255,0.06)", margin: "4px 8px" }} />;
        return (
          <div
            key={i}
            onClick={() => { item.onClick(); onClose(); }}
            style={{
              padding: "9px 14px",
              fontFamily: ft, fontSize: 12, fontWeight: 600,
              color: item.danger ? "#E06347" : "#E8E4DD",
              cursor: "pointer", letterSpacing: 0.1,
              transition: "background 0.12s",
            }}
            onMouseEnter={e => { e.currentTarget.style.background = item.danger ? "rgba(224,99,71,0.12)" : "rgba(255,255,255,0.05)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
          >
            {item.label}
          </div>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════
function inputCSS(bg: string, border: string): React.CSSProperties {
  return { width: "100%", padding: "10px 14px", background: bg, border: "1px solid " + border, borderRadius: 9, color: C.tx, fontFamily: ft, fontSize: 13, outline: "none", boxSizing: "border-box" };
}

function Sep() { return <div style={{ width: 1, alignSelf: "stretch", background: "rgba(255,255,255,0.06)", margin: "2px 4px" }} />; }

// Vertical scrollable sidebar of chart types — each row is icon + label.
// Sticky-positioned so it stays visible while the right pane scrolls.
function ChartTypeSidebar({ active, onSelect, collapsed = false, onToggleCollapsed }: {
  active: ChartType;
  onSelect: (t: ChartType) => void;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
}) {
  return (
    <div style={{
      background: "rgba(13,13,18,0.72)",
      backdropFilter: "blur(14px) saturate(140%)",
      WebkitBackdropFilter: "blur(14px) saturate(140%)",
      border: "1px solid rgba(255,255,255,0.07)",
      borderRadius: 14,
      position: "sticky", top: 14, alignSelf: "start",
      maxHeight: "calc(100vh - 56px)", overflow: "hidden",
      display: "flex", flexDirection: "column",
      boxShadow: "0 1px 0 rgba(255,255,255,0.04) inset, 0 12px 32px rgba(0,0,0,0.30)",
      width: collapsed ? 36 : "100%",
      transition: "width 0.28s cubic-bezier(.2,.7,.2,1), transform 0.28s cubic-bezier(.2,.7,.2,1)",
    }}>
      <div style={{ padding: collapsed ? "12px 6px" : "16px 18px 12px", borderBottom: "1px solid rgba(255,255,255,0.06)", flexShrink: 0, background: "linear-gradient(180deg, rgba(255,255,255,0.02), transparent)", display: "flex", alignItems: "center", gap: 6 }}>
        {!collapsed && (
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: gf, fontSize: 13, fontWeight: 800, color: C.tx, letterSpacing: -0.1, marginBottom: 3 }}>Chart Types</div>
            <div style={{ fontFamily: mn, fontSize: 9, color: C.txm, letterSpacing: 1.4, textTransform: "uppercase" }}>{TYPES.flat().filter(t => t.working).length} live · {TYPES.flat().filter(t => !t.working).length} soon</div>
          </div>
        )}
        {onToggleCollapsed && (
          <button
            onClick={onToggleCollapsed}
            title={collapsed ? "Expand" : "Collapse"}
            style={{
              width: 22, height: 22, borderRadius: 5,
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.10)",
              color: C.txm, cursor: "pointer",
              display: "inline-flex", alignItems: "center", justifyContent: "center",
            }}
          >
            {collapsed ? <ChevronRight size={11} /> : <ChevronLeft size={11} />}
          </button>
        )}
      </div>
      {!collapsed && (
        <div style={{ overflowY: "auto", padding: "10px", display: "flex", flexDirection: "column", gap: 4 }}>
          {TYPES.flat().map(spec => <ChartTypeRow key={spec.id} spec={spec} active={active === spec.id} onClick={() => onSelect(spec.id)} />)}
        </div>
      )}
      {collapsed && (
        <div style={{
          flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
          writingMode: "vertical-rl",
          fontFamily: mn, fontSize: 9, color: C.amber, letterSpacing: 2, fontWeight: 800,
          textTransform: "uppercase", padding: "10px 0",
        }}>EXPAND</div>
      )}
    </div>
  );
}

// Individual sidebar row · pulled out so we can manage per-row hover state.
function ChartTypeRow({ spec, active, onClick }: { spec: TypeSpec; active: boolean; onClick: () => void }) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      title={spec.label + (spec.working ? "" : " · coming soon")}
      style={{
        display: "flex", alignItems: "center", gap: 12,
        padding: "11px 12px",
        background: active ? C.amber + "1A" : (hov ? "rgba(255,255,255,0.06)" : "transparent"),
        border: "1px solid " + (active ? C.amber + "60" : (hov ? "rgba(255,255,255,0.10)" : "transparent")),
        borderRadius: 9,
        cursor: spec.working ? "pointer" : "not-allowed",
        opacity: spec.working ? 1 : 0.5,
        transition: "all 0.16s cubic-bezier(.2,.7,.2,1)",
        textAlign: "left", width: "100%",
        transform: hov && spec.working && !active ? "translateX(2px)" : "translateX(0)",
        boxShadow: active
          ? "0 0 0 1px " + C.amber + "30, 0 0 24px " + C.amber + "20, inset 0 1px 0 rgba(255,255,255,0.06)"
          : (hov ? "0 4px 16px rgba(0,0,0,0.20), inset 0 1px 0 rgba(255,255,255,0.04)" : "none"),
      }}
    >
      <span style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        width: 28, height: 28, borderRadius: 7,
        background: active ? C.amber + "30" : (hov ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.03)"),
        border: active ? "1px solid " + C.amber + "55" : "1px solid rgba(255,255,255,0.06)",
        flexShrink: 0,
        boxShadow: active ? "0 0 12px " + C.amber + "30 inset" : "none",
        transition: "all 0.16s",
      }}>
        <spec.Icon size={16} strokeWidth={active ? 2.5 : 1.9} color={active ? C.amber : (spec.working ? C.tx : C.txd)} />
      </span>
      <span style={{ flex: 1, fontFamily: ft, fontSize: 13, fontWeight: active ? 800 : 600, color: active ? C.amber : (spec.working ? "#E8E4DD" : C.txd), letterSpacing: 0.1 }}>{spec.label}</span>
      {!spec.working && <span style={{ fontFamily: mn, fontSize: 7.5, color: C.txd, letterSpacing: 0.6, padding: "2px 6px", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 3 }}>SOON</span>}
    </button>
  );
}

function ThemePicker({ theme, onChange }: { theme: ThemeId; onChange: (t: ThemeId) => void }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    setTimeout(() => document.addEventListener("click", close), 0);
    return () => document.removeEventListener("click", close);
  }, [open]);
  const cur = THEMES[theme];
  return (
    <div style={{ position: "relative" }} onClick={e => e.stopPropagation()}>
      <button
        onClick={() => setOpen(v => !v)}
        title={cur.name + " · " + cur.sub}
        style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "9px 14px", borderRadius: 9,
          background: open ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.035)",
          backdropFilter: "blur(10px) saturate(140%)",
          WebkitBackdropFilter: "blur(10px) saturate(140%)",
          border: "1px solid " + (open ? C.amber + "55" : "rgba(255,255,255,0.10)"),
          color: open ? C.tx : C.txm,
          fontFamily: mn, fontSize: 11, fontWeight: 800, letterSpacing: 0.5,
          cursor: "pointer",
          transition: "all 0.18s cubic-bezier(.2,.7,.2,1)",
          boxShadow: open ? "0 6px 20px " + C.amber + "20, 0 1px 0 rgba(255,255,255,0.06) inset" : "0 1px 0 rgba(255,255,255,0.04) inset",
        }}
      >
        <span style={{ display: "inline-flex", gap: 2 }}>
          {cur.colors.slice(0, 5).map((c, i) => <span key={i} style={{ width: 8, height: 13, background: c, borderRadius: 2 }} />)}
        </span>
        {cur.name}
        <ChevronDown size={11} strokeWidth={2.4} style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }} />
      </button>
      {open && (
        <div style={{ position: "absolute", right: 0, top: "calc(100% + 4px)", zIndex: 1100, background: "#0D0D14", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 9, padding: 5, minWidth: 240, boxShadow: "0 18px 48px rgba(0,0,0,0.5)" }}>
          {(Object.entries(THEMES) as [ThemeId, typeof THEMES[ThemeId]][]).map(([id, t]) => {
            const on = theme === id;
            return (
              <div key={id} onClick={() => { onChange(id); setOpen(false); }}
                style={{ display: "flex", alignItems: "center", gap: 12, padding: "9px 11px", borderRadius: 6, cursor: "pointer", background: on ? C.amber + "16" : "transparent", border: "1px solid " + (on ? C.amber + "55" : "transparent"), marginBottom: 2 }}
                onMouseEnter={e => { if (!on) e.currentTarget.style.background = "rgba(255,255,255,0.04)"; }}
                onMouseLeave={e => { if (!on) e.currentTarget.style.background = "transparent"; }}
              >
                <span style={{ display: "inline-flex", gap: 2, flexShrink: 0 }}>
                  {t.colors.slice(0, 6).map((c, i) => <span key={i} style={{ width: 12, height: 18, background: c, borderRadius: 2 }} />)}
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: ft, fontSize: 12, fontWeight: 800, color: on ? C.amber : "#E8E4DD" }}>{t.name}</div>
                  <div style={{ fontFamily: mn, fontSize: 9, color: C.txm, letterSpacing: 0.4 }}>{t.sub}</div>
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function UnitPicker({ unit, onChange }: { unit: TimeUnit; onChange: (u: TimeUnit) => void }) {
  const opts: Array<{ id: TimeUnit; l: string }> = [{ id: "week", l: "Week" }, { id: "month", l: "Month" }, { id: "quarter", l: "Quarter" }];
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
      <Calendar size={11} strokeWidth={2} color={C.txm} style={{ marginRight: 6 }} />
      {opts.map(o => {
        const on = unit === o.id;
        return <span key={o.id} onClick={() => onChange(o.id)} style={{ padding: "5px 10px", borderRadius: 6, cursor: "pointer", fontFamily: mn, fontSize: 10, fontWeight: 700, background: on ? C.amber + "20" : "transparent", color: on ? C.amber : C.txm, border: "1px solid " + (on ? C.amber + "55" : "transparent"), letterSpacing: 0.5 }}>{o.l}</span>;
      })}
    </div>
  );
}

// Toggle — proper button styling with hover state + tooltip
function Toggle({ on, onChange, label, title }: { on: boolean; onChange: (v: boolean) => void; label: string; title?: string }) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={() => onChange(!on)}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      title={title || (on ? "Hide " + label : "Show " + label)}
      style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        padding: "6px 11px", borderRadius: 6, cursor: "pointer",
        fontFamily: mn, fontSize: 10, fontWeight: 700,
        background: on
          ? (hov ? C.amber + "26" : C.amber + "18")
          : (hov ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.025)"),
        color: on ? C.amber : (hov ? C.tx : C.txm),
        border: "1px solid " + (on ? C.amber + "55" : (hov ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.10)")),
        letterSpacing: 0.5, transition: "all 0.14s ease",
        boxShadow: on && hov ? "0 0 0 1px " + C.amber + "30" : "none",
      }}
    >
      {on ? <Eye size={11} strokeWidth={2.2} /> : <EyeOff size={11} strokeWidth={2} />}
      {label}
    </button>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// WELCOME SCREEN · paginated first-visit tutorial. 5 steps with Next/Back +
// "Don't show again" checkbox on the final step. Honors `cm2-welcome-seen-v1`
// in localStorage. Re-openable from the green "?!" button bottom-right.
// ═══════════════════════════════════════════════════════════════════════════

interface WelcomeStep {
  title: string;
  body: string;
  bullets: string[];
  Icon: LucideIcon;
  accent: string;
  cta?: { label: string; action: "wheel" | "shortcuts" };
}

const WELCOME_STEPS: WelcomeStep[] = [
  {
    title: "Welcome to Chart Maker 2",
    body: "A professional chart builder for SemiAnalysis decks. Pick a type, drop in data, annotate, export — fully in browser.",
    bullets: [
      "16 chart types · waterfall, mekko, gantt, scatter, variance",
      "Drag bars to edit values directly on the chart",
      "LibreOffice-style spreadsheet with formulas (=SUM, =VLOOKUP, =INDEX)",
      "Light/dark backdrops · 4 SemiAnalysis-branded color systems",
    ],
    Icon: Sparkles,
    accent: "#F7B041",
  },
  {
    title: "The Type Wheel",
    body: "Click TYPE WHEEL (or press W) to open the radial chart-type picker. 16 wedges grouped by family. Click any wedge to switch instantly.",
    bullets: [
      "Amber wedges = column charts (stacked, clustered, waterfall)",
      "Cobalt = line + area charts",
      "Mint = mekko + percent charts",
      "Coral = scatter, gantt, pie",
    ],
    Icon: BarChart3,
    accent: "#F7B041",
    cta: { label: "Open Type Wheel", action: "wheel" },
  },
  {
    title: "Click to Select · Right-Click for the Wheel",
    body: "Wave 11 is a major paradigm shift. Click any bar, segment, or point to SELECT it (it shows an amber glow + handles). Then drag the top handle to resize, or right-click for the radial wheel of context tools.",
    bullets: [
      "Click bar / point → glow outline + selection handles appear",
      "Drag the TOP HANDLE to resize the value (not the body)",
      "Right-click selected element → radial wheel of icons around the cursor",
      "Press M while selected = open wheel · Esc deselects · click empty canvas deselects",
      "Click an empty area → canvas-context wheel (gridlines, totals, theme)",
    ],
    Icon: Palette,
    accent: "#0B86D1",
  },
  {
    title: "The Data Sheet",
    body: "Edit values inline like a spreadsheet. Type formulas with =. Switch to Slider mode for instant value scrubbing. Use Table 2 tab for multi-table charts (FLOPs).",
    bullets: [
      "=SUM(A1:A5) · =AVG · =MAX · =MIN · =COUNT · =PRODUCT",
      "=VLOOKUP · =HLOOKUP · =INDEX · =MATCH · =SUMIF · =COUNTIF",
      "=IF(cond, then, else) · =IFERROR(value, fallback)",
      "Use $ for absolute refs: =$A$1 · =$A1 · =A$1",
    ],
    Icon: FileCode2,
    accent: "#2EAD8E",
  },
  {
    title: "Excel-grade table + Expanded mode",
    body: "Upload .xlsx files to import data. Click row numbers to select rows. Toggle 'Chart selected only' to chart a subset. Press Maximize for the full webapp.",
    bullets: [
      "Single click element → handles appear; double-click → format popup",
      "Alt + drag any number input → scrub the value (Shift = fine grain)",
      "IMPORT EXCEL button → pick .xlsx → choose tab → preview → import",
      "Expanded mode → full Properties panel + Chart/Table/Split layout",
      "Click row numbers to select rows · Shift+click extends · Cmd/Ctrl+click toggles",
      "Toggle EXCEL SUITE in Launch mode for a full Univer-powered spreadsheet — multi-sheet, real formulas, freeze panes, conditional formatting",
    ],
    Icon: Maximize2,
    accent: "#0B86D1",
  },
  {
    title: "Tips & Tricks",
    body: "A few power-user moves that will save you hours. Press ? anytime to open the full keyboard reference.",
    bullets: [
      "W · type wheel · M · radial context wheel for the current selection",
      "Esc · deselect / close any overlay · ? · keyboard shortcut overlay",
      "⌘Z undo · ⌘⇧Z redo · drag the top handle of a selected bar to resize",
      "Alt + drag a number cell to scrub the value · paste TSV/CSV from Excel",
      "Mekko: click a column then drag its right edge to resize column width",
      "Lock 🔒 mode prevents accidental edits while you style",
    ],
    Icon: Keyboard,
    accent: "#E06347",
    cta: { label: "Open Shortcuts", action: "shortcuts" },
  },
];

function WelcomeScreen({
  onClose,
  onOpenWheel,
  onOpenShortcuts,
}: {
  onClose: (dontShowAgain: boolean) => void;
  onOpenWheel: () => void;
  onOpenShortcuts: () => void;
}) {
  const [step, setStep] = useState(0);
  const [dontShow, setDontShow] = useState(true);
  const cur = WELCOME_STEPS[step];
  const isLast = step === WELCOME_STEPS.length - 1;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose(dontShow);
      if (e.key === "ArrowRight") setStep(s => Math.min(WELCOME_STEPS.length - 1, s + 1));
      if (e.key === "ArrowLeft") setStep(s => Math.max(0, s - 1));
      if (e.key === "Enter" && isLast) onClose(dontShow);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dontShow, isLast, onClose]);
  return (
    <div
      onClick={() => onClose(dontShow)}
      style={{
        position: "fixed", inset: 0, zIndex: 13000,
        background: "rgba(6,6,12,0.78)",
        backdropFilter: "blur(14px) saturate(140%)",
        WebkitBackdropFilter: "blur(14px) saturate(140%)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 20,
        animation: "cm2WelcomeFade 0.28s cubic-bezier(.2,.7,.2,1) both",
      }}
    >
      <style>{`
        @keyframes cm2WelcomeFade { from { opacity: 0 } to { opacity: 1 } }
        @keyframes cm2WelcomePop { from { opacity: 0; transform: scale(0.94) translateY(12px) } to { opacity: 1; transform: scale(1) translateY(0) } }
        @keyframes cm2WelcomeIcon { 0%,100% { transform: scale(1) rotate(0deg) } 50% { transform: scale(1.04) rotate(-2deg) } }
      `}</style>
      <div
        onClick={e => e.stopPropagation()}
        style={{
          position: "relative",
          width: "min(720px, 96vw)",
          background: "linear-gradient(180deg, #11111A 0%, #0A0A12 100%)",
          border: "1px solid rgba(255,255,255,0.10)",
          borderRadius: 18,
          boxShadow: "0 32px 80px rgba(0,0,0,0.65), 0 0 0 1px " + cur.accent + "20, 0 0 80px " + cur.accent + "18",
          overflow: "hidden",
          animation: "cm2WelcomePop 0.32s cubic-bezier(.2,.7,.2,1) both",
        }}
      >
        {/* gradient halo top */}
        <div style={{
          position: "absolute", top: -160, left: -40, right: -40, height: 280, pointerEvents: "none",
          background: `radial-gradient(ellipse at center, ${cur.accent}30 0%, ${cur.accent}10 30%, transparent 70%)`,
          transition: "all 0.4s ease",
        }} />
        {/* close + skip */}
        <button
          onClick={() => onClose(dontShow)}
          title="Skip · Esc"
          style={{
            position: "absolute", top: 14, right: 14, zIndex: 2,
            width: 32, height: 32, borderRadius: 8,
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
            color: C.txm, cursor: "pointer",
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            transition: "all 0.16s",
          }}
          onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.08)"; e.currentTarget.style.color = C.tx; }}
          onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.04)"; e.currentTarget.style.color = C.txm; }}
        >
          <XIcon size={15} strokeWidth={2.4} />
        </button>

        <div style={{ padding: "44px 44px 22px", position: "relative", zIndex: 1 }}>
          {/* hero illustration · animated SVG per step */}
          <div style={{
            width: 144, height: 144, borderRadius: 18,
            background: `linear-gradient(135deg, rgba(255,255,255,0.04), rgba(255,255,255,0.01))`,
            border: "1px solid " + cur.accent + "30",
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            marginBottom: 18,
            boxShadow: `0 16px 40px ${cur.accent}28, 0 0 0 1px rgba(255,255,255,0.06) inset`,
            position: "relative", overflow: "hidden",
          }}>
            <div style={{ position: "absolute", inset: 0, background: `radial-gradient(circle at center, ${cur.accent}18 0%, transparent 70%)`, pointerEvents: "none" }} />
            <WelcomeIllustration stepIdx={step} accent={cur.accent} />
          </div>
          {/* step counter */}
          <div style={{ fontFamily: mn, fontSize: 9, color: cur.accent, letterSpacing: 1.6, fontWeight: 800, marginBottom: 10, textTransform: "uppercase" }}>
            Step {step + 1} of {WELCOME_STEPS.length}
          </div>
          {/* title */}
          <div style={{
            fontFamily: gf, fontSize: 30, fontWeight: 900,
            color: "#E8E4DD", letterSpacing: -0.6, marginBottom: 10, lineHeight: 1.1,
          }}>{cur.title}</div>
          {/* body */}
          <div style={{ fontFamily: ft, fontSize: 14, color: C.txm, lineHeight: 1.55, marginBottom: 22, maxWidth: 580 }}>
            {cur.body}
          </div>
          {/* bullets */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 24 }}>
            {cur.bullets.map((b, i) => (
              <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 12, fontFamily: ft, fontSize: 12.5, color: "#E8E4DD", lineHeight: 1.5 }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: cur.accent, marginTop: 7, flexShrink: 0, boxShadow: `0 0 8px ${cur.accent}80` }} />
                <span>{b}</span>
              </div>
            ))}
          </div>
          {cur.cta && (
            <button
              onClick={() => cur.cta!.action === "wheel" ? onOpenWheel() : onOpenShortcuts()}
              style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                padding: "10px 16px", borderRadius: 9,
                background: cur.accent + "18",
                border: "1px solid " + cur.accent + "60",
                color: cur.accent,
                fontFamily: mn, fontSize: 11, fontWeight: 800, letterSpacing: 0.6,
                cursor: "pointer", transition: "all 0.16s",
                marginBottom: 8,
              }}
              onMouseEnter={e => { e.currentTarget.style.background = cur.accent + "30"; e.currentTarget.style.boxShadow = `0 6px 20px ${cur.accent}40`; }}
              onMouseLeave={e => { e.currentTarget.style.background = cur.accent + "18"; e.currentTarget.style.boxShadow = "none"; }}
            >
              {cur.cta.label} →
            </button>
          )}
        </div>

        {/* footer · pagination dots + actions */}
        <div style={{
          padding: "16px 28px",
          borderTop: "1px solid rgba(255,255,255,0.06)",
          background: "rgba(0,0,0,0.20)",
          display: "flex", alignItems: "center", gap: 14,
        }}>
          {/* dots */}
          <div style={{ display: "flex", gap: 6 }}>
            {WELCOME_STEPS.map((_, i) => (
              <button
                key={i}
                onClick={() => setStep(i)}
                title={`Step ${i + 1}`}
                style={{
                  width: i === step ? 24 : 8, height: 8, borderRadius: 999,
                  background: i === step ? cur.accent : (i < step ? cur.accent + "55" : "rgba(255,255,255,0.12)"),
                  border: "none", cursor: "pointer",
                  transition: "all 0.22s cubic-bezier(.2,.7,.2,1)",
                  boxShadow: i === step ? `0 0 12px ${cur.accent}80` : "none",
                }}
              />
            ))}
          </div>
          <span style={{ flex: 1 }} />
          {/* dont-show-again on last step */}
          {isLast && (
            <label style={{ display: "inline-flex", alignItems: "center", gap: 7, cursor: "pointer", fontFamily: mn, fontSize: 10, color: C.txm, letterSpacing: 0.5, userSelect: "none" }}>
              <input type="checkbox" checked={dontShow} onChange={e => setDontShow(e.target.checked)} style={{ accentColor: cur.accent, width: 14, height: 14 }} />
              Don&apos;t show again
            </label>
          )}
          {/* back / next / done */}
          {step > 0 && (
            <button
              onClick={() => setStep(s => Math.max(0, s - 1))}
              style={{
                padding: "9px 14px", borderRadius: 8,
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.10)",
                color: C.txm,
                fontFamily: mn, fontSize: 10, fontWeight: 800, letterSpacing: 0.6,
                cursor: "pointer", transition: "all 0.14s",
              }}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.08)"; e.currentTarget.style.color = C.tx; }}
              onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.04)"; e.currentTarget.style.color = C.txm; }}
            >← BACK</button>
          )}
          {!isLast ? (
            <button
              onClick={() => setStep(s => Math.min(WELCOME_STEPS.length - 1, s + 1))}
              style={{
                padding: "10px 18px", borderRadius: 8,
                background: `linear-gradient(135deg, ${cur.accent} 0%, ${cur.accent}cc 100%)`,
                border: "1px solid " + cur.accent + "88",
                color: "#0A0A0E",
                fontFamily: mn, fontSize: 10, fontWeight: 900, letterSpacing: 0.8,
                cursor: "pointer", transition: "all 0.16s",
                boxShadow: `0 6px 18px ${cur.accent}55, 0 1px 0 rgba(255,255,255,0.20) inset`,
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.boxShadow = `0 10px 26px ${cur.accent}66, 0 1px 0 rgba(255,255,255,0.20) inset`; }}
              onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = `0 6px 18px ${cur.accent}55, 0 1px 0 rgba(255,255,255,0.20) inset`; }}
            >NEXT →</button>
          ) : (
            <button
              onClick={() => onClose(dontShow)}
              style={{
                padding: "10px 22px", borderRadius: 8,
                background: `linear-gradient(135deg, ${cur.accent} 0%, ${cur.accent}cc 100%)`,
                border: "1px solid " + cur.accent + "88",
                color: "#0A0A0E",
                fontFamily: mn, fontSize: 10, fontWeight: 900, letterSpacing: 0.8,
                cursor: "pointer", transition: "all 0.16s",
                boxShadow: `0 6px 18px ${cur.accent}55, 0 1px 0 rgba(255,255,255,0.20) inset`,
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-1px)"; }}
              onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; }}
            >GET STARTED →</button>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// WHEEL SETTINGS MODAL · Wave 12 · lets the user pick which icons appear in
// the radial wheel for each element kind. Persists to localStorage. The
// `wheelConfig` map stores `kind -> string[] | "all"` where the strings are
// tool IDs. Default = "all" (every tool enabled).
// ═══════════════════════════════════════════════════════════════════════════

interface WheelToolDef { id: string; label: string; }
const WHEEL_TOOLS_BY_KIND: Record<string, WheelToolDef[]> = {
  segment: [
    { id: "fill", label: "Fill color" },
    { id: "totalLabels", label: "Total labels" },
    { id: "segmentLabels", label: "Segment labels" },
    { id: "cagr", label: "CAGR arrow" },
    { id: "diff", label: "Diff arrow" },
    { id: "totalDiff", label: "Total diff arrow" },
    { id: "seriesCagr", label: "Series CAGR badge" },
    { id: "refLine", label: "Reference line" },
    { id: "callout", label: "Callout text" },
    { id: "roundedCorners", label: "Rounded corners" },
    { id: "endLabels", label: "End labels" },
    { id: "swap", label: "Swap with adjacent" },
    { id: "delete", label: "Set to 0" },
  ],
  point: [
    { id: "fill", label: "Fill color" },
    { id: "endLabels", label: "End labels" },
    { id: "cagr", label: "CAGR arrow" },
    { id: "diff", label: "Diff arrow" },
    { id: "seriesCagr", label: "Series CAGR badge" },
    { id: "refLine", label: "Reference line" },
    { id: "marker", label: "Marker shape" },
    { id: "callout", label: "Callout text" },
    { id: "roundedCorners", label: "Rounded corners" },
    { id: "delete", label: "Set to 0" },
  ],
  axis: [
    { id: "logScale", label: "Log scale" },
    { id: "gridlines", label: "Gridlines" },
    { id: "ticks", label: "Tick marks" },
    { id: "axisBreak", label: "Axis break" },
    { id: "numFmt", label: "Number format" },
    { id: "tickStep", label: "Tick step" },
    { id: "direction", label: "Direction" },
  ],
  label: [
    { id: "numFmt", label: "Number format" },
    { id: "totalLabels", label: "Total labels" },
    { id: "hideLabels", label: "Hide labels" },
    { id: "content", label: "Cycle content" },
    { id: "position", label: "Cycle position" },
  ],
  mekkoColumn: [
    { id: "shiftLeft", label: "Shift left" },
    { id: "shiftRight", label: "Shift right" },
    { id: "delete", label: "Delete column" },
  ],
  canvas: [
    { id: "addSeries", label: "Add series" },
    { id: "typeWheel", label: "Type wheel" },
    { id: "gridlines", label: "Gridlines" },
    { id: "borders", label: "Borders" },
    { id: "totalLabels", label: "Total labels" },
    { id: "ticks", label: "Tick marks" },
    { id: "numFmt", label: "Number format" },
    { id: "theme", label: "Cycle theme" },
    { id: "reset", label: "Reset chart" },
    { id: "watermark", label: "Watermark cycle" },
    { id: "logScale", label: "Log scale" },
    { id: "axisBreak", label: "Axis break" },
    { id: "markerShape", label: "Marker shape" },
    { id: "roundedCorners", label: "Rounded corners" },
    { id: "endLabels", label: "End labels" },
    { id: "barWidth", label: "Bar width" },
    { id: "backdropMode", label: "Backdrop mode" },
  ],
};

function WheelSettingsModal({
  config, onChange, onClose,
}: {
  config: Record<string, string[] | "all">;
  onChange: (next: Record<string, string[] | "all">) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const isEnabled = (kind: string, id: string) => {
    const cur = config[kind];
    if (cur === undefined || cur === "all") return true;
    return cur.includes(id);
  };
  const toggleTool = (kind: string, id: string) => {
    const all = WHEEL_TOOLS_BY_KIND[kind].map(t => t.id);
    const cur = config[kind];
    const enabled = cur === undefined || cur === "all" ? all.slice() : cur.slice();
    const idx = enabled.indexOf(id);
    if (idx >= 0) enabled.splice(idx, 1);
    else enabled.push(id);
    // If everything is enabled, store "all" (compact form).
    const next = { ...config };
    if (enabled.length === all.length) next[kind] = "all";
    else next[kind] = enabled;
    onChange(next);
  };
  const resetAll = () => onChange({});
  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, zIndex: 12700,
      background: "rgba(6,6,12,0.74)",
      backdropFilter: "blur(10px)",
      WebkitBackdropFilter: "blur(10px)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 24,
      animation: "cm2WelcomeFade 0.2s cubic-bezier(.2,.7,.2,1) both",
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: "min(720px, 96vw)", maxHeight: "86vh", overflow: "auto",
        background: "linear-gradient(180deg, #11111A 0%, #0A0A12 100%)",
        border: "1px solid rgba(255,255,255,0.10)",
        borderRadius: 16, padding: "24px 28px",
        boxShadow: "0 32px 80px rgba(0,0,0,0.60), 0 0 0 1px " + C.amber + "20",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <Settings size={18} strokeWidth={2.2} color={C.amber} />
          <span style={{ fontFamily: gf, fontSize: 18, fontWeight: 900, color: "#E8E4DD", letterSpacing: -0.3 }}>Customize Radial Wheel</span>
          <span style={{ marginLeft: "auto", cursor: "pointer", color: C.txm, padding: 4, display: "inline-flex" }} onClick={onClose}><XIcon size={16} /></span>
        </div>
        <div style={{ fontFamily: ft, fontSize: 12, color: C.txm, marginBottom: 18, lineHeight: 1.5 }}>
          Pick which tools appear in the radial wheel when you right-click each element kind. Disabled tools won&apos;t crowd your wheel.
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {(Object.entries(WHEEL_TOOLS_BY_KIND) as [string, WheelToolDef[]][]).map(([kind, tools]) => (
            <div key={kind} style={{ padding: 14, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10 }}>
              <div style={{ fontFamily: mn, fontSize: 9, color: C.amber, letterSpacing: 1.4, textTransform: "uppercase", fontWeight: 800, marginBottom: 10 }}>{kind}</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {tools.map(t => {
                  const on = isEnabled(kind, t.id);
                  return (
                    <button
                      key={t.id}
                      onClick={() => toggleTool(kind, t.id)}
                      style={{
                        padding: "6px 12px", borderRadius: 6,
                        background: on ? C.amber + "20" : "rgba(255,255,255,0.03)",
                        border: "1px solid " + (on ? C.amber + "55" : "rgba(255,255,255,0.10)"),
                        color: on ? C.amber : C.txm,
                        fontFamily: mn, fontSize: 10, fontWeight: 800, letterSpacing: 0.5,
                        cursor: "pointer", transition: "all 0.14s",
                      }}
                    >{on ? "✓ " : ""}{t.label}</button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 18, display: "flex", gap: 10, alignItems: "center" }}>
          <button
            onClick={resetAll}
            style={{
              padding: "9px 14px", borderRadius: 8,
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.10)",
              color: C.tx, fontFamily: mn, fontSize: 10, fontWeight: 800, letterSpacing: 0.6,
              cursor: "pointer",
            }}
          >RESET TO DEFAULT</button>
          <span style={{ flex: 1 }} />
          <button
            onClick={onClose}
            style={{
              padding: "9px 16px", borderRadius: 8,
              background: "linear-gradient(135deg, " + C.amber + ", #E8A020)",
              border: "1px solid " + C.amber + "88",
              color: "#0A0A0E", fontFamily: mn, fontSize: 10, fontWeight: 900, letterSpacing: 0.8,
              cursor: "pointer",
              boxShadow: "0 6px 18px " + C.amber + "55",
            }}
          >DONE</button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// UNIVER SHEET PANE · Wave 14.2 · Full Excel-grade spreadsheet (Univer)
// embedded inside the Launch-mode table pane when the user toggles
// EXCEL SUITE. Univer brings a real Excel-compatible formula engine,
// multi-sheet workbooks, formula bar with autocomplete, freeze panes,
// find/replace, conditional formatting, and native xlsx I/O.
//
// Loading model: the @univerjs/* JS bundle is ~3 MB. We lazy-load it via
// `await import()` inside a useEffect so the cost only materializes when
// a user actually flips to EXCEL SUITE. The CSS (~80 KB) is imported at
// the top of this file because Next.js doesn't reliably code-split CSS
// from dynamic JS imports — and 80 KB on the chart route is a fair price
// for instant styled-up rendering on toggle.
//
// Bridging to DataSheet: on init, we project the existing DataSheet shape
// (schema + rows) onto a Univer workbook (row 0 = headers, rows 1..N =
// data). On every SheetValueChanged event we read back the cell matrix
// and reconstruct a DataSheet so the chart re-renders. Column types are
// preserved from the original schema; new values are coerced (number if
// the original column was numeric, otherwise string).
// ═══════════════════════════════════════════════════════════════════════════
function UniverSheetPane({
  initialSheet,
  onChange,
}: {
  initialSheet: DataSheet;
  onChange: (s: DataSheet) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  // Hold the Univer instance + workbook so we can dispose them on unmount.
  // Typed `any` because the Univer Facade types span ~12 packages and
  // change between point releases — pinning the surface here would create
  // brittle imports for what is, behaviorally, a stable plugin handshake.
  const univerRef = useRef<any>(null);
  const workbookRef = useRef<any>(null);
  const onChangeRef = useRef(onChange);
  // Schema must be remembered across renders because we project Univer's
  // raw cell matrix back onto the DataSheet schema on every edit. We also
  // need the original column order so the chart wires up correctly.
  const schemaRef = useRef(initialSheet.schema);
  // Suppress the change handler while we apply the initial workbook —
  // otherwise creating the workbook would fire SheetValueChanged and
  // overwrite the chart-config sheet with our own data.
  const suppressChangeRef = useRef(true);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  // Keep the latest onChange in a ref — Univer's event subscription is
  // installed once at mount and we don't want to tear it down on every
  // parent re-render.
  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!containerRef.current) return;

    let disposed = false;
    let disposeEvent: { dispose: () => void } | null = null;

    (async () => {
      try {
        // Dynamic imports — only fetched when the user flips to EXCEL SUITE.
        const presetsMod = await import("@univerjs/presets");
        const sheetsCoreMod = await import("@univerjs/preset-sheets-core");
        // The locale ships as a default-export object. We accept either
        // shape (default export or namespace) to survive package re-bundles.
        const enUSMod: any = await import("@univerjs/preset-sheets-core/locales/en-US");

        if (disposed || !containerRef.current) return;

        const { createUniver, LocaleType, mergeLocales } = presetsMod as any;
        const { UniverSheetsCorePreset } = sheetsCoreMod as any;
        const enUSLocale = (enUSMod && (enUSMod.default ?? enUSMod)) as Record<string, unknown>;

        const { univer, univerAPI } = createUniver({
          locale: LocaleType.EN_US,
          locales: {
            [LocaleType.EN_US]: mergeLocales(enUSLocale),
          },
          presets: [
            UniverSheetsCorePreset({ container: containerRef.current }),
          ],
        });
        univerRef.current = univer;

        // Build initial workbook data from the DataSheet. Row 0 holds the
        // bold-styled headers; rows 1..N hold the values.
        const headerRow: Record<number, { v: string | number; s?: any }> = {};
        initialSheet.schema.forEach((col, c) => {
          headerRow[c] = { v: col.label, s: { bl: 1 } };
        });
        const cellData: Record<number, Record<number, { v: string | number }>> = { 0: headerRow };
        initialSheet.rows.forEach((row, r) => {
          const out: Record<number, { v: string | number }> = {};
          initialSheet.schema.forEach((col, c) => {
            const v = row[col.key];
            if (v !== undefined && v !== "" && v !== null) {
              out[c] = { v: typeof v === "number" ? v : String(v) };
            }
          });
          cellData[r + 1] = out;
        });

        const rowCount = Math.max(50, initialSheet.rows.length + 20);
        const columnCount = Math.max(20, initialSheet.schema.length + 5);

        const workbook = univerAPI.createWorkbook({
          id: "cm2-univer-workbook",
          name: "Chart Data",
          sheetOrder: ["cm2-sheet"],
          sheets: {
            "cm2-sheet": {
              id: "cm2-sheet",
              name: "Data",
              cellData,
              rowCount,
              columnCount,
            },
          },
        });
        workbookRef.current = workbook;

        // Subscribe to value changes. The Facade fires SheetValueChanged
        // for both user edits and programmatic edits (incl. the workbook
        // creation we just did), so we filter via suppressChangeRef.
        if (univerAPI && typeof univerAPI.addEvent === "function" && univerAPI.Event) {
          disposeEvent = univerAPI.addEvent(univerAPI.Event.SheetValueChanged, () => {
            if (suppressChangeRef.current) return;
            try {
              const target = univerAPI.getActiveSheet();
              if (!target) return;
              const ws = target.worksheet;
              const schema = schemaRef.current;
              // Read the data block (rows 1..rowCount-1, cols 0..schema.length-1).
              const range = ws.getRange(1, 0, Math.max(1, rowCount - 1), schema.length);
              const values: any[][] = range.getValues() || [];
              const newRows: Array<Record<string, CellValue>> = [];
              for (const row of values) {
                if (!row) continue;
                // Skip rows that are entirely null/empty.
                const nonEmpty = row.some(v => v !== null && v !== undefined && v !== "");
                if (!nonEmpty) continue;
                const out: Record<string, CellValue> = {};
                schema.forEach((col, c) => {
                  const raw = row[c];
                  if (raw === null || raw === undefined) {
                    out[col.key] = col.type === "number" || col.type === "percent" ? 0 : "";
                    return;
                  }
                  if (col.type === "number" || col.type === "percent") {
                    const n = typeof raw === "number" ? raw : Number(String(raw).replace(/[^0-9.\-eE]/g, ""));
                    out[col.key] = Number.isFinite(n) ? n : 0;
                  } else {
                    out[col.key] = String(raw);
                  }
                });
                newRows.push(out);
              }
              onChangeRef.current({ schema, rows: newRows });
            } catch {
              // Read failures are non-fatal — the user keeps editing,
              // the chart just won't update for this tick.
            }
          });
        }

        // Release the suppression on the next tick so the initial
        // workbook-creation events have already drained.
        setTimeout(() => { if (!disposed) suppressChangeRef.current = false; }, 0);

        if (!disposed) setStatus("ready");
      } catch (e) {
        if (disposed) return;
        const msg = e instanceof Error ? e.message : String(e);
        setErrorMsg(msg);
        setStatus("error");
        // eslint-disable-next-line no-console
        console.error("[ChartMaker2] Univer init failed:", e);
      }
    })();

    return () => {
      disposed = true;
      try { disposeEvent?.dispose(); } catch {}
      try { univerRef.current?.dispose?.(); } catch {}
      univerRef.current = null;
      workbookRef.current = null;
    };
    // We deliberately mount Univer once. Schema/rows changes are not
    // propagated back into the workbook after init — Univer becomes the
    // source of truth while EXCEL SUITE is active.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%", minHeight: 0, background: "#FAFAF7", borderRadius: 8, overflow: "hidden" }}>
      {status === "loading" && (
        <div style={{
          position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
          flexDirection: "column", gap: 8, color: C.txm, fontFamily: mn, fontSize: 10, letterSpacing: 1.2, textTransform: "uppercase",
          background: "rgba(13,13,18,0.55)",
        }}>
          <Sparkles size={18} strokeWidth={2.4} color={C.amber} />
          <span>Loading Excel Suite…</span>
          <span style={{ fontSize: 9, color: C.txm, letterSpacing: 0.6, textTransform: "none" }}>Univer · ~3 MB · first load only</span>
        </div>
      )}
      {status === "error" && (
        <div style={{
          position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
          flexDirection: "column", gap: 6, padding: 24, color: "#E06347", fontFamily: ft, fontSize: 12,
          textAlign: "center",
        }}>
          <span style={{ fontWeight: 800 }}>Excel Suite failed to initialize</span>
          <span style={{ color: C.txm, fontSize: 11 }}>Falling back to Standard table is recommended.</span>
          {errorMsg && <span style={{ color: C.txm, fontSize: 10, fontFamily: mn, opacity: 0.8 }}>{errorMsg}</span>}
        </div>
      )}
      <div ref={containerRef} style={{ position: "absolute", inset: 0 }} />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPANDED SHELL · Wave 12 · full-viewport overlay containing a top bar
// (Chart / Table / Split / Compact / Export), left chart-type sidebar,
// middle pane (chart-only / table-only / split with draggable splitter),
// and a sticky right Properties pane. Splitter drag updates `splitterPos`.
// ═══════════════════════════════════════════════════════════════════════════

function ExpandedShell({
  onClose,
  paneMode, onChangePaneMode,
  splitOrientation, onChangeSplitOrientation,
  splitterPos, onChangeSplitterPos,
  chartType, onChangeChartType,
  themeName, paletteColors,
  chartCard, dataSheet,
  propsPanel,
  transitionFrom,
  topBarExtras, topBarRightExtras,
  chartZoom, onChangeChartZoom,
  tableMode, onChangeTableMode,
  floatingTablePos, onChangeFloatingTablePos,
  floatToolbar, showToolbarBtn,
}: {
  onClose: () => void;
  paneMode: "chart" | "table" | "split";
  onChangePaneMode: (m: "chart" | "table" | "split") => void;
  splitOrientation: "vertical" | "horizontal";
  onChangeSplitOrientation: (o: "vertical" | "horizontal") => void;
  splitterPos: number;
  onChangeSplitterPos: (p: number) => void;
  chartType: ChartType;
  onChangeChartType: (t: ChartType) => void;
  themeName: string;
  paletteColors: string[];
  chartCard: React.ReactNode;
  dataSheet: React.ReactNode;
  // Wave 13 · right-side Properties panel (collapsible).
  propsPanel?: React.ReactNode;
  // Wave 14 · captured anchor for FLIP-style scale-from-button morph
  transitionFrom?: { x: number; y: number } | null;
  // Wave 15 · full toolbar groups (FILE/EDIT/INSERT/FORMAT) injected from
  // the parent so Launch shares the exact same controls as Compact mode.
  topBarExtras?: React.ReactNode;
  // Wave 15 · right-edge utilities (sound, theme, export download icon).
  topBarRightExtras?: React.ReactNode;
  // Wave 15 · zoom + table-mode controls live in the top bar; the parent
  // owns state so it survives Launch open/close.
  chartZoom: "fit" | number;
  onChangeChartZoom: (z: "fit" | number) => void;
  tableMode: "docked" | "floating" | "window";
  onChangeTableMode: (m: "docked" | "floating" | "window") => void;
  floatingTablePos: { x: number; y: number; w: number; h: number };
  onChangeFloatingTablePos: (p: { x: number; y: number; w: number; h: number }) => void;
  // Wave 15.1 · floating toolbar overlay rendered absolutely inside the
  // shell so it stays above the chart but inside the Launch portal.
  floatToolbar?: React.ReactNode;
  // Wave 15.1 · "Show Toolbar" button injected into the Window group when
  // the float toolbar has been closed.
  showToolbarBtn?: React.ReactNode;
}) {
  void themeName; void paletteColors;
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const middleRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef(false);
  // Splitter drag handler — pointer-capturing on the splitter element.
  const onSplitterDown = (e: React.PointerEvent) => {
    e.preventDefault();
    draggingRef.current = true;
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
  };
  const onSplitterMove = (e: React.PointerEvent) => {
    if (!draggingRef.current) return;
    const box = middleRef.current?.getBoundingClientRect();
    if (!box) return;
    const ratio = splitOrientation === "vertical"
      ? (e.clientX - box.left) / Math.max(1, box.width)
      : (e.clientY - box.top) / Math.max(1, box.height);
    onChangeSplitterPos(Math.max(0.20, Math.min(0.80, ratio)));
  };
  const onSplitterUp = () => { draggingRef.current = false; };

  // Top-bar pill button helper
  const TabBtn = ({ active, onClick, Icon, label, title }: { active: boolean; onClick: () => void; Icon: LucideIconCmp; label: string; title?: string }) => {
    const [hov, setHov] = useState(false);
    return (
      <button
        onClick={onClick}
        title={title}
        onMouseEnter={() => setHov(true)}
        onMouseLeave={() => setHov(false)}
        style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          padding: "7px 12px", borderRadius: 8,
          background: active ? C.amber + "26" : (hov ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.03)"),
          border: "1px solid " + (active ? C.amber + "70" : (hov ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.10)")),
          color: active ? C.amber : (hov ? "#E8E4DD" : C.txm),
          fontFamily: mn, fontSize: 10, fontWeight: 800, letterSpacing: 0.6,
          cursor: "pointer", transition: "all 0.16s cubic-bezier(.2,.7,.2,1)",
          textTransform: "uppercase",
        }}
      >
        <Icon size={12} strokeWidth={2.4} />
        {label}
      </button>
    );
  };

  // Click handler for the SPLIT button — first press goes to split, while
  // already in split toggles vertical ↔ horizontal orientation.
  const onSplitClick = () => {
    if (paneMode !== "split") {
      onChangePaneMode("split");
    } else {
      onChangeSplitOrientation(splitOrientation === "vertical" ? "horizontal" : "vertical");
    }
  };

  // Wave 15 · When the table is floating or in a separate browser window,
  // the docked split layout collapses to chart-only (the table is shown
  // elsewhere). Same for table-only paneMode + floating mode.
  const tableIsDetached = tableMode === "floating" || tableMode === "window";
  const effectivePaneMode: "chart" | "table" | "split" =
    tableIsDetached && (paneMode === "split" || paneMode === "table") ? "chart" : paneMode;

  // Chart-only / table-only render the appropriate pane filling the middle.
  // Split renders both with a 5px draggable splitter between them.
  const middleContent = (() => {
    if (effectivePaneMode === "chart") {
      return (
        <div style={{ flex: 1, minHeight: 0, overflow: "auto", padding: "20px 22px", display: "flex" }}>
          <div style={{ flex: 1, minWidth: 0, alignSelf: "flex-start", width: "100%" }}>{chartCard}</div>
        </div>
      );
    }
    if (effectivePaneMode === "table") {
      return (
        <div style={{ flex: 1, minHeight: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}>{dataSheet}</div>
      );
    }
    // SPLIT mode
    const isV = splitOrientation === "vertical";
    return (
      <div
        ref={middleRef}
        style={{
          flex: 1, minHeight: 0, minWidth: 0,
          display: "flex",
          flexDirection: isV ? "row" : "column",
        }}
      >
        <div style={{
          flexBasis: `${splitterPos * 100}%`,
          flexShrink: 0,
          minWidth: 0, minHeight: 0,
          overflow: "auto",
          padding: "20px 22px",
        }}>
          {chartCard}
        </div>
        {/* Splitter */}
        <div
          onPointerDown={onSplitterDown}
          onPointerMove={onSplitterMove}
          onPointerUp={onSplitterUp}
          style={{
            width: isV ? 5 : "auto",
            height: isV ? "auto" : 5,
            background: draggingRef.current ? C.amber + "55" : "rgba(255,255,255,0.06)",
            cursor: isV ? "col-resize" : "row-resize",
            flexShrink: 0,
            transition: "background 0.16s",
          }}
          onMouseEnter={e => { e.currentTarget.style.background = C.amber + "66"; }}
          onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; }}
        />
        <div style={{
          flex: 1,
          minWidth: 0, minHeight: 0,
          display: "flex", flexDirection: "column",
        }}>
          {dataSheet}
        </div>
      </div>
    );
  })();

  const expandOrigin = transitionFrom ? `${transitionFrom.x}px ${transitionFrom.y}px` : "50% 50%";
  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 11000,
        background: "linear-gradient(180deg, #06060C 0%, #0A0A12 100%)",
        display: "flex", flexDirection: "column",
        animation: "cm2FlipMorph 0.5s cubic-bezier(.2,.7,.2,1) both",
        transformOrigin: expandOrigin,
        overflow: "hidden",
      }}
    >
      <AmbientParticles />
      <GrainOverlay />
      {/* Animated glow drift orbs (4 of them) — sit BEHIND content */}
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden", zIndex: 0 }}>
        <div style={{ position:"absolute", top:"-12%", right:"-6%", width:"55vw", height:"55vw", borderRadius:"50%",
          background:"radial-gradient(circle, rgba(247,176,65,0.07) 0%, transparent 60%)",
          animation:"cmGlowDrift1 22s ease-in-out infinite" }} />
        <div style={{ position:"absolute", bottom:"-15%", left:"8%", width:"60vw", height:"60vw", borderRadius:"50%",
          background:"radial-gradient(circle, rgba(11,134,209,0.06) 0%, transparent 60%)",
          animation:"cmGlowDrift2 28s ease-in-out infinite" }} />
        <div style={{ position:"absolute", top:"35%", left:"-12%", width:"42vw", height:"42vw", borderRadius:"50%",
          background:"radial-gradient(circle, rgba(46,173,142,0.05) 0%, transparent 60%)",
          animation:"cmGlowDrift3 32s ease-in-out infinite" }} />
        <div style={{ position:"absolute", top:"12%", right:"30%", width:"20vw", height:"20vw", borderRadius:"50%",
          background:"radial-gradient(circle, rgba(224,99,71,0.06) 0%, transparent 60%)",
          animation:"cmGlowDrift4 26s ease-in-out infinite" }} />
      </div>

      {/* TOP BAR · Wave 15 · full toolbar lives here so Launch is the
          ultimate tool. Two-row tall (78px) to host the ToolGroup labels. */}
      <div style={{
        position: "relative", zIndex: 2,
        minHeight: 78,
        display: "flex", alignItems: "center", gap: 10,
        padding: "8px 14px",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        background: "rgba(13,13,18,0.78)",
        backdropFilter: "blur(18px) saturate(140%)",
        WebkitBackdropFilter: "blur(18px) saturate(140%)",
        flexWrap: "wrap",
      }}>
        {/* POAST · CHART MAKER · LAUNCH brand block */}
        <div style={{ display: "inline-flex", flexDirection: "column", alignItems: "flex-start", gap: 2, paddingRight: 4 }}>
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            padding: "5px 10px", borderRadius: 7,
            background: "rgba(247,176,65,0.10)",
            border: "1px solid " + C.amber + "44",
          }}>
            <Rocket size={13} strokeWidth={2.4} color={C.amber} />
            <span style={{ fontFamily: gf, fontSize: 12, fontWeight: 900, color: "#E8E4DD", letterSpacing: -0.2 }}>POAST</span>
            <span style={{ fontFamily: ft, fontSize: 11, fontWeight: 800, color: C.amber, letterSpacing: 0.6 }}>· LAUNCH</span>
          </span>
          <span style={{ fontFamily: mn, fontSize: 7.5, color: C.txd, letterSpacing: 1.4, fontWeight: 800, opacity: 0.6, textTransform: "uppercase" }}>Chart Maker</span>
        </div>
        <Sep />

        {/* FILE / EDIT / INSERT / FORMAT — injected from parent (same controls
            as compact mode). */}
        {topBarExtras}
        <Sep />

        {/* VIEW group · pane tabs + zoom widget */}
        <ToolGroup label="View">
          <div style={{ display: "inline-flex", gap: 6 }}>
            <TabBtn active={paneMode === "chart"} onClick={() => onChangePaneMode("chart")} Icon={BarChart3} label="Chart" title="Chart only" />
            <TabBtn active={paneMode === "table"} onClick={() => onChangePaneMode("table")} Icon={Table} label="Table" title="Table only" />
            <TabBtn
              active={paneMode === "split"}
              onClick={onSplitClick}
              Icon={splitOrientation === "vertical" ? Columns2 : Rows2}
              label={paneMode === "split" ? (splitOrientation === "vertical" ? "Split V" : "Split H") : "Split"}
              title={paneMode === "split" ? "Toggle vertical / horizontal split" : "Open split view"}
            />
            <ZoomWidget zoom={chartZoom} onChange={onChangeChartZoom} />
          </div>
        </ToolGroup>

        <span style={{ flex: 1 }} />

        {/* RIGHT EDGE — sound, theme, export download icon */}
        {topBarRightExtras}
        <Sep />

        {/* Back to compact + table-mode picker. Table mode shows only when
            the user is actually viewing the table (paneMode = table or split). */}
        <ToolGroup label="Window">
          <div style={{ display: "inline-flex", gap: 6 }}>
            {showToolbarBtn}
            {(paneMode === "table" || paneMode === "split") && (
              <>
                <TabBtn
                  active={tableMode === "floating"}
                  onClick={() => onChangeTableMode(tableMode === "floating" ? "docked" : "floating")}
                  Icon={Maximize2}
                  label={tableMode === "floating" ? "Dock" : "Pop Out"}
                  title={tableMode === "floating" ? "Dock the table back into the layout" : "Pop the table out into a draggable floating window"}
                />
                <TabBtn
                  active={tableMode === "window"}
                  onClick={() => onChangeTableMode(tableMode === "window" ? "docked" : "window")}
                  Icon={Upload}
                  label={tableMode === "window" ? "Re-dock" : "New Window"}
                  title={tableMode === "window" ? "Close the popped browser window and dock the table back" : "Open the table in a separate browser window (BroadcastChannel sync · experimental)"}
                />
              </>
            )}
            <button
              onClick={onClose}
              title="Back to compact mode (Esc)"
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "7px 12px", borderRadius: 8,
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.10)",
                color: C.txm,
                fontFamily: mn, fontSize: 10, fontWeight: 800, letterSpacing: 0.6,
                cursor: "pointer", transition: "all 0.16s",
                textTransform: "uppercase",
              }}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.08)"; e.currentTarget.style.color = "#E8E4DD"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.04)"; e.currentTarget.style.color = C.txm; }}
            >
              <Minimize2 size={12} strokeWidth={2.4} />
              Compact
            </button>
          </div>
        </ToolGroup>
      </div>

      {/* MAIN GRID · LEFT (sidebar) | MIDDLE (chart/table/split) | RIGHT (props) */}
      <div style={{ position: "relative", zIndex: 1, flex: 1, minHeight: 0, display: "flex" }}>
        {/* LEFT — chart-type sidebar (collapsible) */}
        <div style={{
          width: leftCollapsed ? 44 : 240,
          flexShrink: 0,
          borderRight: "1px solid rgba(255,255,255,0.06)",
          background: "rgba(13,13,18,0.72)",
          backdropFilter: "blur(18px) saturate(140%)",
          WebkitBackdropFilter: "blur(18px) saturate(140%)",
          overflow: "hidden",
          display: "flex", flexDirection: "column",
          transition: "width 0.22s cubic-bezier(.2,.7,.2,1)",
        }}>
          <div style={{
            padding: "10px 12px",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
            display: "flex", alignItems: "center", gap: 6,
          }}>
            {!leftCollapsed && <span style={{ fontFamily: mn, fontSize: 9, color: C.amber, letterSpacing: 1.4, textTransform: "uppercase", fontWeight: 800, flex: 1 }}>Types</span>}
            <button
              onClick={() => setLeftCollapsed(v => !v)}
              title={leftCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              style={{
                width: 24, height: 24, borderRadius: 6,
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.10)",
                color: C.txm,
                cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center",
              }}
            >{leftCollapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}</button>
          </div>
          {!leftCollapsed && (
            <div style={{ overflowY: "auto", padding: 10, display: "flex", flexDirection: "column", gap: 4 }}>
              {TYPES.flat().map(spec => <ChartTypeRow key={spec.id} spec={spec} active={chartType === spec.id} onClick={() => onChangeChartType(spec.id)} />)}
            </div>
          )}
        </div>

        {/* MIDDLE pane(s) */}
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
          {middleContent}
        </div>

        {/* RIGHT — Properties panel (collapsible) */}
        {propsPanel && (
          <div style={{
            width: rightCollapsed ? 36 : 320,
            flexShrink: 0,
            borderLeft: "1px solid rgba(255,255,255,0.06)",
            background: "rgba(13,13,18,0.72)",
            backdropFilter: "blur(18px) saturate(140%)",
            WebkitBackdropFilter: "blur(18px) saturate(140%)",
            display: "flex", flexDirection: "column",
            transition: "width 0.22s cubic-bezier(.2,.7,.2,1)",
            overflow: "hidden",
          }}>
            <div style={{
              padding: "10px 12px",
              borderBottom: "1px solid rgba(255,255,255,0.06)",
              display: "flex", alignItems: "center", gap: 6,
            }}>
              <button
                onClick={() => setRightCollapsed(v => !v)}
                title={rightCollapsed ? "Expand properties" : "Collapse properties"}
                style={{
                  width: 24, height: 24, borderRadius: 6,
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.10)",
                  color: C.txm,
                  cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center",
                }}
              >{rightCollapsed ? <ChevronLeft size={12} /> : <ChevronRight size={12} />}</button>
              {!rightCollapsed && <span style={{ fontFamily: mn, fontSize: 9, color: C.amber, letterSpacing: 1.4, textTransform: "uppercase", fontWeight: 800, flex: 1 }}>Properties</span>}
            </div>
            {!rightCollapsed && (
              <div style={{ overflowY: "auto", flex: 1, padding: 12 }}>
                {propsPanel}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Wave 15.1 · Floating Launch toolbar — movable, pinnable, customizable.
          Sits above the chart and inside the Launch portal so it overlays the
          shell without escaping it. */}
      {floatToolbar}

      {/* Wave 15 · Floating table window — appears as a draggable, resizable
          panel over the shell. The docked split layout collapses to chart-only
          while floating so the full chart fills the middle pane. */}
      {tableMode === "floating" && (
        <FloatingTableWindow
          pos={floatingTablePos}
          onChangePos={onChangeFloatingTablePos}
          onClose={() => onChangeTableMode("docked")}
        >
          {dataSheet}
        </FloatingTableWindow>
      )}

      {/* Wave 15 · "Open in new browser window" mode (5b) — coming-soon
          placeholder banner. We keep state + UX wired up so when the
          BroadcastChannel pipeline lands, no compact-mode changes are
          needed. For now the table just stays docked-style; we surface a
          dismissible banner explaining the experimental status. */}
      {tableMode === "window" && (
        <NewWindowComingSoonBanner onDismiss={() => onChangeTableMode("docked")} />
      )}
    </div>
  );
}

// ─── Wave 15 · Coming-soon banner for "Open in new browser window" ──────
function NewWindowComingSoonBanner({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div style={{
      position: "fixed",
      left: "50%", bottom: 28,
      transform: "translateX(-50%)",
      zIndex: 12100,
      padding: "12px 18px",
      borderRadius: 12,
      background: "rgba(13,13,18,0.92)",
      backdropFilter: "blur(18px) saturate(140%)",
      WebkitBackdropFilter: "blur(18px) saturate(140%)",
      border: "1px solid " + C.amber + "55",
      boxShadow: "0 18px 40px rgba(0,0,0,0.55), 0 0 0 1px " + C.amber + "22",
      display: "flex", alignItems: "center", gap: 14,
      maxWidth: 540,
      animation: "cm2ExpandPop 0.22s cubic-bezier(.2,.7,.2,1) both",
    }}>
      <Upload size={16} strokeWidth={2.4} color={C.amber} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: mn, fontSize: 9, color: C.amber, letterSpacing: 1.3, textTransform: "uppercase", fontWeight: 800, marginBottom: 2 }}>New Window mode</div>
        <div style={{ fontFamily: ft, fontSize: 12, color: "#E8E4DD", lineHeight: 1.4 }}>
          Coming soon — the table will open in a separate browser window with live BroadcastChannel sync.
          For now use <strong style={{ color: C.amber }}>Pop Out</strong> for an in-app floating window.
        </div>
      </div>
      <button
        onClick={onDismiss}
        title="Dismiss"
        style={{
          width: 24, height: 24, borderRadius: 6,
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.10)",
          color: C.txm,
          cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center",
        }}
      ><XIcon size={12} /></button>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════════════
// WAVE 14 · BEAUTIFICATION INFRASTRUCTURE
// Tooltip · ColorPicker · MiniChartPreview · OnboardingTour · SoundManager ·
// GrainOverlay · AmbientParticles · WelcomeIllustration · theme tokens ·
// custom cursors · FLIP transition helpers
// ═══════════════════════════════════════════════════════════════════════════

// ─── Theme tokens ─────────────────────────────────────────────────────────
type AppTheme = "dark" | "light";
interface AppThemeTokens {
  bg: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  fg: string;
  fgMuted: string;
  fgDim: string;
}
const APP_TOKENS: Record<AppTheme, AppThemeTokens> = {
  dark: {
    bg: "#06060C",
    surface: "rgba(13,13,18,0.72)",
    surfaceAlt: "rgba(255,255,255,0.04)",
    border: "rgba(255,255,255,0.08)",
    fg: "#E8E4DD",
    fgMuted: "rgba(232,228,221,0.65)",
    fgDim: "rgba(232,228,221,0.40)",
  },
  light: {
    bg: "#FAFAF7",
    surface: "rgba(255,255,255,0.92)",
    surfaceAlt: "rgba(0,0,0,0.04)",
    border: "rgba(0,0,0,0.10)",
    fg: "#0A0A0E",
    fgMuted: "rgba(10,10,14,0.65)",
    fgDim: "rgba(10,10,14,0.40)",
  },
};

// ─── Sound Manager · short tones via WebAudio · default OFF ───────────────
function isSoundOn(): boolean {
  if (typeof window === "undefined") return false;
  try { return localStorage.getItem("cm2-sound-enabled") === "1"; } catch { return false; }
}
function setSoundOn(on: boolean) {
  if (typeof window === "undefined") return;
  try { localStorage.setItem("cm2-sound-enabled", on ? "1" : "0"); } catch {}
}
function playTone(freq: number, duration = 60, vol = 0.18) {
  if (typeof window === "undefined") return;
  if (!isSoundOn()) return;
  try {
    const Ctor: typeof AudioContext | undefined = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    const ac = new Ctor();
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.connect(gain);
    gain.connect(ac.destination);
    osc.frequency.value = freq;
    osc.type = "sine";
    gain.gain.setValueAtTime(vol, ac.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + duration / 1000);
    osc.start();
    osc.stop(ac.currentTime + duration / 1000);
  } catch { /* fail silently */ }
}
function playWheelOpen() { playTone(880, 60, 0.14); }
function playWheelClose() { playTone(440, 40, 0.10); }
function playExportChime() { playTone(660, 70, 0.16); setTimeout(() => playTone(880, 80, 0.14), 80); }

function SoundToggle() {
  const [on, setOn] = useState<boolean>(false);
  useEffect(() => { setOn(isSoundOn()); }, []);
  const toggle = () => {
    const next = !on;
    setOn(next);
    setSoundOn(next);
    if (next) playTone(660, 70, 0.16);
  };
  return (
    <Tooltip label={on ? "Sound on · click to mute" : "Sound off · click to enable"} position="bottom">
      <button
        onClick={toggle}
        title={on ? "Sound on" : "Sound off"}
        style={{
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          width: 36, height: 34, borderRadius: 8,
          background: on ? C.amber + "22" : "rgba(255,255,255,0.035)",
          border: "1px solid " + (on ? C.amber + "55" : "rgba(255,255,255,0.10)"),
          color: on ? C.amber : C.txm,
          cursor: "pointer",
          transition: "all 0.18s cubic-bezier(.2,.7,.2,1)",
        }}
      >
        {on ? <Volume2 size={14} strokeWidth={2.2} /> : <VolumeX size={14} strokeWidth={2.2} />}
      </button>
    </Tooltip>
  );
}

// ─── App theme switcher · persisted ───────────────────────────────────────
function useAppTheme(): [AppTheme, (t: AppTheme) => void] {
  const [theme, setTheme] = useState<AppTheme>("dark");
  useEffect(() => {
    try {
      const raw = localStorage.getItem("cm2-app-theme");
      if (raw === "light" || raw === "dark") setTheme(raw);
    } catch {}
  }, []);
  const set = useCallback((t: AppTheme) => {
    setTheme(t);
    try { localStorage.setItem("cm2-app-theme", t); } catch {}
  }, []);
  return [theme, set];
}

function AppThemeToggle({ theme, onChange }: { theme: AppTheme; onChange: (t: AppTheme) => void }) {
  return (
    <Tooltip label={theme === "dark" ? "Light theme" : "Dark theme"} position="bottom">
      <button
        onClick={() => onChange(theme === "dark" ? "light" : "dark")}
        title={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
        style={{
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          width: 36, height: 34, borderRadius: 8,
          background: "rgba(255,255,255,0.035)",
          border: "1px solid rgba(255,255,255,0.10)",
          color: theme === "dark" ? C.amber : "#0B86D1",
          cursor: "pointer",
          transition: "all 0.18s cubic-bezier(.2,.7,.2,1)",
        }}
      >
        {theme === "dark" ? <Sun size={14} strokeWidth={2.2} /> : <Moon size={14} strokeWidth={2.2} />}
      </button>
    </Tooltip>
  );
}

// ─── Tooltip · custom hover card with shortcut chip ───────────────────────
function Tooltip({ children, label, shortcut, position = "bottom" }: {
  children: React.ReactNode;
  label: string;
  shortcut?: string;
  position?: "top" | "bottom" | "left" | "right";
}) {
  const [show, setShow] = useState(false);
  const [coords, setCoords] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const wrapRef = useRef<HTMLSpanElement | null>(null);
  const showTimer = useRef<number | null>(null);
  const onEnter = () => {
    if (typeof window === "undefined") return;
    if (showTimer.current) window.clearTimeout(showTimer.current);
    showTimer.current = window.setTimeout(() => {
      const r = wrapRef.current?.getBoundingClientRect();
      if (r) setCoords({ x: r.left, y: r.top, w: r.width, h: r.height });
      setShow(true);
    }, 280);
  };
  const onLeave = () => {
    if (typeof window !== "undefined" && showTimer.current) window.clearTimeout(showTimer.current);
    setShow(false);
  };
  let tipStyle: React.CSSProperties = {};
  let anim = "cm2TipFade";
  if (coords) {
    const margin = 8;
    if (position === "bottom") {
      tipStyle = { left: coords.x + coords.w / 2, top: coords.y + coords.h + margin, transform: "translateX(-50%)" };
      anim = "cm2TipFade";
    } else if (position === "top") {
      tipStyle = { left: coords.x + coords.w / 2, top: coords.y - margin, transform: "translate(-50%, -100%)" };
      anim = "cm2TipFadeUp";
    } else if (position === "right") {
      tipStyle = { left: coords.x + coords.w + margin, top: coords.y + coords.h / 2, transform: "translateY(-50%)" };
      anim = "cm2TipFadeRight";
    } else {
      tipStyle = { left: coords.x - margin, top: coords.y + coords.h / 2, transform: "translate(-100%, -50%)" };
      anim = "cm2TipFadeLeft";
    }
  }
  return (
    <>
      <span
        ref={wrapRef}
        onMouseEnter={onEnter}
        onMouseLeave={onLeave}
        onMouseDown={onLeave}
        style={{ display: "inline-flex" }}
      >
        {children}
      </span>
      {show && coords && typeof document !== "undefined" && (
        <div
          style={{
            position: "fixed",
            zIndex: 14000,
            pointerEvents: "none",
            background: "rgba(13,13,18,0.96)",
            border: "1px solid rgba(255,255,255,0.10)",
            backdropFilter: "blur(14px) saturate(140%)",
            WebkitBackdropFilter: "blur(14px) saturate(140%)",
            borderRadius: 7,
            padding: "6px 10px",
            display: "inline-flex", alignItems: "center", gap: 8,
            boxShadow: "0 10px 28px rgba(0,0,0,0.45), 0 0 0 1px rgba(247,176,65,0.10)",
            animation: anim + " 0.18s cubic-bezier(.2,.7,.2,1) both",
            ...tipStyle,
          }}
        >
          <span style={{ fontFamily: "'Outfit', ui-sans-serif, system-ui, sans-serif", fontSize: 11, color: C.tx, fontWeight: 600, whiteSpace: "nowrap" }}>{label}</span>
          {shortcut && (
            <span style={{
              fontFamily: mn, fontSize: 9, fontWeight: 800, color: C.amber,
              padding: "2px 6px", borderRadius: 4,
              background: C.amber + "1A",
              border: "1px solid " + C.amber + "44",
              letterSpacing: 0.5,
            }}>{shortcut}</span>
          )}
        </div>
      )}
    </>
  );
}

// ─── Color picker · palette + custom HSL/Hex/Eyedropper + recents ─────────
function hslToHex(h: number, s: number, l: number): string {
  s /= 100; l /= 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) { r = c; g = x; }
  else if (h < 120) { r = x; g = c; }
  else if (h < 180) { g = c; b = x; }
  else if (h < 240) { g = x; b = c; }
  else if (h < 300) { r = x; b = c; }
  else { r = c; b = x; }
  const toHex = (v: number) => {
    const h2 = Math.round((v + m) * 255).toString(16).padStart(2, "0");
    return h2;
  };
  return "#" + toHex(r) + toHex(g) + toHex(b);
}
function hexToHsl(hex: string): { h: number; s: number; l: number } {
  let h = hex.replace("#", "");
  if (h.length === 3) h = h.split("").map(c => c + c).join("");
  if (h.length !== 6) return { h: 30, s: 70, l: 55 };
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  }
  let hue = 0;
  if (max === min) hue = 0;
  else if (max === r) hue = ((g - b) / (max - min)) % 6;
  else if (max === g) hue = (b - r) / (max - min) + 2;
  else hue = (r - g) / (max - min) + 4;
  hue = Math.round(hue * 60);
  if (hue < 0) hue += 360;
  return { h: hue, s: Math.round(s * 100), l: Math.round(l * 100) };
}

function ColorPicker({ value, palette, onChange, onClose }: { value: string; palette: string[]; onChange: (c: string) => void; onClose?: () => void }) {
  const [tab, setTab] = useState<"palette" | "custom">("palette");
  const initialHsl = hexToHsl(value);
  const [hue, setHue] = useState(initialHsl.h);
  const [sat, setSat] = useState(initialHsl.s);
  const [lit, setLit] = useState(initialHsl.l);
  const [hex, setHex] = useState(value);
  const [recents, setRecents] = useState<string[]>([]);
  useEffect(() => {
    try {
      const raw = localStorage.getItem("cm2-recent-colors");
      if (raw) setRecents(JSON.parse(raw));
    } catch {}
  }, []);
  const pushRecent = useCallback((c: string) => {
    setRecents(prev => {
      const next = [c, ...prev.filter(x => x.toLowerCase() !== c.toLowerCase())].slice(0, 8);
      try { localStorage.setItem("cm2-recent-colors", JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);
  const apply = (c: string) => { onChange(c); pushRecent(c); };
  const onHueChange = (h: number) => {
    setHue(h);
    const c = hslToHex(h, sat, lit);
    setHex(c);
  };
  const onSvDrag = (e: React.MouseEvent | React.PointerEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const px = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const py = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    const newSat = Math.round(px * 100);
    const newLit = Math.round((1 - py) * 50 + (1 - px) * (1 - py) * 50);
    setSat(newSat);
    setLit(Math.max(5, Math.min(95, newLit)));
    setHex(hslToHex(hue, newSat, Math.max(5, Math.min(95, newLit))));
  };
  const eyedropper = async () => {
    if (typeof window === "undefined") return;
    const ED = (window as unknown as { EyeDropper?: new () => { open: () => Promise<{ sRGBHex: string }> } }).EyeDropper;
    if (!ED) { showToast("EyeDropper not supported in this browser"); return; }
    try {
      const ed = new ED();
      const res = await ed.open();
      if (res?.sRGBHex) {
        setHex(res.sRGBHex);
        const h = hexToHsl(res.sRGBHex);
        setHue(h.h); setSat(h.s); setLit(h.l);
        apply(res.sRGBHex);
      }
    } catch { /* user cancelled */ }
  };
  void lit;
  return (
    <div style={{
      width: 260,
      background: "#0D0D14",
      border: "1px solid rgba(255,255,255,0.10)",
      borderRadius: 10,
      padding: 12,
      boxShadow: "0 18px 48px rgba(0,0,0,0.55), 0 0 0 1px rgba(247,176,65,0.10)",
    }} onClick={e => e.stopPropagation()}>
      <div style={{ display: "flex", gap: 4, marginBottom: 10 }}>
        {(["palette", "custom"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            flex: 1, padding: "6px 8px", borderRadius: 6,
            background: tab === t ? C.amber + "22" : "rgba(255,255,255,0.03)",
            border: "1px solid " + (tab === t ? C.amber + "55" : "rgba(255,255,255,0.10)"),
            color: tab === t ? C.amber : C.txm,
            fontFamily: mn, fontSize: 9, fontWeight: 800, letterSpacing: 0.6,
            cursor: "pointer", textTransform: "uppercase",
          }}>{t}</button>
        ))}
      </div>
      {tab === "palette" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 5 }}>
          {palette.map((c, i) => (
            <button key={i} onClick={() => apply(c)} title={c} style={{
              width: "100%", aspectRatio: "1 / 1", borderRadius: 5,
              background: c,
              border: "1px solid " + (value.toLowerCase() === c.toLowerCase() ? "#fff" : "rgba(0,0,0,0.4)"),
              cursor: "pointer", padding: 0,
              transition: "transform 0.16s",
            }} onMouseEnter={e => { e.currentTarget.style.transform = "scale(1.08)"; }} onMouseLeave={e => { e.currentTarget.style.transform = "scale(1)"; }} />
          ))}
        </div>
      )}
      {tab === "custom" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div
            onPointerDown={e => { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); onSvDrag(e); }}
            onPointerMove={e => { if (e.buttons === 1) onSvDrag(e); }}
            style={{
              position: "relative", width: "100%", height: 130,
              borderRadius: 6,
              background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, hsl(${hue}, 100%, 50%))`,
              cursor: "crosshair",
              border: "1px solid rgba(255,255,255,0.10)",
            }}
          >
            <div style={{
              position: "absolute",
              left: `calc(${sat}% - 6px)`,
              top: `calc(${100 - sat * 0.5}% - 6px)`,
              width: 12, height: 12, borderRadius: "50%",
              border: "2px solid #fff",
              boxShadow: "0 0 0 1px rgba(0,0,0,0.4)",
              pointerEvents: "none",
            }} />
          </div>
          <input type="range" min={0} max={360} value={hue} onChange={e => onHueChange(Number(e.target.value))}
            style={{
              width: "100%", height: 14, borderRadius: 7,
              background: "linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)",
              accentColor: C.amber, appearance: "none", WebkitAppearance: "none",
            }} />
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <input value={hex} onChange={e => setHex(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") apply(hex); }}
              style={{
                flex: 1, padding: "6px 8px", borderRadius: 5,
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.12)",
                color: C.tx, fontFamily: mn, fontSize: 11, fontWeight: 700,
              }} />
            <button onClick={() => apply(hex)} title="Apply hex"
              style={{
                padding: "6px 10px", borderRadius: 5,
                background: C.amber + "22", border: "1px solid " + C.amber + "55",
                color: C.amber, fontFamily: mn, fontSize: 9, fontWeight: 800, letterSpacing: 0.5, cursor: "pointer",
              }}><Check size={11} strokeWidth={2.4} /></button>
            <button onClick={eyedropper} title="Pick color from screen"
              style={{
                padding: "6px 10px", borderRadius: 5,
                background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.12)",
                color: C.txm, cursor: "pointer", display: "inline-flex",
              }}><Pipette size={12} strokeWidth={2.2} /></button>
          </div>
        </div>
      )}
      {recents.length > 0 && (
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <div style={{ fontFamily: mn, fontSize: 8, color: C.amber, letterSpacing: 1.2, fontWeight: 800, marginBottom: 6 }}>RECENT</div>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {recents.map((c, i) => (
              <button key={i} onClick={() => apply(c)} title={c}
                style={{ width: 22, height: 22, borderRadius: 4, background: c, border: "1px solid rgba(0,0,0,0.4)", cursor: "pointer" }} />
            ))}
          </div>
        </div>
      )}
      {onClose && (
        <button onClick={onClose} style={{
          marginTop: 10, width: "100%", padding: "6px 8px", borderRadius: 5,
          background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.10)",
          color: C.txm, fontFamily: mn, fontSize: 9, fontWeight: 800, letterSpacing: 0.6, cursor: "pointer", textTransform: "uppercase",
        }}>Close</button>
      )}
    </div>
  );
}

// ─── Mini chart preview · for template gallery cards ──────────────────────
function MiniChartPreview({ type, palette }: { type: ChartType; palette: string[] }) {
  const W = 160, H = 92;
  const colors = palette.slice(0, 4);
  const pad = 8;
  if (type === "stacked" || type === "clustered" || type === "wfup" || type === "wfdn" || type === "variance" || type === "combo") {
    const bars = 5;
    const bw = (W - pad * 2) / bars - 4;
    return (
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} style={{ display: "block" }}>
        {Array.from({ length: bars }, (_, i) => {
          const x = pad + i * (bw + 4);
          const h1 = 14 + ((i * 7) % 30);
          const h2 = 8 + ((i * 5) % 22);
          const h3 = 6 + ((i * 11) % 20);
          const stacked = type === "stacked";
          if (stacked) {
            return (
              <g key={i} style={{ transformOrigin: `${x + bw / 2}px ${H - pad}px`, animation: `cm2MiniBarRise 0.5s cubic-bezier(.2,.7,.2,1) both`, animationDelay: `${i * 50}ms` }}>
                <rect x={x} y={H - pad - h1 - h2 - h3} width={bw} height={h3} fill={colors[2] || "#2EAD8E"} rx={1} />
                <rect x={x} y={H - pad - h1 - h2} width={bw} height={h2} fill={colors[1] || "#0B86D1"} rx={1} />
                <rect x={x} y={H - pad - h1} width={bw} height={h1} fill={colors[0] || "#F7B041"} rx={1} />
              </g>
            );
          } else {
            return (
              <g key={i} style={{ transformOrigin: `${x + bw / 2}px ${H - pad}px`, animation: `cm2MiniBarRise 0.5s cubic-bezier(.2,.7,.2,1) both`, animationDelay: `${i * 50}ms` }}>
                <rect x={x} y={H - pad - h1 - h2} width={bw} height={h1 + h2} fill={colors[i % colors.length] || "#F7B041"} rx={1} />
              </g>
            );
          }
        })}
      </svg>
    );
  }
  if (type === "line" || type === "stackedArea" || type === "pctArea") {
    const pts: Array<{ x: number; y: number }> = [
      { x: pad, y: H - pad - 30 },
      { x: pad + 30, y: H - pad - 50 },
      { x: pad + 60, y: H - pad - 38 },
      { x: pad + 90, y: H - pad - 64 },
      { x: pad + 130, y: H - pad - 58 },
    ];
    const d = "M " + pts.map(p => p.x + " " + p.y).join(" L ");
    const a = type === "stackedArea" || type === "pctArea";
    return (
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} style={{ display: "block" }}>
        {a && <path d={d + ` L ${pts[pts.length - 1].x} ${H - pad} L ${pts[0].x} ${H - pad} Z`} fill={(colors[0] || "#F7B041") + "55"} />}
        <path d={d} fill="none" stroke={colors[0] || "#F7B041"} strokeWidth={2.2} strokeLinejoin="round" strokeLinecap="round"
          style={{ strokeDasharray: 200, animation: "cm2MiniLineDraw 1.2s cubic-bezier(.2,.7,.2,1) both" }} />
        {pts.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={2.4} fill={colors[1] || "#0B86D1"} />)}
      </svg>
    );
  }
  if (type === "pie" || type === "doughnut") {
    const cx = W / 2, cy = H / 2, r = 30;
    const slices = [0.4, 0.25, 0.2, 0.15];
    let acc = 0;
    return (
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} style={{ display: "block" }}>
        {slices.map((s, i) => {
          const a0 = acc * 2 * Math.PI - Math.PI / 2;
          const a1 = (acc + s) * 2 * Math.PI - Math.PI / 2;
          acc += s;
          const x0 = cx + r * Math.cos(a0), y0 = cy + r * Math.sin(a0);
          const x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1);
          const big = s > 0.5 ? 1 : 0;
          const path = `M ${cx} ${cy} L ${x0} ${y0} A ${r} ${r} 0 ${big} 1 ${x1} ${y1} Z`;
          return <path key={i} d={path} fill={colors[i % colors.length]} stroke="#0D0D14" strokeWidth={1} />;
        })}
        {type === "doughnut" && <circle cx={cx} cy={cy} r={14} fill="#0D0D14" />}
      </svg>
    );
  }
  if (type === "mekkoPct" || type === "mekkoUnit") {
    const widths = [40, 32, 50, 25];
    let xCur = pad;
    return (
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} style={{ display: "block" }}>
        {widths.map((w, i) => {
          const x = xCur;
          xCur += w + 2;
          const splits = [0.5, 0.3, 0.2];
          let yCur = H - pad;
          return (
            <g key={i} style={{ animation: `cm2MiniBarRise 0.5s cubic-bezier(.2,.7,.2,1) both`, animationDelay: `${i * 50}ms`, transformOrigin: `${x}px ${H - pad}px` }}>
              {splits.map((sp, j) => {
                const segH = sp * (H - pad * 2);
                yCur -= segH;
                return <rect key={j} x={x} y={yCur} width={w} height={segH} fill={colors[j % colors.length]} stroke="#0D0D14" strokeWidth={0.6} />;
              })}
            </g>
          );
        })}
      </svg>
    );
  }
  if (type === "gantt") {
    const tasks = [{ x: pad + 10, w: 70, y: 20 }, { x: pad + 50, w: 60, y: 40 }, { x: pad + 80, w: 60, y: 60 }];
    return (
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} style={{ display: "block" }}>
        {tasks.map((t, i) => (
          <g key={i}>
            <rect x={pad} y={t.y - 1} width={W - pad * 2} height={2} fill="rgba(255,255,255,0.05)" />
            <rect x={t.x} y={t.y - 6} width={t.w} height={10} fill={colors[i % colors.length]} rx={2}
              style={{ animation: `cm2MiniBarRise 0.5s cubic-bezier(.2,.7,.2,1) both`, animationDelay: `${i * 80}ms`, transformOrigin: `${t.x}px ${t.y}px` }} />
          </g>
        ))}
        <line x1={W * 0.55} y1={pad} x2={W * 0.55} y2={H - pad} stroke={colors[3] || "#E06347"} strokeWidth={1} strokeDasharray="2 2" />
      </svg>
    );
  }
  if (type === "scatter" || type === "bubble") {
    const pts: Array<{ x: number; y: number; r: number }> = [
      { x: 30, y: 60, r: 4 }, { x: 60, y: 35, r: type === "bubble" ? 7 : 4 }, { x: 95, y: 52, r: 4 },
      { x: 125, y: 28, r: type === "bubble" ? 9 : 4 }, { x: 80, y: 70, r: type === "bubble" ? 6 : 4 },
    ];
    return (
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} style={{ display: "block" }}>
        {pts.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={p.r} fill={colors[i % colors.length]} opacity={0.85} />)}
      </svg>
    );
  }
  if (type === "pct") {
    return (
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} style={{ display: "block" }}>
        {[0, 1, 2, 3, 4].map(i => {
          const x = pad + i * 28;
          const a = 30 + (i * 5);
          const b = 30 + (15 - i * 3);
          const c = 60 - a - b;
          let yCur = H - pad;
          const segs = [a, b, c];
          return (
            <g key={i} style={{ animation: `cm2MiniBarRise 0.5s cubic-bezier(.2,.7,.2,1) both`, animationDelay: `${i * 50}ms`, transformOrigin: `${x}px ${H - pad}px` }}>
              {segs.map((s, j) => {
                yCur -= s;
                return <rect key={j} x={x} y={yCur} width={20} height={s} fill={colors[j % colors.length]} />;
              })}
            </g>
          );
        })}
      </svg>
    );
  }
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} style={{ display: "block" }}>
      <rect x={pad} y={pad} width={W - pad * 2} height={H - pad * 2} fill="none" stroke="rgba(255,255,255,0.10)" rx={4} />
    </svg>
  );
}

// ─── Welcome step illustrations ───────────────────────────────────────────
function WelcomeIllustration({ stepIdx, accent }: { stepIdx: number; accent: string }) {
  const D = 140;
  if (stepIdx === 0) {
    return (
      <svg viewBox={`0 0 ${D} ${D}`} width={D} height={D} style={{ display: "block" }}>
        {[0, 1, 2, 3].map(i => {
          const x = 24 + i * 24;
          const h = 30 + (i % 2) * 20 + i * 6;
          return (
            <rect key={i} x={x} y={D - 16 - h} width={18} height={h} rx={3} fill={accent}
              style={{ transformOrigin: `${x + 9}px ${D - 16}px`, animation: `cm2WelcomeBars 2.${i + 4}s ease-in-out infinite`, animationDelay: `${i * 0.15}s` }}
              opacity={0.85 - i * 0.12} />
          );
        })}
        <line x1={16} y1={D - 16} x2={D - 16} y2={D - 16} stroke={accent + "66"} strokeWidth={1.5} />
      </svg>
    );
  }
  if (stepIdx === 1) {
    return (
      <svg viewBox={`0 0 ${D} ${D}`} width={D} height={D} style={{ display: "block" }}>
        <g style={{ transformOrigin: `${D / 2}px ${D / 2}px`, animation: `cm2WelcomeRotate 12s linear infinite` }}>
          {[0, 1, 2, 3].map(i => {
            const a = (i / 4) * Math.PI * 2 - Math.PI / 2;
            const cx = D / 2 + Math.cos(a) * 36;
            const cy = D / 2 + Math.sin(a) * 36;
            return <circle key={i} cx={cx} cy={cy} r={14} fill={accent} opacity={0.7 - i * 0.14} />;
          })}
        </g>
        <circle cx={D / 2} cy={D / 2} r={20} fill="rgba(13,13,18,0.96)" stroke={accent + "88"} strokeWidth={1.5} />
      </svg>
    );
  }
  if (stepIdx === 2) {
    return (
      <svg viewBox={`0 0 ${D} ${D}`} width={D} height={D} style={{ display: "block" }}>
        <rect x={D / 2 - 10} y={36} width={20} height={68} rx={3} fill={accent} opacity={0.85} />
        {[0, 1, 2, 3, 4, 5].map(i => {
          const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
          const cx = D / 2 + Math.cos(a) * 40;
          const cy = D / 2 + Math.sin(a) * 40;
          return <circle key={i} cx={cx} cy={cy} r={5} fill={accent}
            style={{ animation: `cm2WelcomeMenuPulse 1.6s ease-in-out infinite`, animationDelay: `${i * 0.12}s` }} />;
        })}
      </svg>
    );
  }
  if (stepIdx === 3) {
    return (
      <svg viewBox={`0 0 ${D} ${D}`} width={D} height={D} style={{ display: "block" }}>
        <rect x={16} y={20} width={D - 32} height={16} rx={2} fill={accent + "44"} stroke={accent + "88"} strokeWidth={1} />
        <text x={20} y={32} fontFamily="JetBrains Mono, monospace" fontSize={9} fill={accent} fontWeight={800}>fx =SUM(A1:A5)</text>
        {[0, 1, 2, 3].map(r => (
          <g key={r}>
            {[0, 1, 2, 3].map(c => (
              <rect key={c} x={16 + c * 27} y={42 + r * 18} width={26} height={17} fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth={0.6}
                style={{ animation: r === 1 && c === 2 ? `cm2WelcomeGridSweep 2s ease-in-out infinite` : undefined }} />
            ))}
          </g>
        ))}
        <rect x={16 + 2 * 27} y={42 + 1 * 18} width={26} height={17} fill={accent + "33"} />
      </svg>
    );
  }
  if (stepIdx === 4) {
    return (
      <svg viewBox={`0 0 ${D} ${D}`} width={D} height={D} style={{ display: "block" }}>
        <g style={{ animation: `cm2WelcomeSplit 3s ease-in-out infinite` }}>
          <rect x={14} y={20} width={56} height={D - 40} rx={4} fill={accent + "1A"} stroke={accent + "55"} strokeWidth={1} />
          {[0, 1, 2].map(i => <rect key={i} x={20 + i * 16} y={D - 30 - (10 + i * 8)} width={10} height={10 + i * 8} fill={accent} />)}
        </g>
        <rect x={76} y={20} width={50} height={D - 40} rx={4} fill="rgba(11,134,209,0.16)" stroke="rgba(11,134,209,0.55)" strokeWidth={1} />
        {[0, 1, 2, 3].map(r => <line key={r} x1={80} y1={28 + r * 22} x2={122} y2={28 + r * 22} stroke="rgba(11,134,209,0.40)" strokeWidth={0.8} />)}
      </svg>
    );
  }
  return (
    <svg viewBox={`0 0 ${D} ${D}`} width={D} height={D} style={{ display: "block" }}>
      <g style={{ transformOrigin: `${D / 2}px ${D / 2}px`, animation: `cm2WelcomeMorph 2.4s ease-in-out infinite` }}>
        <rect x={28} y={28} width={D - 56} height={D - 56} rx={10} fill="none" stroke={accent} strokeWidth={2} />
        <path d={`M ${D / 2 - 20} 28 L 28 28 L 28 48`} fill="none" stroke={accent} strokeWidth={2} strokeLinecap="round" />
        <path d={`M ${D / 2 + 20} 28 L ${D - 28} 28 L ${D - 28} 48`} fill="none" stroke={accent} strokeWidth={2} strokeLinecap="round" />
        <path d={`M 28 ${D / 2 + 20} L 28 ${D - 28} L 48 ${D - 28}`} fill="none" stroke={accent} strokeWidth={2} strokeLinecap="round" />
        <path d={`M ${D - 28} ${D / 2 + 20} L ${D - 28} ${D - 28} L ${D - 48} ${D - 28}`} fill="none" stroke={accent} strokeWidth={2} strokeLinecap="round" />
      </g>
    </svg>
  );
}

// ─── Grain noise overlay · low-opacity SVG noise on root wrapper ──────────
function GrainOverlay() {
  return (
    <svg
      aria-hidden
      style={{
        position: "fixed", inset: 0, pointerEvents: "none", zIndex: 1,
        mixBlendMode: "overlay", opacity: 0.5, width: "100%", height: "100%",
      }}
    >
      <filter id="cmGrain">
        <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="2" stitchTiles="stitch" />
        <feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.04 0" />
      </filter>
      <rect width="100%" height="100%" filter="url(#cmGrain)" />
    </svg>
  );
}

// ─── Ambient particle layer · 10 floating dots ────────────────────────────
function AmbientParticles() {
  const particles = useMemo(() => {
    const colors = ["#F7B041", "#0B86D1", "#2EAD8E"];
    return Array.from({ length: 10 }, (_, i) => ({
      x: (i * 137 + 30) % 95,
      y: (i * 73 + 12) % 90,
      size: 4 + (i * 7) % 5,
      duration: 18 + (i * 3) % 14,
      anim: `cm2ParticleDrift${(i % 4) + 1}`,
      color: colors[i % colors.length],
      opacity: 0.06 + ((i % 3) * 0.03),
      delay: (i * 1.7) % 8,
    }));
  }, []);
  return (
    <div
      aria-hidden
      style={{
        position: "fixed", inset: 0,
        pointerEvents: "none", zIndex: 0, overflow: "hidden",
      }}
    >
      {particles.map((p, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: `${p.x}%`, top: `${p.y}%`,
            width: p.size, height: p.size, borderRadius: "50%",
            background: p.color,
            opacity: p.opacity,
            filter: "blur(0.5px)",
            boxShadow: `0 0 ${p.size * 2}px ${p.color}88`,
            animation: `${p.anim} ${p.duration}s ease-in-out infinite`,
            animationDelay: `${p.delay}s`,
          }}
        />
      ))}
    </div>
  );
}

// ─── Custom cursors · splitter (data URL inline SVG) ──────────────────────
const CURSOR_SPLIT_V = `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='20' height='20' viewBox='0 0 20 20'><line x1='8' y1='3' x2='8' y2='17' stroke='%23F7B041' stroke-width='2' stroke-linecap='round'/><line x1='12' y1='3' x2='12' y2='17' stroke='%23F7B041' stroke-width='2' stroke-linecap='round'/></svg>") 10 10, col-resize`;
const CURSOR_SPLIT_H = `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='20' height='20' viewBox='0 0 20 20'><line x1='3' y1='8' x2='17' y2='8' stroke='%23F7B041' stroke-width='2' stroke-linecap='round'/><line x1='3' y1='12' x2='17' y2='12' stroke='%23F7B041' stroke-width='2' stroke-linecap='round'/></svg>") 10 10, row-resize`;

// ─── Onboarding tour · spotlight + tooltip card · 6 steps ─────────────────
interface TourStep {
  selector: string;
  title: string;
  body: string;
  position?: "top" | "bottom" | "left" | "right";
}
const TOUR_STEPS: TourStep[] = [
  { selector: "[data-tour='type-wheel']", title: "Type Wheel", body: "Click here (or press W) to switch chart types radially.", position: "bottom" },
  { selector: "[data-tour='templates']", title: "Templates", body: "Or start from a curated preset — production charts ready to go.", position: "bottom" },
  { selector: "[data-tour='canvas']", title: "Click to select", body: "Click any bar, point, or label to select it. Double-click for a format popup.", position: "top" },
  { selector: "[data-tour='datasheet']", title: "Edit values directly", body: "Spreadsheet-style editing with formulas (=SUM, =VLOOKUP, =INDEX). Type values in cells.", position: "top" },
  { selector: "[data-tour='design']", title: "Design panel", body: "Tweak palettes, backdrops, gridlines, axes, watermark — everything visual.", position: "bottom" },
  { selector: "[data-tour='expand']", title: "Expanded webapp", body: "Open the full editor: chart + table + properties in three resizable panes.", position: "bottom" },
];

function OnboardingTour({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const cur = TOUR_STEPS[step];
  useEffect(() => {
    const upd = () => {
      if (typeof document === "undefined") return;
      const el = document.querySelector(cur.selector);
      if (el) setRect(el.getBoundingClientRect());
      else setRect(null);
    };
    upd();
    const id = setTimeout(upd, 60);
    window.addEventListener("resize", upd);
    window.addEventListener("scroll", upd, true);
    return () => { clearTimeout(id); window.removeEventListener("resize", upd); window.removeEventListener("scroll", upd, true); };
  }, [step, cur.selector]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") setStep(s => Math.min(TOUR_STEPS.length - 1, s + 1));
      if (e.key === "ArrowLeft") setStep(s => Math.max(0, s - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const finish = () => {
    try { localStorage.setItem("cm2-tour-completed-v1", "1"); } catch {}
    onClose();
  };
  const isLast = step === TOUR_STEPS.length - 1;
  const pad = 10;
  const sx = rect ? rect.left - pad : 0;
  const sy = rect ? rect.top - pad : 0;
  const sw = rect ? rect.width + pad * 2 : 0;
  const sh = rect ? rect.height + pad * 2 : 0;
  let cardStyle: React.CSSProperties = { left: "50%", top: "50%", transform: "translate(-50%, -50%)" };
  if (rect) {
    if (cur.position === "bottom") {
      cardStyle = { left: rect.left + rect.width / 2, top: rect.bottom + 18, transform: "translateX(-50%)" };
    } else if (cur.position === "top") {
      cardStyle = { left: rect.left + rect.width / 2, top: rect.top - 18, transform: "translate(-50%, -100%)" };
    } else if (cur.position === "right") {
      cardStyle = { left: rect.right + 18, top: rect.top + rect.height / 2, transform: "translateY(-50%)" };
    } else if (cur.position === "left") {
      cardStyle = { left: rect.left - 18, top: rect.top + rect.height / 2, transform: "translate(-100%, -50%)" };
    }
  }
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 13500, pointerEvents: "auto" }}>
      <div style={{ position: "absolute", inset: 0, background: "rgba(6,6,12,0.72)", pointerEvents: "auto" }} onClick={finish} />
      {rect && (
        <div style={{
          position: "absolute", left: sx, top: sy, width: sw, height: sh,
          border: "2px solid " + C.amber,
          borderRadius: 12,
          boxShadow: "0 0 0 99999px rgba(6,6,12,0.74), 0 0 32px " + C.amber + "55",
          animation: "cm2OnboardSpot 0.32s cubic-bezier(.2,.7,.2,1) both, cm2OnboardPulse 2s ease-in-out infinite",
          pointerEvents: "none",
        }} />
      )}
      <div
        style={{
          position: "fixed",
          width: 320, maxWidth: "calc(100vw - 24px)",
          background: "linear-gradient(180deg, #11111A 0%, #0A0A12 100%)",
          border: "1px solid " + C.amber + "44",
          borderRadius: 12,
          padding: "16px 18px",
          boxShadow: "0 24px 60px rgba(0,0,0,0.55), 0 0 32px " + C.amber + "30",
          animation: "cm2WelcomePop 0.32s cubic-bezier(.2,.7,.2,1) both",
          ...cardStyle,
        }}
      >
        <div style={{ fontFamily: mn, fontSize: 9, color: C.amber, letterSpacing: 1.4, fontWeight: 800, marginBottom: 6, textTransform: "uppercase" }}>
          Tour · {step + 1}/{TOUR_STEPS.length}
        </div>
        <div style={{ fontFamily: gf, fontSize: 16, fontWeight: 900, color: C.tx, marginBottom: 8, letterSpacing: -0.2 }}>{cur.title}</div>
        <div style={{ fontFamily: ft, fontSize: 12.5, color: C.txm, lineHeight: 1.5, marginBottom: 14 }}>{cur.body}</div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button onClick={finish} style={{
            padding: "7px 12px", borderRadius: 6,
            background: "transparent", border: "1px solid rgba(255,255,255,0.10)",
            color: C.txm, fontFamily: mn, fontSize: 9, fontWeight: 800, letterSpacing: 0.5, cursor: "pointer", textTransform: "uppercase",
          }}>Skip</button>
          <span style={{ flex: 1 }} />
          {step > 0 && <button onClick={() => setStep(s => s - 1)} style={{
            padding: "7px 12px", borderRadius: 6,
            background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.10)",
            color: C.tx, fontFamily: mn, fontSize: 9, fontWeight: 800, letterSpacing: 0.5, cursor: "pointer", textTransform: "uppercase",
          }}>← Back</button>}
          <button onClick={() => isLast ? finish() : setStep(s => s + 1)} style={{
            padding: "8px 14px", borderRadius: 6,
            background: `linear-gradient(135deg, ${C.amber} 0%, ${C.amber}cc 100%)`,
            border: "1px solid " + C.amber + "88",
            color: "#0A0A0E", fontFamily: mn, fontSize: 9, fontWeight: 900, letterSpacing: 0.6, cursor: "pointer", textTransform: "uppercase",
            boxShadow: `0 6px 16px ${C.amber}55, 0 1px 0 rgba(255,255,255,0.18) inset`,
          }}>{isLast ? "Done" : "Next →"}</button>
        </div>
      </div>
    </div>
  );
}

// Helper: read tour-completed flag
function tourCompleted(): boolean {
  if (typeof window === "undefined") return true;
  try { return localStorage.getItem("cm2-tour-completed-v1") === "1"; } catch { return true; }
}

// ═══════════════════════════════════════════════════════════════════════════
// WAVE 14 · TYPOGRAPHY STYLES · centralized text system tokens
// Use these for any new UI to keep voicing consistent.
// ═══════════════════════════════════════════════════════════════════════════

interface TypographySpec { fontFamily: string; fontSize: number; fontWeight: number; letterSpacing?: number; lineHeight?: number; fontFeatureSettings?: string; textTransform?: React.CSSProperties["textTransform"] }

export const TYPOGRAPHY: Record<string, TypographySpec> = {
  // Section headers (e.g., "PALETTE", "DISPLAY") — uppercase amber chips
  sectionHeader: { fontFamily: mn, fontSize: 9, fontWeight: 800, letterSpacing: 1.4, textTransform: "uppercase" as React.CSSProperties["textTransform"] },
  // Chart title — large, bold, slightly negative tracking
  chartTitle: { fontFamily: gf, fontSize: 18, fontWeight: 900, letterSpacing: -0.3 },
  // Body text — readable, Outfit medium
  body: { fontFamily: ft, fontSize: 12, fontWeight: 500, lineHeight: 1.5 },
  // Data labels in chart — mono with tabular numbers
  dataLabel: { fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 10, fontWeight: 700, fontFeatureSettings: "\"tnum\" 1" },
  // Buttons / pills — uppercase mono
  button: { fontFamily: mn, fontSize: 11, fontWeight: 800, letterSpacing: 0.5, textTransform: "uppercase" as React.CSSProperties["textTransform"] },
  // Subtitles / descriptors
  caption: { fontFamily: mn, fontSize: 9, fontWeight: 700, letterSpacing: 0.6 },
};

// Convert typography spec to React.CSSProperties
export function typo(t: TypographySpec): React.CSSProperties {
  return {
    fontFamily: t.fontFamily,
    fontSize: t.fontSize,
    fontWeight: t.fontWeight,
    ...(t.letterSpacing !== undefined ? { letterSpacing: t.letterSpacing } : {}),
    ...(t.lineHeight !== undefined ? { lineHeight: t.lineHeight } : {}),
    ...(t.fontFeatureSettings ? { fontFeatureSettings: t.fontFeatureSettings } : {}),
    ...(t.textTransform ? { textTransform: t.textTransform } : {}),
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// WAVE 14 · FLIP TRANSITION HELPERS (First-Last-Invert-Play for cinematic morph)
// ═══════════════════════════════════════════════════════════════════════════

interface FlipSnapshot { x: number; y: number; w: number; h: number }

// Capture rect of an element. Used as the "first" position in FLIP.
export function captureRect(el: Element | null): FlipSnapshot | null {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { x: r.left, y: r.top, w: r.width, h: r.height };
}

// Run a FLIP-style morph: capture last position, invert to first, animate to identity.
// duration in ms.
export function flipMorph(target: HTMLElement, first: FlipSnapshot, duration = 500) {
  if (!target) return;
  const last = target.getBoundingClientRect();
  const dx = first.x - last.left;
  const dy = first.y - last.top;
  const sx = first.w / Math.max(1, last.width);
  const sy = first.h / Math.max(1, last.height);
  target.style.transformOrigin = "top left";
  target.style.transform = `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`;
  target.style.transition = "none";
  // Force reflow
  void target.offsetWidth;
  target.style.transition = `transform ${duration}ms cubic-bezier(.2,.7,.2,1)`;
  target.style.transform = "translate(0, 0) scale(1, 1)";
}

// ═══════════════════════════════════════════════════════════════════════════
// WAVE 14 · KEYBOARD SHORTCUT REGISTRY (centralized)
// Each entry maps to a chord + descriptive action. Used by ShortcutsOverlay
// (potential future enhancement) and by Tooltip "shortcut" hints.
// ═══════════════════════════════════════════════════════════════════════════

export interface ShortcutEntry {
  id: string;
  keys: string;       // pretty form: "⌘D", "⌘⇧E", "W"
  category: "Editing" | "Selection" | "View" | "Export" | "Navigation";
  description: string;
}

export const SHORTCUTS_V14: ShortcutEntry[] = [
  // Editing
  { id: "undo", keys: "⌘Z", category: "Editing", description: "Undo last change" },
  { id: "redo", keys: "⌘⇧Z", category: "Editing", description: "Redo last undone change" },
  { id: "lock", keys: "⌘L", category: "Editing", description: "Toggle edit lock" },
  // Selection
  { id: "selectionWheel", keys: "M", category: "Selection", description: "Open the radial wheel for current selection" },
  { id: "deselect", keys: "Esc", category: "Selection", description: "Clear selection / close any overlay" },
  // View
  { id: "typeWheel", keys: "W", category: "View", description: "Open chart-type wheel" },
  { id: "design", keys: "⌘D", category: "View", description: "Open Design panel" },
  { id: "expand", keys: "⌘⇧E", category: "View", description: "Toggle expanded mode" },
  { id: "shortcuts", keys: "?", category: "View", description: "Show keyboard shortcuts" },
  // Export
  { id: "copy", keys: "⌘⇧C", category: "Export", description: "Copy chart as PNG to clipboard" },
];

// ═══════════════════════════════════════════════════════════════════════════
// WAVE 14 · GLOBAL CSS RESET / OVERRIDES (scoped to .cm2-root)
// Adds tabular numerals, font features, and animation perf hints.
// ═══════════════════════════════════════════════════════════════════════════

export function CM2GlobalStyles() {
  return (
    <style>{`
      .cm2-root { font-feature-settings: "tnum" 1, "ss01" 1; }
      .cm2-root * { -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; }
      .cm2-root svg text { font-feature-settings: "tnum" 1; }
      /* Custom scrollbar */
      .cm2-root *::-webkit-scrollbar { width: 9px; height: 9px; }
      .cm2-root *::-webkit-scrollbar-track { background: rgba(255,255,255,0.02); border-radius: 5px; }
      .cm2-root *::-webkit-scrollbar-thumb { background: rgba(247,176,65,0.20); border-radius: 5px; transition: background 0.18s; }
      .cm2-root *::-webkit-scrollbar-thumb:hover { background: rgba(247,176,65,0.45); }
      /* Animation perf */
      .cm2-root [data-anim] { will-change: transform, opacity; }
    `}</style>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// WAVE 14 · NOTES / CHANGE LOG
// ───────────────────────────────────────────────────────────────────────────
// Tier 1 (high-impact quick wins):
//   1.1  Chart entrance animation · per-bar stagger via cm2BarRise (StackedColumn,
//        ClusteredColumn, PercentColumn, Waterfall, VarianceBar, ComboChart).
//   1.2  Tooltip component · custom hover card with shortcut chip.
//        Wrapped: TYPE WHEEL, DESIGN, EXPAND, LOCK, help/welcome/tour buttons.
//   1.3  StatusBar icons · Hash, Grid3x3, Sigma, Type, Palette inline.
//   1.4  ChartTypeSidebar collapse · width 240→36 with smooth transition.
//   1.5  DataSheet alternating rows + smoother hover (0.06 amber tint).
// Tier 2 (medium impact):
//   2.1  ColorPicker · two-tab (palette / custom) HSL/Hex/Eyedropper + recents.
//        Available via export — designed to drop into SelectionPopup, Properties, etc.
//   2.2  Welcome illustrations · animated SVG per step replacing Lucide icon.
//   2.3  Keyboard shortcuts wired: ⌘D ⌘L ⌘⇧C ⌘⇧E (plus existing W M ? ⌘Z).
//   2.4  Wheel polish · sequential wedge stagger via cm2WedgePop, hover scale 1.22,
//        amber glow ring on hover.
//   2.5  GrainOverlay component · fixed SVG noise filter at 0.5 opacity.
// Tier 3 (deeper polish):
//   3.1  Custom drag cursors · CURSOR_SPLIT_V / CURSOR_SPLIT_H constants exported.
//   3.2  Sound manager · WebAudio-based playTone, SoundToggle, persisted.
//   3.3  AmbientParticles · 10 floating dots, mounted in main + ExpandedShell.
//   3.4  Vignette · canvas inset shadow, toggle in Design drawer.
//   3.5  Typography · TYPOGRAPHY tokens + typo() helper for new UI.
//   3.6  Modal entry animations · expand uses transformOrigin from anchor coords.
// Tier 4 (power moves):
//   4.1  MiniChartPreview · 160×92 SVG of every chart family in TemplateCard.
//   4.2  Branded export footer · "Built with POAST" added to PNG / SVG when on.
//   4.3  Cinematic transition · cm2FlipMorph + transformOrigin morph for expand.
//   4.4  AppThemeToggle · Sun/Moon switcher persisted to localStorage.
//   4.5  OnboardingTour · 6-step spotlight + tooltip-card walkthrough.
// ═══════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════
// WAVE 14 · TYPE-AHEAD CHART-TYPE SEARCH
// Compact filter input above ChartTypeSidebar for quickly jumping types.
// Highlights matching characters; arrow keys navigate; Enter selects.
// ═══════════════════════════════════════════════════════════════════════════

interface TypeSearchProps { onSelect: (t: ChartType) => void; active: ChartType; onClose?: () => void }

function ChartTypeSearch({ onSelect, active, onClose }: TypeSearchProps) {
  const [query, setQuery] = useState("");
  const [activeIdx, setActiveIdx] = useState(0);
  const allTypes = useMemo(() => TYPES.flat().filter(t => t.working), []);
  const filtered = useMemo(() => {
    if (!query) return allTypes;
    const q = query.toLowerCase();
    return allTypes
      .map(t => ({ t, score: t.label.toLowerCase().includes(q) ? (t.label.toLowerCase().startsWith(q) ? 100 : 50) : 0 }))
      .filter(x => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .map(x => x.t);
  }, [query, allTypes]);
  useEffect(() => { setActiveIdx(0); }, [query]);
  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setActiveIdx(i => Math.min(filtered.length - 1, i + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActiveIdx(i => Math.max(0, i - 1)); }
    else if (e.key === "Enter") {
      e.preventDefault();
      const sel = filtered[activeIdx];
      if (sel) { onSelect(sel.id); onClose?.(); }
    }
    else if (e.key === "Escape") { onClose?.(); }
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <input
        value={query}
        onChange={e => setQuery(e.target.value)}
        onKeyDown={onKey}
        placeholder="Search chart types…"
        autoFocus
        style={{
          padding: "8px 10px", borderRadius: 7,
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.10)",
          color: C.tx, fontFamily: ft, fontSize: 12, fontWeight: 600,
          outline: "none",
        }}
      />
      <div style={{ display: "flex", flexDirection: "column", gap: 2, maxHeight: 320, overflowY: "auto" }}>
        {filtered.map((t, i) => {
          const on = active === t.id;
          const isCursor = i === activeIdx;
          return (
            <button
              key={t.id}
              onClick={() => { onSelect(t.id); onClose?.(); }}
              onMouseEnter={() => setActiveIdx(i)}
              style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "8px 10px", borderRadius: 7,
                background: on ? C.amber + "1A" : (isCursor ? "rgba(255,255,255,0.05)" : "transparent"),
                border: "1px solid " + (on ? C.amber + "55" : (isCursor ? "rgba(255,255,255,0.10)" : "transparent")),
                color: on ? C.amber : (isCursor ? C.tx : C.txm),
                cursor: "pointer", textAlign: "left",
                transition: "all 0.14s",
              }}
            >
              <t.Icon size={14} strokeWidth={2.0} color={on ? C.amber : (isCursor ? C.tx : C.txd)} />
              <span style={{ flex: 1, fontFamily: ft, fontSize: 12, fontWeight: 600 }}>{t.label}</span>
              {on && <span style={{ fontFamily: mn, fontSize: 8, color: C.amber, fontWeight: 800, letterSpacing: 0.6 }}>ACTIVE</span>}
            </button>
          );
        })}
        {filtered.length === 0 && (
          <div style={{ padding: "12px 10px", fontFamily: mn, fontSize: 10, color: C.txd, textAlign: "center" }}>No matches</div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// WAVE 14 · COLOR PICKER POPOVER · click anchor to open the picker
// ═══════════════════════════════════════════════════════════════════════════

function ColorPickerPopover({ value, palette, onChange, anchor, label = "Color" }: {
  value: string;
  palette: string[];
  onChange: (c: string) => void;
  anchor?: React.ReactNode;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (wrapRef.current && wrapRef.current.contains(t)) return;
      setOpen(false);
    };
    setTimeout(() => document.addEventListener("mousedown", close), 0);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);
  return (
    <div ref={wrapRef} style={{ position: "relative", display: "inline-block" }}>
      <button
        onClick={() => setOpen(v => !v)}
        title={label}
        style={{
          width: 22, height: 22, borderRadius: 5,
          background: value, border: "1px solid rgba(255,255,255,0.20)",
          cursor: "pointer", padding: 0,
          boxShadow: "0 1px 3px rgba(0,0,0,0.30) inset",
        }}
      >
        {anchor}
      </button>
      {open && (
        <div style={{
          position: "absolute", right: 0, top: "calc(100% + 4px)", zIndex: 1500,
          animation: "cm2WelcomePop 0.22s cubic-bezier(.2,.7,.2,1) both",
        }}>
          <ColorPicker value={value} palette={palette} onChange={c => { onChange(c); setOpen(false); }} onClose={() => setOpen(false)} />
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// WAVE 14 · TOOLTIP REGISTRY · global tooltip definitions for high-traffic UI
// Centralized so all tooltips have consistent voice, length, shortcut chips.
// ═══════════════════════════════════════════════════════════════════════════

interface TooltipDef { label: string; shortcut?: string; position?: "top" | "bottom" | "left" | "right"; }
export const TOOLTIPS: Record<string, TooltipDef> = {
  typeWheel: { label: "Open chart-type wheel", shortcut: "W", position: "bottom" },
  templates: { label: "Quick-start templates", shortcut: "⌘T", position: "bottom" },
  paste: { label: "Paste TSV / CSV from clipboard", position: "bottom" },
  importExcel: { label: "Import .xlsx workbook", shortcut: "⌘E", position: "bottom" },
  numFmt: { label: "Number format", position: "bottom" },
  design: { label: "Design panel", shortcut: "⌘D", position: "bottom" },
  lock: { label: "Lock chart from edits", shortcut: "⌘L", position: "bottom" },
  expand: { label: "Open expanded webapp", shortcut: "⌘⇧E", position: "bottom" },
  exportPng: { label: "Export PNG", shortcut: "⌘⇧C", position: "bottom" },
  undo: { label: "Undo last change", shortcut: "⌘Z", position: "bottom" },
  redo: { label: "Redo", shortcut: "⌘⇧Z", position: "bottom" },
  helpShortcuts: { label: "Keyboard shortcuts", shortcut: "?", position: "left" },
  helpWelcome: { label: "Welcome / onboarding", position: "left" },
  helpTour: { label: "Interactive tour", position: "left" },
  soundToggle: { label: "Toggle UI sound effects", position: "bottom" },
  themeToggle: { label: "Toggle dark / light theme", position: "bottom" },
};

// ═══════════════════════════════════════════════════════════════════════════
// WAVE 14 · BUSY BANNER · for long-running async operations (export, import)
// ═══════════════════════════════════════════════════════════════════════════

function BusyBanner({ label }: { label: string }) {
  return (
    <div
      style={{
        position: "fixed", top: 16, left: "50%", transform: "translateX(-50%)",
        zIndex: 13800,
        padding: "10px 16px", borderRadius: 12,
        background: "rgba(13,13,18,0.95)",
        backdropFilter: "blur(14px) saturate(140%)",
        WebkitBackdropFilter: "blur(14px) saturate(140%)",
        border: "1px solid " + C.amber + "44",
        boxShadow: "0 12px 40px rgba(0,0,0,0.55), 0 0 24px " + C.amber + "33",
        display: "inline-flex", alignItems: "center", gap: 12,
        animation: "cm2WelcomePop 0.22s cubic-bezier(.2,.7,.2,1) both",
      }}
    >
      <span style={{
        width: 14, height: 14, borderRadius: "50%",
        border: "2px solid " + C.amber + "44",
        borderTopColor: C.amber,
        animation: "cm2WelcomeRotate 0.8s linear infinite",
      }} />
      <span style={{ fontFamily: mn, fontSize: 11, fontWeight: 800, letterSpacing: 0.6, color: C.tx }}>{label}</span>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// WAVE 14 · CHART CARD GLOW · subtle ambient glow that follows cursor on the
// chart card (parallax-style, very low opacity). Adds depth.
// ═══════════════════════════════════════════════════════════════════════════

function ChartCardGlow({ enabled = true }: { enabled?: boolean }) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!enabled) return;
    const onMove = (e: MouseEvent) => {
      const r = wrapRef.current?.parentElement?.getBoundingClientRect();
      if (!r) return;
      setPos({ x: e.clientX - r.left, y: e.clientY - r.top });
    };
    const onLeave = () => setPos(null);
    const parent = wrapRef.current?.parentElement;
    parent?.addEventListener("mousemove", onMove);
    parent?.addEventListener("mouseleave", onLeave);
    return () => {
      parent?.removeEventListener("mousemove", onMove);
      parent?.removeEventListener("mouseleave", onLeave);
    };
  }, [enabled]);
  if (!enabled) return null;
  return (
    <div
      ref={wrapRef}
      aria-hidden
      style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        zIndex: 0, borderRadius: 16, overflow: "hidden",
      }}
    >
      {pos && (
        <div
          style={{
            position: "absolute",
            left: pos.x - 200, top: pos.y - 200,
            width: 400, height: 400, borderRadius: "50%",
            background: `radial-gradient(circle, ${C.amber}10 0%, transparent 70%)`,
            transition: "opacity 0.3s ease",
            mixBlendMode: "soft-light",
          }}
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// WAVE 14 · SHORTCUT CHIP · standalone chip for showing a key chord inline
// ═══════════════════════════════════════════════════════════════════════════

function ShortcutChip({ keys, size = "md" }: { keys: string; size?: "sm" | "md" | "lg" }) {
  const sizeMap = {
    sm: { padding: "1px 5px", fontSize: 8 },
    md: { padding: "2px 6px", fontSize: 9 },
    lg: { padding: "3px 8px", fontSize: 10 },
  };
  const s = sizeMap[size];
  return (
    <span
      style={{
        display: "inline-flex", alignItems: "center", gap: 2,
        fontFamily: mn, fontWeight: 800, letterSpacing: 0.5,
        color: C.amber,
        padding: s.padding,
        fontSize: s.fontSize,
        borderRadius: 4,
        background: C.amber + "1A",
        border: "1px solid " + C.amber + "44",
      }}
    >
      {keys}
    </span>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// WAVE 14 · GHOST BUTTON · low-emphasis button shared style
// ═══════════════════════════════════════════════════════════════════════════

function GhostButton({ onClick, children, Icon, title, danger }: {
  onClick?: () => void;
  children?: React.ReactNode;
  Icon?: LucideIconCmp;
  title?: string;
  danger?: boolean;
}) {
  const [hov, setHov] = useState(false);
  const accent = danger ? "#E06347" : "rgba(232,228,221,1)";
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      title={title}
      style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        padding: "7px 11px", borderRadius: 7,
        background: hov ? "rgba(255,255,255,0.06)" : "transparent",
        border: "1px solid " + (hov ? (danger ? "rgba(224,99,71,0.40)" : "rgba(255,255,255,0.18)") : "rgba(255,255,255,0.10)"),
        color: hov ? accent : (danger ? "rgba(224,99,71,0.85)" : C.txm),
        fontFamily: mn, fontSize: 10, fontWeight: 800, letterSpacing: 0.5,
        cursor: "pointer", textTransform: "uppercase",
        transition: "all 0.14s cubic-bezier(.2,.7,.2,1)",
      }}
    >
      {Icon && <Icon size={11} strokeWidth={2.4} />}
      {children}
    </button>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// WAVE 14 · KEY-COMBO LIST RENDERER
// Renders a vertical list of shortcuts with chip + description for the
// shortcuts overlay or any tooltip help card.
// ═══════════════════════════════════════════════════════════════════════════

function KeyComboList({ category }: { category?: ShortcutEntry["category"] }) {
  const items = category ? SHORTCUTS_V14.filter(s => s.category === category) : SHORTCUTS_V14;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {items.map(s => (
        <div
          key={s.id}
          style={{
            display: "flex", alignItems: "center", gap: 10,
            padding: "6px 8px", borderRadius: 6,
            background: "rgba(255,255,255,0.025)",
            border: "1px solid rgba(255,255,255,0.05)",
          }}
        >
          <ShortcutChip keys={s.keys} size="sm" />
          <span style={{ flex: 1, fontFamily: ft, fontSize: 11.5, color: C.tx, fontWeight: 500 }}>{s.description}</span>
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// WAVE 14 · COMMAND PALETTE · ⌘K-style fuzzy command list
// Future-ready scaffold; not yet wired into main render but exported for
// future Wave 15 work. Searches commands by name and runs them on Enter.
// ═══════════════════════════════════════════════════════════════════════════

interface CommandDef {
  id: string;
  label: string;
  category: "Chart" | "Data" | "View" | "Export" | "Help";
  keywords?: string[];
  shortcut?: string;
  Icon?: LucideIconCmp;
  run: () => void;
}

function CommandPalette({ commands, onClose }: { commands: CommandDef[]; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [activeIdx, setActiveIdx] = useState(0);
  const filtered = useMemo(() => {
    if (!query) return commands;
    const q = query.toLowerCase();
    return commands.filter(c => {
      const haystack = [c.label, c.category, ...(c.keywords || [])].join(" ").toLowerCase();
      return haystack.includes(q);
    });
  }, [query, commands]);
  useEffect(() => { setActiveIdx(0); }, [query]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowDown") { e.preventDefault(); setActiveIdx(i => Math.min(filtered.length - 1, i + 1)); }
      else if (e.key === "ArrowUp") { e.preventDefault(); setActiveIdx(i => Math.max(0, i - 1)); }
      else if (e.key === "Enter") {
        e.preventDefault();
        const sel = filtered[activeIdx];
        if (sel) { sel.run(); onClose(); }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [filtered, activeIdx, onClose]);
  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, zIndex: 13900,
      background: "rgba(6,6,12,0.78)",
      backdropFilter: "blur(14px) saturate(140%)",
      WebkitBackdropFilter: "blur(14px) saturate(140%)",
      display: "flex", alignItems: "flex-start", justifyContent: "center",
      padding: "120px 20px 20px",
      animation: "cm2WelcomeFade 0.18s cubic-bezier(.2,.7,.2,1) both",
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: "min(640px, 92vw)",
        background: "#0D0D14",
        border: "1px solid rgba(255,255,255,0.10)",
        borderRadius: 12,
        boxShadow: "0 32px 80px rgba(0,0,0,0.55), 0 0 0 1px rgba(247,176,65,0.10)",
        animation: "cm2WelcomePop 0.22s cubic-bezier(.2,.7,.2,1) both",
        overflow: "hidden",
      }}>
        <div style={{ padding: "14px 18px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Type a command or search…"
            autoFocus
            style={{
              width: "100%", border: "none", outline: "none",
              background: "transparent",
              fontFamily: ft, fontSize: 16, fontWeight: 500,
              color: C.tx,
            }}
          />
        </div>
        <div style={{ maxHeight: 380, overflowY: "auto", padding: 8 }}>
          {filtered.map((c, i) => {
            const cursor = i === activeIdx;
            return (
              <button
                key={c.id}
                onClick={() => { c.run(); onClose(); }}
                onMouseEnter={() => setActiveIdx(i)}
                style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "10px 12px", width: "100%", borderRadius: 7,
                  background: cursor ? "rgba(247,176,65,0.10)" : "transparent",
                  border: "1px solid " + (cursor ? "rgba(247,176,65,0.30)" : "transparent"),
                  color: cursor ? C.tx : C.txm,
                  cursor: "pointer", textAlign: "left",
                  transition: "all 0.12s",
                }}
              >
                {c.Icon && <c.Icon size={14} strokeWidth={2.0} color={cursor ? C.amber : C.txm} />}
                <span style={{ fontFamily: ft, fontSize: 12.5, fontWeight: 600, flex: 1 }}>{c.label}</span>
                <span style={{ fontFamily: mn, fontSize: 8, color: C.txd, letterSpacing: 0.6, padding: "2px 6px", borderRadius: 3, background: "rgba(255,255,255,0.04)" }}>
                  {c.category.toUpperCase()}
                </span>
                {c.shortcut && <ShortcutChip keys={c.shortcut} size="sm" />}
              </button>
            );
          })}
          {filtered.length === 0 && (
            <div style={{ padding: 24, textAlign: "center", fontFamily: mn, fontSize: 11, color: C.txd, letterSpacing: 0.5 }}>
              No commands matching &ldquo;{query}&rdquo;
            </div>
          )}
        </div>
        <div style={{ padding: "10px 16px", borderTop: "1px solid rgba(255,255,255,0.05)", display: "flex", alignItems: "center", gap: 14, fontFamily: mn, fontSize: 8, color: C.txd, letterSpacing: 0.6, textTransform: "uppercase" as React.CSSProperties["textTransform"] }}>
          <span><ShortcutChip keys="↑↓" size="sm" /> navigate</span>
          <span><ShortcutChip keys="↵" size="sm" /> select</span>
          <span><ShortcutChip keys="Esc" size="sm" /> close</span>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// WAVE 14 · ASCII CHART STAMP · prints a tiny ASCII chart in console for fun
// (only when explicitly enabled via window.cm2Stamp = true). Easter-egg.
// ═══════════════════════════════════════════════════════════════════════════

export function asciiStamp(values: number[], width = 32) {
  const max = Math.max(...values, 1);
  const bars = "▁▂▃▄▅▆▇█";
  return values
    .slice(0, width)
    .map(v => bars[Math.min(bars.length - 1, Math.floor((v / max) * (bars.length - 1)))])
    .join("");
}

// ═══════════════════════════════════════════════════════════════════════════
// WAVE 14 · MINI SPARKLINE · for inline data badges (e.g., status bar)
// ═══════════════════════════════════════════════════════════════════════════

function MiniSparkline({ values, width = 60, height = 16, color = C.amber }: {
  values: number[];
  width?: number;
  height?: number;
  color?: string;
}) {
  if (values.length < 2) return null;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = Math.max(1, max - min);
  const pts = values.map((v, i) => ({
    x: (i / (values.length - 1)) * width,
    y: height - 2 - ((v - min) / span) * (height - 4),
  }));
  const d = "M " + pts.map(p => p.x.toFixed(1) + " " + p.y.toFixed(1)).join(" L ");
  return (
    <svg width={width} height={height} style={{ display: "inline-block", verticalAlign: "middle" }}>
      <path d={d} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={pts[pts.length - 1].x} cy={pts[pts.length - 1].y} r={1.6} fill={color} />
    </svg>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// WAVE 14 · KEY HINT BAR · floating bar of contextual key hints
// (e.g., "Esc to close · ↑↓ navigate · Enter to select")
// ═══════════════════════════════════════════════════════════════════════════

interface KeyHintBarItem { keys: string; label: string }

function KeyHintBar({ items, position = "bottom" }: { items: KeyHintBarItem[]; position?: "top" | "bottom" }) {
  return (
    <div
      style={{
        position: "fixed",
        left: "50%", transform: "translateX(-50%)",
        [position]: 24,
        zIndex: 14200,
        display: "inline-flex", alignItems: "center", gap: 14,
        padding: "8px 14px", borderRadius: 999,
        background: "rgba(13,13,18,0.92)",
        backdropFilter: "blur(14px) saturate(140%)",
        WebkitBackdropFilter: "blur(14px) saturate(140%)",
        border: "1px solid rgba(255,255,255,0.10)",
        boxShadow: "0 10px 28px rgba(0,0,0,0.45)",
        animation: "cm2TipFadeUp 0.22s cubic-bezier(.2,.7,.2,1) both",
      }}
    >
      {items.map((it, i) => (
        <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
          <ShortcutChip keys={it.keys} size="sm" />
          <span style={{ fontFamily: mn, fontSize: 9, fontWeight: 700, letterSpacing: 0.6, color: C.txm, textTransform: "uppercase" as React.CSSProperties["textTransform"] }}>{it.label}</span>
        </span>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// WAVE 14 · ANIMATED COUNTER · counts up/down to a target value smoothly
// ═══════════════════════════════════════════════════════════════════════════

function AnimatedCounter({ value, duration = 600, formatter = (n: number) => String(Math.round(n)) }: {
  value: number;
  duration?: number;
  formatter?: (n: number) => string;
}) {
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);
  const startRef = useRef<number>(0);
  useEffect(() => {
    fromRef.current = display;
    startRef.current = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const elapsed = now - startRef.current;
      const t = Math.min(1, elapsed / duration);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - t, 3);
      const next = fromRef.current + (value - fromRef.current) * eased;
      setDisplay(next);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, duration]);
  return <span style={{ fontFeatureSettings: "\"tnum\" 1" }}>{formatter(display)}</span>;
}

// ═══════════════════════════════════════════════════════════════════════════
// WAVE 14 · AVATAR STACK · used for collaborative editing markers (placeholder)
// ═══════════════════════════════════════════════════════════════════════════

interface AvatarSpec { name: string; color: string }

function AvatarStack({ avatars, max = 4 }: { avatars: AvatarSpec[]; max?: number }) {
  const visible = avatars.slice(0, max);
  const overflow = Math.max(0, avatars.length - max);
  return (
    <div style={{ display: "inline-flex", alignItems: "center" }}>
      {visible.map((a, i) => {
        const initials = a.name.split(/\s+/).map(p => p[0] || "").join("").slice(0, 2).toUpperCase();
        return (
          <div
            key={i}
            title={a.name}
            style={{
              width: 22, height: 22, borderRadius: "50%",
              background: a.color,
              border: "2px solid #0D0D14",
              marginLeft: i === 0 ? 0 : -6,
              fontFamily: mn, fontSize: 9, fontWeight: 800, color: "#0A0A0E",
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 0 0 1px rgba(0,0,0,0.30)",
            }}
          >
            {initials}
          </div>
        );
      })}
      {overflow > 0 && (
        <div
          title={`${overflow} more`}
          style={{
            width: 22, height: 22, borderRadius: "50%",
            background: "rgba(255,255,255,0.08)",
            border: "2px solid #0D0D14",
            marginLeft: -6,
            fontFamily: mn, fontSize: 9, fontWeight: 800, color: C.txm,
            display: "inline-flex", alignItems: "center", justifyContent: "center",
          }}
        >
          +{overflow}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// WAVE 14 · INSPECTOR ROW · key/value row for property inspectors
// ═══════════════════════════════════════════════════════════════════════════

function InspectorRow({ label, value, mono = false }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
      <span style={{ fontFamily: mn, fontSize: 9, color: C.txm, letterSpacing: 0.6, textTransform: "uppercase" as React.CSSProperties["textTransform"], fontWeight: 700, minWidth: 80 }}>{label}</span>
      <span style={{ flex: 1, fontFamily: mono ? mn : ft, fontSize: 11, color: C.tx, fontWeight: mono ? 700 : 600, textAlign: "right" }}>{value}</span>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// WAVE 14 · APPEARANCE SETTINGS · centralized panel for aesthetic preferences
// (sound, theme, motion, particles, grain, vignette, branding)
// Persists every option to localStorage. Reusable as a popover or modal.
// ═══════════════════════════════════════════════════════════════════════════

interface AppearanceState {
  sound: boolean;
  theme: AppTheme;
  reducedMotion: boolean;
  particles: boolean;
  grain: boolean;
  vignette: boolean;
  branding: boolean;
}

const APPEARANCE_DEFAULTS: AppearanceState = {
  sound: false,
  theme: "dark",
  reducedMotion: false,
  particles: true,
  grain: true,
  vignette: true,
  branding: false,
};

function readAppearanceFromStorage(): AppearanceState {
  if (typeof window === "undefined") return APPEARANCE_DEFAULTS;
  const out = { ...APPEARANCE_DEFAULTS };
  try {
    out.sound = localStorage.getItem("cm2-sound-enabled") === "1";
    const theme = localStorage.getItem("cm2-app-theme");
    if (theme === "dark" || theme === "light") out.theme = theme;
    out.reducedMotion = localStorage.getItem("cm2-reduced-motion") === "1";
    const part = localStorage.getItem("cm2-particles");
    if (part !== null) out.particles = part === "1";
    const grain = localStorage.getItem("cm2-grain");
    if (grain !== null) out.grain = grain === "1";
    const vignette = localStorage.getItem("cm2-vignette");
    if (vignette !== null) out.vignette = vignette === "1";
    out.branding = localStorage.getItem("cm2-export-branding") === "1";
  } catch {}
  return out;
}

function writeAppearance<K extends keyof AppearanceState>(key: K, value: AppearanceState[K]) {
  if (typeof window === "undefined") return;
  const map: Record<keyof AppearanceState, string> = {
    sound: "cm2-sound-enabled",
    theme: "cm2-app-theme",
    reducedMotion: "cm2-reduced-motion",
    particles: "cm2-particles",
    grain: "cm2-grain",
    vignette: "cm2-vignette",
    branding: "cm2-export-branding",
  };
  try {
    if (typeof value === "boolean") localStorage.setItem(map[key], value ? "1" : "0");
    else localStorage.setItem(map[key], String(value));
  } catch {}
}

function AppearancePanel({ onClose }: { onClose: () => void }) {
  const [state, setState] = useState<AppearanceState>(() => readAppearanceFromStorage());
  const update = <K extends keyof AppearanceState>(key: K, value: AppearanceState[K]) => {
    setState(s => ({ ...s, [key]: value }));
    writeAppearance(key, value);
  };
  const Row = ({ label, sub, right }: { label: string; sub: string; right: React.ReactNode }) => (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: ft, fontSize: 12.5, fontWeight: 700, color: C.tx }}>{label}</div>
        <div style={{ fontFamily: mn, fontSize: 9, color: C.txm, letterSpacing: 0.4, marginTop: 2 }}>{sub}</div>
      </div>
      {right}
    </div>
  );
  const Toggle = ({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) => (
    <button
      onClick={() => onChange(!on)}
      style={{
        width: 40, height: 22, borderRadius: 11,
        background: on ? C.amber + "AA" : "rgba(255,255,255,0.10)",
        border: "1px solid " + (on ? C.amber : "rgba(255,255,255,0.10)"),
        cursor: "pointer", padding: 0, position: "relative",
        transition: "all 0.18s cubic-bezier(.2,.7,.2,1)",
      }}
    >
      <span style={{
        position: "absolute", top: 2, left: on ? 20 : 2,
        width: 16, height: 16, borderRadius: "50%",
        background: on ? "#0A0A0E" : "rgba(232,228,221,0.9)",
        transition: "left 0.18s cubic-bezier(.2,.7,.2,1)",
        boxShadow: "0 1px 3px rgba(0,0,0,0.30)",
      }} />
    </button>
  );
  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, zIndex: 13700,
      background: "rgba(6,6,12,0.74)",
      backdropFilter: "blur(14px) saturate(140%)",
      WebkitBackdropFilter: "blur(14px) saturate(140%)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
      animation: "cm2WelcomeFade 0.22s cubic-bezier(.2,.7,.2,1) both",
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: "min(520px, 96vw)",
        background: "linear-gradient(180deg, #11111A 0%, #0A0A12 100%)",
        border: "1px solid rgba(255,255,255,0.10)",
        borderRadius: 14,
        boxShadow: "0 32px 80px rgba(0,0,0,0.65), 0 0 0 1px " + C.amber + "20",
        overflow: "hidden",
        animation: "cm2WelcomePop 0.28s cubic-bezier(.2,.7,.2,1) both",
      }}>
        <div style={{ padding: "16px 18px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", gap: 10 }}>
          <Settings size={14} strokeWidth={2.4} color={C.amber} />
          <span style={{ fontFamily: gf, fontSize: 16, fontWeight: 900, color: C.tx, letterSpacing: -0.2 }}>Appearance</span>
          <span style={{ flex: 1 }} />
          <button onClick={onClose} style={{
            width: 28, height: 28, borderRadius: 7,
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.10)",
            color: C.txm, cursor: "pointer",
            display: "inline-flex", alignItems: "center", justifyContent: "center",
          }}><XIcon size={13} strokeWidth={2.4} /></button>
        </div>
        <div>
          <Row label="Theme" sub="Switch between dark and light app chrome." right={
            <div style={{ display: "inline-flex", padding: 3, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 999 }}>
              {(["dark", "light"] as const).map(t => {
                const on = state.theme === t;
                return (
                  <button key={t} onClick={() => update("theme", t)} style={{
                    padding: "5px 12px", borderRadius: 999,
                    background: on ? C.amber + "22" : "transparent",
                    border: "none", color: on ? C.amber : C.txm,
                    fontFamily: mn, fontSize: 9, fontWeight: 800, letterSpacing: 0.6, cursor: "pointer", textTransform: "uppercase",
                  }}>{t}</button>
                );
              })}
            </div>
          } />
          <Row label="UI Sound" sub="Subtle audio feedback on key actions." right={<Toggle on={state.sound} onChange={v => update("sound", v)} />} />
          <Row label="Reduced Motion" sub="Disable transitions and animations." right={<Toggle on={state.reducedMotion} onChange={v => update("reducedMotion", v)} />} />
          <Row label="Ambient Particles" sub="10 floating dots drifting in the background." right={<Toggle on={state.particles} onChange={v => update("particles", v)} />} />
          <Row label="Grain Texture" sub="Subtle SVG noise overlay (mix-blend overlay)." right={<Toggle on={state.grain} onChange={v => update("grain", v)} />} />
          <Row label="Vignette" sub="Soft inset shadow on the chart canvas." right={<Toggle on={state.vignette} onChange={v => update("vignette", v)} />} />
          <Row label="Branded Export" sub="Add a 'Built with POAST' line on PNG/SVG exports." right={<Toggle on={state.branding} onChange={v => update("branding", v)} />} />
        </div>
        <div style={{ padding: "12px 18px", borderTop: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ flex: 1, fontFamily: mn, fontSize: 9, color: C.txd, letterSpacing: 0.5 }}>Stored locally · refresh to apply theme switches.</span>
          <button onClick={onClose} style={{
            padding: "8px 16px", borderRadius: 7,
            background: `linear-gradient(135deg, ${C.amber} 0%, ${C.amber}cc 100%)`,
            border: "1px solid " + C.amber + "88",
            color: "#0A0A0E", fontFamily: mn, fontSize: 9, fontWeight: 900, letterSpacing: 0.6, cursor: "pointer", textTransform: "uppercase",
            boxShadow: `0 6px 18px ${C.amber}55, 0 1px 0 rgba(255,255,255,0.20) inset`,
          }}>Done</button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// WAVE 14 · UTILITY · DEBOUNCED VALUE
// ═══════════════════════════════════════════════════════════════════════════

function useDebouncedValue<T>(value: T, delay = 250): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

// ═══════════════════════════════════════════════════════════════════════════
// WAVE 14 · UTILITY · KEYBOARD CHORD MATCHER
// ═══════════════════════════════════════════════════════════════════════════

interface ChordSpec { meta?: boolean; ctrl?: boolean; shift?: boolean; alt?: boolean; key: string }

function matchesChord(e: KeyboardEvent, spec: ChordSpec): boolean {
  const k = e.key.toLowerCase();
  if (k !== spec.key.toLowerCase()) return false;
  if (!!spec.shift !== e.shiftKey) return false;
  if (!!spec.alt !== e.altKey) return false;
  // Treat meta + ctrl interchangeably (mac vs win)
  const wantMod = !!(spec.meta || spec.ctrl);
  const haveMod = e.metaKey || e.ctrlKey;
  return wantMod === haveMod;
}

// Parse a pretty-form shortcut string like "⌘⇧E" into a ChordSpec
function parseChord(pretty: string): ChordSpec {
  const spec: ChordSpec = { key: "" };
  let i = 0;
  while (i < pretty.length) {
    const ch = pretty[i];
    if (ch === "⌘" || ch === "^") spec.meta = true;
    else if (ch === "⇧") spec.shift = true;
    else if (ch === "⌥") spec.alt = true;
    else { spec.key = pretty.slice(i); break; }
    i++;
  }
  return spec;
}

// ═══════════════════════════════════════════════════════════════════════════
// WAVE 14 · UTILITY · LIGHTNESS-AWARE TEXT COLOR
// Picks black or white text given a hex background to maintain contrast.
// ═══════════════════════════════════════════════════════════════════════════

export function readableTextOn(hex: string): string {
  let h = hex.replace("#", "");
  if (h.length === 3) h = h.split("").map(c => c + c).join("");
  if (h.length !== 6) return "#0A0A0E";
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  // Luminance formula
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return lum > 0.55 ? "#0A0A0E" : "#FFFFFF";
}

// ═══════════════════════════════════════════════════════════════════════════
// WAVE 14 · UTILITY · DEEP CLONE (cheap, JSON-safe)
// ═══════════════════════════════════════════════════════════════════════════

export function jsonClone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

// ═══════════════════════════════════════════════════════════════════════════
// END · WAVE 14 BEAUTIFICATION PASS
// ═══════════════════════════════════════════════════════════════════════════
