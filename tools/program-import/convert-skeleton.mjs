// Turns a PROGRAMMING SKELETON extract (extract-skeleton.mjs) into an Iron Log program: a day per
// 3 slots that have anything, an exercise per name a slot has over the weeks, and each week's
// prescription as a scheme ("1x1 rpe8, 5x5@-20%"). Every line of a prescription must be
// understood, or the script stops and says which: add a pattern to groupsOf for it. Writes the
// program as JSON (for POST /api/programs) and prints a table to check it by.
// Usage: node convert-skeleton.mjs <extract.json> "<program name>" <program.json>
import { readFileSync, writeFileSync } from "node:fs";

const [extractPath, programName, outPath] = process.argv.slice(2);
if (!outPath || !programName) {
  throw new Error('usage: node convert-skeleton.mjs <extract.json> "<name>" <program.json>');
}
// trimStart also drops the BOM a file saved by PowerShell may start with.
const { weeks, names } = JSON.parse(readFileSync(extractPath, "utf8").trimStart());
const WEEKS = weeks.length;
// How many myo-rep mini-sets are planned after an activation set (see groupsOf).
const MYO_MINI_SETS = 3;

// One line (a bullet) of a prescription as set groups: { sets, reps, rpe, percent, backoff }, or
// { setsOfPrevious } for a line that only says how many times the line before is done.
function groupsOf(line) {
  const text = line
    .replace(/\s+/g, " ")
    .trim()
    // Bridge 3.0 starts some prescriptions with "*" in place of "•".
    .replace(/^\*\s*/, "")
    // "5 reps @ RPE 9. No back off sets": the last set's line says there are none after it.
    .replace(/\.?\s*no back ?off sets\.?$/i, "")
    .replace(/\.$/, "")
    .trim();
  const n = (value) => Number(value);
  let m;
  if (text === "") return [];
  // "5 reps @ 7 (79% of 1RM)", "10 reps @ RPE 7", "1 rep @ RPE 8 (90-93% 1RM)",
  // "4 reps @ RPE 8 (84%) x 3 sets of 4", "3 reps @ RPE 9 x 1 set",
  // "6 Reps @ 8 RPE (79%) x 2 Sets", and a range of reps, which takes its top (as "2-3 sets"
  // takes 3): "14-16 Reps @ 8 RPE" is 16 reps
  const repsAtRpe =
    /^(\d+)(?:-(\d+))? reps? @ ?(?:RPE )?(\d+(?:\.\d+)?)(?: RPE)?(?: \([^)]*\))?(?: x (\d+) sets?(?: of \d+)?)?$/i;
  if ((m = repsAtRpe.exec(text))) {
    return [{ sets: n(m[4] ?? 1), reps: n(m[2] ?? m[1]), rpe: n(m[3]) }];
  }
  // 4-Day Hypertrophy's myo-reps: after the activation set ("14-16 Reps @ 8 RPE"), mini-sets of
  // "3-5 Reps" with its weight, aiming for 5, until one comes out a rep short of the first. Planned
  // as MYO_MINI_SETS sets of the top of the range, with no intensity: their weight is the
  // activation set's, filled in on the day.
  if ((m = /^(\d+)-(\d+) reps?$/i.exec(text))) return [{ sets: MYO_MINI_SETS, reps: n(m[2]) }];
  // "8 reps @ 8 RPE (74%)" and then "3 sets": the line before, 3 times.
  if ((m = /^(\d+) sets?$/i.exec(text))) return [{ setsOfPrevious: n(m[1]) }];
  // 12 Week Strength's week 13 maxes: "1 @ 8 (93%)", "1 @ 9 (96%)", "1 @ 10 (100%)"
  if ((m = /^(\d+) @ (\d+(?:\.\d+)?)(?: \([^)]*\))?$/.exec(text))) {
    return [{ sets: 1, reps: n(m[1]), rpe: n(m[2]) }];
  }
  // "Take off 20% from 1 @ 8 for 5 reps x 5 sets (70-73% 1RM)"
  if ((m = /^take off (\d+)% from .*? for (\d+) reps x (\d+) sets/i.exec(text))) {
    return [{ sets: n(m[3]), reps: n(m[2]), backoff: n(m[1]) }];
  }
  // "Take off 5% from 10 @ 9 for 1 more set of 10"
  if ((m = /^take off (\d+)% from .*? for (\d+) more sets? of (\d+)/i.exec(text))) {
    return [{ sets: n(m[2]), reps: n(m[3]), backoff: n(m[1]) }];
  }
  // "Take 5% off from the 4 @ RPE 9 set and do 2-3 sets of 4 (until effort is ~ RPE 9 again)":
  // the most sets; the ones not done go when the workout is finished.
  if ((m = /^take (\d+)% off from .*? do (\d+)-(\d+) sets of (\d+)/i.exec(text))) {
    return [{ sets: n(m[3]), reps: n(m[4]), backoff: n(m[1]) }];
  }
  // "Repeat 8 reps @ 8 for 2 more sets of 8", "Repeat 10 @ 8 x 2 more sets of 10 (3 total)"
  const repeat = /^repeat (\d+)(?: reps?)? @ (?:RPE )?(\d+(?:\.\d+)?) (?:for|x) (\d+) more sets?/i;
  if ((m = repeat.exec(text))) return [{ sets: n(m[3]), reps: n(m[1]), rpe: n(m[2]) }];
  // "-5% from 3 @ RPE 9 x 2 sets of 3", "-5% from 4 @ 9 x 1 set of 4", "-5% from 2 @ 9 for 2 sets of 2"
  if ((m = /^-(\d+)% from .*? (?:x|for) (\d+) sets? of (\d+)/i.exec(text))) {
    return [{ sets: n(m[2]), reps: n(m[3]), backoff: n(m[1]) }];
  }
  // "80% e1RM x 4 sets of 4"
  if ((m = /^(\d+)% e1RM x (\d+) sets? of (\d+)/i.exec(text))) {
    return [{ sets: n(m[2]), reps: n(m[3]), percent: n(m[1]) }];
  }
  // "85% e1RM x 3 reps x 3 sets", "80% e1RM x 4 reps x 1 set"
  if ((m = /^(\d+)% e1RM x (\d+) reps x (\d+) sets?/i.exec(text))) {
    return [{ sets: n(m[3]), reps: n(m[2]), percent: n(m[1]) }];
  }
  // 12 Week Strength's week 13, the test week: "work up to. 1 rep @ opener (~90-93%)" is 1 @ RPE 8
  // (92 % by the chart); "work up to. 1 rep @ last warm up (~80-83%)" is a single at 82 %.
  if (/^work up to\. 1 rep @ opener/i.test(text)) return [{ sets: 1, reps: 1, rpe: 8 }];
  if (/^work up to\. 1 rep @ last warm up/i.test(text)) {
    return [{ sets: 1, reps: 1, percent: 82 }];
  }
  throw new Error(`not understood: "${text}"`);
}

