"use client";

// DiagramEditor v2 — tldraw-flavored canvas plus a categorized shape
// library and a real connector tool. Wraps the react-konva canvas
// (loaded via next/dynamic) with a left palette + top toolbar + right
// properties panel. Saves nodes/edges/viewport into the doc payload.

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronLeft, ChevronRight, Download, GitBranch, Hand, Maximize2,
  MousePointer2, PanelRightClose, PanelRightOpen, RotateCcw, RotateCw,
  Trash2, ZoomIn, ZoomOut,
} from "lucide-react";
import { SHAPE_LIBRARY } from "./lib/diagram-shapes";
import { D, DIAGRAM_PALETTE, ft, gf, mn } from "./studio-theme";
import {
  DiagramDocPayload, DiagramEdge, DiagramNode, DiagramShapeKind, StudioDoc,
} from "./studio-types";
import type { DiagramCanvasProps, DiagramTool } from "./diagram-canvas";

const DiagramCanvas = dynamic<DiagramCanvasProps>(
  () => import("./diagram-canvas"),
  { ssr: false, loading: () => <CanvasFallback /> }
);

interface DiagramEditorProps {
  doc: StudioDoc;
  onChangePayload: (payload: unknown) => void;
}

const GRID_SIZE = 10;

export default function DiagramEditor({ doc, onChangePayload }: DiagramEditorProps) {
  const initial = useMemo(() => readPayload(doc.payload), [doc.payload]);
  const [nodes, setNodes] = useState<DiagramNode[]>(initial.nodes);
  const [edges, setEdges] = useState<DiagramEdge[]>(initial.edges);
  const [viewport, setViewport] = useState(initial.viewport);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tool, setTool] = useState<DiagramTool>("select");
  const [placeKind, setPlaceKind] = useState<DiagramShapeKind | null>(null);
  const [fill, setFill] = useState(DIAGRAM_PALETTE[0]);
  const [stroke, setStroke] = useState(DIAGRAM_PALETTE[2]);

  // Inline text edit state — when set, an HTML <input> overlays the node.
  const [textEditingId, setTextEditingId] = useState<string | null>(null);

  // Undo/redo — snapshots a (nodes, edges) tuple on every mutation.
  const [history, setHistory] = useState<Array<{ nodes: DiagramNode[]; edges: DiagramEdge[] }>>([]);
  const [future, setFuture] = useState<Array<{ nodes: DiagramNode[]; edges: DiagramEdge[] }>>([]);

  const canvasRef = useRef<HTMLDivElement | null>(null);
  const [canvasSize, setCanvasSize] = useState({ w: 1200, h: 640 });
  const exportRef = useRef<(() => string) | null>(null);

  // Resizable chrome — Canva-style. Widths persist in localStorage so the
  // user's preferred layout sticks across sessions.
  const [leftW, setLeftW] = useState(() => readStored("studio-diagram-leftW", 208));
  const [rightW, setRightW] = useState(() => readStored("studio-diagram-rightW", 252));
  const [rightOpen, setRightOpen] = useState(() => readStored("studio-diagram-rightOpen", 1) > 0);
  useEffect(() => writeStored("studio-diagram-leftW", leftW), [leftW]);
  useEffect(() => writeStored("studio-diagram-rightW", rightW), [rightW]);
  useEffect(() => writeStored("studio-diagram-rightOpen", rightOpen ? 1 : 0), [rightOpen]);

  // Page (canvas frame) dimensions — the bounded rectangle inside the
  // viewport that represents the export surface. User edits W/H from the
  // right panel; persisted on the payload as canvasW/canvasH.
  const [pageW, setPageW] = useState(() => clamp(initial.canvasW ?? 1200, 200, 8000));
  const [pageH, setPageH] = useState(() => clamp(initial.canvasH ?? 720, 200, 8000));

  useEffect(() => {
    if (!canvasRef.current) return;
    const update = () => {
      const r = canvasRef.current?.getBoundingClientRect();
      if (r) setCanvasSize({ w: Math.max(400, r.width - 4), h: Math.max(380, r.height - 4) });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(canvasRef.current);
    return () => ro.disconnect();
  }, []);

  // Emit payload upstream — shell debounces the save.
  useEffect(() => {
    const payload: DiagramDocPayload = {
      kind: "diagram",
      version: 1,
      nodes, edges,
      canvasW: pageW,
      canvasH: pageH,
      viewport,
    };
    onChangePayload(payload);
  }, [nodes, edges, pageW, pageH, viewport, onChangePayload]);

  const selected = nodes.find(n => n.id === selectedId) || null;

  const snapshot = useCallback(() => ({ nodes: nodes.slice(), edges: edges.slice() }), [nodes, edges]);

  const pushHistory = useCallback(() => {
    setHistory((h) => [...h.slice(-49), snapshot()]);
    setFuture([]);
  }, [snapshot]);

  const createNode = useCallback((n: DiagramNode) => {
    pushHistory();
    setNodes((cur) => [...cur, n]);
    setTool("select");
    setPlaceKind(null);
  }, [pushHistory]);

  const mutateNode = useCallback((id: string, patch: Partial<DiagramNode>) => {
    pushHistory();
    setNodes((cur) => cur.map(n => n.id === id ? { ...n, ...patch } : n));
  }, [pushHistory]);

  const addEdge = useCallback((edge: DiagramEdge) => {
    pushHistory();
    setEdges((cur) => [...cur, edge]);
  }, [pushHistory]);

  const deleteSelected = useCallback(() => {
    if (!selectedId) return;
    pushHistory();
    setNodes((cur) => cur.filter(n => n.id !== selectedId));
    // Drop any edges that pointed at the deleted node so we don't leave
    // orphan connectors floating in the canvas.
    setEdges((cur) => cur.filter(e =>
      (e.from.kind !== "node" || e.from.nodeId !== selectedId) &&
      (e.to.kind   !== "node" || e.to.nodeId   !== selectedId)
    ));
    setSelectedId(null);
  }, [selectedId, pushHistory]);

  const undo = useCallback(() => {
    setHistory((h) => {
      if (h.length === 0) return h;
      const prev = h[h.length - 1];
      setFuture((f) => [snapshot(), ...f.slice(0, 49)]);
      setNodes(prev.nodes);
      setEdges(prev.edges);
      return h.slice(0, -1);
    });
  }, [snapshot]);

  const redo = useCallback(() => {
    setFuture((f) => {
      if (f.length === 0) return f;
      const next = f[0];
      setHistory((h) => [...h.slice(-49), snapshot()]);
      setNodes(next.nodes);
      setEdges(next.edges);
      return f.slice(1);
    });
  }, [snapshot]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tgt = e.target as HTMLElement | null;
      const typing = tgt && (tgt.tagName === "INPUT" || tgt.tagName === "TEXTAREA" || tgt.isContentEditable);
      if (typing) return;
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo(); else undo();
        return;
      }
      if ((e.key === "Delete" || e.key === "Backspace") && selectedId) {
        e.preventDefault();
        deleteSelected();
        return;
      }
      if (e.key === "Escape") {
        setSelectedId(null);
        setTool("select");
        setPlaceKind(null);
        setTextEditingId(null);
      }
      if (e.key === "v" || e.key === "V") setTool("select");
      if (e.key === "h" || e.key === "H") setTool("pan");
      if (e.key === "c" || e.key === "C") setTool("connector");
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo, deleteSelected, selectedId]);

  const exportPng = useCallback(() => {
    const url = exportRef.current?.();
    if (!url) return;
    const a = document.createElement("a");
    a.href = url;
    a.download = (doc.name || "diagram") + ".png";
    a.click();
  }, [doc.name]);

  const zoomBy = useCallback((factor: number) => {
    setViewport((v) => {
      const newScale = Math.max(0.2, Math.min(4, v.scale * factor));
      const cx = canvasSize.w / 2;
      const cy = canvasSize.h / 2;
      const wx = (cx - v.x) / v.scale;
      const wy = (cy - v.y) / v.scale;
      return { scale: newScale, x: cx - wx * newScale, y: cy - wy * newScale };
    });
  }, [canvasSize]);

  const zoomReset = useCallback(() => {
    setViewport({ x: 0, y: 0, scale: 1 });
  }, []);

  // Fit page to viewport — centers the page rect with a 24px margin.
  const fitToViewport = useCallback(() => {
    const margin = 32;
    const sx = (canvasSize.w - margin * 2) / pageW;
    const sy = (canvasSize.h - margin * 2) / pageH;
    const scale = clamp(Math.min(sx, sy), 0.1, 4);
    setViewport({
      scale,
      x: (canvasSize.w - pageW * scale) / 2,
      y: (canvasSize.h - pageH * scale) / 2,
    });
  }, [canvasSize, pageW, pageH]);

  // ─── Render ────────────────────────────────────────────────────────
  return (
    <div style={{
      display: "flex",
      gap: 0,
      padding: "12px 14px 14px",
      maxWidth: "100%",
      margin: "0 auto",
      alignItems: "stretch",
      minHeight: "calc(100vh - 140px)",
    }}>
      <div style={{ width: leftW, minWidth: 140, maxWidth: 360, flexShrink: 0 }}>
        <ShapeLibraryPalette
          tool={tool} setTool={setTool}
          placeKind={placeKind}
          onPickShape={(k) => { setPlaceKind(k); setTool("place"); }}
        />
      </div>

      <ResizeHandle onDrag={(dx) => setLeftW((w) => clamp(w + dx, 140, 360))} />

      <div style={{
        flex: "1 1 auto",
        minWidth: 0,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        marginLeft: 8,
        marginRight: rightOpen ? 8 : 0,
      }}>
        <TopToolbar
          tool={tool} setTool={setTool}
          canUndo={history.length > 0}
          canRedo={future.length > 0}
          canDelete={!!selectedId}
          onUndo={undo} onRedo={redo}
          onDelete={deleteSelected}
          onExport={exportPng}
          zoom={viewport.scale}
          onZoomIn={() => zoomBy(1.2)}
          onZoomOut={() => zoomBy(1 / 1.2)}
          onZoomReset={zoomReset}
          onToggleRight={() => setRightOpen((v) => !v)}
          rightOpen={rightOpen}
        />
        <div
          ref={canvasRef}
          style={{
            flex: "1 1 auto",
            background: "#0A0A14",
            border: "1px solid " + D.border,
            borderRadius: 12,
            overflow: "hidden",
            minHeight: 520,
            position: "relative",
            boxShadow: "0 16px 38px rgba(0,0,0,0.45)",
          }}
        >
          <DiagramCanvas
            width={canvasSize.w}
            height={canvasSize.h}
            nodes={nodes}
            edges={edges}
            selectedId={selectedId}
            tool={tool}
            placeKind={placeKind}
            viewport={viewport}
            gridSize={GRID_SIZE}
            fill={fill}
            stroke={stroke}
            pageW={pageW}
            pageH={pageH}
            onSelect={setSelectedId}
            onCreate={createNode}
            onMutate={mutateNode}
            onAddEdge={addEdge}
            onChangeViewport={setViewport}
            onEditText={(id) => setTextEditingId(id)}
            registerExport={(g) => { exportRef.current = g; }}
          />
          {textEditingId && (() => {
            const n = nodes.find(x => x.id === textEditingId);
            if (!n) return null;
            return (
              <TextEditOverlay
                node={n}
                viewport={viewport}
                onCommit={(txt) => {
                  mutateNode(n.id, { text: txt });
                  setTextEditingId(null);
                }}
                onCancel={() => setTextEditingId(null)}
              />
            );
          })()}
          {nodes.length === 0 && tool !== "place" && (
            <div style={{
              position: "absolute", inset: 0,
              display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center",
              pointerEvents: "none", textAlign: "center",
            }}>
              <div style={{ fontFamily: gf, fontSize: 22, color: D.txm, fontWeight: 800, letterSpacing: -0.4 }}>
                Pick a shape from the left.
              </div>
              <div style={{ fontFamily: mn, fontSize: 10.5, color: D.txd, letterSpacing: 1, marginTop: 6 }}>
                V Select · H Pan · C Connector · ⌘Z undo · ⌫ delete
              </div>
            </div>
          )}
        </div>
        <BottomZoomBar
          scale={viewport.scale}
          onScale={(s) => {
            const newScale = clamp(s, 0.2, 4);
            const cx = canvasSize.w / 2;
            const cy = canvasSize.h / 2;
            const wx = (cx - viewport.x) / viewport.scale;
            const wy = (cy - viewport.y) / viewport.scale;
            setViewport({ scale: newScale, x: cx - wx * newScale, y: cy - wy * newScale });
          }}
          onFit={fitToViewport}
          onReset={zoomReset}
          pageW={pageW}
          pageH={pageH}
        />
      </div>

      {rightOpen ? (
        <>
          <ResizeHandle onDrag={(dx) => setRightW((w) => clamp(w - dx, 200, 440))} />
          <div style={{ width: rightW, minWidth: 200, maxWidth: 440, flexShrink: 0 }}>
            <PropertiesPanel
              selected={selected}
              fill={fill} setFill={setFill}
              stroke={stroke} setStroke={setStroke}
              onMutate={(patch) => { if (selected) mutateNode(selected.id, patch); }}
              onDelete={deleteSelected}
              edgeCount={edges.length}
              nodeCount={nodes.length}
              pageW={pageW}
              pageH={pageH}
              onChangePage={(w, h) => { setPageW(clamp(w, 200, 8000)); setPageH(clamp(h, 200, 8000)); }}
              onClose={() => setRightOpen(false)}
            />
          </div>
        </>
      ) : (
        <CollapsedRightStrip onOpen={() => setRightOpen(true)} />
      )}
    </div>
  );
}

