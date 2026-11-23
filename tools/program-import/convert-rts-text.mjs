// Turns an RTS program written as text (a PDF through `pdftotext -layout`, or a Word document
// through docx-text.mjs) into an Iron Log program. "Week 1 - 4" or "WK3" starts weeks (a range
// all alike), a weekday or a meet week's "4-5 Days Out" starts a day (the week's first is day 1),
// and each other line is an exercise and its protocol: "Squat w/belt x1 @8, x5 @9 plus 2 down
// sets (load drop)". A document of several cycles ("CYCLE 2:") is converted one cycle at a time.
// GPP blocks are skipped, and a "Test Week" without sessions tests the three lifts on its first
// day. Lines it can't put into sets are left out and listed. Writes the program as JSON (for POST
// /api/programs) and prints a table to check it by.
// Usage: node convert-rts-text.mjs <program.txt> "<program name>" <program.json> [cycle]
import { readFileSync } from "node:fs";
import { addRow, buildDays, writeProgram } from "./program.mjs";
import { percentAtRepsToFailure } from "../../frontend/src/utils/rpeChart.js";

const [textPath, programName, outPath, cycleArg] = process.argv.slice(2);
if (!outPath || !programName) {
  throw new Error('usage: node convert-rts-text.mjs <program.txt> "<name>" <program.json> [cycle]');
}
// Typos in the documents, fixed before reading.
const TYPOS = [
  // Project Momentum 2016 week 3: "74%x5x3 (sets." for the drop 74 % has everywhere else.
  [/74%x5x3 \(sets\.$/, "74%x5x3 (-19%)."],
];
let lines = readFileSync(textPath, "utf8")
  .split(/\r?\n/)
  .map((line) => TYPOS.reduce((text, [typo, fix]) => text.replace(typo, fix), line))
  .map((line) => line.replace(/\s+/g, " ").trim())
  // Without empty lines and the "-----" between weeks.
  .filter((line) => line !== "" && !/^-+$/.test(line));
if (cycleArg) {
  // Only the lines of that cycle: from its "CYCLE n:" to the next one.
  const starts = lines.flatMap((line, index) => (/^CYCLE \d+:?$/i.test(line) ? [index] : []));
  const cycles = starts.length > 0 && starts[0] > 0 ? [0, ...starts] : starts;
  const from = cycles[Number(cycleArg) - 1];
  if (from === undefined) throw new Error(`no cycle ${cycleArg}`);
  lines = lines.slice(from, cycles[Number(cycleArg)] ?? lines.length);
}

// "plus 2 down sets (load drop)": back-off sets this much lighter than the set before, the
// middle of RTS's usual 4-6 % fatigue.
const LOAD_DROP = 5;
// Myo-rep mini-sets planned after each activation set ("x10 @9 --> x3 @10 2 Activations"): done
// with its weight until the RPE is reached, so their weight is filled in on the day.
const MYO_MINI_SETS = 3;
// An AMRAP set at a share of the 1RM is planned at the reps the RTS chart has to failure there
// (80 % is 7 reps); what was done is logged.
const amrapReps = (percent) => {
  let reps = 1;
  while (reps < 14 && percentAtRepsToFailure(reps + 1) >= percent) reps += 1;
  return reps;
};

// One name per lift, the one an earlier import has, so its e1RM (looked up by name) is shared.
const SAME_LIFT = {
  "Squat w/belt": "Squat with belt",
  "Deadlift w/belt": "Deadlift with belt",
  "Bench (touch and go)": "Touch and Go Bench",
  "Feet up Bench": "Feet Up Bench",
  '2" Deficit Deadlift': '2" deficit deadlift',
  "2ct Pause Deadlift": "2ct Paused DL",
  "Vertical Pull of your choice": "Vertical Pull of choice",
  "Hi Bar Squat": "High Bar Squat",
  "Rack Pull (mid shin)": "Rack Pull, mid shin",
};
// The competition lifts as the RTS documents name them, for a test week.
const COMPETITION_LIFTS = ["Squat w/belt", "Competition Raw Bench", "Deadlift w/belt"];
const ATTEMPTS = [8, 9, 10].map((rpe) => ({ sets: 1, reps: 1, rpe }));
const nameOf = (raw) => {
  const name = raw.replace(/″/g, '"').trim();
  return SAME_LIFT[name] ?? name;
};

/**
 * A protocol as set groups ({ sets, reps, rpe, percent, backoff }), or null if it can't be.
 * `bare` takes sets with no ending ("x3 @6, x3 @7, x3 @8"), what's left of a line whose end was
 * cut off; otherwise a protocol without one may be missing the text a PDF moved.
 */
function groupsOf(protocol, bare = false) {
  const text = protocol.replace(/\.$/, "");
  let m;
  const topSets = (part) =>
    [...part.matchAll(/x(\d+) @(\d+(?:\.\d+)?)/g)].map((s) => ({
      sets: 1,
      reps: Number(s[1]),
      rpe: Number(s[2]),
    }));
  // "x1 @8 70%x5x6 (-23%)", "x1 @8, x1 @9 then move to 80%x3x2 (-17%)": the singles, then sets
  // lighter than the last one by the percentage in brackets.
  const moveTo =
    /^((?:x\d+ @\d+(?:\.\d+)?,? ?)+)(?:then move to )?\d+%x(\d+)x(\d+) \(-(\d+(?:\.\d+)?)%\)$/i;
  if ((m = moveTo.exec(text))) {
    return [...topSets(m[1]), { sets: Number(m[3]), reps: Number(m[2]), backoff: Number(m[4]) }];
  }
  // "x5 @6, x5 @7, x5 @8 Then 55%x3x5 (3s eccentric + 2s pause …)": then 5 sets of 3 at 55 %
  // (the tempo can't be kept).
  const thenPercent = /^((?:x\d+ @\d+(?:\.\d+)?,? ?)+)Then (\d+(?:\.\d+)?)%x(\d+)x(\d+)\b/i;
  if ((m = thenPercent.exec(text))) {
    return [...topSets(m[1]), { sets: Number(m[4]), reps: Number(m[3]), percent: Number(m[2]) }];
  }
  // "work up to 68%x5 3 sets"
  if ((m = /^work up to (\d+(?:\.\d+)?)%x(\d+) (\d+) sets?$/i.exec(text))) {
    return [{ sets: Number(m[3]), reps: Number(m[2]), percent: Number(m[1]) }];
  }
  // Myo-reps: "x10 @9 --> x3 @10 2 Activations"
  if ((m = /^x(\d+) @(\d+(?:\.\d+)?) --> x(\d+) @\d+(?:\.\d+)? (\d+) Activations?$/i.exec(text))) {
    const activation = { sets: 1, reps: Number(m[1]), rpe: Number(m[2]) };
    const miniSets = { sets: MYO_MINI_SETS, reps: Number(m[3]) };
    return Array.from({ length: Number(m[4]) }, () => [activation, miniSets]).flat();
  }
  // "Work up to an 12RM load. Maximize total number of reps in 8 minutes.": the 12RM set; the
  // reps against the clock can't be planned.
  if ((m = /^Work up to an? (\d+)RM load\b/i.exec(text))) {
    return [{ sets: 1, reps: Number(m[1]), rpe: 10 }];
  }
  // "80% of 1RM AMRAP"
  if ((m = /^(\d+)% of 1RM AMRAP$/i.exec(text))) {
    const percent = Number(m[1]);
    return [{ sets: 1, reps: amrapReps(percent), percent }];
  }
  // The meet: "x1 @ Opener" (1 @ RPE 8, about 92 %, as the other programs' openers), and
  // "Competition", three attempts.
  if (/^x1 @ Opener$/i.test(text)) return [{ sets: 1, reps: 1, rpe: 8 }];
  if (/^Competition$/i.test(text)) return ATTEMPTS;
  // "x1 @8, x5 @9 plus 2 down sets (load drop)", "x10 @6, x10 @7, x10 @8 plus 2 down sets
  // (repeat)", "x12 @7, x12 @8, x12 @9 No Drop Sets"
  m =
    /^((?:x\d+ @\d+(?:\.\d+)?,? ?)+)(?:plus (\d+) down sets? \((load drop|repeat)\)|No Drop Sets)$/i;
  if ((m = m.exec(text))) {
    const sets = topSets(m[1]);
    if (m[2] === undefined) return sets;
    const last = sets.at(-1);
    const down = Number(m[2]);
    if (/repeat/i.test(m[3])) return [...sets, { ...last, sets: down }];
    return [...sets, { sets: down, reps: last.reps, backoff: LOAD_DROP }];
  }
  if (bare && /^(?:x\d+ @\d+(?:\.\d+)?,? ?)+$/i.test(text)) return topSets(text);
  return null;
}

// weekly[day][week] = the day's exercises that week, in order: [{ name, groups }].
const weekly = [];
const leftOut = [];
let weeks = [];
let day = -1;
let lastWeek = 0;
// Text a PDF moved onto a weekday's line ("Friday plus 3 down sets (repeat)"): the end of the
// next protocol that has none.
let moved = null;
// After "GPP", or a test week's notes, the lines up to the next day or week aren't sessions.
let skipping = false;
const DAY =
  /^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|\d+-\d+ Days Out|Competition Day)\b ?(.*)$/i;
