import { formatNumber, formatPercent } from "./numbers";
import { dropWeights, plannedWeight, schemeToSets } from "./programScheme";
import { percentForRpe } from "./rpeChart";
import { saveBlob } from "./saveFile";
import { supersetLabels, tidySupersets } from "./supersets";

// A program as an Excel workbook, laid out like a strength program's spreadsheet: an overview
// with every week, then a sheet per week with each day's exercises side by side and a table of
// sets under each. The weights are worked out from the e1RMs the way a loaded program day does it.

const XLSX_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const FONT = { name: "Arial", size: 10 };
const DIM = { argb: "FF5B6270" };
const DARK = "FF22262E";
const LIGHT = "FFE9ECF1";
const LINE = { style: "thin", color: { argb: "FFC9CDD4" } };
const BOX = { top: LINE, left: LINE, bottom: LINE, right: LINE };
const PAGE = { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
const fill = (argb) => ({ type: "pattern", pattern: "solid", fgColor: { argb } });

// The overview: per day a column for the exercise and a wider one for its sets.
const NAME_WIDTH = 26;
const SETS_WIDTH = 40;
const LINE_HEIGHT = 13;
// A week's sheet: three exercises side by side, each a table of SET, KILAŽA, PON., RPE, % 1RM.
const PER_BAND = 3;
const TABLE_WIDTHS = [6, 11, 8, 7, 9];
const BLOCK = TABLE_WIDTHS.length;

// A set's share of the e1RM in percent, for the overview: a fixed weight's share, or the chart's
// for an RPE. A percentage of the training max is shown as it is, so it has none.
function shareOf(set, e1rm) {
  if (set.percent !== null) return null;
  if (set.weight !== null) return e1rm ? (set.weight * 100) / e1rm : null;
  return set.rpe !== null ? percentForRpe(set.reps, set.rpe) : null;
}

/**
 * The program week by week: each day with the exercises that have sets that week, each with its
 * superset label (A1, …), best e1RM (null without one) and sets. A set has its reps, RPE,
 * percentage of the training max, weight (null when it is left to the day), share of the e1RM
 * and its drop sets' weights.
 */
export function planProgram(program, e1rms) {
  return Array.from({ length: program.weeks }, (_, weekIndex) => ({
    number: weekIndex + 1,
    days: program.days.map((day) => {
      const labels = supersetLabels(
        tidySupersets(day.exercises.map((exercise) => exercise.supersetGroup ?? null)),
      );
      const exercises = day.exercises.flatMap((exercise, index) => {
        const sets = schemeToSets(exercise.weekSchemes[weekIndex]) ?? [];
        if (sets.length === 0) return [];
        const e1rm = e1rms[exercise.name.trim()] ?? null;
        return [
          {
            name: exercise.name,
            label: labels[index],
            e1rm,
            sets: sets.map((set) => {
              const weight = plannedWeight(set, e1rm, program.trainingMaxPercent);
              return {
                reps: set.reps,
                rpe: set.rpe,
                percent: set.percent,
                weight,
                share: shareOf(set, e1rm),
                drops:
                  weight === null ? Array(set.drops).fill(null) : dropWeights(weight, set.drops),
              };
            }),
          },
        ];
      });
      return { name: day.name || null, dayNumber: day.dayNumber, exercises };
    }),
  }));
}

/** A set as a line of the overview: "5 × RPE 7 · 79 % · 142,5 kg", "5 × 74 % TM · 132,5 kg". */
export function describeSet(set, t, language) {
  const kg = set.weight !== null ? `${formatNumber(set.weight, language)} kg` : null;
  const rpe = set.rpe !== null ? `RPE ${formatNumber(set.rpe, language)}` : null;
  let parts;
  if (set.percent !== null) {
    parts = [`${set.reps} × ${formatPercent(set.percent, language)} TM`, rpe, kg];
  } else if (rpe) {
    const share = set.share !== null ? formatPercent(Math.round(set.share), language) : null;
    parts = [`${set.reps} × ${rpe}`, share, kg];
  } else if (kg) {
    parts = [`${set.reps} × ${kg}`];
  } else {
    parts = [t("programs.repsOnly", { count: set.reps })];
  }
  if (set.drops.length > 0) parts.push(t("programs.dropCount", { count: set.drops.length }));
  return parts.filter(Boolean).join(" · ");
}

const dayTitle = (day, t) => day.name || t("programs.dayNumber", { number: day.dayNumber });
const exerciseTitle = (exercise) =>
  exercise.label ? `${exercise.label} · ${exercise.name}` : exercise.name;
// Rows a wrapping cell takes: each line wraps at about `width` characters.
const rowsFor = (lines, width) =>
  lines.reduce((count, line) => count + Math.max(1, Math.ceil(line.length / width)), 0);

function write(sheet, row, col, value, font = {}) {
  const cell = sheet.getCell(row, col);
  cell.value = value;
  cell.font = { ...FONT, ...font };
  return cell;
}

// A dark bar across the sheet: a week's or a day's title.
function bar(sheet, row, from, to, text, size = 11) {
  sheet.mergeCells(row, from, row, to);
  const cell = write(sheet, row, from, text, { size, bold: true, color: { argb: "FFFFFFFF" } });
  cell.fill = fill(DARK);
  cell.alignment = { vertical: "middle", indent: 1 };
  sheet.getRow(row).height = 20;
}

// "Pregled": the program's name and what it is, then each week with its days side by side and,
// beside each exercise, its sets as lines.
function addOverview(workbook, program, weeks, { t, language, exportedAt }) {
  const sheet = workbook.addWorksheet(t("programs.exportOverview"), { pageSetup: PAGE });
  const dayCols = program.days.map((_, index) => 2 + index * 3);
  sheet.getColumn(1).width = 2;
  for (const col of dayCols) {
    sheet.getColumn(col).width = NAME_WIDTH;
    sheet.getColumn(col + 1).width = SETS_WIDTH;
    sheet.getColumn(col + 2).width = 2;
  }
  const lastCol = 3 * Math.max(program.days.length, 1);
  const date = new Intl.DateTimeFormat(language, { dateStyle: "long" }).format(exportedAt);
  const summary = [
    t("programs.weekCount", { count: program.weeks }),
    t("programs.dayCount", { count: program.days.length }),
    t("programs.trainingMaxShort", {
      percent: formatPercent(program.trainingMaxPercent, language),
    }),
    t("programs.exportedOn", { date }),
  ].join(" · ");

  write(sheet, 1, 2, program.name, { size: 16, bold: true });
  write(sheet, 2, 2, summary, { color: DIM });
  write(sheet, 3, 2, t("programs.exportNote"), { italic: true, color: DIM });

  let row = 5;
  for (const week of weeks) {
    const weekTitle = t("programs.weekLong", { number: week.number });
    bar(sheet, row, 2, lastCol, weekTitle.toLocaleUpperCase(language), 12);
    row += 1;
    week.days.forEach((day, index) => {
      sheet.mergeCells(row, dayCols[index], row, dayCols[index] + 1);
      const cell = write(sheet, row, dayCols[index], dayTitle(day, t).toLocaleUpperCase(language), {
        bold: true,
      });
      cell.fill = fill(LIGHT);
    });
    row += 1;
    const most = Math.max(1, ...week.days.map((day) => day.exercises.length));
    for (let place = 0; place < most; place += 1) {
      let rows = 1;
      week.days.forEach((day, index) => {
        const exercise = day.exercises[place];
        if (!exercise) {
          // A day with nothing that week says so once.
          if (place === 0) {
            write(sheet, row, dayCols[index], t("programs.nothingThisDay"), { color: DIM });
          }
          return;
        }
        const title = exerciseTitle(exercise);
        const name = write(sheet, row, dayCols[index], title, { bold: true });
        name.alignment = { vertical: "top", wrapText: true };
        const lines = exercise.sets.map((set) => `• ${describeSet(set, t, language)}`);
        const sets = write(sheet, row, dayCols[index] + 1, lines.join("\n"));
        sets.alignment = { vertical: "top", wrapText: true };
        rows = Math.max(rows, rowsFor([title], NAME_WIDTH - 2), rowsFor(lines, SETS_WIDTH));
      });
      sheet.getRow(row).height = LINE_HEIGHT * rows + 4;
      row += 1;
    }
    row += 1;
  }
}

// One exercise of a week's sheet at (row, col): its name, the e1RM its weights come from, and a
// table with a row per set ("D" for a drop set), padded to `tableRows`, then its reps and volume.
// The % 1RM column and the totals are formulas, so a weight typed in changes them.
function addExerciseTable(sheet, row, col, exercise, tableRows, t) {
  sheet.mergeCells(row, col, row, col + BLOCK - 1);
  write(sheet, row, col, exerciseTitle(exercise), { size: 11, bold: true });

  write(sheet, row + 1, col, "e1RM", { color: DIM });
  const e1rm = exercise.e1rm !== null ? Math.round(exercise.e1rm * 10) / 10 : null;
  const e1rmCell = write(sheet, row + 1, col + 1, e1rm ?? "–", { bold: true });
  e1rmCell.numFmt = '0.0" kg"';
  e1rmCell.alignment = { horizontal: "left" };
  const e1rmRef = e1rmCell.address.replace(/([A-Z]+)(\d+)/, "$$$1$$$2");

  const headers = [
    t("programs.exportSet"),
    t("programs.exportWeight"),
    t("programs.exportReps"),
    t("programs.exportRpe"),
    t("programs.exportShare"),
  ];
  headers.forEach((header, offset) => {
    const cell = write(sheet, row + 2, col + offset, header, { size: 9, bold: true });
    cell.fill = fill(LIGHT);
    cell.border = BOX;
    cell.alignment = { horizontal: "center" };
  });

  const firstRow = row + 3;
  const lastRow = row + 2 + tableRows;
  for (let r = firstRow; r <= lastRow; r += 1) {
    for (let offset = 0; offset < BLOCK; offset += 1) {
      const cell = write(sheet, r, col + offset, null);
      cell.border = BOX;
      cell.alignment = { horizontal: "center" };
    }
  }

  let r = firstRow;
  exercise.sets.forEach((set, index) => {
    const rows = [
      [index + 1, set.weight, set.rpe],
      ...set.drops.map((kg) => [t("log.dropBadge"), kg, null]),
    ];
    for (const [label, kg, rpe] of rows) {
      sheet.getCell(r, col).value = label;
      sheet.getCell(r, col + 1).value = kg;
      sheet.getCell(r, col + 2).value = set.reps;
      sheet.getCell(r, col + 3).value = rpe;
      const kgRef = sheet.getCell(r, col + 1).address;
      const share = sheet.getCell(r, col + 4);
      // The result is there too, for apps that show a file without working its formulas out.
      share.value = {
        formula: `IF(AND(ISNUMBER(${kgRef}),N(${e1rmRef})>0),${kgRef}/${e1rmRef},"")`,
        result: kg !== null && e1rm ? kg / e1rm : "",
      };
      share.numFmt = "0.0%";
      r += 1;
    }
  });

  const kgCol = sheet.getColumn(col + 1).letter;
  const repsCol = sheet.getColumn(col + 2).letter;
  const kgRange = `${kgCol}${firstRow}:${kgCol}${lastRow}`;
  const repsRange = `${repsCol}${firstRow}:${repsCol}${lastRow}`;
  const loads = exercise.sets.flatMap((set) =>
    [set.weight, ...set.drops].map((kg) => ({ kg, reps: set.reps })),
  );
  const hasWeights = loads.some(({ kg }) => kg !== null);
  const totals = [
    [
      t("programs.exportTotalReps"),
      `SUM(${repsRange})`,
      "0",
      loads.reduce((sum, { reps }) => sum + reps, 0),
    ],
    [
      t("programs.exportVolume"),
      `IF(COUNT(${kgRange})=0,"",SUMPRODUCT(${kgRange},${repsRange}))`,
      '#,##0" kg"',
      hasWeights ? loads.reduce((sum, { kg, reps }) => sum + (kg ?? 0) * reps, 0) : "",
    ],
  ];
  totals.forEach(([title, formula, format, result], index) => {
    const at = lastRow + 1 + index;
    sheet.mergeCells(at, col, at, col + 1);
    write(sheet, at, col, title, { size: 9, bold: true, color: DIM });
    sheet.mergeCells(at, col + 2, at, col + 3);
    const value = write(sheet, at, col + 2, { formula, result }, { bold: true });
    value.numFmt = format;
    value.alignment = { horizontal: "left" };
  });
}

// "Tjedan N": each day as a bar, then its exercises three to a band, a table under each.
function addWeek(workbook, program, week, { t, language }) {
  const weekTitle = t("programs.weekLong", { number: week.number });
  const sheet = workbook.addWorksheet(weekTitle, { pageSetup: PAGE });
  sheet.getColumn(1).width = 2;
  for (let band = 0; band < PER_BAND; band += 1) {
    const start = 2 + band * (BLOCK + 1);
    TABLE_WIDTHS.forEach((width, offset) => {
      sheet.getColumn(start + offset).width = width;
    });
    sheet.getColumn(start + BLOCK).width = 3;
  }
  const lastCol = 2 + (PER_BAND - 1) * (BLOCK + 1) + BLOCK - 1;

  write(sheet, 1, 2, weekTitle.toLocaleUpperCase(language), { size: 18, bold: true });
  write(sheet, 2, 2, `${program.name} · ${t("programs.exportWeekNote")}`, { color: DIM });

  let row = 4;
  for (const day of week.days) {
    bar(sheet, row, 2, lastCol, dayTitle(day, t).toLocaleUpperCase(language));
    row += 2;
    if (day.exercises.length === 0) {
      write(sheet, row, 2, t("programs.nothingThisDay"), { color: DIM });
      row += 2;
      continue;
    }
    for (let first = 0; first < day.exercises.length; first += PER_BAND) {
      const band = day.exercises.slice(first, first + PER_BAND);
      const tableRows = Math.max(
        ...band.map((exercise) =>
          exercise.sets.reduce((count, set) => count + 1 + set.drops.length, 0),
        ),
      );
      band.forEach((exercise, index) =>
        addExerciseTable(sheet, row, 2 + index * (BLOCK + 1), exercise, tableRows, t),
      );
      // Name, e1RM and header, the sets, the two totals, then a gap.
      row += 3 + tableRows + 2 + 2;
    }
  }
}

/**
 * The program as an ExcelJS workbook: an overview sheet, then a sheet per week. `e1rms` are the
 * best e1RMs by exercise name; `t` and `language` write its words and numbers.
 */
export function buildProgramWorkbook(
  ExcelJS,
  program,
  { e1rms, t, language, exportedAt = new Date() },
) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Iron Log";
  workbook.created = exportedAt;
  workbook.calcProperties.fullCalcOnLoad = true;
  const weeks = planProgram(program, e1rms);
  addOverview(workbook, program, weeks, { t, language, exportedAt });
  for (const week of weeks) addWeek(workbook, program, week, { t, language });
  return workbook;
}

// The program's name as a file name, without the characters file names can't have.
export function exportFileName(name) {
  return `${name.replace(/[\\/:*?"<>|]+/g, "-").trim() || "program"}.xlsx`;
}

/** Builds the program's workbook and hands it to the browser as "<program name>.xlsx". */
export async function exportProgramToExcel(program, options) {
  // ExcelJS is big, so it only loads when a program is exported.
  const { default: ExcelJS } = await import("exceljs");
  const buffer = await buildProgramWorkbook(ExcelJS, program, options).xlsx.writeBuffer();
  saveBlob(new Blob([buffer], { type: XLSX_TYPE }), exportFileName(program.name));
}
