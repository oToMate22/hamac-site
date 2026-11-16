-- Ferme l'écriture directe dans les tables des formulaires.
--
-- Depuis 20261116120000, les 4 formulaires passent par l'Edge Function
-- submit-form (Turnstile + validation + quota) qui insère en service_role.
-- Les anciennes policies INSERT pour anon / authenticated / public laissaient
-- un robot écrire directement via /rest/v1 avec la clé publique, sans Turnstile.
--
-- Après cette migration : seul service_role (submit-form, tableau de bord)
-- peut écrire. RLS reste activée, sans aucune policy pour anon/authenticated.
-- Les triggers notify_*_on_insert ne changent pas.

drop policy if exists "anon_can_insert_leads"                  on public.leads;
drop policy if exists "authenticated_can_insert_leads"         on public.leads;
drop policy if exists "Insert only"                            on public.leads;
drop policy if exists "Allow anonymous insert on leads"        on public.leads;

drop policy if exists "anon_can_insert_estimations"                        on public.estimation_submissions;
drop policy if exists "authenticated_can_insert_estimations"               on public.estimation_submissions;
drop policy if exists "Allow anonymous insert on estimation_submissions"   on public.estimation_submissions;

drop policy if exists "anon_can_insert_offmarket"                          on public.offmarket_submissions;
drop policy if exists "authenticated_can_insert_offmarket"                 on public.offmarket_submissions;
drop policy if exists "Allow anonymous insert on offmarket_submissions"    on public.offmarket_submissions;

-- Défense en profondeur : plus aucun privilège de table pour les rôles publics
-- (TRUNCATE notamment n'est pas soumis à RLS).
revoke all on public.leads                  from public, anon, authenticated;
revoke all on public.estimation_submissions from public, anon, authenticated;
revoke all on public.offmarket_submissions  from public, anon, authenticated;

alter table public.leads                  enable row level security;
alter table public.estimation_submissions enable row level security;
alter table public.offmarket_submissions  enable row level security;
