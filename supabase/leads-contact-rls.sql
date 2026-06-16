-- À exécuter dans Supabase → SQL Editor si l'insert échoue en prod (erreur RLS).
-- Adapte les noms de colonnes si ta table leads diffère.

alter table public.leads
  add column if not exists bien_ref text;

alter table public.leads enable row level security;

drop policy if exists "Allow anonymous insert on leads" on public.leads;

create policy "Allow anonymous insert on leads"
  on public.leads
  for insert
  to anon
  with check (true);
