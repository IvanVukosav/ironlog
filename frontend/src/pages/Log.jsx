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
  const [exerciseTemplates, setExerciseTemplates] = useState([]);
  const [showExercisePicker, setShowExercisePicker] = useState(false);
  const [savePromptName, setSavePromptName] = useState(null);

  useEffect(() => {
    fetchJson(`/api/workouts?date=${date}`)
      .then((data) => setWorkout(data[0] || null))
      .catch((err) => console.error(err));

    fetchJson("/api/exercise-templates")
      .then((data) => setExerciseTemplates(data))
      .catch((err) => console.error(err));
  }, [date]);

  useEffect(() => {
    const handleClickOutside = () => setShowExercisePicker(false);
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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

    const isKnown = exerciseTemplates.some(
      (template) => template.name.toLowerCase() === exerciseName.trim().toLowerCase()
    );
    if (!isKnown) {
      setSavePromptName(exerciseName.trim());
    }

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
        setShowExercisePicker(false);
      })
      .catch((err) => console.error(err));
  };

  const updateWorkoutName = (name) => {
    if (!workout) return;
    fetchJson(`/api/workouts/${workout.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    })
      .then((data) => setWorkout((prev) => ({ ...prev, name: data.name })))
      .catch((err) => console.error(err));
  };

  const saveExerciseTemplate = (name) => {
    fetchJson("/api/exercise-templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    })
      .then((data) => {
        setExerciseTemplates((prev) => [...prev, data].sort((templateA, templateB) => templateA.name.localeCompare(templateB.name)));
        setSavePromptName(null);
      })
      .catch((err) => console.error(err));
  };

  const removeExerciseTemplate = (id) => {
    fetchJson(`/api/exercise-templates/${id}`, { method: "DELETE" })
      .then(() => setExerciseTemplates((prev) => prev.filter((template) => template.id !== id)))
      .catch((err) => console.error(err));
  };

  const filteredTemplates = exerciseName.trim()
    ? exerciseTemplates.filter((template) =>
        template.name.toLowerCase().includes(exerciseName.trim().toLowerCase())
      )
    : exerciseTemplates;

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

      {workout && (
        <input
          type="text"
          className={styles.workoutNameInput}
          placeholder="Naziv treninga (opcionalno)"
          defaultValue={workout.name || ""}
          onBlur={(event) => updateWorkoutName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.target.blur();
          }}
        />
      )}

      {!workout && (
        <button className={styles.startButton} onClick={createWorkout}>
          Započni trening
        </button>
      )}

      {workout && (
        <div>
          <div className={styles.addRow} style={{ position: "relative" }}>
            <input
              type="text"
              className={styles.exerciseInput}
              placeholder="Pretraži ili upiši vježbu"
              value={exerciseName}
              onChange={(event) => {
                setExerciseName(event.target.value);
                setShowExercisePicker(true);
                setSavePromptName(null);
              }}
              onFocus={() => setShowExercisePicker(true)}
            />
            <button className={styles.addButton} onClick={addExercise}>
              Dodaj vježbu
            </button>
            {showExercisePicker && (
              <div className={styles.exercisePicker}>
                {filteredTemplates.map((template) => (
                  <div key={template.id} className={styles.exercisePickerItem}>
                    <button
                      className={styles.exercisePickerName}
                      onClick={() => {
                        setExerciseName(template.name);
                        setShowExercisePicker(false);
                      }}
                    >
                      {template.name}
                    </button>
                    <button
                      className={styles.exercisePickerRemove}
                      onClick={() => removeExerciseTemplate(template.id)}
                    >
                      ✕
                    </button>
                  </div>
                ))}
                {exerciseName.trim() && !exerciseTemplates.some((template) => template.name.toLowerCase() === exerciseName.trim().toLowerCase()) && (
                  <div className={styles.exercisePickerCustom}>
                    + Dodaj "{exerciseName.trim()}" kao vježbu
                  </div>
                )}
              </div>
            )}
          </div>
          {savePromptName && (
            <div className={styles.savePrompt}>
              <span className={styles.savePromptText}>
                Spremi "{savePromptName}" na listu vježbi?
              </span>
              <button
                className={styles.savePromptYes}
                onClick={() => saveExerciseTemplate(savePromptName)}
              >
                Da
              </button>
              <button
                className={styles.savePromptNo}
                onClick={() => setSavePromptName(null)}
              >
                Ne
              </button>
            </div>
          )}

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
