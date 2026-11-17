import { useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { fetchJson } from "../api";
import {
  calculateEstimatedOneRepMax,
  DEFAULT_E1RM_FORMULA,
  E1RM_FORMULAS,
  findBestSetByE1rm,
  formulaMaxReps,
  isRoughEstimate,
  MAX_RELIABLE_REPS_TO_FAILURE,
  repsToFailure,
} from "../utils/oneRepMax";
import { useToast } from "../context/useToast";
import { formatDayMonth } from "../utils/dates";
import { formatNumber, parseDecimal, toDecimalText, toInputText } from "../utils/numbers";
import { buildWarmupSets, loadPlateSetup } from "../utils/plates";
import { useDragReorder } from "../hooks/useDragReorder";
import Icon from "./Icon";
import SetSheet from "./SetSheet";
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

// e1RM after a logged set: with "≈" when it is only a rough guess (more than
// MAX_RELIABLE_REPS_TO_FAILURE reps to failure), and "—" when there is none: no rep to failure,
// or more than the formula takes at all (the hover says which).
function SetE1rm({ workoutSet, formula }) {
  const { t, i18n } = useTranslation();
  const { weight, reps, rpe } = workoutSet;
  const e1rm = calculateEstimatedOneRepMax(weight, reps, rpe, formula);

  if (e1rm === null) {
    const isPastFormula = repsToFailure(reps, rpe) > formulaMaxReps(formula);
    const { label } = E1RM_FORMULAS[formula] ?? E1RM_FORMULAS[DEFAULT_E1RM_FORMULA];
    return (
      <span
        className={styles.e1rmText}
        title={
          isPastFormula
            ? t("log.e1rmUnavailableHint", { formula: label, max: formulaMaxReps(formula) })
            : undefined
        }
      >
        {t("log.e1rmUnavailable")}
      </span>
    );
  }
  const value = formatNumber(e1rm, i18n.language, { decimals: E1RM_DECIMAL_PLACES });
  if (isRoughEstimate(reps, rpe)) {
    return (
      <span
        className={styles.e1rmText}
        title={t("log.e1rmRoughHint", { max: MAX_RELIABLE_REPS_TO_FAILURE })}
      >
        {t("log.e1rmRough", { value })}
      </span>
    );
  }
  return <span className={styles.e1rmText}>{t("log.e1rmSuffix", { value })}</span>;
}

// `actions` are the workout's own (useWorkout): they save a change and resolve to what was saved,
// or to null when saving failed and the failure has already been reported.
//
// A set is ticked off as it is done; until then it is a plan (from a program, a copy, a template).
// `isLiveDay` is true for today and later, where a new copy is a plan to tick off; on a day filled
// in afterwards it is done at once. `onSetDone(set)` hears of every set that became done, so the
// page can start the rest and the workout's clock. `nextSetId` is the set to do next.
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
  nextSetId,
  isLiveDay,
  onSetDone,
}) {
  const { t, i18n } = useTranslation();
  const language = i18n.language;
  const { showSuccess } = useToast();
  const [set, setSet] = useState(EMPTY_SET);
  const [isAdding, setIsAdding] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  // The set whose sheet is open.
  const [optionsSetId, setOptionsSetId] = useState(null);
  // What is being typed into the superset box; null when not editing, so the saved group shows.
  const [supersetDraft, setSupersetDraft] = useState(null);
  const [lastSession, setLastSession] = useState(null);
  const [showNotes, setShowNotes] = useState(Boolean(exercise.notes));
  // Kalkulator's bar and plates, for the warm-up ramp.
  const [plateSetup] = useState(loadPlateSetup);
  const menuRef = useRef(null);

  useEffect(() => {
    fetchJson(
      `/api/stats/exercise/${encodeURIComponent(exercise.name)}/last?workoutId=${exercise.workoutId}`,
    )
      .then(setLastSession)
      .catch((err) => console.error(err));
  }, [exercise.name, exercise.workoutId]);

  const lastWorkingSets = lastSession?.sets.filter((previousSet) => !previousSet.isWarmup) ?? [];

  // Last time's sets come in as a plan to tick off, or done on a day filled in afterwards.
  const copyLastSession = async () => {
    // One after another so the copied sets keep their order; the first failure ends the copy.
    for (const { weight, reps, rpe } of lastWorkingSets) {
      const values = { weight, reps, rpe, isWarmup: false, isDone: !isLiveDay };
      if (!(await actions.addSet(exercise.id, values))) return;
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
    onSetDone(saved);
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
    actions.addSet(exercise.id, { weight, reps, rpe, isWarmup, isDone: !isLiveDay });

  const toggleDone = async (workoutSet) => {
    const saved = await actions.updateSet(workoutSet.id, { isDone: !workoutSet.isDone });
    if (saved?.isDone) onSetDone(saved);
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

  // Working sets are numbered; a warm-up shows a Z (W in English) and does not count.
  const setNumbers = [];
  let workingSetCount = 0;
  for (const workoutSet of exercise.sets) {
    if (!workoutSet.isWarmup) workingSetCount += 1;
    setNumbers.push(workoutSet.isWarmup ? null : workingSetCount);
  }
  const setNameAt = (index) =>
    setNumbers[index] === null
      ? t("log.warmupLabel")
      : t("log.setNumberLabel", { number: setNumbers[index] });
  const weightReps = (workoutSet) =>
    t("log.setWeightReps", {
      weight: formatNumber(workoutSet.weight, language),
      reps: workoutSet.reps,
    });

  // While sets are still planned, they are ticked off rather than typed: the form gives way to
  // "add a set like the last one" and, for a first exercise without them, warm-ups.
  const hasPlan = exercise.sets.some((workoutSet) => !workoutSet.isDone);
  const lastWorkingSet = exercise.sets.findLast((workoutSet) => !workoutSet.isWarmup);
  const firstWorkingSet = exercise.sets.find((workoutSet) => !workoutSet.isWarmup);
  const warmupSets =
    firstWorkingSet && !exercise.sets.some((workoutSet) => workoutSet.isWarmup)
      ? buildWarmupSets(firstWorkingSet.weight, plateSetup)
      : [];

  const addPlannedSet = () => {
    const model = lastWorkingSet ?? exercise.sets.at(-1);
    actions.addSet(exercise.id, {
      weight: model.weight,
      reps: model.reps,
      rpe: null,
      isWarmup: false,
      isDone: !isLiveDay,
    });
  };

  const addWarmups = () =>
    actions.addSets(
      exercise.id,
      warmupSets.map(({ weight, reps }) => ({ weight, reps, isWarmup: true, isDone: !isLiveDay })),
      "start",
    );

  const setRows = exercise.sets.map((workoutSet, index) => {
    const hasRpe = Number.isFinite(workoutSet.rpe);
    const isNext = workoutSet.id === nextSetId;
    const name = `${setNameAt(index)}, ${weightReps(workoutSet)}`;
    const badgeClass = workoutSet.isWarmup
      ? `${styles.setNumber} ${styles.setNumberWarmup}`
      : workoutSet.isDone
        ? styles.setNumber
        : `${styles.setNumber} ${styles.setNumberPlanned}`;
    const tickClass = workoutSet.isDone
      ? `${styles.tickMark} ${styles.tickMarkDone}`
      : isNext
        ? `${styles.tickMark} ${styles.tickMarkNext}`
        : styles.tickMark;

    return (
      <li
        key={workoutSet.id}
        className={[
          styles.setRow,
          workoutSet.isWarmup && styles.setRowWarmup,
          isNext && styles.setRowNext,
          setDrag.isDragging(workoutSet.id) && styles.setRowDragging,
          setDrag.dropPosition(workoutSet.id) === "before" && styles.setRowDropBefore,
          setDrag.dropPosition(workoutSet.id) === "after" && styles.setRowDropAfter,
        ]
          .filter(Boolean)
          .join(" ")}
        {...setDrag.getItemProps(workoutSet.id)}
      >
        <button
          type="button"
          className={styles.setButton}
          aria-haspopup="dialog"
          aria-label={t("log.setOptions", { set: name })}
          onClick={() => setOptionsSetId(workoutSet.id)}
        >
          {/* The number is also the handle that drags the set; a tap without a drag opens it. */}
          <span
            className={styles.setHandle}
            title={t("log.dragToReorder")}
            {...setDrag.getHandleProps(workoutSet.id)}
          >
            <span className={badgeClass}>
              {workoutSet.isWarmup ? t("log.warmupBadge") : setNumbers[index]}
            </span>
          </span>
          <span className={styles.setText}>
            <span
              className={
                workoutSet.isDone ? styles.setMain : `${styles.setMain} ${styles.setMainPlanned}`
              }
            >
              {weightReps(workoutSet)}
            </span>
            {hasRpe && (
              <span className={styles.setRpe}>
                {t("log.setRpe", { rpe: formatNumber(workoutSet.rpe, language) })}
              </span>
            )}
            {showE1rm && hasRpe && workoutSet.isDone && (
              <SetE1rm workoutSet={workoutSet} formula={e1rmFormula} />
            )}
          </span>
        </button>
        <button
          type="button"
          className={styles.tick}
          aria-pressed={workoutSet.isDone}
          aria-label={
            workoutSet.isDone
              ? t("log.markNotDone", { set: name })
              : t("log.markDone", { set: name })
          }
          onClick={() => toggleDone(workoutSet)}
        >
          <span className={tickClass}>
            <Icon name="check" size={18} />
          </span>
        </button>
      </li>
    );
  });

  const optionsIndex = exercise.sets.findIndex((workoutSet) => workoutSet.id === optionsSetId);
  const optionsSet = optionsIndex === -1 ? null : exercise.sets[optionsIndex];

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

      {hasPlan ? (
        <div className={styles.planActions}>
          <button type="button" className={styles.planButton} onClick={addPlannedSet}>
            <Icon name="plus" size={18} />
            {t("log.addPlannedSet")}
          </button>
          {warmupSets.length > 0 && (
            <button
              type="button"
              className={styles.planButton}
              aria-label={t("log.addWarmupsFor", { name: exercise.name })}
              onClick={addWarmups}
            >
              <Icon name="plus" size={18} />
              {t("log.addWarmups")}
            </button>
          )}
        </div>
      ) : (
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
      )}

      {optionsSet && (
        <SetSheet
          key={optionsSet.id}
          set={optionsSet}
          title={`${setNameAt(optionsIndex)} · ${exercise.name}`}
          onSave={(changes) => actions.updateSet(optionsSet.id, changes)}
          onCopy={duplicateSet}
          onDelete={() => actions.deleteSet(optionsSet.id)}
          onClose={() => setOptionsSetId(null)}
        />
      )}
    </section>
  );
}

export default Exercise;
