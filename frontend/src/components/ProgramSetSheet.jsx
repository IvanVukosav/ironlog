import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import Sheet from "./Sheet";
import Icon from "./Icon";
import StepperField from "./StepperField";
import SwitchRow from "./SwitchRow";
import { MAX_DROPS } from "../utils/programScheme";
import { MAX_RPE, MIN_RPE } from "../utils/oneRepMax";
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
const LOAD_STEP = 2.5;
const PERCENT_START = 75;
// A weight in kg stepped from an empty field starts at the empty bar.
const WEIGHT_START = 20;
const RPE_STEP = 0.5;
const RPE_START = 8;
const DROP_CHOICES = Array.from({ length: MAX_DROPS + 1 }, (_, count) => count);

// What a field says as a number: NaN for an empty field or anything that is not a number.
function readNumber(text) {
  const decimal = toDecimalText(text);
  return decimal === "" ? NaN : Number(decimal);
}

function draftFromSet(set, language) {
  return {
    reps: String(set.reps),
    load: set.percent !== null ? "percent" : set.weight !== null ? "weight" : "none",
    loadText: toInputText(set.percent ?? set.weight, language),
    hasRpe: set.rpe !== null,
    rpe: toInputText(set.rpe, language),
    drops: set.drops,
  };
}

// The draft as a set, or null while a field holds something a set can't have.
function readDraft(draft) {
  const reps = readNumber(draft.reps);
  if (!Number.isInteger(reps) || reps < 1 || reps > MAX_REPS) return null;
  const load = readNumber(draft.loadText);
  if (draft.load === "percent" && !(load > 0 && load <= MAX_PERCENT)) return null;
  if (draft.load === "weight" && !(load > 0)) return null;
  const rpe = readNumber(draft.rpe);
  if (draft.hasRpe && !(rpe >= MIN_RPE && rpe <= MAX_RPE)) return null;
  return {
    reps,
    percent: draft.load === "percent" ? load : null,
    weight: draft.load === "weight" ? load : null,
    rpe: draft.hasRpe ? rpe : null,
    drops: draft.drops,
  };
}

// Buttons filling a row, one of them pressed: how the weight is given, how many drop sets.
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
          className={styles.choice}
          aria-pressed={option.value === value}
          aria-label={option.ariaLabel}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

/**
 * One set of a program. Only the reps are a must; the rest is up to the set: a weight as a
 * percentage of the training max or in kg (or none, picked on the day), an RPE, and drop sets
 * after it. Changes are kept when the sheet closes (Gotovo, a tap beside it, Escape); while a
 * field holds something a set can't have, closing drops them.
 */
function ProgramSetSheet({
  set,
  title,
  subtitle,
  trainingMaxPercent,
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
  const step = (amount) => formatNumber(amount, language);
  const isPercent = draft.load === "percent";

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
  const stepLoad = (direction) =>
    change({
      loadText: toInputText(
        stepNumber(draft.loadText, direction * LOAD_STEP, {
          start: isPercent ? PERCENT_START : WEIGHT_START,
          min: LOAD_STEP,
          max: isPercent ? MAX_PERCENT : Infinity,
        }),
        language,
      ),
    });
  const stepRpe = (direction) =>
    change({
      rpe: toInputText(
        stepNumber(draft.rpe, direction * RPE_STEP, {
          start: RPE_START,
          min: MIN_RPE,
          max: MAX_RPE,
        }),
        language,
      ),
    });

  // A percentage starts at 75 %; a weight in kg waits to be typed, there being no telling it.
  const pickLoad = (load) => {
    if (load === draft.load) return;
    change({ load, loadText: load === "percent" ? String(PERCENT_START) : "" });
  };

  const loadHints = {
    none: t("programs.noLoadHint"),
    percent: t("programs.percentHint", {
      percent: formatPercent(trainingMaxPercent, language),
    }),
    weight: t("programs.weightHint"),
  };

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
        <span id={`${id}load`} className={styles.sectionLabel}>
          {t("programs.loadLabel")}
        </span>
        <Choices
          labelledBy={`${id}load`}
          options={[
            { value: "none", label: t("programs.loadNone") },
            { value: "percent", label: t("programs.loadPercent") },
            { value: "weight", label: t("programs.loadWeight") },
          ]}
          value={draft.load}
          onChange={pickLoad}
        />
        {draft.load !== "none" && (
          <StepperField
            id={`${id}loadValue`}
            label={isPercent ? t("programs.percentLabel") : t("log.weightLabel")}
            value={draft.loadText}
            inputMode="decimal"
            placeholder="—"
            less={{
              label: isPercent
                ? t("programs.lessPercentBy", { step: step(LOAD_STEP) })
                : t("log.lessWeightBy", { step: step(LOAD_STEP) }),
              run: () => stepLoad(-1),
            }}
            more={{
              label: isPercent
                ? t("programs.morePercentBy", { step: step(LOAD_STEP) })
                : t("log.moreWeightBy", { step: step(LOAD_STEP) }),
              run: () => stepLoad(1),
            }}
            onChange={(loadText) => change({ loadText })}
          />
        )}
        <p className={styles.hint}>{loadHints[draft.load]}</p>
      </div>

      <div className={styles.divider} aria-hidden="true" />

      <SwitchRow
        label={t("programs.targetRpe")}
        hint={t("programs.rpeHint")}
        checked={draft.hasRpe}
        onChange={(hasRpe) =>
          change({ hasRpe, rpe: hasRpe && draft.rpe === "" ? String(RPE_START) : draft.rpe })
        }
      />
      {draft.hasRpe && (
        <StepperField
          id={`${id}rpe`}
          label={t("log.rpeLabel")}
          value={draft.rpe}
          inputMode="decimal"
          less={{ label: t("log.lessRpeBy", { step: step(RPE_STEP) }), run: () => stepRpe(-1) }}
          more={{ label: t("log.moreRpeBy", { step: step(RPE_STEP) }), run: () => stepRpe(1) }}
          onChange={(rpe) => change({ rpe })}
        />
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
