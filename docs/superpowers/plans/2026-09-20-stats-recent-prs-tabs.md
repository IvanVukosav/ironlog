# Stats Recent-PRs/Table Merge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the separate "Nedavno oboreni rekordi" list on the Stats page with a tabbed view of the same table it already duplicates — "Svi rekordi" / "Nedavno oboreni" tabs, a new Date column, a "NOVO" badge + highlight on recent-PR rows, and row-click-to-select-in-chart extended to every row.

**Architecture:** Pure frontend change, no backend/schema/API changes — `row.date` already exists on every PR row today (`findBestSetByE1rm` returns `{ ...set, e1rm }`, and `set` already carries `date`), it's just never rendered. `recentPrRows` (already computed) becomes a `Set` of exercise names used to flag/highlight rows in the merged table, instead of feeding a separate list.

**Tech Stack:** React + CSS Modules. No test framework — verification is `npm run build` plus manual checks.

**Spec:** `docs/superpowers/specs/2026-09-20-stats-recent-prs-tabs-design.md`

---

### Task 1: Merge Recent PRs into the table with tabs

**Files:**
- Modify: `frontend/src/pages/Stats.jsx`
- Modify: `frontend/src/pages/Stats.module.css`

- [ ] **Step 1: Replace `Stats.jsx`**

Replace the full contents of `frontend/src/pages/Stats.jsx` with:

```jsx
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
  const [activeTab, setActiveTab] = useState("all");
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

  const selectAndScrollToChart = (name) => {
    setSelectedExercise(name);
    chartSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
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

  const recentPrNames = new Set(recentPrRows.map((row) => row.name));
  const displayedRows = activeTab === "recent" ? recentPrRows : prRows;

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

      <div className={styles.tabRow}>
        <button
          className={activeTab === "all" ? styles.tabActive : styles.tab}
          onClick={() => setActiveTab("all")}
        >
          Svi rekordi
        </button>
        <button
          className={activeTab === "recent" ? styles.tabActive : styles.tab}
          onClick={() => setActiveTab("recent")}
        >
          Nedavno oboreni
          {recentPrRows.length > 0 && (
            <span className={styles.tabBadge}>{recentPrRows.length}</span>
          )}
        </button>
      </div>

      <table className={styles.table}>
        <thead>
          <tr>
            <th>Exercise</th>
            <th>e1RM</th>
            <th>Best set</th>
            <th>Date</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {displayedRows.map((row) => {
            const isRecent = recentPrNames.has(row.name);
            return (
              <Fragment key={row.name}>
                <tr
                  className={isRecent ? `${styles.dataRow} ${styles.rowRecent}` : styles.dataRow}
                  onClick={() => selectAndScrollToChart(row.name)}
                >
                  <td>
                    {row.name}
                    {isRecent && <span className={styles.novoBadge}>NOVO</span>}
                  </td>
                  <td>{row.e1rm.toFixed(E1RM_DECIMAL_PLACES)}kg</td>
                  <td>
                    {row.weight}kg × {row.reps} @ RPE {row.rpe ?? "—"}
                  </td>
                  <td className={styles.dateCell}>{formatChartDate(row.date)}</td>
                  <td className={styles.manageCell} data-manage-menu onClick={(event) => event.stopPropagation()}>
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
                    <td colSpan={5} className={styles.historyPanel}>
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
            );
          })}
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
```

Key changes from the current file: removed the standalone `{recentPrRows.length > 0 && (...)}` section entirely; added `activeTab` state and the tab buttons; added a `recentPrNames` Set and `displayedRows` derived from it; added the Date column (`<th>Date</th>` / `<td className={styles.dateCell}>`); added the `isRecent` badge/highlight on table rows; added `selectAndScrollToChart` (same logic the old Recent PR cards used) wired to every row's `onClick`; added `event.stopPropagation()` on the manage-menu `<td>` so clicking ⋮ or its dropdown doesn't also trigger row selection; `colSpan` on the history panel row changed from `4` to `5`. All other logic (fetch effects, delete handlers, chart, volume section) is unchanged.

- [ ] **Step 2: Replace the CSS**

In `frontend/src/pages/Stats.module.css`, find this block (the last 9 rule-sets in the file, starting at `.recentPrSection`):

