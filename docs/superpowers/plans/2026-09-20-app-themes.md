# Multi-Theme Support Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 6 selectable themes (Dark Red default, Light, Dark Blue, Dark Green, Amber, Pure Black), applying app-wide instantly and persisting, picked via a swatch-dropdown in Settings.

**Architecture:** Every CSS Module already reads colors through custom properties defined once in `frontend/src/index.css`. A `data-theme` attribute on `<html>` selects which of 5 new `[data-theme="..."]` override blocks applies (Dark Red stays the `:root` default, so untouched installs see zero change). Four new tokens (`--color-bg-elevated`, `--color-bg-hover`, `--color-nav-bg`, `--color-accent-rgb`) close color leaks found in 10 CSS files that bypass the token system today. Two Recharts-based charts (`Dashboard.jsx`, `Stats.jsx`) read their colors from JS, not CSS, so they get a small shared helper that reads the live CSS variable values. The theme choice lives on the `Settings` row, same mechanism as the language toggle (instant apply + background persist, no separate Save click).

**Tech Stack:** React + CSS Modules (frontend), Express + Prisma (backend). No test framework — verification is `npm run build` plus manual checks.

**Spec:** `docs/superpowers/specs/2026-09-20-app-themes-design.md`

---

### Task 1: Backend — `theme` column on Settings

**Files:**
- Modify: `backend/prisma/schema.prisma`
- Create: a new Prisma migration (generated)

- [ ] **Step 1: Add the column**

In `backend/prisma/schema.prisma`, find the `Settings` model (it currently ends with `language   String @default("hr")` before the closing brace — this field was added in an earlier plan). Add `theme` right after it:

```prisma
  language   String @default("hr")
  theme      String @default("dark-red")
```

- [ ] **Step 2: Generate and apply the migration**

Run from `backend/`:

```bash
npx prisma migrate dev --name add_theme_setting
```

Expected: a new folder under `backend/prisma/migrations/`, applied cleanly (purely additive column with a default, same pattern as the `language` migration before it — no data loss).

- [ ] **Step 3: Verify**

Run from `backend/`: `npm start`, then:

```bash
curl -s http://localhost:3001/api/settings
```

Expected: response includes `"theme":"dark-red"`. Stop the backend afterward.

- [ ] **Step 4: Review and commit**

```bash
git add backend/prisma/schema.prisma backend/prisma/migrations
git diff --cached
```

STOP. Report full diff. Wait for confirmation.

After confirmation: `git commit -m "feat: add theme column to Settings"`

---

### Task 2: `index.css` — token additions + 5 theme blocks

**Files:**
- Modify: `frontend/src/index.css`

- [ ] **Step 1: Replace the `:root` block**

Current:

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
  --color-text-placeholder: #888;
  --color-protein: #7fa8d9;
  --color-carbs: #d99a5c;
  --color-fat: #d9c25c;
  --color-success: #5cb87a;
}
```

Replace with:

```css
:root {
  --color-bg: #0d0d0d;
  --color-bg-card: #141414;
  --color-bg-elevated: #1e1e1e;
  --color-bg-hover: #1a1a1a;
  --color-nav-bg: #111;
  --color-accent: #ff3b3b;
  --color-accent-rgb: 255, 59, 59;
  --color-text: #f0f0f0;
  --color-text-dim: #666;
  --font-mono: ui-monospace, "Cascadia Code", "Consolas", monospace;
  --color-border: #444;
  --color-border-subtle: #222;
  --color-text-placeholder: #888;
  --color-protein: #7fa8d9;
  --color-carbs: #d99a5c;
  --color-fat: #d9c25c;
  --color-success: #5cb87a;
}

[data-theme="light"] {
  --color-bg: #f4f2ee;
  --color-bg-card: #ffffff;
  --color-bg-elevated: #ffffff;
  --color-bg-hover: #e8e6e0;
  --color-nav-bg: #ffffff;
  --color-accent: #c62828;
  --color-accent-rgb: 198, 40, 40;
  --color-text: #1a1a1a;
  --color-text-dim: #767676;
  --color-text-placeholder: #999999;
  --color-border: #d8d5cf;
  --color-border-subtle: #e8e6e0;
}

