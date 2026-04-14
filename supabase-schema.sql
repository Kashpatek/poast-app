-- =============================================================================
-- POAST App -- Supabase Schema
-- =============================================================================
-- Run this SQL in the Supabase Dashboard SQL Editor (https://supabase.com/dashboard)
-- to create all the tables the POAST app needs.
--
-- After running this, add the following to your .env.local:
--   NEXT_PUBLIC_SUPABASE_URL=https://<your-project>.supabase.co
--   NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
-- =============================================================================

-- Enable the uuid-ossp extension for uuid_generate_v4()
create extension if not exists "uuid-ossp";

-- ---------------------------------------------------------------------------
-- PROSPECTS
-- Guest / collaboration prospects for outreach tracking
-- ---------------------------------------------------------------------------
create table if not exists prospects (
  id         uuid primary key default uuid_generate_v4(),
  name       text not null,
  company    text,
  role       text,
  topics     text[],
  tier       text,           -- e.g. 'A', 'B', 'C'
  status     text,           -- e.g. 'researching', 'contacted', 'confirmed', 'declined'
  outreach   jsonb,          -- flexible log of outreach attempts / notes
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ---------------------------------------------------------------------------
-- EPISODES
-- Podcast episode planning and tracking
-- ---------------------------------------------------------------------------
create table if not exists episodes (
  id           uuid primary key default uuid_generate_v4(),
  number       int,
  guest_name   text,
  topic        text,
  record_date  date,
  release_date date,
  status       text,         -- e.g. 'planning', 'recorded', 'editing', 'published'
  notes        text,
  podcast      text,         -- which podcast this belongs to
  created_at   timestamptz default now()
);

-- ---------------------------------------------------------------------------
-- ARCHIVE
-- Published episode archive / back-catalog
-- ---------------------------------------------------------------------------
create table if not exists archive (
  id             uuid primary key default uuid_generate_v4(),
  episode_number int,
  guest          text,
  company        text,
  topic          text,
  category       text,
  release_date   date,
  plays          int default 0,
  podcast        text
);

-- ---------------------------------------------------------------------------
-- TRENDS
-- Content / market trend tracking (trend radar)
-- ---------------------------------------------------------------------------
create table if not exists trends (
  id              uuid primary key default uuid_generate_v4(),
  url             text,
  platform        text,
  format          text,
  audio           text,
  visual          text,
  sentiment       text,
  audience        text,
  cta_type        text,
  relevance_score int,       -- 1-10 relevance to SA brands
  sa_angle        text,      -- how SA can use this trend
  status          text,      -- e.g. 'spotted', 'analyzing', 'actionable', 'archived'
  created_at      timestamptz default now()
);

-- ---------------------------------------------------------------------------
-- OUTREACH
-- Podcast-to-podcast (P2P) outreach / guest-swap tracking
-- ---------------------------------------------------------------------------
create table if not exists outreach (
  id           uuid primary key default uuid_generate_v4(),
  show_name    text,
  host         text,
  audience_size text,
  topic_focus  text,
  tier         text,
  assigned_to  text,
  status       text,         -- e.g. 'identified', 'pitched', 'booked', 'completed'
  contact      text,
  notes        text,
  created_at   timestamptz default now()
);

-- ---------------------------------------------------------------------------
-- PROJECTS
-- Generic project / workflow storage (P2P data, custom workflows)
-- Uses a JSONB data column for flexible structure per project type.
-- ---------------------------------------------------------------------------
create table if not exists projects (
  id         uuid primary key default uuid_generate_v4(),
  name       text not null,
  data       jsonb,          -- flexible data blob per project type
  type       text,           -- e.g. 'p2p', 'campaign', 'custom'
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ---------------------------------------------------------------------------
-- WEEKLY
-- SA Weekly planning data (newsletter, social calendar, etc.)
-- Uses a JSONB data column so each week's structure can evolve.
-- ---------------------------------------------------------------------------
create table if not exists weekly (
  id         uuid primary key default uuid_generate_v4(),
  name       text,           -- e.g. 'Week of 2026-04-13'
  data       jsonb,          -- flexible weekly planning data
  type       text,           -- e.g. 'newsletter', 'social', 'planning'
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ---------------------------------------------------------------------------
-- ROW-LEVEL SECURITY (RLS)
-- ---------------------------------------------------------------------------
-- Enable RLS on all tables. By default, the anon key can read/write
-- everything. Tighten these policies later when you add auth.

alter table prospects enable row level security;
alter table episodes  enable row level security;
alter table archive   enable row level security;
alter table trends    enable row level security;
alter table outreach  enable row level security;
alter table projects  enable row level security;
alter table weekly    enable row level security;

-- Allow all operations for the anon role (open access -- tighten later)
create policy "Allow all for anon" on prospects for all using (true) with check (true);
create policy "Allow all for anon" on episodes  for all using (true) with check (true);
create policy "Allow all for anon" on archive   for all using (true) with check (true);
create policy "Allow all for anon" on trends    for all using (true) with check (true);
create policy "Allow all for anon" on outreach  for all using (true) with check (true);
create policy "Allow all for anon" on projects  for all using (true) with check (true);
create policy "Allow all for anon" on weekly    for all using (true) with check (true);

-- ---------------------------------------------------------------------------
-- AUTO-UPDATE updated_at TRIGGER
-- ---------------------------------------------------------------------------
-- Automatically set updated_at on tables that have the column.

create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger set_updated_at before update on prospects
  for each row execute function update_updated_at_column();

create trigger set_updated_at before update on projects
  for each row execute function update_updated_at_column();

create trigger set_updated_at before update on weekly
  for each row execute function update_updated_at_column();
