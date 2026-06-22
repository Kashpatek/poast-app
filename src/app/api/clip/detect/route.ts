// POST /api/clip/detect  { job_id }
//
// The "Opus magic" half-1. Feeds the transcript to Claude with timestamps
// STRIPPED — the model references moments only by utterance index, so it
// physically cannot emit a mid-sentence second. Returns scored candidates by
// index; /api/clip/resolve turns those into snapped, guarded second ranges.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { checkRateLimit } from "@/lib/ratelimit";
import { generateJSON } from "@/lib/anthropic";
import { getClipSupabase } from "../_supabase";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const Body = z.object({ job_id: z.string() });

const ClipsSchema = z.object({
  clips: z.array(
    z.object({
      start_idx: z.number().int(),
      end_idx: z.number().int(),
      hook: z.string(),
      score: z.number(),
    })
  ),
});

const SYSTEM = `You are a senior short-form video producer for SemiAnalysis, a deep-tech semiconductor and AI research firm. You pick the most clip-worthy moments from a podcast transcript for vertical shorts.

You receive the transcript as a numbered list of utterances — one per line, "[index] text". Timestamps are deliberately withheld: reference moments ONLY by utterance index.

Pick the 8 strongest standalone clip moments. Each clip spans consecutive utterances start_idx..end_idx (inclusive) and must:
- be a self-contained thought that hooks a viewer in the first 2 seconds
- favor counterintuitive claims, sharp numbers, named companies/tech (TSMC, NVIDIA, HBM, ASML, etc.), strong opinions, and "here's why" explanations
- avoid filler, mid-thought fragments, and pleasantries

Return STRICT JSON only, no prose:
{ "clips": [ { "start_idx": <int>, "end_idx": <int>, "hook": "<=8-word punchy title", "score": <0..1 strength> } ] }`;

interface Utt {
  idx: number;
  text: string;
}

export async function POST(req: NextRequest) {
  const { allowed, remaining } = await checkRateLimit(req);
  if (!allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded" },
      { status: 429, headers: { "X-RateLimit-Remaining": String(remaining ?? 0) } }
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

  const supabase = getClipSupabase();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const { job_id } = parsed.data;
  const { data: map } = await supabase
    .from("utterance_maps")
    .select("utterances")
    .eq("job_id", job_id)
    .maybeSingle();
  const utterances = (map?.utterances || []) as Utt[];
  if (!utterances.length) {
    return NextResponse.json({ error: "No transcript for this job yet" }, { status: 400 });
  }

  const transcript = utterances.map((u, i) => `[${u.idx ?? i}] ${u.text}`).join("\n");

  let clips: z.infer<typeof ClipsSchema>["clips"];
  try {
    const out = await generateJSON<unknown>({
      system: SYSTEM,
      prompt: transcript,
      maxTokens: 4000,
    });
    clips = ClipsSchema.parse(out).clips;
  } catch (e) {
    return NextResponse.json(
      { error: "Clip detection failed: " + (e as Error).message },
      { status: 502 }
    );
  }

  const n = utterances.length;
  const now = new Date().toISOString();
  await supabase.from("clip_jobs").update({ status: "detecting", updated_at: now }).eq("id", job_id);
  // Re-run safe: clear prior candidates for this job.
  await supabase.from("clip_candidates").delete().eq("job_id", job_id);

  const candidates = clips.map((c, i) => {
    const start = Math.max(0, Math.min(n - 1, c.start_idx));
    const end = Math.max(start, Math.min(n - 1, c.end_idx));
    return {
      id: "cand_" + Date.now().toString(36) + i + Math.random().toString(36).slice(2, 6),
      job_id,
      start_idx: start,
      end_idx: end,
      start_s: null,
      end_s: null,
      hook: c.hook.slice(0, 120),
      score: Math.max(0, Math.min(1, c.score)),
      status: "pending",
      reason: null,
    };
  });

  if (candidates.length) {
    const { error: insErr } = await supabase.from("clip_candidates").insert(candidates);
    if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });
  }

  return NextResponse.json({ candidates, count: candidates.length, ts: Date.now() });
}
