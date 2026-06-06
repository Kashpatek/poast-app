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

// Build a structured outline from the document-wizard brief so the editor
// opens with the user's intent already on the page. Returns "" when there's
// nothing beyond the title to seed — the editor falls back to its empty
// placeholder in that case.
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function buildBriefOutline(brief: {
  title: string;
  subtitle: string;
  keyPoints: string;
  tone: string;
  audience: string;
  context: string;
}): string {
  const parts: string[] = [];
  const title = brief.title.trim();
  if (title) parts.push(`<h1>${escapeHtml(title)}</h1>`);
  const subtitle = brief.subtitle.trim();
  if (subtitle) parts.push(`<p>${escapeHtml(subtitle)}</p>`);

  const points = brief.keyPoints
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  if (points.length) {
    parts.push("<h2>Key points</h2>");
    parts.push(
      "<ul>" +
        points.map((p) => `<li>${escapeHtml(p)}</li>`).join("") +
        "</ul>"
    );
  }

  const metaLines: string[] = [];
  if (brief.tone.trim()) metaLines.push(`Tone: ${escapeHtml(brief.tone.trim())}`);
  if (brief.audience.trim()) metaLines.push(`Audience: ${escapeHtml(brief.audience.trim())}`);
  if (brief.context.trim()) metaLines.push(`Context: ${escapeHtml(brief.context.trim())}`);
  for (const line of metaLines) parts.push(`<p>${line}</p>`);

  // If only the (default) title is present we have nothing useful to seed.
  if (parts.length <= 1) return "";
  return parts.join("");
}

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
    // Brief fields piped from document-wizard. Only consumed when seeding
    // a fresh project — never overwrites an existing payload.
    const subtitle = sp?.get("subtitle") || "";
    const keyPoints = sp?.get("keyPoints") || "";
    const tone = sp?.get("tone") || "";
    const audience = sp?.get("audience") || "";
    const context = sp?.get("context") || "";

    (async () => {
      if (id) {
        const existing = await getProject(id);
        if (existing && !cancelled) {
          setProject(existing);
          setLoading(false);
          return;
        }
      }

      const seededHtml = buildBriefOutline({
        title: name,
        subtitle,
        keyPoints,
        tone,
        audience,
        context,
      });

      const fresh: ProjectRecord = {
        id: id || uid("proj"),
        title: name,
        kind: "doc",
        category,
        pages: [{ id: uid("page"), payload: { json: null, html: seededHtml } }],
        templateId,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        deletedAt: null,
      };
      const saved = await saveProject(fresh);
      if (cancelled) return;
      setProject(saved);
      setLoading(false);

      // Keep URL stable so refresh resumes the same project. Strip the
      // brief params on the way out so a refresh doesn't re-seed (the
      // ?id branch above will hydrate the saved payload instead).
      if (!id) {
        const next = new URLSearchParams(sp?.toString() || "");
        next.set("id", saved.id);
        next.delete("subtitle");
        next.delete("keyPoints");
        next.delete("tone");
        next.delete("audience");
        next.delete("context");
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
