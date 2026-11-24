import { describe, expect, it } from "vitest";
import { REPEAT_CHOICES, repeatChoices, repeatedExercises, workingSetCount } from "./repeatWorkout";

const set = (values) => ({
  weight: 100,
  reps: 5,
  rpe: null,
  isWarmup: false,
  isDrop: false,
  isDone: true,
  backoffPercent: null,
  ...values,
});

const push = {
  id: 7,
  name: "Push",
  exercises: [
    {
      name: "Bench press",
      supersetGroup: null,
      sets: [
        set({ weight: 60, isWarmup: true }),
        set({ rpe: 8 }),
        set({ weight: 80, backoffPercent: 20 }),
      ],
    },
    {
      name: "Triceps na sajli",
      supersetGroup: "A",
      sets: [set({ weight: 30, reps: 12 }), set({ weight: 20, reps: 10, isDrop: true })],
    },
    { name: "Lateralno podizanje", supersetGroup: "A", sets: [set({ isDone: false })] },
  ],
};

describe("repeatedExercises", () => {
  it("keeps the order, the sets as they were and the superset letters, as a plan", () => {
    expect(repeatedExercises(push, false)).toEqual([
      {
        name: "Bench press",
        supersetGroup: null,
        sets: [
          {
            weight: 60,
            reps: 5,
            rpe: null,
            isWarmup: true,
            isDrop: false,
            backoffPercent: null,
            isDone: false,
          },
          {
            weight: 100,
            reps: 5,
            rpe: 8,
            isWarmup: false,
            isDrop: false,
            backoffPercent: null,
            isDone: false,
          },
          {
            weight: 80,
            reps: 5,
            rpe: null,
            isWarmup: false,
            isDrop: false,
            backoffPercent: 20,
            isDone: false,
          },
        ],
      },
      {
        name: "Triceps na sajli",
        supersetGroup: "A",
        sets: [
          {
            weight: 30,
            reps: 12,
            rpe: null,
            isWarmup: false,
            isDrop: false,
            backoffPercent: null,
            isDone: false,
          },
          {
            weight: 20,
            reps: 10,
            rpe: null,
            isWarmup: false,
            isDrop: true,
            backoffPercent: null,
            isDone: false,
          },
        ],
      },
    ]);
  });

  it("leaves out sets never done, and an exercise with nothing done", () => {
    const names = repeatedExercises(push, false).map((exercise) => exercise.name);
    expect(names).not.toContain("Lateralno podizanje");
  });

  it("makes the sets done at once for a day filled in afterwards", () => {
    const sets = repeatedExercises(push, true).flatMap((exercise) => exercise.sets);
    expect(sets.every((one) => one.isDone)).toBe(true);
  });
});

describe("workingSetCount", () => {
  it("counts done sets that are neither warm-ups nor drop sets", () => {
    expect(workingSetCount(push)).toBe(3);
  });
});

describe("repeatChoices", () => {
  const trained = Array.from({ length: REPEAT_CHOICES + 1 }, (_, index) => ({ id: index + 1 }));

  it("offers at most REPEAT_CHOICES workouts, newest first as they came", () => {
    expect(repeatChoices(trained, null).map((workout) => workout.id)).toEqual(
      Array.from({ length: REPEAT_CHOICES }, (_, index) => index + 1),
    );
  });

  it("leaves out the workout being filled in", () => {
    const ids = repeatChoices(trained, 2).map((workout) => workout.id);
    expect(ids).not.toContain(2);
    expect(ids).toHaveLength(REPEAT_CHOICES);
  });
});
