"use client";

// POAST Studio · Diagram canvas v2.
//
// react-konva Stage with:
//   - infinite pan/zoom (wheel-zoom anchored to cursor, space-drag pan)
//   - snap-to-grid (10px default, hold Alt to free-move)
//   - shape library with custom path renderers (flowchart symbols,
//     logic gates, passive circuit elements)
//   - connector tool — drag from a node port, snap to a target node's
//     nearest port. Edges re-route automatically when either endpoint
//     node moves because the renderer recomputes endpoint positions
//     from current node positions every paint.
//   - inline text edit via a positioned HTML overlay on double-click
//
// This file is the only react-konva consumer. The editor wrapper
// (editor-diagram.tsx) imports it via next/dynamic with ssr:false.

import Konva from "konva";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Arrow as KArrow, Ellipse as KEllipse, Group, Layer, Line as KLine,
  Path, Rect as KRect, Stage, Text as KText, Transformer,
} from "react-konva";
import {
  isVectorShape, libraryItemFor, nearestPort, pointHitsNode, portPosition,
  snapToGrid,
} from "./lib/diagram-shapes";
import {
  DiagramEdge, DiagramNode, EdgeEndpoint, EdgeSide,
} from "./studio-types";

export type DiagramTool = "select" | "pan" | "connector" | "place";

export interface DiagramCanvasProps {
  width: number;
  height: number;
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  selectedId: string | null;
  // "place" mode means the user picked a shape from the library and the
  // next click drops it. The current placeKind tells the canvas what
  // to drop. After placement, the parent flips tool back to "select".
  tool: DiagramTool;
  placeKind: import("./studio-types").DiagramShapeKind | null;
  viewport: { x: number; y: number; scale: number };
  gridSize: number;
  fill: string;
  stroke: string;
  onSelect: (id: string | null) => void;
  onCreate: (node: DiagramNode) => void;
  onMutate: (id: string, patch: Partial<DiagramNode>) => void;
  onAddEdge: (edge: DiagramEdge) => void;
  onChangeViewport: (v: { x: number; y: number; scale: number }) => void;
  onEditText?: (nodeId: string) => void;
  registerExport?: (getDataUrl: () => string) => void;
}

const PORT_SIDES: EdgeSide[] = ["top", "right", "bottom", "left"];

