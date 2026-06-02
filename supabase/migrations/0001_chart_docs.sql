-- POAST Studio · documents table.
--
-- Run this in the Supabase SQL editor before flipping the Studio swap on.
-- Holds chart / table / diagram documents created by named users
-- (Akash, Michelle, Vansh, Daksh). Analysts never reach this table — their
-- docs stay in localStorage per studio-storage.ts.

create table if not exists chart_docs (
  id          text primary key,
  owner       text not null,
  type        text not null check (type in ('chart', 'table', 'diagram')),
  name        text not null,
  thumbnail   text,
  payload     jsonb not null,
  tags        text[] default '{}',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists chart_docs_owner_updated_idx
  on chart_docs(owner, updated_at desc);

-- Row Level Security
-- We rely on the service-role key for writes (same pattern as /api/db).
-- RLS is enabled but writes require the service role; reads are open to
-- the anon key so any read path that doesn't go through the API can still
-- function (none exist today, but leaving the door open for embeds).
alter table chart_docs enable row level security;

drop policy if exists chart_docs_select_anon on chart_docs;
create policy chart_docs_select_anon on chart_docs
  for select using (true);

-- No INSERT/UPDATE/DELETE policy → only service-role key can write.
