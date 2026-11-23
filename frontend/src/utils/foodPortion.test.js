import { describe, expect, it } from "vitest";
import { amountChoices, portionName, portionOf, startingAmount } from "./foodPortion";

const yogurt = {
  name: "Grčki jogurt 2 %",
  kcal: 73,
  protein: 9,
  carbs: 4,
  fat: 2,
  unit: "g",
  packageSize: 400,
  servingSize: null,
};

describe("portionOf", () => {
  it("scales the values per 100 to the amount: kcal whole, grams to a tenth", () => {
    expect(portionOf(yogurt, 150)).toEqual({ kcal: 110, protein: 13.5, carbs: 6, fat: 3 });
    expect(portionOf({ ...yogurt, protein: 6.3 }, 15)).toEqual({
      kcal: 11,
      protein: 0.9,
      carbs: 0.6,
      fat: 0.3,
    });
  });
});

describe("portionName", () => {
  it("names the product with its amount, written in the language", () => {
    expect(portionName(yogurt, 150, "hr")).toBe("Grčki jogurt 2 % 150 g");
    expect(portionName({ ...yogurt, name: "Mlijeko", unit: "ml" }, 37.5, "hr")).toBe(
      "Mlijeko 37,5 ml",
    );
    expect(portionName(yogurt, 37.5, "en")).toBe("Grčki jogurt 2 % 37.5 g");
  });
});

describe("amountChoices", () => {
  it("offers 50, 100 and 200, then the whole package", () => {
    expect(amountChoices(yogurt)).toEqual([
      { amount: 50, kind: "amount" },
      { amount: 100, kind: "amount" },
      { amount: 200, kind: "amount" },
      { amount: 400, kind: "package" },
    ]);
  });

  it("puts a serving in its place, and a package of a plain amount's size instead of it", () => {
    const bar = { ...yogurt, servingSize: 30, packageSize: 100 };
    expect(amountChoices(bar)).toEqual([
      { amount: 30, kind: "serving" },
      { amount: 50, kind: "amount" },
      { amount: 100, kind: "package" },
      { amount: 200, kind: "amount" },
    ]);
  });
});

describe("startingAmount", () => {
  it("starts at a serving when there is one, else at 100", () => {
    expect(startingAmount(yogurt)).toBe(100);
    expect(startingAmount({ ...yogurt, servingSize: 30 })).toBe(30);
  });
});
