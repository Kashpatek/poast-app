"use client";

// TableEditor v3 — single-state model with undo/redo, per-column number
// formatting (default / int / dec1 / dec2 / pct / USD K/M/B / K/M/B
// suffix + freeform prefix/suffix), smart clipboard paste that expands
// TSV/CSV into the grid starting from the focused cell, aggregate
// footer row (sum / avg / min / max), and export aspect presets that
// crop or letterbox the rendered SVG for slides / square / story.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronDown, ChevronRight, Copy, Download, FileImage, FileText,
  GripHorizontal, Image as ImageIcon, Maximize2, Minus,
  PanelRightClose, PanelRightOpen,
  Plus, RotateCcw, RotateCw, Sparkles, Upload, Wand2, X,
} from "lucide-react";
import { showToast } from "../toast-context";
import {
  AggregateKind, blankRow, coerce, newColumnKey,
  parseClipboardTable, templateSheet, toCsv, toMarkdown,
} from "./lib/data-sheet";
import { EDITABLE_REGIONS, EditableField } from "./lib/sa-table-regions";
import SaTableSvg, { SA_TABLE_HEIGHT, SA_TABLE_WIDTH } from "./lib/sa-table-svg";
import { D, ft, gf, mn } from "./studio-theme";
import {
  StudioDoc, TableCellValue, TableColumnSpec, TableColumnType,
  TableDocPayload, TableMode, TableNumberFormat, TableInputItem, TableSheet,
} from "./studio-types";

type ExportPreset = NonNullable<TableDocPayload["exportPreset"]>;
type PanelKind = "inputs" | "caveats";

interface TableEditorState {
  sheet: TableSheet;
  mode: TableMode;
  category: string;
  titleWhite: string;
  titleAmber: string;
  subtitle: string;
  titleBar: string;
  highlightRowIdx?: number;
  highlightFlagCol?: number;
  keyInsight: string;
  threshold: number;
  yellowBand: number;
  topAxisLabel: string;
  leftAxisLabel: string;
  baselineRow?: number;
  baselineCol?: number;
  panelKind: PanelKind;
  panelItems: TableInputItem[];
  formula: string;
  formulaBaseline: string;
  formulaResult: string;
  aggregate: "none" | AggregateKind;
  aggregateLabel: string;
  exportPreset: ExportPreset;
}

interface TableEditorProps {
  doc: StudioDoc;
  onChangePayload: (payload: unknown) => void;
  onBuildChart?: (sheet: TableSheet, name: string) => void;
}

