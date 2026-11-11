const express = require("express");
const { Prisma } = require("@prisma/client");
const router = express.Router();
const prisma = require("../prisma/client");
const { HttpError } = require("../utils/errorHandler");

// Every settings column but the id, with its type. A PUT may only touch these: anything else
// would fail inside Prisma, and a stray `id` would even move the row away.
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

function parseSettingsBody(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new HttpError(400, "Settings must be an object");
  }
  const data = {};
  for (const [name, value] of Object.entries(body)) {
    const field = SETTINGS_FIELDS.get(name);
    if (!field) throw new HttpError(400, `Unknown setting: ${name}`);
    const { label, accepts } = TYPES[field.type];
    if (!accepts(value) && !(value === null && field.nullable)) {
      throw new HttpError(400, `${name} must be ${label}${field.nullable ? " or empty" : ""}`);
    }
    data[name] = value;
  }
  return data;
}

router.get("/", async (req, res) => {
  // A fresh database has no settings row yet. Creating it with the defaults here means every
  // page gets real values instead of null, and partial updates always have a full row.
  const settings = await prisma.settings.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1 },
  });
  res.json(settings);
});

router.put("/", async (req, res) => {
  const data = parseSettingsBody(req.body);
  const settings = await prisma.settings.upsert({
    where: { id: 1 },
    update: data,
    create: { id: 1, ...data },
  });
  res.json(settings);
});

module.exports = router;
