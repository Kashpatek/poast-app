// Diagram shape library — per-kind defaults, port positions, SVG path
// generators for non-primitive shapes (flowchart symbols, logic gates).
//
// Edges anchor to a node by side; port helpers convert (node, side) to
// canvas-space {x, y} so the renderer can draw connector polylines.

import { DiagramNode, DiagramShapeKind, EdgeSide } from "../studio-types";
import { D } from "../studio-theme";

export interface ShapeLibraryItem {
  kind: DiagramShapeKind;
  label: string;
  // Default width/height when the user drops the shape.
  w: number;
  h: number;
  fill?: string;
  stroke?: string;
  defaultText?: string;
}

export interface ShapeLibraryCategory {
  id: "basic" | "flow" | "circuit";
  label: string;
  items: ShapeLibraryItem[];
}

export const SHAPE_LIBRARY: ShapeLibraryCategory[] = [
  {
    id: "basic",
    label: "Basic",
    items: [
      { kind: "rect",          label: "Rectangle",     w: 140, h: 80,  fill: D.amber, stroke: D.amber + "AA" },
      { kind: "rounded",       label: "Rounded",       w: 140, h: 80,  fill: D.amber, stroke: D.amber + "AA" },
      { kind: "ellipse",       label: "Ellipse",       w: 140, h: 80,  fill: D.teal,  stroke: D.teal + "AA" },
      { kind: "triangle",      label: "Triangle",      w: 120, h: 100, fill: D.coral, stroke: D.coral + "AA" },
      { kind: "diamond",       label: "Diamond",       w: 130, h: 100, fill: D.blue,  stroke: D.blue + "AA" },
      { kind: "parallelogram", label: "Parallelogram", w: 150, h: 80,  fill: D.violet, stroke: D.violet + "AA" },
      { kind: "text",          label: "Text",          w: 140, h: 30,  fill: D.tx,    stroke: "transparent", defaultText: "Text" },
      { kind: "arrow",         label: "Arrow",         w: 120, h: 0,   stroke: D.blue },
      { kind: "line",          label: "Line",          w: 120, h: 0,   stroke: D.violet },
    ],
  },
  {
    id: "flow",
    label: "Flowchart",
    items: [
      { kind: "flowStart",    label: "Start",    w: 140, h: 60,  fill: D.teal,   stroke: D.teal + "AA",   defaultText: "Start" },
      { kind: "flowEnd",      label: "End",      w: 140, h: 60,  fill: D.coral,  stroke: D.coral + "AA",  defaultText: "End" },
      { kind: "flowProcess",  label: "Process",  w: 160, h: 70,  fill: D.amber,  stroke: D.amber + "AA",  defaultText: "Process" },
      { kind: "flowDecision", label: "Decision", w: 160, h: 110, fill: D.blue,   stroke: D.blue + "AA",   defaultText: "Decision?" },
      { kind: "flowData",     label: "Data",     w: 160, h: 70,  fill: D.violet, stroke: D.violet + "AA", defaultText: "Data" },
      { kind: "flowIO",       label: "I/O",      w: 160, h: 70,  fill: D.cyan,   stroke: D.cyan + "AA",   defaultText: "I/O" },
    ],
  },
  {
    id: "circuit",
    label: "Circuit",
    items: [
      { kind: "gateAnd",  label: "AND",  w: 80, h: 60, fill: D.amber + "33", stroke: D.amber },
      { kind: "gateOr",   label: "OR",   w: 80, h: 60, fill: D.amber + "33", stroke: D.amber },
      { kind: "gateNot",  label: "NOT",  w: 80, h: 50, fill: D.amber + "33", stroke: D.amber },
      { kind: "gateNand", label: "NAND", w: 80, h: 60, fill: D.amber + "33", stroke: D.amber },
      { kind: "gateNor",  label: "NOR",  w: 80, h: 60, fill: D.amber + "33", stroke: D.amber },
      { kind: "gateXor",  label: "XOR",  w: 80, h: 60, fill: D.amber + "33", stroke: D.amber },
      { kind: "resistor",  label: "Resistor",  w: 90, h: 28, fill: "transparent", stroke: D.teal },
      { kind: "capacitor", label: "Capacitor", w: 60, h: 40, fill: "transparent", stroke: D.teal },
      { kind: "battery",   label: "Battery",   w: 60, h: 50, fill: "transparent", stroke: D.teal },
      { kind: "ground",    label: "Ground",    w: 50, h: 50, fill: "transparent", stroke: D.teal },
    ],
  },
];

export function libraryItemFor(kind: DiagramShapeKind): ShapeLibraryItem | null {
  for (const cat of SHAPE_LIBRARY) {
    const it = cat.items.find(i => i.kind === kind);
    if (it) return it;
  }
  return null;
}

// Cardinal port position on a node's axis-aligned bounding box. Rotation is
// intentionally ignored — connectors snap to the unrotated box so the
// math stays predictable for routing.
export function portPosition(node: DiagramNode, side: EdgeSide): { x: number; y: number } {
  const cx = node.x + node.w / 2;
  const cy = node.y + node.h / 2;
  if (side === "top")    return { x: cx,             y: node.y };
  if (side === "right")  return { x: node.x + node.w, y: cy };
  if (side === "bottom") return { x: cx,             y: node.y + node.h };
  if (side === "left")   return { x: node.x,         y: cy };
  return { x: cx, y: cy };
}

// Pick the nearest cardinal port on a node, given a point. Used by the
// connector drag-out to "snap" the user's pointer to the closest port
// when they hover over a target node.
export function nearestPort(node: DiagramNode, x: number, y: number): EdgeSide {
  const candidates: EdgeSide[] = ["top", "right", "bottom", "left"];
  let best: EdgeSide = "right";
  let bestD = Infinity;
  for (const s of candidates) {
    const p = portPosition(node, s);
    const dx = p.x - x, dy = p.y - y;
    const d = dx * dx + dy * dy;
    if (d < bestD) { bestD = d; best = s; }
  }
  return best;
}

// Hit-test: is (x, y) within `slop` pixels of a node (used by the connector
// tool to know when to snap to a target).
export function pointHitsNode(node: DiagramNode, x: number, y: number, slop = 8): boolean {
  return x >= node.x - slop && x <= node.x + node.w + slop
      && y >= node.y - slop && y <= node.y + node.h + slop;
}

export function snapToGrid(v: number, grid: number): number {
  if (grid <= 0) return v;
  return Math.round(v / grid) * grid;
}

// True for shapes whose "size" only carries a width (lines/arrows where
// h is reused as a Y-delta vector, not a height).
export function isVectorShape(kind: DiagramShapeKind): boolean {
  return kind === "arrow" || kind === "line";
}

// True for shapes that ignore w/h × scale on rotation — pure text/labels.
export function isTextLikeShape(kind: DiagramShapeKind): boolean {
  return kind === "text";
}
