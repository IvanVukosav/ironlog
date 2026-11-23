import { describe, expect, it } from "vitest";
import {
  firstEmptyCardKey,
  foodsMatching,
  mealCards,
  previousMeal,
  recentFoodsFor,
  searchableFoods,
} from "./mealSuggestions";

const food = (name, kcal = 100) => ({ name, kcal, protein: 1, carbs: 2, fat: 3 });
const oats = food("Zobene pahuljice", 300);
const eggs = food("Jaja", 210);
const coffee = food("Kava s mlijekom", 40);
const chicken = food("Piletina", 330);
const rice = food("Riža", 350);
const shake = food("Proteinski shake", 240);

const SATURDAY = "2026-11-21T00:00:00.000Z";
const SUNDAY = "2026-11-22T00:00:00.000Z";
// As /api/nutrition/last-meals gives them: newest day first, each name once.
const lastMeals = [
  { name: "Doručak", date: SUNDAY, items: [oats, eggs] },
  { name: "Ručak", date: SUNDAY, items: [chicken, rice] },
  { name: "Večera", date: SATURDAY, items: [eggs] },
];

describe("mealCards", () => {
  it("adds the last day's meals that the day lacks, empty and unsaved, after its own", () => {
    const meals = [{ id: 7, name: "Ručak", items: [chicken] }];
    const cards = mealCards(meals, lastMeals);
    expect(cards.map((card) => [card.id, card.name, card.items.length])).toEqual([
      [7, "Ručak", 1],
      [null, "Doručak", 0],
    ]);
  });

  it("takes only the latest day: a meal from an earlier one is not offered as a card", () => {
    expect(mealCards([], lastMeals).map((card) => card.name)).toEqual(["Doručak", "Ručak"]);
  });

  it("tells names apart without case or spaces", () => {
    const meals = [{ id: 7, name: " doručak ", items: [] }];
    expect(mealCards(meals, lastMeals).map((card) => card.name)).toEqual([" doručak ", "Ručak"]);
  });

  it("keys a card by its meal's name, so an empty card keeps its key once it is saved", () => {
    const before = mealCards([], lastMeals).find((card) => card.name === "Doručak");
    const after = mealCards([{ id: 9, name: "Doručak", items: [oats] }], lastMeals)[0];
    expect(after.key).toBe(before.key);
  });

  it("keys a second meal of the same name by its id", () => {
    const meals = [
      { id: 3, name: "Užina", items: [] },
      { id: 4, name: "užina", items: [] },
    ];
    expect(mealCards(meals, []).map((card) => card.key)).toEqual(["name:užina", "id:4"]);
  });

  it("is just the day's meals when nothing was eaten in the days before", () => {
    const meals = [{ id: 1, name: "Ostalo", items: [] }];
    expect(mealCards(meals, [])).toEqual([{ ...meals[0], key: "name:ostalo" }]);
  });
});

describe("previousMeal", () => {
  it("finds the last meal of that name, case aside", () => {
    expect(previousMeal({ name: "VEČERA" }, lastMeals)).toBe(lastMeals[2]);
    expect(previousMeal({ name: "Užina" }, lastMeals)).toBeNull();
  });
});

describe("recentFoodsFor", () => {
  const recentByMeal = [
    { meal: "Doručak", items: [oats, eggs, coffee] },
    { meal: "Ručak", items: [chicken, rice] },
  ];
  const options = {
    recentByMeal,
    recentAll: [rice, coffee, chicken, oats],
    favourites: [],
    limit: 4,
  };

  it("offers what was eaten lately at this meal, up to the limit", () => {
    const foods = recentFoodsFor({ name: "Doručak", items: [] }, { ...options, limit: 2 });
    expect(foods).toEqual([oats, eggs]);
  });

  it("leaves out what the meal holds and the favourites, without lunch's foods instead", () => {
    const meal = { name: "doručak", items: [{ ...oats, id: 1 }] };
    const foods = recentFoodsFor(meal, { ...options, favourites: [{ ...eggs, id: 5 }] });
    expect(foods).toEqual([coffee]);
  });

  it("offers what was eaten lately at all for a meal with no past", () => {
    const foods = recentFoodsFor({ name: "Užina", items: [] }, { ...options, limit: 2 });
    expect(foods).toEqual([rice, coffee]);
  });
});

describe("searchableFoods", () => {
  it("searches the meal's foods first, then all eaten lately, without the favourites", () => {
    const options = {
      recentByMeal: [{ meal: "Večera", items: [rice] }],
      recentAll: [oats, rice, eggs],
      favourites: [eggs],
      limit: 10,
    };
    const foods = searchableFoods({ name: "večera", items: [rice] }, options);
    expect(foods).toEqual([rice, oats]);
    expect(searchableFoods({ name: "Večera", items: [] }, { ...options, limit: 1 })).toEqual([
      rice,
    ]);
  });
});

describe("firstEmptyCardKey", () => {
  it("is the first card with no food, or none", () => {
    const cards = [
      { key: "name:doručak", items: [oats] },
      { key: "name:ručak", items: [] },
      { key: "name:večera", items: [] },
    ];
    expect(firstEmptyCardKey(cards)).toBe("name:ručak");
    expect(firstEmptyCardKey(cards.slice(0, 1))).toBeNull();
  });
});

describe("foodsMatching", () => {
  it("finds names that hold the query, case aside, and nothing for an empty one", () => {
    const foods = [oats, eggs, shake];
    expect(foodsMatching(foods, " PAH")).toEqual([oats]);
    expect(foodsMatching(foods, "a")).toEqual([oats, eggs, shake]);
    expect(foodsMatching(foods, "  ")).toEqual([]);
  });
});
