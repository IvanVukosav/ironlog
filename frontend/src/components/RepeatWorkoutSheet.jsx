import { useId } from "react";
import { useTranslation } from "react-i18next";
import { useDayLabel } from "../hooks/useDayLabel";
import { workingSetCount } from "../utils/repeatWorkout";
import Sheet from "./Sheet";
import styles from "./RepeatWorkoutSheet.module.css";

/**
 * "Ponovi trening": the past workouts to start again, newest first (from utils/repeatWorkout.js).
 * A tap on one calls `onPick(workout)`; while `isBusy` (it is being loaded) the list waits.
 * `isPlan` says what the picked workout becomes: a plan to tick off, or sets done on a day filled
 * in afterwards.
 */
function RepeatWorkoutSheet({ workouts, isPlan, isBusy, onPick, onClose }) {
  const { t } = useTranslation();
  const id = useId();
  const dayLabel = useDayLabel();

  return (
    <Sheet labelledBy={`${id}title`} closeLabel={t("repeat.close")} onClose={onClose}>
      <div>
        <h2 id={`${id}title`} className={styles.title}>
          {t("repeat.title")}
        </h2>
        <p className={styles.hint}>{t(isPlan ? "repeat.hintPlan" : "repeat.hintDone")}</p>
      </div>
      <ul className={styles.list}>
        {workouts.map((workout) => (
          <li key={workout.id}>
            <button
              type="button"
              className={styles.row}
              disabled={isBusy}
              onClick={() => onPick(workout)}
            >
              <span className={styles.top}>
                <span className={styles.name}>
                  {workout.name || t("dashboard.workoutFallbackName")}
                </span>
                <span className={styles.date}>{dayLabel(workout.date)}</span>
              </span>
              <span className={styles.detail}>
                {[
                  t("dashboard.exerciseCount", { count: workout.exercises.length }),
                  t("repeat.workingSets", { count: workingSetCount(workout) }),
                  workout.exercises.map((exercise) => exercise.name).join(", "),
                ].join(" · ")}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </Sheet>
  );
}

export default RepeatWorkoutSheet;
