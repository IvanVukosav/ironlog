import { useState } from "react";
import { fetchJson } from "../api";
import styles from "./ExerciseCard.module.css";

const WEIGHT_STEP_KG = 1;
const MINIMUM_WEIGHT_KG = 0;

function Exercise({ exercise, onAddSet, onDeleteSet }) {
  const [set, setSet] = useState({ weight: "", reps: "", rpe: "" });

  const adjustWeight = (amount) => {
    setSet((prev) => {
      const currentWeight = parseFloat(prev.weight) || 0;
      const nextWeight = Math.max(currentWeight + amount, MINIMUM_WEIGHT_KG);
      return { ...prev, weight: String(nextWeight) };
    });
  };

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

  return (
    <div className={styles.card}>
      <h3 className={styles.heading}>{exercise.name}</h3>
      <div className={styles.inputRow}>
        <div className={styles.weightGroup}>
          <button
            type="button"
            className={styles.stepButton}
            onClick={() => adjustWeight(-WEIGHT_STEP_KG)}
          >
            −
          </button>
          <div className={styles.weightInputWrapper}>
            <input
              type="text"
              className={styles.setInput}
              placeholder="Kilaza"
              value={set.weight}
              onChange={(event) =>
                setSet((prev) => ({ ...prev, weight: event.target.value }))
              }
            />
            <span className={styles.weightUnit}>kg</span>
          </div>
          <button
            type="button"
            className={styles.stepButton}
            onClick={() => adjustWeight(WEIGHT_STEP_KG)}
          >
            +
          </button>
        </div>
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
        {exercise.sets?.map((workoutSet) => (
          <div key={workoutSet.id} className={styles.setRow}>
            {workoutSet.weight}kg — {workoutSet.reps} reps @ RPE {workoutSet.rpe}
            <button
              className={styles.deleteSet}
              onClick={() => deleteSet(workoutSet.id)}
            >
              X
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default Exercise;
