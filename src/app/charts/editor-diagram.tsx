"use client";

// DiagramEditor v2 — tldraw-flavored canvas plus a categorized shape
// library and a real connector tool. Wraps the react-konva canvas
// (loaded via next/dynamic) with a left palette + top toolbar + right
// properties panel. Saves nodes/edges/viewport into the doc payload.

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CaseLower, ChevronLeft, ChevronRight, Download, GitBranch, Hand,
  Image as ImageIcon, Lock, Maximize2, Move, MousePointer2,
  PanelRightClose, PanelRightOpen, Pin, RotateCcw, RotateCw, Trash2,
  Type, Unlock, ZoomIn, ZoomOut,
} from "lucide-react";
import { SHAPE_LIBRARY } from "./lib/diagram-shapes";
import {
  backdropById, D, DIAGRAM_BACKDROPS, DIAGRAM_PALETTE, ft, gf, mn,
} from "./studio-theme";
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
  const [backdrop, setBackdrop] = useState<string>(initial.backdrop ?? "sa-dark");
  const backdropDef = useMemo(() => backdropById(backdrop), [backdrop]);
  // Pending size change from the bottom-bar preset menu — held while
  // the user picks "Keep diagram" (lock current node positions) vs
  // "Expand to fit" (uniform-scale every node into the new bounds).
  const [pendingResize, setPendingResize] = useState<{ w: number; h: number; label: string } | null>(null);

  // Floating format toolbar — locked-to-top by default; user can
  // unlock + drag it anywhere over the canvas. Position persists.
  const [toolbarLocked, setToolbarLocked] = useState(() => readStored("studio-diagram-toolbarLocked", 1) > 0);
  const [toolbarPos, setToolbarPos] = useState<{ x: number; y: number }>(() => ({
    x: readStored("studio-diagram-toolbarX", 24),
    y: readStored("studio-diagram-toolbarY", 80),
  }));
  useEffect(() => writeStored("studio-diagram-toolbarLocked", toolbarLocked ? 1 : 0), [toolbarLocked]);
  useEffect(() => writeStored("studio-diagram-toolbarX", toolbarPos.x), [toolbarPos.x]);
  useEffect(() => writeStored("studio-diagram-toolbarY", toolbarPos.y), [toolbarPos.y]);

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
      backdrop,
    };
    onChangePayload(payload);
  }, [nodes, edges, pageW, pageH, viewport, backdrop, onChangePayload]);

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

  // Drop a title / subtitle text node centered horizontally on the
  // page. Re-clicking adds another (the user can move/delete). Color
  // tracks the active backdrop so light backdrops get dark text.
  // Apply a new page size. Mode "keep" leaves every node where it is
  // (matches Figma's "resize page" behavior). Mode "expand" uniform-
  // scales every node so the visual composition fills the new bounds.
  const applyResize = useCallback((w: number, h: number, mode: "keep" | "expand") => {
    if (mode === "expand") {
      const sx = w / Math.max(1, pageW);
      const sy = h / Math.max(1, pageH);
      const s = Math.min(sx, sy);
      pushHistory();
      setNodes((cur) => cur.map(n => ({
        ...n,
        x: n.x * s, y: n.y * s,
        w: n.w * s, h: n.h * s,
        fontSize: n.fontSize ? n.fontSize * s : n.fontSize,
      })));
    }
    setPageW(w);
    setPageH(h);
  }, [pageW, pageH, pushHistory]);

  const handlePickSize = useCallback((w: number, h: number, label: string) => {
    if (w === pageW && h === pageH) return;
    // No content — apply silently. Adding nodes against a freshly set
    // size shouldn't trigger a confusing "expand?" prompt on an empty
    // canvas.
    if (nodes.length === 0) {
      applyResize(w, h, "keep");
      return;
    }
    // Smaller (or equal-area) targets keep current positions, which
    // may clip — surface the prompt either way so the user explicitly
    // picks. For larger targets the "expand to fit" choice is the
    // useful one.
    setPendingResize({ w, h, label });
  }, [pageW, pageH, nodes.length, applyResize]);

  const addRoleNode = useCallback((role: "title" | "subtitle") => {
    const isTitle = role === "title";
    const w = Math.min(800, pageW - 80);
    const h = isTitle ? 56 : 32;
    const x = (pageW - w) / 2;
    const y = isTitle ? 32 : 100;
    const n: DiagramNode = {
      id: role + "-" + Date.now().toString(36).slice(-5),
      kind: "text",
      x, y, w, h,
      text: isTitle ? "Title" : "Subtitle",
      fontSize: isTitle ? 32 : 16,
      fill: backdropDef.isLight ? "#0A0C10" : "#FFFFFF",
      role,
    };
    createNode(n);
  }, [pageW, backdropDef.isLight, createNode]);

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
      // Keep the editor surface affixed to the viewport — content
      // overflows are clipped inside each rail's own scroll container.
      overflowX: "hidden",
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
          canUndo={history.length > 0}
          canRedo={future.length > 0}
          canDelete={!!selectedId}
          onUndo={undo} onRedo={redo}
          onDelete={deleteSelected}
          onExport={exportPng}
          onAddTitle={() => addRoleNode("title")}
          onAddSubtitle={() => addRoleNode("subtitle")}
          backdrop={backdrop}
          onChangeBackdrop={setBackdrop}
          onToggleRight={() => setRightOpen((v) => !v)}
          rightOpen={rightOpen}
        />
        <div
          ref={canvasRef}
          style={{
            flex: "1 1 auto",
            background: backdropDef.isLight ? "#EAE6DC" : "#06070A",
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
            pageBg={backdropDef.bg}
            canvasBg={backdropDef.isLight ? "#EAE6DC" : "#06070A"}
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
          <FloatingFormatToolbar
            selected={selected}
            fill={fill} setFill={setFill}
            stroke={stroke} setStroke={setStroke}
            onMutate={(patch) => { if (selected) mutateNode(selected.id, patch); }}
            locked={toolbarLocked}
            pos={toolbarPos}
            onSetPos={setToolbarPos}
            onToggleLock={() => setToolbarLocked(v => !v)}
          />
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
          onPickSize={handlePickSize}
        />
      </div>

      {pendingResize && (
        <ResizeConfirmModal
          fromW={pageW} fromH={pageH}
          toW={pendingResize.w} toH={pendingResize.h}
          label={pendingResize.label}
          onCancel={() => setPendingResize(null)}
          onKeep={() => { applyResize(pendingResize.w, pendingResize.h, "keep"); setPendingResize(null); }}
          onExpand={() => { applyResize(pendingResize.w, pendingResize.h, "expand"); setPendingResize(null); }}
        />
      )}

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

// ─── Floating format toolbar ──────────────────────────────────────────
// Lives over the canvas. Two modes:
//   - locked (default): docks to the top of the canvas, full-width.
//   - free: positioned at (pos.x, pos.y) within the canvas, draggable.
// Content branches on whether a node is selected:
//   - selected: shape-format controls (fill / stroke / text color /
//     size / align)
//   - none: text-defaults controls that flow into the editor's stored
//     fill + stroke (the next placed shape inherits them).
function FloatingFormatToolbar({
  selected, fill, setFill, stroke, setStroke, onMutate,
  locked, pos, onSetPos, onToggleLock,
}: {
  selected: DiagramNode | null;
  fill: string; setFill: (c: string) => void;
  stroke: string; setStroke: (c: string) => void;
  onMutate: (patch: Partial<DiagramNode>) => void;
  locked: boolean;
  pos: { x: number; y: number };
  onSetPos: (p: { x: number; y: number }) => void;
  onToggleLock: () => void;
}) {
  const drag = useRef<{ x: number; y: number } | null>(null);
  useEffect(() => {
    function move(e: MouseEvent) {
      if (!drag.current) return;
      onSetPos({
        x: Math.max(4, drag.current.x + e.movementX),
        y: Math.max(4, drag.current.y + e.movementY),
      });
      drag.current.x += e.movementX;
      drag.current.y += e.movementY;
    }
    function up() { drag.current = null; document.body.style.userSelect = ""; }
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
  }, [onSetPos]);

  const startDrag = (e: React.MouseEvent) => {
    if (locked) return;
    drag.current = { x: pos.x, y: pos.y };
    document.body.style.userSelect = "none";
    e.preventDefault();
  };

  const container: React.CSSProperties = locked
    ? {
        position: "absolute",
        top: 10, left: "50%", transform: "translateX(-50%)",
        zIndex: 18,
      }
    : {
        position: "absolute",
        top: pos.y, left: pos.x,
        zIndex: 18,
      };

  return (
    <div
      style={{
        ...container,
        display: "flex", alignItems: "center", gap: 6,
        padding: "6px 8px 6px 6px",
        background: "rgba(10,12,18,0.92)",
        border: "1px solid " + D.border, borderRadius: 999,
        boxShadow: "0 12px 30px rgba(0,0,0,0.55)",
        backdropFilter: "blur(6px)",
      }}
    >
      <button
        onMouseDown={startDrag}
        title={locked ? "Locked to top — unlock to drag" : "Drag to move"}
        style={{
          width: 22, height: 22, padding: 0,
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          background: "transparent",
          border: "none", color: locked ? D.txd : D.amber,
          cursor: locked ? "default" : "grab",
        }}
      ><Move size={12} strokeWidth={2.2} /></button>
      <span style={{ width: 1, height: 18, background: D.border }} />

      {selected
        ? <ShapeFormatRow selected={selected} onMutate={onMutate} />
        : <DefaultsFormatRow fill={fill} setFill={setFill} stroke={stroke} setStroke={setStroke} />
      }

      <span style={{ width: 1, height: 18, background: D.border }} />
      <button
        onClick={onToggleLock}
        title={locked ? "Unlock toolbar — make it floating" : "Lock to top of canvas"}
        style={{
          width: 22, height: 22, padding: 0,
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          background: "transparent",
          border: "none", color: locked ? D.amber : D.txm,
          cursor: "pointer",
        }}
      >
        {locked ? <Lock size={12} strokeWidth={2.2} /> : <Unlock size={12} strokeWidth={2.2} />}
      </button>
    </div>
  );
}

function ShapeFormatRow({ selected, onMutate }: {
  selected: DiagramNode; onMutate: (patch: Partial<DiagramNode>) => void;
}) {
  const palette = DIAGRAM_PALETTE.concat(["#FFFFFF", "#0A0C10", "transparent"]);
  return (
    <>
      <FormatLabel>Fill</FormatLabel>
      <Swatches palette={palette} value={selected.fill} onPick={(c) => onMutate({ fill: c })} />
      <span style={{ width: 1, height: 16, background: D.border, margin: "0 2px" }} />
      <FormatLabel>Stroke</FormatLabel>
      <Swatches palette={palette} value={selected.stroke} onPick={(c) => onMutate({ stroke: c })} />
      <span style={{ width: 1, height: 16, background: D.border, margin: "0 2px" }} />
      <FormatLabel>Text</FormatLabel>
      <Swatches
        palette={["#FFFFFF", "#0A0C10", ...DIAGRAM_PALETTE]}
        value={selected.textColor}
        onPick={(c) => onMutate({ textColor: c })}
      />
      <span style={{ width: 1, height: 16, background: D.border, margin: "0 2px" }} />
      <SizeStepper
        value={selected.fontSize ?? 14}
        onChange={(v) => onMutate({ fontSize: Math.max(8, Math.min(96, v)) })}
      />
    </>
  );
}

function DefaultsFormatRow({ fill, setFill, stroke, setStroke }: {
  fill: string; setFill: (c: string) => void;
  stroke: string; setStroke: (c: string) => void;
}) {
  const palette = DIAGRAM_PALETTE.concat(["#FFFFFF", "#0A0C10", "transparent"]);
  return (
    <>
      <FormatLabel>Default fill</FormatLabel>
      <Swatches palette={palette} value={fill} onPick={setFill} />
      <span style={{ width: 1, height: 16, background: D.border, margin: "0 2px" }} />
      <FormatLabel>Default stroke</FormatLabel>
      <Swatches palette={palette} value={stroke} onPick={setStroke} />
    </>
  );
}

function FormatLabel({ children }: { children: React.ReactNode }) {
  return <span style={{
    fontFamily: mn, fontSize: 9, color: D.txd, letterSpacing: 0.6,
    textTransform: "uppercase", fontWeight: 700, padding: "0 2px",
  }}>{children}</span>;
}

function Swatches({ palette, value, onPick }: {
  palette: string[]; value?: string; onPick: (c: string) => void;
}) {
  return (
    <div style={{ display: "inline-flex", gap: 3 }}>
      {palette.map((c) => {
        const active = (value || "").toUpperCase() === c.toUpperCase();
        return (
          <button
            key={c}
            onClick={() => onPick(c)}
            title={c}
            style={{
              width: 16, height: 16, padding: 0,
              borderRadius: "50%",
              background: c === "transparent"
                ? "repeating-conic-gradient(#222 0 25%, #444 0 50%) 50% / 8px 8px"
                : c,
              border: active ? "2px solid #FFF" : "1px solid rgba(255,255,255,0.25)",
              cursor: "pointer",
              boxShadow: active ? "0 0 0 2px " + D.amber + "AA" : "none",
            }}
          />
        );
      })}
    </div>
  );
}

function SizeStepper({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
      <FormatLabel>Size</FormatLabel>
      <button onClick={() => onChange(value - 2)} style={pillStep()}>−</button>
      <span style={{
        fontFamily: mn, fontSize: 10.5, color: D.tx, minWidth: 22, textAlign: "center", fontWeight: 700,
      }}>{Math.round(value)}</span>
      <button onClick={() => onChange(value + 2)} style={pillStep()}>+</button>
    </div>
  );
}

function pillStep(): React.CSSProperties {
  return {
    width: 18, height: 18, padding: 0,
    display: "inline-flex", alignItems: "center", justifyContent: "center",
    background: "transparent", color: D.tx,
    border: "1px solid " + D.border, borderRadius: 999,
    cursor: "pointer", fontFamily: mn, fontSize: 11, fontWeight: 700,
  };
}

// Confirm dialog raised when the user picks a new canvas size from the
// bottom bar. Lets them choose between Keep (lock node positions) or
// Expand (uniform-scale every node so the composition fills the new
// bounds). Dismissible — clicking the backdrop or hitting Escape
// cancels the resize.
function ResizeConfirmModal({ fromW, fromH, toW, toH, label, onCancel, onKeep, onExpand }: {
  fromW: number; fromH: number;
  toW: number; toH: number;
  label: string;
  onCancel: () => void;
  onKeep: () => void;
  onExpand: () => void;
}) {
  const grows = toW * toH > fromW * fromH;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);
  return (
    <div
      onClick={onCancel}
      style={{
        position: "fixed", inset: 0, zIndex: 200,
        background: "rgba(0,0,0,0.55)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 24,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: 460,
          background: "#0A0C10",
          border: "1px solid " + D.border, borderRadius: 14,
          boxShadow: "0 24px 56px rgba(0,0,0,0.7)",
          padding: "22px 24px 20px",
          fontFamily: ft,
        }}
      >
        <div style={{
          fontFamily: mn, fontSize: 9.5, color: D.amber,
          fontWeight: 800, letterSpacing: 1.5, textTransform: "uppercase",
          marginBottom: 6,
        }}>Canvas resize</div>
        <h2 style={{
          margin: 0, fontFamily: gf, fontSize: 22, color: D.tx,
          fontWeight: 900, letterSpacing: -0.5,
        }}>Resize to {label}?</h2>
        <p style={{
          margin: "10px 0 18px",
          fontFamily: ft, fontSize: 13.5, color: D.txm, lineHeight: 1.5,
        }}>
          Going from <strong style={{ color: D.tx }}>{fromW}×{fromH}</strong> to
          {" "}<strong style={{ color: D.tx }}>{toW}×{toH}</strong>.
          {" "}{grows
            ? "Expand will scale every shape so the composition fills the new bounds."
            : "Keep preserves current positions; some shapes may sit outside the new bounds."}
        </p>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button onClick={onCancel} style={modalBtn(false)}>Cancel</button>
          <button onClick={onKeep}   style={modalBtn(false)}>Keep diagram</button>
          <button onClick={onExpand} style={modalBtn(true)}>Expand to fit</button>
        </div>
      </div>
    </div>
  );
}

function modalBtn(primary: boolean): React.CSSProperties {
  return {
    padding: "9px 14px",
    background: primary ? D.amber : "transparent",
    color: primary ? "#0A0C10" : D.tx,
    border: "1px solid " + (primary ? D.amber : D.border),
    borderRadius: 8,
    fontFamily: mn, fontSize: 11, fontWeight: 800, letterSpacing: 0.6,
    textTransform: "uppercase", cursor: "pointer",
  };
}

// ─── Bottom zoom bar — fixed below the canvas ──────────────────────────
function BottomZoomBar({ scale, onScale, onFit, onReset, pageW, pageH, onPickSize }: {
  scale: number;
  onScale: (s: number) => void;
  onFit: () => void;
  onReset: () => void;
  pageW: number;
  pageH: number;
  onPickSize: (w: number, h: number, label: string) => void;
}) {
  const pct = Math.round(scale * 100);
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12,
      padding: "8px 14px",
      background: D.card, border: "1px solid " + D.border, borderRadius: 10,
    }}>
      <SizePresetMenu pageW={pageW} pageH={pageH} onPick={onPickSize} />
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

