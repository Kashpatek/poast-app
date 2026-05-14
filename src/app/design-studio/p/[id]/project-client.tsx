"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { DocuShell } from "../../docu-shell";
import { D, ft, mn } from "../../../shared-constants";
import { useToast } from "../../../toast-context";
import { useDialog } from "../../../dialog-context";
import { Preview } from "../../preview";
import { exportSVG } from "../../export";
import { OpStreamParser, applyOps, type Artboard, type Op } from "../../artboard-ops";
import { findPreset } from "../../wizards/size-presets";
import { findCategory } from "../../wizards/categories";
import type { ProjectBrief, ProjectType } from "../../design-context";
import { ImageEditorModal } from "./image-editor";

type Fidelity = "wireframe" | "high";

interface MessageUpload {
  url: string;
  name?: string;
  kind?: string;
}

interface Message {
  role: "user" | "assistant";
  content: string;
  ts?: number;
  uploads?: MessageUpload[];
}

interface ProjectRow {
  id: string;
  name: string;
  type: ProjectType;
  fidelity: Fidelity;
  design_system_id: string | null;
  artboards: Artboard[];
  messages: Message[];
  uploads?: MessageUpload[];
  size_preset?: string | null;
  category?: string | null;
  brief?: ProjectBrief;
}

// Compose a structured first prompt from the wizard brief. User can edit
// before sending. Goal: enough context that Claude generates a real first
// artboard on the very first send.
function composeFirstPrompt(p: ProjectRow): string {
  const b = p.brief ?? {};
  const preset = findPreset(p.size_preset || "");
  const cat = findCategory(p.category || "");
  const lines: string[] = [];
  lines.push(
    `Create the first artboard for a ${cat?.label ?? "document"}${
      preset ? ` sized ${preset.w}×${preset.h}px (${preset.label})` : ""
    }.`
  );
  if (b.title) lines.push(`Title: ${b.title}`);
  if (b.subtitle) lines.push(`Subtitle: ${b.subtitle}`);
  if (b.audience) lines.push(`Audience: ${b.audience}`);
  if (b.tone) lines.push(`Tone: ${b.tone}`);
  if (b.keyPoints && b.keyPoints.length) {
    lines.push("Key points:");
    for (const kp of b.keyPoints) lines.push(`- ${kp}`);
  }
  if (b.context) lines.push(`\nContext / source material:\n${b.context}`);
  lines.push("\nUse the SA design system. Lay out the cover / first page with clear hierarchy.");
  return lines.join("\n");
}

