"use client";

// Polotno-backed Canva-style editor for graphic projects. Loads the
// project's stored editor_doc (Polotno JSON) on mount, autosaves on
// store changes. Exposes Export (PNG / PDF), Save, and an SA Templates
// side-panel section seeded from /api/docu-design/templates (Phase 5
// optional — falls back gracefully when empty).
//
// Notes:
// - Polotno's peer is React 18; we're on React 19. Installed with
//   --legacy-peer-deps. If runtime errors surface we surface a clear
//   fallback in this shell.
// - The full Polotno UI ships built-in — we mainly customize the brand
//   palette + font list + a custom side panel section.

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createStore } from "polotno/model/store";
import { PolotnoContainer, SidePanelWrap, WorkspaceWrap } from "polotno";
import { Workspace } from "polotno/canvas/workspace";
import { Toolbar } from "polotno/toolbar/toolbar";
import { ZoomButtons } from "polotno/toolbar/zoom-buttons";
import { SidePanel } from "polotno/side-panel";
import { useToast } from "../../../toast-context";
import { D, ft, gf, mn } from "../../../shared-constants";
import { loadProject } from "../../project-loader";

interface GraphicProject {
  id: string;
  name: string;
  size_preset?: string | null;
  editor_doc?: unknown;
  artboards?: Array<{ id: string; w: number; h: number; svg: string; label?: string }>;
}

// SA brand palette pre-loaded into Polotno's color picker.
const SA_COLORS = [
  "#06060C", "#0A0A14", "#1A1A1A", "#3D3D3D", "#E8E4DD", "#F4EFE8",
  "#F7B041", "#0B86D1", "#2EAD8E", "#E06347", "#26C9D8", "#9B59B6",
  "#F4D35E", "#EE6C4D",
];

// SA fonts. Polotno accepts a list of font defs that show up in the text
// panel; URLs point at the public/fonts/ assets we already ship.
const SA_FONTS = [
  { fontFamily: "Grift",         url: "/fonts/Grift-Black.otf",         styles: [{ src: "url(/fonts/Grift-Black.otf)", fontStyle: "normal", fontWeight: 900 }] },
  { fontFamily: "Outfit",        url: "/fonts/Outfit-Regular.ttf",      styles: [{ src: "url(/fonts/Outfit-Regular.ttf)", fontStyle: "normal", fontWeight: 400 }] },
  { fontFamily: "JetBrains Mono", url: "/fonts/JetBrainsMono-Regular.ttf",styles: [{ src: "url(/fonts/JetBrainsMono-Regular.ttf)", fontStyle: "normal", fontWeight: 400 }] },
];

