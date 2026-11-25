// End-to-end run of drop sets in Trening against the test backend (throwaway database).
// Usage: node e2e-drops.mjs [--phone]
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { mkdirSync } from "node:fs";
import { launch, sleep } from "./cdp.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const phone = process.argv.includes("--phone");
const shots = join(here, "shots", `e2e-drops${phone ? "-phone" : ""}`);
mkdirSync(shots, { recursive: true });
const APP = process.env.E2E_APP ?? "http://localhost:5199";
const API = "http://localhost:3002";

const pad = (value) => String(value).padStart(2, "0");
const now = new Date();
const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

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
const workoutOf = async (date) => (await api(`/api/workouts?date=${date}`))[0] ?? null;
const exerciseOf = async (name) => (await workoutOf(today))?.exercises.find((exercise) => exercise.name === name);

const q = (text) => JSON.stringify(text);
const card = (name) => `__e2e.card(${q(name)})`;
const rows = (name) => `__e2e.rows(${card(name)})`;
const row = (name, index) => `${rows(name)}[${index}]`;
const setButton = (name, index) => `${row(name, index)}.querySelector('[class*="_setButton_"]')`;
const tick = (name, index) => `${row(name, index)}.querySelector('button[aria-pressed]')`;
const badges = (name) => `${rows(name)}.map((r) => r.querySelector('[class*="_setNumber_"]').textContent.trim()).join(' ')`;
const dialog = `document.querySelector('[role="dialog"]')`;
const restBar = `document.querySelector('section[aria-label="Odmor"]')`;
const button = (text, root = "document") => `__e2e.byText('button', ${q(text)}, ${root})`;
const switchNamed = (label) =>
  `[...${dialog}.querySelectorAll('button[role="switch"]')].find((el) => el.innerText.includes(${q(label)}))`;

const results = [];
function expect(condition, message) {
  if (!condition) throw new Error(message);
}
const browser = await launch({
  port: 9362,
  profile: join(here, "chrome-profile-e2e-drops"),
  width: phone ? 390 : 1280,
  height: phone ? 1400 : 1900,
  mobile: phone,
});
const { evaluate, waitFor, click } = browser;

async function step(name, run) {
  try {
    await run();
    results.push(`PASS  ${name}`);
  } catch (err) {
    results.push(`FAIL  ${name}\n        ${String(err.message).split("\n")[0]}`);
    await browser.screenshot(join(shots, `FAIL-${results.length}.png`)).catch(() => {});
  }
}

async function tickAndWait(name, index) {
  await click(tick(name, index));
  await waitFor(`${tick(name, index)}.getAttribute('aria-pressed') === 'true'`, `set ${index} done`);
}

