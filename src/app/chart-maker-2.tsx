"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { D as C, ft, gf, mn } from "./shared-constants";
import { showToast } from "./toast-context";
import { Calendar, Download, Eye, EyeOff } from "lucide-react";

// ═══ Types ═══
interface RawTask {
  task: string;
  start: number; // unix ms
  end: number;
  group?: string;
  owner?: string;
  status?: string;
  progress?: number; // 0..100
  isMilestone?: boolean;
}

interface GroupBlock {
  key: string;
  label: string;
  color: string;
  start: number;
  end: number;
  tasks: RawTask[];
  collapsed?: boolean;
}

type TimeUnit = "week" | "month" | "quarter";

const GROUP_COLORS = [C.amber, C.blue, C.teal, C.coral, "#905CCB", "#26C9D8", "#7BD893", "#E8A020"];

// ═══ Parsing ═══
function parsePasted(text: string): RawTask[] {
  if (!text.trim()) return [];
  // Split into rows; tab is Excel default, fall back to comma
  const lines = text.replace(/\r/g, "").split("\n").filter(l => l.trim().length > 0);
  if (lines.length < 2) return [];
  const sep = lines[0].includes("\t") ? "\t" : ",";
  const headers = lines[0].split(sep).map(h => h.trim().toLowerCase());

  const colIdx = (...candidates: string[]): number => {
    for (const c of candidates) {
      const i = headers.indexOf(c);
      if (i !== -1) return i;
    }
    // partial match
    for (const c of candidates) {
      const i = headers.findIndex(h => h.includes(c));
      if (i !== -1) return i;
    }
    return -1;
  };

  const iTask = colIdx("task", "name", "activity", "item");
  const iStart = colIdx("start", "begin", "from");
  const iEnd = colIdx("end", "finish", "to", "due");
  const iGroup = colIdx("group", "phase", "category", "section", "workstream");
  const iOwner = colIdx("owner", "assignee", "lead", "who");
  const iStatus = colIdx("status", "state");
  const iPct = colIdx("%", "progress", "complete", "completion", "done");

  if (iTask === -1 || iStart === -1 || iEnd === -1) return [];

  const out: RawTask[] = [];
  for (let r = 1; r < lines.length; r++) {
    const cells = lines[r].split(sep).map(c => c.trim());
    const taskName = cells[iTask] || "";
    if (!taskName) continue;
    const startMs = parseDate(cells[iStart] || "");
    const endMs = parseDate(cells[iEnd] || "");
    if (!startMs || !endMs) continue;
    const t: RawTask = {
      task: taskName,
      start: startMs,
      end: Math.max(endMs, startMs),
      isMilestone: startMs === endMs,
    };
    if (iGroup !== -1) t.group = cells[iGroup] || undefined;
    if (iOwner !== -1) t.owner = cells[iOwner] || undefined;
    if (iStatus !== -1) t.status = cells[iStatus] || undefined;
    if (iPct !== -1) {
      const n = Number(String(cells[iPct] || "").replace("%", ""));
      if (!isNaN(n)) t.progress = Math.max(0, Math.min(100, n));
    }
    out.push(t);
  }
  return out;
}

function parseDate(s: string): number | null {
  const t = s.trim();
  if (!t) return null;
  // Try ISO / common formats
  let n = Date.parse(t);
  if (!isNaN(n)) return n;
  // Excel serial date number (days since 1899-12-30)
  const num = Number(t);
  if (!isNaN(num) && num > 20000 && num < 80000) {
    return Math.round((num - 25569) * 86400 * 1000);
  }
  return null;
}

// Group tasks into blocks (parent rows)
function buildGroups(tasks: RawTask[]): GroupBlock[] {
  const map = new Map<string, GroupBlock>();
  let colorI = 0;
  for (const t of tasks) {
    const key = t.group || "_ungrouped";
    let g = map.get(key);
    if (!g) {
      g = {
        key,
        label: t.group || "Tasks",
        color: GROUP_COLORS[colorI % GROUP_COLORS.length],
        start: t.start,
        end: t.end,
        tasks: [],
      };
      map.set(key, g);
      colorI++;
    }
    g.tasks.push(t);
    g.start = Math.min(g.start, t.start);
    g.end = Math.max(g.end, t.end);
  }
  return Array.from(map.values());
}

