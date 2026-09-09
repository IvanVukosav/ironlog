import { useState, useEffect, useRef, useCallback, Fragment } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { fetchJson } from "../api";
import { findBestSetByE1rm, ONE_REP_MAX_FORMULAS } from "../utils/oneRepMax";
import { useToast } from "../context/useToast";
import MuscleGroupVolumeChart from "../components/MuscleGroupVolumeChart";
import styles from "./Stats.module.css";

const E1RM_DECIMAL_PLACES = 1;

function getRecentPr(sets, formula) {
  if (sets.length === 0) return null;
  const bestOverall = findBestSetByE1rm(sets, formula);
  const latestDate = sets.reduce(
    (latest, set) => (!latest || set.date > latest ? set.date : latest),
    null,
  );
  return bestOverall.date === latestDate ? bestOverall : null;
}

function formatChartDate(dateString) {
  const date = new Date(dateString);
  return `${date.getUTCDate()}/${date.getUTCMonth() + 1}`;
}

function Stats() {
  const { showError } = useToast();
  const [prs, setPrs] = useState([]);
  const [settings, setSettings] = useState(null);
  const [selectedExercise, setSelectedExercise] = useState("");
  const [history, setHistory] = useState([]);
  const [manageMenuFor, setManageMenuFor] = useState(null);
  const [expandedHistoryFor, setExpandedHistoryFor] = useState(null);
  const [expandedHistoryEntries, setExpandedHistoryEntries] = useState([]);
  const chartSectionRef = useRef(null);
  const formula = settings?.e1rmFormula ?? ONE_REP_MAX_FORMULAS.brzycki;

  const fetchPrs = useCallback(() => {
    fetchJson("/api/stats/prs")
      .then((data) => {
        setPrs(data);
        setSelectedExercise((prev) => {
          const stillExists = data.some((pr) => pr.name === prev);
          if (stillExists) return prev;
          return data.length > 0 ? data[0].name : "";
        });
      })
      .catch((err) => {
        console.error(err);
        showError(err.message);
      });
  }, [showError]);

  useEffect(() => {
    fetchPrs();

    fetchJson("/api/settings")
      .then((data) => setSettings(data))
      .catch((err) => {
        console.error(err);
        showError(err.message);
      });
  }, [fetchPrs, showError]);

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
      .then((data) => setHistory(data))
      .catch((err) => {
        console.error(err);
        showError(err.message);
      });
  }, [selectedExercise, showError]);

  const deleteAllRecordsForExercise = (name) => {
    setManageMenuFor(null);
    const confirmed = window.confirm(
      `Obrisati SVE zapise vježbe "${name}" iz svih treninga? Ovo se ne može poništiti. (Za brisanje samo pojedinih dana, koristi "Prikaži po datumima" umjesto ovoga.)`,
    );
    if (!confirmed) return;
    fetchJson(`/api/workouts/exercises/by-name/${encodeURIComponent(name)}`, { method: "DELETE" })
      .then(() => {
        fetchPrs();
        if (expandedHistoryFor === name) {
          setExpandedHistoryFor(null);
          setExpandedHistoryEntries([]);
        }
      })
      .catch((err) => {
        console.error(err);
        showError(err.message);
      });
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
      .catch((err) => {
        console.error(err);
        showError(err.message);
      });
  };

  const deleteHistoryEntry = (exerciseId) => {
    fetchJson(`/api/workouts/exercises/${exerciseId}`, { method: "DELETE" })
      .then(() => {
        setExpandedHistoryEntries((prev) => prev.filter((entry) => entry.id !== exerciseId));
        fetchPrs();
      })
      .catch((err) => {
        console.error(err);
        showError(err.message);
      });
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

  const chartData = history
    .map((entry) => {
      const bestSet = findBestSetByE1rm(entry.sets, formula);
      return bestSet
        ? {
            label: formatChartDate(entry.date),
            e1rm: parseFloat(bestSet.e1rm.toFixed(E1RM_DECIMAL_PLACES)),
          }
        : null;
    })
    .filter(Boolean);

  return (
    <div className={styles.page}>
      <h1 className={styles.heading}>Stats</h1>
      {recentPrRows.length > 0 && (
        <div className={styles.recentPrSection}>
          <h2 className={styles.recentPrHeading}>Nedavno oboreni rekordi</h2>
          <div className={styles.recentPrList}>
            {recentPrRows.map((row) => (
              <button
                key={row.name}
                className={row.name === selectedExercise ? `${styles.recentPrRow} ${styles.recentPrRowActive}` : styles.recentPrRow}
                onClick={() => {
                  setSelectedExercise(row.name);
                  chartSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
              >
                <span className={styles.recentPrName}>{row.name}</span>
                <span className={styles.recentPrDetail}>
                  {row.e1rm.toFixed(E1RM_DECIMAL_PLACES)}kg e1RM — {row.weight}kg × {row.reps} @ RPE {row.rpe ?? "—"}
                </span>
                <span className={styles.recentPrDate}>{formatChartDate(row.date)}</span>
              </button>
            ))}
          </div>
        </div>
      )}
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Exercise</th>
            <th>e1RM</th>
            <th>Best set</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {prRows.map((row) => (
            <Fragment key={row.name}>
              <tr>
                <td>{row.name}</td>
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
                        Prikaži po datumima
                      </button>
                      <button
                        className={styles.manageMenuItem}
                        onClick={() => deleteAllRecordsForExercise(row.name)}
                      >
                        Obriši sve zapise
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
                        <span className={styles.historyEntryDate}>{formatChartDate(entry.date)}</span>
                        <span className={styles.historyEntryDetail}>
                          {entry.sets.length > 0
                            ? entry.sets.map((set) => `${set.weight}kg×${set.reps}`).join(", ")
                            : "bez setova"}
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
          <h2 className={styles.chartHeading}>Napredak</h2>
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
              <XAxis dataKey="label" tick={{ fill: "#666", fontFamily: "ui-monospace", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#666", fontFamily: "ui-monospace", fontSize: 11 }} axisLine={false} tickLine={false} domain={["auto", "auto"]} />
              <Tooltip
                contentStyle={{ background: "#141414", border: "1px solid #444", fontFamily: "ui-monospace", fontSize: 12 }}
                labelStyle={{ color: "#666" }}
                itemStyle={{ color: "#f0f0f0" }}
                formatter={(value) => [`${value}kg`, "e1RM"]}
              />
              <Line type="monotone" dataKey="e1rm" stroke="#ff3b3b" strokeWidth={2} dot={{ fill: "#ff3b3b", r: 3 }} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <p className={styles.emptyState}>Nema podataka</p>
        )}
      </div>

      <div className={styles.volumeSection}>
        <h2 className={styles.chartHeading}>Volumen po mišićnoj skupini</h2>
        <MuscleGroupVolumeChart />
      </div>
    </div>
  );
}

export default Stats;
