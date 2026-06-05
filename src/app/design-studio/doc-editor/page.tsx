"use client";

// DocuDesign · Tiptap document editor entry point.
// Mirrors canvas-editor/page.tsx: Suspense-wraps useSearchParams, gates on
// poast-current-user, hydrates an existing project by ?id or seeds a fresh
// ProjectRecord (kind="doc") from category/name/template query params.
// The Tiptap editor itself is rendered client-only inside DocuShell.

import React, { Suspense, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useSearchParams, useRouter } from "next/navigation";
import { D, ft, mn, uid } from "../../shared-constants";
import { DocuShell } from "../docu-shell";
import { getProject, saveProject, type ProjectRecord } from "../projects-store";

// Tiptap reaches for window during editor instantiation — keep this off SSR.
const DocEditor = dynamic(() => import("./doc-editor").then(m => m.DocEditor), {
  ssr: false,
  loading: () => (
    <div style={{ padding: 32, color: D.txm, fontFamily: mn, fontSize: 12 }}>
      Loading document editor…
    </div>
  ),
});

export default function DocEditorPage() {
  return (
    <Suspense fallback={null}>
      <DocEditorInner />
    </Suspense>
  );
}

function DocEditorInner() {
  const sp = useSearchParams();
  const router = useRouter();
  const [authOk, setAuthOk] = useState(false);
  const [project, setProject] = useState<ProjectRecord | null>(null);
  const [loading, setLoading] = useState(true);

  // Same auth pattern as canvas-editor/page.tsx — read localStorage directly
  // to sidestep the UserContext hydration race on cold loads.
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
    const name = sp?.get("name") || "Untitled document";
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

      const fresh: ProjectRecord = {
        id: id || uid("proj"),
        title: name,
        kind: "doc",
        category,
        pages: [{ id: uid("page"), payload: { json: null, html: "" } }],
        templateId,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        deletedAt: null,
      };
      const saved = await saveProject(fresh);
      if (cancelled) return;
      setProject(saved);
      setLoading(false);

      // Keep URL stable so refresh resumes the same project.
      if (!id) {
        const next = new URLSearchParams(sp?.toString() || "");
        next.set("id", saved.id);
        router.replace(`/design-studio/doc-editor?${next.toString()}`);
      }
    })();

    return () => { cancelled = true; };
  }, [authOk, sp, router]);

  if (!authOk) return null;

  return (
    <DocuShell title={project?.title || "Document"} hideNav>
      {loading || !project ? (
        <div style={{ padding: 32, color: D.txm, fontFamily: mn, fontSize: 12 }}>
          Preparing document…
        </div>
      ) : (
        <div style={{ minHeight: "calc(100vh - 56px)", background: D.bg, color: D.tx, fontFamily: ft }}>
          <DocEditor
            project={project}
            onUpdatePages={(pages) => setProject(p => p ? { ...p, pages } : p)}
            onUpdateTitle={(title) => setProject(p => p ? { ...p, title } : p)}
          />
        </div>
      )}
    </DocuShell>
  );
}
