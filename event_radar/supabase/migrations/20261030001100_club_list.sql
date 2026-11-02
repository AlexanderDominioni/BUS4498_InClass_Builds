-- Stage 11: the club list (knowledge).
-- The agent reads the active clubs on every post. Moderators keep the list current in the
-- Table Editor, and the agent sees a change on the very next post, with nothing redeployed.

create table public.clubs (
  id                 uuid primary key default gen_random_uuid(),
  created_at         timestamptz not null default now(),
  name               text not null unique check (char_length(name) between 1 and 100),
  nicknames          text not null default '',   -- comma-separated
  usual_place_code   text not null default '',   -- a hint for the moderator only
  usual_place_detail text not null default '',
  active             boolean not null default true,
  note               text not null default ''
);

-- Security rules: visitors may see the active clubs' names, nothing more.
alter table public.clubs enable row level security;

create policy "Anyone can read active clubs"
  on public.clubs
  for select
  to anon, authenticated
  using (active);

-- Some projects hand every new table to visitors by default, so start from nothing.
revoke all on public.clubs from anon, authenticated;
grant select (id, name, nicknames, active) on public.clubs to anon, authenticated;
grant select, insert, update, delete on public.clubs to service_role;

-- The six made-up clubs the class starts with (see context/clubs.md).
insert into public.clubs (name, nicknames, usual_place_code, usual_place_detail) values
  ('Board Game Guild',              'BGG, board game club',                          'UU',          'Room 220'),
  ('Mustang Pitch Society',         'pitch society, MPS',                            'UU-PLAZA',    ''),
  ('Women in Finance Circle',       'WIFC, women in finance',                        'BUSINESS',    ''),
  ('Sustainability Crew',           'sustainability club, sus crew',                 'DEXTER-LAWN', ''),
  ('Accounting Society',            'accounting club',                               'BUSINESS',    'Room 212'),
  ('Cal Poly Ski & Snowboard Club', 'ski club, ski and snowboard club, snowboard club', 'REC-CENTER', '')
on conflict (name) do nothing;

-- What the agent looked at, saved with every post. Moderators already read the whole table (Stage 8).
alter table public.events
  add column agent_notes text[] not null default '{}';

-- The moderator's "Clear the board" tool deletes posts.
create policy "Moderators can delete posts"
  on public.events
  for delete
  to authenticated
  using (true);

grant delete on public.events to authenticated;
