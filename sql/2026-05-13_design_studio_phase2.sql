-- DesignStudio · Phase 2 schema extensions
-- Idempotent. Safe to re-run. Paste into the Supabase SQL editor.

-- 1. Relax the type CHECK so the new project kinds are allowed.
alter table public.docu_projects
  drop constraint if exists docu_projects_type_check;

alter table public.docu_projects
  add constraint docu_projects_type_check
  check (type in ('document','other','graphic','image','motion','programmatic','quote','event'));

-- 2. New optional columns on existing project rows.
alter table public.docu_projects add column if not exists size_preset  text;
alter table public.docu_projects add column if not exists purpose      text;
alter table public.docu_projects add column if not exists category     text;
alter table public.docu_projects add column if not exists brief        jsonb  not null default '{}'::jsonb;
alter table public.docu_projects add column if not exists format       text   not null default 'svg';
alter table public.docu_projects add column if not exists output_files jsonb  not null default '[]'::jsonb;
alter table public.docu_projects add column if not exists editor_doc   jsonb  not null default '{}'::jsonb;

-- 3. Templates table for the Polotno SA library (Phase 5).
create table if not exists public.docu_templates (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  category    text not null,
  preview_url text,
  json        jsonb not null,
  created_at  timestamptz not null default now()
);

-- 4. Quick lookup index for project sort by recency (already exists in most
-- Supabase setups via the primary key + updated_at index, but cheap to ensure).
create index if not exists idx_docu_projects_updated_at on public.docu_projects (updated_at desc);
