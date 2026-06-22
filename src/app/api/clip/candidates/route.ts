// GET  /api/clip/candidates?job_id=…   → list candidates (score desc) + source_url
// POST /api/clip/candidates { id, status } → approve / reject a candidate
//
// Backs the review deck: load on revisit, persist approve/reject decisions.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getClipSupabase } from "../_supabase";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const supabase = getClipSupabase();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }
  const jobId = req.nextUrl.searchParams.get("job_id");
  if (!jobId) {
    return NextResponse.json({ error: "job_id required" }, { status: 400 });
  }
  const { data: job } = await supabase
    .from("clip_jobs")
    .select("source_url, source_type, status")
    .eq("id", jobId)
    .maybeSingle();
  const { data: candidates } = await supabase
    .from("clip_candidates")
    .select("*")
    .eq("job_id", jobId)
    .order("score", { ascending: false });
  return NextResponse.json({
    candidates: candidates || [],
    source_url: job?.source_url ?? null,
    job: job ?? null,
    ts: Date.now(),
  });
}

const PostBody = z.object({
  id: z.string(),
  status: z.enum(["approved", "rejected", "pending"]),
});

export async function POST(req: NextRequest) {
  const supabase = getClipSupabase();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = PostBody.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.issues },
      { status: 400 }
    );
  }
  const { id, status } = parsed.data;
  const { error } = await supabase.from("clip_candidates").update({ status }).eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
