// Maven Work Desk — create-staff-account
//
// Lets a Work Desk admin invite a new staff sign-in from inside the app,
// without ever putting the Supabase service-role key in browser code. This
// function runs server-side (a Supabase Edge Function), holds the
// service-role key only as a platform-injected environment variable, and
// is the ONLY place in this project allowed to call the Auth Admin API.
// Work Desk itself still never asks for or stores that key.
//
// Deploy (Supabase Dashboard, no CLI needed):
//   Edge Functions -> Deploy a new function -> name it exactly
//   "create-staff-account" -> paste this whole file -> Deploy.
// Nothing to configure by hand: SUPABASE_URL and
// SUPABASE_SERVICE_ROLE_KEY are already available to every Edge Function
// automatically. Leave "Verify JWT" ON (the default) — Work Desk callers
// are always signed in, and this function does its own admin check below
// on top of that anyway (same defense-in-depth pattern as every other
// admin-only action in this app).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const authHeader = req.headers.get('Authorization') || '';
  const jwt = authHeader.replace(/^Bearer\s+/i, '');
  if (!jwt) return json({ error: 'Missing Authorization header.' }, 401);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  // Who is actually calling? Verify the JWT itself server-side rather than
  // trusting anything the request body claims.
  const { data: callerData, error: callerErr } = await admin.auth.getUser(jwt);
  if (callerErr || !callerData?.user) return json({ error: 'Invalid or expired session.' }, 401);

  // Same "admin + active" check every other admin-only action in this app
  // enforces at the database layer — reproduced here since this function
  // runs with the service role and bypasses RLS entirely.
  const { data: callerProfile, error: profileErr } = await admin
    .from('profiles')
    .select('role, is_active')
    .eq('id', callerData.user.id)
    .single();
  if (profileErr || !callerProfile || callerProfile.role !== 'admin' || !callerProfile.is_active) {
    return json({ error: 'Only an active admin can create staff accounts.' }, 403);
  }

  let payload: { email?: string; full_name?: string; designation?: string | null; role?: string };
  try {
    payload = await req.json();
  } catch {
    return json({ error: 'Invalid request body.' }, 400);
  }

  const email = (payload.email || '').trim();
  const fullName = (payload.full_name || '').trim();
  const designation = (payload.designation || '').trim() || null;
  const role = ['employee', 'reviewer', 'admin'].includes(payload.role || '') ? (payload.role as string) : 'employee';

  if (!email || !fullName) return json({ error: 'email and full_name are required.' }, 400);

  // Sends a real Supabase sign-in invite by email — the new hire clicks the
  // link and sets their own password. No password is ever generated,
  // typed, or stored by Work Desk or this function.
  const { data: invited, error: inviteErr } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { full_name: fullName },
  });
  if (inviteErr || !invited?.user) return json({ error: inviteErr?.message || 'Could not send invite.' }, 400);

  // handle_new_user() (see 20260811090100_profiles.sql) already created a
  // default 'employee' profile row via the trigger on auth.users — fill in
  // the designation/role the admin actually chose.
  const { error: updateErr } = await admin
    .from('profiles')
    .update({ designation, role })
    .eq('id', invited.user.id);
  if (updateErr) {
    return json({ ok: true, user_id: invited.user.id, warning: 'Invite sent, but could not set designation/role: ' + updateErr.message });
  }

  return json({ ok: true, user_id: invited.user.id });
});
