const express = require("express");
const { Prisma } = require("@prisma/client");
const router = express.Router();
const prisma = require("../prisma/client");

const BACKUP_FORMAT_VERSION = 1;
const IMPORT_BODY_LIMIT = "50mb";
const IMPORT_TIMEOUT_MS = 60 * 1000;

// Parents before children; deletes run in reverse.
const MODELS = [
  "settings",
  "exerciseTemplate",
  "foodItemTemplate",
  "bodyweight",
  "bodyMeasurement",
  "program",
  "programDay",
  "programExercise",
  "workout",
  "exercise",
  "set",
  "nutritionDay",
  "meal",
  "foodItem",
  "workoutTemplate",
  "workoutTemplateExercise",
  "workoutTemplateSet",
];

// Scalar column names per model, so imports drop unknown keys (backups from a
// newer version) and leave missing ones to their defaults (older backups).
const COLUMNS_BY_MODEL = Object.fromEntries(
  Prisma.dmmf.datamodel.models.map((model) => [
    model.name.charAt(0).toLowerCase() + model.name.slice(1),
    model.fields.filter((field) => field.kind === "scalar").map((field) => field.name),
  ]),
);

function pickColumns(model, row) {
  return Object.fromEntries(COLUMNS_BY_MODEL[model].filter((column) => column in row).map((column) => [column, row[column]]));
}

function csvCell(value) {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

router.get("/export", async (req, res) => {
  try {
    const tables = {};
    for (const model of MODELS) {
      tables[model] = await prisma[model].findMany({ orderBy: { id: "asc" } });
    }
    const dateKey = new Date().toISOString().split("T")[0];
    res.setHeader("Content-Disposition", `attachment; filename="ironlog-backup-${dateKey}.json"`);
    res.json({ app: "ironlog", version: BACKUP_FORMAT_VERSION, exportedAt: new Date().toISOString(), tables });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Every logged set as one CSV row, for spreadsheets.
router.get("/sets.csv", async (req, res) => {
  try {
    const sets = await prisma.set.findMany({
      include: { exercise: { include: { workout: true } } },
      orderBy: [{ exercise: { workout: { date: "asc" } } }, { exercise: { order: "asc" } }, { order: "asc" }],
    });
    const header = ["date", "workout", "exercise", "set", "weight_kg", "reps", "rpe", "warmup", "exercise_notes"];
    const rows = sets.map((set) => [
      set.exercise.workout.date.toISOString().split("T")[0],
      set.exercise.workout.name,
      set.exercise.name,
      set.order + 1,
      set.weight,
      set.reps,
      set.rpe,
      set.isWarmup ? 1 : 0,
      set.exercise.notes,
    ]);
    const csv = [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
    const dateKey = new Date().toISOString().split("T")[0];
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="ironlog-sets-${dateKey}.csv"`);
    // BOM so Excel opens the UTF-8 file with č/ć/š intact.
    res.send(`﻿${csv}\r\n`);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Replaces ALL data with the backup's contents, in one transaction.
router.post("/import", express.json({ limit: IMPORT_BODY_LIMIT }), async (req, res) => {
  const backup = req.body;
  if (backup?.app !== "ironlog" || typeof backup.tables !== "object" || backup.tables === null) {
    return res.status(400).json({ error: "Not an Iron Log backup file" });
  }
  if (backup.version > BACKUP_FORMAT_VERSION) {
    return res.status(400).json({ error: "Backup is from a newer version of the app" });
  }
  const invalidTable = MODELS.find((model) => backup.tables[model] !== undefined && !Array.isArray(backup.tables[model]));
  if (invalidTable) {
    return res.status(400).json({ error: `Table "${invalidTable}" must be an array` });
  }

  try {
    const counts = await prisma.$transaction(async (tx) => {
      for (const model of [...MODELS].reverse()) {
        await tx[model].deleteMany();
      }
      const imported = {};
      for (const model of MODELS) {
        const rows = (backup.tables[model] ?? []).map((row) => pickColumns(model, row));
        if (rows.length > 0) {
          await tx[model].createMany({ data: rows });
        }
        imported[model] = rows.length;
      }
      return imported;
    }, { timeout: IMPORT_TIMEOUT_MS });

    res.json({ success: true, counts });
  } catch (err) {
    console.error(err);
    // Prisma validation errors mean the file's rows don't fit the schema.
    const isBadData = err instanceof Prisma.PrismaClientValidationError || err instanceof Prisma.PrismaClientKnownRequestError;
    res.status(isBadData ? 400 : 500).json({ error: isBadData ? "Backup data doesn't match the database" : "Internal server error" });
  }
});

module.exports = router;
