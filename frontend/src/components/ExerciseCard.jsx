import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { fetchJson } from "../api";
import {
  calculateEstimatedOneRepMax,
  findBestSetByE1rm,
  MAX_E1RM_REPS_TO_FAILURE,
} from "../utils/oneRepMax";
import { useToast } from "../context/useToast";
import { formatDayMonth } from "../utils/dates";
import { useDragReorder } from "../hooks/useDragReorder";
import styles from "./ExerciseCard.module.css";

const WEIGHT_STEP_KG = 1;
const MINIMUM_WEIGHT_KG = 0;
const E1RM_DECIMAL_PLACES = 1;
// The set form's fields hold what was typed, so they are strings.
const EMPTY_SET = { weight: "", reps: "", rpe: "", isWarmup: false };

function formatSetShort(workoutSet) {
  const base = `${workoutSet.weight}×${workoutSet.reps}`;
  return Number.isFinite(workoutSet.rpe) ? `${base} @${workoutSet.rpe}` : base;
}

function WeightInput({ value, onChange }) {
  const { t } = useTranslation();
  const adjust = (amount) => {
    const currentWeight = parseFloat(value) || 0;
    const nextWeight = Math.max(currentWeight + amount, MINIMUM_WEIGHT_KG);
    onChange(String(nextWeight));
  };

  return (
    <div className={styles.weightGroup}>
      <button type="button" className={styles.stepButton} onClick={() => adjust(-WEIGHT_STEP_KG)}>
        −
      </button>
      <div className={styles.weightInputWrapper}>
        <input
          type="text"
          className={styles.setInput}
          placeholder={t("log.weightPlaceholder")}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
        <span className={styles.weightUnit}>kg</span>
      </div>
      <button type="button" className={styles.stepButton} onClick={() => adjust(WEIGHT_STEP_KG)}>
        +
      </button>
    </div>
  );
}

