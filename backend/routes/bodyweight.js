const express = require("express");
const router = express.Router();
const prisma = require("../prisma/client");
const { parseId, parseDateKey, parseDateRangeQuery, toNumber } = require("../utils/validate");

router.get("/", async (req, res) => {
  const entries = await prisma.bodyweight.findMany({
    where: { date: parseDateRangeQuery(req.query) },
    orderBy: { date: "asc" },
  });
  res.json(entries);
});

router.post("/", async (req, res) => {
  const date = new Date(parseDateKey(req.body?.date));
  const weight = toNumber(req.body?.weight);
  if (!(weight > 0)) {
    return res.status(400).json({ error: "weight must be a number above 0" });
  }
  const entry = await prisma.bodyweight.upsert({
    where: { date },
    update: { weight },
    create: { date, weight },
  });
  res.json(entry);
});

router.delete("/:id", async (req, res) => {
  await prisma.bodyweight.delete({ where: { id: parseId(req.params.id) } });
  res.json({ success: true });
});

module.exports = router;
