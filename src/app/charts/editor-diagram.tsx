"use client";

// DiagramEditor · the diagram doc surface.
//
// Layout: [left tool palette] [center canvas] [right properties panel].
// Canvas is loaded via next/dynamic so the react-konva bundle doesn't
// ship server-side or with non-diagram surfaces.

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Square, Circle, Type, ArrowRight, Minus, MousePointer2,
  Trash2, Download, RotateCcw, RotateCw,
} from "lucide-react";
import { D, DIAGRAM_PALETTE, ft, gf, mn } from "./studio-theme";
import { DiagramDocPayload, DiagramNode, StudioDoc } from "./studio-types";
import type { DiagramCanvasProps } from "./diagram-canvas";

const DiagramCanvas = dynamic<DiagramCanvasProps>(
  () => import("./diagram-canvas"),
  { ssr: false, loading: () => <CanvasFallback /> }
);

type Tool = "select" | "rect" | "ellipse" | "text" | "arrow" | "line";

const CANVAS_W_DEFAULT = 1100;
const CANVAS_H_DEFAULT = 640;

interface DiagramEditorProps {
  doc: StudioDoc;
  onChangePayload: (payload: unknown) => void;
}

export default function DiagramEditor({ doc, onChangePayload }: DiagramEditorProps) {
  const initial = useMemo(() => readPayload(doc.payload), [doc.payload]);
  const [nodes, setNodes] = useState<DiagramNode[]>(initial.nodes);
  const [history, setHistory] = useState<DiagramNode[][]>([]);
  const [future, setFuture] = useState<DiagramNode[][]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tool, setTool] = useState<Tool>("select");
  const [fill, setFill] = useState(DIAGRAM_PALETTE[0]);
  const [stroke, setStroke] = useState(DIAGRAM_PALETTE[2]);
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const [canvasSize, setCanvasSize] = useState({ w: CANVAS_W_DEFAULT, h: CANVAS_H_DEFAULT });
  const exportRef = useRef<(() => string) | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    const update = () => {
      const r = canvasRef.current?.getBoundingClientRect();
      if (r) setCanvasSize({ w: Math.max(320, r.width - 4), h: Math.max(360, r.height - 4) });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(canvasRef.current);
    return () => ro.disconnect();
  }, []);

  // Emit on every change. The Studio shell debounces the actual save.
  useEffect(() => {
    const payload: DiagramDocPayload = {
      kind: "diagram",
      version: 1,
      nodes,
      edges: [],
      canvasW: canvasSize.w,
      canvasH: canvasSize.h,
    };
    onChangePayload(payload);
  }, [nodes, canvasSize.w, canvasSize.h, onChangePayload]);

  const selected = nodes.find(n => n.id === selectedId) || null;

  const pushHistory = useCallback((prev: DiagramNode[]) => {
    setHistory((h) => [...h.slice(-49), prev]);
    setFuture([]);
  }, []);

  const createNode = useCallback((n: DiagramNode) => {
    setNodes((cur) => {
      pushHistory(cur);
      return [...cur, n];
    });
    setTool("select");
  }, [pushHistory]);

  const mutateNode = useCallback((id: string, patch: Partial<DiagramNode>) => {
    setNodes((cur) => {
      pushHistory(cur);
      return cur.map(n => n.id === id ? { ...n, ...patch } : n);
    });
  }, [pushHistory]);

  const deleteSelected = useCallback(() => {
    if (!selectedId) return;
    setNodes((cur) => {
      pushHistory(cur);
      return cur.filter(n => n.id !== selectedId);
    });
    setSelectedId(null);
  }, [selectedId, pushHistory]);

  const undo = useCallback(() => {
    setHistory((h) => {
      if (h.length === 0) return h;
      const prev = h[h.length - 1];
      setFuture((f) => [nodes, ...f.slice(0, 49)]);
      setNodes(prev);
      return h.slice(0, -1);
    });
  }, [nodes]);

  const redo = useCallback(() => {
    setFuture((f) => {
      if (f.length === 0) return f;
      const next = f[0];
      setHistory((h) => [...h.slice(-49), nodes]);
      setNodes(next);
      return f.slice(1);
    });
  }, [nodes]);

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
      }
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

  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "62px 1fr 240px",
      gap: 14,
      padding: "16px 22px 80px",
      maxWidth: 1480,
      margin: "0 auto",
    }}>
      <ToolPalette tool={tool} setTool={setTool} />
      <div>
        <TopToolbar
          canUndo={history.length > 0}
          canRedo={future.length > 0}
          canDelete={!!selectedId}
          onUndo={undo}
          onRedo={redo}
          onDelete={deleteSelected}
          onExport={exportPng}
        />
        <div
          ref={canvasRef}
          style={{
            marginTop: 12,
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
            selectedId={selectedId}
            tool={tool}
            fill={fill}
            stroke={stroke}
            onSelect={setSelectedId}
            onCreate={createNode}
            onMutate={mutateNode}
            registerExport={(g) => { exportRef.current = g; }}
          />
          {nodes.length === 0 && (
            <div style={{
              position: "absolute", inset: 0,
              display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center",
              pointerEvents: "none", textAlign: "center",
            }}>
              <div style={{ fontFamily: gf, fontSize: 24, color: D.txm, fontWeight: 800, letterSpacing: -0.4 }}>
                Pick a tool, click to drop a shape.
              </div>
              <div style={{ fontFamily: mn, fontSize: 11, color: D.txd, letterSpacing: 1, marginTop: 6 }}>
                ⌘Z undo · ⌫ delete · Esc deselect
              </div>
            </div>
          )}
        </div>
      </div>
      <PropertiesPanel
        selected={selected}
        fill={fill} setFill={setFill}
        stroke={stroke} setStroke={setStroke}
        onMutate={(patch) => { if (selected) mutateNode(selected.id, patch); }}
        onDelete={deleteSelected}
      />
    </div>
  );
}

