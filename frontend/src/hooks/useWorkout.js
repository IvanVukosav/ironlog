import { useEffect, useRef, useState } from "react";
import { fetchJson } from "../api";
import { enqueue, hasPending, isConnectionError, newTempId, subscribe } from "../utils/outbox";
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
} from "../utils/offlineWorkout";
import { newChangeKey, sendChange } from "./useOutbox";
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

// A change that applies to the workout on screen, and leaves "no workout" as it is.
const onWorkout = (change) => (current, answer) => (current ? change(current, answer) : current);
const exerciseIn = (workout, exerciseId) =>
  workout.exercises.find((exercise) => exercise.id === exerciseId);
const setIn = (workout, setId) =>
  workout.exercises.flatMap((exercise) => exercise.sets).find((set) => set.id === setId);
const now = () => new Date().toISOString();

/**
 * The workout of one day (`date` is a "2026-11-04" key) and every change to it.
 *
 * `workout` is null while the day has none, and `isLoading` is true until the day's answer is
 * in. Switching the date starts loading again, so one day's workout is never shown, or changed,
 * under another day's date.
 *
 * Each action saves the change and then shows it. It resolves to what the server answered, or
 * to null once a failure has been reported, so a caller only has to look at what it got back.
 *
 * Without a connection, a change is shown at once and waits in the outbox (utils/outbox.js) until
 * it can be sent; the action resolves to the answer worked out here (utils/offlineWorkout.js). While
 * any change waits, new ones queue behind it, so the server gets them in the order they were made.
 * The day is kept on the phone too, so it opens without a connection. Only applying a workout
 * template needs the server.
 */
