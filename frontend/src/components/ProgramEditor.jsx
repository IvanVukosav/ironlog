import { useState } from "react";
import { useTranslation } from "react-i18next";
import { isValidScheme } from "../utils/programScheme";
import styles from "./ProgramEditor.module.css";

const MIN_WEEKS = 1;
const MAX_WEEKS = 52;
const DEFAULT_WEEKS = 4;

let nextKey = 0;
const makeKey = () => ++nextKey;

function emptyExercise() {
  return { key: makeKey(), name: "", weekSchemes: [] };
}

function emptyDay() {
  return { key: makeKey(), name: "", exercises: [emptyExercise()] };
}

function toDraft(program) {
  if (!program) {
    return { name: "", weeks: DEFAULT_WEEKS, trainingMaxPercent: 100, days: [emptyDay()] };
  }
  return {
    name: program.name,
    weeks: program.weeks,
    trainingMaxPercent: program.trainingMaxPercent,
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

function ProgramEditor({ program, exerciseNames, onSave, onCancel }) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState(() => toDraft(program));
  const [showErrors, setShowErrors] = useState(false);
  const weeks = Math.min(Math.max(parseInt(draft.weeks) || MIN_WEEKS, MIN_WEEKS), MAX_WEEKS);
  const weekNumbers = Array.from({ length: weeks }, (_, index) => index + 1);

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
      trainingMaxPercent: parseFloat(draft.trainingMaxPercent) || 100,
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
      <div className={styles.metaRow}>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>{t("programs.name")}</span>
          <input
            type="text"
            className={
              showErrors && !draft.name.trim()
                ? `${styles.nameInput} ${styles.invalid}`
                : styles.nameInput
            }
            value={draft.name}
            onChange={(event) => setDraft((prev) => ({ ...prev, name: event.target.value }))}
          />
        </label>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>{t("programs.weeks")}</span>
          <input
            type="number"
            min={MIN_WEEKS}
            max={MAX_WEEKS}
            className={styles.numberInput}
            value={draft.weeks}
            onChange={(event) => setDraft((prev) => ({ ...prev, weeks: event.target.value }))}
          />
        </label>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>{t("programs.trainingMax")}</span>
          <input
            type="number"
            min="1"
            max="100"
            className={styles.numberInput}
            value={draft.trainingMaxPercent}
            onChange={(event) =>
              setDraft((prev) => ({ ...prev, trainingMaxPercent: event.target.value }))
            }
          />
        </label>
      </div>

      <datalist id="program-exercise-names">
        {exerciseNames.map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>

      {draft.days.map((day, dayIndex) => (
        <div key={day.key} className={styles.day}>
          <div className={styles.dayHeader}>
            <span className={styles.dayNumber}>
              {t("programs.dayNumber", { number: dayIndex + 1 })}
            </span>
            <input
              type="text"
              className={styles.dayNameInput}
              placeholder={t("programs.dayNamePlaceholder")}
              value={day.name}
              onChange={(event) => updateDay(day.key, () => ({ name: event.target.value }))}
            />
            {draft.days.length > 1 && (
              <button
                type="button"
                className={styles.removeButton}
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

          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>{t("programs.exercise")}</th>
                  {weekNumbers.map((week) => (
                    <th key={week}>{t("programs.weekShort", { number: week })}</th>
                  ))}
                  <th />
                </tr>
              </thead>
              <tbody>
                {day.exercises.map((exercise) => (
                  <tr key={exercise.key}>
                    <td>
                      <input
                        type="text"
                        list="program-exercise-names"
                        className={
                          showErrors && !exercise.name.trim()
                            ? `${styles.exerciseInput} ${styles.invalid}`
                            : styles.exerciseInput
                        }
                        value={exercise.name}
                        onChange={(event) =>
                          updateExercise(day.key, exercise.key, () => ({
                            name: event.target.value,
                          }))
                        }
                      />
                    </td>
                    {weekNumbers.map((week) => {
                      const scheme = exercise.weekSchemes[week - 1] ?? "";
                      return (
                        <td key={week}>
                          <input
                            type="text"
                            className={
                              isValidScheme(scheme)
                                ? styles.schemeInput
                                : `${styles.schemeInput} ${styles.invalid}`
                            }
                            placeholder="5x5@75"
                            value={scheme}
                            onChange={(event) =>
                              setScheme(day.key, exercise.key, week - 1, event.target.value)
                            }
                          />
                        </td>
                      );
                    })}
                    <td className={styles.rowActions}>
                      {weeks > 1 && (
                        <button
                          type="button"
                          className={styles.iconButton}
                          title={t("programs.fillAllWeeks")}
                          onClick={() => fillAllWeeks(day.key, exercise.key)}
                        >
                          ⇉
                        </button>
                      )}
                      <button
                        type="button"
                        className={styles.iconButton}
                        title={t("programs.removeExercise")}
                        onClick={() =>
                          updateDay(day.key, (current) => ({
                            exercises: current.exercises.filter(
                              (other) => other.key !== exercise.key,
                            ),
                          }))
                        }
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button
            type="button"
            className={styles.textButton}
            onClick={() =>
              updateDay(day.key, (current) => ({
                exercises: [...current.exercises, emptyExercise()],
              }))
            }
          >
            {t("programs.addExercise")}
          </button>
        </div>
      ))}

      <button
        type="button"
        className={styles.textButton}
        onClick={() => setDraft((prev) => ({ ...prev, days: [...prev.days, emptyDay()] }))}
      >
        {t("programs.addDay")}
      </button>

      <p className={styles.help}>{t("programs.schemeHelp")}</p>
      {showErrors && hasErrors && <p className={styles.error}>{t("programs.fixErrors")}</p>}

      <div className={styles.actions}>
        <button type="button" className={styles.saveButton} onClick={save}>
          {t("common.save")}
        </button>
        <button type="button" className={styles.cancelButton} onClick={onCancel}>
          {t("common.cancel")}
        </button>
      </div>
    </div>
  );
}

export default ProgramEditor;