[data-theme="dark-blue"] {
  --color-bg: #0a0e14;
  --color-bg-card: #111823;
  --color-bg-elevated: #182233;
  --color-bg-hover: #16202e;
  --color-nav-bg: #0d131c;
  --color-accent: #3ba7ff;
  --color-accent-rgb: 59, 167, 255;
  --color-text: #e8edf4;
  --color-text-dim: #5a6b7d;
  --color-text-placeholder: #6f8194;
  --color-border: #2c3b4d;
  --color-border-subtle: #1a2530;
}

[data-theme="dark-green"] {
  --color-bg: #0a0f0a;
  --color-bg-card: #111a11;
  --color-bg-elevated: #182618;
  --color-bg-hover: #162016;
  --color-nav-bg: #0d130d;
  --color-accent: #3ec95c;
  --color-accent-rgb: 62, 201, 92;
  --color-text: #e8f4e8;
  --color-text-dim: #5c7d5c;
  --color-text-placeholder: #729172;
  --color-border: #2c4a2c;
  --color-border-subtle: #1a2a1a;
}

[data-theme="amber"] {
  --color-bg: #120e08;
  --color-bg-card: #1c1710;
  --color-bg-elevated: #241d13;
  --color-bg-hover: #20190f;
  --color-nav-bg: #16110a;
  --color-accent: #ffb020;
  --color-accent-rgb: 255, 176, 32;
  --color-text: #f4ecd9;
  --color-text-dim: #8a7355;
  --color-text-placeholder: #a08a6a;
  --color-border: #4a3d28;
  --color-border-subtle: #241d13;
}

[data-theme="pure-black"] {
  --color-bg: #000000;
  --color-bg-card: #0a0a0a;
  --color-bg-elevated: #141414;
  --color-bg-hover: #111111;
  --color-nav-bg: #000000;
  --color-accent: #ffffff;
  --color-accent-rgb: 255, 255, 255;
  --color-text: #ffffff;
  --color-text-dim: #777777;
  --color-text-placeholder: #999999;
  --color-border: #333333;
  --color-border-subtle: #1a1a1a;
}
```

`--color-protein`/`--color-carbs`/`--color-fat`/`--color-success` are intentionally NOT repeated in the theme blocks — per the design spec, these stay constant across all themes (semantic/data colors, not surface chrome), so they only need to exist once in `:root` and every theme inherits them unchanged.

- [ ] **Step 2: Build check**

Run from `frontend/`: `npm run build`

Expected: success, no errors. (No visible change yet — nothing sets `data-theme` until Task 3, and Dark Red's values are unchanged from before.)

- [ ] **Step 3: Review and commit**

```bash
git add frontend/src/index.css
git diff --cached
```

STOP. Report full diff. Wait for confirmation.

After confirmation: `git commit -m "feat: add theme tokens and 5 theme variants to index.css"`

---

### Task 3: `App.jsx` — apply saved theme on load

**Files:**
- Modify: `frontend/src/App.jsx`

- [ ] **Step 1: Extend the existing bootstrap effect**

Find:

```jsx
  useEffect(() => {
    fetchJson("/api/settings")
      .then((data) => {
        if (data?.language && data.language !== i18n.language) {
          i18n.changeLanguage(data.language);
        }
      })
      .catch((err) => console.error(err));
  }, []);
```

Replace with:

```jsx
  useEffect(() => {
    fetchJson("/api/settings")
      .then((data) => {
        if (data?.language && data.language !== i18n.language) {
          i18n.changeLanguage(data.language);
        }
        if (data?.theme && data.theme !== "dark-red") {
          document.documentElement.setAttribute("data-theme", data.theme);
        }
      })
      .catch((err) => console.error(err));
  }, []);
