// End-to-end run of Programi (the editor set by set) against the test backend (throwaway database).
// On a phone a set opens its sheet; on a computer (from 900px) each set is a row of boxes.
// Usage: node e2e-programs.mjs [--phone]
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { mkdirSync } from "node:fs";
import { launch } from "./cdp.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const phone = process.argv.includes("--phone");
const shots = join(here, "shots", `e2e-programs${phone ? "-phone" : ""}`);
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

// A clean slate, and one past set so Bench press has an e1RM: 100 × 5 @ 8 is 120 by Brzycki.
for (const program of await api("/api/programs")) await api(`/api/programs/${program.id}`, "DELETE");
for (const workout of await api("/api/workouts?limit=1000")) await api(`/api/workouts/${workout.id}`, "DELETE");
await api("/api/settings", "PUT", { language: "hr", theme: "auto", template: "moderna", e1rmFormula: "brzycki" });
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
  port: 9348,
  profile: join(here, "chrome-profile-e2e-programs"),
  width: phone ? 390 : 1280,
  height: phone ? 844 : 900,
  mobile: phone,
});
const { evaluate, waitFor, click, type } = browser;

const q = (text) => JSON.stringify(text);
const byLabel = (label, root = "document") =>
  `[...${root}.querySelectorAll('label')].find((l) => l.textContent === ${q(label)}).control`;
const daySection = (number) =>
  `[...document.querySelectorAll('section')].find((s) => s.querySelector('h2')?.textContent === 'Dan ${number}')`;
// A day's name is typed beside "Dan N", in a box "+ Naziv" opens (2026-11-20, the user's pick A).
const dayNameBox = (number) => `${daySection(number)}.querySelector('input[aria-label="Naziv dana ${number}"]')`;
async function nameDay(number, name) {
  await click(`__e2e.byText('button', 'Naziv', ${daySection(number)})`);
  await waitFor(`document.activeElement === ${dayNameBox(number)}`, `day ${number}'s name box, focused`);
  await type(dayNameBox(number), name);
  await browser.blur();
}
// An exercise of a day: the list item holding its name box.
const exercise = (day, index) =>
  `[...${daySection(day)}.querySelectorAll('li')].filter((li) => li.querySelector(':scope > div input[aria-label="Vježba"]'))[${index}]`;
const nameBox = (day, index) => `${exercise(day, index)}.querySelector('input[aria-label="Vježba"]')`;
const button = (text, root = "document") => `__e2e.byText('button', ${q(text)}, ${root})`;
const dialog = `document.querySelector('[role="dialog"]')`;
const isInvalid = (element) => evaluate(`${element}.className.includes('_invalid_')`);
const programCard = (name) =>
  `[...document.querySelectorAll('li')].find((li) => li.querySelector('h2')?.textContent === ${q(name)})`;
const textOf = (expression) => evaluate(`(${expression})?.innerText.replace(/\\s+/g, ' ').trim()`);
const bodyHas = (text) => `document.body.innerText.includes(${q(text)})`;

// Phone: the set rows that open a sheet.
const setRows = (day, index) => `[...${exercise(day, index)}.querySelectorAll('[class*="_setRow_"]')]`;
const rowTexts = (day, index) =>
  evaluate(`${setRows(day, index)}.map((row) => row.innerText.replace(/\\s+/g, ' ').trim()).join(' | ')`);
// Computer: a set's boxes, by the set's number.
const cell = (day, index, set, what) =>
  `${exercise(day, index)}.querySelector('input[aria-label="Set ${set}: ${what}"]')`;
const modeButton = (day, index, set, text) =>
  `${button(text, `${exercise(day, index)}.querySelector('[aria-label="Set ${set}: RPE, postotak ili back-off"]')`)}`;
const valueOf = (expression) => evaluate(`${expression}.value`);
const placeholderOf = (expression) => evaluate(`${expression}.placeholder`);
const wideRowCount = (day, index) =>
  evaluate(`${exercise(day, index)}.querySelectorAll('input[aria-label$=": ponavljanja"]').length`);
