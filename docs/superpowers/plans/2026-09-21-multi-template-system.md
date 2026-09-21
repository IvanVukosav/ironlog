# Multi-Template Visual System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 6 selectable visual templates (Terminal default, Soft, Neon, Warm, Glass, Material) — different fonts/card shapes/button treatments/shadows, orthogonal to the existing 6 color themes — applied instantly and persisted, picked via a Settings dropdown. Rolled out to Dashboard, Settings, and NavBar (scope explicitly reduced from "every page" per `docs/superpowers/specs/2026-09-21-multi-template-system-design.md`; remaining pages/components are deferred follow-up work).

**Architecture:** New CSS custom-property tokens (typography/card/button/input/dropdown), defined per-template under `[data-template="x"]` blocks in `index.css`, exactly mirroring the already-shipped color-theme mechanism. A new set of shared "building block" primitive classes (`.button`, `.input`, `.dropdown`, `.dropdownItem`, alongside the existing `.card`/`.label`/`.value`) in `frontend/src/styles/shared.module.css` — a deliberate, explicitly user-approved exception to this codebase's "no CSS Modules composes" convention, scoped to template-driven primitives only.

**Tech Stack:** Express + Prisma (backend), React + CSS Modules (frontend). No test framework — verification is `npm run build` plus manual checks.

**Spec:** `docs/superpowers/specs/2026-09-21-multi-template-system-design.md`

---

### Task 1: Backend — `template` column on Settings

**Files:**
- Modify: `backend/prisma/schema.prisma`
- Create: a new Prisma migration (generated)

- [ ] **Step 1: Add the column**

In `backend/prisma/schema.prisma`, find the `Settings` model's `theme` line (the last field before the closing brace):

```prisma
  theme      String @default("dark-red")
```

Add `template` right after it:

```prisma
  theme      String @default("dark-red")
  template   String @default("terminal")
```

- [ ] **Step 2: Generate and apply the migration**

Run from `backend/`:

```bash
npx prisma migrate dev --name add_template_setting
```

Expected: a new folder under `backend/prisma/migrations/`, applied cleanly (purely additive column with a default, same pattern as the `theme`/`language` migrations before it).

- [ ] **Step 3: Verify**

Run from `backend/`: `npm start`, then:

```bash
curl -s http://localhost:3001/api/settings
```

Expected: response includes `"template":"terminal"`. Stop the backend afterward.

- [ ] **Step 4: Review and commit**

```bash
git add backend/prisma/schema.prisma backend/prisma/migrations
git diff --cached
```

STOP. Report full diff. Wait for confirmation.

After confirmation: `git commit -m "feat: add template column to Settings"`

---

### Task 2: `index.css` — template tokens + 5 template blocks

**Files:**
- Modify: `frontend/src/index.css`

- [ ] **Step 1: Add Terminal's template tokens to `:root`**

Find the end of the existing `:root` block:

```css
  --color-protein: #7fa8d9;
  --color-carbs: #d99a5c;
  --color-fat: #d9c25c;
  --color-success: #5cb87a;
}
```

Replace with:

```css
  --color-protein: #7fa8d9;
  --color-carbs: #d99a5c;
  --color-fat: #d9c25c;
  --color-success: #5cb87a;
  --font-body: var(--font-mono);
  --heading-weight: 700;
  --card-bg: var(--color-bg-card);
  --card-border: none;
  --card-radius: 0;
  --card-shadow: inset 3px 0 0 var(--color-accent);
  --card-blur: none;
  --card-padding: 1rem;
  --button-bg: transparent;
  --button-color: var(--color-accent);
  --button-radius: 0;
  --button-padding: 4px 0;
  --button-border: none;
  --button-shadow: none;
  --button-weight: 400;
  --button-transform: none;
  --button-before: "[ ";
  --button-after: " ]";
  --input-bg: transparent;
  --input-border: none;
  --input-border-bottom: 1px solid var(--color-border);
  --input-radius: 0;
  --input-padding: 4px 2px;
  --dropdown-bg: var(--color-bg-elevated);
  --dropdown-border: 1px solid var(--color-border);
  --dropdown-radius: 0;
  --dropdown-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
}
```

