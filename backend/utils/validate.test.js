const test = require("node:test");
const assert = require("node:assert/strict");
const { HttpError } = require("./errorHandler");
const {
  parseId,
  parseYearMonth,
  parseDateKey,
  parseDateRangeQuery,
  toNumber,
  parseSet,
  parseMacros,
} = require("./validate");

test("toNumber reads a decimal comma, keeps numbers, and gives NaN for anything else", () => {
  assert.equal(toNumber("90,6"), 90.6);
  assert.equal(toNumber(" 85.5 "), 85.5);
  assert.equal(toNumber(92), 92);
  for (const bad of ["", "  ", "90kg", "abc", undefined, null, {}]) {
    assert.ok(Number.isNaN(toNumber(bad)), `read ${JSON.stringify(bad)} as a number`);
  }
});

const isBadRequest = (err) => err instanceof HttpError && err.status === 400;

test("parseId takes a positive whole number out of text and refuses the rest", () => {
  assert.equal(parseId("12"), 12);
  assert.equal(parseId(7), 7);
  for (const bad of ["0", "-1", "1.5", "abc", "12abc", "", undefined, null]) {
    assert.throws(() => parseId(bad), isBadRequest, `accepted ${JSON.stringify(bad)}`);
  }
});

test("parseYearMonth needs both numbers and a month of 1 to 12", () => {
  assert.deepEqual(parseYearMonth({ year: "2026", month: "11" }), { year: 2026, month: 11 });
  assert.throws(() => parseYearMonth({ year: "2026" }), isBadRequest);
  assert.throws(() => parseYearMonth({ year: "2026", month: "13" }), isBadRequest);
  assert.throws(() => parseYearMonth({}), isBadRequest);
});

test("parseDateKey takes only YYYY-MM-DD and names the field in the error", () => {
  assert.equal(parseDateKey("2026-11-04"), "2026-11-04");
  assert.throws(() => parseDateKey("2026-13-04"), isBadRequest);
  assert.throws(() => parseDateKey("4/11/2026"), isBadRequest);
  assert.throws(() => parseDateKey(undefined, "fromDate"), /fromDate must be a date/);
});

test("parseDateRangeQuery gives the month, or the last days up to now", () => {
  assert.deepEqual(parseDateRangeQuery({ year: "2026", month: "2" }), {
    gte: new Date(Date.UTC(2026, 1, 1)),
    lt: new Date(Date.UTC(2026, 2, 1)),
  });
  const recent = parseDateRangeQuery({ days: "7" });
  const daysAgo = (Date.now() - recent.gte.getTime()) / (24 * 60 * 60 * 1000);
  assert.ok(daysAgo > 6.9 && daysAgo < 7.1, `got ${daysAgo} days`);
  assert.equal("lt" in recent, false);
  assert.throws(() => parseDateRangeQuery({ year: "2026" }), isBadRequest);
});

test("parseSet reads a set as typed, with a decimal comma or point", () => {
  assert.deepEqual(parseSet({ weight: "102,5", reps: "5", rpe: "7,5" }), {
    weight: 102.5,
    reps: 5,
    rpe: 7.5,
    isWarmup: false,
  });
  assert.deepEqual(parseSet({ weight: " 92.5 ", reps: 4, rpe: 8, isWarmup: true }), {
    weight: 92.5,
    reps: 4,
    rpe: 8,
    isWarmup: true,
  });
});

test("parseSet leaves RPE out when none was given", () => {
  for (const rpe of [undefined, null, ""]) {
    assert.equal(parseSet({ weight: "100", reps: "5", rpe }).rpe, null);
  }
});

test("parseSet takes zero, so bodyweight and failed sets can be logged", () => {
  assert.deepEqual(parseSet({ weight: "0", reps: "0" }), {
    weight: 0,
    reps: 0,
    rpe: null,
    isWarmup: false,
  });
});

test("parseSet refuses what is not a weight, whole reps or an RPE of 1 to 10", () => {
  const bad = [
    { weight: "", reps: "5" },
    { reps: "5" },
    { weight: "12abc", reps: "5" },
    { weight: "-1", reps: "5" },
    { weight: "100", reps: "" },
    { weight: "100", reps: "pet" },
    { weight: "100", reps: "5,5" },
    { weight: "100", reps: "-1" },
    { weight: "100", reps: "5", rpe: "11" },
    { weight: "100", reps: "5", rpe: "0" },
    { weight: "100", reps: "5", rpe: "  " },
  ];
  for (const body of bad) {
    assert.throws(() => parseSet(body), isBadRequest, `accepted ${JSON.stringify(body)}`);
  }
  assert.throws(() => parseSet({ weight: "100", reps: "pet" }), /Reps must be a whole number/);
});

test("parseMacros trims the name and wants four numbers", () => {
  assert.deepEqual(
    parseMacros({ name: " Rice ", kcal: "130", protein: 2.7, carbs: "28", fat: 0.3 }),
    {
      name: "Rice",
      kcal: 130,
      protein: 2.7,
      carbs: 28,
      fat: 0.3,
    },
  );
  assert.throws(
    () => parseMacros({ name: "  ", kcal: 1, protein: 1, carbs: 1, fat: 1 }),
    isBadRequest,
  );
  assert.throws(
    () => parseMacros({ name: 5, kcal: 1, protein: 1, carbs: 1, fat: 1 }),
    isBadRequest,
  );
  assert.throws(
    () => parseMacros({ name: "Rice", kcal: "abc", protein: 1, carbs: 1, fat: 1 }),
    isBadRequest,
  );
  assert.throws(() => parseMacros({ name: "Rice", kcal: 1, protein: 1, carbs: 1 }), isBadRequest);
});

test("parseMacros reads a decimal comma and refuses what it used to cut short", () => {
  assert.deepEqual(
    parseMacros({ name: "Jaja", kcal: "155", protein: "12,6", carbs: "1,1", fat: "10,6" }),
    { name: "Jaja", kcal: 155, protein: 12.6, carbs: 1.1, fat: 10.6 },
  );
  assert.throws(
    () => parseMacros({ name: "Rice", kcal: "130kcal", protein: 2, carbs: 28, fat: 0 }),
    isBadRequest,
  );
  assert.throws(
    () => parseMacros({ name: "Rice", kcal: "", protein: 2, carbs: 28, fat: 0 }),
    isBadRequest,
  );
});
