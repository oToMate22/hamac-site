-- Catalogue autonome : instantanés des biens Apimo, journal de synchronisation, état/verrou,
-- bucket des images de partage et planification pg_cron.
-- Voir docs/architecture-catalogue-dynamique.md et docs/deploiement-catalogue-dynamique.md.
--
-- Prérequis (déjà en place pour notify-lead) : extension pg_net, secret Vault « service_role ».
-- La migration N'ACTIVE RIEN : le job pg_cron n'est créé qu'à l'activation explicite (validation requise) :
--   select public.catalog_sync_configure(p_enabled := true, p_interval_minutes := 10);   -- mode « observe »
--   select public.catalog_sync_configure(p_mode := 'active');                            -- images + purge CDN
-- Arrêt immédiat : select public.catalog_sync_configure(p_enabled := false);

create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;

create schema if not exists private;

-- ---------------------------------------------------------------------------
-- Instantanés : dernière version VALIDE de chaque bien (jamais effacée par une panne).
create table if not exists public.listing_snapshots (
  id text primary key check (id ~ '^\d{5,12}$'),
  kind text not null check (kind in ('acheter', 'louer')),
  status text not null check (status in ('active', 'pending_withdrawal', 'withdrawn')),
  payload jsonb not null,
  payload_hash text not null,
  updated_at_apimo text,
  og_hash text check (og_hash is null or og_hash ~ '^[0-9a-f]{12}$'),
  og_status text not null default 'none' check (og_status in ('pending', 'ready', 'failed', 'none')),
  og_attempts integer not null default 0,
  og_next_attempt_at timestamptz,
  og_last_error text,
  missing_runs integer not null default 0,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz,
  withdrawn_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists listing_snapshots_status_idx on public.listing_snapshots (status);

alter table public.listing_snapshots enable row level security;
revoke all on table public.listing_snapshots from anon, authenticated, public;

-- Plus grand identifiant connu (repli « en direct » de listing-feed pour les biens très récents).
create or replace function public.listing_snapshots_max_id()
returns bigint
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select max(id::bigint) from public.listing_snapshots;
$$;

revoke all on function public.listing_snapshots_max_id() from public, anon, authenticated;
grant execute on function public.listing_snapshots_max_id() to service_role;

-- ---------------------------------------------------------------------------
-- Journal des synchronisations (alertes, futur dashboard OTOMATE).
create table if not exists public.catalog_sync_runs (
  id bigint generated always as identity primary key,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  outcome text not null check (outcome in ('ok', 'degraded', 'failed', 'skipped')),
  mode text,
  trustworthy boolean,
  reason text,
  http_status integer,
  source text,
  seen integer,
  created integer,
  updated integer,
  reactivated integer,
  pending_withdrawal integer,
  withdrawn integer,
  og_generated integer,
  og_failed integer,
  revalidated_tags integer,
  duration_ms integer,
  details jsonb
);

create index if not exists catalog_sync_runs_started_idx on public.catalog_sync_runs (started_at desc);

alter table public.catalog_sync_runs enable row level security;
revoke all on table public.catalog_sync_runs from anon, authenticated, public;

-- ---------------------------------------------------------------------------
-- État unique : verrou, backoff (429 / pannes), alertes, configuration.
create table if not exists public.catalog_sync_state (
  id boolean primary key default true check (id),
  enabled boolean not null default false,
  mode text not null default 'observe' check (mode in ('observe', 'active')),
  interval_minutes integer not null default 10 check (interval_minutes between 1 and 60),
  sync_url text not null default 'https://lxkhozdshbpdjnanbnzi.supabase.co/functions/v1/catalog-sync',
  running_since timestamptz,
  backoff_until timestamptz,
  consecutive_failures integer not null default 0,
  failing_since timestamptz,
  last_success_at timestamptz,
  last_run_at timestamptz,
  last_alert_at timestamptz,
  last_cleanup_at timestamptz,
  updated_at timestamptz not null default now()
);

insert into public.catalog_sync_state (id) values (true) on conflict (id) do nothing;

alter table public.catalog_sync_state enable row level security;
revoke all on table public.catalog_sync_state from anon, authenticated, public;

-- Verrou atomique : un seul run à la fois (un run bloqué plus de 10 min est considéré mort).
create or replace function public.catalog_sync_try_lock(p_stale_after interval default interval '10 minutes')
returns boolean
language sql
security definer
set search_path = public, pg_catalog
as $$
  with locked as (
    update public.catalog_sync_state
       set running_since = now(), last_run_at = now(), updated_at = now()
     where id
       and enabled
       and (running_since is null or running_since < now() - p_stale_after)
    returning 1
  )
  select exists (select 1 from locked);
$$;

create or replace function public.catalog_sync_release_lock()
returns void
language sql
security definer
set search_path = public, pg_catalog
as $$
  update public.catalog_sync_state set running_since = null, updated_at = now() where id;
$$;

revoke all on function public.catalog_sync_try_lock(interval) from public, anon, authenticated;
revoke all on function public.catalog_sync_release_lock() from public, anon, authenticated;
grant execute on function public.catalog_sync_try_lock(interval) to service_role;
grant execute on function public.catalog_sync_release_lock() to service_role;

-- ---------------------------------------------------------------------------
-- Appel de la fonction Edge par pg_cron (même schéma que notify-lead : secret Vault service_role).
create or replace function private.catalog_sync_invoke()
returns void
language plpgsql
security definer
set search_path = pg_catalog, private, public, net, vault
as $$
declare
  secret text;
  target text;
  is_enabled boolean;
begin
  select sync_url, enabled into target, is_enabled from public.catalog_sync_state where id;
  if not coalesce(is_enabled, false) then
    return;
  end if;

  select ds.decrypted_secret into secret
    from vault.decrypted_secrets as ds
   where ds.name = 'service_role'
   limit 1;

  if secret is null or length(secret) = 0 then
    raise warning 'catalog_sync: vault secret service_role absent';
    return;
  end if;

  perform net.http_post(
    url := target,
    body := jsonb_build_object('trigger', 'cron'),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || secret,
      'apikey', secret
    ),
    timeout_milliseconds := 10000
  );
