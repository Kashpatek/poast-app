// POAST Studio — shared types for the multi-document suite.
//
// The Studio holds three document kinds (chart / table / diagram). Each has
// its own payload shape, but the wrapper `StudioDoc` is the unit of storage,
// listing, and routing. Editors own their own payload validation — the
// shell + storage layers treat the payload as opaque JSON for now.

export type DocType = "chart" | "table" | "diagram";

export interface StudioDoc {
  id: string;            // "doc-<base36 ulid-ish>"
  owner: string;         // normalized user name from user-context
  type: DocType;
  name: string;          // user-visible title
  thumbnail?: string;    // data: URL, ~240×160 PNG snapshot
  payload: unknown;      // editor-specific document body, opaque at this layer
  tags: string[];
  createdAt: string;     // ISO
  updatedAt: string;     // ISO
}

export type SaveState = "idle" | "saving" | "saved" | "error";

export type StudioView =
  | { kind: "welcome" }
  | { kind: "gallery"; type: DocType }
  | { kind: "library" }
  | { kind: "editor"; docId: string };

export function newDocId(): string {
  // Time-ordered, base-36 — sortable by created timestamp without an index.
  const ts = Date.now().toString(36);
  const rnd = Math.random().toString(36).slice(2, 8);
  return `doc-${ts}-${rnd}`;
}