function readPayload(payload: unknown): { nodes: DiagramNode[] } {
  if (payload && typeof payload === "object") {
    const p = payload as Partial<DiagramDocPayload>;
    return { nodes: Array.isArray(p.nodes) ? p.nodes : seedFromTemplate(p.templateId) };
  }
  return { nodes: seedFromTemplate(undefined) };
}

function seedFromTemplate(templateId: string | undefined): DiagramNode[] {
  if (templateId === "flowchart") {
    return [
      { id: "n1", kind: "rect",   x: 60,  y: 60,  w: 160, h: 70, fill: "#F7B041", stroke: "#F7B04188", text: "Start" },
      { id: "n2", kind: "rect",   x: 320, y: 60,  w: 160, h: 70, fill: "#0B86D1", stroke: "#0B86D188", text: "Branch A" },
      { id: "n3", kind: "rect",   x: 320, y: 160, w: 160, h: 70, fill: "#0B86D1", stroke: "#0B86D188", text: "Branch B" },
      { id: "a1", kind: "arrow",  x: 220, y: 95,  w: 100, h: 0,  stroke: "#E8E4DD" },
      { id: "a2", kind: "arrow",  x: 220, y: 95,  w: 100, h: 100,stroke: "#E8E4DD" },
    ];
  }
  if (templateId === "wireframe") {
    return [
      { id: "h",  kind: "rect", x: 60, y: 40,  w: 760, h: 60,  fill: "#1A1A2A", stroke: "#F7B04188", text: "Header" },
      { id: "b",  kind: "rect", x: 60, y: 120, w: 760, h: 300, fill: "#10101C", stroke: "#0B86D188", text: "Body" },
      { id: "f",  kind: "rect", x: 60, y: 440, w: 760, h: 60,  fill: "#1A1A2A", stroke: "#2EAD8E88", text: "Footer" },
    ];
  }
  return [];
}

function CanvasFallback() {
  return (
    <div style={{
      width: "100%", height: 520,
      display: "flex", alignItems: "center", justifyContent: "center",
      color: D.txd, fontFamily: mn, fontSize: 10.5, letterSpacing: 1, textTransform: "uppercase",
    }}>Loading canvas…</div>
  );
}

