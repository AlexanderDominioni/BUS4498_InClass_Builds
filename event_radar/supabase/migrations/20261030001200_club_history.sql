-- Stage 12: the club's earlier posts (memory of what happened).
-- An update to a club's earlier post retires that post as "replaced", so the website
-- never shows two cards for one event.

alter table public.events drop constraint events_status_check;
alter table public.events add constraint events_status_check
  check (status in ('published', 'waiting', 'rejected', 'archived', 'replaced'));

alter table public.events
  add column replaced_by uuid,   -- on a replaced post: the post that replaced it
  add column updates_id  uuid;   -- on a waiting update: the post it retires once a moderator approves it

-- Moderators may now also mark a post "replaced" (when they approve an update).
drop policy "Moderators can review posts" on public.events;

create policy "Moderators can review posts"
  on public.events
  for update
  to authenticated
  using (true)
  with check (status in ('published', 'waiting', 'rejected', 'replaced'));