export default function TableEditor({ doc, onChangePayload, onBuildChart }: TableEditorProps) {
  const initial = useMemo(() => readPayload(doc.payload, doc.name), [doc.payload, doc.name]);
  const [state, setState] = useState<TableEditorState>(initial);
  const [history, setHistory] = useState<TableEditorState[]>([]);
  const [future, setFuture] = useState<TableEditorState[]>([]);
  // settledRef coalesces burst edits (one keystroke per char) into a
  // single undo step. We only push history on the first mutation of a
  // ~600 ms quiet window.
  const settledRef = useRef(true);
  const settledTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [gridOpen, setGridOpen] = useState(true);
  const [parseOpen, setParseOpen] = useState(false);
  const [editingField, setEditingField] = useState<EditableField | null>(null);
  const previewRef = useRef<HTMLDivElement | null>(null);
  const csvFileRef = useRef<HTMLInputElement | null>(null);

  // ── Canva-style UI chrome ───────────────────────────────────────────
  // rightOpen, zoom, fitMode are NOT persisted in the doc payload —
  // they're per-session UI prefs mirrored to localStorage so layout
  // sticks across reloads without bloating saved docs.
  const [rightOpen, setRightOpen] = useState<boolean>(() => readStored("studio.table.rightOpen", true));
  const [zoom, setZoom] = useState<number>(() => readStored("studio.table.zoom", 1));
  const [fitMode, setFitMode] = useState<"locked" | "fit-content">(() => readStored("studio.table.fitMode", "locked"));
  useEffect(() => { writeStored("studio.table.rightOpen", rightOpen); }, [rightOpen]);
  useEffect(() => { writeStored("studio.table.zoom", zoom); }, [zoom]);
  useEffect(() => { writeStored("studio.table.fitMode", fitMode); }, [fitMode]);

  // ── Single mutation entry-point ──────────────────────────────────────
  const update = useCallback((patch: Partial<TableEditorState>) => {
    if (settledRef.current) {
      // Capture the *pre-mutation* state so undo lands on what the user
      // saw before they started this burst of edits.
      setHistory(h => [...h.slice(-49), state]);
      setFuture([]);
      settledRef.current = false;
      if (settledTimerRef.current) clearTimeout(settledTimerRef.current);
      settledTimerRef.current = setTimeout(() => { settledRef.current = true; }, 600);
    }
    setState(s => ({ ...s, ...patch }));
  }, [state]);

  // Convenience setter that takes the existing state's sheet and applies
  // a transformer. Common path for grid mutations.
  const updateSheet = useCallback((fn: (s: TableSheet) => TableSheet) => {
    update({ sheet: fn(state.sheet) });
  }, [update, state.sheet]);

  // ── Undo / redo ─────────────────────────────────────────────────────
  const undo = useCallback(() => {
    setHistory((h) => {
      if (h.length === 0) return h;
      const prev = h[h.length - 1];
      setFuture((f) => [state, ...f.slice(0, 49)]);
      setState(prev);
      return h.slice(0, -1);
    });
    settledRef.current = true;
  }, [state]);

  const redo = useCallback(() => {
    setFuture((f) => {
      if (f.length === 0) return f;
      const next = f[0];
      setHistory((h) => [...h.slice(-49), state]);
      setState(next);
      return f.slice(1);
    });
    settledRef.current = true;
  }, [state]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tgt = e.target as HTMLElement | null;
      const typing = tgt && (tgt.tagName === "INPUT" || tgt.tagName === "TEXTAREA" || tgt.isContentEditable);
      if (typing) return;
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo(); else undo();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo]);

  // ── Emit payload upstream ───────────────────────────────────────────
  useEffect(() => {
    const payload: TableDocPayload = {
      kind: "table", version: 1,
      engine: "standard",
      sheet: state.sheet,
      mode: state.mode,
      category: state.category,
      titleWhite: state.titleWhite,
      titleAmber: state.titleAmber,
      subtitle: state.subtitle,
      titleBar: state.titleBar,
      highlightRowIdx: state.highlightRowIdx,
      highlightFlagCol: state.highlightFlagCol,
      keyInsight: state.keyInsight,
      threshold: state.threshold,
      yellowBand: state.yellowBand,
      topAxisLabel: state.topAxisLabel,
      leftAxisLabel: state.leftAxisLabel,
      baselineRow: state.baselineRow,
      baselineCol: state.baselineCol,
      panelKind: state.panelKind,
      panelItems: state.panelItems,
      formula: state.formula,
      formulaBaseline: state.formulaBaseline,
      formulaResult: state.formulaResult,
      aggregate: state.aggregate === "none" ? undefined : state.aggregate,
      aggregateLabel: state.aggregateLabel || undefined,
      exportPreset: state.exportPreset,
    };
    onChangePayload(payload);
  }, [state, onChangePayload]);

  // ── Grid mutations ──────────────────────────────────────────────────
  const updateCell = useCallback((rowIdx: number, key: string, value: string) => {
    updateSheet((cur) => {
      const col = cur.schema.find(c => c.key === key);
      if (!col) return cur;
      const next = cur.rows.slice();
      next[rowIdx] = { ...next[rowIdx], [key]: coerce(value, col.type) };
      return { ...cur, rows: next };
    });
  }, [updateSheet]);

  const renameColumn = useCallback((key: string, label: string) => {
    updateSheet((cur) => ({ ...cur, schema: cur.schema.map(c => c.key === key ? { ...c, label } : c) }));
  }, [updateSheet]);

  const setColumnType = useCallback((key: string, type: TableColumnType) => {
    updateSheet((cur) => ({
      ...cur,
      schema: cur.schema.map(c => c.key === key ? { ...c, type } : c),
      rows: cur.rows.map(r => ({
        ...r,
        [key]: type === "text" ? (r[key] == null ? "" : String(r[key])) : coerce(String(r[key] ?? ""), type),
      })),
    }));
  }, [updateSheet]);

  const setColumnNumFmt = useCallback((key: string, fmt: TableNumberFormat | undefined) => {
    updateSheet((cur) => ({
      ...cur,
      schema: cur.schema.map(c => c.key === key ? { ...c, numFmt: fmt } : c),
    }));
  }, [updateSheet]);

  const setColumnPrefix = useCallback((key: string, prefix: string) => {
    updateSheet((cur) => ({
      ...cur,
      schema: cur.schema.map(c => c.key === key ? { ...c, prefix: prefix || undefined } : c),
    }));
  }, [updateSheet]);

  const setColumnSuffix = useCallback((key: string, suffix: string) => {
    updateSheet((cur) => ({
      ...cur,
      schema: cur.schema.map(c => c.key === key ? { ...c, suffix: suffix || undefined } : c),
    }));
  }, [updateSheet]);

  const sortByColumn = useCallback((key: string, dir: "asc" | "desc") => {
    updateSheet((cur) => {
      const rows = cur.rows.slice().sort((a, b) => {
        const av = a[key], bv = b[key];
        const ax = av == null ? "" : av;
        const bx = bv == null ? "" : bv;
        if (typeof ax === "number" && typeof bx === "number") {
          return dir === "asc" ? ax - bx : bx - ax;
        }
        const as = String(ax);
        const bs = String(bx);
        // Try numeric compare for stringified numbers (e.g. "12" vs "5").
        const an = Number(as.replace(/,/g, ""));
        const bn = Number(bs.replace(/,/g, ""));
        if (Number.isFinite(an) && Number.isFinite(bn)) {
          return dir === "asc" ? an - bn : bn - an;
        }
        return dir === "asc" ? as.localeCompare(bs) : bs.localeCompare(as);
      });
      return { ...cur, rows };
    });
  }, [updateSheet]);

  const moveColumn = useCallback((fromKey: string, toIdx: number) => {
    updateSheet((cur) => {
      const fromIdx = cur.schema.findIndex(c => c.key === fromKey);
      if (fromIdx < 0 || fromIdx === toIdx) return cur;
      const next = cur.schema.slice();
      const [moved] = next.splice(fromIdx, 1);
      next.splice(toIdx > fromIdx ? toIdx - 1 : toIdx, 0, moved);
      return { ...cur, schema: next };
    });
  }, [updateSheet]);

  const addColumn = useCallback(() => {
    updateSheet((cur) => {
      const k = newColumnKey(cur.schema);
      return {
        schema: [...cur.schema, { key: k, label: "Column", type: "number" as const }],
        rows: cur.rows.map(r => ({ ...r, [k]: 0 })),
      };
    });
  }, [updateSheet]);

  const deleteColumn = useCallback((key: string) => {
    updateSheet((cur) => {
      if (cur.schema.length <= 1) return cur;
      return {
        schema: cur.schema.filter(c => c.key !== key),
        rows: cur.rows.map(r => { const n = { ...r }; delete n[key]; return n; }),
      };
    });
  }, [updateSheet]);

  const addRow = useCallback(() => {
    updateSheet((cur) => ({ ...cur, rows: [...cur.rows, blankRow(cur.schema)] }));
  }, [updateSheet]);

  const deleteRow = useCallback((rowIdx: number) => {
    updateSheet((cur) => ({ ...cur, rows: cur.rows.filter((_, i) => i !== rowIdx) }));
  }, [updateSheet]);

  // Smart paste · when the user pastes into a cell, parse the clipboard
  // as TSV/CSV and expand starting at the focused cell. Extra columns
  // beyond the schema spawn new columns; extra rows append new rows.
  const handleSmartPaste = useCallback((rowIdx: number, colIdx: number, raw: string) => {
    const grid = parseClipboardTable(raw);
    if (grid.length === 0) return;
    if (grid.length === 1 && grid[0].length === 1) {
      // Single value — just commit it like a normal edit.
      const col = state.sheet.schema[colIdx];
      if (col) updateCell(rowIdx, col.key, grid[0][0]);
      return;
    }
    updateSheet((cur) => {
      const schema = cur.schema.slice();
      const rows = cur.rows.map(r => ({ ...r }));
      const cols = grid[0].length;
      // Make sure we have enough columns starting at colIdx.
      while (schema.length < colIdx + cols) {
        const k = newColumnKey(schema);
        schema.push({ key: k, label: "Column", type: "number" });
        rows.forEach(r => { r[k] = 0; });
      }
      // Make sure we have enough rows starting at rowIdx.
      while (rows.length < rowIdx + grid.length) {
        rows.push(blankRow(schema));
      }
      // Drop values in. If the column happens to be text, store the raw
      // value; otherwise coerce per the destination column's type.
      grid.forEach((line, dr) => {
        line.forEach((cell, dc) => {
          const targetCol = schema[colIdx + dc];
          if (!targetCol) return;
          rows[rowIdx + dr] = {
            ...rows[rowIdx + dr],
            [targetCol.key]: coerce(cell, targetCol.type),
          };
        });
      });
      return { schema, rows };
    });
    showToast(`Pasted ${grid.length}×${grid[0].length}`);
  }, [state.sheet.schema, updateCell, updateSheet]);

  // Import a CSV/TSV file. First row is treated as headers; remaining
  // rows become data. Column types are auto-detected: numeric if EVERY
  // non-empty cell parses as a number, text otherwise.
  const handleCsvFile = useCallback(async (file: File) => {
    try {
      const text = await file.text();
      const grid = parseClipboardTable(text);
      if (grid.length === 0) { showToast("Empty file"); return; }
      const headers = grid[0];
      const body = grid.slice(1);
      const schema: TableColumnSpec[] = headers.map((h, i) => {
        const colVals = body.map(r => r[i] ?? "").filter(v => v.trim() !== "");
        const isNumeric = colVals.length > 0 && colVals.every(v => Number.isFinite(Number(v.replace(/[$,%\s]/g, ""))));
        return { key: "c" + (i + 1), label: h || ("Column " + (i + 1)), type: isNumeric ? "number" : "text" };
      });
      const rows = body.map(line => {
        const row: Record<string, TableCellValue> = {};
        schema.forEach((c, i) => {
          row[c.key] = coerce(line[i] ?? "", c.type);
        });
        return row;
      });
      update({ sheet: { schema, rows } });
      showToast(`Imported ${rows.length}×${schema.length}`);
    } catch (e) {
      showToast("Import failed");
      void e;
    }
  }, [update]);

  // ── Exports ─────────────────────────────────────────────────────────
  const exportSize = exportPresetDimensions(state.exportPreset);

  const downloadSvg = useCallback(() => {
    const svg = previewRef.current?.querySelector("svg");
    if (!svg) { showToast("Preview not ready"); return; }
    const xml = new XMLSerializer().serializeToString(svg);
    const blob = new Blob(['<?xml version="1.0" encoding="UTF-8"?>\n', xml], { type: "image/svg+xml" });
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
      const targetW = exportSize.width;
      const targetH = exportSize.height;
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(targetW * scale);
      canvas.height = Math.round(targetH * scale);
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("no canvas context");
      // Paint SA dark base first so transparent corners + JPEG export
      // both land on the right color.
      ctx.fillStyle = "#0A0C10";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      // Cover-fit the 1394×861 SVG into the target canvas. This crops
      // the longer dimension when going to square / tall presets, and
      // letterboxes only if the SVG aspect is taller than the target.
      const svgAR = SA_TABLE_WIDTH / SA_TABLE_HEIGHT;
      const targetAR = targetW / targetH;
      let drawW = canvas.width, drawH = canvas.height, dx = 0, dy = 0;
      if (svgAR > targetAR) {
        // SVG is wider — fit by height, crop horizontally.
        drawH = canvas.height;
        drawW = drawH * svgAR;
        dx = (canvas.width - drawW) / 2;
      } else {
        drawW = canvas.width;
        drawH = drawW / svgAR;
        dy = (canvas.height - drawH) / 2;
      }
      ctx.drawImage(img, dx, dy, drawW, drawH);
      URL.revokeObjectURL(url);
      const dataUrl = canvas.toDataURL(format === "jpeg" ? "image/jpeg" : "image/png", 0.94);
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = (doc.name || "table") + "." + format;
      a.click();
      showToast(format.toUpperCase() + " · " + exportSize.label + " downloaded");
    } catch (e) {
      showToast("Rasterize failed — try SVG");
      void e;
    }
  }, [doc.name, exportSize]);

  const exportCsv = useCallback(() => {
    const text = toCsv(state.sheet);
    const blob = new Blob([text], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = (doc.name || "table") + ".csv";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    showToast("CSV downloaded");
  }, [state.sheet, doc.name]);

  const copyMarkdown = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(toMarkdown(state.sheet));
      showToast("Markdown copied");
    } catch { showToast("Copy failed"); }
  }, [state.sheet]);

  // ── Render ──────────────────────────────────────────────────────────
  return (
    <div style={{
      display: "flex",
      gap: 0,
      padding: "12px 22px 64px",
      maxWidth: 1680,
      margin: "0 auto",
      position: "relative",
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap",
          padding: "8px 12px",
          background: D.card, border: "1px solid " + D.border, borderRadius: 11,
        }}>
          <ModeToggle value={state.mode} onChange={(m) => update({ mode: m })} />
          <span style={{ width: 1, height: 18, background: D.border, margin: "0 4px" }} />
          <ToolbarBtn Icon={RotateCcw} label="" hint="⌘Z"  onClick={undo} disabled={history.length === 0} />
          <ToolbarBtn Icon={RotateCw}  label="" hint="⌘⇧Z" onClick={redo} disabled={future.length === 0} />
          <span style={{ width: 1, height: 18, background: D.border, margin: "0 4px" }} />
          <ToolbarBtn Icon={Upload} label="Import CSV" accent={D.teal}
            onClick={() => csvFileRef.current?.click()} />
          <input
            ref={csvFileRef}
            type="file"
            accept=".csv,.tsv,.txt,text/csv,text/tab-separated-values"
            style={{ display: "none" }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleCsvFile(f);
              e.currentTarget.value = "";
            }}
          />
          <span style={{ width: 1, height: 18, background: D.border, margin: "0 4px" }} />
          <ToolbarBtn Icon={Download}   label="SVG"  accent={D.amber}  onClick={downloadSvg} />
          <ToolbarBtn Icon={ImageIcon}  label="PNG"  accent={D.teal}   onClick={() => rasterize("png")} />
          <ToolbarBtn Icon={FileImage}  label="JPEG" accent={D.coral}  onClick={() => rasterize("jpeg")} />
          <ExportPresetPicker value={state.exportPreset} onChange={(p) => update({ exportPreset: p })} />
          <span style={{ width: 1, height: 18, background: D.border, margin: "0 4px" }} />
          <ToolbarBtn Icon={FileText} label="CSV"      onClick={exportCsv} />
          <ToolbarBtn Icon={Copy}     label="Markdown" onClick={copyMarkdown} />
          <span style={{ width: 1, height: 18, background: D.border, margin: "0 4px" }} />
          <ToolbarBtn Icon={Wand2} label="AI parse" accent={D.violet} onClick={() => setParseOpen(true)} />
          {onBuildChart && (
            <>
              <span style={{ marginLeft: "auto" }} />
              <ToolbarBtn Icon={Sparkles} label="Build chart" accent={D.amber}
                onClick={() => onBuildChart(state.sheet, state.titleWhite || doc.name)} />
            </>
          )}
          <span style={{ marginLeft: onBuildChart ? 6 : "auto" }} />
          <ToolbarBtn
            Icon={rightOpen ? PanelRightClose : PanelRightOpen}
            label=""
            hint={rightOpen ? "Hide panel" : "Show panel"}
            onClick={() => setRightOpen(v => !v)}
          />
        </div>

        <div style={{ marginTop: 14, position: "relative" }}>
          <div
            style={{
              transform: "scale(" + zoom + ")",
              transformOrigin: "top center",
              transition: "transform 0.12s ease-out",
              width: "100%",
            }}
          >
            <div
              ref={previewRef}
              style={{
                background: "#06060A",
                border: "1px solid " + D.border, borderRadius: 14,
                overflow: "hidden",
                boxShadow: "0 18px 44px rgba(0,0,0,0.5)",
                aspectRatio: fitMode === "locked" ? SA_TABLE_WIDTH + " / " + SA_TABLE_HEIGHT : undefined,
                width: "100%",
                position: "relative",
              }}
            >
          <SaTableSvg
            mode={state.mode}
            sheet={state.sheet}
            category={state.category}
            titleWhite={state.titleWhite}
            titleAmber={state.titleAmber}
            subtitle={state.subtitle}
            titleBar={state.titleBar}
            highlightRowIdx={state.highlightRowIdx}
            highlightFlagCol={state.highlightFlagCol}
            keyInsight={state.keyInsight}
            threshold={state.threshold}
            yellowBand={state.yellowBand}
            topAxisLabel={state.topAxisLabel}
            leftAxisLabel={state.leftAxisLabel}
            baselineRow={state.baselineRow}
            baselineCol={state.baselineCol}
            panelKind={state.panelKind}
            panelItems={state.panelItems}
            formula={state.formula}
            formulaBaseline={state.formulaBaseline}
            formulaResult={state.formulaResult}
            aggregate={state.aggregate === "none" ? undefined : state.aggregate}
            aggregateLabel={state.aggregateLabel}
            onEditField={setEditingField}
            editingField={editingField}
          />
          {editingField && previewRef.current && (
            <InlineEditOverlay
              field={editingField}
              previewEl={previewRef.current}
              value={editorValueFor(editingField, state)}
              onCommit={(v) => {
                update(editorPatchFor(editingField, v));
                setEditingField(null);
              }}
              onCancel={() => setEditingField(null)}
            />
          )}
            </div>
          </div>

          <TableZoomBar
            zoom={zoom}
            onZoom={setZoom}
            fitMode={fitMode}
            onFitMode={setFitMode}
          />
        </div>

        <Collapsible label="Data" open={gridOpen} onToggle={() => setGridOpen(v => !v)}>
          <DataGrid
            sheet={state.sheet}
            onUpdateCell={updateCell}
            onSmartPaste={handleSmartPaste}
            onRenameColumn={renameColumn}
            onChangeColumnType={setColumnType}
            onChangeColumnNumFmt={setColumnNumFmt}
            onChangeColumnPrefix={setColumnPrefix}
            onChangeColumnSuffix={setColumnSuffix}
            onSortByColumn={sortByColumn}
            onMoveColumn={moveColumn}
            onAddColumn={addColumn}
            onDeleteColumn={deleteColumn}
            onAddRow={addRow}
            onDeleteRow={deleteRow}
          />
        </Collapsible>
      </div>

      {rightOpen ? (
        <div style={{ width: 312, marginLeft: 14, flexShrink: 0 }}>
          <PropertiesRail state={state} update={update} />
        </div>
      ) : (
        <CollapsedRightStrip onClick={() => setRightOpen(true)} />
      )}

      {parseOpen && (
        <ParseModal
          onClose={() => setParseOpen(false)}
          onApply={(patch) => {
            update(patch);
            setParseOpen(false);
          }}
        />
      )}
    </div>
  );
}

