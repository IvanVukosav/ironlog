const RPE_SCALE_MAX = 10;
const TIMELINE_DECIMAL_PLACES = 1;
// The formulas stop meaning anything past this many reps to failure (Brzycki even turns
// negative at 37), so such sets get no e1RM instead of a made-up one.
export const MAX_E1RM_REPS_TO_FAILURE = 15;

// Every e1RM formula the app offers. Adding one here is all it takes: Settings lists it and
// every e1RM uses it when picked. `maxReps` is the most reps the formula accepts at all.
export const E1RM_FORMULAS = {
  epley: { label: "Epley", estimate: (weight, reps) => weight * (1 + reps / 30) },
  brzycki: {
    label: "Brzycki",
    estimate: (weight, reps) => (weight * 36) / (37 - reps),
    maxReps: 36,
  },
  lombardi: { label: "Lombardi", estimate: (weight, reps) => weight * reps ** 0.1 },
};
export const DEFAULT_E1RM_FORMULA = "brzycki";

export function calculateOneRepMax(weight, reps, formula) {
  const { estimate } = E1RM_FORMULAS[formula] ?? E1RM_FORMULAS[DEFAULT_E1RM_FORMULA];
  return estimate(weight, reps);
}

// The reps done plus those the RPE says were left in reserve. A set without an RPE counts as
// taken to failure.
export function repsToFailure(reps, rpe) {
  const effectiveRpe = Number.isFinite(rpe) ? rpe : RPE_SCALE_MAX;
  return reps + RPE_SCALE_MAX - effectiveRpe;
}

// Null when the reps to failure are outside 1 to MAX_E1RM_REPS_TO_FAILURE.
export function calculateEstimatedOneRepMax(weight, reps, rpe, formula) {
  const toFailure = repsToFailure(reps, rpe);
  if (toFailure < 1 || toFailure > MAX_E1RM_REPS_TO_FAILURE) return null;
  return calculateOneRepMax(weight, toFailure, formula);
}

// The estimate however many reps to failure, as far as the formula goes at all (its maxReps);
// null past that. Only Kalkulator shows these, as rough past MAX_E1RM_REPS_TO_FAILURE: sets in
// Trening and the records still stop there.
export function calculateRoughOneRepMax(weight, reps, rpe, formula) {
  const toFailure = repsToFailure(reps, rpe);
  const { maxReps = Infinity } = E1RM_FORMULAS[formula] ?? E1RM_FORMULAS[DEFAULT_E1RM_FORMULA];
  if (toFailure < 1 || toFailure > maxReps) return null;
  return calculateOneRepMax(weight, toFailure, formula);
}

export function findBestSetByE1rm(sets, formula) {
  return sets
    .filter((set) => !set.isWarmup)
    .reduce((best, set) => {
      const e1rm = calculateEstimatedOneRepMax(set.weight, set.reps, set.rpe, formula);
      if (e1rm !== null && (!best || e1rm > best.e1rm)) {
        return { ...set, e1rm };
      }
      return best;
    }, null);
}

// Best e1RM per session date, oldest first, flagging sessions that beat every
// earlier one (the first session is the baseline, not a PR).
export function buildE1rmTimeline(sets, formula) {
  const bestByTime = new Map();
  for (const set of sets) {
    if (set.isWarmup) continue;
    const e1rm = calculateEstimatedOneRepMax(set.weight, set.reps, set.rpe, formula);
    if (e1rm === null) continue;
    const time = new Date(set.date).getTime();
    if (!bestByTime.has(time) || e1rm > bestByTime.get(time)) bestByTime.set(time, e1rm);
  }

  let runningBest = null;
  return [...bestByTime.entries()]
    .sort(([timeA], [timeB]) => timeA - timeB)
    .map(([time, e1rm]) => {
      const isPr = runningBest !== null && e1rm > runningBest;
      runningBest = runningBest === null ? e1rm : Math.max(runningBest, e1rm);
      return { time, e1rm: parseFloat(e1rm.toFixed(TIMELINE_DECIMAL_PLACES)), isPr };
    });
}
