// End-to-end run of Prehrana's quicker logging against the test backend (throwaway database):
// the last day's meals offered as cards, "Kao jučer", Nedavno and Omiljeno, one open card.
// Usage: node e2e-nutrition-quick.mjs [--phone]
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { mkdirSync } from "node:fs";
import { launch } from "./cdp.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const phone = process.argv.includes("--phone");
const shots = join(here, "shots", `e2e-nutrition-quick${phone ? "-phone" : ""}`);
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
const food = (name, kcal, protein = 1, carbs = 1, fat = 1) => ({ name, kcal, protein, carbs, fat });

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
async function seedDay(daysAgo, meals) {
  const day = await api("/api/nutrition/days", "POST", { date: dateKey(daysAgo) });
  for (const [name, items] of Object.entries(meals)) {
    const meal = await api("/api/nutrition/meals", "POST", { name, nutritionDayId: day.id });
    for (const item of items) await api(`/api/nutrition/meals/${meal.id}/items`, "POST", item);
  }
}
// Večera three days ago is not on the latest day, so it is no card, but a Večera made by hand
// gets it as "Kao zadnji put".
await seedDay(3, { Večera: [food("Tuna", 190, 42, 0, 2)] });
await seedDay(1, {
  Doručak: [food("Zobene pahuljice", 300, 10, 51, 6), food("Jaja", 210, 18, 1, 15)],
  Ručak: [food("Piletina", 330, 62, 0, 7), food("Riža", 350, 7, 77, 1)],
});
await api("/api/food-item-templates", "POST", food("Proteinski shake", 240, 48, 6, 3));

// ---------- the run ----------
const results = [];
function expect(condition, message) {
  if (!condition) throw new Error(message);
}
const browser = await launch({
  port: 9345,
  profile: join(here, "chrome-profile-e2e-nutrition-quick"),
  width: phone ? 390 : 1280,
  height: phone ? 844 : 900,
  mobile: phone,
});
const { evaluate, waitFor, click, type } = browser;
const q = (text) => JSON.stringify(text);
const meal = (name) =>
  `[...document.querySelectorAll('section')].find((s) => s.querySelector('h2')?.textContent.trim() === ${q(name)})`;
const textOf = (expression) => evaluate(`(${expression})?.innerText.replace(/\\s+/g, ' ').trim()`);
const chip = (mealName, foodName) =>
  `[...${meal(mealName)}.querySelectorAll('button')].find((b) => b.getAttribute('aria-label')?.startsWith(${q(`Dodaj ${foodName},`)}))`;
const isOpen = (mealName) => evaluate(`!!${meal(mealName)}.querySelector('input[placeholder="Pretraži ili upiši novu"]')`);

async function step(name, run) {
  try {
    await run();
    results.push(`PASS  ${name}`);
  } catch (err) {
    results.push(`FAIL  ${name}\n        ${String(err.message).split("\n")[0]}`);
    await browser.screenshot(join(shots, `FAIL-${results.length}.png`)).catch(() => {});
  }
}

