import { useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { fetchJson } from "../api";
import {
  calculateEstimatedOneRepMax,
  findBestSetByE1rm,
  MAX_E1RM_REPS_TO_FAILURE,
} from "../utils/oneRepMax";
import { useToast } from "../context/useToast";
import { formatDayMonth } from "../utils/dates";
import { formatNumber, parseDecimal, toDecimalText, toInputText } from "../utils/numbers";
import { useDragReorder } from "../hooks/useDragReorder";
import Icon from "./Icon";
import styles from "./ExerciseCard.module.css";

const WEIGHT_STEP_KG = 1;
const MINIMUM_WEIGHT_KG = 0;
const E1RM_DECIMAL_PLACES = 1;
// The set forms hold what was typed, so their fields are strings.
const EMPTY_SET = { weight: "", reps: "", rpe: "", isWarmup: false };

// A set as a short chip: "102,5×5 @8" in Croatian.
function formatSetShort(workoutSet, language) {
  const base = `${formatNumber(workoutSet.weight, language)}×${workoutSet.reps}`;
  return Number.isFinite(workoutSet.rpe)
    ? `${base} @${formatNumber(workoutSet.rpe, language)}`
    : base;
}

// A saved set in the form, its numbers written the way the language writes them.
function formFromSet(workoutSet, language) {
  return {
    weight: toInputText(workoutSet.weight, language),
    reps: String(workoutSet.reps),
    rpe: toInputText(workoutSet.rpe, language),
    isWarmup: Boolean(workoutSet.isWarmup),
  };
}

// What the API gets from a form: the numbers as typed, a decimal comma read as a point.
function toSetValues(form) {
  return {
    weight: toDecimalText(form.weight),
    reps: toDecimalText(form.reps),
    rpe: toDecimalText(form.rpe),
    isWarmup: form.isWarmup,
  };
}

const isComplete = (form) => form.weight.trim() !== "" && form.reps.trim() !== "";

// Weight, reps and RPE, each under its label. The weight has − and + for 1 kg steps.
function SetFields({ values, onChange }) {
  const { t } = useTranslation();
  const id = useId();
  const change = (field) => (event) => onChange({ ...values, [field]: event.target.value });

  const stepWeight = (amount) => {
    const current = parseDecimal(values.weight);
    const next = String(
      Math.max((Number.isNaN(current) ? 0 : current) + amount, MINIMUM_WEIGHT_KG),
    );
    // A weight typed with a decimal comma keeps its comma.
    onChange({ ...values, weight: values.weight.includes(",") ? next.replace(".", ",") : next });
  };

  // Each label names its input with htmlFor: a label wrapped around the weight's buttons would
  // name the first button instead, and a click on its text would press it.
  return (
    <div className={styles.fields}>
      <div className={styles.field} data-field="weight">
        <label className={styles.fieldLabel} htmlFor={`${id}weight`}>
          {t("log.weightLabel")}
        </label>
        <div className={styles.weightControl}>
          <button
            type="button"
            className={styles.stepButton}
            aria-label={t("log.lessWeight")}
            onClick={() => stepWeight(-WEIGHT_STEP_KG)}
          >
            <Icon name="minus" size={18} />
          </button>
          <input
            id={`${id}weight`}
            className={styles.weightInput}
            inputMode="decimal"
            autoComplete="off"
            value={values.weight}
            onChange={change("weight")}
          />
          <button
            type="button"
            className={styles.stepButton}
            aria-label={t("log.moreWeight")}
            onClick={() => stepWeight(WEIGHT_STEP_KG)}
          >
            <Icon name="plus" size={18} />
          </button>
        </div>
      </div>
      <div className={styles.field} data-field="reps">
        <label className={styles.fieldLabel} htmlFor={`${id}reps`}>
          {t("log.repsLabel")}
        </label>
        <input
          id={`${id}reps`}
          className={styles.fieldInput}
          inputMode="numeric"
          autoComplete="off"
          value={values.reps}
          onChange={change("reps")}
        />
      </div>
      <div className={styles.field} data-field="rpe">
        <label className={styles.fieldLabel} htmlFor={`${id}rpe`}>
          {t("log.rpeLabel")}
        </label>
        <input
          id={`${id}rpe`}
          className={styles.fieldInput}
          inputMode="decimal"
          autoComplete="off"
          value={values.rpe}
          onChange={change("rpe")}
        />
      </div>
    </div>
  );
}

// e1RM after a logged set, or "—" when it has too many reps to failure to estimate one.
function SetE1rm({ workoutSet, formula }) {
  const { t, i18n } = useTranslation();
  const e1rm = calculateEstimatedOneRepMax(
    workoutSet.weight,
    workoutSet.reps,
    workoutSet.rpe,
    formula,
  );

  if (e1rm === null) {
    return (
      <span
        className={styles.e1rmText}
        title={t("log.e1rmUnavailableHint", { max: MAX_E1RM_REPS_TO_FAILURE })}
      >
        {t("log.e1rmUnavailable")}
      </span>
    );
  }
  return (
    <span className={styles.e1rmText}>
      {t("log.e1rmSuffix", {
        value: formatNumber(e1rm, i18n.language, { decimals: E1RM_DECIMAL_PLACES }),
      })}
    </span>
  );
}

// `actions` are the workout's own (useWorkout): they save a change and resolve to what was saved,
// or to null when saving failed and the failure has already been reported.
function Exercise({
  exercise,
  actions,
  showE1rm,
  e1rmFormula,
  supersetColor,
  isDragging,
  dropPosition,
  dragItemProps,
  dragHandleProps,
}) {
  const { t, i18n } = useTranslation();
  const language = i18n.language;
  const { showSuccess } = useToast();
  const [set, setSet] = useState(EMPTY_SET);
  const [isAdding, setIsAdding] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [editingSetId, setEditingSetId] = useState(null);
  const [editSet, setEditSet] = useState(EMPTY_SET);
  // What is being typed into the superset box; null when not editing, so the saved group shows.
  const [supersetDraft, setSupersetDraft] = useState(null);
  const [lastSession, setLastSession] = useState(null);
  const [showNotes, setShowNotes] = useState(Boolean(exercise.notes));
  const menuRef = useRef(null);

  useEffect(() => {
    fetchJson(
      `/api/stats/exercise/${encodeURIComponent(exercise.name)}/last?workoutId=${exercise.workoutId}`,
    )
      .then(setLastSession)
      .catch((err) => console.error(err));
  }, [exercise.name, exercise.workoutId]);

  const lastWorkingSets = lastSession?.sets.filter((previousSet) => !previousSet.isWarmup) ?? [];

  const copyLastSession = async () => {
    // One after another so the copied sets keep their order; the first failure ends the copy.
    for (const { weight, reps, rpe } of lastWorkingSets) {
      if (!(await actions.addSet(exercise.id, { weight, reps, rpe, isWarmup: false }))) return;
    }
  };

  const setDrag = useDragReorder(exercise.sets, (newSets) =>
    actions.reorderSets(exercise.id, newSets),
  );

  useEffect(() => {
    if (!showMenu) return undefined;
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setShowMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showMenu]);

  const addSet = async () => {
    setIsAdding(true);
    // Asked for before saving, so the new set is not among the ones it has to beat. The set is
    // saved even when this fails; it just can't be called a PR then.
    const previousSets = await fetchJson(
      `/api/stats/exercise/${encodeURIComponent(exercise.name)}/history`,
    ).then(
      (sessions) => sessions.flatMap((session) => session.sets),
      (err) => {
        console.error(err);
        return null;
      },
    );

    const saved = await actions.addSet(exercise.id, toSetValues(set));
    setIsAdding(false);
    if (!saved) return;
    setSet(EMPTY_SET);
    if (!previousSets || saved.isWarmup) return;

    const e1rm = calculateEstimatedOneRepMax(saved.weight, saved.reps, saved.rpe, e1rmFormula);
    const previousBest = findBestSetByE1rm(previousSets, e1rmFormula);
    if (e1rm !== null && (!previousBest || e1rm > previousBest.e1rm)) {
      showSuccess(
        t("log.newPrToast", {
          name: exercise.name,
          value: formatNumber(e1rm, language, { decimals: E1RM_DECIMAL_PLACES }),
        }),
      );
    }
  };

  const deleteExercise = () => {
    setShowMenu(false);
    if (window.confirm(t("log.confirmDeleteExercise", { name: exercise.name }))) {
      actions.deleteExercise(exercise.id);
    }
  };

  const duplicateSet = ({ weight, reps, rpe, isWarmup }) =>
    actions.addSet(exercise.id, { weight, reps, rpe, isWarmup });

  const startEditingSet = (workoutSet) => {
    setEditingSetId(workoutSet.id);
    setEditSet(formFromSet(workoutSet, language));
  };

  const updateSupersetGroup = async (value) => {
    await actions.updateExercise(exercise.id, { supersetGroup: value });
    // Show the saved group again (or the old one if saving failed), unless the box was
    // already edited further while the request was in flight.
    setSupersetDraft((draft) => (draft === value ? null : draft));
  };

  const updateNotes = (notes) => {
    if (notes.trim() !== (exercise.notes || "")) actions.updateExercise(exercise.id, { notes });
  };

  const saveEditingSet = async (setId) => {
    if (await actions.updateSet(setId, toSetValues(editSet))) setEditingSetId(null);
  };

  // Working sets are numbered; a warm-up shows a W and does not count. A set being edited keeps
  // its number, so the rows below it and the add button don't renumber meanwhile.
  const setNumbers = [];
  let workingSetCount = 0;
  for (const workoutSet of exercise.sets) {
    if (!workoutSet.isWarmup) workingSetCount += 1;
    setNumbers.push(workoutSet.isWarmup ? null : workingSetCount);
  }

  const setRows = exercise.sets.map((workoutSet, index) => {
    if (editingSetId === workoutSet.id) {
      return (
        <li key={workoutSet.id} className={styles.setRowEditing}>
          <form
            className={styles.editForm}
            onSubmit={(event) => {
              event.preventDefault();
              if (isComplete(editSet)) saveEditingSet(workoutSet.id);
            }}
          >
            <SetFields values={editSet} onChange={setEditSet} />
            <div className={styles.editActions}>
              <button
                type="submit"
                className={styles.saveSetButton}
                disabled={!isComplete(editSet)}
              >
                {t("common.save")}
              </button>
              <button
                type="button"
                className={styles.cancelSetButton}
                onClick={() => setEditingSetId(null)}
              >
                {t("common.cancel")}
              </button>
            </div>
          </form>
        </li>
      );
    }

    const hasRpe = Number.isFinite(workoutSet.rpe);
    return (
      <li
        key={workoutSet.id}
        className={[
          styles.setRow,
          workoutSet.isWarmup && styles.setRowWarmup,
          setDrag.isDragging(workoutSet.id) && styles.setRowDragging,
          setDrag.dropPosition(workoutSet.id) === "before" && styles.setRowDropBefore,
          setDrag.dropPosition(workoutSet.id) === "after" && styles.setRowDropAfter,
        ]
          .filter(Boolean)
          .join(" ")}
        {...setDrag.getItemProps(workoutSet.id)}
      >
        <span
          className={
            workoutSet.isWarmup ? `${styles.setNumber} ${styles.setNumberWarmup}` : styles.setNumber
          }
          title={
            workoutSet.isWarmup
              ? `${t("log.warmupLabel")} · ${t("log.dragToReorder")}`
              : t("log.dragToReorder")
          }
          {...setDrag.getHandleProps(workoutSet.id)}
        >
          {workoutSet.isWarmup ? t("log.warmupBadge") : setNumbers[index]}
        </span>
        <button
          type="button"
          className={styles.setText}
          title={t("log.editSet")}
          onClick={() => startEditingSet(workoutSet)}
        >
          <span className={styles.setMain}>
            {t("log.setWeightReps", {
              weight: formatNumber(workoutSet.weight, language),
              reps: workoutSet.reps,
            })}
          </span>
          {hasRpe && (
            <span className={styles.setRpe}>
              {t("log.setRpe", { rpe: formatNumber(workoutSet.rpe, language) })}
            </span>
          )}
          {showE1rm && hasRpe && <SetE1rm workoutSet={workoutSet} formula={e1rmFormula} />}
        </button>
        <div className={styles.setRowActions}>
          <button
            type="button"
            className={styles.iconButton}
            aria-label={t("log.duplicateSet")}
            title={t("log.duplicateSet")}
            onClick={() => duplicateSet(workoutSet)}
          >
            <Icon name="copy" size={16} />
          </button>
          <button
            type="button"
            className={styles.iconButton}
            aria-label={t("log.deleteSet")}
            title={t("log.deleteSet")}
            onClick={() => actions.deleteSet(workoutSet.id)}
          >
            <Icon name="close" size={16} />
          </button>
        </div>
      </li>
    );
  });

  return (
    <section
      className={[
        styles.card,
        supersetColor && styles.cardGrouped,
        isDragging && styles.cardDragging,
        dropPosition === "before" && styles.cardDropBefore,
        dropPosition === "after" && styles.cardDropAfter,
      ]
        .filter(Boolean)
        .join(" ")}
      style={supersetColor ? { "--group-color": supersetColor } : undefined}
      {...dragItemProps}
    >
      <div className={styles.cardHeader}>
        <span className={styles.dragHandle} title={t("log.dragToReorder")} {...dragHandleProps}>
          <Icon name="grip" size={18} />
        </span>
        <div className={styles.titleBlock}>
          <div className={styles.titleRow}>
            <h2 className={styles.heading}>{exercise.name}</h2>
            <input
              type="text"
              className={
                supersetColor
                  ? `${styles.supersetInput} ${styles.supersetInputActive}`
                  : styles.supersetInput
              }
              aria-label={t("log.supersetLabel")}
              title={t("log.supersetHint")}
              placeholder={t("log.supersetPlaceholder")}
              value={supersetDraft ?? exercise.supersetGroup ?? ""}
              maxLength={8}
              onChange={(event) => setSupersetDraft(event.target.value)}
              onBlur={(event) => updateSupersetGroup(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") event.target.blur();
              }}
            />
          </div>
          {lastWorkingSets.length > 0 && (
            <div className={styles.lastSession}>
              <span className={styles.lastSessionLabel}>
                {t("log.lastTime", { date: formatDayMonth(lastSession.date) })}
              </span>
              {lastWorkingSets.map((previousSet) => (
                <button
                  type="button"
                  key={previousSet.id}
                  className={styles.lastSessionChip}
                  title={t("log.useLastSet")}
                  onClick={() => setSet(formFromSet(previousSet, language))}
                >
                  {formatSetShort(previousSet, language)}
                </button>
              ))}
              <button type="button" className={styles.copyAllButton} onClick={copyLastSession}>
                {t("log.copyAllSets")}
              </button>
              {lastSession.notes && (
                <span className={styles.lastSessionNotes}>“{lastSession.notes}”</span>
              )}
            </div>
          )}
        </div>
        <div className={styles.menuWrapper} ref={menuRef}>
          <button
            type="button"
            className={styles.menuButton}
            aria-label={t("log.exerciseOptions", { name: exercise.name })}
            aria-expanded={showMenu}
            onClick={() => setShowMenu((prev) => !prev)}
          >
            <Icon name="more" />
          </button>
          {showMenu && (
            <div className={styles.menuDropdown}>
              {!showNotes && (
                <button
                  type="button"
                  className={styles.menuItem}
                  onClick={() => {
                    setShowNotes(true);
                    setShowMenu(false);
                  }}
                >
                  {t("log.addNote")}
                </button>
              )}
              <button type="button" className={styles.menuItem} onClick={deleteExercise}>
                {t("log.deleteExercise")}
              </button>
            </div>
          )}
        </div>
      </div>

      {showNotes && (
        <textarea
          className={styles.notesInput}
          aria-label={t("log.exerciseNotesPlaceholder")}
          placeholder={t("log.exerciseNotesPlaceholder")}
          rows={2}
          autoFocus={!exercise.notes}
          defaultValue={exercise.notes || ""}
          onBlur={(event) => updateNotes(event.target.value)}
        />
      )}

      {setRows.length > 0 && <ol className={styles.setList}>{setRows}</ol>}

      <form
        className={styles.addSet}
        onSubmit={(event) => {
          event.preventDefault();
          if (isComplete(set) && !isAdding) addSet();
        }}
      >
        <SetFields values={set} onChange={setSet} />
        <button
          type="submit"
          data-action="add-set"
          className={styles.addSetButton}
          disabled={!isComplete(set) || isAdding}
        >
          {t("log.addSetNumber", { number: workingSetCount + 1 })}
        </button>
      </form>
    </section>
  );
}

export default Exercise;
