-- Maven Work Desk — profiles (staff accounts, roles, permissions)
--
-- NOTE ON PROVENANCE: this table predates the rest of the schema in this
-- migrations/ folder — it was stood up early in the project, before SQL
-- started being tracked in the repo, and applied directly in the Supabase
-- SQL Editor. The table/column shapes below are reproduced with confidence
-- (the frontend's exact reads/writes prove them). The RLS policies and
-- trigger below are a faithful reconstruction of confirmed, tested
-- behavior (documented at the time: anonymous access returns zero rows,
-- an employee cannot promote themselves and gets "Only admins can change
-- roles.", any authenticated user can list all profiles for
-- assignee/reviewer pickers) rather than a copy-paste of the original
-- literal statements. If this is ever run against the live project,
-- diff it against the actual policies first (Database → Policies) rather
-- than assuming an exact match.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role text not null default 'employee' check (role in ('employee', 'reviewer', 'admin')),
  is_active boolean not null default true
);

alter table public.profiles enable row level security;

-- Avoids the classic recursive-RLS-on-profiles trap: policies on other
-- tables need to check "is this caller admin/reviewer?" without every such
-- check itself re-triggering profiles' own RLS.
create or replace function public.current_user_role()
returns text
language sql
security definer
stable
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

-- Every authenticated staff member can see the full roster — needed
-- throughout the app for assignee/reviewer dropdowns, the Staff page, the
-- Manager Dashboard's per-person workload matrix, etc. Anonymous access
-- returns zero rows (no policy grants it).
create policy "profiles_read_authenticated" on public.profiles
  for select using (auth.role() = 'authenticated');

-- Only admins can change a profile (role, is_active) — the Staff page is
-- the only place this happens in the app, and it's admin-only there too.
create policy "profiles_update_admin" on public.profiles
  for update using (public.current_user_role() = 'admin');

-- Defense in depth on top of the RLS policy above: even a request that
-- somehow reached this trigger with a role change attached gets rejected
-- unless the caller is already an admin. Confirmed via direct testing that
-- an employee session cannot self-promote.
create or replace function public.guard_profile_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role <> old.role and public.current_user_role() <> 'admin' then
    raise exception 'Only admins can change roles.';
  end if;
  return new;
end;
$$;

create trigger profiles_guard
  before update on public.profiles
  for each row execute function public.guard_profile_update();

-- Every new Supabase Auth user automatically gets a profile row, defaulting
-- to the least-privileged role. Promoting someone to reviewer/admin is a
-- manual step on the Staff page afterward.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role, is_active)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email), 'employee', true);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
