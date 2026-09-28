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
  saveMeal,
  removeMeal,
} from "./store.js";
import {
  targets,
  rankFor,
  applyDecay,
  liveDelta,
  settleDay,
  reopenDay,
  scoringProfile,
  currentKg,
  logWeighIn,
  deleteWeighIn,
  heatCalendar,
  weightPath,
  weightMovingAverage,
  clampHeat,
  RANKS,
  WEEK_DAYS,
  pendingWeekDays,
  weekReport,
  settleWeek,
} from "./engine.js";
import { lineForLive, verdictCopy, heatCaption, morningFrom } from "./coach.js";
import { searchLocal, scaleFood, rescaleItem, searchAnywhere, FOODS, getUsdaKey, setUsdaKey } from "./foods.js";
import { SLOTS, defaultSlot, slotName, normalizeSlot, clockTime } from "./meals.js";
import { barcodeSupported, lookupBarcode, scanBarcode } from "./barcode.js";
import { createHeatCore } from "./core3d.js";
import { shareWeekCard } from "./share-card.js";
import { rankMark } from "./ranks.js";
import { getConfig, setEnabled as setNotifEnabled, setSlot as setNotifSlot, permission as notifPermission, requestPermission, startTicker, tickNotifs, SLOTS as NOTIF_SLOTS } from "./notify.js";
import { APP_NAME, THEMES, heatBand, applyTheme } from "./themes.js";
import { registerPwa, canInstall, promptInstall, isStandalone } from "./pwa.js";
import { drawBoardCard } from "./board-ui.js";
import { publishWeek, fetchBoard, boardName, setBoardName, clientId } from "./board.js";

if (import.meta.env.PROD) registerPwa();

const root = document.getElementById("app");
let state = load();
let tab = "arena";
let core3d = null;
let coreCanvas = null;
let pendingFlare = 0;
let focusQuick = false;
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
let editingFoodId = null;
let lastShownHeat = null;
let stamp = null; // verdict-stamp payload after closing the day
let weekStamp = null; // week-verdict-stamp payload after closing a week
let builderOpen = false;
let builderItems = [];
let builderQuery = "";
let builderName = "";

const NAV_ICONS = {
  arena: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5c1 4.5 6.5 6.5 6.5 12a6.5 6.5 0 0 1-13 0c0-5.5 5.5-7.5 6.5-12z"/><path d="M12 11c.5 2.2 2.6 3 2.6 5.4a2.6 2.6 0 0 1-5.2 0C9.4 14 11.5 13.2 12 11z"/></svg>`,
  fuel: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3v7M4.5 3v4a2.5 2.5 0 0 0 5 0V3M7 10v11"/><path d="M17 3c-1.8 1.5-2.5 3.5-2.5 6H17v12M17 3v18"/></svg>`,
  train: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12h3M19 12h3M6.5 8v8M17.5 8v8M9.5 6v12M14.5 6v12M6.5 12h11"/></svg>`,
  verdict: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l2.5 5.5L20 9.5l-4 4 1 5.8L12 16.5 7 19.3l1-5.8-4-4 5.5-1z"/></svg>`,
  self: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4.5 20.5c1.2-3.6 4-5.5 7.5-5.5s6.3 1.9 7.5 5.5"/></svg>`,
  bolt: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13 2L5 13.5h5L10.5 22 19 10h-5.5z"/></svg>`,
  muscle: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 3.5a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2 2 2 0 0 0-2 2v5a2 2 0 0 0 2 2h2a2 2 0 0 1 2 2 2 2 0 0 1 2-2h5a2 2 0 0 0 2-2v-5a2 2 0 0 0-2-2 2 2 0 0 1-2-2v-2a2 2 0 0 1 2-2" transform="rotate(45 12 12)"/><path d="M9 15l6-6"/></svg>`,
  calendar: `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 9.5h17M8 3v4M16 3v4"/></svg>`,
  grain: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21V8"/><path d="M12 12c0-2.5 1.8-4.2 4.5-4.5-.3 2.7-2 4.5-4.5 4.5z"/><path d="M12 12c0-2.5-1.8-4.2-4.5-4.5.3 2.7 2 4.5 4.5 4.5z"/><path d="M12 17c0-2.5 1.8-4.2 4.5-4.5-.3 2.7-2 4.5-4.5 4.5z"/><path d="M12 17c0-2.5-1.8-4.2-4.5-4.5.3 2.7 2 4.5 4.5 4.5z"/></svg>`,
  drop: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.5c3.2 4.2 5.5 7 5.5 9.8a5.5 5.5 0 0 1-11 0c0-2.8 2.3-5.6 5.5-9.8z"/></svg>`,
};

applyTheme(state.theme);
applyDecay(state);
if (state.profile && (!state.weighIns || !state.weighIns.length)) {
  state.weighIns = [{ id: "seed", day: todayKey(), kg: state.profile.kg, at: Date.now() }];
}
save(state);
requestDurableStorage();

function profile() {
  return scoringProfile(state);
}

