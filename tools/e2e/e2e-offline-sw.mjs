// The installed app without a connection, service worker and all: once a page has been seen online,
// it opens again with no network at all (the shell and its files from the service worker) and shows
// the API's answers kept from then. Both the page and the service worker are taken offline.
// Only against a production build (the service worker is registered there).
// Usage: E2E_APP=http://localhost:5198 node e2e-offline-sw.mjs
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { mkdirSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { launch, sleep } from "./cdp.mjs";

// Chrome's Cache Storage fails ("Unexpected internal error") under a profile in a deep folder:
// its files go past Windows' 260-character paths, and the service worker never installs. This
// one profile lives in a short folder of the system's temp instead, removed after the run.
const SHORT_PROFILE = join(tmpdir(), "ilsw");

const here = dirname(fileURLToPath(import.meta.url));
const shots = join(here, "shots", "e2e-offline-sw");
mkdirSync(shots, { recursive: true });
const APP = process.env.E2E_APP ?? "http://localhost:5198";
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

for (const program of await api("/api/programs")) await api(`/api/programs/${program.id}`, "DELETE");
await api("/api/settings", "PUT", { language: "hr", theme: "auto", template: "moderna", e1rmFormula: "brzycki" });
await api("/api/programs", "POST", {
  name: "Program bez signala",
  weeks: 1,
  trainingMaxPercent: 100,
  days: [{ name: "Noge", exercises: [{ name: "Čučanj", weekSchemes: ["3x5 rpe8"] }] }],
});

const results = [];
function expect(condition, message) {
  if (!condition) throw new Error(message);
}
const browser = await launch({ port: 9391, profile: SHORT_PROFILE, width: 1280, height: 900 });
const { send, evaluate, waitFor } = browser;

async function step(name, run) {
  console.log(`... ${name}`);
  try {
    await run();
    results.push(`PASS  ${name}`);
  } catch (err) {
    results.push(`FAIL  ${name}\n        ${String(err.message).split("\n")[0]}`);
    await browser.screenshot(join(shots, `FAIL-${results.length}.png`)).catch(() => {});
  }
}

const OFFLINE = { offline: true, latency: 0, downloadThroughput: -1, uploadThroughput: -1 };
const ONLINE = { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 };
const programCard = `[...document.querySelectorAll('li')].find((li) => li.querySelector('h2')?.textContent === 'Program bez signala')`;
let workerSession = null;

try {
  await send("Network.enable");
  await step("online, the service worker takes the page over and keeps what it reads", async () => {
    await browser.navigate(`${APP}/programs`);
    await waitFor(`!!${programCard}`, "the program, online", 15000);
    await waitFor(`navigator.serviceWorker.ready.then(() => !!navigator.serviceWorker.controller)`, "a controlling service worker", 15000);
    // Read again through the service worker, so it keeps the answers.
    await browser.navigate(`${APP}/programs`);
    await waitFor(`!!${programCard}`, "the program, read through the service worker", 15000);
    await waitFor(`caches.open('ironlog-api-v1').then((cache) => cache.keys()).then((keys) => keys.some((request) => request.url.endsWith('/api/programs')))`, "the programs kept", 8000);
    // Give the other pages' files time to load in the background, so the worker keeps them too.
    await sleep(2500);
  });

  await step("with no network for the page and the worker, the app opens and shows what it kept", async () => {
    // A service worker idle for a while is stopped and has no target: a request wakes it.
    let worker;
    for (let attempt = 0; attempt < 20 && !worker; attempt += 1) {
      await evaluate(`fetch('/manifest.webmanifest').then(() => true, () => false)`);
      const { targetInfos } = await send("Target.getTargets");
      worker = targetInfos.find((target) => target.type === "service_worker" && target.url.startsWith(APP));
      if (!worker) await sleep(250);
    }
    expect(worker, "the app's service worker never showed up as a target");
    ({ sessionId: workerSession } = await send("Target.attachToTarget", { targetId: worker.targetId, flatten: true }));
    await send("Network.enable", {}, workerSession);
    await send("Network.emulateNetworkConditions", OFFLINE, workerSession);
    await send("Network.emulateNetworkConditions", OFFLINE);
    const offlineFetch = await evaluate(`fetch('${API}/api/programs?check=1').then(() => 'reached', () => 'failed')`);
    expect(offlineFetch === "failed", `the network is still there: ${offlineFetch}`);

    await browser.navigate(`${APP}/programs`);
    await waitFor(`!!${programCard}`, "the kept program, offline", 15000);
    expect(!(await evaluate(`document.body.innerText.includes('Nema veze sa serverom')`)), "an error about the connection");
    await browser.screenshot(join(shots, "programs-offline.png"));
  });

  await step("other pages open offline too, from the files kept in the background", async () => {
    await evaluate(`history.pushState({}, '', '/calculator'); dispatchEvent(new PopStateEvent('popstate'))`);
    await waitFor(`document.querySelector('h1')?.textContent === 'Kalkulator'`, "Kalkulator, offline", 8000);
    expect(!(await evaluate(`document.body.innerText.includes('Stranica se nije učitala')`)), "the page's file was not kept");
  });
} finally {
  if (workerSession) await send("Network.emulateNetworkConditions", ONLINE, workerSession).catch(() => {});
  await send("Network.emulateNetworkConditions", ONLINE).catch(() => {});
  await browser.close();
  // The profile (launch adds "-<time>" to the name); Chrome may still hold it a moment.
  for (const name of readdirSync(tmpdir()).filter((entry) => entry.startsWith("ilsw-"))) {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      try {
        rmSync(join(tmpdir(), name), { recursive: true, force: true });
        break;
      } catch {
        await sleep(500);
      }
    }
  }
}

console.log(results.join("\n"));
const failed = results.filter((line) => line.startsWith("FAIL")).length;
console.log(`\n${results.length - failed} passed, ${failed} failed (offline, service worker)`);
process.exitCode = failed ? 1 : 0;
