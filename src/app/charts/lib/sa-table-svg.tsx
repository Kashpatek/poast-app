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
  // Chrome variant (data mode only). Defaults to "framed" — the
  // category eyebrow + amber title bar + key insight block legacy
  // look. Other values trim or re-skin the wrapping decoration so
  // different templates feel visually distinct.
  chromeStyle?: import("../studio-types").TableChromeStyle;
  // Per-field style overrides — { fieldKey: { color, align, size } }.
  // Looked up by SaHeader for category/titleWhite/titleAmber/subtitle
  // and by the data table for titleBar.
  fieldStyles?: Record<string, import("../studio-types").FieldStyle>;
  // Footer toggles + free-form source attribution.
  hideWebsite?: boolean;
  hideConfidential?: boolean;
  source?: string;
  // Page (canvas) dimensions. When provided, the renderer scales every
  // brand element from the legacy 1394×861.7 frame to fit. Default
  // values keep existing exports byte-identical.
  pageW?: number;
  pageH?: number;
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
  // Per-cell click hooks for direct-on-preview editing. The renderer
  // emits the row index + column key; the parent owns the overlay
  // input and commits via updateCell.
  onEditCell?: (row: number, colKey: string) => void;
  editingCell?: { row: number; col: string } | null;
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

function SaBackdrop({ pageW, pageH }: { pageW?: number; pageH?: number }) {
  const W = pageW || SA_TABLE_WIDTH;
  const H = pageH || SA_TABLE_HEIGHT;
  // Lettermark sits 12px down from the top, hugged to the right edge
  // with a 32px margin. Width scales lightly with page width so the
  // wordmark stays legible on smaller frames.
  const lmW = Math.max(110, Math.min(170, W * 0.105));
  const lmX = W - lmW - 32;
  return (
    <>
      <rect width={W} height={H} fill="url(#saBgGrad)" />
      <rect width={W} height={H} fill="url(#saGlowTL)" />
      <rect width={W} height={H} fill="url(#saGlowBR)" />
      <rect x={0} y={0} width={W} height={4} fill="url(#saTopStripe)" />
      {/* SemiAnalysis wordmark — the real brand lettermark inlined as
          SVG paths so it survives standalone SVG export (no external
          <image href>). Sits in the top-right corner, aspect-locked at
          the source lettermark's 368.82 × 119.02 ratio. */}
      <SaLettermark x={lmX} y={12} width={lmW} />
    </>
  );
}

