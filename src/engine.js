export const RANKS = [
  { min: 0, name: "Cinder", title: "Barely a rumor" },
  { min: 80, name: "Spark", title: "Occasional honesty" },
  { min: 220, name: "Kindling", title: "Shows up, sometimes" },
  { min: 480, name: "Flame", title: "Actually dangerous" },
  { min: 900, name: "Blaze", title: "People notice" },
  { min: 1600, name: "Inferno", title: "Uncomfortable to watch" },
  { min: 2800, name: "Solar", title: "You became the standard" },
  { min: 4500, name: "Eternal", title: "The fire does not go out" },
];

export function rankFor(xp) {
  let current = RANKS[0];
  for (const r of RANKS) if (xp >= r.min) current = r;
  const next = RANKS[RANKS.indexOf(current) + 1] || null;
  const floor = current.min;
  const ceil = next ? next.min : floor + 1;
  const progress = next ? (xp - floor) / (ceil - floor) : 1;
  return { ...current, next: next?.name || null, progress };
}

export function mifflin({ sex, kg, cm, age, activity }) {
  const bmr = sex === "male" ? 10 * kg + 6.25 * cm - 5 * age + 5 : 10 * kg + 6.25 * cm - 5 * age - 161;
  const multipliers = {
    desk: 1.2,
    light: 1.375,
    trained: 1.55,
    feral: 1.725,
  };
  return Math.round(bmr * (multipliers[activity] || 1.375));
}

export function targets(profile) {
  const tdee = mifflin(profile);
  const cuts = { cut: 0.8, recomp: 0.92, bulk: 1.1 };
  const kcal = Math.round(tdee * (cuts[profile.goal] || 0.92));
  const protein = Math.round(profile.kg * (profile.goal === "cut" ? 2.0 : 1.8));
  return { tdee, kcal, protein, fat: Math.round((kcal * 0.28) / 9), carbs: Math.round((kcal - protein * 4 - (kcal * 0.28)) / 4) };
}

export function currentKg(state) {
  if (state.weighIns?.length) return state.weighIns[0].kg;
  return state.profile?.kg;
}

export function scoringProfile(state) {
  if (!state.profile) return null;
  return { ...state.profile, kg: currentKg(state) };
}

export function logWeighIn(state, kg) {
  const n = Math.round(Number(kg) * 10) / 10;
  if (!(n >= 30 && n <= 300)) return { ok: false };
  const prev = currentKg(state);
  state.weighIns.unshift({
    id: crypto.randomUUID(),
    day: todayKeyNow(),
    kg: n,
    at: Date.now(),
  });
  state.weighIns = state.weighIns.slice(0, 120);
  state.profile.kg = n;
  return {
    ok: true,
    prev,
    kg: n,
    delta: Math.round((n - prev) * 10) / 10,
    t: targets(scoringProfile(state)),
  };
}

export function heatCalendar(state, n = 21) {
  const map = new Map((state.history || []).map((h) => [h.day, h]));
  const days = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    days.push({
      key,
      entry: map.get(key) || null,
      isToday: i === 0,
    });
  }
  return days;
}

export function weightPath(weighIns, w = 320, h = 72) {
  const pts = [...(weighIns || [])].slice(0, 12).reverse();
  if (pts.length < 2) return { d: "", pts: [] };
  const ys = pts.map((p) => p.kg);
  const min = Math.min(...ys) - 0.4;
  const max = Math.max(...ys) + 0.4;
  const span = Math.max(0.6, max - min);
  const mapped = pts.map((p, i) => {
    const x = (i / (pts.length - 1)) * (w - 8) + 4;
    const y = h - 8 - ((p.kg - min) / span) * (h - 16);
    return { x, y, ...p };
  });
  return { d: mapped.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" "), pts: mapped };
}

export function dayTotals(day) {
  return day.foods.reduce(
    (acc, f) => {
      acc.kcal += f.kcal;
      acc.protein += f.protein;
      acc.carbs += f.carbs || 0;
      acc.fat += f.fat || 0;
      return acc;
    },
    { kcal: 0, protein: 0, carbs: 0, fat: 0 }
  );
}

