# Language Toggle (i18n Infrastructure) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Croatian/English language toggle to Settings, backed by `react-i18next`, with `NavBar.jsx` and `Settings.jsx` fully migrated as the working proof of concept.

**Architecture:** `react-i18next` initialized once with two static JSON dictionaries (`hr.json`, `en.json`). Language choice lives on the existing singleton `Settings` DB row (`language` column, default `"hr"`). `App.jsx` fetches settings once on mount and applies the saved language; the Settings page's new dropdown applies + persists a change immediately, without needing the page's existing "Spremi" button.

**Tech Stack:** React + Vite + `react-i18next` (new dependency) on the frontend, Express + Prisma on the backend. No test framework exists in either package — verification is `npm run build` plus manual checks, matching this project's convention.

**Spec:** `docs/superpowers/specs/2026-09-15-i18n-infrastructure-design.md`

---

### Task 1: Backend — `language` column on Settings

**Files:**
- Modify: `backend/prisma/schema.prisma`
- Create: a new Prisma migration (generated, not hand-written)

- [ ] **Step 1: Add the column**

In `backend/prisma/schema.prisma`, find the `Settings` model:

```prisma
model Settings {
  id                  Int     @id @default(1)
  showWorkoutWidget   Boolean @default(true)
  showNutritionWidget Boolean @default(true)
  showCalendarWidget  Boolean @default(true)
  kcalGoal            Int     @default(2500)
  proteinGoal         Int     @default(180)
  trainingsPerWeek    Int     @default(4)
  carbsGoal  Int @default(250)
  fatGoal    Int @default(80)
  exercisePickerMode String @default("chips")
  showE1rm   Boolean @default(true)
  e1rmFormula String @default("brzycki")

}
```

Add a `language` field before the closing brace:

```prisma
model Settings {
  id                  Int     @id @default(1)
  showWorkoutWidget   Boolean @default(true)
  showNutritionWidget Boolean @default(true)
  showCalendarWidget  Boolean @default(true)
  kcalGoal            Int     @default(2500)
  proteinGoal         Int     @default(180)
  trainingsPerWeek    Int     @default(4)
  carbsGoal  Int @default(250)
  fatGoal    Int @default(80)
  exercisePickerMode String @default("chips")
  showE1rm   Boolean @default(true)
  e1rmFormula String @default("brzycki")
  language   String @default("hr")

}
```

- [ ] **Step 2: Generate and apply the migration**

Run from `backend/`:

```bash
npx prisma migrate dev --name add_language_setting
```

Expected: it creates a new folder under `backend/prisma/migrations/` and reports the migration applied successfully, with no data loss warnings (this only adds a column with a default, so the existing singleton row gets `language = 'hr'` automatically).

- [ ] **Step 3: Verify**

Run from `backend/`: `npm start`, then in another terminal:

```bash
curl -s http://localhost:3001/api/settings
```

Expected: the JSON response now includes `"language":"hr"`. Stop the backend afterward.

- [ ] **Step 4: Review and commit**

```bash
git add backend/prisma/schema.prisma backend/prisma/migrations
git diff --cached
```

STOP. Report full diff. Wait for confirmation.

After confirmation: `git commit -m "feat: add language column to Settings"`

---

### Task 2: Frontend — install react-i18next and create the i18n module

**Files:**
- Modify: `frontend/package.json` (via `npm install`, not hand-edited)
- Create: `frontend/src/i18n/index.js`
- Create: `frontend/src/i18n/locales/hr.json`
- Create: `frontend/src/i18n/locales/en.json`
- Modify: `frontend/src/main.jsx`

- [ ] **Step 1: Install dependencies**

Run from `frontend/`:

```bash
npm install i18next react-i18next
```

Expected: `package.json`'s `dependencies` gains `i18next` and `react-i18next` entries; `package-lock.json` updates.

- [ ] **Step 2: Create the Croatian dictionary**

