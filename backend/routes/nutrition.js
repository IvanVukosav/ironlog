const express = require("express");
const router = express.Router();
const { getDayRange } = require("../utils/dateRange");
const { parseId, parseDateKey, parseMacros } = require("../utils/validate");
const prisma = require("../prisma/client");

const RECENT_ITEMS_DEFAULT_LIMIT = 10;
const RECENT_ITEMS_MAX_LIMIT = 50;
// How many latest items to scan for distinct names.
const RECENT_ITEMS_SCAN_SIZE = 300;

// GET /api/nutrition?date=YYYY-MM-DD
router.get("/", async (req, res) => {
  const { date } = req.query;
  const days = await prisma.nutritionDay.findMany({
    where: date ? { date: getDayRange(parseDateKey(date)) } : undefined,
    include: { meals: { include: { items: true } } },
  });
  res.json(days);
});

// POST /api/nutrition/days
router.post("/days", async (req, res) => {
  const date = new Date(parseDateKey(req.body?.date));
  const day = await prisma.nutritionDay.upsert({
    where: { date },
    update: {},
    create: { date },
    include: { meals: { include: { items: true } } },
  });
  res.json(day);
});

// POST /api/nutrition/days/copy { fromDate, toDate }
// Copies every meal and item of fromDate into toDate (created if needed).
// Items go into the target's meal of the same name when it already has one.
router.post("/days/copy", async (req, res) => {
  const fromDate = parseDateKey(req.body?.fromDate, "fromDate");
  const toDate = new Date(parseDateKey(req.body?.toDate, "toDate"));

  const source = await prisma.nutritionDay.findFirst({
    where: { date: getDayRange(fromDate) },
    include: { meals: { include: { items: true } } },
  });
  if (!source || source.meals.every((meal) => meal.items.length === 0)) {
    return res.status(404).json({ error: "Nothing to copy from that day" });
  }

  const target = await prisma.$transaction(async (tx) => {
    const day = await tx.nutritionDay.upsert({
      where: { date: toDate },
      update: {},
      create: { date: toDate },
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
});

// GET /api/nutrition/recent-items?limit=10
// Distinct food items (by name) from the most recently logged days.
router.get("/recent-items", async (req, res) => {
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
});

// POST /api/nutrition/meals
router.post("/meals", async (req, res) => {
  const { name, nutritionDayId } = req.body ?? {};
  if (!name || name.trim() === "") {
    return res.status(400).json({ error: "Meal name is required" });
  }
  const meal = await prisma.meal.create({
    data: { name: name.trim(), nutritionDayId: parseId(nutritionDayId) },
    include: { items: true },
  });
  res.json(meal);
});

// DELETE /api/nutrition/meals/:id (its items go with it)
router.delete("/meals/:id", async (req, res) => {
  await prisma.meal.delete({ where: { id: parseId(req.params.id) } });
  res.json({ success: true });
});

// POST /api/nutrition/meals/:id/items
router.post("/meals/:id/items", async (req, res) => {
  const item = await prisma.foodItem.create({
    data: { ...parseMacros(req.body), mealId: parseId(req.params.id) },
  });
  res.json(item);
});

// PATCH /api/nutrition/items/:id
router.patch("/items/:id", async (req, res) => {
  const item = await prisma.foodItem.update({
    where: { id: parseId(req.params.id) },
    data: parseMacros(req.body),
  });
  res.json(item);
});

// DELETE /api/nutrition/items/:id
router.delete("/items/:id", async (req, res) => {
  await prisma.foodItem.delete({ where: { id: parseId(req.params.id) } });
  res.json({ success: true });
});

module.exports = router;
