// Writes a Y4M video (Chrome's --use-file-for-fake-video-capture) of an EAN-13 barcode on white,
// so a fake camera shows a barcode that can really be read.
// Usage: node make-barcode-y4m.mjs <13 digits> <out.y4m>
import { writeFileSync } from "node:fs";

const [digits, out] = process.argv.slice(2);
if (!/^\d{13}$/.test(digits ?? "")) throw new Error("give 13 digits");

const L = ["0001101", "0011001", "0010011", "0111101", "0100011", "0110001", "0101111", "0111011", "0110111", "0001011"];
const G = ["0100111", "0110011", "0011011", "0100001", "0011101", "0111001", "0000101", "0010001", "0001001", "0010111"];
const R = ["1110010", "1100110", "1101100", "1000010", "1011100", "1001110", "1010000", "1000100", "1001000", "1110100"];
const PARITY = ["LLLLLL", "LLGLGG", "LLGGLG", "LLGGGL", "LGLLGG", "LGGLLG", "LGGGLL", "LGLGLG", "LGLGGL", "LGGLGL"];

const [first, ...rest] = digits.split("").map(Number);
let modules = "101";
rest.slice(0, 6).forEach((digit, index) => {
  modules += (PARITY[first][index] === "L" ? L : G)[digit];
});
modules += "01010";
rest.slice(6).forEach((digit) => {
  modules += R[digit];
});
modules += "101";

const WIDTH = 640;
const HEIGHT = 480;
const MODULE = 4;
const BAR_HEIGHT = 200;
const left = Math.floor((WIDTH - modules.length * MODULE) / 2);
const top = Math.floor((HEIGHT - BAR_HEIGHT) / 2);

const luma = Buffer.alloc(WIDTH * HEIGHT, 235);
for (let y = top; y < top + BAR_HEIGHT; y++) {
  for (let m = 0; m < modules.length; m++) {
    if (modules[m] !== "1") continue;
    luma.fill(16, y * WIDTH + left + m * MODULE, y * WIDTH + left + (m + 1) * MODULE);
  }
}
const chroma = Buffer.alloc((WIDTH / 2) * (HEIGHT / 2), 128);
const frame = Buffer.concat([Buffer.from("FRAME\n"), luma, chroma, chroma]);
const FRAMES = 10;
const header = Buffer.from(`YUV4MPEG2 W${WIDTH} H${HEIGHT} F10:1 Ip A1:1 C420jpeg\n`);
writeFileSync(out, Buffer.concat([header, ...Array.from({ length: FRAMES }, () => frame)]));
console.log(`${out}: ${modules.length} modules, ${FRAMES} frames`);
