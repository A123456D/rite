import "./style.css";
import {
  load,
  save,
  todayKey,
  yesterdayKey,
  getDay,
  setDay,
  rememberFood,
  toggleFavorite,
  isFavorite,
  getPlan,
  addPlanItem,
  removePlanItem,
  weekAhead,
  backupPayload,
  parseBackup,
  wipeLocal,
  requestDurableStorage,
} from "./store.js";
import {
  targets,
  rankFor,
  applyDecay,
  liveDelta,
  settleDay,
  scoringProfile,
  currentKg,
  logWeighIn,
  heatCalendar,
  weightPath,
  clampHeat,
  RANKS,
} from "./engine.js";
import { lineForLive, verdictCopy, heatCaption, morningFrom } from "./coach.js";
import { searchLocal, scaleFood, searchAnywhere, FOODS } from "./foods.js";
import { SLOTS, defaultSlot, slotName, normalizeSlot, clockTime } from "./meals.js";
import { createFlame } from "./flame.js";
import { rankMark } from "./ranks.js";
import { APP_NAME, applyTheme } from "./themes.js";
import { registerPwa, canInstall, promptInstall, isStandalone } from "./pwa.js";

if (import.meta.env.PROD) registerPwa();

const root = document.getElementById("app");
let state = load();
let tab = "arena";
let flame = null;
let foodQuery = "";
let foodHits = searchLocal("");
let selectedFood = null;
let amount = 100;
let pendingGrams = null;
let mealSlot = defaultSlot();
let fuelMode = "log";
let planDay = todayKey();
let workoutKind = "lift";
let workoutMins = 45;
let workoutNote = "";
let saveMsg = "";

applyTheme();
applyDecay(state);
if (state.profile && (!state.weighIns || !state.weighIns.length)) {
  state.weighIns = [{ id: "seed", day: todayKey(), kg: state.profile.kg, at: Date.now() }];
}
save(state);
requestDurableStorage();

function profile() {
  return scoringProfile(state);
}

function prettyDay(key) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function snapshot() {
  const day = today();
  const live = liveDelta(day, profile(), state.heat);
  const locked = Boolean(day.verdictShown && state.history[0]?.day === todayKey());
  const heat = locked ? state.heat : clampHeat(state.heat + live.preview);
  return { day, live, locked, heat };
}

function ashFor(snap) {
  const { day, live, locked } = snap;
  if (locked && state.history[0]) {
    const h = state.history[0];
    return {
      tone: h.delta >= 4 ? "hype" : h.delta <= -4 ? "roast" : "mixed",
      who: "Ash · Locked",
      text: h.line || verdictCopy(h).body,
    };
  }
  const started = day.foods.length || day.workouts.length;
  if (!started) {
    const y = state.history.find((h) => h.day === yesterdayKey());
    const morning = morningFrom(y);
    if (morning) return morning;
  }
  const liveLine = lineForLive({
    ...live,
    heat: snap.heat,
    streak: state.streak,
    goal: state.profile?.goal,
    hour: new Date().getHours(),
  });
  return { ...liveLine, who: liveLine.who || "Ash · Head of Honesty" };
}

function flameMark(uid, kind) {
  const id = `f${String(uid).replace(/\W/g, "")}`;
  const body =
    kind === "ghost" ? `url(#${id}coal)` : kind === "down" ? `url(#${id}ash)` : `url(#${id}hot)`;
  return `<svg class="flame-ico" viewBox="0 0 48 64" aria-hidden="true">
    <defs>
      <radialGradient id="${id}hot" cx="46%" cy="38%" r="62%">
        <stop offset="0%" stop-color="var(--hot)"/>
        <stop offset="28%" stop-color="#ffb34a"/>
        <stop offset="62%" stop-color="var(--ember)"/>
        <stop offset="100%" stop-color="var(--ember-2)"/>
      </radialGradient>
      <radialGradient id="${id}coal" cx="50%" cy="48%" r="58%">
        <stop offset="0%" stop-color="#3a2a22"/>
        <stop offset="100%" stop-color="#16100c"/>
      </radialGradient>
      <radialGradient id="${id}ash" cx="50%" cy="42%" r="58%">
        <stop offset="0%" stop-color="#6a3220"/>
        <stop offset="100%" stop-color="#2a1410"/>
      </radialGradient>
    </defs>
    <ellipse class="blaze" cx="24" cy="42" rx="15" ry="16"/>
    <path class="body" fill="${body}" d="M24 3c1.2 10 13.5 15 13.5 31 0 11.5-6 21-13.5 25C16.5 55 10.5 45.5 10.5 34 10.5 18 22.8 13 24 3z"/>
    <path class="core" d="M24 22c.7 5.5 5.4 7.2 5.4 14.2 0 5.4-2.5 10-5.4 12.2-2.9-2.2-5.4-6.8-5.4-12.2 0-7 4.7-8.7 5.4-14.2z"/>
    <path class="shine" d="M19.5 26c1.4 7 1.8 12 1.2 20"/>
  </svg>`;
}

function heatStrip(liveHeat) {
  const days = heatCalendar(state, 21);
  const cells = days
    .map((d) => {
      const known = d.isToday || d.entry;
      const heat = d.isToday ? liveHeat : d.entry?.heat ?? 0;
      const cls = d.isToday ? "today" : d.entry ? (d.entry.delta >= 0 ? "up" : "down") : "ghost";
      const fill = known ? Math.max(0.28, heat / 100) : 0.12;
      return `<span class="ember-day ${cls}" style="--g:${fill}" title="${d.key}">${flameMark(d.key, cls)}</span>`;
    })
    .join("");
  return `
    <div class="glass heat-cal">
      <header><span>21-day heat</span></header>
      <div class="ember-grid">${cells}</div>
    </div>
  `;
}

