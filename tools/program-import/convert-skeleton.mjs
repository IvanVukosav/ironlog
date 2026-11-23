// Turns a PROGRAMMING SKELETON extract (extract-skeleton.mjs) into an Iron Log program: a day per
// 3 slots that have anything, an exercise per name a slot has over the weeks, and each week's
// prescription as a scheme ("1x1 rpe8, 5x5@-20%"). Every line of a prescription must be
// understood, or the script stops and says which: add a pattern to groupsOf in bbm.mjs. Writes
// the program as JSON (for POST /api/programs) and prints a table to check it by.
// Usage: node convert-skeleton.mjs <extract.json> "<program name>" <program.json>
import { readFileSync } from "node:fs";
import { daysOfSlots } from "./bbm.mjs";
import { writeProgram } from "./program.mjs";

const [extractPath, programName, outPath] = process.argv.slice(2);
if (!outPath || !programName) {
  throw new Error('usage: node convert-skeleton.mjs <extract.json> "<name>" <program.json>');
}
// trimStart also drops the BOM a file saved by PowerShell may start with.
const { weeks, names } = JSON.parse(readFileSync(extractPath, "utf8").trimStart());
const WEEKS = weeks.length;

// slots[day][slot][week]: day N is slots 3N-2 to 3N of the skeleton.
const slots = names.map((dayNames, day) =>
  [0, 1, 2].map((slot) =>
    weeks.map((week, w) => ({ name: dayNames[w][slot], prescription: week.slots[day * 3 + slot] })),
  ),
);
const days = daysOfSlots(slots, WEEKS);
writeProgram({ name: programName, weeks: WEEKS, trainingMaxPercent: 100, days }, outPath);
