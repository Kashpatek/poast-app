// POST /api/clip/resolve  { job_id }
//
// The "Opus magic" half-2 — deterministic, no LLM. Converts each candidate's
// utterance indices to seconds, snaps the boundaries onto real sentence edges,
// pads 150 ms, drops anything outside 15–60 s, and drops lower-scored overlaps.
// A mid-sentence cut is impossible by construction, not by a better prompt.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { checkRateLimit } from "@/lib/ratelimit";
import { getClipSupabase } from "../_supabase";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const Body = z.object({ job_id: z.string() });

const MIN_S = 15;
const MAX_S = 60;
const PAD_S = 0.15;

interface Utt {
  idx: number;
  start_s: number;
  end_s: number;
  text: string;
  sentence_start?: boolean;
  sentence_end?: boolean;
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
  const { data: job } = await supabase
    .from("clip_jobs")
    .select("source_url")
    .eq("id", job_id)
    .maybeSingle();
  const { data: map } = await supabase
    .from("utterance_maps")
    .select("utterances, duration_s")
    .eq("job_id", job_id)
    .maybeSingle();
  const { data: cands } = await supabase
    .from("clip_candidates")
    .select("*")
    .eq("job_id", job_id);

  const u = (map?.utterances || []) as Utt[];
  if (!u.length) {
    return NextResponse.json({ error: "No transcript for this job" }, { status: 400 });
  }
  const candidates = (cands || []) as Array<{
    id: string;
    start_idx: number;
    end_idx: number;
    score: number;
  }>;
  if (!candidates.length) {
    return NextResponse.json({ error: "No candidates — run detect first" }, { status: 400 });
  }

  const n = u.length;
  const duration = (map?.duration_s as number) || u[n - 1].end_s;

  // Walk to the nearest real sentence boundary so clips never start/end mid-sentence.
  const snapStart = (i: number) => {
    let k = Math.max(0, Math.min(n - 1, i));
    while (k > 0 && !u[k].sentence_start) k--;
    return k;
  };
  const snapEnd = (i: number) => {
    let k = Math.max(0, Math.min(n - 1, i));
    while (k < n - 1 && !u[k].sentence_end) k++;
    return k;
  };

  interface Resolved {
    id: string;
    start_s: number | null;
    end_s: number | null;
    score: number;
    status: "pending" | "rejected";
    reason: string | null;
  }

  const computed: Resolved[] = candidates.map((c) => {
    if (
      c.start_idx == null ||
      c.end_idx == null ||
      c.start_idx < 0 ||
      c.end_idx >= n ||
      c.start_idx > c.end_idx
    ) {
      return { id: c.id, start_s: null, end_s: null, score: c.score, status: "rejected", reason: "index out of range" };
    }
    const s = snapStart(c.start_idx);
    const e = snapEnd(c.end_idx);
    const start_s = Math.max(0, u[s].start_s - PAD_S);
    const end_s = Math.min(duration, u[e].end_s + PAD_S);
    const dur = end_s - start_s;
    if (dur < MIN_S) {
      return { id: c.id, start_s, end_s, score: c.score, status: "rejected", reason: `too short (${dur.toFixed(1)}s)` };
    }
    if (dur > MAX_S) {
      return { id: c.id, start_s, end_s, score: c.score, status: "rejected", reason: `too long (${dur.toFixed(1)}s)` };
    }
    return { id: c.id, start_s, end_s, score: c.score, status: "pending", reason: null };
  });

  // Drop overlaps greedily, keeping the higher-scored clip.
  const valid = computed.filter((c) => c.status === "pending").sort((a, b) => b.score - a.score);
  const accepted: Resolved[] = [];
  for (const c of valid) {
    const overlaps = accepted.some(
      (a) => (c.start_s as number) < (a.end_s as number) && (a.start_s as number) < (c.end_s as number)
    );
    if (overlaps) {
      c.status = "rejected";
      c.reason = "overlaps a higher-scored clip";
    } else {
      accepted.push(c);
    }
  }

  for (const c of computed) {
    await supabase
      .from("clip_candidates")
      .update({ start_s: c.start_s, end_s: c.end_s, status: c.status, reason: c.reason })
      .eq("id", c.id);
  }
  await supabase
    .from("clip_jobs")
    .update({ status: "done", updated_at: new Date().toISOString() })
    .eq("id", job_id);

  const { data: fresh } = await supabase
    .from("clip_candidates")
    .select("*")
    .eq("job_id", job_id)
    .order("score", { ascending: false });

  return NextResponse.json({
    candidates: fresh || [],
    source_url: job?.source_url ?? null,
    accepted: accepted.length,
    ts: Date.now(),
  });
}
