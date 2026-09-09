import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { fetchJson } from "../api";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { useToast } from "../context/useToast";
import MuscleGroupVolumeChart from "../components/MuscleGroupVolumeChart";
import styles from "./Dashboard.module.css";

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;
const DAYS_PER_WEEK = 7;
const MAX_PROGRESS_PERCENT = 100;
const FULL_WEEKDAY_NAMES = [
  "Ponedjeljak", "Utorak", "Srijeda", "Četvrtak", "Petak", "Subota", "Nedjelja",
];

function formatDateString(date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isSameCalendarDay(firstDate, secondDate) {
  return (
    firstDate.getUTCFullYear() === secondDate.getUTCFullYear() &&
    firstDate.getUTCMonth() === secondDate.getUTCMonth() &&
    firstDate.getUTCDate() === secondDate.getUTCDate()
  );
}

function getWeekDates(anchorDateString) {
  const anchorDate = new Date(anchorDateString);
  const dayOfWeek = anchorDate.getUTCDay();
  const daysSinceMonday = dayOfWeek === 0 ? DAYS_PER_WEEK - 1 : dayOfWeek - 1;
  const monday = new Date(
    Date.UTC(
      anchorDate.getUTCFullYear(),
      anchorDate.getUTCMonth(),
      anchorDate.getUTCDate() - daysSinceMonday,
    ),
  );
  return Array.from(
    { length: DAYS_PER_WEEK },
    (_, dayIndex) => new Date(monday.getTime() + dayIndex * MILLISECONDS_PER_DAY),
  );
}

function Dashboard() {
  const navigate = useNavigate();
  const { showError } = useToast();
  const [workout, setWorkout] = useState(null);
  const [nutritionDay, setNutritionDay] = useState(null);
  const [settings, setSettings] = useState(null);
  const [kcalGoalInput, setKcalGoalInput] = useState(null);
  const [bodyweightData, setBodyweightData] = useState([]);
  const [recentWorkouts, setRecentWorkouts] = useState([]);
  const [bwRange, setBwRange] = useState(7);
  const [workoutRangeView, setWorkoutRangeView] = useState("week");
  const [weeklyWorkouts, setWeeklyWorkouts] = useState([]);
  const [rangeWorkoutCount, setRangeWorkoutCount] = useState(0);

  const today = new Date().toISOString().split("T")[0];

  useEffect(() => {
    fetchJson(`/api/workouts?date=${today}`)
      .then((data) => setWorkout(data[0] || null))
      .catch((err) => {
        console.error(err);
        showError(err.message);
      });

    fetchJson(`/api/nutrition?date=${today}`)
      .then((data) => setNutritionDay(data[0] || null))
      .catch((err) => {
        console.error(err);
        showError(err.message);
      });

    fetchJson("/api/settings")
      .then((data) => setSettings(data))
      .catch((err) => {
        console.error(err);
        showError(err.message);
      });

    fetchJson("/api/bodyweight?days=7")
      .then((data) => setBodyweightData(data))
      .catch((err) => {
        console.error(err);
        showError(err.message);
      });

    fetchJson("/api/workouts?limit=5")
      .then((data) => setRecentWorkouts(data))
      .catch((err) => {
        console.error(err);
        showError(err.message);
      });

    fetchJson(`/api/workouts/week?date=${today}`)
      .then((data) => setWeeklyWorkouts(data))
      .catch((err) => {
        console.error(err);
        showError(err.message);
      });
  }, [today, showError]);

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
      .catch((err) => {
        console.error(err);
        showError(err.message);
      });
  };

  const handleWorkoutRangeChange = (range) => {
    setWorkoutRangeView(range);
    if (range === "week") {
      fetchJson(`/api/workouts/week?date=${today}`)
        .then((data) => setWeeklyWorkouts(data))
        .catch((err) => {
        console.error(err);
        showError(err.message);
      });
    } else {
      fetchJson(`/api/workouts/count?range=${range}&date=${today}`)
        .then((data) => setRangeWorkoutCount(data.count))
        .catch((err) => {
        console.error(err);
        showError(err.message);
      });
    }
  };

  const handleBwRangeChange = (days) => {
    setBwRange(days);
    fetchJson(`/api/bodyweight?days=${days}`)
      .then((data) => setBodyweightData(data))
      .catch((err) => {
        console.error(err);
        showError(err.message);
      });
  };

  const formatBwDate = (dateString) => {
    const date = new Date(dateString);
    return `${date.getUTCDate()}/${date.getUTCMonth() + 1}`;
  };

  const allItems = nutritionDay?.meals?.flatMap((meal) => meal.items) || [];
  const totalKcal = allItems.reduce((sum, item) => sum + item.kcal, 0);

  const weeklyGoal = settings?.trainingsPerWeek;
  const weeklyProgressPercent = weeklyGoal
    ? Math.min((weeklyWorkouts.length / weeklyGoal) * MAX_PROGRESS_PERCENT, MAX_PROGRESS_PERCENT)
    : 0;
  const weekDates = getWeekDates(today);
  const todayDate = new Date(today);
  const weekDayInfo = weekDates.map((date, dayIndex) => {
    const matchingWorkout = weeklyWorkouts.find((entry) => isSameCalendarDay(new Date(entry.date), date));
    return {
      label: FULL_WEEKDAY_NAMES[dayIndex],
      dateString: formatDateString(date),
      trained: Boolean(matchingWorkout),
      workoutName: matchingWorkout?.name || null,
      isToday: isSameCalendarDay(date, todayDate),
    };
  });

  return (
    <div className={styles.page}>
      <h1 className={styles.heading}>Dashboard</h1>
      <div className={styles.grid}>
        {(settings?.showWorkoutWidget ?? true) && (
          <div
            className={`${styles.card} ${styles.clickableCard}`}
            onClick={() => navigate(`/log?date=${today}`)}
          >
            <h2 className={styles.label}>Trening danas</h2>
            {workout ? (
              <p className={styles.value}>
                {workout.name || "Trening"} — {workout.exercises?.length} vježbi
              </p>
            ) : (
              <p className={styles.value}>Nema treninga — klikni za početak</p>
            )}
          </div>
        )}
        {(settings?.showNutritionWidget ?? true) && (
          <div
            className={`${styles.card} ${styles.clickableCard}`}
            onClick={() => navigate(`/nutrition?date=${today}`)}
          >
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
                    onClick={(event) => event.stopPropagation()}
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
                    onClick={(event) => {
                      event.stopPropagation();
                      setKcalGoalInput("");
                    }}
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
          <div className={styles.bwChartHeader}>
            <h2 className={styles.label}>Tjedni napredak</h2>
            <div className={styles.rangeTabs}>
              {[
                { label: "Tjedan", range: "week" },
                { label: "Mjesec", range: "month" },
                { label: "Godina", range: "year" },
              ].map(({ label, range }) => (
                <button
                  key={range}
                  className={workoutRangeView === range ? styles.rangeTabActive : styles.rangeTab}
                  onClick={() => handleWorkoutRangeChange(range)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          {workoutRangeView === "week" ? (
            <>
              <div className={styles.weeklyProgressHeader}>
                <p className={styles.value}>
                  {weeklyWorkouts.length} / {weeklyGoal} treninga ovaj tjedan
                </p>
                <div className={styles.progressTrack}>
                  <div
                    className={styles.progressFill}
                    style={{ width: `${weeklyProgressPercent}%` }}
                  />
                </div>
              </div>
              <div className={styles.weekDayList}>
                {weekDayInfo.map(({ label, dateString, trained, workoutName, isToday }, dayIndex) => (
                  <div
                    key={dayIndex}
                    className={styles.weekDayRow}
                    onClick={() => navigate(`/log?date=${dateString}`)}
                  >
                    <span className={isToday ? styles.weekDayNameToday : styles.weekDayName}>
                      {label}
                      {isToday && " (danas)"}
                    </span>
                    <span className={styles.weekDayStatus}>
                      {trained && workoutName && (
                        <span className={styles.weekDayWorkoutName}>{workoutName}</span>
                      )}
                      <span className={trained ? styles.weekDayDotTrained : styles.weekDayDot}>
                        {trained ? "●" : "○"}
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className={styles.value}>
              {rangeWorkoutCount} treninga {workoutRangeView === "month" ? "ovaj mjesec" : "ove godine"}
            </p>
          )}
        </div>

        <div className={styles.card}>
          <div className={styles.bwChartHeader}>
            <h2 className={styles.label}>Tjelesna težina</h2>
            <div className={styles.rangeTabs}>
              {[
                { label: "Tjedan", days: 7 },
                { label: "Mjesec", days: 30 },
                { label: "Godina", days: 365 },
              ].map(({ label, days }) => (
                <button
                  key={days}
                  className={bwRange === days ? styles.rangeTabActive : styles.rangeTab}
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

        <div className={styles.card}>
          <h2 className={styles.label}>Volumen po mišićnoj skupini</h2>
          <MuscleGroupVolumeChart />
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