export function useWorkout(date) {
  const reportError = useReportError();
  const [loaded, setLoaded] = useState({ date: null, workout: null });
  const isLoading = loaded.date !== date;
  const workout = isLoading ? null : loaded.workout;
  // The day as it is right now, also between a change and the next render: a change made without
  // a connection works its answer out from it.
  const latest = useRef(loaded);

  useEffect(() => {
    latest.current = loaded;
    if (loaded.date !== null) keepWorkout(loaded.date, loaded.workout);
  }, [loaded]);

  useEffect(() => {
    // A slow answer for a day already left behind must not replace the day on screen.
    let isStale = false;
    const load = () =>
      fetchJson(`/api/workouts?date=${date}`).then(
        (workouts) => {
          if (isStale) return;
          // Changes still waiting aren't on the server yet; the copy kept here has them.
          const kept = hasPending(date) ? keptWorkout(date) : undefined;
          const saved = workouts[0] ? withLists(workouts[0]) : null;
          setLoaded({ date, workout: kept !== undefined ? kept : saved });
        },
        (err) => {
          if (isStale) return;
          const kept = isConnectionError(err) ? keptWorkout(date) : undefined;
          if (kept !== undefined) setLoaded({ date, workout: kept });
          else reportError(err);
        },
      );
    load();
    // Once every waiting change is saved, the server's copy has their real ids: load it again.
    const unsubscribe = subscribe(({ pending, previous }) => {
      if (pending === 0 && previous > 0) load();
    });
    return () => {
      isStale = true;
      unsubscribe();
    };
  }, [date, reportError]);

  // A change that comes back after the date was switched finds another day loaded and is dropped.
  const show = (change) =>
    setLoaded((current) =>
      current.date === date ? { date, workout: change(current.workout) } : current,
    );

  const fail = (err) => {
    reportError(err);
    return null;
  };

  // The change waits in the outbox; its answer, worked out here, shows at once.
  const queue = (spec, key) => {
    const base = latest.current.date === date ? latest.current.workout : null;
    let worked;
    try {
      worked = spec.offline(base);
    } catch (err) {
      return Promise.resolve(fail(err));
    }
    const { answer, creates } = worked;
    latest.current = { date, workout: spec.change(base, answer) };
    show((current) => spec.change(current, answer));
    enqueue({
      date,
      method: spec.method,
      path: spec.path,
      json: spec.later ? spec.later(spec.json) : spec.json,
      key,
      creates,
    });
    return Promise.resolve(answer);
  };

  /**
   * Sends a change, { method, path, json, change, offline, later }, and shows `change(workout,
   * answer)` once it is saved. `offline(workout)` works out { answer, creates } for a change that
   * may wait in the outbox, and `later(json)` is the body it is sent with then (with the moment it
   * happened, which the server would otherwise take as the moment it hears of it).
   */
  const run = (spec) => {
    const key = newChangeKey();
    if (spec.offline && hasPending()) return queue(spec, key);
    return sendChange({ method: spec.method, path: spec.path, json: spec.json, key }).then(
      (answer) => {
        show((current) => spec.change(current, answer));
        return answer;
      },
      (err) => (spec.offline && isConnectionError(err) ? queue(spec, key) : fail(err)),
    );
  };

  // Dragging shows the new order at once; saving only makes it last.
  const runOrder = (spec, change) => {
    show(onWorkout(change));
    return run({ ...spec, change: (current) => current, offline: () => ({ answer: {} }) });
  };

  const deleted = () => ({ answer: { success: true } });

  return {
    workout,
    isLoading,

    createWorkout: () =>
      run({
        method: "POST",
        path: "/api/workouts",
        json: { date },
        offline: () => {
          const id = newTempId();
          return { answer: localWorkout(date, id), creates: { kind: "row", id } };
        },
        change: (current, created) => withLists(created),
      }),
    // `fields` is { name }, { notes }, { startedAt } or { finishedAt } (null to carry on).
    updateWorkout: (fields) =>
      run({
        method: "PATCH",
        path: `/api/workouts/${workout.id}`,
        json: fields,
        offline: (current) => ({ answer: localWorkoutChange(current, fields) }),
        change: onWorkout(withWorkoutChanged),
      }),
    // Ends the workout now, or at `finishedAt` (an ISO time); the sets never done are deleted.
    finishWorkout: (finishedAt) => {
      const at = finishedAt ?? now();
      return run({
        method: "POST",
        path: `/api/workouts/${workout.id}/finish`,
        json: finishedAt ? { finishedAt } : {},
        later: () => ({ finishedAt: at }),
        offline: (current) => ({ answer: localFinish(current, at) }),
        change: (current, finished) => withLists(finished),
      });
    },
    deleteWorkout: () =>
      run({
        method: "DELETE",
        path: `/api/workouts/${workout.id}`,
        offline: deleted,
        change: () => null,
      }),

    addExercise: (name) =>
      run({
        method: "POST",
        path: `/api/workouts/${workout.id}/exercises`,
        json: { name },
        offline: (current) => {
          const id = newTempId();
          return { answer: localExercise(current, name, id), creates: { kind: "row", id } };
        },
        change: onWorkout((current, exercise) => withExercisesAdded(current, [exercise])),
      }),
    // `planned` makes the template's sets a plan to tick off instead of done sets.
    applyTemplate: (templateId, planned) =>
      run({
        method: "POST",
        path: `/api/workout-templates/${templateId}/apply`,
        json: { workoutId: workout.id, planned },
        change: onWorkout(withExercisesAdded),
      }),
    // `program` is { id, week, day }, or null for sets from elsewhere (a past workout done again);
    // the answer is the whole workout with the sets in it.
    loadProgramDay: (program, exercises) =>
      run({
        method: "POST",
        path: `/api/workouts/${workout.id}/exercises/bulk`,
        json: { program, exercises },
        offline: (current) => localProgramDay(current, program, exercises, newTempId),
        change: (current, updated) => withLists(updated),
      }),
    reorderExercises: (exercises) =>
      runOrder(
        {
          method: "PATCH",
          path: `/api/workouts/${workout.id}/exercises/reorder`,
          json: { exerciseIds: exercises.map((exercise) => exercise.id) },
        },
        (current) => withExercisesInOrder(current, exercises),
      ),
    // `fields` is { supersetGroup } or { notes }.
    updateExercise: (exerciseId, fields) =>
      run({
        method: "PATCH",
        path: `/api/workouts/exercises/${exerciseId}`,
        json: fields,
        offline: (current) => ({
          answer: localExerciseChange(exerciseIn(current, exerciseId), fields),
        }),
        change: onWorkout(withExerciseChanged),
      }),
    deleteExercise: (exerciseId) =>
      run({
        method: "DELETE",
        path: `/api/workouts/exercises/${exerciseId}`,
        offline: deleted,
        change: onWorkout((current) => withoutExercise(current, exerciseId)),
      }),

    // `values` is { weight, reps, rpe, isWarmup }, as typed or as numbers, and `isDone: false`
    // for a set that is only planned.
    addSet: (exerciseId, values) => {
      const at = now();
      return run({
        method: "POST",
        path: `/api/workouts/exercises/${exerciseId}/sets`,
        json: values,
        later: (json) => withCompletedAt(json, at),
        offline: (current) => {
          const id = newTempId();
          const set = localSet(exerciseIn(current, exerciseId), values, id, at);
          return { answer: set, creates: { kind: "row", id } };
        },
        change: onWorkout(withSetAdded),
      });
    },
    // Several sets at the start ("start") or the end ("end") of the exercise.
    addSets: (exerciseId, sets, position) => {
      const at = now();
      const place = position ?? "end";
      return run({
        method: "POST",
        path: `/api/workouts/exercises/${exerciseId}/sets/bulk`,
        json: { sets, position },
        later: (json) => ({ ...json, sets: json.sets.map((set) => withCompletedAt(set, at)) }),
        offline: (current) => {
          const ids = sets.map(() => newTempId());
          const all = localSets(exerciseIn(current, exerciseId), sets, place, ids, at);
          return { answer: all, creates: { kind: "sets", ids, position: place } };
        },
        change: onWorkout((current, savedSets) => withSetsInOrder(current, exerciseId, savedSets)),
      });
    },
    // `values` holds only what changes: { isDone: true } ticks a set off.
    updateSet: (setId, values) => {
      const at = now();
      return run({
        method: "PATCH",
        path: `/api/workouts/sets/${setId}`,
        json: values,
        later: (json) => (json.isDone === true ? { ...json, completedAt: at } : json),
        offline: (current) => ({ answer: localSetChange(setIn(current, setId), values, at) }),
        change: onWorkout(withSetChanged),
      });
    },
    deleteSet: (setId) =>
      run({
        method: "DELETE",
        path: `/api/workouts/sets/${setId}`,
        offline: deleted,
        change: onWorkout((current) => withoutSet(current, setId)),
      }),
    reorderSets: (exerciseId, sets) =>
      runOrder(
        {
          method: "PATCH",
          path: `/api/workouts/exercises/${exerciseId}/sets/reorder`,
          json: { setIds: sets.map((set) => set.id) },
        },
        (current) => withSetsInOrder(current, exerciseId, sets),
      ),
  };
}
