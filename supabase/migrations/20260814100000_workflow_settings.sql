-- Maven Work Desk — Workflow Settings (V2 Task 18)
--
-- Five day-count thresholds that were previously hardcoded directly in
-- staff.js (a bare `> 2`, a bare `+ 3`, a top-level WAITING_STALE_DAYS =
-- 7 constant, a blank follow-up date input, no pre-fill on the New
-- Template modal's internal-offset field) — moved into the existing
-- app_settings key/value table, same shape as the auto_generate_period_*
-- keys already there, rather than inventing a second settings mechanism.
--
-- All five are read-time thresholds or one-time pre-fills, never a
-- value copied onto a work_items row and left there: changing one only
-- changes what a live computation flags or what a NEW form starts pre-
-- filled with, going forward. Nothing here rewrites an existing work
-- item, existing template, or existing waiting item when a setting
-- changes -- see the usage-site comments in staff.js for each one.
insert into public.app_settings (key, value) values
  ('default_internal_offset_days', '3'),
  ('waiting_followup_default_days', '2'),
  ('waiting_stale_days', '7'),
  ('review_attention_days', '2'),
  ('upcoming_deadline_warning_days', '3')
on conflict (key) do nothing;

-- app_settings previously had no insert policy (comment on the original
-- table: "the app only ever reads and updates these seeded rows"). The
-- Settings page's Save button now upserts rather than updates, so a row
-- that's somehow missing (this migration not yet run, a row deleted by
-- hand) self-heals instead of the save silently touching zero rows --
-- but upsert's insert-if-no-conflict path needs its own grant, or RLS
-- would reject exactly the case it's meant to recover from.
create policy "app_settings_insert_admin" on public.app_settings
  for insert with check (public.current_user_role() = 'admin');
