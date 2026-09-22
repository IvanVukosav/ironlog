import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { fetchJson } from "../api";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { useToast } from "../context/useToast";
import { getCssVar } from "../utils/theme";
import { findBestSetByE1rm } from "../utils/oneRepMax";
import MuscleGroupVolumeChart from "../components/MuscleGroupVolumeChart";
import styles from "./Dashboard.module.css";

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;
const DAYS_PER_WEEK = 7;
const MAX_PROGRESS_PERCENT = 100;
const PR_E1RM_DECIMAL_PLACES = 1;
const KCAL_PER_GRAM_PROTEIN = 4;
const KCAL_PER_GRAM_CARBS = 4;
const KCAL_PER_GRAM_FAT = 9;
const MACRO_CHART_SIZE = 110;
const MACRO_CHART_INNER_RADIUS = 30;
const MACRO_CHART_OUTER_RADIUS = 50;
const PERCENT_MULTIPLIER = 100;

function getLatestPr(prs, formula) {
  let latest = null;
  prs.forEach((pr) => {
    const best = findBestSetByE1rm(pr.sets, formula);
    if (best && (!latest || best.date > latest.date)) {
      latest = { name: pr.name, ...best };
    }
  });
  return latest;
}

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
  const { t } = useTranslation();
  const { showError } = useToast();
  const chartAccentColor = getCssVar("--color-accent");
  const chartTextDimColor = getCssVar("--color-text-dim");
  const chartBgCardColor = getCssVar("--color-bg-card");
  const chartBorderColor = getCssVar("--color-border");
  const chartTextColor = getCssVar("--color-text");
  const chartProteinColor = getCssVar("--color-protein");
  const chartCarbsColor = getCssVar("--color-carbs");
  const chartFatColor = getCssVar("--color-fat");
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
  const [streak, setStreak] = useState({ currentStreak: 0, longestStreak: 0 });
  const [prs, setPrs] = useState([]);

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

    fetchJson("/api/stats/streak")
      .then((data) => setStreak(data))
      .catch((err) => {
        console.error(err);
        showError(err.message);
      });

    fetchJson("/api/stats/prs")
      .then((data) => setPrs(data))
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
  const totalProtein = allItems.reduce((sum, item) => sum + item.protein, 0);
  const totalCarbs = allItems.reduce((sum, item) => sum + item.carbs, 0);
  const totalFat = allItems.reduce((sum, item) => sum + item.fat, 0);
  const macroKcal = {
    protein: totalProtein * KCAL_PER_GRAM_PROTEIN,
    carbs: totalCarbs * KCAL_PER_GRAM_CARBS,
    fat: totalFat * KCAL_PER_GRAM_FAT,
  };
  const macroKcalTotal = macroKcal.protein + macroKcal.carbs + macroKcal.fat;
  const macroChartData = [
    { name: "Protein", value: macroKcal.protein, color: chartProteinColor },
    { name: "Carbs", value: macroKcal.carbs, color: chartCarbsColor },
    { name: "Fat", value: macroKcal.fat, color: chartFatColor },
  ].filter((entry) => entry.value > 0);
  const macroPercent = (kcal) =>
    macroKcalTotal > 0 ? Math.round((kcal / macroKcalTotal) * PERCENT_MULTIPLIER) : 0;

  const latestPr = getLatestPr(prs, settings?.e1rmFormula ?? "brzycki");

  const weeklyGoal = settings?.trainingsPerWeek;
  const weeklyProgressPercent = weeklyGoal
    ? Math.min((weeklyWorkouts.length / weeklyGoal) * MAX_PROGRESS_PERCENT, MAX_PROGRESS_PERCENT)
    : 0;
  const weekDates = getWeekDates(today);
  const todayDate = new Date(today);
  const weekdayNames = t("dashboard.weekdaysMonFirst", { returnObjects: true });
  const weekDayInfo = weekDates.map((date, dayIndex) => {
    const matchingWorkout = weeklyWorkouts.find((entry) => isSameCalendarDay(new Date(entry.date), date));
    return {
      label: weekdayNames[dayIndex],
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
            <h2 className={styles.label}>{t("dashboard.workoutToday")}</h2>
            {workout ? (
              <>
                <p className={styles.value}>
                  {workout.name || t("dashboard.workoutFallbackName")} — {workout.exercises?.length} {t("dashboard.exercisesSuffix")}
                </p>
                {workout.exercises?.length > 0 && (
                  <div className={styles.chips}>
                    {workout.exercises.map((exercise) => (
                      <span key={exercise.id} className={styles.chip}>{exercise.name}</span>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <p className={styles.value}>{t("dashboard.noWorkoutToday")}</p>
            )}
          </div>
        )}
        {(settings?.showNutritionWidget ?? true) && (
          <div
            className={`${styles.card} ${styles.clickableCard}`}
            onClick={() => navigate(`/nutrition?date=${today}`)}
          >
            <h2 className={styles.label}>{t("dashboard.nutritionToday")}</h2>
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
                    {t("dashboard.setGoal")}
                  </button>{" "}
                  kcal
                </>
              )}
            </p>
            {macroChartData.length > 0 && (
              <div className={styles.macroRow}>
                <PieChart width={MACRO_CHART_SIZE} height={MACRO_CHART_SIZE}>
                  <Pie
                    data={macroChartData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={MACRO_CHART_INNER_RADIUS}
                    outerRadius={MACRO_CHART_OUTER_RADIUS}
                    paddingAngle={2}
                  >
                    {macroChartData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: chartBgCardColor, border: `1px solid ${chartBorderColor}`, fontFamily: "ui-monospace", fontSize: 12 }}
                    labelStyle={{ color: chartTextDimColor }}
                    itemStyle={{ color: chartTextColor }}
                    formatter={(value, name) => [`${Math.round(value)} kcal`, name]}
                  />
                </PieChart>
                <div className={styles.macroLegend}>
                  <div className={styles.macroLegendRow}>
                    <span className={styles.macroLegendDot} style={{ backgroundColor: chartProteinColor }} />
                    Protein {macroPercent(macroKcal.protein)}%
                  </div>
                  <div className={styles.macroLegendRow}>
                    <span className={styles.macroLegendDot} style={{ backgroundColor: chartCarbsColor }} />
                    Carbs {macroPercent(macroKcal.carbs)}%
                  </div>
                  <div className={styles.macroLegendRow}>
                    <span className={styles.macroLegendDot} style={{ backgroundColor: chartFatColor }} />
                    Fat {macroPercent(macroKcal.fat)}%
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
        <div className={styles.card}>
          <h2 className={styles.label}>{t("dashboard.streak")}</h2>
          <p className={styles.value}>🔥 {t("dashboard.streakDays", { count: streak.currentStreak })}</p>
          <p className={styles.streakLongest}>
            {t("dashboard.longestStreakSuffix", { count: streak.longestStreak })}
          </p>
        </div>
        {(settings?.showPrWidget ?? true) && latestPr && (
          <div className={styles.card}>
            <div className={styles.prHeader}>
              <h2 className={styles.label}>{t("dashboard.latestPr")}</h2>
              <span className={styles.prDate}>{new Date(latestPr.date).toISOString().split("T")[0]}</span>
            </div>
            <p className={styles.prName}>{latestPr.name}</p>
            <p className={styles.streakLongest}>
              {t("dashboard.latestPrDetail", {
                e1rm: latestPr.e1rm.toFixed(PR_E1RM_DECIMAL_PLACES),
                weight: latestPr.weight,
                reps: latestPr.reps,
                rpe: latestPr.rpe ?? "—",
              })}
            </p>
          </div>
        )}
        <div className={`${styles.card} ${styles.fullWidth}`}>
          <div className={styles.bwChartHeader}>
            <h2 className={styles.label}>{t("dashboard.weeklyProgress")}</h2>
            <div className={styles.rangeTabs}>
              {[
                { label: t("common.week"), range: "week" },
                { label: t("common.month"), range: "month" },
                { label: t("common.year"), range: "year" },
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
                  {t("dashboard.trainingsThisWeek", { count: weeklyWorkouts.length, goal: weeklyGoal })}
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
                      {isToday && t("dashboard.todaySuffix")}
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
              {workoutRangeView === "month"
                ? t("dashboard.trainingsThisMonth", { count: rangeWorkoutCount })
                : t("dashboard.trainingsThisYear", { count: rangeWorkoutCount })}
            </p>
          )}
        </div>

        <div className={styles.card}>
          <div className={styles.bwChartHeader}>
            <h2 className={styles.label}>{t("dashboard.bodyweight")}</h2>
            <div className={styles.rangeTabs}>
              {[
                { label: t("common.week"), days: 7 },
                { label: t("common.month"), days: 30 },
                { label: t("common.year"), days: 365 },
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
                <XAxis dataKey="label" tick={{ fill: chartTextDimColor, fontFamily: "ui-monospace", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: chartTextDimColor, fontFamily: "ui-monospace", fontSize: 11 }} axisLine={false} tickLine={false} domain={["auto", "auto"]} />
                <Tooltip
                  contentStyle={{ background: chartBgCardColor, border: `1px solid ${chartBorderColor}`, fontFamily: "ui-monospace", fontSize: 12 }}
                  labelStyle={{ color: chartTextDimColor }}
                  itemStyle={{ color: chartTextColor }}
                />
                <Line type="monotone" dataKey="weight" stroke={chartAccentColor} strokeWidth={2} dot={{ fill: chartAccentColor, r: 3 }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className={styles.value}>{t("dashboard.noData")}</p>
          )}
        </div>

        <div className={styles.card}>
          <h2 className={styles.label}>{t("dashboard.muscleGroupVolume")}</h2>
          <MuscleGroupVolumeChart />
        </div>

        <div className={`${styles.card} ${styles.fullWidth}`}>
          <h2 className={styles.label}>{t("dashboard.recentWorkouts")}</h2>
          {recentWorkouts.length > 0 ? (
            <div className={styles.recentWorkoutList}>
              {recentWorkouts.map((recentWorkout) => (
                <div key={recentWorkout.id} className={styles.recentWorkoutRow}>
                  <span className={styles.recentWorkoutDate}>
                    {new Date(recentWorkout.date).toISOString().split("T")[0]}
                  </span>
                  <span className={styles.recentWorkoutExercises}>
                    {recentWorkout.exercises?.length ?? 0} {t("dashboard.exercisesSuffix")}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className={styles.value}>{t("dashboard.noWorkouts")}</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
