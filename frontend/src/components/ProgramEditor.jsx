import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { isValidScheme } from "../utils/programScheme";
import { parseDecimal, toInputText } from "../utils/numbers";
import Icon from "./Icon";
import NumberField from "./NumberField";
import styles from "./ProgramEditor.module.css";

const MIN_WEEKS = 1;
const MAX_WEEKS = 52;
const DEFAULT_WEEKS = 4;
const DEFAULT_TRAINING_MAX_PERCENT = 100;

let nextKey = 0;
const makeKey = () => ++nextKey;

function emptyExercise() {
  return { key: makeKey(), name: "", weekSchemes: [] };
}

function emptyDay() {
  return { key: makeKey(), name: "", exercises: [emptyExercise()] };
}

// The program as the form holds it: numbers as text, written the way the language writes them.
function toDraft(program, language) {
  if (!program) {
    return {
      name: "",
      weeks: String(DEFAULT_WEEKS),
      trainingMaxPercent: String(DEFAULT_TRAINING_MAX_PERCENT),
      days: [emptyDay()],
    };
  }
  return {
    name: program.name,
    weeks: String(program.weeks),
    trainingMaxPercent: toInputText(program.trainingMaxPercent, language),
    days: program.days.map((day) => ({
      key: makeKey(),
      name: day.name || "",
      exercises: day.exercises.map((exercise) => ({
        key: makeKey(),
        name: exercise.name,
        weekSchemes: exercise.weekSchemes,
      })),
    })),
  };
}

const withInvalid = (className, isInvalid) =>
  isInvalid ? `${className} ${styles.invalid}` : className;

