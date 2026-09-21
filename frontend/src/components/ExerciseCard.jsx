import { useState, useRef, useEffect } from "react";
import { fetchJson } from "../api";
import { calculateEstimatedOneRepMax, findBestSetByE1rm } from "../utils/oneRepMax";
import { useToast } from "../context/useToast";
import { useDragReorder } from "../hooks/useDragReorder";
import styles from "./ExerciseCard.module.css";

const WEIGHT_STEP_KG = 1;
const MINIMUM_WEIGHT_KG = 0;
const E1RM_DECIMAL_PLACES = 1;

function WeightInput({ value, onChange }) {
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
          placeholder="Kilaza"
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

function Exercise({
  exercise,
  onAddSet,
  onDeleteSet,
  onDeleteExercise,
  onUpdateSet,
  onReorderSets,
  showE1rm,
  e1rmFormula,
  isDragging,
  isDropTarget,
  onDragHandlePointerDown,
}) {
  const { showError, showSuccess } = useToast();
  const [set, setSet] = useState({ weight: "", reps: "", rpe: "" });
  const [showMenu, setShowMenu] = useState(false);
  const [editingSetId, setEditingSetId] = useState(null);
  const [editSet, setEditSet] = useState({ weight: "", reps: "", rpe: "" });
  const menuRef = useRef(null);

  const { draggedId: draggedSetId, hoveredId: hoveredSetId, startDrag: startSetDrag } = useDragReorder(
    exercise.sets || [],
    (newSets) => {
      onReorderSets(newSets);
      fetchJson(`/api/workouts/exercises/${exercise.id}/sets/reorder`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ setIds: newSets.map((workoutSet) => workoutSet.id) }),
      }).catch((err) => {
        console.error(err);
        showError(err.message);
      });
    },
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

  const addSet = (exerciseId) => {
    fetchJson(`/api/stats/exercise/${encodeURIComponent(exercise.name)}/history`)
      .then((historyEntries) => {
        const previousSets = historyEntries.flatMap((entry) => entry.sets);
        const previousBest = previousSets.length > 0
          ? findBestSetByE1rm(previousSets, e1rmFormula)
          : null;

        return fetchJson(`/api/workouts/exercises/${exerciseId}/sets`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(set),
        }).then((data) => {
          onAddSet(data);
          setSet({ weight: "", reps: "", rpe: "" });

          const newSetE1rm = calculateEstimatedOneRepMax(data.weight, data.reps, data.rpe, e1rmFormula);
          if (!previousBest || newSetE1rm > previousBest.e1rm) {
            showSuccess(`🎉 Novi PR! ${exercise.name} ${newSetE1rm.toFixed(E1RM_DECIMAL_PLACES)}kg e1RM`);
          }
        });
      })
      .catch((err) => {
        console.error(err);
        showError(err.message);
      });
  };

  const deleteSet = (setId) => {
    fetchJson(`/api/workouts/sets/${setId}`, {
      method: "DELETE",
    })
      .then(() => onDeleteSet(setId))
      .catch((err) => {
        console.error(err);
        showError(err.message);
      });
  };

  const deleteExercise = () => {
    setShowMenu(false);
    if (!window.confirm(`Obrisati vježbu "${exercise.name}" i sve njene setove?`)) {
      return;
    }
    fetchJson(`/api/workouts/exercises/${exercise.id}`, { method: "DELETE" })
      .then(() => onDeleteExercise(exercise.id))
      .catch((err) => {
        console.error(err);
        showError(err.message);
      });
  };

  const duplicateSet = (workoutSet) => {
    fetchJson(`/api/workouts/exercises/${exercise.id}/sets`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        weight: workoutSet.weight,
        reps: workoutSet.reps,
        rpe: workoutSet.rpe,
      }),
    })
      .then((data) => onAddSet(data))
      .catch((err) => {
        console.error(err);
        showError(err.message);
      });
  };

  const startEditingSet = (workoutSet) => {
    setEditingSetId(workoutSet.id);
    setEditSet({
      weight: String(workoutSet.weight),
      reps: String(workoutSet.reps),
      rpe: String(workoutSet.rpe),
    });
  };

  const saveEditingSet = (setId) => {
    fetchJson(`/api/workouts/sets/${setId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editSet),
    })
      .then((data) => {
        onUpdateSet(data);
        setEditingSetId(null);
      })
      .catch((err) => {
        console.error(err);
        showError(err.message);
      });
  };

  return (
    <div
      className={[
        styles.card,
        isDragging && styles.cardDragging,
        isDropTarget && styles.cardDropTarget,
      ].filter(Boolean).join(" ")}
      data-drag-id={exercise.id}
    >
      <div className={styles.cardHeader}>
        <div className={styles.cardHeaderLeft}>
          <span
            className={styles.dragHandle}
            onPointerDown={(event) => {
              event.preventDefault();
              onDragHandlePointerDown();
            }}
          >
            ⠿
          </span>
          <h3 className={styles.heading}>{exercise.name}</h3>
        </div>
        <div className={styles.menuWrapper} ref={menuRef}>
          <button className={styles.menuButton} onClick={() => setShowMenu((prev) => !prev)}>
            ⋮
          </button>
          {showMenu && (
            <div className={styles.menuDropdown}>
              <button className={styles.menuItem} onClick={deleteExercise}>
                Obriši vježbu
              </button>
            </div>
          )}
        </div>
      </div>
      <div className={styles.inputRow}>
        <WeightInput
          value={set.weight}
          onChange={(weight) => setSet((prev) => ({ ...prev, weight }))}
        />
        <input
          type="text"
          className={styles.setInput}
          placeholder="Broj ponavljanja"
          value={set.reps}
          onChange={(event) =>
            setSet((prev) => ({ ...prev, reps: event.target.value }))
          }
        />
        <input
          type="text"
          className={styles.setInput}
          placeholder="Rpe"
          value={set.rpe}
          onChange={(event) =>
            setSet((prev) => ({ ...prev, rpe: event.target.value }))
          }
        />
        <button
          className={styles.addSetButton}
          onClick={() => addSet(exercise.id)}
        >
          Dodaj set
        </button>
      </div>
      <div className={styles.setList}>
        {exercise.sets?.map((workoutSet) =>
          editingSetId === workoutSet.id ? (
            <div key={workoutSet.id} className={styles.setRowEditing}>
              <WeightInput
                value={editSet.weight}
                onChange={(weight) => setEditSet((prev) => ({ ...prev, weight }))}
              />
              <input
                type="text"
                className={styles.setInput}
                placeholder="Broj ponavljanja"
                value={editSet.reps}
                onChange={(event) =>
                  setEditSet((prev) => ({ ...prev, reps: event.target.value }))
                }
              />
              <input
                type="text"
                className={styles.setInput}
                placeholder="Rpe"
                value={editSet.rpe}
                onChange={(event) =>
                  setEditSet((prev) => ({ ...prev, rpe: event.target.value }))
                }
              />
              <button
                className={styles.saveSetButton}
                onClick={() => saveEditingSet(workoutSet.id)}
              >
                Spremi
              </button>
              <button
                className={styles.cancelSetButton}
                onClick={() => setEditingSetId(null)}
              >
                Odustani
              </button>
            </div>
          ) : (
            <div
              key={workoutSet.id}
              className={[
                styles.setRow,
                draggedSetId === workoutSet.id && styles.setRowDragging,
                hoveredSetId === String(workoutSet.id) && draggedSetId !== workoutSet.id && styles.setRowDropTarget,
              ].filter(Boolean).join(" ")}
              data-drag-id={workoutSet.id}
            >
              <span
                className={styles.dragHandle}
                onPointerDown={(event) => {
                  event.preventDefault();
                  startSetDrag(workoutSet.id);
                }}
              >
                ⠿
              </span>
              <span
                className={styles.setText}
                onClick={() => startEditingSet(workoutSet)}
              >
                {workoutSet.weight}kg — {workoutSet.reps} reps @ RPE {workoutSet.rpe}
                {showE1rm && Number.isFinite(workoutSet.rpe) && (
                  <span className={styles.e1rmText}>
                    {" "}— e1RM: {calculateEstimatedOneRepMax(workoutSet.weight, workoutSet.reps, workoutSet.rpe, e1rmFormula).toFixed(E1RM_DECIMAL_PLACES)}kg
                  </span>
                )}
              </span>
              <div className={styles.setRowActions}>
                <button
                  className={styles.duplicateSet}
                  onClick={() => duplicateSet(workoutSet)}
                  aria-label="Kopiraj set"
                  title="Kopiraj set"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="9" y="9" width="13" height="13" rx="2" />
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                  </svg>
                </button>
                <button
                  className={styles.deleteSet}
                  onClick={() => deleteSet(workoutSet.id)}
                >
                  X
                </button>
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
}

export default Exercise;
