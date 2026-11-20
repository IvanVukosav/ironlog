import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSettings } from "../context/useSettings";
import { useBestE1rms } from "../hooks/useBestE1rms";
import { DEFAULT_E1RM_FORMULA } from "../utils/oneRepMax";
import { plannedWeight, schemeToSets, setsToScheme } from "../utils/programScheme";
import { supersetLabels, tidySupersets, toggleSuperset } from "../utils/supersets";
import { formatNumber, formatPercent, parseDecimal, toInputText } from "../utils/numbers";
import Icon from "./Icon";
import NumberField from "./NumberField";
import ProgramSetSheet from "./ProgramSetSheet";
import styles from "./ProgramEditor.module.css";

const MIN_WEEKS = 1;
const MAX_WEEKS = 52;
const DEFAULT_WEEKS = 4;
const DEFAULT_TRAINING_MAX_PERCENT = 100;
// An exercise's first set: 8 reps at RPE 8, the weight picked on the day.
const FIRST_SET = { reps: 8, percent: null, weight: null, rpe: 8, drops: 0 };

let nextKey = 0;
const makeKey = () => ++nextKey;

function emptyExercise() {
  return { key: makeKey(), name: "", supersetGroup: null, weeks: [] };
}

function emptyDay() {
  return { key: makeKey(), name: "", exercises: [emptyExercise()] };
}

// The program as the form holds it: numbers as text, written the way the language writes them,
// and each week of an exercise as its list of sets.
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
    days: program.days.map((day) => {
      const groups = tidySupersets(day.exercises.map((exercise) => exercise.supersetGroup ?? null));
      return {
        key: makeKey(),
        name: day.name || "",
        exercises: day.exercises.map((exercise, index) => ({
          key: makeKey(),
          name: exercise.name,
          supersetGroup: groups[index],
          // A week the editor can't read (it never saves one) starts empty.
          weeks: exercise.weekSchemes.map((scheme) => schemeToSets(scheme) ?? []),
        })),
      };
    }),
  };
}

const withInvalid = (className, isInvalid) =>
  isInvalid ? `${className} ${styles.invalid}` : className;

/**
 * A program made week by week: the switch on top picks the week, and each exercise lists its
 * sets in it. A tap on a set opens it (reps, a weight in % or kg, RPE, drop sets); "Dodaj set"
 * copies the last one. Neighbouring exercises can be linked into a superset (A1, A2, …).
 */
