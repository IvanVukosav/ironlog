# Nutrition Restyle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Commit workflow:** After staging each task's files, run `git diff --cached` and **STOP**. Report the full staged diff to the controller. Do NOT run `git commit`. Wait for the controller to confirm with the user before committing.

**Goal:** Restyle `Nutrition.jsx` with the same dark/monospace/bracket-button look as Log and Dashboard — meal cards with red left border, underline inputs, bracket buttons, food item rows with separator.

**Architecture:** One new CSS module (`Nutrition.module.css`) with all styles written directly (no `composes`). `Nutrition.jsx` gets the module import and `styles.*` classNames. All business logic stays unchanged.

**Tech Stack:** Vite (CSS Modules), plain CSS, React 19. No test framework — verification is `npm run build` + visual check via `npm run dev`.

**Spec:** `docs/superpowers/specs/2026-07-05-nutrition-restyle-design.md`

---

### Task 1: Create `Nutrition.module.css`

**Files:**
- Create: `frontend/src/pages/Nutrition.module.css`

- [ ] **Step 1: Create the file**

Create `frontend/src/pages/Nutrition.module.css` with this exact content:

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

/* date inputs use browser-rendered date mask, not CSS ::placeholder */
.dateInput {
  background: transparent;
  border: none;
  border-bottom: 1px solid var(--color-border);
  color: var(--color-text);
  font-family: var(--font-mono);
  font-size: 0.85rem;
  padding: 4px 2px;
  outline: none;
  width: 150px;
}

.dateInput:focus {
  border-bottom-color: var(--color-accent);
}

.startButton {
  background: transparent;
  border: none;
  color: var(--color-accent);
  font-family: var(--font-mono);
  font-size: 0.85rem;
  cursor: pointer;
  padding: 4px 0;
}

.startButton::before {
  content: "[ ";
}

.startButton::after {
  content: " ]";
}

