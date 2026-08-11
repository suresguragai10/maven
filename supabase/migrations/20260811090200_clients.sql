-- Maven Work Desk — clients
--
-- Same provenance note as profiles: this table predates SQL being tracked
-- in the repo. Columns are reproduced from the frontend's exact field set
-- (New Client / Edit Client forms, client cards, Client Detail header).

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  business_type text,
  pan_vat text,
  contact_person text,
  phone text,
  email text,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.clients enable row level security;

-- Every authenticated staff member reads the client list — it's needed for
-- the New Work modal's client picker even though the Clients admin *screen*
-- itself is gated to admins in the UI. RLS is the security boundary here;
-- the UI gate is just where the page happens to live in the nav.
create policy "clients_read_authenticated" on public.clients
  for select using (auth.role() = 'authenticated');

create policy "clients_insert_admin" on public.clients
  for insert with check (public.current_user_role() = 'admin');

create policy "clients_update_admin" on public.clients
  for update using (public.current_user_role() = 'admin');
