"use client";

// SemiAnalysis-branded SVG renderer for Studio Table docs.
//
// Distills the sa-data-tables skill into a React component. The renderer
// produces an Illustrator-ready 1394 × 861.7 SVG with the SA dark theme:
// amber/blue/teal/coral palette, top gradient stripe, SA badge,
// category eyebrow + two-color title + subtitle, footer with
// SEMIANALYSIS.COM mark. Two modes:
//   - data    → amber title bar, dark column header, neutral rows,
//               one blue-highlight row (with optional coral flag cell),
//               KEY INSIGHT callout below.
//   - heatmap → axis labels, color-coded cells (coral/yellow/teal
//               keyed to a threshold), optional amber baseline cell,
//               legend, INPUTS or CAVEATS panel, optional formula box.
//
// Everything is plain SVG — no canvas, no foreignObject — so the
// rendered output round-trips through `new XMLSerializer` into a clean
// .svg download that Illustrator will open without missing-glyph
// warnings.

import { aggregateColumn, formatCell } from "./data-sheet";
import { EDITABLE_REGIONS, EditableField } from "./sa-table-regions";
import { TableInputItem, TableSheet } from "../studio-types";

export const SA_TABLE_WIDTH = 1394;
export const SA_TABLE_HEIGHT = 861.7;

export interface SaTableRenderProps {
  mode: "data" | "heatmap";
  sheet: TableSheet;
  category?: string;
  titleWhite?: string;
  titleAmber?: string;
  subtitle?: string;
  // Data mode
  titleBar?: string;
  highlightRowIdx?: number;
  highlightFlagCol?: number;
  keyInsight?: string;
  aggregate?: "none" | "sum" | "avg" | "min" | "max";
  aggregateLabel?: string;
  // When set, the renderer paints invisible click areas over each
  // editable text region and forwards clicks to the parent. The parent
  // (editor-table) overlays an HTML input at the same coords for
  // in-place editing. No-op when unset (export pipeline is opaque).
  onEditField?: (field: EditableField) => void;
  editingField?: EditableField | null;
  // Heatmap mode
  threshold?: number;
  yellowBand?: number;
  topAxisLabel?: string;
  leftAxisLabel?: string;
  baselineRow?: number;
  baselineCol?: number;
  panelKind?: "inputs" | "caveats";
  panelItems?: TableInputItem[];
  formula?: string;
  formulaBaseline?: string;
  formulaResult?: string;
}

// ─── Shared atoms (defs, header, footer) ─────────────────────────────────

function SaDefs() {
  return (
    <defs>
      <style>{[
        ".sa-reg { font-family: 'Outfit', sans-serif; font-weight: 400; }",
        ".sa-bold { font-family: 'Outfit', sans-serif; font-weight: 700; }",
        ".sa-blk { font-family: 'Outfit', sans-serif; font-weight: 800; }",
        ".sa-courier { font-family: 'JetBrains Mono', 'Courier New', monospace; font-size: 12.5px; letter-spacing: .02em; }",
      ].join(" ")}</style>
      <linearGradient id="saTopStripe" x1="0" y1="0" x2="1394" y2="0" gradientUnits="userSpaceOnUse">
        <stop offset="0%"  stopColor="#f7b041" stopOpacity="1" />
        <stop offset="33%" stopColor="#0b86d1" stopOpacity="1" />
        <stop offset="66%" stopColor="#2ead8e" stopOpacity="1" />
        <stop offset="100%" stopColor="#f7b041" stopOpacity="0.6" />
      </linearGradient>
      <linearGradient id="saBgGrad" x1="0" y1="0" x2="1394" y2="861" gradientUnits="userSpaceOnUse">
        <stop offset="0%"   stopColor="#0a0c10" />
        <stop offset="100%" stopColor="#0d1118" />
      </linearGradient>
      <radialGradient id="saGlowTL" cx="0" cy="0" r="600" gradientUnits="userSpaceOnUse">
        <stop offset="0%"   stopColor="#0B86D1" stopOpacity="0.12" />
        <stop offset="100%" stopColor="#0B86D1" stopOpacity="0" />
      </radialGradient>
      <radialGradient id="saGlowBR" cx="1394" cy="862" r="500" gradientUnits="userSpaceOnUse">
        <stop offset="0%"   stopColor="#F7B041" stopOpacity="0.10" />
        <stop offset="100%" stopColor="#F7B041" stopOpacity="0" />
      </radialGradient>
      <linearGradient id="saHdrAmber" x1="0" y1="0" x2="1" y2="0" gradientUnits="objectBoundingBox">
        <stop offset="0%"   stopColor="#F7B041" stopOpacity="1" />
        <stop offset="100%" stopColor="#e8a030" stopOpacity="1" />
      </linearGradient>
      <linearGradient id="saHilightBlue" x1="0" y1="0" x2="1" y2="0" gradientUnits="objectBoundingBox">
        <stop offset="0%"   stopColor="#0B86D1" stopOpacity="0.20" />
        <stop offset="50%"  stopColor="#0B86D1" stopOpacity="0.28" />
        <stop offset="100%" stopColor="#0B86D1" stopOpacity="0.20" />
      </linearGradient>
    </defs>
  );
}

