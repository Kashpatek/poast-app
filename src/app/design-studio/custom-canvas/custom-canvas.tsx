"use client";

// DesignStudio · Custom canvas (Excalidraw).
// Free-form sketch artboard for kind="excalidraw" projects. Persists into
// the unified design-studio projects-store under pages[0].payload =
// { elements, appState } — sketches share the same table as Fabric
// canvases and Tiptap docs so the landing page lists them side-by-side.
//
// Patterned after canvas-editor/design-canvas.tsx and doc-editor.tsx for
// the autosave / top-bar / export-menu shape.

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Download, Save, FileJson, Image as ImageIcon } from "lucide-react";
import {
  Excalidraw,
  exportToBlob,
  serializeAsJSON,
} from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";
import type {
  ExcalidrawImperativeAPI,
  AppState,
  BinaryFiles,
  ExcalidrawInitialDataState,
} from "@excalidraw/excalidraw/types";
import type { OrderedExcalidrawElement, ExcalidrawElement, NonDeleted } from "@excalidraw/excalidraw/element/types";
import { D, ft, gf, mn, uid } from "../../shared-constants";
import { saveProject, snapshotProject, useAutosave, type ProjectRecord } from "../projects-store";
import { showToast } from "../../toast-context";

// DESIGN accent — the green called out in the brief.
const DESIGN_ACCENT = "#2EAD8E";
const DESIGN_GLOW = "rgba(46,173,142,0.16)";

// The Excalidraw component itself is referenced via a stable wrapper — we
// pull the named export above so the type comes through cleanly. (The
// page.tsx ssr:false dynamic import keeps this entire module client-side.)
const ExcalidrawComponent: typeof Excalidraw = Excalidraw;
// Quiet the unused-import warning if dynamic is ever reused below.
void dynamic;

interface ScenePayload {
  elements: readonly OrderedExcalidrawElement[];
  appState: Partial<AppState>;
  files?: BinaryFiles;
}

interface Props {
  project: ProjectRecord;
  onUpdatePages: (pages: ProjectRecord["pages"]) => void;
  onUpdateTitle: (title: string) => void;
}

