-- Lecture agrégée pour le tableau de bord. Aucune colonne d'identité
-- (nom, e-mail, téléphone, message) n'est lue ni renvoyée.
-- Non appliquée sur le projet hébergé : migration locale uniquement.

create table if not exists public.dashboard_nonce (
  key_id text not null,
  nonce text not null,
  seen_at timestamptz not null default pg_catalog.now(),
  primary key (key_id, nonce)
);

alter table public.dashboard_nonce enable row level security;
revoke all on public.dashboard_nonce from public, anon, authenticated;

create or replace function public.dashboard_nonce_consume(p_key_id text, p_nonce text)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_inserted integer;
begin
  if p_key_id is null or p_nonce is null
     or length(p_nonce) < 16 or length(p_nonce) > 128
     or p_nonce !~ '^[A-Za-z0-9_-]+$' then
    return false;
  end if;

  delete from public.dashboard_nonce
   where seen_at < pg_catalog.now() - interval '10 minutes';

  insert into public.dashboard_nonce (key_id, nonce)
  values (p_key_id, p_nonce)
  on conflict do nothing;

  get diagnostics v_inserted = row_count;
  return v_inserted = 1;
end;
$$;

revoke all on function public.dashboard_nonce_consume(text, text) from public, anon, authenticated;
grant execute on function public.dashboard_nonce_consume(text, text) to service_role;

create or replace function public.dashboard_metrics_read(p_from date, p_to date)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_days integer;
  v_prev_from date;
  v_prev_to date;
  v_received bigint;
  v_received_prev bigint;
  v_estim bigint;
  v_estim_prev bigint;
  v_by_day jsonb;
  v_weekly jsonb;
  v_latest jsonb;
  v_catalog jsonb;
