"use client";

// TableEditor v2 — SA-branded data table / heatmap renderer with live
// preview, full design controls (ChartMaker-style properties panel), and
// SVG / PNG / JPEG export. The user edits structured data + metadata, the
// preview re-renders on every keystroke, and download buttons rasterize
// the live SVG at 2× pixel density.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronDown, ChevronRight, Copy, Download, FileImage, FileText, Image as ImageIcon,
  Plus, Sparkles, X,
} from "lucide-react";
import { showToast } from "../toast-context";
import {
  blankRow, coerce, newColumnKey, templateSheet, toCsv, toMarkdown,
} from "./lib/data-sheet";
import SaTableSvg, { SA_TABLE_HEIGHT, SA_TABLE_WIDTH } from "./lib/sa-table-svg";
import { D, ft, gf, mn } from "./studio-theme";
import {
  StudioDoc, TableCellValue, TableColumnType, TableDocPayload, TableMode,
  TableInputItem, TableSheet,
} from "./studio-types";

interface TableEditorProps {
  doc: StudioDoc;
  onChangePayload: (payload: unknown) => void;
  onBuildChart?: (sheet: TableSheet, name: string) => void;
}

export default function TableEditor({ doc, onChangePayload, onBuildChart }: TableEditorProps) {
  // ── State ──────────────────────────────────────────────────────────
  const initial = useMemo(() => readPayload(doc.payload, doc.name), [doc.payload, doc.name]);
  const [sheet, setSheet] = useState<TableSheet>(initial.sheet);
  const [mode, setMode] = useState<TableMode>(initial.mode);
  const [category, setCategory] = useState(initial.category);
  const [titleWhite, setTitleWhite] = useState(initial.titleWhite);
  const [titleAmber, setTitleAmber] = useState(initial.titleAmber);
  const [subtitle, setSubtitle] = useState(initial.subtitle);
  const [titleBar, setTitleBar] = useState(initial.titleBar);
  const [highlightRowIdx, setHighlightRowIdx] = useState<number | undefined>(initial.highlightRowIdx);
  const [highlightFlagCol, setHighlightFlagCol] = useState<number | undefined>(initial.highlightFlagCol);
  const [keyInsight, setKeyInsight] = useState(initial.keyInsight);
  const [threshold, setThreshold] = useState(initial.threshold);
  const [yellowBand, setYellowBand] = useState(initial.yellowBand);
  const [topAxisLabel, setTopAxisLabel] = useState(initial.topAxisLabel);
  const [leftAxisLabel, setLeftAxisLabel] = useState(initial.leftAxisLabel);
  const [baselineRow, setBaselineRow] = useState<number | undefined>(initial.baselineRow);
  const [baselineCol, setBaselineCol] = useState<number | undefined>(initial.baselineCol);
  const [panelKind, setPanelKind] = useState<"inputs" | "caveats">(initial.panelKind);
  const [panelItems, setPanelItems] = useState<TableInputItem[]>(initial.panelItems);
  const [formula, setFormula] = useState(initial.formula);
  const [formulaBaseline, setFormulaBaseline] = useState(initial.formulaBaseline);
  const [formulaResult, setFormulaResult] = useState(initial.formulaResult);

  const [gridOpen, setGridOpen] = useState(true);
  const previewRef = useRef<HTMLDivElement | null>(null);

  // ── Emit payload upstream ──────────────────────────────────────────
  useEffect(() => {
    const payload: TableDocPayload = {
      kind: "table", version: 1,
      engine: "standard",
      sheet,
      mode, category, titleWhite, titleAmber, subtitle,
      titleBar, highlightRowIdx, highlightFlagCol, keyInsight,
      threshold, yellowBand, topAxisLabel, leftAxisLabel,
      baselineRow, baselineCol,
      panelKind, panelItems,
      formula, formulaBaseline, formulaResult,
    };
    onChangePayload(payload);
  }, [
    sheet, mode, category, titleWhite, titleAmber, subtitle,
    titleBar, highlightRowIdx, highlightFlagCol, keyInsight,
    threshold, yellowBand, topAxisLabel, leftAxisLabel,
    baselineRow, baselineCol, panelKind, panelItems,
    formula, formulaBaseline, formulaResult,
    onChangePayload,
  ]);

  // ── Grid mutations ─────────────────────────────────────────────────
  const updateCell = useCallback((rowIdx: number, key: string, value: string) => {
    setSheet((cur) => {
      const col = cur.schema.find(c => c.key === key);
      if (!col) return cur;
      const next = cur.rows.slice();
      next[rowIdx] = { ...next[rowIdx], [key]: coerce(value, col.type) };
      return { ...cur, rows: next };
    });
  }, []);
  const renameColumn = useCallback((key: string, label: string) => {
    setSheet((cur) => ({ ...cur, schema: cur.schema.map(c => c.key === key ? { ...c, label } : c) }));
  }, []);
  const setColumnType = useCallback((key: string, type: TableColumnType) => {
    setSheet((cur) => ({
      ...cur,
      schema: cur.schema.map(c => c.key === key ? { ...c, type } : c),
      rows: cur.rows.map(r => ({ ...r, [key]: type === "text" ? (r[key] == null ? "" : String(r[key])) : coerce(String(r[key] ?? ""), type) })),
    }));
  }, []);
  const addColumn = useCallback(() => {
    setSheet((cur) => {
      const k = newColumnKey(cur.schema);
      return {
        schema: [...cur.schema, { key: k, label: "Column", type: "number" as const }],
        rows: cur.rows.map(r => ({ ...r, [k]: 0 })),
      };
    });
  }, []);
  const deleteColumn = useCallback((key: string) => {
    setSheet((cur) => {
      if (cur.schema.length <= 1) return cur;
      return {
        schema: cur.schema.filter(c => c.key !== key),
        rows: cur.rows.map(r => { const n = { ...r }; delete n[key]; return n; }),
      };
    });
  }, []);
  const addRow = useCallback(() => {
    setSheet((cur) => ({ ...cur, rows: [...cur.rows, blankRow(cur.schema)] }));
  }, []);
  const deleteRow = useCallback((rowIdx: number) => {
    setSheet((cur) => ({ ...cur, rows: cur.rows.filter((_, i) => i !== rowIdx) }));
  }, []);

  // ── Exports ────────────────────────────────────────────────────────
  const downloadSvg = useCallback(() => {
    const svg = previewRef.current?.querySelector("svg");
    if (!svg) { showToast("Preview not ready"); return; }
    const xml = new XMLSerializer().serializeToString(svg);
    const blob = new Blob([
      '<?xml version="1.0" encoding="UTF-8"?>\n',
      xml,
    ], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = (doc.name || "table") + ".svg";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
    showToast("SVG downloaded");
  }, [doc.name]);

  const rasterize = useCallback(async (format: "png" | "jpeg"): Promise<void> => {
    const svg = previewRef.current?.querySelector("svg");
    if (!svg) { showToast("Preview not ready"); return; }
    try {
      const xml = new XMLSerializer().serializeToString(svg);
      const blob = new Blob([xml], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("svg → image failed"));
        img.src = url;
      });
      const scale = 2;
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(SA_TABLE_WIDTH * scale);
      canvas.height = Math.round(SA_TABLE_HEIGHT * scale);
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("no canvas context");
      if (format === "jpeg") {
        // JPEGs can't be transparent — paint the SA dark base first.
        ctx.fillStyle = "#0A0C10";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      const dataUrl = canvas.toDataURL(format === "jpeg" ? "image/jpeg" : "image/png", 0.94);
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = (doc.name || "table") + "." + format;
      a.click();
      showToast(format.toUpperCase() + " downloaded");
    } catch (e) {
      showToast("Rasterize failed — try SVG");
      void e;
    }
  }, [doc.name]);

  const exportCsv = useCallback(() => {
    const text = toCsv(sheet);
    const blob = new Blob([text], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = (doc.name || "table") + ".csv";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    showToast("CSV downloaded");
  }, [sheet, doc.name]);
  const copyMarkdown = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(toMarkdown(sheet));
      showToast("Markdown copied");
    } catch { showToast("Copy failed"); }
  }, [sheet]);

  // ── Render ─────────────────────────────────────────────────────────
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "1fr 300px",
      gap: 14,
      padding: "12px 22px 60px",
      maxWidth: 1680,
      margin: "0 auto",
    }}>
      <div>
        {/* Toolbar */}
        <div style={{
          display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap",
          padding: "8px 12px",
          background: D.card, border: "1px solid " + D.border, borderRadius: 11,
        }}>
          <ModeToggle value={mode} onChange={setMode} />
          <span style={{ width: 1, height: 18, background: D.border, margin: "0 4px" }} />
          <ToolbarBtn Icon={Download}   label="SVG"  accent={D.amber}  onClick={downloadSvg} />
          <ToolbarBtn Icon={ImageIcon}  label="PNG"  accent={D.teal}   onClick={() => rasterize("png")} />
          <ToolbarBtn Icon={FileImage}  label="JPEG" accent={D.coral}  onClick={() => rasterize("jpeg")} />
          <span style={{ width: 1, height: 18, background: D.border, margin: "0 4px" }} />
          <ToolbarBtn Icon={FileText} label="CSV"      onClick={exportCsv} />
          <ToolbarBtn Icon={Copy}     label="Markdown" onClick={copyMarkdown} />
          {onBuildChart && (
            <>
              <span style={{ marginLeft: "auto" }} />
              <ToolbarBtn Icon={Sparkles} label="Build chart" accent={D.amber} onClick={() => onBuildChart(sheet, titleWhite || doc.name)} />
            </>
          )}
        </div>

        {/* Live preview */}
        <div
          ref={previewRef}
          style={{
            marginTop: 14,
            background: "#06060A",
            border: "1px solid " + D.border, borderRadius: 14,
            overflow: "hidden",
            boxShadow: "0 18px 44px rgba(0,0,0,0.5)",
            aspectRatio: SA_TABLE_WIDTH + " / " + SA_TABLE_HEIGHT,
            width: "100%",
            position: "relative",
          }}
        >
          <SaTableSvg
            mode={mode}
            sheet={sheet}
            category={category}
            titleWhite={titleWhite}
            titleAmber={titleAmber}
            subtitle={subtitle}
            titleBar={titleBar}
            highlightRowIdx={highlightRowIdx}
            highlightFlagCol={highlightFlagCol}
            keyInsight={keyInsight}
            threshold={threshold}
            yellowBand={yellowBand}
            topAxisLabel={topAxisLabel}
            leftAxisLabel={leftAxisLabel}
            baselineRow={baselineRow}
            baselineCol={baselineCol}
            panelKind={panelKind}
            panelItems={panelItems}
            formula={formula}
            formulaBaseline={formulaBaseline}
            formulaResult={formulaResult}
          />
        </div>

        {/* Data grid drawer */}
        <Collapsible label="Data" open={gridOpen} onToggle={() => setGridOpen(v => !v)}>
          <DataGrid
            sheet={sheet}
            onUpdateCell={updateCell}
            onRenameColumn={renameColumn}
            onChangeColumnType={setColumnType}
            onAddColumn={addColumn}
            onDeleteColumn={deleteColumn}
            onAddRow={addRow}
            onDeleteRow={deleteRow}
          />
        </Collapsible>
      </div>

      {/* Properties rail */}
      <PropertiesRail
        mode={mode}
        sheet={sheet}
        category={category} setCategory={setCategory}
        titleWhite={titleWhite} setTitleWhite={setTitleWhite}
        titleAmber={titleAmber} setTitleAmber={setTitleAmber}
        subtitle={subtitle} setSubtitle={setSubtitle}
        titleBar={titleBar} setTitleBar={setTitleBar}
        highlightRowIdx={highlightRowIdx} setHighlightRowIdx={setHighlightRowIdx}
        highlightFlagCol={highlightFlagCol} setHighlightFlagCol={setHighlightFlagCol}
        keyInsight={keyInsight} setKeyInsight={setKeyInsight}
        threshold={threshold} setThreshold={setThreshold}
        yellowBand={yellowBand} setYellowBand={setYellowBand}
        topAxisLabel={topAxisLabel} setTopAxisLabel={setTopAxisLabel}
        leftAxisLabel={leftAxisLabel} setLeftAxisLabel={setLeftAxisLabel}
        baselineRow={baselineRow} setBaselineRow={setBaselineRow}
        baselineCol={baselineCol} setBaselineCol={setBaselineCol}
        panelKind={panelKind} setPanelKind={setPanelKind}
        panelItems={panelItems} setPanelItems={setPanelItems}
        formula={formula} setFormula={setFormula}
        formulaBaseline={formulaBaseline} setFormulaBaseline={setFormulaBaseline}
        formulaResult={formulaResult} setFormulaResult={setFormulaResult}
      />
    </div>
  );
}

