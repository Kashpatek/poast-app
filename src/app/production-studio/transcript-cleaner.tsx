"use client";

// Transcript Cleaner — paste a raw transcript (.txt or .srt), get an
// AI-cleaned version with filler words removed and SA proper nouns
// re-capitalized. Below the cleaned output: a diff vs the original
// (deletions struck through in coral, insertions teal-underlined,
// same pattern as Voice Scorer), .txt / .srt export buttons, and a
// list of detected clip moments each individually routable to the
// Brief Builder via SendToChip.

import React, { useMemo, useRef, useState } from "react";
import DiffMatchPatch from "diff-match-patch";
import { D, ft, gf, mn, copyText } from "../shared-constants";
import { useShortcuts } from "../keyboard-shortcuts";
import { showToast } from "../toast-context";
import { SendToChip } from "../components/send-to-chip";

interface ClipMoment {
  line: string;
  reason: string;
}

interface CleanedResponse {
  cleaned: string;
  clipMoments?: ClipMoment[];
  provider?: string;
}

export default function TranscriptCleaner() {
  const [raw, setRaw] = useState("");
  const [cleaned, setCleaned] = useState("");
  const [clipMoments, setClipMoments] = useState<ClipMoment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function clean() {
    if (!raw.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/transcript-cleaner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: raw.trim() }),
      });
      const j = (await res.json()) as CleanedResponse & { error?: string };
      if (!res.ok) {
        setError(j.error || "Clean failed");
        setCleaned("");
        setClipMoments([]);
        return;
      }
      setCleaned(j.cleaned || "");
      setClipMoments(Array.isArray(j.clipMoments) ? j.clipMoments : []);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  const cleanRef = useRef<(() => void) | undefined>(undefined);
  cleanRef.current = () => { clean(); };
  useShortcuts({
    "$mod+Enter": { description: "Clean transcript", handler: () => { if (cleanRef.current) cleanRef.current(); } },
  }, { scope: "Transcript Cleaner" });

  const diffSegments = useMemo(() => {
    if (!cleaned || !raw.trim()) return null;
    const dmp = new DiffMatchPatch.diff_match_patch();
    const diffs = dmp.diff_main(raw, cleaned);
    dmp.diff_cleanupSemantic(diffs);
    return diffs;
  }, [raw, cleaned]);

  function downloadFile(filename: string, contents: string, mime: string) {
    const blob = new Blob([contents], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function exportTxt() {
    if (!cleaned) return;
    downloadFile("transcript-cleaned.txt", cleaned, "text/plain;charset=utf-8");
    showToast("Exported .txt", "success");
  }

  function exportSrt() {
    if (!cleaned) return;
    // If cleaned content already looks like .srt (cues + timing), pass
    // through; otherwise wrap each non-empty line as a one-cue block so
    // the user still gets a valid .srt skeleton.
    const looksLikeSrt = /\d{2}:\d{2}:\d{2},\d{3}\s+-->\s+\d{2}:\d{2}:\d{2},\d{3}/.test(cleaned);
    let payload = cleaned;
    if (!looksLikeSrt) {
      const lines = cleaned.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
      const pad = (n: number) => String(n).padStart(2, "0");
      const stamp = (sec: number) => {
        const h = Math.floor(sec / 3600);
        const m = Math.floor((sec % 3600) / 60);
        const s = sec % 60;
        return pad(h) + ":" + pad(m) + ":" + pad(s) + ",000";
      };
      payload = lines
        .map((line, i) => {
          const start = i * 3;
          const end = start + 3;
          return (i + 1) + "\n" + stamp(start) + " --> " + stamp(end) + "\n" + line + "\n";
        })
        .join("\n");
    }
    downloadFile("transcript-cleaned.srt", payload, "application/x-subrip;charset=utf-8");
    showToast("Exported .srt", "success");
  }

  return (
    <div style={{ maxWidth: 1240, margin: "0 auto", padding: "40px 32px" }}>
      <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "4px 10px", borderRadius: 999, background: "rgba(46,173,142,0.10)", border: `1px solid ${D.teal}55`, marginBottom: 14 }}>
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: D.teal, boxShadow: `0 0 8px ${D.teal}` }} />
        <span style={{ fontFamily: mn, fontSize: 10, letterSpacing: 1.4, color: D.teal, textTransform: "uppercase" }}>Post-production</span>
      </div>
      <h1 style={{ fontFamily: gf, fontSize: 38, fontWeight: 900, letterSpacing: -1, margin: 0, marginBottom: 8, color: D.tx }}>Transcript Cleaner</h1>
      <div style={{ fontFamily: ft, fontSize: 15, color: D.txm, maxWidth: 760, lineHeight: 1.5, marginBottom: 28 }}>
        Paste a transcript (.txt or .srt). AI strips filler words, fixes SA proper nouns (TSMC, HBM3E, Blackwell, Sapphire Rapids…), and surfaces punchy clip moments. Cmd/Ctrl+Enter to run.
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
        {/* Raw input */}
        <div>
          <div style={lbl}>Raw transcript</div>
          <textarea
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            placeholder="Paste raw .txt or .srt content here…"
            style={paneStyle}
          />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
            <div style={{ fontFamily: mn, fontSize: 10, color: D.txd, letterSpacing: 0.4 }}>
              {raw.length.toLocaleString()} chars
            </div>
            <button
              type="button"
              onClick={clean}
              disabled={loading || !raw.trim()}
              style={{
                background: D.amber,
                color: "#060608",
                border: "none",
                padding: "10px 22px",
                borderRadius: 8,
                fontFamily: ft,
                fontSize: 13,
                fontWeight: 800,
                cursor: loading || !raw.trim() ? "not-allowed" : "pointer",
                opacity: loading || !raw.trim() ? 0.5 : 1,
              }}
            >
              {loading ? "Cleaning…" : "Clean"}
            </button>
          </div>
          {error ? <div style={{ marginTop: 12, fontFamily: mn, fontSize: 11, color: D.coral }}>{error}</div> : null}
        </div>

        {/* Cleaned output */}
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <div style={{ ...lbl, marginBottom: 0 }}>Cleaned transcript</div>
            {cleaned ? (
              <span
                role="button"
                onClick={() => {
                  if (copyText(cleaned)) showToast("Copied cleaned transcript.", "success");
                }}
                style={{ fontFamily: mn, fontSize: 9, color: D.txm, cursor: "pointer", padding: "3px 8px", borderRadius: 6, border: `1px solid ${D.border}` }}
              >Copy</span>
            ) : null}
          </div>
          <textarea
            value={cleaned}
            readOnly
            placeholder={loading ? "Cleaning…" : "Cleaned transcript appears here."}
            style={paneStyle}
          />
          <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={exportTxt}
              disabled={!cleaned}
              style={btnSecondary(!!cleaned)}
            >Export .txt</button>
            <button
              type="button"
              onClick={exportSrt}
              disabled={!cleaned}
              style={btnSecondary(!!cleaned)}
            >Export .srt</button>
            {cleaned ? (
              <SendToChip
                text={cleaned}
                sourceTool="transcript-cleaner"
                kind="brief"
              />
            ) : null}
          </div>
        </div>
      </div>

      {/* Diff view */}
      {diffSegments && diffSegments.length > 0 ? (
        <div style={{ marginTop: 28 }}>
          <div style={lbl}>Diff · raw vs cleaned</div>
          <pre
            style={{
              margin: 0,
              padding: "14px 16px",
              background: D.surface,
              border: `1px solid ${D.border}`,
              borderRadius: 10,
              fontFamily: ft,
              fontSize: 14,
              color: D.tx,
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              lineHeight: 1.6,
              maxHeight: 420,
              overflow: "auto",
            }}
          >
            {diffSegments.map((seg, i) => {
              const op = seg[0];
              const value = seg[1];
              if (op === 0) {
                return <span key={i} style={{ color: D.tx }}>{value}</span>;
              }
              if (op === -1) {
                return (
                  <span key={i} style={{ color: D.coral, textDecoration: "line-through", opacity: 0.7 }}>
                    {value}
                  </span>
                );
              }
              return (
                <span key={i} style={{ color: D.teal, textDecoration: "underline", fontWeight: 600 }}>
                  {value}
                </span>
              );
            })}
          </pre>
        </div>
      ) : null}

      {/* Clip moments */}
      {clipMoments.length > 0 ? (
        <div style={{ marginTop: 28 }}>
          <div style={lbl}>Detected clip moments</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {clipMoments.map((m, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  gap: 12,
                  padding: "12px 14px",
                  background: D.surface,
                  border: `1px solid ${D.border}`,
                  borderRadius: 10,
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: ft, fontSize: 13.5, color: D.tx, lineHeight: 1.5, marginBottom: m.reason ? 6 : 0 }}>
                    “{m.line}”
                  </div>
                  {m.reason ? (
                    <div style={{ fontFamily: mn, fontSize: 10, color: D.txm, letterSpacing: 0.3 }}>
                      {m.reason}
                    </div>
                  ) : null}
                </div>
                <div style={{ flexShrink: 0 }}>
                  <SendToChip
                    text={m.line}
                    sourceTool="transcript-cleaner"
                    kind="brief"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
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

const paneStyle: React.CSSProperties = {
  width: "100%",
  minHeight: 320,
  padding: "14px 16px",
  background: D.surface,
  border: `1px solid ${D.border}`,
  borderRadius: 12,
  color: D.tx,
  fontFamily: ft,
  fontSize: 14,
  outline: "none",
  boxSizing: "border-box",
  resize: "vertical",
  lineHeight: 1.6,
};

function btnSecondary(enabled: boolean): React.CSSProperties {
  return {
    background: "transparent",
    color: enabled ? D.tx : D.txd,
    border: `1px solid ${enabled ? D.border : "rgba(255,255,255,0.04)"}`,
    padding: "8px 14px",
    borderRadius: 8,
    fontFamily: mn,
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: 0.5,
    cursor: enabled ? "pointer" : "not-allowed",
    opacity: enabled ? 1 : 0.5,
  };
}
