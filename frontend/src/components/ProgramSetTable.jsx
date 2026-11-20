import { useState } from "react";
import { useTranslation } from "react-i18next";
import Icon from "./Icon";
import {
  DEFAULT_BACKOFF,
  MAX_BACKOFF,
  dropWeights,
  isBackoff,
  plannedWeight,
  plannedWeights,
  topSetIndex,
} from "../utils/programScheme";
import { MAX_RPE, MIN_RPE } from "../utils/oneRepMax";
import { percentForRpe, rpeForPercent } from "../utils/rpeChart";
import { formatNumber, formatPercent, toDecimalText, toInputText } from "../utils/numbers";
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

// A set's intensity is an RPE, a percentage of the training max, or a back-off.
const modeOf = (set) => (isBackoff(set) ? "backoff" : set.percent !== null ? "percent" : "rpe");
const intensityOf = (set, mode) =>
  mode === "backoff" ? set.backoff : mode === "percent" ? set.percent : set.rpe;
const fits = (mode, value) => {
  if (mode === "percent") return value > 0 && value <= MAX_PERCENT;
  if (mode === "backoff") return value > 0 && value <= MAX_BACKOFF;
  return value >= MIN_RPE && value <= MAX_RPE;
};

/**
 * One set as a row of boxes, for a wide screen: reps, the intensity (a number, and whether it is
 * an RPE, a percentage of the training max or a back-off from the top set before it), and the
 * weight: worked out ("≈") from the e1RM or the top set, or typed. What is typed is kept in the
 * row; the set changes as soon as it says something a set can have, and a box that doesn't is
 * marked. `worked` is the weight worked out for it, and `top` its top set ({ number, weight }),
 * or null for a set with no set before it to be a back-off from.
 */
