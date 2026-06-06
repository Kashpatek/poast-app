"use client";

// ProductionSTUDIO · Timeline Workspace (v3 · OpenCut hand-off)
//
// v1 was a from-scratch FFmpeg.wasm NLE (see ./timeline/legacy.tsx).
// v2 just embedded https://opencut.app in an iframe with a NOTE card
// underneath explaining what wasn't wired.
//
// v3 (this file) wraps the iframe with a real Workspace panel on top:
//
//   1. Paste / load a transcript (Transcript Cleaner export → localStorage
//      key "poast-transcripts-saved" if present, else paste-only).
//   2. Run four hand-off actions that POST to /api/opencut/*:
//        - Generate Captions   → ≤7-word caption cues (start/end in s)
//        - Find Chapters       → 5-10 chapter markers (m:ss + secondsIntoEpisode)
//        - Detect Filler       → ripple-deletable [start,end] segments
//        - Suggest B-Roll      → timestamped stock-footage queries
//   3. Once at least one artifact ships, the "Send to OpenCut" panel
//      lights up. Three actions:
//        - Copy all as JSON  → clipboard (HTML + plain MIME)
//        - Download artifacts.zip → jszip bundle, file-saver download
//        - Open OpenCut     → writes JSON to clipboard, opens opencut.app
//   4. Errors surface via showToast (sonner). Each action button shows a
//      loader + count badge.
//
// Real plugin/postMessage integration lands when OpenCut publishes its
// API — for now this is a paste-friendly hand-off.

import React, { useState } from "react";
import {
  ExternalLink,
  Film,
  Captions,
  ListOrdered,
  Scissors,
  Sparkles,
  Loader2,
  Copy,
  Download,
  Send,
  FolderOpen,
  X,
} from "lucide-react";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import { ProductionStudioShell } from "./shell";
import { D, ft, gf, mn } from "../shared-constants";
import { showToast } from "../toast-context";

const OPENCUT_URL = "https://opencut.app";
const SAVED_TRANSCRIPTS_KEY = "poast-transcripts-saved";

interface CaptionCue {
  start: number;
  end: number;
  text: string;
  words?: Array<{ word: string; start: number; end: number }>;
}

interface ChapterMarker {
  timestamp: string;
  title: string;
  secondsIntoEpisode: number;
}

interface FillerSegment {
  start: number;
  end: number;
  word: string;
  reason: string;
}

interface BRollSuggestion {
  timestamp: string;
  secondsIntoEpisode: number;
  topic: string;
  keywords: string[];
}

interface SavedTranscript {
  id?: string;
  title?: string;
  text?: string;
  cleaned?: string;
  createdAt?: number | string;
}

