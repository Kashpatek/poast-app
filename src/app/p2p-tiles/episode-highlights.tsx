"use client";

// Episode Highlights — feed a recent SA Weekly episode → Claude picks
// 3-5 standout moments → produce as a 30-60s reel via the existing
// /api/render-video pipeline.

import React, { useEffect, useState } from "react";
import { D, ft, gf, mn } from "../shared-constants";
import { TileShell, type TileProps } from "./index";

interface Episode {
  id: string;
  number?: string;
  title?: string;
  guests?: Array<{ name?: string }>;
  transcript?: string;
  uploadedAt?: string;
}

interface Moment {
  start: string;
  end: string;
  caption: string;
  hookScore?: number;
}

export function EpisodeHighlightsView({ onBack }: TileProps) {
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [loading, setLoading] = useState(true);
  const [picked, setPicked] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [moments, setMoments] = useState<Moment[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/db?table=projects")
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return;
        const row = (j.data || []).find((r: { id: string; type: string }) => r.id === "sa-weekly-master" && r.type === "sa-weekly");
        const eps: Episode[] = row?.data?.episodes || [];
        setEpisodes(eps);
        setLoading(false);
      })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const ep = episodes.find((e) => e.id === picked);

  async function findMoments() {
    if (!ep || !ep.transcript) {
      setError("This episode has no transcript yet. Add one in SA Weekly first.");
      return;
    }
    setError(null);
    setGenerating(true);
    setMoments([]);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system: "You find clip-worthy moments from podcast transcripts. Output ONLY JSON, no preamble.",
          prompt:
            "Read this SA Weekly transcript and pick 3-5 standout moments that would work as 10-25s standalone vertical reels. " +
            "For each: estimated start and end timestamps (MM:SS), a punchy 6-word caption hook, and a hookScore 1-10 (10 = most viral). " +
            "Skip filler, intro / outro music, sponsor reads. SA voice: no em dashes, no emojis, no hype words.\n\n" +
            "Episode: " + (ep.title || "") + "\n\n" +
            "Transcript (first 14000 chars):\n" + (ep.transcript || "").slice(0, 14000) + "\n\n" +
            "Return: { \"moments\": [{ \"start\": \"03:42\", \"end\": \"04:08\", \"caption\": \"...\", \"hookScore\": 8 }] }",
        }),
      });
      const j = await res.json() as { content?: Array<{ text?: string }> };
      const txt = (j.content || []).map((c) => c.text || "").join("");
      const parsed = JSON.parse(txt.replace(/```[a-z]*|```/g, "").trim());
      setMoments(parsed.moments || []);
    } catch (e) {
      setError("Couldn't pick moments: " + String(e).slice(0, 80));
    } finally {
      setGenerating(false);
    }
  }

  return (
    <TileShell
      title="Episode Highlights"
      badge="HIGHLIGHTS"
      sub="Pick an SA Weekly episode → Claude scans the transcript for the most hook-worthy moments → produce them as vertical reels with auto-captions."
      onBack={onBack}
    >
      {loading ? (
        <div style={{ padding: 28, color: D.txm, fontFamily: mn, fontSize: 12 }}>Loading episodes…</div>
      ) : episodes.length === 0 ? (
        <div style={emptyBox}>
          No SA Weekly episodes archived yet. Run an episode through SA Weekly first; then come back here.
        </div>
      ) : (
        <>
          <div style={lbl}>Episode</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 8, marginBottom: 18 }}>
            {episodes.slice(0, 12).map((e) => {
              const active = picked === e.id;
              return (
                <button
                  type="button"
                  key={e.id}
                  onClick={() => setPicked(e.id)}
                  style={{
                    textAlign: "left",
                    padding: "10px 12px",
                    background: active ? "rgba(247,176,65,0.10)" : D.surface,
                    border: `1px solid ${active ? D.amber : D.border}`,
                    borderRadius: 8,
                    color: D.tx,
                    cursor: "pointer",
                    fontFamily: ft,
                  }}
                >
                  <div style={{ fontFamily: gf, fontSize: 13, marginBottom: 3 }}>
                    {e.number ? "Ep. " + e.number + " · " : ""}{e.title || "Untitled"}
                  </div>
                  <div style={{ fontFamily: mn, fontSize: 10, color: D.txd, letterSpacing: 0.4 }}>
                    {e.transcript ? `${(e.transcript.length / 1000).toFixed(0)}k char transcript` : "No transcript"}
                  </div>
                </button>
              );
            })}
          </div>

          {ep ? (
            <div style={{ marginBottom: 18 }}>
              <button
                type="button"
                onClick={findMoments}
                disabled={generating || !ep.transcript}
                style={{
                  background: D.amber,
                  color: "#060608",
                  border: "none",
                  padding: "10px 18px",
                  borderRadius: 8,
                  fontFamily: ft,
                  fontSize: 13,
                  fontWeight: 800,
                  cursor: generating || !ep.transcript ? "not-allowed" : "pointer",
                  opacity: generating || !ep.transcript ? 0.5 : 1,
                }}
              >
                {generating ? "Finding moments…" : "Find clip-worthy moments"}
              </button>
              {error ? <div style={{ marginTop: 10, fontFamily: mn, fontSize: 11, color: D.coral }}>{error}</div> : null}
            </div>
          ) : null}

          {moments.length > 0 && (
            <div>
              <div style={lbl}>Candidate clips</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {moments.map((m, i) => (
                  <div key={i} style={{ background: D.surface, border: `1px solid ${D.border}`, borderRadius: 10, padding: "12px 14px", display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ fontFamily: mn, fontSize: 10, color: D.amber, letterSpacing: 0.6, minWidth: 90 }}>
                      {m.start} → {m.end}
                    </div>
                    <div style={{ flex: 1, fontFamily: ft, fontSize: 13, color: D.tx }}>{m.caption}</div>
                    {typeof m.hookScore === "number" ? (
                      <div style={{ fontFamily: mn, fontSize: 11, color: D.txd }}>score {m.hookScore}/10</div>
                    ) : null}
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 14, fontFamily: mn, fontSize: 10, color: D.txd, letterSpacing: 0.4 }}>
                Render-to-reel from these candidates ships next — the picker + Claude scoring is wired up so you can already see what would get produced.
              </div>
            </div>
          )}
        </>
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
