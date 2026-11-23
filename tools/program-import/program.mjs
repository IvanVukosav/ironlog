// What the converters for programs laid out by exercise name share (convert-calgary, convert-tsa):
// turning set groups into a scheme, putting each day's exercises in order over the weeks, and
// writing the program with a table to check it by.
import { writeFileSync } from "node:fs";

const format = (group) => {
  let text = `${group.sets}x${group.reps}`;
  if (group.percent !== undefined) text += `@${group.percent}%`;
  if (group.backoff !== undefined) text += `@-${group.backoff}%`;
  if (group.rpe !== undefined) text += ` rpe${group.rpe}`;
  return text;
};

/**
 * Set groups ({ sets, reps, rpe, percent, backoff }) as a scheme, alike groups in a row as one
 * ("1x4 rpe8" and "2x4 rpe8" are "3x4 rpe8"), as the editor saves them.
 */
export function schemeOf(groups) {
  const merged = [];
  for (const group of groups) {
    const last = merged.at(-1);
    const alike =
      last && ["reps", "rpe", "percent", "backoff"].every((field) => last[field] === group[field]);
    if (alike) last.sets += group.sets;
    else merged.push({ ...group });
  }
  return merged.map(format).join(", ");
}

/**
 * Adds a row's set groups to a day's exercises for a week ([{ name, groups }], in order). The same
 * lift on the next row is the same exercise ("Competition Squat" and then its back-off sets).
 */
export function addRow(exercises, name, groups, where) {
  if (groups.length === 0) return;
  if (exercises.at(-1)?.name === name) exercises.at(-1).groups.push(...groups);
  else if (exercises.some((exercise) => exercise.name === name)) {
    throw new Error(`${where}: ${name} twice in a day`);
  } else exercises.push({ name, groups });
}

/**
 * The order of a day's exercises over all weeks: every week's own order is kept (each exercise
 * before the next one that week), and otherwise the order they first come in.
 */
function exerciseOrder(weekOrders) {
  const first = new Map();
  for (const order of weekOrders) {
    for (const name of order) if (!first.has(name)) first.set(name, first.size);
  }
  const next = new Map([...first.keys()].map((name) => [name, new Set()]));
  const waiting = new Map([...first.keys()].map((name) => [name, 0]));
  for (const order of weekOrders) {
    for (let i = 1; i < order.length; i += 1) {
      if (next.get(order[i - 1]).has(order[i])) continue;
      next.get(order[i - 1]).add(order[i]);
      waiting.set(order[i], waiting.get(order[i]) + 1);
    }
  }
  const ready = [...first.keys()].filter((name) => waiting.get(name) === 0);
  const result = [];
  while (ready.length > 0) {
    ready.sort((a, b) => first.get(a) - first.get(b));
    const name = ready.shift();
    result.push(name);
    for (const after of next.get(name)) {
      waiting.set(after, waiting.get(after) - 1);
      if (waiting.get(after) === 0) ready.push(after);
    }
  }
  if (result.length < first.size) throw new Error("the weeks order a day's exercises differently");
  return result;
}

/**
 * The program's days from weekly[day][week] = that day's exercises in the week, in order
 * ([{ name, groups }]): each exercise with its scheme per week ("" in weeks it isn't done).
 */
export function buildDays(weekly) {
  return weekly.map((weeks) => {
    const order = exerciseOrder(weeks.map((exercises) => exercises.map(({ name }) => name)));
    const exercises = order.map((name) => ({
      name,
      supersetGroup: null,
      weekSchemes: weeks.map((exercises) => {
        const exercise = exercises.find((candidate) => candidate.name === name);
        return exercise ? schemeOf(exercise.groups) : "";
      }),
    }));
    return { name: "", exercises };
  });
}

/** Writes the program as JSON (for POST /api/programs) and prints a table to check it by. */
export function writeProgram(program, outPath) {
  writeFileSync(outPath, JSON.stringify(program, null, 1));
  for (const [d, day] of program.days.entries()) {
    console.log(`\nDAN ${d + 1}`);
    for (const exercise of day.exercises) {
      console.log(`  ${exercise.name}`);
      exercise.weekSchemes.forEach((scheme, w) => {
        if (scheme) console.log(`    T${String(w + 1).padStart(2)}  ${scheme}`);
      });
    }
  }
  const { name, weeks, days } = program;
  console.log(`\n${name}: ${weeks} weeks, ${days.length} days, written to ${outPath}`);
}