function segs(heat) {
  const n = 5;
  const step = 100 / n;
  return Array.from({ length: n }, (_, i) => {
    const fill = Math.max(0, Math.min(1, (heat - i * step) / step));
    return `<i style="--f:${fill}"></i>`;
  }).join("");
}

function gauge(pct, title, big, sub, glow) {
  const r = 46;
  const c = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(1.08, pct));
  const dash = p * c;
  const id = "g" + title.replace(/\W/g, "");
  const show = p > 0.02;
  return `
    <div class="gauge ${glow ? "lit" : ""}">
      <svg viewBox="0 0 120 120">
        <defs>
          <linearGradient id="${id}grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="${title === "Protein" ? "var(--gauge-p-from)" : "var(--gauge-from)"}"/>
            <stop offset="100%" stop-color="${title === "Protein" ? "var(--gauge-p-to)" : "var(--gauge-to)"}"/>
          </linearGradient>
          ${
            show
              ? `<filter id="${id}glow" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="3.5" result="b"/>
            <feMerge>
              <feMergeNode in="b"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>`
              : ""
          }
        </defs>
        <circle class="g-track" cx="60" cy="60" r="${r}"/>
        <circle class="g-rim" cx="60" cy="60" r="${r + 4}"/>
        ${
          show
            ? `<circle class="g-bloom" cx="60" cy="60" r="${r}" stroke="url(#${id}grad)"
          stroke-dasharray="${dash.toFixed(2)} ${c.toFixed(2)}"
          transform="rotate(-90 60 60)" filter="url(#${id}glow)"/>
        <circle class="g-arc" cx="60" cy="60" r="${r}" stroke="url(#${id}grad)"
          stroke-dasharray="${dash.toFixed(2)} ${c.toFixed(2)}"
          transform="rotate(-90 60 60)"/>`
            : ""
        }
      </svg>
      <div class="g-copy">
        <small>${title}</small>
        <b>${big}</b>
        <em>${sub}</em>
      </div>
    </div>
  `;
}

function weighCopy(delta, goal) {
  if (delta === 0) return "Same number. Either consistency or the scale is as dramatic as you are.";
  if (goal === "cut") {
    if (delta < 0) return "Down. That's the assignment. Don't throw a parade and eat it.";
    return "Up on a cut. Water, salt, or the truth. Pick one and log dinner honestly.";
  }
  if (goal === "bulk") {
    if (delta > 0) return "Up. Growth if the plate was clean. Bloat if it wasn't.";
    return "Down while bulking. Either a cut sneak-in or you forgot to eat like you meant it.";
  }
  if (delta < 0) return "Lighter. Recomp doesn't require a speech. Keep the protein boring.";
  return "Heavier. Muscle if you trained. Noise if you didn't.";
}

