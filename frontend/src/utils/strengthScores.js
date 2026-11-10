import { findBestSetByE1rm } from "./oneRepMax";
import { isSameExerciseName } from "./exerciseNames";

export const SEXES = {
  male: "male",
  female: "female",
};

export const MAIN_LIFTS = ["squat", "bench", "deadlift"];

// Used when the lift isn't picked in Settings; among the matches, the one
// with the highest e1RM wins (back squat over front squat, etc.).
const LIFT_NAME_PATTERNS = {
  squat: /čučanj|cucanj|squat/i,
  bench: /bench|benč|potisak s klupe/i,
  deadlift: /mrtvo|deadlift/i,
};

const SETTINGS_KEY_BY_LIFT = {
  squat: "squatExercise",
  bench: "benchExercise",
  deadlift: "deadliftExercise",
};

// IPF DOTS (2019) polynomial coefficients, lowest power first.
const DOTS_COEFFICIENTS = {
  male: [-307.75076, 24.0900756, -0.1918759221, 0.0007391293, -0.000001093],
  female: [-57.96288, 13.6175032, -0.1126655495, 0.0005158568, -0.0000010706],
};
const DOTS_BODYWEIGHT_RANGE = { male: [40, 210], female: [40, 150] };

// Original Wilks coefficients, lowest power first.
const WILKS_COEFFICIENTS = {
  male: [-216.0475144, 16.2606339, -0.002388645, -0.00113732, 7.01863e-6, -1.291e-8],
  female: [594.31747775582, -27.23842536447, 0.82112226871, -0.00930733913, 4.731582e-5, -9.054e-8],
};
const WILKS_BODYWEIGHT_RANGE = { male: [40, 201.9], female: [26.51, 154.53] };

const SCORE_NUMERATOR = 500;

function polynomial(coefficients, x) {
  return coefficients.reduce((sum, coefficient, power) => sum + coefficient * x ** power, 0);
}

function clamp(value, [min, max]) {
  return Math.min(Math.max(value, min), max);
}

function score(totalKg, bodyweightKg, sex, coefficients, range) {
  if (!(totalKg > 0) || !(bodyweightKg > 0)) return null;
  const key = sex === SEXES.female ? SEXES.female : SEXES.male;
  const bodyweight = clamp(bodyweightKg, range[key]);
  return (totalKg * SCORE_NUMERATOR) / polynomial(coefficients[key], bodyweight);
}

export function calculateDots(totalKg, bodyweightKg, sex) {
  return score(totalKg, bodyweightKg, sex, DOTS_COEFFICIENTS, DOTS_BODYWEIGHT_RANGE);
}

export function calculateWilks(totalKg, bodyweightKg, sex) {
  return score(totalKg, bodyweightKg, sex, WILKS_COEFFICIENTS, WILKS_BODYWEIGHT_RANGE);
}

/**
 * Best e1RM set for squat, bench and deadlift. `exerciseSets` is the
 * /api/stats/prs shape: [{ name, sets }]. Returns { squat, bench, deadlift },
 * each { name, ...bestSet } or null.
 */
export function findMainLiftBests(exerciseSets, settings, formula) {
  const bestByName = Object.fromEntries(
    exerciseSets
      .map((exercise) => [exercise.name, findBestSetByE1rm(exercise.sets, formula)])
      .filter(([, bestSet]) => bestSet),
  );

  return Object.fromEntries(
    MAIN_LIFTS.map((lift) => {
      const chosenName = settings?.[SETTINGS_KEY_BY_LIFT[lift]];
      const candidates = Object.keys(bestByName).filter((name) =>
        chosenName ? isSameExerciseName(name, chosenName) : LIFT_NAME_PATTERNS[lift].test(name),
      );
      const bestName = candidates
        .filter((name) => bestByName[name])
        .sort((nameA, nameB) => bestByName[nameB].e1rm - bestByName[nameA].e1rm)[0];
      return [lift, bestName ? { name: bestName, ...bestByName[bestName] } : null];
    }),
  );
}
