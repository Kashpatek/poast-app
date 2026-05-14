"use client";

// Programmatic editor — Remotion Player with a live form that drives
// inputProps. Pick a composition (Quote Card / Audiogram / Episode
// Trailer), tweak the fields, watch the preview update in real time,
// click Render to fire the existing /api/render-video pipeline.

import React, { use, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { D, ft, gf, mn } from "../../../shared-constants";
import { useToast } from "../../../toast-context";
import { QuoteCard } from "../../../../remotion/QuoteCard";
import { Audiogram } from "../../../../remotion/Audiogram";
import { EpisodeTrailer } from "../../../../remotion/EpisodeTrailer";

// Player is heavy + uses DOM; load lazily, no SSR.
const Player = dynamic(
  () => import("@remotion/player").then((m) => m.Player as unknown as React.ComponentType<Record<string, unknown>>),
  { ssr: false }
) as unknown as React.ComponentType<Record<string, unknown>>;

type CompId = "quote-card" | "audiogram" | "episode-trailer";

interface CompositionMeta {
  id: CompId;
  label: string;
  durationInFrames: number;
  fps: number;
  width: number;
  height: number;
}

const COMPS: Record<CompId, CompositionMeta> = {
  "quote-card":      { id: "quote-card",      label: "Quote card",      durationInFrames: 150, fps: 30, width: 1920, height: 1080 },
  "audiogram":       { id: "audiogram",       label: "Audiogram",       durationInFrames: 300, fps: 30, width: 1080, height: 1080 },
  "episode-trailer": { id: "episode-trailer", label: "Episode trailer", durationInFrames: 900, fps: 30, width: 1920, height: 1080 },
};

interface ProjectRow {
  id: string;
  name: string;
  type: string;
  brief?: { title?: string; subtitle?: string; context?: string; keyPoints?: string[]; tone?: string };
}

interface PageProps { params: Promise<{ id: string }> }

export default function ProgrammaticPage({ params }: PageProps) {
  const { id } = use(params);
  const { showToast } = useToast();
  const [project, setProject] = useState<ProjectRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [compId, setCompId] = useState<CompId>("quote-card");

  // Form state — varies by composition.
  const [quote, setQuote] = useState("");
  const [attribution, setAttribution] = useState("");
  const [source, setSource] = useState("");
  const [accent, setAccent] = useState("#F7B041");
  const [audioUrl, setAudioUrl] = useState("");
  const [audiogramTitle, setAudiogramTitle] = useState("");
  const [episodeNumber, setEpisodeNumber] = useState("");
  const [trailerTitle, setTrailerTitle] = useState("");
  const [guest, setGuest] = useState("");
  const [hooks, setHooks] = useState<string>("");

  const [rendering, setRendering] = useState(false);
  const [renderUrl, setRenderUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(`/api/docu-design/projects?id=${encodeURIComponent(id)}`);
        const j = await res.json();
        if (!res.ok) {
          setError(j.error || "Failed to load");
          return;
        }
        if (cancelled) return;
        const p = j.data as ProjectRow;
        setProject(p);
        if (p.brief?.title) {
          setQuote(p.brief.title);
          setTrailerTitle(p.brief.title);
          setAudiogramTitle(p.brief.title);
        }
        if (p.brief?.subtitle) setAttribution(p.brief.subtitle);
        if (p.brief?.context) setSource(p.brief.context);
        if (p.brief?.keyPoints?.length) setHooks(p.brief.keyPoints.join("\n"));
      } catch (e) {
        if (!cancelled) setError(String(e));
      }
    }
    load();
    return () => { cancelled = true; };
  }, [id]);

  const comp = COMPS[compId];

  // Build inputProps for the chosen composition.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let component: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let inputProps: any;
  if (compId === "quote-card") {
    component = QuoteCard;
    inputProps = { quote: quote || "Add a quote…", attribution: attribution || "Attribution", source: source || undefined, accentColor: accent };
  } else if (compId === "audiogram") {
    component = Audiogram;
    inputProps = { title: audiogramTitle || "Episode title", attribution: attribution || "SemiAnalysis", audioUrl, accentColor: accent };
  } else {
    component = EpisodeTrailer;
    inputProps = {
      episodeNumber: episodeNumber || "00",
      title: trailerTitle || "Title",
      guest: guest || "Guest name",
      hooks: hooks.split("\n").map((s) => s.trim()).filter(Boolean),
      accentColor: accent,
    };
  }

  async function fireRender() {
    if (rendering) return;
    setRendering(true);
    setRenderUrl(null);
    try {
      const res = await fetch("/api/render-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          composition: compId,
          inputProps,
          width: comp.width,
          height: comp.height,
          fps: comp.fps,
          durationInFrames: comp.durationInFrames,
        }),
      });
      const j = await res.json();
      if (!res.ok) {
        showToast(j.error || "Render failed");
        return;
      }
      setRenderUrl(j.url || j.outputUrl || null);
      if (!j.url && !j.outputUrl) {
        showToast("Render queued — file not returned. Check the existing video pipeline.");
      }
    } catch (e) {
      showToast(String(e));
    } finally {
      setRendering(false);
    }
  }

  if (error) {
    return <div style={{ padding: 32, color: D.coral, fontFamily: ft }}>{error}</div>;
  }
  if (!project) {
    return <div style={{ padding: 32, color: D.txm, fontFamily: mn, fontSize: 12 }}>Loading…</div>;
  }

  return (
    <div style={{ minHeight: "100vh", background: D.bg, color: D.tx, fontFamily: ft }}>
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
        <div style={{ fontFamily: gf, fontSize: 16, color: D.tx }}>{project.name}</div>
        <span style={{ fontFamily: mn, fontSize: 10, letterSpacing: 1.4, color: D.amber, marginLeft: 6 }}>PROGRAMMATIC</span>
      </header>

      <div style={{ display: "grid", gridTemplateColumns: "380px 1fr", gap: 0, height: "calc(100vh - 56px)" }}>
        {/* Sidebar */}
        <aside style={{ borderRight: `1px solid ${D.border}`, padding: 18, overflowY: "auto", background: D.card }}>
          <div style={lbl}>Composition</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 6, marginBottom: 16 }}>
            {(Object.values(COMPS) as CompositionMeta[]).map((c) => {
              const active = c.id === compId;
              return (
                <button
                  type="button"
                  key={c.id}
                  onClick={() => setCompId(c.id)}
                  style={{
                    textAlign: "left",
                    padding: "8px 10px",
                    background: active ? "rgba(247,176,65,0.10)" : "rgba(255,255,255,0.02)",
                    border: `1px solid ${active ? D.amber : D.border}`,
                    borderRadius: 8,
                    color: D.tx,
                    cursor: "pointer",
                    fontFamily: ft,
                    fontSize: 13,
                  }}
                >
                  {c.label}
                  <span style={{ marginLeft: 8, color: D.txd, fontFamily: mn, fontSize: 10 }}>
                    {c.width}×{c.height} · {Math.round(c.durationInFrames / c.fps)}s
                  </span>
                </button>
              );
            })}
          </div>

          {compId === "quote-card" ? (
            <>
              <Field label="Quote" value={quote} onChange={setQuote} multi />
              <Field label="Attribution" value={attribution} onChange={setAttribution} />
              <Field label="Source (optional)" value={source} onChange={setSource} />
            </>
          ) : null}

          {compId === "audiogram" ? (
            <>
              <Field label="Title" value={audiogramTitle} onChange={setAudiogramTitle} />
              <Field label="Attribution" value={attribution} onChange={setAttribution} />
              <Field label="Audio URL (optional)" value={audioUrl} onChange={setAudioUrl} />
            </>
          ) : null}

          {compId === "episode-trailer" ? (
            <>
              <Field label="Episode #" value={episodeNumber} onChange={setEpisodeNumber} />
              <Field label="Title" value={trailerTitle} onChange={setTrailerTitle} />
              <Field label="Guest" value={guest} onChange={setGuest} />
              <Field label="Hooks · one per line" value={hooks} onChange={setHooks} multi />
            </>
          ) : null}

          <div style={lbl}>Accent color</div>
          <div style={{ display: "flex", gap: 6, marginBottom: 18, flexWrap: "wrap" }}>
            {["#F7B041", "#0B86D1", "#2EAD8E", "#E06347", "#26C9D8"].map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setAccent(c)}
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 6,
                  background: c,
                  border: accent === c ? `2px solid ${D.tx}` : `1px solid ${D.border}`,
                  cursor: "pointer",
                }}
              />
            ))}
          </div>

          <button
            type="button"
            onClick={fireRender}
            disabled={rendering}
            style={{
              width: "100%",
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
              letterSpacing: 0.3,
            }}
          >
            {rendering ? "Rendering…" : "Render MP4"}
          </button>

          {renderUrl ? (
            <a href={renderUrl} target="_blank" rel="noopener noreferrer" style={{ display: "block", marginTop: 12, fontFamily: mn, fontSize: 11, color: D.amber, textDecoration: "underline", letterSpacing: 0.6 }}>
              Download rendered file →
            </a>
          ) : null}
          <div style={{ marginTop: 12, fontFamily: mn, fontSize: 10, color: D.txd, letterSpacing: 0.4 }}>
            Renders run through the existing /api/render-video pipeline.
          </div>
        </aside>

        {/* Preview */}
        <main style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 28, overflow: "auto" }}>
          <div style={{ width: "min(100%, 880px)", aspectRatio: `${comp.width} / ${comp.height}`, background: "#000", borderRadius: 8, overflow: "hidden", border: `1px solid ${D.border}` }}>
            <Player
              component={component}
              durationInFrames={comp.durationInFrames}
              fps={comp.fps}
              compositionWidth={comp.width}
              compositionHeight={comp.height}
              inputProps={inputProps}
              controls
              loop
              autoPlay
              style={{ width: "100%", height: "100%" }}
            />
          </div>
        </main>
      </div>
    </div>
  );
}

const lbl: React.CSSProperties = {
  fontFamily: mn,
  fontSize: 10,
  letterSpacing: 1.6,
  textTransform: "uppercase",
  color: D.txd,
  marginBottom: 6,
};

function Field({ label, value, onChange, multi }: { label: string; value: string; onChange: (v: string) => void; multi?: boolean }) {
  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "8px 10px",
    background: "rgba(255,255,255,0.03)",
    border: `1px solid ${D.border}`,
    borderRadius: 6,
    color: D.tx,
    fontFamily: ft,
    fontSize: 13,
    outline: "none",
    boxSizing: "border-box",
    marginBottom: 12,
    ...(multi ? { minHeight: 70, resize: "vertical" as const } : {}),
  };
  return (
    <div>
      <div style={lbl}>{label}</div>
      {multi ? (
        <textarea value={value} onChange={(e) => onChange(e.target.value)} style={inputStyle} />
      ) : (
        <input type="text" value={value} onChange={(e) => onChange(e.target.value)} style={inputStyle} />
      )}
    </div>
  );
}
