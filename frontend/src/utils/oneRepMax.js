const RPE_SCALE_MAX = 10;
const TIMELINE_DECIMAL_PLACES = 1;
// The most reps to failure where an e1RM is still a fair guess. Past it the e1RM is still worked
// out and counted, but shown as rough ("≈").
export const MAX_RELIABLE_REPS_TO_FAILURE = 15;

// Every e1RM formula the app offers. Adding one here is all it takes: Settings lists it and
// every e1RM uses it when picked. `maxReps` is the most reps the formula takes at all (Brzycki
// divides by zero at 37); without one it has no end.
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

// The most reps to failure `formula` takes at all: Infinity for one without an end.
export function formulaMaxReps(formula) {
  return (E1RM_FORMULAS[formula] ?? E1RM_FORMULAS[DEFAULT_E1RM_FORMULA]).maxReps ?? Infinity;
}

// Null below one rep to failure, and past what the formula takes at all (formulaMaxReps).
export function calculateEstimatedOneRepMax(weight, reps, rpe, formula) {
  const toFailure = repsToFailure(reps, rpe);
  if (toFailure < 1 || toFailure > formulaMaxReps(formula)) return null;
  return calculateOneRepMax(weight, toFailure, formula);
}

// An e1RM from more than MAX_RELIABLE_REPS_TO_FAILURE reps to failure is only a rough guess.
export function isRoughEstimate(reps, rpe) {
  return repsToFailure(reps, rpe) > MAX_RELIABLE_REPS_TO_FAILURE;
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