.addMealRow {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.mealInput {
  background: transparent;
  border: none;
  border-bottom: 1px solid var(--color-border);
  color: var(--color-text);
  font-family: var(--font-mono);
  font-size: 0.85rem;
  padding: 4px 2px;
  outline: none;
  width: 200px;
}

.mealInput:focus {
  border-bottom-color: var(--color-accent);
}

.mealInput::placeholder {
  color: var(--color-text-dim);
}

.addMealButton {
  background: transparent;
  border: none;
  color: var(--color-accent);
  font-family: var(--font-mono);
  font-size: 0.85rem;
  cursor: pointer;
  padding: 4px 0;
}

.addMealButton::before {
  content: "[ ";
}

.addMealButton::after {
  content: " ]";
}

.mealList {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.mealCard {
  background-color: var(--color-bg-card);
  border-left: 3px solid var(--color-accent);
  padding: 1rem;
  font-family: var(--font-mono);
}

.mealHeading {
  font-size: 1rem;
  font-weight: 700;
  color: var(--color-text);
  margin-bottom: 0.75rem;
  letter-spacing: 0.03em;
}

.itemInputRow {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
  flex-wrap: wrap;
}

.itemInput {
  background: transparent;
  border: none;
  border-bottom: 1px solid var(--color-border);
  color: var(--color-text);
  font-family: var(--font-mono);
  font-size: 0.85rem;
  padding: 4px 2px;
  outline: none;
  width: 80px;
}

.itemInput:focus {
  border-bottom-color: var(--color-accent);
}

.itemInput::placeholder {
  color: var(--color-text-dim);
}

.addItemButton {
  background: transparent;
  border: none;
  color: var(--color-accent);
  font-family: var(--font-mono);
  font-size: 0.85rem;
  cursor: pointer;
  padding: 4px 0;
}

.addItemButton::before {
  content: "[ ";
}

.addItemButton::after {
  content: " ]";
}

.itemList {
  margin-top: 0.25rem;
}

.itemRow {
  padding: 6px 0;
  border-bottom: 1px solid var(--color-border-subtle);
  font-size: 0.85rem;
  color: var(--color-text-dim);
}

.itemRow:last-child {
  border-bottom: none;
}
```

- [ ] **Step 2: Verify build**

Run from `frontend/`:
```
npm run build
```
Expected: succeeds. File not yet imported anywhere — confirms no syntax errors.

- [ ] **Step 3: Stage and show diff — DO NOT COMMIT**

```bash
git add frontend/src/pages/Nutrition.module.css
git diff --cached
```

STOP. Report the full diff. Do not run `git commit`. Wait for confirmation.

After confirmation:
```bash
git commit -m "style: add Nutrition page CSS module"
```

---

### Task 2: Wire `Nutrition.jsx`

**Files:**
- Modify: `frontend/src/pages/Nutrition.jsx`

- [ ] **Step 1: Replace the file**

Current file (`frontend/src/pages/Nutrition.jsx`):

```jsx
import { useState, useEffect } from "react";
import { fetchJson } from "../api";

function Nutrition() {
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [day, setDay] = useState(null);
  const [mealName, setMealName] = useState("");
  const [foodItem, setFoodItem] = useState({
    name: "",
    kcal: "",
    protein: "",
    carbs: "",
    fat: "",
  });

  useEffect(() => {
    fetchJson(`/api/nutrition?date=${date}`)
      .then((data) => setDay(data[0] || null))
      .catch((err) => console.error(err));
  }, [date]);

  const createDay = () => {
    fetchJson("/api/nutrition/days", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date }),
    })
      .then((data) => setDay(data))
      .catch((err) => console.error(err));
  };

  const addMeal = () => {
    fetchJson("/api/nutrition/meals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: mealName, nutritionDayId: day.id }),
    })
      .then((data) => {
        setDay((prev) => ({ ...prev, meals: [...(prev.meals || []), data] }));
        setMealName("");
      })
      .catch((err) => console.error(err));
  };

  const addFoodItem = (mealId) => {
    fetchJson(`/api/nutrition/meals/${mealId}/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(foodItem),
    })
      .then((data) => {
        setDay((prev) => ({
          ...prev,
          meals: prev.meals.map((m) =>
            m.id === mealId ? { ...m, items: [...(m.items || []), data] } : m,
          ),
        }));

        setFoodItem({ name: "", kcal: "", protein: "", carbs: "", fat: "" });
      })
      .catch((err) => console.error(err));
  };

  return (
    <div className="page">
      <h1>Nutrition</h1>
      <input
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
      />

      {!day && <button onClick={createDay}>Dodaj dan</button>}

      {day && (
        <div>
          <input
            type="text"
            placeholder="Ime obroka"
            value={mealName}
            onChange={(e) => setMealName(e.target.value)}
          />
          <button onClick={addMeal}>Dodaj obrok</button>

          {day.meals?.map((meal) => (
            <div key={meal.id}>
              <h3>{meal.name}</h3>
              <input
                type="text"
                placeholder="Naziv hrane"
                value={foodItem.name}
                onChange={(e) =>
                  setFoodItem((prev) => ({ ...prev, name: e.target.value }))
                }
              />
              <input
                type="number"
                placeholder="kcal"
                value={foodItem.kcal}
                onChange={(e) =>
                  setFoodItem((prev) => ({ ...prev, kcal: e.target.value }))
                }
              />
              <input
                type="number"
                placeholder="protein"
                value={foodItem.protein}
                onChange={(e) =>
                  setFoodItem((prev) => ({ ...prev, protein: e.target.value }))
                }
              />
              <input
                type="number"
                placeholder="carbs"
                value={foodItem.carbs}
                onChange={(e) =>
                  setFoodItem((prev) => ({ ...prev, carbs: e.target.value }))
                }
              />
              <input
                type="number"
                placeholder="fat"
                value={foodItem.fat}
                onChange={(e) =>
                  setFoodItem((prev) => ({ ...prev, fat: e.target.value }))
                }
              />
              <button onClick={() => addFoodItem(meal.id)}>Dodaj</button>

              {meal.items?.map((item) => (
                <p key={item.id}>
                  {item.name} — {item.kcal} kcal
                </p>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default Nutrition;
```

Replace with:

```jsx
import { useState, useEffect } from "react";
import { fetchJson } from "../api";
import styles from "./Nutrition.module.css";

function Nutrition() {
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [day, setDay] = useState(null);
  const [mealName, setMealName] = useState("");
  const [foodItem, setFoodItem] = useState({
    name: "",
    kcal: "",
    protein: "",
    carbs: "",
    fat: "",
  });

  useEffect(() => {
    fetchJson(`/api/nutrition?date=${date}`)
      .then((data) => setDay(data[0] || null))
      .catch((err) => console.error(err));
  }, [date]);

  const createDay = () => {
    fetchJson("/api/nutrition/days", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date }),
    })
      .then((data) => setDay(data))
      .catch((err) => console.error(err));
  };

  const addMeal = () => {
    fetchJson("/api/nutrition/meals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: mealName, nutritionDayId: day.id }),
    })
      .then((data) => {
        setDay((prev) => ({ ...prev, meals: [...(prev.meals || []), data] }));
        setMealName("");
      })
      .catch((err) => console.error(err));
  };

  const addFoodItem = (mealId) => {
    fetchJson(`/api/nutrition/meals/${mealId}/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(foodItem),
    })
      .then((data) => {
        setDay((prev) => ({
          ...prev,
          meals: prev.meals.map((meal) =>
            meal.id === mealId
              ? { ...meal, items: [...(meal.items || []), data] }
              : meal,
          ),
        }));
        setFoodItem({ name: "", kcal: "", protein: "", carbs: "", fat: "" });
      })
      .catch((err) => console.error(err));
  };

  return (
    <div className={styles.page}>
      <h1 className={styles.heading}>Nutrition</h1>

      <div className={styles.topRow}>
        <input
          type="date"
          className={styles.dateInput}
          value={date}
          onChange={(event) => setDate(event.target.value)}
        />
      </div>

      {!day && (
        <button className={styles.startButton} onClick={createDay}>
          Dodaj dan
        </button>
      )}

      {day && (
        <div>
          <div className={styles.addMealRow}>
            <input
              type="text"
              className={styles.mealInput}
              placeholder="Ime obroka"
              value={mealName}
              onChange={(event) => setMealName(event.target.value)}
            />
            <button className={styles.addMealButton} onClick={addMeal}>
              Dodaj obrok
            </button>
          </div>

          <div className={styles.mealList}>
            {day.meals?.map((meal) => (
              <div key={meal.id} className={styles.mealCard}>
                <h3 className={styles.mealHeading}>{meal.name}</h3>
                <div className={styles.itemInputRow}>
                  <input
                    type="text"
                    className={styles.itemInput}
                    placeholder="Naziv hrane"
                    value={foodItem.name}
                    onChange={(event) =>
                      setFoodItem((prev) => ({
                        ...prev,
                        name: event.target.value,
                      }))
                    }
                  />
                  <input
                    type="number"
                    className={styles.itemInput}
                    placeholder="kcal"
                    value={foodItem.kcal}
                    onChange={(event) =>
                      setFoodItem((prev) => ({
                        ...prev,
                        kcal: event.target.value,
                      }))
                    }
                  />
                  <input
                    type="number"
                    className={styles.itemInput}
                    placeholder="protein"
                    value={foodItem.protein}
                    onChange={(event) =>
                      setFoodItem((prev) => ({
                        ...prev,
                        protein: event.target.value,
                      }))
                    }
                  />
                  <input
                    type="number"
                    className={styles.itemInput}
                    placeholder="carbs"
                    value={foodItem.carbs}
                    onChange={(event) =>
                      setFoodItem((prev) => ({
                        ...prev,
                        carbs: event.target.value,
                      }))
                    }
                  />
                  <input
                    type="number"
                    className={styles.itemInput}
                    placeholder="fat"
                    value={foodItem.fat}
                    onChange={(event) =>
                      setFoodItem((prev) => ({
                        ...prev,
                        fat: event.target.value,
                      }))
                    }
                  />
                  <button
                    className={styles.addItemButton}
                    onClick={() => addFoodItem(meal.id)}
                  >
                    Dodaj
                  </button>
                </div>
                <div className={styles.itemList}>
                  {meal.items?.map((item) => (
                    <div key={item.id} className={styles.itemRow}>
                      {item.name} — {item.kcal} kcal
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default Nutrition;
```

- [ ] **Step 2: Verify build**

Run from `frontend/`:
```
npm run build
```
Expected: succeeds, module count increases (new CSS module import active).

- [ ] **Step 3: Visual check**

Run `npm run dev` from `frontend/`, open `/nutrition`. Confirm: dark page, bracket buttons, underline inputs with red focus, meal cards with red left border and dark background, food item rows with subtle separator.

If browser automation is not available, state that explicitly — `npm run build` passing is not the same as layout looking correct.

- [ ] **Step 4: Stage and show diff — DO NOT COMMIT**

```bash
git add frontend/src/pages/Nutrition.jsx
git diff --cached
```

STOP. Report the full diff. Do not run `git commit`. Wait for confirmation.

After confirmation:
```bash
git commit -m "style: apply CSS module styles to Nutrition"
```

---

## Self-Review Notes

- **Spec coverage:** page/heading/topRow/dateInput → `.page/.heading/.topRow/.dateInput` ✓ | startButton → `.startButton` ✓ | addMealRow/mealInput/addMealButton → done ✓ | mealList/mealCard/mealHeading → done ✓ | itemInputRow/itemInput/addItemButton → done ✓ | itemList/itemRow (with last-child no-border) → done ✓
- **No placeholders:** all CSS is complete ✓
- **Abbreviations fixed:** `(e) =>` → `(event) =>`, `(m) =>` → `(meal) =>` in all map/onChange callbacks ✓
- **No composes anywhere** ✓
- **All var() tokens exist in index.css:** `--color-bg-card`, `--color-accent`, `--color-border`, `--color-border-subtle`, `--color-text`, `--color-text-dim`, `--font-mono` all defined ✓
- **Business logic unchanged:** all fetchJson calls, state updates, conditional rendering preserved exactly ✓