const format = (group) => {
  let text = `${group.sets}x${group.reps}`;
  if (group.percent !== undefined) text += `@${group.percent}%`;
  if (group.backoff !== undefined) text += `@-${group.backoff}%`;
  if (group.rpe !== undefined) text += ` rpe${group.rpe}`;
  return text;
};

// A slot with nothing that week: "None", or "N/A" (4-Day Hypertrophy's week 8).
const isNothing = (text) => /^(none|n\/a)$/i.test(text.trim());

/** A prescription as a scheme; a slot with nothing that week is "". */
function schemeOf(prescription) {
  const text = prescription.replace(/\r/g, "").trim();
  if (text === "" || isNothing(text)) return "";
  // Bullets ("•") start lines; a bullet's text may go on over a line break.
  const lines = text.includes("•") ? text.split("•") : text.split("\n");
  // Alike groups in a row are one ("1x8 rpe8" and "2x8 rpe8" are "3x8 rpe8"), as the editor
  // saves them.
  const groups = [];
  for (const group of lines.flatMap(groupsOf)) {
    const last = groups.at(-1);
    if (group.setsOfPrevious !== undefined) {
      if (last?.sets !== 1) throw new Error(`"${group.setsOfPrevious} sets" with no set before it`);
      last.sets = group.setsOfPrevious;
      continue;
    }
    const alike =
      last && ["reps", "rpe", "percent", "backoff"].every((field) => last[field] === group[field]);
    if (alike) last.sets += group.sets;
    else groups.push({ ...group });
  }
  return groups.map(format).join(", ");
}

