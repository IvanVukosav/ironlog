# Language toggle (i18n infrastructure) — design

## Problem

IronLog's UI text is hardcoded, inconsistently, across the app — most pages are Croatian, but some strings are English (`NavBar.jsx`'s labels, `Calendar.jsx`'s month/weekday names, some of `Settings.jsx`'s toast messages), while `DatePicker.jsx`'s month/weekday names are Croatian. There's no way to choose a language, and no mechanism to add one.

## Scope

This spec covers the **infrastructure only**: the translation mechanism, a language toggle in Settings, and migrating two files (`Settings.jsx`, `NavBar.jsx`) as a working proof of concept. Migrating every remaining page/component's strings is deliberately deferred to follow-up work, done incrementally (same pattern as the earlier page-by-page CSS restyle rounds) — not part of this plan.

## Architecture

`react-i18next` (new dependency: `i18next` + `react-i18next`), initialized once in a new `frontend/src/i18n/index.js`:

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

Imported once (for its side effect) in `frontend/src/main.jsx`, before `App` renders. Two static JSON resource files, `frontend/src/i18n/locales/hr.json` and `frontend/src/i18n/locales/en.json`, bundled directly — no lazy-loading/HTTP backend, since the dictionaries are small and static.

`lng: "hr"` as the initial value means the UI always renders in Croatian on first paint, matching the app's actual current default. `App.jsx` fetches `/api/settings` once on mount (new, separate from each page's own existing settings fetch — those are untouched) and, once resolved, calls `i18n.changeLanguage(settings.language)` if it differs from `"hr"`. Someone who has never picked English sees no flash or change at all; someone who previously picked English sees a brief instant of Croatian before it switches — acceptable given this project's existing convention of not adding loading states for near-instant local fetches.

## Backend

Add `language String @default("hr")` to the `Settings` model in `backend/prisma/schema.prisma`, with a new migration. No route changes needed: `PUT /api/settings` already does `prisma.settings.upsert({ where: { id: 1 }, update: req.body, create: { id: 1, ...req.body } })`, so a minimal `{ language: "en" }` body works as a partial update without touching other fields.

## Settings UI

A new `<select>` in `Settings.jsx`, styled to match the existing `.fieldInput` underline look (`Settings.module.css`), with two options: "Hrvatski" (`hr`) and "English" (`en`). **These option labels are never translated** — each is always shown in its own language, so the control stays findable regardless of current language (standard convention for language pickers).

Picking an option:
1. Calls `i18n.changeLanguage(lang)` immediately — the whole UI (this page, NavBar, everywhere else once migrated) switches instantly.
2. Fires `PUT /api/settings` with `{ language: lang }` in the background — no separate "Spremi" click needed, and not bundled with the rest of `Settings.jsx`'s fields (those keep their existing explicit-Save behavior; only language applies live).

## Translation key convention

Flat, dot-namespaced keys, grouped by where they're used:
- `nav.*` — NavBar labels (`nav.dashboard`, `nav.log`, `nav.nutrition`, `nav.calendar`, `nav.calculator`, `nav.stats`, `nav.settings`)
- `settings.*` — everything on the Settings page (`settings.title`, `settings.kcalGoal`, `settings.proteinGoal`, `settings.trainingsPerWeek`, `settings.carbsGoal`, `settings.fatGoal`, `settings.dashboardWidgets`, `settings.showWorkoutWidget`, `settings.showNutritionWidget`, `settings.exercisePickerSection`, `settings.exercisePickerChips`, `settings.exercisePickerTwoStep`, `settings.setsSection`, `settings.showE1rm`, `settings.language`, `settings.save`, `settings.allFieldsRequired`, `settings.saved`, `settings.saveError`)
- `common.*` — reserved for strings that repeat across pages once rollout begins (e.g. a future `common.save`/`common.delete`); not populated yet since only one page is being migrated now, but the namespace is established so rollout work has somewhere to put shared keys instead of guessing later.

`E1RM_FORMULA_LABELS` values ("Brzycki", "Epley", "Lombardi") are proper nouns (formula names) and are **not** translated.

## Content correction bundled with this migration

`Settings.jsx` currently has English toast strings inside an otherwise-Croatian page (`"All fields must be filled in"`, `"Settings saved!"`, `"Error saving settings"`) and an English heading (`"Settings"`). Migrating this page to real `hr`/`en` entries fixes this — `hr.json` gets proper Croatian text for these (e.g. `"Postavke"`, `"Sva polja moraju biti popunjena"`, `"Postavke spremljene!"`, `"Greška kod spremanja postavki"`), and `en.json` keeps the current English wording for those. This is a visible copy change in Croatian mode for anyone who's been reading those English strings as-is — flagging it here since it's a side effect of "migrate the page properly," not a silent accident.

## Testing

No automated test suite in this project (frontend has no test runner; backend's `npm test` is a stub) — verification is `npm run build` plus manual checks, matching project convention:
1. Backend: run the new migration, confirm `GET /api/settings` returns `language: "hr"` for the existing row.
2. Frontend: load the app — Settings page and NavBar render in Croatian by default (unchanged from before, aside from the corrected toast/heading strings above).
3. Open Settings, pick "English" from the new dropdown — confirm NavBar and Settings page text switch immediately, with no page reload.
4. Reload the browser — confirm it comes back up in English (i.e. the `PUT` persisted and `App.jsx`'s bootstrap fetch applied it).
5. Switch back to "Hrvatski", confirm the reverse works.
