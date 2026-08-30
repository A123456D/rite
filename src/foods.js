import { FOODS, POPULAR_IDS } from "./pantry.js";

export { FOODS };

function popularFoods() {
  const byId = new Map(FOODS.map((f) => [f.id, f]));
  const picks = POPULAR_IDS.map((id) => byId.get(id)).filter(Boolean);
  return picks.length ? picks : FOODS.slice(0, 12);
}

const CACHE_KEY = "ember.foodcache.v1";
const CACHE_MS = 1000 * 60 * 60 * 24 * 14;

function cacheRead(q) {
  try {
    const all = JSON.parse(localStorage.getItem(CACHE_KEY) || "{}");
    const hit = all[q];
    if (hit && Date.now() - hit.t < CACHE_MS) return hit.foods;
  } catch {
    /* ignore */
  }
  return null;
}

function cacheWrite(q, foods) {
  try {
    const all = JSON.parse(localStorage.getItem(CACHE_KEY) || "{}");
    all[q] = { t: Date.now(), foods };
    const keys = Object.keys(all);
    if (keys.length > 80) {
      keys
        .sort((a, b) => all[a].t - all[b].t)
        .slice(0, keys.length - 80)
        .forEach((k) => delete all[k]);
    }
    localStorage.setItem(CACHE_KEY, JSON.stringify(all));
  } catch {
    /* ignore */
  }
}

export function parseFoodQuery(raw) {
  const t = String(raw || "").trim();
  let name = t;
  let grams = null;
  const gramHit = t.match(/(?:^|\s)(\d+(?:\.\d+)?)\s*(?:g|grams?)\b/i);
  const ozHit = t.match(/(?:^|\s)(\d+(?:\.\d+)?)\s*oz\b/i);
  if (gramHit) {
    grams = Number(gramHit[1]);
    name = t.replace(gramHit[0], " ").replace(/\s+/g, " ").trim();
  } else if (ozHit) {
    grams = Math.round(Number(ozHit[1]) * 28.35);
    name = t.replace(ozHit[0], " ").replace(/\s+/g, " ").trim();
  }
  return { name: name || t, grams, raw: t };
}

function blobOf(f) {
  return `${f.name} ${(f.aliases || []).join(" ")}`.toLowerCase();
}

function scoreFood(f, words) {
  const name = f.name.toLowerCase();
  const blob = blobOf(f);
  let s = 0;
  for (const w of words) {
    if (name === w) s += 8;
    else if (name.startsWith(w)) s += 5;
    else if (name.includes(w)) s += 3;
    else if (blob.includes(w)) s += 1;
    else return -1;
  }
  return s;
}

export function searchLocal(q) {
  const parsed = parseFoodQuery(q);
  const s = parsed.name.toLowerCase().trim();
  if (!s) return popularFoods();
  const words = s.split(/\s+/).filter((w) => w.length > 1 || /\d/.test(w));
  if (!words.length) return popularFoods();
  return FOODS.map((f) => ({ f, s: scoreFood(f, words) }))
    .filter((x) => x.s >= 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, 40)
    .map((x) => x.f);
}

function nutrient(food, ids, names) {
  const list = food.foodNutrients || [];
  const hit = list.find((n) => {
    const id = n.nutrientId || n.nutrientNumber || n.nutrient?.id;
    const label = (n.nutrientName || n.nutrient?.name || "").toLowerCase();
    return ids.includes(Number(id)) || names.some((nm) => label.includes(nm));
  });
  return Number(hit?.value ?? hit?.amount ?? 0);
}

export async function searchUsda(q) {
  const parsed = parseFoodQuery(q);
  const term = parsed.name.trim();
  if (term.length < 2) return [];
  const key = import.meta.env.VITE_USDA_FDC_KEY || "DEMO_KEY";
  const url =
    `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${encodeURIComponent(key)}` +
    `&query=${encodeURIComponent(term)}&pageSize=15&dataType=Foundation,SR Legacy,Survey (FNDDS)`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("usda failed");
  const data = await res.json();
  return (data.foods || [])
    .map((p) => {
      const kcal = nutrient(p, [1008, 208], ["energy"]);
      if (!kcal || !p.description) return null;
      return {
        id: "usda-" + p.fdcId,
        name: p.description,
        kcal,
        protein: nutrient(p, [1003], ["protein"]),
        carbs: nutrient(p, [1005], ["carbohydrate"]),
        fat: nutrient(p, [1004], ["total lipid", "fat"]),
        unit: "100g",
        source: "USDA",
      };
    })
    .filter(Boolean);
}

export async function searchOpenFoods(q) {
  const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(q)}&search_simple=1&action=process&json=1&page_size=12`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("lookup failed");
  const data = await res.json();
  return (data.products || [])
    .map((p) => {
      const n = p.nutriments || {};
      const kcal = n["energy-kcal_100g"] || n["energy-kcal"] || 0;
      if (!kcal || !p.product_name) return null;
      return {
        id: "off-" + (p.code || p.product_name),
        name: p.product_name,
        kcal: Number(kcal),
        protein: Number(n.proteins_100g || 0),
        carbs: Number(n.carbohydrates_100g || 0),
        fat: Number(n.fat_100g || 0),
        unit: "100g",
        source: "OFF",
      };
    })
    .filter(Boolean);
}

export async function searchAnywhere(q) {
  const parsed = parseFoodQuery(q);
  const local = searchLocal(q);
  const key = parsed.name.toLowerCase();
  const seen = new Set(local.map((f) => f.id));
  const extra = [];
  const add = (list) => {
    for (const f of list) {
      if (seen.has(f.id)) continue;
      seen.add(f.id);
      extra.push(f);
    }
  };
  const cached = key.length >= 2 ? cacheRead(key) : null;
  if (cached) add(cached);
  else if (parsed.name.trim().length >= 2) {
    const remote = [];
    await Promise.all([
      searchUsda(q)
        .then((r) => remote.push(...r))
        .catch(() => {}),
      searchOpenFoods(parsed.name)
        .then((r) => remote.push(...r))
        .catch(() => {}),
    ]);
    add(remote);
    if (remote.length) cacheWrite(key, remote);
  }
  return { foods: [...local, ...extra], grams: parsed.grams, name: parsed.name };
}

export function scaleFood(food, amount) {
  const base = food.unit === "serving" ? 1 : 100;
  const mul = amount / base;
  const round = (n) => Math.round(n * 10) / 10;
  return {
    name: food.name,
    amount,
    unit: food.unit === "serving" ? "serving" : "g",
    kcal: Math.round(food.kcal * mul),
    protein: round(food.protein * mul),
    carbs: round((food.carbs || 0) * mul),
    fat: round((food.fat || 0) * mul),
    foodId: food.id,
  };
}
