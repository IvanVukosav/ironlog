import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import Sheet from "./Sheet";
import Icon from "./Icon";
import StepperField from "./StepperField";
import {
  DEFAULT_BACKOFF,
  MAX_BACKOFF,
  MAX_DROPS,
  backoffWeight,
  isBackoff,
  plannedWeight,
} from "../utils/programScheme";
import { MAX_RPE, MIN_RPE } from "../utils/oneRepMax";
import { percentForRpe, rpeForPercent } from "../utils/rpeChart";
import {
  formatNumber,
  formatPercent,
  stepNumber,
  toDecimalText,
  toInputText,
} from "../utils/numbers";
import styles from "./ProgramSetSheet.module.css";

const MAX_REPS = 100;
const MAX_PERCENT = 120;
const REPS_STEP = 1;
const REPS_START = 8;
const RPE_STEP = 0.5;
const RPE_START = 8;
const PERCENT_STEP = 2.5;
const PERCENT_START = 75;
const BACKOFF_STEP = 2.5;
const WEIGHT_STEP = 2.5;
// A weight stepped from an empty box starts at the empty bar, unless the e1RM gives one.
const WEIGHT_START = 20;
const DROP_CHOICES = Array.from({ length: MAX_DROPS + 1 }, (_, count) => count);

// What a field says as a number: NaN for an empty field or anything that is not a number.
function readNumber(text) {
  const decimal = toDecimalText(text);
  return decimal === "" ? NaN : Number(decimal);
}

const toHalf = (value) => Math.round(value * 2) / 2;

// The set in the form: its intensity is an RPE, a percentage or a back-off (an old set with an
// RPE and a percentage shows its percentage), and a weight of its own only goes with an RPE or
// none.
function draftFromSet(set, language) {
  const mode = isBackoff(set) ? "backoff" : set.percent !== null ? "percent" : "rpe";
  const intensity = { backoff: set.backoff, percent: set.percent, rpe: set.rpe }[mode];
  return {
    reps: String(set.reps),
    mode,
    intensity: toInputText(intensity, language),
    weight: mode === "rpe" ? toInputText(set.weight, language) : "",
    drops: set.drops,
  };
}

// The draft as a set, or null while a field holds something a set can't have. A back-off needs
// its number; an RPE or a percentage may be left out.
function readDraft(draft) {
  const reps = readNumber(draft.reps);
  if (!Number.isInteger(reps) || reps < 1 || reps > MAX_REPS) return null;
  const intensity = draft.intensity.trim() === "" ? null : readNumber(draft.intensity);
  if (intensity === null && draft.mode === "backoff") return null;
  if (intensity !== null) {
    if (draft.mode === "rpe" && !(intensity >= MIN_RPE && intensity <= MAX_RPE)) return null;
    if (draft.mode === "percent" && !(intensity > 0 && intensity <= MAX_PERCENT)) return null;
    if (draft.mode === "backoff" && !(intensity > 0 && intensity <= MAX_BACKOFF)) return null;
  }
  const weight =
    draft.mode === "rpe" && draft.weight.trim() !== "" ? readNumber(draft.weight) : null;
  if (weight !== null && !(weight > 0)) return null;
  return {
    reps,
    percent: draft.mode === "percent" ? intensity : null,
    rpe: draft.mode === "rpe" ? intensity : null,
    backoff: draft.mode === "backoff" ? intensity : null,
    weight,
    drops: draft.drops,
  };
}