// e1RM after a logged set, or "—" when it has too many reps to failure to estimate one.
function SetE1rm({ workoutSet, formula }) {
  const { t } = useTranslation();
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
      {t("log.e1rmSuffix", { value: e1rm.toFixed(E1RM_DECIMAL_PLACES) })}
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
  const { t } = useTranslation();
  const { showSuccess } = useToast();
  const [set, setSet] = useState(EMPTY_SET);
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

  const fillFromLastSet = (previousSet) => {
    setSet({
      weight: String(previousSet.weight),
      reps: String(previousSet.reps),
      rpe: Number.isFinite(previousSet.rpe) ? String(previousSet.rpe) : "",
      isWarmup: false,
    });
  };

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

    const saved = await actions.addSet(exercise.id, set);
    if (!saved) return;
    setSet(EMPTY_SET);
    if (!previousSets || saved.isWarmup) return;

    const e1rm = calculateEstimatedOneRepMax(saved.weight, saved.reps, saved.rpe, e1rmFormula);
    const previousBest = findBestSetByE1rm(previousSets, e1rmFormula);
    if (e1rm !== null && (!previousBest || e1rm > previousBest.e1rm)) {
      showSuccess(
        t("log.newPrToast", { name: exercise.name, value: e1rm.toFixed(E1RM_DECIMAL_PLACES) }),
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
    setEditSet({
      weight: String(workoutSet.weight),
      reps: String(workoutSet.reps),
      rpe: Number.isFinite(workoutSet.rpe) ? String(workoutSet.rpe) : "",
      isWarmup: Boolean(workoutSet.isWarmup),
    });
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
    if (await actions.updateSet(setId, editSet)) setEditingSetId(null);
  };

  return (
    <div
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
        <div className={styles.cardHeaderLeft}>
          <span className={styles.dragHandle} {...dragHandleProps}>
            ⠿
          </span>
          <h3 className={styles.heading}>{exercise.name}</h3>
          <input
            type="text"
            className={
              supersetColor
                ? `${styles.supersetInput} ${styles.supersetInputActive}`
                : styles.supersetInput
            }
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
        <div className={styles.menuWrapper} ref={menuRef}>
          <button className={styles.menuButton} onClick={() => setShowMenu((prev) => !prev)}>
            ⋮
          </button>
          {showMenu && (
            <div className={styles.menuDropdown}>
              {!showNotes && (
                <button
                  className={styles.menuItem}
                  onClick={() => {
                    setShowNotes(true);
                    setShowMenu(false);
                  }}
                >
                  {t("log.addNote")}
                </button>
              )}
              <button className={styles.menuItem} onClick={deleteExercise}>
                {t("log.deleteExercise")}
              </button>
            </div>
          )}
        </div>
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
              onClick={() => fillFromLastSet(previousSet)}
            >
              {formatSetShort(previousSet)}
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
      {showNotes && (
        <textarea
          className={styles.notesInput}
          placeholder={t("log.exerciseNotesPlaceholder")}
          rows={2}
          autoFocus={!exercise.notes}
          defaultValue={exercise.notes || ""}
          onBlur={(event) => updateNotes(event.target.value)}
        />
      )}
      <div className={styles.inputRow}>
        <WeightInput
          value={set.weight}
          onChange={(weight) => setSet((prev) => ({ ...prev, weight }))}
        />
        <input
          type="text"
          className={styles.repsInput}
          placeholder={t("log.repsPlaceholder")}
          value={set.reps}
          onChange={(event) => setSet((prev) => ({ ...prev, reps: event.target.value }))}
        />
        <input
          type="text"
          className={styles.setInput}
          placeholder={t("log.rpePlaceholder")}
          value={set.rpe}
          onChange={(event) => setSet((prev) => ({ ...prev, rpe: event.target.value }))}
        />
        <button
          className={styles.addSetButton}
          disabled={!set.weight.trim() || !set.reps.trim()}
          onClick={addSet}
        >
          {t("log.addSet")}
        </button>
      </div>
      <div className={styles.setList}>
        {exercise.sets.map((workoutSet) =>
          editingSetId === workoutSet.id ? (
            <div key={workoutSet.id} className={styles.setRowEditing}>
              <WeightInput
                value={editSet.weight}
                onChange={(weight) => setEditSet((prev) => ({ ...prev, weight }))}
              />
              <input
                type="text"
                className={styles.repsInput}
                placeholder={t("log.repsPlaceholder")}
                value={editSet.reps}
                onChange={(event) => setEditSet((prev) => ({ ...prev, reps: event.target.value }))}
              />
              <input
                type="text"
                className={styles.setInput}
                placeholder={t("log.rpePlaceholder")}
                value={editSet.rpe}
                onChange={(event) => setEditSet((prev) => ({ ...prev, rpe: event.target.value }))}
              />
              <button
                className={styles.saveSetButton}
                disabled={!editSet.weight.trim() || !editSet.reps.trim()}
                onClick={() => saveEditingSet(workoutSet.id)}
              >
                {t("common.save")}
              </button>
              <button className={styles.cancelSetButton} onClick={() => setEditingSetId(null)}>
                {t("common.cancel")}
              </button>
            </div>
          ) : (
            <div
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
              <span className={styles.dragHandle} {...setDrag.getHandleProps(workoutSet.id)}>
                ⠿
              </span>
              <span className={styles.setText} onClick={() => startEditingSet(workoutSet)}>
                {Number.isFinite(workoutSet.rpe)
                  ? t("log.setSummary", {
                      weight: workoutSet.weight,
                      reps: workoutSet.reps,
                      rpe: workoutSet.rpe,
                    })
                  : t("log.setSummaryNoRpe", { weight: workoutSet.weight, reps: workoutSet.reps })}
                {showE1rm && Number.isFinite(workoutSet.rpe) && (
                  <SetE1rm workoutSet={workoutSet} formula={e1rmFormula} />
                )}
              </span>
              <div className={styles.setRowActions}>
                <button
                  className={styles.duplicateSet}
                  onClick={() => duplicateSet(workoutSet)}
                  aria-label={t("log.duplicateSet")}
                  title={t("log.duplicateSet")}
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect x="9" y="9" width="13" height="13" rx="2" />
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                  </svg>
                </button>
                <button
                  className={styles.deleteSet}
                  onClick={() => actions.deleteSet(workoutSet.id)}
                >
                  X
                </button>
              </div>
            </div>
          ),
        )}
      </div>
    </div>
  );
}

export default Exercise;
