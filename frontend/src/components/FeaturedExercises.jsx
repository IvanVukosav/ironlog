import { useTranslation } from "react-i18next";
import { summarizeExercise } from "../utils/featuredExercises";
import { formatNumber } from "../utils/numbers";
import styles from "./FeaturedExercises.module.css";

const E1RM_DECIMAL_PLACES = 1;
const SPARKLINE_WIDTH = 72;
const SPARKLINE_HEIGHT = 28;
// Keeps the 2px line and the end dot inside the box.
const SPARKLINE_PADDING = 4;
const END_DOT_RADIUS = 3;

// e1RM per session, oldest to latest, ending in a dot on the latest session.
function Sparkline({ values }) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const x = (index) =>
    SPARKLINE_PADDING + (index * (SPARKLINE_WIDTH - 2 * SPARKLINE_PADDING)) / (values.length - 1);
  const y = (value) =>
    max === min
      ? SPARKLINE_HEIGHT / 2
      : SPARKLINE_PADDING +
        ((max - value) / (max - min)) * (SPARKLINE_HEIGHT - 2 * SPARKLINE_PADDING);
  const last = values.length - 1;

  return (
    <svg
      className={styles.sparkline}
      width={SPARKLINE_WIDTH}
      height={SPARKLINE_HEIGHT}
      viewBox={`0 0 ${SPARKLINE_WIDTH} ${SPARKLINE_HEIGHT}`}
      aria-hidden="true"
    >
      <polyline
        points={values.map((value, index) => `${x(index)},${y(value)}`).join(" ")}
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle cx={x(last)} cy={y(values[last])} r={END_DOT_RADIUS} fill="currentColor" />
    </svg>
  );
}

// "▲ +6,2 kg · 30 dana", "bez promjene · 30 dana", or "novo" for an exercise newer than the period.
function ChangeLine({ change, periodSpan }) {
  const { t, i18n } = useTranslation();
  if (change === null) return <span className={styles.change}>{t("stats.featuredNew")}</span>;
  if (change > 0) {
    const gain = t("stats.featuredGain", {
      value: formatNumber(change, i18n.language, { decimals: E1RM_DECIMAL_PLACES }),
    });
    return (
      <span className={`${styles.change} ${styles.changeUp}`}>{`${gain} · ${periodSpan}`}</span>
    );
  }
  return <span className={styles.change}>{`${t("stats.featuredNoChange")} · ${periodSpan}`}</span>;
}

/**
 * One row per featured exercise: its best e1RM, the gain over the period (which starts at the
 * time `since`, and `periodSpan` names) and a trend line. `exerciseSets` is the /api/stats/prs
 * shape. A click on a row calls onSelect(name); "Edit" calls onEdit, which leads to where the
 * featured exercises are picked.
 */
function FeaturedExercises({
  exerciseSets,
  names,
  isAuto,
  formula,
  since,
  periodSpan,
  onSelect,
  onEdit,
}) {
  const { t, i18n } = useTranslation();
  if (names.length === 0) return null;

  return (
    <section className={styles.section}>
      <div className={styles.header}>
        <h2 className={styles.heading}>{t("stats.featuredTitle")}</h2>
        <button type="button" className={styles.editButton} onClick={onEdit}>
          {t("stats.edit")}
        </button>
      </div>
      <ul className={styles.list}>
        {names.map((name) => {
          const sets = exerciseSets.find((exercise) => exercise.name === name)?.sets ?? [];
          const summary = summarizeExercise(sets, formula, since);
          return (
            <li key={name}>
              <button type="button" className={styles.row} onClick={() => onSelect(name)}>
                <span className={styles.nameBlock}>
                  <span className={styles.name}>{name}</span>
                  {summary && <ChangeLine change={summary.change} periodSpan={periodSpan} />}
                </span>
                {/* One session has no trend to draw. */}
                {summary?.trend.length > 1 ? (
                  <Sparkline values={summary.trend} />
                ) : (
                  <span className={styles.sparklineSpace} />
                )}
                <span className={styles.value}>
                  {summary
                    ? `${formatNumber(summary.best, i18n.language, { decimals: E1RM_DECIMAL_PLACES })} kg`
                    : "—"}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {isAuto && <p className={styles.hint}>{t("stats.featuredAutoHint")}</p>}
    </section>
  );
}

export default FeaturedExercises;
