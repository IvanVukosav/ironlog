// Turns an RTS program written as text (the 10 Weeks Cycle PDF through `pdftotext -layout`) into
// an Iron Log program. "Week 1 - 4" starts weeks 1 to 4 (all alike), a weekday starts a day (the
// week's first is day 1), and each other line is an exercise and its protocol:
// "Squat w/belt x1 @8, x5 @9 plus 2 down sets (load drop)". Lines it can't put into sets
// ("Ab Wheel One set @9. Then three additional sets of half the reps.") are left out and listed.
// Writes the program as JSON (for POST /api/programs) and prints a table to check it by.
// Usage: node convert-rts-text.mjs <program.txt> "<program name>" <program.json>
import { readFileSync } from "node:fs";
import { addRow, buildDays, writeProgram } from "./program.mjs";

const [textPath, programName, outPath] = process.argv.slice(2);
if (!outPath || !programName) {
  throw new Error('usage: node convert-rts-text.mjs <program.txt> "<name>" <program.json>');
}
const lines = readFileSync(textPath, "utf8")
  .split(/\r?\n/)
  .map((line) => line.replace(/\s+/g, " ").trim())
  .filter(Boolean);

// "plus 2 down sets (load drop)": back-off sets this much lighter than the set before, the
// middle of RTS's usual 4-6 % fatigue.
const LOAD_DROP = 5;
// Myo-rep mini-sets planned after each activation set ("x10 @9 --> x3 @10 2 Activations"): done
// with its weight until the RPE is reached, so their weight is filled in on the day.
const MYO_MINI_SETS = 3;

// One name per lift, the one an earlier import has, so its e1RM (looked up by name) is shared.
const SAME_LIFT = {
  "Squat w/belt": "Squat with belt",
  "Deadlift w/belt": "Deadlift with belt",
  "Bench (touch and go)": "Touch and Go Bench",
  "Feet up Bench": "Feet Up Bench",
  '2" Deficit Deadlift': '2" deficit deadlift',
  "2ct Pause Deadlift": "2ct Paused DL",
  "Vertical Pull of your choice": "Vertical Pull of choice",
};
const nameOf = (raw) => {
  const name = raw.replace(/″/g, '"').trim();
  return SAME_LIFT[name] ?? name;
};

/** A protocol as set groups ({ sets, reps, rpe, percent, backoff }), or null if it can't be. */
function groupsOf(protocol) {
  let m;
  // "x1 @8 70%x5x6 (-23%)": a single, then sets lighter than it by the percentage in brackets.
  if ((m = /^x1 @(\d+(?:\.\d+)?) \d+%x(\d+)x(\d+) \(-(\d+(?:\.\d+)?)%\)$/i.exec(protocol))) {
    return [
      { sets: 1, reps: 1, rpe: Number(m[1]) },
      { sets: Number(m[3]), reps: Number(m[2]), backoff: Number(m[4]) },
    ];
  }
  // Myo-reps: "x10 @9 --> x3 @10 2 Activations"
  if (
    (m = /^x(\d+) @(\d+(?:\.\d+)?) --> x(\d+) @\d+(?:\.\d+)? (\d+) Activations?$/i.exec(protocol))
  ) {
    const activation = { sets: 1, reps: Number(m[1]), rpe: Number(m[2]) };
    const miniSets = { sets: MYO_MINI_SETS, reps: Number(m[3]) };
    return Array.from({ length: Number(m[4]) }, () => [activation, miniSets]).flat();
  }
  // "Work up to an 12RM load. Maximize total number of reps in 8 minutes.": the 12RM set; the
  // reps against the clock can't be planned.
  if ((m = /^Work up to an? (\d+)RM load\b/i.exec(protocol))) {
    return [{ sets: 1, reps: Number(m[1]), rpe: 10 }];
  }
  // "x1 @8, x5 @9 plus 2 down sets (load drop)", "x10 @6, x10 @7, x10 @8 plus 2 down sets
  // (repeat)", "x12 @7, x12 @8, x12 @9 No Drop Sets"
  m =
    /^((?:x\d+ @\d+(?:\.\d+)?,? ?)+)(?:plus (\d+) down sets? \((load drop|repeat)\)|No Drop Sets)$/i;
  if ((m = m.exec(protocol))) {
    const sets = [...m[1].matchAll(/x(\d+) @(\d+(?:\.\d+)?)/g)].map((s) => ({
      sets: 1,
      reps: Number(s[1]),
      rpe: Number(s[2]),
    }));
    if (m[2] === undefined) return sets;
    const last = sets.at(-1);
    const down = Number(m[2]);
    if (/repeat/i.test(m[3])) return [...sets, { ...last, sets: down }];
    return [...sets, { sets: down, reps: last.reps, backoff: LOAD_DROP }];
  }
  return null;
}

// weekly[day][week] = the day's exercises that week, in order: [{ name, groups }].
const weekly = [];
const leftOut = [];
let weeks = [];
let day = -1;
let lastWeek = 0;
for (const line of lines) {
  let m;
  // "Week 1 - 4", "Week 6 - 7- 8", "Week 5 deload", "Week 10 - meet"
  if ((m = /^Week (\d+)((?: ?- ?\d+)*)/i.exec(line))) {
    const numbers = [Number(m[1]), ...[...m[2].matchAll(/\d+/g)].map((n) => Number(n[0]))];
    const [first, last] = [numbers[0], numbers.at(-1)];
    weeks = Array.from({ length: last - first + 1 }, (_, i) => first - 1 + i);
    lastWeek = Math.max(lastWeek, last);
    day = -1;
    continue;
  }
  if (/^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)$/i.test(line)) {
    day += 1;
    continue;
  }
  if (weeks.length === 0 || day < 0) continue;
  // The name is what comes before the protocol.
  const split = /^(.*?) ((?:x\d+ @|Work up|One set).*)$/i.exec(line);
  const groups = split && groupsOf(split[2]);
  if (!groups) {
    leftOut.push(`weeks ${weeks[0] + 1}-${weeks.at(-1) + 1}, day ${day + 1}: ${line}`);
    continue;
  }
  while (weekly.length <= day) weekly.push([]);
  for (const week of weeks) {
    weekly[day][week] ??= [];
    addRow(weekly[day][week], nameOf(split[1]), groups, `week ${week + 1} day ${day + 1}`);
  }
}
for (const dayWeeks of weekly) {
  for (let week = 0; week < lastWeek; week += 1) dayWeeks[week] ??= [];
}

const days = buildDays(weekly);
writeProgram({ name: programName, weeks: lastWeek, trainingMaxPercent: 100, days }, outPath);
if (leftOut.length > 0)
  console.log(`\nLeft out (can't be put into sets):\n  ${leftOut.join("\n  ")}`);
