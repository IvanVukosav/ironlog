import { useState, useEffect } from "react";
import { fetchJson } from "../api";
import { useToast } from "../context/useToast";
import styles from "./MuscleGroupVolumeChart.module.css";

const RANGES = [
  { label: "Tjedan", range: "week" },
  { label: "Mjesec", range: "month" },
  { label: "Godina", range: "year" },
];
const MINIMUM_MAX_VOLUME = 1;

function MuscleGroupVolumeChart() {
  const { showError } = useToast();
  const [range, setRange] = useState("week");
  const [volumeData, setVolumeData] = useState([]);

  useEffect(() => {
    const today = new Date().toISOString().split("T")[0];
    fetchJson(`/api/stats/volume?range=${range}&date=${today}`)
      .then((data) => setVolumeData(data))
      .catch((err) => {
        console.error(err);
        showError(err.message);
      });
  }, [range, showError]);

  const maxVolume = Math.max(...volumeData.map((entry) => entry.volume), MINIMUM_MAX_VOLUME);

  return (
    <div>
      <div className={styles.rangeTabs}>
        {RANGES.map(({ label, range: rangeValue }) => (
          <button
            key={rangeValue}
            className={range === rangeValue ? styles.rangeTabActive : styles.rangeTab}
            onClick={() => setRange(rangeValue)}
          >
            {label}
          </button>
        ))}
      </div>
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
              <span className={styles.barValue}>{Math.round(entry.volume)}kg</span>
            </div>
          ))}
        </div>
      ) : (
        <p className={styles.emptyState}>Nema podataka</p>
      )}
    </div>
  );
}

export default MuscleGroupVolumeChart;
