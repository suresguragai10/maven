-- Maven Work Desk — in-app notifications (V2 Task 15)
--
-- Zero-cost, in-app only: no email/SMS/push/WhatsApp, no scheduler. Rows
-- are computed and written by the client itself at login time (see
-- generateNotifications() in staff.js), from whatever the logged-in
-- user's own work_items/work_waiting_items state is right then — there
-- is no server-side job that produces these. That's why insert is scoped
-- to "you may only insert notifications for yourself": the client is a
-- trusted-enough source for its OWN nudges (worst case it under- or
-- over-notifies itself), and this keeps the feature completely serverless.
--
-- Duplicate prevention is a real unique index, not app-side "check then
-- insert" (same reasoning as work_items_client_service_period_unique /
-- client_services_active_unique elsewhere in this schema) — dedup_key
-- already encodes what makes a notification the "same" one: a per-day
-- summary key for aggregate nudges ("3 work items are due today", one
-- per user per day regardless of how many times they log in that day),
-- or a per-work-item (plus, for follow-ups, per-follow-up-date) key for
-- specific-item nudges, so the same overdue item or the same follow-up
-- date doesn't spawn a fresh row every login.

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('due_today_summary', 'review_summary', 'overdue_item', 'followup_item')),
  title text not null,
  work_item_id uuid references public.work_items(id) on delete cascade,
  dedup_key text not null,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

-- The actual duplicate-prevention boundary — generateNotifications()
-- upserts with { onConflict: 'user_id,dedup_key', ignoreDuplicates: true },
-- which only works because this index exists.
create unique index if not exists notifications_user_dedup_unique
  on public.notifications (user_id, dedup_key);
-- Speeds up "how many unread" (the bell badge) and "list mine" (the
-- panel), both filtered/ordered by these columns on every login.
create index if not exists notifications_user_unread_idx
  on public.notifications (user_id) where is_read = false;
create index if not exists notifications_user_created_idx
  on public.notifications (user_id, created_at desc);

alter table public.notifications enable row level security;

-- A user can only ever see, create, or mark-read their OWN notifications
-- — never someone else's. No admin override: unlike work_items/clients,
-- there's no legitimate reason for one person to read or dismiss
-- another person's personal nudges.
create policy "notifications_read" on public.notifications
  for select using (user_id = auth.uid());
create policy "notifications_insert" on public.notifications
  for insert with check (user_id = auth.uid());
-- Update is only ever used to flip is_read — there's no UI path that
-- edits title/kind/etc after creation, but this isn't restricted at the
-- column level since a user editing their own notification row (of any
-- kind) is harmless; it's still scoped to their own rows only.
create policy "notifications_update" on public.notifications
  for update using (user_id = auth.uid());