function SaBackdrop() {
  return (
    <>
      <rect width={SA_TABLE_WIDTH} height={SA_TABLE_HEIGHT} fill="url(#saBgGrad)" />
      <rect width={SA_TABLE_WIDTH} height={SA_TABLE_HEIGHT} fill="url(#saGlowTL)" />
      <rect width={SA_TABLE_WIDTH} height={SA_TABLE_HEIGHT} fill="url(#saGlowBR)" />
      <rect x={0} y={0} width={SA_TABLE_WIDTH} height={4} fill="url(#saTopStripe)" />
      {/* SA badge */}
      <rect x={1320} y={18} width={50} height={32} rx={4}
        fill="#111318" stroke="#f7b041" strokeWidth={1} strokeOpacity={0.5} />
      <text x={1345} y={40} textAnchor="middle"
        className="sa-blk"
        fontSize={15}
        fill="#f7b041">SA</text>
    </>
  );
}

function SaHeader({ category, titleWhite, titleAmber, subtitle }: {
  category?: string; titleWhite?: string; titleAmber?: string; subtitle?: string;
}) {
  const eyebrow = (category || "SEMIANALYSIS").toUpperCase();
  const white = titleWhite || "Untitled";
  const amber = titleAmber || "";
  const sub = subtitle || "";
  // Approximate kerned width of the white title chunk (sz-32 + letter-spacing -.01em → ~18px/char).
  const whiteWidth = white.length * 18;
  return (
    <>
      <text x={80} y={44} className="sa-bold" fontSize={11} fill="#0b86d1" fillOpacity={0.7} letterSpacing={2}>
        {eyebrow}
      </text>
      <text x={80} y={80} className="sa-blk" fontSize={32} fill="#fff" letterSpacing="-.01em">
        {white}
      </text>
      {amber && (
        <text x={80 + whiteWidth} y={80} className="sa-blk" fontSize={32} fill="#f7b041" letterSpacing="-.01em">
          {" " + amber}
        </text>
      )}
      {sub && (
        <text x={80} y={106} className="sa-reg" fontSize={13} fill="#fff" fillOpacity={0.35} letterSpacing=".02em">
          {sub}
        </text>
      )}
    </>
  );
}

function SaFooter({ contextLine }: { contextLine?: string }) {
  return (
    <>
      <line x1={50} y1={830} x2={1350} y2={830} stroke="#fff" strokeOpacity={0.08} strokeWidth={0.4} fill="none" />
      <circle cx={56} cy={842} r={3.5} fill="#f7b041" fillOpacity={0.7} />
      <text x={68} y={846} className="sa-bold" fontSize={10} fill="#f7b041" fillOpacity={0.7} letterSpacing=".1em">SEMIANALYSIS.COM</text>
      <text x={579} y={846} className="sa-bold" fontSize={10} fill="#fff" fillOpacity={0.2} letterSpacing=".1em">{(contextLine || "POAST Studio · 2026").toUpperCase()}</text>
      <text x={1240} y={846} className="sa-bold" fontSize={10} fill="#fff" fillOpacity={0.2} letterSpacing=".1em">CONFIDENTIAL</text>
    </>
  );
}

// ─── Data-table mode ─────────────────────────────────────────────────────

