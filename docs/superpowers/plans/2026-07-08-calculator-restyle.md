# Calculator Restyle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Commit workflow:** After each task, stage, show diff, commit directly (user has pre-approved autonomous execution).

**Goal:** Restyle `Calculator.jsx` — dark monospace 1RM calculator with underline inputs, bracket button, error/result display, and dark percentage table.

**Architecture:** One new `Calculator.module.css`. No `composes`. `Calculator.jsx` gets import and `styles.*` classNames.

**Tech Stack:** Vite (CSS Modules), plain CSS, React 19.

---

### Task 1: Create `Calculator.module.css`

**Files:**
- Create: `frontend/src/pages/Calculator.module.css`

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

.inputRow {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1rem;
  flex-wrap: wrap;
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
  width: 120px;
}

.input:focus {
  border-bottom-color: var(--color-accent);
}

.input::placeholder {
  color: var(--color-text-dim);
}

.calculateButton {
  background: transparent;
  border: none;
  color: var(--color-accent);
  font-family: var(--font-mono);
  font-size: 0.85rem;
  cursor: pointer;
  padding: 4px 0;
}

.calculateButton:disabled {
  color: var(--color-text-dim);
  cursor: not-allowed;
}

.calculateButton:not(:disabled)::before {
  content: "[ ";
}

.calculateButton:not(:disabled)::after {
  content: " ]";
}

.error {
  color: var(--color-accent);
  font-family: var(--font-mono);
  font-size: 0.85rem;
  margin: 0.75rem 0;
}

.result {
  color: var(--color-text);
  font-family: var(--font-mono);
  font-size: 1rem;
  font-weight: 700;
  margin: 0.75rem 0 1.25rem;
}

.optionsRow {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1.25rem;
  flex-wrap: wrap;
}

.table {
  width: 100%;
  border-collapse: collapse;
  font-family: var(--font-mono);
  font-size: 0.85rem;
  margin-top: 0.5rem;
}

.table td {
  color: var(--color-text);
  padding: 0.4rem 1.5rem 0.4rem 0;
  border-bottom: 1px solid var(--color-border-subtle);
}

.table td:first-child {
  color: var(--color-text-dim);
  width: 60px;
}

.table tr:last-child td {
  border-bottom: none;
}
```

- [ ] **Step 2: Verify build**

Run from `frontend/`: `npm run build` — expected: success.

- [ ] **Step 3: Stage and commit**

```bash
git add frontend/src/pages/Calculator.module.css
git diff --cached
git commit -m "style: add Calculator page CSS module"
```

---

### Task 2: Wire `Calculator.jsx`

**Files:**
- Modify: `frontend/src/pages/Calculator.jsx`

- [ ] **Step 1: Replace the file**

Current:
```jsx
import { useState } from "react";

const BRZYCKI_A = 1.0278;
const BRZYCKI_B = 0.0278;
const BRZYCKI_MAX_REPS = 37;
const MIN_PERCENTAGE = 0;
const MAX_PERCENTAGE = 100;
const MIN_STEP = 1;

