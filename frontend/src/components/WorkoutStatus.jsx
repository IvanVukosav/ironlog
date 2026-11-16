import { useTranslation } from "react-i18next";
import { useNow } from "../hooks/useNow";
import { countSets, formatClock } from "../utils/activeWorkout";
import styles from "./WorkoutStatus.module.css";

const MAX_PERCENT = 100;

/**
 * The bar that stays at the top while a workout is trained: how long it has run (from the first
 * set done), how many sets are done, and "Finish". A finished workout shows its length and, on its
 * own day, a way to carry on.
 */
function WorkoutStatus({ workout, isToday, onFinish, onResume }) {
  const { t } = useTranslation();
  const isStarted = Boolean(workout.startedAt);
  const isFinished = Boolean(workout.finishedAt);
  const isRunning = isStarted && !isFinished;
  const now = useNow(isRunning);
  const { done, total, planned } = countSets(workout);
  const showProgress = planned > 0 || Boolean(workout.programId);

  const end = isFinished ? Date.parse(workout.finishedAt) : now;
  const duration = isStarted ? formatClock(end - Date.parse(workout.startedAt)) : formatClock(0);
  const percent = total > 0 ? (done / total) * MAX_PERCENT : 0;

  return (
    <div className={styles.sticky}>
      <div className={styles.bar}>
        <div className={styles.time}>
          <span className={styles.label}>
            {isFinished ? t("log.finishedLabel") : t("log.durationLabel")}
          </span>
          <span className={isStarted ? styles.clock : `${styles.clock} ${styles.clockIdle}`}>
            {duration}
          </span>
        </div>
        <div className={styles.progress}>
          <span className={styles.label}>
            {showProgress
              ? t("log.setsProgress", { done, count: total })
              : t("log.setsDone", { count: done })}
          </span>
          {showProgress && (
            <div
              className={styles.track}
              role="progressbar"
              aria-label={t("log.setsProgress", { done, count: total })}
              aria-valuemin={0}
              aria-valuemax={total}
              aria-valuenow={done}
            >
              <div className={styles.fill} style={{ width: `${percent}%` }} />
            </div>
          )}
        </div>
        {isRunning && (
          <button type="button" className={styles.finishButton} onClick={onFinish}>
            {t("log.finish")}
          </button>
        )}
        {isFinished && isToday && (
          <button type="button" className={styles.resumeButton} onClick={onResume}>
            {t("log.resume")}
          </button>
        )}
      </div>
    </div>
  );
}

export default WorkoutStatus;
