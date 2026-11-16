-- OBSOLÈTE depuis 2026-11-17 : ne plus exécuter. Ces policies d'insertion anonyme
-- ont été supprimées (migrations/20261117090000_close_direct_form_inserts.sql).
-- Les formulaires passent par l'Edge Function submit-form.

-- À exécuter dans Supabase → SQL Editor si l'insert échoue (erreur RLS).

alter table public.estimation_submissions enable row level security;

drop policy if exists "Allow anonymous insert on estimation_submissions" on public.estimation_submissions;

create policy "Allow anonymous insert on estimation_submissions"
  on public.estimation_submissions
  for insert
  to anon
  with check (true);
