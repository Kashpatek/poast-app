"use client";

// Data Story tile — enter one stat → live Remotion preview → render an
// animated explainer at the chosen aspect.

import React, { useState } from "react";
import dynamic from "next/dynamic";
import { D, ft, gf, mn } from "../shared-constants";
import { TileShell, type TileProps } from "./index";
import { DataStory } from "../../remotion/DataStory";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const Player = dynamic(() => import("@remotion/player").then((m) => m.Player as any), { ssr: false }) as unknown as React.ComponentType<Record<string, unknown>>;

const ASPECTS = [
  { id: "16:9", label: "Landscape", w: 1920, h: 1080 },
  { id: "9:16", label: "Vertical",  w: 1080, h: 1920 },
  { id: "1:1",  label: "Square",    w: 1080, h: 1080 },
];

export function DataStoryView({ onBack }: TileProps) {
  const [value, setValue] = useState("$44B");
  const [label, setLabel] = useState("TSMC capex 2026");
  const [source, setSource] = useState("Q1 earnings");
  const [context, setContext] = useState("First capex cut since 2022. Read the SA Q1 dossier for the full breakdown.");
  const [aspectId, setAspectId] = useState("9:16");
  const [accent, setAccent] = useState("#F7B041");
  const [rendering, setRendering] = useState(false);
  const [renderUrl, setRenderUrl] = useState<string | null>(null);

  const aspect = ASPECTS.find((a) => a.id === aspectId)!;
  const durationInFrames = 720;   // 24s @ 30fps

  async function render() {
    if (rendering) return;
    setRendering(true);
    setRenderUrl(null);
    try {
      const res = await fetch("/api/render-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          composition: "DataStory",
          inputProps: { value, label, source, context, accentColor: accent },
          width: aspect.w,
          height: aspect.h,
          fps: 30,
          durationInFrames,
        }),
      });
      const j = await res.json();
      if (!res.ok) {
        alert(j.error || "Render failed");
      } else {
        setRenderUrl(j.url || j.outputUrl || null);
      }
    } catch (e) {
      alert(String(e));
    } finally {
      setRendering(false);
    }
  }

  return (
    <TileShell
      title="Data Story"
      badge="DATA STORY"
      sub="One stat in, animated explainer out. Live preview updates as you type. Render at 16:9, 9:16, or 1:1."
      onBack={onBack}
    >
      <div style={{ display: "grid", gridTemplateColumns: "360px 1fr", gap: 18 }}>
        {/* Form */}
        <div style={{ background: D.surface, border: `1px solid ${D.border}`, borderRadius: 12, padding: 18 }}>
          <Field label="Value" value={value} onChange={setValue} placeholder="$44B" />
          <Field label="Label" value={label} onChange={setLabel} placeholder="What the number measures" />
          <Field label="Source" value={source} onChange={setSource} placeholder="Q1 earnings" />
          <Field label="Context" value={context} onChange={setContext} multi placeholder="1-2 sentences of framing" />

          <div style={lbl}>Aspect</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginBottom: 14 }}>
            {ASPECTS.map((a) => {
              const active = aspectId === a.id;
              return (
                <button
                  type="button"
                  key={a.id}
                  onClick={() => setAspectId(a.id)}
                  style={{
                    padding: "8px 10px",
                    background: active ? "rgba(247,176,65,0.10)" : "rgba(255,255,255,0.02)",
                    border: `1px solid ${active ? D.amber : D.border}`,
                    borderRadius: 8,
                    color: D.tx,
                    cursor: "pointer",
                    fontFamily: ft,
                    fontSize: 12,
                  }}
                >
                  <div>{a.label}</div>
                  <div style={{ fontFamily: mn, fontSize: 10, color: D.txd, marginTop: 2 }}>{a.id}</div>
                </button>
              );
            })}
          </div>

          <div style={lbl}>Accent</div>
          <div style={{ display: "flex", gap: 6, marginBottom: 18 }}>
            {["#F7B041", "#0B86D1", "#2EAD8E", "#E06347", "#26C9D8"].map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setAccent(c)}
                style={{
                  width: 28,
                  height: 28,
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
            onClick={render}
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
            }}
          >
            {rendering ? "Rendering…" : "Render MP4"}
          </button>
          {renderUrl ? (
            <a href={renderUrl} target="_blank" rel="noopener noreferrer" style={{ display: "block", marginTop: 12, fontFamily: mn, fontSize: 11, color: D.amber, textDecoration: "underline" }}>
              Download → {renderUrl.split("/").pop()}
            </a>
          ) : null}
        </div>

        {/* Preview */}
        <div style={{ background: "#000", border: `1px solid ${D.border}`, borderRadius: 12, overflow: "hidden", aspectRatio: `${aspect.w} / ${aspect.h}` }}>
          <Player
            component={DataStory as unknown as React.ComponentType<Record<string, unknown>>}
            durationInFrames={durationInFrames}
            fps={30}
            compositionWidth={aspect.w}
            compositionHeight={aspect.h}
            inputProps={{ value, label, source, context, accentColor: accent }}
            controls
            loop
            autoPlay
            style={{ width: "100%", height: "100%" }}
          />
        </div>
      </div>
    </TileShell>
  );
}

function Field({ label, value, onChange, placeholder, multi }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; multi?: boolean }) {
  const style: React.CSSProperties = {
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
        <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} style={style} />
      ) : (
        <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} style={style} />
      )}
    </div>
  );
}

const lbl: React.CSSProperties = {
  fontFamily: mn,
  fontSize: 10,
  letterSpacing: 1.4,
  textTransform: "uppercase",
  color: D.txd,
  marginBottom: 6,
};
