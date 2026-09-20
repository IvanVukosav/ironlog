# Calendar + DatePicker Translation Rollout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `Calendar.jsx` and `DatePicker.jsx` respond to the language toggle, replacing their hardcoded month/weekday names and UI strings with `react-i18next` lookups.

**Architecture:** Add three new namespaces (`common`, `calendar`, `datePicker`) to the existing `hr.json`/`en.json` dictionaries, including two array-valued keys (`common.months`, `calendar.weekdays`, `datePicker.weekdays`) consumed via `t(key, { returnObjects: true })`. Then swap each file's hardcoded strings/arrays for `t()` calls.

**Tech Stack:** React + `react-i18next` (already installed and initialized from the prior i18n-infrastructure plan). No test framework — verification is `npm run build` plus manual checks.

**Spec:** `docs/superpowers/specs/2026-09-20-calendar-datepicker-i18n-design.md`

---

### Task 1: Add translation keys

**Files:**
- Modify: `frontend/src/i18n/locales/hr.json`
- Modify: `frontend/src/i18n/locales/en.json`

- [ ] **Step 1: Update `hr.json`**

Current full content:

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

Replace its full contents with:

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
  },
  "common": {
    "save": "Spremi",
    "delete": "Obriši",
    "months": [
      "Siječanj", "Veljača", "Ožujak", "Travanj", "Svibanj", "Lipanj",
      "Srpanj", "Kolovoz", "Rujan", "Listopad", "Studeni", "Prosinac"
    ]
  },
  "calendar": {
    "weekdays": ["Nedjelja", "Ponedjeljak", "Utorak", "Srijeda", "Četvrtak", "Petak", "Subota"],
    "workoutOption": "Trening",
    "bodyweightOption": "Tjelesna težina",
    "bodyweightModalTitle": "Tjelesna težina {{date}}"
  },
  "datePicker": {
    "weekdays": ["Po", "Ut", "Sr", "Če", "Pe", "Su", "Ne"]
  }
}
```

- [ ] **Step 2: Update `en.json`**

Current full content:

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

Replace its full contents with:

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
  },
  "common": {
    "save": "Save",
    "delete": "Delete",
    "months": [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
    ]
  },
  "calendar": {
    "weekdays": ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
    "workoutOption": "Workout",
    "bodyweightOption": "Bodyweight",
    "bodyweightModalTitle": "Bodyweight {{date}}"
  },
  "datePicker": {
    "weekdays": ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"]
  }
}
```

- [ ] **Step 3: Build check**

Run from `frontend/`: `npm run build`

Expected: success, no errors. (Nothing consumes the new keys yet — this only proves both JSON files are still valid.)

- [ ] **Step 4: Review and commit**

```bash
git add frontend/src/i18n/locales/hr.json frontend/src/i18n/locales/en.json
git diff --cached
```

STOP. Report full diff. Wait for confirmation.

After confirmation: `git commit -m "feat: add common/calendar/datePicker translation keys"`

---

### Task 2: Migrate Calendar.jsx

**Files:**
- Modify: `frontend/src/pages/Calendar.jsx`

- [ ] **Step 1: Add the import and hook**

Find:

```jsx
import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { fetchJson } from "../api";
import { useToast } from "../context/useToast";
import styles from "./Calendar.module.css";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function Calendar() {
  const navigate = useNavigate();
  const { showError } = useToast();
```

Replace with:

```jsx
import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { fetchJson } from "../api";
import { useToast } from "../context/useToast";
import styles from "./Calendar.module.css";

function Calendar() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { showError } = useToast();
```

