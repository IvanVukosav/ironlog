import { useEffect, useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { fetchJson } from "../api";
import { useReportError } from "../hooks/useReportError";
import { splitDuration, summarizeWorkout } from "../utils/activeWorkout";
import { formatWeekdayDate } from "../utils/dates";
import { formatNumber, formatVolume } from "../utils/numbers";
import Icon from "./Icon";
import Sheet from "./Sheet";
import styles from "./WorkoutSummary.module.css";

const E1RM_DECIMALS = 1;

/**
 * What "Finish" shows before the workout is closed: how long it took, its working sets, the
 * weight moved and the records it set, and how many planned sets will not be kept. "Done" closes
 * the workout (`onDone`); "Keep training" goes back to it (`onContinue`).
 */
function WorkoutSummary({ workout, formula, onDone, onContinue }) {
  const { t, i18n } = useTranslation();
  const language = i18n.language;
  const id = useId();
  const reportError = useReportError();
  // The length is taken when the summary opens, so it stands still while it is read.
  const [openedAt] = useState(() => Date.now());
  const [previousSets, setPreviousSets] = useState(null);

  // Without the earlier sets there are no records to name, but the workout can still be closed.
  useEffect(() => {
    fetchJson("/api/stats/prs")
      .then(setPreviousSets)
      .catch((err) => {
        setPreviousSets([]);
        reportError(err);
      });
  }, [reportError]);

  const summary = summarizeWorkout(workout, previousSets ?? [], formula);
  const { hours, minutes } = splitDuration(openedAt - Date.parse(workout.startedAt));
  const duration =
    hours > 0 ? t("log.durationHours", { hours, minutes }) : t("log.durationMinutes", { minutes });
  const e1rm = (value) => formatNumber(value, language, { maxDecimals: E1RM_DECIMALS });

  return (
    <Sheet labelledBy={`${id}title`} closeLabel={t("log.summaryContinue")} onClose={onContinue}>
      <div className={styles.heading}>
        <h2 id={`${id}title`} className={styles.title}>
          {t("log.summaryTitle")}
        </h2>
        <p className={styles.subtitle}>
          {workout.name || t("log.untitledWorkout")} · {formatWeekdayDate(workout.date, language)}
        </p>
      </div>

      {/* All of it at once, once the records are known: a list growing under a finger would move
          "Done" away just as it is tapped. */}
      {previousSets === null ? (
        <p className={styles.loading}>{t("log.summaryLoading")}</p>
      ) : (
        <>
          <dl className={styles.tiles}>
            <div className={styles.tile}>
              <dt className={styles.tileLabel}>{t("log.summaryDuration")}</dt>
              <dd className={styles.tileValue}>{duration}</dd>
            </div>
            <div className={styles.tile}>
              <dt className={styles.tileLabel}>{t("log.summaryWorkingSets")}</dt>
              <dd className={styles.tileValue}>{formatNumber(summary.workingSets, language)}</dd>
            </div>
            <div className={styles.tile}>
              <dt className={styles.tileLabel}>{t("log.summaryVolume")}</dt>
              <dd className={styles.tileValue}>{formatVolume(summary.volume, language)}</dd>
            </div>
          </dl>

          <section className={styles.records} aria-labelledby={`${id}records`}>
            <h3 id={`${id}records`} className={styles.recordsTitle}>
              {t("log.summaryRecords")}
            </h3>
            {summary.records.length === 0 ? (
              <p className={styles.noRecords}>{t("log.summaryNoRecords")}</p>
            ) : (
              <ul className={styles.recordList}>
                {summary.records.map((record) => (
                  <li key={record.name} className={styles.record}>
                    <span className={styles.trophy}>
                      <Icon name="trophy" size={22} />
                    </span>
                    <span className={styles.recordText}>
                      <span className={styles.recordName}>{record.name}</span>
                      <span className={styles.recordDetail}>
                        {t("log.summaryRecordDetail", { value: e1rm(record.e1rm) })}
                      </span>
                    </span>
                    <span className={styles.recordGain}>
                      {t("log.summaryRecordGain", { value: e1rm(record.gain) })}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {summary.plannedLeft > 0 && (
            <p className={styles.planLeft}>
              {t("log.summaryPlanLeft", { count: summary.plannedLeft })}
            </p>
          )}

          <div className={styles.actions}>
            <button type="button" className={styles.doneButton} onClick={onDone}>
              {t("log.done")}
            </button>
            <button type="button" className={styles.continueButton} onClick={onContinue}>
              {t("log.summaryContinue")}
            </button>
          </div>
        </>
      )}
    </Sheet>
  );
}

export default WorkoutSummary;
