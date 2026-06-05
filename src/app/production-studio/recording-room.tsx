"use client";

// Recording Room — solo browser recording (mic + cam) for v1. Multi-track
// remote is a follow-up. We use the native MediaRecorder API (not RecordRTC)
// because the repo doesn't actually have recordrtc installed and MediaRecorder
// covers the v1 needs (start/pause/resume/stop + blob output) without adding
// a dep. AudioContext drives the live level meter off a tap of the same
// MediaStream so the meter pulses even while paused-vs-stopped indicate
// correctly.

import React, { useEffect, useRef, useState } from "react";
import { Mic, Video, Square, Play, Pause, Upload, Copy, Check, AlertTriangle } from "lucide-react";
import { D, ft, gf, mn, copyText } from "../shared-constants";
import { showToast } from "../toast-context";

type Permission = "pending" | "granted" | "denied";
type Status = "idle" | "recording" | "paused" | "uploading" | "done";

function fmt(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0");
}

function blobToDataURL(b: Blob): Promise<string> {
  return new Promise(function (resolve, reject) {
    const r = new FileReader();
    r.onload = function () { resolve(String(r.result || "")); };
    r.onerror = function () { reject(r.error); };
    r.readAsDataURL(b);
  });
}

function pickMime(): string {
  // Prefer webm/vp9, fall back through what the browser supports.
  const candidates = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
    "video/mp4",
  ];
  if (typeof MediaRecorder === "undefined") return "video/webm";
  for (const c of candidates) {
    try {
      if (MediaRecorder.isTypeSupported(c)) return c;
    } catch (e) {}
  }
  return "video/webm";
}

