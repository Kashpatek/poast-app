"use client";
import React, { useState } from "react";

// ═══ TYPES (mirrors src/app/sa-weekly.tsx — kept structurally compatible) ═══
// We keep these inline rather than importing from sa-weekly so this modal
// can be reused by other surfaces later without dragging in the entire
// SA Weekly file. Any field we don't render is loosely typed so callers
// passing a richer LogEntry don't have to massage the shape first.
interface Guest { name: string; handle: string }

interface EpStateLike {
  number: string;
  link?: string;
  transcript?: string;
  timestamps?: string;
  extra?: string;
}

interface ThumbnailConcept {
  concept: string;
  text_overlay: string;
  mood: string;
}

interface SocialResult {
  [key: string]: string | undefined;
}

interface ClipResultLike {
  inputs: { topic?: string; firstLines?: string; lastLines?: string; transcript?: string; context?: string };
  captions: SocialResult | null;
  generatedAt?: number;
}

interface FinalizedStateLike {
  title: string;
  description: string;
  thumbnail: string | ThumbnailConcept;
}

interface SelectionStateLike {
  title: number;
  desc: number;
  thumb: number;
}

interface GeneratedOptionsLike {
  titles: { topic: string; category: string }[];
  descriptions: string[];
  thumbnails: (string | ThumbnailConcept)[];
}

export interface LogVersionPayload {
  ep: EpStateLike;
  guestList: Guest[];
  opts: GeneratedOptionsLike | null;
  sel: SelectionStateLike;
  fin: FinalizedStateLike | null;
  socialRes: SocialResult | null;
  clips: ClipResultLike[];
  thumb: string | null;
  descLen: string;
}

export interface LogVersion {
  versionId: string;
  savedAt: string;
  savedBy: string;
  payload: LogVersionPayload;
  changeNote?: string;
}

// Only fields the modal actually reads are required; everything else is
// optional so callers can hand a full LogEntry without trimming.
export interface VersionTimelineEntry {
  id?: string;
  episode: string;
  title?: string;
  createdBy?: string;
  versions?: LogVersion[];
  currentVersion?: number;
  status?: "draft" | "published";
  lastEditedBy?: string;
  lastEditedAt?: string;
}

// ═══ DESIGN TOKENS (kept inline so the modal doesn't import shared-constants
// from a file that uses a different palette name — `D` in sa-weekly is the
// coral-accent flavor, while shared-constants `D` is the global palette).
// We mirror the sa-weekly palette so the modal feels native to the suite. ═══
var D = {
  bg: "#060608",
  surface: "#09090D",
  elevated: "#0D0D12",
  border: "rgba(255,255,255,0.06)",
  borderHover: "rgba(255,255,255,0.12)",
  amber: "#F7B041",
  blue: "#0B86D1",
  teal: "#2EAD8E",
  coral: "#E06347",
  violet: "#905CCB",
  tx: "#ffffff",
  txb: "rgba(255,255,255,0.55)",
  txl: "rgba(255,255,255,0.4)",
};
var ft = "'Outfit',sans-serif";
var mn = "'JetBrains Mono',monospace";
var ACC = D.violet;