Create `frontend/src/i18n/locales/hr.json`:

```json
{
  "nav": {
    "dashboard": "Dashboard",
    "log": "Log",
    "nutrition": "Prehrana",
    "calendar": "Kalendar",
    "calculator": "Kalkulator",
    "stats": "Statistika",
    "settings": "Postavke"
  },
  "settings": {
    "title": "Postavke",
    "kcalGoal": "Kcal cilj",
    "proteinGoal": "Protein cilj (g)",
    "trainingsPerWeek": "Treninga tjedno",
    "carbsGoal": "Carbs cilj (g)",
    "fatGoal": "Fat cilj (g)",
    "dashboardWidgets": "Dashboard widgeti",
    "showWorkoutWidget": "Prikaži trening widget",
    "showNutritionWidget": "Prikaži prehrana widget",
    "exercisePickerSection": "Odabir vježbe u Logu",
    "exercisePickerChips": "Chips (filter iznad liste)",
    "exercisePickerTwoStep": "Dvokorak (prvo kategorija, pa vježba)",
    "setsSection": "Setovi",
    "showE1rm": "Prikaži e1RM uz svaki set",
    "language": "Jezik",
    "save": "Spremi",
    "allFieldsRequired": "Sva polja moraju biti popunjena",
    "saved": "Postavke spremljene!",
    "saveError": "Greška kod spremanja postavki"
  }
}
```

- [ ] **Step 3: Create the English dictionary**

Create `frontend/src/i18n/locales/en.json`:

```json
{
  "nav": {
    "dashboard": "Dashboard",
    "log": "Log",
    "nutrition": "Nutrition",
    "calendar": "Calendar",
    "calculator": "Calculator",
    "stats": "Stats",
    "settings": "Settings"
  },
  "settings": {
    "title": "Settings",
    "kcalGoal": "Calorie goal",
    "proteinGoal": "Protein goal (g)",
    "trainingsPerWeek": "Trainings per week",
    "carbsGoal": "Carb goal (g)",
    "fatGoal": "Fat goal (g)",
    "dashboardWidgets": "Dashboard widgets",
    "showWorkoutWidget": "Show workout widget",
    "showNutritionWidget": "Show nutrition widget",
    "exercisePickerSection": "Exercise picker in Log",
    "exercisePickerChips": "Chips (filter above list)",
    "exercisePickerTwoStep": "Two-step (category first, then exercise)",
    "setsSection": "Sets",
    "showE1rm": "Show e1RM next to each set",
    "language": "Language",
    "save": "Save",
    "allFieldsRequired": "All fields must be filled in",
    "saved": "Settings saved!",
    "saveError": "Error saving settings"
  }
}
```

- [ ] **Step 4: Create the i18next init module**

Create `frontend/src/i18n/index.js`:

```js
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import hr from "./locales/hr.json";
import en from "./locales/en.json";

i18n.use(initReactI18next).init({
  resources: {
    hr: { translation: hr },
    en: { translation: en },
  },
  lng: "hr",
  fallbackLng: "hr",
  interpolation: { escapeValue: false },
});

export default i18n;
```

- [ ] **Step 5: Import it once at app startup**

In `frontend/src/main.jsx`, find:

```jsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
```

Replace with:

```jsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './i18n'
import App from './App.jsx'
```

(The rest of `main.jsx` — the `createRoot(...).render(...)` call — is unchanged.)

- [ ] **Step 6: Build check**

Run from `frontend/`: `npm run build`

Expected: success, no errors. (Nothing consumes `useTranslation` yet, so this only proves the module wiring itself is valid — no visible behavior change yet.)

- [ ] **Step 7: Review and commit**

```bash
git add frontend/package.json frontend/package-lock.json frontend/src/i18n frontend/src/main.jsx
git diff --cached
```

STOP. Report full diff. Wait for confirmation.

After confirmation: `git commit -m "feat: add react-i18next with hr/en dictionaries"`