// ─── Resizable side-panel handle ────────────────────────────────────────
// A narrow column with a center grab dot. onDrag fires with the delta-x
// in screen pixels per movement event.
function ResizeHandle({ onDrag }: { onDrag: (dx: number) => void }) {
  const drag = useRef<{ x: number } | null>(null);
  useEffect(() => {
    function move(e: MouseEvent) {
      if (!drag.current) return;
      onDrag(e.clientX - drag.current.x);
      drag.current.x = e.clientX;
    }
    function up() {
      drag.current = null;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    }
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
  }, [onDrag]);
  return (
    <div
      onMouseDown={(e) => {
        drag.current = { x: e.clientX };
        document.body.style.cursor = "col-resize";
        document.body.style.userSelect = "none";
      }}
      style={{
        width: 6, alignSelf: "stretch",
        cursor: "col-resize",
        display: "flex", alignItems: "center", justifyContent: "center",
        flexShrink: 0,
      }}
      title="Drag to resize"
    >
      <div style={{
        width: 2, height: 36,
        background: D.border,
        borderRadius: 2,
      }} />
    </div>
  );
}

// Thin strip shown when the right panel is collapsed; clicking it reopens.
function CollapsedRightStrip({ onOpen }: { onOpen: () => void }) {
  return (
    <button
      onClick={onOpen}
      title="Show properties (P)"
      style={{
        width: 24, alignSelf: "stretch",
        marginLeft: 8,
        background: D.card, border: "1px solid " + D.border, borderRadius: 8,
        cursor: "pointer",
        display: "flex", alignItems: "center", justifyContent: "center",
        flexShrink: 0,
        color: D.txm,
      }}
      onMouseEnter={(e) => { e.currentTarget.style.color = D.amber; e.currentTarget.style.borderColor = D.amber + "55"; }}
      onMouseLeave={(e) => { e.currentTarget.style.color = D.txm; e.currentTarget.style.borderColor = D.border; }}
    >
      <ChevronLeft size={14} strokeWidth={2.2} />
    </button>
  );
}

