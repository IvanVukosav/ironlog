// End-to-end run of Početna's "today" card with a program against the test backend.
// Usage: node e2e-home-program.mjs [--phone]
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { mkdirSync } from "node:fs";
import { launch, sleep } from "./cdp.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const phone = process.argv.includes("--phone");
const shots = join(here, "shots", `e2e-home-program${phone ? "-phone" : ""}`);
mkdirSync(shots, { recursive: true });
const APP = process.env.E2E_APP ?? "http://localhost:5199";
const API = "http://localhost:3002";

const pad = (value) => String(value).padStart(2, "0");
const dateKey = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const now = new Date();
const today = dateKey(now);
const yesterday = dateKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1));

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
const clearWorkouts = async () => {
  for (const workout of await api("/api/workouts?limit=1000")) await api(`/api/workouts/${workout.id}`, "DELETE");
};

const q = (text) => JSON.stringify(text);
const button = (text) => `__e2e.byText('button', ${q(text)})`;
const todayCard = `[...document.querySelectorAll('section')].find((s) => s.querySelector('h2')?.textContent.startsWith('Trening danas'))`;
const cardText = () => browser.evaluate(`(${todayCard})?.innerText.replace(/\\s+/g, ' ').trim() ?? ''`);

const results = [];
function expect(condition, message) {
  if (!condition) throw new Error(message);
}
const browser = await launch({
  port: 9355,
  profile: join(here, "chrome-profile-e2e-home"),
  width: phone ? 390 : 1280,
  height: phone ? 1400 : 1900,
  mobile: phone,
});
const { waitFor, click } = browser;

async function step(name, run) {
  try {
    await run();
    results.push(`PASS  ${name}`);
  } catch (err) {
    results.push(`FAIL  ${name}\n        ${String(err.message).split("\n")[0]}`);
    await browser.screenshot(join(shots, `FAIL-${results.length}.png`)).catch(() => {});
  }
}

async function openHome() {
  await browser.navigate(`${APP}/`);
  // The title is a link from the start; the buttons come with the data.
  await waitFor(
    `(${todayCard}) && /Započni|Nastavi trening/.test((${todayCard}).innerText)`,
    "today's card with its buttons",
    15000,
  );
}

try {
  await clearWorkouts();
  for (const program of await api("/api/programs")) await api(`/api/programs/${program.id}`, "DELETE");
  await api("/api/settings", "PUT", { language: "hr", theme: "auto", template: "moderna", showWorkoutWidget: true });

  await step("without a program, the card offers a plain start", async () => {
    await openHome();
    const text = await cardText();
    expect(text.includes("Danas još nema treninga") && !text.includes("Sljedeće u programu"), `card: ${text}`);
    expect(await browser.evaluate(`!!${button("Započni trening")}`), "no Start button");
  });

  const program = await api("/api/programs", "POST", {
    name: "Test 5/3/1",
    weeks: 2,
    days: [
      {
        name: "Čučanj dan",
        exercises: [
          { name: "Čučanj", weekSchemes: ["3x5@100kg", "3x3@105kg"] },
          { name: "Bench press", weekSchemes: ["3x5@80kg", "3x3@85kg"] },
        ],
      },
      { name: "Mrtvo dan", exercises: [{ name: "Mrtvo dizanje", weekSchemes: ["3x5@140kg", "3x3@150kg"] }] },
    ],
  });

  await step("the only program offers its first day before anything was trained from it", async () => {
    await openHome();
    await waitFor(`(${todayCard}).innerText.includes('Sljedeće u programu')`, "the program day");
    const text = await cardText();
    for (const part of ["Čučanj dan", "Test 5/3/1 · tjedan 1, dan 1", "Čučanj", "3 seta · 100 kg × 5", "Bench press", "Započni po programu", "Svoj trening"]) {
      expect(text.includes(part), `card lacks "${part}": ${text}`);
    }
  });

  await step("after day 1 was trained, the card offers day 2, and starting it loads its plan", async () => {
    const done = await api("/api/workouts", "POST", { date: yesterday, name: "Čučanj dan" });
    await api(`/api/workouts/${done.id}/exercises/bulk`, "POST", {
      program: { id: program.id, week: 1, day: 1 },
      exercises: [{ name: "Čučanj", sets: [{ weight: 100, reps: 5 }] }],
    });
    await openHome();
    await waitFor(`(${todayCard}).innerText.includes('Mrtvo dan')`, "day 2");
    const text = await cardText();
    expect(text.includes("Test 5/3/1 · tjedan 1, dan 2") && text.includes("3 seta · 140 kg × 5"), `card: ${text}`);
    await click(button("Započni po programu"));
    await waitFor(`location.pathname === '/log' && document.body.innerText.includes('Mrtvo dizanje')`, "Trening with the plan");
    await waitFor(`document.body.innerText.includes('Ovo je plan za danas')`, "the plan hint");
    const saved = await workoutOf(today);
    expect(saved.name === "Mrtvo dan" && saved.programId === program.id && saved.programWeek === 1 && saved.programDay === 2, `workout: ${JSON.stringify({ ...saved, exercises: undefined })}`);
    const sets = saved.exercises.flatMap((exercise) => exercise.sets);
    expect(sets.length === 3 && sets.every((set) => !set.isDone && set.weight === 140), `sets: ${JSON.stringify(sets)}`);
    const nameBox = await browser.evaluate(`document.querySelector('input[aria-label="Naziv treninga"]').value`);
    expect(nameBox === "Mrtvo dan", `the name box shows "${nameBox}"`);
  });

  await step("today's planned workout shows on Početna as a plan, not as sets done", async () => {
    await openHome();
    await waitFor(`(${todayCard}).innerText.includes('Mrtvo dan')`, "today's workout");
    const text = await cardText();
    expect(text.includes("3 seta u planu") && text.includes("Nastavi trening"), `card: ${text}`);
    expect(text.includes("0 setova"), `the done count: ${text}`);
  });

  await step("a workout of one's own starts empty, without the program", async () => {
    await api(`/api/workouts/${(await workoutOf(today)).id}`, "DELETE");
    await openHome();
    await waitFor(button("Svoj trening"), "the own-workout button");
    await click(button("Svoj trening"));
    await waitFor(`location.pathname === '/log' && document.querySelector('input[placeholder="Pretraži ili upiši vježbu"]')`, "an empty Trening");
    const saved = await workoutOf(today);
    expect(saved && saved.programId === null && saved.exercises.length === 0, `workout: ${JSON.stringify(saved)}`);
  });

  await step("the page made no errors of its own", async () => {
    const ours = browser.problems.filter((problem) => !problem.includes("chrome-extension://"));
    expect(ours.length === 0, ours.join(" || "));
  });
} finally {
  console.log(results.join("\n"));
  const failed = results.filter((line) => line.startsWith("FAIL")).length;
  console.log(`\n${results.length - failed} passed, ${failed} failed (home program${phone ? ", phone" : ""})`);
  await browser.close();
  await sleep(100);
}
