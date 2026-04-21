"use client";
import React, { useState, useRef, useEffect } from "react";
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { D as C, ft, mn } from "./shared-constants";
import { useUser } from "./user-context";

// ═══ TYPES ═══
type ChartKind = "bar" | "stacked" | "line" | "area" | "areaStacked" | "pie";
type StyleMode = "clean" | "branded";
type PaletteKey = "sa" | "amber" | "blue" | "mono";

interface ChartRow { [key: string]: string | number; }

// ═══ PALETTES ═══
const PALETTES: Record<PaletteKey, { name: string; colors: string[] }> = {
  sa:    { name: "SA Multi",     colors: ["#F7B041", "#0B86D1", "#2EAD8E", "#905CCB", "#E06347", "#26C9D8"] },
  amber: { name: "Amber Gradient", colors: ["#F7B041", "#DC9A3A", "#B07A2B", "#7A551E", "#4A3414"] },
  blue:  { name: "Blue Gradient",  colors: ["#0B86D1", "#3FA1DE", "#7AC2E8", "#A8D8F0", "#D3EAF7"] },
  mono:  { name: "Mono Violet",    colors: ["#905CCB", "#A678D6", "#BE96E1", "#D4B5ED", "#EAD5F7"] },
};

const CHART_KINDS: { key: ChartKind; label: string }[] = [
  { key: "bar",         label: "Bar (grouped)" },
  { key: "stacked",     label: "Bar (stacked)" },
  { key: "line",        label: "Line" },
  { key: "area",        label: "Area" },
  { key: "areaStacked", label: "Area (stacked)" },
  { key: "pie",         label: "Pie" },
];

// ═══ CSV PARSER ═══
function parseCSV(raw: string): { columns: string[]; rows: ChartRow[] } {
  const lines = raw.trim().split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return { columns: [], rows: [] };
  const columns = lines[0].split(",").map((c) => c.trim());
  const rows: ChartRow[] = lines.slice(1).map((line) => {
    const cells = line.split(",").map((c) => c.trim());
    const row: ChartRow = {};
    columns.forEach((col, i) => {
      const v = cells[i];
      const n = Number(v);
      row[col] = v !== undefined && !isNaN(n) && v !== "" ? n : (v || "");
    });
    return row;
  });
  return { columns, rows };
}

// Sample data user sees on open
const SAMPLE_CSV = `Quarter,Nvidia,AMD,Intel
Q1 2025,68,18,14
Q2 2025,72,19,12
Q3 2025,74,20,10
Q4 2025,78,22,9`;

// ═══ EXPORT: SVG → PNG ═══
async function exportChartPNG(
  svgEl: SVGElement,
  width: number,
  height: number,
  style: StyleMode,
  title: string,
  source: string
): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;

  if (style === "branded") {
    // SA dark gradient backdrop
    ctx.fillStyle = "#06060C";
    ctx.fillRect(0, 0, width, height);
    // Radial amber glow top-right
    const g1 = ctx.createRadialGradient(width * 0.85, height * 0.15, 0, width * 0.85, height * 0.15, width * 0.7);
    g1.addColorStop(0, "rgba(247,176,65,0.18)");
    g1.addColorStop(1, "rgba(247,176,65,0)");
    ctx.fillStyle = g1;
    ctx.fillRect(0, 0, width, height);
    // Radial blue glow bottom-left
    const g2 = ctx.createRadialGradient(width * 0.1, height * 0.9, 0, width * 0.1, height * 0.9, width * 0.6);
    g2.addColorStop(0, "rgba(11,134,209,0.12)");
    g2.addColorStop(1, "rgba(11,134,209,0)");
    ctx.fillStyle = g2;
    ctx.fillRect(0, 0, width, height);
    // Amber top accent line
    ctx.fillStyle = "#F7B041";
    ctx.fillRect(80, 80, 60, 4);
  } else {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
  }

  // Title + source text for branded mode
  if (style === "branded") {
    if (title) {
      ctx.font = "800 44px 'Outfit', sans-serif";
      ctx.fillStyle = "#E8E4DD";
      ctx.fillText(title, 80, 140);
    }
    if (source) {
      ctx.font = "500 18px 'JetBrains Mono', monospace";
      ctx.fillStyle = "rgba(255,255,255,0.45)";
      ctx.fillText(source, 80, height - 40);
    }
    ctx.font = "700 16px 'Outfit', sans-serif";
    ctx.fillStyle = "#F7B041";
    ctx.textAlign = "right";
    ctx.fillText("SEMIANALYSIS", width - 80, height - 40);
    ctx.textAlign = "left";
  }

  // Render the SVG into the canvas
  const svgData = new XMLSerializer().serializeToString(svgEl);
  const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(svgBlob);
  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("SVG render failed"));
    img.src = url;
  });

  const chartInsetX = style === "branded" ? 80 : 40;
  const chartInsetY = style === "branded" ? 180 : 40;
  const chartW = width - chartInsetX * 2;
  const chartH = height - chartInsetY - (style === "branded" ? 80 : 40);
  ctx.drawImage(img, chartInsetX, chartInsetY, chartW, chartH);
  URL.revokeObjectURL(url);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob failed"))), "image/png");
  });
}

