// Back-off sets end to end: made in Programi ("−%" in a wide row, "Back-off" in a phone's sheet),
// saved as "1x1 rpe8, 2x5@-20%", loaded into Trening with their "−20 %", and following the weight
// the top set is really done with; one changed by hand stays as typed.
// Bench press has an e1RM of 120 (100 × 5 @ 8, Brzycki): 1 @ RPE 8 is 92,2 % = 110 kg, and 20 % off
// that is 88, rounded to 87,5. Usage: node e2e-backoff.mjs [--phone]
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { mkdirSync } from "node:fs";
import { launch, sleep } from "./cdp.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const phone = process.argv.includes("--phone");
const shots = join(here, "shots", `e2e-backoff${phone ? "-phone" : ""}`);
mkdirSync(shots, { recursive: true });
const APP = process.env.E2E_APP ?? "http://localhost:5199";
const API = "http://localhost:3002";

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
const pad = (n) => String(n).padStart(2, "0");
const now = new Date();
const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
const benchSets = async () =>
  ((await api(`/api/workouts?date=${today}`))[0]?.exercises ?? []).find((e) => e.name === "Bench press")?.sets ?? [];

for (const program of await api("/api/programs")) await api(`/api/programs/${program.id}`, "DELETE");
for (const workout of await api("/api/workouts?limit=1000")) await api(`/api/workouts/${workout.id}`, "DELETE");
for (const template of await api("/api/exercise-templates")) await api(`/api/exercise-templates/${template.id}`, "DELETE");
await api("/api/settings", "PUT", { language: "hr", theme: "auto", template: "moderna", e1rmFormula: "brzycki" });
await api("/api/exercise-templates", "POST", { name: "Bench press", muscleGroup: "Prsa" });
{
  const past = await api("/api/workouts", "POST", { date: "2026-11-01", name: "Prije" });
  const bench = await api(`/api/workouts/${past.id}/exercises`, "POST", { name: "Bench press" });
  await api(`/api/workouts/exercises/${bench.id}/sets`, "POST", { weight: 100, reps: 5, rpe: 8 });
}

