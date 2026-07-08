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
    const entries = await prisma.bodyweight.findMany({
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
    const { date, weight } = req.body;
    if (!date || !weight) {
      return res.status(400).json({ error: "date and weight are required" });
    }
    const entry = await prisma.bodyweight.upsert({
      where: { date: new Date(date) },
      update: { weight: parseFloat(weight) },
      create: { date: new Date(date), weight: parseFloat(weight) },
    });
    res.json(entry);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
