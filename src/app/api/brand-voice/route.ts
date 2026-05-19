// GET → returns the full voices archive (migrating legacy shape on the fly).
// POST → saves the archive. Body: { archive: VoicesArchive }.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  BRAND_VOICE_ID,
  defaultArchive,
  invalidateBrandVoiceCache,
  loadVoicesArchive,
  type VoicesArchive,
} from "@/lib/brand-voice";

export const dynamic = "force-dynamic";

let _supabase: ReturnType<typeof createClient> | null = null;
function getSupabase() {
  if (_supabase) return _supabase;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  _supabase = createClient(url, key);
  return _supabase;
}

export async function GET() {
  const supabase = getSupabase();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured", archive: defaultArchive() }, { status: 503 });
  try {
    const archive = await loadVoicesArchive();
    return NextResponse.json({ archive });
  } catch (e) {
    return NextResponse.json({ error: String(e), archive: defaultArchive() }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const supabase = getSupabase();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  try {
    const body = await req.json();
    const archive = body?.archive as VoicesArchive | undefined;
    if (!archive || !Array.isArray(archive.voices) || archive.voices.length === 0) {
      return NextResponse.json({ error: "Missing archive { voices, defaultId }" }, { status: 400 });
    }
    // Make sure defaultId points to something real; fall back to first voice.
    const defaultId = archive.voices.find((v) => v.id === archive.defaultId)?.id || archive.voices[0].id;
    const row = {
      id: BRAND_VOICE_ID,
      name: "Brand Voice",
      type: "brand-voice",
      data: { voices: archive.voices, defaultId, updatedAt: new Date().toISOString() },
      updated_at: new Date().toISOString(),
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await supabase.from("projects").upsert(row as any, { onConflict: "id" });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    invalidateBrandVoiceCache();
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
