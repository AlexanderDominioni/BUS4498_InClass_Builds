// read-channel: the GroupMe chat-channel reader (Stage 14).
// A scheduled job calls this every minute (and GroupMe's bot callback can call it right away).
// It reads the group's new messages since its bookmark, sends each one to the AI agent with the
// sender's earlier messages from the last 10 minutes, and posts the agent's decision back to the
// group. The tokens live in Supabase Secrets; they never appear in any file or answer.

import { createClient } from "npm:@supabase/supabase-js@2.117.2";

const SOURCE = "groupme";
const GROUPME_API = "https://api.groupme.com/v3";
const MAX_MESSAGES = 20;          // per run
const THREAD_MINUTES = 10;        // how far back the sender's earlier messages go
const MAX_THREAD = 4;             // earlier messages sent with each post
const MAX_CHARS = 2000;           // the agent's limit
const TIME_BUDGET_MS = 40_000;    // stop starting new messages after this, so runs don't overlap

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "apikey, authorization, content-type, x-client-info",
};

type GroupMeMessage = {
  id: string;
  created_at: number;
  name: string;
  sender_id: string;
  sender_type: string;
  system: boolean;
  text: string | null;
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

function secretKey(): string {
  const keys = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (keys) {
    try {
      const parsed = JSON.parse(keys);
      if (parsed?.default) return parsed.default;
    } catch {
      // Fall through to the older key.
    }
  }
  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
}

// The agent is public, so the reader calls it with the publishable key, never the secret key.
function publishableKey(): string {
  const keys = Deno.env.get("SUPABASE_PUBLISHABLE_KEYS");
  if (keys) {
    try {
      const parsed = JSON.parse(keys);
      if (parsed?.default) return parsed.default;
    } catch {
      // Fall through to the older key.
    }
  }
  return Deno.env.get("SUPABASE_ANON_KEY") ?? "";
}

function settings() {
  return {
    token: Deno.env.get("GROUPME_TOKEN") ?? "",
    groupId: Deno.env.get("GROUPME_GROUP_ID") ?? "",
    botId: Deno.env.get("GROUPME_BOT_ID") ?? "",
  };
}

// GroupMe message ids are large whole numbers stored as text.
function byOldest(a: GroupMeMessage, b: GroupMeMessage): number {
  if (a.created_at !== b.created_at) return a.created_at - b.created_at;
  const x = BigInt(a.id), y = BigInt(b.id);
  return x < y ? -1 : x > y ? 1 : 0;
}

function isPerson(m: GroupMeMessage): boolean {
  return m.sender_type !== "bot" && m.sender_type !== "system" && !m.system && !!m.text?.trim();
}

// GET /groups/{id}/messages. 304 means there's nothing to return.
async function fetchMessages(token: string, groupId: string, query: string): Promise<GroupMeMessage[]> {
  const res = await fetch(`${GROUPME_API}/groups/${encodeURIComponent(groupId)}/messages?${query}`, {
    headers: { "X-Access-Token": token },
  });
  if (res.status === 304) return [];
  if (!res.ok) throw new Error(`GroupMe answered ${res.status} when reading messages.`);
  const body = await res.json();
  return body?.response?.messages ?? [];
}

// The same sender's messages from the 10 minutes before this one, oldest first, at most 4.
async function threadFor(token: string, groupId: string, message: GroupMeMessage): Promise<string[]> {
  try {
    const before = await fetchMessages(token, groupId, `before_id=${encodeURIComponent(message.id)}&limit=20`);
    const since = message.created_at - THREAD_MINUTES * 60;
    return before
      .filter((m) => m.sender_id === message.sender_id && m.created_at >= since && isPerson(m))
      .sort(byOldest)
      .slice(-MAX_THREAD)
      .map((m) => m.text!.trim());
  } catch (err) {
    console.error(err);
    return [];
  }
}

// "2026-11-03", "19:00:00" -> "Tue, Nov 3 at 7:00 PM"
function plainWhen(date: string | null, time: string | null): string {
  const parts: string[] = [];
  if (date) {
    parts.push(new Date(date + "T12:00:00Z").toLocaleDateString("en-US", {
      timeZone: "UTC", weekday: "short", month: "short", day: "numeric",
    }));
  }
  if (time) {
    const [h, m] = time.split(":").map(Number);
    parts.push(`${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`);
  }
  return parts.join(" at ");
}

// The agent's decision in one short chat message.
function replyText(answer: any): string {
  if (!answer?.ok) return `Event Radar couldn't read that message: ${answer?.message ?? "unknown problem"}`;
  const ev = answer.event ?? {};
  const when = plainWhen(ev.event_date ?? null, ev.start_time ?? null);
  const what = [ev.title ? `“${ev.title}”` : "", when, ev.place_name ?? ""].filter(Boolean).join(", ");
  const reasons = (answer.reasons ?? []).join(" ");
  let text: string;
  switch (answer.status) {
    case "published":
      text = `✅ Posted: ${what}. ${answer.message ?? ""}`;
      break;
    case "waiting":
      text = `⏳ Waiting for a moderator: ${what}. ${reasons}`;
      break;
    case "duplicate":
      text = `🔁 Already posted: ${what}.`;
      break;
    default:
      text = `❌ Not posted. ${reasons}`;
  }
  return text.replace(/\s+/g, " ").trim().slice(0, 990); // GroupMe allows 1000 characters
}

async function postToGroup(botId: string, text: string): Promise<void> {
  if (!botId) return;
  const res = await fetch(`${GROUPME_API}/bots/post`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ bot_id: botId, text }),
  });
  if (!res.ok) console.error(`GroupMe answered ${res.status} when the bot posted.`);
}

