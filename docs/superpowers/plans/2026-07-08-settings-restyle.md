# Settings Restyle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Commit workflow:** After staging, run `git diff --cached` and STOP. Report the full diff. Do NOT commit. Wait for controller confirmation.

**Goal:** Restyle `Settings.jsx` — monospace form with label/input pairs, accent-colored checkboxes, bracket save button.

**Architecture:** One new `Settings.module.css`. All styles direct (no `composes`). `Settings.jsx` gets the import and `styles.*` classNames plus abbreviated-var fixes.

**Tech Stack:** Vite (CSS Modules), plain CSS, React 19.

**Spec:** `docs/superpowers/specs/2026-07-08-settings-restyle-design.md`

---

### Task 1: Create `Settings.module.css`

**Files:**
- Create: `frontend/src/pages/Settings.module.css`

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
  margin-bottom: 1.5rem;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  margin-bottom: 1rem;
}

.fieldLabel {
  color: var(--color-text-dim);
  font-family: var(--font-mono);
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.fieldInput {
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

.fieldInput:focus {
  border-bottom-color: var(--color-accent);
}

.sectionLabel {
  color: var(--color-text-dim);
  font-family: var(--font-mono);
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-top: 1.5rem;
  margin-bottom: 0.75rem;
}

.checkboxRow {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
  font-family: var(--font-mono);
  font-size: 0.85rem;
  color: var(--color-text);
  cursor: pointer;
}

.checkboxRow input[type="checkbox"] {
  accent-color: var(--color-accent);
  width: 14px;
  height: 14px;
  cursor: pointer;
}

.saveButton {
  background: transparent;
  border: none;
  color: var(--color-accent);
  font-family: var(--font-mono);
  font-size: 0.85rem;
  cursor: pointer;
  padding: 4px 0;
  margin-top: 1.5rem;
}

.saveButton::before {
  content: "[ ";
}

.saveButton::after {
  content: " ]";
}
```

- [ ] **Step 2: Verify build**

Run from `frontend/`: `npm run build` — expected: success.

- [ ] **Step 3: Stage and show diff — DO NOT COMMIT**

```bash
git add frontend/src/pages/Settings.module.css
git diff --cached
```
STOP. Report full diff. Wait for confirmation.

After confirmation: `git commit -m "style: add Settings page CSS module"`

---

### Task 2: Wire `Settings.jsx`

**Files:**
- Modify: `frontend/src/pages/Settings.jsx`

- [ ] **Step 1: Replace the file**

Current file (`frontend/src/pages/Settings.jsx`):

```jsx
import { useState, useEffect } from "react";
import { fetchJson } from "../api";

function Settings() {
  const [settings, setSettings] = useState(null);

  useEffect(() => {
    fetchJson("/api/settings")
      .then((data) => setSettings(data))
      .catch((err) => console.error(err));
  }, []);

  const save = () => {
    const fields = [settings.kcalGoal, settings.proteinGoal, settings.trainingsPerWeek, settings.carbsGoal, settings.fatGoal];
    if (fields.some((field) => !field && field !== 0)) {
      alert("All fields must be filled in");
      return;
    }

    fetchJson("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...settings,
        kcalGoal: parseInt(settings.kcalGoal),
        proteinGoal: parseInt(settings.proteinGoal),
        trainingsPerWeek: parseInt(settings.trainingsPerWeek),
        carbsGoal: parseInt(settings.carbsGoal),
        fatGoal: parseInt(settings.fatGoal),
      }),
    })
      .then(() => alert("Settings saved!"))
      .catch(() => alert("Error saving settings"));
  };

  return (
    <div className="page">
      <h1>Settings</h1>
      <label>Kcal cilj</label>
      <input
        type="number"
        value={settings?.kcalGoal || ""}
        onChange={(e) =>
          setSettings((prev) => ({ ...prev, kcalGoal: e.target.value }))
        }
      />
      <label>Protein cilj (g)</label>
      <input
        type="number"
        value={settings?.proteinGoal || ""}
        onChange={(e) =>
          setSettings((prev) => ({ ...prev, proteinGoal: e.target.value }))
        }
      />
      <label>Treninga tjedno</label>
      <input
        type="number"
        value={settings?.trainingsPerWeek || ""}
        onChange={(e) =>
          setSettings((prev) => ({ ...prev, trainingsPerWeek: e.target.value }))
        }
      />
      <label>Carbs cilj (g)</label>
      <input
        type="number"
        value={settings?.carbsGoal || ""}
        onChange={(e) =>
          setSettings((prev) => ({ ...prev, carbsGoal: e.target.value }))
        }
      />
      <label>Fat cilj (g)</label>
      <input
        type="number"
        value={settings?.fatGoal || ""}
        onChange={(e) =>
          setSettings((prev) => ({ ...prev, fatGoal: e.target.value }))
        }
      />

      <h2>Dashboard widgeti</h2>
      <label>
        <input
          type="checkbox"
          checked={settings?.showWorkoutWidget ?? true}
          onChange={(e) =>
            setSettings((prev) => ({
              ...prev,
              showWorkoutWidget: e.target.checked,
            }))
          }
        />
        Prikaži trening widget
      </label>
      <label>
        <input
          type="checkbox"
          checked={settings?.showNutritionWidget ?? true}
          onChange={(e) =>
            setSettings((prev) => ({
              ...prev,
              showNutritionWidget: e.target.checked,
            }))
          }
        />
        Prikaži prehrana widget
      </label>

      <button onClick={save}>Spremi</button>
    </div>
  );
}