```

`"dark-red"` never needs `setAttribute` — it's the `:root` default with no `[data-theme]` block of its own, so leaving the attribute unset (or explicitly `"dark-red"`) renders identically. Guarding against setting it avoids an unnecessary DOM attribute write on the most common case (nobody has changed the default).

- [ ] **Step 2: Build check**

Run from `frontend/`: `npm run build`

Expected: success, no errors.

- [ ] **Step 3: Review and commit**

```bash
git add frontend/src/App.jsx
git diff --cached
```

STOP. Report full diff. Wait for confirmation.

After confirmation: `git commit -m "feat: apply saved theme on app load"`

---

### Task 4: Fix hardcoded colors — shared components

**Files:**
- Modify: `frontend/src/components/DatePicker.module.css`
- Modify: `frontend/src/components/ExerciseCard.module.css`
- Modify: `frontend/src/components/MealCard.module.css`
- Modify: `frontend/src/components/Navbar.css`
- Modify: `frontend/src/components/RestTimer.module.css`
- Modify: `frontend/src/components/ToastContainer.module.css`

Every change below is a pure value swap (hardcoded color → token) — no selectors, structure, or unrelated properties change.

- [ ] **Step 1: `DatePicker.module.css`**

Find (in `.dropdown`):
```css
  background-color: #1e1e1e;
```
Replace with:
```css
  background-color: var(--color-bg-elevated);
```

Find (in `.dayCell:hover`):
```css
.dayCell:hover {
  background-color: #2a2a2a;
}
```
Replace with:
```css
.dayCell:hover {
  background-color: var(--color-bg-hover);
}
```

- [ ] **Step 2: `ExerciseCard.module.css`**

Find (in `.menuDropdown`):
```css
  background-color: #1e1e1e;
```
Replace with:
```css
  background-color: var(--color-bg-elevated);
```

- [ ] **Step 3: `MealCard.module.css`**

This file has the SAME `background-color: #1e1e1e;` line appearing twice (in `.menuDropdown` and again in `.itemPicker`). Replace BOTH occurrences with `background-color: var(--color-bg-elevated);` — use a find-and-replace-all approach for this exact file rather than assuming line numbers, since both instances are identical text.

- [ ] **Step 4: `Navbar.css`**

Find:
```css
nav {
  display: flex;
  gap: 1.5rem;
  padding: 1rem 1.5rem;
  background-color: #111;
  border-bottom: 1px solid var(--color-border-subtle);
}
```
Replace with:
```css
nav {
  display: flex;
  gap: 1.5rem;
  padding: 1rem 1.5rem;
  background-color: var(--color-nav-bg);
  border-bottom: 1px solid var(--color-border-subtle);
}
```

- [ ] **Step 5: `RestTimer.module.css`**

