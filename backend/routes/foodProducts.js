const express = require("express");
const router = express.Router();
const prisma = require("../prisma/client");
const { HttpError } = require("../utils/errorHandler");
const { normalizeBarcode } = require("../utils/barcode");
const { fetchOpenFoodFacts, productFromOpenFoodFacts } = require("../utils/openFoodFacts");
const { parseMacros, toNumber } = require("../utils/validate");

function parseBarcode(value) {
  const barcode = normalizeBarcode(value);
  if (!barcode) throw new HttpError(400, "Not a valid barcode");
  return barcode;
}

// A product typed in by hand: its name and values per 100 g (or ml), and its package's size if
// that is known.
function parseProduct(body) {
  const { name, kcal, protein, carbs, fat } = parseMacros(body);
  if ([kcal, protein, carbs, fat].some((value) => value < 0)) {
    throw new HttpError(400, "Kcal, protein, carbs and fat must be valid numbers");
  }
  let packageSize = null;
  if (body.packageSize !== undefined && body.packageSize !== null && body.packageSize !== "") {
    packageSize = toNumber(body.packageSize);
    if (!(packageSize > 0)) throw new HttpError(400, "Package size must be a number above 0");
  }
  return { name, kcal, protein, carbs, fat, unit: body.unit === "ml" ? "ml" : "g", packageSize };
}

const keep = (barcode, data) =>
  prisma.foodProduct.upsert({ where: { barcode }, update: data, create: { barcode, ...data } });

// GET /api/food-products/:barcode
// { found: true, product } from what is kept here, or else from Open Food Facts (and kept from
// then on). { found: false, barcode, name } when nobody has its values; `name` is Open Food
// Facts' name for it, when it has one. A 502 when Open Food Facts can't be asked.
router.get("/:barcode", async (req, res) => {
  const barcode = parseBarcode(req.params.barcode);
  const kept = await prisma.foodProduct.findUnique({ where: { barcode } });
  if (kept) return res.json({ found: true, product: kept });

  let record;
  try {
    record = await fetchOpenFoodFacts(barcode);
  } catch (err) {
    console.warn(`Open Food Facts lookup of ${barcode} failed: ${err.message}`);
    throw new HttpError(502, "Product lookup failed");
  }
  const values = record ? productFromOpenFoodFacts(record) : null;
  if (!values?.name || values.kcal === null) {
    return res.json({ found: false, barcode, name: values?.name ?? null });
  }
  const product = await keep(barcode, { ...values, source: "openfoodfacts" });
  res.json({ found: true, product });
});

// PUT /api/food-products/:barcode { name, kcal, protein, carbs, fat, packageSize?, unit? }
// The user's own values for a product, per 100 g: from now on the barcode finds these.
router.put("/:barcode", async (req, res) => {
  const barcode = parseBarcode(req.params.barcode);
  const product = await keep(barcode, { ...parseProduct(req.body ?? {}), source: "user" });
  res.json(product);
});

module.exports = router;