// ─── Payload hydration ─────────────────────────────────────────────────

function readPayload(payload: unknown, defaultName: string): TableEditorState {
  const seed: TableEditorState = {
    sheet: templateSheet(undefined),
    mode: "data",
    category: "SEMIANALYSIS — RESEARCH",
    titleWhite: defaultName || "Untitled",
    titleAmber: "",
    subtitle: "Quarterly breakdown · 2026",
    titleBar: "DATA TABLE",
    highlightRowIdx: undefined,
    highlightFlagCol: undefined,
    keyInsight: "",
    threshold: 30,
    yellowBand: 0.5,
    topAxisLabel: "",
    leftAxisLabel: "",
    baselineRow: undefined,
    baselineCol: undefined,
    panelKind: "inputs",
    panelItems: [],
    formula: "",
    formulaBaseline: "",
    formulaResult: "",
    aggregate: "none",
    aggregateLabel: "",
    exportPreset: "default",
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
    if (p.aggregate === "sum" || p.aggregate === "avg" || p.aggregate === "min" || p.aggregate === "max") seed.aggregate = p.aggregate;
    else if (p.aggregate === "none") seed.aggregate = "none";
    if (p.aggregateLabel != null) seed.aggregateLabel = p.aggregateLabel;
    if (p.exportPreset === "wide16x9" || p.exportPreset === "square" || p.exportPreset === "tall4x5" || p.exportPreset === "story9x16") {
      seed.exportPreset = p.exportPreset;
    }
  }
  return seed;
}

// ─── UI chrome persistence ────────────────────────────────────────────
// localStorage wrappers for per-session prefs (panel open state, zoom,
// fit mode). SSR-guarded so they don't blow up during first render.
function readStored<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (raw == null) return fallback;
    return JSON.parse(raw) as T;
  } catch { return fallback; }
}
function writeStored<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(key, JSON.stringify(value)); } catch { /* full disk, etc. */ }
}

function clampZoom(z: number): number {
  return Math.max(0.25, Math.min(2, z));
}

