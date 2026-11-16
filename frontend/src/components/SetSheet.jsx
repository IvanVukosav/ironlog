import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import Sheet from "./Sheet";
import Icon from "./Icon";
import { formatNumber, toDecimalText, toInputText } from "../utils/numbers";
import styles from "./SetSheet.module.css";

const WEIGHT_STEP_KG = 2.5;
const REPS_STEP = 1;
const RPE_STEP = 0.5;
const RPE_MIN = 1;
const RPE_MAX = 10;
// An RPE stepped from an empty field starts here.
const RPE_START = 8;
// Steps add up in floating point (0,1 + 0,2), so results are rounded to this many decimals.
const STEP_DECIMALS = 2;

const roundStep = (value) => Number(value.toFixed(STEP_DECIMALS));

// What a field says as a number: NaN for an empty field or anything that is not a number.
function readNumber(text) {
  const decimal = toDecimalText(text);
  return decimal === "" ? NaN : Number(decimal);
}

function draftFromSet(set, language) {
  return {
    weight: toInputText(set.weight, language),
    reps: String(set.reps),
    rpe: toInputText(set.rpe, language),
    isWarmup: Boolean(set.isWarmup),
  };
}

// The draft as the set it would save, or null while a field holds something a set can't have.
function readDraft(draft) {
  const weight = readNumber(draft.weight);
  const reps = readNumber(draft.reps);
  const rpe = draft.rpe.trim() === "" ? null : readNumber(draft.rpe);
  if (!(weight >= 0) || !Number.isInteger(reps) || reps < 0) return null;
  if (rpe !== null && !(rpe >= RPE_MIN && rpe <= RPE_MAX)) return null;
  return { weight, reps, rpe, isWarmup: draft.isWarmup };
}

// The fields of `values` that differ from the saved set.
function changesFrom(values, set) {
  return Object.fromEntries(
    Object.entries(values).filter(([field, value]) => value !== (set[field] ?? null)),
  );
}

// A number box with − and + inside it, under its label.
function StepperField({ id, label, value, inputMode, placeholder, less, more, onChange }) {
  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={id}>
        {label}
      </label>
      <div className={styles.stepper}>
        <button type="button" className={styles.step} aria-label={less.label} onClick={less.run}>
          <Icon name="minus" />
        </button>
        <input
          id={id}
          className={styles.input}
          inputMode={inputMode}
          autoComplete="off"
          placeholder={placeholder}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
        <button type="button" className={styles.step} aria-label={more.label} onClick={more.run}>
          <Icon name="plus" />
        </button>
      </div>
    </div>
  );
}

/**
 * Everything about one set: its weight, reps and RPE (typed, or stepped with − and +), whether it
 * is a warm-up, a copy of it, or deleting it. A change is saved when the sheet closes, by "Done",
 * a tap beside it or Escape; while a field holds something that is not a number, closing drops it.
 */
function SetSheet({ set, title, onSave, onCopy, onDelete, onClose }) {
  const { t, i18n } = useTranslation();
  const language = i18n.language;
  const id = useId();
  const [draft, setDraft] = useState(() => draftFromSet(set, language));
  const values = readDraft(draft);
  const changes = values ? changesFrom(values, set) : {};

  const change = (field) => (text) => setDraft((current) => ({ ...current, [field]: text }));
  const stepped = (field, next) =>
    setDraft((current) => ({
      ...current,
      [field]: field === "reps" ? String(next) : toInputText(next, language),
    }));

  const stepWeight = (amount) => {
    const current = readNumber(draft.weight);
    const base = Number.isNaN(current) ? set.weight : current;
    stepped("weight", roundStep(Math.max(base + amount, 0)));
  };
  const stepReps = (amount) => {
    const current = readNumber(draft.reps);
    const base = Number.isInteger(current) ? current : set.reps;
    stepped("reps", Math.max(base + amount, 0));
  };
  const stepRpe = (amount) => {
    const current = readNumber(draft.rpe);
    const next = Number.isNaN(current) ? RPE_START : current + amount;
    stepped("rpe", roundStep(Math.min(Math.max(next, RPE_MIN), RPE_MAX)));
  };

  const close = () => {
    if (Object.keys(changes).length > 0) onSave(changes);
    onClose();
  };

  const step = (amount) => formatNumber(amount, language);

  return (
    <Sheet labelledBy={`${id}title`} closeLabel={t("log.closeSetOptions")} onClose={close}>
      <div className={styles.header}>
        <h2 id={`${id}title`} className={styles.title}>
          {title}
        </h2>
        <span className={set.isDone ? styles.statusDone : styles.status}>
          {set.isDone ? t("log.setDone") : t("log.setNotDone")}
        </span>
      </div>

      <div className={styles.fields}>
        <StepperField
          id={`${id}weight`}
          label={t("log.weightLabel")}
          value={draft.weight}
          inputMode="decimal"
          less={{
            label: t("log.lessWeightBy", { step: step(WEIGHT_STEP_KG) }),
            run: () => stepWeight(-WEIGHT_STEP_KG),
          }}
          more={{
            label: t("log.moreWeightBy", { step: step(WEIGHT_STEP_KG) }),
            run: () => stepWeight(WEIGHT_STEP_KG),
          }}
          onChange={change("weight")}
        />
        <StepperField
          id={`${id}reps`}
          label={t("log.repsLabel")}
          value={draft.reps}
          inputMode="numeric"
          less={{ label: t("log.lessReps"), run: () => stepReps(-REPS_STEP) }}
          more={{ label: t("log.moreReps"), run: () => stepReps(REPS_STEP) }}
          onChange={change("reps")}
        />
        <StepperField
          id={`${id}rpe`}
          label={t("log.rpeLabel")}
          value={draft.rpe}
          inputMode="decimal"
          placeholder="—"
          less={{
            label: t("log.lessRpeBy", { step: step(RPE_STEP) }),
            run: () => stepRpe(-RPE_STEP),
          }}
          more={{
            label: t("log.moreRpeBy", { step: step(RPE_STEP) }),
            run: () => stepRpe(RPE_STEP),
          }}
          onChange={change("rpe")}
        />
      </div>

      <div className={styles.divider} aria-hidden="true" />

      <button
        type="button"
        role="switch"
        aria-checked={draft.isWarmup}
        className={styles.switchRow}
        onClick={() => setDraft((current) => ({ ...current, isWarmup: !current.isWarmup }))}
      >
        <span className={styles.switchText}>
          <span className={styles.switchLabel}>{t("log.warmupLabel")}</span>
          <span className={styles.switchHint}>{t("log.warmupHint")}</span>
        </span>
        <span
          className={draft.isWarmup ? `${styles.switch} ${styles.switchOn}` : styles.switch}
          aria-hidden="true"
        >
          <span className={styles.knob} />
        </span>
      </button>

      <div className={styles.actions}>
        <button
          type="button"
          className={styles.secondary}
          onClick={() => {
            if (Object.keys(changes).length > 0) onSave(changes);
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

export default SetSheet;
