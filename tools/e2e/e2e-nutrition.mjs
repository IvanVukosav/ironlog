// End-to-end run of Prehrana against the test backend (throwaway database).
// Usage: node e2e-nutrition.mjs [--phone]
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { mkdirSync } from "node:fs";
import { launch, sleep } from "./cdp.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const phone = process.argv.includes("--phone");
const shots = join(here, "shots", `e2e-nutrition${phone ? "-phone" : ""}`);
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
const yesterday = dateKey(1);

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

// ---------- data ----------
// Two weeks back: Prehrana offers the meals of the days before the one shown.
for (let daysAgo = 0; daysAgo <= 15; daysAgo++) {
  const existing = await dayOf(dateKey(daysAgo));
  for (const meal of existing?.meals ?? []) await api(`/api/nutrition/meals/${meal.id}`, "DELETE");
}
for (const template of await api("/api/food-item-templates")) {
  await api(`/api/food-item-templates/${template.id}`, "DELETE");
}
await api("/api/settings", "PUT", {
  language: "hr",
  theme: "auto",
  template: "moderna",
  kcalGoal: 2500,
  proteinGoal: 180,
  carbsGoal: 280,
  fatGoal: 80,
});
const previous = await api("/api/nutrition/days", "POST", { date: yesterday });
const breakfast = await api("/api/nutrition/meals", "POST", { name: "Doručak", nutritionDayId: previous.id });
await api(`/api/nutrition/meals/${breakfast.id}/items`, "POST", {
  name: "Zobene",
  kcal: 380,
  protein: 14,
  carbs: 62,
  fat: 8,
});

// ---------- the run ----------
const results = [];
function expect(condition, message) {
  if (!condition) throw new Error(message);
}
const browser = await launch({
  port: 9341,
  profile: join(here, "chrome-profile-e2e-nutrition"),
  width: phone ? 390 : 1280,
  height: phone ? 844 : 900,
  mobile: phone,
});
const { evaluate, waitFor, click, type } = browser;
const q = (text) => JSON.stringify(text);
const meal = (name) =>
  `[...document.querySelectorAll('section')].find((s) => s.querySelector('h2')?.textContent.trim() === ${q(name)})`;
const field = (scope, key) => `${scope}.querySelector('form:last-of-type [data-field="${key}"] input')`;
const textOf = (expression) => evaluate(`(${expression})?.innerText.replace(/\\s+/g, ' ').trim()`);
const summary = () => textOf(`document.querySelector('[class*="_summary_"]')`);

async function step(name, run) {
  try {
    await run();
    results.push(`PASS  ${name}`);
  } catch (err) {
    results.push(`FAIL  ${name}\n        ${String(err.message).split("\n")[0]}`);
    await browser.screenshot(join(shots, `FAIL-${results.length}.png`)).catch(() => {});
  }
}

async function closeToasts() {
  for (;;) {
    const open = await evaluate(`!!document.querySelector('[class*="_toast"] [class*="_closeButton_"]')`);
    if (!open) return;
    await click(`document.querySelector('[class*="_toast"] [class*="_closeButton_"]')`);
  }
}