// The full SemiAnalysis wordmark. viewBox of the source asset is
// 368.82 × 119.02; we draw it as a <g transform=translate-scale> so the
// caller specifies (x, y, width) and we handle the rest. Two colors,
// drawn from the spec: blue #0B86D1 for "Ss" + first decorative
// slashes; amber #F7B041 for "EMiAnAlySIs" + the rest of the slashes.
function SaLettermark({ x, y, width }: { x: number; y: number; width: number }) {
  const SRC_W = 368.82;
  const SRC_H = 119.02;
  const s = width / SRC_W;
  return (
    <g transform={`translate(${x}, ${y}) scale(${s})`}>
      <polygon fill="#0B86D1" points="231.15 4.94 206.73 29.37 191.63 29.37 216.06 4.94 231.15 4.94" />
      <path fill="#0B86D1" d="M17.11,56.8c1.47.49,2.82.99,4.04,1.5,1.23.51,2.29,1.13,3.21,1.84.91.71,1.63,1.57,2.14,2.57.51,1,.77,2.2.77,3.58v.07c0,3.39-1.13,6.04-3.38,7.96-2.25,1.92-5.4,2.87-9.46,2.87-2.54,0-5.04-.44-7.49-1.31-2.45-.88-4.75-2.12-6.89-3.74l-.07-.07.07-.07,4.55-7.18.07.07c1.34,1.43,2.85,2.51,4.55,3.24,1.69.74,3.5,1.1,5.42,1.1,2.63,0,3.94-.84,3.94-2.53,0-.8-.42-1.4-1.27-1.8-.85-.4-1.85-.78-3.01-1.13-.22-.09-.43-.14-.64-.17-.2-.02-.41-.08-.64-.17-1.34-.36-2.67-.74-4.01-1.17-1.34-.42-2.54-1-3.61-1.73-1.07-.73-1.95-1.67-2.64-2.8-.69-1.13-1.04-2.59-1.04-4.37v-.13c0-1.56.29-2.98.87-4.27.58-1.29,1.4-2.4,2.47-3.33,1.07-.93,2.36-1.66,3.88-2.17,1.51-.51,3.19-.77,5.01-.77,2.14,0,4.3.32,6.48.97,2.18.65,4.21,1.59,6.08,2.84v.13l-4.08,7.42-.07-.07c-1.03-1.02-2.3-1.84-3.81-2.44-1.52-.6-3.12-.9-4.81-.9-.31,0-.67.02-1.07.07-.4.04-.77.16-1.1.33-.33.18-.61.41-.84.7-.22.29-.33.7-.33,1.24,0,.4.18.77.53,1.1.36.33.81.65,1.37.94.56.29,1.18.57,1.87.84.69.27,1.37.51,2.04.74.13,0,.28.02.43.07.16.04.3.09.43.13Z" />
      <path fill="#0B86D1" d="M47.33,42.69c2.36,0,4.59.46,6.69,1.37,2.09.91,3.92,2.15,5.48,3.71,1.56,1.56,2.8,3.39,3.71,5.48.91,2.1,1.37,4.35,1.37,6.75,0,1.29-.13,2.54-.4,3.74l-.07.13h-16.98l-4.28-6.82h12.7c-.62-1.87-1.66-3.41-3.11-4.61-1.45-1.2-3.15-1.81-5.11-1.81-1.2,0-2.34.24-3.41.73-1.07.49-2,1.14-2.77,1.96-.78.82-1.39,1.8-1.84,2.93-.45,1.13-.67,2.36-.67,3.7,0,1.02.2,2.08.6,3.16.4,1.09.98,2.08,1.74,2.96.76.89,1.67,1.63,2.74,2.23s2.27.9,3.61.9c1.2,0,2.31-.17,3.31-.5,1-.33,1.95-1.08,2.84-2.24l.07-.07.13.07,7.75,3.41-.13.14c-1.6,2.25-3.64,4-6.12,5.26-2.47,1.26-5.09,1.89-7.86,1.89-2.41,0-4.67-.45-6.79-1.34-2.12-.89-3.96-2.12-5.52-3.68-1.56-1.56-2.8-3.39-3.71-5.48-.91-2.09-1.37-4.32-1.37-6.69s.46-4.66,1.37-6.75c.91-2.09,2.15-3.92,3.71-5.48s3.4-2.8,5.52-3.71c2.12-.91,4.38-1.37,6.79-1.37Z" />
      <path fill="#0B86D1" d="M67.92,43.23h8.89v33.43h-8.89v-33.43ZM104.16,42.69c2.09,0,3.87.41,5.31,1.24,1.45.83,2.62,1.91,3.51,3.24.89,1.34,1.54,2.84,1.94,4.51s.6,3.35.6,5.05v19.92h-8.89l.07-19.98c0-.71-.13-1.38-.4-2.01-.27-.63-.64-1.18-1.1-1.68-.47-.49-1.03-.88-1.67-1.17-.65-.29-1.33-.44-2.04-.44-1.47,0-2.72.53-3.74,1.58-1.03,1.05-1.54,2.29-1.54,3.72v19.98h-8.89v-19.98c0-.71-.13-1.38-.4-2.01-.27-.63-.65-1.18-1.14-1.68-.49-.49-1.06-.87-1.7-1.14-.65-.27-1.37-.4-2.17-.4-.04,0-.25-.33-.6-.99-.36-.66-.76-1.39-1.2-2.19-.49-.93-1.09-1.99-1.8-3.18l.07-.13c1.92-1.5,4.03-2.26,6.35-2.26,2.5,0,4.52.55,6.08,1.66,1.56,1.11,2.76,2.48,3.61,4.11.18-.31.36-.57.53-.8,1.25-1.64,2.66-2.87,4.25-3.71,1.58-.84,3.24-1.26,4.98-1.26Z" />
      <path fill="#0B86D1" d="M119.53,29.86h8.89v7.82h-8.89v-7.82ZM119.53,76.65v-33.43h8.89v33.43h-8.89Z" />
      <path fill="#F7B041" d="M168.33,43.23v33.43h-8.76v-16.76c0-1.3-.25-2.5-.74-3.62-.49-1.12-1.17-2.1-2.04-2.95-.87-.85-1.87-1.51-3.01-1.98s-2.33-.7-3.58-.7-2.5.25-3.61.74c-1.11.49-2.11,1.15-2.97,1.98-.87.83-1.55,1.81-2.04,2.95-.49,1.14-.74,2.36-.74,3.66s.24,2.44.74,3.56c.49,1.12,1.17,2.1,2.04,2.95.87.85,1.86,1.52,2.97,2.01,1.11.49,2.32.74,3.61.74,1.38,0,2.56-.24,3.54-.74h.07v.13l3.34,5.95-.07.07c-2.18,1.69-4.88,2.54-8.09,2.54-2.36,0-4.59-.45-6.69-1.34-2.1-.89-3.92-2.12-5.48-3.68-1.56-1.56-2.8-3.39-3.71-5.48-.91-2.09-1.37-4.32-1.37-6.69s.46-4.66,1.37-6.75c.91-2.09,2.15-3.92,3.71-5.48s3.39-2.8,5.48-3.71c2.09-.91,4.32-1.37,6.69-1.37s4.35.43,6.08,1.29c1.74.86,3.23,2.11,4.48,3.74v-4.5h8.76Z" />
      <path fill="#F7B041" d="M173.01,43.23h9.09v33.43h-9.09v-33.43ZM203.9,47.1c1.11,1.38,1.92,3.12,2.41,5.21.49,2.1.74,4.68.74,7.75v16.58h-9.09v-16.62c0-1.25-.03-2.45-.1-3.59-.07-1.14-.3-2.14-.7-3.02-.4-.87-1.05-1.55-1.94-2.04-.89-.49-2.16-.74-3.81-.74-1.56,0-3.01.33-4.35,1v.07l-.07-.07-3.28-5.78.07-.07c2.32-2.08,5.21-3.12,8.69-3.12,5.35,0,9.16,1.47,11.43,4.41Z" />
      <path fill="#F7B041" d="M246.62,43.23v33.43h-8.76v-16.76c0-1.3-.25-2.5-.74-3.62-.49-1.12-1.17-2.1-2.04-2.95-.87-.85-1.87-1.51-3.01-1.98s-2.33-.7-3.58-.7-2.5.25-3.61.74c-1.11.49-2.11,1.15-2.97,1.98-.87.83-1.55,1.81-2.04,2.95-.49,1.14-.74,2.36-.74,3.66s.24,2.44.74,3.56c.49,1.12,1.17,2.1,2.04,2.95.87.85,1.86,1.52,2.97,2.01,1.11.49,2.32.74,3.61.74,1.38,0,2.56-.24,3.54-.74h.07v.13l3.34,5.95-.07.07c-2.18,1.69-4.88,2.54-8.09,2.54-2.36,0-4.59-.45-6.69-1.34-2.1-.89-3.92-2.12-5.48-3.68-1.56-1.56-2.8-3.39-3.71-5.48-.91-2.09-1.37-4.32-1.37-6.69s.46-4.66,1.37-6.75c.91-2.09,2.15-3.92,3.71-5.48s3.39-2.8,5.48-3.71c2.09-.91,4.32-1.37,6.69-1.37s4.35.43,6.08,1.29c1.74.86,3.23,2.11,4.48,3.74v-4.5h8.76Z" />
      <path fill="#F7B041" d="M260.19,29.86v46.8h-8.89l.07-46.8h8.82Z" />
      <path fill="#F7B041" d="M274.56,72.11l-11.7-28.88h9.56v.07l8.62,24.27-6.48,4.55ZM300.17,43.23l-.07.13c-.76,2.05-1.49,4.04-2.21,5.98-.71,1.94-1.38,3.76-2.01,5.45-2.23,6.24-4.22,11.6-5.98,16.08-1.76,4.48-3.64,8.12-5.65,10.93-2.01,2.9-4.27,4.99-6.79,6.28-2.52,1.29-5.67,1.94-9.46,1.94h-.13v-9.09h.13c1.16,0,2.19-.04,3.11-.13.91-.09,1.75-.28,2.51-.57.76-.29,1.46-.69,2.11-1.2.65-.51,1.26-1.19,1.84-2.04.58-.8,1.16-1.78,1.74-2.94.58-1.16,1.18-2.54,1.8-4.14.62-1.6,1.31-3.46,2.07-5.58.76-2.12,1.6-4.51,2.54-7.19.71-2.01,1.47-4.14,2.27-6.42.8-2.27,1.67-4.75,2.61-7.42v-.07h9.56Z" />
      <path fill="#F7B041" d="M315.81,56.8c1.47.49,2.82.99,4.04,1.5,1.23.51,2.29,1.13,3.21,1.84.91.71,1.63,1.57,2.14,2.57.51,1,.77,2.2.77,3.58v.07c0,3.39-1.13,6.04-3.38,7.96-2.25,1.92-5.4,2.87-9.46,2.87-2.54,0-5.04-.44-7.49-1.31-2.45-.88-4.75-2.12-6.89-3.74l-.07-.07.07-.07,4.55-7.18.07.07c1.34,1.43,2.85,2.51,4.55,3.24,1.69.74,3.5,1.1,5.42,1.1,2.63,0,3.94-.84,3.94-2.53,0-.8-.42-1.4-1.27-1.8-.85-.4-1.85-.78-3.01-1.13-.22-.09-.43-.14-.64-.17-.2-.02-.41-.08-.64-.17-1.34-.36-2.67-.74-4.01-1.17-1.34-.42-2.54-1-3.61-1.73-1.07-.73-1.95-1.67-2.64-2.8-.69-1.13-1.04-2.59-1.04-4.37v-.13c0-1.56.29-2.98.87-4.27.58-1.29,1.4-2.4,2.47-3.33,1.07-.93,2.36-1.66,3.88-2.17,1.51-.51,3.19-.77,5.01-.77,2.14,0,4.3.32,6.48.97,2.18.65,4.21,1.59,6.08,2.84v.13l-4.08,7.42-.07-.07c-1.03-1.02-2.3-1.84-3.81-2.44-1.52-.6-3.12-.9-4.81-.9-.31,0-.67.02-1.07.07-.4.04-.77.16-1.1.33-.33.18-.61.41-.84.7-.22.29-.33.7-.33,1.24,0,.4.18.77.53,1.1.36.33.81.65,1.37.94.56.29,1.18.57,1.87.84.69.27,1.37.51,2.04.74.13,0,.28.02.43.07.16.04.3.09.43.13Z" />
      <path fill="#F7B041" d="M329.31,29.86h8.89v7.82h-8.89v-7.82ZM329.31,76.65v-33.43h8.89v33.43h-8.89Z" />
      <path fill="#F7B041" d="M358.66,56.8c1.47.49,2.82.99,4.04,1.5,1.23.51,2.29,1.13,3.21,1.84.91.71,1.63,1.57,2.14,2.57.51,1,.77,2.2.77,3.58v.07c0,3.39-1.13,6.04-3.38,7.96-2.25,1.92-5.4,2.87-9.46,2.87-2.54,0-5.04-.44-7.49-1.31-2.45-.88-4.75-2.12-6.89-3.74l-.07-.07.07-.07,4.55-7.18.07.07c1.34,1.43,2.85,2.51,4.55,3.24,1.69.74,3.5,1.1,5.42,1.1,2.63,0,3.94-.84,3.94-2.53,0-.8-.42-1.4-1.27-1.8-.85-.4-1.85-.78-3.01-1.13-.22-.09-.43-.14-.64-.17-.2-.02-.41-.08-.64-.17-1.34-.36-2.67-.74-4.01-1.17-1.34-.42-2.54-1-3.61-1.73-1.07-.73-1.95-1.67-2.64-2.8-.69-1.13-1.04-2.59-1.04-4.37v-.13c0-1.56.29-2.98.87-4.27.58-1.29,1.4-2.4,2.47-3.33,1.07-.93,2.36-1.66,3.88-2.17,1.51-.51,3.19-.77,5.01-.77,2.14,0,4.3.32,6.48.97,2.18.65,4.21,1.59,6.08,2.84v.13l-4.08,7.42-.07-.07c-1.03-1.02-2.3-1.84-3.81-2.44-1.52-.6-3.12-.9-4.81-.9-.31,0-.67.02-1.07.07-.4.04-.77.16-1.1.33-.33.18-.61.41-.84.7-.22.29-.33.7-.33,1.24,0,.4.18.77.53,1.1.36.33.81.65,1.37.94.56.29,1.18.57,1.87.84.69.27,1.37.51,2.04.74.13,0,.28.02.43.07.16.04.3.09.43.13Z" />
      <polygon fill="#F7B041" points="145.88 90.21 121.35 114.73 106.27 114.73 130.79 90.21 145.88 90.21" />
      <polygon fill="#0B86D1" points="172.54 90.21 148.03 114.73 132.94 114.73 157.45 90.21 172.54 90.21" />
      <polygon fill="#F7B041" points="257.98 4.94 233.55 29.37 218.45 29.37 242.88 4.94 257.98 4.94" />
    </g>
  );
}