try {
  for (const workout of await api("/api/workouts?limit=1000")) await api(`/api/workouts/${workout.id}`, "DELETE");
  for (const program of await api("/api/programs")) await api(`/api/programs/${program.id}`, "DELETE");
  await api("/api/settings", "PUT", { language: "hr", theme: "auto", template: "moderna", restSeconds: 120 });
  const workout = await api("/api/workouts", "POST", { date: today, name: "Drop test" });
  const plan = (weight, reps, extra = {}) => ({ weight, reps, isDone: false, ...extra });
  await api(`/api/workouts/${workout.id}/exercises/bulk`, "POST", {
    exercises: [
      {
        name: "Bench press",
        sets: [
          plan(80, 8, { rpe: 9 }),
          plan(65, 8, { isDrop: true }),
          plan(50, 8, { isDrop: true }),
          plan(80, 8),
        ],
      },
    ],
  });

  await browser.navigate(`${APP}/log`);
  await waitFor(`${card("Bench press")} && ${rows("Bench press")}.length === 4`, "the planned card", 15000);

  await step("drop sets show a D, hang under their set and don't take a number", async () => {
    const shown = await evaluate(badges("Bench press"));
    expect(shown === "1 D D 2", `badges: ${shown}`);
    const indented = await evaluate(`${rows("Bench press")}.map((r) => r.className.includes('_setRowDrop_')).join()`);
    expect(indented === "false,true,true,false", `drop rows: ${indented}`);
    const label = await evaluate(`${setButton("Bench press", 1)}.getAttribute('aria-label')`);
    expect(label.startsWith("Drop set, 65 kg × 8"), `label: ${label}`);
  });

  await step("no rest before a drop set; the rest starts after the last drop", async () => {
    await tickAndWait("Bench press", 0);
    await sleep(600);
    expect(!(await evaluate(`!!${restBar}`)), "a rest started before the first drop");
    await tickAndWait("Bench press", 1);
    await sleep(600);
    expect(!(await evaluate(`!!${restBar}`)), "a rest started between the drops");
    await tickAndWait("Bench press", 2);
    await waitFor(restBar, "the rest after the last drop");
    const rest = await evaluate(`${restBar}.innerText.replace(/\\s+/g, ' ')`);
    expect(rest.includes("sljedeće: Bench press 80 kg × 8"), `rest: ${rest}`);
  });

  await step("the set sheet makes a set a drop set, and a warm-up switches it back off", async () => {
    await click(button("Preskoči"));
    await click(setButton("Bench press", 3));
    await waitFor(dialog, "the set sheet");
    await click(switchNamed("Drop set"));
    await click(button("Gotovo", dialog));
    await waitFor(`!${dialog}`, "the sheet to close");
    await waitFor(`${badges("Bench press")} === '1 D D D'`, "the fourth set as a drop");
    expect((await exerciseOf("Bench press")).sets[3].isDrop === true, "isDrop was not saved");

    await click(setButton("Bench press", 3));
    await waitFor(dialog, "the set sheet again");
    expect((await evaluate(`${switchNamed("Drop set")}.getAttribute('aria-checked')`)) === "true", "the drop switch is off");
    await click(switchNamed("Zagrijavanje"));
    expect((await evaluate(`${switchNamed("Drop set")}.getAttribute('aria-checked')`)) === "false", "drop stayed on with warm-up");
    await click(button("Gotovo", dialog));
    await waitFor(`!${dialog}`, "the sheet to close");
    await waitFor(`${badges("Bench press")} === '1 D D Z'`, "the fourth set as a warm-up");
    const saved = (await exerciseOf("Bench press")).sets[3];
    expect(saved.isWarmup === true && saved.isDrop === false, `saved: ${JSON.stringify(saved)}`);
  });

  await step("a program day brings its drop sets, its superset and RPE weights into Trening", async () => {
    for (const old of await api("/api/workouts?limit=1000")) await api(`/api/workouts/${old.id}`, "DELETE");
    // An e1RM for Bench press: 100 × 5 @ 8 is 120 by Brzycki.
    await api("/api/settings", "PUT", { e1rmFormula: "brzycki" });
    const past = await api("/api/workouts", "POST", { date: "2026-11-01", name: "Prije" });
    const pastBench = await api(`/api/workouts/${past.id}/exercises`, "POST", { name: "Bench press" });
    await api(`/api/workouts/exercises/${pastBench.id}/sets`, "POST", { weight: 100, reps: 5, rpe: 8 });
    for (const old of await api("/api/programs")) await api(`/api/programs/${old.id}`, "DELETE");
    await api("/api/programs", "POST", {
      name: "Drop program",
      weeks: 1,
      days: [
        {
          name: "Gornji",
          exercises: [
            { name: "Bench press", supersetGroup: "A", weekSchemes: ["1x8 rpe8, 1x10@60kg rpe9 drop2"] },
            { name: "Veslanje", supersetGroup: "A", weekSchemes: ["2x10@50kg"] },
          ],
        },
      ],
    });
    await browser.navigate(`${APP}/log`);
    await waitFor(button("Započni trening"), "the Start button", 15000);
    await click(button("Započni trening"));
    await waitFor(button("Učitaj program"), "the Load program button");
    await click(button("Učitaj program"));
    await waitFor(button("Učitaj"), "the loader");
    const preview = await evaluate(`document.body.innerText.replace(/\\s+/g, ' ')`);
    // 8 @ RPE 8 is 73.9 % of 120 by the chart: 88.7, rounded to 87.5.
    expect(
      preview.includes("1×8 @ 87,5 kg RPE 8, 1×10 @ 60 kg RPE 9 + 2 dropa"),
      "the preview does not say the RPE weight or the drops",
    );
    await click(button("Učitaj"));
    await waitFor(`${card("Veslanje")} && ${rows("Bench press")}.length === 4`, "the loaded cards");
    const shown = await evaluate(badges("Bench press"));
    expect(shown === "1 2 D D", `badges: ${shown}`);
    const saved = await workoutOf(today);
    const bench = saved.exercises.find((exercise) => exercise.name === "Bench press");
    const weights = bench.sets.map((set) => `${set.weight}${set.isDrop ? "d" : ""}`).join(" ");
    expect(weights === "87.5 60 47.5d 37.5d", `bench sets: ${weights}`);
    const groups = saved.exercises.map((exercise) => exercise.supersetGroup).join();
    expect(groups === "A,A", `superset groups: ${groups}`);
  });

  await step("the page made no errors of its own", async () => {
    expect(browser.problems.length === 0, browser.problems.join(" || "));
  });

  await browser.screenshot(join(shots, "end.png"));
} finally {
  console.log(results.join("\n"));
  const failed = results.filter((line) => line.startsWith("FAIL")).length;
  console.log(`\n${results.length - failed} passed, ${failed} failed (drops${phone ? ", phone" : ""})`);
  await browser.close();
}