export function TimelineEditorView() {
  const [transcript, setTranscript] = useState("");
  const [captions, setCaptions] = useState<CaptionCue[] | null>(null);
  const [chapters, setChapters] = useState<ChapterMarker[] | null>(null);
  const [fillers, setFillers] = useState<FillerSegment[] | null>(null);
  const [broll, setBroll] = useState<BRollSuggestion[] | null>(null);

  const [busy, setBusy] = useState<null | "captions" | "chapters" | "fillers" | "broll">(null);
  const [loadOpen, setLoadOpen] = useState(false);

  const hasArtifacts =
    (captions && captions.length > 0) ||
    (chapters && chapters.length > 0) ||
    (fillers && fillers.length > 0) ||
    (broll && broll.length > 0);

  async function runCaptions() {
    if (!transcript.trim()) { showToast("Paste a transcript first", "error"); return; }
    setBusy("captions");
    try {
      const r = await fetch("/api/opencut/captions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript }),
      });
      const d = await r.json();
      if (!r.ok) { showToast(d.error || "Captions failed", "error"); return; }
      const list: CaptionCue[] = Array.isArray(d.captions) ? d.captions : [];
      setCaptions(list);
      showToast(`Generated ${list.length} caption cues`, "success");
    } catch (e) {
      showToast("Captions: " + String(e), "error");
    } finally {
      setBusy(null);
    }
  }

  async function runChapters() {
    if (!transcript.trim()) { showToast("Paste a transcript first", "error"); return; }
    setBusy("chapters");
    try {
      const r = await fetch("/api/opencut/chapters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript }),
      });
      const d = await r.json();
      if (!r.ok) { showToast(d.error || "Chapters failed", "error"); return; }
      const list: ChapterMarker[] = Array.isArray(d.chapters) ? d.chapters : [];
      setChapters(list);
      showToast(`Found ${list.length} chapters`, "success");
    } catch (e) {
      showToast("Chapters: " + String(e), "error");
    } finally {
      setBusy(null);
    }
  }

  async function runFillers() {
    if (!transcript.trim()) { showToast("Paste a transcript first", "error"); return; }
    setBusy("fillers");
    try {
      const r = await fetch("/api/opencut/filler-segments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript }),
      });
      const d = await r.json();
      if (!r.ok) { showToast(d.error || "Filler detect failed", "error"); return; }
      const list: FillerSegment[] = Array.isArray(d.filler) ? d.filler : [];
      setFillers(list);
      showToast(`Flagged ${list.length} filler segments`, "success");
    } catch (e) {
      showToast("Fillers: " + String(e), "error");
    } finally {
      setBusy(null);
    }
  }

  async function runBroll() {
    if (!transcript.trim()) { showToast("Paste a transcript first", "error"); return; }
    setBusy("broll");
    try {
      const r = await fetch("/api/opencut/broll-suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript }),
      });
      const d = await r.json();
      if (!r.ok) { showToast(d.error || "B-Roll failed", "error"); return; }
      const list: BRollSuggestion[] = Array.isArray(d.suggestions) ? d.suggestions : [];
      setBroll(list);
      showToast(`Suggested ${list.length} B-Roll cues`, "success");
    } catch (e) {
      showToast("B-Roll: " + String(e), "error");
    } finally {
      setBusy(null);
    }
  }

  function buildArtifactBundle() {
    return {
      generatedAt: new Date().toISOString(),
      source: "POAST · ProductionSTUDIO · Timeline Workspace",
      target: "OpenCut (https://opencut.app)",
      captions: captions || [],
      chapters: chapters || [],
      filler: fillers || [],
      brollSuggestions: broll || [],
    };
  }

  async function copyBundleToClipboard(): Promise<boolean> {
    const bundle = buildArtifactBundle();
    const json = JSON.stringify(bundle, null, 2);
    try {
      // Prefer rich clipboard with HTML + text/plain so OpenCut can pick
      // whichever it knows how to parse.
      if (typeof window !== "undefined" && window.ClipboardItem && navigator.clipboard?.write) {
        const html = `<pre>${json.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c] || c))}</pre>`;
        const item = new ClipboardItem({
          "text/plain": new Blob([json], { type: "text/plain" }),
          "text/html": new Blob([html], { type: "text/html" }),
        });
        await navigator.clipboard.write([item]);
        return true;
      }
    } catch {
      // fall through to text-only fallback
    }
    try {
      await navigator.clipboard.writeText(json);
      return true;
    } catch {
      try {
        const ta = document.createElement("textarea");
        ta.value = json; ta.style.position = "fixed"; ta.style.left = "-9999px";
        document.body.appendChild(ta); ta.select(); document.execCommand("copy");
        document.body.removeChild(ta);
        return true;
      } catch {
        return false;
      }
    }
  }

  async function onCopyAll() {
    const ok = await copyBundleToClipboard();
    if (ok) showToast("Copied artifacts JSON to clipboard", "success");
    else showToast("Clipboard write failed", "error");
  }

  async function onDownloadZip() {
    try {
      const zip = new JSZip();
      const bundle = buildArtifactBundle();
      if (captions && captions.length) zip.file("captions.json", JSON.stringify(captions, null, 2));
      if (chapters && chapters.length) zip.file("chapters.json", JSON.stringify(chapters, null, 2));
      if (fillers && fillers.length) zip.file("filler-segments.json", JSON.stringify(fillers, null, 2));
      if (broll && broll.length) zip.file("broll-suggestions.json", JSON.stringify(broll, null, 2));
      zip.file("bundle.json", JSON.stringify(bundle, null, 2));
      zip.file(
        "README.txt",
        [
          "POAST · ProductionSTUDIO · Timeline Workspace",
          "OpenCut hand-off bundle",
          "",
          "Files:",
          "  captions.json           — caption cues (start/end seconds + text)",
          "  chapters.json           — chapter markers (m:ss + secondsIntoEpisode + title)",
          "  filler-segments.json    — ripple-deletable [start,end] segments",
          "  broll-suggestions.json  — timestamped topics + stock-footage keywords",
          "  bundle.json             — all of the above in one envelope",
          "",
          "Paste contents into the matching OpenCut track. Plugin-level integration",
          "lands when OpenCut publishes its API.",
        ].join("\n"),
      );
      const blob = await zip.generateAsync({ type: "blob" });
      saveAs(blob, "opencut-artifacts.zip");
      showToast("Downloaded artifacts.zip", "success");
    } catch (e) {
      showToast("Download failed: " + String(e), "error");
    }
  }

  async function onOpenOpenCut() {
    const ok = await copyBundleToClipboard();
    if (ok) showToast("Copied to clipboard — paste into OpenCut tracks", "success");
    else showToast("Clipboard write failed — opening anyway", "error");
    window.open(OPENCUT_URL, "_blank", "noopener,noreferrer");
  }

  function onPickSavedTranscript(t: SavedTranscript) {
    const txt = (t.cleaned || t.text || "").trim();
    if (!txt) { showToast("That entry has no text", "error"); return; }
    setTranscript(txt);
    setLoadOpen(false);
    showToast("Loaded transcript", "success");
  }

  return (
    <ProductionStudioShell
      title="Timeline Workspace"
      subtitle="Process transcripts here, send artifacts to OpenCut."
    >
      <div style={{ padding: "12px 20px 32px", display: "flex", flexDirection: "column", gap: 12 }}>
        {/* === A. WORKSPACE PANEL (transcript + 4 actions + hand-off) === */}
        <div
          style={{
            background: D.surface,
            border: `1px solid ${D.border}`,
            borderRadius: 12,
            padding: 16,
            display: "flex",
            flexDirection: "column",
            gap: 14,
          }}
        >
          {/* Eyebrow header */}
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: `${D.amber}1c`,
                border: `1px solid ${D.amber}55`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Sparkles size={16} color={D.amber} strokeWidth={1.8} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.2 }}>
              <div style={{ fontFamily: mn, fontSize: 10, letterSpacing: 1.4, color: D.amber, textTransform: "uppercase" }}>
                Timeline Workspace
              </div>
              <div style={{ fontFamily: ft, fontSize: 13, color: D.txm }}>
                Process transcripts here, send artifacts to OpenCut.
              </div>
            </div>
          </div>

          {/* Transcript input row */}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <label
                style={{
                  fontFamily: mn,
                  fontSize: 10,
                  letterSpacing: 1,
                  color: D.txd,
                  textTransform: "uppercase",
                }}
              >
                Transcript
              </label>
              <div style={{ flex: 1 }} />
              <button
                onClick={() => setLoadOpen(true)}
                style={ghostBtn(D.blue)}
              >
                <FolderOpen size={12} /> Load from Transcript Cleaner
              </button>
            </div>
            <textarea
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              placeholder="Paste raw or cleaned transcript. Plain text or .srt — both work. Anchors like [12:34] are honored when present."
              style={{
                width: "100%",
                minHeight: 130,
                resize: "vertical",
                padding: 12,
                borderRadius: 8,
                background: D.bg,
                border: `1px solid ${D.border}`,
                color: D.tx,
                fontFamily: mn,
                fontSize: 12,
                lineHeight: 1.55,
                outline: "none",
              }}
            />
            <div style={{ fontFamily: mn, fontSize: 10, color: D.txd, letterSpacing: 0.5 }}>
              {transcript.length.toLocaleString()} chars
            </div>
          </div>

          {/* Four action buttons row */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 10,
            }}
          >
            <ActionTile
              label="Generate Captions"
              tone={D.amber}
              icon={<Captions size={14} />}
              busy={busy === "captions"}
              count={captions?.length}
              onClick={runCaptions}
            />
            <ActionTile
              label="Find Chapters"
              tone={D.blue}
              icon={<ListOrdered size={14} />}
              busy={busy === "chapters"}
              count={chapters?.length}
              onClick={runChapters}
            />
            <ActionTile
              label="Detect Filler"
              tone={D.coral}
              icon={<Scissors size={14} />}
              busy={busy === "fillers"}
              count={fillers?.length}
              onClick={runFillers}
            />
            <ActionTile
              label="Suggest B-Roll"
              tone={D.teal}
              icon={<Sparkles size={14} />}
              busy={busy === "broll"}
              count={broll?.length}
              onClick={runBroll}
            />
          </div>

          {/* Send to OpenCut panel — only when there are artifacts */}
          {hasArtifacts ? (
            <div
              style={{
                marginTop: 4,
                border: `1px solid ${D.border}`,
                borderRadius: 10,
                background: D.bg,
                padding: 14,
                display: "grid",
                gridTemplateColumns: "minmax(0, 1.4fr) minmax(0, 1fr)",
                gap: 14,
              }}
            >
              {/* Left column: artifact previews */}
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div
                  style={{
                    fontFamily: mn,
                    fontSize: 10,
                    letterSpacing: 1.2,
                    color: D.amber,
                    textTransform: "uppercase",
                  }}
                >
                  Send to OpenCut
                </div>
                <ArtifactPreview
                  label="Captions"
                  count={captions?.length || 0}
                  tone={D.amber}
                  items={(captions || []).slice(0, 5).map((c) => `${fmtSec(c.start)} → ${fmtSec(c.end)} · ${c.text}`)}
                  total={captions?.length || 0}
                />
                <ArtifactPreview
                  label="Chapters"
                  count={chapters?.length || 0}
                  tone={D.blue}
                  items={(chapters || []).slice(0, 5).map((c) => `${c.timestamp} · ${c.title}`)}
                  total={chapters?.length || 0}
                />
                <ArtifactPreview
                  label="Filler segments"
                  count={fillers?.length || 0}
                  tone={D.coral}
                  items={(fillers || []).slice(0, 5).map((f) => `${fmtSec(f.start)}–${fmtSec(f.end)} · ${f.word}`)}
                  total={fillers?.length || 0}
                />
                <ArtifactPreview
                  label="B-Roll cues"
                  count={broll?.length || 0}
                  tone={D.teal}
                  items={(broll || []).slice(0, 5).map((b) => `${b.timestamp} · ${b.topic} → ${b.keywords.slice(0, 3).join(", ")}`)}
                  total={broll?.length || 0}
                />
              </div>

              {/* Right column: 3 hand-off actions */}
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div
                  style={{
                    fontFamily: mn,
                    fontSize: 10,
                    letterSpacing: 1.2,
                    color: D.txd,
                    textTransform: "uppercase",
                  }}
                >
                  Hand-off
                </div>
                <button onClick={onCopyAll} style={primaryBtn(D.amber)}>
                  <Copy size={13} /> Copy all as JSON
                </button>
                <button onClick={onDownloadZip} style={primaryBtn(D.blue)}>
                  <Download size={13} /> Download artifacts.zip
                </button>
                <button onClick={onOpenOpenCut} style={primaryBtn(D.teal)}>
                  <Send size={13} /> Open OpenCut
                </button>
                <div
                  style={{
                    marginTop: 4,
                    fontFamily: ft,
                    fontSize: 11,
                    color: D.txd,
                    lineHeight: 1.5,
                  }}
                >
                  Opening OpenCut copies the JSON bundle to your clipboard first, so you can paste it directly into the matching tracks.
                </div>
              </div>
            </div>
          ) : null}

          {/* Replacement info pill (was the big NOTE card) */}
          <div
            style={{
              display: "inline-flex",
              alignSelf: "flex-start",
              alignItems: "center",
              gap: 8,
              padding: "6px 12px",
              borderRadius: 999,
              border: `1px solid ${D.border}`,
              background: D.bg,
              fontFamily: mn,
              fontSize: 10,
              letterSpacing: 0.6,
              color: D.txm,
            }}
          >
            <span style={{ width: 6, height: 6, borderRadius: 999, background: D.amber }} />
            Workspace tools above feed OpenCut tracks. Plugin-level integration lands when OpenCut publishes the API.
          </div>
        </div>

        {/* === B. EDITOR (iframe — unchanged behavior, sticky header) === */}
        <div
          style={{
            position: "sticky",
            top: 56,
            zIndex: 4,
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "10px 14px",
            background: D.surface,
            border: `1px solid ${D.border}`,
            borderRadius: 10,
            backdropFilter: "blur(10px)",
            WebkitBackdropFilter: "blur(10px)",
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: `${D.blue}1c`,
              border: `1px solid ${D.blue}55`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Film size={16} color={D.blue} strokeWidth={1.8} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.2 }}>
            <div style={{ fontFamily: gf, fontSize: 16, letterSpacing: 0.2, color: D.tx }}>
              OpenCut Editor
            </div>
            <div style={{ fontFamily: mn, fontSize: 10, letterSpacing: 0.6, color: D.txd, textTransform: "uppercase" }}>
              opencut.app · MIT
            </div>
          </div>
          <div style={{ flex: 1 }} />
          <a
            href={OPENCUT_URL}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "6px 12px",
              borderRadius: 6,
              border: `1px solid ${D.blue}55`,
              background: "transparent",
              color: D.blue,
              fontFamily: mn,
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: 0.6,
              textTransform: "uppercase",
              textDecoration: "none",
            }}
          >
            <ExternalLink size={12} /> Open in new tab
          </a>
        </div>

        <div
          style={{
            background: "#000",
            border: `1px solid ${D.border}`,
            borderRadius: 10,
            overflow: "hidden",
          }}
        >
          <iframe
            src={OPENCUT_URL}
            title="OpenCut Editor"
            sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-downloads allow-modals allow-pointer-lock allow-presentation"
            allow="camera; microphone; clipboard-read; clipboard-write; fullscreen; autoplay; encrypted-media; display-capture"
            style={{
              display: "block",
              width: "100%",
              height: "calc(100vh - 200px)",
              border: "none",
              background: "#000",
            }}
          />
        </div>
      </div>

      {/* Load-from-cleaner modal */}
      {loadOpen ? (
        <LoadTranscriptModal
          onClose={() => setLoadOpen(false)}
          onPick={onPickSavedTranscript}
        />
      ) : null}
    </ProductionStudioShell>
  );
}

