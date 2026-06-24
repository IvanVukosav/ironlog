# Dashboard Restyle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle `Dashboard.jsx` with a dark, monospace, "technical/data-driven" look — a 2-column card grid with red left-border accents — using CSS Modules and CSS custom properties, per `docs/superpowers/specs/2026-06-24-dashboard-restyle-design.md`.

**Architecture:** Color/font tokens become CSS custom properties in `index.css`. A new shared CSS module (`frontend/src/styles/shared.module.css`) holds the reusable card/label/value look. `Dashboard.module.css` composes those shared classes and adds the page-specific grid layout. `Dashboard.jsx` imports the module and applies the classes — no other pages or components are touched in this plan.

**Tech Stack:** Vite (native CSS Modules support, no new dependency), plain CSS, React 19.

**Note on testing:** This repo has no test framework configured (`npm test` is a placeholder, no Jest/Vitest/Playwright installed) and this is a pure CSS/markup change with no business logic. Verification in this plan is: (1) `npm run build` after each file change, to catch syntax errors, bad imports, or broken `composes` references, and (2) a manual visual check via `npm run dev` at the end. Do not introduce a testing framework as part of this plan — out of scope.

---

### Task 1: Add design tokens to `index.css`

**Files:**
- Modify: `frontend/src/index.css`

- [ ] **Step 1: Add the `:root` custom properties block**

Current file (`frontend/src/index.css`):

```css
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  background-color: #0d0d0d;
  color: #f0f0f0;
  font-family: system-ui, sans-serif;
  min-height: 100vh;
}

#root {
  min-height: 100vh;
}

a {
  color: inherit;
  text-decoration: none;
}
```

Replace it with:

```css
:root {
  --color-bg: #0d0d0d;
  --color-bg-card: #141414;
  --color-accent: #ff3b3b;
  --color-text: #f0f0f0;
  --color-text-dim: #666;
  --font-mono: ui-monospace, "Cascadia Code", "Consolas", monospace;
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  background-color: var(--color-bg);
  color: var(--color-text);
  font-family: system-ui, sans-serif;
  min-height: 100vh;
}

#root {
  min-height: 100vh;
}

a {
  color: inherit;
  text-decoration: none;
}
```

- [ ] **Step 2: Verify the build still passes**

Run: `npm run build` (from `frontend/`)
Expected: build succeeds with no errors (this is a pure CSS edit — only the visible colors change, nothing should break).

- [ ] **Step 3: Commit**

```bash
git add frontend/src/index.css
git commit -m "style: add CSS custom properties for color/font tokens"
```

---

### Task 2: Create the shared card styles and the Dashboard CSS module

**Files:**
- Create: `frontend/src/styles/shared.module.css`
- Create: `frontend/src/pages/Dashboard.module.css`

- [ ] **Step 1: Create the shared module**

Create `frontend/src/styles/shared.module.css`:

```css
.card {
  background-color: var(--color-bg-card);
  border-left: 3px solid var(--color-accent);
  padding: 1rem;
  font-family: var(--font-mono);
}

.label {
  color: var(--color-text-dim);
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.value {
  color: var(--color-text);
  font-size: 1.2rem;
  font-weight: 700;
  margin-top: 0.25rem;
}
```

- [ ] **Step 2: Create the Dashboard module, composing from the shared module**

Create `frontend/src/pages/Dashboard.module.css`:

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

.grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.card {
  composes: card from "../styles/shared.module.css";
}

.label {
  composes: label from "../styles/shared.module.css";
}

.value {
  composes: value from "../styles/shared.module.css";
}

.fullWidth {
  grid-column: span 2;
}
```

- [ ] **Step 3: Verify the build still passes**

Run: `npm run build` (from `frontend/`)
Expected: build succeeds. Neither new file is imported anywhere yet, so this only confirms there's no CSS syntax error or bad `composes` path.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/styles/shared.module.css frontend/src/pages/Dashboard.module.css
git commit -m "style: add shared card styles and Dashboard CSS module"
```

---

### Task 3: Wire `Dashboard.jsx` to the new styles

**Files:**
- Modify: `frontend/src/pages/Dashboard.jsx`

- [ ] **Step 1: Replace the file contents**

Current file (`frontend/src/pages/Dashboard.jsx`):

