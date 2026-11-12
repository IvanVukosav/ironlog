// Workout, weigh-in and meal dates are stored at UTC midnight, so these read the UTC fields.

// "4/11": day/month, the way charts and lists show a date.
export function formatDayMonth(date) {
  const value = new Date(date);
  return `${value.getUTCDate()}/${value.getUTCMonth() + 1}`;
}

// "Srijeda, 4. studenoga" or "Wednesday, November 4": a day written out in the given language.
// The year is added only when it is not `thisYear`, the one nobody needs told.
export function formatWeekdayDate(date, language, thisYear = todayParts().year) {
  const value = new Date(date);
  const text = new Intl.DateTimeFormat(language, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: value.getUTCFullYear() === thisYear ? undefined : "numeric",
    timeZone: "UTC",
  }).format(value);
  // Croatian writes weekdays in lower case; at the start of a line they still take a capital.
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// "28. lis" or "Oct 28": a day with its month, short, in the given language. The year is added
// only when it is not `thisYear`.
export function formatShortDate(date, language, thisYear = todayParts().year) {
  const value = new Date(date);
  return new Intl.DateTimeFormat(language, {
    day: "numeric",
    month: "short",
    year: value.getUTCFullYear() === thisYear ? undefined : "numeric",
    timeZone: "UTC",
  }).format(value);
}

// "2026-11-04": the date format the API takes, from a year, a 1-based month and a day.
export function toDateKey(year, month, day) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

// The same key for a Date's UTC calendar day.
export function dateKeyOf(date) {
  return toDateKey(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
}

// Today on the user's clock, as { year, month, day } and as a key. The one place the local
// clock comes in: the keys become UTC midnights, which is what everything else compares by.
export function todayParts() {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() };
}

export function todayKey() {
  const { year, month, day } = todayParts();
  return toDateKey(year, month, day);
}
