// Standalone TableSheet helpers used by editor-table (and re-used by
// editor-chart's "build chart from selection" handoff path).
// Independent of chart-maker-2's internal DataSheet so the Studio
// surfaces don't have to reach across the boundary for trivial ops.

import {
  TableCellValue, TableColumnSpec, TableColumnType, TableNumberFormat, TableSheet,
} from "../studio-types";

export function newColumnKey(existing: TableColumnSpec[]): string {
  // Find the smallest n such that c<n> isn't taken. Skipping deleted keys
  // means undo-style rollbacks don't accidentally collide.
  const used = new Set(existing.map(c => c.key));
  for (let i = 1; i < 10_000; i++) {
    const k = "c" + i;
    if (!used.has(k)) return k;
  }
  return "c" + Date.now();
}

export function blankRow(schema: TableColumnSpec[]): Record<string, TableCellValue> {
  const r: Record<string, TableCellValue> = {};
  for (const c of schema) r[c.key] = c.type === "number" || c.type === "percent" ? 0 : "";
  return r;
}

export function makeStarterSheet(): TableSheet {
  return {
    schema: [
      { key: "c1", label: "Category", type: "text" },
      { key: "c2", label: "Value A",  type: "number" },
      { key: "c3", label: "Value B",  type: "number" },
    ],
    rows: [
      { c1: "Q1 '26", c2: 240, c3: 132 },
      { c1: "Q2 '26", c2: 280, c3: 148 },
      { c1: "Q3 '26", c2: 312, c3: 161 },
      { c1: "Q4 '26", c2: 348, c3: 178 },
      { c1: "Q1 '27", c2: 376, c3: 193 },
    ],
  };
}

export function makeKpiSheet(): TableSheet {
  return {
    schema: [
      { key: "c1", label: "Quarter",  type: "text" },
      { key: "c2", label: "Revenue",  type: "number" },
      { key: "c3", label: "Margin",   type: "percent" },
      { key: "c4", label: "ARR",      type: "number" },
      { key: "c5", label: "Headcount",type: "number" },
    ],
    rows: [
      { c1: "Q1 '26", c2: 18.4, c3: 32, c4: 76, c5: 42 },
      { c1: "Q2 '26", c2: 21.1, c3: 34, c4: 84, c5: 47 },
      { c1: "Q3 '26", c2: 23.6, c3: 36, c4: 92, c5: 51 },
      { c1: "Q4 '26", c2: 26.2, c3: 35, c4: 100, c5: 56 },
    ],
  };
}

export function makeBlankSheet(): TableSheet {
  return {
    schema: [
      { key: "c1", label: "Column A", type: "text" },
      { key: "c2", label: "Column B", type: "number" },
      { key: "c3", label: "Column C", type: "number" },
    ],
    rows: Array.from({ length: 5 }, (_, i) => ({ c1: "Row " + (i + 1), c2: 0, c3: 0 })),
  };
}

export function templateSheet(templateId: string | undefined): TableSheet {
  if (templateId === "kpi") return makeKpiSheet();
  if (templateId === "blank") return makeBlankSheet();
  return makeStarterSheet();
}

export function coerce(value: string, type: TableColumnType): TableCellValue {
  if (type === "text" || type === "badge") return value;
  if (type === "number" || type === "percent") {
    const cleaned = value.replace(/,/g, "").trim();
    if (cleaned === "" || cleaned === "-") return null;
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : value;
  }
  return value;
}

export function toCsv(sheet: TableSheet): string {
  const head = sheet.schema.map(c => csvCell(c.label)).join(",");
  const body = sheet.rows.map(row =>
    sheet.schema.map(c => csvCell(row[c.key] == null ? "" : String(row[c.key]))).join(",")
  );
  return [head, ...body].join("\n");
}

