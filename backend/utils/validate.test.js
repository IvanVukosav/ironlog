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
  parseSetChange,
  parseOptionalDateTime,
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
    isDrop: false,
  });
  assert.deepEqual(parseSet({ weight: " 92.5 ", reps: 4, rpe: 8, isWarmup: true }), {
    weight: 92.5,
    reps: 4,
    rpe: 8,
    isWarmup: true,
    isDrop: false,
  });
});

test("parseSet marks a drop set, which can't also be a warm-up", () => {
  assert.equal(parseSet({ weight: "80", reps: "8", isDrop: true }).isDrop, true);
  assert.throws(
    () => parseSet({ weight: "80", reps: "8", isDrop: true, isWarmup: true }),
    /both a warm-up and a drop set/,
  );
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
    isDrop: false,
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

test("parseSet passes isDone on only when the body names it, and then only as true or false", () => {
  assert.equal("isDone" in parseSet({ weight: "100", reps: "5" }), false);
  assert.equal(parseSet({ weight: "100", reps: "5", isDone: false }).isDone, false);
  assert.equal(parseSet({ weight: "100", reps: "5", isDone: true }).isDone, true);
  assert.throws(() => parseSet({ weight: "100", reps: "5", isDone: "false" }), isBadRequest);
});

test("a back-off set keeps how much lighter it is than its top set", () => {
  assert.equal(parseSet({ weight: "132,5", reps: "5", backoffPercent: "20" }).backoffPercent, 20);
  assert.equal(parseSet({ weight: "130", reps: "5", backoffPercent: 12.5 }).backoffPercent, 12.5);
  assert.equal("backoffPercent" in parseSet({ weight: "100", reps: "5" }), false);
  for (const backoffPercent of [0, 100, -5, "dvadeset"]) {
    assert.throws(() => parseSet({ weight: "100", reps: "5", backoffPercent }), isBadRequest);
  }
  // Changed by hand, it stops following its top set.
  assert.deepEqual(parseSetChange({ backoffPercent: null }), { backoffPercent: null });
  assert.deepEqual(parseSetChange({ weight: "135", backoffPercent: null }), {
    weight: 135,
    backoffPercent: null,
  });
});

test("a set saved later brings the moment it was done", () => {
  const done = parseSet({ weight: "100", reps: "5", completedAt: "2026-11-20T17:04:00.000Z" });
  assert.equal(done.completedAt.toISOString(), "2026-11-20T17:04:00.000Z");
  assert.equal("completedAt" in parseSet({ weight: "100", reps: "5", completedAt: null }), false);
  assert.throws(() => parseSet({ weight: "100", reps: "5", completedAt: "jučer" }), isBadRequest);
  const ticked = parseSetChange({ isDone: true, completedAt: "2026-11-20T17:05:00.000Z" });
  assert.equal(ticked.completedAt.toISOString(), "2026-11-20T17:05:00.000Z");
  assert.throws(() => parseSetChange({ completedAt: "2026-11-20T17:05:00.000Z" }), isBadRequest);
});

test("parseSetChange checks and returns only the fields that were sent", () => {
  assert.deepEqual(parseSetChange({ isDone: true }), { isDone: true });
  assert.deepEqual(parseSetChange({ weight: "142,5" }), { weight: 142.5 });
  assert.deepEqual(parseSetChange({ reps: 3, rpe: "" }), { reps: 3, rpe: null });
  assert.deepEqual(
    parseSetChange({ weight: 100, reps: "5", rpe: "8,5", isWarmup: false, isDone: false }),
    { weight: 100, reps: 5, rpe: 8.5, isWarmup: false, isDone: false },
  );
  assert.deepEqual(parseSetChange({ isDrop: true, isWarmup: false }), {
    isDrop: true,
    isWarmup: false,
  });
});

test("parseSetChange refuses an empty change and values a set cannot have", () => {
  const bad = [
    {},
    null,
    [],
    { weight: "-5" },
    { reps: "5,5" },
    { rpe: "11" },
    { isDone: 1 },
    { isWarmup: "yes" },
    { isDrop: "yes" },
    { isDrop: true, isWarmup: true },
  ];
  for (const body of bad) {
    assert.throws(() => parseSetChange(body), isBadRequest, `accepted ${JSON.stringify(body)}`);
  }
});

test("parseOptionalDateTime reads an ISO moment, keeps null, and refuses the rest", () => {
  assert.equal(
    parseOptionalDateTime("2026-11-16T17:04:00.000Z", "startedAt").toISOString(),
    "2026-11-16T17:04:00.000Z",
  );
  assert.equal(parseOptionalDateTime(null, "finishedAt"), null);
  for (const bad of ["yesterday", "", 1763312640000, undefined, {}]) {
    assert.throws(
      () => parseOptionalDateTime(bad, "startedAt"),
      /startedAt must be a date and time/,
      `accepted ${JSON.stringify(bad)}`,
    );
  }
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