try {
  await browser.navigate(`${APP}/nutrition`);

  await step("a new day offers the last day's meals as empty cards, saved nowhere", async () => {
    await waitFor(`${meal("Doručak")} && ${meal("Ručak")}`, "the offered cards", 15000);
    expect(!(await evaluate(`!!${meal("Večera")}`)), "Večera from three days ago became a card");
    const breakfast = await textOf(meal("Doručak"));
    expect(breakfast.includes("Kao jučer") && breakfast.includes("Zobene pahuljice, Jaja · 510 kcal"), `Doručak: ${breakfast}`);
    expect((await mealsOf(today)).length === 0, "a meal was saved just by showing it");
  });

  await step("only the first empty meal is open; the others have a button to open", async () => {
    expect(await isOpen("Doručak"), "Doručak is not open");
    expect(!(await isOpen("Ručak")), "Ručak is open too");
    expect(await evaluate(`!!__e2e.byText('button', 'Dodaj namirnicu', ${meal("Ručak")})`), "Ručak has no open button");
  });

  await step("Nedavno holds the meal's own foods, and a tap adds one and saves the meal", async () => {
    expect(await evaluate(`!!${chip("Doručak", "Jaja")}`), "no Jaja chip");
    expect(!(await evaluate(`!!${chip("Doručak", "Piletina")}`)), "lunch's Piletina is offered at breakfast");
    await click(chip("Doručak", "Jaja"));
    await waitFor(`${meal("Doručak")}.querySelectorAll('li').length === 1`, "the Jaja row");
    const meals = await mealsOf(today);
    expect(meals.length === 1 && meals[0].name === "Doručak" && meals[0].items[0].kcal === 210, `saved: ${JSON.stringify(meals)}`);
    expect(!(await textOf(meal("Doručak"))).includes("Kao jučer"), "Kao jučer stayed in a meal with food");
    expect(!(await evaluate(`!!${chip("Doručak", "Jaja")}`)), "Jaja is still offered in the meal that has it");
    expect(await isOpen("Doručak"), "Doručak closed after the tap");
  });

  await step("two quick taps into an unsaved meal make one meal with both foods", async () => {
    await click(`__e2e.byText('button', 'Dodaj namirnicu', ${meal("Ručak")})`);
    await waitFor(`${chip("Ručak", "Piletina")} && ${chip("Ručak", "Riža")}`, "Ručak's chips");
    expect(!(await isOpen("Doručak")), "Doručak stayed open beside Ručak");
    await evaluate(`(() => { const a = ${chip("Ručak", "Piletina")}; const b = ${chip("Ručak", "Riža")}; a.click(); b.click(); return true; })()`);
    await waitFor(`${meal("Ručak")}.querySelectorAll('li').length === 2`, "both rows");
    const lunches = (await mealsOf(today)).filter((entry) => entry.name === "Ručak");
    expect(lunches.length === 1 && lunches[0].items.length === 2, `saved: ${JSON.stringify(lunches)}`);
  });

  await step("a meal made by hand offers its last time, dated, and Kopiraj eats it again", async () => {
    await type(`document.querySelector('input[aria-label="Ime obroka"]')`, "Večera");
    await browser.press("Enter", "Enter", 13);
    await waitFor(`${meal("Večera")} && ${meal("Večera")}.innerText.includes('Kao zadnji put')`, "Večera's last time");
    const text = await textOf(meal("Večera"));
    expect(text.includes("Tuna · 190 kcal"), `Večera: ${text}`);
    await click(`__e2e.byText('button', 'Kopiraj', ${meal("Večera")})`);
    await waitFor(`${meal("Večera")}.querySelectorAll('li').length === 1`, "the copied Tuna");
    const dinner = (await mealsOf(today)).find((entry) => entry.name === "Večera");
    expect(dinner.items.length === 1 && dinner.items[0].name === "Tuna", `saved: ${JSON.stringify(dinner)}`);
  });

  await step("a favourite goes in with one tap", async () => {
    await click(chip("Večera", "Proteinski shake"));
    await waitFor(`${meal("Večera")}.querySelectorAll('li').length === 2`, "the shake row");
    const dinner = (await mealsOf(today)).find((entry) => entry.name === "Večera");
    expect(dinner.items.some((item) => item.name === "Proteinski shake" && item.protein === 48), `saved: ${JSON.stringify(dinner)}`);
  });

  await step("the name field finds recent foods and favourites; a pick fills the numbers", async () => {
    await type(`${meal("Večera")}.querySelector('input[placeholder="Pretraži ili upiši novu"]')`, "pah");
    await waitFor(`__e2e.containing('button', 'Zobene pahuljice', ${meal("Večera")}).length > 0`, "the found food");
    await click(`__e2e.containing('button', 'Zobene pahuljice', ${meal("Večera")}).find((el) => el.className.includes('_pickerOption_'))`);
    const kcal = await evaluate(`${meal("Večera")}.querySelector('form [data-field="kcal"] input').value`);
    expect(kcal === "300", `kcal box: "${kcal}"`);
    await click(`${meal("Večera")}.querySelector('button[data-action="add-food"]')`);
    await waitFor(`${meal("Večera")}.querySelectorAll('li').length === 3`, "the oats row");
  });

  await step("a new food is offered for Omiljeno, and then sits there", async () => {
    await type(`${meal("Večera")}.querySelector('input[placeholder="Pretraži ili upiši novu"]')`, "Skyr");
    await type(`${meal("Večera")}.querySelector('form [data-field="kcal"] input')`, "120");
    await click(`${meal("Večera")}.querySelector('button[data-action="add-food"]')`);
    await waitFor(`document.body.innerText.includes('Dodati "Skyr" u Omiljeno?')`, "the prompt");
    await click(`__e2e.byText('button', 'Da', ${meal("Večera")})`);
    await waitFor(`!!${chip("Večera", "Skyr")}`, "Skyr among the favourites");
    const saved = await api("/api/food-item-templates");
    expect(saved.some((entry) => entry.name === "Skyr" && entry.kcal === 120), `favourites: ${JSON.stringify(saved)}`);
  });

  await step("Uredi takes a favourite off the row, and Gotovo ends it", async () => {
    await click(`__e2e.byText('button', 'Uredi', ${meal("Večera")})`);
    await click(`${meal("Večera")}.querySelector('button[aria-label="Makni Skyr iz Omiljenog"]')`);
    await waitFor(`!${meal("Večera")}.querySelector('button[aria-label="Makni Skyr iz Omiljenog"]')`, "Skyr to go");
    const saved = await api("/api/food-item-templates");
    expect(!saved.some((entry) => entry.name === "Skyr"), "Skyr is still saved");
    expect((await mealsOf(today)).find((entry) => entry.name === "Večera").items.length === 4, "a logged food went with it");
    await click(`__e2e.byText('button', 'Gotovo', ${meal("Večera")})`);
    expect(await evaluate(`!!${chip("Večera", "Proteinski shake")}`), "the chip doesn't add again");
  });

  await step("the page made no errors of its own", async () => {
    expect(browser.problems.length === 0, browser.problems.join(" || "));
  });

  await browser.screenshot(join(shots, "end.png"));
} finally {
  console.log(results.join("\n"));
  const failed = results.filter((line) => line.startsWith("FAIL")).length;
  console.log(`\n${results.length - failed} passed, ${failed} failed (nutrition quick${phone ? ", phone" : ""})`);
  await browser.close();
}
