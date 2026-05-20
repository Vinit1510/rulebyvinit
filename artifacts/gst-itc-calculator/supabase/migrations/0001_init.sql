-- =====================================================================
-- Rule 43 GST ITC Calculator — Supabase schema
-- Run this entire file once in: Supabase Dashboard → SQL Editor → New query
-- =====================================================================

-- ---------- Profiles (one row per auth user) -------------------------
create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  email        text,
  display_name text,
  is_admin     boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Auto-create a profile row when a new auth user signs up
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- Invoices (capital goods purchase) ------------------------
create table if not exists public.invoices (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  invoice_no      text not null default '',
  supplier        text not null default '',
  asset_name      text not null default '',
  purchase_date   date,
  taxable_value   numeric(18,2) not null default 0,
  igst_rate       numeric(6,2) not null default 0,
  cgst_rate       numeric(6,2) not null default 0,
  sgst_rate       numeric(6,2) not null default 0,
  usage           text not null default 'common' check (usage in ('taxable','exempt','common')),
  disposal        jsonb not null default '{"enabled":false}'::jsonb,
  usage_change    jsonb not null default '{"enabled":false}'::jsonb,
  credit_notes    jsonb not null default '[]'::jsonb,
  debit_notes     jsonb not null default '[]'::jsonb,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists invoices_user_id_idx on public.invoices(user_id);
create index if not exists invoices_purchase_date_idx on public.invoices(purchase_date);

-- ---------- Monthly turnover (per user) -----------------------------
create table if not exists public.turnover (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  month_key   text not null, -- format YYYY-MM
  exempt      numeric(18,2) not null default 0,
  taxable     numeric(18,2) not null default 0,
  updated_at  timestamptz not null default now(),
  unique (user_id, month_key)
);

create index if not exists turnover_user_id_idx on public.turnover(user_id);

-- ---------- Auto-update updated_at ----------------------------------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end;
$$;

drop trigger if exists invoices_touch_updated on public.invoices;
create trigger invoices_touch_updated
  before update on public.invoices
  for each row execute function public.touch_updated_at();

drop trigger if exists turnover_touch_updated on public.turnover;
create trigger turnover_touch_updated
  before update on public.turnover
  for each row execute function public.touch_updated_at();

drop trigger if exists profiles_touch_updated on public.profiles;
create trigger profiles_touch_updated
  before update on public.profiles
  for each row execute function public.touch_updated_at();

-- ---------- Row Level Security ---------------------------------------
alter table public.profiles  enable row level security;
alter table public.invoices  enable row level security;
alter table public.turnover  enable row level security;

-- Profiles: own row read/write; admin can read all
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id or exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true
  ));

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- Invoices: per-user; admin can read all
drop policy if exists "invoices_select_own" on public.invoices;
create policy "invoices_select_own" on public.invoices
  for select using (auth.uid() = user_id or exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true
  ));

drop policy if exists "invoices_insert_own" on public.invoices;
create policy "invoices_insert_own" on public.invoices
  for insert with check (auth.uid() = user_id);

drop policy if exists "invoices_update_own" on public.invoices;
create policy "invoices_update_own" on public.invoices
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "invoices_delete_own" on public.invoices;
create policy "invoices_delete_own" on public.invoices
  for delete using (auth.uid() = user_id);

-- Turnover
drop policy if exists "turnover_select_own" on public.turnover;
create policy "turnover_select_own" on public.turnover
  for select using (auth.uid() = user_id or exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true
  ));

drop policy if exists "turnover_insert_own" on public.turnover;
create policy "turnover_insert_own" on public.turnover
  for insert with check (auth.uid() = user_id);

drop policy if exists "turnover_update_own" on public.turnover;
create policy "turnover_update_own" on public.turnover
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "turnover_delete_own" on public.turnover;
create policy "turnover_delete_own" on public.turnover
  for delete using (auth.uid() = user_id);
