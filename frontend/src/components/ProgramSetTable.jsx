import { useState } from "react";
import { useTranslation } from "react-i18next";
import Icon from "./Icon";
import { buildProgramSets, plannedWeight } from "../utils/programScheme";
import { MAX_RPE, MIN_RPE } from "../utils/oneRepMax";
import { percentForRpe, rpeForPercent } from "../utils/rpeChart";
import { formatNumber, toDecimalText, toInputText } from "../utils/numbers";
import styles from "./ProgramSetTable.module.css";

const MAX_REPS = 100;
const MAX_PERCENT = 120;

// What a field says as a number: NaN for an empty field or anything that is not a number.
function readNumber(text) {
  const decimal = toDecimalText(text);
  return decimal === "" ? NaN : Number(decimal);
}

const toHalf = (value) => Math.round(value * 2) / 2;
// Only what a number is written with: digits and a decimal comma or point.
const numberText = (text) => text.replace(/[^0-9.,]/g, "");

/**
 * One set as a row of boxes, for a wide screen: reps, the intensity (a number, and whether it is
 * an RPE or a percentage of the training max), and the weight, worked out from the e1RM ("≈") or
 * typed. What is typed is kept in the row; the set changes as soon as it says something a set can
 * have, and a box that doesn't is marked.
 */
function SetRow({ set, number, e1rm, trainingMaxPercent, onChange, onCopy, onDelete }) {
  const { t, i18n } = useTranslation();
  const language = i18n.language;
  const [mode, setMode] = useState(set.percent !== null ? "percent" : "rpe");
  const [texts, setTexts] = useState(() => ({
    reps: String(set.reps),
    intensity: toInputText(set.percent !== null ? set.percent : set.rpe, language),
    weight: toInputText(set.weight, language),
  }));
  const isPercent = mode === "percent";
  const worked = plannedWeight({ ...set, weight: null }, e1rm, trainingMaxPercent);
  const name = t("log.setNumberLabel", { number });

  const reps = readNumber(texts.reps);
  const repsValid = Number.isInteger(reps) && reps >= 1 && reps <= MAX_REPS;
  const intensity = readNumber(texts.intensity);
  const intensityValid =
    texts.intensity.trim() === "" ||
    (isPercent
      ? intensity > 0 && intensity <= MAX_PERCENT
      : intensity >= MIN_RPE && intensity <= MAX_RPE);
  const weight = readNumber(texts.weight);
  const weightValid = texts.weight.trim() === "" || weight > 0;

  const type = (field) => (event) => {
    const text = numberText(event.target.value);
    setTexts((current) => ({ ...current, [field]: text }));
    const value = readNumber(text);
    if (field === "reps" && Number.isInteger(value) && value >= 1 && value <= MAX_REPS) {
      onChange({ ...set, reps: value });
    }
    if (field === "intensity") {
      const isEmpty = text.trim() === "";
      const fits = isPercent
        ? value > 0 && value <= MAX_PERCENT
        : value >= MIN_RPE && value <= MAX_RPE;
      if (isEmpty || fits) {
        const next = isEmpty ? null : value;
        onChange({ ...set, percent: isPercent ? next : null, rpe: isPercent ? null : next });
      }
    }
    if (field === "weight" && (text.trim() === "" || value > 0)) {
      onChange({ ...set, weight: text.trim() === "" ? null : value });
    }
  };

  // An RPE and a percentage say the same thing for given reps: the chart carries the number over.
  const pickMode = (next) => {
    if (next === mode) return;
    let converted = null;
    if (Number.isFinite(intensity) && repsValid) {
      if (next === "percent") {
        const ofMax = percentForRpe(reps, intensity);
        if (ofMax !== null) {
          converted = Math.min(toHalf((ofMax * 100) / trainingMaxPercent), MAX_PERCENT);
        }
      } else {
        converted = rpeForPercent(reps, (intensity * trainingMaxPercent) / 100);
      }
    }
    setMode(next);
    setTexts((current) => ({
      ...current,
      intensity: toInputText(converted, language),
      weight: next === "percent" ? "" : current.weight,
    }));
    onChange({
      ...set,
      percent: next === "percent" ? converted : null,
      rpe: next === "rpe" ? converted : null,
      weight: next === "percent" ? null : set.weight,
    });
  };

  const box = (isValid, className = styles.box) =>
    isValid ? className : `${className} ${styles.invalid}`;

  return (
    <div className={styles.row} role="row">
      <span className={styles.number} role="cell">
        {number}
      </span>
      <span role="cell" className={styles.cell}>
        <input
          className={box(repsValid, `${styles.box} ${styles.numberBox}`)}
          aria-label={t("programs.cellReps", { set: name })}
          aria-invalid={!repsValid}
          inputMode="numeric"
          autoComplete="off"
          value={texts.reps}
          onChange={type("reps")}
        />
      </span>
      <span role="cell" className={box(intensityValid, `${styles.box} ${styles.pair}`)}>
        <input
          className={styles.inner}
          aria-label={t(isPercent ? "programs.cellPercent" : "programs.cellRpe", { set: name })}
          aria-invalid={!intensityValid}
          inputMode="decimal"
          autoComplete="off"
          placeholder="—"
          value={texts.intensity}
          onChange={type("intensity")}
        />
        <span
          className={styles.toggle}
          role="group"
          aria-label={t("programs.cellIntensityKind", { set: name })}
        >
          <button type="button" aria-pressed={!isPercent} onClick={() => pickMode("rpe")}>
            {t("log.rpeLabel")}
          </button>
          <button
            type="button"
            aria-pressed={isPercent}
            title={t("programs.percentOfTm")}
            onClick={() => pickMode("percent")}
          >
            %
          </button>
        </span>
      </span>
      {isPercent ? (
        <span
          role="cell"
          className={`${styles.box} ${styles.pair} ${styles.worked}`}
          title={worked === null ? t("programs.noE1rmHint") : undefined}
        >
          <span className={styles.workedValue}>
            {worked !== null ? `≈ ${formatNumber(worked, language)}` : "—"}
          </span>
          <span className={styles.unit}>kg</span>
        </span>
      ) : (
        <span role="cell" className={box(weightValid, `${styles.box} ${styles.pair}`)}>
          <input
            className={styles.inner}
            aria-label={t("programs.cellWeight", { set: name })}
            aria-invalid={!weightValid}
            inputMode="decimal"
            autoComplete="off"
            placeholder={worked !== null ? `≈ ${formatNumber(worked, language)}` : "—"}
            value={texts.weight}
            onChange={type("weight")}
          />
          <span className={styles.unit}>kg</span>
        </span>
      )}
      <span role="cell" className={styles.actions}>
        <button
          type="button"
          className={styles.iconButton}
          aria-label={t("programs.copySetNumber", { number })}
          title={t("log.duplicateSet")}
          onClick={onCopy}
        >
          <Icon name="copy" size={18} />
        </button>
        <button
          type="button"
          className={styles.iconButton}
          aria-label={t("programs.deleteSetNumber", { number })}
          title={t("log.deleteSet")}
          onClick={onDelete}
        >
          <Icon name="trash" size={18} />
        </button>
      </span>
    </div>
  );
}

