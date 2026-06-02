"use client";

// Canvas layer of the DiagramEditor. Pulled in via next/dynamic so the
// react-konva bundle (canvas + konva ~120 KB) doesn't ship with SSR or
// non-diagram surfaces. All Konva imports live in this file ONLY.

import Konva from "konva";
import { useEffect, useRef } from "react";
import {
  Arrow as KArrow, Ellipse as KEllipse, Layer, Line as KLine, Rect as KRect,
  Stage, Text as KText, Transformer,
} from "react-konva";
import type { DiagramNode } from "./studio-types";

type Tool = "select" | "rect" | "ellipse" | "text" | "arrow" | "line";

export interface DiagramCanvasProps {
  width: number;
  height: number;
  nodes: DiagramNode[];
  selectedId: string | null;
  tool: Tool;
  fill: string;
  stroke: string;
  onSelect: (id: string | null) => void;
  onCreate: (node: DiagramNode) => void;
  onMutate: (id: string, patch: Partial<DiagramNode>) => void;
  // Callback so the parent can grab a PNG data URL via stage.toDataURL.
  // We expose it by ref-equivalent: parent calls registerExport with a
  // getter, then can read it whenever it needs to export.
  registerExport?: (getDataUrl: () => string) => void;
}

export default function DiagramCanvas({
  width, height, nodes, selectedId, tool, fill, stroke,
  onSelect, onCreate, onMutate, registerExport,
}: DiagramCanvasProps) {
  const stageRef = useRef<Konva.Stage | null>(null);
  const transformerRef = useRef<Konva.Transformer | null>(null);
  const nodeRefs = useRef<Record<string, Konva.Node>>({});

  // Hook the transformer to whichever node is selected.
  useEffect(() => {
    const tr = transformerRef.current;
    if (!tr) return;
    const node = selectedId ? nodeRefs.current[selectedId] : null;
    if (node) {
      tr.nodes([node]);
      tr.getLayer()?.batchDraw();
    } else {
      tr.nodes([]);
      tr.getLayer()?.batchDraw();
    }
  }, [selectedId, nodes]);

  // Expose a getter for parent-driven export.
  useEffect(() => {
    if (!registerExport) return;
    registerExport(() => stageRef.current?.toDataURL({ pixelRatio: 2 }) || "");
  }, [registerExport]);

  // Click on empty stage: either drop a new shape (if a non-select tool is
  // active) or clear selection (if select is active).
  const handleStageClick = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    // If the click hit a shape (not the stage itself), let the shape's
    // handler run — we shouldn't both select AND create.
    if (e.target !== e.target.getStage()) return;
    if (tool === "select") { onSelect(null); return; }
    const pos = e.target.getStage()?.getPointerPosition();
    if (!pos) return;
    const id = "n-" + Math.random().toString(36).slice(2, 9);
    const base: Partial<DiagramNode> = { id, fill, stroke, strokeWidth: 2 };
    if (tool === "rect") {
      onCreate({ ...(base as DiagramNode), kind: "rect", x: pos.x - 60, y: pos.y - 36, w: 120, h: 72 });
    } else if (tool === "ellipse") {
      onCreate({ ...(base as DiagramNode), kind: "ellipse", x: pos.x, y: pos.y, w: 120, h: 80 });
    } else if (tool === "text") {
      onCreate({ ...(base as DiagramNode), kind: "text", x: pos.x - 50, y: pos.y - 12, w: 140, h: 24, text: "Text", fontSize: 18, fill: stroke });
    } else if (tool === "line") {
      onCreate({ ...(base as DiagramNode), kind: "line", x: pos.x - 60, y: pos.y, w: 120, h: 0 });
    } else if (tool === "arrow") {
      onCreate({ ...(base as DiagramNode), kind: "arrow", x: pos.x - 60, y: pos.y, w: 120, h: 0 });
    }
    onSelect(id);
  };

  return (
    <Stage
      ref={(s) => { stageRef.current = s; }}
      width={width}
      height={height}
      onMouseDown={handleStageClick}
      onTouchStart={handleStageClick}
      style={{ cursor: tool === "select" ? "default" : "crosshair", background: "#0A0A14" }}
    >
      <Layer>
        {nodes.map((n) => (
          <NodeShape
            key={n.id}
            node={n}
            selected={selectedId === n.id}
            onSelect={() => onSelect(n.id)}
            onMutate={(patch) => onMutate(n.id, patch)}
            attachRef={(ref) => { if (ref) nodeRefs.current[n.id] = ref; else delete nodeRefs.current[n.id]; }}
          />
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

function NodeShape({ node, selected, onSelect, onMutate, attachRef }: {
  node: DiagramNode;
  selected: boolean;
  onSelect: () => void;
  onMutate: (patch: Partial<DiagramNode>) => void;
  attachRef: (ref: Konva.Node | null) => void;
}) {
  void selected;
  const commonProps = {
    draggable: true,
    onClick: onSelect,
    onTap: onSelect,
    onDragEnd: (e: Konva.KonvaEventObject<DragEvent>) => {
      onMutate({ x: e.target.x(), y: e.target.y() });
    },
    onTransformEnd: (e: Konva.KonvaEventObject<Event>) => {
      const k = e.target;
      const scaleX = k.scaleX();
      const scaleY = k.scaleY();
      const rotation = k.rotation();
      // Bake the scale back into w/h so future transforms start from 1.0.
      k.scaleX(1);
      k.scaleY(1);
      onMutate({
        x: k.x(),
        y: k.y(),
        w: Math.max(8, node.w * scaleX),
        h: Math.max(8, node.h * scaleY),
        rotation,
      });
    },
  };

  if (node.kind === "rect") {
    return (
      <KRect
        {...commonProps}
        ref={attachRef as (ref: Konva.Rect | null) => void}
        x={node.x} y={node.y}
        width={node.w} height={node.h}
        rotation={node.rotation || 0}
        fill={node.fill || "#F7B041"}
        stroke={node.stroke || "#F7B04188"}
        strokeWidth={node.strokeWidth ?? 2}
        cornerRadius={6}
        opacity={0.96}
      />
    );
  }
  if (node.kind === "ellipse") {
    return (
      <KEllipse
        {...commonProps}
        ref={attachRef as (ref: Konva.Ellipse | null) => void}
        x={node.x} y={node.y}
        radiusX={node.w / 2} radiusY={node.h / 2}
        rotation={node.rotation || 0}
        fill={node.fill || "#2EAD8E"}
        stroke={node.stroke || "#2EAD8E88"}
        strokeWidth={node.strokeWidth ?? 2}
        opacity={0.96}
      />
    );
  }
  if (node.kind === "text") {
    return (
      <KText
        {...commonProps}
        ref={attachRef as (ref: Konva.Text | null) => void}
        x={node.x} y={node.y}
        width={node.w} height={node.h}
        rotation={node.rotation || 0}
        text={node.text || "Text"}
        fontSize={node.fontSize || 18}
        fontStyle="bold"
        fontFamily="Outfit, sans-serif"
        fill={node.fill || "#E8E4DD"}
      />
    );
  }
  if (node.kind === "arrow") {
    return (
      <KArrow
        {...commonProps}
        ref={attachRef as (ref: Konva.Arrow | null) => void}
        x={node.x} y={node.y}
        rotation={node.rotation || 0}
        points={[0, 0, node.w, node.h]}
        pointerLength={12} pointerWidth={12}
        fill={node.stroke || "#0B86D1"}
        stroke={node.stroke || "#0B86D1"}
        strokeWidth={node.strokeWidth ?? 2.5}
      />
    );
  }
  // line
  return (
    <KLine
      {...commonProps}
      ref={attachRef as (ref: Konva.Line | null) => void}
      x={node.x} y={node.y}
      rotation={node.rotation || 0}
      points={[0, 0, node.w, node.h]}
      stroke={node.stroke || "#905CCB"}
      strokeWidth={node.strokeWidth ?? 2.5}
    />
  );
}
