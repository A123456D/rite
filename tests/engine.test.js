import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  calorieScore,
  scoreDay,
  liveDelta,
  settleDay,
  reopenDay,
  applyDecay,
  rankFor,
  targets,
  mifflin,
  dayTotals,
  clampHeat,
  logWeighIn,
  deleteWeighIn,
} from "../src/engine.js";

const T = { tdee: 2000, kcal: 2000, protein: 140, fat: 62, carbs: 220 };
const PROFILE = { goal: "cut", kg: 75, sex: "male", cm: 178, age: 30, activity: "light" };

const day = ({ kcal = 0, protein = 0, workouts = [], confessed = false } = {}) => ({
  foods: kcal || protein ? [{ name: "x", kcal, protein, carbs: 0, fat: 0, amount: 100, unit: "g" }] : [],
  workouts,
  notes: "",
  confessed,
  verdictShown: false,
});

const state = (over = {}) => ({
  heat: 50,
  xp: 0,
  streak: 0,
  lastActiveDay: null,
  lastDecayDay: null,
  weighIns: [],
  history: [],
  days: {},
  ...over,
});

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-24T12:00:00"));
});
afterEach(() => {
  vi.useRealTimers();
});

describe("calorieScore", () => {
  it("rewards the 70–108% band and punishes the extremes harder the further out", () => {
    expect(calorieScore(2000, 2000)).toBe(1);
    expect(calorieScore(1100, 2000)).toBe(-0.25);
    expect(calorieScore(2300, 2000)).toBe(0.2);
    expect(calorieScore(2700, 2000)).toBe(-0.85);
    expect(calorieScore(3000, 2000)).toBe(-1.2);
    expect(calorieScore(500, 2000)).toBe(-0.7);
    expect(calorieScore(800, 0)).toBe(0);
  });
});

describe("scoreDay — single source of truth", () => {
  it("fed + trained + protein hit is the top day", () => {
    const s = scoreDay(day({ kcal: 2000, protein: 140, workouts: [{ kind: "lift" }] }), T, PROFILE);
    expect(s.delta).toBe(27); // 10 + 6 + 11
  });
  it("fed + untrained on a cut eats the −4 penalty", () => {
    const s = scoreDay(day({ kcal: 2000, protein: 140 }), T, PROFILE);
    expect(s.delta).toBe(12); // 10 + 6 − 4
  });
  it("recomp does not take the untrained penalty", () => {
    const s = scoreDay(day({ kcal: 2000, protein: 140 }), T, { ...PROFILE, goal: "recomp" });
    expect(s.delta).toBe(16);
  });
  it("empty + trained counts as a fasted training day", () => {
    const s = scoreDay(day({ workouts: [{ kind: "lift" }] }), T, PROFILE);
    expect(s.delta).toBe(8);
  });
  it("empty + untrained is a ghost day", () => {
    expect(scoreDay(day(), T, PROFILE).delta).toBe(-12);
  });
  it("confession softens a bad-calorie day only", () => {
    const bad = scoreDay(day({ kcal: 3000, confessed: true }), T, PROFILE);
    const badSilent = scoreDay(day({ kcal: 3000 }), T, PROFILE);
    expect(bad.delta).toBe(badSilent.delta + 3);
    const good = scoreDay(day({ kcal: 2000, protein: 140, workouts: [{ kind: "lift" }], confessed: true }), T, PROFILE);
    const goodSilent = scoreDay(day({ kcal: 2000, protein: 140, workouts: [{ kind: "lift" }] }), T, PROFILE);
    expect(good.delta).toBe(goodSilent.delta);
  });
  it("live preview equals the settled delta — always", () => {
    const cases = [
      day(),
      day({ workouts: [{ kind: "lift" }] }),
      day({ kcal: 1800, protein: 100 }),
      day({ kcal: 2600, protein: 60, workouts: [{ kind: "cond" }], confessed: true }),
      day({ kcal: 2200, protein: 150, workouts: [{ kind: "walk" }] }),
    ];
    for (const d of cases) {
      const preview = liveDelta(d, PROFILE, 50).preview;
      const st = state();
      const result = settleDay(st, d, PROFILE);
      // heat starts at 50, so no clamping can distort the swing
      expect(result.delta).toBe(preview);
      expect(st.heat).toBe(clampHeat(50 + preview));
    }
  });
});

