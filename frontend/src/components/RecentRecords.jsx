import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useDayLabel } from "../hooks/useDayLabel";
import { formatNumber, formatSet } from "../utils/numbers";
import Icon from "./Icon";
import styles from "./RecentRecords.module.css";

const E1RM_DECIMAL_PLACES = 1;
// More than this and the rest wait behind "Show all".
const VISIBLE_RECORDS = 5;

/**
 * The records of a period, newest first (summarizePeriod's `records`): the exercise, the set that
 * did it, its e1RM and when. A click on a record calls onSelect(name).
 */
function RecentRecords({ records, periodSpan, onSelect }) {
  const { t, i18n } = useTranslation();
  const dayText = useDayLabel();
  const [showAll, setShowAll] = useState(false);
  const shown = showAll ? records : records.slice(0, VISIBLE_RECORDS);

  return (
    <section className={styles.section}>
      <h2 className={styles.heading}>{t("stats.recentPrs")}</h2>
      {records.length === 0 ? (
        <p className={styles.empty}>{t("stats.noRecentPrs", { period: periodSpan })}</p>
      ) : (
        <ul className={styles.list}>
          {shown.map((record) => (
            <li key={`${record.name}-${record.date}`}>
              <button type="button" className={styles.row} onClick={() => onSelect(record.name)}>
                <span className={styles.icon}>
                  <Icon name="trophy" size={18} />
                </span>
                <span className={styles.main}>
                  <span className={styles.name}>{record.name}</span>
                  <span className={styles.detail}>{formatSet(record, i18n.language)}</span>
                </span>
                <span className={styles.side}>
                  <span className={styles.value}>
                    {`${formatNumber(record.e1rm, i18n.language, { decimals: E1RM_DECIMAL_PLACES })} kg`}
                  </span>
                  <span className={styles.date}>{dayText(record.date)}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {records.length > VISIBLE_RECORDS && (
        <button
          type="button"
          className={styles.moreButton}
          onClick={() => setShowAll((prev) => !prev)}
        >
          {showAll ? t("stats.showFewer") : t("stats.showAll", { count: records.length })}
        </button>
      )}
    </section>
  );
}

export default RecentRecords;
