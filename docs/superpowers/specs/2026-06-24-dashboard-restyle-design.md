# Dashboard restyle — design

## Context

IronLog has almost no visual design right now — `App.css` is empty, and only
`Navbar.css` / `index.css` have minimal styling (dark background `#0d0d0d`,
light text `#f0f0f0`, red accent `#ff3b3b` on nav hover). All page content
(Dashboard, Log, Nutrition, Calendar, Calculator, Stats, Settings) renders as
unstyled HTML on that dark background.

This spec covers restyling **Dashboard.jsx only**. Other pages and the Navbar
are deliberately out of scope — we'll revisit them after seeing this one live.

## Visual style

"Tehnički / Data-driven" direction, chosen from three mocked-up options
(Agresivno/Gym, Čisto/Minimalno, Tehnički/Data-driven). Builds on the existing
dark palette rather than replacing it:

- Background stays `#0d0d0d` (existing).
- Cards: background `#141414`, 3px solid left border in accent red `#ff3b3b`.
- Typography: **monospace throughout** — headings (h1, h2), labels, and data
  values all use the same monospace font. No mixing with a sans-serif for
  headings; the uniform monospace treatment is the deliberate choice (decided
  after comparing a mixed sans/mono option against an all-monospace option).
- Text colors: dim gray (`#666`) for small uppercase labels (e.g.
  `TRENING_DANAS`), bright white (`#fff`/`#f0f0f0`) for the actual values.

## Layout

Grid, 2 columns:
- "Trening danas" and "Prehrana danas" cards sit side by side (1fr 1fr).
- "Tjedni napredak" spans the full width on the row below (`grid-column: span 2`).

This replaces the current single-column stack.

## CSS architecture

CSS Modules, one per component (Vite supports `.module.css` natively, no new
dependency). For this spec: `frontend/src/pages/Dashboard.module.css`.

Shared visual patterns that will recur across other pages later (card look,
label/value text styles) live in `frontend/src/styles/shared.module.css`.
`Dashboard.module.css` pulls them in via CSS Modules `composes`:

```css
.card {
  composes: card from "../styles/shared.module.css";
}
```

This avoids copy-pasting the same card/label/value CSS into every page module
as we restyle the rest of the app later.

## Design tokens (CSS custom properties)

Per MDN's CSS custom properties guidance, the color palette and font live as
`:root` custom properties in `index.css`, referenced via `var()` everywhere
instead of repeating literal hex values across module files — the CSS
equivalent of "no magic numbers, use named constants."

Proposed tokens:

```css
:root {
  --color-bg: #0d0d0d;
  --color-bg-card: #141414;
  --color-accent: #ff3b3b;
  --color-text: #f0f0f0;
  --color-text-dim: #666;
  --font-mono: ui-monospace, "Cascadia Code", "Consolas", monospace;
}
```

No external webfont — system monospace stack only, so there's no added
network request or font-loading flash.

## Out of scope

- Navbar — already dark + red, compatible with the new direction, left
  untouched this round.
- Log, Nutrition, Calendar, Calculator, Stats, Settings — same design
  language will extend to these later, as separate follow-up work once
  Dashboard is confirmed live.
