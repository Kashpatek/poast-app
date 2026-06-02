"use client";

// TableEditor · standalone editable grid for table docs.
//
// Lean in-house grid — keystroke-direct edits, add/remove rows + columns,
// per-column type, CSV/Markdown export. "Build chart from this" mints a
// new chart doc seeded with this sheet (via onBuildChart callback that the
// Studio shell wires up to newDocFromTemplate).
//
// Univer (Excel Suite) integration lands as a follow-up — the engine field
// is already roundtripped so flipping it on later is non-breaking.

import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, X, Download, FileText, BarChart3, ChevronDown } from "lucide-react";
import { showToast } from "../toast-context";
import {
  blankRow, coerce, newColumnKey, templateSheet, toCsv, toMarkdown,
} from "./lib/data-sheet";
import { D, ft, gf, mn } from "./studio-theme";
import {
  StudioDoc, TableCellValue, TableColumnType, TableDocPayload, TableSheet,
} from "./studio-types";

interface TableEditorProps {
  doc: StudioDoc;
  onChangePayload: (payload: unknown) => void;
  onBuildChart?: (sheet: TableSheet, name: string) => void;
}

export default function TableEditor({ doc, onChangePayload, onBuildChart }: TableEditorProps) {
  const initial = useMemo(() => readPayload(doc.payload), [doc.payload]);
  const [sheet, setSheet] = useState<TableSheet>(initial.sheet);
  const [engine] = useState<"standard" | "univer">(initial.engine);

  // Emit upstream debounced — every state change rebuilds the payload and
  // the shell debounces the save. Keep dependencies tight so we don't fire
  // on unrelated re-renders (none of the chrome state lives here).
  useEffect(() => {
    const payload: TableDocPayload = {
      kind: "table",
      version: 1,
      engine,
      sheet,
    };
    onChangePayload(payload);
  }, [sheet, engine, onChangePayload]);

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
    setSheet((cur) => ({
      ...cur,
      schema: cur.schema.map(c => c.key === key ? { ...c, label } : c),
    }));
  }, []);

  const setColumnType = useCallback((key: string, type: TableColumnType) => {
    setSheet((cur) => ({
      ...cur,
      schema: cur.schema.map(c => c.key === key ? { ...c, type } : c),
      // Re-coerce existing values so downstream consumers see consistent
      // types after the change.
      rows: cur.rows.map(r => ({
        ...r,
        [key]: type === "text"
          ? (r[key] == null ? "" : String(r[key]))
          : coerce(String(r[key] ?? ""), type),
      })),
    }));
  }, []);

  const addColumn = useCallback(() => {
    setSheet((cur) => {
      const k = newColumnKey(cur.schema);
      const col = { key: k, label: "Column", type: "number" as const };
      return {
        schema: [...cur.schema, col],
        rows: cur.rows.map(r => ({ ...r, [k]: 0 })),
      };
    });
  }, []);

  const deleteColumn = useCallback((key: string) => {
    setSheet((cur) => {
      if (cur.schema.length <= 1) return cur;
      return {
        schema: cur.schema.filter(c => c.key !== key),
        rows: cur.rows.map(r => {
          const n = { ...r };
          delete n[key];
          return n;
        }),
      };
    });
  }, []);

  const addRow = useCallback(() => {
    setSheet((cur) => ({ ...cur, rows: [...cur.rows, blankRow(cur.schema)] }));
  }, []);

  const deleteRow = useCallback((rowIdx: number) => {
    setSheet((cur) => ({ ...cur, rows: cur.rows.filter((_, i) => i !== rowIdx) }));
  }, []);

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
      showToast("Markdown table copied");
    } catch {
      showToast("Copy failed — try CSV instead");
    }
  }, [sheet]);

  return (
    <div style={{ maxWidth: 1180, margin: "0 auto", padding: "28px 24px 100px" }}>
      <Toolbar
        onAddRow={addRow}
        onAddColumn={addColumn}
        onExportCsv={exportCsv}
        onCopyMarkdown={copyMarkdown}
        onBuildChart={onBuildChart ? () => onBuildChart(sheet, doc.name) : undefined}
      />
      <div style={{
        marginTop: 14,
        background: D.card, border: "1px solid " + D.border, borderRadius: 12,
        overflow: "hidden", boxShadow: "0 12px 30px rgba(0,0,0,0.3)",
      }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ borderCollapse: "separate", borderSpacing: 0, width: "100%", minWidth: 600 }}>
            <thead>
              <tr style={{ background: D.surface }}>
                <th style={{
                  width: 36, padding: "8px 6px", borderBottom: "1px solid " + D.border,
                  position: "sticky", left: 0, background: D.surface, zIndex: 2,
                }}></th>
                {sheet.schema.map((col) => (
                  <ColumnHeader
                    key={col.key}
                    col={col}
                    onRename={(label) => renameColumn(col.key, label)}
                    onChangeType={(type) => setColumnType(col.key, type)}
                    onDelete={sheet.schema.length > 1 ? () => deleteColumn(col.key) : undefined}
                  />
                ))}
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
                    <button
                      onClick={() => deleteRow(ri)}
                      title="Delete row"
                      style={{
                        background: "transparent", border: "none",
                        color: D.txd, cursor: "pointer",
                        fontFamily: mn, fontSize: 11,
                        padding: 0,
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.color = D.coral; }}
                      onMouseLeave={(e) => { e.currentTarget.style.color = D.txd; }}
                    >×</button>
                    <div style={{ fontSize: 9, color: D.txd, lineHeight: 1, marginTop: 2 }}>{ri + 1}</div>
                  </td>
                  {sheet.schema.map((col) => (
                    <Cell
                      key={col.key}
                      value={row[col.key]}
                      type={col.type}
                      onCommit={(v) => updateCell(ri, col.key, v)}
                    />
                  ))}
                </tr>
              ))}
              <tr>
                <td colSpan={sheet.schema.length + 1} style={{ padding: 0 }}>
                  <button
                    onClick={addRow}
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      background: "transparent", border: "none",
                      color: D.txd, fontFamily: mn, fontSize: 10.5, letterSpacing: 1,
                      textTransform: "uppercase", fontWeight: 700,
                      cursor: "pointer",
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
      </div>
      <div style={{
        marginTop: 8, fontFamily: mn, fontSize: 10, color: D.txd, letterSpacing: 0.5,
      }}>
        {sheet.rows.length} row{sheet.rows.length === 1 ? "" : "s"} ·{" "}
        {sheet.schema.length} column{sheet.schema.length === 1 ? "" : "s"}
      </div>
    </div>
  );
}

