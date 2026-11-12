import { useTranslation } from "react-i18next";
import { formatVolume } from "../utils/numbers";
import styles from "./VolumeBars.module.css";

// Below this many bars every one is labelled; above it, about this many labels are spread out.
const MAX_LABELS = 6;
// An empty week still shows a sliver, so the row of bars keeps its shape.
const MIN_BAR_PERCENT = 2;

/**
 * Working-set volume per week or month (volumeBuckets): a bar each, the current one in the accent.
 * Each bar's figure is in its text for screen readers and in its title for a pointer.
 */
function VolumeBars({ unit, buckets }) {
  const { t, i18n } = useTranslation();
  const max = Math.max(...buckets.map((bucket) => bucket.volume), 1);
  const labelEvery = Math.ceil(buckets.length / MAX_LABELS);
  const label = (start) =>
    new Intl.DateTimeFormat(
      i18n.language,
      unit === "week"
        ? { day: "numeric", month: "numeric", timeZone: "UTC" }
        : { month: "short", timeZone: "UTC" },
    ).format(start);
  const current = buckets.at(-1);
  const isWeeks = unit === "week";

  return (
    <section className={styles.section}>
      <div className={styles.header}>
        <h2 className={styles.heading}>
          {t(isWeeks ? "stats.weeklyVolume" : "stats.monthlyVolume")}
        </h2>
        <span className={styles.current}>
          {t(isWeeks ? "stats.thisWeek" : "stats.thisMonth", {
            volume: formatVolume(current.volume, i18n.language),
          })}
        </span>
      </div>
      <ol className={styles.bars}>
        {buckets.map((bucket, index) => {
          const text = `${isWeeks ? t("stats.weekOf", { date: label(bucket.start) }) : label(bucket.start)}: ${formatVolume(bucket.volume, i18n.language)}`;
          return (
            <li key={bucket.start} className={styles.slot} title={text}>
              <span
                className={
                  index === buckets.length - 1 ? `${styles.bar} ${styles.barCurrent}` : styles.bar
                }
                style={{
                  height: `${Math.max((bucket.volume / max) * 100, MIN_BAR_PERCENT)}%`,
                }}
              />
              <span className={styles.srOnly}>{text}</span>
            </li>
          );
        })}
      </ol>
      <div className={styles.labels} aria-hidden="true">
        {buckets.map((bucket, index) => (
          <span key={bucket.start}>
            {index % labelEvery === 0 || index === buckets.length - 1 ? label(bucket.start) : ""}
          </span>
        ))}
      </div>
    </section>
  );
}

export default VolumeBars;
