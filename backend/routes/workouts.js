const express = require("express");
const router = express.Router();
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

router.get("/", async (req, res) => {
  try {
    const { date } = req.query;
    const workouts = await prisma.workout.findMany({
      where: date ? { date: new Date(date) } : undefined,
      include: { exercises: { include: { sets: true } } },
    });
    res.json(workouts);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

router.post("/", async (req, res) => {
  const { date } = req.body;
  const workout = await prisma.workout.create({
    data: { date: new Date(date) },
  });
  res.json(workout);
});

router.post("/:id/exercises", async (req, res) => {
  const { name } = req.body;

  if (!name || name.trim() === "") {
    return res.status(400).json({ error: "Exercise name is required" });
  }

  const exercise = await prisma.exercise.create({
    data: { name, workoutId: parseInt(req.params.id) },
  });
  res.json(exercise);
});

router.post("/exercises/:id/sets", async (req, res) => {
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
});

router.delete("/sets/:id", async (req, res) => {
  await prisma.set.delete({ where: { id: parseInt(req.params.id) } });
  res.json({ success: true });
});

module.exports = router;
