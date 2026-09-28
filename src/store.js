const KEY = "ember.v1";
const SHADOW_KEY = "ember.v1.bak";
const BACKUP_KIND = "ember.backup.v1";

// The tracking day ends at 3am: logs between midnight and 3am belong to the
// previous day, so late dinners don't break streaks or split a day in half.
export const DAY_CUT_HOURS = 3;

const defaultState = () => ({
  profile: null,
  heat: 52,
  xp: 0,
  streak: 0,
  lastActiveDay: null,
  lastDecayDay: null,
  days: {},
  weighIns: [],
  history: [],
  recents: [],
  favorites: [],
  plans: {},
  meals: [],
  lastBackupAt: null,
  theme: "ember",
  createdAt: Date.now(),
});

export function load() {
  try {
    const raw = localStorage.getItem(KEY) || localStorage.getItem(SHADOW_KEY);
    if (!raw) return defaultState();
    return migrate({ ...defaultState(), ...JSON.parse(raw) });
  } catch {
    try {
      const shadow = localStorage.getItem(SHADOW_KEY);
      if (shadow) return migrate({ ...defaultState(), ...JSON.parse(shadow) });
    } catch {
      /* ignore */
    }
    return defaultState();
  }
}

export function migrate(state) {
  state.plans = state.plans || {};
  state.meals = state.meals || [];
  state.weeks = state.weeks || [];
  state.theme = ["ember", "vesper", "hud", "nebula", "aura", "sketch"].includes(state.theme) ? state.theme : "ember";
  for (const day of Object.values(state.days || {})) {
    for (const f of day.foods || []) {
      if (f.slot === "late") f.slot = "snacks";
    }
  }
  return state;
}

export function emptyPlan() {
  return { breakfast: [], lunch: [], dinner: [], snacks: [] };
}

export function getPlan(state, key = todayKey()) {
  const raw = state.plans?.[key];
  return {
    breakfast: [...(raw?.breakfast || [])],
    lunch: [...(raw?.lunch || [])],
    dinner: [...(raw?.dinner || [])],
    snacks: [...(raw?.snacks || raw?.late || [])],
  };
}

export function setPlan(state, key, plan) {
  state.plans = state.plans || {};
  state.plans[key] = plan;
}

export function addPlanItem(state, key, slot, item) {
  const plan = getPlan(state, key);
  const id = slot === "late" ? "snacks" : slot;
  plan[id] = [...(plan[id] || []), { ...item, id: item.id || crypto.randomUUID() }];
  setPlan(state, key, plan);
}

export function removePlanItem(state, key, slot, itemId) {
  const plan = getPlan(state, key);
  const id = slot === "late" ? "snacks" : slot;
  plan[id] = (plan[id] || []).filter((x) => x.id !== itemId);
  setPlan(state, key, plan);
}

export function weekAhead(n = 7) {
  const out = [];
  const now = new Date();
  for (let i = 0; i < n; i++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
    out.push({
      key: todayKey(d),
      dow: i === 0 ? "Today" : d.toLocaleDateString([], { weekday: "short" }),
      num: d.getDate(),
    });
  }
  return out;
}

export function save(state) {
  const raw = JSON.stringify(state);
  localStorage.setItem(KEY, raw);
  try {
    localStorage.setItem(SHADOW_KEY, raw);
  } catch {
    /* quota */
  }
}

export function wipeLocal() {
  localStorage.removeItem(KEY);
  localStorage.removeItem(SHADOW_KEY);
  localStorage.removeItem("ember.foodcache.v1");
}

export function saveMeal(state, meal) {
  state.meals = [meal, ...(state.meals || [])].slice(0, 12);
}

export function removeMeal(state, id) {
  state.meals = (state.meals || []).filter((m) => m.id !== id);
}

export function backupPayload(state) {
  return {
    kind: BACKUP_KIND,
    savedAt: Date.now(),
    state,
  };
}

export function parseBackup(text) {
  const data = JSON.parse(text);
  const blob = data?.kind === BACKUP_KIND && data.state ? data.state : data;
  if (!blob || typeof blob !== "object") throw new Error("not an ember save");
  if (!("heat" in blob) && !blob.profile && !blob.days) throw new Error("not an ember save");
  return migrate({ ...defaultState(), ...blob });
}

export async function requestDurableStorage() {
  try {
    if (navigator.storage?.persist) await navigator.storage.persist();
  } catch {
    /* ignore */
  }
}

export function dateKey(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function todayKey(d) {
  if (d) return dateKey(d);
  return dateKey(new Date(Date.now() - DAY_CUT_HOURS * 3600000));
}

export function yesterdayKey() {
  return dateKey(new Date(Date.now() - (DAY_CUT_HOURS + 24) * 3600000));
}

export function emptyDay() {
  return {
    foods: [],
    workouts: [],
    notes: "",
    confessed: false,
    verdictShown: false,
  };
}

export function getDay(state, key = todayKey()) {
  return state.days[key] || emptyDay();
}

export function setDay(state, key, day) {
  state.days[key] = day;
}

export function rememberFood(state, food, amount) {
  if (!food?.name) return;
  const id = food.id || food.name;
  const rec = {
    id,
    name: food.name,
    kcal: food.kcal,
    protein: food.protein,
    carbs: food.carbs || 0,
    fat: food.fat || 0,
    unit: food.unit || "100g",
    lastAmount: amount,
    at: Date.now(),
  };
  state.recents = [rec, ...(state.recents || []).filter((r) => r.id !== id)].slice(0, 16);
}

export function toggleFavorite(state, food) {
  const id = food.id || food.name;
  const list = state.favorites || [];
  if (list.some((f) => f.id === id)) {
    state.favorites = list.filter((f) => f.id !== id);
    return false;
  }
  state.favorites = [{ ...food, id }, ...list].slice(0, 20);
  return true;
}

export function isFavorite(state, id) {
  return (state.favorites || []).some((f) => f.id === id);
}
