import { useState, useEffect, useRef, useCallback, useMemo, Fragment } from "react";
import { useSearchParams } from "react-router-dom";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { useTranslation } from "react-i18next";
import { fetchJson } from "../api";
import { DEFAULT_E1RM_FORMULA, findBestSetByE1rm } from "../utils/oneRepMax";
import {
  MAIN_LIFTS,
  calculateDots,
  calculateWilks,
  findMainLiftBests,
} from "../utils/strengthScores";
import {
  MAX_FEATURED_EXERCISES,
  parseFeaturedExercises,
  resolveFeaturedExercises,
} from "../utils/featuredExercises";
import {
  DEFAULT_STATS_PERIOD,
  STATS_PERIODS,
  periodStart,
  summarizePeriod,
  volumeBuckets,
} from "../utils/statsSummary";
import { useToast } from "../context/useToast";
import { useSettings } from "../context/useSettings";
import { useReportError } from "../hooks/useReportError";
import { AXIS_TICK, CHART_COLORS, TOOLTIP_STYLE } from "../utils/chartTheme";
import { formatDayMonth, formatShortDate, todayKey } from "../utils/dates";
import { formatNumber, formatSet, formatVolume } from "../utils/numbers";
import Icon from "../components/Icon";
import MuscleGroupVolumeChart from "../components/MuscleGroupVolumeChart";
import MainLiftsChart from "../components/MainLiftsChart";
import FeaturedExercises from "../components/FeaturedExercises";
import RecentRecords from "../components/RecentRecords";
import VolumeBars from "../components/VolumeBars";
import styles from "./Stats.module.css";

const E1RM_DECIMAL_PLACES = 1;
const SCORE_DECIMAL_PLACES = 1;
const PR_DOT_RADIUS = 4;
const POINT_DOT_RADIUS = 2;
const BODYWEIGHT_LOOKBACK_DAYS = 3650;

// Best e1RM per session; isPr marks sessions that beat every earlier one.
function buildProgressData(history, formula) {
  let runningBest = null;
  return history
    .map((entry) => {
      const bestSet = findBestSetByE1rm(entry.sets, formula);
      if (!bestSet) return null;
      const isPr = runningBest !== null && bestSet.e1rm > runningBest;
      runningBest = runningBest === null ? bestSet.e1rm : Math.max(runningBest, bestSet.e1rm);
      return {
        label: formatDayMonth(entry.date),
        e1rm: parseFloat(bestSet.e1rm.toFixed(E1RM_DECIMAL_PLACES)),
        isPr,
      };
    })
    .filter(Boolean);
}

