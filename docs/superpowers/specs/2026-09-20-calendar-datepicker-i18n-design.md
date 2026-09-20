# Calendar + DatePicker translation rollout — design

## Problem

The i18n infrastructure (backend `language` column, `react-i18next`, `hr`/`en` dictionaries) was built and proven on `NavBar.jsx` and `Settings.jsx` only. `Calendar.jsx` (month header, weekday headers, day-cell dropdown, bodyweight modal) and `DatePicker.jsx` (the date picker used in `Log.jsx`) still have all their text hardcoded, so switching the language toggle has no visible effect there — confirmed by the user testing the toggle and seeing the Calendar bodyweight modal's "Obriši"/"Spremi" buttons stay Croatian regardless.

## Scope

Two files: `frontend/src/pages/Calendar.jsx` and `frontend/src/components/DatePicker.jsx`. This is the second page/component in the deferred rollout (first was `Settings.jsx`/`NavBar.jsx`); the rest (Dashboard, Log's own strings, Nutrition, Calculator, Stats) remain deferred further.

## Key inventory and translation content

New `common.*` namespace (introduced now, reserved but unused since the original infra spec) plus a new `calendar.*` namespace and a new `datePicker.*` namespace, added to the existing `frontend/src/i18n/locales/hr.json` and `en.json`.

**`common.*`** (shared across both files):
- `save`: hr "Spremi" / en "Save" — replaces the literal "Spremi" in Calendar's bodyweight modal. (`Settings.jsx` keeps its own separate `settings.save` key, already committed and working — not touched by this change, to avoid re-touching already-shipped code for a cosmetic dedupe.)
- `delete`: hr "Obriši" / en "Delete" — replaces the literal "Obriši" in Calendar's bodyweight modal.
- `months`: a 12-item array, hr `["Siječanj", "Veljača", "Ožujak", "Travanj", "Svibanj", "Lipanj", "Srpanj", "Kolovoz", "Rujan", "Listopad", "Studeni", "Prosinac"]` (identical to `DatePicker.jsx`'s current hardcoded values) / en `["January", ..., "December"]` (identical to `Calendar.jsx`'s current hardcoded values). Shared by both files since month names don't depend on week-start-day or abbreviation format, unlike weekday names.

**`calendar.*`**:
- `weekdays`: 7-item array, Sunday-first (matches `Calendar.jsx`'s current iteration order), full names. hr `["Nedjelja", "Ponedjeljak", "Utorak", "Srijeda", "Četvrtak", "Petak", "Subota"]` / en `["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]` (identical to current hardcoded values).
- `workoutOption`: hr "Trening" / en "Workout" — the day-cell dropdown's first item.
- `bodyweightOption`: hr "Tjelesna težina" / en "Bodyweight" — the day-cell dropdown's second item.
- `bodyweightModalTitle`: hr "Tjelesna težina {{date}}" / en "Bodyweight {{date}}" — the modal header, interpolated with `bwModalDate` via `t("calendar.bodyweightModalTitle", { date: bwModalDate })`.

**`datePicker.*`**:
- `weekdays`: 7-item array, **Monday-first** (matches `DatePicker.jsx`'s current iteration order — different from Calendar's Sunday-first), abbreviated 2-letter. hr `["Po", "Ut", "Sr", "Če", "Pe", "Su", "Ne"]` (identical to current hardcoded values) / en `["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"]`.

Not translated: the modal's close button ("X") and the date-format-only trigger button in `DatePicker.jsx` (numeric `DD/MM/YYYY`, no words) — neither has language-specific content.

## Mechanism

Both files' hardcoded arrays (`MONTH_NAMES`, `WEEKDAY_LABELS`, the inline weekday literal in `Calendar.jsx`) are replaced with `t(key, { returnObjects: true })`, which returns the raw JSON array from the active language's dictionary instead of a string — a standard `react-i18next` option, no extra library needed. Everything else is a plain `t(key)` string swap. `SUNDAY_INDEX`/`DAYS_PER_WEEK` in `DatePicker.jsx` stay as-is (day-of-week arithmetic, unrelated to translation).

## Content correction bundled with this migration

Both files currently show **English** month/weekday names on `Calendar.jsx` and **Croatian** on `DatePicker.jsx` regardless of any language setting (there was no setting before now) — an existing inconsistency noted back in the original i18n design spec. Once migrated, both will correctly follow the active language toggle, defaulting to Croatian (matching the rest of the app) instead of Calendar's current English-only display. Confirmed with the user this is the desired fix, not a regression to flag.

## Testing

No automated test suite — `npm run build` plus manual verification, matching project convention:
1. Load `/calendar` in Croatian (default): month heading and weekday headers show Croatian names (a change from today's English), dropdown shows "Trening"/"Tjelesna težina", bodyweight modal shows "Tjelesna težina {date}" and "Obriši"/"Spremi".
2. Switch to English in Settings: `/calendar` now shows English month/weekday names, "Workout"/"Bodyweight" dropdown, "Bodyweight {date}" modal title, "Delete"/"Save" buttons.
3. Load `/log`, open the date picker: Croatian shows the same Croatian month/weekday abbreviations as before (no visible change in `hr` mode, since values are unchanged) and English mode shows the same month names as Calendar plus English weekday abbreviations (Mo/Tu/We/Th/Fr/Sa/Su).
4. Existing bodyweight delete functionality (from the prior feature) still works correctly through the newly-translated modal.
