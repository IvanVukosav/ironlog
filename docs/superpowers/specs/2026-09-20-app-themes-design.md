# Multi-theme support — design

## Problem

The app has one hardcoded visual look (dark background, red accent). The user wants a choice of themes, confirmed via visual-companion brainstorming: **6 themes** — Dark Red (current, stays default), Light, Dark Blue, Dark Green, Amber, Pure Black — selectable in Settings, applying instantly and persisting like the language toggle.

## Scope

This must cover the **whole app**, not just a picker that half-works. Audited the codebase: every CSS Module already reads colors through CSS custom properties defined once in `frontend/src/index.css` — good news, that's the theming mechanism already half-built. But two categories of color leak bypass it and would stay stuck looking like the dark-red theme if not fixed:

1. **10 CSS files** with hardcoded hex/rgba colors instead of `var(--color-*)`: `DatePicker.module.css`, `ExerciseCard.module.css`, `MealCard.module.css`, `Navbar.css`, `RestTimer.module.css`, `ToastContainer.module.css`, `Calendar.module.css`, `Dashboard.module.css`, `Log.module.css`, `Stats.module.css`.
2. **2 JSX files** (`Dashboard.jsx`, `Stats.jsx`) with chart colors hardcoded as inline Recharts props (`stroke`, `fill`, tooltip `contentStyle`) — these are JavaScript values, not CSS, so a CSS variable swap alone doesn't reach them.

Both categories are in scope for this plan — a theme switch that leaves dropdowns, hover states, or charts stuck in dark-red would read as broken, not as a smaller-but-complete feature (unlike the i18n rollout, where an untranslated page just shows old text — still functional, not visually jarring).

## Token architecture

`index.css`'s `:root` block keeps its current values as the **Dark Red** (default) theme — no visible change for anyone who never touches the picker, and no flash-of-wrong-theme before JS runs. Five new `[data-theme="..."]` blocks override the same variable names for the other themes. A `data-theme` attribute on `<html>` (set by JS, see below) selects which block applies; CSS cascade handles the rest — zero changes needed to any component that already uses `var(--color-*)` correctly.

