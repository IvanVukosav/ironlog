import { describe, expect, it } from "vitest";
import { buildWarmupSets, calculatePlates, DEFAULT_PLATE_SETUP } from "./plates";

const onlyPlates = (availablePlates) => ({ ...DEFAULT_PLATE_SETUP, availablePlates });

describe("calculatePlates", () => {
  it("loads the exact weight with the fewest plates, heaviest first", () => {
    expect(calculatePlates(142.5, DEFAULT_PLATE_SETUP)).toEqual({
      platesPerSide: [25, 25, 10, 1.25],
      loadedKg: 142.5,
      remainderKg: 0,
    });
  });

  it("finds exact loads that biggest-plate-first would miss", () => {
    // 40 kg a side from 25s and 20s is 20 + 20, not 25 + something.
    expect(calculatePlates(100, onlyPlates([25, 20])).platesPerSide).toEqual([20, 20]);
  });

  it("gets as close as it can below the target and reports the rest", () => {
    expect(calculatePlates(72.5, onlyPlates([25, 20]))).toEqual({
      platesPerSide: [25],
      loadedKg: 70,
      remainderKg: 2.5,
    });
  });

  it("returns null below the empty bar (collars included)", () => {
    expect(calculatePlates(15, DEFAULT_PLATE_SETUP)).toBeNull();
    expect(calculatePlates(24, { ...DEFAULT_PLATE_SETUP, useCollars: true })).toBeNull();
  });
});

describe("buildWarmupSets", () => {
  it("ramps from the empty bar through 40-90 %", () => {
    expect(buildWarmupSets(100, DEFAULT_PLATE_SETUP)).toEqual([
      { weight: 20, reps: 10, percent: null },
      { weight: 40, reps: 5, percent: 40 },
      { weight: 55, reps: 3, percent: 55 },
      { weight: 70, reps: 2, percent: 70 },
      { weight: 80, reps: 1, percent: 80 },
      { weight: 90, reps: 1, percent: 90 },
    ]);
  });

  it("needs a working weight above the empty bar", () => {
    expect(buildWarmupSets(20, DEFAULT_PLATE_SETUP)).toEqual([]);
  });
});
