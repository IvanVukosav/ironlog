const express = require("express");
const router = express.Router();
const prisma = require("../prisma/client");

router.get("/", async (req, res) => {
  try {
    const templates = await prisma.foodItemTemplate.findMany({
      orderBy: { name: "asc" },
    });
    res.json(templates);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/", async (req, res) => {
  try {
    const { name, kcal, protein, carbs, fat } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: "Name is required" });
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

    const template = await prisma.foodItemTemplate.create({
      data: {
        name: name.trim(),
        kcal: parsedKcal,
        protein: parsedProtein,
        carbs: parsedCarbs,
        fat: parsedFat,
      },
    });
    res.json(template);
  } catch (err) {
    if (err.code === "P2002") {
      return res.status(409).json({ error: "Food item already exists" });
    }
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    await prisma.foodItemTemplate.delete({
      where: { id: parseInt(req.params.id) },
    });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
