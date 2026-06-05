"use client";

import React, { Suspense, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useSearchParams, useRouter } from "next/navigation";
import { D, ft, mn, uid } from "../../shared-constants";
import { DocuShell } from "../docu-shell";
import { getProject, saveProject, type ProjectRecord } from "../projects-store";

// Fabric reaches for window at module init — keep the editor out of the SSR pass.
const DesignCanvas = dynamic(() => import("./design-canvas").then(m => m.DesignCanvas), {
  ssr: false,
  loading: () => (
    <div style={{ padding: 32, color: D.txm, fontFamily: mn, fontSize: 12 }}>
      Loading canvas editor…
    </div>
  ),
});

export default function CanvasEditorPage() {
  return (
    <Suspense fallback={null}>
      <CanvasEditorInner />
    </Suspense>
  );
}

function CanvasEditorInner() {
  const sp = useSearchParams();
  const router = useRouter();
  const [authOk, setAuthOk] = useState(false);
  const [project, setProject] = useState<ProjectRecord | null>(null);
  const [loading, setLoading] = useState(true);

  // Same auth pattern as asset-library/page.tsx — read localStorage directly to
  // dodge the UserContext hydration race when this page is opened cold.
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
    const name = sp?.get("name") || "Untitled design";
    const templateId = sp?.get("template") || undefined;

    (async () => {
      if (id) {
        const existing = await getProject(id);
        if (existing && !cancelled) {
          setProject(existing);
          setLoading(false);
          return;
        }
      }

      // Seed a fresh project from query params.
      const width = Number(widthStr) || 1080;
      const height = Number(heightStr) || 1080;
      const fresh: ProjectRecord = {
        id: id || uid("proj"),
        title: name,
        kind: "canvas",
        category,
        preset: { width, height, name: category },
        pages: [{ id: uid("page"), payload: null }],
        templateId,
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
        router.replace(`/design-studio/canvas-editor?${next.toString()}`);
      }
    })();

    return () => { cancelled = true; };
  }, [authOk, sp, router]);

  if (!authOk) return null;

  return (
    <DocuShell title={project?.title || "Canvas editor"} hideNav>
      {loading || !project ? (
        <div style={{ padding: 32, color: D.txm, fontFamily: mn, fontSize: 12 }}>
          Preparing canvas…
        </div>
      ) : (
        <div style={{ minHeight: "calc(100vh - 56px)", background: D.bg, color: D.tx, fontFamily: ft }}>
          <DesignCanvas
            project={project}
            onUpdatePages={(pages) => setProject(p => p ? { ...p, pages } : p)}
            onUpdateTitle={(title) => setProject(p => p ? { ...p, title } : p)}
          />
        </div>
      )}
    </DocuShell>
  );
}