- [ ] **Step 2: Add the 5 new `[data-template="..."]` blocks**

Find the end of the last color-theme block (`[data-theme="pure-black"]`) and the start of the `* { ... }` reset rule:

```css
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

* {
```

Replace with:

```css
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

[data-template="soft"] {
  --font-body: -apple-system, "Segoe UI", Inter, sans-serif;
  --heading-weight: 600;
  --card-bg: var(--color-bg-card);
  --card-border: none;
  --card-radius: 14px;
  --card-shadow: 0 2px 10px rgba(0, 0, 0, 0.08);
  --card-blur: none;
  --card-padding: 1.1rem;
  --button-bg: var(--color-accent);
  --button-color: var(--color-bg);
  --button-radius: 20px;
  --button-padding: 7px 16px;
  --button-border: none;
  --button-shadow: none;
  --button-weight: 600;
  --button-transform: none;
  --button-before: "";
  --button-after: "";
  --input-bg: var(--color-bg-card);
  --input-border: 1px solid var(--color-border);
  --input-border-bottom: 1px solid var(--color-border);
  --input-radius: 10px;
  --input-padding: 8px 10px;
  --dropdown-bg: var(--color-bg-card);
  --dropdown-border: none;
  --dropdown-radius: 14px;
  --dropdown-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
}

[data-template="neon"] {
  --font-body: -apple-system, "Segoe UI", sans-serif;
  --heading-weight: 700;
  --card-bg: var(--color-bg-card);
  --card-border: 1px solid var(--color-accent);
  --card-radius: 2px;
  --card-shadow: 0 0 12px rgba(var(--color-accent-rgb), 0.15);
  --card-blur: none;
  --card-padding: 1rem;
  --button-bg: transparent;
  --button-color: var(--color-accent);
  --button-radius: 2px;
  --button-padding: 6px 14px;
  --button-border: 1px solid var(--color-accent);
  --button-shadow: 0 0 10px rgba(var(--color-accent-rgb), 0.3);
  --button-weight: 600;
  --button-transform: uppercase;
  --button-before: "";
  --button-after: "";
  --input-bg: transparent;
  --input-border: none;
  --input-border-bottom: 1px solid var(--color-accent);
  --input-radius: 0;
  --input-padding: 4px 2px;
  --dropdown-bg: var(--color-bg-card);
  --dropdown-border: 1px solid var(--color-accent);
  --dropdown-radius: 2px;
  --dropdown-shadow: 0 0 16px rgba(var(--color-accent-rgb), 0.2);
}

[data-template="warm"] {
  --font-body: -apple-system, "Segoe UI", sans-serif;
  --heading-weight: 700;
  --card-bg: var(--color-bg-card);
  --card-border: 1px solid var(--color-border);
  --card-radius: 16px;
  --card-shadow: none;
  --card-blur: none;
  --card-padding: 1.1rem;
  --button-bg: var(--color-accent);
  --button-color: var(--color-bg);
  --button-radius: 24px;
  --button-padding: 8px 18px;
  --button-border: none;
  --button-shadow: none;
  --button-weight: 600;
  --button-transform: none;
  --button-before: "";
  --button-after: "";
  --input-bg: var(--color-bg-card);
  --input-border: 1px solid var(--color-border);
  --input-border-bottom: 1px solid var(--color-border);
  --input-radius: 12px;
  --input-padding: 8px 10px;
  --dropdown-bg: var(--color-bg-elevated);
  --dropdown-border: 1px solid var(--color-border);
  --dropdown-radius: 16px;
  --dropdown-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
}

[data-template="glass"] {
  --font-body: -apple-system, "Segoe UI", sans-serif;
  --heading-weight: 700;
  --card-bg: linear-gradient(135deg, rgba(var(--color-accent-rgb), 0.12), rgba(var(--color-accent-rgb), 0.03)), var(--color-bg-card);
  --card-border: 1px solid rgba(var(--color-accent-rgb), 0.3);
  --card-radius: 14px;
  --card-shadow: none;
  --card-blur: blur(6px);
  --card-padding: 1.1rem;
  --button-bg: rgba(var(--color-accent-rgb), 0.2);
  --button-color: var(--color-text);
  --button-radius: 20px;
  --button-padding: 7px 16px;
  --button-border: 1px solid rgba(var(--color-accent-rgb), 0.4);
  --button-shadow: none;
  --button-weight: 600;
  --button-transform: none;
  --button-before: "";
  --button-after: "";
  --input-bg: rgba(var(--color-accent-rgb), 0.08);
  --input-border: 1px solid rgba(var(--color-accent-rgb), 0.3);
  --input-border-bottom: 1px solid rgba(var(--color-accent-rgb), 0.3);
  --input-radius: 10px;
  --input-padding: 8px 10px;
  --dropdown-bg: var(--color-bg-elevated);
  --dropdown-border: 1px solid rgba(var(--color-accent-rgb), 0.3);
  --dropdown-radius: 14px;
  --dropdown-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
}

[data-template="material"] {
  --font-body: Roboto, -apple-system, "Segoe UI", sans-serif;
  --heading-weight: 500;
  --card-bg: var(--color-bg-card);
  --card-border: none;
  --card-radius: 0;
  --card-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
  --card-blur: none;
  --card-padding: 1rem;
  --button-bg: var(--color-accent);
  --button-color: var(--color-bg);
  --button-radius: 2px;
  --button-padding: 8px 20px;
  --button-border: none;
  --button-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
  --button-weight: 600;
  --button-transform: uppercase;
  --button-before: "";
  --button-after: "";
  --input-bg: transparent;
  --input-border: none;
  --input-border-bottom: 2px solid var(--color-border);
  --input-radius: 0;
  --input-padding: 4px 2px;
  --dropdown-bg: var(--color-bg-card);
  --dropdown-border: none;
  --dropdown-radius: 2px;
  --dropdown-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
}

* {
```

