// End-to-end run of Kalkulator against the test backend (only settings are read from it).
// Usage: node e2e-calculator.mjs [--phone]
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { mkdirSync } from "node:fs";
import { launch, sleep } from "./cdp.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const phone = process.argv.includes("--phone");
const shots = join(here, "shots", `e2e-calculator${phone ? "-phone" : ""}`);
mkdirSync(shots, { recursive: true });
const APP = process.env.E2E_APP ?? "http://localhost:5199";
const API = "http://localhost:3002";

async function putSettings(json) {
  const response = await fetch(`${API}/api/settings`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(json),
  });
  if (!response.ok) throw new Error(`settings: ${response.status}`);
}
await putSettings({ language: "hr", theme: "auto", template: "moderna", e1rmFormula: "brzycki" });

const results = [];
function expect(condition, message) {
  if (!condition) throw new Error(message);
}
const browser = await launch({
  port: 9346,
  profile: join(here, "chrome-profile-e2e-calculator"),
  width: phone ? 390 : 1280,
  height: phone ? 844 : 900,
  mobile: phone,
});
const { evaluate, waitFor, click, type } = browser;

// A percentage as the page writes it in Croatian: "10 %" with a no-break space.
const pct = (value) => `${value}\\u00a0%`;
const section = (title) =>
  `[...document.querySelectorAll('section')].find((s) => s.querySelector('h2')?.textContent === ${JSON.stringify(title)})`;
const field = (title, label) =>
  `[...${section(title)}.querySelectorAll('label')].find((l) => l.textContent === ${JSON.stringify(label)}).control`;
const textOf = (expression) => evaluate(`(${expression})?.innerText.replace(/\\s+/g, ' ').trim()`);
const ONE_RM = "Procjena 1RM";
const PERCENT = "Postoci od 1RM";
const PLATES = "Kalkulator pločica";
const WARMUP = "Zagrijavanje";
const bigNumber = () => textOf(`${section(ONE_RM)}.querySelector('[class*="_bigNumber_"]')`);
const percentRows = () =>
  evaluate(`[...${section(PERCENT)}.querySelectorAll('li')].map((li) => li.innerText.replace(/\\s+/g, ' ').trim())`);
const plateText = () => textOf(`${section(PLATES)}.querySelector('[class*="_result_"]') ?? ${section(PLATES)}.querySelector('[class*="_note_"]')`);
const chip = (label) => `__e2e.byText('button', ${JSON.stringify(label)}, ${section(PLATES)})`;

async function step(name, run) {
  try {
    await run();
    results.push(`PASS  ${name}`);
  } catch (err) {
    results.push(`FAIL  ${name}\n        ${String(err.message).split("\n")[0]}`);
    await browser.screenshot(join(shots, `FAIL-${results.length}.png`)).catch(() => {});
  }
}

