-- Maven Work Desk — personal_todos
--
-- A private per-user scratchpad, not tied to any client or work item.
-- Ownership-based RLS (auth.uid() = user_id) is sufficient here — unlike
-- client_credentials, nothing sensitive enough to need SECURITY DEFINER
-- gating or encryption lives in this table, and "only the owner can see
-- their own rows" is exactly what plain RLS is built for. Even admins
-- cannot see another user's list.

create table if not exists public.personal_todos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  text text not null,
  is_done boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists personal_todos_user_id_idx
  on public.personal_todos (user_id);

alter table public.personal_todos enable row level security;

create policy "personal_todos_select_own" on public.personal_todos
  for select using (auth.uid() = user_id);
create policy "personal_todos_insert_own" on public.personal_todos
  for insert with check (auth.uid() = user_id);
create policy "personal_todos_update_own" on public.personal_todos
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "personal_todos_delete_own" on public.personal_todos
  for delete using (auth.uid() = user_id);