// ═══ Time axis helpers ═══
function startOfWeek(ms: number): number {
  const d = new Date(ms);
  const day = d.getUTCDay() || 7;
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - (day - 1));
  return d.getTime();
}
function startOfMonth(ms: number): number {
  const d = new Date(ms);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
}
function startOfQuarter(ms: number): number {
  const d = new Date(ms);
  const q = Math.floor(d.getUTCMonth() / 3);
  return Date.UTC(d.getUTCFullYear(), q * 3, 1);
}

function buildTicks(min: number, max: number, unit: TimeUnit): number[] {
  const out: number[] = [];
  let cur: number;
  if (unit === "week") cur = startOfWeek(min);
  else if (unit === "month") cur = startOfMonth(min);
  else cur = startOfQuarter(min);
  while (cur <= max) {
    out.push(cur);
    const d = new Date(cur);
    if (unit === "week") d.setUTCDate(d.getUTCDate() + 7);
    else if (unit === "month") d.setUTCMonth(d.getUTCMonth() + 1);
    else d.setUTCMonth(d.getUTCMonth() + 3);
    cur = d.getTime();
  }
  out.push(cur); // trailing tick for the right edge
  return out;
}

function formatTick(ms: number, unit: TimeUnit): string {
  const d = new Date(ms);
  const m = d.getUTCMonth();
  const y = d.getUTCFullYear();
  const monthShort = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][m];
  if (unit === "week") return monthShort + " " + d.getUTCDate();
  if (unit === "month") return monthShort + " " + String(y).slice(2);
  return "Q" + (Math.floor(m / 3) + 1) + " " + String(y).slice(2);
}

function fmtDateShort(ms: number): string {
  const d = new Date(ms);
  const monthShort = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][d.getUTCMonth()];
  return monthShort + " " + d.getUTCDate();
}

function durationDays(a: number, b: number): number {
  return Math.max(1, Math.round((b - a) / 86400000));
}

// ═══ Sample data ═══
const SAMPLE = `Task	Start	End	Group	Owner	%
Plan launch	2026-01-05	2026-01-19	Phase 1 · Discovery	Akash	100
Customer interviews	2026-01-12	2026-02-02	Phase 1 · Discovery	Vansh	100
Brand kit refresh	2026-01-26	2026-02-23	Phase 1 · Discovery	Michelle	75
Build CRM pipeline	2026-02-09	2026-04-06	Phase 2 · Build	Vansh	45
Press deck	2026-02-23	2026-03-30	Phase 2 · Build	Akash	60
Launch event prep	2026-03-16	2026-04-20	Phase 2 · Build	Michelle	20
Soft launch	2026-04-13	2026-04-20	Phase 3 · Launch	Akash	0
Public launch	2026-04-27	2026-04-27	Phase 3 · Launch	Akash	0
Week-1 retrospective	2026-05-04	2026-05-11	Phase 3 · Launch	Vansh	0`;

