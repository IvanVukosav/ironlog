# Bodyweight entry delete — design

## Problem

Bodyweight entries can be created and edited (the Calendar's bodyweight modal opens pre-filled with the existing weight for a date, and re-saving upserts by date), but there is no way to remove an entry entirely. A mislogged or accidental entry has to stay forever.

## Scope

Backend delete endpoint + a delete action in the existing Calendar bodyweight modal. Nothing else changes — no new pages, no changes to how entries are created/edited, no confirm dialog.

## Backend

Add to `backend/routes/bodyweight.js`:

```js
router.delete("/:id", async (req, res) => {
  try {
    await prisma.bodyweight.delete({ where: { id: parseInt(req.params.id) } });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});
```

Matches the existing delete pattern used in `workouts.js` (e.g. `DELETE /exercises/:id`) — no special not-found handling, plain 500 on error.

## Frontend

In `frontend/src/pages/Calendar.jsx`:

- The bodyweight modal already knows whether it's editing an existing entry (`getBwWeight(day)` returns non-null when `handleBwClick` opens it). Track the entry's `id` alongside `bwWeight` when opening the modal for an existing date (e.g. a new `bwEntryId` state, set from the matching entry in `monthBwEntries`, reset to `null` for a fresh day).
- Render a small "✕" delete control, positioned opposite "Spremi" in the modal footer, only when `bwEntryId` is not null.
- `deleteBw()`: `fetchJson(`/api/bodyweight/${bwEntryId}`, { method: "DELETE" })`, on success remove the entry from `monthBwEntries` (filter by id), close the modal (`setBwModalDate(null)`). On error, `showError` via the existing toast context, same as other handlers in this file.
- No `window.confirm` — matches the quiet, no-dialog pattern of individual set deletion elsewhere in the app (per user decision), and precedented by `deleteHistoryEntry` in Stats.jsx which also skips confirmation.

## Styling

Match the app's existing delete-control convention, not the primary-action bracket style: `deleteSet` (`ExerciseCard.module.css`) and `historyEntryDelete` (`Stats.module.css`) both render as plain "✕" text, `color-text-dim` by default, `color-accent` on hover, no brackets, no background/border. Add a new `.bwDeleteButton` class in `Calendar.module.css` following that exact pattern, placed in the modal footer opposite `bwSaveButton` (`[ Spremi ]` stays bracketed and unchanged — it's the primary action). Keeping delete visually quiet avoids it reading as equally-weighted with Save, and matches every other delete affordance already in the app.

## Testing

No automated tests in this codebase for routes/components (verified via `npm run build` only, per project convention). Manual check: open a day with a logged weight, delete it, confirm it disappears from the calendar cell and a re-open of that day's modal shows an empty (create) state, not a prefilled one.
