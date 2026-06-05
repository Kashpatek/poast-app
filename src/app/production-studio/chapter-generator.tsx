"use client";

// Chapter Generator — paste a podcast transcript + optional episode
// duration, get YouTube chapter timestamps and titles back. The output
// renders as a monospace block ready to drop into a YouTube description.

import React, { useState, useRef } from "react";
import { D, ft, gf, mn, copyText, getSurfaceProvider, getPreferredProvider } from "../shared-constants";
import { ProviderChips } from "../provider-chips";
import { useStore } from "../lib/store";
import { showToast } from "../toast-context";
import { SendToChip } from "../components/send-to-chip";

interface Chapter {
  timestamp: string;
  title: string;
}

const SURFACE = "chapter-generator";

function parseDurationInput(s: string): number | undefined {
  const t = (s || "").trim();
  if (!t) return undefined;
  // Accept mm:ss, m:ss, or h:mm:ss.
  const m3 = t.match(/^(\d{1,2}):(\d{1,2}):(\d{1,2})$/);
  if (m3) {
    const h = parseInt(m3[1], 10);
    const mm = parseInt(m3[2], 10);
    const ss = parseInt(m3[3], 10);
    if (mm > 59 || ss > 59) return undefined;
    return h * 3600 + mm * 60 + ss;
  }
  const m2 = t.match(/^(\d{1,3}):(\d{1,2})$/);
  if (m2) {
    const mm = parseInt(m2[1], 10);
    const ss = parseInt(m2[2], 10);
    if (ss > 59) return undefined;
    return mm * 60 + ss;
  }
  return undefined;
}

