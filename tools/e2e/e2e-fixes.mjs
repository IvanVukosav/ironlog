// The small fixes of 2026-11-16: the day in the address, toasts on a phone, English names for
// muscle groups and Croatian server errors. Usage: node e2e-fixes.mjs
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { mkdirSync } from "node:fs";
import { launch, sleep } from "./cdp.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const shots = join(here, "shots", "e2e-fixes");
mkdirSync(shots, { recursive: true });
const APP = process.env.E2E_APP ?? "http://localhost:5199";
const API = "http://localhost:3002";
const pad = (value) => String(value).padStart(2, "0");
const key = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const now = new Date();
const today = key(now);
const yesterday = key(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1));

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
const expect = (condition, message) => {
  if (!condition) throw new Error(message);
};
async function step(browser, name, run) {
  try {
    await run();
    results.push(`PASS  ${name}`);
  } catch (err) {
    results.push(`FAIL  ${name}\n        ${String(err.message).split("\n")[0]}`);
    await browser.screenshot(join(shots, `FAIL-${results.length}.png`), false).catch(() => {});
  }
}

for (const workout of await api("/api/workouts?limit=1000")) await api(`/api/workouts/${workout.id}`, "DELETE");
for (const program of await api("/api/programs")) await api(`/api/programs/${program.id}`, "DELETE");
for (const template of await api("/api/exercise-templates")) await api(`/api/exercise-templates/${template.id}`, "DELETE");
await api("/api/settings", "PUT", { language: "hr", theme: "auto", template: "moderna" });
const old = await api("/api/workouts", "POST", { date: yesterday, name: "Jučerašnji" });
const squat = await api(`/api/workouts/${old.id}/exercises`, "POST", { name: "Čučanj" });
await api(`/api/workouts/exercises/${squat.id}/sets`, "POST", { weight: 100, reps: 5 });
await api("/api/exercise-templates", "POST", { name: "Čučanj", muscleGroup: "Kvadriceps" });

// ---------- desktop: the day in the address ----------
let browser = await launch({ port: 9359, profile: join(here, "chrome-profile-e2e-fixes"), width: 1280, height: 1000 });
const nameBox = `document.querySelector('input[aria-label="Naziv treninga"]')`;
try {
  await step(browser, "a day in the address opens that day, and the back button follows day changes", async () => {
    await browser.navigate(`${APP}/log?date=${yesterday}`);
    await browser.waitFor(`${nameBox} && ${nameBox}.value === 'Jučerašnji'`, "yesterday's workout", 15000);
    await browser.click(`document.querySelector('[class*="_triggerText_"]')`);
    const monthChanged = yesterday.slice(5, 7) !== today.slice(5, 7);
    if (monthChanged) await browser.click(`__e2e.byText('button', '›')`);
    await browser.click(`[...document.querySelectorAll('[class*="_dayCell"]')].find((cell) => cell.textContent.trim() === '${Number(today.slice(8))}')`);
    await browser.waitFor(`!${nameBox} || ${nameBox}.value !== 'Jučerašnji'`, "today");
    expect((await browser.evaluate("location.search")) === "", `today's address: ${await browser.evaluate("location.search")}`);
    await browser.evaluate("history.back()");
    await browser.waitFor(`${nameBox} && ${nameBox}.value === 'Jučerašnji'`, "yesterday again after Back");
    expect((await browser.evaluate("location.search")) === `?date=${yesterday}`, "the address lost the day");
  });

  await step(browser, "a day that doesn't exist in the address shows today", async () => {
    await browser.navigate(`${APP}/log?date=2026-02-30`);
    await browser.waitFor(`document.body.innerText.includes('Za ovaj dan još nema treninga') || ${nameBox}`, "the page", 15000);
    expect(!(await browser.evaluate(`document.body.innerText.includes('Request failed')`)), "an error for the bad day");
    expect(browser.problems.filter((problem) => !problem.includes("chrome-extension://")).length === 0, browser.problems.join(" | "));
  });
} finally {
  await browser.close();
}

