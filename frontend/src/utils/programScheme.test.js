import { describe, expect, it } from "vitest";
import {
  buildProgramSets,
  isValidScheme,
  parseScheme,
  schemeToSets,
  setsToScheme,
} from "./programScheme";

describe("parseScheme", () => {
  it("reads sets, reps and a percentage", () => {
    expect(parseScheme("5x5@75")).toEqual([
      { sets: 5, reps: 5, percent: 75, weight: null, rpe: null, drops: 0 },
    ]);
  });

  it("reads several groups, with a decimal comma inside one", () => {
    expect(parseScheme("1x1@90, 3x5@72,5").map((group) => group.percent)).toEqual([90, 72.5]);
  });

  it("reads a fixed weight and an RPE", () => {
    expect(parseScheme("4x8@60kg")[0]).toMatchObject({ weight: 60, percent: null });
    expect(parseScheme("3x3@85 rpe8")[0]).toMatchObject({ percent: 85, rpe: 8 });
  });

  it("reads an RPE without any load, and the drop sets after a set", () => {
    expect(parseScheme("1x8 rpe7, 2x10@60kg rpe9 drop2")).toEqual([
      { sets: 1, reps: 8, percent: null, weight: null, rpe: 7, drops: 0 },
      { sets: 2, reps: 10, percent: null, weight: 60, rpe: 9, drops: 2 },
    ]);
  });

  it("is empty for an empty scheme and null for nonsense or out-of-range values", () => {
    expect(parseScheme("  ")).toEqual([]);
    expect(parseScheme("five by five")).toBeNull();
    expect(parseScheme("0x5")).toBeNull();
    expect(parseScheme("5x5@130")).toBeNull();
    expect(parseScheme("1x8 drop4")).toBeNull();
    expect(isValidScheme("5x5@75")).toBe(true);
    expect(isValidScheme("5x5@130")).toBe(false);
  });
});

describe("schemeToSets and setsToScheme", () => {
  it("give one entry per set, and alike sets in a row back as one group", () => {
    const sets = schemeToSets("1x8 rpe7, 2x8 rpe4");
    expect(sets).toEqual([
      { reps: 8, percent: null, weight: null, rpe: 7, drops: 0 },
      { reps: 8, percent: null, weight: null, rpe: 4, drops: 0 },
      { reps: 8, percent: null, weight: null, rpe: 4, drops: 0 },
    ]);
    expect(setsToScheme(sets)).toBe("1x8 rpe7, 2x8 rpe4");
  });

  it("write a percentage with its sign, a weight in kg, decimals with a point, and drops", () => {
    expect(setsToScheme(schemeToSets("5x5@75"))).toBe("5x5@75%");
    expect(setsToScheme(schemeToSets("2x5@72,5 rpe8,5"))).toBe("2x5@72.5% rpe8.5");
    expect(setsToScheme(schemeToSets("3x10@60kg, 1x10@60kg rpe9 drop2"))).toBe(
      "3x10@60kg, 1x10@60kg rpe9 drop2",
    );
    expect(setsToScheme([])).toBe("");
  });

  it("are null for a scheme that can't be read", () => {
    expect(schemeToSets("five by five")).toBeNull();
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

  it("puts each set's drop sets after it, every one 20 % lighter", () => {
    // 60 → 48 → 47.5 after rounding; 47.5 → 38 → 37.5.
    const { sets } = buildProgramSets(parseScheme("2x10@60kg drop2"), null, 100);
    expect(sets).toEqual([
      { weight: 60, reps: 10, rpe: null },
      { weight: 47.5, reps: 10, rpe: null, isDrop: true },
      { weight: 37.5, reps: 10, rpe: null, isDrop: true },
      { weight: 60, reps: 10, rpe: null },
      { weight: 47.5, reps: 10, rpe: null, isDrop: true },
      { weight: 37.5, reps: 10, rpe: null, isDrop: true },
    ]);
  });

  it("leaves drop sets of a set without a weight at 0 kg", () => {
    const { sets } = buildProgramSets(parseScheme("1x8 rpe9 drop1"), null, 100);
    expect(sets).toEqual([
      { weight: 0, reps: 8, rpe: 9 },
      { weight: 0, reps: 8, rpe: null, isDrop: true },
    ]);
  });
});
