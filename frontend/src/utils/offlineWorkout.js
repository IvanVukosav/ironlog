// What the server would answer a change to a workout, worked out on the phone while there is no
// connection, so the change shows at once. Each follows the server's own rules (backend/routes/
// workouts.js and backend/utils/validate.js); the real answers replace these once the changes are
// sent and the day is loaded again.

// A number as the server reads it: a decimal comma counts as a point.
const toNumber = (value) =>
  typeof value === "number"
    ? value
    : Number(
        String(value ?? "")
          .trim()
          .replace(",", "."),
      );

const sameName = (a, b) => a.trim().toLowerCase() === b.trim().toLowerCase();

// The set fields a body names, read the way the server reads them.
function setFields(values) {
  const fields = {};
  if ("weight" in values) fields.weight = toNumber(values.weight);
  if ("reps" in values) fields.reps = toNumber(values.reps);
  if ("rpe" in values) {
    const empty = values.rpe === null || values.rpe === undefined || values.rpe === "";
    fields.rpe = empty ? null : toNumber(values.rpe);
  }
  if ("isWarmup" in values) fields.isWarmup = Boolean(values.isWarmup);
  if ("isDrop" in values) fields.isDrop = Boolean(values.isDrop);
  if ("isDone" in values) fields.isDone = Boolean(values.isDone);
  if ("backoffPercent" in values) {
    const none = values.backoffPercent === null || values.backoffPercent === "";
    fields.backoffPercent = none ? null : toNumber(values.backoffPercent);
  }
  return fields;
}

/** A new workout for `date` ("2026-11-20"), with no exercises yet. */
export function localWorkout(date, id) {
  return {
    id,
    date: `${date}T00:00:00.000Z`,
    name: null,
    notes: null,
    programId: null,
    programWeek: null,
    programDay: null,
    startedAt: null,
    finishedAt: null,
    exercises: [],
  };
}

/** The workout's row with `fields` changed: { name }, { notes }, { startedAt }, { finishedAt }. */
export function localWorkoutChange(workout, fields) {
  // The row comes without its exercises.
  const changed = { ...workout };
  delete changed.exercises;
  if ("name" in fields) changed.name = fields.name?.trim() || null;
  if ("notes" in fields) changed.notes = fields.notes?.trim() || null;
  if ("startedAt" in fields) changed.startedAt = fields.startedAt;
  if ("finishedAt" in fields) changed.finishedAt = fields.finishedAt;
  return changed;
}

/**
 * The workout finished at `finishedAt`: the sets never ticked off are gone, and so is an exercise
 * they leave empty (one that had no sets at all stays).
 */
export function localFinish(workout, finishedAt) {
  const exercises = workout.exercises.flatMap((exercise) => {
    const done = exercise.sets.filter((set) => set.isDone);
    return done.length === 0 && exercise.sets.length > 0 ? [] : [{ ...exercise, sets: done }];
  });
  return { ...workout, finishedAt, exercises };
}

/** A new exercise at the end of the workout. */
export function localExercise(workout, name, id) {
  return {
    id,
    name: name.trim(),
    order: workout.exercises.length,
    supersetGroup: null,
    notes: null,
    workoutId: workout.id,
    sets: [],
  };
}

/** The exercise's row with `fields` changed: { supersetGroup } or { notes }. */
export function localExerciseChange(exercise, fields) {
  // The row comes without its sets.
  const changed = { ...exercise };
  delete changed.sets;
  if ("supersetGroup" in fields) changed.supersetGroup = fields.supersetGroup?.trim() || null;
  if ("notes" in fields) changed.notes = fields.notes?.trim() || null;
  return changed;
}

/** A new set at the end of the exercise; done (at `now`) unless `values.isDone` is false. */
export function localSet(exercise, values, id, now) {
  const fields = setFields(values);
  const isWarmup = fields.isWarmup ?? false;
  const isDone = fields.isDone ?? true;
  return {
    id,
    weight: fields.weight,
    reps: fields.reps,
    rpe: fields.rpe ?? null,
    isWarmup,
    isDrop: (fields.isDrop ?? false) && !isWarmup,
    isDone,
    completedAt: isDone ? now : null,
    backoffPercent: fields.backoffPercent ?? null,
    order: exercise.sets.length,
    exerciseId: exercise.id,
  };
}

