"use client";
import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { D as C, ft, gf, mn } from "./shared-constants";
import { showToast } from "./toast-context";
import {
  Calendar, Download, Eye, EyeOff, Plus, X, ChevronUp, ChevronDown,
  BarChart3, Columns3, AlignVerticalDistributeCenter, AlignVerticalJustifyCenter,
  TrendingUp, TrendingDown, Grid3x3, GitBranch,
  LineChart, Activity, Layers,
  PieChart, Disc, ScatterChart, Circle,
  GanttChart,
  Undo2, Redo2, Hash, Sigma, ArrowUpDown, Minus, Trash2,
  FileCode2, ArrowLeftRight, Square, Diamond, MinusSquare,
} from "lucide-react";

// ═══════════════════════════════════════════════════════════════════════════
// CHART TYPE REGISTRY · maps Think-cell's grid to in-app renderers
// ═══════════════════════════════════════════════════════════════════════════

type ChartType =
  | "stacked" | "pct" | "clustered" | "wfup" | "wfdn"
  | "mekkoPct" | "combo" | "line" | "stackedArea" | "pctArea"
  | "mekkoUnit" | "pie" | "doughnut" | "scatter" | "bubble"
  | "variance" | "gantt";

type ThemeId = "core" | "spectrum" | "brand";

// Three palettes: Core (12 saturated, brand-friendly hues), Spectrum
// (12 colors spanning the full hue circle), Brand (SA brand colors +
// neutrals for slide work). Each renderer cycles palette[i % length]
// so as long as series count <= 12, every series gets a unique color.
const THEMES: Record<ThemeId, { name: string; sub: string; colors: string[] }> = {
  core: {
    name: "Core",
    sub: "12 saturated brand-friendly hues",
    colors: [
      C.amber, C.blue, C.teal, C.coral, "#905CCB", "#26C9D8",
      "#E8A020", "#0F5C8E", "#1D7762", "#C04830", "#6F40A8", "#1AA0AE",
    ],
  },
  spectrum: {
    name: "Spectrum",
    sub: "12 colors across the hue wheel",
    colors: [
      "#E06347", "#F7913A", "#F7B041", "#F0DC4F",
      "#B5DC4F", "#4FBF6B", "#2EAD8E", "#26C9D8",
      "#0B86D1", "#6E5BD4", "#905CCB", "#C45CB5",
    ],
  },
  brand: {
    name: "Brand",
    sub: "SA brand + neutrals",
    colors: [
      C.amber, C.blue, C.teal, C.coral, "#905CCB", "#26C9D8",
      "#E8E4DD", "#A8A4A0", "#7E7B78", "#5C5A57", "#3F3D3B", "#28272A",
    ],
  },
};

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
    { id: "mekkoPct",    label: "Mekko %",    Icon: Grid3x3,                          working: false },
    { id: "combo",       label: "Combo",      Icon: GitBranch,                        working: false },
    { id: "line",        label: "Line",       Icon: LineChart,                        working: true  },
    { id: "stackedArea", label: "Stacked Area", Icon: Layers,                         working: true  },
    { id: "pctArea",     label: "100% Area",  Icon: Activity,                         working: false },
  ],
  [
    { id: "mekkoUnit",   label: "Mekko Unit", Icon: BarChart3,                        working: false },
    { id: "pie",         label: "Pie",        Icon: PieChart,                         working: true  },
    { id: "doughnut",    label: "Doughnut",   Icon: Disc,                             working: true  },
    { id: "scatter",     label: "Scatter",    Icon: ScatterChart,                     working: true  },
    { id: "bubble",      label: "Bubble",     Icon: Circle,                           working: false },
  ],
  [
    { id: "gantt",       label: "Gantt",      Icon: GanttChart,                       working: true  },
  ],
];

// ═══════════════════════════════════════════════════════════════════════════
// EDITABLE DATASHEET · Excel-style grid with cell-level editing, tab nav,
// add/remove rows + columns
// ═══════════════════════════════════════════════════════════════════════════
function DataSheetGrid({ sheet, onChange }: { sheet: DataSheet; onChange: (s: DataSheet) => void }) {
  const setCell = (rowIdx: number, key: string, raw: string) => {
    const next = sheet.rows.slice();
    const col = sheet.schema.find(c => c.key === key);
    let v: CellValue = raw;
    if (col && (col.type === "number" || col.type === "percent")) {
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
  };
  const renameCol = (key: string, newLabel: string) => {
    onChange({ ...sheet, schema: sheet.schema.map(c => c.key === key ? { ...c, label: newLabel } : c) });
  };
  const addCol = () => {
    let n = 1;
    while (sheet.schema.some(c => c.key === "s" + n)) n++;
    const newCol: ColumnSpec = { key: "s" + n, label: "Series " + n, type: "number" };
    const newRows = sheet.rows.map(r => ({ ...r, [newCol.key]: 0 }));
    onChange({ schema: [...sheet.schema, newCol], rows: newRows });
  };
  const removeCol = (key: string) => {
    if (sheet.schema.length <= 2) return;
    const newRows = sheet.rows.map(r => {
      const { [key]: _, ...rest } = r;
      return rest;
    });
    onChange({ schema: sheet.schema.filter(c => c.key !== key), rows: newRows });
  };

  const cellInput: React.CSSProperties = {
    width: "100%", padding: "7px 9px", border: "1px solid transparent",
    background: "transparent", color: C.tx, fontFamily: ft, fontSize: 12,
    outline: "none", boxSizing: "border-box",
  };
  const headerInput: React.CSSProperties = {
    ...cellInput,
    fontFamily: mn, fontSize: 10, fontWeight: 700, color: C.amber,
    letterSpacing: 0.6, textTransform: "uppercase",
  };

  return (
    <div style={{ background: "#0A0A0E", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, overflow: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0 }}>
        <thead>
          <tr>
            <th style={{ width: 32, background: "#0A0A0E", borderBottom: "1px solid rgba(255,255,255,0.08)", padding: 0 }} />
            {sheet.schema.map((col, i) => (
              <th key={col.key} style={{ background: "#0A0A0E", borderBottom: "1px solid rgba(255,255,255,0.08)", borderLeft: i === 0 ? "none" : "1px solid rgba(255,255,255,0.04)", padding: 0, position: "relative" }}>
                <CellInput
                  value={col.label}
                  onCommit={v => renameCol(col.key, v || col.label)}
                  style={headerInput}
                />
                {sheet.schema.length > 2 && (
                  <span onClick={() => removeCol(col.key)} title="Remove column" style={{ position: "absolute", top: 4, right: 4, cursor: "pointer", color: C.txd, padding: 2, lineHeight: 0 }}>
                    <X size={10} />
                  </span>
                )}
              </th>
            ))}
            <th style={{ width: 36, background: "#0A0A0E", borderBottom: "1px solid rgba(255,255,255,0.08)", padding: 0 }}>
              <span onClick={addCol} title="Add column" style={{ display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: C.txm, padding: "8px 0" }}>
                <Plus size={12} strokeWidth={2.2} />
              </span>
            </th>
          </tr>
        </thead>
        <tbody>
          {sheet.rows.map((row, r) => (
            <tr key={r} style={{ background: r % 2 === 0 ? "transparent" : "rgba(255,255,255,0.012)" }}>
              <td style={{ width: 32, textAlign: "center", borderTop: "1px solid rgba(255,255,255,0.04)", color: C.txd, fontFamily: mn, fontSize: 9 }}>
                <span onClick={() => removeRow(r)} title="Remove row" style={{ cursor: "pointer", padding: 4, display: "inline-flex" }}>
                  <X size={10} />
                </span>
              </td>
              {sheet.schema.map((col, ci) => (
                <td key={col.key} style={{ borderTop: "1px solid rgba(255,255,255,0.04)", borderLeft: ci === 0 ? "none" : "1px solid rgba(255,255,255,0.03)", padding: 0 }}>
                  <CellInput
                    value={String(row[col.key] ?? "")}
                    onCommit={v => setCell(r, col.key, v)}
                    style={cellInput}
                  />
                </td>
              ))}
              <td style={{ width: 36, borderTop: "1px solid rgba(255,255,255,0.04)" }} />
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ padding: "8px 12px", borderTop: "1px solid rgba(255,255,255,0.06)", display: "flex", gap: 8 }}>
        <button onClick={addRow} style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 12px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.10)", background: "transparent", color: C.txm, fontFamily: mn, fontSize: 10, fontWeight: 700, letterSpacing: 0.5, cursor: "pointer" }}>
          <Plus size={11} strokeWidth={2.2} /> ROW
        </button>
        <button onClick={addCol} style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 12px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.10)", background: "transparent", color: C.txm, fontFamily: mn, fontSize: 10, fontWeight: 700, letterSpacing: 0.5, cursor: "pointer" }}>
          <Plus size={11} strokeWidth={2.2} /> COLUMN
        </button>
      </div>
    </div>
  );
}

