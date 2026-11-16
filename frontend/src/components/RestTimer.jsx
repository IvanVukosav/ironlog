import { useTranslation } from "react-i18next";
import { useRestTimer } from "../context/useRestTimer";
import styles from "./RestTimer.module.css";

const ADJUST_STEP_SECONDS = 15;
const MAX_PERCENT = 100;

function formatRest(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  return `${minutes}:${String(totalSeconds % 60).padStart(2, "0")}`;
}

// The rest that runs after a set: the time left, ±15 s and a way to skip it, with the next set
// named above. Nothing shows while no rest is on.
function RestTimer() {
  const { t } = useTranslation();
  const { secondsRemaining, totalSeconds, label, isOver, adjust, skip } = useRestTimer();
  if (secondsRemaining === null) return null;

  const status = isOver ? t("rest.over") : t("rest.running");
  const percent =
    totalSeconds > 0 ? Math.min(MAX_PERCENT, (secondsRemaining / totalSeconds) * MAX_PERCENT) : 0;

  return (
    <section
      className={isOver ? `${styles.bar} ${styles.barOver}` : styles.bar}
      aria-label={t("rest.title")}
    >
      <div className={styles.body}>
        <p className={styles.label} aria-live="polite">
          {label ? t("rest.withNext", { status, next: label }) : status}
        </p>
        <div className={styles.row}>
          <span className={styles.time} role="timer">
            {formatRest(secondsRemaining)}
          </span>
          <button
            type="button"
            className={styles.adjust}
            aria-label={t("rest.less")}
            onClick={() => adjust(-ADJUST_STEP_SECONDS)}
          >
            −15
          </button>
          <button
            type="button"
            className={styles.adjust}
            aria-label={t("rest.more")}
            onClick={() => adjust(ADJUST_STEP_SECONDS)}
          >
            +15
          </button>
          <button type="button" className={styles.skip} onClick={skip}>
            {isOver ? t("rest.close") : t("rest.skip")}
          </button>
        </div>
      </div>
      <div className={styles.track} aria-hidden="true">
        <div className={styles.fill} style={{ width: `${percent}%` }} />
      </div>
    </section>
  );
}

export default RestTimer;
