import { useState, useEffect, useRef, useCallback, Fragment } from "react";
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
import { useToast } from "../context/useToast";
import { useSettings } from "../context/useSettings";
import { useReportError } from "../hooks/useReportError";
import { AXIS_TICK, CHART_COLORS, TOOLTIP_STYLE } from "../utils/chartTheme";
import { formatDayMonth } from "../utils/dates";
import MuscleGroupVolumeChart from "../components/MuscleGroupVolumeChart";
import MainLiftsChart from "../components/MainLiftsChart";
import FeaturedExercises from "../components/FeaturedExercises";
import styles from "./Stats.module.css";

const E1RM_DECIMAL_PLACES = 1;
const SCORE_DECIMAL_PLACES = 1;
const PR_DOT_RADIUS = 4;
const POINT_DOT_RADIUS = 2;
const BODYWEIGHT_LOOKBACK_DAYS = 3650;

function getRecentPr(sets, formula) {
  if (sets.length === 0) return null;
  const bestOverall = findBestSetByE1rm(sets, formula);
  const latestDate = sets.reduce(
    (latest, set) => (!latest || set.date > latest ? set.date : latest),
    null,
  );
  // No best set at all when every set is a warm-up or has no e1RM.
  return bestOverall?.date === latestDate ? bestOverall : null;
}

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
  const { t } = useTranslation();
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
  const chartSectionRef = useRef(null);
  const formula = settings?.e1rmFormula ?? DEFAULT_E1RM_FORMULA;

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

  const recentPrRows = prs
    .map((pr) => {
      const recentPr = getRecentPr(pr.sets, formula);
      return recentPr ? { name: pr.name, ...recentPr } : null;
    })
    .filter(Boolean)
    .sort((rowA, rowB) => (rowA.date < rowB.date ? 1 : -1));

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

  const chartData = buildProgressData(history, formula);

  const renderProgressDot = ({ cx, cy, index, payload }) => (
    <circle
      key={index}
      cx={cx}
      cy={cy}
      r={payload.isPr ? PR_DOT_RADIUS : POINT_DOT_RADIUS}
      fill={CHART_COLORS.accent}
      stroke={payload.isPr ? CHART_COLORS.surface : "none"}
      strokeWidth={2}
    />
  );

  return (
    <div className={styles.page}>
      <h1 className={styles.heading}>{t("nav.stats")}</h1>
      <FeaturedExercises
        exerciseSets={prs}
        names={featured.names}
        isAuto={featured.isAuto}
        formula={formula}
        onSelect={showProgressFor}
      />
      {settings?.showPowerliftingTotal && hasAnyMainLift && (
        <div className={styles.totalSection}>
          <h2 className={styles.recentPrHeading}>{t("stats.powerliftingTotal")}</h2>
          <div className={styles.totalGrid}>
            {MAIN_LIFTS.map((lift) => (
              <div key={lift} className={styles.totalCard}>
                <span className={styles.totalLabel}>{t(`stats.lifts.${lift}`)}</span>
                <span className={styles.totalValue}>
                  {mainLiftBests[lift]
                    ? `${mainLiftBests[lift].e1rm.toFixed(E1RM_DECIMAL_PLACES)}kg`
                    : "—"}
                </span>
                {mainLiftBests[lift] && (
                  <span className={styles.totalDetail}>{mainLiftBests[lift].name}</span>
                )}
              </div>
            ))}
            <div className={styles.totalCard}>
              <span className={styles.totalLabel}>{t("stats.total")}</span>
              <span className={styles.totalValue}>
                {total ? `${total.toFixed(E1RM_DECIMAL_PLACES)}kg` : "—"}
              </span>
              <span className={styles.totalDetail}>e1RM</span>
            </div>
            <div className={styles.totalCard}>
              <span className={styles.totalLabel}>DOTS</span>
              <span className={styles.totalValue}>
                {dots ? dots.toFixed(SCORE_DECIMAL_PLACES) : "—"}
              </span>
              {latestBodyweight && (
                <span className={styles.totalDetail}>
                  {t("stats.atBodyweight", { weight: latestBodyweight.weight })}
                </span>
              )}
            </div>
            <div className={styles.totalCard}>
              <span className={styles.totalLabel}>Wilks</span>
              <span className={styles.totalValue}>
                {wilks ? wilks.toFixed(SCORE_DECIMAL_PLACES) : "—"}
              </span>
            </div>
          </div>
          {!hasAllMainLifts && <p className={styles.totalHint}>{t("stats.totalMissingLifts")}</p>}
          {hasAllMainLifts && !latestBodyweight && (
            <p className={styles.totalHint}>{t("stats.totalMissingBodyweight")}</p>
          )}
        </div>
      )}
      {settings?.showPowerliftingTotal && hasAnyMainLift && (
        <MainLiftsChart exerciseSets={prs} mainLiftBests={mainLiftBests} formula={formula} />
      )}
      {recentPrRows.length > 0 && (
        <div className={styles.recentPrSection}>
          <h2 className={styles.recentPrHeading}>{t("stats.recentPrs")}</h2>
          <div className={styles.recentPrList}>
            {recentPrRows.map((row) => (
              <button
                key={row.name}
                className={
                  row.name === selectedExercise
                    ? `${styles.recentPrRow} ${styles.recentPrRowActive}`
                    : styles.recentPrRow
                }
                onClick={() => showProgressFor(row.name)}
              >
                <span className={styles.recentPrName}>{row.name}</span>
                <span className={styles.recentPrDetail}>
                  {row.e1rm.toFixed(E1RM_DECIMAL_PLACES)}kg e1RM — {row.weight}kg × {row.reps} @ RPE{" "}
                  {row.rpe ?? "—"}
                </span>
                <span className={styles.recentPrDate}>{formatDayMonth(row.date)}</span>
              </button>
            ))}
          </div>
        </div>
      )}
      <table className={styles.table}>
        <thead>
          <tr>
            <th>{t("stats.allExercisesHeader")}</th>
            <th>e1RM</th>
            <th>{t("stats.bestSetHeader")}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {prRows.map((row) => (
            <Fragment key={row.name}>
              <tr>
                <td>
                  <button
                    type="button"
                    className={
                      isFeatured(row.name)
                        ? `${styles.starButton} ${styles.starButtonActive}`
                        : styles.starButton
                    }
                    onClick={() => toggleFeatured(row.name)}
                    aria-pressed={isFeatured(row.name)}
                    title={t(isFeatured(row.name) ? "stats.featuredUnstar" : "stats.featuredStar")}
                  >
                    {isFeatured(row.name) ? "★" : "☆"}
                  </button>
                  {row.name}
                </td>
                <td>{row.e1rm.toFixed(E1RM_DECIMAL_PLACES)}kg</td>
                <td>
                  {row.weight}kg × {row.reps} @ RPE {row.rpe ?? "—"}
                </td>
                <td className={styles.manageCell} data-manage-menu>
                  <button
                    className={styles.manageMenuButton}
                    onClick={() => setManageMenuFor(manageMenuFor === row.name ? null : row.name)}
                  >
                    ⋮
                  </button>
                  {manageMenuFor === row.name && (
                    <div className={styles.manageMenuDropdown}>
                      <button
                        className={styles.manageMenuItem}
                        onClick={() => toggleHistoryPanel(row.name)}
                      >
                        {t("stats.showByDate")}
                      </button>
                      <button
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
                          {formatDayMonth(entry.date)}
                        </span>
                        <span className={styles.historyEntryDetail}>
                          {entry.sets.length > 0
                            ? entry.sets.map((set) => `${set.weight}kg×${set.reps}`).join(", ")
                            : t("stats.noSets")}
                        </span>
                        <button
                          className={styles.historyEntryDelete}
                          onClick={() => deleteHistoryEntry(entry.id)}
                        >
                          ✕
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

      <div className={styles.chartSection} ref={chartSectionRef}>
        <div className={styles.chartHeader}>
          <h2 className={styles.chartHeading}>{t("stats.progress")}</h2>
          {prs.length > 0 && (
            <select
              className={styles.exerciseSelect}
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
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chartData}>
              <XAxis dataKey="label" tick={AXIS_TICK} axisLine={false} tickLine={false} />
              <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} domain={["auto", "auto"]} />
              <Tooltip {...TOOLTIP_STYLE} formatter={(value) => [`${value}kg`, "e1RM"]} />
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

      <div className={styles.volumeSection}>
        <h2 className={styles.chartHeading}>{t("dashboard.muscleGroupVolume")}</h2>
        <MuscleGroupVolumeChart />
      </div>
    </div>
  );
}

export default Stats;
