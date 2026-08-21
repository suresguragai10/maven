-- Maven Work Desk — reconcile the profiles guard trigger with reality,
-- and close a real admin self-lockout gap
--
-- The original 20260811090100_profiles.sql migration's own header already
-- flagged this table/trigger as "a faithful reconstruction of confirmed,
-- tested behavior... not a copy-paste of the original literal
-- statements." Confirmed live 2026-08-21 (see
-- docs/WORK_DESK_BASELINE_SECURITY_MAP.md §6's "open drift question"):
-- the reconstruction was wrong in a specific, checkable way. The real
-- live trigger is named trg_prevent_self_role_escalation, calling
-- prevent_self_role_escalation() -- not profiles_guard/
-- guard_profile_update() as reconstructed. guard_profile_update() was
-- confirmed to never exist live at all; it's only ever run in this local
-- test harness. Also confirmed live: profiles has created_at/updated_at
-- columns that exist in production but were never added by any migration
-- in this repo -- added here too so this harness finally matches
-- reality, not an approximation of it.
--
-- Reading the REAL live function turned up a genuine gap: if the caller
-- IS admin, there was no restriction at all on changing role or
-- is_active -- including on their own row. An admin could accidentally
-- deactivate their own account (e.g. the only admin at a small firm)
-- with no recovery path short of the Supabase Dashboard. Owner confirmed
-- 2026-08-21: close this at the database level rather than rely on the
-- UI's own `disabled = isSelf` guard on the deactivate toggle, which only
-- protects the one button in Staff & Access, not any other path to the
-- same table. This does NOT restrict an admin changing their OWN role --
-- only OWN is_active, which is what was actually flagged.

alter table public.profiles
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz;

drop trigger if exists profiles_guard on public.profiles;
drop function if exists public.guard_profile_update();

create or replace function public.prevent_self_role_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.current_user_role() <> 'admin' then
    if new.role is distinct from old.role then
      raise exception 'Only admins can change roles.';
    end if;
    if new.is_active is distinct from old.is_active then
      raise exception 'Only admins can activate or deactivate accounts.';
    end if;
  end if;

  if new.is_active is distinct from old.is_active and old.id = auth.uid() then
    raise exception 'You cannot change your own active status -- ask another admin.';
  end if;

  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_prevent_self_role_escalation on public.profiles;
create trigger trg_prevent_self_role_escalation
  before update on public.profiles
  for each row execute function public.prevent_self_role_escalation();
