// Pages as files of their own (React.lazy): the other pages load in the background once the app is
// up, and a page whose file can't be fetched shows "Stranica se nije učitala" with "Pokušaj
// ponovno" while the rest of the app keeps working. Run against a production build (the file names
// are Vite's hashed /assets/ names). Usage: E2E_APP=http://localhost:5198 node e2e-page-split.mjs
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { mkdirSync } from "node:fs";
import { launch, sleep } from "./cdp.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const shots = join(here, "shots", "e2e-page-split");
mkdirSync(shots, { recursive: true });
const APP = process.env.E2E_APP ?? "http://localhost:5198";

const results = [];
function expect(condition, message) {
  if (!condition) throw new Error(message);
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

const browser = await launch({ port: 9371, profile: join(here, "chrome-profile-e2e-split"), width: 1280, height: 900 });
const { send, on, evaluate, waitFor, click } = browser;

// Every script the page asks for, and the Statistika page's file failing as if offline.
const scripts = [];
on("Network.requestWillBeSent", ({ request }) => {
  if (/\/assets\/.+\.js$/.test(request.url)) scripts.push(request.url.split("/assets/")[1]);
});
on("Fetch.requestPaused", ({ requestId, request }) => {
  if (/\/assets\/Stats-[^/]+\.js$/.test(request.url)) {
    send("Fetch.failRequest", { requestId, errorReason: "InternetDisconnected" }).catch(() => {});
  } else {
    send("Fetch.continueRequest", { requestId }).catch(() => {});
  }
});
await send("Network.enable");
await send("Fetch.enable", { patterns: [{ urlPattern: "*/assets/*.js" }] });
// The app loads the other pages when the browser is idle, which can come before the first check.
// Idle callbacks wait in a queue here until the test lets them run.
await send("Page.addScriptToEvaluateOnNewDocument", {
  source: `window.__idleQueue = [];
    window.requestIdleCallback = (callback) => window.__idleQueue.push(callback);
    window.cancelIdleCallback = () => {};`,
});

const bodyHas = (text) => `document.body.innerText.includes(${JSON.stringify(text)})`;
const navLink = (text) => `[...document.querySelectorAll('nav a')].find((a) => a.textContent.trim() === ${JSON.stringify(text)} && __e2e.visible(a))`;

try {
  await browser.navigate(`${APP}/log`);
  await waitFor(`!!__e2e.byText('button', 'Dodaj vježbu')`, "Trening", 15000);

  await step("Trening starts without the other pages' files", async () => {
    await sleep(500);
    const atStart = scripts.slice();
    expect(atStart.some((name) => name.startsWith("Log-")), `no Log file: ${atStart.join(", ")}`);
    const others = atStart.filter((name) => /^(chartTheme|Dashboard|Programs|Nutrition|Calendar|Calculator|Settings|Stats)-/.test(name));
    expect(others.length === 0, `came with Trening: ${others.join(", ")}`);
  });

  await step("the other pages load in the background once the app is up", async () => {
    expect((await evaluate("window.__idleQueue.length")) > 0, "nothing waits for an idle moment");
    await evaluate("window.__idleQueue.forEach((callback) => callback({ didTimeout: false, timeRemaining: () => 50 }))");
    const wanted = ["Dashboard-", "Programs-", "Nutrition-", "Calendar-", "Calculator-", "Settings-", "Stats-", "chartTheme-"];
    const started = Date.now();
    while (Date.now() - started < 8000 && !wanted.every((prefix) => scripts.some((name) => name.startsWith(prefix)))) {
      await sleep(200);
    }
    const missing = wanted.filter((prefix) => !scripts.some((name) => name.startsWith(prefix)));
    expect(missing.length === 0, `not loaded: ${missing.join(", ")}`);
  });

  await step("a page whose file can't load says so, with Pokušaj ponovno", async () => {
    await click(navLink("Statistika"), "Statistika in the nav");
    await waitFor(bodyHas("Stranica se nije učitala"), "the message");
    expect(await evaluate(`!!__e2e.byText('button', 'Pokušaj ponovno')`), "no Pokušaj ponovno");
    expect(await evaluate(`!!${navLink("Trening")}`), "the nav is gone");
    await browser.screenshot(join(shots, "page-error.png"));
  });

  await step("another page works again after it", async () => {
    await click(navLink("Programi"), "Programi in the nav");
    await waitFor(`document.querySelector('h1')?.textContent === 'Programi'`, "Programi");
    expect(!(await evaluate(bodyHas("Stranica se nije učitala"))), "the message stayed");
  });

  await step("only the blocked file made errors", async () => {
    const ours = browser.problems.filter((problem) => !/Stats-|Failed to fetch dynamically imported module|net::ERR_INTERNET_DISCONNECTED|InternetDisconnected/.test(problem));
    expect(ours.length === 0, ours.join(" || "));
  });
} finally {
  await browser.close();
}

console.log(results.join("\n"));
const failed = results.filter((line) => line.startsWith("FAIL")).length;
console.log(`\n${results.length - failed} passed, ${failed} failed (page split)`);
process.exitCode = failed ? 1 : 0;
