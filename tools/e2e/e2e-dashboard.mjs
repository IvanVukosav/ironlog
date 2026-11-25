// End-to-end run of the Dashboard (Početna) against the test backend (throwaway database).
// Usage: node e2e-dashboard.mjs [--phone]
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { mkdirSync } from "node:fs";
import { launch, sleep } from "./cdp.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const phone = process.argv.includes("--phone");
const shots = join(here, "shots", `e2e-dashboard${phone ? "-phone" : ""}`);
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
const workoutOf = async (key) => (await api(`/api/workouts?date=${key}`))[0] ?? null;

async function addWorkout(daysAgo, name, exercises) {
  const workout = await api("/api/workouts", "POST", { date: dateKey(daysAgo), name });
  for (const [exerciseName, sets] of exercises) {
    const exercise = await api(`/api/workouts/${workout.id}/exercises`, "POST", { name: exerciseName });
    for (const set of sets) await api(`/api/workouts/exercises/${exercise.id}/sets`, "POST", set);
  }
  return workout;
}

// ---------- data ----------
for (const workout of await api("/api/workouts?limit=1000")) {
  await api(`/api/workouts/${workout.id}`, "DELETE");
}
// Without a program: with one, the card offers its next day instead of a plain start.
for (const program of await api("/api/programs")) await api(`/api/programs/${program.id}`, "DELETE");
await api("/api/settings", "PUT", {
  language: "hr",
  theme: "auto",
  template: "moderna",
  trainingsPerWeek: 4,
  kcalGoal: 2500,
  showWorkoutWidget: true,
  showNutritionWidget: true,
  showPrWidget: true,
  e1rmFormula: "brzycki",
});
await addWorkout(1, "Push dan", [["Bench press", [{ weight: 100, reps: 5, rpe: 8 }]]]);
await addWorkout(3, "Noge", [["Čučanj", [{ weight: 140, reps: 5, rpe: 8 }]]]);
for (let daysAgo = 0; daysAgo < 10; daysAgo++) {
  await api("/api/bodyweight", "POST", { date: dateKey(daysAgo), weight: 90 + daysAgo * 0.1 });
}
const day = await api("/api/nutrition/days", "POST", { date: today });
for (const meal of day.meals) await api(`/api/nutrition/meals/${meal.id}`, "DELETE");
const meal = await api("/api/nutrition/meals", "POST", { name: "Ručak", nutritionDayId: day.id });
await api(`/api/nutrition/meals/${meal.id}/items`, "POST", {
  name: "Piletina i riža",
  kcal: 1410,
  protein: 98,
  carbs: 144,
  fat: 46,
});

