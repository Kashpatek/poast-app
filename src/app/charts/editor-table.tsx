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
  GripHorizontal, Highlighter, Image as ImageIcon, Maximize2, Minus,
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
  TableChromeStyle, FieldStyle,
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
  chromeStyle: TableChromeStyle;
  fieldStyles: Record<string, FieldStyle>;
  hideWebsite: boolean;
  hideConfidential: boolean;
  source: string;
  pageW: number;
  pageH: number;
  hideTopStripe: boolean;
  showRowStripe: boolean;
  dividerStyle: "solid" | "dotted" | "none";
  rowStyles: Record<number, import("./studio-types").TableRowStyle>;
  fontScale: number;
  titleFontScale: number;
  bodyFontScale: number;
  autoFontScale: boolean;
  lockTableDimensions: boolean;
  cellStyles: Record<string, import("./studio-types").CellStyle>;
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
  const [editingCell, setEditingCell] = useState<{ row: number; col: string } | null>(null);
  // Annotate mode — clicking cells toggles selection instead of opening
  // the edit overlay. Selected cells accept the styles chosen in the
  // floating annotation toolbar.
  const [annotateMode, setAnnotateMode] = useState(false);
  const [selectedCells, setSelectedCells] = useState<Set<string>>(new Set());
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
      chromeStyle: state.chromeStyle === "framed" ? undefined : state.chromeStyle,
      fieldStyles: Object.keys(state.fieldStyles).length > 0 ? state.fieldStyles : undefined,
      hideWebsite: state.hideWebsite || undefined,
      hideConfidential: state.hideConfidential || undefined,
      source: state.source || undefined,
      pageW: state.pageW !== SA_TABLE_WIDTH ? state.pageW : undefined,
      pageH: state.pageH !== SA_TABLE_HEIGHT ? state.pageH : undefined,
      hideTopStripe: state.hideTopStripe || undefined,
      showRowStripe: state.showRowStripe || undefined,
      dividerStyle: state.dividerStyle !== "solid" ? state.dividerStyle : undefined,
      rowStyles: Object.keys(state.rowStyles).length > 0 ? state.rowStyles : undefined,
      fontScale: state.fontScale !== 1 ? state.fontScale : undefined,
      titleFontScale: state.titleFontScale !== 1 ? state.titleFontScale : undefined,
      bodyFontScale: state.bodyFontScale !== 1 ? state.bodyFontScale : undefined,
      autoFontScale: state.autoFontScale ? true : undefined,
      lockTableDimensions: state.lockTableDimensions ? true : undefined,
      cellStyles: Object.keys(state.cellStyles).length > 0 ? state.cellStyles : undefined,
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
        [key]: (type === "text" || type === "badge")
          ? (r[key] == null ? "" : String(r[key]))
          : coerce(String(r[key] ?? ""), type),
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

  const setColumnBadgeMap = useCallback((key: string, map: Record<string, string>) => {
    updateSheet((cur) => ({
      ...cur,
      schema: cur.schema.map(c => c.key === key ? { ...c, badgeMap: map } : c),
    }));
  }, [updateSheet]);

  const setColumnCondFmt = useCallback((key: string, mode: import("./studio-types").TableCondFmt) => {
    updateSheet((cur) => ({
      ...cur,
      schema: cur.schema.map(c => c.key === key ? { ...c, condFmt: mode === "off" ? undefined : mode } : c),
    }));
  }, [updateSheet]);

  const setColumnHeaderColor = useCallback((key: string, color: string | undefined) => {
    updateSheet((cur) => ({
      ...cur,
      schema: cur.schema.map(c => c.key === key ? { ...c, headerColor: color } : c),
    }));
  }, [updateSheet]);

  const resizeColumn = useCallback((key: string, width: number) => {
    updateSheet((cur) => ({
      ...cur,
      schema: cur.schema.map(c => c.key === key ? { ...c, width: Math.max(60, Math.round(width)) } : c),
    }));
  }, [updateSheet]);

  const reorderRow = useCallback((fromIdx: number, toIdx: number) => {
    updateSheet((cur) => {
      if (fromIdx === toIdx || fromIdx < 0 || fromIdx >= cur.rows.length) return cur;
      const rows = cur.rows.slice();
      const [moved] = rows.splice(fromIdx, 1);
      const insertAt = toIdx > fromIdx ? toIdx - 1 : toIdx;
      rows.splice(Math.max(0, Math.min(rows.length, insertAt)), 0, moved);
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
          <span style={{ width: 1, height: 18, background: D.border, margin: "0 4px" }} />
          <ToolbarBtn
            Icon={Highlighter}
            label={annotateMode ? "Annotating · " + selectedCells.size : "Annotate"}
            accent={annotateMode ? D.amber : undefined}
            onClick={() => {
              if (annotateMode) {
                setAnnotateMode(false);
                setSelectedCells(new Set());
              } else {
                setAnnotateMode(true);
                setEditingField(null);
                setEditingCell(null);
              }
            }}
          />
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
                aspectRatio: fitMode === "locked" ? state.pageW + " / " + state.pageH : undefined,
                width: "100%",
                position: "relative",
              }}
            >
          <SaTableSvg
            mode={state.mode}
            sheet={state.sheet}
            chromeStyle={state.chromeStyle}
            fieldStyles={state.fieldStyles}
            hideWebsite={state.hideWebsite}
            hideConfidential={state.hideConfidential}
            source={state.source}
            pageW={state.pageW}
            pageH={state.pageH}
            hideTopStripe={state.hideTopStripe}
            showRowStripe={state.showRowStripe}
            dividerStyle={state.dividerStyle}
            rowStyles={state.rowStyles}
            fontScale={state.autoFontScale ? undefined : state.fontScale}
            titleFontScale={state.titleFontScale !== 1 ? state.titleFontScale : undefined}
            bodyFontScale={state.bodyFontScale !== 1 ? state.bodyFontScale : undefined}
            autoFontScale={state.autoFontScale}
            lockTableDimensions={state.lockTableDimensions}
            cellStyles={state.cellStyles}
            selectedCells={annotateMode ? selectedCells : undefined}
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
            onEditField={annotateMode ? undefined : setEditingField}
            editingField={editingField}
            onEditCell={(row, col) => {
              if (annotateMode) {
                const key = row + ":" + col;
                setSelectedCells((cur) => {
                  const next = new Set(cur);
                  if (next.has(key)) next.delete(key);
                  else next.add(key);
                  return next;
                });
              } else {
                setEditingField(null);
                setEditingCell({ row, col });
              }
            }}
            editingCell={editingCell}
            onResizeColumn={resizeColumn}
          />
          {editingCell && previewRef.current && (
            <CellEditOverlay
              previewEl={previewRef.current}
              row={editingCell.row}
              colKey={editingCell.col}
              sheet={state.sheet}
              onCommit={(value) => {
                updateCell(editingCell.row, editingCell.col, value);
                setEditingCell(null);
              }}
              onCancel={() => setEditingCell(null)}
            />
          )}
          {annotateMode && selectedCells.size > 0 && previewRef.current && (
            <AnnotationToolbar
              previewEl={previewRef.current}
              selection={selectedCells}
              currentStyles={state.cellStyles}
              onApply={(patch) => {
                const next = { ...state.cellStyles };
                selectedCells.forEach((key) => {
                  const existing = next[key] || {};
                  const merged = { ...existing, ...patch };
                  // Strip undefined entries so the saved payload stays small.
                  if (merged.bg === undefined) delete merged.bg;
                  if (merged.color === undefined) delete merged.color;
                  if (merged.border === undefined) delete merged.border;
                  if (merged.borderColor === undefined) delete merged.borderColor;
                  if (merged.bold === undefined) delete merged.bold;
                  if (Object.keys(merged).length === 0) delete next[key];
                  else next[key] = merged;
                });
                update({ cellStyles: next });
              }}
              onSelectColumn={() => {
                // Expand current selection: for every selected cell,
                // add every other cell in its column.
                const next = new Set(selectedCells);
                selectedCells.forEach((key) => {
                  const [, col] = key.split(":");
                  for (let ri = 0; ri < state.sheet.rows.length; ri++) {
                    next.add(ri + ":" + col);
                  }
                });
                setSelectedCells(next);
              }}
              onSelectRow={() => {
                const next = new Set(selectedCells);
                selectedCells.forEach((key) => {
                  const [row] = key.split(":");
                  state.sheet.schema.forEach((c) => next.add(row + ":" + c.key));
                });
                setSelectedCells(next);
              }}
              onClear={() => setSelectedCells(new Set())}
              onClose={() => {
                setAnnotateMode(false);
                setSelectedCells(new Set());
              }}
            />
          )}
          {editingField && previewRef.current && (
            <InlineEditOverlay
              field={editingField}
              previewEl={previewRef.current}
              value={editorValueFor(editingField, state)}
              style={state.fieldStyles[editingField]}
              onStyleChange={(next) => {
                const nextStyles = { ...state.fieldStyles };
                if (next) nextStyles[editingField] = next;
                else delete nextStyles[editingField];
                update({ fieldStyles: nextStyles });
              }}
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
            onResizeColumn={resizeColumn}
            onAddColumn={addColumn}
            onDeleteColumn={deleteColumn}
            onAddRow={addRow}
            onDeleteRow={deleteRow}
            onReorderRow={reorderRow}
            onChangeColumnBadgeMap={setColumnBadgeMap}
            onChangeColumnCondFmt={setColumnCondFmt}
            onChangeColumnHeaderColor={setColumnHeaderColor}
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
    chromeStyle: "framed",
    fieldStyles: {},
    hideWebsite: false,
    hideConfidential: false,
    source: "",
    pageW: SA_TABLE_WIDTH,
    pageH: SA_TABLE_HEIGHT,
    hideTopStripe: false,
    showRowStripe: false,
    dividerStyle: "solid",
    rowStyles: {},
    fontScale: 1,
    titleFontScale: 1,
    bodyFontScale: 1,
    autoFontScale: true,
    lockTableDimensions: false,
    cellStyles: {},
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
    if (p.chromeStyle === "dense" || p.chromeStyle === "leaderboard" || p.chromeStyle === "sectioned") {
      seed.chromeStyle = p.chromeStyle;
    }
    if (p.fieldStyles && typeof p.fieldStyles === "object") {
      seed.fieldStyles = p.fieldStyles;
    }
    if (typeof p.hideWebsite === "boolean") seed.hideWebsite = p.hideWebsite;
    if (typeof p.hideConfidential === "boolean") seed.hideConfidential = p.hideConfidential;
    if (typeof p.source === "string") seed.source = p.source;
    if (typeof p.pageW === "number" && p.pageW > 200) seed.pageW = p.pageW;
    if (typeof p.pageH === "number" && p.pageH > 200) seed.pageH = p.pageH;
    if (typeof p.hideTopStripe === "boolean") seed.hideTopStripe = p.hideTopStripe;
    if (typeof p.showRowStripe === "boolean") seed.showRowStripe = p.showRowStripe;
    if (p.dividerStyle === "dotted" || p.dividerStyle === "none") seed.dividerStyle = p.dividerStyle;
    if (p.rowStyles && typeof p.rowStyles === "object") {
      seed.rowStyles = p.rowStyles as Record<number, import("./studio-types").TableRowStyle>;
    }
    if (typeof p.fontScale === "number" && p.fontScale > 0.3 && p.fontScale < 4) {
      seed.fontScale = p.fontScale;
    }
    if (typeof p.titleFontScale === "number" && p.titleFontScale > 0.3 && p.titleFontScale < 4) {
      seed.titleFontScale = p.titleFontScale;
    }
    if (typeof p.bodyFontScale === "number" && p.bodyFontScale > 0.3 && p.bodyFontScale < 4) {
      seed.bodyFontScale = p.bodyFontScale;
    }
    if (typeof p.autoFontScale === "boolean") seed.autoFontScale = p.autoFontScale;
    if (typeof p.lockTableDimensions === "boolean") seed.lockTableDimensions = p.lockTableDimensions;
    if (p.cellStyles && typeof p.cellStyles === "object") {
      seed.cellStyles = p.cellStyles as Record<string, import("./studio-types").CellStyle>;
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

// 2×2 grid of chrome variants. Each tile shows a tiny mockup so the
// user can preview the wrapping decoration before committing.
function ChromePicker({ value, onChange }: {
  value: TableChromeStyle;
  onChange: (v: TableChromeStyle) => void;
}) {
  const options: { id: TableChromeStyle; label: string; blurb: string }[] = [
    { id: "framed",          label: "Framed",      blurb: "Title bar + key insight (default)" },
    { id: "dense",           label: "Dense",       blurb: "No title bar · more grid space" },
    { id: "leaderboard",     label: "Leaderboard", blurb: "Gold / silver / bronze top 3" },
    { id: "sectioned",       label: "Sectioned",   blurb: "Section bands from `── X ──` rows" },
    { id: "colored-headers", label: "Color heads", blurb: "Each column header gets a brand color" },
    { id: "banded-spec",     label: "Banded spec", blurb: "Section bands rotate brand colors" },
    { id: "totaled",         label: "Totals",      blurb: "Bold subtotals · amber Grand Total" },
  ];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, padding: "8px 10px" }}>
      {options.map((o) => {
        const active = o.id === value;
        return (
          <button
            key={o.id}
            onClick={() => onChange(o.id)}
            style={{
              textAlign: "left",
              padding: "8px 10px",
              background: active ? D.amber + "1A" : "transparent",
              color: active ? D.amber : D.tx,
              border: "1px solid " + (active ? D.amber + "66" : D.border),
              borderRadius: 8, cursor: "pointer",
              fontFamily: mn, letterSpacing: 0.4,
              transition: "background 0.12s, color 0.12s, border-color 0.12s",
            }}
          >
            <div style={{ fontSize: 11.5, fontWeight: 800, marginBottom: 2 }}>
              {o.label}
            </div>
            <div style={{ fontSize: 9.5, color: active ? D.amber : D.txd, lineHeight: 1.3 }}>
              {o.blurb}
            </div>
          </button>
        );
      })}
    </div>
  );
}

function DividerStylePicker({ value, onChange }: {
  value: "solid" | "dotted" | "none";
  onChange: (v: "solid" | "dotted" | "none") => void;
}) {
  const opts: { id: "solid" | "dotted" | "none"; label: string }[] = [
    { id: "solid",  label: "Solid"  },
    { id: "dotted", label: "Dotted" },
    { id: "none",   label: "None"   },
  ];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 4 }}>
      {opts.map((o) => {
        const active = o.id === value;
        return (
          <button key={o.id}
            onClick={() => onChange(o.id)}
            style={{
              padding: "5px 6px",
              background: active ? D.amber + "22" : "transparent",
              border: "1px solid " + (active ? D.amber + "55" : D.border),
              borderRadius: 4, cursor: "pointer",
              color: active ? D.amber : D.tx,
              fontFamily: mn, fontSize: 9.5, fontWeight: 700, letterSpacing: 0.4,
              textTransform: "uppercase",
            }}
          >{o.label}</button>
        );
      })}
    </div>
  );
}

