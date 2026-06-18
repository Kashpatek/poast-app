"use client";

// ProductionSTUDIO · Clip Engine (the "Opus killer" review deck).
//
// Flow: upload a big file (presigned → direct to R2) or paste a YouTube URL →
// poll the transcription job → auto-run detect + resolve → review candidate
// clips (hook / score / in-out / preview) → approve sends the clip to the
// existing Timeline Editor, pre-seeded and pre-trimmed.

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { D, ft, gf, mn, uid } from "../shared-constants";
import { saveProject } from "../design-studio/projects-store";
import type { Project, MediaClip, TimelineTrack } from "./timeline/types";

type Phase = "idle" | "uploading" | "processing" | "review" | "error";

interface Candidate {
  id: string;
  job_id: string;
  start_idx: number;
  end_idx: number;
  start_s: number | null;
  end_s: number | null;
  hook: string;
  score: number;
  status: "pending" | "approved" | "rejected";
  reason: string | null;
}

const POLL_MS = 6000;

function mmss(s: number | null): string {
  if (s == null) return "--:--";
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${m}:${String(r).padStart(2, "0")}`;
}

export default function ClipEngine() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("idle");
  const [statusLabel, setStatusLabel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [jobId, setJobId] = useState<string | null>(null);
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [sourceType, setSourceType] = useState<"youtube" | "r2" | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const detectStartedRef = useRef(false);

  const fail = useCallback((msg: string) => {
    setError(msg);
    setPhase("error");
  }, []);

  // ── Detect + resolve once the transcript is ready ──
  const runDetectResolve = useCallback(
    async (id: string) => {
      if (detectStartedRef.current) return;
      detectStartedRef.current = true;
      try {
        setStatusLabel("Finding clip moments…");
        const dRes = await fetch("/api/clip/detect", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ job_id: id }),
        });
        if (!dRes.ok) throw new Error((await dRes.json()).error || "detect failed");

        setStatusLabel("Snapping to clean boundaries…");
        const rRes = await fetch("/api/clip/resolve", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ job_id: id }),
        });
        if (!rRes.ok) throw new Error((await rRes.json()).error || "resolve failed");
        const data = await rRes.json();
        setCandidates(data.candidates || []);
        setSourceUrl(data.source_url ?? sourceUrl);
        setPhase("review");
      } catch (e) {
        fail((e as Error).message);
      }
    },
    [fail, sourceUrl]
  );

  // ── Poll the job until transcribed ──
  useEffect(() => {
    if (phase !== "processing" || !jobId) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    const poll = async () => {
      try {
        const res = await fetch(`/api/clip/job/${jobId}`);
        const data = await res.json();
        if (cancelled) return;
        if (data.status === "error") return fail(data.error || "transcription failed");
        if (data.status === "transcribed" || data.status === "done") {
          runDetectResolve(jobId);
          return;
        }
        setStatusLabel(
          data.status === "transcribing" ? "Transcribing audio…" : `Status: ${data.status}`
        );
        timer = setTimeout(poll, POLL_MS);
      } catch {
        if (!cancelled) timer = setTimeout(poll, POLL_MS);
      }
    };
    poll();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [phase, jobId, fail, runDetectResolve]);

  // ── Ingest: file upload (presigned R2) ──
  const onFile = useCallback(
    async (file: File) => {
      setError(null);
      detectStartedRef.current = false;
      setPhase("uploading");
      setStatusLabel("Requesting upload URL…");
      try {
        const contentType = file.type || "video/mp4";
        const presign = await fetch("/api/clip/upload-url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ filename: file.name, contentType, sizeBytes: file.size }),
        });
        if (!presign.ok) throw new Error((await presign.json()).error || "presign failed");
        const { uploadUrl, publicUrl } = await presign.json();

        setStatusLabel("Uploading to storage… (large files take a bit)");
        const put = await fetch(uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": contentType },
          body: file,
        });
        if (!put.ok) throw new Error(`upload failed (${put.status})`);

        await startJob({ type: "r2", url: publicUrl });
      } catch (e) {
        fail((e as Error).message);
      }
    },
    [fail]
  );

  // ── Ingest: YouTube URL ──
  const onYoutube = useCallback(async () => {
    const url = youtubeUrl.trim();
    if (!/^https?:\/\//i.test(url)) return fail("Enter a valid YouTube URL");
    setError(null);
    detectStartedRef.current = false;
    await startJob({ type: "youtube", url });
  }, [youtubeUrl, fail]);

  const startJob = useCallback(
    async (source: { type: "youtube" | "r2"; url: string }) => {
      setPhase("processing");
      setStatusLabel("Queuing transcription…");
      setSourceUrl(source.url);
      setSourceType(source.type);
      try {
        const res = await fetch("/api/clip/ingest", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ source }),
        });
        if (!res.ok) throw new Error((await res.json()).error || "ingest failed");
        const { job_id } = await res.json();
        setJobId(job_id);
      } catch (e) {
        fail((e as Error).message);
      }
    },
    [fail]
  );

  // ── Approve → seed the existing Timeline Editor ──
  const approve = useCallback(
    async (cand: Candidate) => {
      if (!sourceUrl || cand.start_s == null || cand.end_s == null) return;
      const dur = cand.end_s - cand.start_s;
      const clipId = uid("clip");
      const media: MediaClip = {
        id: clipId,
        name: cand.hook || "Clip",
        kind: "video",
        url: sourceUrl,
        durationSec: dur,
      };
      const track: TimelineTrack = {
        id: uid("track-v"),
        kind: "video",
        label: "V1",
        placements: [
          { id: uid("p"), clipId, startSec: 0, durationSec: dur, trimStartSec: cand.start_s },
        ],
      };
      const now = Date.now();
      const project: Project = {
        id: "clip-" + cand.id,
        title: cand.hook || "Clip",
        preset: "tiktok",
        mediaBin: [media],
        tracks: [track],
        createdAt: now,
        updatedAt: now,
      };
      setCandidates((cs) => cs.map((c) => (c.id === cand.id ? { ...c, status: "approved" } : c)));
      fetch("/api/clip/candidates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: cand.id, status: "approved" }),
      }).catch(() => {});
      await saveProject({
        id: "clip-" + cand.id,
        title: cand.hook || "Clip",
        kind: "motion",
        pages: [{ id: uid("page"), payload: project }],
      });
      router.push("/production-studio/timeline?project=clip-" + cand.id);
    },
    [sourceUrl, router]
  );

  const reject = useCallback((cand: Candidate) => {
    setCandidates((cs) => cs.map((c) => (c.id === cand.id ? { ...c, status: "rejected" } : c)));
    fetch("/api/clip/candidates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: cand.id, status: "rejected" }),
    }).catch(() => {});
  }, []);

  const reset = useCallback(() => {
    setPhase("idle");
    setError(null);
    setJobId(null);
    setCandidates([]);
    setSourceUrl(null);
    setSourceType(null);
    setYoutubeUrl("");
    detectStartedRef.current = false;
  }, []);

  // ── Render ──
  const shown = candidates.filter((c) => c.status !== "rejected");
  const rejected = candidates.filter((c) => c.status === "rejected");
  const canPreview = sourceType === "r2" && !!sourceUrl;

  return (
    <div style={{ padding: "24px", maxWidth: 1100, margin: "0 auto" }}>
      {(phase === "idle" || phase === "error") && (
        <div style={panel}>
          <div style={{ fontFamily: gf, fontSize: 16, color: D.tx, marginBottom: 4 }}>
            Drop an episode in, get reviewable clips out
          </div>
          <div style={{ fontFamily: ft, fontSize: 13, color: D.txm, marginBottom: 18 }}>
            Upload a video/audio file (any size — it goes straight to storage) or paste a YouTube link.
          </div>

          <label style={uploadBtn}>
            ⬆ Upload video / audio
            <input
              type="file"
              accept="video/*,audio/*"
              style={{ display: "none" }}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onFile(f);
              }}
            />
          </label>

          <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "16px 0 6px" }}>
            <div style={{ flex: 1, height: 1, background: D.border }} />
            <span style={{ fontFamily: mn, fontSize: 11, color: D.txd }}>OR</span>
            <div style={{ flex: 1, height: 1, background: D.border }} />
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <input
              value={youtubeUrl}
              onChange={(e) => setYoutubeUrl(e.target.value)}
              placeholder="https://youtube.com/watch?v=…"
              style={textInput}
            />
            <button onClick={onYoutube} style={primaryBtn}>
              Ingest
            </button>
          </div>

          {error && (
            <div style={{ marginTop: 16, color: D.crimson, fontFamily: mn, fontSize: 12 }}>
              ⚠ {error}
            </div>
          )}
        </div>
      )}

      {(phase === "uploading" || phase === "processing") && (
        <div style={{ ...panel, textAlign: "center", padding: "48px 24px" }}>
          <div style={{ fontFamily: gf, fontSize: 18, color: D.amber, marginBottom: 8 }}>
            {statusLabel || "Working…"}
          </div>
          <div style={{ fontFamily: mn, fontSize: 12, color: D.txd }}>
            {phase === "processing"
              ? "Transcription runs on the worker — a full episode can take a few minutes."
              : "Uploading directly to storage."}
          </div>
          <button onClick={reset} style={{ ...ghostBtn, marginTop: 20 }}>
            Cancel
          </button>
        </div>
      )}

      {phase === "review" && (
        <div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 16,
            }}
          >
            <div style={{ fontFamily: gf, fontSize: 18, color: D.tx }}>
              {shown.length} clip{shown.length === 1 ? "" : "s"} ready to review
            </div>
            <button onClick={reset} style={ghostBtn}>
              ＋ New clip job
            </button>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
              gap: 16,
            }}
          >
            {shown.map((c) => (
              <div key={c.id} style={card}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <div style={{ fontFamily: gf, fontSize: 15, color: D.tx }}>{c.hook}</div>
                  <span style={scoreBadge(c.score)}>{Math.round(c.score * 100)}</span>
                </div>
                <div style={{ fontFamily: mn, fontSize: 11, color: D.txm, margin: "6px 0 10px" }}>
                  {mmss(c.start_s)} – {mmss(c.end_s)}
                  {c.start_s != null && c.end_s != null
                    ? ` · ${Math.round(c.end_s - c.start_s)}s`
                    : ""}
                  {c.status === "approved" ? "  ✓ sent to editor" : ""}
                </div>

                {canPreview && c.start_s != null && c.end_s != null && (
                  <ClipPreview src={sourceUrl as string} start={c.start_s} end={c.end_s} />
                )}

                <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                  <button onClick={() => approve(c)} style={{ ...primaryBtn, flex: 1 }}>
                    {c.status === "approved" ? "Open in editor" : "Approve → editor"}
                  </button>
                  <button onClick={() => reject(c)} style={ghostBtn}>
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>

          {!canPreview && sourceType === "youtube" && (
            <div style={{ marginTop: 16, fontFamily: mn, fontSize: 11, color: D.txd }}>
              Preview is available for uploaded files. YouTube clips still hand off to the editor by
              timecode.
            </div>
          )}

          {rejected.length > 0 && (
            <div style={{ marginTop: 20, fontFamily: mn, fontSize: 11, color: D.txd }}>
              {rejected.length} filtered out: {rejected.map((r) => r.reason).filter(Boolean).join(" · ")}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Clamp a <video> to [start, end] so the card previews just the clip window.
function ClipPreview({ src, start, end }: { src: string; start: number; end: number }) {
  const ref = useRef<HTMLVideoElement>(null);
  return (
    <video
      ref={ref}
      src={src}
      controls
      preload="metadata"
      style={{ width: "100%", borderRadius: 8, background: "#000", aspectRatio: "16/9" }}
      onLoadedMetadata={(e) => {
        e.currentTarget.currentTime = start;
      }}
      onTimeUpdate={(e) => {
        const v = e.currentTarget;
        if (v.currentTime >= end) {
          v.pause();
          v.currentTime = start;
        }
      }}
    />
  );
}

// ── styles ──
const panel: React.CSSProperties = {
  background: D.card,
  border: `1px solid ${D.border}`,
  borderRadius: 12,
  padding: 24,
};
const card: React.CSSProperties = {
  background: D.cardGrad,
  border: `1px solid ${D.border}`,
  borderRadius: 12,
  padding: 16,
};
const textInput: React.CSSProperties = {
  flex: 1,
  background: D.surface,
  border: `1px solid ${D.border}`,
  borderRadius: 8,
  padding: "10px 12px",
  color: D.tx,
  fontFamily: mn,
  fontSize: 13,
  outline: "none",
};
const primaryBtn: React.CSSProperties = {
  background: D.amber,
  color: "#1a1206",
  border: "none",
  borderRadius: 8,
  padding: "10px 16px",
  fontFamily: mn,
  fontSize: 12,
  fontWeight: 600,
  letterSpacing: 0.4,
  cursor: "pointer",
};
const ghostBtn: React.CSSProperties = {
  background: "transparent",
  color: D.txm,
  border: `1px solid ${D.border}`,
  borderRadius: 8,
  padding: "10px 14px",
  fontFamily: mn,
  fontSize: 12,
  cursor: "pointer",
};
const uploadBtn: React.CSSProperties = {
  ...primaryBtn,
  display: "inline-block",
  textAlign: "center",
};
function scoreBadge(score: number): React.CSSProperties {
  const c = score >= 0.8 ? D.teal : score >= 0.6 ? D.amber : D.txm;
  return {
    fontFamily: mn,
    fontSize: 12,
    fontWeight: 700,
    color: c,
    border: `1px solid ${c}`,
    borderRadius: 6,
    padding: "2px 8px",
  };
}