// ─── Pieces ──────────────────────────────────────────────────────────

function ActionTile({
  label,
  tone,
  icon,
  busy,
  count,
  onClick,
}: {
  label: string;
  tone: string;
  icon: React.ReactNode;
  busy: boolean;
  count: number | undefined;
  onClick: () => void;
}) {
  const has = typeof count === "number" && count > 0;
  return (
    <button
      onClick={onClick}
      disabled={busy}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "stretch",
        gap: 8,
        padding: "12px 14px",
        borderRadius: 10,
        background: D.bg,
        border: `1px solid ${has ? `${tone}55` : D.border}`,
        cursor: busy ? "wait" : "pointer",
        color: D.tx,
        textAlign: "left",
        transition: "border-color 0.15s",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div
          style={{
            width: 26,
            height: 26,
            borderRadius: 6,
            background: `${tone}1c`,
            border: `1px solid ${tone}55`,
            color: tone,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {busy ? <Loader2 size={13} className="spin" /> : icon}
        </div>
        <div style={{ fontFamily: gf, fontSize: 13, color: D.tx, letterSpacing: 0.2 }}>{label}</div>
        <div style={{ flex: 1 }} />
        <StatusPill busy={busy} count={count} tone={tone} />
      </div>
    </button>
  );
}

function StatusPill({ busy, count, tone }: { busy: boolean; count: number | undefined; tone: string }) {
  if (busy) {
    return (
      <span
        style={{
          fontFamily: mn,
          fontSize: 9,
          letterSpacing: 1,
          color: tone,
          textTransform: "uppercase",
          padding: "2px 8px",
          borderRadius: 999,
          background: `${tone}1c`,
          border: `1px solid ${tone}55`,
        }}
      >
        Running…
      </span>
    );
  }
  if (typeof count === "number") {
    const empty = count === 0;
    return (
      <span
        style={{
          fontFamily: mn,
          fontSize: 9,
          letterSpacing: 1,
          color: empty ? D.txd : tone,
          textTransform: "uppercase",
          padding: "2px 8px",
          borderRadius: 999,
          background: empty ? "transparent" : `${tone}1c`,
          border: `1px solid ${empty ? D.border : `${tone}55`}`,
        }}
      >
        {empty ? "0 results" : `${count} ready`}
      </span>
    );
  }
  return (
    <span
      style={{
        fontFamily: mn,
        fontSize: 9,
        letterSpacing: 1,
        color: D.txd,
        textTransform: "uppercase",
        padding: "2px 8px",
        borderRadius: 999,
        background: "transparent",
        border: `1px solid ${D.border}`,
      }}
    >
      Idle
    </span>
  );
}

function ArtifactPreview({
  label,
  count,
  tone,
  items,
  total,
}: {
  label: string;
  count: number;
  tone: string;
  items: string[];
  total: number;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div
      style={{
        border: `1px solid ${D.border}`,
        borderRadius: 8,
        background: D.surface,
      }}
    >
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "8px 12px",
          background: "transparent",
          border: "none",
          color: D.tx,
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: 999,
            background: count > 0 ? tone : D.txd,
          }}
        />
        <span style={{ fontFamily: ft, fontSize: 13, color: D.tx }}>{label}</span>
        <span style={{ flex: 1 }} />
        <span style={{ fontFamily: mn, fontSize: 10, color: D.txm, letterSpacing: 0.6 }}>
          {count} {count === 1 ? "item" : "items"}
        </span>
        <span style={{ fontFamily: mn, fontSize: 10, color: D.txd }}>{open ? "▾" : "▸"}</span>
      </button>
      {open && count > 0 ? (
        <div
          style={{
            padding: "0 12px 10px",
            display: "flex",
            flexDirection: "column",
            gap: 4,
          }}
        >
          {items.map((it, i) => (
            <div
              key={i}
              style={{
                fontFamily: mn,
                fontSize: 11,
                color: D.txm,
                lineHeight: 1.5,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {it}
            </div>
          ))}
          {total > items.length ? (
            <div style={{ fontFamily: mn, fontSize: 10, color: D.txd }}>
              + {total - items.length} more
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function LoadTranscriptModal({
  onClose,
  onPick,
}: {
  onClose: () => void;
  onPick: (t: SavedTranscript) => void;
}) {
  const [items, setItems] = useState<SavedTranscript[]>([]);
  const [loaded, setLoaded] = useState(false);

  React.useEffect(() => {
    try {
      const raw = localStorage.getItem(SAVED_TRANSCRIPTS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setItems(parsed as SavedTranscript[]);
      }
    } catch { /* ignore */ }
    setLoaded(true);
  }, []);

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.55)",
        backdropFilter: "blur(2px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 50,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(560px, 92vw)",
          maxHeight: "80vh",
          background: D.card,
          border: `1px solid ${D.border}`,
          borderRadius: 12,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            padding: "12px 16px",
            borderBottom: `1px solid ${D.border}`,
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <div style={{ fontFamily: gf, fontSize: 15, color: D.tx }}>Load from Transcript Cleaner</div>
          <div style={{ flex: 1 }} />
          <button
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              color: D.txm,
              cursor: "pointer",
              padding: 4,
            }}
          >
            <X size={16} />
          </button>
        </div>
        <div style={{ overflow: "auto", padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
          {!loaded ? (
            <div style={{ fontFamily: mn, fontSize: 11, color: D.txd }}>Loading…</div>
          ) : items.length === 0 ? (
            <div
              style={{
                padding: 16,
                borderRadius: 8,
                background: D.bg,
                border: `1px dashed ${D.border}`,
                fontFamily: ft,
                fontSize: 13,
                color: D.txm,
                lineHeight: 1.55,
              }}
            >
              No saved transcripts yet. Paste below into the Workspace textarea, or save one in
              <span style={{ fontFamily: mn, fontSize: 12, color: D.tx, padding: "0 4px" }}>
                /production-studio/transcript-cleaner
              </span>
              first.
            </div>
          ) : (
            items.map((t, i) => {
              const title = t.title || (t.text || t.cleaned || "").slice(0, 60) || `Transcript ${i + 1}`;
              const preview = (t.cleaned || t.text || "").slice(0, 140).replace(/\s+/g, " ");
              return (
                <button
                  key={t.id || i}
                  onClick={() => onPick(t)}
                  style={{
                    background: D.bg,
                    border: `1px solid ${D.border}`,
                    borderRadius: 8,
                    padding: 12,
                    textAlign: "left",
                    color: D.tx,
                    cursor: "pointer",
                    display: "flex",
                    flexDirection: "column",
                    gap: 4,
                  }}
                >
                  <div style={{ fontFamily: ft, fontSize: 13, color: D.tx }}>{title}</div>
                  <div style={{ fontFamily: mn, fontSize: 11, color: D.txm, lineHeight: 1.5 }}>
                    {preview}
                    {(t.cleaned || t.text || "").length > 140 ? "…" : ""}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Style helpers ───────────────────────────────────────────────────

function primaryBtn(tone: string): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: "10px 14px",
    borderRadius: 8,
    background: `${tone}1c`,
    border: `1px solid ${tone}55`,
    color: tone,
    fontFamily: mn,
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    cursor: "pointer",
  };
}

function ghostBtn(tone: string): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "5px 10px",
    borderRadius: 6,
    background: "transparent",
    border: `1px solid ${tone}55`,
    color: tone,
    fontFamily: mn,
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    cursor: "pointer",
  };
}

function fmtSec(sec: number): string {
  if (!isFinite(sec) || sec < 0) return "0:00";
  const s = Math.floor(sec);
  const m = Math.floor(s / 60);
  const ss = s % 60;
  return `${m}:${String(ss).padStart(2, "0")}`;
}
