import { calculateEstimatedOneRepMax } from "./oneRepMax";

const DAY_MS = 24 * 60 * 60 * 1000;
const DAYS_PER_WEEK = 7;

// The periods Stats can show, by how many days they reach back (today included).
export const STATS_PERIODS = { "30d": 30, "90d": 90, "1y": 365 };
export const DEFAULT_STATS_PERIOD = "30d";

// How the volume chart splits each period: weeks for the short ones, months for a year.
const VOLUME_BUCKETS = {
  "30d": { unit: "week", count: 5 },
  "90d": { unit: "week", count: 13 },
  "1y": { unit: "month", count: 12 },
};

const dayOf = (date) => new Date(date).getTime();

// The first day of a period of `days` days that ends today. Days are UTC midnights, the way
// workouts are stored; `todayStart` is today's (Date.parse(todayKey())).
export function periodStart(todayStart, days) {
  return todayStart - (days - 1) * DAY_MS;
}

/**
 * What happened from `since` on, out of /api/stats/prs data (each exercise with all its sets,
 * each set carrying its workout's date):
 * - workouts: the days with a logged set,
 * - volume: kg moved in working sets (weight × reps; warm-ups left out),
 * - records: every session that beat the exercise's best e1RM until then, newest first, as
 *   { name, date, e1rm, weight, reps, rpe } with its best set. An exercise's first session only
 *   sets the bar, so it is not a record.
 */
export function summarizePeriod(exerciseSets, formula, since) {
  const workoutDays = new Set();
  let volume = 0;
  const records = [];

  for (const { name, sets } of exerciseSets) {
    const bestByDay = new Map();
    for (const set of sets) {
      const day = dayOf(set.date);
      if (day >= since) {
        workoutDays.add(day);
        if (!set.isWarmup) volume += set.weight * set.reps;
      }
      if (set.isWarmup) continue;
      const e1rm = calculateEstimatedOneRepMax(set.weight, set.reps, set.rpe, formula);
      if (e1rm === null) continue;
      const best = bestByDay.get(day);
      if (!best || e1rm > best.e1rm) bestByDay.set(day, { ...set, e1rm });
    }

    // Sessions before the period count too: they set the bar a record has to beat.
    let runningBest = null;
    for (const [day, best] of [...bestByDay].sort(([dayA], [dayB]) => dayA - dayB)) {
      if (runningBest !== null && best.e1rm > runningBest && day >= since) {
        const { weight, reps, rpe, e1rm } = best;
        records.push({ name, date: day, e1rm, weight, reps, rpe });
      }
      runningBest = runningBest === null ? best.e1rm : Math.max(runningBest, best.e1rm);
    }
  }

  records.sort((recordA, recordB) => recordB.date - recordA.date || recordB.e1rm - recordA.e1rm);
  return { workouts: workoutDays.size, volume, records };
}

/**
 * Working-set volume per week (Monday to Sunday) or per calendar month, oldest first, ending with
 * the one that holds today: { unit: "week" | "month", buckets: [{ start, volume }] }.
 */
export function volumeBuckets(exerciseSets, period, todayStart) {
  const { unit, count } = VOLUME_BUCKETS[period];
  const today = new Date(todayStart);
  const startOf = (back) => {
    if (unit === "month") {
      return Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - back, 1);
    }
    const daysSinceMonday = (today.getUTCDay() + DAYS_PER_WEEK - 1) % DAYS_PER_WEEK;
    return todayStart - (daysSinceMonday + back * DAYS_PER_WEEK) * DAY_MS;
  };
  const starts = Array.from({ length: count }, (_, index) => startOf(count - 1 - index));
  // Where the last bucket ends; a set dated later is left out.
  const end = startOf(-1);

  const buckets = starts.map((start) => ({ start, volume: 0 }));
  for (const { sets } of exerciseSets) {
    for (const set of sets) {
      const day = dayOf(set.date);
      if (set.isWarmup || day < starts[0] || day >= end) continue;
      let index = starts.length - 1;
      while (starts[index] > day) index -= 1;
      buckets[index].volume += set.weight * set.reps;
    }
  }
  return { unit, buckets };
}