export default Settings;
```

Replace with:

```jsx
import { useState, useEffect } from "react";
import { fetchJson } from "../api";
import styles from "./Settings.module.css";

function Settings() {
  const [settings, setSettings] = useState(null);

  useEffect(() => {
    fetchJson("/api/settings")
      .then((data) => setSettings(data))
      .catch((err) => console.error(err));
  }, []);

  const save = () => {
    const fields = [settings.kcalGoal, settings.proteinGoal, settings.trainingsPerWeek, settings.carbsGoal, settings.fatGoal];
    if (fields.some((field) => !field && field !== 0)) {
      alert("All fields must be filled in");
      return;
    }

    fetchJson("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...settings,
        kcalGoal: parseInt(settings.kcalGoal),
        proteinGoal: parseInt(settings.proteinGoal),
        trainingsPerWeek: parseInt(settings.trainingsPerWeek),
        carbsGoal: parseInt(settings.carbsGoal),
        fatGoal: parseInt(settings.fatGoal),
      }),
    })
      .then(() => alert("Settings saved!"))
      .catch(() => alert("Error saving settings"));
  };

  return (
    <div className={styles.page}>
      <h1 className={styles.heading}>Settings</h1>

      <div className={styles.field}>
        <span className={styles.fieldLabel}>Kcal cilj</span>
        <input
          type="number"
          className={styles.fieldInput}
          value={settings?.kcalGoal || ""}
          onChange={(event) =>
            setSettings((prev) => ({ ...prev, kcalGoal: event.target.value }))
          }
        />
      </div>

      <div className={styles.field}>
        <span className={styles.fieldLabel}>Protein cilj (g)</span>
        <input
          type="number"
          className={styles.fieldInput}
          value={settings?.proteinGoal || ""}
          onChange={(event) =>
            setSettings((prev) => ({ ...prev, proteinGoal: event.target.value }))
          }
        />
      </div>

      <div className={styles.field}>
        <span className={styles.fieldLabel}>Treninga tjedno</span>
        <input
          type="number"
          className={styles.fieldInput}
          value={settings?.trainingsPerWeek || ""}
          onChange={(event) =>
            setSettings((prev) => ({ ...prev, trainingsPerWeek: event.target.value }))
          }
        />
      </div>

      <div className={styles.field}>
        <span className={styles.fieldLabel}>Carbs cilj (g)</span>
        <input
          type="number"
          className={styles.fieldInput}
          value={settings?.carbsGoal || ""}
          onChange={(event) =>
            setSettings((prev) => ({ ...prev, carbsGoal: event.target.value }))
          }
        />
      </div>

      <div className={styles.field}>
        <span className={styles.fieldLabel}>Fat cilj (g)</span>
        <input
          type="number"
          className={styles.fieldInput}
          value={settings?.fatGoal || ""}
          onChange={(event) =>
            setSettings((prev) => ({ ...prev, fatGoal: event.target.value }))
          }
        />
      </div>

      <p className={styles.sectionLabel}>Dashboard widgeti</p>

      <label className={styles.checkboxRow}>
        <input
          type="checkbox"
          checked={settings?.showWorkoutWidget ?? true}
          onChange={(event) =>
            setSettings((prev) => ({
              ...prev,
              showWorkoutWidget: event.target.checked,
            }))
          }
        />
        Prikaži trening widget
      </label>

      <label className={styles.checkboxRow}>
        <input
          type="checkbox"
          checked={settings?.showNutritionWidget ?? true}
          onChange={(event) =>
            setSettings((prev) => ({
              ...prev,
              showNutritionWidget: event.target.checked,
            }))
          }
        />
        Prikaži prehrana widget
      </label>

      <button className={styles.saveButton} onClick={save}>
        Spremi
      </button>
    </div>
  );
}

export default Settings;
```

- [ ] **Step 2: Verify build**

Run from `frontend/`: `npm run build` — expected: success.

- [ ] **Step 3: Stage and show diff — DO NOT COMMIT**

```bash
git add frontend/src/pages/Settings.jsx
git diff --cached
```
STOP. Report full diff. Wait for confirmation.

After confirmation: `git commit -m "style: apply CSS module styles to Settings"`

---

## Self-Review Notes

- All 8 classes defined in Settings.module.css and referenced in Settings.jsx ✓
- `(e) =>` → `(event) =>` throughout ✓
- `<label>` wrappers for number inputs replaced with `<div className={styles.field}> + <span> + <input>` to allow flex-column layout ✓
- Checkbox `<label>` wrappers kept as `<label className={styles.checkboxRow}>` (correct semantics for click-to-toggle) ✓
- `<h2>Dashboard widgeti</h2>` → `<p className={styles.sectionLabel}>` (dim uppercase label, not a heading) ✓
- All tokens exist in index.css: `--color-text-dim`, `--font-mono`, `--color-border`, `--color-text`, `--color-accent` ✓
- `accent-color: var(--color-accent)` is supported in all modern browsers ✓
- Business logic (save function, alert calls, parseInt conversions, fetch) unchanged ✓
