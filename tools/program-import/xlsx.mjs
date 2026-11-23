// Reads an unzipped xlsx (a folder with xl/…): its sheets, and a sheet's cell values by reference.
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const decode = (text) =>
  text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&amp;/g, "&");
const attribute = (tag, name) => new RegExp(`\\s${name}="([^"]*)"`).exec(tag)?.[1];

/** A column's number from its letters: A is 1, AA is 27. */
export const columnNumber = (letters) =>
  [...letters].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0);

/** A column's letters from its number: 1 is A, 27 is AA. */
export function columnLetters(number) {
  let letters = "";
  for (let n = number; n > 0; n = Math.floor((n - 1) / 26)) {
    letters = String.fromCharCode(65 + ((n - 1) % 26)) + letters;
  }
  return letters;
}

/** The workbook in `folder`: { sheets: [{ name, file }], cells, formulas, source }. */
export function openWorkbook(folder) {
  const read = (path) => readFileSync(join(folder, path), "utf8");
  const targets = Object.fromEntries(
    [...read("xl/_rels/workbook.xml.rels").matchAll(/<Relationship\s[^>]*>/g)].map((m) => [
      attribute(m[0], "Id"),
      attribute(m[0], "Target"),
    ]),
  );
  const sheets = [...read("xl/workbook.xml").matchAll(/<sheet\s[^>]*>/g)].map((m) => ({
    name: decode(attribute(m[0], "name")),
    file: "xl/" + targets[attribute(m[0], "r:id")].replace(/^\/?xl\//, ""),
  }));
  const shared = existsSync(join(folder, "xl/sharedStrings.xml"))
    ? [...read("xl/sharedStrings.xml").matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) =>
        decode([...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((t) => t[1]).join("")),
      )
    : [];

  // Each sheet read once: its values (as last worked out) and formulas, by reference.
  const parsed = new Map();
  function parse(sheetName) {
    if (parsed.has(sheetName)) return parsed.get(sheetName);
    const sheet = sheets.find((s) => s.name === sheetName);
    if (!sheet) throw new Error(`no sheet "${sheetName}"`);
    const values = {};
    const formulas = {};
    const xml = read(sheet.file);
    for (const cell of xml.matchAll(/<c r="([A-Z]+\d+)"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const [, ref, attrs, inner = ""] = cell;
      const type = /t="([^"]+)"/.exec(attrs)?.[1];
      const raw = /<v>([\s\S]*?)<\/v>/.exec(inner)?.[1];
      const inline = /<is>[\s\S]*?<t[^>]*>([\s\S]*?)<\/t>/.exec(inner)?.[1];
      const formula = /<f[^>]*>([\s\S]*?)<\/f>/.exec(inner)?.[1];
      const value = raw === undefined ? inline : type === "s" ? shared[Number(raw)] : decode(raw);
      if (value !== undefined && value.trim() !== "") values[ref] = value;
      if (formula) formulas[ref] = decode(formula);
    }
    const result = { values, formulas };
    parsed.set(sheetName, result);
    return result;
  }

  /** A sheet's non-empty cell values as text, by reference: { B7: "Competition Squat", … }. */
  const cells = (sheetName) => parse(sheetName).values;
  /** A sheet's formulas (without "="), by reference: { E25: "PROGRAM!K12", … }. */
  const formulas = (sheetName) => parse(sheetName).formulas;

  /**
   * A cell's value from where it comes from: a formula that only points at another cell
   * ("PROGRAM!K12", "'WEEK 1'!$B$3") is followed to that cell, since a saved workbook's worked-out
   * values can be out of date. Any other formula's value is taken as saved.
   */
  function source(sheetName, ref, depth = 0) {
    const formula = formulas(sheetName)[ref]?.trim();
    const pointer = formula && /^(?:'([^']+)'|([^'!]+))!\$?([A-Z]+)\$?(\d+)$/.exec(formula);
    if (pointer && depth < 10) {
      return source(pointer[1] ?? pointer[2], pointer[3] + pointer[4], depth + 1);
    }
    return cells(sheetName)[ref] ?? "";
  }

  return { sheets, cells, formulas, source };
}
