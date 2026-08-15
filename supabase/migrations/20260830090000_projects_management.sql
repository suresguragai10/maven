-- Maven Work Desk — Handbook Task 19: lightweight Projects/Initiatives.
--
-- VERIFIED FIRST: the `projects` table itself (id/name/description/
-- status/created_by/created_at/updated_at), Firm Work's project_id/
-- next_action/blocker_reason columns, the projects_read/insert/update
-- RLS (open to any active teammate, no delete -- archiving is the
-- retirement path), the Firm Work list's project filter/column, and the
-- create/edit modals' project picker + inline "+ New Project" quick-
-- create all already shipped as a side effect of Task 15/17/18. The one
-- genuine schema gap against this task's own requirements: "every
-- material project edit should be attributable" -- today only the
-- ORIGINAL creator (`created_by`) is tracked; nothing records who most
-- recently renamed or archived a project. Closed here with `updated_by`,
-- auto-set from auth.uid() by a trigger -- never trusted from the client,
-- same convention as every other "who did this" column in this schema.
--
-- Everything else this task asks for (Projects management screen,
-- Project Detail counts/items, search-by-project-name) is UI-only, built
-- in staff.js, and needs no further schema change.

alter table public.projects add column if not exists updated_by uuid references public.profiles(id);
comment on column public.projects.updated_by is 'Auto-set from auth.uid() on every UPDATE by set_projects_updated_by() -- never trust a client-supplied value (Handbook Task 19). NULL on a project that has never been edited since creation.';

create or replace function public.set_projects_updated_by()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Same immutability convention as guard_work_item_update() (id/
  -- created_at/created_by never change after creation) -- a rename or
  -- archive should never be able to also silently rewrite provenance.
  new.id := old.id;
  new.created_by := old.created_by;
  new.created_at := old.created_at;
  new.updated_by := auth.uid();
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_projects_set_updated_by on public.projects;
create trigger trg_projects_set_updated_by
  before update on public.projects
  for each row execute function public.set_projects_updated_by();
