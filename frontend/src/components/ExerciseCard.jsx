import { useState, useRef, useEffect } from "react";
import { fetchJson } from "../api";
import { calculateOneRepMax } from "../utils/oneRepMax";
import styles from "./ExerciseCard.module.css";

const WEIGHT_STEP_KG = 1;
const MINIMUM_WEIGHT_KG = 0;
const RPE_SCALE_MAX = 10;
const E1RM_DECIMAL_PLACES = 1;

function calculateEstimatedOneRepMax(weight, reps, rpe, formula) {
  const repsInReserve = RPE_SCALE_MAX - rpe;
  const repsToFailure = reps + repsInReserve;
  return calculateOneRepMax(weight, repsToFailure, formula);
}

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

function Exercise({ exercise, onAddSet, onDeleteSet, onDeleteExercise, onUpdateSet, showE1rm, e1rmFormula }) {
  const [set, setSet] = useState({ weight: "", reps: "", rpe: "" });
  const [showMenu, setShowMenu] = useState(false);
  const [editingSetId, setEditingSetId] = useState(null);
  const [editSet, setEditSet] = useState({ weight: "", reps: "", rpe: "" });
  const menuRef = useRef(null);

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
    fetchJson(`/api/workouts/exercises/${exerciseId}/sets`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(set),
    })
      .then((data) => {
        onAddSet(data);
        setSet({ weight: "", reps: "", rpe: "" });
      })
      .catch((err) => console.error(err));
  };

  const deleteSet = (setId) => {
    fetchJson(`/api/workouts/sets/${setId}`, {
      method: "DELETE",
    })
      .then(() => onDeleteSet(setId))
      .catch((err) => console.error(err));
  };

  const deleteExercise = () => {
    setShowMenu(false);
    if (!window.confirm(`Obrisati vježbu "${exercise.name}" i sve njene setove?`)) {
      return;
    }
    fetchJson(`/api/workouts/exercises/${exercise.id}`, { method: "DELETE" })
      .then(() => onDeleteExercise(exercise.id))
      .catch((err) => console.error(err));
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
      .catch((err) => console.error(err));
  };

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <h3 className={styles.heading}>{exercise.name}</h3>
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
            <div key={workoutSet.id} className={styles.setRow}>
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
              <button
                className={styles.deleteSet}
                onClick={() => deleteSet(workoutSet.id)}
              >
                X
              </button>
            </div>
          )
        )}
      </div>
    </div>
  );
}

export default Exercise;
