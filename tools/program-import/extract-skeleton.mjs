// Pulls a Barbell Medicine style program out of its unzipped workbook's PROGRAMMING SKELETON sheet:
// per week the prescription text of each of the 12 slots (4 days × 3 exercises), and the exercise
// names. Writes them as JSON for convert-skeleton.mjs.
// Usage: node extract-skeleton.mjs <unzipped folder> <sheet file, e.g. sheet17.xml> <weeks> <out.json>
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const [folder, sheetFile, weeksArg, outPath] = process.argv.slice(2);
const WEEKS = Number(weeksArg);
if (!outPath || !Number.isInteger(WEEKS) || WEEKS < 1) {
  throw new Error("usage: node extract-skeleton.mjs <folder> <sheetN.xml> <weeks> <out.json>");
}
const read = (path) => readFileSync(join(folder, path), "utf8");
const decode = (text) =>
  text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&amp;/g, "&");
const shared = [...read("xl/sharedStrings.xml").matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) =>
  decode([...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((t) => t[1]).join("")),
);
const xml = read(`xl/worksheets/${sheetFile}`);
const cells = {};
for (const cell of xml.matchAll(/<c r="([A-Z]+\d+)"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
  const [, ref, attrs, inner = ""] = cell;
  const type = /t="([^"]+)"/.exec(attrs)?.[1];
  const raw = /<v>([\s\S]*?)<\/v>/.exec(inner)?.[1];
  const inline = /<is>[\s\S]*?<t[^>]*>([\s\S]*?)<\/t>/.exec(inner)?.[1];
  const value = raw === undefined ? inline : type === "s" ? shared[Number(raw)] : decode(raw);
  if (value !== undefined) cells[ref] = value;
}

// Slots 1–6: columns D–I from row 3 (week 1) on; slots 7–12: the same columns from row 57.
const COLUMNS = ["D", "E", "F", "G", "H", "I"];
const weeks = Array.from({ length: WEEKS }, (_, w) => ({
  week: w + 1,
  block: cells[`C${3 + w}`],
  slots: [
    ...COLUMNS.map((col) => cells[`${col}${3 + w}`] ?? ""),
    ...COLUMNS.map((col) => cells[`${col}${57 + w}`] ?? ""),
  ],
}));
// Names: day blocks start at rows 118, 173, 228, 282 (week 1), exercises in columns D, G, J.
const names = [118, 173, 228, 282].map((row) =>
  Array.from({ length: WEEKS }, (_, w) =>
    ["D", "G", "J"].map((col) => cells[`${col}${row + w}`] ?? ""),
  ),
);
writeFileSync(outPath, JSON.stringify({ weeks, names }, null, 1));
console.log(`${WEEKS} weeks written to ${outPath}`);
