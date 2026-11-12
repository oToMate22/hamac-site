-- Notifie Romain + Victor à chaque insert formulaire (leads, estimation, off-market).
-- Destinataires / clé Resend : secrets Edge Function (LEAD_NOTIFY_TO, RESEND_API_KEY), jamais en dur.
-- Vault secret `service_role` requis pour l’appel pg_net → notify-lead.
-- Ne remplace pas 20260929180800 (déjà appliquée) : généralise via une nouvelle fonction + triggers.

create or replace function private.notify_form_submission()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, private, net, vault
as $$
declare
  secret text;
  endpoint constant text := 'https://lxkhozdshbpdjnanbnzi.supabase.co/functions/v1/notify-lead';
begin
  select ds.decrypted_secret
    into secret
    from vault.decrypted_secrets as ds
   where ds.name = 'service_role'
   limit 1;

  if secret is null or length(secret) = 0 then
    raise warning 'notify_form: vault secret service_role absent';
    return new;
  end if;

  perform net.http_post(
    url := endpoint,
    body := jsonb_build_object(
      'table', TG_TABLE_NAME,
      'record', to_jsonb(new)
    ),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || secret,
      'apikey', secret
    ),
    timeout_milliseconds := 5000
  );

  return new;
exception
  when others then
    raise warning 'notify_form: %', sqlerrm;
    return new;
end;
$$;

revoke all on function private.notify_form_submission() from public;
revoke all on function private.notify_form_submission() from anon, authenticated;

-- leads : bascule sur la nouvelle fonction (comportement when inchangé)
drop trigger if exists notify_lead_on_insert on public.leads;

create trigger notify_lead_on_insert
  after insert on public.leads
  for each row
  when (new.type_contact is not null)
  execute function private.notify_form_submission();

-- estimation + off-market : triggers manquants
drop trigger if exists notify_estimation_on_insert on public.estimation_submissions;

create trigger notify_estimation_on_insert
  after insert on public.estimation_submissions
  for each row
  execute function private.notify_form_submission();

drop trigger if exists notify_offmarket_on_insert on public.offmarket_submissions;

create trigger notify_offmarket_on_insert
  after insert on public.offmarket_submissions
  for each row
  execute function private.notify_form_submission();

-- Ancienne fonction : plus référencée par aucun trigger
drop function if exists private.notify_lead_on_insert();

-- ---------------------------------------------------------------------------
-- Étapes manuelles (Cursor / agent ne peut pas les exécuter)
-- ---------------------------------------------------------------------------
-- 1) Resend : créer le domaine send.hamacpatrimoine.com, publier MX + TXT
--    fournis par Resend dans la zone OVH, attendre l’état « Verified ».
--    L’expéditeur reste sur ce sous-domaine (ne pas toucher SPF/MX du domaine principal).
--
-- 2) Secrets Edge Function (adresses exactes : voir brief ops / réponse agent, jamais dans le code) :
--    supabase secrets set \
--      RESEND_API_KEY=*** \
--      LEAD_NOTIFY_TO="<email1>,<email2>" \
--      LEAD_NOTIFY_FROM="Hamac — site <notifications@send.hamacpatrimoine.com>" \
--      --project-ref lxkhozdshbpdjnanbnzi
--
-- 3) Vault : secret `service_role` présent (Dashboard → Database → Vault).
--    Sans lui, aucun mail ne part et rien ne le signale côté insert.
--
-- 4) Déployer la fonction puis appliquer cette migration :
--    supabase functions deploy notify-lead --project-ref lxkhozdshbpdjnanbnzi
--    supabase db push --project-ref lxkhozdshbpdjnanbnzi
--    (ou coller ce SQL dans SQL Editor)
-- ---------------------------------------------------------------------------
