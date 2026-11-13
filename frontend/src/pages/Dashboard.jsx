import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { fetchJson } from "../api";
import { useReportError } from "../hooks/useReportError";
import { useDayLabel } from "../hooks/useDayLabel";
import { useSettings } from "../context/useSettings";
import { AXIS_TICK, CHART_COLORS, TOOLTIP_STYLE } from "../utils/chartTheme";
import { DEFAULT_E1RM_FORMULA, findBestSetByE1rm } from "../utils/oneRepMax";
import { addWeightTrend, weeklyTrendChange } from "../utils/weightTrend";
import { dateKeyOf, formatDayMonth, formatWeekdayDate, todayKey } from "../utils/dates";
import { formatNumber, formatSet, formatVolume } from "../utils/numbers";
import Icon from "../components/Icon";
import MacroDonut from "../components/MacroDonut";
import MuscleGroupVolumeChart from "../components/MuscleGroupVolumeChart";
import SegmentedControl from "../components/SegmentedControl";
import styles from "./Dashboard.module.css";

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;
// Extra history fetched before the visible range so the trend has settled by its first day.
const TREND_WARMUP_DAYS = 30;
const DAYS_PER_WEEK = 7;
const MAX_PERCENT = 100;
const E1RM_DECIMAL_PLACES = 1;
// Today's card lists this many exercises, then "+ N more".
const VISIBLE_EXERCISES = 5;
const BODYWEIGHT_RANGES = [
  { days: 7, labelKey: "common.week" },
  { days: 30, labelKey: "common.month" },
  { days: 365, labelKey: "common.year" },
];

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

// The exercise whose all-time best set is the most recent one.
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

// Monday to Sunday of the week holding the day `dateKey`, as UTC midnights.
function getWeekDates(dateKey) {
  const anchor = new Date(dateKey);
  const daysSinceMonday = (anchor.getUTCDay() + DAYS_PER_WEEK - 1) % DAYS_PER_WEEK;
  const monday = anchor.getTime() - daysSinceMonday * MILLISECONDS_PER_DAY;
  return Array.from(
    { length: DAYS_PER_WEEK },
    (_, dayIndex) => new Date(monday + dayIndex * MILLISECONDS_PER_DAY),
  );
}

// The set an exercise is summed up by: its best by e1RM, else its heaviest working set.
function topSet(sets, formula) {
  const working = sets.filter((set) => !set.isWarmup);
  if (working.length === 0) return null;
  return (
    findBestSetByE1rm(working, formula) ??
    working.reduce((heaviest, set) => (set.weight > heaviest.weight ? set : heaviest))
  );
}

// A card's title; with `to`, the title is also the way to the page it sums up.
function CardTitle({ to, children }) {
  return (
    <h2 className={styles.cardTitle}>
      {to ? (
        <Link to={to} className={styles.titleLink}>
          {children}
          <Icon name="chevronRight" size={16} />
        </Link>
      ) : (
        children
      )}
    </h2>
  );
}

function ProgressBar({ percent }) {
  return (
    <div className={styles.progressTrack}>
      <div
        className={styles.progressFill}
        style={{ width: `${Math.min(percent, MAX_PERCENT)}%` }}
      />
    </div>
  );
}

