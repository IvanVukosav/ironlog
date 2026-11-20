import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import i18n from "../i18n";
import { buildProgramWorkbook, describeSet, exportFileName, planProgram } from "./programExport";

const hr = i18n.getFixedT("hr");
const en = i18n.getFixedT("en");
// Intl puts a no-break space in "79 %"; the tests write an ordinary one.
const plain = (text) => String(text).replace(/\s/g, " ");

const program = {
  name: "Snaga",
  weeks: 2,
  trainingMaxPercent: 90,
  days: [
    {
      dayNumber: 1,
      name: "Donji dio",
      exercises: [
        { name: "Čučanj", supersetGroup: null, weekSchemes: ["1x5 rpe7, 1x5 rpe8", "2x5@80%"] },
        { name: "Zgibovi", supersetGroup: "A", weekSchemes: ["3x8", ""] },
        { name: "Dips", supersetGroup: "A", weekSchemes: ["1x10@20kg drop1", "1x10@20kg"] },
      ],
    },
    {
      dayNumber: 2,
      name: "",
      exercises: [
        { name: "Bench press", supersetGroup: null, weekSchemes: ["1x8 rpe9 drop2", ""] },
      ],
    },
  ],
};
const e1rms = { Čučanj: 150, "Bench press": 100 };
const options = { e1rms, t: hr, language: "hr", exportedAt: new Date(2026, 10, 20) };

describe("planProgram", () => {
  const [week1, week2] = planProgram(program, e1rms);

  it("works the weights out from the e1RM: RPE by the chart, a percentage through the TM", () => {
    const squat = week1.days[0].exercises[0];
    expect(squat).toMatchObject({ name: "Čučanj", label: null, e1rm: 150 });
    // 5 @ 7 is 78,6 % and 5 @ 8 is 81,1 % of 150, each rounded to 2,5 kg.
    expect(squat.sets.map((set) => set.weight)).toEqual([117.5, 122.5]);
    expect(squat.sets.map((set) => set.share)).toEqual([78.6, 81.1]);
    // 80 % of a 90 % training max: 108 kg, rounded to 107,5.
    expect(week2.days[0].exercises[0].sets.map((set) => set.weight)).toEqual([107.5, 107.5]);
  });

  it("leaves the weight to the day without an e1RM, and keeps a weight in kg", () => {
    const [, pullUps, dips] = week1.days[0].exercises;
    expect(pullUps.e1rm).toBeNull();
    expect(pullUps.sets).toHaveLength(3);
    expect(pullUps.sets[0]).toMatchObject({ reps: 8, weight: null, share: null, drops: [] });
    expect(dips.sets[0]).toMatchObject({ weight: 20, drops: [15] });
  });

  it("gives drop sets 20 % less each, and supersets their labels", () => {
    expect(week1.days[1].exercises[0].sets[0]).toMatchObject({ weight: 75, drops: [60, 47.5] });
    expect(week1.days[0].exercises.map((exercise) => exercise.label)).toEqual([null, "A1", "A2"]);
  });

  it("leaves out an exercise without sets that week", () => {
    expect(week2.days[0].exercises.map((exercise) => exercise.name)).toEqual(["Čučanj", "Dips"]);
    expect(week2.days[1].exercises).toEqual([]);
  });
});

describe("describeSet", () => {
  const set = (fields) => ({
    reps: 5,
    rpe: null,
    percent: null,
    weight: null,
    share: null,
    drops: [],
    ...fields,
  });

  it("writes an RPE set with its share of the e1RM and its weight", () => {
    expect(plain(describeSet(set({ rpe: 7, share: 78.6, weight: 117.5 }), hr, "hr"))).toBe(
      "5 × RPE 7 · 79 % · 117,5 kg",
    );
    expect(plain(describeSet(set({ rpe: 7, share: 78.6, weight: 117.5 }), en, "en"))).toBe(
      "5 × RPE 7 · 79% · 117.5 kg",
    );
  });

  it("writes a percentage of the training max, a weight in kg and drop sets", () => {
    expect(plain(describeSet(set({ percent: 80, rpe: 8, weight: 107.5 }), hr, "hr"))).toBe(
      "5 × 80 % TM · RPE 8 · 107,5 kg",
    );
    expect(describeSet(set({ reps: 10, weight: 20, drops: [15] }), hr, "hr")).toBe(
      "10 × 20 kg · + 1 drop",
    );
    expect(
      plain(describeSet(set({ rpe: 9, share: 76.2, weight: 75, drops: [60, 47.5] }), hr, "hr")),
    ).toBe("5 × RPE 9 · 76 % · 75 kg · + 2 dropa");
  });

  it("is just the reps for a set with nothing more", () => {
    expect(describeSet(set({ reps: 8 }), hr, "hr")).toBe("8 ponavljanja");
    expect(describeSet(set({ reps: 8 }), en, "en")).toBe("8 reps");
  });
});

