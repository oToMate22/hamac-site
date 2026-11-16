-- Est déjà APPLIQUÉE en production le 2026-11-16 (via Management API).
-- Conservée ici pour la traçabilité et pour un environnement neuf (preview/local).

-- Aucune policy supprimée, aucune donnée modifiée.
-- 1) table de limitation de débit   2) fonction claim_form_slot   3) contraintes NOT VALID

create table if not exists public.form_throttle (
  id         bigint generated always as identity primary key,
  form       text not null check (form in ('contact','bien','estimation','offmarket')),
  ip_hash    text not null,
  created_at timestamptz not null default now()
);

create index if not exists form_throttle_ip_idx      on public.form_throttle (ip_hash, created_at desc);
create index if not exists form_throttle_created_idx on public.form_throttle (created_at);

alter table public.form_throttle enable row level security;
revoke all on public.form_throttle from public, anon, authenticated;

create or replace function public.claim_form_slot(p_form text, p_ip_hash text)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_ip     int;
  v_global int;
begin
  if p_form is null or p_form not in ('contact','bien','estimation','offmarket') then
    return false;
  end if;
  if p_ip_hash is null or length(p_ip_hash) < 16 then
    return false;
  end if;

  -- purge opportuniste (pas de pg_cron sur ce projet)
  delete from public.form_throttle where created_at < now() - interval '7 days';

  select count(*) into v_ip
    from public.form_throttle
   where ip_hash = p_ip_hash and created_at > now() - interval '10 minutes';

  select count(*) into v_global
    from public.form_throttle
   where created_at > now() - interval '1 hour';

  if v_ip >= 5 or v_global >= 60 then
    return false;
  end if;

  insert into public.form_throttle (form, ip_hash) values (p_form, p_ip_hash);
  return true;
end;
$$;

revoke all on function public.claim_form_slot(text, text) from public, anon, authenticated;
grant execute on function public.claim_form_slot(text, text) to service_role;

-- Contraintes : NOT VALID = appliquées aux NOUVELLES lignes uniquement,
-- l'historique (lignes de test, spam existant) n'est pas rejeté.
alter table public.leads
  add constraint leads_phone_format check (telephone is null or telephone ~ '^[+0-9 ().-]{6,25}$') not valid,
  add constraint leads_nom_format   check (nom !~ '[0-9]' and length(btrim(nom)) between 2 and 70) not valid,
  add constraint leads_email_format check (email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
                                          and email not like '%..%'
                                          and length(email) <= 254) not valid,
  add constraint leads_message_length check (length(coalesce(message, '')) <= 4000) not valid;

alter table public.estimation_submissions
  add constraint estimation_phone_format check (telephone ~ '^[+0-9 ().-]{6,25}$') not valid,
  add constraint estimation_nom_format   check (nom !~ '[0-9]' and length(btrim(nom)) between 2 and 70) not valid,
  add constraint estimation_prenom_format check (prenom !~ '[0-9]' and length(btrim(prenom)) between 2 and 70) not valid,
  add constraint estimation_email_format check (email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
                                               and email not like '%..%'
                                               and length(email) <= 254) not valid,
  add constraint estimation_message_length check (length(coalesce(message, '')) <= 4000) not valid;

alter table public.offmarket_submissions
  add constraint offmarket_phone_format  check (phone ~ '^[+0-9 ().-]{6,25}$') not valid,
  add constraint offmarket_first_format  check (first_name !~ '[0-9]' and length(btrim(first_name)) between 2 and 70) not valid,
  add constraint offmarket_last_format   check (last_name !~ '[0-9]' and length(btrim(last_name)) between 2 and 70) not valid,
  add constraint offmarket_email_format  check (email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
                                               and email not like '%..%'
                                               and length(email) <= 254) not valid;

select 'hardening appliqué' as statut;