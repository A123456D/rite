import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  dateKey,
  todayKey,
  yesterdayKey,
  getPlan,
  addPlanItem,
  removePlanItem,
  rememberFood,
  toggleFavorite,
  isFavorite,
  saveMeal,
  removeMeal,
  backupPayload,
  parseBackup,
  migrate,
} from "../src/store.js";

beforeEach(() => {
  vi.useFakeTimers();
  // 01:00 local — inside the 3am cutoff, so the tracking day is "yesterday"
  vi.setSystemTime(new Date("2026-09-24T01:00:00"));
});
afterEach(() => {
  vi.useRealTimers();
});

const state = (over = {}) => ({ plans: {}, meals: [], favorites: [], recents: [], ...over });

describe("tracking day cutoff", () => {
  it("before 3am, today is still yesterday", () => {
    expect(todayKey()).toBe("2026-09-23");
    expect(yesterdayKey()).toBe("2026-09-22");
  });
  it("after 3am, today is today", () => {
    vi.setSystemTime(new Date("2026-09-24T04:00:00"));
    expect(todayKey()).toBe("2026-09-24");
    expect(yesterdayKey()).toBe("2026-09-23");
  });
  it("explicit dates stay calendar keys", () => {
    expect(todayKey(new Date("2026-01-02T23:00:00"))).toBe(dateKey(new Date(2026, 0, 2)));
  });
});

describe("plans", () => {
  it("adds, lists, and removes planned items per slot", () => {
    const st = state();
    addPlanItem(st, "2026-09-25", "lunch", { id: "a", name: "Rice", kcal: 200 });
    addPlanItem(st, "2026-09-25", "dinner", { id: "b", name: "Chicken", kcal: 300 });
    expect(getPlan(st, "2026-09-25").lunch).toHaveLength(1);
    removePlanItem(st, "2026-09-25", "lunch", "a");
    expect(getPlan(st, "2026-09-25").lunch).toHaveLength(0);
    expect(getPlan(st, "2026-09-25").dinner).toHaveLength(1);
  });
  it("maps the retired late slot onto snacks", () => {
    const st = state({ plans: { "2026-09-25": { late: [{ id: "c", name: "Chips" }] } } });
    expect(getPlan(st, "2026-09-25").snacks).toHaveLength(1);
  });
});

describe("recents and favorites", () => {
  it("remembers foods with their last amount, newest first", () => {
    const st = state();
    rememberFood(st, { id: "rice", name: "Rice", kcal: 130, protein: 3 }, 200);
    rememberFood(st, { id: "oats", name: "Oats", kcal: 380, protein: 13 }, 80);
    rememberFood(st, { id: "rice", name: "Rice", kcal: 130, protein: 3 }, 150);
    expect(st.recents.map((r) => r.id)).toEqual(["rice", "oats"]);
    expect(st.recents[0].lastAmount).toBe(150);
  });
  it("pins and unpins without duplicating", () => {
    const st = state();
    expect(toggleFavorite(st, { id: "eggs", name: "Eggs" })).toBe(true);
    expect(toggleFavorite(st, { id: "eggs", name: "Eggs" })).toBe(false);
    expect(isFavorite(st, "eggs")).toBe(false);
  });
});

describe("saved meals", () => {
  it("save and remove composite meals, capped at 12", () => {
    const st = state();
    for (let i = 0; i < 14; i++) saveMeal(st, { id: "m" + i, name: "Meal " + i, items: [] });
    expect(st.meals).toHaveLength(12);
    expect(st.meals[0].id).toBe("m13");
    removeMeal(st, "m13");
    expect(st.meals[0].id).toBe("m12");
  });
});

describe("backup roundtrip", () => {
  it("parses its own payload and rejects garbage", () => {
    const blob = { heat: 77, profile: { name: "Ash" }, days: {} };
    const payload = JSON.stringify(backupPayload(blob));
    expect(parseBackup(payload).heat).toBe(77);
    // bare state (older export shape) also parses
    expect(parseBackup(JSON.stringify(blob)).heat).toBe(77);
    expect(() => parseBackup("null")).toThrow();
    expect(() => parseBackup("{}")).toThrow();
  });
  it("migrate normalizes legacy slots and theme", () => {
    const fixed = migrate({ theme: "whatever", days: { "2026-09-23": { foods: [{ slot: "late" }] } } });
    expect(fixed.theme).toBe("ember");
    expect(fixed.days["2026-09-23"].foods[0].slot).toBe("snacks");
    expect(fixed.meals).toEqual([]);
  });
  it("migrate maps retired themes to the new lineup", () => {
    expect(migrate({ theme: "vesper" }).theme).toBe("onyx");
    expect(migrate({ theme: "nebula" }).theme).toBe("slate");
    expect(migrate({ theme: "hud" }).theme).toBe("onyx");
    expect(migrate({ theme: "auto" }).theme).toBe("auto");
    expect(migrate({}).theme).toBe("ember");
  });
});
