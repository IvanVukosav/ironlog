import { buildE1rmTimeline } from "./oneRepMax";

export const MAX_FEATURED_EXERCISES = 3;
const CHANGE_WINDOW_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;
const TREND_SESSIONS = 12;

// settings.featuredExercises is a JSON array of names; anything unreadable counts as none.
export function parseFeaturedExercises(settings) {
  try {
    const names = JSON.parse(settings?.featuredExercises ?? "[]");
    return Array.isArray(names) ? names.filter((name) => typeof name === "string") : [];
  } catch {
    return [];
  }
}

/**
 * Card numbers for one exercise (`sets` in the /api/stats/prs shape): the best e1RM, how much it
 * grew over the last 30 days (null when the exercise is newer than that) and the e1RM of the
 * latest sessions for the trend line. Null when no set has an e1RM.
 */
export function summarizeExercise(sets, formula, now = Date.now()) {
  const timeline = buildE1rmTimeline(sets, formula);
  if (timeline.length === 0) return null;
  const best = Math.max(...timeline.map((point) => point.e1rm));
  const cutoff = now - CHANGE_WINDOW_DAYS * DAY_MS;
  const earlier = timeline.filter((point) => point.time < cutoff);
  return {
    best,
    change: earlier.length > 0 ? best - Math.max(...earlier.map((point) => point.e1rm)) : null,
    trend: timeline.slice(-TREND_SESSIONS).map((point) => point.e1rm),
  };
}

// The saved featured exercises that still exist; with none, the most trained exercises
// (most session days) that have an e1RM, flagged as picked automatically.
export function resolveFeaturedExercises(exerciseSets, savedNames, formula) {
  const saved = savedNames.filter((name) =>
    exerciseSets.some((exercise) => exercise.name === name),
  );
  if (saved.length > 0) return { names: saved, isAuto: false };

  const names = exerciseSets
    .filter((exercise) => summarizeExercise(exercise.sets, formula) !== null)
    .map((exercise) => ({
      name: exercise.name,
      sessions: new Set(exercise.sets.map((set) => set.date)).size,
    }))
    .sort((a, b) => b.sessions - a.sessions || a.name.localeCompare(b.name))
    .slice(0, MAX_FEATURED_EXERCISES)
    .map(({ name }) => name);
  return { names, isAuto: true };
}