This file has `background-color: #1e1e1e;` appearing FOUR times (`.toggleBar`, `.presetRow`, `.timerCard`, and inside the `@keyframes pulse` block's `0%, 100%` stop). Replace ALL FOUR occurrences with `background-color: var(--color-bg-elevated);`.

Additionally, find:
```css
  50% {
    background-color: rgba(255, 59, 59, 0.15);
  }
```
Replace with:
```css
  50% {
    background-color: rgba(var(--color-accent-rgb), 0.15);
  }
```

- [ ] **Step 6: `ToastContainer.module.css`**

Find (in `.toastError, .toastSuccess`):
```css
  background-color: #1e1e1e;
```
Replace with:
```css
  background-color: var(--color-bg-elevated);
```

- [ ] **Step 7: Build check**

Run from `frontend/`: `npm run build`

Expected: success, no errors. Visually, nothing should look different yet under the default Dark Red theme — these tokens' Dark Red values are identical to what was hardcoded (e.g. `--color-bg-elevated: #1e1e1e` matches the literal `#1e1e1e` being replaced).

- [ ] **Step 8: Review and commit**

```bash
git add frontend/src/components/DatePicker.module.css frontend/src/components/ExerciseCard.module.css frontend/src/components/MealCard.module.css frontend/src/components/Navbar.css frontend/src/components/RestTimer.module.css frontend/src/components/ToastContainer.module.css
git diff --cached
```

STOP. Report full diff. Wait for confirmation.

After confirmation: `git commit -m "fix: route component dropdown/hover colors through theme tokens"`

---

### Task 5: Fix hardcoded colors — pages

**Files:**
- Modify: `frontend/src/pages/Calendar.module.css`
- Modify: `frontend/src/pages/Dashboard.module.css`
- Modify: `frontend/src/pages/Log.module.css`
- Modify: `frontend/src/pages/Stats.module.css`

- [ ] **Step 1: `Calendar.module.css`**

Find (in `.dayCell:hover`):
```css
.dayCell:hover {
  background-color: #1a1a1a;
}
```
Replace with:
```css
.dayCell:hover {
  background-color: var(--color-bg-hover);
}
```

Find (in `.dropdown`):
```css
  background-color: #1e1e1e;
```
Replace with:
```css
  background-color: var(--color-bg-elevated);
```

Find (in `.cellBw`) — this is the incidental bug fix (see Task context):
```css
.cellBw {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 0.65rem;
  color: #4caf50;
  margin-top: 2px;
  width: 100%;
}
```
Replace with:
```css
.cellBw {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 0.65rem;
  color: var(--color-success);
  margin-top: 2px;
  width: 100%;
}
```

- [ ] **Step 2: `Dashboard.module.css`**

This file has `background-color: #1a1a1a;` appearing TWICE (in `.clickableCard:hover` and `.weekDayRow:hover`). Replace BOTH occurrences with `background-color: var(--color-bg-hover);`.

- [ ] **Step 3: `Log.module.css`**

Find (in `.exercisePicker`):
```css
  background-color: #1e1e1e;
```
Replace with:
```css
  background-color: var(--color-bg-elevated);
```

Find (in `.exercisePickerRemove`) — this is the incidental bug fix (see Task context):
```css
.exercisePickerRemove {
  background: transparent;
  border: none;
  color: #444;
  font-size: 0.75rem;
  cursor: pointer;
  padding: 10px 12px;
}
```
Replace with:
```css
.exercisePickerRemove {
  background: transparent;
  border: none;
  color: var(--color-border);
  font-size: 0.75rem;
  cursor: pointer;
  padding: 10px 12px;
}
```

- [ ] **Step 4: `Stats.module.css`**

Find (in `.manageMenuDropdown`):
```css
  background-color: #1e1e1e;
```
Replace with:
```css
  background-color: var(--color-bg-elevated);
```

Find:
```css
.recentPrRow:hover {
  background-color: #1a1a1a;
}

.recentPrRowActive {
  border-left-width: 6px;
  background-color: rgba(255, 59, 59, 0.08);
}

.recentPrRowActive:hover {
  background-color: rgba(255, 59, 59, 0.14);
}
```
Replace with:
```css
.recentPrRow:hover {
  background-color: var(--color-bg-hover);
}

.recentPrRowActive {
  border-left-width: 6px;
  background-color: rgba(var(--color-accent-rgb), 0.08);
}

.recentPrRowActive:hover {
  background-color: rgba(var(--color-accent-rgb), 0.14);
}
```

## Context for the two bug fixes in this task

`Calendar.module.css`'s `.cellBw` used `#4caf50` (a different green) instead of the already-existing `--color-success` token (`#5cb87a`) — same semantic meaning (a logged/success indicator), two different hardcoded greens. `Log.module.css`'s `.exercisePickerRemove` used `#444`, which is byte-identical to `--color-border`'s Dark Red value — it should have been the token all along. Both are fixed here because they're in files already being touched for the same underlying reason (hardcoded color that should be a token), not because they were separately investigated as their own task.

- [ ] **Step 5: Build check**

Run from `frontend/`: `npm run build`

Expected: success, no errors.

- [ ] **Step 6: Manual verification**

Hard refresh the browser under the still-default Dark Red theme. Confirm: Calendar's bodyweight ⚖ indicator is visually the same shade of green as before (token's default value matches the old hardcoded one — this is a refactor, not a visible change yet). Log's "remove exercise" ✕ in the exercise picker still looks the same gray as before.

- [ ] **Step 7: Review and commit**

```bash
git add frontend/src/pages/Calendar.module.css frontend/src/pages/Dashboard.module.css frontend/src/pages/Log.module.css frontend/src/pages/Stats.module.css
git diff --cached
```

STOP. Report full diff. Wait for confirmation.

After confirmation: `git commit -m "fix: route page dropdown/hover colors through theme tokens; fix 2 stray hardcoded colors"`

---

### Task 6: Chart colors follow the theme (Dashboard, Stats)

**Files:**
- Create: `frontend/src/utils/theme.js`
- Modify: `frontend/src/pages/Dashboard.jsx`
- Modify: `frontend/src/pages/Stats.jsx`

