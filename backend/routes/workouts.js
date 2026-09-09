const express = require("express");
const router = express.Router();
const { getDayRange, getWeekRange, getMonthRange, getYearRange } = require("../utils/dateRange");

const RANGE_GETTERS = { month: getMonthRange, year: getYearRange };
const prisma = require("../prisma/client");

router.get("/", async (req, res) => {
  try {
    const { date, limit } = req.query;
    if (limit) {
      const workouts = await prisma.workout.findMany({
        take: parseInt(limit),
        orderBy: { date: "desc" },
        include: { exercises: true },
      });
      return res.json(workouts);
    }
    const workouts = await prisma.workout.findMany({
      where: date ? { date: getDayRange(date) } : undefined,
      include: { exercises: { include: { sets: true } } },
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
    const { name } = req.body;
    const workout = await prisma.workout.update({
      where: { id: parseInt(req.params.id) },
      data: { name: name || null },
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

router.post("/:id/exercises", async (req, res) => {
  try {
    const { name } = req.body;

    if (!name || name.trim() === "") {
      return res.status(400).json({ error: "Exercise name is required" });
    }

    const exercise = await prisma.exercise.create({
      data: { name, workoutId: parseInt(req.params.id) },
    });

    res.json(exercise);
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
  try {
    const { weight, reps, rpe } = req.body;
    const set = await prisma.set.create({
      data: {
        weight: parseFloat(weight),
        reps: parseInt(reps),
        rpe: parseFloat(rpe),
        exercise: { connect: { id: parseInt(req.params.id) } },
      },
    });

    res.json(set);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/sets/:id", async (req, res) => {
  try {
    const { weight, reps, rpe } = req.body;
    const set = await prisma.set.update({
      where: { id: parseInt(req.params.id) },
      data: {
        weight: parseFloat(weight),
        reps: parseInt(reps),
        rpe: parseFloat(rpe),
      },
    });
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
