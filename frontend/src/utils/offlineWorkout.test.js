import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  keepWorkout,
  keptWorkout,
  localExercise,
  localExerciseChange,
  localFinish,
  localProgramDay,
  localSet,
  localSetChange,
  localSets,
  localWorkout,
  localWorkoutChange,
  withCompletedAt,
} from "./offlineWorkout";

const NOW = "2026-11-20T17:04:00.000Z";
const set = (id, fields = {}) => ({
  id,
  weight: 100,
  reps: 5,
  rpe: 8,
  isWarmup: false,
  isDrop: false,
  isDone: true,
  completedAt: NOW,
  order: 0,
  exerciseId: 10,
  ...fields,
});
const bench = { id: 10, name: "Bench press", order: 0, sets: [set(1), set(2, { order: 1 })] };
const workout = { ...localWorkout("2026-11-20", 7), exercises: [bench] };

describe("a set worked out without a connection", () => {
  it("reads what was typed the way the server does", () => {
    expect(
      localSet(bench, { weight: "102,5", reps: "5", rpe: "", isWarmup: false }, -1, NOW),
    ).toEqual({
      id: -1,
      weight: 102.5,
      reps: 5,
      rpe: null,
      isWarmup: false,
      isDrop: false,
      isDone: true,
      completedAt: NOW,
      order: 2,
      exerciseId: 10,
    });
    const planned = localSet(bench, { weight: 60, reps: 10, rpe: 9, isDone: false }, -2, NOW);
    expect([planned.isDone, planned.completedAt, planned.rpe]).toEqual([false, null, 9]);
    expect(
      localSet(bench, { weight: 60, reps: 10, isWarmup: true, isDrop: true }, -3, NOW).isDrop,
    ).toBe(false);
  });

  it("is ticked off, with the moment, or back", () => {
    const planned = set(3, { isDone: false, completedAt: null });
    expect(localSetChange(planned, { isDone: true }, NOW)).toMatchObject({
      isDone: true,
      completedAt: NOW,
    });
    expect(localSetChange(set(3), { isDone: false }, NOW)).toMatchObject({
      isDone: false,
      completedAt: null,
    });
    expect(localSetChange(set(3), { weight: "105" }, "later")).toMatchObject({
      weight: 105,
      completedAt: NOW,
    });
  });

  it("goes in at the start or the end, all of the exercise's sets coming back in order", () => {
    const start = localSets(bench, [{ weight: 40, reps: 8, isWarmup: true }], "start", [-4], NOW);
    expect(start.map((s) => [s.id, s.order])).toEqual([
      [-4, 0],
      [1, 1],
      [2, 2],
    ]);
    const end = localSets(
      bench,
      [
        { weight: 80, reps: 8 },
        { weight: 60, reps: 8 },
      ],
      "end",
      [-5, -6],
      NOW,
    );
    expect(end.map((s) => s.id)).toEqual([1, 2, -5, -6]);
  });

  it("is saved later with the moment it was done", () => {
    expect(withCompletedAt({ weight: 100, reps: 5 }, NOW)).toEqual({
      weight: 100,
      reps: 5,
      completedAt: NOW,
    });
    expect(withCompletedAt({ weight: 100, reps: 5, isDone: false }, NOW)).toEqual({
      weight: 100,
      reps: 5,
      isDone: false,
    });
  });
});

describe("a workout worked out without a connection", () => {
  it("is made, named and noted like the server does it", () => {
    expect(localWorkout("2026-11-20", -1)).toMatchObject({
      id: -1,
      date: "2026-11-20T00:00:00.000Z",
      startedAt: null,
      exercises: [],
    });
    expect(localWorkoutChange(workout, { name: "  Push dan " })).toMatchObject({
      id: 7,
      name: "Push dan",
    });
    expect("exercises" in localWorkoutChange(workout, { notes: "" })).toBe(false);
    expect(localExercise(workout, " Čučanj ", -2)).toMatchObject({
      id: -2,
      name: "Čučanj",
      order: 1,
      workoutId: 7,
      sets: [],
    });
    expect(localExerciseChange(bench, { supersetGroup: " A " })).toMatchObject({
      id: 10,
      supersetGroup: "A",
    });
  });

  it("finishes without the sets never done, and without an exercise they leave empty", () => {
    const plan = { id: 11, name: "Čučanj", sets: [set(5, { isDone: false, exerciseId: 11 })] };
    const half = { ...bench, sets: [set(1), set(2, { isDone: false })] };
    const empty = { id: 12, name: "Zgibovi", sets: [] };
    const finished = localFinish({ ...workout, exercises: [half, plan, empty] }, NOW);
    expect(finished.finishedAt).toBe(NOW);
    expect(finished.exercises.map((e) => [e.name, e.sets.map((s) => s.id)])).toEqual([
      ["Bench press", [1]],
      ["Zgibovi", []],
    ]);
  });

  it("takes a program day like the server: sets for an exercise already there go at its end", () => {
    let next = 0;
    const newId = () => --next;
    const day = [
      {
        name: "bench press",
        supersetGroup: "A",
        sets: [{ weight: 80, reps: 8, rpe: 8, isDone: false }],
      },
      {
        name: "Čučanj",
        supersetGroup: "A",
        sets: [
          { weight: 120, reps: 5, isDone: false },
          { weight: 120, reps: 5, isDone: false },
        ],
      },
    ];
    const { answer, creates } = localProgramDay(workout, { id: 3, week: 2, day: 1 }, day, newId);
    expect([answer.programId, answer.programWeek, answer.programDay]).toEqual([3, 2, 1]);
    expect(
      answer.exercises.map((e) => [e.id, e.name, e.supersetGroup ?? null, e.sets.map((s) => s.id)]),
    ).toEqual([
      [10, "Bench press", null, [1, 2, -1]],
      [-2, "Čučanj", "A", [-3, -4]],
    ]);
    expect(answer.exercises[0].sets[2]).toMatchObject({
      weight: 80,
      isDone: false,
      completedAt: null,
      order: 2,
    });
    expect(creates).toEqual({
      kind: "programDay",
      exercises: [
        { name: "bench press", id: null, setIds: [-1] },
        { name: "Čučanj", id: -2, setIds: [-3, -4] },
      ],
    });
  });
});

describe("the day kept on the phone", () => {
  beforeEach(() => {
    const data = new Map();
    vi.stubGlobal("localStorage", {
      getItem: (key) => (data.has(key) ? data.get(key) : null),
      setItem: (key, value) => data.set(key, String(value)),
      removeItem: (key) => data.delete(key),
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("keeps the last seven days opened, a day without a workout too", () => {
    expect(keptWorkout("2026-11-20")).toBeUndefined();
    keepWorkout("2026-11-20", workout);
    keepWorkout("2026-11-19", null);
    expect(keptWorkout("2026-11-20")).toEqual(workout);
    expect(keptWorkout("2026-11-19")).toBeNull();
    for (let day = 10; day <= 16; day += 1) keepWorkout(`2026-11-${day}`, null);
    expect(keptWorkout("2026-11-20")).toBeUndefined();
    expect(keptWorkout("2026-11-16")).toBeNull();
  });
});
