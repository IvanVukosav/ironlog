import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import ExerciseCard from "../components/ExerciseCard";
import { fetchJson } from "../api";
import styles from "./Log.module.css";

function Log() {
  const [searchParams] = useSearchParams();
  const [date, setDate] = useState(
    searchParams.get("date") || new Date().toISOString().split("T")[0],
  );
  const [workout, setWorkout] = useState(null);
  const [exerciseName, setExerciseName] = useState("");

  useEffect(() => {
    fetchJson(`/api/workouts?date=${date}`)
      .then((data) => setWorkout(data[0] || null))
      .catch((err) => console.error(err));
  }, [date]);

  const createWorkout = () => {
    fetchJson("/api/workouts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date }),
    })
      .then((data) => setWorkout(data))
      .catch((err) => console.error(err));
  };

  const addExercise = () => {
    if (!exerciseName.trim()) return;
    if (workout.exercises?.some((exercise) => exercise.name === exerciseName)) return;

    fetchJson(`/api/workouts/${workout.id}/exercises`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: exerciseName }),
    })
      .then((data) => {
        setWorkout((prev) => ({
          ...prev,
          exercises: [...(prev.exercises || []), { ...data, sets: [] }],
        }));
        setExerciseName("");
      })
      .catch((err) => console.error(err));
  };

  return (
    <div className={styles.page}>
      <h1 className={styles.heading}>Log treninga</h1>

      <div className={styles.topRow}>
        <input
          type="date"
          className={styles.dateInput}
          value={date}
          onChange={(event) => setDate(event.target.value)}
        />
        {workout && (
          <span className={styles.meta}>Workout ID: {workout.id}</span>
        )}
      </div>

      {!workout && (
        <button className={styles.startButton} onClick={createWorkout}>
          Započni trening
        </button>
      )}

      {workout && (
        <div>
          <div className={styles.addRow}>
            <input
              type="text"
              className={styles.exerciseInput}
              placeholder="Ime vježbe"
              value={exerciseName}
              onChange={(event) => setExerciseName(event.target.value)}
            />
            <button className={styles.addButton} onClick={addExercise}>
              Dodaj vježbu
            </button>
          </div>

          <div className={styles.cardList}>
            {workout.exercises?.map((exercise) => (
              <ExerciseCard
                key={exercise.id}
                exercise={exercise}
                onDeleteSet={(setId) =>
                  setWorkout((prev) => ({
                    ...prev,
                    exercises: prev.exercises.map((currentExercise) =>
                      currentExercise.id === exercise.id
                        ? {
                            ...currentExercise,
                            sets: currentExercise.sets.filter(
                              (currentSet) => currentSet.id !== setId,
                            ),
                          }
                        : currentExercise,
                    ),
                  }))
                }
                onAddSet={(data) =>
                  setWorkout((prev) => ({
                    ...prev,
                    exercises: prev.exercises.map((currentExercise) =>
                      currentExercise.id === exercise.id
                        ? {
                            ...currentExercise,
                            sets: [...(currentExercise.sets || []), data],
                          }
                        : currentExercise,
                    ),
                  }))
                }
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default Log;