// ─── Payload hydration ─────────────────────────────────────────────────

function readPayload(payload: unknown, defaultName: string) {
  const seed = {
    sheet: templateSheet(undefined),
    mode: "data" as TableMode,
    category: "SEMIANALYSIS — RESEARCH",
    titleWhite: defaultName || "Untitled",
    titleAmber: "",
    subtitle: "Quarterly breakdown · 2026",
    titleBar: "DATA TABLE",
    highlightRowIdx: undefined as number | undefined,
    highlightFlagCol: undefined as number | undefined,
    keyInsight: "",
    threshold: 30,
    yellowBand: 0.5,
    topAxisLabel: "",
    leftAxisLabel: "",
    baselineRow: undefined as number | undefined,
    baselineCol: undefined as number | undefined,
    panelKind: "inputs" as "inputs" | "caveats",
    panelItems: [] as TableInputItem[],
    formula: "",
    formulaBaseline: "",
    formulaResult: "",
  };
  if (payload && typeof payload === "object") {
    const p = payload as Partial<TableDocPayload>;
    if (p.sheet && p.sheet.schema?.length) seed.sheet = p.sheet;
    else if (p.templateId) seed.sheet = templateSheet(p.templateId);
    if (p.mode === "heatmap" || p.mode === "data") seed.mode = p.mode;
    if (p.category != null) seed.category = p.category;
    if (p.titleWhite != null) seed.titleWhite = p.titleWhite;
    if (p.titleAmber != null) seed.titleAmber = p.titleAmber;
    if (p.subtitle != null) seed.subtitle = p.subtitle;
    if (p.titleBar != null) seed.titleBar = p.titleBar;
    if (p.highlightRowIdx != null) seed.highlightRowIdx = p.highlightRowIdx;
    if (p.highlightFlagCol != null) seed.highlightFlagCol = p.highlightFlagCol;
    if (p.keyInsight != null) seed.keyInsight = p.keyInsight;
    if (p.threshold != null) seed.threshold = p.threshold;
    if (p.yellowBand != null) seed.yellowBand = p.yellowBand;
    if (p.topAxisLabel != null) seed.topAxisLabel = p.topAxisLabel;
    if (p.leftAxisLabel != null) seed.leftAxisLabel = p.leftAxisLabel;
    if (p.baselineRow != null) seed.baselineRow = p.baselineRow;
    if (p.baselineCol != null) seed.baselineCol = p.baselineCol;
    if (p.panelKind === "inputs" || p.panelKind === "caveats") seed.panelKind = p.panelKind;
    if (Array.isArray(p.panelItems)) seed.panelItems = p.panelItems;
    if (p.formula != null) seed.formula = p.formula;
    if (p.formulaBaseline != null) seed.formulaBaseline = p.formulaBaseline;
    if (p.formulaResult != null) seed.formulaResult = p.formulaResult;
  }
  return seed;
}

