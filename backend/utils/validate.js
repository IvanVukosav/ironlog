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

function parseWeight(value) {
  const weight = toNumber(value);
  if (!(weight >= 0)) throw new HttpError(400, "Weight must be a number of 0 or more");
  return weight;
}

function parseReps(value) {
  const reps = toNumber(value);
  if (!Number.isInteger(reps) || reps < 0) {
    throw new HttpError(400, "Reps must be a whole number of 0 or more");
  }
  return reps;
}

// No RPE at all is null; one that was given must be 1 to 10.
function parseRpe(value) {
  if (value === undefined || value === null || value === "") return null;
  const rpe = toNumber(value);
  if (!(rpe >= RPE_MIN && rpe <= RPE_MAX)) {
    throw new HttpError(400, `RPE must be between ${RPE_MIN} and ${RPE_MAX}`);
  }
  return rpe;
}

function parseBoolean(value, name) {
  if (typeof value !== "boolean") throw new HttpError(400, `${name} must be true or false`);
  return value;
}

// A logged set: weight and reps, and RPE when one was given. `isDone` is there only when the body
// says it: a set from a program is a plan (false) until it is ticked off.
function parseSet(body) {
  const set = {
    weight: parseWeight(body?.weight),
    reps: parseReps(body?.reps),
    rpe: parseRpe(body?.rpe),
    isWarmup: Boolean(body?.isWarmup),
  };
  if (body && "isDone" in body) set.isDone = parseBoolean(body.isDone, "isDone");
  return set;
}

// A change to some of a set's fields: only the ones the body names are checked and returned, so
// ticking a set off is just { isDone: true }.
function parseSetChange(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new HttpError(400, "A set change must be an object");
  }
  const change = {};
  if ("weight" in body) change.weight = parseWeight(body.weight);
  if ("reps" in body) change.reps = parseReps(body.reps);
  if ("rpe" in body) change.rpe = parseRpe(body.rpe);
  if ("isWarmup" in body) change.isWarmup = parseBoolean(body.isWarmup, "isWarmup");
  if ("isDone" in body) change.isDone = parseBoolean(body.isDone, "isDone");
  if (Object.keys(change).length === 0) throw new HttpError(400, "Nothing to change in the set");
  return change;
}

// A moment as an ISO text ("2026-11-16T17:04:00.000Z"), or null to clear it.
function parseOptionalDateTime(value, name) {
  if (value === null) return null;
  const date = typeof value === "string" ? new Date(value) : new Date(NaN);
  if (Number.isNaN(date.getTime())) {
    throw new HttpError(400, `${name} must be a date and time, or null`);
  }
  return date;
}

// A food item or a food template: a name and four numbers.
function parseMacros(body) {
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!name) throw new HttpError(400, "Name is required");
  const macros = Object.fromEntries(MACRO_FIELDS.map((field) => [field, toNumber(body[field])]));
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
  toNumber,
  parseSet,
  parseSetChange,
  parseOptionalDateTime,
  parseMacros,
};