// Standard canvas size presets — mirror the Page-section presets in
// the right rail, but accessible from the bottom bar so the user can
// resize without opening the panel. Clicking a preset emits the
// requested W/H; the editor pops the keep-or-expand confirm if the
// new size is larger than the current.
interface SizePreset { id: string; label: string; w: number; h: number; }
const SIZE_PRESETS: SizePreset[] = [
  { id: "hd",     label: "16:9 HD",  w: 1920, h: 1080 },
  { id: "slide",  label: "Slide",    w: 1394, h: 861  },
  { id: "square", label: "Square",   w: 1080, h: 1080 },
  { id: "story",  label: "Story",    w: 1080, h: 1920 },
  { id: "letter", label: "Letter",   w: 1700, h: 1100 },
  { id: "a4",     label: "A4",       w: 1240, h: 1754 },
];

function SizePresetMenu({ pageW, pageH, onPick }: {
  pageW: number; pageH: number;
  onPick: (w: number, h: number, label: string) => void;
}) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    setTimeout(() => document.addEventListener("click", close), 0);
    return () => document.removeEventListener("click", close);
  }, [open]);
  const matched = SIZE_PRESETS.find(p => p.w === pageW && p.h === pageH);
  return (
    <div style={{ position: "relative" }} onClick={(e) => e.stopPropagation()}>
      <button
        onClick={() => setOpen(v => !v)}
        title="Change canvas size"
        style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          padding: "5px 10px",
          background: "transparent", border: "1px solid " + D.border,
          color: D.txm,
          fontFamily: mn, fontSize: 10, fontWeight: 700, letterSpacing: 0.6,
          textTransform: "uppercase", borderRadius: 6, cursor: "pointer",
        }}
      >
        {matched ? matched.label : "Page"} · {pageW}×{pageH}
        <ChevronRight size={10} strokeWidth={2.2} style={{ transform: open ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.12s" }} />
      </button>
      {open && (
        <div style={{
          position: "absolute", bottom: "calc(100% + 6px)", left: 0,
          background: "#0A0C10", border: "1px solid " + D.border, borderRadius: 8,
          padding: 6, zIndex: 50, minWidth: 200,
          boxShadow: "0 18px 38px rgba(0,0,0,0.6)",
        }}>
          {SIZE_PRESETS.map(p => {
            const active = matched?.id === p.id;
            return (
              <button
                key={p.id}
                onClick={() => { onPick(p.w, p.h, p.label); setOpen(false); }}
                style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  width: "100%", padding: "7px 10px",
                  background: active ? D.amber + "1A" : "transparent",
                  color: active ? D.amber : D.tx,
                  border: "none", borderRadius: 5, cursor: "pointer",
                  fontFamily: mn, fontSize: 11, fontWeight: 700, letterSpacing: 0.4,
                  textAlign: "left",
                }}
                onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = "rgba(255,255,255,0.05)"; }}
                onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = "transparent"; }}
              >
                <span>{p.label}</span>
                <span style={{ color: D.txd, fontSize: 10 }}>{p.w}×{p.h}</span>
              </button>
            );
          })}
        </div>
      )}
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

