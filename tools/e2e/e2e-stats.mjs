// End-to-end run of the Stats page against the test backend (throwaway database).
// Usage: node e2e-stats.mjs [--phone]
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { mkdirSync } from "node:fs";
import { launch, sleep } from "./cdp.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const phone = process.argv.includes("--phone");
const shots = join(here, "shots", `e2e-stats${phone ? "-phone" : ""}`);
mkdirSync(shots, { recursive: true });
const APP = process.env.E2E_APP ?? "http://localhost:5199";
const API = "http://localhost:3002";

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

const results = [];
function expect(condition, message) {
  if (!condition) throw new Error(message);
}

// ---------- data: a clean slate, then four sessions over 40 days ----------
for (const workout of await api("/api/workouts?limit=1000")) {
  await api(`/api/workouts/${workout.id}`, "DELETE");
}
// The exercise list gives each exercise its muscle group; another run can leave it empty or
// different, so this run sets the two it counts on.
for (const [name, muscleGroup] of [
  ["Čučanj", "Kvadriceps"],
  ["Bench press", "Prsa"],
]) {
  for (const template of (await api("/api/exercise-templates")).filter((item) => item.name === name)) {
    await api(`/api/exercise-templates/${template.id}`, "DELETE");
  }
  await api("/api/exercise-templates", "POST", { name, muscleGroup });
}
await api("/api/settings", "PUT", {
  featuredExercises: "[]",
  language: "hr",
  theme: "auto",
  template: "moderna",
  e1rmFormula: "brzycki",
});
const set = (weight, reps, rpe, isWarmup = false) => ({ weight, reps, rpe, isWarmup });
const sessions = [
  { daysAgo: 40, squat: [set(100, 5, 8)], bench: [set(80, 5, 8)] },
  { daysAgo: 20, squat: [set(105, 5, 8)], bench: [set(82.5, 5, 8)] },
  { daysAgo: 10, squat: [set(104, 5, 8)], bench: [] },
  // Today, so "this week" holds it whatever weekday the run is on.
  { daysAgo: 0, squat: [set(60, 5, null, true), set(110, 5, 8)], bench: [set(85, 5, 8)] },
];
for (const session of sessions) {
  const workout = await api("/api/workouts", "POST", { date: dateKey(session.daysAgo) });
  for (const [name, sets] of [
    ["Čučanj", session.squat],
    ["Bench press", session.bench],
  ]) {
    if (sets.length === 0) continue;
    const exercise = await api(`/api/workouts/${workout.id}/exercises`, "POST", { name });
    for (const values of sets) await api(`/api/workouts/exercises/${exercise.id}/sets`, "POST", values);
  }
}

// ---------- the run ----------
const browser = await launch({
  port: 9338,
  profile: join(here, "chrome-profile-e2e-stats"),
  // Real screen heights: in a taller window the page could not scroll a section to the top.
  width: phone ? 390 : 1280,
  height: phone ? 844 : 900,
  mobile: phone,
});
const section = (heading) =>
  `[...document.querySelectorAll('section')].find((s) => s.querySelector('h2')?.textContent === ${JSON.stringify(heading)})`;