// ─── Bottom zoom bar — fixed below the canvas ──────────────────────────
function BottomZoomBar({ scale, onScale, onFit, onReset, pageW, pageH }: {
  scale: number;
  onScale: (s: number) => void;
  onFit: () => void;
  onReset: () => void;
  pageW: number;
  pageH: number;
}) {
  const pct = Math.round(scale * 100);
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12,
      padding: "8px 14px",
      background: D.card, border: "1px solid " + D.border, borderRadius: 10,
    }}>
      <div style={{
        fontFamily: mn, fontSize: 10, color: D.txd, letterSpacing: 0.6,
        textTransform: "uppercase", whiteSpace: "nowrap",
      }}>
        Page · {pageW} × {pageH}
      </div>
      <span style={{ width: 1, height: 16, background: D.border }} />
      <button
        onClick={onFit}
        title="Fit page to viewport"
        style={zoomChipStyle()}
      >
        <Maximize2 size={11} strokeWidth={2.2} /> Fit
      </button>
      <button
        onClick={onReset}
        title="Reset to 100%"
        style={zoomChipStyle()}
      >100%</button>
      <button
        onClick={() => onScale(scale / 1.2)}
        title="Zoom out"
        style={zoomChipStyle()}
      ><ZoomOut size={11} strokeWidth={2.2} /></button>
      <input
        type="range"
        min={20}
        max={400}
        step={1}
        value={pct}
        onChange={(e) => onScale(Number(e.target.value) / 100)}
        style={{
          flex: 1,
          accentColor: D.amber,
          cursor: "pointer",
        }}
      />
      <button
        onClick={() => onScale(scale * 1.2)}
        title="Zoom in"
        style={zoomChipStyle()}
      ><ZoomIn size={11} strokeWidth={2.2} /></button>
      <div style={{
        fontFamily: mn, fontSize: 11, color: D.tx, letterSpacing: 0.4,
        minWidth: 44, textAlign: "right", fontWeight: 700,
      }}>{pct}%</div>
    </div>
  );
}

function zoomChipStyle(): React.CSSProperties {
  return {
    display: "inline-flex", alignItems: "center", gap: 4,
    padding: "4px 8px",
    background: "transparent", border: "1px solid " + D.border,
    color: D.txm,
    fontFamily: mn, fontSize: 10.5, fontWeight: 700, letterSpacing: 0.4,
    borderRadius: 6, cursor: "pointer",
  };
}

function readPayload(payload: unknown): { nodes: DiagramNode[]; edges: DiagramEdge[]; viewport: { x: number; y: number; scale: number }; canvasW?: number; canvasH?: number } {
  if (payload && typeof payload === "object") {
    const p = payload as Partial<DiagramDocPayload>;
    const tplId = (p as { templateId?: string }).templateId;
    const seed = seedFromTemplate(tplId);
    return {
      nodes: Array.isArray(p.nodes) ? p.nodes : seed.nodes,
      edges: Array.isArray(p.edges) ? p.edges : seed.edges,
      viewport: p.viewport || { x: 0, y: 0, scale: 1 },
      canvasW: typeof p.canvasW === "number" ? p.canvasW : undefined,
      canvasH: typeof p.canvasH === "number" ? p.canvasH : undefined,
    };
  }
  const seed = seedFromTemplate(undefined);
  return { nodes: seed.nodes, edges: seed.edges, viewport: { x: 0, y: 0, scale: 1 } };
}

function readStored(key: string, fallback: number): number {
  if (typeof window === "undefined") return fallback;
  try {
    const v = window.localStorage.getItem(key);
    if (v == null) return fallback;
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  } catch { return fallback; }
}
function writeStored(key: string, value: number) {
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(key, String(value)); } catch { /* ignore */ }
}
function clamp(v: number, lo: number, hi: number): number { return Math.max(lo, Math.min(hi, v)); }