/** The set with the fields `values` names changed; ticking it off dates it `now`. */
export function localSetChange(set, values, now) {
  const fields = setFields(values);
  const changed = { ...set, ...fields };
  if ("isDone" in fields) changed.completedAt = fields.isDone ? now : null;
  return changed;
}

/**
 * Sets added at the "start" or the "end" of an exercise, with the temporary `ids`: like the
 * server, all of the exercise's sets in their new order.
 */
export function localSets(exercise, sets, position, ids, now) {
  const empty = { ...exercise, sets: [] };
  const added = sets.map((values, index) => localSet(empty, values, ids[index], now));
  const all = position === "start" ? [...added, ...exercise.sets] : [...exercise.sets, ...added];
  return all.map((set, order) => ({ ...set, order }));
}

// A program day's set, read the way the bulk route reads it.
function programSet(values, id, exerciseId, order) {
  const rpe = parseFloat(values.rpe);
  const backoff = parseFloat(values.backoffPercent);
  return {
    id,
    weight: parseFloat(values.weight) || 0,
    reps: parseInt(values.reps) || 0,
    rpe: Number.isFinite(rpe) ? rpe : null,
    isWarmup: values.isWarmup === true,
    isDrop: values.isDrop === true && values.isWarmup !== true,
    isDone: values.isDone !== false,
    completedAt: null,
    backoffPercent: backoff > 0 && backoff < 100 ? backoff : null,
    order,
    exerciseId,
  };
}

/**
 * A program day loaded into the workout the way the server does it: an exercise already there
 * (same name) gets the day's sets at its end, any other is added with them, and the workout is
 * tagged with the day. `newId()` gives temporary ids. Answers { answer: the workout, creates },
 * `creates` being what outbox.realIdsFrom needs to learn the real ids.
 */
export function localProgramDay(workout, program, exercises, newId) {
  const result = { ...workout, exercises: [...workout.exercises] };
  const created = [];
  for (const { name, sets, supersetGroup } of exercises) {
    const index = result.exercises.findIndex((exercise) => sameName(exercise.name, name));
    if (index >= 0) {
      const existing = result.exercises[index];
      const setIds = sets.map(() => newId());
      const added = sets.map((values, i) =>
        programSet(values, setIds[i], existing.id, existing.sets.length + i),
      );
      result.exercises[index] = { ...existing, sets: [...existing.sets, ...added] };
      created.push({ name, id: null, setIds });
    } else {
      const id = newId();
      const setIds = sets.map(() => newId());
      result.exercises.push({
        id,
        name: name.trim(),
        order: result.exercises.length,
        supersetGroup: typeof supersetGroup === "string" ? supersetGroup.trim() || null : null,
        notes: null,
        workoutId: workout.id,
        sets: sets.map((values, i) => programSet(values, setIds[i], id, i)),
      });
      created.push({ name, id, setIds });
    }
  }
  if (program) {
    result.programId = program.id;
    result.programWeek = parseInt(program.week);
    result.programDay = parseInt(program.day);
  }
  return { answer: result, creates: { kind: "programDay", exercises: created } };
}

/** The body a set's change is saved with later: when it is done, the moment it was done. */
export function withCompletedAt(values, now) {
  return values.isDone === false ? values : { ...values, completedAt: now };
}

// The workouts of the last days opened, kept on the phone so Trening opens without a connection.
const DAYS_KEY = "ironlog-workout-days";
const DAYS_KEPT = 7;

function readDays() {
  try {
    return JSON.parse(localStorage.getItem(DAYS_KEY)) ?? {};
  } catch {
    return {};
  }
}

/** Keeps `workout` (or null: no workout that day) as the day's copy. */
export function keepWorkout(date, workout) {
  const days = { ...readDays() };
  delete days[date];
  days[date] = workout;
  const recent = Object.entries(days).slice(-DAYS_KEPT);
  try {
    localStorage.setItem(DAYS_KEY, JSON.stringify(Object.fromEntries(recent)));
  } catch {
    // Storage blocked or full: Trening then needs a connection to open the day.
  }
}

/** The kept copy of the day's workout (null for a day without one), or undefined if none. */
export function keptWorkout(date) {
  const days = readDays();
  return date in days ? days[date] : undefined;
}
