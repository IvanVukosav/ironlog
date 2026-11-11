const express = require("express");
const router = express.Router();
const { getDayRange, getWeekRange, getMonthRange, getYearRange } = require("../utils/dateRange");
const { parseId, parsePositiveInt, parseDateKey, parseYearMonth } = require("../utils/validate");
const { HttpError } = require("../utils/errorHandler");

const RANGE_GETTERS = { month: getMonthRange, year: getYearRange };
const prisma = require("../prisma/client");

const RPE_MIN = 1;
const RPE_MAX = 10;

// The fields arrive as text from the inputs; RPE may be left out.
function parseSetBody(body) {
  const weight = parseFloat(body?.weight);
  const reps = parseInt(body?.reps);
  const rpe =
    body?.rpe === undefined || body?.rpe === null || body?.rpe === "" ? null : parseFloat(body.rpe);

  if (!(weight >= 0)) throw new HttpError(400, "Weight must be a number of 0 or more");
  if (!Number.isInteger(reps) || reps < 0) {
    throw new HttpError(400, "Reps must be a whole number of 0 or more");
  }
  if (rpe !== null && !(rpe >= RPE_MIN && rpe <= RPE_MAX)) {
    throw new HttpError(400, `RPE must be between ${RPE_MIN} and ${RPE_MAX}`);
  }
  return { weight, reps, rpe, isWarmup: Boolean(body?.isWarmup) };
}

router.get("/", async (req, res) => {
  const { date, limit } = req.query;
  if (limit) {
    const workouts = await prisma.workout.findMany({
      take: parsePositiveInt(limit, "limit"),
      orderBy: { date: "desc" },
      include: { exercises: { orderBy: { order: "asc" } } },
    });
    return res.json(workouts);
  }
  const workouts = await prisma.workout.findMany({
    where: date ? { date: getDayRange(parseDateKey(date)) } : undefined,
    include: {
      exercises: {
        orderBy: { order: "asc" },
        include: { sets: { orderBy: { order: "asc" } } },
      },
    },
  });
  res.json(workouts);
});

router.get("/week", async (req, res) => {
  const workouts = await prisma.workout.findMany({
    where: { date: getWeekRange(parseDateKey(req.query.date)) },
    select: { date: true, name: true },
  });
  res.json(workouts);
});

router.get("/count", async (req, res) => {
  const { range, date } = req.query;
  const getRange = RANGE_GETTERS[range];
  if (!getRange) {
    return res.status(400).json({ error: "Invalid range" });
  }
  const count = await prisma.workout.count({ where: { date: getRange(parseDateKey(date)) } });
  res.json({ count });
});

router.get("/month", async (req, res) => {
  const { year, month } = parseYearMonth(req.query);
  const workouts = await prisma.workout.findMany({
    where: { date: getMonthRange(Date.UTC(year, month - 1, 1)) },
    select: { date: true, name: true },
  });
  res.json(workouts);
});

router.post("/", async (req, res) => {
  const { date, name } = req.body ?? {};
  const workout = await prisma.workout.create({
    data: { date: new Date(parseDateKey(date)), name: name?.trim() || null },
  });
  res.json(workout);
});

router.patch("/:id", async (req, res) => {
  // Only touch the fields that were sent, so saving notes keeps the name and vice versa.
  const body = req.body ?? {};
  const data = {};
  if ("name" in body) data.name = body.name?.trim() || null;
  if ("notes" in body) data.notes = body.notes?.trim() || null;
  const workout = await prisma.workout.update({ where: { id: parseId(req.params.id) }, data });
  res.json(workout);
});

// Exercises and sets go with the workout (onDelete: Cascade in the schema).
router.delete("/:id", async (req, res) => {
  await prisma.workout.delete({ where: { id: parseId(req.params.id) } });
  res.json({ success: true });
});

