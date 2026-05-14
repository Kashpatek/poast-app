"use client";

// Premier Editor — pick a project, see its script sections as a timeline,
// edit caption text inline, regen b-roll per section, render. This is
// the "fully edit in the suite" answer to the user's pain point.

import React, { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { D, ft, gf, mn } from "../shared-constants";
import { TileShell, type TileProps } from "./index";
import { SAVideo } from "../../remotion/SAVideo";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const Player = dynamic(() => import("@remotion/player").then((m) => m.Player as any), { ssr: false }) as unknown as React.ComponentType<Record<string, unknown>>;

interface Project {
  id: string;
  title?: string;
  status?: string;
  data?: ProjectData;
  ts?: number;
}
interface ProjectData {
  format?: string;
  aspect?: string;
  duration?: number;
  scripts?: Script[];
  selScript?: number;
  fontFamily?: string;
  fontSize?: number;
  captionStyle?: string;
  assets?: { audioUrl?: string; musicUrl?: string };
  selectedClips?: Record<string, number>;
}
interface Script {
  hook?: string;
  intro?: string;
  body?: string[];
  outro?: string;
  broll?: Array<{ shot: number; description?: string; prompt: string; variations?: Array<{ url?: string }> }>;
}

interface Section {
  label: string;
  text: string;
  clipUrl?: string;
}

const ASPECT_DIMS: Record<string, { w: number; h: number }> = {
  "16:9": { w: 1920, h: 1080 },
  "9:16": { w: 1080, h: 1920 },
  "1:1":  { w: 1080, h: 1080 },
};

export function PremierEditorView({ onBack }: TileProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [selected, setSelected] = useState(0);
  const [rendering, setRendering] = useState(false);
  const [renderInfo, setRenderInfo] = useState<{ url?: string; error?: string } | null>(null);
  const [edits, setEdits] = useState<Record<string, { text?: string; label?: string }>>({});

  useEffect(() => {
    let cancelled = false;
    fetch("/api/db?table=projects")
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return;
        const row = (j.data || []).find((r: { id: string; type: string }) => r.type === "p2p" && r.id === "p2p-master");
        setProjects((row?.data?.projects || []).filter((p: Project) => p.data?.scripts?.length));
        setLoading(false);
      })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const project = projects.find((p) => p.id === pickedId);
  const script: Script | undefined = project?.data?.scripts?.[project.data.selScript || 0];
  const aspect = project?.data?.format || project?.data?.aspect || "16:9";
  const dims = ASPECT_DIMS[aspect] || ASPECT_DIMS["16:9"];

  // Build sections from script with edits applied.
  const sections: Section[] = !script ? [] : [
    { label: "INTRO",   text: edits["intro"]?.text  || script.intro  || "" },
    ...(script.body || []).map((b, i) => ({
      label: edits["body-" + i]?.label || ("PART " + (i + 1)),
      text:  edits["body-" + i]?.text  || b,
    })),
    { label: "OUTRO",   text: edits["outro"]?.text  || script.outro  || "" },
  ];

  const clipUrls: string[] = !script ? [] : (script.broll || []).map((b) => {
    const idx = (project?.data?.selectedClips || {})[String(b.shot)] || 0;
    return b.variations?.[idx]?.url || "";
  });

  function updateSection(key: string, patch: { text?: string; label?: string }) {
    setEdits((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }));
  }

  async function render() {
    if (!project) return;
    setRendering(true);
    setRenderInfo(null);
    try {
      const body = {
        hook: script?.hook || "",
        scriptSections: sections,
        clipUrls,
        audioUrl: project.data?.assets?.audioUrl || "",
        musicUrl: project.data?.assets?.musicUrl || "",
        duration: project.data?.duration || 60,
        fontFamily: project.data?.fontFamily,
        fontSize: project.data?.fontSize,
        captionStyle: project.data?.captionStyle || "overlay",
        dataPoints: [],
        thumbnailHeadline: project.title || "",
        aspectRatio: aspect,
        width: dims.w,
        height: dims.h,
        fps: 30,
        durationInFrames: (project.data?.duration || 60) * 30,
        composition: "SAVideo",
      };
      const res = await fetch("/api/render-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await res.json();
      if (!res.ok) setRenderInfo({ error: j.error || "Render failed" });
      else setRenderInfo({ url: j.url || j.outputUrl });
    } catch (e) {
      setRenderInfo({ error: String(e) });
    } finally {
      setRendering(false);
    }
  }

  return (
    <TileShell
      title="Premier Editor"
      badge="EDITOR"
      sub="Pick a project → edit captions inline → re-render. Live Remotion preview reflects your edits in real time."
      onBack={onBack}
    >
      {loading ? (
        <div style={{ padding: 28, color: D.txm, fontFamily: mn, fontSize: 12 }}>Loading projects…</div>
      ) : projects.length === 0 ? (
        <div style={emptyBox}>
          No produced projects yet. Run an article through Article to Video first; then come back to fine-tune.
        </div>
      ) : !pickedId ? (
        <>
          <div style={lbl}>Pick a project to edit</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 8 }}>
            {projects.map((p) => (
              <button
                type="button"
                key={p.id}
                onClick={() => setPickedId(p.id)}
                style={{
                  textAlign: "left",
                  padding: "12px 14px",
                  background: D.surface,
                  border: `1px solid ${D.border}`,
                  borderRadius: 10,
                  color: D.tx,
                  cursor: "pointer",
                  fontFamily: ft,
                }}
              >
                <div style={{ fontFamily: gf, fontSize: 14, marginBottom: 4 }}>{p.title || "Untitled"}</div>
                <div style={{ fontFamily: mn, fontSize: 10, color: D.txd, letterSpacing: 0.4 }}>
                  {(p.status || "draft").toUpperCase()} · {p.data?.format || p.data?.aspect || "16:9"} · {p.data?.duration || 60}s
                </div>
              </button>
            ))}
          </div>
        </>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
          {/* Editor side */}
          <div>
            <button
              type="button"
              onClick={() => setPickedId(null)}
              style={{ background: "transparent", border: "none", color: D.txm, fontFamily: mn, fontSize: 11, cursor: "pointer", marginBottom: 12 }}
            >
              ← All projects
            </button>
            <div style={lbl}>Sections</div>
            <div style={{ display: "flex", gap: 6, marginBottom: 16, overflowX: "auto" }}>
              {sections.map((s, i) => {
                const active = selected === i;
                return (
                  <button
                    type="button"
                    key={i}
                    onClick={() => setSelected(i)}
                    style={{
                      flexShrink: 0,
                      padding: "6px 10px",
                      background: active ? "rgba(247,176,65,0.10)" : D.surface,
                      border: `1px solid ${active ? D.amber : D.border}`,
                      borderRadius: 8,
                      color: D.tx,
                      cursor: "pointer",
                      fontFamily: mn,
                      fontSize: 10,
                      letterSpacing: 0.6,
                    }}
                  >
                    {s.label}
                  </button>
                );
              })}
            </div>

            {sections[selected] ? (
              <div>
                <div style={lbl}>Caption text</div>
                <textarea
                  value={sections[selected].text}
                  onChange={(e) => {
                    const key = selected === 0 ? "intro" : selected === sections.length - 1 ? "outro" : "body-" + (selected - 1);
                    updateSection(key, { text: e.target.value });
                  }}
                  style={{ width: "100%", minHeight: 130, padding: "10px 12px", background: "rgba(255,255,255,0.03)", border: `1px solid ${D.border}`, borderRadius: 8, color: D.tx, fontFamily: ft, fontSize: 14, outline: "none", boxSizing: "border-box", resize: "vertical", lineHeight: 1.6 }}
                />
                <div style={{ marginTop: 8, fontFamily: mn, fontSize: 10, color: D.txd, letterSpacing: 0.4 }}>
                  Edits update the live preview instantly. Hit Render to commit them to an MP4.
                </div>
              </div>
            ) : null}

            <div style={{ marginTop: 18 }}>
              <button
                type="button"
                onClick={render}
                disabled={rendering}
                style={{
                  background: D.amber,
                  color: "#060608",
                  border: "none",
                  padding: "10px 18px",
                  borderRadius: 8,
                  fontFamily: ft,
                  fontSize: 13,
                  fontWeight: 800,
                  cursor: rendering ? "wait" : "pointer",
                  opacity: rendering ? 0.6 : 1,
                }}
              >
                {rendering ? "Rendering…" : "Render MP4"}
              </button>
              {renderInfo?.error ? <div style={{ marginTop: 10, fontFamily: mn, fontSize: 11, color: D.coral }}>{renderInfo.error}</div> : null}
              {renderInfo?.url ? <a href={renderInfo.url} target="_blank" rel="noopener noreferrer" style={{ display: "block", marginTop: 10, fontFamily: mn, fontSize: 11, color: D.amber, textDecoration: "underline" }}>Download →</a> : null}
            </div>
          </div>

          {/* Live preview */}
          <div style={{ background: "#000", border: `1px solid ${D.border}`, borderRadius: 12, overflow: "hidden", aspectRatio: `${dims.w} / ${dims.h}`, alignSelf: "start" }}>
            <Player
              component={SAVideo as unknown as React.ComponentType<Record<string, unknown>>}
              durationInFrames={(project?.data?.duration || 60) * 30}
              fps={30}
              compositionWidth={dims.w}
              compositionHeight={dims.h}
              inputProps={{
                hook: script?.hook || "",
                scriptSections: sections,
                dataPoints: [],
                thumbnailHeadline: project?.title || "",
                audioUrl: project?.data?.assets?.audioUrl || "",
                clipUrls,
                musicUrl: project?.data?.assets?.musicUrl || "",
                duration: project?.data?.duration || 60,
                fontFamily: project?.data?.fontFamily,
                fontSize: project?.data?.fontSize,
                captionStyle: project?.data?.captionStyle || "overlay",
              }}
              controls
              loop
              autoPlay
              style={{ width: "100%", height: "100%" }}
            />
          </div>
        </div>
      )}
    </TileShell>
  );
}

const lbl: React.CSSProperties = {
  fontFamily: mn,
  fontSize: 10,
  letterSpacing: 1.4,
  textTransform: "uppercase",
  color: D.txd,
  marginBottom: 8,
};

const emptyBox: React.CSSProperties = {
  border: `1px dashed ${D.border}`,
  borderRadius: 12,
  padding: 28,
  background: D.surface,
  color: D.txm,
  fontFamily: ft,
  fontSize: 14,
  lineHeight: 1.5,
};