// Page dimension presets — tuned for table layouts. Wide slide-style
// (the default), square for social, tall A4 / Letter for full-page
// documents, and a "compact" preset for the small dataset Daksh
// flagged. Numeric inputs let the user dial in exact bounds.
interface PageDimPreset { id: string; label: string; w: number; h: number; }
const TABLE_PAGE_PRESETS: PageDimPreset[] = [
  { id: "default", label: "SA Slide",      w: SA_TABLE_WIDTH, h: SA_TABLE_HEIGHT },
  { id: "compact", label: "Compact",       w: 1100, h: 600 },
  { id: "wide",    label: "16:9 HD",       w: 1920, h: 1080 },
  { id: "square",  label: "Square",        w: 1080, h: 1080 },
  { id: "tall",    label: "Tall 4:5",      w: 1080, h: 1350 },
  { id: "story",   label: "Story 9:16",    w: 1080, h: 1920 },
];

// Fit to margins — keeps the user's currently chosen canvas WIDTH
// (SA Slide, Compact, Square, whatever) and only crops the empty
// space below the table. The natural height = title header + title
// bar + column header + row stack + aggregate + key insight + a
// breathing-room margin + footer chrome.
function autoFitHeight(
  sheet: TableSheet,
  chromeStyle: TableChromeStyle,
  hasKeyInsight: boolean,
  aggregate: "none" | AggregateKind,
  hasSource: boolean,
  fontScale: number,
): number {
  // Header block above the table (category + title + subtitle) lives
  // at y ≈ 0..130 and the title bar starts at y = 150 in the legacy
  // 1394 frame. These offsets are font-relative — when the user
  // bumps font scale, give more vertical room so titles don't crowd.
  const headerBlockH = 130 + (fontScale - 1) * 40;
  const titleBarY = headerBlockH + 20;
  const titleBarH = chromeStyle === "dense" ? 0 : Math.round(44 * fontScale);
  const colHeaderH = Math.round(46 * fontScale);
  const rowH = Math.round(42 * fontScale);
  const aggregateRowH = aggregate !== "none" ? Math.round(50 * fontScale) : 0;
  const showKeyInsight = chromeStyle !== "dense" && hasKeyInsight;
  const keyInsightH = showKeyInsight ? 180 : 0;
  // Breathing room between table bottom and the footer rule — this is
  // the gap the user wants to set.
  const marginBeforeFooter = 56;
  // Footer chrome — bottom rule + label baseline + breathing room.
  // Source line lives ABOVE the footer rule, so add room when set.
  const sourceLineH = hasSource ? 22 : 0;
  const footerChromeH = 50 + sourceLineH;

  const rowCount = Math.max(1, sheet.rows.length);
  const tableBlockH = colHeaderH + rowCount * rowH + aggregateRowH + keyInsightH;
  return Math.round(Math.min(4000, titleBarY + titleBarH + tableBlockH + marginBeforeFooter + footerChromeH));
}

