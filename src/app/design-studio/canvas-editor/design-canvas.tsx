"use client";

// DesignCanvas — Fabric.js v7 editor mounted by /design-studio/canvas-editor.
// Four zones (top bar / left panel / center canvas / right panel) plus a
// bottom pages strip for multi-page carousel sets. Fabric init runs only
// inside useEffect so the editor stays out of the SSR pass (page.tsx mounts
// us via next/dynamic with ssr:false anyway).

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as fabric from "fabric";
import { attachSmartGuides } from "./snapping";
import {
  Type as TypeIcon, Image as ImageIcon, Shapes, Layout, Palette,
  Undo2, Redo2, ChevronUp, ChevronDown, ArrowUpToLine, ArrowDownToLine,
  Copy as CopyIcon, Trash2, ZoomIn, ZoomOut,
  AlignStartHorizontal, AlignCenterHorizontal, AlignEndHorizontal,
  AlignStartVertical, AlignCenterVertical, AlignEndVertical,
  Download, Save, Lock, Unlock, Eye, EyeOff, GripVertical, Plus,
  History as HistoryIcon, Files as FilesIcon,
  Group as GroupIcon, Ungroup as UngroupIcon,
  AlignHorizontalDistributeCenter, AlignVerticalDistributeCenter,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { D, ft, gf, mn, uid } from "../../shared-constants";
import { getProject, saveProject, snapshotProject, useAutosave, type ProjectRecord, type ProjectSnapshot } from "../projects-store";
import { exportFabricPNG, exportFabricJPG, exportFabricSVG, exportFabricPDF, exportFabricZip } from "../export";
import { showToast } from "../../toast-context";
import { useShortcuts } from "../../keyboard-shortcuts";
import { TEMPLATES, templatesByCategory, type DesignTemplate } from "./templates";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

// Fabric v7 changed the default object origin from left/top to center.
// Every template in templates.ts and all the insert/align/fit math in this
// editor were authored against left/top semantics — under center defaults
// templates load mangled (backgrounds quarter-visible, text clipped) and
// align throws objects half off-canvas. Restore v6 semantics once at module
// load; objects serialized in payloads carry explicit origins, so saved
// projects round-trip unchanged.
fabric.FabricObject.ownDefaults.originX = "left";
fabric.FabricObject.ownDefaults.originY = "top";

// ─── Brand palette + presets ───────────────────────────────────────
const BRAND_PALETTE = ["#F7B041", "#2EAD8E", "#E06347", "#905CCB", "#0B86D1", "#26C9D8", "#EDEDED", "#0D0D12"];
const SHAPE_PRESETS = [
  { id: "rect",     label: "Rect",     Icon: Layout },
  { id: "circle",   label: "Circle",   Icon: Layout },
  { id: "triangle", label: "Triangle", Icon: Shapes },
  { id: "line",     label: "Line",     Icon: Shapes },
  { id: "star",     label: "Star",     Icon: Shapes },
];
const TEXT_PRESETS = [
  { id: "h",  label: "Heading",  fontSize: 64, fontWeight: 900, fontFamily: "Grift,Outfit,sans-serif" },
  { id: "s",  label: "Subhead",  fontSize: 32, fontWeight: 700, fontFamily: "Grift,Outfit,sans-serif" },
  { id: "b",  label: "Body",     fontSize: 18, fontWeight: 400, fontFamily: "Arial, Helvetica, sans-serif" },
];

const SA_LOGOS = [
  { src: "/sa-lettermark-text.svg", label: "Wordmark" },
  { src: "/sa-box-lettermark.svg",  label: "Lettermark" },
  { src: "/sa-logo-full.svg",       label: "Full logo" },
  { src: "/sa-logo.svg",            label: "Mono" },
];

const HIST_CAP = 30;

interface Props {
  project: ProjectRecord;
  onUpdatePages: (pages: ProjectRecord["pages"]) => void;
  onUpdateTitle: (title: string) => void;
}

// ─── Page state — one Fabric canvas per page ────────────────────────
interface PageState {
  id: string;
  el: HTMLCanvasElement | null;
  canvas: fabric.Canvas | null;
  history: string[];      // JSON snapshots
  historyIdx: number;     // pointer into history
  detachGuides?: () => void; // smart-snapping teardown
}

export function DesignCanvas({ project, onUpdatePages, onUpdateTitle }: Props) {
  const w = project.preset?.width || 1080;
  const h = project.preset?.height || 1080;
  const isMultiPage = (project.category || "") === "carousel";

  const [pages, setPages] = useState<ProjectRecord["pages"]>(project.pages);
  const [activeIdx, setActiveIdx] = useState(0);
  const [zoom, setZoom] = useState(0.6);
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom; // keep snapping tolerance correct without re-binding the canvas
  const [leftTab, setLeftTab] = useState<"templates" | "elements" | "text" | "uploads" | "brand">("templates");
  const [selected, setSelected] = useState<fabric.Object | null>(null);
  const [, force] = useState(0);
  const tick = useCallback(() => force(x => x + 1), []);
  const [title, setTitle] = useState(project.title);
  const [exportOpen, setExportOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [snapshots, setSnapshots] = useState<ProjectSnapshot[]>(project.snapshots || []);

  const router = useRouter();

  const stateRef = useRef<PageState[]>([]);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const mainRef = useRef<HTMLDivElement | null>(null); // the scrollable canvas viewport
  const clipboardRef = useRef<fabric.Object | null>(null); // copy/paste buffer

  // ── lifecycle: bind canvases for each page ──
  useEffect(() => {
    // Ensure stateRef tracks pages.
    while (stateRef.current.length < pages.length) {
      stateRef.current.push({ id: pages[stateRef.current.length].id, el: null, canvas: null, history: [], historyIdx: -1 });
    }
    while (stateRef.current.length > pages.length) {
      const last = stateRef.current.pop();
      if (last?.canvas) { try { last.detachGuides?.(); last.canvas.dispose(); } catch {} }
    }
    return () => {
      stateRef.current.forEach(s => { if (s.canvas) { try { s.detachGuides?.(); s.canvas.dispose(); } catch {} } });
      stateRef.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── bind a Fabric canvas to a freshly mounted <canvas> ref ──
  const bindCanvas = useCallback((index: number, el: HTMLCanvasElement | null) => {
    if (!el) return;
    const slot = stateRef.current[index];
    if (!slot) return;
    if (slot.el === el && slot.canvas) return;
    slot.el = el;
    const canvas = new fabric.Canvas(el, {
      width: w, height: h,
      backgroundColor: "#FFFFFF", preserveObjectStacking: true,
    });
    slot.canvas = canvas;
    canvas.on("selection:created", e => setSelected((e as unknown as { selected?: fabric.Object[] }).selected?.[0] || canvas.getActiveObject() || null));
    canvas.on("selection:updated", () => setSelected(canvas.getActiveObject() || null));
    canvas.on("selection:cleared", () => setSelected(null));
    canvas.on("object:modified", () => { snapshotHistory(index); tick(); });
    canvas.on("object:added", () => { snapshotHistory(index); tick(); });
    canvas.on("object:removed", () => { snapshotHistory(index); tick(); });

    // Smart snapping + alignment guides (object-to-object + canvas edges/center).
    slot.detachGuides = attachSmartGuides(canvas, {
      getDims: () => ({ width: w, height: h }),
      getZoom: () => zoomRef.current,
    });

    // Hydrate from existing payload.
    const payload = pages[index]?.payload;
    if (payload && typeof payload === "object") {
      canvas.loadFromJSON(payload as Record<string, unknown>).then(() => { canvas.renderAll(); seedHistory(index); });
    } else {
      // Apply seed template, else blank.
      const tpl = project.templateId ? TEMPLATES.find(t => t.id === project.templateId) : null;
      if (tpl) canvas.loadFromJSON(tpl.payload as unknown as Record<string, unknown>).then(() => { canvas.renderAll(); seedHistory(index); });
      else seedHistory(index);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [w, h]);

  function seedHistory(index: number) {
    const slot = stateRef.current[index];
    if (!slot?.canvas) return;
    const j = JSON.stringify(slot.canvas.toJSON());
    slot.history = [j];
    slot.historyIdx = 0;
  }

  function snapshotHistory(index: number) {
    const slot = stateRef.current[index];
    if (!slot?.canvas) return;
    const j = JSON.stringify(slot.canvas.toJSON());
    if (slot.history[slot.historyIdx] === j) return;
    slot.history = slot.history.slice(0, slot.historyIdx + 1);
    slot.history.push(j);
    if (slot.history.length > HIST_CAP) slot.history.shift();
    slot.historyIdx = slot.history.length - 1;
  }

  function undo() {
    const slot = stateRef.current[activeIdx];
    if (!slot?.canvas || slot.historyIdx <= 0) return;
    slot.historyIdx -= 1;
    slot.canvas.loadFromJSON(JSON.parse(slot.history[slot.historyIdx])).then(() => { slot.canvas?.renderAll(); tick(); });
  }
  function redo() {
    const slot = stateRef.current[activeIdx];
    if (!slot?.canvas || slot.historyIdx >= slot.history.length - 1) return;
    slot.historyIdx += 1;
    slot.canvas.loadFromJSON(JSON.parse(slot.history[slot.historyIdx])).then(() => { slot.canvas?.renderAll(); tick(); });
  }

  // ── autosave: serialize every page to project.pages, persist ──
  const captureAllPages = useCallback(async () => {
    const next: ProjectRecord["pages"] = pages.map((p, i) => {
      const slot = stateRef.current[i];
      const payload = slot?.canvas ? slot.canvas.toJSON() : p.payload;
      let thumb = p.thumb;
      try {
        if (slot?.canvas) thumb = slot.canvas.toDataURL({ format: "png", multiplier: 0.25 });
      } catch {}
      return { id: p.id, thumb, payload };
    });
    setPages(next);
    onUpdatePages(next);
    return next;
  }, [pages, onUpdatePages]);

  const autosaveDepKey = useMemo(() => {
    // Re-run autosave whenever the visible selection changes or zoom adjusts —
    // both are cheap proxies for "user did something".
    return { selKey: selected ? (selected as fabric.Object & { id?: string }).id || JSON.stringify(selected.toJSON()) : null, zoom, leftTab, title };
  }, [selected, zoom, leftTab, title]);

  const autosave = useAutosave(async () => {
    const nextPages = await captureAllPages();
    await saveProject({
      id: project.id, title, kind: "canvas", pages: nextPages,
      category: project.category, preset: project.preset, templateId: project.templateId, meta: project.meta,
    });
  }, [autosaveDepKey, pages.length]);

  const autosaveLabel = autosave.status === "saving"
    ? "Saving…"
    : autosave.status === "saved" && autosave.lastSavedAt
      ? "Saved " + relTime(autosave.lastSavedAt)
      : autosave.status === "error" ? "Save failed" : "Idle";

  // ── add things to the active canvas ──
  function activeCanvas(): fabric.Canvas | null { return stateRef.current[activeIdx]?.canvas || null; }

  function addShape(id: string) {
    const c = activeCanvas(); if (!c) return;
    const cx = c.getWidth() / 2, cy = c.getHeight() / 2;
    let obj: fabric.Object | null = null;
    if (id === "rect")     obj = new fabric.Rect({ left: cx - 120, top: cy - 80, width: 240, height: 160, fill: BRAND_PALETTE[0], rx: 8, ry: 8 });
    if (id === "circle")   obj = new fabric.Circle({ left: cx - 90, top: cy - 90, radius: 90, fill: BRAND_PALETTE[1] });
    if (id === "triangle") obj = new fabric.Triangle({ left: cx - 100, top: cy - 80, width: 200, height: 180, fill: BRAND_PALETTE[2] });
    if (id === "line")     obj = new fabric.Line([cx - 140, cy, cx + 140, cy], { stroke: BRAND_PALETTE[6], strokeWidth: 4 });
    if (id === "star")     obj = new fabric.Polygon([{x:0,y:-90},{x:25,y:-30},{x:90,y:-30},{x:38,y:8},{x:55,y:75},{x:0,y:35},{x:-55,y:75},{x:-38,y:8},{x:-90,y:-30},{x:-25,y:-30}], { fill: BRAND_PALETTE[0], left: cx - 90, top: cy - 90 });
    if (obj) { c.add(obj); c.setActiveObject(obj); c.requestRenderAll(); }
  }

  function addText(preset: typeof TEXT_PRESETS[number]) {
    const c = activeCanvas(); if (!c) return;
    const box = new fabric.Textbox(preset.label.toUpperCase(), {
      left: c.getWidth() / 2 - 200, top: c.getHeight() / 2 - 40,
      width: 400, fontSize: preset.fontSize, fontWeight: preset.fontWeight,
      fontFamily: preset.fontFamily, fill: "#EDEDED", textAlign: "center",
    });
    c.add(box); c.setActiveObject(box); c.requestRenderAll();
  }

  function addImageFromFile(file: File) {
    const c = activeCanvas(); if (!c) return;
    const reader = new FileReader();
    reader.onload = () => {
      const url = reader.result as string;
      fabric.FabricImage.fromURL(url, { crossOrigin: "anonymous" }).then(img => {
        const scale = Math.min(c.getWidth() / (img.width || 1), c.getHeight() / (img.height || 1)) * 0.6;
        img.scale(scale);
        img.set({ left: c.getWidth() / 2 - (img.getScaledWidth() / 2), top: c.getHeight() / 2 - (img.getScaledHeight() / 2) });
        c.add(img); c.setActiveObject(img); c.requestRenderAll();
      });
    };
    reader.readAsDataURL(file);
  }

  function addLogo(src: string) {
    const c = activeCanvas(); if (!c) return;
    fabric.FabricImage.fromURL(src, { crossOrigin: "anonymous" }).then(img => {
      const scale = Math.min(c.getWidth() / (img.width || 1), c.getHeight() / (img.height || 1)) * 0.35;
      img.scale(scale);
      img.set({ left: 60, top: 60 });
      c.add(img); c.setActiveObject(img); c.requestRenderAll();
    });
  }

  function loadTemplate(tpl: DesignTemplate) {
    const c = activeCanvas(); if (!c) return;
    c.loadFromJSON(tpl.payload as unknown as Record<string, unknown>).then(() => { c.renderAll(); snapshotHistory(activeIdx); tick(); });
  }

  function deleteActive() {
    const c = activeCanvas(); if (!c) return;
    const obj = c.getActiveObject(); if (!obj) return;
    c.remove(obj); c.discardActiveObject(); c.requestRenderAll();
  }
  function duplicateActive() {
    const c = activeCanvas(); if (!c) return;
    const obj = c.getActiveObject(); if (!obj) return;
    obj.clone().then(cl => {
      cl.set({ left: (obj.left || 0) + 24, top: (obj.top || 0) + 24 });
      c.add(cl); c.setActiveObject(cl); c.requestRenderAll();
    });
  }
  // Clipboard (in-memory): mirrors the duplicate clone path so it handles the
  // same object kinds Cmd+D already does.
  async function copyActive() {
    const c = activeCanvas(); const obj = c?.getActiveObject(); if (!obj) return;
    clipboardRef.current = await obj.clone();
  }
  async function pasteClipboard() {
    const c = activeCanvas(); const src = clipboardRef.current; if (!c || !src) return;
    const cl = await src.clone();
    cl.set({ left: (src.left || 0) + 24, top: (src.top || 0) + 24 });
    c.add(cl); c.setActiveObject(cl); c.requestRenderAll(); snapshotHistory(activeIdx); tick();
  }
  async function cutActive() { await copyActive(); deleteActive(); }
  function bringForward() { const c = activeCanvas(); const o = c?.getActiveObject(); if (c && o) { c.bringObjectForward(o); c.requestRenderAll(); } }
  function sendBackward() { const c = activeCanvas(); const o = c?.getActiveObject(); if (c && o) { c.sendObjectBackwards(o); c.requestRenderAll(); } }
  function bringToFront() { const c = activeCanvas(); const o = c?.getActiveObject(); if (c && o) { c.bringObjectToFront(o); c.requestRenderAll(); } }
  function sendToBack() { const c = activeCanvas(); const o = c?.getActiveObject(); if (c && o) { c.sendObjectToBack(o); c.requestRenderAll(); } }

  function align(direction: "left" | "centerH" | "right" | "top" | "centerV" | "bottom") {
    const c = activeCanvas(); if (!c) return;
    const obj = c.getActiveObject(); if (!obj) return;
    const cw = c.getWidth(), ch = c.getHeight();
    const ow = obj.getScaledWidth(), oh = obj.getScaledHeight();
    if (direction === "left")    obj.set({ left: 0 });
    if (direction === "centerH") obj.set({ left: (cw - ow) / 2 });
    if (direction === "right")   obj.set({ left: cw - ow });
    if (direction === "top")     obj.set({ top: 0 });
    if (direction === "centerV") obj.set({ top: (ch - oh) / 2 });
    if (direction === "bottom")  obj.set({ top: ch - oh });
    obj.setCoords(); c.requestRenderAll();
  }

  // ── zoom / fit ──
  const fitToScreen = useCallback(() => {
    const el = mainRef.current; if (!el) return;
    const pad = 80;
    const z = Math.min((el.clientWidth - pad) / w, (el.clientHeight - pad) / h);
    if (isFinite(z) && z > 0) setZoom(Math.min(2, Math.max(0.1, Math.round(z * 1000) / 1000)));
  }, [w, h]);

  // ── arrange: group / ungroup / distribute ──
  function groupActive() {
    const c = activeCanvas(); if (!c) return;
    const active = c.getActiveObject();
    if (!active || active.type !== "activeselection") return;
    const objs = c.getActiveObjects().slice();
    c.discardActiveObject(); // restores each object's absolute canvas coords
    objs.forEach(o => c.remove(o));
    const group = new fabric.Group(objs);
    c.add(group); c.setActiveObject(group);
    c.requestRenderAll(); snapshotHistory(activeIdx); tick();
  }
  function ungroupActive() {
    const c = activeCanvas(); if (!c) return;
    const active = c.getActiveObject();
    if (!active || active.type !== "group") return;
    const group = active as fabric.Group;
    const objs = group.getObjects().slice();
    (group as unknown as { removeAll?: () => void }).removeAll?.(); // detach + restore coords (v6)
    c.remove(group);
    objs.forEach(o => c.add(o));
    const sel = new fabric.ActiveSelection(objs, { canvas: c });
    c.setActiveObject(sel);
    c.requestRenderAll(); snapshotHistory(activeIdx); tick();
  }
  function distribute(axis: "h" | "v") {
    const c = activeCanvas(); if (!c) return;
    const active = c.getActiveObject();
    if (!active || active.type !== "activeselection") return;
    const objs = c.getActiveObjects().slice();
    if (objs.length < 3) return;
    c.discardActiveObject(); // absolute coords
    const pos = (o: fabric.Object) => (axis === "h" ? (o.left || 0) : (o.top || 0));
    const sorted = objs.slice().sort((a, b) => pos(a) - pos(b));
    const start = pos(sorted[0]);
    const step = (pos(sorted[sorted.length - 1]) - start) / (sorted.length - 1);
    sorted.forEach((o, i) => {
      if (i > 0 && i < sorted.length - 1) {
        if (axis === "h") o.set({ left: start + step * i }); else o.set({ top: start + step * i });
        o.setCoords();
      }
    });
    const sel = new fabric.ActiveSelection(objs, { canvas: c });
    c.setActiveObject(sel);
    c.requestRenderAll(); snapshotHistory(activeIdx); tick();
  }

  // ── image ops on the selected image ──
  function replaceSelectedImage(file: File) {
    const c = activeCanvas(); const obj = c?.getActiveObject();
    if (!c || !obj || obj.type !== "image") return;
    const reader = new FileReader();
    reader.onload = () => {
      const url = reader.result as string;
      (obj as fabric.FabricImage).setSrc(url, { crossOrigin: "anonymous" }).then(() => {
        c.requestRenderAll(); snapshotHistory(activeIdx); tick();
      });
    };
    reader.readAsDataURL(file);
  }
  function fitSelectedImage(mode: "contain" | "cover") {
    const c = activeCanvas(); const obj = c?.getActiveObject();
    if (!c || !obj || obj.type !== "image") return;
    const img = obj as fabric.FabricImage;
    const iw = img.width || 1, ih = img.height || 1;
    const s = mode === "cover" ? Math.max(c.getWidth() / iw, c.getHeight() / ih) : Math.min(c.getWidth() / iw, c.getHeight() / ih);
    img.set({ scaleX: s, scaleY: s, left: (c.getWidth() - iw * s) / 2, top: (c.getHeight() - ih * s) / 2 });
    img.setCoords(); c.requestRenderAll(); snapshotHistory(activeIdx); tick();
  }

  // ── multi-page ──
  function addPage() {
    const next: ProjectRecord["pages"] = [...pages, { id: uid("page"), payload: null }];
    setPages(next); onUpdatePages(next);
    setActiveIdx(next.length - 1);
  }
  function removePage(idx: number) {
    if (pages.length <= 1) return;
    const next = pages.slice(); next.splice(idx, 1);
    // Dispose the corresponding canvas.
    const slot = stateRef.current[idx];
    if (slot?.canvas) { try { slot.detachGuides?.(); slot.canvas.dispose(); } catch {} }
    stateRef.current.splice(idx, 1);
    setPages(next); onUpdatePages(next);
    setActiveIdx(Math.max(0, Math.min(activeIdx, next.length - 1)));
  }
  function duplicatePage(idx: number = activeIdx) {
    const slot = stateRef.current[idx];
    const payload = (slot?.canvas ? slot.canvas.toJSON() : pages[idx]?.payload) as ProjectRecord["pages"][number]["payload"];
    const next = pages.slice();
    next.splice(idx + 1, 0, { id: uid("page"), payload, thumb: pages[idx]?.thumb });
    // Insert a matching (empty) canvas slot so page↔canvas indices stay aligned;
    // it hydrates from `payload` when its <canvas> mounts.
    stateRef.current.splice(idx + 1, 0, { id: next[idx + 1].id, el: null, canvas: null, history: [], historyIdx: -1 });
    setPages(next); onUpdatePages(next);
    setActiveIdx(idx + 1);
  }
  function reorderPages(from: number, to: number) {
    if (from === to) return;
    const next = arrayMove(pages, from, to);
    // Keep the Fabric canvas slots aligned with their pages.
    stateRef.current = arrayMove(stateRef.current, from, to);
    setPages(next); onUpdatePages(next);
    setActiveIdx(to);
  }

  // ── selection updates ──
  function setOnSelected(patch: Record<string, unknown>) {
    const c = activeCanvas(); if (!c) return;
    const obj = c.getActiveObject(); if (!obj) return;
    obj.set(patch); obj.setCoords(); c.requestRenderAll(); tick();
  }

  // ── export ──
  async function runExport(format: "png" | "jpg" | "svg" | "pdf" | "zip") {
    await captureAllPages();
    const canvases = stateRef.current.map(s => s.canvas).filter(Boolean) as fabric.Canvas[];
    if (canvases.length === 0) { showToast("Nothing to export.", "info"); return; }
    try {
      if (format === "png") await exportFabricPNG({ canvases, title });
      else if (format === "jpg") await exportFabricJPG({ canvases, title });
      else if (format === "svg") await exportFabricSVG({ canvases, title });
      else if (format === "pdf") await exportFabricPDF({ canvases, title });
      else if (format === "zip") await exportFabricZip({ canvases, title }, "png");
      showToast("Exported." , "success");
    } catch (e) {
      showToast("Export failed: " + String(e).slice(0, 80), "error");
    }
    setExportOpen(false);
  }

  // ── version history ──
  const refreshSnapshots = useCallback(async () => {
    const fresh = await getProject(project.id);
    if (fresh) setSnapshots(fresh.snapshots || []);
  }, [project.id]);

  const takeSnapshotNow = useCallback(async () => {
    // Ensure the latest payload is persisted before snapshotting.
    await captureAllPages();
    await autosave.saveNow();
    const updated = await snapshotProject(project.id);
    if (updated) setSnapshots(updated.snapshots || []);
    showToast("Snapshot saved.", "success");
  }, [autosave, captureAllPages, project.id]);

  async function restoreSnapshot(snap: ProjectSnapshot) {
    const snapPages = (snap.payload as ProjectRecord["pages"]) || [];
    if (!Array.isArray(snapPages) || snapPages.length === 0) {
      showToast("Snapshot empty — nothing to restore.", "info");
      return;
    }
    // Resize stateRef to match snapshot length, disposing extras.
    while (stateRef.current.length > snapPages.length) {
      const last = stateRef.current.pop();
      if (last?.canvas) { try { last.detachGuides?.(); last.canvas.dispose(); } catch {} }
    }
    while (stateRef.current.length < snapPages.length) {
      stateRef.current.push({ id: snapPages[stateRef.current.length].id, el: null, canvas: null, history: [], historyIdx: -1 });
    }
    // Load JSON onto each existing canvas; pages without a bound canvas yet
    // (e.g. newly-added pages) will hydrate from `pages[i].payload` once bind
    // runs on mount.
    for (let i = 0; i < snapPages.length; i++) {
      const slot = stateRef.current[i];
      const payload = snapPages[i]?.payload;
      if (slot?.canvas && payload && typeof payload === "object") {
        try {
          await slot.canvas.loadFromJSON(payload as Record<string, unknown>);
          slot.canvas.renderAll();
          seedHistory(i);
        } catch {}
      }
    }
    setPages(snapPages);
    onUpdatePages(snapPages);
    setActiveIdx(0);
    setHistoryOpen(false);
    await autosave.saveNow();
    showToast("Snapshot restored.", "success");
  }

  // ── duplicate project ──
  async function duplicateProject() {
    // captureAllPages returns the freshly-serialized pages. Use that
    // directly — relying on project.pages (the parent's closure-captured
    // prop) would persist the pre-edit payloads if React hasn't committed
    // the setState the parent uses to mirror our pages yet.
    const nextPages = await captureAllPages();
    await autosave.saveNow();
    const dup = await saveProject({
      title: project.title + " · copy",
      kind: project.kind,
      pages: nextPages,
      category: project.category,
      preset: project.preset,
      templateId: project.templateId,
    });
    showToast("Project duplicated.", "success");
    router.push(`/design-studio/canvas-editor?id=${encodeURIComponent(dup.id)}`);
  }

  // ── keyboard shortcuts — composable bindings via useShortcuts ──
  // Route handlers through a ref so the bound closures always see the latest
  // state (tinykeys captures handlers at registration time).
  const shortcutsRef = useRef({
    undo, redo, duplicateActive, bringForward, sendBackward, groupActive, ungroupActive,
    saveNow: async () => { await autosave.saveNow(); await takeSnapshotNow(); },
    selectAll: () => {
      const c = activeCanvas(); if (!c) return;
      const objs = c.getObjects().filter(o => o.selectable !== false);
      if (objs.length === 0) return;
      const sel = new fabric.ActiveSelection(objs, { canvas: c });
      c.setActiveObject(sel);
      c.requestRenderAll();
    },
  });
  shortcutsRef.current.undo = undo;
  shortcutsRef.current.redo = redo;
  shortcutsRef.current.duplicateActive = duplicateActive;
  shortcutsRef.current.bringForward = bringForward;
  shortcutsRef.current.sendBackward = sendBackward;
  shortcutsRef.current.groupActive = groupActive;
  shortcutsRef.current.ungroupActive = ungroupActive;
  shortcutsRef.current.saveNow = async () => { await autosave.saveNow(); await takeSnapshotNow(); };
  // selectAll must also re-bind every render — it reads activeCanvas /
  // activeIdx via closure, and the initial useRef value snapshots the
  // first-render values, which would always target page 0 on multi-page.
  shortcutsRef.current.selectAll = () => {
    const c = activeCanvas(); if (!c) return;
    const objs = c.getObjects().filter(o => o.selectable !== false);
    if (objs.length === 0) return;
    const sel = new fabric.ActiveSelection(objs, { canvas: c });
    c.setActiveObject(sel);
    c.requestRenderAll();
  };

  useShortcuts({
    "$mod+z":        { description: "Undo",            handler: () => shortcutsRef.current.undo() },
    "$mod+Shift+z":  { description: "Redo",            handler: () => shortcutsRef.current.redo() },
    "$mod+y":        { description: "Redo",            handler: () => shortcutsRef.current.redo() },
    "$mod+d":        { description: "Duplicate object", handler: () => shortcutsRef.current.duplicateActive() },
    "$mod+]":        { description: "Bring forward",   handler: () => shortcutsRef.current.bringForward() },
    "$mod+[":        { description: "Send backward",   handler: () => shortcutsRef.current.sendBackward() },
    "$mod+g":        { description: "Group",           handler: () => shortcutsRef.current.groupActive() },
    "$mod+Shift+g":  { description: "Ungroup",         handler: () => shortcutsRef.current.ungroupActive() },
    "$mod+a":        { description: "Select all",      handler: () => shortcutsRef.current.selectAll() },
    "$mod+s":        { description: "Save snapshot",   handler: () => { void shortcutsRef.current.saveNow(); } },
  }, { scope: "DesignStudio Canvas" });

  // Arrow nudge + Delete/Backspace need direct access to live selection state
  // and don't compose well with tinykeys' string bindings — use a plain
  // window keydown listener with the same input-focus guard.
  useEffect(() => {
    function isEditableTarget(t: EventTarget | null): boolean {
      if (!t || !(t as HTMLElement).tagName) return false;
      const el = t as HTMLElement;
      const tag = el.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
      if (el.isContentEditable) return true;
      return false;
    }
    function isTextboxEditing(c: fabric.Canvas | null): boolean {
      const a = c?.getActiveObject();
      if (!a) return false;
      // Fabric Textbox / IText expose `isEditing` while user is typing inline.
      return Boolean((a as unknown as { isEditing?: boolean }).isEditing);
    }
    function onKey(e: KeyboardEvent) {
      if (isEditableTarget(e.target)) return;
      const c = activeCanvas();
      if (isTextboxEditing(c)) return;

      // Escape — deselect the active object.
      if (e.key === "Escape") {
        if (c && c.getActiveObject()) { c.discardActiveObject(); c.requestRenderAll(); setSelected(null); }
        return;
      }

      // Copy / Cut / Paste (canvas objects — guarded above so it never hijacks
      // native copy/paste inside inputs or while editing text inline).
      if (e.metaKey || e.ctrlKey) {
        const k = e.key.toLowerCase();
        if (k === "c") { if (c?.getActiveObject()) { e.preventDefault(); void copyActive(); } return; }
        if (k === "x") { if (c?.getActiveObject()) { e.preventDefault(); void cutActive(); } return; }
        if (k === "v") { if (clipboardRef.current) { e.preventDefault(); void pasteClipboard(); } return; }
      }

      // Delete / Backspace — only when an object is selected.
      if (e.key === "Delete" || e.key === "Backspace") {
        if (!c) return;
        const obj = c.getActiveObject();
        if (!obj) return;
        e.preventDefault();
        deleteActive();
        return;
      }

      // Arrow nudge (no modifier keys other than Shift).
      const arrows: Record<string, [number, number]> = {
        ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1],
      };
      const v = arrows[e.key];
      if (v && !e.metaKey && !e.ctrlKey && !e.altKey) {
        if (!c) return;
        const obj = c.getActiveObject();
        if (!obj) return;
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        obj.set({ left: (obj.left || 0) + v[0] * step, top: (obj.top || 0) + v[1] * step });
        obj.setCoords();
        c.requestRenderAll();
        tick();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIdx]);

  // Fit the page to the viewport on first mount (so it opens fully visible).
  useEffect(() => {
    const id = requestAnimationFrame(() => fitToScreen());
    return () => cancelAnimationFrame(id);
  }, [fitToScreen]);

  // Cmd/Ctrl + wheel to zoom (plain wheel still scrolls the viewport = pan).
  useEffect(() => {
    const el = mainRef.current; if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      e.preventDefault();
      const dir = e.deltaY > 0 ? -1 : 1;
      setZoom(z => Math.min(2, Math.max(0.1, Math.round((z + dir * 0.08) * 100) / 100)));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  // ── render ──
  return (
    <div ref={wrapperRef} style={{ display: "grid", gridTemplateRows: "56px 1fr " + (isMultiPage ? "120px" : "auto"), gridTemplateColumns: "240px 1fr 280px", height: "calc(100vh - 56px)", background: D.bg }}>
      {/* TOP BAR */}
      <div style={{ gridColumn: "1 / 4", display: "flex", alignItems: "center", padding: "0 14px", borderBottom: "1px solid " + D.border, background: "#0D0D12", gap: 6 }}>
        <input value={title} onChange={e => { setTitle(e.target.value); onUpdateTitle(e.target.value); }} placeholder="Untitled design" style={{
          background: "transparent", border: "1px solid transparent", padding: "4px 6px", borderRadius: 6,
          color: D.tx, fontFamily: gf, fontSize: 16, fontWeight: 800, letterSpacing: -0.2, outline: "none", minWidth: 160,
        }} onFocus={e => e.currentTarget.style.borderColor = D.border} onBlur={e => e.currentTarget.style.borderColor = "transparent"} />

        <span style={{ fontFamily: mn, fontSize: 10, color: D.txd, letterSpacing: 1.2, marginLeft: 6 }}>· {w}×{h}</span>
        <span style={{ fontFamily: mn, fontSize: 10, color: autosave.status === "error" ? D.coral : D.txd, marginLeft: 10 }}>{autosaveLabel}</span>

        <div style={{ width: 1, height: 22, background: D.border, margin: "0 6px" }} />

        <IconBtn onClick={undo} title="Undo" Icon={Undo2} />
        <IconBtn onClick={redo} title="Redo" Icon={Redo2} />

        <div style={{ width: 1, height: 22, background: D.border, margin: "0 6px" }} />

        <IconBtn onClick={() => align("left")} title="Align left" Icon={AlignStartHorizontal} />
        <IconBtn onClick={() => align("centerH")} title="Center horizontally" Icon={AlignCenterHorizontal} />
        <IconBtn onClick={() => align("right")} title="Align right" Icon={AlignEndHorizontal} />
        <IconBtn onClick={() => align("top")} title="Align top" Icon={AlignStartVertical} />
        <IconBtn onClick={() => align("centerV")} title="Center vertically" Icon={AlignCenterVertical} />
        <IconBtn onClick={() => align("bottom")} title="Align bottom" Icon={AlignEndVertical} />

        <div style={{ width: 1, height: 22, background: D.border, margin: "0 6px" }} />

        <IconBtn onClick={groupActive} title="Group (⌘G)" Icon={GroupIcon} />
        <IconBtn onClick={ungroupActive} title="Ungroup (⌘⇧G)" Icon={UngroupIcon} />
        <IconBtn onClick={() => distribute("h")} title="Distribute horizontally" Icon={AlignHorizontalDistributeCenter} />
        <IconBtn onClick={() => distribute("v")} title="Distribute vertically" Icon={AlignVerticalDistributeCenter} />

        <div style={{ width: 1, height: 22, background: D.border, margin: "0 6px" }} />

        <IconBtn onClick={bringForward} title="Forward" Icon={ChevronUp} />
        <IconBtn onClick={sendBackward} title="Backward" Icon={ChevronDown} />
        <IconBtn onClick={bringToFront} title="To front" Icon={ArrowUpToLine} />
        <IconBtn onClick={sendToBack} title="To back" Icon={ArrowDownToLine} />

        <div style={{ width: 1, height: 22, background: D.border, margin: "0 6px" }} />

        <IconBtn onClick={duplicateActive} title="Duplicate" Icon={CopyIcon} />
        <IconBtn onClick={deleteActive} title="Delete" Icon={Trash2} danger />

        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
          <IconBtn onClick={() => setZoom(z => Math.max(0.1, +(z - 0.1).toFixed(2)))} title="Zoom out" Icon={ZoomOut} />
          <span onClick={() => setZoom(1)} title="Reset to 100%" style={{ fontFamily: mn, fontSize: 10, color: D.txm, minWidth: 40, textAlign: "center", cursor: "pointer" }}>{Math.round(zoom * 100)}%</span>
          <IconBtn onClick={() => setZoom(z => Math.min(2, +(z + 0.1).toFixed(2)))} title="Zoom in" Icon={ZoomIn} />
          <button onClick={fitToScreen} title="Fit to screen" style={{ background: "transparent", border: "1px solid " + D.border, borderRadius: 5, padding: "3px 8px", cursor: "pointer", color: D.txm, fontFamily: mn, fontSize: 9, fontWeight: 700, letterSpacing: 0.5 }}>FIT</button>

          <button onClick={() => autosave.saveNow()} style={pillStyle(D.teal)}><Save size={11} /> Save</button>

          <div style={{ position: "relative" }}>
            <button onClick={() => { setHistoryOpen(o => !o); if (!historyOpen) void refreshSnapshots(); }} style={pillStyle(D.txm)}>
              <HistoryIcon size={11} /> History <ChevronDown size={11} />
            </button>
            {historyOpen && (
              <div style={{ position: "absolute", top: "100%", right: 0, marginTop: 6, background: "#0D0D12", border: "1px solid " + D.border, borderRadius: 8, padding: 8, minWidth: 260, maxHeight: 360, overflowY: "auto", zIndex: 20, boxShadow: "0 12px 28px rgba(0,0,0,0.5)" }}>
                <button onClick={() => { void takeSnapshotNow(); }} style={{
                  width: "100%", padding: "8px 10px", background: D.teal + "16", border: "1px solid " + D.teal + "44",
                  borderRadius: 6, color: D.teal, fontFamily: mn, fontSize: 10, fontWeight: 800, letterSpacing: 1,
                  cursor: "pointer", textTransform: "uppercase", marginBottom: 8, display: "inline-flex",
                  alignItems: "center", justifyContent: "center", gap: 6,
                }}><Save size={10} /> Snapshot now</button>
                {snapshots.length === 0 ? (
                  <div style={{ fontFamily: ft, fontSize: 12, color: D.txd, padding: "10px 4px", textAlign: "center" }}>No snapshots yet.</div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {snapshots.slice().reverse().map((s, i) => (
                      <div key={s.at + "-" + i} style={{
                        display: "flex", alignItems: "center", gap: 8, padding: "6px 8px",
                        background: "rgba(255,255,255,0.03)", border: "1px solid " + D.border, borderRadius: 6,
                      }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontFamily: mn, fontSize: 10, color: D.tx, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.title || "Untitled"}</div>
                          <div style={{ fontFamily: mn, fontSize: 9, color: D.txd, marginTop: 2 }}>{relTime(s.at)}</div>
                        </div>
                        <button onClick={() => { void restoreSnapshot(s); }} style={{
                          padding: "4px 8px", background: "transparent", border: "1px solid " + D.border, borderRadius: 4,
                          color: D.amber, fontFamily: mn, fontSize: 9, fontWeight: 800, letterSpacing: 0.8, cursor: "pointer", textTransform: "uppercase",
                        }}>Restore</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <button onClick={() => { void duplicateProject(); }} style={pillStyle(D.txm)} title="Duplicate project"><FilesIcon size={11} /> Duplicate</button>

          <div style={{ position: "relative" }}>
            <button onClick={() => setExportOpen(o => !o)} style={pillStyle(D.amber)}><Download size={11} /> Export</button>
            {exportOpen && (
              <div style={{ position: "absolute", top: "100%", right: 0, marginTop: 6, background: "#0D0D12", border: "1px solid " + D.border, borderRadius: 8, padding: 6, minWidth: 140, zIndex: 20, boxShadow: "0 12px 28px rgba(0,0,0,0.5)" }}>
                {(["png", "jpg", "svg", "pdf", "zip"] as const).map(f => (
                  <button key={f} onClick={() => runExport(f)} style={{
                    width: "100%", textAlign: "left", padding: "8px 10px", background: "transparent", border: "none",
                    color: D.tx, fontFamily: mn, fontSize: 11, cursor: "pointer", borderRadius: 6,
                  }}>.{f}</button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* LEFT PANEL */}
      <aside style={{ background: "#0D0D12", borderRight: "1px solid " + D.border, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", padding: 6, gap: 4, borderBottom: "1px solid " + D.border }}>
          {(["templates", "elements", "text", "uploads", "brand"] as const).map(t => (
            <button key={t} onClick={() => setLeftTab(t)} style={{
              flex: 1, padding: "6px 4px", borderRadius: 5,
              background: leftTab === t ? D.amber + "1F" : "transparent",
              border: "1px solid " + (leftTab === t ? D.amber + "55" : "transparent"),
              color: leftTab === t ? D.amber : D.txm,
              fontFamily: mn, fontSize: 9, fontWeight: 800, letterSpacing: 0.6, textTransform: "uppercase", cursor: "pointer",
            }}>{t.slice(0, 5)}</button>
          ))}
        </div>
        <div style={{ flex: 1, overflow: "auto", padding: 12 }}>
          {leftTab === "templates" && <TemplatesTab cat={project.category} onPick={loadTemplate} />}
          {leftTab === "elements" && <ElementsTab onPick={addShape} />}
          {leftTab === "text" && <TextTab onPick={addText} />}
          {leftTab === "uploads" && <UploadsTab onUpload={addImageFromFile} />}
          {leftTab === "brand" && <BrandTab onLogo={addLogo} onColor={(hex) => setOnSelected({ fill: hex })} />}
        </div>
      </aside>

      {/* CENTER — solid neutral workspace (not a transparent checkerboard); the
          page floats on it as a shadowed artboard, like a typical canvas app. */}
      <main ref={mainRef} style={{ display: "flex", alignItems: "center", justifyContent: "center", overflow: "auto", background: "#E7E7EC" }}>
        <div style={{ position: "relative" }}>
          {pages.map((p, i) => (
            // The wrapper is sized to the SCALED footprint (w*zoom × h*zoom) so
            // the flex centering + overflow measure the on-screen size — a bare
            // `transform: scale()` leaves the layout box at full 1080×1350 and
            // clips the page when the viewport is narrower than that.
            <div
              key={p.id}
              style={{
                display: i === activeIdx ? "block" : "none",
                width: w * zoom,
                height: h * zoom,
                margin: 40,
                flexShrink: 0,
                boxShadow: "0 12px 40px rgba(0,0,0,0.28)",
                borderRadius: 2,
                overflow: "hidden",
              }}
            >
              <canvas ref={(el) => bindCanvas(i, el)} width={w} height={h} style={{ transform: "scale(" + zoom + ")", transformOrigin: "top left", display: "block" }} />
            </div>
          ))}
        </div>
      </main>

      {/* RIGHT PANEL */}
      <aside style={{ background: "#0D0D12", borderLeft: "1px solid " + D.border, overflow: "auto" }}>
        {selected ? (
          <PropertiesPanel obj={selected} onPatch={setOnSelected} onReplaceImage={replaceSelectedImage} onImageFit={fitSelectedImage} />
        ) : (
          <LayersPanel canvas={activeCanvas()} onChange={() => tick()} />
        )}
      </aside>

      {/* PAGES STRIP */}
      {isMultiPage && (
        <div style={{ gridColumn: "1 / 4", display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderTop: "1px solid " + D.border, background: "#08080D", overflowX: "auto" }}>
          {pages.map((p, i) => {
            const ctl: React.CSSProperties = { fontFamily: mn, fontSize: 11, lineHeight: 1, color: "#000", background: "rgba(255,255,255,0.92)", borderRadius: 3, padding: "1px 4px", cursor: "pointer", userSelect: "none" };
            return (
              <div key={p.id} style={{ position: "relative", flexShrink: 0 }}>
                <button onClick={() => setActiveIdx(i)} style={{
                  padding: 0, background: "transparent", border: "2px solid " + (activeIdx === i ? D.amber : D.border),
                  borderRadius: 6, cursor: "pointer", position: "relative", display: "block",
                }}>
                  {p.thumb ? <img src={p.thumb} alt="" style={{ display: "block", width: 80, height: 80, objectFit: "contain", background: "#fff", borderRadius: 4 }} /> : <div style={{ width: 80, height: 80, background: "#fff", borderRadius: 4 }} />}
                  <span style={{ position: "absolute", top: 4, left: 6, fontFamily: mn, fontSize: 9, color: "#000", background: "rgba(255,255,255,0.9)", padding: "0 4px", borderRadius: 3 }}>{i + 1}</span>
                </button>
                <div style={{ position: "absolute", bottom: 3, left: 0, right: 0, display: "flex", justifyContent: "center", gap: 3 }}>
                  <span title="Move left" onClick={(e) => { e.stopPropagation(); if (i > 0) reorderPages(i, i - 1); }} style={Object.assign({}, ctl, { opacity: i === 0 ? 0.35 : 1 })}>◀</span>
                  <span title="Duplicate page" onClick={(e) => { e.stopPropagation(); duplicatePage(i); }} style={ctl}>⧉</span>
                  <span title="Move right" onClick={(e) => { e.stopPropagation(); if (i < pages.length - 1) reorderPages(i, i + 1); }} style={Object.assign({}, ctl, { opacity: i === pages.length - 1 ? 0.35 : 1 })}>▶</span>
                </div>
                {pages.length > 1 && <span onClick={(e) => { e.stopPropagation(); removePage(i); }} style={{ position: "absolute", top: 2, right: 2, fontFamily: mn, fontSize: 12, color: D.coral, cursor: "pointer", background: "rgba(13,13,18,0.9)", borderRadius: 4, padding: "0 4px" }}>×</span>}
              </div>
            );
          })}
          <button onClick={() => addPage()} style={{
            padding: 10, background: D.amber + "1F", border: "1px solid " + D.amber + "55", borderRadius: 6,
            color: D.amber, cursor: "pointer", fontFamily: mn, fontSize: 10, fontWeight: 800, letterSpacing: 1.2, textTransform: "uppercase",
            display: "inline-flex", alignItems: "center", gap: 5,
          }}><Plus size={12} /> Add page</button>
          <button onClick={() => duplicatePage()} title="Duplicate current page" style={{
            padding: 10, background: "transparent", border: "1px solid " + D.border, borderRadius: 6,
            color: D.txm, cursor: "pointer", fontFamily: mn, fontSize: 10, fontWeight: 800, letterSpacing: 1.2, textTransform: "uppercase",
            display: "inline-flex", alignItems: "center", gap: 5,
          }}><CopyIcon size={12} /> Dupe</button>
        </div>
      )}
    </div>
  );
}

// ─── Small UI helpers ──────────────────────────────────────────────
function IconBtn({ onClick, title, Icon, danger }: { onClick: () => void; title: string; Icon: typeof Undo2; danger?: boolean }) {
  return (
    <button onClick={onClick} title={title} style={{
      background: "transparent", border: "none", borderRadius: 5, padding: 6, cursor: "pointer",
      color: danger ? D.coral : D.txm, display: "inline-flex",
    }} onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.05)"} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
      <Icon size={13} strokeWidth={1.8} />
    </button>
  );
}

function pillStyle(accent: string): React.CSSProperties {
  return {
    display: "inline-flex", alignItems: "center", gap: 5, padding: "6px 10px", borderRadius: 6,
    background: accent + "16", border: "1px solid " + accent + "44", color: accent,
    fontFamily: mn, fontSize: 10, fontWeight: 800, letterSpacing: 1, cursor: "pointer", textTransform: "uppercase",
  };
}

function PanelHeader({ children }: { children: React.ReactNode }) {
  return <div style={{ fontFamily: mn, fontSize: 9, color: D.txd, letterSpacing: 1.6, textTransform: "uppercase", marginBottom: 8 }}>{children}</div>;
}

// ─── Left-panel tabs ───────────────────────────────────────────────
// Thumbnail cache shared across all TemplatesTab mounts. Each entry is a
// dataURL rendered by a headless StaticCanvas at low resolution. Persisting
// back to the templates module isn't possible at runtime, so we keep it in
// memory — cheap and re-generated on hard reload.
const TEMPLATE_THUMB_CACHE = new Map<string, string>();

async function renderTemplateThumb(t: DesignTemplate): Promise<string> {
  const cached = TEMPLATE_THUMB_CACHE.get(t.id);
  if (cached) return cached;
  // Build a detached <canvas> so the StaticCanvas has something to bind to.
  const el = document.createElement("canvas");
  el.width = t.preset.width;
  el.height = t.preset.height;
  const sc = new fabric.StaticCanvas(el, {
    width: t.preset.width,
    height: t.preset.height,
    backgroundColor: "#FFFFFF",
  });
  try {
    await sc.loadFromJSON(t.payload as unknown as Record<string, unknown>);
    sc.renderAll();
    // 160px on the long edge is enough for the 2-col grid; that maps to
    // multiplier 160 / longEdge. Capped low so this stays cheap.
    const longEdge = Math.max(t.preset.width, t.preset.height);
    const multiplier = Math.min(0.25, 160 / longEdge);
    const dataURL = sc.toDataURL({ format: "png", multiplier });
    TEMPLATE_THUMB_CACHE.set(t.id, dataURL);
    return dataURL;
  } finally {
    try { sc.dispose(); } catch {}
  }
}

function TemplateThumb({ t }: { t: DesignTemplate }) {
  const [src, setSrc] = useState<string | null>(() => TEMPLATE_THUMB_CACHE.get(t.id) || (t.thumb || null));
  useEffect(() => {
    if (src) return;
    let cancelled = false;
    renderTemplateThumb(t).then((url) => { if (!cancelled) setSrc(url); }).catch(() => {});
    return () => { cancelled = true; };
  }, [t, src]);
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={t.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />;
  }
  return <span style={{ fontFamily: mn, fontSize: 9, color: D.txd, padding: 6, textAlign: "center" }}>{t.title}</span>;
}

function TemplatesTab({ cat, onPick }: { cat?: string; onPick: (t: DesignTemplate) => void }) {
  const list = cat ? templatesByCategory(cat) : TEMPLATES.slice(0, 12);
  return (
    <div>
      <PanelHeader>Templates {cat ? "· " + cat : ""}</PanelHeader>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
        {list.length === 0 && <div style={{ gridColumn: "1 / 3", fontFamily: ft, fontSize: 12, color: D.txd }}>No templates for this category yet.</div>}
        {list.map(t => (
          <button key={t.id} onClick={() => onPick(t)} title={t.title} style={{
            aspectRatio: String(t.preset.width / t.preset.height),
            background: "#1a1a23", border: "1px solid " + D.border, borderRadius: 6, padding: 0, overflow: "hidden", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <TemplateThumb t={t} />
          </button>
        ))}
      </div>
    </div>
  );
}

function ElementsTab({ onPick }: { onPick: (id: string) => void }) {
  return (
    <div>
      <PanelHeader>Shapes</PanelHeader>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
        {SHAPE_PRESETS.map(s => (
          <button key={s.id} onClick={() => onPick(s.id)} style={{
            padding: "14px 6px", background: "rgba(255,255,255,0.04)", border: "1px solid " + D.border, borderRadius: 6,
            color: D.tx, fontFamily: mn, fontSize: 10, fontWeight: 700, letterSpacing: 0.8, cursor: "pointer",
            display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
          }}><s.Icon size={20} strokeWidth={1.6} color={D.amber} />{s.label}</button>
        ))}
      </div>
    </div>
  );
}

function TextTab({ onPick }: { onPick: (preset: typeof TEXT_PRESETS[number]) => void }) {
  return (
    <div>
      <PanelHeader>Type presets</PanelHeader>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {TEXT_PRESETS.map(p => (
          <button key={p.id} onClick={() => onPick(p)} style={{
            padding: "12px 12px", background: "rgba(255,255,255,0.04)", border: "1px solid " + D.border, borderRadius: 6,
            color: D.tx, cursor: "pointer", textAlign: "left",
            fontFamily: p.fontFamily, fontSize: Math.min(p.fontSize * 0.4, 22), fontWeight: p.fontWeight,
          }}>{p.label}</button>
        ))}
      </div>
    </div>
  );
}

function UploadsTab({ onUpload }: { onUpload: (f: File) => void }) {
  return (
    <div>
      <PanelHeader>Uploads</PanelHeader>
      <label style={{
        display: "block", padding: "20px 12px", background: "rgba(255,255,255,0.03)", border: "1px dashed " + D.border, borderRadius: 8,
        color: D.txm, textAlign: "center", cursor: "pointer", fontFamily: mn, fontSize: 10, letterSpacing: 0.8,
      }}>
        <ImageIcon size={18} color={D.amber} strokeWidth={1.6} style={{ marginBottom: 6 }} />
        <div>Drop or click to upload</div>
        <input type="file" accept="image/*" style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; if (f) onUpload(f); }} />
      </label>
    </div>
  );
}

function BrandTab({ onLogo, onColor }: { onLogo: (src: string) => void; onColor: (hex: string) => void }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div>
        <PanelHeader>Logos</PanelHeader>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
          {SA_LOGOS.map(l => (
            <button key={l.src} onClick={() => onLogo(l.src)} title={l.label} style={{
              padding: 8, background: "#1a1a23", border: "1px solid " + D.border, borderRadius: 6, cursor: "pointer",
            }}>
              <img src={l.src} alt={l.label} style={{ width: "100%", height: 50, objectFit: "contain" }} />
            </button>
          ))}
        </div>
      </div>
      <div>
        <PanelHeader>Palette</PanelHeader>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 6 }}>
          {BRAND_PALETTE.map(hex => (
            <button key={hex} onClick={() => onColor(hex)} title={hex} style={{
              aspectRatio: "1", background: hex, border: "1px solid " + D.border, borderRadius: 6, cursor: "pointer",
            }} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Right-panel: properties / layers ──────────────────────────────
function PropertiesPanel({ obj, onPatch, onReplaceImage, onImageFit }: {
  obj: fabric.Object;
  onPatch: (p: Record<string, unknown>) => void;
  onReplaceImage?: (file: File) => void;
  onImageFit?: (mode: "contain" | "cover") => void;
}) {
  const isText = obj.type === "textbox" || obj.type === "i-text" || obj.type === "text";
  const isImage = obj.type === "image";
  const isRect = obj.type === "rect";
  const t = obj as fabric.Textbox;
  const mini = (active: boolean): React.CSSProperties => ({
    width: 32, height: 28, borderRadius: 5, cursor: "pointer",
    background: active ? D.amber + "22" : "transparent",
    border: "1px solid " + (active ? D.amber + "88" : D.border),
    color: active ? D.amber : D.txm, fontFamily: mn, fontSize: 13, fontWeight: 800,
  });
  return (
    <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 12 }}>
      <PanelHeader>Selection · {obj.type}</PanelHeader>

      <Field label="Fill">
        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
          <input type="color" value={normaliseColor(obj.fill as string)} onChange={e => onPatch({ fill: e.target.value })} style={{ width: 32, height: 28, padding: 0, border: "1px solid " + D.border, borderRadius: 4, background: "transparent", cursor: "pointer" }} />
          <input value={String(obj.fill || "")} onChange={e => onPatch({ fill: e.target.value })} style={inputStyle()} />
        </div>
      </Field>

      <Field label="Stroke">
        <div style={{ display: "flex", gap: 4 }}>
          <input type="color" value={normaliseColor(obj.stroke as string || "#000000")} onChange={e => onPatch({ stroke: e.target.value })} style={{ width: 32, height: 28, padding: 0, border: "1px solid " + D.border, borderRadius: 4, background: "transparent", cursor: "pointer" }} />
          <input type="number" min={0} value={obj.strokeWidth || 0} onChange={e => onPatch({ strokeWidth: Number(e.target.value) })} style={Object.assign({}, inputStyle(), { width: 70 })} />
        </div>
      </Field>

      <Field label="Opacity">
        <input type="range" min={0} max={1} step={0.05} value={obj.opacity ?? 1} onChange={e => onPatch({ opacity: Number(e.target.value) })} style={{ width: "100%" }} />
      </Field>

      {!isText && (
        <Field label="Size (W × H)">
          <div style={{ display: "flex", gap: 6 }}>
            <input type="number" value={Math.round(obj.getScaledWidth())} onChange={e => { const v = Number(e.target.value); if (v > 0 && obj.width) onPatch({ scaleX: v / obj.width }); }} style={inputStyle()} />
            <input type="number" value={Math.round(obj.getScaledHeight())} onChange={e => { const v = Number(e.target.value); if (v > 0 && obj.height) onPatch({ scaleY: v / obj.height }); }} style={inputStyle()} />
          </div>
        </Field>
      )}

      <Field label="Rotate / Flip">
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <input type="number" value={Math.round(obj.angle || 0)} onChange={e => onPatch({ angle: Number(e.target.value) })} style={Object.assign({}, inputStyle(), { width: 74 })} />
          <button onClick={() => onPatch({ flipX: !obj.flipX })} title="Flip horizontal" style={mini(!!obj.flipX)}>⇋</button>
          <button onClick={() => onPatch({ flipY: !obj.flipY })} title="Flip vertical" style={mini(!!obj.flipY)}>⇅</button>
        </div>
      </Field>

      {isRect && (
        <Field label="Corner radius">
          <input type="number" min={0} value={Math.round((obj as fabric.Rect).rx || 0)} onChange={e => { const v = Number(e.target.value); onPatch({ rx: v, ry: v }); }} style={inputStyle()} />
        </Field>
      )}

      {isText && (
        <>
          <Field label="Font">
            <select value={t.fontFamily} onChange={e => onPatch({ fontFamily: e.target.value })} style={inputStyle()}>
              <option value="Grift,Outfit,sans-serif">Grift / Outfit</option>
              <option value="Arial, Helvetica, sans-serif">Arial</option>
              <option value="Georgia, serif">Georgia</option>
              <option value="JetBrains Mono, monospace">JetBrains Mono</option>
            </select>
          </Field>
          <Field label="Size">
            <input type="number" min={6} value={t.fontSize} onChange={e => onPatch({ fontSize: Number(e.target.value) })} style={inputStyle()} />
          </Field>
          <Field label="Weight">
            <select value={String(t.fontWeight)} onChange={e => onPatch({ fontWeight: Number(e.target.value) || e.target.value })} style={inputStyle()}>
              <option value="400">Regular 400</option>
              <option value="600">Semibold 600</option>
              <option value="700">Bold 700</option>
              <option value="900">Black 900</option>
            </select>
          </Field>
          <Field label="Align">
            <select value={t.textAlign} onChange={e => onPatch({ textAlign: e.target.value })} style={inputStyle()}>
              <option value="left">Left</option><option value="center">Center</option><option value="right">Right</option><option value="justify">Justify</option>
            </select>
          </Field>
          <Field label="Line height">
            <input type="number" step={0.05} min={0.5} max={3} value={t.lineHeight ?? 1.16} onChange={e => onPatch({ lineHeight: Number(e.target.value) })} style={inputStyle()} />
          </Field>
          <Field label="Letter spacing">
            <input type="number" step={10} value={t.charSpacing || 0} onChange={e => onPatch({ charSpacing: Number(e.target.value) })} style={inputStyle()} />
          </Field>
          <Field label="Style">
            <div style={{ display: "flex", gap: 6 }}>
              <button onClick={() => onPatch({ fontWeight: Number(t.fontWeight) >= 700 ? 400 : 700 })} title="Bold" style={Object.assign({}, mini(Number(t.fontWeight) >= 700), { fontWeight: 900 })}>B</button>
              <button onClick={() => onPatch({ fontStyle: t.fontStyle === "italic" ? "normal" : "italic" })} title="Italic" style={Object.assign({}, mini(t.fontStyle === "italic"), { fontStyle: "italic" as const })}>I</button>
              <button onClick={() => onPatch({ underline: !t.underline })} title="Underline" style={Object.assign({}, mini(!!t.underline), { textDecoration: "underline" })}>U</button>
            </div>
          </Field>
        </>
      )}

      {isImage && (
        <>
          <Field label="Image">
            <label style={{ display: "block", padding: "8px 10px", textAlign: "center", background: "rgba(255,255,255,0.03)", border: "1px solid " + D.border, borderRadius: 6, color: D.txm, cursor: "pointer", fontFamily: mn, fontSize: 10, letterSpacing: 0.6 }}>
              Replace image
              <input type="file" accept="image/*" style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; if (f) onReplaceImage?.(f); }} />
            </label>
          </Field>
          <Field label="Fit to page">
            <div style={{ display: "flex", gap: 6 }}>
              <button onClick={() => onImageFit?.("contain")} style={Object.assign({}, mini(false), { width: "auto", flex: 1, padding: "0 8px" })}>Fit</button>
              <button onClick={() => onImageFit?.("cover")} style={Object.assign({}, mini(false), { width: "auto", flex: 1, padding: "0 8px" })}>Fill</button>
            </div>
          </Field>
        </>
      )}

      <Field label="Position">
        <div style={{ display: "flex", gap: 6 }}>
          <input type="number" value={Math.round(obj.left || 0)} onChange={e => onPatch({ left: Number(e.target.value) })} style={inputStyle()} />
          <input type="number" value={Math.round(obj.top || 0)} onChange={e => onPatch({ top: Number(e.target.value) })} style={inputStyle()} />
        </div>
      </Field>
    </div>
  );
}

function LayersPanel({ canvas, onChange }: { canvas: fabric.Canvas | null; onChange: () => void }) {
  const sensors = useSensors(useSensor(PointerSensor));
  const objects = canvas?.getObjects() || [];
  // Reverse so top-most renders at the top of the list.
  const items = objects.slice().reverse().map((o, idx) => ({ id: idx, obj: o }));

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!canvas || !over || active.id === over.id) return;
    const from = items.findIndex(i => i.id === active.id);
    const to = items.findIndex(i => i.id === over.id);
    const reordered = arrayMove(items, from, to);
    // Apply: removeAll, then re-add in reversed order.
    canvas.remove(...canvas.getObjects());
    reordered.slice().reverse().forEach(it => canvas.add(it.obj));
    canvas.requestRenderAll(); onChange();
  }

  return (
    <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
      <PanelHeader>Layers</PanelHeader>
      {items.length === 0 && <div style={{ fontFamily: ft, fontSize: 12, color: D.txd }}>No objects on this page yet.</div>}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={items.map(i => i.id)} strategy={verticalListSortingStrategy}>
          {items.map((it) => (
            <LayerRow key={it.id} id={it.id} obj={it.obj} canvas={canvas!} onChange={onChange} />
          ))}
        </SortableContext>
      </DndContext>
    </div>
  );
}

function LayerRow({ id, obj, canvas, onChange }: { id: number; obj: fabric.Object; canvas: fabric.Canvas; onChange: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const visible = (obj.opacity ?? 1) > 0;
  const locked = obj.selectable === false;
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform), transition,
    display: "flex", alignItems: "center", gap: 6,
    padding: "6px 8px", background: "rgba(255,255,255,0.03)", border: "1px solid " + D.border, borderRadius: 6,
    opacity: isDragging ? 0.6 : 1, cursor: "default",
  };
  return (
    <div ref={setNodeRef} data-layer-row style={style}>
      <button {...attributes} {...listeners} title="Drag" style={{ background: "transparent", border: "none", color: D.txd, cursor: "grab", display: "inline-flex", padding: 0 }}>
        <GripVertical size={11} strokeWidth={1.6} />
      </button>
      <button onClick={() => { canvas.setActiveObject(obj); canvas.requestRenderAll(); onChange(); }} style={{
        flex: 1, background: "transparent", border: "none", color: D.tx, cursor: "pointer", textAlign: "left",
        fontFamily: mn, fontSize: 10, letterSpacing: 0.4,
      }}>{labelFor(obj)}</button>
      <button onClick={() => { obj.set({ opacity: visible ? 0 : 1 }); canvas.requestRenderAll(); onChange(); }} title={visible ? "Hide" : "Show"} style={{ background: "transparent", border: "none", color: D.txd, cursor: "pointer", display: "inline-flex" }}>
        {visible ? <Eye size={11} /> : <EyeOff size={11} />}
      </button>
      <button onClick={() => { obj.set({ selectable: !locked, evented: !locked }); canvas.requestRenderAll(); onChange(); }} title={locked ? "Unlock" : "Lock"} style={{ background: "transparent", border: "none", color: D.txd, cursor: "pointer", display: "inline-flex" }}>
        {locked ? <Lock size={11} /> : <Unlock size={11} />}
      </button>
    </div>
  );
}

function labelFor(obj: fabric.Object): string {
  if (obj.type === "textbox" || obj.type === "i-text" || obj.type === "text") {
    const t = obj as fabric.Textbox;
    return "T · " + (t.text || "Empty").slice(0, 18);
  }
  if (obj.type === "image") return "Image";
  if (obj.type === "rect") return "Rect";
  if (obj.type === "circle") return "Circle";
  if (obj.type === "triangle") return "Triangle";
  if (obj.type === "line") return "Line";
  if (obj.type === "polygon") return "Polygon";
  return obj.type || "Object";
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontFamily: mn, fontSize: 9, color: D.txd, letterSpacing: 1.4, textTransform: "uppercase", marginBottom: 4 }}>{label}</div>
      {children}
    </div>
  );
}

function inputStyle(): React.CSSProperties {
  return {
    width: "100%", padding: "5px 8px", background: "rgba(255,255,255,0.03)", border: "1px solid " + D.border, borderRadius: 5,
    color: D.tx, fontFamily: mn, fontSize: 11, outline: "none", boxSizing: "border-box",
  };
}

function normaliseColor(c: string | undefined): string {
  if (!c) return "#000000";
  if (c.startsWith("#") && (c.length === 7 || c.length === 4)) return c;
  return "#000000";
}

function relTime(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 5) return "just now";
  if (diff < 60) return diff + "s ago";
  if (diff < 3600) return Math.floor(diff / 60) + "m ago";
  return Math.floor(diff / 3600) + "h ago";
}
