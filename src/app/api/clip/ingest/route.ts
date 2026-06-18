// POST /api/clip/ingest
//
// Accepts a YouTube URL (worker runs yt-dlp) or an R2 storage URL, creates a
// clip_jobs row, and dispatches the external transcription worker. Returns a
// job_id the client polls via GET /api/clip/job/[id]. The worker is async — it
// POSTs the utterance map back to /api/clip/callback when done.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { checkRateLimit } from "@/lib/ratelimit";
import { getClipSupabase } from "../_supabase";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const Body = z.object({
  source: z.object({
    type: z.enum(["youtube", "r2"]),
    url: z.string().url(),
  }),
  episodeId: z.string().max(120).optional(),
});

export async function POST(req: NextRequest) {
  const { allowed, remaining } = await checkRateLimit(req);
  if (!allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded" },
      { status: 429, headers: { "X-RateLimit-Remaining": String(remaining ?? 0) } }
    );
  }

  const supabase = getClipSupabase();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }
  const workerUrl = process.env.WORKER_URL;
  const workerSecret = process.env.WORKER_SECRET;
  if (!workerUrl || !workerSecret) {
    return NextResponse.json(
      { error: "Transcription worker not configured" },
      { status: 503 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = Body.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.issues },
      { status: 400 }
    );
  }
  const { source, episodeId } = parsed.data;

  const jobId =
    "clip_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

  const { error: insErr } = await supabase.from("clip_jobs").insert({
    id: jobId,
    source_url: source.url,
    source_type: source.type,
    status: "queued",
    episode_id: episodeId ?? null,
  });
  if (insErr) {
    return NextResponse.json({ error: insErr.message }, { status: 500 });
  }

  // Dispatch the worker. It should accept the job and return promptly, then
  // process asynchronously and call /api/clip/callback. We surface a dispatch
  // failure as an errored job rather than leaving it stuck "queued".
  const callbackUrl = new URL("/api/clip/callback", req.nextUrl.origin).toString();
  try {
    const res = await fetch(workerUrl.replace(/\/$/, "") + "/transcribe", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-worker-secret": workerSecret },
      body: JSON.stringify({
        job_id: jobId,
        source_type: source.type,
        source_url: source.url,
        callback_url: callbackUrl,
      }),
    });
    if (!res.ok) throw new Error(`worker responded ${res.status}`);
    await supabase
      .from("clip_jobs")
      .update({ status: "transcribing", updated_at: new Date().toISOString() })
      .eq("id", jobId);
  } catch (e) {
    await supabase
      .from("clip_jobs")
      .update({
        status: "error",
        error: "worker dispatch failed: " + (e as Error).message,
        updated_at: new Date().toISOString(),
      })
      .eq("id", jobId);
    return NextResponse.json(
      { error: "Failed to reach transcription worker", job_id: jobId },
      { status: 502 }
    );
  }

  return NextResponse.json({ job_id: jobId, status: "transcribing", ts: Date.now() });
}
