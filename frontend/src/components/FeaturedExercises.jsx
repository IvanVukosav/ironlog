import { useTranslation } from "react-i18next";
import { summarizeExercise } from "../utils/featuredExercises";
import styles from "./FeaturedExercises.module.css";

const E1RM_DECIMAL_PLACES = 1;
const SPARKLINE_WIDTH = 120;
const SPARKLINE_HEIGHT = 32;
// Keeps the 2px line and the end dot inside the box.
const SPARKLINE_PADDING = 5;
const END_DOT_RADIUS = 4;

// e1RM per session, oldest to latest, ending in a dot on the latest session.
function Sparkline({ values }) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const x = (index) =>
    values.length === 1
      ? SPARKLINE_WIDTH / 2
      : SPARKLINE_PADDING +
        (index * (SPARKLINE_WIDTH - 2 * SPARKLINE_PADDING)) / (values.length - 1);
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
      {values.length > 1 && (
        <polyline
          points={values.map((value, index) => `${x(index)},${y(value)}`).join(" ")}
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      )}
      <circle cx={x(last)} cy={y(values[last])} r={END_DOT_RADIUS} fill="currentColor" />
    </svg>
  );
}

function ChangeLine({ change }) {
  const { t } = useTranslation();
  if (change === null) return <span className={styles.change}>{t("stats.featuredNew")}</span>;
  if (change > 0) {
    return (
      <span className={`${styles.change} ${styles.changeUp}`}>
        {t("stats.featuredGain", { value: change.toFixed(E1RM_DECIMAL_PLACES) })}
      </span>
    );
  }
  return <span className={styles.change}>{t("stats.featuredNoChange")}</span>;
}

/**
 * One card per featured exercise: best e1RM, its gain over 30 days and a trend line.
 * `exerciseSets` is the /api/stats/prs shape; clicking a card calls onSelect(name).
 */
function FeaturedExercises({ exerciseSets, names, isAuto, formula, onSelect }) {
  const { t } = useTranslation();
  if (names.length === 0) return null;

  return (
    <section className={styles.section}>
      <h2 className={styles.heading}>{t("stats.featuredTitle")}</h2>
      <p className={styles.caption}>{t("stats.featuredCaption")}</p>
      <div className={styles.grid}>
        {names.map((name) => {
          const sets = exerciseSets.find((exercise) => exercise.name === name)?.sets ?? [];
          const summary = summarizeExercise(sets, formula);
          return (
            <button key={name} type="button" className={styles.card} onClick={() => onSelect(name)}>
              <span className={styles.label}>{name}</span>
              <span className={styles.value}>
                {summary ? `${summary.best.toFixed(E1RM_DECIMAL_PLACES)}kg` : "—"}
              </span>
              {summary && <ChangeLine change={summary.change} />}
              {/* One session has no trend to draw. */}
              {summary?.trend.length > 1 && <Sparkline values={summary.trend} />}
            </button>
          );
        })}
      </div>
      {isAuto && <p className={styles.hint}>{t("stats.featuredAutoHint")}</p>}
    </section>
  );
}

export default FeaturedExercises;
