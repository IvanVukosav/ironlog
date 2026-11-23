// Sends a converted program to Iron Log's API, unless a program of that name is already there.
// With APP_PASSWORD set on the backend, put the same password in IRONLOG_PASSWORD.
// Usage: node post-program.mjs <program.json> [API address, default http://localhost:3001]
import { readFileSync } from "node:fs";

const [path, api = "http://localhost:3001"] = process.argv.slice(2);
// trimStart also drops the BOM a file saved by PowerShell may start with.
const program = JSON.parse(readFileSync(path, "utf8").trimStart());
const headers = { "Content-Type": "application/json" };

async function call(route, options = {}) {
  const response = await fetch(`${api}${route}`, { headers, ...options });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(`${route}: ${body?.error ?? response.status}`);
  return body;
}

if (process.env.IRONLOG_PASSWORD) {
  const password = process.env.IRONLOG_PASSWORD;
  const { token } = await call("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ password }),
  });
  if (token) headers.Authorization = `Bearer ${token}`;
}

const existing = await call("/api/programs");
const same = existing.find((other) => other.name === program.name);
if (same) {
  console.log(`"${program.name}" is already there (id ${same.id}); nothing sent.`);
  process.exit(1);
}
const created = await call("/api/programs", { method: "POST", body: JSON.stringify(program) });
const exercises = created.days.map((day) => day.exercises.length).join("/");
console.log(
  `created "${created.name}" (id ${created.id}): ${created.weeks} weeks, ` +
    `${created.days.length} days, exercises per day ${exercises}`,
);
