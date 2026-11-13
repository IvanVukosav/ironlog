import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { fetchJson } from "../api";
import { useReportError } from "../hooks/useReportError";
import { todayKey } from "../utils/dates";
import { formatVolume } from "../utils/numbers";
import SegmentedControl from "./SegmentedControl";
import styles from "./MuscleGroupVolumeChart.module.css";

const MINIMUM_MAX_VOLUME = 1;

function MuscleGroupVolumeChart() {
  const { t, i18n } = useTranslation();
  const reportError = useReportError();
  const [range, setRange] = useState("week");
  const [volumeData, setVolumeData] = useState([]);
  const ranges = [
    { label: t("common.week"), value: "week" },
    { label: t("common.month"), value: "month" },
    { label: t("common.year"), value: "year" },
  ];

  useEffect(() => {
    const today = todayKey();
    fetchJson(`/api/stats/volume?range=${range}&date=${today}`)
      .then(setVolumeData)
      .catch(reportError);
  }, [range, reportError]);

  const maxVolume = Math.max(...volumeData.map((entry) => entry.volume), MINIMUM_MAX_VOLUME);

  return (
    <div className={styles.chart}>
      <SegmentedControl
        compact
        label={t("stats.periodLabel")}
        options={ranges}
        value={range}
        onChange={setRange}
      />
      {volumeData.length > 0 ? (
        <div className={styles.barList}>
          {volumeData.map((entry) => (
            <div key={entry.muscleGroup} className={styles.barRow}>
              <span className={styles.barLabel}>{entry.muscleGroup}</span>
              <div className={styles.barTrack}>
                <div
                  className={styles.barFill}
                  style={{ width: `${(entry.volume / maxVolume) * 100}%` }}
                />
              </div>
              <span className={styles.barValue}>{formatVolume(entry.volume, i18n.language)}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className={styles.emptyState}>{t("dashboard.noData")}</p>
      )}
    </div>
  );
}

export default MuscleGroupVolumeChart;