// Floating zoom + fit bar at the bottom of the preview area. Mirrors
// the Canva pattern: dimension lock toggle on the left, slider + numeric
// readout on the right.
function TableZoomBar({
  zoom, onZoom, fitMode, onFitMode,
}: {
  zoom: number;
  onZoom: (z: number) => void;
  fitMode: "locked" | "fit-content";
  onFitMode: (m: "locked" | "fit-content") => void;
}) {
  return (
    <div style={{
      position: "sticky", bottom: 8,
      marginTop: 14,
      display: "flex", alignItems: "center", gap: 10,
      padding: "7px 12px",
      background: D.card, border: "1px solid " + D.border, borderRadius: 999,
      boxShadow: "0 8px 24px rgba(0,0,0,0.45)",
      zIndex: 5,
      width: "fit-content",
      marginLeft: "auto", marginRight: "auto",
    }}>
      <button
        onClick={() => onFitMode(fitMode === "locked" ? "fit-content" : "locked")}
        title={fitMode === "locked" ? "Locked to 1394×861 — click to fit content" : "Fitting content — click to lock dimensions"}
        style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          padding: "5px 10px",
          background: fitMode === "locked" ? D.amber + "22" : "transparent",
          color: fitMode === "locked" ? D.amber : D.txm,
          border: "1px solid " + (fitMode === "locked" ? D.amber + "55" : D.border),
          borderRadius: 999,
          fontFamily: mn, fontSize: 10, fontWeight: 700, letterSpacing: 0.6,
          textTransform: "uppercase", cursor: "pointer",
        }}
      >
        <Maximize2 size={11} strokeWidth={2.4} />
        {fitMode === "locked" ? "Locked" : "Fit"}
      </button>
      <span style={{ width: 1, height: 18, background: D.border }} />
      <IconBtn Icon={Minus} onClick={() => onZoom(clampZoom(zoom - 0.1))} disabled={zoom <= 0.25} title="Zoom out" />
      <input
        type="range"
        min={25} max={200} step={5}
        value={Math.round(zoom * 100)}
        onChange={(e) => onZoom(clampZoom(Number(e.target.value) / 100))}
        style={{ width: 180, accentColor: D.amber }}
      />
      <IconBtn Icon={Plus} onClick={() => onZoom(clampZoom(zoom + 0.1))} disabled={zoom >= 2} title="Zoom in" />
      <button
        onClick={() => onZoom(1)}
        title="Reset to 100%"
        style={{
          padding: "4px 9px",
          background: "transparent", color: D.tx,
          border: "1px solid " + D.border, borderRadius: 999,
          fontFamily: mn, fontSize: 10, fontWeight: 700, letterSpacing: 0.5,
          cursor: "pointer", minWidth: 50, textAlign: "center",
        }}
      >{Math.round(zoom * 100)}%</button>
    </div>
  );
}

function IconBtn({ Icon, onClick, disabled, title }: {
  Icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
  onClick: () => void; disabled?: boolean; title?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{
        width: 24, height: 24, padding: 0,
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        background: "transparent", color: disabled ? D.txd : D.tx,
        border: "1px solid " + D.border, borderRadius: 999,
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.4 : 1,
      }}
    ><Icon size={12} strokeWidth={2.4} /></button>
  );
}

// Thin clickable strip shown when the properties panel is hidden, so
// there's always an obvious way back. Hovering tints the chevron amber
// to match the Diagram editor's strip.
function CollapsedRightStrip({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      title="Show properties panel"
      style={{
        width: 22, marginLeft: 8, flexShrink: 0,
        background: D.card, border: "1px solid " + D.border, borderLeft: "none",
        borderRadius: "0 10px 10px 0",
        cursor: "pointer",
        display: "flex", alignItems: "center", justifyContent: "center",
        color: D.txm,
        transition: "color 0.12s",
      }}
      onMouseEnter={(e) => { e.currentTarget.style.color = D.amber; }}
      onMouseLeave={(e) => { e.currentTarget.style.color = D.txm; }}
    ><PanelRightOpen size={13} strokeWidth={2.2} /></button>
  );
}

function exportPresetDimensions(p: ExportPreset): { width: number; height: number; label: string } {
  if (p === "wide16x9") return { width: SA_TABLE_WIDTH, height: Math.round(SA_TABLE_WIDTH * 9 / 16), label: "16:9" };
  if (p === "square")   return { width: SA_TABLE_WIDTH, height: SA_TABLE_WIDTH, label: "Square" };
  if (p === "tall4x5")  return { width: SA_TABLE_WIDTH, height: Math.round(SA_TABLE_WIDTH * 5 / 4), label: "4:5" };
  if (p === "story9x16") return { width: SA_TABLE_WIDTH, height: Math.round(SA_TABLE_WIDTH * 16 / 9), label: "9:16" };
  return { width: SA_TABLE_WIDTH, height: SA_TABLE_HEIGHT, label: "Default" };
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

function ToolbarBtn({ Icon, label, onClick, accent, disabled, hint }: {
  Icon: React.ComponentType<{ size?: number; strokeWidth?: number; color?: string }>;
  label: string;
  onClick: () => void;
  accent?: string;
  disabled?: boolean;
  hint?: string;
}) {
  const c = accent || D.txm;
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={hint ? (label ? `${label} (${hint})` : hint) : label}
      style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        padding: label ? "5px 11px" : "5px 8px",
        background: accent ? c + "1A" : "transparent",
        border: "1px solid " + (accent ? c + "55" : D.border),
        color: disabled ? D.txd : (accent ? c : D.txm),
        fontFamily: mn, fontSize: 10.5, fontWeight: 700, letterSpacing: 0.5,
        borderRadius: 6, cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.45 : 1,
        transition: "background 0.12s, color 0.12s",
      }}
      onMouseEnter={(e) => {
        if (disabled) return;
        e.currentTarget.style.color = accent ? c : D.tx;
        if (!accent) e.currentTarget.style.background = "rgba(255,255,255,0.04)";
      }}
      onMouseLeave={(e) => {
        if (disabled) return;
        e.currentTarget.style.color = accent ? c : D.txm;
        if (!accent) e.currentTarget.style.background = "transparent";
      }}
    ><Icon size={12} strokeWidth={2.2} color={disabled ? D.txd : (accent || D.txm)} /> {label}</button>
  );
}

