-- Stage 14: read posts from a chat group (GroupMe).
-- A scheduled job calls the read-channel function every minute. It reads the group's new
-- messages and sends each one to the AI agent. The database makes sure no chat message is
-- ever decided twice.

-- Where each post came from: empty for posts made on the website.
alter table public.events
  add column source      text not null default '',   -- 'groupme'
  add column source_id   text not null default '',   -- the chat message's id
  add column source_name text not null default '';   -- who sent it

-- One decision per chat message, enforced by the database.
create unique index events_one_per_message
  on public.events (source, source_id)
  where source_id <> '';

-- The reader's bookmark: the last message it read. Only the Edge Functions use it.
create table public.channel_cursor (
  source     text primary key,
  last_id    text not null default '',
  read_count integer not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.channel_cursor enable row level security;
revoke all on public.channel_cursor from anon, authenticated;
grant select, insert, update, delete on public.channel_cursor to service_role;

-- The scheduled job. pg_net lets the database call a web address; pg_cron runs it on a timer.
-- The publishable key is public (it is also in config.js); it is not a secret.
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

select cron.schedule(
  'read-chat-channel',
  '* * * * *',
  $$
  select net.http_post(
    url := 'https://saanqqjbohydiwfmwhiy.supabase.co/functions/v1/read-channel',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', 'sb_publishable_TO_MPtoGrGzb1cmjfQsjiw_6f9nWYCe'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 55000
  );
  $$
);
