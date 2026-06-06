"use client";

// ProductionSTUDIO · Timeline Editor · AI Drop Panel
//
// Sits in the left rail of the new (post-iframe) timeline editor. The
// user pastes (or loads) a transcript, then runs four hand-offs that
// POST to /api/opencut/* — when results arrive they DROP onto the
// timeline as actual clips/markers via the callback props. We do not
// own timeline state here; the editor wires the callbacks.
//
// CONFLICT POLICY: each action REPLACES the prior result on the timeline.
// We confirm with the user before overwriting via a one-prompt guard,
// scoped per action kind (captions / chapters / fillers / broll).

import React, { useEffect, useRef, useState } from "react";
import {
  Captions,
  ListOrdered,
  Scissors,
  Sparkles,
  Loader2,
  FolderOpen,
  X,
} from "lucide-react";
import { D, ft, gf, mn, uid } from "../../shared-constants";
import { showToast } from "../../toast-context";

// ─── Types the editor consumes ────────────────────────────────────────
// These match the /api/opencut/* response shapes. The `id` field is
// generated client-side so the editor can key DOM nodes and reference
// clips for ripple-delete / hover / select.

export interface CaptionClip {
  id: string;
  start: number;
  end: number;
  text: string;
  words?: Array<{ word: string; start: number; end: number }>;
}

export interface ChapterMarker {
  id: string;
  timestamp: string;
  title: string;
  secondsIntoEpisode: number;
}

export interface FillerMarker {
  id: string;
  start: number;
  end: number;
  word: string;
  reason: string;
}

export interface BrollSuggestion {
  id: string;
  timestamp: string;
  secondsIntoEpisode: number;
  topic: string;
  keywords: string[];
}

export interface AiDropPanelProps {
  onAddCaptions: (captions: CaptionClip[]) => void;
  onAddChapters: (chapters: ChapterMarker[]) => void;
  onAddFillerMarkers: (fillers: FillerMarker[]) => void;
  onAddBrollSuggestions: (suggestions: BrollSuggestion[]) => void;
}

// ─── localStorage keys ────────────────────────────────────────────────
const TRANSCRIPT_KEY = "poast-timeline-transcript";
const SAVED_TRANSCRIPTS_KEY = "poast-transcripts-saved";

interface SavedTranscript {
  id?: string;
  title?: string;
  text?: string;
  cleaned?: string;
  createdAt?: number | string;
}

type ActionKind = "captions" | "chapters" | "fillers" | "broll";

// ─── Component ────────────────────────────────────────────────────────

