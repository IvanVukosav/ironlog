# Stats Recent PRs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Nedavno oboreni rekordi" (recently broken records) section to the top of the Stats page, showing exercises where the most-recently-logged set is also the all-time best e1RM, clickable to jump the existing chart to that exercise.

**Architecture:** Backend attaches each set's workout date to the existing `/api/stats/prs` response (previously only `/exercise/:name/history` had dates). Frontend derives the recent-PR list from that same `prs` data already being fetched — no new endpoint, no new fetch.

**Tech Stack:** Express + Prisma (backend), React (frontend), plain CSS Modules. No test framework exists in this repo (`backend/package.json`'s `test` script is a placeholder) — verification is manual: `curl` for backend routes, browser for UI, matching how every other feature in this codebase has been verified.

---

## Spec reference

Full design: [`docs/superpowers/specs/2026-09-07-stats-recent-prs-design.md`](../specs/2026-09-07-stats-recent-prs-design.md)

## File Structure

- Modify: `backend/routes/stats.js` — `/prs` route gains `workout: true` in the query and attaches `date` to each flattened set.
- Modify: `frontend/src/pages/Stats.jsx` — new `getRecentPr` helper, `recentPrRows` derived value, new rendered section, click handler wired to existing `selectedExercise` state.
- Modify: `frontend/src/pages/Stats.module.css` — new classes for the recent-PR row list.

---

### Task 1: Backend — attach workout date to each set in `/api/stats/prs`

**Files:**
- Modify: `backend/routes/stats.js:5-28`

- [ ] **Step 1: Add `workout: true` to the include and attach `date` to each set**

Replace the `/prs` route body in `backend/routes/stats.js` (lines 5–28) with:

```js
router.get("/prs", async (req, res) => {
  try {
    const exercises = await prisma.exercise.findMany({
      include: { sets: true, workout: true },
    });

    const setsByExerciseName = {};
    exercises.forEach((exercise) => {
      const sets = exercise.sets.map((set) => ({
        date: exercise.workout.date,
        weight: set.weight,
        reps: set.reps,
        rpe: set.rpe,
      }));
      setsByExerciseName[exercise.name] = (setsByExerciseName[exercise.name] || []).concat(sets);
    });

    res.json(
      Object.entries(setsByExerciseName).map(([name, sets]) => ({ name, sets })),
    );
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});
```

The only change from the current version: `include: { sets: true }` → `include: { sets: true, workout: true }`, and each mapped set now has a `date: exercise.workout.date` field.

- [ ] **Step 2: Verify syntax**

Run: `cd backend && node -c routes/stats.js`
Expected: no output (clean exit).

- [ ] **Step 3: Restart the backend and verify via curl**

The dev backend has no file-watcher (`npm start` runs plain `node server.js`), so it must be restarted manually to pick up the change:

```bash
# find and kill the process holding port 3001, then:
cd backend && npm start
```

Then, with at least one logged set in the database:

```bash
curl -s http://localhost:3001/api/stats/prs
```

Expected: each object in each exercise's `sets` array now has a `date` field, e.g.:
```json
[{"name":"Bench Press","sets":[{"date":"2026-09-07T00:00:00.000Z","weight":118,"reps":8,"rpe":6}]}]
```

- [ ] **Step 4: Commit**

```bash
git add backend/routes/stats.js
git commit -m "feat: include workout date in /api/stats/prs response"
```

---

### Task 2: Frontend — compute and render the recent-PRs section

**Files:**
- Modify: `frontend/src/pages/Stats.jsx:1-72` (add helper + derived value), `:73-95` (add rendered section)

- [ ] **Step 1: Add the `getRecentPr` helper next to `findBestSetByE1rm`**

In `frontend/src/pages/Stats.jsx`, right after the existing `findBestSetByE1rm` function (after line 17), add:

```js
function getRecentPr(sets, formula) {
  if (sets.length === 0) return null;
  const bestOverall = findBestSetByE1rm(sets, formula);
  const latestDate = sets.reduce(
    (latest, set) => (!latest || set.date > latest ? set.date : latest),
    null,
  );
  return bestOverall.date === latestDate ? bestOverall : null;
}
```

This assumes `bestOverall` and every set in `sets` carry a `date` field — true after Task 1's backend change, since `prs` (fetched from `/api/stats/prs`) is the only data source this function is called with.

- [ ] **Step 2: Add `recentPrRows` next to the existing `prRows` derived value**

In the `Stats` component, right after the existing `prRows` block (after line 59), add:

```js
  const recentPrRows = prs
    .map((pr) => {
      const recentPr = getRecentPr(pr.sets, formula);
      return recentPr ? { name: pr.name, ...recentPr } : null;
    })
    .filter(Boolean)
    .sort((rowA, rowB) => (rowA.date < rowB.date ? 1 : -1));
```

Sorting descending by date (most recent first) via string comparison — same ISO-string ordering assumption already used elsewhere (e.g. `getRecentPr`'s own `latestDate` reduction).

- [ ] **Step 3: Render the section above the existing table**

In the JSX returned by `Stats`, insert this block immediately after `<h1 className={styles.heading}>Stats</h1>` (before the existing `<table className={styles.table}>`):

```jsx
      {recentPrRows.length > 0 && (
        <div className={styles.recentPrSection}>
          <h2 className={styles.recentPrHeading}>Nedavno oboreni rekordi</h2>
          <div className={styles.recentPrList}>
            {recentPrRows.map((row) => (
              <button
                key={row.name}
                className={styles.recentPrRow}
                onClick={() => setSelectedExercise(row.name)}
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
```

This reuses `formatChartDate` (already defined in this file) and `setSelectedExercise` (already the state driving the chart section below) — no new state.

- [ ] **Step 4: Verify no syntax/lint errors**

Run: `cd frontend && npx eslint src/pages/Stats.jsx`
Expected: no output.

- [ ] **Step 5: Verify in the browser**

With the frontend dev server running (Vite HMR picks this up automatically — no restart needed, this is a frontend-only change), open the Stats page. Expected: a "Nedavno oboreni rekordi" section appears above the existing table, listing every exercise whose most-recent set is also its all-time best, each showing e1RM, best-set detail, and date. Clicking a row updates the exercise `<select>` and chart further down the page to that exercise.

If the section doesn't appear at all: check that at least one exercise's most-recent logged date actually holds its best e1RM (if you've been progressively improving and then had a bad day, that exercise won't show — this is expected per spec).

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/Stats.jsx
git commit -m "feat: add recent-PRs section to Stats page"
```

---

### Task 3: Frontend — style the recent-PRs section

**Files:**
- Modify: `frontend/src/pages/Stats.module.css` (append)

- [ ] **Step 1: Add the new classes**

Append to `frontend/src/pages/Stats.module.css`:

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
  justify-content: space-between;
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

.recentPrName {
  color: var(--color-text);
  font-size: 0.9rem;
  font-weight: 700;
  flex: 1;
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

Hover background (`#1a1a1a`) matches the same hardcoded hover shade already used in `Calendar.module.css`'s `.dayCell:hover` and `Dashboard.module.css`'s `.weekDayRow:hover`.

- [ ] **Step 2: Verify in the browser**

Vite HMR picks up the CSS change automatically. Expected: each recent-PR row looks like a card (red left border, dark background), name bold on the left, e1RM/set detail and date dimmed, with a lighter background on hover indicating it's clickable.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/Stats.module.css
git commit -m "style: recent-PRs section on Stats page"
```

---

## Self-review notes

- **Spec coverage:** every numbered requirement in the spec maps to a step above — new section above existing table (Task 2 Step 3), recent-PR definition incl. first-ever entries (Task 2 Step 1, no minimum-count check), date-descending sort (Task 2 Step 2), click-to-select (Task 2 Step 3's `onClick`), no date column added to the existing table (untouched), section hidden when empty (`recentPrRows.length > 0 &&` guard).
- **Placeholder scan:** none — every step has literal code.
- **Type/name consistency:** `getRecentPr`, `recentPrRows`, `formatChartDate`, `setSelectedExercise`, `E1RM_DECIMAL_PLACES` all match names already defined in the current `Stats.jsx` (verified by reading the file before writing this plan).
