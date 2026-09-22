const express = require("express");
const router = express.Router();
const prisma = require("../prisma/client");

router.get("/", async (req, res) => {
  try {
    let where = {};
    if (req.query.year && req.query.month) {
      const start = new Date(Date.UTC(req.query.year, req.query.month - 1, 1));
      const end = new Date(Date.UTC(req.query.year, req.query.month, 1));
      where = { date: { gte: start, lt: end } };
    } else {
      const days = parseInt(req.query.days) || 30;
      const since = new Date();
      since.setDate(since.getDate() - days);
      where = { date: { gte: since } };
    }
    const entries = await prisma.bodyMeasurement.findMany({
      where,
      orderBy: { date: "asc" },
    });
    res.json(entries);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/", async (req, res) => {
  try {
    const { date, waist, chest, arms, thighs, hips } = req.body;
    if (!date) {
      return res.status(400).json({ error: "date is required" });
    }
    const parseOptionalFloat = (value) =>
      value === "" || value === undefined || value === null ? null : parseFloat(value);
    const data = {
      waist: parseOptionalFloat(waist),
      chest: parseOptionalFloat(chest),
      arms: parseOptionalFloat(arms),
      thighs: parseOptionalFloat(thighs),
      hips: parseOptionalFloat(hips),
    };
    const entry = await prisma.bodyMeasurement.upsert({
      where: { date: new Date(date) },
      update: data,
      create: { date: new Date(date), ...data },
    });
    res.json(entry);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    await prisma.bodyMeasurement.delete({ where: { id: parseInt(req.params.id) } });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
