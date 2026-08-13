-- Maven Work Desk — Client Attention Flag (V2 Task 17)
--
-- A purely human-controlled signal: an admin/manager (reviewer) marks a
-- client Normal / Needs Attention / High Attention, with a short reason
-- required whenever it's not Normal. Deliberately NOT computed from
-- overdue counts, waiting-too-long items, or anything else automatic --
-- the task's own instruction is "do not automatically calculate a client
-- risk score... keep this human-controlled." Only the current state is
-- tracked (who set it, when), not a full history log — same level of
-- simplicity as every other "who/when" pair already on this table's
-- sibling tables (e.g. work_items.submitted_by/submitted_at).

alter table public.clients add column if not exists attention_level text not null default 'normal'
  check (attention_level in ('normal', 'needs_attention', 'high_attention'));
alter table public.clients add column if not exists attention_reason text;
alter table public.clients add column if not exists attention_set_by uuid references public.profiles(id);
alter table public.clients add column if not exists attention_set_at timestamptz;

-- No new RLS needed for read: clients_read_authenticated (see
-- 20260811090200_clients.sql) already exposes every column, including
-- these, to any authenticated staff member -- "Staff can see the flag"
-- is satisfied by the existing row-level policy, RLS has no column
-- granularity to add here.
--
-- Write is intentionally NOT a table-level RLS policy: clients_update_
-- admin is admin-only (an intentionally strict boundary for full client
-- edits — PAN/VAT, contact info, active/inactive), and this task wants
-- the flag specifically changeable by admin OR manager (reviewer), a
-- broader group. Rather than loosen clients_update_admin (which would
-- let reviewers edit every client field, not just the flag), this is a
-- narrow SECURITY DEFINER function that only ever touches the four
-- attention_* columns -- same "narrower privilege than the table's own
-- RLS" pattern already used for get_client_credentials/
-- generate_period_work_for_period elsewhere in this schema.
create or replace function public.set_client_attention(p_client_id uuid, p_level text, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.current_user_role() not in ('admin', 'reviewer') then
    raise exception 'Not authorized.';
  end if;
  if p_level not in ('normal', 'needs_attention', 'high_attention') then
    raise exception 'Invalid attention level.';
  end if;
  if p_level <> 'normal' and (p_reason is null or trim(p_reason) = '') then
    raise exception 'A short reason is required when flagging a client.';
  end if;
  update public.clients set
    attention_level = p_level,
    attention_reason = case when p_level = 'normal' then null else trim(p_reason) end,
    attention_set_by = auth.uid(),
    attention_set_at = now()
  where id = p_client_id;
end;
$$;
revoke execute on function public.set_client_attention(uuid, text, text) from public, anon;
grant execute on function public.set_client_attention(uuid, text, text) to authenticated;
