// End-to-end run of the scanner reading a real barcode with ZXing: this Chrome has no
// BarcodeDetector, and its fake camera shows an EAN-13 made by make-barcode-y4m.mjs. The product
// comes from a stand-in Open Food Facts on :3098 (the 3002 backend must point there).
// Usage: node e2e-scanner-zxing.mjs [--phone]
import { createServer } from "node:http";
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { mkdirSync } from "node:fs";
import { launch } from "./cdp.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const phone = process.argv.includes("--phone");
const shots = join(here, "shots", `e2e-scanner-zxing${phone ? "-phone" : ""}`);
mkdirSync(shots, { recursive: true });
const APP = process.env.E2E_APP ?? "http://localhost:5199";
const API = "http://localhost:3002";
const BARCODE = "2001234567893";
const video = join(here, "barcode-2001234567893.y4m");
execFileSync(process.execPath, [join(here, "make-barcode-y4m.mjs"), BARCODE, video]);

const pad = (value) => String(value).padStart(2, "0");
const now = new Date();
const dateKey = (daysAgo) => {
  const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysAgo);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};
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

const off = createServer((req, res) => {
  const code = /product\/(\d+)/.exec(req.url)?.[1] ?? "";
  res.writeHead(code === BARCODE ? 200 : 404, { "Content-Type": "application/json" });
  res.end(
    JSON.stringify(
      code === BARCODE
        ? {
            status: 1,
            product: {
              product_name: "Skyr natur",
              product_quantity: 450,
              serving_quantity: 150,
              nutriments: { "energy-kcal_100g": 63, proteins_100g: 11, carbohydrates_100g: 4, fat_100g: 0.2 },
            },
          }
        : { status: 0 },
    ),
  );
});
await new Promise((resolve) => off.listen(3098, resolve));

// A Doručak yesterday, so today offers its card with the scan button.
for (let daysAgo = 0; daysAgo <= 15; daysAgo++) {
  const [day] = await api(`/api/nutrition?date=${dateKey(daysAgo)}`);
  for (const meal of day?.meals ?? []) await api(`/api/nutrition/meals/${meal.id}`, "DELETE");
}
const before = await api("/api/nutrition/days", "POST", { date: dateKey(1) });
const breakfast = await api("/api/nutrition/meals", "POST", { name: "Doručak", nutritionDayId: before.id });
await api(`/api/nutrition/meals/${breakfast.id}/items`, "POST", { name: "Jaja", kcal: 210, protein: 18, carbs: 1, fat: 15 });

const results = [];
function expect(condition, message) {
  if (!condition) throw new Error(message);
}
const browser = await launch({
  port: 9351,
  profile: join(here, "chrome-profile-e2e-zxing"),
  width: phone ? 390 : 1280,
  height: phone ? 844 : 900,
  mobile: phone,
  extraArgs: [
    "--use-fake-ui-for-media-stream",
    "--use-fake-device-for-media-stream",
    `--use-file-for-fake-video-capture=${video}`,
  ],
});
const { evaluate, waitFor, click } = browser;
const scanner = `document.querySelector('[role="dialog"][aria-modal="true"]')`;

async function step(name, run) {
  try {
    await run();
    results.push(`PASS  ${name}`);
  } catch (err) {
    results.push(`FAIL  ${name}\n        ${String(err.message).split("\n")[0]}`);
    await browser.screenshot(join(shots, `FAIL-${results.length}.png`), false).catch(() => {});
  }
}

try {
  await browser.navigate(`${APP}/nutrition`);
  await waitFor(`document.querySelector('button[aria-label="Skeniraj barkod"]')`, "the scan button", 15000);

  await step("this Chrome has no BarcodeDetector of its own", async () => {
    expect(!(await evaluate("'BarcodeDetector' in window")), "it has one: the test would not try ZXing");
  });

  await step("ZXing reads the barcode in the camera's picture, and its product shows", async () => {
    await click(`document.querySelector('button[aria-label="Skeniraj barkod"]')`);
    await waitFor(`!!${scanner} && document.body.innerText.includes('Pronađeno') && document.body.innerText.includes('Skyr natur')`, "the read product", 20000);
    await browser.screenshot(join(shots, "read.png"), false);
  });

  await step("ZXing's .wasm came from the app itself, not from a CDN", async () => {
    const wasm = await evaluate(
      "performance.getEntriesByType('resource').map((entry) => entry.name).filter((name) => name.includes('.wasm'))",
    );
    const origin = new URL(APP).origin;
    expect(wasm.length > 0 && wasm.every((name) => name.startsWith(origin)), `wasm: ${JSON.stringify(wasm)}`);
  });

  await step("the page made no errors of its own", async () => {
    expect(browser.problems.length === 0, browser.problems.join(" || "));
  });
} finally {
  console.log(results.join("\n"));
  const failed = results.filter((line) => line.startsWith("FAIL")).length;
  console.log(`\n${results.length - failed} passed, ${failed} failed (scanner zxing${phone ? ", phone" : ""})`);
  await browser.close();
  off.close();
}
