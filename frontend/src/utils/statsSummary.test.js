import { describe, expect, it } from "vitest";
import { periodStart, summarizePeriod, volumeBuckets } from "./statsSummary";

const DAY = 24 * 60 * 60 * 1000;
// Thursday, 12 November 2026.
const TODAY = Date.UTC(2026, 10, 12);
const daysAgo = (days) => new Date(TODAY - days * DAY).toISOString();
// A single at RPE 10 has an e1RM equal to its weight (Brzycki: 36 / 36).
const single = (weight, days, extra = {}) => ({
  weight,
  reps: 1,
  rpe: 10,
  isWarmup: false,
  date: daysAgo(days),
  ...extra,
});
const set = (weight, reps, days, extra = {}) => ({
  weight,
  reps,
  rpe: null,
  isWarmup: false,
  date: daysAgo(days),
  ...extra,
});

describe("periodStart", () => {
  it("reaches back so that the period holds today and the days before it", () => {
    expect(periodStart(TODAY, 1)).toBe(TODAY);
    expect(periodStart(TODAY, 30)).toBe(TODAY - 29 * DAY);
  });
});

describe("summarizePeriod", () => {
  const since = periodStart(TODAY, 30);

  it("counts the days with sets in the period, not the sets", () => {
    const exercises = [
      { name: "Squat", sets: [single(100, 1), single(100, 1), single(100, 5), single(90, 40)] },
      { name: "Bench", sets: [single(80, 1), single(80, 10)] },
    ];
    expect(summarizePeriod(exercises, "brzycki", since).workouts).toBe(3);
  });

  it("adds up weight × reps of working sets in the period only", () => {
    const exercises = [
      {
        name: "Squat",
        sets: [set(100, 5, 1), set(60, 10, 1, { isWarmup: true }), set(100, 5, 40)],
      },
      { name: "Bench", sets: [set(80, 8, 2)] },
    ];
    expect(summarizePeriod(exercises, "brzycki", since).volume).toBe(500 + 640);
  });

  it("lists every session that beat the best so far, newest first, with its best set", () => {
    const exercises = [
      {
        name: "Squat",
        // 40 days ago sets the bar at 100; 20 days ago beats it, 10 days ago does not,
        // 2 days ago beats 105 with the heavier of its two sets.
        sets: [single(100, 40), single(105, 20), single(104, 10), single(106, 2), single(107.5, 2)],
      },
      { name: "Bench", sets: [single(80, 50), single(82.5, 5)] },
    ];
    const { records } = summarizePeriod(exercises, "brzycki", since);
    expect(records.map(({ name, e1rm }) => [name, e1rm])).toEqual([
      ["Squat", 107.5],
      ["Bench", 82.5],
      ["Squat", 105],
    ]);
    expect(records[0]).toMatchObject({ weight: 107.5, reps: 1, rpe: 10, date: TODAY - 2 * DAY });
  });

  it("does not call an exercise's first session a record, nor a tie", () => {
    const exercises = [
      { name: "Row", sets: [single(70, 3)] },
      { name: "Curl", sets: [single(30, 20), single(30, 5)] },
    ];
    expect(summarizePeriod(exercises, "brzycki", since).records).toEqual([]);
  });

  it("leaves out warm-ups and sets without an e1RM when it looks for records", () => {
    const exercises = [
      {
        name: "Squat",
        sets: [
          single(100, 20),
          single(140, 5, { isWarmup: true }),
          { weight: 50, reps: 30, rpe: 10, isWarmup: false, date: daysAgo(4) },
        ],
      },
    ];
    expect(summarizePeriod(exercises, "brzycki", since).records).toEqual([]);
  });

  it("is all zero without sets", () => {
    expect(summarizePeriod([], "brzycki", since)).toEqual({ workouts: 0, volume: 0, records: [] });
  });
});

describe("volumeBuckets", () => {
  it("splits 30 days into five weeks from Monday, the last one holding today", () => {
    const { unit, buckets } = volumeBuckets([], "30d", TODAY);
    expect(unit).toBe("week");
    expect(buckets.map((bucket) => new Date(bucket.start).toISOString().slice(0, 10))).toEqual([
      "2026-10-12",
      "2026-10-19",
      "2026-10-26",
      "2026-11-02",
      "2026-11-09",
    ]);
  });

  it("splits a year into twelve calendar months", () => {
    const { unit, buckets } = volumeBuckets([], "1y", TODAY);
    expect(unit).toBe("month");
    expect(buckets).toHaveLength(12);
    expect(new Date(buckets[0].start).toISOString().slice(0, 10)).toBe("2025-12-01");
    expect(new Date(buckets[11].start).toISOString().slice(0, 10)).toBe("2026-11-01");
  });

  it("puts each working set's volume in its week, Sunday with its own week", () => {
    const exercises = [
      {
        name: "Squat",
        sets: [
          set(100, 5, 0), // Thursday, this week
          set(100, 5, 3), // Monday, this week
          set(100, 5, 4), // Sunday, last week
          set(60, 10, 4, { isWarmup: true }),
          set(100, 5, 60), // before the first week
          set(100, 5, -7), // next week, after today's
        ],
      },
    ];
    const volumes = volumeBuckets(exercises, "30d", TODAY).buckets.map((bucket) => bucket.volume);
    expect(volumes).toEqual([0, 0, 0, 500, 1000]);
  });

  it("starts the week on Monday when today is a Sunday", () => {
    const sunday = Date.UTC(2026, 10, 15);
    const { buckets } = volumeBuckets([], "30d", sunday);
    expect(new Date(buckets.at(-1).start).toISOString().slice(0, 10)).toBe("2026-11-09");
  });
});