describe("settleDay + reopenDay roundtrip", () => {
  it("settling banks heat, xp, streak, history — reopen restores all of it", () => {
    const st = state({ heat: 60, xp: 500, streak: 4, lastActiveDay: "2026-09-23" });
    const d = day({ kcal: 2000, protein: 140, workouts: [{ kind: "lift" }] });
    const result = settleDay(st, d, PROFILE);
    expect(st.heat).toBe(60 + result.delta);
    expect(st.xp).toBe(500 + result.xpGain);
    expect(st.streak).toBe(5);
    expect(st.history).toHaveLength(1);

    const ok = reopenDay(st, d);
    expect(ok.ok).toBe(true);
    expect(st.heat).toBe(60);
    expect(st.xp).toBe(500);
    expect(st.streak).toBe(4);
    expect(st.lastActiveDay).toBe("2026-09-23");
    expect(st.history).toHaveLength(0);
    expect(d.verdictShown).toBe(false);
  });
  it("reopen refuses to touch history that isn't today", () => {
    const st = state({ history: [{ day: "2026-09-20", prev: { heat: 10, xp: 0, streak: 0, lastActiveDay: null } }] });
    expect(reopenDay(st, day()).ok).toBe(false);
    expect(st.history).toHaveLength(1);
  });
});

describe("streaks and decay", () => {
  it("consecutive settle days climb the streak; a gap resets to 1", () => {
    const st = state({ streak: 3, lastActiveDay: "2026-09-23", lastDecayDay: "2026-09-23", heat: 50 });
    settleDay(st, day({ kcal: 2000, protein: 140, workouts: [{ kind: "lift" }] }), PROFILE);
    expect(st.streak).toBe(4);

    vi.setSystemTime(new Date("2026-09-28T12:00:00"));
    applyDecay(st);
    expect(st.streak).toBe(0);
    settleDay(st, day({ kcal: 2000, protein: 140, workouts: [{ kind: "lift" }] }), PROFILE);
    expect(st.streak).toBe(1);
  });
  it("decay burns 9/day while hot and 5/day once cold", () => {
    const st = state({ heat: 80, lastActiveDay: "2026-09-20", lastDecayDay: "2026-09-20", streak: 6 });
    applyDecay(st);
    expect(st.heat).toBe(53); // three missed days × 9
    expect(st.streak).toBe(0);

    const cold = state({ heat: 25, lastActiveDay: "2026-09-20", lastDecayDay: "2026-09-20" });
    applyDecay(cold);
    expect(cold.heat).toBe(10); // three missed days × 5
  });
});

describe("ranks", () => {
  it("walks the ladder and computes progress", () => {
    expect(rankFor(0).name).toBe("Cinder");
    expect(rankFor(81).name).toBe("Spark");
    expect(rankFor(81).progress).toBeCloseTo(1 / 140, 3);
    expect(rankFor(9999).name).toBe("Eternal");
    expect(rankFor(9999).next).toBeNull();
  });
});

describe("targets", () => {
  it("cuts at 80% of TDEE with 2g/kg protein", () => {
    const tdee = mifflin(PROFILE);
    const t = targets(PROFILE);
    expect(t.tdee).toBe(tdee);
    expect(t.kcal).toBe(Math.round(tdee * 0.8));
    expect(t.protein).toBe(150);
  });
});

describe("weigh-ins", () => {
  it("rejects nonsense, unshifts real ones, and retunes targets", () => {
    const st = state({ profile: { ...PROFILE } });
    expect(logWeighIn(st, 5).ok).toBe(false);
    const res = logWeighIn(st, 73.44);
    expect(res.ok).toBe(true);
    expect(res.kg).toBe(73.4);
    expect(st.weighIns[0].kg).toBe(73.4);
    expect(st.profile.kg).toBe(73.4);
  });
  it("delete removes the entry and hands currentKg back to the previous one", () => {
    const st = state({ profile: { ...PROFILE }, weighIns: [{ id: "a", kg: 70, day: "2026-09-23" }] });
    logWeighIn(st, 72);
    deleteWeighIn(st, st.weighIns[0].id);
    expect(st.weighIns[0].kg).toBe(70);
    expect(st.profile.kg).toBe(70);
  });
});

describe("dayTotals", () => {
  it("sums macros and tolerates missing carbs/fat", () => {
    const tot = dayTotals({
      foods: [
        { kcal: 100, protein: 10 },
        { kcal: 250, protein: 5, carbs: 30, fat: 12 },
      ],
    });
    expect(tot).toEqual({ kcal: 350, protein: 15, carbs: 30, fat: 12 });
  });
});
