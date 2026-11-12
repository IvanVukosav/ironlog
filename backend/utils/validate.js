const { HttpError } = require("./errorHandler");
const { getMonthRange, isDateKey } = require("./dateRange");

const MONTHS_PER_YEAR = 12;
const DEFAULT_RECENT_DAYS = 30;
const MACRO_FIELDS = ["kcal", "protein", "carbs", "fat"];
const RPE_MIN = 1;
const RPE_MAX = 10;

// Request values arrive as text (path, query) or as whatever the JSON carried. Each helper
// returns the checked value or throws the 400 that says what is wrong; a route's own checks
// answer with `return res.status(400)` instead.

function parsePositiveInt(value, name) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1) {
    throw new HttpError(400, `${name} must be a whole number of 1 or more`);
  }
  return number;
}

function parseId(value) {
  return parsePositiveInt(value, "id");
}

// ?year=2026&month=11
function parseYearMonth(query) {
  const year = parsePositiveInt(query?.year, "year");
  const month = parsePositiveInt(query?.month, "month");
  if (month > MONTHS_PER_YEAR) {
    throw new HttpError(400, `month must be between 1 and ${MONTHS_PER_YEAR}`);
  }
  return { year, month };
}

function parseDateKey(value, name = "date") {
  if (!isDateKey(value)) throw new HttpError(400, `${name} must be a date like 2026-11-04`);
  return value;
}

// ?year=&month= lists that month; otherwise the last ?days= (30 by default) up to now.
function parseDateRangeQuery(query) {
  if (query?.year !== undefined || query?.month !== undefined) {
    const { year, month } = parseYearMonth(query);
    return getMonthRange(Date.UTC(year, month - 1, 1));
  }
  const days = parseInt(query?.days) || DEFAULT_RECENT_DAYS;
  const since = new Date();
  since.setDate(since.getDate() - days);
  return { gte: since };
}

// A number as typed. A Croatian keyboard or phone keypad gives a decimal comma, which parseFloat
// would stop at ("102,5" saved as 102), so it counts as a point. Empty text is no number at all,
// where Number("") would be 0, and so is text with anything else in it ("12abc").
function toNumber(value) {
  if (typeof value === "number") return value;
  if (typeof value !== "string" || value.trim() === "") return NaN;
  return Number(value.trim().replace(",", "."));
}

// A logged set: weight and reps, and RPE when one was given.
function parseSet(body) {
  const weight = toNumber(body?.weight);
  const reps = toNumber(body?.reps);
  const hasRpe = body?.rpe !== undefined && body?.rpe !== null && body?.rpe !== "";
  const rpe = hasRpe ? toNumber(body.rpe) : null;

  if (!(weight >= 0)) throw new HttpError(400, "Weight must be a number of 0 or more");
  if (!Number.isInteger(reps) || reps < 0) {
    throw new HttpError(400, "Reps must be a whole number of 0 or more");
  }
  if (rpe !== null && !(rpe >= RPE_MIN && rpe <= RPE_MAX)) {
    throw new HttpError(400, `RPE must be between ${RPE_MIN} and ${RPE_MAX}`);
  }
  return { weight, reps, rpe, isWarmup: Boolean(body?.isWarmup) };
}

// A food item or a food template: a name and four numbers.
function parseMacros(body) {
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!name) throw new HttpError(400, "Name is required");
  const macros = Object.fromEntries(MACRO_FIELDS.map((field) => [field, parseFloat(body[field])]));
  if (Object.values(macros).some(Number.isNaN)) {
    throw new HttpError(400, "Kcal, protein, carbs and fat must be valid numbers");
  }
  return { name, ...macros };
}

module.exports = {
  parsePositiveInt,
  parseId,
  parseYearMonth,
  parseDateKey,
  parseDateRangeQuery,
  parseSet,
  parseMacros,
};
