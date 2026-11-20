import { describe, expect, it } from "vitest";
import { backoffUpdates } from "./backoffSets";

// A set as Trening holds it.
const set = (id, weight, fields = {}) => ({
  id,
  weight,
  reps: 5,
  rpe: null,
  isWarmup: false,
  isDrop: false,
  isDone: false,
  backoffPercent: null,
  ...fields,
});

describe("back-off sets in Trening", () => {
  // 12 Week Strength, week 2: 1 @ 8 planned at 165, then 20 % off for the back-off sets.
  const day = (topWeight) => [
    set(1, 40, { isWarmup: true, isDone: true }),
    set(2, topWeight, { reps: 1, rpe: 8, isDone: true }),
    set(3, 132.5, { backoffPercent: 20 }),
    set(4, 132.5, { backoffPercent: 20 }),
    set(5, 132.5, { backoffPercent: 20 }),
  ];

  it("follow the weight the top set was really done with", () => {
    expect(backoffUpdates(day(170), 2)).toEqual([
      { id: 3, weight: 135 },
      { id: 4, weight: 135 },
      { id: 5, weight: 135 },
    ]);
  });

  it("change nothing when the top set went as planned", () => {
    expect(backoffUpdates(day(165), 2)).toEqual([]);
  });

  it("leave a back-off set already done, and run until the next set that isn't one", () => {
    const sets = [
      set(1, 170, { reps: 1, isDone: true }),
      set(2, 132.5, { backoffPercent: 20, isDone: true }),
      set(3, 132.5, { backoffPercent: 20 }),
      set(4, 100),
      set(5, 90, { backoffPercent: 10 }),
    ];
    expect(backoffUpdates(sets, 1)).toEqual([{ id: 3, weight: 135 }]);
  });

  it("take a back-off set's drop sets along, but not the top set's own", () => {
    const sets = [
      set(1, 100, { isDone: true }),
      set(2, 80, { isDrop: true }),
      set(3, 80, { backoffPercent: 10 }),
      set(4, 65, { isDrop: true }),
    ];
    // 100 − 10 % = 90, and its drop set 20 % lighter: 72, rounded to 72,5.
    expect(backoffUpdates(sets, 1)).toEqual([
      { id: 3, weight: 90 },
      { id: 4, weight: 72.5 },
    ]);
  });

  it("start only from a working set with a weight that isn't a back-off itself", () => {
    expect(backoffUpdates(day(170), 1)).toEqual([]);
    expect(backoffUpdates(day(170), 3)).toEqual([]);
    expect(backoffUpdates(day(0), 2)).toEqual([]);
    expect(backoffUpdates(day(170), 99)).toEqual([]);
  });
});
