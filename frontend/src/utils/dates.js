// Workout, weigh-in and meal dates are stored at UTC midnight, so these read the UTC fields.

// "4/11": day/month, the way charts and lists show a date.
export function formatDayMonth(date) {
  const value = new Date(date);
  return `${value.getUTCDate()}/${value.getUTCMonth() + 1}`;
}

// "2026-11-04": the date format the API takes, from a year, a 1-based month and a day.
export function toDateKey(year, month, day) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

// The same key for a Date's UTC calendar day.
export function dateKeyOf(date) {
  return toDateKey(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
}
