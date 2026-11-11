const test = require("node:test");
const assert = require("node:assert/strict");
const { HttpError } = require("./errorHandler");
const {
  parseId,
  parseYearMonth,
  parseDateKey,
  parseDateRangeQuery,
  parseMacros,
} = require("./validate");

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
