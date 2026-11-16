import { describe, expect, it } from "vitest";
import {
  AUTO_CLOSE_AFTER_MS,
  countSets,
  findNextSet,
  formatClock,
  lastActivity,
  shouldAutoClose,
  splitDuration,
  summarizeWorkout,
} from "./activeWorkout";

const set = (id, weight, reps, extra = {}) => ({
  id,
  weight,
  reps,
  rpe: null,
  isWarmup: false,
  isDone: true,
  completedAt: null,
  ...extra,
});

const workout = (exercises, extra = {}) => ({
  id: 7,
  date: "2026-11-16T00:00:00.000Z",
  startedAt: null,
  finishedAt: null,
  exercises,
  ...extra,
});

describe("findNextSet", () => {
  it("is the first set not done yet, in exercise order", () => {
    const squat = {
      id: 1,
      name: "Čučanj",
      sets: [set(1, 140, 5), set(2, 140, 5, { isDone: false })],
    };
    const bench = { id: 2, name: "Bench", sets: [set(3, 100, 5, { isDone: false })] };
    expect(findNextSet(workout([squat, bench]))).toEqual({ exercise: squat, set: squat.sets[1] });
  });

  it("is null once everything is done", () => {
    expect(findNextSet(workout([{ id: 1, name: "Čučanj", sets: [set(1, 140, 5)] }]))).toBeNull();
    expect(findNextSet(workout([]))).toBeNull();
  });
});

describe("countSets", () => {
  it("counts the done sets and the plan", () => {
    const sets = [
      set(1, 60, 5, { isWarmup: true }),
      set(2, 140, 5),
      set(3, 140, 5, { isDone: false }),
    ];
    expect(countSets(workout([{ id: 1, name: "Čučanj", sets }]))).toEqual({
      done: 2,
      total: 3,
      planned: 1,
    });
  });
});

describe("lastActivity and shouldAutoClose", () => {
  const startedAt = "2026-11-16T17:00:00.000Z";
  const lastSetAt = "2026-11-16T18:10:00.000Z";
  const trained = workout(
    [
      {
        id: 1,
        name: "Čučanj",
        sets: [
          set(1, 140, 5, { completedAt: "2026-11-16T17:20:00.000Z" }),
          set(2, 140, 5, { completedAt: lastSetAt }),
          set(3, 140, 5, { isDone: false }),
        ],
      },
    ],
    { startedAt },
  );

  it("takes the latest done set, or the start", () => {
    expect(lastActivity(trained)).toBe(Date.parse(lastSetAt));
    expect(lastActivity(workout([], { startedAt }))).toBe(Date.parse(startedAt));
    expect(lastActivity(workout([]))).toBeNull();
  });

  it("closes a started workout left alone for hours, and nothing else", () => {
    const last = Date.parse(lastSetAt);
    expect(shouldAutoClose(trained, last + AUTO_CLOSE_AFTER_MS + 1)).toBe(true);
    expect(shouldAutoClose(trained, last + AUTO_CLOSE_AFTER_MS - 1)).toBe(false);
    expect(shouldAutoClose({ ...trained, startedAt: null }, last + 2 * AUTO_CLOSE_AFTER_MS)).toBe(
      false,
    );
    expect(
      shouldAutoClose({ ...trained, finishedAt: lastSetAt }, last + 2 * AUTO_CLOSE_AFTER_MS),
    ).toBe(false);
  });
});

describe("formatClock and splitDuration", () => {
  it("write minutes and seconds, and hours once there are any", () => {
    expect(formatClock(0)).toBe("0:00");
    expect(formatClock((38 * 60 + 12) * 1000)).toBe("38:12");
    expect(formatClock((64 * 60 + 30) * 1000 + 999)).toBe("1:04:30");
    expect(formatClock(-5000)).toBe("0:00");
  });

  it("round a duration to whole minutes", () => {
    expect(splitDuration(64.5 * 60 * 1000)).toEqual({ hours: 1, minutes: 5 });
    expect(splitDuration(38 * 60 * 1000 + 20 * 1000)).toEqual({ hours: 0, minutes: 38 });
  });
});

describe("summarizeWorkout", () => {
  const squat = {
    id: 1,
    name: "Čučanj",
    sets: [
      set(1, 60, 5, { isWarmup: true }),
      set(2, 140, 5, { rpe: 8 }),
      set(3, 140, 5),
      set(4, 140, 5, { isDone: false }),
    ],
  };
  const bench = { id: 2, name: "Bench press", sets: [set(5, 100, 5)] };
  const rows = { id: 3, name: "Veslanje", sets: [set(6, 60, 10)] };
  const earlier = [
    // 150 × 4 is an e1RM of 163,6 by Brzycki and this workout's 140 × 5 @ 8 is 168. The second
    // set is this workout's own, which does not count as earlier.
    {
      name: "Čučanj",
      sets: [
        { ...set(10, 150, 4), workoutId: 2 },
        { ...set(2, 140, 5, { rpe: 8 }), workoutId: 7 },
      ],
    },
    // e1RM 112.5 by Brzycki, the same as this workout's best: no record.
    { name: "Bench press", sets: [{ ...set(11, 100, 5), workoutId: 3 }] },
  ];

  it("counts the done working sets and their weight, and the plan left undone", () => {
    const summary = summarizeWorkout(workout([squat, bench, rows]), earlier, "brzycki");
    expect(summary.workingSets).toBe(4);
    expect(summary.volume).toBe(140 * 5 * 2 + 100 * 5 + 60 * 10);
    expect(summary.plannedLeft).toBe(1);
  });

  it("names the exercises that beat their earlier best, by how much", () => {
    const { records } = summarizeWorkout(workout([squat, bench, rows]), earlier, "brzycki");
    expect(records.map((record) => record.name)).toEqual(["Čučanj"]);
    expect(records[0].e1rm).toBeCloseTo(168, 5);
    expect(records[0].gain).toBeCloseTo(168 - (150 * 36) / 33, 5);
  });
});
