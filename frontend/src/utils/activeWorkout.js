// A workout while it is being trained: which set is next, how far along it is, how long it has
// run, and what it came to. A set loaded from a program is a plan (isDone false) until it is
// ticked off; everything here counts done sets only, except where it counts the plan.
import { findBestSetByE1rm } from "./oneRepMax";

// A started workout nobody finished closes itself this long after its last done set.
export const AUTO_CLOSE_AFTER_MS = 6 * 60 * 60 * 1000;

// The rest after a set when the settings have none yet (the API's default too); 0 turns it off.
export const DEFAULT_REST_SECONDS = 120;
export const REST_CHOICES_SECONDS = [0, 60, 90, 120, 180, 300];

const allSets = (workout) => workout.exercises.flatMap((exercise) => exercise.sets);
const doneWorkingSets = (sets) => sets.filter((set) => set.isDone && !set.isWarmup);

// The first set not done yet, going through the exercises in order, with its exercise; null once
// every set is done.
export function findNextSet(workout) {
  for (const exercise of workout.exercises) {
    const set = exercise.sets.find((candidate) => !candidate.isDone);
    if (set) return { exercise, set };
  }
  return null;
}

// How many sets the workout has, how many are done, and how many are still a plan.
export function countSets(workout) {
  const sets = allSets(workout);
  const done = sets.filter((set) => set.isDone).length;
  return { done, total: sets.length, planned: sets.length - done };
}

// When the workout was last trained, in ms: its latest done set, or its start; null for neither.
export function lastActivity(workout) {
  const times = allSets(workout)
    .filter((set) => set.isDone && set.completedAt)
    .map((set) => Date.parse(set.completedAt));
  if (workout.startedAt) times.push(Date.parse(workout.startedAt));
  return times.length > 0 ? Math.max(...times) : null;
}

// A workout that was started, never finished, and not trained for AUTO_CLOSE_AFTER_MS.
export function shouldAutoClose(workout, nowMs) {
  if (!workout?.startedAt || workout.finishedAt) return false;
  const last = lastActivity(workout);
  return last !== null && nowMs - last > AUTO_CLOSE_AFTER_MS;
}

// "38:12", and "1:04:30" from an hour on.
export function formatClock(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (value) => String(value).padStart(2, "0");
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${minutes}:${pad(seconds)}`;
}

// A duration in hours and whole minutes, for "1 h 5 min".
export function splitDuration(ms) {
  const totalMinutes = Math.max(0, Math.round(ms / 60000));
  return { hours: Math.floor(totalMinutes / 60), minutes: totalMinutes % 60 };
}

/**
 * What a workout came to: its done working sets, the weight they moved, the records it set, and
 * how many planned sets it leaves undone. A record is an exercise whose best e1RM beats every
 * earlier one; an exercise done for the first time has nothing to beat. `previousSets` is the
 * /api/stats/prs shape ([{ name, sets }]), from which this workout's own sets are left out.
 */
export function summarizeWorkout(workout, previousSets, formula) {
  const workingSets = doneWorkingSets(allSets(workout));
  const earlierByName = new Map(
    previousSets.map(({ name, sets }) => [
      name,
      sets.filter((set) => set.workoutId !== workout.id),
    ]),
  );

  const records = [];
  for (const exercise of workout.exercises) {
    const best = findBestSetByE1rm(doneWorkingSets(exercise.sets), formula);
    const earlierBest = findBestSetByE1rm(earlierByName.get(exercise.name) ?? [], formula);
    if (best && earlierBest && best.e1rm > earlierBest.e1rm) {
      records.push({ name: exercise.name, e1rm: best.e1rm, gain: best.e1rm - earlierBest.e1rm });
    }
  }

  return {
    workingSets: workingSets.length,
    volume: workingSets.reduce((sum, set) => sum + set.weight * set.reps, 0),
    records,
    plannedLeft: countSets(workout).planned,
  };
}