- [ ] **Step 3: Build check**

Run from `frontend/`: `npm run build`

Expected: success, no errors. No visible change yet — nothing sets `data-template`, and nothing consumes the new tokens until later tasks.

- [ ] **Step 4: Review and commit**

```bash
git add frontend/src/index.css
git diff --cached
```

STOP. Report full diff. Wait for confirmation.

After confirmation: `git commit -m "feat: add template tokens and 5 template variants to index.css"`

---

### Task 3: `App.jsx` — apply saved template on load

**Files:**
- Modify: `frontend/src/App.jsx`

- [ ] **Step 1: Extend the bootstrap effect again**

Find:

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
        if (data?.template && data.template !== "terminal") {
          document.documentElement.setAttribute("data-template", data.template);
        }
      })
      .catch((err) => console.error(err));
  }, []);
```

Same reasoning as the theme bootstrap: `"terminal"` has no `[data-template="terminal"]` block (its values live in bare `:root`), so skipping the attribute write for that case is correct, not incomplete.

- [ ] **Step 2: Build check**

Run from `frontend/`: `npm run build`

Expected: success, no errors.

- [ ] **Step 3: Review and commit**

```bash
git add frontend/src/App.jsx
git diff --cached
```

STOP. Report full diff. Wait for confirmation.

After confirmation: `git commit -m "feat: apply saved template on app load"`

---

### Task 4: Shared building-block primitives

**Files:**
- Modify: `frontend/src/styles/shared.module.css`

- [ ] **Step 1: Replace the file**

Current full content:

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

Replace its full contents with:

```css
.card {
  background: var(--card-bg);
  border: var(--card-border);
  border-radius: var(--card-radius);
  box-shadow: var(--card-shadow);
  backdrop-filter: var(--card-blur);
  padding: var(--card-padding);
  font-family: var(--font-body);
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

.button {
  background: var(--button-bg);
  color: var(--button-color);
  border: var(--button-border);
  border-radius: var(--button-radius);
  padding: var(--button-padding);
  box-shadow: var(--button-shadow);
  font-family: var(--font-body);
  font-size: 0.85rem;
  font-weight: var(--button-weight);
  text-transform: var(--button-transform);
  cursor: pointer;
}

.button::before {
  content: var(--button-before);
}

.button::after {
  content: var(--button-after);
}

.input {
  background: var(--input-bg);
  border: var(--input-border);
  border-bottom: var(--input-border-bottom);
  border-radius: var(--input-radius);
  color: var(--color-text);
  font-family: var(--font-body);
  font-size: 0.85rem;
  padding: var(--input-padding);
  outline: none;
}

.input:focus {
  border-bottom-color: var(--color-accent);
}

.dropdown {
  background: var(--dropdown-bg);
  border: var(--dropdown-border);
  border-radius: var(--dropdown-radius);
  box-shadow: var(--dropdown-shadow);
  font-family: var(--font-body);
}

.dropdownItem {
  display: block;
  width: 100%;
  background: transparent;
  border: none;
  color: var(--color-text);
  font-family: var(--font-body);
  font-size: 0.85rem;
  padding: 10px 14px;
  text-align: left;
  cursor: pointer;
}

.dropdownItem:hover {
  background-color: var(--color-bg-hover);
  color: var(--color-accent);
}
```

`.card`'s Terminal-default values reproduce its exact previous hardcoded appearance (`background: var(--card-bg)` = `var(--color-bg-card)`, `box-shadow: inset 3px 0 0 var(--color-accent)` visually matches the old `border-left: 3px solid var(--color-accent)`, `padding: var(--card-padding)` = `1rem`, `font-family: var(--font-body)` = `var(--font-mono)`) — this file's `.card` consumers (`Dashboard.module.css`, already composing from it) should show zero visual change under the default Terminal template.

- [ ] **Step 2: Build check**

Run from `frontend/`: `npm run build`

Expected: success, no errors.

- [ ] **Step 3: Manual verification**

Hard refresh the browser under the default (no template picker exists yet, so this is always Terminal). Go to `/` (Dashboard). Confirm every card still looks exactly as before (dark background, red left stripe via the inset shadow, same padding/font) — this file's new `.button`/`.input`/`.dropdown`/`.dropdownItem` classes aren't consumed by anything yet, so there's nothing else to check visually in this task.

- [ ] **Step 4: Review and commit**

```bash
git add frontend/src/styles/shared.module.css
git diff --cached
```

STOP. Report full diff. Wait for confirmation.

After confirmation: `git commit -m "feat: add button/input/dropdown building-block primitives to shared.module.css"`

---

### Task 5: Migrate Dashboard's kcal-goal button to the shared primitive

**Files:**
- Modify: `frontend/src/pages/Dashboard.module.css`

- [ ] **Step 1: Replace `.kcalSetButton`**

Find:

```css
.kcalSetButton {
  background: transparent;
  border: none;
  color: var(--color-accent);
  font-family: var(--font-mono);
  font-size: 1.2rem;
  font-weight: 700;
  cursor: pointer;
  padding: 0;
}

.kcalSetButton::before {
  content: "[ ";
}

.kcalSetButton::after {
  content: " ]";
}
```

Replace with:

```css
.kcalSetButton {
  composes: button from "../styles/shared.module.css";
  font-size: 1.2rem;
}
```

No JSX change needed — `Dashboard.jsx` already references `className={styles.kcalSetButton}`. This drops the previously-hardcoded `font-weight: 700` and bracket `::before`/`::after` content, letting the active template's `--button-weight`/`--button-before`/`--button-after` tokens control them instead (Terminal's tokens reproduce the exact old brackets-and-bold-weight look, so there's no visible change yet — the point of this task is proving the primitive works, not changing anything visible under the default template).

- [ ] **Step 2: Build check**

Run from `frontend/`: `npm run build`

Expected: success, no errors.

- [ ] **Step 3: Manual verification**

Hard refresh, go to `/`. If no kcal goal is set yet, the "Postavi" button should look identical to before (`[ Postavi ]`, red, bold, larger font). If a goal is already set, temporarily clear it via Settings or the DB to see the button, or trust the token-equivalence reasoning above — don't fabricate a check you can't actually perform.

- [ ] **Step 4: Review and commit**

```bash
git add frontend/src/pages/Dashboard.module.css
git diff --cached
```

STOP. Report full diff. Wait for confirmation.

After confirmation: `git commit -m "feat: migrate Dashboard kcal-goal button to shared button primitive"`

---

### Task 6: Migrate Settings to shared primitives

**Files:**
- Modify: `frontend/src/pages/Settings.module.css`

- [ ] **Step 1: Replace the file**

Current full content:

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

Replace its full contents with:

```css
.page {
  padding: 1.5rem;
}

.heading {
  font-family: var(--font-body);
  font-size: 1.5rem;
  font-weight: var(--heading-weight);
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
  font-family: var(--font-body);
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.fieldInput {
  composes: input from "../styles/shared.module.css";
  width: 120px;
}

.languageSelect {
  composes: input from "../styles/shared.module.css";
  width: 120px;
  cursor: pointer;
}

.themePicker {
  position: relative;
}

.themeTrigger {
  composes: input from "../styles/shared.module.css";
  display: flex;
  align-items: center;
  gap: 8px;
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
  composes: dropdown from "../styles/shared.module.css";
  position: absolute;
  top: 100%;
  left: 0;
  z-index: 20;
  min-width: 160px;
}

.themeOption {
  composes: dropdownItem from "../styles/shared.module.css";
  display: flex;
  align-items: center;
  gap: 8px;
}

.themeOptionActive {
  background-color: rgba(var(--color-accent-rgb), 0.1);
}

.sectionLabel {
  color: var(--color-text-dim);
  font-family: var(--font-body);
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
  font-family: var(--font-body);
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
  composes: button from "../styles/shared.module.css";
  margin-top: 1.5rem;
}
```

Notes on what changed and why:
- `.fieldInput`/`.languageSelect`/`.themeTrigger` now compose the shared `input` primitive (background/border/border-bottom/radius/color/font/padding/outline/`:focus` all come from there) plus only their own local `width`/`cursor`/flex-layout additions. Their old local `:focus` rules are removed — redundant with the composed `.input:focus` rule.
- `.themeOption` now composes `dropdownItem` (which already provides the hover background+color change) plus its own `display:flex`/`gap` for the dot+label layout. Its old local `:hover` rule is removed — redundant with (and less complete than) the composed `.dropdownItem:hover`, which additionally tints the text to the accent color on hover.
- `.saveButton` now composes `button` — dropping its hardcoded bracket content and `color: var(--color-accent)` in favor of the template-driven tokens (Terminal's values reproduce the exact old look).
- `.themeTrigger:hover` is kept as a small local addition — the shared `input` primitive only defines a `:focus` treatment (appropriate for real text inputs), but `themeTrigger` is a `<button>` masquerading as an input-styled control, so it needs its own `:hover` since buttons don't receive `:focus` from mouse clicks the same reliable way across browsers.

- [ ] **Step 2: Build check**

Run from `frontend/`: `npm run build`

Expected: success, no errors.

- [ ] **Step 3: Manual verification**

Hard refresh, go to `/settings`. Confirm every field (language dropdown, theme picker, goal inputs, checkboxes, Save button) looks pixel-identical to before — this task should produce zero visible change under the still-only-available Terminal template, since Terminal's tokens exactly reproduce the previous hardcoded values.

- [ ] **Step 4: Review and commit**

```bash
git add frontend/src/pages/Settings.module.css
git diff --cached
```

STOP. Report full diff. Wait for confirmation.

After confirmation: `git commit -m "feat: migrate Settings inputs/button/dropdown to shared primitives"`

---

### Task 7: NavBar typography follows the template

**Files:**
- Modify: `frontend/src/components/Navbar.css`

- [ ] **Step 1: Add `font-family`**

Find:

```css
nav a {
  color: var(--color-text);
  font-family: var(--font-mono);
  font-size: 0.875rem;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.0625rem;
}
```

Replace with:

```css
nav a {
  color: var(--color-text);
  font-family: var(--font-body);
  font-size: 0.875rem;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.0625rem;
}
```

(`--font-mono` → `--font-body`; Terminal's `--font-body` is `var(--font-mono)`, so this is a no-op under the default template.)

- [ ] **Step 2: Build check**

Run from `frontend/`: `npm run build`

Expected: success, no errors.

- [ ] **Step 3: Review and commit**

```bash
git add frontend/src/components/Navbar.css
git diff --cached
```

STOP. Report full diff. Wait for confirmation.

After confirmation: `git commit -m "feat: NavBar font follows the active template"`

---

### Task 8: Settings — template picker

**Files:**
- Modify: `frontend/src/pages/Settings.jsx`
- Modify: `frontend/src/pages/Settings.module.css`
- Modify: `frontend/src/i18n/locales/hr.json`
- Modify: `frontend/src/i18n/locales/en.json`

- [ ] **Step 1: Add the `TEMPLATES` constant**

Find:

```jsx
const THEMES = [
  { value: "dark-red", label: "Dark Red", swatch: "#ff3b3b" },
  { value: "light", label: "Light", swatch: "#c62828" },
  { value: "dark-blue", label: "Dark Blue", swatch: "#3ba7ff" },
  { value: "dark-green", label: "Dark Green", swatch: "#3ec95c" },
  { value: "amber", label: "Amber", swatch: "#ffb020" },
  { value: "pure-black", label: "Pure Black", swatch: "#ffffff" },
];
```

Replace with:

```jsx
const THEMES = [
  { value: "dark-red", label: "Dark Red", swatch: "#ff3b3b" },
  { value: "light", label: "Light", swatch: "#c62828" },
  { value: "dark-blue", label: "Dark Blue", swatch: "#3ba7ff" },
  { value: "dark-green", label: "Dark Green", swatch: "#3ec95c" },
  { value: "amber", label: "Amber", swatch: "#ffb020" },
  { value: "pure-black", label: "Pure Black", swatch: "#ffffff" },
];

const TEMPLATES = [
  { value: "terminal", label: "Terminal" },
  { value: "soft", label: "Soft" },
  { value: "neon", label: "Neon" },
  { value: "warm", label: "Warm" },
  { value: "glass", label: "Glass" },
  { value: "material", label: "Material" },
];
```

- [ ] **Step 2: Add state**

Find:

```jsx
  const [settings, setSettings] = useState(null);
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);
```

Replace with:

```jsx
  const [settings, setSettings] = useState(null);
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);
  const [templateMenuOpen, setTemplateMenuOpen] = useState(false);
