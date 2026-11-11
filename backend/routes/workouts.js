const express = require("express");
const router = express.Router();
const { getDayRange, getWeekRange, getMonthRange, getYearRange } = require("../utils/dateRange");

const RANGE_GETTERS = { month: getMonthRange, year: getYearRange };
const prisma = require("../prisma/client");

const RPE_MIN = 1;
const RPE_MAX = 10;

// Returns { data } ready for prisma, or { error } for a 400. The fields arrive as text from the
// inputs; RPE may be left out.
function parseSetBody(body) {
  const weight = parseFloat(body?.weight);
  const reps = parseInt(body?.reps);
  const rpe =
    body?.rpe === undefined || body?.rpe === null || body?.rpe === "" ? null : parseFloat(body.rpe);

  if (!(weight >= 0)) return { error: "Weight must be a number of 0 or more" };
  if (!Number.isInteger(reps) || reps < 0)
    return { error: "Reps must be a whole number of 0 or more" };
  if (rpe !== null && !(rpe >= RPE_MIN && rpe <= RPE_MAX)) {
    return { error: `RPE must be between ${RPE_MIN} and ${RPE_MAX}` };
  }
  return { data: { weight, reps, rpe, isWarmup: Boolean(body?.isWarmup) } };
}

router.get("/", async (req, res) => {
  try {
    const { date, limit } = req.query;
    if (limit) {
      const workouts = await prisma.workout.findMany({
        take: parseInt(limit),
        orderBy: { date: "desc" },
        include: { exercises: { orderBy: { order: "asc" } } },
      });
      return res.json(workouts);
    }
    const workouts = await prisma.workout.findMany({
      where: date ? { date: getDayRange(date) } : undefined,
      include: {
        exercises: {
          orderBy: { order: "asc" },
          include: { sets: { orderBy: { order: "asc" } } },
        },
      },
    });
    res.json(workouts);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/week", async (req, res) => {
  try {
    const { date } = req.query;
    const workouts = await prisma.workout.findMany({
      where: { date: getWeekRange(date) },
      select: { date: true, name: true },
    });
    res.json(workouts);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/count", async (req, res) => {
  try {
    const { range, date } = req.query;
    const getRange = RANGE_GETTERS[range];
    if (!getRange) {
      return res.status(400).json({ error: "Invalid range" });
    }
    const workouts = await prisma.workout.findMany({
      where: { date: getRange(date) },
      select: { id: true },
    });
    res.json({ count: workouts.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/month", async (req, res) => {
  try {
    const { year, month } = req.query;
    const start = new Date(Date.UTC(year, month - 1, 1));
    const end = new Date(Date.UTC(year, month, 1));
    const workouts = await prisma.workout.findMany({
      where: { date: { gte: start, lt: end } },
      select: { date: true, name: true },
    });
    res.json(workouts);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/", async (req, res) => {
  try {
    const { date, name } = req.body;
    const workout = await prisma.workout.create({
      data: { date: new Date(date), name: name || null },
    });
    res.json(workout);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/:id", async (req, res) => {
  try {
    // Only touch the fields that were sent, so saving notes keeps the name and vice versa.
    const body = req.body ?? {};
    const data = {};
    if ("name" in body) data.name = body.name?.trim() || null;
    if ("notes" in body) data.notes = body.notes?.trim() || null;
    const workout = await prisma.workout.update({
      where: { id: parseInt(req.params.id) },
      data,
    });
    res.json(workout);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const workoutId = parseInt(req.params.id);
    await prisma.set.deleteMany({ where: { exercise: { workoutId } } });
    await prisma.exercise.deleteMany({ where: { workoutId } });
    await prisma.workout.delete({ where: { id: workoutId } });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Adds several exercises with their sets at once (used when loading a program day).
// Sets for an exercise already in the workout are appended to it instead of
// creating a duplicate card. Optionally tags the workout with its program day.
router.post("/:id/exercises/bulk", async (req, res) => {
  try {
    const { exercises, program } = req.body ?? {};
    if (
      !Array.isArray(exercises) ||
      exercises.some((exercise) => !exercise.name?.trim() || !Array.isArray(exercise.sets))
    ) {
      return res.status(400).json({ error: "exercises must be an array of { name, sets }" });
    }

    const workoutId = parseInt(req.params.id);
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
              programId: parseInt(program.id),
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
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/:id/exercises", async (req, res) => {
  try {
    const { name } = req.body;

    if (!name || name.trim() === "") {
      return res.status(400).json({ error: "Exercise name is required" });
    }

    const workoutId = parseInt(req.params.id);
    const existingExerciseCount = await prisma.exercise.count({ where: { workoutId } });
    const exercise = await prisma.exercise.create({
      // Trimmed so "Bench " typed by hand is the same exercise as "Bench" from the picker.
      data: { name: name.trim(), order: existingExerciseCount, workoutId },
    });

    res.json(exercise);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/exercises/:id", async (req, res) => {
  try {
    const body = req.body ?? {};
    const data = {};
    if ("supersetGroup" in body) data.supersetGroup = body.supersetGroup?.trim() || null;
    if ("notes" in body) data.notes = body.notes?.trim() || null;
    const exercise = await prisma.exercise.update({
      where: { id: parseInt(req.params.id) },
      data,
    });
    res.json(exercise);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/:id/exercises/reorder", async (req, res) => {
  try {
    const { exerciseIds } = req.body;
    if (!Array.isArray(exerciseIds)) {
      return res.status(400).json({ error: "exerciseIds must be an array" });
    }
    const workoutId = parseInt(req.params.id);
    const ownedCount = await prisma.exercise.count({
      where: { id: { in: exerciseIds }, workoutId },
    });
    if (ownedCount !== exerciseIds.length) {
      return res.status(400).json({ error: "exerciseIds must all belong to this workout" });
    }
    await prisma.$transaction(
      exerciseIds.map((exerciseId, index) =>
        prisma.exercise.update({
          where: { id: exerciseId },
          data: { order: index },
        }),
      ),
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/exercises/by-name/:name", async (req, res) => {
  try {
    const exerciseName = req.params.name;
    const exercises = await prisma.exercise.findMany({ where: { name: exerciseName } });
    const exerciseIds = exercises.map((exercise) => exercise.id);
    await prisma.set.deleteMany({ where: { exerciseId: { in: exerciseIds } } });
    await prisma.exercise.deleteMany({ where: { name: exerciseName } });
    res.json({ success: true, deletedCount: exerciseIds.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/exercises/:id", async (req, res) => {
  try {
    const exerciseId = parseInt(req.params.id);
    await prisma.set.deleteMany({ where: { exerciseId } });
    await prisma.exercise.delete({ where: { id: exerciseId } });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/exercises/:id/sets", async (req, res) => {
  const { data, error } = parseSetBody(req.body);
  if (error) return res.status(400).json({ error });
  try {
    const exerciseId = parseInt(req.params.id);
    const existingSetCount = await prisma.set.count({ where: { exerciseId } });
    const set = await prisma.set.create({
      data: { ...data, order: existingSetCount, exercise: { connect: { id: exerciseId } } },
    });

    res.json(set);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/exercises/:id/sets/reorder", async (req, res) => {
  try {
    const { setIds } = req.body;
    if (!Array.isArray(setIds)) {
      return res.status(400).json({ error: "setIds must be an array" });
    }
    const exerciseId = parseInt(req.params.id);
    const ownedCount = await prisma.set.count({
      where: { id: { in: setIds }, exerciseId },
    });
    if (ownedCount !== setIds.length) {
      return res.status(400).json({ error: "setIds must all belong to this exercise" });
    }
    await prisma.$transaction(
      setIds.map((setId, index) =>
        prisma.set.update({
          where: { id: setId },
          data: { order: index },
        }),
      ),
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/sets/:id", async (req, res) => {
  const { data, error } = parseSetBody(req.body);
  if (error) return res.status(400).json({ error });
  try {
    const set = await prisma.set.update({ where: { id: parseInt(req.params.id) }, data });
    res.json(set);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/sets/:id", async (req, res) => {
  try {
    await prisma.set.delete({ where: { id: parseInt(req.params.id) } });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
