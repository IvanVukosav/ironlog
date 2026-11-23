// What the Barbell Medicine converters share (convert-skeleton for the PROGRAMMING SKELETON sheet,
// convert-bbm-weeks for the WEEK sheets): a prescription's text as a scheme, one name per lift,
// and a program's days from its slots.
import { schemeOf } from "./program.mjs";

// How many myo-rep mini-sets are planned after an activation set (see groupsOf).
const MYO_MINI_SETS = 3;

// Typos in the sheets, fixed before reading.
const TYPOS = [
  // 12wk Press week 10: "6 reps (sets of s)"; the back-off sets take the top set's reps (3), as
  // in weeks 11 and 12.
  [/\(sets of s\)/i, "(sets of 3)"],
];

// One line (a bullet) of a prescription as set groups: { sets, reps, rpe, percent, backoff }, or
// { setsOfPrevious } for a line that only says how many times the line before is done.
function groupsOf(line) {
  let text = line
    .replace(/\s+/g, " ")
    .trim()
    // Bridge 3.0 starts some prescriptions with "*" in place of "•".
    .replace(/^\*\s*/, "")
    // "5 reps @ RPE 9. No back off sets": the last set's line says there are none after it.
    .replace(/\.?\s*no back ?off sets\.?$/i, "")
    .replace(/\.$/, "")
    .trim();
  for (const [typo, fix] of TYPOS) text = text.replace(typo, fix);
  const n = (value) => Number(value);
  // A range ("2-3 sets", "14-16 reps") takes its top: the most sets or reps.
  const top = (low, high) => n(high ?? low);
  let m;
  if (text === "" || /^myoreps$/i.test(text)) return [];
  // "5 reps @ 7 (79% of 1RM)", "10 reps @ RPE 7", "1 rep @ RPE 8 (90-93% 1RM)",
  // "4 reps @ RPE 8 (84%) x 3 sets of 4", "3 reps @ RPE 9 x 1 set",
  // "6 Reps @ 8 RPE (79%) x 2 Sets", "14-16 Reps @ 8 RPE" (16 reps)
  const repsAtRpe =
    /^(\d+)(?:-(\d+))? reps? @ ?(?:RPE )?(\d+(?:\.\d+)?)(?: RPE)?(?: \([^)]*\))?(?: x (\d+) sets?(?: of \d+)?)?$/i;
  if ((m = repsAtRpe.exec(text))) {
    return [{ sets: n(m[4] ?? 1), reps: top(m[1], m[2]), rpe: n(m[3]) }];
  }
  // Myo-reps: after the activation set ("14-16 Reps @ 8 RPE"), mini-sets of "3-5 Reps" with its
  // weight, aiming for 5, until one comes out a rep short of the first. Planned as MYO_MINI_SETS
  // sets of the range's top with no intensity: their weight is the activation set's, filled in on
  // the day. 4-Day Hypertrophy has them on two lines, HLM on one: "14-16 @ RPE 8, 3-5".
  if ((m = /^(\d+)-(\d+) reps?$/i.exec(text))) return [{ sets: MYO_MINI_SETS, reps: n(m[2]) }];
  if ((m = /^(\d+)-(\d+) @ (?:RPE )?(\d+(?:\.\d+)?), (\d+)-(\d+)$/i.exec(text))) {
    return [
      { sets: 1, reps: n(m[2]), rpe: n(m[3]) },
      { sets: MYO_MINI_SETS, reps: n(m[5]) },
    ];
  }
  // "8 reps @ 8 RPE (74%)" and then "3 sets": the line before, 3 times.
  if ((m = /^(\d+) sets?$/i.exec(text))) return [{ setsOfPrevious: n(m[1]) }];
  // The test weeks' maxes: "1 @ 8 (93%)", "1 @ 9 (96%)", "1 @ 10 (100%)" (12 Week Strength),
  // "1 @ 8, 90-93" (12wk Press)
  if ((m = /^(\d+) @ (\d+(?:\.\d+)?)(?: \([^)]*\)|, [\d-]+%?)?$/.exec(text))) {
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
  // "Take 5% off the bar from 6 @ 9 and do 12 reps (sets of 4-6), No Set > RPE 8": 12 reps in
  // sets of 6, the range's top.
  const repsInSets =
    /^take (\d+)% off the bar from .*? do (\d+) reps \(sets of (\d+)(?:-(\d+))?\)/i;
  if ((m = repsInSets.exec(text))) {
    const reps = top(m[3], m[4]);
    return [{ sets: Math.ceil(n(m[2]) / reps), reps, backoff: n(m[1]) }];
  }
  // "Repeat 8 reps @ 8 for 2 more sets of 8", "Repeat 10 @ 8 x 2 more sets of 10 (3 total)",
  // "Repeat 11 @ 8 x 2 sets of 11"
  const repeat =
    /^repeat (\d+)(?: reps?)? @ (?:RPE )?(\d+(?:\.\d+)?) (?:for|x) (\d+) (?:more )?sets?/i;
  if ((m = repeat.exec(text))) return [{ sets: n(m[3]), reps: n(m[1]), rpe: n(m[2]) }];
  // "-5% from 3 @ RPE 9 x 2 sets of 3", "-5% from 2 @ 9 for 2 sets of 2",
  // "-8% from 4 @ RPE 9 x 3-4 sets of 4 *until it becomes RPE 9)" (4 sets), "x 1-2sets of 3"
  const backoffSets = /^-(\d+)% from .*? (?:x|for) (\d+)(?:-(\d+))? ?sets? of (\d+)/i;
  if ((m = backoffSets.exec(text))) {
    return [{ sets: top(m[2], m[3]), reps: n(m[4]), backoff: n(m[1]) }];
  }
  // 12wk Press's meet week: "-10% from 1 @ opener x 3 reps x 1 set"
  if ((m = /^-(\d+)% from .*? x (\d+) reps? x (\d+) sets?/i.exec(text))) {
    return [{ sets: n(m[3]), reps: n(m[2]), backoff: n(m[1]) }];
  }
  // "Do 2 more sets of 10 within 10% of 10 @ 9", "Do 2-3 sets of 8 within 10% of 8 @ 9": up to
  // 10 % lighter than that set, planned in the middle (5 %).
  const within = /^do (\d+)(?:-(\d+))? (?:more )?sets? of (\d+) within (\d+)% of /i;
  if ((m = within.exec(text))) {
    return [{ sets: top(m[1], m[2]), reps: n(m[3]), backoff: n(m[4]) / 2 }];
  }
  // "Do 2 sets of 4 reps @ 82%"
  if ((m = /^do (\d+) sets? of (\d+) reps? @ (\d+(?:\.\d+)?)%$/i.exec(text))) {
    return [{ sets: n(m[1]), reps: n(m[2]), percent: n(m[3]) }];
  }
  // "80% e1RM x 4 sets of 4"
  if ((m = /^(\d+)% e1RM x (\d+) sets? of (\d+)/i.exec(text))) {
    return [{ sets: n(m[2]), reps: n(m[3]), percent: n(m[1]) }];
  }
  // "85% e1RM x 3 reps x 3 sets", "80% e1RM x 4 reps x 1 set"
  if ((m = /^(\d+)% e1RM x (\d+) reps x (\d+) sets?/i.exec(text))) {
    return [{ sets: n(m[3]), reps: n(m[2]), percent: n(m[1]) }];
  }
  // "16 reps (sets of 4) at 75% of e1RM", "12 reps (sets of 4) @ 80% e1RM"
  const repsOfE1rm = /^(\d+) reps \(sets of (\d+) ?\) (?:at|@) (\d+(?:\.\d+)?)% (?:of )?e1RM/i;
  if ((m = repsOfE1rm.exec(text))) {
    if (n(m[1]) % n(m[2]) !== 0) throw new Error(`not whole sets: "${text}"`);
    return [{ sets: n(m[1]) / n(m[2]), reps: n(m[2]), percent: n(m[3]) }];
  }
  // The test weeks' opener: "work up to. 1 rep @ opener (~90-93%)" (12 Week Strength) and
  // "1 rep @ Opener (RPE 8/90-93%)" (12wk Press) are 1 @ RPE 8 (92 % by the chart);
  // "work up to. 1 rep @ last warm up (~80-83%)" is a single at 82 %.
  if (/^(work up to\. )?1 rep @ opener/i.test(text)) return [{ sets: 1, reps: 1, rpe: 8 }];
  if (/^work up to\. 1 rep @ last warm up/i.test(text)) {
    return [{ sets: 1, reps: 1, percent: 82 }];
  }
  // 12wk Press's meet week: "1 rep @ last warm up (RPE 7/86-88%)"
  if ((m = /^1 rep @ last warm up \(RPE (\d+(?:\.\d+)?)/i.exec(text))) {
    return [{ sets: 1, reps: 1, rpe: n(m[1]) }];
  }
  throw new Error(`not understood: "${text}"`);
}

/** A slot with nothing that week: "None", "N/A" (4-Day Hypertrophy's week 8), or empty. */
export const isNothing = (text) => /^(none|n\/a|)$/i.test(text.trim());

/** A prescription's text as a scheme ("1x1 rpe8, 5x5@-20%"); a slot with nothing is "". */
export function schemeOfText(prescription) {
  const text = prescription.replace(/\r/g, "").trim();
  if (isNothing(text)) return "";
  // Bullets ("•") start lines; a bullet's text may go on over a line break.
  const lines = text.includes("•") ? text.split("•") : text.split("\n");
  const groups = [];
  for (const group of lines.flatMap(groupsOf)) {
    if (group.setsOfPrevious === undefined) {
      groups.push(group);
      continue;
    }
    if (groups.at(-1)?.sets !== 1) {
      throw new Error(`"${group.setsOfPrevious} sets" with no set before it`);
    }
    groups.at(-1).sets = group.setsOfPrevious;
  }
  return schemeOf(groups);
}

// The same lift written another way gets one name, the one a program imported earlier has (12 Week
// Strength, then Bridge 3.0, Calgary), so its e1RM (looked up by the exact name) is found across
// weeks and programs. Also a typo or two in the sheets.
const SAME_LIFT = {
  "Touch n Go Bench": "Touch and Go Bench",
  "Press no belt": "Press, no belt",
  "5-3-0 Tempo squat": "5-3-0 Tempo Squat",
  "Feet up Bench": "Feet Up Bench",
  "Feet up bench": "Feet Up Bench",
  "Squat with Belt": "Squat with belt",
  "Squat w/ belt": "Squat with belt",
  "Squat w/ Belt": "Squat with belt",
  "Deadlift w/ belt": "Deadlift with belt",
  "Press w/ belt": "Overhead Press with belt",
  "Press w/ Belt": "Overhead Press with belt",
  "Deadlift with Belt": "Deadlift with belt",
  "Touch n Go bench": "Touch and Go Bench",
  "Press with belt": "Overhead Press with belt",
  "Overhead Press w/ belt": "Overhead Press with belt",
  "Bench with 1-Sec Pause": "1 count paused bench",
  "2ct paused bench": "2ct paused Bench",
  "2 count paused squat": "2ct paused squat",
  "2 count paused deadlift": "2ct Paused DL",
  "2ct Paused Deadlift": "2ct Paused DL",
  "Close grip bench press": "Close Grip Bench",
  "2ct paused belt squat, 2ct paused leg press or split squat (reps per each leg)":
    "2ct paused belt squat, 2ct paused leg press, or split squat (reps per each leg)",
  "DB Flat bench or Feet up bench (if no DB's_": "DB Flat bench or Feet up bench (if no DB's)",
};
/** A lift's name as the sheet has it on its first line, without the footnote "1" some carry. */
export const nameOf = (raw) => {
  const name = raw.split(/\r?\n/)[0].replace(/\s+/g, " ").trim().replace(/ 1$/, "");
  return SAME_LIFT[name] ?? name;
};

/**
 * A program's days from its slots: slots[day][slot][week] = { name, prescription } as the sheet
 * has them. Each slot gets an exercise per name it has over the weeks, with empty weeks where
 * that name isn't done; a day with nothing in any week is left out.
 */
export function daysOfSlots(slots, weeks) {
  return slots
    .map((daySlots) => {
      const exercises = [];
      for (const slotWeeks of daySlots) {
        const byName = new Map();
        slotWeeks.forEach(({ name: rawName, prescription }, week) => {
          const name = nameOf(rawName);
          const scheme = schemeOfText(prescription);
          if (isNothing(name) || scheme === "") return;
          if (!byName.has(name)) byName.set(name, Array(weeks).fill(""));
          byName.get(name)[week] = scheme;
        });
        for (const [name, weekSchemes] of byName) {
          exercises.push({ name, supersetGroup: null, weekSchemes });
        }
      }
      return { name: "", exercises };
    })
    .filter((day) => day.exercises.length > 0);
}