try {
  await browser.navigate(`${APP}/nutrition`);

  await step("a new day offers yesterday's meal to fill, with nothing saved, against the goals", async () => {
    await waitFor(`${meal("Doručak")} && ${meal("Doručak")}.innerText.includes('Kao jučer')`, "the offered Doručak", 15000);
    expect(!(await evaluate(`document.body.innerText.includes('Za ovaj dan još nema unosa.')`)), "the empty text shows beside a meal");
    const text = await summary();
    expect(text.includes("0 / 2.500 kcal") && text.includes("0 / 180 g"), `summary: ${text}`);
    expect((await dayOf(today)) === null || (await mealsOf(today)).length === 0, "something is logged already");
  });

  await step("a meal can be added straight away, and the day is made for it", async () => {
    await type(`document.querySelector('input[aria-label="Ime obroka"]')`, "Ručak");
    await browser.press("Enter", "Enter", 13);
    await waitFor(meal("Ručak"), "the Ručak card");
    const meals = await mealsOf(today);
    expect(meals.length === 1 && meals[0].name === "Ručak", `saved meals: ${JSON.stringify(meals)}`);
    const value = await evaluate(`document.querySelector('input[aria-label="Ime obroka"]').value`);
    expect(value === "", `the meal box still says "${value}"`);
  });

  await step("a food needs a name and kcal; empty grams are saved as 0, a comma as a point", async () => {
    const button = `${meal("Ručak")}.querySelector('button[data-action="add-food"]')`;
    expect(!(await evaluate(`!!${field(meal("Ručak"), "kcal")}`)), "the numbers show before a name");
    await type(field(meal("Ručak"), "name"), "Piletina");
    expect(await evaluate(`${button}.disabled`), "the button is enabled without kcal");
    await type(field(meal("Ručak"), "kcal"), "450");
    await type(field(meal("Ručak"), "protein"), "40,5");
    await click(button);
    await waitFor(`${meal("Ručak")}.querySelectorAll('li').length === 1`, "the food row");
    const row = await textOf(`${meal("Ručak")}.querySelector('li')`);
    expect(row.includes("Piletina") && row.includes("450 kcal · B 40,5 · UH 0 · M 0"), `row: ${row}`);
    const item = (await mealsOf(today))[0].items[0];
    expect(item.protein === 40.5 && item.carbs === 0 && item.fat === 0, `saved: ${JSON.stringify(item)}`);
    const nameLeft = await evaluate(`${field(meal("Ručak"), "name")}.value`);
    expect(nameLeft === "", `the name box still says "${nameLeft}"`);
  });

  await step("the meal and the day add up the food", async () => {
    const header = await textOf(`${meal("Ručak")}.querySelector('h2').parentElement`);
    expect(header.includes("450 kcal"), `meal header: ${header}`);
    const text = await summary();
    expect(text.includes("450 / 2.500 kcal") && text.includes("40,5 / 180 g"), `summary: ${text}`);
  });

  await step("a new food can be kept for next time", async () => {
    await waitFor(`document.body.innerText.includes('Dodati "Piletina" u Omiljeno?')`, "the save prompt");
    await click(`__e2e.byText('button', 'Da', ${meal("Ručak")})`);
    await waitFor(`fetch('${API}/api/food-item-templates').then((r) => r.json()).then((t) => t.some((f) => f.name === 'Piletina' && f.protein === 40.5))`, "the saved food");
    expect(!(await evaluate(`document.body.innerText.includes('u Omiljeno?')`)), "the prompt stayed");
  });

  await step("a food is edited in place", async () => {
    await click(`${meal("Ručak")}.querySelector('li [class*="_itemText_"]')`);
    await waitFor(`${meal("Ručak")}.querySelector('li form')`, "the edit form");
    const protein = await evaluate(`${meal("Ručak")}.querySelector('li form [data-field="protein"] input').value`);
    expect(protein === "40,5", `the protein field opened with "${protein}"`);
    await type(`${meal("Ručak")}.querySelector('li form [data-field="kcal"] input')`, "500");
    await click(`__e2e.byText('button', 'Spremi', ${meal("Ručak")})`);
    await waitFor(`!${meal("Ručak")}.querySelector('li form')`, "the edit form to close");
    const row = await textOf(`${meal("Ručak")}.querySelector('li')`);
    expect(row.includes("500 kcal"), `row: ${row}`);
    const saved = (await mealsOf(today))[0].items[0];
    expect(saved.kcal === 500 && saved.protein === 40.5, `saved: ${JSON.stringify(saved)}`);
  });

  await step("there is no field for a food by name above the meals any more", async () => {
    expect(!(await evaluate(`!!document.querySelector('input[placeholder="Dodaj namirnicu po nazivu"]')`)), "the field is still there");
  });

  await step("a saved food goes into a meal made by hand with one tap", async () => {
    await type(`document.querySelector('input[aria-label="Ime obroka"]')`, "Užina");
    await browser.press("Enter", "Enter", 13);
    await waitFor(meal("Užina"), "the Užina card");
    await click(`__e2e.byText('button', 'Dodaj namirnicu', ${meal("Užina")})`);
    await click(`${meal("Užina")}.querySelector('button[aria-label="Dodaj Piletina, 450 kcal"]')`);
    await waitFor(`${meal("Užina")}.querySelectorAll('li').length === 1`, "the Piletina row");
    const snack = (await mealsOf(today)).find((entry) => entry.name === "Užina");
    expect(snack && snack.items.length === 1 && snack.items[0].kcal === 450, `Užina: ${JSON.stringify(snack)}`);
  });

  await step("a food is deleted", async () => {
    await click(`${meal("Užina")}.querySelector('button[aria-label="Obriši namirnicu"]')`);
    await waitFor(`${meal("Užina")}.querySelectorAll('li').length === 0`, "the row to go");
    const snack = (await mealsOf(today)).find((entry) => entry.name === "Užina");
    expect(snack.items.length === 0, "the food is still saved");
  });

  await step("a meal is deleted from its menu, after a confirmation", async () => {
    const asked = browser.dialogs.length;
    await closeToasts();
    await click(`${meal("Užina")}.querySelector('button[aria-label="Opcije za Užina"]')`);
    await click(`__e2e.byText('button', 'Obriši obrok', ${meal("Užina")})`);
    await waitFor(`!${meal("Užina")}`, "the card to go");
    expect(browser.dialogs.length === asked + 1, "no confirmation was asked");
    expect(!(await mealsOf(today)).some((entry) => entry.name === "Užina"), "the meal is still saved");
  });

  await step("the previous day is copied in", async () => {
    await click(`__e2e.byText('button', 'Kopiraj prethodni dan')`);
    // The Doručak card is there before (offered from yesterday, empty): wait for its food.
    await waitFor(`${meal("Doručak")}?.querySelectorAll('li').length === 1`, "the copied Doručak");
    const names = (await mealsOf(today)).map((entry) => entry.name).sort();
    expect(names.join() === "Doručak,Ručak", `meals: ${names}`);
    const text = await summary();
    expect(text.includes("880 / 2.500 kcal"), `summary: ${text}`);
  });

  await step("another day shows its own food, from the calendar", async () => {
    await click(`document.querySelector('[class*="_triggerText_"]')`);
    const monthChanged = yesterday.slice(5, 7) !== today.slice(5, 7);
    if (monthChanged) await click(`__e2e.byText('button', '‹')`);
    await click(`[...document.querySelectorAll('[class*="_dayCell"]')].find((cell) => cell.textContent.trim() === '${Number(yesterday.slice(8))}')`);
    await waitFor(`!${meal("Ručak")} && ${meal("Doručak")}`, "yesterday's meals");
    const text = await summary();
    expect(text.includes("380 / 2.500 kcal"), `summary: ${text}`);
  });

  await step("a link with a date opens that day, and the back button the day before it", async () => {
    await browser.navigate(`${APP}/nutrition?date=${yesterday}`);
    await waitFor(`!${meal("Ručak")} && ${meal("Doručak")}`, "yesterday's meals", 15000);
    await browser.navigate(`${APP}/nutrition?date=${today}`);
    await waitFor(`${meal("Ručak")} && ${meal("Doručak")}`, "today's meals", 15000);
  });

  await step("the page made no errors of its own", async () => {
    expect(browser.problems.length === 0, browser.problems.join(" || "));
  });

  await browser.screenshot(join(shots, "end.png"));
} finally {
  console.log(results.join("\n"));
  const failed = results.filter((line) => line.startsWith("FAIL")).length;
  console.log(`\n${results.length - failed} passed, ${failed} failed (nutrition${phone ? ", phone" : ""})`);
  await browser.close();
}