function SaHeader({ category, titleWhite, titleAmber, subtitle, fieldStyles }: {
  category?: string; titleWhite?: string; titleAmber?: string; subtitle?: string;
  fieldStyles?: Record<string, import("../studio-types").FieldStyle>;
}) {
  const eyebrow = (category || "SEMIANALYSIS").toUpperCase();
  const white = titleWhite || "Untitled";
  const amber = titleAmber || "";
  const sub = subtitle || "";
  // Approximate kerned width of the white title chunk (sz-32 + letter-spacing -.01em → ~18px/char).
  const whiteWidth = white.length * 18;
  // Per-field style overrides — color / size, applied when set. Align
  // overrides shift the anchor point left/center/right within the
  // 80–1314 content band.
  const sCat = fieldStyles?.category;
  const sWhite = fieldStyles?.titleWhite;
  const sAmber = fieldStyles?.titleAmber;
  const sSub = fieldStyles?.subtitle;
  return (
    <>
      <text x={80} y={44} className="sa-bold" fontSize={sCat?.size ?? 11}
        fill={sCat?.color || "#0b86d1"} fillOpacity={0.7} letterSpacing={2}>
        {eyebrow}
      </text>
      <text x={80} y={80} className="sa-blk" fontSize={sWhite?.size ?? 32}
        fill={sWhite?.color || "#fff"} letterSpacing="-.01em">
        {white}
      </text>
      {amber && (
        <text x={80 + whiteWidth} y={80} className="sa-blk" fontSize={sAmber?.size ?? 32}
          fill={sAmber?.color || "#f7b041"} letterSpacing="-.01em">
          {" " + amber}
        </text>
      )}
      {sub && (
        <text x={80} y={106} className="sa-reg" fontSize={sSub?.size ?? 13}
          fill={sSub?.color || "#fff"} fillOpacity={sSub?.color ? 1 : 0.35} letterSpacing=".02em">
          {sub}
        </text>
      )}
    </>
  );
}

