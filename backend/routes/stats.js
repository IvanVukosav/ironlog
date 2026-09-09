const express = require("express");
const router = express.Router();
const prisma = require("../prisma/client");
const { getWeekRange, getMonthRange, getYearRange } = require("../utils/dateRange");

const UNCATEGORIZED_MUSCLE_GROUP = "Ostalo";
const VOLUME_RANGE_GETTERS = { week: getWeekRange, month: getMonthRange, year: getYearRange };

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
      id: e.id,
      date: e.workout.date,
      sets: e.sets,
    }));

    res.json(history);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/volume", async (req, res) => {
  try {
    const { range, date } = req.query;
    const getRange = VOLUME_RANGE_GETTERS[range];
    if (!getRange) {
      return res.status(400).json({ error: "Invalid range" });
    }

    const sets = await prisma.set.findMany({
      where: { exercise: { workout: { date: getRange(date) } } },
      include: { exercise: true },
    });

    const templates = await prisma.exerciseTemplate.findMany();
    const muscleGroupByExerciseName = {};
    templates.forEach((template) => {
      muscleGroupByExerciseName[template.name] = template.muscleGroup || UNCATEGORIZED_MUSCLE_GROUP;
    });

    const volumeByMuscleGroup = {};
    sets.forEach((set) => {
      const muscleGroup = muscleGroupByExerciseName[set.exercise.name] || UNCATEGORIZED_MUSCLE_GROUP;
      const volume = set.weight * set.reps;
      volumeByMuscleGroup[muscleGroup] = (volumeByMuscleGroup[muscleGroup] || 0) + volume;
    });

    const result = Object.entries(volumeByMuscleGroup)
      .map(([muscleGroup, volume]) => ({ muscleGroup, volume }))
      .sort((entryA, entryB) => entryB.volume - entryA.volume);

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
