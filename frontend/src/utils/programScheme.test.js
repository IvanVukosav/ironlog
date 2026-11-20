import { describe, expect, it } from "vitest";
import {
  backoffWeight,
  buildProgramSets,
  dropWeights,
  isValidScheme,
  parseScheme,
  plannedWeight,
  plannedWeights,
  schemeToSets,
  setsToScheme,
  topSetIndex,
} from "./programScheme";

describe("parseScheme", () => {
  it("reads sets, reps and a percentage", () => {
    expect(parseScheme("5x5@75")).toEqual([
      { sets: 5, reps: 5, percent: 75, weight: null, backoff: null, rpe: null, drops: 0 },
    ]);
  });

  it("reads back-off sets: a minus before the percentage", () => {
    expect(parseScheme("1x1 rpe8, 5x5@-20%")).toEqual([
      { sets: 1, reps: 1, percent: null, weight: null, backoff: null, rpe: 8, drops: 0 },
      { sets: 5, reps: 5, percent: null, weight: null, backoff: 20, rpe: null, drops: 0 },
    ]);
    expect(parseScheme("3x5 @ −12,5 %")[0].backoff).toBe(12.5);
    expect(parseScheme("3x5@-10% drop1")[0]).toMatchObject({ backoff: 10, drops: 1 });
    // Not in kg, and not lighter than nothing or by more than 90 %.
    expect(parseScheme("5x5@-20kg")).toBeNull();
    expect(parseScheme("5x5@-0%")).toBeNull();
    expect(parseScheme("5x5@-95%")).toBeNull();
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
      { sets: 1, reps: 8, percent: null, weight: null, backoff: null, rpe: 7, drops: 0 },
      { sets: 2, reps: 10, percent: null, weight: 60, backoff: null, rpe: 9, drops: 2 },
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
      { reps: 8, percent: null, weight: null, backoff: null, rpe: 7, drops: 0 },
      { reps: 8, percent: null, weight: null, backoff: null, rpe: 4, drops: 0 },
      { reps: 8, percent: null, weight: null, backoff: null, rpe: 4, drops: 0 },
    ]);
    expect(setsToScheme(sets)).toBe("1x8 rpe7, 2x8 rpe4");
  });

  it("write a back-off with its minus, and keep it a group of its own", () => {
    expect(setsToScheme(schemeToSets("1x1 rpe8, 5x5@-20%"))).toBe("1x1 rpe8, 5x5@-20%");
    expect(setsToScheme(schemeToSets("1x3@85%, 1x3@-12,5%, 1x3@-12,5% drop1"))).toBe(
      "1x3@85%, 1x3@-12.5%, 1x3@-12.5% drop1",
    );
    // A set made in the editor before back-off sets existed has no `backoff` at all.
    expect(setsToScheme([{ reps: 5, percent: null, weight: null, rpe: 8, drops: 0 }])).toBe(
      "1x5 rpe8",
    );
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

describe("dropWeights", () => {
  it("takes 20 % off each drop set, rounded to 2,5 kg", () => {
    expect(dropWeights(75, 2)).toEqual([60, 47.5]);
    expect(dropWeights(100, 0)).toEqual([]);
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

  it("gives an RPE set its weight from the chart, a share of the e1RM itself", () => {
    // 8 @ RPE 7 is 70.7 % (11 reps to failure): 120 × 0.707 = 84.8, rounded to 85.
    const { sets, missingE1rm } = buildProgramSets(parseScheme("1x8 rpe7"), 120, 90);
    expect(sets).toEqual([{ weight: 85, reps: 8, rpe: 7 }]);
    expect(missingE1rm).toBe(false);
  });

  it("gives back-off sets their weight from the top set before them, and keeps their percentage", () => {
    // 1 @ RPE 8 is 92,2 % of 180: 166, rounded to 165; 20 % off that is 132, rounded to 132,5.
    const { sets } = buildProgramSets(parseScheme("1x1 rpe8, 2x5@-20%"), 180, 100);
    expect(sets).toEqual([
      { weight: 165, reps: 1, rpe: 8 },
      { weight: 132.5, reps: 5, rpe: null, backoffPercent: 20 },
      { weight: 132.5, reps: 5, rpe: null, backoffPercent: 20 },
    ]);
    // Without an e1RM the top set is picked on the day, and so is the back-off: 0 kg for now.
    const unknown = buildProgramSets(parseScheme("1x1 rpe8, 1x5@-20%"), null, 100);
    expect(unknown.sets.map((set) => set.weight)).toEqual([0, 0]);
    expect(unknown.missingE1rm).toBe(true);
    // A back-off's drop sets go on from its weight.
    const dropped = buildProgramSets(parseScheme("1x5@100kg, 1x5@-20% drop1"), null, 100).sets;
    expect(dropped.map((set) => set.weight)).toEqual([100, 80, 65]);
  });

  it("says the e1RM is missing for an RPE set the chart covers, and not for one it doesn't", () => {
    expect(buildProgramSets(parseScheme("1x8 rpe7"), null, 100).missingE1rm).toBe(true);
    expect(buildProgramSets(parseScheme("1x12 rpe7"), null, 100).missingE1rm).toBe(false);
    expect(buildProgramSets(parseScheme("1x12 rpe7"), 120, 100).sets[0].weight).toBe(0);
  });
});

describe("plannedWeight", () => {
  const set = (fields) => ({ reps: 5, percent: null, weight: null, rpe: null, ...fields });

  it("keeps a set's own weight, and works the others out from the e1RM", () => {
    expect(plannedWeight(set({ weight: 60, rpe: 9 }), 200, 90)).toBe(60);
    // 75 % of a training max of 90 % of 160 = 108, rounded to 107.5.
    expect(plannedWeight(set({ percent: 75 }), 160, 90)).toBe(107.5);
    // 5 @ RPE 8 is 81.1 %: 160 × 0.811 = 129.8, rounded to 130.
    expect(plannedWeight(set({ rpe: 8 }), 160, 90)).toBe(130);
  });

  it("is null when the weight is left to the day", () => {
    expect(plannedWeight(set({ rpe: 8 }), null, 100)).toBeNull();
    expect(plannedWeight(set({}), 160, 100)).toBeNull();
    expect(plannedWeight(set({ reps: 15, rpe: 8 }), 160, 100)).toBeNull();
  });
});

describe("back-off sets", () => {
  const set = (fields) => ({
    reps: 5,
    percent: null,
    weight: null,
    backoff: null,
    rpe: null,
    drops: 0,
    ...fields,
  });

  it("take their weight from the top set before them: the last set that isn't a back-off", () => {
    const sets = [
      set({ reps: 1, rpe: 8 }),
      set({ backoff: 20 }),
      set({ backoff: 20 }),
      set({ weight: 100 }),
      set({ backoff: 10 }),
    ];
    expect(plannedWeights(sets, 180, 100)).toEqual([165, 132.5, 132.5, 100, 90]);
    expect([1, 2, 4].map((index) => topSetIndex(sets, index))).toEqual([0, 0, 3]);
  });

  it("have no weight without a top set, or without a weight for it", () => {
    // 5 @ RPE 8 is 81,1 % of 180: 146, rounded to 145.
    expect(plannedWeights([set({ backoff: 20 }), set({ rpe: 8 })], 180, 100)).toEqual([null, 145]);
    expect(topSetIndex([set({ backoff: 20 })], 0)).toBe(-1);
    expect(plannedWeights([set({ rpe: 8 }), set({ backoff: 20 })], null, 100)).toEqual([
      null,
      null,
    ]);
  });

  it("are rounded to 2,5 kg like every planned weight", () => {
    expect(backoffWeight(170, 20)).toBe(135);
    expect(backoffWeight(165, 20)).toBe(132.5);
    expect(backoffWeight(100, 12.5)).toBe(87.5);
  });
});
