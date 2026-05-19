// CRUD for the single brand-voice row in projects table. Reads are cached
// for 30s inside brand-voice.ts so caption-gen routes don't hammer
// Supabase on every Claude call.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { BRAND_VOICE_ID, invalidateBrandVoiceCache, type BrandVoice } from "@/lib/brand-voice";

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
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  try {
    const { data, error } = await supabase
      .from("projects")
      .select("data, updated_at")
      .eq("id", BRAND_VOICE_ID)
      .eq("type", "brand-voice")
      .maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const row = data as { data?: BrandVoice; updated_at?: string } | null;
    return NextResponse.json({ voice: row?.data || null, updated_at: row?.updated_at || null });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const supabase = getSupabase();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  try {
    const body = await req.json();
    const voice = (body?.voice || {}) as BrandVoice;
    const row = {
      id: BRAND_VOICE_ID,
      name: "Brand Voice",
      type: "brand-voice",
      data: { ...voice, updatedAt: new Date().toISOString() },
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