function el(html) {
  const t = document.createElement("template");
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function persist() {
  save(state);
}

function today() {
  const d = getDay(state);
  if (!state.days[todayKey()]) {
    setDay(state, todayKey(), d);
  }
  return getDay(state);
}

function addFood(item, template, usedAmount) {
  const d = today();
  item.id = item.id || crypto.randomUUID();
  item.slot = normalizeSlot(item.slot || mealSlot);
  item.loggedAt = item.loggedAt || Date.now();
  d.foods.push(item);
  setDay(state, todayKey(), d);
  if (template) rememberFood(state, template, usedAmount);
  persist();
}

function commitFood(item, template, usedAmount) {
  if (fuelMode === "plan") {
    addPlanItem(state, planDay, mealSlot, item);
    if (template) rememberFood(state, template, usedAmount);
    persist();
    return;
  }
  addFood(item, template, usedAmount);
}

function render() {
  applyTheme();
  if (flame) {
    flame.destroy();
    flame = null;
  }
  root.innerHTML = "";
  if (!state.profile) {
    root.append(onboard());
    return;
  }
  const stage = el(`<div class="stage"></div>`);
  stage.append(chrome());
  if (tab === "arena") stage.append(arena());
  if (tab === "fuel") stage.append(fuel());
  if (tab === "train") stage.append(train());
  if (tab === "verdict") stage.append(verdict());
  if (tab === "self") stage.append(self());
  stage.append(nav());
  root.append(stage);

  const canvas = stage.querySelector(".burst canvas");
  if (canvas) {
    const snap = snapshot();
    flame = createFlame(canvas);
    flame.setHeat(snap.heat);
  }
}

function chrome() {
  const r = rankFor(state.xp);
  const h = el(`
    <header class="brand">
      <button type="button" class="wordmark" data-go="arena">${APP_NAME}</button>
      <button type="button" class="self-link" data-go="self">${rankMark(r.name, 18)} ${escapeHtml(r.name)} · ${state.streak}d streak</button>
    </header>
  `);
  h.querySelectorAll("button").forEach((b) => {
    b.onclick = () => {
      tab = b.dataset.go;
      render();
    };
  });
  return h;
}

function nav() {
  const tabs = [
    ["arena", "Arena"],
    ["fuel", "Fuel"],
    ["train", "Train"],
    ["verdict", "Verdict"],
    ["self", "Self"],
  ];
  const n = el(`
    <nav class="nav">
      ${tabs
        .map(
          ([id, label]) =>
            `<button type="button" data-tab="${id}" class="${tab === id ? "active" : ""}">${label}</button>`
        )
        .join("")}
    </nav>
  `);
  n.querySelectorAll("button").forEach((b) => {
    b.onclick = () => {
      tab = b.dataset.tab;
      render();
    };
  });
  return n;
}

function meterClass(value, target, invertOver = true) {
  if (target <= 0) return "";
  if (invertOver && value > target * 1.12) return "over";
  if (value >= target * 0.85) return "good";
  return "";
}

function arena() {
  const snap = snapshot();
  const { live, heat, locked } = snap;
  const coach = ashFor(snap);
  const r = rankFor(state.xp);
  const t = live.t;
  const tot = live.tot;
  const box = el(`
    <section class="screen">
      <div class="glass heat-card">
        <div class="heat-stage">
          <div class="burst">
            <canvas></canvas>
          </div>
          <div class="heat-num"><b>${heat}</b><span>HEAT</span></div>
        </div>
        <p class="heat-cap">${escapeHtml(heatCaption(heat))}</p>
        <div class="seg-bar">${segs(heat)}</div>
      </div>
      <div class="coach ${coach.tone}">
        <div class="who">${escapeHtml(coach.who)}</div>
        <p>${escapeHtml(coach.text)}</p>
      </div>
      <div class="rank-line">
        <span class="rank-name">Rank · ${rankMark(r.name, 28)} <b>${escapeHtml(r.name)}</b></span>
        <span>${locked ? "Locked" : "Live"} swing · <b class="${live.preview >= 0 ? "up" : "down"}">${live.preview >= 0 ? "+" : ""}${live.preview}</b></span>
      </div>
      <div class="tiny rank-sub">${escapeHtml(r.title)}${r.next ? ` · next ${escapeHtml(r.next)}` : ""}</div>
      <div class="rank-track fat"><i style="width:${Math.round(r.progress * 100)}%"></i></div>
      <div class="glass log-card">
        <header>Daily log</header>
        <div class="gauges">
          ${gauge(t.kcal ? tot.kcal / t.kcal : 0, "Energy", `${t.kcal} kcal`, `${Math.round(tot.kcal)} / ${t.kcal}`, tot.kcal > 0)}
          ${gauge(t.protein ? tot.protein / t.protein : 0, "Protein", `${t.protein} g`, `${Math.round(tot.protein)} / ${t.protein}`, tot.protein > 0)}
        </div>
        <div class="mini-rings">
          <div class="ring-row">
            <header><span>Carbs</span><strong>${Math.round(tot.carbs)} / ${t.carbs} g</strong></header>
            <div class="meter ${meterClass(tot.carbs, t.carbs)}"><i style="width:${Math.min(140, (tot.carbs / Math.max(t.carbs, 1)) * 100)}%"></i></div>
          </div>
          <div class="ring-row">
            <header><span>Fat</span><strong>${Math.round(tot.fat)} / ${t.fat} g</strong></header>
            <div class="meter ${meterClass(tot.fat, t.fat)}"><i style="width:${Math.min(140, (tot.fat / Math.max(t.fat, 1)) * 100)}%"></i></div>
          </div>
        </div>
        <div class="train-row">
          <span>Training · <b>${live.trained ? "Stoked" : "Silent"}</b></span>
          <div class="meter ${live.trained ? "good" : ""}"><i style="width:${live.trained ? 100 : 6}%"></i></div>
        </div>
        ${timeLogHtml(snap.day.foods)}
      </div>
      ${heatStrip(heat)}
    </section>
  `);
  return box;
}

function timeLogHtml(foods) {
  const rows = [...(foods || [])].sort((a, b) => (a.loggedAt || 0) - (b.loggedAt || 0));
  if (!rows.length) {
    return `<p class="tiny time-empty">No timed entries yet. Log in Fuel with a slot.</p>`;
  }
  return `<div class="time-log">${rows
    .map(
      (f) =>
        `<div class="time-row"><span>${clockTime(f.loggedAt) || "—"}</span><b>${escapeHtml(slotName(f.slot))}</b><em>${escapeHtml(f.name)}</em><strong>${f.kcal}</strong></div>`
    )
    .join("")}</div>`;
}

function foodButton(f, extra = "") {
  const row = el(`
    <button type="button" class="row">
      <div>
        <strong>${escapeHtml(f.name)}</strong>
        <div class="meta">${Math.round(f.kcal)} kcal / ${f.unit === "serving" ? "serving" : "100g"}${extra}</div>
      </div>
    </button>
  `);
  row.onclick = () => {
    selectedFood = f;
    amount =
      f.unit === "serving"
        ? f.lastAmount || 1
        : pendingGrams || f.lastAmount || 100;
    render();
  };
  return row;
}

function fuel() {
  const snap = snapshot();
  const day = snap.day;
  const live = snap.live;
  const recents = state.recents || [];
  const favs = state.favorites || [];
  const box = el(`
    <section class="screen">
      <div class="glass pad fuel-hero">
        <header class="kicker">Fuel</header>
        <div class="panel-num">${Math.round(live.tot.kcal)}<span> / ${live.t.kcal} kcal</span></div>
        <p class="heat-cap">${
          fuelMode === "plan"
            ? `Planning ${slotName(mealSlot)} · does not move Heat until you eat it.`
            : `Live heat ${snap.heat}. Logging ${slotName(mealSlot)}.`
        }</p>
        <div class="meter fat"><i style="width:${Math.min(100, (live.tot.kcal / Math.max(live.t.kcal, 1)) * 100)}%"></i></div>
        <div class="chips" id="modes"></div>
        <div class="chips" id="slots"></div>
        <div class="week-strip ${fuelMode === "plan" ? "" : "hidden"}" id="week"></div>
      </div>
      <div class="glass pad">
        <header class="kicker">Pantry · ${FOODS.length} on device</header>
        <p class="tiny">Type a food. Local hits first, then USDA + packaged barcodes. Results cache for two weeks.</p>
        <div class="search">
          <input id="q" placeholder="200g penne, chicken thigh, carbonara…" value="${escapeHtml(foodQuery)}" />
        </div>
        <p class="tiny" id="lookup-status"></p>
        <div id="scaler" class="${selectedFood ? "" : "hidden"}"></div>
        <div id="usual"></div>
        <div class="list" id="hits"></div>
      </div>
      <div class="glass pad custom-offer">
        <header class="kicker">Custom offering</header>
        <p class="lede">If it isn't in the pantry, log it. Guessing low is how Heat lies.</p>
        <div class="field"><label>Name</label><input id="cname" placeholder="Late-night whatever" /></div>
        <div class="macro-grid">
          <div class="field"><label>Kcal</label><input id="ckcal" type="number" value="250" /></div>
          <div class="field"><label>Protein</label><input id="cpro" type="number" value="10" /></div>
          <div class="field"><label>Carbs</label><input id="ccarb" type="number" value="20" /></div>
          <div class="field"><label>Fat</label><input id="cfat" type="number" value="8" /></div>
        </div>
        <button class="btn ghost" type="button" id="cadd">${fuelMode === "plan" ? "Add custom to plan" : "Log custom"}</button>
      </div>
      <div class="glass pad">
        <header class="kicker" id="diary-kicker">${fuelMode === "plan" ? "Meal plan" : "Today's plate"}</header>
        <div class="list" id="plate"></div>
      </div>
    </section>
  `);

  const modes = box.querySelector("#modes");
  [
    ["log", "Log"],
    ["plan", "Plan"],
  ].forEach(([id, label]) => {
    const b = el(`<button class="${fuelMode === id ? "on" : ""}">${label}</button>`);
    b.onclick = () => {
      fuelMode = id;
      if (id === "plan" && !planDay) planDay = todayKey();
      render();
    };
    modes.append(b);
  });

  const slots = box.querySelector("#slots");
  SLOTS.forEach((s) => {
    const b = el(`<button class="${mealSlot === s.id ? "on" : ""}">${s.name}</button>`);
    b.onclick = () => {
      mealSlot = s.id;
      render();
    };
    slots.append(b);
  });

  const week = box.querySelector("#week");
  weekAhead(7).forEach((d) => {
    const b = el(`<button class="week-day ${planDay === d.key ? "on" : ""}"><span>${d.dow}</span><b>${d.num}</b></button>`);
    b.onclick = () => {
      planDay = d.key;
      fuelMode = "plan";
      render();
    };
    week.append(b);
  });

  const usual = box.querySelector("#usual");
  if (favs.length) {
    usual.append(el(`<p class="tiny" style="margin:8px 0">Pinned</p>`));
    const list = el(`<div class="list"></div>`);
    favs.forEach((f) => list.append(foodButton(f, " · pinned")));
    usual.append(list);
  }
  if (recents.length) {
    usual.append(el(`<p class="tiny" style="margin:12px 0 8px">Usual suspects</p>`));
    const list = el(`<div class="list"></div>`);
    recents.slice(0, 8).forEach((f) => list.append(foodButton(f, " · again")));
    usual.append(list);
  }

  const hits = box.querySelector("#hits");
  const plate = box.querySelector("#plate");
  const scaler = box.querySelector("#scaler");
  const q = box.querySelector("#q");
  const status = box.querySelector("#lookup-status");

  function drawHits() {
    hits.innerHTML = "";
    foodHits.forEach((f) => hits.append(foodButton(f)));
  }

  function drawScaler() {
    if (!selectedFood) {
      scaler.classList.add("hidden");
      scaler.innerHTML = "";
      return;
    }
    scaler.classList.remove("hidden");
    const byServing = selectedFood.unit === "serving";
    const presets = byServing ? [0.5, 1, 1.5, 2, 3] : [50, 100, 150, 200, 250, 300];
    const unit = byServing ? "servings" : "grams";
    const preview = scaleFood(selectedFood, amount);
    const pinned = isFavorite(state, selectedFood.id || selectedFood.name);
    const chips = presets
      .map(
        (n) =>
          `<button type="button" class="amt ${n === amount ? "on" : ""}" data-n="${n}">${byServing ? n : n + "g"}</button>`
      )
      .join("");
    scaler.innerHTML = `
      <div class="scaler-box">
        <header class="kicker">Amount</header>
        <p class="lede">${escapeHtml(selectedFood.name)} → ${slotName(mealSlot)}${fuelMode === "plan" ? " · plan" : ""}</p>
        <div class="chips amt-chips">${chips}</div>
        <label class="amt-label">${unit}</label>
        <div class="amount-row">
          <input id="amt" type="number" min="0.1" step="${byServing ? 0.5 : 5}" value="${amount}" />
          <button class="btn" id="add" style="width:auto;padding:12px 18px">${fuelMode === "plan" ? "Plan" : "Log"}</button>
        </div>
        <div class="tiny preview-macros">${preview.kcal} kcal · ${preview.protein}p · ${preview.carbs}c · ${preview.fat}f</div>
        <button class="btn ghost" id="pin">${pinned ? "Unpin" : "Pin this"}</button>
      </div>
    `;
    const amt = scaler.querySelector("#amt");
    const previewEl = scaler.querySelector(".preview-macros");
    const paintPreview = () => {
      const next = scaleFood(selectedFood, amount);
      previewEl.textContent = `${next.kcal} kcal · ${next.protein}p · ${next.carbs}c · ${next.fat}f`;
      scaler.querySelectorAll(".amt").forEach((b) => {
        b.classList.toggle("on", Number(b.dataset.n) === amount);
      });
    };
    amt.oninput = (e) => {
      amount = Number(e.target.value) || 0;
      paintPreview();
    };
    scaler.querySelectorAll(".amt").forEach((b) => {
      b.onclick = () => {
        amount = Number(b.dataset.n);
        amt.value = amount;
        paintPreview();
      };
    });
    scaler.querySelector("#add").onclick = () => {
      const item = scaleFood(selectedFood, amount);
      commitFood(item, selectedFood, amount);
      selectedFood = null;
      tab = "fuel";
      render();
    };
    scaler.querySelector("#pin").onclick = () => {
      toggleFavorite(state, selectedFood);
      persist();
      render();
    };
    scaler.scrollIntoView({ block: "center", behavior: "smooth" });
  }

  function drawPlate() {
    plate.innerHTML = "";
    if (fuelMode === "plan") {
      const plan = getPlan(state, planDay);
      const planned = SLOTS.reduce((n, s) => n + (plan[s.id]?.length || 0), 0);
      if (!planned) {
        plate.append(el(`<div class="empty">Empty plan. Pick a slot, then Plan a food. Heat does not move yet.</div>`));
        return;
      }
      SLOTS.forEach((s) => {
        const items = plan[s.id] || [];
        if (!items.length) return;
        plate.append(el(`<div class="meal-label">${s.name}</div>`));
        items.forEach((f) => {
          const row = el(`
            <div class="row">
              <div>
                <strong>${escapeHtml(f.name)}</strong>
                <div class="meta">${f.amount}${f.unit === "serving" ? " serving" : "g"} · ${f.kcal} kcal</div>
              </div>
              <div class="row-acts">
                ${planDay === todayKey() ? `<button class="eat" type="button">Eat</button>` : ""}
                <button class="x" type="button" aria-label="remove">×</button>
              </div>
            </div>
          `);
          const eat = row.querySelector(".eat");
          if (eat) {
            eat.onclick = () => {
              addFood({ ...f, id: crypto.randomUUID(), slot: s.id, loggedAt: Date.now() });
              removePlanItem(state, planDay, s.id, f.id);
              persist();
              render();
            };
          }
          row.querySelector(".x").onclick = () => {
            removePlanItem(state, planDay, s.id, f.id);
            persist();
            render();
          };
          plate.append(row);
        });
      });
      return;
    }
    if (!day.foods.length) {
      plate.append(el(`<div class="empty">Nothing logged. The fire is not impressed.</div>`));
      return;
    }
    SLOTS.forEach((s) => {
      const items = day.foods
        .filter((f) => normalizeSlot(f.slot || "dinner") === s.id)
        .sort((a, b) => (a.loggedAt || 0) - (b.loggedAt || 0));
      if (!items.length) return;
      plate.append(el(`<div class="meal-label">${s.name}</div>`));
      items.forEach((f) => {
        const when = clockTime(f.loggedAt);
        const row = el(`
          <div class="row">
            <div>
              <strong>${escapeHtml(f.name)}</strong>
              <div class="meta">${when ? when + " · " : ""}${f.amount}${f.unit === "serving" ? " serving" : "g"} · ${f.kcal} kcal · ${f.protein}p · ${Math.round(f.carbs || 0)}c · ${Math.round(f.fat || 0)}f</div>
            </div>
            <button class="x" aria-label="remove">×</button>
          </div>
        `);
        row.querySelector("button").onclick = () => {
          const d = today();
          d.foods = d.foods.filter((x) => x.id !== f.id);
          setDay(state, todayKey(), d);
          persist();
          render();
        };
        plate.append(row);
      });
    });
  }

  let lookupTimer = 0;
  q.oninput = () => {
    foodQuery = q.value;
    foodHits = searchLocal(foodQuery);
    drawHits();
    clearTimeout(lookupTimer);
    if (foodQuery.trim().length < 2) {
      status.textContent = "";
      return;
    }
    status.textContent = "Looking up calories…";
    lookupTimer = setTimeout(async () => {
      const typed = foodQuery;
      try {
        const found = await searchAnywhere(typed);
        if (q.value !== typed) return;
        pendingGrams = found.grams;
        foodHits = found.foods;
        drawHits();
        const remote = found.foods.filter((f) => String(f.id).startsWith("usda-") || String(f.id).startsWith("off-")).length;
        status.textContent = remote
          ? `Local + USDA + packaged foods.${found.grams ? ` Using ${found.grams}g.` : ""}`
          : found.foods.length
            ? `Local pantry.${found.grams ? ` Using ${found.grams}g.` : ""}`
            : "Nothing found. Try another name, or log custom.";
      } catch {
        if (q.value === typed) status.textContent = "Lookup offline. Local foods still work.";
      }
    }, 320);
  };

  drawHits();
  drawScaler();
  drawPlate();
  box.querySelector("#cadd").onclick = () => {
    const name = box.querySelector("#cname").value.trim() || "Unnamed regret";
    const kcal = Number(box.querySelector("#ckcal").value) || 0;
    const protein = Number(box.querySelector("#cpro").value) || 0;
    const carbs = Number(box.querySelector("#ccarb").value) || 0;
    const fat = Number(box.querySelector("#cfat").value) || 0;
    const custom = { id: "custom-" + name.toLowerCase(), name, kcal, protein, carbs, fat, unit: "serving" };
    commitFood(
      {
        id: crypto.randomUUID(),
        name,
        amount: 1,
        unit: "serving",
        kcal,
        protein,
        carbs,
        fat,
        slot: mealSlot,
      },
      custom,
      1
    );
    tab = "fuel";
    render();
  };
  return box;
}

function train() {
  const day = today();
  const kinds = [
    ["lift", "Lift"],
    ["cond", "Conditioning"],
    ["walk", "Walk"],
    ["sport", "Sport"],
    ["rest", "Rest (real)"],
  ];
  const snap = snapshot();
  const box = el(`
    <section class="screen">
      <div class="glass pad">
        <header class="kicker">Train</header>
        <div class="panel-num">${snap.heat}<span> HEAT</span></div>
        <p class="heat-cap">If you didn't move, don't log theater.</p>
        <div class="chips" id="kinds"></div>
        <div class="field">
          <label>Minutes</label>
          <input id="mins" type="number" value="${workoutMins}" min="1" />
        </div>
        <div class="field">
          <label>What actually happened</label>
          <input id="note" value="${escapeHtml(workoutNote)}" placeholder="Push + pull. Or 'I walked the dog like an adult.'" />
        </div>
        <button class="btn" id="log">Log session</button>
      </div>
      <div class="glass pad">
        <header class="kicker">Today's sessions</header>
        <div class="list" id="sessions"></div>
      </div>
    </section>
  `);
  const chips = box.querySelector("#kinds");
  kinds.forEach(([id, label]) => {
    const b = el(`<button class="${workoutKind === id ? "on" : ""}">${label}</button>`);
    b.onclick = () => {
      workoutKind = id;
      workoutMins = Number(box.querySelector("#mins").value) || 45;
      workoutNote = box.querySelector("#note").value;
      render();
    };
    chips.append(b);
  });
  box.querySelector("#log").onclick = () => {
    const d = today();
    workoutMins = Number(box.querySelector("#mins").value) || 0;
    workoutNote = box.querySelector("#note").value.trim();
    d.workouts.push({
      id: crypto.randomUUID(),
      kind: workoutKind,
      mins: workoutMins,
      note: workoutNote,
      at: Date.now(),
    });
    workoutNote = "";
    setDay(state, todayKey(), d);
    persist();
    tab = "arena";
    render();
  };
  const sessions = box.querySelector("#sessions");
  if (!day.workouts.length) sessions.append(el(`<div class="empty">No sessions. The iron is patient. Ash is not.</div>`));
  day.workouts.forEach((w) => {
    const row = el(`
      <div class="row">
        <div>
          <strong>${escapeHtml(w.kind)}</strong>
          <div class="meta">${w.mins} min${w.note ? " · " + escapeHtml(w.note) : ""}</div>
        </div>
        <button class="x">×</button>
      </div>
    `);
    row.querySelector("button").onclick = () => {
      const d = today();
      d.workouts = d.workouts.filter((x) => x.id !== w.id);
      setDay(state, todayKey(), d);
      persist();
      render();
    };
    sessions.append(row);
  });
  return box;
}

function verdict() {
  const day = today();
  const last = state.history[0];
  const kg = currentKg(state);
  const path = weightPath(state.weighIns);
  const hist = state.history.slice(0, 21);
  const snap = snapshot();
  const box = el(`
    <section class="screen">
      <div class="glass pad" id="card"></div>
      <div class="actions">
        <button class="btn" id="close">${day.verdictShown && last?.day === todayKey() ? "Today is locked" : "Close today"}</button>
        <button class="btn ghost" id="confess">${day.confessed ? "Confession noted" : "Confess a slip (honesty +heat)"}</button>
      </div>
      <div class="glass pad trace">
        <header class="kicker">The scale</header>
        <header class="trace-head">
          <span>Current</span>
          <strong>${kg} kg · ${targets(profile()).kcal} kcal target</strong>
        </header>
        ${
          path.d
            ? `<svg class="weight-line" viewBox="0 0 320 72" preserveAspectRatio="none"><path d="${path.d}" /></svg>`
            : `<p class="lede">One weigh-in is a selfie. Two is a trend.</p>`
        }
        <div class="amount-row" style="margin-top:12px">
          <div class="field" style="margin:0"><label>kg</label><input id="wkg" type="number" step="0.1" value="${kg}" /></div>
          <button class="btn" id="weigh" style="width:auto;padding:12px 16px">Log</button>
        </div>
        <p class="tiny" id="wnote"></p>
        <div class="list" id="wlist" style="margin-top:10px"></div>
      </div>
      <div class="glass pad">
        <header class="kicker">Closed days</header>
        <div class="list" id="hist"></div>
      </div>
    </section>
  `);
  const card = box.querySelector("#card");
  if (last && last.day === todayKey() && day.verdictShown) {
    const copy = last.line ? { headline: last.headline, body: last.line } : verdictCopy(last);
    card.innerHTML = `
      <header class="kicker">Verdict</header>
      <h3>${escapeHtml(copy.headline)}</h3>
      <div class="panel-num delta ${last.delta >= 0 ? "up" : "down"}">${last.delta >= 0 ? "+" : ""}${last.delta}<span> heat</span></div>
      <p class="heat-cap">${escapeHtml(copy.body)}</p>
      <p class="tiny">+${last.xpGain} XP · ${Math.round(last.tot.kcal)} / ${last.t.kcal} kcal · P ${last.proteinHit ? "hit" : "miss"} · ${last.trained ? "trained" : "untrained"}</p>
    `;
  } else {
    card.innerHTML = `
      <header class="kicker">Verdict · live</header>
      <div class="panel-num delta ${snap.live.preview >= 0 ? "up" : "down"}">${snap.heat}<span> / ${snap.live.preview >= 0 ? "+" : ""}${snap.live.preview} swing</span></div>
      <p class="heat-cap">Heat is already moving. Lock it when the eating is actually done.</p>
    `;
  }

  const histEl = box.querySelector("#hist");
  if (!hist.length) {
    histEl.append(el(`<div class="empty">No closed days. Tomorrow needs a yesterday.</div>`));
  } else {
    hist.forEach((h) => {
      const line = h.line || verdictCopy(h).body;
      histEl.append(
        el(`
        <div class="row hist-row">
          <div>
            <strong>${escapeHtml(prettyDay(h.day))}</strong>
            <div class="meta">${Math.round(h.tot.kcal)}/${h.t.kcal} kcal · ${h.proteinHit ? "protein hit" : "protein miss"} · ${h.trained ? "trained" : "skipped iron"}</div>
            <div class="tiny">${escapeHtml(line)}</div>
          </div>
          <b class="${h.delta >= 0 ? "up" : "down"}">${h.delta >= 0 ? "+" : ""}${h.delta}</b>
        </div>
      `)
      );
    });
  }

  const wlist = box.querySelector("#wlist");
  state.weighIns.slice(0, 6).forEach((w) => {
    wlist.append(el(`<div class="row"><div><strong>${w.kg} kg</strong><div class="meta">${escapeHtml(prettyDay(w.day))}</div></div></div>`));
  });

  box.querySelector("#close").onclick = () => {
    if (day.verdictShown && last?.day === todayKey()) return;
    const result = settleDay(state, day, profile());
    const copy = verdictCopy(result, { goal: profile().goal, heat: state.heat });
    state.history[0].headline = copy.headline;
    state.history[0].line = copy.body;
    day.verdictShown = true;
    setDay(state, todayKey(), day);
    persist();
    tab = "verdict";
    render();
  };
  box.querySelector("#confess").onclick = () => {
    day.confessed = true;
    setDay(state, todayKey(), day);
    persist();
    render();
  };
  box.querySelector("#weigh").onclick = () => {
    const res = logWeighIn(state, box.querySelector("#wkg").value);
    if (!res.ok) {
      box.querySelector("#wnote").textContent = "That's not a bodyweight. Try kg like a human.";
      return;
    }
    persist();
    tab = "verdict";
    render();
  };
  const note = box.querySelector("#wnote");
  if (state.weighIns.length >= 2) {
    const delta = Math.round((state.weighIns[0].kg - state.weighIns[1].kg) * 10) / 10;
    note.textContent = weighCopy(delta, state.profile.goal);
  }
  return box;
}

function self() {
  const p = state.profile;
  const t = targets(profile());
  const standalone = isStandalone();
  const mine = rankFor(state.xp);
  const ladder = RANKS.map(
    (r) => `
      <div class="rank-badge ${r.name === mine.name ? "on" : ""}">
        ${rankMark(r.name, 56)}
        <b>${escapeHtml(r.name)}</b>
        <span>${r.min} xp</span>
      </div>`
  ).join("");
  const box = el(`
    <section class="screen">
      <div class="glass pad">
        <header class="kicker">Self</header>
        <p class="heat-cap">Edit the meatbag. Heat, rank, and history stay.</p>
        <div class="field"><label>Name</label><input id="name" value="${escapeHtml(p.name)}" /></div>
        <div class="field"><label>Age</label><input id="age" type="number" value="${p.age}" /></div>
        <div class="field">
          <label>Sex</label>
          <select id="sex">
            <option value="female" ${p.sex === "female" ? "selected" : ""}>Female</option>
            <option value="male" ${p.sex === "male" ? "selected" : ""}>Male</option>
          </select>
        </div>
        <div class="field"><label>Height (cm)</label><input id="cm" type="number" value="${p.cm}" /></div>
        <div class="field"><label>Weight (kg) — also logs a weigh-in</label><input id="kg" type="number" step="0.1" value="${currentKg(state)}" /></div>
        <div class="field">
          <label>Goal</label>
          <select id="goal">
            <option value="cut" ${p.goal === "cut" ? "selected" : ""}>Cut</option>
            <option value="recomp" ${p.goal === "recomp" ? "selected" : ""}>Recomp</option>
            <option value="bulk" ${p.goal === "bulk" ? "selected" : ""}>Bulk</option>
          </select>
        </div>
        <div class="field">
          <label>Daily life</label>
          <select id="activity">
            <option value="desk" ${p.activity === "desk" ? "selected" : ""}>Desk creature</option>
            <option value="light" ${p.activity === "light" ? "selected" : ""}>Light movement</option>
            <option value="trained" ${p.activity === "trained" ? "selected" : ""}>Train most days</option>
            <option value="feral" ${p.activity === "feral" ? "selected" : ""}>Manual work / athlete</option>
          </select>
        </div>
        <button class="btn" id="savep">Save human</button>
        <p class="tiny" id="smsg">${escapeHtml(saveMsg)} Current math: ${t.kcal} kcal · ${t.protein}p · ${t.carbs}c · ${t.fat}f</p>
      </div>
      <div class="glass pad">
        <header class="kicker">Ranks</header>
        <p class="lede">XP is the climb. Heat is the weather. You are ${escapeHtml(mine.name)}.</p>
        <div class="rank-ladder">${ladder}</div>
      </div>
      <div class="glass pad">
        <header class="kicker">Keep the fire</header>
        <p class="lede">This phone is the vault. No cloud. Download a backup, put it in Files / Drive, restore if Chrome wipes the site.</p>
        <p class="tiny">${state.lastBackupAt ? `Last file backup: ${new Date(state.lastBackupAt).toLocaleString()}` : "No file backup yet. Do one before you switch phones."}</p>
        <div class="actions" style="margin-top:12px">
          <button class="btn" type="button" id="backup">Download backup</button>
          <button class="btn ghost" type="button" id="restore">Restore from file</button>
        </div>
        <input id="bakfile" type="file" accept="application/json,.json" class="hidden" />
        <p class="tiny" id="bakmsg"></p>
      </div>
      <div class="glass pad">
        <header class="kicker">On your phone</header>
        <p class="lede">${standalone ? "You're already in the app shell. Good." : "Install it. Free doesn't mean it has to live in a browser tab like a shameful hobby."}</p>
        <button class="btn ghost" id="install">${canInstall() ? `Install ${APP_NAME}` : "How to install"}</button>
        <p class="tiny" id="inst">iPhone: Share → Add to Home Screen. Android Chrome: menu → Install app / Add to Home screen.</p>
      </div>
      <div class="actions">
        <button class="btn ghost" id="reset">Reset everything</button>
      </div>
    </section>
  `);
  box.querySelector("#savep").onclick = () => {
    const kg = Number(box.querySelector("#kg").value) || p.kg;
    state.profile = {
      ...state.profile,
      name: box.querySelector("#name").value.trim() || "Human",
      age: Number(box.querySelector("#age").value) || p.age,
      sex: box.querySelector("#sex").value,
      cm: Number(box.querySelector("#cm").value) || p.cm,
      goal: box.querySelector("#goal").value,
      activity: box.querySelector("#activity").value,
    };
    if (Math.abs(kg - currentKg(state)) >= 0.05) logWeighIn(state, kg);
    else state.profile.kg = kg;
    saveMsg = "Saved. Targets retuned. Ego optional.";
    persist();
    render();
  };
  box.querySelector("#install").onclick = async () => {
    const res = await promptInstall();
    const inst = box.querySelector("#inst");
    if (res.ok) inst.textContent = "Installed. Don't let the icon collect dust.";
    else inst.textContent = "No install prompt here. iPhone: Share → Add to Home Screen. Android: Chrome menu → Install app.";
  };
  box.querySelector("#backup").onclick = () => {
    state.lastBackupAt = Date.now();
    persist();
    const blob = new Blob([JSON.stringify(backupPayload(state), null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `ember-backup-${todayKey()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    box.querySelector("#bakmsg").textContent = "Saved a file. Keep it off this browser — Drive, Files, a folder you actually own.";
  };
  const bakfile = box.querySelector("#bakfile");
  box.querySelector("#restore").onclick = () => bakfile.click();
  bakfile.onchange = async () => {
    const file = bakfile.files?.[0];
    bakfile.value = "";
    if (!file) return;
    const msg = box.querySelector("#bakmsg");
    try {
      const next = parseBackup(await file.text());
      if (!confirm("Replace Heat, logs, plan, and rank on this device with that file?")) return;
      state = next;
      persist();
      tab = "arena";
      render();
    } catch {
      msg.textContent = `That file is not a ${APP_NAME} backup.`;
    }
  };
  box.querySelector("#reset").onclick = () => {
    const typed = prompt("This deletes Heat, rank, and every log on this device. Type WIPE to confirm.");
    if (typed !== "WIPE") return;
    wipeLocal();
    state = load();
    tab = "arena";
    render();
  };
  return box;
}

function onboard() {
  const box = el(`
    <div class="stage onboard">
      <header class="brand"><div>${APP_NAME}</div><small>Free. Ranked. Unpaid.</small></header>
      <div class="splash">
        <h1>YOUR<br>FIRE<br>LIES<br>LESS<br>THAN YOU.</h1>
        <p>A calorie app with a spine. Heat rises when you hit the work. Heat dies when you don't. We roast. We hype. We don't sell gold memberships.</p>
      </div>
      <div class="field"><label>Name Ash can weaponize</label><input id="name" placeholder="First name" /></div>
      <div class="field"><label>Age</label><input id="age" type="number" value="28" /></div>
      <div class="field">
        <label>Sex (for TDEE math, not a personality quiz)</label>
        <select id="sex"><option value="female">Female</option><option value="male">Male</option></select>
      </div>
      <div class="field"><label>Height (cm)</label><input id="cm" type="number" value="170" /></div>
      <div class="field"><label>Weight (kg)</label><input id="kg" type="number" value="72" /></div>
      <div class="field">
        <label>Goal</label>
        <select id="goal">
          <option value="cut">Cut — get lean, stay honest</option>
          <option value="recomp">Recomp — look like you train</option>
          <option value="bulk">Bulk — grow without getting sloppy</option>
        </select>
      </div>
      <div class="field">
        <label>Daily life</label>
        <select id="activity">
          <option value="desk">Desk creature</option>
          <option value="light" selected>Light movement</option>
          <option value="trained">Train most days</option>
          <option value="feral">Manual work / athlete</option>
        </select>
      </div>
      <button class="btn" id="go">Light it</button>
      <p class="fine">Runs on your device. No account. Add it to your home screen from Self. Open Food Facts stays free.</p>
    </div>
  `);
  box.querySelector("#go").onclick = () => {
    const kg = Number(box.querySelector("#kg").value) || 72;
    state.profile = {
      name: box.querySelector("#name").value.trim() || "Human",
      age: Number(box.querySelector("#age").value) || 28,
      sex: box.querySelector("#sex").value,
      cm: Number(box.querySelector("#cm").value) || 170,
      kg,
      goal: box.querySelector("#goal").value,
      activity: box.querySelector("#activity").value,
    };
    state.weighIns = [{ id: crypto.randomUUID(), day: todayKey(), kg, at: Date.now() }];
    state.heat = 52;
    persist();
    tab = "arena";
    render();
  };
  return box;
}

render();