function ProgramEditor({ program, exerciseNames, onSave, onCancel }) {
  const { t, i18n } = useTranslation();
  const id = useId();
  const [draft, setDraft] = useState(() => toDraft(program, i18n.language));
  const [showErrors, setShowErrors] = useState(false);
  const weeks = Math.min(Math.max(parseInt(draft.weeks) || MIN_WEEKS, MIN_WEEKS), MAX_WEEKS);
  const weekNumbers = Array.from({ length: weeks }, (_, index) => index + 1);
  const exerciseListId = `${id}exercises`;

  const updateDay = (dayKey, update) => {
    setDraft((prev) => ({
      ...prev,
      days: prev.days.map((day) => (day.key === dayKey ? { ...day, ...update(day) } : day)),
    }));
  };

  const updateExercise = (dayKey, exerciseKey, update) => {
    updateDay(dayKey, (day) => ({
      exercises: day.exercises.map((exercise) =>
        exercise.key === exerciseKey ? { ...exercise, ...update(exercise) } : exercise,
      ),
    }));
  };

  const setScheme = (dayKey, exerciseKey, weekIndex, value) => {
    updateExercise(dayKey, exerciseKey, (exercise) => {
      const weekSchemes = [...exercise.weekSchemes];
      weekSchemes[weekIndex] = value;
      return { weekSchemes };
    });
  };

  const fillAllWeeks = (dayKey, exerciseKey) => {
    updateExercise(dayKey, exerciseKey, (exercise) => ({
      weekSchemes: weekNumbers.map(() => exercise.weekSchemes[0] ?? ""),
    }));
  };

  const removeExercise = (dayKey, exerciseKey) => {
    updateDay(dayKey, (day) => ({
      exercises: day.exercises.filter((exercise) => exercise.key !== exerciseKey),
    }));
  };

  const hasErrors =
    !draft.name.trim() ||
    draft.days.some((day) =>
      day.exercises.some(
        (exercise) =>
          !exercise.name.trim() ||
          weekNumbers.some((week) => !isValidScheme(exercise.weekSchemes[week - 1])),
      ),
    );

  const save = () => {
    if (hasErrors) {
      setShowErrors(true);
      return;
    }
    onSave({
      name: draft.name.trim(),
      weeks,
      trainingMaxPercent: parseDecimal(draft.trainingMaxPercent) || DEFAULT_TRAINING_MAX_PERCENT,
      days: draft.days.map((day) => ({
        name: day.name,
        exercises: day.exercises.map((exercise) => ({
          name: exercise.name,
          weekSchemes: weekNumbers.map((week) => exercise.weekSchemes[week - 1] ?? ""),
        })),
      })),
    });
  };

  return (
    <div className={styles.editor}>
      <section className={styles.card}>
        <div className={styles.metaFields}>
          <div className={`${styles.field} ${styles.nameField}`}>
            <label className={styles.fieldLabel} htmlFor={`${id}name`}>
              {t("programs.name")}
            </label>
            <input
              id={`${id}name`}
              type="text"
              className={withInvalid(styles.textInput, showErrors && !draft.name.trim())}
              autoComplete="off"
              value={draft.name}
              onChange={(event) => setDraft((prev) => ({ ...prev, name: event.target.value }))}
            />
          </div>
          <NumberField
            label={t("programs.weeks")}
            inputMode="numeric"
            value={draft.weeks}
            onChange={(value) => setDraft((prev) => ({ ...prev, weeks: value }))}
          />
          <NumberField
            label={t("programs.trainingMax")}
            value={draft.trainingMaxPercent}
            onChange={(value) => setDraft((prev) => ({ ...prev, trainingMaxPercent: value }))}
          />
        </div>
      </section>

      <datalist id={exerciseListId}>
        {exerciseNames.map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>

      {draft.days.map((day, dayIndex) => (
        <section key={day.key} className={styles.card}>
          <div className={styles.dayHeader}>
            <h2 className={styles.dayTitle}>{t("programs.dayNumber", { number: dayIndex + 1 })}</h2>
            {draft.days.length > 1 && (
              <button
                type="button"
                className={styles.quietButton}
                onClick={() =>
                  setDraft((prev) => ({
                    ...prev,
                    days: prev.days.filter((other) => other.key !== day.key),
                  }))
                }
              >
                {t("programs.removeDay")}
              </button>
            )}
          </div>
          <div className={styles.field}>
            <label className={styles.fieldLabel} htmlFor={`${id}day${day.key}`}>
              {t("programs.dayNameLabel")}
            </label>
            <input
              id={`${id}day${day.key}`}
              type="text"
              className={styles.textInput}
              placeholder={t("programs.dayNamePlaceholder")}
              autoComplete="off"
              value={day.name}
              onChange={(event) => updateDay(day.key, () => ({ name: event.target.value }))}
            />
          </div>

          <ol className={styles.exercises}>
            {day.exercises.map((exercise) => (
              <li key={exercise.key} className={styles.exercise}>
                <div className={styles.exerciseHeader}>
                  <input
                    type="text"
                    list={exerciseListId}
                    className={withInvalid(
                      styles.exerciseInput,
                      showErrors && !exercise.name.trim(),
                    )}
                    aria-label={t("programs.exercise")}
                    placeholder={t("programs.exercise")}
                    autoComplete="off"
                    value={exercise.name}
                    onChange={(event) =>
                      updateExercise(day.key, exercise.key, () => ({ name: event.target.value }))
                    }
                  />
                  {weeks > 1 && (
                    <button
                      type="button"
                      className={styles.iconButton}
                      aria-label={t("programs.fillAllWeeks")}
                      title={t("programs.fillAllWeeks")}
                      onClick={() => fillAllWeeks(day.key, exercise.key)}
                    >
                      <Icon name="copy" size={18} />
                    </button>
                  )}
                  <button
                    type="button"
                    className={styles.iconButton}
                    aria-label={t("programs.removeExercise")}
                    title={t("programs.removeExercise")}
                    onClick={() => removeExercise(day.key, exercise.key)}
                  >
                    <Icon name="close" size={18} />
                  </button>
                </div>
                <div className={styles.weekGrid}>
                  {weekNumbers.map((week) => {
                    const scheme = exercise.weekSchemes[week - 1] ?? "";
                    const schemeId = `${id}${exercise.key}-${week}`;
                    return (
                      <div key={week} className={styles.field}>
                        <label className={styles.fieldLabel} htmlFor={schemeId}>
                          {t("programs.weekLong", { number: week })}
                        </label>
                        <input
                          id={schemeId}
                          type="text"
                          className={withInvalid(styles.schemeInput, !isValidScheme(scheme))}
                          placeholder="5x5@75"
                          title={scheme || undefined}
                          autoComplete="off"
                          value={scheme}
                          onChange={(event) =>
                            setScheme(day.key, exercise.key, week - 1, event.target.value)
                          }
                        />
                      </div>
                    );
                  })}
                </div>
              </li>
            ))}
          </ol>

          <button
            type="button"
            className={styles.addButton}
            onClick={() =>
              updateDay(day.key, (current) => ({
                exercises: [...current.exercises, emptyExercise()],
              }))
            }
          >
            <Icon name="plus" size={16} />
            {t("programs.addExercise")}
          </button>
        </section>
      ))}

      <button
        type="button"
        className={styles.addDayButton}
        onClick={() => setDraft((prev) => ({ ...prev, days: [...prev.days, emptyDay()] }))}
      >
        <Icon name="plus" size={18} />
        {t("programs.addDay")}
      </button>

      <p className={styles.help}>{t("programs.schemeHelp")}</p>
      {showErrors && hasErrors && (
        <p className={styles.error} role="alert">
          {t("programs.fixErrors")}
        </p>
      )}

      <div className={styles.actions}>
        <button type="button" className={styles.saveButton} onClick={save}>
          {t("common.save")}
        </button>
        <button type="button" className={styles.quietButton} onClick={onCancel}>
          {t("common.cancel")}
        </button>
      </div>
    </div>
  );
}

export default ProgramEditor;
