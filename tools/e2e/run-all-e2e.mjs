// Runs every e2e suite, on a computer and a phone where it has both, one after another, against
// the app at E2E_APP (default the dev server), and prints each one's result and failures.
// Usage: E2E_APP=http://localhost:5198 node run-all-e2e.mjs
import { spawn } from "node:child_process";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const SUITES = [
  ["e2e-active.mjs"],
  ["e2e-active.mjs", "--phone"],
  ["e2e-calculator.mjs"],
  ["e2e-calculator.mjs", "--phone"],
  ["e2e-calendar.mjs"],
  ["e2e-calendar.mjs", "--phone"],
  ["e2e-dashboard.mjs"],
  ["e2e-dashboard.mjs", "--phone"],
  ["e2e-drops.mjs"],
  ["e2e-drops.mjs", "--phone"],
  ["e2e-fixes.mjs"],
  ["e2e-home-program.mjs"],
  ["e2e-home-program.mjs", "--phone"],
  ["e2e-log.mjs", "new"],
  ["e2e-log.mjs", "new", "--phone"],
  ["e2e-nutrition.mjs"],
  ["e2e-nutrition.mjs", "--phone"],
  ["e2e-nutrition-quick.mjs"],
  ["e2e-nutrition-quick.mjs", "--phone"],
  // Needs the 3002 backend started with OPEN_FOOD_FACTS_URL=http://localhost:3098/api/v2/product/.
  ["e2e-scanner.mjs"],
  ["e2e-scanner.mjs", "--phone"],
  ["e2e-scanner-zxing.mjs"],
  ["e2e-scanner-zxing.mjs", "--phone"],
  ["e2e-programs.mjs"],
  ["e2e-programs.mjs", "--phone"],
  ["e2e-program-export.mjs"],
  ["e2e-program-export.mjs", "--phone"],
  ["e2e-rest-setting.mjs"],
  ["e2e-rough-e1rm.mjs"],
  ["e2e-settings.mjs"],
  ["e2e-settings.mjs", "phone"],
  ["e2e-stats.mjs"],
  ["e2e-stats.mjs", "--phone"],
  ["e2e-layout.mjs"],
  // Only against a production build: hashed /assets/ files, and the service worker.
  ...(process.env.E2E_APP?.includes(":5198")
    ? [["e2e-page-split.mjs"], ["e2e-offline-sw.mjs"]]
    : []),
  ["e2e-offline.mjs"],
  ["e2e-offline.mjs", "--phone"],
  ["e2e-backoff.mjs"],
  ["e2e-backoff.mjs", "--phone"],
  ["e2e-repeat.mjs"],
  ["e2e-repeat.mjs", "--phone"],
];
const SUITE_TIMEOUT_MS = 8 * 60 * 1000;

function run(args) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, args, { cwd: here, env: process.env });
    let output = "";
    child.stdout.on("data", (chunk) => (output += chunk));
    child.stderr.on("data", (chunk) => (output += chunk));
    const timer = setTimeout(() => child.kill(), SUITE_TIMEOUT_MS);
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code, output });
    });
  });
}

const started = Date.now();
let passedSuites = 0;
const failures = [];
console.log(`app: ${process.env.E2E_APP ?? "http://localhost:5199"}`);
for (const args of SUITES) {
  const { output } = await run(args);
  const lines = output.trim().split("\n");
  const summary = lines.findLast((line) => / passed, \d+ failed/.test(line)) ?? "(no summary)";
  const failed = /, 0 failed/.test(summary);
  if (failed) passedSuites++;
  else failures.push([args.join(" "), lines.filter((line, index) => line.startsWith("FAIL") || lines[index - 1]?.startsWith("FAIL")).join("\n")]);
  console.log(`${failed ? "ok  " : "FAIL"} ${args.join(" ").padEnd(32)} ${summary.trim()}`);
}
console.log(`\n${passedSuites} of ${SUITES.length} runs clean in ${Math.round((Date.now() - started) / 60000)} min`);
for (const [name, detail] of failures) console.log(`\n--- ${name}\n${detail || "(see the suite's own output)"}`);