// ═══ Main component ═══
export default function ChartMaker2() {
  const [csv, setCsv] = useState<string>(SAMPLE);
  const [title, setTitle] = useState<string>("SemiAnalysis · 2026 Brand Launch");
  const [subtitle, setSubtitle] = useState<string>("Phased rollout with owner accountability");
  const [unit, setUnit] = useState<TimeUnit>("month");

  // Toggles
  const [showDates, setShowDates] = useState(true);
  const [showDuration, setShowDuration] = useState(false);
  const [showOwner, setShowOwner] = useState(true);
  const [showProgress, setShowProgress] = useState(true);
  const [showToday, setShowToday] = useState(true);
  const [showGroups, setShowGroups] = useState(true);
  const [collapseAll, setCollapseAll] = useState(false);
  const [collapsedKeys, setCollapsedKeys] = useState<Record<string, boolean>>({});

  const tasks = useMemo(() => parsePasted(csv), [csv]);
  const groups = useMemo(() => buildGroups(tasks), [tasks]);

  const toggleGroup = (k: string) => setCollapsedKeys(p => ({ ...p, [k]: !p[k] }));

  const svgRef = useRef<SVGSVGElement | null>(null);

  // Compute time bounds with a little padding on either side
  const bounds = useMemo(() => {
    if (tasks.length === 0) return null;
    const min = Math.min(...tasks.map(t => t.start));
    const max = Math.max(...tasks.map(t => t.end));
    const span = max - min;
    const pad = Math.max(span * 0.04, 86400000 * 3);
    return { min: min - pad, max: max + pad };
  }, [tasks]);

  // Visible rows (groups + tasks, respecting collapse state)
  const visibleRows = useMemo(() => {
    const rows: Array<{ kind: "group" | "task"; group: GroupBlock; task?: RawTask; idx: number }> = [];
    let i = 0;
    for (const g of groups) {
      const collapsed = collapseAll || !!collapsedKeys[g.key];
      if (showGroups) rows.push({ kind: "group", group: g, idx: i++ });
      if (!collapsed) {
        for (const t of g.tasks) rows.push({ kind: "task", group: g, task: t, idx: i++ });
      }
    }
    return rows;
  }, [groups, collapseAll, collapsedKeys, showGroups]);

  const exportPNG = () => {
    if (!svgRef.current) return;
    const svg = svgRef.current;
    const xml = new XMLSerializer().serializeToString(svg);
    const w = svg.clientWidth || 1200;
    const h = svg.clientHeight || 700;
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
        a.download = (title || "gantt").replace(/\s+/g, "-").toLowerCase() + ".png";
        a.click();
        URL.revokeObjectURL(dl);
      }, "image/png");
    };
    img.onerror = () => { showToast("Couldn't render PNG"); URL.revokeObjectURL(url); };
    img.src = url;
  };

  const cardBg = "#0D0D12";
  const borderC = "rgba(255,255,255,0.06)";

  return (
    <div style={{ padding: "32px 0 0", maxWidth: 1400, margin: "0 auto" }}>
      <div style={{ marginBottom: 24, display: "flex", alignItems: "flex-start", gap: 16 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: gf, fontSize: 28, fontWeight: 900, color: C.tx, letterSpacing: -0.5 }}>Chart Maker 2 · Gantt</div>
          <div style={{ fontFamily: mn, fontSize: 10, color: C.txm, marginTop: 4, letterSpacing: 1 }}>EXCEL → TIMELINE // THINK-CELL STYLE</div>
        </div>
        <button onClick={exportPNG} disabled={tasks.length === 0} style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 18px", borderRadius: 9, border: "1px solid " + C.amber + "55", background: tasks.length === 0 ? "transparent" : "linear-gradient(135deg," + C.amber + "," + "#E8A020)", color: tasks.length === 0 ? C.txd : "#060608", fontFamily: ft, fontSize: 13, fontWeight: 800, cursor: tasks.length === 0 ? "not-allowed" : "pointer", letterSpacing: 0.3, opacity: tasks.length === 0 ? 0.5 : 1 }}>
          <Download size={14} strokeWidth={2.2} />
          Export PNG
        </button>
      </div>

      {/* Title row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
        <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Title" style={inputStyle(cardBg, borderC)} />
        <input value={subtitle} onChange={e => setSubtitle(e.target.value)} placeholder="Subtitle" style={inputStyle(cardBg, borderC)} />
      </div>

      {/* Toggle bar */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14, padding: "10px 12px", background: cardBg, border: "1px solid " + borderC, borderRadius: 10 }}>
        <UnitPicker unit={unit} onChange={setUnit} />
        <Sep />
        <Toggle on={showDates} onChange={setShowDates} label="Dates" />
        <Toggle on={showDuration} onChange={setShowDuration} label="Duration" />
        <Toggle on={showOwner} onChange={setShowOwner} label="Owner" />
        <Toggle on={showProgress} onChange={setShowProgress} label="% Complete" />
        <Toggle on={showToday} onChange={setShowToday} label="Today" />
        <Sep />
        <Toggle on={showGroups} onChange={setShowGroups} label="Groups" />
        <Toggle on={collapseAll} onChange={setCollapseAll} label="Collapse all" />
      </div>

      {/* Paste textarea */}
      <details style={{ marginBottom: 14 }}>
        <summary style={{ cursor: "pointer", fontFamily: mn, fontSize: 10, color: C.txm, letterSpacing: 1.5, padding: "6px 0", textTransform: "uppercase" }}>Paste tasks (TSV from Excel · cols: Task / Start / End / Group / Owner / %)</summary>
        <textarea value={csv} onChange={e => setCsv(e.target.value)} rows={8} spellCheck={false} style={{ width: "100%", padding: "12px 14px", background: cardBg, border: "1px solid " + borderC, borderRadius: 10, color: C.tx, fontFamily: mn, fontSize: 12, outline: "none", boxSizing: "border-box", resize: "vertical", lineHeight: 1.6, marginTop: 8 }} />
      </details>

      {/* Gantt area */}
      <div style={{ background: "#0A0A0E", border: "1px solid " + borderC, borderRadius: 12, padding: "20px 24px 24px", overflow: "hidden" }}>
        {tasks.length === 0
          ? <div style={{ padding: 60, textAlign: "center", fontFamily: ft, fontSize: 13, color: C.txd }}>Paste a Task / Start / End table above to render the timeline.</div>
          : <Gantt
              ref={svgRef}
              title={title}
              subtitle={subtitle}
              groups={groups}
              visibleRows={visibleRows}
              bounds={bounds!}
              unit={unit}
              showDates={showDates}
              showDuration={showDuration}
              showOwner={showOwner}
              showProgress={showProgress}
              showToday={showToday}
              showGroups={showGroups}
              collapseAll={collapseAll}
              collapsedKeys={collapsedKeys}
              onToggleGroup={toggleGroup}
            />
        }
      </div>
    </div>
  );
}

