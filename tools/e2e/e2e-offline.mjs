// Trening without a connection: changes show at once, wait in the outbox, survive a reload, and
// reach the server once it can be reached again, each once and dated when it was made. Also a set
// whose answer is lost on the way (the server saved it): it is sent again and still saved once.
// The page reaches the API itself here (the service worker is bypassed), so failing its requests
// is the same as no signal. Usage: E2E_APP=http://localhost:5198 node e2e-offline.mjs [--phone]
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { mkdirSync } from "node:fs";
import { launch, sleep } from "./cdp.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const phone = process.argv.includes("--phone");
const shots = join(here, "shots", `e2e-offline${phone ? "-phone" : ""}`);
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
const savedWorkout = async () => (await api(`/api/workouts?date=${today}`))[0] ?? null;
const savedSets = async (name) =>
  ((await savedWorkout())?.exercises ?? []).find((exercise) => exercise.name === name)?.sets ?? [];

// A clean slate, with both exercises on the list (no "save to the list?" prompt in the way).
for (const workout of await api("/api/workouts?limit=1000")) await api(`/api/workouts/${workout.id}`, "DELETE");
for (const program of await api("/api/programs")) await api(`/api/programs/${program.id}`, "DELETE");
for (const template of await api("/api/exercise-templates")) await api(`/api/exercise-templates/${template.id}`, "DELETE");
await api("/api/settings", "PUT", { language: "hr", theme: "auto", template: "moderna", e1rmFormula: "brzycki" });
await api("/api/exercise-templates", "POST", { name: "Bench press", muscleGroup: "Prsa" });
await api("/api/exercise-templates", "POST", { name: "Čučanj", muscleGroup: "Kvadriceps" });

const results = [];
function expect(condition, message) {
  if (!condition) throw new Error(message);
}
const browser = await launch({
  port: 9381,
  profile: join(here, "chrome-profile-e2e-offline"),
  width: phone ? 390 : 1280,
  height: phone ? 1400 : 1600,
  mobile: phone,
});
const { send, on, evaluate, waitFor, click, type } = browser;

async function step(name, run) {
  try {
    await run();
    results.push(`PASS  ${name}`);
  } catch (err) {
    results.push(`FAIL  ${name}\n        ${String(err.message).split("\n")[0]}`);
    await browser.screenshot(join(shots, `FAIL-${results.length}.png`)).catch(() => {});
  }
}

// The API as the page reaches it. `offline` fails every request, as with no signal at all;
// `loseNextSetAnswer` lets one new set reach the server but drops its answer, as when the signal
// goes while the answer is on its way.
let offline = false;
let loseNextSetAnswer = false;
on("Fetch.requestPaused", ({ requestId, request, responseStatusCode }) => {
  const ignore = () => {};
  if (responseStatusCode === undefined) {
    const command = offline ? "Fetch.failRequest" : "Fetch.continueRequest";
    send(command, offline ? { requestId, errorReason: "InternetDisconnected" } : { requestId }).catch(ignore);
    return;
  }
  const isNewSet = request.method === "POST" && new URL(request.url).pathname.endsWith("/sets");
  if (loseNextSetAnswer && isNewSet) {
    loseNextSetAnswer = false;
    send("Fetch.failRequest", { requestId, errorReason: "ConnectionReset" }).catch(ignore);
    return;
  }
  send("Fetch.continueResponse", { requestId }).catch(() =>
    send("Fetch.continueRequest", { requestId }).catch(ignore),
  );
});
await send("Network.enable");
await send("Network.setBypassServiceWorker", { bypass: true });
await send("Fetch.enable", {
  patterns: [
    { urlPattern: `${API}/*`, requestStage: "Request" },
    { urlPattern: `${API}/*`, requestStage: "Response" },
  ],
});

// Trening's pieces, as e2e-log.mjs finds them.
const q = (text) => JSON.stringify(text);
const card = (name) => `__e2e.card(${q(name)})`;
const rows = (name) => `__e2e.rows(${card(name)})`;
const rowCount = (name) => evaluate(`(${card(name)} ? ${rows(name)}.length : -1)`);
const rowTexts = (name) => evaluate(`${rows(name)}.map((row) => row.innerText.replace(/\\s+/g, ' ').trim()).join(' | ')`);
const field = (name, what) => `${card(name)}.querySelector('[data-field="${what}"] input')`;
const bodyHas = (text) => `document.body.innerText.includes(${q(text)})`;
const note = `document.querySelector('[role="status"]')?.innerText ?? ''`;

async function addExercise(name) {
  await type(`document.querySelector('input[placeholder="Pretraži ili upiši vježbu"]')`, name);
  await click(`__e2e.byText('button', 'Dodaj vježbu')`);
  await waitFor(`!!${card(name)}`, `the ${name} card`);
}
async function addSet(name, weight, reps, rpe) {
  const before = await rowCount(name);
  await type(field(name, "weight"), weight);
  await type(field(name, "reps"), reps);
  await type(field(name, "rpe"), rpe);
  await click(`${card(name)}.querySelector('button[data-action="add-set"]')`);
  await waitFor(`${rows(name)}.length === ${before + 1}`, `set ${before + 1} of ${name} on screen`);
}
// "Online" again: the app also tries every 15 s, but the event makes it try at once.
async function backOnline() {
  offline = false;
  await evaluate(`window.dispatchEvent(new Event('online'))`);
}

