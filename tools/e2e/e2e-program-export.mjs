// End-to-end run of Programi's "Izvezi u Excel" against the test backend (throwaway database):
// the button downloads "<program>.xlsx", and the file holds the program with its weights worked
// out from the e1RM. The file is read back with the frontend's own ExcelJS (npm install in
// frontend first).
// Usage: node e2e-program-export.mjs [--phone]
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import ExcelJS from "../../frontend/node_modules/exceljs/excel.js";
import { launch, sleep } from "./cdp.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const phone = process.argv.includes("--phone");
const shots = join(here, "shots", `e2e-program-export${phone ? "-phone" : ""}`);
const downloads = join(here, `downloads-export${phone ? "-phone" : ""}`);
rmSync(downloads, { recursive: true, force: true });
mkdirSync(shots, { recursive: true });
mkdirSync(downloads, { recursive: true });
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

// A clean slate; Bench press 100 × 5 @ 8 gives an e1RM of 120 by Brzycki, Čučanj has none.
for (const program of await api("/api/programs")) await api(`/api/programs/${program.id}`, "DELETE");
for (const workout of await api("/api/workouts?limit=1000")) await api(`/api/workouts/${workout.id}`, "DELETE");
await api("/api/settings", "PUT", { language: "hr", theme: "auto", template: "moderna", e1rmFormula: "brzycki" });
{
  const past = await api("/api/workouts", "POST", { date: "2026-11-01", name: "Prije" });
  const bench = await api(`/api/workouts/${past.id}/exercises`, "POST", { name: "Bench press" });
  await api(`/api/workouts/exercises/${bench.id}/sets`, "POST", { weight: 100, reps: 5, rpe: 8 });
}
await api("/api/programs", "POST", {
  name: "Export test",
  weeks: 2,
  trainingMaxPercent: 100,
  days: [
    {
      name: "Gornji",
      exercises: [
        { name: "Bench press", weekSchemes: ["1x5 rpe7, 1x5 rpe8 drop1", "2x5@80%"], supersetGroup: "A" },
        { name: "Zgibovi", weekSchemes: ["3x8", "3x8"], supersetGroup: "A" },
      ],
    },
    { name: "", exercises: [{ name: "Čučanj", weekSchemes: ["3x5 rpe8", "3x5"] }] },
  ],
});

const results = [];
function expect(condition, message) {
  if (!condition) throw new Error(message);
}
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const browser = await launch({
  port: 9351,
  profile: join(here, "chrome-profile-e2e-export"),
  width: phone ? 390 : 1280,
  height: phone ? 844 : 900,
  mobile: phone,
});
const { evaluate, waitFor, click, send } = browser;
const q = (text) => JSON.stringify(text);
const programCard = (name) =>
  `[...document.querySelectorAll('li')].find((li) => li.querySelector('h2')?.textContent === ${q(name)})`;
const exportButton = (name) => `__e2e.byText('button', 'Izvezi u Excel', ${programCard(name)})`;

async function step(name, run) {
  try {
    await run();
    results.push(`PASS  ${name}`);
  } catch (err) {
    results.push(`FAIL  ${name}\n        ${String(err.message).split("\n")[0]}`);
    await browser.screenshot(join(shots, `FAIL-${results.length}.png`)).catch(() => {});
  }
}