```

- [ ] **Step 3: Add click-outside handling for the template menu**

Find:

```jsx
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

Replace with:

```jsx
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

  useEffect(() => {
    if (!templateMenuOpen) return undefined;
    const handleClickOutside = (event) => {
      if (!event.target.closest("[data-template-menu]")) {
        setTemplateMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [templateMenuOpen]);
```

- [ ] **Step 4: Add the `changeTemplate` handler**

Find:

```jsx
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

Replace with:

```jsx
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

  const changeTemplate = (template) => {
    if (template === "terminal") {
      document.documentElement.removeAttribute("data-template");
    } else {
      document.documentElement.setAttribute("data-template", template);
    }
    setSettings((prev) => ({ ...prev, template }));
    setTemplateMenuOpen(false);
    fetchJson("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ template }),
    }).catch((err) => {
      console.error(err);
      showError(err.message);
    });
  };
```

- [ ] **Step 5: Add the picker UI**

Find the closing `</div>` of the theme picker's `.field` block:

```jsx
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

Replace with:

```jsx
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

      <div className={styles.field}>
        <span className={styles.fieldLabel}>{t("settings.template")}</span>
        <div className={styles.themePicker} data-template-menu>
          <button
            type="button"
            className={styles.themeTrigger}
            onClick={() => setTemplateMenuOpen((prev) => !prev)}
          >
            <span>{TEMPLATES.find((template) => template.value === (settings?.template || "terminal"))?.label}</span>
            <span className={styles.themeCaret}>{templateMenuOpen ? "▴" : "▾"}</span>
          </button>
          {templateMenuOpen && (
            <div className={styles.themeDropdown}>
              {TEMPLATES.map((template) => (
                <button
                  type="button"
                  key={template.value}
                  className={
                    template.value === (settings?.template || "terminal")
                      ? `${styles.themeOption} ${styles.themeOptionActive}`
                      : styles.themeOption
                  }
                  onClick={() => changeTemplate(template.value)}
                >
                  <span>{template.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
```

