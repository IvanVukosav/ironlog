import { describe, expect, it } from "vitest";
import {
  parseFeaturedExercises,
  resolveFeaturedExercises,
  summarizeExercise,
} from "./featuredExercises";

const NOW = Date.UTC(2026, 10, 10);
const daysAgo = (days) => new Date(NOW - days * 864e5).toISOString();
// A single at RPE 10 has an e1RM equal to its weight (Brzycki: 36 / 36).
const single = (weight, days) => ({ weight, reps: 1, rpe: 10, date: daysAgo(days) });

describe("parseFeaturedExercises", () => {
  it("reads the saved list of names", () => {
    expect(parseFeaturedExercises({ featuredExercises: '["Bench","Squat"]' })).toEqual([
      "Bench",
      "Squat",
    ]);
  });

  it("treats anything unreadable as no names", () => {
    expect(parseFeaturedExercises(null)).toEqual([]);
    expect(parseFeaturedExercises({ featuredExercises: "[oops" })).toEqual([]);
    expect(parseFeaturedExercises({ featuredExercises: '{"a":1}' })).toEqual([]);
    expect(parseFeaturedExercises({ featuredExercises: '[1,"Bench",null]' })).toEqual(["Bench"]);
  });
});

describe("summarizeExercise", () => {
  it("measures the gain as the best now minus the best before the last 30 days", () => {
    const summary = summarizeExercise(
      [single(100, 40), single(105, 35), single(110, 5)],
      "brzycki",
      NOW,
    );
    expect(summary).toEqual({ best: 110, change: 5, trend: [100, 105, 110] });
  });

  it("has no change for an exercise newer than 30 days", () => {
    expect(
      summarizeExercise([single(100, 10), single(102.5, 3)], "brzycki", NOW).change,
    ).toBeNull();
  });

  it("reports zero when there was no improvement", () => {
    expect(summarizeExercise([single(110, 50), single(105, 5)], "brzycki", NOW).change).toBe(0);
  });

  it("keeps the last 12 sessions for the trend line", () => {
    const sets = Array.from({ length: 15 }, (_, index) => single(100 + index, 15 - index));
    expect(summarizeExercise(sets, "brzycki", NOW).trend).toHaveLength(12);
  });

  it("is null when no set has an e1RM", () => {
    expect(
      summarizeExercise([{ weight: 50, reps: 30, rpe: 10, date: daysAgo(1) }], "brzycki", NOW),
    ).toBeNull();
  });
});

describe("resolveFeaturedExercises", () => {
  const exercises = [
    { name: "Row", sets: [single(80, 1), single(80, 2)] },
    { name: "Bench", sets: [single(100, 1), single(100, 2), single(100, 3)] },
    { name: "Squat", sets: [single(140, 1), single(140, 2), single(140, 3)] },
    { name: "Curl", sets: [single(30, 1)] },
    // Four sessions, but 60 reps never give an e1RM, so it can't be featured automatically.
    {
      name: "Plank",
      sets: [1, 2, 3, 4].map((days) => ({ weight: 0, reps: 60, rpe: 10, date: daysAgo(days) })),
    },
  ];

  it("picks the most trained exercises with an e1RM when nothing is saved", () => {
    expect(resolveFeaturedExercises(exercises, [], "brzycki")).toEqual({
      names: ["Bench", "Squat", "Row"],
      isAuto: true,
    });
  });

  it("keeps the saved names that still exist, in their order, as the logged spelling", () => {
    expect(
      resolveFeaturedExercises(exercises, ["curl ", "Deleted", "Bench", "bench"], "brzycki"),
    ).toEqual({
      names: ["Curl", "Bench"],
      isAuto: false,
    });
  });

  it("falls back to automatic when every saved name is gone", () => {
    expect(resolveFeaturedExercises(exercises, ["Deleted"], "brzycki").isAuto).toBe(true);
  });
});