const add = (dayIndex, name, groups) => {
  while (weekly.length <= dayIndex) weekly.push([]);
  for (const week of weeks) {
    weekly[dayIndex][week] ??= [];
    addRow(weekly[dayIndex][week], nameOf(name), groups, `week ${week + 1} day ${dayIndex + 1}`);
  }
};
for (const rawLine of lines) {
  let line = rawLine;
  let m;
  // "Week 1 - 4", "Week 6 - 7- 8", "Week 5 deload", "Week 10 - meet", "WK3", "Week2", "Week 3:"
  if ((m = /^(?:Week|WK) ?(\d+)((?: ?- ?\d+)*)/i.exec(line))) {
    const numbers = [Number(m[1]), ...[...m[2].matchAll(/\d+/g)].map((n) => Number(n[0]))];
    const [first, last] = [numbers[0], numbers.at(-1)];
    weeks = Array.from({ length: last - first + 1 }, (_, i) => first - 1 + i);
    lastWeek = Math.max(lastWeek, last);
    day = -1;
    skipping = false;
    continue;
  }
  if ((m = DAY.exec(line))) {
    day += 1;
    skipping = false;
    if (m[2]) moved = m[2];
    continue;
  }
  if (weeks.length === 0 || skipping) continue;
  if (/^GPP$/i.test(line)) {
    skipping = true;
    continue;
  }
  // "Test Week" with no sessions written out: the three lifts tested on its first day.
  if (/^Test Week$/i.test(line) && day < 0) {
    for (const lift of COMPETITION_LIFTS) add(0, lift, ATTEMPTS);
    skipping = true;
    continue;
  }
  if (day < 0) continue;
  // "… Then load 55%x__ @8 for NL=30. 3s eccentric.": as many reps a set as RPE 8 allows, to 30
  // in all, can't be planned; the sets before it are kept.
  const cutOff = /^(.*?) (Then load .*NL ?= ?\d+.*)$/i.exec(line);
  if (cutOff) {
    leftOut.push(`weeks ${weeks[0] + 1}-${weeks.at(-1) + 1}, day ${day + 1}: ${cutOff[2]}`);
    line = cutOff[1];
  }
  // The name is what comes before the protocol (a PDF may have dropped the space between them).
  const split =
    /^(.*?) ?((?:x\d+ @|Work up\b|work up\b|One set\b|\d+% of 1RM|Go through\b).*|Competition)$/i.exec(
      line,
    );
  let groups = split && groupsOf(split[2], Boolean(cutOff));
  if (!groups && split && moved) {
    groups = groupsOf(`${split[2]} ${moved}`);
    if (groups) moved = null;
  }
  if (!groups || !split[1]) {
    leftOut.push(`weeks ${weeks[0] + 1}-${weeks.at(-1) + 1}, day ${day + 1}: ${line}`);
    continue;
  }
  add(day, split[1], groups);
}
if (moved) leftOut.push(`moved text no protocol took: ${moved}`);
for (const dayWeeks of weekly) {
  for (let week = 0; week < lastWeek; week += 1) dayWeeks[week] ??= [];
}

const days = buildDays(weekly);
writeProgram({ name: programName, weeks: lastWeek, trainingMaxPercent: 100, days }, outPath);
if (leftOut.length > 0) {
  console.log(`\nLeft out (can't be put into sets):\n  ${leftOut.join("\n  ")}`);
}