function readPayload(payload: unknown): { sheet: TableSheet; engine: "standard" | "univer" } {
  if (payload && typeof payload === "object") {
    const p = payload as Partial<TableDocPayload>;
    const sheet = p.sheet && p.sheet.schema?.length ? p.sheet : templateSheet(p.templateId);
    const engine = p.engine === "univer" ? "univer" : "standard";
    return { sheet, engine };
  }
  return { sheet: templateSheet(undefined), engine: "standard" };
}

function Toolbar({ onAddRow, onAddColumn, onExportCsv, onCopyMarkdown, onBuildChart }: {
  onAddRow: () => void;
  onAddColumn: () => void;
  onExportCsv: () => void;
  onCopyMarkdown: () => void;
  onBuildChart?: () => void;
}) {
  return (
    <div style={{
      display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8,
      padding: "10px 14px",
      background: D.card, border: "1px solid " + D.border, borderRadius: 12,
    }}>
      <TButton Icon={Plus}    label="Row"        onClick={onAddRow} />
      <TButton Icon={Plus}    label="Column"     onClick={onAddColumn} />
      <span style={{ width: 1, height: 18, background: D.border, margin: "0 4px" }} />
      <TButton Icon={Download} label="Export CSV" onClick={onExportCsv} />
      <TButton Icon={FileText} label="Copy Markdown" onClick={onCopyMarkdown} />
      {onBuildChart && (
        <>
          <span style={{ width: 1, height: 18, background: D.border, margin: "0 4px" }} />
          <TButton
            Icon={BarChart3} label="Build chart"
            onClick={onBuildChart}
            accent={D.amber}
          />
        </>
      )}
    </div>
  );
}