export default function DiagramCanvas(props: DiagramCanvasProps) {
  const {
    width, height, nodes, edges, selectedId, tool, placeKind, viewport,
    gridSize, fill, stroke,
    onSelect, onCreate, onMutate, onAddEdge, onChangeViewport,
    onEditText, registerExport,
  } = props;

  const stageRef = useRef<Konva.Stage | null>(null);
  const transformerRef = useRef<Konva.Transformer | null>(null);
  const nodeRefs = useRef<Record<string, Konva.Node>>({});
  const [spaceDown, setSpaceDown] = useState(false);
  // Active drag-out connector — the in-progress line that follows the
  // pointer between mousedown on a port and mouseup on a target.
  const [pendingEdge, setPendingEdge] = useState<{
    from: EdgeEndpoint;
    toPoint: { x: number; y: number };
    hoverTarget: { nodeId: string; side: EdgeSide } | null;
  } | null>(null);

  // Track pan-drag state for space-drag panning. We stash the start
  // pointer pos + the viewport pos so we can compute the delta.
  const panRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);

  useEffect(() => {
    function down(e: KeyboardEvent) {
      const tgt = e.target as HTMLElement | null;
      const typing = tgt && (tgt.tagName === "INPUT" || tgt.tagName === "TEXTAREA" || tgt.isContentEditable);
      if (typing) return;
      if (e.code === "Space") { e.preventDefault(); setSpaceDown(true); }
    }
    function up(e: KeyboardEvent) {
      if (e.code === "Space") setSpaceDown(false);
    }
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  // Hook the transformer to the selected node.
  useEffect(() => {
    const tr = transformerRef.current;
    if (!tr) return;
    const node = selectedId ? nodeRefs.current[selectedId] : null;
    tr.nodes(node ? [node] : []);
    tr.getLayer()?.batchDraw();
  }, [selectedId, nodes]);

  useEffect(() => {
    if (!registerExport) return;
    registerExport(() => stageRef.current?.toDataURL({ pixelRatio: 2 }) || "");
  }, [registerExport]);

  // Convert a stage-space pointer position to world (canvas) coordinates.
  const worldOf = useCallback((sx: number, sy: number) => ({
    x: (sx - viewport.x) / viewport.scale,
    y: (sy - viewport.y) / viewport.scale,
  }), [viewport]);

  // ── Wheel zoom — anchored at the cursor ──────────────────────────────
  const handleWheel = useCallback((e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    const stage = e.target.getStage();
    if (!stage) return;
    const pointer = stage.getPointerPosition();
    if (!pointer) return;
    const oldScale = viewport.scale;
    const direction = e.evt.deltaY > 0 ? -1 : 1;
    const factor = direction > 0 ? 1.06 : 1 / 1.06;
    const newScale = Math.max(0.2, Math.min(4, oldScale * factor));
    const wx = (pointer.x - viewport.x) / oldScale;
    const wy = (pointer.y - viewport.y) / oldScale;
    onChangeViewport({
      scale: newScale,
      x: pointer.x - wx * newScale,
      y: pointer.y - wy * newScale,
    });
  }, [viewport, onChangeViewport]);

  // ── Stage mouse handlers ─────────────────────────────────────────────
  // Three behaviors are multiplexed here: pan-drag (when space is held
  // or tool === "pan"), connector drag-out (tool === "connector"), and
  // place-on-click (tool === "place").
  const handleStageMouseDown = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    const stage = e.target.getStage();
    if (!stage) return;
    const pointer = stage.getPointerPosition();
    if (!pointer) return;
    const inPanMode = tool === "pan" || spaceDown;
    if (inPanMode) {
      panRef.current = {
        startX: pointer.x, startY: pointer.y,
        origX: viewport.x, origY: viewport.y,
      };
      return;
    }
    if (tool === "connector") {
      const world = worldOf(pointer.x, pointer.y);
      // Find the node under the pointer (top-most wins).
      const hit = [...nodes].reverse().find(n => pointHitsNode(n, world.x, world.y, 4));
      if (!hit) return;
      const side = nearestPort(hit, world.x, world.y);
      setPendingEdge({
        from: { kind: "node", nodeId: hit.id, side },
        toPoint: portPosition(hit, side),
        hoverTarget: null,
      });
      return;
    }
    if (tool === "place" && placeKind) {
      const world = worldOf(pointer.x, pointer.y);
      const tpl = libraryItemFor(placeKind);
      if (!tpl) return;
      const w = tpl.w, h = tpl.h;
      const sx = snapToGrid(world.x - w / 2, gridSize);
      const sy = snapToGrid(world.y - (isVectorShape(placeKind) ? 0 : h / 2), gridSize);
      const id = "n-" + Math.random().toString(36).slice(2, 9);
      const node: DiagramNode = {
        id,
        kind: placeKind,
        x: sx, y: sy,
        w, h,
        fill: tpl.fill ?? fill,
        stroke: tpl.stroke ?? stroke,
        strokeWidth: 2,
        text: tpl.defaultText,
        fontSize: placeKind === "text" ? 18 : 14,
      };
      onCreate(node);
      onSelect(id);
      return;
    }
    // Select mode — click on empty stage clears selection.
    if (e.target === stage) onSelect(null);
  };

  const handleStageMouseMove = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    const stage = e.target.getStage();
    if (!stage) return;
    const pointer = stage.getPointerPosition();
    if (!pointer) return;
    if (panRef.current) {
      onChangeViewport({
        scale: viewport.scale,
        x: panRef.current.origX + (pointer.x - panRef.current.startX),
        y: panRef.current.origY + (pointer.y - panRef.current.startY),
      });
      return;
    }
    if (pendingEdge) {
      const world = worldOf(pointer.x, pointer.y);
      const hover = [...nodes].reverse().find(n => {
        if (pendingEdge.from.kind === "node" && pendingEdge.from.nodeId === n.id) return false;
        return pointHitsNode(n, world.x, world.y, 8);
      });
      if (hover) {
        const side = nearestPort(hover, world.x, world.y);
        setPendingEdge({
          ...pendingEdge,
          toPoint: portPosition(hover, side),
          hoverTarget: { nodeId: hover.id, side },
        });
      } else {
        setPendingEdge({
          ...pendingEdge,
          toPoint: world,
          hoverTarget: null,
        });
      }
    }
  };

  const handleStageMouseUp = () => {
    if (panRef.current) { panRef.current = null; return; }
    if (pendingEdge) {
      if (pendingEdge.hoverTarget) {
        const id = "e-" + Math.random().toString(36).slice(2, 9);
        onAddEdge({
          id,
          from: pendingEdge.from,
          to: { kind: "node", nodeId: pendingEdge.hoverTarget.nodeId, side: pendingEdge.hoverTarget.side },
          stroke: stroke || "#E8E4DD",
          strokeWidth: 2,
          arrowEnd: true,
        });
      }
      setPendingEdge(null);
    }
  };

  // ── Resolve edge endpoint positions for rendering ────────────────────
  const resolveEdge = useCallback((endpoint: EdgeEndpoint): { x: number; y: number } | null => {
    if (endpoint.kind === "point") return { x: endpoint.x, y: endpoint.y };
    const target = nodes.find(n => n.id === endpoint.nodeId);
    if (!target) return null;
    return portPosition(target, endpoint.side);
  }, [nodes]);

  const cursor = (() => {
    if (panRef.current || spaceDown || tool === "pan") return "grab";
    if (tool === "connector") return "crosshair";
    if (tool === "place")     return "copy";
    return "default";
  })();

  // ── Grid lines (only the visible viewport, not the whole world) ──────
  const visibleTopLeft = worldOf(0, 0);
  const visibleBottomRight = worldOf(width, height);
  const gridLines: number[][] = [];
  if (gridSize > 0 && viewport.scale > 0.3) {
    const startX = Math.floor(visibleTopLeft.x / gridSize) * gridSize;
    const endX   = Math.ceil(visibleBottomRight.x / gridSize) * gridSize;
    const startY = Math.floor(visibleTopLeft.y / gridSize) * gridSize;
    const endY   = Math.ceil(visibleBottomRight.y / gridSize) * gridSize;
    for (let x = startX; x <= endX; x += gridSize) {
      gridLines.push([x, startY, x, endY]);
    }
    for (let y = startY; y <= endY; y += gridSize) {
      gridLines.push([startX, y, endX, y]);
    }
  }

  return (
    <Stage
      ref={(s) => { stageRef.current = s; }}
      width={width}
      height={height}
      x={viewport.x}
      y={viewport.y}
      scaleX={viewport.scale}
      scaleY={viewport.scale}
      onMouseDown={handleStageMouseDown}
      onMouseMove={handleStageMouseMove}
      onMouseUp={handleStageMouseUp}
      onTouchStart={handleStageMouseDown}
      onTouchMove={handleStageMouseMove}
      onTouchEnd={handleStageMouseUp}
      onWheel={handleWheel}
      style={{ cursor, background: "#0A0A14" }}
    >
      <Layer listening={false}>
        {gridLines.map((pts, i) => (
          <KLine key={i} points={pts} stroke={"#FFFFFF" + (viewport.scale > 0.7 ? "10" : "08")} strokeWidth={1 / viewport.scale} />
        ))}
      </Layer>
      <Layer>
        {/* Edges first so shapes paint over them */}
        {edges.map((edge) => {
          const from = resolveEdge(edge.from);
          const to   = resolveEdge(edge.to);
          if (!from || !to) return null;
          return (
            <EdgeRenderer key={edge.id} edge={edge} from={from} to={to} />
          );
        })}
        {/* Pending edge (in-progress drag-out) */}
        {pendingEdge && (() => {
          const from = resolveEdge(pendingEdge.from);
          if (!from) return null;
          return (
            <KArrow
              points={[from.x, from.y, pendingEdge.toPoint.x, pendingEdge.toPoint.y]}
              fill={pendingEdge.hoverTarget ? "#F7B041" : "#E8E4DD"}
              stroke={pendingEdge.hoverTarget ? "#F7B041" : "#E8E4DD"}
              strokeWidth={2}
              pointerLength={10}
              pointerWidth={10}
              opacity={0.9}
              listening={false}
            />
          );
        })()}
        {/* Nodes */}
        {nodes.map((n) => (
          <NodeRenderer
            key={n.id}
            node={n}
            selected={selectedId === n.id}
            gridSize={gridSize}
            interactive={tool === "select"}
            onSelect={() => onSelect(n.id)}
            onMutate={(patch) => onMutate(n.id, patch)}
            onDoubleClick={() => onEditText?.(n.id)}
            attachRef={(ref) => {
              if (ref) nodeRefs.current[n.id] = ref;
              else delete nodeRefs.current[n.id];
            }}
          />
        ))}
        {/* Connector port handles — only visible in connector mode on hover */}
        {tool === "connector" && nodes.map((n) => (
          <Group key={"ports-" + n.id} listening={false}>
            {PORT_SIDES.map((s) => {
              const p = portPosition(n, s);
              const isHoverTarget =
                pendingEdge?.hoverTarget?.nodeId === n.id &&
                pendingEdge.hoverTarget.side === s;
              return (
                <KEllipse
                  key={s}
                  x={p.x} y={p.y}
                  radiusX={isHoverTarget ? 7 : 5}
                  radiusY={isHoverTarget ? 7 : 5}
                  fill={isHoverTarget ? "#F7B041" : "#0A0A14"}
                  stroke="#F7B041"
                  strokeWidth={2}
                />
              );
            })}
          </Group>
        ))}
        <Transformer
          ref={(t) => { transformerRef.current = t; }}
          rotateEnabled={true}
          flipEnabled={false}
          enabledAnchors={["top-left", "top-right", "bottom-left", "bottom-right", "middle-left", "middle-right", "top-center", "bottom-center"]}
          anchorSize={9}
          borderStroke="#F7B041"
          anchorStroke="#F7B041"
          anchorFill="#0A0A14"
          rotateAnchorOffset={28}
        />
      </Layer>
    </Stage>
  );
}