export function AiDropPanel(props: AiDropPanelProps) {
  const [transcript, setTranscript] = useState("");
  const [busy, setBusy] = useState<ActionKind | null>(null);
  const [counts, setCounts] = useState<{
    captions: number | null;
    chapters: number | null;
    fillers: number | null;
    broll: number | null;
  }>({ captions: null, chapters: null, fillers: null, broll: null });
  const [loadOpen, setLoadOpen] = useState(false);

  // Hydrate the transcript from localStorage on mount. We guard the
  // initial empty -> stored write in the persistence effect below so we
  // don't blow the saved transcript away during the first render pass.
  const hydratedRef = useRef(false);
  useEffect(function () {
    try {
      const raw = window.localStorage.getItem(TRANSCRIPT_KEY);
      if (raw) setTranscript(raw);
    } catch {
      /* ignore */
    }
    hydratedRef.current = true;
  }, []);

  // Persist transcript edits after hydration. We skip the first render
  // so we don't overwrite a stored value with the initial "" state
  // before hydration completes.
  useEffect(function () {
    if (!hydratedRef.current) return;
    try {
      window.localStorage.setItem(TRANSCRIPT_KEY, transcript);
    } catch {
      /* ignore */
    }
  }, [transcript]);

  // Generic guard that confirms before replacing existing items. Returns
  // true if the run should proceed.
  function confirmReplace(kind: ActionKind): boolean {
    const have = counts[kind];
    if (typeof have !== "number" || have <= 0) return true;
    const label =
      kind === "captions"
        ? "captions"
        : kind === "chapters"
        ? "chapters"
        : kind === "fillers"
        ? "filler markers"
        : "B-Roll suggestions";
    if (typeof window === "undefined") return true;
    return window.confirm(
      `Replace the existing ${have} ${label} on the timeline?`
    );
  }

  async function runCaptions() {
    if (!transcript.trim()) {
      showToast("Paste a transcript first", "error");
      return;
    }
    if (!confirmReplace("captions")) return;
    setBusy("captions");
    try {
      const r = await fetch("/api/opencut/captions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript }),
      });
      const d = await r.json();
      if (!r.ok) {
        showToast(d.error || "Captions failed", "error");
        return;
      }
      const raw = Array.isArray(d.captions) ? d.captions : [];
      const clips: CaptionClip[] = raw.map(function (c: {
        start: number;
        end: number;
        text: string;
        words?: Array<{ word: string; start: number; end: number }>;
      }) {
        return {
          id: uid("cap"),
          start: c.start,
          end: c.end,
          text: c.text,
          words: c.words,
        };
      });
      props.onAddCaptions(clips);
      setCounts(function (p) {
        return { ...p, captions: clips.length };
      });
      showToast(`Dropped ${clips.length} caption clips`, "success");
    } catch (e) {
      showToast("Captions: " + String(e), "error");
    } finally {
      setBusy(null);
    }
  }

  async function runChapters() {
    if (!transcript.trim()) {
      showToast("Paste a transcript first", "error");
      return;
    }
    if (!confirmReplace("chapters")) return;
    setBusy("chapters");
    try {
      const r = await fetch("/api/opencut/chapters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript }),
      });
      const d = await r.json();
      if (!r.ok) {
        showToast(d.error || "Chapters failed", "error");
        return;
      }
      const raw = Array.isArray(d.chapters) ? d.chapters : [];
      const markers: ChapterMarker[] = raw.map(function (c: {
        timestamp: string;
        title: string;
        secondsIntoEpisode: number;
      }) {
        return {
          id: uid("chp"),
          timestamp: c.timestamp,
          title: c.title,
          secondsIntoEpisode: c.secondsIntoEpisode,
        };
      });
      props.onAddChapters(markers);
      setCounts(function (p) {
        return { ...p, chapters: markers.length };
      });
      showToast(`Pinned ${markers.length} chapter flags`, "success");
    } catch (e) {
      showToast("Chapters: " + String(e), "error");
    } finally {
      setBusy(null);
    }
  }

  async function runFillers() {
    if (!transcript.trim()) {
      showToast("Paste a transcript first", "error");
      return;
    }
    if (!confirmReplace("fillers")) return;
    setBusy("fillers");
    try {
      const r = await fetch("/api/opencut/filler-segments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript }),
      });
      const d = await r.json();
      if (!r.ok) {
        showToast(d.error || "Filler detect failed", "error");
        return;
      }
      const raw = Array.isArray(d.filler) ? d.filler : [];
      const markers: FillerMarker[] = raw.map(function (f: {
        start: number;
        end: number;
        word: string;
        reason: string;
      }) {
        return {
          id: uid("fil"),
          start: f.start,
          end: f.end,
          word: f.word,
          reason: f.reason,
        };
      });
      props.onAddFillerMarkers(markers);
      setCounts(function (p) {
        return { ...p, fillers: markers.length };
      });
      showToast(`Flagged ${markers.length} filler segments`, "success");
    } catch (e) {
      showToast("Fillers: " + String(e), "error");
    } finally {
      setBusy(null);
    }
  }

  async function runBroll() {
    if (!transcript.trim()) {
      showToast("Paste a transcript first", "error");
      return;
    }
    if (!confirmReplace("broll")) return;
    setBusy("broll");
    try {
      const r = await fetch("/api/opencut/broll-suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript }),
      });
      const d = await r.json();
      if (!r.ok) {
        showToast(d.error || "B-Roll failed", "error");
        return;
      }
      const raw = Array.isArray(d.suggestions) ? d.suggestions : [];
      const sugs: BrollSuggestion[] = raw.map(function (s: {
        timestamp: string;
        secondsIntoEpisode: number;
        topic: string;
        keywords: string[];
      }) {
        return {
          id: uid("brl"),
          timestamp: s.timestamp,
          secondsIntoEpisode: s.secondsIntoEpisode,
          topic: s.topic,
          keywords: s.keywords,
        };
      });
      props.onAddBrollSuggestions(sugs);
      setCounts(function (p) {
        return { ...p, broll: sugs.length };
      });
      showToast(`Queued ${sugs.length} B-Roll placeholders`, "success");
    } catch (e) {
      showToast("B-Roll: " + String(e), "error");
    } finally {
      setBusy(null);
    }
  }

  function onPickSavedTranscript(t: SavedTranscript) {
    const txt = (t.cleaned || t.text || "").trim();
    if (!txt) {
      showToast("That entry has no text", "error");
      return;
    }
    setTranscript(txt);
    setLoadOpen(false);
    showToast("Loaded transcript", "success");
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 12,
        padding: 14,
        background: D.surface,
        border: `1px solid ${D.border}`,
        borderRadius: 12,
        width: "100%",
      }}
    >
      {/* Eyebrow + subtitle */}
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <div
          style={{
            fontFamily: mn,
            fontSize: 10,
            letterSpacing: 1.4,
            color: D.amber,
            textTransform: "uppercase",
          }}
        >
          AI Drop
        </div>
        <div
          style={{
            fontFamily: ft,
            fontSize: 12,
            color: D.txm,
            lineHeight: 1.5,
          }}
        >
          Process a transcript → results drop onto the timeline as
          tracks/markers.
        </div>
      </div>

      {/* Transcript textarea + load button */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
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
            <FolderOpen size={11} /> Load from Cleaner
          </button>
        </div>
        <textarea
          value={transcript}
          onChange={(e) => setTranscript(e.target.value)}
          placeholder="Paste raw or cleaned transcript. Plain text or .srt — both work. Anchors like [12:34] are honored when present."
          style={{
            width: "100%",
            minHeight: 140,
            resize: "vertical",
            padding: 10,
            borderRadius: 8,
            background: D.bg,
            border: `1px solid ${D.border}`,
            color: D.tx,
            fontFamily: mn,
            fontSize: 12,
            lineHeight: 1.55,
            outline: "none",
            boxSizing: "border-box",
          }}
        />
        <div
          style={{
            fontFamily: mn,
            fontSize: 10,
            color: D.txd,
            letterSpacing: 0.5,
          }}
        >
          {transcript.length.toLocaleString()} chars
        </div>
      </div>

      {/* Four vertically-stacked action buttons */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <DropAction
          label="Generate Captions"
          hint="→ CAP track"
          tone={D.amber}
          icon={<Captions size={14} />}
          busy={busy === "captions"}
          count={counts.captions}
          onClick={runCaptions}
        />
        <DropAction
          label="Find Chapters"
          hint="→ flag pins"
          tone={D.blue}
          icon={<ListOrdered size={14} />}
          busy={busy === "chapters"}
          count={counts.chapters}
          onClick={runChapters}
        />
        <DropAction
          label="Detect Filler"
          hint="→ red ripple pins"
          tone={D.coral}
          icon={<Scissors size={14} />}
          busy={busy === "fillers"}
          count={counts.fillers}
          onClick={runFillers}
        />
        <DropAction
          label="Suggest B-Roll"
          hint="→ B-Roll placeholders"
          tone={D.teal}
          icon={<Sparkles size={14} />}
          busy={busy === "broll"}
          count={counts.broll}
          onClick={runBroll}
        />
      </div>

      {loadOpen ? (
        <LoadTranscriptModal
          onClose={() => setLoadOpen(false)}
          onPick={onPickSavedTranscript}
        />
      ) : null}
    </div>
  );
}

