/* Local reminder engine — "Wake-ups". No server: Ash taps the glass from
   timers while RITE is running (installed app, or a living browser tab).
   Config + fired-dates live in localStorage; notifications are per-device,
   so they intentionally stay out of the JSON backup. */

const KEY = "rite-notifs";

export const SLOTS = [
  { id: "morning", label: "Morning plate", time: "09:00" },
  { id: "lunch", label: "Midday check", time: "12:30" },
  { id: "evening", label: "Evening tally", time: "20:00" },
  { id: "cutoff", label: "Cutoff warning", time: "01:00" },
];

const DEFAULTS = {
  enabled: true,
  slots: { morning: true, lunch: true, evening: false, cutoff: true },
  fired: {},
};

function load() {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || "{}") };
  } catch {
    return { ...DEFAULTS };
  }
}

function save(next) {
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {}
}

export function getConfig() {
  const s = load();
  return {
    enabled: s.enabled,
    slots: { ...DEFAULTS.slots, ...s.slots },
    fired: s.fired || {},
  };
}

export function setEnabled(on) {
  save({ ...load(), enabled: on });
}

export function setSlot(id, on) {
  const s = load();
  save({ ...s, slots: { ...DEFAULTS.slots, ...s.slots, [id]: on } });
}

export function permission() {
  return typeof Notification === "undefined" ? "unsupported" : Notification.permission;
}

export async function requestPermission() {
  if (typeof Notification === "undefined") return "unsupported";
  if (Notification.permission === "granted") return "granted";
  try {
    return await Notification.requestPermission();
  } catch {
    return "denied";
  }
}

/* Ash's line per reminder, shaped by where the day actually stands. */
function compose(id, ctx) {
  const logged = ctx.logged;
  switch (id) {
    case "morning":
      return logged
        ? "Plate's already moving. Keep the day boring."
        : "New day, empty plate. The heat is yours to stoke.";
    case "lunch":
      return logged
        ? "Fueled and rolling. Stay honest at dinner."
        : "Half the day is gone and the log is empty. Ash notices.";
    case "evening":
      return logged
        ? `Heat at ${ctx.heat}. Close strong or coast — your call.`
        : `Heat at ${ctx.heat} with nothing logged. The day is slipping.`;
    case "cutoff": {
      if (logged) return "The day banks at 3am. Last call before it settles.";
      if (ctx.streak > 0) return `${ctx.streak}d streak dies at the cutoff. Log something real.`;
      return "The cutoff burns the day down tonight. Log anything — honestly.";
    }
    default:
      return "Check the fire.";
  }
}

/* One tick: fires anything due exactly once per calendar day. */
export function tickNotifs(getContext) {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
  const cfg = getConfig();
  if (!cfg.enabled) return;
  const now = new Date();
  const dk = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
  let dirty = false;
  for (const slot of SLOTS) {
    if (!cfg.slots[slot.id]) continue;
    if (cfg.fired[slot.id] === dk) continue;
    const [h, m] = slot.time.split(":").map(Number);
    const due = new Date(now);
    due.setHours(h, m, 0, 0);
    if (now < due) continue;
    cfg.fired[slot.id] = dk;
    dirty = true;
    const body = compose(slot.id, getContext());
    if (document.hidden) {
      try {
        new Notification(`RITE — ${slot.label}`, { body, tag: `rite-${slot.id}-${dk}` });
      } catch {}
    } else {
      dispatchEvent(new CustomEvent("rite-notify", { detail: { title: slot.label, body } }));
    }
  }
  if (dirty) save({ ...cfg });
}

let tickerOn = false;
export function startTicker(getContext) {
  if (tickerOn) return;
  tickerOn = true;
  setInterval(() => tickNotifs(getContext), 30000);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) tickNotifs(getContext);
  });
  tickNotifs(getContext);
}