// ─── Edge renderer ───────────────────────────────────────────────────────

function EdgeRenderer({ edge, from, to }: {
  edge: DiagramEdge;
  from: { x: number; y: number };
  to:   { x: number; y: number };
}) {
  const stroke = edge.stroke || "#E8E4DD";
  const sw = edge.strokeWidth ?? 2;
  if (edge.arrowEnd === false && edge.arrowStart !== true) {
    return (
      <KLine
        points={[from.x, from.y, to.x, to.y]}
        stroke={stroke}
        strokeWidth={sw}
        dash={edge.dashed ? [8, 6] : undefined}
      />
    );
  }
  return (
    <KArrow
      points={[from.x, from.y, to.x, to.y]}
      stroke={stroke}
      fill={stroke}
      strokeWidth={sw}
      pointerLength={11}
      pointerWidth={11}
      pointerAtBeginning={edge.arrowStart}
      pointerAtEnding={edge.arrowEnd !== false}
      dash={edge.dashed ? [8, 6] : undefined}
    />
  );
}

// ─── Node renderer ───────────────────────────────────────────────────────

function NodeRenderer({ node, selected, gridSize, interactive, onSelect, onMutate, onDoubleClick, attachRef }: {
  node: DiagramNode;
  selected: boolean;
  gridSize: number;
  interactive: boolean;
  onSelect: () => void;
  onMutate: (patch: Partial<DiagramNode>) => void;
  onDoubleClick: () => void;
  attachRef: (ref: Konva.Node | null) => void;
}) {
  void selected;
  const common = {
    draggable: interactive,
    onClick: onSelect,
    onTap: onSelect,
    onDblClick: onDoubleClick,
    onDblTap: onDoubleClick,
    onDragEnd: (e: Konva.KonvaEventObject<DragEvent>) => {
      const nx = snapToGrid(e.target.x(), gridSize);
      const ny = snapToGrid(e.target.y(), gridSize);
      e.target.position({ x: nx, y: ny });
      onMutate({ x: nx, y: ny });
    },
    onTransformEnd: (e: Konva.KonvaEventObject<Event>) => {
      const k = e.target;
      const scaleX = k.scaleX();
      const scaleY = k.scaleY();
      const rotation = k.rotation();
      k.scaleX(1);
      k.scaleY(1);
      onMutate({
        x: snapToGrid(k.x(), gridSize),
        y: snapToGrid(k.y(), gridSize),
        w: Math.max(8, snapToGrid(node.w * scaleX, gridSize)),
        h: Math.max(0, snapToGrid(node.h * scaleY, gridSize)),
        rotation,
      });
    },
  };
  const fill = node.fill || "#F7B041";
  const stroke = node.stroke || (fill === "transparent" ? "#F7B041" : fill + "AA");
  const strokeWidth = node.strokeWidth ?? 2;

  // Most shapes share Group-with-text layout so the label sits inside.
  const withLabel = (inner: React.ReactNode) => (
    <Group
      {...common}
      ref={attachRef as (ref: Konva.Group | null) => void}
      x={node.x} y={node.y}
      width={node.w} height={node.h}
      rotation={node.rotation || 0}
    >
      {inner}
      {node.text && node.kind !== "text" && (
        <KText
          x={4} y={4}
          width={node.w - 8} height={node.h - 8}
          text={node.text}
          align="center" verticalAlign="middle"
          fontFamily="Outfit, sans-serif"
          fontSize={node.fontSize || 14}
          fontStyle="bold"
          fill="#0A0A14"
          listening={false}
        />
      )}
    </Group>
  );

  if (node.kind === "rect") {
    return withLabel(
      <KRect x={0} y={0} width={node.w} height={node.h}
        fill={fill} stroke={stroke} strokeWidth={strokeWidth}
        cornerRadius={2} />
    );
  }
  if (node.kind === "rounded") {
    return withLabel(
      <KRect x={0} y={0} width={node.w} height={node.h}
        fill={fill} stroke={stroke} strokeWidth={strokeWidth}
        cornerRadius={16} />
    );
  }
  if (node.kind === "ellipse") {
    return withLabel(
      <KEllipse x={node.w / 2} y={node.h / 2}
        radiusX={node.w / 2} radiusY={node.h / 2}
        fill={fill} stroke={stroke} strokeWidth={strokeWidth} />
    );
  }
  if (node.kind === "triangle") {
    return withLabel(
      <KLine
        points={[node.w / 2, 0, node.w, node.h, 0, node.h, node.w / 2, 0]}
        closed
        fill={fill} stroke={stroke} strokeWidth={strokeWidth}
      />
    );
  }
  if (node.kind === "diamond" || node.kind === "flowDecision") {
    return withLabel(
      <KLine
        points={[node.w / 2, 0, node.w, node.h / 2, node.w / 2, node.h, 0, node.h / 2, node.w / 2, 0]}
        closed
        fill={fill} stroke={stroke} strokeWidth={strokeWidth}
      />
    );
  }
  if (node.kind === "parallelogram") {
    const skew = node.h * 0.32;
    return withLabel(
      <KLine
        points={[skew, 0, node.w, 0, node.w - skew, node.h, 0, node.h, skew, 0]}
        closed
        fill={fill} stroke={stroke} strokeWidth={strokeWidth}
      />
    );
  }
  if (node.kind === "text") {
    return (
      <KText
        {...common}
        ref={attachRef as (ref: Konva.Text | null) => void}
        x={node.x} y={node.y}
        width={node.w} height={node.h}
        rotation={node.rotation || 0}
        text={node.text || "Text"}
        fontSize={node.fontSize || 18}
        fontStyle="bold"
        fontFamily="Outfit, sans-serif"
        fill={fill}
      />
    );
  }
  if (node.kind === "arrow" || node.kind === "line") {
    const points = [0, 0, node.w, node.h];
    return (
      <Group
        {...common}
        ref={attachRef as (ref: Konva.Group | null) => void}
        x={node.x} y={node.y}
        rotation={node.rotation || 0}
      >
        {node.kind === "arrow" ? (
          <KArrow
            points={points}
            pointerLength={12} pointerWidth={12}
            fill={stroke} stroke={stroke}
            strokeWidth={node.strokeWidth ?? 2.5}
          />
        ) : (
          <KLine
            points={points}
            stroke={stroke}
            strokeWidth={node.strokeWidth ?? 2.5}
          />
        )}
      </Group>
    );
  }
  if (node.kind === "flowStart" || node.kind === "flowEnd") {
    return withLabel(
      <KRect x={0} y={0} width={node.w} height={node.h}
        fill={fill} stroke={stroke} strokeWidth={strokeWidth}
        cornerRadius={node.h / 2} />
    );
  }
  if (node.kind === "flowProcess") {
    return withLabel(
      <KRect x={0} y={0} width={node.w} height={node.h}
        fill={fill} stroke={stroke} strokeWidth={strokeWidth}
        cornerRadius={4} />
    );
  }
  if (node.kind === "flowData") {
    const skew = node.h * 0.32;
    return withLabel(
      <KLine
        points={[skew, 0, node.w, 0, node.w - skew, node.h, 0, node.h, skew, 0]}
        closed
        fill={fill} stroke={stroke} strokeWidth={strokeWidth}
      />
    );
  }
  if (node.kind === "flowIO") {
    return withLabel(
      <KLine
        points={[node.w * 0.12, 0, node.w * 0.88, 0, node.w, node.h, 0, node.h, node.w * 0.12, 0]}
        closed
        fill={fill} stroke={stroke} strokeWidth={strokeWidth}
      />
    );
  }
  // Logic gates — drawn as SVG paths so we can render their cup/arc shapes
  // crisply. Each path is in 0..w / 0..h space.
  if (node.kind === "gateAnd" || node.kind === "gateNand") {
    const r = node.h / 2;
    const data = `M0 0 L${node.w * 0.55} 0 A${r} ${r} 0 0 1 ${node.w * 0.55} ${node.h} L0 ${node.h} Z`;
    return withLabel(
      <Group>
        <Path data={data} fill={fill} stroke={stroke} strokeWidth={strokeWidth} />
        {node.kind === "gateNand" && (
          <KEllipse x={node.w - 6} y={node.h / 2} radiusX={6} radiusY={6} fill={fill} stroke={stroke} strokeWidth={strokeWidth} />
        )}
      </Group>
    );
  }
  if (node.kind === "gateOr" || node.kind === "gateNor" || node.kind === "gateXor") {
    const data = `M0 0 Q${node.w * 0.25} ${node.h / 2} 0 ${node.h} Q${node.w * 0.5} ${node.h} ${node.w} ${node.h / 2} Q${node.w * 0.5} 0 0 0 Z`;
    return withLabel(
      <Group>
        {node.kind === "gateXor" && (
          <Path
            data={`M-6 0 Q${node.w * 0.25 - 6} ${node.h / 2} -6 ${node.h}`}
            stroke={stroke} strokeWidth={strokeWidth} fill="transparent"
          />
        )}
        <Path data={data} fill={fill} stroke={stroke} strokeWidth={strokeWidth} />
        {node.kind === "gateNor" && (
          <KEllipse x={node.w + 6} y={node.h / 2} radiusX={6} radiusY={6} fill={fill} stroke={stroke} strokeWidth={strokeWidth} />
        )}
      </Group>
    );
  }
  if (node.kind === "gateNot") {
    const data = `M0 0 L${node.w - 12} ${node.h / 2} L0 ${node.h} Z`;
    return withLabel(
      <Group>
        <Path data={data} fill={fill} stroke={stroke} strokeWidth={strokeWidth} />
        <KEllipse x={node.w - 6} y={node.h / 2} radiusX={6} radiusY={6} fill={fill} stroke={stroke} strokeWidth={strokeWidth} />
      </Group>
    );
  }
  if (node.kind === "resistor") {
    // Zig-zag resistor symbol with leads.
    const m = node.h / 2;
    const data = `M0 ${m} L${node.w * 0.18} ${m} L${node.w * 0.24} 0 L${node.w * 0.36} ${node.h} L${node.w * 0.48} 0 L${node.w * 0.60} ${node.h} L${node.w * 0.72} 0 L${node.w * 0.82} ${m} L${node.w} ${m}`;
    return withLabel(
      <Path data={data} fill="transparent" stroke={stroke} strokeWidth={strokeWidth + 0.5} />
    );
  }
  if (node.kind === "capacitor") {
    const m = node.h / 2;
    return withLabel(
      <Group>
        <KLine points={[0, m, node.w * 0.42, m]}                    stroke={stroke} strokeWidth={strokeWidth + 0.5} />
        <KLine points={[node.w * 0.42, 0, node.w * 0.42, node.h]}    stroke={stroke} strokeWidth={strokeWidth + 1} />
        <KLine points={[node.w * 0.58, 0, node.w * 0.58, node.h]}    stroke={stroke} strokeWidth={strokeWidth + 1} />
        <KLine points={[node.w * 0.58, m, node.w, m]}                stroke={stroke} strokeWidth={strokeWidth + 0.5} />
      </Group>
    );
  }
  if (node.kind === "battery") {
    const m = node.h / 2;
    return withLabel(
      <Group>
        <KLine points={[0, m, node.w * 0.3, m]}                              stroke={stroke} strokeWidth={strokeWidth + 0.5} />
        <KLine points={[node.w * 0.3, node.h * 0.15, node.w * 0.3, node.h * 0.85]} stroke={stroke} strokeWidth={strokeWidth + 1.4} />
        <KLine points={[node.w * 0.5, node.h * 0.3, node.w * 0.5, node.h * 0.7]}   stroke={stroke} strokeWidth={strokeWidth + 0.6} />
        <KLine points={[node.w * 0.5, m, node.w, m]}                          stroke={stroke} strokeWidth={strokeWidth + 0.5} />
      </Group>
    );
  }
  if (node.kind === "ground") {
    return withLabel(
      <Group>
        <KLine points={[node.w / 2, 0, node.w / 2, node.h * 0.45]}                stroke={stroke} strokeWidth={strokeWidth + 1} />
        <KLine points={[node.w * 0.10, node.h * 0.45, node.w * 0.90, node.h * 0.45]} stroke={stroke} strokeWidth={strokeWidth + 1} />
        <KLine points={[node.w * 0.25, node.h * 0.65, node.w * 0.75, node.h * 0.65]} stroke={stroke} strokeWidth={strokeWidth + 0.8} />
        <KLine points={[node.w * 0.38, node.h * 0.85, node.w * 0.62, node.h * 0.85]} stroke={stroke} strokeWidth={strokeWidth + 0.6} />
      </Group>
    );
  }
  // Fallback — should not happen because DiagramShapeKind is exhaustive.
  return withLabel(
    <KRect x={0} y={0} width={node.w} height={node.h}
      fill={fill} stroke={stroke} strokeWidth={strokeWidth} />
  );
}
