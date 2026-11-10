import { describe, expect, it } from "vitest";
import { calculateDots, calculateWilks, findMainLiftBests } from "./strengthScores";

const single = (weight) => ({ weight, reps: 1, rpe: 10, date: "2026-11-01T00:00:00.000Z" });

describe("DOTS and Wilks", () => {
  it("match the published formulas for a 700 kg total at 82.5 kg", () => {
    expect(calculateDots(700, 82.5, "male")).toBeCloseTo(474.17, 1);
    expect(calculateWilks(700, 82.5, "male")).toBeCloseTo(468.93, 1);
  });

  it("score the same total higher for women", () => {
    expect(calculateDots(500, 80, "female")).toBeGreaterThan(calculateDots(500, 80, "male"));
  });
});

describe("findMainLiftBests", () => {
  const exercises = [
    { name: "Front squat", sets: [single(120)] },
    { name: "Back squat", sets: [single(180)] },
    { name: "Bench press", sets: [single(130)] },
    { name: "Mrtvo dizanje", sets: [single(200)] },
  ];

  it("recognises the lifts by name and takes the strongest match", () => {
    const bests = findMainLiftBests(exercises, null, "brzycki");
    expect([bests.squat.name, bests.bench.name, bests.deadlift.name]).toEqual([
      "Back squat",
      "Bench press",
      "Mrtvo dizanje",
    ]);
  });

  it("uses a pick from Settings, ignoring case and stray spaces", () => {
    const bests = findMainLiftBests(exercises, { squatExercise: " front SQUAT" }, "brzycki");
    expect(bests.squat.name).toBe("Front squat");
  });

  it("has no lift when nothing matches", () => {
    expect(
      findMainLiftBests([{ name: "Plank", sets: [single(20)] }], null, "brzycki").squat,
    ).toBeNull();
  });
});
