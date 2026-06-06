// ProductionSTUDIO · Timeline waveform + thumbnail extraction.
//
// Two browser-only utilities used by the editor surfaces:
//   extractWaveform(url) → 1000 peaks + duration. WebAudio decode, then
//     bin to a fixed 1000-sample envelope so every clip strip renders
//     at the same fidelity regardless of source length.
//   extractVideoThumbs(url, count) → N evenly-spaced JPEG data URLs
//     captured from an offscreen <video>.
//
// Both results are cached in IndexedDB via localforage so reloads of an
// editor session are cheap. Cache key is a hash of the URL plus the
// option that affects the output shape (1000 peaks / N thumbs).

"use client";

import localforage from "localforage";

// Two store instances — peaks and thumbs have very different sizes and
// invalidation timings.
let peaksStore: LocalForage | null = null;
function peaksDb(): LocalForage {
  if (!peaksStore) {
    peaksStore = localforage.createInstance({
      name: "poast-production-studio",
      storeName: "waveform-peaks",
    });
  }
  return peaksStore;
}

let thumbsStore: LocalForage | null = null;
function thumbsDb(): LocalForage {
  if (!thumbsStore) {
    thumbsStore = localforage.createInstance({
      name: "poast-production-studio",
      storeName: "video-thumbs",
    });
  }
  return thumbsStore;
}

// Cheap content-addressable key. We hash the URL string because for
// blob: URLs the path itself is already unique to the file (browser
// regenerates them per-call). Callers that want stable keys across
// sessions can pass a `cacheKey` override.
async function hashKey(input: string): Promise<string> {
  if (typeof crypto !== "undefined" && crypto.subtle) {
    const buf = new TextEncoder().encode(input);
    const hash = await crypto.subtle.digest("SHA-1", buf);
    const bytes = new Uint8Array(hash);
    let hex = "";
    for (const b of bytes) hex += b.toString(16).padStart(2, "0");
    return hex;
  }
  // Fallback — non-crypto, fine for cache keys.
  let h = 0;
  for (let i = 0; i < input.length; i++) h = (h * 31 + input.charCodeAt(i)) | 0;
  return String(h >>> 0);
}

// ─── Peaks ───

export interface WaveformResult {
  peaks: number[];
  durationSec: number;
}

const PEAK_BINS = 1000;

export interface ExtractWaveformOpts {
  /**
   * Stable cache key — defaults to a hash of mediaUrl. Use this when the
   * underlying file is the same across sessions but the URL changes
   * (e.g. blob: URLs that get regenerated on import).
   */
  cacheKey?: string;
  /** Skip the cache lookup + write. */
  noCache?: boolean;
}

export async function extractWaveform(
  mediaUrl: string,
  opts?: ExtractWaveformOpts,
): Promise<WaveformResult> {
  const key = `peaks:${opts?.cacheKey ?? (await hashKey(mediaUrl))}:${PEAK_BINS}`;
  if (!opts?.noCache) {
    try {
      const cached = await peaksDb().getItem<WaveformResult>(key);
      if (cached && Array.isArray(cached.peaks) && cached.peaks.length === PEAK_BINS) {
        return cached;
      }
    } catch {
      // Cache misses are non-fatal.
    }
  }

  const arrayBuffer = await fetchAsArrayBuffer(mediaUrl);
  const ctx = makeOfflineAudioContext();
  // decodeAudioData wants its own copy because some browsers detach the buffer.
  const audioBuffer = await decodeAudio(ctx, arrayBuffer.slice(0));

  // Mix all channels to mono for the visual envelope. The waveform UI
  // is a single strip so we don't need per-channel data.
  const channelCount = audioBuffer.numberOfChannels;
  const length = audioBuffer.length;
  const peaks: number[] = new Array(PEAK_BINS).fill(0);
  const samplesPerBin = Math.max(1, Math.floor(length / PEAK_BINS));

  for (let ch = 0; ch < channelCount; ch++) {
    const data = audioBuffer.getChannelData(ch);
    for (let i = 0; i < PEAK_BINS; i++) {
      const start = i * samplesPerBin;
      const end = Math.min(length, start + samplesPerBin);
      let peak = 0;
      for (let j = start; j < end; j++) {
        const v = Math.abs(data[j]);
        if (v > peak) peak = v;
      }
      // Average across channels — divide at the end.
      peaks[i] += peak;
    }
  }
  for (let i = 0; i < PEAK_BINS; i++) peaks[i] /= channelCount || 1;

  const result: WaveformResult = {
    peaks,
    durationSec: audioBuffer.duration,
  };

  if (!opts?.noCache) {
    try {
      await peaksDb().setItem(key, result);
    } catch {
      // Cache writes are non-fatal.
    }
  }
  return result;
}

// ─── Video thumbs ───

export interface ExtractThumbsOpts {
  cacheKey?: string;
  noCache?: boolean;
  /** Width in pixels — height keeps the source aspect. Default 160. */
  width?: number;
  /** JPEG quality 0..1. Default 0.72. */
  quality?: number;
}