- [ ] **Step 1: Create the shared helper**

Create `frontend/src/utils/theme.js`:

```js
export function getCssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}
```

- [ ] **Step 2: Update `Dashboard.jsx`**

Find:

```jsx
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { fetchJson } from "../api";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { useToast } from "../context/useToast";
import MuscleGroupVolumeChart from "../components/MuscleGroupVolumeChart";
import styles from "./Dashboard.module.css";
```

Replace with:

```jsx
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { fetchJson } from "../api";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { useToast } from "../context/useToast";
import { getCssVar } from "../utils/theme";
import MuscleGroupVolumeChart from "../components/MuscleGroupVolumeChart";
import styles from "./Dashboard.module.css";
```

Find:

```jsx
function Dashboard() {
  const navigate = useNavigate();
  const { showError } = useToast();
```

Replace with:

```jsx
function Dashboard() {
  const navigate = useNavigate();
  const { showError } = useToast();
  const chartAccentColor = getCssVar("--color-accent");
  const chartTextDimColor = getCssVar("--color-text-dim");
  const chartBgCardColor = getCssVar("--color-bg-card");
  const chartBorderColor = getCssVar("--color-border");
  const chartTextColor = getCssVar("--color-text");
```

Find:

```jsx
              <XAxis dataKey="label" tick={{ fill: "#666", fontFamily: "ui-monospace", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#666", fontFamily: "ui-monospace", fontSize: 11 }} axisLine={false} tickLine={false} domain={["auto", "auto"]} />
                <Tooltip
                  contentStyle={{ background: "#141414", border: "1px solid #444", fontFamily: "ui-monospace", fontSize: 12 }}
                  labelStyle={{ color: "#666" }}
                  itemStyle={{ color: "#f0f0f0" }}
                />
                <Line type="monotone" dataKey="weight" stroke="#ff3b3b" strokeWidth={2} dot={{ fill: "#ff3b3b", r: 3 }} activeDot={{ r: 5 }} />
```

Replace with:

```jsx
              <XAxis dataKey="label" tick={{ fill: chartTextDimColor, fontFamily: "ui-monospace", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: chartTextDimColor, fontFamily: "ui-monospace", fontSize: 11 }} axisLine={false} tickLine={false} domain={["auto", "auto"]} />
                <Tooltip
                  contentStyle={{ background: chartBgCardColor, border: `1px solid ${chartBorderColor}`, fontFamily: "ui-monospace", fontSize: 12 }}
                  labelStyle={{ color: chartTextDimColor }}
                  itemStyle={{ color: chartTextColor }}
                />
                <Line type="monotone" dataKey="weight" stroke={chartAccentColor} strokeWidth={2} dot={{ fill: chartAccentColor, r: 3 }} activeDot={{ r: 5 }} />
```

(Indentation in the "find" blocks above matches the file's actual nesting — the `<XAxis>` line has 14 leading spaces, not what the surrounding markdown code fence visually suggests; match against the actual file content, not this document's rendering.)

- [ ] **Step 3: Update `Stats.jsx`**

Find:

```jsx
import { useState, useEffect, useRef, useCallback, Fragment } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { fetchJson } from "../api";
import { findBestSetByE1rm, ONE_REP_MAX_FORMULAS } from "../utils/oneRepMax";
import { useToast } from "../context/useToast";
import MuscleGroupVolumeChart from "../components/MuscleGroupVolumeChart";
import styles from "./Stats.module.css";
```

Replace with:

```jsx
import { useState, useEffect, useRef, useCallback, Fragment } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { fetchJson } from "../api";
import { findBestSetByE1rm, ONE_REP_MAX_FORMULAS } from "../utils/oneRepMax";
import { useToast } from "../context/useToast";
import { getCssVar } from "../utils/theme";
import MuscleGroupVolumeChart from "../components/MuscleGroupVolumeChart";
import styles from "./Stats.module.css";
```

Find:

```jsx
function Stats() {
  const { showError } = useToast();
  const [prs, setPrs] = useState([]);
```

Replace with:

