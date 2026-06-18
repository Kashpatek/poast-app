-- POAST ProductionSTUDIO · Clip Engine tables.
--
-- Run this in the Supabase SQL editor before using the Clip Engine.
-- Three additive tables; they never touch existing data (projects, weekly,
-- chart_docs, etc. are untouched). RLS is enabled with reads open to the anon
-- key and writes restricted to the service-role key — same model as
-- chart_docs and the /api/db proxy.

create table if not exists clip_jobs (
  id           text primary key,
  source_url   text not null,
  source_type  text not null check (source_type in ('youtube', 'r2')),
  status       text not null default 'queued'
                 check (status in ('queued','transcribing','transcribed','detecting','done','error')),
  error        text,
  episode_id   text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table if not exists utterance_maps (
  job_id       text primary key references clip_jobs(id) on delete cascade,
  episode_id   text,
  duration_s   double precision,
  utterances   jsonb not null default '[]'::jsonb,
  created_at   timestamptz not null default now()
);

create table if not exists clip_candidates (
  id           text primary key,
  job_id       text not null references clip_jobs(id) on delete cascade,
  start_idx    int,
  end_idx      int,
  start_s      double precision,
  end_s        double precision,
  hook         text,
  score        double precision,
  status       text not null default 'pending'
                 check (status in ('pending','approved','rejected')),
  reason       text,
  created_at   timestamptz not null default now()
);

create index if not exists clip_jobs_status_updated_idx
  on clip_jobs(status, updated_at desc);
create index if not exists clip_candidates_job_score_idx
  on clip_candidates(job_id, score desc);

-- Row Level Security — reads open to anon, writes require the service-role key.
alter table clip_jobs       enable row level security;
alter table utterance_maps  enable row level security;
alter table clip_candidates enable row level security;

drop policy if exists clip_jobs_select_anon on clip_jobs;
create policy clip_jobs_select_anon on clip_jobs for select using (true);

drop policy if exists utterance_maps_select_anon on utterance_maps;
create policy utterance_maps_select_anon on utterance_maps for select using (true);

drop policy if exists clip_candidates_select_anon on clip_candidates;
create policy clip_candidates_select_anon on clip_candidates for select using (true);

-- No INSERT/UPDATE/DELETE policies → only the service-role key can write.