export function calorieScore(eaten, target) {
  if (target <= 0) return 0;
  const ratio = eaten / target;
  if (ratio < 0.45) return -0.7;
  if (ratio < 0.7) return -0.25;
  if (ratio <= 1.08) return 1;
  if (ratio <= 1.18) return 0.2;
  if (ratio <= 1.35) return -0.85;
  return -1.2;
}

export function applyDecay(state) {
  const today = todayKeyNow();
  if (!state.lastActiveDay) {
    state.lastDecayDay = today;
    return { decayed: 0 };
  }
  if (state.lastDecayDay === today) return { decayed: 0 };
  const missed = daysBetween(state.lastDecayDay || state.lastActiveDay, today);
  let decayed = 0;
  for (let i = 0; i < missed; i++) {
    const drop = state.heat > 30 ? 9 : 5;
    state.heat = clamp(state.heat - drop, 0, 100);
    decayed += drop;
    state.streak = 0;
  }
  state.lastDecayDay = today;
  return { decayed };
}

function todayKeyNow() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function daysBetween(from, to) {
  const a = new Date(from + "T12:00:00");
  const b = new Date(to + "T12:00:00");
  return Math.max(0, Math.round((b - a) / 86400000) - 1);
}

export function settleDay(state, day, profile) {
  const t = targets(profile);
  const tot = dayTotals(day);
  const trained = day.workouts.some((w) => w.kind !== "rest");
  const cal = calorieScore(tot.kcal, t.kcal);
  const proteinHit = tot.protein >= t.protein * 0.9;
  const proteinRatio = t.protein ? tot.protein / t.protein : 0;

  let delta = 0;
  delta += cal * 10;
  if (proteinHit) delta += 6;
  else if (proteinRatio < 0.6) delta -= 5;
  if (trained) delta += 11;
  else if (profile.goal !== "recomp") delta -= 4;
  if (day.confessed && cal < 0) delta += 3;
  if (tot.kcal === 0 && !trained) delta = -12;

  const prev = state.heat;
  state.heat = clamp(Math.round(state.heat + delta), 0, 100);
  const xpGain = Math.max(0, Math.round(8 + delta * 1.4 + (trained ? 6 : 0)));
  state.xp += xpGain;

  const today = todayKeyNow();
  if (state.lastActiveDay) {
    const gap = daysBetween(state.lastActiveDay, today);
    state.streak = gap === 0 ? state.streak + 1 : 1;
  } else {
    state.streak = 1;
  }
  state.lastActiveDay = today;
  state.lastDecayDay = today;

  const result = {
    delta: state.heat - prev,
    xpGain,
    cal,
    proteinHit,
    trained,
    tot,
    t,
    over: tot.kcal - t.kcal,
    underProtein: t.protein - tot.protein,
  };
  state.history.unshift({ day: today, heat: state.heat, ...result, at: Date.now() });
  state.history = state.history.slice(0, 60);
  return result;
}

export function liveDelta(day, profile, heat) {
  const t = targets(profile);
  const tot = dayTotals(day);
  const trained = day.workouts.some((w) => w.kind !== "rest");
  let preview = 0;
  preview += calorieScore(tot.kcal, t.kcal) * 10;
  if (tot.protein >= t.protein * 0.9) preview += 6;
  else if (t.protein && tot.protein / t.protein < 0.6) preview -= 5;
  if (trained) preview += 11;
  if (tot.kcal === 0) preview = trained ? 11 : 0;
  return {
    preview: Math.round(preview),
    nextHeat: clamp(Math.round(heat + preview), 0, 100),
    tot,
    t,
    trained,
    ratio: t.kcal ? tot.kcal / t.kcal : 0,
  };
}

function clamp(n, a, b) {
  return Math.min(b, Math.max(a, n));
}

export function clampHeat(n) {
  return clamp(Math.round(n), 0, 100);
}

function todayKeyNowExport() {
  return todayKeyNow();
}
export { todayKeyNowExport as engineToday };