// Cell input that stays controlled while the user types but mirrors
// upstream changes (e.g. a chart drag updating the same cell). Commits
// to the parent on blur or Enter so we don't fire setState on every
// keystroke through the whole sheet.
function CellInput({ value, onCommit, style }: { value: string; onCommit: (v: string) => void; style: React.CSSProperties }) {
  const [local, setLocal] = useState(value);
  const focusedRef = useRef(false);
  // Pull external updates (e.g. drag-set values) when not actively editing
  useEffect(() => { if (!focusedRef.current) setLocal(value); }, [value]);
  return (
    <input
      value={local}
      onChange={e => setLocal(e.target.value)}
      onFocus={e => { focusedRef.current = true; e.target.select(); }}
      onBlur={() => { focusedRef.current = false; if (local !== value) onCommit(local); }}
      onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); (e.target as HTMLInputElement).blur(); } if (e.key === "Escape") { setLocal(value); (e.target as HTMLInputElement).blur(); } }}
      style={style}
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

// Chart-wide number formatting · think-cell offers per-label control;
// we ship a chart-wide setting that covers the 8 most useful presets.
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

// ─── Annotations · think-cell-style overlays on top of the data ────────────
type Annotation =
  | { id: string; kind: "refline"; value: number; label?: string; color?: string }
  | { id: string; kind: "cagr"; rowFrom: number; rowTo: number; seriesKey: string }
  | { id: string; kind: "diff"; rowFrom: number; rowTo: number; seriesKey: string }
  // Free-form text callout placed via the ANNOTATE tool. x/y are in
  // SVG viewBox coords so positions stay stable across re-renders.
  | { id: string; kind: "callout"; x: number; y: number; text: string; color?: string };

type PickMode = null | { kind: "cagr" | "diff"; bars: Array<{ rowIdx: number; key: string }> };
// Single-click placement mode for the ANNOTATE TEXT tool — distinct
// from pickMode (multi-step). Click anywhere on the chart background
// to drop a callout.
type PlaceMode = null | { kind: "callout" };
type OnPickBar = (rowIdx: number, key: string) => boolean; // returns true if pick consumed the click

// Floating mini-toolbar selection · the click-to-select interaction that
// makes think-cell feel intuitive. Selection lives at chart-maker level
// so the toolbar can render on top of the SVG.
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

interface CatProps {
  sheet: DataSheet; cfg: ChartConfig; W: number; H: number;
  onUpdateRow?: OnUpdateRow;
  onDeleteRow?: OnDeleteRow;
  onShowMenu?: OnShowMenu;
  annotations?: Annotation[];
  pickMode?: PickMode;
  onPickBar?: OnPickBar;
  onSelect?: OnSelect;
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

function getCategoricalSeries(sheet: DataSheet) {
  const catCol = sheet.schema[0];
  const seriesCols = sheet.schema.slice(1).filter(c => c.type === "number" || c.type === "percent");
  const categories = sheet.rows.map(r => String(r[catCol.key] ?? ""));
  const series = seriesCols.map(s => ({ key: s.key, label: s.label, values: sheet.rows.map(r => Number(r[s.key]) || 0) }));
  return { categories, series };
}

function ChartFrame({ cfg, W, H, children, leftPad = 56, rightPad = 24, topPad = 70, bottomPad = 48 }: { cfg: ChartConfig; W: number; H: number; children: React.ReactNode; leftPad?: number; rightPad?: number; topPad?: number; bottomPad?: number }) {
  // Title block + chart area inside the SVG
  return (
    <g>
      <rect x="0" y="0" width={W} height={H} fill="#0A0A0E" />
      <text x={leftPad} y="28" fill="#E8E4DD" style={{ fontFamily: fontSans, fontSize: 18, fontWeight: 900 }}>{cfg.title}</text>
      <text x={leftPad} y="48" fill={C.txm} style={{ fontFamily: fontMono, fontSize: 10, letterSpacing: 1 }}>{cfg.subtitle.toUpperCase()}</text>
      <g transform={`translate(0, ${topPad})`}>
        {children}
      </g>
    </g>
  );
}

function StackedColumn({ sheet, cfg, W, H, onUpdateRow, onDeleteRow, onShowMenu, annotations, pickMode, onPickBar, onSelect, onSetSeriesColor }: CatProps) {
  void pickMode;
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
  const leftPad = 56, rightPad = 24, topPad = 70, bottomPad = 48;
  const chartW = W - leftPad - rightPad;
  const chartH = H - topPad - bottomPad;

  const totals = categories.map((_, i) => series.reduce((a, s) => a + s.values[i], 0));
  const maxVal = Math.max(0, ...totals);
  const ticks = niceTicks(0, maxVal, 5);
  const tickMax = ticks[ticks.length - 1];
  const yOf = (v: number) => chartH - (v / tickMax) * chartH;

  const groupW = chartW / categories.length;
  const barW = Math.min(groupW * 0.65, 80);

  // Drag the top edge of any segment to set its value. Pointer y maps to a
  // cumulative value (counting from baseline up); subtract the segments
  // below to get this segment's height.
  const dragRef = useRef<{ rowIdx: number; key: string; cumBelow: number } | null>(null);
  const cumValueAt = (e: React.PointerEvent): number | null => {
    const pt = pointerToSvg(e, e.currentTarget);
    if (!pt) return null;
    const localY = pt.y - topPad;
    return Math.max(0, tickMax * (1 - localY / chartH));
  };
  const onDown = (rowIdx: number, key: string, cumBelow: number) => (e: React.PointerEvent) => {
    if (!onUpdateRow) return;
    e.stopPropagation();
    if (onPickBar && onPickBar(rowIdx, key)) return;
    // Open the floating mini-toolbar on left-click (anchored to pointer)
    if (onSelect && e.button === 0) onSelect({ kind: "bar", rowIdx, key, color: palette[seriesKeys.indexOf(key) % palette.length], anchorX: e.clientX, anchorY: e.clientY });
    dragRef.current = { rowIdx, key, cumBelow };
    (e.target as Element).setPointerCapture?.(e.pointerId);
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
          <line x1={leftPad} x2={W - rightPad} y1={yOf(t)} y2={yOf(t)} stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
          <text x={leftPad - 8} y={yOf(t) + 4} textAnchor="end" fill={C.txm} style={{ fontFamily: fontMono, fontSize: 10 }}>{fmtVal(t, cfg.numFmt)}</text>
        </g>
      ))}
      {categories.map((cat, i) => {
        let cum = 0;
        return (
          <g key={i}>
            {series.map((s, si) => {
              const v = s.values[i];
              const cumBelow = cum;
              const y0 = yOf(cum);
              const y1 = yOf(cum + v);
              cum += v;
              const key = seriesKeys[si];
              return (
                <rect
                  key={si}
                  x={leftPad + i * groupW + (groupW - barW) / 2}
                  y={y1}
                  width={barW}
                  height={Math.max(0, y0 - y1)}
                  fill={colorOf(seriesKeys[si], si)}
                  stroke="#0A0A0E"
                  strokeWidth="1"
                  onPointerDown={onDown(i, key, cumBelow)}
                  onPointerMove={onMove}
                  onPointerUp={onUp}
                  onContextMenu={e => onShowMenu?.(e, [
                    { label: "Set segment to 0", onClick: () => onUpdateRow?.(i, { [key]: 0 }) },
                    { label: "Round to nearest 10", onClick: () => onUpdateRow?.(i, { [key]: Math.round(v / 10) * 10 }) },
                    { label: "", divider: true, onClick: () => {} },
                    { label: "Delete row", danger: true, onClick: () => onDeleteRow?.(i) },
                  ])}
                  style={{ cursor: onUpdateRow ? "ns-resize" : "default" }}
                />
              );
            })}
            <text x={leftPad + i * groupW + groupW / 2} y={yOf(totals[i]) - 6} textAnchor="middle" fill="#E8E4DD" style={{ fontFamily: fontMono, fontSize: 10, fontWeight: 700, pointerEvents: "none" }}>{fmtVal(totals[i], cfg.numFmt)}</text>
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
                x={leftPad + i * groupW + groupW / 2} y={chartH + 22} textAnchor="middle" fill={C.txm}
                onDoubleClick={() => onUpdateRow && setEditingCat(i)}
                style={{ fontFamily: fontSans, fontSize: 11, fontWeight: 600, cursor: onUpdateRow ? "text" : "default" }}
              >{cat}</text>
            )}
          </g>
        );
      })}
      <Legend series={series.map((s, si) => ({ key: seriesKeys[si], label: s.label, color: colorOf(seriesKeys[si], si) }))} W={W} y={chartH + 36} leftPad={leftPad} onSwatchClick={legendSwatchClick} />
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