exception
  when others then
    raise warning 'catalog_sync: %', sqlerrm;
end;
$$;

revoke all on function private.catalog_sync_invoke() from public, anon, authenticated;

-- Fréquence configurable sans redéploiement : select public.catalog_sync_configure(p_interval_minutes := 10);
create or replace function public.catalog_sync_configure(
  p_interval_minutes integer default null,
  p_mode text default null,
  p_enabled boolean default null,
  p_sync_url text default null
)
returns public.catalog_sync_state
language plpgsql
security definer
set search_path = public, pg_catalog, cron
as $$
declare
  state public.catalog_sync_state;
  schedule text;
begin
  update public.catalog_sync_state
     set interval_minutes = coalesce(p_interval_minutes, interval_minutes),
         mode = coalesce(p_mode, mode),
         enabled = coalesce(p_enabled, enabled),
         sync_url = coalesce(p_sync_url, sync_url),
         updated_at = now()
   where id
  returning * into state;

  schedule := case
    when state.interval_minutes = 60 then '0 * * * *'
    else format('*/%s * * * *', state.interval_minutes)
  end;

  if state.enabled then
    perform cron.schedule('hamac-catalog-sync', schedule, 'select private.catalog_sync_invoke()');
  else
    perform cron.unschedule(jobid) from cron.job where jobname = 'hamac-catalog-sync';
  end if;

  return state;
end;
$$;

revoke all on function public.catalog_sync_configure(integer, text, boolean, text) from public, anon, authenticated;
grant execute on function public.catalog_sync_configure(integer, text, boolean, text) to service_role;

-- ---------------------------------------------------------------------------
-- Images de partage : lecture publique (servies via hamacpatrimoine.com/fr/og/listings/…),
-- écriture réservée à la clé de service (catalog-sync, côté Supabase uniquement).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('og-listings', 'og-listings', true, 524288, array['image/jpeg'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ---------------------------------------------------------------------------
-- Surveillance (24 dernières heures) : 429 Apimo, échecs, images, écart avec le cache Apimo.
-- Lecture réservée à la clé de service (futur dashboard OTOMATE via une fonction Edge).
create or replace view public.catalog_sync_health
with (security_invoker = true)
as
select
  (select count(*) from public.catalog_sync_runs where started_at > now() - interval '24 hours') as runs_24h,
  (select count(*) from public.catalog_sync_runs where started_at > now() - interval '24 hours' and outcome = 'ok') as ok_24h,
  (select count(*) from public.catalog_sync_runs where started_at > now() - interval '24 hours' and outcome = 'degraded') as degraded_24h,
  (select count(*) from public.catalog_sync_runs where started_at > now() - interval '24 hours' and outcome = 'failed') as failed_24h,
  (select count(*) from public.catalog_sync_runs where started_at > now() - interval '24 hours' and http_status = 429) as quota_429_24h,
  (select coalesce(sum(withdrawn), 0) from public.catalog_sync_runs where started_at > now() - interval '24 hours') as withdrawn_24h,
  (select coalesce(sum(og_generated), 0) from public.catalog_sync_runs where started_at > now() - interval '24 hours') as og_generated_24h,
  (select count(*) from public.listing_snapshots where status <> 'withdrawn') as listings_served,
  (select (payload->>'total_items')::int from public.apimo_cache where key = 'properties') as apimo_cached_total,
  (select count(*) from public.listing_snapshots where og_status = 'failed') as og_failed,
  (select last_success_at from public.catalog_sync_state where id) as last_success_at,
  (select backoff_until from public.catalog_sync_state where id) as backoff_until,
  (select failing_since from public.catalog_sync_state where id) as failing_since;

revoke all on public.catalog_sync_health from public, anon, authenticated;
grant select on public.catalog_sync_health to service_role;

-- Aucune planification ici : voir l'en-tête (activation explicite, 10 minutes, mode observation).