// Adds several exercises with their sets at once (used when loading a program day).
// Sets for an exercise already in the workout are appended to it instead of
// creating a duplicate card. Optionally tags the workout with its program day.
router.post("/:id/exercises/bulk", async (req, res) => {
  const { exercises, program } = req.body ?? {};
  if (
    !Array.isArray(exercises) ||
    exercises.some((exercise) => !exercise.name?.trim() || !Array.isArray(exercise.sets))
  ) {
    return res.status(400).json({ error: "exercises must be an array of { name, sets }" });
  }

  const workoutId = parseId(req.params.id);
  const workout = await prisma.$transaction(async (tx) => {
    const existing = await tx.exercise.findMany({
      where: { workoutId },
      include: { _count: { select: { sets: true } } },
    });
    const existingByName = new Map(
      existing.map((exercise) => [exercise.name.toLowerCase(), exercise]),
    );
    let nextOrder = existing.length;

    for (const { name, sets } of exercises) {
      const setData = (startOrder) =>
        sets.map((set, index) => ({
          weight: parseFloat(set.weight) || 0,
          reps: parseInt(set.reps) || 0,
          rpe: Number.isFinite(parseFloat(set.rpe)) ? parseFloat(set.rpe) : null,
          order: startOrder + index,
        }));
      const match = existingByName.get(name.trim().toLowerCase());
      if (match) {
        await tx.set.createMany({
          data: setData(match._count.sets).map((set) => ({ ...set, exerciseId: match.id })),
        });
      } else {
        await tx.exercise.create({
          data: {
            name: name.trim(),
            order: nextOrder++,
            workoutId,
            sets: { create: setData(0) },
          },
        });
      }
    }

    return tx.workout.update({
      where: { id: workoutId },
      data: program
        ? {
            programId: parseId(program.id),
            programWeek: parseInt(program.week),
            programDay: parseInt(program.day),
          }
        : {},
      include: {
        exercises: {
          orderBy: { order: "asc" },
          include: { sets: { orderBy: { order: "asc" } } },
        },
      },
    });
  });

  res.json(workout);
});

router.post("/:id/exercises", async (req, res) => {
  const { name } = req.body ?? {};
  if (!name || name.trim() === "") {
    return res.status(400).json({ error: "Exercise name is required" });
  }

  const workoutId = parseId(req.params.id);
  const existingExerciseCount = await prisma.exercise.count({ where: { workoutId } });
  const exercise = await prisma.exercise.create({
    // Trimmed so "Bench " typed by hand is the same exercise as "Bench" from the picker.
    data: { name: name.trim(), order: existingExerciseCount, workoutId },
  });
  res.json(exercise);
});

router.patch("/exercises/:id", async (req, res) => {
  const body = req.body ?? {};
  const data = {};
  if ("supersetGroup" in body) data.supersetGroup = body.supersetGroup?.trim() || null;
  if ("notes" in body) data.notes = body.notes?.trim() || null;
  const exercise = await prisma.exercise.update({ where: { id: parseId(req.params.id) }, data });
  res.json(exercise);
});

router.patch("/:id/exercises/reorder", async (req, res) => {
  const { exerciseIds } = req.body ?? {};
  if (!Array.isArray(exerciseIds)) {
    return res.status(400).json({ error: "exerciseIds must be an array" });
  }
  const workoutId = parseId(req.params.id);
  const ownedCount = await prisma.exercise.count({
    where: { id: { in: exerciseIds }, workoutId },
  });
  if (ownedCount !== exerciseIds.length) {
    return res.status(400).json({ error: "exerciseIds must all belong to this workout" });
  }
  await prisma.$transaction(
    exerciseIds.map((exerciseId, index) =>
      prisma.exercise.update({ where: { id: exerciseId }, data: { order: index } }),
    ),
  );
  res.json({ success: true });
});

router.delete("/exercises/by-name/:name", async (req, res) => {
  const { count } = await prisma.exercise.deleteMany({ where: { name: req.params.name } });
  res.json({ success: true, deletedCount: count });
});

router.delete("/exercises/:id", async (req, res) => {
  await prisma.exercise.delete({ where: { id: parseId(req.params.id) } });
  res.json({ success: true });
});

router.post("/exercises/:id/sets", async (req, res) => {
  const data = parseSetBody(req.body);
  const exerciseId = parseId(req.params.id);
  const existingSetCount = await prisma.set.count({ where: { exerciseId } });
  const set = await prisma.set.create({
    data: { ...data, order: existingSetCount, exercise: { connect: { id: exerciseId } } },
  });
  res.json(set);
});

router.patch("/exercises/:id/sets/reorder", async (req, res) => {
  const { setIds } = req.body ?? {};
  if (!Array.isArray(setIds)) {
    return res.status(400).json({ error: "setIds must be an array" });
  }
  const exerciseId = parseId(req.params.id);
  const ownedCount = await prisma.set.count({ where: { id: { in: setIds }, exerciseId } });
  if (ownedCount !== setIds.length) {
    return res.status(400).json({ error: "setIds must all belong to this exercise" });
  }
  await prisma.$transaction(
    setIds.map((setId, index) =>
      prisma.set.update({ where: { id: setId }, data: { order: index } }),
    ),
  );
  res.json({ success: true });
});

router.patch("/sets/:id", async (req, res) => {
  const set = await prisma.set.update({
    where: { id: parseId(req.params.id) },
    data: parseSetBody(req.body),
  });
  res.json(set);
});

router.delete("/sets/:id", async (req, res) => {
  await prisma.set.delete({ where: { id: parseId(req.params.id) } });
  res.json({ success: true });
});

module.exports = router;
