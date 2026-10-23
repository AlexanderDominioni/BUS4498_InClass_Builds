-- Stage 7: photo uploads.
-- Each post can have a flyer photo. Only the Edge Function uploads photos;
-- the website has no storage policies, so it can only view them by their public link.

alter table public.events
  add column flyer_url text not null default '';

grant select (flyer_url) on public.events to anon, authenticated;

-- A public storage bucket for flyer photos: 5 MB, JPG and PNG only.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('flyers', 'flyers', true, 5242880, array['image/jpeg', 'image/png']);
