create table public.apimo_cache (
  key text primary key,
  payload jsonb not null,
  fetched_at timestamptz not null default now()
);

alter table public.apimo_cache enable row level security;

revoke all on table public.apimo_cache from anon, authenticated, public;

drop table if exists public.apimo_properties_cache;
