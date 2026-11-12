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
import { buildE1rmTimeline } from "../utils/oneRepMax";
import { MAIN_LIFTS } from "../utils/strengthScores";
import { AXIS_TICK, CHART_COLORS } from "../utils/chartTheme";
import { formatDayMonth } from "../utils/dates";
import { formatNumber } from "../utils/numbers";
import styles from "./MainLiftsChart.module.css";

const E1RM_DECIMAL_PLACES = 1;
const PR_DOT_RADIUS = 4;
// Same size as a PR marker (8px across) but without the ring, so it doesn't read as a PR.
const SINGLE_POINT_DOT_RADIUS = 4;

function ChartTooltip({ active, payload, label, liftNames }) {
  const { i18n } = useTranslation();
  const entries = (payload ?? []).filter(
    (entry) => entry.value !== null && entry.value !== undefined,
  );
  if (!active || entries.length === 0) return null;

  return (
    <div className={styles.tooltip}>
      <div className={styles.tooltipDate}>{formatDayMonth(label)}</div>
      {entries.map((entry) => (
        <div key={entry.dataKey} className={styles.tooltipRow}>
          <span className={styles.swatch} style={{ backgroundColor: entry.color }} />
          <span>{liftNames[entry.dataKey]}</span>
          <span className={styles.tooltipValue}>
            {`${formatNumber(entry.value, i18n.language, { decimals: E1RM_DECIMAL_PLACES })} kg`}
          </span>
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
  const { t, i18n } = useTranslation();
  const liftColors = CHART_COLORS.lifts;

  const lifts = MAIN_LIFTS.filter((lift) => mainLiftBests[lift]);
  const liftNames = Object.fromEntries(lifts.map((lift) => [lift, mainLiftBests[lift].name]));

  // One row per session date; a lift trained another day is left empty there.
  const rowsByTime = new Map();
  const pointCounts = {};
  for (const lift of lifts) {
    const sets = exerciseSets.find((exercise) => exercise.name === liftNames[lift])?.sets ?? [];
    const timeline = buildE1rmTimeline(sets, formula);
    pointCounts[lift] = timeline.length;
    for (const point of timeline) {
      const row = rowsByTime.get(point.time) ?? { time: point.time };
      row[lift] = point.e1rm;
      row[`${lift}Pr`] = point.isPr;
      rowsByTime.set(point.time, row);
    }
  }
  const data = [...rowsByTime.values()].sort((rowA, rowB) => rowA.time - rowB.time);

  if (lifts.length === 0 || data.length < 2) return null;

  // PR sessions get a marker. A lift trained only once has no line to draw, so its one
  // session gets a plain dot instead of vanishing from the chart.
  const renderDot = (lift) => (props) => {
    const { cx, cy, payload } = props;
    const key = `${lift}-${payload.time}`;
    if (cx === undefined || cy === undefined || payload[lift] === undefined) {
      return <g key={key} />;
    }
    if (payload[`${lift}Pr`]) {
      return (
        <circle
          key={key}
          cx={cx}
          cy={cy}
          r={PR_DOT_RADIUS}
          fill={liftColors[lift]}
          stroke={CHART_COLORS.surface}
          strokeWidth={2}
        />
      );
    }
    if (pointCounts[lift] === 1) {
      return (
        <circle key={key} cx={cx} cy={cy} r={SINGLE_POINT_DOT_RADIUS} fill={liftColors[lift]} />
      );
    }
    return <g key={key} />;
  };

  return (
    <section>
      <h2 className={styles.heading}>{t("stats.mainLiftsChart")}</h2>
      <ul className={styles.legend}>
        {lifts.map((lift) => (
          <li key={lift} className={styles.legendItem}>
            <span className={styles.swatch} style={{ backgroundColor: liftColors[lift] }} />
            <span>{liftNames[lift]}</span>
            <span className={styles.legendValue}>
              {`${formatNumber(mainLiftBests[lift].e1rm, i18n.language, { decimals: E1RM_DECIMAL_PLACES })} kg`}
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
          <CartesianGrid stroke={CHART_COLORS.grid} vertical={false} />
          <XAxis
            dataKey="time"
            type="number"
            scale="time"
            domain={["dataMin", "dataMax"]}
            tickFormatter={formatDayMonth}
            tick={AXIS_TICK}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={AXIS_TICK}
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
              dot={renderDot(lift)}
              activeDot={{ r: 5, stroke: CHART_COLORS.surface, strokeWidth: 2 }}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </section>
  );
}

export default MainLiftsChart;