function seedFromTemplate(templateId: string | undefined): { nodes: DiagramNode[]; edges: DiagramEdge[] } {
  if (templateId === "flowchart") {
    const nodes: DiagramNode[] = [
      { id: "n1", kind: "flowStart",    x: 60,  y: 60,  w: 140, h: 60,  text: "Start" },
      { id: "n2", kind: "flowDecision", x: 260, y: 50,  w: 160, h: 100, text: "Decide?" },
      { id: "n3", kind: "flowProcess",  x: 480, y: 30,  w: 160, h: 70,  text: "Process A" },
      { id: "n4", kind: "flowProcess",  x: 480, y: 130, w: 160, h: 70,  text: "Process B" },
      { id: "n5", kind: "flowEnd",      x: 700, y: 80,  w: 140, h: 60,  text: "End" },
    ];
    const edges: DiagramEdge[] = [
      { id: "e1", from: { kind: "node", nodeId: "n1", side: "right" }, to: { kind: "node", nodeId: "n2", side: "left" }, arrowEnd: true },
      { id: "e2", from: { kind: "node", nodeId: "n2", side: "right" }, to: { kind: "node", nodeId: "n3", side: "left" }, arrowEnd: true },
      { id: "e3", from: { kind: "node", nodeId: "n2", side: "right" }, to: { kind: "node", nodeId: "n4", side: "left" }, arrowEnd: true },
      { id: "e4", from: { kind: "node", nodeId: "n3", side: "right" }, to: { kind: "node", nodeId: "n5", side: "left" }, arrowEnd: true },
      { id: "e5", from: { kind: "node", nodeId: "n4", side: "right" }, to: { kind: "node", nodeId: "n5", side: "left" }, arrowEnd: true },
    ];
    return { nodes, edges };
  }
  if (templateId === "wireframe") {
    return {
      nodes: [
        { id: "h", kind: "rect",  x: 60, y: 40,  w: 760, h: 60,  fill: "#1A1A2A", stroke: "#F7B041AA", text: "Header" },
        { id: "b", kind: "rect",  x: 60, y: 120, w: 760, h: 300, fill: "#10101C", stroke: "#0B86D1AA", text: "Body" },
        { id: "f", kind: "rect",  x: 60, y: 440, w: 760, h: 60,  fill: "#1A1A2A", stroke: "#2EAD8EAA", text: "Footer" },
      ],
      edges: [],
    };
  }

  // Timeline — 8 era nodes in a serpentine row, each with a year label
  // and price callout. Mirrors the "price of a screw" infographic.
  if (templateId === "timeline-nodes") {
    const years = [
      { y: "1400", p: "$15.00", v: "~hundreds/yr" },
      { y: "1700", p: "$8.00",  v: "~thousands/yr" },
      { y: "1800", p: "$3.00",  v: "~millions/yr" },
      { y: "1850", p: "$0.60",  v: "~100Ms/yr" },
      { y: "1900", p: "$0.15",  v: "~10Bs/yr" },
      { y: "1950", p: "$0.05",  v: "~100Bs/yr" },
      { y: "2000", p: "$0.02",  v: "~1T/yr" },
      { y: "2025", p: "$0.01",  v: "~1–2T/yr" },
    ];
    const nodes: DiagramNode[] = [];
    const edges: DiagramEdge[] = [];
    const r = 36, gap = 130, startX = 60, baseY = 240;
    for (let i = 0; i < years.length; i++) {
      const row = Math.floor(i / 4);
      const colIdx = row === 0 ? i : 3 - (i - 4);
      const x = startX + colIdx * gap;
      const y = baseY + row * 220;
      const it = years[i];
      nodes.push({
        id: "p" + i,
        kind: "ellipse",
        x, y, w: r * 2, h: r * 2,
        fill: "#F7B041",
        stroke: "#F7B041",
        strokeWidth: 2,
        text: it.y,
        fontSize: 14,
      });
      nodes.push({
        id: "pr" + i, kind: "text",
        x: x - 14, y: y - 56, w: 110, h: 30,
        text: it.p, fontSize: 22,
      });
      nodes.push({
        id: "vol" + i, kind: "text",
        x: x - 24, y: y + r * 2 + 8, w: 140, h: 26,
        text: it.v, fontSize: 12,
      });
      if (i > 0) {
        edges.push({
          id: "te" + i,
          from: { kind: "node", nodeId: "p" + (i - 1), side: row !== Math.floor((i - 1) / 4) ? "bottom" : i % 4 === 0 ? "bottom" : "right" },
          to:   { kind: "node", nodeId: "p" + i,       side: row !== Math.floor((i - 1) / 4) ? "top"    : i % 4 === 0 ? "top"    : "left"  },
          stroke: "#F7B041AA", strokeWidth: 2, arrowEnd: false,
        });
      }
    }
    return { nodes, edges };
  }

  // Before / after — two horizontal flows stacked. Pattern: rect → arrow
  // → rect → arrow → rect, twice, with a heading text on top of each row.
  if (templateId === "before-after") {
    const nodes: DiagramNode[] = [
      { id: "bh", kind: "text", x: 80,  y: 40,  w: 760, h: 36, text: "Before AI", fontSize: 22 },
      { id: "b1", kind: "rect", x: 80,  y: 92,  w: 200, h: 86, fill: "#1A1A2A", stroke: "#FFFFFF55", text: "Patient" },
      { id: "b2", kind: "rect", x: 360, y: 92,  w: 200, h: 86, fill: "#1A1A2A", stroke: "#FFFFFF55", text: "Physician" },
      { id: "b3", kind: "rect", x: 640, y: 92,  w: 200, h: 86, fill: "#0B86D122", stroke: "#0B86D1", text: "NAICS 6211\nOffices of Physicians" },

      { id: "ah", kind: "text", x: 80,  y: 240, w: 760, h: 36, text: "With AI scribe", fontSize: 22 },
      { id: "a1", kind: "rect", x: 40,  y: 292, w: 160, h: 86, fill: "#1A1A2A", stroke: "#FFFFFF55", text: "Patient" },
      { id: "a2", kind: "rect", x: 248, y: 292, w: 160, h: 86, fill: "#1A1A2A", stroke: "#FFFFFF55", text: "Physician" },
      { id: "a3", kind: "rect", x: 456, y: 292, w: 160, h: 86, fill: "#F7B04122", stroke: "#F7B041", text: "AI vendor" },
      { id: "a4", kind: "rect", x: 664, y: 292, w: 200, h: 86, fill: "#F7B04122", stroke: "#F7B041", text: "NAICS 5415\nComputer Systems Design" },
    ];
    const edges: DiagramEdge[] = [
      { id: "be1", from: { kind: "node", nodeId: "b1", side: "right" }, to: { kind: "node", nodeId: "b2", side: "left" }, stroke: "#FFFFFFAA", arrowEnd: true },
      { id: "be2", from: { kind: "node", nodeId: "b2", side: "right" }, to: { kind: "node", nodeId: "b3", side: "left" }, stroke: "#0B86D1",   arrowEnd: true, strokeWidth: 2 },
      { id: "ae1", from: { kind: "node", nodeId: "a1", side: "right" }, to: { kind: "node", nodeId: "a2", side: "left" }, stroke: "#FFFFFFAA", arrowEnd: true },
      { id: "ae2", from: { kind: "node", nodeId: "a2", side: "right" }, to: { kind: "node", nodeId: "a3", side: "left" }, stroke: "#F7B041",   arrowEnd: true, strokeWidth: 2 },
      { id: "ae3", from: { kind: "node", nodeId: "a3", side: "right" }, to: { kind: "node", nodeId: "a4", side: "left" }, stroke: "#F7B041",   arrowEnd: true, strokeWidth: 2 },
    ];
    return { nodes, edges };
  }

  // Topology — hub-and-spoke. 1 central hub + 6 surrounding endpoints.
  if (templateId === "topology") {
    const nodes: DiagramNode[] = [
      { id: "hub", kind: "rounded", x: 360, y: 200, w: 160, h: 80, fill: "#0B86D122", stroke: "#0B86D1", text: "Core Router" },
    ];
    const labels = ["DC-East", "DC-West", "Edge-NYC", "Edge-LAX", "Backbone", "Transit"];
    const edges: DiagramEdge[] = [];
    const cx = 440, cy = 240, R = 220;
    for (let i = 0; i < labels.length; i++) {
      const a = (Math.PI * 2 * i) / labels.length;
      const x = cx + Math.cos(a) * R - 60;
      const y = cy + Math.sin(a) * R - 30;
      nodes.push({
        id: "e" + i,
        kind: "rect",
        x, y, w: 120, h: 60,
        fill: "#1A1A2A", stroke: "#2EAD8E", text: labels[i],
      });
      edges.push({
        id: "te" + i,
        from: { kind: "node", nodeId: "hub", side: "center" },
        to: { kind: "node", nodeId: "e" + i, side: "center" },
        stroke: "#2EAD8EAA", strokeWidth: 1.5, arrowEnd: false,
      });
    }
    return { nodes, edges };
  }

  // Swimlane — 3 horizontal lanes (people / system / data) with a
  // process flow that crosses them. Lane backgrounds are rect tiles.
  if (templateId === "swimlane") {
    const laneW = 880, laneH = 130, x0 = 40, y0 = 40;
    const nodes: DiagramNode[] = [
      { id: "l1", kind: "rect", x: x0, y: y0,             w: laneW, h: laneH, fill: "#0B86D110", stroke: "#0B86D155", text: "" },
      { id: "l2", kind: "rect", x: x0, y: y0 + laneH + 8, w: laneW, h: laneH, fill: "#F7B04110", stroke: "#F7B04155", text: "" },
      { id: "l3", kind: "rect", x: x0, y: y0 + (laneH + 8) * 2, w: laneW, h: laneH, fill: "#2EAD8E10", stroke: "#2EAD8E55", text: "" },
      { id: "lt1", kind: "text", x: x0 + 14, y: y0 + 14,             w: 100, h: 22, text: "People",  fontSize: 13 },
      { id: "lt2", kind: "text", x: x0 + 14, y: y0 + laneH + 22,     w: 100, h: 22, text: "System",  fontSize: 13 },
      { id: "lt3", kind: "text", x: x0 + 14, y: y0 + (laneH + 8) * 2 + 14, w: 100, h: 22, text: "Data", fontSize: 13 },

      { id: "s1", kind: "flowStart",    x: 140, y: y0 + 50,           w: 130, h: 50, text: "Request" },
      { id: "s2", kind: "flowProcess",  x: 340, y: y0 + laneH + 50,   w: 150, h: 50, text: "Validate" },
      { id: "s3", kind: "flowData",     x: 560, y: y0 + (laneH + 8) * 2 + 50, w: 150, h: 50, text: "Query" },
      { id: "s4", kind: "flowProcess",  x: 560, y: y0 + laneH + 50,   w: 150, h: 50, text: "Compose" },
      { id: "s5", kind: "flowEnd",      x: 760, y: y0 + 50,           w: 110, h: 50, text: "Reply" },
    ];
    const edges: DiagramEdge[] = [
      { id: "se1", from: { kind: "node", nodeId: "s1", side: "bottom" }, to: { kind: "node", nodeId: "s2", side: "top" },    arrowEnd: true },
      { id: "se2", from: { kind: "node", nodeId: "s2", side: "bottom" }, to: { kind: "node", nodeId: "s3", side: "top" },    arrowEnd: true },
      { id: "se3", from: { kind: "node", nodeId: "s3", side: "top" },    to: { kind: "node", nodeId: "s4", side: "bottom" }, arrowEnd: true },
      { id: "se4", from: { kind: "node", nodeId: "s4", side: "top" },    to: { kind: "node", nodeId: "s5", side: "bottom" }, arrowEnd: true },
    ];
    return { nodes, edges };
  }

  // Segment ladder infographic — vertical stack of 7 colored tier rows,
  // each with a swatch on the left and a description. Mirrors the
  // "verification ladder" image (T6 → T0).
  if (templateId === "segment-ladder") {
    const tiers = [
      { tier: "T6", name: "Insured",                color: "#905CCB" },
      { tier: "T5", name: "Adjudicated",            color: "#3D7EE6" },
      { tier: "T4", name: "Production Deployment", color: "#2EAD8E" },
      { tier: "T3", name: "Professional Endorse.",  color: "#F2A02C" },
      { tier: "T2", name: "Adversarial AI Eval",    color: "#0B86D1" },
      { tier: "T1", name: "AI Self-Assessment",     color: "#7F8090" },
      { tier: "T0", name: "Unverified",             color: "#3A3A48" },
    ];
    const nodes: DiagramNode[] = [
      { id: "title", kind: "text", x: 60, y: 24, w: 760, h: 36, text: "The verification ladder", fontSize: 24 },
    ];
    const rowH = 64;
    for (let i = 0; i < tiers.length; i++) {
      const t = tiers[i];
      const y = 88 + i * (rowH + 8);
      nodes.push({
        id: "sw" + i, kind: "rect",
        x: 60, y, w: 56, h: rowH,
        fill: t.color, stroke: t.color, text: "",
      });
      nodes.push({
        id: "ti" + i, kind: "text",
        x: 134, y: y + 10, w: 200, h: 24,
        text: t.tier + " · " + t.name, fontSize: 17,
      });
      nodes.push({
        id: "desc" + i, kind: "text",
        x: 134, y: y + 36, w: 600, h: 22,
        text: "Description placeholder.", fontSize: 12,
      });
    }
    return { nodes, edges: [] };
  }

  // System architecture — 4 stacked blocks with downward arrows.
  if (templateId === "architecture") {
    const nodes: DiagramNode[] = [
      { id: "t",  kind: "text", x: 80, y: 24, w: 600, h: 30, text: "System Architecture", fontSize: 20 },
      { id: "a1", kind: "rounded", x: 200, y: 80,  w: 360, h: 70, fill: "#0B86D122", stroke: "#0B86D1", text: "Client / Browser" },
      { id: "a2", kind: "rounded", x: 200, y: 200, w: 360, h: 70, fill: "#F7B04122", stroke: "#F7B041", text: "API Gateway / Auth" },
      { id: "a3", kind: "rounded", x: 200, y: 320, w: 360, h: 70, fill: "#2EAD8E22", stroke: "#2EAD8E", text: "Business Logic" },
      { id: "a4", kind: "rounded", x: 200, y: 440, w: 360, h: 70, fill: "#905CCB22", stroke: "#905CCB", text: "Datastore + Cache" },

      { id: "side1", kind: "rect", x: 600, y: 200, w: 200, h: 70, fill: "#1A1A2A", stroke: "#FFFFFF55", text: "Observability" },
      { id: "side2", kind: "rect", x: 600, y: 320, w: 200, h: 70, fill: "#1A1A2A", stroke: "#FFFFFF55", text: "External APIs" },
    ];
    const edges: DiagramEdge[] = [
      { id: "ae1", from: { kind: "node", nodeId: "a1", side: "bottom" }, to: { kind: "node", nodeId: "a2", side: "top" }, arrowEnd: true, strokeWidth: 2 },
      { id: "ae2", from: { kind: "node", nodeId: "a2", side: "bottom" }, to: { kind: "node", nodeId: "a3", side: "top" }, arrowEnd: true, strokeWidth: 2 },
      { id: "ae3", from: { kind: "node", nodeId: "a3", side: "bottom" }, to: { kind: "node", nodeId: "a4", side: "top" }, arrowEnd: true, strokeWidth: 2 },
      { id: "ae4", from: { kind: "node", nodeId: "a2", side: "right" }, to: { kind: "node", nodeId: "side1", side: "left" }, arrowEnd: true, dashed: true },
      { id: "ae5", from: { kind: "node", nodeId: "a3", side: "right" }, to: { kind: "node", nodeId: "side2", side: "left" }, arrowEnd: true, dashed: true },
    ];
    return { nodes, edges };
  }

  // Mind map — central node with three colored branches each spawning
  // two leaves. Lightweight brainstorming starter.
  if (templateId === "mindmap") {
    const nodes: DiagramNode[] = [
      { id: "root", kind: "ellipse", x: 380, y: 230, w: 160, h: 80, fill: "#F7B04122", stroke: "#F7B041", text: "Idea" },
      { id: "b1", kind: "rounded", x: 80,  y: 80,  w: 160, h: 56, fill: "#0B86D122", stroke: "#0B86D1", text: "Branch A" },
      { id: "b2", kind: "rounded", x: 680, y: 80,  w: 160, h: 56, fill: "#2EAD8E22", stroke: "#2EAD8E", text: "Branch B" },
      { id: "b3", kind: "rounded", x: 380, y: 460, w: 160, h: 56, fill: "#905CCB22", stroke: "#905CCB", text: "Branch C" },
      { id: "l1a", kind: "rect", x: 20,  y: 200, w: 130, h: 44, fill: "#0B86D110", stroke: "#0B86D188", text: "Leaf A1" },
      { id: "l1b", kind: "rect", x: 180, y: 200, w: 130, h: 44, fill: "#0B86D110", stroke: "#0B86D188", text: "Leaf A2" },
      { id: "l2a", kind: "rect", x: 600, y: 200, w: 130, h: 44, fill: "#2EAD8E10", stroke: "#2EAD8E88", text: "Leaf B1" },
      { id: "l2b", kind: "rect", x: 760, y: 200, w: 130, h: 44, fill: "#2EAD8E10", stroke: "#2EAD8E88", text: "Leaf B2" },
      { id: "l3a", kind: "rect", x: 250, y: 540, w: 130, h: 44, fill: "#905CCB10", stroke: "#905CCB88", text: "Leaf C1" },
      { id: "l3b", kind: "rect", x: 540, y: 540, w: 130, h: 44, fill: "#905CCB10", stroke: "#905CCB88", text: "Leaf C2" },
    ];
    const edges: DiagramEdge[] = [
      { id: "r1", from: { kind: "node", nodeId: "root", side: "left" },  to: { kind: "node", nodeId: "b1", side: "right" }, stroke: "#0B86D1", strokeWidth: 2, arrowEnd: false },
      { id: "r2", from: { kind: "node", nodeId: "root", side: "right" }, to: { kind: "node", nodeId: "b2", side: "left" },  stroke: "#2EAD8E", strokeWidth: 2, arrowEnd: false },
      { id: "r3", from: { kind: "node", nodeId: "root", side: "bottom" }, to: { kind: "node", nodeId: "b3", side: "top" },  stroke: "#905CCB", strokeWidth: 2, arrowEnd: false },
      { id: "l1ae", from: { kind: "node", nodeId: "b1", side: "bottom" }, to: { kind: "node", nodeId: "l1a", side: "top" }, stroke: "#0B86D1AA", arrowEnd: false },
      { id: "l1be", from: { kind: "node", nodeId: "b1", side: "bottom" }, to: { kind: "node", nodeId: "l1b", side: "top" }, stroke: "#0B86D1AA", arrowEnd: false },
      { id: "l2ae", from: { kind: "node", nodeId: "b2", side: "bottom" }, to: { kind: "node", nodeId: "l2a", side: "top" }, stroke: "#2EAD8EAA", arrowEnd: false },
      { id: "l2be", from: { kind: "node", nodeId: "b2", side: "bottom" }, to: { kind: "node", nodeId: "l2b", side: "top" }, stroke: "#2EAD8EAA", arrowEnd: false },
      { id: "l3ae", from: { kind: "node", nodeId: "b3", side: "bottom" }, to: { kind: "node", nodeId: "l3a", side: "top" }, stroke: "#905CCBAA", arrowEnd: false },
      { id: "l3be", from: { kind: "node", nodeId: "b3", side: "bottom" }, to: { kind: "node", nodeId: "l3b", side: "top" }, stroke: "#905CCBAA", arrowEnd: false },
    ];
    return { nodes, edges };
  }

  // Sequence diagram — 4 vertical lifelines + horizontal messages.
  if (templateId === "sequence") {
    const lanes = ["User", "Edge", "API", "DB"];
    const y0 = 40, ylane = 60, height = 480;
    const nodes: DiagramNode[] = [];
    for (let i = 0; i < lanes.length; i++) {
      const x = 80 + i * 200;
      nodes.push({ id: "h" + i, kind: "rect", x, y: y0, w: 140, h: ylane, fill: "#0B86D122", stroke: "#0B86D1", text: lanes[i] });
      nodes.push({ id: "ll" + i, kind: "line", x: x + 70, y: y0 + ylane, w: 0, h: height - ylane, fill: "#FFFFFF22", stroke: "#FFFFFF55", strokeWidth: 1 });
    }
    const msgs = [
      { from: 0, to: 1, y: 150, text: "request" },
      { from: 1, to: 2, y: 220, text: "validate" },
      { from: 2, to: 3, y: 290, text: "query" },
      { from: 3, to: 2, y: 360, text: "rows" },
      { from: 2, to: 1, y: 410, text: "compose" },
      { from: 1, to: 0, y: 470, text: "reply" },
    ];
    msgs.forEach((m, idx) => {
      const x1 = 80 + m.from * 200 + 70;
      const x2 = 80 + m.to * 200 + 70;
      nodes.push({
        id: "msg" + idx, kind: "arrow",
        x: Math.min(x1, x2), y: m.y, w: Math.abs(x2 - x1), h: 0,
        stroke: x2 > x1 ? "#F7B041" : "#2EAD8E", strokeWidth: 2,
        rotation: x2 > x1 ? 0 : 180,
      });
      nodes.push({
        id: "msgT" + idx, kind: "text",
        x: Math.min(x1, x2) + 10, y: m.y - 22, w: 140, h: 20,
        text: m.text, fontSize: 12,
      });
    });
    return { nodes, edges: [] };
  }

  return { nodes: [], edges: [] };
}

