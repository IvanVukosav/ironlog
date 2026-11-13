import { describe, expect, it } from "vitest";
import {
  sumMacros,
  withItemAdded,
  withItemChanged,
  withMealAdded,
  withMealLists,
  withoutItem,
  withoutMeal,
} from "./nutritionState";

const oats = { id: 10, mealId: 1, name: "Zobene", kcal: 380, protein: 14, carbs: 62, fat: 8 };
const eggs = { id: 11, mealId: 1, name: "Jaja", kcal: 310, protein: 26, carbs: 2, fat: 22 };
const rice = { id: 20, mealId: 2, name: "Riža", kcal: 720, protein: 58, carbs: 80, fat: 16 };

function day() {
  return {
    id: 5,
    date: "2026-11-13T00:00:00.000Z",
    meals: [
      { id: 1, name: "Doručak", items: [oats, eggs] },
      { id: 2, name: "Ručak", items: [rice] },
    ],
  };
}

const itemIds = (result, mealId) =>
  result.meals.find((meal) => meal.id === mealId).items.map((item) => item.id);

describe("withMealLists", () => {
  it("gives every meal an item list, and a day without meals an empty one", () => {
    expect(withMealLists({ id: 5 }).meals).toEqual([]);
    expect(withMealLists({ id: 5, meals: [{ id: 1 }] }).meals).toEqual([{ id: 1, items: [] }]);
  });
});

describe("meals", () => {
  it("adds a meal at the end, with an item list", () => {
    const result = withMealAdded(day(), { id: 3, name: "Večera" });
    expect(result.meals.map((meal) => meal.id)).toEqual([1, 2, 3]);
    expect(result.meals[2].items).toEqual([]);
  });

  it("removes a meal", () => {
    expect(withoutMeal(day(), 1).meals.map((meal) => meal.id)).toEqual([2]);
  });
});

describe("items", () => {
  it("adds an item to the meal it belongs to", () => {
    const result = withItemAdded(day(), { ...rice, id: 21 });
    expect(itemIds(result, 2)).toEqual([20, 21]);
    expect(itemIds(result, 1)).toEqual([10, 11]);
  });

  it("replaces a changed item in place", () => {
    const result = withItemChanged(day(), { ...oats, kcal: 400 });
    expect(itemIds(result, 1)).toEqual([10, 11]);
    expect(result.meals[0].items[0].kcal).toBe(400);
  });

  it("removes an item wherever it is", () => {
    expect(itemIds(withoutItem(day(), 11), 1)).toEqual([10]);
    expect(itemIds(withoutItem(day(), 11), 2)).toEqual([20]);
  });

  it("leaves the day it was given untouched", () => {
    const before = day();
    const snapshot = JSON.stringify(before);
    withMealAdded(before, { id: 3 });
    withoutMeal(before, 1);
    withItemAdded(before, { ...rice, id: 21 });
    withItemChanged(before, { ...oats, kcal: 1 });
    withoutItem(before, 10);
    expect(JSON.stringify(before)).toBe(snapshot);
  });
});

describe("sumMacros", () => {
  it("adds up kcal and grams", () => {
    expect(sumMacros([oats, eggs, rice])).toEqual({
      kcal: 1410,
      protein: 98,
      carbs: 144,
      fat: 46,
    });
  });

  it("is all zero without items", () => {
    expect(sumMacros([])).toEqual({ kcal: 0, protein: 0, carbs: 0, fat: 0 });
  });
});
