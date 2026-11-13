const express = require("express");
const router = express.Router();
const prisma = require("../prisma/client");
const { parseId, parseDateKey, parseDateRangeQuery, toNumber } = require("../utils/validate");

const MEASUREMENT_FIELDS = ["waist", "chest", "arms", "thighs", "hips"];

router.get("/", async (req, res) => {
  const entries = await prisma.bodyMeasurement.findMany({
    where: { date: parseDateRangeQuery(req.query) },
    orderBy: { date: "asc" },
  });
  res.json(entries);
});

router.post("/", async (req, res) => {
  const date = new Date(parseDateKey(req.body?.date));
  // Any measurement may be left out; the ones given must be numbers ("85,5" is 85.5).
  const parseOptionalFloat = (value) =>
    value === "" || value === undefined || value === null ? null : toNumber(value);
  const data = Object.fromEntries(
    MEASUREMENT_FIELDS.map((field) => [field, parseOptionalFloat(req.body?.[field])]),
  );
  if (Object.values(data).some(Number.isNaN)) {
    return res.status(400).json({ error: "Measurements must be numbers" });
  }
  const entry = await prisma.bodyMeasurement.upsert({
    where: { date },
    update: data,
    create: { date, ...data },
  });
  res.json(entry);
});

router.delete("/:id", async (req, res) => {
  await prisma.bodyMeasurement.delete({ where: { id: parseId(req.params.id) } });
  res.json({ success: true });
});

module.exports = router;
