import { useTranslation } from "react-i18next";
import { Cell, Pie, PieChart, Tooltip } from "recharts";
import { CHART_COLORS, TOOLTIP_STYLE } from "../utils/chartTheme";
import styles from "./MacroDonut.module.css";

const KCAL_PER_GRAM = { protein: 4, carbs: 4, fat: 9 };
const PERCENT_MULTIPLIER = 100;
const DIMENSIONS = {
  regular: { size: 140, innerRadius: 40, outerRadius: 65 },
  compact: { size: 110, innerRadius: 30, outerRadius: 50 },
};

/**
 * Where a day's calories came from: a donut of protein, carbs and fat with each one's share
 * beside it. Takes the grams eaten; draws nothing until there is something to show.
 * `className` lays out the donut and its legend (a flex row on both pages that use it).
 */
function MacroDonut({ protein, carbs, fat, compact = false, className = "" }) {
  const { t } = useTranslation();
  const { size, innerRadius, outerRadius } = compact ? DIMENSIONS.compact : DIMENSIONS.regular;

  const slices = [
    { key: "protein", name: "Protein", label: t("nutrition.macroProtein"), grams: protein },
    { key: "carbs", name: "Carbs", label: t("nutrition.macroCarbs"), grams: carbs },
    { key: "fat", name: "Fat", label: t("nutrition.macroFat"), grams: fat },
  ].map((slice) => ({
    ...slice,
    value: slice.grams * KCAL_PER_GRAM[slice.key],
    color: CHART_COLORS[slice.key],
  }));
  const totalKcal = slices.reduce((sum, slice) => sum + slice.value, 0);
  const eaten = slices.filter((slice) => slice.value > 0);
  if (eaten.length === 0) return null;

  return (
    <div className={[className, compact && styles.compact].filter(Boolean).join(" ")}>
      <PieChart width={size} height={size}>
        <Pie
          data={eaten}
          dataKey="value"
          nameKey="name"
          innerRadius={innerRadius}
          outerRadius={outerRadius}
          paddingAngle={2}
        >
          {eaten.map((slice) => (
            <Cell key={slice.key} fill={slice.color} />
          ))}
        </Pie>
        <Tooltip
          {...TOOLTIP_STYLE}
          formatter={(value, name) => [`${Math.round(value)} kcal`, name]}
        />
      </PieChart>
      <div className={styles.legend}>
        {slices.map((slice) => (
          <div key={slice.key} className={styles.legendRow}>
            <span className={styles.legendDot} style={{ backgroundColor: slice.color }} />
            {slice.label} {Math.round((slice.value / totalKcal) * PERCENT_MULTIPLIER)}%
          </div>
        ))}
      </div>
    </div>
  );
}

export default MacroDonut;