export function CustomCanvas({ project, onUpdatePages, onUpdateTitle }: Props) {
  const initialPayload = (project.pages?.[0]?.payload as ScenePayload | null) || null;
  const [title, setTitle] = useState<string>(project.title || "Untitled sketch");
  const [exportOpen, setExportOpen] = useState(false);

  // Latest scene buffered between autosaves. Excalidraw fires onChange on
  // every pointer-move while editing — we don't want to thrash the store,
  // so we stash the freshest payload in a ref and let useAutosave debounce
  // the write at ~1s. The `version` counter is what actually triggers
  // useAutosave's dep-driven flush.
  const sceneRef = useRef<ScenePayload | null>(initialPayload);
  const [sceneVersion, setSceneVersion] = useState(0);
  const apiRef = useRef<ExcalidrawImperativeAPI | null>(null);

  // Excalidraw v0.18 needs a wrapping div with explicit dimensions or it
  // will refuse to render — we give it the available viewport minus the
  // top bar (56px DocuShell header) and our local top bar.
  const TOP_BAR_HEIGHT = 56; // local top bar inside this component

  const initialData: ExcalidrawInitialDataState | null = useMemo(() => {
    if (!initialPayload) return null;
    return {
      elements: (initialPayload.elements as unknown as readonly NonDeleted<ExcalidrawElement>[]) || [],
      appState: {
        ...(initialPayload.appState || {}),
        // Force dark theme regardless of what was persisted — POAST is dark-only.
        theme: "dark",
        // Drop collab artifacts that don't survive deserialization cleanly.
        collaborators: new Map(),
      },
      files: initialPayload.files || {},
      scrollToContent: true,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Autosave ───────────────────────────────────────────────────
  const save = useCallback(async () => {
    const pageId = project.pages?.[0]?.id || uid("page");
    const payload = sceneRef.current;
    const nextPages: ProjectRecord["pages"] = [{
      id: pageId,
      payload: payload
        ? { elements: payload.elements, appState: stripVolatileAppState(payload.appState), files: payload.files }
        : null,
    }];
    await saveProject({
      id: project.id,
      title,
      kind: "excalidraw",
      category: project.category,
      preset: project.preset,
      pages: nextPages,
      templateId: project.templateId,
      meta: project.meta,
    });
    onUpdatePages(nextPages);
    onUpdateTitle(title);
  }, [project.id, project.pages, project.category, project.preset, project.templateId, project.meta, title, onUpdatePages, onUpdateTitle]);

  const autosave = useAutosave(save, [title, sceneVersion], 1000);

  // ── Excalidraw onChange — buffer scene, bump version ───────────
  const onChange = useCallback((
    elements: readonly OrderedExcalidrawElement[],
    appState: AppState,
    files: BinaryFiles,
  ) => {
    sceneRef.current = { elements, appState, files };
    setSceneVersion(v => v + 1);
  }, []);

  // ── Export menu ────────────────────────────────────────────────
  async function doExportPng() {
    const payload = sceneRef.current;
    if (!payload) {
      showToast("Draw something first.", "info");
      return;
    }
    try {
      const blob = await exportToBlob({
        elements: payload.elements as unknown as readonly NonDeleted<ExcalidrawElement>[],
        appState: { ...payload.appState, exportBackground: true, exportWithDarkMode: true },
        files: payload.files || null,
        mimeType: "image/png",
        quality: 1,
      });
      downloadBlob(blob, `${title || "sketch"}.png`);
      showToast("Exported PNG.", "success");
    } catch (e) {
      showToast("Export failed: " + String(e).slice(0, 80), "error");
    }
  }

  function doExportJson() {
    const payload = sceneRef.current;
    if (!payload) {
      showToast("Draw something first.", "info");
      return;
    }
    try {
      const json = serializeAsJSON(
        payload.elements as unknown as readonly NonDeleted<ExcalidrawElement>[],
        payload.appState as AppState,
        payload.files || {},
        "local",
      );
      const blob = new Blob([json], { type: "application/json" });
      downloadBlob(blob, `${title || "sketch"}.excalidraw`);
      showToast("Exported .excalidraw JSON.", "success");
    } catch (e) {
      showToast("Export failed: " + String(e).slice(0, 80), "error");
    }
  }

  async function takeSnapshot() {
    await autosave.saveNow();
    await snapshotProject(project.id);
    showToast("Snapshot saved.", "success");
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 56px)" }}>
      {/* Top bar */}
      <div style={topBar}>
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Untitled sketch"
          style={titleInput}
        />
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginLeft: "auto" }}>
          <span style={autosaveLabelStyle}>
            {autosaveLabel(autosave.status, autosave.lastSavedAt)}
          </span>
          <button type="button" onClick={takeSnapshot} style={pillStyle(D.amber)} title="Snapshot version">
            <Save size={12} strokeWidth={2} /> Snapshot
          </button>
          <div style={{ position: "relative" }}>
            <button type="button" onClick={() => setExportOpen(o => !o)} style={pillStyle(D.violet)} title="Export">
              <Download size={12} strokeWidth={2} /> Export
            </button>
            {exportOpen ? (
              <div style={exportMenu}>
                <button
                  type="button"
                  onClick={() => { setExportOpen(false); void doExportPng(); }}
                  style={exportMenuItem}
                >
                  <ImageIcon size={11} strokeWidth={1.8} color={D.txd} /> .png
                </button>
                <button
                  type="button"
                  onClick={() => { setExportOpen(false); doExportJson(); }}
                  style={exportMenuItem}
                >
                  <FileJson size={11} strokeWidth={1.8} color={D.txd} /> .excalidraw
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* Excalidraw — needs an explicit-dimension wrapper in v0.18. */}
      <div style={{
        flex: 1,
        minHeight: 0,
        position: "relative",
        background: D.bg,
        borderTop: "1px solid " + D.border,
        boxShadow: "inset 0 0 80px " + DESIGN_GLOW,
      }}>
        <div style={{ position: "absolute", inset: 0 }}>
          <ExcalidrawComponent
            initialData={initialData}
            onChange={onChange}
            excalidrawAPI={(api) => { apiRef.current = api; }}
            theme="dark"
            name={title}
            UIOptions={{
              canvasActions: {
                changeViewBackgroundColor: true,
                clearCanvas: true,
                export: false,           // we handle export ourselves
                loadScene: false,
                saveToActiveFile: false,
                saveAsImage: false,
                toggleTheme: false,      // POAST is dark-only
              },
            }}
            // Hide the live collaboration affordance — POAST is single-user.
            isCollaborating={false}
            renderTopRightUI={() => null}
            autoFocus
          />
        </div>
      </div>
    </div>
  );

  // Keep both branches reachable lint-wise.
  void TOP_BAR_HEIGHT;
}

// ─── Helpers ─────────────────────────────────────────────────────
function autosaveLabel(status: "idle" | "saving" | "saved" | "error", at: number | null): string {
  if (status === "saving") return "Saving…";
  if (status === "error") return "Save failed";
  if (status === "saved" && at) {
    return "Saved " + new Date(at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  return "Autosave on";
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

// Drop fields that don't make sense to persist (cursor positions, in-flight
// gestures, collab maps). Keeps the saved payload small + portable.
function stripVolatileAppState(s: Partial<AppState> | undefined): Partial<AppState> {
  if (!s) return {};
  const {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    collaborators,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    cursorButton,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    isResizing,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    isRotating,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    isBindingEnabled,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    pendingImageElementId,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    draggingElement,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    resizingElement,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    multiElement,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    selectionElement,
    ...rest
  } = s as Record<string, unknown> & Partial<AppState>;
  return rest as Partial<AppState>;
}

// ─── Styles ─────────────────────────────────────────────────────
const topBar: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "10px 18px",
  background: "rgba(13,13,18,0.92)",
  borderBottom: "1px solid " + D.border,
  backdropFilter: "blur(10px)",
  WebkitBackdropFilter: "blur(10px)",
};

const titleInput: React.CSSProperties = {
  padding: "4px 0",
  border: "none",
  outline: "none",
  background: "transparent",
  color: D.tx,
  fontFamily: gf,
  fontSize: 18,
  fontWeight: 900,
  letterSpacing: -0.3,
  minWidth: 240,
  flexShrink: 1,
};

const autosaveLabelStyle: React.CSSProperties = {
  fontFamily: mn,
  fontSize: 10,
  color: D.txd,
  letterSpacing: 1,
  textTransform: "uppercase",
};

function pillStyle(accent: string): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
    padding: "6px 10px",
    borderRadius: 6,
    background: accent + "16",
    border: "1px solid " + accent + "44",
    color: accent,
    fontFamily: mn,
    fontSize: 10,
    fontWeight: 800,
    letterSpacing: 1,
    textTransform: "uppercase",
    cursor: "pointer",
  };
}

const exportMenu: React.CSSProperties = {
  position: "absolute",
  top: "100%",
  right: 0,
  marginTop: 6,
  background: "#0D0D12",
  border: "1px solid " + D.border,
  borderRadius: 8,
  padding: 6,
  minWidth: 160,
  zIndex: 20,
  boxShadow: "0 12px 28px rgba(0,0,0,0.5)",
};

const exportMenuItem: React.CSSProperties = {
  width: "100%",
  textAlign: "left",
  padding: "8px 10px",
  background: "transparent",
  border: "none",
  color: D.tx,
  fontFamily: mn,
  fontSize: 11,
  cursor: "pointer",
  borderRadius: 6,
  display: "inline-flex",
  gap: 7,
  alignItems: "center",
};

// Keep the design accent token referenced so it doesn't trip the
// "declared but never used" warning when the inset glow is updated.
void DESIGN_ACCENT;