function SaDataTable(props: SaTableRenderProps) {
  const { sheet, titleBar, highlightRowIdx, highlightFlagCol, keyInsight,
          aggregate, aggregateLabel } = props;
  const tableX = 33, tableW = 1328;
  const titleBarY = 150;
  const colHeaderY = titleBarY + 44;
  const colHeaderH = 46;
  const rowH = 42;
  const dataRowsStart = colHeaderY + colHeaderH;
  const colCount = Math.max(1, sheet.schema.length);
  // First column gets ~40% of width when there are ≥3 columns; otherwise even split.
  const firstColW = colCount > 2 ? tableW * 0.42 : tableW / colCount;
  const restColW = colCount > 1 ? (tableW - firstColW) / (colCount - 1) : tableW;
  const colCenter = (i: number): number => {
    if (i === 0) return tableX + firstColW / 2;
    return tableX + firstColW + (i - 1) * restColW + restColW / 2;
  };
  const colEdge = (i: number): number => {
    if (i === 0) return tableX + firstColW;
    return tableX + firstColW + i * restColW;
  };

  // Rows we'll render: every data row, plus a deliberate highlight row at
  // the end if highlightRowIdx points past the data length.
  const rowCount = Math.max(1, sheet.rows.length);
  const hasAggregate = aggregate && aggregate !== "none";
  const aggregateRowH = hasAggregate ? 50 : 0;
  const tableEndY = dataRowsStart + rowCount * rowH + aggregateRowH;

  return (
    <>
      {/* Title bar */}
      <rect x={tableX} y={titleBarY} width={tableW} height={44} rx={6} fill="url(#saHdrAmber)" />
      <text x={tableX + tableW / 2} y={titleBarY + 30} textAnchor="middle"
        className="sa-blk" fontSize={18} fill="#fff" letterSpacing=".05em">
        {(titleBar || props.titleWhite || "DATA").toUpperCase()}
      </text>

      {/* Column header row */}
      <rect x={tableX} y={colHeaderY} width={tableW} height={colHeaderH} fill="#1a1f28" />
      <line x1={tableX} y1={colHeaderY + colHeaderH} x2={tableX + tableW} y2={colHeaderY + colHeaderH}
        stroke="#fff" strokeOpacity={0.1} strokeWidth={0.5} />
      {sheet.schema.map((c, ci) => (
        <text key={"hdr-" + c.key}
          x={ci === 0 ? tableX + 15 : colCenter(ci)}
          y={colHeaderY + 28}
          textAnchor={ci === 0 ? "start" : "middle"}
          className="sa-bold" fontSize={15} fill="#fff" fillOpacity={0.9}>
          {c.label}
        </text>
      ))}

      {/* Data rows */}
      {sheet.rows.map((row, ri) => {
        const y = dataRowsStart + ri * rowH;
        const isHi = ri === (highlightRowIdx ?? -1);
        return (
          <g key={"row-" + ri}>
            {isHi && <rect x={tableX} y={y} width={tableW} height={rowH + 6} fill="url(#saHilightBlue)" />}
            {sheet.schema.map((c, ci) => {
              const v = row[c.key];
              // First column reads as a label even if it's a number — use
              // raw string so labels like "Q1 '26" don't get formatted.
              const display = ci === 0
                ? (v == null ? "" : String(v))
                : formatCell(v, c);
              const flag = isHi && ci === (highlightFlagCol ?? -1);
              const fill = isHi ? (flag ? "#e06347" : ci === 0 ? "#fff" : "#f7b041") : "#fff";
              const opacity = isHi ? 1 : ci === 0 ? 0.7 : 0.6;
              const weight = isHi ? "sa-blk" : "sa-reg";
              const size = isHi ? 16 : 15;
              return (
                <text key={c.key}
                  x={ci === 0 ? tableX + 15 : colCenter(ci)}
                  y={y + 27}
                  textAnchor={ci === 0 ? "start" : "middle"}
                  className={weight} fontSize={size} fill={fill} fillOpacity={opacity}>
                  {display}
                </text>
              );
            })}
            {!isHi && (
              <line x1={tableX} y1={y + rowH} x2={tableX + tableW} y2={y + rowH}
                stroke="#fff" strokeOpacity={0.07} strokeWidth={0.4} />
            )}
          </g>
        );
      })}

      {/* Auto-aggregate footer row (sum / avg / min / max). Renders in a
          muted amber band so it reads as a derived row, distinct from the
          user-picked highlight row. */}
      {hasAggregate && (() => {
        const y = dataRowsStart + rowCount * rowH;
        const kind = aggregate as "sum" | "avg" | "min" | "max";
        const label = aggregateLabel || kind.toUpperCase();
        return (
          <g>
            <rect x={tableX} y={y} width={tableW} height={aggregateRowH}
              fill="#f7b041" fillOpacity={0.07} />
            <line x1={tableX} y1={y} x2={tableX + tableW} y2={y}
              stroke="#f7b041" strokeOpacity={0.35} strokeWidth={1} />
            {sheet.schema.map((c, ci) => {
              if (ci === 0) {
                return (
                  <text key="agg-label" x={tableX + 15} y={y + 31}
                    className="sa-blk" fontSize={14} fill="#f7b041" letterSpacing=".06em">
                    {label}
                  </text>
                );
              }
              const result = aggregateColumn(
                sheet.rows.map(r => r[c.key]),
                kind,
              );
              const display = result == null ? "" : formatCell(result, c);
              return (
                <text key={c.key} x={colCenter(ci)} y={y + 31}
                  textAnchor="middle"
                  className="sa-blk" fontSize={15} fill="#f7b041">
                  {display}
                </text>
              );
            })}
          </g>
        );
      })()}

      {/* Vertical separators */}
      {sheet.schema.slice(1).map((_, ci) => {
        const x = colEdge(ci);
        const strong = ci === 0;
        return (
          <line key={"vsep-" + ci}
            x1={x} y1={colHeaderY} x2={x} y2={tableEndY}
            stroke="#fff"
            strokeOpacity={strong ? 0.1 : 0.07}
            strokeWidth={strong ? 0.5 : 0.4} />
        );
      })}

      {/* Key insight block */}
      {keyInsight && (
        <g>
          <line x1={80} y1={tableEndY + 30} x2={1314} y2={tableEndY + 30}
            stroke="#fff" strokeOpacity={0.1} strokeWidth={0.5} />
          <text x={80} y={tableEndY + 54}
            className="sa-blk" fontSize={23.43} fill="#f7b041" letterSpacing=".14em">KEY INSIGHT</text>
          <line x1={80} y1={tableEndY + 62} x2={380} y2={tableEndY + 62}
            stroke="#f7b041" strokeOpacity={0.2} strokeWidth={0.5} />
          <foreignObject x={80} y={tableEndY + 72} width={1234} height={120}>
            <div style={{
              fontFamily: "'Outfit', sans-serif",
              fontSize: 15, color: "#fff", opacity: 0.7,
              lineHeight: 1.45,
            }}>{keyInsight}</div>
          </foreignObject>
        </g>
      )}
    </>
  );
}