// ═══ Sub-components ═══
function inputStyle(bg: string, border: string): React.CSSProperties {
  return { width: "100%", padding: "10px 14px", background: bg, border: "1px solid " + border, borderRadius: 9, color: C.tx, fontFamily: ft, fontSize: 13, outline: "none", boxSizing: "border-box" };
}

function Sep() { return <div style={{ width: 1, alignSelf: "stretch", background: "rgba(255,255,255,0.06)", margin: "2px 4px" }} />; }

function UnitPicker({ unit, onChange }: { unit: TimeUnit; onChange: (u: TimeUnit) => void }) {
  const opts: Array<{ id: TimeUnit; l: string }> = [
    { id: "week", l: "Week" },
    { id: "month", l: "Month" },
    { id: "quarter", l: "Quarter" },
  ];
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "0 4px" }}>
      <Calendar size={11} strokeWidth={2} color={C.txm} style={{ marginRight: 6 }} />
      {opts.map(o => {
        const on = unit === o.id;
        return <span key={o.id} onClick={() => onChange(o.id)} style={{ padding: "5px 10px", borderRadius: 6, cursor: "pointer", fontFamily: mn, fontSize: 10, fontWeight: 700, background: on ? C.amber + "20" : "transparent", color: on ? C.amber : C.txm, border: "1px solid " + (on ? C.amber + "55" : "transparent"), letterSpacing: 0.5 }}>{o.l}</span>;
      })}
    </div>
  );
}

function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <span onClick={() => onChange(!on)} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 10px", borderRadius: 6, cursor: "pointer", fontFamily: mn, fontSize: 10, fontWeight: 700, background: on ? C.amber + "18" : "transparent", color: on ? C.amber : C.txm, border: "1px solid " + (on ? C.amber + "45" : "rgba(255,255,255,0.08)"), letterSpacing: 0.5, transition: "all 0.15s" }}>
      {on ? <Eye size={11} strokeWidth={2.2} /> : <EyeOff size={11} strokeWidth={2} />}
      {label}
    </span>
  );
}

// ═══ Gantt SVG ═══
interface GanttProps {
  title: string;
  subtitle: string;
  groups: GroupBlock[];
  visibleRows: Array<{ kind: "group" | "task"; group: GroupBlock; task?: RawTask; idx: number }>;
  bounds: { min: number; max: number };
  unit: TimeUnit;
  showDates: boolean;
  showDuration: boolean;
  showOwner: boolean;
  showProgress: boolean;
  showToday: boolean;
  showGroups: boolean;
  collapseAll: boolean;
  collapsedKeys: Record<string, boolean>;
  onToggleGroup: (k: string) => void;
}