export function ProjectClient({ projectId }: { projectId: string }) {
  const { showToast } = useToast();
  const { confirm } = useDialog();
  const [project, setProject] = useState<ProjectRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [pendingUploads, setPendingUploads] = useState<MessageUpload[]>([]);
  const [generating, setGenerating] = useState(false);
  const [streamingAssistant, setStreamingAssistant] = useState<string>("");
  const [selectedArtboardId, setSelectedArtboardId] = useState<string | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [zoom, setZoom] = useState(0.6);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/docu-design/projects?id=${encodeURIComponent(projectId)}`);
      const j = await res.json();
      if (!res.ok) {
        setError(j.error || "Failed to load");
        return;
      }
      const r = j.data as Record<string, unknown>;
      // Pull Phase 2 metadata out of the messages array if the API had to
      // fall back (schema cache miss). __META__ marker is created in the
      // POST handler; strip it from the visible messages.
      let messages = (r.messages as Message[]) || [];
      let extractedMeta: Record<string, unknown> = {};
      const metaIdx = messages.findIndex(
        (m) => typeof m.content === "string" && m.content.startsWith("__META__")
      );
      if (metaIdx !== -1) {
        try {
          extractedMeta = JSON.parse(messages[metaIdx].content.slice("__META__".length));
        } catch { /* ignore */ }
        messages = messages.filter((_, i) => i !== metaIdx);
      }
      const merge = <T,>(key: string, fallback: T): T =>
        (r[key] as T) ?? (extractedMeta[key] as T) ?? fallback;
      // Recover the original project type when the DB CHECK constraint
      // forced us to fall back to "other" / "document".
      const originalType = (extractedMeta.__originalType as ProjectType | undefined) ?? (r.type as ProjectType);
      const project: ProjectRow = {
        id: r.id as string,
        name: r.name as string,
        type: originalType,
        fidelity: (r.fidelity as Fidelity) || "high",
        design_system_id: (r.design_system_id as string | null) ?? null,
        artboards: (r.artboards as Artboard[]) || [],
        messages,
        uploads: (r.uploads as MessageUpload[]) || [],
        size_preset: merge<string | null>("size_preset", null),
        category: merge<string | null>("category", null),
        brief: merge<ProjectBrief>("brief", {}),
      };
      // Image-type projects also carry output_files. The merge helper sets
      // them onto the project via a typed cast in the gallery view.
      (project as unknown as { output_files?: unknown }).output_files =
        merge<unknown[]>("output_files", []);
      setProject(project);
      if (project.artboards.length && !selectedArtboardId) {
        setSelectedArtboardId(project.artboards[0].id);
      }
      // Brief pre-shape: if the wizard captured a brief and the canvas is
      // still empty, pre-fill the chat draft with a structured first prompt.
      // User can edit before sending.
      if (
        project.messages.length === 0 &&
        project.artboards.length === 0 &&
        project.brief &&
        Object.keys(project.brief).length > 0
      ) {
        setDraft((cur) => (cur ? cur : composeFirstPrompt(project)));
      }
    } catch (e) {
      setError(String(e));
    }
  }, [projectId, selectedArtboardId]);

  useEffect(() => {
    load();
  }, [load]);

  const persistProject = useCallback(
    async (next: ProjectRow) => {
      try {
        await fetch("/api/docu-design/projects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: next.id,
            name: next.name,
            type: next.type,
            fidelity: next.fidelity,
            design_system_id: next.design_system_id,
            artboards: next.artboards,
            messages: next.messages,
            uploads: next.uploads ?? [],
          }),
        });
      } catch (e) {
        showToast("Save failed: " + String(e));
      }
    },
    [showToast]
  );

  async function uploadFiles(files: FileList | null) {
    if (!files || !files.length) return;
    const added: MessageUpload[] = [];
    for (const file of Array.from(files)) {
      const reader = new FileReader();
      const data = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });
      try {
        const res = await fetch("/api/upload-asset", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ data, filename: file.name, contentType: file.type }),
        });
        const j = await res.json();
        if (!res.ok) {
          showToast(j.error || "Upload failed");
          continue;
        }
        added.push({ url: j.url, name: file.name, kind: guessKind(file.name) });
      } catch (e) {
        showToast(String(e));
      }
    }
    if (added.length) setPendingUploads((cur) => [...cur, ...added]);
  }

  async function send() {
    if (!project) return;
    const userText = draft.trim();
    if (!userText && pendingUploads.length === 0) return;
    if (generating) return;

    const userMessage: Message = {
      role: "user",
      content: userText || "(see attached)",
      ts: Date.now(),
      uploads: pendingUploads,
    };

    let working: ProjectRow = {
      ...project,
      messages: [...project.messages, userMessage],
    };
    setProject(working);
    setDraft("");
    setPendingUploads([]);
    setGenerating(true);
    setStreamingAssistant("");

    try {
      const res = await fetch("/api/docu-design/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: project.id,
          userMessage: userText || "(see attached)",
          uploads: userMessage.uploads,
        }),
      });

      if (!res.ok || !res.body) {
        const j = await res.json().catch(() => ({}));
        showToast(j.error || `Request failed (${res.status})`);
        setGenerating(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      const parser = new OpStreamParser();
      let assistantText = "";
      let liveArtboards = working.artboards;

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        const ops = parser.feed(chunk);
        const result = applyChunkOps(liveArtboards, ops, assistantText);
        liveArtboards = result.artboards;
        assistantText = result.prose;
        setStreamingAssistant(assistantText);
        setProject({ ...working, artboards: liveArtboards });
        if (!selectedArtboardId && liveArtboards.length) {
          setSelectedArtboardId(liveArtboards[0].id);
        }
      }

      const tail = parser.flush();
      const finalResult = applyChunkOps(liveArtboards, tail, assistantText);
      liveArtboards = finalResult.artboards;
      assistantText = finalResult.prose;

      const assistantMessage: Message = {
        role: "assistant",
        content: assistantText.trim(),
        ts: Date.now(),
      };

      working = {
        ...working,
        artboards: liveArtboards,
        messages: [...working.messages, assistantMessage],
      };
      setProject(working);
      setStreamingAssistant("");
      if (!selectedArtboardId && liveArtboards.length) {
        setSelectedArtboardId(liveArtboards[0].id);
      }
      await persistProject(working);
    } catch (e) {
      showToast("Stream error: " + String(e));
    } finally {
      setGenerating(false);
    }
  }

  async function setFidelity(f: Fidelity) {
    if (!project || project.fidelity === f) return;
    const next = { ...project, fidelity: f };
    setProject(next);
    await persistProject(next);
  }

  async function clearChat() {
    if (!project) return;
    const ok = await confirm({
      title: "Reset conversation?",
      body: "This clears the chat history and all artboards. Start fresh?",
      cta: "Reset",
      variant: "danger",
    });
    if (!ok) return;
    const next: ProjectRow = { ...project, messages: [], artboards: [] };
    setProject(next);
    setSelectedArtboardId(null);
    await persistProject(next);
  }

  if (error) {
    return (
      <DocuShell title="Project">
        <div style={{ padding: 32, color: D.coral, fontFamily: ft }}>{error}</div>
      </DocuShell>
    );
  }

  if (!project) {
    return (
      <DocuShell title="Project">
        <div style={{ padding: 32, color: D.txm, fontFamily: mn, fontSize: 12 }}>Loading…</div>
      </DocuShell>
    );
  }

  // Image projects get a dedicated gallery instead of the chat+canvas layout.
  if (project.type === "image") {
    return <ImageGalleryView project={project} setProject={setProject} persistProject={persistProject} />;
  }

  const selected = project.artboards.find((a) => a.id === selectedArtboardId) || project.artboards[0] || null;

  return (
    <DocuShell
      title={project.name}
      rightSlot={
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={fidelitySwitch}>
            <button
              type="button"
              onClick={() => setFidelity("wireframe")}
              style={fidelityBtn(project.fidelity === "wireframe")}
            >
              Wireframe
            </button>
            <button
              type="button"
              onClick={() => setFidelity("high")}
              style={fidelityBtn(project.fidelity === "high")}
            >
              High fidelity
            </button>
          </div>
          <div style={{ position: "relative" }}>
            <button type="button" onClick={() => setExportOpen((v) => !v)} style={primaryBtn}>
              Export ↓
            </button>
            {exportOpen ? (
              <div style={menuStyle} onMouseLeave={() => setExportOpen(false)}>
                <button
                  type="button"
                  style={menuItem}
                  onClick={() => {
                    setExportOpen(false);
                    if (project.artboards.length) exportSVG(project.name, project.artboards);
                    else showToast("No artboards yet");
                  }}
                >
                  SVG
                </button>
                <button
                  type="button"
                  style={menuItem}
                  onClick={() => {
                    setExportOpen(false);
                    exportArtboardPng(project.artboards, project.name, showToast);
                  }}
                >
                  PNG (artboard)
                </button>
                <button
                  type="button"
                  style={menuItem}
                  onClick={() => { setExportOpen(false); exportViaOffice(project.id, "pdf", showToast); }}
                >
                  PDF
                </button>
                <button
                  type="button"
                  style={menuItem}
                  onClick={() => { setExportOpen(false); exportViaOffice(project.id, "docx", showToast); }}
                >
                  DOCX
                </button>
                <button
                  type="button"
                  style={menuItem}
                  onClick={() => { setExportOpen(false); exportViaOffice(project.id, "pptx", showToast); }}
                >
                  PPTX
                </button>
              </div>
            ) : null}
          </div>
        </div>
      }
    >
      <div style={{ display: "grid", gridTemplateColumns: "minmax(360px, 420px) 1fr", height: "100%" }}>
        <div style={{ display: "flex", flexDirection: "column", borderRight: `1px solid ${D.border}`, height: "100%", overflow: "hidden" }}>
          <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
            {project.messages.length === 0 && !streamingAssistant ? (
              <div style={{ color: D.txm, fontFamily: ft, fontSize: 13, lineHeight: 1.5 }}>
                {project.brief && Object.keys(project.brief).length ? (
                  <BriefCard project={project} />
                ) : (
                  <>
                    Describe what you want. Try:
                    <ul style={{ paddingLeft: 18, marginTop: 8, color: D.txd }}>
                      <li>“3-page one-pager on Blackwell GPU yields, SA brand.”</li>
                      <li>“Square poster: TSMC capex hits $44B, big number, sparkline.”</li>
                    </ul>
                  </>
                )}
              </div>
            ) : null}
            {project.messages.map((m, i) => (
              <ChatBubble key={i} message={m} />
            ))}
            {streamingAssistant ? (
              <ChatBubble message={{ role: "assistant", content: streamingAssistant }} streaming />
            ) : null}
          </div>
          <div style={{ borderTop: `1px solid ${D.border}`, padding: 12, background: D.card }}>
            {pendingUploads.length ? (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                {pendingUploads.map((u, i) => (
                  <div key={i} style={uploadChip}>
                    <span style={{ fontFamily: mn, fontSize: 11, color: D.txm }}>{u.name || u.url.split("/").pop()}</span>
                    <button
                      type="button"
                      onClick={() => setPendingUploads((cur) => cur.filter((_, idx) => idx !== i))}
                      style={chipX}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder={generating ? "Generating…" : "Describe what to design or how to change it"}
              rows={3}
              disabled={generating}
              style={textarea}
            />
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <button type="button" onClick={() => fileInputRef.current?.click()} disabled={generating} style={secondaryBtn}>
                + Attach
              </button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                style={{ display: "none" }}
                onChange={(e) => uploadFiles(e.target.files)}
              />
              <button type="button" onClick={clearChat} style={secondaryBtn}>
                Reset
              </button>
              <button type="button" onClick={send} disabled={generating} style={{ ...primaryBtn, marginLeft: "auto" }}>
                {generating ? "…" : "Send"}
              </button>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden", background: "#111118" }}>
          <ArtboardSwitcher
            artboards={project.artboards}
            selectedId={selected?.id ?? null}
            onSelect={(id) => setSelectedArtboardId(id)}
            zoom={zoom}
            onZoom={setZoom}
          />
          <div style={{ flex: 1, overflow: "auto" }}>
            <Preview artboard={selected} zoom={zoom} />
          </div>
        </div>
      </div>
    </DocuShell>
  );
}

function applyChunkOps(
  artboards: Artboard[],
  ops: Op[],
  prose: string
): { artboards: Artboard[]; prose: string } {
  let proseAcc = prose;
  const drawingOps: Op[] = [];
  for (const op of ops) {
    if (op.kind === "prose") proseAcc += op.text;
    else drawingOps.push(op);
  }
  return { artboards: applyOps(artboards, drawingOps), prose: proseAcc };
}

// Image projects render a dedicated gallery view — favorite hero, variants
// strip, re-prompt + regenerate, inline editor via Filerobot. No chat /
// canvas.
function ImageGalleryView({
  project,
  setProject,
  persistProject,
}: {
  project: ProjectRow;
  setProject: (p: ProjectRow) => void;
  persistProject: (p: ProjectRow) => Promise<void>;
}) {
  const { showToast } = useToast();
  const [regenerating, setRegenerating] = useState(false);
  const [reprompt, setReprompt] = useState("");
  const [editingIdx, setEditingIdx] = useState<number | null>(null);

  // `output_files` is JSONB array of {url, is_cover, name, format, created_at}.
  type OutputFile = { url: string; is_cover?: boolean; name?: string; format?: string; created_at?: string };
  const files: OutputFile[] = ((project as unknown as { output_files?: OutputFile[] }).output_files || []) as OutputFile[];
  const cover = files.find((f) => f.is_cover) || files[0];
  const initialPrompt = project.brief?.context || "";

  async function setCover(idx: number) {
    const nextFiles = files.map((f, i) => ({ ...f, is_cover: i === idx }));
    const nextProject = { ...project, output_files: nextFiles } as ProjectRow & { output_files: OutputFile[] };
    setProject(nextProject);
    await persistProject(nextProject);
  }

  async function regenerate() {
    if (regenerating) return;
    const prompt = (reprompt.trim() || initialPrompt).trim();
    if (!prompt) {
      showToast("Add a prompt before regenerating.");
      return;
    }
    setRegenerating(true);
    try {
      const res = await fetch("/api/generate-thumbnail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          concept: prompt,
          style: project.brief?.tone || "cinematic",
          count: 3,
        }),
      });
      const j = await res.json();
      if (!res.ok) {
        showToast(j.error || "Regenerate failed");
        return;
      }
      const fresh: OutputFile[] = ((j.images as string[]) || []).map((url, i) => ({
        url,
        name: `Variant ${files.length + i + 1}`,
        format: "image",
        is_cover: false,
        created_at: new Date().toISOString(),
      }));
      const nextFiles = [...files, ...fresh];
      const nextProject = { ...project, output_files: nextFiles } as ProjectRow & { output_files: OutputFile[] };
      setProject(nextProject);
      await persistProject(nextProject);
      setReprompt("");
    } catch (e) {
      showToast(String(e));
    } finally {
      setRegenerating(false);
    }
  }

  async function saveEdited(idx: number, dataUrl: string) {
    // Upload to Vercel Blob so the edited image survives reload (Grok URLs
    // expire; data URIs are huge in JSONB). Falls back to inline data URI
    // if the upload fails so the edit isn't lost.
    let finalUrl = dataUrl;
    try {
      const res = await fetch("/api/upload-asset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: dataUrl,
          filename: `edit-${Date.now()}.png`,
          contentType: "image/png",
        }),
      });
      const j = await res.json();
      if (res.ok && j.url) finalUrl = j.url;
    } catch {
      /* keep data URI */
    }
    const original = files[idx];
    const newFile: OutputFile = {
      url: finalUrl,
      name: (original?.name || `Variant ${idx + 1}`) + " (edited)",
      format: "image",
      is_cover: false,
      created_at: new Date().toISOString(),
    };
    const nextFiles = [...files, newFile];
    const nextProject = { ...project, output_files: nextFiles } as ProjectRow & { output_files: OutputFile[] };
    setProject(nextProject);
    await persistProject(nextProject);
    showToast("Edit saved as new variant.");
  }

  async function downloadCover() {
    if (!cover) return;
    try {
      const a = document.createElement("a");
      a.href = cover.url;
      a.download = (project.name || "image") + ".png";
      a.target = "_blank";
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (e) {
      showToast(String(e));
    }
  }

  return (
    <DocuShell title={project.name}>
      <div style={{ padding: 28, maxWidth: 1180, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 18, flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={{ fontFamily: mn, fontSize: 10, letterSpacing: 1.4, color: D.amber, textTransform: "uppercase" }}>Image Studio</div>
            <div style={{ fontFamily: ft, fontSize: 13, color: D.txm, marginTop: 4 }}>
              {files.length} variant{files.length === 1 ? "" : "s"} · {project.size_preset || "no size"} · {project.brief?.tone || "—"}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {cover ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    const i = files.findIndex((f) => f.is_cover);
                    setEditingIdx(i !== -1 ? i : 0);
                  }}
                  style={ghostBtn}
                >
                  Edit cover
                </button>
                <button type="button" onClick={downloadCover} style={ghostBtn}>
                  Download
                </button>
              </>
            ) : null}
          </div>
        </div>

        {/* Hero */}
        {cover ? (
          <div style={{ background: D.card, border: `1px solid ${D.border}`, borderRadius: 14, padding: 16, marginBottom: 18 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={cover.url}
              alt="Cover variant"
              style={{ display: "block", width: "100%", maxHeight: 540, objectFit: "contain", background: "#06060C", borderRadius: 10 }}
            />
          </div>
        ) : (
          <div style={{ padding: 32, border: `1px dashed ${D.border}`, borderRadius: 12, textAlign: "center", color: D.txm, fontFamily: ft }}>
            No images yet — generate below.
          </div>
        )}

        {/* Variants strip */}
        {files.length > 0 ? (
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontFamily: mn, fontSize: 10, letterSpacing: 1.4, color: D.txd, textTransform: "uppercase", marginBottom: 8 }}>
              All variants — click to set as cover
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 10 }}>
              {files.map((f, i) => (
                <div key={i} style={{ position: "relative" }}>
                  <button
                    type="button"
                    onClick={() => setCover(i)}
                    style={{
                      width: "100%",
                      padding: 0,
                      border: `2px solid ${f.is_cover ? D.amber : "transparent"}`,
                      borderRadius: 10,
                      background: D.card,
                      cursor: "pointer",
                      overflow: "hidden",
                      aspectRatio: "1 / 1",
                      position: "relative",
                      display: "block",
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={f.url} alt={f.name || `Variant ${i + 1}`} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                    <div style={{ position: "absolute", bottom: 4, left: 6, fontFamily: mn, fontSize: 9, color: "#fff", textShadow: "0 1px 4px rgba(0,0,0,0.7)" }}>
                      {f.name || `V${i + 1}`}
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setEditingIdx(i); }}
                    style={{
                      position: "absolute",
                      top: 6,
                      right: 6,
                      padding: "4px 8px",
                      borderRadius: 6,
                      background: "rgba(6,6,12,0.85)",
                      color: D.amber,
                      border: `1px solid ${D.amber}55`,
                      fontFamily: mn,
                      fontSize: 9,
                      letterSpacing: 0.6,
                      cursor: "pointer",
                    }}
                  >
                    EDIT
                  </button>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {/* Re-prompt + Regenerate */}
        <div style={{ background: D.card, border: `1px solid ${D.border}`, borderRadius: 12, padding: 16 }}>
          <div style={{ fontFamily: mn, fontSize: 10, letterSpacing: 1.4, color: D.txd, textTransform: "uppercase", marginBottom: 8 }}>
            Generate more variants
          </div>
          <textarea
            value={reprompt}
            onChange={(e) => setReprompt(e.target.value)}
            placeholder={initialPrompt ? `Leave blank to reuse: "${initialPrompt.slice(0, 80)}${initialPrompt.length > 80 ? "…" : ""}"` : "Describe a new variation"}
            style={{
              width: "100%",
              padding: "10px 12px",
              background: "rgba(255,255,255,0.03)",
              border: `1px solid ${D.border}`,
              borderRadius: 8,
              color: D.tx,
              fontFamily: ft,
              fontSize: 13,
              outline: "none",
              boxSizing: "border-box",
              minHeight: 80,
              resize: "vertical",
              marginBottom: 10,
            }}
          />
          <button
            type="button"
            onClick={regenerate}
            disabled={regenerating}
            style={{ ...primaryBtn, opacity: regenerating ? 0.6 : 1, cursor: regenerating ? "wait" : "pointer" }}
          >
            {regenerating ? "Generating…" : "Generate 3 more"}
          </button>
          <div style={{ marginTop: 12, fontFamily: mn, fontSize: 10, color: D.txd, letterSpacing: 0.4 }}>
            Click EDIT on any variant for crop, filters, and annotations.
          </div>
        </div>
      </div>

      <ImageEditorModal
        open={editingIdx !== null}
        source={editingIdx !== null && files[editingIdx] ? files[editingIdx].url : ""}
        onClose={() => setEditingIdx(null)}
        onSave={async (dataUrl) => {
          if (editingIdx === null) return;
          await saveEdited(editingIdx, dataUrl);
        }}
      />
    </DocuShell>
  );
}

// Client-side PNG snapshot of an artboard SVG. Rasterizes via a canvas
// from a data: URI — no Chromium needed.
async function exportArtboardPng(
  artboards: Artboard[],
  name: string,
  toast: (msg: string) => void
) {
  if (!artboards.length) { toast("No artboards to export."); return; }
  const ab = artboards[0];
  try {
    const svgBlob = new Blob([ab.svg], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);
    const img = new Image();
    img.crossOrigin = "anonymous";
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("SVG load failed"));
      img.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = ab.w;
    canvas.height = ab.h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D unavailable");
    ctx.drawImage(img, 0, 0, ab.w, ab.h);
    URL.revokeObjectURL(url);
    const dataUrl = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `${name || "artboard"}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } catch (e) {
    toast("PNG export failed: " + String(e));
  }
}

