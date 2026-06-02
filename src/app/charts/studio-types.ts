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

export type TableColumnType = "text" | "number" | "date" | "percent";
export type TableCellValue  = string | number | null | undefined;

export interface TableColumnSpec {
  key: string;            // stable column id, never reused after delete
  label: string;          // header text shown to the user
  type: TableColumnType;
}

export interface TableSheet {
  schema: TableColumnSpec[];
  rows: Array<Record<string, TableCellValue>>;
}

export interface TableDocPayload {
  kind: "table";
  version: 1;
  engine: "standard" | "univer";
  sheet: TableSheet;
  // Univer roundtrips its full workbook as opaque JSON; we keep it as
  // unknown so we don't pull Univer types into this leaf module.
  univerSnapshot?: unknown;
  templateId?: string;
}

// ─── Diagram document payload ────────────────────────────────────────────

export type DiagramShapeKind = "rect" | "ellipse" | "text" | "arrow" | "line";

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
}

export interface DiagramEdge {
  id: string;
  from: string; to: string;
  stroke?: string;
  strokeWidth?: number;
  dashed?: boolean;
}

export interface DiagramDocPayload {
  kind: "diagram";
  version: 1;
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  canvasW: number;
  canvasH: number;
  templateId?: string;
}
