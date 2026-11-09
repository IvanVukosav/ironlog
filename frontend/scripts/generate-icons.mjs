// Generates the app icons (favicon.svg + PWA PNGs) from one shape list.
// No dependencies: shapes are rasterized with 4×4 supersampling and written
// as PNG with node:zlib. Run: node scripts/generate-icons.mjs
import { writeFileSync, mkdirSync } from "node:fs";
import { deflateSync, crc32 } from "node:zlib";

const DESIGN_SIZE = 512;
const SUPERSAMPLE = 4;
const BACKGROUND = "#0d0d0d";
const PLATE = "#ff3b3b";
const BAR = "#9e9e9e";
const COLLAR = "#bdbdbd";

// Barbell in a 512 grid, kept inside the maskable safe zone (80 % circle).
function mirrored(x, width) {
  return DESIGN_SIZE - x - width;
}
const BARBELL = [
  { x: 56, y: 244, width: 400, height: 24, radius: 6, color: BAR },
  ...[
    { x: 112, y: 136, width: 40, height: 240, radius: 10, color: PLATE },
    { x: 156, y: 176, width: 28, height: 160, radius: 8, color: PLATE },
    { x: 188, y: 220, width: 12, height: 72, radius: 4, color: COLLAR },
  ].flatMap((shape) => [shape, { ...shape, x: mirrored(shape.x, shape.width) }]),
];

function shapesFor({ rounded }) {
  return [
    {
      x: 0,
      y: 0,
      width: DESIGN_SIZE,
      height: DESIGN_SIZE,
      radius: rounded ? 96 : 0,
      color: BACKGROUND,
    },
    ...BARBELL,
  ];
}

function insideRoundedRect(px, py, { x, y, width, height, radius }) {
  if (px < x || px > x + width || py < y || py > y + height) return false;
  const cornerX = Math.min(Math.max(px, x + radius), x + width - radius);
  const cornerY = Math.min(Math.max(py, y + radius), y + height - radius);
  return (px - cornerX) ** 2 + (py - cornerY) ** 2 <= radius ** 2;
}

function hexToRgb(hex) {
  const value = parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function rasterize(size, shapes) {
  const scale = DESIGN_SIZE / size;
  const rgbShapes = shapes.map((shape) => ({ ...shape, rgb: hexToRgb(shape.color) }));
  const pixels = Buffer.alloc(size * size * 4);

  for (let row = 0; row < size; row++) {
    for (let column = 0; column < size; column++) {
      const sum = [0, 0, 0, 0];
      for (let sampleY = 0; sampleY < SUPERSAMPLE; sampleY++) {
        for (let sampleX = 0; sampleX < SUPERSAMPLE; sampleX++) {
          const px = (column + (sampleX + 0.5) / SUPERSAMPLE) * scale;
          const py = (row + (sampleY + 0.5) / SUPERSAMPLE) * scale;
          const top = rgbShapes.findLast((shape) => insideRoundedRect(px, py, shape));
          if (top) {
            sum[0] += top.rgb[0];
            sum[1] += top.rgb[1];
            sum[2] += top.rgb[2];
            sum[3] += 255;
          }
        }
      }
      const samples = SUPERSAMPLE * SUPERSAMPLE;
      const coverage = sum[3] / 255;
      const offset = (row * size + column) * 4;
      // Average color over covered samples only, alpha from coverage.
      pixels[offset] = coverage ? Math.round(sum[0] / coverage) : 0;
      pixels[offset + 1] = coverage ? Math.round(sum[1] / coverage) : 0;
      pixels[offset + 2] = coverage ? Math.round(sum[2] / coverage) : 0;
      pixels[offset + 3] = Math.round(sum[3] / samples);
    }
  }
  return pixels;
}

function pngChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const typeAndData = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndData));
  return Buffer.concat([length, typeAndData, crc]);
}

function encodePng(size, pixels) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8; // bit depth
  header[9] = 6; // RGBA
  const rowLength = size * 4;
  const scanlines = Buffer.alloc((rowLength + 1) * size);
  for (let row = 0; row < size; row++) {
    pixels.copy(scanlines, row * (rowLength + 1) + 1, row * rowLength, (row + 1) * rowLength);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", header),
    pngChunk("IDAT", deflateSync(scanlines)),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

function toSvg(shapes) {
  const rects = shapes
    .map(
      ({ x, y, width, height, radius, color }) =>
        `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${radius}" fill="${color}"/>`,
    )
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${DESIGN_SIZE} ${DESIGN_SIZE}">${rects}</svg>\n`;
}

const outputDir = new URL("../public/", import.meta.url);
mkdirSync(new URL("icons/", outputDir), { recursive: true });

writeFileSync(new URL("favicon.svg", outputDir), toSvg(shapesFor({ rounded: true })));
const icons = [
  { file: "icons/icon-192.png", size: 192, rounded: true },
  { file: "icons/icon-512.png", size: 512, rounded: true },
  // Maskable and Apple icons are full-bleed: the OS applies its own mask.
  { file: "icons/icon-maskable-512.png", size: 512, rounded: false },
  { file: "icons/apple-touch-icon.png", size: 180, rounded: false },
];
for (const { file, size, rounded } of icons) {
  writeFileSync(new URL(file, outputDir), encodePng(size, rasterize(size, shapesFor({ rounded }))));
  console.log("wrote", file);
}