function PageDimensionPicker({ pageW, pageH, sheet, chromeStyle, keyInsight, aggregate, source, fontScale, onChange }: {
  pageW: number; pageH: number;
  sheet: TableSheet;
  chromeStyle: TableChromeStyle;
  keyInsight: string;
  aggregate: "none" | AggregateKind;
  source: string;
  fontScale: number;
  onChange: (w: number, h: number) => void;
}) {
  // Fit to margins keeps the user's chosen WIDTH (SA Slide, Compact,
  // Square, etc.) and only crops the height to the table content +
  // breathing room before the footer. Reactive to font scale + rows.
  const fitH = useMemo(
    () => autoFitHeight(sheet, chromeStyle, !!keyInsight.trim(), aggregate, !!source.trim(), fontScale),
    [sheet, chromeStyle, keyInsight, aggregate, source, fontScale],
  );
  return (
    <div style={{ padding: "6px 10px 10px" }}>
      {/* Margin / auto-fit preset — wide tile up top so it's the first
          thing the user sees. Recomputes on every render so it tracks
          row + column changes live. */}
      <button
        onClick={() => onChange(pageW, fitH)}
        style={{
          width: "100%",
          padding: "9px 11px",
          background: "linear-gradient(120deg, " + D.violet + "1A, " + D.amber + "14)",
          color: D.tx,
          border: "1px dashed " + D.violet + "66",
          borderRadius: 7, cursor: "pointer",
          fontFamily: mn, fontSize: 10.5, fontWeight: 700, letterSpacing: 0.4,
          textAlign: "left",
          marginBottom: 8,
          display: "flex", alignItems: "center", gap: 8,
        }}
        title="Snap canvas height to the table — keeps current width"
      >
        <Sparkles size={12} strokeWidth={2.2} color={D.violet} />
        <div style={{ flex: 1 }}>
          <div>Fit to margins</div>
          <div style={{ fontSize: 9, color: D.txd, fontWeight: 600, marginTop: 1 }}>
            Crops bottom · {pageW}×{fitH}
          </div>
        </div>
      </button>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 5, marginBottom: 8 }}>
        {TABLE_PAGE_PRESETS.map((p) => {
          const active = p.w === pageW && p.h === pageH;
          return (
            <button
              key={p.id}
              onClick={() => onChange(p.w, p.h)}
              style={{
                padding: "7px 9px",
                background: active ? D.amber + "1F" : "transparent",
                color: active ? D.amber : D.tx,
                border: "1px solid " + (active ? D.amber + "66" : D.border),
                borderRadius: 6, cursor: "pointer",
                fontFamily: mn, fontSize: 10.5, fontWeight: 700, letterSpacing: 0.4,
                textAlign: "left",
              }}
            >
              <div style={{ marginBottom: 2 }}>{p.label}</div>
              <div style={{ fontSize: 9, color: active ? D.amber : D.txd, fontWeight: 600 }}>
                {p.w}×{p.h}
              </div>
            </button>
          );
        })}
      </div>
      <DimSlider
        label="Width"
        value={pageW}
        min={400} max={4000} step={10}
        onChange={(v) => onChange(v, pageH)}
      />
      <DimSlider
        label="Height"
        value={pageH}
        min={300} max={4000} step={10}
        onChange={(v) => onChange(pageW, v)}
      />
    </div>
  );
}

