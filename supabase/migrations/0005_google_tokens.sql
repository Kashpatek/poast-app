-- 0005 · Per-user Google OAuth tokens + calendar prefs for two-way Calendar sync.
create table if not exists google_tokens (
  owner          text primary key,
  email          text,
  access_token   text,
  refresh_token  text,
  expiry         timestamptz,
  scope          text,
  calendar_prefs jsonb not null default '{}'::jsonb,  -- { calendarId: { visible, target } }
  updated_at     timestamptz not null default now()
);
