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

/** The workbook in `folder`: { sheets: [{ name, file }], cells(sheetName) }. */
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

  /** A sheet's non-empty cell values as text, by reference: { B7: "Competition Squat", … }. */
  function cells(sheetName) {
    const sheet = sheets.find((s) => s.name === sheetName);
    if (!sheet) throw new Error(`no sheet "${sheetName}"`);
    const values = {};
    const xml = read(sheet.file);
    for (const cell of xml.matchAll(/<c r="([A-Z]+\d+)"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const [, ref, attrs, inner = ""] = cell;
      const type = /t="([^"]+)"/.exec(attrs)?.[1];
      const raw = /<v>([\s\S]*?)<\/v>/.exec(inner)?.[1];
      const inline = /<is>[\s\S]*?<t[^>]*>([\s\S]*?)<\/t>/.exec(inner)?.[1];
      const value = raw === undefined ? inline : type === "s" ? shared[Number(raw)] : decode(raw);
      if (value !== undefined && value.trim() !== "") values[ref] = value;
    }
    return values;
  }

  return { sheets, cells };
}
