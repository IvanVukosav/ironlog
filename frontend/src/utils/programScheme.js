import { roundToIncrement } from "./plates";

export const PROGRAM_ROUNDING_KG = 2.5;
// Each drop set takes this share of the weight before it (20 % off).
export const DROP_SHARE = 0.8;
export const MAX_DROPS = 3;

const MAX_SETS = 20;
const MAX_REPS = 100;
const MAX_PERCENT = 120;

// "5x5", "5x5@75", "5x5@75%", "4x8@60kg", "3x3@85 rpe8", "5x5 @rpe 7.5", "3x5@72,5", "1x8 rpe7",
// "1x10@60kg rpe9 drop2" (the set is followed by two drop sets)
const GROUP_PATTERN =
  /^(\d+)\s*[x×*]\s*(\d+)(?:\s*@\s*(\d+(?:[.,]\d+)?)\s*(%|kg)?)?(?:\s*@?\s*rpe\s*(\d+(?:[.,]\d+)?))?(?:\s*\+?\s*drops?\s*(\d+))?$/i;
// Groups are separated by , ; or + — but only where a new "NxM" group starts,
// so a decimal comma ("72,5") stays part of its number.
const GROUP_SEPARATOR = /\s*[,;+]\s*(?=\d+\s*[x×*])/;

function toNumber(text) {
  return text ? parseFloat(text.replace(",", ".")) : null;
}

/**
 * Parses one week's scheme into set groups, e.g. "1x1@90, 3x5@75" →
 * [{ sets: 1, reps: 1, percent: 90, … }, { sets: 3, reps: 5, percent: 75, … }].
 * A bare load number is a percentage; "kg" makes it a fixed weight. Each group also says its
 * RPE (or null) and how many drop sets follow each of its sets.
 * Returns [] for an empty scheme (exercise skipped that week) and null when
 * the text can't be parsed.
 */
export function parseScheme(text) {
  const trimmed = (text ?? "").trim();
  if (!trimmed) return [];

  const groups = [];
  for (const part of trimmed
    .split(GROUP_SEPARATOR)
    .map((piece) => piece.trim())
    .filter(Boolean)) {
    const match = part.match(GROUP_PATTERN);
    if (!match) return null;

    const [, sets, reps, load, unit, rpe, drops] = match;
    const loadValue = toNumber(load);
    const isFixedWeight = unit?.toLowerCase() === "kg";
    const group = {
      sets: parseInt(sets),
      reps: parseInt(reps),
      percent: loadValue !== null && !isFixedWeight ? loadValue : null,
      weight: isFixedWeight ? loadValue : null,
      rpe: toNumber(rpe),
      drops: drops ? parseInt(drops) : 0,
    };

    if (group.sets < 1 || group.sets > MAX_SETS || group.reps < 1 || group.reps > MAX_REPS)
      return null;
    if (group.percent !== null && (group.percent <= 0 || group.percent > MAX_PERCENT)) return null;
    if (group.rpe !== null && (group.rpe < 1 || group.rpe > 10)) return null;
    if (group.drops > MAX_DROPS) return null;
    groups.push(group);
  }
  return groups;
}

export function isValidScheme(text) {
  return parseScheme(text) !== null;
}

/**
 * One week's scheme as the editor shows it: one entry per set, each with its reps, a percentage of
 * the training max or a weight in kg (or neither), an RPE or null, and its drop sets. Null when
 * the text can't be parsed.
 */
export function schemeToSets(text) {
  const groups = parseScheme(text);
  if (!groups) return null;
  return groups.flatMap(({ sets, reps, percent, weight, rpe, drops }) =>
    Array.from({ length: sets }, () => ({ reps, percent, weight, rpe, drops })),
  );
}

const isSameSet = (a, b) =>
  a.reps === b.reps &&
  a.percent === b.percent &&
  a.weight === b.weight &&
  a.rpe === b.rpe &&
  a.drops === b.drops;

function formatGroup(set, count) {
  let text = `${count}x${set.reps}`;
  if (set.percent !== null) text += `@${set.percent}%`;
  else if (set.weight !== null) text += `@${set.weight}kg`;
  if (set.rpe !== null) text += ` rpe${set.rpe}`;
  if (set.drops > 0) text += ` drop${set.drops}`;
  return text;
}

/** The sets back as a scheme, alike sets in a row as one group: "1x8 rpe7, 2x8 rpe4". */
export function setsToScheme(sets) {
  const runs = [];
  for (const set of sets) {
    const last = runs.at(-1);
    if (last && isSameSet(last.set, set)) last.count += 1;
    else runs.push({ set, count: 1 });
  }
  return runs.map(({ set, count }) => formatGroup(set, count)).join(", ");
}

/**
 * Expands set groups into concrete sets. Percentages are taken of
 * e1RM × trainingMaxPercent and rounded to PROGRAM_ROUNDING_KG.
 * `missingE1rm` is true when a percentage set had no e1RM to work from
 * (those sets get weight 0 so the user fills them in). A set's drop sets follow it, each 20 %
 * lighter than the one before (rounded the same way) and marked `isDrop`.
 */
export function buildProgramSets(groups, e1rm, trainingMaxPercent) {
  let missingE1rm = false;
  const sets = groups.flatMap((group) => {
    let weight = group.weight ?? 0;
    if (group.percent !== null) {
      if (e1rm) {
        const trainingMax = (e1rm * trainingMaxPercent) / 100;
        weight = roundToIncrement((trainingMax * group.percent) / 100, PROGRAM_ROUNDING_KG);
      } else {
        missingE1rm = true;
      }
    }
    const withDrops = [{ weight, reps: group.reps, rpe: group.rpe }];
    let dropWeight = weight;
    for (let drop = 0; drop < (group.drops ?? 0); drop += 1) {
      dropWeight = roundToIncrement(dropWeight * DROP_SHARE, PROGRAM_ROUNDING_KG);
      withDrops.push({ weight: dropWeight, reps: group.reps, rpe: null, isDrop: true });
    }
    return Array.from({ length: group.sets }, () => withDrops.map((set) => ({ ...set }))).flat();
  });
  return { sets, missingE1rm };
}