function ClusteredColumn({ sheet, cfg, W, H, onUpdateRow, onDeleteRow, onShowMenu, annotations, pickMode, onPickBar, onSelect, onSetSeriesColor }: CatProps) {
  const { categories, series } = getCategoricalSeries(sheet);
  const seriesKeys = sheet.schema.slice(1).filter(c => c.type === "number" || c.type === "percent").map(c => c.key);
  const catKey = sheet.schema[0]?.key || "category";
  const [editingCat, setEditingCat] = useState<number | null>(null);
  const palette = THEMES[cfg.theme].colors;
  const colorOf = (key: string, idx: number) => cfg.seriesColors?.[key] || palette[idx % palette.length];
  const legendSwatchClick = onSetSeriesColor && onShowMenu ? (key: string, e: React.MouseEvent) => onShowMenu(e, [
    { kind: "swatchRow", colors: palette, current: cfg.seriesColors?.[key], onPick: c => onSetSeriesColor(key, c) },
  ]) : undefined;
  const leftPad = 56, rightPad = 24, topPad = 70, bottomPad = 48;
  const chartW = W - leftPad - rightPad;
  const chartH = H - topPad - bottomPad;

  const maxVal = Math.max(0, ...series.flatMap(s => s.values));
  const ticks = niceTicks(0, maxVal, 5);
  const tickMax = ticks[ticks.length - 1];
  const yOf = (v: number) => chartH - (v / tickMax) * chartH;

  const groupW = chartW / categories.length;
  const innerPad = groupW * 0.22;
  const innerW = groupW - innerPad * 2;
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
  const onDown = (rowIdx: number, key: string) => (e: React.PointerEvent) => {
    if (!onUpdateRow) return;
    e.stopPropagation();
    // If we're in CAGR/diff pick mode, treat click as a pick + bail out of drag
    if (onPickBar && onPickBar(rowIdx, key)) return;
    if (onSelect && e.button === 0) onSelect({ kind: "bar", rowIdx, key, color: palette[seriesKeys.indexOf(key) % palette.length], anchorX: e.clientX, anchorY: e.clientY });
    dragRef.current = { rowIdx, key };
    (e.target as Element).setPointerCapture?.(e.pointerId);
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
          <line x1={leftPad} x2={W - rightPad} y1={yOf(t)} y2={yOf(t)} stroke="rgba(255,255,255,0.05)" />
          <text x={leftPad - 8} y={yOf(t) + 4} textAnchor="end" fill={C.txm} style={{ fontFamily: fontMono, fontSize: 10 }}>{fmtVal(t, cfg.numFmt)}</text>
        </g>
      ))}
      {categories.map((cat, i) => (
        <g key={i}>
          {series.map((s, si) => {
            const v = s.values[i];
            const x = leftPad + i * groupW + innerPad + si * barW;
            const y = yOf(v);
            const key = seriesKeys[si];
            return (
              <g key={si}>
                <rect
                  x={x + 1} y={y} width={barW - 2} height={chartH - y}
                  fill={colorOf(seriesKeys[si], si)}
                  onPointerDown={onDown(i, key)}
                  onPointerMove={onMove}
                  onPointerUp={onUp}
                  onContextMenu={e => onShowMenu?.(e, [
                    { label: "Set to 0", onClick: () => onUpdateRow?.(i, { [key]: 0 }) },
                    { label: "Set to max", onClick: () => onUpdateRow?.(i, { [key]: niceRound(tickMax) }) },
                    { label: "Round to nearest 10", onClick: () => onUpdateRow?.(i, { [key]: Math.round(v / 10) * 10 }) },
                    { label: "", divider: true, onClick: () => {} },
                    { label: "Delete row", danger: true, onClick: () => onDeleteRow?.(i) },
                  ])}
                  style={{ cursor: onUpdateRow ? "ns-resize" : "default" }}
                />
                <text x={x + barW / 2} y={y - 4} textAnchor="middle" fill="#E8E4DD" style={{ fontFamily: fontMono, fontSize: 9, fontWeight: 700, pointerEvents: "none" }}>{fmtVal(v, cfg.numFmt)}</text>
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
              x={leftPad + i * groupW + groupW / 2} y={chartH + 22} textAnchor="middle" fill={C.txm}
              onDoubleClick={() => onUpdateRow && setEditingCat(i)}
              style={{ fontFamily: fontSans, fontSize: 11, fontWeight: 600, cursor: onUpdateRow ? "text" : "default" }}
            >{cat}</text>
          )}
        </g>
      ))}
      <Legend series={series.map((s, si) => ({ key: seriesKeys[si], label: s.label, color: colorOf(seriesKeys[si], si) }))} W={W} y={chartH + 36} leftPad={leftPad} onSwatchClick={legendSwatchClick} />
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
  const leftPad = 56, rightPad = 24, topPad = 70, bottomPad = 48;
  const chartW = W - leftPad - rightPad;
  const chartH = H - topPad - bottomPad;
  const groupW = chartW / categories.length;
  const barW = Math.min(groupW * 0.65, 80);

  const ticks = [0, 25, 50, 75, 100];
  const yOf = (v: number) => chartH - (v / 100) * chartH;

  return (
    <ChartFrame cfg={cfg} W={W} H={H} leftPad={leftPad} rightPad={rightPad} topPad={topPad} bottomPad={bottomPad}>
      {ticks.map(t => (
        <g key={t}>
          <line x1={leftPad} x2={W - rightPad} y1={yOf(t)} y2={yOf(t)} stroke="rgba(255,255,255,0.05)" />
          <text x={leftPad - 8} y={yOf(t) + 4} textAnchor="end" fill={C.txm} style={{ fontFamily: fontMono, fontSize: 10 }}>{t}%</text>
        </g>
      ))}
      {categories.map((cat, i) => {
        const total = series.reduce((a, s) => a + s.values[i], 0) || 1;
        let cum = 0;
        return (
          <g key={i}>
            {series.map((s, si) => {
              const pct = (s.values[i] / total) * 100;
              const y0 = yOf(cum);
              const y1 = yOf(cum + pct);
              cum += pct;
              const cx = leftPad + i * groupW + (groupW - barW) / 2;
              return (
                <g key={si}>
                  <rect x={cx} y={y1} width={barW} height={Math.max(0, y0 - y1)} fill={palette[si % palette.length]} stroke="#0A0A0E" strokeWidth="1" />
                  {(y0 - y1) > 18 && <text x={cx + barW / 2} y={(y0 + y1) / 2 + 3} textAnchor="middle" fill="#0A0A0E" style={{ fontFamily: fontMono, fontSize: 9, fontWeight: 800 }}>{Math.round(pct)}%</text>}
                </g>
              );
            })}
            <text x={leftPad + i * groupW + groupW / 2} y={chartH + 22} textAnchor="middle" fill={C.txm} style={{ fontFamily: fontSans, fontSize: 11, fontWeight: 600 }}>{cat}</text>
          </g>
        );
      })}
      <Legend series={series.map((s, si) => ({ label: s.label, color: palette[si % palette.length] }))} W={W} y={chartH + 36} leftPad={leftPad} />
    </ChartFrame>
  );
}

function LineProfile({ sheet, cfg, W, H, fill = false, stacked = false, onUpdateRow }: CatProps & { fill?: boolean; stacked?: boolean }) {
  const { categories, series } = getCategoricalSeries(sheet);
  const seriesKeys = sheet.schema.slice(1).filter(c => c.type === "number" || c.type === "percent").map(c => c.key);
  const palette = THEMES[cfg.theme].colors;
  const leftPad = 56, rightPad = 24, topPad = 70, bottomPad = 48;
  const chartW = W - leftPad - rightPad;
  const chartH = H - topPad - bottomPad;
  const colW = chartW / Math.max(1, categories.length - 1);
  const xOf = (i: number) => leftPad + i * colW;

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
  const tickMin = ticks[0];
  const tickMax = ticks[ticks.length - 1];
  const yOf = (v: number) => chartH - ((v - tickMin) / Math.max(0.0001, tickMax - tickMin)) * chartH;

  return (
    <ChartFrame cfg={cfg} W={W} H={H} leftPad={leftPad} rightPad={rightPad} topPad={topPad} bottomPad={bottomPad}>
      {ticks.map(t => (
        <g key={t}>
          <line x1={leftPad} x2={W - rightPad} y1={yOf(t)} y2={yOf(t)} stroke="rgba(255,255,255,0.05)" />
          <text x={leftPad - 8} y={yOf(t) + 4} textAnchor="end" fill={C.txm} style={{ fontFamily: fontMono, fontSize: 10 }}>{fmtVal(t, cfg.numFmt)}</text>
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
          const onDown = (rowIdx: number) => (e: React.PointerEvent) => {
            if (!onUpdateRow) return;
            e.stopPropagation();
            dragRefHack.current = { rowIdx, key };
            (e.target as Element).setPointerCapture?.(e.pointerId);
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
          return (
            <g key={si}>
              <path d={path} fill="none" stroke={palette[si % palette.length]} strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" />
              {s.cumValues.map((v, i) => (
                <circle
                  key={i}
                  cx={xOf(i)} cy={yOf(v)} r="6"
                  fill="#0A0A0E"
                  stroke={palette[si % palette.length]}
                  strokeWidth="2"
                  onPointerDown={onDown(i)}
                  onPointerMove={onMove}
                  onPointerUp={onUp}
                  style={{ cursor: onUpdateRow ? "ns-resize" : "default" }}
                />
              ))}
            </g>
          );
        });
      })()}
      {/* Category labels */}
      {categories.map((cat, i) => (
        <text key={i} x={xOf(i)} y={chartH + 22} textAnchor="middle" fill={C.txm} style={{ fontFamily: fontSans, fontSize: 11, fontWeight: 600 }}>{cat}</text>
      ))}
      <Legend series={series.map((s, si) => ({ label: s.label, color: palette[si % palette.length] }))} W={W} y={chartH + 36} leftPad={leftPad} />
    </ChartFrame>
  );
}

