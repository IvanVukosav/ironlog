import { useState, useEffect } from "react";
import ExerciseCard from "../components/ExerciseCard";
import { fetchJson } from "../api";

function Log() {
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
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
    if (workout.exercises?.some((e) => e.name === exerciseName)) return;

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
    <div className="page">
      <h1>Log treninga</h1>

      <input
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
      />

      {!workout && (
        <button onClick={createWorkout}>Započni trening</button>
      )}

      {workout && <p>Workout ID: {workout.id}</p>}

      {workout && (
        <div>
          <input
            type="text"
            placeholder="Ime vježbe"
            value={exerciseName}
            onChange={(e) => setExerciseName(e.target.value)}
          />

          <button onClick={addExercise}>Dodaj vježbu</button>

          {workout.exercises?.map((exercise) => (
            <ExerciseCard
              key={exercise.id}
              exercise={exercise}
              onDeleteSet={(setId) =>
                setWorkout((prev) => ({
                  ...prev,
                  exercises: prev.exercises.map((e) =>
                    e.id === exercise.id
                      ? { ...e, sets: e.sets.filter((s) => s.id !== setId) }
                      : e,
                  ),
                }))
              }
              onAddSet={(data) =>
                setWorkout((prev) => ({
                  ...prev,
                  exercises: prev.exercises.map((e) =>
                    e.id === exercise.id
                      ? { ...e, sets: [...(e.sets || []), data] }
                      : e,
                  ),
                }))
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default Log;