// ---------- phone: toasts at the bottom, in Croatian ----------
browser = await launch({ port: 9360, profile: join(here, "chrome-profile-e2e-fixes-phone"), width: 390, height: 844, mobile: true });
try {
  await step(browser, "on a phone a server error comes up at the bottom, in Croatian, with a big close button", async () => {
    await api("/api/workouts", "POST", { date: today, name: "Danas" });
    const workout = (await api(`/api/workouts?date=${today}`))[0];
    await api(`/api/workouts/${workout.id}/exercises`, "POST", { name: "Bench press" });
    await browser.navigate(`${APP}/log`);
    const card = `__e2e.card('Bench press')`;
    await browser.waitFor(card, "the card", 15000);
    await browser.type(`${card}.querySelector('[data-field="weight"] input')`, "100");
    await browser.type(`${card}.querySelector('[data-field="reps"] input')`, "pet");
    await browser.click(`${card}.querySelector('button[data-action="add-set"]')`);
    const toast = `document.querySelector('[role="alert"]')`;
    await browser.waitFor(toast, "the error toast");
    const text = await browser.evaluate(`${toast}.innerText.trim()`);
    expect(text === "Ponavljanja moraju biti cijeli broj, 0 ili više.", `toast: ${text}`);
    const box = await browser.evaluate(`(() => { const r = ${toast}.getBoundingClientRect(); return { top: r.top, bottom: r.bottom }; })()`);
    expect(box.top > 600, `the toast is at y ${box.top}`);
    const close = await browser.evaluate(`(() => { const r = ${toast}.querySelector('button[aria-label="Zatvori obavijest"]').getBoundingClientRect(); return { w: r.width, h: r.height }; })()`);
    expect(close.w >= 44 && close.h >= 44, `close button ${close.w}×${close.h}`);
    await browser.evaluate("window.scrollTo(0, 0)");
    await browser.click(`document.querySelector('button[aria-label="Opcije treninga"]')`);
    await browser.waitFor(`__e2e.byText('button', 'Obriši trening')`, "the workout menu opened while the toast shows");
    await browser.screenshot(join(shots, "phone-toast.png"), false);
  });

  await step(browser, "on a phone a message shows at the top while a sheet is open at the bottom", async () => {
    const card = `__e2e.card('Bench press')`;
    await browser.press("Escape", "Escape", 27);
    await browser.type(`${card}.querySelector('[data-field="weight"] input')`, "100");
    await browser.type(`${card}.querySelector('[data-field="reps"] input')`, "5");
    await browser.click(`${card}.querySelector('button[data-action="add-set"]')`);
    await browser.waitFor(`__e2e.rows(${card}).length === 1`, "the set");
    await browser.click(`__e2e.rows(${card})[0].querySelector('[class*="_setButton_"]')`);
    await browser.waitFor(`document.querySelector('[role="dialog"]')`, "the sheet");
    const toast = `document.querySelector('[role="status"], [role="alert"]')`;
    await browser.waitFor(toast, "a message (the record) while the sheet is open");
    const top = await browser.evaluate(`${toast}.getBoundingClientRect().top`);
    expect(top < 100, `the message is at y ${top}`);
    await browser.screenshot(join(shots, "phone-toast-sheet.png"), false);
  });
} finally {
  await browser.close();
}

// ---------- English: muscle groups ----------
await api("/api/settings", "PUT", { language: "en" });
browser = await launch({ port: 9361, profile: join(here, "chrome-profile-e2e-fixes-en"), width: 1280, height: 1000 });
try {
  await step(browser, "in English the muscle groups and Ostalo are in English", async () => {
    await browser.navigate(`${APP}/log`);
    const search = `document.querySelector('input[placeholder="Search or type an exercise"]')`;
    await browser.waitFor(search, "the exercise box", 15000);
    await browser.click(search);
    await browser.waitFor(`__e2e.byText('button', 'Quads')`, "the Quads chip");
    const chips = await browser.evaluate(`[...document.querySelectorAll('button[class*="_muscleGroupChip"]')].map((chip) => chip.textContent).join(',')`);
    expect(chips === "All,Back,Chest,Quads,Hamstrings,Shoulders,Glutes,Arms,Abs", `chips: ${chips}`);
    const group = await browser.evaluate(`document.querySelector('[class*="_exercisePickerGroup_"]')?.textContent`);
    expect(group === "Quads", `the squat's group: ${group}`);
    // A done set of an exercise without a group this week: its volume is "Ostalo" on the server.
    const workout = (await api(`/api/workouts?date=${today}`))[0];
    const bench = workout.exercises.find((exercise) => exercise.name === "Bench press");
    await api(`/api/workouts/exercises/${bench.id}/sets`, "POST", { weight: 80, reps: 5 });
    await browser.navigate(`${APP}/`);
    await browser.waitFor(`document.body.innerText.includes('Volume by muscle group')`, "the dashboard", 15000);
    await browser.waitFor(`document.body.innerText.includes('Other')`, "the ungrouped volume as Other");
    expect(!(await browser.evaluate(`document.body.innerText.includes('Ostalo')`)), "Ostalo on the English page");
  });
} finally {
  await api("/api/settings", "PUT", { language: "hr" });
  await browser.close();
}

console.log(results.join("\n"));
const failed = results.filter((line) => line.startsWith("FAIL")).length;
console.log(`\n${results.length - failed} passed, ${failed} failed (fixes)`);
await sleep(100);