let doneOffline;
try {
  await browser.navigate(`${APP}/log`);
  await waitFor(`!!__e2e.byText('button', 'Započni trening')`, "Započni trening", 15000);

  await step("online, a workout is started and a set logged as always", async () => {
    await click(`__e2e.byText('button', 'Započni trening')`);
    await waitFor(`!!document.querySelector('input[placeholder="Pretraži ili upiši vježbu"]')`, "the started workout");
    await addExercise("Bench press");
    await addSet("Bench press", "100", "5", "8");
    await waitFor(`!${bodyHas("promjen")}`, "no note about waiting changes");
    expect((await savedSets("Bench press")).length === 1, "the set is not on the server");
  });

  await step("without a connection, a set, an exercise and its set show at once and wait", async () => {
    offline = true;
    doneOffline = new Date();
    await addSet("Bench press", "102,5", "5", "8");
    await waitFor(`(${note}).includes('1 promjena čeka')`, "the note: 1 change waiting");
    await addExercise("Čučanj");
    await addSet("Čučanj", "140", "5", "8");
    await waitFor(`(${note}).includes('3 promjene čekaju')`, "the note: 3 changes waiting");
    // A set made without a connection is changed too: ticked back off, by its temporary id.
    await click(`${rows("Čučanj")}[0].querySelector('button[aria-pressed]')`);
    await waitFor(`${rows("Čučanj")}[0].querySelector('button[aria-pressed]').getAttribute('aria-pressed') === 'false'`, "the set not done");
    await waitFor(`(${note}).includes('4 promjene čekaju')`, "the note: 4 changes waiting");
    expect((await savedSets("Bench press")).length === 1, "something reached the server");
    await browser.screenshot(join(shots, "waiting.png"));
  });

  await step("a reload without a connection shows the day as it was left, with the note", async () => {
    await browser.navigate(`${APP}/log`);
    await waitFor(`!!${card("Čučanj")}`, "the Čučanj card after the reload", 15000);
    expect((await rowCount("Bench press")) === 2, `Bench press: ${await rowTexts("Bench press")}`);
    expect((await rowCount("Čučanj")) === 1, `Čučanj: ${await rowTexts("Čučanj")}`);
    expect((await evaluate(note)).includes("4 promjene čekaju"), `note: ${await evaluate(note)}`);
  });

  await step("back online, the changes are saved in order, once, dated when they were made", async () => {
    await backOnline();
    await waitFor(bodyHas("Promjene su spremljene."), "the saved toast", 15000);
    await waitFor(`!(${note}).includes('promjen')`, "the note gone");
    const bench = await savedSets("Bench press");
    expect(bench.map((set) => `${set.weight}x${set.reps}`).join() === "100x5,102.5x5", `bench: ${bench.map((s) => s.weight)}`);
    const squat = await savedSets("Čučanj");
    expect(squat.length === 1 && squat[0].weight === 140 && squat[0].isDone === false, `squat: ${JSON.stringify(squat)}`);
    const doneAt = Date.parse(bench[1].completedAt);
    expect(doneAt >= doneOffline.getTime() - 1000 && doneAt < doneOffline.getTime() + 15000, `102,5 done at ${bench[1].completedAt}, offline from ${doneOffline.toISOString()}`);
  });

  await step("after saving, the page works with the real ids: a set made offline is deleted", async () => {
    await waitFor(`${rows("Čučanj")}.length === 1`, "the day loaded again");
    await click(`${rows("Čučanj")}[0].querySelector('[class*="_setButton_"]')`);
    await waitFor(`document.querySelector('[role="dialog"]')`, "the set sheet");
    await click(`__e2e.byText('button', 'Obriši set', document.querySelector('[role="dialog"]'))`);
    await waitFor(`${rows("Čučanj")}.length === 0`, "the set gone from the card");
    await sleep(500);
    expect((await savedSets("Čučanj")).length === 0, "the set is still on the server");
  });

  await step("a set whose answer was lost is sent again and still saved once", async () => {
    loseNextSetAnswer = true;
    await addSet("Bench press", "105", "3", "9");
    await waitFor(bodyHas("Promjene su spremljene."), "the saved toast", 20000);
    await waitFor(`!(${note}).includes('promjen')`, "the note gone");
    const bench = await savedSets("Bench press");
    expect(bench.length === 3, `${bench.length} Bench press sets on the server`);
    expect((await rowCount("Bench press")) === 3, `${await rowCount("Bench press")} rows on screen`);
  });

  await step("no errors but the missing connection", async () => {
    const ours = browser.problems.filter(
      (problem) => !/Failed to fetch|ERR_INTERNET_DISCONNECTED|ERR_CONNECTION_RESET|net::ERR_FAILED/.test(problem),
    );
    expect(ours.length === 0, ours.join(" || "));
  });
} finally {
  await browser.close();
}

console.log(results.join("\n"));
const failed = results.filter((line) => line.startsWith("FAIL")).length;
console.log(`\n${results.length - failed} passed, ${failed} failed (offline${phone ? ", phone" : ""})`);
process.exitCode = failed ? 1 : 0;