// ─── Toolbar bits ──────────────────────────────────────────────────────

function ModeToggle({ value, onChange }: { value: TableMode; onChange: (m: TableMode) => void }) {
  return (
    <div style={{
      display: "inline-flex", gap: 2,
      padding: 3,
      background: "rgba(255,255,255,0.03)", border: "1px solid " + D.border, borderRadius: 8,
    }}>
      {(["data", "heatmap"] as TableMode[]).map((m) => {
        const on = m === value;
        return (
          <button
            key={m}
            onClick={() => onChange(m)}
            style={{
              padding: "5px 12px",
              background: on ? D.amber + "22" : "transparent",
              border: "none",
              color: on ? D.amber : D.txm,
              fontFamily: mn, fontSize: 10.5, fontWeight: 800, letterSpacing: 0.5,
              borderRadius: 5, cursor: "pointer", textTransform: "uppercase",
            }}
          >{m === "data" ? "Data table" : "Heatmap"}</button>
        );
      })}
    </div>
  );
}

function ToolbarBtn({ Icon, label, onClick, accent }: {
  Icon: React.ComponentType<{ size?: number; strokeWidth?: number; color?: string }>;
  label: string;
  onClick: () => void;
  accent?: string;
}) {
  const c = accent || D.txm;
  return (
    <button
      onClick={onClick}
      style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        padding: "5px 11px",
        background: accent ? c + "1A" : "transparent",
        border: "1px solid " + (accent ? c + "55" : D.border),
        color: accent ? c : D.txm,
        fontFamily: mn, fontSize: 10.5, fontWeight: 700, letterSpacing: 0.5,
        borderRadius: 6, cursor: "pointer",
        transition: "background 0.12s, color 0.12s",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.color = accent ? c : D.tx;
        if (!accent) e.currentTarget.style.background = "rgba(255,255,255,0.04)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.color = accent ? c : D.txm;
        if (!accent) e.currentTarget.style.background = "transparent";
      }}
    ><Icon size={12} strokeWidth={2.2} color={accent || D.txm} /> {label}</button>
  );
}

