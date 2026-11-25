// Postavke in the new layout: each control shows what is saved and saves a change.
// Usage: node e2e-settings.mjs [phone]
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { launch } from "./cdp.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const APP = process.env.E2E_APP ?? "http://localhost:5199";
const API = "http://localhost:3002";
const phone = process.argv[2] === "phone";
const pad = (value) => String(value).padStart(2, "0");
const now = new Date();
const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

async function api(path, method = "GET", json) {
  const response = await fetch(`${API}${path}`, {
    method,
    headers: json ? { "Content-Type": "application/json" } : undefined,
    body: json ? JSON.stringify(json) : undefined,
  });
  return response.json();
}

const START = {
  language: "hr",
  theme: "auto",
  template: "moderna",
  kcalGoal: 2500,
  proteinGoal: 180,
  carbsGoal: 250,
  fatGoal: 80,
  trainingsPerWeek: 4,
  restSeconds: 120,
  showE1rm: true,
  e1rmFormula: "brzycki",
  exercisePickerMode: "chips",
  showWorkoutWidget: true,
  showNutritionWidget: true,
  showPrWidget: true,
  showPowerliftingTotal: false,
  sex: "male",
  squatExercise: null,
  benchExercise: null,
  deadliftExercise: null,
};

const results = [];
const expect = (condition, message) => {
  if (!condition) throw new Error(message);
};
const browser = await launch({
  port: phone ? 9362 : 9361,
  profile: join(here, `chrome-profile-e2e-settings-${phone ? "phone" : "desktop"}`),
  // A real screen height: in a taller window the wide page has nothing to scroll for the menu.
  ...(phone ? { width: 390, height: 844, mobile: true } : { width: 1280, height: 900 }),
});
const { waitFor, click, type, press, evaluate } = browser;

// Controls found the way a person finds them: by what they are called.
const json = (value) => JSON.stringify(value);
// A button's name as a screen reader reads it: its text without the parts hidden from one, and
// without a chip's note ("automatski" on the theme Automatski shows now).
const nameOf = `((el) => { const copy = el.cloneNode(true); copy.querySelectorAll('[aria-hidden="true"], [class*="_chipNote_"]').forEach((node) => node.remove()); return copy.textContent.trim(); })`;
const option = (group, text) =>
  `[...document.querySelectorAll('[role="group"][aria-label=${json(group)}] button')].find((b) => ${nameOf}(b) === ${json(text)})`;
const noteOf = (group, text) => `(${option(group, text)}?.querySelector('[class*="_chipNote_"]')?.textContent ?? null)`;
const toggle = (text) =>
  `[...document.querySelectorAll('[role="switch"]')].find((b) => b.textContent.includes(${json(text)}))`;
const field = (text) =>
  `(() => { const label = [...document.querySelectorAll('label')].find((l) => l.textContent.trim() === ${json(text)}); return label ? document.getElementById(label.htmlFor) : null; })()`;
const button = (text) => `__e2e.byText('button', ${json(text)})`;
const isPressed = (element) => evaluate(`${element}?.getAttribute('aria-pressed') === 'true'`);
const isOn = (element) => evaluate(`${element}?.getAttribute('aria-checked') === 'true'`);
// Waits until the server has what the page sent.
const saved = (name, value) =>
  waitFor(
    `fetch('${API}/api/settings').then((r) => r.json()).then((s) => s[${json(name)}] === ${json(value)})`,
    `${name} saved as ${json(value)}`,
  );

// The wide page's menu (links that jump to a section) and the phone's list (buttons that open one).
const menuItem = (text) =>
  `[...document.querySelectorAll('nav[aria-label="Odjeljci postavki"] a')].find((a) => a.textContent.trim() === ${json(text)})`;
const listItem = (title) =>
  `[...document.querySelectorAll('nav[aria-label="Odjeljci postavki"] button')].find((b) => b.querySelector('span span')?.textContent.trim() === ${json(title)})`;