// ─── Utilities ───
function timeAgo(iso: string | null | undefined): string {
  if (!iso) return "just now";
  var ms = Date.now() - new Date(iso).getTime();
  if (!isFinite(ms) || ms < 0) return "just now";
  var sec = Math.floor(ms / 1000);
  if (sec < 60) return sec + " sec ago";
  var min = Math.floor(sec / 60);
  if (min < 60) return min + " min ago";
  var hr = Math.floor(min / 60);
  if (hr < 24) return hr + " hr ago";
  var d = Math.floor(hr / 24);
  return d + " day" + (d === 1 ? "" : "s") + " ago";
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "";
  try {
    var d = new Date(iso);
    if (!isFinite(d.getTime())) return "";
    return d.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch (_e) {
    return "";
  }
}

function thumbToText(t: string | ThumbnailConcept | null | undefined): string {
  if (!t) return "";
  if (typeof t === "string") return t;
  return t.concept + "\nText: \"" + t.text_overlay + "\"\nMood: " + t.mood;
}

// ─── Subcomponent · read-only payload preview ─────────────────────────
function VersionPreview({ payload }: { payload: LogVersionPayload }) {
  var fin = payload.fin || { title: "", description: "", thumbnail: "" };
  var guestsStr = (payload.guestList || []).filter(function(g) { return g && g.name; }).map(function(g) { return g.handle ? g.name + " (" + g.handle + ")" : g.name; }).join(", ");
  var social = payload.socialRes || null;
  var clipCount = (payload.clips || []).length;
  return (
    <div style={{ marginTop: 16, padding: 18, background: D.surface, border: "1px solid " + D.border, borderRadius: 10, maxHeight: "55vh", overflow: "auto" }}>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontFamily: mn, fontSize: 9, color: ACC, letterSpacing: "1.5px", textTransform: "uppercase", marginBottom: 6 }}>Title</div>
        <div style={{ fontFamily: ft, fontSize: 16, fontWeight: 800, color: D.tx, lineHeight: 1.35 }}>{fin.title || "(no title)"}</div>
      </div>
      {guestsStr && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontFamily: mn, fontSize: 9, color: ACC, letterSpacing: "1.5px", textTransform: "uppercase", marginBottom: 6 }}>Guests</div>
          <div style={{ fontFamily: ft, fontSize: 13, color: D.txb }}>{guestsStr}</div>
        </div>
      )}
      {fin.description && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontFamily: mn, fontSize: 9, color: ACC, letterSpacing: "1.5px", textTransform: "uppercase", marginBottom: 6 }}>Description</div>
          <div style={{ fontFamily: ft, fontSize: 13, color: D.txb, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{fin.description}</div>
        </div>
      )}
      {fin.thumbnail && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontFamily: mn, fontSize: 9, color: ACC, letterSpacing: "1.5px", textTransform: "uppercase", marginBottom: 6 }}>Thumbnail concept</div>
          <div style={{ fontFamily: ft, fontSize: 13, color: D.txb, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{thumbToText(fin.thumbnail)}</div>
        </div>
      )}
      {social && Object.keys(social).filter(function(k) { return social![k]; }).length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontFamily: mn, fontSize: 9, color: ACC, letterSpacing: "1.5px", textTransform: "uppercase", marginBottom: 8 }}>Social</div>
          {Object.keys(social).filter(function(k) { return social![k]; }).map(function(k) {
            return (
              <div key={k} style={{ marginBottom: 8, padding: "10px 12px", background: D.elevated, borderRadius: 8, border: "1px solid " + D.border }}>
                <div style={{ fontFamily: mn, fontSize: 9, color: D.coral, textTransform: "uppercase", letterSpacing: "1.5px", marginBottom: 5 }}>{k.replace(/_/g, " ")}</div>
                <div style={{ fontFamily: ft, fontSize: 12, color: D.txb, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{social![k]}</div>
              </div>
            );
          })}
        </div>
      )}
      {clipCount > 0 && (
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontFamily: mn, fontSize: 9, color: ACC, letterSpacing: "1.5px", textTransform: "uppercase", marginBottom: 6 }}>Clips</div>
          <div style={{ fontFamily: mn, fontSize: 11, color: D.txl }}>{clipCount} clip{clipCount === 1 ? "" : "s"} captured in this version</div>
        </div>
      )}
      {payload.ep && payload.ep.transcript && (
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontFamily: mn, fontSize: 9, color: ACC, letterSpacing: "1.5px", textTransform: "uppercase", marginBottom: 6 }}>Transcript length</div>
          <div style={{ fontFamily: mn, fontSize: 10, color: D.txl }}>{payload.ep.transcript.length.toLocaleString()} chars</div>
        </div>
      )}
    </div>
  );
}