// ─── Properties rail ───────────────────────────────────────────────────

interface PropsRailProps {
  mode: TableMode;
  sheet: TableSheet;
  category: string; setCategory: (s: string) => void;
  titleWhite: string; setTitleWhite: (s: string) => void;
  titleAmber: string; setTitleAmber: (s: string) => void;
  subtitle: string; setSubtitle: (s: string) => void;
  titleBar: string; setTitleBar: (s: string) => void;
  highlightRowIdx?: number; setHighlightRowIdx: (n: number | undefined) => void;
  highlightFlagCol?: number; setHighlightFlagCol: (n: number | undefined) => void;
  keyInsight: string; setKeyInsight: (s: string) => void;
  threshold: number; setThreshold: (n: number) => void;
  yellowBand: number; setYellowBand: (n: number) => void;
  topAxisLabel: string; setTopAxisLabel: (s: string) => void;
  leftAxisLabel: string; setLeftAxisLabel: (s: string) => void;
  baselineRow?: number; setBaselineRow: (n: number | undefined) => void;
  baselineCol?: number; setBaselineCol: (n: number | undefined) => void;
  panelKind: "inputs" | "caveats"; setPanelKind: (k: "inputs" | "caveats") => void;
  panelItems: TableInputItem[]; setPanelItems: (items: TableInputItem[]) => void;
  formula: string; setFormula: (s: string) => void;
  formulaBaseline: string; setFormulaBaseline: (s: string) => void;
  formulaResult: string; setFormulaResult: (s: string) => void;
}