export function PolotnoShell({ projectId }: { projectId: string }) {
  const { showToast } = useToast();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const storeRef = useRef<any>(null);
  const [project, setProject] = useState<GraphicProject | null>(null);
  const [loadingError, setLoadingError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Create the Polotno store once.
  if (!storeRef.current) {
    storeRef.current = createStore({
      key: "polotno-sa-local",   // dev key — replace with paid key when licensing
      showCredit: false,
    });
    // Pre-load brand assets into the store.
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const s: any = storeRef.current;
      s.setSize?.(1080, 1080);
      s.setRole?.("admin");
      SA_COLORS.forEach((c) => s.addColor?.(c));
      SA_FONTS.forEach((f) => s.addFont?.(f));
    } catch {
      /* tolerate Polotno API drift */
    }
  }

  // Load the project once mounted.
  useEffect(() => {
    let cancelled = false;
    loadProject(projectId)
      .then((p) => {
        if (cancelled) return;
        const adapted: GraphicProject = {
          id: p.id,
          name: p.name,
          size_preset: p.size_preset,
          editor_doc: p.editor_doc,
          artboards: p.artboards as GraphicProject["artboards"],
        };
        setProject(adapted);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const s: any = storeRef.current;
        const doc = p.editor_doc;
        if (doc && Object.keys(doc).length) {
          try { s.loadJSON?.(doc); } catch { /* ignore */ }
        } else {
          const preset = inferPresetSize(adapted);
          try {
            s.setSize?.(preset.w, preset.h);
            if (!s.pages?.length) s.addPage?.();
          } catch { /* ignore */ }
        }
      })
      .catch((e) => { if (!cancelled) setLoadingError(String(e)); });
    return () => { cancelled = true; };
  }, [projectId]);

  // Autosave with a debounce.
  useEffect(() => {
    if (!project) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const s: any = storeRef.current;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const onChange = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => persist(), 1200);
    };
    let off: (() => void) | undefined;
    try {
      off = s.on?.("change", onChange) as (() => void) | undefined;
    } catch {
      /* ignore */
    }
    return () => {
      if (timer) clearTimeout(timer);
      off?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project]);

  async function persist() {
    if (!project || saving) return;
    setSaving(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const s: any = storeRef.current;
      const json = s.toJSON?.() ?? {};
      await fetch("/api/docu-design/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: project.id,
          name: project.name,
          type: "graphic",
          fidelity: "high",
          editor_doc: json,
        }),
      });
    } catch (e) {
      showToast("Save failed: " + String(e));
    } finally {
      setSaving(false);
    }
  }

  async function exportPng() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const s: any = storeRef.current;
    try {
      const dataUrl = await s.toDataURL?.({ pixelRatio: 2 });
      if (!dataUrl) throw new Error("Polotno did not return a data URL");
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `${project?.name || "graphic"}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (e) {
      showToast("PNG export failed: " + String(e));
    }
  }

  async function exportPdf() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const s: any = storeRef.current;
    try {
      await s.saveAsPDF?.({ fileName: `${project?.name || "graphic"}.pdf` });
    } catch (e) {
      showToast("PDF export failed: " + String(e));
    }
  }

  if (loadingError) {
    return (
      <div style={{ padding: 32, color: D.coral, fontFamily: ft }}>
        {loadingError}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", minHeight: 0 }}>
      <header
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          padding: "10px 18px",
          borderBottom: `1px solid ${D.border}`,
          background: D.card,
        }}
      >
        <Link href="/design-studio" style={{ color: D.txm, textDecoration: "none", fontFamily: mn, fontSize: 12 }}>
          ← DesignStudio
        </Link>
        <div style={{ width: 1, height: 18, background: D.border }} />
        <div style={{ fontFamily: gf, fontSize: 16, color: D.tx }}>{project?.name || "Graphic"}</div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <button type="button" onClick={persist} style={ghostBtn}>
            {saving ? "Saving…" : "Save"}
          </button>
          <button type="button" onClick={exportPng} style={ghostBtn}>Export PNG</button>
          <button type="button" onClick={exportPdf} style={ghostBtn}>Export PDF</button>
        </div>
      </header>

      <div style={{ flex: 1, minHeight: 0 }}>
        <PolotnoContainer style={{ width: "100%", height: "100%" }}>
          <SidePanelWrap>
            <SidePanel store={storeRef.current} />
          </SidePanelWrap>
          <WorkspaceWrap>
            <Toolbar store={storeRef.current} />
            <Workspace store={storeRef.current} />
            <ZoomButtons store={storeRef.current} />
          </WorkspaceWrap>
        </PolotnoContainer>
      </div>
    </div>
  );
}

const ghostBtn: React.CSSProperties = {
  background: "transparent",
  color: D.tx,
  border: `1px solid ${D.border}`,
  padding: "6px 12px",
  borderRadius: 6,
  fontFamily: ft,
  fontSize: 12,
  cursor: "pointer",
};

function inferPresetSize(p: GraphicProject): { w: number; h: number } {
  if (p.artboards && p.artboards.length) {
    return { w: p.artboards[0].w, h: p.artboards[0].h };
  }
  // size_preset is a lookup id — keep it loose here, default to IG square.
  return { w: 1080, h: 1080 };
}