begin
  if p_from is null or p_to is null or p_from > p_to then
    raise exception 'invalid period' using errcode = '22023';
  end if;
  v_days := (p_to - p_from) + 1;
  if v_days < 1 or v_days > 366 then
    raise exception 'invalid period' using errcode = '22023';
  end if;
  v_prev_to := p_from - 1;
  v_prev_from := v_prev_to - (v_days - 1);

  with events as (
    select (created_at at time zone 'Europe/Paris')::date as day,
           case
             when type_contact = 'bien'
               or (type_contact is null and bien_ref is not null) then 'bien'
             else 'contact'
           end as kind
      from public.leads
     where created_at is not null
    union all
    select (created_at at time zone 'Europe/Paris')::date, 'estimation'
      from public.estimation_submissions
     where created_at is not null
    union all
    select (created_at at time zone 'Europe/Paris')::date, 'offmarket'
      from public.offmarket_submissions
     where created_at is not null
  )
  select
    count(*) filter (where day between p_from and p_to),
    count(*) filter (where day between v_prev_from and v_prev_to),
    count(*) filter (where kind = 'estimation' and day between p_from and p_to),
    count(*) filter (where kind = 'estimation' and day between v_prev_from and v_prev_to)
  into v_received, v_received_prev, v_estim, v_estim_prev
  from events;

  with events as (
    select (created_at at time zone 'Europe/Paris')::date as day,
           case
             when type_contact = 'bien'
               or (type_contact is null and bien_ref is not null) then 'bien'
             else 'contact'
           end as kind
      from public.leads
     where created_at is not null
    union all
    select (created_at at time zone 'Europe/Paris')::date, 'estimation'
      from public.estimation_submissions
     where created_at is not null
    union all
    select (created_at at time zone 'Europe/Paris')::date, 'offmarket'
      from public.offmarket_submissions
     where created_at is not null
  ),
  days as (
    select generate_series(p_from, p_to, interval '1 day')::date as day
  ),
  counted as (
    select days.day,
           count(*) filter (where events.kind = 'bien') as bien,
           count(*) filter (where events.kind = 'contact') as contact,
           count(*) filter (where events.kind = 'estimation') as estimation,
           count(*) filter (where events.kind = 'offmarket') as offmarket
      from days
      left join events on events.day = days.day
     group by days.day
     order by days.day
  )
  select jsonb_build_object(
    'start', to_char(p_from, 'YYYY-MM-DD'),
    'bien', jsonb_agg(bien order by day),
    'contact', jsonb_agg(contact order by day),
    'estimation', jsonb_agg(estimation order by day),
    'offmarket', jsonb_agg(offmarket order by day)
  )
  into v_by_day
  from counted;

  with events as (
    select (created_at at time zone 'Europe/Paris')::date as day
      from public.leads
     where created_at is not null
    union all
    select (created_at at time zone 'Europe/Paris')::date
      from public.estimation_submissions
     where created_at is not null
    union all
    select (created_at at time zone 'Europe/Paris')::date
      from public.offmarket_submissions
     where created_at is not null
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'date', to_char(week, 'YYYY-MM-DD'),
           'value', total
         ) order by week), '[]'::jsonb)
  into v_weekly
  from (
    select date_trunc('week', day)::date as week, count(*) as total
      from events
     where day between p_from and p_to
     group by 1
  ) weeks;

  with latest as (
    select created_at, kind, label, detail
      from (
        select created_at,
               'bien'::text as kind,
               'Demande sur un bien'::text as label,
               case
                 when bien_ref is not null and btrim(bien_ref) <> '' then 'Réf. ' || bien_ref
                 else 'Demande sur un bien'
               end as detail
          from public.leads
         where created_at is not null
           and (type_contact = 'bien' or (type_contact is null and bien_ref is not null))
           and (created_at at time zone 'Europe/Paris')::date between p_from and p_to
        union all
        select created_at, 'contact', 'Contact général', 'Page contact'
          from public.leads
         where created_at is not null
           and not (type_contact = 'bien' or (type_contact is null and bien_ref is not null))
           and (created_at at time zone 'Europe/Paris')::date between p_from and p_to
        union all
        select created_at,
               'estimation',
               'Estimation',
               coalesce(nullif(concat_ws(' · ', nullif(btrim(property_type), ''), nullif(btrim(city), '')), ''), 'Estimation')
          from public.estimation_submissions
         where created_at is not null
           and (created_at at time zone 'Europe/Paris')::date between p_from and p_to
        union all
        select created_at,
               'offmarket',
               'Off-market',
               coalesce(nullif(concat_ws(' · ', nullif(btrim(property_type), ''), nullif(btrim(sector), '')), ''), 'Off-market')
          from public.offmarket_submissions
         where created_at is not null
           and (created_at at time zone 'Europe/Paris')::date between p_from and p_to
      ) rows
     order by created_at desc
     limit 5
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'kind', kind,
           'label', label,
           'detail', detail,
           'when', to_char(created_at at time zone 'Europe/Paris', 'YYYY-MM-DD"T"HH24:MI:SS')
         ) order by created_at desc), '[]'::jsonb)
  into v_latest
  from latest;

  if not exists (select 1 from public.apimo_cache where key = 'properties') then
    v_catalog := null;
  else
    with props as (
      select prop
        from public.apimo_cache cache
        cross join lateral jsonb_array_elements(
          case
            when jsonb_typeof(cache.payload) = 'array' then cache.payload
            when jsonb_typeof(cache.payload->'properties') = 'array' then cache.payload->'properties'
            when jsonb_typeof(cache.payload->'items') = 'array' then cache.payload->'items'
            when jsonb_typeof(cache.payload->'results') = 'array' then cache.payload->'results'
            when jsonb_typeof(cache.payload->'data') = 'array' then cache.payload->'data'
            else '[]'::jsonb
          end
        ) prop
       where cache.key = 'properties'
    ),
    safe as (
      select
        prop->>'reference' as reference,
        prop->'city'->>'name' as city,
        case
          when jsonb_typeof(prop->'area'->'value') = 'number' then (prop->'area'->>'value')::numeric
          when jsonb_typeof(prop->'area'->'value') = 'string'
           and (prop->'area'->>'value') ~ '^[0-9]+(\.[0-9]+)?$'
          then (prop->'area'->>'value')::numeric
        end as surface,
        case
          when jsonb_typeof(prop->'price'->'value') = 'number' then (prop->'price'->>'value')::numeric
          when jsonb_typeof(prop->'price'->'value') = 'string'
           and (prop->'price'->>'value') ~ '^[0-9]+(\.[0-9]+)?$'
          then (prop->'price'->>'value')::numeric
        end as price,
        (coalesce(jsonb_typeof(prop->'price'->'period') = 'number'
          or jsonb_typeof(prop->'price'->'period') = 'string', false)) as rental
      from props
    ),
    leads_by_ref as (
      select bien_ref as reference,
             count(*) as leads,
             max(created_at) as last_at
        from public.leads
       where created_at is not null
         and bien_ref is not null
         and (type_contact = 'bien' or type_contact is null)
         and (created_at at time zone 'Europe/Paris')::date between p_from and p_to
       group by bien_ref
    )
    select coalesce(jsonb_agg(jsonb_build_object(
             'ref', safe.reference,
             'city', safe.city,
             'surface', safe.surface,
             'price', safe.price,
             'rental', safe.rental,
             'leads', coalesce(leads_by_ref.leads, 0),
             'last', case
               when leads_by_ref.last_at is null then null
               else to_char(leads_by_ref.last_at at time zone 'Europe/Paris', 'YYYY-MM-DD"T"HH24:MI:SS')
             end
           ) order by coalesce(leads_by_ref.leads, 0) desc, safe.reference), '[]'::jsonb)
      into v_catalog
      from safe
      left join leads_by_ref on leads_by_ref.reference = safe.reference
     where safe.reference is not null and btrim(safe.reference) <> ''
       and safe.city is not null and btrim(safe.city) <> ''
       and safe.price is not null;
  end if;

  return jsonb_build_object(
    'received', jsonb_build_object('value', v_received, 'previous', v_received_prev),
    'estimations', jsonb_build_object('value', v_estim, 'previous', v_estim_prev),
    'byDay', v_by_day,
    'weekly', v_weekly,
    'latest', v_latest,
    'catalog', v_catalog
  );
end;
$$;

revoke all on function public.dashboard_metrics_read(date, date) from public, anon, authenticated;
grant execute on function public.dashboard_metrics_read(date, date) to service_role;
