-- Maven Work Desk — app_settings
--
-- A minimal key/value store. Today it holds exactly one key,
-- 'auto_generate_period' — the period label (e.g. "Shrawan 2083") the
-- daily generation sweep uses. The value always comes from a person
-- (Templates page, admin-only "Auto-Generate Period" field), never
-- computed, since this app has no Nepali BS-calendar conversion table to
-- derive it safely. No insert/delete policy is needed: the app only ever
-- reads and updates this one seeded row.

create table if not exists public.app_settings (
  key text primary key,
  value text
);

alter table public.app_settings enable row level security;

create policy "app_settings_read" on public.app_settings
  for select using (auth.role() = 'authenticated');
create policy "app_settings_update" on public.app_settings
  for update using (public.current_user_role() = 'admin');

insert into public.app_settings (key, value)
values ('auto_generate_period', null)
on conflict (key) do nothing;