function SaFooter({ contextLine, hideWebsite, hideConfidential, source, pageW, pageH }: {
  contextLine?: string;
  hideWebsite?: boolean;
  hideConfidential?: boolean;
  source?: string;
  pageW?: number; pageH?: number;
}) {
  const W = pageW || SA_TABLE_WIDTH;
  const H = pageH || SA_TABLE_HEIGHT;
  // Footer sits on the same baseline regardless of frame height —
  // computed off H so it stays anchored to the bottom edge.
  const lineY = H - 31.7;
  const textY = H - 15.7;
  return (
    <>
      <line x1={50} y1={lineY} x2={W - 44} y2={lineY} stroke="#fff" strokeOpacity={0.08} strokeWidth={0.4} fill="none" />
      {!hideWebsite && (
        <text x={56} y={textY} className="sa-bold" fontSize={10} fill="#f7b041" fillOpacity={0.7} letterSpacing=".1em">SEMIANALYSIS.COM</text>
      )}
      <text x={W / 2} y={textY} textAnchor="middle"
        className="sa-bold" fontSize={10} fill="#fff" fillOpacity={0.2} letterSpacing=".1em">
        {(contextLine || "POAST Studio · 2026").toUpperCase()}
      </text>
      {!hideConfidential && (
        <text x={W - 64} y={textY} textAnchor="end"
          className="sa-bold" fontSize={10} fill="#fff" fillOpacity={0.2} letterSpacing=".1em">
          CONFIDENTIAL
        </text>
      )}
      {/* Source line — drawn just above the footer rule, italicized
          and dimmed to read as attribution. Only renders when set. */}
      {source && (
        <text x={56} y={lineY - 12}
          className="sa-reg" fontSize={11} fill="#fff" fillOpacity={0.45}
          fontStyle="italic">
          {source}
        </text>
      )}
    </>
  );
}