function readPayload(payload: unknown): {
  nodes: DiagramNode[]; edges: DiagramEdge[];
  viewport: { x: number; y: number; scale: number };
  canvasW?: number; canvasH?: number; backdrop?: string;
} {
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
      backdrop: typeof p.backdrop === "string" ? p.backdrop : undefined,
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

  // Generation Matrix — chip/platform generations × component categories.
  // Each cell is a rounded card with a bold label + 2-line spec slot.
  // Adapted from SA's Vera Rubin GPU/CPU deep-dive diagrams.
  if (templateId === "gen-matrix") {
    const gens = [
      { name: "Hopper",     year: "2022", accent: "#2EAD8E" },
      { name: "Blackwell",  year: "2024", accent: "#0B86D1" },
      { name: "Rubin",      year: "2026", accent: "#F7B041" },
      { name: "Feynman",    year: "2028", accent: "#E06347" },
    ];
    const rows = [
      { label: "GPU die",       cells: ["GH100\n814 mm²",      "GB100×2\n2× 800 mm²", "R100×2\n3D-stacked",    "F100\nTBD"] },
      { label: "HBM",           cells: ["HBM3\n80 GB · 3 TB/s","HBM3e\n192 GB · 8 TB/s","HBM4\n288 GB · 13 TB/s","HBM5\nTBD"] },
      { label: "CPU",           cells: ["Grace\n72×Neoverse",  "Grace\n72×Neoverse",  "Vera\n88×Olympus",      "Vera Next\nTBD"] },
      { label: "NVLink switch", cells: ["NVSwitch 3\n900 GB/s","NVSwitch 4\n1.8 TB/s","NVSwitch 5\n3.6 TB/s",  "NVSwitch 6\nTBD"] },
      { label: "Networking",    cells: ["CX-7\n400 G",          "CX-8\n800 G",         "CX-9\n1.6 T",            "CX-10\nTBD"] },
      { label: "System",        cells: ["HGX H100\n8-GPU baseboard","GB200 NVL72\n72-GPU rack","NVL144\n144-GPU rack","Feynman rack\nTBD"] },
    ];
    const nodes: DiagramNode[] = [];
    const colW = 200, rowH = 100, gx = 130, gy = 70;
    // Column headers (year above, name in colored bar)
    gens.forEach((g, ci) => {
      nodes.push({ id: "yh" + ci, kind: "text", x: gx + ci * colW, y: 16, w: colW - 12, h: 18, text: g.year, fontSize: 11 });
      nodes.push({ id: "gh" + ci, kind: "rounded", x: gx + ci * colW, y: 36, w: colW - 12, h: 30, fill: g.accent + "22", stroke: g.accent, text: g.name });
    });
    // Rows
    rows.forEach((r, ri) => {
      nodes.push({ id: "rl" + ri, kind: "text", x: 14, y: gy + ri * rowH + 36, w: gx - 24, h: 22, text: r.label, fontSize: 13 });
      r.cells.forEach((cellText, ci) => {
        const accent = gens[ci].accent;
        nodes.push({
          id: "c" + ri + "_" + ci, kind: "rounded",
          x: gx + ci * colW, y: gy + ri * rowH,
          w: colW - 12, h: rowH - 14,
          fill: "#10101C", stroke: accent + "AA",
          text: cellText, fontSize: 11.5,
        });
      });
    });
    return { nodes, edges: [] };
  }

  // Rack Architecture — two rack columns w/ labeled component slots,
  // connected by NVLink Fabric + Power Bus.
  if (templateId === "rack-arch") {
    const racks = [
      { x: 90,  name: "Rack A" },
      { x: 410, name: "Rack B" },
    ];
    const slots = [
      { label: "GPU Tray ×8",      accent: "#F7B041" },
      { label: "NVLink Switch",    accent: "#0B86D1" },
      { label: "PSU Shelf",        accent: "#E06347" },
      { label: "Management",       accent: "#2EAD8E" },
    ];
    const slotH = 70, slotW = 220, y0 = 80;
    const nodes: DiagramNode[] = [];
    racks.forEach((r, ri) => {
      // Rack outer
      nodes.push({ id: "rk" + ri, kind: "rect", x: r.x, y: y0 - 30, w: slotW, h: slots.length * (slotH + 8) + 40, fill: "#06060A", stroke: "#FFFFFF44", strokeWidth: 1.5 });
      nodes.push({ id: "rkt" + ri, kind: "text", x: r.x, y: y0 - 26, w: slotW, h: 22, text: r.name, fontSize: 14 });
      slots.forEach((s, si) => {
        nodes.push({
          id: "sl" + ri + "_" + si, kind: "rounded",
          x: r.x + 10, y: y0 + si * (slotH + 8),
          w: slotW - 20, h: slotH,
          fill: s.accent + "1A", stroke: s.accent, text: s.label,
        });
      });
    });
    // Bus lines spanning both racks
    const nvY = y0 + (slots.length * (slotH + 8)) + 60;
    nodes.push({ id: "nvb", kind: "rect", x: 60, y: nvY, w: 600, h: 38, fill: "#0B86D122", stroke: "#0B86D1", text: "NVLink Fabric — 1.8 TB/s" });
    nodes.push({ id: "pwb", kind: "rect", x: 60, y: nvY + 60, w: 600, h: 38, fill: "#E0634722", stroke: "#E06347", text: "Power Bus — 800 VDC" });
    const edges: DiagramEdge[] = [
      { id: "ea", from: { kind: "node", nodeId: "sl0_1", side: "bottom" }, to: { kind: "node", nodeId: "nvb", side: "top" }, stroke: "#0B86D1", arrowEnd: true },
      { id: "eb", from: { kind: "node", nodeId: "sl1_1", side: "bottom" }, to: { kind: "node", nodeId: "nvb", side: "top" }, stroke: "#0B86D1", arrowEnd: true },
      { id: "pa", from: { kind: "node", nodeId: "sl0_2", side: "bottom" }, to: { kind: "node", nodeId: "pwb", side: "top" }, stroke: "#E06347", arrowEnd: true },
      { id: "pb", from: { kind: "node", nodeId: "sl1_2", side: "bottom" }, to: { kind: "node", nodeId: "pwb", side: "top" }, stroke: "#E06347", arrowEnd: true },
    ];
    return { nodes, edges };
  }

  // Cross-section / Layer Stack — full-width stacked layers w/ left
  // annotation arrows. Adapted from SA's package-structure cutaways.
  if (templateId === "layer-stack") {
    const layers = [
      { name: "GPU dies",        accent: "#F7B041", desc: "2× Rubin SXM" },
      { name: "Interposer",      accent: "#0B86D1", desc: "CoWoS-L" },
      { name: "HBM stacks",      accent: "#2EAD8E", desc: "8× HBM4 12-Hi" },
      { name: "Package substrate", accent: "#905CCB", desc: "Organic ABF" },
      { name: "PCB",             accent: "#E06347", desc: "OAM/SXM board" },
    ];
    const nodes: DiagramNode[] = [];
    const x0 = 240, w = 540, layerH = 64, y0 = 80;
    nodes.push({ id: "title", kind: "text", x: x0, y: 30, w, h: 28, text: "Package Structure", fontSize: 20 });
    layers.forEach((l, i) => {
      nodes.push({
        id: "ly" + i, kind: "rect",
        x: x0, y: y0 + i * layerH, w, h: layerH - 6,
        fill: l.accent + "33", stroke: l.accent, text: l.name, fontSize: 14,
      });
      nodes.push({ id: "an" + i, kind: "text", x: 30, y: y0 + i * layerH + 14, w: 180, h: 24, text: l.desc, fontSize: 11.5 });
    });
    const edges: DiagramEdge[] = layers.map((_l, i) => ({
      id: "p" + i,
      from: { kind: "node", nodeId: "an" + i, side: "right" },
      to:   { kind: "node", nodeId: "ly" + i, side: "left" },
      stroke: "#FFFFFF77", arrowEnd: true, strokeWidth: 1.2,
    }));
    return { nodes, edges };
  }

  // Die Floorplan — outer die boundary + 3×2 grid of functional blocks.
  // Adapted from SA's Rubin GPU floorplan diagram.
  if (templateId === "die-floorplan") {
    const blocks = [
      { l: "GPC",        accent: "#F7B041" },
      { l: "L2 Cache",   accent: "#0B86D1" },
      { l: "NV-HBI",     accent: "#2EAD8E" },
      { l: "HBM CTRL",   accent: "#E06347" },
      { l: "NVLink C2C", accent: "#905CCB" },
      { l: "PCIe Gen6",  accent: "#FFD166" },
    ];
    const nodes: DiagramNode[] = [];
    const dx = 100, dy = 80, dw = 660, dh = 380;
    // Outer die boundary
    nodes.push({ id: "die", kind: "rect", x: dx, y: dy, w: dw, h: dh, fill: "#06060A", stroke: "#FFFFFF", strokeWidth: 3 });
    nodes.push({ id: "diet", kind: "text", x: dx, y: dy - 26, w: dw, h: 22, text: "GPU Die Floorplan", fontSize: 14 });
    const cols = 3, rows = 2, pad = 14;
    const blockW = (dw - pad * (cols + 1)) / cols;
    const blockH = (dh - pad * (rows + 1)) / rows;
    blocks.forEach((b, i) => {
      const r = Math.floor(i / cols), c = i % cols;
      nodes.push({
        id: "blk" + i, kind: "rect",
        x: dx + pad + c * (blockW + pad),
        y: dy + pad + r * (blockH + pad),
        w: blockW, h: blockH,
        fill: b.accent + "22", stroke: b.accent, strokeWidth: 1.5,
        text: b.l, fontSize: 14,
      });
    });
    return { nodes, edges: [] };
  }

  // Value/Supply Chain Flow — 5 horizontal nodes connected by arrows,
  // each with a title + subtitle + % badge.
  if (templateId === "value-chain") {
    const steps = [
      { name: "Wafer",     sub: "TSMC N3P",        pct: "~$12k", accent: "#0B86D1" },
      { name: "Package",   sub: "CoWoS-L",         pct: "~$8k",  accent: "#2EAD8E" },
      { name: "System",    sub: "NVL144 rack",     pct: "~$3.5M", accent: "#F7B041" },
      { name: "Cloud",     sub: "Hyperscaler",     pct: "~$4/hr/GPU", accent: "#905CCB" },
      { name: "End user",  sub: "Inference / training", pct: "—", accent: "#E06347" },
    ];
    const nodes: DiagramNode[] = [];
    const edges: DiagramEdge[] = [];
    const nW = 170, gap = 40, y = 180;
    const totalW = steps.length * nW + (steps.length - 1) * gap;
    const x0 = (900 - totalW) / 2;
    steps.forEach((s, i) => {
      const x = x0 + i * (nW + gap);
      nodes.push({ id: "n" + i, kind: "rounded", x, y, w: nW, h: 80, fill: s.accent + "22", stroke: s.accent, text: s.name, fontSize: 16 });
      nodes.push({ id: "ns" + i, kind: "text", x, y: y + 86, w: nW, h: 18, text: s.sub, fontSize: 11.5 });
      nodes.push({ id: "nb" + i, kind: "rounded", x: x + nW - 70, y: y - 26, w: 70, h: 22, fill: "#000000AA", stroke: s.accent, text: s.pct, fontSize: 10 });
      if (i > 0) {
        edges.push({ id: "e" + i, from: { kind: "node", nodeId: "n" + (i - 1), side: "right" }, to: { kind: "node", nodeId: "n" + i, side: "left" }, stroke: "#FFFFFFCC", arrowEnd: true, strokeWidth: 2 });
      }
    });
    return { nodes, edges };
  }

  // Power Distribution — vertical chain of power stages w/ voltage
  // arrows. Adapted from SA's 800VDC explainer diagram.
  if (templateId === "power-dist") {
    const stages = [
      { name: "Grid",                accent: "#FFFFFF", v: "" },
      { name: "Utility Transformer", accent: "#0B86D1", v: "13.8 kV → 480 V" },
      { name: "On-site Substation",  accent: "#2EAD8E", v: "480 V → 800 VDC" },
      { name: "PDU",                 accent: "#F7B041", v: "800 VDC bus" },
      { name: "Power Shelf",         accent: "#905CCB", v: "800 V → 48 V" },
      { name: "GPU / Accelerator",   accent: "#E06347", v: "48 V → 1.0 V" },
    ];
    const nodes: DiagramNode[] = [];
    const edges: DiagramEdge[] = [];
    const x = 320, w = 280, h = 56, gap = 38;
    stages.forEach((s, i) => {
      const y = 30 + i * (h + gap);
      nodes.push({ id: "p" + i, kind: "rounded", x, y, w, h, fill: s.accent + "22", stroke: s.accent, text: s.name, fontSize: 14 });
      if (i > 0) {
        edges.push({
          id: "pe" + i,
          from: { kind: "node", nodeId: "p" + (i - 1), side: "bottom" },
          to:   { kind: "node", nodeId: "p" + i,       side: "top" },
          stroke: s.accent, arrowEnd: true, strokeWidth: 2,
        });
        nodes.push({ id: "vl" + i, kind: "text", x: x + w + 12, y: y - gap + 4, w: 220, h: 22, text: s.v, fontSize: 11 });
      }
    });
    return { nodes, edges };
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
      width: "100%",
      minWidth: 0,
      maxHeight: "calc(100vh - 140px)",
      overflowY: "auto",
      // Prevent any rogue child from pushing the column wider than its
      // parent — left rail must stay affixed, items wrap/shrink instead.
      overflowX: "hidden",
      paddingRight: 4,
      boxSizing: "border-box",
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
    // Hardware
    if (kind === "hwRack")        return <g stroke={accent} fill={accent + "22"} strokeWidth="1.2"><rect x="10" y="2" width="12" height="20" rx="1" /><line x1="11" y1="7" x2="21" y2="7" opacity="0.55" /><line x1="11" y1="12" x2="21" y2="12" opacity="0.55" /><line x1="11" y1="17" x2="21" y2="17" opacity="0.55" /></g>;
    if (kind === "hwServer")      return <g stroke={accent} fill={accent + "22"} strokeWidth="1.2"><rect x="2" y="10" width="28" height="4" /><circle cx="26" cy="12" r="1" fill={accent} stroke="none" /></g>;
    if (kind === "hwGpu")         return <g stroke={accent} fill={accent + "22"} strokeWidth="1.2"><rect x="2" y="6" width="28" height="12" rx="2" /><line x1="6" y1="18" x2="6" y2="20" strokeWidth="1" /><line x1="11" y1="18" x2="11" y2="20" strokeWidth="1" /><line x1="16" y1="18" x2="16" y2="20" strokeWidth="1" /><line x1="21" y1="18" x2="21" y2="20" strokeWidth="1" /><line x1="26" y1="18" x2="26" y2="20" strokeWidth="1" /></g>;
    if (kind === "hwSwitch")      return <g stroke={accent} fill={accent + "22"} strokeWidth="1.2"><rect x="2" y="7" width="28" height="10" rx="2" /><line x1="6" y1="17" x2="6" y2="19" /><line x1="11" y1="17" x2="11" y2="19" /><line x1="16" y1="17" x2="16" y2="19" /><line x1="21" y1="17" x2="21" y2="19" /><line x1="26" y1="17" x2="26" y2="19" /></g>;
    if (kind === "hwPsu")         return <g stroke={accent} fill={accent + "22"} strokeWidth="1.2"><rect x="2" y="9" width="28" height="6" /><circle cx="26" cy="12" r="1.2" fill={accent} stroke="none" /></g>;
    if (kind === "hwCdu")         return <g stroke={accent} fill={accent + "22"} strokeWidth="1.2"><rect x="6" y="3" width="20" height="18" rx="3" /><circle cx="16" cy="12" r="5" fill="transparent" /><line x1="13" y1="9" x2="19" y2="15" strokeWidth="1" /></g>;
    // Network
    if (kind === "netSwitch")     return <g stroke={accent} fill={accent + "22"} strokeWidth="1.2"><rect x="2" y="7" width="28" height="10" rx="2" /><line x1="8" y1="17" x2="8" y2="20" /><line x1="16" y1="17" x2="16" y2="20" /><line x1="24" y1="17" x2="24" y2="20" /></g>;
    if (kind === "netRouter")     return <g stroke={accent} fill={accent + "22"} strokeWidth="1.2"><rect x="6" y="6" width="20" height="14" rx="2" /><line x1="3" y1="13" x2="9" y2="13" /><line x1="23" y1="13" x2="29" y2="13" /></g>;
    if (kind === "netFabric")     return <g stroke={accent} fill={accent + "22"} strokeWidth="1.2"><ellipse cx="16" cy="13" rx="13" ry="7" /></g>;
    if (kind === "netNic")        return <g stroke={accent} fill={accent + "22"} strokeWidth="1.2"><rect x="3" y="7" width="26" height="10" rx="1" /><line x1="3" y1="18" x2="29" y2="18" strokeDasharray="2 1.5" strokeWidth="1" /></g>;
    // Semi
    if (kind === "semiDie")       return <g stroke={accent} fill={accent + "11"} strokeWidth="1.6"><rect x="4" y="3" width="24" height="18" /><line x1="4" y1="3" x2="8" y2="3" strokeWidth="2" /><line x1="4" y1="3" x2="4" y2="7" strokeWidth="2" /><line x1="28" y1="3" x2="24" y2="3" strokeWidth="2" /><line x1="28" y1="3" x2="28" y2="7" strokeWidth="2" /><line x1="4" y1="21" x2="8" y2="21" strokeWidth="2" /><line x1="4" y1="21" x2="4" y2="17" strokeWidth="2" /><line x1="28" y1="21" x2="24" y2="21" strokeWidth="2" /><line x1="28" y1="21" x2="28" y2="17" strokeWidth="2" /></g>;
    if (kind === "semiChiplet")   return <rect x="6" y="6" width="20" height="12" fill={accent + "33"} stroke={accent} strokeWidth="1.4" />;
    if (kind === "semiHbm")       return <g stroke={accent} fill={accent + "22"} strokeWidth="1"><rect x="10" y="3" width="12" height="18" /><line x1="10" y1="7" x2="22" y2="7" opacity="0.5" /><line x1="10" y1="11" x2="22" y2="11" opacity="0.5" /><line x1="10" y1="15" x2="22" y2="15" opacity="0.5" /><line x1="10" y1="19" x2="22" y2="19" opacity="0.5" /></g>;
    if (kind === "semiInterposer")return <g stroke={accent} fill={accent + "22"} strokeWidth="1"><rect x="2" y="10" width="28" height="4" /><circle cx="6" cy="16" r="0.7" fill={accent} stroke="none" /><circle cx="11" cy="16" r="0.7" fill={accent} stroke="none" /><circle cx="16" cy="16" r="0.7" fill={accent} stroke="none" /><circle cx="21" cy="16" r="0.7" fill={accent} stroke="none" /><circle cx="26" cy="16" r="0.7" fill={accent} stroke="none" /></g>;
    if (kind === "semiSubstrate") return <rect x="2" y="11" width="28" height="3" fill={accent + "22"} stroke={accent} strokeWidth="1" />;
    // Power
    if (kind === "pwrTransformer")return <g stroke={accent} fill="transparent" strokeWidth="1.4"><circle cx="12" cy="12" r="6" /><circle cx="20" cy="12" r="6" /></g>;
    if (kind === "pwrBusbar")     return <g><rect x="2" y="10" width="28" height="5" fill={accent} /><line x1="10" y1="8" x2="10" y2="17" stroke="#fff" opacity="0.5" strokeWidth="1" /><line x1="16" y1="8" x2="16" y2="17" stroke="#fff" opacity="0.5" strokeWidth="1" /><line x1="22" y1="8" x2="22" y2="17" stroke="#fff" opacity="0.5" strokeWidth="1" /></g>;
    if (kind === "pwrPdu")        return <g stroke={accent} fill={accent + "22"} strokeWidth="1.2"><rect x="11" y="2" width="10" height="20" rx="1" /><circle cx="16" cy="7" r="1" fill="transparent" /><circle cx="16" cy="11" r="1" fill="transparent" /><circle cx="16" cy="15" r="1" fill="transparent" /><circle cx="16" cy="19" r="1" fill="transparent" /></g>;
    if (kind === "pwrUps")        return <g stroke={accent} fill={accent + "22"} strokeWidth="1.2"><rect x="3" y="5" width="26" height="14" rx="2" /><rect x="6" y="9" width="7" height="4" fill="transparent" strokeWidth="0.8" /><rect x="13" y="10" width="1.5" height="2" fill={accent} stroke="none" /></g>;
    if (kind === "pwrBreaker")    return <g stroke={accent} fill={accent + "22"} strokeWidth="1.2"><rect x="4" y="6" width="24" height="12" rx="1" /><line x1="9" y1="15" x2="23" y2="9" strokeWidth="1.4" /><circle cx="9" cy="15" r="1.5" fill={accent} /><circle cx="23" cy="9" r="1.5" fill={accent} /></g>;
    return <rect x="2" y="4" width="28" height="16" fill={accent + "22"} stroke={stroke} strokeWidth="1.2" />;
  })();
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="20">{content}</svg>
  );
}