function CanvasFallback() {
  return (
    <div style={{
      width: "100%", height: 600,
      display: "flex", alignItems: "center", justifyContent: "center",
      color: D.txd, fontFamily: mn, fontSize: 10.5, letterSpacing: 1, textTransform: "uppercase",
    }}>Loading canvas…</div>
  );
}

// ─── Shape library palette ─────────────────────────────────────────────

function ShapeLibraryPalette({ tool, setTool, placeKind, onPickShape }: {
  tool: DiagramTool;
  setTool: (t: DiagramTool) => void;
  placeKind: DiagramShapeKind | null;
  onPickShape: (k: DiagramShapeKind) => void;
}) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", gap: 10,
      maxHeight: "calc(100vh - 140px)", overflowY: "auto",
      paddingRight: 4,
    }}>
      {/* Pointer tools row */}
      <div style={{
        display: "flex", gap: 4,
        padding: 4,
        background: D.card, border: "1px solid " + D.border, borderRadius: 10,
      }}>
        <PointerToolBtn Icon={MousePointer2} label="V" title="Select (V)" active={tool === "select"} onClick={() => setTool("select")} />
        <PointerToolBtn Icon={Hand}          label="H" title="Pan · or hold Space (H)" active={tool === "pan"} onClick={() => setTool("pan")} />
        <PointerToolBtn Icon={GitBranch}     label="C" title="Connector (C)" active={tool === "connector"} onClick={() => setTool("connector")} />
      </div>
      {SHAPE_LIBRARY.map((cat) => (
        <div key={cat.id} style={{
          background: D.card, border: "1px solid " + D.border, borderRadius: 10,
          padding: "9px 9px 11px",
        }}>
          <div style={{
            fontFamily: mn, fontSize: 9.5, color: D.amber, letterSpacing: 1.3,
            fontWeight: 800, textTransform: "uppercase", marginBottom: 8, paddingLeft: 2,
          }}>{cat.label}</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 5 }}>
            {cat.items.map((it) => {
              const active = placeKind === it.kind;
              return (
                <button
                  key={it.kind}
                  onClick={() => onPickShape(it.kind)}
                  title={it.label}
                  style={{
                    width: "100%", aspectRatio: "1 / 1",
                    background: active ? D.amber + "22" : "rgba(255,255,255,0.03)",
                    border: "1px solid " + (active ? D.amber + "55" : "rgba(255,255,255,0.08)"),
                    color: active ? D.amber : D.txm,
                    borderRadius: 7, cursor: "pointer",
                    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                    padding: 4, gap: 3,
                    transition: "background 0.12s, border-color 0.12s",
                  }}
                  onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = "rgba(255,255,255,0.06)"; }}
                  onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = "rgba(255,255,255,0.03)"; }}
                >
                  <PaletteGlyph kind={it.kind} accent={(active ? D.amber : it.stroke || it.fill || D.txm) as string} />
                  <span style={{ fontFamily: mn, fontSize: 8, fontWeight: 700, letterSpacing: 0.4, textTransform: "uppercase", lineHeight: 1 }}>
                    {it.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function PointerToolBtn({ Icon, label, title, active, onClick }: {
  Icon: React.ComponentType<{ size?: number; strokeWidth?: number; color?: string }>;
  label: string; title: string; active: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        flex: 1,
        display: "inline-flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        padding: "8px 4px",
        background: active ? D.amber + "22" : "transparent",
        border: "1px solid " + (active ? D.amber + "55" : "transparent"),
        color: active ? D.amber : D.txm,
        borderRadius: 7, cursor: "pointer",
        gap: 2,
      }}
      onMouseEnter={(e) => { if (!active) { e.currentTarget.style.background = "rgba(255,255,255,0.05)"; e.currentTarget.style.color = D.tx; } }}
      onMouseLeave={(e) => { if (!active) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = D.txm; } }}
    >
      <Icon size={15} strokeWidth={2.1} />
      <span style={{ fontFamily: mn, fontSize: 8, fontWeight: 800, letterSpacing: 0.6 }}>{label}</span>
    </button>
  );
}

