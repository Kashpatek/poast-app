// Lazy Supabase singleton for the Clip Engine routes.
//
// Auth model mirrors /api/studio: prefer the service-role key (bypasses RLS
// for writes), fall back to the anon key for read-only paths. Returns null
// when Supabase isn't configured so callers can answer 503.
//
// The client is loosely typed (schema generics = any) because POAST has no
// generated Database type — same effect as the `as any` casts in /api/studio,
// but centralized so the clip routes can read/write rows without per-call casts.

import { createClient, type SupabaseClient } from "@/app/lib/neon-db";

type LooseClient = SupabaseClient;

let _client: LooseClient | null = null;

export function getClipSupabase(): LooseClient | null {
  if (_client) return _client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  _client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  }) as unknown as LooseClient;
  return _client;
}
