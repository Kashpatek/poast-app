"use client";
import React, { useState, useRef } from "react";
import * as XLSX from "xlsx";
import { toPng } from "html-to-image";
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { D as C, ft, mn } from "./shared-constants";
import { useUser } from "./user-context";

// ═══ TYPES ═══
type ChartKind = "bar" | "stacked" | "line" | "area" | "areaStacked" | "pie";
type StyleMode = "clean" | "branded";
type PaletteKey = "saCore" | "saSpectrum" | "saCapital";
type Orientation = "cols" | "rows";
type BackdropKey = "amber" | "cobalt" | "both" | "capital";
type InputMode = "paste" | "manual" | "excel";

// ═══ GRID ⇄ CSV ═══
function csvToGrid(csv: string): string[][] {
  const lines = csv.trim().split(/\r?\n/);
  return lines.map((l) => l.split(",").map((c) => c.trim()));
}
function gridToCsv(grid: string[][]): string {
  return grid.map((row) => row.map((c) => String(c ?? "")).join(",")).join("\n");
}

interface BackdropSpec { name: string; base: string; glows: { x: number; y: number; r: number; color: string }[]; accent: string; }
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
  { key: "line",        label: "Line" },
  { key: "area",        label: "Area" },
  { key: "areaStacked", label: "Area (stacked)" },
  { key: "pie",         label: "Pie" },
];

