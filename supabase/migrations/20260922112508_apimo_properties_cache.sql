create table public.apimo_properties_cache (
  key text primary key,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.apimo_properties_cache enable row level security;

revoke all on table public.apimo_properties_cache from anon, authenticated, public;
