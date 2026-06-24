# Log restyle — design

## Context

Second restyle round, following the Dashboard restyle (see
`docs/superpowers/specs/2026-06-24-dashboard-restyle-design.md`). This spec
covers `Log.jsx` **and** `ExerciseCard.jsx` together — `ExerciseCard` is
Log's main content (it renders the exercise + set data), so restyling the
page wrapper alone would leave the page looking half-finished.

Out of scope, deferred to a separate feature (not a styling concern — it
needs new backend endpoints):
- Deleting an entire exercise (with a confirm dialog).
- Editing an existing set's weight/reps/RPE in place.
- The kebab/three-dot menu UI that will trigger both of the above, planned
  for the top-right corner of the exercise card.

## Visual style

Extends the dark "technical/data-driven" system from the Dashboard restyle
(same `#0d0d0d` background, `#141414` cards, `#ff3b3b` accent, monospace
font) with two new primitives needed for interactive elements that Dashboard
didn't have: buttons and text inputs.

**Buttons** — bracket style: `[ DODAJ SET ]`. Red text (`--color-accent`),
transparent background, no border. No filled/boxed button anywhere on this
page — stays consistent with the minimal, terminal-like feel of the rest of
the dark theme.

**Inputs** — underline only, no box: transparent background, a single
bottom border. Default border color is a dim gray (new token, see below);
on focus, the border turns red (`--color-accent`) and the browser's default
focus ring is suppressed (`outline: none`). This was chosen specifically
after the native orange focus glow looked out of place against the dark
palette.

**Set rows** (inside `ExerciseCard`) — each set renders as a plain text row
with a delete `X`. The `X` is absolutely positioned in the top-right corner
of its row (the row is `position: relative`), not just trailing the text —
chosen over simple inline trailing placement.

## Layout

`Log.jsx`:
1. Heading ("Log treninga").
2. Date input, with the existing workout meta text (`Workout ID: {id}`)
   next to it — same text content as today, just restyled (dim, small,
   uppercase via CSS, not reworded). The native `<input type="date">`
   keeps its browser-rendered calendar icon/picker (not themeable
   cross-browser) — only its border/background/text color match the
   other underline inputs.
3. "Start workout" button when no workout exists for the selected date —
   same bracket button style.
4. When a workout exists: an "add exercise" row (name input + bracket
   button), followed by the list of `ExerciseCard`s, stacked vertically
   with spacing between them.

`ExerciseCard.jsx` (per card):
1. Exercise name as a bold heading.
2. A row of three inputs (kg, reps, RPE) + a bracket "add set" button.
3. The list of already-added sets below, one per row, each with the
   top-right `X` to delete that set.

No grid/multi-column layout here (unlike Dashboard) — this is a vertical
list of cards, each full-width.

## CSS architecture

Continues the established CSS Modules + `composes` pattern (see
`docs/superpowers/specs/2026-06-24-dashboard-restyle-design.md` and
`frontend/src/styles/shared.module.css`):

- Two new CSS custom properties in `index.css`, alongside the existing
  color/font tokens:
  ```css
  --color-border: #444;         /* default input underline */
  --color-border-subtle: #222;  /* separator between set rows */
  ```
- Two new shared primitives added to `shared.module.css` — `.button` (the
  bracket style) and `.input` (the underline style) — because both will be
  needed again when restyling Nutrition, Calculator, and Settings later,
  the same reasoning that put `.card`/`.label`/`.value` there for Dashboard.
- New `frontend/src/pages/Log.module.css` — page-level layout (`heading`,
  the date/meta row, the add-exercise row, spacing between exercise cards).
  Composes `.button`/`.input` from `shared.module.css` where needed.
- New `frontend/src/components/ExerciseCard.module.css` — the card itself
  (`composes: card from "../styles/shared.module.css"`), the exercise
  heading, the inputs row, and the set-row/delete-X styling. Also composes
  `.button`/`.input` from shared.

## Out of scope

- Any change to business logic: data fetching, the `createWorkout`/
  `addExercise`/`addSet`/`deleteSet` handlers, and all conditional rendering
  predicates stay exactly as they are today — only markup/classNames change.
- The `Workout ID: {id}` text itself is not reworded — only its visual
  treatment changes.
- Deleting an exercise, editing a set, and the kebab menu that would
  trigger both — see Context above. These require new backend endpoints
  (`DELETE /exercises/:id`, a `PUT`/`PATCH` for sets) that don't exist yet,
  so they're tracked as a separate follow-up feature, not part of this
  styling pass.
- Other pages (Nutrition, Calendar, Calculator, Stats, Settings, Navbar) —
  same deferral as the Dashboard spec; same design language will extend to
  them later, one page at a time.
