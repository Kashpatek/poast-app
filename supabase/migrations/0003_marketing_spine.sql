-- POAST MarketingSUITE · data spine (campaigns + events).
--
-- Run this in the Supabase SQL editor before MarketingSUITE persists to the
-- cloud. Two additive tables; they never touch existing data. RLS is enabled
-- with reads open to the anon key and writes restricted to the service-role
-- key — the same model as chart_docs / clip_engine / the /api/db proxy.
--
-- MarketingSUITE runs fully on local demo data until this migration is applied,
-- so the UI is reviewable before the tables exist.

create table if not exists marketing_campaigns (
  id          text primary key,
  name        text not null,
  color       text,
  status      text not null default 'planning'
                check (status in ('planning','active','wrapping','done')),
  goal        text,
  starts_at   timestamptz,
  ends_at     timestamptz,
  series      jsonb not null default '[]'::jsonb,
  payload     jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists marketing_events (
  id            text primary key,
  title         text not null,
  event_type    text not null default 'manual',
  status        text not null default 'idea'
                  check (status in ('idea','draft','scheduled','live','done','blocked')),
  starts_at     timestamptz not null,
  ends_at       timestamptz,
  campaign_id   text references marketing_campaigns(id) on delete set null,
  channel       text,
  -- where the event came from. Buffer posts, BRIANNA insights, POAST
  -- production dates and Google-Calendar pushes all flow into this one spine.
  source        text not null default 'manual'
                  check (source in ('manual','buffer','poast','brianna','gcal')),
  gcal_event_id text,
  notes         text,
  payload       jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists marketing_events_start_idx    on marketing_events(starts_at);
create index if not exists marketing_events_campaign_idx  on marketing_events(campaign_id);
create index if not exists marketing_events_source_idx    on marketing_events(source);

-- Row Level Security — reads open to anon, writes require the service-role key.
alter table marketing_campaigns enable row level security;
alter table marketing_events    enable row level security;

drop policy if exists marketing_campaigns_select_anon on marketing_campaigns;
create policy marketing_campaigns_select_anon on marketing_campaigns for select using (true);

drop policy if exists marketing_events_select_anon on marketing_events;
create policy marketing_events_select_anon on marketing_events for select using (true);

-- No INSERT/UPDATE/DELETE policies → only the service-role key can write.
