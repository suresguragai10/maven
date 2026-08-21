-- Maven Work Desk — staff profile photo upload (Supabase Storage)
--
-- Adds a public "staff-photos" bucket so staff can upload a real photo from
-- inside Work Desk instead of pasting an already-hosted URL. Uses the same
-- Supabase project already in use (free tier: 1GB storage — far more than a
-- handful of staff photos need) — no new paid service, no new provider.
--
-- Folder convention: every object is stored at "{owner_id}/filename", so a
-- self-upload is naturally scoped to the uploader's own folder by the path
-- itself. Upload is deliberately self-only, for every role including
-- admin -- nobody can upload a photo file into someone else's folder, by
-- owner's explicit instruction (an earlier version of this policy let an
-- admin write into any folder; that OR-branch is intentionally gone).
-- Editing someone else's photo_url via a pasted URL on the Staff & Access
-- page is unrelated, pre-existing, unchanged behavior -- this migration
-- only governs the storage bucket an upload button writes to.
--
-- A SELECT policy is required even though Work Desk only ever reads photos
-- via the public object endpoint (/storage/v1/object/public/...), which is
-- served without RLS: Postgres RLS also checks the SELECT policy when an
-- INSERT/UPDATE reads its own row back afterward (which the Storage API
-- itself does internally to build its response) -- without one, every
-- upload fails with "new row violates row-level security policy" even
-- though the INSERT's own WITH CHECK already passed. Confirmed live: this
-- exact gap caused every upload to fail until this policy was added.
-- Granting SELECT here exposes nothing new -- the bucket is already public,
-- so anyone can already read any object's metadata via the public URL
-- without authentication at all.

insert into storage.buckets (id, name, public)
values ('staff-photos', 'staff-photos', true)
on conflict (id) do nothing;

create policy "staff_photos_select" on storage.objects
  for select to authenticated
  using (bucket_id = 'staff-photos');

create policy "staff_photos_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'staff-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "staff_photos_update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'staff-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "staff_photos_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'staff-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
