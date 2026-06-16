-- À exécuter dans Supabase → SQL Editor (table + RLS pour le formulaire /off-market).

create table if not exists public.offmarket_submissions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  first_name text not null,
  last_name text not null,
  email text not null,
  phone text not null,
  property_type text,
  sector text,
  budget text
);

alter table public.offmarket_submissions enable row level security;

drop policy if exists "Allow anonymous insert on offmarket_submissions" on public.offmarket_submissions;

create policy "Allow anonymous insert on offmarket_submissions"
  on public.offmarket_submissions
  for insert
  to anon
  with check (true);
