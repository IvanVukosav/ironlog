const express = require("express");
const router = express.Router();
const prisma = require("../prisma/client");

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

    res.json(Object.entries(prs).map(([name, data]) => ({ name, ...data })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
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
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