const dropTexts = (day, index) =>
  evaluate(`[...${exercise(day, index)}.querySelectorAll('[role="row"]')].map((r) => r.innerText.trim()).filter((t) => t.startsWith('D')).map((t) => t.replace(/\\s+/g, ' ')).join(' | ')`);

async function step(name, run) {
  try {
    await run();
    results.push(`PASS  ${name}`);
  } catch (err) {
    results.push(`FAIL  ${name}\n        ${String(err.message).split("\n")[0]}`);
    await browser.screenshot(join(shots, `FAIL-${results.length}.png`)).catch(() => {});
  }
}

// Phone: opens a set's sheet, lets `edit` change it, and closes it with Gotovo.
async function editSet(day, index, setIndex, edit) {
  await click(`${setRows(day, index)}[${setIndex}]`);
  await waitFor(dialog, "the set sheet");
  await edit();
  await click(button("Gotovo", dialog));
  await waitFor(`!${dialog}`, "the sheet to close");
}

try {
  await browser.navigate(`${APP}/programs`);
  await waitFor(bodyHas("Još nema programa."), "the empty list", 15000);

  await step("a new program opens the editor, with the way back", async () => {
    await click(button("Novi program"));
    await waitFor(`document.querySelector('h1')?.textContent === 'Novi program'`, "the editor");
    expect(await evaluate(`!!${button("Programi")}`), "no way back to the list");
    expect(await evaluate(bodyHas("U Tjednu 1 nema setova")), "no empty-week line");
  });

  await step("saving without a name and exercise marks what is missing", async () => {
    await click(button("Spremi"));
    await waitFor(bodyHas("Ispravi označena polja"), "the message");
    expect(await isInvalid(byLabel("Naziv")), "the name is not marked");
    expect(await isInvalid(nameBox(1, 0)), "the exercise is not marked");
  });

  await step("a day's name goes beside Dan 1 after + Naziv, and an empty one goes back", async () => {
    expect(await evaluate(`!${dayNameBox(1)}`), "a day without a name shows a name box");
    await click(`__e2e.byText('button', 'Naziv', ${daySection(1)})`);
    await waitFor(`document.activeElement === ${dayNameBox(1)}`, "the name box, focused");
    await browser.blur();
    await waitFor(`!${dayNameBox(1)} && !!__e2e.byText('button', 'Naziv', ${daySection(1)})`, "+ Naziv back after an empty name");
    await nameDay(1, "Čučanj dan");
    expect((await valueOf(dayNameBox(1))) === "Čučanj dan", "the name is not beside Dan 1");
    expect(await evaluate(`!__e2e.byText('button', 'Naziv', ${daySection(1)})`), "+ Naziv stayed beside a name");
  });

  await step("Dodaj set starts at 8 reps and RPE 8, with no weight while there is no e1RM", async () => {
    await type(byLabel("Naziv"), "Test 5/3/1");
    await type(byLabel("Tjedana"), "3");
    await waitFor(`document.querySelectorAll('[aria-label="Tjedan koji uređuješ"] button').length === 3`, "three weeks");
    await type(byLabel("Trening max (% e1RM)"), "92,5");
    await type(nameBox(1, 0), "Čučanj");
    await click(button("Dodaj set", exercise(1, 0)));
    if (phone) {
      expect((await rowTexts(1, 0)) === "1 8 ponavljanja RPE 8", `first set: ${await rowTexts(1, 0)}`);
    } else {
      const shown = [await valueOf(cell(1, 0, 1, "ponavljanja")), await valueOf(cell(1, 0, 1, "RPE")), await placeholderOf(cell(1, 0, 1, "kilaža"))];
      expect(shown.join("|") === "8|8|—", `first set: ${shown.join("|")}`);
    }
  });

  await step("switching RPE to % carries the number over by the chart, then a percentage is typed", async () => {
    if (phone) {
      await editSet(1, 0, 0, async () => {
        await type(byLabel("Ponavljanja", dialog), "5");
        await click(button("% TM", dialog));
        // 5 @ RPE 8 is 81.1 % of the 1RM, 87.5 % of a training max of 92.5 %.
        const converted = await evaluate(`${byLabel("Postotak (%)", dialog)}.value`);
        expect(converted === "87,5", `converted to ${converted}`);
        await type(byLabel("Postotak (%)", dialog), "75");
      });
      await click(button("Dodaj set", exercise(1, 0)));
      await click(button("Dodaj set", exercise(1, 0)));
      await editSet(1, 0, 2, async () => {
        await type(byLabel("Postotak (%)", dialog), "85");
      });
      const rows = await rowTexts(1, 0);
      expect(rows === "1 75 % × 5 | 2 75 % × 5 | 3 85 % × 5", `rows: ${rows}`);
    } else {
      await type(cell(1, 0, 1, "ponavljanja"), "5");
      await click(modeButton(1, 0, 1, "%"));
      const converted = await valueOf(cell(1, 0, 1, "postotak"));
      expect(converted === "87,5", `converted to ${converted}`);
      await type(cell(1, 0, 1, "postotak"), "75");
      await click(button("Dodaj set", exercise(1, 0)));
      await click(button("Dodaj set", exercise(1, 0)));
      await type(cell(1, 0, 3, "postotak"), "85");
      const values = [];
      for (const set of [1, 2, 3]) values.push(`${await valueOf(cell(1, 0, set, "ponavljanja"))}@${await valueOf(cell(1, 0, set, "postotak"))}`);
      expect(values.join(" ") === "5@75 5@75 5@85", `sets: ${values.join(" ")}`);
    }
  });

  await step("a week is copied to the others, and each week keeps its own sets", async () => {
    await click(`${exercise(1, 0)}.querySelector('button[aria-label="Kopiraj Tjedan 1 u ostale tjedne"]')`);
    expect(await evaluate(bodyHas("Tjedan 1 kopiran u sve ostale tjedne.")), "no note");
    await click(button("Tjedan 3"));
    await waitFor(`${button("Tjedan 3")}.getAttribute('aria-pressed') === 'true'`, "week 3");
    if (phone) {
      await editSet(1, 0, 0, async () => {
        await click(`${dialog}.querySelector('button[aria-label="Jedno ponavljanje manje"]')`);
        await click(`${dialog}.querySelector('button[aria-label="Jedno ponavljanje manje"]')`);
      });
      expect((await rowTexts(1, 0)).startsWith("1 75 % × 3 |"), `week 3: ${await rowTexts(1, 0)}`);
      await click(button("Tjedan 1"));
      expect((await rowTexts(1, 0)).startsWith("1 75 % × 5 |"), `week 1 changed: ${await rowTexts(1, 0)}`);
    } else {
      await type(cell(1, 0, 1, "ponavljanja"), "3");
      await click(button("Tjedan 1"));
      await waitFor(`${button("Tjedan 1")}.getAttribute('aria-pressed') === 'true'`, "week 1");
      const reps = await valueOf(cell(1, 0, 1, "ponavljanja"));
      expect(reps === "5", `week 1 changed: ${reps}`);
    }
  });

  await step("an RPE set's weight comes from the e1RM by the chart, and drop sets follow it", async () => {
    await click(button("Dodaj vježbu", daySection(1)));
    await type(nameBox(1, 1), "Bench press");
    await waitFor(bodyHas("e1RM 120 kg"), "Bench press's e1RM");
    await click(button("Dodaj set", exercise(1, 1)));
    if (phone) {
      // 8 @ RPE 8 is 73.9 % of 120: 88.7, rounded to 87.5.
      expect((await rowTexts(1, 1)) === "1 ≈ 87,5 kg × 8 RPE 8", `first: ${await rowTexts(1, 1)}`);
      await editSet(1, 1, 0, async () => {
        await click(`${dialog}.querySelector('button[aria-label="RPE manje za 0,5"]')`);
        await click(`${dialog}.querySelector('button[aria-label="RPE manje za 0,5"]')`);
        const placeholder = await evaluate(`${byLabel("Kilaža (kg)", dialog)}.placeholder`);
        expect(placeholder === "≈ 85", `weight from the e1RM: ${placeholder}`);
      });
      await click(`${setRows(1, 1)}[0]`);
      await waitFor(dialog, "the set sheet");
      await click(button("Kopiraj dolje", dialog));
      await waitFor(`!${dialog} && ${setRows(1, 1)}.length === 2`, "the copied set");
      await editSet(1, 1, 1, async () => {
        await type(byLabel("RPE", dialog), "4");
        await click(`${dialog}.querySelector('button[aria-label="+ 2 dropa"]')`);
      });
      const rows = await rowTexts(1, 1);
      // 8 @ RPE 4 is 14 reps to failure, 62.6 %: 75 kg.
      expect(rows === "1 ≈ 85 kg × 8 RPE 7 | 2 ≈ 75 kg × 8 RPE 4 + 2 dropa", `rows: ${rows}`);
    } else {
      expect((await placeholderOf(cell(1, 1, 1, "kilaža"))) === "≈ 87,5", `first: ${await placeholderOf(cell(1, 1, 1, "kilaža"))}`);
      await type(cell(1, 1, 1, "RPE"), "11");
      expect((await evaluate(`${cell(1, 1, 1, "RPE")}.getAttribute('aria-invalid')`)) === "true", "RPE 11 is not marked");
      await type(cell(1, 1, 1, "RPE"), "7");
      expect((await placeholderOf(cell(1, 1, 1, "kilaža"))) === "≈ 85", `after RPE 7: ${await placeholderOf(cell(1, 1, 1, "kilaža"))}`);
      await click(`${exercise(1, 1)}.querySelector('button[aria-label="Kopiraj set 1 dolje"]')`);
      await waitFor(`${exercise(1, 1)}.querySelectorAll('input[aria-label$=": ponavljanja"]').length === 2`, "the copied set");
      await type(cell(1, 1, 2, "RPE"), "4");
      await click(button("Drop set", exercise(1, 1)));
      await click(button("Drop set", exercise(1, 1)));
      const drops = await dropTexts(1, 1);
      expect(drops === "D Drop set: 60 kg, bez odmora | D Drop set: 47,5 kg, bez odmora", `drops: ${drops}`);
      await click(`${exercise(1, 1)}.querySelector('button[aria-label="Ukloni drop set iza seta 2"]')`);
      await click(button("Drop set", exercise(1, 1)));
    }
  });

  await step("two exercises are linked into a superset, A1 and A2", async () => {
    await click(button("Spoji u superset", exercise(1, 0)));
    await waitFor(button("Superset A · razdvoji", exercise(1, 0)), "the linked button");
    const badges = await evaluate(
      `[...${daySection(1)}.querySelectorAll('[class*="_supersetBadge_"]')].map((b) => b.textContent).join()`,
    );
    expect(badges === "A1,A2", `badges: ${badges}`);
  });

  await step("a weight typed for an exercise without an e1RM, on a second day", async () => {
    await click(button("Dodaj dan"));
    await waitFor(daySection(2), "day 2");
    await nameDay(2, "Mrtvo");
    await type(nameBox(2, 0), "Mrtvo dizanje");
    await click(button("Dodaj set", exercise(2, 0)));
    if (phone) {
      await click(`${setRows(2, 0)}[0]`);
      await waitFor(dialog, "the set sheet");
      expect((await evaluate(`${byLabel("Kilaža (kg)", dialog)}.placeholder`)) === "—", "a weight shows without an e1RM");
      expect(await evaluate(bodyHas("još nema e1RM")), "no word about the missing e1RM");
      await type(byLabel("Kilaža (kg)", dialog), "140");
      await type(byLabel("Ponavljanja", dialog), "3");
      await click(button("Gotovo", dialog));
      await waitFor(`!${dialog}`, "the sheet to close");
      expect((await rowTexts(2, 0)) === "1 140 kg × 3 RPE 8", `rows: ${await rowTexts(2, 0)}`);
    } else {
      expect((await placeholderOf(cell(2, 0, 1, "kilaža"))) === "—", "a weight shows without an e1RM");
      await type(cell(2, 0, 1, "kilaža"), "140");
      await type(cell(2, 0, 1, "ponavljanja"), "3");
      expect((await wideRowCount(2, 0)) === 1, "the set count changed");
    }
  });

  await step("the program is saved with its sets, intensities, drop sets and superset", async () => {
    await click(button("Spremi"));
    await waitFor(programCard("Test 5/3/1"), "the program card");
    expect(await evaluate(bodyHas("Program spremljen")), "no toast");
    const card = await textOf(programCard("Test 5/3/1"));
    expect(card.includes("3 tjedna · 2 dana · TM 92,5 %"), `card: ${card}`);
    const [saved] = await api("/api/programs");
    expect(saved.trainingMaxPercent === 92.5 && saved.weeks === 3, `saved: ${saved.trainingMaxPercent}, ${saved.weeks}`);
    const [squat, bench] = saved.days[0].exercises;
    expect(
      squat.weekSchemes.join(" | ") === "2x5@75%, 1x5@85% | 2x5@75%, 1x5@85% | 1x3@75%, 1x5@75%, 1x5@85%",
      `squat: ${squat.weekSchemes.join(" | ")}`,
    );
    expect(bench.weekSchemes.join(" | ") === "1x8 rpe7, 1x8 rpe4 drop2 |  | ", `bench: ${bench.weekSchemes.join(" | ")}`);
    expect(squat.supersetGroup === "A" && bench.supersetGroup === "A", "the superset was not saved");
    expect(saved.days[1].exercises[0].weekSchemes[0] === "1x3@140kg rpe8", `deadlift: ${saved.days[1].exercises[0].weekSchemes[0]}`);
    const names = saved.days.map((day) => day.name).join();
    expect(names === "Čučanj dan,Mrtvo", `day names: ${names}`);
  });

  await step("editing shows the saved sets; removing an exercise ends its superset", async () => {
    await click(button("Uredi", programCard("Test 5/3/1")));
    await waitFor(`document.querySelector('h1')?.textContent === 'Uredi program'`, "the editor");
    expect((await evaluate(`${byLabel("Trening max (% e1RM)")}.value`)) === "92,5", "the training max");
    expect((await valueOf(dayNameBox(1))) === "Čučanj dan", "the saved name is not beside Dan 1");
    if (phone) {
      expect((await rowTexts(1, 0)) === "1 75 % × 5 | 2 75 % × 5 | 3 85 % × 5", `squat: ${await rowTexts(1, 0)}`);
    } else {
      const shown = [await valueOf(cell(1, 0, 1, "postotak")), await valueOf(cell(1, 0, 3, "postotak"))];
      expect(shown.join() === "75,85", `squat: ${shown.join()}`);
    }
    await click(`${exercise(1, 1)}.querySelector('button[aria-label="Ukloni vježbu"]')`);
    expect(!(await evaluate(`!!${daySection(1)}.querySelector('[class*="_supersetBadge_"]')`)), "a superset of one is left");
    await click(button("Spremi"));
    await waitFor(programCard("Test 5/3/1"), "the list again");
    const [saved] = await api("/api/programs");
    expect(saved.days[0].exercises.length === 1, `${saved.days[0].exercises.length} exercises on day 1`);
    expect(saved.days[0].exercises[0].supersetGroup === null, "the superset letter stayed");
  });

  await step("the way back leaves the program as it was", async () => {
    await click(button("Uredi", programCard("Test 5/3/1")));
    await waitFor(byLabel("Naziv"), "the editor");
    await type(byLabel("Naziv"), "Promijenjeno");
    await click(button("Programi"));
    await waitFor(programCard("Test 5/3/1"), "the list with the old name");
    expect((await api("/api/programs"))[0].name === "Test 5/3/1", "the name changed");
  });

  await step("a program is deleted after a confirmation", async () => {
    const asked = browser.dialogs.length;
    await click(button("Obriši", programCard("Test 5/3/1")));
    await waitFor(bodyHas("Još nema programa."), "the empty list");
    expect(browser.dialogs.length === asked + 1, "no confirmation was asked");
    expect((await api("/api/programs")).length === 0, "the program is still saved");
  });

  await step("the page made no errors of its own", async () => {
    const ours = browser.problems.filter((problem) => !problem.includes("chrome-extension://"));
    expect(ours.length === 0, ours.join(" || "));
  });

  await browser.screenshot(join(shots, "end.png"));
} finally {
  console.log(results.join("\n"));
  const failed = results.filter((line) => line.startsWith("FAIL")).length;
  console.log(`\n${results.length - failed} passed, ${failed} failed (programs${phone ? ", phone" : ""})`);
  await browser.close();
}
