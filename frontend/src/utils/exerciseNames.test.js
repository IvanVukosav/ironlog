import { describe, expect, it } from "vitest";
import { isSameExerciseName } from "./exerciseNames";

describe("isSameExerciseName", () => {
  it("ignores case and surrounding spaces", () => {
    expect(isSameExerciseName("Bench ", " bench")).toBe(true);
  });

  it("still tells different exercises apart", () => {
    expect(isSameExerciseName("Bench", "Bench press")).toBe(false);
  });
});
