const express = require("express");
const router = express.Router();
const prisma = require("../prisma/client");

router.get("/prs", async (req, res) => {
  try {
    const exercises = await prisma.exercise.findMany({
      include: { sets: true, workout: true },
    });

    const setsByExerciseName = {};
    exercises.forEach((exercise) => {
      const sets = exercise.sets.map((set) => ({
        date: exercise.workout.date,
        weight: set.weight,
        reps: set.reps,
        rpe: set.rpe,
      }));
      setsByExerciseName[exercise.name] = (setsByExerciseName[exercise.name] || []).concat(sets);
    });

    res.json(
      Object.entries(setsByExerciseName).map(([name, sets]) => ({ name, sets })),
    );
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