```jsx
function Stats() {
  const { showError } = useToast();
  const chartAccentColor = getCssVar("--color-accent");
  const chartTextDimColor = getCssVar("--color-text-dim");
  const chartBgCardColor = getCssVar("--color-bg-card");
  const chartBorderColor = getCssVar("--color-border");
  const chartTextColor = getCssVar("--color-text");
  const [prs, setPrs] = useState([]);
```

Find:

```jsx
            <LineChart data={chartData}>
              <XAxis dataKey="label" tick={{ fill: "#666", fontFamily: "ui-monospace", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#666", fontFamily: "ui-monospace", fontSize: 11 }} axisLine={false} tickLine={false} domain={["auto", "auto"]} />
              <Tooltip
                contentStyle={{ background: "#141414", border: "1px solid #444", fontFamily: "ui-monospace", fontSize: 12 }}
                labelStyle={{ color: "#666" }}
                itemStyle={{ color: "#f0f0f0" }}
                formatter={(value) => [`${value}kg`, "e1RM"]}
              />
              <Line type="monotone" dataKey="e1rm" stroke="#ff3b3b" strokeWidth={2} dot={{ fill: "#ff3b3b", r: 3 }} activeDot={{ r: 5 }} />
            </LineChart>
```

Replace with:

```jsx
            <LineChart data={chartData}>
              <XAxis dataKey="label" tick={{ fill: chartTextDimColor, fontFamily: "ui-monospace", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: chartTextDimColor, fontFamily: "ui-monospace", fontSize: 11 }} axisLine={false} tickLine={false} domain={["auto", "auto"]} />
              <Tooltip
                contentStyle={{ background: chartBgCardColor, border: `1px solid ${chartBorderColor}`, fontFamily: "ui-monospace", fontSize: 12 }}
                labelStyle={{ color: chartTextDimColor }}
                itemStyle={{ color: chartTextColor }}
                formatter={(value) => [`${value}kg`, "e1RM"]}
              />
              <Line type="monotone" dataKey="e1rm" stroke={chartAccentColor} strokeWidth={2} dot={{ fill: chartAccentColor, r: 3 }} activeDot={{ r: 5 }} />
            </LineChart>
```

## Context: why this is safe without a theme context/listener

