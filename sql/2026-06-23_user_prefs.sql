-- Per-user appearance preferences (theme + background) and first-run tour flag.
-- Owner-keyed to mirror google_tokens (owner = poast-current-user identity).
-- Idempotent.
create table if not exists public.user_prefs (
  owner       text primary key,
  theme       text not null default 'classic',   -- 'classic' | 'stock' | 'glass'
  bg          text not null default 'aurora',     -- 'aurora' | 'cockpit' | 'iridescent'
  tour_seen   boolean not null default false,
  updated_at  timestamptz not null default now()
);

-- PostgREST schema cache refresh (no-op outside Supabase/PostgREST).
notify pgrst, 'reload schema';