function Pie({ sheet, cfg, W, H, doughnut = false }: { sheet: DataSheet; cfg: ChartConfig; W: number; H: number; doughnut?: boolean }) {
  const palette = THEMES[cfg.theme].colors;
  const labelCol = sheet.schema[0];
  const valueCol = sheet.schema.find(c => c.type === "number") || sheet.schema[1];
  const items = sheet.rows.map(r => ({ label: String(r[labelCol.key] ?? ""), value: Number(r[valueCol.key]) || 0 }))
    .filter(it => it.value > 0);
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
      label: it.label, value: it.value, portion, color: palette[i % palette.length], path,
      labelX: cx + Math.cos(labelA) * labelR,
      labelY: cy + Math.sin(labelA) * labelR,
    };
  });

  return (
    <g>
      <rect x="0" y="0" width={W} height={H} fill="#0A0A0E" />
      <text x="56" y="28" fill="#E8E4DD" style={{ fontFamily: fontSans, fontSize: 18, fontWeight: 900 }}>{cfg.title}</text>
      <text x="56" y="48" fill={C.txm} style={{ fontFamily: fontMono, fontSize: 10, letterSpacing: 1 }}>{cfg.subtitle.toUpperCase()}</text>
      {arcs.map((a, i) => (
        <g key={i}>
          <path d={a.path} fill={a.color} stroke="#0A0A0E" strokeWidth="2" />
          {a.portion > 0.04 && (
            <text x={a.labelX} y={a.labelY} textAnchor={a.labelX < cx ? "end" : "start"} fill="#E8E4DD" style={{ fontFamily: fontSans, fontSize: 11, fontWeight: 700 }}>
              <tspan>{a.label}</tspan>
              <tspan x={a.labelX} dy="14" fill={C.txm} style={{ fontFamily: fontMono, fontSize: 10, fontWeight: 600 }}>{Math.round(a.portion * 100)}%</tspan>
            </text>
          )}
        </g>
      ))}
      {doughnut && (
        <text x={cx} y={cy + 4} textAnchor="middle" fill="#E8E4DD" style={{ fontFamily: fontSans, fontSize: 22, fontWeight: 900 }}>{fmtVal(total, cfg.numFmt)}</text>
      )}
    </g>
  );
}

function Scatter({ sheet, cfg, W, H, bubble = false }: { sheet: DataSheet; cfg: ChartConfig; W: number; H: number; bubble?: boolean }) {
  const palette = THEMES[cfg.theme].colors;
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
  const xRangeMin = xMin - xPad;
  const xRangeMax = xMax + xPad;
  const yRangeMin = yMin - yPad;
  const yRangeMax = yMax + yPad;
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
          <line x1={leftPad} x2={W - rightPad} y1={yOf(t)} y2={yOf(t)} stroke="rgba(255,255,255,0.05)" />
          <text x={leftPad - 8} y={yOf(t) + 4} textAnchor="end" fill={C.txm} style={{ fontFamily: fontMono, fontSize: 10 }}>{fmtVal(t, cfg.numFmt)}</text>
        </g>
      ))}
      {xTicks.map(t => (
        <text key={"x" + t} x={xOf(t)} y={chartH + 22} textAnchor="middle" fill={C.txm} style={{ fontFamily: fontMono, fontSize: 10 }}>{fmtVal(t, cfg.numFmt)}</text>
      ))}
      {points.map((p, i) => (
        <g key={i}>
          <circle cx={xOf(p.x)} cy={yOf(p.y)} r={radius(p.size)} fill={palette[i % palette.length]} fillOpacity="0.6" stroke={palette[i % palette.length]} strokeWidth="1.5" />
          <text x={xOf(p.x)} y={yOf(p.y) - radius(p.size) - 6} textAnchor="middle" fill="#E8E4DD" style={{ fontFamily: fontSans, fontSize: 10, fontWeight: 700 }}>{p.label}</text>
        </g>
      ))}
    </ChartFrame>
  );
}

