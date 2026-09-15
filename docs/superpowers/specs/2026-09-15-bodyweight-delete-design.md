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
- Render a delete button ("Obriši") next to "Spremi" only when `bwEntryId` is not null.
- `deleteBw()`: `fetchJson(`/api/bodyweight/${bwEntryId}`, { method: "DELETE" })`, on success remove the entry from `monthBwEntries` (filter by id), close the modal (`setBwModalDate(null)`). On error, `showError` via the existing toast context, same as other handlers in this file.
- No `window.confirm` — matches the quiet, no-dialog pattern of individual set deletion elsewhere in the app (per user decision).

## Styling

Reuse existing button primitives/classes from `Calendar.module.css` (the modal already has `bwSaveButton`); add a sibling style for the delete button rather than introducing a new pattern. Exact look (e.g. red text like other destructive actions) left to implementation — should read as clearly destructive but not require new design tokens.

## Testing

No automated tests in this codebase for routes/components (verified via `npm run build` only, per project convention). Manual check: open a day with a logged weight, delete it, confirm it disappears from the calendar cell and a re-open of that day's modal shows an empty (create) state, not a prefilled one.