// The same lift written another way gets one name, the one a program imported earlier has (12 Week
// Strength, then Bridge 3.0), so its e1RM (looked up by the exact name) is found across weeks and
// programs. Also a typo or two in the sheets.
const SAME_LIFT = {
  "Squat with Belt": "Squat with belt",
  "Squat w/ belt": "Squat with belt",
  "Deadlift w/ belt": "Deadlift with belt",
  "Deadlift with Belt": "Deadlift with belt",
  "Touch n Go bench": "Touch and Go Bench",
  "Press with belt": "Overhead Press with belt",
  "Bench with 1-Sec Pause": "1 count paused bench",
  "2ct paused bench": "2ct paused Bench",
  "2 count paused squat": "2ct paused squat",
  "2 count paused deadlift": "2ct Paused DL",
  "Close grip bench press": "Close Grip Bench",
  "2ct paused belt squat, 2ct paused leg press or split squat (reps per each leg)":
    "2ct paused belt squat, 2ct paused leg press, or split squat (reps per each leg)",
  "DB Flat bench or Feet up bench (if no DB's_": "DB Flat bench or Feet up bench (if no DB's)",
};
// A name as the sheet has it on its first line, without the footnote "1" some carry.
const nameOf = (raw) => {
  const name = raw.split(/\r?\n/)[0].replace(/\s+/g, " ").trim().replace(/ 1$/, "");
  return SAME_LIFT[name] ?? name;
};

const days = names
  .map((dayNames, day) => {
    const exercises = [];
    for (let slot = 0; slot < 3; slot += 1) {
      const slotIndex = day * 3 + slot;
      // One exercise per name the slot has, in order, with its weeks; the others stay empty.
      const byName = new Map();
      for (let week = 0; week < WEEKS; week += 1) {
        const name = nameOf(dayNames[week][slot]);
        const scheme = schemeOf(weeks[week].slots[slotIndex]);
        if (!name || isNothing(name) || scheme === "") continue;
        if (!byName.has(name)) byName.set(name, Array(WEEKS).fill(""));
        byName.get(name)[week] = scheme;
      }
      for (const [name, weekSchemes] of byName) {
        exercises.push({ name, supersetGroup: null, weekSchemes });
      }
    }
    return { name: "", exercises };
  })
  // A day with nothing in any week (Bridge 3.0's day 4) isn't a training day.
  .filter((day) => day.exercises.length > 0);

const program = { name: programName, weeks: WEEKS, trainingMaxPercent: 100, days };
writeFileSync(outPath, JSON.stringify(program, null, 1));

// The table to check by: per day and exercise, each week's scheme.
for (const [d, day] of days.entries()) {
  console.log(`\nDAN ${d + 1}`);
  for (const exercise of day.exercises) {
    console.log(`  ${exercise.name}`);
    exercise.weekSchemes.forEach((scheme, w) => {
      if (scheme) console.log(`    T${String(w + 1).padStart(2)}  ${scheme}`);
    });
  }
}
console.log(`\n${programName}: ${WEEKS} weeks, ${days.length} days, written to ${outPath}`);
