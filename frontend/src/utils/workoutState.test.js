import { describe, expect, it } from "vitest";
import {
  withExerciseChanged,
  withExercisesAdded,
  withExercisesInOrder,
  withLists,
  withSetAdded,
  withSetChanged,
  withSetsInOrder,
  withWorkoutChanged,
  withoutExercise,
  withoutSet,
} from "./workoutState";

const squatSet = { id: 10, exerciseId: 1, weight: 150, reps: 5, rpe: 8 };
const squatBackoff = { id: 11, exerciseId: 1, weight: 130, reps: 8, rpe: 7 };
const benchSet = { id: 20, exerciseId: 2, weight: 100, reps: 5, rpe: 8 };

function workout() {
  return {
    id: 7,
    name: "Legs",
    notes: null,
    exercises: [
      { id: 1, name: "Squat", supersetGroup: null, notes: null, sets: [squatSet, squatBackoff] },
      { id: 2, name: "Bench", supersetGroup: null, notes: null, sets: [benchSet] },
    ],
  };
}

const setIds = (result, exerciseId) =>
  result.exercises.find((exercise) => exercise.id === exerciseId).sets.map((set) => set.id);

describe("withLists", () => {
  it("gives a new workout its exercise list", () => {
    expect(withLists({ id: 7, name: null })).toEqual({ id: 7, name: null, exercises: [] });
  });

  it("gives exercises without sets an empty list and keeps the sets of the others", () => {
    const result = withLists({ id: 7, exercises: [{ id: 1 }, { id: 2, sets: [benchSet] }] });
    expect(result.exercises).toEqual([
      { id: 1, sets: [] },
      { id: 2, sets: [benchSet] },
    ]);
  });
});

describe("withWorkoutChanged", () => {
  it("takes the saved fields and keeps the exercises on screen", () => {
    const before = workout();
    const result = withWorkoutChanged(before, { id: 7, name: "Leg day", notes: "slept badly" });
    expect(result.name).toBe("Leg day");
    expect(result.notes).toBe("slept badly");
    expect(result.exercises).toBe(before.exercises);
  });

  it("is not fooled by a saved row that carries an exercise list of its own", () => {
    const before = workout();
    expect(withWorkoutChanged(before, { name: "Leg day", exercises: [] }).exercises).toBe(
      before.exercises,
    );
  });
});

describe("exercises", () => {
  it("adds exercises at the end, with a set list each", () => {
    const result = withExercisesAdded(workout(), [
      { id: 3, name: "Row" },
      { id: 4, name: "Curl", sets: [{ id: 40, exerciseId: 4 }] },
    ]);
    expect(result.exercises.map((exercise) => exercise.id)).toEqual([1, 2, 3, 4]);
    expect(result.exercises[2].sets).toEqual([]);
    expect(setIds(result, 4)).toEqual([40]);
  });

  it("changes one exercise's fields and keeps its sets", () => {
    const result = withExerciseChanged(workout(), { id: 2, supersetGroup: "A", notes: "paused" });
    expect(result.exercises[1]).toMatchObject({
      name: "Bench",
      supersetGroup: "A",
      notes: "paused",
    });
    expect(setIds(result, 2)).toEqual([20]);
    expect(result.exercises[0].supersetGroup).toBeNull();
  });

  it("removes one exercise", () => {
    expect(withoutExercise(workout(), 1).exercises.map((exercise) => exercise.id)).toEqual([2]);
  });

  it("takes a new order as given", () => {
    const [squat, bench] = workout().exercises;
    expect(withExercisesInOrder(workout(), [bench, squat]).exercises).toEqual([bench, squat]);
  });
});

describe("sets", () => {
  it("adds a set to the exercise it belongs to", () => {
    const result = withSetAdded(workout(), { id: 21, exerciseId: 2, weight: 100, reps: 4 });
    expect(setIds(result, 2)).toEqual([20, 21]);
    expect(setIds(result, 1)).toEqual([10, 11]);
  });

  it("replaces a changed set in place", () => {
    const result = withSetChanged(workout(), { ...squatBackoff, reps: 9 });
    expect(setIds(result, 1)).toEqual([10, 11]);
    expect(result.exercises[0].sets[1].reps).toBe(9);
  });

  it("removes a set wherever it is", () => {
    const result = withoutSet(workout(), 10);
    expect(setIds(result, 1)).toEqual([11]);
    expect(setIds(result, 2)).toEqual([20]);
  });

  it("reorders the sets of one exercise only", () => {
    const result = withSetsInOrder(workout(), 1, [squatBackoff, squatSet]);
    expect(setIds(result, 1)).toEqual([11, 10]);
    expect(setIds(result, 2)).toEqual([20]);
  });
});

describe("every change", () => {
  it("leaves the workout it was given untouched", () => {
    const before = workout();
    const snapshot = JSON.stringify(before);
    withWorkoutChanged(before, { name: "x" });
    withExercisesAdded(before, [{ id: 3 }]);
    withExerciseChanged(before, { id: 1, notes: "x" });
    withoutExercise(before, 1);
    withSetAdded(before, { id: 12, exerciseId: 1 });
    withSetChanged(before, { ...squatSet, reps: 1 });
    withoutSet(before, 10);
    withSetsInOrder(before, 1, [squatBackoff, squatSet]);
    expect(JSON.stringify(before)).toBe(snapshot);
  });

  it("does nothing for an exercise or a set that is not in the workout", () => {
    const before = workout();
    expect(withSetAdded(before, { id: 99, exerciseId: 99 })).toEqual(before);
    expect(withoutSet(before, 99)).toEqual(before);
    expect(withExerciseChanged(before, { id: 99, notes: "x" })).toEqual(before);
  });
});