// Tiny SVG glyph rendered inside each palette tile so the user can see
// what shape they're picking. Reuses the same drawing math the canvas
// uses (rough approximation — exact geometry is in the renderer).
function PaletteGlyph({ kind, accent }: { kind: DiagramShapeKind; accent: string }) {
  const stroke = accent;
  const W = 32, H = 24;
  // Common viewBox content tuned per shape.
  const content = (() => {
    if (kind === "rect")          return <rect x="2" y="4" width="28" height="16" fill={accent + "33"} stroke={stroke} strokeWidth="1.6" />;
    if (kind === "rounded")       return <rect x="2" y="4" width="28" height="16" rx="6" fill={accent + "33"} stroke={stroke} strokeWidth="1.6" />;
    if (kind === "ellipse")       return <ellipse cx="16" cy="12" rx="14" ry="8" fill={accent + "33"} stroke={stroke} strokeWidth="1.6" />;
    if (kind === "triangle")      return <polygon points="16,3 30,20 2,20" fill={accent + "33"} stroke={stroke} strokeWidth="1.6" />;
    if (kind === "diamond" || kind === "flowDecision")
                                  return <polygon points="16,3 30,12 16,21 2,12" fill={accent + "33"} stroke={stroke} strokeWidth="1.6" />;
    if (kind === "parallelogram" || kind === "flowData")
                                  return <polygon points="8,4 30,4 24,20 2,20" fill={accent + "33"} stroke={stroke} strokeWidth="1.6" />;
    if (kind === "text")          return <text x="16" y="16" textAnchor="middle" fontSize="11" fontWeight="800" fill={accent}>T</text>;
    if (kind === "arrow")         return <g stroke={accent} strokeWidth="1.8" fill={accent}><line x1="3" y1="12" x2="26" y2="12" /><polygon points="26,8 30,12 26,16" /></g>;
    if (kind === "line")          return <line x1="3" y1="12" x2="29" y2="12" stroke={accent} strokeWidth="1.8" />;
    if (kind === "flowStart" || kind === "flowEnd")
                                  return <rect x="2" y="6" width="28" height="12" rx="6" fill={accent + "33"} stroke={stroke} strokeWidth="1.6" />;
    if (kind === "flowProcess")   return <rect x="2" y="4" width="28" height="16" rx="2" fill={accent + "33"} stroke={stroke} strokeWidth="1.6" />;
    if (kind === "flowIO")        return <polygon points="6,4 30,4 26,20 2,20" fill={accent + "33"} stroke={stroke} strokeWidth="1.6" />;
    if (kind === "gateAnd")       return <path d={`M3 4 L17 4 A8 8 0 0 1 17 20 L3 20 Z`} fill={accent + "33"} stroke={stroke} strokeWidth="1.6" />;
    if (kind === "gateOr")        return <path d={`M3 4 Q11 12 3 20 Q18 20 28 12 Q18 4 3 4 Z`} fill={accent + "33"} stroke={stroke} strokeWidth="1.6" />;
    if (kind === "gateNot")       return <g fill={accent + "33"} stroke={stroke} strokeWidth="1.6"><polygon points="3,4 24,12 3,20" /><circle cx="27" cy="12" r="2.5" /></g>;
    if (kind === "gateNand")      return <g fill={accent + "33"} stroke={stroke} strokeWidth="1.6"><path d={`M3 4 L14 4 A8 8 0 0 1 14 20 L3 20 Z`} /><circle cx="25" cy="12" r="2.5" /></g>;
    if (kind === "gateNor")       return <g fill={accent + "33"} stroke={stroke} strokeWidth="1.6"><path d={`M3 4 Q10 12 3 20 Q16 20 25 12 Q16 4 3 4 Z`} /><circle cx="28" cy="12" r="2.5" /></g>;
    if (kind === "gateXor")       return <g fill={accent + "33"} stroke={stroke} strokeWidth="1.6"><path d={`M0 4 Q7 12 0 20`} fill="none" /><path d={`M3 4 Q10 12 3 20 Q18 20 28 12 Q18 4 3 4 Z`} /></g>;
    if (kind === "resistor")      return <polyline points="2,12 6,12 8,5 12,19 16,5 20,19 24,12 30,12" fill="none" stroke={accent} strokeWidth="1.4" />;
    if (kind === "capacitor")     return <g stroke={accent} strokeWidth="1.4" fill="none"><line x1="2" y1="12" x2="14" y2="12" /><line x1="14" y1="3" x2="14" y2="21" /><line x1="18" y1="3" x2="18" y2="21" /><line x1="18" y1="12" x2="30" y2="12" /></g>;
    if (kind === "battery")       return <g stroke={accent} fill="none"><line x1="2" y1="12" x2="11" y2="12" strokeWidth="1.4" /><line x1="11" y1="4" x2="11" y2="20" strokeWidth="2.4" /><line x1="17" y1="7" x2="17" y2="17" strokeWidth="1.6" /><line x1="17" y1="12" x2="30" y2="12" strokeWidth="1.4" /></g>;
    if (kind === "ground")        return <g stroke={accent} fill="none"><line x1="16" y1="3" x2="16" y2="11" strokeWidth="1.6" /><line x1="6" y1="11" x2="26" y2="11" strokeWidth="1.6" /><line x1="9" y1="15" x2="23" y2="15" strokeWidth="1.4" /><line x1="12" y1="19" x2="20" y2="19" strokeWidth="1.2" /></g>;
    return <rect x="2" y="4" width="28" height="16" fill={accent + "22"} stroke={stroke} strokeWidth="1.2" />;
  })();
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="20">{content}</svg>
  );
}