function SetRow({ set, number, worked, top, trainingMaxPercent, onChange, onCopy, onDelete }) {
  const { t, i18n } = useTranslation();
  const language = i18n.language;
  const [mode, setMode] = useState(() => modeOf(set));
  const [texts, setTexts] = useState(() => ({
    reps: String(set.reps),
    intensity: toInputText(intensityOf(set, modeOf(set)), language),
    weight: toInputText(set.weight, language),
  }));
  const isPercent = mode === "percent";
  const isBackoffMode = mode === "backoff";
  const name = t("log.setNumberLabel", { number });

  const reps = readNumber(texts.reps);
  const repsValid = Number.isInteger(reps) && reps >= 1 && reps <= MAX_REPS;
  const intensity = readNumber(texts.intensity);
  // A back-off needs its number; an RPE or a percentage may be left out.
  const intensityValid = texts.intensity.trim() === "" ? !isBackoffMode : fits(mode, intensity);
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
      if (isBackoffMode) {
        if (!isEmpty && fits(mode, value)) onChange({ ...set, backoff: value });
      } else if (isEmpty || fits(mode, value)) {
        const next = isEmpty ? null : value;
        onChange({ ...set, percent: isPercent ? next : null, rpe: isPercent ? null : next });
      }
    }
    if (field === "weight" && (text.trim() === "" || value > 0)) {
      onChange({ ...set, weight: text.trim() === "" ? null : value });
    }
  };

  // An RPE and a percentage say the same thing for given reps: the chart carries the number over.
  // A back-off starts DEFAULT_BACKOFF lighter, and only a set with a top set before it can be one.
  const pickMode = (next) => {
    if (next === mode || (next === "backoff" && !top)) return;
    let converted = null;
    if (next === "backoff") {
      converted = DEFAULT_BACKOFF;
    } else if (!isBackoffMode && Number.isFinite(intensity) && repsValid) {
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
      weight: next === "rpe" ? current.weight : "",
    }));
    onChange({
      ...set,
      percent: next === "percent" ? converted : null,
      rpe: next === "rpe" ? converted : null,
      backoff: next === "backoff" ? converted : null,
      weight: next === "rpe" ? set.weight : null,
    });
  };

  const box = (isValid, className = styles.box) =>
    isValid ? className : `${className} ${styles.invalid}`;
  const intensityLabel = isBackoffMode
    ? "programs.cellBackoff"
    : isPercent
      ? "programs.cellPercent"
      : "programs.cellRpe";

  return (
    <div className={styles.row} role="row">
      <span
        className={isBackoffMode ? `${styles.number} ${styles.backoffNumber}` : styles.number}
        role="cell"
      >
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
          aria-label={t(intensityLabel, { set: name })}
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
          <button type="button" aria-pressed={mode === "rpe"} onClick={() => pickMode("rpe")}>
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
          <button
            type="button"
            className={styles.backoffToggle}
            aria-pressed={isBackoffMode}
            aria-label={t("programs.backoffChoice")}
            title={
              top || isBackoffMode ? t("programs.backoffTitle") : t("programs.backoffNeedsTop")
            }
            disabled={!top && !isBackoffMode}
            onClick={() => pickMode("backoff")}
          >
            {t("programs.backoffShort")}
          </button>
        </span>
      </span>
      {isPercent || isBackoffMode ? (
        <span
          role="cell"
          className={[styles.box, styles.pair, styles.worked, isBackoffMode && styles.backoffWorked]
            .filter(Boolean)
            .join(" ")}
          title={worked === null && !isBackoffMode ? t("programs.noE1rmHint") : undefined}
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
 * An exercise's sets in one week on a wide screen: a row of boxes each, typed straight in. Under
 * the first back-off set of a run, what it is lighter than; under a set, its drop sets, each with
 * its weight (20 % lighter, when the set has one) and ✕. `onChange(sets)` gets the new list.
 */
function ProgramSetTable({ sets, e1rm, trainingMaxPercent, onChange, onCopy }) {
  const { t, i18n } = useTranslation();
  const language = i18n.language;
  const replace = (index, set) => onChange(sets.map((other, at) => (at === index ? set : other)));
  const weights = plannedWeights(sets, e1rm, trainingMaxPercent);

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
          const topIndex = topSetIndex(sets, index);
          const top = topIndex === -1 ? null : { number: topIndex + 1, weight: weights[topIndex] };
          // An RPE set's "≈" is the e1RM's even when a weight is typed over it.
          const worked = isBackoff(set)
            ? weights[index]
            : plannedWeight({ ...set, weight: null }, e1rm, trainingMaxPercent);
          const startsRun = isBackoff(set) && top !== null && !isBackoff(sets[index - 1]);
          const drops =
            weights[index] !== null
              ? dropWeights(weights[index], set.drops)
              : Array(set.drops).fill(null);
          const backoff = startsRun
            ? t("programs.backoffPercent", { percent: formatPercent(set.backoff, language) })
            : null;
          return [
            <SetRow
              key={set.key}
              set={set}
              number={index + 1}
              worked={worked}
              top={top}
              trainingMaxPercent={trainingMaxPercent}
              onChange={(changed) => replace(index, changed)}
              onCopy={() => onCopy(index)}
              onDelete={() => onChange(sets.filter((_, at) => at !== index))}
            />,
            startsRun && (
              <div key={`${set.key}-of`} className={styles.backoffNote} role="row">
                <span role="cell">
                  {top.weight !== null
                    ? t("programs.backoffOf", {
                        percent: backoff,
                        number: top.number,
                        weight: formatNumber(top.weight, language),
                      })
                    : t("programs.backoffOfNoWeight", { percent: backoff, number: top.number })}
                </span>
              </div>
            ),
            ...drops.map((dropWeight, dropIndex) => (
              <div key={`${set.key}-drop${dropIndex}`} className={styles.dropRow} role="row">
                <span className={styles.dropBadge} role="cell">
                  {t("log.dropBadge")}
                </span>
                <span className={styles.dropText} role="cell">
                  {dropWeight > 0
                    ? t("programs.dropRow", { weight: formatNumber(dropWeight, language) })
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
