// Checks a converted program with the app's own scheme parser (frontend/src/utils/programScheme.js):
// every week of every exercise must read and read back the same, and each back-off set must have
// a top set before it. Usage: node check-schemes.mjs <program.json>   (Node 22.15 or newer)
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";

// The frontend imports its own files without ".js" (Vite finds them); Node needs the extension.
registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier, context);
    } catch (error) {
      if (!specifier.startsWith(".") || /\.[cm]?js$/.test(specifier)) throw error;
      return nextResolve(`${specifier}.js`, context);
    }
  },
});
const scheme = await import("../../frontend/src/utils/programScheme.js");

// trimStart also drops the BOM a file saved by PowerShell may start with.
const program = JSON.parse(readFileSync(process.argv[2], "utf8").trimStart());
const problems = [];
let count = 0;
program.days.forEach((day, d) =>
  day.exercises.forEach((exercise) =>
    exercise.weekSchemes.forEach((text, w) => {
      if (!text) return;
      count += 1;
      const where = `Dan ${d + 1} ${exercise.name} T${w + 1}`;
      const sets = scheme.schemeToSets(text);
      if (!sets) {
        problems.push(`${where}: can't read "${text}"`);
        return;
      }
      sets.forEach((set, index) => {
        if (scheme.isBackoff(set) && scheme.topSetIndex(sets, index) === -1) {
          problems.push(`${where}: a back-off without a top set`);
        }
      });
      const back = scheme.setsToScheme(sets);
      if (back !== text) problems.push(`${where}: "${text}" comes back as "${back}"`);
    }),
  ),
);
console.log(`${count} schemes checked; ${problems.length} problems`);
for (const problem of problems) console.log(`  ${problem}`);
process.exitCode = problems.length ? 1 : 0;
