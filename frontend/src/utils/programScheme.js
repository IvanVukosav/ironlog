import { roundToIncrement } from "./plates";

export const PROGRAM_ROUNDING_KG = 2.5;

const MAX_SETS = 20;
const MAX_REPS = 100;
const MAX_PERCENT = 120;

// "5x5", "5x5@75", "5x5@75%", "4x8@60kg", "3x3@85 rpe8", "5x5 @rpe 7.5", "3x5@72,5"
const GROUP_PATTERN = /^(\d+)\s*[x×*]\s*(\d+)(?:\s*@\s*(\d+(?:[.,]\d+)?)\s*(%|kg)?)?(?:\s*@?\s*rpe\s*(\d+(?:[.,]\d+)?))?$/i;
// Groups are separated by , ; or + — but only where a new "NxM" group starts,
// so a decimal comma ("72,5") stays part of its number.
const GROUP_SEPARATOR = /\s*[,;+]\s*(?=\d+\s*[x×*])/;

function toNumber(text) {
  return text ? parseFloat(text.replace(",", ".")) : null;
}

/**
 * Parses one week's scheme into set groups, e.g. "1x1@90, 3x5@75" →
 * [{ sets: 1, reps: 1, percent: 90 }, { sets: 3, reps: 5, percent: 75 }].
 * A bare load number is a percentage; "kg" makes it a fixed weight.
 * Returns [] for an empty scheme (exercise skipped that week) and null when
 * the text can't be parsed.
 */
export function parseScheme(text) {
  const trimmed = (text ?? "").trim();
  if (!trimmed) return [];

  const groups = [];
  for (const part of trimmed.split(GROUP_SEPARATOR).map((piece) => piece.trim()).filter(Boolean)) {
    const match = part.match(GROUP_PATTERN);
    if (!match) return null;

    const [, sets, reps, load, unit, rpe] = match;
    const loadValue = toNumber(load);
    const isFixedWeight = unit?.toLowerCase() === "kg";
    const group = {
      sets: parseInt(sets),
      reps: parseInt(reps),
      percent: loadValue !== null && !isFixedWeight ? loadValue : null,
      weight: isFixedWeight ? loadValue : null,
      rpe: toNumber(rpe),
    };

    if (group.sets < 1 || group.sets > MAX_SETS || group.reps < 1 || group.reps > MAX_REPS) return null;
    if (group.percent !== null && (group.percent <= 0 || group.percent > MAX_PERCENT)) return null;
    if (group.rpe !== null && (group.rpe < 1 || group.rpe > 10)) return null;
    groups.push(group);
  }
  return groups;
}

export function isValidScheme(text) {
  return parseScheme(text) !== null;
}

/**
 * Expands set groups into concrete sets. Percentages are taken of
 * e1RM × trainingMaxPercent and rounded to PROGRAM_ROUNDING_KG.
 * `missingE1rm` is true when a percentage set had no e1RM to work from
 * (those sets get weight 0 so the user fills them in).
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
    return Array.from({ length: group.sets }, () => ({ weight, reps: group.reps, rpe: group.rpe }));
  });
  return { sets, missingE1rm };
}