function TButton({ Icon, label, onClick, accent }: {
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
        padding: "6px 11px",
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

function ColumnHeader({ col, onRename, onChangeType, onDelete }: {
  col: { key: string; label: string; type: TableColumnType };
  onRename: (label: string) => void;
  onChangeType: (type: TableColumnType) => void;
  onDelete?: () => void;
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
      textAlign: "left", minWidth: 120,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        {editing ? (
          <input
            value={draft}
            autoFocus
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
            }}
          />
        ) : (
          <button
            onClick={() => setEditing(true)}
            title="Click to rename column"
            style={{
              all: "unset", flex: 1, minWidth: 0, cursor: "pointer",
              fontFamily: ft, fontSize: 12, fontWeight: 700, color: D.tx,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              padding: "3px 0",
            }}
          >{col.label}</button>
        )}
        <div style={{ position: "relative" }} onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => setTypeOpen(v => !v)}
            title="Change column type"
            style={{
              padding: "2px 6px",
              background: "transparent", border: "1px solid " + D.border,
              color: D.txm, fontFamily: mn, fontSize: 8.5, fontWeight: 700, letterSpacing: 0.4,
              textTransform: "uppercase", borderRadius: 4,
              cursor: "pointer",
              display: "inline-flex", alignItems: "center", gap: 3,
            }}
          >{col.type}<ChevronDown size={8} strokeWidth={2.4} /></button>
          {typeOpen && (
            <div style={{
              position: "absolute", top: "calc(100% + 4px)", right: 0,
              background: D.card, border: "1px solid " + D.border, borderRadius: 6,
              padding: 3, minWidth: 90, zIndex: 50,
              boxShadow: "0 16px 32px rgba(0,0,0,0.55)",
            }}>
              {(["text", "number", "percent", "date"] as TableColumnType[]).map((t) => (
                <button
                  key={t}
                  onClick={() => { onChangeType(t); setTypeOpen(false); }}
                  style={{
                    width: "100%", textAlign: "left",
                    padding: "5px 8px",
                    background: col.type === t ? D.amber + "22" : "transparent",
                    border: "none", borderRadius: 4,
                    color: col.type === t ? D.amber : D.tx,
                    fontFamily: mn, fontSize: 10, fontWeight: 700, letterSpacing: 0.4,
                    cursor: "pointer", textTransform: "uppercase",
                  }}
                >{t}</button>
              ))}
            </div>
          )}
        </div>
        {onDelete && (
          <button
            onClick={onDelete}
            title="Delete column"
            style={{
              background: "transparent", border: "none",
              color: D.txd, fontFamily: mn, fontSize: 13, cursor: "pointer",
              padding: "0 2px", lineHeight: 1,
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
      }}
    >
      {editing ? (
        <input
          value={draft}
          autoFocus
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
          }}
        />
      ) : (
        <button
          onClick={() => setEditing(true)}
          style={{
            all: "unset", display: "block", width: "100%",
            padding: "6px 9px",
            cursor: "text",
            fontFamily: numeric ? mn : ft, fontSize: 12.5,
            color: value == null ? D.txd : D.tx,
            textAlign: numeric ? "right" : "left",
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
            boxSizing: "border-box",
          }}
          title="Click to edit"
        >{display || (numeric ? "0" : "—")}{type === "percent" && value != null ? "%" : ""}</button>
      )}
    </td>
  );
}