function PropertiesRail(p: PropsRailProps) {
  const [headerOpen, setHeaderOpen] = useState(true);
  const [dataModeOpen, setDataModeOpen] = useState(true);
  const [heatmapOpen, setHeatmapOpen] = useState(true);
  const [panelOpen, setPanelOpen] = useState(false);
  const [formulaOpen, setFormulaOpen] = useState(false);
  return (
    <aside style={{
      alignSelf: "start",
      position: "sticky", top: 80,
      maxHeight: "calc(100vh - 100px)", overflowY: "auto",
      background: D.card, border: "1px solid " + D.border, borderRadius: 12,
    }}>
      <SectionTitle label="Properties" />
      <PanelSection label="Header" open={headerOpen} onToggle={() => setHeaderOpen(v => !v)}>
        <Field label="Category eyebrow">
          <TextInput value={p.category} onChange={p.setCategory} placeholder="SEMIANALYSIS — RESEARCH" />
        </Field>
        <Field label="Title (white)">
          <TextInput value={p.titleWhite} onChange={p.setTitleWhite} placeholder="Primary title" />
        </Field>
        <Field label="Title (amber accent)">
          <TextInput value={p.titleAmber} onChange={p.setTitleAmber} placeholder="appended in amber" />
        </Field>
        <Field label="Subtitle">
          <TextInput value={p.subtitle} onChange={p.setSubtitle} placeholder="Quarter · year · inputs" />
        </Field>
      </PanelSection>
      {p.mode === "data" && (
        <PanelSection label="Data table" open={dataModeOpen} onToggle={() => setDataModeOpen(v => !v)}>
          <Field label="Table title bar">
            <TextInput value={p.titleBar} onChange={p.setTitleBar} placeholder="TABLE TITLE" />
          </Field>
          <Field label="Highlight row">
            <RowPicker
              count={p.sheet.rows.length}
              value={p.highlightRowIdx}
              onChange={p.setHighlightRowIdx}
              sheet={p.sheet}
            />
          </Field>
          {p.highlightRowIdx != null && (
            <Field label="Flag cell (column)">
              <RowPicker
                count={Math.max(0, p.sheet.schema.length - 1)}
                value={p.highlightFlagCol}
                onChange={p.setHighlightFlagCol}
                kind="column"
                sheet={p.sheet}
                offset={1}
              />
            </Field>
          )}
          <Field label="Key insight (paragraph)">
            <TextArea value={p.keyInsight} onChange={p.setKeyInsight}
              placeholder="At [condition], [metric] hits $X — within $Y of [threshold]." />
          </Field>
        </PanelSection>
      )}
      {p.mode === "heatmap" && (
        <PanelSection label="Heatmap" open={heatmapOpen} onToggle={() => setHeatmapOpen(v => !v)}>
          <Field label="Threshold (break-even)">
            <NumberInput value={p.threshold} onChange={p.setThreshold} />
          </Field>
          <Field label="Yellow band half-width">
            <NumberInput value={p.yellowBand} onChange={p.setYellowBand} step={0.1} />
          </Field>
          <Field label="Top axis label">
            <TextInput value={p.topAxisLabel} onChange={p.setTopAxisLabel} placeholder="UTILIZATION" />
          </Field>
          <Field label="Left axis label">
            <TextInput value={p.leftAxisLabel} onChange={p.setLeftAxisLabel} placeholder="THROUGHPUT" />
          </Field>
          <Field label="Baseline cell (row)">
            <RowPicker
              count={p.sheet.rows.length}
              value={p.baselineRow}
              onChange={p.setBaselineRow}
              sheet={p.sheet}
            />
          </Field>
          <Field label="Baseline cell (column)">
            <RowPicker
              count={Math.max(0, p.sheet.schema.length - 1)}
              value={p.baselineCol}
              onChange={p.setBaselineCol}
              kind="column"
              sheet={p.sheet}
              offset={1}
            />
          </Field>
        </PanelSection>
      )}
      {p.mode === "heatmap" && (
        <PanelSection label="Inputs / Caveats" open={panelOpen} onToggle={() => setPanelOpen(v => !v)}>
          <Field label="Panel kind">
            <KindToggle value={p.panelKind} onChange={p.setPanelKind} a="inputs" b="caveats" />
          </Field>
          {p.panelItems.map((it, i) => (
            <Field key={i} label={p.panelKind === "caveats" ? "Bullet " + (i + 1) : "Input " + (i + 1)}>
              <div style={{ display: "flex", gap: 6 }}>
                <TextInput value={it.label} onChange={(v) => {
                  const next = p.panelItems.slice();
                  next[i] = { ...next[i], label: v };
                  p.setPanelItems(next);
                }} placeholder="label" />
                <TextInput value={it.value || ""} onChange={(v) => {
                  const next = p.panelItems.slice();
                  next[i] = { ...next[i], value: v };
                  p.setPanelItems(next);
                }} placeholder="value" />
                <button onClick={() => p.setPanelItems(p.panelItems.filter((_, j) => j !== i))}
                  style={{
                    background: "transparent", border: "1px solid " + D.border,
                    color: D.txd, padding: "5px 7px",
                    borderRadius: 5, cursor: "pointer",
                  }}><X size={11} strokeWidth={2.2} /></button>
              </div>
            </Field>
          ))}
          <button onClick={() => p.setPanelItems([...p.panelItems, { label: "", value: "" }])}
            disabled={p.panelItems.length >= 6}
            style={{
              padding: "6px 11px",
              background: "transparent", border: "1px dashed " + D.border,
              color: D.txm, fontFamily: mn, fontSize: 10, fontWeight: 700, letterSpacing: 0.5,
              borderRadius: 6, cursor: p.panelItems.length >= 6 ? "not-allowed" : "pointer",
              opacity: p.panelItems.length >= 6 ? 0.4 : 1,
              display: "inline-flex", alignItems: "center", gap: 5,
            }}><Plus size={11} strokeWidth={2.2} /> add item</button>
        </PanelSection>
      )}
      {p.mode === "heatmap" && (
        <PanelSection label="Formula box" open={formulaOpen} onToggle={() => setFormulaOpen(v => !v)}>
          <Field label="Formula">
            <TextInput value={p.formula} onChange={p.setFormula} placeholder="payback = capex / annual_savings" />
          </Field>
          <Field label="Baseline calc">
            <TextInput value={p.formulaBaseline} onChange={p.setFormulaBaseline} placeholder="80000 / 25000 ÷ 12" />
          </Field>
          <Field label="Result">
            <TextInput value={p.formulaResult} onChange={p.setFormulaResult} placeholder="3.2 yrs" />
          </Field>
        </PanelSection>
      )}
    </aside>
  );
}

