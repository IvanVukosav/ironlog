// End-to-end run of the active workout in Trening against the test backend (throwaway database).
// Usage: node e2e-active.mjs [--phone]
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { mkdirSync } from "node:fs";
import { launch, sleep } from "./cdp.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const phone = process.argv.includes("--phone");
const shots = join(here, "shots", `e2e-active${phone ? "-phone" : ""}`);
mkdirSync(shots, { recursive: true });
const APP = process.env.E2E_APP ?? "http://localhost:5199";
const API = "http://localhost:3002";

const pad = (value) => String(value).padStart(2, "0");
const dateKey = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const now = new Date();
const today = dateKey(now);
const twoDaysAgo = dateKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 2));

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
const badge = (name, index) => `${row(name, index)}.querySelector('[class*="_setNumber_"]').textContent.trim()`;
const dialog = `document.querySelector('[role="dialog"]')`;
const restBar = `document.querySelector('section[aria-label="Odmor"]')`;
const strip = `document.querySelector('[class*="_sticky_"]')`;
const textOf = (expression) => `((${expression})?.innerText ?? '').replace(/\\s+/g, ' ').trim()`;
const button = (text, root = "document") => `__e2e.byText('button', ${q(text)}, ${root})`;
const bodyHas = (text) => `document.body.innerText.includes(${q(text)})`;

const results = [];
function expect(condition, message) {
  if (!condition) throw new Error(message);
}
const browser = await launch({
  port: 9351,
  profile: join(here, "chrome-profile-e2e-active"),
  width: phone ? 390 : 1280,
  height: phone ? 1400 : 1900,
  mobile: phone,
});
const { evaluate, waitFor, click, type } = browser;

async function step(name, run) {
  try {
    await run();
    results.push(`PASS  ${name}`);
  } catch (err) {
    results.push(`FAIL  ${name}\n        ${String(err.message).split("\n")[0]}`);
    await browser.screenshot(join(shots, `FAIL-${results.length}.png`)).catch(() => {});
  }
}

const restSeconds = async () => {
  const time = await evaluate(textOf(`${restBar}?.querySelector('[role="timer"]')`));
  const [minutes, seconds] = time.split(":").map(Number);
  return minutes * 60 + seconds;
};