```css
.recentPrSection {
  margin-bottom: 2rem;
}

.recentPrHeading {
  font-family: var(--font-mono);
  font-size: 1rem;
  font-weight: 700;
  color: var(--color-text);
  letter-spacing: 0.03em;
  margin-bottom: 0.75rem;
}

.recentPrList {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.recentPrRow {
  display: flex;
  align-items: center;
  gap: 1rem;
  width: 100%;
  background-color: var(--color-bg-card);
  border: none;
  border-left: 3px solid var(--color-accent);
  padding: 0.6rem 1rem;
  font-family: var(--font-mono);
  cursor: pointer;
  text-align: left;
}

.recentPrRow:hover {
  background-color: #1a1a1a;
}

.recentPrRowActive {
  border-left-width: 6px;
  background-color: rgba(255, 59, 59, 0.08);
}

.recentPrRowActive:hover {
  background-color: rgba(255, 59, 59, 0.14);
}

.recentPrName {
  color: var(--color-text);
  font-size: 0.9rem;
  font-weight: 700;
  flex: 0 0 160px;
}

.recentPrDetail {
  color: var(--color-text-dim);
  font-size: 0.8rem;
}

.recentPrDate {
  color: var(--color-text-dim);
  font-size: 0.8rem;
  white-space: nowrap;
}
```

Replace it with:

```css
.tabRow {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.tab {
  background: transparent;
  border: 1px solid var(--color-border);
  color: var(--color-text-dim);
  font-family: var(--font-mono);
  font-size: 0.7rem;
  padding: 3px 8px;
  cursor: pointer;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  display: flex;
  align-items: center;
  gap: 6px;
}

.tabActive {
  background: var(--color-accent);
  border: 1px solid var(--color-accent);
  color: var(--color-bg);
  font-family: var(--font-mono);
  font-size: 0.7rem;
  padding: 3px 8px;
  cursor: pointer;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  display: flex;
  align-items: center;
  gap: 6px;
}

.tabBadge {
  background: rgba(0, 0, 0, 0.25);
  color: inherit;
  font-size: 0.65rem;
  padding: 0 5px;
  border-radius: 8px;
  line-height: 1.4;
}

.dataRow {
  cursor: pointer;
}

.dataRow:hover {
  background-color: #1a1a1a;
}

.rowRecent {
  background-color: rgba(255, 59, 59, 0.08);
  box-shadow: inset 3px 0 0 var(--color-accent);
}

.rowRecent:hover {
  background-color: rgba(255, 59, 59, 0.14);
}

.novoBadge {
  background: var(--color-accent);
  color: var(--color-bg);
  font-size: 0.6rem;
  font-weight: 700;
  padding: 1px 5px;
  margin-left: 8px;
  letter-spacing: 0.03em;
}

.dateCell {
  color: var(--color-text-dim);
}
```

`.tab`/`.tabActive` reuse the exact same pill-button pattern as Dashboard's `.rangeTab`/`.rangeTabActive` (`frontend/src/pages/Dashboard.module.css`) for visual consistency across the app. `.rowRecent` uses `box-shadow: inset 3px 0 0 ...` instead of `border-left` because the table has `border-collapse: collapse` (see `.table` earlier in this file), which can make a plain `border-left` on a `<tr>` render inconsistently — the inset box-shadow trick doesn't have that problem.

- [ ] **Step 3: Build check**

Run from `frontend/`: `npm run build`

Expected: success, no errors.

- [ ] **Step 4: Manual verification**

With `backend/` (`npm start`) and `frontend/` (`npm run dev`) running, hard refresh the browser, go to `/stats`:

1. Default "Svi rekordi" tab shows every exercise, sorted by e1RM, with a new Date column. Any exercise whose best set is also its most recent has a red-tinted row, a red inset stripe on the left edge, and a "NOVO" badge next to its name.
2. Click "Nedavno oboreni" — table now shows only that recent-PR subset (every visible row should show the NOVO badge, since by definition all of them qualify). The tab shows a small count badge matching the number of rows.
3. Click back to "Svi rekordi" — full list returns.
4. Click anywhere on a row (not the ⋮ button) in either tab — confirm the exercise dropdown below the table updates to that exercise and the page smooth-scrolls to the progress chart.
5. Click the ⋮ button on a row — confirm the dropdown menu opens and the page does NOT also scroll to the chart (i.e. `stopPropagation` is working).
6. Use "Prikaži po datumima" from the menu — confirm the expanded history panel still renders correctly and spans the full table width (visually check it isn't cut short by the new 5th column).
7. Delete a record via "Obriši sve zapise" or a single history entry's ✕ — confirm the table (both tabs) and the recent-PR badge count update correctly afterward.

- [ ] **Step 5: Review and commit**

```bash
git add frontend/src/pages/Stats.jsx frontend/src/pages/Stats.module.css
git diff --cached
```

STOP. Report full diff. Wait for confirmation.

After confirmation: `git commit -m "feat: merge Stats recent-PRs list into the main table with tabs"`
