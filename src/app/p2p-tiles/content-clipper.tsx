"use client";

// Content Clipper — paste a YouTube URL or upload long-form video,
// Claude scans the transcript for clip-worthy moments, you pick which
// to render. Transcription kicks off when the user clicks "Find clips."

import React, { useState } from "react";
import { D, ft, gf, mn } from "../shared-constants";
import { TileShell, type TileProps } from "./index";

interface ClipCandidate {
  start: string;
  end: string;
  hook: string;
  caption: string;
  suggestedAspect: "16:9" | "9:16" | "1:1";
  hookScore: number;
}

export function ContentClipperView({ onBack }: TileProps) {
  const [source, setSource] = useState<"url" | "transcript">("transcript");
  const [url, setUrl] = useState("");
  const [transcript, setTranscript] = useState("");
  const [aspect, setAspect] = useState<"9:16" | "1:1" | "16:9">("9:16");
  const [scanning, setScanning] = useState(false);
  const [candidates, setCandidates] = useState<ClipCandidate[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function findClips() {
    setError(null);
    const inputText = transcript.trim();
    if (!inputText) {
      if (source === "url") setError("Live URL transcription is wired into /api/press-to-premier/clipper — paste a transcript here as a workaround while that lands.");
      else setError("Paste a transcript first.");
      return;
    }
    setScanning(true);
    setCandidates([]);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system: "You find clip-worthy moments in transcripts. Output ONLY JSON, no preamble.",
          prompt:
            "Scan this transcript and pick 5-10 standout 10-30s moments that would work as standalone shorts at " + aspect + " aspect. " +
            "For each, return: start (MM:SS or HH:MM:SS), end, a punchy 6-word HOOK, a 1-sentence CAPTION, suggestedAspect (16:9|9:16|1:1), hookScore (1-10). " +
            "Prefer self-contained ideas with a clear payoff. Skip filler, intros, sponsor reads.\n\n" +
            "Transcript (first 20000 chars):\n" + inputText.slice(0, 20000) + "\n\n" +
            "Return JSON: { \"clips\": [{ \"start\": \"02:14\", \"end\": \"02:42\", \"hook\": \"...\", \"caption\": \"...\", \"suggestedAspect\": \"9:16\", \"hookScore\": 8 }] }",
        }),
      });
      const j = await res.json() as { content?: Array<{ text?: string }> };
      const txt = (j.content || []).map((c) => c.text || "").join("");
      const parsed = JSON.parse(txt.replace(/```[a-z]*|```/g, "").trim());
      setCandidates(parsed.clips || []);
    } catch (e) {
      setError("Couldn't find clips: " + String(e).slice(0, 80));
    } finally {
      setScanning(false);
    }
  }

  return (
    <TileShell
      title="Content Clipper"
      badge="CLIPPER"
      sub="Long-form video in → multiple shorts out. Claude scans the transcript for the moments most likely to land as standalone shorts."
      onBack={onBack}
    >
      {/* Source toggle */}
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        {(["transcript", "url"] as const).map((s) => {
          const active = source === s;
          return (
            <button
              key={s}
              type="button"
              onClick={() => setSource(s)}
              style={{
                padding: "8px 14px",
                background: active ? D.amber : "transparent",
                color: active ? "#060608" : D.tx,
                border: `1px solid ${active ? D.amber : D.border}`,
                borderRadius: 8,
                fontFamily: ft,
                fontSize: 13,
                fontWeight: active ? 800 : 500,
                cursor: "pointer",
              }}
            >
              {s === "transcript" ? "Paste transcript" : "Paste URL"}
            </button>
          );
        })}
      </div>

      {source === "url" ? (
        <div style={{ marginBottom: 14 }}>
          <div style={lbl}>YouTube URL (transcription on the way)</div>
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://youtube.com/watch?v=..."
            style={inputStyle}
          />
          <div style={{ marginTop: 8, fontFamily: mn, fontSize: 10, color: D.txd, letterSpacing: 0.4 }}>
            Live URL transcription ships in a follow-up. For now: paste the transcript on the other tab.
          </div>
        </div>
      ) : (
        <div style={{ marginBottom: 14 }}>
          <div style={lbl}>Transcript</div>
          <textarea
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            placeholder="Paste the full transcript (with timestamps if you have them)…"
            style={{ ...inputStyle, minHeight: 200, resize: "vertical" }}
          />
        </div>
      )}

      <div style={lbl}>Target aspect for shorts</div>
      <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
        {(["9:16", "1:1", "16:9"] as const).map((a) => {
          const active = aspect === a;
          return (
            <button
              key={a}
              type="button"
              onClick={() => setAspect(a)}
              style={{
                padding: "8px 14px",
                background: active ? "rgba(247,176,65,0.10)" : "transparent",
                color: D.tx,
                border: `1px solid ${active ? D.amber : D.border}`,
                borderRadius: 8,
                fontFamily: mn,
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              {a}
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={findClips}
        disabled={scanning}
        style={{
          background: D.amber,
          color: "#060608",
          border: "none",
          padding: "10px 18px",
          borderRadius: 8,
          fontFamily: ft,
          fontSize: 13,
          fontWeight: 800,
          cursor: scanning ? "wait" : "pointer",
          opacity: scanning ? 0.6 : 1,
        }}
      >
        {scanning ? "Scanning for clip moments…" : "Find clips"}
      </button>
      {error ? <div style={{ marginTop: 12, fontFamily: mn, fontSize: 11, color: D.coral }}>{error}</div> : null}

      {candidates.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <div style={lbl}>Candidates</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {candidates.map((c, i) => (
              <div key={i} style={{ background: D.surface, border: `1px solid ${D.border}`, borderRadius: 10, padding: "12px 14px" }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 4 }}>
                  <div style={{ fontFamily: mn, fontSize: 11, color: D.amber, letterSpacing: 0.6 }}>{c.start} → {c.end}</div>
                  <div style={{ fontFamily: mn, fontSize: 10, color: D.txd }}>{c.suggestedAspect}</div>
                  <div style={{ marginLeft: "auto", fontFamily: mn, fontSize: 10, color: D.txd }}>score {c.hookScore}/10</div>
                </div>
                <div style={{ fontFamily: gf, fontSize: 15, color: D.tx, marginBottom: 4 }}>{c.hook}</div>
                <div style={{ fontFamily: ft, fontSize: 12, color: D.txm, lineHeight: 1.5 }}>{c.caption}</div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 14, fontFamily: mn, fontSize: 10, color: D.txd, letterSpacing: 0.4 }}>
            Auto-cut + caption-burn render lands next. The candidate picker + scoring is wired so you can see what would be produced.
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

const inputStyle: React.CSSProperties = {
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
};
