import { useState } from "react";

function Exercise({ exercise, onAddSet, onDeleteSet }) {
  const [set, setSet] = useState({ weight: "", reps: "", rpe: "" });

  const addSet = (exerciseId) => {
    fetch(`http://localhost:3001/api/workouts/exercises/${exerciseId}/sets`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(set),
    })
      .then((res) => res.json())
      .then((data) => {
        onAddSet(data);

        setSet({ weight: "", reps: "", rpe: "" });
      });
  };

  const deleteSet = (setId) => {
    fetch(`http://localhost:3001/api/workouts/sets/${setId}`, {
      method: "DELETE",
    }).then(() => onDeleteSet(setId));
  };

  return (
    <>
      <h3>{exercise.name}</h3>
      <input
        type="text"
        placeholder="Kilaza"
        value={set.weight}
        onChange={(e) =>
          setSet((prev) => ({ ...prev, weight: e.target.value }))
        }></input>

      <input
        type="text"
        placeholder="Broj ponavljanja"
        value={set.reps}
        onChange={(e) =>
          setSet((prev) => ({ ...prev, reps: e.target.value }))
        }></input>

      <input
        type="text"
        placeholder="Rpe"
        value={set.rpe}
        onChange={(e) =>
          setSet((prev) => ({ ...prev, rpe: e.target.value }))
        }></input>

      <button onClick={() => addSet(exercise.id)}>Dodaj set</button>

      {exercise.sets?.map((s) => (
        <p key={s.id}>
          {s.weight}kg — {s.reps} reps @ RPE {s.rpe}
          <button onClick={() => deleteSet(s.id)}>X</button>
        </p>
      ))}
    </>
  );
}

export default Exercise;