function ExportPresetPicker({ value, onChange }: { value: ExportPreset; onChange: (p: ExportPreset) => void }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    setTimeout(() => document.addEventListener("click", close), 0);
    return () => document.removeEventListener("click", close);
  }, [open]);
  const opts: { id: ExportPreset; label: string; sub: string }[] = [
    { id: "default",   label: "Default",  sub: "1394 × 861 · the SA spec canvas" },
    { id: "wide16x9",  label: "16:9",     sub: "Slide deck / talk cover" },
    { id: "square",    label: "1:1",      sub: "Instagram / LinkedIn feed" },
    { id: "tall4x5",   label: "4:5",      sub: "IG portrait · best feed crop" },
    { id: "story9x16", label: "9:16",     sub: "Story / vertical video frame" },
  ];
  const active = opts.find(o => o.id === value) || opts[0];
  return (
    <div style={{ position: "relative" }} onClick={(e) => e.stopPropagation()}>
      <button onClick={() => setOpen(v => !v)}
        title="Export aspect — raster previews resize to this on PNG/JPEG"
        style={{
          display: "inline-flex", alignItems: "center", gap: 4,
          padding: "5px 9px",
          background: "transparent", border: "1px solid " + D.border,
          color: D.txm, fontFamily: mn, fontSize: 10.5, fontWeight: 700, letterSpacing: 0.5,
          borderRadius: 6, cursor: "pointer",
        }}>
        ◫ {active.label} <ChevronDown size={10} strokeWidth={2.2} />
      </button>
      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 6px)", left: 0,
          background: D.card, border: "1px solid " + D.border, borderRadius: 8,
          padding: 4, minWidth: 200, zIndex: 50,
          boxShadow: "0 16px 32px rgba(0,0,0,0.55)",
        }}>
          {opts.map((o) => (
            <button key={o.id}
              onClick={() => { onChange(o.id); setOpen(false); }}
              style={{
                display: "block", width: "100%", textAlign: "left",
                padding: "7px 10px",
                background: o.id === value ? D.amber + "22" : "transparent",
                border: "none", borderRadius: 5,
                color: o.id === value ? D.amber : D.tx,
                cursor: "pointer",
              }}>
              <div style={{ fontFamily: ft, fontSize: 12.5, fontWeight: 700 }}>{o.label}</div>
              <div style={{ fontFamily: mn, fontSize: 9.5, color: D.txd, letterSpacing: 0.4, marginTop: 1 }}>{o.sub}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Properties rail ───────────────────────────────────────────────────

function PropertiesRail({ state, update }: { state: TableEditorState; update: (p: Partial<TableEditorState>) => void }) {
  const [headerOpen, setHeaderOpen] = useState(true);
  const [dataModeOpen, setDataModeOpen] = useState(true);
  const [heatmapOpen, setHeatmapOpen] = useState(true);
  const [panelOpen, setPanelOpen] = useState(false);
  const [formulaOpen, setFormulaOpen] = useState(false);
  const [aggOpen, setAggOpen] = useState(false);
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
          <TextInput value={state.category} onChange={(v) => update({ category: v })} placeholder="SEMIANALYSIS — RESEARCH" />
        </Field>
        <Field label="Title (white)">
          <TextInput value={state.titleWhite} onChange={(v) => update({ titleWhite: v })} placeholder="Primary title" />
        </Field>
        <Field label="Title (amber accent)">
          <TextInput value={state.titleAmber} onChange={(v) => update({ titleAmber: v })} placeholder="appended in amber" />
        </Field>
        <Field label="Subtitle">
          <TextInput value={state.subtitle} onChange={(v) => update({ subtitle: v })} placeholder="Quarter · year · inputs" />
        </Field>
      </PanelSection>
      {state.mode === "data" && (
        <PanelSection label="Data table" open={dataModeOpen} onToggle={() => setDataModeOpen(v => !v)}>
          <Field label="Table title bar">
            <TextInput value={state.titleBar} onChange={(v) => update({ titleBar: v })} placeholder="TABLE TITLE" />
          </Field>
          <Field label="Highlight row">
            <RowPicker
              count={state.sheet.rows.length}
              value={state.highlightRowIdx}
              onChange={(v) => update({ highlightRowIdx: v })}
              sheet={state.sheet}
            />
          </Field>
          {state.highlightRowIdx != null && (
            <Field label="Flag cell (column)">
              <RowPicker
                count={Math.max(0, state.sheet.schema.length - 1)}
                value={state.highlightFlagCol}
                onChange={(v) => update({ highlightFlagCol: v })}
                kind="column"
                sheet={state.sheet}
                offset={1}
              />
            </Field>
          )}
          <Field label="Key insight (paragraph)">
            <TextArea value={state.keyInsight} onChange={(v) => update({ keyInsight: v })}
              placeholder="At [condition], [metric] hits $X — within $Y of [threshold]." />
          </Field>
        </PanelSection>
      )}
      {state.mode === "data" && (
        <PanelSection label="Aggregate row" open={aggOpen} onToggle={() => setAggOpen(v => !v)}>
          <Field label="Function">
            <AggregatePicker value={state.aggregate} onChange={(v) => update({ aggregate: v })} />
          </Field>
          {state.aggregate !== "none" && (
            <Field label="Row label (left of values)">
              <TextInput value={state.aggregateLabel}
                onChange={(v) => update({ aggregateLabel: v })}
                placeholder={(state.aggregate || "").toUpperCase()} />
            </Field>
          )}
        </PanelSection>
      )}
      {state.mode === "heatmap" && (
        <PanelSection label="Heatmap" open={heatmapOpen} onToggle={() => setHeatmapOpen(v => !v)}>
          <Field label="Threshold (break-even)">
            <NumberInput value={state.threshold} onChange={(v) => update({ threshold: v })} />
          </Field>
          <Field label="Yellow band half-width">
            <NumberInput value={state.yellowBand} onChange={(v) => update({ yellowBand: v })} step={0.1} />
          </Field>
          <Field label="Top axis label">
            <TextInput value={state.topAxisLabel} onChange={(v) => update({ topAxisLabel: v })} placeholder="UTILIZATION" />
          </Field>
          <Field label="Left axis label">
            <TextInput value={state.leftAxisLabel} onChange={(v) => update({ leftAxisLabel: v })} placeholder="THROUGHPUT" />
          </Field>
          <Field label="Baseline cell (row)">
            <RowPicker
              count={state.sheet.rows.length}
              value={state.baselineRow}
              onChange={(v) => update({ baselineRow: v })}
              sheet={state.sheet}
            />
          </Field>
          <Field label="Baseline cell (column)">
            <RowPicker
              count={Math.max(0, state.sheet.schema.length - 1)}
              value={state.baselineCol}
              onChange={(v) => update({ baselineCol: v })}
              kind="column"
              sheet={state.sheet}
              offset={1}
            />
          </Field>
        </PanelSection>
      )}
      {state.mode === "heatmap" && (
        <PanelSection label="Inputs / Caveats" open={panelOpen} onToggle={() => setPanelOpen(v => !v)}>
          <Field label="Panel kind">
            <KindToggle value={state.panelKind} onChange={(v) => update({ panelKind: v })} a="inputs" b="caveats" />
          </Field>
          {state.panelItems.map((it, i) => (
            <Field key={i} label={state.panelKind === "caveats" ? "Bullet " + (i + 1) : "Input " + (i + 1)}>
              <div style={{ display: "flex", gap: 6 }}>
                <TextInput value={it.label} onChange={(v) => {
                  const next = state.panelItems.slice();
                  next[i] = { ...next[i], label: v };
                  update({ panelItems: next });
                }} placeholder="label" />
                <TextInput value={it.value || ""} onChange={(v) => {
                  const next = state.panelItems.slice();
                  next[i] = { ...next[i], value: v };
                  update({ panelItems: next });
                }} placeholder="value" />
                <button onClick={() => update({ panelItems: state.panelItems.filter((_, j) => j !== i) })}
                  style={{
                    background: "transparent", border: "1px solid " + D.border,
                    color: D.txd, padding: "5px 7px",
                    borderRadius: 5, cursor: "pointer",
                  }}><X size={11} strokeWidth={2.2} /></button>
              </div>
            </Field>
          ))}
          <button onClick={() => update({ panelItems: [...state.panelItems, { label: "", value: "" }] })}
            disabled={state.panelItems.length >= 6}
            style={{
              padding: "6px 11px",
              background: "transparent", border: "1px dashed " + D.border,
              color: D.txm, fontFamily: mn, fontSize: 10, fontWeight: 700, letterSpacing: 0.5,
              borderRadius: 6, cursor: state.panelItems.length >= 6 ? "not-allowed" : "pointer",
              opacity: state.panelItems.length >= 6 ? 0.4 : 1,
              display: "inline-flex", alignItems: "center", gap: 5,
            }}><Plus size={11} strokeWidth={2.2} /> add item</button>
        </PanelSection>
      )}
      {state.mode === "heatmap" && (
        <PanelSection label="Formula box" open={formulaOpen} onToggle={() => setFormulaOpen(v => !v)}>
          <Field label="Formula">
            <TextInput value={state.formula} onChange={(v) => update({ formula: v })} placeholder="payback = capex / annual_savings" />
          </Field>
          <Field label="Baseline calc">
            <TextInput value={state.formulaBaseline} onChange={(v) => update({ formulaBaseline: v })} placeholder="80000 / 25000 ÷ 12" />
          </Field>
          <Field label="Result">
            <TextInput value={state.formulaResult} onChange={(v) => update({ formulaResult: v })} placeholder="3.2 yrs" />
          </Field>
        </PanelSection>
      )}
    </aside>
  );
}

function AggregatePicker({ value, onChange }: { value: "none" | AggregateKind; onChange: (v: "none" | AggregateKind) => void }) {
  const opts: ("none" | AggregateKind)[] = ["none", "sum", "avg", "min", "max"];
  return (
    <div style={{ display: "inline-flex", gap: 2, padding: 3, background: "rgba(255,255,255,0.03)", border: "1px solid " + D.border, borderRadius: 6 }}>
      {opts.map((o) => {
        const on = o === value;
        return (
          <button key={o} onClick={() => onChange(o)}
            style={{
              flex: 1, padding: "4px 8px",
              background: on ? D.amber + "22" : "transparent",
              border: "none", color: on ? D.amber : D.txm,
              fontFamily: mn, fontSize: 10, fontWeight: 800, letterSpacing: 0.5,
              borderRadius: 4, cursor: "pointer", textTransform: "uppercase",
            }}>{o === "none" ? "off" : o}</button>
        );
      })}
    </div>
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
        <span style={{ marginLeft: "auto", fontFamily: mn, fontSize: 9, color: D.txd, letterSpacing: 0.5, textTransform: "none" }}>
          Paste an Excel/Sheets block straight into a cell — it expands.
        </span>
      </button>
      {open && <div style={{ padding: 0 }}>{children}</div>}
    </div>
  );
}

// ─── Data grid ─────────────────────────────────────────────────────────

interface DataGridProps {
  sheet: TableSheet;
  onUpdateCell: (rowIdx: number, key: string, value: string) => void;
  onSmartPaste: (rowIdx: number, colIdx: number, raw: string) => void;
  onRenameColumn: (key: string, label: string) => void;
  onChangeColumnType: (key: string, t: TableColumnType) => void;
  onChangeColumnNumFmt: (key: string, fmt: TableNumberFormat | undefined) => void;
  onChangeColumnPrefix: (key: string, prefix: string) => void;
  onChangeColumnSuffix: (key: string, suffix: string) => void;
  onSortByColumn: (key: string, dir: "asc" | "desc") => void;
  onMoveColumn: (fromKey: string, toIdx: number) => void;
  onAddColumn: () => void;
  onDeleteColumn: (key: string) => void;
  onAddRow: () => void;
  onDeleteRow: (rowIdx: number) => void;
}

function DataGrid(p: DataGridProps) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ borderCollapse: "separate", borderSpacing: 0, width: "100%", minWidth: 600 }}>
        <thead>
          <tr style={{ background: D.surface }}>
            <th style={{ width: 36, padding: "8px 6px", borderBottom: "1px solid " + D.border, position: "sticky", left: 0, background: D.surface, zIndex: 2 }}></th>
            {p.sheet.schema.map((col, ci) => (
              <ColumnHeaderCell
                key={col.key}
                col={col}
                canDelete={p.sheet.schema.length > 1}
                colIdx={ci}
                onRename={(label) => p.onRenameColumn(col.key, label)}
                onChangeType={(t) => p.onChangeColumnType(col.key, t)}
                onChangeNumFmt={(f) => p.onChangeColumnNumFmt(col.key, f)}
                onChangePrefix={(s) => p.onChangeColumnPrefix(col.key, s)}
                onChangeSuffix={(s) => p.onChangeColumnSuffix(col.key, s)}
                onSortAsc={() => p.onSortByColumn(col.key, "asc")}
                onSortDesc={() => p.onSortByColumn(col.key, "desc")}
                onMoveTo={(toIdx) => p.onMoveColumn(col.key, toIdx)}
                onDelete={() => p.onDeleteColumn(col.key)}
              />
            ))}
            <th style={{ width: 40, padding: "6px", borderBottom: "1px solid " + D.border, background: D.surface }}>
              <button onClick={p.onAddColumn}
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
          {p.sheet.rows.map((row, ri) => (
            <tr key={ri}>
              <td style={{
                width: 36, padding: "6px 4px",
                fontFamily: mn, fontSize: 10, color: D.txd,
                textAlign: "center", borderBottom: "1px solid " + D.border,
                position: "sticky", left: 0, background: D.card, zIndex: 1,
              }}>
                <button onClick={() => p.onDeleteRow(ri)} title="Delete row"
                  style={{
                    background: "transparent", border: "none",
                    color: D.txd, cursor: "pointer", fontFamily: mn, fontSize: 11, padding: 0,
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = D.coral; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = D.txd; }}
                >×</button>
                <div style={{ fontSize: 9, color: D.txd, lineHeight: 1, marginTop: 2 }}>{ri + 1}</div>
              </td>
              {p.sheet.schema.map((col, ci) => (
                <Cell key={col.key}
                  value={row[col.key]}
                  type={col.type}
                  onCommit={(v) => p.onUpdateCell(ri, col.key, v)}
                  onSmartPaste={(raw) => p.onSmartPaste(ri, ci, raw)}
                />
              ))}
              <td style={{ borderBottom: "1px solid " + D.border }}></td>
            </tr>
          ))}
          <tr>
            <td colSpan={p.sheet.schema.length + 2} style={{ padding: 0 }}>
              <button onClick={p.onAddRow}
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