(This removes the `MONTH_NAMES` constant entirely — it's replaced by `t("common.months", { returnObjects: true })` at each use site below.)

- [ ] **Step 2: Translate the month heading**

Find:

```jsx
        <h1 className={styles.monthHeading}>
          {MONTH_NAMES[currentMonth - 1]} {currentYear}
        </h1>
```

Replace with:

```jsx
        <h1 className={styles.monthHeading}>
          {t("common.months", { returnObjects: true })[currentMonth - 1]} {currentYear}
        </h1>
```

- [ ] **Step 3: Translate the weekday headers**

Find:

```jsx
      <div className={styles.calendarGrid}>
        {["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].map((day) => (
          <div key={day} className={styles.dayHeader}>{day}</div>
        ))}
```

Replace with:

```jsx
      <div className={styles.calendarGrid}>
        {t("calendar.weekdays", { returnObjects: true }).map((day) => (
          <div key={day} className={styles.dayHeader}>{day}</div>
        ))}
```

- [ ] **Step 4: Translate the dropdown items**

Find:

```jsx
                <button
                  className={styles.dropdownItem}
                  onClick={(event) => {
                    event.stopPropagation();
                    handleWorkoutClick(cell.day);
                  }}
                >
                  Workout
                </button>
                <button
                  className={styles.dropdownItem}
                  onClick={(event) => {
                    event.stopPropagation();
                    handleBwClick(cell.day);
                  }}
                >
                  Bodyweight
                </button>
```

Replace with:

```jsx
                <button
                  className={styles.dropdownItem}
                  onClick={(event) => {
                    event.stopPropagation();
                    handleWorkoutClick(cell.day);
                  }}
                >
                  {t("calendar.workoutOption")}
                </button>
                <button
                  className={styles.dropdownItem}
                  onClick={(event) => {
                    event.stopPropagation();
                    handleBwClick(cell.day);
                  }}
                >
                  {t("calendar.bodyweightOption")}
                </button>
```

- [ ] **Step 5: Translate the modal title and buttons**

Find:

```jsx
            <div className={styles.bwModalHeader}>
              <span className={styles.bwModalTitle}>
                Bodyweight {bwModalDate}
              </span>
```

Replace with:

```jsx
            <div className={styles.bwModalHeader}>
              <span className={styles.bwModalTitle}>
                {t("calendar.bodyweightModalTitle", { date: bwModalDate })}
              </span>
```

Find:

```jsx
            <div className={styles.bwModalFooter}>
              {bwEntryId !== null && (
                <button className={styles.bwDeleteButton} onClick={deleteBw}>
                  Obriši
                </button>
              )}
              <button className={styles.bwSaveButton} onClick={saveBw}>
                Spremi
              </button>
            </div>
```

Replace with:

```jsx
            <div className={styles.bwModalFooter}>
              {bwEntryId !== null && (
                <button className={styles.bwDeleteButton} onClick={deleteBw}>
                  {t("common.delete")}
                </button>
              )}
              <button className={styles.bwSaveButton} onClick={saveBw}>
                {t("common.save")}
              </button>
            </div>
```

- [ ] **Step 6: Build check**

Run from `frontend/`: `npm run build`

Expected: success, no errors.

- [ ] **Step 7: Manual verification**

With `backend/` (`npm start`) and `frontend/` (`npm run dev`) running, hard refresh the browser:

1. Go to `/calendar` in Croatian (default). Confirm the month heading and weekday headers now show Croatian names (e.g. "Rujan 2026", "Nedjelja"/"Ponedjeljak"/...) — this is an intentional change from the current English display.
2. Click a day, confirm the dropdown shows "Trening" / "Tjelesna težina".
3. Click "Tjelesna težina", confirm the modal title reads "Tjelesna težina {date}" and the buttons read "Obriši" (if editing an existing entry) / "Spremi".
4. Go to Settings, switch to English. Return to `/calendar`: month/weekday names now in English, dropdown shows "Workout"/"Bodyweight", modal shows "Bodyweight {date}" and "Delete"/"Save".
5. Confirm the existing delete-a-bodyweight-entry flow (from the earlier feature) still works correctly through the now-translated modal, in both languages.

- [ ] **Step 8: Review and commit**

```bash
git add frontend/src/pages/Calendar.jsx
git diff --cached
```

STOP. Report full diff. Wait for confirmation.

After confirmation: `git commit -m "feat: translate Calendar page"`

---

### Task 3: Migrate DatePicker.jsx

**Files:**
- Modify: `frontend/src/components/DatePicker.jsx`

- [ ] **Step 1: Replace the file**

Current full content:

```jsx
import { useState, useRef, useEffect } from "react";
import styles from "./DatePicker.module.css";

const MONTH_NAMES = [
  "Siječanj", "Veljača", "Ožujak", "Travanj", "Svibanj", "Lipanj",
  "Srpanj", "Kolovoz", "Rujan", "Listopad", "Studeni", "Prosinac",
];
const WEEKDAY_LABELS = ["Po", "Ut", "Sr", "Če", "Pe", "Su", "Ne"];
const SUNDAY_INDEX = 0;
const DAYS_PER_WEEK = 7;

function formatDateString(year, month, day) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function DatePicker({ value, onChange }) {
  const [isOpen, setIsOpen] = useState(false);
  const selectedDate = new Date(value);
  const [viewYear, setViewYear] = useState(selectedDate.getUTCFullYear());
  const [viewMonth, setViewMonth] = useState(selectedDate.getUTCMonth() + 1);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return undefined;
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const openPicker = () => {
    const current = new Date(value);
    setViewYear(current.getUTCFullYear());
    setViewMonth(current.getUTCMonth() + 1);
    setIsOpen(true);
  };

  const prevMonth = () => {
    if (viewMonth === 1) {
      setViewMonth(12);
      setViewYear(viewYear - 1);
    } else {
      setViewMonth(viewMonth - 1);
    }
  };

  const nextMonth = () => {
    if (viewMonth === 12) {
      setViewMonth(1);
      setViewYear(viewYear + 1);
    } else {
      setViewMonth(viewMonth + 1);
    }
  };

  const selectDay = (day) => {
    onChange(formatDateString(viewYear, viewMonth, day));
    setIsOpen(false);
  };

  const firstDayOfWeek = new Date(Date.UTC(viewYear, viewMonth - 1, 1)).getUTCDay();
  const leadingBlanks = firstDayOfWeek === SUNDAY_INDEX ? DAYS_PER_WEEK - 1 : firstDayOfWeek - 1;
  const daysInMonth = new Date(Date.UTC(viewYear, viewMonth, 0)).getUTCDate();

  const cells = [];
  for (let i = 0; i < leadingBlanks; i++) {
    cells.push(null);
  }
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push(day);
  }

  const isSelected = (day) =>
    day !== null &&
    viewYear === selectedDate.getUTCFullYear() &&
    viewMonth === selectedDate.getUTCMonth() + 1 &&
    day === selectedDate.getUTCDate();

  return (
    <div className={styles.container} ref={containerRef}>
      <button type="button" className={styles.trigger} onClick={openPicker}>
        {String(selectedDate.getUTCDate()).padStart(2, "0")}/
        {String(selectedDate.getUTCMonth() + 1).padStart(2, "0")}/
        {selectedDate.getUTCFullYear()}
      </button>
      {isOpen && (
        <div className={styles.dropdown}>
          <div className={styles.header}>
            <button type="button" className={styles.navButton} onClick={prevMonth}>
              ‹
            </button>
            <span className={styles.monthLabel}>
              {MONTH_NAMES[viewMonth - 1]} {viewYear}
            </span>
            <button type="button" className={styles.navButton} onClick={nextMonth}>
              ›
            </button>
          </div>
          <div className={styles.weekdayRow}>
            {WEEKDAY_LABELS.map((label) => (
              <span key={label} className={styles.weekdayLabel}>
                {label}
              </span>
            ))}
          </div>
          <div className={styles.dayGrid}>
            {cells.map((day, index) => (
              <button
                type="button"
                key={index}
                className={
                  day === null
                    ? styles.dayCellEmpty
                    : isSelected(day)
                      ? styles.dayCellSelected
                      : styles.dayCell
                }
                disabled={day === null}
                onClick={() => day !== null && selectDay(day)}
              >
                {day}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default DatePicker;
```

Replace its full contents with:

```jsx
import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import styles from "./DatePicker.module.css";

const SUNDAY_INDEX = 0;
const DAYS_PER_WEEK = 7;

function formatDateString(year, month, day) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function DatePicker({ value, onChange }) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const selectedDate = new Date(value);
  const [viewYear, setViewYear] = useState(selectedDate.getUTCFullYear());
  const [viewMonth, setViewMonth] = useState(selectedDate.getUTCMonth() + 1);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return undefined;
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const openPicker = () => {
    const current = new Date(value);
    setViewYear(current.getUTCFullYear());
    setViewMonth(current.getUTCMonth() + 1);
    setIsOpen(true);
  };

  const prevMonth = () => {
    if (viewMonth === 1) {
      setViewMonth(12);
      setViewYear(viewYear - 1);
    } else {
      setViewMonth(viewMonth - 1);
    }
  };

  const nextMonth = () => {
    if (viewMonth === 12) {
      setViewMonth(1);
      setViewYear(viewYear + 1);
    } else {
      setViewMonth(viewMonth + 1);
    }
  };

  const selectDay = (day) => {
    onChange(formatDateString(viewYear, viewMonth, day));
    setIsOpen(false);
  };

  const firstDayOfWeek = new Date(Date.UTC(viewYear, viewMonth - 1, 1)).getUTCDay();
  const leadingBlanks = firstDayOfWeek === SUNDAY_INDEX ? DAYS_PER_WEEK - 1 : firstDayOfWeek - 1;
  const daysInMonth = new Date(Date.UTC(viewYear, viewMonth, 0)).getUTCDate();

  const cells = [];
  for (let i = 0; i < leadingBlanks; i++) {
    cells.push(null);
  }
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push(day);
  }

  const isSelected = (day) =>
    day !== null &&
    viewYear === selectedDate.getUTCFullYear() &&
    viewMonth === selectedDate.getUTCMonth() + 1 &&
    day === selectedDate.getUTCDate();

  return (
    <div className={styles.container} ref={containerRef}>
      <button type="button" className={styles.trigger} onClick={openPicker}>
        {String(selectedDate.getUTCDate()).padStart(2, "0")}/
        {String(selectedDate.getUTCMonth() + 1).padStart(2, "0")}/
        {selectedDate.getUTCFullYear()}
      </button>
      {isOpen && (
        <div className={styles.dropdown}>
          <div className={styles.header}>
            <button type="button" className={styles.navButton} onClick={prevMonth}>
              ‹
            </button>
            <span className={styles.monthLabel}>
              {t("common.months", { returnObjects: true })[viewMonth - 1]} {viewYear}
            </span>
            <button type="button" className={styles.navButton} onClick={nextMonth}>
              ›
            </button>
          </div>
          <div className={styles.weekdayRow}>
            {t("datePicker.weekdays", { returnObjects: true }).map((label) => (
              <span key={label} className={styles.weekdayLabel}>
                {label}
              </span>
            ))}
          </div>
          <div className={styles.dayGrid}>
            {cells.map((day, index) => (
              <button
                type="button"
                key={index}
                className={
                  day === null
                    ? styles.dayCellEmpty
                    : isSelected(day)
                      ? styles.dayCellSelected
                      : styles.dayCell
                }
                disabled={day === null}
                onClick={() => day !== null && selectDay(day)}
              >
                {day}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default DatePicker;
```

- [ ] **Step 2: Build check**

Run from `frontend/`: `npm run build`

Expected: success, no errors.

- [ ] **Step 3: Manual verification**

With both servers running, hard refresh the browser:

1. Go to `/log`, open the custom date picker (used for e.g. workout templates' date selection). In Croatian, confirm month name and weekday abbreviations (Po/Ut/Sr/Če/Pe/Su/Ne) render exactly as before (no visible change expected in `hr` mode — values are unchanged from the prior hardcoded ones).
2. Switch to English in Settings, reopen the date picker. Confirm the month name matches Calendar's English month names, and weekday abbreviations now read Mo/Tu/We/Th/Fr/Sa/Su.
3. Confirm picking a day still correctly updates the bound date field (unrelated to translation, but worth confirming nothing broke).

- [ ] **Step 4: Review and commit**

```bash
git add frontend/src/components/DatePicker.jsx
git diff --cached
```

STOP. Report full diff. Wait for confirmation.

After confirmation: `git commit -m "feat: translate DatePicker component"`