// True once today's verdict is settled and in history.
function settledToday() {
  return Boolean(today().verdictShown && state.history[0]?.day === todayKey());
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
  const locked = settledToday();
  const heat = locked ? state.heat : clampHeat(state.heat + live.preview);
  const lockedDelta = locked ? state.history[0]?.delta ?? 0 : 0;
  return { day, live, locked, heat, lockedDelta };
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

function dataRow(label, val, target, pct, over = false) {
  return `
    <div class="data-row ${over ? "over" : ""}">
      <div class="dr-head">
        <span>${label}</span>
        <b>${val}<em> / ${target}</em></b>
      </div>
      <div class="dr-meter"><i style="width:${Math.min(100, pct * 100).toFixed(1)}%"></i></div>
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
  if (settledToday()) return; // day is settled; the swing is already banked
  if (fuelMode === "plan") {
    addPlanItem(state, planDay, mealSlot, item);
    if (template) rememberFood(state, template, usedAmount);
    persist();
    return;
  }
  addFood(item, template, usedAmount);
  pendingFlare = Math.min(1.3, 0.5 + (item.kcal || 100) / 900); // the core eats too
}

function render() {
  applyTheme(state.theme);
  document.documentElement.dataset.heatBand = heatBand(state.heat);
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

  if (stamp) {
    stage.append(verdictStamp());
  }
  if (weekStamp) {
    stage.append(weekStampOverlay());
  }

  // The 3D core keeps ONE canvas + WebGL context for the app's lifetime —
  // re-attaching it across renders instead of recreating contexts per log.
  const coreHost = stage.querySelector(".heat-core");
  if (coreHost) {
    if (!coreCanvas) coreCanvas = el('<canvas class="core3d" aria-hidden="true"></canvas>');
    coreHost.appendChild(coreCanvas);
    const snap = snapshot();
    if (!core3d) {
      createHeatCore(coreCanvas, snap.heat).then((inst) => {
        if (!inst) return;
        if (!coreCanvas.isConnected) {
          inst.destroy();
          return;
        }
        core3d = inst;
        if (pendingFlare) {
          core3d.flare(pendingFlare);
          pendingFlare = 0;
        }
      });
    } else {
      core3d.setColors();
      core3d.setHeat(snap.heat);
      if (pendingFlare) {
        core3d.flare(pendingFlare);
        pendingFlare = 0;
      }
    }
  } else if (coreCanvas && coreCanvas.isConnected) {
    coreCanvas.remove(); // off-arena tab; instance stays warm for the return
  }

  // Tick the heat number from its previous value; cheap drama, honest numbers.
  const heatEl = stage.querySelector(".heat-figure b");
  if (heatEl) {
    const target = Number(heatEl.textContent) || 0;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (lastShownHeat !== null && lastShownHeat !== target && !reduce) {
      tickNumber(heatEl, lastShownHeat, target, 520);
    }
    lastShownHeat = target;
  }
}

function tickNumber(node, from, to, ms) {
  const start = performance.now();
  const step = (now) => {
    const p = Math.min(1, (now - start) / ms);
    const eased = 1 - Math.pow(1 - p, 3);
    node.textContent = String(Math.round(from + (to - from) * eased));
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function verdictStamp() {
  const overlay = el(`
    <div class="verdict-stamp" role="alertdialog" aria-label="Day verdict">
      <div class="stamp-card">
        <div class="stamp-rule"></div>
        <h2 class="stamp-headline">${escapeHtml(stamp.headline)}</h2>
        <div class="stamp-delta ${stamp.delta >= 0 ? "up" : "down"}">${stamp.delta >= 0 ? "+" : ""}${stamp.delta}<span> heat</span></div>
        <p class="stamp-body">${escapeHtml(stamp.body)}</p>
        <p class="tiny">+${stamp.xpGain} XP banked · streak ${state.streak}d</p>
        <button class="btn" type="button">See the ledger</button>
      </div>
    </div>
  `);
  overlay.querySelector("button").onclick = () => {
    stamp = null;
    tab = "verdict";
    render();
  };
  return overlay;
}

function weekStampOverlay() {
  const w = weekStamp;
  const overlay = el(`
    <div class="verdict-stamp" role="alertdialog" aria-label="Week verdict">
      <div class="stamp-card">
        <div class="stamp-rule"></div>
        <p class="stamp-kicker">Week verdict</p>
        <h2 class="stamp-headline">${escapeHtml(w.headline)}</h2>
        <div class="stamp-tier">${escapeHtml(w.tier)}</div>
        <div class="stamp-delta ${w.stats.avgDelta >= 0 ? "up" : "down"}">${w.stats.avgDelta >= 0 ? "+" : ""}${w.stats.avgDelta}<span> avg heat</span></div>
        <p class="stamp-body">${escapeHtml(w.narrative)}</p>
        <p class="tiny">+${w.xpBonus} XP banked</p>
        <div class="stamp-actions">
          <button class="btn" type="button">See the ledger</button>
          <button class="btn ghost" type="button" id="share-stamp">Share</button>
        </div>
      </div>
    </div>
  `);
  overlay.querySelector(".btn").onclick = () => {
    weekStamp = null;
    render();
  };
  overlay.querySelector("#share-stamp").onclick = async (e) => {
    e.stopPropagation();
    const res = await shareWeekCard(w, { streak: state.streak });
    if (res === "shared") showToast("Verdict shared.");
    if (res === "downloaded") showToast("Verdict image saved.");
  };
  return overlay;
}

function drawWeekCard(card) {
  const weeks = state.weeks || [];
  const pending = pendingWeekDays(state);
  const n = Math.min(pending.length, WEEK_DAYS);
  let html = `<header class="kicker">The week</header>`;
  if (pending.length >= WEEK_DAYS) {
    const rep = weekReport(pending, weeks[0]);
    html += `
      <p class="week-tier">${escapeHtml(rep.tier)}</p>
      <p class="lede">${escapeHtml(rep.narrative)}</p>
      ${dataRow("Avg calories", rep.stats.avgKcal.toLocaleString(), `${rep.stats.avgT} kcal`, rep.stats.avgT ? rep.stats.avgKcal / rep.stats.avgT : 0)}
      ${dataRow("Protein hits", `${rep.stats.proteinHits}`, `${WEEK_DAYS} days`, rep.stats.proteinHits / WEEK_DAYS)}
      ${dataRow("Trained", `${rep.stats.trainedDays}`, `${WEEK_DAYS} days`, rep.stats.trainedDays / WEEK_DAYS)}
      ${dataRow("Avg heat", `${rep.stats.avgHeat}`, "100", rep.stats.avgHeat / 100)}
      <div class="actions week-actions">
        <button class="btn" id="settle-week" type="button">Settle the week</button>
        <p class="tiny">+${rep.xpBonus} XP on settle. The seven days stay locked.</p>
      </div>
    `;
  } else if (weeks.length) {
    const w = weeks[0];
    html += `
      <p class="week-tier dim">${escapeHtml(w.tier)}</p>
      <p class="lede">${escapeHtml(w.headline)} ${w.stats.avgDelta >= 0 ? "+" : ""}${w.stats.avgDelta} average. +${w.xpBonus} XP banked.</p>
      <div class="rank-track fat"><i style="width:${Math.round((n / WEEK_DAYS) * 100)}%"></i></div>
      <p class="tiny">Next week closes in ${WEEK_DAYS - n} more settled day${WEEK_DAYS - n === 1 ? "" : "s"}.</p>
      <div class="week-actions">
        <button class="btn ghost" id="share-week" type="button">Share the verdict</button>
      </div>
    `;
  } else {
    html += `
      <p class="lede">${WEEK_DAYS - n} more settled day${WEEK_DAYS - n === 1 ? "" : "s"} until the first week verdict.</p>
      <div class="rank-track fat"><i style="width:${Math.round((n / WEEK_DAYS) * 100)}%"></i></div>
      <p class="tiny">Close your days — the week reads the ledger, not the live log.</p>
    `;
  }
  card.innerHTML = html;
  const settle = card.querySelector("#settle-week");
  if (settle) {
    settle.onclick = () => {
      const res = settleWeek(state);
      if (!res.ok) return;
      persist();
      weekStamp = res.record;
      render();
    };
  }
  const share = card.querySelector("#share-week");
  if (share) {
    share.onclick = async () => {
      const res = await shareWeekCard(weeks[0], { streak: state.streak });
      if (res === "shared") showToast("Verdict shared.");
      if (res === "downloaded") showToast("Verdict image saved.");
    };
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
    <nav class="nav" aria-label="Sections">
      ${tabs
        .map(
          ([id, label]) =>
            `<button type="button" data-tab="${id}" class="${tab === id ? "active" : ""}" aria-current="${tab === id ? "page" : "false"}">
        <span class="nav-ico" aria-hidden="true">${NAV_ICONS[id]}</span>
        <span class="nav-label">${label}</span>
      </button>`
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

function dayEndsIn() {
  const now = new Date();
  const cut = new Date(now);
  cut.setHours(3, 0, 0, 0);
  let ms;
  if (now < cut) {
    ms = cut - now;
  } else {
    const next = new Date(cut);
    next.setDate(next.getDate() + 1);
    ms = next - now;
  }
  const mins = Math.max(1, Math.round(ms / 60000));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}m`;
}

function updateDeadlineNodes() {
  document.querySelectorAll("[data-deadline]").forEach((node) => {
    const urgent = new Date().getHours() === 2;
    node.classList.toggle("urgent", urgent);
    node.innerHTML = `<i class="dot" aria-hidden="true"></i>Day ends in <b>${dayEndsIn()}</b>`;
  });
}

function arena() {
  const snap = snapshot();
  const { live, heat, locked, lockedDelta } = snap;
  document.documentElement.dataset.heatBand = heatBand(heat);
  const coach = ashFor(snap);
  const r = rankFor(state.xp);
  const t = live.t;
  const tot = live.tot;
  const swing = locked ? lockedDelta : live.preview;
  const backupAgeDays = state.lastBackupAt ? Math.floor((Date.now() - state.lastBackupAt) / 86400000) : null;
  const today = new Date().toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
  const loggedToday = snap.day.foods.length + snap.day.workouts.length > 0;
  let streakText = "";
  let streakCls = "";
  if (locked) {
    streakText = `Day locked · streak ${state.streak}d`;
  } else if (!loggedToday && state.streak > 0) {
    streakCls = "risk";
    streakText = `${state.streak}d streak dies at the cutoff`;
  } else if (!loggedToday) {
    streakText = "Log today to light a streak";
  } else {
    streakText = `Streak · ${state.streak}d and climbing`;
  }
  const box = el(`
    <section class="screen arena">
      <section class="sect hero-heat">
        <p class="micro"><i class="dot" aria-hidden="true"></i>Heat · ${heatBand(heat)}</p>
        <div class="heat-core">
          <canvas class="core3d" aria-hidden="true"></canvas>
          <div class="heat-figure"><b>${heat}</b></div>
        </div>
        <div class="heat-line" role="img" aria-label="heat ${heat} of 100"><i style="width:${Math.round(heat)}%"></i></div>
        <p class="swing-line">${locked ? "Locked" : "Live swing"} · <b class="swing-pill ${swing >= 0 ? "up" : "down"}">${swing >= 0 ? "+" : ""}${swing}</b></p>
        <p class="deadline" data-deadline><i class="dot" aria-hidden="true"></i>Day ends in <b>${dayEndsIn()}</b></p>
        <p class="streak-line ${streakCls}">${streakText}</p>
        <p class="heat-cap">${escapeHtml(heatCaption(heat))}</p>
      </section>
      ${
        backupAgeDays === null || backupAgeDays >= 14
          ? `<p class="backup-nag">${backupAgeDays === null ? "No backup yet. All of this burns with one browser reset — Self → Download backup." : `Last backup ${backupAgeDays} days ago. The fire lives in one browser. Copy it out.`}</p>`
          : ""
      }
      <section class="sect coach ${coach.tone}" aria-live="polite">
        <p class="micro">${escapeHtml(coach.who)}</p>
        <p class="coach-line">${escapeHtml(coach.text)}</p>
      </section>
      <section class="sect">
        <p class="micro">Today · ${today}</p>
        ${dataRow("Calories", Math.round(tot.kcal).toLocaleString(), `${t.kcal}`, t.kcal ? tot.kcal / t.kcal : 0)}
        ${dataRow("Protein", `${Math.round(tot.protein)}`, `${t.protein} g`, t.protein ? tot.protein / t.protein : 0)}
        ${dataRow("Carbs", `${Math.round(tot.carbs)}`, `${t.carbs} g`, t.carbs ? tot.carbs / t.carbs : 0, meterClass(tot.carbs, t.carbs) === "over")}
        ${dataRow("Fat", `${Math.round(tot.fat)}`, `${t.fat} g`, t.fat ? tot.fat / t.fat : 0, meterClass(tot.fat, t.fat) === "over")}
        ${t.satfat ? dataRow("Saturated fat", `${Math.round(tot.satfat || 0)}`, `${t.satfat} g`, t.satfat ? (tot.satfat || 0) / t.satfat : 0, (tot.satfat || 0) > t.satfat) : ""}
        <div class="data-row train ${live.trained ? "good" : ""}">
          <div class="dr-head">
            <span>Training</span>
            <b class="train-word">${live.trained ? "Stoked" : "Silent"}</b>
          </div>
          <div class="dr-meter"><i style="width:${live.trained ? 100 : 5}%"></i></div>
        </div>
      </section>
      <section class="sect rank-sect">
        <div class="rank-line">
          <span class="rank-name">Rank · ${rankMark(r.name, 22)} <b>${escapeHtml(r.name)}</b></span>
          <span class="tiny">${r.next ? `Next · ${escapeHtml(r.next)}` : "Top rank"}</span>
        </div>
        <p class="tiny rank-sub">${escapeHtml(r.title)} · ${state.xp} XP</p>
        <div class="rank-track fat"><i style="width:${Math.round(r.progress * 100)}%"></i></div>
      </section>
      <section class="sect today-log">
        <p class="micro">Today's log</p>
        ${timeLogHtml(snap.day.foods)}
      </section>
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
  const locked = snap.locked;
  const recents = state.recents || [];
  const favs = state.favorites || [];
  const meals = state.meals || [];
  const box = el(`
    <section class="screen fuel">
      <div class="glass pad fuel-hero">
        <header class="kicker">Fuel</header>
        <div class="panel-num">${Math.round(live.tot.kcal)}<span> / ${live.t.kcal} kcal</span></div>
        <p class="heat-cap">${
          locked
            ? "Today is settled — this is a diary entry now. Verdict → Reopen today if it needs to count."
            : fuelMode === "plan"
              ? `Planning ${slotName(mealSlot)} — nothing counts until you eat it.`
              : `Logging ${slotName(mealSlot)}.`
        }</p>
        <div class="meter fat"><i style="width:${Math.min(100, (live.tot.kcal / Math.max(live.t.kcal, 1)) * 100)}%"></i></div>
        <p class="micro">Quick add — just calories</p>
        <div class="quick-row ${locked ? "locked" : ""}">
          <input id="quick-kcal" type="number" inputmode="numeric" min="0" placeholder="kcal" aria-label="Quick add kcal" ${locked ? "disabled" : ""} />
          <input id="quick-pro" type="number" inputmode="numeric" min="0" placeholder="protein g" aria-label="Quick add protein" ${locked ? "disabled" : ""} />
          <button class="btn" id="quick-log" type="button" ${locked ? "disabled" : ""}>Add</button>
        </div>
        <div class="chips" id="modes"></div>
        <div class="chips" id="slots"></div>
        <div class="week-strip ${fuelMode === "plan" ? "" : "hidden"}" id="week"></div>
      </div>
      <div class="fuel-grid">
      ${
        (state.favorites || []).length || (state.recents || []).length
          ? `<div class="glass pad">
        <header class="kicker">Quick picks</header>
        <p class="tiny">One tap logs what you usually eat.</p>
        <div id="usual"></div>
      </div>`
          : ""
      }
      <div class="glass pad">
        <header class="kicker">Find a food</header>
        <p class="tiny">Search ${FOODS.length} foods stored on this device — then packaged products and USDA.</p>
        <div class="search">
          <input id="q" placeholder="Search food — try '200g oats'" value="${escapeHtml(foodQuery)}" />
        </div>
        <div class="barcode-row">
          ${barcodeSupported() ? `<button class="btn ghost" id="scan" type="button">Scan barcode</button>` : ""}
          <input id="code-in" inputmode="numeric" placeholder="Type a barcode" aria-label="Barcode number" />
          <button class="btn ghost" id="code-go" type="button">Find</button>
        </div>
        <p class="tiny" id="code-status"></p>
        <p class="tiny" id="lookup-status"></p>
        <div id="scaler" class="${selectedFood ? "" : "hidden"}"></div>
        <p class="micro">All foods</p>
        <div class="list" id="hits"></div>
      </div>
      <div class="glass pad">
        <header class="kicker" id="diary-kicker">${fuelMode === "plan" ? "The plan" : "Today's food"}</header>
        <p class="tiny">${fuelMode === "plan" ? "Nothing here counts until you eat it." : "Everything you've logged today."}</p>
        <div class="list" id="plate"></div>
      </div>
      ${locked ? "" : `<div class="glass pad">
        <header class="kicker">Build a meal</header>
        <p class="tiny">Combine ingredients into a reusable meal.</p>
        <button class="btn ghost" id="mb-open" type="button">Build a meal</button>
        <div id="meal-builder"></div>
      </div>`}
      ${
        meals.length && !locked
          ? `<div class="glass pad">
        <header class="kicker">Saved meals</header>
        <p class="tiny">Log a whole meal in one tap.</p>
        <div class="list" id="meals"></div>
      </div>`
          : ""
      }
      <div class="glass pad custom-offer">
        <header class="kicker">Add your own</header>
        <p class="lede">Not in the list? Copy it from the label. When unsure, guess low.</p>
        <div class="field"><label>Name</label><input id="cname" placeholder="Late-night whatever" /></div>
        <div class="macro-grid">
          <div class="field"><label>Kcal</label><input id="ckcal" type="number" value="250" /></div>
          <div class="field"><label>Protein</label><input id="cpro" type="number" value="10" /></div>
          <div class="field"><label>Carbs</label><input id="ccarb" type="number" value="20" /></div>
          <div class="field"><label>Fat</label><input id="cfat" type="number" value="8" /></div>
          <div class="field"><label>Sat fat (g)</label><input id="csat" type="number" value="0" /></div>
        </div>
        <button class="btn ghost" type="button" id="cadd" ${locked ? "disabled" : ""}>${fuelMode === "plan" ? "Add to plan" : "Add it"}</button>
      </div>
      </div>
    </section>
  `);


  const modes = box.querySelector("#modes");
  box.querySelector("#quick-log").onclick = () => {
    if (locked) return;
    const kcal = Math.round(Number(box.querySelector("#quick-kcal").value)) || 0;
    if (kcal <= 0) return;
    const pro = Math.round(Number(box.querySelector("#quick-pro").value)) || 0;
    const wasPlan = fuelMode;
    fuelMode = "log"; // a quick kcal always lands on today, never the plan
    commitFood({ name: `Quick ${kcal}`, kcal, protein: pro, carbs: 0, fat: 0, amount: 1, unit: "serving" });
    fuelMode = wasPlan;
    render();
  };
  if (focusQuick) {
    focusQuick = false;
    box.querySelector("#quick-kcal")?.focus();
  }
  [
    ["log", "Log food"],
    ["plan", "Plan ahead"],
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
    usual.append(el(`<p class="tiny" style="margin:8px 0">Favorites</p>`));
    const list = el(`<div class="list"></div>`);
    favs.forEach((f) => list.append(foodButton(f, " · pinned")));
    usual.append(list);
  }
  if (recents.length) {
    usual.append(el(`<p class="tiny" style="margin:12px 0 8px">Your regulars</p>`));
    const list = el(`<div class="list"></div>`);
    recents.slice(0, 8).forEach((f) => list.append(foodButton(f, " · again")));
    usual.append(list);
  }

  const hits = box.querySelector("#hits");
  const plate = box.querySelector("#plate");
  const scaler = box.querySelector("#scaler");
  const q = box.querySelector("#q");
  const status = box.querySelector("#lookup-status");

  async function findBarcode(code) {
    const codeStatus = box.querySelector("#code-status");
    if (!code) return;
    codeStatus.textContent = `Code ${code} — looking up…`;
    try {
      const f = await lookupBarcode(code);
      selectedFood = f;
      amount = f.unit === "serving" ? f.lastAmount || 1 : 100;
      render();
    } catch (err) {
      codeStatus.textContent =
        err.message === "cancelled"
          ? ""
          : err.message === "not found"
            ? "Not in Open Food Facts. Log it as a custom offering."
            : err.message === "no nutrition data"
              ? "That product has no nutrition data. Log it custom."
              : "Lookup failed. Check the number, or log it custom.";
    }
  }

  const scanBtn = box.querySelector("#scan");
  if (scanBtn) {
    scanBtn.onclick = async () => {
      try {
        const code = await scanBarcode();
        findBarcode(code);
      } catch {
        /* scan modal handles its own errors */
      }
    };
  }
  box.querySelector("#code-go").onclick = () => {
    findBarcode(box.querySelector("#code-in").value);
  };

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
          <button class="btn" id="add" style="width:auto;padding:12px 18px" ${locked ? "disabled" : ""}>${fuelMode === "plan" ? "Plan" : "Log"}</button>
        </div>
        ${locked ? `<p class="tiny">Today is settled — reopen it in Verdict to log.</p>` : ""}
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
                ${planDay === todayKey() && !locked ? `<button class="eat" type="button">Eat</button>` : ""}
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
    if (!day.foods.length && !state.days[yesterdayKey()]?.foods?.length && !meals.length) {
      plate.append(el(`<div class="empty">Nothing logged. The fire is not impressed.</div>`));
      return;
    }
    const yesterday = state.days[yesterdayKey()];
    SLOTS.forEach((s) => {
      const items = day.foods
        .filter((f) => normalizeSlot(f.slot || "dinner") === s.id)
        .sort((a, b) => (a.loggedAt || 0) - (b.loggedAt || 0));
      const yItems = (yesterday?.foods || []).filter((f) => normalizeSlot(f.slot || "dinner") === s.id);
      if (!items.length && !yItems.length) return;
      const label = el(`
        <div class="meal-label label-row">
          <span>${s.name}</span>
          <span class="label-acts">
            ${
              yItems.length && !locked
                ? `<button class="repeat-y" type="button" aria-label="Repeat yesterday's ${s.name}">Repeat yesterday · ${yItems.length}</button>`
                : ""
            }
            ${items.length >= 2 && !locked ? `<button class="save-meal" type="button">Save as meal</button>` : ""}
          </span>
        </div>
      `);
      const repeatBtn = label.querySelector(".repeat-y");
      if (repeatBtn) {
        repeatBtn.onclick = () => {
          yItems.forEach((f) => {
            const { id, slot, loggedAt, ...rest } = f;
            addFood({ ...rest, id: crypto.randomUUID(), slot: s.id, loggedAt: Date.now() });
          });
          persist();
          render();
        };
      }
      const saveMealBtn = label.querySelector(".save-meal");
      if (saveMealBtn) {
        saveMealBtn.onclick = () => {
          const name = prompt(`Name this ${s.name.toLowerCase()}`);
          if (!name) return;
          saveMeal(state, {
            id: crypto.randomUUID(),
            name: name.trim().slice(0, 40),
            slot: s.id,
            items: items.map((f) => ({
              name: f.name,
              amount: f.amount,
              unit: f.unit,
              kcal: f.kcal,
              protein: f.protein,
              carbs: f.carbs || 0,
              fat: f.fat || 0,
              base: f.base || null,
            })),
          });
          persist();
          render();
        };
      }
      plate.append(label);
      items.forEach((f) => {
        const when = clockTime(f.loggedAt);
        if (editingFoodId === f.id && f.base) {
          const editor = el(`
            <div class="row edit-row">
              <div class="edit-fields">
                <strong>${escapeHtml(f.name)}</strong>
                <div class="amount-row">
                  <input class="e-amt" type="number" min="0.1" step="${f.unit === "serving" ? 0.5 : 5}" value="${f.amount}" aria-label="New amount" />
                  <span class="tiny">${f.unit === "serving" ? "servings" : "g"}</span>
                  <button class="btn e-save" type="button" style="width:auto;padding:10px 14px">Save</button>
                  <button class="btn ghost e-cancel" type="button" style="width:auto;padding:10px 14px">Keep</button>
                </div>
                <em class="tiny">Numbers move Heat — fix the truth, not the vibe.</em>
              </div>
            </div>
          `);
          editor.querySelector(".e-cancel").onclick = () => {
            editingFoodId = null;
            drawPlate();
          };
          editor.querySelector(".e-save").onclick = () => {
            const nextAmount = Number(editor.querySelector(".e-amt").value);
            if (nextAmount > 0) {
              const d = today();
              d.foods = d.foods.map((x) => (x.id === f.id ? rescaleItem(x, nextAmount) : x));
              setDay(state, todayKey(), d);
              persist();
            }
            editingFoodId = null;
            render();
          };
          editor.querySelector(".e-amt").select();
          plate.append(editor);
          return;
        }
        const row = el(`
          <div class="row">
            <div>
              <strong>${escapeHtml(f.name)}</strong>
              <div class="meta">${when ? when + " · " : ""}${f.amount}${f.unit === "serving" ? " serving" : "g"} · ${f.kcal} kcal · ${f.protein}p · ${Math.round(f.carbs || 0)}c · ${Math.round(f.fat || 0)}f</div>
            </div>
            <div class="row-acts">
              ${f.base ? `<button class="edit" type="button" aria-label="Edit amount of ${escapeHtml(f.name)}">±</button>` : ""}
              <button class="x" type="button" aria-label="remove">×</button>
            </div>
          </div>
        `);
        const editBtn = row.querySelector(".edit");
        if (editBtn) {
          editBtn.onclick = () => {
            editingFoodId = f.id;
            drawPlate();
          };
        }
        row.querySelector(".x").onclick = () => {
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

  function drawBuilder() {
    const wrap = box.querySelector("#meal-builder");
    if (!wrap) return;
    if (!builderOpen) {
      wrap.innerHTML = "";
      return;
    }
    const hits = builderQuery ? searchLocal(builderQuery).slice(0, 6) : [];
    const t = builderItems.reduce(
      (a, i) => ({ kcal: a.kcal + i.kcal, p: a.p + i.protein, c: a.c + i.carbs, f: a.f + i.fat, s: a.s + (i.satfat || 0) }),
      { kcal: 0, p: 0, c: 0, f: 0, s: 0 }
    );
    wrap.innerHTML = `
      <div class="builder">
        <div class="field"><label>Meal name</label><input id="mb-name" maxlength="40" placeholder="Sunday prep bowl" value="${escapeHtml(builderName)}" /></div>
        <div class="search"><input id="mb-q" placeholder="Add ingredient — search food…" value="${escapeHtml(builderQuery)}" /></div>
        <div class="list" id="mb-hits">${hits.map((f) => `<button type="button" class="row" data-id="${f.id}"><div><strong>${escapeHtml(f.name)}</strong><div class="meta">${Math.round(f.kcal)} kcal / 100g</div></div></button>`).join("")}</div>
        <div class="list" id="mb-items">${builderItems.map((i, ix) => `
          <div class="row mb-row">
            <div><strong>${escapeHtml(i.name)}</strong>
            <div class="meta"><input class="mb-grams" data-ix="${ix}" type="number" min="1" value="${i.amount}" /> g · ${i.kcal} kcal</div></div>
            <button class="x mb-x" data-ix="${ix}" type="button" aria-label="remove">×</button>
          </div>`).join("")}</div>
        <p class="tiny preview-macros">Per meal: ${t.kcal} kcal · ${t.p}p · ${t.c}c · ${t.f}f${t.s ? ` · ${t.s} sat fat` : ""}</p>
        <div class="week-actions"><button class="btn" id="mb-save" type="button" ${builderItems.length < 2 ? "disabled" : ""}>Save meal</button></div>
      </div>`;
    const q = wrap.querySelector("#mb-q");
    q.oninput = (e) => {
      builderQuery = e.target.value;
      const caret = e.target.selectionStart;
      drawBuilder();
      const nq = wrap.querySelector("#mb-q");
      if (nq) nq.setSelectionRange(caret, caret);
    };
    wrap.querySelectorAll("#mb-hits .row").forEach((hitEl) => {
      hitEl.onclick = () => {
        const f = searchLocal(builderQuery).find((x) => x.id === hitEl.dataset.id);
        if (!f) return;
        builderItems.push({
          name: f.name,
          amount: 100,
          unit: "g",
          kcal: Math.round(f.kcal),
          protein: Math.round((f.protein || 0) * 10) / 10,
          carbs: Math.round((f.carbs || 0) * 10) / 10,
          fat: Math.round((f.fat || 0) * 10) / 10,
          satfat: f.satfat != null ? Math.round(f.satfat * 10) / 10 : null,
          base: { kcal: f.kcal, protein: f.protein || 0, carbs: f.carbs || 0, fat: f.fat || 0, unit: 100, ...(f.satfat != null ? { satfat: f.satfat } : {}) },
        });
        builderQuery = "";
        drawBuilder();
      };
    });
    wrap.querySelectorAll(".mb-grams").forEach((input) => {
      input.onchange = (e) => {
        const ix = Number(e.target.dataset.ix);
        const amt = Math.max(1, Number(e.target.value) || 100);
        const it = builderItems[ix];
        const mul = amt / (it.base.unit || 100);
        const round = (n) => Math.round(n * 10) / 10;
        it.amount = amt;
        it.kcal = Math.round(it.base.kcal * mul);
        it.protein = round(it.base.protein * mul);
        it.carbs = round(it.base.carbs * mul);
        it.fat = round(it.base.fat * mul);
        if (it.base.satfat != null) it.satfat = round(it.base.satfat * mul);
        drawBuilder();
      };
    });
    wrap.querySelectorAll(".mb-x").forEach((x) => {
      x.onclick = () => {
        builderItems.splice(Number(x.dataset.ix), 1);
        drawBuilder();
      };
    });
    const nameInput = wrap.querySelector("#mb-name");
    nameInput.oninput = (e) => { builderName = e.target.value; };
    wrap.querySelector("#mb-save").onclick = () => {
      if (builderItems.length < 2) return;
      saveMeal(state, {
        id: crypto.randomUUID(),
        name: (builderName.trim() || "My meal").slice(0, 40),
        slot: mealSlot,
        items: builderItems.map(({ name, amount, kcal, protein, carbs, fat, base }) => ({ name, amount, unit: "g", kcal, protein, carbs, fat, base })),
      });
      persist();
      builderOpen = false;
      builderItems = [];
      builderName = "";
      render();
    };
  }
  drawBuilder();

  function drawMeals() {
    const wrap = box.querySelector("#meals");
    if (!wrap) return;
    meals.forEach((m) => {
      const kcal = m.items.reduce((n, f) => n + f.kcal, 0);
      const row = el(`
        <div class="row">
          <div>
            <strong>${escapeHtml(m.name)}</strong>
            <div class="meta">${m.items.length} items · ${kcal} kcal → ${slotName(mealSlot)}</div>
          </div>
          <div class="row-acts">
            <button class="log-meal" type="button">Log</button>
            <button class="x" type="button" aria-label="remove">×</button>
          </div>
        </div>
      `);
      row.querySelector(".log-meal").onclick = () => {
        m.items.forEach((f) => {
          addFood(
            {
              ...f,
              id: crypto.randomUUID(),
              slot: mealSlot,
              loggedAt: Date.now(),
            },
            null,
            f.amount
          );
        });
        persist();
        render();
      };
      row.querySelector(".x").onclick = () => {
        removeMeal(state, m.id);
        persist();
        render();
      };
      wrap.append(row);
    });
  }

  let lookupTimer = 0;
  q.oninput = () => {
    foodQuery = q.value;
    pendingGrams = null; // stale grams from an earlier "200g …" search must not leak into the next pick
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
        pendingGrams = found.grams ?? null;
        foodHits = found.foods;
        drawHits();
        const remote = found.foods.filter((f) => String(f.id).startsWith("usda-") || String(f.id).startsWith("off-")).length;
        status.textContent = remote
          ? `Local + packaged + USDA.${found.grams ? ` Using ${found.grams}g.` : ""}`
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
  drawMeals();
  box.querySelector("#mb-open")?.addEventListener("click", () => {
    if (locked) return;
    builderOpen = !builderOpen;
    drawBuilder();
  });
  box.querySelector("#cadd").onclick = () => {
    if (locked) return;
    const name = box.querySelector("#cname").value.trim() || "Unnamed regret";
    const kcal = Number(box.querySelector("#ckcal").value) || 0;
    const protein = Number(box.querySelector("#cpro").value) || 0;
    const carbs = Number(box.querySelector("#ccarb").value) || 0;
    const fat = Number(box.querySelector("#cfat").value) || 0;
    const satfat = Number(box.querySelector("#csat").value) || 0;
    const custom = { id: "custom-" + name.toLowerCase(), name, kcal, protein, carbs, fat, unit: "serving", ...(satfat > 0 ? { satfat } : {}) };
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
        ...(satfat > 0 ? { satfat } : {}),
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
  const locked = snap.locked;
  const box = el(`
    <section class="screen train">
      <div class="glass pad">
        <header class="kicker">Train</header>
        <div class="panel-num">${snap.heat}<span> HEAT</span></div>
        <p class="heat-cap">${
          locked
            ? "Today is settled — training goes to tomorrow's fire. Reopen the day in Verdict if it must count."
            : "If you didn't move, don't log theater."
        }</p>
        <div class="chips" id="kinds"></div>
        <div class="field">
          <label>Minutes</label>
          <input id="mins" type="number" value="${workoutMins}" min="1" />
        </div>
        <div class="field">
          <label>What actually happened</label>
          <input id="note" value="${escapeHtml(workoutNote)}" placeholder="Push + pull. Or 'I walked the dog like an adult.'" />
        </div>
        <button class="btn" id="log" ${locked ? "disabled" : ""}>Log session</button>
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
    if (locked) return;
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
    pendingFlare = 0.9; // iron stokes the fire
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
  const maPath = weightMovingAverage(state.weighIns, 5);
  const hist = state.history.slice(0, 21);
  const snap = snapshot();
  const locked = snap.locked;

  const hist30 = [...state.history].slice(0, 30).reverse();
  const barW = hist30.length ? 320 / hist30.length : 320;
  const bars = hist30
    .map((h, i) => {
      const height = Math.max(2, (h.heat / 100) * 68);
      return `<rect class="${h.delta >= 0 ? "up" : "down"}" x="${(i * barW + 1).toFixed(1)}" y="${(70 - height).toFixed(1)}" width="${Math.max(2, barW - 2).toFixed(1)}" height="${height.toFixed(1)}" rx="1.5"/>`;
    })
    .join("");
  const heatTrend = hist30.length
    ? `<svg class="heat-trend" viewBox="0 0 320 72" preserveAspectRatio="none" role="img" aria-label="Heat over the last ${hist30.length} settled days">${bars}</svg>`
    : "";

  const week = state.history.slice(0, 7);
  let weekly = null;
  if (week.length) {
    const mean = (fn) => week.reduce((a, h) => a + fn(h), 0) / week.length;
    weekly = {
      n: week.length,
      avgKcal: Math.round(mean((h) => h.tot.kcal)),
      avgT: Math.round(mean((h) => h.t.kcal)),
      avgProtein: Math.round(mean((h) => h.tot.protein)),
      avgDelta: Math.round(mean((h) => h.delta) * 10) / 10,
    };
  }

  const box = el(`
    <section class="screen verdict">
      <div class="glass pad" id="card"></div>
      <div class="actions">
        <button class="btn" id="close">${locked ? "Today is locked" : "Close today"}</button>
        <button class="btn ghost" id="confess">${day.confessed ? "Confession noted" : "Confess a slip (counts on a bad-calorie day)"}</button>
        ${locked ? `<button class="btn ghost" id="reopen">Reopen today</button>` : ""}
      </div>
      <div class="glass pad" id="week-card"></div>
      <div class="glass pad trace">
        <header class="kicker">The scale</header>
        <header class="trace-head">
          <span>Current</span>
          <strong>${kg} kg · ${targets(profile()).kcal} kcal target</strong>
        </header>
        ${
          path.d
            ? `<svg class="weight-line" viewBox="0 0 320 72" preserveAspectRatio="none"><path d="${path.d}" />${maPath.d ? `<path class="ma" d="${maPath.d}" />` : ""}</svg>`
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
        <header class="kicker">Trends</header>
        ${heatTrend}
        ${hist30.length ? `<p class="tiny">Heat, last ${hist30.length} settled day${hist30.length === 1 ? "" : "s"}.</p>` : `<p class="lede">No closed days yet. The trend needs graves to stand on.</p>`}
        ${
          weekly
            ? `<div class="week-sum"><b>${weekly.avgKcal}</b> / ${weekly.avgT} kcal avg · <b>${weekly.avgProtein}g</b> protein · <b class="${weekly.avgDelta >= 0 ? "up" : "down"}">${weekly.avgDelta >= 0 ? "+" : ""}${weekly.avgDelta}</b> heat/day · last ${weekly.n}d</div>`
            : ""
        }
      </div>
      <div class="glass pad">
        <header class="kicker">Closed days</header>
        <div class="list" id="hist"></div>
      </div>
    </section>
  `);
  const card = box.querySelector("#card");
  drawWeekCard(box.querySelector("#week-card"));
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
    const row = el(`
      <div class="row">
        <div><strong>${w.kg} kg</strong><div class="meta">${escapeHtml(prettyDay(w.day))}</div></div>
        <button class="x" type="button" aria-label="Delete weigh-in">×</button>
      </div>
    `);
    row.querySelector("button").onclick = () => {
      deleteWeighIn(state, w.id);
      persist();
      render();
    };
    wlist.append(row);
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
    stamp = { headline: copy.headline, body: copy.body, delta: result.delta, xpGain: result.xpGain };
    tab = "verdict";
    render();
  };
  box.querySelector("#confess").onclick = () => {
    day.confessed = true;
    setDay(state, todayKey(), day);
    persist();
    render();
  };
  const reopen = box.querySelector("#reopen");
  if (reopen) {
    reopen.onclick = () => {
      if (!confirm("Reopen today? Heat, XP, and streak rewind to before the verdict.")) return;
      reopenDay(state, today());
      persist();
      render();
    };
  }
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

function drawNotifArea(na) {
  if (!na) return;
  na.innerHTML = "";
  if (notifPermission() === "unsupported") {
    na.append(el(`<p class="tiny">This browser has no notification system. The fire stays watched the old way.</p>`));
    return;
  }
  if (notifPermission() === "denied") {
    na.append(
      el(`<p class="tiny">Notifications are blocked for this site. Allow them in the browser's site settings, then come back here.</p>`)
    );
    return;
  }
  if (notifPermission() === "default") {
    const b = el(`<button class="btn" type="button">Enable notifications</button>`);
    b.onclick = async () => {
      await requestPermission();
      render();
    };
    na.append(b);
    na.append(el(`<p class="tiny">One prompt. Nothing leaves this device.</p>`));
    return;
  }
  const cfg = getConfig();
  const master = el(
    `<button type="button" class="switch ${cfg.enabled ? "on" : ""}" role="switch" aria-checked="${cfg.enabled}" aria-label="All wake-ups"></button>`
  );
  master.onclick = () => {
    setNotifEnabled(!cfg.enabled);
    render();
  };
  const head = el(`<div class="notif-row master"><div><b>All wake-ups</b><span class="nt">${cfg.enabled ? "listening" : "muted"}</span></div></div>`);
  head.append(master);
  na.append(head);
  NOTIF_SLOTS.forEach((slot) => {
    const on = cfg.slots[slot.id];
    const sw = el(
      `<button type="button" class="switch ${on && cfg.enabled ? "on" : ""}" role="switch" aria-checked="${on}" aria-label="${slot.label}"></button>`
    );
    sw.onclick = () => {
      setNotifSlot(slot.id, !on);
      render();
    };
    const row = el(
      `<div class="notif-row ${cfg.enabled ? "" : "dim"}"><div><b>${slot.label}</b><span class="nt">${slot.time}</span></div></div>`
    );
    row.append(sw);
    na.append(row);
  });
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
    <section class="screen self">
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
        <p class="tiny">The tracking day ends at 3am — a 1am snack lands on yesterday, where it belongs.</p>
      </div>
      <div class="glass pad">
        <header class="kicker">Ranks</header>
        <p class="lede">XP is the climb. Heat is the weather. You are ${escapeHtml(mine.name)}.</p>
        <div class="rank-ladder">${ladder}</div>
      </div>
      <div class="glass pad" id="board-card"></div>
      <div class="glass pad">
        <header class="kicker">Look</header>
        <p class="lede">Same fire, different sky.</p>
        <div class="chips" id="theme-chips"></div>
      </div>
      <div class="glass pad">
        <header class="kicker">Wake-ups</header>
        <p class="lede">Ash taps the glass when the day needs you. Works while RITE is running — installed, or a tab that's still alive.</p>
        <div id="notif-area"></div>
      </div>
      <div class="glass pad">
        <header class="kicker">Food database</header>
        <p class="lede">Packaged products are free forever. USDA basics work without a key, but a personal free key stops the throttling.</p>
        <div class="field"><label>USDA FDC API key (optional)</label><input id="usda" placeholder="paste key from api.data.gov" value="${escapeHtml(getUsdaKey())}" /></div>
        <button class="btn ghost" id="usda-save" type="button">Save key</button>
        <p class="tiny" id="usda-msg"></p>
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
  const themeChips = box.querySelector("#theme-chips");
  const ACCENTS = {
    ember: "#ff5500",
    vesper: "#a06bff",
    hud: "#3fd8ff",
    nebula: "#6fb0ff",
    aura: "#7c66f5",
    sketch: "#f04e23",
  };
  Object.entries(THEMES).forEach(([id, meta]) => {
    const b = el(
      `<button type="button" class="swatch ${(state.theme || "ember") === id ? "on" : ""}" aria-pressed="${(state.theme || "ember") === id}" aria-label="${meta.label} theme"><i style="background:${ACCENTS[id] || meta.color}"></i><span>${meta.label}</span></button>`
    );
    b.onclick = () => {
      state.theme = id;
      persist();
      render();
    };
    themeChips.append(b);
  });

  drawNotifArea(box.querySelector("#notif-area"));
  drawBoardCard(box.querySelector("#board-card"), {
    weeks: state.weeks || [],
    streak: state.streak,
    rankName: rankFor(state.xp).name,
    xp: state.xp,
  });
  box.querySelector("#usda-save").onclick = () => {
    const key = box.querySelector("#usda").value.trim();
    setUsdaKey(key);
    box.querySelector("#usda-msg").textContent = key
      ? "Key stored on this device only. USDA results join the pantry."
      : "Key cleared. Packaged products still work.";
  };
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
    a.download = `rite-backup-${todayKey()}.json`;
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

window.addEventListener("rite-update", () => {
  document.querySelector(".rite-toast")?.remove();
  const toast = el(`
    <div class="rite-toast" role="status">
      <span>Fresh build is in.</span>
      <button class="btn" type="button">Reload</button>
    </div>
  `);
  toast.querySelector("button").onclick = () => window.location.reload();
  document.body.append(toast);
});

function notifContext() {
  const d = today();
  return {
    heat: state.heat,
    logged: d.foods.length + d.workouts.length > 0,
    streak: state.streak,
  };
}

function showToast(text) {
  document.querySelector(".rite-toast")?.remove();
  const t = el(`<div class="rite-toast" role="status"><span>${escapeHtml(text)}</span></div>`);
  document.body.append(t);
  setTimeout(() => t.remove(), 5200);
}

// Launch paths: PWA shortcuts (?slot=…, ?quick=1) and the share target
// (?text=… "200g chicken rice" → pre-filled search with grams).
function applyLaunchParams() {
  const params = new URLSearchParams(location.search);
  const slot = params.get("slot");
  const quick = params.get("quick");
  const text = (params.get("text") || params.get("title") || "").trim();
  if (slot) {
    mealSlot = normalizeSlot(slot) || mealSlot;
    fuelMode = "log";
    tab = "fuel";
  }
  if (quick === "1") {
    tab = "fuel";
    focusQuick = true;
  }
  if (text) {
    const grams = text.match(/^\s*(\d+(?:\.\d+)?)\s*g(?:ram[s]?)?\b/i);
    if (grams) {
      pendingGrams = Number(grams[1]);
      foodQuery = text.slice(grams[0].length).trim();
    } else {
      foodQuery = text;
    }
    if (foodQuery) {
      foodHits = searchLocal(foodQuery);
    }
    tab = "fuel";
  }
  if (slot || quick || text) {
    history.replaceState(null, "", location.pathname);
  }
}

addEventListener("rite-notify", (e) => showToast(e.detail.body));
startTicker(notifContext);
setInterval(updateDeadlineNodes, 30000);

applyLaunchParams();
render();