export default function RecordingRoom() {
  const [permission, setPermission] = useState<Permission>("pending");
  const [permError, setPermError] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [elapsedSec, setElapsedSec] = useState(0);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [finalUrl, setFinalUrl] = useState<string | null>(null);
  const [level, setLevel] = useState(0); // 0..1 RMS
  const [copied, setCopied] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const mimeRef = useRef<string>("video/webm");
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const meterRafRef = useRef<number | null>(null);
  const timerRef = useRef<number | null>(null);
  const startedAtRef = useRef<number>(0);
  const accumElapsedRef = useRef<number>(0);

  useEffect(function () {
    return function cleanup() {
      stopMeter();
      stopTimer();
      try { recorderRef.current && recorderRef.current.state !== "inactive" && recorderRef.current.stop(); } catch (e) {}
      try { audioCtxRef.current && audioCtxRef.current.close(); } catch (e) {}
      const s = streamRef.current;
      if (s) s.getTracks().forEach(function (t) { try { t.stop(); } catch (e) {} });
    };
  }, []);

  function stopMeter() {
    if (meterRafRef.current != null) {
      cancelAnimationFrame(meterRafRef.current);
      meterRafRef.current = null;
    }
  }
  function stopTimer() {
    if (timerRef.current != null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  async function grantPermission() {
    setPermError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      streamRef.current = stream;
      setPermission("granted");
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        try { await videoRef.current.play(); } catch (e) {}
      }
      // Wire up AudioContext for the live meter — tap the same stream.
      const Ctor: typeof AudioContext = (window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext);
      const ctx = new Ctor();
      audioCtxRef.current = ctx;
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      src.connect(analyser);
      analyserRef.current = analyser;
      runMeter();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setPermError(msg);
      setPermission("denied");
    }
  }

  function runMeter() {
    const analyser = analyserRef.current;
    if (!analyser) return;
    const buf = new Uint8Array(analyser.fftSize);
    const tick = function () {
      analyser.getByteTimeDomainData(buf);
      let sum = 0;
      for (let i = 0; i < buf.length; i++) {
        const v = (buf[i] - 128) / 128;
        sum += v * v;
      }
      const rms = Math.sqrt(sum / buf.length);
      // Boost a bit so a soft voice still moves the bar meaningfully.
      setLevel(Math.min(1, rms * 2.4));
      meterRafRef.current = requestAnimationFrame(tick);
    };
    meterRafRef.current = requestAnimationFrame(tick);
  }

  function startTimer() {
    startedAtRef.current = Date.now();
    timerRef.current = window.setInterval(function () {
      const live = Math.floor((Date.now() - startedAtRef.current) / 1000);
      setElapsedSec(accumElapsedRef.current + live);
    }, 250);
  }

  function pauseTimer() {
    if (timerRef.current != null) {
      const live = Math.floor((Date.now() - startedAtRef.current) / 1000);
      accumElapsedRef.current += live;
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  function resetTimer() {
    stopTimer();
    accumElapsedRef.current = 0;
    setElapsedSec(0);
  }

  function startRecording() {
    const stream = streamRef.current;
    if (!stream) return;
    chunksRef.current = [];
    const mime = pickMime();
    mimeRef.current = mime;
    let rec: MediaRecorder;
    try {
      rec = new MediaRecorder(stream, { mimeType: mime });
    } catch (e) {
      // Some browsers reject the option — fall back to default.
      rec = new MediaRecorder(stream);
      mimeRef.current = rec.mimeType || "video/webm";
    }
    rec.ondataavailable = function (e: BlobEvent) {
      if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
    };
    rec.onstop = function () {
      // upload kicked off from stopRecording() once state settles
    };
    recorderRef.current = rec;
    rec.start(1000);
    resetTimer();
    startTimer();
    setStatus("recording");
    setFinalUrl(null);
    setUploadProgress(0);
  }

  function pauseRecording() {
    const rec = recorderRef.current;
    if (!rec || rec.state !== "recording") return;
    try { rec.pause(); } catch (e) {}
    pauseTimer();
    setStatus("paused");
  }

  function resumeRecording() {
    const rec = recorderRef.current;
    if (!rec || rec.state !== "paused") return;
    try { rec.resume(); } catch (e) {}
    startTimer();
    setStatus("recording");
  }

  async function stopRecording() {
    const rec = recorderRef.current;
    if (!rec || rec.state === "inactive") return;
    // Capture the stopped event before issuing stop().
    const done = new Promise<void>(function (resolve) {
      const handler = function () {
        rec.removeEventListener("stop", handler);
        resolve();
      };
      rec.addEventListener("stop", handler);
    });
    try { rec.stop(); } catch (e) {}
    pauseTimer();
    setStatus("uploading");
    await done;

    const mime = mimeRef.current || "video/webm";
    const blob = new Blob(chunksRef.current, { type: mime });
    chunksRef.current = [];

    try {
      await uploadBlob(blob, mime);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      showToast("Upload failed: " + msg, "error");
      setStatus("idle");
      setUploadProgress(0);
    }
  }

  async function uploadBlob(blob: Blob, mime: string) {
    // The /api/upload-asset endpoint accepts a JSON body with a base64 data
    // URL — convert + POST. XHR is used so we can report progress as the body
    // streams up to the server.
    const ext = mime.indexOf("mp4") >= 0 ? "mp4" : "webm";
    const filename = "recording-" + Date.now() + "." + ext;
    const dataUrl = await blobToDataURL(blob);
    const payload = JSON.stringify({ data: dataUrl, filename, contentType: mime });

    const url = await new Promise<string>(function (resolve, reject) {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", "/api/upload-asset");
      xhr.setRequestHeader("Content-Type", "application/json");
      xhr.upload.onprogress = function (e) {
        if (e.lengthComputable) {
          setUploadProgress(Math.round((e.loaded / e.total) * 100));
        }
      };
      xhr.onload = function () {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const res = JSON.parse(xhr.responseText);
            if (res && res.url) {
              resolve(res.url);
              return;
            }
            reject(new Error("No url in response"));
          } catch (e) {
            reject(e);
          }
        } else {
          reject(new Error("HTTP " + xhr.status + ": " + xhr.responseText));
        }
      };
      xhr.onerror = function () { reject(new Error("Network error during upload")); };
      xhr.send(payload);
    });

    setFinalUrl(url);
    setUploadProgress(100);
    setStatus("done");
    showToast("Recording uploaded", "success");
  }

  function copyUrl() {
    if (!finalUrl) return;
    const ok = copyText(finalUrl);
    if (ok) {
      setCopied(true);
      window.setTimeout(function () { setCopied(false); }, 1400);
    }
  }

  function resetSession() {
    setFinalUrl(null);
    setUploadProgress(0);
    resetTimer();
    setStatus("idle");
  }

  // ─── Render ───────────────────────────────────────────────────────

  if (permission === "pending" || permission === "denied") {
    return (
      <div style={{ padding: 40, maxWidth: 720, margin: "0 auto" }}>
        <div style={{ ...panel, padding: 32 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
            <div
              style={{
                width: 44, height: 44, borderRadius: 12,
                background: D.coral + "1c", border: "1px solid " + D.coral + "55",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >
              <Mic size={20} color={D.coral} strokeWidth={1.8} />
            </div>
            <div>
              <div style={{ fontFamily: gf, fontSize: 22, color: D.tx }}>Recording Room</div>
              <div style={{ fontFamily: ft, fontSize: 13, color: D.txm, marginTop: 2 }}>
                Browser-based solo recording — mic + camera.
              </div>
            </div>
          </div>
          <div style={{ fontFamily: ft, fontSize: 14, color: D.txm, lineHeight: 1.55, marginBottom: 20 }}>
            We need access to your microphone and camera to start. The stream stays local until you press
            Stop — then it uploads to Vercel Blob and you get a shareable link.
          </div>
          {permError ? (
            <div
              style={{
                display: "flex", alignItems: "flex-start", gap: 10,
                padding: "10px 12px", borderRadius: 8,
                background: D.crimson + "12", border: "1px solid " + D.crimson + "55",
                marginBottom: 16, fontFamily: mn, fontSize: 12, color: D.tx,
              }}
            >
              <AlertTriangle size={14} color={D.crimson} style={{ marginTop: 2 }} />
              <span>{permError}</span>
            </div>
          ) : null}
          <button onClick={grantPermission} style={btnPrimary(D.coral)}>
            <Mic size={14} /> <Video size={14} /> &nbsp;Grant mic + camera
          </button>
        </div>
      </div>
    );
  }

  const meterPct = Math.round(level * 100);
  const isBusy = status === "uploading";

  return (
    <div style={{ padding: "24px 32px 64px", maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1.45fr 1fr", gap: 18 }}>
        {/* Preview */}
        <div style={panel}>
          <div style={panelLabel}>PREVIEW</div>
          <div style={{ background: "#000", borderRadius: 8, overflow: "hidden", aspectRatio: "16 / 9" }}>
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          </div>
          <div
            style={{
              display: "flex", alignItems: "center", gap: 10,
              marginTop: 12, fontFamily: mn, fontSize: 12, color: D.txm,
            }}
          >
            <span
              style={{
                width: 8, height: 8, borderRadius: "50%",
                background: status === "recording" ? D.crimson : status === "paused" ? D.amber : D.txd,
                boxShadow: status === "recording" ? "0 0 12px " + D.crimson : "none",
              }}
            />
            <span style={{ textTransform: "uppercase", letterSpacing: 1 }}>{status}</span>
            <span style={{ flex: 1 }} />
            <span style={{ fontFamily: mn, fontSize: 18, color: D.tx, letterSpacing: 1 }}>
              {fmt(elapsedSec)}
            </span>
          </div>
        </div>

        {/* Meter + controls */}
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={panel}>
            <div style={panelLabel}>AUDIO LEVEL</div>
            <div
              style={{
                position: "relative",
                height: 18, borderRadius: 9,
                background: "rgba(255,255,255,0.04)",
                border: "1px solid " + D.border, overflow: "hidden",
              }}
            >
              <div
                style={{
                  position: "absolute", inset: 0, width: meterPct + "%",
                  background: "linear-gradient(90deg, " + D.amber + "ee, " + D.coral + "ee)",
                  transition: "width 60ms linear",
                  boxShadow: level > 0.05 ? "0 0 12px " + D.amber + "88" : "none",
                }}
              />
            </div>
            <div
              style={{
                marginTop: 8, fontFamily: mn, fontSize: 10, letterSpacing: 1,
                color: D.txd, display: "flex", justifyContent: "space-between",
              }}
            >
              <span>RMS</span>
              <span>{meterPct}%</span>
            </div>
          </div>

          <div style={panel}>
            <div style={panelLabel}>CONTROLS</div>
            <div style={{ display: "flex", gap: 8 }}>
              {status === "idle" || status === "done" ? (
                <button onClick={startRecording} style={btnPrimary(D.coral)} disabled={isBusy}>
                  <Play size={14} /> Start
                </button>
              ) : status === "paused" ? (
                <button onClick={resumeRecording} style={btnPrimary(D.amber)} disabled={isBusy}>
                  <Play size={14} /> Resume
                </button>
              ) : (
                <button onClick={pauseRecording} style={btnSecondary} disabled={isBusy}>
                  <Pause size={14} /> Pause
                </button>
              )}
              <button
                onClick={stopRecording}
                style={btnSecondary}
                disabled={status !== "recording" && status !== "paused"}
              >
                <Square size={14} /> Stop
              </button>
            </div>
            {status === "uploading" ? (
              <div style={{ marginTop: 14 }}>
                <div style={{ fontFamily: mn, fontSize: 11, color: D.txm, marginBottom: 6, display: "flex", justifyContent: "space-between" }}>
                  <span><Upload size={11} style={{ verticalAlign: "middle", marginRight: 4 }} /> UPLOADING</span>
                  <span>{uploadProgress}%</span>
                </div>
                <div style={{ height: 6, borderRadius: 3, background: "rgba(255,255,255,0.04)", overflow: "hidden" }}>
                  <div
                    style={{
                      height: "100%", width: uploadProgress + "%",
                      background: D.teal, transition: "width 120ms linear",
                    }}
                  />
                </div>
              </div>
            ) : null}
          </div>

          {status === "done" && finalUrl ? (
            <div style={panel}>
              <div style={panelLabel}>SHAREABLE LINK</div>
              <div
                style={{
                  fontFamily: mn, fontSize: 12, color: D.tx, wordBreak: "break-all",
                  background: "rgba(255,255,255,0.03)", border: "1px solid " + D.border,
                  borderRadius: 8, padding: "10px 12px", marginBottom: 10,
                }}
              >
                <a
                  href={finalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: D.teal, textDecoration: "none" }}
                >
                  {finalUrl}
                </a>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={copyUrl} style={btnSecondary}>
                  {copied ? <Check size={14} color={D.teal} /> : <Copy size={14} />}
                  &nbsp;{copied ? "Copied" : "Copy link"}
                </button>
                <button onClick={resetSession} style={btnSecondary}>
                  New recording
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────

const panel: React.CSSProperties = {
  background: D.card,
  border: "1px solid " + D.border,
  borderRadius: 12,
  padding: 16,
  fontFamily: ft,
  color: D.tx,
};

const panelLabel: React.CSSProperties = {
  fontFamily: mn,
  fontSize: 10,
  letterSpacing: 1.4,
  color: D.txd,
  textTransform: "uppercase",
  marginBottom: 10,
};

function btnPrimary(accent: string): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "10px 14px",
    borderRadius: 8,
    background: accent + "1c",
    color: accent,
    border: "1px solid " + accent + "55",
    fontFamily: mn,
    fontSize: 12,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    cursor: "pointer",
  };
}

const btnSecondary: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "10px 14px",
  borderRadius: 8,
  background: "rgba(255,255,255,0.03)",
  color: D.tx,
  border: "1px solid " + D.border,
  fontFamily: mn,
  fontSize: 12,
  letterSpacing: 0.8,
  textTransform: "uppercase",
  cursor: "pointer",
};