interface ColumnHeaderProps {
  col: TableColumnSpec;
  canDelete: boolean;
  colIdx: number;
  onRename: (label: string) => void;
  onChangeType: (t: TableColumnType) => void;
  onChangeNumFmt: (f: TableNumberFormat | undefined) => void;
  onChangePrefix: (s: string) => void;
  onChangeSuffix: (s: string) => void;
  onSortAsc: () => void;
  onSortDesc: () => void;
  onMoveTo: (toIdx: number) => void;
  onDelete: () => void;
}

const NUMFMT_OPTIONS: { value: TableNumberFormat; label: string }[] = [
  { value: "default", label: "Default" },
  { value: "int",     label: "1234 (int)" },
  { value: "dec1",    label: "1.2 (1 dec)" },
  { value: "dec2",    label: "1.23 (2 dec)" },
  { value: "pct",     label: "12% (percent)" },
  { value: "usd",     label: "$1,234" },
  { value: "usdK",    label: "$1.2K" },
  { value: "usdM",    label: "$1.2M" },
  { value: "usdB",    label: "$1.2B" },
  { value: "k",       label: "1.2K" },
  { value: "m",       label: "1.2M" },
  { value: "b",       label: "1.2B" },
];

function ColumnHeaderCell(p: ColumnHeaderProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(p.col.label);
  useEffect(() => setDraft(p.col.label), [p.col.label]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [dragOver, setDragOver] = useState<null | "before" | "after">(null);
  useEffect(() => {
    if (!menuOpen) return;
    const close = () => setMenuOpen(false);
    setTimeout(() => document.addEventListener("click", close), 0);
    return () => document.removeEventListener("click", close);
  }, [menuOpen]);
  const fmtBadge = p.col.numFmt && p.col.numFmt !== "default" ? p.col.numFmt : p.col.type;

  const onDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData("application/x-poast-col-key", p.col.key);
    e.dataTransfer.effectAllowed = "move";
  };
  const onDragOver = (e: React.DragEvent) => {
    const hasKey = e.dataTransfer.types.includes("application/x-poast-col-key");
    if (!hasKey) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const isAfter = e.clientX > rect.left + rect.width / 2;
    setDragOver(isAfter ? "after" : "before");
  };
  const onDragLeave = () => setDragOver(null);
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const fromKey = e.dataTransfer.getData("application/x-poast-col-key");
    setDragOver(null);
    if (!fromKey || fromKey === p.col.key) return;
    const targetIdx = dragOver === "after" ? p.colIdx + 1 : p.colIdx;
    p.onMoveTo(targetIdx);
  };

  return (
    <th
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      style={{
        padding: "6px 8px",
        borderBottom: "1px solid " + D.border,
        borderLeft: dragOver === "before" ? "2px solid " + D.amber : "1px solid " + D.border,
        borderRight: dragOver === "after" ? "2px solid " + D.amber : undefined,
        textAlign: "left", minWidth: 140, background: D.surface,
        position: "relative",
      }}>
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <span
          draggable
          onDragStart={onDragStart}
          title="Drag to reorder"
          style={{ cursor: "grab", display: "inline-flex", flexShrink: 0 }}>
          <GripHorizontal size={11} strokeWidth={2.0} color={D.txd} />
        </span>
        {editing ? (
          <input value={draft} autoFocus
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => { p.onRename(draft.trim() || p.col.label); setEditing(false); }}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              if (e.key === "Escape") { setDraft(p.col.label); setEditing(false); }
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
            }}>{p.col.label}</button>
        )}
        <div style={{ position: "relative" }} onClick={(e) => e.stopPropagation()}>
          <button onClick={() => setMenuOpen(v => !v)}
            title="Format & options"
            style={{
              padding: "2px 6px",
              background: "transparent", border: "1px solid " + D.border,
              color: D.txm, fontFamily: mn, fontSize: 8.5, fontWeight: 700, letterSpacing: 0.4,
              textTransform: "uppercase", borderRadius: 4, cursor: "pointer",
              display: "inline-flex", alignItems: "center", gap: 3,
            }}>{fmtBadge}<ChevronDown size={8} strokeWidth={2.4} /></button>
          {menuOpen && (
            <div style={{
              position: "absolute", top: "calc(100% + 4px)", right: 0,
              background: D.card, border: "1px solid " + D.border, borderRadius: 7,
              padding: 6, minWidth: 230, zIndex: 50,
              boxShadow: "0 20px 36px rgba(0,0,0,0.6)",
              display: "flex", flexDirection: "column", gap: 8,
            }}>
              <ColumnMenuLabel>Sort by this column</ColumnMenuLabel>
              <div style={{ display: "flex", gap: 4 }}>
                <button onClick={() => { p.onSortAsc();  setMenuOpen(false); }}
                  style={menuOptionBtnStyle()}>↑ Asc</button>
                <button onClick={() => { p.onSortDesc(); setMenuOpen(false); }}
                  style={menuOptionBtnStyle()}>↓ Desc</button>
              </div>
              <ColumnMenuLabel>Type</ColumnMenuLabel>
              <div style={{ display: "flex", gap: 3 }}>
                {(["text", "number", "percent", "date"] as TableColumnType[]).map((t) => (
                  <button key={t}
                    onClick={() => p.onChangeType(t)}
                    style={{
                      flex: 1, padding: "5px 6px",
                      background: p.col.type === t ? D.amber + "22" : "transparent",
                      border: "1px solid " + (p.col.type === t ? D.amber + "55" : D.border),
                      borderRadius: 4,
                      color: p.col.type === t ? D.amber : D.tx,
                      fontFamily: mn, fontSize: 9.5, fontWeight: 700, letterSpacing: 0.4,
                      cursor: "pointer", textTransform: "uppercase",
                    }}>{t}</button>
                ))}
              </div>
              <ColumnMenuLabel>Number format</ColumnMenuLabel>
              <select
                value={p.col.numFmt || "default"}
                onChange={(e) => p.onChangeNumFmt(e.target.value as TableNumberFormat)}
                style={{
                  width: "100%", boxSizing: "border-box",
                  background: D.bg, color: D.tx,
                  border: "1px solid " + D.border, borderRadius: 5,
                  padding: "5px 7px",
                  fontFamily: mn, fontSize: 10.5, outline: "none", cursor: "pointer",
                }}>
                {NUMFMT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                <div>
                  <ColumnMenuLabel>Prefix</ColumnMenuLabel>
                  <input
                    value={p.col.prefix || ""}
                    onChange={(e) => p.onChangePrefix(e.target.value)}
                    placeholder="$"
                    style={{
                      width: "100%", boxSizing: "border-box",
                      background: D.bg, color: D.tx,
                      border: "1px solid " + D.border, borderRadius: 5,
                      padding: "5px 7px",
                      fontFamily: mn, fontSize: 10.5, outline: "none",
                    }}/>
                </div>
                <div>
                  <ColumnMenuLabel>Suffix</ColumnMenuLabel>
                  <input
                    value={p.col.suffix || ""}
                    onChange={(e) => p.onChangeSuffix(e.target.value)}
                    placeholder="/ hr"
                    style={{
                      width: "100%", boxSizing: "border-box",
                      background: D.bg, color: D.tx,
                      border: "1px solid " + D.border, borderRadius: 5,
                      padding: "5px 7px",
                      fontFamily: mn, fontSize: 10.5, outline: "none",
                    }}/>
                </div>
              </div>
              {p.canDelete && (
                <button onClick={() => { p.onDelete(); setMenuOpen(false); }}
                  style={{
                    marginTop: 4, padding: "5px 10px",
                    background: "transparent", border: "1px solid " + D.coral + "55",
                    color: D.coral, fontFamily: mn, fontSize: 10, fontWeight: 700, letterSpacing: 0.5,
                    borderRadius: 5, cursor: "pointer",
                    display: "inline-flex", alignItems: "center", gap: 5,
                  }}><X size={10} strokeWidth={2.2} /> Delete column</button>
              )}
            </div>
          )}
        </div>
      </div>
    </th>
  );
}

