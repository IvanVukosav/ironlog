const express = require("express");
const router = express.Router();
const { getDayRange } = require("../utils/dateRange");
const { parseId, parseDateKey, parseMacros } = require("../utils/validate");
const prisma = require("../prisma/client");

const RECENT_ITEMS_DEFAULT_LIMIT = 10;
const RECENT_ITEMS_MAX_LIMIT = 50;
// How many latest items to scan for distinct names.
const RECENT_ITEMS_SCAN_SIZE = 300;
// How far back a meal is looked for, to be eaten again "like last time".
const LAST_MEALS_DAYS = 14;

// Names of foods and meals are told apart without case or the spaces around them.
const nameKey = (name) => name.trim().toLowerCase();
const foodValues = ({ name, kcal, protein, carbs, fat }) => ({ name, kcal, protein, carbs, fat });

function parseLimit(value) {
  return Math.min(parseInt(value) || RECENT_ITEMS_DEFAULT_LIMIT, RECENT_ITEMS_MAX_LIMIT);
}

// The latest logged items, newest first, for lists of what was eaten lately.
function latestItems(include) {
  return prisma.foodItem.findMany({
    orderBy: [{ meal: { nutritionDay: { date: "desc" } } }, { id: "desc" }],
    take: RECENT_ITEMS_SCAN_SIZE,
    include,
  });
}

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

// POST /api/nutrition/days/copy { fromDate, toDate, mealName? }
// Copies every meal and item of fromDate into toDate (created if needed), or only the meal
// called mealName. Items go into the target's meal of the same name when it already has one.
router.post("/days/copy", async (req, res) => {
  const fromDate = parseDateKey(req.body?.fromDate, "fromDate");
  const toDate = new Date(parseDateKey(req.body?.toDate, "toDate"));
  const mealName = req.body?.mealName;
  if (mealName !== undefined && (typeof mealName !== "string" || mealName.trim() === "")) {
    return res.status(400).json({ error: "Meal name is required" });
  }

  const source = await prisma.nutritionDay.findFirst({
    where: { date: getDayRange(fromDate) },
    include: { meals: { include: { items: true } } },
  });
  const sourceMeals = (source?.meals ?? []).filter(
    (meal) =>
      meal.items.length > 0 && (mealName === undefined || nameKey(meal.name) === nameKey(mealName)),
  );
  if (sourceMeals.length === 0) {
    return res.status(404).json({ error: "Nothing to copy from that day" });
  }

  const target = await prisma.$transaction(async (tx) => {
    const day = await tx.nutritionDay.upsert({
      where: { date: toDate },
      update: {},
      create: { date: toDate },
      include: { meals: true },
    });
    const mealIdByName = new Map(day.meals.map((meal) => [nameKey(meal.name), meal.id]));

    for (const meal of sourceMeals) {
      let mealId = mealIdByName.get(nameKey(meal.name));
      if (!mealId) {
        mealId = (await tx.meal.create({ data: { name: meal.name, nutritionDayId: day.id } })).id;
        mealIdByName.set(nameKey(meal.name), mealId);
      }
      await tx.foodItem.createMany({
        data: meal.items.map((item) => ({ ...foodValues(item), mealId })),
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
  const limit = parseLimit(req.query.limit);
  const items = await latestItems();

  const seenNames = new Set();
  const recent = [];
  for (const item of items) {
    const key = nameKey(item.name);
    if (seenNames.has(key)) continue;
    seenNames.add(key);
    recent.push(foodValues(item));
    if (recent.length >= limit) break;
  }
  res.json(recent);
});

// GET /api/nutrition/recent-by-meal?limit=6
// The same for each meal name: [{ meal: "Doručak", items: [...] }], what was eaten lately at
// breakfast apart from what was eaten at lunch.
router.get("/recent-by-meal", async (req, res) => {
  const limit = parseLimit(req.query.limit);
  const items = await latestItems({ meal: { select: { name: true } } });

  const byMeal = new Map();
  for (const item of items) {
    const mealKey = nameKey(item.meal.name);
    if (!byMeal.has(mealKey)) {
      byMeal.set(mealKey, { meal: item.meal.name.trim(), items: [], seenNames: new Set() });
    }
    const entry = byMeal.get(mealKey);
    const key = nameKey(item.name);
    if (entry.items.length >= limit || entry.seenNames.has(key)) continue;
    entry.seenNames.add(key);
    entry.items.push(foodValues(item));
  }
  res.json([...byMeal.values()].map(({ meal, items: foods }) => ({ meal, items: foods })));
});

// GET /api/nutrition/last-meals?before=2026-11-23
// Each meal name's latest meal with food in it in the two weeks before that day, newest day
// first and in the order the day had them: [{ name, date, items }]. Prehrana offers them to
// eat again, and the day just before shows its meals ready to fill.
router.get("/last-meals", async (req, res) => {
  const before = new Date(parseDateKey(req.query.before, "before"));
  const since = new Date(before);
  since.setUTCDate(since.getUTCDate() - LAST_MEALS_DAYS);
  const days = await prisma.nutritionDay.findMany({
    where: { date: { gte: since, lt: before } },
    orderBy: { date: "desc" },
    include: { meals: { orderBy: { id: "asc" }, include: { items: { orderBy: { id: "asc" } } } } },
  });

  const seenNames = new Set();
  const meals = [];
  for (const day of days) {
    for (const meal of day.meals) {
      const key = nameKey(meal.name);
      if (meal.items.length === 0 || seenNames.has(key)) continue;
      seenNames.add(key);
      meals.push({ name: meal.name, date: day.date, items: meal.items.map(foodValues) });
    }
  }
  res.json(meals);
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
