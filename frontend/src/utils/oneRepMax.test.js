import { describe, expect, it } from "vitest";
import {
  buildE1rmTimeline,
  calculateEstimatedOneRepMax,
  calculateOneRepMax,
  E1RM_FORMULAS,
  findBestSetByE1rm,
  formulaMaxReps,
  isRoughEstimate,
  repsToFailure,
} from "./oneRepMax";

const day = (date) => `${date}T00:00:00.000Z`;

describe("E1RM_FORMULAS", () => {
  it("gives every formula a label and an estimate", () => {
    for (const formula of Object.values(E1RM_FORMULAS)) {
      expect(formula.label).toEqual(expect.any(String));
      expect(formula.estimate(100, 5)).toBeGreaterThan(100);
    }
  });

  it("falls back to Brzycki for an unknown formula", () => {
    expect(calculateOneRepMax(100, 5, "made-up")).toBeCloseTo(
      calculateOneRepMax(100, 5, "brzycki"),
    );
  });
});

describe("calculateEstimatedOneRepMax", () => {
  it("counts the reps left in reserve from RPE", () => {
    // 5 reps @ RPE 8 = 7 reps to failure.
    expect(calculateEstimatedOneRepMax(100, 5, 8, "brzycki")).toBeCloseTo((100 * 36) / 30);
  });

  it("treats a set without RPE as RPE 10", () => {
    expect(calculateEstimatedOneRepMax(100, 5, null, "brzycki")).toBeCloseTo((100 * 36) / 32);
  });

  it("supports Epley and Lombardi", () => {
    expect(calculateEstimatedOneRepMax(100, 10, 10, "epley")).toBeCloseTo(100 * (1 + 10 / 30));
    expect(calculateEstimatedOneRepMax(100, 10, 10, "lombardi")).toBeCloseTo(100 * 10 ** 0.1);
  });

  it("goes past 15 reps to failure, as far as the formula itself goes", () => {
    expect(calculateEstimatedOneRepMax(100, 15, 10, "brzycki")).toBeCloseTo((100 * 36) / 22);
    expect(calculateEstimatedOneRepMax(100, 16, 10, "brzycki")).toBeCloseTo((100 * 36) / 21);
    // 12 reps @ RPE 5 = 17 reps to failure.
    expect(calculateEstimatedOneRepMax(100, 12, 5, "brzycki")).toBeCloseTo((100 * 36) / 20);
    expect(calculateEstimatedOneRepMax(100, 36, null, "brzycki")).toBeCloseTo(3600);
    // Brzycki divides by zero at 37 and turns negative past it (here 40); Epley has no end.
    expect(calculateEstimatedOneRepMax(100, 37, null, "brzycki")).toBeNull();
    expect(calculateEstimatedOneRepMax(333, 33, 3, "brzycki")).toBeNull();
    expect(calculateEstimatedOneRepMax(100, 50, null, "epley")).toBeCloseTo(100 * (1 + 50 / 30));
  });

  it("has no estimate below one rep to failure", () => {
    expect(calculateEstimatedOneRepMax(100, 0, 10, "brzycki")).toBeNull();
    expect(calculateEstimatedOneRepMax(100, 1, 11, "lombardi")).toBeNull();
  });
});

describe("repsToFailure", () => {
  it("adds the reps the RPE leaves in reserve, and none without an RPE", () => {
    expect(repsToFailure(5, 8)).toBe(7);
    expect(repsToFailure(6, 7.5)).toBe(8.5);
    expect(repsToFailure(5, null)).toBe(5);
  });
});

describe("isRoughEstimate", () => {
  it("is rough past 15 reps to failure, the RPE's reserve counted", () => {
    expect(isRoughEstimate(15, null)).toBe(false);
    expect(isRoughEstimate(16, null)).toBe(true);
    expect(isRoughEstimate(14, 8)).toBe(true);
    expect(isRoughEstimate(5, 8)).toBe(false);
  });
});

describe("formulaMaxReps", () => {
  it("is Brzycki's 36, and no end for the others", () => {
    expect(formulaMaxReps("brzycki")).toBe(36);
    expect(formulaMaxReps("epley")).toBe(Infinity);
    expect(formulaMaxReps("made-up")).toBe(36);
  });
});

describe("findBestSetByE1rm", () => {
  it("picks the set with the highest e1RM, skipping warm-ups and sets without one", () => {
    const best = findBestSetByE1rm(
      [
        { weight: 140, reps: 3, rpe: 10, isWarmup: true },
        { weight: 333, reps: 33, rpe: 3 },
        { weight: 100, reps: 5, rpe: 8 },
        { weight: 90, reps: 5, rpe: 8 },
      ],
      "brzycki",
    );
    expect(best.weight).toBe(100);
    expect(best.e1rm).toBeCloseTo(120);
  });

  it("returns null when no set qualifies", () => {
    expect(
      findBestSetByE1rm([{ weight: 60, reps: 5, rpe: 5, isWarmup: true }], "brzycki"),
    ).toBeNull();
    expect(findBestSetByE1rm([], "brzycki")).toBeNull();
  });
});

describe("buildE1rmTimeline", () => {
  it("keeps the best e1RM per day, oldest first, and flags days that beat every earlier one", () => {
    const timeline = buildE1rmTimeline(
      [
        { weight: 110, reps: 1, rpe: 10, date: day("2026-11-03") },
        { weight: 100, reps: 1, rpe: 10, date: day("2026-11-01") },
        { weight: 105, reps: 1, rpe: 10, date: day("2026-11-01") },
        { weight: 104, reps: 1, rpe: 10, date: day("2026-11-02") },
      ],
      "brzycki",
    );
    expect(timeline.map((point) => point.e1rm)).toEqual([105, 104, 110]);
    // The first day is the baseline, not a PR.
    expect(timeline.map((point) => point.isPr)).toEqual([false, false, true]);
  });
});
