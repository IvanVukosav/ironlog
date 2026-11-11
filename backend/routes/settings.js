const express = require("express");
const { Prisma } = require("@prisma/client");
const router = express.Router();
const prisma = require("../prisma/client");

// Every settings column but the id, with its type. A PUT may only touch these: anything else
// would fail inside Prisma as a 500, and a stray `id` would even move the row away.
const SETTINGS_FIELDS = new Map(
  Prisma.dmmf.datamodel.models
    .find((model) => model.name === "Settings")
    .fields.filter((field) => field.kind === "scalar" && field.name !== "id")
    .map((field) => [field.name, { type: field.type, nullable: !field.isRequired }]),
);

const TYPES = {
  Boolean: { label: "true or false", accepts: (value) => typeof value === "boolean" },
  Int: { label: "a whole number", accepts: Number.isInteger },
  Float: { label: "a number", accepts: Number.isFinite },
  String: { label: "text", accepts: (value) => typeof value === "string" },
};

// Returns { data } with the fields to save, or { error } for a 400.
function parseSettingsBody(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { error: "Settings must be an object" };
  }
  const data = {};
  for (const [name, value] of Object.entries(body)) {
    const field = SETTINGS_FIELDS.get(name);
    if (!field) return { error: `Unknown setting: ${name}` };
    const { label, accepts } = TYPES[field.type];
    if (!accepts(value) && !(value === null && field.nullable)) {
      return { error: `${name} must be ${label}${field.nullable ? " or empty" : ""}` };
    }
    data[name] = value;
  }
  return { data };
}

router.get("/", async (req, res) => {
  try {
    // A fresh database has no settings row yet. Creating it with the defaults here means every
    // page gets real values instead of null, and partial updates always have a full row.
    const settings = await prisma.settings.upsert({
      where: { id: 1 },
      update: {},
      create: { id: 1 },
    });
    res.json(settings);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/", async (req, res) => {
  const { data, error } = parseSettingsBody(req.body);
  if (error) return res.status(400).json({ error });
  try {
    const settings = await prisma.settings.upsert({
      where: { id: 1 },
      update: data,
      create: { id: 1, ...data },
    });
    res.json(settings);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
