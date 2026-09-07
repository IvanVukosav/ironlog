const EPLEY_REP_DIVISOR = 30;
const BRZYCKI_CONSTANT_A = 36;
const BRZYCKI_CONSTANT_B = 37;
const LOMBARDI_EXPONENT = 0.1;

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
