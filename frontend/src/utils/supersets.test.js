import { describe, expect, it } from "vitest";
import { lettersFromLinks, supersetLabels, tidySupersets, toggleSuperset } from "./supersets";

describe("lettersFromLinks", () => {
  it("gives each run of linked exercises the next letter, and none to one on its own", () => {
    expect(lettersFromLinks([true, false, false, true, true, false])).toEqual([
      "A",
      "A",
      null,
      "B",
      "B",
      "B",
    ]);
    expect(lettersFromLinks([])).toEqual([]);
  });
});

describe("toggleSuperset", () => {
  it("links an exercise with the next one, and joins a superset that is already there", () => {
    expect(toggleSuperset([null, null, null], 0)).toEqual(["A", "A", null]);
    expect(toggleSuperset(["A", "A", null], 1)).toEqual(["A", "A", "A"]);
  });

  it("takes a link apart, and a superset left with one exercise is gone", () => {
    expect(toggleSuperset(["A", "A", "A"], 1)).toEqual(["A", "A", null]);
    expect(toggleSuperset(["A", "A", null], 0)).toEqual([null, null, null]);
  });

  it("keeps the letters in order down the day", () => {
    expect(toggleSuperset([null, null, "A", "A"], 0)).toEqual(["A", "A", "B", "B"]);
  });
});

describe("tidySupersets", () => {
  it("drops a superset of one and letters the rest in order", () => {
    expect(tidySupersets(["C", null, "B", "B"])).toEqual([null, null, "A", "A"]);
  });
});

describe("supersetLabels", () => {
  it("numbers the exercises of each superset", () => {
    expect(supersetLabels(["A", "A", null, "B", "B", "B"])).toEqual([
      "A1",
      "A2",
      null,
      "B1",
      "B2",
      "B3",
    ]);
  });
});