---

### Task 3: Frontend — apply saved language on app load

**Files:**
- Modify: `frontend/src/App.jsx`

- [ ] **Step 1: Add the bootstrap fetch**

In `frontend/src/App.jsx`, find:

```jsx
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ToastProvider } from "./context/ToastContext";
import ToastContainer from "./components/ToastContainer";
import RestTimer from "./components/RestTimer";
import NavBar from "./components/NavBar";
import Dashboard from "./pages/Dashboard";
import Log from "./pages/Log";
import Nutrition from "./pages/Nutrition";
import Calendar from "./pages/Calendar";
import Calculator from "./pages/Calculator";
import Stats from "./pages/Stats";
import Settings from "./pages/Settings";

function App() {
  return (
    <ToastProvider>
```

Replace with:

```jsx
import { useEffect } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import i18n from "./i18n";
import { fetchJson } from "./api";
import { ToastProvider } from "./context/ToastContext";
import ToastContainer from "./components/ToastContainer";
import RestTimer from "./components/RestTimer";
import NavBar from "./components/NavBar";
import Dashboard from "./pages/Dashboard";
import Log from "./pages/Log";
import Nutrition from "./pages/Nutrition";
import Calendar from "./pages/Calendar";
import Calculator from "./pages/Calculator";
import Stats from "./pages/Stats";
import Settings from "./pages/Settings";

function App() {
  useEffect(() => {
    fetchJson("/api/settings")
      .then((data) => {
        if (data?.language && data.language !== i18n.language) {
          i18n.changeLanguage(data.language);
        }
      })
      .catch((err) => console.error(err));
  }, []);

  return (
    <ToastProvider>
```

**Why `console.error` instead of the toast system here:** `App` is the component that renders `ToastProvider` — it sits above the provider in the tree, not below it, so `useToast()` isn't available inside `App` itself (every other component that calls `useToast()` is a descendant of `<ToastProvider>`, not the one instantiating it). A failed bootstrap fetch here just means the UI stays in the `lng: "hr"` default already set by `i18n/index.js`, which is a safe, visible-nothing-broken fallback — not worth plumbing a toast through for.

- [ ] **Step 2: Build check**

Run from `frontend/`: `npm run build`

Expected: success, no errors.

- [ ] **Step 3: Review and commit**

```bash
git add frontend/src/App.jsx
git diff --cached
```

STOP. Report full diff. Wait for confirmation.

After confirmation: `git commit -m "feat: apply saved language on app load"`

---

### Task 4: Frontend — migrate NavBar to translated labels

**Files:**
- Modify: `frontend/src/components/NavBar.jsx`

- [ ] **Step 1: Replace the file**

`frontend/src/components/NavBar.jsx` currently reads:

```jsx
import { Link } from "react-router-dom";
import "./Navbar.css";

function NavBar() {
  return (
    <nav>
      <Link to="/">Dashboard</Link>
      <Link to="/log">Log</Link>
      <Link to="/nutrition">Nutrition</Link>
      <Link to="/calendar">Calendar</Link>
      <Link to="/calculator">Calculator</Link>
      <Link to="/stats">Stats</Link>
      <Link to="/settings">Settings</Link>
    </nav>
  );
}

export default NavBar;
```

Replace its full contents with:

```jsx
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import "./Navbar.css";

function NavBar() {
  const { t } = useTranslation();
  return (
    <nav>
      <Link to="/">{t("nav.dashboard")}</Link>
      <Link to="/log">{t("nav.log")}</Link>
      <Link to="/nutrition">{t("nav.nutrition")}</Link>
      <Link to="/calendar">{t("nav.calendar")}</Link>
      <Link to="/calculator">{t("nav.calculator")}</Link>
      <Link to="/stats">{t("nav.stats")}</Link>
      <Link to="/settings">{t("nav.settings")}</Link>
    </nav>
  );
}

export default NavBar;
```