function menuOptionBtnStyle(): React.CSSProperties {
  return {
    flex: 1,
    padding: "5px 8px",
    background: "transparent", border: "1px solid " + D.border,
    color: D.tx,
    fontFamily: mn, fontSize: 10, fontWeight: 700, letterSpacing: 0.4,
    borderRadius: 4, cursor: "pointer", textTransform: "uppercase",
  };
}

function ColumnMenuLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontFamily: mn, fontSize: 8.5, color: D.txd, letterSpacing: 0.6,
      fontWeight: 700, textTransform: "uppercase", marginBottom: 3,
    }}>{children}</div>
  );
}

// ─── Inline edit overlay ───────────────────────────────────────────────
// Positions an HTML input/textarea directly over the corresponding text
// region in the rendered SVG. The SVG's viewBox is 1394×861.7 with
// preserveAspectRatio="xMidYMid meet", so we compute the displayed
// scale + letterbox offsets to translate region coords into pixels.

function editorValueFor(field: EditableField, s: TableEditorState): string {
  if (field === "category")      return s.category;
  if (field === "titleWhite")    return s.titleWhite;
  if (field === "titleAmber")    return s.titleAmber;
  if (field === "subtitle")      return s.subtitle;
  if (field === "titleBar")      return s.titleBar;
  if (field === "keyInsight")    return s.keyInsight;
  if (field === "topAxisLabel")  return s.topAxisLabel;
  if (field === "leftAxisLabel") return s.leftAxisLabel;
  return "";
}

function editorPatchFor(field: EditableField, value: string): Partial<TableEditorState> {
  return { [field]: value } as Partial<TableEditorState>;
}

function InlineEditOverlay({ field, previewEl, value, onCommit, onCancel }: {
  field: EditableField;
  previewEl: HTMLDivElement;
  value: string;
  onCommit: (v: string) => void;
  onCancel: () => void;
}) {
  const region = EDITABLE_REGIONS[field];
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);

  const [rect, setRect] = useState<{ left: number; top: number; width: number; height: number; fontSize: number; }>(() =>
    computeRect(previewEl, region));

  useEffect(() => {
    const update = () => setRect(computeRect(previewEl, region));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(previewEl);
    window.addEventListener("scroll", update, true);
    return () => {
      ro.disconnect();
      window.removeEventListener("scroll", update, true);
    };
  }, [previewEl, region]);

  const multiline = region.multiline === true;
  const isLeftAxis = field === "leftAxisLabel";

  const commit = () => onCommit(draft);

  return (
    <div style={{
      position: "absolute",
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
      zIndex: 30,
      transform: isLeftAxis ? "rotate(-90deg)" : undefined,
      transformOrigin: isLeftAxis ? "left top" : undefined,
    }}>
      {multiline ? (
        <textarea
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Escape") { e.preventDefault(); onCancel(); }
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); commit(); }
          }}
          style={inlineInputStyle(rect.fontSize, true)}
        />
      ) : (
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Escape") { e.preventDefault(); onCancel(); }
            if (e.key === "Enter")  { e.preventDefault(); commit(); }
          }}
          style={inlineInputStyle(rect.fontSize, false)}
        />
      )}
    </div>
  );
}

function inlineInputStyle(fontSize: number, multiline: boolean): React.CSSProperties {
  return {
    width: "100%", height: "100%", boxSizing: "border-box",
    background: "rgba(10,12,18,0.92)",
    border: "1px solid #F7B041",
    borderRadius: 4,
    color: "#E8E4DD",
    fontFamily: "'Outfit', sans-serif",
    fontWeight: 700,
    fontSize: Math.max(11, fontSize),
    lineHeight: multiline ? 1.4 : 1,
    padding: multiline ? "8px 10px" : "4px 8px",
    outline: "none",
    resize: "none",
    boxShadow: "0 0 0 3px rgba(247,176,65,0.18)",
  };
}

// Convert a region in SVG viewBox space to absolute pixel coords inside
// previewEl (which holds the SVG with preserveAspectRatio="xMidYMid meet").
function computeRect(previewEl: HTMLDivElement, region: { x: number; y: number; w: number; h: number }) {
  const pw = previewEl.clientWidth;
  const ph = previewEl.clientHeight;
  const svgW = SA_TABLE_WIDTH;
  const svgH = SA_TABLE_HEIGHT;
  const scale = Math.min(pw / svgW, ph / svgH);
  const offsetX = (pw - svgW * scale) / 2;
  const offsetY = (ph - svgH * scale) / 2;
  return {
    left: offsetX + region.x * scale,
    top:  offsetY + region.y * scale,
    width: region.w * scale,
    height: region.h * scale,
    // Heuristic: scale the input font to roughly match the SVG text size.
    fontSize: Math.round(region.h * scale * 0.6),
  };
}

// ─── AI parse modal ─────────────────────────────────────────────────────
// Brain-dump pattern: paste anything (Slack thread, prose paragraph,
// pasted spreadsheet, list with attributes), hit Parse, the model
// returns a structured TableSheet + title + insight. User can review
// and apply, or start over.

interface ParsedResponse {
  title?: string;
  subtitle?: string;
  mode?: "data" | "heatmap";
  columns?: { label: string; type?: TableColumnType; numFmt?: TableNumberFormat; prefix?: string; suffix?: string }[];
  rows?: Record<string, string | number | null>[];
  highlightRowIdx?: number | null;
  highlightFlagCol?: number | null;
  keyInsight?: string;
}