// Hit /api/design-studio/generate-file which runs the project's brief
// through Claude + LibreOffice and returns a Blob URL.
async function exportViaOffice(
  projectId: string,
  format: "pdf" | "docx" | "pptx",
  toast: (msg: string) => void
) {
  toast(`Rendering ${format.toUpperCase()}… (Office host takes ~15-30s)`);
  try {
    const res = await fetch("/api/design-studio/generate-file", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, format }),
    });
    const j = await res.json();
    if (!res.ok || !j.url) {
      toast(j.error || `${format.toUpperCase()} export failed`);
      return;
    }
    const a = document.createElement("a");
    a.href = j.url;
    a.target = "_blank";
    a.rel = "noopener";
    a.download = j.name || `${projectId}.${format}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast(`${format.toUpperCase()} ready — opening download.`);
  } catch (e) {
    toast("Export failed: " + String(e));
  }
}

const ghostBtn: React.CSSProperties = {
  background: "transparent",
  color: D.tx,
  border: `1px solid ${D.border}`,
  padding: "8px 14px",
  borderRadius: 8,
  fontFamily: ft,
  fontSize: 13,
  cursor: "pointer",
};

// Pinned card shown when the canvas opens with a wizard brief and no
// messages yet. Surfaces the brief so the user can see what context the
// chat will start from.
function BriefCard({ project }: { project: ProjectRow }) {
  const b = project.brief ?? {};
  const preset = findPreset(project.size_preset || "");
  const cat = findCategory(project.category || "");
  const rows: Array<[string, string]> = [];
  if (cat) rows.push(["Type", cat.label]);
  if (preset) rows.push(["Size", `${preset.label} · ${preset.w}×${preset.h}px`]);
  if (b.title) rows.push(["Title", b.title]);
  if (b.subtitle) rows.push(["Subtitle", b.subtitle]);
  if (b.audience) rows.push(["Audience", b.audience]);
  if (b.tone) rows.push(["Tone", b.tone]);
  if (b.keyPoints && b.keyPoints.length) rows.push(["Key points", b.keyPoints.map((k) => `• ${k}`).join("\n")]);
  if (b.context) rows.push(["Context", b.context]);

  return (
    <div
      style={{
        border: `1px solid ${D.amber}55`,
        background: "rgba(247,176,65,0.06)",
        borderRadius: 10,
        padding: "12px 14px",
        marginBottom: 14,
      }}
    >
      <div style={{ fontFamily: mn, fontSize: 10, letterSpacing: 1.4, color: D.amber, marginBottom: 8, textTransform: "uppercase" }}>
        Project brief
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {rows.map(([k, v]) => (
          <div key={k} style={{ display: "grid", gridTemplateColumns: "82px 1fr", gap: 8, alignItems: "baseline" }}>
            <div style={{ fontFamily: mn, fontSize: 10, color: D.txd, letterSpacing: 0.4, textTransform: "uppercase" }}>{k}</div>
            <div style={{ fontFamily: ft, fontSize: 12.5, color: D.tx, whiteSpace: "pre-wrap", lineHeight: 1.45 }}>{v}</div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 10, fontFamily: mn, fontSize: 10, color: D.txd, letterSpacing: 0.3 }}>
        Edit the message below if you want to tweak the first prompt. Press send to generate the first artboard.
      </div>
    </div>
  );
}

function ChatBubble({ message, streaming }: { message: Message; streaming?: boolean }) {
  const isUser = message.role === "user";
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
        <div style={{ fontFamily: mn, fontSize: 10, color: D.txd, letterSpacing: 0.5 }}>
          {isUser ? "YOU" : "DOCUDESIGN"}
        </div>
        {streaming ? <div style={{ fontFamily: mn, fontSize: 10, color: D.amber }}>● streaming</div> : null}
      </div>
      <div
        style={{
          padding: 12,
          borderRadius: 10,
          background: isUser ? D.surface : D.card,
          border: `1px solid ${D.border}`,
          fontFamily: ft,
          fontSize: 13,
          lineHeight: 1.55,
          color: D.tx,
          whiteSpace: "pre-wrap",
        }}
      >
        {message.content || (streaming ? "…" : "")}
      </div>
      {message.uploads && message.uploads.length ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
          {message.uploads.map((u, i) => (
            <div key={i} style={uploadChip}>
              <span style={{ fontFamily: mn, fontSize: 10, color: D.txm }}>{u.name || u.url.split("/").pop()}</span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ArtboardSwitcher({
  artboards,
  selectedId,
  onSelect,
  zoom,
  onZoom,
}: {
  artboards: Artboard[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  zoom: number;
  onZoom: (z: number) => void;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderBottom: `1px solid ${D.border}`, background: D.bg }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, flex: 1 }}>
        {artboards.length === 0 ? (
          <div style={{ fontFamily: mn, fontSize: 11, color: D.txd }}>No artboards yet</div>
        ) : null}
        {artboards.map((a, i) => {
          const sel = a.id === selectedId;
          return (
            <button
              key={a.id}
              type="button"
              onClick={() => onSelect(a.id)}
              style={{
                padding: "4px 10px",
                borderRadius: 6,
                border: `1px solid ${sel ? D.amber : D.border}`,
                background: sel ? "rgba(247,176,65,0.1)" : "transparent",
                color: sel ? D.amber : D.txm,
                fontFamily: mn,
                fontSize: 11,
                cursor: "pointer",
              }}
              title={`${a.w}×${a.h}`}
            >
              {a.label || `p${i + 1}`}
            </button>
          );
        })}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <button type="button" onClick={() => onZoom(Math.max(0.2, zoom - 0.1))} style={zoomBtn}>−</button>
        <div style={{ fontFamily: mn, fontSize: 11, color: D.txm, minWidth: 36, textAlign: "center" }}>
          {Math.round(zoom * 100)}%
        </div>
        <button type="button" onClick={() => onZoom(Math.min(2, zoom + 0.1))} style={zoomBtn}>+</button>
      </div>
    </div>
  );
}

function guessKind(name: string): string {
  const n = name.toLowerCase();
  if (/logo|mark/.test(n)) return "logo";
  if (/backdrop|background|bg/.test(n)) return "backdrop";
  return "other";
}

const primaryBtn: React.CSSProperties = {
  background: D.amber,
  color: "#000",
  border: "none",
  padding: "8px 14px",
  borderRadius: 8,
  fontFamily: ft,
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
};

const secondaryBtn: React.CSSProperties = {
  background: "transparent",
  color: D.tx,
  border: `1px solid ${D.border}`,
  padding: "8px 12px",
  borderRadius: 8,
  fontFamily: ft,
  fontSize: 12,
  cursor: "pointer",
};

const fidelitySwitch: React.CSSProperties = {
  display: "flex",
  border: `1px solid ${D.border}`,
  borderRadius: 8,
  overflow: "hidden",
};

function fidelityBtn(active: boolean): React.CSSProperties {
  return {
    padding: "6px 12px",
    background: active ? D.hover : "transparent",
    color: active ? D.tx : D.txm,
    border: "none",
    fontFamily: mn,
    fontSize: 11,
    cursor: "pointer",
  };
}

const menuStyle: React.CSSProperties = {
  position: "absolute",
  right: 0,
  top: "calc(100% + 4px)",
  background: D.card,
  border: `1px solid ${D.border}`,
  borderRadius: 8,
  minWidth: 180,
  padding: 4,
  zIndex: 100,
  boxShadow: "0 12px 30px rgba(0,0,0,0.5)",
};

const menuItem: React.CSSProperties = {
  display: "block",
  width: "100%",
  textAlign: "left",
  padding: "8px 10px",
  background: "transparent",
  border: "none",
  color: D.tx,
  fontFamily: ft,
  fontSize: 13,
  cursor: "pointer",
  borderRadius: 4,
};

const menuItemDisabled: React.CSSProperties = {
  ...menuItem,
  color: D.txd,
  cursor: "not-allowed",
};

const textarea: React.CSSProperties = {
  width: "100%",
  background: D.bg,
  border: `1px solid ${D.border}`,
  borderRadius: 8,
  color: D.tx,
  padding: "10px 12px",
  fontFamily: ft,
  fontSize: 13,
  outline: "none",
  resize: "none",
  boxSizing: "border-box",
};

const uploadChip: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  background: D.surface,
  border: `1px solid ${D.border}`,
  borderRadius: 6,
  padding: "2px 6px",
};

const chipX: React.CSSProperties = {
  background: "transparent",
  border: "none",
  color: D.txd,
  fontFamily: mn,
  fontSize: 12,
  cursor: "pointer",
  padding: 0,
};

const zoomBtn: React.CSSProperties = {
  width: 24,
  height: 24,
  borderRadius: 4,
  border: `1px solid ${D.border}`,
  background: "transparent",
  color: D.tx,
  cursor: "pointer",
  fontFamily: mn,
  fontSize: 13,
};
