"use client";

// TimelineEditor — multi-track NLE surface that consumes the shared
// Project shape from ./types and feeds it back up via onProjectChange.
// Renders ruler + media bin + tracks lane + clip cards with drag /
// trim / split / drop interactions, plus a zoomable scroll surface.
// Preview + export live in sibling files; this one is the
// editing surface.

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Upload, Plus, Trash2, Scissors, Move, ZoomIn, ZoomOut, EyeOff, Eye, Download, VolumeX, Volume2, Film, Music, MessageSquare, Layers, Loader2 } from "lucide-react";
import { D, ft, gf, mn, uid } from "../../shared-constants";
import { showToast } from "../../toast-context";
import {
  type Project,
  type TimelineTrack,
  type TimelinePlacement,
  type MediaClip,
  type ClipKind,
  type TrackKind,
  type CaptionCue,
  projectDuration,
  findClip,
} from "./types";
import { exportTimeline } from "./export-pipeline";

interface Props {
  project: Project;
  onProjectChange: (next: Project) => void;
  playheadSec: number;
  onPlayheadChange: (s: number) => void;
  isPlaying: boolean;
  onPlayToggle: () => void;
}

type Tool = "select" | "razor" | "hand";
const SNAP_GRID_SEC = 0.25;
const SNAP_PROXIMITY_PX = 10;
const HIST_CAP = 30;
const TRACK_HEIGHT = 56;
const RULER_HEIGHT = 36;
const TRACK_HEADER_WIDTH = 130;

const KIND_ACCENT: Record<TrackKind, string> = {
  video: D.amber,
  audio: D.teal,
  caption: D.cyan,
  overlay: D.violet,
};

const KIND_ICON: Record<TrackKind, typeof Film> = {
  video: Film,
  audio: Music,
  caption: MessageSquare,
  overlay: Layers,
};

