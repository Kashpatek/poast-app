// GET /api/clip/job/[id]
//
// Poll endpoint. Returns the clip job's status and, once transcribed, the
// utterance map. The client polls this every ~6s (same cadence as the
// production render-queue). Next 16: route params are a Promise — await them.

import { NextRequest, NextResponse } from "next/server";
import { getClipSupabase } from "../../_supabase";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;

  const supabase = getClipSupabase();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const { data: job, error } = await supabase
    .from("clip_jobs")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  let utterances: unknown = null;
  let durationS: number | null = null;
  const ready = ["transcribed", "detecting", "done"].includes(job.status as string);
  if (ready) {
    const { data: map } = await supabase
      .from("utterance_maps")
      .select("duration_s, utterances")
      .eq("job_id", id)
      .maybeSingle();
    if (map) {
      utterances = map.utterances;
      durationS = map.duration_s as number | null;
    }
  }

  return NextResponse.json({
    job_id: job.id,
    status: job.status,
    error: job.error ?? null,
    source_type: job.source_type,
    duration_s: durationS,
    utterances,
    ts: Date.now(),
  });
}
