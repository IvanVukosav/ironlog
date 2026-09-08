import { useState, useEffect } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { fetchJson } from "../api";
import { calculateEstimatedOneRepMax, ONE_REP_MAX_FORMULAS } from "../utils/oneRepMax";
import styles from "./Stats.module.css";

const E1RM_DECIMAL_PLACES = 1;

function findBestSetByE1rm(sets, formula) {
  return sets.reduce((best, set) => {
    const e1rm = calculateEstimatedOneRepMax(set.weight, set.reps, set.rpe, formula);
    if (!best || e1rm > best.e1rm) {
      return { ...set, e1rm };
    }
    return best;
  }, null);
}

function formatChartDate(dateString) {
  const date = new Date(dateString);
  return `${date.getUTCDate()}/${date.getUTCMonth() + 1}`;
}

function Stats() {
  const [prs, setPrs] = useState([]);
  const [settings, setSettings] = useState(null);
  const [selectedExercise, setSelectedExercise] = useState("");
  const [history, setHistory] = useState([]);
  const formula = settings?.e1rmFormula ?? ONE_REP_MAX_FORMULAS.brzycki;

  useEffect(() => {
    fetchJson("/api/stats/prs")
      .then((data) => {
        setPrs(data);
        if (data.length > 0) {
          setSelectedExercise(data[0].name);
        }
      })
      .catch((err) => console.error(err));

    fetchJson("/api/settings")
      .then((data) => setSettings(data))
      .catch((err) => console.error(err));
  }, []);

  useEffect(() => {
    if (!selectedExercise) return;
    fetchJson(`/api/stats/exercise/${encodeURIComponent(selectedExercise)}/history`)
      .then((data) => setHistory(data))
      .catch((err) => console.error(err));
  }, [selectedExercise]);

  const prRows = prs
    .map((pr) => {
      const bestSet = findBestSetByE1rm(pr.sets, formula);
      return bestSet ? { name: pr.name, ...bestSet } : null;
    })
    .filter(Boolean)
    .sort((rowA, rowB) => rowB.e1rm - rowA.e1rm);

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
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Exercise</th>
            <th>e1RM</th>
            <th>Best set</th>
          </tr>
        </thead>
        <tbody>
          {prRows.map((row) => (
            <tr key={row.name}>
              <td>{row.name}</td>
              <td>{row.e1rm.toFixed(E1RM_DECIMAL_PLACES)}kg</td>
              <td>
                {row.weight}kg × {row.reps} @ RPE {row.rpe ?? "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className={styles.chartSection}>
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
    </div>
  );
}

export default Stats;