// ─── Heatmap mode ────────────────────────────────────────────────────────

function heatColor(value: number, threshold: number, yellowBand: number, maxV: number, minV: number): { fill: string; opacity: number; band: "R" | "Y" | "G" } {
  if (value > threshold + yellowBand) {
    const amtOver = value - (threshold + yellowBand);
    const rangeOver = maxV - (threshold + yellowBand);
    const op = rangeOver > 0
      ? Math.round((0.10 + (amtOver / rangeOver) * 0.45) * 100) / 100
      : 0.35;
    return { fill: "#e06347", opacity: op, band: "R" };
  }
  if (value >= threshold - yellowBand) {
    return { fill: "#f5c63d", opacity: 0.15, band: "Y" };
  }
  const amtUnder = (threshold - yellowBand) - value;
  const rangeUnder = (threshold - yellowBand) - minV;
  const op = rangeUnder > 0
    ? Math.round((0.10 + (amtUnder / rangeUnder) * 0.45) * 100) / 100
    : 0.35;
  return { fill: "#2ead8e", opacity: op, band: "G" };
}

function textColorFor(band: "R" | "Y" | "G", opacity: number): { fill: string; weight: "sa-blk" | "sa-bold"; opacity: number } {
  if (band === "Y") return { fill: "#f5c63d", weight: "sa-bold", opacity: 1 };
  if (band === "R") return {
    fill: "#e06347",
    weight: opacity > 0.4 ? "sa-blk" : "sa-bold",
    opacity: opacity > 0.25 ? 1 : 0.7,
  };
  return {
    fill: "#2ead8e",
    weight: opacity > 0.4 ? "sa-blk" : "sa-bold",
    opacity: opacity > 0.25 ? 1 : 0.7,
  };
}