function SectionTitle({ label }: { label: string }) {
  return (
    <div style={{
      padding: "12px 14px 8px",
      borderBottom: "1px solid " + D.border,
      fontFamily: gf, fontSize: 13, fontWeight: 800, color: D.tx, letterSpacing: -0.1,
    }}>{label}</div>
  );
}

function PanelSection({ label, open, onToggle, children }: { label: string; open: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <div style={{ borderBottom: "1px solid " + D.border }}>
      <button onClick={onToggle}
        style={{
          width: "100%", display: "flex", alignItems: "center", gap: 6,
          padding: "10px 14px",
          background: "transparent", border: "none",
          color: D.amber, cursor: "pointer", textAlign: "left",
          fontFamily: mn, fontSize: 9.5, fontWeight: 800, letterSpacing: 1.2, textTransform: "uppercase",
        }}>
        {open ? <ChevronDown size={12} strokeWidth={2.2} /> : <ChevronRight size={12} strokeWidth={2.2} />}
        {label}
      </button>
      {open && (
        <div style={{ padding: "0 14px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
          {children}
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{
        fontFamily: mn, fontSize: 8.5, color: D.txd, letterSpacing: 0.7,
        textTransform: "uppercase", marginBottom: 4,
      }}>{label}</div>
      {children}
    </div>
  );
}

function TextInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      style={{
        width: "100%", boxSizing: "border-box",
        background: D.bg, color: D.tx,
        border: "1px solid " + D.border, borderRadius: 6,
        padding: "6px 9px",
        fontFamily: ft, fontSize: 12, outline: "none",
      }}
    />
  );
}

function TextArea({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={3}
      style={{
        width: "100%", boxSizing: "border-box",
        background: D.bg, color: D.tx,
        border: "1px solid " + D.border, borderRadius: 6,
        padding: "6px 9px",
        fontFamily: ft, fontSize: 12, outline: "none", resize: "vertical",
      }}
    />
  );
}

function NumberInput({ value, onChange, step }: { value: number; onChange: (v: number) => void; step?: number }) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  return (
    <input
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        const n = Number(draft);
        if (Number.isFinite(n)) onChange(n); else setDraft(String(value));
      }}
      onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
      inputMode="decimal"
      step={step}
      style={{
        width: "100%", boxSizing: "border-box",
        background: D.bg, color: D.tx,
        border: "1px solid " + D.border, borderRadius: 6,
        padding: "6px 9px",
        fontFamily: mn, fontSize: 11.5, outline: "none",
      }}
    />
  );
}

function RowPicker({ count, value, onChange, sheet, kind = "row", offset = 0 }: {
  count: number;
  value: number | undefined;
  onChange: (n: number | undefined) => void;
  sheet: TableSheet;
  kind?: "row" | "column";
  offset?: number;
}) {
  return (
    <select
      value={value == null ? "" : String(value)}
      onChange={(e) => {
        const v = e.target.value;
        if (v === "") onChange(undefined); else onChange(Number(v));
      }}
      style={{
        width: "100%", boxSizing: "border-box",
        background: D.bg, color: D.tx,
        border: "1px solid " + D.border, borderRadius: 6,
        padding: "5px 8px",
        fontFamily: mn, fontSize: 11, outline: "none", cursor: "pointer",
      }}
    >
      <option value="">— none —</option>
      {Array.from({ length: count }, (_, i) => {
        const labelKey = kind === "row"
          ? (sheet.rows[i]?.[sheet.schema[0]?.key] ?? "Row " + (i + 1))
          : (sheet.schema[i + offset]?.label ?? "Col " + (i + 1));
        return <option key={i} value={String(i)}>#{i + 1} · {String(labelKey)}</option>;
      })}
    </select>
  );
}

function KindToggle<A extends string, B extends string>({ value, onChange, a, b }: {
  value: A | B; onChange: (v: A | B) => void; a: A; b: B;
}) {
  return (
    <div style={{ display: "inline-flex", gap: 2, padding: 3, background: "rgba(255,255,255,0.03)", border: "1px solid " + D.border, borderRadius: 6 }}>
      {[a, b].map((opt) => {
        const on = opt === value;
        return (
          <button key={opt} onClick={() => onChange(opt)}
            style={{
              flex: 1,
              padding: "4px 10px",
              background: on ? D.amber + "22" : "transparent",
              border: "none", color: on ? D.amber : D.txm,
              fontFamily: mn, fontSize: 10, fontWeight: 800, letterSpacing: 0.5,
              borderRadius: 4, cursor: "pointer", textTransform: "uppercase",
            }}>{opt}</button>
        );
      })}
    </div>
  );
}