// Width / Height control combining a range slider, a number input,
// and mouse-wheel scroll-to-tune. Scrolling the slider OR the readout
// nudges the value by `step`; shift-scroll nudges by 10×.
function DimSlider({ label, value, min, max, step, onChange }: {
  label: string;
  value: number; min: number; max: number; step: number;
  onChange: (v: number) => void;
}) {
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const dir = e.deltaY < 0 ? 1 : -1;
    const mag = e.shiftKey ? step * 10 : step;
    onChange(Math.max(min, Math.min(max, value + dir * mag)));
  };
  return (
    <div style={{ marginTop: 6 }} onWheel={handleWheel}>
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "baseline",
        marginBottom: 4,
        fontFamily: mn, fontSize: 9.5, color: D.txm, letterSpacing: 0.5,
        textTransform: "uppercase", fontWeight: 700,
      }}>
        <span>{label}</span>
        <input
          type="number"
          value={value}
          min={min}
          max={max}
          step={step}
          onChange={(e) => onChange(Math.max(min, Math.min(max, Number(e.target.value))))}
          style={{
            width: 70, padding: "2px 6px",
            background: D.bg, color: D.tx,
            border: "1px solid " + D.border, borderRadius: 4,
            fontFamily: mn, fontSize: 11, fontWeight: 800,
            textAlign: "right", outline: "none",
          }}
        />
      </div>
      <input
        type="range"
        min={min} max={max} step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ width: "100%", accentColor: D.amber }}
      />
    </div>
  );
}

// Labeled range slider with a live percent readout. Goes 60%-200% so
// "Table text" can grow larger than canvas for a punchier read. Wire-
// disabled state inherits parent dim when autoFontScale is on.
function FontScaleSlider({ label, value, disabled, onChange }: {
  label: string;
  value: number;
  disabled?: boolean;
  onChange: (v: number) => void;
}) {
  const pct = Math.round(value * 100);
  return (
    <div style={{ marginTop: 8, opacity: disabled ? 0.45 : 1 }}>
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "baseline",
        marginBottom: 4,
        fontFamily: mn, fontSize: 9.5, color: D.txm, letterSpacing: 0.5,
        textTransform: "uppercase", fontWeight: 700,
      }}>
        <span>{label}</span>
        <span style={{ color: D.tx, fontSize: 10, fontWeight: 800 }}>{pct}%</span>
      </div>
      <input
        type="range"
        min={50} max={220} step={2}
        value={pct}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value) / 100)}
        style={{ width: "100%", accentColor: D.amber }}
      />
    </div>
  );
}

function FooterToggle({ label, checked, onChange }: {
  label: string; checked: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <label style={{
      display: "flex", alignItems: "center", gap: 8,
      padding: "5px 0",
      cursor: "pointer",
      fontFamily: mn, fontSize: 10.5, color: D.tx, letterSpacing: 0.3,
    }}>
      <span
        onClick={() => onChange(!checked)}
        style={{
          display: "inline-flex", alignItems: "center", justifyContent: checked ? "flex-end" : "flex-start",
          width: 28, height: 16,
          background: checked ? D.amber : D.border,
          borderRadius: 999, padding: 2,
          transition: "background 0.12s, justify-content 0.12s",
        }}
      >
        <span style={{ width: 12, height: 12, background: "#FFFFFF", borderRadius: "50%" }} />
      </span>
      {label}
    </label>
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
  const [chromeOpen, setChromeOpen] = useState(true);
  const [styleOpen, setStyleOpen] = useState(false);
  const [pageOpen, setPageOpen] = useState(false);
  const [typoOpen, setTypoOpen] = useState(false);
  const [footerOpen, setFooterOpen] = useState(false);
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
      <PanelSection label="Chrome style" open={chromeOpen} onToggle={() => setChromeOpen(v => !v)}>
        <ChromePicker value={state.chromeStyle} onChange={(v) => update({ chromeStyle: v })} />
      </PanelSection>
      <PanelSection label="Decorations" open={styleOpen} onToggle={() => setStyleOpen(v => !v)}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "6px 10px 10px" }}>
          <FooterToggle
            label="Brand stripe at top"
            checked={!state.hideTopStripe}
            onChange={(v) => update({ hideTopStripe: !v })}
          />
          <FooterToggle
            label="Alternate row stripe"
            checked={state.showRowStripe}
            onChange={(v) => update({ showRowStripe: v })}
          />
          <Field label="Column divider">
            <DividerStylePicker
              value={state.dividerStyle}
              onChange={(v) => update({ dividerStyle: v })}
            />
          </Field>
        </div>
      </PanelSection>
      <PanelSection label="Canvas size" open={pageOpen} onToggle={() => setPageOpen(v => !v)}>
        <PageDimensionPicker
          pageW={state.pageW}
          pageH={state.pageH}
          sheet={state.sheet}
          chromeStyle={state.chromeStyle}
          keyInsight={state.keyInsight}
          aggregate={state.aggregate}
          source={state.source}
          fontScale={state.autoFontScale ? Math.max(0.6, Math.min(1.6, Math.min(state.pageW / SA_TABLE_WIDTH, state.pageH / SA_TABLE_HEIGHT))) : state.fontScale}
          onChange={(w, h) => update({ pageW: w, pageH: h })}
        />
      </PanelSection>
      <PanelSection label="Typography" open={typoOpen} onToggle={() => setTypoOpen(v => !v)}>
        <div style={{ padding: "6px 10px 10px" }}>
          <FooterToggle
            label="Auto-scale to canvas"
            checked={state.autoFontScale}
            onChange={(v) => update({ autoFontScale: v })}
          />
          <FooterToggle
            label="Lock table dimensions"
            checked={state.lockTableDimensions}
            onChange={(v) => update({ lockTableDimensions: v })}
          />
          <div style={{ fontFamily: mn, fontSize: 9, color: D.txd, padding: "2px 0 8px", letterSpacing: 0.4 }}>
            When locked, only text inside the table grows / shrinks —
            row + header heights stay fixed.
          </div>
          <FontScaleSlider
            label="Title text"
            value={state.titleFontScale}
            disabled={state.autoFontScale}
            onChange={(v) => update({ titleFontScale: v })}
          />
          <FontScaleSlider
            label="Table text"
            value={state.bodyFontScale}
            disabled={state.autoFontScale}
            onChange={(v) => update({ bodyFontScale: v })}
          />
        </div>
      </PanelSection>
      <PanelSection label="Footer / Source" open={footerOpen} onToggle={() => setFooterOpen(v => !v)}>
        <Field label="Source line">
          <TextInput
            value={state.source}
            onChange={(v) => update({ source: v })}
            placeholder="Source: SemiAnalysis estimates"
          />
        </Field>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: "4px 10px 10px" }}>
          <FooterToggle
            label="Show SEMIANALYSIS.COM"
            checked={!state.hideWebsite}
            onChange={(v) => update({ hideWebsite: !v })}
          />
          <FooterToggle
            label="Show CONFIDENTIAL"
            checked={!state.hideConfidential}
            onChange={(v) => update({ hideConfidential: !v })}
          />
        </div>
      </PanelSection>
      <PanelSection label="Header" open={headerOpen} onToggle={() => setHeaderOpen(v => !v)}>
        <Field label="Category eyebrow">
          <TextInput value={state.category} onChange={(v) => update({ category: v })} placeholder="SEMIANALYSIS — RESEARCH" />
        </Field>
        <ColorTaggedField
          label="Title (white)"
          tagColor={state.fieldStyles.titleWhite?.color || "#FFFFFF"}
          tagText="renders white"
        >
          <TextInput value={state.titleWhite} onChange={(v) => update({ titleWhite: v })} placeholder="Primary title" />
        </ColorTaggedField>
        <ColorTaggedField
          label="Title (amber accent)"
          tagColor={state.fieldStyles.titleAmber?.color || "#F7B041"}
          tagText="renders amber"
        >
          <TextInput value={state.titleAmber} onChange={(v) => update({ titleAmber: v })} placeholder="appended in amber" />
        </ColorTaggedField>
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

