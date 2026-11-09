const express = require("express");
const router = express.Router();
const { getDayRange } = require("../utils/dateRange");
const prisma = require("../prisma/client");

const RECENT_ITEMS_DEFAULT_LIMIT = 10;
const RECENT_ITEMS_MAX_LIMIT = 50;
// How many latest items to scan for distinct names.
const RECENT_ITEMS_SCAN_SIZE = 300;

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

// POST /api/nutrition/days/copy { fromDate, toDate }
// Copies every meal and item of fromDate into toDate (created if needed).
// Items go into the target's meal of the same name when it already has one.
router.post("/days/copy", async (req, res) => {
  try {
    const { fromDate, toDate } = req.body ?? {};
    if (!fromDate || !toDate) {
      return res.status(400).json({ error: "fromDate and toDate are required" });
    }

    const source = await prisma.nutritionDay.findFirst({
      where: { date: getDayRange(fromDate) },
      include: { meals: { include: { items: true } } },
    });
    if (!source || source.meals.every((meal) => meal.items.length === 0)) {
      return res.status(404).json({ error: "Nothing to copy from that day" });
    }

    const target = await prisma.$transaction(async (tx) => {
      const day = await tx.nutritionDay.upsert({
        where: { date: new Date(toDate) },
        update: {},
        create: { date: new Date(toDate) },
        include: { meals: true },
      });
      const mealIdByName = new Map(day.meals.map((meal) => [meal.name, meal.id]));

      for (const meal of source.meals.filter((sourceMeal) => sourceMeal.items.length > 0)) {
        let mealId = mealIdByName.get(meal.name);
        if (!mealId) {
          mealId = (await tx.meal.create({ data: { name: meal.name, nutritionDayId: day.id } })).id;
          mealIdByName.set(meal.name, mealId);
        }
        await tx.foodItem.createMany({
          data: meal.items.map(({ name, kcal, protein, carbs, fat }) => ({
            name,
            kcal,
            protein,
            carbs,
            fat,
            mealId,
          })),
        });
      }

      return tx.nutritionDay.findUnique({
        where: { id: day.id },
        include: { meals: { include: { items: true } } },
      });
    });

    res.json(target);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/nutrition/recent-items?limit=10
// Distinct food items (by name) from the most recently logged days.
router.get("/recent-items", async (req, res) => {
  try {
    const limit = Math.min(
      parseInt(req.query.limit) || RECENT_ITEMS_DEFAULT_LIMIT,
      RECENT_ITEMS_MAX_LIMIT,
    );
    const items = await prisma.foodItem.findMany({
      orderBy: [{ meal: { nutritionDay: { date: "desc" } } }, { id: "desc" }],
      take: RECENT_ITEMS_SCAN_SIZE,
    });

    const seenNames = new Set();
    const recent = [];
    for (const { name, kcal, protein, carbs, fat } of items) {
      const key = name.trim().toLowerCase();
      if (seenNames.has(key)) continue;
      seenNames.add(key);
      recent.push({ name, kcal, protein, carbs, fat });
      if (recent.length >= limit) break;
    }
    res.json(recent);
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

// DELETE /api/nutrition/meals/:id
router.delete("/meals/:id", async (req, res) => {
  try {
    const mealId = parseInt(req.params.id);
    await prisma.foodItem.deleteMany({ where: { mealId } });
    await prisma.meal.delete({ where: { id: mealId } });
    res.json({ success: true });
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

    if ([parsedKcal, parsedProtein, parsedCarbs, parsedFat].some(Number.isNaN)) {
      return res.status(400).json({ error: "Kcal, protein, carbs and fat must be valid numbers" });
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

// PATCH /api/nutrition/items/:id
router.patch("/items/:id", async (req, res) => {
  try {
    const { name, kcal, protein, carbs, fat } = req.body;

    if (!name || name.trim() === "") {
      return res.status(400).json({ error: "Food item name is required" });
    }

    const parsedKcal = parseFloat(kcal);
    const parsedProtein = parseFloat(protein);
    const parsedCarbs = parseFloat(carbs);
    const parsedFat = parseFloat(fat);

    if ([parsedKcal, parsedProtein, parsedCarbs, parsedFat].some(Number.isNaN)) {
      return res.status(400).json({ error: "Kcal, protein, carbs and fat must be valid numbers" });
    }

    const item = await prisma.foodItem.update({
      where: { id: parseInt(req.params.id) },
      data: {
        name,
        kcal: parsedKcal,
        protein: parsedProtein,
        carbs: parsedCarbs,
        fat: parsedFat,
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