// Buttons filling a row, one of them pressed: RPE, a percentage or a back-off, how many drop
// sets. An option can be `disabled`, with a `title` saying why.
function Choices({ labelledBy, options, value, onChange, square = false }) {
  return (
    <div
      className={square ? `${styles.choices} ${styles.squareChoices}` : styles.choices}
      role="group"
      aria-labelledby={labelledBy}
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={option.className ? `${styles.choice} ${option.className}` : styles.choice}
          aria-pressed={option.value === value}
          aria-label={option.ariaLabel}
          title={option.title}
          disabled={option.disabled}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

/**
 * One set of a program. Only the reps are a must. Its intensity is an RPE or a percentage of the
 * training max (switching carries the number over by the RPE chart), or a back-off: that many
 * percent lighter than its top set (`top`: { number, weight }, null for a set with no set before
 * it, which can't be one). Its weight is worked out from the exercise's e1RM or the top set unless
 * one is typed (for an RPE or no intensity). Drop sets can follow it. Changes are kept when the
 * sheet closes (Gotovo, a tap beside it, Escape); while a field holds something a set can't have,
 * closing drops them.
 */
function ProgramSetSheet({
  set,
  title,
  subtitle,
  e1rm,
  trainingMaxPercent,
  top,
  onSave,
  onCopy,
  onDelete,
  onClose,
}) {
  const { t, i18n } = useTranslation();
  const language = i18n.language;
  const id = useId();
  const [draft, setDraft] = useState(() => draftFromSet(set, language));
  const values = readDraft(draft);
  const change = (fields) => setDraft((current) => ({ ...current, ...fields }));
  const number = (value) => formatNumber(value, language);
  const isPercent = draft.mode === "percent";
  const isBackoffMode = draft.mode === "backoff";
  // The weight the e1RM (or for a back-off, the top set) gives, whether or not one is typed.
  let worked = null;
  if (values && isBackoffMode) {
    worked = top?.weight != null ? backoffWeight(top.weight, values.backoff) : null;
  } else if (values) {
    worked = plannedWeight({ ...values, weight: null }, e1rm, trainingMaxPercent);
  }

  const close = () => {
    if (values) onSave(values);
    onClose();
  };

  const stepReps = (direction) =>
    change({
      reps: String(
        stepNumber(draft.reps, direction * REPS_STEP, { start: REPS_START, min: 1, max: MAX_REPS }),
      ),
    });
  const stepIntensity = (direction) => {
    const steps = {
      percent: { by: PERCENT_STEP, start: PERCENT_START, min: PERCENT_STEP, max: MAX_PERCENT },
      backoff: { by: BACKOFF_STEP, start: DEFAULT_BACKOFF, min: BACKOFF_STEP, max: MAX_BACKOFF },
      rpe: { by: RPE_STEP, start: RPE_START, min: MIN_RPE, max: MAX_RPE },
    };
    const { by, ...range } = steps[draft.mode];
    change({
      intensity: toInputText(stepNumber(draft.intensity, direction * by, range), language),
    });
  };
  const stepWeight = (direction) =>
    change({
      weight: toInputText(
        stepNumber(draft.weight, direction * WEIGHT_STEP, {
          start: worked ?? WEIGHT_START,
          min: WEIGHT_STEP,
        }),
        language,
      ),
    });

  // An RPE and a percentage say the same thing for given reps: the chart carries the number over
  // (a percentage is of the training max, the chart's of the 1RM). A back-off starts
  // DEFAULT_BACKOFF lighter. A weight typed goes with RPE.
  const pickMode = (mode) => {
    if (mode === draft.mode || (mode === "backoff" && !top)) return;
    const reps = readNumber(draft.reps);
    const value = readNumber(draft.intensity);
    let intensity = "";
    if (mode === "backoff") {
      intensity = toInputText(DEFAULT_BACKOFF, language);
    } else if (!isBackoffMode && Number.isFinite(value) && Number.isInteger(reps)) {
      if (mode === "percent") {
        const ofMax = percentForRpe(reps, value);
        if (ofMax !== null)
          intensity = toInputText(toHalf((ofMax * 100) / trainingMaxPercent), language);
      } else {
        const rpe = rpeForPercent(reps, (value * trainingMaxPercent) / 100);
        if (rpe !== null) intensity = toInputText(rpe, language);
      }
    }
    change({ mode, intensity, weight: mode === "rpe" ? draft.weight : "" });
  };

  // What the weight will be, said under it: typed, worked out, or left to the day (and why).
  const hasIntensity = Boolean(values) && (values.rpe !== null || values.percent !== null);
  let weightHint = t("programs.noLoadHint");
  if (isBackoffMode)
    weightHint = top ? t("programs.backoffWeightHint", { number: top.number }) : null;
  else if (!isPercent && draft.weight.trim() !== "") weightHint = t("programs.weightHint");
  else if (worked !== null) {
    weightHint = isPercent
      ? null
      : t("programs.workedWeightHint", { weight: number(worked), e1rm: number(e1rm) });
  } else if (!e1rm && hasIntensity) {
    weightHint = t("programs.noE1rmHint");
  }

  return (
    <Sheet labelledBy={`${id}title`} closeLabel={t("programs.closeSet")} onClose={close}>
      <div className={styles.header}>
        <h2 id={`${id}title`} className={styles.title}>
          {title}
        </h2>
        <span className={styles.subtitle}>{subtitle}</span>
      </div>

      <StepperField
        id={`${id}reps`}
        label={t("log.repsLabel")}
        value={draft.reps}
        inputMode="numeric"
        less={{ label: t("log.lessReps"), run: () => stepReps(-1) }}
        more={{ label: t("log.moreReps"), run: () => stepReps(1) }}
        onChange={(reps) => change({ reps })}
      />

      <div className={styles.section}>
        <span id={`${id}intensity`} className={styles.sectionLabel}>
          {t("programs.intensityLabel")}
        </span>
        <Choices
          labelledBy={`${id}intensity`}
          options={[
            { value: "rpe", label: t("log.rpeLabel") },
            { value: "percent", label: t("programs.loadPercent") },
            {
              value: "backoff",
              label: t("programs.backoffChoice"),
              className: styles.backoffChoice,
              disabled: !top && !isBackoffMode,
              title:
                top || isBackoffMode ? t("programs.backoffTitle") : t("programs.backoffNeedsTop"),
            },
          ]}
          value={draft.mode}
          onChange={pickMode}
        />
        <StepperField
          id={`${id}intensityValue`}
          label={
            isBackoffMode
              ? t("programs.backoffLabel")
              : isPercent
                ? t("programs.percentLabel")
                : t("log.rpeLabel")
          }
          value={draft.intensity}
          inputMode="decimal"
          placeholder="—"
          less={{
            label: isBackoffMode
              ? t("programs.lessBackoffBy", { step: number(BACKOFF_STEP) })
              : isPercent
                ? t("programs.lessPercentBy", { step: number(PERCENT_STEP) })
                : t("log.lessRpeBy", { step: number(RPE_STEP) }),
            run: () => stepIntensity(-1),
          }}
          more={{
            label: isBackoffMode
              ? t("programs.moreBackoffBy", { step: number(BACKOFF_STEP) })
              : isPercent
                ? t("programs.morePercentBy", { step: number(PERCENT_STEP) })
                : t("log.moreRpeBy", { step: number(RPE_STEP) }),
            run: () => stepIntensity(1),
          }}
          onChange={(intensity) => change({ intensity })}
        />
        <p className={styles.hint}>
          {isBackoffMode && top
            ? top.weight !== null
              ? t("programs.backoffHint", { number: top.number, weight: number(top.weight) })
              : t("programs.backoffHintNoWeight", { number: top.number })
            : isPercent
              ? t("programs.percentHint", { percent: formatPercent(trainingMaxPercent, language) })
              : isBackoffMode
                ? t("programs.backoffNeedsTop")
                : t("programs.rpeModeHint")}
        </p>
      </div>

      <div className={styles.divider} aria-hidden="true" />

      {isPercent || isBackoffMode ? (
        <div className={styles.section}>
          <div className={styles.sectionRow}>
            <span className={styles.sectionLabel}>{t("log.weightLabel")}</span>
            <span
              className={isBackoffMode ? `${styles.worked} ${styles.backoffWorked}` : styles.worked}
            >
              {worked !== null ? t("programs.workedWeight", { weight: number(worked) }) : "—"}
            </span>
          </div>
          {weightHint && <p className={styles.hint}>{weightHint}</p>}
        </div>
      ) : (
        <div className={styles.section}>
          <StepperField
            id={`${id}weight`}
            label={t("log.weightLabel")}
            value={draft.weight}
            inputMode="decimal"
            placeholder={worked !== null ? `≈ ${number(worked)}` : "—"}
            less={{
              label: t("log.lessWeightBy", { step: number(WEIGHT_STEP) }),
              run: () => stepWeight(-1),
            }}
            more={{
              label: t("log.moreWeightBy", { step: number(WEIGHT_STEP) }),
              run: () => stepWeight(1),
            }}
            onChange={(weight) => change({ weight })}
          />
          <p className={styles.hint}>{weightHint}</p>
        </div>
      )}
      <div className={styles.divider} aria-hidden="true" />

      <div className={styles.section}>
        <div className={styles.sectionRow}>
          <span id={`${id}drops`} className={styles.sectionLabel}>
            {t("programs.dropsLabel")}
          </span>
          <Choices
            labelledBy={`${id}drops`}
            square
            options={DROP_CHOICES.map((count) => ({
              value: count,
              label: String(count),
              ariaLabel: count === 0 ? t("programs.noDrops") : t("programs.dropCount", { count }),
            }))}
            value={draft.drops}
            onChange={(drops) => change({ drops })}
          />
        </div>
        <p className={styles.hint}>{t("programs.dropsHint")}</p>
      </div>

      <div className={styles.actions}>
        <button
          type="button"
          className={styles.secondary}
          onClick={() => {
            if (values) onSave(values);
            onCopy(values ?? set);
            onClose();
          }}
        >
          <Icon name="copy" />
          {t("log.duplicateSet")}
        </button>
        <button
          type="button"
          className={styles.secondary}
          onClick={() => {
            onDelete();
            onClose();
          }}
        >
          <Icon name="trash" />
          {t("log.deleteSet")}
        </button>
      </div>

      <button type="button" className={styles.done} disabled={!values} onClick={close}>
        {t("log.done")}
      </button>
    </Sheet>
  );
}

export default ProgramSetSheet;
