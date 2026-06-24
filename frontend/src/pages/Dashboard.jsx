import { useState, useEffect } from "react";
import { fetchJson } from "../api";
import styles from "./Dashboard.module.css";

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
    <div className={styles.page}>
      <h1 className={styles.heading}>Dashboard</h1>
      <div className={styles.grid}>
        {(settings?.showWorkoutWidget ?? true) && (
          <div className={styles.card}>
            <h2 className={styles.label}>Trening danas</h2>
            {workout ? (
              <p className={styles.value}>
                Vježbe: {workout.exercises?.length}
              </p>
            ) : (
              <p className={styles.value}>Nema treninga</p>
            )}
          </div>
        )}
        {(settings?.showNutritionWidget ?? true) && (
          <div className={styles.card}>
            <h2 className={styles.label}>Prehrana danas</h2>
            <p className={styles.value}>
              {totalKcal} / {settings?.kcalGoal || "?"} kcal
            </p>
          </div>
        )}
        <div className={`${styles.card} ${styles.fullWidth}`}>
          <h2 className={styles.label}>Tjedni napredak</h2>
          <p className={styles.value}>
            Cilj: {settings?.trainingsPerWeek} treninga tjedno
          </p>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
