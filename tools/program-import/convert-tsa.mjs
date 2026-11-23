// Turns TSA's 9 Week Intermediate Program (the LiftVault spreadsheet) into an Iron Log program.
// Its TRAINING sheet has the weeks side by side ("WEEK 1" in row 21, then SETS, REPS and %1RM
// columns from row 24) and the days one under the other ("DAY 1" … in the first week's column);
// each exercise takes a block of rows, its sets on the first and, for a second kind of set, the
// next. The sheet's extra "POST-MEET" weeks are left out. Writes the program as JSON (for POST
// /api/programs) and prints a table to check it by. Anything not understood stops the script.
// Usage: node convert-tsa.mjs <unzipped folder> "<program name>" <program.json>
import { openWorkbook, columnNumber, columnLetters } from "./xlsx.mjs";
import { addRow, buildDays, writeProgram } from "./program.mjs";

const [folder, programName, outPath] = process.argv.slice(2);
if (!outPath || !programName) {
  throw new Error('usage: node convert-tsa.mjs <unzipped folder> "<name>" <program.json>');
}
const cells = openWorkbook(folder).cells("TRAINING");
const parsed = Object.entries(cells).map(([ref, value]) => {
  const [, letters, row] = /^([A-Z]+)(\d+)$/.exec(ref);
  return { column: columnNumber(letters), row: Number(row), value: value.trim() };
});
const get = (column, row) => (cells[columnLetters(column) + row] ?? "").trim();

// One name per lift, the one an earlier import has, so its e1RM (looked up by name) is shared.
const SAME_LIFT = {
  "Close Grip Bench Press": "Close Grip Bench",
  "Bent Row": "Bent Over Row",
};
const nameOf = (raw) => {
  const name = raw.replace(/\s+/g, " ").trim();
  return SAME_LIFT[name] ?? name;
};

// The weeks: "WEEK n" headers, each with its SETS column (in the same order), without the
// "POST-MEET" ones after the meet.
const weekHeaders = parsed
  .filter((cell) => /^WEEK \d+$/i.test(cell.value))
  .sort((a, b) => a.column - b.column);
const setsColumns = parsed
  .filter((cell) => cell.value === "SETS" && cell.row === weekHeaders[0].row + 3)
  .map((cell) => cell.column)
  .sort((a, b) => a - b);
if (setsColumns.length !== weekHeaders.length) throw new Error("a SETS column per week expected");
const weekColumns = setsColumns.filter(
  (_, index) => !/post-meet/i.test(get(weekHeaders[index].column + 1, weekHeaders[index].row)),
);
const WEEKS = weekColumns.length;
// The days: "DAY n" rows in the first week's column.
const dayRows = parsed
  .filter((cell) => cell.column === weekHeaders[0].column && /^DAY \d+$/i.test(cell.value))
  .map((cell) => cell.row)
  .sort((a, b) => a - b);
const lastRow = Math.max(...parsed.map((cell) => cell.row));

/** One row's sets for a week as set groups ({ sets, reps, rpe, percent }). */
function groupsOf(setsText, repsText, intensityText, where) {
  let m;
  // The last week's tests: "1-3RM" is a 3RM, the top of the range (as "2-3 sets" is 3 sets).
  if ((m = /^(\d+)-(\d+)\s*RM$/i.exec(setsText))) return [{ sets: 1, reps: Number(m[2]), rpe: 10 }];
  const sets = Number(setsText);
  const reps = Number(repsText);
  if (!Number.isInteger(sets) || sets < 1 || !Number.isInteger(reps) || reps < 1) {
    throw new Error(`${where}: sets or reps not understood: "${setsText}" x "${repsText}"`);
  }
  let load;
  if (intensityText === "") load = {};
  else if ((m = /^@?\s*(\d+(?:\.\d+)?)\s*RPE$/i.exec(intensityText))) load = { rpe: Number(m[1]) };
  // A share of the 1RM: 0.73 is 73 %.
  else if (/^(0?\.\d+|1(\.0+)?)$/.test(intensityText)) {
    load = { percent: Math.round(Number(intensityText) * 1000) / 10 };
  } else throw new Error(`${where}: intensity not understood: "${intensityText}"`);
  return [{ sets, reps, ...load }];
}

// weekly[day][week] = the day's exercises that week, in order: [{ name, groups }].
const weekly = dayRows.map(() => Array.from({ length: WEEKS }, () => []));
weekColumns.forEach((setsColumn, week) => {
  for (let row = dayRows[0] + 1; row <= lastRow; row += 1) {
    const setsText = get(setsColumn, row);
    if (setsText === "" || setsText === "SETS") continue;
    const day = dayRows.filter((dayRow) => dayRow < row).length - 1;
    const where = `row ${row} week ${week + 1}`;
    const rawName = get(setsColumn - 1, row);
    if (!rawName) throw new Error(`${where}: sets without an exercise`);
    const groups = groupsOf(setsText, get(setsColumn + 1, row), get(setsColumn + 2, row), where);
    addRow(weekly[day][week], nameOf(rawName), groups, where);
  }
});

// Days with nothing in any week (the sheet has room for six) aren't training days.
const days = buildDays(weekly).filter((day) => day.exercises.length > 0);
writeProgram({ name: programName, weeks: WEEKS, trainingMaxPercent: 100, days }, outPath);