**New tokens** (needed to close the leaks above — these didn't exist before because everything using them was hardcoded):
- `--color-bg-elevated` — dropdown/menu surface color (replaces the `#1e1e1e` repeated across 8 files)
- `--color-bg-hover` — hover state on interactive rows/cards (replaces `#1a1a1a`)
- `--color-nav-bg` — the NavBar's own background (replaces `#111`, currently a different shade from the page background on purpose)
- `--color-accent-rgb` — the accent color as raw `R, G, B` components (e.g. `255, 59, 59`), so `rgba(var(--color-accent-rgb), 0.08)` can build a themed translucent tint — replaces hardcoded `rgba(255, 59, 59, 0.08)` (Stats' recent-PR row highlight) and `rgba(255, 59, 59, 0.15)` (RestTimer)

**Two incidental bugs found during the audit, fixed as part of touching these files** (not new scope — same files, same reason: a hardcoded color that should be a token): Calendar's bodyweight-logged indicator uses `#4caf50` instead of the already-existing-but-unused `--color-success` token; `Log.module.css` has a stray `#444` that's literally identical to `--color-border`'s value and should just reference it.

**Deliberately NOT themed:** `--color-protein`, `--color-carbs`, `--color-fat`, `--color-success` stay the same hex values across all 6 themes. These are semantic/data colors (macro categories, a success state), not surface chrome — keeping them constant means a protein bar reads as "protein-colored" regardless of which theme you're in, the same way a chart's category colors don't usually change with dark/light mode elsewhere. Box shadows (`rgba(0, 0, 0, 0.5)` on dropdowns, `rgba(0, 0, 0, 0.7)` on the Calendar modal overlay) also stay hardcoded black — a shadow reads as "shadow" on any background, and isn't worth a token for this pass.

## Applying and persisting the choice

Same pattern as the language toggle: `theme` lives on the singleton `Settings` DB row (`String @default("dark-red")`, new column + migration, no route changes — `PUT /api/settings` already does a partial upsert). `App.jsx`'s existing bootstrap `useEffect` (added for language) gets one more line: alongside `i18n.changeLanguage(...)`, also `document.documentElement.setAttribute("data-theme", settings.theme)` if it differs from the current default — one fetch already happening, no new request needed.

## Settings UI

A custom swatch-dropdown (not a native `<select>` — browsers don't reliably render colored content inside `<option>` elements). Matches this app's existing pattern for custom dropdowns (Calendar's per-day menu, Stats' manage-menu): a trigger showing a colored dot + the current theme's name, click opens a list of all 6 options (each its own dot + name), click an option to select. Same instant-apply-and-persist-in-background behavior as the language dropdown: `document.documentElement.setAttribute(...)` fires immediately, `PUT /api/settings { theme: newTheme }` fires in the background, no separate Save click needed. Inlined directly in `Settings.jsx` (open/closed state, click-outside handling) rather than extracted into a shared component — matches how Calendar's and Stats' own dropdowns are each self-contained in their page file, not shared.

## Chart colors (Dashboard.jsx, Stats.jsx)

**Key simplification**: this app's routing (`react-router-dom`, one `<Route>` per page) means each page component fully unmounts when you navigate away and fully remounts when you come back — Dashboard and Stats are never mounted at the same time as the Settings page where you'd change the theme. So the chart color values just need to be read **once, at render time**, not kept reactively in sync with a live theme change — by the time you navigate to a chart page, the DOM already has the new `data-theme` attribute applied. A small helper (e.g. `getCssVar(name)` using `getComputedStyle(document.documentElement).getPropertyValue(name).trim()`) reads `--color-accent`, `--color-text-dim`, `--color-bg-card`, `--color-border` at the top of each component and feeds those into the existing Recharts `stroke`/`fill`/`contentStyle` props, replacing the hardcoded hex values. No context, no listener, no extra re-render machinery.

## Theme palettes (all 6, full token sets)

`--color-protein`/`--color-carbs`/`--color-fat`/`--color-success` are omitted below since they're constant across all themes (see above): `#7fa8d9` / `#d99a5c` / `#d9c25c` / `#5cb87a`.

| Token | Dark Red (default) | Light | Dark Blue | Dark Green | Amber | Pure Black |
|---|---|---|---|---|---|---|
| `--color-bg` | `#0d0d0d` | `#f4f2ee` | `#0a0e14` | `#0a0f0a` | `#120e08` | `#000000` |
| `--color-bg-card` | `#141414` | `#ffffff` | `#111823` | `#111a11` | `#1c1710` | `#0a0a0a` |
| `--color-bg-elevated` | `#1e1e1e` | `#ffffff` | `#182233` | `#182618` | `#241d13` | `#141414` |
| `--color-bg-hover` | `#1a1a1a` | `#e8e6e0` | `#16202e` | `#162016` | `#20190f` | `#111111` |
| `--color-nav-bg` | `#111111` | `#ffffff` | `#0d131c` | `#0d130d` | `#16110a` | `#000000` |
| `--color-accent` | `#ff3b3b` | `#c62828` | `#3ba7ff` | `#3ec95c` | `#ffb020` | `#ffffff` |
| `--color-accent-rgb` | `255, 59, 59` | `198, 40, 40` | `59, 167, 255` | `62, 201, 92` | `255, 176, 32` | `255, 255, 255` |
| `--color-text` | `#f0f0f0` | `#1a1a1a` | `#e8edf4` | `#e8f4e8` | `#f4ecd9` | `#ffffff` |
| `--color-text-dim` | `#666666` | `#767676` | `#5a6b7d` | `#5c7d5c` | `#8a7355` | `#777777` |
| `--color-text-placeholder` | `#888888` | `#999999` | `#6f8194` | `#729172` | `#a08a6a` | `#999999` |
| `--color-border` | `#444444` | `#d8d5cf` | `#2c3b4d` | `#2c4a2c` | `#4a3d28` | `#333333` |
| `--color-border-subtle` | `#222222` | `#e8e6e0` | `#1a2530` | `#1a2a1a` | `#241d13` | `#1a1a1a` |

Light uses a deeper red (`#c62828`) for its accent rather than the dark themes' `#ff3b3b` — that exact red is low-contrast/glary directly on a near-white background, so it's darkened for readability while staying recognizably "red." Pure Black uses white as its accent (a red accent on a literal-black/white-text scheme would fight with the text color for attention; white accent keeps it a clean two-tone high-contrast look, which is the point of that theme).

## Testing

No automated test suite — `npm run build` plus manual checks:
1. Default load (never touched the picker): app looks identical to today — Dark Red, byte-identical colors.
2. Settings → theme swatch-dropdown: shows all 6, current one indicated, each dot shows its actual accent color.
3. Pick each of the 5 non-default themes in turn: confirm the whole visible app (NavBar, cards, buttons, dropdowns/menus on at least one page that has one, hover states) switches — not just the page you're on.
4. Visit Dashboard and Stats under at least 2 different themes: confirm the bodyweight/e1RM line charts' colors (axis text, tooltip, line stroke) match the active theme, not stuck on red/dark.
5. Reload the browser after picking a non-default theme: confirms it persisted and `App.jsx`'s bootstrap re-applies it.
6. Spot-check the two incidental bug fixes: Calendar's bodyweight ⚖ indicator color now comes from `--color-success` (visually: same green as before, since the token's default value equals the old hardcoded one — confirms it's a refactor, not a visible change); Log's affected element still matches the border color used elsewhere on that page.