```jsx
import { useState, useEffect } from "react";
import { fetchJson } from "../api";

function Dashboard() {
  const [workout, setWorkout] = useState(null);
  const [nutritionDay, setNutritionDay] = useState(null);
  const [settings, setSettings] = useState(null);

  const today = new Date().toISOString().split("T")[0];

  useEffect(() => {
    fetchJson(`/api/workouts?date=${today}`)
      .then((data) => setWorkout(data[0] || null))
      .catch((err) => console.error(err));

    fetchJson(`/api/nutrition?date=${today}`)
      .then((data) => setNutritionDay(data[0] || null))
      .catch((err) => console.error(err));

    fetchJson("/api/settings")
      .then((data) => setSettings(data))
      .catch((err) => console.error(err));
  }, []);

  const allItems = nutritionDay?.meals?.flatMap((m) => m.items) || [];
  const totalKcal = allItems.reduce((sum, item) => sum + item.kcal, 0);

  return (
    <div className="page">
      <h1>Dashboard</h1>
      {(settings?.showWorkoutWidget ?? true) && (
        <div>
          <h2>Trening danas</h2>
          {workout ? (
            <p>Vježbe: {workout.exercises?.length}</p>
          ) : (
            <p>Nema treninga</p>
          )}
        </div>
      )}
      {(settings?.showNutritionWidget ?? true) && (
        <div>
          <h2>Prehrana danas</h2>
          <p>
            {totalKcal} / {settings?.kcalGoal || "?"} kcal
          </p>
        </div>
      )}

      <div>
        <h2>Tjedni napredak</h2>
        <p>Cilj: {settings?.trainingsPerWeek} treninga tjedno</p>
      </div>
    </div>
  );
}

export default Dashboard;
```

Replace it with:

```jsx
import { useState, useEffect } from "react";
import { fetchJson } from "../api";
import styles from "./Dashboard.module.css";

function Dashboard() {
  const [workout, setWorkout] = useState(null);
  const [nutritionDay, setNutritionDay] = useState(null);
  const [settings, setSettings] = useState(null);

  const today = new Date().toISOString().split("T")[0];

  useEffect(() => {
    fetchJson(`/api/workouts?date=${today}`)
      .then((data) => setWorkout(data[0] || null))
      .catch((err) => console.error(err));

    fetchJson(`/api/nutrition?date=${today}`)
      .then((data) => setNutritionDay(data[0] || null))
      .catch((err) => console.error(err));

    fetchJson("/api/settings")
      .then((data) => setSettings(data))
      .catch((err) => console.error(err));
  }, []);

  const allItems = nutritionDay?.meals?.flatMap((m) => m.items) || [];
  const totalKcal = allItems.reduce((sum, item) => sum + item.kcal, 0);

  return (
    <div className={styles.page}>
      <h1 className={styles.heading}>Dashboard</h1>
      <div className={styles.grid}>
        {(settings?.showWorkoutWidget ?? true) && (
          <div className={styles.card}>
            <h2 className={styles.label}>Trening danas</h2>
            {workout ? (
              <p className={styles.value}>
                Vježbe: {workout.exercises?.length}
              </p>
            ) : (
              <p className={styles.value}>Nema treninga</p>
            )}
          </div>
        )}
        {(settings?.showNutritionWidget ?? true) && (
          <div className={styles.card}>
            <h2 className={styles.label}>Prehrana danas</h2>
            <p className={styles.value}>
              {totalKcal} / {settings?.kcalGoal || "?"} kcal
            </p>
          </div>
        )}
        <div className={`${styles.card} ${styles.fullWidth}`}>
          <h2 className={styles.label}>Tjedni napredak</h2>
          <p className={styles.value}>
            Cilj: {settings?.trainingsPerWeek} treninga tjedno
          </p>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
```

- [ ] **Step 2: Verify the build passes**

Run: `npm run build` (from `frontend/`)
Expected: build succeeds with no errors (confirms `Dashboard.module.css` resolves and `composes` works).

- [ ] **Step 3: Manually verify in the browser**

Run: `npm run dev` (from `frontend/`), open the printed local URL (e.g. `http://localhost:5173`), and navigate to `/` (Dashboard).

Confirm:
- "Trening danas" and "Prehrana danas" cards sit side by side in a 2-column grid.
- "Tjedni napredak" spans the full width of the row below them.
- All three cards have a dark background (`#141414`) with a red left border (`#ff3b3b`).
- Headings, labels, and values all render in a monospace font.

If you cannot drive a real browser in your environment (no Playwright/Puppeteer/chromium-cli installed), say so explicitly instead of claiming visual confirmation — `npm run build` passing is not the same as the layout looking right. Ask the user to confirm visually if you can't.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/Dashboard.jsx
git commit -m "style: apply CSS module styles to Dashboard"
```

---

## Self-Review Notes

- **Spec coverage:** visual style (Task 2 shared module + Task 1 tokens), layout (Task 2 `.grid`/`.fullWidth` + Task 3 wiring), CSS Modules + `composes` (Task 2), CSS custom properties (Task 1), scope limited to Dashboard only (no other files touched) — all covered.
- **Out of scope, confirmed not touched:** `Navbar.jsx`/`Navbar.css`, `Log.jsx`, `Nutrition.jsx`, `Calendar.jsx`, `Calculator.jsx`, `Stats.jsx`, `Settings.jsx`.
