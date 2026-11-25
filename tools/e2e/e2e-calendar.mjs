// End-to-end run of Kalendar against the test backend (throwaway database).
// Usage: node e2e-calendar.mjs [--phone]
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { mkdirSync } from "node:fs";
import { launch } from "./cdp.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const phone = process.argv.includes("--phone");
const shots = join(here, "shots", `e2e-calendar${phone ? "-phone" : ""}`);
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
// The checks below need their days in this month.
if (now.getDate() < 6) throw new Error("run this after the 5th of the month");
const yesterday = dateKey(1);
const measuredDay = dateKey(5);
const monthQuery = `year=${now.getFullYear()}&month=${now.getMonth() + 1}`;

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
const keyOf = (entry) => new Date(entry.date).toISOString().slice(0, 10);
const weightOn = async (key) => (await api(`/api/bodyweight?${monthQuery}`)).find((entry) => keyOf(entry) === key);
const measurementsOn = async (key) =>
  (await api(`/api/body-measurements?${monthQuery}`)).find((entry) => keyOf(entry) === key);

// ---------- data ----------
for (const workout of await api("/api/workouts?limit=1000")) await api(`/api/workouts/${workout.id}`, "DELETE");
for (const entry of await api(`/api/bodyweight?${monthQuery}`)) await api(`/api/bodyweight/${entry.id}`, "DELETE");
for (const entry of await api(`/api/body-measurements?${monthQuery}`)) {
  await api(`/api/body-measurements/${entry.id}`, "DELETE");
}
await api("/api/settings", "PUT", { language: "hr", theme: "auto", template: "moderna" });
await api("/api/workouts", "POST", { date: yesterday, name: "Push dan" });
await api("/api/body-measurements", "POST", { date: measuredDay, waist: 85, chest: 100 });

// ---------- the run ----------
const results = [];
function expect(condition, message) {
  if (!condition) throw new Error(message);
}
const browser = await launch({
  port: 9343,
  profile: join(here, "chrome-profile-e2e-calendar"),
  width: phone ? 390 : 1280,
  height: phone ? 844 : 900,
  mobile: phone,
});
const { evaluate, waitFor, click, type } = browser;
const dayButton = (key) =>
  `[...document.querySelectorAll('[class*="_grid_"] button')].find((b) => b.querySelector('[class*="_dayNumber_"]').textContent === '${Number(key.slice(8))}')`;
const row = (title) =>
  `[...document.querySelectorAll('[class*="_dayPanel_"] li')].find((li) => li.querySelector('[class*="_rowTitle_"]').textContent === ${JSON.stringify(title)})`;
