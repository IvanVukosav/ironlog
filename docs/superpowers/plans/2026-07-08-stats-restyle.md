# Stats Restyle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Commit workflow:** After each task, stage, show diff, commit directly (user has pre-approved autonomous execution).

**Goal:** Restyle `Stats.jsx` — dark monospace table for PR data (Exercise, Max Weight, Reps).

**Architecture:** One new `Stats.module.css`. No `composes`. `Stats.jsx` gets import and `styles.*` classNames.

**Tech Stack:** Vite (CSS Modules), plain CSS, React 19.

---

### Task 1: Create `Stats.module.css`

**Files:**
- Create: `frontend/src/pages/Stats.module.css`

- [ ] **Step 1: Create the file**

```css
.page {
  padding: 1.5rem;
}

.heading {
  font-family: var(--font-mono);
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--color-text);
  margin-bottom: 1rem;
}

.table {
  width: 100%;
  border-collapse: collapse;
  font-family: var(--font-mono);
  font-size: 0.85rem;
}

.table th {
  color: var(--color-text-dim);
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  text-align: left;
  padding: 0.5rem 1.5rem 0.5rem 0;
  border-bottom: 1px solid var(--color-border);
  font-weight: 400;
}

.table td {
  color: var(--color-text);
  padding: 0.5rem 1.5rem 0.5rem 0;
  border-bottom: 1px solid var(--color-border-subtle);
}

.table tr:last-child td {
  border-bottom: none;
}
```

- [ ] **Step 2: Verify build**

Run from `frontend/`: `npm run build` — expected: success.

- [ ] **Step 3: Stage and commit**

```bash
git add frontend/src/pages/Stats.module.css
git diff --cached
git commit -m "style: add Stats page CSS module"
```

---

### Task 2: Wire `Stats.jsx`

**Files:**
- Modify: `frontend/src/pages/Stats.jsx`

- [ ] **Step 1: Replace the file**

Current:
```jsx
import { useState, useEffect } from "react";
import { fetchJson } from "../api";

function Stats() {
  const [prs, setPrs] = useState([]);

  useEffect(() => {
    fetchJson("/api/stats/prs")
      .then((data) => setPrs(data))
      .catch((err) => console.error(err));
  }, []);

  return (
    <div className="page">
      <h1>Stats</h1>
      <table>
        <thead>
          <tr>
            <th>Exercise</th>
            <th>Max Weight</th>
            <th>Reps</th>
          </tr>
        </thead>
        <tbody>
          {prs.map((pr) => (
            <tr key={pr.name + pr.weight}>
              <td>{pr.name}</td>
              <td>{pr.weight}kg</td>
              <td>{pr.reps}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default Stats;
```

Replace with:
```jsx
import { useState, useEffect } from "react";
import { fetchJson } from "../api";
import styles from "./Stats.module.css";

function Stats() {
  const [prs, setPrs] = useState([]);

  useEffect(() => {
    fetchJson("/api/stats/prs")
      .then((data) => setPrs(data))
      .catch((err) => console.error(err));
  }, []);

  return (
    <div className={styles.page}>
      <h1 className={styles.heading}>Stats</h1>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Exercise</th>
            <th>Max Weight</th>
            <th>Reps</th>
          </tr>
        </thead>
        <tbody>
          {prs.map((pr) => (
            <tr key={pr.name + pr.weight}>
              <td>{pr.name}</td>
              <td>{pr.weight}kg</td>
              <td>{pr.reps}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default Stats;
```

- [ ] **Step 2: Verify build**

Run from `frontend/`: `npm run build` — expected: success.

- [ ] **Step 3: Stage and commit**

```bash
git add frontend/src/pages/Stats.jsx
git diff --cached
git commit -m "style: apply CSS module styles to Stats"
```