function csvCell(s: string): string {
  if (/[,"\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

// Format a cell value per its column spec. Used by both the editable
// grid (so users see what they'll get in the export) and the SVG
// renderer (so the rendered table matches the grid one-to-one).
export function formatCell(value: TableCellValue, col: TableColumnSpec): string {
  if (value == null || value === "") return "";
  const num = typeof value === "number" ? value : Number(String(value).replace(/,/g, ""));
  const isNum = Number.isFinite(num);
  const wrap = (body: string): string => {
    const pre = col.prefix || "";
    const suf = col.suffix || "";
    return pre + body + suf;
  };
  if (!isNum) {
    return wrap(String(value));
  }
  const fmt: TableNumberFormat = col.numFmt
    || (col.type === "percent" ? "pct" : "default");
  if (fmt === "default") return wrap(defaultNum(num));
  if (fmt === "int")   return wrap(Math.round(num).toLocaleString());
  if (fmt === "dec1")  return wrap(num.toFixed(1));
  if (fmt === "dec2")  return wrap(num.toFixed(2));
  if (fmt === "pct")   return wrap(formatPercent(num));
  if (fmt === "usd")   return wrap("$" + defaultNum(num));
  if (fmt === "usdK")  return wrap("$" + compact(num, 1_000)  + "K");
  if (fmt === "usdM")  return wrap("$" + compact(num, 1_000_000) + "M");
  if (fmt === "usdB")  return wrap("$" + compact(num, 1_000_000_000) + "B");
  if (fmt === "k")     return wrap(compact(num, 1_000)  + "K");
  if (fmt === "m")     return wrap(compact(num, 1_000_000) + "M");
  if (fmt === "b")     return wrap(compact(num, 1_000_000_000) + "B");
  return wrap(defaultNum(num));
}

function defaultNum(n: number): string {
  if (Math.abs(n) >= 1000) return n.toLocaleString(undefined, { maximumFractionDigits: 1 });
  if (Math.abs(n) >= 10)   return n.toFixed(0);
  if (Math.abs(n) >= 1)    return n.toFixed(2);
  return n.toFixed(3);
}

function formatPercent(n: number): string {
  // If the value looks like a fraction (0.32 → 32%), scale; otherwise
  // assume it's already a percent (32 → 32%).
  const scale = Math.abs(n) > 0 && Math.abs(n) <= 1.5 ? 100 : 1;
  const v = n * scale;
  if (Math.abs(v) >= 10) return Math.round(v) + "%";
  return v.toFixed(1) + "%";
}

function compact(n: number, divisor: number): string {
  const scaled = n / divisor;
  if (Math.abs(scaled) >= 100) return scaled.toFixed(0);
  if (Math.abs(scaled) >= 10)  return scaled.toFixed(1);
  return scaled.toFixed(2);
}

// Aggregate a column of values per the requested kind. Skips
// non-numeric entries. Returns null when there's no usable input.
export type AggregateKind = "sum" | "avg" | "min" | "max";

export function aggregateColumn(values: TableCellValue[], kind: AggregateKind): number | null {
  const nums = values
    .map(v => typeof v === "number" ? v : Number(String(v ?? "").replace(/,/g, "")))
    .filter(n => Number.isFinite(n)) as number[];
  if (nums.length === 0) return null;
  if (kind === "sum") return nums.reduce((a, b) => a + b, 0);
  if (kind === "avg") return nums.reduce((a, b) => a + b, 0) / nums.length;
  if (kind === "min") return Math.min(...nums);
  if (kind === "max") return Math.max(...nums);
  return null;
}

// Parse a clipboard paste (TSV or CSV) into a 2D grid. Auto-detects the
// delimiter from the first line — tabs win if present (Excel/Sheets),
// otherwise commas. Returns rows of trimmed strings.
export function parseClipboardTable(raw: string): string[][] {
  const text = raw.replace(/\r\n?/g, "\n").replace(/\n+$/, "");
  if (!text.trim()) return [];
  const firstLine = text.split("\n", 1)[0];
  const delim = firstLine.includes("\t") ? "\t"
              : firstLine.includes(",") ? ","
              : null;
  if (!delim) {
    // Single column — each line is a value.
    return text.split("\n").map(s => [s]);
  }
  if (delim === "\t") {
    return text.split("\n").map(line => line.split("\t"));
  }
  // CSV with naive quote handling — enough for clipboard from Sheets.
  return text.split("\n").map(parseCsvLine);
}

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQ) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; continue; }
      if (ch === '"') { inQ = false; continue; }
      cur += ch;
    } else {
      if (ch === '"') { inQ = true; continue; }
      if (ch === ",") { cells.push(cur); cur = ""; continue; }
      cur += ch;
    }
  }
  cells.push(cur);
  return cells;
}

export function toMarkdown(sheet: TableSheet): string {
  const head = "| " + sheet.schema.map(c => c.label).join(" | ") + " |";
  const sep  = "| " + sheet.schema.map(() => "---").join(" | ") + " |";
  const body = sheet.rows.map(row =>
    "| " + sheet.schema.map(c => {
      const v = row[c.key];
      if (v == null) return "";
      if (typeof v === "number" && c.type === "percent") return v + "%";
      return String(v);
    }).join(" | ") + " |"
  );
  return [head, sep, ...body].join("\n");
}
