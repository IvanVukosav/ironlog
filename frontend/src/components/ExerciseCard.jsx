import { useState } from "react";
import { fetchJson } from "../api";
import styles from "./ExerciseCard.module.css";

function Exercise({ exercise, onAddSet, onDeleteSet }) {
  const [set, setSet] = useState({ weight: "", reps: "", rpe: "" });

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
        <input
          type="text"
          className={styles.setInput}
          placeholder="Kilaza"
          value={set.weight}
          onChange={(event) =>
            setSet((prev) => ({ ...prev, weight: event.target.value }))
          }
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