The template picker reuses `styles.themePicker`/`styles.themeTrigger`/`styles.themeDropdown`/`styles.themeOption`/`styles.themeOptionActive`/`styles.themeCaret` — same visual control, just without the color-swatch `<span>` (a template isn't reducible to one color, so there's nothing meaningful to show as a dot). No new CSS classes needed for this task.

- [ ] **Step 6: Add the `settings.template` translation key**

In `frontend/src/i18n/locales/hr.json`, find:

```json
    "theme": "Tema",
```

Replace with:

```json
    "theme": "Tema",
    "template": "Predložak",
```

In `frontend/src/i18n/locales/en.json`, find:

```json
    "theme": "Theme",
```

Replace with:

```json
    "theme": "Theme",
    "template": "Template",
```

- [ ] **Step 7: Build check**

Run from `frontend/`: `npm run build`

Expected: success, no errors.

- [ ] **Step 8: Manual verification**

With `backend/` (`npm start`) and `frontend/` (`npm run dev`) running, hard refresh, go to `/settings`:

1. New "Predložak"/"Template" field below the theme picker, trigger shows "Terminal", no color dot (unlike the theme picker above it).
2. Click it — dropdown lists all 6 templates as plain text, Terminal highlighted as current.
3. Click "Soft" — confirm Dashboard's cards go rounded with a soft shadow (no more red left-stripe), Settings' own inputs/dropdowns go rounded, the Save button becomes a filled accent-colored pill (no brackets), and the NavBar font switches to sans-serif — all instantly, no reload.
4. Try at least 2-3 more templates (Neon, Glass, Material) the same way — confirm each looks distinctly different from the others and from Terminal.
5. Pick a non-default COLOR theme (e.g. Dark Blue) together with a non-default TEMPLATE (e.g. Glass) — confirm both apply simultaneously and coherently (Glass's gradient/blur should tint with Dark Blue's accent color, not stay hardcoded to red) — this is the key proof that the two systems are genuinely orthogonal.
6. Reload the browser — confirm both the theme and template choices persisted.
7. Switch back to Terminal template (and Dark Red theme, if changed) — confirm full reversibility, pixel-identical to the app's original appearance.
8. Navigate to Log, Nutrition, Calendar, Calculator, Stats while a non-default template is active — confirm (and note in your report) that these pages do NOT follow the template yet (expected — they're explicitly out of scope for this plan, still using their own bespoke CSS). This isn't a bug to fix, just something to visually confirm matches the documented scope.

If real browser automation is available, use it — respecting the by-now-standard caution: track and kill only the specific PID/process tree you spawn, never a blanket `taskkill /F /IM chrome.exe` (this has caused real problems earlier in this project's history). If unavailable, do as much code-level verification as possible and clearly flag the visual click-through as unverified — do not fabricate results.

- [ ] **Step 9: Review and commit**

```bash
git add frontend/src/pages/Settings.jsx frontend/src/pages/Settings.module.css frontend/src/i18n/locales/hr.json frontend/src/i18n/locales/en.json
git diff --cached
```

STOP. Report full diff. Wait for confirmation.

After confirmation: `git commit -m "feat: add template picker to Settings"`