// ─── Top toolbar ──────────────────────────────────────────────────────

function TopToolbar({
  canUndo, canRedo, canDelete, onUndo, onRedo, onDelete, onExport,
  onAddTitle, onAddSubtitle,
  backdrop, onChangeBackdrop,
  onToggleRight, rightOpen,
}: {
  canUndo: boolean; canRedo: boolean; canDelete: boolean;
  onUndo: () => void; onRedo: () => void;
  onDelete: () => void; onExport: () => void;
  onAddTitle: () => void; onAddSubtitle: () => void;
  backdrop: string;
  onChangeBackdrop: (id: string) => void;
  onToggleRight: () => void;
  rightOpen: boolean;
}) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 6,
      padding: "8px 12px",
      background: D.card, border: "1px solid " + D.border, borderRadius: 12,
      flexWrap: "wrap",
    }}>
      <ToolbarBtn Icon={RotateCcw} label="Undo" disabled={!canUndo} onClick={onUndo} hint="⌘Z" />
      <ToolbarBtn Icon={RotateCw}  label="Redo" disabled={!canRedo} onClick={onRedo} hint="⌘⇧Z" />
      <span style={{ width: 1, height: 18, background: D.border, margin: "0 4px" }} />
      <ToolbarBtn Icon={Type}       label="Title"    onClick={onAddTitle} />
      <ToolbarBtn Icon={CaseLower}   label="Subtitle" onClick={onAddSubtitle} />
      <BackdropMenu value={backdrop} onChange={onChangeBackdrop} />
      <span style={{ width: 1, height: 18, background: D.border, margin: "0 4px" }} />
      <ToolbarBtn Icon={Trash2}    label="Delete" disabled={!canDelete} onClick={onDelete} hint="⌫" danger />
      <span style={{ marginLeft: "auto" }} />
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