function Dashboard() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const language = i18n.language;
  const dayLabel = useDayLabel();
  const reportError = useReportError();
  const { settings, updateSettings } = useSettings();
  // undefined until today's answer is in, so "Start workout" can't make a second one meanwhile.
  const [workout, setWorkout] = useState(undefined);
  const [isStarting, setIsStarting] = useState(false);
  const [nutritionDay, setNutritionDay] = useState(null);
  const [kcalGoalInput, setKcalGoalInput] = useState(null);
  const [bodyweightChart, setBodyweightChart] = useState({
    entries: [],
    latestTrend: null,
    weeklyChange: null,
  });
  const [bwRange, setBwRange] = useState(BODYWEIGHT_RANGES[0].days);
  const [recentWorkouts, setRecentWorkouts] = useState([]);
  const [weeklyWorkouts, setWeeklyWorkouts] = useState([]);
  const [streak, setStreak] = useState({ currentStreak: 0, longestStreak: 0 });
  const [prs, setPrs] = useState([]);

  const today = todayKey();
  const formula = settings?.e1rmFormula ?? DEFAULT_E1RM_FORMULA;
  const logLink = (dateKey) => `/log?date=${dateKey}`;

  useEffect(() => {
    fetchJson(`/api/workouts?date=${today}`)
      .then((data) => setWorkout(data[0] ?? null))
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

  // One tap from here to logging: the workout is made, then its page opens.
  const startWorkout = () => {
    setIsStarting(true);
    fetchJson("/api/workouts", { method: "POST", json: { date: today } })
      .then(() => navigate(logLink(today)))
      .catch((err) => {
        setIsStarting(false);
        reportError(err);
      });
  };

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

  const changeBwRange = (days) => {
    setBwRange(days);
    fetchJson(`/api/bodyweight?days=${days + TREND_WARMUP_DAYS}`)
      .then((data) => setBodyweightChart(toBodyweightChart(data, days)))
      .catch(reportError);
  };

  // Today's workout.
  const workoutExercises = workout?.exercises ?? [];
  const workingSets = workoutExercises
    .flatMap((exercise) => exercise.sets ?? [])
    .filter((set) => !set.isWarmup);
  const workoutVolume = workingSets.reduce((sum, set) => sum + set.weight * set.reps, 0);
  const workoutMeta = [
    t("dashboard.exerciseCount", { count: workoutExercises.length }),
    t("dashboard.setCount", { count: workingSets.length }),
    workoutVolume > 0 && formatVolume(workoutVolume, language),
  ]
    .filter(Boolean)
    .join(" · ");

  // This week.
  const narrowWeekday = new Intl.DateTimeFormat(language, { weekday: "narrow", timeZone: "UTC" });
  const weekDays = getWeekDates(today).map((date) => {
    const key = dateKeyOf(date);
    const entry = weeklyWorkouts.find(
      (weekWorkout) => dateKeyOf(new Date(weekWorkout.date)) === key,
    );
    return {
      date,
      key,
      trained: Boolean(entry),
      name: entry?.name ?? null,
      isToday: key === today,
    };
  });
  const weeklyGoal = settings?.trainingsPerWeek;
  const weekCount = weeklyWorkouts.length;

  // Today's food.
  const allItems = nutritionDay?.meals?.flatMap((meal) => meal.items ?? []) ?? [];
  const totals = allItems.reduce(
    (sum, item) => ({
      kcal: sum.kcal + item.kcal,
      protein: sum.protein + item.protein,
      carbs: sum.carbs + item.carbs,
      fat: sum.fat + item.fat,
    }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0 },
  );
  const kcalGoal = settings?.kcalGoal;

  const latestPr = getLatestPr(prs, formula);
  const { latestTrend, weeklyChange } = bodyweightChart;

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <p className={styles.date}>{formatWeekdayDate(today, language)}</p>
        <h1 className={styles.heading}>{t("nav.dashboard")}</h1>
      </header>

      <div className={styles.grid}>
        {(settings?.showWorkoutWidget ?? true) && (
          <section className={`${styles.card} ${styles.wide}`}>
            <CardTitle to={logLink(today)}>{t("dashboard.workoutToday")}</CardTitle>
            {workout && (
              <>
                <div className={styles.todayHeading}>
                  <p className={styles.todayName}>
                    {workout.name || t("dashboard.workoutFallbackName")}
                  </p>
                  <p className={styles.dim}>{workoutMeta}</p>
                </div>
                {workoutExercises.length > 0 && (
                  <ul className={styles.exerciseList}>
                    {workoutExercises.slice(0, VISIBLE_EXERCISES).map((exercise) => {
                      const sets = exercise.sets ?? [];
                      const working = sets.filter((set) => !set.isWarmup);
                      const top = topSet(sets, formula);
                      return (
                        <li key={exercise.id} className={styles.exerciseRow}>
                          <span className={styles.exerciseName}>{exercise.name}</span>
                          <span className={styles.exerciseDetail}>
                            {top
                              ? `${t("dashboard.setCount", { count: working.length })} · ${formatSet(top, language)}`
                              : t("dashboard.noSetsLogged")}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
                {workoutExercises.length > VISIBLE_EXERCISES && (
                  <p className={styles.dim}>
                    {t("dashboard.moreExercises", {
                      count: workoutExercises.length - VISIBLE_EXERCISES,
                    })}
                  </p>
                )}
                <Link to={logLink(today)} className={styles.primaryLink}>
                  {t("dashboard.continueWorkout")}
                </Link>
              </>
            )}
            {workout === null && (
              <>
                <p className={styles.dim}>{t("dashboard.noWorkoutToday")}</p>
                <button
                  type="button"
                  className={styles.primaryButton}
                  disabled={isStarting}
                  onClick={startWorkout}
                >
                  {t("dashboard.startWorkout")}
                </button>
              </>
            )}
          </section>
        )}

        <section className={styles.card}>
          <CardTitle>{t("dashboard.thisWeek")}</CardTitle>
          <p className={styles.bigNumber}>
            {formatNumber(weekCount, language)}
            <span className={styles.bigUnit}>
              {weeklyGoal
                ? ` ${t("dashboard.ofGoal", { goal: weeklyGoal })}`
                : ` ${t("dashboard.workoutWord", { count: weekCount })}`}
            </span>
          </p>
          {weeklyGoal > 0 && <ProgressBar percent={(weekCount / weeklyGoal) * MAX_PERCENT} />}
          <ol className={styles.weekStrip}>
            {weekDays.map((day) => (
              <li key={day.key}>
                <Link
                  to={logLink(day.key)}
                  className={styles.dayLink}
                  aria-label={`${formatWeekdayDate(day.date, language)}: ${
                    day.trained
                      ? day.name || t("dashboard.workoutFallbackName")
                      : t("dashboard.restDay")
                  }`}
                  aria-current={day.isToday ? "date" : undefined}
                >
                  <span className={styles.dayLetter} aria-hidden="true">
                    {narrowWeekday.format(day.date)}
                  </span>
                  <span
                    className={[
                      styles.dayDot,
                      day.trained && styles.dayDotTrained,
                      day.isToday && styles.dayDotToday,
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    aria-hidden="true"
                  >
                    {day.trained ? <Icon name="check" size={16} /> : day.date.getUTCDate()}
                  </span>
                </Link>
              </li>
            ))}
          </ol>
          <p className={styles.streak}>
            <span className={styles.streakIcon}>
              <Icon name="flame" size={18} />
            </span>
            {t("dashboard.streakDays", { count: streak.currentStreak })}
            <span className={styles.dim}>
              {" · "}
              {t("dashboard.longestStreak", { count: streak.longestStreak })}
            </span>
          </p>
        </section>

        {(settings?.showNutritionWidget ?? true) && (
          <section className={styles.card}>
            <CardTitle to={`/nutrition?date=${today}`}>{t("dashboard.nutritionToday")}</CardTitle>
            <p className={styles.bigNumber}>
              {formatNumber(totals.kcal, language, { maxDecimals: 0 })}
              <span className={styles.bigUnit}>
                {kcalGoal ? ` / ${formatNumber(kcalGoal, language)} kcal` : " kcal"}
              </span>
            </p>
            {kcalGoal > 0 && <ProgressBar percent={(totals.kcal / kcalGoal) * MAX_PERCENT} />}
            {!kcalGoal &&
              (kcalGoalInput === null ? (
                <button
                  type="button"
                  className={styles.textButton}
                  onClick={() => setKcalGoalInput("")}
                >
                  {t("dashboard.setGoal")}
                </button>
              ) : (
                <input
                  className={styles.goalInput}
                  type="number"
                  inputMode="numeric"
                  aria-label={t("dashboard.kcalGoalLabel")}
                  placeholder={t("dashboard.kcalGoalLabel")}
                  autoFocus
                  value={kcalGoalInput}
                  onChange={(event) => setKcalGoalInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") saveKcalGoal();
                    if (event.key === "Escape") setKcalGoalInput(null);
                  }}
                  onBlur={saveKcalGoal}
                />
              ))}
            <MacroDonut
              className={styles.macroRow}
              compact
              protein={totals.protein}
              carbs={totals.carbs}
              fat={totals.fat}
            />
          </section>
        )}

        {(settings?.showPrWidget ?? true) && latestPr && (
          <section className={styles.card}>
            <CardTitle to={`/stats?exercise=${encodeURIComponent(latestPr.name)}`}>
              {t("dashboard.latestPr")}
            </CardTitle>
            <div className={styles.recordRow}>
              <span className={styles.recordIcon}>
                <Icon name="trophy" size={18} />
              </span>
              <span className={styles.recordMain}>
                <span className={styles.recordName}>{latestPr.name}</span>
                <span className={styles.dim}>{formatSet(latestPr, language)}</span>
              </span>
              <span className={styles.recordSide}>
                <span className={styles.recordValue}>
                  {`${formatNumber(latestPr.e1rm, language, { decimals: E1RM_DECIMAL_PLACES })} kg`}
                </span>
                <span className={styles.dim}>{dayLabel(latestPr.date)}</span>
              </span>
            </div>
          </section>
        )}

        <section className={styles.card}>
          <div className={styles.titleRow}>
            <CardTitle>{t("dashboard.bodyweight")}</CardTitle>
            <SegmentedControl
              compact
              label={t("dashboard.bodyweightRange")}
              options={BODYWEIGHT_RANGES.map(({ days, labelKey }) => ({
                value: days,
                label: t(labelKey),
              }))}
              value={bwRange}
              onChange={changeBwRange}
            />
          </div>
          {latestTrend !== null && (
            <div className={styles.numberRow}>
              <p className={styles.bigNumber}>
                {formatNumber(latestTrend, language, { decimals: 1 })}
                <span className={styles.bigUnit}> kg</span>
              </p>
              {weeklyChange !== null && (
                <span className={styles.chip}>
                  {t("dashboard.weeklyChange", {
                    change: `${weeklyChange > 0 ? "+" : ""}${formatNumber(weeklyChange, language, { decimals: 1 })}`,
                  })}
                </span>
              )}
            </div>
          )}
          {bodyweightChart.entries.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={160}>
                <LineChart
                  data={bodyweightChart.entries.map((entry) => ({
                    ...entry,
                    label: formatDayMonth(entry.date),
                  }))}
                  margin={{ top: 4, right: 4, bottom: 0, left: -16 }}
                >
                  <XAxis dataKey="label" tick={AXIS_TICK} axisLine={false} tickLine={false} />
                  <YAxis
                    tick={AXIS_TICK}
                    axisLine={false}
                    tickLine={false}
                    domain={["auto", "auto"]}
                    tickFormatter={(value) => formatNumber(value, language)}
                  />
                  <Tooltip
                    {...TOOLTIP_STYLE}
                    formatter={(value, name) => [
                      `${formatNumber(value, language, { maxDecimals: 1 })} kg`,
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
              <div className={styles.legend}>
                <span className={styles.legendItem}>
                  <span className={styles.legendDot} />
                  {t("dashboard.weighInLegend")}
                </span>
                <span className={styles.legendItem}>
                  <span className={styles.legendLine} />
                  {t("dashboard.trendLegend")}
                </span>
              </div>
            </>
          ) : (
            <p className={styles.dim}>{t("dashboard.noData")}</p>
          )}
        </section>

        <section className={styles.card}>
          <CardTitle>{t("dashboard.muscleGroupVolume")}</CardTitle>
          <MuscleGroupVolumeChart />
        </section>

        <section className={styles.card}>
          <CardTitle>{t("dashboard.recentWorkouts")}</CardTitle>
          {recentWorkouts.length > 0 ? (
            <ul className={styles.list}>
              {recentWorkouts.map((recent) => (
                <li key={recent.id}>
                  <Link className={styles.listRow} to={logLink(dateKeyOf(new Date(recent.date)))}>
                    <span className={styles.listMain}>
                      <span className={styles.listName}>
                        {recent.name || t("dashboard.workoutFallbackName")}
                      </span>
                      <span className={styles.dim}>{dayLabel(recent.date)}</span>
                    </span>
                    <span className={styles.listSide}>
                      {t("dashboard.exerciseCount", { count: recent.exercises?.length ?? 0 })}
                    </span>
                    <span className={styles.chevron}>
                      <Icon name="chevronRight" size={18} />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.dim}>{t("dashboard.noWorkouts")}</p>
          )}
        </section>
      </div>
    </div>
  );
}

export default Dashboard;