export function TimelineEditor({ project, onProjectChange, playheadSec, onPlayheadChange }: Props) {
  const [tool, setTool] = useState<Tool>("select");
  const [pxPerSec, setPxPerSec] = useState(80);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);

  const historyRef = useRef<{ stack: string[]; idx: number }>({ stack: [JSON.stringify(project)], idx: 0 });
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // ─── ensure tracks exist for the default kinds ───
  useEffect(() => {
    if (project.tracks.length === 0) {
      const defaults: TimelineTrack[] = [
        { id: uid("trk"), kind: "video", label: "V1", placements: [] },
        { id: uid("trk"), kind: "audio", label: "A1", placements: [] },
        { id: uid("trk"), kind: "caption", label: "Captions", placements: [], captions: [] },
      ];
      onProjectChange({ ...project, tracks: defaults, updatedAt: Date.now() });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── history snapshot on project change ───
  useEffect(() => {
    const serialized = JSON.stringify(project);
    const top = historyRef.current.stack[historyRef.current.idx];
    if (serialized === top) return;
    historyRef.current.stack = historyRef.current.stack.slice(0, historyRef.current.idx + 1);
    historyRef.current.stack.push(serialized);
    if (historyRef.current.stack.length > HIST_CAP) historyRef.current.stack.shift();
    historyRef.current.idx = historyRef.current.stack.length - 1;
  }, [project]);

  function undo() {
    if (historyRef.current.idx <= 0) return;
    historyRef.current.idx -= 1;
    const snap = historyRef.current.stack[historyRef.current.idx];
    onProjectChange(JSON.parse(snap));
  }
  function redo() {
    if (historyRef.current.idx >= historyRef.current.stack.length - 1) return;
    historyRef.current.idx += 1;
    const snap = historyRef.current.stack[historyRef.current.idx];
    onProjectChange(JSON.parse(snap));
  }

  const duration = useMemo(() => Math.max(projectDuration(project), 30), [project]);

  // ─── snapping helper: snap to grid + nearby clip edges ───
  function snap(sec: number, excludePlacementId?: string): number {
    let snapped = Math.round(sec / SNAP_GRID_SEC) * SNAP_GRID_SEC;
    const px = sec * pxPerSec;
    const snapPx = SNAP_PROXIMITY_PX;
    for (const track of project.tracks) {
      for (const p of track.placements) {
        if (p.id === excludePlacementId) continue;
        for (const edge of [p.startSec, p.startSec + p.durationSec]) {
          if (Math.abs(edge * pxPerSec - px) < snapPx) snapped = edge;
        }
      }
    }
    return Math.max(0, snapped);
  }

  // ─── upload & drag-into-bin ───
  async function onUpload(files: FileList | null) {
    if (!files || files.length === 0) return;
    const additions: MediaClip[] = [];
    for (const file of Array.from(files)) {
      const kind: ClipKind = file.type.startsWith("audio/") ? "audio" : file.type.startsWith("image/") ? "image" : "video";
      const url = URL.createObjectURL(file);
      const durationSec = await probeDuration(url, kind);
      additions.push({ id: uid("media"), name: file.name, kind, url, file, durationSec });
    }
    onProjectChange({ ...project, mediaBin: [...project.mediaBin, ...additions], updatedAt: Date.now() });
  }

  // ─── add clip to track ───
  function addPlacement(clip: MediaClip, trackId: string, startSec: number) {
    const next = project.tracks.map(t => {
      if (t.id !== trackId) return t;
      const pl: TimelinePlacement = {
        id: uid("pl"), clipId: clip.id, startSec, durationSec: clip.durationSec, trimStartSec: 0,
      };
      return { ...t, placements: [...t.placements, pl] };
    });
    onProjectChange({ ...project, tracks: next, updatedAt: Date.now() });
  }

  // ─── window-event listener for raw placement inserts ───
  // TrackRow's drop handler + Razor split dispatch a CustomEvent
  // because they don't have direct access to setState. We catch it
  // here and route to addPlacement / a direct mutation.
  useEffect(() => {
    function onAdd(e: Event) {
      const detail = (e as CustomEvent).detail as { trackId: string | null; placement: TimelinePlacement };
      if (!detail || !detail.placement) return;
      const targetTrackId = detail.trackId || (() => {
        // razor split: place on the track that already owns the placement
        for (const t of project.tracks) {
          if (t.placements.some(p => p.id === detail.placement.id)) return t.id;
        }
        return project.tracks[0]?.id || null;
      })();
      if (!targetTrackId) return;
      const next = project.tracks.map(t => t.id === targetTrackId ? { ...t, placements: [...t.placements, detail.placement] } : t);
      onProjectChange({ ...project, tracks: next, updatedAt: Date.now() });
    }
    window.addEventListener("poast-timeline-add-placement", onAdd as EventListener);
    return () => window.removeEventListener("poast-timeline-add-placement", onAdd as EventListener);
  }, [project, onProjectChange]);

  function updatePlacement(trackId: string, placementId: string, patch: Partial<TimelinePlacement>) {
    const next = project.tracks.map(t => {
      if (t.id !== trackId) return t;
      return { ...t, placements: t.placements.map(p => p.id === placementId ? { ...p, ...patch } : p) };
    });
    onProjectChange({ ...project, tracks: next, updatedAt: Date.now() });
  }

  function deleteSelected() {
    if (selectedIds.size === 0) return;
    const next = project.tracks.map(t => {
      return { ...t, placements: t.placements.filter(p => !selectedIds.has(p.id)), captions: t.captions?.filter(c => !selectedIds.has(c.id)) };
    });
    setSelectedIds(new Set());
    onProjectChange({ ...project, tracks: next, updatedAt: Date.now() });
  }

  function splitAtPlayhead() {
    let mutated = false;
    const next = project.tracks.map(t => {
      const out: TimelinePlacement[] = [];
      for (const p of t.placements) {
        if (playheadSec > p.startSec && playheadSec < p.startSec + p.durationSec) {
          const offset = playheadSec - p.startSec;
          out.push({ ...p, durationSec: offset });
          out.push({ id: uid("pl"), clipId: p.clipId, startSec: playheadSec, durationSec: p.durationSec - offset, trimStartSec: p.trimStartSec + offset });
          mutated = true;
        } else out.push(p);
      }
      return { ...t, placements: out };
    });
    if (mutated) onProjectChange({ ...project, tracks: next, updatedAt: Date.now() });
  }

  function toggleTrackProp(trackId: string, prop: "muted" | "hidden") {
    const next = project.tracks.map(t => t.id === trackId ? { ...t, [prop]: !t[prop] } : t);
    onProjectChange({ ...project, tracks: next, updatedAt: Date.now() });
  }

  function addTrack(kind: TrackKind) {
    const count = project.tracks.filter(t => t.kind === kind).length + 1;
    const labelMap: Record<TrackKind, string> = { video: "V", audio: "A", caption: "Captions", overlay: "Overlay" };
    const label = kind === "video" || kind === "audio" ? `${labelMap[kind]}${count}` : `${labelMap[kind]} ${count}`;
    const newTrack: TimelineTrack = { id: uid("trk"), kind, label, placements: [], captions: kind === "caption" ? [] : undefined };
    onProjectChange({ ...project, tracks: [...project.tracks, newTrack], updatedAt: Date.now() });
  }

  // ─── keyboard shortcuts ───
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLElement && ["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName)) return;
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key === "z" && !e.shiftKey) { e.preventDefault(); undo(); }
      else if ((mod && e.key === "y") || (mod && e.key === "z" && e.shiftKey)) { e.preventDefault(); redo(); }
      else if (mod && e.key === "/") { e.preventDefault(); splitAtPlayhead(); }
      else if (mod && e.key === "d") { e.preventDefault(); /* duplicate placeholder */ }
      else if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); deleteSelected(); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); onPlayheadChange(Math.max(0, playheadSec - (e.shiftKey ? 1 : 1 / 30))); }
      else if (e.key === "ArrowRight") { e.preventDefault(); onPlayheadChange(playheadSec + (e.shiftKey ? 1 : 1 / 30)); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project, playheadSec, selectedIds]);

  // ─── ruler click → playhead ───
  function onRulerClick(e: React.MouseEvent<HTMLDivElement>) {
    if (!scrollRef.current) return;
    const rect = scrollRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left + scrollRef.current.scrollLeft - TRACK_HEADER_WIDTH;
    onPlayheadChange(Math.max(0, x / pxPerSec));
  }

  // ─── export ───
  async function runExport(preset: Project["preset"]) {
    setExporting(true); setExportProgress(0);
    try {
      const updated = { ...project, preset };
      const blob = await exportTimeline(updated, { preset, burnCaptions: true, onProgress: (p: number) => setExportProgress(p) });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = (project.title || "timeline") + "_" + preset + ".mp4";
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      showToast("Exported.", "success");
    } catch (e) {
      showToast("Export failed: " + String(e).slice(0, 100), "error");
    } finally {
      setExporting(false); setExportProgress(0);
    }
  }

  // ─── render ───
  const cardBg = "#0D0D12";
  return (
    <div style={{ background: cardBg, border: "1px solid " + D.border, borderRadius: 12, display: "flex", flexDirection: "column", minHeight: 0, height: "100%", overflow: "hidden" }}>
      <Toolbar
        tool={tool} setTool={setTool}
        pxPerSec={pxPerSec} setPxPerSec={setPxPerSec}
        onUpload={onUpload}
        onUndo={undo} onRedo={redo}
        onSplit={splitAtPlayhead} onDelete={deleteSelected}
        onAddTrack={addTrack}
        onExport={runExport}
        exporting={exporting} exportProgress={exportProgress}
        preset={project.preset}
      />

      <div style={{ display: "grid", gridTemplateColumns: "240px minmax(0, 1fr)", flex: 1, minHeight: 0 }}>
        <MediaBin clips={project.mediaBin} onAddPlacement={addPlacement} tracks={project.tracks} />

        <div ref={scrollRef} style={{ overflow: "auto", position: "relative", background: "#06060C" }}>
          <Ruler duration={duration} pxPerSec={pxPerSec} onClick={onRulerClick} headerWidth={TRACK_HEADER_WIDTH} />
          <div style={{ position: "relative", paddingLeft: TRACK_HEADER_WIDTH }}>
            {project.tracks.map((t) => (
              <TrackRow
                key={t.id}
                track={t} project={project} pxPerSec={pxPerSec} tool={tool}
                selectedIds={selectedIds} setSelectedIds={setSelectedIds}
                onUpdatePlacement={(pid, patch) => updatePlacement(t.id, pid, patch)}
                onToggleProp={(prop) => toggleTrackProp(t.id, prop)}
                snap={snap}
              />
            ))}
            {/* Playhead overlay */}
            <div style={{ position: "absolute", top: 0, left: TRACK_HEADER_WIDTH + playheadSec * pxPerSec, width: 2, height: project.tracks.length * TRACK_HEIGHT, background: D.amber, pointerEvents: "none", boxShadow: "0 0 8px " + D.amber + "AA", zIndex: 6 }} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══ Toolbar ══════════════════════════════════════════════════════
function Toolbar(props: {
  tool: Tool; setTool: (t: Tool) => void;
  pxPerSec: number; setPxPerSec: (n: number) => void;
  onUpload: (f: FileList | null) => void;
  onUndo: () => void; onRedo: () => void;
  onSplit: () => void; onDelete: () => void;
  onAddTrack: (k: TrackKind) => void;
  onExport: (p: Project["preset"]) => void;
  exporting: boolean; exportProgress: number;
  preset: Project["preset"];
}) {
  const [exportOpen, setExportOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 12px", borderBottom: "1px solid " + D.border, background: "rgba(13,13,18,0.9)", flexWrap: "wrap" }}>
      <ToolBtn active={props.tool === "select"} onClick={() => props.setTool("select")} Icon={Move} title="Select" />
      <ToolBtn active={props.tool === "razor"} onClick={() => props.setTool("razor")} Icon={Scissors} title="Razor (split)" />
      <Sep />
      <label style={pillStyle(D.amber)}><Upload size={11} /> Upload<input type="file" accept="video/*,audio/*,image/*" multiple onChange={e => props.onUpload(e.target.files)} style={{ display: "none" }} /></label>
      <button onClick={props.onUndo} style={pillStyle(D.txm)}>Undo</button>
      <button onClick={props.onRedo} style={pillStyle(D.txm)}>Redo</button>
      <button onClick={props.onSplit} style={pillStyle(D.cyan)} title="Split at playhead (⌘/)"><Scissors size={11} /> Split</button>
      <button onClick={props.onDelete} style={pillStyle(D.coral)}><Trash2 size={11} /> Delete</button>
      <div style={{ position: "relative" }}>
        <button onClick={() => setAddOpen(o => !o)} style={pillStyle(D.violet)}><Plus size={11} /> Track</button>
        {addOpen && (
          <div style={dropdownStyle()}>
            {(["video", "audio", "caption", "overlay"] as TrackKind[]).map(k => (
              <button key={k} onClick={() => { setAddOpen(false); props.onAddTrack(k); }} style={dropdownItem()}>+ {k}</button>
            ))}
          </div>
        )}
      </div>

      <Sep />
      <ZoomOut size={12} color={D.txd} />
      <input type="range" min={20} max={400} value={props.pxPerSec} onChange={e => props.setPxPerSec(Number(e.target.value))} style={{ width: 120 }} />
      <ZoomIn size={12} color={D.txd} />
      <span style={{ fontFamily: mn, fontSize: 10, color: D.txd, minWidth: 60 }}>{props.pxPerSec}px/s</span>

      <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
        {props.exporting && <span style={{ fontFamily: mn, fontSize: 10, color: D.amber, display: "inline-flex", alignItems: "center", gap: 4 }}><Loader2 size={11} className="anim-spin" />{Math.round(props.exportProgress * 100)}%</span>}
        <div style={{ position: "relative" }}>
          <button onClick={() => setExportOpen(o => !o)} disabled={props.exporting} style={pillStyle(D.amber)}><Download size={11} /> Export</button>
          {exportOpen && (
            <div style={{ ...dropdownStyle(), right: 0, left: "auto" }}>
              {(["landscape", "square", "tiktok", "reels", "shorts"] as Project["preset"][]).map(p => (
                <button key={p} onClick={() => { setExportOpen(false); props.onExport(p); }} style={dropdownItem()}>{p}</button>
              ))}
            </div>
          )}
        </div>
      </div>
      <style>{`@keyframes spinFrame { 0% { transform: rotate(0); } 100% { transform: rotate(360deg); } } .anim-spin { animation: spinFrame 1.2s linear infinite; }`}</style>
    </div>
  );
}

function ToolBtn({ active, onClick, Icon, title }: { active: boolean; onClick: () => void; Icon: typeof Move; title: string }) {
  return <button onClick={onClick} title={title} style={{ background: active ? D.amber + "1F" : "transparent", border: "1px solid " + (active ? D.amber + "55" : D.border), borderRadius: 6, padding: 6, color: active ? D.amber : D.txm, cursor: "pointer", display: "inline-flex" }}><Icon size={13} /></button>;
}

function pillStyle(accent: string): React.CSSProperties {
  return { display: "inline-flex", alignItems: "center", gap: 4, padding: "5px 9px", borderRadius: 6, background: accent + "14", border: "1px solid " + accent + "44", color: accent, fontFamily: mn, fontSize: 10, fontWeight: 700, letterSpacing: 0.6, textTransform: "uppercase", cursor: "pointer" };
}

function dropdownStyle(): React.CSSProperties {
  return { position: "absolute", top: "100%", left: 0, marginTop: 4, background: "#0D0D12", border: "1px solid " + D.border, borderRadius: 6, padding: 4, minWidth: 120, zIndex: 50, boxShadow: "0 8px 22px rgba(0,0,0,0.55)" };
}
function dropdownItem(): React.CSSProperties {
  return { width: "100%", padding: "6px 9px", background: "transparent", border: "none", color: D.tx, fontFamily: mn, fontSize: 11, textAlign: "left", borderRadius: 4, cursor: "pointer" };
}
function Sep() {
  return <span style={{ width: 1, height: 22, background: D.border, margin: "0 4px" }} />;
}

// ═══ Media Bin ════════════════════════════════════════════════════
function MediaBin({ clips, onAddPlacement, tracks }: { clips: MediaClip[]; onAddPlacement: (c: MediaClip, trackId: string, startSec: number) => void; tracks: TimelineTrack[] }) {
  return (
    <div style={{ borderRight: "1px solid " + D.border, padding: 10, overflow: "auto" }}>
      <div style={{ fontFamily: mn, fontSize: 9, color: D.txd, letterSpacing: 1.6, textTransform: "uppercase", marginBottom: 8 }}>Media Bin · {clips.length}</div>
      {clips.length === 0 && <div style={{ fontFamily: ft, fontSize: 11, color: D.txd, padding: "16px 4px" }}>Drop clips with Upload above.</div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {clips.map(c => {
          const targetTrack = tracks.find(t => t.kind === (c.kind === "audio" ? "audio" : "video"));
          return (
            <button
              key={c.id}
              draggable
              onDragStart={e => { e.dataTransfer.setData("application/x-poast-clip", c.id); }}
              onClick={() => targetTrack && onAddPlacement(c, targetTrack.id, 0)}
              style={{ background: "rgba(255,255,255,0.02)", border: "1px solid " + D.border, borderRadius: 6, padding: 8, color: D.tx, textAlign: "left", cursor: "grab", display: "flex", alignItems: "center", gap: 8 }}
              title="Drag to track or click to insert"
            >
              {c.kind === "video" ? <Film size={12} color={D.amber} /> : c.kind === "audio" ? <Music size={12} color={D.teal} /> : <Layers size={12} color={D.violet} />}
              <span style={{ flex: 1, fontFamily: ft, fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</span>
              <span style={{ fontFamily: mn, fontSize: 9, color: D.txd }}>{fmtSec(c.durationSec)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ═══ Ruler ════════════════════════════════════════════════════════
function Ruler({ duration, pxPerSec, onClick, headerWidth }: { duration: number; pxPerSec: number; onClick: (e: React.MouseEvent<HTMLDivElement>) => void; headerWidth: number }) {
  const totalPx = duration * pxPerSec + 200;
  const majorEverySec = pxPerSec < 50 ? 10 : pxPerSec < 120 ? 5 : 1;
  const ticks: { sec: number; major: boolean }[] = [];
  for (let s = 0; s * pxPerSec < totalPx; s++) {
    ticks.push({ sec: s, major: s % majorEverySec === 0 });
  }
  return (
    <div onClick={onClick} style={{ position: "sticky", top: 0, height: RULER_HEIGHT, background: "rgba(13,13,18,0.95)", borderBottom: "1px solid " + D.border, paddingLeft: headerWidth, zIndex: 5, minWidth: totalPx + headerWidth, cursor: "pointer" }}>
      {ticks.map(t => (
        <div key={t.sec} style={{ position: "absolute", left: headerWidth + t.sec * pxPerSec, top: 0, height: t.major ? RULER_HEIGHT : RULER_HEIGHT - 14, width: 1, background: t.major ? D.txm : D.border }}>
          {t.major && <span style={{ position: "absolute", top: 2, left: 4, fontFamily: mn, fontSize: 9, color: D.txd }}>{fmtSec(t.sec)}</span>}
        </div>
      ))}
    </div>
  );
}

// ═══ Track Row ════════════════════════════════════════════════════
function TrackRow({ track, project, pxPerSec, tool, selectedIds, setSelectedIds, onUpdatePlacement, onToggleProp, snap }: {
  track: TimelineTrack; project: Project; pxPerSec: number; tool: Tool;
  selectedIds: Set<string>; setSelectedIds: (s: Set<string>) => void;
  onUpdatePlacement: (pid: string, patch: Partial<TimelinePlacement>) => void;
  onToggleProp: (prop: "muted" | "hidden") => void;
  snap: (sec: number, excludeId?: string) => number;
}) {
  const accent = KIND_ACCENT[track.kind];
  const Icon = KIND_ICON[track.kind];
  const laneRef = useRef<HTMLDivElement | null>(null);
  const duration = projectDuration(project);
  const laneWidth = Math.max(duration * pxPerSec, 800);

  function onDropOnLane(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    const clipId = e.dataTransfer.getData("application/x-poast-clip");
    if (!clipId) return;
    const clip = findClip(project, clipId);
    if (!clip) return;
    const compatible = (track.kind === "audio" && clip.kind === "audio") || (track.kind === "video" && clip.kind !== "audio") || (track.kind === "overlay");
    if (!compatible) { showToast("That clip kind doesn't fit this track.", "info"); return; }
    if (!laneRef.current) return;
    const rect = laneRef.current.getBoundingClientRect();
    const sec = snap(Math.max(0, (e.clientX - rect.left) / pxPerSec));
    const next: TimelinePlacement = { id: uid("pl"), clipId, startSec: sec, durationSec: clip.durationSec, trimStartSec: 0 };
    // We mutate via onUpdatePlacement? No — we need parent insertion. Hack: append + use updatePlacement as a synthetic add. Cleaner: dispatch a custom event the editor listens to. For v1, simply mutate via the project shape directly using the parent helper through onUpdatePlacement isn't possible; use a fallback approach via window event.
    window.dispatchEvent(new CustomEvent("poast-timeline-add-placement", { detail: { trackId: track.id, placement: next } }));
  }

  return (
    <div style={{ position: "relative", height: TRACK_HEIGHT, borderBottom: "1px solid " + D.border, opacity: track.hidden ? 0.45 : 1 }}>
      {/* Track header */}
      <div style={{ position: "absolute", left: -TRACK_HEADER_WIDTH, top: 0, width: TRACK_HEADER_WIDTH, height: "100%", background: "rgba(13,13,18,0.9)", borderRight: "1px solid " + D.border, padding: "8px 10px", display: "flex", flexDirection: "column", gap: 4 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Icon size={12} color={accent} />
          <span style={{ fontFamily: mn, fontSize: 10, fontWeight: 800, color: accent, letterSpacing: 1, textTransform: "uppercase" }}>{track.label}</span>
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          <button onClick={() => onToggleProp("hidden")} title={track.hidden ? "Show" : "Hide"} style={iconBtnStyle()}>{track.hidden ? <EyeOff size={10} /> : <Eye size={10} />}</button>
          <button onClick={() => onToggleProp("muted")} title={track.muted ? "Unmute" : "Mute"} style={iconBtnStyle()}>{track.muted ? <VolumeX size={10} color={D.coral} /> : <Volume2 size={10} />}</button>
        </div>
      </div>

      {/* Lane */}
      <div ref={laneRef} onDragOver={e => e.preventDefault()} onDrop={onDropOnLane} style={{ position: "absolute", left: 0, top: 0, width: laneWidth, height: "100%", background: "rgba(255,255,255,0.01)" }}>
        {track.placements.map(p => (
          <PlacementCard
            key={p.id}
            placement={p}
            project={project}
            pxPerSec={pxPerSec}
            accent={accent}
            tool={tool}
            selected={selectedIds.has(p.id)}
            onSelect={(additive) => {
              const next = new Set(additive ? selectedIds : []);
              next.add(p.id); setSelectedIds(next);
            }}
            onPatch={(patch) => onUpdatePlacement(p.id, patch)}
            snap={snap}
          />
        ))}
        {track.captions && track.captions.map(c => (
          <CaptionCard key={c.id} cue={c} pxPerSec={pxPerSec} accent={accent} />
        ))}
      </div>
    </div>
  );
}

function iconBtnStyle(): React.CSSProperties {
  return { background: "transparent", border: "1px solid " + D.border, borderRadius: 4, padding: 3, color: D.txm, cursor: "pointer", display: "inline-flex" };
}

// ═══ Placement Card (a clip on a track) ═══════════════════════════
function PlacementCard({ placement, project, pxPerSec, accent, tool, selected, onSelect, onPatch, snap }: {
  placement: TimelinePlacement; project: Project; pxPerSec: number; accent: string; tool: Tool;
  selected: boolean; onSelect: (additive: boolean) => void; onPatch: (patch: Partial<TimelinePlacement>) => void;
  snap: (sec: number, excludeId?: string) => number;
}) {
  const clip = findClip(project, placement.clipId);
  const name = clip?.name || "Clip";
  const dragRef = useRef<{ kind: "body" | "left" | "right"; startX: number; orig: TimelinePlacement } | null>(null);

  function onMouseDown(e: React.MouseEvent, kind: "body" | "left" | "right") {
    e.stopPropagation();
    if (tool === "razor") {
      // Split at click x
      const card = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const offsetSec = (e.clientX - card.left) / pxPerSec;
      if (offsetSec > 0.1 && offsetSec < placement.durationSec - 0.1) {
        onPatch({ durationSec: offsetSec });
        const tailId = uid("pl");
        window.dispatchEvent(new CustomEvent("poast-timeline-add-placement", { detail: { trackId: null, placement: { id: tailId, clipId: placement.clipId, startSec: placement.startSec + offsetSec, durationSec: placement.durationSec - offsetSec, trimStartSec: placement.trimStartSec + offsetSec } } }));
      }
      return;
    }
    onSelect(e.shiftKey);
    dragRef.current = { kind, startX: e.clientX, orig: { ...placement } };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }
  function onMove(e: MouseEvent) {
    if (!dragRef.current) return;
    const deltaSec = (e.clientX - dragRef.current.startX) / pxPerSec;
    if (dragRef.current.kind === "body") {
      const next = snap(Math.max(0, dragRef.current.orig.startSec + deltaSec), placement.id);
      onPatch({ startSec: next });
    } else if (dragRef.current.kind === "left") {
      const target = Math.max(0, dragRef.current.orig.startSec + deltaSec);
      const trim = Math.max(0, dragRef.current.orig.trimStartSec + deltaSec);
      const dur = Math.max(0.2, dragRef.current.orig.durationSec - deltaSec);
      onPatch({ startSec: target, trimStartSec: trim, durationSec: dur });
    } else if (dragRef.current.kind === "right") {
      const dur = Math.max(0.2, dragRef.current.orig.durationSec + deltaSec);
      onPatch({ durationSec: dur });
    }
  }
  function onUp() {
    dragRef.current = null;
    document.removeEventListener("mousemove", onMove);
    document.removeEventListener("mouseup", onUp);
  }

  const left = placement.startSec * pxPerSec;
  const width = Math.max(12, placement.durationSec * pxPerSec);
  return (
    <div
      onMouseDown={(e) => onMouseDown(e, "body")}
      style={{
        position: "absolute", top: 6, left, width, height: TRACK_HEIGHT - 14,
        background: accent + "20", border: "1px solid " + (selected ? D.amber : accent + "55"),
        borderRadius: 6, padding: "4px 8px", color: accent, fontFamily: mn, fontSize: 10,
        cursor: tool === "razor" ? "crosshair" : "grab",
        overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis",
        boxShadow: selected ? "0 0 0 2px " + D.amber + "AA" : "none",
        userSelect: "none",
      }}
    >
      <span style={{ display: "inline-block", maxWidth: width - 24 }}>{name}</span>
      <div onMouseDown={(e) => onMouseDown(e, "left")} style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 6, cursor: "ew-resize", background: "linear-gradient(90deg, " + accent + "60, transparent)" }} />
      <div onMouseDown={(e) => onMouseDown(e, "right")} style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: 6, cursor: "ew-resize", background: "linear-gradient(270deg, " + accent + "60, transparent)" }} />
    </div>
  );
}

function CaptionCard({ cue, pxPerSec, accent }: { cue: CaptionCue; pxPerSec: number; accent: string }) {
  const left = cue.startSec * pxPerSec;
  const width = Math.max(20, (cue.endSec - cue.startSec) * pxPerSec);
  return (
    <div style={{ position: "absolute", top: 8, left, width, height: TRACK_HEIGHT - 16, background: accent + "12", border: "1px dashed " + accent + "66", borderRadius: 4, padding: "3px 6px", color: accent, fontFamily: ft, fontSize: 10, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
      {cue.text}
    </div>
  );
}

// ═══ helpers ══════════════════════════════════════════════════════
function fmtSec(s: number): string {
  if (!isFinite(s) || s < 0) return "0:00";
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return m + ":" + String(r).padStart(2, "0");
}

async function probeDuration(url: string, kind: ClipKind): Promise<number> {
  if (kind === "image") return 5;
  return new Promise((res) => {
    const el = document.createElement(kind === "audio" ? "audio" : "video");
    el.preload = "metadata";
    el.onloadedmetadata = () => res(el.duration || 5);
    el.onerror = () => res(5);
    el.src = url;
  });
}
