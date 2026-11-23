const test = require("node:test");
const assert = require("node:assert/strict");
const { productFromOpenFoodFacts, fetchOpenFoodFacts } = require("./openFoodFacts");

const yogurt = {
  product_name: "Greek yogurt 2%",
  product_name_hr: "Grčki jogurt 2 %",
  brands: "Dukat, Lactalis",
  product_quantity: "400",
  product_quantity_unit: "g",
  quantity: "400 g",
  serving_quantity: 150,
  nutriments: {
    "energy-kcal_100g": 73,
    proteins_100g: 9,
    carbohydrates_100g: "4,04",
    fat_100g: 2,
  },
};

test("productFromOpenFoodFacts keeps the Croatian name, the first brand and the values per 100 g", () => {
  assert.deepEqual(productFromOpenFoodFacts(yogurt), {
    name: "Grčki jogurt 2 %",
    brand: "Dukat",
    kcal: 73,
    protein: 9,
    carbs: 4,
    fat: 2,
    unit: "g",
    packageSize: 400,
    servingSize: 150,
  });
});

test("productFromOpenFoodFacts turns kJ into kcal when kcal is missing, and reads ml", () => {
  const juice = {
    product_name: "Sok od naranče",
    quantity: "1 l",
    nutriments: { energy_100g: 188, carbohydrates_100g: 10.4 },
  };
  const product = productFromOpenFoodFacts(juice);
  assert.equal(product.kcal, 45);
  assert.equal(product.unit, "ml");
  assert.equal(product.protein, 0);
  assert.equal(product.brand, null);
  assert.equal(product.packageSize, null);
});

test("productFromOpenFoodFacts gives no kcal for a record without energy, but its name", () => {
  const product = productFromOpenFoodFacts({ generic_name: " Čokolada ", nutriments: {} });
  assert.equal(product.kcal, null);
  assert.equal(product.name, "Čokolada");
});

function fakeFetch(status, body) {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    return { status, ok: status >= 200 && status < 300, json: async () => body };
  };
  return { fetchImpl, calls };
}

test("fetchOpenFoodFacts asks for the barcode's fields under the app's own name", async () => {
  const { fetchImpl, calls } = fakeFetch(200, { status: 1, product: yogurt });
  assert.equal(await fetchOpenFoodFacts("3850104000000", fetchImpl), yogurt);
  assert.match(calls[0].url, /\/api\/v2\/product\/3850104000000\?fields=.*nutriments/);
  assert.equal(calls[0].options.headers["User-Agent"], "IronLog/1.0 (personal food log)");
});

test("fetchOpenFoodFacts gives null for a barcode it doesn't know", async () => {
  assert.equal(await fetchOpenFoodFacts("1", fakeFetch(404, { status: 0 }).fetchImpl), null);
  assert.equal(await fetchOpenFoodFacts("1", fakeFetch(200, { status: 0 }).fetchImpl), null);
});

test("fetchOpenFoodFacts throws when Open Food Facts fails", async () => {
  await assert.rejects(fetchOpenFoodFacts("1", fakeFetch(503, null).fetchImpl), /answered 503/);
});
