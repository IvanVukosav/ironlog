# Stats page: recent PRs section — design spec

**Date:** 2026-09-07
**Status:** Approved

## Context

`Stats.jsx` currently shows one table (all-time best e1RM per exercise) and, below it, an exercise-picker + line chart of e1RM over time (`/api/stats/exercise/:name/history`). Both were built in the same session, just before this spec.

The user wants the page reordered/extended: a "recent PRs" section should sit above the existing table, highlighting exercises where you *just* broke your all-time best — not merely "your current best," but "you improved on your previous best, and it happened on your most recent log for that exercise."

## Requirements (confirmed via brainstorming)

1. **New section, not a replacement.** "Nedavno oboreni rekordi" (Recently broken records) is added above the existing full table. The full table stays exactly as-is below it.
2. **Definition of "recent PR":** for a given exercise, look at the most recent date it was logged. If the best e1RM among that date's sets equals the best e1RM across *all* logged sets for that exercise (i.e., nothing before it was ever higher), it counts as a recent PR.
3. **First-ever entries count.** An exercise logged only once (so "most recent" and "all-time best" are trivially the same) still shows up in the recent PRs list. No minimum-entries threshold.
4. **Sort order:** recent PRs list is sorted by date descending (most recently achieved first).
5. **Interactivity:** clicking a row in the recent PRs section sets that exercise as the selected one in the existing exercise-picker + chart below, so the two sections read as one connected page rather than two unrelated widgets.

## Data model change

`GET /api/stats/prs` currently returns sets without a date:
```json
[{ "name": "Bench Press", "sets": [{ "weight": 120, "reps": 8, "rpe": 10 }] }]
```

It needs to include each set's workout date, since "most recent" can't be determined without it:
```json
[{ "name": "Bench Press", "sets": [{ "date": "2026-09-07T00:00:00.000Z", "weight": 120, "reps": 8, "rpe": 10 }] }]
```

Implementation: the existing `prisma.exercise.findMany({ include: { sets: true } })` query gains `workout: true`, and each set gets `exercise.workout.date` attached when flattened. No schema/migration change — `date` already exists on `Workout`, just wasn't being joined in for this endpoint.

## Frontend logic

New helper in `Stats.jsx` (not exported elsewhere — this page-specific derivation doesn't belong in the shared `oneRepMax.js` util, which only holds pure formula math):

```js
function getRecentPr(sets, formula) {
  if (sets.length === 0) return null;
  const bestOverall = findBestSetByE1rm(sets, formula);
  const latestDate = sets.reduce(
    (latest, set) => (!latest || set.date > latest ? set.date : latest),
    null,
  );
  return bestOverall.date === latestDate ? bestOverall : null;
}
```

Date comparison uses plain string `>` — ISO 8601 timestamps (`YYYY-MM-DDTHH:mm:ss.sssZ`) sort correctly as strings, same assumption already relied on elsewhere in the app (e.g. Calendar's date handling).

`recentPrRows` = map every exercise's PR entry through `getRecentPr`, filter out nulls, sort by `date` descending.

## UI

New section rendered above the existing `<table>`, using the same visual language (mono font, dim uppercase labels, red accent) as the rest of the page — a `.recentPrList` of rows (not a `<table>`, since each row needs to be clickable and a plain button-per-row is simpler than making table rows clickable). Each row shows: exercise name, e1RM, best-set detail (weight×reps @ RPE), and date (formatted like the chart's `DD/M`).

Clicking a row calls `setSelectedExercise(name)` — reuses the state that already drives the chart section, no new state needed.

If there are no recent PRs (e.g., empty database, or the most recent set for every exercise happens to be below a previous best), the section is hidden entirely rather than showing an empty state — it's a highlight, not a required page element.

## Out of scope

- No "how long ago" relative text (e.g. "3 days ago") — just the date, matching the chart's existing date format.
- No date column added to the *existing* full table — user asked for a separate section, not a rework of the existing one.
- No minimum-improvement threshold (e.g. "must beat previous best by 2kg+") — any improvement, however small, counts.