// Wrapper around Field that renders a small color-chip + label next to
// the title above the input. Lets the user see at a glance which color
// the field will render as ("title white" → white chip; amber accent
// → amber chip). The chip color is sourced from the active field
// style override so it stays accurate after the user re-colors.
function ColorTaggedField({ label, tagColor, tagText, children }: {
  label: string; tagColor: string; tagText: string; children: React.ReactNode;
}) {
  return (
    <div style={{ padding: "6px 10px 0" }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 5, marginBottom: 4,
        fontFamily: mn, fontSize: 9.5, color: D.txd, letterSpacing: 0.6,
        fontWeight: 700, textTransform: "uppercase",
      }}>
        <span>{label}</span>
        <span style={{
          display: "inline-flex", alignItems: "center", gap: 4,
          padding: "1px 7px",
          background: tagColor + "22",
          border: "1px solid " + tagColor + "66",
          borderRadius: 8,
          color: tagColor,
          fontSize: 8.5, fontWeight: 800,
        }}>
          <span style={{
            width: 7, height: 7, borderRadius: "50%",
            background: tagColor, border: "1px solid rgba(255,255,255,0.4)",
          }} />
          {tagText}
        </span>
      </div>
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
  onResizeColumn: (key: string, width: number) => void;
  onAddColumn: () => void;
  onDeleteColumn: (key: string) => void;
  onAddRow: () => void;
  onDeleteRow: (rowIdx: number) => void;
  onReorderRow: (fromIdx: number, toIdx: number) => void;
  onChangeColumnBadgeMap: (key: string, map: Record<string, string>) => void;
  onChangeColumnCondFmt: (key: string, mode: import("./studio-types").TableCondFmt) => void;
  onChangeColumnHeaderColor: (key: string, color: string | undefined) => void;
}