export default function ChapterGenerator() {
  const [text, setText] = useState("");
  const [duration, setDuration] = useState("");
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);
  const pushOutput = useStore((s) => s.pushOutput);
  const outRef = useRef<HTMLDivElement | null>(null);

  function resolveProvider() {
    const override = getSurfaceProvider(SURFACE);
    return override || getPreferredProvider();
  }

  async function run() {
    if (!text.trim()) return;
    const durationSec = parseDurationInput(duration);
    if (duration.trim() && durationSec === undefined) {
      setError("Duration must look like mm:ss or h:mm:ss (e.g. 58:21)");
      return;
    }
    setLoading(true);
    setError(null);
    setChapters([]);
    setCopiedAll(false);
    const provider = resolveProvider();
    try {
      const res = await fetch("/api/chapter-generator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: text.trim(),
          durationSec,
          provider,
        }),
      });
      const j = await res.json();
      if (!res.ok) {
        setError(j.error || "Chapter generation failed");
        return;
      }
      const list = Array.isArray(j.chapters) ? (j.chapters as Chapter[]) : [];
      setChapters(list);
      if (list.length > 0) {
        const formatted = list.map((c) => `${c.timestamp} ${c.title}`).join("\n");
        pushOutput({
          sourceTool: "chapter-generator",
          kind: "other",
          payload: { chapters: list, formatted },
          preview: `${list.length} chapters · starts "${list[0]?.title || ""}"`,
          provider,
        });
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  function formattedBlock(): string {
    return chapters.map((c) => `${c.timestamp} ${c.title}`).join("\n");
  }

  function copyAll() {
    if (chapters.length === 0) return;
    const ok = copyText(formattedBlock());
    if (ok) {
      setCopiedAll(true);
      showToast(`Copied ${chapters.length} chapters`);
      setTimeout(() => setCopiedAll(false), 1500);
    }
  }

  function copyOne(c: Chapter) {
    const ok = copyText(`${c.timestamp} ${c.title}`);
    if (ok) showToast("Copied");
  }

  return (
    <div style={{ maxWidth: 1180, margin: "0 auto", padding: "40px 32px 64px" }}>
      <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "4px 10px", borderRadius: 999, background: "rgba(224,99,71,0.10)", border: `1px solid ${D.coral}55`, marginBottom: 14 }}>
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: D.coral, boxShadow: `0 0 8px ${D.coral}` }} />
        <span style={{ fontFamily: mn, fontSize: 10, letterSpacing: 1.4, color: D.coral, textTransform: "uppercase" }}>Production Studio</span>
      </div>
      <h1 style={{ fontFamily: gf, fontSize: 38, fontWeight: 900, letterSpacing: -1, margin: 0, marginBottom: 8, color: D.tx }}>
        Chapter Generator
      </h1>
      <div style={{ fontFamily: ft, fontSize: 15, color: D.txm, maxWidth: 720, lineHeight: 1.5, marginBottom: 28 }}>
        Paste a transcript. We hand back 6–10 YouTube chapter markers in the format YouTube actually expects — timestamps + factual headers, drop straight into a description.
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 18, marginBottom: 18 }}>
        <div>
          <div style={lbl}>Transcript</div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Paste the full transcript (or close-captions copy). 5–60k characters works best."
            style={{ ...inputStyle, minHeight: 260, resize: "vertical", fontFamily: mn, fontSize: 12, lineHeight: 1.5 }}
          />
          <div style={{ fontFamily: mn, fontSize: 10, color: D.txd, marginTop: 4, letterSpacing: 0.4 }}>
            {text.length.toLocaleString()} chars
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "minmax(200px, 240px) 1fr auto", gap: 14, alignItems: "end" }}>
          <div>
            <div style={lbl}>Episode duration (optional)</div>
            <input
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              placeholder="58:21"
              style={inputStyle}
            />
            <div style={{ fontFamily: mn, fontSize: 10, color: D.txd, marginTop: 4, letterSpacing: 0.4 }}>
              mm:ss · leave blank to let the model estimate
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <ProviderChips surface={SURFACE} label="Model" />
          </div>

          <button
            type="button"
            onClick={run}
            disabled={loading || !text.trim()}
            style={{
              background: D.amber,
              color: "#060608",
              border: "none",
              padding: "12px 22px",
              borderRadius: 8,
              fontFamily: ft,
              fontSize: 13,
              fontWeight: 800,
              cursor: loading || !text.trim() ? "not-allowed" : "pointer",
              opacity: loading || !text.trim() ? 0.5 : 1,
              minWidth: 180,
            }}
          >
            {loading ? "Generating…" : "Generate chapters"}
          </button>
        </div>
      </div>

      {error ? (
        <div style={errorBox}>{error}</div>
      ) : null}

      {chapters.length > 0 ? (
        <div ref={outRef} style={{ marginTop: 8 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <div style={lbl}>YouTube chapters</div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <SendToChip
                text={formattedBlock()}
                sourceTool="chapter-generator"
                kind="other"
              />
              <button
                type="button"
                onClick={copyAll}
                style={{
                  background: copiedAll ? D.teal : "transparent",
                  color: copiedAll ? "#06060A" : D.tx,
                  border: `1px solid ${copiedAll ? D.teal : D.border}`,
                  padding: "7px 14px",
                  borderRadius: 7,
                  fontFamily: mn,
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: "pointer",
                  letterSpacing: 0.4,
                }}
              >
                {copiedAll ? "Copied" : "Copy YouTube format"}
              </button>
            </div>
          </div>
          <div
            style={{
              background: D.surface,
              border: `1px solid ${D.border}`,
              borderRadius: 10,
              padding: "14px 16px",
              fontFamily: mn,
              fontSize: 13,
              lineHeight: 1.7,
              color: D.tx,
              whiteSpace: "pre",
              overflowX: "auto",
            }}
          >
            {chapters.map((c, i) => (
              <div
                key={`${c.timestamp}-${i}`}
                onClick={() => copyOne(c)}
                style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(70px, auto) 1fr",
                  gap: 14,
                  alignItems: "baseline",
                  padding: "2px 6px",
                  borderRadius: 4,
                  cursor: "pointer",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(247,176,65,0.06)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                title="Click to copy this line"
              >
                <span style={{ color: D.amber, fontWeight: 700 }}>{c.timestamp}</span>
                <span style={{ color: D.tx }}>{c.title}</span>
              </div>
            ))}
          </div>
          <div style={{ fontFamily: mn, fontSize: 10, color: D.txd, marginTop: 8, letterSpacing: 0.4 }}>
            Paste these into the YouTube description box. YouTube auto-detects chapters when the first timestamp is 0:00 and at least three markers are present.
          </div>
        </div>
      ) : null}
    </div>
  );
}

const lbl: React.CSSProperties = {
  fontFamily: mn,
  fontSize: 10,
  letterSpacing: 1.2,
  textTransform: "uppercase",
  color: D.txm,
  marginBottom: 6,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: D.surface,
  border: `1px solid ${D.border}`,
  borderRadius: 8,
  color: D.tx,
  fontFamily: ft,
  fontSize: 14,
  padding: "10px 12px",
  outline: "none",
  boxSizing: "border-box",
};

const errorBox: React.CSSProperties = {
  background: "rgba(209,51,74,0.08)",
  border: `1px solid ${D.crimson}55`,
  borderRadius: 8,
  padding: "10px 14px",
  fontFamily: mn,
  fontSize: 12,
  color: D.crimson,
  marginBottom: 16,
};