// ═══ CSV PARSER + ORIENTATION ═══
function parseCSV(raw: string, orientation: Orientation): { columns: string[]; rows: ChartRow[] } {
  const lines = raw.trim().split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return { columns: [], rows: [] };
  const table = lines.map((line) => line.split(",").map((c) => c.trim()));

  if (orientation === "cols") {
    // First row = headers (label col + series names as columns). First col = X labels.
    const columns = table[0];
    const rows: ChartRow[] = table.slice(1).map((cells) => {
      const row: ChartRow = {};
      columns.forEach((col, i) => {
        const v = cells[i];
        const n = Number(v);
        row[col] = v !== undefined && !isNaN(n) && v !== "" ? n : (v || "");
      });
      return row;
    });
    return { columns, rows };
  } else {
    // Rows as series: first col = series name, remaining cols = values per x-point.
    // First row's remaining cells = x labels. Transpose mentally into wide rows.
    const xLabels = table[0].slice(1);
    const seriesNames = table.slice(1).map((r) => r[0]);
    const columns = [table[0][0] || "X", ...seriesNames];
    const rows: ChartRow[] = xLabels.map((x, xi) => {
      const row: ChartRow = { [columns[0]]: x };
      seriesNames.forEach((name, si) => {
        const v = table[si + 1][xi + 1];
        const n = Number(v);
        row[name] = v !== undefined && !isNaN(n) && v !== "" ? n : 0;
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
// Wait for fonts + one paint frame so html-to-image captures fully-rendered DOM
async function waitForRenderReady() {
  if (typeof document !== "undefined" && document.fonts) {
    try { await document.fonts.ready; } catch { /* noop */ }
  }
  await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
}

async function exportNodePNG(
  node: HTMLElement,
  targetW: number,
  targetH: number,
  transparent: boolean
): Promise<Blob> {
  await waitForRenderReady();
  const rect = node.getBoundingClientRect();
  // Compute pixelRatio so output ends up ≈ targetW × targetH
  const pixelRatio = Math.max(2, targetW / rect.width);
  const dataUrl = await toPng(node, {
    pixelRatio,
    backgroundColor: transparent ? undefined : "#ffffff",
    cacheBust: true,
    skipFonts: false,
  });
  // Convert dataUrl to blob
  const res = await fetch(dataUrl);
  return await res.blob();
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
  const [backdrop, setBackdrop] = useState<BackdropKey>("both");
  const [axisMode, setAxisMode] = useState<"auto" | "manual">("auto");
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

  function handleExport() {
    if (!chartRef.current) return;
    setExporting(true);
    const W = style === "branded" ? 1920 : 1600;
    const H = style === "branded" ? 1080 : 900;
    exportNodePNG(chartRef.current, W, H, style === "clean")
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
      axisMode, xAxisLabel, yAxisLabel,
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
    const axisColor = style === "branded" ? "rgba(255,255,255,0.55)" : "#888888";
    const gridColor = style === "branded" ? "rgba(255,255,255,0.10)" : GREY + "35";
    const textColor = style === "branded" ? "#E8E4DD" : "#1A1A1A";
    const tooltipBg = style === "branded" ? "#0A0A14" : "#ffffff";
    const tooltipBorder = style === "branded" ? "rgba(255,255,255,0.1)" : "#E0E0E0";

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
        bottom: showX ? 30 : 10,
      },
    };
    const tickStyle = { fontSize: 14, fontFamily: "'Outfit', sans-serif", fontWeight: 600, fill: axisColor };
    const legendStyle = { color: textColor, fontFamily: "'Outfit', sans-serif", fontSize: 14, fontWeight: 600 };
    const xLabel = showX ? { value: xAxisLabel, position: "insideBottom" as const, offset: -10, fill: textColor, fontSize: 14, fontFamily: "'Outfit', sans-serif", fontWeight: 700 } : undefined;
    const yLabel = showY ? { value: yAxisLabel, angle: -90, position: "insideLeft" as const, fill: textColor, fontSize: 14, fontFamily: "'Outfit', sans-serif", fontWeight: 700, style: { textAnchor: "middle" as const } } : undefined;

    if (kind === "pie") {
      const pieData = parsed.rows.map((r) => ({ name: String(r[labelKey]), value: Number(r[seriesKeys[0]]) || 0 }));
      return (
        <ResponsiveContainer width="100%" height={520}>
          <PieChart>
            <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={180} label={{ fill: textColor, fontSize: 13, fontFamily: "'Outfit', sans-serif", fontWeight: 600 }}>
              {pieData.map((_, i) => <Cell key={i} fill={colors[i % colors.length]} />)}
            </Pie>
            <Tooltip contentStyle={{ background: tooltipBg, border: `1px solid ${tooltipBorder}`, borderRadius: 8, color: textColor }} />
            <Legend wrapperStyle={legendStyle} />
          </PieChart>
        </ResponsiveContainer>
      );
    }

    if (kind === "line") {
      return (
        <ResponsiveContainer width="100%" height={520}>
          <LineChart {...common}>
            <CartesianGrid stroke={gridColor} vertical={false} />
            <XAxis dataKey={labelKey} tick={tickStyle} stroke={axisColor} tickLine={false} axisLine={false} label={xLabel} />
            <YAxis tick={tickStyle} stroke={axisColor} tickLine={false} axisLine={false} label={yLabel} />
            <Tooltip contentStyle={{ background: tooltipBg, border: `1px solid ${tooltipBorder}`, borderRadius: 8, color: textColor }} />
            <Legend wrapperStyle={legendStyle} />
            {seriesKeys.map((k, i) => <Line key={k} type="monotone" dataKey={k} stroke={colors[i % colors.length]} strokeWidth={3} dot={{ r: 4 }} />)}
          </LineChart>
        </ResponsiveContainer>
      );
    }

    if (kind === "area" || kind === "areaStacked") {
      return (
        <ResponsiveContainer width="100%" height={520}>
          <AreaChart {...common}>
            <CartesianGrid stroke={gridColor} vertical={false} />
            <XAxis dataKey={labelKey} tick={tickStyle} stroke={axisColor} tickLine={false} axisLine={false} label={xLabel} />
            <YAxis tick={tickStyle} stroke={axisColor} tickLine={false} axisLine={false} label={yLabel} />
            <Tooltip contentStyle={{ background: tooltipBg, border: `1px solid ${tooltipBorder}`, borderRadius: 8, color: textColor }} />
            <Legend wrapperStyle={legendStyle} />
            {seriesKeys.map((k, i) => (
              <Area key={k} type="monotone" dataKey={k} stroke={colors[i % colors.length]} fill={colors[i % colors.length]} fillOpacity={0.82} strokeWidth={2.2} stackId={kind === "areaStacked" ? "a" : undefined} />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      );
    }

    return (
      <ResponsiveContainer width="100%" height={520}>
        <BarChart {...common}>
          <CartesianGrid stroke={gridColor} vertical={false} />
          <XAxis dataKey={labelKey} tick={tickStyle} stroke={axisColor} tickLine={false} axisLine={false} label={xLabel} />
          <YAxis tick={tickStyle} stroke={axisColor} tickLine={false} axisLine={false} label={yLabel} />
          <Tooltip contentStyle={{ background: tooltipBg, border: `1px solid ${tooltipBorder}`, borderRadius: 8, color: textColor }} />
          <Legend wrapperStyle={legendStyle} />
          {seriesKeys.map((k, i) => (
            <Bar key={k} dataKey={k} fill={colors[i % colors.length]} stackId={kind === "stacked" ? "a" : undefined} radius={kind === "stacked" ? [0, 0, 0, 0] : [6, 6, 0, 0]} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    );
  }

  const bdSpec = BACKDROPS[backdrop];
  const previewBg = style === "branded" ? bdSpec.base : "#ffffff";

  return (
    <div style={{ padding: "28px 32px 60px", maxWidth: 1400, margin: "0 auto", color: C.tx, fontFamily: ft }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontFamily: ft, fontSize: 24, fontWeight: 900, color: C.tx, letterSpacing: -0.5 }}>Chart Maker</div>
        <div style={{ fontFamily: mn, fontSize: 11, color: C.txm, marginTop: 4, letterSpacing: 1 }}>SA BRAND PALETTES · CSV OR TRANSPOSED · CLEAN OR BRANDED PNG</div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "380px 1fr", gap: 20 }}>
        {/* ═══ CONTROLS ═══ */}
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {/* Orientation */}
          <Section label="Data Orientation">
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
            <Section label="Axis Labels">
              <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                <Pill active={axisMode === "auto"} onClick={() => setAxisMode("auto")}>Auto</Pill>
                <Pill active={axisMode === "manual"} onClick={() => setAxisMode("manual")}>Manual</Pill>
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

          {/* Palette */}
          <Section label="Palette">
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {(Object.keys(PALETTES) as PaletteKey[]).map((k) => {
                const p = PALETTES[k];
                const active = palette === k;
                return (
                  <button key={k} onClick={() => setPalette(k)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 8, background: active ? C.amber + "15" : C.surface, border: `1px solid ${active ? C.amber + "40" : C.border}`, color: active ? C.amber : C.txm, fontFamily: ft, fontSize: 11, fontWeight: 600, cursor: "pointer", textAlign: "left" }}>
                    <div style={{ display: "flex", gap: 2, flexShrink: 0 }}>
                      {p.colors.slice(0, 6).map((c, i) => (
                        <div key={i} style={{ width: 10, height: 18, borderRadius: 1, background: c }} />
                      ))}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 12, color: active ? C.amber : C.tx }}>{p.name}</div>
                      <div style={{ fontSize: 9, color: C.txd, fontFamily: mn, marginTop: 2 }}>{p.blurb}</div>
                    </div>
                  </button>
                );
              })}
            </div>
            <div style={{ fontSize: 9, color: C.txd, fontFamily: mn, marginTop: 6 }}>
              Using S1–S{Math.min(seriesKeys.length, colors.length)} · Grey #3D3D3D reserved for gridlines only
            </div>
          </Section>

          {/* Style */}
          <Section label="Export Style">
            <div style={{ display: "flex", gap: 6 }}>
              <Pill active={style === "clean"} onClick={() => setStyle("clean")}>Clean (transparent)</Pill>
              <Pill active={style === "branded"} onClick={() => setStyle("branded")}>SA Branded</Pill>
            </div>
          </Section>

          {style === "branded" && (
            <>
              <Section label="Backdrop Gradient">
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                  {(Object.keys(BACKDROPS) as BackdropKey[]).map((k) => {
                    const spec = BACKDROPS[k];
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

              <Section label="Chart Title">
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

              <Section label="Source Text">
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
                  <div style={{ fontFamily: ft, fontSize: 26, fontWeight: 900, color: "#E8E4DD", letterSpacing: -0.5 }}>{title || "Chart Title"}</div>
                </div>
              </>
            )}
            <div style={{ position: "relative" }}>{renderChart()}</div>
            {style === "branded" && (
              <div style={{ position: "absolute", bottom: 18, left: 40, right: 40, display: "flex", justifyContent: "space-between", alignItems: "center", fontFamily: mn, fontSize: 10 }}>
                <span style={{ color: "rgba(255,255,255,0.55)" }}>{source}</span>
                <span style={{ color: bdSpec.accent, fontWeight: 700, letterSpacing: 1.5 }}>SEMIANALYSIS</span>
              </div>
            )}
          </div>
          <div style={{ fontFamily: mn, fontSize: 10, color: C.txd, marginTop: 8 }}>
            {parsed.rows.length} rows · {seriesKeys.length} series · {PALETTES[palette].name} · {style === "branded" ? `1920×1080 ${bdSpec.name} backdrop` : "1600×900 transparent"}
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══ HELPERS ═══
function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontFamily: mn, fontSize: 9, color: C.amber, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 6 }}>{label}</div>
      {children}
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