try {
  await browser.navigate(`${APP}/calculator`);
  await evaluate(`localStorage.removeItem('ironlog-plate-setup')`);
  await browser.navigate(`${APP}/calculator`);
  await waitFor(`${section(ONE_RM)} && document.fonts.status === 'loaded'`, "the page", 10000);

  await step("the 1RM is worked out as weight and reps are typed, with the formula named", async () => {
    expect((await bigNumber()) === "—", `before typing: ${await bigNumber()}`);
    await type(field(ONE_RM, "Kilaža (kg)"), "100");
    await type(field(ONE_RM, "Ponavljanja"), "5");
    await waitFor(`${section(ONE_RM)}.innerText.includes('112,5 kg')`, "112,5 kg");
    const detail = await textOf(`${section(ONE_RM)}.querySelector('[class*="_detail_"]')`);
    expect(detail === "Formula: Brzycki · mijenja se u Postavkama", `detail: ${detail}`);
  });

  await step("RPE adds the reps left in reserve", async () => {
    await type(field(ONE_RM, "RPE"), "8");
    expect((await bigNumber()) === "120 kg", `with RPE 8: ${await bigNumber()}`);
    await type(field(ONE_RM, "RPE"), "");
  });

  await step("a weight with a decimal comma counts as typed", async () => {
    await type(field(ONE_RM, "Kilaža (kg)"), "102,5");
    await type(field(ONE_RM, "Ponavljanja"), "3");
    expect((await bigNumber()) === "108,5 kg", `102,5 × 3: ${await bigNumber()}`);
  });

  await step("past 15 reps to failure the 1RM is still worked out, marked rough; past Brzycki's 36 it is not", async () => {
    await type(field(ONE_RM, "Ponavljanja"), "14");
    await type(field(ONE_RM, "RPE"), "8");
    // 102,5 kg and 16 reps to failure: 102,5 × 36 / 21.
    expect((await bigNumber()) === "≈ 175,7 kg", `14 @ 8: ${await bigNumber()}`);
    const detail = await textOf(`${section(ONE_RM)}.querySelector('[class*="_detail_"]')`);
    expect(detail.startsWith("Gruba procjena: više od 15 ponavljanja do otkaza"), `detail: ${detail}`);
    expect(await evaluate(`!!${section(PERCENT)}`), "no percentages for a rough 1RM");
    await type(field(ONE_RM, "Ponavljanja"), "37");
    await type(field(ONE_RM, "RPE"), "");
    expect((await bigNumber()) === "—", `37 to failure: ${await bigNumber()}`);
    expect(
      await evaluate(`${section(ONE_RM)}.innerText.includes('Brzycki ne računa više od 36 ponavljanja do otkaza')`),
      "no reason given past Brzycki's limit",
    );
    expect(!(await evaluate(`!!${section(PERCENT)}`)), "percentages shown without a 1RM");
  });

  // − and + around a field: the buttons beside its input.
  const minus = (title, label) => `${field(title, label)}.parentElement.querySelector('button:first-of-type')`;
  const plus = (title, label) => `${field(title, label)}.parentElement.querySelector('button:last-of-type')`;
  const valueOf = (title, label) => evaluate(`${field(title, label)}.value`);
  const shownButtons = (title) =>
    evaluate(`[...${section(title)}.querySelectorAll('button')].filter((b) => __e2e.visible(b) && b.closest('[class*="_field_"]')).map((b) => Math.round(b.getBoundingClientRect().height))`);

  if (phone) {
    await step("on a phone the 1RM fields are rows with − and +, starting from sensible numbers", async () => {
      await type(field(ONE_RM, "Kilaža (kg)"), "");
      await type(field(ONE_RM, "Ponavljanja"), "");
      await type(field(ONE_RM, "RPE"), "");
      // An empty weight starts at the empty bar, then goes by 2,5.
      await click(plus(ONE_RM, "Kilaža (kg)"));
      expect((await valueOf(ONE_RM, "Kilaža (kg)")) === "20", `first +: ${await valueOf(ONE_RM, "Kilaža (kg)")}`);
      await click(plus(ONE_RM, "Kilaža (kg)"));
      expect((await valueOf(ONE_RM, "Kilaža (kg)")) === "22,5", `second +: ${await valueOf(ONE_RM, "Kilaža (kg)")}`);
      await click(minus(ONE_RM, "Ponavljanja"));
      await click(minus(ONE_RM, "Ponavljanja"));
      expect((await valueOf(ONE_RM, "Ponavljanja")) === "4", `reps: ${await valueOf(ONE_RM, "Ponavljanja")}`);
      await click(plus(ONE_RM, "RPE"));
      await click(plus(ONE_RM, "RPE"));
      expect((await valueOf(ONE_RM, "RPE")) === "8,5", `RPE: ${await valueOf(ONE_RM, "RPE")}`);
      // 22,5 kg × 4 @ 8,5 = 5,5 reps to failure: 22,5 × 36 / 31,5.
      expect((await bigNumber()) === "25,7 kg", `stepped 1RM: ${await bigNumber()}`);
      await click(plus(ONE_RM, "RPE"));
      await click(plus(ONE_RM, "RPE"));
      await click(plus(ONE_RM, "RPE"));
      expect((await valueOf(ONE_RM, "RPE")) === "10", `RPE past 10: ${await valueOf(ONE_RM, "RPE")}`);
      const besides = await evaluate(`(() => {
        const input = ${field(ONE_RM, "Kilaža (kg)")};
        const name = input.closest('[class*="_field_"]').querySelector('label').getBoundingClientRect();
        const box = input.getBoundingClientRect();
        return Math.abs(name.top + name.height / 2 - (box.top + box.height / 2)) < 6 && name.right <= box.left;
      })()`);
      expect(besides, "the name is not beside the number");
      const sizes = await shownButtons(ONE_RM);
      expect(sizes.length === 6 && sizes.every((height) => height >= 44), `buttons: ${sizes.join(", ")}`);
      expect(await evaluate(`document.documentElement.scrollWidth <= innerWidth`), "the page scrolls sideways");
    });
  } else {
    await step("on a computer the fields stay plain boxes, without − and +", async () => {
      const sizes = await shownButtons(ONE_RM);
      expect(sizes.length === 0, `${sizes.length} buttons showing`);
    });
  }

  await step("percentages follow the 1RM, from 100 % down to 70 % in 5 % steps", async () => {
    await type(field(ONE_RM, "Kilaža (kg)"), "100");
    await type(field(ONE_RM, "Ponavljanja"), "5");
    await type(field(ONE_RM, "RPE"), "");
    await waitFor(section(PERCENT), "the percentages");
    const rows = await percentRows();
    expect(rows.length === 7, `${rows.length} rows: ${rows.join(" | ")}`);
    expect(rows[0] === "100 % 112,5 kg" && rows[1] === "95 % 106,9 kg" && rows[6] === "70 % 78,8 kg", `rows: ${rows.join(" | ")}`);
  });

  await step("the step and the floor change the list", async () => {
    await click(`__e2e.byText('button', '${pct(10)}', ${section(PERCENT)}.querySelector('[role="group"][aria-label="Korak"]'))`);
    expect((await percentRows()).length === 4, "10 % steps");
    await click(`__e2e.byText('button', '${pct(50)}', ${section(PERCENT)}.querySelector('[role="group"][aria-label="Do"]'))`);
    expect((await percentRows()).length === 6, "10 % steps down to 50 %");
    await click(`__e2e.byText('button', '${pct("2,5")}', ${section(PERCENT)})`);
    const rows = await percentRows();
    expect(rows.length === 21 && rows[1] === "97,5 % 109,7 kg", `2,5 % steps: ${rows.length}, ${rows[1]}`);
    await click(`__e2e.byText('button', '${pct(5)}', ${section(PERCENT)})`);
    await click(`__e2e.byText('button', '${pct(70)}', ${section(PERCENT)})`);
    expect((await percentRows()).length === 7, "back to 5 % down to 70 %");
  });

  await step("a percentage goes into the plate calculator, which comes into view", async () => {
    await click(`[...${section(PERCENT)}.querySelectorAll('li button')][2]`);
    await waitFor(`${field(PLATES, "Ukupna kilaža (kg)")}.value === '101,3'`, "101,3 in the plate calculator");
    // In view above the phone's tab bar; the page may end before the card can reach the top.
    await waitFor(
      `(() => { const box = ${field(PLATES, "Ukupna kilaža (kg)")}.getBoundingClientRect(); return box.top >= 0 && box.bottom <= innerHeight - 80; })()`,
      "the plate calculator in view",
    );
    // The scroll is smooth: clicks before it stops land where things were.
    await waitFor(
      `new Promise((resolve) => { const y = scrollY; setTimeout(() => resolve(scrollY === y), 200); })`,
      "the scroll to stop",
    );
    const text = await plateText();
    expect(text.includes("Po strani: 25 + 15") && text.includes("Najbliže moguće: 100 kg (fali 1,3 kg)"), `plates: ${text}`);
  });

  await step("a typed total is loaded with the fewest plates, drawn on the bar", async () => {
    await type(field(PLATES, "Ukupna kilaža (kg)"), "142,5");
    expect((await plateText()) === "Po strani: 25 + 25 + 10 + 1,25", `plates: ${await plateText()}`);
    const drawn = await evaluate(`${section(PLATES)}.querySelectorAll('[class*="_barbell_"] [class*="_plate_"]').length`);
    expect(drawn === 8, `${drawn} plates drawn`);
  });

  await step("a plate taken away changes the load, and the gym's plates are kept", async () => {
    await click(chip("1,25"));
    expect((await evaluate(`${chip("1,25")}.getAttribute('aria-pressed')`)) === "false", "the chip stayed pressed");
    const text = await plateText();
    expect(text.includes("Po strani: 25 + 25 + 10") && text.includes("Najbliže moguće: 140 kg (fali 2,5 kg)"), `without 1,25: ${text}`);
    await browser.navigate(`${APP}/calculator`);
    try {
      await waitFor(chip("1,25"), "the page again", 15000);
    } catch (err) {
      const state = await evaluate(
        `JSON.stringify({ url: location.href, readyState: document.readyState, root: document.getElementById('root')?.innerHTML.length ?? null, html: document.documentElement.outerHTML.length })`,
      );
      throw new Error(`${err.message}; the page: ${state}`);
    }
    expect((await evaluate(`${chip("1,25")}.getAttribute('aria-pressed')`)) === "false", "the setup was not kept");
    await click(chip("1,25"));
    expect((await evaluate(`${chip("1,25")}.getAttribute('aria-pressed')`)) === "true", "the plate did not come back");
  });

  await step("the bar and the collars count", async () => {
    await type(field(PLATES, "Ukupna kilaža (kg)"), "142,5");
    await click(chip("15 kg"));
    expect((await plateText()) === "Po strani: 25 + 25 + 10 + 2,5 + 1,25", `15 kg bar: ${await plateText()}`);
    await click(chip("20 kg"));
    await click(`[...${section(PLATES)}.querySelectorAll('button')].find((b) => b.textContent.startsWith('Obruči'))`);
    expect((await plateText()) === "Po strani: 25 + 25 + 5 + 2,5 + 1,25", `with collars: ${await plateText()}`);
    await click(`[...${section(PLATES)}.querySelectorAll('button')].find((b) => b.textContent.startsWith('Obruči'))`);
  });

  await step("a total lighter than the bar says so", async () => {
    await type(field(PLATES, "Ukupna kilaža (kg)"), "15");
    expect((await plateText()) === "Lakše od prazne šipke (20 kg)", `15 kg: ${await plateText()}`);
  });

  if (phone) {
    await step("on a phone the plate total starts at the empty bar and goes up by what the plates allow", async () => {
      await type(field(PLATES, "Ukupna kilaža (kg)"), "");
      await click(plus(PLATES, "Ukupna kilaža (kg)"));
      expect((await valueOf(PLATES, "Ukupna kilaža (kg)")) === "20", `first +: ${await valueOf(PLATES, "Ukupna kilaža (kg)")}`);
      // The smallest plate here is 1,25: one each side is 2,5 kg more.
      await click(plus(PLATES, "Ukupna kilaža (kg)"));
      expect((await valueOf(PLATES, "Ukupna kilaža (kg)")) === "22,5", `second +: ${await valueOf(PLATES, "Ukupna kilaža (kg)")}`);
      expect((await plateText()) === "Po strani: 1,25", `plates: ${await plateText()}`);
      await click(plus(WARMUP, "Radna kilaža (kg)"));
      expect((await valueOf(WARMUP, "Radna kilaža (kg)")) === "20", `warm-up +: ${await valueOf(WARMUP, "Radna kilaža (kg)")}`);
      await type(field(WARMUP, "Radna kilaža (kg)"), "");
    });
  }

  await step("the warm-up ramps up to the working weight, with the plates for each step", async () => {
    await type(field(WARMUP, "Radna kilaža (kg)"), "140");
    const rows = await evaluate(`[...${section(WARMUP)}.querySelectorAll('li')].map((li) => li.innerText.replace(/\\s+/g, ' ').trim())`);
    expect(rows.length === 6, `${rows.length} rows: ${rows.join(" | ")}`);
    expect(rows[0] === "Šipka 20 kg × 10" && rows[1] === "40 % 55 kg × 5 15 + 2,5", `rows: ${rows.join(" | ")}`);
  });

  await step("a warm-up step goes into the plate calculator", async () => {
    await click(`[...${section(WARMUP)}.querySelectorAll('li button')][4]`);
    await waitFor(`${field(PLATES, "Ukupna kilaža (kg)")}.value === '112,5'`, "112,5 in the plate calculator");
    expect((await plateText()) === "Po strani: 25 + 20 + 1,25", `plates: ${await plateText()}`);
  });

  await step("in English the numbers have a point and the percentages no space", async () => {
    await putSettings({ language: "en" });
    await browser.navigate(`${APP}/calculator`);
    await waitFor(section("One-rep max estimate"), "the English page");
    await type(field("One-rep max estimate", "Weight (kg)"), "102.5");
    await type(field("One-rep max estimate", "Reps"), "3");
    const number = await textOf(`${section("One-rep max estimate")}.querySelector('[class*="_bigNumber_"]')`);
    expect(number === "108.5 kg", `English e1RM: ${number}`);
    const first = await evaluate(`${section("Percentages of 1RM")}.querySelector('li').innerText.replace(/\\s+/g, ' ').trim()`);
    expect(first === "100% 108.5 kg", `English first row: ${first}`);
  });

  await step("the page made no errors of its own", async () => {
    const ours = browser.problems.filter((problem) => !problem.includes("chrome-extension://"));
    expect(ours.length === 0, ours.join(" || "));
  });

  await sleep(300);
  await browser.screenshot(join(shots, "end.png"));
} finally {
  await putSettings({ language: "hr" });
  console.log(results.join("\n"));
  const failed = results.filter((line) => line.startsWith("FAIL")).length;
  console.log(`\n${results.length - failed} passed, ${failed} failed (calculator${phone ? ", phone" : ""})`);
  await browser.close();
}
