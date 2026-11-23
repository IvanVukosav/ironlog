// Writes an unzipped Word document's (.docx) text as plain lines: a line per paragraph and per
// line break, for convert-rts-text.mjs. Usage: node docx-text.mjs <unzipped docx folder> <out.txt>
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const [folder, outPath] = process.argv.slice(2);
if (!outPath) throw new Error("usage: node docx-text.mjs <unzipped docx folder> <out.txt>");
const xml = readFileSync(join(folder, "word/document.xml"), "utf8");
const decode = (text) =>
  text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
const lines = [...xml.matchAll(/<w:p[ >][\s\S]*?<\/w:p>/g)].flatMap((paragraph) =>
  // A paragraph's runs in order: text, tabs, and breaks that start a new line.
  [...paragraph[0].matchAll(/<w:t[^>]*>([^<]*)<\/w:t>|<w:tab\/>|<w:br\/>|<w:cr\/>/g)]
    .map((m) => (m[1] !== undefined ? decode(m[1]) : m[0] === "<w:tab/>" ? "\t" : "\n"))
    .join("")
    .split("\n"),
);
writeFileSync(outPath, lines.join("\n") + "\n");
console.log(`${lines.length} lines written to ${outPath}`);