function SaHeatmap(props: SaTableRenderProps) {
  const { sheet, threshold = 0, yellowBand = 0.5, topAxisLabel, leftAxisLabel,
          baselineRow, baselineCol, panelKind = "inputs", panelItems,
          formula, formulaBaseline, formulaResult } = props;

  // Layout — table sits between y=196 (after the axis labels at ~152) and
  // y≈576 so a 5–6 row × 5–6 col grid fits comfortably. Cell heights flex
  // a bit with row count.
  const tableX = 164, tableY = 196;
  const tableW = 1184;
  const tableH = 380;
  // The first column of the sheet is the row label, not a value column —
  // so the "value columns" are everything from index 1 onward.
  const valueCols = sheet.schema.slice(1);
  const colCount = Math.max(1, valueCols.length);
  const rowCount = Math.max(1, sheet.rows.length);

  // Cell dimensions with 4px gap. We start by computing the strict grid;
  // small visual gap reads as discrete tiles per the brand guide.
  const gap = 4;
  const cellW = (tableW - gap * (colCount - 1)) / colCount;
  const cellH = (tableH - gap * (rowCount - 1)) / rowCount;
  const cellX = (ci: number) => tableX + ci * (cellW + gap);
  const cellY = (ri: number) => tableY + ri * (cellH + gap);

  // Compute min/max across the value columns so we can scale colors.
  const allValues: number[] = [];
  for (const row of sheet.rows) {
    for (const c of valueCols) {
      const v = row[c.key];
      if (typeof v === "number" && Number.isFinite(v)) allValues.push(v);
    }
  }
  const maxV = allValues.length ? Math.max(...allValues) : threshold + 1;
  const minV = allValues.length ? Math.min(...allValues) : threshold - 1;

  return (
    <>
      {/* Axis labels */}
      {topAxisLabel && (
        <>
          <text x={(tableX + tableX + tableW) / 2} y={170}
            textAnchor="middle" className="sa-bold" fontSize={13}
            fill="#fff" fillOpacity={0.45} letterSpacing=".05em">
            {topAxisLabel.replace(/→\s*$/, "").trim().toUpperCase()}
          </text>
          <line x1={tableX + 60} y1={166} x2={tableX + tableW / 2 - 80} y2={166}
            stroke="#fff" strokeOpacity={0.08} strokeWidth={0.4} />
          <line x1={tableX + tableW / 2 + 80} y1={166} x2={tableX + tableW - 60} y2={166}
            stroke="#fff" strokeOpacity={0.08} strokeWidth={0.4} />
          <polygon points={`${tableX + tableW - 60},162 ${tableX + tableW - 50},166 ${tableX + tableW - 60},170`}
            fill="#fff" fillOpacity={0.2} />
        </>
      )}
      {leftAxisLabel && (
        <text x={62} y={tableY + tableH / 2}
          textAnchor="middle" className="sa-bold" fontSize={13}
          fill="#fff" fillOpacity={0.45} letterSpacing=".05em"
          transform={`rotate(-90,62,${tableY + tableH / 2})`}>
          {leftAxisLabel.toUpperCase()}
        </text>
      )}

      {/* Row labels */}
      {sheet.rows.map((row, ri) => {
        const lbl = row[sheet.schema[0]?.key];
        const display = lbl == null ? "Row " + (ri + 1) : String(lbl);
        return (
          <text key={"rl-" + ri}
            x={tableX - 12} y={cellY(ri) + cellH / 2 + 4}
            textAnchor="end" className="sa-bold" fontSize={13}
            fill="#fff" fillOpacity={0.7}>
            {display}
          </text>
        );
      })}

      {/* Column labels */}
      {valueCols.map((c, ci) => (
        <text key={"cl-" + c.key}
          x={cellX(ci) + cellW / 2} y={tableY - 12}
          textAnchor="middle" className="sa-bold" fontSize={13}
          fill="#fff" fillOpacity={0.7}>
          {c.label}
        </text>
      ))}

      {/* Cells */}
      {sheet.rows.map((row, ri) => (
        <g key={"r-" + ri}>
          {valueCols.map((c, ci) => {
            const raw = row[c.key];
            const v = typeof raw === "number" ? raw : Number(raw);
            const valid = Number.isFinite(v);
            const color = valid ? heatColor(v, threshold, yellowBand, maxV, minV) : { fill: "#1a1f28", opacity: 1, band: "Y" as const };
            const txt = textColorFor(color.band, color.opacity);
            const isBaseline = ri === (baselineRow ?? -2) && ci === (baselineCol ?? -2);
            const display = valid ? formatCell(v, c) : "—";
            return (
              <g key={c.key}>
                <rect x={cellX(ci)} y={cellY(ri)} width={cellW} height={cellH} rx={3}
                  fill={color.fill} fillOpacity={color.opacity} />
                {isBaseline && (
                  <rect x={cellX(ci)} y={cellY(ri)} width={cellW} height={cellH} rx={3}
                    fill="none" stroke="#f7b041" strokeWidth={2} />
                )}
                <text x={cellX(ci) + cellW / 2} y={cellY(ri) + cellH / 2 + 6}
                  textAnchor="middle"
                  className={isBaseline ? "sa-blk" : txt.weight}
                  fontSize={16}
                  fill={isBaseline ? "#f7b041" : txt.fill}
                  fillOpacity={isBaseline ? 1 : txt.opacity}>
                  {display}
                </text>
              </g>
            );
          })}
        </g>
      ))}

      {/* Outer border */}
      <rect x={tableX} y={tableY} width={tableW} height={tableH} rx={3}
        fill="none" stroke="#fff" strokeOpacity={0.08} strokeWidth={0.6} />

      {/* Legend */}
      <g>
        <text x={52} y={608} className="sa-bold" fontSize={11} fill="#fff" fillOpacity={0.45} letterSpacing={1.5}>LEGEND</text>
        <rect x={125} y={598} width={20} height={14} rx={2} fill="#2ead8e" fillOpacity={0.4} />
        <text x={152} y={610} className="sa-reg" fontSize={13} fill="#fff" fillOpacity={0.7}>Under threshold</text>
        <rect x={282} y={598} width={20} height={14} rx={2} fill="#f5c63d" fillOpacity={0.2} />
        <text x={309} y={610} className="sa-reg" fontSize={13} fill="#fff" fillOpacity={0.7}>Break-even</text>
        <rect x={429} y={598} width={20} height={14} rx={2} fill="#e06347" fillOpacity={0.45} />
        <text x={456} y={610} className="sa-reg" fontSize={13} fill="#fff" fillOpacity={0.7}>Above threshold</text>
      </g>

      {/* Inputs OR Caveats panel */}
      {panelItems && panelItems.length > 0 && (
        <g>
          <line x1={148} y1={632} x2={1311} y2={632}
            stroke="#fff" strokeOpacity={0.1} strokeWidth={0.5} />
          <text x={183} y={656} className="sa-blk" fontSize={23.43} fill="#f7b041" letterSpacing=".14em">
            {(panelKind === "caveats" ? "CAVEATS" : "INPUTS")}
          </text>
          <line x1={183} y1={664} x2={603} y2={664}
            stroke="#f7b041" strokeOpacity={0.2} strokeWidth={0.5} />
          {panelItems.slice(0, 6).map((it, i) => {
            const col = i < 3 ? 0 : 1;
            const colX = col === 0 ? 183 : 867;
            const localI = col === 0 ? i : i - 3;
            const y = 684 + localI * 29;
            return (
              <g key={i}>
                <text x={colX} y={y} className="sa-bold" fontSize={19} fill="#fff">
                  {it.label}
                  {it.value != null && it.value !== "" && (
                    <tspan className="sa-reg" fill="#fff" fillOpacity={0.7}>{" " + it.value}</tspan>
                  )}
                </text>
              </g>
            );
          })}
        </g>
      )}

      {/* Optional formula box */}
      {formula && (
        <g>
          <rect x={163} y={778} width={1133} height={52} rx={6} fill="#141820" fillOpacity={0.6} />
          <text x={187} y={800} className="sa-bold" fontSize={12.5} fill="#f7b041" letterSpacing=".18em">FORMULA</text>
          <text x={187} y={820} className="sa-courier" fill="#0b86d1">{formula}</text>
          {formulaBaseline && (
            <>
              <text x={Math.min(750, 187 + (formula.length * 7.6))} y={820} className="sa-bold" fontSize={12.5} fill="#fff" fillOpacity={0.7}>Baseline:</text>
              <text x={Math.min(820, 187 + (formula.length * 7.6) + 80)} y={820} className="sa-reg" fontSize={12.5} fill="#fff" fillOpacity={0.5}>{formulaBaseline}</text>
            </>
          )}
          {formulaResult && (
            <text x={1290} y={820} textAnchor="end" className="sa-blk" fontSize={12.5} fill="#f7b041">{formulaResult}</text>
          )}
        </g>
      )}
    </>
  );
}

