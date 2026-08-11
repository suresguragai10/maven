-- Maven Work Desk — work item children: checklist, comments, waiting
-- checklist, activity log.

-- ---- Checklist (Preparation / Review / Submission stages) ----
create table if not exists public.work_checklist_items (
  id uuid primary key default gen_random_uuid(),
  work_item_id uuid not null references public.work_items(id) on delete cascade,
  stage text not null default 'preparation' check (stage in ('preparation', 'review', 'submission')),
  title text not null,
  is_done boolean not null default false,
  sort_order int not null default 0
);
create index if not exists work_checklist_items_work_item_id_idx
  on public.work_checklist_items (work_item_id);
alter table public.work_checklist_items enable row level security;
create policy "work_checklist_items_read" on public.work_checklist_items
  for select using (auth.role() = 'authenticated');
create policy "work_checklist_items_insert" on public.work_checklist_items
  for insert with check (auth.role() = 'authenticated');
create policy "work_checklist_items_update" on public.work_checklist_items
  for update using (auth.role() = 'authenticated');

-- ---- Comments — append-only, stay attached to the work item ----
create table if not exists public.work_comments (
  id uuid primary key default gen_random_uuid(),
  work_item_id uuid not null references public.work_items(id) on delete cascade,
  author_id uuid not null references public.profiles(id),
  body text not null,
  created_at timestamptz not null default now()
);
create index if not exists work_comments_work_item_id_idx
  on public.work_comments (work_item_id);
alter table public.work_comments enable row level security;
create policy "work_comments_read" on public.work_comments
  for select using (auth.role() = 'authenticated');
-- Append-only by omission: no update/delete policy exists, so no one can
-- edit or remove a comment once posted, only add new ones as themselves.
create policy "work_comments_insert" on public.work_comments
  for insert with check (auth.uid() = author_id);

-- ---- Waiting-for-client checklist ----
-- "Waiting for Client" is structured data, not a single text reason: each
-- specific thing being waited on (a document, a decision) is its own row,
-- independently checkable off as it arrives — so "2 of 3 documents in" is
-- visible mid-wait, not just an all-or-nothing status flip.
create table if not exists public.work_waiting_items (
  id uuid primary key default gen_random_uuid(),
  work_item_id uuid not null references public.work_items(id) on delete cascade,
  title text not null,
  is_received boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists work_waiting_items_work_item_id_idx
  on public.work_waiting_items (work_item_id);
alter table public.work_waiting_items enable row level security;
create policy "work_waiting_items_read" on public.work_waiting_items
  for select using (auth.role() = 'authenticated');
create policy "work_waiting_items_insert" on public.work_waiting_items
  for insert with check (auth.role() = 'authenticated');
create policy "work_waiting_items_update" on public.work_waiting_items
  for update using (auth.role() = 'authenticated');

-- ---- Activity log — "what changed," not everything that ever happened ----
-- Populated entirely from the app layer (logActivity() in staff.js), not
-- database triggers, so the log reads in plain English instead of a diff
-- of raw column values. Known `action` values in use today: status_changed,
-- checklist_toggled, waiting_item_toggled, waiting_resolved — left as free
-- text (no check constraint) since this is an append-only log meant to
-- grow new event types without a migration.
create table if not exists public.work_activity (
  id uuid primary key default gen_random_uuid(),
  work_item_id uuid not null references public.work_items(id) on delete cascade,
  actor_id uuid references public.profiles(id),
  action text not null,
  detail text,
  created_at timestamptz not null default now()
);
create index if not exists work_activity_work_item_id_idx
  on public.work_activity (work_item_id);
alter table public.work_activity enable row level security;
create policy "work_activity_read" on public.work_activity
  for select using (auth.role() = 'authenticated');
create policy "work_activity_insert" on public.work_activity
  for insert with check (auth.role() = 'authenticated');
