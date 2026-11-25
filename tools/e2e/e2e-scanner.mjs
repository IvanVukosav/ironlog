// End-to-end run of Prehrana's barcode scanner against the test backend (throwaway database).
// Chrome gets a fake camera, the page a stand-in BarcodeDetector that "reads" what the run puts
// in window.__barcodes, and the backend (started with OPEN_FOOD_FACTS_URL=http://localhost:3098/
// api/v2/product/) a stand-in Open Food Facts served here.
// Usage: node e2e-scanner.mjs [--phone]
import { createServer } from "node:http";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { mkdirSync } from "node:fs";
import { launch, sleep } from "./cdp.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const phone = process.argv.includes("--phone");
const shots = join(here, "shots", `e2e-scanner${phone ? "-phone" : ""}`);
mkdirSync(shots, { recursive: true });
const APP = process.env.E2E_APP ?? "http://localhost:5199";
const API = "http://localhost:3002";

const pad = (value) => String(value).padStart(2, "0");
const now = new Date();
const dateKey = (daysAgo) => {
  const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysAgo);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};
const today = dateKey(0);

async function api(path, method = "GET", json) {
  const response = await fetch(`${API}${path}`, {
    method,
    headers: json ? { "Content-Type": "application/json" } : undefined,
    body: json ? JSON.stringify(json) : undefined,
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(`${method} ${path}: ${response.status} ${JSON.stringify(data)}`);
  return data;
}
const dayOf = async (key) => (await api(`/api/nutrition?date=${key}`))[0] ?? null;
const mealsOf = async (key) => (await dayOf(key))?.meals ?? [];

// A fresh EAN-13 starting with `prefix`, its check digit worked out, so no earlier run's kept
// product answers for it.
function freshBarcode(prefix) {
  let digits = prefix;
  while (digits.length < 12) digits += Math.floor(Math.random() * 10);
  let sum = 0;
  for (let index = 11, weight = 3; index >= 0; index--, weight = 4 - weight) sum += Number(digits[index]) * weight;
  return `${digits}${(10 - (sum % 10)) % 10}`;
}

// ---------- the stand-in Open Food Facts ----------
// 200…: a skyr; 201…: not there; 202…: the server failing.
const off = createServer((req, res) => {
  const code = /product\/(\d+)/.exec(req.url)?.[1] ?? "";
  const send = (status, body) => {
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify(body));
  };
  if (code.startsWith("200")) {
    return send(200, {
      status: 1,
      product: {
        product_name: "Skyr natur",
        brands: "Testna mljekara",
        product_quantity: 450,
        product_quantity_unit: "g",
        serving_quantity: 150,
        nutriments: { "energy-kcal_100g": 63, proteins_100g: 11, carbohydrates_100g: 4, fat_100g: 0.2 },
      },
    });
  }
  if (code.startsWith("202")) return send(503, { error: "busy" });
  return send(404, { status: 0, status_verbose: "product not found" });
});
await new Promise((resolve) => off.listen(3098, resolve));

// ---------- data ----------
for (let daysAgo = 0; daysAgo <= 15; daysAgo++) {
  for (const meal of (await dayOf(dateKey(daysAgo)))?.meals ?? []) {
    await api(`/api/nutrition/meals/${meal.id}`, "DELETE");
  }
}
for (const template of await api("/api/food-item-templates")) {
  await api(`/api/food-item-templates/${template.id}`, "DELETE");
}
await api("/api/settings", "PUT", { language: "hr", theme: "auto", template: "moderna" });
const before = await api("/api/nutrition/days", "POST", { date: dateKey(1) });
const breakfast = await api("/api/nutrition/meals", "POST", { name: "Doručak", nutritionDayId: before.id });
await api(`/api/nutrition/meals/${breakfast.id}/items`, "POST", {
  name: "Zobene pahuljice",
  kcal: 300,
  protein: 10,
  carbs: 51,
  fat: 6,
});

// ---------- the run ----------
const results = [];
function expect(condition, message) {
  if (!condition) throw new Error(message);
}
const browser = await launch({
  port: 9348,
  profile: join(here, "chrome-profile-e2e-scanner"),
  width: phone ? 390 : 1280,
  height: phone ? 844 : 900,
  mobile: phone,
  extraArgs: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"],
});
const { evaluate, waitFor, click, type } = browser;
await browser.send("Page.addScriptToEvaluateOnNewDocument", {
  source: `window.__barcodes = [];
  window.BarcodeDetector = class {
    static async getSupportedFormats() { return ["ean_13", "ean_8", "upc_a", "upc_e", "qr_code"]; }
    constructor(options) { this.formats = options?.formats ?? []; }
    async detect() {
      const next = window.__barcodes.shift();
      return next ? [{ rawValue: next, format: "ean_13", boundingBox: {}, cornerPoints: [] }] : [];
    }
  };`,
});

const q = (text) => JSON.stringify(text);
const meal = (name) =>
  `[...document.querySelectorAll('section')].find((s) => s.querySelector('h2')?.textContent.trim() === ${q(name)})`;
// The scanner's own window, and the Sheet with what a barcode found (drawn into the body beside
// it); text and buttons are looked for in both.
const scanner = `document.querySelector('div[role="dialog"][aria-modal="true"]')`;
const sheet = `document.querySelector('section[role="dialog"][aria-modal="true"]')`;
const dialogs = `[...document.querySelectorAll('[role="dialog"][aria-modal="true"]')]`;
const dialogsText = `${dialogs}.map((d) => d.innerText).join(' ')`;
const scannerText = () => evaluate(`(${dialogsText}).replace(/\\s+/g, ' ').trim()`);
const inScanner = (selector) => `${scanner}.querySelector(${q(selector)})`;
const buttonInScanner = (text) => `${dialogs}.map((d) => __e2e.byText('button', ${q(text)}, d)).find(Boolean)`;

async function step(name, run) {
  try {
    await run();
    results.push(`PASS  ${name}`);
  } catch (err) {
    results.push(`FAIL  ${name}\n        ${String(err.message).split("\n")[0]}`);
    await browser.screenshot(join(shots, `FAIL-${results.length}.png`), false).catch(() => {});
  }
}

const openScanner = async () => {
  await click(`${meal("Doručak")}.querySelector('button[aria-label="Skeniraj barkod"]')`);
  await waitFor(scanner, "the scanner");
};

try {
  await browser.navigate(`${APP}/nutrition`);
  await waitFor(`${meal("Doručak")}`, "the Doručak card", 15000);
  const skyr = freshBarcode("200");
  const unknown = freshBarcode("201");
  const failing = freshBarcode("202");

  await step("the barcode button opens the scanner over the page, with the camera on", async () => {
    await openScanner();
    await waitFor(`(${dialogsText}).includes('Usmjeri kameru na barkod')`, "the camera's hint", 10000);
    const text = await scannerText();
    expect(text.includes("Skeniraj barkod") && text.includes("Dodaješ u: Doručak"), `scanner: ${text}`);
    await waitFor(`${inScanner("video")}.readyState >= 2 && !${inScanner("video")}.paused`, "the camera's picture");
    await browser.screenshot(join(shots, "camera.png"), false);
  });

  await step("a barcode the camera reads is looked up, and its product shown per 100 g", async () => {
    await evaluate(`window.__barcodes.push(${q(skyr)}), true`);
    await waitFor(`(${dialogsText}).includes('Pronađeno')`, "the found product", 10000);
    const text = await scannerText();
    expect(text.includes("Skyr natur"), `scanner: ${text}`);
    expect(text.includes("Testna mljekara · Pakiranje 450 g · na 100 g: 63 kcal · B 11 g · UH 4 g · M 0,2 g"), `detail: ${text}`);
  });

  await step("it starts at a serving; the amount changes what it holds", async () => {
    const amount = `${sheet}.querySelector('input[inputmode="decimal"]')`;
    expect((await evaluate(`${amount}.value`)) === "150", "it didn't start at the 150 g serving");
    expect((await scannerText()).includes("kcal 95 Bjel. 16,5 g"), `tiles: ${await scannerText()}`);
    await click(buttonInScanner("Cijelo · 450 g"));
    expect((await evaluate(`${amount}.value`)) === "450", "Cijelo didn't set 450");
    expect((await scannerText()).includes("kcal 284"), `tiles: ${await scannerText()}`);
    await click(`${sheet}.querySelector('button[aria-label="Manje"]')`);
    expect((await evaluate(`${amount}.value`)) === "440", "− didn't take 10 off");
    await type(amount, "200");
    expect((await scannerText()).includes("kcal 126 Bjel. 22 g"), `tiles: ${await scannerText()}`);
    await browser.screenshot(join(shots, "product.png"), false);
  });

  await step("Dodaj u Doručak adds the amount by name and closes; Spremi u Omiljeno keeps it", async () => {
    await click(`${sheet}.querySelector('button[role="switch"]')`);
    await click(buttonInScanner("Dodaj u Doručak"));
    await waitFor(`!${scanner}`, "the scanner to close");
    await waitFor(`${meal("Doručak")}.querySelectorAll('li').length === 1`, "the row");
    const saved = (await mealsOf(today)).find((entry) => entry.name === "Doručak");
    const item = saved?.items[0];
    expect(item?.name === "Skyr natur 200 g" && item.kcal === 126 && item.protein === 22, `saved: ${JSON.stringify(saved)}`);
    await waitFor(`fetch('${API}/api/food-item-templates').then((r) => r.json()).then((t) => t.some((f) => f.name === 'Skyr natur 200 g'))`, "the favourite");
  });

  await step("a barcode nobody knows asks for its values once, and then finds them", async () => {
    await openScanner();
    await click(buttonInScanner("Upiši barkod ručno"));
    await type(`${scanner}.querySelector('input[inputmode="numeric"]')`, unknown);
    await click(buttonInScanner("Traži"));
    await waitFor(`(${dialogsText}).includes('Nije pronađeno')`, "not found", 10000);
    const form = `${sheet}.querySelector('form:has([data-field="kcal"])')`;
    await type(`${form}.querySelector('input')`, "Domaći kefir");
    await type(`${form}.querySelector('[data-field="kcal"] input')`, "60");
    await type(`${form}.querySelector('[data-field="protein"] input')`, "3,4");
    await click(buttonInScanner("Spremi proizvod"));
    await waitFor(`(${dialogsText}).includes('Pronađeno') && (${dialogsText}).includes('Domaći kefir')`, "the saved product");
    const kept = await api(`/api/food-products/${unknown}`);
    expect(kept.found && kept.product.source === "user" && kept.product.protein === 3.4, `kept: ${JSON.stringify(kept)}`);
  });

  await step("Skeniraj ponovno goes back to the camera", async () => {
    await click(buttonInScanner("Skeniraj ponovno"));
    await waitFor(`!(${dialogsText}).includes('Pronađeno') && (${dialogsText}).includes('Usmjeri kameru na barkod')`, "the camera again");
  });

  await step("a typed number that isn't a barcode says so", async () => {
    await click(buttonInScanner("Upiši barkod ručno"));
    await type(`${scanner}.querySelector('input[inputmode="numeric"]')`, "4006381333932");
    await click(buttonInScanner("Traži"));
    await waitFor(`(${dialogsText}).includes('Taj broj nije barkod.')`, "the message");
  });

  await step("Open Food Facts not answering offers to try again", async () => {
    await type(`${scanner}.querySelector('input[inputmode="numeric"]')`, failing);
    await click(buttonInScanner("Traži"));
    await waitFor(`(${dialogsText}).includes('Nije uspjelo')`, "the failure", 10000);
    const text = await scannerText();
    expect(text.includes("Open Food Facts se sad ne javlja.") && text.includes("Pokušaj ponovno"), `scanner: ${text}`);
  });

  await step("Escape on what was found closes only that, back to the scanner", async () => {
    await browser.press("Escape", "Escape", 27);
    await waitFor(`!${sheet} && !!${scanner}`, "the sheet to close and the scanner to stay");
  });

  await step("'Nema ga? Upiši namirnicu sam' closes it at the meal's own name field", async () => {
    await click(buttonInScanner("Nema ga? Upiši namirnicu sam"));
    await waitFor(`!${scanner}`, "the scanner to close");
    await sleep(100);
    const focused = await evaluate(`document.activeElement?.placeholder ?? ''`);
    expect(focused === "Pretraži ili upiši novu", `focus is on "${focused}"`);
  });

  await step("Escape closes it", async () => {
    await openScanner();
    await browser.press("Escape", "Escape", 27);
    await waitFor(`!${scanner}`, "the scanner to close");
  });

  await step("with the camera not allowed, it says so and opens on typing the number", async () => {
    await evaluate(
      "navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException('no', 'NotAllowedError')), true",
    );
    await openScanner();
    await waitFor(`(${dialogsText}).includes('Kamera nije dopuštena.')`, "the note");
    const text = await scannerText();
    expect(text.includes("Dopusti je u postavkama preglednika"), `scanner: ${text}`);
    expect(await evaluate(`!!${scanner}.querySelector('input[inputmode="numeric"]')`), "no field for the number");
    expect(!(await evaluate(`__e2e.visible(${inScanner("video")})`)), "the camera's box shows");
    await browser.screenshot(join(shots, "no-camera.png"), false);
    await browser.press("Escape", "Escape", 27);
  });

  await step("the page made no errors of its own", async () => {
    expect(browser.problems.length === 0, browser.problems.join(" || "));
  });
} finally {
  console.log(results.join("\n"));
  const failed = results.filter((line) => line.startsWith("FAIL")).length;
  console.log(`\n${results.length - failed} passed, ${failed} failed (scanner${phone ? ", phone" : ""})`);
  await browser.close();
  off.close();
}
