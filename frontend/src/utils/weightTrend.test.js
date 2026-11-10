import { describe, expect, it } from "vitest";
import { addWeightTrend, weeklyTrendChange } from "./weightTrend";

describe("addWeightTrend", () => {
  it("starts at the first weigh-in and absorbs 10 % of each day's difference", () => {
    const entries = addWeightTrend([
      { date: "2026-11-02", weight: 81 },
      { date: "2026-11-01", weight: 80 },
    ]);
    expect(entries.map((entry) => entry.trend)).toEqual([80, 80.1]);
  });

  it("moves further after a gap of several days", () => {
    const [, afterAWeek] = addWeightTrend([
      { date: "2026-11-01", weight: 80 },
      { date: "2026-11-08", weight: 81 },
    ]);
    // 1 - 0.9^7 of the difference.
    expect(afterAWeek.trend).toBeCloseTo(80.52, 2);
  });
});

describe("weeklyTrendChange", () => {
  it("compares the latest trend with the last one at least a week older", () => {
    const entries = [
      { date: "2026-11-01", trend: 82 },
      { date: "2026-11-03", trend: 81.8 },
      { date: "2026-11-09", trend: 81.5 },
    ];
    expect(weeklyTrendChange(entries)).toBeCloseTo(-0.5);
  });

  it("is null without a week of data", () => {
    expect(
      weeklyTrendChange([
        { date: "2026-11-08", trend: 81 },
        { date: "2026-11-09", trend: 80.9 },
      ]),
    ).toBeNull();
    expect(weeklyTrendChange([])).toBeNull();
  });
});
