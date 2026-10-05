-- Déclenche un email agence à chaque insert dans public.leads.
-- La clé service_role n'est PAS dans ce fichier : la stocker une fois dans Vault
--   Dashboard → Database → Vault, nom : service_role
--   (valeur = secret JWT service_role du projet)
-- Sans ce secret, l'insert réussit quand même ; l'email n'est pas envoyé.

create extension if not exists pg_net with schema extensions;

create schema if not exists private;

revoke all on schema private from public;
revoke all on schema private from anon, authenticated;

create or replace function private.notify_lead_on_insert()
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
    raise warning 'notify_lead: vault secret service_role absent';
    return new;
  end if;

  perform net.http_post(
    url := endpoint,
    body := jsonb_build_object('record', to_jsonb(new)),
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
    raise warning 'notify_lead: %', sqlerrm;
    return new;
end;
$$;

revoke all on function private.notify_lead_on_insert() from public;
revoke all on function private.notify_lead_on_insert() from anon, authenticated;

drop trigger if exists notify_lead_on_insert on public.leads;

create trigger notify_lead_on_insert
  after insert on public.leads
  for each row
  when (new.type_contact is not null)
  execute function private.notify_lead_on_insert();