function DataGrid(p: DataGridProps) {
  const [dragRow, setDragRow] = useState<number | null>(null);
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
                onResize={(w) => p.onResizeColumn(col.key, w)}
                onChangeBadgeMap={(m) => p.onChangeColumnBadgeMap(col.key, m)}
                onChangeCondFmt={(m) => p.onChangeColumnCondFmt(col.key, m)}
                onChangeHeaderColor={(c) => p.onChangeColumnHeaderColor(col.key, c)}
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
            <tr key={ri}
              onDragOver={(e) => {
                if (dragRow == null || dragRow === ri) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
              }}
              onDrop={(e) => {
                if (dragRow == null) return;
                e.preventDefault();
                // Use cursor Y vs row midpoint to decide whether to land
                // above or below this row — feels like Notion / Linear.
                const rect = (e.currentTarget as HTMLTableRowElement).getBoundingClientRect();
                const below = e.clientY > rect.top + rect.height / 2;
                p.onReorderRow(dragRow, below ? ri + 1 : ri);
                setDragRow(null);
              }}
              style={{
                background: dragRow === ri ? D.amber + "11" : undefined,
                transition: "background 0.12s",
              }}
            >
              <td style={{
                width: 36, padding: "6px 4px",
                fontFamily: mn, fontSize: 10, color: D.txd,
                textAlign: "center", borderBottom: "1px solid " + D.border,
                position: "sticky", left: 0, background: D.card, zIndex: 1,
              }}>
                <div
                  draggable
                  onDragStart={(e) => {
                    setDragRow(ri);
                    e.dataTransfer.effectAllowed = "move";
                    e.dataTransfer.setData("text/plain", String(ri));
                  }}
                  onDragEnd={() => setDragRow(null)}
                  title="Drag to reorder"
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "center",
                    cursor: "grab", color: D.txd, height: 14, marginBottom: 2,
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = D.amber; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = D.txd; }}
                >
                  <GripHorizontal size={11} strokeWidth={2.2} />
                </div>
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
  onResize: (width: number) => void;
  onDelete: () => void;
  // Wave 3 — badge column type + conditional formatting.
  onChangeBadgeMap?: (map: Record<string, string>) => void;
  onChangeCondFmt?: (mode: import("./studio-types").TableCondFmt) => void;
  onChangeHeaderColor?: (color: string | undefined) => void;
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

  const thRef = useRef<HTMLTableCellElement | null>(null);
  const onResizeStart = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const startX = e.clientX;
    const startW = thRef.current?.getBoundingClientRect().width || 140;
    const onMove = (mv: MouseEvent) => {
      const w = startW + (mv.clientX - startX);
      p.onResize(w);
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  };

  return (
    <th
      ref={thRef}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      style={{
        padding: "6px 8px",
        borderBottom: "1px solid " + D.border,
        borderLeft: dragOver === "before" ? "2px solid " + D.amber : "1px solid " + D.border,
        borderRight: dragOver === "after" ? "2px solid " + D.amber : undefined,
        textAlign: "left",
        minWidth: 140,
        width: p.col.width,
        background: D.surface,
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
              <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
                {(["text", "number", "percent", "date", "badge"] as TableColumnType[]).map((t) => (
                  <button key={t}
                    onClick={() => p.onChangeType(t)}
                    style={{
                      flex: "1 1 30%", padding: "5px 6px",
                      background: p.col.type === t ? D.amber + "22" : "transparent",
                      border: "1px solid " + (p.col.type === t ? D.amber + "55" : D.border),
                      borderRadius: 4,
                      color: p.col.type === t ? D.amber : D.tx,
                      fontFamily: mn, fontSize: 9.5, fontWeight: 700, letterSpacing: 0.4,
                      cursor: "pointer", textTransform: "uppercase",
                    }}>{t}</button>
                ))}
              </div>
              {p.col.type === "badge" && p.onChangeBadgeMap && (
                <BadgeMapEditor
                  value={p.col.badgeMap || {}}
                  onChange={p.onChangeBadgeMap}
                />
              )}
              {(p.col.type === "number" || p.col.type === "percent") && p.onChangeCondFmt && (
                <CondFmtPicker
                  value={p.col.condFmt || "off"}
                  onChange={p.onChangeCondFmt}
                />
              )}
              {p.onChangeHeaderColor && (
                <HeaderColorPicker
                  value={p.col.headerColor}
                  onChange={p.onChangeHeaderColor}
                />
              )}
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
      {/* Width-resize handle on the right edge — 5px hit area, amber
          on hover. Pulls the column to whatever width the cursor lands
          at while the mouse is held. */}
      <div
        onMouseDown={onResizeStart}
        title="Drag to resize column"
        style={{
          position: "absolute", top: 0, right: -2, width: 5, height: "100%",
          cursor: "col-resize", zIndex: 3, background: "transparent",
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = D.amber + "55"; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
      />
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

// Brand-color picker for badge values. Each row binds a string value
// (e.g. "GA", "Sampling", "EOL") to a hex color. The renderer uses
// these to draw colored pills in the table cell.
function BadgeMapEditor({ value, onChange }: {
  value: Record<string, string>;
  onChange: (next: Record<string, string>) => void;
}) {
  const palette = [
    { label: "Amber",  hex: "#F7B041" },
    { label: "Blue",   hex: "#0B86D1" },
    { label: "Teal",   hex: "#2EAD8E" },
    { label: "Coral",  hex: "#E06347" },
    { label: "Violet", hex: "#905CCB" },
    { label: "Grey",   hex: "#5C6370" },
  ];
  const [newVal, setNewVal] = useState("");
  const entries = Object.entries(value);
  return (
    <>
      <ColumnMenuLabel>Badge colors</ColumnMenuLabel>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {entries.map(([v, c]) => (
          <div key={v} style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{
              flex: 1, fontFamily: mn, fontSize: 10.5, color: D.tx, fontWeight: 700,
              padding: "2px 6px",
              background: c + "1A", border: "1px solid " + c + "55",
              borderRadius: 4, letterSpacing: 0.4,
            }}>{v}</span>
            <div style={{ display: "flex", gap: 2 }}>
              {palette.map((p) => (
                <button key={p.hex}
                  onClick={() => onChange({ ...value, [v]: p.hex })}
                  title={p.label}
                  style={{
                    width: 14, height: 14, padding: 0,
                    background: p.hex,
                    border: p.hex === c ? "2px solid #FFF" : "1px solid rgba(255,255,255,0.25)",
                    borderRadius: "50%", cursor: "pointer",
                  }}
                />
              ))}
            </div>
            <button
              onClick={() => {
                const next = { ...value };
                delete next[v];
                onChange(next);
              }}
              title="Remove mapping"
              style={{ background: "transparent", border: "none", color: D.txd, cursor: "pointer", padding: 2 }}
            ><X size={10} strokeWidth={2.4} /></button>
          </div>
        ))}
        <div style={{ display: "flex", gap: 4 }}>
          <input
            value={newVal}
            onChange={(e) => setNewVal(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && newVal.trim()) {
                onChange({ ...value, [newVal.trim()]: "#5C6370" });
                setNewVal("");
              }
            }}
            placeholder="New value (e.g. GA)"
            style={{
              flex: 1, padding: "4px 7px",
              background: D.bg, color: D.tx,
              border: "1px solid " + D.border, borderRadius: 4,
              fontFamily: mn, fontSize: 10.5, outline: "none",
            }}
          />
          <button
            onClick={() => {
              if (newVal.trim()) {
                onChange({ ...value, [newVal.trim()]: "#5C6370" });
                setNewVal("");
              }
            }}
            style={{
              padding: "4px 9px",
              background: D.amber + "22", color: D.amber,
              border: "1px solid " + D.amber + "55", borderRadius: 4,
              fontFamily: mn, fontSize: 9.5, fontWeight: 700, letterSpacing: 0.4,
              cursor: "pointer", textTransform: "uppercase",
            }}>Add</button>
        </div>
      </div>
    </>
  );
}

function CondFmtPicker({ value, onChange }: {
  value: import("./studio-types").TableCondFmt;
  onChange: (v: import("./studio-types").TableCondFmt) => void;
}) {
  const options: { id: import("./studio-types").TableCondFmt; label: string; blurb: string }[] = [
    { id: "off",      label: "Off",         blurb: "Plain text"                 },
    { id: "minMax",   label: "High = good", blurb: "Max green · min red"        },
    { id: "highGood", label: "Low = good",  blurb: "Min green · max red (cost)" },
  ];
  return (
    <>
      <ColumnMenuLabel>Conditional formatting</ColumnMenuLabel>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 3 }}>
        {options.map((o) => {
          const active = o.id === value;
          return (
            <button key={o.id}
              onClick={() => onChange(o.id)}
              title={o.blurb}
              style={{
                padding: "5px 4px",
                background: active ? D.amber + "22" : "transparent",
                border: "1px solid " + (active ? D.amber + "55" : D.border),
                borderRadius: 4,
                color: active ? D.amber : D.tx,
                fontFamily: mn, fontSize: 9, fontWeight: 700, letterSpacing: 0.4,
                cursor: "pointer", textTransform: "uppercase",
              }}>{o.label}</button>
          );
        })}
      </div>
    </>
  );
}

// Per-column header tint. Six brand swatches + a "clear" pill that
// resets to the chrome default. Used to mimic the GB300 Power Budget
// look where each column header is its own color.
function HeaderColorPicker({ value, onChange }: {
  value: string | undefined;
  onChange: (color: string | undefined) => void;
}) {
  const palette = [
    { label: "Amber",  hex: "#F7B041" },
    { label: "Blue",   hex: "#0B86D1" },
    { label: "Teal",   hex: "#2EAD8E" },
    { label: "Coral",  hex: "#E06347" },
    { label: "Violet", hex: "#905CCB" },
    { label: "Cyan",   hex: "#26C9D8" },
  ];
  return (
    <>
      <ColumnMenuLabel>Header tint</ColumnMenuLabel>
      <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
        {palette.map((p) => {
          const active = value?.toUpperCase() === p.hex.toUpperCase();
          return (
            <button key={p.hex}
              onClick={() => onChange(p.hex)}
              title={p.label}
              style={{
                width: 16, height: 16, padding: 0,
                background: p.hex,
                border: active ? "2px solid #FFF" : "1px solid rgba(255,255,255,0.25)",
                borderRadius: "50%", cursor: "pointer",
                boxShadow: active ? "0 0 0 2px " + D.amber + "AA" : "none",
              }}
            />
          );
        })}
        {value && (
          <button onClick={() => onChange(undefined)}
            title="Clear"
            style={{
              marginLeft: 4, padding: "3px 7px",
              background: "transparent", color: D.txm,
              border: "1px solid " + D.border, borderRadius: 4,
              fontFamily: mn, fontSize: 9.5, fontWeight: 700, letterSpacing: 0.4,
              cursor: "pointer", textTransform: "uppercase",
            }}
          >clear</button>
        )}
      </div>
    </>
  );
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

// Brand-only swatch palette for the inline text-format toolbar. Plain
// white is the default; the other 5 colors are SA spectrum accents.
const BRAND_SWATCHES: { label: string; value: string }[] = [
  { label: "white",  value: "#FFFFFF" },
  { label: "amber",  value: "#F7B041" },
  { label: "blue",   value: "#0B86D1" },
  { label: "teal",   value: "#2EAD8E" },
  { label: "coral",  value: "#E06347" },
  { label: "violet", value: "#905CCB" },
];

// Fields whose styling actually flows into the SVG renderer. Other
// editable fields (titleBar, keyInsight, etc.) accept clicks for inline
// edit but don't honor per-field color overrides yet — for those we
// still show the toolbar but flag the swatches as inactive.
const STYLED_FIELDS: ReadonlySet<EditableField> = new Set([
  "category", "titleWhite", "titleAmber", "subtitle",
] as EditableField[]);

// Direct-on-preview cell editor. The renderer emits a transparent
// <rect data-cell="row:colKey"> over each cell; we look it up by
// querySelector to compute the pixel rect for our HTML input.
function CellEditOverlay({ previewEl, row, colKey, sheet, onCommit, onCancel }: {
  previewEl: HTMLDivElement;
  row: number;
  colKey: string;
  sheet: TableSheet;
  onCommit: (value: string) => void;
  onCancel: () => void;
}) {
  const col = useMemo(() => sheet.schema.find((c) => c.key === colKey), [sheet.schema, colKey]);
  const initialValue = useMemo(() => {
    const v = sheet.rows[row]?.[colKey];
    return v == null ? "" : String(v);
  }, [sheet.rows, row, colKey]);
  const [draft, setDraft] = useState(initialValue);
  useEffect(() => setDraft(initialValue), [initialValue]);

  const [rect, setRect] = useState<{ left: number; top: number; width: number; height: number }>(() =>
    computeCellRect(previewEl, row, colKey));

  useEffect(() => {
    const update = () => setRect(computeCellRect(previewEl, row, colKey));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(previewEl);
    window.addEventListener("scroll", update, true);
    return () => {
      ro.disconnect();
      window.removeEventListener("scroll", update, true);
    };
  }, [previewEl, row, colKey]);

  const isNumeric = col?.type === "number" || col?.type === "percent";
  const commit = () => onCommit(draft);

  return (
    <div style={{
      position: "absolute",
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
      zIndex: 30,
    }}>
      <input
        autoFocus
        type={isNumeric ? "text" : "text"}
        inputMode={isNumeric ? "decimal" : "text"}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Escape") { e.preventDefault(); onCancel(); }
          if (e.key === "Enter")  { e.preventDefault(); commit(); }
        }}
        style={{
          width: "100%", height: "100%", boxSizing: "border-box",
          background: "rgba(10,12,18,0.92)",
          border: "1px solid #F7B041",
          borderRadius: 4,
          color: "#E8E4DD",
          fontFamily: "'Outfit', sans-serif",
          fontWeight: 700,
          fontSize: 15,
          textAlign: "center",
          padding: "0 8px",
          outline: "none",
          boxShadow: "0 0 0 3px rgba(247,176,65,0.18)",
        }}
      />
    </div>
  );
}

