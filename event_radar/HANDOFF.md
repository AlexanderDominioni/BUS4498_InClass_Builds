# Club Event Radar: handoff notes for Aidan

## 1. What works now

**Website:** https://alexanderdominioni.github.io/BUS4498_InClass_Builds/event_radar/

- Club officers paste an announcement, plus an optional flyer photo (JPG or PNG, up to 5 MB).
- The AI agent turns it into an event card and checks it against the posting rules. The code then decides what happens to it:
  - **Published**: it goes on the website.
  - **Waiting**: it waits for a moderator, with the reasons.
  - **Not posted**: it isn't an event.
  - **Already posted**: another post has the same date, start time, and place.
- Every post with a photo waits for a moderator.
- The list shows published events, soonest first, with a **Free food** filter.
- A moderator signs in at the bottom of the page and clicks **Approve** or **Reject** on waiting posts.

## 2. Where things live

- **GitHub repository:** `AlexanderDominioni/BUS4498_InClass_Builds`. GitHub Pages serves it from `main`, `/ (root)`.
- **Supabase project:** `event-radar`. Project URL: `https://saanqqjbohydiwfmwhiy.supabase.co`
- **Files that matter** (all in `event_radar/`):
  - `index.html`, `app.js`, `style.css`: the website.
  - `config.js`: the Project URL and the publishable key. Both are public.
  - `supabase/functions/submit-event/index.ts`: the AI agent (an Edge Function). It's deployed with **Verify JWT** turned off.
  - `supabase/migrations/`: the database changes, one file per stage. These create the `events` table, the security rules, the `flyers` storage bucket, and moderator access.
  - `context/posting-rules.md` and `context/campus-places.md`: the rules and place list. They're also copied into `index.ts`, so change both together.
  - `test/sample-announcements.md`: test posts and what should happen.
  - `AGENTS.md`: instructions for Claude Code or Codex, stage by stage.

## 3. Secrets

- `ANTHROPIC_API_KEY` is the AI key the agent uses (model `claude-haiku-5-5`). It's set in Supabase → **Edge Functions** → **Secrets**.
- You don't need its value, and it should never go in any file or chat. The website only uses the publishable key, which is public.
- Optional: `HOLD_ALL_POSTS=true` in the same place makes every post wait for a moderator.
- **Moderator accounts** are in Supabase → **Authentication** → **Users**. New sign-ups are turned off. Ask Alex to add you as a moderator rather than sharing a password.

## 4. How to test

Paste these into the form on the website:

1. **Post A** from `test/sample-announcements.md` (Board Game Guild game night). It should be **published**: Thu, Oct 29, 7:00 to 10:00 PM, University Union, Room 220, Free, free food. Post it again and you should get **Already posted**.
2. **Post D** (the house party). It should be **waiting**. It's off campus, mentions alcohol, and has a Venmo handle and a phone number, and the handle and number are left off the card.
3. **Post F** (the textbook sale). It should be **Not posted**, because it isn't an event.

Then sign in as a moderator. Post D should be in the waiting list with its reasons. Click **Reject**.

## 5. What’s next

- Run every test post (A to F, the bonus post, and the flyer) on the live website and note anything unexpected.
- Optional stage: a nightly clean-up job that archives past events (see `AGENTS.md`).
- Turn on **leaked password protection** in Supabase Auth settings. Supabase's security check recommends it.
- The agent stops taking posts after 100 in one day, a spending limit. Watch it if the site gets busy.
- Ideas: let clubs edit a waiting post, add more filters (this week, online), and add more campus places.

## 6. How we take turns

- **Before you start:** in GitHub Desktop, click **Fetch origin**, then **Pull**, so you have the latest version.
- **When you stop:** commit your changes with a short message and click **Push origin**.
- **Tell each other before working**, so we don’t change the same files at the same time.
- Database or agent changes go into a new file in `supabase/` first, so the repository always matches Supabase.