// formatHeatValue replaced by formatCell from data-sheet for unified
// per-column formatting (preserves the "default" fallback for unset
// numFmt — see data-sheet.defaultNum for the magnitude buckets).

// ─── Top-level render ────────────────────────────────────────────────────

export default function SaTableSvg(props: SaTableRenderProps) {
  return (
    <svg
      viewBox={`0 0 ${SA_TABLE_WIDTH} ${SA_TABLE_HEIGHT}`}
      xmlns="http://www.w3.org/2000/svg"
      style={{ width: "100%", height: "100%", display: "block" }}
    >
      <SaDefs />
      <SaBackdrop />
      <SaHeader
        category={props.category}
        titleWhite={props.titleWhite}
        titleAmber={props.titleAmber}
        subtitle={props.subtitle}
      />
      {props.mode === "data" ? <SaDataTable {...props} /> : <SaHeatmap {...props} />}
      <SaFooter contextLine={props.subtitle} />
      {props.onEditField && <EditHitZones mode={props.mode} editing={props.editingField || null} onEdit={props.onEditField} />}
    </svg>
  );
}

function EditHitZones({ mode, editing, onEdit }: {
  mode: "data" | "heatmap";
  editing: EditableField | null;
  onEdit: (field: EditableField) => void;
}) {
  const fields = Object.entries(EDITABLE_REGIONS) as [EditableField, typeof EDITABLE_REGIONS[EditableField]][];
  return (
    <g>
      {fields.map(([field, r]) => {
        if (r.mode && r.mode !== mode) return null;
        const isEditing = field === editing;
        return (
          <g key={field}
            className="sa-edit-hit"
            onClick={(e) => { e.stopPropagation(); onEdit(field); }}
            style={{ cursor: "text" }}>
            <rect
              x={r.x} y={r.y} width={r.w} height={r.h}
              rx={3}
              fill={isEditing ? "rgba(247,176,65,0.10)" : "rgba(255,255,255,0.0)"}
              stroke={isEditing ? "#F7B041" : "rgba(255,255,255,0)"}
              strokeWidth={isEditing ? 1.5 : 0}
              strokeDasharray={isEditing ? "4 3" : undefined}
            >
              <title>Click to edit</title>
            </rect>
          </g>
        );
      })}
      {/* Hover affordance · faint amber dotted outline on the hit rect
          when the cursor enters its group. */}
      <style>{
        ".sa-edit-hit:hover rect { stroke: #F7B04199 !important; stroke-width: 1 !important; stroke-dasharray: 4 3 !important; }"
      }</style>
    </g>
  );
}

// Serialize the rendered SVG into a clean string for download / canvas
// rasterization. Renderer must be invoked via renderToStaticMarkup since
// we're producing inert markup outside React's tree.
export function serializeSaTable(props: SaTableRenderProps): string {
  // We defer the actual renderToStaticMarkup import to the caller — keeps
  // this module SSR-safe and lets editor-table choose its own boundary.
  void props;
  throw new Error("serializeSaTable must go through editor-table's helper");
}
