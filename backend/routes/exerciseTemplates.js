const express = require("express");
const router = express.Router();
const prisma = require("../prisma/client");
const { parseId } = require("../utils/validate");

router.get("/", async (req, res) => {
  const templates = await prisma.exerciseTemplate.findMany({ orderBy: { name: "asc" } });
  res.json(templates);
});

router.post("/", async (req, res) => {
  const { name, muscleGroup } = req.body ?? {};
  if (!name || !name.trim()) {
    return res.status(400).json({ error: "Name is required" });
  }
  if (!muscleGroup || !muscleGroup.trim()) {
    return res.status(400).json({ error: "Muscle group is required" });
  }
  const template = await prisma.exerciseTemplate.create({
    data: { name: name.trim(), muscleGroup: muscleGroup.trim() },
  });
  res.json(template);
});

router.delete("/:id", async (req, res) => {
  await prisma.exerciseTemplate.delete({ where: { id: parseId(req.params.id) } });
  res.json({ success: true });
});

module.exports = router;
