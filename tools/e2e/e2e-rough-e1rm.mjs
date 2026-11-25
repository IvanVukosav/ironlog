// Trening's e1RM past 15 reps to failure: rough ("≈") up to Brzycki's 36, "—" past it.
// Usage: node e2e-rough-e1rm.mjs
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { launch } from "./cdp.mjs";

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
async function step(name, run) {
  try {
    await run();
    results.push(`PASS  ${name}`);
  } catch (err) {
    results.push(`FAIL  ${name}\n        ${String(err.message).split("\n")[0]}`);
  }
}

const browser = await launch({ port: 9365, profile: join(here, "chrome-profile-e2e-rough"), width: 1280, height: 1200 });
const { waitFor, evaluate } = browser;
const e1rms = `[...__e2e.card('Čučanj').querySelectorAll('[class*="_e1rmText_"]')].map((el) => [el.textContent.trim(), el.title || ''])`;

try {
  await api("/api/settings", "PUT", { language: "hr", showE1rm: true, e1rmFormula: "brzycki" });
  for (const workout of await api("/api/workouts?limit=1000")) await api(`/api/workouts/${workout.id}`, "DELETE");
  const workout = await api("/api/workouts", "POST", { date: today });
  await api(`/api/workouts/${workout.id}/exercises/bulk`, "POST", {
    exercises: [
      {
        name: "Čučanj",
        // Trening shows an e1RM beside sets with an RPE: 7, 20 and 40 reps to failure.
        sets: [
          { weight: 100, reps: 5, rpe: 8 },
          { weight: 60, reps: 18, rpe: 8 },
          { weight: 20, reps: 38, rpe: 8 },
        ],
      },
    ],
  });

  await step("a set past 15 reps to failure gets a rough e1RM, one past Brzycki's 36 gets none", async () => {
    await browser.navigate(`${APP}/log`);
    await waitFor(`__e2e.card('Čučanj') && ${e1rms}.length === 3`, "the three sets", 20000);
    const [plain, rough, none] = await evaluate(e1rms);
    expect(plain[0] === "e1RM 120,0 kg" && plain[1] === "", `5 @ 8: ${plain.join(" / ")}`);
    // 60 kg and 20 reps to failure: 60 × 36 / 17.
    expect(rough[0] === "e1RM ≈ 127,1 kg", `18 @ 8: ${rough[0]}`);
    expect(rough[1].startsWith("Gruba procjena: više od 15 ponavljanja do otkaza"), `20 reps hint: ${rough[1]}`);
    expect(none[0] === "e1RM —", `40 reps: ${none[0]}`);
    expect(none[1].startsWith("Brzycki ne računa više od 36 ponavljanja do otkaza"), `40 reps hint: ${none[1]}`);
  });

  await step("with Epley the 40-rep set has one too, rough", async () => {
    await api("/api/settings", "PUT", { e1rmFormula: "epley" });
    await browser.navigate(`${APP}/log`);
    await waitFor(`__e2e.card('Čučanj') && ${e1rms}.length === 3`, "the three sets", 20000);
    const none = (await evaluate(e1rms))[2];
    // 20 kg × (1 + 40 / 30).
    expect(none[0] === "e1RM ≈ 46,7 kg", `40 reps with Epley: ${none[0]}`);
  });

  await step("the page made no errors of its own", async () => {
    const problems = browser.problems.filter((line) => !line.includes("chrome-extension://"));
    expect(problems.length === 0, problems.join(" || "));
  });
} finally {
  await api("/api/settings", "PUT", { e1rmFormula: "brzycki" });
  console.log(results.join("\n"));
  const failed = results.filter((line) => line.startsWith("FAIL")).length;
  console.log(`\n${results.length - failed} passed, ${failed} failed (rough e1RM)`);
  await browser.close();
}
