import { describe, it, expect } from "vitest";
import { parseFoodQuery, scaleFood, rescaleItem, searchLocal, FOODS } from "../src/foods.js";

describe("parseFoodQuery", () => {
  it("peels grams off the front of a query", () => {
    expect(parseFoodQuery("200g penne")).toEqual({ name: "penne", grams: 200, raw: "200g penne" });
    expect(parseFoodQuery("chicken 250 grams")).toEqual({ name: "chicken", grams: 250, raw: "chicken 250 grams" });
  });
  it("converts ounces", () => {
    expect(parseFoodQuery("8 oz steak").grams).toBe(227);
  });
  it("passes plain names through", () => {
    expect(parseFoodQuery("carbonara")).toEqual({ name: "carbonara", grams: null, raw: "carbonara" });
  });
});

describe("scaleFood / rescaleItem", () => {
  it("scales per-100g foods and keeps the base for re-scaling", () => {
    const item = scaleFood({ id: "rice", name: "Rice", kcal: 130, protein: 2.7, carbs: 28, fat: 0.3, unit: "100g" }, 250);
    expect(item.kcal).toBe(325);
    expect(item.protein).toBe(6.8);
    expect(item.base).toEqual({ kcal: 130, protein: 2.7, carbs: 28, fat: 0.3, unit: 100 });
  });
  it("scales per-serving foods", () => {
    const item = scaleFood({ id: "bar", name: "Bar", kcal: 200, protein: 20, carbs: 22, fat: 6, unit: "serving" }, 2);
    expect(item.kcal).toBe(400);
    expect(item.unit).toBe("serving");
  });
  it("rescales a logged item from its base without the pantry", () => {
    const logged = scaleFood({ id: "rice", name: "Rice", kcal: 130, protein: 2.7, carbs: 28, fat: 0.3, unit: "100g" }, 100);
    const fixed = rescaleItem(logged, 300);
    expect(fixed.kcal).toBe(390);
    expect(fixed.amount).toBe(300);
    expect(fixed.base).toEqual(logged.base);
  });
  it("old logged items without base refuse to rescale", () => {
    expect(rescaleItem({ name: "old", kcal: 10, amount: 1 }, 5)).toBeNull();
  });
});

describe("searchLocal", () => {
  it("finds the pantry by name fragment", () => {
    const hits = searchLocal("chicken breast");
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].name.toLowerCase()).toContain("chicken breast");
  });
  it("shows popular foods on an empty query", () => {
    expect(searchLocal("").length).toBeGreaterThan(0);
  });
  it("pantry is non-trivial", () => {
    expect(FOODS.length).toBeGreaterThan(150);
  });
});
