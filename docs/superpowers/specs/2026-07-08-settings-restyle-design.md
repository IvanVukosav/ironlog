# Settings restyle — design

## Context

Settings.jsx is a form page with number inputs (kcal, protein, carbs, fat, trainingsPerWeek), two checkboxes (widget toggles), and a save button. First page in this restyle round that introduces label/input pairs and checkboxes.

## Visual style

Extends the established dark/monospace system. New patterns:

**Label/input field:** Each number input is preceded by a `<label>`. The pair is wrapped in a `.field` div — flex column, label on top, input below. Label uses the `.label`-equivalent style (dim, small, uppercase). Input uses the underline style (same as Log/Nutrition inputs).

**Checkbox:** Native `<input type="checkbox">` with `accent-color: var(--color-accent)` — browser renders a red-tinted checkbox in most modern browsers without custom CSS. Clean, accessible, no custom checkbox hack needed.

**Save button:** Bracket style `[ Spremi ]`, same as all other buttons.

**Section heading:** "Dashboard widgeti" becomes a small dim uppercase label (styled like `.meta` from Log), not a full `<h2>`.

## Layout

1. Page heading "Settings"
2. Goals section: five `.field` rows (label + number input), stacked vertically with gap
3. Widgets section: small section label "DASHBOARD WIDGETI", then two checkbox rows (each: checkbox + label text inline)
4. Save button at the bottom

## CSS architecture

One new file: `frontend/src/pages/Settings.module.css`. No `composes`. All styles direct.

Classes: `.page`, `.heading`, `.field`, `.fieldLabel`, `.fieldInput`, `.sectionLabel`, `.checkboxRow`, `.saveButton`.

## Out of scope

- Custom styled checkbox appearance beyond `accent-color`
- Any logic changes (alert-based save stays as-is)
- Other pages
