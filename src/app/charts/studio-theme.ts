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

// SA-brand backdrop presets for the diagram canvas. `id` is what gets
// persisted in DiagramDocPayload.backdrop; `bg` is the solid CSS color
// painted under the page rect. Items flagged isLight expect dark text;
// the rest expect white text (the canvas reads this to flip labels
// without each shape needing a per-node textColor override).
export interface DiagramBackdrop {
  id: string;
  label: string;
  bg: string;
  isLight: boolean;
  // Optional CSS overlay (gradient or radial wash) painted as a second
  // layer over `bg` to give the canvas the SA glow look.
  overlay?: string;
}

export const DIAGRAM_BACKDROPS: DiagramBackdrop[] = [
  { id: "sa-dark",   label: "SA Dark",    bg: "#0A0C10", isLight: false,
    overlay: "radial-gradient(circle at 25% 15%, rgba(11,134,209,0.10), transparent 55%), radial-gradient(circle at 85% 90%, rgba(247,176,65,0.10), transparent 50%)" },
  { id: "sa-light",  label: "SA Light",   bg: "#F4F1EA", isLight: true,
    overlay: "radial-gradient(circle at 25% 15%, rgba(11,134,209,0.06), transparent 55%), radial-gradient(circle at 85% 90%, rgba(247,176,65,0.08), transparent 50%)" },
  { id: "sa-paper",  label: "SA Paper",   bg: "#1A1B22", isLight: false,
    overlay: "linear-gradient(180deg, rgba(255,255,255,0.04), transparent 35%)" },
  { id: "sa-cream",  label: "Cream",      bg: "#FAF6EE", isLight: true },
  { id: "sa-navy",   label: "Deep Navy",  bg: "#0B1428", isLight: false },
  { id: "sa-graph",  label: "Graph Grid", bg: "#0B0C12", isLight: false,
    overlay: "linear-gradient(rgba(247,176,65,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(247,176,65,0.04) 1px, transparent 1px)" },
  { id: "sa-amber",  label: "Amber Wash", bg: "#1A1208", isLight: false,
    overlay: "radial-gradient(circle at 50% 30%, rgba(247,176,65,0.18), transparent 60%)" },
  { id: "sa-teal",   label: "Teal Wash",  bg: "#06181A", isLight: false,
    overlay: "radial-gradient(circle at 60% 40%, rgba(46,173,142,0.22), transparent 60%)" },
];

export function backdropById(id: string | undefined): DiagramBackdrop {
  if (!id) return DIAGRAM_BACKDROPS[0];
  return DIAGRAM_BACKDROPS.find(b => b.id === id) || DIAGRAM_BACKDROPS[0];
}

// Save-state pill colors — shared by every editor header so the indicator
// looks identical whether you're saving a chart, table, or diagram.
export const SAVE_STATE_COLOR: Record<"idle" | "saving" | "saved" | "error", string> = {
  idle:   D.txd,
  saving: D.amber,
  saved:  D.teal,
  error:  D.coral,
};
