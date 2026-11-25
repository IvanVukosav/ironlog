// End-to-end run of the Log page against a real backend on a throwaway database.
// Usage: node e2e-log.mjs <old|new> [--phone]
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { mkdirSync } from "node:fs";
import { launch, sleep } from "./cdp.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const layout = process.argv[2] ?? "old";
const phone = process.argv.includes("--phone");
const APP = process.env.E2E_APP ?? "http://localhost:5199";
const API = "http://localhost:3002";
const shots = join(here, "shots", `e2e-${layout}${phone ? "-phone" : ""}`);
mkdirSync(shots, { recursive: true });

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

// ---------- what the page looks like to the test ----------
const q = (text) => JSON.stringify(text);
const card = (name) => `__e2e.card(${q(name)})`;
const row = (name, index) => `__e2e.rows(${card(name)})[${index}]`;
// The row being edited is the one that holds the Save button.
const editRow = (name) =>
  `__e2e.byText('button', 'Spremi', ${card(name)}).closest('[class*="_setRowEditing_"]')`;

const old = {
  workoutName: `document.querySelector('input[placeholder^="Naziv treninga"]')`,
  workoutNotes: `document.querySelector('textarea[placeholder^="Bilješke o treningu"]')`,
  showWorkoutNotes: null,
  weight: (scope) => `${scope}.querySelector('input[placeholder="Kilaža"]')`,
  reps: (scope) => `${scope}.querySelector('input[placeholder="Broj ponavljanja"]')`,
  rpe: (scope) => `${scope}.querySelector('input[placeholder="RPE"]')`,
  addSetButton: (name) => `__e2e.byText('button', 'Dodaj set', ${card(name)})`,
  cardMenu: (name) => `__e2e.byText('button', '⋮', ${card(name)})`,
  deleteSet: (name, index) => `__e2e.byText('button', 'X', ${row(name, index)})`,
  deleteWorkout: async (browser) => browser.click(`__e2e.byText('button', 'Odustani')`),
  saveAsTemplate: async (browser) => browser.click(`__e2e.byText('button', 'Spremi kao predložak')`),
  dateTrigger: `document.querySelector('[class*="_trigger_"]')`,
  stepUp: (name) => `__e2e.byText('button', '+', ${card(name)})`,
  setHandle: (name, index) => `${row(name, index)}.querySelector('[class*="_dragHandle_"]')`,
};

// A toast lies over the top of a phone screen for 4 seconds; a person would close it (or wait)
// before reaching for the header's menu, and so does the test.
async function closeToasts(browser) {
  for (;;) {
    const open = await browser.evaluate(
      `!!document.querySelector('[class*="_toast"] [class*="_closeButton_"]')`,
    );
    if (!open) return;
    await browser.click(`document.querySelector('[class*="_toast"] [class*="_closeButton_"]')`);
  }
}

const next = {
  ...old,
  workoutName: `document.querySelector('input[aria-label="Naziv treninga"]')`,
  showWorkoutNotes: async (browser) => {
    await closeToasts(browser);
    await browser.click(`document.querySelector('button[aria-label="Opcije treninga"]')`);
    await browser.click(`__e2e.byText('button', 'Dodaj bilješku')`);
  },
  weight: (scope) => `${scope}.querySelector('[data-field="weight"] input')`,
  reps: (scope) => `${scope}.querySelector('[data-field="reps"] input')`,
  rpe: (scope) => `${scope}.querySelector('[data-field="rpe"] input')`,
  dateTrigger: `document.querySelector('[class*="_triggerText_"]')`,
  setHandle: (name, index) => `${row(name, index)}.querySelector('[class*="_setNumber_"]')`,
  addSetButton: (name) => `${card(name)}.querySelector('button[data-action="add-set"]')`,
  cardMenu: (name) => `${card(name)}.querySelector('button[aria-label^="Opcije za"]')`,
  deleteSet: (name, index) => `${row(name, index)}.querySelector('button[aria-label="Obriši set"]')`,
  deleteWorkout: async (browser) => {
    await closeToasts(browser);
    await browser.click(`document.querySelector('button[aria-label="Opcije treninga"]')`);
    await browser.click(`__e2e.byText('button', 'Obriši trening')`);
  },
  saveAsTemplate: async (browser) => {
    await closeToasts(browser);
    await browser.click(`document.querySelector('button[aria-label="Opcije treninga"]')`);
    await browser.click(`__e2e.byText('button', 'Spremi kao predložak')`);
  },
  stepUp: (name) => `${card(name)}.querySelector('button[aria-label="Više kilograma"]')`,
};
const ui = layout === "new" ? next : old;

