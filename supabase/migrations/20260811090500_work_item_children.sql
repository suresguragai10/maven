-- Maven Work Desk — work item children: checklist, comments, waiting
-- checklist, activity log.

-- ---- Role-audit note, 2026-08-11 (applies to every table below) ----
-- All four child tables originally used a blanket "auth.role() =
-- 'authenticated'" for read AND write. That was two separate bugs:
--   1. DATA EXPOSURE: read didn't check the parent work_items row at
--      all, so a work item hidden by work_items_read (someone else's
--      ready_for_review item, per the "Review scoped to assigned
--      reviewer" policy) was still fully readable through these child
--      tables directly -- its checklist, comments, waiting items, and
--      activity log all leaked even though the work item itself
--      correctly returned nothing. Fixed by mirroring work_items_read's
--      own visibility predicate via an EXISTS subquery.
--   2. PRIVILEGE ESCALATION: write had no ownership check at all -- any
--      authenticated employee could toggle or add checklist/waiting
--      items on a colleague's work item, not just their own, which
--      contradicts "staff manage their own work" (work_items itself
--      already enforced assignee-only for employees via
--      guard_work_item_update(); these child tables just never got the
--      same treatment). Fixed by scoping write to the work item's own
--      assignee/reviewer, or admin -- same predicate the trigger uses.
-- work_checklist_items keeps a slightly broader INSERT (any admin/
-- reviewer, not just this item's own reviewer) because the New Work
-- modal seeds a template's checklist immediately after creating a work
-- item that a reviewer/admin may have assigned to someone else entirely
-- -- that's the same "create work for anyone" trust already granted by
-- work_items_insert, not a new grant. Everyday toggling of existing
-- items (the actual "manage work" action) stays scoped to
-- assignee/this-item's-reviewer/admin like everything else.

-- ---- Checklist (Preparation / Review / Submission stages) ----
create table if not exists public.work_checklist_items (
  id uuid primary key default gen_random_uuid(),
  work_item_id uuid not null references public.work_items(id) on delete cascade,
  stage text not null default 'preparation' check (stage in ('preparation', 'review', 'submission')),
  title text not null,
  is_done boolean not null default false,
  sort_order int not null default 0,
  -- Copied from service_template_items.is_required at generation time
  -- (Work Templates task, 2026-08-13) -- a snapshot, like the title/
  -- stage/sort_order already were, not a live reference. Display-only:
  -- nothing enforces it against a status change.
  is_required boolean not null default true
);
create index if not exists work_checklist_items_work_item_id_idx
  on public.work_checklist_items (work_item_id);
alter table public.work_checklist_items enable row level security;
create policy "work_checklist_items_read" on public.work_checklist_items
  for select using (
    exists (
      select 1 from public.work_items w
      where w.id = work_item_id
        and (
          public.current_user_role() = 'admin'
          or w.assignee_id = auth.uid()
          or w.reviewer_id = auth.uid()
          or w.status <> 'ready_for_review'
        )
    )
  );
-- Named "_write" not "_insert" to match the live policy name (this table
-- predates SQL being tracked in this repo -- see the provenance note in
-- 20260811090100_profiles.sql for the same caveat).
create policy "work_checklist_items_write" on public.work_checklist_items
  for insert with check (
    public.current_user_role() in ('admin', 'reviewer')
    or exists (select 1 from public.work_items w where w.id = work_item_id and w.assignee_id = auth.uid())
  );
create policy "work_checklist_items_update" on public.work_checklist_items
  for update using (
    exists (
      select 1 from public.work_items w
      where w.id = work_item_id
        and (
          public.current_user_role() = 'admin'
          or w.assignee_id = auth.uid()
          or w.reviewer_id = auth.uid()
        )
    )
  );

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
  for select using (
    exists (
      select 1 from public.work_items w
      where w.id = work_item_id
        and (
          public.current_user_role() = 'admin'
          or w.assignee_id = auth.uid()
          or w.reviewer_id = auth.uid()
          or w.status <> 'ready_for_review'
        )
    )
  );
-- Append-only by omission: no update/delete policy exists, so no one can
-- edit or remove a comment once posted, only add new ones as themselves.
-- Posting stays open to anyone who can see the work item (same visibility
-- predicate as read) -- commenting was never restricted to assignee/
-- reviewer in the UI, and there's no reason to tighten it beyond "you
-- can't comment on a work item you can't see."
create policy "work_comments_insert" on public.work_comments
  for insert with check (
    auth.uid() = author_id
    and exists (
      select 1 from public.work_items w
      where w.id = work_item_id
        and (
          public.current_user_role() = 'admin'
          or w.assignee_id = auth.uid()
          or w.reviewer_id = auth.uid()
          or w.status <> 'ready_for_review'
        )
    )
  );

-- ---- Waiting-for-client checklist ----
-- "Waiting for Client" is structured data, not a single text reason: each
-- specific thing being waited on (a document, a decision) is its own row,
-- independently checkable off as it arrives — so "2 of 3 documents in" is
-- visible mid-wait, not just an all-or-nothing status flip.
--
-- Per-item tracking fields added 2026-08-12 (V2 Task 3): requested_date/
-- requested_by capture who asked for THIS specific item and when, rather
-- than only a single work-item-level "requested" pair that couldn't tell
-- items apart. follow_up_date/last_followed_up_at/follow_up_count/note
-- support a real per-item follow-up history (see openFollowUpModal in
-- staff.js) instead of one shared follow-up date for the whole wait.
-- work_items.waiting_since/follow_up_date/waiting_requested_by are left
-- as-is (still set from whatever was entered for the whole batch at the
-- moment status flips to waiting_for_client) — a quick summary, not
-- replaced by these more granular per-item fields.
create table if not exists public.work_waiting_items (
  id uuid primary key default gen_random_uuid(),
  work_item_id uuid not null references public.work_items(id) on delete cascade,
  title text not null,
  is_received boolean not null default false,
  sort_order int not null default 0,
  requested_date date not null default current_date,
  requested_by uuid references public.profiles(id),
  follow_up_date date,
  last_followed_up_at timestamptz,
  follow_up_count int not null default 0,
  note text,
  created_at timestamptz not null default now()
);
create index if not exists work_waiting_items_work_item_id_idx
  on public.work_waiting_items (work_item_id);
alter table public.work_waiting_items enable row level security;
create policy "work_waiting_items_read" on public.work_waiting_items
  for select using (
    exists (
      select 1 from public.work_items w
      where w.id = work_item_id
        and (
          public.current_user_role() = 'admin'
          or w.assignee_id = auth.uid()
          or w.reviewer_id = auth.uid()
          or w.status <> 'ready_for_review'
        )
    )
  );
create policy "work_waiting_items_insert" on public.work_waiting_items
  for insert with check (
    exists (
      select 1 from public.work_items w
      where w.id = work_item_id
        and (
          public.current_user_role() = 'admin'
          or w.assignee_id = auth.uid()
          or w.reviewer_id = auth.uid()
        )
    )
  );
create policy "work_waiting_items_update" on public.work_waiting_items
  for update using (
    exists (
      select 1 from public.work_items w
      where w.id = work_item_id
        and (
          public.current_user_role() = 'admin'
          or w.assignee_id = auth.uid()
          or w.reviewer_id = auth.uid()
        )
    )
  );

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
  for select using (
    exists (
      select 1 from public.work_items w
      where w.id = work_item_id
        and (
          public.current_user_role() = 'admin'
          or w.assignee_id = auth.uid()
          or w.reviewer_id = auth.uid()
          or w.status <> 'ready_for_review'
        )
    )
  );
create policy "work_activity_insert" on public.work_activity
  for insert with check (
    exists (
      select 1 from public.work_items w
      where w.id = work_item_id
        and (
          public.current_user_role() = 'admin'
          or w.assignee_id = auth.uid()
          or w.reviewer_id = auth.uid()
        )
    )
  );
