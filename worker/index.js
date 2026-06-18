// SA Clip Worker — off-Vercel transcription service for POAST's Clip Engine.
//
// POST /transcribe { job_id, source_type, source_url, callback_url } (x-worker-secret)
//   → links/downloads audio, runs a managed Whisper provider, builds a
//     word-level utterance map, and POSTs it back to callback_url signed with
//     HMAC-SHA256(WORKER_SECRET, body) in the x-signature header.
//
// Provider-swappable: the ONLY contract POAST depends on is the callback shape,
// so this can later move to Modal faster-whisper without touching POAST.
// Default provider is Deepgram (handles podcast-length files + remote URLs +
// word timestamps natively). OpenAI whisper-1 is supported for short files
// (25 MB API limit) — set TRANSCRIBE_PROVIDER=openai.

import express from "express";
import { createHmac } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const PORT = process.env.PORT || 8080;
const WORKER_SECRET = process.env.WORKER_SECRET;
const PROVIDER = (process.env.TRANSCRIBE_PROVIDER || "deepgram").toLowerCase();
const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const PAUSE_GAP_S = 0.6; // split utterances on a silence longer than this

const app = express();
app.use(express.json({ limit: "2mb" }));

app.get("/", (_req, res) => res.json({ ok: true, provider: PROVIDER }));

app.post("/transcribe", (req, res) => {
  if (!WORKER_SECRET || req.get("x-worker-secret") !== WORKER_SECRET) {
    return res.status(401).json({ error: "unauthorized" });
  }
  const { job_id, source_type, source_url, callback_url } = req.body || {};
  if (!job_id || !source_type || !source_url || !callback_url) {
    return res.status(400).json({ error: "missing fields" });
  }
  // Acknowledge immediately, then process asynchronously — transcription of a
  // 2-hour podcast runs far longer than any HTTP request should stay open.
  res.status(202).json({ accepted: true, job_id });
  processJob({ job_id, source_type, source_url, callback_url }).catch((e) => {
    postCallback(callback_url, {
      job_id,
      status: "error",
      error: String((e && e.message) || e),
    }).catch(() => {});
  });
});

async function processJob({ job_id, source_type, source_url, callback_url }) {
  let result;
  if (source_type === "youtube") {
    const audioPath = await ytdlpAudio(source_url);
    try {
      const bytes = await readFile(audioPath);
      result = await transcribe({ bytes });
    } finally {
      await rm(audioPath, { force: true, recursive: false }).catch(() => {});
    }
  } else {
    // r2 (or any http URL) — providers fetch it directly, no local download.
    result = await transcribe({ url: source_url });
  }
  await postCallback(callback_url, {
    job_id,
    status: "done",
    duration_s: result.durationS,
    utterances: result.utterances,
  });
}

// yt-dlp → extract best audio to a temp m4a, return the file path.
async function ytdlpAudio(url) {
  const dir = await mkdtemp(join(tmpdir(), "clip-"));
  const out = join(dir, "audio.m4a");
  await run("yt-dlp", ["-f", "bestaudio", "-x", "--audio-format", "m4a", "-o", out, url]);
  return out;
}

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: ["ignore", "ignore", "pipe"] });
    let err = "";
    p.stderr.on("data", (d) => (err += d.toString()));
    p.on("close", (code) =>
      code === 0 ? resolve() : reject(new Error(`${cmd} exited ${code}: ${err.slice(-400)}`))
    );
    p.on("error", reject);
  });
}

async function transcribe(input) {
  if (PROVIDER === "openai") return transcribeOpenAI(input);
  return transcribeDeepgram(input);
}

