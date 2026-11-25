// Every page's layout at three widths: in the middle of a wide screen, Postavke as a list on a
// narrow window, and nothing wider than a phone. Usage: node e2e-layout.mjs
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { launch } from "./cdp.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const APP = process.env.E2E_APP ?? "http://localhost:5199";
const PAGES = [
  ["Početna", "/"],
  ["Trening", "/log"],
  ["Programi", "/programs"],
  ["Prehrana", "/nutrition"],
  ["Kalendar", "/calendar"],
  ["Kalkulator", "/calculator"],
  ["Statistika", "/stats"],
  ["Postavke", "/settings"],
];

const results = [];
const expect = (condition, message) => {
  if (!condition) throw new Error(message);
};
async function step(name, run) {
  try {
    await run();
    results.push(`PASS  ${name}`);
  } catch (err) {
    results.push(`FAIL  ${name}\n        ${String(err.message).split("\n")[0]}`);
  }
}

// Opens a page and waits for its heading and fonts, so its box has its final size.
async function open(browser, path) {
  await browser.navigate(`${APP}${path}`);
  await browser.waitFor(`document.querySelector('h1') && document.fonts.status === 'loaded'`, path, 20000);
  await browser.evaluate("new Promise((resolve) => setTimeout(resolve, 400))");
}
const pageBox = `(() => { const page = document.querySelector('[class*="_routes_"] > *'); const box = page.getBoundingClientRect(); return { left: Math.round(box.left), right: Math.round(innerWidth - box.right), width: Math.round(box.width) }; })()`;

for (const [label, width, height, mobile] of [
  ["wide", 1600, 900, false],
  ["narrow window", 800, 900, false],
  ["phone", 390, 844, true],
]) {
  const browser = await launch({ port: 9370, profile: join(here, `chrome-profile-e2e-layout-${width}`), width, height, mobile });
  try {
    if (label === "wide") {
      await step("on a wide screen every page sits in the middle, within its own width", async () => {
        const off = [];
        for (const [name, path] of PAGES) {
          await open(browser, path);
          const box = await browser.evaluate(pageBox);
          if (Math.abs(box.left - box.right) > 2 || box.width > 1120) off.push(`${name} ${box.left}/${box.right}/${box.width}`);
        }
        expect(off.length === 0, `not in the middle: ${off.join(", ")}`);
      });
    }
    if (label === "narrow window") {
      await step("a window narrower than 900px gets Postavke as a list, without the side menu", async () => {
        await open(browser, "/settings");
        const list = await browser.evaluate(`document.querySelectorAll('nav[aria-label="Odjeljci postavki"] button').length`);
        const links = await browser.evaluate(`document.querySelectorAll('nav[aria-label="Odjeljci postavki"] a').length`);
        expect(list === 6 && links === 0, `list items ${list}, menu links ${links}`);
      });
    }
    await step(`at ${label} width (${width}px) no page is wider than the window`, async () => {
      const wide = [];
      for (const [name, path] of PAGES) {
        await open(browser, path);
        const sizes = await browser.evaluate(`[document.documentElement.scrollWidth, innerWidth]`);
        if (sizes[0] > sizes[1]) wide.push(`${name} ${sizes[0]}>${sizes[1]}`);
      }
      expect(wide.length === 0, `scrolls sideways: ${wide.join(", ")}`);
    });
    if (label === "phone") {
      await step("on a phone the tab bar is at the bottom of every page", async () => {
        const missing = [];
        for (const [name, path] of PAGES) {
          await open(browser, path);
          const atBottom = await browser.evaluate(
            `(() => { const bar = [...document.querySelectorAll('nav')].find((nav) => getComputedStyle(nav).position === 'fixed'); if (!bar) return false; const box = bar.getBoundingClientRect(); return Math.abs(box.bottom - innerHeight) <= 1; })()`,
          );
          if (!atBottom) missing.push(name);
        }
        expect(missing.length === 0, `no tab bar at the bottom: ${missing.join(", ")}`);
      });
    }
    await step(`at ${label} width the pages made no errors of their own`, async () => {
      const ours = browser.problems.filter((problem) => !problem.includes("chrome-extension://"));
      expect(ours.length === 0, ours.join(" || "));
    });
  } finally {
    await browser.close();
  }
}

console.log(results.join("\n"));
const failed = results.filter((line) => line.startsWith("FAIL")).length;
console.log(`\n${results.length - failed} passed, ${failed} failed (layout)`);
