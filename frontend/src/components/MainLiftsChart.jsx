import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { useTranslation } from "react-i18next";
import { calculateEstimatedOneRepMax } from "../utils/oneRepMax";
import { MAIN_LIFTS } from "../utils/strengthScores";
import { getCssVar } from "../utils/theme";
import styles from "./MainLiftsChart.module.css";

const E1RM_DECIMAL_PLACES = 1;
const PR_DOT_RADIUS = 4;

function formatChartDate(time) {
  const date = new Date(time);
  return `${date.getUTCDate()}/${date.getUTCMonth() + 1}`;
}

// Best e1RM per session date, oldest first, flagging sessions that beat every
// earlier one (the first session is the baseline, not a PR).
function buildTimeline(sets, formula) {
  const bestByTime = new Map();
  for (const set of sets) {
    if (set.isWarmup) continue;
    const e1rm = calculateEstimatedOneRepMax(set.weight, set.reps, set.rpe, formula);
    if (e1rm === null) continue;
    const time = new Date(set.date).getTime();
    if (!bestByTime.has(time) || e1rm > bestByTime.get(time)) bestByTime.set(time, e1rm);
  }

  let runningBest = null;
  return [...bestByTime.entries()]
    .sort(([timeA], [timeB]) => timeA - timeB)
    .map(([time, e1rm]) => {
      const isPr = runningBest !== null && e1rm > runningBest;
      runningBest = runningBest === null ? e1rm : Math.max(runningBest, e1rm);
      return { time, e1rm: parseFloat(e1rm.toFixed(E1RM_DECIMAL_PLACES)), isPr };
    });
}

function ChartTooltip({ active, payload, label, liftNames }) {
  const entries = (payload ?? []).filter(
    (entry) => entry.value !== null && entry.value !== undefined,
  );
  if (!active || entries.length === 0) return null;

  return (
    <div className={styles.tooltip}>
      <div className={styles.tooltipDate}>{formatChartDate(label)}</div>
      {entries.map((entry) => (
        <div key={entry.dataKey} className={styles.tooltipRow}>
          <span className={styles.swatch} style={{ backgroundColor: entry.color }} />
          <span>{liftNames[entry.dataKey]}</span>
          <span className={styles.tooltipValue}>{entry.value}kg</span>
          {entry.payload[`${entry.dataKey}Pr`] && <span className={styles.prTag}>PR</span>}
        </div>
      ))}
    </div>
  );
}

/**
 * e1RM over time for squat, bench and deadlift on one chart, with a marker
 * on every session that set a new best. `exerciseSets` is the
 * /api/stats/prs shape; `mainLiftBests` comes from findMainLiftBests.
 */
function MainLiftsChart({ exerciseSets, mainLiftBests, formula }) {
  const { t } = useTranslation();
  const surfaceColor = getCssVar("--color-bg");
  const textDimColor = getCssVar("--color-text-dim");
  const gridColor = getCssVar("--color-border-subtle");
  const chartFontFamily = getCssVar("--font-body");
  const liftColors = Object.fromEntries(
    MAIN_LIFTS.map((lift) => [lift, getCssVar(`--color-lift-${lift}`)]),
  );

  const lifts = MAIN_LIFTS.filter((lift) => mainLiftBests[lift]);
  const liftNames = Object.fromEntries(lifts.map((lift) => [lift, mainLiftBests[lift].name]));

  // One row per session date; a lift trained another day is left empty there.
  const rowsByTime = new Map();
  for (const lift of lifts) {
    const sets = exerciseSets.find((exercise) => exercise.name === liftNames[lift])?.sets ?? [];
    for (const point of buildTimeline(sets, formula)) {
      const row = rowsByTime.get(point.time) ?? { time: point.time };
      row[lift] = point.e1rm;
      row[`${lift}Pr`] = point.isPr;
      rowsByTime.set(point.time, row);
    }
  }
  const data = [...rowsByTime.values()].sort((rowA, rowB) => rowA.time - rowB.time);

  if (lifts.length === 0 || data.length < 2) return null;

  const renderPrDot = (lift) => (props) => {
    const { cx, cy, payload } = props;
    if (!payload[`${lift}Pr`] || cx === undefined || cy === undefined) {
      return <g key={`${lift}-${payload.time}`} />;
    }
    return (
      <circle
        key={`${lift}-${payload.time}`}
        cx={cx}
        cy={cy}
        r={PR_DOT_RADIUS}
        fill={liftColors[lift]}
        stroke={surfaceColor}
        strokeWidth={2}
      />
    );
  };

  return (
    <div className={styles.section}>
      <h2 className={styles.heading}>{t("stats.mainLiftsChart")}</h2>
      <ul className={styles.legend}>
        {lifts.map((lift) => (
          <li key={lift} className={styles.legendItem}>
            <span className={styles.swatch} style={{ backgroundColor: liftColors[lift] }} />
            <span>{liftNames[lift]}</span>
            <span className={styles.legendValue}>
              {mainLiftBests[lift].e1rm.toFixed(E1RM_DECIMAL_PLACES)}kg
            </span>
          </li>
        ))}
        <li className={styles.legendItem}>
          <span className={styles.prMarker} />
          <span>{t("stats.prMarkerLegend")}</span>
        </li>
      </ul>
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid stroke={gridColor} vertical={false} />
          <XAxis
            dataKey="time"
            type="number"
            scale="time"
            domain={["dataMin", "dataMax"]}
            tickFormatter={formatChartDate}
            tick={{ fill: textDimColor, fontFamily: chartFontFamily, fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: textDimColor, fontFamily: chartFontFamily, fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            domain={["auto", "auto"]}
            unit="kg"
            width={56}
          />
          <Tooltip content={<ChartTooltip liftNames={liftNames} />} />
          {lifts.map((lift) => (
            <Line
              key={lift}
              type="monotone"
              dataKey={lift}
              stroke={liftColors[lift]}
              strokeWidth={2}
              connectNulls
              dot={renderPrDot(lift)}
              activeDot={{ r: 5, stroke: surfaceColor, strokeWidth: 2 }}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export default MainLiftsChart;