// ── Deepgram (default) — big files + remote URLs + word timestamps ──
async function transcribeDeepgram({ url, bytes }) {
  if (!DEEPGRAM_API_KEY) throw new Error("DEEPGRAM_API_KEY not set");
  const qs = "model=nova-2&smart_format=true&punctuate=true&diarize=true";
  const endpoint = `https://api.deepgram.com/v1/listen?${qs}`;
  const headers = { Authorization: `Token ${DEEPGRAM_API_KEY}` };
  let body, contentType;
  if (url) {
    body = JSON.stringify({ url });
    contentType = "application/json";
  } else {
    body = bytes;
    contentType = "audio/m4a";
  }
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { ...headers, "Content-Type": contentType },
    body,
  });
  if (!res.ok) throw new Error(`Deepgram ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  const alt = data?.results?.channels?.[0]?.alternatives?.[0];
  const words = (alt?.words || []).map((w) => ({
    w: w.punctuated_word || w.word,
    start_s: w.start,
    end_s: w.end,
    speaker: typeof w.speaker === "number" ? w.speaker : null,
  }));
  const durationS =
    data?.metadata?.duration ?? (words.length ? words[words.length - 1].end_s : 0);
  return { utterances: groupUtterances(words), durationS };
}

// ── OpenAI whisper-1 (optional) — single-shot, 25 MB API limit ──
async function transcribeOpenAI({ url, bytes }) {
  if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY not set");
  let buf = bytes;
  if (!buf && url) {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`fetch source ${r.status}`);
    buf = Buffer.from(await r.arrayBuffer());
  }
  if (buf.length > 25 * 1024 * 1024) {
    throw new Error(
      "OpenAI whisper-1 caps at 25 MB per request; set TRANSCRIBE_PROVIDER=deepgram for podcast-length files"
    );
  }
  const form = new FormData();
  form.append("file", new Blob([buf]), "audio.m4a");
  form.append("model", "whisper-1");
  form.append("response_format", "verbose_json");
  form.append("timestamp_granularities[]", "word");
  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
    body: form,
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  const words = (data.words || []).map((w) => ({
    w: w.word,
    start_s: w.start,
    end_s: w.end,
    speaker: null,
  }));
  const durationS = data.duration ?? (words.length ? words[words.length - 1].end_s : 0);
  return { utterances: groupUtterances(words), durationS };
}

// Group words into utterances. Start a new utterance when the previous word
// ended a sentence (.?!), the speaker changed, or there was a pause longer than
// PAUSE_GAP_S. sentence_start / sentence_end flags are what POAST's resolve step
// snaps clip boundaries onto, so a clip never starts or ends mid-sentence.
function groupUtterances(words) {
  const endsSentence = (w) => /[.?!]["')\]]?$/.test(w || "");
  const utts = [];
  let cur = null;
  let prev = null;
  for (const word of words) {
    const speakerChange =
      prev && word.speaker != null && prev.speaker != null && word.speaker !== prev.speaker;
    const pause = prev ? word.start_s - prev.end_s > PAUSE_GAP_S : false;
    const prevEnded = prev ? endsSentence(prev.w) : false;
    if (!cur || speakerChange || pause || prevEnded) {
      cur = {
        idx: utts.length,
        start_s: word.start_s,
        end_s: word.end_s,
        text: "",
        sentence_start: true,
        sentence_end: false,
        words: [],
      };
      utts.push(cur);
    }
    cur.words.push({ w: word.w, start_s: word.start_s, end_s: word.end_s });
    cur.text = cur.text ? `${cur.text} ${word.w}` : word.w;
    cur.end_s = word.end_s;
    cur.sentence_end = endsSentence(word.w);
    prev = word;
  }
  return utts;
}

async function postCallback(callbackUrl, payload) {
  const body = JSON.stringify(payload);
  const sig = createHmac("sha256", WORKER_SECRET).update(body).digest("hex");
  const res = await fetch(callbackUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-signature": sig },
    body,
  });
  if (!res.ok) throw new Error(`callback ${res.status}: ${(await res.text()).slice(0, 200)}`);
}

app.listen(PORT, () => console.log(`sa-clip-worker on :${PORT} (provider=${PROVIDER})`));
