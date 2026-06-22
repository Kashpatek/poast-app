# SA Clip Worker

Off-Vercel transcription service for POAST's Clip Engine. It exists because
Vercel functions cap at 4.5 MB request bodies and 800 s — neither works for
transcribing a 2-hour podcast. This worker runs on an always-on box, accepts a
job, transcribes asynchronously, and posts a word-level **utterance map** back
to POAST.

## Contract (all POAST depends on)

**In** — `POST /transcribe` with header `x-worker-secret: <WORKER_SECRET>`:

```json
{ "job_id": "clip_…", "source_type": "youtube" | "r2", "source_url": "…", "callback_url": "https://poast…/api/clip/callback" }
```

Responds `202 { accepted: true }` immediately, then processes in the background.

**Out** — `POST <callback_url>` with header `x-signature: <hex HMAC-SHA256(WORKER_SECRET, rawBody)>`:

```json
{ "job_id": "clip_…", "status": "done",
  "duration_s": 7261.4,
  "utterances": [ { "idx": 0, "start_s": 12.84, "end_s": 18.2, "text": "…",
                    "sentence_start": true, "sentence_end": true,
                    "words": [ { "w": "We", "start_s": 12.84, "end_s": 12.98 } ] } ] }
```

or `{ "job_id": "…", "status": "error", "error": "…" }`.

Because POAST only knows this HTTP contract, the transcription engine can later
be swapped (e.g. Modal `faster-whisper`) without changing POAST.

## Run locally

```bash
cd worker
cp .env.example .env   # fill in WORKER_SECRET + DEEPGRAM_API_KEY
npm install
node --env-file=.env index.js
```

## Deploy (Docker)

The included `Dockerfile` bundles `ffmpeg` + `yt-dlp`.

- **Render / Railway**: point a new service at this folder, Docker runtime, set
  the env vars from `.env.example`. Use the resulting URL as POAST's `WORKER_URL`.
- **Fly**: `fly launch` in this folder, `fly secrets set WORKER_SECRET=… DEEPGRAM_API_KEY=…`.

`WORKER_SECRET` must be **identical** to the value set in POAST (Vercel), or the
callback signature check rejects the result.

## Providers

- **deepgram** (default): sends the R2 URL straight to Deepgram (no download) or
  the yt-dlp'd audio for YouTube. Returns word timestamps + speaker labels.
- **openai**: whisper-1, single request, 25 MB limit — fine for short clips, not
  full episodes. Set `TRANSCRIBE_PROVIDER=openai`.