// ─── Main · the modal ─────────────────────────────────────────────────
export function VersionTimelineModal({
  entry,
  currentUserName,
  onClose,
  onRevert,
}: {
  entry: VersionTimelineEntry;
  currentUserName: string;
  onClose: () => void;
  onRevert: (versionIdx: number) => void;
}) {
  var versions = (entry.versions || []).slice();
  var initialIdx = versions.length > 0 ? versions.length - 1 : -1;
  var _selected = useState<number>(initialIdx), selectedIdx = _selected[0], setSelectedIdx = _selected[1];
  var selected: LogVersion | null = selectedIdx >= 0 && versions[selectedIdx] ? versions[selectedIdx] : null;
  var currentVersionIdx = (entry.currentVersion || versions.length) - 1;

  // Click backdrop to close.
  var onBackdrop = function() { onClose(); };

  return (
    <div onClick={onBackdrop} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.82)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 24 }}>
      <div onClick={function(e: React.MouseEvent) { e.stopPropagation(); }} style={{ background: D.elevated, border: "1px solid " + D.border, borderRadius: 14, padding: 28, width: "100%", maxWidth: 820, maxHeight: "88vh", overflow: "auto", boxShadow: "0 12px 60px rgba(0,0,0,0.65)" }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, marginBottom: 18 }}>
          <div>
            <div style={{ fontFamily: mn, fontSize: 10, color: ACC, textTransform: "uppercase", letterSpacing: "2px", marginBottom: 6, fontWeight: 700 }}>
              Version Timeline · Ep #{entry.episode}
            </div>
            <div style={{ fontFamily: ft, fontSize: 22, fontWeight: 900, color: D.tx, letterSpacing: -0.5, lineHeight: 1.25 }}>
              {entry.title || "(untitled episode)"}
            </div>
            <div style={{ fontFamily: mn, fontSize: 10, color: D.txl, marginTop: 4 }}>
              {versions.length} version{versions.length === 1 ? "" : "s"}
              {entry.createdBy ? " · created by " + entry.createdBy : ""}
              {entry.status ? " · " + entry.status : ""}
            </div>
          </div>
          <span onClick={onClose} style={{ fontFamily: mn, fontSize: 12, color: D.txl, cursor: "pointer", padding: "6px 10px", borderRadius: 8, border: "1px solid " + D.border, userSelect: "none" }}>Close</span>
        </div>

        {/* Empty-state guard — should be unreachable in practice since
            migrateLogEntry always wraps legacy entries in a v1. */}
        {versions.length === 0 && (
          <div style={{ padding: 24, textAlign: "center", fontFamily: ft, fontSize: 13, color: D.txl }}>
            No versions have been saved for this episode yet.
          </div>
        )}

        {versions.length > 0 && (
          <>
            {/* Version list */}
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {versions.map(function(v: LogVersion, idx: number) {
                var isSelected = idx === selectedIdx;
                var isCurrent = idx === currentVersionIdx;
                var isMine = v.savedBy === currentUserName;
                return (
                  <div key={v.versionId} onClick={function() { setSelectedIdx(idx); }} style={{
                    display: "flex", alignItems: "center", gap: 12,
                    padding: "12px 16px",
                    background: isSelected ? "linear-gradient(135deg, " + ACC + "0F, " + ACC + "05)" : D.surface,
                    border: "1px solid " + (isSelected ? ACC + "60" : D.border),
                    borderRadius: 10, cursor: "pointer",
                    transition: "all 0.18s ease",
                  }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: D.elevated, border: "1px solid " + (isSelected ? ACC + "60" : D.border), display: "flex", alignItems: "center", justifyContent: "center", fontFamily: mn, fontSize: 11, color: isSelected ? ACC : D.txb, fontWeight: 800, flexShrink: 0 }}>
                      v{idx + 1}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
                        <span style={{ fontFamily: ft, fontSize: 13, fontWeight: 700, color: D.tx }}>{v.savedBy || "Unknown"}{isMine ? " (you)" : ""}</span>
                        <span style={{ fontFamily: mn, fontSize: 9.5, color: D.txl }}>{timeAgo(v.savedAt)} · {fmtDate(v.savedAt)}</span>
                        {isCurrent && (
                          <span style={{ fontFamily: mn, fontSize: 9, color: D.teal, padding: "2px 6px", borderRadius: 4, background: D.teal + "12", border: "1px solid " + D.teal + "40", letterSpacing: 0.6, fontWeight: 700 }}>CURRENT</span>
                        )}
                      </div>
                      {v.changeNote && (
                        <div style={{ fontFamily: ft, fontSize: 12, color: D.txb, marginTop: 4, fontStyle: "italic", lineHeight: 1.4 }}>
                          “{v.changeNote}”
                        </div>
                      )}
                    </div>
                    <span style={{ fontFamily: mn, fontSize: 9, color: isSelected ? ACC : D.txl, padding: "3px 9px", borderRadius: 999, border: "1px solid " + (isSelected ? ACC + "40" : D.border), letterSpacing: 0.4 }}>
                      {isSelected ? "Previewing" : "Preview"}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Read-only preview of selected version */}
            {selected && (
              <>
                <VersionPreview payload={selected.payload} />
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginTop: 18, flexWrap: "wrap" }}>
                  <div style={{ fontFamily: mn, fontSize: 10, color: D.txl }}>
                    Read-only preview · v{selectedIdx + 1} of {versions.length}
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    {selectedIdx !== currentVersionIdx && (
                      <button
                        onClick={function() { onRevert(selectedIdx); onClose(); }}
                        style={{
                          padding: "9px 18px",
                          background: "linear-gradient(135deg, " + ACC + ", #6D43A0)",
                          color: D.tx,
                          border: "none",
                          borderRadius: 10,
                          fontFamily: ft,
                          fontSize: 12,
                          fontWeight: 800,
                          cursor: "pointer",
                          letterSpacing: 0.2,
                        }}
                      >
                        Revert to v{selectedIdx + 1}
                      </button>
                    )}
                    <button
                      onClick={onClose}
                      style={{
                        padding: "9px 18px",
                        background: "transparent",
                        color: D.txb,
                        border: "1px solid " + D.border,
                        borderRadius: 10,
                        fontFamily: ft,
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      Close
                    </button>
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default VersionTimelineModal;