// Inline dropdown — solid + brand backdrops shown as colored swatches.
function BackdropMenu({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    setTimeout(() => document.addEventListener("click", close), 0);
    return () => document.removeEventListener("click", close);
  }, [open]);
  const current = backdropById(value);
  return (
    <div style={{ position: "relative" }} onClick={(e) => e.stopPropagation()}>
      <button
        onClick={() => setOpen(v => !v)}
        title="Canvas backdrop"
        style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          padding: "6px 10px",
          background: "transparent", border: "1px solid " + D.border,
          color: D.txm,
          fontFamily: mn, fontSize: 10.5, fontWeight: 700, letterSpacing: 0.5,
          borderRadius: 6, cursor: "pointer",
        }}
      >
        <ImageIcon size={12} strokeWidth={2.2} />
        <span
          style={{
            display: "inline-block", width: 12, height: 12, borderRadius: 3,
            background: current.bg, border: "1px solid " + D.border,
          }}
        />
        Backdrop
      </button>
      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 6px)", left: 0,
          background: "#0A0C10", border: "1px solid " + D.border, borderRadius: 8,
          padding: 6, zIndex: 50,
          boxShadow: "0 18px 38px rgba(0,0,0,0.6)",
          display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6,
          minWidth: 260,
        }}>
          {DIAGRAM_BACKDROPS.map(b => (
            <button
              key={b.id}
              onClick={() => { onChange(b.id); setOpen(false); }}
              title={b.label}
              style={{
                position: "relative",
                width: 58, height: 38, padding: 0,
                background: b.bg,
                border: "1px solid " + (b.id === value ? D.amber : D.border),
                outline: b.id === value ? "2px solid " + D.amber + "55" : "none",
                borderRadius: 5, cursor: "pointer",
                color: b.isLight ? "#0A0C10" : "#FFFFFF",
                fontFamily: mn, fontSize: 9, fontWeight: 700, letterSpacing: 0.3,
                overflow: "hidden",
              }}
            >
              {b.overlay && (
                <span style={{ position: "absolute", inset: 0, backgroundImage: b.overlay, pointerEvents: "none" }} />
              )}
              <span style={{ position: "relative" }}>{b.label}</span>
            </button>
          ))}
        </div>
      )}
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
