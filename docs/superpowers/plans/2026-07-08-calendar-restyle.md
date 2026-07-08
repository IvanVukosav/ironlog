# Calendar Restyle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Commit workflow:** After each task, stage, show diff, commit directly (user has pre-approved autonomous execution).

**Goal:** Restyle `Calendar.jsx` — dark monospace month grid, nav buttons, workout days highlighted with red accent.

**Architecture:** One new `Calendar.module.css`. Inline styles removed and replaced with CSS module classes. No `composes`.

**Design decisions:**
- Nav buttons (`<` `>`) use the same transparent/red button style as other buttons but WITHOUT the `[ ]` bracket pseudo-elements — they're already arrow symbols.
- Workout day cells: `color: var(--color-accent)` (red number) + `border: 1px solid rgba(255, 59, 59, 0.3)` subtle red outline. Keeps the technical aesthetic without a harsh fill.
- Empty cells (null days for padding): blank, no border, no number.
- Day header row (Sun, Mon...): dim uppercase label style.

**Tech Stack:** Vite (CSS Modules), plain CSS, React 19.

---

### Task 1: Create `Calendar.module.css`

**Files:**
- Create: `frontend/src/pages/Calendar.module.css`

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

.monthNav {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1.25rem;
}

.navButton {
  background: transparent;
  border: none;
  color: var(--color-accent);
  font-family: var(--font-mono);
  font-size: 1rem;
  cursor: pointer;
  padding: 2px 4px;
  line-height: 1;
}

.monthLabel {
  font-family: var(--font-mono);
  font-size: 0.9rem;
  font-weight: 700;
  color: var(--color-text);
  letter-spacing: 0.05em;
}

.dayGrid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 4px;
}

.dayHeader {
  font-family: var(--font-mono);
  font-size: 0.65rem;
  color: var(--color-text-dim);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 4px 0;
}

.dayCell {
  font-family: var(--font-mono);
  font-size: 0.85rem;
  color: var(--color-text);
  padding: 6px 4px;
  min-height: 32px;
}

.dayCellWorkout {
  font-family: var(--font-mono);
  font-size: 0.85rem;
  color: var(--color-accent);
  padding: 6px 4px;
  min-height: 32px;
  border: 1px solid rgba(255, 59, 59, 0.3);
}
```

- [ ] **Step 2: Verify build**

Run from `frontend/`: `npm run build` — expected: success.

- [ ] **Step 3: Stage and commit**

```bash
git add frontend/src/pages/Calendar.module.css
git diff --cached
git commit -m "style: add Calendar page CSS module"
```

---

### Task 2: Wire `Calendar.jsx`

**Files:**
- Modify: `frontend/src/pages/Calendar.jsx`

- [ ] **Step 1: Replace the file**

Current:
```jsx
import { useState, useEffect } from "react";
import { fetchJson } from "../api";

function Calendar() {
  const [currentYear, setCurrentYear] = useState(new Date().getUTCFullYear());
  const [currentMonth, setCurrentMonth] = useState(new Date().getUTCMonth() + 1);
  const [workoutDates, setWorkoutDates] = useState([]);

  useEffect(() => {
    fetchJson(
      `/api/workouts/month?year=${currentYear}&month=${currentMonth}`,
    )
      .then((data) => setWorkoutDates(data))
      .catch((err) => console.error(err));
  }, [currentYear, currentMonth]);

  const firstDay = new Date(Date.UTC(currentYear, currentMonth - 1, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(currentYear, currentMonth, 0)).getUTCDate();
  const workoutDayNumbers = workoutDates.map((date) =>
    new Date(date).getUTCDate(),
  );

  const prevMonth = () => {
    if (currentMonth === 1) {
      setCurrentMonth(12);
      setCurrentYear(currentYear - 1);
    } else setCurrentMonth(currentMonth - 1);
  };

  const nextMonth = () => {
    if (currentMonth === 12) {
      setCurrentMonth(1);
      setCurrentYear(currentYear + 1);
    } else setCurrentMonth(currentMonth + 1);
  };

  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let day = 1; day <= daysInMonth; day++) cells.push(day);

  return (
    <div className="page">
      <h1>Calendar</h1>
      <div>
        <button onClick={prevMonth}>&lt;</button>
        <span>
          {" "}
          {currentYear}-{String(currentMonth).padStart(2, "0")}{" "}
        </span>
        <button onClick={nextMonth}>&gt;</button>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(7, 1fr)",
          gap: "4px",
          marginTop: "16px",
        }}>
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
          <div key={day}>
            <strong>{day}</strong>
          </div>
        ))}
        {cells.map((day, i) => (
          <div
            key={i}
            style={{
              background:
                day && workoutDayNumbers.includes(day)
                  ? "green"
                  : "transparent",
            }}>
            {day || ""}
          </div>
        ))}
      </div>
    </div>
  );
}

export default Calendar;
```

Replace with:
```jsx
import { useState, useEffect } from "react";
import { fetchJson } from "../api";
import styles from "./Calendar.module.css";

function Calendar() {
  const [currentYear, setCurrentYear] = useState(new Date().getUTCFullYear());
  const [currentMonth, setCurrentMonth] = useState(new Date().getUTCMonth() + 1);
  const [workoutDates, setWorkoutDates] = useState([]);

  useEffect(() => {
    fetchJson(
      `/api/workouts/month?year=${currentYear}&month=${currentMonth}`,
    )
      .then((data) => setWorkoutDates(data))
      .catch((err) => console.error(err));
  }, [currentYear, currentMonth]);

  const firstDay = new Date(Date.UTC(currentYear, currentMonth - 1, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(currentYear, currentMonth, 0)).getUTCDate();
  const workoutDayNumbers = workoutDates.map((date) =>
    new Date(date).getUTCDate(),
  );

  const prevMonth = () => {
    if (currentMonth === 1) {
      setCurrentMonth(12);
      setCurrentYear(currentYear - 1);
    } else setCurrentMonth(currentMonth - 1);
  };

  const nextMonth = () => {
    if (currentMonth === 12) {
      setCurrentMonth(1);
      setCurrentYear(currentYear + 1);
    } else setCurrentMonth(currentMonth + 1);
  };

  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let day = 1; day <= daysInMonth; day++) cells.push(day);

  return (
    <div className={styles.page}>
      <h1 className={styles.heading}>Calendar</h1>
      <div className={styles.monthNav}>
        <button className={styles.navButton} onClick={prevMonth}>&lt;</button>
        <span className={styles.monthLabel}>
          {currentYear}-{String(currentMonth).padStart(2, "0")}
        </span>
        <button className={styles.navButton} onClick={nextMonth}>&gt;</button>
      </div>
      <div className={styles.dayGrid}>
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
          <div key={day} className={styles.dayHeader}>{day}</div>
        ))}
        {cells.map((day, index) => (
          <div
            key={index}
            className={
              day && workoutDayNumbers.includes(day)
                ? styles.dayCellWorkout
                : styles.dayCell
            }
          >
            {day || ""}
          </div>
        ))}
      </div>
    </div>
  );
}

export default Calendar;
```

- [ ] **Step 2: Verify build**

Run from `frontend/`: `npm run build` — expected: success.

- [ ] **Step 3: Stage and commit**

```bash
git add frontend/src/pages/Calendar.jsx
git diff --cached
git commit -m "style: apply CSS module styles to Calendar"
```
