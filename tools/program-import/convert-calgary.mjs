// Turns Calgary Barbell's 16 Week Program (the LiftVault spreadsheet) into an Iron Log program.
// Each sheet holds a few weeks side by side (Sets, Reps and Intensity per week) in four day
// blocks, each starting at an "Exercise" header row. The Taper Week sheet is week 16; its four
// blocks (5, 4, 3 and 2 days out) are days 1–4. Writes the program as JSON (for POST
// /api/programs) and prints a table to check it by. Anything not understood stops the script.
// Usage: node convert-calgary.mjs <unzipped folder> "<program name>" <program.json>
import { openWorkbook, columnNumber, columnLetters } from "./xlsx.mjs";
import { addRow, buildDays, writeProgram } from "./program.mjs";

const [folder, programName, outPath] = process.argv.slice(2);
if (!outPath || !programName) {
  throw new Error('usage: node convert-calgary.mjs <unzipped folder> "<name>" <program.json>');
}
const workbook = openWorkbook(folder);

// The sheets in order, with the first week each holds.
const SHEETS = [
  ["Weeks 1-4", 1],
  ["Weeks 5-8", 5],
  ["Weeks 9-11", 9],
  ["Weeks 12-15", 12],
  ["Taper Week", 16],
];
const WEEKS = 16;
// After a top set, "1+2F" is 2 fatigue sets 5 % lighter and "1+2R" 2 repeats of it.
const FATIGUE_DROP = 5;

// One name per lift: the sheets write some lifts differently from block to block, and some the
// way an earlier import does ("Close Grip Bench" as in 12 Week Strength), whose e1RM (looked up
// by the exact name) is then shared. "(% of E1RM)" rows are the lift's own sets after its top set.
const SAME_LIFT = {
  "Paused Bench": "Competition Pause Bench",
  "Competition Squat (% of E1RM)": "Competition Squat",
  "Competition Pause Bench (% of E1RM)": "Competition Pause Bench",
  "Competition Deadlift (% of E1RM)": "Competition Deadlift",
  "Wide Grip Seated Row (mimic bench movement)":
    "Wide Grip Seated Row (cable - mimic bench grip and movement)",
  "2ct Pause Deadlifts (pause barely off the floor)": "2ct Pause Deadlift (pause barely off floor)",
  "2ct Pause Deadlifts (just off floor)": "2ct Pause Deadlift (pause barely off floor)",
  "2ct Pause Deadlifts": "2ct Pause Deadlift (pause barely off floor)",
  "2ct Pause Squats": "2ct Pause Squat",
  "Barbell Overhead Press": "Overhead Press",
  "Close Grip Bench Press": "Close Grip Bench",
  "Pin Squat (pins set for full depth)": "Pin Squat",
  "Rep Bench (Touch and Go)": "Touch and Go Bench",
};
const nameOf = (raw) => {
  const name = raw.replace(/\s+/g, " ").trim();
  return SAME_LIFT[name] ?? name;
};

/** One row's sets for a week as set groups ({ sets, reps, rpe, percent, backoff }). */
function groupsOf(setsText = "", repsText = "", intensityText = "", where) {
  const sets = setsText.trim();
  const reps = repsText.trim();
  const intensity = intensityText.trim();
  let repCount = Number(reps);
  let load;
  let m;
  if (intensity === "") load = {};
  else if ((m = /^(\d+(?:\.\d+)?)\s*RPE$/i.exec(intensity))) load = { rpe: Number(m[1]) };
  // A share of the max (or, in weeks 12–15, of the e1RM): 0.67 is 67 %.
  else if (/^(0?\.\d+|1(\.0+)?)$/.test(intensity)) {
    load = { percent: Math.round(Number(intensity) * 1000) / 10 };
  }
  // The taper's "Opener" single, as 12 Week Strength's opener: 1 @ RPE 8 (about 92 %).
  else if (/^opener$/i.test(intensity)) load = { rpe: 8 };
  // "Side Planks (seconds per side)": reps "x" and "30s", so the seconds are the reps.
  else if ((m = /^(\d+)\s*s$/i.exec(intensity)) && /^x$/i.test(reps)) {
    load = {};
    repCount = Number(m[1]);
  } else throw new Error(`${where}: intensity not understood: "${intensity}"`);
  if (!Number.isInteger(repCount) || repCount < 1) {
    throw new Error(`${where}: reps not understood: "${reps}"`);
  }
  if ((m = /^(\d+)(?:\.0+)?$/.exec(sets))) return [{ sets: Number(m[1]), reps: repCount, ...load }];
  if ((m = /^1\+(\d+)([FR])$/i.exec(sets))) {
    const top = { sets: 1, reps: repCount, ...load };
    if (m[2].toUpperCase() === "R") return [top, { ...top, sets: Number(m[1]) }];
    return [top, { sets: Number(m[1]), reps: repCount, backoff: FATIGUE_DROP }];
  }
  throw new Error(`${where}: sets not understood: "${sets}"`);
}

// weekly[day][week] = the day's exercises that week, in order: [{ name, groups }].
const weekly = Array.from({ length: 4 }, () => Array.from({ length: WEEKS }, () => []));
for (const [sheetName, firstWeek] of SHEETS) {
  const cells = workbook.cells(sheetName);
  const rows = new Map();
  for (const [ref, value] of Object.entries(cells)) {
    const [, letters, row] = /^([A-Z]+)(\d+)$/.exec(ref);
    if (!rows.has(Number(row))) rows.set(Number(row), {});
    rows.get(Number(row))[letters] = value;
  }
  let day = -1;
  let weekColumns = [];
  let lastName = null;
  for (const rowNumber of [...rows.keys()].sort((a, b) => a - b)) {
    const row = rows.get(rowNumber);
    if (row.B?.trim() === "Exercise") {
      // A day block: its weeks start at each "Sets" column (Sets, Reps, Intensity).
      day += 1;
      weekColumns = Object.keys(row)
        .filter((letters) => row[letters].trim() === "Sets")
        .sort((a, b) => columnNumber(a) - columnNumber(b));
      lastName = null;
      continue;
    }
    if (day < 0) continue;
    const at = (letters, offset) => row[columnLetters(columnNumber(letters) + offset)] ?? "";
    // A row without sets in any week is a label ("Day 2", "4 Days from Competition").
    if (!weekColumns.some((letters) => at(letters, 0) !== "")) continue;
    // A row without a name goes on with the exercise above it (the taper's back-off rows).
    const name = row.B ? nameOf(row.B) : lastName;
    if (!name) throw new Error(`${sheetName} row ${rowNumber}: sets without an exercise`);
    lastName = name;
    weekColumns.forEach((letters, index) => {
      const week = firstWeek - 1 + index;
      const where = `${sheetName} row ${rowNumber} week ${week + 1}`;
      const groups = groupsOf(at(letters, 0), at(letters, 1), at(letters, 2), where);
      addRow(weekly[day][week], name, groups, where);
    });
  }
}

const days = buildDays(weekly);
writeProgram({ name: programName, weeks: WEEKS, trainingMaxPercent: 100, days }, outPath);
