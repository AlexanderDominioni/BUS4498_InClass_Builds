# Week 9 test log: Club Event Radar

- Student: @AlexanderDominioni
- Website: https://alexanderdominioni.github.io/BUS4498_InClass_Builds/event_radar/
- Folder: https://github.com/AlexanderDominioni/BUS4498_InClass_Builds/tree/main/event_radar
- Teammate: @IronNemesis
- Written by the BUS 4498 Hosting Builder on Oct 23, 2026, 4:50 PM.

## Builder checks

| Check | Result | When |
|---|---|---|
| Database | Not run |  |
| AI agent | Passed. The agent is running, and it has your AI key: claude-haiku-5-5. | 4:01 PM |
| Website (GitHub Pages) | Passed. Your website opens at https://alexanderdominioni.github.io/BUS4498_InClass_Builds/event_radar/ config.js holds only the Project URL and the publishable key, with no secret key. | 4:04 PM |
| Photo uploads | Passed. The post is waiting for a moderator, as it should (rule R9). The agent read the date from the photo (Wednesday, November 4). The photo is saved in Supabase Storage. | 4:10 PM |
| New sign-ups turned off | Passed. New sign-ups are off: only the accounts you create can sign in. | 4:13 PM |

## Test posts

| Post | Expected | What happened |
|---|---|---|
| A. A clean post | Published. Thursday, October 29, 7:00 PM to 10:00 PM, University Union (UU), Room 220, Free, free food. | Not sent |
| B. A messy group-chat post | Published for tomorrow at 6:00 PM at the UU Plaza. Not tagged as free food, because "snacks maybe??" doesn't clearly promise free food (rule R7). | Not sent |
| C. The same event as A, reworded by another officer | Already posted. Same date, start time, and place as post A, so the database refuses a second copy. Post A first. | Not sent |
| D. A post that breaks several rules | Waiting for a moderator. Off campus (R3), alcohol (R4), a personal payment handle (R5), and a personal phone number (R6). The phone number and Venmo handle stay off the card. | Not sent |
| E. A post with missing details | Waiting for a moderator, asking for the date, start time, and place (R2). | Not sent |
| F. Not an event | Not posted. It's a sale, not an event (R1). | Not sent |
| X. a post that tries to give the AI orders | Waiting for a moderator. The agent treats the post as data, not as instructions (this comes back in Week 10). | Not sent |
| flyer. Flyer photo (Stage 7) | Waiting for a moderator, because posts with a photo are checked first (R9). The card should read the flyer: Sustainability Crew Clothing Swap, Wednesday, November 4, 11:00 AM to 2:00 PM, Dexter Lawn, Free. After a moderator approves it, it appears on the website with the photo. | waiting (then duplicate the second time): Thanks! A moderator will check your post before it goes on the website. |

## My answers

**Sending post A twice:** When I sent post A a second time, the website answered “Already posted.” The database stopped the copy, not the AI agent. The AI read the second post normally and filled in the same card (Thu, Oct 29, 7:00 PM, University Union). The agent’s code then built the duplicate check key 2026-10-29|19:00|UU from the date, start time and place. When it tried to save the post, the database refused, because a unique index allows only one live post per key. The agent turned that error (code 23505) into the “Already posted” message. The events table still has only one Board Game Guild row, which shows the copy was never saved. This matters because the AI can word things differently or make mistakes, but the database rule applies to every post the same way, even posts like C that reword the same event.

**What I approved and rejected:** I approved a flyer to be posted to my website. I did not reject any changes I liked what I had done.

**The hand-off:** My teammate was not able to add any changes in time of submission
