"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { DocuShell } from "../../docu-shell";
import { D, ft, mn } from "../../../shared-constants";
import { useToast } from "../../../toast-context";
import { useDialog } from "../../../dialog-context";
import { Preview } from "../../preview";
import { exportSVG } from "../../export";
import { OpStreamParser, applyOps, type Artboard, type Op } from "../../artboard-ops";

type Fidelity = "wireframe" | "high";
type ProjectType = "document" | "other";

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
      const project: ProjectRow = {
        id: r.id as string,
        name: r.name as string,
        type: r.type as ProjectType,
        fidelity: (r.fidelity as Fidelity) || "high",
        design_system_id: (r.design_system_id as string | null) ?? null,
        artboards: (r.artboards as Artboard[]) || [],
        messages: (r.messages as Message[]) || [],
        uploads: (r.uploads as MessageUpload[]) || [],
      };
      setProject(project);
      if (project.artboards.length && !selectedArtboardId) {
        setSelectedArtboardId(project.artboards[0].id);
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
                <button type="button" style={menuItemDisabled} disabled title="Coming next">
                  PNG (next)
                </button>
                <button type="button" style={menuItemDisabled} disabled title="Later">
                  PDF (later)
                </button>
                <button type="button" style={menuItemDisabled} disabled title="Later">
                  .ai (later)
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
                Describe what you want. Try:
                <ul style={{ paddingLeft: 18, marginTop: 8, color: D.txd }}>
                  <li>“3-page one-pager on Blackwell GPU yields, SA brand.”</li>
                  <li>“Square poster: TSMC capex hits $44B, big number, sparkline.”</li>
                </ul>
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
