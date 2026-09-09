const express = require("express");
const router = express.Router();
const prisma = require("../prisma/client");

router.get("/", async (req, res) => {
  try {
    const templates = await prisma.workoutTemplate.findMany({
      include: { exercises: { include: { sets: true } } },
      orderBy: { name: "asc" },
    });
    res.json(templates);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/", async (req, res) => {
  try {
    const { name, exercises } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: "Name is required" });
    }
    if (!Array.isArray(exercises) || exercises.length === 0) {
      return res.status(400).json({ error: "At least one exercise is required" });
    }

    const template = await prisma.workoutTemplate.create({
      data: {
        name: name.trim(),
        exercises: {
          create: exercises.map((exercise) => ({
            name: exercise.name,
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
      include: { exercises: { include: { sets: true } } },
    });

    res.json(template);
  } catch (err) {
    if (err.code === "P2002") {
      return res.status(409).json({ error: "Workout template already exists" });
    }
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/:id/apply", async (req, res) => {
  try {
    const { workoutId } = req.body;

    const template = await prisma.workoutTemplate.findUnique({
      where: { id: parseInt(req.params.id) },
      include: { exercises: { include: { sets: true } } },
    });

    if (!template) {
      return res.status(404).json({ error: "Workout template not found" });
    }

    const createdExercises = [];
    for (const templateExercise of template.exercises) {
      const exercise = await prisma.exercise.create({
        data: {
          name: templateExercise.name,
          workoutId: parseInt(workoutId),
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
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const templateId = parseInt(req.params.id);
    const exercises = await prisma.workoutTemplateExercise.findMany({
      where: { workoutTemplateId: templateId },
    });
    const exerciseIds = exercises.map((exercise) => exercise.id);
    await prisma.workoutTemplateSet.deleteMany({
      where: { workoutTemplateExerciseId: { in: exerciseIds } },
    });
    await prisma.workoutTemplateExercise.deleteMany({
      where: { workoutTemplateId: templateId },
    });
    await prisma.workoutTemplate.delete({ where: { id: templateId } });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
