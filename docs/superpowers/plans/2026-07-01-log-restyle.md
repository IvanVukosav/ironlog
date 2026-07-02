# Log Restyle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Important — commit workflow:** After staging each task's files, run `git diff --cached` and **STOP**. Report the full staged diff output to the controller and wait for explicit confirmation before running `git commit`. Do not self-commit.

**Goal:** Restyle `Log.jsx` and `ExerciseCard.jsx` with the same dark/monospace/"technical" look as Dashboard — bracket-style buttons, underline inputs with red focus, exercise cards with red left border, and per-set delete X positioned top-right of each set row.

**Architecture:** Two new CSS custom property tokens in `index.css`. Two new reusable primitives (`.button`, `.input`) added to the existing `shared.module.css`. New `Log.module.css` and `ExerciseCard.module.css` compose from `shared.module.css` via CSS Modules `composes`. Both JSX files are updated to use the module classes — no business logic changes anywhere.

**Tech Stack:** Vite (native CSS Modules), plain CSS, React 19. No test framework in this repo — verification is `npm run build` after each file change, plus a final visual check via `npm run dev`.

**Spec:** `docs/superpowers/specs/2026-06-24-log-restyle-design.md`

---

### Task 1: Extend design tokens and shared primitives

**Files:**
- Modify: `frontend/src/index.css`
- Modify: `frontend/src/styles/shared.module.css`

- [ ] **Step 1: Add two new tokens to `index.css`**

Current `:root` block in `frontend/src/index.css`:

```css
:root {
  --color-bg: #0d0d0d;
  --color-bg-card: #141414;
  --color-accent: #ff3b3b;
  --color-text: #f0f0f0;
  --color-text-dim: #666;
  --font-mono: ui-monospace, "Cascadia Code", "Consolas", monospace;
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
  --color-border: #444;
  --color-border-subtle: #222;
}
```

- [ ] **Step 2: Add `.button` and `.input` to `shared.module.css`**

Append to the end of `frontend/src/styles/shared.module.css` (do not change or remove the existing `.card`, `.label`, `.value` blocks):

```css
.button {
  background: transparent;
  border: none;
  color: var(--color-accent);
  font-family: var(--font-mono);
  font-size: 0.85rem;
  cursor: pointer;
  padding: 4px 0;
}

.button::before {
  content: "[ ";
}

.button::after {
  content: " ]";
}

.input {
  background: transparent;
  border: none;
  border-bottom: 1px solid var(--color-border);
  color: var(--color-text);
  font-family: var(--font-mono);
  font-size: 0.85rem;
  padding: 4px 2px;
  outline: none;
}

.input::placeholder {
  color: var(--color-text-dim);
}

.input:focus {
  border-bottom-color: var(--color-accent);
}
```

- [ ] **Step 3: Verify the build passes**

Run from `frontend/`:
```
npm run build
```
Expected: build succeeds, no errors. Neither file is yet imported anywhere new, so this only confirms no CSS syntax errors.

- [ ] **Step 4: Stage and show diff for review**

```bash
git add frontend/src/index.css frontend/src/styles/shared.module.css
git diff --cached
```

**STOP. Report the diff above to the controller. Do not run `git commit`. Wait for the controller to confirm before committing.**

After confirmation, run:
```bash
git commit -m "style: add border tokens and shared button/input primitives"
```

---

### Task 2: Create `Log.module.css`

**Files:**
- Create: `frontend/src/pages/Log.module.css`

- [ ] **Step 1: Create the file**

Create `frontend/src/pages/Log.module.css` with this exact content:

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

.topRow {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1.25rem;
  flex-wrap: wrap;
}

.dateInput {
  composes: input from "../styles/shared.module.css";
  width: 150px;
}

