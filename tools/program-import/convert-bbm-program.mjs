// Turns a Barbell Medicine program on the template with a PROGRAM and a SCHEDULE sheet (HLM, 12wk
// Press; both hidden) into an Iron Log program. PROGRAM has a row per week and, per category
// ("COMPETITION SQUAT", "SUPPLEMENTAL BENCH- METHOD 3"…), a METHOD column (the lift) and, two to
// its right, a REPS & RPE column (the prescription). SCHEDULE says which category each day's three
// slots have ("DAY 2 / EXERCISE 3"), a row per week; later weeks take its last row. A MEET WEEK
// sheet, which has its own lifts, is read as the last week, following the cells its METHOD and
// REPS & RPE rows point at. The WEEK sheets themselves aren't read: the values they saved can be
// out of date (HLM's weeks 5–7 show no competition lifts) and one of HLM's week 8 cells points at
// the wrong category. Writes the program as JSON (for POST /api/programs) and prints a table to
// check it by; a line it doesn't understand stops it.
// Usage: node convert-bbm-program.mjs <unzipped folder> "<program name>" <program.json>
import { openWorkbook, columnNumber, columnLetters } from "./xlsx.mjs";
import { daysOfSlots } from "./bbm.mjs";
import { writeProgram } from "./program.mjs";

const [folder, programName, outPath] = process.argv.slice(2);
if (!outPath || !programName) {
  throw new Error('usage: node convert-bbm-program.mjs <unzipped folder> "<name>" <program.json>');
}
const book = openWorkbook(folder);
const program = book.cells("PROGRAM");
const schedule = book.cells("SCHEDULE");
const refsOf = (cells) =>
  Object.entries(cells).map(([ref, value]) => {
    const [, letters, row] = /^([A-Z]+)(\d+)$/.exec(ref);
    return { column: columnNumber(letters), row: Number(row), value: value.trim() };
  });
// "SUPPLEMENTAL  BENCH- METHOD 3" and "SUPPLEMENTAL BENCH - METHOD 3" are one category.
const categoryKey = (name) =>
  name
    .toUpperCase()
    .replace(/\s+/g, " ")
    .replace(/\s*-\s*/g, "-")
    .trim();

// The weeks: one per WEEK sheet, then the meet week.
const weekSheets = book.sheets.filter((sheet) => /^week \d+$/i.test(sheet.name));
const meetWeek = book.sheets.find((sheet) => /^meet week$/i.test(sheet.name));
const WEEKS = weekSheets.length + (meetWeek ? 1 : 0);

// PROGRAM: each category's METHOD column (row 2 names it), and each week's row (column A).
const methodColumns = new Map(
  refsOf(program)
    .filter((cell) => cell.row === 2 && cell.column > 1)
    .map((cell) => [categoryKey(cell.value), cell.column]),
);
const weekRows = new Map(
  refsOf(program)
    .filter((cell) => cell.column === 1 && /^(week )?\d+$/i.test(cell.value))
    .map((cell) => [Number(/\d+/.exec(cell.value)[0]), cell.row]),
);

// SCHEDULE: row 4 names each column's day and slot; each later row is a week (column A).
const slotColumns = refsOf(schedule)
  .filter((cell) => cell.row === 4)
  .map((cell) => {
    const m = /DAY (\d+) \/ EXERCISE (\d+)/i.exec(cell.value);
    if (!m) throw new Error(`SCHEDULE: "${cell.value}" isn't a day and an exercise`);
    return { column: cell.column, day: Number(m[1]) - 1, slot: Number(m[2]) - 1 };
  });
const scheduleRows = refsOf(schedule)
  .filter((cell) => cell.column === 1 && cell.row > 4 && /^\d+$/.test(cell.value))
  .map((cell) => ({ week: Number(cell.value), row: cell.row }))
  .sort((a, b) => a.week - b.week);
const scheduleRowOf = (week) =>
  (scheduleRows.find((entry) => entry.week === week) ?? scheduleRows.at(-1)).row;

const dayCount = Math.max(...slotColumns.map(({ day }) => day)) + 1;
// slots[day][slot][week] = { name, prescription }
const slots = Array.from({ length: dayCount }, () => [[], [], []]);
const nothing = { name: "", prescription: "" };
for (let week = 1; week <= weekSheets.length; week += 1) {
  const programRow = weekRows.get(week);
  if (!programRow) throw new Error(`PROGRAM has no row for week ${week}`);
  for (const { column, day, slot } of slotColumns) {
    const category = schedule[columnLetters(column) + scheduleRowOf(week)]?.trim() ?? "NONE";
    if (/^none$/i.test(category)) {
      slots[day][slot][week - 1] = nothing;
      continue;
    }
    const methodColumn = methodColumns.get(categoryKey(category));
    if (!methodColumn) throw new Error(`PROGRAM has no category "${category}"`);
    slots[day][slot][week - 1] = {
      name: program[columnLetters(methodColumn) + programRow] ?? "",
      prescription: program[columnLetters(methodColumn + 2) + programRow] ?? "",
    };
  }
}
if (meetWeek) {
  // The meet week's days one under the other: a METHOD row and a REPS & RPE row (column D), the
  // slots in columns E, K and Q.
  const cells = book.cells(meetWeek.name);
  const labelRows = (label) =>
    refsOf(cells)
      .filter((cell) => cell.column === 4 && cell.value === label)
      .map((cell) => cell.row)
      .sort((a, b) => a - b);
  const repsRows = labelRows("REPS & RPE");
  labelRows("METHOD").forEach((methodRow, day) => {
    const repsRow = repsRows.find((row) => row > methodRow && row <= methodRow + 4);
    if (!repsRow || day >= dayCount) throw new Error(`MEET WEEK: day ${day + 1} not understood`);
    ["E", "K", "Q"].forEach((letters, slot) => {
      slots[day][slot][WEEKS - 1] = {
        name: book.source(meetWeek.name, letters + methodRow),
        prescription: book.source(meetWeek.name, letters + repsRow),
      };
    });
  });
}
for (const daySlots of slots) {
  for (const slotWeeks of daySlots) {
    for (let week = 0; week < WEEKS; week += 1) slotWeeks[week] ??= nothing;
  }
}

const days = daysOfSlots(slots, WEEKS);
writeProgram({ name: programName, weeks: WEEKS, trainingMaxPercent: 100, days }, outPath);
