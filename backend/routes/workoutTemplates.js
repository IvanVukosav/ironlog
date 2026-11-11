const express = require("express");
const router = express.Router();
const prisma = require("../prisma/client");
const { parseId } = require("../utils/validate");

const TEMPLATE_INCLUDE = { exercises: { include: { sets: true } } };

router.get("/", async (req, res) => {
  const templates = await prisma.workoutTemplate.findMany({
    include: TEMPLATE_INCLUDE,
    orderBy: { name: "asc" },
  });
  res.json(templates);
});

router.post("/", async (req, res) => {
  const { name, exercises } = req.body ?? {};
  if (!name || !name.trim()) {
    return res.status(400).json({ error: "Name is required" });
  }
  if (!Array.isArray(exercises) || exercises.length === 0) {
    return res.status(400).json({ error: "At least one exercise is required" });
  }
  if (exercises.some((exercise) => !exercise.name?.trim())) {
    return res.status(400).json({ error: "Every exercise needs a name" });
  }

  const template = await prisma.workoutTemplate.create({
    data: {
      name: name.trim(),
      exercises: {
        create: exercises.map((exercise) => ({
          name: exercise.name.trim(),
          sets: {
            create: (exercise.sets || []).map((set) => ({
              weight: set.weight,
              reps: set.reps,
              rpe: set.rpe,
            })),
          },
        })),
      },
    },
    include: TEMPLATE_INCLUDE,
  });
  res.json(template);
});

router.post("/:id/apply", async (req, res) => {
  const workoutId = parseId(req.body?.workoutId);
  const template = await prisma.workoutTemplate.findUnique({
    where: { id: parseId(req.params.id) },
    include: TEMPLATE_INCLUDE,
  });
  if (!template) {
    return res.status(404).json({ error: "Workout template not found" });
  }

  const existingExerciseCount = await prisma.exercise.count({ where: { workoutId } });
  const createdExercises = [];
  for (const [index, templateExercise] of template.exercises.entries()) {
    const exercise = await prisma.exercise.create({
      data: {
        name: templateExercise.name,
        order: existingExerciseCount + index,
        workoutId,
        sets: {
          create: templateExercise.sets.map((set) => ({
            weight: set.weight,
            reps: set.reps,
            rpe: set.rpe,
          })),
        },
      },
      include: { sets: true },
    });
    createdExercises.push(exercise);
  }
  res.json(createdExercises);
});

router.delete("/:id", async (req, res) => {
  const templateId = parseId(req.params.id);
  const exercises = await prisma.workoutTemplateExercise.findMany({
    where: { workoutTemplateId: templateId },
  });
  const exerciseIds = exercises.map((exercise) => exercise.id);
  await prisma.workoutTemplateSet.deleteMany({
    where: { workoutTemplateExerciseId: { in: exerciseIds } },
  });
  await prisma.workoutTemplateExercise.deleteMany({ where: { workoutTemplateId: templateId } });
  await prisma.workoutTemplate.delete({ where: { id: templateId } });
  res.json({ success: true });
});

module.exports = router;
