import { useState, useEffect } from "react";
import { fetchJson } from "../api";

function Dashboard() {
  const [workout, setWorkout] = useState(null);
  const [nutritionDay, setNutritionDay] = useState(null);
  const [settings, setSettings] = useState(null);

  const today = new Date().toISOString().split("T")[0];

  useEffect(() => {
    fetchJson(`/api/workouts?date=${today}`)
      .then((data) => setWorkout(data[0] || null))
      .catch((err) => console.error(err));

    fetchJson(`/api/nutrition?date=${today}`)
      .then((data) => setNutritionDay(data[0] || null))
      .catch((err) => console.error(err));

    fetchJson("/api/settings")
      .then((data) => setSettings(data))
      .catch((err) => console.error(err));
  }, []);

  const allItems = nutritionDay?.meals?.flatMap((m) => m.items) || [];
  const totalKcal = allItems.reduce((sum, item) => sum + item.kcal, 0);

  return (
    <div className="page">
      <h1>Dashboard</h1>
      {(settings?.showWorkoutWidget ?? true) && (
        <div>
          <h2>Trening danas</h2>
          {workout ? (
            <p>Vježbe: {workout.exercises?.length}</p>
          ) : (
            <p>Nema treninga</p>
          )}
        </div>
      )}
      {(settings?.showNutritionWidget ?? true) && (
        <div>
          <h2>Prehrana danas</h2>
          <p>
            {totalKcal} / {settings?.kcalGoal || "?"} kcal
          </p>
        </div>
      )}

      <div>
        <h2>Tjedni napredak</h2>
        <p>Cilj: {settings?.trainingsPerWeek} treninga tjedno</p>
      </div>
    </div>
  );
}

export default Dashboard;
