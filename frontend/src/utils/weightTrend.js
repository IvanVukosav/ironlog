const MS_PER_DAY = 24 * 60 * 60 * 1000;
const DAYS_PER_WEEK = 7;
// Share of each day's deviation absorbed into the trend (Hacker's Diet uses 10 %).
const DAILY_SMOOTHING = 0.1;
const TREND_DECIMAL_PLACES = 2;

function round(value) {
  const factor = 10 ** TREND_DECIMAL_PLACES;
  return Math.round(value * factor) / factor;
}

/**
 * Adds a `trend` (exponentially smoothed weight) to each entry, oldest first.
 * Gaps between weigh-ins count as that many days of smoothing, so a weigh-in
 * after a week away moves the trend more than one after a single day.
 */
export function addWeightTrend(entries) {
  const sorted = [...entries].sort(
    (entryA, entryB) => new Date(entryA.date) - new Date(entryB.date),
  );
  let trend = null;
  let previousTime = null;
  return sorted.map((entry) => {
    const time = new Date(entry.date).getTime();
    if (trend === null) {
      trend = entry.weight;
    } else {
      const days = Math.max((time - previousTime) / MS_PER_DAY, 0);
      const smoothing = 1 - (1 - DAILY_SMOOTHING) ** days;
      trend += smoothing * (entry.weight - trend);
    }
    previousTime = time;
    return { ...entry, trend: round(trend) };
  });
}

/**
 * Trend change over the last week in kg, comparing the latest trend with the
 * last trend value at least a week older. Null when the data doesn't reach back a week.
 */
export function weeklyTrendChange(entriesWithTrend) {
  const latest = entriesWithTrend.at(-1);
  if (!latest) return null;
  const weekBefore = new Date(latest.date).getTime() - DAYS_PER_WEEK * MS_PER_DAY;
  const reference = entriesWithTrend.findLast(
    (entry) => new Date(entry.date).getTime() <= weekBefore,
  );
  return reference ? round(latest.trend - reference.trend) : null;
}