function ParseModal({ onClose, onApply }: {
  onClose: () => void;
  onApply: (patch: Partial<TableEditorState>) => void;
}) {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parsed, setParsed] = useState<ParsedResponse | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => { textareaRef.current?.focus(); }, []);
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const canRun = text.trim().length > 0 && !loading;

  const runParse = async () => {
    if (!canRun) return;
    setLoading(true);
    setError(null);
    setParsed(null);
    try {
      const res = await fetch("/api/studio-table/parse", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: text.trim() }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Parse failed");
      if (!j.parsed) throw new Error("Empty response");
      setParsed(j.parsed as ParsedResponse);
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
    } finally {
      setLoading(false);
    }
  };

  const applyParsed = () => {
    if (!parsed) return;
    const patch = parsedToPatch(parsed);
    onApply(patch);
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 12000,
        background: "rgba(6,6,12,0.72)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
        display: "flex", alignItems: "flex-start", justifyContent: "center",
        paddingTop: "8vh", paddingBottom: "4vh",
      }}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(820px, 94vw)",
          background: "linear-gradient(180deg, " + D.card + ", " + D.surface + ")",
          border: "1px solid " + D.violet + "55",
          borderRadius: 14,
          boxShadow: "0 32px 80px rgba(0,0,0,0.7), 0 0 48px " + D.violet + "22",
          overflow: "hidden",
        }}>
        <div style={{
          padding: "14px 18px",
          borderBottom: "1px solid " + D.border,
          display: "flex", alignItems: "center", gap: 10,
        }}>
          <span style={{
            fontFamily: mn, fontSize: 10, color: D.violet, letterSpacing: 1.5,
            fontWeight: 800, textTransform: "uppercase",
          }}>✦ AI parse</span>
          <span style={{ fontFamily: ft, fontSize: 12.5, color: D.txm }}>
            Paste anything — spreadsheet block, pasted email, paragraph — Claude turns it into a table.
          </span>
          <button onClick={onClose}
            style={{
              marginLeft: "auto",
              background: "transparent", border: "none", color: D.txm,
              fontSize: 20, cursor: "pointer", padding: "0 4px", lineHeight: 1,
            }}>×</button>
        </div>

        {!parsed && (
          <div style={{ padding: 16 }}>
            <textarea
              ref={textareaRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                  e.preventDefault();
                  if (canRun) runParse();
                }
              }}
              placeholder={"Examples Claude can parse:\n\n  Q1\tQ2\tQ3\tQ4\n  Revenue\t18.4\t21.1\t23.6\t26.2\n  Margin\t32\t34\t36\t38\n\n…or a paragraph:\n  \"Anthropic's Sonnet does ~320k tokens per dollar at 240ms p95 with a 200k context. OpenAI's GPT-5 is at 280k tokens/$ and 310ms, also 128k context. Gemini 3 Pro pushes 340k at 280ms with a 1M context.\"\n\n⌘Enter to parse"}
              rows={9}
              style={{
                width: "100%", boxSizing: "border-box",
                background: D.bg, border: "1px solid " + D.border, borderRadius: 9,
                color: D.tx, fontFamily: ft, fontSize: 13.5, lineHeight: 1.45,
                padding: "11px 13px", resize: "vertical", outline: "none",
                minHeight: 200,
              }}
            />
            {error && (
              <div style={{
                marginTop: 10, padding: "8px 11px",
                background: "rgba(224,99,71,0.08)", border: "1px solid " + D.coral + "55",
                borderRadius: 7, color: D.coral, fontFamily: mn, fontSize: 11.5,
              }}>● {error}</div>
            )}
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12 }}>
              <button
                onClick={runParse}
                disabled={!canRun}
                style={{
                  padding: "9px 18px",
                  background: canRun
                    ? "linear-gradient(135deg, " + D.violet + ", " + D.cyan + ")"
                    : D.surface,
                  color: canRun ? "#0A0A0F" : D.txd,
                  border: canRun ? "none" : "1px solid " + D.border,
                  fontFamily: ft, fontSize: 13, fontWeight: 700, letterSpacing: 0.3,
                  borderRadius: 9, cursor: canRun ? "pointer" : "not-allowed",
                  boxShadow: canRun ? "0 6px 18px " + D.violet + "33" : "none",
                }}>{loading ? "● Parsing…" : "✦ Parse"}</button>
              <span style={{ fontFamily: mn, fontSize: 10, color: D.txd, letterSpacing: 0.5 }}>⌘ + ↵ to submit</span>
            </div>
          </div>
        )}

        {parsed && (
          <div style={{ padding: 16 }}>
            <ParsedPreview parsed={parsed} />
            <div style={{ display: "flex", gap: 8, marginTop: 14, justifyContent: "flex-end" }}>
              <button onClick={() => { setParsed(null); setError(null); }}
                style={{
                  padding: "7px 14px",
                  background: "transparent", border: "1px solid " + D.border,
                  color: D.txm, fontFamily: mn, fontSize: 11, fontWeight: 700,
                  letterSpacing: 0.5, borderRadius: 7, cursor: "pointer",
                }}>start over</button>
              <button onClick={applyParsed}
                style={{
                  padding: "8px 18px",
                  background: "linear-gradient(135deg, " + D.amber + ", " + D.coral + ")",
                  color: "#0A0A0F", border: "none",
                  fontFamily: ft, fontSize: 13, fontWeight: 700, letterSpacing: 0.3,
                  borderRadius: 9, cursor: "pointer",
                  boxShadow: "0 6px 18px rgba(247,176,65,0.25)",
                }}>✦ Replace doc with this</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ParsedPreview({ parsed }: { parsed: ParsedResponse }) {
  const cols = parsed.columns || [];
  const rows = parsed.rows || [];
  return (
    <div>
      <div style={{
        fontFamily: mn, fontSize: 10, color: D.violet, letterSpacing: 1.5,
        fontWeight: 800, textTransform: "uppercase", marginBottom: 4,
      }}>{parsed.mode === "heatmap" ? "Heatmap" : "Data table"} · {cols.length} cols × {rows.length} rows</div>
      {parsed.title && (
        <div style={{ fontFamily: gf, fontSize: 18, fontWeight: 800, color: D.tx, letterSpacing: -0.2 }}>{parsed.title}</div>
      )}
      {parsed.subtitle && (
        <div style={{ fontFamily: ft, fontSize: 12.5, color: D.txm, marginTop: 2 }}>{parsed.subtitle}</div>
      )}
      <div style={{
        marginTop: 12,
        background: D.bg, border: "1px solid " + D.border, borderRadius: 9,
        overflowX: "auto", maxHeight: 260,
      }}>
        <table style={{ borderCollapse: "separate", borderSpacing: 0, width: "100%", minWidth: 480 }}>
          <thead>
            <tr style={{ background: D.surface }}>
              {cols.map((c, i) => (
                <th key={i} style={{
                  padding: "7px 10px",
                  borderBottom: "1px solid " + D.border,
                  borderLeft: i > 0 ? "1px solid " + D.border : "none",
                  fontFamily: ft, fontSize: 12, fontWeight: 700, color: D.tx,
                  textAlign: i === 0 ? "left" : "right",
                }}>{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 10).map((r, ri) => (
              <tr key={ri}>
                {cols.map((c, ci) => {
                  const v = r[c.label];
                  const display = v == null ? "—" : String(v);
                  return (
                    <td key={ci} style={{
                      padding: "6px 10px",
                      borderBottom: "1px solid " + D.border,
                      borderLeft: ci > 0 ? "1px solid " + D.border : "none",
                      fontFamily: ci === 0 ? ft : mn, fontSize: 12, color: D.tx,
                      textAlign: ci === 0 ? "left" : "right",
                    }}>{display}</td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {parsed.keyInsight && (
        <div style={{
          marginTop: 10, padding: "8px 11px",
          background: "rgba(247,176,65,0.06)", border: "1px solid " + D.amber + "33",
          borderRadius: 7,
          fontFamily: ft, fontSize: 12, color: D.tx, lineHeight: 1.45,
        }}>
          <span style={{ color: D.amber, fontFamily: mn, fontSize: 9, fontWeight: 800, letterSpacing: 1.2, marginRight: 6 }}>KEY INSIGHT</span>
          {parsed.keyInsight}
        </div>
      )}
    </div>
  );
}

// Translate the API response into a Partial<TableEditorState> the
// editor can absorb directly. Generates fresh column keys so we don't
// collide with existing schema.
function parsedToPatch(parsed: ParsedResponse): Partial<TableEditorState> {
  const cols = parsed.columns || [];
  const schema = cols.map((c, i) => {
    const key = "c" + (i + 1);
    const type: TableColumnType =
      c.type === "number" || c.type === "percent" || c.type === "date" || c.type === "text"
        ? c.type
        : i === 0 ? "text" : "number";
    const spec: TableColumnSpec = { key, label: c.label, type };
    if (c.numFmt && c.numFmt !== "default") spec.numFmt = c.numFmt;
    if (c.prefix) spec.prefix = c.prefix;
    if (c.suffix) spec.suffix = c.suffix;
    return spec;
  });
  const rows = (parsed.rows || []).map(r => {
    const out: Record<string, TableCellValue> = {};
    cols.forEach((c, ci) => {
      const k = "c" + (ci + 1);
      const raw = r[c.label];
      if (raw == null) { out[k] = null; return; }
      if (typeof raw === "number") { out[k] = raw; return; }
      const coerced = coerce(String(raw), c.type === "number" || c.type === "percent" ? c.type : "text");
      out[k] = coerced;
    });
    return out;
  });
  const sheet: TableSheet = { schema, rows };

  // Split the title into white + amber on a "·" or hyphen separator
  // when present, so the SA two-color title comes through.
  const title = parsed.title || "";
  let titleWhite = title;
  let titleAmber = "";
  const sepMatch = title.match(/^(.*?)\s*[·•|]\s*(.+)$/);
  if (sepMatch) {
    titleWhite = sepMatch[1].trim();
    titleAmber = sepMatch[2].trim();
  }

  const patch: Partial<TableEditorState> = {
    sheet,
    mode: parsed.mode === "heatmap" ? "heatmap" : "data",
    titleWhite,
    titleAmber,
    subtitle: parsed.subtitle || "",
  };
  if (parsed.highlightRowIdx != null) patch.highlightRowIdx = parsed.highlightRowIdx;
  if (parsed.highlightFlagCol != null) patch.highlightFlagCol = parsed.highlightFlagCol;
  if (parsed.keyInsight) patch.keyInsight = parsed.keyInsight;
  return patch;
}

function Cell({ value, type, onCommit, onSmartPaste }: {
  value: TableCellValue;
  type: TableColumnType;
  onCommit: (v: string) => void;
  onSmartPaste: (raw: string) => void;
}) {
  const display = value == null ? "" : String(value);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(display);
  useEffect(() => { if (!editing) setDraft(display); }, [display, editing]);
  const numeric = type === "number" || type === "percent";
  const handlePaste: React.ClipboardEventHandler<HTMLInputElement> = (e) => {
    const raw = e.clipboardData.getData("text/plain");
    if (raw.includes("\t") || raw.includes("\n")) {
      e.preventDefault();
      onSmartPaste(raw);
      setEditing(false);
    }
  };
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
          onPaste={handlePaste}
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
