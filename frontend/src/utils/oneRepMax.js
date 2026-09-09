const EPLEY_REP_DIVISOR = 30;
const BRZYCKI_CONSTANT_A = 36;
const BRZYCKI_CONSTANT_B = 37;
const LOMBARDI_EXPONENT = 0.1;
const RPE_SCALE_MAX = 10;

export const ONE_REP_MAX_FORMULAS = {
  epley: "epley",
  brzycki: "brzycki",
  lombardi: "lombardi",
};

export function calculateOneRepMax(weight, reps, formula) {
  if (formula === ONE_REP_MAX_FORMULAS.epley) {
    return weight * (1 + reps / EPLEY_REP_DIVISOR);
  }
  if (formula === ONE_REP_MAX_FORMULAS.lombardi) {
    return weight * Math.pow(reps, LOMBARDI_EXPONENT);
  }
  return (weight * BRZYCKI_CONSTANT_A) / (BRZYCKI_CONSTANT_B - reps);
}

export function calculateEstimatedOneRepMax(weight, reps, rpe, formula) {
  const effectiveRpe = Number.isFinite(rpe) ? rpe : RPE_SCALE_MAX;
  const repsInReserve = RPE_SCALE_MAX - effectiveRpe;
  const repsToFailure = reps + repsInReserve;
  return calculateOneRepMax(weight, repsToFailure, formula);
}

export function findBestSetByE1rm(sets, formula) {
  return sets.reduce((best, set) => {
    const e1rm = calculateEstimatedOneRepMax(set.weight, set.reps, set.rpe, formula);
    if (!best || e1rm > best.e1rm) {
      return { ...set, e1rm };
    }
    return best;
  }, null);
}
