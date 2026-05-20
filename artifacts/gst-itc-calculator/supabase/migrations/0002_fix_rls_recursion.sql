-- Fix infinite recursion in profiles RLS policies.
-- The previous policies referenced public.profiles inside a SELECT policy on
-- public.profiles itself, causing PostgREST to error with 42P17.
--
-- Strategy: wrap the admin lookup in a SECURITY DEFINER function so the
-- internal SELECT is performed with the function owner's privileges and
-- skips RLS evaluation, breaking the recursion. Then rewrite all
-- "admin override" policies to call this helper.

create or replace function public.is_admin(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select p.is_admin from public.profiles p where p.id = uid),
    false
  );
$$;

revoke all on function public.is_admin(uuid) from public;
grant execute on function public.is_admin(uuid) to anon, authenticated, service_role;

-- Profiles
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id or public.is_admin(auth.uid()));

-- Invoices
drop policy if exists "invoices_select_own" on public.invoices;
create policy "invoices_select_own" on public.invoices
  for select using (auth.uid() = user_id or public.is_admin(auth.uid()));

-- Turnover
drop policy if exists "turnover_select_own" on public.turnover;
create policy "turnover_select_own" on public.turnover
  for select using (auth.uid() = user_id or public.is_admin(auth.uid()));