let workbook;
try {
  await send("Page.setDownloadBehavior", { behavior: "allow", downloadPath: downloads });
  await browser.navigate(`${APP}/programs`);
  await waitFor(`!!${programCard("Export test")}`, "the program's card", 15000);
  await browser.screenshot(join(shots, "programi.png"));

  await step("each program has Izvezi u Excel under its days", async () => {
    expect(await evaluate(`!!${exportButton("Export test")}`), "no export button in the card");
  });

  await step("Izvezi u Excel downloads Export test.xlsx", async () => {
    await click(exportButton("Export test"));
    const file = join(downloads, "Export test.xlsx");
    for (let waited = 0; waited < 20000 && !existsSync(file); waited += 200) await sleep(200);
    expect(existsSync(file), `no file; the folder has: ${readdirSync(downloads).join(", ") || "nothing"}`);
    await sleep(300);
    workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(file);
    await waitFor(`!!${exportButton("Export test")}`, "the button back to Izvezi u Excel");
  });

  const sheet = (name) => workbook.getWorksheet(name);
  const row = (name, address, count) => {
    const start = sheet(name).getCell(address);
    return Array.from({ length: count }, (_, offset) => {
      const value = sheet(name).getCell(start.row, start.col + offset).value;
      return value && typeof value === "object" && "formula" in value ? `=${value.formula}` : value;
    });
  };

  await step("the file has Pregled and a sheet per week", async () => {
    const names = workbook.worksheets.map((s) => s.name);
    expect(same(names, ["Pregled", "Tjedan 1", "Tjedan 2"]), `sheets: ${names.join(", ")}`);
    expect(sheet("Pregled").getCell("B1").value === "Export test", "no program name on Pregled");
    const lines = String(sheet("Pregled").getCell("C7").value).replace(/\s/g, " ");
    expect(
      lines === "• 5 × RPE 7 · 79 % · 95 kg • 5 × RPE 8 · 81 % · 97,5 kg · + 1 drop",
      `Bench press lines: ${lines}`,
    );
  });

  await step("Tjedan 1 has the sets with their weights from the e1RM, and the drop set", async () => {
    const title = sheet("Tjedan 1").getCell("B6").value;
    expect(title === "A1 · Bench press", `the first exercise is ${title}`);
    expect(same(row("Tjedan 1", "B7", 2), ["e1RM", 120]), `e1RM row: ${row("Tjedan 1", "B7", 2)}`);
    expect(same(row("Tjedan 1", "B9", 4), [1, 95, 5, 7]), `set 1: ${row("Tjedan 1", "B9", 4)}`);
    expect(same(row("Tjedan 1", "B10", 4), [2, 97.5, 5, 8]), `set 2: ${row("Tjedan 1", "B10", 4)}`);
    expect(same(row("Tjedan 1", "B11", 4), ["D", 77.5, 5, null]), `drop: ${row("Tjedan 1", "B11", 4)}`);
    const share = row("Tjedan 1", "F9", 1)[0];
    expect(share === '=IF(AND(ISNUMBER(C9),N($C$7)>0),C9/$C$7,"")', `% 1RM: ${share}`);
  });

  await step("an exercise without an e1RM has no weights", async () => {
    // Day 2 comes after day 1's tables: find its bar, then Čučanj's table under it.
    const bar = sheet("Tjedan 1").getColumn(2).values.findIndex((value) => value === "DAN 2");
    expect(bar > 0, "no DAN 2 bar");
    expect(sheet("Tjedan 1").getCell(`B${bar + 2}`).value === "Čučanj", "no Čučanj under DAN 2");
    expect(sheet("Tjedan 1").getCell(`C${bar + 3}`).value === "–", "Čučanj shows an e1RM");
    const first = row("Tjedan 1", `B${bar + 5}`, 4);
    expect(same(first, [1, null, 5, 8]), `Čučanj set 1: ${first}`);
  });

  await step("Tjedan 2 works the percentage of the training max out", async () => {
    expect(same(row("Tjedan 2", "B9", 4), [1, 95, 5, null]), `set 1: ${row("Tjedan 2", "B9", 4)}`);
    expect(same(row("Tjedan 2", "B10", 4), [2, 95, 5, null]), `set 2: ${row("Tjedan 2", "B10", 4)}`);
  });

  await step("no errors in the console", async () => {
    expect(browser.problems.length === 0, browser.problems.join(" | "));
  });
} finally {
  await browser.close();
}

console.log(`e2e-program-export${phone ? " --phone" : ""}`);
for (const line of results) console.log(line);
const failed = results.filter((line) => line.startsWith("FAIL")).length;
// The line run-all-e2e.mjs reads.
console.log(`\n${results.length - failed} passed, ${failed} failed`);
process.exitCode = failed ? 1 : 0;