async function readCursor(supabase: any): Promise<{ last_id: string; read_count: number } | null> {
  const { data, error } = await supabase
    .from("channel_cursor")
    .select("last_id, read_count")
    .eq("source", SOURCE)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function saveCursor(supabase: any, lastId: string, readCount: number): Promise<void> {
  const { error } = await supabase
    .from("channel_cursor")
    .upsert({ source: SOURCE, last_id: lastId, read_count: readCount, updated_at: new Date().toISOString() });
  if (error) throw error;
}

// GET ?check=groupme: ask GroupMe whether the token, the group, and the bot work. Results only, never values.
// The answer also carries the plain GET status, which the builder's check reads.
async function checkGroupMe(status: Record<string, unknown>): Promise<Response> {
  const { token, groupId, botId } = settings();
  const result: Record<string, unknown> = {
    ...status,
    token_saved: !!token,
    group_saved: !!groupId,
    bot_saved: !!botId,
    token_works: false,
    group_found: false,
    bot_in_group: false,
  };
  if (token) {
    const me = await fetch(`${GROUPME_API}/users/me`, { headers: { "X-Access-Token": token } });
    result.token_works = me.ok;
    if (me.ok && groupId) {
      const group = await fetch(`${GROUPME_API}/groups/${encodeURIComponent(groupId)}`, { headers: { "X-Access-Token": token } });
      result.group_found = group.ok;
    }
    if (me.ok && botId) {
      const bots = await fetch(`${GROUPME_API}/bots`, { headers: { "X-Access-Token": token } });
      if (bots.ok) {
        const list = (await bots.json())?.response ?? [];
        result.bot_in_group = list.some((b: any) => b.bot_id === botId && String(b.group_id) === groupId);
      }
    }
  }
  const problems: string[] = [];
  if (!result.token_saved) problems.push("GROUPME_TOKEN isn't saved in Secrets.");
  else if (!result.token_works) problems.push("GroupMe didn't accept GROUPME_TOKEN.");
  if (!result.group_saved) problems.push("GROUPME_GROUP_ID isn't saved in Secrets.");
  else if (result.token_works && !result.group_found) problems.push("GroupMe couldn't find the group in GROUPME_GROUP_ID with this token.");
  if (!result.bot_saved) problems.push("GROUPME_BOT_ID isn't saved, so decisions won't be posted back to the group.");
  else if (result.token_works && !result.bot_in_group) problems.push("The bot in GROUPME_BOT_ID isn't in this group.");
  result.message = problems.length ? problems.join(" ") : "GroupMe works: the token, the group, and the bot are all set.";
  return json(result);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });

  const supabase = createClient(Deno.env.get("SUPABASE_URL") ?? "", secretKey(), {
    auth: { persistSession: false },
  });
  const { token, groupId, botId } = settings();

  if (req.method === "GET") {
    const check = new URL(req.url).searchParams.get("check");
    if (check && check !== "groupme") {
      return json({ ok: false, message: "This reader is for GroupMe. Use ?check=groupme." }, 400);
    }
    let status: Record<string, unknown>;
    try {
      const cursor = await readCursor(supabase);
      status = {
        ok: true,
        ready: !!token && !!groupId,
        last_message_id: cursor?.last_id ?? "",
        read_count: cursor?.read_count ?? 0,
        bot: !!botId,
      };
    } catch (err) {
      console.error(err);
      return json({ ok: false, message: "The database couldn't be reached." }, 500);
    }
    return check ? await checkGroupMe(status) : json(status);
  }
  if (req.method !== "POST") return json({ ok: false, message: "Use POST to read new messages." }, 405);
  if (!token || !groupId) {
    return json({ ok: false, message: "Save GROUPME_TOKEN and GROUPME_GROUP_ID in Supabase → Edge Functions → Secrets." }, 500);
  }

  const started = Date.now();
  try {
    const cursor = await readCursor(supabase);

    // First run: bookmark the newest message and stop. Old history is never read.
    if (!cursor?.last_id) {
      const newest = await fetchMessages(token, groupId, "limit=1");
      const lastId = newest[0]?.id ?? "";
      await saveCursor(supabase, lastId, cursor?.read_count ?? 0);
      return json({ ok: true, first_run: true, read: 0, last_message_id: lastId });
    }

    const messages = (await fetchMessages(token, groupId, `after_id=${encodeURIComponent(cursor.last_id)}&limit=${MAX_MESSAGES}`))
      .sort(byOldest);
    let lastId = cursor.last_id;
    let readCount = cursor.read_count;
    let sent = 0, skipped = 0, held = 0;

    for (const message of messages) {
      if (Date.now() - started > TIME_BUDGET_MS) break; // the next run picks up the rest

      if (!isPerson(message)) {
        skipped++;
      } else {
        const thread = await threadFor(token, groupId, message);
        const res = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/submit-event`, {
          method: "POST",
          headers: { "Content-Type": "application/json", apikey: publishableKey() },
          body: JSON.stringify({
            announcement: message.text!.trim().slice(0, MAX_CHARS),
            source: SOURCE,
            source_id: message.id,
            source_name: message.name ?? "",
            thread,
          }),
        });
        const answer = await res.json().catch(() => ({ ok: false, message: `The agent answered ${res.status}.` }));

        // The AI or the database is down for a moment, or today's limit is reached: stop without
        // moving the bookmark, so the next run tries this message again.
        if (res.status >= 500 || res.status === 429) {
          console.error(`The agent answered ${res.status}: ${answer?.message ?? ""}`);
          held++;
          break;
        }
        if (!answer?.already_read) await postToGroup(botId, replyText(answer));
        sent++;
      }

      // Move the bookmark past every message read, including skipped ones.
      lastId = message.id;
      readCount++;
      await saveCursor(supabase, lastId, readCount);
    }

    return json({ ok: true, read: sent + skipped, sent, skipped, held, last_message_id: lastId });
  } catch (err) {
    console.error(err);
    return json({ ok: false, message: "The reader couldn't finish. Check the function logs." }, 500);
  }
});