// Canva-style floating contextual toolbar. Locks above the topmost-
// leftmost selected cell and reflows as the selection grows. Hovers
// in front of the preview so it never has to share rail real estate
// with the right panel.
function AnnotationToolbar({ previewEl, selection, currentStyles, onApply, onSelectColumn, onSelectRow, onClear, onClose }: {
  previewEl: HTMLDivElement;
  selection: Set<string>;
  currentStyles: Record<string, import("./studio-types").CellStyle>;
  onApply: (patch: Partial<import("./studio-types").CellStyle>) => void;
  onSelectColumn: () => void;
  onSelectRow: () => void;
  onClear: () => void;
  onClose: () => void;
}) {
  const [pos, setPos] = useState<{ left: number; top: number; width: number }>(() => computeAnchor(previewEl, selection));
  useEffect(() => {
    const update = () => setPos(computeAnchor(previewEl, selection));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(previewEl);
    window.addEventListener("scroll", update, true);
    return () => { ro.disconnect(); window.removeEventListener("scroll", update, true); };
  }, [previewEl, selection]);

  // Best-effort "current style" — what the first selected cell has —
  // so the swatch indicators reflect reality when only one cell is
  // selected. For multi-select, the toolbar simply applies whatever
  // the user picks.
  const firstKey = selection.values().next().value as string | undefined;
  const cur = firstKey ? currentStyles[firstKey] : undefined;

  const swatches = [
    { label: "Amber",  hex: "#F7B041" },
    { label: "Blue",   hex: "#0B86D1" },
    { label: "Teal",   hex: "#2EAD8E" },
    { label: "Coral",  hex: "#E06347" },
    { label: "Violet", hex: "#905CCB" },
    { label: "White",  hex: "#FFFFFF" },
  ];

  // Position the toolbar above the selection when there's room, below
  // when it would overflow the top of the preview.
  const above = pos.top > 56;
  const top = above ? pos.top - 50 : pos.top + 36;

  return (
    <div
      onMouseDown={(e) => e.stopPropagation()}
      style={{
        position: "absolute",
        left: Math.max(8, pos.left - 6),
        top,
        zIndex: 40,
        display: "flex", alignItems: "center", gap: 4,
        padding: "5px 8px",
        background: "rgba(20,22,28,0.94)",
        backdropFilter: "blur(8px)",
        border: "1px solid " + D.border,
        borderRadius: 999,
        boxShadow: "0 12px 28px rgba(0,0,0,0.6)",
        fontFamily: mn, fontSize: 10, fontWeight: 700, letterSpacing: 0.3,
        color: D.tx,
        whiteSpace: "nowrap",
      }}
    >
      <span style={{ color: D.amber, padding: "0 6px 0 2px", fontSize: 9.5 }}>
        {selection.size} cell{selection.size === 1 ? "" : "s"}
      </span>
      <span style={{ width: 1, height: 16, background: D.border, margin: "0 2px" }} />

      <span style={{ color: D.txd, fontSize: 9, padding: "0 4px" }}>FILL</span>
      {swatches.map((s) => (
        <button key={"bg" + s.hex}
          onClick={() => onApply({ bg: cur?.bg === s.hex ? undefined : s.hex })}
          title={"Fill · " + s.label}
          style={{
            width: 16, height: 16, padding: 0,
            borderRadius: "50%", cursor: "pointer",
            background: s.hex,
            border: cur?.bg?.toUpperCase() === s.hex.toUpperCase() ? "2px solid #FFF" : "1px solid rgba(255,255,255,0.25)",
          }}
        />
      ))}
      <button
        onClick={() => onApply({ bg: undefined })}
        title="No fill"
        style={pillIconBtn()}
      >∅</button>

      <span style={{ width: 1, height: 16, background: D.border, margin: "0 2px" }} />
      <span style={{ color: D.txd, fontSize: 9, padding: "0 4px" }}>TEXT</span>
      {swatches.map((s) => (
        <button key={"tx" + s.hex}
          onClick={() => onApply({ color: cur?.color === s.hex ? undefined : s.hex })}
          title={"Text · " + s.label}
          style={{
            width: 16, height: 16, padding: 0,
            borderRadius: 3, cursor: "pointer",
            background: s.hex,
            border: cur?.color?.toUpperCase() === s.hex.toUpperCase() ? "2px solid #FFF" : "1px solid rgba(255,255,255,0.25)",
          }}
        />
      ))}

      <span style={{ width: 1, height: 16, background: D.border, margin: "0 2px" }} />
      <button onClick={() => onApply({ bold: !cur?.bold })}
        title="Bold"
        style={{
          ...pillIconBtn(),
          background: cur?.bold ? D.amber + "33" : "transparent",
          color: cur?.bold ? D.amber : D.tx,
          fontWeight: 900,
        }}
      >B</button>

      <span style={{ width: 1, height: 16, background: D.border, margin: "0 2px" }} />
      <span style={{ color: D.txd, fontSize: 9, padding: "0 4px" }}>BORDER</span>
      {(["solid", "dotted", "dashed"] as const).map((k) => (
        <button key={k}
          onClick={() => onApply({ border: cur?.border === k ? undefined : k, borderColor: cur?.borderColor || "#F7B041" })}
          title={k}
          style={{
            ...pillIconBtn(),
            background: cur?.border === k ? D.amber + "33" : "transparent",
            color: cur?.border === k ? D.amber : D.tx,
          }}
        >{k === "solid" ? "━" : k === "dotted" ? "···" : "- -"}</button>
      ))}
      <button onClick={() => onApply({ border: undefined, borderColor: undefined })}
        title="No border"
        style={pillIconBtn()}
      >∅</button>

      <span style={{ width: 1, height: 16, background: D.border, margin: "0 2px" }} />
      <button onClick={onSelectRow}    title="Expand to row"    style={pillTextBtn()}>+ Row</button>
      <button onClick={onSelectColumn} title="Expand to column" style={pillTextBtn()}>+ Col</button>
      <button onClick={onClear}        title="Clear selection"   style={pillTextBtn()}>Clear</button>

      <span style={{ width: 1, height: 16, background: D.border, margin: "0 2px" }} />
      <button onClick={onClose} title="Exit annotate mode"
        style={{ ...pillIconBtn(), color: D.coral }}>×</button>
    </div>
  );
}

