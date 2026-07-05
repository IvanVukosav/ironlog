# Nutrition restyle — design

## Context

Third restyle round, following Dashboard and Log+ExerciseCard. Covers `Nutrition.jsx` only — all meal rendering is currently inline in that file (no separate component like ExerciseCard), and it stays that way (YAGNI — only one consumer).

## Visual style

Extends the established dark/monospace/red-accent system with no new visual primitives — everything reuses the same patterns from Log:
- Bracket buttons `[ LABEL ]`
- Underline inputs, border-bottom turns red on focus, `outline: none`
- Dark meal cards (`#141414` bg, `#ff3b3b` 3px left border, monospace)
- Food item rows: dim monospace text with subtle bottom separator (`--color-border-subtle`), no delete action (not implemented)

## Layout

1. Heading "Nutrition"
2. Date input (top row) — same `.topRow` + `.dateInput` pattern as Log
3. "Dodaj dan" bracket button when no day exists
4. When day exists: add-meal row (meal name input + bracket button)
5. List of meal cards, each containing:
   - Meal name as bold heading
   - Row of 5 inputs (Naziv hrane, kcal, protein, carbs, fat) + `[ Dodaj ]` bracket button
   - List of added food items below, one per row (name — kcal)

## CSS architecture

One new file: `frontend/src/pages/Nutrition.module.css`. No `composes`. All styles written directly — same convention as Log.module.css and ExerciseCard.module.css.

New classes: `.page`, `.heading`, `.topRow`, `.dateInput`, `.meta` (if needed), `.startButton`, `.addMealRow`, `.mealInput`, `.addMealButton`, `.mealList`, `.mealCard`, `.mealHeading`, `.itemInputRow`, `.itemInput`, `.addItemButton`, `.itemList`, `.itemRow`.

The meal card visual (`.mealCard`) duplicates the card style from ExerciseCard — dark bg, red left border, monospace — written directly per the no-composes convention.

## Out of scope

- Extracting meal rendering into a `MealCard` component — not needed, only one consumer
- Deleting meals or food items — not implemented in the current codebase
- Any other pages