.meta {
  color: var(--color-text-dim);
  font-family: var(--font-mono);
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.startButton {
  composes: button from "../styles/shared.module.css";
}

.addRow {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.exerciseInput {
  composes: input from "../styles/shared.module.css";
  width: 200px;
}

.addButton {
  composes: button from "../styles/shared.module.css";
}

.cardList {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
```

- [ ] **Step 2: Verify the build passes**

Run from `frontend/`:
```
npm run build
```
Expected: build succeeds. The file is not yet imported anywhere, so this only confirms no CSS syntax errors and no bad `composes` path.

- [ ] **Step 3: Stage and show diff for review**

```bash
git add frontend/src/pages/Log.module.css
git diff --cached
```

**STOP. Report the diff above to the controller. Do not run `git commit`. Wait for confirmation.**

After confirmation:
```bash
git commit -m "style: add Log page CSS module"
```

---

### Task 3: Create `ExerciseCard.module.css`

**Files:**
- Create: `frontend/src/components/ExerciseCard.module.css`

- [ ] **Step 1: Create the file**

Create `frontend/src/components/ExerciseCard.module.css` with this exact content:

```css
.card {
  composes: card from "../styles/shared.module.css";
}

.heading {
  font-family: var(--font-mono);
  font-size: 1rem;
  font-weight: 700;
  color: var(--color-text);
  margin-bottom: 0.75rem;
  letter-spacing: 0.03em;
}

.inputRow {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
  flex-wrap: wrap;
}

.setInput {
  composes: input from "../styles/shared.module.css";
  width: 80px;
}

.addSetButton {
  composes: button from "../styles/shared.module.css";
}

.setList {
  margin-top: 0.25rem;
}

.setRow {
  position: relative;
  padding: 6px 28px 6px 0;
  border-bottom: 1px solid var(--color-border-subtle);
  font-family: var(--font-mono);
  font-size: 0.85rem;
  color: var(--color-text-dim);
}

.setRow:last-child {
  border-bottom: none;
}

.deleteSet {
  position: absolute;
  top: 6px;
  right: 0;
  background: none;
  border: none;
  color: var(--color-text-dim);
  font-family: var(--font-mono);
  font-size: 0.8rem;
  cursor: pointer;
  padding: 0;
  line-height: 1;
}

.deleteSet:hover {
  color: var(--color-accent);
}
```

- [ ] **Step 2: Verify the build passes**

Run from `frontend/`:
```
npm run build
```
Expected: build succeeds. The `composes` path `../styles/shared.module.css` is correct from the `components/` directory — confirms it resolves.

- [ ] **Step 3: Stage and show diff for review**

```bash
git add frontend/src/components/ExerciseCard.module.css
git diff --cached
```

**STOP. Report the diff above to the controller. Do not run `git commit`. Wait for confirmation.**

After confirmation:
```bash
git commit -m "style: add ExerciseCard CSS module"
```

---

### Task 4: Wire `Log.jsx` and `ExerciseCard.jsx`

**Files:**
- Modify: `frontend/src/pages/Log.jsx`
- Modify: `frontend/src/components/ExerciseCard.jsx`

- [ ] **Step 1: Replace `Log.jsx`**

Current file (`frontend/src/pages/Log.jsx`):

```jsx
import { useState, useEffect } from "react";
import ExerciseCard from "../components/ExerciseCard";
import { fetchJson } from "../api";

function Log() {
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [workout, setWorkout] = useState(null);
  const [exerciseName, setExerciseName] = useState("");

  useEffect(() => {
    fetchJson(`/api/workouts?date=${date}`)
      .then((data) => setWorkout(data[0] || null))
      .catch((err) => console.error(err));
  }, [date]);

  const createWorkout = () => {
    fetchJson("/api/workouts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date }),
    })
      .then((data) => setWorkout(data))
      .catch((err) => console.error(err));
  };

  const addExercise = () => {
    if (!exerciseName.trim()) return;
    if (workout.exercises?.some((e) => e.name === exerciseName)) return;

    fetchJson(`/api/workouts/${workout.id}/exercises`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: exerciseName }),
    })
      .then((data) => {
        setWorkout((prev) => ({
          ...prev,
          exercises: [...(prev.exercises || []), { ...data, sets: [] }],
        }));
        setExerciseName("");
      })
      .catch((err) => console.error(err));
  };

  return (
    <div className="page">
      <h1>Log treninga</h1>

      <input
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
      />

      {!workout && (
        <button onClick={createWorkout}>Započni trening</button>
      )}

      {workout && <p>Workout ID: {workout.id}</p>}

      {workout && (
        <div>
          <input
            type="text"
            placeholder="Ime vježbe"
            value={exerciseName}
            onChange={(e) => setExerciseName(e.target.value)}
          />

          <button onClick={addExercise}>Dodaj vježbu</button>

          {workout.exercises?.map((exercise) => (
            <ExerciseCard
              key={exercise.id}
              exercise={exercise}
              onDeleteSet={(setId) =>
                setWorkout((prev) => ({
                  ...prev,
                  exercises: prev.exercises.map((e) =>
                    e.id === exercise.id
                      ? { ...e, sets: e.sets.filter((s) => s.id !== setId) }
                      : e,
                  ),
                }))
              }
              onAddSet={(data) =>
                setWorkout((prev) => ({
                  ...prev,
                  exercises: prev.exercises.map((e) =>
                    e.id === exercise.id
                      ? { ...e, sets: [...(e.sets || []), data] }
                      : e,
                  ),
                }))
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default Log;
```

Replace with:

```jsx
import { useState, useEffect } from "react";
import ExerciseCard from "../components/ExerciseCard";
import { fetchJson } from "../api";
import styles from "./Log.module.css";

function Log() {
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [workout, setWorkout] = useState(null);
  const [exerciseName, setExerciseName] = useState("");

  useEffect(() => {
    fetchJson(`/api/workouts?date=${date}`)
      .then((data) => setWorkout(data[0] || null))
      .catch((err) => console.error(err));
  }, [date]);

  const createWorkout = () => {
    fetchJson("/api/workouts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date }),
    })
      .then((data) => setWorkout(data))
      .catch((err) => console.error(err));
  };

  const addExercise = () => {
    if (!exerciseName.trim()) return;
    if (workout.exercises?.some((exercise) => exercise.name === exerciseName)) return;

    fetchJson(`/api/workouts/${workout.id}/exercises`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: exerciseName }),
    })
      .then((data) => {
        setWorkout((prev) => ({
          ...prev,
          exercises: [...(prev.exercises || []), { ...data, sets: [] }],
        }));
        setExerciseName("");
      })
      .catch((err) => console.error(err));
  };

  return (
    <div className={styles.page}>
      <h1 className={styles.heading}>Log treninga</h1>

      <div className={styles.topRow}>
        <input
          type="date"
          className={styles.dateInput}
          value={date}
          onChange={(event) => setDate(event.target.value)}
        />
        {workout && (
          <span className={styles.meta}>Workout ID: {workout.id}</span>
        )}
      </div>

      {!workout && (
        <button className={styles.startButton} onClick={createWorkout}>
          Započni trening
        </button>
      )}

      {workout && (
        <div>
          <div className={styles.addRow}>
            <input
              type="text"
              className={styles.exerciseInput}
              placeholder="Ime vježbe"
              value={exerciseName}
              onChange={(event) => setExerciseName(event.target.value)}
            />
            <button className={styles.addButton} onClick={addExercise}>
              Dodaj vježbu
            </button>
          </div>

          <div className={styles.cardList}>
            {workout.exercises?.map((exercise) => (
              <ExerciseCard
                key={exercise.id}
                exercise={exercise}
                onDeleteSet={(setId) =>
                  setWorkout((prev) => ({
                    ...prev,
                    exercises: prev.exercises.map((currentExercise) =>
                      currentExercise.id === exercise.id
                        ? {
                            ...currentExercise,
                            sets: currentExercise.sets.filter(
                              (currentSet) => currentSet.id !== setId,
                            ),
                          }
                        : currentExercise,
                    ),
                  }))
                }
                onAddSet={(data) =>
                  setWorkout((prev) => ({
                    ...prev,
                    exercises: prev.exercises.map((currentExercise) =>
                      currentExercise.id === exercise.id
                        ? {
                            ...currentExercise,
                            sets: [...(currentExercise.sets || []), data],
                          }
                        : currentExercise,
                    ),
                  }))
                }
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default Log;
```

- [ ] **Step 2: Replace `ExerciseCard.jsx`**

Current file (`frontend/src/components/ExerciseCard.jsx`):

```jsx
import { useState } from "react";
import { fetchJson } from "../api";

function Exercise({ exercise, onAddSet, onDeleteSet }) {
  const [set, setSet] = useState({ weight: "", reps: "", rpe: "" });

  const addSet = (exerciseId) => {
    fetchJson(`/api/workouts/exercises/${exerciseId}/sets`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(set),
    })
      .then((data) => {
        onAddSet(data);
        setSet({ weight: "", reps: "", rpe: "" });
      })
      .catch((err) => console.error(err));
  };

  const deleteSet = (setId) => {
    fetchJson(`/api/workouts/sets/${setId}`, {
      method: "DELETE",
    })
      .then(() => onDeleteSet(setId))
      .catch((err) => console.error(err));
  };

  return (
    <>
      <h3>{exercise.name}</h3>
      <input
        type="text"
        placeholder="Kilaza"
        value={set.weight}
        onChange={(e) =>
          setSet((prev) => ({ ...prev, weight: e.target.value }))
        }></input>

      <input
        type="text"
        placeholder="Broj ponavljanja"
        value={set.reps}
        onChange={(e) =>
          setSet((prev) => ({ ...prev, reps: e.target.value }))
        }></input>

      <input
        type="text"
        placeholder="Rpe"
        value={set.rpe}
        onChange={(e) =>
          setSet((prev) => ({ ...prev, rpe: e.target.value }))
        }></input>

      <button onClick={() => addSet(exercise.id)}>Dodaj set</button>

      {exercise.sets?.map((s) => (
        <p key={s.id}>
          {s.weight}kg — {s.reps} reps @ RPE {s.rpe}
          <button onClick={() => deleteSet(s.id)}>X</button>
        </p>
      ))}
    </>
  );
}

export default Exercise;
```

Replace with:

```jsx
import { useState } from "react";
import { fetchJson } from "../api";
import styles from "./ExerciseCard.module.css";

function Exercise({ exercise, onAddSet, onDeleteSet }) {
  const [set, setSet] = useState({ weight: "", reps: "", rpe: "" });

  const addSet = (exerciseId) => {
    fetchJson(`/api/workouts/exercises/${exerciseId}/sets`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(set),
    })
      .then((data) => {
        onAddSet(data);
        setSet({ weight: "", reps: "", rpe: "" });
      })
      .catch((err) => console.error(err));
  };

  const deleteSet = (setId) => {
    fetchJson(`/api/workouts/sets/${setId}`, {
      method: "DELETE",
    })
      .then(() => onDeleteSet(setId))
      .catch((err) => console.error(err));
  };

  return (
    <div className={styles.card}>
      <h3 className={styles.heading}>{exercise.name}</h3>
      <div className={styles.inputRow}>
        <input
          type="text"
          className={styles.setInput}
          placeholder="Kilaza"
          value={set.weight}
          onChange={(event) =>
            setSet((prev) => ({ ...prev, weight: event.target.value }))
          }
        />
        <input
          type="text"
          className={styles.setInput}
          placeholder="Broj ponavljanja"
          value={set.reps}
          onChange={(event) =>
            setSet((prev) => ({ ...prev, reps: event.target.value }))
          }
        />
        <input
          type="text"
          className={styles.setInput}
          placeholder="Rpe"
          value={set.rpe}
          onChange={(event) =>
            setSet((prev) => ({ ...prev, rpe: event.target.value }))
          }
        />
        <button
          className={styles.addSetButton}
          onClick={() => addSet(exercise.id)}
        >
          Dodaj set
        </button>
      </div>
      <div className={styles.setList}>
        {exercise.sets?.map((workoutSet) => (
          <div key={workoutSet.id} className={styles.setRow}>
            {workoutSet.weight}kg — {workoutSet.reps} reps @ RPE {workoutSet.rpe}
            <button
              className={styles.deleteSet}
              onClick={() => deleteSet(workoutSet.id)}
            >
              X
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default Exercise;
```

- [ ] **Step 3: Verify the build passes**

Run from `frontend/`:
```
npm run build
```
Expected: build succeeds. Module count increases (2 new CSS module imports now active). No errors confirms `composes` chain resolves end-to-end.

- [ ] **Step 4: Visual check**

Run from `frontend/`:
```
npm run dev
```
Open the printed URL and navigate to `/log`. Confirm:
- Page heading "Log treninga" renders in monospace.
- Date input has underline only, no box; turns red on focus with no browser glow.
- "Započni trening" appears as `[ Započni trening ]` bracket text when no workout.
- After starting a workout: exercise name input + `[ Dodaj vježbu ]` appear.
- Each exercise card has `#141414` background with red left border.
- Set inputs render as underline-only, bracket "Dodaj set" button.
- Each logged set row shows the X delete button top-right of its row.

If you cannot drive a real browser (no Playwright/chromium-cli), state that explicitly — `npm run build` passing is not the same as the layout looking correct. The user will do the visual confirmation.

- [ ] **Step 5: Stage and show diff for review**

```bash
git add frontend/src/pages/Log.jsx frontend/src/components/ExerciseCard.jsx
git diff --cached
```

**STOP. Report the diff above to the controller. Do not run `git commit`. Wait for confirmation.**

After confirmation:
```bash
git commit -m "style: apply CSS module styles to Log and ExerciseCard"
```

---

## Self-Review Notes

- **Spec coverage:**
  - Bracket buttons → `.button` in shared + `composes` in Log/ExerciseCard modules ✓
  - Underline inputs with red focus + no browser glow → `.input` in shared ✓
  - Set row X top-right → `.setRow` (relative) + `.deleteSet` (absolute top right) ✓
  - `--color-border` / `--color-border-subtle` tokens → Task 1 ✓
  - `.button` / `.input` in shared.module.css for future reuse → Task 1 ✓
  - Log.jsx page layout (heading, topRow, addRow, cardList) → Task 2 ✓
  - ExerciseCard card/heading/inputRow/setList → Task 3 ✓
  - Both JSX files wired → Task 4 ✓
  - No business logic changes (only classNames/markup/import) → confirmed in Task 4 replacements ✓
  - Workout ID text stays as "Workout ID: {workout.id}" (not reworded) → Task 4 ✓
  - Out of scope: delete exercise, edit set, other pages → not present in any task ✓
- **Abbreviations:** `e` → `exercise`/`currentExercise`, `s` → `workoutSet`, `(e) =>` onChange → `(event) =>` throughout ✓
- **composes paths:** `"../styles/shared.module.css"` correct from both `pages/` and `components/` directories ✓
- **Type consistency:** class names used in JSX (`styles.page`, `styles.heading`, `styles.topRow`, `styles.dateInput`, `styles.meta`, `styles.startButton`, `styles.addRow`, `styles.exerciseInput`, `styles.addButton`, `styles.cardList`) all defined in Log.module.css ✓. ExerciseCard JSX names (`styles.card`, `styles.heading`, `styles.inputRow`, `styles.setInput`, `styles.addSetButton`, `styles.setList`, `styles.setRow`, `styles.deleteSet`) all defined in ExerciseCard.module.css ✓
