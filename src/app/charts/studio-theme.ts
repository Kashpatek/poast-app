// POAST Studio · shared theme tokens.
//
// One module imported by all three editors (chart / table / diagram) so the
// shell + canvas chrome look identical across doc types. Wraps the existing
// shared-constants D palette + adds Studio-specific helpers.

import { D, ft, gf, mn } from "../shared-constants";

export { D, ft, gf, mn };

export const STUDIO_COLORS = {
  amber:   D.amber,
  coral:   D.coral,
  blue:    D.blue,
  teal:    D.teal,
  violet:  D.violet,
  cyan:    D.cyan,
};

// Standard palette for diagram fills (also reusable as a chart-theme swatch
// row when the user wants brand-consistent colors).
export const DIAGRAM_PALETTE: string[] = [
  D.amber, D.coral, D.blue, D.teal, D.violet, D.cyan,
];

export type StudioBackdropMode = "dark" | "light";

export const STUDIO_BG_DARK  = "#06060A";
export const STUDIO_BG_LIGHT = "#F4F1EA";

export function studioBg(mode: StudioBackdropMode): string {
  return mode === "dark" ? STUDIO_BG_DARK : STUDIO_BG_LIGHT;
}

// Save-state pill colors — shared by every editor header so the indicator
// looks identical whether you're saving a chart, table, or diagram.
export const SAVE_STATE_COLOR: Record<"idle" | "saving" | "saved" | "error", string> = {
  idle:   D.txd,
  saving: D.amber,
  saved:  D.teal,
  error:  D.coral,
};
