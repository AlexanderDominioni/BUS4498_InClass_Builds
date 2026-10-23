-- Stage 8: moderator sign-in.
-- A signed-in moderator may see every post and approve or reject it.
-- This is safe only because new sign-ups are turned off, so the only signed-in
-- users are moderator accounts made in Authentication → Users.

create policy "Moderators can read every post"
  on public.events
  for select
  to authenticated
  using (true);

create policy "Moderators can review posts"
  on public.events
  for update
  to authenticated
  using (true)
  with check (status in ('published', 'waiting', 'rejected'));

-- Moderators may read the whole table, but change only the review columns.
grant select on public.events to authenticated;
grant update (status, status_reason, reviewed_at, reviewed_by) on public.events to authenticated;