// ─── Top toolbar ──────────────────────────────────────────────────────

function TopToolbar({
  tool, setTool, canUndo, canRedo, canDelete, onUndo, onRedo, onDelete, onExport,
  zoom, onZoomIn, onZoomOut, onZoomReset, onToggleRight, rightOpen,
}: {
  tool: DiagramTool;
  setTool: (t: DiagramTool) => void;
  canUndo: boolean; canRedo: boolean; canDelete: boolean;
  onUndo: () => void; onRedo: () => void;
  onDelete: () => void; onExport: () => void;
  zoom: number;
  onZoomIn: () => void; onZoomOut: () => void; onZoomReset: () => void;
  onToggleRight: () => void;
  rightOpen: boolean;
}) {
  void tool; void setTool;
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 6,
      padding: "8px 12px",
      background: D.card, border: "1px solid " + D.border, borderRadius: 12,
    }}>
      <ToolbarBtn Icon={RotateCcw} label="Undo" disabled={!canUndo} onClick={onUndo} hint="⌘Z" />
      <ToolbarBtn Icon={RotateCw}  label="Redo" disabled={!canRedo} onClick={onRedo} hint="⌘⇧Z" />
      <span style={{ width: 1, height: 18, background: D.border, margin: "0 4px" }} />
      <ToolbarBtn Icon={Trash2}    label="Delete" disabled={!canDelete} onClick={onDelete} hint="⌫" danger />
      <span style={{ marginLeft: "auto" }} />
      <ToolbarBtn Icon={ZoomOut} label=""  onClick={onZoomOut} hint="−" />
      <button
        onClick={onZoomReset}
        title="Reset zoom"
        style={{
          padding: "5px 10px",
          background: "transparent", border: "1px solid " + D.border,
          color: D.txm, fontFamily: mn, fontSize: 10.5, fontWeight: 700, letterSpacing: 0.5,
          borderRadius: 6, cursor: "pointer", minWidth: 56, textAlign: "center",
        }}
      >{Math.round(zoom * 100)}%</button>
      <ToolbarBtn Icon={ZoomIn}  label="" onClick={onZoomIn} hint="+" />
      <span style={{ width: 1, height: 18, background: D.border, margin: "0 4px" }} />
      <ToolbarBtn Icon={Download} label="PNG" onClick={onExport} />
      <span style={{ width: 1, height: 18, background: D.border, margin: "0 4px" }} />
      <ToolbarBtn
        Icon={rightOpen ? PanelRightClose : PanelRightOpen}
        label={rightOpen ? "Hide" : "Show"}
        onClick={onToggleRight}
        hint="P"
      />
    </div>
  );
}

function ToolbarBtn({ Icon, label, onClick, disabled, hint, danger }: {
  Icon: React.ComponentType<{ size?: number; strokeWidth?: number; color?: string }>;
  label: string; onClick: () => void;
  disabled?: boolean; hint?: string; danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={hint ? `${label || ""} (${hint})` : label}
      style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        padding: label ? "6px 11px" : "6px 9px",
        background: "transparent", border: "1px solid " + D.border,
        color: disabled ? D.txd : danger ? D.coral : D.txm,
        opacity: disabled ? 0.45 : 1,
        fontFamily: mn, fontSize: 10.5, fontWeight: 700, letterSpacing: 0.5,
        borderRadius: 6, cursor: disabled ? "not-allowed" : "pointer",
      }}
      onMouseEnter={(e) => { if (!disabled) e.currentTarget.style.background = "rgba(255,255,255,0.05)"; }}
      onMouseLeave={(e) => { if (!disabled) e.currentTarget.style.background = "transparent"; }}
    ><Icon size={12} strokeWidth={2.2} /> {label}</button>
  );
}

// ─── Properties panel ──────────────────────────────────────────────────