function Waterfall({ sheet, cfg, W, H }: CatProps) {
  const palette = THEMES[cfg.theme].colors;
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
  const barW = Math.min(groupW * 0.6, 64);

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
          <line x1={leftPad} x2={W - rightPad} y1={yOf(t)} y2={yOf(t)} stroke="rgba(255,255,255,0.05)" />
          <text x={leftPad - 8} y={yOf(t) + 4} textAnchor="end" fill={C.txm} style={{ fontFamily: fontMono, fontSize: 10 }}>{fmtVal(t, cfg.numFmt)}</text>
        </g>
      ))}
      {segments.map((seg, i) => {
        const x = leftPad + i * groupW + (groupW - barW) / 2;
        const y = yOf(seg.y1);
        const h = Math.max(0, yOf(seg.y0) - yOf(seg.y1));
        return (
          <g key={i}>
            <rect x={x} y={y} width={barW} height={h} fill={seg.color} fillOpacity={seg.isTotal ? 0.85 : 0.7} stroke={seg.color} strokeWidth="1" />
            {/* Connector line to next */}
            {i < segments.length - 1 && !segments[i + 1].isTotal && (
              <line x1={x + barW} x2={leftPad + (i + 1) * groupW + (groupW - barW) / 2} y1={yOf(seg.cum)} y2={yOf(seg.cum)} stroke="rgba(255,255,255,0.25)" strokeDasharray="3 3" />
            )}
            <text x={x + barW / 2} y={y - 6} textAnchor="middle" fill="#E8E4DD" style={{ fontFamily: fontMono, fontSize: 10, fontWeight: 700 }}>{(seg.label as number) >= 0 ? "+" : ""}{fmtVal(seg.label as number, cfg.numFmt)}</text>
            <text x={leftPad + i * groupW + groupW / 2} y={chartH + 22} textAnchor="middle" fill={C.txm} style={{ fontFamily: fontSans, fontSize: 11, fontWeight: 600 }}>{items[i].label}</text>
          </g>
        );
      })}
    </ChartFrame>
  );
}

// Annotations layer · reference lines, CAGR arrows, and Δ markers.
// `getBarTop(rowIdx, key)` resolves to {x, y, value} of the targeted bar's
// top in chart-local coords (after the ChartFrame translate).
function AnnotationLayer({ annotations, getBarTop, chartW, chartH, leftPad, topPad, tickMax, yOf, fmt }: {
  annotations: Annotation[];
  getX?: (rowIdx: number) => number;
  getBarTop: (rowIdx: number, key: string) => { x: number; y: number; value: number };
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
        return null;
      })}
    </g>
  );
}

// Zebra BI-flavored variance chart · AC bars with PY reference markers and
// auto green/red ΔV labels. Schema is (Category, AC, PY); falls back to
// the first two number columns if those exact keys are missing.
function VarianceBar({ sheet, cfg, W, H, onUpdateRow, onShowMenu, onDeleteRow }: CatProps) {
  void onShowMenu; void onDeleteRow;
  const palette = THEMES[cfg.theme].colors;
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
  const barW = Math.min(groupW * 0.55, 70);

  // Drag the AC bar top to set AC value
  const dragRef = useRef<{ rowIdx: number } | null>(null);
  const valueAt = (e: React.PointerEvent): number | null => {
    const pt = pointerToSvg(e, e.currentTarget);
    if (!pt) return null;
    const localY = pt.y - topPad;
    return Math.max(0, tickMax * (1 - localY / chartH));
  };
  const onDown = (rowIdx: number) => (e: React.PointerEvent) => {
    if (!onUpdateRow) return;
    e.stopPropagation();
    dragRef.current = { rowIdx };
    (e.target as Element).setPointerCapture?.(e.pointerId);
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
          <line x1={leftPad} x2={W - rightPad} y1={yOf(t)} y2={yOf(t)} stroke="rgba(255,255,255,0.05)" />
          <text x={leftPad - 8} y={yOf(t) + 4} textAnchor="end" fill={C.txm} style={{ fontFamily: fontMono, fontSize: 10 }}>{fmtVal(t, cfg.numFmt)}</text>
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
          <g key={i}>
            {/* AC bar (filled) */}
            <rect
              x={cx} y={yAc} width={barW} height={chartH - yAc}
              fill={acColor}
              onPointerDown={onDown(i)}
              onPointerMove={onMove}
              onPointerUp={onUp}
              style={{ cursor: onUpdateRow ? "ns-resize" : "default" }}
            />
            {/* PY reference bracket — small horizontal mark on top of where PY would land */}
            <line x1={cx - 3} x2={cx + barW + 3} y1={yPy} y2={yPy} stroke={pyColor} strokeWidth="2" strokeDasharray="3 3" />
            <text x={cx + barW + 6} y={yPy + 3} fill={pyColor} style={{ fontFamily: fontMono, fontSize: 9, fontWeight: 700, pointerEvents: "none" }}>PY {fmtVal(r.py, cfg.numFmt)}</text>
            {/* AC value label inside or above bar */}
            <text x={cx + barW / 2} y={yAc - 6} textAnchor="middle" fill="#E8E4DD" style={{ fontFamily: fontMono, fontSize: 11, fontWeight: 800, pointerEvents: "none" }}>{fmtVal(r.ac, cfg.numFmt)}</text>
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
            <text x={cx + barW / 2} y={chartH + 4} textAnchor="middle" fill={C.txm} style={{ fontFamily: fontSans, fontSize: 11, fontWeight: 600 }}>{r.cat}</text>
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
      />
    </ChartFrame>
  );
}

