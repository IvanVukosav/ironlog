// The RPE chart (RTS style): what share of the 1RM a set is, by its reps and RPE. The chart's
// values depend only on the reps to failure (reps done plus reps left in reserve, so 5 @ RPE 8,
// 7 @ RPE 10 and 3 @ RPE 6 are all 7, and all 81.1 %), so it is kept as one row: the % of 1RM at
// 1, 1.5, 2, … 14 reps to failure. That covers its 1–10 reps at RPE 6–10, and the same reps to
// failure reached any other way (8 @ RPE 4 is 14, as 10 @ RPE 6).
const PERCENT_BY_REPS_TO_FAILURE = [
  100.0, 97.8, 95.5, 93.9, 92.2, 90.7, 89.2, 87.8, 86.3, 85.0, 83.7, 82.4, 81.1, 79.9, 78.6, 77.4,
  76.2, 75.1, 73.9, 72.3, 70.7, 69.4, 68.0, 66.7, 65.3, 64.0, 62.6,
];
const STEP = 0.5;
const RPE_SCALE_MAX = 10;
const MIN_RPE = 1;
export const CHART_MIN_REPS_TO_FAILURE = 1;
export const CHART_MAX_REPS_TO_FAILURE = 14;

/** The % of 1RM at `toFailure` reps to failure, read between the half steps; null outside. */
export function percentAtRepsToFailure(toFailure) {
  if (!(toFailure >= CHART_MIN_REPS_TO_FAILURE && toFailure <= CHART_MAX_REPS_TO_FAILURE)) {
    return null;
  }
  const position = (toFailure - CHART_MIN_REPS_TO_FAILURE) / STEP;
  const below = Math.floor(position);
  const above = Math.min(below + 1, PERCENT_BY_REPS_TO_FAILURE.length - 1);
  const between = position - below;
  return (
    PERCENT_BY_REPS_TO_FAILURE[below] +
    (PERCENT_BY_REPS_TO_FAILURE[above] - PERCENT_BY_REPS_TO_FAILURE[below]) * between
  );
}

/** The % of 1RM for `reps` at `rpe` (no RPE counts as 10); null where the chart has none. */
export function percentForRpe(reps, rpe) {
  const effectiveRpe = Number.isFinite(rpe) ? rpe : RPE_SCALE_MAX;
  return percentAtRepsToFailure(reps + RPE_SCALE_MAX - effectiveRpe);
}

/**
 * The RPE, to the half, at which `reps` come to `percent` % of the 1RM: the chart read the other
 * way. Null when no RPE from 1 to 10 gets within a step of it (too heavy for those reps, or
 * lighter than the chart goes).
 */
export function rpeForPercent(reps, percent) {
  let best = null;
  for (let rpe = RPE_SCALE_MAX; rpe >= MIN_RPE; rpe -= STEP) {
    const atRpe = percentForRpe(reps, rpe);
    if (atRpe === null) continue;
    const distance = Math.abs(atRpe - percent);
    if (best === null || distance < best.distance) best = { rpe, distance };
  }
  // Neighbouring half steps are 1.2–2.3 % apart, so a closer match is that RPE.
  return best && best.distance <= 1.2 ? best.rpe : null;
}