function PropertiesPanel({ selected, fill, setFill, stroke, setStroke, onMutate, onDelete, edgeCount, nodeCount, pageW, pageH, onChangePage, onClose }: {
  selected: DiagramNode | null;
  fill: string; setFill: (c: string) => void;
  stroke: string; setStroke: (c: string) => void;
  onMutate: (patch: Partial<DiagramNode>) => void;
  onDelete: () => void;
  edgeCount: number;
  nodeCount: number;
  pageW: number; pageH: number;
  onChangePage: (w: number, h: number) => void;
  onClose: () => void;
}) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", gap: 14,
      padding: 14,
      background: D.card, border: "1px solid " + D.border, borderRadius: 12,
      maxHeight: "calc(100vh - 140px)", overflowY: "auto",
    }}>
      <div style={{ display: "flex", alignItems: "center" }}>
        <SectionHeading>Canvas</SectionHeading>
        <button
          onClick={onClose}
          title="Hide panel (P)"
          style={{
            marginLeft: "auto",
            background: "transparent", border: "none",
            color: D.txd, cursor: "pointer",
            display: "inline-flex", alignItems: "center", padding: 2,
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = D.amber; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = D.txd; }}
        ><ChevronRight size={14} strokeWidth={2.4} /></button>
      </div>
      <Field label="Page width">
        <NumberInput value={pageW} onChange={(v) => onChangePage(v, pageH)} suffix="px" />
      </Field>
      <Field label="Page height">
        <NumberInput value={pageH} onChange={(v) => onChangePage(pageW, v)} suffix="px" />
      </Field>
      <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
        {[
          { label: "16:9 HD",    w: 1920, h: 1080 },
          { label: "Slide",      w: 1280, h: 720 },
          { label: "Square",     w: 1080, h: 1080 },
          { label: "Story",      w: 1080, h: 1920 },
          { label: "Letter",     w: 1100, h: 850 },
        ].map((p) => (
          <button
            key={p.label}
            onClick={() => onChangePage(p.w, p.h)}
            style={{
              padding: "4px 8px",
              background: pageW === p.w && pageH === p.h ? D.amber + "22" : "transparent",
              border: "1px solid " + (pageW === p.w && pageH === p.h ? D.amber + "55" : D.border),
              color: pageW === p.w && pageH === p.h ? D.amber : D.txm,
              fontFamily: mn, fontSize: 9.5, fontWeight: 700, letterSpacing: 0.4,
              borderRadius: 5, cursor: "pointer",
            }}
          >{p.label}</button>
        ))}
      </div>
      <SectionHeading>Defaults</SectionHeading>
      <SwatchRow label="Fill"   value={fill}   onChange={setFill} />
      <SwatchRow label="Stroke" value={stroke} onChange={setStroke} />

      {selected ? (
        <>
          <SectionHeading>{selected.kind}</SectionHeading>
          {(selected.kind !== "arrow" && selected.kind !== "line") && (
            <Field label="Text">
              <input
                value={selected.text || ""}
                onChange={(e) => onMutate({ text: e.target.value })}
                placeholder="Label this shape…"
                style={inputStyle}
              />
            </Field>
          )}
          <Field label="Position">
            <div style={{ display: "flex", gap: 6 }}>
              <NumberInput value={Math.round(selected.x)} onChange={(v) => onMutate({ x: v })} suffix="X" />
              <NumberInput value={Math.round(selected.y)} onChange={(v) => onMutate({ y: v })} suffix="Y" />
            </div>
          </Field>
          <Field label="Size">
            <div style={{ display: "flex", gap: 6 }}>
              <NumberInput value={Math.round(selected.w)} onChange={(v) => onMutate({ w: Math.max(8, v) })} suffix="W" />
              <NumberInput value={Math.round(selected.h)} onChange={(v) => onMutate({ h: Math.max(0, v) })} suffix="H" />
            </div>
          </Field>
          <SwatchRow label="Fill" value={selected.fill || fill} onChange={(c) => onMutate({ fill: c })} />
          <SwatchRow label="Stroke" value={selected.stroke || stroke} onChange={(c) => onMutate({ stroke: c })} />
          <Field label="Stroke width">
            <NumberInput value={selected.strokeWidth ?? 2} onChange={(v) => onMutate({ strokeWidth: Math.max(0, v) })} suffix="px" />
          </Field>
          <button
            onClick={onDelete}
            style={{
              padding: "7px 12px",
              background: "transparent", border: "1px solid " + D.coral + "55",
              color: D.coral, fontFamily: mn, fontSize: 10.5, fontWeight: 700, letterSpacing: 0.5,
              borderRadius: 7, cursor: "pointer",
            }}
          >⌫ Delete shape</button>
        </>
      ) : (
        <>
          <div style={{ fontFamily: ft, fontSize: 12, color: D.txd, lineHeight: 1.4 }}>
            Pick a shape from the library to drop one. Drag connectors from the C tool — they snap to ports and follow shapes when you move them.
          </div>
          <div style={{
            fontFamily: mn, fontSize: 10, color: D.txd, letterSpacing: 0.6,
            paddingTop: 10, borderTop: "1px solid " + D.border,
          }}>{nodeCount} shape{nodeCount === 1 ? "" : "s"} · {edgeCount} connector{edgeCount === 1 ? "" : "s"}</div>
        </>
      )}
    </div>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontFamily: mn, fontSize: 9.5, color: D.amber, letterSpacing: 1.4,
      fontWeight: 700, textTransform: "uppercase",
    }}>{children}</div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{
        fontFamily: mn, fontSize: 9, color: D.txd, letterSpacing: 0.6,
        textTransform: "uppercase", marginBottom: 5,
      }}>{label}</div>
      {children}
    </div>
  );
}

function SwatchRow({ label, value, onChange }: { label: string; value: string; onChange: (c: string) => void }) {
  return (
    <Field label={label}>
      <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
        {DIAGRAM_PALETTE.map((c) => {
          const on = c === value;
          return (
            <button
              key={c}
              onClick={() => onChange(c)}
              title={c}
              style={{
                width: 22, height: 22, borderRadius: 4,
                background: c,
                border: "1.5px solid " + (on ? "#E8E4DD" : "transparent"),
                cursor: "pointer",
              }}
            />
          );
        })}
        <input
          type="color"
          value={value.startsWith("#") ? value : "#F7B041"}
          onChange={(e) => onChange(e.target.value)}
          title="Pick custom color"
          style={{
            width: 22, height: 22, padding: 0,
            background: "transparent", border: "1px dashed " + D.border, borderRadius: 4,
            cursor: "pointer",
          }}
        />
      </div>
    </Field>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%", boxSizing: "border-box",
  background: D.bg, color: D.tx,
  border: "1px solid " + D.border, borderRadius: 6,
  padding: "5px 8px",
  fontFamily: ft, fontSize: 12, outline: "none",
};

function NumberInput({ value, onChange, suffix }: { value: number; onChange: (v: number) => void; suffix?: string }) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  return (
    <div style={{ display: "inline-flex", alignItems: "center", flex: 1, position: "relative" }}>
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          const n = Number(draft);
          if (Number.isFinite(n)) onChange(n); else setDraft(String(value));
        }}
        onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
        style={{
          ...inputStyle,
          paddingRight: suffix ? 26 : 8,
          fontFamily: mn, fontSize: 11,
        }}
      />
      {suffix && (
        <span style={{
          position: "absolute", right: 7, top: "50%", transform: "translateY(-50%)",
          fontFamily: mn, fontSize: 9, color: D.txd, letterSpacing: 0.5,
        }}>{suffix}</span>
      )}
    </div>
  );
}

// ─── Inline text edit overlay ──────────────────────────────────────────
// Positioned in HTML over the canvas (in viewport space) so the user can
// type with native keyboard/IME support. Commits on blur or Enter.

function TextEditOverlay({ node, viewport, onCommit, onCancel }: {
  node: DiagramNode;
  viewport: { x: number; y: number; scale: number };
  onCommit: (text: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(node.text || "");
  const screenX = node.x * viewport.scale + viewport.x;
  const screenY = node.y * viewport.scale + viewport.y;
  const screenW = Math.max(80, node.w * viewport.scale);
  const screenH = Math.max(28, node.h * viewport.scale);
  return (
    <div
      style={{
        position: "absolute",
        left: screenX, top: screenY,
        width: screenW, height: screenH,
        display: "flex", alignItems: "center", justifyContent: "center",
        zIndex: 10,
      }}
    >
      <textarea
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => onCommit(value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onCommit(value); }
          if (e.key === "Escape") { e.preventDefault(); onCancel(); }
        }}
        style={{
          width: "92%", height: "82%",
          background: "rgba(0,0,0,0.55)",
          border: "1px solid " + D.amber,
          borderRadius: 4,
          color: "#E8E4DD",
          fontFamily: "Outfit, sans-serif",
          fontSize: Math.max(11, (node.fontSize || 14) * viewport.scale),
          fontWeight: 700,
          textAlign: "center",
          padding: "4px 8px",
          outline: "none",
          resize: "none",
          boxSizing: "border-box",
        }}
      />
    </div>
  );
}