// ─── Data-table mode ─────────────────────────────────────────────────────

// Chrome variants — pick what wrapping decoration this data table shows.
//   - framed (default): legacy SA frame · category eyebrow + amber title
//     bar + key insight block. Use for KPI/COGS/Pricing/Vendor style.
//   - dense: no amber title bar, no key insight; thinner header, more
//     vertical space for the grid itself. Use for wide spec/comparison
//     tables (Spec Comparison, Feature Matrix, Roadmap Timeline).
//   - leaderboard: same as framed but rows 0/1/2 get gold/silver/bronze
//     medal tints + a colored bar on the left.
//   - sectioned: detects "── LABEL ──" rows in column 1 and renders
//     them as full-width amber bands instead of normal data rows. Use
//     for BoM / cost-stack tables.
function resolveChrome(style: import("../studio-types").TableChromeStyle | undefined) {
  switch (style) {
    case "dense":
      return { showTitleBar: false, showKeyInsight: false, medalRows: false, sectionRows: false, headerStrong: true };
    case "leaderboard":
      return { showTitleBar: true,  showKeyInsight: true,  medalRows: true,  sectionRows: false, headerStrong: false };
    case "sectioned":
      return { showTitleBar: true,  showKeyInsight: true,  medalRows: false, sectionRows: true,  headerStrong: false };
    case "framed":
    default:
      return { showTitleBar: true,  showKeyInsight: true,  medalRows: false, sectionRows: false, headerStrong: false };
  }
}

