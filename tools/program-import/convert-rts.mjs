// Turns RTS's generalized intermediate 9 (8+1) week program (a Word document; unzip the .docx into
// a folder) into an Iron Log program. Its tables have a "Week n" row, a weekday row starting each
// day, and a row per exercise with its protocol: "Work up to x5 @9 (Load Drop) 4-6% Fatigue".
// A week's days in order are the program's days 1, 2, … (Monday is day 1). Writes the program as
// JSON (for POST /api/programs) and prints a table to check it by; anything else stops it.
// Usage: node convert-rts.mjs <unzipped docx folder> "<program name>" <program.json>
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { addRow, buildDays, writeProgram } from "./program.mjs";

const [folder, programName, outPath] = process.argv.slice(2);
if (!outPath || !programName) {
  throw new Error('usage: node convert-rts.mjs <unzipped docx folder> "<name>" <program.json>');
}
const xml = readFileSync(join(folder, "word/document.xml"), "utf8");
const textOf = (part) =>
  [...part.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)]
    .map((m) => m[1])
    .join("")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
// Every table row's cells as text.
const rows = [...xml.matchAll(/<w:tr[ >][\s\S]*?<\/w:tr>/g)].map((row) =>
  [...row[0].matchAll(/<w:tc>[\s\S]*?<\/w:tc>/g)].map((cell) => textOf(cell[0])),
);

// RTS fatigue percents: after the top set, "Load Drop" sets take the fatigue off the bar (the
// middle of its range) and "Repeat" sets keep the top set's weight, until the set feels as hard
// as the top set again (or its e1RM is that much lower). How many sets that takes is felt on the
// day, so they're planned with room to spare; the ones not done go when the workout is finished.
const FATIGUE_SETS = { "4-6": 3, "6-9": 4 };
// The test week's rows are for all three competition lifts.
const COMPETITION_LIFTS = ["Squat w/belt", "Competition Raw Bench", "Deadlift w/belt"];

// One name per lift, the one an earlier import has, so its e1RM (looked up by name) is shared.
const SAME_LIFT = {
  "Squat w/belt": "Squat with belt",
  "Deadlift w/belt": "Deadlift with belt",
  '2" Deficit Deadlift': '2" deficit deadlift',
  "Bench (touch and go)": "Touch and Go Bench",
  "303 Tempo Squat": "3-0-3 Tempo Squat",
  "Lever Rows": "Lever Row",
  "Pendlay Rows": "Pendlay Row",
};
const nameOf = (raw) => {
  const name = raw.replace(/″/g, '"').replace(/\s+/g, " ").trim();
  return SAME_LIFT[name] ?? name;
};

/** An exercise's protocol as set groups ({ sets, reps, rpe, percent, backoff }). */
function groupsOf(protocol, where) {
  const text = protocol.replace(/\.$/, "").trim();
  let m;
  const workUpTo =
    /^Work up to x(\d+) @(\d+(?:\.\d+)?) \((Load Drop|Repeat)\) (?:No Drop Sets|(\d+)-(\d+)% Fatigue)$/i;
  if ((m = workUpTo.exec(text))) {
    const top = { sets: 1, reps: Number(m[1]), rpe: Number(m[2]) };
    if (m[4] === undefined) return [top];
    const sets = FATIGUE_SETS[`${m[4]}-${m[5]}`];
    if (!sets) throw new Error(`${where}: no planned set count for ${m[4]}-${m[5]}% fatigue`);
    if (/repeat/i.test(m[3])) return [top, { ...top, sets }];
    const backoff = (Number(m[4]) + Number(m[5])) / 2;
    return [top, { sets, reps: top.reps, backoff }];
  }
  // The test week: a single at 92 %, a warm-up up to 80 %, and the 1RM test.
  if ((m = /^Work up to (\d+)% of previous 1RM for one set of one$/i.exec(text))) {
    return [{ sets: 1, reps: 1, percent: Number(m[1]) }];
  }
  if ((m = /^Go through your warm up routine \(not heavier than (\d+)%\)$/i.exec(text))) {
    return [{ sets: 1, reps: 1, percent: Number(m[1]) }];
  }
  if (/^Test 1RM in Squat, Bench, and Deadlift$/i.test(text))
    return [{ sets: 1, reps: 1, rpe: 10 }];
  throw new Error(`${where}: not understood: "${protocol}"`);
}

// weekly[day][week] = the day's exercises that week, in order: [{ name, groups }].
const weekly = [];
let week = -1;
let day = -1;
for (const [first = "", exercise = "", protocol = ""] of rows) {
  let m;
  if ((m = /^Week (\d+)$/i.exec(first))) {
    week = Number(m[1]) - 1;
    day = -1;
    continue;
  }
  if (week < 0) continue;
  if (/^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\b/i.test(first)) day += 1;
  if (exercise === "" && protocol === "") continue;
  const where = `week ${week + 1} day ${day + 1} ${exercise}`;
  while (weekly.length <= day) weekly.push([]);
  weekly[day][week] ??= [];
  // "Squat, Bench, and Deadlift" and "Practice competition" (the test week) are all three lifts.
  const lifts = /^(Squat, Bench, and Deadlift|Practice competition)$/i.test(exercise)
    ? COMPETITION_LIFTS
    : [exercise];
  for (const lift of lifts)
    addRow(weekly[day][week], nameOf(lift), groupsOf(protocol, where), where);
}
const WEEKS = week + 1;
for (const weeks of weekly) {
  for (let w = 0; w < WEEKS; w += 1) weeks[w] ??= [];
}

const days = buildDays(weekly);
writeProgram({ name: programName, weeks: WEEKS, trainingMaxPercent: 100, days }, outPath);
