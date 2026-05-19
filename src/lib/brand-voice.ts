// Brand-voice rules that get injected into system prompts across the
// app's caption-generating surfaces. One row in projects table, edited
// from the AI Training page, fetched by /api/brand-voice and /api/generate.

import { createClient } from "@supabase/supabase-js";

export interface BrandVoice {
  // Free-form tone rules ("direct, data-forward, no hype").
  tone?: string;
  // Phrases / patterns to never produce ("game-changer", em dashes, etc.).
  banned?: string;
  // Things to lean into ("specific numbers, named vendors, sober claims").
  encouraged?: string;
  // Pasted-in great outputs that show the model what good looks like.
  goodExamples?: string;
  // Pasted-in bad outputs that show the model what to avoid.
  badExamples?: string;
  // Anything else the user wants the model to know.
  notes?: string;
  updatedAt?: string;
  updatedBy?: string;
}

export const BRAND_VOICE_ID = "brand-voice-master";

let _supabase: ReturnType<typeof createClient> | null = null;
function getSupabase() {
  if (_supabase) return _supabase;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  _supabase = createClient(url, key);
  return _supabase;
}

let cache: { voice: BrandVoice | null; fetchedAt: number } | null = null;
const CACHE_MS = 30_000; // 30s — long enough to coalesce burst calls, short enough that edits show fast.

export async function loadBrandVoice(): Promise<BrandVoice | null> {
  if (cache && Date.now() - cache.fetchedAt < CACHE_MS) return cache.voice;
  const supabase = getSupabase();
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from("projects")
      .select("data")
      .eq("id", BRAND_VOICE_ID)
      .eq("type", "brand-voice")
      .maybeSingle();
    if (error || !data) {
      cache = { voice: null, fetchedAt: Date.now() };
      return null;
    }
    const voice = ((data as { data?: BrandVoice }).data || null) as BrandVoice | null;
    cache = { voice, fetchedAt: Date.now() };
    return voice;
  } catch {
    return null;
  }
}

// Invalidate the cache after a save so the next caption call picks it up.
export function invalidateBrandVoiceCache() {
  cache = null;
}

// Build the system-prompt block. Returns empty string if the voice is
// blank so we don't pad prompts with placeholders.
export function brandVoiceBlock(voice: BrandVoice | null): string {
  if (!voice) return "";
  const parts: string[] = [];
  if (voice.tone?.trim()) parts.push(`Tone: ${voice.tone.trim()}`);
  if (voice.encouraged?.trim()) parts.push(`Lean into: ${voice.encouraged.trim()}`);
  if (voice.banned?.trim()) parts.push(`Never use: ${voice.banned.trim()}`);
  if (voice.goodExamples?.trim()) parts.push(`Examples of GOOD output (match this style):\n${voice.goodExamples.trim()}`);
  if (voice.badExamples?.trim()) parts.push(`Examples of BAD output (avoid this style):\n${voice.badExamples.trim()}`);
  if (voice.notes?.trim()) parts.push(`Additional notes: ${voice.notes.trim()}`);
  if (!parts.length) return "";
  return "\n\n--- BRAND VOICE ---\n" + parts.join("\n\n") + "\n--- END BRAND VOICE ---";
}

// Convenience for routes that want to inject voice in one shot.
export async function applyBrandVoice(systemPrompt: string): Promise<string> {
  const v = await loadBrandVoice();
  const block = brandVoiceBlock(v);
  if (!block) return systemPrompt;
  return systemPrompt + block;
}