const results = [];
function expect(condition, message) {
  if (!condition) throw new Error(message);
}
const browser = await launch({
  port: 9401,
  profile: join(here, "chrome-profile-e2e-backoff"),
  width: phone ? 390 : 1280,
  height: phone ? 1300 : 1100,
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

const q = (text) => JSON.stringify(text);
const text = (expression) => evaluate(`(${expression})?.innerText.replace(/\\s+/g, ' ').trim() ?? ''`);
const button = (label, root = "document") => `__e2e.byText('button', ${q(label)}, ${root})`;
const byLabel = (label, root = "document") =>
  `[...${root}.querySelectorAll('label')].find((l) => l.textContent === ${q(label)}).control`;
const dialog = `document.querySelector('[role="dialog"]')`;
const day = `[...document.querySelectorAll('section')].find((s) => s.querySelector('h2')?.textContent === 'Dan 1')`;
const exercise = `[...${day}.querySelectorAll('li')].find((li) => li.querySelector('input[aria-label="Vježba"]'))`;
const cell = (set, what) => `${exercise}.querySelector('input[aria-label="Set ${set}: ${what}"]')`;
const backoffToggle = (set) =>
  `${exercise}.querySelector('[aria-label="Set ${set}: RPE, postotak ili back-off"] button[aria-label="Back-off"]')`;
const setRows = `[...${exercise}.querySelectorAll('[class*="_setRow_"]')]`;
const rowText = (index) => text(`${setRows}[${index}]`);
// Trening
const card = `__e2e.card('Bench press')`;
const rows = `__e2e.rows(${card})`;
const trainingRow = (index) => text(`${rows}[${index}]`);

try {
  await browser.navigate(`${APP}/programs`);
  await waitFor(button("Novi program"), "Programi", 15000);

  await step("a set after the top set becomes a back-off: 20 % lighter, worked out from it", async () => {
    await click(button("Novi program"));
    await waitFor(`document.querySelector('h1')?.textContent === 'Novi program'`, "the editor");
    await type(byLabel("Naziv"), "Back-off test");
    await type(byLabel("Tjedana"), "1");
    await type(`${exercise}.querySelector('input[aria-label="Vježba"]')`, "Bench press");
    await click(button("Dodaj set", exercise));
    await click(button("Dodaj set", exercise));
    if (phone) {
      // Set 1: 1 rep at RPE 8, the top set; it can't be a back-off itself.
      await click(`${setRows}[0]`);
      await waitFor(dialog, "set 1's sheet");
      await type(byLabel("Ponavljanja", dialog), "1");
      expect(await evaluate(`${button("Back-off", dialog)}.disabled`), "set 1 offers Back-off");
      await click(button("Gotovo", dialog));
      await waitFor(`!${dialog}`, "the sheet to close");
      await click(`${setRows}[1]`);
      await waitFor(dialog, "set 2's sheet");
      await click(button("Back-off", dialog));
      await waitFor(`${byLabel("Manje od top seta (%)", dialog)}.value === '20'`, "20 % to start");
      await type(byLabel("Ponavljanja", dialog), "5");
      const sheet = await text(dialog);
      expect(sheet.includes("≈ 87,5 kg"), `the sheet's weight: ${sheet}`);
      expect(sheet.includes("Top set je set 1 (≈ 110 kg)"), `the sheet's hint: ${sheet}`);
      await click(button("Gotovo", dialog));
      await waitFor(`!${dialog}`, "the sheet to close");
      const second = await rowText(1);
      expect(second.includes("≈ 87,5 kg × 5") && second.includes("−20 %"), `set 2: ${second}`);
    } else {
      await type(cell(1, "ponavljanja"), "1");
      expect(await evaluate(`${backoffToggle(1)}.disabled`), "set 1's −% is not disabled");
      await click(backoffToggle(2));
      await waitFor(`${cell(2, "back-off (%)")}?.value === '20'`, "20 % to start");
      await type(cell(2, "ponavljanja"), "5");
      const table = await text(exercise);
      expect(table.includes("−20 % od top seta (set 1, ≈ 110 kg)"), `the note: ${table}`);
      expect(table.includes("≈ 87,5"), `set 2's weight: ${table}`);
    }
  });

  await step("Dodaj set copies the back-off, and the program saves as 1x1 rpe8, 2x5@-20%", async () => {
    await click(button("Dodaj set", exercise));
    if (phone) {
      await waitFor(`${setRows}.length === 3`, "three sets");
      expect((await rowText(2)).includes("−20 %"), `set 3: ${await rowText(2)}`);
    } else {
      await waitFor(`${cell(3, "back-off (%)")}?.value === '20'`, "set 3 a back-off too");
    }
    await click(button("Spremi"));
    await waitFor(`[...document.querySelectorAll('h2')].some((h) => h.textContent === 'Back-off test')`, "the list");
    const [saved] = await api("/api/programs");
    const scheme = saved.days[0].exercises[0].weekSchemes[0];
    expect(scheme === "1x1 rpe8, 2x5@-20%", `scheme: ${scheme}`);
  });

  await step("loaded into Trening, the back-off sets carry −20 % and the weight from the top set", async () => {
    await browser.navigate(`${APP}/log`);
    await waitFor(button("Započni trening"), "Trening", 15000);
    await click(button("Započni trening"));
    await waitFor(button("Učitaj program"), "Učitaj program");
    await click(button("Učitaj program"));
    await waitFor(button("Učitaj"), "the loader");
    const preview = await evaluate(`document.body.innerText.replace(/\\s+/g, ' ')`);
    expect(preview.includes("1×1 @ 110 kg RPE 8, 2×5 @ 87,5 kg"), "the preview's weights");
    await click(button("Učitaj"));
    await waitFor(`${card} && ${rows}.length === 3`, "the loaded sets");
    const second = await trainingRow(1);
    expect(second.includes("87,5 kg × 5") && second.includes("−20 %"), `set 2: ${second}`);
    const sets = await benchSets();
    expect(sets.map((s) => s.backoffPercent).join() === ",20,20", `saved: ${sets.map((s) => s.backoffPercent)}`);
  });

  await step("the top set done with 115 kg takes the back-off sets to 92,5 kg", async () => {
    await click(`${rows}[0].querySelector('[class*="_setButton_"]')`);
    await waitFor(dialog, "set 1's sheet");
    await type(`${dialog}.querySelectorAll('input[inputmode="decimal"]')[0]`, "115");
    await click(button("Gotovo", dialog));
    await waitFor(`!${dialog}`, "the sheet to close");
    await click(`${rows}[0].querySelector('button[aria-pressed]')`);
    await waitFor(`${rows}[2].innerText.includes('92,5')`, "the back-off sets at 92,5", 8000);
    const sets = await benchSets();
    expect(sets.map((s) => s.weight).join() === "115,92.5,92.5", `saved: ${sets.map((s) => s.weight)}`);
  });

  await step("a back-off set changed by hand stays, and stops following the top set", async () => {
    await click(`${rows}[2].querySelector('[class*="_setButton_"]')`);
    await waitFor(dialog, "set 3's sheet");
    await type(`${dialog}.querySelectorAll('input[inputmode="decimal"]')[0]`, "90");
    await click(button("Gotovo", dialog));
    await waitFor(`!${dialog}`, "the sheet to close");
    await waitFor(`!${rows}[2].innerText.includes('−20')`, "set 3 without −20 %");
    // The top set changed again: set 2 follows it, set 3 keeps its 90.
    await click(`${rows}[0].querySelector('[class*="_setButton_"]')`);
    await waitFor(dialog, "set 1's sheet");
    await type(`${dialog}.querySelectorAll('input[inputmode="decimal"]')[0]`, "120");
    await click(button("Gotovo", dialog));
    await waitFor(`!${dialog}`, "the sheet to close");
    await waitFor(`${rows}[1].innerText.includes('95 kg')`, "set 2 at 95", 8000);
    await sleep(500);
    const sets = await benchSets();
    const saved = sets.map((s) => `${s.weight}${s.backoffPercent ? "/" + s.backoffPercent : ""}`).join();
    expect(saved === "120,95/20,90", `saved: ${saved}`);
  });

  await step("no errors of the page's own", async () => {
    expect(browser.problems.length === 0, browser.problems.join(" || "));
  });
  await browser.screenshot(join(shots, "end.png"));
} finally {
  await browser.close();
}

console.log(results.join("\n"));
const failed = results.filter((line) => line.startsWith("FAIL")).length;
console.log(`\n${results.length - failed} passed, ${failed} failed (back-off${phone ? ", phone" : ""})`);
process.exitCode = failed ? 1 : 0;
