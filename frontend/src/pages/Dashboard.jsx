import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { fetchJson } from "../api";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { useReportError } from "../hooks/useReportError";
import { useSettings } from "../context/useSettings";
import { AXIS_TICK, CHART_COLORS, TOOLTIP_STYLE } from "../utils/chartTheme";
import { DEFAULT_E1RM_FORMULA, findBestSetByE1rm } from "../utils/oneRepMax";
import { addWeightTrend, weeklyTrendChange } from "../utils/weightTrend";
import { dateKeyOf, formatDayMonth, todayKey } from "../utils/dates";
import MacroDonut from "../components/MacroDonut";
import MuscleGroupVolumeChart from "../components/MuscleGroupVolumeChart";
import styles from "./Dashboard.module.css";

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;
// Extra history fetched before the visible range so the trend has settled by its first day.
const TREND_WARMUP_DAYS = 30;
const DAYS_PER_WEEK = 7;
const MAX_PROGRESS_PERCENT = 100;
const PR_E1RM_DECIMAL_PLACES = 1;

// Trend over the whole fetch, then only the last `days` days for the chart.
function toBodyweightChart(entries, days) {
  const withTrend = addWeightTrend(entries);
  const cutoff = Date.now() - days * MILLISECONDS_PER_DAY;
  return {
    entries: withTrend.filter((entry) => new Date(entry.date).getTime() >= cutoff),
    latestTrend: withTrend.at(-1)?.trend ?? null,
    weeklyChange: weeklyTrendChange(withTrend),
  };
}

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
  const reportError = useReportError();
  const [workout, setWorkout] = useState(null);
  const [nutritionDay, setNutritionDay] = useState(null);
  const { settings, updateSettings } = useSettings();
  const [kcalGoalInput, setKcalGoalInput] = useState(null);
  const [bodyweightChart, setBodyweightChart] = useState({
    entries: [],
    latestTrend: null,
    weeklyChange: null,
  });
  const [recentWorkouts, setRecentWorkouts] = useState([]);
  const [bwRange, setBwRange] = useState(7);
  const [workoutRangeView, setWorkoutRangeView] = useState("week");
  const [weeklyWorkouts, setWeeklyWorkouts] = useState([]);
  const [rangeWorkoutCount, setRangeWorkoutCount] = useState(0);
  const [streak, setStreak] = useState({ currentStreak: 0, longestStreak: 0 });
  const [prs, setPrs] = useState([]);

  const today = todayKey();

  useEffect(() => {
    fetchJson(`/api/workouts?date=${today}`)
      .then((data) => setWorkout(data[0] || null))
      .catch(reportError);

    fetchJson(`/api/nutrition?date=${today}`)
      .then((data) => setNutritionDay(data[0] || null))
      .catch(reportError);

    fetchJson(`/api/bodyweight?days=${DAYS_PER_WEEK + TREND_WARMUP_DAYS}`)
      .then((data) => setBodyweightChart(toBodyweightChart(data, DAYS_PER_WEEK)))
      .catch(reportError);

    fetchJson("/api/workouts?limit=5").then(setRecentWorkouts).catch(reportError);

    fetchJson(`/api/workouts/week?date=${today}`).then(setWeeklyWorkouts).catch(reportError);

    fetchJson(`/api/stats/streak?date=${today}`).then(setStreak).catch(reportError);

    fetchJson("/api/stats/prs").then(setPrs).catch(reportError);
  }, [today, reportError]);

  const saveKcalGoal = () => {
    const parsed = parseInt(kcalGoalInput);
    if (!kcalGoalInput || isNaN(parsed) || parsed <= 0) {
      setKcalGoalInput(null);
      return;
    }
    updateSettings({ kcalGoal: parsed }).then((saved) => {
      if (saved) setKcalGoalInput(null);
    });
  };

  const handleWorkoutRangeChange = (range) => {
    setWorkoutRangeView(range);
    if (range === "week") {
      fetchJson(`/api/workouts/week?date=${today}`).then(setWeeklyWorkouts).catch(reportError);
    } else {
      fetchJson(`/api/workouts/count?range=${range}&date=${today}`)
        .then((data) => setRangeWorkoutCount(data.count))
        .catch(reportError);
    }
  };

  const handleBwRangeChange = (days) => {
    setBwRange(days);
    fetchJson(`/api/bodyweight?days=${days + TREND_WARMUP_DAYS}`)
      .then((data) => setBodyweightChart(toBodyweightChart(data, days)))
      .catch(reportError);
  };

  const allItems = nutritionDay?.meals?.flatMap((meal) => meal.items) || [];
  const totalKcal = allItems.reduce((sum, item) => sum + item.kcal, 0);
  const totalProtein = allItems.reduce((sum, item) => sum + item.protein, 0);
  const totalCarbs = allItems.reduce((sum, item) => sum + item.carbs, 0);
  const totalFat = allItems.reduce((sum, item) => sum + item.fat, 0);

  const latestPr = getLatestPr(prs, settings?.e1rmFormula ?? DEFAULT_E1RM_FORMULA);

  const weeklyGoal = settings?.trainingsPerWeek;
  const weeklyProgressPercent = weeklyGoal
    ? Math.min((weeklyWorkouts.length / weeklyGoal) * MAX_PROGRESS_PERCENT, MAX_PROGRESS_PERCENT)
    : 0;
  const weekDates = getWeekDates(today);
  const todayDate = new Date(today);
  const weekdayNames = t("dashboard.weekdaysMonFirst", { returnObjects: true });
  const weekDayInfo = weekDates.map((date, dayIndex) => {
    const matchingWorkout = weeklyWorkouts.find((entry) =>
      isSameCalendarDay(new Date(entry.date), date),
    );
    return {
      label: weekdayNames[dayIndex],
      dateString: dateKeyOf(date),
      trained: Boolean(matchingWorkout),
      workoutName: matchingWorkout?.name || null,
      isToday: isSameCalendarDay(date, todayDate),
    };
  });

  return (
    <div className={styles.page}>
      <h1 className={styles.heading}>{t("nav.dashboard")}</h1>
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
                  {workout.name || t("dashboard.workoutFallbackName")} — {workout.exercises?.length}{" "}
                  {t("dashboard.exercisesSuffix")}
                </p>
                {workout.exercises?.length > 0 && (
                  <div className={styles.chips}>
                    {workout.exercises.map((exercise) => (
                      <div key={exercise.id} className={styles.chip}>
                        {exercise.name}
                        <div className={styles.chipTooltip}>
                          {exercise.sets?.length > 0 ? (
                            exercise.sets.map((set, index) => (
                              <div key={index} className={styles.chipTooltipRow}>
                                {t("log.setSummary", {
                                  weight: set.weight,
                                  reps: set.reps,
                                  rpe: set.rpe ?? "—",
                                })}
                              </div>
                            ))
                          ) : (
                            <div className={styles.chipTooltipRow}>
                              {t("dashboard.noSetsLogged")}
                            </div>
                          )}
                        </div>
                      </div>
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
            <MacroDonut
              className={styles.macroRow}
              compact
              protein={totalProtein}
              carbs={totalCarbs}
              fat={totalFat}
            />
          </div>
        )}
        <div className={styles.card}>
          <h2 className={styles.label}>{t("dashboard.streak")}</h2>
          <p className={styles.value}>
            🔥 {t("dashboard.streakDays", { count: streak.currentStreak })}
          </p>
          <p className={styles.streakLongest}>
            {t("dashboard.longestStreakSuffix", { count: streak.longestStreak })}
          </p>
        </div>
        {(settings?.showPrWidget ?? true) && latestPr && (
          <div
            className={`${styles.card} ${styles.clickableCard}`}
            onClick={() => navigate(`/stats?exercise=${encodeURIComponent(latestPr.name)}`)}
          >
            <div className={styles.prHeader}>
              <h2 className={styles.label}>{t("dashboard.latestPr")}</h2>
              <span className={styles.prDate}>
                {new Date(latestPr.date).toISOString().split("T")[0]}
              </span>
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
                  {t("dashboard.trainingsThisWeek", {
                    count: weeklyWorkouts.length,
                    goal: weeklyGoal,
                  })}
                </p>
                <div className={styles.progressTrack}>
                  <div
                    className={styles.progressFill}
                    style={{ width: `${weeklyProgressPercent}%` }}
                  />
                </div>
              </div>
              <div className={styles.weekDayList}>
                {weekDayInfo.map(
                  ({ label, dateString, trained, workoutName, isToday }, dayIndex) => (
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
                  ),
                )}
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
          {bodyweightChart.latestTrend !== null && (
            <p className={styles.bwTrendSummary}>
              {t("dashboard.bodyweightTrend", { weight: bodyweightChart.latestTrend.toFixed(1) })}
              {bodyweightChart.weeklyChange !== null && (
                <span className={styles.bwTrendChange}>
                  {t("dashboard.bodyweightWeeklyChange", {
                    change: `${bodyweightChart.weeklyChange > 0 ? "+" : ""}${bodyweightChart.weeklyChange.toFixed(1)}`,
                  })}
                </span>
              )}
            </p>
          )}
          {bodyweightChart.entries.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={180}>
                <LineChart
                  data={bodyweightChart.entries.map((entry) => ({
                    ...entry,
                    label: formatDayMonth(entry.date),
                  }))}
                >
                  <XAxis dataKey="label" tick={AXIS_TICK} axisLine={false} tickLine={false} />
                  <YAxis
                    tick={AXIS_TICK}
                    axisLine={false}
                    tickLine={false}
                    domain={["auto", "auto"]}
                  />
                  <Tooltip
                    {...TOOLTIP_STYLE}
                    formatter={(value, name) => [
                      `${value} kg`,
                      name === "trend" ? t("dashboard.trendLegend") : t("dashboard.weighInLegend"),
                    ]}
                  />
                  <Line
                    type="monotone"
                    dataKey="weight"
                    stroke="none"
                    dot={{ fill: CHART_COLORS.textDim, stroke: "none", r: 3 }}
                    activeDot={{ r: 4, fill: CHART_COLORS.textDim }}
                    isAnimationActive={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="trend"
                    stroke={CHART_COLORS.accent}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
              <div className={styles.bwLegend}>
                <span className={styles.bwLegendItem}>
                  <span className={styles.bwLegendDot} />
                  {t("dashboard.weighInLegend")}
                </span>
                <span className={styles.bwLegendItem}>
                  <span className={styles.bwLegendLine} />
                  {t("dashboard.trendLegend")}
                </span>
              </div>
            </>
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
                <div
                  key={recentWorkout.id}
                  className={styles.recentWorkoutRow}
                  onClick={() =>
                    navigate(
                      `/log?date=${new Date(recentWorkout.date).toISOString().split("T")[0]}`,
                    )
                  }
                >
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