// ---------- the run ----------
const results = [];
function expect(condition, message) {
  if (!condition) throw new Error(message);
}
const browser = await launch({
  port: 9339,
  profile: join(here, "chrome-profile-e2e-dashboard"),
  width: phone ? 390 : 1280,
  height: phone ? 844 : 900,
  mobile: phone,
});
const { evaluate, waitFor, click } = browser;
const card = (title) =>
  `[...document.querySelectorAll('section')].find((s) => s.querySelector('h2')?.textContent.trim() === ${JSON.stringify(title)})`;
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
  await browser.navigate(`${APP}/`);
  await waitFor(`${card("Ovaj tjedan")}`, "the week card", 10000);

  // The user had the date taken off (2026-11-17): the header is the page's name alone.
  await step("the header is the page's name, without today's date", async () => {
    const shown = await textOf(`document.querySelector('h1').closest('header')`);
    expect(shown.trim() === "Početna", `header: "${shown}"`);
  });

  await step("without a workout today, the card offers to start one", async () => {
    await waitFor(`__e2e.byText('button', 'Započni trening')`, "the start button");
    const text = await textOf(card("Trening danas"));
    expect(text.includes("Danas još nema treninga."), `card: ${text}`);
  });

  await step("the week strip marks trained days, today, and links each day to its log", async () => {
    const days = await evaluate(`[...${card("Ovaj tjedan")}.querySelectorAll('ol a')].map((a) => ({
      href: a.getAttribute('href'),
      label: a.getAttribute('aria-label'),
      current: a.getAttribute('aria-current'),
      trained: a.querySelector('[class*="_dayDotTrained_"]') !== null,
    }))`);
    expect(days.length === 7, `${days.length} days`);
    const todayEntry = days.find((entry) => entry.href === `/log?date=${today}`);
    expect(todayEntry && todayEntry.current === "date", "today is not marked");
    const yesterday = days.find((entry) => entry.href === `/log?date=${dateKey(1)}`);
    if (yesterday) {
      expect(yesterday.trained && yesterday.label.endsWith("Push dan"), `yesterday: ${JSON.stringify(yesterday)}`);
    }
    expect(days.filter((entry) => entry.trained).every((entry) => !entry.label.endsWith("bez treninga")), "a trained day says no workout");
  });

  await step("the streak counts days in a row, in Croatian plural forms", async () => {
    const text = await textOf(`${card("Ovaj tjedan")}.querySelector('[class*="_streak_"]')`);
    expect(text === "1 dan zaredom · najduži 1", `streak: "${text}"`);
  });

  await step("today's food against the goal, with the macro split", async () => {
    const text = await textOf(card("Prehrana danas"));
    expect(text.includes("1.410 / 2.500 kcal"), `card: ${text}`);
    expect(text.includes("Bjelančevine"), `no macro legend: ${text}`);
  });

  await step("the latest record links to its exercise on Statistika", async () => {
    const href = await evaluate(`${card("Zadnji rekord")}.querySelector('h2 a').getAttribute('href')`);
    expect(href === "/stats?exercise=Bench%20press", `link: ${href}`);
    const text = await textOf(card("Zadnji rekord"));
    expect(text.includes("100 kg × 5 @ 8") && text.includes("120,0 kg") && text.includes("jučer"), `card: ${text}`);
  });

  await step("bodyweight shows the trend and switches its range", async () => {
    const text = await textOf(card("Tjelesna težina"));
    expect(/\d+,\d kg/.test(text), `no trend: ${text}`);
    await click(`__e2e.byText('button', 'Mjesec', ${card("Tjelesna težina")})`);
    await waitFor(`__e2e.byText('button', 'Mjesec', ${card("Tjelesna težina")}).getAttribute('aria-pressed') === 'true'`, "Month pressed");
  });

  await step("recent workouts link to their days, newest first", async () => {
    const rows = await evaluate(`[...${card("Zadnji treninzi")}.querySelectorAll('a')].map((a) => [a.getAttribute('href'), a.innerText.replace(/\\s+/g, ' ').trim()])`);
    expect(rows.length === 2, `rows: ${rows.length}`);
    expect(rows[0][0] === `/log?date=${dateKey(1)}` && rows[0][1].includes("Push dan") && rows[0][1].includes("jučer") && rows[0][1].includes("1 vježba"), `first: ${rows[0]}`);
  });

  await step("Start workout makes today's workout and opens it", async () => {
    await click(`__e2e.byText('button', 'Započni trening')`);
    await waitFor(`location.pathname === '/log' && location.search === '?date=${today}'`, "the log page");
    await waitFor(`document.querySelector('input[aria-label="Naziv treninga"]')`, "the workout");
    const saved = await api(`/api/workouts?date=${today}`);
    expect(saved.length === 1, `${saved.length} workouts today`);
  });

  await step("with a workout today, the card lists it and offers to continue", async () => {
    const workout = await workoutOf(today);
    const exercise = await api(`/api/workouts/${workout.id}/exercises`, "POST", { name: "Čučanj" });
    await api(`/api/workouts/exercises/${exercise.id}/sets`, "POST", { weight: 60, reps: 5, rpe: null, isWarmup: true });
    await api(`/api/workouts/exercises/${exercise.id}/sets`, "POST", { weight: 110, reps: 5, rpe: 8 });
    await browser.navigate(`${APP}/`);
    await waitFor(`__e2e.byText('a', 'Nastavi trening')`, "the continue link");
    const text = await textOf(card("Trening danas"));
    expect(text.includes("1 vježba · 1 set · 550 kg"), `meta: ${text}`);
    expect(text.includes("Čučanj") && text.includes("1 set · 110 kg × 5 @ 8"), `row: ${text}`);
    const streak = await textOf(`${card("Ovaj tjedan")}.querySelector('[class*="_streak_"]')`);
    expect(streak === "2 dana zaredom · najduži 2", `streak: "${streak}"`);
  });

  await step("the card titles lead to their pages", async () => {
    await click(`${card("Prehrana danas")}.querySelector('h2 a')`);
    await waitFor(`location.pathname === '/nutrition' && location.search === '?date=${today}'`, "the nutrition page");
  });

  await step("the page made no errors of its own", async () => {
    expect(browser.problems.length === 0, browser.problems.join(" || "));
  });
} finally {
  console.log(results.join("\n"));
  const failed = results.filter((line) => line.startsWith("FAIL")).length;
  console.log(`\n${results.length - failed} passed, ${failed} failed (dashboard${phone ? ", phone" : ""})`);
  await browser.close();
}
