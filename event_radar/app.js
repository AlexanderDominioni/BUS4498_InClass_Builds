// Club Event Radar website (Stages 6 and 7).
// Lists published events from the database and sends new announcements to the AI agent.
// All user text is shown with textContent, never innerHTML.

(function () {
  const config = window.EVENT_RADAR_CONFIG || {};
  const AGENT_URL = config.supabaseUrl + "/functions/v1/submit-event";
  const FLYER_PREFIX = config.supabaseUrl + "/storage/v1/object/public/flyers/";
  const MAX_FLYER_BYTES = 5 * 1024 * 1024;
  const PUBLIC_COLUMNS =
    "id, created_at, status, title, club, event_date, start_time, end_time, place_name, place_detail, cost, free_food, summary, flyer_url";

  const db = window.supabase.createClient(config.supabaseUrl, config.publishableKey);

  const form = document.getElementById("post-form");
  const textarea = document.getElementById("announcement");
  const flyerInput = document.getElementById("flyer");
  const postButton = document.getElementById("post-button");
  const result = document.getElementById("result");
  const board = document.getElementById("board");
  const refreshButton = document.getElementById("refresh");
  const chips = document.querySelectorAll(".chip");

  let events = [];
  let filter = "all";

  // ---- Small helpers ----

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  // "2026-10-29" -> a local Date, without shifting the day by time zone.
  function parseDate(value) {
    const [y, m, d] = value.split("-").map(Number);
    return new Date(y, m - 1, d);
  }

  // "19:00:00" -> "7:00 PM"
  function formatTime(value) {
    if (!value) return "";
    const [h, m] = value.split(":").map(Number);
    const suffix = h >= 12 ? "PM" : "AM";
    const hour = h % 12 === 0 ? 12 : h % 12;
    return hour + ":" + String(m).padStart(2, "0") + " " + suffix;
  }

  function whenText(event) {
    const parts = [];
    if (event.event_date) {
      parts.push(parseDate(event.event_date).toLocaleDateString("en-US", {
        weekday: "short", month: "short", day: "numeric",
      }));
    } else {
      parts.push("Date to be announced");
    }
    if (event.start_time) {
      let time = formatTime(event.start_time);
      if (event.end_time) time += " to " + formatTime(event.end_time);
      parts.push(time);
    }
    return parts.join(" · ");
  }

  // ---- Event list ----

  function renderCard(event) {
    const li = el("li", "event");

    if (event.event_date) {
      const date = parseDate(event.event_date);
      const box = el("div", "date");
      box.append(
        el("span", "mon", date.toLocaleDateString("en-US", { month: "short" })),
        el("span", "day", String(date.getDate())),
      );
      li.append(box);
    } else {
      const box = el("div", "date tba");
      box.append(el("span", "day", "TBA"));
      li.append(box);
    }

    const body = el("div", "event-body");
    body.append(el("p", "when", whenText(event)));
    body.append(el("h3", null, event.title || "Club event"));

    const place = [event.place_name, event.place_detail].filter(Boolean).join(", ");
    const meta = [event.club, place].filter(Boolean).join(" · ");
    if (meta) body.append(el("p", "meta", meta));
    if (event.summary) body.append(el("p", "summary", event.summary));

    const tags = el("p", "tags");
    if (event.cost) tags.append(el("span", "tag", event.cost));
    if (event.free_food) tags.append(el("span", "tag food", "🍕 Free food"));
    if (tags.childNodes.length) body.append(tags);

    li.append(body);

    // Only show photos stored in this project's flyers bucket.
    if (event.flyer_url && event.flyer_url.startsWith(FLYER_PREFIX)) {
      const img = el("img", "flyer");
      img.src = event.flyer_url;
      img.alt = "Flyer for " + (event.title || "this event");
      img.loading = "lazy";
      li.append(img);
    }
    return li;
  }

  function renderBoard() {
    board.replaceChildren();
    const shown = filter === "food" ? events.filter((e) => e.free_food) : events;
    if (shown.length === 0) {
      board.append(el("li", "empty",
        filter === "food" ? "No free-food events right now." : "No events yet. Post the first one!"));
      return;
    }
    shown.forEach((event) => board.append(renderCard(event)));
  }

  async function loadEvents() {
    refreshButton.disabled = true;
    const { data, error } = await db
      .from("events")
      .select(PUBLIC_COLUMNS)
      .eq("status", "published")
      .order("event_date", { ascending: true, nullsFirst: false })
      .order("start_time", { ascending: true, nullsFirst: false });
    refreshButton.disabled = false;

    if (error) {
      console.error(error);
      board.replaceChildren(el("li", "empty", "The events couldn’t be loaded. Please try Refresh."));
      return;
    }
    events = data || [];
    renderBoard();
  }

  // ---- Posting form ----

  const LABELS = {
    published: "Posted!",
    waiting: "Waiting for a moderator",
    rejected: "Not posted",
    duplicate: "Already posted",
    error: "Something went wrong",
  };

  function showResult(kind, message, reasons) {
    result.className = "result " + kind;
    result.replaceChildren(el("p", "result-label", LABELS[kind] || LABELS.error));
    if (message) result.append(el("p", null, message));
    if (reasons && reasons.length) {
      const list = el("ul", "reasons");
      reasons.forEach((reason) => list.append(el("li", null, reason)));
      result.append(list);
    }
    result.hidden = false;
  }

  form.addEventListener("submit", async (submitEvent) => {
    submitEvent.preventDefault();
    const text = textarea.value.trim();
    if (!text) {
      showResult("error", "Please paste an announcement first.");
      return;
    }
    const flyer = flyerInput.files[0];
    if (flyer && !["image/jpeg", "image/png"].includes(flyer.type)) {
      showResult("error", "The photo must be a JPG or PNG file.");
      return;
    }
    if (flyer && flyer.size > MAX_FLYER_BYTES) {
      showResult("error", "The photo is larger than 5 MB. Please choose a smaller one.");
      return;
    }

    postButton.disabled = true;
    postButton.textContent = "The agent is reading your post…";

    try {
      const body = new FormData();
      body.append("announcement", text);
      if (flyer) body.append("flyer", flyer);
      const response = await fetch(AGENT_URL, {
        method: "POST",
        headers: { apikey: config.publishableKey },
        body,
      });
      const answer = await response.json();

      if (!answer.ok) {
        showResult("error", answer.message || "The agent couldn’t take this post. Please try again.");
      } else {
        showResult(answer.status, answer.message, answer.reasons);
        if (answer.status === "published" || answer.status === "waiting") form.reset();
        if (answer.status === "published") loadEvents();
      }
    } catch (err) {
      console.error(err);
      showResult("error", "The agent couldn’t be reached. Check your connection and try again.");
    } finally {
      postButton.disabled = false;
      postButton.textContent = "Send to the agent";
    }
  });

  // ---- Filters and refresh ----

  chips.forEach((chip) => {
    chip.addEventListener("click", () => {
      filter = chip.dataset.filter;
      chips.forEach((c) => c.setAttribute("aria-pressed", String(c === chip)));
      renderBoard();
    });
  });

  refreshButton.addEventListener("click", loadEvents);

  loadEvents();
})();