function Calculator() {
  const [weight, setWeight] = useState("");
  const [reps, setReps] = useState("");
  const [oneRM, setOneRM] = useState(null);
  const [step, setStep] = useState(5);
  const [minPct, setMinPct] = useState(70);
  const [error, setError] = useState(null);

  const calculate = () => {
    if (!weight || !reps) return;

    if (weight <= 0 || reps <= 0) {
      setError("Weight and reps must be greater than 0");
      return;
    }
    if (step < MIN_STEP) {
      setError(`Step must be at least ${MIN_STEP}`);
      return;
    }
    if (minPct < MIN_PERCENTAGE || minPct > MAX_PERCENTAGE) {
      setError(`Percentage must be between ${MIN_PERCENTAGE} and ${MAX_PERCENTAGE}`);
      return;
    }
    if (reps >= BRZYCKI_MAX_REPS) {
      setError("Brzycki formula does not work for 37+ reps");
      return;
    }
    setError(null);

    const result = weight / (BRZYCKI_A - BRZYCKI_B * reps);
    setOneRM(parseFloat(result.toFixed(2)));
  };

  const percentages = [];
  for (let pct = 100; pct >= minPct; pct -= step) {
    percentages.push(pct);
  }

  return (
    <div className="page">
      <h1>Calculator</h1>
      <input
        type="number"
        min="0"
        placeholder="Daj kilazicu"
        value={weight}
        onChange={(e) => setWeight(e.target.value)}
      />
      <input
        type="number"
        min="0"
        placeholder="Daj ponavljanja"
        value={reps}
        onChange={(e) => setReps(e.target.value)}
      />

      <button onClick={calculate} disabled={!weight || !reps}>
        Calculate
      </button>

      {error && <p>{error}</p>}
      {oneRM && <p>1RM: {oneRM} kg</p>}
      <input
        type="number"
        min={MIN_STEP}
        placeholder="Daj postotak skoka"
        value={step}
        onChange={(e) => setStep(parseFloat(e.target.value))}
      />
      <input
        type="number"
        min={MIN_PERCENTAGE}
        max={MAX_PERCENTAGE}
        placeholder="Daj postotak(default do 70%)"
        value={minPct}
        onChange={(e) => setMinPct(parseFloat(e.target.value))}
      />

      {oneRM && (
        <table>
          <tbody>
            {percentages.map((pct) => (
              <tr key={pct}>
                <td>{pct}%</td>
                <td>{((oneRM * pct) / 100).toFixed(2)} kg</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default Calculator;
```

Replace with:
```jsx
import { useState } from "react";
import styles from "./Calculator.module.css";

const BRZYCKI_A = 1.0278;
const BRZYCKI_B = 0.0278;
const BRZYCKI_MAX_REPS = 37;
const MIN_PERCENTAGE = 0;
const MAX_PERCENTAGE = 100;
const MIN_STEP = 1;

function Calculator() {
  const [weight, setWeight] = useState("");
  const [reps, setReps] = useState("");
  const [oneRM, setOneRM] = useState(null);
  const [step, setStep] = useState(5);
  const [minPct, setMinPct] = useState(70);
  const [error, setError] = useState(null);

  const calculate = () => {
    if (!weight || !reps) return;

    if (weight <= 0 || reps <= 0) {
      setError("Weight and reps must be greater than 0");
      return;
    }
    if (step < MIN_STEP) {
      setError(`Step must be at least ${MIN_STEP}`);
      return;
    }
    if (minPct < MIN_PERCENTAGE || minPct > MAX_PERCENTAGE) {
      setError(`Percentage must be between ${MIN_PERCENTAGE} and ${MAX_PERCENTAGE}`);
      return;
    }
    if (reps >= BRZYCKI_MAX_REPS) {
      setError("Brzycki formula does not work for 37+ reps");
      return;
    }
    setError(null);

    const result = weight / (BRZYCKI_A - BRZYCKI_B * reps);
    setOneRM(parseFloat(result.toFixed(2)));
  };

  const percentages = [];
  for (let pct = 100; pct >= minPct; pct -= step) {
    percentages.push(pct);
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.heading}>Calculator</h1>

      <div className={styles.inputRow}>
        <input
          type="number"
          min="0"
          className={styles.input}
          placeholder="Daj kilazicu"
          value={weight}
          onChange={(event) => setWeight(event.target.value)}
        />
        <input
          type="number"
          min="0"
          className={styles.input}
          placeholder="Daj ponavljanja"
          value={reps}
          onChange={(event) => setReps(event.target.value)}
        />
        <button
          className={styles.calculateButton}
          onClick={calculate}
          disabled={!weight || !reps}
        >
          Calculate
        </button>
      </div>

      {error && <p className={styles.error}>{error}</p>}
      {oneRM && <p className={styles.result}>1RM: {oneRM} kg</p>}

      <div className={styles.optionsRow}>
        <input
          type="number"
          min={MIN_STEP}
          className={styles.input}
          placeholder="Daj postotak skoka"
          value={step}
          onChange={(event) => setStep(parseFloat(event.target.value))}
        />
        <input
          type="number"
          min={MIN_PERCENTAGE}
          max={MAX_PERCENTAGE}
          className={styles.input}
          placeholder="Daj postotak(default do 70%)"
          value={minPct}
          onChange={(event) => setMinPct(parseFloat(event.target.value))}
        />
      </div>

      {oneRM && (
        <table className={styles.table}>
          <tbody>
            {percentages.map((pct) => (
              <tr key={pct}>
                <td>{pct}%</td>
                <td>{((oneRM * pct) / 100).toFixed(2)} kg</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default Calculator;
```

- [ ] **Step 2: Verify build**

Run from `frontend/`: `npm run build` — expected: success.

- [ ] **Step 3: Stage and commit**

```bash
git add frontend/src/pages/Calculator.jsx
git diff --cached
git commit -m "style: apply CSS module styles to Calculator"
```
