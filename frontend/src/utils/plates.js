export const STANDARD_PLATES_KG = [25, 20, 15, 10, 5, 2.5, 1.25, 0.5];
export const BAR_WEIGHTS_KG = [20, 15, 10];
export const COLLAR_WEIGHT_KG = 2.5;
export const MAX_LOAD_KG = 1000;

export const DEFAULT_PLATE_SETUP = {
  barWeight: 20,
  useCollars: false,
  availablePlates: [25, 20, 15, 10, 5, 2.5, 1.25],
};

// IPF competition plate colors; height is % of the largest plate, width in px.
export const PLATE_STYLES = {
  25: { color: "#d32f2f", height: 100, width: 14 },
  20: { color: "#1565c0", height: 100, width: 14 },
  15: { color: "#f9a825", height: 90, width: 13 },
  10: { color: "#2e7d32", height: 78, width: 12 },
  5: { color: "#f5f5f5", height: 62, width: 10 },
  2.5: { color: "#212121", height: 52, width: 9 },
  1.25: { color: "#9e9e9e", height: 44, width: 8 },
  0.5: { color: "#bdbdbd", height: 38, width: 7 },
};

// Every standard plate is a multiple of 250 g, so the search runs in those units.
const UNIT_GRAMS = 250;

const WARMUP_STEPS = [
  { percent: 40, reps: 5 },
  { percent: 55, reps: 3 },
  { percent: 70, reps: 2 },
  { percent: 80, reps: 1 },
  { percent: 90, reps: 1 },
];
const EMPTY_BAR_WARMUP_REPS = 10;

function toUnits(kg) {
  return Math.floor(Math.round(kg * 1000) / UNIT_GRAMS);
}

function roundKg(kg) {
  return Math.round(kg * 100) / 100;
}

function collarsWeight(setup) {
  return setup.useCollars ? COLLAR_WEIGHT_KG * 2 : 0;
}

/**
 * Plates for one side of the bar, heaviest first. Finds the heaviest load
 * not above the target with the fewest plates (plain "biggest plate first"
 * misses exact loads when some plates are unavailable, e.g. 40 kg from 25s
 * and 20s). Returns null when the target is below the empty bar.
 */
export function calculatePlates(targetKg, setup) {
  const emptyBarKg = setup.barWeight + collarsWeight(setup);
  if (!(targetKg >= emptyBarKg) || targetKg > MAX_LOAD_KG) return null;

  const targetUnits = toUnits((targetKg - emptyBarKg) / 2);
  const plates = setup.availablePlates
    .map((kg) => ({ kg, units: toUnits(kg) }))
    .filter((plate) => plate.units > 0);

  const plateCount = new Array(targetUnits + 1).fill(Infinity);
  const lastPlate = new Array(targetUnits + 1).fill(null);
  plateCount[0] = 0;
  for (let units = 1; units <= targetUnits; units++) {
    for (const plate of plates) {
      if (plate.units <= units && plateCount[units - plate.units] + 1 < plateCount[units]) {
        plateCount[units] = plateCount[units - plate.units] + 1;
        lastPlate[units] = plate;
      }
    }
  }

  let reachable = targetUnits;
  while (plateCount[reachable] === Infinity) reachable--;

  const platesPerSide = [];
  for (let units = reachable; units > 0; units -= lastPlate[units].units) {
    platesPerSide.push(lastPlate[units].kg);
  }
  platesPerSide.sort((plateA, plateB) => plateB - plateA);

  const loadedKg = roundKg(emptyBarKg + 2 * platesPerSide.reduce((sum, plate) => sum + plate, 0));
  return { platesPerSide, loadedKg, remainderKg: roundKg(targetKg - loadedKg) };
}

export function smallestJumpKg(setup) {
  const smallestPlate = Math.min(...setup.availablePlates);
  return Number.isFinite(smallestPlate) ? smallestPlate * 2 : 0;
}

export function roundToIncrement(kg, incrementKg) {
  if (!incrementKg) return roundKg(kg);
  return roundKg(Math.round(kg / incrementKg) * incrementKg);
}

/**
 * Warm-up ramp toward the working weight: empty bar, then 40-90 % steps
 * rounded to what the plates can make. Steps that would not be heavier
 * than the previous one, or that reach the working weight, are skipped.
 */
export function buildWarmupSets(workingWeightKg, setup) {
  const emptyBarKg = setup.barWeight + collarsWeight(setup);
  if (!(workingWeightKg > emptyBarKg)) return [];

  const incrementKg = smallestJumpKg(setup);
  const sets = [{ weight: emptyBarKg, reps: EMPTY_BAR_WARMUP_REPS, percent: null }];
  for (const step of WARMUP_STEPS) {
    const weight = roundToIncrement((workingWeightKg * step.percent) / 100, incrementKg);
    if (weight <= sets[sets.length - 1].weight || weight >= workingWeightKg) continue;
    sets.push({ weight, reps: step.reps, percent: step.percent });
  }
  return sets;
}
