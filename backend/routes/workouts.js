const express = require("express");
const router = express.Router();
const { getDayRange } = require("../utils/dateRange");
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

router.get("/month", async (req, res) => {
  try {
    const { year, month } = req.query;
    const start = new Date(Date.UTC(year, month - 1, 1));
    const end = new Date(Date.UTC(year, month, 1));
    const workouts = await prisma.workout.findMany({
      where: { date: { gte: start, lt: end } },
      select: { date: true },
    });
    res.json(workouts.map((w) => w.date));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/", async (req, res) => {
  try {
    const { date } = req.body;
    const workout = await prisma.workout.create({
      data: { date: new Date(date) },
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

    const exercise = await prisma.exercise.create({
      data: { name, workoutId: parseInt(req.params.id) },
    });

    res.json(exercise);
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