function pillIconBtn(): React.CSSProperties {
  return {
    width: 22, height: 22, padding: 0,
    display: "inline-flex", alignItems: "center", justifyContent: "center",
    background: "transparent", color: D.tx,
    border: "1px solid transparent", borderRadius: 999,
    cursor: "pointer", fontFamily: mn, fontSize: 11, fontWeight: 700,
  };
}
function pillTextBtn(): React.CSSProperties {
  return {
    padding: "3px 8px",
    display: "inline-flex", alignItems: "center",
    background: "transparent", color: D.txm,
    border: "1px solid " + D.border, borderRadius: 999,
    cursor: "pointer", fontFamily: mn, fontSize: 9.5, fontWeight: 700, letterSpacing: 0.4,
    textTransform: "uppercase",
  };
}

// Find the bounding box around every selected cell hit-zone and
// return the anchor point (top-left + width).
function computeAnchor(previewEl: HTMLDivElement, selection: Set<string>): { left: number; top: number; width: number } {
  const previewRect = previewEl.getBoundingClientRect();
  let minLeft = Infinity, minTop = Infinity, maxRight = -Infinity;
  selection.forEach((key) => {
    const [row, col] = key.split(":");
    const el = previewEl.querySelector<SVGRectElement>(`rect[data-cell="${row}:${col}"]`);
    if (!el) return;
    const r = el.getBoundingClientRect();
    if (r.left < minLeft) minLeft = r.left;
    if (r.top  < minTop)  minTop  = r.top;
    if (r.right > maxRight) maxRight = r.right;
  });
  if (minLeft === Infinity) return { left: 12, top: 12, width: 200 };
  return {
    left:  minLeft - previewRect.left,
    top:   minTop  - previewRect.top,
    width: maxRight - minLeft,
  };
}

// Find the hit-zone <rect data-cell="row:colKey"> and translate its
// bounding box into pixel coords relative to the preview container.
function computeCellRect(previewEl: HTMLDivElement, row: number, colKey: string): { left: number; top: number; width: number; height: number } {
  const el = previewEl.querySelector<SVGRectElement>(`rect[data-cell="${row}:${colKey}"]`);
  if (!el) return { left: 0, top: 0, width: 0, height: 0 };
  const elRect = el.getBoundingClientRect();
  const previewRect = previewEl.getBoundingClientRect();
  return {
    left: elRect.left - previewRect.left,
    top:  elRect.top  - previewRect.top,
    width: elRect.width,
    height: elRect.height,
  };
}

function InlineEditOverlay({ field, previewEl, value, style, onCommit, onCancel, onStyleChange }: {
  field: EditableField;
  previewEl: HTMLDivElement;
  value: string;
  style?: FieldStyle;
  onCommit: (v: string) => void;
  onCancel: () => void;
  onStyleChange?: (next: FieldStyle | undefined) => void;
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

  const styleable = STYLED_FIELDS.has(field);
  const applyStyle = (patch: Partial<FieldStyle>) => {
    if (!onStyleChange) return;
    const next: FieldStyle = { ...(style || {}), ...patch };
    // Strip defaults so the saved payload stays minimal.
    const clean: FieldStyle = {};
    if (next.color) clean.color = next.color;
    if (next.size != null) clean.size = next.size;
    if (next.align) clean.align = next.align;
    onStyleChange(Object.keys(clean).length ? clean : undefined);
  };

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
      {/* Format toolbar — floats above the input. Color swatch +
          size +/-. Only takes effect when the field's renderer
          honors per-field overrides (currently the header fields). */}
      {onStyleChange && (
        <div
          onMouseDown={(e) => e.preventDefault()}
          style={{
            position: "absolute",
            left: 0, bottom: "100%",
            marginBottom: 6,
            display: "flex", alignItems: "center", gap: 6,
            padding: "5px 8px",
            background: "#0A0C10",
            border: "1px solid " + D.border, borderRadius: 999,
            boxShadow: "0 8px 22px rgba(0,0,0,0.6)",
            whiteSpace: "nowrap",
            opacity: styleable ? 1 : 0.55,
          }}
          title={styleable ? "" : "This field's renderer doesn't honor per-field color yet"}
        >
          {BRAND_SWATCHES.map((s) => {
            const active = (style?.color || "").toUpperCase() === s.value.toUpperCase();
            return (
              <button
                key={s.value}
                onClick={(e) => { e.stopPropagation(); applyStyle({ color: s.value }); }}
                title={s.label}
                style={{
                  width: 18, height: 18, padding: 0,
                  borderRadius: "50%",
                  background: s.value,
                  border: active ? "2px solid #FFF" : "1px solid rgba(255,255,255,0.25)",
                  cursor: "pointer",
                  outline: "none",
                }}
              />
            );
          })}
          <span style={{ width: 1, height: 16, background: D.border, margin: "0 2px" }} />
          <button
            onClick={(e) => { e.stopPropagation(); applyStyle({ size: Math.max(10, (style?.size ?? rect.fontSize) - 2) }); }}
            style={pillBtn()}
            title="Smaller"
          ><Minus size={11} strokeWidth={2.4} /></button>
          <span style={{ fontFamily: mn, fontSize: 10, color: D.txm, minWidth: 24, textAlign: "center" }}>
            {Math.round(style?.size ?? rect.fontSize)}
          </span>
          <button
            onClick={(e) => { e.stopPropagation(); applyStyle({ size: Math.min(72, (style?.size ?? rect.fontSize) + 2) }); }}
            style={pillBtn()}
            title="Larger"
          ><Plus size={11} strokeWidth={2.4} /></button>
          {(style?.color || style?.size != null) && (
            <>
              <span style={{ width: 1, height: 16, background: D.border, margin: "0 2px" }} />
              <button
                onClick={(e) => { e.stopPropagation(); if (onStyleChange) onStyleChange(undefined); }}
                style={pillBtn()}
                title="Reset to default"
              ><X size={11} strokeWidth={2.4} /></button>
            </>
          )}
        </div>
      )}
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

function pillBtn(): React.CSSProperties {
  return {
    width: 22, height: 22, padding: 0,
    display: "inline-flex", alignItems: "center", justifyContent: "center",
    background: "transparent", color: D.tx,
    border: "1px solid " + D.border, borderRadius: 999,
    cursor: "pointer",
  };
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
