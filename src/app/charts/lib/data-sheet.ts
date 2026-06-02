// Standalone TableSheet helpers used by editor-table (and re-used by
// editor-chart's "build chart from selection" handoff path).
// Independent of chart-maker-2's internal DataSheet so the Studio
// surfaces don't have to reach across the boundary for trivial ops.

import { TableSheet, TableColumnSpec, TableCellValue, TableColumnType } from "../studio-types";

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
  if (type === "text") return value;
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
