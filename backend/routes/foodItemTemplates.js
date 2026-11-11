const express = require("express");
const router = express.Router();
const prisma = require("../prisma/client");
const { parseId, parseMacros } = require("../utils/validate");

router.get("/", async (req, res) => {
  const templates = await prisma.foodItemTemplate.findMany({ orderBy: { name: "asc" } });
  res.json(templates);
});

router.post("/", async (req, res) => {
  const template = await prisma.foodItemTemplate.create({ data: parseMacros(req.body) });
  res.json(template);
});

router.delete("/:id", async (req, res) => {
  await prisma.foodItemTemplate.delete({ where: { id: parseId(req.params.id) } });
  res.json({ success: true });
});

module.exports = router;