export async function extractVideoThumbs(
  mediaUrl: string,
  count: number,
  opts?: ExtractThumbsOpts,
): Promise<string[]> {
  const c = Math.max(1, Math.floor(count));
  const w = opts?.width ?? 160;
  const q = opts?.quality ?? 0.72;
  const key = `thumbs:${opts?.cacheKey ?? (await hashKey(mediaUrl))}:${c}:${w}:${q}`;

  if (!opts?.noCache) {
    try {
      const cached = await thumbsDb().getItem<string[]>(key);
      if (cached && Array.isArray(cached) && cached.length === c) return cached;
    } catch {
      // Non-fatal.
    }
  }

  const out = await captureFrames(mediaUrl, c, { width: w, quality: q });

  if (!opts?.noCache) {
    try {
      await thumbsDb().setItem(key, out);
    } catch {
      // Non-fatal.
    }
  }
  return out;
}

// ─── Lower-level helpers ───

async function fetchAsArrayBuffer(url: string): Promise<ArrayBuffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch media for waveform: ${res.status}`);
  return await res.arrayBuffer();
}

function makeOfflineAudioContext(): OfflineAudioContext {
  // We don't know the source rate yet — pick a sane default; the real
  // sample rate from decodeAudioData wins on the resulting buffer.
  const W = window as unknown as {
    OfflineAudioContext?: typeof OfflineAudioContext;
    webkitOfflineAudioContext?: typeof OfflineAudioContext;
  };
  const Ctor = W.OfflineAudioContext || W.webkitOfflineAudioContext;
  if (!Ctor) throw new Error("OfflineAudioContext unavailable.");
  return new Ctor(1, 44100, 44100);
}

function decodeAudio(ctx: OfflineAudioContext, buf: ArrayBuffer): Promise<AudioBuffer> {
  return new Promise((resolve, reject) => {
    // Safari still wants the callback form alongside the promise.
    try {
      const ret = ctx.decodeAudioData(buf, resolve, reject) as unknown as Promise<AudioBuffer>;
      if (ret && typeof (ret as { then?: unknown }).then === "function") {
        ret.then(resolve, reject);
      }
    } catch (e) {
      reject(e);
    }
  });
}

async function captureFrames(
  url: string,
  count: number,
  opts: { width: number; quality: number },
): Promise<string[]> {
  const video = document.createElement("video");
  video.preload = "auto";
  video.crossOrigin = "anonymous";
  video.muted = true;
  // Off-DOM but in-browser. We don't need to attach it to render.
  video.src = url;

  await new Promise<void>((resolve, reject) => {
    let settled = false;
    const onMeta = () => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve();
    };
    const onErr = () => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error("Video metadata failed to load."));
    };
    const cleanup = () => {
      video.removeEventListener("loadedmetadata", onMeta);
      video.removeEventListener("error", onErr);
    };
    video.addEventListener("loadedmetadata", onMeta, { once: true });
    video.addEventListener("error", onErr, { once: true });
  });

  const duration = isFinite(video.duration) ? video.duration : 0;
  if (duration <= 0) return [];

  const srcW = video.videoWidth || 320;
  const srcH = video.videoHeight || 180;
  const dstW = opts.width;
  const dstH = Math.max(1, Math.round((srcH / srcW) * dstW));

  const canvas = document.createElement("canvas");
  canvas.width = dstW;
  canvas.height = dstH;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D unavailable.");

  const stamps: number[] = [];
  for (let i = 0; i < count; i++) {
    // Evenly spaced inside (0, duration). Use (i+0.5)/count so we don't
    // start at the first black frame nor end at the trailing one.
    stamps.push(((i + 0.5) / count) * duration);
  }

  const thumbs: string[] = [];
  for (const t of stamps) {
    await seekTo(video, Math.min(duration - 0.01, Math.max(0, t)));
    ctx.drawImage(video, 0, 0, dstW, dstH);
    thumbs.push(canvas.toDataURL("image/jpeg", opts.quality));
  }

  // Best-effort cleanup. The blob URL is owned by the caller.
  try {
    video.removeAttribute("src");
    video.load();
  } catch {}

  return thumbs;
}

function seekTo(video: HTMLVideoElement, t: number): Promise<void> {
  return new Promise((resolve) => {
    const onSeeked = () => {
      video.removeEventListener("seeked", onSeeked);
      resolve();
    };
    video.addEventListener("seeked", onSeeked, { once: true });
    try {
      video.currentTime = t;
    } catch {
      video.removeEventListener("seeked", onSeeked);
      resolve();
    }
  });
}

// ─── Cache management ───

/** Drop every cached waveform + thumb. Useful when the user clears a project. */
export async function clearWaveformCache(): Promise<void> {
  try {
    await peaksDb().clear();
  } catch {}
  try {
    await thumbsDb().clear();
  } catch {}
}
