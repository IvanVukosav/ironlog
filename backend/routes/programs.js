const express = require("express");
const router = express.Router();
const prisma = require("../prisma/client");
const { parseId } = require("../utils/validate");
const { HttpError } = require("../utils/errorHandler");

const MAX_WEEKS = 52;
const MAX_DAYS = 14;
const PROGRAM_INCLUDE = {
  days: {
    orderBy: { dayNumber: "asc" },
    include: { exercises: { orderBy: { order: "asc" } } },
  },
};

function serializeProgram(program) {
  return {
    ...program,
    days: program.days.map((day) => ({
      ...day,
      exercises: day.exercises.map((exercise) => ({
        ...exercise,
        weekSchemes: JSON.parse(exercise.weekSchemes),
      })),
    })),
  };
}

// The program's data ready for prisma create.
function parseProgramBody(body) {
  const name = body?.name?.trim();
  const weeks = parseInt(body?.weeks);
  const trainingMaxPercent =
    body?.trainingMaxPercent === undefined ? 100 : parseFloat(body.trainingMaxPercent);
  const days = body?.days;

  if (!name) throw new HttpError(400, "Name is required");
  if (!Number.isInteger(weeks) || weeks < 1 || weeks > MAX_WEEKS) {
    throw new HttpError(400, `Weeks must be between 1 and ${MAX_WEEKS}`);
  }
  if (!(trainingMaxPercent > 0 && trainingMaxPercent <= 100)) {
    throw new HttpError(400, "Training max must be between 1 and 100%");
  }
  if (!Array.isArray(days) || days.length === 0 || days.length > MAX_DAYS) {
    throw new HttpError(400, `Between 1 and ${MAX_DAYS} days are required`);
  }

  const dayData = [];
  for (const [dayIndex, day] of days.entries()) {
    if (!Array.isArray(day.exercises))
      throw new HttpError(400, "Each day needs an exercises array");
    const exerciseData = [];
    for (const [exerciseIndex, exercise] of day.exercises.entries()) {
      const exerciseName = exercise.name?.trim();
      if (!exerciseName) throw new HttpError(400, "Every exercise needs a name");
      const weekSchemes = Array.from({ length: weeks }, (_, week) =>
        String(exercise.weekSchemes?.[week] ?? "").trim(),
      );
      exerciseData.push({
        name: exerciseName,
        order: exerciseIndex,
        weekSchemes: JSON.stringify(weekSchemes),
      });
    }
    dayData.push({
      dayNumber: dayIndex + 1,
      name: day.name?.trim() || null,
      exercises: { create: exerciseData },
    });
  }

  return { name, weeks, trainingMaxPercent, days: { create: dayData } };
}

router.get("/", async (req, res) => {
  const programs = await prisma.program.findMany({
    include: PROGRAM_INCLUDE,
    orderBy: { name: "asc" },
  });
  res.json(programs.map(serializeProgram));
});

router.post("/", async (req, res) => {
  const data = parseProgramBody(req.body);
  const program = await prisma.program.create({ data, include: PROGRAM_INCLUDE });
  res.json(serializeProgram(program));
});

// Replaces the whole program: days and exercises are recreated from the body.
router.put("/:id", async (req, res) => {
  const data = parseProgramBody(req.body);
  const programId = parseId(req.params.id);
  const [, program] = await prisma.$transaction([
    prisma.programDay.deleteMany({ where: { programId } }),
    prisma.program.update({ where: { id: programId }, data, include: PROGRAM_INCLUDE }),
  ]);
  res.json(serializeProgram(program));
});

router.delete("/:id", async (req, res) => {
  await prisma.program.delete({ where: { id: parseId(req.params.id) } });
  res.json({ success: true });
});

// The day after the most recent workout logged from this program, wrapping
// into the next week; week 1 day 1 when nothing has been logged yet.
router.get("/:id/next", async (req, res) => {
  const programId = parseId(req.params.id);
  const program = await prisma.program.findUnique({
    where: { id: programId },
    include: { days: { select: { id: true } } },
  });
  if (!program) {
    return res.status(404).json({ error: "Program not found" });
  }

  const lastWorkout = await prisma.workout.findFirst({
    where: { programId, programWeek: { not: null }, programDay: { not: null } },
    orderBy: [{ date: "desc" }, { id: "desc" }],
  });
  if (!lastWorkout) {
    return res.json({ week: 1, day: 1, finished: false });
  }

  const dayCount = program.days.length;
  const isLastDayOfWeek = lastWorkout.programDay >= dayCount;
  const week = isLastDayOfWeek ? lastWorkout.programWeek + 1 : lastWorkout.programWeek;
  const day = isLastDayOfWeek ? 1 : lastWorkout.programDay + 1;
  const finished = week > program.weeks;
  res.json(finished ? { week: 1, day: 1, finished } : { week, day, finished });
});

module.exports = router;