- [ ] **Step 2: Build check**

Run from `frontend/`: `npm run build`

Expected: success, no errors.

- [ ] **Step 3: Manual verification**

Start `frontend/`: `npm run dev`, hard refresh the browser. Confirm the NavBar renders exactly as before (all Croatian-matching-English labels like "Dashboard"/"Log"/"Kalendar" etc. per the `hr.json` values above — since `hr` is still the active language, nothing should visually change yet other than "Nutrition"→"Prehrana", "Calendar"→"Kalendar", "Calculator"→"Kalkulator", "Stats"→"Statistika", "Settings"→"Postavke", which are intentional corrections from the previously-hardcoded English labels).

- [ ] **Step 4: Review and commit**

```bash
git add frontend/src/components/NavBar.jsx
git diff --cached
```

STOP. Report full diff. Wait for confirmation.

After confirmation: `git commit -m "feat: translate NavBar labels"`

---

### Task 5: Frontend — Settings page language dropdown + full translation

**Files:**
- Modify: `frontend/src/pages/Settings.jsx`
- Modify: `frontend/src/pages/Settings.module.css`

- [ ] **Step 1: Replace `Settings.jsx`**

`frontend/src/pages/Settings.jsx` currently reads:

```jsx
import { useState, useEffect } from "react";
import { fetchJson } from "../api";
import { ONE_REP_MAX_FORMULAS } from "../utils/oneRepMax";
import { useToast } from "../context/useToast";
import styles from "./Settings.module.css";

const E1RM_FORMULA_LABELS = {
  [ONE_REP_MAX_FORMULAS.brzycki]: "Brzycki",
  [ONE_REP_MAX_FORMULAS.epley]: "Epley",
  [ONE_REP_MAX_FORMULAS.lombardi]: "Lombardi",
};

function Settings() {
  const { showError, showSuccess } = useToast();
  const [settings, setSettings] = useState(null);

  useEffect(() => {
    fetchJson("/api/settings")
      .then((data) => setSettings(data))
      .catch((err) => {
        console.error(err);
        showError(err.message);
      });
  }, [showError]);

  const save = () => {
    const fields = [settings.kcalGoal, settings.proteinGoal, settings.trainingsPerWeek, settings.carbsGoal, settings.fatGoal];
    if (fields.some((field) => !field && field !== 0)) {
      showError("All fields must be filled in");
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
      .then(() => showSuccess("Settings saved!"))
      .catch((err) => {
        console.error(err);
        showError(err.message || "Error saving settings");
      });
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

      <p className={styles.sectionLabel}>Odabir vježbe u Logu</p>

      <label className={styles.checkboxRow}>
        <input
          type="radio"
          name="exercisePickerMode"
          checked={(settings?.exercisePickerMode ?? "chips") === "chips"}
          onChange={() =>
            setSettings((prev) => ({ ...prev, exercisePickerMode: "chips" }))
          }
        />
        Chips (filter iznad liste)
      </label>

      <label className={styles.checkboxRow}>
        <input
          type="radio"
          name="exercisePickerMode"
          checked={settings?.exercisePickerMode === "twoStep"}
          onChange={() =>
            setSettings((prev) => ({ ...prev, exercisePickerMode: "twoStep" }))
          }
        />
        Dvokorak (prvo kategorija, pa vježba)
      </label>

      <p className={styles.sectionLabel}>Setovi</p>

      <label className={styles.checkboxRow}>
        <input
          type="checkbox"
          checked={settings?.showE1rm ?? true}
          onChange={(event) =>
            setSettings((prev) => ({
              ...prev,
              showE1rm: event.target.checked,
            }))
          }
        />
        Prikaži e1RM uz svaki set
      </label>

      {Object.values(ONE_REP_MAX_FORMULAS).map((formula) => (
        <label key={formula} className={styles.checkboxRow}>
          <input
            type="radio"
            name="e1rmFormula"
            checked={(settings?.e1rmFormula ?? "brzycki") === formula}
            onChange={() =>
              setSettings((prev) => ({ ...prev, e1rmFormula: formula }))
            }
          />
          {E1RM_FORMULA_LABELS[formula]}
        </label>
      ))}

      <button className={styles.saveButton} onClick={save}>
        Spremi
      </button>
    </div>
  );
}

export default Settings;
```

