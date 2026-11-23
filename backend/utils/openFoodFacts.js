// Open Food Facts (world.openfoodfacts.org), the open database of packaged foods that the barcode
// scanner looks products up in. It asks the apps that call it to name themselves in the
// User-Agent; this one gives no contact. OPEN_FOOD_FACTS_URL points tests at a stand-in.
const PRODUCT_URL = "https://world.openfoodfacts.org/api/v2/product/";
const FIELDS = [
  "product_name_hr",
  "product_name",
  "product_name_en",
  "generic_name",
  "brands",
  "product_quantity",
  "product_quantity_unit",
  "quantity",
  "serving_quantity",
  "nutriments",
];
const USER_AGENT = "IronLog/1.0 (personal food log)";
const TIMEOUT_MS = 8000;
const KJ_PER_KCAL = 4.184;

const roundTenth = (value) => Math.round(value * 10) / 10;

// A number the record holds, as a number or as text ("12,5" too), or null.
function numberOf(value) {
  const number = typeof value === "string" ? Number(value.trim().replace(",", ".")) : value;
  return typeof number === "number" && Number.isFinite(number) && number >= 0 ? number : null;
}

// A size: a number above 0, or null.
function sizeOf(value) {
  const number = numberOf(value);
  return number > 0 ? number : null;
}

// "g" or "ml": the record's own unit, else what its quantity text says ("1 l", "500 ml").
function unitOf(product) {
  const unit = String(product.product_quantity_unit ?? "").toLowerCase();
  if (unit === "g" || unit === "ml") return unit;
  return /\d\s*(ml|cl|dl|l)\b/i.test(String(product.quantity ?? "")) ? "ml" : "g";
}

/**
 * What Open Food Facts has on a product, per 100 g (or 100 ml), in the shape the app keeps it.
 * `kcal` is null when the record has no energy at all (kJ alone is turned into kcal), and then
 * there is nothing to log the product by; `name` is there either way, to start a form with.
 * Grams the record leaves out count as 0.
 */
function productFromOpenFoodFacts(product) {
  const nutriments = product.nutriments ?? {};
  // "energy_100g" is in kJ, like "energy-kj_100g".
  const kj = numberOf(nutriments["energy-kj_100g"]) ?? numberOf(nutriments.energy_100g);
  const kcal = numberOf(nutriments["energy-kcal_100g"]) ?? (kj === null ? null : kj / KJ_PER_KCAL);
  const grams = (key) => roundTenth(numberOf(nutriments[`${key}_100g`]) ?? 0);
  const names = [
    product.product_name_hr,
    product.product_name,
    product.product_name_en,
    product.generic_name,
  ];
  return {
    name: names.map((text) => String(text ?? "").trim()).find(Boolean) ?? null,
    brand:
      String(product.brands ?? "")
        .split(",")[0]
        .trim() || null,
    kcal: kcal === null ? null : Math.round(kcal),
    protein: grams("proteins"),
    carbs: grams("carbohydrates"),
    fat: grams("fat"),
    unit: unitOf(product),
    packageSize: sizeOf(product.product_quantity),
    servingSize: sizeOf(product.serving_quantity),
  };
}

// The product's record, or null when Open Food Facts doesn't know the barcode. Throws when it
// can't be asked: no connection, no answer within 8 s, or a server error.
async function fetchOpenFoodFacts(barcode, fetchImpl = fetch) {
  const base = process.env.OPEN_FOOD_FACTS_URL || PRODUCT_URL;
  const response = await fetchImpl(`${base}${barcode}?fields=${FIELDS.join(",")}`, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Open Food Facts answered ${response.status}`);
  const data = await response.json();
  return data.status === 1 && data.product ? data.product : null;
}

module.exports = { productFromOpenFoodFacts, fetchOpenFoodFacts };
