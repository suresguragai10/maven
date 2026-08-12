-- Maven Work Desk — app_settings
--
-- A minimal key/value store. Holds the three "current period" labels the
-- open-Work-Desk generation check reads (see 20260811091000_recurring_
-- work_generation.sql): auto_generate_period_monthly,
-- auto_generate_period_quarterly, auto_generate_period_yearly. Split into
-- three (2026-08-12, was a single auto_generate_period key) because
-- monthly/quarterly/yearly services advance at different rates and can't
-- share one "current period" value once generation became recurrence-
-- type-aware. Every value always comes from a person (Templates page,
-- admin-only "Auto-Generate Periods" card), never computed, since this
-- app has no Nepali BS-calendar conversion table to derive it safely. No
-- insert/delete policy is needed: the app only ever reads and updates
-- these seeded rows.

create table if not exists public.app_settings (
  key text primary key,
  value text
);

alter table public.app_settings enable row level security;

create policy "app_settings_read" on public.app_settings
  for select using (auth.role() = 'authenticated');
create policy "app_settings_update" on public.app_settings
  for update using (public.current_user_role() = 'admin');

insert into public.app_settings (key, value) values
  ('auto_generate_period_monthly', null),
  ('auto_generate_period_quarterly', null),
  ('auto_generate_period_yearly', null)
on conflict (key) do nothing;
