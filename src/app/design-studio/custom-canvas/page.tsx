"use client";

// DesignStudio · Custom canvas (Excalidraw) entry point.
// Mirrors canvas-editor/page.tsx and doc-editor/page.tsx: Suspense-wraps
// useSearchParams, gates on poast-current-user, hydrates an existing
// project by ?id or seeds a fresh ProjectRecord (kind="excalidraw") from
// w/h/name/category query params. The Excalidraw editor itself is
// rendered client-only inside DocuShell.

import React, { Suspense, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useSearchParams, useRouter } from "next/navigation";
import { D, ft, mn, uid } from "../../shared-constants";
import { DocuShell } from "../docu-shell";
import { getProject, saveProject, type ProjectRecord } from "../projects-store";

// Excalidraw touches window at module init — keep the editor out of SSR.
const CustomCanvas = dynamic(() => import("./custom-canvas").then(m => m.CustomCanvas), {
  ssr: false,
  loading: () => (
    <div style={{ padding: 32, color: D.txm, fontFamily: mn, fontSize: 12 }}>
      Loading free artboard…
    </div>
  ),
});

export default function CustomCanvasPage() {
  return (
    <Suspense fallback={null}>
      <CustomCanvasInner />
    </Suspense>
  );
}

function CustomCanvasInner() {
  const sp = useSearchParams();
  const router = useRouter();
  const [authOk, setAuthOk] = useState(false);
  const [project, setProject] = useState<ProjectRecord | null>(null);
  const [loading, setLoading] = useState(true);

  // Same auth pattern as canvas-editor/page.tsx — read localStorage
  // directly so a cold load doesn't race UserContext hydration.
  useEffect(() => {
    try {
      const stored = localStorage.getItem("poast-current-user");
      if (stored) {
        setAuthOk(true);
        return;
      }
    } catch {}
    window.location.href = "/";
  }, []);

  useEffect(() => {
    if (!authOk) return;
    let cancelled = false;

    const id = sp?.get("id");
    const category = sp?.get("category") || undefined;
    const widthStr = sp?.get("w");
    const heightStr = sp?.get("h");
    const name = sp?.get("name") || "Untitled sketch";

    (async () => {
      if (id) {
        const existing = await getProject(id);
        if (existing && !cancelled) {
          setProject(existing);
          setLoading(false);
          return;
        }
      }

      // Seed a fresh excalidraw project from query params. The width/height
      // are advisory — Excalidraw's surface is infinite — but we keep them
      // around for thumbnail framing and future export defaults.
      const width = Number(widthStr) || 1920;
      const height = Number(heightStr) || 1080;
      const fresh: ProjectRecord = {
        id: id || uid("proj"),
        title: name,
        kind: "excalidraw",
        category,
        preset: { width, height, name: category },
        pages: [{ id: uid("page"), payload: null }],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        deletedAt: null,
      };
      const saved = await saveProject(fresh);
      if (cancelled) return;
      setProject(saved);
      setLoading(false);

      // Keep the URL stable so refreshes resume the same project.
      if (!id) {
        const next = new URLSearchParams(sp?.toString() || "");
        next.set("id", saved.id);
        router.replace(`/design-studio/custom-canvas?${next.toString()}`);
      }
    })();

    return () => { cancelled = true; };
  }, [authOk, sp, router]);

  if (!authOk) return null;

  return (
    <DocuShell title={project?.title || "Custom canvas"} hideNav>
      {loading || !project ? (
        <div style={{ padding: 32, color: D.txm, fontFamily: mn, fontSize: 12 }}>
          Preparing artboard…
        </div>
      ) : (
        <div style={{ minHeight: "calc(100vh - 56px)", background: D.bg, color: D.tx, fontFamily: ft }}>
          <CustomCanvas
            project={project}
            onUpdatePages={(pages) => setProject(p => p ? { ...p, pages } : p)}
            onUpdateTitle={(title) => setProject(p => p ? { ...p, title } : p)}
          />
        </div>
      )}
    </DocuShell>
  );
}