try {
  for (const workout of await api("/api/workouts?limit=1000")) await api(`/api/workouts/${workout.id}`, "DELETE");
  for (const program of await api("/api/programs")) await api(`/api/programs/${program.id}`, "DELETE");
  for (const template of await api("/api/workout-templates")) await api(`/api/workout-templates/${template.id}`, "DELETE");
  await api("/api/settings", "PUT", { language: "hr", theme: "auto", template: "moderna", restSeconds: 120 });
  // Two days ago: a squat to beat (95 × 5 is an e1RM of 106,9 by Brzycki).
  const earlier = await api("/api/workouts", "POST", { date: twoDaysAgo, name: "Prije" });
  const earlierSquat = await api(`/api/workouts/${earlier.id}/exercises`, "POST", { name: "Čučanj" });
  await api(`/api/workouts/exercises/${earlierSquat.id}/sets`, "POST", { weight: 95, reps: 5 });
  await api("/api/programs", "POST", {
    name: "Test 5/3/1",
    weeks: 2,
    days: [
      {
        name: "Čučanj dan",
        exercises: [
          { name: "Čučanj", weekSchemes: ["3x5@100kg", "3x3@105kg"] },
          { name: "Bench press", weekSchemes: ["2x5@80kg", "2x3@85kg"] },
        ],
      },
    ],
  });

  await browser.navigate(`${APP}/log`);
  await waitFor(button("Započni trening"), "the Start button", 15000);

  await step("a program day loads as a plan: grey, not started, with the hint", async () => {
    await click(button("Započni trening"));
    await waitFor(button("Učitaj program"), "the Load program button");
    await click(button("Učitaj program"));
    await waitFor(button("Učitaj"), "the loader");
    await click(button("Učitaj"));
    await waitFor(`${card("Bench press")} && ${rows("Bench press")}.length === 2`, "the planned cards");
    expect((await evaluate(`${rows("Čučanj")}.length`)) === 3, "Čučanj does not have 3 rows");
    const saved = await workoutOf(today);
    const sets = saved.exercises.flatMap((exercise) => exercise.sets);
    expect(sets.every((set) => set.isDone === false), "loaded sets are done");
    expect(saved.startedAt === null, "the workout started on loading");
    expect(await evaluate(bodyHas("Ovo je plan za danas")), "no hint");
    const status = await evaluate(textOf(strip));
    expect(status.includes("0 od 5 setova") && status.includes("0:00"), `status: ${status}`);
    expect(!(await evaluate(`!!${button("Završi")}`)), "Finish is offered before the start");
    expect(await evaluate(`${row("Čučanj", 0)}.className.includes('_setRowNext_')`), "the first set is not marked next");
    expect(!(await evaluate(`!!${card("Čučanj")}.querySelector('button[data-action="add-set"]')`)), "a planned card shows the form");
  });

  let warmupCount = 0;
  await step("warm-ups are added before the working sets, as a plan", async () => {
    await click(`${card("Čučanj")}.querySelector('button[aria-label="Dodaj zagrijavanje za Čučanj"]')`);
    await waitFor(`${rows("Čučanj")}.length > 3`, "the warm-up rows");
    const squat = await exerciseOf("Čučanj");
    warmupCount = squat.sets.filter((set) => set.isWarmup).length;
    expect(warmupCount >= 2, `${warmupCount} warm-ups`);
    expect(squat.sets.slice(0, warmupCount).every((set) => set.isWarmup && !set.isDone), "warm-ups are not first, or done");
    expect((await evaluate(badge("Čučanj", 0))) === "Z", "the warm-up badge is not Z");
    expect(!(await evaluate(`!!${card("Čučanj")}.querySelector('button[aria-label="Dodaj zagrijavanje za Čučanj"]')`)), "warm-ups are offered again");
  });

  await step("the first tick starts the workout and the rest, which names the next set", async () => {
    await click(tick("Čučanj", 0));
    await waitFor(`${tick("Čučanj", 0)}.getAttribute('aria-pressed') === 'true'`, "the first set done");
    await waitFor(restBar, "the rest bar");
    const rest = await evaluate(textOf(restBar));
    expect(rest.includes("Odmor · sljedeće: Čučanj"), `rest: ${rest}`);
    const seconds = await restSeconds();
    expect(seconds > 110 && seconds <= 120, `rest at ${seconds} s`);
    await waitFor(`${button("Završi")}`, "the Finish button");
    expect(!(await evaluate(bodyHas("Ovo je plan za danas"))), "the hint stayed");
    const saved = await workoutOf(today);
    expect(saved.startedAt !== null, "no start saved");
    const first = saved.exercises.find((exercise) => exercise.name === "Čučanj").sets[0];
    expect(first.isDone && first.completedAt, "the tick was not saved");
  });

  await step("the rest is longer with +15 and goes away with Preskoči", async () => {
    const before = await restSeconds();
    await click(`${restBar}.querySelector('button[aria-label="15 sekundi duže"]')`);
    const after = await restSeconds();
    expect(after >= before + 14, `${before} s became ${after} s`);
    await click(button("Preskoči", restBar));
    await waitFor(`!${restBar}`, "the rest bar to go");
  });

  await step("a set's sheet changes its weight and reps", async () => {
    await click(setButton("Čučanj", warmupCount));
    await waitFor(dialog, "the set sheet");
    const title = await evaluate(textOf(`${dialog}.querySelector('h2')`));
    expect(title === "Set 1 · Čučanj", `title: ${title}`);
    expect(await evaluate(`${dialog}.innerText.includes('Još nije odrađen')`), "no status");
    await click(`${dialog}.querySelector('button[aria-label="Kilaža više za 2,5 kg"]')`);
    const weight = await evaluate(`${dialog}.querySelector('input[inputmode="decimal"]').value`);
    expect(weight === "102,5", `weight shows ${weight}`);
    await type(`${dialog}.querySelector('input[inputmode="numeric"]')`, "4");
    await click(button("Gotovo", dialog));
    await waitFor(`!${dialog}`, "the sheet to close");
    await waitFor(`${row("Čučanj", warmupCount)}.innerText.includes('102,5 kg × 4')`, "the changed row");
    const set = (await exerciseOf("Čučanj")).sets[warmupCount];
    expect(set.weight === 102.5 && set.reps === 4 && set.isDone === false, JSON.stringify(set));
  });

  await step("the sheet marks a set as a warm-up, copies it and deletes it", async () => {
    await click(setButton("Bench press", 0));
    await waitFor(dialog, "the sheet");
    await click(`${dialog}.querySelector('button[role="switch"]')`);
    await click(button("Gotovo", dialog));
    await waitFor(`!${dialog} && ${badge("Bench press", 0)} === 'Z'`, "the Z badge");
    expect((await exerciseOf("Bench press")).sets[0].isWarmup === true, "warm-up not saved");
    await click(setButton("Bench press", 0));
    await waitFor(dialog, "the sheet");
    await click(`${dialog}.querySelector('button[role="switch"]')`);
    await click(button("Kopiraj dolje", dialog));
    await waitFor(`!${dialog} && ${rows("Bench press")}.length === 3`, "the copy");
    const bench = await exerciseOf("Bench press");
    expect(bench.sets[0].isWarmup === false && bench.sets.length === 3 && !bench.sets[2].isDone, JSON.stringify(bench.sets));
    await click(setButton("Bench press", 2));
    await waitFor(dialog, "the sheet");
    await click(button("Obriši set", dialog));
    await waitFor(`!${dialog} && ${rows("Bench press")}.length === 2`, "the deletion");
    expect((await exerciseOf("Bench press")).sets.length === 2, "not deleted");
  });

  await step("ticking a working set off counts it and rests again", async () => {
    await click(tick("Čučanj", warmupCount));
    await waitFor(`${tick("Čučanj", warmupCount)}.getAttribute('aria-pressed') === 'true'`, "the set done");
    await waitFor(restBar, "the rest bar");
    const total = 3 + warmupCount + 2;
    const status = await evaluate(textOf(strip));
    expect(status.includes(`2 od ${total} setova`) || status.includes(`2 od ${total} seta`), `status: ${status}`);
    await click(button("Preskoči", restBar));
  });

  await step("Završi shows the summary with the record, and Nastavi trening goes back", async () => {
    await click(button("Završi"));
    await waitFor(`${dialog} && ${dialog}.innerText.includes('Novi rekordi')`, "the summary");
    await waitFor(`${dialog}.innerText.includes('Čučanj')`, "the squat record", 8000);
    const summary = await evaluate(textOf(dialog));
    for (const part of ["Trening završen", "Trajanje", "Radni setovi", "Volumen", "410 kg", "Procjena 1RM 111,8 kg", "iz plana"]) {
      expect(summary.includes(part), `summary lacks "${part}": ${summary}`);
    }
    await click(button("Nastavi trening", dialog));
    await waitFor(`!${dialog}`, "the summary to close");
    expect((await workoutOf(today)).finishedAt === null, "the workout finished");
  });

  await step("Gotovo finishes: the plan left is gone, and so is an exercise without a done set", async () => {
    await click(button("Završi"));
    await waitFor(button("Gotovo", dialog), "the summary with its buttons");
    await click(button("Gotovo", dialog));
    await waitFor(`!${dialog} && ${textOf(strip)}.includes('Završeno')`, "the finished state");
    const saved = await workoutOf(today);
    expect(saved.finishedAt !== null, "not finished");
    expect(saved.exercises.map((exercise) => exercise.name).join() === "Čučanj", `exercises: ${saved.exercises.map((exercise) => exercise.name)}`);
    expect(saved.exercises[0].sets.every((set) => set.isDone) && saved.exercises[0].sets.length === 2, "planned sets stayed");
    await waitFor(`${card("Čučanj")} && !${card("Bench press")}`, "the cards on screen");
    await waitFor(button("Nastavi"), "the Resume button");
  });

  await step("Nastavi carries on with the workout", async () => {
    await click(button("Nastavi"));
    await waitFor(button("Završi"), "the Finish button again");
    expect((await workoutOf(today)).finishedAt === null, "still finished");
  });

  await browser.screenshot(join(shots, "program.png"));

  await step("a workout of your own logs a set at once, which starts the clock and the rest", async () => {
    await api(`/api/workouts/${(await workoutOf(today)).id}`, "DELETE");
    await browser.navigate(`${APP}/log`);
    await waitFor(button("Započni trening"), "the Start button", 15000);
    await click(button("Započni trening"));
    await waitFor(`document.querySelector('input[placeholder="Pretraži ili upiši vježbu"]')`, "the exercise box");
    await type(`document.querySelector('input[placeholder="Pretraži ili upiši vježbu"]')`, "Mrtvo dizanje");
    await click(button("Dodaj vježbu"));
    await waitFor(card("Mrtvo dizanje"), "the card");
    if (await evaluate(`!!${button("Ne")}`)) await click(button("Ne"));
    await type(`${card("Mrtvo dizanje")}.querySelector('[data-field="weight"] input')`, "140");
    await type(`${card("Mrtvo dizanje")}.querySelector('[data-field="reps"] input')`, "5");
    await click(`${card("Mrtvo dizanje")}.querySelector('button[data-action="add-set"]')`);
    await waitFor(`${rows("Mrtvo dizanje")}.length === 1`, "the logged set");
    expect((await evaluate(`${tick("Mrtvo dizanje", 0)}.getAttribute('aria-pressed')`)) === "true", "the set is not done");
    await waitFor(restBar, "the rest bar");
    await waitFor(`${textOf(strip)}.includes('1 set')`, "one set in the status");
    await waitFor(button("Završi"), "Finish");
    const saved = await workoutOf(today);
    expect(saved.startedAt !== null && saved.exercises[0].sets[0].isDone, "start or set not saved");
  });

  await browser.screenshot(join(shots, "own.png"));

  await step("the page made no errors of its own", async () => {
    const ours = browser.problems.filter((problem) => !problem.includes("chrome-extension://"));
    expect(ours.length === 0, ours.join(" || "));
  });
} finally {
  console.log(results.join("\n"));
  const failed = results.filter((line) => line.startsWith("FAIL")).length;
  console.log(`\n${results.length - failed} passed, ${failed} failed (active${phone ? ", phone" : ""})`);
  await browser.close();
  await sleep(100);
}