/**
 * An exercise's sets in one week on a wide screen: a row of boxes each, typed straight in, and
 * under a set its drop sets, each with its weight (20 % lighter, when the set has one) and ✕.
 * `onChange(sets)` gets the new list.
 */
function ProgramSetTable({ sets, e1rm, trainingMaxPercent, onChange, onCopy }) {
  const { t, i18n } = useTranslation();
  const language = i18n.language;
  const replace = (index, set) => onChange(sets.map((other, at) => (at === index ? set : other)));

  return (
    <div className={styles.scroll}>
      <div className={styles.table} role="table" aria-label={t("programs.setsTable")}>
        <div className={`${styles.row} ${styles.head}`} role="row">
          <span role="columnheader">{t("programs.setColumn")}</span>
          <span role="columnheader">{t("log.repsLabel")}</span>
          <span role="columnheader">{t("programs.intensityLabel")}</span>
          <span role="columnheader">{t("log.weightLabel")}</span>
          <span role="columnheader" aria-hidden="true" />
        </div>
        {sets.map((set, index) => {
          const drops = buildProgramSets(
            [{ ...set, sets: 1 }],
            e1rm,
            trainingMaxPercent,
          ).sets.slice(1);
          return [
            <SetRow
              key={set.key}
              set={set}
              number={index + 1}
              e1rm={e1rm}
              trainingMaxPercent={trainingMaxPercent}
              onChange={(changed) => replace(index, changed)}
              onCopy={() => onCopy(index)}
              onDelete={() => onChange(sets.filter((_, at) => at !== index))}
            />,
            ...drops.map((drop, dropIndex) => (
              <div key={`${set.key}-drop${dropIndex}`} className={styles.dropRow} role="row">
                <span className={styles.dropBadge} role="cell">
                  {t("log.dropBadge")}
                </span>
                <span className={styles.dropText} role="cell">
                  {drop.weight > 0
                    ? t("programs.dropRow", { weight: formatNumber(drop.weight, language) })
                    : t("programs.dropRowLighter")}
                </span>
                <span role="cell" className={styles.actions}>
                  <button
                    type="button"
                    className={styles.iconButton}
                    aria-label={t("programs.removeDrop", { number: index + 1 })}
                    title={t("programs.removeDrop", { number: index + 1 })}
                    onClick={() => replace(index, { ...set, drops: set.drops - 1 })}
                  >
                    <Icon name="close" size={16} />
                  </button>
                </span>
              </div>
            )),
          ];
        })}
      </div>
    </div>
  );
}

export default ProgramSetTable;
