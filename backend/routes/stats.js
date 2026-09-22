const express = require("express");
const router = express.Router();
const prisma = require("../prisma/client");
const { getWeekRange, getMonthRange, getYearRange } = require("../utils/dateRange");

const UNCATEGORIZED_MUSCLE_GROUP = "Ostalo";
const VOLUME_RANGE_GETTERS = { week: getWeekRange, month: getMonthRange, year: getYearRange };
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function toDateKey(date) {
  return new Date(date).toISOString().split("T")[0];
}

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
        isWarmup: set.isWarmup,
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

router.get("/streak", async (req, res) => {
  try {
    const workouts = await prisma.workout.findMany({ select: { date: true } });
    const dateKeys = new Set(workouts.map((workout) => toDateKey(workout.date)));
    const sortedKeys = Array.from(dateKeys).sort();

    let longestStreak = 0;
    let runLength = 0;
    let previousDate = null;
    for (const dateKey of sortedKeys) {
      const currentDate = new Date(dateKey);
      if (previousDate && Math.round((currentDate - previousDate) / MS_PER_DAY) === 1) {
        runLength += 1;
      } else {
        runLength = 1;
      }
      longestStreak = Math.max(longestStreak, runLength);
      previousDate = currentDate;
    }

    const todayKey = toDateKey(new Date());
    let cursor = dateKeys.has(todayKey)
      ? new Date(todayKey)
      : new Date(new Date(todayKey).getTime() - MS_PER_DAY);
    let currentStreak = 0;
    while (dateKeys.has(toDateKey(cursor))) {
      currentStreak += 1;
      cursor = new Date(cursor.getTime() - MS_PER_DAY);
    }

    res.json({ currentStreak, longestStreak });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
