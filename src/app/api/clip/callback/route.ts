// POST /api/clip/callback  (authenticated — HMAC over the raw body)
//
// The external transcription worker calls this when an utterance map is ready
// (or on failure). Authenticated with an HMAC-SHA256 signature in x-signature
// computed over the raw request body with WORKER_SECRET, so nothing else can
// forge utterance maps. Writes utterance_maps + flips clip_jobs.status.

import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { z } from "zod";
import { getClipSupabase } from "../_supabase";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const Utterance = z.object({
  idx: z.number().int(),
  start_s: z.number(),
  end_s: z.number(),
  text: z.string(),
  sentence_start: z.boolean().optional(),
  sentence_end: z.boolean().optional(),
  words: z
    .array(z.object({ w: z.string(), start_s: z.number(), end_s: z.number() }))
    .optional(),
});

const Body = z.object({
  job_id: z.string(),
  status: z.enum(["done", "error"]),
  error: z.string().optional(),
  duration_s: z.number().optional(),
  episode_id: z.string().optional(),
  utterances: z.array(Utterance).optional(),
});

function verifySignature(secret: string, raw: string, sig: string | null): boolean {
  if (!sig) return false;
  const expected = createHmac("sha256", secret).update(raw).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(sig);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(req: NextRequest) {
  const secret = process.env.WORKER_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Worker secret not configured" }, { status: 503 });
  }

  const raw = await req.text();
  if (!verifySignature(secret, raw, req.headers.get("x-signature"))) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = JSON.parse(raw);
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

  const supabase = getClipSupabase();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const { job_id, status, error, duration_s, episode_id, utterances } = parsed.data;
  const now = new Date().toISOString();

  if (status === "error") {
    await supabase
      .from("clip_jobs")
      .update({ status: "error", error: error ?? "worker error", updated_at: now })
      .eq("id", job_id);
    return NextResponse.json({ ok: true });
  }

  const { error: upErr } = await supabase.from("utterance_maps").upsert({
    job_id,
    episode_id: episode_id ?? null,
    duration_s: duration_s ?? null,
    utterances: utterances ?? [],
  });
  if (upErr) {
    return NextResponse.json({ error: upErr.message }, { status: 500 });
  }

  await supabase
    .from("clip_jobs")
    .update({ status: "transcribed", error: null, updated_at: now })
    .eq("id", job_id);

  return NextResponse.json({ ok: true });
}