`react-router-dom` renders exactly one page `<Route>`'s component tree at a time — `Dashboard` and `Stats` fully unmount when you navigate to Settings (where the theme is changed) and fully remount when you navigate back. By the time either component's function body runs again, `document.documentElement` already has the current `data-theme` attribute applied (from `App.jsx`'s bootstrap, which runs once above all routes). Reading the CSS variables at the top of the render function is therefore always correct — no live-reactivity plumbing needed for a value that's only ever read once per mount, on a component that never needs to reflect a theme change while it's already on screen.

- [ ] **Step 4: Build check**

Run from `frontend/`: `npm run build`

Expected: success, no errors.

- [ ] **Step 5: Manual verification**

With both servers running, hard refresh, under Dark Red: confirm Dashboard's bodyweight chart and Stats' progress chart look unchanged from before (values match the old hardcoded hex exactly). This step alone won't prove theme-switching works yet — Task 7 adds the picker that makes that testable.

- [ ] **Step 6: Review and commit**

```bash
git add frontend/src/utils/theme.js frontend/src/pages/Dashboard.jsx frontend/src/pages/Stats.jsx
git diff --cached
```

STOP. Report full diff. Wait for confirmation.

After confirmation: `git commit -m "feat: make Dashboard/Stats chart colors theme-aware"`

---

### Task 7: Settings — swatch-dropdown theme picker

**Files:**
- Modify: `frontend/src/pages/Settings.jsx`
- Modify: `frontend/src/pages/Settings.module.css`

- [ ] **Step 1: Add theme state and handler**

Find (near the top of the component, after the existing `changeLanguage` function):

```jsx
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
```

Replace with:

```jsx
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

  const changeTheme = (theme) => {
    if (theme === "dark-red") {
      document.documentElement.removeAttribute("data-theme");
    } else {
      document.documentElement.setAttribute("data-theme", theme);
    }
    setSettings((prev) => ({ ...prev, theme }));
    setThemeMenuOpen(false);
    fetchJson("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ theme }),
    }).catch((err) => {
      console.error(err);
      showError(err.message);
    });
  };
```

(Using `removeAttribute` for `"dark-red"` rather than `setAttribute("data-theme", "dark-red")` — there's no `[data-theme="dark-red"]` CSS block, since Dark Red lives in `:root`, so removing the attribute entirely is the correct way to return to it, matching how `App.jsx`'s bootstrap also skips setting it for that case.)

- [ ] **Step 2: Add the theme list constant and open/close state**

Find:

```jsx
const E1RM_FORMULA_LABELS = {
  [ONE_REP_MAX_FORMULAS.brzycki]: "Brzycki",
  [ONE_REP_MAX_FORMULAS.epley]: "Epley",
  [ONE_REP_MAX_FORMULAS.lombardi]: "Lombardi",
};
```

Replace with:

```jsx
const E1RM_FORMULA_LABELS = {
  [ONE_REP_MAX_FORMULAS.brzycki]: "Brzycki",
  [ONE_REP_MAX_FORMULAS.epley]: "Epley",
  [ONE_REP_MAX_FORMULAS.lombardi]: "Lombardi",
};

const THEMES = [
  { value: "dark-red", label: "Dark Red", swatch: "#ff3b3b" },
  { value: "light", label: "Light", swatch: "#c62828" },
  { value: "dark-blue", label: "Dark Blue", swatch: "#3ba7ff" },
  { value: "dark-green", label: "Dark Green", swatch: "#3ec95c" },
  { value: "amber", label: "Amber", swatch: "#ffb020" },
  { value: "pure-black", label: "Pure Black", swatch: "#ffffff" },
];
```

Find:

```jsx
  const { t, i18n } = useTranslation();
  const { showError, showSuccess } = useToast();
  const [settings, setSettings] = useState(null);
```

Replace with:

```jsx
  const { t, i18n } = useTranslation();
  const { showError, showSuccess } = useToast();
  const [settings, setSettings] = useState(null);
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);
```

- [ ] **Step 3: Add click-outside handling for the theme menu**

Find (the existing click-outside effect pattern used elsewhere in this codebase doesn't exist yet in `Settings.jsx` — this is new to this file, but matches the pattern already used in `Stats.jsx`'s `manageMenuFor` and `Calendar.jsx`'s `activeDropdown`). Add this new `useEffect` directly after the existing settings-fetch `useEffect`:

Find:

```jsx
  useEffect(() => {
    fetchJson("/api/settings")
      .then((data) => setSettings(data))
      .catch((err) => {
        console.error(err);
        showError(err.message);
      });
  }, [showError]);
```

Replace with:

```jsx
  useEffect(() => {
    fetchJson("/api/settings")
      .then((data) => setSettings(data))
      .catch((err) => {
        console.error(err);
        showError(err.message);
      });
  }, [showError]);

  useEffect(() => {
    if (!themeMenuOpen) return undefined;
    const handleClickOutside = (event) => {
      if (!event.target.closest("[data-theme-menu]")) {
        setThemeMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [themeMenuOpen]);
```

- [ ] **Step 4: Add the picker UI**

Find:

```jsx
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
```

Replace with:

```jsx
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
        <span className={styles.fieldLabel}>{t("settings.theme")}</span>
        <div className={styles.themePicker} data-theme-menu>
          <button
            type="button"
            className={styles.themeTrigger}
            onClick={() => setThemeMenuOpen((prev) => !prev)}
          >
            <span
              className={styles.themeDot}
              style={{ backgroundColor: THEMES.find((theme) => theme.value === (settings?.theme || "dark-red"))?.swatch }}
            />
            <span>{THEMES.find((theme) => theme.value === (settings?.theme || "dark-red"))?.label}</span>
            <span className={styles.themeCaret}>{themeMenuOpen ? "▴" : "▾"}</span>
          </button>
          {themeMenuOpen && (
            <div className={styles.themeDropdown}>
              {THEMES.map((theme) => (
                <button
                  type="button"
                  key={theme.value}
                  className={
                    theme.value === (settings?.theme || "dark-red")
                      ? `${styles.themeOption} ${styles.themeOptionActive}`
                      : styles.themeOption
                  }
                  onClick={() => changeTheme(theme.value)}
                >
                  <span className={styles.themeDot} style={{ backgroundColor: theme.swatch }} />
                  <span>{theme.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
```

`settings.theme` is a new translation key (`"Tema"` / `"Theme"`) — added in Step 5 below. Theme names themselves (`"Dark Red"`, `"Light"`, etc.) are intentionally left untranslated, same reasoning as `THEMES`' color values: they're proper-noun-style labels for a visual choice, not sentence copy — same treatment as the language picker's own "Hrvatski"/"English" option labels not being translated.

- [ ] **Step 5: Add the `settings.theme` translation key**

In `frontend/src/i18n/locales/hr.json`, find the `settings.language` line:

```json
    "language": "Jezik",
```

Replace with:

```json
    "language": "Jezik",
    "theme": "Tema",
```

In `frontend/src/i18n/locales/en.json`, find:

```json
    "language": "Language",
```

Replace with:

```json
    "language": "Language",
    "theme": "Theme",
```

- [ ] **Step 6: Add the picker's CSS**

In `frontend/src/pages/Settings.module.css`, find the `.languageSelect` rules:

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

Add these new rules directly after that block:

```css
.themePicker {
  position: relative;
}

.themeTrigger {
  display: flex;
  align-items: center;
  gap: 8px;
  background: transparent;
  border: none;
  border-bottom: 1px solid var(--color-border);
  color: var(--color-text);
  font-family: var(--font-mono);
  font-size: 0.85rem;
  padding: 4px 2px;
  outline: none;
  width: 160px;
  cursor: pointer;
}

.themeTrigger:hover {
  border-bottom-color: var(--color-accent);
}

.themeCaret {
  color: var(--color-text-dim);
  font-size: 0.7rem;
  margin-left: auto;
}

.themeDot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
  display: inline-block;
}

.themeDropdown {
  position: absolute;
  top: 100%;
  left: 0;
  z-index: 20;
  background-color: var(--color-bg-elevated);
  border: 1px solid var(--color-border);
  min-width: 160px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
}

.themeOption {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  background: transparent;
  border: none;
  color: var(--color-text);
  font-family: var(--font-mono);
  font-size: 0.8rem;
  padding: 8px 10px;
  text-align: left;
  cursor: pointer;
}

.themeOption:hover {
  background-color: var(--color-bg-hover);
}

.themeOptionActive {
  background-color: rgba(var(--color-accent-rgb), 0.1);
}
```

- [ ] **Step 7: Build check**

Run from `frontend/`: `npm run build`

Expected: success, no errors.

- [ ] **Step 8: Manual verification**

With `backend/` (`npm start`) and `frontend/` (`npm run dev`) running, hard refresh, go to `/settings`:

1. New "Jezik"-style field labeled "Tema" (or "Theme" in English) shows a closed trigger with a red dot + "Dark Red".
2. Click it — dropdown opens showing all 6 themes, each with its own colored dot, Dark Red highlighted as current.
3. Click "Light" — confirm the ENTIRE app (not just this page) switches instantly: NavBar, this Settings page itself, the field inputs, everything. No page reload.
4. Navigate to Dashboard, Log, Nutrition, Calendar, Calculator, Stats — spot-check each one looks coherently "Light" (not a mix of light and dark-red leftovers). Pay particular attention to any open dropdown/menu on each page (Log's exercise picker, Calendar's day menu, Stats' manage menu, ExerciseCard's kebab menu, RestTimer if a timer is running) and hover states.
5. On Dashboard and Stats specifically, confirm the line charts' axis text, tooltip, and line color all match the Light theme, not stuck looking dark.
6. Reload the browser — confirm Light persisted (proves the `PUT` + `App.jsx` bootstrap round-trip).
7. Cycle through the remaining 4 themes (Dark Blue, Dark Green, Amber, Pure Black) the same way — at least a quick visual pass on Dashboard/Settings/one dropdown for each, not the full 6-page audit every time.
8. Switch back to Dark Red — confirm everything returns to exactly how it looked before this feature existed.

- [ ] **Step 9: Review and commit**

```bash
git add frontend/src/pages/Settings.jsx frontend/src/pages/Settings.module.css frontend/src/i18n/locales/hr.json frontend/src/i18n/locales/en.json
git diff --cached
```

STOP. Report full diff. Wait for confirmation.

After confirmation: `git commit -m "feat: add theme picker to Settings"`
