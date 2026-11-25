// End-to-end run of "Ponovi trening" against the test backend: from Početna, from Trening's
// buttons, on a day filled in afterwards, and "Ponovi danas" in a past workout's ⋯ menu.
// Usage: node e2e-repeat.mjs [--phone]
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { mkdirSync } from "node:fs";
import { launch, sleep } from "./cdp.mjs";
import { api, daysAgo, seed, today } from "./seed-ponovi.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const phone = process.argv.includes("--phone");
const shots = join(here, "shots", `e2e-repeat${phone ? "-phone" : ""}`);
mkdirSync(shots, { recursive: true });
const APP = process.env.E2E_APP ?? "http://localhost:5199";

const workoutOf = async (date) => (await api(`/api/workouts?date=${date}`))[0] ?? null;
const clearDay = async (date) => {
  for (const workout of await api(`/api/workouts?date=${date}`)) await api(`/api/workouts/${workout.id}`, "DELETE");
};
// "Bench press:60x8W-,..." per exercise: what a saved workout holds, to compare with.
const shape = (workout) =>
  workout.exercises.map(
    (exercise) =>
      `${exercise.name}${exercise.supersetGroup ? `(${exercise.supersetGroup})` : ""}:` +
      exercise.sets
        .map((set) => `${set.weight}x${set.reps}${set.rpe ? `@${set.rpe}` : ""}${set.isWarmup ? "W" : ""}${set.isDrop ? "D" : ""}${set.isDone ? "+" : "-"}`)
        .join(","),
  );

const q = (text) => JSON.stringify(text);
const button = (text) => `__e2e.byText('button', ${q(text)})`;
const sheet = "document.querySelector('section[role=dialog]')";
const sheetRows = `[...(${sheet})?.querySelectorAll('li button') ?? []]`;
const rowOf = (name) => `${sheetRows}.find((row) => row.querySelector('span span')?.textContent === ${q(name)})`;

