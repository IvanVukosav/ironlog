const express = require("express");
const router = express.Router();
const { getDayRange } = require("../utils/dateRange");
const prisma = require("../prisma/client");

// GET /api/nutrition?date=YYYY-MM-DD
router.get("/", async (req, res) => {
  try {
    const { date } = req.query;
    const where = date ? { date: getDayRange(date) } : undefined;
    const days = await prisma.nutritionDay.findMany({
      where,
      include: { meals: { include: { items: true } } },
    });
    res.json(days);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
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
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/nutrition/meals
router.post("/meals", async (req, res) => {
  try {
    const { name, nutritionDayId } = req.body;

    if (!name || name.trim() === "") {
      return res.status(400).json({ error: "Meal name is required" });
    }

    const meal = await prisma.meal.create({
      data: { name, nutritionDayId: parseInt(nutritionDayId) },
      include: { items: true },
    });
    res.json(meal);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/nutrition/meals/:id/items
router.post("/meals/:id/items", async (req, res) => {
  try {
    const { name, kcal, protein, carbs, fat } = req.body;

    if (!name || name.trim() === "") {
      return res.status(400).json({ error: "Food item name is required" });
    }

    const parsedKcal = parseFloat(kcal);
    const parsedProtein = parseFloat(protein);
    const parsedCarbs = parseFloat(carbs);
    const parsedFat = parseFloat(fat);

    if (
      [parsedKcal, parsedProtein, parsedCarbs, parsedFat].some(Number.isNaN)
    ) {
      return res
        .status(400)
        .json({ error: "Kcal, protein, carbs and fat must be valid numbers" });
    }

    const item = await prisma.foodItem.create({
      data: {
        name,
        kcal: parsedKcal,
        protein: parsedProtein,
        carbs: parsedCarbs,
        fat: parsedFat,
        mealId: parseInt(req.params.id),
      },
    });
    res.json(item);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/nutrition/items/:id
router.delete("/items/:id", async (req, res) => {
  try {
    await prisma.foodItem.delete({ where: { id: parseInt(req.params.id) } });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