// ─── Action button (vertical, with busy/count states) ─────────────────

function DropAction({
  label,
  hint,
  tone,
  icon,
  busy,
  count,
  onClick,
}: {
  label: string;
  hint: string;
  tone: string;
  icon: React.ReactNode;
  busy: boolean;
  count: number | null;
  onClick: () => void;
}) {
  const has = typeof count === "number" && count > 0;
  return (
    <button
      onClick={onClick}
      disabled={busy}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "10px 12px",
        borderRadius: 10,
        background: D.bg,
        border: `1px solid ${has ? `${tone}55` : D.border}`,
        cursor: busy ? "wait" : "pointer",
        color: D.tx,
        textAlign: "left",
        transition: "border-color 0.15s",
      }}
    >
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: 6,
          background: `${tone}1c`,
          border: `1px solid ${tone}55`,
          color: tone,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        {busy ? <Loader2 size={13} className="spin" /> : icon}
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 2,
          minWidth: 0,
          flex: 1,
        }}
      >
        <div
          style={{
            fontFamily: gf,
            fontSize: 13,
            color: D.tx,
            letterSpacing: 0.2,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {label}
        </div>
        <div
          style={{
            fontFamily: mn,
            fontSize: 9,
            color: D.txd,
            letterSpacing: 0.6,
            textTransform: "uppercase",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {hint}
        </div>
      </div>
      <CountBadge busy={busy} count={count} tone={tone} />
    </button>
  );
}

function CountBadge({
  busy,
  count,
  tone,
}: {
  busy: boolean;
  count: number | null;
  tone: string;
}) {
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
          flexShrink: 0,
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
          flexShrink: 0,
        }}
      >
        {empty ? "0 results" : `${count} on track`}
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
        flexShrink: 0,
      }}
    >
      Idle
    </span>
  );
}

