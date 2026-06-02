// Editable hit-zones for the inline-edit overlay. Shared between
// SaTableSvg (which paints the click targets) and editor-table (which
// positions HTML inputs at the same coords). All rects are in
// SaTableSvg's viewBox space (1394 × 861.7). Coords picked to match
// the actual painted positions in lib/sa-table-svg.tsx.

export type EditableField =
  | "category"
  | "titleWhite"
  | "titleAmber"
  | "subtitle"
  | "titleBar"
  | "keyInsight"
  | "topAxisLabel"
  | "leftAxisLabel";

export interface EditableRegion {
  x: number; y: number; w: number; h: number;
  multiline?: boolean;
  // Some regions only exist in one mode — gate them in the editor.
  mode?: "data" | "heatmap";
}

export const EDITABLE_REGIONS: Record<EditableField, EditableRegion> = {
  category:      { x: 76,  y: 28,  w: 700,  h: 22 },
  titleWhite:    { x: 76,  y: 56,  w: 700,  h: 32 },
  titleAmber:    { x: 76,  y: 86,  w: 1240, h: 28 }, // sits visually after white via dx
  subtitle:      { x: 76,  y: 92,  w: 1240, h: 22 },
  titleBar:      { x: 33,  y: 152, w: 1328, h: 42, mode: "data" },
  keyInsight:    { x: 80,  y: 720, w: 1234, h: 110, mode: "data", multiline: true },
  topAxisLabel:  { x: 280, y: 156, w: 670,  h: 22, mode: "heatmap" },
  leftAxisLabel: { x: 14,  y: 250, w: 100,  h: 270, mode: "heatmap" },
};
