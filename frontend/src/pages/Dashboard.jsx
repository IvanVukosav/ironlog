import { useState, useEffect } from "react";

function Dashboard() {
  const [workout, setWorkout] = useState(null);
  const [nutritionDay, setNutritionDay] = useState(null);
  const [settings, setSettings] = useState(null);

  const today = new Date().toISOString().split("T")[0];

  useEffect(() => {
    fetch(`http://localhost:3001/api/workouts?date=${today}`)
      .then((res) => res.json())
      .then((data) => setWorkout(data[0] || null));

    fetch(`http://localhost:3001/api/nutrition?date=${today}`)
      .then((res) => res.json())
      .then((data) => setNutritionDay(data[0] || null));

    fetch("http://localhost:3001/api/settings")
      .then((res) => res.json())
      .then((data) => setSettings(data));
  }, []);

  const allItems = nutritionDay?.meals?.flatMap((m) => m.items) || [];
  const totalKcal = allItems.reduce((sum, item) => sum + item.kcal, 0);

  return (
    <div className="page">
      <h1>Dashboard</h1>
      <div>
        <h2>Trening danas</h2>
        {workout ? (
          <p>Vježbe: {workout.exercises?.length}</p>
        ) : (
          <p>Nema treninga</p>
        )}
      </div>
      <div>
        <h2>Prehrana danas</h2>
        <p>
          {totalKcal} / {settings?.kcalGoal || "?"} kcal
        </p>
      </div>

      <div>
        <h2>Tjedni napredak</h2>
        <p>Cilj: {settings?.trainingsPerWeek} treninga tjedno</p>
      </div>
    </div>
  );
}

export default Dashboard;
