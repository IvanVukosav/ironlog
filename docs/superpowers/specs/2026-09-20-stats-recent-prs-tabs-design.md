# Stats page: merge Recent PRs into the table — design

## Problem

The Stats page currently shows "Nedavno oboreni rekordi" (Recent PRs) as a separate card list above the main all-time PR table. The two aren't visually or conceptually connected, even though a "recent PR" is always a row that already exists in the table below it — it's that exercise's all-time-best e1RM, filtered to cases where the most recent thing logged for that exercise is also its best. The user found this genuinely confusing ("not clear how these relate, looks like overlapping info"), confirmed via visual-companion brainstorming.

## Scope

`frontend/src/pages/Stats.jsx` and `frontend/src/pages/Stats.module.css` only. No backend changes — `row.date` is already present on every row (`findBestSetByE1rm` returns `{ ...set, e1rm }`, and `set` already carries `date`; it's just never rendered today).

## Design (confirmed via visual companion mockups)

Replace the separate "Recent PRs" section + table with **one table and two tabs**:

- **Tabs**: "Svi rekordi" (all) / "Nedavno oboreni" (recent), rendered as underlined tab buttons above the table, matching this app's existing active/inactive tab pattern (same visual idiom as Dashboard's week/month/year range tabs). The "Nedavno oboreni" tab shows a small count badge (number of currently-recent PRs) when there's at least one.
- **New Date column**: added to the table (position: after "Best set", before the manage-menu column), populated from `row.date` for every row in both tabs.
- **Recent-PR row treatment**: any row that's currently a recent PR (present in `recentPrRows`) gets a red left-border + subtle background tint (same visual language as `recentPrRowActive` already uses today) plus a **"NOVO"** badge next to the exercise name. This applies whether it's showing in the "Svi rekordi" tab (mixed in with everything else) or the "Nedavno oboreni" tab (where every visible row has it, by definition).
- **Row click**: clicking anywhere on a row (outside the manage-menu cell) selects that exercise and scrolls to the progress chart below — this is the same interaction the old Recent PRs cards had; extending it to every row in both tabs is a small, deliberate improvement, not scope creep, since it's the same underlying affordance now unified across one table instead of two.
- **Manage-menu column**: unchanged behavior (⋮ → "Prikaži po datumima" / "Obriši sve zapise"), now needs `event.stopPropagation()` so clicking it doesn't also trigger the new row-click-to-select.
- **Expanded history panel**: unchanged, `colSpan` increases from 4 to 5 to account for the new Date column.
- **"NOVO" stays literal, untranslated for now**: Stats.jsx hasn't been migrated to the i18n system yet (deferred, like Dashboard/Nutrition/Calculator). This is a pre-existing-scope decision, not new — when Stats eventually gets its translation pass, "NOVO"/"Svi rekordi"/"Nedavno oboreni" get keys like everything else on the page at that time.

## What's explicitly NOT changing

- The progress chart section ("Napredak" + exercise dropdown + line chart) — unchanged.
- The muscle-group volume chart section — unchanged.
- `prRows`/`recentPrRows` computation logic — unchanged (same sort orders: `prRows` by e1RM descending, `recentPrRows` by date descending — the latter only matters now for badge-detection via a `Set`, not for a separate render order, since `recentPrRows`' own sort order is only used when the "Nedavno oboreni" tab itself is active).

## Testing

No automated test suite — `npm run build` plus manual checks:
1. Default tab ("Svi rekordi") shows all exercises, sorted by e1RM, each with a Date column; any exercise whose best set was also its most recent gets the NOVO badge + highlight.
2. Switch to "Nedavno oboreni" — table now shows only the recent-PR subset, badge count on the tab matches the row count shown.
3. Click a row in either tab (not on the ⋮ button) — confirm it selects that exercise in the dropdown below and scrolls to the chart.
4. Click ⋮ on a row — confirm the dropdown menu opens and row-click-to-select does NOT also fire.
5. Use "Prikaži po datumima" to expand history — confirm the panel still spans the full table width correctly (5 columns now, not 4).
6. Delete a record via the manage menu — confirm both tabs' contents update correctly (an exercise that becomes empty disappears from `prRows`/both tabs' possible display).
