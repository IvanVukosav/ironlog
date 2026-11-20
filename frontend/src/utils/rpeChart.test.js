import { describe, expect, it } from "vitest";
import { percentAtRepsToFailure, percentForRpe, rpeForPercent } from "./rpeChart";

describe("percentForRpe", () => {
  it("reads the chart by reps and RPE", () => {
    expect(percentForRpe(1, 10)).toBe(100);
    expect(percentForRpe(5, 8)).toBeCloseTo(81.1);
    expect(percentForRpe(8, 7)).toBeCloseTo(70.7);
    expect(percentForRpe(10, 6)).toBeCloseTo(62.6);
    expect(percentForRpe(3, 9.5)).toBeCloseTo(90.7);
  });

  it("gives the same share for the same reps to failure, so 8 @ RPE 4 is 10 @ RPE 6", () => {
    expect(percentForRpe(7, 10)).toBeCloseTo(percentForRpe(5, 8));
    expect(percentForRpe(8, 4)).toBeCloseTo(62.6);
    expect(percentForRpe(12, 10)).toBeCloseTo(68.0);
  });

  it("counts a set without an RPE as RPE 10, and reads between the half steps", () => {
    expect(percentForRpe(5, null)).toBeCloseTo(86.3);
    expect(percentAtRepsToFailure(1.25)).toBeCloseTo(98.9);
  });

  it("has nothing below one rep to failure or past fourteen", () => {
    expect(percentAtRepsToFailure(0.5)).toBeNull();
    expect(percentForRpe(12, 7)).toBeNull();
    expect(percentForRpe(15, 10)).toBeNull();
  });
});

describe("rpeForPercent", () => {
  it("reads the chart the other way, to the half RPE", () => {
    expect(rpeForPercent(5, 81.1)).toBe(8);
    expect(rpeForPercent(8, 70.7)).toBe(7);
    expect(rpeForPercent(5, 80)).toBe(7.5);
  });

  it("is null for a share the reps can't be done at, or lighter than the chart goes", () => {
    expect(rpeForPercent(5, 95)).toBeNull();
    expect(rpeForPercent(10, 40)).toBeNull();
  });
});
