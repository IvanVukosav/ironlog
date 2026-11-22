// Prints an unzipped xlsx (a folder with xl/…) as text: the sheet list, or one sheet's non-empty
// cells row by row, with formulas. Read only.
// Usage: node read-xlsx.mjs <unzipped folder> [sheet name or number] [max rows] [max columns]
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const [folder, which, maxRowsArg, maxColsArg] = process.argv.slice(2);
const maxRows = Number(maxRowsArg ?? 80);
const maxCols = Number(maxColsArg ?? 30);
const read = (path) => readFileSync(join(folder, path), "utf8");
const decode = (text) =>
  text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&amp;/g, "&");
const attribute = (tag, name) => new RegExp(`\\s${name}="([^"]*)"`).exec(tag)?.[1];

const workbook = read("xl/workbook.xml");
const rels = read("xl/_rels/workbook.xml.rels");
const targets = Object.fromEntries(
  [...rels.matchAll(/<Relationship\s[^>]*>/g)].map((m) => [
    attribute(m[0], "Id"),
    attribute(m[0], "Target"),
  ]),
);
const sheets = [...workbook.matchAll(/<sheet\s[^>]*>/g)].map((m, index) => ({
  number: index + 1,
  name: decode(attribute(m[0], "name")),
  file: "xl/" + targets[attribute(m[0], "r:id")].replace(/^\/?xl\//, ""),
  hidden: attribute(m[0], "state") === "hidden",
}));

if (!which) {
  for (const sheet of sheets) {
    console.log(
      `${sheet.number}. ${sheet.name}${sheet.hidden ? " (hidden)" : ""}  [${sheet.file}]`,
    );
  }
  process.exit(0);
}

const shared = existsSync(join(folder, "xl/sharedStrings.xml"))
  ? [...read("xl/sharedStrings.xml").matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) =>
      decode([...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((t) => t[1]).join("")),
    )
  : [];
const sheet = sheets.find((s) => String(s.number) === which || s.name === which);
if (!sheet) throw new Error(`no sheet "${which}"`);
const xml = read(sheet.file);
const colNumber = (letters) => [...letters].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0);
const merges = [...xml.matchAll(/<mergeCell ref="([^"]+)"/g)].map((m) => m[1]);
console.log(`== ${sheet.name}  (${sheet.file})  merges: ${merges.length}`);
for (const row of xml.matchAll(/<row [^>]*r="(\d+)"[^>]*>([\s\S]*?)<\/row>/g)) {
  const rowNumber = Number(row[1]);
  if (rowNumber > maxRows) break;
  const cells = [];
  for (const cell of row[2].matchAll(/<c r="([A-Z]+)(\d+)"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
    const [, letters, , attrs, inner = ""] = cell;
    if (colNumber(letters) > maxCols) continue;
    const type = /t="([^"]+)"/.exec(attrs)?.[1];
    const formula = /<f[^>]*>([\s\S]*?)<\/f>/.exec(inner)?.[1];
    const valueRaw = /<v>([\s\S]*?)<\/v>/.exec(inner)?.[1];
    const inline = /<is>[\s\S]*?<t[^>]*>([\s\S]*?)<\/t>/.exec(inner)?.[1];
    let value =
      valueRaw === undefined ? inline : type === "s" ? shared[Number(valueRaw)] : decode(valueRaw);
    if (value === undefined && formula === undefined) continue;
    if (typeof value === "string" && /^-?\d+\.\d{4,}$/.test(value)) {
      value = String(Math.round(Number(value) * 1000) / 1000);
    }
    const formulaText = formula ? ` [=${decode(formula).slice(0, 60)}]` : "";
    cells.push(`${letters}=${JSON.stringify(value ?? "")}${formulaText}`);
  }
  if (cells.length > 0) console.log(`${rowNumber}: ${cells.join("  ")}`);
}
