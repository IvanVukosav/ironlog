const express = require("express");
const router = express.Router();
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// GET /api/nutrition?date=YYYY-MM-DD
router.get("/", async (req, res) => {
  try {
    const { date } = req.query;
    const where = date
      ? { date: { gte: new Date(date), lt: new Date(new Date(date).getTime() + 86400000) } }
      : undefined;
    const days = await prisma.nutritionDay.findMany({
      where,
      include: { meals: { include: { items: true } } },
    });
    res.json(days);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/nutrition/days
router.post("/days", async (req, res) => {
  try {
    const { date } = req.body;
    const day = await prisma.nutritionDay.upsert({
      where: { date: new Date(date) },
      update: {},
      create: { date: new Date(date) },
      include: { meals: { include: { items: true } } },
    });
    res.json(day);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/nutrition/meals
router.post("/meals", async (req, res) => {
  try {
    const { name, nutritionDayId } = req.body;
    const meal = await prisma.meal.create({
      data: { name, nutritionDayId: parseInt(nutritionDayId) },
      include: { items: true },
    });
    res.json(meal);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/nutrition/meals/:id/items
router.post("/meals/:id/items", async (req, res) => {
  try {
    const { name, kcal, protein, carbs, fat } = req.body;
    const item = await prisma.foodItem.create({
      data: {
        name,
        kcal: parseFloat(kcal),
        protein: parseFloat(protein),
        carbs: parseFloat(carbs),
        fat: parseFloat(fat),
        mealId: parseInt(req.params.id),
      },
    });
    res.json(item);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/nutrition/items/:id
router.delete("/items/:id", async (req, res) => {
  try {
    await prisma.foodItem.delete({ where: { id: parseInt(req.params.id) } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