// A row is a "section band" if column 1 is a string that begins/ends
// with `──` and every other column is zero/empty. BoM-style templates
// seed these markers.
function isSectionRow(row: Record<string, unknown>, schema: TableSheet["schema"]): boolean {
  const first = row[schema[0].key];
  if (typeof first !== "string") return false;
  if (!/^\s*[-─—]{2,}/.test(first) && !/[-─—]{2,}\s*$/.test(first)) return false;
  for (let i = 1; i < schema.length; i++) {
    const v = row[schema[i].key];
    if (v != null && v !== "" && v !== 0) return false;
  }
  return true;
}

function SaDataTable(props: SaTableRenderProps) {
  const { sheet, titleBar, highlightRowIdx, highlightFlagCol, keyInsight,
          aggregate, aggregateLabel, chromeStyle, onEditCell, editingCell } = props;
  const chrome = resolveChrome(chromeStyle);
  // Adjust the chrome to the dynamic page width — the legacy 1394
  // frame had tableX=33 / tableW=1328 (33 + 1328 + 33 = 1394). Scale
  // the side gutters proportionally so smaller frames still look
  // balanced.
  const PAGE_W = props.pageW || SA_TABLE_WIDTH;
  const sideGutter = Math.max(20, Math.round(33 * (PAGE_W / SA_TABLE_WIDTH)));
  const tableX = sideGutter;
  const tableW = PAGE_W - sideGutter * 2;
  // When the amber title bar is hidden the data area starts higher,
  // giving spec/comparison tables a denser look.
  const titleBarY = 150;
  const colHeaderY = chrome.showTitleBar ? titleBarY + 44 : titleBarY;
  const colHeaderH = 46;
  const rowH = 42;
  const dataRowsStart = colHeaderY + colHeaderH;
  const colCount = Math.max(1, sheet.schema.length);
  // Column widths — honor explicit widths from TableColumnSpec.width
  // when set; distribute the remaining budget across unset columns,
  // preserving the legacy "first column gets 42%" bias when no widths
  // are user-set.
  const explicitTotal = sheet.schema.reduce((s, c) => s + (c.width || 0), 0);
  const unsetCount = sheet.schema.filter(c => !c.width).length;
  const remaining = Math.max(0, tableW - explicitTotal);
  const colWidths: number[] = sheet.schema.map((c, i) => {
    if (c.width) return c.width;
    if (unsetCount === colCount) {
      // None set → legacy formula: first col 42% of total, rest equal.
      if (colCount > 2) return i === 0 ? tableW * 0.42 : (tableW - tableW * 0.42) / (colCount - 1);
      return tableW / colCount;
    }
    return remaining / unsetCount;
  });
  // Precompute x-edges so cell math is O(1).
  const colX: number[] = [tableX];
  for (let i = 0; i < colCount; i++) colX.push(colX[i] + colWidths[i]);
  const colCenter = (i: number): number => colX[i] + colWidths[i] / 2;
  const colEdge   = (i: number): number => colX[i + 1];

  // Rows we'll render: every data row, plus a deliberate highlight row at
  // the end if highlightRowIdx points past the data length.
  const rowCount = Math.max(1, sheet.rows.length);
  const hasAggregate = aggregate && aggregate !== "none";
  const aggregateRowH = hasAggregate ? 50 : 0;
  const tableEndY = dataRowsStart + rowCount * rowH + aggregateRowH;

  // Medal palette for leaderboard chrome — top 3 rows get a colored
  // left bar + soft row tint.
  const medalFor = (ri: number): { tint: string; bar: string } | null => {
    if (!chrome.medalRows) return null;
    if (ri === 0) return { tint: "rgba(247,176,65,0.10)", bar: "#F7B041" };  // gold
    if (ri === 1) return { tint: "rgba(220,220,230,0.08)", bar: "#D0D5DD" }; // silver
    if (ri === 2) return { tint: "rgba(205,127,50,0.10)",  bar: "#CD7F32" }; // bronze
    return null;
  };

  // Conditional-formatting extremes per column. Only columns with
  // condFmt !== "off" / undefined participate; their numeric min/max
  // get green/red text tints in the data row render.
  const condExtremes: Record<string, { min: number; max: number; mode: "minMax" | "highGood" } | undefined> = {};
  for (const c of sheet.schema) {
    if (!c.condFmt || c.condFmt === "off") continue;
    let mn = Infinity, mx = -Infinity;
    for (const r of sheet.rows) {
      const v = r[c.key];
      if (typeof v === "number" && Number.isFinite(v)) {
        if (v < mn) mn = v;
        if (v > mx) mx = v;
      }
    }
    if (mn !== Infinity && mx !== -Infinity && mn !== mx) {
      condExtremes[c.key] = { min: mn, max: mx, mode: c.condFmt };
    }
  }

  return (
    <>
      {/* Title bar — hidden in dense chrome */}
      {chrome.showTitleBar && (
        <>
          <rect x={tableX} y={titleBarY} width={tableW} height={44} rx={6} fill="url(#saHdrAmber)" />
          <text x={tableX + tableW / 2} y={titleBarY + 30} textAnchor="middle"
            className="sa-blk" fontSize={18} fill="#fff" letterSpacing=".05em">
            {(titleBar || props.titleWhite || "DATA").toUpperCase()}
          </text>
        </>
      )}

      {/* Column header row */}
      <rect x={tableX} y={colHeaderY} width={tableW} height={colHeaderH} fill={chrome.headerStrong ? "#1f2530" : "#1a1f28"} />
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
        const medal = medalFor(ri);
        const isSection = chrome.sectionRows && isSectionRow(row, sheet.schema);
        // Section rows ignore normal column rendering — paint a full-
        // width amber band with column-1 text centered as the label.
        if (isSection) {
          const labelRaw = String(row[sheet.schema[0].key] ?? "");
          const label = labelRaw.replace(/^[\s\-─—]+/, "").replace(/[\s\-─—]+$/, "").toUpperCase();
          return (
            <g key={"row-" + ri}>
              <rect x={tableX} y={y + 4} width={tableW} height={rowH - 6} fill="#F7B041" fillOpacity={0.16} />
              <line x1={tableX} y1={y + 4} x2={tableX} y2={y + rowH - 2} stroke="#F7B041" strokeWidth={3} />
              <text x={tableX + 18} y={y + 28} className="sa-blk" fontSize={13}
                fill="#F7B041" letterSpacing=".18em">{label}</text>
            </g>
          );
        }
        return (
          <g key={"row-" + ri}>
            {medal && (
              <>
                <rect x={tableX} y={y} width={tableW} height={rowH} fill={medal.tint} />
                <rect x={tableX} y={y} width={3} height={rowH} fill={medal.bar} />
              </>
            )}
            {isHi && <rect x={tableX} y={y} width={tableW} height={rowH + 6} fill="url(#saHilightBlue)" />}
            {sheet.schema.map((c, ci) => {
              const v = row[c.key];
              // First column reads as a label even if it's a number — use
              // raw string so labels like "Q1 '26" don't get formatted.
              const display = ci === 0
                ? (v == null ? "" : String(v))
                : formatCell(v, c);
              const flag = isHi && ci === (highlightFlagCol ?? -1);
              // Badge columns render as colored pills instead of plain
              // text — badgeMap matches the cell value to a hex color.
              if (c.type === "badge" && ci > 0) {
                const valStr = v == null ? "" : String(v);
                const badgeColor = c.badgeMap?.[valStr] || "#5C6370";
                const cx = colCenter(ci);
                const pillW = Math.max(58, valStr.length * 8.5 + 24);
                return (
                  <g key={c.key}>
                    <rect
                      x={cx - pillW / 2} y={y + 11}
                      width={pillW} height={20}
                      rx={10}
                      fill={badgeColor} fillOpacity={0.20}
                      stroke={badgeColor} strokeOpacity={0.7} strokeWidth={1}
                    />
                    <text x={cx} y={y + 25} textAnchor="middle"
                      className="sa-bold" fontSize={12}
                      fill={badgeColor}>{valStr.toUpperCase()}</text>
                  </g>
                );
              }
              // Conditional formatting on numeric columns — min red,
              // max green (flipped when condFmt === "highGood").
              let condFill: string | null = null;
              if (ci > 0 && typeof v === "number" && condExtremes[c.key]) {
                const ext = condExtremes[c.key]!;
                const isMax = v === ext.max;
                const isMin = v === ext.min;
                if (isMax) condFill = ext.mode === "highGood" ? "#e06347" : "#2ead8e";
                else if (isMin) condFill = ext.mode === "highGood" ? "#2ead8e" : "#e06347";
              }
              const fill = condFill
                ? condFill
                : isHi ? (flag ? "#e06347" : ci === 0 ? "#fff" : "#f7b041") : "#fff";
              const opacity = condFill ? 1 : isHi ? 1 : ci === 0 ? 0.7 : 0.6;
              const weight = (condFill || isHi) ? "sa-blk" : "sa-reg";
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

      {/* Click hit-zones over data cells — only active when the
          parent supplies onEditCell. Editing the first column is
          enabled too (row labels). Hovering tints the cell amber so
          the user knows it's interactive. */}
      {onEditCell && sheet.rows.map((row, ri) => (
        <g key={"hit-row-" + ri}>
          {sheet.schema.map((c, ci) => {
            const y = dataRowsStart + ri * rowH;
            const isEditing = editingCell?.row === ri && editingCell?.col === c.key;
            void row;
            return (
              <rect
                key={"hit-" + ri + "-" + c.key}
                className="sa-cell-hit"
                data-cell={ri + ":" + c.key}
                x={colX[ci]} y={y}
                width={colWidths[ci]} height={rowH}
                fill={isEditing ? "rgba(247,176,65,0.10)" : "rgba(255,255,255,0)"}
                stroke={isEditing ? "#F7B041" : "rgba(255,255,255,0)"}
                strokeWidth={isEditing ? 1.5 : 0}
                strokeDasharray={isEditing ? "4 3" : undefined}
                onClick={(e) => { e.stopPropagation(); onEditCell(ri, c.key); }}
                style={{ cursor: "text" }}
              >
                <title>Click to edit</title>
              </rect>
            );
          })}
        </g>
      ))}
      <style>{
        ".sa-cell-hit:hover { fill: rgba(247,176,65,0.06) !important; stroke: rgba(247,176,65,0.5) !important; stroke-width: 0.75 !important; }"
      }</style>

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

      {/* Key insight block — hidden when chrome opts out */}
      {chrome.showKeyInsight && keyInsight && (
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
  const W = props.pageW || SA_TABLE_WIDTH;
  const H = props.pageH || SA_TABLE_HEIGHT;
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      xmlns="http://www.w3.org/2000/svg"
      style={{ width: "100%", height: "100%", display: "block" }}
    >
      <SaDefs />
      <SaBackdrop pageW={W} pageH={H} />
      <SaHeader
        category={props.category}
        titleWhite={props.titleWhite}
        titleAmber={props.titleAmber}
        subtitle={props.subtitle}
        fieldStyles={props.fieldStyles}
      />
      {props.mode === "data" ? <SaDataTable {...props} /> : <SaHeatmap {...props} />}
      <SaFooter
        contextLine={props.subtitle}
        hideWebsite={props.hideWebsite}
        hideConfidential={props.hideConfidential}
        source={props.source}
        pageW={W}
        pageH={H}
      />
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
