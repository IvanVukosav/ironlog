import { describe, expect, it } from "vitest";
import { buildProgramSets, isValidScheme, parseScheme } from "./programScheme";

describe("parseScheme", () => {
  it("reads sets, reps and a percentage", () => {
    expect(parseScheme("5x5@75")).toEqual([
      { sets: 5, reps: 5, percent: 75, weight: null, rpe: null },
    ]);
  });

  it("reads several groups, with a decimal comma inside one", () => {
    expect(parseScheme("1x1@90, 3x5@72,5").map((group) => group.percent)).toEqual([90, 72.5]);
  });

  it("reads a fixed weight and an RPE", () => {
    expect(parseScheme("4x8@60kg")[0]).toMatchObject({ weight: 60, percent: null });
    expect(parseScheme("3x3@85 rpe8")[0]).toMatchObject({ percent: 85, rpe: 8 });
  });

  it("is empty for an empty scheme and null for nonsense or out-of-range values", () => {
    expect(parseScheme("  ")).toEqual([]);
    expect(parseScheme("five by five")).toBeNull();
    expect(parseScheme("0x5")).toBeNull();
    expect(parseScheme("5x5@130")).toBeNull();
    expect(isValidScheme("5x5@75")).toBe(true);
    expect(isValidScheme("5x5@130")).toBe(false);
  });
});

describe("buildProgramSets", () => {
  it("takes percentages of the training max, rounded to 2.5 kg", () => {
    // Training max 90 % of 180 = 162; 75 % of that = 121.5, rounded to 122.5.
    const { sets, missingE1rm } = buildProgramSets(parseScheme("2x5@75"), 180, 90);
    expect(sets).toEqual([
      { weight: 122.5, reps: 5, rpe: null },
      { weight: 122.5, reps: 5, rpe: null },
    ]);
    expect(missingE1rm).toBe(false);
  });

  it("leaves percentage sets at 0 kg and says so when there is no e1RM", () => {
    const { sets, missingE1rm } = buildProgramSets(parseScheme("1x5@75, 1x8@40kg"), null, 100);
    expect(sets.map((set) => set.weight)).toEqual([0, 40]);
    expect(missingE1rm).toBe(true);
  });
});
