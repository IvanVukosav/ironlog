import { useState, useEffect } from "react";
import { fetchJson } from "../api";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import styles from "./Dashboard.module.css";

function Dashboard() {
  const [workout, setWorkout] = useState(null);
  const [nutritionDay, setNutritionDay] = useState(null);
  const [settings, setSettings] = useState(null);
  const [kcalGoalInput, setKcalGoalInput] = useState(null);
  const [bodyweightData, setBodyweightData] = useState([]);
  const [recentWorkouts, setRecentWorkouts] = useState([]);
  const [bwRange, setBwRange] = useState(7);

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

    fetchJson("/api/bodyweight?days=7")
      .then((data) => setBodyweightData(data))
      .catch((err) => console.error(err));

    fetchJson("/api/workouts?limit=5")
      .then((data) => setRecentWorkouts(data))
      .catch((err) => console.error(err));
  }, []);

  const saveKcalGoal = () => {
    const parsed = parseInt(kcalGoalInput);
    if (!kcalGoalInput || isNaN(parsed) || parsed <= 0) {
      setKcalGoalInput(null);
      return;
    }
    fetchJson("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...settings, kcalGoal: parsed }),
    })
      .then(() => {
        setSettings((prev) => ({ ...prev, kcalGoal: parsed }));
        setKcalGoalInput(null);
      })
      .catch((err) => console.error(err));
  };

  const handleBwRangeChange = (days) => {
    setBwRange(days);
    fetchJson(`/api/bodyweight?days=${days}`)
      .then((data) => setBodyweightData(data))
      .catch((err) => console.error(err));
  };

  const formatBwDate = (dateString) => {
    const date = new Date(dateString);
    return `${date.getUTCDate()}/${date.getUTCMonth() + 1}`;
  };

  const allItems = nutritionDay?.meals?.flatMap((meal) => meal.items) || [];
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
              {totalKcal} /{" "}
              {settings?.kcalGoal ? (
                `${settings.kcalGoal} kcal`
              ) : kcalGoalInput !== null ? (
                <>
                  <input
                    className={styles.kcalInlineInput}
                    type="number"
                    autoFocus
                    value={kcalGoalInput}
                    onChange={(event) => setKcalGoalInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") saveKcalGoal();
                      if (event.key === "Escape") setKcalGoalInput(null);
                    }}
                    onBlur={saveKcalGoal}
                  />{" "}
                  kcal
                </>
              ) : (
                <>
                  <button
                    className={styles.kcalSetButton}
                    onClick={() => setKcalGoalInput("")}
                  >
                    Postavi
                  </button>{" "}
                  kcal
                </>
              )}
            </p>
          </div>
        )}
        <div className={`${styles.card} ${styles.fullWidth}`}>
          <h2 className={styles.label}>Tjedni napredak</h2>
          <p className={styles.value}>
            Cilj: {settings?.trainingsPerWeek} treninga tjedno
          </p>
        </div>

        <div className={`${styles.card} ${styles.fullWidth}`}>
          <div className={styles.bwChartHeader}>
            <h2 className={styles.label}>Tjelesna težina</h2>
            <div className={styles.bwRangeTabs}>
              {[
                { label: "Tjedan", days: 7 },
                { label: "Mjesec", days: 30 },
                { label: "Godina", days: 365 },
              ].map(({ label, days }) => (
                <button
                  key={days}
                  className={bwRange === days ? styles.bwRangeTabActive : styles.bwRangeTab}
                  onClick={() => handleBwRangeChange(days)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          {bodyweightData.length > 0 ? (
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={bodyweightData.map((entry) => ({ ...entry, label: formatBwDate(entry.date) }))}>
                <XAxis dataKey="label" tick={{ fill: "#666", fontFamily: "ui-monospace", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#666", fontFamily: "ui-monospace", fontSize: 11 }} axisLine={false} tickLine={false} domain={["auto", "auto"]} />
                <Tooltip
                  contentStyle={{ background: "#141414", border: "1px solid #444", fontFamily: "ui-monospace", fontSize: 12 }}
                  labelStyle={{ color: "#666" }}
                  itemStyle={{ color: "#f0f0f0" }}
                />
                <Line type="monotone" dataKey="weight" stroke="#ff3b3b" strokeWidth={2} dot={{ fill: "#ff3b3b", r: 3 }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className={styles.value}>Nema podataka</p>
          )}
        </div>

        <div className={`${styles.card} ${styles.fullWidth}`}>
          <h2 className={styles.label}>Zadnji treninzi</h2>
          {recentWorkouts.length > 0 ? (
            <div className={styles.recentWorkoutList}>
              {recentWorkouts.map((recentWorkout) => (
                <div key={recentWorkout.id} className={styles.recentWorkoutRow}>
                  <span className={styles.recentWorkoutDate}>
                    {new Date(recentWorkout.date).toISOString().split("T")[0]}
                  </span>
                  <span className={styles.recentWorkoutExercises}>
                    {recentWorkout.exercises?.length ?? 0} vježbi
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className={styles.value}>Nema treninga</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