const { evaluate, waitFor, click } = browser;
const q = (text) => JSON.stringify(text);
const tiles = () =>
  evaluate(`[...document.querySelectorAll('[class*="_tileValue_"]')].slice(0, 3).map((el) => el.textContent)`);

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
  await browser.navigate(`${APP}/stats`);

  await step("the tiles count the last 30 days: days, working-set volume, records", async () => {
    await waitFor(`document.querySelectorAll('[class*="_tileValue_"]').length >= 3`, "the tiles", 10000);
    await waitFor(`document.querySelector('[class*="_tileValue_"]').textContent === '3'`, "3 workouts");
    // 525 + 520 + 550 squat, 412.5 + 425 bench; the 60 kg warm-up does not count.
    expect((await tiles()).join(" | ") === "3 | 2,4 t | 4", `tiles: ${(await tiles()).join(" | ")}`);
  });

  await step("90 days takes in the first session too, which only sets the bar", async () => {
    await click(`__e2e.byText('button', '90 d')`);
    await waitFor(`document.querySelector('[class*="_tileValue_"]').textContent === '4'`, "4 workouts");
    expect((await tiles()).join(" | ") === "4 | 3,3 t | 4", `tiles: ${(await tiles()).join(" | ")}`);
    const pressed = await evaluate(`__e2e.byText('button', '90 d').getAttribute('aria-pressed')`);
    expect(pressed === "true", "the 90 d button is not marked as pressed");
    await click(`__e2e.byText('button', '30 d')`);
  });

  await step("the records list shows the newest first, with today/yesterday or the date", async () => {
    const rows = await evaluate(
      `[...document.querySelectorAll('[class*="_main_"]')].map((el) => el.parentElement.innerText.replace(/\\s+/g, ' '))`,
    );
    expect(rows.length === 4, `records: ${rows.length}`);
    expect(rows[0].includes("110 kg × 5 @ 8") && rows[0].includes("Čučanj"), `first: ${rows[0]}`);
    expect(!rows.some((row) => row.includes("104 kg")), "a session below the best is listed");
  });

  await step("a featured exercise shows its gain over the period and its best e1RM", async () => {
    const text = await evaluate(
      `__e2e.containing('button', 'Čučanj').find((el) => el.className.includes('_row_')).innerText.replace(/\\s+/g, ' ')`,
    );
    // Best 110×5 @8 (Brzycki, 7 reps to failure) = 132,0; before the period, 100×5 @8 = 120,0.
    expect(text.includes("+12,0 kg · 30 dana") && text.includes("132,0 kg"), `row: ${text}`);
  });

  await step("a click on a featured exercise picks it for the progress chart", async () => {
    await click(`__e2e.containing('button', 'Bench press').find((el) => el.className.includes('_row_'))`);
    await waitFor(`document.querySelector('select[aria-label="Vježba"]').value === 'Bench press'`, "Bench press in the chart");
    await waitFor(
      `${section("Napredak")}.querySelectorAll('svg circle').length === 3`,
      "the chart's three points",
    );
  });

  await step("Edit leads to the table where exercises are starred", async () => {
    await evaluate("window.scrollTo(0, 0)");
    await click(`__e2e.byText('button', 'Uredi')`);
    // The table is near the end of the page, so it comes as far up as the page lets it.
    const onScreen = `(() => {
        const box = ${section("Sve vježbe")}.querySelector('h2').getBoundingClientRect();
        return scrollY > 0 && box.top >= 0 && box.bottom <= innerHeight;
      })()`;
    try {
      await waitFor(onScreen, "the table's heading on screen");
    } catch (err) {
      // Where the page stopped, to tell a missed click (scrollY 0) from a scroll cut short.
      const where = await evaluate(
        `JSON.stringify({ scrollY, height: document.documentElement.scrollHeight, inner: innerHeight, heading: Math.round(${section("Sve vježbe")}.querySelector('h2').getBoundingClientRect().top), uredi: Math.round(__e2e.byText('button', 'Uredi').getBoundingClientRect().top) })`,
      );
      throw new Error(`${err.message}; ${where}`);
    }
  });

  await step("a star saves the exercise as featured, and the automatic pick gives way", async () => {
    await click(`__e2e.containing('tr', 'Bench press')[0].querySelector('button[aria-pressed]')`);
    await waitFor(`fetch('${API}/api/settings').then((r) => r.json()).then((s) => s.featuredExercises === '["Bench press"]')`, "the saved star");
    await waitFor(
      `[...${section("Istaknute vježbe")}.querySelectorAll('[class*="_name_"]')].map((el) => el.textContent).join() === 'Bench press'`,
      "only Bench press featured",
    );
    expect(!(await evaluate(`document.body.innerText.includes('Odabrano prema tome')`)), "the automatic hint is still shown");
    const pressed = await evaluate(`__e2e.containing('tr', 'Bench press')[0].querySelector('button[aria-pressed]').getAttribute('aria-pressed')`);
    expect(pressed === "true", "the star is not marked as pressed");
  });

  await step("the menu shows the exercise by date, one row per session", async () => {
    await click(`document.querySelector('button[aria-label="Opcije za Čučanj"]')`);
    await click(`__e2e.byText('button', 'Prikaži po datumima')`);
    await waitFor(`document.querySelectorAll('[class*="_historyEntryRow_"]').length === 4`, "four sessions");
    const first = await evaluate(`document.querySelector('[class*="_historyEntryRow_"]').innerText.replace(/\\s+/g, ' ')`);
    expect(first.includes("100 kg × 5"), `first session: ${first}`);
  });

  await step("taking the star off brings the automatic pick back", async () => {
    await click(`__e2e.containing('tr', 'Bench press')[0].querySelector('button[aria-pressed]')`);
    await waitFor(`fetch('${API}/api/settings').then((r) => r.json()).then((s) => s.featuredExercises === '[]')`, "the cleared star");
    await waitFor(`document.body.innerText.includes('Odabrano prema tome')`, "the automatic hint");
  });

  await step("muscle-group volume counts working sets only, like the weekly bars", async () => {
    const weekly = await evaluate(`document.querySelector('[class*="_current_"]').textContent`);
    expect(weekly === "ovaj tjedan 975 kg", `weekly: ${weekly}`);
    const groups = await evaluate(
      `[...${section("Volumen po mišićnoj skupini")}.querySelectorAll('[class*="_barValue_"]')].map((el) => el.textContent)`,
    );
    // 110 × 5 squat (its 60 × 5 warm-up left out) and 85 × 5 bench.
    expect(groups.join() === "550 kg,425 kg", `muscle groups: ${groups.join()}`);
  });

  await step("the page made no errors of its own", async () => {
    expect(browser.problems.length === 0, browser.problems.join(" || "));
  });

  await browser.screenshot(join(shots, "end.png"));
} finally {
  console.log(results.join("\n"));
  const failed = results.filter((line) => line.startsWith("FAIL")).length;
  console.log(`\n${results.length - failed} passed, ${failed} failed (stats${phone ? ", phone" : ""})`);
  await browser.close();
}