describe("buildProgramWorkbook", () => {
  const workbook = buildProgramWorkbook(ExcelJS, program, options);
  const text = (sheet, address) => plain(workbook.getWorksheet(sheet).getCell(address).value);

  it("has an overview, then a sheet per week", () => {
    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual([
      "Pregled",
      "Tjedan 1",
      "Tjedan 2",
    ]);
  });

  it("lists each week's days side by side in the overview", () => {
    expect(text("Pregled", "B1")).toBe("Snaga");
    expect(text("Pregled", "B2")).toMatch(/^2 tjedna · 2 dana · TM 90 % · izvezeno iz Iron Loga /);
    expect(text("Pregled", "B5")).toBe("TJEDAN 1");
    expect([text("Pregled", "B6"), text("Pregled", "E6")]).toEqual(["DONJI DIO", "DAN 2"]);
    expect(text("Pregled", "B7")).toBe("Čučanj");
    expect(text("Pregled", "C7")).toBe(
      "• 5 × RPE 7 · 79 % · 117,5 kg\n• 5 × RPE 8 · 81 % · 122,5 kg".replace(/\n/g, " "),
    );
    expect(text("Pregled", "F7")).toBe("• 8 × RPE 9 · 76 % · 75 kg · + 2 dropa");
    expect([text("Pregled", "B8"), text("Pregled", "B9")]).toEqual(["A1 · Zgibovi", "A2 · Dips"]);
    // Week 2 has no Zgibovi and nothing on day 2.
    expect(text("Pregled", "B11")).toBe("TJEDAN 2");
    expect([text("Pregled", "B13"), text("Pregled", "B14")]).toEqual(["Čučanj", "A2 · Dips"]);
    expect(text("Pregled", "E13")).toBe("Za ovaj dan i tjedan nema vježbi.");
  });

  it("puts a table of sets under each exercise of a week, three side by side", () => {
    const sheet = workbook.getWorksheet("Tjedan 1");
    const row = (address, count) =>
      Array.from({ length: count }, (_, offset) => {
        const cell = sheet.getCell(address);
        return sheet.getCell(cell.row, cell.col + offset).value;
      });
    expect(text("Tjedan 1", "B1")).toBe("TJEDAN 1");
    expect(text("Tjedan 1", "B4")).toBe("DONJI DIO");
    expect([text("Tjedan 1", "B6"), text("Tjedan 1", "H6"), text("Tjedan 1", "N6")]).toEqual([
      "Čučanj",
      "A1 · Zgibovi",
      "A2 · Dips",
    ]);
    expect(row("B7", 2)).toEqual(["e1RM", 150]);
    expect(row("I7", 1)).toEqual(["–"]);
    expect(row("B8", 5)).toEqual(["SET", "KILAŽA", "PON.", "RPE", "% 1RM"]);
    expect(row("B9", 4)).toEqual([1, 117.5, 5, 7]);
    expect(row("N9", 4)).toEqual([1, 20, 10, null]);
    expect(row("N10", 4)).toEqual(["D", 15, 10, null]);
    // Day 2 starts under the tallest table (3 rows), its totals and a gap.
    expect(text("Tjedan 1", "B16")).toBe("DAN 2");
    expect(row("B21", 4)).toEqual([1, 75, 8, 9]);
    expect(row("B22", 4)).toEqual(["D", 60, 8, null]);
    expect(row("B23", 4)).toEqual(["D", 47.5, 8, null]);
  });

  it("works the share of the e1RM and the totals out with formulas", () => {
    const sheet = workbook.getWorksheet("Tjedan 1");
    expect(sheet.getCell("F9").value).toEqual({
      formula: 'IF(AND(ISNUMBER(C9),N($C$7)>0),C9/$C$7,"")',
      result: 117.5 / 150,
    });
    // No e1RM: nothing to divide by, so no result (ExcelJS keeps an empty one out of `value`).
    expect(sheet.getCell("R9").value).toEqual({
      formula: 'IF(AND(ISNUMBER(O9),N($O$7)>0),O9/$O$7,"")',
    });
    expect(sheet.getCell("R9").model.result).toBe("");
    expect(text("Tjedan 1", "B12")).toBe("PONAVLJANJA");
    expect(sheet.getCell("D12").value).toEqual({ formula: "SUM(D9:D11)", result: 10 });
    expect(sheet.getCell("D13").value).toEqual({
      formula: 'IF(COUNT(C9:C11)=0,"",SUMPRODUCT(C9:C11,D9:D11))',
      result: 1200,
    });
    // Zgibovi have no weights, Dips 20 kg × 10 and a 15 kg drop × 10.
    expect(sheet.getCell("J13").model.result).toBe("");
    expect(sheet.getCell("P12").value.result).toBe(20);
    expect(sheet.getCell("P13").value.result).toBe(350);
  });

  it("says when a day has nothing that week", () => {
    expect(text("Tjedan 2", "B4")).toBe("DONJI DIO");
    const sheet = workbook.getWorksheet("Tjedan 2");
    const dayTwo = sheet.getColumn(2).values.findIndex((value) => value === "DAN 2");
    expect(text("Tjedan 2", `B${dayTwo + 2}`)).toBe("Za ovaj dan i tjedan nema vježbi.");
  });

  it("writes a file that reads back", async () => {
    const back = new ExcelJS.Workbook();
    await back.xlsx.load(await workbook.xlsx.writeBuffer());
    expect(back.worksheets.map((sheet) => sheet.name)).toEqual(["Pregled", "Tjedan 1", "Tjedan 2"]);
    expect(back.getWorksheet("Tjedan 1").getCell("C9").value).toBe(117.5);
  });
});

describe("exportFileName", () => {
  it("is the program's name, without the characters a file name can't have", () => {
    expect(exportFileName("12 Week Strength")).toBe("12 Week Strength.xlsx");
    expect(exportFileName("5/3/1 BBB")).toBe("5-3-1 BBB.xlsx");
    expect(exportFileName("   ")).toBe("program.xlsx");
  });
});