// ═══ MAIN COMPONENT ═══
export default function ChartMaker() {
  const [csv, setCsv] = useState(SAMPLE_CSV);
  const [kind, setKind] = useState<ChartKind>("bar");
  const [palette, setPalette] = useState<PaletteKey>("sa");
  const [style, setStyle] = useState<StyleMode>("branded");
  const [title, setTitle] = useState("Accelerator Market Share");
  const [source, setSource] = useState("Source: SemiAnalysis Accelerator Model");
  const [exporting, setExporting] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const chartRef = useRef<HTMLDivElement>(null);
  const userCtx = useUser();

  const parsed = parseCSV(csv);
  const labelKey = parsed.columns[0] || "";
  const seriesKeys = parsed.columns.slice(1);
  const colors = PALETTES[palette].colors;

  function handleExport() {
    if (!chartRef.current) return;
    const svg = chartRef.current.querySelector("svg");
    if (!svg) { alert("Chart not ready"); return; }
    setExporting(true);
    const W = style === "branded" ? 1920 : 1600;
    const H = style === "branded" ? 1080 : 900;
    exportChartPNG(svg, W, H, style, style === "branded" ? title : "", style === "branded" ? source : "")
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        const safe = title.replace(/[^a-zA-Z0-9]+/g, "_").slice(0, 40);
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
      csv, kind, palette, style, title, source,
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
    const axisColor = style === "branded" ? "rgba(255,255,255,0.5)" : "#4A4858";
    const gridColor = style === "branded" ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)";
    const textColor = style === "branded" ? "#E8E4DD" : "#1A1A1A";
    const tooltipBg = style === "branded" ? "#0A0A14" : "#ffffff";
    const tooltipBorder = style === "branded" ? "rgba(255,255,255,0.1)" : "#E0E0E0";

    const common = { data: parsed.rows, margin: { top: 20, right: 30, left: 10, bottom: 10 } };
    const tickStyle = { fontSize: 14, fontFamily: "Outfit, sans-serif", fill: axisColor };
    const legendStyle = { color: textColor, fontFamily: "Outfit, sans-serif", fontSize: 14 };

    if (kind === "pie") {
      const pieData = parsed.rows.map((r) => ({ name: String(r[labelKey]), value: Number(r[seriesKeys[0]]) || 0 }));
      return (
        <ResponsiveContainer width="100%" height={520}>
          <PieChart>
            <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={180} label={{ fill: textColor, fontSize: 13, fontFamily: "Outfit, sans-serif" }}>
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
            <CartesianGrid stroke={gridColor} />
            <XAxis dataKey={labelKey} tick={tickStyle} stroke={axisColor} />
            <YAxis tick={tickStyle} stroke={axisColor} />
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
            <CartesianGrid stroke={gridColor} />
            <XAxis dataKey={labelKey} tick={tickStyle} stroke={axisColor} />
            <YAxis tick={tickStyle} stroke={axisColor} />
            <Tooltip contentStyle={{ background: tooltipBg, border: `1px solid ${tooltipBorder}`, borderRadius: 8, color: textColor }} />
            <Legend wrapperStyle={legendStyle} />
            {seriesKeys.map((k, i) => (
              <Area key={k} type="monotone" dataKey={k} stroke={colors[i % colors.length]} fill={colors[i % colors.length]} fillOpacity={0.35} strokeWidth={2} stackId={kind === "areaStacked" ? "a" : undefined} />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      );
    }

    // bar or stacked
    return (
      <ResponsiveContainer width="100%" height={520}>
        <BarChart {...common}>
          <CartesianGrid stroke={gridColor} vertical={false} />
          <XAxis dataKey={labelKey} tick={tickStyle} stroke={axisColor} />
          <YAxis tick={tickStyle} stroke={axisColor} />
          <Tooltip contentStyle={{ background: tooltipBg, border: `1px solid ${tooltipBorder}`, borderRadius: 8, color: textColor }} />
          <Legend wrapperStyle={legendStyle} />
          {seriesKeys.map((k, i) => (
            <Bar key={k} dataKey={k} fill={colors[i % colors.length]} stackId={kind === "stacked" ? "a" : undefined} radius={kind === "stacked" ? [0, 0, 0, 0] : [6, 6, 0, 0]} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    );
  }

  // ═══ UI ═══
  const previewBg = style === "branded"
    ? "linear-gradient(135deg, #06060C 0%, #0A0A14 100%)"
    : "#ffffff";

  return (
    <div style={{ padding: "28px 32px 60px", maxWidth: 1400, margin: "0 auto", color: C.tx, fontFamily: ft }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontFamily: ft, fontSize: 24, fontWeight: 900, color: C.tx, letterSpacing: -0.5 }}>Chart Maker</div>
        <div style={{ fontFamily: mn, fontSize: 11, color: C.txm, marginTop: 4, letterSpacing: 1 }}>PASTE CSV → PREVIEW → EXPORT PNG</div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "360px 1fr", gap: 20 }}>
        {/* ═══ CONTROLS PANEL ═══ */}
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {/* CSV */}
          <Section label="Data (CSV)">
            <textarea
              value={csv}
              onChange={(e) => setCsv(e.target.value)}
              rows={8}
              style={{ width: "100%", padding: 12, background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, color: C.tx, fontFamily: mn, fontSize: 11, lineHeight: 1.6, resize: "vertical", outline: "none", boxSizing: "border-box" }}
            />
            <div style={{ fontSize: 10, color: C.txd, fontFamily: mn, marginTop: 4 }}>
              First row = headers. First column = labels. Other columns = numeric series.
            </div>
          </Section>

          {/* Chart Type */}
          <Section label="Chart Type">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
              {CHART_KINDS.map((k) => (
                <Pill key={k.key} active={kind === k.key} onClick={() => setKind(k.key)}>{k.label}</Pill>
              ))}
            </div>
          </Section>

          {/* Palette */}
          <Section label="Palette">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
              {(Object.keys(PALETTES) as PaletteKey[]).map((k) => (
                <button key={k} onClick={() => setPalette(k)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: 8, background: palette === k ? C.amber + "15" : C.surface, border: `1px solid ${palette === k ? C.amber + "40" : C.border}`, color: palette === k ? C.amber : C.txm, fontFamily: ft, fontSize: 11, fontWeight: 600, cursor: "pointer", textAlign: "left" }}>
                  <div style={{ display: "flex", gap: 2 }}>
                    {PALETTES[k].colors.slice(0, 4).map((c, i) => (
                      <div key={i} style={{ width: 10, height: 10, borderRadius: 2, background: c }} />
                    ))}
                  </div>
                  {PALETTES[k].name}
                </button>
              ))}
            </div>
          </Section>

          {/* Style */}
          <Section label="Export Style">
            <div style={{ display: "flex", gap: 6 }}>
              <Pill active={style === "clean"} onClick={() => setStyle("clean")}>Clean (no backdrop)</Pill>
              <Pill active={style === "branded"} onClick={() => setStyle("branded")}>SA Branded</Pill>
            </div>
          </Section>

          {/* Title + source */}
          {style === "branded" && (
            <Section label="Slide Text (branded mode only)">
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Chart title" style={inputStyle(C)} />
              <div style={{ height: 6 }} />
              <input value={source} onChange={(e) => setSource(e.target.value)} placeholder="Source line" style={inputStyle(C)} />
            </Section>
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
            {/* Branded mode chrome inside preview */}
            {style === "branded" && (
              <>
                <div style={{ position: "absolute", top: 0, right: 0, width: "55%", height: "55%", background: "radial-gradient(circle at 80% 15%, rgba(247,176,65,0.12), transparent 65%)", pointerEvents: "none" }} />
                <div style={{ position: "absolute", bottom: 0, left: 0, width: "50%", height: "50%", background: "radial-gradient(circle at 10% 90%, rgba(11,134,209,0.08), transparent 65%)", pointerEvents: "none" }} />
                <div style={{ position: "relative", marginBottom: 16 }}>
                  <div style={{ width: 50, height: 3, background: C.amber, marginBottom: 14 }} />
                  <div style={{ fontFamily: ft, fontSize: 26, fontWeight: 900, color: "#E8E4DD", letterSpacing: -0.5 }}>{title || "Chart Title"}</div>
                </div>
              </>
            )}
            <div style={{ position: "relative" }}>{renderChart()}</div>
            {style === "branded" && (
              <div style={{ position: "absolute", bottom: 18, left: 40, right: 40, display: "flex", justifyContent: "space-between", alignItems: "center", fontFamily: mn, fontSize: 10 }}>
                <span style={{ color: "rgba(255,255,255,0.45)" }}>{source}</span>
                <span style={{ color: C.amber, fontWeight: 700, letterSpacing: 1.5 }}>SEMIANALYSIS</span>
              </div>
            )}
          </div>
          <div style={{ fontFamily: mn, fontSize: 10, color: C.txd, marginTop: 8 }}>
            {parsed.rows.length} rows · {seriesKeys.length} series · export: {style === "branded" ? "1920×1080 with SA backdrop" : "1600×900 clean on white"}
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══ SMALL HELPERS ═══
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
