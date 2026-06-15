const express = require("express");
const router = express.Router();
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

router.get("/prs", async (req, res) => {
  try {
    const exercises = await prisma.exercise.findMany({
      include: { sets: true },
    });

    const prs = {};
    exercises.forEach((exercise) => {
      exercise.sets.forEach((set) => {
        const current = prs[exercise.name];
        if (!current || set.weight > current.weight) {
          prs[exercise.name] = {
            weight: set.weight,
            reps: set.reps,
            rpe: set.rpe,
          };
        }
      });
    });

    res.json(prs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/exercise/:name/history", async (req, res) => {
  try {
    const exercises = await prisma.exercise.findMany({
      where: { name: req.params.name },
      include: { sets: true, workout: true },
      orderBy: { workout: { date: "asc" } },
    });

    const history = exercises.map((e) => ({
      date: e.workout.date,
      sets: e.sets,
    }));

    res.json(history);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