const textOf = (expression) => evaluate(`(${expression})?.innerText.replace(/\\s+/g, ' ').trim()`);

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
  await browser.navigate(`${APP}/calendar`);
  // The grid is drawn before the month's entries arrive: wait for them.
  await waitFor(`${dayButton(yesterday)}?.getAttribute('aria-label').includes('Push dan')`, "the month's entries", 10000);

  await step("today is selected and marked, and the panel names it", async () => {
    const state = await evaluate(`[${dayButton(today)}.getAttribute('aria-pressed'), ${dayButton(today)}.getAttribute('aria-current')]`);
    expect(state.join() === "true,date", `today: ${state}`);
    const expected = new Intl.DateTimeFormat("hr", { weekday: "long", day: "numeric", month: "long" }).format(now);
    const title = await textOf(`document.querySelector('[class*="_dayTitle_"]')`);
    expect(title.toLowerCase() === expected.toLowerCase(), `panel: "${title}"`);
  });

  await step("the weeks start on Monday", async () => {
    const letters = await evaluate(`[...document.querySelectorAll('[class*="_weekdays_"] span')].map((s) => s.textContent).join('')`);
    expect(letters === "pusčpsn", `weekday letters: ${letters}`);
  });

  await step("a day with a workout says so, and its panel links to the log", async () => {
    const label = await evaluate(`${dayButton(yesterday)}.getAttribute('aria-label')`);
    expect(label.includes("Trening: Push dan"), `label: ${label}`);
    await click(dayButton(yesterday));
    await waitFor(`${row("Trening")}.innerText.includes('Push dan')`, "the workout row");
    const href = await evaluate(`${row("Trening")}.querySelector('a').getAttribute('href')`);
    expect(href === `/log?date=${yesterday}`, `link: ${href}`);
  });

  await step("bodyweight is logged with a decimal comma", async () => {
    await click(dayButton(today));
    await waitFor(`${row("Tjelesna težina")}.innerText.includes('Nije upisana')`, "no weight yet");
    await click(`__e2e.byText('button', 'Upiši', ${row("Tjelesna težina")})`);
    await type(`${row("Tjelesna težina")}.querySelector('input')`, "90,6");
    await browser.press("Enter", "Enter", 13);
    await waitFor(`${row("Tjelesna težina")}.innerText.includes('90,6 kg') && !${row("Tjelesna težina")}.querySelector('input')`, "the saved weight");
    expect((await weightOn(today))?.weight === 90.6, "the weight was not saved as 90.6");
    const label = await evaluate(`${dayButton(today)}.getAttribute('aria-label')`);
    expect(label.includes("90,6 kg"), `day label: ${label}`);
  });

  await step("bodyweight is changed, and Escape leaves an edit unsaved", async () => {
    await click(`__e2e.byText('button', 'Uredi', ${row("Tjelesna težina")})`);
    const shown = await evaluate(`${row("Tjelesna težina")}.querySelector('input').value`);
    expect(shown === "90,6", `the field opened with "${shown}"`);
    await type(`${row("Tjelesna težina")}.querySelector('input')`, "88");
    await browser.press("Escape", "Escape", 27);
    await waitFor(`!${row("Tjelesna težina")}.querySelector('input')`, "the edit to close");
    expect((await weightOn(today))?.weight === 90.6, "Escape saved the change");
    await click(`__e2e.byText('button', 'Uredi', ${row("Tjelesna težina")})`);
    await type(`${row("Tjelesna težina")}.querySelector('input')`, "90,4");
    await click(`__e2e.byText('button', 'Spremi', ${row("Tjelesna težina")})`);
    await waitFor(`${row("Tjelesna težina")}.innerText.includes('90,4 kg')`, "the changed weight");
    expect((await weightOn(today))?.weight === 90.4, "the change was not saved");
  });

  await step("bodyweight is deleted", async () => {
    await click(`__e2e.byText('button', 'Uredi', ${row("Tjelesna težina")})`);
    await click(`__e2e.byText('button', 'Obriši', ${row("Tjelesna težina")})`);
    await waitFor(`${row("Tjelesna težina")}.innerText.includes('Nije upisana')`, "no weight again");
    expect(!(await weightOn(today)), "the weight is still saved");
  });

  await step("measurements show what was taken and take more, with a comma", async () => {
    await click(dayButton(measuredDay));
    const text = await textOf(row("Mjere tijela"));
    expect(text.includes("Struk 85 cm · Prsa 100 cm"), `row: ${text}`);
    await click(`__e2e.byText('button', 'Uredi', ${row("Mjere tijela")})`);
    const shown = await evaluate(`[...${row("Mjere tijela")}.querySelectorAll('input')].map((input) => input.value).join('|')`);
    expect(shown === "85|100|||", `the fields opened with "${shown}"`);
    await type(`[...${row("Mjere tijela")}.querySelectorAll('label')].find((l) => l.textContent.startsWith('Ruke')).nextElementSibling`, "38,5");
    await click(`__e2e.byText('button', 'Spremi', ${row("Mjere tijela")})`);
    await waitFor(`${row("Mjere tijela")}.innerText.includes('Ruke 38,5 cm')`, "the new measurement");
    const saved = await measurementsOn(measuredDay);
    expect(saved?.arms === 38.5 && saved.waist === 85, `saved: ${JSON.stringify(saved)}`);
  });

  await step("months step back and forth, and Today comes home", async () => {
    const months = ["Siječanj", "Veljača", "Ožujak", "Travanj", "Svibanj", "Lipanj", "Srpanj", "Kolovoz", "Rujan", "Listopad", "Studeni", "Prosinac"];
    const previous = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    await click(`document.querySelector('button[aria-label="Prethodni mjesec"]')`);
    const heading = await textOf(`document.querySelector('[class*="_monthHeading_"]')`);
    expect(heading === `${months[previous.getMonth()]} ${previous.getFullYear()}`, `heading: ${heading}`);
    const empty = await textOf(row("Trening"));
    expect(empty === "Trening Bez treninga Upiši", `an empty day's workout row: ${empty}`);
    await click(`__e2e.byText('button', 'Danas')`);
    await waitFor(`${dayButton(today)} && ${dayButton(today)}.getAttribute('aria-pressed') === 'true'`, "today again");
    expect(!(await evaluate(`!!__e2e.byText('button', 'Danas')`)), "Today is offered in today's month");
  });

  await step("the page made no errors of its own", async () => {
    expect(browser.problems.length === 0, browser.problems.join(" || "));
  });

  await browser.screenshot(join(shots, "end.png"));
} finally {
  console.log(results.join("\n"));
  const failed = results.filter((line) => line.startsWith("FAIL")).length;
  console.log(`\n${results.length - failed} passed, ${failed} failed (calendar${phone ? ", phone" : ""})`);
  await browser.close();
}