// ---------- the run ----------
const results = [];
const browser = await launch({
  port: 9335,
  profile: join(here, "chrome-profile-e2e"),
  width: phone ? 390 : 1280,
  height: phone ? 1600 : 1900,
  mobile: phone,
});
const { evaluate, waitFor, click, type, blur } = browser;

const bodyHas = (text) => `document.body.innerText.includes(${q(text)})`;
const rowCount = (name) => evaluate(`__e2e.rows(${card(name)}).length`);
const rowText = (name, index) => evaluate(`${row(name, index)}.innerText.replace(/\\s+/g, ' ')`);
const cardNames = () => evaluate(`__e2e.cardNames()`);

function expect(condition, message) {
  if (!condition) throw new Error(message);
}
function expectIncludesAll(text, parts) {
  for (const part of parts) expect(text.includes(part), `expected "${text}" to include "${part}"`);
}

async function step(name, run) {
  try {
    await run();
    results.push(`PASS  ${name}`);
  } catch (err) {
    results.push(`FAIL  ${name}\n        ${String(err.message).split("\n")[0]}`);
    await browser.screenshot(join(shots, `FAIL-${results.length}.png`)).catch(() => {});
  }
}

async function addSet(name, weight, reps, rpe) {
  await type(ui.weight(card(name)), weight);
  await type(ui.reps(card(name)), reps);
  await type(ui.rpe(card(name)), rpe);
  await click(ui.addSetButton(name));
}

// The sheet a tap on a set opens (since the active workout: copy, edit and delete live there).
const dialog = `document.querySelector('[role="dialog"]')`;
async function openSheet(name, index) {
  await click(`${row(name, index)}.querySelector('[class*="_setButton_"]')`);
  await waitFor(dialog, "the set sheet");
}

async function tickAll(name) {
  const count = await rowCount(name);
  for (let index = 0; index < count; index++) {
    const pressed = `${row(name, index)}.querySelector('button[aria-pressed]')`;
    if ((await evaluate(`${pressed}.getAttribute('aria-pressed')`)) === "true") continue;
    await click(pressed);
    await waitFor(`${pressed}.getAttribute('aria-pressed') === 'true'`, `set ${index + 1} done`);
  }
}

async function addExercise(name) {
  await type(`document.querySelector('input[placeholder="Pretraži ili upiši vježbu"]')`, name);
  await click(`__e2e.byText('button', 'Dodaj vježbu')`);
}

