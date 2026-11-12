import { useEffect, useState } from "react";
import { fetchJson } from "../api";
import { useReportError } from "./useReportError";
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
} from "../utils/workoutState";

const post = (path, json) => fetchJson(path, { method: "POST", json });
const patch = (path, json) => fetchJson(path, { method: "PATCH", json });
const remove = (path) => fetchJson(path, { method: "DELETE" });

/**
 * The workout of one day (`date` is a "2026-11-04" key) and every change to it.
 *
 * `workout` is null while the day has none, and `isLoading` is true until the day's answer is
 * in. Switching the date starts loading again, so one day's workout is never shown, or changed,
 * under another day's date.
 *
 * Each action saves the change and then shows it. It resolves to what the server answered, or
 * to null once a failure has been reported, so a caller only has to look at what it got back.
 */
export function useWorkout(date) {
  const reportError = useReportError();
  const [loaded, setLoaded] = useState({ date: null, workout: null });
  const isLoading = loaded.date !== date;
  const workout = isLoading ? null : loaded.workout;

  useEffect(() => {
    // A slow answer for a day already left behind must not replace the day on screen.
    let isStale = false;
    fetchJson(`/api/workouts?date=${date}`)
      .then((workouts) => {
        if (!isStale) setLoaded({ date, workout: workouts[0] ? withLists(workouts[0]) : null });
      })
      .catch(reportError);
    return () => {
      isStale = true;
    };
  }, [date, reportError]);

  // A save that comes back after the date was switched finds another day loaded and is dropped.
  const show = (change) =>
    setLoaded((current) =>
      current.date === date ? { date, workout: change(current.workout) } : current,
    );

  const fail = (err) => {
    reportError(err);
    return null;
  };

  // Once `request` is saved, `change(workout, answer)` gives the workout to show.
  const save = (request, change) =>
    request.then((answer) => {
      show((current) => (current ? change(current, answer) : current));
      return answer;
    }, fail);

  // Dragging shows the new order at once; saving only makes it last.
  const saveOrder = (request, change) => {
    show((current) => (current ? change(current) : current));
    return request.catch(fail);
  };

  return {
    workout,
    isLoading,

    createWorkout: () =>
      post("/api/workouts", { date }).then((created) => {
        show(() => withLists(created));
        return created;
      }, fail),
    // `fields` is { name } or { notes }.
    updateWorkout: (fields) =>
      save(patch(`/api/workouts/${workout.id}`, fields), withWorkoutChanged),
    deleteWorkout: () => save(remove(`/api/workouts/${workout.id}`), () => null),

    addExercise: (name) =>
      save(post(`/api/workouts/${workout.id}/exercises`, { name }), (current, exercise) =>
        withExercisesAdded(current, [exercise]),
      ),
    applyTemplate: (templateId) =>
      save(
        post(`/api/workout-templates/${templateId}/apply`, { workoutId: workout.id }),
        withExercisesAdded,
      ),
    // `program` is { id, week, day }; the answer is the whole workout with the day's sets in it.
    loadProgramDay: (program, exercises) =>
      save(
        post(`/api/workouts/${workout.id}/exercises/bulk`, { program, exercises }),
        (current, updated) => withLists(updated),
      ),
    reorderExercises: (exercises) =>
      saveOrder(
        patch(`/api/workouts/${workout.id}/exercises/reorder`, {
          exerciseIds: exercises.map((exercise) => exercise.id),
        }),
        (current) => withExercisesInOrder(current, exercises),
      ),
    // `fields` is { supersetGroup } or { notes }.
    updateExercise: (exerciseId, fields) =>
      save(patch(`/api/workouts/exercises/${exerciseId}`, fields), withExerciseChanged),
    deleteExercise: (exerciseId) =>
      save(remove(`/api/workouts/exercises/${exerciseId}`), (current) =>
        withoutExercise(current, exerciseId),
      ),

    // `values` is { weight, reps, rpe, isWarmup }, as typed or as numbers.
    addSet: (exerciseId, values) =>
      save(post(`/api/workouts/exercises/${exerciseId}/sets`, values), withSetAdded),
    updateSet: (setId, values) =>
      save(patch(`/api/workouts/sets/${setId}`, values), withSetChanged),
    deleteSet: (setId) =>
      save(remove(`/api/workouts/sets/${setId}`), (current) => withoutSet(current, setId)),
    reorderSets: (exerciseId, sets) =>
      saveOrder(
        patch(`/api/workouts/exercises/${exerciseId}/sets/reorder`, {
          setIds: sets.map((set) => set.id),
        }),
        (current) => withSetsInOrder(current, exerciseId, sets),
      ),
  };
}