function ToolPalette({ tool, setTool }: { tool: Tool; setTool: (t: Tool) => void }) {
  const tools: { id: Tool; Icon: React.ComponentType<{ size?: number; strokeWidth?: number; color?: string }>; label: string; hint: string }[] = [
    { id: "select",  Icon: MousePointer2, label: "Select",   hint: "V" },
    { id: "rect",    Icon: Square,        label: "Rectangle", hint: "R" },
    { id: "ellipse", Icon: Circle,        label: "Ellipse",  hint: "E" },
    { id: "text",    Icon: Type,          label: "Text",     hint: "T" },
    { id: "arrow",   Icon: ArrowRight,    label: "Arrow",    hint: "A" },
    { id: "line",    Icon: Minus,         label: "Line",     hint: "L" },
  ];
  return (
    <div style={{
      display: "flex", flexDirection: "column", gap: 6,
      padding: 6,
      background: D.card, border: "1px solid " + D.border, borderRadius: 12,
      alignSelf: "start",
      position: "sticky", top: 80,
    }}>
      {tools.map((t) => {
        const active = t.id === tool;
        return (
          <button
            key={t.id}
            onClick={() => setTool(t.id)}
            title={`${t.label} (${t.hint})`}
            style={{
              width: 50, height: 50,
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              background: active ? D.amber + "1F" : "transparent",
              border: "1px solid " + (active ? D.amber + "55" : "transparent"),
              color: active ? D.amber : D.txm,
              borderRadius: 8, cursor: "pointer",
              transition: "background 0.12s, color 0.12s",
            }}
            onMouseEnter={(e) => { if (!active) { e.currentTarget.style.background = "rgba(255,255,255,0.04)"; e.currentTarget.style.color = D.tx; } }}
            onMouseLeave={(e) => { if (!active) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = D.txm; } }}
          ><t.Icon size={18} strokeWidth={2} /></button>
        );
      })}
    </div>
  );
}

function TopToolbar({ canUndo, canRedo, canDelete, onUndo, onRedo, onDelete, onExport }: {
  canUndo: boolean;
  canRedo: boolean;
  canDelete: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onDelete: () => void;
  onExport: () => void;
}) {
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
      <ToolbarBtn Icon={Download}  label="Export PNG" onClick={onExport} />
    </div>
  );
}

function ToolbarBtn({ Icon, label, onClick, disabled, hint, danger }: {
  Icon: React.ComponentType<{ size?: number; strokeWidth?: number; color?: string }>;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  hint?: string;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={hint ? `${label} (${hint})` : label}
      style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        padding: "6px 11px",
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

function PropertiesPanel({ selected, fill, setFill, stroke, setStroke, onMutate, onDelete }: {
  selected: DiagramNode | null;
  fill: string; setFill: (c: string) => void;
  stroke: string; setStroke: (c: string) => void;
  onMutate: (patch: Partial<DiagramNode>) => void;
  onDelete: () => void;
}) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", gap: 14,
      padding: 14,
      background: D.card, border: "1px solid " + D.border, borderRadius: 12,
      alignSelf: "start",
      position: "sticky", top: 80,
    }}>
      <SectionHeading>Defaults</SectionHeading>
      <SwatchRow label="Fill"   value={fill}   onChange={setFill} />
      <SwatchRow label="Stroke" value={stroke} onChange={setStroke} />

      {selected ? (
        <>
          <SectionHeading>{selected.kind}</SectionHeading>
          {selected.kind === "text" && (
            <Field label="Text">
              <input
                value={selected.text || ""}
                onChange={(e) => onMutate({ text: e.target.value })}
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
          {(selected.kind === "rect" || selected.kind === "ellipse" || selected.kind === "text") && (
            <SwatchRow label="Fill" value={selected.fill || fill} onChange={(c) => onMutate({ fill: c })} />
          )}
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
        <div style={{ fontFamily: ft, fontSize: 12, color: D.txd, lineHeight: 1.4 }}>
          Click a shape to edit its position, size, and colors. Hold a tool to drop more.
        </div>
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