// ─── Collapsible (data grid drawer) ────────────────────────────────────

function Collapsible({ label, open, onToggle, children }: {
  label: string; open: boolean; onToggle: () => void; children: React.ReactNode;
}) {
  return (
    <div style={{
      marginTop: 14,
      background: D.card, border: "1px solid " + D.border, borderRadius: 12,
      overflow: "hidden",
    }}>
      <button onClick={onToggle}
        style={{
          width: "100%", display: "flex", alignItems: "center", gap: 8,
          padding: "10px 14px",
          background: "transparent", border: "none",
          color: D.amber, cursor: "pointer", textAlign: "left",
          fontFamily: mn, fontSize: 10.5, fontWeight: 800, letterSpacing: 1.2, textTransform: "uppercase",
          borderBottom: open ? "1px solid " + D.border : "none",
        }}>
        {open ? <ChevronDown size={12} strokeWidth={2.2} /> : <ChevronRight size={12} strokeWidth={2.2} />}
        {label}
      </button>
      {open && <div style={{ padding: 0 }}>{children}</div>}
    </div>
  );
}

// ─── Data grid (in-house lean editor) ──────────────────────────────────

function DataGrid({ sheet, onUpdateCell, onRenameColumn, onChangeColumnType, onAddColumn, onDeleteColumn, onAddRow, onDeleteRow }: {
  sheet: TableSheet;
  onUpdateCell: (rowIdx: number, key: string, value: string) => void;
  onRenameColumn: (key: string, label: string) => void;
  onChangeColumnType: (key: string, t: TableColumnType) => void;
  onAddColumn: () => void;
  onDeleteColumn: (key: string) => void;
  onAddRow: () => void;
  onDeleteRow: (rowIdx: number) => void;
}) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ borderCollapse: "separate", borderSpacing: 0, width: "100%", minWidth: 600 }}>
        <thead>
          <tr style={{ background: D.surface }}>
            <th style={{ width: 36, padding: "8px 6px", borderBottom: "1px solid " + D.border, position: "sticky", left: 0, background: D.surface, zIndex: 2 }}></th>
            {sheet.schema.map((col) => (
              <ColumnHeaderCell
                key={col.key}
                col={col}
                canDelete={sheet.schema.length > 1}
                onRename={(label) => onRenameColumn(col.key, label)}
                onChangeType={(t) => onChangeColumnType(col.key, t)}
                onDelete={() => onDeleteColumn(col.key)}
              />
            ))}
            <th style={{ width: 40, padding: "6px", borderBottom: "1px solid " + D.border, background: D.surface }}>
              <button onClick={onAddColumn}
                title="Add column"
                style={{
                  background: "transparent", border: "1px dashed " + D.border,
                  color: D.txm, padding: "3px 7px",
                  borderRadius: 4, cursor: "pointer",
                  fontFamily: mn, fontSize: 11, fontWeight: 700,
                }}>+</button>
            </th>
          </tr>
        </thead>
        <tbody>
          {sheet.rows.map((row, ri) => (
            <tr key={ri}>
              <td style={{
                width: 36, padding: "6px 4px",
                fontFamily: mn, fontSize: 10, color: D.txd,
                textAlign: "center", borderBottom: "1px solid " + D.border,
                position: "sticky", left: 0, background: D.card, zIndex: 1,
              }}>
                <button onClick={() => onDeleteRow(ri)} title="Delete row"
                  style={{
                    background: "transparent", border: "none",
                    color: D.txd, cursor: "pointer", fontFamily: mn, fontSize: 11, padding: 0,
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = D.coral; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = D.txd; }}
                >×</button>
                <div style={{ fontSize: 9, color: D.txd, lineHeight: 1, marginTop: 2 }}>{ri + 1}</div>
              </td>
              {sheet.schema.map((col) => (
                <Cell key={col.key}
                  value={row[col.key]}
                  type={col.type}
                  onCommit={(v) => onUpdateCell(ri, col.key, v)}
                />
              ))}
              <td style={{ borderBottom: "1px solid " + D.border }}></td>
            </tr>
          ))}
          <tr>
            <td colSpan={sheet.schema.length + 2} style={{ padding: 0 }}>
              <button onClick={onAddRow}
                style={{
                  width: "100%", padding: "10px 12px",
                  background: "transparent", border: "none",
                  color: D.txd, fontFamily: mn, fontSize: 10.5, letterSpacing: 1,
                  textTransform: "uppercase", fontWeight: 700, cursor: "pointer",
                  display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
                }}
                onMouseEnter={(e) => { e.currentTarget.style.color = D.amber; e.currentTarget.style.background = "rgba(247,176,65,0.04)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = D.txd; e.currentTarget.style.background = "transparent"; }}
              ><Plus size={11} strokeWidth={2.4} /> add row</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function ColumnHeaderCell({ col, canDelete, onRename, onChangeType, onDelete }: {
  col: { key: string; label: string; type: TableColumnType };
  canDelete: boolean;
  onRename: (label: string) => void;
  onChangeType: (t: TableColumnType) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(col.label);
  useEffect(() => setDraft(col.label), [col.label]);
  const [typeOpen, setTypeOpen] = useState(false);
  useEffect(() => {
    if (!typeOpen) return;
    const close = () => setTypeOpen(false);
    setTimeout(() => document.addEventListener("click", close), 0);
    return () => document.removeEventListener("click", close);
  }, [typeOpen]);
  return (
    <th style={{
      padding: "6px 8px",
      borderBottom: "1px solid " + D.border,
      borderLeft: "1px solid " + D.border,
      textAlign: "left", minWidth: 120, background: D.surface,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        {editing ? (
          <input value={draft} autoFocus
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => { onRename(draft.trim() || col.label); setEditing(false); }}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              if (e.key === "Escape") { setDraft(col.label); setEditing(false); }
            }}
            style={{
              flex: 1, minWidth: 0,
              background: D.bg, color: D.tx,
              border: "1px solid " + D.amber + "55", borderRadius: 4,
              fontFamily: ft, fontSize: 12, fontWeight: 700,
              padding: "3px 6px", outline: "none",
            }} />
        ) : (
          <button onClick={() => setEditing(true)}
            style={{
              all: "unset", flex: 1, minWidth: 0, cursor: "pointer",
              fontFamily: ft, fontSize: 12, fontWeight: 700, color: D.tx,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              padding: "3px 0",
            }}>{col.label}</button>
        )}
        <div style={{ position: "relative" }} onClick={(e) => e.stopPropagation()}>
          <button onClick={() => setTypeOpen(v => !v)}
            style={{
              padding: "2px 6px",
              background: "transparent", border: "1px solid " + D.border,
              color: D.txm, fontFamily: mn, fontSize: 8.5, fontWeight: 700, letterSpacing: 0.4,
              textTransform: "uppercase", borderRadius: 4, cursor: "pointer",
              display: "inline-flex", alignItems: "center", gap: 3,
            }}>{col.type}<ChevronDown size={8} strokeWidth={2.4} /></button>
          {typeOpen && (
            <div style={{
              position: "absolute", top: "calc(100% + 4px)", right: 0,
              background: D.card, border: "1px solid " + D.border, borderRadius: 6,
              padding: 3, minWidth: 90, zIndex: 50,
              boxShadow: "0 16px 32px rgba(0,0,0,0.55)",
            }}>
              {(["text", "number", "percent", "date"] as TableColumnType[]).map((t) => (
                <button key={t}
                  onClick={() => { onChangeType(t); setTypeOpen(false); }}
                  style={{
                    width: "100%", textAlign: "left",
                    padding: "5px 8px",
                    background: col.type === t ? D.amber + "22" : "transparent",
                    border: "none", borderRadius: 4,
                    color: col.type === t ? D.amber : D.tx,
                    fontFamily: mn, fontSize: 10, fontWeight: 700, letterSpacing: 0.4,
                    cursor: "pointer", textTransform: "uppercase",
                  }}>{t}</button>
              ))}
            </div>
          )}
        </div>
        {canDelete && (
          <button onClick={onDelete} title="Delete column"
            style={{
              background: "transparent", border: "none",
              color: D.txd, padding: "0 2px", cursor: "pointer", lineHeight: 1,
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = D.coral; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = D.txd; }}
          ><X size={11} strokeWidth={2.4} /></button>
        )}
      </div>
    </th>
  );
}

function Cell({ value, type, onCommit }: {
  value: TableCellValue;
  type: TableColumnType;
  onCommit: (v: string) => void;
}) {
  const display = value == null ? "" : String(value);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(display);
  useEffect(() => { if (!editing) setDraft(display); }, [display, editing]);
  const numeric = type === "number" || type === "percent";
  return (
    <td
      onDoubleClick={() => setEditing(true)}
      style={{
        padding: 0,
        borderBottom: "1px solid " + D.border,
        borderLeft: "1px solid " + D.border,
        background: editing ? "rgba(247,176,65,0.06)" : "transparent",
      }}>
      {editing ? (
        <input value={draft} autoFocus
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => { onCommit(draft); setEditing(false); }}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            if (e.key === "Escape") { setDraft(display); setEditing(false); }
          }}
          style={{
            width: "100%", boxSizing: "border-box",
            background: D.bg, color: D.tx, border: "none", outline: "none",
            fontFamily: numeric ? mn : ft, fontSize: 12.5,
            padding: "6px 9px", textAlign: numeric ? "right" : "left",
          }} />
      ) : (
        <button onClick={() => setEditing(true)}
          style={{
            all: "unset", display: "block", width: "100%",
            padding: "6px 9px", cursor: "text",
            fontFamily: numeric ? mn : ft, fontSize: 12.5,
            color: value == null ? D.txd : D.tx,
            textAlign: numeric ? "right" : "left",
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
            boxSizing: "border-box",
          }}>{display || (numeric ? "0" : "—")}{type === "percent" && value != null ? "%" : ""}</button>
      )}
    </td>
  );
}