function Stats() {
  const { t, i18n } = useTranslation();
  const language = i18n.language;
  const { showError } = useToast();
  const reportError = useReportError();
  const [searchParams] = useSearchParams();
  const exerciseParam = searchParams.get("exercise");
  const [prs, setPrs] = useState([]);
  const { settings, updateSettings } = useSettings();
  const [selectedExercise, setSelectedExercise] = useState("");
  const [history, setHistory] = useState([]);
  const [manageMenuFor, setManageMenuFor] = useState(null);
  const [expandedHistoryFor, setExpandedHistoryFor] = useState(null);
  const [expandedHistoryEntries, setExpandedHistoryEntries] = useState([]);
  const [latestBodyweight, setLatestBodyweight] = useState(null);
  const [period, setPeriod] = useState(DEFAULT_STATS_PERIOD);
  const chartSectionRef = useRef(null);
  const allExercisesRef = useRef(null);
  const formula = settings?.e1rmFormula ?? DEFAULT_E1RM_FORMULA;

  // Days are UTC midnights, the way workouts are stored; today is the user's own today.
  const todayStart = Date.parse(todayKey());
  const since = periodStart(todayStart, STATS_PERIODS[period]);
  const periodSpan = t(`stats.periodSpan.${period}`);
  // Every set ever logged goes through these, so they are worked out again only when needed.
  const summary = useMemo(() => summarizePeriod(prs, formula, since), [prs, formula, since]);
  const volume = useMemo(() => volumeBuckets(prs, period, todayStart), [prs, period, todayStart]);
  const kg = (value) => `${formatNumber(value, language, { decimals: E1RM_DECIMAL_PLACES })} kg`;

  const fetchPrs = useCallback(() => {
    fetchJson("/api/stats/prs")
      .then((data) => {
        setPrs(data);
        setSelectedExercise((prev) => {
          if (prev && data.some((pr) => pr.name === prev)) return prev;
          if (exerciseParam && data.some((pr) => pr.name === exerciseParam)) return exerciseParam;
          return data.length > 0 ? data[0].name : "";
        });
      })
      .catch(reportError);
  }, [reportError, exerciseParam]);

  useEffect(() => {
    fetchPrs();

    fetchJson(`/api/bodyweight?days=${BODYWEIGHT_LOOKBACK_DAYS}`)
      .then((entries) => setLatestBodyweight(entries.at(-1) ?? null))
      .catch(reportError);
  }, [fetchPrs, reportError]);

  useEffect(() => {
    if (exerciseParam && selectedExercise === exerciseParam) {
      chartSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [exerciseParam, selectedExercise]);

  useEffect(() => {
    if (!manageMenuFor) return undefined;
    const handleClickOutside = (event) => {
      if (!event.target.closest("[data-manage-menu]")) {
        setManageMenuFor(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [manageMenuFor]);

  useEffect(() => {
    if (!selectedExercise) return;
    fetchJson(`/api/stats/exercise/${encodeURIComponent(selectedExercise)}/history`)
      .then(setHistory)
      .catch(reportError);
  }, [selectedExercise, reportError]);

  const showProgressFor = (name) => {
    setSelectedExercise(name);
    chartSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const featured = resolveFeaturedExercises(prs, parseFeaturedExercises(settings), formula);
  const isFeatured = (name) => !featured.isAuto && featured.names.includes(name);

  // Saved straight away: Stats has no Save button.
  const toggleFeatured = (name) => {
    const current = featured.isAuto ? [] : featured.names;
    const next = current.includes(name)
      ? current.filter((featuredName) => featuredName !== name)
      : [...current, name];
    if (next.length > MAX_FEATURED_EXERCISES) {
      showError(t("stats.featuredLimit", { max: MAX_FEATURED_EXERCISES }));
      return;
    }
    updateSettings({ featuredExercises: JSON.stringify(next) });
  };

  const deleteAllRecordsForExercise = (name) => {
    setManageMenuFor(null);
    const confirmed = window.confirm(t("stats.confirmDeleteAllRecords", { name }));
    if (!confirmed) return;
    fetchJson(`/api/workouts/exercises/by-name/${encodeURIComponent(name)}`, { method: "DELETE" })
      .then(() => {
        fetchPrs();
        if (expandedHistoryFor === name) {
          setExpandedHistoryFor(null);
          setExpandedHistoryEntries([]);
        }
      })
      .catch(reportError);
  };

  const toggleHistoryPanel = (name) => {
    setManageMenuFor(null);
    if (expandedHistoryFor === name) {
      setExpandedHistoryFor(null);
      setExpandedHistoryEntries([]);
      return;
    }
    fetchJson(`/api/stats/exercise/${encodeURIComponent(name)}/history`)
      .then((data) => {
        setExpandedHistoryFor(name);
        setExpandedHistoryEntries(data);
      })
      .catch(reportError);
  };

  const deleteHistoryEntry = (exerciseId) => {
    fetchJson(`/api/workouts/exercises/${exerciseId}`, { method: "DELETE" })
      .then(() => {
        setExpandedHistoryEntries((prev) => prev.filter((entry) => entry.id !== exerciseId));
        fetchPrs();
      })
      .catch(reportError);
  };

  const prRows = prs
    .map((pr) => {
      const bestSet = findBestSetByE1rm(pr.sets, formula);
      return bestSet ? { name: pr.name, ...bestSet } : null;
    })
    .filter(Boolean)
    .sort((rowA, rowB) => rowB.e1rm - rowA.e1rm);

  const mainLiftBests = findMainLiftBests(prs, settings, formula);
  const hasAllMainLifts = MAIN_LIFTS.every((lift) => mainLiftBests[lift]);
  const hasAnyMainLift = MAIN_LIFTS.some((lift) => mainLiftBests[lift]);
  const total = hasAllMainLifts
    ? MAIN_LIFTS.reduce((sum, lift) => sum + mainLiftBests[lift].e1rm, 0)
    : null;
  const dots =
    total && latestBodyweight ? calculateDots(total, latestBodyweight.weight, settings?.sex) : null;
  const wilks =
    total && latestBodyweight
      ? calculateWilks(total, latestBodyweight.weight, settings?.sex)
      : null;
  const score = (value) =>
    value ? formatNumber(value, language, { decimals: SCORE_DECIMAL_PLACES }) : "—";

  const chartData = buildProgressData(history, formula);

  // The chart sits on a card, so a PR's ring takes the card's colour to stand clear of the line.
  const renderProgressDot = ({ cx, cy, index, payload }) => (
    <circle
      key={index}
      cx={cx}
      cy={cy}
      r={payload.isPr ? PR_DOT_RADIUS : POINT_DOT_RADIUS}
      fill={CHART_COLORS.accent}
      stroke={payload.isPr ? CHART_COLORS.card : "none"}
      strokeWidth={2}
    />
  );

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.heading}>{t("nav.stats")}</h1>
        <div className={styles.periods} role="group" aria-label={t("stats.periodLabel")}>
          {Object.keys(STATS_PERIODS).map((key) => (
            <button
              key={key}
              type="button"
              className={styles.periodButton}
              aria-pressed={period === key}
              onClick={() => setPeriod(key)}
            >
              {t(`stats.periods.${key}`)}
            </button>
          ))}
        </div>
      </header>

      <div className={styles.sections}>
        <div className={styles.tiles}>
          <div className={styles.tile}>
            <span className={styles.tileValue}>{formatNumber(summary.workouts, language)}</span>
            <span className={styles.tileLabel}>{t("stats.tileWorkouts")}</span>
          </div>
          <div className={styles.tile}>
            <span className={styles.tileValue}>{formatVolume(summary.volume, language)}</span>
            <span className={styles.tileLabel}>{t("stats.tileVolume")}</span>
          </div>
          <div className={styles.tile}>
            <span className={styles.tileValue}>
              {formatNumber(summary.records.length, language)}
            </span>
            <span className={styles.tileLabel}>{t("stats.tileRecords")}</span>
          </div>
        </div>

        <FeaturedExercises
          exerciseSets={prs}
          names={featured.names}
          isAuto={featured.isAuto}
          formula={formula}
          since={since}
          periodSpan={periodSpan}
          onSelect={showProgressFor}
          onEdit={() =>
            allExercisesRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
          }
        />

        <RecentRecords
          records={summary.records}
          periodSpan={periodSpan}
          todayStart={todayStart}
          onSelect={showProgressFor}
        />

        <VolumeBars unit={volume.unit} buckets={volume.buckets} />

        {settings?.showPowerliftingTotal && hasAnyMainLift && (
          <section className={styles.section}>
            <h2 className={styles.sectionHeading}>{t("stats.powerliftingTotal")}</h2>
            <div className={styles.totalGrid}>
              {MAIN_LIFTS.map((lift) => (
                <div key={lift} className={styles.tile}>
                  <span className={styles.tileLabel}>{t(`stats.lifts.${lift}`)}</span>
                  <span className={styles.tileValue}>
                    {mainLiftBests[lift] ? kg(mainLiftBests[lift].e1rm) : "—"}
                  </span>
                  {mainLiftBests[lift] && (
                    <span className={styles.tileDetail}>{mainLiftBests[lift].name}</span>
                  )}
                </div>
              ))}
              <div className={styles.tile}>
                <span className={styles.tileLabel}>{t("stats.total")}</span>
                <span className={styles.tileValue}>{total ? kg(total) : "—"}</span>
                <span className={styles.tileDetail}>e1RM</span>
              </div>
              <div className={styles.tile}>
                <span className={styles.tileLabel}>DOTS</span>
                <span className={styles.tileValue}>{score(dots)}</span>
                {latestBodyweight && (
                  <span className={styles.tileDetail}>
                    {t("stats.atBodyweight", {
                      weight: formatNumber(latestBodyweight.weight, language),
                    })}
                  </span>
                )}
              </div>
              <div className={styles.tile}>
                <span className={styles.tileLabel}>Wilks</span>
                <span className={styles.tileValue}>{score(wilks)}</span>
              </div>
            </div>
            {!hasAllMainLifts && <p className={styles.hint}>{t("stats.totalMissingLifts")}</p>}
            {hasAllMainLifts && !latestBodyweight && (
              <p className={styles.hint}>{t("stats.totalMissingBodyweight")}</p>
            )}
          </section>
        )}
        {settings?.showPowerliftingTotal && hasAnyMainLift && (
          <MainLiftsChart exerciseSets={prs} mainLiftBests={mainLiftBests} formula={formula} />
        )}

        <section className={styles.section} ref={chartSectionRef}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionHeading}>{t("stats.progress")}</h2>
            {prs.length > 0 && (
              <select
                className={styles.exerciseSelect}
                aria-label={t("stats.exercise")}
                value={selectedExercise}
                onChange={(event) => setSelectedExercise(event.target.value)}
              >
                {prs.map((pr) => (
                  <option key={pr.name} value={pr.name}>
                    {pr.name}
                  </option>
                ))}
              </select>
            )}
          </div>
          <div className={styles.card}>
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={chartData}>
                  <XAxis dataKey="label" tick={AXIS_TICK} axisLine={false} tickLine={false} />
                  <YAxis
                    tick={AXIS_TICK}
                    axisLine={false}
                    tickLine={false}
                    domain={["auto", "auto"]}
                  />
                  <Tooltip {...TOOLTIP_STYLE} formatter={(value) => [kg(value), "e1RM"]} />
                  <Line
                    type="monotone"
                    dataKey="e1rm"
                    stroke={CHART_COLORS.accent}
                    strokeWidth={2}
                    dot={renderProgressDot}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className={styles.emptyState}>{t("dashboard.noData")}</p>
            )}
          </div>
        </section>

        <section className={styles.section} ref={allExercisesRef}>
          <h2 className={styles.sectionHeading}>{t("stats.allExercisesHeader")}</h2>
          <div className={styles.tableCard}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">{t("stats.exercise")}</th>
                  <th scope="col">e1RM</th>
                  <th scope="col">{t("stats.bestSetHeader")}</th>
                  <th scope="col">
                    <span className={styles.srOnly}>{t("stats.options")}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {prRows.map((row) => (
                  <Fragment key={row.name}>
                    <tr>
                      <td>
                        <span className={styles.nameCell}>
                          <button
                            type="button"
                            className={
                              isFeatured(row.name)
                                ? `${styles.starButton} ${styles.starButtonActive}`
                                : styles.starButton
                            }
                            onClick={() => toggleFeatured(row.name)}
                            aria-pressed={isFeatured(row.name)}
                            aria-label={t("stats.featuredStar")}
                            title={t(
                              isFeatured(row.name) ? "stats.featuredUnstar" : "stats.featuredStar",
                            )}
                          >
                            {isFeatured(row.name) ? "★" : "☆"}
                          </button>
                          {row.name}
                        </span>
                      </td>
                      <td className={styles.numberCell}>{kg(row.e1rm)}</td>
                      <td>{formatSet(row, language)}</td>
                      <td className={styles.manageCell} data-manage-menu>
                        <button
                          type="button"
                          className={styles.manageMenuButton}
                          aria-label={t("stats.exerciseOptions", { name: row.name })}
                          aria-expanded={manageMenuFor === row.name}
                          onClick={() =>
                            setManageMenuFor(manageMenuFor === row.name ? null : row.name)
                          }
                        >
                          <Icon name="more" />
                        </button>
                        {manageMenuFor === row.name && (
                          <div className={styles.manageMenuDropdown}>
                            <button
                              type="button"
                              className={styles.manageMenuItem}
                              onClick={() => toggleHistoryPanel(row.name)}
                            >
                              {t("stats.showByDate")}
                            </button>
                            <button
                              type="button"
                              className={styles.manageMenuItem}
                              onClick={() => deleteAllRecordsForExercise(row.name)}
                            >
                              {t("stats.deleteAllRecords")}
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                    {expandedHistoryFor === row.name && (
                      <tr>
                        <td colSpan={4} className={styles.historyPanel}>
                          {expandedHistoryEntries.map((entry) => (
                            <div key={entry.id} className={styles.historyEntryRow}>
                              <span className={styles.historyEntryDate}>
                                {formatShortDate(entry.date, language)}
                              </span>
                              <span className={styles.historyEntryDetail}>
                                {entry.sets.length > 0
                                  ? entry.sets
                                      .map((set) => formatSet({ ...set, rpe: null }, language))
                                      .join(", ")
                                  : t("stats.noSets")}
                              </span>
                              <button
                                type="button"
                                className={styles.historyEntryDelete}
                                aria-label={t("common.delete")}
                                onClick={() => deleteHistoryEntry(entry.id)}
                              >
                                <Icon name="close" size={16} />
                              </button>
                            </div>
                          ))}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionHeading}>{t("dashboard.muscleGroupVolume")}</h2>
          <div className={styles.card}>
            <MuscleGroupVolumeChart />
          </div>
        </section>
      </div>
    </div>
  );
}

export default Stats;