function Legend({ series, W, y, leftPad, onSwatchClick }: { series: Array<{ label: string; color: string; key?: string }>; W: number; y: number; leftPad: number; onSwatchClick?: (key: string, e: React.MouseEvent) => void }) {
  void W;
  return (
    <g>
      {series.map((s, i) => (
        <g key={i} transform={`translate(${leftPad + i * 110}, ${y})`}>
          <rect
            x="0" y="-8" width="14" height="14" rx="3" fill={s.color}
            stroke={onSwatchClick ? "rgba(255,255,255,0.20)" : "none"} strokeWidth={onSwatchClick ? 1 : 0}
            onClick={onSwatchClick && s.key ? (e => onSwatchClick(s.key!, e)) : undefined}
            style={{ cursor: onSwatchClick ? "pointer" : "default" }}
          >
            {onSwatchClick && <title>Click to recolor this series</title>}
          </rect>
          <text x="20" y="3" fill={C.txm} style={{ fontFamily: fontMono, fontSize: 10, letterSpacing: 0.5 }}>{s.label.toUpperCase()}</text>
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

function GanttSvg({ sheet, cfg, W, H, opts, onToggleGroup, onUpdateRow, onDeleteRow, onShowMenu }: { sheet: DataSheet; cfg: ChartConfig; W: number; H: number; opts: GanttOpts; onToggleGroup: (k: string) => void; onUpdateRow?: OnUpdateRow; onDeleteRow?: OnDeleteRow; onShowMenu?: OnShowMenu }) {
  const palette = THEMES[cfg.theme].colors;
  const tasks = ganttFromSheet(sheet);
  const groups = buildGroups(tasks, palette);

  const ROW_H = 36;
  const GROUP_ROW_H = 30;
  const HEADER_H = 56;
  const TITLE_H = 56;
  const LEFT_PANEL_W = 280;
  const PADDING = 16;

  // Drag state · "move" shifts both start+end, "start"/"end" resize one edge.
  // Stored on a ref so React re-renders during the drag (driven by setState in
  // the move handler) don't recreate it.
  const dragRef = useRef<{ mode: "move" | "start" | "end"; sheetIdx: number; origStart: number; origEnd: number; cursorMs0: number } | null>(null);

  // Inline-rename state · which cell of which sheet row is currently
  // being edited (null = nothing). Keyed by sheet column key so we can
  // edit task name, owner, group, or progress without separate refs.
  const [editing, setEditing] = useState<{ rowIdx: number; key: string } | null>(null);

  if (tasks.length === 0) {
    return <g><rect x="0" y="0" width={W} height={200} fill="#0A0A0E" /><text x={W / 2} y="100" textAnchor="middle" fill={C.txd} style={{ fontFamily: fontSans, fontSize: 13 }}>Add Task / Start / End rows below.</text></g>;
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
      <rect x="0" y="0" width={totalW} height={totalH} fill="#0A0A0E" />
      <text x={LEFT_PANEL_W} y="26" fill="#E8E4DD" style={{ fontFamily: fontSans, fontSize: 18, fontWeight: 900 }}>{cfg.title}</text>
      <text x={LEFT_PANEL_W} y="46" fill={C.txm} style={{ fontFamily: fontMono, fontSize: 10, letterSpacing: 1 }}>{cfg.subtitle.toUpperCase()}</text>
      {ticks.map((t, i) => {
        const x = xOf(t);
        const next = ticks[i + 1];
        const labelX = next ? (x + xOf(next)) / 2 : x;
        return (
          <g key={"tk-" + i}>
            <line x1={x} x2={x} y1={TITLE_H} y2={totalH - PADDING} stroke="rgba(255,255,255,0.04)" />
            {next && <text x={labelX} y={TITLE_H + 24} textAnchor="middle" fill={C.txm} style={{ fontFamily: fontMono, fontSize: 11, fontWeight: 700 }}>{formatTick(t, opts.unit)}</text>}
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
              <text x="26" y={top + GROUP_ROW_H / 2 + 4} fill="#E8E4DD" style={{ fontFamily: fontSans, fontSize: 12, fontWeight: 800, letterSpacing: 0.3 }}>{r.group.label.toUpperCase()}</text>
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
                x="32" y={top + ROW_H / 2 + 4} fill="#E8E4DD"
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
                {opts.showProgress && t.progress !== undefined && t.progress > 0 && (
                  <rect
                    x={x1} y={barTop} width={w * (t.progress / 100)} height={barH} rx="5" ry="5"
                    fill={color} fillOpacity="0.85"
                    onPointerDown={onBarDown(t, "move")}
                    onPointerMove={onBarMove}
                    onPointerUp={onBarUp}
                    style={{ cursor: onUpdateRow ? "grab" : "default", pointerEvents: "none" }}
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
  // Manual Y axis range. Undefined = auto-fit.
  yMin?: number;
  yMax?: number;
}

export default function ChartMaker2({ standalone = false }: { standalone?: boolean }) {
  const [type, setType] = useState<ChartType>("stacked");
  const [title, setTitle] = useState("SemiAnalysis · 2026 Outlook");
  const [subtitle, setSubtitle] = useState("Quarterly view");
  const [theme, setTheme] = useState<ThemeId>("core");
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
  const [axisByType, setAxisByType] = useState<Partial<Record<ChartType, { yMin?: number; yMax?: number }>>>({});
  const axis = axisByType[type] || {};
  const setAxis = useCallback((next: { yMin?: number; yMax?: number }) => {
    setAxisByType(p => ({ ...p, [type]: next }));
  }, [type]);
  const [numFmt, setNumFmt] = useState<NumberFormat>("auto");

  // Per-type sheets so switching types doesn't lose data. Wrapped in
  // history-aware updater so undo/redo can rewind any change.
  const [sheets, setSheetsRaw] = useState<Partial<Record<ChartType, DataSheet>>>(() => ({}));
  // Per-type annotations (CAGR, diff, reference lines)
  const [annotByType, setAnnotByType] = useState<Partial<Record<ChartType, Annotation[]>>>({});
  // Multi-step pick mode for CAGR / diff arrows. Null = idle.
  const [pickMode, setPickMode] = useState<PickMode>(null);
  // Single-click placement mode for the ANNOTATE TEXT tool.
  const [placeMode, setPlaceMode] = useState<PlaceMode>(null);
  // Floating toolbar selection
  const [selection, setSelection] = useState<BarSelection | null>(null);

  const sheet = sheets[type] || samplePerType(type);
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
      const k = e.key.toLowerCase();
      if (k === "z" && !e.shiftKey) { e.preventDefault(); undo(); }
      else if ((k === "z" && e.shiftKey) || k === "y") { e.preventDefault(); redo(); }
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

  const cfg: ChartConfig = { type, title, subtitle, theme, numFmt, seriesColors, yMin: axis.yMin, yMax: axis.yMax };

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type]);

  const onToggleGroup = (k: string) => setGanttOpts(p => ({ ...p, collapsedKeys: { ...p.collapsedKeys, [k]: !p.collapsedKeys[k] } }));

  const W = 1280;
  const H = type === "gantt" ? 700 : 560;

  // Slug for the downloaded file
  const slug = () => (title || "chart").replace(/\s+/g, "-").toLowerCase();

  const exportPNG = () => {
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
      if (!ctx) return;
      ctx.fillStyle = "#0A0A0E";
      ctx.fillRect(0, 0, cv.width, cv.height);
      ctx.scale(2, 2);
      ctx.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      cv.toBlob(b => {
        if (!b) return;
        const dl = URL.createObjectURL(b);
        const a = document.createElement("a");
        a.href = dl;
        a.download = slug() + ".png";
        a.click();
        URL.revokeObjectURL(dl);
      }, "image/png");
    };
    img.onerror = () => { showToast("Couldn't render PNG"); URL.revokeObjectURL(url); };
    img.src = url;
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
    const xml = new XMLSerializer().serializeToString(svg);
    const blob = new Blob(['<?xml version="1.0" encoding="UTF-8"?>\n', xml], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = slug() + ".svg";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

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
  const onShowMenu: OnShowMenu = useCallback((e, items) => {
    e.preventDefault();
    e.stopPropagation();
    setMenu({ x: e.clientX, y: e.clientY, items });
  }, []);

  const renderChart = () => {
    const a = { onUpdateRow, onDeleteRow, onShowMenu, annotations, pickMode, onPickBar, onSelect: setSelection, onSetSeriesColor: setSeriesColor };
    switch (type) {
      case "stacked": return <StackedColumn sheet={sheet} cfg={cfg} W={W} H={H} {...a} />;
      case "clustered": return <ClusteredColumn sheet={sheet} cfg={cfg} W={W} H={H} {...a} />;
      case "pct": return <PercentColumn sheet={sheet} cfg={cfg} W={W} H={H} />;
      case "line": return <LineProfile sheet={sheet} cfg={cfg} W={W} H={H} {...a} />;
      case "stackedArea": return <LineProfile sheet={sheet} cfg={cfg} W={W} H={H} fill stacked {...a} />;
      case "pie": return <Pie sheet={sheet} cfg={cfg} W={W} H={H} />;
      case "doughnut": return <Pie sheet={sheet} cfg={cfg} W={W} H={H} doughnut />;
      case "scatter": return <Scatter sheet={sheet} cfg={cfg} W={W} H={H} />;
      case "wfup": return <Waterfall sheet={sheet} cfg={cfg} W={W} H={H} />;
      case "wfdn": return <Waterfall sheet={sheet} cfg={cfg} W={W} H={H} />;
      case "variance": return <VarianceBar sheet={sheet} cfg={cfg} W={W} H={H} {...a} />;
      case "gantt": return <GanttSvg sheet={sheet} cfg={cfg} W={W} H={H} opts={ganttOpts} onToggleGroup={onToggleGroup} onUpdateRow={onUpdateRow} onDeleteRow={onDeleteRow} onShowMenu={onShowMenu} />;
      default: {
        return (
          <g>
            <rect x="0" y="0" width={W} height={H} fill="#0A0A0E" />
            <text x={W / 2} y={H / 2 - 10} textAnchor="middle" fill={C.txm} style={{ fontFamily: fontSans, fontSize: 18, fontWeight: 800 }}>Coming soon</text>
            <text x={W / 2} y={H / 2 + 14} textAnchor="middle" fill={C.txd} style={{ fontFamily: fontMono, fontSize: 11 }}>{TYPES.flat().find(t => t.id === type)?.label.toUpperCase()}</text>
          </g>
        );
      }
    }
  };

  const cardBg = "#0D0D12";
  const borderC = "rgba(255,255,255,0.06)";

  return (
    <div style={{ padding: "32px 0 0", maxWidth: 1400, margin: "0 auto" }}>
      <div style={{ marginBottom: 16, display: "flex", alignItems: "flex-start", gap: 16, flexWrap: "wrap", paddingTop: standalone ? 16 : 0 }}>
        {!standalone && (
          <div style={{ flex: "1 1 auto", minWidth: 280 }}>
            <div style={{ fontFamily: gf, fontSize: 28, fontWeight: 900, color: C.tx, letterSpacing: -0.5 }}>Chart Maker 2</div>
            <div style={{ fontFamily: mn, fontSize: 10, color: C.txm, marginTop: 4, letterSpacing: 1 }}>THINK-CELL STYLE // PICK · EDIT · ANNOTATE · EXPORT</div>
          </div>
        )}
        {standalone && <div style={{ flex: "1 1 auto" }} />}
        <UndoRedoButtons onUndo={undo} onRedo={redo} canUndo={past.current.length > 0} canRedo={future.current.length > 0} />
        <NumberFormatPicker fmt={numFmt} onChange={setNumFmt} />
        <ThemePicker theme={theme} onChange={setTheme} />
        <ExportSplitButton onPNG={exportPNG} onSVG={exportSVG} />
      </div>

      {/* Annotations toolbar — Think-cell-style action chips */}
      <AnnotationsBar
        annotations={annotations}
        type={type}
        pickMode={pickMode}
        onStartPick={kind => setPickMode({ kind, bars: [] })}
        onCancelPick={() => setPickMode(null)}
        onAddRefLine={addReferenceLine}
        onRemove={removeAnnotation}
        onClearAll={clearAllAnnotations}
      />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
        <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Title" style={inputCSS(cardBg, borderC)} />
        <input value={subtitle} onChange={e => setSubtitle(e.target.value)} placeholder="Subtitle" style={inputCSS(cardBg, borderC)} />
      </div>

      {/* Two-column layout: scrollable type sidebar + chart/sheet */}
      <div style={{ display: "grid", gridTemplateColumns: "260px minmax(0, 1fr)", gap: 18, marginBottom: 28 }}>
        <ChartTypeSidebar active={type} onSelect={setType} />

        <div style={{ minWidth: 0 }}>
          {/* Gantt toggles only show for gantt */}
          {type === "gantt" && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12, padding: "10px 12px", background: cardBg, border: "1px solid " + borderC, borderRadius: 10, alignItems: "center" }}>
              <UnitPicker unit={ganttOpts.unit} onChange={u => setGanttOpts(p => ({ ...p, unit: u }))} />
              <Sep />
              <Toggle on={ganttOpts.showDates} onChange={v => setGanttOpts(p => ({ ...p, showDates: v }))} label="Dates" />
              <Toggle on={ganttOpts.showDuration} onChange={v => setGanttOpts(p => ({ ...p, showDuration: v }))} label="Duration" />
              <Toggle on={ganttOpts.showOwner} onChange={v => setGanttOpts(p => ({ ...p, showOwner: v }))} label="Owner" />
              <Toggle on={ganttOpts.showProgress} onChange={v => setGanttOpts(p => ({ ...p, showProgress: v }))} label="% Complete" />
              <Toggle on={ganttOpts.showToday} onChange={v => setGanttOpts(p => ({ ...p, showToday: v }))} label="Today" />
              <Sep />
              <Toggle on={ganttOpts.showGroups} onChange={v => setGanttOpts(p => ({ ...p, showGroups: v }))} label="Groups" />
              <Toggle on={ganttOpts.collapseAll} onChange={v => setGanttOpts(p => ({ ...p, collapseAll: v }))} label="Collapse all" />
              {/* Quick-add a new task. Defaults: 7-day bar, today + 7d, in
                  the last group used (or 'Tasks'). Editable from the chart
                  immediately because all the cells are clickable. */}
              <span style={{ flex: 1 }} />
              <button onClick={appendGanttTask} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 6, border: "1px solid " + C.amber + "55", background: C.amber + "18", color: C.amber, fontFamily: mn, fontSize: 10, fontWeight: 800, letterSpacing: 0.5, cursor: "pointer" }}>
                <Plus size={11} strokeWidth={2.4} /> ADD TASK
              </button>
            </div>
          )}

          {/* Chart preview · drag bars / points to edit values directly */}
          <div style={{ background: "#0A0A0E", border: "1px solid " + borderC, borderRadius: 12, padding: "20px 24px", marginBottom: 14, overflow: "auto" }}>
            <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block", fontFamily: ft, touchAction: "none" }}>
              {renderChart()}
            </svg>
          </div>

          {/* Editable data sheet */}
          <div>
            <div style={{ fontFamily: mn, fontSize: 10, color: C.txm, letterSpacing: 1.5, marginBottom: 8, textTransform: "uppercase" }}>Data sheet · convenience</div>
            <DataSheetGrid sheet={sheet} onChange={setSheet} />
          </div>
        </div>
      </div>

      {menu && <ChartContextMenu menu={menu} onClose={() => setMenu(null)} />}
      {selection && <FloatingMiniToolbar selection={selection} onClose={() => setSelection(null)} onUpdateRow={onUpdateRow} onDeleteRow={onDeleteRow} themes={THEMES} currentTheme={theme} />}
    </div>
  );
}

// ─── Export split button · primary action = PNG, dropdown for SVG ─────────
function ExportSplitButton({ onPNG, onSVG }: { onPNG: () => void; onSVG: () => void }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    setTimeout(() => document.addEventListener("click", close), 0);
    return () => document.removeEventListener("click", close);
  }, [open]);
  return (
    <div style={{ position: "relative", display: "inline-flex" }} onClick={e => e.stopPropagation()}>
      <button
        onClick={onPNG}
        style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 16px", borderRadius: "9px 0 0 9px", border: "1px solid " + C.amber + "55", borderRight: "none", background: "linear-gradient(135deg," + C.amber + ",#E8A020)", color: "#060608", fontFamily: ft, fontSize: 13, fontWeight: 800, cursor: "pointer", letterSpacing: 0.3 }}
      >
        <Download size={14} strokeWidth={2.2} />
        Export PNG
      </button>
      <button
        onClick={() => setOpen(v => !v)}
        title="More export options"
        style={{ padding: "10px 10px", borderRadius: "0 9px 9px 0", border: "1px solid " + C.amber + "55", background: "linear-gradient(135deg," + C.amber + ",#E8A020)", color: "#060608", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center" }}
      >
        <ChevronDown size={14} strokeWidth={2.4} />
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
        </div>
      )}
    </div>
  );
}
function dropItem(): React.CSSProperties {
  return { padding: "9px 12px", borderRadius: 6, cursor: "pointer", display: "flex", alignItems: "center", gap: 10, color: "#E8E4DD", fontFamily: ft, fontSize: 12, fontWeight: 600, transition: "background 0.12s" };
}

// ─── Top-bar Undo/Redo buttons ─────────────────────────────────────────────
function UndoRedoButtons({ onUndo, onRedo, canUndo, canRedo }: { onUndo: () => void; onRedo: () => void; canUndo: boolean; canRedo: boolean }) {
  const btn: React.CSSProperties = {
    display: "flex", alignItems: "center", gap: 6,
    padding: "9px 14px", borderRadius: 8,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.025)",
    fontFamily: mn, fontSize: 11, fontWeight: 800, letterSpacing: 0.5,
    cursor: "pointer",
  };
  return (
    <div style={{ display: "flex", gap: 6 }}>
      <button onClick={onUndo} disabled={!canUndo} title="Undo · ⌘Z" style={{ ...btn, color: canUndo ? C.tx : C.txd, opacity: canUndo ? 1 : 0.4, cursor: canUndo ? "pointer" : "not-allowed" }}>
        <Undo2 size={13} strokeWidth={2.2} /> UNDO
      </button>
      <button onClick={onRedo} disabled={!canRedo} title="Redo · ⌘⇧Z" style={{ ...btn, color: canRedo ? C.tx : C.txd, opacity: canRedo ? 1 : 0.4, cursor: canRedo ? "pointer" : "not-allowed" }}>
        <Redo2 size={13} strokeWidth={2.2} /> REDO
      </button>
    </div>
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
        title="Number format"
        style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 14px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.10)", background: open ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.025)", color: C.tx, fontFamily: mn, fontSize: 11, fontWeight: 800, letterSpacing: 0.5, cursor: "pointer" }}
      >
        <Hash size={13} strokeWidth={2.2} />
        {NUM_FMT_LABELS[fmt]}
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
function AnnotationsBar({ annotations, type, pickMode, onStartPick, onCancelPick, onAddRefLine, onRemove, onClearAll }: {
  annotations: Annotation[]; type: ChartType; pickMode: PickMode;
  onStartPick: (kind: "cagr" | "diff") => void;
  onCancelPick: () => void;
  onAddRefLine: (value: number, label: string) => void;
  onRemove: (id: string) => void;
  onClearAll: () => void;
}) {
  const [refOpen, setRefOpen] = useState(false);
  const [refValue, setRefValue] = useState("0");
  const [refLabel, setRefLabel] = useState("");
  // Annotations only really make sense for column / line family right now
  const annotApplies = ["stacked", "clustered", "line", "stackedArea", "wfup"].includes(type);
  if (!annotApplies && annotations.length === 0 && !pickMode) return null;

  const cardBg = "#0D0D12";
  const borderC = "rgba(255,255,255,0.06)";
  const chip = (active: boolean): React.CSSProperties => ({
    display: "flex", alignItems: "center", gap: 6,
    padding: "7px 12px", borderRadius: 7, cursor: "pointer",
    background: active ? C.amber + "1A" : "rgba(255,255,255,0.025)",
    border: "1px solid " + (active ? C.amber + "60" : "rgba(255,255,255,0.10)"),
    color: active ? C.amber : C.tx,
    fontFamily: mn, fontSize: 10, fontWeight: 800, letterSpacing: 0.5,
  });

  return (
    <div style={{ marginBottom: 14, padding: "10px 12px", background: cardBg, border: "1px solid " + borderC, borderRadius: 10, display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
      <span style={{ fontFamily: mn, fontSize: 9, color: C.txm, letterSpacing: 1.2, marginRight: 4, textTransform: "uppercase" }}>Annotate</span>
      <button onClick={() => onStartPick("cagr")} disabled={!annotApplies} title="Pick two bars/points to draw CAGR" style={chip(pickMode?.kind === "cagr")}>
        <Sigma size={11} strokeWidth={2.4} /> CAGR
      </button>
      <button onClick={() => onStartPick("diff")} disabled={!annotApplies} title="Pick two bars/points to show absolute Δ" style={chip(pickMode?.kind === "diff")}>
        <ArrowUpDown size={11} strokeWidth={2.4} /> Δ DIFF
      </button>
      <button onClick={() => setRefOpen(v => !v)} disabled={!annotApplies} style={chip(refOpen)}>
        <Minus size={11} strokeWidth={2.4} /> REF LINE
      </button>
      {refOpen && (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
          <input value={refValue} onChange={e => setRefValue(e.target.value)} placeholder="value" style={{ width: 70, padding: "5px 8px", background: "#0A0A0E", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 5, color: C.tx, fontFamily: mn, fontSize: 11, outline: "none" }} />
          <input value={refLabel} onChange={e => setRefLabel(e.target.value)} placeholder="label" style={{ width: 110, padding: "5px 8px", background: "#0A0A0E", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 5, color: C.tx, fontFamily: ft, fontSize: 11, outline: "none" }} />
          <button onClick={() => { const n = Number(refValue); if (!isNaN(n)) { onAddRefLine(n, refLabel); setRefValue("0"); setRefLabel(""); setRefOpen(false); } }} style={{ padding: "5px 10px", background: C.amber, border: "none", borderRadius: 5, color: "#060608", fontFamily: mn, fontSize: 10, fontWeight: 800, cursor: "pointer", letterSpacing: 0.5 }}>ADD</button>
        </span>
      )}
      {annotations.length > 0 && (
        <>
          <Sep />
          <span style={{ fontFamily: mn, fontSize: 9, color: C.txm, letterSpacing: 0.5 }}>{annotations.length} on chart</span>
          <button onClick={onClearAll} style={{ ...chip(false), color: "#E06347", borderColor: "rgba(224,99,71,0.30)" }}>
            <Trash2 size={11} strokeWidth={2.2} /> CLEAR
          </button>
        </>
      )}
      {pickMode && (
        <>
          <Sep />
          <span style={{ fontFamily: mn, fontSize: 10, color: C.amber, letterSpacing: 0.5, fontWeight: 700 }}>
            CLICK {pickMode.bars.length === 0 ? "FIRST" : "SECOND"} BAR ({pickMode.kind === "cagr" ? "CAGR" : "Δ DIFF"})
          </span>
          <button onClick={onCancelPick} style={{ ...chip(false), color: C.txm, fontSize: 9 }}>CANCEL</button>
        </>
      )}
    </div>
  );
}

// ─── Floating mini-toolbar · Think-cell's "context wheel" pattern ──────────
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
function ChartTypeSidebar({ active, onSelect }: { active: ChartType; onSelect: (t: ChartType) => void }) {
  return (
    <div style={{ background: "#0D0D12", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, position: "sticky", top: 12, alignSelf: "start", maxHeight: "calc(100vh - 48px)", overflow: "hidden", display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "16px 18px 12px", borderBottom: "1px solid rgba(255,255,255,0.06)", flexShrink: 0 }}>
        <div style={{ fontFamily: gf, fontSize: 13, fontWeight: 800, color: C.tx, letterSpacing: -0.1, marginBottom: 3 }}>Chart Types</div>
        <div style={{ fontFamily: mn, fontSize: 9, color: C.txm, letterSpacing: 1.4, textTransform: "uppercase" }}>{TYPES.flat().filter(t => t.working).length} live · {TYPES.flat().filter(t => !t.working).length} soon</div>
      </div>
      <div style={{ overflowY: "auto", padding: "10px", display: "flex", flexDirection: "column", gap: 4 }}>
        {TYPES.flat().map(spec => {
          const on = active === spec.id;
          return (
            <button
              key={spec.id}
              onClick={() => onSelect(spec.id)}
              title={spec.label + (spec.working ? "" : " · coming soon")}
              style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "11px 12px",
                background: on ? C.amber + "16" : "transparent",
                border: "1px solid " + (on ? C.amber + "60" : "transparent"),
                borderRadius: 9, cursor: "pointer",
                opacity: spec.working ? 1 : 0.5,
                transition: "all 0.14s",
                textAlign: "left", width: "100%",
                boxShadow: on ? "0 0 0 1px " + C.amber + "20" : "none",
              }}
              onMouseEnter={e => { if (!on) e.currentTarget.style.background = "rgba(255,255,255,0.045)"; }}
              onMouseLeave={e => { if (!on) e.currentTarget.style.background = "transparent"; }}
            >
              <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 26, height: 26, borderRadius: 6, background: on ? C.amber + "26" : "rgba(255,255,255,0.04)", flexShrink: 0 }}>
                <spec.Icon size={16} strokeWidth={on ? 2.4 : 1.9} color={on ? C.amber : (spec.working ? C.tx : C.txd)} />
              </span>
              <span style={{ flex: 1, fontFamily: ft, fontSize: 13, fontWeight: on ? 800 : 600, color: on ? C.amber : (spec.working ? "#E8E4DD" : C.txd), letterSpacing: 0.1 }}>{spec.label}</span>
              {!spec.working && <span style={{ fontFamily: mn, fontSize: 7.5, color: C.txd, letterSpacing: 0.6, padding: "2px 6px", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 3 }}>SOON</span>}
            </button>
          );
        })}
      </div>
    </div>
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
        style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 14px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.10)", background: open ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.025)", color: C.tx, fontFamily: mn, fontSize: 11, fontWeight: 800, letterSpacing: 0.5, cursor: "pointer" }}
      >
        <span style={{ display: "inline-flex", gap: 2 }}>
          {cur.colors.slice(0, 5).map((c, i) => <span key={i} style={{ width: 8, height: 12, background: c, borderRadius: 1.5 }} />)}
        </span>
        {cur.name.replace("SA ", "")}
        <ChevronDown size={11} strokeWidth={2.4} />
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