export function emptyDoc(type: DocType, owner: string, name: string): StudioDoc {
  const now = new Date().toISOString();
  return {
    id: newDocId(),
    owner,
    type,
    name,
    payload: null,
    tags: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function isAnalystOwner(owner: string): boolean {
  // Mirrors isAnalyst() from user-context. We can't import the React context
  // here (this module is also pulled into the API route), so we duplicate the
  // shallow name check — there's only one Analyst persona today.
  return owner === "Analyst" || owner === "anon" || owner === "";
}

// ─── Chart document payload ──────────────────────────────────────────────
// What ChartMaker2 (and editor-chart) read on hydrate + emit on change.
// Fields are duck-typed (`string` / `unknown`) at this layer to keep the
// storage + API code decoupled from chart-maker-2.tsx; the editor casts to
// its strongly-typed internals on the way in/out.
export interface ChartDocPayload {
  kind: "chart";
  version: 1;
  // ChartType (e.g. "stacked", "stackedPosNeg", "line"). Seeded by Gallery
  // pick when minting a new doc, then updated as the user changes types.
  type?: string;
  title?: string;
  subtitle?: string;
  theme?: string;          // ThemeId
  backdrop?: string;       // BackdropKey
  backdropMode?: "dark" | "light";
  // Current-type sheet — i.e. the data being charted. Off-type sheets stay
  // in ChartMaker2's per-type cache but are not roundtripped here.
  sheet?: unknown;         // DataSheet
  annotations?: unknown[]; // Annotation[]
  chartAspect?: string;    // ChartAspect ("fit" | "free" | "16:9" | …)
  chartZoom?: "fit" | number;
  // Set by the Gallery when minting a new doc. ChartMaker2 reads this on
  // mount to know which chart type to seed; it's not re-emitted after.
  templateId?: string;
}

// ─── Table document payload ───────────────────────────────────────────────
// Independent of chart-maker-2's DataSheet — defined here so editor-table
// and any future consumer can stand on its own. Shape is intentionally a
// subset/superset compatible with the chart-maker-2 DataSheet so "build
// chart from selection" can drop a table sheet straight into a chart doc.

export type TableColumnType = "text" | "number" | "date" | "percent" | "badge";

// Per-cell color rule applied to numeric columns. "minMax" colors the
// extreme values green (max) and red (min). "highGood" inverts the
// red/green for columns where high = good. Renderer reads this on
// TableColumnSpec.condFmt.
export type TableCondFmt = "off" | "minMax" | "highGood";
export type TableCellValue  = string | number | null | undefined;

// Per-column number presentation. Independent of the column type so a
// "number" column can be shown as currency, K/M/B compact, fixed
// decimals, etc. Free-form prefix/suffix layer on top for "$" / "/hr"
// kind of decorations.
export type TableNumberFormat =
  | "default"
  | "int" | "dec1" | "dec2"
  | "pct"
  | "usd" | "usdK" | "usdM" | "usdB"
  | "k" | "m" | "b";

export interface TableColumnSpec {
  key: string;            // stable column id, never reused after delete
  label: string;          // header text shown to the user
  type: TableColumnType;
  numFmt?: TableNumberFormat;
  prefix?: string;        // rendered before the value, e.g. "🚀 " or "≈ "
  suffix?: string;        // rendered after the value, e.g. " /hr" or "x"
  width?: number;         // grid-editor width in px; set via drag-resize
  // Badge column rendering — { value → hex color }. Only honored when
  // type === "badge"; the renderer draws each cell as a colored pill
  // with the value as the label. Unmatched values get a neutral grey
  // pill.
  badgeMap?: Record<string, string>;
  // Conditional formatting on numeric columns. "minMax" highlights the
  // largest value in green + smallest in red. "highGood" flips when
  // a smaller number is the better outcome (e.g. price).
  condFmt?: TableCondFmt;
  // Per-column header tint — overrides the default dark header band
  // for THIS column. Used by colored-header chrome variants (e.g.
  // GB300 Power Budget where each column header is a different brand
  // color). Empty / undefined = inherit the chrome default.
  headerColor?: string;
}

// Per-row styling overrides keyed by 0-based row index. Lets the user
// (or a template seed) paint band colors, bold the row text, or apply
// a subtle alternating tint independently of chrome rules.
export interface TableRowStyle {
  band?: string;     // hex color of the row tint (background wash)
  bold?: boolean;    // render row text in sa-blk weight
  accent?: string;   // hex color for the LEFT-edge accent bar (3px)
}

export interface TableSheet {
  schema: TableColumnSpec[];
  rows: Array<Record<string, TableCellValue>>;
}

// SA-branded table modes:
//   - "data"    → amber title bar + neutral rows + one blue highlight row
//                 + KEY INSIGHT block. Best for cost breakdowns, comparisons.
//   - "heatmap" → color-coded cells (coral / yellow / teal) keyed to a
//                 threshold, axis labels, optional baseline-cell highlight,
//                 legend + INPUTS/CAVEATS panel. Best for sensitivity grids.
export type TableMode = "data" | "heatmap";

// One bullet in the Inputs / Caveats panel below a heatmap.
export interface TableInputItem {
  label: string;
  value?: string;
}

// Locked-in document metadata for the SA-branded rendering. Anything not
// here uses sensible defaults from sa-data-tables skill.
export interface TableDocPayload {
  kind: "table";
  version: 1;
  engine: "standard" | "univer";
  sheet: TableSheet;
  univerSnapshot?: unknown;
  templateId?: string;
  // SA-style metadata (Wave 19). Optional so existing v1 docs still load.
  mode?: TableMode;
  category?: string;           // eyebrow line, e.g. "SEMIANALYSIS — ROBOTICS"
  titleWhite?: string;         // primary title (white)
  titleAmber?: string;         // accent title (amber) appended after the white
  subtitle?: string;           // subtitle below title
  titleBar?: string;           // amber title bar across the top of the table itself (data mode)
  // Data mode extras
  highlightRowIdx?: number;    // row that gets the blue highlight band
  highlightFlagCol?: number;   // column in the highlight row to flag coral (the "this is the punchline" cell)
  keyInsight?: string;         // markdown-ish copy for the KEY INSIGHT block
  // Heatmap mode extras
  threshold?: number;          // value at which cells transition between teal/yellow/coral
  yellowBand?: number;         // half-width of the yellow break-even band around the threshold
  topAxisLabel?: string;       // e.g. "UTILIZATION →"
  leftAxisLabel?: string;      // rotated 90° on the left side
  baselineRow?: number;        // 0-based row of the "this is our base case" cell
  baselineCol?: number;        // 0-based column of the "this is our base case" cell
  // Panel under heatmap — either model inputs OR explanatory bullets
  panelKind?: "inputs" | "caveats";
  panelItems?: TableInputItem[];
  // Optional formula box at the very bottom of heatmaps
  formula?: string;
  formulaBaseline?: string;
  formulaResult?: string;
  // Auto-aggregate row appended below the data (data-mode only).
  aggregate?: "none" | "sum" | "avg" | "min" | "max";
  aggregateLabel?: string;
  // Export aspect preset — the live preview is always 1394×861 but the
  // user can stage exports for slides, social, etc. Defaults to "default".
  exportPreset?: "default" | "wide16x9" | "square" | "tall4x5" | "story9x16";
  // Chrome variant — picks what wrapping decoration the renderer shows
  // around the data area. "framed" is the legacy / default chrome with
  // category eyebrow + amber title bar + key-insight block. Others trim
  // or re-skin that frame so different templates feel visually distinct.
  chromeStyle?: TableChromeStyle;
  // Per-editable-field style overrides — wired into the inline-edit
  // toolbar so users can swap brand colors, alignment, and size on
  // individual title/subtitle/category fields without affecting the
  // rest of the chrome.
  fieldStyles?: Record<string, FieldStyle>;
  // Footer toggles — hide the SEMIANALYSIS.COM website chip or the
  // CONFIDENTIAL tag when the table is shared externally without those
  // anchors.
  hideWebsite?: boolean;
  hideConfidential?: boolean;
  // Free-form source attribution line — renders below the table, e.g.
  // "Source: SemiAnalysis estimates" or "Source: TSMC Q3 '26 earnings".
  source?: string;
  // Page (canvas) dimensions in pixels. Defaults to the legacy
  // 1394×861.7 frame; users can pick a smaller frame for simple tables
  // (e.g. 1080×600) or a square / story preset.
  pageW?: number;
  pageH?: number;
  // Hide the 4px brand gradient stripe at the top of the frame. The
  // stripe is the default SA decoration but reads as a stray blue line
  // when the user just wants the title bar.
  hideTopStripe?: boolean;
  // Alternate-row striping (Excel-style). When true, even rows get a
  // very faint white wash so the eye can track horizontally across
  // wide tables.
  showRowStripe?: boolean;
  // Column divider style — "solid" (legacy default), "dotted" for a
  // lighter spec-table feel, or "none" to drop the dividers entirely.
  dividerStyle?: "solid" | "dotted" | "none";
  // Per-row visual overrides keyed by 0-based row index. Templates
  // seed this for band rows + bold totals; the user can edit from the
  // properties rail.
  rowStyles?: Record<number, TableRowStyle>;
  // Global font-size multiplier — bumps every text + row height in
  // lockstep so smaller frames stay readable and larger frames stay
  // balanced. 1.0 = legacy default.
  fontScale?: number;
  // When true, the renderer derives fontScale automatically from the
  // current canvas dimensions (relative to the legacy 1394×861 base)
  // so picking a smaller canvas preset auto-shrinks the typography.
  // User can still override by setting fontScale explicitly.
  autoFontScale?: boolean;
  // Per-cell annotations keyed by `${rowIdx}:${colKey}`. Set via the
  // Annotate mode in the editor toolbar — supports background tint,
  // text color, border (dotted / dashed / solid), and a bold toggle.
  cellStyles?: Record<string, CellStyle>;
}

export interface CellStyle {
  bg?: string;          // cell background fill (with alpha applied)
  color?: string;       // text color override
  border?: "solid" | "dotted" | "dashed";
  borderColor?: string; // border stroke color
  bold?: boolean;
}

export type TableChromeStyle = "framed" | "dense" | "leaderboard" | "sectioned" | "colored-headers" | "banded-spec" | "totaled";

export interface FieldStyle {
  color?: string;       // brand-only swatch (#F7B041 amber, #0B86D1 blue, etc.)
  align?: "left" | "center" | "right";
  size?: number;        // px override on top of renderer default
}

// ─── Diagram document payload ────────────────────────────────────────────

// Shape kinds available in the diagram editor. Categorized for the palette:
//   - "rect" / "ellipse" / "text" / "arrow" / "line" : v1 primitives
//   - "triangle" / "diamond" / "parallelogram" / "rounded" : v2 basics
//   - "flowStart" / "flowEnd" / "flowDecision" / "flowProcess" /
//     "flowData" / "flowIO" : Flowchart library
//   - "gateAnd" / "gateOr" / "gateNot" / "gateNand" / "gateNor" /
//     "gateXor" / "resistor" / "capacitor" / "battery" / "ground" :
//     Circuit primitives
export type DiagramShapeKind =
  | "rect" | "ellipse" | "text" | "arrow" | "line"
  | "triangle" | "diamond" | "parallelogram" | "rounded"
  | "flowStart" | "flowEnd" | "flowDecision" | "flowProcess" | "flowData" | "flowIO"
  | "gateAnd" | "gateOr" | "gateNot" | "gateNand" | "gateNor" | "gateXor"
  | "resistor" | "capacitor" | "battery" | "ground"
  // Hardware — physical compute infrastructure
  | "hwRack" | "hwServer" | "hwGpu" | "hwSwitch" | "hwPsu" | "hwCdu"
  // Network topology
  | "netSwitch" | "netRouter" | "netFabric" | "netNic"
  // Semiconductor / package
  | "semiDie" | "semiChiplet" | "semiHbm" | "semiInterposer" | "semiSubstrate"
  // Power / electrical
  | "pwrTransformer" | "pwrBusbar" | "pwrPdu" | "pwrUps" | "pwrBreaker";

export interface DiagramNode {
  id: string;
  kind: DiagramShapeKind;
  x: number; y: number; w: number; h: number;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  text?: string;
  fontSize?: number;
  rotation?: number;
  // Explicit label color. When unset, the renderer derives a readable
  // color from the fill luminance so dark shapes get white text and
  // light shapes get near-black text.
  textColor?: string;
  textAlign?: "left" | "center" | "right";
  // Set on dedicated title/subtitle text nodes added via the Title /
  // Subtitle toolbar buttons. Lets the renderer pick the right font
  // size + color scale without inferring from text content.
  role?: "title" | "subtitle";
}

// An edge endpoint either attaches to a node's side (and tracks it as the
// node moves) or sits at a fixed canvas coordinate. Side is the cardinal
// edge of the node — center, top, right, bottom, left.
export type EdgeSide = "top" | "right" | "bottom" | "left" | "center";
export type EdgeEndpoint =
  | { kind: "node"; nodeId: string; side: EdgeSide }
  | { kind: "point"; x: number; y: number };

export interface DiagramEdge {
  id: string;
  from: EdgeEndpoint;
  to:   EdgeEndpoint;
  stroke?: string;
  strokeWidth?: number;
  dashed?: boolean;
  arrowEnd?: boolean;   // default true
  arrowStart?: boolean; // default false
}

export interface DiagramDocPayload {
  kind: "diagram";
  version: 1;
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  canvasW: number;
  canvasH: number;
  // Viewport persisted so reopening lands you where you left off.
  viewport?: { x: number; y: number; scale: number };
  templateId?: string;
  // SA-brand backdrop applied to the page-frame rectangle. "dark" /
  // "light" map to the studio backdrop palette; "solid:#xxxxxx" is a
  // user-picked override. Unset = legacy dark.
  backdrop?: string;
  // Optional title + subtitle baked into the document. The toolbar
  // "Add title" / "Add subtitle" buttons drop dedicated text nodes
  // whose role is set on the node itself; these payload fields are
  // reserved for future top-of-page composition.
}