// ─── Load-from-cleaner modal ──────────────────────────────────────────

function LoadTranscriptModal({
  onClose,
  onPick,
}: {
  onClose: () => void;
  onPick: (t: SavedTranscript) => void;
}) {
  const [items, setItems] = useState<SavedTranscript[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(function () {
    try {
      const raw = window.localStorage.getItem(SAVED_TRANSCRIPTS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setItems(parsed as SavedTranscript[]);
      }
    } catch {
      /* ignore */
    }
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
          <div style={{ fontFamily: gf, fontSize: 15, color: D.tx }}>
            Load from Transcript Cleaner
          </div>
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
        <div
          style={{
            overflow: "auto",
            padding: 12,
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          {!loaded ? (
            <div style={{ fontFamily: mn, fontSize: 11, color: D.txd }}>
              Loading…
            </div>
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
              No saved transcripts yet. Paste into the textarea above, or
              save one in
              <span
                style={{
                  fontFamily: mn,
                  fontSize: 12,
                  color: D.tx,
                  padding: "0 4px",
                }}
              >
                /production-studio/transcript-cleaner
              </span>
              first.
            </div>
          ) : (
            items.map(function (t, i) {
              const title =
                t.title ||
                (t.text || t.cleaned || "").slice(0, 60) ||
                `Transcript ${i + 1}`;
              const preview = (t.cleaned || t.text || "")
                .slice(0, 140)
                .replace(/\s+/g, " ");
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
                  <div
                    style={{ fontFamily: ft, fontSize: 13, color: D.tx }}
                  >
                    {title}
                  </div>
                  <div
                    style={{
                      fontFamily: mn,
                      fontSize: 11,
                      color: D.txm,
                      lineHeight: 1.5,
                    }}
                  >
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

// ─── Style helpers ────────────────────────────────────────────────────

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