const Gantt = React.forwardRef<SVGSVGElement, GanttProps>(function Gantt(props, ref) {
  const { title, subtitle, visibleRows, bounds, unit, showDates, showDuration, showOwner, showProgress, showToday, showGroups, collapsedKeys, collapseAll, onToggleGroup } = props;

  // Layout dimensions
  const ROW_H = 36;
  const GROUP_ROW_H = 30;
  const HEADER_H = 56;
  const TITLE_H = 56;
  const LEFT_PANEL_W = 280;
  const PADDING = 16;

  const ticks = useMemo(() => buildTicks(bounds.min, bounds.max, unit), [bounds.min, bounds.max, unit]);

  // Total chart area
  const rowsHeight = visibleRows.reduce((acc, r) => acc + (r.kind === "group" ? GROUP_ROW_H : ROW_H), 0);
  const chartH = rowsHeight + HEADER_H + PADDING * 2;
  const totalH = chartH + TITLE_H;
  const totalW = 1280;
  const chartW = totalW - LEFT_PANEL_W - PADDING;

  const xOf = (ms: number) => {
    const t = (ms - bounds.min) / (bounds.max - bounds.min);
    return LEFT_PANEL_W + Math.max(0, Math.min(1, t)) * chartW;
  };

  const todayMs = Date.now();
  const todayX = xOf(todayMs);
  const todayInRange = todayMs >= bounds.min && todayMs <= bounds.max;

  // Pre-compute row tops
  const rowTops: number[] = [];
  let cursor = TITLE_H + HEADER_H + PADDING;
  for (const r of visibleRows) {
    rowTops.push(cursor);
    cursor += r.kind === "group" ? GROUP_ROW_H : ROW_H;
  }

  return (
    <svg
      ref={ref}
      viewBox={"0 0 " + totalW + " " + totalH}
      style={{ width: "100%", height: "auto", display: "block", fontFamily: ft }}
    >
      <rect x="0" y="0" width={totalW} height={totalH} fill="#0A0A0E" />

      {/* Title block */}
      <text x={LEFT_PANEL_W} y="26" fill="#E8E4DD" style={{ fontFamily: gf, fontSize: 18, fontWeight: 900 }}>{title}</text>
      <text x={LEFT_PANEL_W} y="46" fill={C.txm} style={{ fontFamily: mn, fontSize: 10, letterSpacing: 1 }}>{subtitle.toUpperCase()}</text>

      {/* Header axis grid */}
      {ticks.map((t, i) => {
        const x = xOf(t);
        const next = ticks[i + 1];
        const labelX = next ? (x + xOf(next)) / 2 : x;
        return (
          <g key={"tick-" + i}>
            <line x1={x} x2={x} y1={TITLE_H} y2={totalH - PADDING} stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
            {next && <text x={labelX} y={TITLE_H + 24} textAnchor="middle" fill={C.txm} style={{ fontFamily: mn, fontSize: 11, fontWeight: 700, letterSpacing: 0.5 }}>{formatTick(t, unit)}</text>}
          </g>
        );
      })}

      {/* Header underline */}
      <line x1={LEFT_PANEL_W} x2={totalW - PADDING} y1={TITLE_H + HEADER_H - 4} y2={TITLE_H + HEADER_H - 4} stroke="rgba(255,255,255,0.10)" strokeWidth="1" />

      {/* Rows */}
      {visibleRows.map((r, i) => {
        const top = rowTops[i];
        const isGroup = r.kind === "group";
        const rowH = isGroup ? GROUP_ROW_H : ROW_H;
        if (isGroup) {
          const collapsed = collapseAll || !!collapsedKeys[r.group.key];
          return (
            <g key={"g-" + r.group.key} onClick={() => onToggleGroup(r.group.key)} style={{ cursor: "pointer" }}>
              <rect x="0" y={top} width={totalW} height={rowH} fill="rgba(255,255,255,0.015)" />
              <polygon
                points={collapsed
                  ? `12,${top + rowH / 2 - 5} 18,${top + rowH / 2} 12,${top + rowH / 2 + 5}`
                  : `10,${top + rowH / 2 - 4} 18,${top + rowH / 2 - 4} 14,${top + rowH / 2 + 4}`}
                fill={r.group.color}
              />
              <text x="26" y={top + rowH / 2 + 4} fill="#E8E4DD" style={{ fontFamily: ft, fontSize: 12, fontWeight: 800, letterSpacing: 0.3 }}>{r.group.label.toUpperCase()}</text>
              {/* Group span bracket */}
              <line x1={xOf(r.group.start)} x2={xOf(r.group.end)} y1={top + rowH / 2} y2={top + rowH / 2} stroke={r.group.color} strokeWidth="2" opacity="0.6" />
              <circle cx={xOf(r.group.start)} cy={top + rowH / 2} r="3" fill={r.group.color} />
              <circle cx={xOf(r.group.end)} cy={top + rowH / 2} r="3" fill={r.group.color} />
            </g>
          );
        }
        const t = r.task!;
        const color = r.group.color;
        const x1 = xOf(t.start);
        const x2 = xOf(t.end);
        const w = Math.max(2, x2 - x1);
        const barTop = top + 8;
        const barH = ROW_H - 16;
        const isMs = !!t.isMilestone;
        return (
          <g key={"t-" + i}>
            {/* row striping */}
            {i % 2 === 0 && <rect x="0" y={top} width={totalW} height={rowH} fill="rgba(255,255,255,0.015)" />}
            {/* Task name */}
            <text x="32" y={top + ROW_H / 2 + 4} fill="#E8E4DD" style={{ fontFamily: ft, fontSize: 12, fontWeight: 500 }}>{t.task}</text>
            {showOwner && t.owner && <text x={LEFT_PANEL_W - 12} y={top + ROW_H / 2 + 4} textAnchor="end" fill={color} style={{ fontFamily: mn, fontSize: 10, fontWeight: 700, letterSpacing: 0.5 }}>{t.owner}</text>}

            {/* Bar or milestone */}
            {isMs ? (
              <g>
                <polygon
                  points={`${x1},${barTop} ${x1 + barH / 2},${barTop + barH / 2} ${x1},${barTop + barH} ${x1 - barH / 2},${barTop + barH / 2}`}
                  fill={color}
                  stroke="rgba(255,255,255,0.15)"
                />
                {showDates && <text x={x1 + barH / 2 + 8} y={top + ROW_H / 2 + 4} fill={C.txm} style={{ fontFamily: mn, fontSize: 10 }}>{fmtDateShort(t.start)}</text>}
              </g>
            ) : (
              <g>
                <rect x={x1} y={barTop} width={w} height={barH} rx="5" ry="5" fill={color} fillOpacity="0.35" stroke={color} strokeWidth="1" />
                {showProgress && t.progress !== undefined && t.progress > 0 && (
                  <rect x={x1} y={barTop} width={w * (t.progress / 100)} height={barH} rx="5" ry="5" fill={color} fillOpacity="0.85" />
                )}
                {showDates && w > 60 && (
                  <>
                    <text x={x1 + 8} y={top + ROW_H / 2 + 4} fill="#0A0A0E" style={{ fontFamily: mn, fontSize: 9, fontWeight: 700 }}>{fmtDateShort(t.start)}</text>
                    <text x={x2 - 8} y={top + ROW_H / 2 + 4} textAnchor="end" fill="#0A0A0E" style={{ fontFamily: mn, fontSize: 9, fontWeight: 700 }}>{fmtDateShort(t.end)}</text>
                  </>
                )}
                {showDuration && w > 40 && (
                  <text x={x1 + w / 2} y={top + ROW_H / 2 + 4} textAnchor="middle" fill="#0A0A0E" style={{ fontFamily: mn, fontSize: 9, fontWeight: 800 }}>{durationDays(t.start, t.end)}d</text>
                )}
                {showProgress && t.progress !== undefined && (
                  <text x={x2 + 6} y={top + ROW_H / 2 + 4} fill={color} style={{ fontFamily: mn, fontSize: 9, fontWeight: 700 }}>{t.progress}%</text>
                )}
              </g>
            )}
          </g>
        );
      })}

      {/* Today line */}
      {showToday && todayInRange && (
        <g>
          <line x1={todayX} x2={todayX} y1={TITLE_H + HEADER_H - 8} y2={totalH - PADDING} stroke={C.coral} strokeWidth="1.5" strokeDasharray="3 4" opacity="0.85" />
          <rect x={todayX - 22} y={TITLE_H + HEADER_H - 22} width="44" height="16" rx="3" fill={C.coral} />
          <text x={todayX} y={TITLE_H + HEADER_H - 10} textAnchor="middle" fill="#fff" style={{ fontFamily: mn, fontSize: 9, fontWeight: 800, letterSpacing: 1 }}>TODAY</text>
        </g>
      )}

      {/* Left panel border */}
      <line x1={LEFT_PANEL_W} x2={LEFT_PANEL_W} y1={TITLE_H} y2={totalH - PADDING} stroke="rgba(255,255,255,0.10)" strokeWidth="1" />
    </svg>
  );
});
