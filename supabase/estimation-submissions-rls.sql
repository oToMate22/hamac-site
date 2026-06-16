-- À exécuter dans Supabase → SQL Editor si l'insert échoue (erreur RLS).

alter table public.estimation_submissions enable row level security;

drop policy if exists "Allow anonymous insert on estimation_submissions" on public.estimation_submissions;

create policy "Allow anonymous insert on estimation_submissions"
  on public.estimation_submissions
  for insert
  to anon
  with check (true);