Replace its full contents with:

```jsx
import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { fetchJson } from "../api";
import { ONE_REP_MAX_FORMULAS } from "../utils/oneRepMax";
import { useToast } from "../context/useToast";
import styles from "./Settings.module.css";

const E1RM_FORMULA_LABELS = {
  [ONE_REP_MAX_FORMULAS.brzycki]: "Brzycki",
  [ONE_REP_MAX_FORMULAS.epley]: "Epley",
  [ONE_REP_MAX_FORMULAS.lombardi]: "Lombardi",
};

function Settings() {
  const { t, i18n } = useTranslation();
  const { showError, showSuccess } = useToast();
  const [settings, setSettings] = useState(null);

  useEffect(() => {
    fetchJson("/api/settings")
      .then((data) => setSettings(data))
      .catch((err) => {
        console.error(err);
        showError(err.message);
      });
  }, [showError]);

  const changeLanguage = (lang) => {
    i18n.changeLanguage(lang);
    setSettings((prev) => ({ ...prev, language: lang }));
    fetchJson("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ language: lang }),
    }).catch((err) => {
      console.error(err);
      showError(err.message);
    });
  };

  const save = () => {
    const fields = [settings.kcalGoal, settings.proteinGoal, settings.trainingsPerWeek, settings.carbsGoal, settings.fatGoal];
    if (fields.some((field) => !field && field !== 0)) {
      showError(t("settings.allFieldsRequired"));
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
      .then(() => showSuccess(t("settings.saved")))
      .catch((err) => {
        console.error(err);
        showError(err.message || t("settings.saveError"));
      });
  };

  return (
    <div className={styles.page}>
      <h1 className={styles.heading}>{t("settings.title")}</h1>

      <div className={styles.field}>
        <span className={styles.fieldLabel}>{t("settings.language")}</span>
        <select
          className={styles.languageSelect}
          value={settings?.language || "hr"}
          onChange={(event) => changeLanguage(event.target.value)}
        >
          <option value="hr">Hrvatski</option>
          <option value="en">English</option>
        </select>
      </div>

      <div className={styles.field}>
        <span className={styles.fieldLabel}>{t("settings.kcalGoal")}</span>
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
        <span className={styles.fieldLabel}>{t("settings.proteinGoal")}</span>
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
        <span className={styles.fieldLabel}>{t("settings.trainingsPerWeek")}</span>
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
        <span className={styles.fieldLabel}>{t("settings.carbsGoal")}</span>
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
        <span className={styles.fieldLabel}>{t("settings.fatGoal")}</span>
        <input
          type="number"
          className={styles.fieldInput}
          value={settings?.fatGoal || ""}
          onChange={(event) =>
            setSettings((prev) => ({ ...prev, fatGoal: event.target.value }))
          }
        />
      </div>

      <p className={styles.sectionLabel}>{t("settings.dashboardWidgets")}</p>

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
        {t("settings.showWorkoutWidget")}
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
        {t("settings.showNutritionWidget")}
      </label>

      <p className={styles.sectionLabel}>{t("settings.exercisePickerSection")}</p>

      <label className={styles.checkboxRow}>
        <input
          type="radio"
          name="exercisePickerMode"
          checked={(settings?.exercisePickerMode ?? "chips") === "chips"}
          onChange={() =>
            setSettings((prev) => ({ ...prev, exercisePickerMode: "chips" }))
          }
        />
        {t("settings.exercisePickerChips")}
      </label>

      <label className={styles.checkboxRow}>
        <input
          type="radio"
          name="exercisePickerMode"
          checked={settings?.exercisePickerMode === "twoStep"}
          onChange={() =>
            setSettings((prev) => ({ ...prev, exercisePickerMode: "twoStep" }))
          }
        />
        {t("settings.exercisePickerTwoStep")}
      </label>

      <p className={styles.sectionLabel}>{t("settings.setsSection")}</p>

      <label className={styles.checkboxRow}>
        <input
          type="checkbox"
          checked={settings?.showE1rm ?? true}
          onChange={(event) =>
            setSettings((prev) => ({
              ...prev,
              showE1rm: event.target.checked,
            }))
          }
        />
        {t("settings.showE1rm")}
      </label>

      {Object.values(ONE_REP_MAX_FORMULAS).map((formula) => (
        <label key={formula} className={styles.checkboxRow}>
          <input
            type="radio"
            name="e1rmFormula"
            checked={(settings?.e1rmFormula ?? "brzycki") === formula}
            onChange={() =>
              setSettings((prev) => ({ ...prev, e1rmFormula: formula }))
            }
          />
          {E1RM_FORMULA_LABELS[formula]}
        </label>
      ))}

      <button className={styles.saveButton} onClick={save}>
        {t("settings.save")}
      </button>
    </div>
  );
}

export default Settings;
```