function ProgramEditor({ program, exerciseNames, onSave, onCancel }) {
  const { t, i18n } = useTranslation();
  const language = i18n.language;
  const id = useId();
  const [draft, setDraft] = useState(() => toDraft(program, language));
  const [showErrors, setShowErrors] = useState(false);
  const [week, setWeek] = useState(1);
  // The set whose sheet is open: { dayKey, exerciseKey, index } in the week shown.
  const [openSet, setOpenSet] = useState(null);
  // The exercise whose week was just copied to the others, for the note under it.
  const [copiedFor, setCopiedFor] = useState(null);
  const weeks = Math.min(Math.max(parseInt(draft.weeks) || MIN_WEEKS, MIN_WEEKS), MAX_WEEKS);
  const weekNumbers = Array.from({ length: weeks }, (_, index) => index + 1);
  const currentWeek = Math.min(week, weeks);
  const weekIndex = currentWeek - 1;
  const trainingMax = parseDecimal(draft.trainingMaxPercent) || DEFAULT_TRAINING_MAX_PERCENT;
  const exerciseListId = `${id}exercises`;
  const { settings } = useSettings();
  // Each exercise's best e1RM, which the weights of its sets are worked out from.
  const bestE1rms = useBestE1rms(settings?.e1rmFormula ?? DEFAULT_E1RM_FORMULA);
  const e1rmOf = (exercise) => bestE1rms[exercise.name.trim()] ?? null;

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

  // The exercise's sets in the week shown, replaced by what `change` makes of them.
  const updateSets = (dayKey, exerciseKey, change) => {
    setCopiedFor(null);
    updateExercise(dayKey, exerciseKey, (exercise) => {
      const exerciseWeeks = [...exercise.weeks];
      exerciseWeeks[weekIndex] = change(exercise.weeks[weekIndex] ?? []);
      return { weeks: exerciseWeeks };
    });
  };

  const addSet = (dayKey, exerciseKey) =>
    updateSets(dayKey, exerciseKey, (sets) => [...sets, { ...(sets.at(-1) ?? FIRST_SET) }]);

  const copyWeekToAll = (dayKey, exerciseKey) => {
    updateExercise(dayKey, exerciseKey, (exercise) => {
      const sets = exercise.weeks[weekIndex] ?? [];
      return {
        weeks: weekNumbers.map((number) =>
          number === currentWeek ? sets : sets.map((set) => ({ ...set })),
        ),
      };
    });
    setCopiedFor(exerciseKey);
  };

  // The exercises with their superset letters made anew by `relabel(letters)`.
  const regroup = (exercises, relabel) => {
    const letters = relabel(exercises.map((exercise) => exercise.supersetGroup));
    return {
      exercises: exercises.map((exercise, index) => ({
        ...exercise,
        supersetGroup: letters[index],
      })),
    };
  };

  const removeExercise = (dayKey, exerciseKey) => {
    setCopiedFor(null);
    updateDay(dayKey, (day) =>
      regroup(
        day.exercises.filter((exercise) => exercise.key !== exerciseKey),
        tidySupersets,
      ),
    );
  };

  const toggleLink = (dayKey, index) =>
    updateDay(dayKey, (day) => regroup(day.exercises, (letters) => toggleSuperset(letters, index)));

  const hasErrors =
    !draft.name.trim() ||
    draft.days.some((day) => day.exercises.some((exercise) => !exercise.name.trim()));

  const save = () => {
    if (hasErrors) {
      setShowErrors(true);
      return;
    }
    onSave({
      name: draft.name.trim(),
      weeks,
      trainingMaxPercent: trainingMax,
      days: draft.days.map((day) => ({
        name: day.name,
        exercises: day.exercises.map((exercise) => ({
          name: exercise.name,
          supersetGroup: exercise.supersetGroup,
          weekSchemes: weekNumbers.map((number) => setsToScheme(exercise.weeks[number - 1] ?? [])),
        })),
      })),
    });
  };

  // "60 kg × 10" for a weight of its own, "≈ 85 kg × 8" for one worked out from the e1RM, and
  // without a weight "75 % × 5" or "8 ponavljanja".
  const describeMain = (set, e1rm) => {
    const weight = plannedWeight(set, e1rm, trainingMax);
    if (weight !== null) {
      const text = t("log.setWeightReps", {
        weight: formatNumber(weight, language),
        reps: set.reps,
      });
      return set.weight !== null ? text : t("programs.worked", { text });
    }
    if (set.percent !== null) {
      return t("programs.setPercentReps", {
        percent: formatPercent(set.percent, language),
        reps: set.reps,
      });
    }
    return t("programs.repsOnly", { count: set.reps });
  };
  // The intensity beside it: "RPE 7", or "75 %" when the main text shows the weight.
  const describeIntensity = (set, e1rm) => {
    if (set.percent !== null) {
      return plannedWeight(set, e1rm, trainingMax) !== null
        ? formatPercent(set.percent, language)
        : null;
    }
    return set.rpe !== null ? t("log.setRpe", { rpe: formatNumber(set.rpe, language) }) : null;
  };
  const describeDrops = (set) =>
    set.drops > 0 ? t("programs.dropCount", { count: set.drops }) : null;

  const openDayIndex = openSet ? draft.days.findIndex((day) => day.key === openSet.dayKey) : -1;
  const openExercise = draft.days[openDayIndex]?.exercises.find(
    (exercise) => exercise.key === openSet.exerciseKey,
  );
  const openSetValues = openExercise?.weeks[weekIndex]?.[openSet.index];

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

      {weeks > 1 && (
        <div className={styles.weekBar}>
          <div className={styles.weekSwitch} role="group" aria-label={t("programs.weekSwitch")}>
            {weekNumbers.map((number) => (
              <button
                key={number}
                type="button"
                className={styles.weekButton}
                aria-pressed={number === currentWeek}
                onClick={() => {
                  setWeek(number);
                  setCopiedFor(null);
                }}
              >
                {t("programs.weekLong", { number })}
              </button>
            ))}
          </div>
        </div>
      )}

      <datalist id={exerciseListId}>
        {exerciseNames.map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>

      {draft.days.map((day, dayIndex) => {
        const labels = supersetLabels(day.exercises.map((exercise) => exercise.supersetGroup));
        return (
          <section key={day.key} className={styles.card}>
            <div className={styles.dayHeader}>
              <h2 className={styles.dayTitle}>
                {t("programs.dayNumber", { number: dayIndex + 1 })}
              </h2>
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
              {day.exercises.map((exercise, index) => {
                const sets = exercise.weeks[weekIndex] ?? [];
                const next = day.exercises[index + 1];
                const group = exercise.supersetGroup;
                const isLinkedToNext = Boolean(group) && group === next?.supersetGroup;
                const isLinkedToPrevious =
                  index > 0 && Boolean(group) && group === day.exercises[index - 1].supersetGroup;
                const exerciseName = exercise.name || t("programs.exercise");
                const e1rm = e1rmOf(exercise);
                return (
                  <li
                    key={exercise.key}
                    className={
                      isLinkedToPrevious
                        ? `${styles.exercise} ${styles.exerciseLinked}`
                        : styles.exercise
                    }
                  >
                    <div className={styles.exerciseHeader}>
                      {labels[index] && (
                        <span className={styles.supersetBadge}>{labels[index]}</span>
                      )}
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
                          updateExercise(day.key, exercise.key, () => ({
                            name: event.target.value,
                          }))
                        }
                      />
                      {weeks > 1 && (
                        <button
                          type="button"
                          className={styles.iconButton}
                          aria-label={t("programs.copyWeekToAll", { number: currentWeek })}
                          title={t("programs.copyWeekToAll", { number: currentWeek })}
                          onClick={() => copyWeekToAll(day.key, exercise.key)}
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

                    {e1rm !== null && (
                      <p className={styles.e1rm}>
                        {t("programs.e1rmNote", { e1rm: formatNumber(e1rm, language) })}
                      </p>
                    )}

                    {copiedFor === exercise.key && (
                      <p className={styles.note} role="status">
                        {t("programs.weekCopied", { number: currentWeek })}
                      </p>
                    )}

                    {sets.length > 0 ? (
                      <ol className={styles.sets}>
                        {sets.map((set, setIndex) => {
                          const parts = [
                            describeMain(set, e1rm),
                            describeIntensity(set, e1rm),
                            describeDrops(set),
                          ];
                          const name = t("log.setNumberLabel", { number: setIndex + 1 });
                          return (
                            <li key={setIndex}>
                              <button
                                type="button"
                                className={styles.setRow}
                                aria-haspopup="dialog"
                                aria-label={t("programs.editSet", {
                                  set: [name, ...parts.filter(Boolean)].join(", "),
                                })}
                                onClick={() =>
                                  setOpenSet({
                                    dayKey: day.key,
                                    exerciseKey: exercise.key,
                                    index: setIndex,
                                  })
                                }
                              >
                                <span className={styles.setNumber}>{setIndex + 1}</span>
                                <span className={styles.setText}>
                                  <span className={styles.setMain}>{parts[0]}</span>
                                  {parts[1] && <span className={styles.setRpe}>{parts[1]}</span>}
                                  {parts[2] && <span className={styles.setDrops}>{parts[2]}</span>}
                                </span>
                                <span className={styles.setChevron}>
                                  <Icon name="chevronRight" size={18} />
                                </span>
                              </button>
                            </li>
                          );
                        })}
                      </ol>
                    ) : (
                      <p className={styles.emptyWeek}>
                        {weeks > 1
                          ? t("programs.emptyWeek", { number: currentWeek })
                          : t("programs.noSetsYet")}
                      </p>
                    )}

                    <button
                      type="button"
                      className={styles.addSetButton}
                      aria-label={t("programs.addSetTo", { name: exerciseName })}
                      onClick={() => addSet(day.key, exercise.key)}
                    >
                      <Icon name="plus" size={18} />
                      {t("programs.addSet")}
                    </button>

                    {next && (
                      <button
                        type="button"
                        className={styles.linkButton}
                        aria-pressed={isLinkedToNext}
                        onClick={() => toggleLink(day.key, index)}
                      >
                        <Icon name="link" size={16} />
                        {isLinkedToNext
                          ? t("programs.supersetLinked", { letter: group })
                          : t("programs.supersetLink")}
                      </button>
                    )}
                  </li>
                );
              })}
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
        );
      })}

      <button
        type="button"
        className={styles.addDayButton}
        onClick={() => setDraft((prev) => ({ ...prev, days: [...prev.days, emptyDay()] }))}
      >
        <Icon name="plus" size={18} />
        {t("programs.addDay")}
      </button>

      <p className={styles.help}>{t("programs.setsHelp")}</p>
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

      {openSetValues && (
        <ProgramSetSheet
          key={`${openSet.exerciseKey}-${weekIndex}-${openSet.index}`}
          set={openSetValues}
          title={`${t("log.setNumberLabel", { number: openSet.index + 1 })} · ${
            openExercise.name || t("programs.exercise")
          }`}
          subtitle={`${t("programs.weekLong", { number: currentWeek })} · ${t(
            "programs.dayNumber",
            { number: openDayIndex + 1 },
          )}`}
          e1rm={e1rmOf(openExercise)}
          trainingMaxPercent={trainingMax}
          onSave={(values) =>
            updateSets(openSet.dayKey, openSet.exerciseKey, (sets) =>
              sets.map((set, index) => (index === openSet.index ? values : set)),
            )
          }
          onCopy={(values) =>
            updateSets(openSet.dayKey, openSet.exerciseKey, (sets) => [
              ...sets.slice(0, openSet.index + 1),
              { ...values },
              ...sets.slice(openSet.index + 1),
            ])
          }
          onDelete={() =>
            updateSets(openSet.dayKey, openSet.exerciseKey, (sets) =>
              sets.filter((_, index) => index !== openSet.index),
            )
          }
          onClose={() => setOpenSet(null)}
        />
      )}
    </div>
  );
}

export default ProgramEditor;