try {
  // A clean slate, then last time's bench session and a two-week program to load from.
  // Every workout goes, so no other suite's sessions change "last time" or the PR check
  // (e2e-programs leaves Bench press 100 × 5 @ 8 on 2026-11-01, more than two weeks back).
  for (const workout of await api("/api/workouts?limit=1000")) {
    await api(`/api/workouts/${workout.id}`, "DELETE");
  }
  for (const template of await api("/api/workout-templates")) {
    await api(`/api/workout-templates/${template.id}`, "DELETE");
  }
  for (const template of await api("/api/exercise-templates")) {
    await api(`/api/exercise-templates/${template.id}`, "DELETE");
  }
  for (const program of await api("/api/programs")) await api(`/api/programs/${program.id}`, "DELETE");
  const previous = await api("/api/workouts", "POST", { date: yesterday, name: "Jučer" });
  const previousBench = await api(`/api/workouts/${previous.id}/exercises`, "POST", { name: "Bench press" });
  await api(`/api/workouts/exercises/${previousBench.id}/sets`, "POST", { weight: 90, reps: 5, rpe: 7 });
  await api(`/api/workouts/exercises/${previousBench.id}/sets`, "POST", { weight: 92.5, reps: 4, rpe: 8 });
  await api("/api/programs", "POST", {
    name: "Test program",
    weeks: 2,
    days: [{ name: "Dan A", exercises: [{ name: "Čučanj", weekSchemes: ["3x5@100kg", "3x5@105kg"] }] }],
  });

  await browser.navigate(`${APP}/log`);

  await step("an empty day offers to start a workout, and starting one saves it", async () => {
    await waitFor(`__e2e.byText('button', 'Započni trening')`, "the Start workout button");
    expect((await workoutOf(today)) === null, "no workout should exist yet");
    await click(`__e2e.byText('button', 'Započni trening')`);
    await waitFor(ui.workoutName, "the workout name box");
    expect((await workoutOf(today)) !== null, "the workout was not saved");
    expect(!(await evaluate(`!!__e2e.byText('button', 'Započni trening')`)), "Start is still offered");
  });

  await step("the workout name is saved when the box is left", async () => {
    await type(ui.workoutName, "Push dan");
    await blur();
    await waitFor(`fetch('${API}/api/workouts?date=${today}').then((r) => r.json()).then((w) => w[0].name === 'Push dan')`, "the saved name");
  });

  await step("workout notes are saved when the box is left", async () => {
    if (ui.showWorkoutNotes) await ui.showWorkoutNotes(browser);
    await waitFor(ui.workoutNotes, "the workout notes box");
    await type(ui.workoutNotes, "Spavao 6 h");
    await blur();
    await sleep(300);
    expect((await workoutOf(today)).notes === "Spavao 6 h", "notes were not saved");
    expect((await workoutOf(today)).name === "Push dan", "saving notes lost the name");
  });

  await step("a new exercise gets a card, and only then the offer to save it to the list", async () => {
    await addExercise("Bench press");
    await waitFor(card("Bench press"), "the Bench press card");
    await waitFor(bodyHas('Spremi "Bench press" na listu vježbi?'), "the save-to-list prompt");
    expect((await workoutOf(today)).exercises.length === 1, "the exercise was not saved");
    const input = await evaluate(`document.querySelector('input[placeholder="Pretraži ili upiši vježbu"]').value`);
    expect(input === "", `the exercise box was not cleared: "${input}"`);
  });

  await step("the exercise can be saved to the list with a muscle group", async () => {
    await evaluate(`(() => {
      const select = __e2e.containing('div', 'na listu vježbi?').at(-1).querySelector('select');
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(select, 'Prsa');
      select.dispatchEvent(new Event('change', { bubbles: true }));
    })()`);
    const saveButton = `__e2e.byText('button', 'Spremi', __e2e.containing('div', 'na listu vježbi?').at(-1))`;
    // "Prošli put" arrives after the exercise and moves the prompt down, so a click computed
    // before it lands above the button (2026-11-20). Click once the button holds still.
    await waitFor(
      `new Promise((resolve) => { const at = () => ${saveButton}?.getBoundingClientRect().top; const top = at(); setTimeout(() => resolve(top !== undefined && at() === top), 400); })`,
      "the prompt to hold still",
    );
    await click(saveButton);
    await waitFor(`!${bodyHas("na listu vježbi?")}`, "the prompt to close");
    const templates = await api("/api/exercise-templates");
    expect(templates.some((t) => t.name === "Bench press" && t.muscleGroup === "Prsa"), "template not saved");
  });

  await step("the same exercise twice is refused, without a save-to-list offer", async () => {
    await addExercise("bench PRESS");
    await waitFor(bodyHas("je već dodana u ovaj trening"), "the already-added message");
    expect(!(await evaluate(bodyHas("na listu vježbi?"))), "the save prompt showed for a refused exercise");
    expect((await workoutOf(today)).exercises.length === 1, "a duplicate exercise was saved");
    if (layout === "new") {
      const pickerOpen = await evaluate(`!!document.querySelector('[class*="_exercisePicker_"]')`);
      expect(!pickerOpen, "the exercise list stayed open over the cards after the refusal");
    }
    await type(`document.querySelector('input[placeholder="Pretraži ili upiši vježbu"]')`, "");
    // Escape closes the list the click into the box opened (the old page had no way but a click).
    await browser.press("Escape", "Escape", 27);
    if (layout === "old") await click(`document.querySelector('h1')`);
    await blur();
    const stillOpen = await evaluate(`!!document.querySelector('[class*="_exercisePicker_"]')`);
    expect(!stillOpen, "the exercise list is still open");
  });

  await step("last time's sets are shown, and one click fills the form from them", async () => {
    await waitFor(`__e2e.byText('button', '90×5 @7', ${card("Bench press")})`, "last time's first set");
    await click(`__e2e.byText('button', '92,5×4 @8', ${card("Bench press")})`);
    const values = await evaluate(`[${ui.weight(card("Bench press"))}.value, ${ui.reps(card("Bench press"))}.value, ${ui.rpe(card("Bench press"))}.value]`);
    expect(values.join("|") === "92,5|4|8", `the form holds ${values.join("|")}`);
  });

  await step("a set is added, shown, saved, and the form is emptied", async () => {
    await addSet("Bench press", "100", "5", "8");
    await waitFor(`__e2e.rows(${card("Bench press")}).length === 1`, "the first set row");
    expectIncludesAll(await rowText("Bench press", 0), ["100", "5", "8"]);
    const sets = (await workoutOf(today)).exercises[0].sets;
    expect(sets.length === 1 && sets[0].weight === 100 && sets[0].reps === 5 && sets[0].rpe === 8, `saved sets: ${JSON.stringify(sets)}`);
    const weight = await evaluate(`${ui.weight(card("Bench press"))}.value`);
    expect(weight === "", `the weight box still holds "${weight}"`);
    await waitFor(bodyHas("Novi PR! Bench press"), "the PR toast");
  });

  await step("a set the server refuses is reported, not shown, and stays in the form", async () => {
    await addSet("Bench press", "100", "pet", "8");
    await waitFor(bodyHas("Ponavljanja moraju biti cijeli broj, 0 ili više."), "the server's message, in Croatian");
    expect((await rowCount("Bench press")) === 1, "a refused set got a row");
    const reps = await evaluate(`${ui.reps(card("Bench press"))}.value`);
    expect(reps === "pet", `the reps box lost what was typed: "${reps}"`);
  });

  await step("the add button is disabled until weight and reps are filled", async () => {
    await type(ui.reps(card("Bench press")), "");
    expect(await evaluate(`${ui.addSetButton("Bench press")}.disabled`), "the button is enabled without reps");
    await type(ui.weight(card("Bench press")), "");
    await type(ui.rpe(card("Bench press")), "");
  });

  await step("the weight stepper adds a kilogram", async () => {
    await type(ui.weight(card("Bench press")), "100");
    await click(ui.stepUp("Bench press"));
    const weight = await evaluate(`${ui.weight(card("Bench press"))}.value`);
    expect(weight === "101", `weight is "${weight}"`);
    await type(ui.weight(card("Bench press")), "");
  });

  await step("a set is duplicated from its sheet, as a plan to tick off", async () => {
    await openSheet("Bench press", 0);
    await click(`__e2e.byText('button', 'Kopiraj dolje', ${dialog})`);
    await waitFor(`!${dialog} && __e2e.rows(${card("Bench press")}).length === 2`, "the second row");
    const sets = (await workoutOf(today)).exercises[0].sets;
    expect(sets.length === 2 && sets[1].isDone === false, `the copy: ${JSON.stringify(sets[1])}`);
  });

  await step("a set is edited in its sheet", async () => {
    await openSheet("Bench press", 1);
    await type(`${dialog}.querySelector('input[inputmode="numeric"]')`, "6");
    await type(`${dialog}.querySelectorAll('input[inputmode="decimal"]')[1]`, "9");
    await click(`__e2e.byText('button', 'Gotovo', ${dialog})`);
    await waitFor(`!${dialog}`, "the sheet to close");
    await waitFor(`${row("Bench press", 1)}.innerText.includes('RPE 9')`, "the edited row");
    expectIncludesAll(await rowText("Bench press", 1), ["100", "6", "9"]);
    const saved = (await workoutOf(today)).exercises[0].sets[1];
    expect(saved.reps === 6 && saved.rpe === 9, `saved set: ${JSON.stringify(saved)}`);
  });

  await step("sets are reordered by dragging, and the order is saved", async () => {
    const before = (await workoutOf(today)).exercises[0].sets.map((set) => set.id);
    await browser.drag(
      ui.setHandle("Bench press", 1),
      `(() => { const box = ${row("Bench press", 0)}.getBoundingClientRect(); return { x: box.left + 40, y: box.top + 2 }; })()`,
    );
    await sleep(400);
    const after = (await workoutOf(today)).exercises[0].sets.map((set) => set.id);
    expect(after.join() === [...before].reverse().join(), `order ${before} became ${after}`);
    expectIncludesAll(await rowText("Bench press", 0), ["100", "6", "9"]);
  });

  await step("a set is deleted from its sheet", async () => {
    await openSheet("Bench press", 0);
    await click(`__e2e.byText('button', 'Obriši set', ${dialog})`);
    await waitFor(`__e2e.rows(${card("Bench press")}).length === 1`, "one row left");
    const sets = (await workoutOf(today)).exercises[0].sets;
    expect(sets.length === 1 && sets[0].reps === 5, `sets left: ${JSON.stringify(sets)}`);
  });

  await step("all of last time's sets are copied in order, as a plan", async () => {
    await click(`__e2e.byText('button', 'Kopiraj sve', ${card("Bench press")})`);
    await waitFor(`__e2e.rows(${card("Bench press")}).length === 3`, "three rows");
    const sets = (await workoutOf(today)).exercises[0].sets;
    expect(sets.map((set) => set.weight).join() === "100,90,92.5", `weights: ${sets.map((set) => set.weight)}`);
    expect(!sets[1].isDone && !sets[2].isDone, "the copies are done");
  });

  await step("a superset letter is saved and marks the card", async () => {
    await type(`${card("Bench press")}.querySelector('input[placeholder="—"]')`, "A");
    await blur();
    await sleep(300);
    expect((await workoutOf(today)).exercises[0].supersetGroup === "A", "superset group not saved");
    expect(await evaluate(`${card("Bench press")}.className.includes('cardGrouped')`), "the card is not marked");
    expect((await rowCount("Bench press")) === 3, "saving the superset lost the sets on screen");
  });

  await step("an exercise note is added from the menu and saved", async () => {
    await click(ui.cardMenu("Bench press"));
    await click(`__e2e.byText('button', 'Dodaj bilješku', ${card("Bench press")})`);
    await waitFor(`${card("Bench press")}.querySelector('textarea')`, "the note box");
    await type(`${card("Bench press")}.querySelector('textarea')`, "Pauza na prsima");
    await blur();
    await sleep(300);
    expect((await workoutOf(today)).exercises[0].notes === "Pauza na prsima", "note not saved");
  });

  await step("a second exercise is added and dragged above the first", async () => {
    await addExercise("Veslanje");
    await waitFor(card("Veslanje"), "the Veslanje card");
    await click(`__e2e.byText('button', 'Ne')`);
    await browser.drag(
      `${card("Veslanje")}.querySelector('[class*="_dragHandle_"]')`,
      `(() => { const box = ${card("Bench press")}.getBoundingClientRect(); return { x: box.left + 60, y: box.top + 4 }; })()`,
    );
    await sleep(400);
    expect((await cardNames()).join() === "Veslanje,Bench press", `cards: ${await cardNames()}`);
    const saved = (await workoutOf(today)).exercises.map((exercise) => exercise.name);
    expect(saved.join() === "Veslanje,Bench press", `saved order: ${saved}`);
  });

  await step("the workout is saved as a template, which can then be loaded", async () => {
    await ui.saveAsTemplate(browser);
    await waitFor(bodyHas("Naziv predloška:"), "the template name prompt");
    await evaluate(`__e2e.containing('div', 'Naziv predloška:').at(-1).querySelector('input').focus()`);
    await browser.send("Input.insertText", { text: "Push A" });
    await click(`__e2e.byText('button', 'Spremi', __e2e.containing('div', 'Naziv predloška:').at(-1))`);
    await waitFor(`__e2e.byText('button', 'Učitaj predložak')`, "the Load template button");
    const templates = await api("/api/workout-templates");
    expect(templates.length === 1 && templates[0].exercises.length === 2, `templates: ${JSON.stringify(templates)}`);
    await click(`__e2e.byText('button', 'Učitaj predložak')`);
    await click(`__e2e.containing('button', 'Push A').at(-1)`);
    await waitFor(`__e2e.cardNames().length === 4`, "four cards after loading the template");
    expect((await workoutOf(today)).exercises.length === 4, "the template's exercises were not saved");
  });

  await step("an exercise is deleted from its menu, after a confirmation", async () => {
    const asked = browser.dialogs.length;
    await click(`__e2e.rows(document.body).length && ${ui.cardMenu("Veslanje")}`);
    await click(`__e2e.byText('button', 'Obriši vježbu', ${card("Veslanje")})`);
    await waitFor(`__e2e.cardNames().length === 3`, "three cards left");
    expect(browser.dialogs.length === asked + 1, "no confirmation was asked");
    expect((await workoutOf(today)).exercises.length === 3, "the exercise was not deleted");
  });

  await step("a program day is loaded into the workout", async () => {
    await click(`__e2e.byText('button', 'Učitaj program')`);
    await waitFor(bodyHas("Čučanj"), "the program preview");
    await click(`__e2e.byText('button', 'Učitaj')`);
    await waitFor(card("Čučanj"), "the Čučanj card");
    expect((await rowCount("Čučanj")) === 3, `Čučanj has ${await rowCount("Čučanj")} rows`);
    const saved = await workoutOf(today);
    expect(saved.programWeek === 1 && saved.programDay === 1, "the program day was not recorded");
    // Lower-cased: the tag may be shown in capitals, and innerText follows what is shown.
    await waitFor(`document.body.innerText.toLowerCase().includes('test program · t1 d1')`, "the program tag");
    expect(!(await evaluate(bodyHas("Za ovaj dan i tjedan nema vježbi"))), "the loader stayed open");
  });

  if (layout === "new") {
    await step("a weight typed with a decimal comma is saved as typed, and Enter adds the set", async () => {
      // The program's sets are a plan; once they are ticked off, the form is back.
      await tickAll("Čučanj");
      await waitFor(ui.weight(card("Čučanj")), "the form after the plan");
      await type(ui.weight(card("Čučanj")), "102,5");
      await type(ui.reps(card("Čučanj")), "3");
      await browser.press("Enter", "Enter", 13);
      await waitFor(`__e2e.rows(${card("Čučanj")}).length === 4`, "the fourth Čučanj row");
      const squat = (await workoutOf(today)).exercises.find((exercise) => exercise.name === "Čučanj");
      expect(squat.sets.at(-1).weight === 102.5, `saved weight: ${squat.sets.at(-1).weight}`);
      expectIncludesAll(await rowText("Čučanj", 3), ["102,5 kg × 3"]);
      const button = await evaluate(`${ui.addSetButton("Čučanj")}.textContent`);
      expect(button === "Dodaj set 5", `the add button says "${button}"`);
    });

    await step("the weight stepper keeps a decimal comma", async () => {
      await type(ui.weight(card("Čučanj")), "102,5");
      await click(ui.stepUp("Čučanj"));
      const weight = await evaluate(`${ui.weight(card("Čučanj"))}.value`);
      expect(weight === "103,5", `weight is "${weight}"`);
      await type(ui.weight(card("Čučanj")), "");
    });

    await step("a set opened in its sheet shows its weight with a comma", async () => {
      await openSheet("Čučanj", 3);
      const weight = await evaluate(`${dialog}.querySelector('input[inputmode="decimal"]').value`);
      expect(weight === "102,5", `the weight box opened with "${weight}"`);
      await browser.press("Escape", "Escape", 27);
      await waitFor(`!${dialog}`, "the sheet to close");
    });

    await step("clicking the label text focuses the field, and presses no button", async () => {
      const before = await evaluate(`${ui.weight(card("Čučanj"))}.value`);
      await click(`${card("Čučanj")}.querySelector('[data-field="weight"] label')`);
      const focused = await evaluate(
        `document.activeElement === ${ui.weight(card("Čučanj"))} && ${ui.weight(card("Čučanj"))}.value === ${JSON.stringify(before)}`,
      );
      expect(focused, "the label did not focus the weight, or changed it");
    });

    // Reps and RPE get − and + only on a phone (as in Kalkulator); on a computer they are boxes.
    const formButton = (label) => `${card("Čučanj")}.querySelector('form button[aria-label=${q(label)}]')`;
    const visible = (label) =>
      evaluate(`(() => { const el = ${formButton(label)}; return !!el && el.getClientRects().length > 0; })()`);
    const valueOf = (field) => evaluate(`${ui[field](card("Čučanj"))}.value`);
    if (phone) {
      await step("on a phone reps and RPE step with − and +: from 5 and 8 when empty, RPE up to 10", async () => {
        await type(ui.reps(card("Čučanj")), "");
        await type(ui.rpe(card("Čučanj")), "");
        await click(formButton("Jedno ponavljanje više"));
        expect((await valueOf("reps")) === "5", `reps from empty: ${await valueOf("reps")}`);
        await click(formButton("Jedno ponavljanje više"));
        await click(formButton("Jedno ponavljanje više"));
        await click(formButton("Jedno ponavljanje manje"));
        expect((await valueOf("reps")) === "6", `reps after + + −: ${await valueOf("reps")}`);
        await click(formButton("RPE više za 0,5"));
        expect((await valueOf("rpe")) === "8", `RPE from empty: ${await valueOf("rpe")}`);
        for (let tap = 0; tap < 5; tap += 1) await click(formButton("RPE više za 0,5"));
        expect((await valueOf("rpe")) === "10", `RPE past its top: ${await valueOf("rpe")}`);
        await click(formButton("RPE manje za 0,5"));
        expect((await valueOf("rpe")) === "9,5", `RPE after −: ${await valueOf("rpe")}`);
        // The stepped values are what the set saves.
        await type(ui.weight(card("Čučanj")), "100");
        await click(ui.addSetButton("Čučanj"));
        await waitFor(`__e2e.rows(${card("Čučanj")}).length === 5`, "the fifth Čučanj row");
        const squat = (await workoutOf(today)).exercises.find((exercise) => exercise.name === "Čučanj");
        const saved = squat.sets.at(-1);
        expect(saved.weight === 100 && saved.reps === 6 && saved.rpe === 9.5, `saved: ${JSON.stringify(saved)}`);
        await browser.screenshot(join(shots, "phone-steppers.png"));
      });
    } else {
      await step("on a computer reps and RPE are plain boxes, without − and +", async () => {
        for (const label of ["Jedno ponavljanje više", "Jedno ponavljanje manje", "RPE više za 0,5", "RPE manje za 0,5"]) {
          expect(!(await visible(label)), `"${label}" shows on a computer`);
        }
        expect(await visible("Više kilograma"), "the weight's + is gone on a computer");
      });
    }
  }

  await step("another day shows its own workout, never this one", async () => {
    await click(ui.dateTrigger);
    const yesterdayDay = Number(yesterday.slice(8));
    const monthChanged = yesterday.slice(5, 7) !== today.slice(5, 7);
    if (monthChanged) await click(`__e2e.byText('button', '‹')`);
    await click(`[...document.querySelectorAll('[class*="_dayCell"]')].find((cell) => cell.textContent.trim() === '${yesterdayDay}')`);
    await waitFor(`${ui.workoutName} && ${ui.workoutName}.value === 'Jučer'`, "yesterday's workout name");
    expect((await cardNames()).join() === "Bench press", `yesterday's cards: ${await cardNames()}`);
    expect((await rowCount("Bench press")) === 2, "yesterday's sets");
  });

  await step("coming back shows today's workout again", async () => {
    await click(ui.dateTrigger);
    const monthChanged = yesterday.slice(5, 7) !== today.slice(5, 7);
    if (monthChanged) await click(`__e2e.byText('button', '›')`);
    await click(`[...document.querySelectorAll('[class*="_dayCell"]')].find((cell) => cell.textContent.trim() === '${Number(today.slice(8))}')`);
    await waitFor(`${ui.workoutName} && ${ui.workoutName}.value === 'Push dan'`, "today's workout name");
    expect((await cardNames()).length === 4, `today's cards: ${await cardNames()}`);
  });

  await browser.screenshot(join(shots, "final-workout.png"));

  await step("the workout is deleted after a confirmation, and the day is empty again", async () => {
    const asked = browser.dialogs.length;
    await ui.deleteWorkout(browser);
    await waitFor(`__e2e.byText('button', 'Započni trening')`, "the Start workout button");
    expect(browser.dialogs.length === asked + 1, "no confirmation was asked");
    expect((await workoutOf(today)) === null, "the workout is still in the database");
  });

  await step("the page made no errors of its own", async () => {
    // The two refusals above are logged on purpose (reportError); anything else is a defect.
    const unexpected = browser.problems.filter(
      (problem) =>
        !problem.includes("Reps must be a whole number") &&
        !problem.includes("400 (Bad Request)"),
    );
    expect(unexpected.length === 0, unexpected.join(" || "));
  });
} finally {
  console.log(results.join("\n"));
  const failed = results.filter((line) => line.startsWith("FAIL")).length;
  console.log(`\n${results.length - failed} passed, ${failed} failed (${layout} layout${phone ? ", phone" : ""})`);
  browser.close();
}
