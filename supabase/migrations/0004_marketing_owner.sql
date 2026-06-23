-- 0004 · Per-user scoping for the MarketingSUITE spine.
-- Each teammate (signed-in POAST name) gets their own events/campaigns. Existing
-- rows (none at migration time) fall back to the shared workspace.
alter table marketing_events    add column if not exists owner text not null default 'shared';
alter table marketing_campaigns add column if not exists owner text not null default 'shared';

create index if not exists marketing_events_owner_idx    on marketing_events(owner);
create index if not exists marketing_campaigns_owner_idx on marketing_campaigns(owner);
