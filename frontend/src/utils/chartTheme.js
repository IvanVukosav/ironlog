// How every chart is coloured and lettered. The values are CSS variables on purpose: Recharts
// puts them into SVG attributes and inline styles as they are, and the browser resolves them
// there. So a chart follows the theme the moment it changes, even when nothing re-renders
// (the device turning dark under the "auto" theme, for one).

export const CHART_COLORS = {
  accent: "var(--color-accent)",
  // What a chart is drawn on; rings around markers use it to stand clear of their line.
  surface: "var(--color-bg)",
  textDim: "var(--color-text-dim)",
  grid: "var(--color-border-subtle)",
  protein: "var(--color-protein)",
  carbs: "var(--color-carbs)",
  fat: "var(--color-fat)",
  lifts: {
    squat: "var(--color-lift-squat)",
    bench: "var(--color-lift-bench)",
    deadlift: "var(--color-lift-deadlift)",
  },
};

// The `tick` of an <XAxis> or <YAxis>.
export const AXIS_TICK = {
  fill: CHART_COLORS.textDim,
  fontFamily: "var(--font-body)",
  fontSize: 11,
};

// Spread onto a Recharts <Tooltip> for the app's tooltip box.
export const TOOLTIP_STYLE = {
  contentStyle: {
    background: "var(--color-bg-card)",
    border: "1px solid var(--color-border)",
    fontFamily: "var(--font-body)",
    fontSize: 12,
  },
  labelStyle: { color: CHART_COLORS.textDim },
  itemStyle: { color: "var(--color-text)" },
};
