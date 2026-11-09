const express = require("express");
const router = express.Router();
const prisma = require("../prisma/client");
const { getWeekRange, getMonthRange, getYearRange } = require("../utils/dateRange");

const UNCATEGORIZED_MUSCLE_GROUP = "Ostalo";
const VOLUME_RANGE_GETTERS = { week: getWeekRange, month: getMonthRange, year: getYearRange };
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const DAYS_PER_WEEK = 7;

const KCAL_PER_KG_BODYWEIGHT = 7700;
const TDEE_WINDOW_DAYS = 28;
const TDEE_MIN_INTAKE_DAYS = 10;
const TDEE_MIN_WEIGH_INS = 8;
const TDEE_MIN_WEIGH_IN_SPAN_DAYS = 14;

// Least-squares slope of weight over time, in kg per day.
function weightSlopePerDay(weighIns) {
  const points = weighIns.map((entry) => ({
    x: entry.date.getTime() / MS_PER_DAY,
    y: entry.weight,
  }));
  const meanX = points.reduce((sum, point) => sum + point.x, 0) / points.length;
  const meanY = points.reduce((sum, point) => sum + point.y, 0) / points.length;
  const covariance = points.reduce((sum, point) => sum + (point.x - meanX) * (point.y - meanY), 0);
  const variance = points.reduce((sum, point) => sum + (point.x - meanX) ** 2, 0);
  return variance > 0 ? covariance / variance : 0;
}

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

    res.json(Object.entries(setsByExerciseName).map(([name, sets]) => ({ name, sets })));
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

// Most recent earlier session of this exercise, relative to the given workout.
router.get("/exercise/:name/last", async (req, res) => {
  try {
    const workoutId = parseInt(req.query.workoutId);
    const currentWorkout = Number.isInteger(workoutId)
      ? await prisma.workout.findUnique({ where: { id: workoutId }, select: { date: true } })
      : null;

    const exercise = await prisma.exercise.findFirst({
      where: {
        name: req.params.name,
        sets: { some: {} },
        ...(currentWorkout && {
          workoutId: { not: workoutId },
          workout: { date: { lte: currentWorkout.date } },
        }),
      },
      include: {
        sets: { orderBy: { order: "asc" } },
        workout: { select: { date: true } },
      },
      orderBy: [{ workout: { date: "desc" } }, { id: "desc" }],
    });

    res.json(
      exercise ? { date: exercise.workout.date, notes: exercise.notes, sets: exercise.sets } : null,
    );
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
      const muscleGroup =
        muscleGroupByExerciseName[set.exercise.name] || UNCATEGORIZED_MUSCLE_GROUP;
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

// Estimated energy expenditure from the last 28 days: average logged intake
// minus the energy of the weight change (regression slope × 7700 kcal/kg).
// `date` is the client's today; that day is left out of intake as it's
// usually not fully logged yet.
router.get("/tdee", async (req, res) => {
  try {
    const today = req.query.date ? new Date(req.query.date) : new Date(toDateKey(new Date()));
    if (Number.isNaN(today.getTime())) {
      return res.status(400).json({ error: "Invalid date" });
    }
    const windowStart = new Date(today.getTime() - TDEE_WINDOW_DAYS * MS_PER_DAY);

    const nutritionDays = await prisma.nutritionDay.findMany({
      where: { date: { gte: windowStart, lt: today } },
      include: { meals: { include: { items: { select: { kcal: true } } } } },
    });
    const dailyIntakes = nutritionDays
      .map((day) =>
        day.meals.flatMap((meal) => meal.items).reduce((sum, item) => sum + item.kcal, 0),
      )
      .filter((kcal) => kcal > 0);

    const weighIns = await prisma.bodyweight.findMany({
      where: { date: { gte: windowStart, lte: today } },
      orderBy: { date: "asc" },
    });
    const weighInSpanDays =
      weighIns.length > 1 ? (weighIns.at(-1).date - weighIns[0].date) / MS_PER_DAY : 0;

    const enoughData =
      dailyIntakes.length >= TDEE_MIN_INTAKE_DAYS &&
      weighIns.length >= TDEE_MIN_WEIGH_INS &&
      weighInSpanDays >= TDEE_MIN_WEIGH_IN_SPAN_DAYS;

    const result = {
      windowDays: TDEE_WINDOW_DAYS,
      intakeDays: dailyIntakes.length,
      weighIns: weighIns.length,
      minIntakeDays: TDEE_MIN_INTAKE_DAYS,
      minWeighIns: TDEE_MIN_WEIGH_INS,
      minWeighInSpanDays: TDEE_MIN_WEIGH_IN_SPAN_DAYS,
      enoughData,
    };
    if (!enoughData) {
      return res.json(result);
    }

    const averageIntake = dailyIntakes.reduce((sum, kcal) => sum + kcal, 0) / dailyIntakes.length;
    const slopePerDay = weightSlopePerDay(weighIns);
    res.json({
      ...result,
      averageIntake: Math.round(averageIntake),
      weightChangePerWeek: Math.round(slopePerDay * DAYS_PER_WEEK * 100) / 100,
      tdee: Math.round(averageIntake - slopePerDay * KCAL_PER_KG_BODYWEIGHT),
    });
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