const listTitles = `[...document.querySelectorAll('nav[aria-label="Odjeljci postavki"] button')].map((b) => b.querySelector('span span')?.textContent.trim())`;
const heading = `document.querySelector('h1')?.textContent.trim()`;
// On a phone a section is opened from the list (back to the list first, if one is open) before
// its controls are used; the wide page shows them all.
const openSection = async (title) => {
  if (!phone) return;
  if ((await evaluate(heading)) === title) return;
  if (await evaluate(`!!__e2e.byText('button', 'Postavke')`)) {
    await click(`__e2e.byText('button', 'Postavke')`);
    await waitFor(`${heading} === 'Postavke'`, "the list again");
  }
  await click(listItem(title));
  await waitFor(`${heading} === ${json(title)}`, `${title} open`);
};

async function step(name, run) {
  try {
    await run();
    results.push(`PASS  ${name}`);
  } catch (err) {
    results.push(`FAIL  ${name}\n        ${String(err.message).split("\n")[0]}`);
  }
}

try {
  await api("/api/settings", "PUT", START);
  for (const workout of await api("/api/workouts?limit=1000")) await api(`/api/workouts/${workout.id}`, "DELETE");
  const workout = await api("/api/workouts", "POST", { date: today });
  await api(`/api/workouts/${workout.id}/exercises/bulk`, "POST", {
    exercises: [
      { name: "Čučanj", sets: [{ weight: 140, reps: 5 }] },
      { name: "Bench press", sets: [{ weight: 100, reps: 5 }] },
      { name: "Mrtvo dizanje", sets: [{ weight: 180, reps: 5 }] },
    ],
  });
  await api("/api/bodyweight", "POST", { date: today, weight: 82.5 });

  const SECTION_TITLES = ["Izgled", "Ciljevi", "Trening", "Kartice na Početnoj", "Powerlifting", "Backup i izvoz"];

  if (phone) {
    await step("on a phone Postavke is a list of sections, each saying how it is set", async () => {
      await browser.navigate(`${APP}/settings`);
      await waitFor(`${listItem("Ciljevi")}?.textContent.includes('2500 kcal')`, "the list with the saved goals", 20000);
      expect(json(await evaluate(listTitles)) === json(SECTION_TITLES), `list: ${(await evaluate(listTitles)).join(", ")}`);
      const summaries = await evaluate(
        `[...document.querySelectorAll('nav[aria-label="Odjeljci postavki"] button')].map((b) => b.querySelector('span span:last-child')?.textContent.trim())`,
      );
      const expected = [
        "Hrvatski · Automatski · Moderna",
        "2500 kcal · 180 g bjelančevina",
        "Odmor 2:00 · Brzycki",
        "Uključeno 3 od 3",
        "Isključeno",
        "JSON za čuvanje, CSV za Excel",
      ];
      expect(json(summaries) === json(expected), `summaries: ${summaries.join(" | ")}`);
      expect(await evaluate(`document.documentElement.scrollWidth <= innerWidth`), "the page scrolls sideways");
      const small = await evaluate(
        `[...document.querySelectorAll('nav button')].filter((el) => __e2e.visible(el) && el.getBoundingClientRect().height < 44).map((el) => el.textContent.trim()).slice(0, 5)`,
      );
      expect(small.length === 0, `too small to hit: ${small.join(" | ")}`);
    });

    await step("a section opens on its own, and ‹ Postavke or Back return to the list", async () => {
      await click(listItem("Ciljevi"));
      await waitFor(`${heading} === 'Ciljevi'`, "Ciljevi open");
      expect((await evaluate("location.search")) === "?section=goals", `address: ${await evaluate("location.search")}`);
      const goals = await evaluate(
        `['Kalorije (kcal)', 'Bjelančevine (g)', 'Ugljikohidrati (g)', 'Masti (g)', 'Treninga tjedno'].map((name) => ${field("NAME").replace('"NAME"', "name")}?.value)`,
      );
      expect(json(goals) === json(["2500", "180", "250", "80", "4"]), `goals: ${goals.join(", ")}`);
      await click(`__e2e.byText('button', 'Postavke')`);
      await waitFor(`${heading} === 'Postavke'`, "the list after ‹ Postavke");
      expect((await evaluate("location.search")) === "", `address after ‹ Postavke: ${await evaluate("location.search")}`);
      await click(listItem("Trening"));
      await waitFor(`${heading} === 'Trening'`, "Trening open");
      await evaluate("history.back()");
      await waitFor(`${heading} === 'Postavke'`, "the list after Back");
      // A link straight to a section opens it; ‹ Postavke then goes to the list, not off the page.
      await browser.navigate(`${APP}/settings?section=backup`);
      await waitFor(`${heading} === 'Backup i izvoz'`, "Backup opened by its address", 15000);
      await click(`__e2e.byText('button', 'Postavke')`);
      await waitFor(`${heading} === 'Postavke' && location.pathname === '/settings'`, "the list after a link");
    });
  } else {
    await step("on a wide screen every section is on the page as rows, holding what is saved", async () => {
      await browser.navigate(`${APP}/settings`);
      await waitFor(`${field("Kalorije (kcal)")}?.value === '2500'`, "the saved goals", 20000);
      const titles = await evaluate(`[...document.querySelectorAll('section h2')].filter((h) => __e2e.visible(h)).map((h) => h.textContent.trim())`);
      expect(json(titles) === json(SECTION_TITLES), `sections: ${titles.join(", ")}`);
      const goals = await evaluate(
        `['Kalorije (kcal)', 'Bjelančevine (g)', 'Ugljikohidrati (g)', 'Masti (g)', 'Treninga tjedno'].map((name) => ${field("NAME").replace('"NAME"', "name")}?.value)`,
      );
      expect(json(goals) === json(["2500", "180", "250", "80", "4"]), `goals: ${goals.join(", ")}`);
      expect(await evaluate(`document.documentElement.scrollWidth <= innerWidth`), "the page scrolls sideways");
      // Menu and sections together sit in the middle of the screen.
      const sides = await evaluate(
        `(() => { const box = document.querySelector('h1').closest('[class*="_wide_"]').getBoundingClientRect(); return [Math.round(box.left), Math.round(innerWidth - box.right)]; })()`,
      );
      expect(Math.abs(sides[0] - sides[1]) <= 2, `left and right margins: ${sides.join(", ")}`);
    });

    await step("the menu jumps to a section and follows the one being read; a link brings one into view", async () => {
      expect((await evaluate(`${menuItem("Izgled")}.getAttribute('aria-current')`)) === "true", "Izgled is not marked at the top");
      await click(menuItem("Trening"));
      await waitFor(`${menuItem("Trening")}.getAttribute('aria-current') === 'true'`, "Trening marked");
      await waitFor(
        `new Promise((resolve) => { const y = scrollY; setTimeout(() => resolve(scrollY === y), 250); })`,
        "the page to stop",
      );
      const top = await evaluate(`Math.round(document.getElementById('settings-training').getBoundingClientRect().top)`);
      expect(top >= 0 && top <= 60, `Trening's top after the jump: ${top}`);
      // Scrolled by hand back to the top, the menu follows.
      await evaluate("window.scrollTo(0, 0)");
      await waitFor(`${menuItem("Izgled")}.getAttribute('aria-current') === 'true'`, "Izgled marked again", 4000);
      await browser.navigate(`${APP}/settings?section=powerlifting`);
      await waitFor(`${menuItem("Powerlifting")}?.getAttribute('aria-current') === 'true'`, "Powerlifting marked by a link", 15000);
      const linked = await evaluate(`Math.round(document.getElementById('settings-powerlifting').getBoundingClientRect().top)`);
      expect(linked >= 0 && linked < 450, `Powerlifting's top after the link: ${linked}`);
      await browser.navigate(`${APP}/settings`);
      await waitFor(`${field("Kalorije (kcal)")}?.value === '2500'`, "the page again", 15000);
    });
  }

  await step("Jezik: English turns the page English and is saved; Hrvatski turns it back", async () => {
    await openSection("Izgled");
    expect(await isPressed(option("Jezik", "Hrvatski")), "Hrvatski is not shown as chosen");
    await click(option("Jezik", "English"));
    await saved("language", "en");
    await waitFor(`${heading} === ${json(phone ? "Appearance" : "Settings")}`, "the English heading");
    expect(await evaluate(`!!${option("Language", "English")}`), "the language choice is not in English");
    await click(option("Language", "Hrvatski"));
    await saved("language", "hr");
    await waitFor(`${heading} === ${json(phone ? "Izgled" : "Postavke")}`, "the Croatian heading");
  });

  await step("Tema and Predložak: the chosen chip is saved, outlined in the text colour, not the accent", async () => {
    // Text and outline of a chip; the chosen one has both in the page's text colour.
    const look = (group, text) =>
      `(() => { const style = getComputedStyle(${option(group, text)}); return style.color + ' | ' + style.borderTopColor; })()`;
    const plain = async () => {
      const text = await evaluate(`getComputedStyle(document.body).color`);
      return `${text} | ${text}`;
    };
    await openSection("Izgled");
    expect(await isPressed(option("Tema", "Automatski")), "Automatski is not chosen");
    expect((await evaluate(look("Tema", "Automatski"))) === (await plain()), `the chosen chip: ${await evaluate(look("Tema", "Automatski"))}`);
    // The theme Automatski shows right now says so, following the device's dark or light mode.
    await browser.setScheme("dark");
    await waitFor(`${noteOf("Tema", "Graphite")} === 'automatski'`, "Graphite marked in dark mode");
    expect((await evaluate(noteOf("Tema", "Daylight"))) === null, "Daylight marked in dark mode too");
    await browser.setScheme("light");
    await waitFor(`${noteOf("Tema", "Daylight")} === 'automatski'`, "Daylight marked in light mode");
    expect((await evaluate(noteOf("Tema", "Graphite"))) === null, "Graphite still marked in light mode");
    await click(option("Tema", "Daylight"));
    await saved("theme", "daylight");
    await waitFor(`document.documentElement.dataset.theme === 'daylight'`, "the page in Daylight");
    expect(await isPressed(option("Tema", "Daylight")), "Daylight is not shown as chosen");
    expect(!(await isPressed(option("Tema", "Automatski"))), "Automatski still shows as chosen");
    expect((await evaluate(`document.querySelectorAll('[class*="_chipNote_"]').length`)) === 0, "a note left once a theme is picked");
    expect((await evaluate(look("Tema", "Daylight"))) === (await plain()), `the chosen chip in Daylight: ${await evaluate(look("Tema", "Daylight"))}`);
    await click(option("Tema", "Automatski"));
    await saved("theme", "auto");
    await click(option("Predložak", "Soft"));
    await saved("template", "soft");
    await waitFor(`document.documentElement.dataset.template === 'soft'`, "the page in Soft");
    await click(option("Predložak", "Moderna"));
    await saved("template", "moderna");
  });

  await step("Ciljevi: Enter or leaving the field saves a number; anything else goes back", async () => {
    await openSection("Ciljevi");
    await type(field("Kalorije (kcal)"), "2600");
    await press("Enter", "Enter", 13);
    await saved("kcalGoal", 2600);
    expect(await evaluate(`document.activeElement !== ${field("Kalorije (kcal)")}`), "Enter did not leave the field");
    await type(field("Masti (g)"), "7a");
    await browser.blur();
    await waitFor(`${field("Masti (g)")}.value === '80'`, "the saved fat goal back in its field");
    expect((await api("/api/settings")).fatGoal === 80, "a wrong number was saved");
    await type(field("Bjelančevine (g)"), "190");
    await click(field("Treninga tjedno"));
    await saved("proteinGoal", 190);
  });

  await step("Odmor nakon seta: 2:00 is chosen; 1:30 and Bez odmora are saved", async () => {
    await openSection("Trening");
    expect(await isPressed(option("Odmor nakon seta", "2:00")), "2:00 is not chosen");
    await click(option("Odmor nakon seta", "1:30"));
    await saved("restSeconds", 90);
    await click(option("Odmor nakon seta", "Bez odmora"));
    await saved("restSeconds", 0);
    expect(await isPressed(option("Odmor nakon seta", "Bez odmora")), "Bez odmora is not shown as chosen");
  });

  await step("Trening: the e1RM switch, the formula and the exercise picker are saved", async () => {
    await openSection("Trening");
    expect(await isOn(toggle("Prikaži e1RM")), "the e1RM switch is off");
    await click(toggle("Prikaži e1RM"));
    await saved("showE1rm", false);
    expect(!(await isOn(toggle("Prikaži e1RM"))), "the switch still shows on");
    await click(toggle("Prikaži e1RM"));
    await saved("showE1rm", true);
    expect(await isPressed(option("Formula za e1RM", "Brzycki")), "Brzycki is not chosen");
    await click(option("Formula za e1RM", "Epley"));
    await saved("e1rmFormula", "epley");
    expect(await isPressed(option("Odabir vježbe", "Filter iznad liste")), "the filter is not chosen");
    await click(option("Odabir vježbe", "Prvo kategorija"));
    await saved("exercisePickerMode", "twoStep");
  });

  await step("Kartice na Početnoj: each switch is saved", async () => {
    await openSection("Kartice na Početnoj");
    for (const [label, name] of [
      ["Trening danas", "showWorkoutWidget"],
      ["Prehrana danas", "showNutritionWidget"],
      ["Zadnji rekord", "showPrWidget"],
    ]) {
      expect(await isOn(toggle(label)), `${label} is off`);
      await click(toggle(label));
      await saved(name, false);
    }
    await click(toggle("Prehrana danas"));
    await saved("showNutritionWidget", true);
  });

  await step("Powerlifting: the switch shows the setup, which saves and counts in the page's language", async () => {
    await openSection("Powerlifting");
    expect(!(await evaluate(`!!${option("Spol", "Muško")}`)), "the setup shows while it is off");
    await click(toggle("Prikaži total"));
    await saved("showPowerliftingTotal", true);
    await waitFor(option("Spol", "Muško"), "the sex choice");
    expect(await isPressed(option("Spol", "Muško")), "Muško is not chosen");
    await click(option("Spol", "Žensko"));
    await saved("sex", "female");
    // The total with its numbers, not the section's "Total, DOTS i Wilks na Statistici."
    const summary = `[...document.querySelectorAll('p')].find((p) => /^Total \\d/.test(p.textContent))?.textContent`;
    await waitFor(summary, "the total");
    const text = await evaluate(summary);
    expect(/^Total \d+,\d kg · DOTS \d+,\d · Wilks \d+,\d \(uz 82,5 kg\)$/.test(text), `summary: ${text}`);
    const squat = await evaluate(
      `[...document.querySelectorAll('label')].find((l) => l.querySelector('select') && l.textContent.startsWith('Čučanj'))?.lastElementChild.textContent`,
    );
    expect(/^\d+,\d kg$/.test(squat), `squat e1RM: ${squat}`);
    await click(toggle("Prikaži total"));
    await saved("showPowerliftingTotal", false);
    await waitFor(`!${option("Spol", "Muško")}`, "the setup hidden");
  });

  await step("Backup: the JSON downloads, and the file button opens with Tab and reads a file", async () => {
    await openSection("Backup i izvoz");
    const downloads = join(here, `downloads-settings-${phone ? "phone" : "desktop"}`);
    rmSync(downloads, { recursive: true, force: true });
    mkdirSync(downloads, { recursive: true });
    await browser.send("Page.setDownloadBehavior", { behavior: "allow", downloadPath: downloads });
    await click(`document.querySelector('button[aria-label="Preuzmi backup (JSON)"]')`);
    const started = Date.now();
    while (!readdirSync(downloads).some((name) => name.endsWith(".json"))) {
      if (Date.now() - started > 8000) throw new Error(`no backup downloaded: ${readdirSync(downloads).join(", ")}`);
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    await evaluate(`${`document.querySelector('button[aria-label="Izvezi setove (CSV)"]')`}.focus()`);
    await press("Tab", "Tab", 9);
    expect(await evaluate(`document.activeElement?.type === 'file'`), "Tab does not reach the file button");
    const outline = await evaluate(`getComputedStyle(document.activeElement.parentElement).outlineStyle`);
    expect(outline === "solid", `the file button shows no focus (outline ${outline})`);
    const bad = join(here, "not-a-backup.json");
    writeFileSync(bad, "this is not json");
    const { result } = await browser.send("Runtime.evaluate", { expression: `document.querySelector('input[type="file"]')` });
    await browser.send("DOM.setFileInputFiles", { files: [bad], objectId: result.objectId });
    await waitFor(`document.body.textContent.includes('Datoteka nije ispravan JSON')`, "the bad-file message");
  });

  await step("nothing broke on the page", async () => {
    const problems = browser.problems.filter((line) => !/favicon|DevTools/.test(line));
    expect(problems.length === 0, problems.join(" || "));
  });
} finally {
  await api("/api/settings", "PUT", { ...START, e1rmFormula: "brzycki" });
  console.log(results.join("\n"));
  const failed = results.filter((line) => line.startsWith("FAIL")).length;
  console.log(`\n${results.length - failed} passed, ${failed} failed (settings, ${phone ? "phone" : "desktop"})`);
  await browser.close();
}