Note: `E1RM_FORMULA_LABELS` ("Brzycki", "Epley", "Lombardi") are intentionally left as plain strings, not translation keys — they're proper nouns (formula names), not UI copy.

- [ ] **Step 2: Add the language select's CSS**

In `frontend/src/pages/Settings.module.css`, find the `.fieldInput` rules:

```css
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
```

Add these new rules directly after that block:

```css
.languageSelect {
  background: var(--color-bg-card);
  border: none;
  border-bottom: 1px solid var(--color-border);
  color: var(--color-text);
  font-family: var(--font-mono);
  font-size: 0.85rem;
  padding: 4px 2px;
  outline: none;
  width: 120px;
  cursor: pointer;
}

.languageSelect:focus {
  border-bottom-color: var(--color-accent);
}
```

(Unlike `.fieldInput`, this needs an explicit, non-transparent `background` — native `<select>` elements don't reliably inherit a transparent background consistently across browsers, and this app's dark theme would make a browser-default white background jarring.)

- [ ] **Step 3: Build check**

Run from `frontend/`: `npm run build`

Expected: success, no errors.

- [ ] **Step 4: Manual verification**

With `backend/` (`npm start`) and `frontend/` (`npm run dev`) both running, hard refresh the browser:

1. Open `/settings`. Confirm the page renders in Croatian, with a new "Jezik" field at the top showing a "Hrvatski"/"English" dropdown defaulted to "Hrvatski". Confirm the heading now reads "Postavke" (was "Settings") and every field label matches what it said before (aside from the heading correction).
2. Select "English" from the dropdown. Confirm: the Settings page immediately re-renders in English (heading → "Settings", every label translated), and the NavBar immediately re-renders in English too, with no page reload.
3. Reload the browser (full page reload, not just a re-render). Confirm the app comes back up in English — proves the `PUT` from step 2 persisted and `App.jsx`'s bootstrap fetch applied it.
4. Switch back to "Hrvatski" via the dropdown. Confirm everything reverts, and reload once more to confirm that persisted too.
5. Trigger the existing "Sva polja moraju biti popunjena" validation (clear a goal field and click Save) in both languages, and click Save successfully in both languages, to confirm `settings.allFieldsRequired`/`settings.saved` toast text appears correctly in each language.

- [ ] **Step 5: Review and commit**

```bash
git add frontend/src/pages/Settings.jsx frontend/src/pages/Settings.module.css
git diff --cached
```

STOP. Report full diff. Wait for confirmation.

After confirmation: `git commit -m "feat: add language dropdown and translate Settings page"`
