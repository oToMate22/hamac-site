-- Journal des échecs techniques d'envoi. Non appliquée : ne pas pousser
-- sans autorisation explicite.
--
-- Trois catégories, et rien d'autre :
--   record           l'INSERT de la demande a échoué après validation
--   agency_notify    l'e-mail agence n'est pas parti
--   prospect_confirm l'accusé prospect n'est pas parti
--
-- Aucune colonne d'identité, de message ou d'adresse IP.
-- Les refus de validation, Turnstile et quota ne s'écrivent pas ici :
-- ils sont rejetés avant l'appel à delivery_failure_record.
--
-- Aucun trigger notify_* n'est posé sur ces tables. Une ligne de journal
-- ne peut ni envoyer un e-mail ni rappeler notify-lead.
-- Les triggers existants des formulaires ne sont pas modifiés.
-- dashboard_metrics_read n'est pas remplacée : les agrégats actuels
-- restent ceux de 20261118190000. Le connecteur lit dashboard_delivery_read
-- à part et ignore son absence.

create table public.delivery_journal (
  id boolean primary key default true,
  started_on date not null,
  constraint delivery_journal_one_row check (id)
);

insert into public.delivery_journal (started_on)
values ((pg_catalog.now() at time zone 'Europe/Paris')::date);

create table public.delivery_failures (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  form text not null,
  stage text not null,
  reason text not null,
  created_at timestamptz not null default pg_catalog.now(),
  constraint delivery_failures_kind_chk check (
    form in ('contact', 'bien', 'estimation', 'offmarket')
    and (
      (stage = 'record' and reason in ('database_unreachable', 'insert_failed'))
      or (stage = 'agency_notify' and reason in ('send_failed', 'unconfigured', 'unreachable'))
      or (stage = 'prospect_confirm' and reason in ('send_failed', 'unreachable'))
    )
  )
);

create index delivery_failures_created_idx
  on public.delivery_failures (created_at);

alter table public.delivery_journal enable row level security;
alter table public.delivery_failures enable row level security;

revoke all on public.delivery_journal from public, anon, authenticated, service_role;
revoke all on public.delivery_failures from public, anon, authenticated, service_role;

create or replace function public.delivery_failure_record(
  p_form text,
  p_stage text,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  insert into public.delivery_failures (form, stage, reason)
  values (p_form, p_stage, p_reason);
end;
$$;

revoke all on function public.delivery_failure_record(text, text, text) from public, anon, authenticated;
grant execute on function public.delivery_failure_record(text, text, text) to service_role;

create or replace function public.dashboard_delivery_read(p_from date, p_to date)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_days integer;
  v_since date;
  v_slice_from date;
  v_prev_from date;
  v_prev_to date;
  v_value bigint;
  v_previous bigint;
  v_inserts bigint;
  v_record_failures bigint;
  v_rows jsonb;
begin
  if p_from is null or p_to is null or p_from > p_to then
    raise exception 'invalid period' using errcode = '22023';
  end if;
  v_days := (p_to - p_from) + 1;
  if v_days < 1 or v_days > 366 then
    raise exception 'invalid period' using errcode = '22023';
  end if;

  select started_on into v_since from public.delivery_journal where id;
  if v_since is null then
    return null;
  end if;

  if p_to < v_since then
    return jsonb_build_object('since', to_char(v_since, 'YYYY-MM-DD'));
  end if;

  v_slice_from := greatest(p_from, v_since);
  v_prev_to := p_from - 1;
  v_prev_from := v_prev_to - (v_days - 1);

  select count(*) into v_value
    from public.delivery_failures
   where (created_at at time zone 'Europe/Paris')::date between v_slice_from and p_to;

  if v_prev_from >= v_since then
    select count(*) into v_previous
      from public.delivery_failures
     where (created_at at time zone 'Europe/Paris')::date between v_prev_from and v_prev_to;
  else
    v_previous := 0;
  end if;

  select count(*) into v_inserts
    from (
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
    ) events
   where day between v_slice_from and p_to;

  select count(*) into v_record_failures
    from public.delivery_failures
   where stage = 'record'
     and (created_at at time zone 'Europe/Paris')::date between v_slice_from and p_to;

  select coalesce(
           jsonb_agg(jsonb_build_object('label', label, 'count', total) order by ord),
           '[]'::jsonb
         )
    into v_rows
    from (
      select stages.ord, stages.label, counts.total
        from (
          values
            (1, 'record'::text, 'Enregistrement'::text),
            (2, 'agency_notify', 'Notification agence'),
            (3, 'prospect_confirm', 'Confirmation prospect')
        ) as stages(ord, stage, label)
        cross join lateral (
          select count(*) as total
            from public.delivery_failures as failures
           where failures.stage = stages.stage
             and (failures.created_at at time zone 'Europe/Paris')::date between v_slice_from and p_to
        ) as counts
       where counts.total > 0
    ) as present;

  return jsonb_build_object(
    'since', to_char(v_since, 'YYYY-MM-DD'),
    'failed', jsonb_build_object(
      'value', v_value,
      'previous', v_previous,
      'attempts', v_inserts + v_record_failures,
      'rows', v_rows
    )
  );
end;
$$;

revoke all on function public.dashboard_delivery_read(date, date) from public, anon, authenticated;
grant execute on function public.dashboard_delivery_read(date, date) to service_role;

-- Retour arrière, à exécuter seulement sur demande :
-- drop function public.dashboard_delivery_read(date, date);
-- drop function public.delivery_failure_record(text, text, text);
-- drop table public.delivery_failures;
-- drop table public.delivery_journal;
