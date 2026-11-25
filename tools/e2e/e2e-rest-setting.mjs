// The rest length in Postavke, and a tick with the rest turned off. Usage: node e2e-rest-setting.mjs
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { launch, sleep } from "./cdp.mjs";

const here = dirname(fileURLToPath(import.meta.url));
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
  return response.json();
}
const results = [];
const expect = (condition, message) => {
  if (!condition) throw new Error(message);
};
const browser = await launch({ port: 9357, profile: join(here, "chrome-profile-e2e-rest"), width: 1280, height: 1900 });
const { waitFor, click, evaluate } = browser;
const chip = (text) =>
  `[...document.querySelectorAll('[role="group"][aria-label="Odmor nakon seta"] button')].find((b) => b.textContent.trim() === ${JSON.stringify(text)})`;

async function step(name, run) {
  try {
    await run();
    results.push(`PASS  ${name}`);
  } catch (err) {
    results.push(`FAIL  ${name}\n        ${String(err.message).split("\n")[0]}`);
  }
}

try {
  await api("/api/settings", "PUT", { language: "hr", restSeconds: 120 });
  for (const workout of await api("/api/workouts?limit=1000")) await api(`/api/workouts/${workout.id}`, "DELETE");

  await step("Postavke offer the rest lengths, with 2:00 chosen, and save a change", async () => {
    // On a wide screen Postavke shows one section at a time: open Trening by its address.
    await browser.navigate(`${APP}/settings?section=training`);
    await waitFor(`${chip("2:00")} && __e2e.visible(${chip("2:00")})`, "the rest choices", 15000);
    // The page grows as its other data arrives; a click before that lands somewhere else.
    await waitFor(`(async () => {
      const top = () => ${chip("1:30")}.getBoundingClientRect().top + scrollY;
      const before = top();
      await new Promise((resolve) => setTimeout(resolve, 600));
      return top() === before;
    })()`, "the page to hold still", 10000);
    expect(await evaluate(`${chip("2:00")}.getAttribute('aria-pressed') === 'true'`), "2:00 is not chosen");
    await click(chip("1:30"));
    await sleep(500);
    expect((await api("/api/settings")).restSeconds === 90, "1:30 not saved");
    await click(chip("Bez odmora"));
    await sleep(500);
    expect((await api("/api/settings")).restSeconds === 0, "no rest not saved");
  });

  await step("with no rest, a tick starts no rest timer", async () => {
    const workout = await api("/api/workouts", "POST", { date: today });
    await api(`/api/workouts/${workout.id}/exercises/bulk`, "POST", {
      exercises: [{ name: "Čučanj", sets: [{ weight: 100, reps: 5, isDone: false }] }],
    });
    await browser.navigate(`${APP}/log`);
    const pressed = `__e2e.rows(__e2e.card('Čučanj'))[0].querySelector('button[aria-pressed]')`;
    await waitFor(`__e2e.card('Čučanj') && ${pressed}`, "the planned set", 15000);
    await click(pressed);
    await waitFor(`${pressed}.getAttribute('aria-pressed') === 'true'`, "the set done");
    await sleep(800);
    expect(!(await evaluate(`!!document.querySelector('section[aria-label="Odmor"]')`)), "a rest started");
    expect((await api(`/api/workouts?date=${today}`))[0].startedAt !== null, "the clock did not start");
  });
} finally {
  await api("/api/settings", "PUT", { restSeconds: 120 });
  console.log(results.join("\n"));
  const failed = results.filter((line) => line.startsWith("FAIL")).length;
  console.log(`\n${results.length - failed} passed, ${failed} failed (rest setting)`);
  await browser.close();
}