const results = [];
function expect(condition, message) {
  if (!condition) throw new Error(message);
}
const browser = await launch({
  port: 9358,
  profile: join(here, "chrome-profile-e2e-repeat"),
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
  await waitFor(button("Započni po programu"), "Početna's start buttons", 15000);
}
async function openLog(date) {
  await browser.navigate(`${APP}/log?date=${date}`);
  await waitFor(`document.querySelector('input[placeholder="Pretraži ili upiši vježbu"]') || ${button("Započni trening")}`, "Trening", 15000);
}

try {
  await api("/api/settings", "PUT", { language: "hr", theme: "auto", template: "moderna", showWorkoutWidget: true });
  await seed();
  const pushShape = shape((await api(`/api/workouts?date=${daysAgo(5)}`))[0]);
  const nextBefore = await api("/api/programs/next");

  await step("Početna offers Ponovi trening, and its list has the trained workouts, newest first", async () => {
    await openHome();
    await waitFor(button("Ponovi trening"), "the Ponovi trening button");
    await click(button("Ponovi trening"));
    await waitFor(`${sheetRows}.length > 0`, "the list");
    const rows = await browser.evaluate(`${sheetRows}.map((row) => row.innerText.replace(/\\s+/g, ' ').trim())`);
    expect(rows.length === 4, `rows: ${JSON.stringify(rows)}`);
    expect(rows[0].startsWith("Pull jučer") && rows[1].startsWith("Noge") && rows[2].startsWith("Push") && rows[3].startsWith("Mrtvo dan"), `order: ${JSON.stringify(rows)}`);
    expect(rows[2].includes("4 vježbe · 12 radnih setova · Bench press, Overhead press, Triceps na sajli, Lateralno podizanje"), `Push row: ${rows[2]}`);
    expect(rows[3].includes("1 vježba · 3 radna seta"), `Mrtvo dan row: ${rows[3]}`);
    const hint = await browser.evaluate(`(${sheet}).innerText`);
    expect(hint.includes("postaje plan"), `hint: ${hint}`);
  });

  await step("Escape closes the list without starting anything", async () => {
    await browser.press("Escape", "Escape", 27);
    await waitFor(`!${sheet}`, "the list to close");
    expect((await workoutOf(today)) === null, "a workout was made");
  });

  await step("picking Push makes today's plan: same name, order, sets, warm-ups, drop set and superset", async () => {
    await click(button("Ponovi trening"));
    await waitFor(rowOf("Push"), "Push in the list");
    await click(rowOf("Push"), "Push");
    await waitFor(`location.pathname === '/log' && __e2e.cardNames().includes('Bench press')`, "Trening with the plan", 15000);
    await waitFor(`document.body.innerText.includes('Ovo je plan za danas')`, "the plan hint");
    const saved = await workoutOf(today);
    expect(saved.name === "Push" && saved.programId === null, `workout: ${JSON.stringify({ ...saved, exercises: undefined })}`);
    const expected = pushShape.map((line) => line.replaceAll("+", "-"));
    expect(JSON.stringify(shape(saved)) === JSON.stringify(expected), `\n got ${JSON.stringify(shape(saved))}\n want ${JSON.stringify(expected)}`);
    const nameBox = await browser.evaluate(`document.querySelector('input[aria-label="Naziv treninga"]').value`);
    expect(nameBox === "Push", `the name box shows "${nameBox}"`);
  });

  await step("the program doesn't move on: Sljedeće u programu is the same day", async () => {
    const next = await api("/api/programs/next");
    expect(JSON.stringify(next) === JSON.stringify(nextBefore), `before ${JSON.stringify(nextBefore)}, now ${JSON.stringify(next)}`);
  });

  await step("Trening's Ponovi trening leaves out today's workout and adds the picked one at the end", async () => {
    await openLog(today);
    await waitFor(button("Ponovi trening"), "the button under the exercises");
    await click(button("Ponovi trening"));
    await waitFor(`${sheetRows}.length > 0`, "the list");
    const names = await browser.evaluate(`${sheetRows}.map((row) => row.querySelector('span span').textContent)`);
    expect(JSON.stringify(names) === JSON.stringify(["Pull", "Noge", "Push", "Mrtvo dan"]), `names: ${JSON.stringify(names)}`);
    await click(rowOf("Noge"), "Noge");
    await waitFor(`!${sheet} && __e2e.cardNames().includes('Rumunjsko mrtvo')`, "Noge's exercises");
    const saved = await workoutOf(today);
    const exercises = saved.exercises.map((exercise) => exercise.name);
    expect(JSON.stringify(exercises) === JSON.stringify(["Bench press", "Overhead press", "Triceps na sajli", "Lateralno podizanje", "Čučanj", "Rumunjsko mrtvo"]), `exercises: ${JSON.stringify(exercises)}`);
    expect(saved.name === "Push", `name: ${saved.name}`);
    expect(saved.exercises.every((exercise) => exercise.sets.every((set) => !set.isDone)), "a set came in done");
  });

  await step("Ponovi danas on yesterday's Pull adds it to today's workout and opens today", async () => {
    await openLog(daysAgo(1));
    await waitFor(`document.querySelector('[aria-label="Opcije treninga"]')`, "the ⋯ button");
    await click(`document.querySelector('[aria-label="Opcije treninga"]')`);
    await waitFor(button("Ponovi danas"), "Ponovi danas in the menu");
    await click(button("Ponovi danas"));
    await waitFor(`!new URLSearchParams(location.search).has('date') && __e2e.cardNames().includes('Zgibovi')`, "today with Pull's exercises", 15000);
    const saved = await workoutOf(today);
    expect(saved.exercises.length === 8 && saved.name === "Push", `today: ${saved.name}, ${saved.exercises.map((exercise) => exercise.name)}`);
    const pull = await workoutOf(daysAgo(1));
    expect(pull.exercises.length === 2 && pull.exercises.every((exercise) => exercise.sets.every((set) => set.isDone)), "yesterday's Pull changed");
  });

  await step("Ponovi danas with nothing today makes today's workout under the past one's name", async () => {
    await clearDay(today);
    await openLog(daysAgo(5));
    await click(`document.querySelector('[aria-label="Opcije treninga"]')`);
    await waitFor(button("Ponovi danas"), "Ponovi danas");
    await click(button("Ponovi danas"));
    await waitFor(`!new URLSearchParams(location.search).has('date') && __e2e.cardNames().includes('Bench press')`, "today with Push", 15000);
    const saved = await workoutOf(today);
    expect(saved.name === "Push" && saved.programId === null, `today: ${JSON.stringify({ ...saved, exercises: undefined })}`);
    expect(JSON.stringify(shape(saved)) === JSON.stringify(pushShape.map((line) => line.replaceAll("+", "-"))), `shape: ${JSON.stringify(shape(saved))}`);
  });

  await step("today's own workout offers no Ponovi danas", async () => {
    await openLog(today);
    await click(`document.querySelector('[aria-label="Opcije treninga"]')`);
    await waitFor(button("Obriši trening"), "the menu");
    expect(!(await browser.evaluate(`!!${button("Ponovi danas")}`)), "today offers Ponovi danas");
  });

  await step("on a day filled in afterwards, the picked workout's sets come in done", async () => {
    await clearDay(daysAgo(2));
    await openLog(daysAgo(2));
    await click(button("Započni trening"));
    await waitFor(button("Ponovi trening"), "the button");
    await click(button("Ponovi trening"));
    await waitFor(`${sheetRows}.length > 0`, "the list");
    const hint = await browser.evaluate(`(${sheet}).innerText`);
    expect(hint.includes("kao odrađeni"), `hint: ${hint}`);
    await click(rowOf("Pull"), "Pull");
    await waitFor(`!${sheet} && __e2e.cardNames().includes('Zgibovi')`, "Pull's exercises");
    const saved = await workoutOf(daysAgo(2));
    const sets = saved.exercises.flatMap((exercise) => exercise.sets);
    expect(saved.name === "Pull" && sets.length === 4 && sets.every((set) => set.isDone), `day: ${saved.name}, ${JSON.stringify(shape(saved))}`);
  });

  await step("the list loads 20 at a time, and Prikaži starije adds older ones down to the first", async () => {
    await clearDay(today);
    for (let n = 0; n < 25; n++) {
      const old = await api("/api/workouts", "POST", { date: daysAgo(10 + n), name: `Stari ${n + 1}` });
      await api(`/api/workouts/${old.id}/exercises/bulk`, "POST", {
        exercises: [{ name: "Bench press", sets: [{ weight: 80, reps: 5 }] }],
      });
    }
    const total = (await api("/api/workouts/trained?limit=50")).length;
    await openHome();
    await click(button("Ponovi trening"));
    await waitFor(`${sheetRows}.length === 20 && ${button("Prikaži starije")}`, "the first 20 and Prikaži starije");
    await click(button("Prikaži starije"));
    await waitFor(`${sheetRows}.length === ${total}`, `all ${total} workouts`);
    expect(!(await browser.evaluate(`!!${button("Prikaži starije")}`)), "still offers older ones");
    const last = await browser.evaluate(`${sheetRows}.at(-1).querySelector('span span').textContent`);
    expect(last === "Stari 25", `the oldest: ${last}`);
    await click(rowOf("Stari 25"), "Stari 25");
    await waitFor(`location.pathname === '/log' && __e2e.cardNames().includes('Bench press')`, "Trening with Stari 25", 15000);
    const saved = await workoutOf(today);
    expect(saved.name === "Stari 25" && JSON.stringify(shape(saved)) === '["Bench press:80x5-"]', `today: ${saved.name} ${JSON.stringify(shape(saved))}`);
  });

  await step("without any trained workout there is no Ponovi trening", async () => {
    for (const workout of await api("/api/workouts?limit=1000")) await api(`/api/workouts/${workout.id}`, "DELETE");
    await browser.navigate(`${APP}/`);
    await waitFor(button("Započni trening") + " || " + button("Započni po programu"), "Početna's start button", 15000);
    await sleep(800);
    expect(!(await browser.evaluate(`!!${button("Ponovi trening")}`)), "Početna offers Ponovi trening");
    await api("/api/workouts", "POST", { date: today });
    await openLog(today);
    await sleep(800);
    expect(!(await browser.evaluate(`!!${button("Ponovi trening")}`)), "Trening offers Ponovi trening");
  });

  await step("the page made no errors of its own", async () => {
    const ours = browser.problems.filter((problem) => !problem.includes("chrome-extension://"));
    expect(ours.length === 0, ours.join(" || "));
  });
} finally {
  console.log(results.join("\n"));
  const failed = results.filter((line) => line.startsWith("FAIL")).length;
  console.log(`\n${results.length - failed} passed, ${failed} failed (repeat${phone ? ", phone" : ""})`);
  await browser.close();
  await sleep(100);
}
